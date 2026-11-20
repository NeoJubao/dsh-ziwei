/* 24-scope：时间层级——运限盘、叫法、前后翻、流月单位、请求拼接（T3c）
 *
 * 运限一律按农历分界（spec §3.3，和 iztro 的 horoscopeDivide: 'normal' 一致，那也是 iztro 的默认值）：
 * 流年从正月初一换，流月跟农历月走。闰月十五及以前归上月、十六起归下月，所以一个"流月单位"不等于日历上的
 * 一个农历月：2025 年的六月单位是六月初一到闰六月十五，七月单位是闰六月十六到七月三十。
 *
 * 引擎的 computeHoroscope 按命盘的 monthDivide 取流月干支（默认 exact = 按节气），流月宫位却按农历月取，
 * 两者在节气和初一不重合的日子里会错开。horoscopeAt 因此把命盘浅拷贝一份，把 yearDivide / monthDivide
 * 设成 'normal' 再算；传入的命盘不改。排盘口径里的年柱、月柱分界只影响四柱。
 *
 * "今天"一律由调用方传入 { y, m, d }，这里不读时钟。用户看得到的字走 t()；scopeRequest 拼给模型的
 * 定位文字和 chartText 一样用中文，不随界面语言变。 */
const SCOPE_TABS = ['natal', 'decadal', 'yearly', 'monthly', 'daily'];
const SCOPE_MU = ['禄', '权', '科', '忌'];
const SCOPE_TAB_KEYS = { natal: 'scopeTabNatal', decadal: 'scopeTabDecadal', yearly: 'scopeTabYearly', monthly: 'scopeTabMonthly', daily: 'scopeTabDaily' };
const SCOPE_STEP_KEYS = {
  decadal: ['scopeStepPrevDecade', 'scopeStepNextDecade'],
  yearly: ['scopeStepPrevYear', 'scopeStepNextYear'],
  monthly: ['scopeStepPrevMonth', 'scopeStepNextMonth'],
  daily: ['scopeStepPrevDay', 'scopeStepNextDay']
};
/* 宫名 → "这一宫管什么" */
const SCOPE_THEME_KEYS = {
  命宫: 'scopeThemeLife', 兄弟: 'scopeThemeSiblings', 夫妻: 'scopeThemeSpouse', 子女: 'scopeThemeChildren',
  财帛: 'scopeThemeWealth', 疾厄: 'scopeThemeHealth', 迁移: 'scopeThemeTravel', 仆役: 'scopeThemeFriends',
  官禄: 'scopeThemeCareer', 田宅: 'scopeThemeProperty', 福德: 'scopeThemeMind', 父母: 'scopeThemeParents'
};

function scopeTabName(tab) {
  return SCOPE_TAB_KEYS[tab] ? t(SCOPE_TAB_KEYS[tab]) : '';
}
ZWUI.SCOPE_TABS = SCOPE_TABS;
ZWUI.scopeTabName = scopeTabName;

function palaceTheme(name) {
  return SCOPE_THEME_KEYS[name] ? t(SCOPE_THEME_KEYS[name]) : String(name || '');
}
ZWUI.palaceTheme = palaceTheme;

/* ---------- 日期：公历 { y, m, d } ↔ 连续的日序号（不用 Date，避免时区和"现在"） ---------- */
function scopeDayNum(w) {
  const y = w.y - (w.m <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (w.m + (w.m > 2 ? -3 : 9)) + 2) / 5) + w.d - 1;
  return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
}

function scopeFromDayNum(n) {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const m = mp + (mp < 10 ? 3 : -9);
  return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m: m, d: doy - Math.floor((153 * mp + 2) / 5) + 1 };
}

function scopeValidDate(w) {
  if (!w || [w.y, w.m, w.d].some(function (x) { return typeof x !== 'number' || Math.floor(x) !== x; })) return false;
  const back = scopeFromDayNum(scopeDayNum(w));
  return back.y === w.y && back.m === w.m && back.d === w.d;
}

function scopeIso(w) {
  return w.y + '-' + (w.m < 10 ? '0' : '') + w.m + '-' + (w.d < 10 ? '0' : '') + w.d;
}

function scopeBirthDate(chart) {
  const p = String(chart.solarDate || '').split('-');
  return { y: +p[0], m: +p[1], d: +p[2] };
}

function scopeLunar(w) {
  return scopeValidDate(w) ? E.solar2lunar(w.y, w.m, w.d) : null;
}

function scopeBirthLunarYear(chart) {
  if (chart.lunar && chart.lunar.year) return chart.lunar.year;
  const l = scopeLunar(scopeBirthDate(chart));
  return l ? l.year : 0;
}

