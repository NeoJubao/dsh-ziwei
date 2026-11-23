/* 20-util：小工具。ZWUI 收纯函数，后面的文件往上挂；27-zwui 把它暴露成 window.ZWUi 供自检用。 */
const ZWUI = {};

/* 档位按面板实测宽度（docs/ui-contract/layout.md「档位」）：
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

/* 外观偏好只有三个值：dark（默认）/ light / auto（跟随 DSH）。别的一律按 dark。 */
function themePrefOf(v) {
  return v === 'light' || v === 'auto' ? v : 'dark';
}
ZWUI.themePrefOf = themePrefOf;

/* 根节点 data-theme 的值：auto 时看宿主是不是深色（body[data-ds-dark-theme]，由调用方读了传进来） */
function resolveTheme(pref, hostDark) {
  const p = themePrefOf(pref);
  if (p === 'auto') return hostDark ? 'dark' : 'light';
  return p;
}
ZWUI.resolveTheme = resolveTheme;

/* 模型选择：{ provider, model } 两个都是 1–200 字的字符串才算数（和 Host 的 pickModelOverride 同一个口径），否则是 null = 跟随 DSH 默认 */
function modelPrefOf(v) {
  if (!v || typeof v !== 'object') return null;
  const pick = function (x) { return typeof x === 'string' && x.trim() && x.length <= 200 ? x.trim() : ''; };
  const provider = pick(v.provider), model = pick(v.model);
  return provider && model ? { provider: provider, model: model } : null;
}
ZWUI.modelPrefOf = modelPrefOf;

function sameModel(a, b) {
  return (!a && !b) || (!!a && !!b && a.provider === b.provider && a.model === b.model);
}
ZWUI.sameModel = sameModel;

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
 * 城市中心近似经度（东经，0.1°；0.1° ≈ 0.4 分钟真太阳时），按省分组：4 个直辖市、333 个地级市 / 州 / 盟 / 地区、
 * 没有上级地级单位的省直辖市、港澳和台湾六市。自治州、盟、地区用通行的简称（凉山、延边、锡林郭勒、阿里），经度取驻地。
 * v5 的 94 城是当时自编的值，原样保留；其余取自 GeoNames（CC BY 4.0，见 THIRD_PARTY_NOTICES.md 第 6 节）。
 * 用户也可以直接填经度；查不到的按钟表时间排盘并提示。县级不收：填所属的市。 */
