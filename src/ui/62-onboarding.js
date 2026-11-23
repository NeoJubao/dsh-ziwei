/* ================================================================
 * 62-onboarding：引导问答（T8b）。称呼 → 生日 → 出生时间 → 性别 → 出生城市 → 确认（spec §3.2）
 *
 * ---------------- 给首页（60-home.js）的接口 ----------------
 * 状态在 session.onboarding（store.patchSession 写；store 不解读它）：
 *   null                              不在引导里。命盘库为空时首页照样渲染 OnboardingTalk：它把 null 当成第 0 步，
 *                                     第一次回答时才写进 session（所以首页不用在 effect 里先"开始"）。
 *   { step: 0–5, data, calMode: 'solar'|'lunar', error, province? }
 *     step   OB_STEPS 的下标：0 称呼、1 生日、2 时间、3 性别、4 城市、5 确认
 *     data   已答的项 { name?, date?, time?, gender?, city? }，每项 { value, show, short? }；改前面的项时后面的留着。
 *            time 是直接给的时辰时多一个 shichen: true。另有一项不是步骤：solar = { value: false, show: '' }，
 *            用户在确认步关掉了真太阳时校正时才有（改回校正就删掉）
 *     error  上一次回答被拒的原因（解析器或引擎的说明），提示行显示它；答对了清空
 *     province  城市这一步刚答了一个省名（范围太大，定不了经度）时才有：chip 换成这个省的城市；答对、换步就没有了
 * obStart()                        开始（或重新开始）引导：session.onboarding = 第 0 步。首页「排一张新盘」调它。
 * function OnboardingTalk({ tier, onDone })
 *   首页对话列（div.zp-col，HOME_TALK）里、日期行（p.zp-date-line）下面的全部内容。首页只要在
 *   session.onboarding 有值、或命盘库为空时渲染它，别的都不用管。返回一个数组（不包外层，.zp-col 是 flex 列、带 gap），
 *   按这个顺序：h1.zp-status > span（当前的问题；span 按步换 key，换一步重放一次入场动画）、
 *   div.zp-receipts > button.zp-receipt（已答的项，点了回到那一步）、form.zp-ask > input + button.zp-send
 *   （自己的输入框：正在打的字是组件内状态；占位文字按步换；确认步禁用；提交调 onboardingSubmit）、
 *   p.zp-hint（被拒时加 zp-err）、div.zp-chips > button.zp-chip（这一步的快捷项，见下）。
 *   chip：生日步「公历 / 农历」开关；时间步十二时辰（small 里是起止钟点）+「不确定」；性别步「男 / 女」；
 *   城市步常用城市（刚答了省名时是这个省的城市）+「跳过」；称呼步「跳过」；
 *   确认步「排盘」（zp-chip zp-primary）+ 校正开关（钟点 + 城市时才有：「不校正」/「按真太阳时校正」）+「重新填」；
 *   每一步都有「直接填表」（openSheet('birth')）；命盘库为空时「看示例盘」（store.openSample()），否则「取消」
 *   （session.onboarding = null）。这几项都不需要首页做什么。
 *   「排盘」成功（命盘库里已经有了这一条）：session.onboarding 清空、focusId 指向新盘，然后调 onDone(entry)，
 *   由首页播新星诞生、再进命盘；没给 onDone 时自己 store.openChart(entry.id, { tab: 'natal', panel: true })。
 *   焦点：答对一步、点已答项回去改、切公历 / 农历之后，在 effect 里把焦点放回输入框（确认步放到「排盘」上）；
 *   挂载时只有引导是用户开始的（session.onboarding 有值）才抢焦点，空库自动进来的不抢。
 * onboardingSubmit(text) → { ok, error, entry }
 *   按当前这一步读 text（和在输入框里提交一样）。ok：被接受（前进了，或在确认步排好了）；
 *   error：被拒的原因（也写进了 session.onboarding.error）；entry：确认步排好时是新的命盘库条目，否则 null。
 *   它从不打开命盘：打开是 onDone 或上面那条兜底的事。确认步回答「重新填」等于重来。
 *
 * ---------------- 规则（spec §3.2 和项目历史） ----------------
 * - 时辰不替用户默认：「不确定」（及「不知道」等）不前进，提示「时辰决定命宫，请选一个最可能的时辰」。
 * - 真太阳时校正是每张盘的口径（spec 2026-11-24_solar-time-option）。直接给的时辰就按这个时辰排，不校正：
 *   把「卯时」当成 06:00 再按经度往前推，部分日期会排成寅时的盘。钟点 + 城市默认校正，确认步总是写出校正结果
 *   （时辰换了要明说：obConfirmModel 用引擎算一遍，比较 chart.timeName），并且可以一键改成不校正。
 *   不校正的条目带 settings.trueSolar === false，经度照常记下（见 21-storage 的 effectiveLongitude）。
 * - 城市答的是省名：留在这一步，说明定不了经度，把这个省的城市给成 chip。
 * - 生辰排不出来（引擎拒绝）：留在当前这一步并说明原因；生日这一步答完就先用引擎验一遍。
 * - 条目是 v5 的形状（store.addChart → libraryInput：id = lib-<毫秒>、input.isLeap、settings 取 DEFAULT_FORM），
 *   不直接写 storage。
 * - 中文只在字典里：可点的词（跳过、不确定、男 / 女、常用城市、重新填）从字典取，中英两种写法都认。
 *
 * 测试接口：ZWUi.onboarding = { reduce, start, confirmModel, inputOf, finish, submit, OnboardingTalk }。
 * ================================================================ */