/* 最后一个大限的末岁；更老的年纪引擎会退回命宫，不算可排的范围 */
function scopeMaxAge(chart) {
  let max = 0;
  chart.palaces.forEach(function (p) { if (p.decadal && p.decadal.range[1] > max) max = p.decadal.range[1]; });
  return max;
}

/* ---------- 运限盘 ---------- */
function horoscopeAt(chart, when) {
  if (!chart || !chart.meta || !chart.palaces || !scopeValidDate(when)) return null;
  const birth = scopeBirthDate(chart);
  if (!scopeValidDate(birth) || scopeDayNum(when) < scopeDayNum(birth)) return null;
  const settings = Object.assign({}, chart.meta.settings, { yearDivide: 'normal', monthDivide: 'normal' });
  const copy = Object.assign({}, chart, { meta: Object.assign({}, chart.meta, { settings: settings }) });
  let h = null;
  try { h = E.computeHoroscope(copy, { y: when.y, m: when.m, d: when.d }); } catch (e) { h = null; }
  if (!h || h.error || !h.decadal || !(h.nominalAge <= scopeMaxAge(chart))) return null;
  return h;
}
ZWUI.horoscopeAt = horoscopeAt;

/* ---------- 流月单位 ----------
 * { year, month, leap, half, day, key, label }：month 是这一天算作的流月（闰月下半已经 +1）；leap 是这一天在不在闰月里；
 * half 0 = 不在闰月，1 = 闰月上半（归上月），2 = 闰月下半（归下月）；day 是农历日；key 在同一个流月单位里相同。 */
function lunarUnit(when) {
  const l = scopeLunar(when);
  if (!l) return null;
  const late = l.isLeap && l.day > 15;
  const month = l.month + (late ? 1 : 0);
  const unitMonth = birthLunarMonthText(month, false);
  const label = !l.isLeap
    ? t('scopeUnitLabel', { month: unitMonth })
    : t(late ? 'scopeUnitLeapLate' : 'scopeUnitLeapEarly', { leapMonth: birthLunarMonthText(l.month, true), month: unitMonth });
  return { year: l.year, month: month, leap: l.isLeap, half: l.isLeap ? (late ? 2 : 1) : 0, day: l.day, key: l.year + '-' + month, label: label };
}
ZWUI.lunarUnit = lunarUnit;

/* 一个流月单位的第一天 / 最后一天（最多 60 天，往外走到 key 变了或出了引擎范围为止） */
function scopeUnitEdge(when, dir) {
  const u = lunarUnit(when);
  if (!u) return null;
  let n = scopeDayNum(when);
  for (let i = 0; i < 70; i++) {
    const nx = lunarUnit(scopeFromDayNum(n + dir));
    if (!nx || nx.key !== u.key) return scopeFromDayNum(n);
    n += dir;
  }
  return null;
}

/* ---------- 童限与大限区间 ----------
 * 起运之前引擎报的是童限宫（name === '童限'），那一宫的 decadal.range 并不是现在的区间；这里按虚岁自己找。 */
function decadalInfo(chart, h) {
  if (!chart || !h || !h.decadal) return null;
  const age = h.nominalAge;
  let first = Infinity;
  for (let i = 0; i < 12; i++) {
    const r = chart.palaces[i].decadal.range;
    if (age >= r[0] && age <= r[1]) return { childhood: false, range: [r[0], r[1]], age: age, index: i };
    if (r[0] < first) first = r[0];
  }
  if (age >= 1 && age < first) return { childhood: true, range: [1, first - 1], age: age, index: h.decadal.index };
  return null;
}
ZWUI.decadalInfo = decadalInfo;

/* ---------- 前后翻 ----------
 * 流日 ±1 天；流月到相邻流月单位的第一天；流年 ±1 个农历年、大限 ±10 个农历年（落在同一个农历月日，
 * 闰月按本月，日子按那个月的天数截）。翻进出生那一段时停在出生日；大限往回翻、第一个大限之前还有童限时
 * 停在童限。翻到出生以前、超出 2100 年或最后一个大限时返回 null。 */
