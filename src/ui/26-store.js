/* 26-store：会话态、按命盘的解读数据、后台任务，不依赖 React（T3b）
 *
 * DSH 切走面板会卸载组件，所以界面状态和正在跑的生成任务都放在这里（factory 闭包的模块级），组件只订阅。
 * 定义时不碰 DOM、window、定时器和 storage；createStore(deps) 拿到的就是它要用的全部外部依赖：
 *   { storage, fetch, now, engine, core, setTimeout, clearTimeout, openSession }
 *   storage      和 localStorage 同接口（或返回它的函数），交给 createStorageApi
 *   fetch        /ziwei/interpret（SSE）和 /ziwei/handoff 都走它
 *   now()        毫秒；"今天"、虚岁、记录时间都从它来
 *   engine/core  ZWEngine / ZWCore（排盘、命盘文字）
 *   setTimeout / clearTimeout   只用于提示自动消失和交接后的跳转重试；不给就不自动消失
 *   openSession(sessionId) → boolean   跳到新会话（外壳在 apply() 里提供；也可以之后用 configure 换）
 * getStore(deps?) 第一次调用时建默认实例（window.localStorage / window.fetch / window 的定时器），之后一直返回它。
 * 创建时做两件启动的事：清掉旧版的 API Key 残留；一次性导入 v5 的上次命盘和解读记录（spec §3.7）。
 *
 * ---------------- 状态（getState() 返回当前快照；每次变化换一个新对象，没变化不换） ----------------
 *   library   命盘库 [{ id, name, input, openedAt? }]（新→旧）
 *   prefs     { autoOpen, showAdj, sky, theme: 'dark' | 'light' | 'auto', model: { provider, model } | null（null = 跟随 DSH 默认） }
 *   models    { status: 'idle'|'loading'|'ready'|'error', providers: [{ id, name, models: [{ id, name }] }], def: { provider, model }|null, error }
 *   session   { view: 'home'|'chart', chartId, tab: 'natal'|'decadal'|'yearly'|'monthly'|'daily', stage: 'board'|'report',
 *               when: { y, m, d }, sel: 0–11, pat, pane: 'scope'|'pats'|'detail', panelOpen, focusId, introPlayed,
 *               onboarding（引导问答的状态，store 不解读）, quote: { label, text }|null,
 *               toast: { text, error, action: { label, run }|null, key }|null, handoff: null|'working'|'done',
 *               drafts: { [命盘 key]: 草稿 }, readPos: { [命盘 key]: 阅读位置 } }   —— 草稿和阅读位置只在内存里
 *   readings  { [命盘 key]: { thread, report, chatError, chatIssue, studioTab, name } }   第一次用到时从 storage 读
 *   jobs      { [命盘 key]: { kind: 'chat'|'report', thinkChars, retried } }   没有任务的 key 不出现；
 *             retried：Host 发现模型没有作答、正在同一个请求里再问一次（收到正文后变回 false）
 * 命盘 key = readingKeyOf(entry.input)。示例盘的 chartId 是 'sample'，不进命盘库。
 * subscribe(fn) → 退订函数。每次变化后同步调用 fn(state)；fn 里再改状态不会重入，排在这一轮之后再通知一轮。
 * 流式增量每秒来很多次：它只换 readings（和那张盘的 reading），jobs 在 kind / thinkChars 没变时还是同一个对象，
 * 所以只关心"有没有任务在跑"的订阅者不用跟着重画。
 * 提示（toast）的自动消失从有人订阅时才开始计时：面板被卸载期间任务写完，提示会留到回来的时候。
 *
 * ---------------- 读 ----------------
 *   currentEntry() / currentChart() / horoscope() / todayOf() / keyOf(entry) / entryById(id) / chartOf(entry)
 *   reading(key?) / job(key?) / draft(key?) / readPos(key?)      key 省略时是当前这张盘
 *   api   这个 store 用的存储 API（createStorageApi 的结果；生辰表单草稿等直接用它）
 * ---------------- 命盘库 ----------------
 *   addChart(input, name) → entry | null        renameChart(id, name) → entry | null
 *   updateChartInput(id, input) → entry | null  removeChart(id) → boolean（提示里可撤销）
 *   openSample(opts?) → boolean                 setPref('autoOpen'|'showAdj'|'sky', bool)；setPref('theme', 'dark'|'light'|'auto')
 *   clearLocalRecords() → boolean（有任务在跑时不清，返回 false）
 * ---------------- 导航（都不发请求） ----------------
 *   openChart(id, { tab, when, panel }?) → boolean   goHome()   setTab(tab)（'report' 等于 setStage('report')）
 *   setStage(stage)   selectPalace(i)   stepScope(dir)（到头时状态不变、给提示）   backToNow()
 *   setWhen({ y, m, d }, tab?) → boolean   时间条：直接跳到某一天（tab 给了就同时切页签）；排不出运限的日子不动
 *   setPane(pane)   setPat(i)   setPanel(open)   setQuote(q|null)（截到 600 字）   setDraft(text, key?)   setReadPos(pos, key?)
 *   patchSession(patch)   UI 自己的字段（onboarding、focusId、introPlayed …）；导航字段、toast、草稿不能从这里改
 *   showToast(text, { error, action, undo })   dismissToast()
 * ---------------- 生成任务（一张盘同一时间只有一个；忙的时候返回 false，不发请求） ----------------
 *   ask(question, { scope, quote }?) → boolean   空问题 = 速览（没有用户气泡）。scope: true 带上当前页签的定位
 *                                    （ZWUI.scopeRequest）；引用默认取 session.quote，按 v5 的格式拼进问题，发出后清掉
 *   continueChat() / retryChat() / clearThread()（可撤销）/ startReport() / continueReport() / regenerateReport()
 *   stop(key?)        用户停止：保留已写的部分，可接着写
 *   handoff({ mode }?) → Promise<boolean>   在新会话里继续（v5 的 /ziwei/handoff），成功后交给 openSession
 *   checkVersion() → Promise<{ ok, current, latest, updateAvailable, reason }>   点「检查更新」时请求一次 /ziwei/version
 *   setModel({ provider, model } | null) → boolean（变了才是 true）   loadModels() → Promise<state.models>（打开模型弹层时读）
 *                                    session.lastModel 是最近一次回答实际用的模型（来自 SSE 的 start 帧）
 *   configure({ openSession })
 *   flush()           pagehide 时调用：正在写的报告按"中断、可接着写"落盘，对话存下已有的部分；任务不停
 *   abortAll()        插件卸载时调用：静默中止全部任务，各自按中断落盘
 * 任务属于命盘 key，不属于屏幕：换盘、回首页、组件卸载都不停它；增量写进那张盘的 readings，结束时落盘一次
 * （流式过程中不写）。清空对话后没有报告时删掉这张盘的记录（v5 规则）。
 *
 * buildInterpretBody(state) → /ziwei/interpret 的请求体（纯函数，自检直接调）。state：
 *   { chart, input, now（毫秒）, core, engine, mode, question, history, tab, when, scope }
 *   scope 为 true 时按 tab / when 现算 scopeRequest，也可以直接给 scopeRequest 的结果。 */