const OB_STEPS = ['name', 'date', 'time', 'gender', 'city', 'confirm'];
const OB_CONFIRM = 5;
const OB_NAME_MAX = 12;
const OB_ITEM_KEYS = { name: 'obItemName', date: 'obItemDate', time: 'obItemTime', gender: 'obItemGender', city: 'obItemCity' };
const OB_ASK_KEYS = ['obAskName', 'obAskDate', 'obAskTime', 'obAskGender', 'obAskCity', 'obConfirmIntro'];
const OB_PLACEHOLDER_KEYS = ['obPhName', 'obPhDate', 'obPhTime', 'obPhGender', 'obPhCity', 'obPhConfirm'];
const OB_IDLE = { step: 0, data: {}, calMode: 'solar', error: '' };

function obFresh(calMode) {
  return { step: 0, data: {}, calMode: calMode === 'lunar' ? 'lunar' : 'solar', error: '' };
}

function obPad2(n) {
  return ('0' + (+n || 0)).slice(-2);
}

/* 一个字典键在中、英两种语言（以及当前语言）里的写法，去首尾空白、小写 */
function obWords(key) {
  const out = [];
  ['zh-CN', 'en-US'].forEach(function (lang) {
    const v = DICT[lang] && DICT[lang][key];
    if (typeof v === 'string' && v.trim()) out.push(v.trim().toLowerCase());
  });
  const cur = t(key);
  if (typeof cur === 'string' && cur.trim()) out.push(cur.trim().toLowerCase());
  return out;
}

function obIsWord(text, key) {
  const v = String(text == null ? '' : text).trim().toLowerCase();
  return !!v && obWords(key).indexOf(v) >= 0;
}

/* 字典里用 | 分开的一串（常用城市）：中文那份是解析器认得的值 */
function obZhList(key) {
  const v = DICT['zh-CN'] && DICT['zh-CN'][key];
  return typeof v === 'string' ? v.split('|') : [];
}