function stepScope(chart, tab, when, dir) {
  const h = horoscopeAt(chart, when);
  if (!h || !dir || !SCOPE_STEP_KEYS[tab]) return null;
  const step = dir > 0 ? 1 : -1;
  const birth = scopeBirthDate(chart);
  let next = null;
  let sameAsBirth = function () { return false; };
  if (tab === 'daily') {
    next = scopeFromDayNum(scopeDayNum(when) + step);
  } else if (tab === 'monthly') {
    const edge = scopeUnitEdge(when, step);
    if (!edge) return null;
    const beyond = scopeFromDayNum(scopeDayNum(edge) + step);
    next = step > 0 ? (lunarUnit(beyond) ? beyond : null) : scopeUnitEdge(beyond, -1);
    sameAsBirth = function (w) { const a = lunarUnit(w), b = lunarUnit(birth); return !!a && !!b && a.key === b.key; };
  } else {
    const l = scopeLunar(when);
    const by = scopeBirthLunarYear(chart);
    let ty = l.year + step * (tab === 'decadal' ? 10 : 1);
    if (tab === 'decadal' && step < 0 && ty < by) {
      const info = decadalInfo(chart, h);
      if (info && !info.childhood) ty = by;
    }
    const days = ty >= by ? E.lunarMonthDays(ty, l.month, false) : 0;
    const s = days ? E.lunar2solar(ty, l.month, Math.min(l.day, days), false) : null;
    next = s ? { y: s.y, m: s.m, d: s.d } : null;
    sameAsBirth = function (w) { const a = scopeLunar(w); return !!a && a.year === by; };
  }
  if (!next) return null;
  if (scopeDayNum(next) < scopeDayNum(birth)) next = sameAsBirth(next) ? birth : null;
  return next && horoscopeAt(chart, next) ? next : null;
}
ZWUI.stepScope = stepScope;

/* ---------- 叫法 ---------- */
/* { text, near }：near 为真时是"今天 / 这个月 / 今年 / 这十年"这类词，后面接句子不加逗号 */
function scopeRel(chart, tab, when, today) {
  const hasToday = scopeValidDate(today);
  if (tab === 'daily') {
    const k = hasToday ? scopeDayNum(when) - scopeDayNum(today) : NaN;
    if (k === 0) return { text: t('scopeRelToday'), near: true };
    if (k === 1) return { text: t('scopeRelTomorrow'), near: true };
    if (k === -1) return { text: t('scopeRelYesterday'), near: true };
    return { text: t('scopeRelDate', { m: when.m, d: when.d }), near: false };
  }
  if (tab === 'monthly') {
    const u = lunarUnit(when), tu = hasToday ? lunarUnit(today) : null;
    if (!u) return { text: '', near: false };
    if (tu && tu.key === u.key) return { text: t('scopeRelThisMonth'), near: true };
    const month = birthLunarMonthText(u.month, false);
    if (tu && tu.year === u.year) return { text: t('scopeUnitLabel', { month: month }), near: false };
    return { text: t('scopeRelLunarMonthOfYear', { year: u.year, month: month }), near: false };
  }
  if (tab === 'yearly') {
    const l = scopeLunar(when), tl = hasToday ? scopeLunar(today) : null;
    if (!l) return { text: '', near: false };
    const k = tl ? l.year - tl.year : NaN;
    if (k === 0) return { text: t('scopeRelThisYear'), near: true };
    if (k === 1) return { text: t('scopeRelNextYear'), near: true };
    if (k === -1) return { text: t('scopeRelLastYear'), near: true };
    return { text: t('scopeRelYear', { year: l.year }), near: false };
  }
  if (tab === 'decadal') {
    const info = decadalInfo(chart, horoscopeAt(chart, when));
    if (!info) return { text: '', near: false };
    if (info.childhood) return { text: t('scopeRelChildhood'), near: false };
    const ti = hasToday ? decadalInfo(chart, horoscopeAt(chart, today)) : null;
    if (ti && !ti.childhood && ti.range[0] === info.range[0]) return { text: t('scopeRelThisDecade'), near: true };
    return { text: t('scopeRelDecade', { from: info.range[0], to: info.range[1] }), near: false };
  }
  return { text: '', near: false };
}

/* 现在看的这一段时间用人话怎么叫：今天 / 明天 / 这个月 / 今年 / 这十年 / 2030年… */
function relWord(chart, tab, when, today) {
  return scopeRel(chart, tab, when, today).text;
}
ZWUI.relWord = relWord;