const SAMPLE_ID = 'sample';
const STORE_QUOTE_MAX = 600;
const STORE_HISTORY_MAX = 20;
const STORE_TOAST_MS = { plain: 3200, undo: 6000, action: 8000 };
const STORE_HANDOFF_TRIES = 6;
const STORE_PANES = ['scope', 'pats', 'detail'];
const STORE_PROTECTED = ['view', 'chartId', 'tab', 'stage', 'when', 'sel', 'toast', 'handoff', 'drafts', 'readPos', 'lastModel'];

function storeYmd(ms) {
  const dt = new Date(ms);
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

function storeValidWhen(w) {
  return !!w && [w.y, w.m, w.d].every(function (n) { return typeof n === 'number' && Math.floor(n) === n; }) &&
    w.m >= 1 && w.m <= 12 && w.d >= 1 && w.d <= 31;
}

/* 阅读位置是数字或一层的小对象（{ part, offset }）；一样就不用通知 */
function storeSamePos(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(function (k) { return a[k] === b[k]; });
}

function storeWithKey(map, key, value) {
  const next = Object.assign({}, map);
  if (value === undefined) delete next[key]; else next[key] = value;
  return next;
}

/* 库条目的 input → 引擎的入参（和 v5 computeFrom 一样；口径缺项按默认值补，和命盘 key 的归一化一致） */
function storeEngineInput(input) {
  const x = readingInput(input);
  return {
    calendar: x.calendar, year: x.year, month: x.month, day: x.day, isLeapMonth: x.isLeap,
    hour: x.hour, minute: x.minute, gender: x.gender,
    longitude: x.longitude === '' ? undefined : +x.longitude,
    settings: Object.assign({}, DEFAULT_FORM.settings, x.settings)
  };
}

/* v5 nowPosition：currentYear 是公历年，currentAge = 公历年 − 农历出生年 + 1 */
function interpretPosition(chart, input, nowMs) {
  const cy = new Date(nowMs).getFullYear();
  const birthYear = chart && chart.lunar && chart.lunar.year ? chart.lunar.year : (+(input && input.year) || 0);
  return { currentYear: cy, currentAge: birthYear ? (cy - birthYear + 1) : 0 };
}

/* v5 chartContextText：ZWCore.fullChartText，拿不到时退回引擎的命盘文字 */
function chartContextText(chart, pos, core, engine) {
  if (!chart) return '';
  try {
    if (core && typeof core.fullChartText === 'function') return core.fullChartText(chart, pos);
  } catch (e) { /* 退回原生文本 */ }
  try { return (engine || E).chartText(chart); } catch (e) { return ''; }
}

function scopeRequestFor(chart, tab, when) {
  if (!chart || tab === 'natal' || SCOPE_TABS.indexOf(tab) < 0 || !storeValidWhen(when)) return null;
  const h = ZWUI.horoscopeAt(chart, when);
  return h ? ZWUI.scopeRequest(chart, h, tab, when) : null;
}

function buildInterpretBody(state) {
  const s = state || {};
  const chart = s.chart || null;
  const input = readingInput(s.input || {});
  const nowMs = typeof s.now === 'function' ? s.now() : (typeof s.now === 'number' ? s.now : Date.now());
  const pos = interpretPosition(chart, input, nowMs);
  let chartText = chartContextText(chart, pos, s.core, s.engine);
  let question = String(s.question == null ? '' : s.question);
  const req = s.scope && typeof s.scope === 'object' ? s.scope : (s.scope ? scopeRequestFor(chart, s.tab, s.when) : null);
  let decadalFocus = null, yearlyFocus = null;
  if (req && req.meta) {
    if (Array.isArray(req.meta.decadalFocus)) decadalFocus = req.meta.decadalFocus.slice();
    if (req.meta.yearlyFocus) yearlyFocus = req.meta.yearlyFocus;
  }
  if (req && req.contextBlock) {
    chartText += '\n\n' + req.contextBlock;
    question = req.focusLine + (question ? '\n' + question : '');
  }
  const body = {
    chartText: chartText,
    mode: s.mode === 'report' ? 'report' : 'brief',
    question: question,
    history: (Array.isArray(s.history) ? s.history : []).slice(-STORE_HISTORY_MAX).map(function (m) {
      return { role: m && m.role === 'user' ? 'user' : 'assistant', content: String((m && m.content) || '') };
    }),
    meta: {
      name: input.name, place: input.place, occupation: input.occupation, gender: input.gender,
      currentAge: pos.currentAge, currentYear: pos.currentYear,
      decadalFocus: decadalFocus, yearlyFocus: yearlyFocus
    }
  };
  /* 用户选了模型才带这个字段；不带时 Host 用 DSH 的默认模型（旧 Host 不认识这个字段，会忽略） */
  const model = modelPrefOf(s.model);
  if (model) body.model = model;
  return body;
}

function storeLastAnswer(thread) {
  for (let i = thread.length - 1; i >= 0; i--) if (thread[i].role === 'assistant') return thread[i].content || '';
  return '';
}

function createStore(deps) {
  const d = deps || {};
  const now = typeof d.now === 'function' ? d.now : function () { return Date.now(); };
  const engine = d.engine || E;
  const core = d.core || null;
  const fetchFn = typeof d.fetch === 'function' ? d.fetch : function () { return Promise.reject(new Error(t('aiFailed'))); };
  const later = typeof d.setTimeout === 'function' ? d.setTimeout : null;
  const cancelLater = typeof d.clearTimeout === 'function' ? d.clearTimeout : function () {};
  let openSessionFn = typeof d.openSession === 'function' ? d.openSession : null;
  const api = createStorageApi(d.storage === undefined ? null : d.storage, { now: now });

  api.cleanupLegacy();
  try { api.importV5Once(); } catch (e) { /* 导入失败不影响启动，下次再试 */ }

  const todayOf = function () { return storeYmd(now()); };
  const charts = {};          /* 命盘 key → 排盘结果（或 { error: true }） */
  const running = {};         /* 命盘 key → 进行中的任务 { kind, entry, handle, userStop, unload, snapshot } */
  const lastAsk = {};         /* 命盘 key → 最近一次提问 { baseLen, shown, question, scope }，给重试和续写用 */
  const timers = [];
  let toastTimer = null;
  let toastWaiting = null;    /* 没人订阅（面板被卸载）时排的提示 { toast, ms }：等有人订阅了再开始计时 */
  let toastSeq = 0;
  let sampleMemo = null;
  let horoMemo = { k: '', h: null };
  const BLANK = { thread: [], report: emptyReport(), chatError: '', chatIssue: null, studioTab: 'chat', name: '' };

  function startupFocus() {
    const last = api.lastChart.load();
    const hit = last ? api.library.findByKey(readingKeyOf(last)) : null;
    if (hit) return hit.id;
    const recent = api.library.recent(1);
    return recent.length ? recent[0].id : null;
  }

  let state = {
    library: api.library.list(),
    prefs: { autoOpen: api.prefs.autoOpen(), showAdj: api.prefs.showAdj(), sky: api.prefs.sky(), theme: api.prefs.theme(), model: api.prefs.model() },
    models: { status: 'idle', providers: [], def: null, error: '' },
    session: {
      view: 'home', chartId: null, tab: 'natal', stage: 'board', when: todayOf(), sel: 0, pat: 0, pane: 'scope',
      panelOpen: false, focusId: startupFocus(), introPlayed: false, onboarding: null, quote: null, toast: null,
      handoff: null, drafts: {}, readPos: {}, lastModel: null
    },
    readings: {},
    jobs: {}
  };

  /* ---------------- 订阅 ---------------- */
  const listeners = [];
  let notifying = false;
  let dirty = false;
  function emit() {
    dirty = true;
    if (notifying) return;
    notifying = true;
    try {
      while (dirty) {
        dirty = false;
        const list = listeners.slice();
        for (let i = 0; i < list.length; i++) {
          if (listeners.indexOf(list[i]) < 0) continue;
          try { list[i](state); } catch (e) { /* 一个订阅者出错不影响任务和其他订阅者 */ }
        }
      }
    } finally {
      notifying = false;
    }
  }
  function commit(next) {
    if (next === state) return;
    state = next;
    emit();
  }
  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    if (toastWaiting) {
      const w = toastWaiting;
      toastWaiting = null;
      if (state.session.toast === w.toast) armToast(w.toast, w.ms);
    }
    return function () {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }
  function patchSessionRaw(patch) {
    const cur = state.session;
    const changed = Object.keys(patch).some(function (k) { return cur[k] !== patch[k]; });
    if (!changed) return false;
    commit(Object.assign({}, state, { session: Object.assign({}, cur, patch) }));
    return true;
  }

  /* ---------------- 命盘 ---------------- */
  function sampleEntry() {
    const name = t('sampleChart');
    if (!sampleMemo || sampleMemo.name !== name) {
      sampleMemo = { id: SAMPLE_ID, name: name, input: libraryInput(DEFAULT_FORM), sample: true };
    }
    return sampleMemo;
  }
  function entryById(id) {
    if (id === SAMPLE_ID) return sampleEntry();
    const list = state.library;
    for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function keyOf(entry) {
    return entry && entry.input ? readingKeyOf(entry.input) : '';
  }
  function currentEntry() {
    return state.session.chartId ? entryById(state.session.chartId) : null;
  }
  function currentKey() {
    return keyOf(currentEntry());
  }
  function entryByKey(key) {
    const cur = currentEntry();
    if (cur && keyOf(cur) === key) return cur;
    const list = state.library;
    for (let i = 0; i < list.length; i++) if (list[i] && keyOf(list[i]) === key) return list[i];
    return keyOf(sampleEntry()) === key ? sampleEntry() : null;
  }
  function chartOf(entry) {
    const key = keyOf(entry);
    if (!key) return null;
    if (!charts[key]) {
      let c = null;
      try { c = engine.computeChart(storeEngineInput(entry.input)); } catch (e) { c = null; }
      charts[key] = c && !c.error ? c : { error: true };
    }
    return charts[key].error ? null : charts[key];
  }
  function horoscopeFor(entry, when) {
    const chart = chartOf(entry);
    if (!chart || !storeValidWhen(when)) return null;
    const k = keyOf(entry) + '@' + when.y + '-' + when.m + '-' + when.d;
    if (horoMemo.k !== k) horoMemo = { k: k, h: ZWUI.horoscopeAt(chart, when) };
    return horoMemo.h;
  }
  function selFor(chart, tab, h) {
    if (tab !== 'natal' && h && h[tab]) return h[tab].index;
    return chart.soulIndex;
  }

  /* ---------------- 解读数据 ---------------- */
  function loadReading(key) {
    const rec = api.readings.load(key);
    if (!rec) return Object.assign({}, BLANK, { report: emptyReport() });
    return { thread: rec.thread, report: rec.report, chatError: '', chatIssue: null, studioTab: rec.studioTab, name: rec.name };
  }
  /* 第一次用到时从 storage 读进快照（不通知：内容和读之前看到的一样） */
  function readingRaw(key) {
    if (!key) return BLANK;
    if (state.readings[key]) return state.readings[key];
    const r = loadReading(key);
    state = Object.assign({}, state, { readings: storeWithKey(state.readings, key, r) });
    return r;
  }
  /* 一次提交里改一张盘的 reading 和 job；job 为 undefined 不动，null 删掉 */
  function updateKey(key, readingPatch, job) {
    const base = readingPatch ? readingRaw(key) : null;
    let readings = state.readings, jobs = state.jobs;
    if (readingPatch) readings = storeWithKey(readings, key, Object.assign({}, base, readingPatch));
    if (job !== undefined) {
      /* kind / thinkChars / retried 没变就留着原来的 job 对象（每个 delta 都会走到这里） */
      const prev = jobs[key] || null;
      const next = job ? { kind: job.kind, thinkChars: job.thinkChars || 0, retried: !!job.retried } : null;
      const same = next ? (!!prev && prev.kind === next.kind && prev.thinkChars === next.thinkChars && prev.retried === next.retried) : !prev;
      if (!same) jobs = storeWithKey(jobs, key, next || undefined);
    }
    if (readings === state.readings && jobs === state.jobs) return;
    commit(Object.assign({}, state, { readings: readings, jobs: jobs }));
  }
  function setThink(key, chars) {
    const j = state.jobs[key];
    if (j && j.thinkChars !== chars) updateKey(key, null, { kind: j.kind, thinkChars: chars, retried: j.retried });
  }
  /* Host 发现模型没有作答、正在同一个请求里再问一次：对话区把「正在思考」换成「正在再问一次」 */
  function markRetry(key) {
    const j = state.jobs[key];
    if (j && !j.retried) updateKey(key, null, { kind: j.kind, thinkChars: j.thinkChars, retried: true });
  }
  /* start 帧里是这次回答实际用的模型 */
  function noteModel(info) {
    const m = modelPrefOf(info);
    if (m && !sameModel(m, state.session.lastModel)) patchSessionRaw({ lastModel: m });
  }
  /* 落盘（v5 规则）：没有一条有字的回答、也没有报告正文 → 删掉这张盘的记录；否则整条写入 */
  function persist(key, entry, override) {
    const r = readingRaw(key);
    const report = override && override.report ? override.report : r.report;
    const hasAnswer = r.thread.some(function (m) { return m.role === 'assistant' && String(m.content || '').trim(); });
    if (!hasAnswer && !String((report && report.text) || '').trim()) {
      api.readings.clear(key);
      return;
    }
    api.readings.save(key, {
      thread: r.thread, report: report, studioTab: r.studioTab,
      name: String((entry && entry.input && entry.input.name) || r.name || '')
    });
  }
  function interruptedReport(rep) {
    const text = String((rep && rep.text) || '');
    return Object.assign({}, rep, {
      status: 'error', error: t('storeInterrupted'), finishedAt: now(),
      issue: { kind: 'interrupted', canContinue: !!text.trim() }
    });
  }

  /* ---------------- 提示 ---------------- */
  function armToast(toast, ms) {
    toastTimer = later(function () {
      toastTimer = null;
      const cur = state.session.toast;
      if (cur && cur.key === toast.key) patchSessionRaw({ toast: null });
    }, ms);
  }
  function showToastRaw(text, opts) {
    const o = opts || {};
    const action = o.action || (o.undo ? { label: t('undo'), run: o.undo } : null);
    const toast = { text: String(text || ''), error: !!o.error, action: action, key: ++toastSeq };
    if (toastTimer !== null) { cancelLater(toastTimer); toastTimer = null; }
    toastWaiting = null;
    patchSessionRaw({ toast: toast });
    if (later) {
      const ms = o.action ? STORE_TOAST_MS.action : (o.undo ? STORE_TOAST_MS.undo : STORE_TOAST_MS.plain);
      /* 没人订阅 = 面板被卸载，没人看得到：先留着，回到面板再开始计时 */
      if (listeners.length) armToast(toast, ms);
      else toastWaiting = { toast: toast, ms: ms };
    }
    return toast;
  }
  function dismissToast() {
    if (toastTimer !== null) { cancelLater(toastTimer); toastTimer = null; }
    toastWaiting = null;
    patchSessionRaw({ toast: null });
  }
  /* 任务在用户看不到的地方结束时，排一条带"查看"的提示（v5 announceInBackground） */
  function announce(key, kind, err) {
    const s = state.session;
    const here = s.view === 'chart' && currentKey() === key;
    if (here && (kind === 'chat' ? s.panelOpen : s.stage === 'report')) return;
    const text = kind === 'chat' ? (err || t('aiAnswerReady')) : (err ? t('reportErrorToast', { reason: err }) : t('reportReadyToast'));
    const entry = entryByKey(key);
    showToastRaw(text, {
      error: !!err,
      action: entry ? { label: t('view'), run: function () { viewJob(entry.id, kind); } } : null
    });
  }
  function viewJob(id, kind) {
    dismissToast();
    if (!(state.session.view === 'chart' && state.session.chartId === id) && !openChart(id)) return;
    if (kind === 'chat') patchSessionRaw({ panelOpen: true });
    else patchSessionRaw({ stage: 'report' });
  }

  /* ---------------- 命盘库 ---------------- */
  function setLibrary(list, sessionPatch) {
    commit(Object.assign({}, state, {
      library: list,
      session: sessionPatch ? Object.assign({}, state.session, sessionPatch) : state.session
    }));
  }
  function addChart(input, name) {
    const r = api.library.add(input, name);
    if (!r) return null;
    setLibrary(r.list);
    return r.entry;
  }
  function renameChart(id, name) {
    const r = api.library.rename(id, name);
    if (!r) return null;
    setLibrary(r.list);
    return r.entry;
  }
  function updateChartInput(id, input) {
    const r = api.library.updateInput(id, input);
    if (!r) return null;
    const s = state.session;
    if (s.chartId === id) {
      const chart = chartOf(r.entry);
      const h = horoscopeFor(r.entry, s.when);
      readingRaw(keyOf(r.entry));
      api.lastChart.save(r.entry.input);
      setLibrary(r.list, chart ? { sel: selFor(chart, s.tab, h), quote: null } : null);
    } else {
      setLibrary(r.list);
    }
    return r.entry;
  }
  function removeChart(id) {
    const removed = api.library.remove(id);
    if (!removed) return false;
    const s = state.session;
    const wasFocus = s.focusId === id;
    const patch = {};
    if (s.chartId === id) { patch.view = 'home'; patch.chartId = null; patch.panelOpen = false; patch.quote = null; }
    if (wasFocus) {
      const recent = api.library.recent(1);
      patch.focusId = recent.length ? recent[0].id : null;
    }
    setLibrary(removed.list, patch);
    showToastRaw(t('libDeleted'), {
      undo: function () {
        const u = api.library.undo(removed);
        if (!u) return;
        setLibrary(u.list, wasFocus ? { focusId: id } : null);
        showToastRaw(t('undoDone'));
      }
    });
    return true;
  }
  function setPref(name, value) {
    const setters = { autoOpen: api.prefs.setAutoOpen, showAdj: api.prefs.setShowAdj, sky: api.prefs.setSky, theme: api.prefs.setTheme };
    if (!setters[name]) return false;
    /* 外观是三选一的字符串，其余是开关 */
    const v = name === 'theme' ? themePrefOf(value) : !!value;
    setters[name](v);
    if (state.prefs[name] !== v) commit(Object.assign({}, state, { prefs: Object.assign({}, state.prefs, storeWithKey({}, name, v)) }));
    return true;
  }
  function clearLocalRecords() {
    if (Object.keys(running).length) return false;
    api.clearLocalRecords();
    Object.keys(lastAsk).forEach(function (k) { delete lastAsk[k]; });
    commit(Object.assign({}, state, { readings: {} }));
    return true;
  }

  /* ---------------- 导航 ---------------- */
  function openChart(id, opts) {
    const o = opts || {};
    const entry = entryById(id);
    const chart = entry ? chartOf(entry) : null;
    if (!chart) return false;
    const today = todayOf();
    let when = storeValidWhen(o.when) ? { y: o.when.y, m: o.when.m, d: o.when.d } : today;
    let tab = SCOPE_TABS.indexOf(o.tab) >= 0 ? o.tab : 'natal';
    let h = horoscopeFor(entry, when);
    if (!h && when !== today) { when = today; h = horoscopeFor(entry, when); }
    if (!h) tab = 'natal';
    readingRaw(keyOf(entry));
    let library = state.library;
    if (!entry.sample) {
      api.lastChart.save(entry.input);
      const touched = api.library.touch(entry.id);
      if (touched) library = touched.list;
    }
    const cur = state.session;
    const patch = {
      view: 'chart', chartId: entry.id, tab: tab, stage: 'board', when: when, sel: selFor(chart, tab, h),
      pat: 0, pane: 'scope', focusId: entry.sample ? cur.focusId : entry.id, quote: null,
      /* 引导问答做到一半去看了命盘库里的盘：引导到此为止，回首页时看到的是平时的首页。
         看示例盘不算（空库时引导本来就常在，回来接着答） */
      onboarding: entry.sample ? cur.onboarding : null,
      /* 换盘时带动作的提示（撤销、查看）作废，和 v5 一样 */
      toast: cur.toast && cur.toast.action ? null : cur.toast
    };
    if (o.panel !== undefined) patch.panelOpen = !!o.panel;
    commit(Object.assign({}, state, { library: library, session: Object.assign({}, cur, patch) }));
    return true;
  }
  function openSample(opts) {
    return openChart(SAMPLE_ID, opts);
  }
  function goHome() {
    return patchSessionRaw({ view: 'home', panelOpen: false });
  }
  function setStage(stage) {
    if (stage !== 'board' && stage !== 'report') return false;
    return patchSessionRaw({ stage: stage });
  }
  function setTab(tab) {
    if (tab === 'report') return setStage('report');
    if (SCOPE_TABS.indexOf(tab) < 0) return false;
    const cur = state.session;
    const patch = {};
    if (cur.stage !== 'board') patch.stage = 'board';
    if (cur.tab !== tab) {
      patch.tab = tab;
      patch.pane = 'scope';
      if (tab !== 'natal') {
        const entry = currentEntry();
        const h = entry ? horoscopeFor(entry, cur.when) : null;
        if (h && h[tab]) patch.sel = h[tab].index;
      }
    }
    return patchSessionRaw(patch);
  }
  function selectPalace(i) {
    const n = +i;
    if (!(n >= 0 && n < 12) || Math.floor(n) !== n) return false;
    return patchSessionRaw({ sel: n, pane: 'detail' });
  }
  function stepScopeAction(dir) {
    const cur = state.session;
    const entry = currentEntry();
    const chart = entry ? chartOf(entry) : null;
    if (!chart || cur.tab === 'natal' || !dir) return false;
    const next = ZWUI.stepScope(chart, cur.tab, cur.when, dir);
    if (!next) {
      showToastRaw(t(dir < 0 ? 'stepEdgeBack' : 'stepEdgeForward'));
      return false;
    }
    const h = horoscopeFor(entry, next);
    return patchSessionRaw({ when: next, sel: h && h[cur.tab] ? h[cur.tab].index : cur.sel });
  }
  function backToNow() {
    const cur = state.session;
    const entry = currentEntry();
    const chart = entry ? chartOf(entry) : null;
    if (!chart) return false;
    const today = todayOf();
    const h = horoscopeFor(entry, today);
    const patch = { when: today };
    if (cur.tab !== 'natal' && h && h[cur.tab]) patch.sel = h[cur.tab].index;
    return patchSessionRaw(patch);
  }
  /* 时间条：直接跳到某一天。tab 给了就同时切到那个页签（本命卡的「此刻」四行）。
     排不出运限的日子（出生以前、超出范围）不动，返回 false。选中宫跟到这一层的运限命宫，和前后翻一样 */
  function setWhen(when, tab) {
    const cur = state.session;
    const entry = currentEntry();
    const nextTab = tab === undefined ? cur.tab : tab;
    if (!entry || nextTab === 'natal' || SCOPE_TABS.indexOf(nextTab) < 0 || !storeValidWhen(when)) return false;
    const same = cur.when.y === when.y && cur.when.m === when.m && cur.when.d === when.d;
    const w = same ? cur.when : { y: when.y, m: when.m, d: when.d };
    const h = horoscopeFor(entry, w);
    if (!h || !h[nextTab]) return false;
    const patch = { when: w, sel: h[nextTab].index };
    if (cur.tab !== nextTab) { patch.tab = nextTab; patch.pane = 'scope'; }
    if (cur.stage !== 'board') patch.stage = 'board';
    return patchSessionRaw(patch);
  }
  function setPane(pane) {
    if (STORE_PANES.indexOf(pane) < 0) return false;
    return patchSessionRaw({ pane: pane });
  }
  function setPat(i) {
    const n = +i;
    if (!(n >= 0) || Math.floor(n) !== n) return false;
    return patchSessionRaw({ pat: n });
  }
  function setPanel(open) {
    return patchSessionRaw({ panelOpen: !!open });
  }
  function setQuote(q) {
    if (!q) return patchSessionRaw({ quote: null });
    return patchSessionRaw({
      quote: { label: String(q.label || ''), text: Array.from(String(q.text || '')).slice(0, STORE_QUOTE_MAX).join('') }
    });
  }
  function setDraft(text, key) {
    const k = key || currentKey();
    if (!k) return false;
    const v = String(text == null ? '' : text);
    const drafts = state.session.drafts;
    if ((drafts[k] || '') === v) return false;
    return patchSessionRaw({ drafts: storeWithKey(drafts, k, v || undefined) });
  }
  function setReadPos(pos, key) {
    const k = key || currentKey();
    if (!k) return false;
    const cur = state.session.readPos[k];
    if (pos == null ? cur === undefined : storeSamePos(cur, pos)) return false;
    return patchSessionRaw({ readPos: storeWithKey(state.session.readPos, k, pos == null ? undefined : pos) });
  }
  function patchSession(patch) {
    const p = {};
    Object.keys(patch || {}).forEach(function (k) { if (STORE_PROTECTED.indexOf(k) < 0) p[k] = patch[k]; });
    return patchSessionRaw(p);
  }

  /* ---------------- 对话 ---------------- */
  /* o：{ question（发给模型的问题，不含定位）, shown（用户气泡，空 = 不加）, scope, cont, baseThread }
     cont：续写，本轮接在上一条回答后面；baseThread：重试时去掉失败那一轮之后的对话。 */
  function runChat(entry, o) {
    const key = keyOf(entry);
    const chart = chartOf(entry);
    if (!key || !chart || running[key]) return false;
    const r = readingRaw(key);
    const baseThread = o.baseThread || r.thread;
    const lastMsg = baseThread[baseThread.length - 1];
    const contBase = o.cont && lastMsg && lastMsg.role === 'assistant' ? String(lastMsg.content || '') : '';
    const thread = baseThread.concat(o.shown && !o.cont ? [{ role: 'user', content: o.shown }] : []);
    if (!o.cont) lastAsk[key] = { baseLen: baseThread.length, shown: o.shown, question: o.question, scope: o.scope || null };
    const body = buildInterpretBody({
      chart: chart, input: entry.input, now: now(), core: core, engine: engine,
      mode: 'brief', question: o.question, history: baseThread, scope: o.scope || null, model: state.prefs.model
    });
    const job = { kind: 'chat', entry: entry, handle: null, userStop: false, unload: false };
    running[key] = job;
    updateKey(key, { thread: thread, chatError: '', chatIssue: null, studioTab: 'chat' }, { kind: 'chat', thinkChars: 0 });
    let added = !!contBase;
    job.handle = openInterpretStream({
      fetch: fetchFn,
      body: body,
      onStart: function (info) { setThink(key, 0); noteModel(info); },
      onRetry: function () { markRetry(key); },
      onThinking: function (chars) { setThink(key, chars); },
      onDelta: function (text) {
        const cur = readingRaw(key);
        updateKey(key, { thread: applyAssistantText(cur.thread, text, added ? 'append' : 'new') }, { kind: 'chat', thinkChars: 0 });
        added = true;
      },
      onDone: function (text) {
        if (!text) return;
        const cur = readingRaw(key);
        const full = contBase ? mergeReportText({ cont: true, base: contBase, done: text }) : text;
        updateKey(key, { thread: applyAssistantText(cur.thread, full, added ? 'replace' : 'new') });
        added = true;
      },
      onFinish: function (err, issue) {
        if (running[key] !== job) return;
        delete running[key];
        updateKey(key, { chatError: err || '', chatIssue: issue || null }, null);
        persist(key, job.entry);
        if (!job.userStop && !job.unload) announce(key, 'chat', err);
      }
    });
    return true;
  }
  function ask(question, opts) {
    const o = opts || {};
    const entry = currentEntry();
    if (!entry || running[keyOf(entry)] || !chartOf(entry)) return false;
    const typed = String(question == null ? '' : question).trim();
    const q = o.quote !== undefined ? o.quote : state.session.quote;
    /* 引用按 v5 的格式拼进问题（也是对话里显示的那句）；时间卡的定位只发给模型，不进气泡 */
    const shown = q && (q.label || q.text)
      ? '【引用：' + String(q.label || '') + '】\n' + String(q.text || '') + '\n\n' + (typed || t('quoteAskDefault'))
      : typed;
    const scope = o.scope ? scopeRequestFor(chartOf(entry), state.session.tab, state.session.when) : null;
    const ok = runChat(entry, { question: shown, shown: shown, scope: scope });
    if (ok && state.session.quote) patchSessionRaw({ quote: null });
    return ok;
  }
  function continueChat() {
    const entry = currentEntry();
    const key = keyOf(entry);
    if (!entry || running[key]) return false;
    const la = lastAsk[key];
    return runChat(entry, { question: t('aiContinuePrompt'), shown: '', cont: true, scope: la ? la.scope : null });
  }
  /* 重试：去掉失败的那一轮（最后一次提问和它后面的半截回答），用同一个问题再问一次（v5 retryChat）。
     记得这一轮是怎么问的（含时间卡定位、速览）就原样重发；记不得（比如重开过面板）按 v5 找最后一条用户提问。 */
  function retryChat() {
    const entry = currentEntry();
    const key = keyOf(entry);
    if (!entry || running[key]) return false;
    const thread = readingRaw(key).thread;
    const la = lastAsk[key];
    if (la && la.baseLen <= thread.length) {
      const rest = thread.slice(la.baseLen);
      const head = la.shown ? rest[0] : null;
      const tail = la.shown ? rest.slice(1) : rest;
      const matches = (!la.shown || (head && head.role === 'user' && head.content === la.shown)) &&
        tail.every(function (m) { return m.role === 'assistant'; });
      if (matches) return runChat(entry, { question: la.question, shown: la.shown, scope: la.scope, baseThread: thread.slice(0, la.baseLen) });
    }
    let idx = -1;
    for (let i = thread.length - 1; i >= 0; i--) { if (thread[i].role === 'user') { idx = i; break; } }
    if (idx < 0) return runChat(entry, { question: '', shown: '', baseThread: [] });
    return runChat(entry, { question: thread[idx].content, shown: thread[idx].content, baseThread: thread.slice(0, idx) });
  }
  function clearThread() {
    const entry = currentEntry();
    const key = keyOf(entry);
    if (!entry || running[key]) return false;
    const prev = readingRaw(key).thread;
    if (!prev.length) return false;
    delete lastAsk[key];
    updateKey(key, { thread: [], chatError: '', chatIssue: null });
    if (state.session.quote) patchSessionRaw({ quote: null });
    persist(key, entry);
    showToastRaw(t('aiThreadCleared'), {
      undo: function () {
        /* 撤销只回到被清空的那张盘；已经换盘、又开始了新对话或正在生成，都不动 */
        if (currentKey() !== key || running[key] || readingRaw(key).thread.length) return;
        updateKey(key, { thread: prev });
        persist(key, entry);
        showToastRaw(t('undoDone'));
      }
    });
    return true;
  }

  /* ---------------- 报告 ---------------- */
  function runReport(entry, cont) {
    const key = keyOf(entry);
    const chart = chartOf(entry);
    if (!key || !chart || running[key]) return false;
    const r = readingRaw(key);
    const report = r.report || emptyReport();
    const base = cont ? String(report.text || '') : '';
    /* 重新写时留一份旧报告：新报告一个字都没写出来就失败 / 被停，恢复它 */
    const snapshot = !cont && String(report.text || '').trim() ? report : null;
    const body = buildInterpretBody({
      chart: chart, input: entry.input, now: now(), core: core, engine: engine, mode: 'report',
      question: cont ? t('aiContinuePrompt') : '',
      history: cont && base ? [{ role: 'assistant', content: base }] : r.thread.slice(),
      model: state.prefs.model
    });
    const job = { kind: 'report', entry: entry, handle: null, userStop: false, unload: false, snapshot: snapshot };
    running[key] = job;
    updateKey(key, {
      report: { status: 'running', text: base, startedAt: now(), finishedAt: 0, error: '', issue: null },
      studioTab: 'report'
    }, { kind: 'report', thinkChars: 0 });
    job.handle = openInterpretStream({
      fetch: fetchFn,
      body: body,
      onStart: function (info) { setThink(key, 0); noteModel(info); },
      onRetry: function () { markRetry(key); },
      onThinking: function (chars) { setThink(key, chars); },
      onDelta: function (text) {
        const cur = readingRaw(key).report;
        updateKey(key, { report: Object.assign({}, cur, { text: String(cur.text || '') + text }) }, { kind: 'report', thinkChars: 0 });
      },
      onDone: function (text) {
        const cur = readingRaw(key).report;
        const full = mergeReportText({ cont: cont, base: base, accumulated: cur.text, done: text });
        updateKey(key, { report: Object.assign({}, cur, { status: 'done', text: full, finishedAt: now(), error: '', issue: null }) });
      },
      onFinish: function (err, issue, produced) {
        if (running[key] !== job) return;
        delete running[key];
        let e = err, iss = issue;
        if (job.unload) {
          e = t('storeInterrupted');
          iss = { kind: 'interrupted', canContinue: !!String(readingRaw(key).report.text || '').trim() };
        }
        if (snapshot && e && !String(produced || '').trim()) {
          updateKey(key, { report: snapshot }, null);
          persist(key, job.entry);
          if (!job.unload) showToastRaw(t('reportRestored'), { error: true });
          return;
        }
        const cur = readingRaw(key).report;
        const next = cur.status === 'done' ? cur
          : Object.assign({}, cur, { status: 'error', error: e || '', issue: iss || null, finishedAt: now() });
        updateKey(key, { report: next }, null);
        persist(key, job.entry);
        if (!job.userStop && !job.unload) announce(key, 'report', next.status === 'done' ? '' : e);
      }
    });
    return true;
  }
  function startReport() {
    const entry = currentEntry();
    return entry ? runReport(entry, false) : false;
  }
  function continueReport() {
    const entry = currentEntry();
    return entry ? runReport(entry, true) : false;
  }
  function stop(key) {
    const k = key || currentKey();
    const job = running[k];
    if (!job || !job.handle) return false;
    job.userStop = true;
    job.handle.abort(true);
    return true;
  }

  /* ---------------- 在新会话里继续（v5 handoffToSession） ---------------- */
  function openWithRetry(sessionId) {
    let tries = 0;
    const go = function () {
      tries += 1;
      let opened = false;
      try { opened = !!(openSessionFn && openSessionFn(sessionId)); } catch (e) { opened = false; }
      if (opened) return;
      if (tries < STORE_HANDOFF_TRIES && later) { timers.push(later(go, 350 * tries)); return; }
      showToastRaw(t('handoffNoNav'), { error: true });
    };
    go();
  }
  function handoff(opts) {
    const o = opts || {};
    const entry = currentEntry();
    const chart = entry ? chartOf(entry) : null;
    const key = keyOf(entry);
    if (!chart || running[key] || state.session.handoff === 'working') return Promise.resolve(false);
    const r = readingRaw(key);
    const hasReport = !!r.report && r.report.status === 'done' && !!r.report.text;
    const mode = o.mode === 'report' ? 'report' : 'brief';
    const input = readingInput(entry.input);
    let chartText = '';
    try { chartText = engine.chartText(chart); } catch (e) { chartText = ''; }
    const payload = {
      chartText: chartText,
      fullText: chartContextText(chart, interpretPosition(chart, input, now()), core, engine),
      name: input.name, place: input.place, occupation: input.occupation, gender: input.gender,
      interpretation: mode === 'report' && hasReport ? r.report.text : storeLastAnswer(r.thread),
      mode: mode
    };
    patchSessionRaw({ handoff: 'working' });
    showToastRaw(t('handoffWorking'));
    let p;
    try {
      p = Promise.resolve(fetchFn('/ziwei/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }));
    } catch (e) {
      p = Promise.reject(e);
    }
    return p.then(function (resp) {
      return resp.json().then(function (j) { return { status: resp.status, j: j }; }, function () { return { status: resp.status, j: {} }; });
    }).then(function (out) {
      const j = out.j || {};
      if (j.ok && j.sessionId) {
        patchSessionRaw({ handoff: 'done' });
        showToastRaw(t('handoffDone'));
        if (later) timers.push(later(function () { if (state.session.handoff === 'done') patchSessionRaw({ handoff: null }); }, 3000));
        openWithRetry(String(j.sessionId));
        return true;
      }
      patchSessionRaw({ handoff: null });
      showToastRaw(j.reason ? String(j.reason) : t('handoffFailedHttp', { status: out.status }), { error: true });
      return false;
    }, function (e) {
      patchSessionRaw({ handoff: null });
      showToastRaw(String((e && e.message) || e), { error: true });
      return false;
    });
  }
  /* 检查更新：只在调用时请求一次 /ziwei/version，不缓存、不重试。总是 resolve：
     { ok, current, latest, updateAvailable }，请求失败或返回的不是 JSON 时是 { ok: false, reason } */
  function checkVersion() {
    let p;
    try {
      p = Promise.resolve(fetchFn('/ziwei/version', { method: 'GET', headers: { accept: 'application/json' } }));
    } catch (e) {
      p = Promise.reject(e);
    }
    return p.then(function (resp) {
      /* 回来的不是 JSON（路由不在、网关的错误页）：报 HTTP 状态，不把解析错误甩给用户 */
      const http = { ok: false, reason: 'HTTP ' + resp.status };
      return resp.json().then(function (j) { return j && typeof j === 'object' ? j : http; }, function () { return http; });
    }, function (e) {
      return { ok: false, reason: String((e && e.message) || e) };
    });
  }
  /* ---------------- 模型选择 ----------------
     选择存在本机（prefs.model，null = 跟随 DSH 默认），每次提问带在请求体里。
     列表只在打开模型弹层时读（loadModels()，每次都重读）：打开面板、挂上模型按钮都不发请求——列模型可能要去问提供方。
     没读过列表、又没回答过时，按钮上只写「默认模型」；读过之后知道 DSH 的默认模型叫什么（models.def）。
     旧 Host 没有 /ziwei/models（要重启 DSH）：status 是 'error'，提问照常用 DSH 的默认模型。 */
  function setModel(sel) {
    const m = modelPrefOf(sel);
    api.prefs.setModel(m);
    if (sameModel(m, state.prefs.model)) return false;
    commit(Object.assign({}, state, { prefs: Object.assign({}, state.prefs, { model: m }) }));
    return true;
  }
  let modelsPending = null;
  function loadModels() {
    if (modelsPending) return modelsPending;
    commit(Object.assign({}, state, { models: Object.assign({}, state.models, { status: 'loading', error: '' }) }));
    let p;
    try {
      p = Promise.resolve(fetchFn('/ziwei/models', { method: 'GET', headers: { accept: 'application/json' } }));
    } catch (e) {
      p = Promise.reject(e);
    }
    const fail = function (reason) {
      commit(Object.assign({}, state, { models: { status: 'error', providers: [], def: null, error: String(reason || '') } }));
      return state.models;
    };
    modelsPending = p.then(function (resp) {
      const http = 'HTTP ' + resp.status;
      return resp.json().then(function (j) {
        if (!j || typeof j !== 'object' || !j.ok || !Array.isArray(j.providers)) return fail((j && j.reason) || http);
        const providers = j.providers.map(function (pv) {
          return {
            id: String((pv && pv.id) || ''), name: String((pv && (pv.name || pv.id)) || ''),
            models: (pv && Array.isArray(pv.models) ? pv.models : []).filter(function (x) { return x && x.id; })
              .map(function (x) { return { id: String(x.id), name: String(x.name || x.id) }; })
          };
        }).filter(function (pv) { return pv.id && pv.models.length; });
        commit(Object.assign({}, state, { models: { status: 'ready', providers: providers, def: modelPrefOf(j.default), error: '' } }));
        return state.models;
      }, function () { return fail(http); });
    }, function (e) {
      return fail(String((e && e.message) || e));
    }).then(function (v) { modelsPending = null; return v; }, function (e) { modelsPending = null; throw e; });
    return modelsPending;
  }
  function configure(patch) {
    const p = patch || {};
    if (typeof p.openSession === 'function') openSessionFn = p.openSession;
  }

  /* ---------------- 生命周期 ---------------- */
  function flush() {
    Object.keys(running).forEach(function (key) {
      const job = running[key];
      if (job.kind === 'report') {
        const rep = readingRaw(key).report;
        const keep = !String((rep && rep.text) || '').trim() && job.snapshot ? job.snapshot : interruptedReport(rep);
        persist(key, job.entry, { report: keep });
      } else {
        persist(key, job.entry);
      }
    });
  }
  function abortAll() {
    Object.keys(running).forEach(function (key) {
      const job = running[key];
      job.unload = true;
      try { if (job.handle) job.handle.abort(false); } catch (e) { /* ignore */ }
    });
    if (toastTimer !== null) { cancelLater(toastTimer); toastTimer = null; }
    toastWaiting = null;
    while (timers.length) cancelLater(timers.pop());
    /* 定时器都停了：还挂着的提示不会再自己消失，一并清掉 */
    if (state.session.toast) patchSessionRaw({ toast: null });
  }

  return {
    getState: function () { return state; },
    subscribe: subscribe,
    api: api,
    todayOf: todayOf,
    keyOf: keyOf,
    entryById: entryById,
    chartOf: chartOf,
    currentEntry: currentEntry,
    currentChart: function () { const e = currentEntry(); return e ? chartOf(e) : null; },
    horoscope: function () { const e = currentEntry(); return e ? horoscopeFor(e, state.session.when) : null; },
    reading: function (key) { return readingRaw(key || currentKey()); },
    job: function (key) { return state.jobs[key || currentKey()] || null; },
    draft: function (key) { return state.session.drafts[key || currentKey()] || ''; },
    readPos: function (key) { const v = state.session.readPos[key || currentKey()]; return v === undefined ? null : v; },
    addChart: addChart,
    renameChart: renameChart,
    updateChartInput: updateChartInput,
    removeChart: removeChart,
    openSample: openSample,
    setPref: setPref,
    clearLocalRecords: clearLocalRecords,
    openChart: openChart,
    goHome: goHome,
    setTab: setTab,
    setStage: setStage,
    selectPalace: selectPalace,
    stepScope: stepScopeAction,
    backToNow: backToNow,
    setWhen: setWhen,
    setPane: setPane,
    setPat: setPat,
    setPanel: setPanel,
    setQuote: setQuote,
    setDraft: setDraft,
    setReadPos: setReadPos,
    patchSession: patchSession,
    showToast: function (text, opts) { return showToastRaw(text, opts); },
    dismissToast: dismissToast,
    ask: ask,
    continueChat: continueChat,
    retryChat: retryChat,
    clearThread: clearThread,
    startReport: startReport,
    continueReport: continueReport,
    regenerateReport: startReport,
    stop: stop,
    handoff: handoff,
    checkVersion: checkVersion,
    setModel: setModel,
    loadModels: loadModels,
    configure: configure,
    flush: flush,
    abortAll: abortAll
  };
}

/* 默认实例：第一次调用时才建（这时才碰 window）。deps 只在第一次生效，之后用 configure 改 openSession。 */
let zwDefaultStore = null;
function getStore(deps) {
  if (zwDefaultStore) return zwDefaultStore;
  const base = {
    storage: browserLocalStorage, now: function () { return Date.now(); }, engine: E, core: null,
    fetch: null, setTimeout: null, clearTimeout: null, openSession: null
  };
  try {
    if (typeof window !== 'undefined') {
      if (window.ZWEngine) base.engine = window.ZWEngine;
      base.core = window.ZWCore || null;
      if (typeof window.fetch === 'function') base.fetch = function (url, init) { return window.fetch(url, init); };
      if (typeof window.setTimeout === 'function') {
        base.setTimeout = function (fn, ms) { return window.setTimeout(fn, ms); };
        base.clearTimeout = function (id) { window.clearTimeout(id); };
      }
    }
  } catch (e) { /* 拿不到就按缺省降级 */ }
  zwDefaultStore = createStore(Object.assign(base, deps || {}));
  return zwDefaultStore;
}

const ZWSTORE = {
  SAMPLE_ID: SAMPLE_ID,
  createStore: createStore,
  getStore: getStore,
  hasDefaultStore: function () { return !!zwDefaultStore; },
  buildInterpretBody: buildInterpretBody,
  openInterpretStream: openInterpretStream
};