/* 已答的项 → v5 的 input（命盘库条目和排盘都用它）；缺的项按空值 */
function obInputOf(data) {
  const d = data || {};
  const dv = d.date && d.date.value;
  const tv = d.time && d.time.value;
  const cv = d.city && d.city.value;
  /* 不校正：直接给的时辰，或用户在确认步关掉了校正。只在不校正时写 trueSolar（校正的条目和以前一个样） */
  const solarOff = !!(d.time && d.time.shichen) || !!(d.solar && d.solar.value === false);
  return {
    name: d.name ? String(d.name.value || '') : '',
    calendar: dv && dv.lunar ? 'lunar' : 'solar',
    year: dv ? dv.y : 0, month: dv ? dv.m : 0, day: dv ? dv.d : 0, isLeap: !!(dv && dv.leap),
    hour: tv ? tv.h : 0, minute: tv ? tv.m : 0,
    gender: d.gender && d.gender.value === 'female' ? 'female' : 'male',
    longitude: cv ? String(cv.lon) : '', city: cv ? String(cv.text || '') : '', place: cv ? String(cv.place || '') : '',
    occupation: '',
    settings: solarOff ? Object.assign({}, DEFAULT_FORM.settings, { trueSolar: false }) : Object.assign({}, DEFAULT_FORM.settings)
  };
}

/* 用引擎排一遍：{ chart, error }，error 是给用户看的整句（带引擎的原因）。生辰表单也用它 */
function obChartOf(input) {
  let c = null, reason = '';
  try { c = E.computeChart(storeEngineInput(input)); } catch (e) { c = null; reason = String((e && e.message) || ''); }
  if (c && !c.error) return { chart: c, error: '' };
  return { chart: null, error: t('obCannotChart', { reason: String((c && c.error) || reason) }) };
}

/* ---------------- 每一步的读法：{ value, show, short? } 或 { error } ---------------- */
function obParseName(text) {
  const v = String(text == null ? '' : text).trim();
  if (!v || obIsWord(v, 'obSkip')) return { value: '', show: t('obNoName') };
  if (Array.from(v).length > OB_NAME_MAX) return { error: t('obNameTooLong') };
  return { value: v, show: v };
}

function obParseDate(text, calMode) {
  const r = parseBirthDate(text, { lunar: calMode === 'lunar' });
  if (r.error) return { error: r.error };
  /* 解析器只管写法和日历；引擎能排的范围更窄（例如 1900-01-31 以前），这一步就先验一遍 */
  const check = obChartOf(obInputOf({ date: r, time: { value: { h: 12, m: 0 } } }));
  if (check.error) return { error: check.error };
  return { value: r.value, show: r.show };
}

function obParseTime(text) {
  if (obIsWord(text, 'obUnsure')) return { error: t('birthTimeUnsure') };
  const r = parseBirthTime(text);
  if (r.error || !r.value) return { error: r.error || t('birthTimeUnreadable') };
  const out = { value: r.value, show: r.show, short: r.short || r.show };
  if (r.shichen) out.shichen = true;
  return out;
}

function obParseGender(text) {
  const v = String(text == null ? '' : text).trim().toLowerCase();
  /* 中文是一个字，句子里出现就算（男生、女生）；英文要整词相等（female 里有 male） */
  const hit = function (words) {
    return words.some(function (w) { return v === w || (w.length === 1 && v.indexOf(w) >= 0); });
  };
  if (!v) return { error: t('obGenderAsk') };
  if (hit(obWords('obFemale'))) return { value: 'female', show: t('obFemale') };
  if (hit(obWords('obMale'))) return { value: 'male', show: t('obMale') };
  return { error: t('obGenderAsk') };
}

function obParseCity(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw || obIsWord(raw, 'obSkip')) return { value: null, show: t('obNoCity') };
  const r = parseBirthplace(raw);
  if (r.kind === 'city') return { value: { lon: r.lon, place: r.city, text: raw }, show: r.city };
  if (r.kind === 'number') return { value: { lon: r.lon, place: '', text: raw }, show: t('obLonShow', { lon: r.lon }) };
  if (r.kind === 'province') return { error: t('obCityProvince', { province: r.province }), province: r.province };
  if (/^-?\d+(\.\d+)?$/.test(raw)) return { error: t('obLonRange') };
  return { error: t('obCityUnknown', { text: raw }) };
}

