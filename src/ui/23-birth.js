/* 23-birth：生辰解析——日期、时间、时辰（T3c）
 * 纯函数：不读界面状态，公历 / 农历作为参数传入。结果是 { value, show, short? } 或 { error }（已翻译的说明）。
 * 时间写"不确定 / 不知道"时返回 { unsure: true, error }：没有 value，不替用户选默认时辰（spec §3.2）。
 * 农历月、日的中文写法和干支一样是数据，不进字典；英文模板只用数字。 */
const BIRTH_SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const BIRTH_LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const BIRTH_CN_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const BIRTH_MONTH_WORDS = { 正: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 冬: 11, 十二: 12, 腊: 12 };
const BIRTH_HOUR_WORDS = { 零: 0, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 };
const BIRTH_SOLAR_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function birthPad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/* 农历日的中文写法：初一…初十、十一…十九、二十、廿一…廿九、三十 */
function birthDayName(d) {
  if (d <= 10) return '初' + BIRTH_CN_DIGITS[d];
  if (d < 20) return '十' + BIRTH_CN_DIGITS[d - 10];
  if (d === 20) return '二十';
  if (d < 30) return '廿' + BIRTH_CN_DIGITS[d - 20];
  return '三十';
}

/* 农历月、日的显示文字（走字典：中文"闰五月""廿三"，英文"leap month 5""day 23"） */
function birthLunarMonthText(m, leap) {
  return t(leap ? 'birthLunarLeapMonth' : 'birthLunarMonth', { name: BIRTH_LUNAR_MONTHS[m - 1], m: m });
}

function birthLunarDayText(d) {
  return t('birthLunarDay', { name: birthDayName(d), d: d });
}

function birthSolarDays(y, m) {
  if (m === 2 && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)) return 29;
  return BIRTH_SOLAR_DAYS[m - 1];
}

/* 时辰：0 点和 23 点都是子时，1–2 点丑时，…，21–22 点亥时 */
function shichenOf(hour) {
  const hh = Math.floor(+hour);
  if (!(hh >= 0 && hh <= 23)) return '';
  return BIRTH_SHICHEN[Math.floor(((hh + 1) % 24) / 2)] + '时';
}
ZWUI.shichenOf = shichenOf;

/* 生日：1990年6月15日 / 1990-6-15 / 1990.6.15 / 90年6月15日 / 农历1990年五月廿三 / 农历1990年闰五月初一。
 * opts.lunar：用户选了"农历"时，数字写法也按农历读；文字里写了"公历 / 阳历"就按公历。 */
function parseBirthDate(text, opts) {
  let v = String(text == null ? '' : text).replace(/\s+/g, '');
  let lunar = !!(opts && opts.lunar) || /农历|阴历/.test(v);
  if (/公历|阳历|新历/.test(v)) lunar = false;
  v = v.replace(/农历|阴历|公历|阳历|新历/g, '');
  const leap = v.indexOf('闰') >= 0;
  if (leap) lunar = true;
  v = v.replace('闰', '');
  let y, m, d, mm;
  if ((mm = v.match(/^(\d{2}|\d{4})[年.\-\/](\d{1,2})[月.\-\/](\d{1,2})[日号]?$/))) {
    y = +mm[1]; m = +mm[2]; d = +mm[3];
  } else if ((mm = v.match(/^(\d{2}|\d{4})年?(十一|十二|正|一|二|三|四|五|六|七|八|九|十|冬|腊)月(初[一二三四五六七八九十]|十[一二三四五六七八九]?|二十|廿[一二三四五六七八九]|三十|\d{1,2})[日号]?$/))) {
    y = +mm[1]; m = BIRTH_MONTH_WORDS[mm[2]];
    if (/^\d+$/.test(mm[3])) d = +mm[3];
    else { d = 0; for (let i = 1; i <= 30; i++) if (birthDayName(i) === mm[3]) d = i; if (mm[3] === '十') d = 10; }
    lunar = true;
  } else {
    return { error: t('birthDateUnreadable') };
  }
  if (y < 100) y += y > 30 ? 1900 : 2000;
  if (y < 1900 || y > 2100) return { error: t('birthDateYearRange') };
  if (!(m >= 1 && m <= 12)) return { error: t('birthDateMonthRange') };
  if (lunar) {
    const month = birthLunarMonthText(m, leap);
    if (leap && E.leapMonth(y) !== m) return { error: t('birthDateNoLeap', { y: y, month: month }) };
    const days = E.lunarMonthDays(y, m, leap);
    if (!(d >= 1 && d <= days)) return { error: t('birthDateLunarDays', { y: y, month: month, days: days }) };
    return {
      value: { lunar: true, y: y, m: m, d: d, leap: leap },
      show: t('birthDateShowLunar', { y: y, month: month, day: birthLunarDayText(d) })
    };
  }
  if (!(d >= 1 && d <= birthSolarDays(y, m))) return { error: t('birthDateNoSuchDay', { y: y, m: m, d: d }) };
  return { value: { lunar: false, y: y, m: m, d: d, leap: false }, show: t('birthDateShowSolar', { y: y, m: m, d: d }) };
}
ZWUI.parseBirthDate = parseBirthDate;