/* 时间卡的时间行（纯文字）。h 可以不传。 */
function whenLine(chart, tab, when, h) {
  if (!chart) return '';
  if (tab === 'natal') {
    const soul = chart.palaces[chart.soulIndex];
    return t('scopeWhenNatal', { gz: soul.stem + soul.branch, body: chart.palaces[chart.bodyIndex].name });
  }
  const hh = h || horoscopeAt(chart, when);
  if (!hh || !hh[tab]) return '';
  const gz = hh[tab].stem + hh[tab].branch;
  if (tab === 'daily') {
    const l = scopeLunar(when);
    return t('scopeWhenDaily', { m: when.m, d: when.d, lunarMonth: birthLunarMonthText(l.month, l.isLeap), lunarDay: birthLunarDayText(l.day), gz: gz });
  }
  if (tab === 'monthly') {
    const u = lunarUnit(when);
    return t('scopeWhenMonthly', { year: u.year, unit: u.label, gz: gz });
  }
  if (tab === 'yearly') return t('scopeWhenYearly', { year: +String(hh.lunarDate).split('-')[0], gz: gz, age: hh.nominalAge });
  if (tab === 'decadal') {
    const info = decadalInfo(chart, hh);
    if (!info) return '';
    if (info.childhood) return t('scopeWhenChildhood', { age: info.age, gz: gz });
    return t('scopeWhenDecadal', { from: info.range[0], to: info.range[1], gz: gz });
  }
  return '';
}
ZWUI.whenLine = whenLine;

/* ---------- 命宫主星、生年四化 ---------- */
/* 命宫主星；命宫空宫时借对宫 */
function soulStars(chart) {
  const own = chart.palaces[chart.soulIndex].major.map(function (s) { return s.name; });
  if (own.length) return { names: own, borrowed: false };
  const opp = relatedPalaces(chart.soulIndex).opp;
  return { names: chart.palaces[opp].major.map(function (s) { return s.name; }), borrowed: true };
}
ZWUI.soulStars = soulStars;

/* 生年四化：[化禄星, 化权星, 化科星, 化忌星] */
function natalMutagen(chart) {
  const out = ['', '', '', ''];
  chart.palaces.forEach(function (p) {
    p.major.concat(p.minor).forEach(function (s) { const i = SCOPE_MU.indexOf(s.mutagen); if (i >= 0) out[i] = s.name; });
  });
  return out;
}
ZWUI.natalMutagen = natalMutagen;

/* ---------- 时间卡 ----------
 * { tab, title, whenText, line, mutagen, canStep, stepLabels, isNow, readLabel, ganzhi, index }。
 * 本命：不能前后翻，四化是生年四化，isNow 恒为真（不出现"回到今天"）。运限超出范围时返回 null。 */
function scopeCardModel(chart, state, today) {
  const tab = state && state.tab, when = state && state.when;
  if (!chart || SCOPE_TABS.indexOf(tab) < 0) return null;
  const title = scopeTabName(tab);
  if (tab === 'natal') {
    const st = soulStars(chart), body = chart.palaces[chart.bodyIndex].name, soul = chart.palaces[chart.soulIndex];
    const stars = st.names.join('、');
    const line = !st.names.length ? t('scopeNatalLineEmpty', { body: body })
      : t(st.borrowed ? 'scopeNatalLineBorrowed' : 'scopeNatalLine', { stars: stars, body: body });
    return {
      tab: tab, title: title, whenText: whenLine(chart, 'natal', when), line: line, mutagen: natalMutagen(chart),
      canStep: false, stepLabels: null, isNow: true, readLabel: t('scopeReadChart'), ganzhi: soul.stem + soul.branch, index: chart.soulIndex
    };
  }
  const h = horoscopeAt(chart, when);
  if (!h) return null;
  const sc = h[tab], palace = chart.palaces[sc.index].name, theme = palaceTheme(palace);
  const rel = scopeRel(chart, tab, when, today);
  const info = tab === 'decadal' ? decadalInfo(chart, h) : null;
  let line;
  if (info && info.childhood) line = t('scopeLineChildhood', { age: info.age, palace: palace, theme: theme });
  else line = t(rel.near ? 'scopeLineNear' : 'scopeLineFar', { rel: rel.text, tab: title, palace: palace, theme: theme });
  return {
    tab: tab, title: title, whenText: whenLine(chart, tab, when, h), line: line, mutagen: sc.mutagen.slice(),
    canStep: true, stepLabels: [t(SCOPE_STEP_KEYS[tab][0]), t(SCOPE_STEP_KEYS[tab][1])],
    isNow: scopeValidDate(today) && scopeDayNum(when) === scopeDayNum(today),
    readLabel: t('scopeRead', { rel: rel.text }), ganzhi: sc.stem + sc.branch, index: sc.index
  };
}
ZWUI.scopeCardModel = scopeCardModel;

/* ---------- 请求拼接 ----------
 * 大限 → { meta: { decadalFocus: [起, 止] } }（童限时是 [1, 起运岁 − 1]）；流年 → { meta: { yearlyFocus: 农历年 } }
 * （Host 已支持这两个字段）。流月、流日 → { contextBlock, focusLine }：contextBlock 拼在 chartText 末尾（不超过 600 字），
 * focusLine 加在 question 前面；对话气泡里只显示用户那句话。这两段是给模型看的，固定用中文。 */