function obParse(key, text, calMode) {
  if (key === 'name') return obParseName(text);
  if (key === 'date') return obParseDate(text, calMode);
  if (key === 'time') return obParseTime(text);
  if (key === 'gender') return obParseGender(text);
  return obParseCity(text);
}

/* ---------------- reducer（纯函数） ----------------
 * action：{ type: 'start' } | { type: 'answer', text } | { type: 'editStep', step } | { type: 'setCalendar', mode }
 *       | { type: 'setSolar', on } | { type: 'restart' } | { type: 'cancel' } | { type: 'fail', error }
 * state 为 null 时按第 0 步算（start / cancel 除外）。cancel 返回 null。 */
/* 下一个状态：只带四个固定字段。province 是「刚答了省名」这一刻的事，任何变化之后都不留（要留的那一处自己加） */
function obNext(s, patch) {
  return Object.assign({ step: s.step, data: s.data, calMode: s.calMode, error: s.error }, patch || null);
}

function obReduce(state, action) {
  const a = action || {};
  if (a.type === 'start') return obFresh('solar');
  if (a.type === 'cancel') return null;
  const s = state || OB_IDLE;
  if (a.type === 'restart') return obFresh(s.calMode);
  if (a.type === 'setCalendar') {
    const mode = a.mode === 'lunar' ? 'lunar' : 'solar';
    return mode === s.calMode ? s : obNext(s, { calMode: mode });
  }
  if (a.type === 'setSolar') {
    const data = Object.assign({}, s.data);
    if (a.on === false) data.solar = { value: false, show: '' }; else delete data.solar;
    return obNext(s, { data: data });
  }
  if (a.type === 'editStep') {
    const i = Math.floor(+a.step);
    if (!(i >= 0 && i < OB_CONFIRM) || !(i <= s.step || s.data[OB_STEPS[i]])) return s;
    return obNext(s, { step: i, error: '' });
  }
  if (a.type === 'fail') return obNext(s, { error: String(a.error || '') });
  if (a.type !== 'answer') return s;
  if (s.step >= OB_CONFIRM) return obIsWord(a.text, 'obRestart') ? obFresh(s.calMode) : s;
  const key = OB_STEPS[s.step];
  const r = obParse(key, a.text, s.calMode);
  if (r.error) return obNext(s, r.province ? { error: r.error, province: r.province } : { error: r.error });
  const data = Object.assign({}, s.data);
  data[key] = r;
  /* 改前面的项时后面的答案留着：跳到下一个还没答的步，都答了就回到确认步 */
  let next = s.step + 1;
  while (next < OB_CONFIRM && data[OB_STEPS[next]]) next++;
  return { step: next, data: data, calMode: s.calMode, error: '' };
}

/* ---------------- 确认句 ----------------
 * { summary, shift, note, solar, error }：summary 是将要排的生辰（称呼、日期 时间、性别、城市）；
 * solar 是校正的状态：'none'（没填城市，没什么可校正的）/ 'on'（钟点 + 城市，校正着）/ 'off'（用户关掉了）/
 *   'shichen'（直接给的时辰，不校正，也没有开关）；
 * note 是说明校正情况的那句（solar 是 none 时没有）：校正着就写出校正后的钟点和时辰，关掉或时辰就写明不校正；
 * shift 在校正着、校正后的时辰（chart.timeName）和按钟表时间的不一样时才有（这时 note 就是它）；
 * error 是引擎排不出来的原因。 */
