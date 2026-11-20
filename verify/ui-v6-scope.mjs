/**
 * verify/ui-v6-scope.mjs — 生辰解析、时间层级、盘面几何（T3c）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。被测的是 window.ZWUi 上 23-birth / 24-scope / 25-board 挂的纯函数。
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）。期望值写成字面量，或取自
 * verify/fixtures/horoscope-reference.json（本机 iztro 2.6.1 导出的运限参考表）；不用被测代码重算。
 * "今天"固定为 2026-11-19。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle, makeCtx } from './client-harness.mjs';

const GOLDEN = { calendar: 'solar', year: 1992, month: 5, day: 3, hour: 9, minute: 30, gender: 'male', longitude: 105.97 };
const TODAY = { y: 2026, m: 11, d: 19 };
const D = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const iso = (w) => (w ? `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}` : String(w));
const J = (v) => JSON.stringify(v);
const attempt = (fn) => { try { return { v: fn() }; } catch (e) { return { err: e && e.message || String(e) }; } };

export default async function scope(t) {
  const { ok, section } = t;
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);

  section('v6 时间层级：装载');
  const loaded = t.client ? loadBundle(t.client) : null;
  let plugin = null, host = null;
  if (loaded && loaded.entry) {
    try { plugin = loaded.materialize(); host = makeCtx({}); plugin.apply(host.ctx); } catch (e) { plugin = null; }
  }
  const Z = loaded && loaded.win.ZWUi;
  const E = loaded && loaded.win.ZWEngine;
  ok('拿到 window.ZWUi 和 ZWEngine', !!Z && !!E);
  if (!Z || !E) return;
  const API = ['parseBirthDate', 'parseBirthTime', 'shichenOf', 'horoscopeAt', 'lunarUnit', 'stepScope', 'decadalInfo', 'relWord', 'whenLine',
    'scopeCardModel', 'scopeRequest', 'planetItem', 'homeStatus', 'quickLook', 'soulStars', 'natalMutagen', 'ringStep', 'linePoints',
    'scopeStrip', 'palaceFacts'];
  const missing = API.filter((k) => typeof Z[k] !== 'function');
  ok('ZWUi 上有 T3c 的全部纯函数', missing.length === 0, 'missing: ' + missing.join(', '));
  ok('ZWUi.CELL_POS 是 12 个宫位的网格坐标', !!Z.CELL_POS && Object.keys(Z.CELL_POS).length === 12);
  const fn = (k) => (typeof Z[k] === 'function' ? Z[k] : () => { throw new Error('ZWUi.' + k + ' 不存在'); });

  const chart = E.computeChart(GOLDEN);
  ok('黄金用例排盘成功（辰时，命宫在丑）', !chart.error && chart.timeIndex === 4 && chart.soulIndex === 11);

  /* ---------------------------------------------------------------- */
  section('v6 生辰解析：日期');
  const pd = (s, o) => attempt(() => fn('parseBirthDate')(s, o || {}));
  const solar1990 = { lunar: false, y: 1990, m: 6, d: 15, leap: false };
  for (const s of ['1990年6月15日', '1990-6-15', '1990.6.15', '1990/06/15', '90年6月15日', '90.6.15', ' 1990 年 6 月 15 日 ']) {
    const r = pd(s);
    eq(`parseBirthDate「${s}」→ 公历 1990-06-15`, r.v && r.v.value, solar1990);
  }
  eq('parseBirthDate 公历的显示文字', (pd('1990-6-15').v || {}).show, '1990年6月15日');
  const l1 = pd('农历1990年五月廿三').v || {};
  eq('parseBirthDate「农历1990年五月廿三」→ 农历', l1.value, { lunar: true, y: 1990, m: 5, d: 23, leap: false });
  eq('农历日期的显示文字', l1.show, '农历1990年五月廿三');
  const l2 = pd('农历1990年闰五月初一').v || {};
  eq('parseBirthDate「农历1990年闰五月初一」→ 闰月', l2.value, { lunar: true, y: 1990, m: 5, d: 1, leap: true });
  eq('闰月的显示文字', l2.show, '农历1990年闰五月初一');
  eq('parseBirthDate 选了「农历」时数字写法按农历', (pd('1990-5-23', { lunar: true }).v || {}).value, { lunar: true, y: 1990, m: 5, d: 23, leap: false });
  eq('写了「公历」就不按农历', (pd('公历1990-5-23', { lunar: true }).v || {}).value, { lunar: false, y: 1990, m: 5, d: 23, leap: false });
  eq('农历腊月、冬月、正月的写法', ['农历1990年腊月初八', '农历1990年冬月十五', '1990年正月初一'].map((s) => { const v = (pd(s).v || {}).value; return v && [v.m, v.d, v.lunar]; }),
    [[12, 8, true], [11, 15, true], [1, 1, true]]);
  const noLeap = pd('农历1991年闰五月初一').v || {};
  ok('不存在的闰月：给出原因（1991 年没有闰五月）', !noLeap.value && /1991/.test(noLeap.error || '') && /闰五月/.test(noLeap.error || ''), J(noLeap));
  const leapLen = pd('农历1990年闰五月三十').v || {};
  ok('闰月没有三十：说明这个月只有 29 天', !leapLen.value && /29/.test(leapLen.error || ''), J(leapLen));
  const feb30 = pd('1990年2月30日').v || {};
  ok('2 月 30 日：说明这个月没有这一天', !feb30.value && /2月/.test(feb30.error || '') && /30/.test(feb30.error || ''), J(feb30));
  const yr = [pd('1899年1月1日').v || {}, pd('2101-1-1').v || {}];
  ok('年份超出 1900–2100：说明范围', yr.every((r) => !r.value && /1900/.test(r.error || '') && /2100/.test(r.error || '')), J(yr));
  const mon = pd('1990年13月1日').v || {};
  ok('月份 13：报错', !mon.value && !!mon.error, J(mon));
  const bad = pd('明年春天').v || {};
  ok('读不懂：提示带例子', !bad.value && /1990年6月15日/.test(bad.error || ''), J(bad));

  section('v6 生辰解析：时间与时辰');
  const pt = (s) => attempt(() => fn('parseBirthTime')(s)).v || {};
  const cases = [['15:30', 15, 30], ['15：30', 15, 30], ['下午三点半', 15, 30], ['3点半', 3, 30], ['下午3点', 15, 0], ['晚上十一点', 23, 0],
    ['凌晨12点', 0, 0], ['中午12点', 12, 0], ['中午1点', 13, 0], ['上午9点一刻', 9, 15], ['申时', 16, 0], ['晚子时', 23, 30], ['早子时', 0, 30], ['子时', 0, 30], ['辰', 8, 0]];
  for (const [s, hh, mm] of cases) eq(`parseBirthTime「${s}」→ ${hh}:${String(mm).padStart(2, '0')}`, pt(s).value, { h: hh, m: mm });
  eq('时间的显示文字带时辰', [pt('15:30').show, pt('15:30').short], ['15:30（申时）', '15:30 申时']);
  eq('时辰的显示文字', [pt('申时').show, pt('晚子时').show], ['申时', '晚子时']);
  for (const s of ['25点', '12:60', '下午25点']) { const r = pt(s); ok(`parseBirthTime「${s}」→ 超出范围`, !r.value && !!r.error, J(r)); }
  const huh = pt('差不多吃完饭');
  ok('读不懂的时间：提示带例子', !huh.value && /15:30/.test(huh.error || ''), J(huh));
  for (const s of ['不确定', '不知道', '记不清了不确定']) {
    const r = pt(s);
    ok(`parseBirthTime「${s}」→ { unsure: true }，不给默认时间`, r.unsure === true && r.value === undefined && /时辰决定命宫/.test(r.error || ''), J(r));
  }
  const sc = attempt(() => [0, 1, 2, 8, 9, 15, 16, 22, 23].map((x) => fn('shichenOf')(x))).v;
  eq('shichenOf：0 子 / 1 丑 / 2 丑 / 8 辰 / 9 巳 / 15 申 / 16 申 / 22 亥 / 23 子', sc, ['子时', '丑时', '丑时', '辰时', '巳时', '申时', '申时', '亥时', '子时']);

  /* ---------------------------------------------------------------- */
  section('v6 时间层级：horoscopeAt 和 iztro 参考表');
  const ref = JSON.parse(readFileSync(join(t.root, 'verify', 'fixtures', 'horoscope-reference.json'), 'utf8'));
  ok('参考表有 40 个以上的日期，并写明宫位序号的对应关系', ref.entries.length >= 40 && ref._note.join(' ').includes('寅'));
  const HA = (w) => attempt(() => fn('horoscopeAt')(chart, w)).v;
  const settingsBefore = J(chart.meta.settings);
  const mism = [];
  for (const e of ref.entries) {
    const h = HA(D(e.date));
    if (!h) { mism.push(e.date + ': null'); continue; }
    for (const k of ['decadal', 'yearly', 'monthly', 'daily']) {
      const a = e[k], b = h[k];
      const sa = [a.index, a.stem, a.branch, a.mutagen.join('')].join('|');
      const sb = b ? [b.index, b.stem, b.branch, (b.mutagen || []).join('')].join('|') : 'missing';
      if (sa !== sb) mism.push(`${e.date} ${k}: iztro ${sa} / ours ${sb}`);
    }
    if (h.nominalAge !== e.nominalAge) mism.push(`${e.date} 虚岁: iztro ${e.nominalAge} / ours ${h.nominalAge}`);
  }
  ok(`horoscopeAt 在参考表的 ${ref.entries.length} 个日期上和 iztro（horoscopeDivide normal）完全一致`, mism.length === 0, mism.slice(0, 6).join(' ; '));
  ok('horoscopeAt 不改传入的命盘（月柱分界仍是 exact）', J(chart.meta.settings) === settingsBefore && chart.meta.settings.monthDivide === 'exact', J(chart.meta.settings));
  eq('horoscopeAt：出生前一天 → null，出生当天有值', [HA(D('1992-05-02')), !!HA(D('1992-05-03'))], [null, true]);
  eq('horoscopeAt：2101-01-01、2 月 30 日、缺参数 → null', [HA(D('2101-01-01')), HA(D('2025-02-30')), HA(null)], [null, null, null]);

  section('v6 时间层级：流月单位');
  const LU = (s) => attempt(() => fn('lunarUnit')(D(s))).v || {};
  const pickU = (u) => [u.year, u.month, u.leap, u.half, u.key, u.label];
  eq('lunarUnit 2025-07-24（六月三十）', pickU(LU('2025-07-24')), [2025, 6, false, 0, '2025-6', '农历六月']);
  eq('lunarUnit 2025-08-08（闰六月十五）归六月', pickU(LU('2025-08-08')), [2025, 6, true, 1, '2025-6', '农历闰六月上半 · 按六月']);
  eq('lunarUnit 2025-08-10（闰六月十七）归七月', pickU(LU('2025-08-10')), [2025, 7, true, 2, '2025-7', '农历闰六月下半 · 按七月']);
  eq('lunarUnit 2025-08-23（七月初一）', pickU(LU('2025-08-23')), [2025, 7, false, 0, '2025-7', '农历七月']);
  eq('lunarUnit 2026-12-09（冬月初一）', pickU(LU('2026-12-09')), [2026, 11, false, 0, '2026-11', '农历冬月']);

  /* 连续 400 天：同一个流月单位内，流月的宫位、干支、四化不变；流日 = 流月 + 农历日 − 1 */
  const units = new Map();
  const order = [];
  const bad400 = [];
  let dn = Date.UTC(2025, 0, 1) / 86400000;
  for (let i = 0; i < 400; i++, dn++) {
    const dt = new Date(dn * 86400000);
    const w = { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    const h = HA(w);
    const u = attempt(() => fn('lunarUnit')(w)).v;
    if (!h || !u) { bad400.push(iso(w) + ' null'); continue; }
    const sig = [h.monthly.index, h.monthly.stem, h.monthly.branch, h.monthly.mutagen.join('')].join('|');
    if (!units.has(u.key)) { units.set(u.key, { sig, first: iso(w), last: iso(w) }); order.push(u.key); }
    else {
      const rec = units.get(u.key);
      if (order[order.length - 1] !== u.key) bad400.push(`${iso(w)} 单位 ${u.key} 断开后又出现`);
      if (rec.sig !== sig) bad400.push(`${iso(w)} 单位 ${u.key} 内流月变了 ${rec.sig} → ${sig}`);
      rec.last = iso(w);
    }
    const lday = E.solar2lunar(w.y, w.m, w.d).day;
    if (h.daily.index !== (h.monthly.index + lday - 1) % 12) bad400.push(`${iso(w)} 流日 ${h.daily.index} ≠ (${h.monthly.index} + ${lday} − 1) % 12`);
  }
  ok('2025-01-01 起连续 400 天：同一流月单位内流月不变，单位不会断开再出现，流日 = 流月 + 农历日 − 1', bad400.length === 0, bad400.slice(0, 5).join(' ; '));
  eq('2025 年六月这个单位从六月初一到闰六月十五', units.get('2025-6') && [units.get('2025-6').first, units.get('2025-6').last], ['2025-06-25', '2025-08-08']);
  eq('2025 年七月这个单位从闰六月十六到七月三十', units.get('2025-7') && [units.get('2025-7').first, units.get('2025-7').last], ['2025-08-09', '2025-09-21']);
  eq('400 天（2024 年腊月到 2025 年腊月）依次是 13 个流月单位，闰六月不多算一个', order,
    ['2024-12', '2025-1', '2025-2', '2025-3', '2025-4', '2025-5', '2025-6', '2025-7', '2025-8', '2025-9', '2025-10', '2025-11', '2025-12']);

  section('v6 时间层级：前后翻');
  const ST = (tab, s, dir) => { const r = attempt(() => fn('stepScope')(chart, tab, D(s), dir)); return r.err ? 'throw: ' + r.err : r.v ? iso(r.v) : r.v; };
  eq('流日 ±1 天（含月末、闰年 2 月）', [ST('daily', '2026-11-19', 1), ST('daily', '2026-11-19', -1), ST('daily', '2026-03-01', -1), ST('daily', '2024-03-01', -1), ST('daily', '2025-12-31', 1)],
    ['2026-11-20', '2026-11-18', '2026-02-28', '2024-02-29', '2026-01-01']);
  eq('流月：六月 → 七月单位从闰六月十六开始', [ST('monthly', '2025-07-10', 1), ST('monthly', '2025-08-08', 1)], ['2025-08-09', '2025-08-09']);
  eq('流月：七月单位 → 八月初一', [ST('monthly', '2025-08-09', 1), ST('monthly', '2025-08-23', 1), ST('monthly', '2025-09-21', 1)], ['2025-09-22', '2025-09-22', '2025-09-22']);
  eq('流月：往回翻到上一单位的第一天', [ST('monthly', '2025-08-10', -1), ST('monthly', '2025-08-23', -1), ST('monthly', '2025-07-24', -1), ST('monthly', '2025-09-22', -1)],
    ['2025-06-25', '2025-06-25', '2025-05-27', '2025-08-09']);
  eq('流年：按农历年 ±1（2026-02-10 是农历 2025 年腊月廿三）', [ST('yearly', '2026-02-10', 1), ST('yearly', '2026-11-19', -1)], ['2027-01-30', '2025-11-30']);
  eq('流年：翻到出生那一年时不早于出生日', ST('yearly', '1993-03-01', -1), '1992-05-03');
  eq('大限：±10 个农历年', [ST('decadal', '2026-11-19', 1), ST('decadal', '2026-11-19', -1)], ['2036-11-28', '2016-11-10']);
  eq('大限：第一个大限往回翻进童限', ST('decadal', '1997-06-01', -1), '1992-05-28');
  eq('翻到出生以前 → null（流日、流月、流年、大限）',
    [ST('daily', '1992-05-03', -1), ST('monthly', '1992-05-20', -1), ST('yearly', '1992-12-01', -1), ST('decadal', '1993-06-01', -1)], [null, null, null, null]);
  eq('超出 2100 年 → null（流日、流月、流年、大限）',
    [ST('daily', '2100-12-31', 1), ST('monthly', '2100-12-31', 1), ST('yearly', '2100-06-01', 1), ST('decadal', '2095-06-01', 1)], [null, null, null, null]);
  eq('流月翻到 2100 年最后一个能排的单位', ST('monthly', '2100-12-01', 1), '2100-12-31');
  eq('本命没有前后翻', ST('natal', '2026-11-19', 1), null);

  section('v6 时间层级：童限与叫法');
  const DI = (s) => attempt(() => fn('decadalInfo')(chart, HA(D(s)))).v || {};
  eq('decadalInfo 1993-06-01：童限 1–2 岁，虚岁 2', [DI('1993-06-01').childhood, DI('1993-06-01').range, DI('1993-06-01').age], [true, [1, 2], 2]);
  eq('decadalInfo 1994-02-10：第一个大限 3–12', [DI('1994-02-10').childhood, DI('1994-02-10').range], [false, [3, 12]]);
  eq('decadalInfo 2026-11-19：33–42', [DI('2026-11-19').childhood, DI('2026-11-19').range], [false, [33, 42]]);
  const RW = (tab, s) => attempt(() => fn('relWord')(chart, tab, D(s), TODAY)).v;
  eq('relWord 流日：今天 / 明天 / 昨天 / 别的日子', ['2026-11-19', '2026-11-20', '2026-11-18', '2026-11-25'].map((s) => RW('daily', s)), ['今天', '明天', '昨天', '11月25日']);
  eq('relWord 流月：这个月 / 农历冬月 / 别的年份带年', ['2026-11-30', '2026-12-09', '2025-08-10'].map((s) => RW('monthly', s)), ['这个月', '农历冬月', '2025年农历七月']);
  eq('relWord 流年：今年 / 明年 / 去年 / 2030年', ['2026-11-19', '2027-03-01', '2026-01-19', '2030-06-15'].map((s) => RW('yearly', s)), ['今年', '明年', '去年', '2030年']);
  eq('relWord 大限：这十年 / 23–32 岁那十年 / 童限', ['2024-02-10', '2016-01-01', '1993-06-01'].map((s) => RW('decadal', s)), ['这十年', '23–32 岁那十年', '童限']);
  const WL = (tab, s) => attempt(() => fn('whenLine')(chart, tab, D(s))).v;
  eq('whenLine 流日', WL('daily', '2026-11-19'), '11月19日 · 农历十月十一 · 丁酉日');
  eq('whenLine 流日在闰月里', WL('daily', '2025-08-10'), '8月10日 · 农历闰六月十七 · 辛亥日');
  eq('whenLine 流月（闰六月下半写明按七月）', WL('monthly', '2025-08-10'), '2025年农历闰六月下半 · 按七月 · 甲申月');
  eq('whenLine 流年', WL('yearly', '2026-11-19'), '2026年 · 丙午年 · 虚岁 35');
  eq('whenLine 大限', WL('decadal', '2026-11-19'), '33–42 岁 · 甲辰限');
  eq('whenLine 童限不写大限区间', WL('decadal', '1993-06-01'), '童限（2 岁） · 己酉');
  eq('whenLine 本命', WL('natal', '2026-11-19'), '命宫 癸丑 · 身宫在财帛');

  section('v6 时间层级：时间卡');
  const CM = (tab, s, today) => attempt(() => fn('scopeCardModel')(chart, { tab, when: D(s) }, today || TODAY)).v || {};
  const at19 = ref.entries.find((e) => e.date === '2026-11-19');
  const TITLES = { natal: '本命', decadal: '大限', yearly: '流年', monthly: '流月', daily: '流日' };
  for (const tab of Object.keys(TITLES)) {
    const m = CM(tab, '2026-11-19');
    eq(`scopeCardModel ${tab}：标题是页签名`, [m.tab, m.title], [tab, TITLES[tab]]);
  }
  const natal = CM('natal', '2026-11-19');
  eq('本命：不能前后翻，四化是生年四化（壬：天梁 紫微 左辅 武曲）', [natal.canStep, natal.stepLabels, natal.mutagen, natal.readLabel, natal.isNow],
    [false, null, ['天梁', '紫微', '左辅', '武曲'], '读这张盘', true]);
  ok('本命：要点句写命宫主星和身宫', /太阳、太阴/.test(natal.line || '') && /财帛/.test(natal.line || ''), natal.line);
  const STEP = { decadal: ['上一个十年', '下一个十年'], yearly: ['上一年', '下一年'], monthly: ['上个月', '下个月'], daily: ['前一天', '后一天'] };
  const READ = { decadal: '解读这十年', yearly: '解读今年', monthly: '解读这个月', daily: '解读今天' };
  for (const tab of ['decadal', 'yearly', 'monthly', 'daily']) {
    const m = CM(tab, '2026-11-19');
    eq(`scopeCardModel ${tab}：能前后翻、四化等于参考表、是今天`, [m.canStep, m.stepLabels, m.mutagen, m.isNow, m.readLabel],
      [true, STEP[tab], at19[tab].mutagen, true, READ[tab]]);
  }
  eq('流日的时间行和要点句', [CM('daily', '2026-11-19').whenText, CM('daily', '2026-11-19').line], ['11月19日 · 农历十月十一 · 丁酉日', '今天流日命宫在父母，重心在长辈与文书。']);
  const tomorrow = CM('daily', '2026-11-20');
  eq('翻到明天：不是今天，按钮叫「解读明天」', [tomorrow.isNow, tomorrow.readLabel], [false, '解读明天']);
  ok('别的年份的流月：要点句里叫法后面有逗号', /^2025年农历七月，流月命宫在/.test(CM('monthly', '2025-08-10').line || ''), CM('monthly', '2025-08-10').line);
  eq('出生以前的时间卡 → null', attempt(() => fn('scopeCardModel')(chart, { tab: 'daily', when: D('1990-01-01') }, TODAY)).v, null);

  section('v6 时间层级：请求拼接');
  const RQ = (tab, s) => attempt(() => fn('scopeRequest')(chart, HA(D(s)), tab, D(s))).v || {};
  eq('scopeRequest 大限 → meta.decadalFocus', RQ('decadal', '2026-11-19'), { meta: { decadalFocus: [33, 42] } });
  eq('scopeRequest 流年 → meta.yearlyFocus 是农历年', [RQ('yearly', '2026-11-19'), RQ('yearly', '2026-02-10')], [{ meta: { yearlyFocus: 2026 } }, { meta: { yearlyFocus: 2025 } }]);
  const daily = RQ('daily', '2026-11-19');
  const block = daily.contextBlock || '';
  ok('scopeRequest 流日：有 contextBlock 和 focusLine，没有 meta', !!block && !!daily.focusLine && !daily.meta, J(Object.keys(daily)));
  ok('流日定位：日期、丁酉日、流日命宫落在本命父母', /2026-11-19/.test(block) && /丁酉/.test(block) && /父母/.test(block), block);
  const pairs = [['太阴', '禄', '命宫'], ['天同', '权', '夫妻'], ['天机', '科', '福德'], ['巨门', '忌', '福德']];
  const missingPairs = pairs.filter(([s, mu, p]) => !new RegExp(s + '化' + mu + '[^；;。]{0,12}' + p).test(block));
  ok('流日定位：四化星和它们落在本命哪一宫', missingPairs.length === 0, 'missing: ' + J(missingPairs) + ' in ' + block);
  ok('流日定位不超过 600 字', block.length > 0 && block.length <= 600, String(block.length));
  ok('聚焦说明提到流日和「当前定位」', /流日/.test(daily.focusLine || '') && /当前定位/.test(daily.focusLine || ''), daily.focusLine);
  const monthly = RQ('monthly', '2025-08-10');
  ok('流月定位：甲申月、写明闰六月下半按七月、单位起止日期，不超过 600 字',
    /甲申/.test(monthly.contextBlock || '') && /闰六月/.test(monthly.contextBlock || '') && /2025-08-09/.test(monthly.contextBlock || '') && /2025-09-21/.test(monthly.contextBlock || '') &&
    monthly.contextBlock.length <= 600, monthly.contextBlock);

  section('v6 时间层级：首页、星球、速览');
  const h19 = HA(TODAY);
  eq('soulStars：命宫坐太阳、太阴', attempt(() => fn('soulStars')(chart)).v, { names: ['太阳', '太阴'], borrowed: false });
  const emptySoul = Object.assign({}, chart, { soulIndex: 5 });
  eq('soulStars：命宫空宫时借对宫', attempt(() => fn('soulStars')(emptySoul)).v, { names: ['太阳', '太阴'], borrowed: true });
  eq('natalMutagen：生年四化', attempt(() => fn('natalMutagen')(chart)).v, ['天梁', '紫微', '左辅', '武曲']);
  const hs = attempt(() => fn('homeStatus')(chart, h19)).v || {};
  eq('homeStatus 2026-11-19：流日命宫在父母，太阴化禄，巨门化忌，重心在长辈与文书',
    [hs.index, hs.palace, hs.lu, hs.ji, hs.theme], [0, '父母', '太阴', '巨门', '长辈与文书']);
  eq('homeStatus 的句子', hs.text, '今天流日命宫走到你的父母，太阴化禄，巨门化忌。重心在长辈与文书。');
  eq('homeStatus 没有运限盘时 → null', attempt(() => fn('homeStatus')(chart, null)).v, null);
  const pi = attempt(() => fn('planetItem')('lib-1', chart, h19)).v || {};
  eq('planetItem：id、命宫主星、命宫和今天的地支序号（子 = 0）', [pi.id, pi.star, pi.ming, pi.today], ['lib-1', '太阳', 1, 2]);
  eq('planetItem：十二宫名按地支排（子 = 0）', pi.names, ['兄弟', '命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻']);
  const sun = (pi.beads || []).find((b) => b.name === '太阳');
  const moon = (pi.beads || []).find((b) => b.name === '太阴');
  eq('planetItem：14 颗主星，同宫的排序号，庙旺的大一号', [(pi.beads || []).length, sun && [sun.b, sun.k, sun.n, sun.big], moon && [moon.b, moon.k, moon.n, moon.big]],
    [14, [1, 0, 2, false], [1, 1, 2, true]]);
  const colored = attempt(() => fn('planetItem')('lib-1', chart, h19, (n) => (n === '太阳' ? '#abcdef' : ''))).v || {};
  eq('planetItem：可选的取色函数', [colored.color, ((colored.beads || []).find((b) => b.name === '太阳') || {}).color], ['#abcdef', '#abcdef']);
  const ql = attempt(() => fn('quickLook')(chart, TODAY)).v || {};
  eq('quickLook 命宫：主星、一句解释', [ql.soul && ql.soul.names, ql.soul && ql.soul.borrowed, ql.soul && ql.soul.brief],
    [['太阳', '太阴'], false, '光明之星，主名声、公益与付出。坐命者热情坦荡、乐于助人；庙旺显达，落陷则劳碌。']);
  eq('quickLook 格局：最多两个', (ql.patterns || []).map((p) => [p.name, p.level]), [['日月同宫', '吉'], ['双禄交流', '吉']]);
  eq('quickLook 大限：田宅 33–42', ql.decade && [ql.decade.childhood, ql.decade.range, ql.decade.palace], [false, [33, 42], '田宅']);
  eq('quickLook 今天：流日命宫在父母', ql.today && [ql.today.palace, ql.today.lu, ql.today.ji], ['父母', '太阴', '巨门']);
  ok('quickLook 每一段都有一句话', !!ql.soul && !!ql.soul.line && !!ql.decade && /33–42/.test(ql.decade.line || '') && !!ql.today && !!ql.today.line,
    J([ql.soul && ql.soul.line, ql.decade && ql.decade.line, ql.today && ql.today.line]));

  /* ---------------------------------------------------------------- */
  section('v6 盘面几何');
  const RS = (i, d) => attempt(() => fn('ringStep')(i, d)).v;
  eq('ringStep：left +11、right +1、opp +6、未知方向不动', [RS(0, 'left'), RS(11, 'right'), RS(3, 'opp'), RS(9, 'opp'), RS(5, 'up')], [11, 0, 9, 3, 5]);
  const pos = Z.CELL_POS || {};
  const cells = Object.keys(pos).map((k) => pos[k]);
  const onRing = cells.every((p) => Array.isArray(p) && p.length === 2 && (p[0] === 1 || p[0] === 4 || p[1] === 1 || p[1] === 4));
  ok('CELL_POS：12 个格子各不相同，都在 4×4 的外圈', cells.length === 12 && new Set(cells.map(J)).size === 12 && onRing, J(pos));
  eq('CELL_POS：寅在左下、巳在左上、申在右上、亥在右下', [pos[0], pos[3], pos[6], pos[9]], [[1, 4], [1, 1], [4, 1], [4, 4]]);
  const rects = [];
  for (let i = 0; i < 12; i++) { const p = pos[i] || [1, 1]; rects.push({ left: (p[0] - 1) * 100, top: (p[1] - 1) * 80, width: 100, height: 80 }); }
  const LP = (r, s) => attempt(() => fn('linePoints')(r, s)).v || {};
  const lp = LP(rects, 11);
  eq('linePoints：选中丑宫 → 选中、对宫、两个三合宫各取朝向中宫的点', lp.points, [[200, 240], [200, 80], [100, 80], [300, 160]]);
  eq('linePoints：key', lp.key, '11|200.0 240.0|200.0 80.0|100.0 80.0|300.0 160.0');
  ok('linePoints：相同输入给出相同的 key', LP(rects.map((r) => Object.assign({}, r)), 11).key === lp.key && !!lp.key);
  ok('linePoints：抖动 0.01 像素 key 不变，换宫 key 变', LP(rects.map((r) => Object.assign({}, r, { left: r.left + 0.01 })), 11).key === lp.key && LP(rects, 2).key !== lp.key);
  eq('linePoints：rects 不全 → null', attempt(() => fn('linePoints')(rects.slice(0, 5), 0)).v, null);

  /* ---------------------------------------------------------------- */
  section('v6 时间条（spec 2026-11-20 §3.8）');
  const SS = (tab, when) => attempt(() => fn('scopeStrip')(chart, tab, when || TODAY, TODAY)).v || null;
  const tg = (s) => s.items.map((i) => (i.target ? iso(i.target) : null));
  {
    const s = SS('natal');
    eq('本命：此刻的四层各一行（大限 / 流年 / 流月 / 流日），点了跳到今天',
      [s && s.kind, s && s.cols, s && s.items.map((i) => i.key), s && s.items.map((i) => i.label), s && s.items.every((i) => iso(i.target) === '2026-11-19')],
      ['now', 1, ['decadal', 'yearly', 'monthly', 'daily'], ['大限', '流年', '流月', '流日'], true]);
    /* 黄金用例：木三局阳男顺行，33–42 岁走田宅（辰）；2026 丙午年流年命宫在午 = 仆役；11 月 19 日丁酉，流日命宫在父母 */
    eq('大限、流年、流日三行的文字', s && [s.items[0].text, s.items[1].text, s.items[3].text], ['33–42 岁 · 田宅', '2026 丙午 · 仆役', '11月19日 丁酉 · 父母']);
    const hm = fn('horoscopeAt')(chart, TODAY).monthly;
    eq('流月那一行：流月单位、干支、落在本命哪一宫（和运限盘一致）', s && s.items[2].text, '农历十月 ' + hm.stem + hm.branch + ' · ' + chart.palaces[hm.index].name);
  }
  {
    const s = SS('decadal');
    eq('大限：十二个大限按岁数排（4 列），每格带它落在本命哪一宫',
      [s && s.kind, s && s.cols, s && s.items.map((i) => i.label), s && s.items.map((i) => i.sub)],
      ['decadal', 4, ['3–12', '13–22', '23–32', '33–42', '43–52', '53–62', '63–72', '73–82', '83–92', '93–102', '103–112', '113–122'],
        ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟']]);
    eq('现在看的和今天所在的都是 33–42', s && [s.items.filter((i) => i.on).map((i) => i.label), s.items.filter((i) => i.now).map((i) => i.label)], [['33–42'], ['33–42']]);
    /* 2026 是这个大限的第 3 年：跳到别的大限也落在第 3 年、同一个农历月日（十月十一） */
    eq('点别的大限：落在那个大限的同一年次、同一个农历月日；2100 年以后的不可点',
      s && [tg(s).slice(0, 5), tg(s)[11], s.items.slice(0, 11).every((i) => { const l = E.solar2lunar(i.target.y, i.target.m, i.target.d); return l.month === 10 && l.day === 11; })],
      [['1996-11-21', '2006-12-01', '2016-11-10', '2026-11-19', '2036-11-28'], null, true]);
    const early = SS('decadal', D('2017-03-01'));
    eq('翻到别的大限：现在看的那格跟着变，今天那格不变', early && [early.items.filter((i) => i.on).map((i) => i.label), early.items.filter((i) => i.now).map((i) => i.label)], [['23–32'], ['33–42']]);
  }
  {
    const s = SS('yearly');
    eq('流年：这个大限的十年（5 列），公历年加干支',
      [s && s.cols, s && s.items.map((i) => i.label), s && s.items.map((i) => i.sub)],
      [5, ['2024', '2025', '2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033'], ['甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥', '壬子', '癸丑']]);
    eq('今年高亮；点别的年落在同一个农历月日', s && [s.items.filter((i) => i.on).map((i) => i.label), s.items.filter((i) => i.now).map((i) => i.label), tg(s).slice(0, 4)],
      [['2026'], ['2026'], ['2024-11-11', '2025-11-30', '2026-11-19', '2027-11-08']]);
    const kid = SS('yearly', D('1993-03-01'));
    eq('童限（起运前）：只有出生到起运前那几年；出生那一年落在出生日之后', kid && [kid.items.map((i) => i.label), kid.items.filter((i) => i.on).map((i) => i.label), tg(kid)[0] >= '1992-05-03'], [['1992', '1993'], ['1993'], true]);
  }
  {
    const s = SS('monthly');
    eq('流月：这一农历年的十二个月（6 列）', [s && s.cols, s && s.items.map((i) => i.label)],
      [6, ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']]);
    /* 2026 年春节是 2 月 17 日 */
    eq('十月高亮；正月落在 2026-02-17', s && [s.items.filter((i) => i.on).map((i) => i.label), s.items.filter((i) => i.now).map((i) => i.label), tg(s)[0]], [['十月'], ['十月'], '2026-02-17']);
    ok('每个月的落点都在那个流月单位里', !!s && s.items.every((i, k) => fn('lunarUnit')(i.target).month === k + 1));
  }
  {
    const s = SS('daily');
    /* 2026-11-01 是星期日：周一开头的月历第一格是 10 月 26 日 */
    eq('流日：这个公历月的月历，周一开头、7 列 6 行；相邻月的日子变淡',
      [s && s.cols, s && s.head, s && s.items.length, s && tg(s)[0], s && tg(s)[41], s && s.items.filter((i) => i.dim).length],
      [7, ['一', '二', '三', '四', '五', '六', '日'], 42, '2026-10-26', '2026-12-06', 12]);
    eq('今天高亮也是今天那格', s && [s.items.filter((i) => i.on).map((i) => i.label), s.items.filter((i) => i.now).map((i) => i.label)], [['19'], ['19']]);
    const born = SS('daily', D('1992-05-10'));
    eq('出生那个月：出生以前的日子不可点', born && [tg(born).indexOf('1992-05-03'), tg(born).slice(0, tg(born).indexOf('1992-05-03')).every((x) => x === null), born.items.some((i) => i.now)], [6, true, false]);
  }
  eq('排不出运限的日子（出生以前）没有时间条', [SS('yearly', D('1990-01-01')), SS('daily', D('1990-01-01'))], [null, null]);

  section('v6 宫位卡的补充信息');
  {
    const f = attempt(() => fn('palaceFacts')(chart, chart.soulIndex)).v || {};
    eq('命宫（癸丑）：这一宫管什么；三方四正对宫在前，各带主星（空宫是空的）',
      [typeof f.theme === 'string' && f.theme.length > 0, f.stem, (f.trio || []).map((x) => [x.name, x.rel, x.stars])],
      [true, '癸', [['迁移', 'opp', []], ['官禄', 'tri', ['天梁']], ['财帛', 'tri', []]]]);
    /* 癸干四化：破军禄、巨门权、太阴科、贪狼忌（《全书》十干四化） */
    eq('宫干四化：癸干让破军化禄、巨门化权、太阴化科、贪狼化忌，各落在本命哪一宫',
      (f.fly || []).map((x) => [x.mu, x.star, x.palace]), [['禄', '破军', '子女'], ['权', '巨门', '福德'], ['科', '太阴', '命宫'], ['忌', '贪狼', '父母']]);
    ok('落宫和盘面一致', (f.fly || []).every((x) => x.index >= 0 && chart.palaces[x.index].major.concat(chart.palaces[x.index].minor).some((s) => s.name === x.star)));
    eq('宫位序号不对 → null', attempt(() => fn('palaceFacts')(chart, 12)).v, null);
  }

  if (host) host.disposeAll();
}