function scopeZhMonth(m, leap) {
  return (leap ? '闰' : '') + BIRTH_LUNAR_MONTHS[m - 1] + '月';
}

function scopeZhPalace(name) {
  return /宫$/.test(name) ? name : name + '宫';
}

function scopeStarPalace(chart, star) {
  for (let i = 0; i < 12; i++) {
    const p = chart.palaces[i];
    if (p.major.concat(p.minor).some(function (s) { return s.name === star; })) return scopeZhPalace(p.name);
  }
  return '';
}

function scopeRequest(chart, h, tab, when) {
  if (!chart || !h || !h.decadal) return null;
  if (tab === 'decadal') {
    const info = decadalInfo(chart, h);
    return info ? { meta: { decadalFocus: info.range.slice() } } : null;
  }
  if (tab === 'yearly') return { meta: { yearlyFocus: +String(h.lunarDate).split('-')[0] } };
  if (tab !== 'monthly' && tab !== 'daily') return null;
  const sc = h[tab], pal = chart.palaces[sc.index], gz = sc.stem + sc.branch;
  const name = tab === 'daily' ? '流日' : '流月';
  const mu = sc.mutagen.map(function (star, i) {
    const at = scopeStarPalace(chart, star);
    return star + '化' + SCOPE_MU[i] + (at ? '（落本命' + at + '）' : '');
  }).join('；');
  let date, focus;
  if (tab === 'daily') {
    const l = scopeLunar(when);
    date = '公历 ' + scopeIso(when) + '，农历' + l.year + '年' + scopeZhMonth(l.month, l.isLeap) + birthDayName(l.day) + '，' + gz + '日';
    focus = '公历 ' + scopeIso(when) + ' 的流日（' + gz + '日）';
  } else {
    const u = lunarUnit(when), first = scopeUnitEdge(when, -1), last = scopeUnitEdge(when, 1);
    const unit = u.leap ? scopeZhMonth(u.month - (u.half === 2 ? 1 : 0), true) + (u.half === 2 ? '下半（按' : '上半（按') + scopeZhMonth(u.month, false) + '算）' : scopeZhMonth(u.month, false);
    const span = first && last ? '；这个流月从公历 ' + scopeIso(first) + ' 到 ' + scopeIso(last) : '';
    date = '农历' + u.year + '年' + unit + '，' + gz + '月' + span + (u.leap ? '（闰月十五及以前归上月，十六起归下月）' : '');
    focus = '农历' + u.year + '年' + scopeZhMonth(u.month, false) + '这个流月（' + gz + '月' + (first && last ? '，公历 ' + scopeIso(first) + ' 至 ' + scopeIso(last) : '') + '）';
  }
  const contextBlock = '【当前定位 · ' + name + '】' + date + '，虚岁 ' + h.nominalAge + '。\n' +
    name + '命宫落在本命' + scopeZhPalace(pal.name) + '（' + pal.branch + '）。\n' +
    name + '四化：' + mu + '。';
  const focusLine = '【本轮聚焦】命主在面板中看的是' + focus + '。请以文末「当前定位」里的' + name + '为主线回答，再结合当前大限和流年，最后给 1–3 条建议。';
  return { contextBlock: contextBlock.slice(0, 600), focusLine: focusLine };
}
ZWUI.scopeRequest = scopeRequest;

/* ---------- 首页 ---------- */
/* 3D 星球需要的数据（src/sky.js 读这些字段）。地支序号子 = 0；colorOf(星名) 可选，不给时颜色留空、由星图用默认色。 */
function planetItem(id, chart, todayHoroscope, colorOf) {
  const color = function (n) { return (typeof colorOf === 'function' && n && colorOf(n)) || ''; };
  const st = soulStars(chart), beads = [], names = [];
  chart.palaces.forEach(function (p, i) {
    const b = (i + 2) % 12;
    names[b] = p.name;
    p.major.forEach(function (s, k) {
      beads.push({ name: s.name, b: b, k: k, n: p.major.length, color: color(s.name), big: /庙|旺/.test(s.brightness || '') });
    });
  });
  return {
    id: id, star: st.names[0] || '', color: color(st.names[0]), beads: beads, names: names,
    ming: (chart.soulIndex + 2) % 12,
    today: todayHoroscope && todayHoroscope.daily ? (todayHoroscope.daily.index + 2) % 12 : -1
  };
}
ZWUI.planetItem = planetItem;