function obConfirmModel(data) {
  const d = data || {};
  const out = { summary: '', shift: '', note: '', solar: 'none', error: '' };
  if (!d.date || !d.time || !d.gender) return out;
  const parts = [];
  if (d.name && d.name.value) parts.push(String(d.name.value));
  parts.push(d.date.show + ' ' + (d.time.short || d.time.show));
  parts.push(d.gender.show);
  if (d.city && d.city.value) parts.push(d.city.show);
  out.summary = parts.join(t('obSep'));
  const input = obInputOf(d);
  const corrected = obChartOf(input);
  if (corrected.error) {
    out.error = corrected.error;
    return out;
  }
  const cv = d.city && d.city.value;
  if (!cv) return out;
  const clockText = obPad2(input.hour) + ':' + obPad2(input.minute);
  if (d.time.shichen) {
    out.solar = 'shichen';
    out.note = t('obShichenNote', { name: corrected.chart.timeName });
    return out;
  }
  if (d.solar && d.solar.value === false) {
    out.solar = 'off';
    out.note = t('obSolarOffNote', { clock: clockText, clockName: corrected.chart.timeName });
    return out;
  }
  const sc = corrected.chart.meta && corrected.chart.meta.solarCorrection;
  if (!sc) return out;
  out.solar = 'on';
  const clock = obChartOf(Object.assign({}, input, { longitude: '' }));
  const vars = {
    city: cv.place, lon: cv.lon, solar: sc.solarTime, corrected: corrected.chart.timeName,
    clock: clockText, clockName: clock.chart ? clock.chart.timeName : ''
  };
  if (clock.chart && clock.chart.timeName !== corrected.chart.timeName) {
    out.shift = t(cv.place ? 'obShiftCity' : 'obShiftLon', vars);
    out.note = out.shift;
  } else {
    out.note = t(cv.place ? 'obSameCity' : 'obSameLon', vars);
  }
  return out;
}

/* ---------------- 和 store 打交道 ---------------- */
function obStart() {
  return appStore().patchSession({ onboarding: obFresh('solar') });
}

/* 排盘：v5 形状的条目进命盘库（最前面），引导结束、聚焦新盘；不打开命盘。排不出来时留在这一步、写上原因，返回 null */
function obFinish() {
  const store = appStore();
  const ob = store.getState().session.onboarding;
  if (!ob) return null;
  const d = ob.data || {};
  if (!d.date || !d.time || !d.gender) return null;
  const input = obInputOf(d);
  const check = obChartOf(input);
  if (check.error) {
    store.patchSession({ onboarding: obReduce(ob, { type: 'fail', error: check.error }) });
    return null;
  }
  const entry = store.addChart(input, input.name);
  if (!entry) return null;
  store.patchSession({ onboarding: null, focusId: entry.id });
  return entry;
}

function onboardingSubmit(text) {
  const store = appStore();
  const cur = store.getState().session.onboarding || OB_IDLE;
  if (cur.step >= OB_CONFIRM && !obIsWord(text, 'obRestart')) {
    const entry = obFinish();
    if (entry) return { ok: true, error: '', entry: entry };
    const now = store.getState().session.onboarding;
    return { ok: false, error: (now && now.error) || '', entry: null };
  }
  const next = obReduce(cur, { type: 'answer', text: text });
  store.patchSession({ onboarding: next });
  return next.error ? { ok: false, error: next.error, entry: null } : { ok: true, error: '', entry: null };
}

/* ---------------- 界面 ---------------- */
function obSelectTalk(s) {
  return { ob: s.session.onboarding || null, empty: !s.library.length };
}

