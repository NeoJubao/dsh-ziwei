/* 20-util：小工具。ZWUI 收纯函数，后面的文件往上挂；27-zwui 把它暴露成 window.ZWUi 供自检用。 */
const ZWUI = {};

/* 档位按面板实测宽度（docs/ui-contract/v6/layout.md「档位」）：
 *   MID  = SIDE_MIN + GUTTER + BOARD_MIN + PAGE_PAD_X                  = 244 + 16 + 420 + 40       = 720
 *   WIDE = ASSISTANT_W + SIDE_MIN + GUTTER + BOARD_COMFORT + PAGE_PAD_X = 360 + 244 + 16 + 520 + 40 = 1180
 * 首帧还没量到宽度（<= 0）按窄档。体检脚本核对这里的两个字面量等于公式。 */
function tierOf(panelW) {
  if (!(panelW > 0)) return 'narrow';
  if (panelW >= 1180) return 'wide';
  if (panelW >= 720) return 'mid';
  return 'narrow';
}
ZWUI.tierOf = tierOf;

/* 三方四正：对宫 = +6，三合 = +4 / +8（宫位序号 mod 12）。和 v5 同一个函数。 */
function relatedPalaces(index) {
  const i = +index;
  return { opp: (i + 6) % 12, tri: [(i + 4) % 12, (i + 8) % 12] };
}
ZWUI.relatedPalaces = relatedPalaces;

/* 以下从 v5（src/ui-pro.js 的 ZWUI 和 DEFAULT_FORM）原样搬来，行为不变。
 * v5 的 revealDelta（选宫后详情滚多少）是旧布局专属，v6 不搬。 */

