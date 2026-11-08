/* ================================================================
 * 紫微斗数排盘引擎 (纯函数, 无 DOM 依赖)
 * 算法依据《紫微斗数全书》安星诀, 与开源库 iztro (MIT) 的通行实现逐字段对齐验证。
 * 数据表: 农历 1900-2100 (solarlunar@3.1.0, ISC, Copyright (c) 2015, yize)；
 * 抽取方式与许可全文见 THIRD_PARTY_NOTICES.md 与 src/lunar-data.js。
 * 挂载: window.ZWEngine (浏览器) / globalThis.ZWEngine (Node 测试)
 * ================================================================ */
(function (g) {
  'use strict';
  var E = {};

  /* ---------------- 基础常量 ---------------- */
  var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  var ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  var PALACES = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'];
  var MUTAGEN_CH = ['禄', '权', '科', '忌'];
  var CLASS_NUMBER = { 木: 3, 金: 4, 水: 2, 火: 6, 土: 5 };
  var CLASS_NAME = { 2: '水二局', 3: '木三局', 4: '金四局', 5: '土五局', 6: '火六局' };
  var ELEMENT_BY_NUMBER = ['木', '金', '水', '火', '土'];

  /* 五虎遁: 年干 → 寅月天干 */
  var TIGER = { 甲: '丙', 乙: '戊', 丙: '庚', 丁: '壬', 戊: '甲', 己: '丙', 庚: '戊', 辛: '庚', 壬: '壬', 癸: '甲' };

  /* 十天干四化 (禄权科忌) */
  var MUTAGENS = [
    ['廉贞', '破军', '武曲', '太阳'], /* 甲 */
    ['天机', '天梁', '紫微', '太阴'], /* 乙 */
    ['天同', '天机', '文昌', '廉贞'], /* 丙 */
    ['太阴', '天同', '天机', '巨门'], /* 丁 */
    ['贪狼', '太阴', '右弼', '天机'], /* 戊 */
    ['武曲', '贪狼', '天梁', '文曲'], /* 己 */
    ['太阳', '武曲', '太阴', '天同'], /* 庚 */
    ['巨门', '太阳', '文曲', '文昌'], /* 辛 */
    ['天梁', '紫微', '左辅', '武曲'], /* 壬 */
    ['破军', '巨门', '太阴', '贪狼']  /* 癸 */
  ];

  /* 命主(按命宫支), 身主(按年支), 地支序: 子=0 */
  var SOUL_MASTER = ['贪狼', '巨门', '禄存', '文曲', '廉贞', '武曲', '破军', '武曲', '廉贞', '文曲', '禄存', '巨门'];
  var BODY_MASTER = ['火星', '天相', '天梁', '天同', '文昌', '天机', '火星', '天相', '天梁', '天同', '文昌', '天机'];

  /* 星曜亮度表 (宫位索引: 寅=0) */
  var BRIGHTNESS = {
    紫微: ['旺', '旺', '得', '旺', '庙', '庙', '旺', '旺', '得', '旺', '平', '庙'],
    天机: ['得', '旺', '利', '平', '庙', '陷', '得', '旺', '利', '平', '庙', '陷'],
    太阳: ['旺', '庙', '旺', '旺', '旺', '得', '得', '陷', '不', '陷', '陷', '不'],
    武曲: ['得', '利', '庙', '平', '旺', '庙', '得', '利', '庙', '平', '旺', '庙'],
    天同: ['利', '平', '平', '庙', '陷', '不', '旺', '平', '平', '庙', '旺', '不'],
    廉贞: ['庙', '平', '利', '陷', '平', '利', '庙', '平', '利', '陷', '平', '利'],
    天府: ['庙', '得', '庙', '得', '旺', '庙', '得', '旺', '庙', '得', '庙', '庙'],
    太阴: ['旺', '陷', '陷', '陷', '不', '不', '利', '不', '旺', '庙', '庙', '庙'],
    贪狼: ['平', '利', '庙', '陷', '旺', '庙', '平', '利', '庙', '陷', '旺', '庙'],
    巨门: ['庙', '庙', '陷', '旺', '旺', '不', '庙', '庙', '陷', '旺', '旺', '不'],
    天相: ['庙', '陷', '得', '得', '庙', '得', '庙', '陷', '得', '得', '庙', '庙'],
    天梁: ['庙', '庙', '庙', '陷', '庙', '旺', '陷', '得', '庙', '陷', '庙', '旺'],
    七杀: ['庙', '旺', '庙', '平', '旺', '庙', '庙', '庙', '庙', '平', '旺', '庙'],
    破军: ['得', '陷', '旺', '平', '庙', '旺', '得', '陷', '旺', '平', '庙', '旺'],
    文昌: ['陷', '利', '得', '庙', '陷', '利', '得', '庙', '陷', '利', '得', '庙'],
    文曲: ['平', '旺', '得', '庙', '陷', '旺', '得', '庙', '陷', '旺', '得', '庙'],
    火星: ['庙', '利', '陷', '得', '庙', '利', '陷', '得', '庙', '利', '陷', '得'],
    铃星: ['庙', '利', '陷', '得', '庙', '利', '陷', '得', '庙', '利', '陷', '得'],
    擎羊: ['', '陷', '庙', '', '陷', '庙', '', '陷', '庙', '', '陷', '庙'],
    陀罗: ['陷', '', '庙', '陷', '', '庙', '陷', '', '庙', '陷', '', '庙']
  };

  /* 星座 (公历月,日 边界) */
  var SIGNS = [
    [1, 20, '水瓶座'], [2, 19, '双鱼座'], [3, 21, '白羊座'], [4, 20, '金牛座'],
    [5, 21, '双子座'], [6, 22, '巨蟹座'], [7, 23, '狮子座'], [8, 23, '处女座'],
    [9, 23, '天秤座'], [10, 24, '天蝎座'], [11, 23, '射手座'], [12, 22, '摩羯座']
  ];

  /* 农历数据表 (1900-2100) */
  var LUNAR_INFO = [0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, 0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, 0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, 0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, 0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, 0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, 0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0, 0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, 0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, 0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, 0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, 0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, 0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, 0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, 0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, 0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252, 0x0d520];
  var LTERM_INFO = ['9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf97c3598082c95f8c965cc920f', '97bd0b06bdb0722c965ce1cfcc920f', 'b027097bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf97c359801ec95f8c965cc920f', '97bd0b06bdb0722c965ce1cfcc920f', 'b027097bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf97c359801ec95f8c965cc920f', '97bd0b06bdb0722c965ce1cfcc920f', 'b027097bd097c36b0b6fc9274c91aa', '9778397bd19801ec9210c965cc920e', '97b6b97bd19801ec95f8c965cc920f', '97bd09801d98082c95f8e1cfcc920f', '97bd097bd097c36b0b6fc9210c8dc2', '9778397bd197c36c9210c9274c91aa', '97b6b97bd19801ec95f8c965cc920e', '97bd09801d98082c95f8e1cfcc920f', '97bd097bd097c36b0b6fc9210c8dc2', '9778397bd097c36c9210c9274c91aa', '97b6b97bd19801ec95f8c965cc920e', '97bcf97c3598082c95f8e1cfcc920f', '97bd097bd097c36b0b6fc9210c8dc2', '9778397bd097c36c9210c9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf97c3598082c95f8c965cc920f', '97bd097bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf97c3598082c95f8c965cc920f', '97bd097bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf97c359801ec95f8c965cc920f', '97bd097bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf97c359801ec95f8c965cc920f', '97bd097bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf97c359801ec95f8c965cc920f', '97bd097bd07f595b0b6fc920fb0722', '9778397bd097c36b0b6fc9210c8dc2', '9778397bd19801ec9210c9274c920e', '97b6b97bd19801ec95f8c965cc920f', '97bd07f5307f595b0b0bc920fb0722', '7f0e397bd097c36b0b6fc9210c8dc2', '9778397bd097c36c9210c9274c920e', '97b6b97bd19801ec95f8c965cc920f', '97bd07f5307f595b0b0bc920fb0722', '7f0e397bd097c36b0b6fc9210c8dc2', '9778397bd097c36c9210c9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bd07f1487f595b0b0bc920fb0722', '7f0e397bd097c36b0b6fc9210c8dc2', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf7f1487f595b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf7f1487f595b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf7f1487f531b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c965cc920e', '97bcf7f1487f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b97bd19801ec9210c9274c920e', '97bcf7f0e47f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722', '9778397bd097c36b0b6fc9210c91aa', '97b6b97bd197c36c9210c9274c920e', '97bcf7f0e47f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722', '9778397bd097c36b0b6fc9210c8dc2', '9778397bd097c36c9210c9274c920e', '97b6b7f0e47f531b0723b0b6fb0722', '7f0e37f5307f595b0b0bc920fb0722', '7f0e397bd097c36b0b6fc9210c8dc2', '9778397bd097c36b0b70c9274c91aa', '97b6b7f0e47f531b0723b0b6fb0721', '7f0e37f1487f595b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc9210c8dc2', '9778397bd097c36b0b6fc9274c91aa', '97b6b7f0e47f531b0723b0b6fb0721', '7f0e27f1487f595b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722', '9778397bd097c36b0b6fc9274c91aa', '97b6b7f0e47f531b0723b0787b0721', '7f0e27f0e47f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722', '9778397bd097c36b0b6fc9210c91aa', '97b6b7f0e47f149b0723b0787b0721', '7f0e27f0e47f531b0723b0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722', '9778397bd097c36b0b6fc9210c8dc2', '977837f0e37f149b0723b0787b0721', '7f07e7f0e47f531b0723b0b6fb0722', '7f0e37f5307f595b0b0bc920fb0722', '7f0e397bd097c35b0b6fc9210c8dc2', '977837f0e37f14998082b0787b0721', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e37f1487f595b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc9210c8dc2', '977837f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722', '977837f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd097c35b0b6fc920fb0722', '977837f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722', '977837f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722', '977837f0e37f14998082b0787b06bd', '7f07e7f0e47f149b0723b0787b0721', '7f0e27f0e47f531b0b0bb0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722', '977837f0e37f14998082b0723b06bd', '7f07e7f0e37f149b0723b0787b0721', '7f0e27f0e47f531b0723b0b6fb0722', '7f0e397bd07f595b0b0bc920fb0722', '977837f0e37f14898082b0723b02d5', '7ec967f0e37f14998082b0787b0721', '7f07e7f0e47f531b0723b0b6fb0722', '7f0e37f1487f595b0b0bb0b6fb0722', '7f0e37f0e37f14898082b0723b02d5', '7ec967f0e37f14998082b0787b0721', '7f07e7f0e47f531b0723b0b6fb0722', '7f0e37f1487f531b0b0bb0b6fb0722', '7f0e37f0e37f14898082b0723b02d5', '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e37f1487f531b0b0bb0b6fb0722', '7f0e37f0e37f14898082b072297c35', '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e37f0e37f14898082b072297c35', '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e37f0e366aa89801eb072297c35', '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f149b0723b0787b0721', '7f0e27f1487f531b0b0bb0b6fb0722', '7f0e37f0e366aa89801eb072297c35', '7ec967f0e37f14998082b0723b06bd', '7f07e7f0e47f149b0723b0787b0721', '7f0e27f0e47f531b0723b0b6fb0722', '7f0e37f0e366aa89801eb072297c35', '7ec967f0e37f14998082b0723b06bd', '7f07e7f0e37f14998083b0787b0721', '7f0e27f0e47f531b0723b0b6fb0722', '7f0e37f0e366aa89801eb072297c35', '7ec967f0e37f14898082b0723b02d5', '7f07e7f0e37f14998082b0787b0721', '7f07e7f0e47f531b0723b0b6fb0722', '7f0e36665b66aa89801e9808297c35', '665f67f0e37f14898082b0723b02d5', '7ec967f0e37f14998082b0787b0721', '7f07e7f0e47f531b0723b0b6fb0722', '7f0e36665b66a449801e9808297c35', '665f67f0e37f14898082b0723b02d5', '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e36665b66a449801e9808297c35', '665f67f0e37f14898082b072297c35', '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e26665b66a449801e9808297c35', '665f67f0e37f1489801eb072297c35', '7ec967f0e37f14998082b0787b06bd', '7f07e7f0e47f531b0723b0b6fb0721', '7f0e27f1487f531b0b0bb0b6fb0722'];
  var SOLAR_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  /* ---------------- 工具 ---------------- */
  function fix(n, max) { max = max || 12; n = ((n % max) + max) % max; return n; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }

  /* ---------------- 农历换算 (1900-2100) ---------------- */
  function leapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }
  function leapDays(y) { return leapMonth(y) ? (LUNAR_INFO[y - 1900] & 0x10000 ? 30 : 29) : 0; }
  function monthDays(y, m) { return LUNAR_INFO[y - 1900] & (0x10000 >> m) ? 30 : 29; }
  function lYearDays(y) {
    var info = LUNAR_INFO[y - 1900];
    var sum = 348;
    var bits = [0x8000, 0x4000, 0x2000, 0x1000, 0x0800, 0x0400, 0x0200, 0x0100, 0x0080, 0x0040, 0x0020, 0x0010];
    for (var i = 0; i < bits.length; i++) if (info & bits[i]) sum += 1;
    return sum + leapDays(y);
  }
  function solarDays(y, m) {
    if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
    return SOLAR_MONTH[m - 1];
  }
  /* 节气日期: n=1..24 (1=小寒), 返回该节气所在公历"日" */
  function getTerm(y, n) {
    var t = LTERM_INFO[y - 1900];
    var info = [
      parseInt(t.substr(0, 5), 16), parseInt(t.substr(5, 5), 16), parseInt(t.substr(10, 5), 16),
      parseInt(t.substr(15, 5), 16), parseInt(t.substr(20, 5), 16), parseInt(t.substr(25, 5), 16)
    ];
    var cal = [];
    for (var k = 0; k < 6; k++) {
      var s = info[k].toString();
      cal.push(+s.substr(0, 1), +s.substr(1, 2), +s.substr(3, 1), +s.substr(4, 2));
    }
    return cal[n - 1];
  }
  /* 公历 → 农历 */
  function solar2lunar(y, m, d) {
    if (y < 1900 || y > 2100) return null;
    if (y === 1900 && m === 1 && d < 31) return null;
    if (m < 1 || m > 12 || d < 1 || d > solarDays(y, m)) return null;
    var offset = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / 86400000);
    var i, temp = 0;
    for (i = 1900; i < 2101 && offset > 0; i++) { temp = lYearDays(i); offset -= temp; }
    if (offset < 0) { offset += temp; i--; }
    var ly = i;
    var lm = leapMonth(ly);
    var isLeap = false, month;
    for (i = 1; i < 13 && offset > 0; i++) {
      if (lm > 0 && i === lm + 1 && !isLeap) { --i; isLeap = true; temp = leapDays(ly); }
      else { temp = monthDays(ly, i); }
      if (isLeap && i === lm + 1) isLeap = false;
      offset -= temp;
    }
    if (offset === 0 && lm > 0 && i === lm + 1) {
      if (isLeap) isLeap = false;
      else { isLeap = true; --i; }
    }
    if (offset < 0) { offset += temp; --i; }
    month = i;
    var day = offset + 1;
    return { year: ly, month: month, day: day, isLeap: isLeap };
  }
  /* 农历 → 公历 */
  function lunar2solar(y, m, d, isLeapMonth) {
    isLeapMonth = !!isLeapMonth;
    var lm = leapMonth(y);
    if (isLeapMonth && lm !== m) return null;
    if ((y === 2100 && m === 12 && d > 1) || (y === 1900 && m === 1 && d < 31)) return null;
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > monthDays(y, m)) return null;
    var offset = 0;
    for (var i = 1900; i < y; i++) offset += lYearDays(i);
    var isAdd = false;
    for (i = 1; i < m; i++) {
      if (!isAdd) {
        if (lm <= i && lm > 0) { offset += leapDays(y); isAdd = true; }
      }
      offset += monthDays(y, i);
    }
    if (isLeapMonth) offset += monthDays(y, m);
    var stmap = Date.UTC(1900, 1, 30, 0, 0, 0);
    var cal = new Date((offset + d - 31) * 86400000 + stmap);
    return { y: cal.getUTCFullYear(), m: cal.getUTCMonth() + 1, d: cal.getUTCDate() };
  }
  function nextDay(y, m, d) {
    var dt = new Date(Date.UTC(y, m - 1, d) + 86400000);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  function totalDaysOfLunarMonth(lunar) {
    return lunar.isLeap ? leapDays(lunar.year) : monthDays(lunar.year, lunar.month);
  }

  /* ---------------- 四柱 ---------------- */
  function timeIndexFromHour(hour) {
    if (hour === 0) return 0;          /* 00:00-01:00 早子时 */
    if (hour === 23) return 12;        /* 23:00-24:00 晚子时 */
    return Math.floor((hour + 1) / 2);
  }
  /* 时+分 → 时辰索引 (与 timeIndexFromHour 一致, 分钟级精度供真太阳时校正用) */
  function timeIndexFromHourMinute(hour, minute) {
    var m = hour * 60 + minute;
    if (m >= 23 * 60) return 12;       /* 晚子时 */
    if (m < 60) return 0;              /* 早子时 */
    return Math.floor((m + 60) / 120) % 12;
  }
  /* 均时差 (equation of time) 近似式: 全年误差 < 约 1 分钟 (与紫微师 run-paipan 同式) */
  function equationOfTimeMinutes(sy, sm, sd) {
    var days = [31, ((sy % 4 === 0 && sy % 100 !== 0) || sy % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var n = sd;
    for (var i = 0; i < sm - 1; i++) n += days[i];
    var B = ((360 / 365) * (n - 81) * Math.PI) / 180;
    return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); /* 分钟 */
  }
  /* 年柱: yearDivide = 'normal'(正月初一) | 'exact'(立春) */
  function yearGanZhi(sy, sm, sd, divide) {
    var lunar = solar2lunar(sy, sm, sd);
    var gy;
    if (divide === 'exact') {
      var term3 = getTerm(sy, 3);
      gy = (sm < 2 || (sm === 2 && sd < term3)) ? sy - 1 : sy;
    } else {
      gy = lunar.year;
    }
    return { year: gy, stem: GAN[fix(gy - 4, 10)], branch: ZHI[fix(gy - 4, 12)] };
  }
  /* 月柱 (按农历月, 五虎遁; 闰月下半月按下月) */
  function monthGanZhiNormal(lunar, yearStemIdx) {
    var add = lunar.isLeap && lunar.day > 15 ? 1 : 0;
    var m = fix(lunar.month - 1 + add);
    return { stem: GAN[fix(GAN.indexOf(TIGER[GAN[yearStemIdx]]) + m, 10)], branch: ZHI[fix(m + 2, 12)] };
  }
  /* 月柱 (按节气): 月支由"节"定, 月干用立春年干五虎遁 (与 lunar-typescript exact 等价) */
  function monthGanZhiExact(sy, sm, sd) {
    var JIE = [[1, 11], [3, 0], [5, 1], [7, 2], [9, 3], [11, 4], [13, 5], [15, 6], [17, 7], [19, 8], [21, 9], [23, 10]];
    var zhiIdx = 10; /* 小寒前 → 子月 */
    for (var i = 0; i < JIE.length; i++) {
      var n = JIE[i][0];
      var tm = Math.floor((n - 1) / 2) + 1;
      var td = getTerm(sy, n);
      if (sm > tm || (sm === tm && sd >= td)) zhiIdx = JIE[i][1];
    }
    var term3 = getTerm(sy, 3);
    var beforeLichun = (sm < 2) || (sm === 2 && sd < term3);
    var ygIdx = fix((beforeLichun ? sy - 1 : sy) - 4, 10);
    var stem = GAN[fix(GAN.indexOf(TIGER[GAN[ygIdx]]) + zhiIdx, 10)];
    return { stem: stem, branch: ZHI[fix(zhiIdx + 2, 12)] };
  }
  /* 日柱: 干支序 (甲子=0) */
  function dayGanZhiIndex(y, m, d) {
    var dayCyclical = Date.UTC(y, m - 1, 1) / 86400000 + 25567 + 10;
    return fix(dayCyclical + d - 1, 60);
  }
  /* 时柱: 五鼠遁, timeIndex 12(晚子时)按子 */
  function hourGanZhi(dayGzIdx, timeIndex) {
    var zIdx = fix(timeIndex);
    var stemStart = ((dayGzIdx % 10) % 5) * 2 % 10;
    return { stem: GAN[fix(stemStart + zIdx, 10)], branch: ZHI[zIdx] };
  }

  /* ---------------- 安命身宫 ---------------- */
  /* 闰月下半月(15日后)按下月, 晚子时不加 */
  function fixLunarMonthIndex(lunar, timeIndex, fixLeap) {
    var idx = lunar.month - 1;
    if (lunar.isLeap && fixLeap && lunar.day > 15 && timeIndex !== 12) idx += 1;
    return fix(idx);
  }
  function soulBody(monthIdx, timeBranchIdx) {
    return { soul: fix(monthIdx - timeBranchIdx), body: fix(monthIdx + timeBranchIdx) };
  }
  /* 五行局 (纳音法) */
  function fiveElementClass(stemIdx, branchIdx) {
    var sNum = Math.floor(stemIdx / 2) + 1;
    var bNum = Math.floor(fix(branchIdx, 6) / 2) + 1;
    var idx = sNum + bNum;
    while (idx > 5) idx -= 5;
    var el = ELEMENT_BY_NUMBER[idx - 1];
    var num = CLASS_NUMBER[el];
    return { element: el, number: num, name: CLASS_NAME[num] };
  }
  /* 紫微/天府定位 */
  function startIndex(lunarDay, k) {
    var offset = -1, quotient, remainder;
    do {
      offset++;
      var divisor = lunarDay + offset;
      quotient = Math.floor(divisor / k);
      remainder = divisor % k;
    } while (remainder !== 0);
    quotient %= 12;
    var ziwei = quotient - 1;
    ziwei += offset % 2 === 0 ? offset : -offset;
    ziwei = fix(ziwei);
    var tianfu = fix(12 - ziwei);
    return { ziwei: ziwei, tianfu: tianfu };
  }
  /* 十二宫名 (从命宫逆排) */
  function palaceNames(soulIndex) {
    var names = [];
    for (var i = 0; i < 12; i++) names[i] = PALACES[fix(i - soulIndex)];
    return names;
  }
  /* 大限: 阳男阴女顺行, 每宫十年 */
  function horoscope(soulIndex, gender, yearBranchIdx, classNumber, yearStem) {
    var forward = (gender === 'male') === (yearBranchIdx % 2 === 0);
    var decadals = [];
    for (var i = 0; i < 12; i++) {
      var idx = forward ? fix(soulIndex + i) : fix(soulIndex - i);
      var start = classNumber + 10 * i;
      var stem = GAN[fix(GAN.indexOf(TIGER[yearStem]) + idx, 10)];
      var branch = ZHI[fix(idx + 2, 12)];
      decadals[idx] = { stem: stem, branch: branch, range: [start, start + 9] };
    }
    return decadals;
  }
  /* 小限: 寅午戌人辰上起, 男顺女逆 */
  function ageIndex(yearBranchIdx) {
    var b = fix(yearBranchIdx);
    if (b === 2 || b === 6 || b === 10) return 2;   /* 寅午戌 → 辰 */
    if (b === 8 || b === 0 || b === 4) return 8;    /* 申子辰 → 戌 */
    if (b === 5 || b === 9 || b === 1) return 5;    /* 巳酉丑 → 未 */
    return 11;                                       /* 亥卯未 → 丑 */
  }
  function smallAges(yearBranchIdx, gender) {
    var idx0 = ageIndex(yearBranchIdx);
    var out = [];
    for (var i = 0; i < 12; i++) {
      var idx = gender === 'male' ? fix(idx0 + i) : fix(idx0 - i);
      var arr = [];
      for (var j = 0; j < 10; j++) arr.push(12 * j + i + 1);
      out[idx] = arr;
    }
    return out;
  }

  /* ---------------- 辅星 ---------------- */
  /* 地支(子=0) → 宫位索引(寅=0) */
  function ebIdx(name) { return fix(ZHI.indexOf(name) - 2); }
  function getZuoYou(monthIdx) { return { zuo: fix(2 + monthIdx), you: fix(8 - monthIdx) }; }
  function getChangQu(timeIndex) {
    var t = fix(timeIndex);
    return { chang: fix(8 - t), qu: fix(2 + t) };
  }
  function getKuiYue(yearStemIdx) {
    var table = { 0: [11, 5], 1: [10, 6], 2: [9, 7], 3: [9, 7], 4: [11, 5], 5: [10, 6], 6: [11, 5], 7: [4, 0], 8: [1, 3], 9: [1, 3] };
    /* 甲戊庚→丑未, 乙己→子申, 丙丁→亥酉, 辛→午寅, 壬癸→卯巳 */
    var v = table[yearStemIdx];
    return { kui: v[0], yue: v[1] };
  }
  function getLuYangTuoMa(yearStemIdx, yearBranchIdx) {
    var lu = { 0: 0, 1: 1, 2: 3, 3: 4, 4: 3, 5: 4, 6: 6, 7: 7, 8: 9, 9: 10 }[yearStemIdx];
    var b = fix(yearBranchIdx);
    var ma = 0;
    if (b === 2 || b === 6 || b === 10) ma = 6;        /* 寅午戌 → 申 */
    else if (b === 8 || b === 0 || b === 4) ma = 0;    /* 申子辰 → 寅 */
    else if (b === 5 || b === 9 || b === 1) ma = 9;    /* 巳酉丑 → 亥 */
    else ma = 3;                                        /* 亥卯未 → 巳 */
    return { lu: lu, yang: fix(lu + 1), tuo: fix(lu - 1), ma: ma };
  }
  function getHuoLing(yearBranchIdx, timeIndex) {
    var t = fix(timeIndex);
    var b = fix(yearBranchIdx);
    var huo, ling;
    if (b === 2 || b === 6 || b === 10) { huo = 11 + t; ling = 1 + t; }       /* 寅午戌 → 丑/卯起 */
    else if (b === 8 || b === 0 || b === 4) { huo = 0 + t; ling = 8 + t; }    /* 申子辰 → 寅/戌起 */
    else if (b === 5 || b === 9 || b === 1) { huo = 1 + t; ling = 8 + t; }    /* 巳酉丑 → 卯/戌起 */
    else { huo = 7 + t; ling = 8 + t; }                                        /* 亥卯未 → 酉/戌起 */
    return { huo: fix(huo), ling: fix(ling) };
  }
  function getKongJie(timeIndex) {
    var t = fix(timeIndex);
    return { kong: fix(9 - t), jie: fix(9 + t) };
  }

  /* ---------------- 杂曜 ---------------- */
  function getLuanXi(yearBranchIdx) {
    var hongluan = fix(1 - fix(yearBranchIdx));
    return { hongluan: hongluan, tianxi: fix(hongluan + 6) };
  }
  function getHuagaiXianchi(yearBranchIdx) {
    var b = fix(yearBranchIdx);
    if (b === 2 || b === 6 || b === 10) return { huagai: 8, xianchi: 1 };
    if (b === 8 || b === 0 || b === 4) return { huagai: 2, xianchi: 7 };
    if (b === 5 || b === 9 || b === 1) return { huagai: 11, xianchi: 4 };
    return { huagai: 5, xianchi: 10 };
  }
  function getGuGua(yearBranchIdx) {
    var b = fix(yearBranchIdx);
    if (b >= 2 && b <= 4) return { gu: 3, gua: 11 };      /* 寅卯辰 → 巳丑 */
    if (b >= 5 && b <= 7) return { gu: 6, gua: 2 };       /* 巳午未 → 申辰 */
    if (b >= 8 && b <= 10) return { gu: 9, gua: 5 };      /* 申酉戌 → 亥未 */
    return { gu: 0, gua: 8 };                              /* 亥子丑 → 寅戌 */
  }
  function getNianJie(yearBranchIdx) { return fix(8 - fix(yearBranchIdx)); }
  function getDailyStars(monthIdx, timeIndex, lunar) {
    var dayIdx = timeIndex >= 12 ? lunar.day : lunar.day - 1;
    var zu = getZuoYou(monthIdx);
    var cq = getChangQu(timeIndex);
    return {
      santai: fix(zu.zuo + dayIdx),
      bazuo: fix(zu.you - dayIdx),
      enguang: fix(fix(cq.chang + dayIdx) - 1),
      tiangui: fix(fix(cq.qu + dayIdx) - 1)
    };
  }
  function getTimelyStars(timeIndex) {
    var t = fix(timeIndex);
    return { taifu: fix(4 + t), fenggao: fix(0 + t) };
  }
  function getMonthlyStars(monthIdx) {
    var m = fix(monthIdx);
    return {
      jieshen: ebIdx(['申', '戌', '子', '寅', '辰', '午'][Math.floor(m / 2)]),
      tianyao: fix(11 + m),
      tianxing: fix(7 + m),
      yinsha: ebIdx(['寅', '子', '戌', '申', '午', '辰'][m % 6]),
      tianyue: ebIdx(['戌', '巳', '辰', '寅', '未', '卯', '亥', '未', '寅', '午', '戌', '寅'][m]),
      tianwu: ebIdx(['巳', '申', '寅', '亥'][m % 4])
    };
  }
  function getYearlyStars(soulIndex, bodyIndex, yearStemIdx, yearBranchIdx) {
    var b = fix(yearBranchIdx);
    return {
      xianchi: getHuagaiXianchi(b).xianchi,
      huagai: getHuagaiXianchi(b).huagai,
      guchen: getGuGua(b).gu,
      guasu: getGuGua(b).gua,
      tiancai: fix(soulIndex + b),
      tianshou: fix(bodyIndex + b),
      tianchu: ebIdx(['巳', '午', '子', '巳', '午', '申', '寅', '午', '酉', '亥'][yearStemIdx]),
      posui: ebIdx(['巳', '丑', '酉'][b % 3]),
      feilian: ebIdx(['申', '酉', '戌', '巳', '午', '未', '寅', '卯', '辰', '亥', '子', '丑'][b]),
      longchi: fix(2 + b),
      fengge: fix(8 - b),
      tianku: fix(4 - b),
      tianxu: fix(4 + b),
      tianguan: ebIdx(['未', '辰', '巳', '寅', '卯', '酉', '亥', '酉', '戌', '午'][yearStemIdx]),
      tianfu: ebIdx(['酉', '申', '子', '亥', '卯', '寅', '午', '巳', '午', '巳'][yearStemIdx]),
      tiande: fix(7 + b),
      yuede: fix(3 + b),
      tiankong: fix(b - 1),
      jielu: ebIdx(['申', '午', '辰', '寅', '子'][yearStemIdx % 5]),
      kongwang: ebIdx(['酉', '未', '巳', '卯', '丑'][yearStemIdx % 5]),
      xunkong: (function () {
        var xk = fix(b - yearStemIdx + 8);
        if (b % 2 !== xk % 2) xk = fix(xk + 1);
        return xk;
      })(),
      tianshang: fix(soulIndex + 5),
      tianshi: fix(soulIndex + 7),
      nianjie: getNianJie(b)
    };
  }

  /* ---------------- 十二神 ---------------- */
  var CHANGSHENG12 = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  var BOSHI12 = ['博士', '力士', '青龙', '小耗', '将军', '奏书', '飞廉', '喜神', '病符', '大耗', '伏兵', '官府'];
  var SUIQIAN12 = ['岁建', '晦气', '丧门', '贯索', '官符', '小耗', '大耗', '龙德', '白虎', '天德', '吊客', '病符'];
  var JIANGQIAN12 = ['将星', '攀鞍', '岁驿', '息神', '华盖', '劫煞', '灾煞', '天煞', '指背', '咸池', '月煞', '亡神'];
  function changsheng12Start(classNumber) {
    if (classNumber === 2) return 6;   /* 水二局 → 申 */
    if (classNumber === 3) return 9;   /* 木三局 → 亥 */
    if (classNumber === 4) return 3;   /* 金四局 → 巳 */
    if (classNumber === 5) return 6;   /* 土五局 → 申 */
    return 0;                           /* 火六局 → 寅 */
  }
  function distribute(names, startIdx, forward) {
    var out = [];
    for (var i = 0; i < 12; i++) {
      var idx = forward ? fix(i + startIdx) : fix(startIdx - i);
      out[idx] = names[i];
    }
    return out;
  }
  function jiangqianStart(yearBranchIdx) {
    var b = fix(yearBranchIdx);
    if (b === 2 || b === 6 || b === 10) return 4;    /* 寅午戌 → 午 */
    if (b === 8 || b === 0 || b === 4) return 10;    /* 申子辰 → 子 */
    if (b === 5 || b === 9 || b === 1) return 7;     /* 巳酉丑 → 酉 */
    return 1;                                         /* 亥卯未 → 卯 */
  }

  /* ---------------- 主星 ---------------- */
  var ZIWEI_GROUP = [[0, '紫微'], [1, '天机'], [3, '太阳'], [4, '武曲'], [5, '天同'], [8, '廉贞']];
  var TIANFU_GROUP = [[0, '天府'], [1, '太阴'], [2, '贪狼'], [3, '巨门'], [4, '天相'], [5, '天梁'], [6, '七杀'], [10, '破军']];
  var MINOR_SOFT = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺'];
  var MINOR_TOUGH = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];

  function mutagenOf(starName, yearStemIdx) {
    var arr = MUTAGENS[yearStemIdx];
    for (var i = 0; i < 4; i++) if (arr[i] === starName) return MUTAGEN_CH[i];
    return '';
  }
  function brightnessOf(starName, palaceIdx) {
    var table = BRIGHTNESS[starName];
    if (!table) return '';
    return table[fix(palaceIdx)] || '';
  }
  function makeStar(name, palaceIdx, yearStemIdx, kind) {
    var s = { name: name, kind: kind, mutagen: mutagenOf(name, yearStemIdx) };
    var b = brightnessOf(name, palaceIdx);
    if (b) s.brightness = b;
    return s;
  }

  /* ---------------- 主入口 ---------------- */
  /**
   * 排盘
   * input: {
   *   calendar: 'solar'|'lunar', year, month, day, isLeapMonth?, hour, minute, gender: 'male'|'female',
   *   settings?: { yearDivide: 'normal'|'exact', dayDivide: 'forward'|'current', fixLeap: bool }
   * }
   */
  function computeChart(input) {
    var settings = {
      yearDivide: 'normal',
      monthDivide: 'normal',
      /* 晚子时安星口径: 'current' = 仍按当日（紫微师/独立版 iztro runner 的口径），
         'forward' = 换到次日。默认取 'current'，保证同一生辰在这里与紫微师
         来源产品排出同一张盘（约 1/13 的出生时间落在 23 点段）。 */
      dayDivide: 'current',
      fixLeap: true
    };
    if (input.settings) {
      if (input.settings.yearDivide) settings.yearDivide = input.settings.yearDivide;
      if (input.settings.monthDivide) settings.monthDivide = input.settings.monthDivide;
      if (input.settings.dayDivide) settings.dayDivide = input.settings.dayDivide;
      if (typeof input.settings.fixLeap === 'boolean') settings.fixLeap = input.settings.fixLeap;
    }
    var gender = input.gender === 'female' ? 'female' : 'male';
    var hour = Math.min(23, Math.max(0, Math.floor(input.hour || 0)));
    var minute = Math.min(59, Math.max(0, Math.floor(input.minute || 0)));

    /* 1) 转为公历 */
    var sy, sm, sd;
    if (input.calendar === 'lunar') {
      var conv = lunar2solar(input.year, input.month, input.day, input.isLeapMonth);
      if (!conv) return { error: '农历日期无效或超出 1900-2100 支持范围' };
      sy = conv.y; sm = conv.m; sd = conv.d;
    } else {
      sy = input.year; sm = input.month; sd = input.day;
    }
    if (sy < 1900 || sy > 2100 || (sy === 1900 && sm === 1 && sd < 31) || (sy === 2100 && sm === 12 && sd > 31)) {
      return { error: '公历日期需在 1900-01-31 至 2100-12-31 之间' };
    }
    if (sm < 1 || sm > 12 || sd < 1 || sd > solarDays(sy, sm)) return { error: '公历日期无效' };

    /* 2) 时辰 (可选真太阳时校正: 出生地经度 60~140) */
    var useHour = hour, useMinute = minute;
    var solarCorrection = null;
    var lonNum = Number(input.longitude);
    if (isFinite(lonNum) && lonNum >= 60 && lonNum <= 140) {
      var lonMin = (lonNum - 120) * 4;                       /* 经度差 × 4 分钟 */
      var eotMin = equationOfTimeMinutes(sy, sm, sd);        /* 均时差 */
      var totalMin = Math.round(hour * 60 + minute + lonMin + eotMin);
      totalMin = ((totalMin % 1440) + 1440) % 1440;          /* 归一化 0~1439, 不换日 */
      useHour = Math.floor(totalMin / 60);
      useMinute = totalMin % 60;
      var sinceStart = (((totalMin - 23 * 60) % 1440) + 1440) % 1440;
      var inChen = sinceStart % 120;
      var dist = Math.min(inChen, 120 - inChen);
      solarCorrection = {
        longitude: lonNum,
        longitudeMinutes: Math.round(lonMin * 10) / 10,
        eotMinutes: Math.round(eotMin * 10) / 10,
        solarTime: pad2(useHour) + ':' + pad2(useMinute),
        boundaryWarning: dist < 3
      };
    }
    var timeIndex = timeIndexFromHourMinute(useHour, useMinute);
    var tIndex = timeIndex;
    if (settings.dayDivide === 'current' && tIndex >= 12) tIndex = 0;
    var lateZi = timeIndex === 12 && settings.dayDivide !== 'current';

    /* 3) 农历 (按原始日期) */
    var lunar = solar2lunar(sy, sm, sd);

    /* 4) 四柱: 年柱/月柱按出生当日(晚子时不换日), 日柱/时柱晚子时按次日(换日派) */
    var ey = sy, em = sm, ed = sd;
    if (lateZi) { var nx = nextDay(sy, sm, sd); ey = nx.y; em = nx.m; ed = nx.d; }
    var yGZ = yearGanZhi(sy, sm, sd, settings.yearDivide);
    var mGZ = settings.monthDivide === 'exact'
      ? monthGanZhiExact(sy, sm, sd)
      : monthGanZhiNormal(lunar, GAN.indexOf(yGZ.stem));
    var dGZIdx = dayGanZhiIndex(ey, em, ed);
    var hGZ = hourGanZhi(dGZIdx, timeIndex);
    var yearStemIdx = GAN.indexOf(yGZ.stem);
    var yearBranchIdx = ZHI.indexOf(yGZ.branch);

    /* 5) 命宫身宫 */
    var monthIdx = fixLunarMonthIndex(lunar, tIndex, settings.fixLeap);
    var timeBranchIdx = fix(timeIndex);
    var sb = soulBody(monthIdx, timeBranchIdx);
    var soulIndex = sb.soul, bodyIndex = sb.body;
    var soulStemIdx = fix(GAN.indexOf(TIGER[yGZ.stem]) + soulIndex, 10);
    var soulBranchIdx = fix(soulIndex + 2, 12);
    var fec = fiveElementClass(soulStemIdx, soulBranchIdx);

    /* 6) 紫微天府 */
    var lunarDayEff = lunar.day;
    if (lateZi) {
      lunarDayEff += 1;
      var maxD = totalDaysOfLunarMonth(lunar);
      if (lunarDayEff > maxD) lunarDayEff -= maxD;
    }
    var st = startIndex(lunarDayEff, fec.number);

    /* 7) 十二宫 */
    var names = palaceNames(soulIndex);
    var major = [[], [], [], [], [], [], [], [], [], [], [], []];
    var minor = [[], [], [], [], [], [], [], [], [], [], [], []];
    for (var i = 0; i < ZIWEI_GROUP.length; i++) {
      var idx = fix(st.ziwei - ZIWEI_GROUP[i][0]);
      major[idx].push(makeStar(ZIWEI_GROUP[i][1], idx, yearStemIdx, 'major'));
    }
    for (i = 0; i < TIANFU_GROUP.length; i++) {
      idx = fix(st.tianfu + TIANFU_GROUP[i][0]);
      major[idx].push(makeStar(TIANFU_GROUP[i][1], idx, yearStemIdx, 'major'));
    }
    /* 辅星 */
    var zu = getZuoYou(monthIdx);
    var cq = getChangQu(timeIndex);
    var ky = getKuiYue(yearStemIdx);
    var hl = getHuoLing(yearBranchIdx, timeIndex);
    var kj = getKongJie(timeIndex);
    var lytm = getLuYangTuoMa(yearStemIdx, yearBranchIdx);
    var minorDefs = [
      [zu.zuo, '左辅', 'soft'], [zu.you, '右弼', 'soft'],
      [cq.chang, '文昌', 'soft'], [cq.qu, '文曲', 'soft'],
      [ky.kui, '天魁', 'soft'], [ky.yue, '天钺', 'soft'],
      [lytm.lu, '禄存', 'lucun'], [lytm.ma, '天马', 'tianma'],
      [kj.kong, '地空', 'tough'], [kj.jie, '地劫', 'tough'],
      [hl.huo, '火星', 'tough'], [hl.ling, '铃星', 'tough'],
      [lytm.yang, '擎羊', 'tough'], [lytm.tuo, '陀罗', 'tough']
    ];
    for (i = 0; i < minorDefs.length; i++) {
      minor[minorDefs[i][0]].push(makeStar(minorDefs[i][1], minorDefs[i][0], yearStemIdx, minorDefs[i][2]));
    }
    /* 杂曜 */
    var ys = getYearlyStars(soulIndex, bodyIndex, yearStemIdx, yearBranchIdx);
    var ms = getMonthlyStars(monthIdx);
    var ds = getDailyStars(monthIdx, tIndex, lunar);
    var ts = getTimelyStars(timeIndex);
    var lx = getLuanXi(yearBranchIdx);
    var adjective = [[], [], [], [], [], [], [], [], [], [], [], []];
    var adjDefs = [
      [lx.hongluan, '红鸾'], [lx.tianxi, '天喜'], [ms.tianyao, '天姚'], [ys.xianchi, '咸池'],
      [ms.jieshen, '解神'], [ds.santai, '三台'], [ds.bazuo, '八座'], [ds.enguang, '恩光'], [ds.tiangui, '天贵'],
      [ys.longchi, '龙池'], [ys.fengge, '凤阁'], [ys.tiancai, '天才'], [ys.tianshou, '天寿'],
      [ts.taifu, '台辅'], [ts.fenggao, '封诰'], [ms.tianwu, '天巫'], [ys.huagai, '华盖'],
      [ys.tianguan, '天官'], [ys.tianfu, '天福'], [ys.tianchu, '天厨'], [ms.tianyue, '天月'],
      [ys.tiande, '天德'], [ys.yuede, '月德'], [ys.tiankong, '天空'], [ys.xunkong, '旬空'],
      [ys.jielu, '截路'], [ys.kongwang, '空亡'], [ys.guchen, '孤辰'], [ys.guasu, '寡宿'],
      [ys.feilian, '蜚廉'], [ys.posui, '破碎'], [ms.tianxing, '天刑'], [ms.yinsha, '阴煞'],
      [ys.tianku, '天哭'], [ys.tianxu, '天虚'], [ys.tianshi, '天使'], [ys.tianshang, '天伤'],
      [ys.nianjie, '年解']
    ];
    for (i = 0; i < adjDefs.length; i++) adjective[adjDefs[i][0]].push(adjDefs[i][1]);
    /* 十二神 */
    var forward = (gender === 'male') === (yearBranchIdx % 2 === 0);
    var cs12 = distribute(CHANGSHENG12, changsheng12Start(fec.number), forward);
    var bs12 = distribute(BOSHI12, lytm.lu, forward);
    var sq12 = distribute(SUIQIAN12, ebIdx(yGZ.branch), true);
    var jq12 = distribute(JIANGQIAN12, jiangqianStart(yearBranchIdx), true);
    /* 大限小限 */
    var decadals = horoscope(soulIndex, gender, yearBranchIdx, fec.number, yGZ.stem);
    var ages = smallAges(yearBranchIdx, gender);

    /* 8) 宫位装配 */
    var palaces = [];
    for (i = 0; i < 12; i++) {
      palaces.push({
        index: i,
        name: names[i],
        stem: GAN[fix(soulStemIdx - soulIndex + i, 10)],
        branch: ZHI[fix(i + 2, 12)],
        isBody: bodyIndex === i,
        major: major[i],
        minor: minor[i],
        adjective: adjective[i],
        changsheng12: cs12[i],
        boshi12: bs12[i],
        suiqian12: sq12[i],
        jiangqian12: jq12[i],
        decadal: decadals[i],
        ages: ages[i]
      });
    }
    /* 四化汇总 */
    var mutagens = [];
    for (var mIdx = 0; mIdx < 4; mIdx++) {
      var starName = MUTAGENS[yearStemIdx][mIdx];
      var found = null;
      for (i = 0; i < 12 && !found; i++) {
        var allStars = palaces[i].major.concat(palaces[i].minor);
        for (var j = 0; j < allStars.length; j++) {
          if (allStars[j].name === starName) { found = { palace: palaces[i], palaceIndex: i, star: allStars[j] }; break; }
        }
      }
      if (found) mutagens.push({ mutagen: MUTAGEN_CH[mIdx], star: starName, palaceIndex: found.palaceIndex, palaceName: found.palace.name });
    }
    /* 星座 */
    var sign = '摩羯座';
    for (i = 0; i < SIGNS.length; i++) {
      if (sm > SIGNS[i][0] || (sm === SIGNS[i][0] && sd >= SIGNS[i][1])) sign = SIGNS[i][2];
    }

    return {
      meta: {
        calendar: input.calendar,
        inputYear: input.year, inputMonth: input.month, inputDay: input.day,
        isLeapMonth: !!input.isLeapMonth,
        hour: hour, minute: minute,
        solarCorrection: solarCorrection,
        gender: gender,
        settings: settings
      },
      solarDate: fmtDate(sy, sm, sd),
      lunar: lunar,
      lunarText: (lunar.isLeap ? '闰' : '') + lunar.month + '月' + (function () {
        var cn = ['初', '十', '廿', '三'];
        return lunar.day === 10 ? '初十' : lunar.day === 20 ? '二十' : lunar.day === 30 ? '三十' :
          cn[Math.floor(lunar.day / 10)] + ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][lunar.day % 10 - 1] + (lunar.day <= 10 ? '' : '');
      })(),
      timeIndex: timeIndex,
      timeName: ['早子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时', '晚子时'][timeIndex],
      timeRange: ['00:00~01:00', '01:00~03:00', '03:00~05:00', '05:00~07:00', '07:00~09:00', '09:00~11:00', '11:00~13:00', '13:00~15:00', '15:00~17:00', '17:00~19:00', '19:00~21:00', '21:00~23:00', '23:00~00:00'][timeIndex],
      pillars: {
        yearly: yGZ.stem + yGZ.branch,
        monthly: mGZ.stem + mGZ.branch,
        daily: GAN[dGZIdx % 10] + ZHI[dGZIdx % 12],
        hourly: hGZ.stem + hGZ.branch
      },
      zodiac: ZODIAC[fix(yGZ.year - 4, 12)],
      sign: sign,
      soulIndex: soulIndex,
      bodyIndex: bodyIndex,
      soulBranch: ZHI[soulBranchIdx],
      bodyBranch: ZHI[fix(bodyIndex + 2, 12)],
      soulMaster: SOUL_MASTER[soulBranchIdx],
      bodyMaster: BODY_MASTER[yearBranchIdx],
      fiveElementsClass: fec.name,
      startAge: fec.number,
      ziweiIndex: st.ziwei,
      tianfuIndex: st.tianfu,
      palaces: palaces,
      mutagens: mutagens
    };
  }

  /* 文本命盘 */
  function chartText(chart) {
    var L = [];
    L.push('════ 紫微斗数命盘 ════');
    L.push('四柱: ' + chart.pillars.yearly + ' ' + chart.pillars.monthly + ' ' + chart.pillars.daily + ' ' + chart.pillars.hourly);
    L.push('农历: ' + chart.lunar.year + '年' + chart.lunarText + ' ' + chart.timeName);
    if (chart.meta && chart.meta.solarCorrection) {
      var sc = chart.meta.solarCorrection;
      L.push('真太阳时: ' + sc.solarTime + ' (经度' + sc.longitude + '°E, 经度修正' + (sc.longitudeMinutes > 0 ? '+' : '') + sc.longitudeMinutes + '分, 均时差' + (sc.eotMinutes > 0 ? '+' : '') + sc.eotMinutes + '分)' + (sc.boundaryWarning ? ' ⚠ 时辰边界告警' : ''));
    } else {
      L.push('真太阳时: 未校正 (未提供出生地经度, 按钟表时间直排)');
    }
    L.push('命宫: ' + chart.soulBranch + ' | 身宫: ' + chart.bodyBranch + ' | 五行局: ' + chart.fiveElementsClass + ' | 生肖: ' + chart.zodiac);
    L.push('命主: ' + chart.soulMaster + ' | 身主: ' + chart.bodyMaster + ' | 起运: ' + chart.startAge + '岁');
    L.push('四化: ' + chart.mutagens.map(function (m) { return m.star + '化' + m.mutagen + '(' + m.palaceName + ')'; }).join(' '));
    for (var i = 0; i < 12; i++) {
      var p = chart.palaces[i];
      var stars = p.major.concat(p.minor).map(function (s) {
        return s.name + (s.brightness ? '[' + s.brightness + ']' : '') + (s.mutagen ? '·化' + s.mutagen : '');
      });
      var dec = p.decadal.range[0] + '-' + p.decadal.range[1];
      L.push(p.name + '(' + p.stem + p.branch + ')' + (p.isBody ? '·身宫' : '') + ' 大限' + dec +
        (stars.length ? ' | ' + stars.join(' ') : ''));
    }
    return L.join('\n');
  }

  /* ---------------- 运限推运 (大限/小限/流年/流月/流日/流时) ---------------- */
  /* 流昌流曲表 (按运限天干) */
  var CHANG_QU_BY_STEM = [[3, 7], [4, 6], [6, 4], [7, 3], [6, 4], [7, 3], [9, 1], [10, 0], [0, 10], [1, 9]];
  var HS_PREFIX = { decadal: '运', yearly: '流', monthly: '月', daily: '日', hourly: '时' };
  function horoscopeStars(stemIdx, branchIdx, scope) {
    var p = HS_PREFIX[scope] || '流';
    var ky = getKuiYue(stemIdx);
    var cq = CHANG_QU_BY_STEM[stemIdx];
    var lytm = getLuYangTuoMa(stemIdx, branchIdx);
    var lx = getLuanXi(branchIdx);
    var stars = [[], [], [], [], [], [], [], [], [], [], [], []];
    var defs = [
      [ky.kui, p + '魁', 'soft'], [ky.yue, p + '钺', 'soft'],
      [cq[0], p + '昌', 'soft'], [cq[1], p + '曲', 'soft'],
      [lytm.lu, p + '禄', 'lucun'], [lytm.yang, p + '羊', 'tough'], [lytm.tuo, p + '陀', 'tough'],
      [lytm.ma, p + '马', 'tianma'], [lx.hongluan, p + '鸾', 'flower'], [lx.tianxi, p + '喜', 'flower']
    ];
    if (scope === 'yearly') defs.push([getNianJie(branchIdx), '年解', 'helper']);
    for (var i = 0; i < defs.length; i++) {
      stars[defs[i][0]].push({ name: defs[i][1], kind: defs[i][2], mutagen: '' });
    }
    return stars;
  }
  function scopeMutagenNames(stemIdx) {
    return MUTAGENS[stemIdx].slice();
  }
  function scopePalaceNames(index) { return palaceNames(index); }
  /* 童限宫 (未起运): 一命二财三疾厄, 四岁夫妻五福德, 六岁事业 */
  function childhoodPalaceIndex(chart, nominalAge) {
    var table = ['命宫', '财帛', '疾厄', '夫妻', '福德', '官禄'];
    var name = table[nominalAge - 1];
    if (!name) return -1;
    var k = PALACES.indexOf(name);
    return fix(chart.soulIndex + k);
  }
  /* 完整运限盘: target = {y, m, d} 公历 */
  function computeHoroscope(chart, target) {
    var birthday = chart.lunar;
    var date = solar2lunar(target.y, target.m, target.d);
    if (!date) return { error: '目标日期超出支持范围' };
    var ti = chart.timeIndex;
    var adjusted = chart.meta.settings.dayDivide === 'current' && ti >= 12 ? 0 : ti;
    /* 目标日四柱 (月柱按出生当日, 日柱/时柱晚子时按次日, 与 iztro 一致) */
    var ty = target.y, tm = target.m, td = target.d;
    var yGZ = yearGanZhi(target.y, target.m, target.d, chart.meta.settings.yearDivide);
    var mGZ = chart.meta.settings.monthDivide === 'exact'
      ? monthGanZhiExact(target.y, target.m, target.d)
      : monthGanZhiNormal(date, GAN.indexOf(yGZ.stem));
    if (ti === 12 && chart.meta.settings.dayDivide !== 'current') {
      var nx2 = nextDay(ty, tm, td); ty = nx2.y; tm = nx2.m; td = nx2.d;
    }
    var dGZIdx = dayGanZhiIndex(ty, tm, td);
    var hGZ = hourGanZhi(dGZIdx, ti);
    /* 虚岁 (自然年分界) */
    var nominalAge = date.year - birthday.year + 1;
    /* 大限 */
    var decadalIndex = -1;
    var isChildhood = false;
    for (var i = 0; i < 12; i++) {
      var dr = chart.palaces[i].decadal.range;
      if (nominalAge >= dr[0] && nominalAge <= dr[1]) { decadalIndex = i; break; }
    }
    if (decadalIndex < 0) {
      var cIdx = childhoodPalaceIndex(chart, nominalAge);
      if (cIdx >= 0) { isChildhood = true; decadalIndex = cIdx; }
      else decadalIndex = chart.soulIndex;
    }
    var decStemIdx = GAN.indexOf(chart.palaces[decadalIndex].decadal.stem);
    var decBranchIdx = ZHI.indexOf(chart.palaces[decadalIndex].decadal.branch);
    /* 小限 */
    var ageIndex = -1;
    for (i = 0; i < 12; i++) {
      if (chart.palaces[i].ages.indexOf(nominalAge) >= 0) { ageIndex = i; break; }
    }
    if (ageIndex < 0) ageIndex = 0;
    var ageStemIdx = GAN.indexOf(chart.palaces[ageIndex].stem);
    var ageBranchIdx = ZHI.indexOf(chart.palaces[ageIndex].branch);
    /* 流年/流月/流日/流时 */
    var yearlyIndex = ebIdx(yGZ.branch);
    var leapAdd = birthday.isLeap && birthday.day > 15 ? 1 : 0;
    var dateLeapAdd = date.isLeap && date.day > 15 ? 1 : 0;
    var monthlyIndex = fix(yearlyIndex - (birthday.month + leapAdd) + fix(ti) + (date.month + dateLeapAdd));
    var dailyIndex = fix(monthlyIndex + date.day - 1);
    var hourlyIndex = fix(dailyIndex + fix(ti));
    var yStem = GAN.indexOf(yGZ.stem), yBranch = ZHI.indexOf(yGZ.branch);
    var mStem = GAN.indexOf(mGZ.stem), mBranch = ZHI.indexOf(mGZ.branch);
    var dStem = dGZIdx % 10, dBranch = dGZIdx % 12;
    var hStem = GAN.indexOf(hGZ.stem), hBranch = ZHI.indexOf(hGZ.branch);
    var sq12 = distribute(SUIQIAN12, ebIdx(yGZ.branch), true);
    var jq12 = distribute(JIANGQIAN12, jiangqianStart(yBranch), true);
    return {
      solarDate: fmtDate(target.y, target.m, target.d),
      lunarDate: date.year + '-' + date.month + '-' + date.day,
      nominalAge: nominalAge,
      decadal: {
        index: decadalIndex,
        name: isChildhood ? '童限' : '大限',
        stem: GAN[decStemIdx], branch: ZHI[decBranchIdx],
        palaceNames: scopePalaceNames(decadalIndex),
        mutagen: scopeMutagenNames(decStemIdx),
        stars: horoscopeStars(decStemIdx, decBranchIdx, 'decadal')
      },
      age: {
        index: ageIndex,
        name: '小限',
        stem: GAN[ageStemIdx], branch: ZHI[ageBranchIdx],
        palaceNames: scopePalaceNames(ageIndex),
        mutagen: scopeMutagenNames(ageStemIdx)
      },
      yearly: {
        index: yearlyIndex,
        name: '流年',
        stem: GAN[yStem], branch: ZHI[yBranch],
        palaceNames: scopePalaceNames(yearlyIndex),
        mutagen: scopeMutagenNames(yStem),
        stars: horoscopeStars(yStem, yBranch, 'yearly'),
        suiqian12: sq12,
        jiangqian12: jq12
      },
      monthly: {
        index: monthlyIndex,
        name: '流月',
        stem: GAN[mStem], branch: ZHI[mBranch],
        palaceNames: scopePalaceNames(monthlyIndex),
        mutagen: scopeMutagenNames(mStem),
        stars: horoscopeStars(mStem, mBranch, 'monthly')
      },
      daily: {
        index: dailyIndex,
        name: '流日',
        stem: GAN[dStem], branch: ZHI[dBranch],
        palaceNames: scopePalaceNames(dailyIndex),
        mutagen: scopeMutagenNames(dStem),
        stars: horoscopeStars(dStem, dBranch, 'daily')
      },
      hourly: {
        index: hourlyIndex,
        name: '流时',
        stem: GAN[hStem], branch: ZHI[hBranch],
        palaceNames: scopePalaceNames(hourlyIndex),
        mutagen: scopeMutagenNames(hStem),
        stars: horoscopeStars(hStem, hBranch, 'hourly')
      }
    };
  }
  /* 十二大限列表 (带运曜与大限四化) */
  function decadalList(chart) {
    var list = [];
    for (var i = 0; i < 12; i++) {
      var p = chart.palaces[i];
      var sIdx = GAN.indexOf(p.decadal.stem);
      var bIdx = ZHI.indexOf(p.decadal.branch);
      list.push({
        index: i,
        palaceName: p.name,
        ageRange: p.decadal.range.slice(),
        yearRange: [chart.lunar.year + p.decadal.range[0] - 1, chart.lunar.year + p.decadal.range[1] - 1],
        stem: p.decadal.stem,
        branch: p.decadal.branch,
        palaceNames: scopePalaceNames(i),
        mutagen: scopeMutagenNames(sIdx),
        stars: horoscopeStars(sIdx, bIdx, 'decadal')
      });
    }
    list.sort(function (a, b) { return a.ageRange[0] - b.ageRange[0]; });
    return list;
  }
  /* 某年流年盘 (按农历六月初一定点, 与通行软件一致) */
  function yearlyForYear(chart, year) {
    var s = lunar2solar(year, 6, 1, false);
    if (!s) return { error: '年份超出支持范围 (1900-2100)' };
    var hs = computeHoroscope(chart, s);
    hs.requestedYear = year;
    return hs;
  }

  /* ---------------- 格局检测 ---------------- */
  function starsOfPalace(p) { return p.major.concat(p.minor); }
  function starNamesOf(p) {
    var out = [];
    var all = starsOfPalace(p);
    for (var i = 0; i < all.length; i++) out.push(all[i].name);
    return out;
  }
  function hasStar(p, name) { return starNamesOf(p).indexOf(name) >= 0; }
  /* 三方四正全星名 */
  function trineNames(chart, idx) {
    var out = [];
    [0, 4, 6, 8].forEach(function (off) {
      var p = chart.palaces[fix(idx + off)];
      out = out.concat(starNamesOf(p));
    });
    return out;
  }
  function detectPatterns(chart) {
    var found = [];
    var pal = chart.palaces;
    function add(name, level, desc, detail) {
      found.push({ name: name, level: level, desc: desc, detail: detail || '' });
    }
    function starPositions(name) {
      var pos = [];
      for (var i = 0; i < 12; i++) if (hasStar(pal[i], name)) pos.push(i);
      return pos;
    }
    var ziweiIdx = starPositions('紫微')[0];
    var tianfuIdx = starPositions('天府')[0];
    var taiyangIdx = starPositions('太阳')[0];
    var taiyinIdx = starPositions('太阴')[0];
    var tanlangIdx = starPositions('贪狼')[0];
    var qishaIdx = starPositions('七杀')[0];
    var pojunIdx = starPositions('破军')[0];
    var jumenIdx = starPositions('巨门')[0];
    var lu = starPositions('禄存')[0];
    var ma = starPositions('天马')[0];
    var huo = starPositions('火星')[0];
    var ling = starPositions('铃星')[0];
    var zuo = starPositions('左辅')[0];
    var you = starPositions('右弼')[0];
    var chang = starPositions('文昌')[0];
    var qu = starPositions('文曲')[0];
    var yang = starPositions('擎羊')[0];
    var tuo = starPositions('陀罗')[0];
    var tianxiangIdx = starPositions('天相')[0];
    var lianzhenIdx = starPositions('廉贞')[0];
    var tianjiIdx = starPositions('天机')[0];
    var tiantongIdx = starPositions('天同')[0];
    var tianliangIdx = starPositions('天梁')[0];
    var wuquIdx = starPositions('武曲')[0];
    var soul = chart.soulIndex;
    var soulStars = starNamesOf(pal[soul]);
    var tri = trineNames(chart, soul);

    /* 1 紫府同宫 */
    if (ziweiIdx !== undefined && ziweiIdx === tianfuIdx) {
      add('紫府同宫', '吉', '紫微与天府同宫，为帝星会照，主贵气，一生多逢贵人，宜任管理要职。', '紫微·天府同守' + pal[ziweiIdx].name);
    }
    /* 2 君臣庆会 */
    if (hasStar(pal[soul], '紫微') && (hasStar(pal[soul], '左辅') || hasStar(pal[soul], '右弼') || tri.indexOf('左辅') >= 0 || tri.indexOf('右弼') >= 0)) {
      add('君臣庆会', '吉', '紫微坐命，辅弼拱照，如君王得良臣辅佐，事业有成、得人相助。', '紫微坐命，左右拱照');
    }
    /* 3 府相朝垣 */
    if (soulStars.indexOf('天府') >= 0 && tri.indexOf('天相') >= 0) {
      add('府相朝垣', '吉', '天府坐命，天相拱照，衣食丰足、稳重有成，宜理财与行政。', '天府坐命，天相三方拱照');
    }
    /* 4 日月同宫 */
    if (taiyangIdx !== undefined && taiyangIdx === taiyinIdx) {
      add('日月同宫', '吉', '日月同守一宫（丑未），性格刚柔并济，早年顺遂，得父母长辈之荫。', '太阳·太阴同守' + pal[taiyangIdx].name);
    }
    /* 5 月朗天门 */
    if (taiyinIdx !== undefined && pal[taiyinIdx].branch === '亥') {
      add('月朗天门', '吉', '太阴在亥入庙，为「月朗天门」，主聪明俊秀、福泽深厚，多有贵人扶助。', '太阴在亥');
    }
    /* 6 日照雷门 */
    if (taiyangIdx !== undefined && pal[taiyangIdx].branch === '卯') {
      add('日照雷门', '吉', '太阳在卯入庙，如旭日东升，主光明磊落、名声显达，早年即可崭露头角。', '太阳在卯');
    }
    /* 7 机月同梁 */
    if (['天机', '太阴', '天同', '天梁'].every(function (s) { return tri.indexOf(s) >= 0; })) {
      add('机月同梁', '吉', '天机、太阴、天同、天梁会齐命宫三方，机谋深远、圆融平和，宜公职与企划。', '机月同梁会命宫三方');
    }
    /* 8 杀破狼 (命宫坐七杀/破军/贪狼之一, 三合会齐) */
    var shaPoLang = ['七杀', '破军', '贪狼'];
    if (qishaIdx !== undefined && pojunIdx !== undefined && tanlangIdx !== undefined &&
        shaPoLang.some(function (s) { return soulStars.indexOf(s) >= 0; }) &&
        shaPoLang.every(function (s) { return tri.indexOf(s) >= 0; })) {
      add('杀破狼', '中', '七杀、破军、贪狼三合会齐，主变动开创之命，一生多转机，宜主动求变、创业。', '杀破狼三合会齐');
    }
    /* 9 三奇加会 */
    var mutStars = chart.mutagens;
    var mSet = mutStars.map(function (m) { return m.mutagen; });
    var sanqi = ['禄', '权', '科'].every(function (mu) { return mSet.indexOf(mu) >= 0; });
    if (sanqi && ['禄', '权', '科'].every(function (mu) {
      var star = mutStars.find(function (m) { return m.mutagen === mu; });
      return star && (soulStars.indexOf(star.star) >= 0 || tri.indexOf(star.star) >= 0);
    })) {
      add('三奇加会', '吉', '化禄、化权、化科三奇会于命宫三方，主才华横溢、名利双收，一生机遇多。', '禄权科会命宫三方');
    }
    /* 10 双禄交流 */
    var huaLuStar = mutStars.find(function (m) { return m.mutagen === '禄'; });
    if (lu !== undefined && huaLuStar && (lu === huaLuStar.palaceIndex || fix(lu + 6) === huaLuStar.palaceIndex)) {
      add('双禄交流', '吉', '禄存与化禄同宫或对拱，财禄双美，进财顺遂，理财有方。', '禄存与化禄同拱');
    }
    /* 11 禄马交驰 */
    if (lu !== undefined && ma !== undefined && (lu === ma || fix(lu + 6) === ma)) {
      add('禄马交驰', '吉', '禄存与天马同宫或对拱，财禄与动象结合，宜远行求财、贸易交通之业。', '禄马同宫或对拱');
    }
    /* 12 火贪格 */
    if (huo !== undefined && tanlangIdx !== undefined && huo === tanlangIdx) {
      add('火贪格', '吉', '火星与贪狼同宫，主突发之财、一夜暴富之机，成败起伏大，宜把握时机。', '火星贪狼同宫');
    }
    /* 13 铃贪格 */
    if (ling !== undefined && tanlangIdx !== undefined && ling === tanlangIdx) {
      add('铃贪格', '吉', '铃星与贪狼同宫，主突发横财，蓄势而发，机遇多在暗中酝酿。', '铃星贪狼同宫');
    }
    /* 14 火铃夹命 */
    if (huo !== undefined && ling !== undefined && ((fix(soul - 1) === huo && fix(soul + 1) === ling) || (fix(soul - 1) === ling && fix(soul + 1) === huo))) {
      add('火铃夹命', '凶', '火星铃星夹命宫，主急躁多灾，须防突发变故与意外，宜低调守成。', '火铃夹命宫');
    }
    /* 15 羊陀夹忌 */
    var huaJiStar = mutStars.find(function (m) { return m.mutagen === '忌'; });
    if (yang !== undefined && tuo !== undefined && huaJiStar && ((fix(huaJiStar.palaceIndex - 1) === yang && fix(huaJiStar.palaceIndex + 1) === tuo) || (fix(huaJiStar.palaceIndex - 1) === tuo && fix(huaJiStar.palaceIndex + 1) === yang))) {
      add('羊陀夹忌', '凶', '擎羊陀罗夹化忌之宫，该宫所主之事多困顿，须防小人是非与财务损失。', '羊陀夹' + huaJiStar.palaceName);
    }
    /* 16 刑囚夹印 */
    if (tianxiangIdx !== undefined && yang !== undefined && lianzhenIdx !== undefined && ((fix(tianxiangIdx - 1) === yang && fix(tianxiangIdx + 1) === lianzhenIdx) || (fix(tianxiangIdx - 1) === lianzhenIdx && fix(tianxiangIdx + 1) === yang))) {
      add('刑囚夹印', '凶', '擎羊（刑）与廉贞（囚）夹天相（印），主官非刑伤，须守法慎行。', '刑囚夹天相');
    }
    /* 17 紫微夹命 */
    if (ziweiIdx !== undefined && tianfuIdx !== undefined && ((fix(soul - 1) === ziweiIdx && fix(soul + 1) === tianfuIdx) || (fix(soul - 1) === tianfuIdx && fix(soul + 1) === ziweiIdx))) {
      add('紫微夹命', '吉', '紫微天府夹命宫，帝星护佑，主贵气逼人，多得长辈贵人提携。', '紫府夹命');
    }
    /* 18 左右同宫 */
    if (zuo !== undefined && zuo === you) {
      add('左右同宫', '吉', '左辅右弼同宫，辅佐之星齐聚，主得人缘、多助力，贵人多而有力。', '左辅右弼同宫');
    }
    /* 19 昌曲拱命 */
    if (chang !== undefined && qu !== undefined && (tri.indexOf('文昌') >= 0 && tri.indexOf('文曲') >= 0) && !(hasStar(pal[soul], '文昌') && hasStar(pal[soul], '文曲'))) {
      add('昌曲拱命', '吉', '文昌文曲拱照命宫，主才学出众、文采风流，宜学术文艺之途。', '昌曲拱命');
    }
    /* 20 石中隐玉 */
    if (jumenIdx !== undefined && (pal[jumenIdx].branch === '子' || pal[jumenIdx].branch === '午')) {
      add('石中隐玉', '中', '巨门在子午坐守，如美玉藏于石中，口才犀利、早年多磨，晚景佳。', '巨门在' + pal[jumenIdx].branch);
    }
    /* 21 巨日同宫 */
    if (jumenIdx !== undefined && taiyangIdx !== undefined && jumenIdx === taiyangIdx) {
      add('巨日同宫', '吉', '巨门与太阳同宫（寅申），口才与光明兼备，主外务、教育、法律之才。', '巨日同宫');
    }
    /* 22 阳梁昌禄 */
    if (taiyangIdx !== undefined && tianliangIdx !== undefined && chang !== undefined && lu !== undefined) {
      var yangLiangTogether = taiyangIdx === tianliangIdx;
      var inTrine = tri.indexOf('太阳') >= 0 && tri.indexOf('天梁') >= 0 && tri.indexOf('文昌') >= 0 && tri.indexOf('禄存') >= 0;
      if (yangLiangTogether && (tri.indexOf('文昌') >= 0 || tri.indexOf('禄存') >= 0 || inTrine)) {
        add('阳梁昌禄', '吉', '太阳、天梁、文昌、禄存会合，主聪明机敏、逢凶化吉，宜考试竞赛。', '阳梁昌禄会');
      }
    }
    /* 23 泛水桃花 */
    if (tanlangIdx !== undefined && pal[tanlangIdx].branch === '子' && qu !== undefined && qu === tanlangIdx) {
      add('泛水桃花', '凶', '贪狼在子与文曲同宫，主风流多情，须防桃花劫与感情纠葛。', '贪狼文曲在子');
    }
    /* 24 桃花犯主 */
    if (ziweiIdx !== undefined && tanlangIdx !== undefined && ziweiIdx === tanlangIdx) {
      add('桃花犯主', '中', '紫微贪狼同宫，帝星染桃花，主才艺风流、喜好享受，感情生活多彩。', '紫微贪狼同宫');
    }
    return found;
  }

  /* ---------------- 星曜词典 ---------------- */
  var STAR_DICT = {
    /* 主星 */
    紫微: { wu: '己土', yy: '阴', qi: '化气为尊（帝座）', brief: '帝王之星，统御全局，主贵气、领导力与自尊。坐命者胸怀大志、重面子，宜居管理核心；逢辅弼更显其尊。', good: '子午独坐，丑未与破军，寅申与天府，卯酉与贪狼' },
    天机: { wu: '乙木', yy: '阴', qi: '化气为善（益算）', brief: '智慧之星，主谋略、机变与思考。坐命者聪明好学、反应敏捷，善筹划却易多虑；宜研究、企划、咨询。', good: '子午卯酉独坐' },
    太阳: { wu: '丙火', yy: '阳', qi: '化气为贵（官禄主）', brief: '光明之星，主名声、公益与付出。坐命者热情坦荡、乐于助人；庙旺显达，落陷则劳碌。', good: '卯辰巳午庙旺，亥子陷' },
    武曲: { wu: '辛金', yy: '阴', qi: '化气为财（财帛主）', brief: '财星，主刚毅、执行力与金钱。坐命者果断务实、重信守诺，宜金融、军警、工程；性刚宜修柔。', good: '辰戌丑未入庙' },
    天同: { wu: '壬水', yy: '阳', qi: '化气为福', brief: '福星，主享福、平和与人缘。坐命者性情温顺、随遇而安，少争斗之心；宜艺术、服务、文职。', good: '子午卯酉入庙' },
    廉贞: { wu: '丁火', yy: '阴', qi: '化气为囚（次桃花）', brief: '次桃花星，主才艺、交际与权谋。坐命者多才多艺、外柔内刚，情感丰富；宜公关、演艺、监察。', good: '寅申入庙' },
    天府: { wu: '戊土', yy: '阳', qi: '化气为库（令星）', brief: '库藏之星，主稳重、包容与理财。坐命者宽厚稳健、善于守成，为贤能之佐；宜行政、财务、地产。', good: '十二宫皆旺' },
    太阴: { wu: '癸水', yy: '阴', qi: '化气为富（田宅主）', brief: '富星，主财富、审美与内敛。坐命者心思细腻、重感情，宜不动产、财务、文艺；夜生人尤佳。', good: '酉戌亥子丑庙旺，卯陷' },
    贪狼: { wu: '甲木', yy: '阳', qi: '化气为桃花（第一大桃花）', brief: '大桃花星，主欲望、才艺与交际。坐命者多才多艺、善钻营、人缘佳；宜演艺、公关、销售。', good: '辰戌丑未入庙' },
    巨门: { wu: '癸水', yy: '阴', qi: '化气为暗（口舌）', brief: '暗星，主口才、是非与研究。坐命者能言善辩、心思深，宜法律、教育、研究；谨防口舌是非。', good: '子午丑未入庙' },
    天相: { wu: '壬水', yy: '阳', qi: '化气为印（官禄主）', brief: '印星，主辅佐、协调与品位。坐命者端正温和、乐于助人，为最佳幕僚；宜行政、秘书、公关。', good: '子午丑未入庙' },
    天梁: { wu: '戊土', yy: '阳', qi: '化气为荫（老人星）', brief: '荫星，主庇荫、公正与寿。坐命者老成持重、乐善好施、逢凶化吉；宜医、法、教育、公益。', good: '子午丑未入庙' },
    七杀: { wu: '庚金', yy: '阳', qi: '化气为将（肃杀）', brief: '将星，主威权、冲劲与开创。坐命者胆识过人、行动力强，宜军警、创业、开拓；须防过于刚烈。', good: '寅申子午入庙' },
    破军: { wu: '癸水', yy: '阴', qi: '化气为耗（先锋）', brief: '耗星，主破旧立新、变动与冒险。坐命者敢作敢为、喜革新，宜开创型事业；一生多变动，宜顺势而为。', good: '子午入庙' },
    /* 辅星 */
    左辅: { wu: '戊土', yy: '阳', qi: '辅佐之星', brief: '六吉之一，主助力与贵人。坐命者得人相助、领导有方，一生多得平辈贵人提携。', good: '' },
    右弼: { wu: '癸水', yy: '阴', qi: '辅佐之星', brief: '六吉之一，主暗中助力。坐命者贵人暗助、化险为夷，人缘与福气兼备。', good: '' },
    文昌: { wu: '辛金', yy: '阳', qi: '化气为科甲（文星）', brief: '六吉之一，主才华、文书与考试。坐命者聪明文雅、利科名学业；宜文教、学术、传播。', good: '' },
    文曲: { wu: '癸水', yy: '阴', qi: '化气为科甲（文星）', brief: '六吉之一，主才艺、口才与感性。坐命者多才多艺、善表达；宜艺术、演艺、写作。', good: '' },
    天魁: { wu: '丙火', yy: '阳', qi: '贵人星（天乙）', brief: '六吉之一，主贵人提携。坐命者气度不凡，遇难有长辈贵人相助，男命尤佳。', good: '' },
    天钺: { wu: '丁火', yy: '阴', qi: '贵人星（天乙）', brief: '六吉之一，主暗贵提携。坐命者逢凶化吉、多得女性贵人；女命尤佳。', good: '' },
    禄存: { wu: '己土', yy: '阴', qi: '化气为财（爵禄）', brief: '财星，主禄位与积蓄。坐命者勤俭守财、一生衣食无忧；怕擎羊陀罗相夹成「羊陀夹禄」。', good: '' },
    天马: { wu: '丙火', yy: '阳', qi: '化气为驿（驿马）', brief: '驿马星，主奔波与变动。坐命者性好动、利远行；宜外务、贸易、交通、旅游。', good: '' },
    擎羊: { wu: '庚金', yy: '阳', qi: '化气为刑', brief: '六煞之一，主刑伤与冲动。坐命者个性刚强、敢冲敢拼；须防意外伤害与是非。', good: '' },
    陀罗: { wu: '辛金', yy: '阴', qi: '化气为忌', brief: '六煞之一，主拖延与纠缠。坐命者遇事多波折反复，宜耐心谋定而后动。', good: '' },
    火星: { wu: '丙火', yy: '阳', qi: '化气为暴', brief: '六煞之一，主突发与爆发力。坐命者性急如火，爆发力强；与贪狼同宫成火贪格反主暴发。', good: '' },
    铃星: { wu: '丁火', yy: '阴', qi: '化气为暴', brief: '六煞之一，主暗火与突袭。坐命者外柔内刚、心机深；与贪狼同宫成铃贪格。', good: '' },
    地空: { wu: '戊土', yy: '阴', qi: '化气为空（劫空）', brief: '空劫之一，主空想与破耗。坐命者思想超脱、灵感强，宜玄学、创意；忌投机。', good: '' },
    地劫: { wu: '丙火', yy: '阳', qi: '化气为劫', brief: '空劫之一，主劫耗与波折。坐命者一生多变动损耗，须防财物损失；宜稳健守成。', good: '' }
  };

  E.computeChart = computeChart;
  E.chartText = chartText;
  E.computeHoroscope = computeHoroscope;
  E.decadalList = decadalList;
  E.yearlyForYear = yearlyForYear;
  E.detectPatterns = detectPatterns;
  E.starDict = STAR_DICT;
  E.timeIndexFromHour = timeIndexFromHour;
  E.timeIndexFromHourMinute = timeIndexFromHourMinute;
  E.equationOfTimeMinutes = equationOfTimeMinutes;
  E.solar2lunar = solar2lunar;
  E.lunar2solar = lunar2solar;
  E.leapMonth = leapMonth;
  E.lunarMonthDays = function (y, m, isLeap) {
    if (y < 1900 || y > 2100 || m < 1 || m > 12) return 0;
    if (isLeap) return leapMonth(y) === m ? leapDays(y) : 0;
    return monthDays(y, m);
  };
  /* 节气"日"查询 (供边界测试): 节 n=1,3,...,23 */
  E.termDay = function (y, n) { return getTerm(y, n); };
  E.isJieDay = function (y, m, d) {
    for (var n = 1; n <= 23; n += 2) {
      var tm = Math.floor((n - 1) / 2) + 1;
      if (m === tm && d === getTerm(y, n)) return true;
    }
    return false;
  };
  g.ZWEngine = E;
})(typeof window !== 'undefined' ? window : globalThis);
