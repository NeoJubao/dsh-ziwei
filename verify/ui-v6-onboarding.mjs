/**
 * verify/ui-v6-onboarding.mjs — 引导问答、生辰表单、全部命盘（T8b：62-onboarding.js、64-sheets.js）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。覆盖：
 *   - 源码约束：两个文件注释以外没有中文字面量、顶层名字带本任务前缀、没有 setInterval(
 *   - 引导的 reducer（ZWUi.onboarding.reduce）：六步走完；读不懂的答案留在原步并给出解析器的说明；
 *     改已答项回到那一步、后面的答案保留；农历开关；"不确定"不前进；称呼、性别、城市的读法
 *   - 确认句（ZWUi.onboarding.confirmModel）：真太阳时校正让时辰变了时明说
 *     （黄金用例 09:30 @105.97 → 08:37 辰时），没变或没填经度时不说
 *   - 完成（finish / submit）：命盘库最前面多一条 v5 形状的条目（id = lib-<毫秒>、input.isLeap、
 *     DEFAULT_FORM 的口径），不自己打开命盘；排不出来的生辰留在原步并说明原因
 *   - OnboardingTalk（极简 React 运行时）：结构和顺序、每一步的 chip、已答项可点回去、输入框、焦点、排盘后交给 onDone
 *   - SheetHost：生辰表单（新建 / 改生辰、草稿、农历、闰月、四项口径、职业、每个控件有名字、出错留在表单里）
 *     和全部命盘（顺序、打开、改名 12 字、删除二次确认 + 撤销、空库一句话）
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）和它的明显合成变体。"今天"固定为 2026-11-19。
 */
import { readUiSources } from '../build.mjs';
import { bootRuntime, classesOf, find, findByClass, memoryStorage, text } from './client-harness.mjs';

const SETTINGS = { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true };
const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '', settings: SETTINGS
};
const GOLDEN_F = Object.assign({}, GOLDEN, { gender: 'female' });
const GOLDEN_D2 = Object.assign({}, GOLDEN, { day: 2 });
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const V5_INPUT_KEYS = ['name', 'calendar', 'year', 'month', 'day', 'isLeap', 'hour', 'minute', 'gender', 'longitude', 'city', 'place', 'occupation', 'settings'];
const J = (v) => JSON.stringify(v);

const attr = (el, k) => (el && el.props ? el.props[k] : undefined);
const isEl = (n) => !!n && typeof n === 'object' && !Array.isArray(n) && 'type' in n;
const flat = (x) => [x].flat(Infinity).filter(isEl);
const byText = (tree, type, label) => find(tree, (n) => n.type === type && (attr(n, 'aria-label') === label || text(n) === label))[0] || null;
const btn = (tree, label) => byText(tree, 'button', label);
const inputByLabel = (tree, label) => find(tree, (n) => n.type === 'input' && attr(n, 'aria-label') === label)[0] || null;
const fieldOf = (tree, label) => find(tree, (n) => n.type === 'div' && classesOf(n).includes('zp-field') && find(n, (m) => attr(m, 'aria-label') === label).length > 0)[0] || null;
/* 表单里的选项是单选组（radiogroup > radio[aria-checked]），不是切换视图的页签 */
const tablist = (tree, label) => find(tree, (n) => attr(n, 'role') === 'radiogroup' && attr(n, 'aria-label') === label)[0] || null;
const unnamedButtons = (tree) => find(tree, (n) => n.type === 'button' && !attr(n, 'aria-label') && !text(n).trim()).length;
const unnamedControls = (tree) => find(tree, (n) => ['input', 'select', 'textarea'].includes(n.type) && !attr(n, 'aria-label') && !attr(n, 'aria-labelledby')).length;