/* 状态句的内容（span 里的子节点） */
function obQuestion(step, data, model) {
  const d = data || {};
  const br = function (k) { return h('br', { key: k }); };
  const strong = function (s) { return h('strong', { key: 'q' }, s); };
  switch (OB_STEPS[step]) {
    case 'name': return [t('obAskNameIntro'), br('b1'), strong(t('obAskName'))];
    case 'date': return [d.name && d.name.value ? t('obAskDateTo', { name: d.name.value }) : null, strong(t('obAskDate')), br('b1'), t('obAskDateNote')];
    case 'time': return [strong(t('obAskTime')), br('b1'), t('obAskTimeNote')];
    case 'gender': return [strong(t('obAskGender'))];
    case 'city': return [strong(t('obAskCity')), br('b1'), t(d.time && d.time.shichen ? 'obAskCityNoteShichen' : 'obAskCityNote')];
    /* 校正说明用小字另起一行（small）：它是一句补充，和问题同样大会把对话栏顶得很高 */
    /* 这句生辰是一整句话，窄档里要能折行（.zp-status strong 默认不折行，那是给宫名、星名用的）：加 zp-wrap */
    default: return [t('obConfirmIntro'), br('b1'), h('strong', { key: 'q', className: 'zp-wrap' }, model ? model.summary : ''),
      model && model.note ? h('small', { key: 'shift' }, model.note) : null];
  }
}

/* 时辰的起止钟点：子时 23–1、丑时 1–3 …（和 23-birth 的 parseBirthTime 同一个写法；短横是 en dash） */
function obShichenRange(i) {
  return i === 0 ? '23\u20131' : (i * 2 - 1) + '\u2013' + (i * 2 + 1);
}