/* 首页状态句：今天流日命宫落在本命哪一宫、流日化禄和化忌的星、这一宫管什么 */
function homeStatus(chart, todayHoroscope) {
  if (!chart || !todayHoroscope || !todayHoroscope.daily) return null;
  const d = todayHoroscope.daily, palace = chart.palaces[d.index].name, theme = palaceTheme(palace);
  const vars = { palace: palace, lu: d.mutagen[0], ji: d.mutagen[3], theme: theme };
  return { index: d.index, palace: palace, lu: vars.lu, ji: vars.ji, theme: theme, text: t('scopeHomeStatus', vars) };
}
ZWUI.homeStatus = homeStatus;

/* 速览（本地算，不调模型）：命宫主星和一句解释、最多两个格局、当前大限、今天流日 */
function quickLook(chart, today) {
  const st = soulStars(chart), soulP = chart.palaces[chart.soulIndex], gz = soulP.stem + soulP.branch;
  const stars = st.names.join('、');
  const dict = E.starDict || {};
  const soul = {
    names: st.names, borrowed: st.borrowed, ganzhi: gz,
    brief: !st.borrowed && st.names[0] && dict[st.names[0]] ? dict[st.names[0]].brief : '',
    line: !st.names.length ? t('scopeQuickSoulEmpty', { gz: gz }) : t(st.borrowed ? 'scopeQuickSoulBorrowed' : 'scopeQuickSoul', { gz: gz, stars: stars })
  };
  let patterns = [];
  try { patterns = (E.detectPatterns(chart) || []).slice(0, 2).map(function (p) { return { name: p.name, level: p.level, desc: p.desc }; }); } catch (e) { patterns = []; }
  const h = horoscopeAt(chart, today);
  let decade = null, todayInfo = null;
  if (h) {
    const info = decadalInfo(chart, h);
    if (info) {
      const dp = chart.palaces[h.decadal.index].name, theme = palaceTheme(dp);
      decade = {
        childhood: info.childhood, range: info.range, age: info.age, palace: dp, theme: theme,
        stem: h.decadal.stem, branch: h.decadal.branch, mutagen: h.decadal.mutagen.slice(),
        line: info.childhood ? t('scopeQuickChildhood', { age: info.age, palace: dp, theme: theme })
          : t('scopeQuickDecade', { palace: dp, from: info.range[0], to: info.range[1], theme: theme })
      };
    }
    const hs = homeStatus(chart, h);
    todayInfo = Object.assign({}, hs, { line: t('scopeQuickToday', { palace: hs.palace, lu: hs.lu, ji: hs.ji, theme: hs.theme }) });
  }
  return { soul: soul, patterns: patterns, decade: decade, today: todayInfo };
}
ZWUI.quickLook = quickLook;

/* ---------- 时间条（spec 2026-11-20 §3.8）----------
 * 时间卡下面那一排可以直接点的格子：不用一下一下翻，直接跳到某个大限、某一年、某个月、某一天。
 * scopeStrip(chart, tab, when, today) → { kind, cols, head, title, items } 或 null（排不出运限时）。
 *   natal    kind 'now'：此刻的大限 / 流年 / 流月 / 流日各一行，items: [{ key: tab, label, text, target: today }]
 *   decadal  十二个大限，4 列：label '32–41'，sub 这个大限落在本命哪一宫
 *   yearly   when 所在大限的十年（童限是出生到起运前那几年），5 列：label 公历年，sub 干支
 *   monthly  when 所在农历年的十二个流月单位，6 列：label 正月…腊月
 *   daily    when 所在公历月的月历，7 列、6 行（前后补上相邻月的日子，点了就翻到那个月）；head 是周一到周日
 * 每一项：{ key, label, sub?, title?, on（现在看的这一格）, now（今天所在的那一格）, dim?（月历里相邻月的日子）,
 *           far?（月历里离选中那周超过一周的格子，左栏不够高时收起来）,
 *           target: { y, m, d } | null（点了跳到哪天；null = 不可点：出生以前、超出最后一个大限或 2100 年） }
 * 跳转的落点和前后翻（stepScope）同一个规则：流年、大限落在同一个农历月日（日子按那个月的天数截），
 * 翻进出生那一年时停在出生日。 */
const SCOPE_GAN = '甲乙丙丁戊己庚辛壬癸';
const SCOPE_ZHI = '子丑寅卯辰巳午未申酉戌亥';

/* 农历年的干支（1984 是甲子年） */
function scopeYearGanzhi(year) {
  const n = ((year - 1984) % 60 + 60) % 60;
  return SCOPE_GAN.charAt(n % 10) + SCOPE_ZHI.charAt(n % 12);
}