const CITY_TABLE = {
  '北京': { '北京': 116.4 },
  '天津': { '天津': 117.2 },
  '上海': { '上海': 121.5 },
  '重庆': { '重庆': 106.5 },
  '河北': {
    '石家庄': 114.5, '唐山': 118.2, '秦皇岛': 119.6, '邯郸': 114.5, '邢台': 114.5, '保定': 115.5, '张家口': 114.9, '承德': 118.0,
    '沧州': 116.9, '廊坊': 116.7, '衡水': 115.7
  },
  '山西': {
    '太原': 112.5, '大同': 113.3, '阳泉': 113.6, '长治': 113.1, '晋城': 112.8, '朔州': 112.4, '晋中': 112.8, '运城': 111.0,
    '忻州': 112.7, '临汾': 111.5, '吕梁': 111.1
  },
  '内蒙古': {
    '呼和浩特': 111.7, '包头': 109.8, '乌海': 106.8, '赤峰': 119.0, '通辽': 122.3, '鄂尔多斯': 109.8, '呼伦贝尔': 119.8,
    '巴彦淖尔': 107.4, '乌兰察布': 113.1, '兴安': 122.1, '锡林郭勒': 116.1, '阿拉善': 105.7
  },
  '辽宁': {
    '沈阳': 123.4, '大连': 121.6, '鞍山': 123.0, '抚顺': 123.9, '本溪': 123.8, '丹东': 124.4, '锦州': 121.1, '营口': 122.2,
    '阜新': 121.7, '辽阳': 123.2, '盘锦': 122.1, '铁岭': 123.8, '朝阳': 120.5, '葫芦岛': 120.8
  },
  '吉林': {
    '长春': 125.3, '吉林': 126.6, '四平': 124.4, '辽源': 125.1, '通化': 125.9, '白山': 126.4, '松原': 124.8, '白城': 122.8,
    '延边': 129.5
  },
  '黑龙江': {
    '哈尔滨': 126.5, '齐齐哈尔': 124.0, '鸡西': 131.0, '鹤岗': 130.3, '双鸭山': 131.1, '大庆': 125.1, '伊春': 128.9, '佳木斯': 130.3,
    '七台河': 131.0, '牡丹江': 129.6, '黑河': 127.5, '绥化': 127.0, '大兴安岭': 124.1
  },
  '江苏': {
    '南京': 118.8, '无锡': 120.3, '徐州': 117.3, '常州': 120.0, '苏州': 120.6, '南通': 120.9, '连云港': 119.2, '淮安': 119.0,
    '盐城': 120.2, '扬州': 119.4, '镇江': 119.5, '泰州': 119.9, '宿迁': 118.3
  },
  '浙江': {
    '杭州': 120.2, '宁波': 121.6, '温州': 120.7, '嘉兴': 120.8, '湖州': 120.1, '绍兴': 120.6, '金华': 119.6, '衢州': 118.9,
    '舟山': 122.2, '台州': 121.4, '丽水': 119.9
  },
  '安徽': {
    '合肥': 117.3, '芜湖': 118.4, '蚌埠': 117.4, '淮南': 117.0, '马鞍山': 118.5, '淮北': 116.8, '铜陵': 117.8, '安庆': 117.0,
    '黄山': 118.3, '滁州': 118.3, '阜阳': 115.8, '宿州': 117.0, '六安': 116.5, '亳州': 115.8, '池州': 117.5, '宣城': 118.8
  },
  '福建': {
    '福州': 119.3, '厦门': 118.1, '莆田': 119.0, '三明': 117.6, '泉州': 118.7, '漳州': 117.7, '南平': 118.2, '龙岩': 117.0,
    '宁德': 119.5
  },
  '江西': {
    '南昌': 115.9, '景德镇': 117.2, '萍乡': 113.9, '九江': 116.0, '新余': 114.9, '鹰潭': 117.0, '赣州': 114.9, '吉安': 115.0,
    '宜春': 114.4, '抚州': 116.3, '上饶': 117.9
  },
  '山东': {
    '济南': 117.0, '青岛': 120.4, '淄博': 118.1, '枣庄': 117.6, '东营': 118.5, '烟台': 121.4, '潍坊': 119.2, '济宁': 116.6,
    '泰安': 117.1, '威海': 122.1, '日照': 119.5, '临沂': 118.4, '德州': 116.4, '聊城': 116.0, '滨州': 118.0, '菏泽': 115.5
  },
  '河南': {
    '郑州': 113.6, '开封': 114.3, '洛阳': 112.5, '平顶山': 113.3, '安阳': 114.4, '鹤壁': 114.3, '新乡': 113.8, '焦作': 113.2,
    '濮阳': 115.0, '许昌': 113.9, '漯河': 114.0, '三门峡': 111.2, '南阳': 112.5, '商丘': 115.7, '信阳': 114.1, '周口': 114.6,
    '驻马店': 114.0, '济源': 112.6
  },
  '湖北': {
    '武汉': 114.3, '黄石': 115.0, '十堰': 110.8, '宜昌': 111.3, '襄阳': 112.1, '鄂州': 114.9, '荆门': 112.2, '孝感': 113.9,
    '荆州': 112.2, '黄冈': 114.9, '咸宁': 114.3, '随州': 113.4, '恩施': 109.5, '仙桃': 113.4, '潜江': 112.9, '天门': 113.2,
    '神农架': 110.7
  },
  '湖南': {
    '长沙': 112.9, '株洲': 113.1, '湘潭': 112.9, '衡阳': 112.6, '邵阳': 111.5, '岳阳': 113.1, '常德': 111.7, '张家界': 110.5,
    '益阳': 112.3, '郴州': 113.0, '永州': 111.6, '怀化': 110.0, '娄底': 112.0, '湘西': 109.7
  },
  '广东': {
    '广州': 113.3, '韶关': 113.6, '深圳': 114.1, '珠海': 113.6, '汕头': 116.7, '佛山': 113.1, '江门': 113.1, '湛江': 110.4,
    '茂名': 110.9, '肇庆': 112.5, '惠州': 114.4, '梅州': 116.1, '汕尾': 115.3, '河源': 114.7, '阳江': 112.0, '清远': 113.0,
    '东莞': 113.8, '中山': 113.4, '潮州': 116.6, '揭阳': 116.4, '云浮': 112.0
  },
  '广西': {
    '南宁': 108.4, '柳州': 109.4, '桂林': 110.3, '梧州': 111.3, '北海': 109.1, '防城港': 108.4, '钦州': 108.7, '贵港': 109.6,
    '玉林': 110.2, '百色': 106.6, '贺州': 111.6, '河池': 108.1, '来宾': 109.2, '崇左': 107.4
  },
  '海南': {
    '海口': 110.3, '三亚': 109.5, '三沙': 112.3, '儋州': 109.6, '五指山': 109.5, '琼海': 110.5, '文昌': 110.8, '万宁': 110.4,
    '东方': 108.7
  },
  '四川': {
    '成都': 104.1, '自贡': 104.8, '攀枝花': 101.7, '泸州': 105.4, '德阳': 104.4, '绵阳': 104.7, '广元': 105.8, '遂宁': 105.6,
    '内江': 105.1, '乐山': 103.8, '南充': 106.1, '眉山': 103.8, '宜宾': 104.6, '广安': 106.6, '达州': 107.5, '雅安': 103.0,
    '巴中': 106.7, '资阳': 104.6, '阿坝': 102.2, '甘孜': 102.0, '凉山': 102.3
  },
  '贵州': {
    '贵阳': 106.6, '六盘水': 104.8, '遵义': 106.9, '安顺': 105.9, '毕节': 105.3, '铜仁': 109.2, '黔西南': 104.9, '黔东南': 108.0,
    '黔南': 107.5
  },
  '云南': {
    '昆明': 102.7, '曲靖': 103.8, '玉溪': 102.5, '保山': 99.2, '昭通': 103.7, '丽江': 100.2, '普洱': 101.0, '临沧': 100.1,
    '楚雄': 101.5, '红河': 103.4, '文山': 104.3, '西双版纳': 100.8, '大理': 100.2, '德宏': 98.6, '怒江': 98.9, '迪庆': 99.7
  },
  '西藏': {
    '拉萨': 91.1, '日喀则': 88.9, '昌都': 97.2, '林芝': 94.4, '山南': 91.8, '那曲': 92.1, '阿里': 80.1
  },
  '陕西': {
    '西安': 108.9, '铜川': 109.0, '宝鸡': 107.2, '咸阳': 108.7, '渭南': 109.5, '延安': 109.5, '汉中': 107.0, '榆林': 109.7,
    '安康': 109.0, '商洛': 109.9
  },
  '甘肃': {
    '兰州': 103.8, '嘉峪关': 98.3, '金昌': 102.2, '白银': 104.2, '天水': 105.7, '武威': 102.6, '张掖': 100.5, '平凉': 106.7,
    '酒泉': 98.5, '庆阳': 107.6, '定西': 104.6, '陇南': 104.9, '临夏': 103.2, '甘南': 102.9
  },
  '青海': {
    '西宁': 101.8, '海东': 102.4, '海北': 101.0, '黄南': 102.0, '海南': 100.6, '果洛': 100.2, '玉树': 97.0, '海西': 97.4
  },
  '宁夏': {
    '银川': 106.2, '石嘴山': 106.4, '吴忠': 106.2, '固原': 106.3, '中卫': 105.2
  },
  '新疆': {
    '乌鲁木齐': 87.6, '克拉玛依': 84.9, '吐鲁番': 89.2, '哈密': 93.5, '昌吉': 87.3, '博尔塔拉': 82.1, '巴音郭楞': 86.2, '阿克苏': 80.3,
    '克孜勒苏': 76.2, '喀什': 76.0, '和田': 79.9, '伊犁': 81.3, '塔城': 83.0, '阿勒泰': 88.1, '石河子': 86.0
  },
  '香港': { '香港': 114.2 },
  '澳门': { '澳门': 113.5 },
  '台湾': {
    '台北': 121.6, '新北': 121.5, '桃园': 121.3, '台中': 120.7, '台南': 120.2, '高雄': 120.3
  }
};
const CITY_PROVINCES = Object.keys(CITY_TABLE);
const CITY_LON = {};
const CITY_PROVINCE_OF = {};
CITY_PROVINCES.forEach(function (prov) {
  Object.keys(CITY_TABLE[prov]).forEach(function (nm) { CITY_LON[nm] = CITY_TABLE[prov][nm]; CITY_PROVINCE_OF[nm] = prov; });
});
const CITY_NAMES = Object.keys(CITY_LON);
/* 不带省时能认的名字：和别的省重名的州名（青海的海南）不算，它只在「青海海南」里认 */
const CITY_NAMES_BARE = CITY_NAMES.filter(function (nm) { return !CITY_TABLE[nm] || CITY_PROVINCE_OF[nm] === nm; });

