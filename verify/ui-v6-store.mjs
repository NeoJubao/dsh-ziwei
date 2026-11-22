/**
 * verify/ui-v6-store.mjs — SSE 客户端与 store（T3b）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。被测的是 window.ZWStore：
 *   openInterpretStream  SSE 解析和结束语义（v5 openStream）
 *   createStore          会话态、按命盘 key 的解读数据、后台任务、落盘
 *   buildInterpretBody   /ziwei/interpret 的请求体
 * 全部在 vm 里跑：内存版 storage、假 fetch（fakeFetch 一次给完；streamFetch 一块一块推）、固定时钟、手动定时器。
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）；第二张盘是同一生辰的女命（key 不同）。
 * "今天"固定为 2026-11-19。期望值都是字面量，或取自 verify/fixtures/horoscope-reference.json。
 */
import { loadBundle, makeCtx, memoryStorage, fakeFetch, streamFetch, settle } from './client-harness.mjs';

const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '',
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
const GOLDEN_F = Object.assign({}, GOLDEN, { gender: 'female' });
const KEY_A = 'solar|1992|5|3|0|9|30|male|105.97|normal,exact,current,1';
const KEY_B = 'solar|1992|5|3|0|9|30|female|105.97|normal,exact,current,1';
const KEY_SAMPLE = 'solar|1990|6|15|0|15|30|male||normal,exact,current,1';
const READINGS = 'ziwei-pro.readings.v2';
const TODAY = { y: 2026, m: 11, d: 19 };
/* 本机时区的 2026-11-19 10:00（todayOf 按本地日期取） */
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();

const ZH = {
  aiStopped: '已停止，内容可能不完整，可以接着写',
  aiStoppedEmpty: '已停止',
  aiDisconnected: '连接断了，内容可能不完整，可以接着写',
  aiDisconnectedEmpty: '连接断了，没收到内容，可以重试',
  aiContinuePrompt: '请接着上文继续写：从断处接着写，不要重复已写内容，也不要重新开头。',
  reportRestored: '重新生成没有写出内容，已保留原报告',
  libDeleted: '已删除命盘',
  undo: '撤销',
  undoDone: '已撤销',
  aiThreadCleared: '已清空对话',
  sampleChart: '示例盘',
  view: '查看',
  aiAnswerReady: '紫微师回答好了',
  reportReadyToast: '完整报告写好了',
  handoffDone: '已开新会话',
  handoffNoNav: '会话已创建，但界面没能自动跳过去。请在左侧会话列表里打开新会话继续。',
  handoffFailed500: '没能打开新会话（HTTP 500）',
  edgeBack: '再往前就到出生以前了',
  edgeForward: '再往后超出了这张盘能排的范围'
};

const J = (v) => JSON.stringify(v);
const clone = (x) => JSON.parse(JSON.stringify(x));