/* 这一天排得出运限吗：不早于出生、虚岁不超过最后一个大限、在农历数据范围内（不调引擎） */
function scopeInRange(chart, w) {
  if (!scopeValidDate(w)) return false;
  const birth = scopeBirthDate(chart);
  if (scopeDayNum(w) < scopeDayNum(birth)) return false;
  const l = scopeLunar(w);
  return !!l && l.year - scopeBirthLunarYear(chart) + 1 <= scopeMaxAge(chart);
}

/* 农历 ty 年里和 l 同一个月日的那天（日子按那个月的天数截，闰月按本月）；早于出生就停在出生日；排不出来是 null */
function scopeSameLunarDay(chart, l, ty) {
  const by = scopeBirthLunarYear(chart);
  if (ty < by) return null;
  const days = E.lunarMonthDays(ty, l.month, false);
  const s = days ? E.lunar2solar(ty, l.month, Math.min(l.day, days), false) : null;
  if (!s) return null;
  let w = { y: s.y, m: s.m, d: s.d };
  const birth = scopeBirthDate(chart);
  if (scopeDayNum(w) < scopeDayNum(birth)) w = ty === by ? birth : null;
  return w && scopeInRange(chart, w) ? w : null;
}

function scopeStrip(chart, tab, when, today) {
  if (!chart || SCOPE_TABS.indexOf(tab) < 0) return null;
  const hasToday = scopeValidDate(today);
  if (tab === 'natal') {
    const h = hasToday ? horoscopeAt(chart, today) : null;
    if (!h) return null;
    const pal = function (sc) { return chart.palaces[sc.index].name; };
    const info = decadalInfo(chart, h);
    const l = scopeLunar(today), u = lunarUnit(today);
    const items = [];
    if (info) {
      items.push({
        key: 'decadal', label: scopeTabName('decadal'), target: today,
        text: info.childhood ? t('scopeNowChildhood', { age: info.age, palace: pal(h.decadal) })
          : t('scopeNowDecadal', { from: info.range[0], to: info.range[1], palace: pal(h.decadal) })
      });
    }
    items.push({ key: 'yearly', label: scopeTabName('yearly'), target: today, text: t('scopeNowYearly', { year: l.year, gz: h.yearly.stem + h.yearly.branch, palace: pal(h.yearly) }) });
    items.push({ key: 'monthly', label: scopeTabName('monthly'), target: today, text: t('scopeNowMonthly', { unit: u.label, gz: h.monthly.stem + h.monthly.branch, palace: pal(h.monthly) }) });
    items.push({ key: 'daily', label: scopeTabName('daily'), target: today, text: t('scopeNowDaily', { m: today.m, d: today.d, gz: h.daily.stem + h.daily.branch, palace: pal(h.daily) }) });
    return { kind: 'now', cols: 1, head: null, title: t('scopeStripNow'), items: items };
  }
  if (!scopeValidDate(when)) return null;
  const h = horoscopeAt(chart, when);
  const l = scopeLunar(when);
  if (!h || !l) return null;
  const by = scopeBirthLunarYear(chart);
  const tl = hasToday ? scopeLunar(today) : null;
  const info = decadalInfo(chart, h);

  if (tab === 'decadal') {
    const todayInfo = hasToday ? decadalInfo(chart, horoscopeAt(chart, today)) : null;
    /* 现在是这个大限的第几年（0–9），跳到别的大限时落在同一年 */
    const offset = info && !info.childhood ? Math.max(0, Math.min(9, l.year - (by + info.range[0] - 1))) : 0;
    const items = E.decadalList(chart).map(function (dc) {
      const from = dc.ageRange[0], to = dc.ageRange[1];
      return {
        key: 'd' + from, label: from + '–' + to, sub: dc.palaceName,
        title: t('scopeStripDecadeTitle', { from: from, to: to, palace: dc.palaceName, gz: dc.stem + dc.branch }),
        on: !!info && !info.childhood && info.range[0] === from,
        now: !!todayInfo && !todayInfo.childhood && todayInfo.range[0] === from,
        target: scopeSameLunarDay(chart, l, by + from - 1 + offset)
      };
    });
    return { kind: 'decadal', cols: 4, head: null, title: t('scopeStripDecades'), items: items };
  }

  if (tab === 'yearly') {
    if (!info) return null;
    const items = [];
    for (let age = info.range[0]; age <= info.range[1]; age++) {
      const year = by + age - 1, gz = scopeYearGanzhi(year);
      items.push({
        key: 'y' + year, label: String(year), sub: gz, title: t('scopeStripYearTitle', { year: year, gz: gz, age: age }),
        on: l.year === year, now: !!tl && tl.year === year,
        target: scopeSameLunarDay(chart, l, year)
      });
    }
    const title = info.childhood ? t('scopeStripYearsChildhood') : t('scopeStripYears', { from: info.range[0], to: info.range[1] });
    return { kind: 'yearly', cols: 5, head: null, title: title, items: items };
  }

  if (tab === 'monthly') {
    const u = lunarUnit(when), tu = hasToday ? lunarUnit(today) : null;
    const birth = scopeBirthDate(chart), bu = lunarUnit(birth);
    const items = [];
    for (let m = 1; m <= 12; m++) {
      const s = E.lunar2solar(u.year, m, 1, false);
      let target = s ? { y: s.y, m: s.m, d: s.d } : null;
      /* 出生那个月：落在出生日 */
      if (target && bu && bu.key === u.year + '-' + m && scopeDayNum(target) < scopeDayNum(birth)) target = birth;
      if (target && !scopeInRange(chart, target)) target = null;
      items.push({
        key: 'm' + m, label: birthLunarMonthText(m, false), on: u.month === m, now: !!tu && tu.key === u.year + '-' + m, target: target
      });
    }
    return { kind: 'monthly', cols: 6, head: null, title: t('scopeStripMonths', { year: u.year, gz: scopeYearGanzhi(u.year) }), items: items };
  }

  /* daily：when 所在公历月的月历，周一开头，固定 6 行 */
  const first = scopeDayNum({ y: when.y, m: when.m, d: 1 });
  /* 1970-01-01（日序号 0）是周四：周一 = 0 的星期序号 */
  const lead = ((first + 3) % 7 + 7) % 7;
  const todayNum = hasToday ? scopeDayNum(today) : NaN, whenNum = scopeDayNum(when);
  /* 左栏不够高时月历只留三周：选中那天所在的一周和它前后各一周（在头尾时往里收），其余的格子标 far */
  const selWeek = Math.floor((whenNum - (first - lead)) / 7);
  const nearFrom = Math.max(0, Math.min(3, selWeek - 1));
  const items = [];
  for (let i = 0; i < 42; i++) {
    const n = first - lead + i, w = scopeFromDayNum(n), week = Math.floor(i / 7);
    items.push({
      key: 'x' + n, label: String(w.d), on: n === whenNum, now: n === todayNum, dim: w.m !== when.m,
      far: week < nearFrom || week > nearFrom + 2,
      target: scopeInRange(chart, w) ? w : null
    });
  }
  return {
    kind: 'daily', cols: 7, head: t('scopeStripWeekdays').split('|'), title: t('scopeStripDays', { year: when.y, m: when.m }), items: items
  };
}
ZWUI.scopeStrip = scopeStrip;