function OnboardingTalk(props) {
  const m = useStore(obSelectTalk);
  const ob = m.ob || OB_IDLE;
  const step = ob.step;
  const confirm = step >= OB_CONFIRM;
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const drawRef = useRef(null);
  const solarRef = useRef(null);
  const mounted = useRef(false);
  const active = !!m.ob;
  const model = useMemo(function () { return confirm ? obConfirmModel(ob.data) : null; }, [ob.data, confirm]);

  /* 答对、改已答项、切公历 / 农历之后焦点回到输入框（确认步到「排盘」）；空库自动进来的第一次挂载不抢焦点 */
  useEffect(function () {
    const first = !mounted.current;
    mounted.current = true;
    if (first && !active) return;
    const el = confirm ? drawRef.current : inputRef.current;
    if (el) focusQuietly(el);
  }, [step, ob.calMode]);

  const dispatch = function (action) {
    appStore().patchSession({ onboarding: obReduce(ob, action) });
  };
  const finishWith = function (entry) {
    if (!entry) return;
    setText('');
    if (typeof props.onDone === 'function') props.onDone(entry);
    else appStore().openChart(entry.id, { tab: 'natal', panel: true });
  };
  const answer = function (value) {
    const r = onboardingSubmit(value);
    if (r.ok) setText('');
    if (r.entry) finishWith(r.entry);
  };
  const chip = function (key, label, onClick, extra) {
    return h('button', Object.assign({ key: key, type: 'button', className: 'zp-chip', onClick: onClick }, extra || null), label);
  };

  const chips = [];
  const kind = OB_STEPS[step];
  if (kind === 'name') chips.push(chip('skip', t('obSkip'), function () { answer(t('obSkip')); }));
  if (kind === 'date') {
    [['solar', 'obSolar'], ['lunar', 'obLunar']].forEach(function (c) {
      const on = ob.calMode === c[0];
      chips.push(chip('cal-' + c[0], t(c[1]), function () { dispatch({ type: 'setCalendar', mode: c[0] }); },
        { className: 'zp-chip' + (on ? ' zp-on' : ''), 'aria-pressed': on ? 'true' : 'false' }));
    });
  }
  if (kind === 'time') {
    for (let i = 0; i < 12; i++) {
      const name = shichenOf(i * 2);
      chips.push(chip('tm-' + i, [name, h('small', { key: 'r' }, obShichenRange(i))], function () { answer(name); }));
    }
    chips.push(chip('unsure', t('obUnsure'), function () { answer(t('obUnsure')); }));
  }
  if (kind === 'gender') {
    chips.push(chip('male', t('obMale'), function () { answer(t('obMale')); }));
    chips.push(chip('female', t('obFemale'), function () { answer(t('obFemale')); }));
  }
  if (kind === 'city') {
    const inProvince = ob.province && CITY_TABLE[ob.province] ? Object.keys(CITY_TABLE[ob.province]) : null;
    if (inProvince) {
      /* 刚答了省名：给这个省的城市。带着省去答（青海的海南州单写「海南」是省） */
      inProvince.forEach(function (nm) { chips.push(chip('pcity-' + nm, nm, function () { answer(ob.province + nm); })); });
    } else {
      const values = obZhList('obQuickCities');
      const shown = String(t('obQuickCities')).split('|');
      const labels = shown.length === values.length ? shown : values;
      values.forEach(function (v, i) { chips.push(chip('city-' + i, labels[i], function () { answer(v); })); });
    }
    chips.push(chip('skip', t('obSkip'), function () { answer(t('obSkip')); }));
  }
  if (confirm) {
    chips.push(chip('draw', t('obDraw'), function () { finishWith(obFinish()); }, { className: 'zp-chip zp-primary', ref: drawRef }));
    /* 校正开关：钟点 + 城市时才有。两种状态是同一个按钮（key 不变），点完焦点还在它上面 */
    if (model && (model.solar === 'on' || model.solar === 'off')) {
      const turnOff = model.solar === 'on';
      chips.push(chip('solar', t(turnOff ? 'obSolarOff' : 'obSolarOn'), function () {
        dispatch({ type: 'setSolar', on: !turnOff });
        if (solarRef.current) focusQuietly(solarRef.current);
      }, { ref: solarRef }));
    }
    chips.push(chip('restart', t('obRestart'), function () { dispatch({ type: 'restart' }); }));
  }
  chips.push(chip('form', t('obForm'), function () { openSheet('birth'); }));
  if (m.empty) chips.push(chip('sample', t('obSample'), function () { appStore().openSample(); }));
  else chips.push(chip('cancel', t('obCancel'), function () { dispatch({ type: 'cancel' }); }));

  const msg = ob.error || (model && model.error) || '';
  return [
    h('h1', { key: 'status', className: 'zp-status' }, h('span', { key: 'q' + step }, obQuestion(step, ob.data, model))),
    h('div', { key: 'receipts', className: 'zp-receipts' },
      OB_STEPS.slice(0, OB_CONFIRM).map(function (k, i) {
        const a = ob.data[k];
        if (!a || i === step) return null;
        return h('button', {
          key: k, type: 'button', className: 'zp-receipt', title: t('obEditItem'),
          onClick: function () { dispatch({ type: 'editStep', step: i }); }
        }, t(OB_ITEM_KEYS[k]), ' ', h('b', null, a.show));
      })),
    h('form', {
      key: 'ask', className: 'zp-ask',
      onSubmit: function (ev) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        if (!confirm) answer(text);
      }
    },
    h('input', {
      ref: inputRef, type: 'text', value: text, autoComplete: 'off',
      placeholder: t(OB_PLACEHOLDER_KEYS[step]), 'aria-label': t(OB_ASK_KEYS[step]), disabled: confirm ? true : undefined,
      onChange: function (ev) { setText(ev.target.value); }
    }),
    h('button', {
      className: 'zp-send', type: 'submit', title: t('obSend'), 'aria-label': t('obSend'), disabled: confirm ? true : undefined
    }, h(Icon, { name: 'send' }))),
    h('p', { key: 'hint', className: 'zp-hint' + (msg ? ' zp-err' : ''), 'aria-live': 'polite' }, msg),
    h('div', { key: 'chips', className: 'zp-chips' }, chips)
  ];
}

ZWUI.onboarding = {
  reduce: obReduce, start: obStart, confirmModel: obConfirmModel, inputOf: obInputOf,
  finish: obFinish, submit: onboardingSubmit, OnboardingTalk: OnboardingTalk
};