export default async function onboardingChecks(t) {
  const { ok, section } = t;
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);
  const safe = (name, fn) => { try { return fn(); } catch (e) { ok(name, false, 'threw: ' + String((e && e.stack) || e).split('\n').slice(0, 4).join(' | ')); return undefined; } };

  /* ---------------------------------------------------------------- */
  section('v6 引导与浮层（T8b）：源码约束');
  let sources = null;
  try { sources = readUiSources(t.root); } catch { sources = null; }
  const mine = ((sources && sources.js) || []).filter((f) => f.name === '62-onboarding.js' || f.name === '64-sheets.js');
  ok('62-onboarding.js 和 64-sheets.js 都在', mine.length === 2);
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  for (const f of mine) {
    const code = stripComments(f.text);
    const cjk = code.match(/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/g) || [];
    ok(`${f.name}：注释以外没有中文字面量`, cjk.length === 0, cjk.slice(0, 10).join(''));
    ok(`${f.name}：没有 setInterval(`, !code.includes('setInterval('));
    const tops = [...code.matchAll(/^(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    const bad = tops.filter((n) => !/^(Onboarding|Sheet|BirthForm|ChartList|ob|sheet|OB_|SHEET_|onboardingSubmit$)/.test(n));
    ok(`${f.name}：顶层名字都带本任务前缀（${tops.length} 个）`, tops.length > 0 && bad.length === 0, 'bad: ' + bad.join(', '));
  }

  /* ---------------------------------------------------------------- */
  section('v6 引导与浮层（T8b）：装载');
  const storage1 = memoryStorage();
  const env = t.client ? bootRuntime(t.client, { now: NOW, storage: storage1 }) : { error: new Error('没有 v6 bundle') };
  ok('v6 bundle 在运行时里装载、建默认 store', !env.error, env.error && env.error.message);
  if (env.error) return;
  const { rt, store, h, win } = env;
  const OB = (win.ZWUi && win.ZWUi.onboarding) || {};
  const SH = (win.ZWUi && win.ZWUi.sheets) || {};
  const obFns = ['reduce', 'start', 'confirmModel', 'inputOf', 'finish', 'submit', 'OnboardingTalk'];
  const shFns = ['SheetHost', 'BirthFormSheet', 'ChartListSheet'];
  const missOb = obFns.filter((k) => typeof OB[k] !== 'function');
  const missSh = shFns.filter((k) => typeof SH[k] !== 'function');
  ok('ZWUi.onboarding 暴露 reduce / start / confirmModel / inputOf / finish / submit / OnboardingTalk', missOb.length === 0, 'missing: ' + missOb.join(', '));
  ok('ZWUi.sheets 暴露 SheetHost / BirthFormSheet / ChartListSheet', missSh.length === 0, 'missing: ' + missSh.join(', '));
  if (missOb.length || missSh.length) return;
  const DEFAULT_SETTINGS = win.ZWUi.DEFAULT_FORM.settings;

  /* ---------------------------------------------------------------- */
  section('v6 引导：reducer');
  const R = OB.reduce;
  const A = (s, text) => R(s, { type: 'answer', text });
  let s0, s5;
  safe('reducer 六步', () => {
    s0 = R(null, { type: 'start' });
    eq('start：第 0 步、没有答案、公历、没有提示', s0, { step: 0, data: {}, calMode: 'solar', error: '' });
    const s1 = A(s0, '甲');
    eq('称呼「甲」→ 第 1 步（生日）', [s1.step, s1.data.name, s1.error], [1, { value: '甲', show: '甲' }, '']);
    const s2 = A(s1, '1992年5月3日');
    eq('生日「1992年5月3日」→ 第 2 步，公历', [s2.step, s2.data.date], [2, { value: { lunar: false, y: 1992, m: 5, d: 3, leap: false }, show: '1992年5月3日' }]);
    const s3 = A(s2, '09:30');
    eq('时间「09:30」→ 第 3 步', [s3.step, s3.data.time], [3, { value: { h: 9, m: 30 }, show: '09:30（巳时）', short: '09:30 巳时' }]);
    const s4 = A(s3, '男');
    eq('性别「男」→ 第 4 步', [s4.step, s4.data.gender], [4, { value: 'male', show: '男' }]);
    s5 = A(s4, '105.97');
    eq('城市「105.97」→ 第 5 步（确认）', [s5.step, s5.data.city], [5, { value: { lon: 105.97, place: '', text: '105.97' }, show: '东经 105.97°' }]);
    eq('前面的答案一路都在', Object.keys(s5.data), ['name', 'date', 'time', 'gender', 'city']);
    eq('reducer 是纯的：不改传进来的状态', s0, { step: 0, data: {}, calMode: 'solar', error: '' });
  });

  safe('reducer 读不懂', () => {
    const s1 = R(s0, { type: 'editStep', step: 0 });
    const d1 = A(A(s0, '甲'), '1992年13月3日');
    eq('生日「1992年13月3日」：留在第 1 步，给出解析器的说明', [d1.step, d1.error, 'date' in d1.data], [1, '月份要在 1 到 12 之间', false]);
    const d2 = A(A(s0, '甲'), '明天');
    eq('读不懂的日期：带例子的提示', [d2.step, d2.error], [1, '没读懂这个日期。试试「1990年6月15日」或「农历1990年五月廿三」']);
    const d3 = A(A(s0, '甲'), '1991年2月29日');
    eq('不存在的日期：说明原因', [d3.step, d3.error], [1, '1991年2月没有29日']);
    const d4 = A(d1, '1992年5月3日');
    eq('改对之后提示清掉、前进', [d4.step, d4.error], [2, '']);
    eq('editStep(0) 在第 0 步：还在第 0 步', s1.step, 0);
    const n1 = A(s0, '一二三四五六七八九十甲乙丙');
    eq('称呼超过 12 个字：留在第 0 步', [n1.step, n1.error], [0, '称呼短一点，12 个字以内']);
    const n2 = A(s0, '');
    const n3 = A(s0, '跳过');
    const n4 = A(s0, 'Skip');
    eq('称呼空着、写「跳过」或 Skip：记成未填称呼、前进', [n2.step, n2.data.name, n3.data.name, n4.data.name],
      [1, { value: '', show: '未填称呼' }, { value: '', show: '未填称呼' }, { value: '', show: '未填称呼' }]);
    const g0 = R(Object.assign({}, s5, { step: 3 }), { type: 'answer', text: '嗯' });
    eq('性别读不懂：留在第 3 步', [g0.step, g0.error], [3, '点一下「男」或「女」']);
    const g1 = A(Object.assign({}, s5, { step: 3 }), '女生');
    const g2 = A(Object.assign({}, s5, { step: 3 }), 'Female');
    const g3 = A(Object.assign({}, s5, { step: 3 }), 'male');
    eq('性别：女生 → female，Female → female，male → male', [g1.data.gender.value, g2.data.gender.value, g3.data.gender.value], ['female', 'female', 'male']);
    const c0 = A(Object.assign({}, s5, { step: 4 }), '火星');
    eq('查不到的城市：留在第 4 步，说可以换写法、填经度或跳过', [c0.step, c0.error], [4, '没找到「火星」。换个写法，或直接填经度（如 116.4）；也可以跳过']);
    const c1 = A(Object.assign({}, s5, { step: 4 }), '200');
    eq('经度超出范围：说明范围', [c1.step, c1.error], [4, '经度要在 60 到 140 之间']);
    const c2 = A(Object.assign({}, s5, { step: 4 }), '四川成都');
    eq('省 + 市：成都，东经 104.1', [c2.step, c2.data.city], [5, { value: { lon: 104.1, place: '成都', text: '四川成都' }, show: '成都' }]);
    const c3 = A(Object.assign({}, s5, { step: 4 }), '跳过');
    eq('城市跳过：value 为 null', [c3.step, c3.data.city], [5, { value: null, show: '未填出生地' }]);
    const c4 = A(Object.assign({}, s5, { step: 4 }), '东经105.97°');
    eq('东经105.97°：按经度读', c4.data.city, { value: { lon: 105.97, place: '', text: '东经105.97°' }, show: '东经 105.97°' });
  });

  safe('reducer 改已答项', () => {
    const e1 = R(s5, { type: 'editStep', step: 1 });
    eq('确认步点「生日」：回到第 1 步，后面的答案都还在', [e1.step, Object.keys(e1.data)], [1, ['name', 'date', 'time', 'gender', 'city']]);
    const e2 = A(e1, '1992年5月4日');
    eq('改完生日：跳过已答的步，直接回到确认步', [e2.step, e2.data.date.show, e2.data.time.short, e2.data.gender.value, e2.data.city.show],
      [5, '1992年5月4日', '09:30 巳时', 'male', '东经 105.97°']);
    const e3 = R(Object.assign({}, s5, { step: 2, data: { name: s5.data.name, date: s5.data.date, city: s5.data.city } }), { type: 'answer', text: '辰时' });
    eq('后面有没答的步：停在第一个没答的步（性别）', [e3.step, e3.data.time.value], [3, { h: 8, m: 0 }]);
    const e4 = R(s5, { type: 'editStep', step: 9 });
    eq('editStep 超出范围：不动', e4.step, 5);
    eq('editStep 清掉提示', R(Object.assign({}, s5, { error: 'x' }), { type: 'editStep', step: 2 }).error, '');
  });

  safe('reducer 农历开关', () => {
    const atDate = A(s0, '甲');
    const lun = R(atDate, { type: 'setCalendar', mode: 'lunar' });
    eq('setCalendar(lunar)：calMode 变成 lunar，留在生日这步', [lun.calMode, lun.step], ['lunar', 1]);
    const a1 = A(lun, '1990年五月廿三');
    eq('农历开关下「1990年五月廿三」按农历读', a1.data.date, { value: { lunar: true, y: 1990, m: 5, d: 23, leap: false }, show: '农历1990年五月廿三' });
    const a2 = A(lun, '1990-5-23');
    eq('农历开关下数字写法也按农历读（1990-5-23 → 农历五月廿三）', a2.data.date.value, { lunar: true, y: 1990, m: 5, d: 23, leap: false });
    const a3 = A(atDate, '1990-5-23');
    eq('公历开关下 1990-5-23 是公历', a3.data.date.value, { lunar: false, y: 1990, m: 5, d: 23, leap: false });
    const a4 = A(lun, '1990年闰五月初一');
    eq('农历闰月：1990年闰五月初一', a4.data.date, { value: { lunar: true, y: 1990, m: 5, d: 1, leap: true }, show: '农历1990年闰五月初一' });
    const a5 = A(lun, '1991年闰五月初一');
    eq('没有的闰月：说明原因', [a5.step, a5.error], [1, '1991 年没有闰五月']);
    eq('setCalendar(solar) 换回公历', R(lun, { type: 'setCalendar', mode: 'solar' }).calMode, 'solar');
  });

  safe('reducer 不确定', () => {
    const atTime = Object.assign({}, s5, { step: 2, data: { name: s5.data.name, date: s5.data.date } });
    for (const word of ['不确定', '不知道', 'Not sure']) {
      const u = A(atTime, word);
      eq(`时间「${word}」：不前进、不替用户选时辰，提示时辰决定命宫`, [u.step, 'time' in u.data, u.error], [2, false, '时辰决定命宫，请选一个最可能的时辰']);
    }
    const ok1 = A(atTime, '下午三点半');
    eq('时间「下午三点半」→ 15:30 申时', [ok1.step, ok1.data.time.value, ok1.data.time.short], [3, { h: 15, m: 30 }, '15:30 申时']);
    const bad = A(atTime, '大概早上');
    eq('读不懂的时间：留在第 2 步', [bad.step, bad.error], [2, '没读懂这个时间。试试「15:30」「下午三点半」，或点一个时辰']);
  });

  safe('reducer 重来与取消', () => {
    eq('restart：回到第 0 步、清空答案、保留公历 / 农历开关', R(Object.assign({}, s5, { calMode: 'lunar' }), { type: 'restart' }), { step: 0, data: {}, calMode: 'lunar', error: '' });
    eq('确认步回答「重新填」等于 restart', [A(s5, '重新填').step, J(A(s5, '重新填').data)], [0, '{}']);
    eq('cancel → null（引导结束）', R(s5, { type: 'cancel' }), null);
    eq('answer 在没开始时（null）：从第 0 步算', A(null, '甲').step, 1);
  });

  /* ---------------------------------------------------------------- */
  section('v6 引导：确认句');
  safe('确认句', () => {
    const m = OB.confirmModel(s5.data);
    eq('黄金用例：将要排的生辰', m.summary, '甲，1992年5月3日 09:30 巳时，男，东经 105.97°');
    eq('黄金用例（09:30 @ 东经 105.97）：明说校正后落在辰时', m.shift, '按东经 105.97° 校正后是 08:37，落在辰时（钟表时间 09:30 是巳时）');
    eq('能排：没有错误', m.error, '');
    const noCity = Object.assign({}, s5.data, { city: { value: null, show: '未填出生地' } });
    const m2 = OB.confirmModel(noCity);
    eq('没填出生城市：不提校正', [m2.summary, m2.shift], ['甲，1992年5月3日 09:30 巳时，男', '']);
    const bj = Object.assign({}, s5.data, { city: { value: { lon: 116.4, place: '北京', text: '北京' }, show: '北京' } });
    eq('北京（09:19 仍是巳时）：时辰没变，不提', OB.confirmModel(bj).shift, '');
    const cd = Object.assign({}, s5.data, { city: { value: { lon: 104.1, place: '成都', text: '成都' }, show: '成都' } });
    eq('成都（08:30 辰时）：按城市名说', OB.confirmModel(cd).shift, '按成都（东经 104.1°）校正后是 08:30，落在辰时（钟表时间 09:30 是巳时）');
    const noName = Object.assign({}, s5.data, { name: { value: '', show: '未填称呼' } });
    eq('没填称呼：句子里不写', OB.confirmModel(noName).summary, '1992年5月3日 09:30 巳时，男，东经 105.97°');
    const bad = Object.assign({}, s5.data, { date: { value: { lunar: false, y: 1900, m: 1, d: 15, leap: false }, show: '1900年1月15日' } });
    eq('排不出来的生辰：带上引擎的原因', OB.confirmModel(bad).error, '这个生辰排不出来：公历日期需在 1900-01-31 至 2100-12-31 之间');
  });

  safe('inputOf', () => {
    eq('inputOf：v5 的 input 字段，口径取 DEFAULT_FORM', OB.inputOf(s5.data), {
      name: '甲', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
      longitude: '105.97', city: '105.97', place: '', occupation: '', settings: DEFAULT_SETTINGS
    });
    eq('DEFAULT_FORM 的口径就是 v5 的那四项', DEFAULT_SETTINGS, SETTINGS);
  });

  /* ---------------------------------------------------------------- */
  section('v6 引导：完成');
  safe('submit 一路走到完成', () => {
    eq('开始前：命盘库是空的、session.onboarding 是 null', [store.getState().library.length, store.getState().session.onboarding], [0, null]);
    const r0 = OB.submit('甲');
    eq('submit 在没开始时也能用（从第 0 步算）：ok', [r0.ok, store.getState().session.onboarding.step], [true, 1]);
    const r1 = OB.submit('1992年13月3日');
    eq('submit 读不懂：ok=false，带说明，留在原步', [r1.ok, r1.error, store.getState().session.onboarding.step, store.getState().session.onboarding.error],
      [false, '月份要在 1 到 12 之间', 1, '月份要在 1 到 12 之间']);
    const r1b = OB.submit('1900年1月15日');
    eq('生辰排不出来（1900-01-15）：留在生日这步并说明原因', [r1b.ok, store.getState().session.onboarding.step, r1b.error],
      [false, 1, '这个生辰排不出来：公历日期需在 1900-01-31 至 2100-12-31 之间']);
    OB.submit('1992年5月3日');
    const rU = OB.submit('不确定');
    eq('submit「不确定」：ok=false，不前进', [rU.ok, store.getState().session.onboarding.step], [false, 2]);
    OB.submit('09:30');
    OB.submit('男');
    OB.submit('105.97');
    eq('走到确认步', store.getState().session.onboarding.step, 5);
    eq('还没排盘：命盘库仍是空的', store.getState().library.length, 0);
    const entry = OB.finish();
    const lib = store.getState().library;
    ok('finish 返回新条目，id 形如 lib-<毫秒>', !!entry && /^lib-\d+$/.test(entry.id), entry && entry.id);
    eq('命盘库最前面是它', [lib.length, lib[0] && lib[0].id], [1, entry && entry.id]);
    eq('条目的 input 是 v5 的字段和顺序', Object.keys(lib[0].input), V5_INPUT_KEYS);
    eq('条目的 input 值', lib[0].input, {
      name: '甲', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
      longitude: '105.97', city: '105.97', place: '', occupation: '', settings: SETTINGS
    });
    eq('盘名是称呼', lib[0].name, '甲');
    const saved = JSON.parse(storage1.getItem('ziwei-pro.library') || '[]');
    eq('写进了 ziwei-pro.library（v5 的键）', [saved.length, saved[0] && saved[0].id, saved[0] && saved[0].input.isLeap], [1, entry && entry.id, false]);
    const ss = store.getState().session;
    eq('完成后：引导结束、聚焦新盘，但不自己打开命盘', [ss.onboarding, ss.focusId, ss.view], [null, entry && entry.id, 'home']);
    eq('finish 在没有引导时：返回 null', OB.finish(), null);
  });

  safe('第二张盘排在最前', () => {
    OB.start();
    eq('start()：session.onboarding 回到第 0 步', store.getState().session.onboarding, { step: 0, data: {}, calMode: 'solar', error: '' });
    for (const a of ['', '1992-5-3', '辰时', '女', '跳过']) OB.submit(a);
    const r = OB.submit('排盘');
    const lib = store.getState().library;
    eq('确认步 submit：完成，返回 { ok, entry }', [r.ok, !!r.entry, lib.length, lib[0].id === (r.entry && r.entry.id)], [true, true, 2, true]);
    eq('没填称呼、没填城市：自动盘名，经度空', [lib[0].name, lib[0].input.longitude, lib[0].input.city, lib[0].input.hour, lib[0].input.minute],
      ['1992-05-03 辰时 女', '', '', 8, 0]);
  });

  safe('排不出来时留在确认步', () => {
    const bad = Object.assign({}, s5, { data: Object.assign({}, s5.data, { date: { value: { lunar: false, y: 1900, m: 1, d: 15, leap: false }, show: '1900年1月15日' } }) });
    store.patchSession({ onboarding: bad });
    const before = store.getState().library.length;
    const entry = OB.finish();
    const ob = store.getState().session.onboarding;
    eq('finish 返回 null、留在确认步、带引擎的原因、命盘库没变',
      [entry, ob && ob.step, ob && ob.error, store.getState().library.length],
      [null, 5, '这个生辰排不出来：公历日期需在 1900-01-31 至 2100-12-31 之间', before]);
    const r = OB.submit('排盘');
    eq('submit 同样：ok=false', [r.ok, r.error], [false, '这个生辰排不出来：公历日期需在 1900-01-31 至 2100-12-31 之间']);
    store.patchSession({ onboarding: null });
  });

  /* ---------------------------------------------------------------- */
  section('v6 引导：OnboardingTalk');
  const done = [];
  const Col = (props) => h('div', { className: 'zp-col' }, h(OB.OnboardingTalk, Object.assign({ tier: 'wide' }, props)));
  const col = () => findByClass(rt.tree(), 'zp-col')[0];
  const chips = () => findByClass(col(), 'zp-chip').map((n) => text(n));
  const askInput = () => find(col(), (n) => n.type === 'input')[0];
  const askForm = () => find(col(), (n) => n.type === 'form')[0];
  const typeInto = (el, value) => { el.props.onChange({ target: { value } }); rt.flush(); };
  const submitForm = () => { askForm().props.onSubmit({ preventDefault() {} }); rt.flush(); };

  safe('结构', () => {
    OB.start();
    rt.mount(h(Col, { onDone: (e) => done.push(e) }));
    const kids = flat(col().children);
    eq('一列里依次是 h1.zp-status、div.zp-receipts、form.zp-ask、p.zp-hint、div.zp-chips（不包一层）',
      kids.map((n) => n.type + '.' + classesOf(n)[0]), ['h1.zp-status', 'div.zp-receipts', 'form.zp-ask', 'p.zp-hint', 'div.zp-chips']);
    const st = kids[0];
    ok('状态句在 span 里（入场动画的规则作用在 .zp-status > span 上）', flat(st.children).length === 1 && flat(st.children)[0].type === 'span');
    eq('第 0 步的问题', text(st), '我是紫微师。先说说，怎么称呼你？');
    const form = kids[2];
    const inputs = find(form, (n) => n.type === 'input');
    const send = findByClass(form, 'zp-send')[0];
    eq('form.zp-ask 里一个 input 和 button.zp-send', [inputs.length, !!send, attr(send, 'type')], [1, true, 'submit']);
    ok('输入框有名字和占位文字', !!attr(inputs[0], 'aria-label') && attr(inputs[0], 'placeholder') === '称呼，比如 小林', J([attr(inputs[0], 'aria-label'), attr(inputs[0], 'placeholder')]));
    eq('提示行 aria-live=polite', attr(kids[3], 'aria-live'), 'polite');
    eq('命盘库有盘时第 0 步的 chip：跳过、直接填表、取消（没有看示例盘）', chips(), ['跳过', '直接填表', '取消']);
    eq('每个按钮有文字或 aria-label', unnamedButtons(col()), 0);
    eq('每个输入框有名字', unnamedControls(col()), 0);
  });

  safe('输入与焦点', () => {
    typeInto(askInput(), '一二三四五六七八九十甲乙丙');
    submitForm();
    eq('读不懂（太长）：提示行带 zp-err 和说明，输入框里的字不清空',
      [classesOf(findByClass(col(), 'zp-hint')[0]).includes('zp-err'), text(findByClass(col(), 'zp-hint')[0]), attr(askInput(), 'value')],
      [true, '称呼短一点，12 个字以内', '一二三四五六七八九十甲乙丙']);
    rt.doc.activeElement = rt.doc.body;
    typeInto(askInput(), '乙');
    submitForm();
    eq('答对：前进到生日、输入框清空、提示清掉', [store.getState().session.onboarding.step, attr(askInput(), 'value'), text(findByClass(col(), 'zp-hint')[0])], [1, '', '']);
    ok('答对之后焦点回到输入框（effect 里做）', rt.doc.activeElement === askInput().node);
    eq('生日这步的问题带称呼', text(findByClass(col(), 'zp-status')[0]), '乙，哪天出生的？公历、农历都可以。');
    eq('已答项：button.zp-receipt「称呼 乙」', findByClass(col(), 'zp-receipt').map((n) => [n.type, text(n)]), [['button', '称呼 乙']]);
    eq('生日这步的 chip：公历、农历、直接填表、取消', chips(), ['公历', '农历', '直接填表', '取消']);
    const solar = btn(col(), '公历');
    const lunar = btn(col(), '农历');
    eq('公历开着：zp-on + aria-pressed', [classesOf(solar).includes('zp-on'), attr(solar, 'aria-pressed'), attr(lunar, 'aria-pressed')], [true, 'true', 'false']);
    rt.click(lunar);
    eq('点农历：calMode = lunar，农历亮起', [store.getState().session.onboarding.calMode, attr(btn(col(), '农历'), 'aria-pressed')], ['lunar', 'true']);
    rt.click(btn(col(), '公历'));
  });

  safe('各步的 chip', () => {
    OB.submit('1992年5月3日');
    rt.flush();
    const tc = findByClass(col(), 'zp-chip');
    eq('时间这步：十二时辰（带起止钟点）+ 不确定 + 直接填表 + 取消', tc.map((n) => text(n)), [
      '子时23–1', '丑时1–3', '寅时3–5', '卯时5–7', '辰时7–9', '巳时9–11', '午时11–13', '未时13–15', '申时15–17', '酉时17–19', '戌时19–21', '亥时21–23',
      '不确定', '直接填表', '取消']);
    eq('起止钟点放在 small 里', find(tc[0], (n) => n.type === 'small').map(text), ['23–1']);
    rt.click(btn(col(), '不确定'));
    const hint = findByClass(col(), 'zp-hint')[0];
    eq('点不确定：不前进，提示时辰决定命宫（zp-err）', [store.getState().session.onboarding.step, text(hint), classesOf(hint).includes('zp-err')],
      [2, '时辰决定命宫，请选一个最可能的时辰', true]);
    rt.click(find(col(), (n) => n.type === 'button' && text(n) === '巳时9–11')[0]);
    eq('点巳时：前进到性别，时间记成巳时', [store.getState().session.onboarding.step, store.getState().session.onboarding.data.time.value], [3, { h: 10, m: 0 }]);
    eq('性别这步：男、女、直接填表、取消', chips(), ['男', '女', '直接填表', '取消']);
    rt.click(btn(col(), '男'));
    eq('城市这步：常用城市 + 跳过 + 直接填表 + 取消', chips(), ['北京', '上海', '广州', '深圳', '成都', '杭州', '武汉', '西安', '跳过', '直接填表', '取消']);
    rt.click(btn(col(), '成都'));
    const ob = store.getState().session.onboarding;
    eq('点成都：到确认步，经度 104.1', [ob.step, ob.data.city.value], [5, { lon: 104.1, place: '成都', text: '成都' }]);
  });

  safe('确认步', () => {
    const c = chips();
    eq('确认步的 chip：排盘、重新填、直接填表、取消', c, ['排盘', '重新填', '直接填表', '取消']);
    const draw = btn(col(), '排盘');
    eq('排盘是 zp-chip zp-primary', classesOf(draw), ['zp-chip', 'zp-primary']);
    eq('输入框和发送按钮在确认步禁用', [!!attr(askInput(), 'disabled'), !!attr(findByClass(col(), 'zp-send')[0], 'disabled')], [true, true]);
    eq('状态句：将要排的生辰（巳时 10:00 @ 成都校正后 09:20 仍是巳时：不提校正）',
      text(findByClass(col(), 'zp-status')[0]), '好，我来排这张盘：乙，1992年5月3日 巳时，男，成都');
    eq('五个已答项都能点', findByClass(col(), 'zp-receipt').map(text), ['称呼 乙', '生日 1992年5月3日', '时间 巳时', '性别 男', '城市 成都']);
    rt.doc.activeElement = rt.doc.body;
    rt.click(findByClass(col(), 'zp-receipt')[1]);
    eq('点「生日」：回到生日这步，后面的答案都在', [store.getState().session.onboarding.step, Object.keys(store.getState().session.onboarding.data)],
      [1, ['name', 'date', 'time', 'gender', 'city']]);
    ok('改已答项之后焦点在输入框', rt.doc.activeElement === askInput().node);
    eq('改生日时其余已答项都还在（称呼、时间、性别、城市）', findByClass(col(), 'zp-receipt').map(text), ['称呼 乙', '时间 巳时', '性别 男', '城市 成都']);
    typeInto(askInput(), '1992年5月3日');
    submitForm();
    eq('改完回到确认步', store.getState().session.onboarding.step, 5);
    rt.click(find(col(), (n) => n.type === 'button' && text(n) === '时间 巳时')[0]);
    eq('点「时间」：回到时间这步', store.getState().session.onboarding.step, 2);
    typeInto(askInput(), '09:30');
    submitForm();
    eq('换成 09:30 + 成都：状态句明说校正后落在辰时', text(findByClass(col(), 'zp-status')[0]),
      '好，我来排这张盘：乙，1992年5月3日 09:30 巳时，男，成都按成都（东经 104.1°）校正后是 08:30，落在辰时（钟表时间 09:30 是巳时）');
    ok('确认步焦点在「排盘」上', rt.doc.activeElement === btn(col(), '排盘').node);
    const before = store.getState().library.length;
    rt.click(btn(col(), '排盘'));
    const lib = store.getState().library;
    eq('点排盘：命盘库多一条、引导结束、交给 onDone（带新条目）',
      [lib.length, store.getState().session.onboarding, done.length, done[0] && done[0].id === lib[0].id],
      [before + 1, null, 1, true]);
    eq('点排盘不自己打开命盘（交给首页）', store.getState().session.view, 'home');
    rt.unmount();
  });

  safe('没有 onDone 时自己打开', () => {
    OB.start();
    for (const a of ['', '1992-5-3', '09:30', '男', '105.97']) OB.submit(a);
    rt.mount(h(Col, {}));
    rt.click(btn(col(), '排盘'));
    const ss = store.getState().session;
    eq('没有 onDone：打开新盘的本命，紫微师面板打开', [ss.view, ss.chartId === store.getState().library[0].id, ss.tab, ss.panelOpen], ['chart', true, 'natal', true]);
    rt.unmount();
    store.goHome();
    store.setPanel(false);
  });

  safe('取消、直接填表、重新填', () => {
    OB.start();
    rt.mount(h(Col, {}));
    rt.click(btn(col(), '直接填表'));
    eq('直接填表：打开生辰浮层（新建）', [store.getState().session.sheet, store.getState().session.sheetChartId], ['birth', null]);
    store.patchSession({ sheet: null });
    for (const a of ['', '1992-5-3', '09:30', '男']) OB.submit(a);
    rt.flush();
    rt.click(btn(col(), '跳过'));
    rt.click(btn(col(), '重新填'));
    eq('重新填：回到第 0 步、清空', [store.getState().session.onboarding.step, J(store.getState().session.onboarding.data)], [0, '{}']);
    rt.click(btn(col(), '取消'));
    eq('取消：session.onboarding = null', store.getState().session.onboarding, null);
    rt.unmount();
  });

  /* 空命盘库：没开始也显示第 0 步，有看示例盘、没有取消 */
  safe('空命盘库', () => {
    const env2 = bootRuntime(t.client, { now: NOW, storage: memoryStorage() });
    const OB2 = env2.win.ZWUi.onboarding;
    env2.rt.mount(env2.h('div', { className: 'zp-col' }, env2.h(OB2.OnboardingTalk, { tier: 'narrow' })));
    const c2 = () => findByClass(env2.rt.tree(), 'zp-col')[0];
    eq('空命盘库、session.onboarding 为 null：显示第 0 步', text(findByClass(c2(), 'zp-status')[0]), '我是紫微师。先说说，怎么称呼你？');
    eq('空命盘库的 chip：跳过、直接填表、看示例盘（没有取消）', findByClass(c2(), 'zp-chip').map(text), ['跳过', '直接填表', '看示例盘']);
    ok('挂载时不抢焦点（引导不是用户点开的）', env2.rt.doc.activeElement === env2.rt.doc.body);
    env2.rt.click(btn(c2(), '看示例盘'));
    eq('看示例盘：打开示例盘', [env2.store.getState().session.view, env2.store.getState().session.chartId], ['chart', 'sample']);
    env2.rt.unmount();
  });

  /* ---------------------------------------------------------------- */
  section('v6 浮层：生辰表单');
  const LIB = [
    { id: 'lib-1700000003000', name: '丙', input: GOLDEN_D2 },
    { id: 'lib-1700000002000', name: '乙', input: GOLDEN_F },
    { id: 'lib-1700000001000', name: '甲', input: GOLDEN, openedAt: 1700000009000 }
  ];
  const storage3 = memoryStorage({ 'ziwei-pro.library': J(LIB), 'ziwei-pro.v6': '1' });
  const env3 = bootRuntime(t.client, { now: NOW, storage: storage3 });
  const SH3 = env3.win.ZWUi.sheets;
  const st3 = env3.store;
  const rt3 = env3.rt;
  const h3 = env3.h;
  const sheet = () => findByClass(rt3.tree(), 'zp-sheet')[0] || null;
  const type3 = (el, value) => { el.props.onChange({ target: { value, checked: value } }); rt3.flush(); };
  const submit3 = () => { find(sheet(), (n) => n.type === 'form')[0].props.onSubmit({ preventDefault() {} }); rt3.flush(); };
  const val = (label) => attr(inputByLabel(sheet(), label), 'value');

  safe('SheetHost 没有浮层时', () => {
    rt3.mount(h3(SH3.SheetHost, { tier: 'wide' }));
    eq('session.sheet 为 null：什么都不渲染', flat(rt3.tree()).length, 0);
  });

  safe('新建：表单', () => {
    env3.P.openSheet('birth');
    rt3.flush();
    const s = sheet();
    eq('浮层：aside.zp-sheet[role=dialog][aria-modal=true][aria-label=新建命盘][data-region=SHEET]',
      [s && s.type, attr(s, 'role'), attr(s, 'aria-modal'), attr(s, 'aria-label'), attr(s, 'data-region')], ['aside', 'dialog', 'true', '新建命盘', 'SHEET']);
    eq('没有草稿：按 DEFAULT_FORM 预填', [val('称呼'), val('年'), val('月'), val('日'), val('时'), val('分')], ['', 1990, 6, 15, 15, 30]);
    for (const label of ['称呼', '年', '月', '日', '时', '分', '出生城市（选填）', '职业 / 想问的方向']) ok(`表单有「${label}」输入框`, !!inputByLabel(s, label));
    for (const label of ['历法', '性别', '年柱分界', '月柱分界', '晚子时（23–24 点出生）', '闰月出生']) ok(`表单有「${label}」选项（单选组 radiogroup）`, !!tablist(s, label));
    const more = find(s, (n) => n.type === 'details')[0];
    eq('四项口径和职业在「更多选项」里', [classesOf(more), text(find(more, (n) => n.type === 'summary')[0]),
      !!inputByLabel(more, '职业 / 想问的方向'), !!tablist(more, '年柱分界'), !!tablist(more, '闰月出生')], [['zp-more'], '更多选项', true, true, true]);
    const hints = findByClass(more, 'zp-field-hint').map(text);
    eq('四项口径各带一行说明（v5 的文字）', hints, ['新的一年从哪天算起，只影响四柱的年柱', '只影响四柱的月柱，不影响命宫和星曜',
      '晚上 11 点到 12 点之间出生，算当天还是第二天', '只在农历闰月出生时有影响']);
    eq('口径的选项文字', ['年柱分界', '月柱分界', '晚子时（23–24 点出生）', '闰月出生'].map((l) => find(tablist(s, l), (n) => attr(n, 'role') === 'radio').map(text)),
      [['正月初一', '立春'], ['农历月', '节气'], ['算第二天', '算当天'], ['下半月算下个月', '整月算本月']]);
    eq('每个输入控件有名字', unnamedControls(s), 0);
    eq('每个按钮有文字或 aria-label', unnamedButtons(s), 0);
    const submitBtn = find(s, (n) => n.type === 'button' && attr(n, 'type') === 'submit')[0];
    const form = find(s, (n) => n.type === 'form')[0];
    eq('提交按钮在页脚、关联到表单、文字是排盘', [!!submitBtn && attr(submitBtn, 'form') === attr(form, 'id'), text(submitBtn)], [true, '排盘']);
    eq('城市空着的提示', text(findByClass(fieldOf(s, '出生城市（选填）'), 'zp-field-hint')[0]), '不填就按钟表时间排盘');
  });

  safe('新建：农历和闰月', () => {
    eq('公历时没有闰月勾选', inputByLabel(sheet(), '闰月'), null);
    rt3.click(find(tablist(sheet(), '历法'), (n) => text(n) === '农历')[0]);
    type3(inputByLabel(sheet(), '年'), '1990');
    type3(inputByLabel(sheet(), '月'), '5');
    const leap = inputByLabel(sheet(), '闰月');
    eq('农历 1990 年五月：有闰月勾选、可以勾', [!!leap, attr(leap, 'type'), !!attr(leap, 'disabled')], [true, 'checkbox', false]);
    type3(inputByLabel(sheet(), '月'), '4');
    eq('农历 1990 年四月：闰月勾选禁用', !!attr(inputByLabel(sheet(), '闰月'), 'disabled'), true);
    const draft = JSON.parse(storage3.getItem('ziwei-pro.form') || 'null');
    eq('改动写进 v5 的表单草稿（ziwei-pro.form）', draft && [draft.calendar, draft.year, draft.month], ['lunar', '1990', '4']);
    rt3.click(find(tablist(sheet(), '历法'), (n) => text(n) === '公历')[0]);
  });

  safe('新建：城市提示', () => {
    const city = () => inputByLabel(sheet(), '出生城市（选填）');
    const hintOf = () => findByClass(fieldOf(sheet(), '出生城市（选填）'), 'zp-field-hint')[0];
    type3(city(), '成都');
    eq('城市名：按城市校正', text(hintOf()), '按成都（东经 104.1°）校正真太阳时');
    type3(city(), '火星');
    eq('查不到：先按钟表时间、可以换写法或填经度（zp-err）', [text(hintOf()), classesOf(hintOf()).includes('zp-err')],
      ['没找到「火星」，先按钟表时间排盘。可以换个写法，或直接填经度（如 116.4）', true]);
    type3(city(), '105.97');
    eq('经度数字', text(hintOf()), '按东经 105.97° 校正真太阳时');
  });

  safe('新建：出错留在表单里', () => {
    const before = st3.getState().library.length;
    type3(inputByLabel(sheet(), '时'), '');
    submit3();
    const err = () => find(sheet(), (n) => attr(n, 'role') === 'alert')[0];
    eq('没填钟点：不替用户默认，留在表单里说明', [text(err()), st3.getState().library.length, st3.getState().session.sheet],
      ['填一下出生的钟点。时辰决定命宫，记不清就填最可能的时辰', before, 'birth']);
    type3(inputByLabel(sheet(), '时'), '9');
    eq('改了任何一项：错误清掉', err() || null, null);
    type3(inputByLabel(sheet(), '年'), '1900');
    type3(inputByLabel(sheet(), '月'), '1');
    type3(inputByLabel(sheet(), '日'), '15');
    submit3();
    eq('引擎排不出来（1900-01-15）：显示引擎的原因、浮层不关、命盘库不变',
      [text(err()), st3.getState().session.sheet, st3.getState().library.length],
      ['这个生辰排不出来：公历日期需在 1900-01-31 至 2100-12-31 之间', 'birth', before]);
    ok('错误在 p.zp-field-hint.zp-err 里', classesOf(err()).includes('zp-err') && classesOf(err()).includes('zp-field-hint'));
    type3(inputByLabel(sheet(), '分'), '75');
    type3(inputByLabel(sheet(), '年'), '1992');
    type3(inputByLabel(sheet(), '月'), '5');
    type3(inputByLabel(sheet(), '日'), '3');
    submit3();
    eq('分钟超出范围：说明', text(err()), '时要在 0 到 23 之间，分要在 0 到 59 之间');
  });

  safe('新建：排盘', () => {
    type3(inputByLabel(sheet(), '分'), '30');
    type3(inputByLabel(sheet(), '称呼'), '丁');
    type3(inputByLabel(sheet(), '职业 / 想问的方向'), '工程');
    st3.patchSession({ onboarding: { step: 2, data: {}, calMode: 'solar', error: '' } });
    const before = st3.getState().library.length;
    submit3();
    const lib = st3.getState().library;
    const ss = st3.getState().session;
    eq('排盘：命盘库最前面多一条 v5 形状的条目', [lib.length, /^lib-\d+$/.test(lib[0].id), Object.keys(lib[0].input)], [before + 1, true, V5_INPUT_KEYS]);
    eq('条目的 input', lib[0].input, {
      name: '丁', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
      longitude: '105.97', city: '105.97', place: '', occupation: '工程', settings: SETTINGS
    });
    eq('浮层关上、打开这张盘（本命，紫微师面板打开）、引导结束',
      [ss.sheet, ss.view, ss.chartId === lib[0].id, ss.tab, ss.panelOpen, ss.onboarding], [null, 'chart', true, 'natal', true, null]);
    st3.goHome();
    st3.setPanel(false);
    env3.P.openSheet('birth');
    rt3.flush();
    eq('再打开新建表单：读回草稿', [val('称呼'), val('年'), val('日'), val('出生城市（选填）')], ['丁', '1992', '3', '105.97']);
    env3.P.closeLayers();
    rt3.flush();
  });

  safe('改生辰', () => {
    const jia = st3.getState().library.find((e) => e.name === '甲');
    env3.P.openSheet('birth', jia.id);
    rt3.flush();
    eq('改生辰：标题和预填（这张盘的生辰）', [attr(sheet(), 'aria-label'), val('年'), val('月'), val('日'), val('时'), val('分'), val('出生城市（选填）')],
      ['改生辰', 1992, 5, 3, 9, 30, '105.97']);
    const submitBtn = find(sheet(), (n) => n.type === 'button' && attr(n, 'type') === 'submit')[0];
    eq('改生辰的提交按钮', text(submitBtn), '按新生辰重排');
    const draftBefore = storage3.getItem('ziwei-pro.form');
    type3(inputByLabel(sheet(), '日'), '4');
    eq('改生辰不写新建表单的草稿', storage3.getItem('ziwei-pro.form'), draftBefore);
    const n = st3.getState().library.length;
    submit3();
    const after = st3.getState().library.find((e) => e.id === jia.id);
    const ss = st3.getState().session;
    eq('改生辰：同一个 id、盘名不变、生辰换了、条数不变', [after.name, after.input.day, after.input.hour, st3.getState().library.length], ['甲', 4, 9, n]);
    eq('浮层关上、打开这张盘', [ss.sheet, ss.view, ss.chartId], [null, 'chart', jia.id]);
    st3.goHome();
  });

  /* ---------------------------------------------------------------- */
  section('v6 浮层：全部命盘');
  const rows = () => findByClass(sheet(), 'zp-list-item');
  safe('列表', () => {
    env3.P.openSheet('charts');
    rt3.flush();
    const s = sheet();
    eq('浮层标题：全部命盘', [attr(s, 'aria-label'), attr(s, 'role'), attr(s, 'aria-modal'), attr(s, 'data-region')], ['全部命盘', 'dialog', 'true', 'SHEET']);
    const items = rows();
    eq('每张盘一行（li.zp-list-item，在 ul.zp-list 里）', [items.length, findByClass(s, 'zp-list')[0] && findByClass(s, 'zp-list')[0].type], [4, 'ul']);
    /* 丁、甲都在"现在"打开过（时钟固定，同一毫秒按命盘库顺序）；甲的 id 最早，但打开过所以排在没打开过的丙、乙前面 */
    eq('最近打开的在前：丁、甲（都刚打开过），然后按 id 时间：丙、乙', items.map((r) => text(findByClass(r, 'zp-list-name')[0])), ['丁', '甲', '丙', '乙']);
    eq('每行：称呼、生日、主星坐命 · 五行局', findByClass(items[2], 'zp-list-open')[0] && findByClass(findByClass(items[2], 'zp-list-open')[0], 'zp-list-meta').map(text),
      ['1992.05.02', '命宫空宫，借天同、太阴 · 木三局']);
    eq('黄金用例那行', findByClass(items[3], 'zp-list-meta').map(text), ['1992.05.03', '太阳、太阴坐命 · 木三局']);
    eq('每个按钮有文字或 aria-label', unnamedButtons(s), 0);
    eq('每行一个「更多」菜单（⋯），名字带盘名', findByClass(items[3], 'zp-menu-wrap').map((w) => attr(find(w, (n) => n.type === 'button')[0], 'aria-label')), ['更多操作：乙']);
    eq('菜单里：改名、改生辰、删除', find(findByClass(items[3], 'zp-menu')[0], (n) => n.type === 'button').map(text), ['改名', '改生辰', '删除']);
  });

  safe('改名', () => {
    const row = () => rows()[3];
    rt3.click(btn(findByClass(row(), 'zp-menu')[0], '改名'));
    const inp = find(row(), (n) => n.type === 'input')[0];
    eq('改名：这一行换成输入框（名字、最多 12 个字、预填原名）', [attr(inp, 'aria-label'), attr(inp, 'maxLength'), attr(inp, 'value')], ['新的称呼', 12, '乙']);
    ok('改名输入框拿到焦点', rt3.doc.activeElement === inp.node);
    type3(inp, '一二三四五六七八九十甲乙丙');
    rt3.key(find(row(), (n) => n.type === 'input')[0], 'Enter');
    const yi = st3.getState().library.find((e) => e.id === 'lib-1700000002000');
    eq('Enter 保存：截到 12 个字', yi.name, '一二三四五六七八九十甲乙');
    eq('提示：已改名', st3.getState().session.toast && st3.getState().session.toast.text, '已改名为「一二三四五六七八九十甲乙」');
    eq('改完这一行回到普通样子', [find(row(), (n) => n.type === 'input').length, text(findByClass(row(), 'zp-list-name')[0])], [0, '一二三四五六七八九十甲乙']);
    rt3.click(btn(findByClass(row(), 'zp-menu')[0], '改名'));
    const r = rt3.key(find(row(), (n) => n.type === 'input')[0], 'Escape');
    eq('改名时 Esc：只取消改名，不关浮层', [find(row(), (n) => n.type === 'input').length, r.stopped, st3.getState().session.sheet], [0, true, 'charts']);
  });

  safe('删除', () => {
    const row = () => rows()[3];
    rt3.click(btn(findByClass(row(), 'zp-menu')[0], '删除'));
    eq('删除第一步：这一行问一句，给删除和取消', [text(findByClass(row(), 'zp-list-ask')[0]), find(row(), (n) => n.type === 'button').map(text)],
      ['删除「一二三四五六七八九十甲乙」？', ['删除', '取消']]);
    eq('还没删', st3.getState().library.length, 4);
    rt3.click(btn(row(), '取消'));
    eq('取消：这一行回到普通样子', findByClass(row(), 'zp-list-ask').length, 0);
    rt3.click(btn(findByClass(row(), 'zp-menu')[0], '删除'));
    rt3.click(find(row(), (n) => n.type === 'button' && text(n) === '删除')[0]);
    const toast = st3.getState().session.toast;
    eq('第二步：删掉、提示可以撤销', [st3.getState().library.length, rows().length, toast && toast.text, toast && toast.action && toast.action.label], [3, 3, '已删除命盘', '撤销']);
    toast.action.run();
    rt3.flush();
    eq('撤销：回来了', [st3.getState().library.length, rows().length], [4, 4]);
  });

  safe('打开与改生辰', () => {
    rt3.click(btn(findByClass(rows()[2], 'zp-menu')[0], '改生辰'));
    eq('菜单「改生辰」：换成生辰浮层、指向这张盘', [st3.getState().session.sheet, st3.getState().session.sheetChartId], ['birth', 'lib-1700000003000']);
    env3.P.openSheet('charts');
    rt3.flush();
    rt3.click(findByClass(rows()[2], 'zp-list-open')[0]);
    const ss = st3.getState().session;
    eq('点一行：关浮层、进入那张盘的流日', [ss.sheet, ss.view, ss.chartId, ss.tab], [null, 'chart', 'lib-1700000003000', 'daily']);
    rt3.unmount();
  });

  safe('空命盘库', () => {
    const env4 = bootRuntime(t.client, { now: NOW, storage: memoryStorage() });
    env4.rt.mount(env4.h(env4.win.ZWUi.sheets.SheetHost, { tier: 'narrow' }));
    env4.P.openSheet('charts');
    env4.rt.flush();
    const s = findByClass(env4.rt.tree(), 'zp-sheet')[0];
    eq('空命盘库：一句话，没有列表项', [findByClass(s, 'zp-list-empty').map(text), findByClass(s, 'zp-list-item').length], [['还没有命盘。'], 0]);
    env4.rt.unmount();
  });
}
