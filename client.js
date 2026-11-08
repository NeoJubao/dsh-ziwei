/* 懒加载内核：bundle 加载期只注册 factory；引擎/内核在首次物化时求值。
 * 官方契约见 dsh-agent-preset/skills/cordis-plugin-development/references/ui-plugin.md
 * 与 practices.md（module-body side effects run at materialization）。
 * 防回归：verify/verify.mjs 断言求值前 window.ZWEngine 不存在。 */
function __ziweiBootstrapKernel() {
  if (typeof window !== 'undefined' && window.ZWEngine && window.ZWCore) return;
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
      /* 四柱月柱默认按节气（八字通行口径）；命宫/星曜仍按农历月，不受此设置影响 */
      monthDivide: 'exact',
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

/* ================================================================
 * 紫微师 · 内核 (确定性排盘 + 工具定义 + 人设/方法论)
 *
 * 平台无关: 不依赖 DOM、不依赖 require、不依赖 window。
 * - 浏览器: 由 client.js 拼接在引擎之后, 读到 window.ZWEngine,
 *           并把 window.ZWCore 交给 ui-pro.js 使用。
 * - Node/Host: index.js 在 vm 沙箱里按同样顺序求值本文件,
 *           通过 globalThis.ZWCore 取得同一份实现。
 *
 * 单一事实来源: 排盘只走 ZWEngine.computeChart(与 iztro 逐字段对齐验证)。
 * ================================================================ */
(function (root) {
  'use strict';

  var E = root.ZWEngine;
  if (!E) throw new Error('ziwei-core: 需要先加载引擎 (ZWEngine)');

  var Core = {};

  /* ---------------- 常量 ---------------- */
  var DISCLAIMER_BRIEF = '本内容基于中华传统文化（紫微斗数）体系生成，非现代科学结论，仅供参考。涉及医疗 / 法律 / 投资 / 婚姻等具体决策，请咨询相关专业人士。';
  var DISCLAIMER_REPORT = '本报告基于中华传统文化（紫微斗数）体系生成，非现代科学结论，仅供参考，不构成医疗 / 法律 / 金融 / 婚姻等专业领域的决策依据。';

  var GENDERS = { male: '男', female: '女' };

  /* ---------------- 人设 / 方法论 ---------------- */
  var PERSONA = [
    '你是「紫微师 · 人生规划报告师」— LifeView 的命理报告交付角色。',
    '你是一个独立交付的完整闭环：从排盘到解读到终稿，无需人工审核、无需等待外部指令，收到生辰信息后自主完成全流程并直接交付。',
    '',
    '## 工作三段式',
    '1. 工具层（机器精排）：真太阳时校正 → 农历干支 → 十二宫 + 十四主星 → 四化 → 命主/身主/大限。',
    '   **排盘唯一来源是确定性排盘工具（ziwei_paipan / 工作台引擎）。工具失败必须停止并如实报告「排盘工具暂不可用，请稍后再试」，严禁凭记忆、规则或任何其他方式手工排盘——这是 P0 事故换来的铁律。**',
    '   调用者只给原始四要素（阳历/农历日期、钟表时间、性别、出生地经度），不要自行换算真太阳时或时辰索引（换算已内置）。',
    '2. 解读层（文化解读）：意象解盘九诀逐诀运用 + 鲲鹏报告 14 部分模板填充。',
    '3. 自检交付层：终稿逐条过自检清单与红线，全部通过后直接交付。',
    '',
    '## 接单方式',
    '- 用户给出**生辰四要素**（阳历或农历生日 / 出生钟表时间 / 性别 / 出生地经度）即开工。',
    '- 信息不全时一次性列出所缺项；给齐后不再追问，一次成型。',
    '- **时辰模糊必须追问，不得静默任选**；时辰边界告警（校正后距边界 <3 分钟）须向用户声明。',
    '- 交付形态：默认对话输出 markdown 报告；用户要求精装版时产出单文件自包含 HTML（棕褐木色中式精装，含封面、命盘网格、印章与免责声明）。',
    '- **精装 HTML 按平台能力走双通道交付**：',
    '  - 通道 A（有文件写入能力）：把完整 HTML 写出为文件，命名 `人生鲲鹏计划_<化名>_<yyyymmdd>.html`，明确告知保存路径并指引用浏览器打开。',
    '  - 通道 B（纯对话界面）：把完整 HTML 全文放进**单个代码块**，指引用户复制全部内容、保存为 `.html` 再打开。',
    '  - 无论走哪条通道，HTML 必须**一次完整交付**：不拆成多个代码块、不截断、不只给片段。',
    '',
    '## 意象解盘九诀（每诀至少 1 条命盘证据，至少用 6 诀）',
    '1. 太极定准：命宫地支/阴阳男女/五行局/命主身主——太极未定，不得开盘。',
    '2. 关联参合：主星 → 辅吉（昌曲/辅弼/魁钺/禄存天马）→ 辅煞（火铃/羊陀/空劫）综合意象。',
    '3. 四化寻机：禄=得力财源；权=掌势主动；科=得名文采贵人；忌=阻滞必修课。',
    '4. 三盘联动：本命/大限/流年同宫共振则吉，冲忌则凶。',
    '5. 放大寻幽：空宫借三方四正借力补位。',
    '6. 解厄破局：煞星汇聚不直接断凶，只给方向——修身/修业/修缘/修心。',
    '7. 意象通流：紫微=帝王、天机=智者、太阳=光明、武曲=将军、太阴=母亲、七杀=武士……翻译成现代角色与场景。',
    '8. 同宫互参：同宫主星互制互生（紫贪/武杀/同巨…）。',
    '9. 古今映照：范蠡/计然/子贡/沈万三/胡雪岩/乔致庸等映照当下，让命理成为行动指引。',
    '',
    '## 鲲鹏报告 14 部分（固定顺序）',
    '1 命盘总览与星谱定局（太极定准+关联参合）→ 2 性格分析与人生大略 → 3 家庭关系与家族能量（父母+兄弟）→ 4 婚姻状态与情感攻略 → 5 子女培育与相处模式 → 6 财富管理与生财之道（财帛+田宅）→ 7 健康预警与养生指引（疾厄，必含养生）→ 8 朋友交往与贵人能量（交友）→ 9 事业发展与生涯规划（官禄，四化寻机+古今映照）→ 10 居家风水与不动产（田宅）→ 11 心灵福德与精神追求（福德）→ 12 出行迁移与外缘机遇（迁移）→ 13 大限运势与人生节奏（三盘联动）→ 14 鲲鹏志略综合建议（五财道）。',
    '',
    '**致命主书**：给命主本人的一封收束信——命格主线一句定调 → 当下大限课题 → 三条个人化行动指引 → 十二字心法收束。禁套话，每句只适用于此命主。',
    '**十二字心法**：以星悟道，知位知微；指危心钥，行要心药。',
    '**五财道**（第 14 部分）：① 明确方向专精主业（官禄+命）② 修身养性蓄积能量（福德+疾厄）③ 经营人脉汇聚贵气（交友+父母）④ 理财守富防耗避损（财帛+田宅）⑤ 守心定性远离纷扰（夫妻+福德）。',
    '',
    '每部分至少含：格言引用（道德经/庄子/紫微古诀，须确凿可查）+ 正文 + 宫位卡片（主星/辅星/关键词/简注）+ 强调框或预警块。',
    '',
    '## 红线（强制，违反即不出）',
    '- ❌ 不预测寿命 / 死亡时间 / 重大疾病。',
    '- ❌ 不写「您必会 / 一定会 / 100%」类断言。',
    '- ❌ 不替命主决断婚姻 / 投资 / 转行 / 医疗——只给信息层：「命盘显示…倾向，您可参考」「这是信息层，决策您自己来」。',
    '- ❌ 不写宿命语（「命中带 X 不能 Y」）。',
    '- ❌ 财帛宫禁单边断（消费倾向必须两面或中性表述）；贵人/长辈助力放软留余地。',
    '- ✅ 多写命格结构与意象，少写行为断言；预测性内容一律留余地。',
    '- ✅ 文风：古白话与现代文相间，去除 AI 味。',
    '- ✅ 每份报告末尾必含免责声明。',
    '',
    '## 用户隐私',
    '生辰与个人信息只用于本次排盘解读，不向第三方披露；不承诺「不存储」「阅后即焚」；举例一律化名与模糊信息。'
  ].join('\n');

  var SELFCHECK = [
    '交付前自检（逐条核，全过才交付）：',
    '- [ ] 真太阳时已校正（出生地经度 ≠120° 必做，且已核对校正后时辰）',
    '- [ ] 农历干支 / 五行局 / 命主身主 / 大限段位正确',
    '- [ ] 14 部分齐，无跳号、无占位符残留',
    '- [ ] 命盘图位 12 宫格已实填（不留空占位）',
    '- [ ] 大限时间轴 5 个节点齐全、当前大限有高亮',
    '- [ ] 五财道 5 条全部填实，逐条对上宫位',
    '- [ ] 九诀至少用 6 诀，每诀对应至少 1 条命盘证据',
    '- [ ] 每处格言引用确凿可查（能说出出处）',
    '- [ ] 致命主书 + 十二字心法必写、三层展开、无套话',
    '- [ ] 文风：古白话与现代文相间，AI 味已除',
    '- [ ] 合规红线 0 命中',
    '- [ ] 免责声明在报告末尾'
  ].join('\n');

  var BRIEF_SHAPE = [
    '请输出 800-1200 字的速览解读，结构固定：',
    '一、命格总纲（格局定性）；二、三方四正要点；三、四化分布；四、大限走势；五、中肯建议（三条）。',
    '结尾附免责声明：' + DISCLAIMER_BRIEF
  ].join('\n');

  /* 有具体问题时不再套“固定五段式”：模板会把“这 10 年大运如何”答成命格总纲。 */
  var QA_RULES = [
    '直接回答用户这一次的问题，不要输出固定五段式，也不要复述命格总纲。',
    '顺序：先给结论（2 句以内）→ 依据（引用宫位 / 星曜 / 庙旺 / 四化 / 大限段位）→ 可执行建议（1–3 条）。',
    '涉及大限 / 大运 / 流年时，必须使用下方的【当前定位】：明确写出大限段位、宫位、大限四化与流年落点；不得自行推算或改写。',
    '看不出依据时直说“此盘未显示”，不得编造星曜或四化。',
    '全文 800–1200 字；结尾附免责声明：' + DISCLAIMER_BRIEF
  ].join('\n');

  /* ---------------- 排盘 ---------------- */
  /**
   * 归一化输入 → 引擎入参。调用者只给原始四要素，换算全部交给引擎。
   */
  function normalizeInput(raw) {
    var r = raw || {};
    if (r.calendar !== undefined && r.calendar !== 'solar' && r.calendar !== 'lunar') {
      throw new Error('calendar 只接受 solar（阳历）或 lunar（农历），收到: ' + JSON.stringify(r.calendar));
    }
    var calendar = r.calendar === 'lunar' ? 'lunar' : 'solar';
    /* 性别决定阴阳男女与大限顺逆：缺失或非法一律拒绝，绝不静默兜底成男命 */
    if (r.gender !== 'male' && r.gender !== 'female' && r.gender !== '男' && r.gender !== '女') {
      throw new Error('性别必须显式给出 male(男) 或 female(女)，收到: ' + JSON.stringify(r.gender) +
        '。缺失或非法时不得默认，请先向命主确认性别。');
    }
    var gender = (r.gender === 'female' || r.gender === '女') ? 'female' : 'male';

    /* 日期：接受 1992-05-03 或 年/月/日 字段 */
    var year, month, day;
    if (typeof r.date === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(r.date.trim())) {
      var parts = r.date.trim().split('-');
      year = +parts[0]; month = +parts[1]; day = +parts[2];
    } else {
      year = +r.year; month = +r.month; day = +r.day;
    }
    if (!isFinite(year) || !isFinite(month) || !isFinite(day)) {
      throw new Error('日期缺失或格式错误：需要 date=YYYY-MM-DD，或 year/month/day 三个数字');
    }

    /* 时间：接受 09:30 或 hour/minute 字段 */
    var hour, minute, hasClock = true;
    if (typeof r.time === 'string' && /^\d{1,2}:\d{2}$/.test(r.time.trim())) {
      var tp = r.time.trim().split(':');
      hour = +tp[0]; minute = +tp[1];
    } else if (r.hour !== undefined && r.hour !== null && r.hour !== '') {
      hour = +r.hour;
      minute = (r.minute === undefined || r.minute === null || r.minute === '') ? 0 : +r.minute;
    } else {
      hasClock = false;
      hour = 0; minute = 0;
    }
    if (hasClock && (!isFinite(hour) || !isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59)) {
      throw new Error('时间超出范围：需要 HH:MM（24 小时制钟表时间）');
    }

    var longitude;
    if (r.longitude === undefined || r.longitude === null || r.longitude === '') {
      longitude = undefined;
    } else {
      longitude = +r.longitude;
      if (!isFinite(longitude) || longitude < 60 || longitude > 140) {
        throw new Error('经度须为 60~140 之间的数字（中国境内约 73~135），收到: ' + r.longitude);
      }
    }

    return {
      calendar: calendar,
      year: year, month: month, day: day,
      isLeapMonth: !!r.isLeapMonth,
      hour: hour, minute: minute,
      hasClock: hasClock,
      gender: gender,
      longitude: longitude,
      settings: r.settings
    };
  }

  /**
   * 确定性排盘。唯一来源 = ZWEngine.computeChart。
   * @returns {{ok: true, chart: object, input: object} | {ok: false, error: string}}
   */
  function paipan(raw) {
    var input;
    try { input = normalizeInput(raw); } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
    if (!input.hasClock) {
      return { ok: false, error: '缺少出生钟表时间：紫微斗数定时辰必需，请提供 HH:MM（如 09:30）；若只知道时辰（如「辰时」），请向命主确认后再排——不得静默任选。' };
    }
    var chart;
    try { chart = E.computeChart(input); } catch (e) {
      return { ok: false, error: '排盘引擎异常: ' + String((e && e.message) || e) };
    }
    if (!chart || chart.error) return { ok: false, error: (chart && chart.error) || '未知排盘错误' };
    return { ok: true, chart: chart, input: input };
  }

  /* ---------------- 命盘文本 ---------------- */
  /** 引擎原生命盘文本（含四柱/农历/真太阳时/十二宫/四化/大限）。 */
  function chartText(chart) { return E.chartText(chart); }

  /** 某宫主星/辅星单行文本。 */
  function starLine(p) {
    if (!p) return '—';
    var major = (p.major || []).map(function (s) {
      return s.name + (s.brightness ? '[' + s.brightness + ']' : '') + (s.mutagen ? '化' + s.mutagen : '');
    }).join(' ');
    var minor = (p.minor || []).map(function (s) {
      return s.name + (s.mutagen ? '化' + s.mutagen : '');
    }).join(' ');
    return (major || '空宫') + (minor ? ' | ' + minor : '');
  }

  /** 四化列表（星名数组，按 禄/权/科/忌 顺序）→ 带落宫文本。 */
  function mutagenLine(chart, stars) {
    if (!stars || !stars.length) return '无';
    var marks = ['禄', '权', '科', '忌'];
    return stars.map(function (name, i) {
      var where = '';
      for (var k = 0; k < chart.palaces.length; k++) {
        var all = (chart.palaces[k].major || []).concat(chart.palaces[k].minor || []);
        for (var j = 0; j < all.length; j++) if (all[j].name === name) { where = '（' + chart.palaces[k].name + '）'; break; }
        if (where) break;
      }
      return name + '化' + (marks[i] || '?') + where;
    }).join('、');
  }

  /** 按公历年近似虚岁（农历新年前可能差一岁，用于“这十年”定位够用）。 */
  function nominalAgeIn(chart, year) {
    var birthYear = chart && chart.lunar ? chart.lunar.year : null;
    if (!birthYear || !year) return null;
    return year - birthYear + 1;
  }

  /**
   * 当前时间定位：当前大限 + 当前流年。
   * 这是“问这 10 年大运却答成命格总纲”的根因修复点：模型必须拿到
   * “现在处于哪一段、它的宫位/四化/三方四正”才能定向回答，而不是只看到
   * 每宫里嵌着的“大限 35-44”标签。
   */
  function currentContext(chart, opts) {
    var o = opts || {};
    var year = Number(o.currentYear) || new Date().getFullYear();
    var age = Number(o.currentAge) || nominalAgeIn(chart, year);
    if (!age) return '';
    var L = [];
    L.push('【当前定位】排盘基准年 ' + year + '，虚岁 ' + age + '（按公历年近似）。');

    var dec = [];
    try { dec = E.decadalList(chart) || []; } catch (e) { dec = []; }
    var cur = null;
    for (var i = 0; i < dec.length; i++) {
      if (age >= dec[i].ageRange[0] && age <= dec[i].ageRange[1]) { cur = dec[i]; break; }
    }
    if (!cur) {
      L.push('当前虚岁不在已排大限区间内（起运前或超出 124 岁）；涉及大限的问题要如实说明。');
    } else {
      var names = cur.palaceNames || [];
      var at = function (name) { for (var k = 0; k < names.length; k++) if (names[k] === name) return chart.palaces[k]; return null; };
      L.push('当前大限：' + cur.ageRange[0] + '–' + cur.ageRange[1] + ' 虚岁（公历 ' + cur.yearRange[0] + '–' + cur.yearRange[1] + '），' +
        cur.stem + cur.branch + '，大限命宫落本命「' + cur.palaceName + '」宫。');
      L.push('大限四化：' + mutagenLine(chart, cur.mutagen) + '。');
      ['命宫', '财帛', '官禄', '迁移'].forEach(function (nm) {
        var p = at(nm);
        if (p) L.push('大限' + nm + '：本命' + p.name + '（' + p.stem + p.branch + '）' + starLine(p));
      });
    }

    var hs = null;
    try { hs = E.yearlyForYear(chart, year); } catch (e) { hs = null; }
    if (hs && hs.yearly) {
      var yp = hs.yearly;
      var yNames = yp.palaceNames || [];
      var yAt = function (name) { for (var k = 0; k < yNames.length; k++) if (yNames[k] === name) return chart.palaces[k]; return null; };
      var soul = yAt('命宫');
      L.push('流年 ' + year + '：' + yp.stem + yp.branch + '，流年命宫落本命「' + (soul ? soul.name : '?') + '」宫；流年四化：' +
        mutagenLine(chart, yp.mutagen) + '。');
      ['财帛', '官禄', '迁移'].forEach(function (nm) {
        var p = yAt(nm);
        if (p) L.push('流年' + nm + '：本命' + p.name + '（' + p.stem + p.branch + '）' + starLine(p));
      });
    }
    return L.join('\n');
  }

  /**
   * 面向上报交付的加长命盘上下文：基本盘 + 十二宫三方四正 + 四化落宫 +
   * 全部 12 段大限 + （给了当前年龄时）当前大限/流年定位 + 格局。
   * opts: { currentAge?, currentYear? } —— 面板问答与 agent 工具都走这里，保证两边口径一致。
   */
  function fullChartText(chart, opts) {
    var o = opts || {};
    var out = [];
    out.push(E.chartText(chart));
    out.push('');
    out.push('──── 解读用补充上下文 ────');

    var PALACE_ORDER = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
    var find = function (name) {
      for (var i = 0; i < chart.palaces.length; i++) if (chart.palaces[i].name === name) return chart.palaces[i];
      return null;
    };

    out.push('十二宫主星与辅星（逐宫）:');
    PALACE_ORDER.forEach(function (name) {
      var p = find(name);
      if (!p) return;
      out.push('  ' + name + '(' + p.stem + p.branch + (p.isBody ? '·身宫' : '') + ') ' + starLine(p));
    });

    out.push('');
    out.push('四化落宫: ' + (chart.mutagens || []).map(function (m) {
      return m.star + '化' + m.mutagen + '(' + m.palaceName + ')';
    }).join('  ') || '（无）');

    var dec = [];
    try { dec = E.decadalList(chart) || []; } catch (e) { dec = []; }
    if (dec.length) {
      out.push('');
      out.push('十二大限（按虚岁升序，全部 12 段）:');
      dec.forEach(function (d) {
        out.push('  ' + d.ageRange[0] + '–' + d.ageRange[1] + ' 虚岁（公历 ' + d.yearRange[0] + '–' + d.yearRange[1] + '）' +
          d.stem + d.branch + '（' + d.palaceName + '宫为限命）大限四化: ' + mutagenLine(chart, d.mutagen));
      });
    }

    var ctx = currentContext(chart, o);
    if (ctx) {
      out.push('');
      out.push(ctx);
    }

    var pats = [];
    try { pats = E.detectPatterns(chart) || []; } catch (e) { pats = []; }
    if (pats.length) {
      out.push('');
      out.push('格局识别: ' + pats.map(function (p) { return p.name + (p.note ? '（' + p.note + '）' : ''); }).join('；'));
    }
    return out.join('\n');
  }

  /* ---------------- 黄金用例自检 ---------------- */
  /* 与 verify/golden-test.sh 同一组断言：1992-05-03 09:30 男 经度 105.97 */
  var GOLDEN = {
    date: '1992-05-03', time: '09:30', gender: 'male', longitude: 105.97,
    expect: {
      solarTime: '08:37',
      timeName: '辰时',
      timeIndex: 4,
      lunarText: '4月初一',
      lunarYear: 1992,
      soulBranch: '丑',
      fiveElementsClass: '木三局',
      soulMajor: ['太阳', '太阴']
    }
  };

  /**
   * 跑黄金用例四断言。排盘工具、脚本、运行环境有任何改动后必跑。
   * 任何一项不符 = 工具损坏，停止交付并如实报告。
   */
  function goldenCheck() {
    var res = paipan(GOLDEN);
    if (!res.ok) {
      return { ok: false, passed: 0, total: 4, failures: ['排盘失败: ' + res.error], actual: null };
    }
    var c = res.chart;
    var corr = (c.meta && c.meta.solarCorrection) || {};
    var soul = null;
    for (var i = 0; i < c.palaces.length; i++) if (c.palaces[i].name === '命宫') soul = c.palaces[i];
    var soulMajor = (soul ? soul.major : []).map(function (s) { return s.name; }).sort();
    var expectMajor = GOLDEN.expect.soulMajor.slice().sort();
    var actual = {
      solarTime: corr.solarTime,
      timeName: c.timeName,
      timeIndex: c.timeIndex,
      lunarText: c.lunarText,
      lunarYear: c.lunar && c.lunar.year,
      soulBranch: c.soulBranch,
      fiveElementsClass: c.fiveElementsClass,
      soulMajor: soulMajor
    };
    var failures = [];
    if (corr.solarTime !== GOLDEN.expect.solarTime || c.timeIndex !== GOLDEN.expect.timeIndex) {
      failures.push('断言1 真太阳时/时辰索引: 期望 ' + GOLDEN.expect.solarTime + '/' + GOLDEN.expect.timeName +
        '(' + GOLDEN.expect.timeIndex + ')，实际 ' + corr.solarTime + '/' + c.timeName + '(' + c.timeIndex + ')');
    }
    if (c.lunarText !== GOLDEN.expect.lunarText || (c.lunar && c.lunar.year) !== GOLDEN.expect.lunarYear) {
      failures.push('断言2 农历: 期望 ' + GOLDEN.expect.lunarYear + '年' + GOLDEN.expect.lunarText +
        '，实际 ' + (c.lunar && c.lunar.year) + '年' + c.lunarText);
    }
    if (c.soulBranch !== GOLDEN.expect.soulBranch || soulMajor.join(',') !== expectMajor.join(',')) {
      failures.push('断言3 命宫: 期望 地支' + GOLDEN.expect.soulBranch + ' 主星[' + expectMajor.join(' ') +
        ']，实际 地支' + c.soulBranch + ' 主星[' + soulMajor.join(' ') + ']');
    }
    var tianzhai = null;
    for (var j = 0; j < c.palaces.length; j++) if (c.palaces[j].name === '田宅') tianzhai = c.palaces[j];
    var tzMajor = (tianzhai ? tianzhai.major : []).map(function (s) { return s.name; });
    if (c.fiveElementsClass !== GOLDEN.expect.fiveElementsClass || tzMajor.indexOf('紫微') < 0) {
      failures.push('断言4 五行局/田宅: 期望 五行局' + GOLDEN.expect.fiveElementsClass + ' 且 田宅含紫微，实际 五行局' +
        c.fiveElementsClass + ' 田宅[' + tzMajor.join(' ') + ']');
    }
    return {
      ok: failures.length === 0,
      passed: 4 - failures.length,
      total: 4,
      failures: failures,
      actual: actual
    };
  }

  /* ---------------- 解读请求组装 ---------------- */
  /** 把命盘 + 模式 + 追问组装成一次解读请求（host / client 共用同一份措辞）。 */
  function buildRequest(opts) {
    var o = opts || {};
    var meta = o.meta || {};
    var mode = o.mode === 'report' ? 'report' : 'brief';
    var question = o.question ? String(o.question).trim() : '';
    var history = Array.isArray(o.history) ? o.history : [];
    var currentAge = Number(meta.currentAge) || 0;
    var currentYear = Number(meta.currentYear) || 0;
    var chart = o.chart
      ? fullChartText(o.chart, { currentAge: currentAge, currentYear: currentYear })
      : String(o.chartText || '');
    var asked = question.length > 0;

    var system;
    if (mode === 'report') {
      system = PERSONA + '\n\n## 本次交付形态：完整鲲鹏报告\n' +
        '请基于下方确定性排盘输出完整鲲鹏报告（14 部分 + 致命主书 + 十二字心法，markdown 格式）。\n' +
        '全文用 markdown：## 章节（编号+名称）、### 小节、**加粗**、- 列表、> 格言引用（须确凿可查）。\n' +
        '文末必附免责声明：' + DISCLAIMER_REPORT + '\n\n' + SELFCHECK;
    } else if (asked) {
      system = PERSONA + '\n\n## 本次交付形态：定向问答\n' + QA_RULES;
    } else {
      system = PERSONA + '\n\n## 本次交付形态：速览解读\n' + BRIEF_SHAPE;
    }

    var metaLines = [];
    if (meta.name) metaLines.push('称呼：' + meta.name);
    if (meta.place) metaLines.push('籍贯/出生地：' + meta.place);
    if (meta.occupation) metaLines.push('职业/诉求：' + meta.occupation);
    if (meta.gender) metaLines.push('性别：' + (GENDERS[meta.gender] || meta.gender));

    var opener = mode === 'report'
      ? '请基于以下确定性排盘输出完整鲲鹏报告（14 部分 + 致命主书 + 十二字心法，markdown 格式）。'
      : (asked
        ? '以下是命主的确定性排盘与当前时间定位（非模型心算）。请回答随后的问题。'
        : '请解读以下紫微斗数命盘（由确定性排盘工具生成，非模型心算）。');

    var first = opener +
      (metaLines.length ? '\n' + metaLines.join('；') + '。' : '') +
      '\n\n' + chart;

    /* 问题意图定位：大限/大运/流年类问题必须钉在当前定位上，否则模型会滑回命格总纲。 */
    var focus = [];
    var focusText = question + ' ' + String(meta.occupation || '');
    var decadalIntent = /大限|大运|十年|这\s*10\s*年|未来十年|下一个十年|这步运|中年|当前阶段/.test(focusText);
    var yearlyIntent = /流年|今年|明年|去年|年运|流年盘|20\d{2}\s*年/.test(focusText);
    var decadalFocus = Array.isArray(meta.decadalFocus) && meta.decadalFocus.length === 2 ? meta.decadalFocus : null;
    var yearlyFocus = Number(meta.yearlyFocus) || 0;
    if (decadalFocus) {
      focus.push('命主在面板中选中的大限是 ' + decadalFocus[0] + '–' + decadalFocus[1] + ' 虚岁。');
    } else if (decadalIntent && !yearlyIntent) {
      focus.push('用户问的是大限 / 大运（这十年）。');
    }
    if (yearlyFocus) {
      focus.push('命主在面板中看的是 ' + yearlyFocus + ' 年流年。');
    } else if (yearlyIntent && !decadalIntent) {
      focus.push('用户问的是流年 / 年运。');
    }
    if (focus.length) {
      var focusBody = yearlyFocus || (yearlyIntent && !decadalFocus)
        ? '请以「当前定位」里的流年段落为主线：先写该年干支、流年命宫与本命落点、流年四化，再结合当前大限讲这一年的节奏与取舍，最后给 1–3 条建议；不要复述命格总纲。'
        : '请以「当前定位」里的当前大限为主线：先定位段位 / 宫位 / 大限四化，再讲这十年的三方四正与节奏，最后给 1–3 条建议；不要复述命格总纲。';
      first += '\n\n【本轮聚焦】' + focus.join('') + focusBody;
    }

    var messages = [{ role: 'user', content: first }];
    history.forEach(function (m) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) return;
      var text = typeof m.content === 'string' ? m.content : '';
      if (!text.trim()) return;
      messages.push({ role: m.role, content: text });
    });
    if (question) messages.push({ role: 'user', content: question });

    return { system: system, messages: messages, mode: mode };
  }

  /* ---------------- 导出 ---------------- */
  Core.PERSONA = PERSONA;
  Core.SELFCHECK = SELFCHECK;
  Core.DISCLAIMER_BRIEF = DISCLAIMER_BRIEF;
  Core.DISCLAIMER_REPORT = DISCLAIMER_REPORT;
  Core.GOLDEN = GOLDEN;
  Core.normalizeInput = normalizeInput;
  Core.paipan = paipan;
  Core.chartText = chartText;
  Core.fullChartText = fullChartText;
  Core.currentContext = currentContext;
  Core.goldenCheck = goldenCheck;
  Core.buildRequest = buildRequest;
  Core.VERSION = '1.0.0';

  root.ZWCore = Core;
})(typeof window !== 'undefined' ? window : globalThis);

}
/* ================================================================
 * 紫微斗数 Pro — 专业独立工作台 (Harness Web UI 插件)
 * 架构: 顶栏 + 左栏(输入/命主/命盘库) + 主舞台(命盘盘面/详情/工具页)
 * ================================================================ */