/* ---------------- 默认表单 ---------------- */
const DEFAULT_FORM = {
  name: '', calendar: 'solar', year: 1990, month: 6, day: 15,
  isLeap: false, hour: 15, minute: 30, gender: 'male',
  longitude: '', city: '', place: '', occupation: '',
  /* dayDivide 默认 current（按当日），与紫微师/独立版 iztro runner 一致 */
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
ZWUI.DEFAULT_FORM = DEFAULT_FORM;

/* ---------------- 出生城市 → 经度 ----------------
 * 城市中心近似经度（东经，0.1°；0.1° ≈ 0.4 分钟真太阳时）。自编常用城市表：直辖市、省会/首府、港澳台、主要地级市。
 * 用户也可以直接填经度；查不到的城市按钟表时间排盘并提示。 */
const CITY_LON = {
  '北京': 116.4, '天津': 117.2, '上海': 121.5, '重庆': 106.5,
  '石家庄': 114.5, '太原': 112.5, '呼和浩特': 111.7, '沈阳': 123.4, '长春': 125.3, '哈尔滨': 126.5,
  '南京': 118.8, '杭州': 120.2, '合肥': 117.3, '福州': 119.3, '南昌': 115.9, '济南': 117.0,
  '郑州': 113.6, '武汉': 114.3, '长沙': 112.9, '广州': 113.3, '南宁': 108.4, '海口': 110.3,
  '成都': 104.1, '贵阳': 106.6, '昆明': 102.7, '拉萨': 91.1, '西安': 108.9, '兰州': 103.8,
  '西宁': 101.8, '银川': 106.2, '乌鲁木齐': 87.6, '香港': 114.2, '澳门': 113.5, '台北': 121.6,
  '深圳': 114.1, '苏州': 120.6, '无锡': 120.3, '常州': 120.0, '南通': 120.9, '徐州': 117.3,
  '扬州': 119.4, '宁波': 121.6, '温州': 120.7, '绍兴': 120.6, '嘉兴': 120.8, '金华': 119.6,
  '台州': 121.4, '厦门': 118.1, '泉州': 118.7, '青岛': 120.4, '烟台': 121.4, '潍坊': 119.2,
  '临沂': 118.4, '淄博': 118.1, '济宁': 116.6, '大连': 121.6, '鞍山': 123.0, '吉林': 126.6,
  '大庆': 125.1, '佛山': 113.1, '东莞': 113.8, '珠海': 113.6, '汕头': 116.7, '中山': 113.4,
  '惠州': 114.4, '洛阳': 112.5, '唐山': 118.2, '保定': 115.5, '邯郸': 114.5, '秦皇岛': 119.6,
  '大同': 113.3, '包头': 109.8, '芜湖': 118.4, '九江': 116.0, '赣州': 114.9, '襄阳': 112.1,
  '宜昌': 111.3, '株洲': 113.1, '衡阳': 112.6, '桂林': 110.3, '柳州': 109.4, '三亚': 109.5,
  '绵阳': 104.7, '宜宾': 104.6, '南充': 106.1, '遵义': 106.9, '大理': 100.2, '丽江': 100.2,
  '宝鸡': 107.2, '咸阳': 108.7, '汉中': 107.0, '延安': 109.5, '天水': 105.7, '喀什': 76.0
};
const CITY_NAMES = Object.keys(CITY_LON);

/* 出生城市框的解析：empty（不填，按钟表时间）/ city（查到城市）/ number（直接填经度）/ unknown（查不到）。
   城市名取文本里包含的最长城市名；一样长时取靠后的那个（「吉林长春」→ 长春）。 */
function parseBirthplace(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return { kind: 'empty', lon: null, city: null };
  const num = raw.replace(/^东经\s*/, '').replace(/\s*(°|度)?\s*(E|东)?$/i, '');
  if (/^-?\d+(\.\d+)?$/.test(num)) {
    const v = +num;
    return v >= 60 && v <= 140 ? { kind: 'number', lon: v, city: null } : { kind: 'unknown', lon: null, city: null };
  }
  let best = null, bestAt = -1;
  for (let ci = 0; ci < CITY_NAMES.length; ci++) {
    const nm = CITY_NAMES[ci];
    const at = raw.lastIndexOf(nm);
    if (at < 0) continue;
    if (!best || nm.length > best.length || (nm.length === best.length && at > bestAt)) { best = nm; bestAt = at; }
  }
  return best ? { kind: 'city', lon: CITY_LON[best], city: best } : { kind: 'unknown', lon: null, city: null };
}
ZWUI.parseBirthplace = parseBirthplace;

/* 命盘库不填名时的自动盘名：有称呼用称呼，否则「公历日期 时辰 性别」。 */
function autoChartName(input, timeName, labels) {
  const x = input || {};
  const nm = String(x.name || '').trim();
  if (nm) return nm;
  const lb = labels || { male: '男', female: '女' };
  const pad = function (n) { return ('0' + (+n || 0)).slice(-2); };
  return [(+x.year || 0) + '-' + pad(x.month) + '-' + pad(x.day), timeName || '', x.gender === 'female' ? lb.female : lb.male]
    .filter(Boolean).join(' ');
}
ZWUI.autoChartName = autoChartName;

/* 两份输入是不是同一张盘：只比会改变命盘的字段（含排盘设置），沿用解读记录 key 的归一化（readingKeyOf 在 21-storage）。 */
function sameBirthInput(a, b) {
  if (!a || !b) return false;
  return readingKeyOf(a) === readingKeyOf(b);
}
ZWUI.sameBirthInput = sameBirthInput;

/* 报告收尾正文。流式增量已累计进 accumulated；done 是本轮全文。
   续写时本轮全文只接在续写前正文 base 之后，不能再接在 accumulated 之后（否则重复）。 */
function mergeReportText(o) {
  const done = String((o && o.done) || '');
  if (o && o.cont) return String(o.base || '') + done;
  return done || String((o && o.accumulated) || '');
}
ZWUI.mergeReportText = mergeReportText;

/* 对话流式写入：host 的 delta 是增量片段。
   new = 另起一个回答气泡；append = 接在本轮气泡后；replace = 用 done 的本轮全文替换本轮气泡。 */
function applyAssistantText(thread, text, mode) {
  const copy = (thread || []).slice();
  const last = copy[copy.length - 1];
  const s = String(text || '');
  if (mode !== 'new' && last && last.role === 'assistant') {
    copy[copy.length - 1] = { role: 'assistant', content: mode === 'replace' ? s : String(last.content || '') + s };
    return copy;
  }
  copy.push({ role: 'assistant', content: s });
  return copy;
}
ZWUI.applyAssistantText = applyAssistantText;

/* 宫位的「宫名 干支」。引擎宫位对象只有 stem/branch，没有 gz 字段。 */
function palaceLabel(p) {
  if (!p) return '';
  return String(p.name || '') + ' ' + String(p.stem || '') + String(p.branch || '');
}
ZWUI.palaceLabel = palaceLabel;

/* 引用宫位时带给模型的文本：宫名 干支 · 主星与辅星名；无星时写空宫。 */
function palaceQuoteText(p, emptyLabel) {
  if (!p) return '';
  const names = [].concat(p.major || [], p.minor || []).map(function (s) { return s && s.name; }).filter(Boolean);
  return palaceLabel(p) + ' · ' + (names.length ? names.join('、') : String(emptyLabel || ''));
}
ZWUI.palaceQuoteText = palaceQuoteText;

/* 报告选段浮动按钮的坐标。按钮绝对定位在可滚动的正文容器内，
   所以视口差之外还要加上容器的滚动量；左/上保留最小边距。 */
function pickPoint(rangeRect, boxRect, scrollTop, scrollLeft) {
  return {
    x: Math.max(80, rangeRect.left - boxRect.left + (scrollLeft || 0)),
    y: Math.max(32, rangeRect.top - boxRect.top + (scrollTop || 0))
  };
}
ZWUI.pickPoint = pickPoint;