/** 手动定时器：记下 setTimeout，测试自己决定什么时候跑 */
function manualTimers() {
  let seq = 0;
  const pending = new Map();
  return {
    pending,
    setTimeout: (fn, ms) => { const id = ++seq; pending.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => { pending.delete(id); },
    runAll() { const list = [...pending.values()]; pending.clear(); list.forEach((x) => x.fn()); return list.length; },
    delays() { return [...pending.values()].map((x) => x.ms); }
  };
}

function readMap(storage) {
  try { return JSON.parse(storage.getItem(READINGS) || '{}'); } catch { return {}; }
}

export default async function store(t) {
  const { ok, section } = t;
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);

  section('v6 store：装载');
  const loaded = t.client ? loadBundle(t.client, { globals: { AbortController } }) : null;
  if (loaded && loaded.entry) {
    try { const plugin = loaded.materialize(); plugin.apply(makeCtx({}).ctx); } catch { /* 下面的断言会失败 */ }
  }
  const S = loaded && loaded.win.ZWStore;
  const E = loaded && loaded.win.ZWEngine;
  const C = loaded && loaded.win.ZWCore;
  ok('拿到 window.ZWStore、ZWEngine、ZWCore', !!S && !!E && !!C);
  if (!S || !E || !C) return;
  const API = ['createStore', 'getStore', 'buildInterpretBody', 'openInterpretStream'];
  const missing = API.filter((k) => typeof S[k] !== 'function');
  ok('ZWStore 有 createStore / getStore / buildInterpretBody / openInterpretStream', missing.length === 0, 'missing: ' + missing.join(', '));
  if (missing.length) return;
  ok('定义时没有创建默认 store（getStore 第一次调用才建）', typeof S.hasDefaultStore === 'function' && S.hasDefaultStore() === false);

  const chart = E.computeChart({ calendar: 'solar', year: 1992, month: 5, day: 3, hour: 9, minute: 30, gender: 'male', longitude: 105.97 });
  ok('黄金用例排盘成功（命宫在丑，soulIndex 11）', !chart.error && chart.soulIndex === 11);

  /* ================================================================ */
  section('v6 SSE 客户端：openInterpretStream');
  const record = () => {
    const log = { start: 0, thinking: [], deltas: [], done: [], finish: [] };
    return {
      log,
      cb: {
        onStart: () => { log.start++; },
        onThinking: (n) => { log.thinking.push(n); },
        onDelta: (s) => { log.deltas.push(s); },
        onDone: (s) => { log.done.push(s); },
        onFinish: (err, issue, produced) => { log.finish.push([err, issue, produced]); }
      }
    };
  };

  {
    const f = fakeFetch([{ sse: [['start', {}], ['thinking', { chars: 12 }], ['delta', { text: '甲' }], ['delta', { text: '乙' }], ['done', { text: '甲乙' }]] }]);
    const r = record();
    S.openInterpretStream(Object.assign({ fetch: f, body: { question: 'q', mode: 'brief' } }, r.cb));
    await settle();
    const c = f.calls[0] || {};
    eq('请求：POST /ziwei/interpret，JSON 正文原样', [c.url, c.init && c.init.method, c.init && c.init.headers && c.init.headers['Content-Type'], c.body],
      ['/ziwei/interpret', 'POST', 'application/json', { question: 'q', mode: 'brief' }]);
    eq('delta、delta、done → 依次回调，干净结束（onFinish 一次，无错误）', [r.log.start, r.log.thinking, r.log.deltas, r.log.done, r.log.finish],
      [1, [12], ['甲', '乙'], ['甲乙'], [['', null, '甲乙']]]);
  }
  {
    const f = fakeFetch([{ sse: [['delta', { text: '半句' }]] }]);
    const r = record();
    S.openInterpretStream(Object.assign({ fetch: f, body: {} }, r.cb));
    await settle();
    eq('没有 done 就关闭 → 断连原因 + stream-closed + 可继续', r.log.finish, [[ZH.aiDisconnected, { kind: 'stream-closed', canContinue: true }, '半句']]);
  }
  {
    const f = fakeFetch([{ sse: [['start', {}]] }]);
    const r = record();
    S.openInterpretStream(Object.assign({ fetch: f, body: {} }, r.cb));
    await settle();
    eq('什么都没写就关闭 → 不可继续', r.log.finish, [[ZH.aiDisconnectedEmpty, { kind: 'stream-closed', canContinue: false }, '']]);
  }
  {
    const f = streamFetch();
    const r = record();
    S.openInterpretStream(Object.assign({ fetch: f, body: {} }, r.cb));
    await settle();
    const p = f.calls[0];
    p.raw('event: del');
    await settle();
    p.raw('ta\ndata: {"text":"分');
    await settle();
    const mid = r.log.deltas.length;
    p.raw('块"}\n\nevent: done\ndata: {"text":"分块"}\n\n');
    await settle();
    eq('一个 SSE 块拆在几次读里：拼好后才回调，结果正确', [mid, r.log.deltas, r.log.done, r.log.finish], [0, ['分块'], ['分块'], [['', null, '分块']]]);
  }
  {
    const f = streamFetch();
    const r = record();
    S.openInterpretStream(Object.assign({ fetch: f, body: {} }, r.cb));
    await settle();
    f.calls[0].raw('event: mystery\ndata: {"text":"不该出现"}\n\n').raw('event: delta\ndata: {坏 json\n\n').send('delta', { text: '好' }).send('done', { text: '好' });
    await settle();
    eq('不认识的事件、坏 JSON 跳过，后面照常', [r.log.deltas, r.log.finish], [['好'], [['', null, '好']]]);
  }
  {
    const f = fakeFetch([{ status: 503, json: { reason: '模型暂时不可用' } }, { status: 500, text: 'oops' }]);
    const r1 = record();
    S.openInterpretStream(Object.assign({ fetch: f, body: {} }, r1.cb));
    const r2 = record();
    S.openInterpretStream(Object.assign({ fetch: f, body: {} }, r2.cb));
    await settle();
    eq('HTTP 503 带 { reason } → 原因就是它；不是 JSON → HTTP 500', [r1.log.finish, r2.log.finish],
      [[['模型暂时不可用', null, '']], [['HTTP 500', null, '']]]);
  }
  {
    const f = fakeFetch([{ sse: [['delta', { text: '写了' }], ['error', { reason: '超时了', kind: 'timeout', canContinue: true }]] }]);
    const r = record();
    S.openInterpretStream(Object.assign({ fetch: f, body: {} }, r.cb));
    await settle();
    eq('error 事件 → 原因和 issue 原样交出', r.log.finish, [['超时了', { reason: '超时了', kind: 'timeout', canContinue: true }, '写了']]);
  }
  {
    const f = fakeFetch([{ error: '网络断了' }]);
    const r = record();
    S.openInterpretStream(Object.assign({ fetch: f, body: {} }, r.cb));
    await settle();
    eq('fetch 失败 → 错误信息 + kind error', r.log.finish, [['网络断了', { kind: 'error', canContinue: false }, '']]);
  }
  {
    const f = streamFetch();
    const r = record();
    const handle = S.openInterpretStream(Object.assign({ fetch: f, body: {} }, r.cb));
    await settle();
    const p = f.calls[0];
    p.send('delta', { text: 'abc' });
    await settle();
    handle.abort(true);
    const right = J(r.log.finish);
    p.send('delta', { text: '不该出现' }).send('done', { text: 'abc不该出现' });
    handle.abort(true);
    await settle();
    eq('用户停止 → 马上结束：stopped + 可继续；之后的事件不再回调，onFinish 只调一次',
      [JSON.parse(right), r.log.deltas, r.log.done, r.log.finish.length],
      [[[ZH.aiStopped, { kind: 'stopped', canContinue: true }, 'abc']], ['abc'], [], 1]);
    ok('用户停止时中止了请求（signal.aborted）', !!(p.init.signal && p.init.signal.aborted));
  }
  {
    const f = streamFetch();
    const r = record();
    const handle = S.openInterpretStream(Object.assign({ fetch: f, body: {} }, r.cb));
    await settle();
    handle.abort(true);
    await settle();
    eq('还没写就停止 → 已停止、不可继续', r.log.finish, [[ZH.aiStoppedEmpty, { kind: 'stopped', canContinue: false }, '']]);
  }
  {
    /* 没有 AbortController 的环境（默认沙箱）：停止照样马上结束，读循环自己退出并 cancel 掉 reader */
    const bare = loadBundle(t.client);
    let S2 = null;
    try { bare.materialize().apply(makeCtx({}).ctx); S2 = bare.win.ZWStore; } catch { S2 = null; }
    const f = streamFetch();
    const r = record();
    const handle = S2 ? S2.openInterpretStream(Object.assign({ fetch: f, body: {} }, r.cb)) : null;
    await settle();
    const p = f.calls[0];
    if (p) p.send('delta', { text: '有' });
    await settle();
    if (handle) handle.abort(true);
    if (p) p.send('delta', { text: '不该出现' }).send('done', { text: '有不该出现' });
    await settle();
    eq('没有 AbortController 时停止：照样结束、之后不回调、reader 被 cancel',
      [!!p && p.init.signal === undefined, r.log.deltas, r.log.finish, !!p && p.cancelled],
      [true, ['有'], [[ZH.aiStopped, { kind: 'stopped', canContinue: true }, '有']], true]);
  }

  /* ================================================================ */
  section('v6 store：buildInterpretBody');
  const B = (o) => S.buildInterpretBody(Object.assign({ chart, input: GOLDEN, now: NOW, core: C, tab: 'natal', when: TODAY, mode: 'brief', question: '事业', history: [] }, o));
  const full = C.fullChartText(chart, { currentAge: 35, currentYear: 2026 });
  const b0 = B({});
  eq('请求体字段：chartText, mode, question, history, meta', Object.keys(b0), ['chartText', 'mode', 'question', 'history', 'meta']);
  eq('meta：称呼、出生地、职业、性别、虚岁 35、2026 年、两个聚焦为空', b0.meta,
    { name: '', place: '', occupation: '', gender: 'male', currentAge: 35, currentYear: 2026, decadalFocus: null, yearlyFocus: null });
  ok('chartText === fullChartText(chart, { currentAge: 35, currentYear: 2026 })，以引擎的命盘文字开头',
    b0.chartText === full && b0.chartText.startsWith(E.chartText(chart)));
  eq('mode：report 原样，其他一律 brief；question 原样', [B({ mode: 'report' }).mode, B({ mode: 'x' }).mode, b0.question], ['report', 'brief', '事业']);
  const meta2 = B({ input: Object.assign({}, GOLDEN, { name: '测试', place: '某地', occupation: '工程师', gender: 'female' }) }).meta;
  eq('meta 的称呼、出生地、职业、性别取自输入', [meta2.name, meta2.place, meta2.occupation, meta2.gender], ['测试', '某地', '工程师', 'female']);
  const hist = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'm' + i, extra: 1 }));
  const bh = B({ history: hist }).history;
  eq('history 只带最后 20 条，只留 role / content', [bh.length, bh[0], bh[19]], [20, { role: 'user', content: 'm10' }, { role: 'assistant', content: 'm29' }]);
  eq('没有 scope 时各页签都不带聚焦', ['decadal', 'yearly', 'monthly', 'daily'].map((tab) => { const b = B({ tab }); return [b.meta.decadalFocus, b.meta.yearlyFocus, b.chartText === full, b.question]; }),
    [[null, null, true, '事业'], [null, null, true, '事业'], [null, null, true, '事业'], [null, null, true, '事业']]);
  const bd = B({ tab: 'decadal', scope: true });
  const by = B({ tab: 'yearly', scope: true });
  eq('scope + 大限 → meta.decadalFocus [33, 42]；流年 → meta.yearlyFocus 2026；chartText 不变',
    [bd.meta.decadalFocus, bd.meta.yearlyFocus, bd.chartText === full, bd.question, by.meta.decadalFocus, by.meta.yearlyFocus, by.chartText === full, by.question],
    [[33, 42], null, true, '事业', null, 2026, true, '事业']);
  const bm = B({ tab: 'monthly', scope: true });
  ok('scope + 流月 → chartText = 全文 + 空行 + 【当前定位 · 流月】（己亥月）',
    bm.chartText.startsWith(full + '\n\n【当前定位 · 流月】') && bm.chartText.includes('己亥月') && bm.meta.decadalFocus === null && bm.meta.yearlyFocus === null,
    bm.chartText.slice(full.length, full.length + 80));
  ok('scope + 流月 → question 以【本轮聚焦】开头、以用户的话结尾', bm.question.startsWith('【本轮聚焦】') && bm.question.endsWith('\n事业'), bm.question);
  const bdd = B({ tab: 'daily', scope: true });
  ok('scope + 流日 → 定位写 2026-11-19 丁酉日，question 带聚焦', bdd.chartText.startsWith(full + '\n\n【当前定位 · 流日】') && bdd.chartText.includes('2026-11-19') &&
    bdd.chartText.includes('丁酉') && bdd.question.startsWith('【本轮聚焦】'), bdd.chartText.slice(full.length, full.length + 80));
  eq('scope + 本命 → 什么都不加', [B({ scope: true }).chartText === full, B({ scope: true }).question, B({ scope: true }).meta.decadalFocus], [true, '事业', null]);
  eq('空问题 + 流月 scope → question 只有聚焦说明', B({ tab: 'monthly', scope: true, question: '' }).question.startsWith('【本轮聚焦】'), true);

  /* ================================================================ */
  const mk = (o = {}) => {
    const storage = o.storage || memoryStorage();
    const fetch = o.fetch || streamFetch();
    const timers = o.timers || manualTimers();
    const opened = [];
    const st = S.createStore({
      storage, fetch, now: () => NOW, engine: E, core: C,
      setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
      openSession: o.openSession || ((id) => { opened.push(id); return true; })
    });
    /* 默认当作面板挂着（有一个订阅者）；mounted: false 是面板被宿主卸载的时候 */
    if (o.mounted !== false) st.subscribe(() => {});
    return { st, storage, fetch, timers, opened };
  };
  const last = (f) => f.calls[f.calls.length - 1];

  section('v6 store：初始状态与订阅');
  {
    const { st, storage } = mk();
    const s0 = st.getState();
    eq('初始 session', [s0.session.view, s0.session.chartId, s0.session.tab, s0.session.stage, s0.session.when, s0.session.panelOpen, s0.session.quote, s0.session.toast],
      ['home', null, 'natal', 'board', TODAY, false, null, null]);
    eq('初始 library 为空，prefs 是默认值（外观默认深色）', [s0.library, s0.prefs], [[], { autoOpen: false, showAdj: false, sky: true, theme: 'dark', model: null }]);
    eq('todayOf() 来自注入的 now()', st.todayOf(), TODAY);
    const log = [];
    let first = true;
    const un1 = st.subscribe(() => {
      log.push('L1:' + st.getState().session.pane);
      if (first) { first = false; st.setPane('pats'); log.push('inner-returned'); }
    });
    const un2 = st.subscribe(() => { log.push('L2:' + st.getState().session.pane); });
    st.setPane('detail');
    eq('订阅者在每次变化后被调用，不同步重入（里面触发的变化排在这一轮之后）', log, ['L1:detail', 'inner-returned', 'L2:pats', 'L1:pats', 'L2:pats']);
    un1(); un2();
    log.length = 0;
    st.setPane('scope');
    eq('退订之后不再调用', log, []);
    const snapA = st.getState();
    st.setPane('scope');
    ok('没有变化时快照不换（setPane 同值）', st.getState() === snapA);
    st.setPref('showAdj', true);
    eq('setPref 写进 prefs 和 storage', [st.getState().prefs.showAdj, storage.getItem('ziwei-pro.showadj')], [true, '1']);
  }

  section('v6 store：命盘库与导航');
  {
    const { st, storage, timers } = mk();
    const a = st.addChart(GOLDEN, '甲');
    const b = st.addChart(GOLDEN_F, '乙');
    eq('addChart 返回条目并写进 library（新的在前）', [a && a.name, b && b.name, st.getState().library.map((e) => e.name)], ['甲', '乙', ['乙', '甲']]);
    ok('openChart(未知 id) → false，状态不变', st.openChart('lib-nope') === false && st.getState().session.view === 'home');
    ok('openChart(A) → true', st.openChart(a.id) === true);
    const s1 = st.getState().session;
    eq('openChart：命盘页、本命、盘面、今天、选中命宫（11）、pane scope', [s1.view, s1.chartId, s1.tab, s1.stage, s1.when, s1.sel, s1.pat, s1.pane, s1.focusId],
      ['chart', a.id, 'natal', 'board', TODAY, 11, 0, 'scope', a.id]);
    const lastChart = JSON.parse(storage.getItem('ziwei-pro.lastChart.v1') || 'null');
    eq('openChart 写 lastChart、记 openedAt', [lastChart && lastChart.year, lastChart && lastChart.gender, st.getState().library.find((e) => e.id === a.id).openedAt], [1992, 'male', NOW]);
    eq('currentEntry / currentChart / keyOf', [st.currentEntry().id, st.currentChart().soulIndex, st.keyOf(st.currentEntry())], [a.id, 11, KEY_A]);
    ok('currentChart 按命盘 key 记住结果（两次是同一个对象）', st.currentChart() === st.currentChart());
    eq('horoscope() 是 when 那天的运限（流日父母，序号 0）', [st.horoscope().daily.index, st.horoscope().monthly.index], [0, 2]);

    const before = st.getState().session;
    st.selectPalace(3);
    const after = st.getState().session;
    eq('selectPalace(3)：sel 和 pane 变了', [after.sel, after.pane], [3, 'detail']);
    ok('selectPalace：tab / when / pat / stage 严格相等', after.tab === before.tab && after.when === before.when && after.pat === before.pat && after.stage === before.stage);
    st.setTab('monthly');
    eq('setTab(monthly)：选中宫 = 流月命宫（2），pane 回到 scope', [st.getState().session.tab, st.getState().session.sel, st.getState().session.pane], ['monthly', 2, 'scope']);
    const snap = st.getState();
    st.setTab('monthly');
    ok('setTab 同一个页签是空操作（快照不换）', st.getState() === snap);
    st.setTab('natal');
    eq('setTab(natal)：选中宫不动', [st.getState().session.tab, st.getState().session.sel], ['natal', 2]);
    st.setStage('report');
    st.setTab('natal');
    eq('在报告页点当前页签 → 回到盘面', st.getState().session.stage, 'board');
    st.setPat(2);
    eq('setPat', st.getState().session.pat, 2);

    st.openChart(a.id, { tab: 'daily', when: { y: 2026, m: 12, d: 7 } });
    eq('openChart 带 tab / when：流日 2026-12-07，选中宫 6', [st.getState().session.tab, st.getState().session.when, st.getState().session.sel], ['daily', { y: 2026, m: 12, d: 7 }, 6]);
    st.stepScope(1);
    eq('stepScope(+1) 在流日上前进一天，选中宫跟着走（7）', [st.getState().session.when, st.getState().session.sel], [{ y: 2026, m: 12, d: 8 }, 7]);
    st.backToNow();
    eq('backToNow → 今天，选中宫 = 今天的流日命宫（0）', [st.getState().session.when, st.getState().session.sel], [TODAY, 0]);

    st.openChart(a.id, { tab: 'daily', when: { y: 1992, m: 5, d: 3 } });
    const edge0 = clone(st.getState().session);
    st.stepScope(-1);
    const edge1 = clone(st.getState().session);
    const toast = edge1.toast;
    delete edge0.toast; delete edge1.toast;
    eq('出生那天往前翻：状态不变，只多一条提示', [J(edge0) === J(edge1), toast && toast.text], [true, ZH.edgeBack]);
    st.openChart(a.id, { tab: 'daily', when: { y: 2100, m: 12, d: 31 } });
    const edge2 = clone(st.getState().session);
    st.stepScope(1);
    const edge3 = clone(st.getState().session);
    const toast2 = edge3.toast;
    delete edge2.toast; delete edge3.toast;
    eq('2100-12-31 往后翻：状态不变，只多一条提示', [J(edge2) === J(edge3), toast2 && toast2.text], [true, ZH.edgeForward]);

    st.goHome();
    eq('goHome：首页，面板关上，chartId 留着', [st.getState().session.view, st.getState().session.panelOpen, st.getState().session.chartId], ['home', false, a.id]);

    st.openChart(a.id);
    st.setPanel(true);
    eq('setPanel(true) 只开面板', st.getState().session.panelOpen, true);

    st.setDraft('草稿甲');
    const dumpBefore = J(storage.dump());
    st.openChart(b.id);
    eq('换盘后草稿是新盘的（空）', st.draft(), '');
    st.setDraft('草稿乙');
    st.openChart(a.id);
    eq('回到 A，草稿还在；B 的也在', [st.draft(), st.draft(KEY_B)], ['草稿甲', '草稿乙']);
    const dumpNoDraft = Object.values(storage.dump()).some((v) => String(v).includes('草稿'));
    ok('草稿只在内存里，storage 里没有', !dumpNoDraft && dumpBefore.indexOf('草稿') < 0);
    st.setReadPos({ part: 3, offset: 120 });
    st.openChart(b.id);
    st.openChart(a.id);
    eq('阅读位置按命盘留在内存里', st.readPos(), { part: 3, offset: 120 });

    st.patchSession({ onboarding: { step: 2 }, introPlayed: true });
    eq('patchSession 改 UI 字段', [st.getState().session.onboarding, st.getState().session.introPlayed], [{ step: 2 }, true]);

    st.setQuote({ label: '这段', text: '字'.repeat(700) });
    eq('setQuote 截到 600 字', st.getState().session.quote.text.length, 600);
    st.setQuote(null);

    st.showToast('一句话');
    eq('showToast：3.2 秒后自动消失', [st.getState().session.toast && st.getState().session.toast.text, timers.delays().includes(3200)], ['一句话', true]);
    timers.runAll();
    eq('定时器到点 → toast 清掉', st.getState().session.toast, null);

    const libBefore = st.getState().library.map((e) => e.id);
    ok('removeChart → true', st.removeChart(b.id) === true);
    const t1 = st.getState().session.toast;
    eq('removeChart：库里没了，提示带撤销（6 秒）', [st.getState().library.map((e) => e.id).includes(b.id), t1 && t1.text, t1 && t1.action && t1.action.label, timers.delays().includes(6000)],
      [false, ZH.libDeleted, ZH.undo, true]);
    t1.action.run();
    eq('撤销删除：回到原位置，提示已撤销', [st.getState().library.map((e) => e.id), st.getState().session.toast && st.getState().session.toast.text], [libBefore, ZH.undoDone]);
    st.renameChart(a.id, '新名字');
    eq('renameChart', st.getState().library.find((e) => e.id === a.id).name, '新名字');

    st.openSample();
    const sample = st.currentEntry();
    eq('openSample：示例盘不进命盘库', [sample && sample.sample, sample && sample.name, st.getState().session.chartId, st.keyOf(sample), st.getState().library.length], [true, ZH.sampleChart, 'sample', KEY_SAMPLE, 2]);
  }
  {
    const { fetch, st } = mk();
    const a = st.addChart(GOLDEN, '甲');
    st.openChart(a.id);
    st.setPanel(true);
    st.setPanel(false);
    st.setPanel(true);
    st.selectPalace(4);
    st.setTab('yearly');
    eq('开关面板、选宫、切页签都不发请求', fetch.calls.length, 0);
  }
  {
    const storage = memoryStorage();
    const first = mk({ storage });
    const a = first.st.addChart(GOLDEN, '甲');
    first.st.addChart(GOLDEN_F, '乙');
    first.st.openChart(a.id);
    const second = mk({ storage });
    eq('启动时恢复上次命盘：首页聚焦它', [second.st.getState().session.view, second.st.getState().session.focusId], ['home', a.id]);
  }
  {
    /* 1.6.0（上一个公开版本）写下的命盘库：input 没有 city 字段，经度和籍贯是两个字段（v1.6.0 的 src/ui-pro.js saveChart）。
       从 npm 升级上来的人带着的是这种记录；fixtures/storage-v5.json 是 v5 的形状，没有这一种。期望值是黄金用例的既有口径。 */
    const V160 = { name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
      longitude: '105.97', place: '', occupation: '', settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true } };
    const V160_NOLON = Object.assign({}, V160, { name: '乙', gender: 'female', longitude: '', place: '成都', occupation: '设计' });
    const seed = [{ id: 'lib-1762600000002', name: '甲', input: V160 }, { id: 'lib-1762600000001', name: '乙', input: V160_NOLON }];
    const storage = memoryStorage({ 'ziwei-pro.library': J(seed), 'ziwei-pro.form': J(V160), 'ziwei-pro.formV133': '1', 'ziwei-pro.focus': '1', 'ziwei-pro.rail': '0' });
    const { st } = mk({ storage });
    eq('1.6.0 的命盘库：两张盘都在，次序和名字不变', st.getState().library.map((e) => [e.id, e.name]), [['lib-1762600000002', '甲'], ['lib-1762600000001', '乙']]);
    ok('1.6.0 的记录能打开', st.openChart('lib-1762600000002') === true);
    const c = st.currentChart();
    const soul = c && c.palaces ? c.palaces[c.soulIndex] : null;
    const fix = c && c.meta ? c.meta.solarCorrection : null;
    eq('1.6.0 的黄金用例：按记录里的经度校正到 08:37 辰时，命宫癸丑、太阳太阴，木三局',
      soul && [fix ? fix.solarTime : null, c.timeName, soul.stem + soul.branch, soul.major.map((x) => x.name), c.fiveElementsClass],
      ['08:37', '辰时', '癸丑', ['太阳', '太阴'], '木三局']);
    eq('1.6.0 的记录和 v6 里新录的同一生辰是同一个命盘 key（解读记录对得上）', st.keyOf(st.currentEntry()), KEY_A);
    ok('没填经度的 1.6.0 记录也能打开、排出十二宫', st.openChart('lib-1762600000001') === true && !!st.currentChart() && st.currentChart().palaces.length === 12);
    const kept = JSON.parse(storage.getItem('ziwei-pro.library') || '[]');
    eq('打开之后原记录的字段一个不少（退回 1.6.0 还能读）',
      seed.map((e) => { const k = kept.find((x) => x && x.id === e.id); return !!k && Object.keys(e.input).every((f) => J(k.input[f]) === J(e.input[f])); }), [true, true]);
  }

  section('v6 store：对话');
  {
    const { st, fetch, storage } = mk();
    const a = st.addChart(GOLDEN, '甲');
    st.openChart(a.id);
    st.setPanel(true);
    ok('速览：ask("") → true', st.ask('') === true);
    await settle();
    eq('速览发出 question 为空的 brief 请求，没有用户气泡', [fetch.calls.length, last(fetch).body.question, last(fetch).body.mode, st.reading().thread], [1, '', 'brief', []]);
    eq('进行中：job 是 chat', st.job(), { kind: 'chat', thinkChars: 0, retried: false });
    last(fetch).send('thinking', { chars: 40 });
    await settle();
    eq('thinking → job.thinkChars', st.job().thinkChars, 40);
    ok('忙的时候再问 → false，不发请求', st.ask('第二个问题') === false && fetch.calls.length === 1);
    last(fetch).send('delta', { text: '速览一' }).send('delta', { text: '二' });
    await settle();
    eq('增量写进这张盘的 thread', st.reading().thread, [{ role: 'assistant', content: '速览一二' }]);
    ok('流式过程中不写 storage', !readMap(storage)[KEY_A]);
    last(fetch).send('done', { text: '速览一二' });
    await settle();
    eq('done → job 结束，thread 一条回答', [st.job(), st.reading().thread], [null, [{ role: 'assistant', content: '速览一二' }]]);
    eq('结束时落盘一次', readMap(storage)[KEY_A] && readMap(storage)[KEY_A].thread, [{ role: 'assistant', content: '速览一二' }]);
    eq('面板开着时结束不弹"查看"提示', st.getState().session.toast, null);

    st.ask('空的吗');
    await settle();
    last(fetch).send('done', { text: '' });
    await settle();
    eq('流式空回答：只有用户气泡，没有空的回答气泡', st.reading().thread.slice(1), [{ role: 'user', content: '空的吗' }]);

    st.ask('前半问');
    await settle();
    last(fetch).send('delta', { text: '前半' }).end();
    await settle();
    eq('断连：保留已写的部分，可继续', [st.reading().chatError, st.reading().chatIssue], [ZH.aiDisconnected, { kind: 'stream-closed', canContinue: true }]);
    const lenBefore = st.reading().thread.length;
    ok('continueChat → true', st.continueChat() === true);
    await settle();
    const cb = last(fetch).body;
    eq('续写：question 是续写提示，history 以半截回答结尾，不加用户气泡', [cb.question, cb.history[cb.history.length - 1], st.reading().thread.length, st.reading().chatError],
      [ZH.aiContinuePrompt, { role: 'assistant', content: '前半' }, lenBefore, '']);
    last(fetch).send('delta', { text: '后' }).send('delta', { text: '半' });
    await settle();
    eq('续写的增量接在同一条回答后面', st.reading().thread[st.reading().thread.length - 1], { role: 'assistant', content: '前半后半' });
    last(fetch).send('done', { text: '后半' });
    await settle();
    eq('续写 done：同一条回答 = 原文 + 新文', [st.reading().thread.length, st.reading().thread[lenBefore - 1]], [lenBefore, { role: 'assistant', content: '前半后半' }]);

    st.ask('重试问');
    await settle();
    last(fetch).send('delta', { text: '坏' }).send('error', { reason: '超时了', kind: 'timeout', canContinue: true });
    await settle();
    const base = st.reading().thread.slice(0, -2);
    ok('retryChat → true', st.retryChat() === true);
    await settle();
    eq('重试：去掉失败的那一轮，同一个问题再问一次，不重复出现', [st.reading().thread, last(fetch).body.question, last(fetch).body.history.length],
      [base.concat([{ role: 'user', content: '重试问' }]), '重试问', base.length]);
    last(fetch).send('done', { text: '好了' });
    await settle();
    eq('重试成功', st.reading().thread.slice(-2), [{ role: 'user', content: '重试问' }, { role: 'assistant', content: '好了' }]);

    st.setQuote({ label: '这一宫', text: '命宫 丁丑 · 太阳、太阴' });
    st.ask('怎么看');
    await settle();
    eq('引用：按 v5 的格式拼进问题，发出后清掉', [last(fetch).body.question, st.getState().session.quote, st.reading().thread[st.reading().thread.length - 1].role],
      ['【引用：这一宫】\n命宫 丁丑 · 太阳、太阴\n\n怎么看', null, 'user']);
    last(fetch).send('done', { text: '答' });
    await settle();

    st.setTab('monthly');
    st.ask('这个月如何', { scope: true });
    await settle();
    const sb = last(fetch).body;
    ok('从时间卡提问（流月）：chartText 末尾是定位，question 带聚焦，气泡只有用户的话',
      sb.chartText.includes('\n\n【当前定位 · 流月】') && sb.question.startsWith('【本轮聚焦】') && sb.question.endsWith('这个月如何') &&
      st.reading().thread[st.reading().thread.length - 1].content === '这个月如何', sb.question);
    last(fetch).send('done', { text: '答' });
    await settle();
    st.setTab('decadal');
    st.ask('这十年', { scope: true });
    await settle();
    eq('从时间卡提问（大限）→ meta.decadalFocus [33, 42]', [last(fetch).body.meta.decadalFocus, last(fetch).body.meta.yearlyFocus], [[33, 42], null]);
    last(fetch).send('done', { text: '答' });
    await settle();
    st.setTab('yearly');
    st.ask('今年', { scope: true });
    await settle();
    eq('从时间卡提问（流年）→ meta.yearlyFocus 2026', [last(fetch).body.meta.decadalFocus, last(fetch).body.meta.yearlyFocus], [null, 2026]);
    last(fetch).send('error', { reason: '失败', kind: 'error' });
    await settle();
    st.retryChat();
    await settle();
    eq('重试保留时间卡的聚焦', last(fetch).body.meta.yearlyFocus, 2026);
    last(fetch).send('done', { text: '答' });
    await settle();

    const kept = clone(st.reading().thread);
    ok('clearThread → true', st.clearThread() === true);
    const ct = st.getState().session.toast;
    eq('clearThread：清空，提示可撤销，记录删掉（没有报告）', [st.reading().thread, ct && ct.text, ct && ct.action && ct.action.label, !!readMap(storage)[KEY_A]],
      [[], ZH.aiThreadCleared, ZH.undo, false]);
    ct.action.run();
    eq('撤销清空：对话回来，记录写回', [st.reading().thread, readMap(storage)[KEY_A] && readMap(storage)[KEY_A].thread.length], [kept, kept.length]);
    st.clearThread();
    const ct2 = st.getState().session.toast;
    const b = st.addChart(GOLDEN_F, '乙');
    st.openChart(b.id);
    ct2.action.run();
    eq('换了盘再撤销 → 不动（A 仍是空的，B 也是空的）', [st.reading(KEY_A).thread, st.reading(KEY_B).thread], [[], []]);
  }
  {
    const { st, fetch } = mk();
    const a = st.addChart(GOLDEN, '甲');
    st.openChart(a.id);
    st.ask('后台问');
    await settle();
    last(fetch).send('done', { text: '答好了' });
    await settle();
    const tt = st.getState().session.toast;
    eq('面板关着时回答写完 → 一条带"查看"的提示', [tt && tt.text, tt && tt.action && tt.action.label], [ZH.aiAnswerReady, ZH.view]);
    tt.action.run();
    eq('点"查看"打开面板', st.getState().session.panelOpen, true);
  }

  section('v6 store：报告');
  {
    const { st, fetch, storage, timers } = mk();
    const a = st.addChart(GOLDEN, '甲');
    st.openChart(a.id);
    st.setStage('report');
    ok('startReport → true', st.startReport() === true);
    await settle();
    eq('报告请求：mode report、question 空、history = 当前对话', [last(fetch).body.mode, last(fetch).body.question, last(fetch).body.history], ['report', '', []]);
    eq('job 是 report，报告 running', [st.job() && st.job().kind, st.reading().report.status], ['report', 'running']);
    ok('报告进行中再开对话 → false', st.ask('插一句') === false && fetch.calls.length === 1);
    last(fetch).send('delta', { text: '## 一、' }).send('delta', { text: '命宫' });
    await settle();
    eq('增量累积进报告', st.reading().report.text, '## 一、命宫');
    last(fetch).send('delta', { text: '…' }).end();
    await settle();
    eq('断连：error + stream-closed + 可继续，正文保留', [st.reading().report.status, st.reading().report.issue, st.reading().report.text],
      ['error', { kind: 'stream-closed', canContinue: true }, '## 一、命宫…']);
    ok('continueReport → true', st.continueReport() === true);
    await settle();
    eq('续写：question 是续写提示，history 只有已写的正文', [last(fetch).body.question, last(fetch).body.history], [ZH.aiContinuePrompt, [{ role: 'assistant', content: '## 一、命宫…' }]]);
    last(fetch).send('delta', { text: '续' }).send('done', { text: '续写' });
    await settle();
    eq('续写的结果 = 原文 + 新文，done', [st.reading().report.status, st.reading().report.text], ['done', '## 一、命宫…续写']);
    eq('报告页开着时写完不弹提示', st.getState().session.toast, null);
    eq('落盘：report done', readMap(storage)[KEY_A] && [readMap(storage)[KEY_A].report.status, readMap(storage)[KEY_A].report.text], ['done', '## 一、命宫…续写']);

    ok('regenerateReport → true', st.regenerateReport() === true);
    await settle();
    eq('重新写：question 空，正文先清空', [last(fetch).body.question, st.reading().report.text, st.reading().report.status], ['', '', 'running']);
    last(fetch).send('error', { reason: '模型出错', kind: 'error' });
    await settle();
    const rt = st.getState().session.toast;
    eq('重新写一个字没写出来 → 恢复原报告并提示', [st.reading().report.status, st.reading().report.text, rt && rt.text, rt && rt.error],
      ['done', '## 一、命宫…续写', ZH.reportRestored, true]);
    eq('恢复后的记录还在 storage 里', readMap(storage)[KEY_A] && readMap(storage)[KEY_A].report.text, '## 一、命宫…续写');
    timers.runAll();

    st.regenerateReport();
    await settle();
    last(fetch).send('delta', { text: 'XY' });
    await settle();
    st.stop();
    await settle();
    const rp = st.reading().report;
    eq('stop() 写到一半：error + stopped + 可继续，正文是新写的', [rp.status, rp.issue, rp.error, rp.text, st.job()],
      ['error', { kind: 'stopped', canContinue: true }, ZH.aiStopped, 'XY', null]);
    eq('停止后落盘', readMap(storage)[KEY_A] && [readMap(storage)[KEY_A].report.status, readMap(storage)[KEY_A].report.text, readMap(storage)[KEY_A].report.issue],
      ['error', 'XY', { kind: 'stopped', canContinue: true }]);
  }

  section('v6 store：卸载安全（没有订阅者）');
  {
    const storage = memoryStorage();
    const { st, fetch } = mk({ storage, mounted: false });
    const a = st.addChart(GOLDEN, '甲');
    st.openChart(a.id);
    st.startReport();
    await settle();
    last(fetch).send('delta', { text: '第一段' });
    await settle();
    last(fetch).send('delta', { text: '第二段' });
    await settle();
    eq('没有任何订阅者，报告照样累积', st.getState().readings[KEY_A].report.text, '第一段第二段');
    ok('写的过程中 storage 里没有这张盘的记录', !readMap(storage)[KEY_A]);
    st.flush();
    const fl = readMap(storage)[KEY_A];
    eq('flush()：写了一半的报告存成中断、可接着写的记录', fl && [fl.report.status, fl.report.text, fl.report.issue && fl.report.issue.canContinue, fl.report.issue && fl.report.issue.kind],
      ['error', '第一段第二段', true, 'interrupted']);
    eq('flush() 不中止任务', st.job(KEY_A) && st.job(KEY_A).kind, 'report');
    const mid = mk({ storage }).st;
    mid.openChart(a.id);
    eq('另一个 store 读到中断的记录：error、可继续', [mid.reading().report.status, mid.reading().report.text, mid.reading().report.issue && mid.reading().report.issue.canContinue], ['error', '第一段第二段', true]);
    last(fetch).send('done', { text: '第一段第二段第三段' });
    await settle();
    const rec = readMap(storage)[KEY_A];
    eq('结束时落盘（没有订阅者）', rec && [rec.report.status, rec.report.text], ['done', '第一段第二段第三段']);
    const again = mk({ storage }).st;
    again.openChart(a.id);
    eq('同一份 storage 上新建的 store 读回完整报告', [again.reading().report.status, again.reading().report.text], ['done', '第一段第二段第三段']);
  }
  {
    const storage = memoryStorage();
    const { st, fetch, timers: timers2 } = mk({ storage, mounted: false });
    const a = st.addChart(GOLDEN, '甲');
    st.openChart(a.id);
    st.startReport();
    await settle();
    last(fetch).send('delta', { text: '半篇' });
    await settle();
    st.abortAll();
    await settle();
    const rec = readMap(storage)[KEY_A];
    eq('abortAll()：任务全停，半篇报告存成可接着写', [st.job(KEY_A), rec && rec.report.status, rec && rec.report.text, rec && rec.report.issue && rec.report.issue.canContinue, !!last(fetch).init.signal.aborted],
      [null, 'error', '半篇', true, true]);
    st.subscribe(() => {});
    st.showToast('还挂着的一句');
    st.abortAll();
    eq('abortAll() 连提示和它的定时器一起清掉', [st.getState().session.toast, timers2.pending.size], [null, 0]);
  }

  {
    const { st, fetch, timers } = mk({ mounted: false });
    const a = st.addChart(GOLDEN, '甲');
    st.openChart(a.id);
    st.startReport();
    await settle();
    last(fetch).send('done', { text: '写完了' });
    await settle();
    const tt = st.getState().session.toast;
    eq('没人订阅时报告写完：提示留着，不开始计时', [tt && tt.text, tt && tt.action && tt.action.label, timers.pending.size], [ZH.reportReadyToast, ZH.view, 0]);
    const un = st.subscribe(() => {});
    eq('回到面板（有人订阅）才开始计时：8 秒', timers.delays(), [8000]);
    timers.runAll();
    eq('到点消失', st.getState().session.toast, null);
    un();
    st.showToast('没人看的一句');
    st.showToast('后来的一句');
    eq('没人订阅：两句都不计时', timers.pending.size, 0);
    st.subscribe(() => {});
    eq('等着的提示被新的顶掉：只给新的计时', [st.getState().session.toast.text, timers.delays()], ['后来的一句', [3200]]);
    st.showToast('第三句');
    st.dismissToast();
    eq('dismissToast 之后没有定时器', [st.getState().session.toast, timers.pending.size], [null, 0]);
  }
  {
    const { st, timers } = mk({ mounted: false });
    st.showToast('等着的一句');
    st.dismissToast();
    st.subscribe(() => {});
    eq('等着的提示被关掉之后，再订阅也不计时', [st.getState().session.toast, timers.pending.size], [null, 0]);
  }

  section('v6 store：不该变的不变（少惊动订阅者）');
  {
    const { st, fetch } = mk();
    const a = st.addChart(GOLDEN, '甲');
    st.openChart(a.id);
    st.startReport();
    await settle();
    last(fetch).send('start', {});
    await settle();
    const jobs0 = st.getState().jobs;
    const readings0 = st.getState().readings;
    let calls = 0;
    const un = st.subscribe(() => { calls++; });
    last(fetch).send('delta', { text: '一' }).send('delta', { text: '二' });
    await settle();
    eq('报告的 delta：readings 换了，jobs 还是原来那个对象', [st.getState().readings !== readings0, st.getState().jobs === jobs0, st.reading().report.text, calls], [true, true, '一二', 2]);
    last(fetch).send('thinking', { chars: 12 });
    await settle();
    eq('thinking 变了：jobs 才换', [st.getState().jobs !== jobs0, st.job().thinkChars], [true, 12]);
    last(fetch).send('done', { text: '一二' });
    await settle();
    un();

    st.ask('问');
    await settle();
    last(fetch).send('start', {});
    await settle();
    const jobs1 = st.getState().jobs;
    last(fetch).send('delta', { text: '答' }).send('delta', { text: '案' });
    await settle();
    eq('对话的 delta：jobs 也不换', [st.getState().jobs === jobs1, st.reading().thread[st.reading().thread.length - 1].content], [true, '答案']);
    last(fetch).send('done', { text: '答案' });
    await settle();

    let n = 0;
    const un2 = st.subscribe(() => { n++; });
    ok('setReadPos 第一次 → true', st.setReadPos({ part: 2, offset: 40 }) === true);
    ok('同一个位置再设一次 → false', st.setReadPos({ part: 2, offset: 40 }) === false);
    eq('位置没变不通知', n, 1);
    ok('位置变了 → true', st.setReadPos({ part: 2, offset: 41 }) === true);
    ok('数字位置也可以，没变 → false', st.setReadPos(300) === true && st.setReadPos(300) === false);
    ok('清掉 → true，再清 → false', st.setReadPos(null) === true && st.setReadPos(null) === false);
    un2();
  }

  section('v6 store：换盘不串');
  {
    const storage = memoryStorage();
    const { st, fetch } = mk({ storage });
    const a = st.addChart(GOLDEN, '甲');
    const b = st.addChart(GOLDEN_F, '乙');
    st.openChart(a.id);
    st.startReport();
    await settle();
    const pa = last(fetch);
    pa.send('delta', { text: 'A1' });
    await settle();
    st.openChart(b.id);
    eq('换到 B：A 的任务还在跑，B 没有任务', [st.job(KEY_A) && st.job(KEY_A).kind, st.job(KEY_B), st.job()], ['report', null, null]);
    ok('B 可以同时开自己的任务', st.ask('B 的问题') === true && fetch.calls.length === 2);
    await settle();
    pa.send('delta', { text: 'A2' }).send('done', { text: 'A1A2' });
    await settle();
    const recA = readMap(storage)[KEY_A];
    eq('A 的流写完：记录在 A 的 key 下，正文完整', recA && [recA.report.status, recA.report.text], ['done', 'A1A2']);
    eq('B 的报告是空的，B 的对话只有自己的提问', [st.reading(KEY_B).report.status, st.reading(KEY_B).report.text, st.reading(KEY_B).thread], ['idle', '', [{ role: 'user', content: 'B 的问题' }]]);
    eq('当前屏幕还是 B', [st.getState().session.chartId, st.currentEntry().id, st.reading() === st.reading(KEY_B)], [b.id, b.id, true]);
    const tt = st.getState().session.toast;
    eq('A 的报告在后台写完 → 提示带"查看"', [tt && tt.text, tt && tt.action && tt.action.label], [ZH.reportReadyToast, ZH.view]);
    tt.action.run();
    eq('点"查看"打开 A 的报告页', [st.getState().session.chartId, st.getState().session.stage], [a.id, 'report']);
    last(fetch).send('done', { text: 'B 的答' });
    await settle();
    eq('B 的回答写在 B 名下', readMap(storage)[KEY_B] && readMap(storage)[KEY_B].thread, [{ role: 'user', content: 'B 的问题' }, { role: 'assistant', content: 'B 的答' }]);
    eq('A 的记录没有混进 B 的对话', readMap(storage)[KEY_A].thread, []);
  }

  section('v6 store：在新会话里继续');
  {
    const replies = [];
    const f = streamFetch({ reply: (url) => (url === '/ziwei/handoff' ? replies.shift() : null) });
    const opened = [];
    let navOk = true;
    const { st, timers } = mk({ fetch: f, openSession: (id) => { opened.push(id); return navOk; } });
    const a = st.addChart(GOLDEN, '甲');
    st.openChart(a.id);
    st.ask('问');
    await settle();
    last(f).send('done', { text: '最后的回答' });
    await settle();
    replies.push({ json: { ok: true, sessionId: 's-1' } });
    await st.handoff();
    await settle();
    const hb = last(f).body;
    eq('handoff 的请求字段和 v5 一样', [last(f).url, Object.keys(hb)], ['/ziwei/handoff', ['chartText', 'fullText', 'name', 'place', 'occupation', 'gender', 'interpretation', 'mode']]);
    ok('chartText = 引擎命盘文字，fullText = 加长上下文，interpretation = 最后一条回答，mode brief',
      hb.chartText === E.chartText(chart) && hb.fullText === full && hb.interpretation === '最后的回答' && hb.mode === 'brief' && hb.gender === 'male');
    eq('成功：交给 openSession，提示已开新会话', [opened, st.getState().session.toast && st.getState().session.toast.text], [['s-1'], ZH.handoffDone]);
    navOk = false;
    replies.push({ json: { ok: true, sessionId: 's-2' } });
    await st.handoff();
    await settle();
    let rounds = 0;
    /* 只推到第 6 次尝试为止：再跑一轮会连提示自己的消失定时器也跑掉 */
    while (opened.filter((x) => x === 's-2').length < 6 && timers.pending.size && rounds < 20) { timers.runAll(); rounds++; }
    eq('跳不过去：重试 6 次后如实提示', [opened.filter((x) => x === 's-2').length, st.getState().session.toast && st.getState().session.toast.text], [6, ZH.handoffNoNav]);
    replies.push({ status: 500, json: {} });
    await st.handoff();
    await settle();
    eq('HTTP 500 → 错误提示', [st.getState().session.toast && st.getState().session.toast.text, st.getState().session.toast && st.getState().session.toast.error], [ZH.handoffFailed500, true]);
  }

  section('v6 store：时间条的跳转（setWhen）');
  {
    const { st } = mk();
    const a = st.addChart(GOLDEN, '甲');
    st.openChart(a.id, { tab: 'yearly' });
    const s0 = st.getState().session;
    eq('setWhen：跳到 2030 年的同一天，选中宫跟到那一年的流年命宫（2030 庚戌 → 戌宫）',
      [st.setWhen({ y: 2030, m: 11, d: 19 }), st.getState().session.when, st.getState().session.tab, chart.palaces[st.getState().session.sel].branch], [true, { y: 2030, m: 11, d: 19 }, 'yearly', '戌']);
    let ticks = 0;
    st.subscribe(() => { ticks++; });
    const w1 = st.getState().session.when;
    eq('同一天再设一次：不变、不通知，when 还是原来那个对象', [st.setWhen({ y: 2030, m: 11, d: 19 }), ticks, st.getState().session.when === w1], [false, 0, true]);
    eq('出生以前、不是日期的：不动', [st.setWhen({ y: 1990, m: 1, d: 1 }), st.setWhen({ y: 2030, m: 13, d: 1 }), st.setWhen(null), st.getState().session.when], [false, false, false, { y: 2030, m: 11, d: 19 }]);
    st.setTab('natal');
    eq('本命下不带页签调：不动（本命不看日期）', [st.setWhen({ y: 2026, m: 11, d: 19 }), st.getState().session.tab], [false, 'natal']);
    st.setStage('report');
    eq('带上页签：切到流日、回到盘面、日期是今天、左栏回到时间卡',
      [st.setWhen({ y: 2026, m: 11, d: 19 }, 'daily'), st.getState().session.tab, st.getState().session.stage, st.getState().session.when, st.getState().session.pane, chart.palaces[st.getState().session.sel].name],
      [true, 'daily', 'board', { y: 2026, m: 11, d: 19 }, 'scope', '父母']);
    eq('页签不认识：不动', st.setWhen({ y: 2026, m: 11, d: 19 }, 'hourly'), false);
    void s0;
  }

  section('v6 store：引导问答不赖在首页');
  {
    const { st } = mk();
    const a = st.addChart(GOLDEN, '甲');
    const ob = { step: 2, data: {}, calMode: 'solar', error: '' };
    st.patchSession({ onboarding: ob });
    st.openSample();
    eq('引导做到一半去看示例盘：引导的进度留着', st.getState().session.onboarding, ob);
    st.goHome();
    st.openChart(a.id);
    eq('引导做到一半打开了命盘库里的盘：引导到此为止', st.getState().session.onboarding, null);
    st.goHome();
    eq('回到首页不再停在引导问答里', [st.getState().session.view, st.getState().session.onboarding], ['home', null]);
  }

  section('v6 store：模型选择');
  {
    eq('请求体：没选模型时不带 model 字段（旧 Host 和默认模型都不受影响）', 'model' in B({}), false);
    eq('请求体：选了模型就带上 { provider, model }', B({ model: { provider: 'px', model: 'mx' } }).model, { provider: 'px', model: 'mx' });
    eq('请求体：只给一半、不是字符串的选择不带', ['model' in B({ model: { provider: 'px' } }), 'model' in B({ model: { provider: 1, model: 2 } }), 'model' in B({ model: 'px/mx' })], [false, false, false]);

    const replies = [];
    const f = streamFetch({ reply: (url) => (url === '/ziwei/models' ? replies.shift() : null) });
    const { st, storage } = mk({ fetch: f });
    const s0 = st.getState();
    eq('初始：跟随 DSH 默认（prefs.model 是 null），列表还没读，也没有发请求', [s0.prefs.model, s0.models.status, s0.models.providers, f.calls.length], [null, 'idle', [], 0]);
    replies.push({ json: { ok: true, providers: [{ id: 'ds', name: 'DeepSeek', models: [{ id: 'flash', name: 'Flash' }, { id: 'pro' }] }, { id: 'none', name: 'None', models: [] }], default: { provider: 'ds', model: 'flash' } } });
    const p1 = st.loadModels();
    const p1b = st.loadModels();
    eq('loadModels()：读的时候 status 是 loading；还没回来时再调一次不会多发请求', [st.getState().models.status, f.calls.length, last(f).url, last(f).init.method, p1 === p1b], ['loading', 1, '/ziwei/models', 'GET', true]);
    await p1;
    eq('读到了：有模型的提供方才留下，模型没有名字时用 id，default 是 DSH 的默认模型',
      st.getState().models, { status: 'ready', providers: [{ id: 'ds', name: 'DeepSeek', models: [{ id: 'flash', name: 'Flash' }, { id: 'pro', name: 'pro' }] }], def: { provider: 'ds', model: 'flash' }, error: '' });
    replies.push({ status: 404, text: '<!DOCTYPE html><title>Not found</title>' });
    await st.loadModels();
    eq('loadModels() 每次都重读；旧 Host 没有这条路由（回的不是 JSON）→ status error，原因是 HTTP 状态', [f.calls.length, st.getState().models.status, st.getState().models.error, st.getState().models.providers], [2, 'error', 'HTTP 404', []]);
    replies.push({ json: { ok: false, reason: 'llm 服务不可用' } });
    await st.loadModels();
    eq('Host 说不行 → 用它给的原因', [st.getState().models.status, st.getState().models.error], ['error', 'llm 服务不可用']);

    let ticks = 0;
    st.subscribe(() => { ticks++; });
    eq('setModel：变了才是 true，写进 prefs 和本机记录', [st.setModel({ provider: 'ds', model: 'pro' }), st.getState().prefs.model, storage.getItem('ziwei-pro.model')], [true, { provider: 'ds', model: 'pro' }, '{"provider":"ds","model":"pro"}']);
    const t1 = ticks;
    eq('setModel 同一个值：false，不通知', [st.setModel({ provider: 'ds', model: 'pro' }), ticks - t1], [false, 0]);
    const a = st.addChart(GOLDEN, '甲');
    st.openChart(a.id);
    st.ask('问');
    await settle();
    eq('提问的请求体带上选的模型', last(f).body.model, { provider: 'ds', model: 'pro' });
    last(f).send('start', { provider: 'ds', model: 'pro', mode: 'brief' });
    await settle();
    eq('start 帧里是这次实际用的模型：记在 session.lastModel', st.getState().session.lastModel, { provider: 'ds', model: 'pro' });
    last(f).send('thinking', { chars: 12 });
    await settle();
    last(f).send('retry', { reason: 'empty', attempt: 2 });
    await settle();
    eq('retry 帧（Host 正在同一个请求里再问一次）：job.retried 变真，任务还在跑', st.job(), { kind: 'chat', thinkChars: 12, retried: true });
    last(f).send('delta', { text: '你好' });
    await settle();
    eq('第二次的正文来了：retried 变回假', st.job(), { kind: 'chat', thinkChars: 0, retried: false });
    last(f).send('done', { text: '你好' });
    await settle();
    eq('照常写完', [st.job(), st.reading().thread.map((m) => m.content)], [null, ['问', '你好']]);
    st.ask('再问');
    await settle();
    last(f).send('error', { reason: '模型只做了思考，没有给出回答', kind: 'empty', attempts: 2 });
    await settle();
    eq('两次都空：错误条的文字和 kind 来自 Host', [st.reading().chatError, st.reading().chatIssue && st.reading().chatIssue.kind], ['模型只做了思考，没有给出回答', 'empty']);
    eq('setModel(null)：回到跟随默认，本机记录里不留这个键', [st.setModel(null), st.getState().prefs.model, storage.getItem('ziwei-pro.model')], [true, null, null]);
    st.retryChat();
    await settle();
    eq('回到默认之后的请求体不带 model', 'model' in last(f).body, false);
    last(f).send('done', { text: '好' });
    await settle();
    eq('patchSession 改不了 lastModel（只由 start 帧写）', [st.patchSession({ lastModel: null }), st.getState().session.lastModel], [false, { provider: 'ds', model: 'pro' }]);
  }
  {
    const { st } = mk({ storage: memoryStorage({ 'ziwei-pro.model': '{"provider":"ds","model":"pro"}' }) });
    eq('本机记录里有选择：启动时读进 prefs.model', st.getState().prefs.model, { provider: 'ds', model: 'pro' });
    const bad = mk({ storage: memoryStorage({ 'ziwei-pro.model': '{bad json' }) }).st;
    eq('本机记录坏了：按跟随默认', bad.getState().prefs.model, null);
  }
}