/* ---------- 宫位卡的补充信息 ----------
 * palaceFacts(chart, index) → { theme, trio, fly }
 *   theme  这一宫管什么（palaceTheme）
 *   trio   三方四正：[{ index, name, rel: 'opp' | 'tri', stars: [主星名…]（空宫是 []） }]，对宫在前
 *   fly    宫干四化：这一宫的天干让哪四颗星化禄 / 权 / 科 / 忌，各落在本命哪一宫
 *          [{ mu: '禄', star, index（-1 = 盘上没有这颗星）, palace }]。四化表取引擎的（大限天干就是宫干） */
function palaceFacts(chart, index) {
  const p = chart && chart.palaces ? chart.palaces[index] : null;
  if (!p) return null;
  const rel = relatedPalaces(index);
  const trio = [[rel.opp, 'opp'], [rel.tri[0], 'tri'], [rel.tri[1], 'tri']].map(function (x) {
    const q = chart.palaces[x[0]];
    return { index: x[0], name: q.name, rel: x[1], stars: q.major.map(function (s) { return s.name; }) };
  });
  let names = [];
  try {
    const hit = (E.decadalList(chart) || []).filter(function (dc) { return dc.index === index; })[0];
    names = hit && Array.isArray(hit.mutagen) ? hit.mutagen : [];
  } catch (e) { names = []; }
  const fly = names.map(function (star, k) {
    let at = -1;
    chart.palaces.forEach(function (q, i) {
      if (q.major.concat(q.minor).some(function (s) { return s.name === star; })) at = i;
    });
    return { mu: SCOPE_MU[k], star: star, index: at, palace: at >= 0 ? chart.palaces[at].name : '' };
  });
  return { theme: palaceTheme(p.name), stem: p.stem, trio: trio, fly: fly };
}
ZWUI.palaceFacts = palaceFacts;