/* names 里在 text 中出现的最长的那个；一样长时取靠后的（「吉林长春」→ 长春）。没有返回 null */
function cityNameIn(text, names) {
  let best = null, bestAt = -1;
  for (let ci = 0; ci < names.length; ci++) {
    const nm = names[ci];
    const at = text.lastIndexOf(nm);
    if (at < 0) continue;
    if (!best || nm.length > best.length || (nm.length === best.length && at > bestAt)) { best = nm; bestAt = at; }
  }
  return best;
}

/* 出生城市框的解析：
 *   empty（不填，按钟表时间）/ city（查到城市，带所在的省）/ number（直接填经度）/
 *   province（只认出了省：范围太大，不给经度，cities 是这个省的城市）/ unknown（查不到）。
 * 以省名开头的只在这个省里找（「北京朝阳」是北京，不是辽宁的朝阳；省写错了不借用别省的城市）；
 * 只写省名而省里有同名城市的按城市（「吉林」），写成「吉林省」按省；直辖市、港澳只有一个城市，就是它。
 * 不以省名开头的在全表里找；一个城市都没有、但提到了省的，按省。 */
function parseBirthplace(text) {
  const raw = String(text == null ? '' : text).trim().replace(/^(中华人民共和国|中国)\s*/, '');
  if (!raw) return { kind: 'empty', lon: null, city: null };
  const num = raw.replace(/^东经\s*/, '').replace(/\s*(°|度)?\s*(E|东)?$/i, '');
  if (/^-?\d+(\.\d+)?$/.test(num)) {
    const v = +num;
    return v >= 60 && v <= 140 ? { kind: 'number', lon: v, city: null } : { kind: 'unknown', lon: null, city: null };
  }
  const cityOf = function (nm) { return { kind: 'city', lon: CITY_LON[nm], city: nm, province: CITY_PROVINCE_OF[nm] }; };
  const provinceOf = function (prov) { return { kind: 'province', lon: null, city: null, province: prov, cities: Object.keys(CITY_TABLE[prov]) }; };
  let prov = null;
  for (let pi = 0; pi < CITY_PROVINCES.length; pi++) {
    if (raw.indexOf(CITY_PROVINCES[pi]) === 0) { prov = CITY_PROVINCES[pi]; break; }
  }
  if (prov) {
    const names = Object.keys(CITY_TABLE[prov]);
    const tail = raw.slice(prov.length).trim();
    const hit = cityNameIn(tail.replace(/^(省|市|(壮族|回族|维吾尔)?自治区|特别行政区)\s*/, ''), names);
    if (hit) return cityOf(hit);
    if (names.length === 1) return cityOf(names[0]);
    if ((tail === '' || tail === '市') && names.indexOf(prov) >= 0) return cityOf(prov);
    return provinceOf(prov);
  }
  const best = cityNameIn(raw, CITY_NAMES_BARE);
  if (best) return cityOf(best);
  let mention = null, mentionAt = -1;
  for (let mi = 0; mi < CITY_PROVINCES.length; mi++) {
    const at = raw.indexOf(CITY_PROVINCES[mi]);
    if (at >= 0 && (mention === null || at < mentionAt)) { mention = CITY_PROVINCES[mi]; mentionAt = at; }
  }
  return mention ? provinceOf(mention) : { kind: 'unknown', lon: null, city: null };
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