window.__ModuleLoader__.load({
  id: '@local/ziwei-workbench',
  factory(require) {
    /* 首次物化时才求值引擎/内核（懒加载，见 build.mjs 的 KERNEL_HEAD） */
    if (typeof __ziweiBootstrapKernel === 'function') __ziweiBootstrapKernel();
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useMemo, useRef } = React;
    const E = window.ZWEngine;

    /* ---------------- i18n ---------------- */
    const DICT = {
      'zh-CN': {
        brand: '紫微斗数', brandPro: 'Pro', tagline: '专业排盘 · 智能解读',
        formTitle: '排盘输入', name: '姓名', namePh: '命主称呼（选填）',
        calendar: '历法', solar: '公历', lunar: '农历',
        year: '年', month: '月', day: '日', leap: '闰月',
        time: '出生时间', hour: '时', minute: '分',
        gender: '性别', male: '男', female: '女',
        lonLabel: '出生地经度', lonPh: '如 116.4（真太阳时校正，可留空）',
        placeLabel: '籍贯', placePh: '选填，用于报告',
        occupationLabel: '职业 / 诉求', occupationPh: '选填，用于报告',
        compute: '排 盘',
        settings: '排盘设置', yearDivide: '年柱', ydNormal: '正月初一', ydExact: '立春',
        monthDivide: '月柱', mdNormal: '农历月', mdExact: '节气',
        monthDivideHint: '四柱月柱默认按节气；命宫/星曜仍按农历月，不受此处影响。',
        dayDivide: '晚子时', ddForward: '按次日', ddCurrent: '按当日',
        fixLeap: '闰月', flTrue: '下半月按下月', flFalse: '整月按本月',
        summaryTitle: '命主信息', solarLabel: '公历', lunarLabel: '农历',
        zodiac: '生肖', sign: '星座', soul: '命宫', body: '身宫', class5: '五行局',
        soulMaster: '命主', bodyMaster: '身主', startAge: '起运', solarTime: '真太阳时',
        uncorrected: '未校正', boundaryWarn: '⚠ 时辰边界告警：校正后时刻贴近时辰交界，请核对出生钟表时间',
        tabNatal: '本命盘', tabDecadal: '大限', tabYearly: '流年', tabPatterns: '格局分析', tabDict: '星曜词典',
        decadalListTitle: '十二大限', decadalInfoTitle: '大限四化',
        yearlyLabel: '流年', yearlyYear: '年份', yearlyPlaceholder: '如 2026',
        smallLimit: '小限', decadal: '大限', twelveGods: '十二神',
        bodyMark: '身', mingMark: '命',
        palace: '宫', emptyState: '填写出生信息，点击「排 盘」开始',
        mainStars: '主星', minorStars: '辅星', adjStars: '杂曜',
        showAdj: '显示杂曜', hideAdj: '隐藏杂曜', adjChip: '杂曜',
        editBirth: '改生辰', collapseForm: '收起', expandForm: '展开',
        focusOn: '专注看盘', focusOff: '退出专注', emptyPalace: '空宫',
        emptyCta: '用示例生辰先排一盘', defaultName: '命主',
        oppPalace: '对宫', triPalace: '三合', detailTitle: '宫位详情',
        mutagenTitle: '四化', noMutagen: '—',
        ai: '紫微师解读', aiTitle: '紫微师 · 直接聊', modeBrief: '速览解读', modeReport: '鲲鹏报告',
        aiSend: '发送', aiNewChat: '新对话', aiAskPh: '追问：如「重点讲事业与财运」「这个大限要注意什么」（Enter 发送，Shift+Enter 换行）',
        aiSub: '命盘已自动带上 · 会话模型回答',
        aiSug1: '重点讲事业与财运',
        aiSug2: '这个大限要注意什么',
        aiSug3: '写完整鲲鹏报告（14 部分）',
        aiEmptyHint: '直接问就行：命盘会自动带上。速览解读给 800~1200 字；切到「鲲鹏报告」出完整 14 部分。',
        aiEngineHint: '由 Harness 会话已配置的模型回答（不需要另配 API Key）。排盘来自确定性引擎，非模型心算。',
        timeScope: '命盘时间维度', backToBoard: '返回盘面',
        prevDecade: '上一个大限', nextDecade: '下一个大限', backToCurrent: '回到当前',
        currentBadge: '当前', thisYear: '今年', prevYear: '上一年', nextYear: '下一年',
        collapseRail: '收起生辰栏', expandRail: '展开生辰栏', editBirthShort: '生辰',
        chartTools: '工具', openPatterns: '格局分析', openDict: '星曜词典',
        handoff: '新会话解读', handoffDone: '已开新会话 ✓',
        handoffHint: '把当前命盘交给会话；之后在对话里说「继续聊这个盘」或「写鲲鹏报告」即可',
        disclaimerShort: '本内容基于中华传统文化（紫微斗数）体系生成，非现代科学结论，仅供参考。涉及医疗 / 法律 / 投资 / 婚姻等具体决策，请咨询相关专业人士。',
        aiInterpreting: '解读中…', interpStreaming: '生成中…',
        aiThinking: '思考中…', aiStop: '停止', aiContinue: '继续生成',
        aiStopped: '已停止生成，内容可能不完整；可点「继续生成」接着写',
        aiDisconnected: '连接中断，内容可能不完整；可点「继续生成」接着写',
        aiContinuePrompt: '请接着上文继续写：从断处接着写，不要重复已写内容，也不要重新开头。',
        aiCopy: '复制', aiCopied: '已复制',
        sync: '写入会话', synced: '已写入 ✓',
        syncHint: '只把当前命盘写进会话上下文（不新建会话）；之后在任意会话里说「读取工作台命盘并写鲲鹏报告」即可', exportHtml: '导出精装 HTML', previewHtml: '预览报告', closePreview: '关闭预览',
        aiRetry: '重新解读',
        autoOpen: '启动时自动打开工作台', showAdjSet: '宫格默认显示杂曜',
        settingsTitle: '设置', close: '关闭', about: '关于',
        backToConversation: '返回会话',
        aboutText: '紫微斗数 Pro · 算法依据《紫微斗数全书》安星诀，与开源库 iztro 逐字段交叉验证。真太阳时校正含经度差与均时差。本工具仅供研究参考。',
        libTitle: '命盘库', libName: '盘名', libSave: '保存', libEmpty: '暂无保存的命盘', libDelete: '删除',
        patternTitle: '格局分析', patternEmpty: '未检测到显著格局',
        dictTitle: '星曜词典', dictPlaceholder: '搜索星曜…',
        keyboardHint: '点盘面后：←→ 切换宫位 · ↑↓ 跳对宫',
        copy: '复制命盘', copied: '已复制',
        note1: '算法依据《紫微斗数全书》安星诀（14 主星 · 14 辅星 · 38 杂曜 · 十二神 · 大限小限 · 流曜），与开源库 iztro 逐字段交叉验证。',
        note2: '流派选项：年柱可按正月初一或立春分界；月柱可按农历月或节气；晚子时可换日或按当日；闰月下半月可按下月。'
      },
      'en-US': {
        brand: 'Zi Wei Dou Shu', brandPro: 'Pro', tagline: 'Charting · Analysis',
        formTitle: 'Birth Data', name: 'Name', namePh: 'Name (optional)',
        calendar: 'Calendar', solar: 'Solar', lunar: 'Lunar',
        year: 'Year', month: 'Month', day: 'Day', leap: 'Leap',
        time: 'Birth Time', hour: 'Hr', minute: 'Min',
        gender: 'Gender', male: 'Male', female: 'Female',
        lonLabel: 'Longitude °E', lonPh: 'e.g. 116.4 (true solar time)',
        placeLabel: 'Place', placePh: 'optional', occupationLabel: 'Occupation / Focus', occupationPh: 'optional',
        compute: 'Draw Chart',
        settings: 'Options', yearDivide: 'Year', ydNormal: 'LNY', ydExact: 'Lichun',
        monthDivide: 'Month', mdNormal: 'Lunar', mdExact: 'Terms',
        monthDivideHint: 'Month pillar uses solar terms by default; palaces and stars still use the lunar month.',
        dayDivide: 'Late Rat', ddForward: 'Next Day', ddCurrent: 'Same Day',
        fixLeap: 'Leap', flTrue: '2nd half next', flFalse: 'whole month',
        summaryTitle: 'Profile', solarLabel: 'Solar', lunarLabel: 'Lunar',
        zodiac: 'Zodiac', sign: 'Sign', soul: 'Soul', body: 'Body', class5: 'Class',
        soulMaster: 'Soul Star', bodyMaster: 'Body Star', startAge: 'Start', solarTime: 'True Solar',
        uncorrected: 'uncorrected', boundaryWarn: '⚠ Near hour boundary — verify clock time',
        tabNatal: 'Natal', tabDecadal: 'Decades', tabYearly: 'Yearly', tabPatterns: 'Patterns', tabDict: 'Dictionary',
        decadalListTitle: 'Decades', decadalInfoTitle: 'Decade Transforms',
        yearlyLabel: 'Yearly', yearlyYear: 'Year', yearlyPlaceholder: 'e.g. 2026',
        smallLimit: 'Xiaoxian', decadal: 'Decade', twelveGods: 'Gods',
        bodyMark: 'Body', mingMark: 'Soul',
        palace: 'Palace', emptyState: 'Fill birth data and press "Draw Chart"',
        mainStars: 'Major', minorStars: 'Minor', adjStars: 'Adj',
        showAdj: 'Show adj', hideAdj: 'Hide adj', adjChip: 'Adj',
        editBirth: 'Edit birth data', collapseForm: 'Collapse', expandForm: 'Expand',
        focusOn: 'Focus chart', focusOff: 'Exit focus', emptyPalace: 'Empty',
        emptyCta: 'Draw a sample chart', defaultName: 'Native',
        oppPalace: 'Opposite', triPalace: 'Trine', detailTitle: 'Palace Detail',
        mutagenTitle: 'Transforms', noMutagen: '—',
        ai: 'Reading', aiTitle: 'Zi Wei Master · Chat', modeBrief: 'Brief', modeReport: 'Kunpeng Report',
        aiSend: 'Send', aiNewChat: 'New chat', aiAskPh: 'Ask a follow-up (Enter to send, Shift+Enter for newline)',
        aiSub: 'Chart attached · answered by the session model',
        aiSug1: 'Focus on career and wealth',
        aiSug2: 'What should I watch in this decade?',
        aiSug3: 'Write the full Kunpeng report',
        aiEmptyHint: 'Just ask — the chart is attached automatically.',
        aiEngineHint: 'Answered by the model configured in this Harness session (no separate API key needed).',
        timeScope: 'Time scope', backToBoard: 'Back to chart',
        prevDecade: 'Previous decade', nextDecade: 'Next decade', backToCurrent: 'Back to current',
        currentBadge: 'Current', thisYear: 'This year', prevYear: 'Previous year', nextYear: 'Next year',
        collapseRail: 'Collapse birth panel', expandRail: 'Expand birth panel', editBirthShort: 'Birth data',
        chartTools: 'Tools', openPatterns: 'Patterns', openDict: 'Star dictionary',
        handoff: 'New session', handoffDone: 'Session opened ✓',
        handoffHint: 'Hand this chart to the session so the agent can continue the reading.',
        disclaimerShort: 'Generated from the traditional Chinese Zi Wei Dou Shu system; not a scientific conclusion, for reference only.',
        aiInterpreting: 'Reading…', interpStreaming: 'Generating…',
        aiThinking: 'Thinking…', aiStop: 'Stop', aiContinue: 'Continue',
        aiStopped: 'Stopped; the answer may be incomplete — press Continue to resume.',
        aiDisconnected: 'Connection lost; the answer may be incomplete — press Continue to resume.',
        aiContinuePrompt: 'Continue from where you stopped; do not repeat or restart the answer.',
        aiCopy: 'Copy', aiCopied: 'Copied',
        sync: 'Write to session', synced: 'Written ✓',
        syncHint: 'Write this chart into the session context (no new session); then ask the agent to read it.', exportHtml: 'Export HTML', previewHtml: 'Preview', closePreview: 'Close Preview',
        aiRetry: 'Retry',
        autoOpen: 'Open workbench on launch', showAdjSet: 'Show adjective stars in cells by default',
        settingsTitle: 'Settings', close: 'Close', about: 'About',
        backToConversation: 'Back to conversation',
        aboutText: 'Zi Wei Dou Shu Pro. Algorithm verified field-by-field against the open-source iztro library. True solar time correction included.',
        libTitle: 'Chart Library', libName: 'Name', libSave: 'Save', libEmpty: 'No saved charts', libDelete: 'Delete',
        patternTitle: 'Patterns', patternEmpty: 'No notable patterns detected',
        dictTitle: 'Star Dictionary', dictPlaceholder: 'Search stars…',
        keyboardHint: 'Click chart: ←→ palace · ↑↓ opposite',
        copy: 'Copy Chart', copied: 'Copied',
        note1: 'Algorithm per the classic ZWDS star-placement rules (14 major + 14 minor + 38 adjective stars), cross-verified with iztro.',
        note2: 'School options: year pillar by LNY or Lichun; month pillar by lunar month or solar terms.'
      }
    };

    /* ---------------- 星曜色板与角标 ---------------- */
    const MAJOR_COLOR = {
      紫微: '#9d6fd1', 天机: '#4d9fce', 太阳: '#e08a4a', 武曲: '#c19a3c',
      天同: '#d16a8e', 廉贞: '#c45948', 天府: '#a97a50', 太阴: '#7d8dd0',
      贪狼: '#4fae7d', 巨门: '#8da0aa', 天相: '#43b19d', 天梁: '#9a8a76',
      七杀: '#b04555', 破军: '#5d78b8'
    };
    const MINOR_GOOD = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺', '禄存', '天马', '天喜', '天官', '天福', '台辅', '封诰'];
    const MINOR_BAD = ['火星', '铃星', '擎羊', '陀罗', '地空', '地劫', '天刑', '阴煞', '天空', '天哭', '天虚', '劫煞', '灾煞', '孤辰', '寡宿'];
    const starColor = (name) => MAJOR_COLOR[name] || null;
    const starClass = (name) => {
      if (MAJOR_COLOR[name]) return 'major';
      if (MINOR_GOOD.indexOf(name) >= 0) return 'good';
      if (MINOR_BAD.indexOf(name) >= 0) return 'bad';
      return 'adj';
    };
    const MU_CHARS = ['禄', '权', '科', '忌'];
    const MU_CLASS = { '禄': 'lu', '权': 'quan', '科': 'ke', '忌': 'ji' };
    const BRIGHT_CLASS = { '庙': 'miao', '旺': 'wang', '得': 'de', '利': 'li', '平': 'ping', '不': 'bu', '陷': 'xian' };

    /* ---------------- 样式 (设计系统) ---------------- */
    const CSS = `
/* ================================================================
 * 设计系统 v2
 * - 所有底色/边框/文字只走 --dsw-alias-* token；星曜/四化等内容色单列
 * - 命盘盘面优先占宽: 布局按面板实测宽度切换 (data-w)，不再用 viewport media query
 * - 盘面字号用容器查询单位 (cqw) 随盘宽等比缩放，窄面板下不挤字
 * - 支持深色主题 (body[data-ds-dark-theme]) 与专注看盘 (data-focus)
 * ================================================================ */
.zp-root {
  --zp-accent: #7c5cf0;
  --zp-accent-deep: #5b3fd6;
  --zp-fill-accent: #7c5cf0;
  --zp-fill-accent-deep: #5b3fd6;
  --zp-gold: #c9a35c;
  --zp-gold-dim: #8a7550;
  --zp-mu-lu: #15803d;
  --zp-mu-quan: #1d4ed8;
  --zp-mu-ke: #a16207;
  --zp-mu-ji: #b91c1c;
  --zp-good: #15803d;
  --zp-bad: #b91c1c;
  --zp-board-max: 720px;
  position: relative;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsh-font-family-text-default, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", sans-serif);
  -webkit-font-smoothing: antialiased;
  scrollbar-width: thin;
  /* 把面板内部的 z-index（sticky 头 z20、浮层 z100）关进本面板自己的层叠上下文：
     frame 的 shell.leading（z-index 15，侧栏折叠后的「展开侧栏 / 新会话」出口）
     是 frame 的直接子元素，不能再被面板内部的高 z-index 盖住或抢走点击。 */
  isolation: isolate;
}

/* ---------------- 窗口 chrome 避让（macOS 桌面端） ----------------
 * 契约见 @deepseek-ai/dsh-client-ui-layout README「Window-chrome seat」：
 * - html[data-platform=darwin] 发布 --dsh-frame-top-clearance（48px），入口页要把内容压到窗口标题带之下；
 * - 侧栏完全隐藏时 frame 追加发布 --dsh-frame-leading-clearance（160px，全屏 84px），
 *   此时面板左缘即窗口左缘，左上角必须让出 traffic lights + leading 控件的横向条带；
 * - 浮层用 --dsh-frame-overlay-top（= top-clearance + 20px）作为视口内边距。
 * 变量全部带 0px 兜底、选择器限定 darwin：Web / Windows 渲染不受影响。
 * 选择器加 html + 2 个类/属性（0,3,1），高于 .zp-root[data-w="narrow"] 的 (0,3,0)，
 * 窄面板规则不会把这里的 padding 覆盖回去。 */
html[data-platform="darwin"] .zp-root {
  padding-top: var(--dsh-frame-top-clearance, 0px);
}
html[data-platform="darwin"] [data-sidebar-collapsed] .zp-head {
  /* 顶栏内容起点 = max(设计内边距 22px, leading 条带宽度)；侧栏隐藏时面板左缘即窗口左缘 */
  padding-left: max(22px, var(--dsh-frame-leading-clearance, 0px));
}
html[data-platform="darwin"] .zp-root .zp-overlay-center {
  /* 设置弹层：上内边距取官方浮层 inset（68px 普通 / 全屏 20px），不钻到窗口标题带里 */
  padding-top: max(46px, var(--dsh-frame-overlay-top, 46px));
}
.zp-scroll {
  height: 100%; overflow: auto; box-sizing: border-box;
  padding: 0 20px 40px; scrollbar-width: thin;
}
.zp-root[data-w="narrow"] .zp-scroll { padding: 0 14px 32px; }
.zp-scroll-locked { overflow: hidden }
.zp-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.zp-scroll::-webkit-scrollbar-thumb {
  background: rgba(128,128,128,.35);
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 30%, transparent);
  border-radius: 6px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.zp-inner { max-width: 1460px; margin: 0 auto; display: flex; flex-direction: column; min-height: 100% }

/* ---------------- 顶栏 ---------------- */
.zp-head {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 12px 2px 11px; position: sticky; top: 0; z-index: 20;
  background: var(--dsw-alias-bg-base);
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 90%, transparent);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  margin: 0 -20px 14px; padding-left: 22px; padding-right: 22px;
}
.zp-root[data-w="narrow"] .zp-head { margin: 0 -14px 12px; padding-left: 16px; padding-right: 16px; }
.zp-brand { display: flex; align-items: center; gap: 8px; flex: none }
.zp-brand-name { font-size: 17px; font-weight: 750; letter-spacing: 1.5px }
.zp-brand-pro {
  font-size: 10px; font-weight: 800; letter-spacing: 1px; line-height: 1.5;
  color: var(--zp-accent); border: 1px solid color-mix(in srgb, var(--zp-accent) 45%, transparent);
  border-radius: 6px; padding: 0 6px;
}
.zp-brand-tag {
  display: none; font-size: 11px; color: var(--dsw-alias-label-secondary); letter-spacing: .5px;
  border-left: 1px solid var(--dsw-alias-border-l1); padding-left: 10px; margin-left: 2px;
}
.zp-root[data-w="wide"] .zp-brand-tag { display: inline }
.zp-head-sum { display: none; align-items: center; gap: 6px; min-width: 0; flex: 1 1 0; overflow: hidden }
.zp-root[data-w="mid"] .zp-head-sum, .zp-root[data-w="wide"] .zp-head-sum, .zp-root[data-w="compact"] .zp-head-sum { display: flex }
.zp-sum-chip {
  font-size: 11.5px; color: var(--dsw-alias-label-secondary); white-space: nowrap;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px; padding: 2px 9px;
}
.zp-sum-chip b { color: var(--dsw-alias-label-primary); font-weight: 650 }
.zp-sum-gz { letter-spacing: 1.5px; font-variant-numeric: tabular-nums }
.zp-root[data-w="mid"] .zp-sum-class, .zp-root[data-w="compact"] .zp-sum-class { display: none }
.zp-head-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap }

/* ---------------- 布局骨架 ---------------- */
.zp-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start }
.zp-root[data-w="mid"] .zp-body { grid-template-columns: 296px minmax(0, 1fr); gap: 16px }
.zp-root[data-w="wide"] .zp-body { grid-template-columns: 304px minmax(0, 1fr); gap: 16px }
.zp-side { display: flex; flex-direction: column; gap: 12px; min-width: 0 }
/* 窄面板: 左栏拆开重排 —— 出盘前生辰输入在上；出盘后盘面在前（见 data-chart 规则），命主信息/命盘库沉底 */
.zp-root[data-w="narrow"] .zp-side { display: contents }
.zp-input-card { order: 1 }
.zp-stage { order: 2 }
.zp-summary-card { order: 3 }
.zp-lib-card { order: 4 }
.zp-root[data-w="narrow"][data-chart="1"] .zp-stage { order: 1 }
.zp-root[data-w="narrow"][data-chart="1"] .zp-input-card { order: 2 }
.zp-stage { min-width: 0; outline: none; border-radius: 14px }
.zp-stage:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 3px }

/* ---------------- 卡片 ---------------- */
.zp-card {
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 14px; padding: 14px 16px;
}
.zp-card-title {
  font-size: 11px; font-weight: 800; letter-spacing: 1.8px; color: var(--dsw-alias-label-secondary);
  margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
}
.zp-card-title::before {
  content: ''; width: 3px; height: 12px; border-radius: 2px; flex: none;
  background: linear-gradient(180deg, var(--zp-accent), var(--zp-gold));
}
.zp-title-actions { margin-left: auto; display: flex; gap: 6px; align-items: center }
.zp-link-btn {
  border: none; background: transparent; color: var(--dsw-alias-label-secondary);
  font-size: 11px; font-weight: 600; font-family: inherit; cursor: pointer;
  padding: 2px 6px; border-radius: 6px; letter-spacing: .5px; height: auto;
}
.zp-link-btn:hover { color: var(--zp-accent); background: color-mix(in srgb, var(--zp-accent) 10%, transparent) }

/* ---------------- 表单 ---------------- */
.zp-field { margin-bottom: 9px }
.zp-field-label { display: block; font-size: 11px; color: var(--dsw-alias-label-secondary); margin-bottom: 4px; letter-spacing: .5px }
.zp-input {
  box-sizing: border-box; width: 100%;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px; color: var(--dsw-alias-label-primary); padding: 6px 9px;
  font-size: 13px; font-family: inherit; transition: border-color .12s, box-shadow .12s;
}
.zp-input::placeholder { color: color-mix(in srgb, var(--dsw-alias-label-secondary) 80%, transparent) }
.zp-input:focus {
  border-color: var(--zp-accent); outline: none;
  box-shadow: 0 0 0 2px var(--dsw-alias-border-l2);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--zp-accent) 24%, transparent);
}
.zp-row { display: flex; gap: 6px; align-items: center; min-width: 0 }
.zp-birth-line {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; padding: 8px 10px;
}
.zp-birth-text { font-size: 12.5px; color: var(--dsw-alias-label-secondary); line-height: 1.6; flex: 1 1 180px; letter-spacing: .3px }
.zp-birth-text b { color: var(--dsw-alias-label-primary); font-weight: 700 }

/* 分段控件 / 按钮 */
.zp-seg {
  display: inline-flex; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px; padding: 2px; gap: 2px; width: 100%; box-sizing: border-box;
}
.zp-seg button {
  flex: 1; border: none; background: transparent; color: var(--dsw-alias-label-secondary);
  padding: 4px 8px; font-size: 12px; cursor: pointer; border-radius: 6px; font-weight: 600; font-family: inherit;
  transition: background .12s, color .12s;
}
.zp-seg button.on { background: var(--zp-fill-accent); color: #fff }
.zp-btn {
  box-sizing: border-box; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px; color: var(--dsw-alias-label-primary); padding: 0 13px; height: 32px;
  font-size: 12.5px; cursor: pointer; font-family: inherit;
  transition: border-color .12s, background .12s, opacity .12s; white-space: nowrap;
}
.zp-btn:hover { border-color: color-mix(in srgb, var(--zp-accent) 55%, var(--dsw-alias-border-l1)) }
.zp-btn:active { opacity: .86 }
.zp-btn:disabled { opacity: .5; cursor: default }
.zp-btn-primary {
  background: linear-gradient(135deg, var(--zp-fill-accent), var(--zp-fill-accent-deep));
  border: none; color: #fff; font-weight: 650; height: 34px;
}
.zp-btn-primary:hover { opacity: .93; border: none }
.zp-btn:focus-visible, .zp-input:focus-visible, .zp-toggle:focus-visible, .zp-tabs button:focus-visible, .zp-link-btn:focus-visible {
  outline: 2px solid var(--zp-accent); outline-offset: 2px;
}
.zp-error { color: var(--dsw-alias-state-error-primary); font-size: 12px; margin-top: 8px; line-height: 1.55 }
.zp-warn { color: var(--dsw-alias-state-warn-primary); font-size: 11px; margin-top: 6px; line-height: 1.55 }
.zp-note {
  font-size: 11px; color: var(--dsw-alias-label-secondary); line-height: 1.65;
  margin-top: 12px; border-top: 1px dashed var(--dsw-alias-border-l1); padding-top: 10px;
}

/* ---------------- 命主信息 ---------------- */
.zp-pillars { display: flex; gap: 6px; margin-bottom: 10px }
.zp-pillar {
  flex: 1; text-align: center; padding: 6px 2px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2); font-size: 15px; font-weight: 750; letter-spacing: 2px;
}
.zp-kv-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0 18px }
.zp-root[data-w="narrow"] .zp-kv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) }
.zp-kv { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 12px; padding: 3px 0; min-width: 0 }
.zp-kv > span { color: var(--dsw-alias-label-secondary); flex: none; font-size: 11px }
.zp-kv > b { font-weight: 650; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: .2px }
.zp-kv-wide { grid-column: 1 / -1 }
.zp-decadal-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(248px, 1fr)); gap: 6px }
.zp-decadal-list .zp-list-item { margin-bottom: 0 }
.zp-mutagen-strip { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px }
.zp-mu {
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
  border: 1px solid; background: color-mix(in srgb, currentColor 12%, transparent);
}
.zp-mu-lu { color: var(--zp-mu-lu) }
.zp-mu-quan { color: var(--zp-mu-quan) }
.zp-mu-ke { color: var(--zp-mu-ke) }
.zp-mu-ji { color: var(--zp-mu-ji) }

/* ---------------- 舞台：页签 / 工具 ---------------- */
.zp-stage-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px }
.zp-tabs {
  display: inline-flex; align-items: center; gap: 2px; padding: 3px;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px; max-width: 100%; overflow-x: auto; scrollbar-width: none;
}
.zp-tabs::-webkit-scrollbar { display: none }
.zp-tabs button {
  border: none; background: transparent; color: var(--dsw-alias-label-secondary);
  padding: 5px 13px; font-size: 12.5px; font-weight: 650; cursor: pointer;
  border-radius: 999px; font-family: inherit; white-space: nowrap; transition: background .12s, color .12s;
}
.zp-tabs button:hover { color: var(--dsw-alias-label-primary) }
.zp-tabs button.on { background: var(--zp-fill-accent); color: #fff }
.zp-stage-ctrl { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap }
.zp-toggle {
  display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px;
  font-size: 11.5px; font-weight: 600; font-family: inherit; letter-spacing: .3px;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; cursor: pointer;
  transition: color .12s, border-color .12s, background .12s;
}
.zp-toggle:hover { color: var(--dsw-alias-label-primary) }
.zp-toggle.on {
  color: var(--zp-accent);
  border-color: var(--zp-accent);
  border-color: color-mix(in srgb, var(--zp-accent) 50%, transparent);
  background: var(--dsw-alias-bg-layer-2);
  background: color-mix(in srgb, var(--zp-accent) 12%, transparent);
}
.zp-scope-bar {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding: 6px 10px;
  font-size: 12px; color: var(--dsw-alias-label-secondary); flex-wrap: wrap;
  background: var(--dsw-alias-bg-layer-2); border-left: 3px solid var(--zp-accent); border-radius: 0 8px 8px 0;
}
.zp-scope-bar b { color: var(--zp-accent); font-weight: 750 }

/* ---------------- 命盘盘面 ---------------- */
.zp-board-wrap { display: block }
.zp-root[data-w="wide"] .zp-board-wrap.has-detail {
  display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; align-items: start;
}
.zp-board {
  width: 100%; max-width: var(--zp-board-max); margin: 0 auto; padding: 5px; border-radius: 18px; box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1);
  border: 1px solid color-mix(in srgb, var(--zp-gold) 26%, var(--dsw-alias-border-l1));
  background: var(--dsw-alias-bg-layer-2);
  background: linear-gradient(180deg, color-mix(in srgb, var(--zp-gold) 6%, transparent), transparent 55%);
  box-shadow: 0 1px 2px color-mix(in srgb, #000 5%, transparent);
}
.zp-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(4, auto);
  gap: 3px; overflow: hidden; border-radius: 14px;
  background: var(--dsw-alias-border-l1); border: 1px solid var(--dsw-alias-border-l1);
  container-type: inline-size;
}
.zp-cell {
  background: var(--dsw-alias-bg-layer-1);
  padding: 8px;
  padding: clamp(6px, 1.35cqw, 11px);
  min-height: 96px; min-height: clamp(96px, 19cqw, 150px);
  cursor: pointer; display: flex; flex-direction: column; gap: 2px;
  position: relative; min-width: 0; transition: background .12s, box-shadow .12s;
}
.zp-cell:hover { background: var(--dsw-alias-bg-layer-2); background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 90%, var(--zp-accent) 10%) }
.zp-cell.on {
  background: var(--dsw-alias-bg-layer-2);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 84%, var(--zp-accent) 16%);
  box-shadow: inset 0 0 0 2px var(--zp-accent);
}
.zp-cell.empty .zp-cell-name { color: var(--dsw-alias-label-secondary) }
.zp-cell:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: -2px }
.zp-cell-top { display: flex; justify-content: space-between; align-items: baseline; gap: 2px 4px; flex-wrap: wrap; min-width: 0 }
.zp-cell-name {
  font-size: 13px; font-size: clamp(11px, 1.95cqw, 14px);
  font-weight: 800; letter-spacing: .5px; white-space: nowrap;
}
.zp-cell-gz {
  font-size: 10px; font-size: clamp(8.5px, 1.35cqw, 10.5px);
  color: var(--dsw-alias-label-secondary); letter-spacing: 1px; white-space: nowrap;
}
.zp-mark {
  display: inline-block; font-size: 9px; font-weight: 800; color: #fff; line-height: 1.5;
  border-radius: 4px; padding: 0 3.5px; margin-left: 4px; vertical-align: 1px; letter-spacing: 0;
}
.zp-mark-soul { background: var(--zp-fill-accent) }
.zp-mark-body { background: var(--zp-gold); color: #3c2f14 }
.zp-stars-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 6px; line-height: 1.3; min-width: 0 }
.zp-stars-major { margin-top: 1px }
.zp-stars-minor { margin-top: 1px }
.zp-stars-scope { opacity: .92 }
.zp-star {
  font-size: 13px; font-size: clamp(10.5px, 2.05cqw, 14.5px);
  font-weight: 800; white-space: nowrap;
}
.zp-star.major { color: var(--zp-star-color, var(--dsw-alias-label-primary)) }
.zp-star.minor-line { font-size: 11.5px; font-size: clamp(9.5px, 1.7cqw, 12px); font-weight: 650 }
.zp-star.good { color: var(--zp-good) }
.zp-star.bad { color: var(--zp-bad) }
.zp-star.adj { color: var(--dsw-alias-label-secondary); font-weight: 500 }
.zp-star-none {
  font-size: 10px; font-size: clamp(8.5px, 1.4cqw, 10.5px);
  color: var(--dsw-alias-label-secondary); letter-spacing: 1px;
  border: 1px dashed var(--dsw-alias-border-l2); border-radius: 4px; padding: 0 4px;
}
.zp-bright {
  font-size: 8.5px; font-size: clamp(7.5px, 1.15cqw, 9.5px); font-weight: 700;
  color: var(--zp-gold-dim); border: 1px solid currentColor; border-radius: 3px;
  padding: 0 2px; margin-left: 2px; vertical-align: 1px;
}
.zp-mu-badge {
  font-size: 8.5px; font-size: clamp(7.5px, 1.15cqw, 9.5px); font-weight: 800; color: #fff;
  border-radius: 3px; padding: 0 2.5px; margin-left: 2px; vertical-align: 1px;
}
.zp-mu-badge.lu { background: var(--zp-mu-lu) }
.zp-mu-badge.quan { background: var(--zp-mu-quan) }
.zp-mu-badge.ke { background: var(--zp-mu-ke) }
.zp-mu-badge.ji { background: var(--zp-mu-ji) }
.zp-adj-line {
  font-size: 9.5px; font-size: clamp(8.5px, 1.45cqw, 10.5px);
  color: var(--dsw-alias-label-secondary); line-height: 1.45; opacity: .9; margin-top: 1px;
}
.zp-cell-scope {
  font-size: 9px; font-size: clamp(8px, 1.3cqw, 10px);
  color: var(--zp-accent); font-weight: 700; letter-spacing: .5px; margin-top: 1px;
}
.zp-cell-foot {
  display: flex; justify-content: space-between; align-items: baseline; gap: 4px;
  margin-top: auto; padding-top: 3px; min-width: 0;
}
.zp-cell-dec {
  font-size: 9.5px; font-size: clamp(8.5px, 1.3cqw, 10.5px);
  color: var(--zp-gold-dim); letter-spacing: .3px; white-space: nowrap;
}
.zp-cell-gods {
  font-size: 9px; font-size: clamp(8px, 1.2cqw, 10px);
  color: var(--dsw-alias-label-secondary); opacity: .8; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
/* 中宫 */
.zp-center {
  grid-column: 2 / 4; grid-row: 2 / 4; position: relative; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; gap: clamp(3px, .9cqw, 7px);
  padding: 12px; padding: clamp(8px, 2cqw, 18px); text-align: center;
  background: var(--dsw-alias-bg-layer-2);
  background:
    radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--zp-accent) 15%, transparent), transparent 68%),
    var(--dsw-alias-bg-layer-2);
}
.zp-center::before {
  content: ''; position: absolute; inset: 7px; inset: clamp(5px, 1.3cqw, 9px);
  border: 1px dashed var(--dsw-alias-border-l2);
  border: 1px dashed color-mix(in srgb, var(--zp-accent) 28%, transparent);
  border-radius: 10px; pointer-events: none;
}
.zp-taiji-wrap { display: flex; align-items: center; justify-content: center }
.zp-taiji { width: 44px; width: clamp(30px, 6.2cqw, 52px); height: auto; display: block }
.zp-center-name { font-size: 14.5px; font-size: clamp(12px, 2.1cqw, 16.5px); font-weight: 800; letter-spacing: 2px }
.zp-center-chips { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; max-width: 100% }
.zp-center-chip {
  font-size: 10px; font-size: clamp(8.5px, 1.45cqw, 10.5px); line-height: 1.6;
  padding: 0 6px; border-radius: 999px; color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 65%, transparent);
  white-space: nowrap;
}
.zp-center-sub {
  font-size: 11px; font-size: clamp(9.5px, 1.65cqw, 11.5px);
  color: var(--dsw-alias-label-secondary); letter-spacing: .5px; line-height: 1.55;
}
.zp-center-dec {
  font-size: 10.5px; font-size: clamp(9px, 1.45cqw, 10.5px);
  color: var(--zp-gold-dim); letter-spacing: .5px;
}

/* ---------------- 宫位详情 ---------------- */
.zp-detail {
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 14px; padding: 14px 16px; margin-top: 12px; min-width: 0;
}
.zp-root:not([data-w="wide"]) .zp-detail { max-width: 760px; margin-left: auto; margin-right: auto }
.zp-root[data-w="wide"] .zp-detail { margin-top: 0; position: sticky; top: 64px }
.zp-detail-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 10px }
.zp-detail-name { font-size: 16px; font-weight: 800; letter-spacing: 1px }
.zp-detail-gz { font-size: 12px; color: var(--dsw-alias-label-secondary); letter-spacing: 1px }
.zp-detail-nav { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap }
.zp-detail-nav .zp-btn { height: 26px; font-size: 11.5px; padding: 0 9px }
.zp-detail-body { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px 18px }
.zp-root[data-w="wide"] .zp-detail-body { grid-template-columns: minmax(0, 1fr) }
.zp-detail-section { min-width: 0 }
.zp-detail-section-label {
  font-size: 10px; font-weight: 800; letter-spacing: 1.8px; color: var(--dsw-alias-label-secondary);
  margin-bottom: 5px;
}
.zp-detail-stars { display: flex; flex-wrap: wrap; gap: 2px 10px; align-items: baseline }
.zp-detail-stars .zp-star { font-size: 14px }
.zp-detail-stars .zp-star.minor-line { font-size: 12px }
.zp-detail-stars .zp-star.adj { font-size: 12px }
.zp-detail-chips { display: flex; flex-wrap: wrap; gap: 6px }
.zp-chip {
  font-size: 11px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2);
  border-radius: 8px; padding: 3px 8px; line-height: 1.6;
}
.zp-chip b { font-weight: 700 }
.zp-kbd-hint { font-size: 10.5px; color: var(--dsw-alias-label-secondary); margin-top: 10px; letter-spacing: .5px }

/* ---------------- 列表（命盘库 / 大限） ---------------- */
.zp-list-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 9px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; margin-bottom: 6px;
  cursor: pointer; font-size: 12px; transition: border-color .12s, background .12s; min-width: 0;
}
.zp-list-item:hover { border-color: color-mix(in srgb, var(--zp-accent) 55%, var(--dsw-alias-border-l1)) }
.zp-list-item.on { border-color: var(--zp-accent); background: color-mix(in srgb, var(--zp-accent) 8%, transparent) }
.zp-list-item b { font-weight: 650; white-space: nowrap }
.zp-list-item .zp-list-sub { color: var(--dsw-alias-label-secondary); font-size: 11px; margin-left: auto; white-space: nowrap }
.zp-list-del {
  background: none; border: none; color: var(--dsw-alias-label-secondary); cursor: pointer;
  font-size: 13px; padding: 1px 5px; border-radius: 6px; font-family: inherit; line-height: 1.4;
}
.zp-list-del:hover { color: var(--dsw-alias-state-error-primary); background: var(--dsw-alias-bg-layer-2) }

/* ---------------- 顶栏动作 / 图标按钮 ---------------- */
.zp-btn-label { white-space: nowrap }
.zp-icon-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; min-width: 32px; padding: 0 9px; box-sizing: border-box;
  border: 1px solid transparent; border-radius: 9px; background: transparent;
  color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: 12px;
  cursor: pointer; transition: color .12s, background .12s, border-color .12s;
}
.zp-icon-btn:hover {
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l1);
}
.zp-icon-btn:disabled { opacity: .45; cursor: default }
.zp-icon-btn:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 2px }
.zp-head-sep { width: 1px; height: 18px; background: var(--dsw-alias-border-l1); flex: none; margin: 0 1px }
/* 「返回会话」出口：顶栏最左侧常驻，图标 + 文案（窄面板只留图标），键盘可聚焦 */
.zp-exit {
  flex: none;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l1);
}
.zp-exit:hover {
  border-color: color-mix(in srgb, var(--zp-accent) 45%, var(--dsw-alias-border-l1));
  background: color-mix(in srgb, var(--zp-accent) 10%, var(--dsw-alias-bg-layer-2));
}
.zp-btn-ai { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px }
.zp-btn-ai[aria-pressed="true"] { box-shadow: inset 0 0 0 1px color-mix(in srgb, #fff 35%, transparent) }
.zp-root[data-w="narrow"] .zp-icon-btn { padding: 0; width: 32px }
.zp-root[data-w="narrow"] .zp-icon-btn .zp-btn-label { display: none }

/* ---------------- 面板内浮层（抽屉 / 设置） ----------------
 * .zp-root 是不滚动外壳（position:relative），内容在 .zp-scroll 里滚；
 * 浮层绝对定位在外壳内，所以只覆盖工作台，不按视口坐标、也不受侧栏宽度变化影响。 */
.zp-overlay { position: absolute; inset: 0; z-index: 100 }
.zp-overlay-mask {
  position: absolute; inset: 0;
  background: rgba(0,0,0,.38); background: color-mix(in srgb, #000 38%, transparent);
  animation: zp-fade-in .14s ease-out;
}
.zp-overlay-center {
  position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center;
  padding: 46px 18px; overflow: auto;
}

/* 右侧阅读抽屉 */
.zp-ai {
  position: absolute; top: 0; right: 0; bottom: 0; width: min(464px, 100%);
  display: flex; flex-direction: column; min-height: 0;
  background: var(--dsw-alias-bg-layer-1);
  border-left: 1px solid var(--dsw-alias-border-l1);
  box-shadow: -18px 0 48px rgba(0,0,0,.22);
  box-shadow: -18px 0 48px color-mix(in srgb, #000 22%, transparent);
  animation: zp-slide-in .18s cubic-bezier(.22,.61,.36,1);
}
.zp-ai-head {
  flex: none; display: flex; align-items: center; gap: 10px;
  padding: 11px 12px 11px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.zp-ai-heading { display: flex; align-items: center; gap: 9px; min-width: 0; flex: 1 }
.zp-ai-glyph {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 28px; height: 28px; border-radius: 9px; color: #fff;
  background: linear-gradient(135deg, var(--zp-fill-accent), var(--zp-fill-accent-deep));
}
.zp-ai-title { font-size: 13.5px; font-weight: 750; letter-spacing: .5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.zp-ai-sub { font-size: 10.5px; color: var(--dsw-alias-label-secondary); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.zp-ai-mode { width: 168px; flex: none }
.zp-ai-body {
  flex: 1; min-height: 0; overflow-y: auto; padding: 14px;
  display: flex; flex-direction: column; gap: 10px; scrollbar-width: thin;
}
.zp-ai-body::-webkit-scrollbar { width: 8px }
.zp-ai-body::-webkit-scrollbar-thumb {
  background: rgba(128,128,128,.35);
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 30%, transparent);
  border-radius: 4px; border: 2px solid transparent; background-clip: padding-box;
}
.zp-ai-foot {
  flex: none; border-top: 1px solid var(--dsw-alias-border-l1);
  padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 8px;
  background: var(--dsw-alias-bg-layer-1);
}
.zp-ai-tools { display: flex; gap: 6px; flex-wrap: wrap; align-items: center }
.zp-ai-composer { display: flex; gap: 8px; align-items: flex-end }
.zp-ai-disclaimer { font-size: 10.5px; color: var(--dsw-alias-label-secondary); line-height: 1.5; opacity: .9 }
.zp-ai-error {
  flex: none; display: flex; align-items: flex-start; gap: 8px;
  padding: 8px 10px; border-radius: 9px; font-size: 12px; line-height: 1.5;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 42%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
  color: var(--dsw-alias-label-primary);
}
.zp-ai-error-text { flex: 1; min-width: 0; word-break: break-word }
.zp-ai-empty {
  border: 1px dashed var(--dsw-alias-border-l1); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2); padding: 16px 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.zp-ai-empty-title { font-size: 13px; font-weight: 700; letter-spacing: .5px }
.zp-ai-empty-hint { font-size: 12px; line-height: 1.7; color: var(--dsw-alias-label-secondary) }
.zp-ai-engine { font-size: 10.5px; line-height: 1.6; color: var(--dsw-alias-label-secondary); opacity: .85 }
.zp-ai-suggest { display: flex; flex-direction: column; gap: 6px; align-items: flex-start }
.zp-suggest {
  display: inline-flex; align-items: center; gap: 6px; font-family: inherit;
  font-size: 12px; text-align: left; padding: 6px 10px; border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary); cursor: pointer; transition: color .12s, border-color .12s, background .12s;
}
.zp-suggest:hover {
  color: var(--zp-accent);
  border-color: color-mix(in srgb, var(--zp-accent) 50%, transparent);
  background: color-mix(in srgb, var(--zp-accent) 8%, transparent);
}
.zp-suggest:disabled { opacity: .5; cursor: default }
.zp-send {
  width: 36px; height: 36px; flex: none; display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 10px; color: #fff; cursor: pointer;
  background: linear-gradient(135deg, var(--zp-accent), var(--zp-accent-deep));
  transition: opacity .12s;
}
.zp-send:hover { opacity: .92 }
.zp-send:disabled { opacity: .5; cursor: default }
.zp-send-stop {
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
}
.zp-mini-btn {
  display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px; box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: transparent;
  color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: 11.5px;
  cursor: pointer; transition: color .12s, background .12s, border-color .12s;
}
.zp-mini-btn:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2) }
.zp-mini-btn:focus-visible, .zp-send:focus-visible, .zp-suggest:focus-visible {
  outline: 2px solid var(--zp-accent); outline-offset: 2px;
}
.zp-mini-btn:disabled { opacity: .5; cursor: default }
.zp-mini-btn-accent {
  margin-left: auto; color: var(--zp-accent);
  border-color: color-mix(in srgb, var(--zp-accent) 42%, transparent);
}
.zp-mini-btn-accent:hover {
  color: var(--zp-accent); background: color-mix(in srgb, var(--zp-accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--zp-accent) 62%, transparent);
}
.zp-ai-preview {
  position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-base); animation: zp-fade-in .14s ease-out;
}
.zp-ai-preview-head {
  flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 12px 9px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); font-size: 12.5px;
}

/* 设置弹层 */
.zp-settings {
  width: min(520px, 100%); max-height: 86%; display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 16px; box-shadow: 0 24px 64px rgba(0,0,0,.28);
  box-shadow: 0 24px 64px color-mix(in srgb, #000 30%, transparent);
  animation: zp-pop-in .16s cubic-bezier(.22,.61,.36,1);
}
.zp-settings-head { flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1) }
.zp-settings-title { font-size: 14px; font-weight: 750; letter-spacing: .5px }
.zp-settings-body { padding: 16px; overflow: auto }
.zp-settings-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-top: 4px; line-height: 1.55 }
.zp-check {
  display: flex; align-items: center; gap: 8px; font-size: 12.5px;
  margin-bottom: 10px; cursor: pointer; color: var(--dsw-alias-label-primary);
}
.zp-check input { accent-color: var(--zp-accent) }
.zp-settings-about {
  margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--dsw-alias-border-l1);
  font-size: 11px; line-height: 1.7; color: var(--dsw-alias-label-secondary);
  display: flex; flex-direction: column; gap: 4px;
}
.zp-settings-about b { color: var(--dsw-alias-label-primary); font-size: 11px; letter-spacing: 1px }

@keyframes zp-slide-in { from { transform: translateX(24px); opacity: .55 } to { transform: none; opacity: 1 } }
@keyframes zp-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes zp-pop-in { from { transform: translateY(6px) scale(.99); opacity: .4 } to { transform: none; opacity: 1 } }

/* ---------------- 对话气泡 / 预览 ---------------- */
.zp-chat-thread { display: flex; flex-direction: column; gap: 10px }
.zp-bubble { max-width: 88%; border-radius: 12px; padding: 9px 12px; font-size: 13px; line-height: 1.7 }
.zp-bubble-user {
  align-self: flex-end; background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1); white-space: pre-wrap; word-break: break-word;
}
.zp-bubble-ai { align-self: flex-start; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); width: 100%; max-width: 100% }
.zp-bubble-text { white-space: pre-wrap; word-break: break-word }
.zp-md-h { font-weight: 650; color: var(--dsw-alias-label-primary); margin: 10px 0 4px }
.zp-md-h1 { font-size: 15px } .zp-md-h2 { font-size: 14px } .zp-md-h3 { font-size: 13.5px } .zp-md-h4 { font-size: 13px }
.zp-md-p { margin: 3px 0 }
.zp-md-li { margin: 2px 0 2px 4px }
.zp-md-quote {
  margin: 6px 0; padding: 4px 10px; border-left: 3px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary); font-style: italic;
}
.zp-md-gap { height: 6px }
.zp-md code { background: var(--dsw-alias-bg-layer-2); padding: 1px 4px; border-radius: 4px; font-size: 12px }
.zp-typing { font-size: 12px; color: var(--dsw-alias-label-secondary); padding: 6px 2px }
.zp-chat-ta { flex: 1; resize: vertical; min-height: 46px; max-height: 180px; font-family: inherit; line-height: 1.6; font-size: 13px }
.zp-preview-frame {
  width: 100%; height: 60vh; border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; background: #FAF6EF; margin-top: 10px;
}
.zp-preview-frame-full { flex: 1; height: auto; min-height: 0; margin: 0; border: none; border-radius: 0 }
/* 窄面板：抽屉铺满工作台，头部收紧 */
.zp-root[data-w="narrow"] .zp-ai { width: 100%; border-left: none; box-shadow: none }
.zp-root[data-w="narrow"] .zp-ai-mode { width: 136px }
.zp-root[data-w="narrow"] .zp-overlay-center { padding: 18px 12px }
/* ---------------- 格局 / 词典 / 空态 ---------------- */
.zp-patterns { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px }
.zp-pattern-card {
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 12px 14px;
  margin-bottom: 0; background: var(--dsw-alias-bg-layer-1);
}
.zp-pattern-name { font-size: 13.5px; font-weight: 800; color: var(--zp-accent); margin-bottom: 4px; letter-spacing: .3px }
.zp-pattern-desc { font-size: 12.5px; line-height: 1.65; color: var(--dsw-alias-label-primary) }
.zp-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap }
.zp-dict-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px }
.zp-dict-item {
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 10px 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.zp-dict-name { font-size: 13px; font-weight: 750; margin-bottom: 3px; letter-spacing: .5px }
.zp-dict-desc { font-size: 11px; color: var(--dsw-alias-label-secondary); line-height: 1.6 }
.zp-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  max-width: 560px; margin: 0 auto; width: 100%;
  padding: 48px 20px; text-align: center; color: var(--dsw-alias-label-secondary);
  border: 1px dashed var(--dsw-alias-border-l1); border-radius: 16px; background: var(--dsw-alias-bg-layer-1);
}
.zp-empty-taiji { opacity: .3 }
.zp-empty-title { font-size: 14px; letter-spacing: 1px; color: var(--dsw-alias-label-primary); font-weight: 650 }
.zp-empty-hint { font-size: 12px; line-height: 1.7 }

/* ---------------- 窄面板微调 ---------------- */
.zp-root[data-w="narrow"] .zp-head-actions .zp-btn { height: 30px; padding: 0 10px; font-size: 12px }
.zp-root[data-w="narrow"] .zp-detail { padding: 12px 14px }
.zp-root[data-w="narrow"] .zp-detail-body { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) }
.zp-root[data-w="narrow"] .zp-card { padding: 12px 14px }

/* ---------------- 专注看盘 ----------------
 * 注意：这些规则靠「同特异性 + 位置靠后」覆盖上面的 data-w / has-detail 规则，
 * 必须保持在布局规则之后、深色主题之前；往后追加布局规则会静默破坏专注态。 */

.zp-root[data-focus="1"] .zp-side { display: none }
.zp-root[data-focus="1"] .zp-body { grid-template-columns: minmax(0, 1fr) }
.zp-root[data-focus="1"] .zp-board-wrap.has-detail, .zp-root[data-focus="1"] .zp-board-wrap { display: block }
.zp-root[data-focus="1"] .zp-board { max-width: 820px }
.zp-root[data-focus="1"] .zp-detail { display: none }

/* ---------------- v3：AppBar / TimeBar / Rail / BottomBar ---------------- */
.zp-head { flex-wrap: nowrap; min-height: 56px; box-sizing: border-box }
.zp-rail-toggle { flex: none }
.zp-root[data-rail="closed"] .zp-side { display: none }
.zp-root[data-rail="closed"] .zp-body { grid-template-columns: minmax(0, 1fr) }
.zp-timebar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 12px; margin: 0 0 12px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
  position: sticky; top: 56px; z-index: 12;
}
.zp-timebar .zp-tabs { background: transparent; border: 0; padding: 0 }
.zp-timebar .zp-stage-ctrl { margin-left: 0 }
.zp-time-nav { display: inline-flex; align-items: center; gap: 4px; min-width: 0 }
.zp-time-btn {
  width: 24px; height: 24px; padding: 0; flex: none; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
  font-family: inherit; font-size: 14px; line-height: 1;
}
.zp-time-btn:hover { color: var(--dsw-alias-label-primary); border-color: var(--zp-accent) }
.zp-time-btn:disabled { opacity: .45; cursor: default }
.zp-time-btn:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 1px }
.zp-time-select {
  height: 28px; max-width: 280px; min-width: 0; padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font-family: inherit; font-size: 12px;
}
.zp-time-select:focus-visible, .zp-time-input:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 1px }
.zp-time-input {
  width: 72px; height: 28px; padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font-family: inherit; font-size: 12px;
}
.zp-time-now {
  height: 28px; padding: 0 8px; cursor: pointer; white-space: nowrap;
  border: 1px solid color-mix(in srgb, var(--zp-accent) 45%, transparent); border-radius: 999px;
  background: color-mix(in srgb, var(--zp-accent) 12%, transparent); color: var(--zp-accent);
  font-family: inherit; font-size: 11px; font-weight: 650;
}
.zp-time-now:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 1px }
.zp-time-chip {
  padding: 0 4px; font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap;
}
.zp-timebar-right { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap }
.zp-tool-btn {
  height: 28px; padding: 0 8px; cursor: pointer; white-space: nowrap;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font-family: inherit; font-size: 11px; font-weight: 600;
}
.zp-tool-btn:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2) }
.zp-tool-btn.on { color: var(--zp-accent); border-color: color-mix(in srgb, var(--zp-accent) 50%, transparent); background: color-mix(in srgb, var(--zp-accent) 10%, transparent) }
.zp-tool-btn:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 1px }
.zp-toolview-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap }
.zp-toolview-title { font-size: 14px; font-weight: 650 }
.zp-toolview-sub { font-size: 11px; color: var(--dsw-alias-label-secondary) }
.zp-bottombar { display: none }
.zp-root[data-w="narrow"][data-chart="1"] .zp-bottombar {
  display: flex; align-items: center; gap: 8px; position: sticky; bottom: 0; z-index: 14;
  margin: 12px -16px -32px; padding: 8px 16px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 92%, transparent);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
}
.zp-bottombar .zp-btn { flex: 1 1 0; height: 34px }
.zp-root[data-w="narrow"] .zp-head .zp-btn-ai { display: none }
.zp-root[data-w="narrow"] .zp-timebar { position: static; margin-bottom: 8px }
.zp-root[data-w="narrow"] .zp-time-select { max-width: 168px }
.zp-head-mini { display: none }
.zp-root[data-w="narrow"] .zp-head-mini {
  display: inline-flex; flex: 0 1 auto; min-width: 0; max-width: 168px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* compact 档（908–1071）：左栏 264 + 盘面 600，详情下沉；专治侧栏展开时中栏单列拉满 */
.zp-root[data-w="compact"] { --zp-board-max: 600px }
.zp-root[data-w="compact"] .zp-scroll { padding: 0 16px 32px }
.zp-root[data-w="compact"] .zp-body { grid-template-columns: 264px minmax(0, 1fr); gap: 12px }
.zp-root[data-w="compact"] .zp-rail-head .zp-mini-btn { display: none }
.zp-root[data-w="compact"] .zp-head { margin: 0 -16px 12px; padding-left: 16px; padding-right: 16px }
.zp-root[data-w="compact"] .zp-icon-btn { width: 32px; padding: 0 }
.zp-root[data-w="compact"] .zp-icon-btn .zp-btn-label { display: none }
.zp-root[data-w="compact"] .zp-time-btn { width: 24px }
/* 收起左栏必须压过所有档位栅格（同特异性，放最后） */
.zp-root[data-rail="closed"] .zp-body { grid-template-columns: minmax(0, 1fr) }

/* ---------------- 深色主题：内容色提亮一档 ---------------- */
body[data-ds-dark-theme] .zp-root {
  --zp-accent: #a78bfa;
  --zp-accent-deep: #7c5cf0;
  --zp-fill-accent: #6a4fe0;
  --zp-fill-accent-deep: #5840c0;
  --zp-gold: #d8b877;
  --zp-gold-dim: #b9a075;
  --zp-mu-lu: #4ade80;
  --zp-mu-quan: #7aa2ff;
  --zp-mu-ke: #e3b341;
  --zp-mu-ji: #f87171;
  --zp-good: #4ade80;
  --zp-bad: #f87171;
}
body[data-ds-dark-theme] .zp-star.major { color: color-mix(in srgb, var(--zp-star-color, #fff) 58%, #fff) }
body[data-ds-dark-theme] .zp-star.good { color: var(--zp-good) }
body[data-ds-dark-theme] .zp-star.bad { color: var(--zp-bad) }
body[data-ds-dark-theme] .zp-star-none { border-color: var(--dsw-alias-border-l2) }
body[data-ds-dark-theme] .zp-mark-body { color: #2a2210 }
body[data-ds-dark-theme] .zp-mu-badge { color: #14161a }
body[data-ds-dark-theme] .zp-preview-frame { background: #FAF6EF }
body[data-ds-dark-theme] .zp-mu { background: color-mix(in srgb, currentColor 18%, transparent) }

/* ---------------- 动效偏好 ---------------- */
@media (prefers-reduced-motion: reduce) {
  .zp-root *, .zp-root *::before, .zp-root *::after { transition: none !important; animation: none !important }
}
`;

    /* ---------------- 基础组件 ---------------- */
    function Seg(props) {
      return h('div', { className: 'zp-seg', role: 'group' },
        props.options.map(function (o) {
          var on = props.value === o.value;
          return h('button', {
            key: String(o.value), type: 'button',
            className: on ? 'on' : undefined,
            'aria-pressed': on ? 'true' : 'false',
            onClick: function () { props.onChange(o.value); }
          }, o.label);
        }));
    }

    /* 浮层键盘纪律：初始聚焦到浮层内、Tab/Shift+Tab 在浮层内循环、关闭后焦点归还。
       与官方 Modal 的行为对齐（参考 dsh-client-ui-primitives 的 useModalLayer 文档）。 */
    function focusablesIn(root) {
      if (!root) return [];
      var nodes = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      var out = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!n.disabled && n.offsetParent !== null) out.push(n);
      }
      return out;
    }
    function trapTab(ev, root) {
      if (ev.key !== 'Tab' || !root) return;
      var list = focusablesIn(root);
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
    function useDialogFocus() {
      var boxRef = useRef(null);
      useEffect(function () {
        var prev = document.activeElement;
        var list = focusablesIn(boxRef.current);
        if (list.length) list[0].focus();
        return function () {
          try { if (prev && typeof prev.focus === 'function') prev.focus(); } catch (e) { /* ignore */ }
        };
      }, []);
      return boxRef;
    }

    function Taiji(props) {
      return h('svg', { className: 'zp-taiji', viewBox: '0 0 48 48', 'aria-hidden': true },
        h('circle', { cx: 24, cy: 24, r: 22, fill: 'none', stroke: 'var(--zp-gold-dim)', strokeWidth: 1.2, opacity: 0.7 }),
        h('path', { d: 'M24 2 A22 22 0 0 1 24 46 A11 11 0 0 1 24 24 A11 11 0 0 0 24 2', fill: 'var(--zp-accent)' }),
        h('path', { d: 'M24 46 A22 22 0 0 1 24 2 A11 11 0 0 1 24 24 A11 11 0 0 0 24 46', fill: 'var(--zp-gold)' }),
        h('circle', { cx: 24, cy: 13, r: 3.2, fill: 'var(--zp-gold)' }),
        h('circle', { cx: 24, cy: 35, r: 3.2, fill: 'var(--zp-accent)' }));
    }

    function StarEl(s, extra) {
      var color = starColor(s.name);
      var cls = 'zp-star ' + starClass(s.name) + (extra && extra.minorLine ? ' minor-line' : '');
      /* 星曜主色走 CSS 变量：深色主题可在 CSS 里统一提亮，不必逐处内联判断 */
      return h('span', { key: s.name, className: cls, style: color ? { '--zp-star-color': color } : undefined },
        s.name,
        s.brightness ? h('span', { className: 'zp-bright' }, s.brightness) : null,
        s.mutagen ? h('span', { className: 'zp-mu-badge ' + MU_CLASS[s.mutagen] }, s.mutagen) : null,
        extra && extra.badge ? h('span', { className: 'zp-mu-badge ' + MU_CLASS[extra.badge] }, extra.text) : null);
    }

    /* ---------------- 排盘输入 ---------------- */
    function InputForm(props) {
      var f = props.form;
      var t = props.t;
      var set = props.setForm;
      var collapsed = !!props.collapsed;
      var onToggle = props.onToggleCollapse || function () { };
      var lunarMode = f.calendar === 'lunar';
      var leapAvailable = lunarMode && E.leapMonth(+f.year) === +f.month;
      var pad2 = function (v) { return ('0' + (+v || 0)).slice(-2); };
      var birthText = [
        f.year + '-' + pad2(f.month) + '-' + pad2(f.day),
        pad2(f.hour) + ':' + pad2(f.minute),
        f.gender === 'female' ? t('female') : t('male'),
        (f.longitude === '' || f.longitude === null || f.longitude === undefined) ? t('uncorrected') : f.longitude + '°E'
      ].join(' · ');

      var setSetting = function (k, v) {
        var next = Object.assign({}, f.settings);
        next[k] = v;
        set({ settings: next });
      };

      var formBody = [
        h('div', { key: 'r1', className: 'zp-row', style: { gap: 8, alignItems: 'flex-start' } },
          h('div', { className: 'zp-field', style: { flex: 1, marginBottom: 9 } },
            h('label', { className: 'zp-field-label' }, t('name')),
            h('input', {
              className: 'zp-input', type: 'text', value: f.name || '', maxLength: 20,
              placeholder: t('namePh'), 'aria-label': t('name'),
              onChange: function (ev) { set({ name: ev.target.value }); }
            })),
          h('div', { className: 'zp-field', style: { flex: 1, marginBottom: 9 } },
            h('label', { className: 'zp-field-label' }, t('calendar')),
            h(Seg, {
              value: f.calendar,
              options: [{ value: 'solar', label: t('solar') }, { value: 'lunar', label: t('lunar') }],
              onChange: function (v) { set({ calendar: v, isLeap: false }); }
            }))),
        h('div', { key: 'r2', className: 'zp-field' },
          h('label', { className: 'zp-field-label' }, t('year') + ' / ' + t('month') + ' / ' + t('day')),
          h('div', { className: 'zp-row' },
            h('input', {
              className: 'zp-input', type: 'number', value: f.year, min: 1900, max: 2100, style: { flex: 1, minWidth: 0 },
              'aria-label': t('year'),
              onChange: function (ev) { set({ year: ev.target.value }); }
            }),
            h('input', {
              className: 'zp-input', type: 'number', value: f.month, min: 1, max: 12, style: { width: 58, flex: 'none' },
              'aria-label': t('month'),
              onChange: function (ev) { set({ month: ev.target.value }); }
            }),
            h('input', {
              className: 'zp-input', type: 'number', value: f.day, min: 1, max: 30, style: { width: 58, flex: 'none' },
              'aria-label': t('day'),
              onChange: function (ev) { set({ day: ev.target.value }); }
            }),
            lunarMode ? h('label', { className: 'zp-row', style: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)', gap: 4, flex: 'none' } },
              h('input', {
                type: 'checkbox', checked: !!f.isLeap, disabled: !leapAvailable,
                onChange: function (ev) { set({ isLeap: ev.target.checked }); }
              }), t('leap')) : null)),
        h('div', { key: 'r3', className: 'zp-field' },
          h('label', { className: 'zp-field-label' }, t('time') + ' · ' + t('gender')),
          h('div', { className: 'zp-row' },
            h('input', {
              className: 'zp-input', type: 'number', value: f.hour, min: 0, max: 23, style: { width: 58, flex: 'none' },
              'aria-label': t('hour'),
              onChange: function (ev) { set({ hour: ev.target.value }); }
            }),
            h('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', flex: 'none' } }, t('hour')),
            h('input', {
              className: 'zp-input', type: 'number', value: f.minute, min: 0, max: 59, style: { width: 58, flex: 'none' },
              'aria-label': t('minute'),
              onChange: function (ev) { set({ minute: ev.target.value }); }
            }),
            h('div', { style: { flex: 1, minWidth: 96 } },
              h(Seg, {
                value: f.gender,
                options: [{ value: 'male', label: t('male') }, { value: 'female', label: t('female') }],
                onChange: function (v) { set({ gender: v }); }
              })))),
        h('div', { key: 'r4', className: 'zp-row', style: { gap: 8, alignItems: 'flex-start' } },
          h('div', { className: 'zp-field', style: { flex: 1, marginBottom: 9 } },
            h('label', { className: 'zp-field-label' }, t('lonLabel')),
            h('input', {
              className: 'zp-input', type: 'number', value: f.longitude, min: 60, max: 140, step: 'any',
              placeholder: t('lonPh'), 'aria-label': t('lonLabel'),
              onChange: function (ev) { set({ longitude: ev.target.value }); }
            })),
          h('div', { className: 'zp-field', style: { flex: 1, marginBottom: 9 } },
            h('label', { className: 'zp-field-label' }, t('placeLabel')),
            h('input', {
              className: 'zp-input', type: 'text', value: f.place || '', maxLength: 30,
              placeholder: t('placePh'), 'aria-label': t('placeLabel'),
              onChange: function (ev) { set({ place: ev.target.value }); }
            }))),
        h('div', { key: 'r5', className: 'zp-field' },
          h('label', { className: 'zp-field-label' }, t('occupationLabel')),
          h('input', {
            className: 'zp-input', type: 'text', value: f.occupation || '', maxLength: 60,
            placeholder: t('occupationPh'), 'aria-label': t('occupationLabel'),
            onChange: function (ev) { set({ occupation: ev.target.value }); }
          })),
        h('details', { key: 'r6', style: { marginBottom: 10 } },
          h('summary', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', letterSpacing: '.5px' } }, t('settings')),
          h('div', { style: { paddingTop: 8 } },
            h('div', { className: 'zp-field' },
              h('label', { className: 'zp-field-label' }, t('yearDivide')),
              h(Seg, {
                value: f.settings.yearDivide,
                options: [{ value: 'normal', label: t('ydNormal') }, { value: 'exact', label: t('ydExact') }],
                onChange: function (v) { setSetting('yearDivide', v); }
              })),
            h('div', { className: 'zp-field' },
              h('label', { className: 'zp-field-label' }, t('monthDivide')),
              h(Seg, {
                value: f.settings.monthDivide,
                options: [{ value: 'normal', label: t('mdNormal') }, { value: 'exact', label: t('mdExact') }],
                onChange: function (v) { setSetting('monthDivide', v); }
              }),
              h('div', { className: 'zp-settings-hint' }, t('monthDivideHint'))),
            h('div', { className: 'zp-field' },
              h('label', { className: 'zp-field-label' }, t('dayDivide')),
              h(Seg, {
                value: f.settings.dayDivide,
                options: [{ value: 'forward', label: t('ddForward') }, { value: 'current', label: t('ddCurrent') }],
                onChange: function (v) { setSetting('dayDivide', v); }
              })),
            h('div', { className: 'zp-field' },
              h('label', { className: 'zp-field-label' }, t('fixLeap')),
              h(Seg, {
                value: f.settings.fixLeap,
                options: [{ value: true, label: t('flTrue') }, { value: false, label: t('flFalse') }],
                onChange: function (v) { setSetting('fixLeap', v); }
              })))),
        h('button', { key: 'r7', className: 'zp-btn' + (props.hasChart ? '' : ' zp-btn-primary'), type: 'button', style: { width: '100%' }, onClick: props.onCompute },
          t('compute'))
      ];
      if (props.error) formBody.push(h('div', { key: 'r8', className: 'zp-error' }, props.error));
      formBody.push(h('div', { key: 'r9', className: 'zp-note' },
        h('div', null, t('note1')),
        h('div', null, t('note2'))));

      return h('div', { className: 'zp-card zp-input-card', 'data-region': 'SIDE_FORM' },
        h('div', { className: 'zp-card-title' }, t('formTitle'),
          h('span', { className: 'zp-title-actions' },
            h('button', { className: 'zp-link-btn', type: 'button', onClick: onToggle },
              collapsed ? t('expandForm') : t('collapseForm')))),
        collapsed
          ? h('div', { className: 'zp-birth-line' },
            h('span', { className: 'zp-birth-text' }, h('b', null, f.name || t('defaultName')), '　' + birthText),
            h('button', { className: 'zp-btn', type: 'button', style: { height: 30 }, onClick: onToggle }, t('editBirth')),
            h('button', { className: 'zp-btn' + (props.hasChart ? '' : ' zp-btn-primary'), type: 'button', style: { height: 30 }, onClick: props.onCompute }, t('compute')))
          : h('div', null, formBody),
        collapsed && props.error ? h('div', { className: 'zp-error' }, props.error) : null);
    }

    /* ---------------- 命主信息 ---------------- */
    function Summary(props) {
      var c = props.chart;
      var t = props.t;
      var sc = c.meta && c.meta.solarCorrection;
      var kv = function (label, value, wide) {
        return h('div', { className: 'zp-kv' + (wide ? ' zp-kv-wide' : '') },
          h('span', null, label), h('b', null, value));
      };
      return h('div', { className: 'zp-card zp-summary-card', 'data-region': 'SIDE_PROFILE' },
        h('div', { className: 'zp-card-title' }, t('summaryTitle')),
        h('div', { className: 'zp-pillars' },
          [c.pillars.yearly, c.pillars.monthly, c.pillars.daily, c.pillars.hourly].map(function (pz, i) {
            return h('div', { key: i, className: 'zp-pillar' }, pz);
          })),
        h('div', { className: 'zp-kv-grid' },
          kv(t('solarLabel'), c.solarDate + ' ' + c.timeName, true),
          kv(t('lunarLabel'), c.lunar.year + '年' + c.lunarText, true),
          kv(t('solarTime'), sc ? sc.solarTime + '（' + sc.longitude + '°E）' : t('uncorrected')),
          kv(t('soul'), c.soulBranch + ' · ' + c.soulMaster),
          kv(t('body'), c.bodyBranch + ' · ' + c.bodyMaster),
          kv(t('class5'), c.fiveElementsClass),
          kv(t('startAge'), c.startAge + ' 岁'),
          kv(t('zodiac') + ' / ' + t('sign'), c.zodiac + ' · ' + c.sign)),
        sc && sc.boundaryWarning ? h('div', { className: 'zp-warn' }, t('boundaryWarn')) : null,
        h('div', { className: 'zp-detail-section-label', style: { marginTop: 12, marginBottom: 6 } }, t('mutagenTitle')),
        h('div', { className: 'zp-mutagen-strip' },
          c.mutagens.map(function (m, i) {
            return h('span', { key: i, className: 'zp-mu zp-mu-' + MU_CLASS[m.mutagen] },
              m.star + '化' + m.mutagen + ' · ' + m.palaceName);
          })));
    }

    /* ---------------- 命盘库 ---------------- */
    function Library(props) {
      var t = props.t;
      var [name, setName] = useState('');
      return h('div', { className: 'zp-card zp-lib-card', 'data-region': 'SIDE_LIBRARY' },
        h('div', { className: 'zp-card-title' }, t('libTitle')),
        h('div', { className: 'zp-row', style: { marginBottom: 8 } },
          h('input', {
            className: 'zp-input', type: 'text', value: name, maxLength: 20, style: { flex: 1, minWidth: 0 },
            placeholder: t('libName'), 'aria-label': t('libName'),
            onChange: function (ev) { setName(ev.target.value); }
          }),
          h('button', {
            className: 'zp-btn', type: 'button',
            onClick: function () {
              if (props.onSave(name)) setName('');
            }
          }, t('libSave'))),
        props.items.length === 0
          ? h('div', { style: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' } }, t('libEmpty'))
          : props.items.map(function (item) {
            return h('div', {
              key: item.id, className: 'zp-list-item' + (props.current === item.id ? ' on' : ''),
              onClick: function () { props.onLoad(item); }
            },
              h('b', null, item.name),
              h('span', { className: 'zp-list-sub' }, item.input.year + '-' + item.input.month + '-' + item.input.day),
              h('button', {
                className: 'zp-list-del', type: 'button', title: t('libDelete'),
                onClick: function (ev) { ev.stopPropagation(); props.onDelete(item.id); }
              }, '×'));
          }));
    }
    /* ---------------- 命盘宫格 ---------------- */
    /* 索引 → 网格位置 (紫微盘方位: 命宫左上, 顺时针) */
    const CELL_POS = {
      3: { col: 1, row: 1 }, 4: { col: 2, row: 1 }, 5: { col: 3, row: 1 }, 6: { col: 4, row: 1 },
      2: { col: 1, row: 2 }, 7: { col: 4, row: 2 },
      1: { col: 1, row: 3 }, 8: { col: 4, row: 3 },
      0: { col: 1, row: 4 }, 11: { col: 2, row: 4 }, 10: { col: 3, row: 4 }, 9: { col: 4, row: 4 }
    };
    /* 键盘方向 → 目标索引: [左,右,上,下] 各为分支环上移动 */
    function ringStep(idx, dir) {
      if (dir === 'left') return (idx + 11) % 12;
      if (dir === 'right') return (idx + 1) % 12;
      if (dir === 'opp') return (idx + 6) % 12;
      return idx;
    }

    function PalaceCell(props) {
      var p = props.palace;
      var t = props.t;
      var scopeBadges = props.scopeBadges || {};
      var scopeName = props.scope ? props.scope.palaceNames[p.index] : null;
      var scopeStars = props.scope ? props.scope.stars[p.index] : null;
      var gods = [p.changsheng12, p.boshi12].filter(Boolean).join(' · ');
      var pos = CELL_POS[p.index] || { col: 1, row: 1 };
      var empty = !p.major.length;
      return h('div', {
        className: 'zp-cell' + (props.selected ? ' on' : '') + (empty ? ' empty' : ''),
        style: { gridColumn: pos.col, gridRow: pos.row },
        onClick: props.onSelect,
        tabIndex: props.selected ? 0 : -1,
        role: 'button', 'aria-pressed': !!props.selected,
        title: p.name + ' · ' + p.stem + p.branch
      },
        h('div', { className: 'zp-cell-top' },
          h('span', { className: 'zp-cell-name' },
            p.name,
            p.isSoul ? h('span', { className: 'zp-mark zp-mark-soul' }, t('mingMark')) : null,
            p.isBody ? h('span', { className: 'zp-mark zp-mark-body' }, t('bodyMark')) : null),
          h('span', { className: 'zp-cell-gz' }, p.stem + p.branch)),
        h('div', { className: 'zp-stars-line zp-stars-major' },
          p.major.length
            ? p.major.map(function (s) { return StarEl(s, scopeBadges[s.name]); })
            : h('span', { className: 'zp-star-none' }, t('emptyPalace'))),
        p.minor.length ? h('div', { className: 'zp-stars-line zp-stars-minor' },
          p.minor.map(function (s) {
            return StarEl(s, { minorLine: true, badge: scopeBadges[s.name] && scopeBadges[s.name].badge, text: scopeBadges[s.name] && scopeBadges[s.name].text });
          })) : null,
        props.showAdj && p.adjective.length ? h('div', { className: 'zp-adj-line' }, p.adjective.join(' ')) : null,
        scopeName ? h('div', { className: 'zp-cell-scope' }, scopeName) : null,
        scopeStars && scopeStars.length ? h('div', { className: 'zp-stars-line zp-stars-scope' },
          scopeStars.map(function (s) { return StarEl(s, { minorLine: true }); })) : null,
        h('div', { className: 'zp-cell-foot' },
          h('span', { className: 'zp-cell-dec' }, t('decadal') + ' ' + p.decadal.range[0] + '~' + p.decadal.range[1]),
          h('span', { className: 'zp-cell-gods' }, gods)));
    }

    /* 中宫：盘名 + 关键盘面参数，窄盘下按容器宽度等比缩小（字号见 CSS cqw） */
    function CenterCell(props) {
      var c = props.chart;
      var t = props.t;
      return h('div', { className: 'zp-center' },
        h('div', { className: 'zp-taiji-wrap' }, h(Taiji, null)),
        h('div', { className: 'zp-center-name' }, props.name || t('defaultName')),
        h('div', { className: 'zp-center-chips' },
          h('span', { className: 'zp-center-chip' }, t('soul') + ' ' + c.soulBranch),
          h('span', { className: 'zp-center-chip' }, t('body') + ' ' + c.bodyBranch),
          h('span', { className: 'zp-center-chip' }, c.fiveElementsClass),
          h('span', { className: 'zp-center-chip' }, c.zodiac)),
        h('div', { className: 'zp-center-sub' },
          t('soulMaster') + ' ' + c.soulMaster + ' · ' + t('bodyMaster') + ' ' + c.bodyMaster),
        h('div', { className: 'zp-center-dec' }, t('startAge') + ' ' + c.startAge + ' 岁起运'));
    }

    /* ---------------- 宫位详情 ---------------- */
    function PalaceDetail(props) {
      var p = props.palace;
      var t = props.t;
      var opp = (p.index + 6) % 12;
      var tri1 = (p.index + 4) % 12;
      var tri2 = (p.index + 8) % 12;
      var gods = [p.changsheng12, p.boshi12].filter(Boolean);
      var section = function (label, body) {
        return h('div', { className: 'zp-detail-section' },
          h('div', { className: 'zp-detail-section-label' }, label),
          body);
      };
      return h('div', { className: 'zp-detail', 'data-region': 'INSPECTOR' },
        h('div', { className: 'zp-detail-head' },
          h('span', { className: 'zp-detail-name' }, p.name),
          p.isSoul ? h('span', { className: 'zp-mark zp-mark-soul' }, t('mingMark')) : null,
          p.isBody ? h('span', { className: 'zp-mark zp-mark-body' }, t('bodyMark')) : null,
          h('span', { className: 'zp-detail-gz' }, p.stem + p.branch),
          h('div', { className: 'zp-detail-nav' },
            h('button', { className: 'zp-btn', type: 'button', onClick: function () { props.onSelect(opp); } },
              t('oppPalace') + ' · ' + props.chart.palaces[opp].name),
            h('button', { className: 'zp-btn', type: 'button', onClick: function () { props.onSelect(tri1); } },
              t('triPalace') + ' · ' + props.chart.palaces[tri1].name),
            h('button', { className: 'zp-btn', type: 'button', onClick: function () { props.onSelect(tri2); } },
              t('triPalace') + ' · ' + props.chart.palaces[tri2].name))),
        h('div', { className: 'zp-detail-body' },
          section(t('mainStars'),
            h('div', { className: 'zp-detail-stars' }, p.major.length
              ? p.major.map(function (s) { return StarEl(s); })
              : h('span', { className: 'zp-star adj' }, t('emptyPalace')))),
          section(t('minorStars'),
            h('div', { className: 'zp-detail-stars' }, p.minor.length
              ? p.minor.map(function (s) { return StarEl(s, { minorLine: true }); })
              : h('span', { className: 'zp-star adj' }, '—'))),
          p.adjective.length ? section(t('adjStars'),
            h('div', { className: 'zp-detail-stars' },
              p.adjective.map(function (n) { return h('span', { key: n, className: 'zp-star adj' }, n); }))) : null,
          section(t('decadal') + ' · ' + t('smallLimit') + ' · ' + t('twelveGods'),
            h('div', { className: 'zp-detail-chips' },
              h('span', { className: 'zp-chip' }, t('decadal') + ' ', h('b', null, p.decadal.stem + p.decadal.branch + ' ' + p.decadal.range[0] + '~' + p.decadal.range[1] + '岁')),
              h('span', { className: 'zp-chip' }, t('smallLimit') + ' ', h('b', null, p.ages.join(', '))),
              gods.length ? h('span', { className: 'zp-chip' }, t('twelveGods') + ' ', h('b', null, gods.join(' · '))) : null))),
        h('div', { className: 'zp-kbd-hint' }, t('keyboardHint')));
    }

    /* ---------------- 格局分析 / 星曜词典 ---------------- */
    function PatternsView(props) {
      var t = props.t;
      if (!props.patterns.length) {
        return h('div', { className: 'zp-card', style: { textAlign: 'center', padding: 40, color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, t('patternEmpty'));
      }
      return h('div', { className: 'zp-patterns', 'data-region': 'TOOLPAGE' },
        props.patterns.map(function (p, i) {
          return h('div', { key: i, className: 'zp-pattern-card' },
            h('div', { className: 'zp-pattern-name' }, p.name + (p.level ? ' · ' + p.level : '')),
            h('div', { className: 'zp-pattern-desc' }, p.desc),
            p.detail ? h('div', { className: 'zp-pattern-desc', style: { marginTop: 4, color: 'var(--dsw-alias-label-secondary)' } }, p.detail) : null);
        }));
    }

    function DictView(props) {
      var t = props.t;
      var [q, setQ] = useState('');
      var keys = Object.keys(E.starDict);
      var filtered = q.trim()
        ? keys.filter(function (k) { return k.indexOf(q.trim()) >= 0; })
        : keys;
      return h('div', { 'data-region': 'TOOLPAGE' },
        h('div', { className: 'zp-toolbar' },
          h('input', {
            className: 'zp-input', type: 'text', value: q, style: { maxWidth: 260 },
            placeholder: t('dictPlaceholder'), 'aria-label': t('dictTitle'),
            onChange: function (ev) { setQ(ev.target.value); }
          })),
        h('div', { className: 'zp-dict-grid' },
          filtered.map(function (k) {
            var d = E.starDict[k];
            return h('div', { key: k, className: 'zp-dict-item' },
              h('div', { className: 'zp-dict-name', style: starColor(k) ? { color: starColor(k) } : undefined }, k),
              h('div', { className: 'zp-dict-desc' }, (d.wu || '') + (d.yy || '') + (d.qi ? ' · ' + d.qi : '')),
              h('div', { className: 'zp-dict-desc', style: { marginTop: 4 } }, d.brief),
              d.good ? h('div', { className: 'zp-dict-desc', style: { marginTop: 4, opacity: .85 } }, '庙旺: ' + d.good) : null);
          })));
    }

    /* ---------------- 内联图标（1.5px 线性，随文字色；避免 emoji 跨平台不一致） ---------------- */
    const ICON_PATHS = {
      panelLeft: [
        ['rect', { x: 2.2, y: 2.8, width: 11.6, height: 10.4, rx: 2 }],
        ['path', { d: 'M6.6 2.8v10.4' }]
      ],
      back: [
        ['path', { d: 'M13.4 8H3.2' }],
        ['path', { d: 'M7 4.2L3.2 8l3.8 3.8' }]
      ],
      copy: [
        ['rect', { x: 5.6, y: 5.6, width: 7.6, height: 7.6, rx: 1.6 }],
        ['path', { d: 'M10.6 5.6V4.3c0-.9-.7-1.6-1.6-1.6H4.3c-.9 0-1.6.7-1.6 1.6v4.7c0 .9.7 1.6 1.6 1.6h1.3' }]
      ],
      sync: [
        ['path', { d: 'M13.2 6.4a5.2 5.2 0 0 0-9.1-1.7' }],
        ['path', { d: 'M2.8 9.6a5.2 5.2 0 0 0 9.1 1.7' }],
        ['path', { d: 'M13.2 2.9v3.5h-3.5' }],
        ['path', { d: 'M2.8 13.1v-3.5h3.5' }]
      ],
      settings: [
        ['circle', { cx: 8, cy: 8, r: 2.1 }],
        ['path', { d: 'M8 1.9v2.1M8 12v2.1M1.9 8h2.1M12 8h2.1M3.7 3.7L5.2 5.2M10.8 10.8l1.5 1.5M12.3 3.7L10.8 5.2M5.2 10.8l-1.5 1.5' }]
      ],
      close: [
        ['path', { d: 'M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6' }]
      ],
      send: [
        ['path', { d: 'M2.6 8.1L13.2 3l-5.1 10.5L7 9.3z' }]
      ],
      stop: [
        ['rect', { x: 4.8, y: 4.8, width: 6.4, height: 6.4, rx: 1.6, fill: 'currentColor', stroke: 'none' }]
      ],
      sparkle: [
        ['path', { d: 'M8 1.9l1.5 4.2 4.2 1.5-4.2 1.5L8 13.3 6.5 9.1 2.3 7.6l4.2-1.5z' }]
      ],
      preview: [
        ['path', { d: 'M1.9 8s2.3-3.9 6.1-3.9S14.1 8 14.1 8s-2.3 3.9-6.1 3.9S1.9 8 1.9 8z' }],
        ['circle', { cx: 8, cy: 8, r: 1.8 }]
      ],
      export: [
        ['path', { d: 'M8 2.1v7M5.3 6.4L8 9.1l2.7-2.7' }],
        ['path', { d: 'M3.1 10.4v1.7c0 .9.7 1.6 1.6 1.6h6.6c.9 0 1.6-.7 1.6-1.6v-1.7' }]
      ],
      newChat: [
        ['path', { d: 'M8 2.9v10.2M2.9 8h10.2' }]
      ],
      handoff: [
        ['path', { d: 'M2.6 8h7.1M7 5l3.1 3L7 11' }],
        ['path', { d: 'M12.4 3.2v9.6' }]
      ],
      expand: [
        ['path', { d: 'M2.7 6.1V2.7h3.4M9.9 2.7h3.4v3.4M13.3 9.9v3.4H9.9M6.1 13.3H2.7V9.9' }]
      ],
      adj: [
        ['path', { d: 'M8 2.4v11.2M3.1 5.2l9.8 5.6M12.9 5.2L3.1 10.8' }]
      ]
    };

    function Icon(props) {
      var paths = ICON_PATHS[props.name] || [];
      return h('svg', {
        viewBox: '0 0 16 16', width: props.size || 15, height: props.size || 15,
        'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
        strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block', flex: 'none' }
      }, paths.map(function (p, i) {
        return h(p[0], Object.assign({ key: i }, p[1]));
      }));
    }

    /* ---------------- 紫微师对话：面板内右侧阅读抽屉 ---------------- */
    function mdInline(s) {
      /* 极小的 markdown 渲染: 标题 / 加粗 / 引用 / 列表 / 段落。先转义再上标记。 */
      var esc = function (x) {
        return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      };
      var inline = function (x) {
        return esc(x)
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code>$1</code>');
      };
      var out = [];
      String(s || '').split('\n').forEach(function (raw) {
        var line = raw.replace(/\s+$/, '');
        if (!line.trim()) { out.push('<div class="zp-md-gap"></div>'); return; }
        var hm = /^(#{1,4})\s+(.*)$/.exec(line);
        if (hm) { out.push('<div class="zp-md-h zp-md-h' + hm[1].length + '">' + inline(hm[2]) + '</div>'); return; }
        var qm = /^&gt;\s?(.*)$/.exec(line) || /^>\s?(.*)$/.exec(line);
        if (qm) { out.push('<div class="zp-md-quote">' + inline(qm[1]) + '</div>'); return; }
        var lm = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line);
        if (lm) { out.push('<div class="zp-md-li">· ' + inline(lm[2]) + '</div>'); return; }
        out.push('<div class="zp-md-p">' + inline(line) + '</div>');
      });
      return out.join('');
    }

    function AIModal(props) {
      var t = props.t;
      var [mode, setMode] = useState('brief');
      var [q, setQ] = useState('');
      var [showPreview, setShowPreview] = useState(false);
      var bodyRef = useRef(null);
      var boxRef = useDialogFocus();
      useEffect(function () {
        var el = bodyRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, [props.thread, props.streaming]);

      var thread = props.thread || [];
      var lastAssistant = '';
      for (var i = thread.length - 1; i >= 0; i--) {
        if (thread[i].role === 'assistant') { lastAssistant = thread[i].content; break; }
      }
      var submit = function () {
        var question = q.trim();
        setQ('');
        props.onAsk(question, mode);
      };
      var ask = function (question, m) {
        if (m) setMode(m);
        setQ('');
        props.onAsk(question, m || mode);
      };
      var suggestions = [
        ['brief', t('aiSug1')],
        ['brief', t('aiSug2')],
        ['report', t('aiSug3')]
      ];

      return h('div', { className: 'zp-overlay' },
        h('div', { className: 'zp-overlay-mask', onClick: props.onClose, 'aria-hidden': true }),
        h('aside', { className: 'zp-ai', role: 'dialog', 'data-region': 'DRAWER', 'aria-modal': 'true', 'aria-label': t('aiTitle'),
          ref: boxRef, onKeyDown: function (ev) { trapTab(ev, ev.currentTarget); } },
          h('header', { className: 'zp-ai-head' },
            h('div', { className: 'zp-ai-heading' },
              h('span', { className: 'zp-ai-glyph' }, h(Icon, { name: 'sparkle', size: 15 })),
              h('div', { style: { minWidth: 0 } },
                h('div', { className: 'zp-ai-title' }, t('aiTitle')),
                h('div', { className: 'zp-ai-sub' }, t('aiSub')))),
            h('div', { className: 'zp-ai-mode' },
              h(Seg, {
                value: mode,
                options: [{ value: 'brief', label: t('modeBrief') }, { value: 'report', label: t('modeReport') }],
                onChange: function (v) { setMode(v); }
              })),
            thread.length ? h('button', {
              className: 'zp-icon-btn', type: 'button', title: t('aiNewChat'), 'aria-label': t('aiNewChat'),
              disabled: props.streaming, onClick: props.onClear
            }, h(Icon, { name: 'newChat' })) : null,
            h('button', {
              className: 'zp-icon-btn', type: 'button', title: t('close'), 'aria-label': t('close'), onClick: props.onClose
            }, h(Icon, { name: 'close' }))),
          h('div', { className: 'zp-ai-body', ref: bodyRef },
            thread.length === 0
              ? h('div', { className: 'zp-ai-empty' },
                h('div', { className: 'zp-ai-empty-title' }, t('aiTitle')),
                h('div', { className: 'zp-ai-empty-hint' }, t('aiEmptyHint')),
                h('div', { className: 'zp-ai-engine' }, t('aiEngineHint')),
                h('div', { className: 'zp-ai-suggest' },
                  suggestions.map(function (s, i) {
                    return h('button', {
                      key: i, className: 'zp-suggest', type: 'button', disabled: props.streaming,
                      onClick: function () { ask(s[1], s[0]); }
                    }, h(Icon, { name: s[0] === 'report' ? 'handoff' : 'sparkle', size: 13 }), h('span', null, s[1]));
                  })))
              : h('div', { className: 'zp-chat-thread', role: 'log', 'aria-live': 'polite', 'aria-busy': props.streaming ? 'true' : 'false' },
                thread.map(function (m, i) {
                  return h('div', { key: 'm' + i, className: m.role === 'user' ? 'zp-bubble zp-bubble-user' : 'zp-bubble zp-bubble-ai' },
                    m.role === 'user'
                      ? h('div', { className: 'zp-bubble-text' }, m.content)
                      : h('div', { className: 'zp-md', dangerouslySetInnerHTML: { __html: mdInline(m.content) } }));
                }),
                props.streaming
                  ? h('div', { className: 'zp-typing' }, props.thinkChars
                    ? t('aiThinking') + '（' + props.thinkChars + ' 字）'
                    : t('interpStreaming')) : null),
            props.interpError ? h('div', { className: 'zp-ai-error' },
              h('span', { className: 'zp-ai-error-text' }, props.interpError),
              props.interpIssue && props.interpIssue.canContinue
                ? h('button', {
                  className: 'zp-mini-btn', type: 'button', disabled: props.streaming,
                  onClick: function () { props.onContinue(mode); }
                }, t('aiContinue'))
                : null) : null),
          h('footer', { className: 'zp-ai-foot' },
            h('div', { className: 'zp-ai-tools' },
              lastAssistant ? h('button', { className: 'zp-mini-btn', type: 'button', onClick: props.onCopy },
                h(Icon, { name: 'copy', size: 13 }), props.copied ? t('aiCopied') : t('aiCopy')) : null,
              lastAssistant ? h('button', { className: 'zp-mini-btn', type: 'button', onClick: function () { setShowPreview(!showPreview); } },
                h(Icon, { name: 'preview', size: 13 }), showPreview ? t('closePreview') : t('previewHtml')) : null,
              lastAssistant ? h('button', { className: 'zp-mini-btn', type: 'button', onClick: props.onExport },
                h(Icon, { name: 'export', size: 13 }), t('exportHtml')) : null,
              h('button', {
                className: 'zp-mini-btn zp-mini-btn-accent', type: 'button', title: t('handoffHint'),
                onClick: function () { props.onHandoff(mode); }
              }, h(Icon, { name: 'handoff', size: 13 }), props.handoffDone ? t('handoffDone') : t('handoff'))),
            h('div', { className: 'zp-ai-composer' },
              h('textarea', {
                className: 'zp-input zp-chat-ta', rows: 2, value: q,
                placeholder: t('aiAskPh'), 'aria-label': t('aiAskPh'),
                onChange: function (ev) { setQ(ev.target.value); },
                onKeyDown: function (ev) {
                  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); submit(); }
                }
              }),
              props.streaming
                ? h('button', { className: 'zp-send zp-send-stop', type: 'button', title: t('aiStop'), 'aria-label': t('aiStop'), onClick: props.onStop },
                  h(Icon, { name: 'stop', size: 15 }))
                : h('button', { className: 'zp-send', type: 'button', title: thread.length ? t('aiSend') : t('ai'), 'aria-label': t('aiSend'), onClick: submit },
                  h(Icon, { name: 'send', size: 15 }))),
            h('div', { className: 'zp-ai-disclaimer' }, t('disclaimerShort'))),
          showPreview && lastAssistant ? h('div', { className: 'zp-ai-preview', 'data-region': 'PREVIEW' },
            h('div', { className: 'zp-ai-preview-head' },
              h('b', null, t('previewHtml')),
              h('button', { className: 'zp-icon-btn', type: 'button', title: t('closePreview'), 'aria-label': t('closePreview'), onClick: function () { setShowPreview(false); } },
                h(Icon, { name: 'close' }))),
            h('iframe', { className: 'zp-preview-frame zp-preview-frame-full', srcDoc: props.previewHtml, title: t('previewHtml'), sandbox: 'allow-same-origin' })) : null));
    }

    /* ---------------- 设置：面板内居中弹层 ---------------- */
    function SettingsModal(props) {
      var t = props.t;
      var boxRef = useDialogFocus();
      return h('div', { className: 'zp-overlay' },
        h('div', { className: 'zp-overlay-mask', onClick: props.onClose, 'aria-hidden': true }),
        h('div', { className: 'zp-overlay-center' },
          h('div', { className: 'zp-settings', role: 'dialog', 'data-region': 'MODAL', 'aria-modal': 'true', 'aria-label': t('settingsTitle'),
            ref: boxRef, onKeyDown: function (ev) { trapTab(ev, ev.currentTarget); } },
            h('header', { className: 'zp-settings-head' },
              h('div', { className: 'zp-settings-title' }, t('settingsTitle')),
              h('button', {
                className: 'zp-icon-btn', type: 'button', title: t('close'), 'aria-label': t('close'), onClick: props.onClose,
                style: { marginLeft: 'auto' }
              }, h(Icon, { name: 'close' }))),
            h('div', { className: 'zp-settings-body' },
              h('label', { className: 'zp-check' },
                h('input', { type: 'checkbox', checked: props.autoOpen, onChange: function (ev) { props.setAutoOpen(ev.target.checked); } }),
                h('span', null, t('autoOpen'))),
              h('label', { className: 'zp-check' },
                h('input', { type: 'checkbox', checked: props.showAdj, onChange: function (ev) { props.setShowAdj(ev.target.checked); } }),
                h('span', null, t('showAdjSet'))),
              h('div', { className: 'zp-settings-about' },
                h('b', null, t('about')),
                h('span', null, t('aboutText')))))));
    }

    /* ---------------- 主应用 ---------------- */
    function ProApp(props) {
      var t = props.t;
      var actions = props.actions;

      /* 表单与命盘 */
      var [form, setFormRaw] = useState(function () {
        var init = Object.assign({}, DEFAULT_FORM);
        try {
          var saved = JSON.parse(localStorage.getItem('ziwei-pro.form') || 'null');
          if (saved && typeof saved === 'object') {
            Object.keys(init).forEach(function (k) { if (saved[k] !== undefined) init[k] = saved[k]; });
            if (saved.settings && typeof saved.settings === 'object') init.settings = Object.assign({}, init.settings, saved.settings);
          }
        } catch (e) { /* ignore */ }
        return init;
      });
      var setForm = function (patch) {
        setFormRaw(function (prev) {
          var next = Object.assign({}, prev, patch);
          try { localStorage.setItem('ziwei-pro.form', JSON.stringify(next)); } catch (e) { /* ignore */ }
          return next;
        });
      };
      var [chart, setChart] = useState(null);
      var [error, setError] = useState('');
      var [selected, setSelected] = useState(-1);
      var [tab, setTab] = useState('natal');
      var [selDecadal, setSelDecadal] = useState(0);
      /* v3：默认停在「当前大限」，而不是第 0 段（3–12 岁）——旧默认会让用户打开大限页就看到童年。 */
      var currentDecadeIndex = function (chartObj) {
        if (!chartObj || !chartObj.lunar) return 0;
        var age = new Date().getFullYear() - chartObj.lunar.year + 1;
        var list = [];
        try { list = E.decadalList(chartObj) || []; } catch (e) { list = []; }
        for (var i = 0; i < list.length; i++) {
          if (age >= list[i].ageRange[0] && age <= list[i].ageRange[1]) return i;
        }
        return 0;
      };
      var [yearlyYear, setYearlyYear] = useState(String(new Date().getFullYear()));

      /* 布局：面板实测宽度（0 = 尚未测量，按窄面板安全兜底）、专注看盘、生辰输入折叠 */
      var [panelW, setPanelW] = useState(0);
      var [focus, setFocus] = useState(function () {
        try { return localStorage.getItem('ziwei-pro.focus') === '1'; } catch (e) { return false; }
      });
      var [formCollapsed, setFormCollapsed] = useState(false);
      /* v3：左栏可收起（窄屏出盘后自动收起，给盘面让宽）；view 区分「盘面」与工具视图 */
      var [railOpen, setRailOpenState] = useState(function () {
        try { return localStorage.getItem('ziwei-pro.rail') !== '0'; } catch (e) { return true; }
      });
      var setRail = function (v) {
        setRailOpenState(!!v);
        try { localStorage.setItem('ziwei-pro.rail', v ? '1' : '0'); } catch (e) { /* ignore */ }
      };
      var [view, setView] = useState('chart');

      /* 命盘库 */
      var [library, setLibrary] = useState(function () {
        try { return JSON.parse(localStorage.getItem('ziwei-pro.library') || '[]'); } catch (e) { return []; }
      });
      var [currentLibId, setCurrentLibId] = useState(null);

      /* 偏好。旧版曾在 localStorage 明文保存 DeepSeek API Key（已无消费方），
         这里启动时清掉残留，避免升级后继续把密钥留在浏览器里。 */
      useEffect(function () {
        try { localStorage.removeItem('ziwei-workbench.apikey'); } catch (e) { /* ignore */ }
      }, []);
      var [autoOpen, setAutoOpenState] = useState(function () {
        try { return localStorage.getItem('ziwei-pro.autopen') === '1'; } catch (e) { return false; }
      });
      var setAutoOpen = function (v) {
        setAutoOpenState(v);
        try { localStorage.setItem('ziwei-pro.autopen', v ? '1' : '0'); } catch (e) { /* ignore */ }
      };
      var [showAdj, setShowAdjState] = useState(function () {
        try { return localStorage.getItem('ziwei-pro.showadj') === '1'; } catch (e) { return false; }
      });
      var setShowAdj = function (v) {
        setShowAdjState(v);
        try { localStorage.setItem('ziwei-pro.showadj', v ? '1' : '0'); } catch (e) { /* ignore */ }
      };

      /* AI 状态 */
      var [modal, setModal] = useState(null);
      var [interpreting, setInterpreting] = useState(false);
      var [thread, setThread] = useState([]);
      var [interpError, setInterpError] = useState('');
      var [interpIssue, setInterpIssue] = useState(null);   /* {kind, canContinue}: 截断/断连/超时的结构化原因 */
      var [thinkChars, setThinkChars] = useState(0);        /* 思考阶段已产出的字数（来自 start/thinking 事件） */
      var [interpCopied, setInterpCopied] = useState(false);
      var [handoffDone, setHandoffDone] = useState(false);
      var [synced, setSynced] = useState(false);

      /* 面板宽度监听：布局切换与盘面缩放都靠它，避免用 viewport media query 误判面板宽度 */
      var rootRef = useRef(null);
      useEffect(function () {
        var el = rootRef.current;
        if (!el) return undefined;
        var apply = function (w) {
          if (!w || w <= 0) return;
          setPanelW(function (prev) {
            var next = Math.round(w);
            return Math.abs(prev - next) >= 6 ? next : prev;
          });
        };
        var boxWidth = function () { return el.getBoundingClientRect().width; };
        apply(boxWidth());
        if (typeof ResizeObserver === 'function') {
          var ro = new ResizeObserver(function () { apply(boxWidth()); });
          ro.observe(el);
          return function () { ro.disconnect(); };
        }
        var onWinResize = function () { apply(boxWidth()); };
        window.addEventListener('resize', onWinResize);
        return function () { window.removeEventListener('resize', onWinResize); };
      }, []);
      var toggleFocus = function () {
        setFocus(function (prev) {
          var next = !prev;
          try { localStorage.setItem('ziwei-pro.focus', next ? '1' : '0'); } catch (e) { /* ignore */ }
          return next;
        });
      };

      /* 浮层（抽屉 / 设置）是 .zp-root 内的绝对定位层：只在工作台范围内出现，
         不按视口坐标算位置，也不受祖先 transform / 侧栏变化影响；打开时锁住背景滚动。 */
      var openModal = function (name) { setModal(name); };
      var closeModal = function () { setModal(null); };
      useEffect(function () {
        if (!modal) return undefined;
        var onEsc = function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); setModal(null); } };
        window.addEventListener('keydown', onEsc);
        return function () { window.removeEventListener('keydown', onEsc); };
      }, [modal]);

      /* 计算 */
      var compute = function () {
        setError('');
        var result = E.computeChart({
          calendar: form.calendar,
          year: +form.year, month: +form.month, day: +form.day,
          isLeapMonth: !!form.isLeap,
          hour: +form.hour, minute: +form.minute,
          gender: form.gender,
          longitude: (form.longitude === '' || form.longitude === null || form.longitude === undefined) ? undefined : +form.longitude,
          settings: form.settings
        });
        if (result.error) { setError(result.error); return; }
        setChart(result);
        setSelected(result.soulIndex);
        setSelDecadal(currentDecadeIndex(result.chart));
        setYearlyYear(String(new Date().getFullYear()));
        setTab('natal');
        setView('chart');
        /* 出盘后收起生辰表单，把纵向空间让给盘面；点「改生辰」再展开 */
        setFormCollapsed(true);
        if (panelW > 0 && panelW < 908) setRail(false);
      };

      /* 大限/流年/格局 */
      var decadalList = useMemo(function () { return chart ? E.decadalList(chart) : []; }, [chart]);
      var yearlyChart = useMemo(function () {
        if (!chart) return null;
        var y = parseInt(yearlyYear, 10);
        if (isNaN(y)) return { error: '年份无效' };
        return E.yearlyForYear(chart, y);
      }, [chart, yearlyYear]);
      var patterns = useMemo(function () { return chart ? E.detectPatterns(chart) : []; }, [chart]);

      var scope = null, scopeBadges = {};
      if (chart && tab === 'decadal' && decadalList[selDecadal]) {
        var d = decadalList[selDecadal];
        scope = {
          label: '大限 ' + d.ageRange[0] + '~' + d.ageRange[1] + '岁 ' + d.stem + d.branch + '（' + d.palaceName + '）',
          palaceNames: d.palaceNames,
          stars: d.stars
        };
        d.mutagen.forEach(function (star, mi) {
          scopeBadges[star] = { text: '限' + MU_CHARS[mi], badge: MU_CHARS[mi] };
        });
      } else if (chart && tab === 'yearly' && yearlyChart && !yearlyChart.error) {
        var y = yearlyChart.yearly;
        scope = {
          label: '流年 ' + y.stem + y.branch + ' · 小限 ' + yearlyChart.nominalAge + '岁',
          palaceNames: y.palaceNames,
          stars: y.stars
        };
      }

      /* 键盘导航：只在舞台（盘面）内部获得焦点时接管方向键，避免全局劫持页面滚动/其他输入区 */
      var onStageKeyDown = function (ev) {
        if (!chart || modal) return;
        var target = ev.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'left'); }); }
        else if (ev.key === 'ArrowRight') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'right'); }); }
        else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'opp'); }); }
      };

      /* 命盘库操作 */
      var saveChart = function (name) {
        if (!chart || !name || !String(name).trim()) return false;
        var entry = {
          id: 'lib-' + Date.now(),
          name: name.trim(),
          input: {
            name: form.name, calendar: form.calendar, year: form.year, month: form.month, day: form.day,
            isLeap: form.isLeap, hour: form.hour, minute: form.minute, gender: form.gender,
            longitude: form.longitude, place: form.place, occupation: form.occupation,
            settings: form.settings
          }
        };
        var next = [entry].concat(library).slice(0, 60);
        setLibrary(next);
        setCurrentLibId(entry.id);
        try { localStorage.setItem('ziwei-pro.library', JSON.stringify(next)); } catch (e) { /* ignore */ }
        return true;
      };
      var loadSaved = function (item) {
        setFormRaw(Object.assign({}, DEFAULT_FORM, item.input, {
          settings: Object.assign({}, DEFAULT_FORM.settings, item.input.settings || {})
        }));
        var result = E.computeChart(Object.assign({}, item.input, {
          hour: +item.input.hour, minute: +item.input.minute,
          isLeapMonth: !!item.input.isLeap,
          longitude: (item.input.longitude === '' || item.input.longitude === null || item.input.longitude === undefined) ? undefined : +item.input.longitude
        }));
        if (result.error) { setError(result.error); return; }
        setChart(result);
        setSelected(result.soulIndex);
        setSelDecadal(currentDecadeIndex(result.chart));
        setYearlyYear(String(new Date().getFullYear()));
        setTab('natal');
        setView('chart');
        setCurrentLibId(item.id);
        setError('');
        setFormCollapsed(true);
      };
      var deleteSaved = function (id) {
        var next = library.filter(function (x) { return x.id !== id; });
        setLibrary(next);
        try { localStorage.setItem('ziwei-pro.library', JSON.stringify(next)); } catch (e) { /* ignore */ }
      };

      /* AI 解读 */
      var reportMeta = function () {
        return {
          chart: chart, name: form.name, place: form.place, occupation: form.occupation,
          gender: form.gender === 'female' ? 'female' : 'male'
        };
      };
      /* 当前时间定位（虚岁/公历年）：面板问答与同步/交接共用同一份上下文。
         问「这 10 年大运」却答成命格总纲，根因之一是旧 payload 只发 E.chartText(chart)，
         既没有十二大限表，也没有“现在处于哪一段”。 */
      var nowPosition = function () {
        var cy = new Date().getFullYear();
        var birthYear = (chart && chart.lunar && chart.lunar.year) ? chart.lunar.year : (+form.year || 0);
        return { currentYear: cy, currentAge: birthYear ? (cy - birthYear + 1) : 0 };
      };
      var chartContextText = function () {
        if (!chart) return '';
        var pos = nowPosition();
        try {
          if (window.ZWCore && typeof window.ZWCore.fullChartText === 'function') {
            return window.ZWCore.fullChartText(chart, pos);
          }
        } catch (e) { /* 回退原生文本 */ }
        return E.chartText(chart);
      };

      /* 面板内「直接聊」: 走 Harness host 的 SSE 通道, 用会话已配置的模型, 不需要另配 API Key */
      var chatAbortRef = useRef(null);
      var stopReqRef = useRef(false);
      var runInterpretation = function (question, mode) {
        if (!chart || interpreting) return;
        var history = thread.map(function (m) { return { role: m.role, content: m.content }; });
        var asked = (question || '').trim();
        var nextThread = thread.concat(asked ? [{ role: 'user', content: asked }] : []);
        setThread(nextThread);
        setInterpreting(true);
        setInterpError('');
        setInterpIssue(null);
        setThinkChars(0);
        setHandoffDone(false);
        stopReqRef.current = false;

        var pos = nowPosition();
        var selectedDecade = (tab === 'decadal' && decadalList[selDecadal]) ? decadalList[selDecadal].ageRange : null;
        var body = {
          chartText: chartContextText(),
          mode: mode === 'report' ? 'report' : 'brief',
          question: asked,
          history: history,
          meta: {
            name: form.name, place: form.place, occupation: form.occupation,
            gender: form.gender === 'female' ? 'female' : 'male',
            currentAge: pos.currentAge, currentYear: pos.currentYear,
            decadalFocus: selectedDecade,
            yearlyFocus: (tab === 'yearly') ? (parseInt(yearlyYear, 10) || pos.currentYear) : null
          }
        };

        var controller = null;
        try { controller = new AbortController(); chatAbortRef.current = controller; } catch (e) { controller = null; }

        /* done / error / EOF 三种收尾分开记：只有真的收到 done 才算写完。
           旧实现把「读完流」一律当成功——服务端截断、连接中途断掉，都会显示成「写完了」。 */
        var settled = false;
        var gotDone = false;
        var gotError = false;
        var produced = '';
        var finish = function (errMsg, issue) {
          if (settled) return;
          settled = true;
          setInterpreting(false);
          setThinkChars(0);
          chatAbortRef.current = null;
          setInterpError(errMsg || '');
          setInterpIssue(issue || null);
        };
        var replaceLastAssistant = function (text) {
          setThread(function (prev) {
            if (!prev.length) return prev;
            var copy = prev.slice();
            var last = copy[copy.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            copy[copy.length - 1] = { role: 'assistant', content: text };
            return copy;
          });
        };

        fetch('/ziwei/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller ? controller.signal : undefined
        }).then(function (resp) {
          if (!resp.ok) {
            return resp.text().then(function (txt) {
              var reason = 'HTTP ' + resp.status;
              try { var j = JSON.parse(txt); if (j && j.reason) reason = j.reason; } catch (e) { /* 非 JSON */ }
              finish(reason);
            }).catch(function () { finish('HTTP ' + resp.status); });
          }
          if (!resp.body || typeof resp.body.getReader !== 'function') {
            finish('浏览器不支持流式响应');
            return undefined;
          }
          setThread(function (prev) { return prev.concat([{ role: 'assistant', content: '' }]); });
          var reader = resp.body.getReader();
          var decoder = new TextDecoder();
          var buf = '';
          var append = function (delta) {
            produced += delta;
            setThread(function (prev) {
              if (!prev.length) return prev;
              var copy = prev.slice();
              var last = copy[copy.length - 1];
              if (!last || last.role !== 'assistant') copy.push({ role: 'assistant', content: delta });
              else copy[copy.length - 1] = { role: 'assistant', content: (last.content || '') + delta };
              return copy;
            });
          };
          var pump = function () {
            return reader.read().then(function (chunk) {
              if (chunk.done) {
                if (!gotDone && !gotError) {
                  finish(t('aiDisconnected'), { kind: 'stream-closed', canContinue: !!produced.trim() });
                }
                return;
              }
              buf += decoder.decode(chunk.value, { stream: true });
              var parts = buf.split('\n\n');
              buf = parts.pop();
              parts.forEach(function (block) {
                var ev = 'message', data = '';
                block.split('\n').forEach(function (line) {
                  if (line.indexOf('event: ') === 0) ev = line.slice(7).trim();
                  else if (line.indexOf('data: ') === 0) data += line.slice(6);
                });
                if (!data) return;
                var payload = null;
                try { payload = JSON.parse(data); } catch (e) { return; }
                if (ev === 'start') { setThinkChars(0); }
                else if (ev === 'thinking') { setThinkChars((payload && payload.chars) || 0); }
                else if (ev === 'delta' && payload && payload.text) { setThinkChars(0); append(payload.text); }
                else if (ev === 'done') {
                  gotDone = true;
                  /* done 带全文：以它为准，避免个别 delta 丢帧导致正文缺字 */
                  if (payload && typeof payload.text === 'string' && payload.text) replaceLastAssistant(payload.text);
                  finish('');
                } else if (ev === 'error') {
                  gotError = true;
                  finish((payload && payload.reason) || '解读失败', payload);
                }
              });
              return pump();
            });
          };
          return pump();
        }).catch(function (e) {
          if (e && e.name === 'AbortError') {
            if (stopReqRef.current) finish(t('aiStopped'), { kind: 'stopped', canContinue: !!produced.trim() });
            else finish('');
            return;
          }
          finish(String((e && e.message) || e), { kind: 'error', canContinue: !!produced.trim() });
        });
      };
      /* 面板内「停止」：保留已生成部分，并允许接着写 */
      var stopInterpretation = function () {
        if (!chatAbortRef.current) return;
        stopReqRef.current = true;
        try { chatAbortRef.current.abort(); } catch (e) { /* ignore */ }
      };
      /* 「同步给会话」: 只把当前命盘写进 host 上下文, 不新建会话。
         之后在**任意**已有会话里说「读取工作台命盘并写鲲鹏报告」即可 —— 
         agent 会用 ziwei_context 工具读到这张盘。 */
      var syncToSession = function () {
        if (!chart) return;
        setInterpError('');
        fetch('/ziwei/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chartText: E.chartText(chart),
            fullText: chartContextText(),
            name: form.name || '', place: form.place || '', occupation: form.occupation || '',
            gender: form.gender === 'female' ? 'female' : 'male'
          })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.ok) { setSynced(true); setTimeout(function () { setSynced(false); }, 2200); }
          else setInterpError((j && j.reason) || '同步失败');
        }).catch(function (e) { setInterpError(String((e && e.message) || e)); });
      };

      /* 「交给会话」: host 新建一个 GUI 可见会话, 把命盘作为首条消息灌进去 */
      var lastAnswer = function () {
        for (var i = thread.length - 1; i >= 0; i--) if (thread[i].role === 'assistant') return thread[i].content || '';
        return '';
      };
      var handoffToSession = function (mode) {
        if (!chart || interpreting) return;
        setInterpError('');
        setHandoffDone(false);
        setInterpreting(true);
        var payload = {
          chartText: E.chartText(chart),
          fullText: chartContextText(),
          name: form.name || '',
          place: form.place || '',
          occupation: form.occupation || '',
          gender: form.gender === 'female' ? 'female' : 'male',
          interpretation: lastAnswer(),
          mode: mode === 'report' ? 'report' : 'brief'
        };
        fetch('/ziwei/handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
          .then(function (out) {
            setInterpreting(false);
            var j = out.j || {};
            if (j.ok && j.sessionId) {
              setHandoffDone(true);
              setTimeout(function () { setHandoffDone(false); }, 3000);
              /* 新会话可能还没同步进客户端目录, openSession 会失败。
                 失败就重试几次; 始终失败则如实告知去看侧栏, 不假装跳过去了。 */
              var tries = 0;
              var openIt = function () {
                tries += 1;
                if (actions.openSession(j.sessionId)) return;
                if (tries < 6) { setTimeout(openIt, 350 * tries); return; }
                setInterpError('会话已创建，但界面没能自动跳过去——请在左侧会话列表里打开新会话继续。');
              };
              openIt();
            } else {
              setInterpError(j.reason || ('交给会话失败 (HTTP ' + out.status + ')'));
            }
          })
          .catch(function (e) { setInterpreting(false); setInterpError(String((e && e.message) || e)); });
      };
      var clearThread = function () {
        setThread([]);
        setInterpError('');
        setInterpIssue(null);
        setThinkChars(0);
      };
      /* 最近一轮回答: 复制 / 导出 / 预览都以它为准 */
      var interpretation = useMemo(function () {
        for (var i = thread.length - 1; i >= 0; i--) if (thread[i].role === 'assistant') return thread[i].content || '';
        return '';
      }, [thread]);
      var copyInterpretation = function () {
        if (!interpretation) return;
        setInterpCopied(true);
        setTimeout(function () { setInterpCopied(false); }, 1600);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(interpretation).catch(function () { /* ignore */ });
          }
        } catch (e) { /* ignore */ }
      };
      var exportReportHtml = function () {
        if (!interpretation) return;
        try {
          var html = actions.buildReportHtml(reportMeta(), interpretation);
          var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          var now = new Date();
          var ymd = now.getFullYear() + ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2);
          a.href = url;
          a.download = '人生鲲鹏计划_' + (form.name || '命主') + '_' + ymd + '.html';
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
        } catch (e) {
          setInterpError('导出失败: ' + String((e && e.message) || e));
        }
      };
      var previewHtml = useMemo(function () {
        if (!chart || !interpretation) return '';
        try { return actions.buildReportHtml(reportMeta(), interpretation); } catch (e) { return ''; }
      }, [chart, interpretation, form]);

      /* 复制命盘 */
      var [copied, setCopied] = useState(false);
      var copyChart = function () {
        if (!chart) return;
        setCopied(true);
        setTimeout(function () { setCopied(false); }, 1600);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(E.chartText(chart)).catch(function () { /* ignore */ });
          }
        } catch (e) { /* ignore */ }
      };

      /* 启动自动打开 (设置可关) */
      useEffect(function () {
        if (!autoOpen) return;
        var timer = setTimeout(function () { actions.autoOpenPanel(); }, 250);
        return function () { clearTimeout(timer); };
      }, []);

      /* 渲染（v3 布局：AppBar / TimeBar / ContextRail / ChartStage / BottomBar） */
      var palaceSelected = chart && selected >= 0 ? chart.palaces[selected] : null;
      /* 面板实测宽度 → 三档布局：看的是面板自身宽度，不是视口宽度（media query 会把盘面挤扁） */
      /* 四档：compact 档专治「DSH 侧栏展开 -> 面板 ~900-1070 -> 旧逻辑掉进单列、中栏被拉满」。 */
      var layoutMode = panelW <= 0 ? 'narrow'
        : (panelW >= 1394 ? 'wide'
        : (panelW >= 1072 ? 'mid'
        : (panelW >= 908 ? 'compact' : 'narrow')));
      var modeDefs = [['natal', t('tabNatal')], ['decadal', t('tabDecadal')], ['yearly', t('tabYearly')]];
      var curAgeForDecade = nowPosition().currentAge;
      var currentDecadalIdx = -1;
      if (chart) {
        for (var ci = 0; ci < decadalList.length; ci++) {
          if (curAgeForDecade >= decadalList[ci].ageRange[0] && curAgeForDecade <= decadalList[ci].ageRange[1]) { currentDecadalIdx = ci; break; }
        }
      }
      var openAI = function () { if (!chart) return; if (modal === 'ai') closeModal(); else openModal('ai'); };
      var editBirth = function () {
        setRail(true);
        setFormCollapsed(false);
        try {
          var sc = rootRef.current && rootRef.current.querySelector('.zp-scroll');
          if (sc) { if (sc.scrollTo) sc.scrollTo({ top: 0, behavior: 'smooth' }); else sc.scrollTop = 0; }
        } catch (e) { /* ignore */ }
      };
      var stepDecade = function (delta) {
        if (!decadalList.length) return;
        var next = selDecadal + delta;
        if (next < 0 || next > decadalList.length - 1) return;
        setSelDecadal(next);
      };
      var yearNum = function () { var n = parseInt(yearlyYear, 10); return isNaN(n) ? new Date().getFullYear() : n; };
      var stepYear = function (delta) {
        var next = yearNum() + delta;
        if (next < 1900 || next > 2100) return;
        setYearlyYear(String(next));
      };
      var timeNav = null;
      if (chart && view === 'chart' && tab === 'decadal' && decadalList.length) {
        timeNav = h('div', { className: 'zp-time-nav', role: 'group', 'aria-label': t('tabDecadal') },
          h('button', { className: 'zp-time-btn', type: 'button', title: t('prevDecade'), 'aria-label': t('prevDecade'), disabled: selDecadal <= 0, onClick: function () { stepDecade(-1); } }, '‹'),
          h('select', {
            className: 'zp-time-select', value: String(selDecadal), 'aria-label': t('tabDecadal'),
            onChange: function (ev) { setSelDecadal(parseInt(ev.target.value, 10) || 0); }
          }, decadalList.map(function (d, i) {
            return h('option', { key: i, value: String(i) }, d.ageRange[0] + '–' + d.ageRange[1] + ' 岁 · ' + d.stem + d.branch + ' · ' + d.palaceName);
          })),
          h('button', { className: 'zp-time-btn', type: 'button', title: t('nextDecade'), 'aria-label': t('nextDecade'), disabled: selDecadal >= decadalList.length - 1, onClick: function () { stepDecade(1); } }, '›'),
          currentDecadalIdx >= 0 && selDecadal !== currentDecadalIdx
            ? h('button', { className: 'zp-time-now', type: 'button', title: t('backToCurrent'), onClick: function () { setSelDecadal(currentDecadalIdx); } }, t('backToCurrent'))
            : (currentDecadalIdx >= 0 ? h('span', { className: 'zp-time-chip' }, t('currentBadge')) : null));
      } else if (chart && view === 'chart' && tab === 'yearly') {
        timeNav = h('div', { className: 'zp-time-nav', role: 'group', 'aria-label': t('tabYearly') },
          h('button', { className: 'zp-time-btn', type: 'button', title: t('prevYear'), 'aria-label': t('prevYear'), onClick: function () { stepYear(-1); } }, '‹'),
          h('input', {
            className: 'zp-time-input', type: 'number', min: 1900, max: 2100, value: yearlyYear,
            'aria-label': t('yearlyYear'),
            onChange: function (ev) { setYearlyYear(ev.target.value); }
          }),
          h('button', { className: 'zp-time-btn', type: 'button', title: t('nextYear'), 'aria-label': t('nextYear'), onClick: function () { stepYear(1); } }, '›'),
          String(yearNum()) === String(new Date().getFullYear())
            ? h('span', { className: 'zp-time-chip' }, t('currentBadge'))
            : h('button', { className: 'zp-time-now', type: 'button', title: t('thisYear'), onClick: function () { setYearlyYear(String(new Date().getFullYear())); } }, t('thisYear')));
      }
      var timebar = chart ? h('div', { className: 'zp-timebar', 'data-region': 'TIMEBAR' },
        view === 'chart'
          ? h('div', { className: 'zp-tabs', role: 'tablist', 'aria-label': t('timeScope') },
            modeDefs.map(function (md) {
              return h('button', {
                key: md[0], type: 'button', role: 'tab', 'aria-selected': tab === md[0],
                className: tab === md[0] ? 'on' : undefined,
                onClick: function () { setTab(md[0]); }
              }, md[1]);
            }))
          : h('div', { className: 'zp-toolview-head', style: { marginBottom: 0 } },
            h('button', { className: 'zp-icon-btn', type: 'button', title: t('backToBoard'), 'aria-label': t('backToBoard'), onClick: function () { setView('chart'); } }, h(Icon, { name: 'back' })),
            h('span', { className: 'zp-toolview-title' }, view === 'patterns' ? t('openPatterns') : t('openDict'))),
        view === 'chart' ? timeNav : null,
        h('div', { className: 'zp-timebar-right' },
          view === 'chart' ? h('button', { className: 'zp-tool-btn', type: 'button', title: t('openPatterns'), onClick: function () { setView('patterns'); } }, t('openPatterns')) : null,
          view === 'chart' ? h('button', { className: 'zp-tool-btn', type: 'button', title: t('openDict'), onClick: function () { setView('dict'); } }, t('openDict')) : null,
          view === 'chart' ? h('button', {
            className: 'zp-toggle' + (showAdj ? ' on' : ''), type: 'button', 'aria-pressed': !!showAdj,
            title: showAdj ? t('hideAdj') : t('showAdj'), onClick: function () { setShowAdj(!showAdj); }
          }, h(Icon, { name: 'adj', size: 12 }), t('adjChip')) : null,
          view === 'chart' ? h('button', {
            className: 'zp-toggle' + (focus ? ' on' : ''), type: 'button', 'aria-pressed': !!focus,
            title: focus ? t('focusOff') : t('focusOn'), onClick: toggleFocus
          }, h(Icon, { name: 'expand', size: 12 }), focus ? t('focusOff') : t('focusOn')) : null)) : null;

      /* 没盘时左栏必须始终可见（否则用户只剩空态、没有输入入口）；有盘才允许收起。 */
      var railVisible = !chart || railOpen;
      return h('div', {
        className: 'zp-root',
        ref: rootRef,
        'data-w': layoutMode,
        'data-chart': chart ? '1' : undefined,
        'data-rail': railVisible ? 'open' : 'closed',
        /* 没有盘时不能进专注态：否则左栏（生辰输入）被隐藏且没有退出按钮 */
        'data-focus': (focus && chart) ? '1' : undefined
      },
        h('div', { className: 'zp-scroll' + (modal ? ' zp-scroll-locked' : '') },
          h('div', { className: 'zp-inner' },
          h('div', { className: 'zp-head', 'data-region': 'HEAD' },
            /* 显式出口: 返回会话（不依赖侧栏，layout 服务缺失时不渲染） */
            actions.canReturnToConversation ? h('button', {
              className: 'zp-icon-btn zp-exit', type: 'button',
              title: t('backToConversation'), 'aria-label': t('backToConversation'),
              onClick: function () { actions.returnToConversation(); }
            }, h(Icon, { name: 'back' }), h('span', { className: 'zp-btn-label' }, t('backToConversation'))) : null,
            actions.canReturnToConversation ? h('span', { className: 'zp-head-sep' }) : null,
            /* 左栏开关：桌面/中档常驻，窄屏用底部「生辰」按钮 */
            chart && layoutMode !== 'narrow' ? h('button', {
              className: 'zp-icon-btn zp-rail-toggle', type: 'button',
              title: railVisible ? t('collapseRail') : t('expandRail'),
              'aria-label': railVisible ? t('collapseRail') : t('expandRail'),
              'aria-expanded': railVisible ? 'true' : 'false',
              'aria-controls': 'zp-rail',
              onClick: function () { setRail(!railVisible); }
            }, h(Icon, { name: 'panelLeft' })) : null,
            h('div', { className: 'zp-brand' },
              h('span', { className: 'zp-brand-name' }, t('brand')),
              h('span', { className: 'zp-brand-pro' }, t('brandPro'))),
            /* 窄屏头部只留图标，补一个紧凑命主摘要，避免头部空荡 */
            chart && layoutMode === 'narrow' ? h('span', {
              className: 'zp-sum-chip zp-head-mini',
              title: (form.name || t('defaultName')) + ' · ' + chart.fiveElementsClass
            }, (form.name || t('defaultName')) + ' · ' + chart.fiveElementsClass) : null,
            h('span', { className: 'zp-brand-tag' }, t('tagline')),
            chart ? h('div', { className: 'zp-head-sum' },
              h('span', { className: 'zp-sum-chip' }, h('b', null, form.name || t('defaultName'))),
              h('span', { className: 'zp-sum-chip zp-sum-gz' },
                [chart.pillars.yearly, chart.pillars.monthly, chart.pillars.daily, chart.pillars.hourly].join(' ')),
              h('span', { className: 'zp-sum-chip zp-sum-class' }, chart.fiveElementsClass)) : null,
            h('div', { className: 'zp-head-actions' },
              chart ? h('button', {
                className: 'zp-icon-btn', type: 'button', title: t('copy'), 'aria-label': t('copy'), onClick: copyChart
              }, h(Icon, { name: 'copy' }), h('span', { className: 'zp-btn-label' }, copied ? t('copied') : t('copy'))) : null,
              chart ? h('button', {
                className: 'zp-icon-btn', type: 'button', title: t('syncHint'), 'aria-label': t('sync'), onClick: syncToSession
              }, h(Icon, { name: 'sync' }), h('span', { className: 'zp-btn-label' }, synced ? t('synced') : t('sync'))) : null,
              chart ? h('span', { className: 'zp-head-sep' }) : null,
              h('button', {
                className: 'zp-btn zp-btn-primary zp-btn-ai', type: 'button', disabled: !chart,
                'aria-pressed': modal === 'ai' ? 'true' : 'false',
                onClick: openAI
              }, h(Icon, { name: 'sparkle', size: 14 }), h('span', null, t('ai'))),
              h('button', {
                className: 'zp-icon-btn', type: 'button', title: t('settingsTitle'), 'aria-label': t('settingsTitle'),
                'aria-pressed': modal === 'settings' ? 'true' : 'false',
                onClick: function () { if (modal === 'settings') closeModal(); else openModal('settings'); }
              }, h(Icon, { name: 'settings' })))),
          h('div', { className: 'zp-body' },
            h('div', { className: 'zp-side', id: 'zp-rail' },
              h(InputForm, {
                form: form, setForm: setForm, t: t, onCompute: compute, error: error, hasChart: !!chart,
                collapsed: formCollapsed,
                onToggleCollapse: function () { setFormCollapsed(!formCollapsed); }
              }),
              chart ? h(Summary, { chart: chart, t: t }) : null,
              h(Library, { items: library, current: currentLibId, t: t, onSave: saveChart, onLoad: loadSaved, onDelete: deleteSaved })),
            h('div', { className: 'zp-stage', tabIndex: chart ? 0 : -1, onKeyDown: onStageKeyDown },
              timebar,
              !chart ? h('div', { className: 'zp-empty', 'data-region': 'EMPTY' },
                h('div', { className: 'zp-empty-taiji' }, h(Taiji, null)),
                h('div', { className: 'zp-empty-title' }, t('brand') + ' ' + t('brandPro')),
                h('div', { className: 'zp-empty-hint' }, t('emptyState')),
                h('button', { className: 'zp-btn', type: 'button', onClick: compute }, t('emptyCta'))) : null,
              chart && view === 'chart' && tab === 'yearly' && yearlyChart && yearlyChart.error
                ? h('div', { className: 'zp-error', style: { marginBottom: 12 } }, yearlyChart.error)
                : null,
              chart && view === 'chart' && !(tab === 'yearly' && yearlyChart && yearlyChart.error) ? h('div', null,
                h('div', { className: 'zp-board-wrap' + (palaceSelected && tab === 'natal' ? ' has-detail' : ''), 'data-region': 'BOARD' },
                  h('div', { className: 'zp-board' },
                    h('div', { className: 'zp-grid' },
                      [3, 4, 5, 6, 2, 7, 1, 8, 0, 11, 10, 9].map(function (idx) {
                        return h(PalaceCell, {
                          key: idx,
                          palace: Object.assign({}, chart.palaces[idx], { isSoul: idx === chart.soulIndex }),
                          chart: chart,
                          selected: selected === idx,
                          onSelect: function () { setSelected(idx); },
                          t: t,
                          showAdj: showAdj,
                          scope: scope,
                          scopeBadges: scopeBadges
                        });
                      }),
                      h(CenterCell, { chart: chart, t: t, name: form.name }))),
                  palaceSelected && tab === 'natal' ? h(PalaceDetail, {
                    chart: chart,
                    palace: Object.assign({}, palaceSelected, { isSoul: selected === chart.soulIndex }),
                    t: t,
                    onSelect: setSelected
                  }) : null),
                palaceSelected && tab === 'decadal' ? h('div', { className: 'zp-kbd-hint' }, t('keyboardHint')) : null) : null,
              chart && view === 'patterns' ? h(PatternsView, { patterns: patterns, t: t }) : null,
              chart && view === 'dict' ? h(DictView, { t: t }) : null)),
          chart ? h('div', { className: 'zp-bottombar', 'data-region': 'BOTTOMBAR' },
            h('button', { className: 'zp-btn', type: 'button', onClick: editBirth },
              h(Icon, { name: 'panelLeft', size: 14 }), h('span', null, t('editBirthShort'))),
            h('button', { className: 'zp-btn zp-btn-primary', type: 'button', onClick: openAI },
              h(Icon, { name: 'sparkle', size: 14 }), h('span', null, t('ai')))) : null
          )),
        modal === 'ai' && chart ? h(AIModal, {
            t: t,
            thread: thread,
            streaming: interpreting,
            interpError: interpError,
            interpIssue: interpIssue,
            thinkChars: thinkChars,
            onContinue: function (mode) { runInterpretation(t('aiContinuePrompt'), mode); },
            onStop: stopInterpretation,
            copied: interpCopied,
            previewHtml: previewHtml,
            handoffDone: handoffDone,
            onClose: closeModal,
            onAsk: runInterpretation,
            onClear: clearThread,
            onHandoff: handoffToSession,
            onCopy: copyInterpretation,
            onExport: exportReportHtml
          }) : null,
          modal === 'settings' ? h(SettingsModal, {
            t: t,
            autoOpen: autoOpen, setAutoOpen: setAutoOpen,
            showAdj: showAdj, setShowAdj: setShowAdj,
            onClose: closeModal
          }) : null);
    }

    /* ---------------- 默认表单 ---------------- */
    const DEFAULT_FORM = {
      name: '', calendar: 'solar', year: 1990, month: 6, day: 15,
      isLeap: false, hour: 15, minute: 30, gender: 'male',
      longitude: '', place: '', occupation: '',
      /* dayDivide 默认 current（按当日），与紫微师/独立版 iztro runner 一致 */
      settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
    };

    /* ---------------- 错误边界 ---------------- */
    class Boundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) {
        return { error: error };
      }
      render() {
        if (this.state.error) {
          var err = this.state.error;
          return h('div', { className: 'zp-card', style: { margin: 16 } },
            h('div', { className: 'zp-error' }, '界面渲染异常：' + String((err && err.message) || err)),
            h('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginTop: 8 } }, '请把这行错误信息发给开发者。'),
            h('button', { className: 'zp-btn', type: 'button', style: { marginTop: 10 }, onClick: () => this.setState({ error: null }) }, '重试'));
        }
        return this.props.children;
      }
    }

    /* ---------------- 挂载 ---------------- */
    return {
      inject: ['slots', 'sessions', 'uiWorkspace'],
      apply(ctx) {
        /* 普通 client bundle 没有 `styles` 内建（dynamic runner 才有），统一用 <style> 注入；
           注册在 ctx.effect 里，插件卸载时移除（官方模板同样把样式作为插件拥有的资源）。 */
        var disposeStyle = function () { };
        {
          var el = document.createElement('style');
          el.textContent = CSS;
          document.head.appendChild(el);
          disposeStyle = function () { if (el && el.parentNode) el.parentNode.removeChild(el); };
        }

        var layout = null;
        try { layout = ctx.get && ctx.get('layout'); } catch (e) { layout = null; }
        /* 客户端导航: 让 GUI 选中新会话（服务不可用时静默降级） */
        var openSession = function (sessionId) {
          if (!sessionId) return false;
          try {
            var svc = ctx.get && ctx.get('uiWorkspace');
            if (svc && typeof svc.openSession === 'function') { svc.openSession(sessionId); return true; }
          } catch (e) { /* 降级 */ }
          return false;
        };

        var autoOpenPanel = function () {
          try {
            if (layout && typeof layout.selectPanel === 'function') layout.selectPanel('ziwei');
          } catch (e) { /* ignore */ }
        };

        /* 面板显式出口: 返回会话。
         * 官方语义见 @deepseek-ai/dsh-client-ui-layout README:
         *   ctx.layout.selectPanel(id) 选中已注册的主面板；
         *   selectPanel(null) 选中 Conversation 且不切换当前 Session。
         * 布局服务缺失（例如纯 Web 预览）时不渲染该按钮，面板其余功能不受影响。 */
        var canReturnToConversation = !!(layout && typeof layout.selectPanel === 'function');
        var returnToConversation = function () {
          if (!canReturnToConversation) return false;
          try { layout.selectPanel(null); return true; } catch (e) { /* 降级: 保持当前面板 */ }
          return false;
        };

        /* 语言：按官方规范走 Client locale 服务。
         * - register(namespace, { zh, en }) 把本插件的双语字典登记进宿主；
         * - bind(namespace) 返回随当前语言即时切换的 t()；
         * - 服务缺失（旧宿主 / 非 Web 组合）时退回内置 zh 字典，面板仍可用。 */
        var t = function (k) { return DICT['zh-CN'][k] !== undefined ? DICT['zh-CN'][k] : k; };
        try {
          var locale = ctx.get && ctx.get('locale');
          if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
            var disposeLocale = locale.register('ziwei', { zh: DICT['zh-CN'], en: DICT['en-US'] });
            if (typeof disposeLocale === 'function' && typeof ctx.effect === 'function') {
              ctx.effect(function () { return disposeLocale; }, 'ziwei-workbench: locale dictionaries');
            }
            t = locale.bind('ziwei');
          }
        } catch (e) { /* 回退内置字典 */ }


        /* ---- 鲲鹏精装报告 HTML ---- */
        var REPORT_CSS = ":root{--bg:#FAF6EF;--bg-card:#F4EFE5;--text:#2A2A2A;--text-sub:#666;--accent:#7C5C3C;--accent-lt:#9C6B47;--accent-dim:#C4A882;--border:#E8DDC8;--warn:#B85A3D;--white:#FEFCF8;--font-serif:\"Songti SC\",\"STSong\",\"Source Han Serif CN\",\"Noto Serif CJK SC\",Georgia,serif;--font-sans:\"PingFang SC\",\"Hiragino Sans GB\",\"Microsoft YaHei\",system-ui,sans-serif}@page{size:A4;margin:18mm 22mm}body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-serif);font-size:11pt;line-height:1.9}.page-wrap{max-width:210mm;margin:0 auto;padding:14mm 16mm}h1,h2,h3{font-family:var(--font-sans);color:var(--accent);font-weight:600}h2{font-size:15pt;border-bottom:1px solid var(--accent-dim);padding-bottom:.3em;margin-top:2em}h3{font-size:12.5pt;margin-top:1.4em}.body-text{text-indent:2em;text-align:justify}.quote-block{margin:1em 0;padding:.6em 1em;border-left:3px solid var(--accent-dim);background:var(--bg-card);color:var(--text-sub)}.highlight-box{margin:1em 0;padding:.8em 1em;background:var(--bg-card);border-left:4px solid var(--accent)}.warn-block{margin:1em 0;padding:.8em 1em;border:1px solid var(--warn);border-left:4px solid var(--warn);color:#7A3A24}.kw{display:inline-block;padding:0 .45em;margin:0 .1em;background:var(--accent);color:var(--white);font-size:.82em;border-radius:2px;font-family:var(--font-sans)}.palace-card{margin:.8em 0;padding:.8em 1em;background:var(--white);border:1px solid var(--border);border-radius:4px}.p-palace-name{font-family:var(--font-sans);color:var(--accent);font-weight:600}.p-stars{margin:.2em 0;color:var(--accent-lt)}.p-note{font-size:.85em;color:var(--text-sub)}.info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.6em;margin:1em 0}.info-cell{background:var(--white);border:1px solid var(--border);padding:.5em .7em;font-size:.95em}.info-cell span{display:block;color:var(--text-sub);font-size:.8em;font-family:var(--font-sans)}.pc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:var(--accent-dim);border:2px solid var(--accent);margin:1.5em 0}.pc-cell{background:var(--white);padding:.5em;min-height:4.2em;font-size:.9em}.pc-center{grid-column:2/4;grid-row:2/4;background:var(--bg-card);padding:1em;text-align:center;font-size:.95em}.p-ganzhi{color:var(--text-sub);font-size:.8em}.p-sihua{display:inline-block;font-size:.75em;color:var(--warn);border:1px solid var(--warn);padding:0 .3em;border-radius:50%;margin-left:.25em}.path-steps{display:flex;gap:.8em;margin:1em 0}.path-step{flex:1;background:var(--white);border:1px solid var(--accent-dim);border-top:3px solid var(--accent);padding:.7em;font-size:.9em}.cover{background:var(--accent);color:var(--white);text-align:center;padding:52mm 0 12mm;margin:-14mm -16mm 10mm}.p-center-title{font-family:var(--font-sans);font-size:34pt;letter-spacing:.35em;text-indent:.35em}.p-center-sub{margin-top:1.2em;color:var(--accent-dim);letter-spacing:.2em}.cover-band{margin-top:20mm;font-size:10pt;color:var(--bg-card)}.disclaimer{margin-top:2em;padding:.8em 1em;background:#EEE9DE;color:var(--text-sub);font-size:.9em}.colophon{margin-top:3em;text-align:center;color:var(--text-sub);font-size:.85em}.seal{display:inline-block;border:2px solid var(--warn);color:var(--warn);padding:.3em .5em;font-family:var(--font-sans);letter-spacing:.15em;transform:rotate(-4deg)}";
        var escHtml = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        var mdToHtml = function (md) {
          var lines = String(md || '').split('\n');
          var out = [];
          var inList = null;
          var flush = function () { if (inList) { out.push('</' + inList + '>'); inList = null; } };
          var inline = function (t) {
            return escHtml(t)
              .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
              .replace(/`([^`]+)`/g, '<code>$1</code>');
          };
          for (var i = 0; i < lines.length; i++) {
            var trimmed = lines[i].trim();
            if (!trimmed) { flush(); continue; }
            var h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
            if (h) { flush(); var lv = h[1].length; out.push('<h' + (lv + 1) + '>' + inline(h[2]) + '</h' + (lv + 1) + '>'); continue; }
            var q = /^>\s?(.*)$/.exec(trimmed);
            if (q) { flush(); out.push('<blockquote class="quote-block">' + inline(q[1]) + '</blockquote>'); continue; }
            var li = /^[-*•]\s+(.*)$/.exec(trimmed);
            if (li) { if (inList !== 'ul') { flush(); out.push('<ul>'); inList = 'ul'; } out.push('<li>' + inline(li[1]) + '</li>'); continue; }
            var num = /^\d+[.、]\s+(.*)$/.exec(trimmed);
            if (num) { if (inList !== 'ol') { flush(); out.push('<ol>'); inList = 'ol'; } out.push('<li>' + inline(num[1]) + '</li>'); continue; }
            flush();
            out.push('<p class="body-text">' + inline(trimmed) + '</p>');
          }
          flush();
          return out.join('\n');
        };
        var buildReportHtml = function (meta, reportText) {
          var c = meta.chart;
          var today = new Date();
          var ymd = today.getFullYear() + ('0' + (today.getMonth() + 1)).slice(-2) + ('0' + today.getDate()).slice(-2);
          var name = meta.name || '命主';
          /* 阳/阴由年干决定（甲丙戊庚壬为阳），只看性别会有一半标错 */
          var yearStem = (c.pillars && c.pillars.yearly) ? String(c.pillars.yearly).charAt(0) : '甲';
          var yang = '甲丙戊庚壬'.indexOf(yearStem) >= 0;
          var genderCn = (yang ? '阳' : '阴') + (meta.gender === 'female' ? '女' : '男');
          /* 自动排布按行流填坑：中宫固定占 2/4 行列，其余必须按环序给出，
             否则 9/12 个宫会落到错误位置（旧顺序 2,1,0,11,10,9,7,8 就是错的） */
          var order = [3, 4, 5, 6, 'center', 2, 7, 1, 8, 0, 11, 10, 9];
          var sihua = { '禄': '禄', '权': '权', '科': '科', '忌': '忌' };
          var cellsHtml = order.map(function (o) {
            if (o === 'center') {
              return '<div class="pc-center"><div style="font-weight:600">' + escHtml(name) + '</div>' +
                '<div style="margin-top:.4em">' + escHtml(c.fiveElementsClass + ' · ' + c.zodiac) + '</div>' +
                '<div>命主 ' + escHtml(c.soulMaster) + ' · 身主 ' + escHtml(c.bodyMaster) + '</div>' +
                '<div>起运 ' + c.startAge + ' 岁</div></div>';
            }
            var p = c.palaces[o];
            var stars = p.major.map(function (st) {
              return escHtml(st.name + (st.brightness ? '(' + st.brightness + ')' : '')) +
                (st.mutagen ? '<span class="p-sihua">' + sihua[st.mutagen] + '</span>' : '');
            }).join(' ');
            return '<div class="pc-cell"><div class="p-palace-name">' + escHtml(p.name) + (p.isBody ? '·身' : '') + '</div>' +
              '<div class="p-ganzhi">' + escHtml(p.stem + p.branch) + '</div>' +
              '<div class="p-stars">' + stars + '</div></div>';
          }).join('');
          var solarLine = c.meta && c.meta.solarCorrection
            ? c.solarDate + ' ' + c.meta.solarCorrection.solarTime + '（真太阳时，经度 ' + c.meta.solarCorrection.longitude + '°E）'
            : c.solarDate + '（未做真太阳时校正）';
          return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>人生鲲鹏计划 · ' + escHtml(name) + '</title><style>' + REPORT_CSS + '</style></head><body><div class="page-wrap">' +
            '<div class="cover"><div class="p-center-title">人生鲲鹏计划</div>' +
            '<div class="p-center-sub">LifeView · 人生画板 · 紫微人生规划报告</div>' +
            '<div class="cover-band">' + escHtml(c.fiveElementsClass + ' · ' + c.zodiac + '年生 · 报告日期 ' + today.getFullYear() + ' 年 ' + (today.getMonth() + 1) + ' 月') + '</div></div>' +
            '<div class="info-grid">' +
            '<div class="info-cell"><span>称呼</span>' + escHtml(name) + '</div>' +
            '<div class="info-cell"><span>阳历</span>' + escHtml(solarLine) + '</div>' +
            '<div class="info-cell"><span>农历</span>' + escHtml(c.lunar.year + '年' + c.lunarText + ' ' + c.timeName) + '</div>' +
            '<div class="info-cell"><span>五行局</span>' + escHtml(c.fiveElementsClass) + '</div>' +
            '<div class="info-cell"><span>性别</span>' + genderCn + '</div>' +
            '<div class="info-cell"><span>籍贯</span>' + escHtml(meta.place || '未提供') + '</div>' +
            '<div class="info-cell"><span>职业</span>' + escHtml(meta.occupation || '未提供') + '</div>' +
            '<div class="info-cell"><span>命宫/身宫</span>' + escHtml(c.soulBranch + ' / ' + c.bodyBranch) + '</div></div>' +
            '<div class="pc-grid">' + cellsHtml + '</div>' +
            mdToHtml(reportText) +
            '<div class="disclaimer">本报告基于中华传统文化（紫微斗数）体系生成，非现代科学结论，仅供参考，不构成医疗 / 法律 / 金融 / 婚姻等专业领域的决策依据。</div>' +
            '<div class="colophon"><span class="seal">LifeView</span><div style="margin-top:.6em">紫微师 · 人生画板 · ' + ymd + '</div></div>' +
            '</div></body></html>';
        };

        /* 侧栏入口 (id 即主面板 key) */
        var PanelIcon = function () {
          return h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': true },
            h('circle', { cx: 12, cy: 12, r: 10.2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, opacity: 0.55 }),
            h('circle', { cx: 12, cy: 12, r: 4.6, fill: '#8b5cf6' }),
            h('path', { d: 'M12 6.6 L13.6 10.4 L17.4 12 L13.6 13.6 L12 17.4 L10.4 13.6 L6.6 12 L10.4 10.4 Z', fill: '#fff' }),
            h('circle', { cx: 17.8, cy: 6.2, r: 1.1, fill: 'currentColor', opacity: 0.8 }));
        };
        ctx.slots.inject('sidebar.panellist', function () {
          return ctx.slots.register({
            name: 'sidebar.panellist',
            id: 'ziwei',
            order: 20,
            label: function () { return t('brand') + ' ' + t('brandPro'); }
          }, PanelIcon);
        });

        ctx.slots.inject('main', function () {
          return ctx.slots.register({
            name: 'main',
            key: 'ziwei'
          }, function () {
            return h(Boundary, null, h(ProApp, {
              t: t,
              actions: {
                buildReportHtml: buildReportHtml,
                openSession: openSession,
                autoOpenPanel: autoOpenPanel,
                returnToConversation: returnToConversation,
                canReturnToConversation: canReturnToConversation
              }
            }));
          });
        });

        ctx.effect(function () { return disposeStyle; }, 'ziwei-workbench: styles');
      }
    };
  }
});