/* 出生时间：15:30 / 下午三点半 / 3点半 / 上午9点一刻 / 申时 / 晚子时；"不确定"不给默认时间。
 * 时辰取中间的钟点（丑时 = 2:00）；子时分早晚：早子时 0:30，晚子时 23:30。时辰的结果多一个 shichen: true。 */
function parseBirthTime(text) {
  const v = String(text == null ? '' : text).replace(/\s+/g, '');
  if (/不确定|不知道|不清楚|不记得|记不清|不详/.test(v)) return { unsure: true, error: t('birthTimeUnsure') };
  let mm = v.match(/^(早|晚)?([子丑寅卯辰巳午未申酉戌亥])时?$/);
  if (mm) {
    const idx = BIRTH_SHICHEN.indexOf(mm[2]);
    const late = idx === 0 && mm[1] === '晚';
    const name = (idx === 0 && mm[1] ? mm[1] : '') + mm[2] + '时';
    const range = idx === 0 ? '23–1' : (idx * 2 - 1) + '–' + (idx * 2 + 1);
    const show = t('birthTimeShowShichen', { name: name, range: range });
    /* shichen：用户直接给的是时辰，不是钟点（引导问答据此不做真太阳时校正）。value 的形状不变 */
    return { value: { h: idx === 0 ? (late ? 23 : 0) : idx * 2, m: idx === 0 ? 30 : 0 }, show: show, short: show, shichen: true };
  }
  const PERIOD = '(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里)?';
  mm = v.match(new RegExp('^' + PERIOD + '(\\d{1,2})(?:[:：点时](\\d{1,2}|半|一刻|三刻)?分?)?$'));
  if (!mm) {
    const m2 = v.match(new RegExp('^' + PERIOD + '(十一|十二|十|两|[零一二三四五六七八九])点(半|一刻|三刻)?$'));
    if (!m2) return { error: t('birthTimeUnreadable') };
    mm = [m2[0], m2[1], String(BIRTH_HOUR_WORDS[m2[2]]), m2[3] || ''];
  }
  let hh = +mm[2];
  const mn = mm[3] === '半' ? 30 : mm[3] === '一刻' ? 15 : mm[3] === '三刻' ? 45 : +(mm[3] || 0);
  const per = mm[1] || '';
  if (/下午|傍晚|晚上|夜里/.test(per) && hh < 12) hh += 12;
  if (per === '中午' && hh < 6) hh += 12;
  if (per === '凌晨' && hh === 12) hh = 0;
  if (hh > 23 || mn > 59) return { error: t('birthTimeOutOfRange') };
  const vars = { time: birthPad2(hh) + ':' + birthPad2(mn), shichen: shichenOf(hh) };
  return { value: { h: hh, m: mn }, show: t('birthTimeShow', vars), short: t('birthTimeShort', vars) };
}
ZWUI.parseBirthTime = parseBirthTime;
