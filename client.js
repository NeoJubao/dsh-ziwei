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
    /* 构建时由 build.mjs 注入 package.json 的版本号；未构建的源码里保留占位符。 */
    const APP_VERSION = "1.5.2";

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
        ai: '紫微师解读', aiTitle: '紫微师解读',

        /* ---- v4 工作台 ---- */
        navHome: '首页', navChart: '命盘', navReading: '解读', navReport: '报告',
        navLabel: '工作台导航', navNeedChart: '先新建一张命盘',
        homeEyebrow: '紫微斗数 · 人生规划工作台',
        homeTitleA: '把一张命盘，', homeTitleB: '读成一条人生路线。',
        homeStatSavedBare: '张已保存', homeStatRecentBare: '张最近看过',
        homeStatLast: '上次：{name} · {time}',
        homeNew: '新建命盘', homeSample: '示例命盘',
        homeRecentTitle: '我的命盘', homeRecentMeta: '最近看过的盘会自动出现在这里',
        homeCardNew: '新建一张', homeEmptyTitle: '还没有命盘',
        homeEmptyHint: '新建一张，排盘后会自动出现在这里。',
        homeSavedTag: '已保存', homeRecentTag: '最近', homeRemove: '移除记录',
        createTitle: '新建命盘', createSub: '填写出生信息，排盘后进入命盘阅读。',
        createSubmit: '排盘并查看', createSample: '用示例生辰',
        createWhat: '你会得到', createAsideTitle: '排盘与隐私',
        createWhat1: '确定性命盘、四化与大限',
        createWhat2: '格局分析：一眼看懂盘面结构',
        createWhat3: '紫微师解读：带上下文直接聊',
        createWhat4: '完整鲲鹏报告：14 个部分',
        createWhat5: '精装 HTML：可离线阅读、打印',
        createSubmitEdit: '重新排盘',
        chartInterpret: '解读这张盘', chartEdit: '改生辰',
        chartSave: '保存命盘', chartSaved: '已保存', chartUnsave: '取消保存',
        readingTitle: '紫微师解读', readingGreeting: '先把这张盘读懂。',
        readingLead: '命盘已经带入。可以直接问一个问题，也可以先出一份速览解读。',
        readingSug1: '重点讲事业与财运', readingSug2: '这十年大限要注意什么',
        readingSug3: '我的性格与优势', readingSug4: '写完整鲲鹏报告', readingSug4Meta: '完整报告',
        readingAskPh: '问事业、财运、大限…', readingHint: 'Enter 发送 · Shift+Enter 换行',
        readingTabChat: '对话', readingTabDock: '报告', readingCtxIn: '命盘已带入',
        dockEyebrow: '完整鲲鹏报告', dockTitle: '报告工位', dockMeta: '生成后可预览、全屏阅读、导出 HTML',
        dockIdleTitle: '把这张盘读成一份完整报告。',
        dockIdleLead: '14 个部分：命盘总览、性格大略、家庭、婚姻、子女、财富、健康、朋友、事业、居所、福德、迁移、大限、综合建议。约 2–3 分钟。',
        reportGenerate: '生成完整报告', reportGenerating: '正在撰写完整报告…',
        reportChars: '{n} 字', reportSections: '{n} / 14 部分',
        reportStop: '停止', reportContinue: '继续生成', reportRetry: '重试', reportRegenerate: '重新生成',
        reportRead: '全屏阅读', reportExport: '导出 HTML', reportCopy: '复制全文', reportCopied: '已复制',
        reportReady: '报告已完成', reportFailed: '报告生成中断', reportEmpty: '还没有生成报告',
        reportHint: '报告会保留在本页；导出 HTML 后可离线阅读、打印或转发。',
        reportHintFoot: '完成后可全屏阅读、导出 HTML', reportName: '人生鲲鹏计划 · 完整报告',
        reportPart1: '命盘总览', reportPart2: '性格大略', reportPart3: '家庭关系', reportPart4: '婚姻情感',
        reportPart5: '子女培育', reportPart6: '财富管理', reportPart7: '健康养生', reportPart8: '朋友贵人',
        reportPart9: '事业发展', reportPart10: '居家风水', reportPart11: '心灵福德', reportPart12: '出行迁移',
        reportPart13: '大限节奏', reportPart14: '综合建议',
        readerBack: '返回解读', readerFull: '全屏', readerExitFull: '退出全屏',
        relJustNow: '刚刚', relMin: '{n} 分钟前', relHour: '{n} 小时前', relYesterday: '昨天', relDays: '{n} 天前',
        aiSend: '发送', aiNewChat: '新对话', aiAskPh: '追问命盘，Enter 发送',
        aiStartBrief: '速览解读', aiStartReport: '完整鲲鹏报告',
        aiFullReport: '完整报告', aiFullReportHint: '基于当前命盘生成完整鲲鹏报告（14 部分）',
        aiEmptyHint: '命盘已带入。直接提问，或先看一份解读。',
        timeScope: '命盘时间维度', backToBoard: '返回盘面',
        prevDecade: '上一个大限', nextDecade: '下一个大限', backToCurrent: '回到当前',
        currentBadge: '当前', thisYear: '今年', prevYear: '上一年', nextYear: '下一年',
        collapseRail: '收起生辰栏', expandRail: '展开生辰栏', editBirthShort: '生辰',
        chartTools: '工具', openPatterns: '格局分析', openDict: '星曜词典',
        handoff: '新会话解读', handoffDone: '已开新会话 ✓',
        handoffHint: '把当前命盘交给会话；之后在对话里说「继续聊这个盘」或「写鲲鹏报告」即可',
        disclaimerShort: '传统文化解读，非科学结论，仅供参考。具体决策请咨询专业人士。',
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
        versionLabel: '版本', checkUpdate: '检查更新', checking: '检查中…',
        updateHint: '仅点击时检查一次，不后台联网；更新需你自己执行命令。',
        upToDate: '已是最新（{version}）', updateAvailable: '发现新版本 {latest}；更新：',
        updateFailed: '检查失败：{reason}',
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
        ai: 'Reading', aiTitle: 'Zi Wei Reading',

        /* ---- v4 workbench ---- */
        navHome: 'Home', navChart: 'Chart', navReading: 'Reading', navReport: 'Report',
        navLabel: 'Workbench navigation', navNeedChart: 'Create a chart first',
        homeEyebrow: 'Zi Wei Dou Shu · Life planning desk',
        homeTitleA: 'Turn one chart ', homeTitleB: 'into a life route.',
        homeStatSavedBare: 'saved', homeStatRecentBare: 'recently viewed',
        homeStatLast: 'Last: {name} · {time}',
        homeNew: 'New chart', homeSample: 'Sample chart',
        homeRecentTitle: 'My charts', homeRecentMeta: 'Charts you open show up here',
        homeCardNew: 'Create one', homeEmptyTitle: 'No charts yet',
        homeEmptyHint: 'Create one and it will appear here.',
        homeSavedTag: 'Saved', homeRecentTag: 'Recent', homeRemove: 'Remove',
        createTitle: 'New chart', createSub: 'Enter the birth data, then read the chart.',
        createSubmit: 'Draw chart', createSample: 'Use sample',
        createWhat: 'What you get', createAsideTitle: 'Charting & privacy',
        createWhat1: 'Deterministic chart, transforms and decades',
        createWhat2: 'Pattern analysis of the chart structure',
        createWhat3: 'Zi Wei reading with chart context',
        createWhat4: 'Full Kunpeng report in 14 parts',
        createWhat5: 'Self-contained HTML for offline reading',
        createSubmitEdit: 'Redraw chart',
        chartInterpret: 'Read this chart', chartEdit: 'Edit birth data',
        chartSave: 'Save chart', chartSaved: 'Saved', chartUnsave: 'Remove from saved',
        readingTitle: 'Zi Wei reading', readingGreeting: 'Start with this chart.',
        readingLead: 'The chart is attached. Ask a question, or start with a quick reading.',
        readingSug1: 'Career and money', readingSug2: 'What to watch in this decade',
        readingSug3: 'Strengths and blind spots', readingSug4: 'Write the full Kunpeng report', readingSug4Meta: 'Full report',
        readingAskPh: 'Ask about career, money, decades…', readingHint: 'Enter to send · Shift+Enter for newline',
        readingTabChat: 'Chat', readingTabDock: 'Report', readingCtxIn: 'Chart attached',
        dockEyebrow: 'Full Kunpeng report', dockTitle: 'Report desk', dockMeta: 'Preview, read full screen and export HTML',
        dockIdleTitle: 'Turn this chart into a full report.',
        dockIdleLead: '14 parts: overview, personality, family, marriage, children, wealth, health, friends, career, home, spirit, travel, decades, advice. Takes 2–3 minutes.',
        reportGenerate: 'Generate full report', reportGenerating: 'Drafting the full report…',
        reportChars: '{n} chars', reportSections: '{n} / 14 parts',
        reportStop: 'Stop', reportContinue: 'Continue', reportRetry: 'Retry', reportRegenerate: 'Regenerate',
        reportRead: 'Read full screen', reportExport: 'Export HTML', reportCopy: 'Copy all', reportCopied: 'Copied',
        reportReady: 'Report ready', reportFailed: 'Report interrupted', reportEmpty: 'No report yet',
        reportHint: 'The report stays on this page. Export HTML to read, print or share offline.',
        reportHintFoot: 'Then read full screen or export HTML', reportName: 'Life Kunpeng Report',
        reportPart1: 'Chart overview', reportPart2: 'Personality', reportPart3: 'Family', reportPart4: 'Marriage',
        reportPart5: 'Children', reportPart6: 'Wealth', reportPart7: 'Health', reportPart8: 'Friends',
        reportPart9: 'Career', reportPart10: 'Home', reportPart11: 'Spirit', reportPart12: 'Travel',
        reportPart13: 'Decades', reportPart14: 'Advice',
        readerBack: 'Back to reading', readerFull: 'Fullscreen', readerExitFull: 'Exit fullscreen',
        relJustNow: 'just now', relMin: '{n} min ago', relHour: '{n} h ago', relYesterday: 'yesterday', relDays: '{n} d ago',
        aiSend: 'Send', aiNewChat: 'New chat', aiAskPh: 'Follow-up — Enter to send',
        aiStartBrief: 'Quick reading', aiStartReport: 'Full Kunpeng report',
        aiFullReport: 'Full report', aiFullReportHint: 'Generate the full 14-part Kunpeng report for this chart',
        aiEmptyHint: 'Chart attached. Ask away, or start with a reading.',
        timeScope: 'Time scope', backToBoard: 'Back to chart',
        prevDecade: 'Previous decade', nextDecade: 'Next decade', backToCurrent: 'Back to current',
        currentBadge: 'Current', thisYear: 'This year', prevYear: 'Previous year', nextYear: 'Next year',
        collapseRail: 'Collapse birth panel', expandRail: 'Expand birth panel', editBirthShort: 'Birth data',
        chartTools: 'Tools', openPatterns: 'Patterns', openDict: 'Star dictionary',
        handoff: 'New session', handoffDone: 'Session opened ✓',
        handoffHint: 'Hand this chart to the session so the agent can continue the reading.',
        disclaimerShort: 'Traditional interpretation, not a scientific conclusion. Consult a professional for decisions.',
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
        versionLabel: 'Version', checkUpdate: 'Check for updates', checking: 'Checking…',
        updateHint: 'Manual check only — no background polling; updates are installed by you.',
        upToDate: 'Up to date ({version})', updateAvailable: 'Version {latest} available. Update with:',
        updateFailed: 'Check failed: {reason}',
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
    /* 设计系统样式在 src/ui.css；由 build.mjs 注入，避免 900 行 CSS 埋在 JS 里。 */
    const CSS = `/* ================================================================
 * 紫微斗数工作台 · 设计系统 v4
 *
 * 信息架构：首页 / 新建 / 命盘 / 解读 / 报告（五页）+ 设置浮层
 * 视觉语言：参考自媒体工作台（MIT）——玻璃拟态顶栏、轻量大标题、
 *           浮起卡片与胶囊动作；颜色全部走宿主 --dsw-alias-* 语义 token。
 * 响应式：按面板实测宽 data-w 三档（narrow < 880 ≤ mid < 1100 ≤ wide）。
 * ================================================================ */
.zp-root {
  /* 内容色（命理数据专用，允许固定值；明暗两套见文件末尾） */
  --zp-gold: #c9a35c;
  --zp-gold-dim: #8a7550;
  --zp-mu-lu: #15803d;
  --zp-mu-quan: #1d4ed8;
  --zp-mu-ke: #a16207;
  --zp-mu-ji: #b91c1c;
  --zp-good: #15803d;
  --zp-bad: #b91c1c;

  /* 旧组件仍引用 --zp-accent*：指向宿主品牌 token，不再自带紫色 */
  --zp-accent: var(--dsw-alias-brand-primary);
  --zp-accent-deep: var(--dsw-alias-button-primary-hover);
  --zp-fill-accent: var(--dsw-alias-button-primary-fill);
  --zp-fill-accent-deep: var(--dsw-alias-button-primary-hover);

  /* 设计系统别名 */
  --ink: var(--dsw-alias-label-primary);
  --ink-2: var(--dsw-alias-label-secondary);
  --ink-3: var(--dsw-alias-label-tertiary);
  --ink-4: var(--dsw-alias-label-caption);
  --on-primary: var(--dsw-alias-label-primary-inverted);
  --primary: var(--dsw-alias-button-primary-fill);
  --primary-hover: var(--dsw-alias-button-primary-hover);
  --line: var(--dsw-alias-border-l1);
  --line-strong: var(--dsw-alias-border-l2);
  --hover: var(--dsw-alias-interactive-bg-hover);
  --active: var(--dsw-alias-interactive-bg-active);
  --bg: var(--dsw-alias-bg-base);
  --card: var(--dsw-alias-bg-layer-2);
  --card-solid: var(--dsw-alias-bg-layer-1);
  --glass: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 70%, transparent);
  --canvas: color-mix(in srgb, var(--ink) 3.5%, var(--bg));
  --elev-soft: var(--dsw-elevation-soft);
  --elev-pop: var(--dsw-elevation-prominent);
  --r-sm: var(--dsw-radius-sm, 8px);
  --r-md: var(--dsw-radius-md, 12px);
  --r-lg: var(--dsw-radius-lg, 16px);
  --r-xl: var(--dsw-radius-xl, 20px);
  --r-panel: var(--dsw-radius-panel, 28px);
  --font: var(--dsh-font-family-text-default, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", sans-serif);
  --font-serif: "Songti SC", "STSong", "Source Han Serif SC", "Noto Serif SC", Georgia, serif;
  --ease: cubic-bezier(.2, .8, .2, 1);
  --zp-board-max: 720px;
  --chat-w: 380px;

  position: relative;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font);
  font-size: 14px;
  line-height: 22px;
  -webkit-font-smoothing: antialiased;
  scrollbar-width: thin;
  isolation: isolate;
}
.zp-root *,
.zp-root *::before,
.zp-root *::after { box-sizing: border-box; }
.zp-root h1, .zp-root h2, .zp-root h3, .zp-root h4,
.zp-root p, .zp-root ul, .zp-root ol, .zp-root dl, .zp-root dd { margin: 0; padding: 0; }
.zp-root ul, .zp-root ol { list-style: none; }
.zp-root button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; }
.zp-root button:disabled { cursor: default; }
.zp-root :is(input, textarea, select) { font: inherit; color: inherit; }
.zp-root :focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.zp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

/* 背景氛围：极淡的两团光斑，不抢内容 */
.zp-ambient { position: absolute; inset: 0; overflow: clip; pointer-events: none; z-index: 0; }
.zp-ambient i { position: absolute; width: 52vmax; height: 52vmax; border-radius: 50%; filter: blur(80px); opacity: .5; }
.zp-ambient i:nth-child(1) {
  left: -20vmax; top: -26vmax;
  background: radial-gradient(circle, color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent), transparent 68%);
}
.zp-ambient i:nth-child(2) {
  right: -18vmax; bottom: -30vmax;
  background: radial-gradient(circle, color-mix(in srgb, var(--zp-gold) 8%, transparent), transparent 68%);
}

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
  background: color-mix(in srgb, var(--card-solid) 88%, var(--primary) 12%);
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--primary) 55%, transparent);
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
/* ---------------- 格局 / 词典 / 空态 ---------------- */
.zp-patterns { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px }
/* 左栏「格局摘要」：命主信息下面的只读结论（完整页仍在 PatternsView） */
.zp-patterns-card { margin-top: 12px }
.zp-patterns-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px }
.zp-patterns-count { font-size: 11px; color: var(--dsw-alias-label-tertiary) }
.zp-patterns-all { margin-left: auto }
.zp-pattern-mini { display: flex; flex-direction: column; gap: 2px; padding: 6px 0; border-top: 1px dashed var(--dsw-alias-border-l1) }
.zp-pattern-mini:first-of-type { border-top: none; padding-top: 0 }
.zp-pattern-mini-head { display: flex; align-items: baseline; gap: 6px; font-size: 12px; font-weight: 700; color: var(--dsw-alias-brand-primary) }
.zp-pattern-mini-level { font-size: 10.5px; font-weight: 600; color: var(--dsw-alias-label-tertiary) }
.zp-pattern-mini-desc { font-size: 11px; line-height: 1.55; color: var(--dsw-alias-label-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden }
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

/* ================================================================
 * 通用组件（v4 覆盖层：放在旧组件块之后，同名类以这里为准）
 * ================================================================ */
.zp-btn {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; padding: 0 12px; border-radius: var(--r-md);
  border: 1px solid var(--line-strong); background: var(--card-solid); color: var(--ink);
  font-family: inherit; font-size: 13px; line-height: 20px; white-space: nowrap; cursor: pointer;
  transition: background .15s, border-color .15s, transform .2s var(--ease);
}
.zp-btn:hover { background: var(--hover) }
.zp-btn:active { transform: scale(.98) }
.zp-btn:disabled { opacity: .5; cursor: default }
.zp-btn-primary { background: var(--primary); border-color: transparent; color: var(--on-primary); font-weight: 500 }
.zp-btn-primary:hover { background: var(--primary-hover) }
.zp-btn-ghost { background: transparent; border-color: transparent; color: var(--ink-2) }
.zp-btn-ghost:hover { background: var(--hover); color: var(--ink) }

.zp-pill {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 34px; padding: 0 16px; border-radius: 999px;
  background: color-mix(in srgb, var(--card-solid) 70%, transparent);
  box-shadow: inset 0 0 0 1px var(--line-strong); color: var(--ink);
  font-family: inherit; font-size: 13px; line-height: 20px; white-space: nowrap; text-decoration: none;
  backdrop-filter: blur(12px); transition: background .15s, transform .25s var(--ease);
}
.zp-pill:hover { background: var(--card-solid) }
.zp-pill:active { transform: scale(.97) }
.zp-pill:disabled { opacity: .5; cursor: default }
.zp-pill.is-primary { background: var(--primary); color: var(--on-primary); box-shadow: none }
.zp-pill.is-primary:hover { background: var(--primary-hover) }
.zp-pill.is-quiet { background: transparent; box-shadow: none; color: var(--ink-2) }
.zp-pill.is-quiet:hover { background: var(--hover); color: var(--ink) }
.zp-pill.is-small { height: 28px; padding: 0 8px; font-size: 12px }

.zp-icon-btn {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 32px; height: 32px; border-radius: var(--r-md); color: var(--ink-2);
  transition: background .15s, color .15s;
}
.zp-icon-btn:hover { background: var(--hover); color: var(--ink) }
.zp-icon-btn:disabled { opacity: .45; cursor: default }
.zp-icon-btn.is-active { background: var(--active); color: var(--ink) }
.zp-topbar .zp-icon-btn { width: 34px; height: 34px; background: var(--glass); box-shadow: var(--elev-soft) }

.zp-card {
  min-width: 0; padding: 20px; border-radius: var(--r-xl);
  background: var(--card); box-shadow: var(--elev-soft); border: 0;
}
.zp-card-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; line-height: 20px; font-weight: 600; color: var(--ink); margin-bottom: 12px; letter-spacing: 0;
}
.zp-card-title::before {
  content: ''; flex: none; width: 3px; height: 14px; border-radius: 2px;
  background: var(--primary); opacity: .75;
}
.zp-title-actions { margin-left: auto; display: flex; align-items: center; gap: 6px }
.zp-link-btn { font-size: 12px; color: var(--ink-3); background: none; border: 0; padding: 0; cursor: pointer }
.zp-link-btn:hover { color: var(--ink) }

.zp-seg {
  display: inline-flex; gap: 0; padding: 4px; border-radius: var(--r-md);
  background: var(--hover); width: auto; border: 0;
}
.zp-seg button {
  flex: none; height: 28px; min-width: 32px; padding: 0 8px; border-radius: var(--r-sm);
  color: var(--ink-3); font-size: 12px; font-weight: 500; transition: background .18s var(--ease), color .18s;
}
.zp-seg button:hover { color: var(--ink) }
.zp-seg button.on { background: var(--card-solid); color: var(--ink); box-shadow: var(--elev-soft) }

.zp-input {
  box-sizing: border-box; height: 38px; padding: 0 12px; border-radius: var(--r-md);
  border: 1px solid var(--line-strong); background: var(--card-solid); color: var(--ink);
  font-family: inherit; font-size: 13px;
}
.zp-input::placeholder { color: var(--ink-3) }
.zp-input:focus {
  border-color: var(--primary); outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 16%, transparent);
}
.zp-field { margin-bottom: 12px }
.zp-field-label { display: block; font-size: 12px; color: var(--ink-2); margin-bottom: 6px; letter-spacing: 0 }
.zp-settings-hint { font-size: 11px; color: var(--ink-3); line-height: 1.55; margin-top: 4px }
.zp-row { display: flex; gap: 8px; align-items: center; min-width: 0 }
.zp-error { color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 1.55 }
.zp-warn { color: var(--dsw-alias-state-warn-primary); font-size: 12px; line-height: 1.55 }
.zp-note { font-size: 12px; color: var(--ink-3); line-height: 1.65 }

/* ================================================================
 * 外壳：浮空顶栏 + 页面
 * ================================================================ */
.zp-topbar {
  position: absolute; z-index: 30; left: 0; right: 0; top: 0;
  display: flex; align-items: center; gap: 8px;
  padding: 16px 20px;
  pointer-events: none;
}
.zp-topbar > * { pointer-events: auto; }
.zp-brand {
  display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px 0 8px;
  border-radius: var(--r-lg); background: var(--glass);
  backdrop-filter: blur(24px) saturate(160%); box-shadow: var(--elev-soft);
  transition: transform .25s var(--ease);
}
.zp-brand:hover { transform: translateY(-1px) }
.zp-brand-mark {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 26px; height: 26px; border-radius: 50%;
  background: color-mix(in srgb, var(--zp-gold) 24%, var(--card-solid));
}
.zp-brand-name { font-size: 14px; font-weight: 600; letter-spacing: .5px; white-space: nowrap }
.zp-brand-pro { font-size: 11px; color: var(--ink-3); letter-spacing: 1px; white-space: nowrap }

.zp-nav {
  display: flex; gap: 2px; padding: 4px; border-radius: var(--r-lg);
  background: var(--glass); backdrop-filter: blur(24px) saturate(160%);
  box-shadow: var(--elev-soft); min-width: 0;
}
.zp-nav button {
  height: 32px; padding: 0 16px; border-radius: var(--r-md);
  color: var(--ink-2); font-size: 13px; line-height: 32px; white-space: nowrap;
  transition: background .18s var(--ease), color .18s var(--ease);
}
.zp-nav button:hover { background: var(--hover); color: var(--ink) }
.zp-nav button.is-on { background: var(--primary); color: var(--on-primary) }
.zp-nav button:disabled { opacity: .45; cursor: default }
.zp-nav button:disabled:hover { background: none; color: var(--ink-2) }
.zp-top-spacer { flex: 1; min-width: 0 }
.zp-top-ctx {
  display: inline-flex; align-items: center; gap: 6px; max-width: 260px; min-width: 0;
  height: 32px; padding: 0 12px; border-radius: 999px;
  background: var(--glass); box-shadow: var(--elev-soft); color: var(--ink-2); font-size: 12px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.zp-top-ctx b { color: var(--ink); font-weight: 500; overflow: hidden; text-overflow: ellipsis }
.zp-top-actions { display: inline-flex; align-items: center; gap: 6px; flex: none }

.zp-page {
  position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden;
  padding: 92px 20px 48px; z-index: 1; scrollbar-width: thin;
}
.zp-page-inner { width: 100%; max-width: 1160px; margin: 0 auto }
.zp-page-head { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin-bottom: 24px }
.zp-page-title { font-size: 34px; line-height: 44px; font-weight: 300; letter-spacing: -.015em; color: var(--ink) }
.zp-page-sub { color: var(--ink-3); font-size: 13px; line-height: 20px; margin-top: 4px }
.zp-page-head > .zp-icon-btn { align-self: center }
.zp-page-head.is-stack { flex-direction: column; align-items: flex-start; gap: 6px }
.zp-page-head.is-stack > .zp-icon-btn { align-self: flex-start; margin-left: -4px }
.zp-page-head-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap }

.zp-section-head { display: flex; align-items: baseline; gap: 8px; margin: 32px 0 12px; flex-wrap: wrap }
.zp-section-title { font-size: 20px; line-height: 28px; font-weight: 400; color: var(--ink) }
.zp-section-meta { font-size: 12px; color: var(--ink-3) }
.zp-section-head .zp-title-actions { margin-left: auto }

.zp-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  width: 100%; max-width: 100%; margin: 0; padding: 40px 20px; text-align: center;
  color: var(--ink-3); font-size: 13px;
  border: 1px dashed var(--line-strong); border-radius: var(--r-xl);
  background: color-mix(in srgb, var(--card) 50%, transparent);
}
.zp-empty-title { font-size: 17px; line-height: 26px; color: var(--ink-2); margin-bottom: 4px }
.zp-empty-hint { font-size: 12px; line-height: 18px }

/* ================================================================
 * 首页
 * ================================================================ */
.zp-home-hero {
  padding: 6px 4px 0; max-width: 760px;
}
.zp-hero-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--ink-3); font-size: 12px; line-height: 18px; letter-spacing: .08em;
  margin-bottom: 12px;
}
.zp-hero-title {
  font-size: 34px; line-height: 46px; font-weight: 300; letter-spacing: -.015em; color: var(--ink-2);
}
.zp-hero-title b { font-weight: 400; color: var(--ink) }
.zp-hero-title em { font-style: normal; color: var(--ink-2) }
.zp-hero-stats {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px;
  margin-top: 16px; color: var(--ink-3); font-size: 12.5px; line-height: 20px;
}
.zp-hero-stats b { font-weight: 500; color: var(--ink-2); font-variant-numeric: tabular-nums }
.zp-hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 20px }

.zp-chart-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px }
.zp-chart-card {
  position: relative; min-width: 0; border-radius: var(--r-xl); background: var(--card);
  box-shadow: var(--elev-soft); text-align: left;
  transition: transform .3s var(--ease), box-shadow .3s var(--ease);
}
.zp-chart-card:hover { transform: translateY(-2px); box-shadow: var(--elev-pop) }
.zp-chart-card:active { transform: translateY(0) scale(.995) }
.zp-chart-card-open {
  display: flex; flex-direction: column; gap: 8px; width: 100%; height: 100%; min-height: 132px;
  padding: 16px 48px 16px 16px; text-align: left; border-radius: inherit;
  justify-content: space-between;
}
.zp-chart-card-actions {
  position: absolute; top: 10px; right: 10px; display: flex; gap: 2px;
  opacity: .62; transition: opacity .2s;
}
.zp-chart-card:hover .zp-chart-card-actions, .zp-chart-card:focus-within .zp-chart-card-actions { opacity: 1 }
.zp-chart-card-top { display: flex; align-items: flex-start; gap: 8px }
.zp-chart-badge {
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center; flex: none;
  width: 44px; height: 44px; border-radius: var(--r-md);
  background: color-mix(in srgb, var(--zp-gold) 16%, var(--card-solid));
  border: 1px solid color-mix(in srgb, var(--zp-gold) 30%, transparent);
  color: var(--ink); font-family: var(--font-serif); font-size: 15px; line-height: 1;
}
.zp-chart-badge small { font-family: var(--font); font-size: 9.5px; color: var(--ink-3); margin-top: 2px }
.zp-chart-card-main { min-width: 0; flex: 1 }
.zp-chart-card-name {
  font-size: 14px; line-height: 20px; font-weight: 600; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.zp-chart-card-gz {
  margin-top: 2px; color: var(--ink-3); font-size: 12px; line-height: 18px;
  font-variant-numeric: tabular-nums; letter-spacing: .04em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.zp-chart-card-save, .zp-chart-card-del {
  flex: none; width: 26px; height: 26px; border-radius: var(--r-sm);
  color: var(--ink-3); display: inline-flex; align-items: center; justify-content: center;
}
.zp-chart-card-save:hover, .zp-chart-card-del:hover { background: var(--hover); color: var(--ink) }
.zp-chart-card-save.is-saved { color: var(--zp-gold-dim) }
.zp-chart-card-foot {
  display: flex; align-items: center; gap: 8px; min-width: 0;
  color: var(--ink-4); font-size: 11.5px; line-height: 16px;
}
.zp-chart-card-foot .zp-grow { flex: 1 }
.zp-chart-card-tag {
  display: inline-flex; align-items: center; gap: 2px; height: 18px; padding: 0 8px;
  border-radius: 999px; background: var(--hover); color: var(--ink-3); font-size: 10.5px;
}
.zp-chart-card-tag.is-saved { color: var(--zp-gold-dim) }
.zp-chart-card-add {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  min-height: 132px; padding: 20px; border-radius: var(--r-xl);
  border: 1px dashed var(--line-strong); background: transparent; color: var(--ink-3);
  font-size: 13px; transition: background .2s, color .2s, border-color .2s;
}
.zp-chart-card-add:hover { background: var(--hover); color: var(--ink); border-color: var(--primary) }
.zp-chart-card-add b { font-weight: 500 }

/* ================================================================
 * 新建命盘
 * ================================================================ */
.zp-create-grid {
  display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, .85fr);
  gap: 20px; align-items: start;
}
.zp-create-aside { display: flex; flex-direction: column; gap: 12px }
.zp-create-form { padding: 24px }
.zp-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 12px }
.zp-form-grid .zp-field.is-wide { grid-column: 1 / -1 }
.zp-create-submit { display: flex; align-items: center; gap: 8px; margin-top: 8px }
.zp-create-submit .zp-grow { flex: 1 }
.zp-aside-note { color: var(--ink-3); font-size: 12px; line-height: 1.7 }
.zp-aside-note b { color: var(--ink-2); font-weight: 500 }
.zp-parts-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 20px; margin-top: 4px }
.zp-parts-list li { display: flex; gap: 8px; color: var(--ink-3); font-size: 12px; line-height: 18px }
.zp-parts-list li span { flex: none; color: var(--ink-4); font-variant-numeric: tabular-nums; width: 16px }
/* ================================================================
 * 命盘页
 * ================================================================ */
.zp-chart-hero { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; margin-bottom: 20px }
.zp-chart-id { flex: 1 1 360px; min-width: 0 }
.zp-chart-eyebrow { color: var(--ink-3); font-size: 12px; line-height: 18px; letter-spacing: .08em; margin-bottom: 6px }
.zp-chart-title {
  font-size: 28px; line-height: 36px; font-weight: 300; letter-spacing: -.01em; color: var(--ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.zp-chart-title small { font-size: 14px; color: var(--ink-3); font-weight: 400; margin-left: 8px }
.zp-chart-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px }
.zp-chip {
  display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px;
  border-radius: 999px; background: var(--hover); color: var(--ink-2);
  font-size: 11.5px; line-height: 24px; white-space: nowrap;
}
.zp-chip b { color: var(--ink); font-weight: 500; font-variant-numeric: tabular-nums }
.zp-chip.is-gold { background: color-mix(in srgb, var(--zp-gold) 14%, transparent); color: var(--ink-2) }
.zp-chip.is-gold b { color: var(--ink) }
.zp-chart-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: none }

.zp-timebar {
  position: sticky; top: 72px; z-index: 12;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 8px; margin: 0 0 16px; border-radius: var(--r-lg);
  background: var(--glass); backdrop-filter: blur(22px) saturate(150%);
  box-shadow: var(--elev-soft);
}
.zp-tabs { display: inline-flex; gap: 2px; padding: 2px; border-radius: var(--r-md); background: var(--hover) }
.zp-tabs button {
  height: 30px; padding: 0 12px; border-radius: var(--r-sm);
  color: var(--ink-3); font-size: 12px; font-weight: 500; white-space: nowrap;
  transition: background .18s var(--ease), color .18s var(--ease);
}
.zp-tabs button:hover { color: var(--ink) }
.zp-tabs button.on { background: var(--card-solid); color: var(--ink); box-shadow: var(--elev-soft) }
.zp-time-nav { display: inline-flex; align-items: center; gap: 4px; min-width: 0 }
.zp-time-btn {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 26px; height: 26px; border-radius: 999px; border: 1px solid var(--line-strong);
  background: var(--card-solid); color: var(--ink-2); font-family: inherit; font-size: 14px; line-height: 1;
}
.zp-time-btn:hover { color: var(--ink); border-color: var(--primary) }
.zp-time-btn:disabled { opacity: .45; cursor: default }
.zp-time-select {
  height: 30px; max-width: 280px; min-width: 0; padding: 0 8px;
  border: 1px solid var(--line-strong); border-radius: var(--r-sm);
  background: var(--card-solid); color: var(--ink); font-family: inherit; font-size: 12px;
}
.zp-time-input {
  width: 76px; height: 30px; padding: 0 8px;
  border: 1px solid var(--line-strong); border-radius: var(--r-sm);
  background: var(--card-solid); color: var(--ink); font-family: inherit; font-size: 12px;
}
.zp-time-now {
  height: 30px; padding: 0 8px; white-space: nowrap; border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--primary) 40%, transparent);
  background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary);
  font-size: 11px; font-weight: 500;
}
.zp-time-chip { padding: 0 4px; color: var(--ink-3); font-size: 11px; white-space: nowrap }
.zp-timebar-right { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap }
.zp-tool-btn {
  height: 30px; padding: 0 12px; white-space: nowrap; border-radius: 999px;
  border: 1px solid var(--line-strong); background: transparent;
  color: var(--ink-2); font-size: 11.5px; font-weight: 500;
}
.zp-tool-btn:hover { color: var(--ink); border-color: var(--line-strong); background: var(--hover) }
.zp-tool-btn.on { color: var(--primary); border-color: color-mix(in srgb, var(--primary) 45%, transparent); background: color-mix(in srgb, var(--primary) 8%, transparent) }
.zp-toolview-head { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap }
.zp-toolview-title { font-size: 20px; line-height: 28px; font-weight: 400 }
.zp-toolview-sub { font-size: 12px; color: var(--ink-3) }

.zp-chart-board { margin-top: 2px }
.zp-chart-info { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px }
.zp-chart-info .zp-card { height: 100% }
.zp-info-empty { color: var(--ink-3); font-size: 12px }
.zp-kbd-hint { color: var(--ink-4); font-size: 11px; line-height: 16px; padding: 8px 2px 0; text-align: center }

/* 命主信息卡（沿用旧组件结构，换成 v4 卡片外观） */
.zp-summary-card { padding: 20px }
.zp-summary-card .zp-pillars { display: flex; gap: 6px; margin-bottom: 12px }
.zp-summary-card .zp-pillar {
  flex: 1; text-align: center; padding: 8px 2px; border: 1px solid var(--line);
  border-radius: var(--r-md); background: var(--card-solid); font-size: 15px; font-weight: 600; letter-spacing: 2px;
}
.zp-summary-card .zp-kv-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px }
.zp-summary-card .zp-kv { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 12px; padding: 4px 0; min-width: 0 }
.zp-summary-card .zp-kv > span { flex: none; color: var(--ink-3); font-size: 11px }
.zp-summary-card .zp-kv > b { font-weight: 500; text-align: right; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.zp-summary-card .zp-detail-section-label { font-size: 11px; color: var(--ink-3); letter-spacing: .5px; margin: 12px 0 6px }
.zp-mutagen-strip { display: flex; flex-wrap: wrap; gap: 4px }
.zp-mu {
  display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 999px;
  font-size: 10.5px; line-height: 22px; color: var(--ink-2);
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}
.zp-patterns-card { padding: 20px }
.zp-patterns-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px }
.zp-patterns-count { color: var(--ink-3); font-size: 11px }
.zp-patterns-all { margin-left: auto }
.zp-pattern-mini { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-top: 1px solid var(--line) }
.zp-pattern-mini:first-of-type { border-top: none; padding-top: 0 }
.zp-pattern-mini-head { display: flex; align-items: baseline; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink) }
.zp-pattern-mini-level { color: var(--ink-3); font-size: 10.5px; font-weight: 500 }
.zp-pattern-mini-desc { color: var(--ink-2); font-size: 12px; line-height: 1.6 }

/* 命盘/详情沿用旧盘面组件，只调外框与详情卡 */
.zp-board-wrap { min-width: 0 }
.zp-root[data-w="wide"] .zp-board-wrap.has-detail {
  display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start;
}
.zp-board {
  width: 100%; max-width: var(--zp-board-max); margin: 0 auto;
  padding: 6px; border-radius: var(--r-xl);
  border: 1px solid color-mix(in srgb, var(--zp-gold) 22%, var(--line));
  background: var(--card-solid);
  background: linear-gradient(180deg, color-mix(in srgb, var(--zp-gold) 5%, transparent), transparent 55%), var(--card-solid);
  box-shadow: var(--elev-soft);
}
.zp-detail {
  background: var(--card); border: 0; box-shadow: var(--elev-soft);
  border-radius: var(--r-xl); padding: 16px 16px; margin-top: 12px; min-width: 0;
}
.zp-root:not([data-w="wide"]) .zp-detail { max-width: 760px; margin-left: auto; margin-right: auto }
.zp-root[data-w="wide"] .zp-detail { margin-top: 0; position: sticky; top: 96px }
.zp-detail-name { font-size: 15px; font-weight: 600; letter-spacing: .5px }
.zp-detail-section-label { font-size: 11px; color: var(--ink-3); letter-spacing: .5px; margin-bottom: 4px }
.zp-detail-nav .zp-btn { height: 26px; font-size: 11px; padding: 0 8px; border-radius: 999px }
.zp-detail-body { display: flex; flex-direction: column; gap: 12px }

/* ================================================================
 * 解读页：左聊天 + 右报告工位
 * ================================================================ */
.zp-reading { position: absolute; inset: 92px 0 0; z-index: 1; display: flex; min-height: 0; overflow: hidden }
.zp-reading-chat {
  flex: none; width: var(--chat-w); min-height: 0; display: flex; flex-direction: column;
  border-right: 1px solid var(--line); background: var(--card-solid);
}
.zp-chat-head {
  flex: none; display: flex; align-items: center; gap: 8px;
  min-height: 58px; padding: 8px 16px; border-bottom: 1px solid var(--line);
}
.zp-chat-head-main { min-width: 0; flex: 1 }
.zp-chat-title { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--ink) }
.zp-chat-ctx {
  color: var(--ink-3); font-size: 11px; line-height: 16px; margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.zp-chat-scroll {
  flex: 1; min-height: 0; overflow-y: auto; padding: 16px 16px;
  display: flex; flex-direction: column; gap: 16px; scrollbar-width: thin;
}
.zp-chat-empty { margin: auto 0; padding: 8px 2px 12px }
.zp-chat-greeting { font-size: 25px; line-height: 34px; font-weight: 300; letter-spacing: -.01em; color: var(--ink) }
.zp-chat-greeting b { font-weight: 400 }
.zp-chat-lead { margin-top: 8px; color: var(--ink-3); font-size: 13px; line-height: 21px }
.zp-chat-suggests { display: flex; flex-direction: column; gap: 6px; margin-top: 16px }
.zp-suggest {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 8px 12px; border-radius: var(--r-md);
  background: var(--card); box-shadow: var(--elev-soft);
  color: var(--ink-2); font-size: 12.5px; line-height: 18px; text-align: left;
  transition: transform .2s var(--ease), background .2s, color .2s;
}
.zp-suggest:hover { transform: translateY(-1px); background: var(--card-solid); color: var(--ink) }
.zp-suggest svg { color: var(--ink-3); flex: none }
.zp-suggest small { color: var(--ink-4); font-size: 10.5px; margin-left: auto; white-space: nowrap }

.zp-msg { display: flex; flex-direction: column; gap: 6px; min-width: 0 }
.zp-msg.is-user { align-items: flex-end }
.zp-msg-bubble {
  max-width: 90%; padding: 8px 16px; border-radius: var(--r-lg);
  background: var(--active); color: var(--ink); font-size: 13.5px; line-height: 22px;
  white-space: pre-wrap; word-break: break-word;
}
.zp-msg-ai-head { display: flex; align-items: center; gap: 6px; color: var(--ink-3); font-size: 11px }
.zp-msg-ai-head .zp-glyph-sm {
  display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
  border-radius: 50%; background: color-mix(in srgb, var(--zp-gold) 22%, var(--card)); color: var(--ink);
}
.zp-msg-ai-body {
  width: 100%; padding: 16px 16px; border-radius: var(--r-lg);
  background: var(--card); box-shadow: var(--elev-soft);
  color: var(--ink); font-size: 13.5px; line-height: 1.85;
}
.zp-msg-actions { display: flex; align-items: center; gap: 8px; color: var(--ink-4); font-size: 11px; padding-left: 2px }
.zp-msg-actions button { display: inline-flex; align-items: center; gap: 4px; color: var(--ink-3); font-size: 11px }
.zp-msg-actions button:hover { color: var(--ink) }
.zp-typing { display: flex; align-items: center; gap: 8px; color: var(--ink-3); font-size: 12px; padding: 2px; }
.zp-typing i {
  width: 7px; height: 7px; border-radius: 50%; background: var(--ink-3);
  animation: zp-pulse 1.2s ease-in-out infinite;
}
.zp-typing i:nth-child(2) { animation-delay: .15s }
.zp-typing i:nth-child(3) { animation-delay: .3s }
@keyframes zp-pulse { 0%, 100% { opacity: .3; transform: translateY(0) } 50% { opacity: 1; transform: translateY(-2px) } }

.zp-composer {
  flex: none; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px;
  margin: 0 12px 12px; padding: 8px 8px 8px 16px;
  border-radius: var(--r-xl); background: var(--card); box-shadow: var(--elev-soft);
  transition: box-shadow .2s var(--ease);
}
.zp-composer:focus-within { box-shadow: 0 0 0 1px var(--ink-2), var(--elev-soft) }
.zp-composer textarea {
  flex: 1; min-width: 0; min-height: 24px; max-height: 140px; padding: 4px 0;
  border: 0; outline: 0; background: none; resize: none;
  color: var(--ink); font-size: 13.5px; line-height: 22px;
}
.zp-composer textarea::placeholder { color: var(--ink-3) }
.zp-composer-foot {
  display: flex; align-items: center; gap: 8px; width: 100%;
  color: var(--ink-4); font-size: 11px; line-height: 16px;
}
.zp-composer-foot .zp-grow { flex: 1 }
.zp-send {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--primary); color: var(--on-primary); transition: opacity .15s, transform .2s var(--ease);
}
.zp-send:hover { opacity: .92 }
.zp-send:active { transform: scale(.96) }
.zp-send:disabled { opacity: .4; cursor: default }
.zp-send-stop { background: var(--active); color: var(--ink); border: 1px solid var(--line-strong) }
.zp-disclaimer-inline { color: var(--ink-4); font-size: 10.5px; line-height: 16px; margin: 0 16px 16px; text-align: center }

/* 右侧报告工位 */
.zp-reading-dock {
  flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column;
  background: var(--canvas); overflow: hidden;
}
.zp-dock-head {
  flex: none; display: flex; align-items: center; gap: 8px; min-height: 58px;
  padding: 8px 20px; border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--card-solid) 70%, transparent);
  backdrop-filter: blur(16px);
}
.zp-dock-title { font-size: 14px; font-weight: 600; color: var(--ink) }
.zp-dock-meta { color: var(--ink-3); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.zp-dock-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px }
.zp-dock-empty { max-width: 640px; margin: auto; display: flex; flex-direction: column; gap: 16px }
.zp-dock-eyebrow { color: var(--ink-3); font-size: 12px; letter-spacing: .08em }
.zp-dock-hero { font-size: 24px; line-height: 34px; font-weight: 300; letter-spacing: -.01em; color: var(--ink) }
.zp-dock-hero b { font-weight: 400 }
.zp-dock-lead { color: var(--ink-3); font-size: 13px; line-height: 21px }
.zp-report-card {
  padding: 24px; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--elev-soft);
}
.zp-report-card-head { display: flex; align-items: flex-start; gap: 8px }
.zp-report-card-main { flex: 1; min-width: 0 }
.zp-report-title { font-size: 20px; line-height: 28px; font-weight: 400; color: var(--ink) }
.zp-report-meta { color: var(--ink-3); font-size: 12px; line-height: 18px; margin-top: 4px; font-variant-numeric: tabular-nums }
.zp-report-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px }
.zp-report-excerpt {
  position: relative; margin-top: 16px; padding: 16px; border-radius: var(--r-lg);
  background: var(--bg); box-shadow: inset 0 0 0 1px var(--line);
  color: var(--ink-2); font-size: 12px; line-height: 1.8; max-height: 210px; overflow: hidden;
}
.zp-report-excerpt::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 56px;
  background: linear-gradient(transparent, var(--bg));
}
.zp-report-excerpt h2, .zp-report-excerpt h3, .zp-report-excerpt h4 {
  font-family: var(--font); font-size: 13px; line-height: 20px; color: var(--ink); font-weight: 600; margin: 8px 0 4px;
}
.zp-report-excerpt p { margin-bottom: 6px }
.zp-report-hint { color: var(--ink-4); font-size: 11px; line-height: 16px; margin-top: 8px }

.zp-progress-card { padding: 20px; border-radius: var(--r-xl); background: var(--card); box-shadow: var(--elev-soft) }
.zp-progress-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px }
.zp-progress-title { font-size: 14px; font-weight: 600; color: var(--ink) }
.zp-progress-meta { color: var(--ink-3); font-size: 11.5px; margin-left: auto; font-variant-numeric: tabular-nums }
.zp-progress-list { display: flex; flex-direction: column; gap: 8px }
.zp-progress-step { display: flex; align-items: center; gap: 8px; color: var(--ink-3); font-size: 12.5px; line-height: 18px }
.zp-progress-step i {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--line-strong);
  color: var(--ink-3); font-style: normal; font-size: 10px;
}
.zp-progress-step.is-done { color: var(--ink-2) }
.zp-progress-step.is-done i { background: var(--primary); border-color: transparent; color: var(--on-primary) }
.zp-progress-step.is-active { color: var(--ink) }
.zp-progress-bar { height: 3px; border-radius: 999px; background: var(--hover); margin-top: 16px; overflow: hidden }
.zp-progress-bar span { display: block; height: 100%; border-radius: 999px; background: var(--primary); transition: width .3s var(--ease) }
.zp-dock-dots { display: flex; gap: 4px; margin-top: 16px }
.zp-dock-dots i { flex: 1 1 0; height: 4px; border-radius: 999px; background: var(--hover) }
.zp-dock-dots i.is-done { background: var(--primary) }
.zp-dock-dots i.is-active { background: color-mix(in srgb, var(--primary) 45%, var(--hover)) }
.zp-shimmer { color: transparent; background: linear-gradient(90deg, var(--ink-3) 30%, var(--ink) 50%, var(--ink-3) 70%); background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; animation: zp-shimmer 1.6s linear infinite }
@keyframes zp-shimmer { to { background-position: -220% 0 } }

.zp-error-card { padding: 16px; border-radius: var(--r-lg); background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent); color: var(--ink); font-size: 12.5px; line-height: 1.7 }
.zp-error-card b { display: block; margin-bottom: 4px; font-weight: 600 }

/* ================================================================
 * 报告阅读页（全屏 / 面板内全屏）
 * ================================================================ */
.zp-reader { position: absolute; inset: 92px 0 0; z-index: 1; display: flex; flex-direction: column; background: var(--canvas) }
.zp-reader-head {
  flex: none; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 12px 20px; border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--card-solid) 72%, transparent); backdrop-filter: blur(16px);
}
.zp-reader-title { font-size: 14px; font-weight: 600; color: var(--ink); white-space: nowrap }
.zp-reader-meta { color: var(--ink-3); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0 }
.zp-reader-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap }
.zp-reader-body { flex: 1; min-height: 0; overflow: auto; padding: 20px; display: flex; justify-content: center; align-items: flex-start }
.zp-reader-paper {
  width: min(860px, 100%); height: 100%; min-height: 0;
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: var(--r-lg); background: var(--dsw-alias-bg-layer-1);
  box-shadow: var(--elev-pop);
}
.zp-reader-frame { width: 100%; flex: 1; min-height: 0; border: 0; background: var(--dsw-alias-bg-layer-1) }
.zp-reader:fullscreen { inset: 0; background: var(--bg) }
.zp-reader:fullscreen .zp-reader-head { padding-top: 16px }
.zp-reader:fullscreen .zp-reader-paper { width: min(960px, 100%) }
/* ================================================================
 * 聊天 markdown
 * ================================================================ */
.zp-chat-thread { display: flex; flex-direction: column; gap: 16px }
.zp-md { font-size: 13.5px; line-height: 1.85; color: var(--ink); overflow-wrap: anywhere }
.zp-md-gap { height: 6px }
.zp-md-p { margin: 0 0 8px }
.zp-md-p:last-child { margin-bottom: 0 }
.zp-md-h { margin: 16px 0 6px; color: var(--ink); font-weight: 600 }
.zp-md-h:first-child { margin-top: 0 }
.zp-md-h1 { font-size: 15px; line-height: 24px }
.zp-md-h2 { font-size: 14px; line-height: 22px }
.zp-md-h3 { font-size: 13.5px; line-height: 22px }
.zp-md-h4 { font-size: 13px; line-height: 20px }
.zp-md-li { position: relative; margin: 2px 0 2px 12px }
.zp-md-li::before { content: '·'; position: absolute; left: -12px; color: var(--ink-3) }
.zp-md-quote {
  margin: 8px 0; padding: 6px 12px; border-left: 2px solid var(--line-strong);
  color: var(--ink-2); font-style: normal;
}
.zp-md code {
  padding: 2px 4px; border-radius: 4px; background: var(--hover);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
}
.zp-md hr { margin: 12px 0; border: 0; border-top: 1px solid var(--line-strong) }
.zp-md-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; line-height: 1.6 }
.zp-md-table th, .zp-md-table td {
  border: 1px solid var(--line-strong); padding: 6px 8px;
  vertical-align: top; text-align: left; word-break: break-word;
}
.zp-md-table th { background: var(--hover); font-weight: 600 }
.zp-md-table tr:nth-child(even) td { background: color-mix(in srgb, var(--ink) 2.5%, transparent) }

/* ================================================================
 * 设置浮层
 * ================================================================ */
.zp-overlay { position: absolute; inset: 0; z-index: 100 }
.zp-overlay-mask {
  position: absolute; inset: 0; background: color-mix(in srgb, var(--ink) 32%, transparent);
  animation: zp-fade .14s ease-out;
}
.zp-overlay-center {
  position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center;
  padding: 48px 20px; overflow: auto;
}
.zp-settings:focus { outline: none }
.zp-settings {
  width: min(560px, 100%); max-height: 86%; display: flex; flex-direction: column;
  background: var(--card-solid); border-radius: var(--r-xl);
  box-shadow: var(--elev-pop); animation: zp-pop .16s var(--ease);
}
.zp-settings-head {
  flex: none; display: flex; align-items: center; gap: 8px;
  padding: 16px 20px; border-bottom: 1px solid var(--line);
}
.zp-settings-title { font-size: 20px; font-weight: 400; color: var(--ink) }
.zp-settings-body { padding: 20px; overflow: auto; display: flex; flex-direction: column; gap: 12px }
.zp-settings-hint { font-size: 11px; color: var(--ink-3); line-height: 1.55; margin-top: 4px }
.zp-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink); cursor: pointer }
.zp-check input { accent-color: var(--primary) }
.zp-settings-about {
  margin-top: 4px; padding-top: 16px; border-top: 1px solid var(--line);
  color: var(--ink-3); font-size: 12px; line-height: 1.7;
  display: flex; flex-direction: column; gap: 4px;
}
.zp-settings-about b { color: var(--ink-2); font-size: 12px; font-weight: 600; letter-spacing: .5px }
.zp-update { padding-top: 16px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px }
.zp-update-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-3) }
.zp-update-row b { color: var(--ink); font-size: 13px; font-weight: 500 }
.zp-update-cmd {
  display: block; padding: 8px 12px; border-radius: var(--r-md); background: var(--hover);
  color: var(--ink-2); font-size: 11px; line-height: 1.6; word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.zp-update-new { font-size: 12px; line-height: 1.6; color: var(--dsw-alias-state-warn-primary) }
.zp-update-ok { font-size: 12px; line-height: 1.6; color: var(--ink-3) }

/* ================================================================
 * 窗口 chrome 避让（macOS 桌面端）
 * ================================================================ */
html[data-platform="darwin"] .zp-root { padding-top: var(--dsh-frame-top-clearance, 0px) }
html[data-platform="darwin"] [data-sidebar-collapsed] .zp-topbar {
  padding-left: max(20px, var(--dsh-frame-leading-clearance, 0px));
}
html[data-platform="darwin"] .zp-root .zp-overlay-center {
  padding-top: max(48px, var(--dsh-frame-overlay-top, 48px));
}

/* ================================================================
 * 响应式：narrow < 880 ≤ mid < 1100 ≤ wide
 * ================================================================ */
.zp-root[data-w="narrow"] { --chat-w: 100% }
.zp-root[data-w="mid"] { --chat-w: 340px }
.zp-root[data-w="narrow"] .zp-topbar {
  gap: 6px; flex-wrap: wrap;
  padding: 8px 8px 8px 8px;
}
.zp-root[data-w="narrow"] .zp-brand { height: 36px; padding: 0 8px 0 6px }
.zp-root[data-w="narrow"] .zp-brand-pro { display: none }
.zp-root[data-w="narrow"] .zp-nav {
  order: 3; width: 100%; overflow-x: auto; scrollbar-width: none;
}
.zp-root[data-w="narrow"] .zp-nav::-webkit-scrollbar { display: none }
.zp-root[data-w="narrow"] .zp-nav button { padding: 0 12px; font-size: 12px }
.zp-root[data-w="narrow"] .zp-top-ctx { display: none }
.zp-root[data-w="mid"] .zp-top-ctx { display: none }
.zp-root[data-w="mid"] .zp-brand-pro { display: none }
.zp-root[data-w="mid"] .zp-nav { overflow-x: auto; scrollbar-width: none }
.zp-root[data-w="mid"] .zp-nav::-webkit-scrollbar { display: none }
.zp-root[data-w="narrow"] .zp-page { padding: 124px 16px 32px }
.zp-root[data-w="narrow"] .zp-reading, .zp-root[data-w="narrow"] .zp-reader { inset: 124px 0 0 }
.zp-root[data-w="narrow"] .zp-create-grid { grid-template-columns: minmax(0, 1fr) }
.zp-root[data-w="narrow"] .zp-form-grid { grid-template-columns: minmax(0, 1fr) }
.zp-root[data-w="narrow"] .zp-chart-info { grid-template-columns: minmax(0, 1fr) }
.zp-root[data-w="narrow"] .zp-summary-card .zp-kv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) }
.zp-root[data-w="narrow"] .zp-page-title { font-size: 24px; line-height: 34px }
.zp-root[data-w="narrow"] .zp-hero-title { font-size: 24px; line-height: 34px }
.zp-root[data-w="narrow"] .zp-chart-title { font-size: 24px; line-height: 32px }
.zp-root[data-w="narrow"] .zp-chat-greeting { font-size: 24px; line-height: 32px }
.zp-root[data-w="narrow"] .zp-dock-hero, .zp-root[data-w="narrow"] .zp-report-title { font-size: 20px; line-height: 28px }
.zp-root[data-w="narrow"] .zp-timebar { position: static; top: auto }
.zp-root[data-w="narrow"] .zp-time-select { max-width: 170px }
.zp-root[data-w="narrow"] .zp-detail-nav .zp-btn { font-size: 10.5px }
.zp-root[data-w="narrow"] .zp-chart-actions { width: 100% }
.zp-root[data-w="narrow"] .zp-reading { display: flex; flex-direction: column; overflow: hidden }
.zp-root[data-w="narrow"] .zp-reading-tabs { display: flex }
.zp-root[data-w="narrow"] .zp-reading-chat { width: 100%; height: auto; flex: 1; border-right: 0 }
.zp-root[data-w="narrow"] .zp-reading-dock { height: auto; flex: 1; display: none }
.zp-root[data-w="narrow"] .zp-reading[data-tab="dock"] .zp-reading-chat { display: none }
.zp-root[data-w="narrow"] .zp-reading[data-tab="dock"] .zp-reading-dock { display: flex }
.zp-root[data-w="narrow"] .zp-reader-head { padding: 8px 16px }
.zp-root[data-w="narrow"] .zp-reader-body { padding: 12px }
.zp-root[data-w="narrow"] .zp-reader-paper { border-radius: var(--r-md) }
.zp-root[data-w="narrow"] .zp-dock-scroll { padding: 16px }
.zp-root[data-w="narrow"] .zp-report-card { padding: 16px }
.zp-root[data-w="narrow"] .zp-chat-scroll { padding: 16px 12px }
.zp-root[data-w="narrow"] .zp-composer { margin: 0 8px 8px }
.zp-root[data-w="narrow"] .zp-disclaimer-inline { margin: 0 12px 8px }

/* 阅读页窄面板：对话 / 报告 分栏切换 */
.zp-reading-tabs {
  display: none; flex: none; align-items: center; gap: 4px;
  padding: 8px 12px; border-bottom: 1px solid var(--line); background: var(--card-solid);
}
.zp-reading-tabs .zp-seg { width: 100% }
.zp-reading-tabs .zp-seg button { flex: 1; height: 30px }
.zp-root[data-w="narrow"] .zp-reading-tabs { display: flex }

/* ================================================================
 * 深色主题：内容色提亮一档；品牌/背景全部交给宿主 token
 * ================================================================ */
body[data-ds-dark-theme] .zp-root {
  --zp-accent: var(--dsw-alias-brand-primary);
  --zp-accent-deep: var(--dsw-alias-button-primary-hover);
  --zp-fill-accent: var(--dsw-alias-button-primary-fill);
  --zp-fill-accent-deep: var(--dsw-alias-button-primary-hover);
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
body[data-ds-dark-theme] .zp-mu { background: color-mix(in srgb, currentColor 18%, transparent) }

@keyframes zp-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes zp-pop { from { transform: translateY(6px) scale(.99); opacity: .4 } to { transform: none; opacity: 1 } }

/* 动效偏好 */
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
        /* 聚焦弹层容器本身（tabIndex=-1），而不是第一个按钮：
           否则一打开抽屉，关闭/新对话按钮就被画上 focus ring，看起来像选错目标。
           Tab 仍会从容器进入第一个可聚焦控件。 */
        var box = boxRef.current;
        try { if (box && typeof box.focus === 'function') box.focus(); } catch (e) { /* ignore */ }
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

    /* ---------------- 排盘输入（新建命盘页） ---------------- */
    function BirthForm(props) {
      var f = props.form;
      var t = props.t;
      var set = props.setForm;
      var lunarMode = f.calendar === 'lunar';
      var leapAvailable = lunarMode && E.leapMonth(+f.year) === +f.month;
      var setSetting = function (k, v) {
        var next = Object.assign({}, f.settings);
        next[k] = v;
        set({ settings: next });
      };
      var seg = function (value, options, onChange) {
        return h(Seg, { value: value, options: options, onChange: onChange });
      };
      return h('div', { className: 'zp-card zp-create-form' },
        h('div', { className: 'zp-card-title' }, t('formTitle')),
        h('div', { className: 'zp-form-grid' },
          h('div', { className: 'zp-field is-wide' },
            h('label', { className: 'zp-field-label' }, t('name')),
            h('input', {
              className: 'zp-input', type: 'text', value: f.name || '', maxLength: 20,
              placeholder: t('namePh'), 'aria-label': t('name'),
              onChange: function (ev) { set({ name: ev.target.value }); }
            })),
          h('div', { className: 'zp-field' },
            h('label', { className: 'zp-field-label' }, t('calendar')),
            seg(f.calendar, [{ value: 'solar', label: t('solar') }, { value: 'lunar', label: t('lunar') }],
              function (v) { set({ calendar: v, isLeap: false }); })),
          h('div', { className: 'zp-field is-wide' },
            h('label', { className: 'zp-field-label' }, t('year') + ' / ' + t('month') + ' / ' + t('day')),
            h('div', { className: 'zp-row' },
              h('input', {
                className: 'zp-input', type: 'number', value: f.year, min: 1900, max: 2100, style: { flex: '1 1 0', minWidth: 0 },
                'aria-label': t('year'), onChange: function (ev) { set({ year: ev.target.value }); }
              }),
              h('input', {
                className: 'zp-input', type: 'number', value: f.month, min: 1, max: 12, style: { flex: '1 1 0', minWidth: 0 },
                'aria-label': t('month'), onChange: function (ev) { set({ month: ev.target.value }); }
              }),
              h('input', {
                className: 'zp-input', type: 'number', value: f.day, min: 1, max: 30, style: { flex: '1 1 0', minWidth: 0 },
                'aria-label': t('day'), onChange: function (ev) { set({ day: ev.target.value }); }
              }),
              lunarMode ? h('label', { className: 'zp-check', style: { flex: 'none' } },
                h('input', {
                  type: 'checkbox', checked: !!f.isLeap, disabled: !leapAvailable,
                  onChange: function (ev) { set({ isLeap: ev.target.checked }); }
                }), t('leap')) : null)),
          h('div', { className: 'zp-field is-wide' },
            h('label', { className: 'zp-field-label' }, t('time') + ' · ' + t('gender')),
            h('div', { className: 'zp-row' },
              h('input', {
                className: 'zp-input', type: 'number', value: f.hour, min: 0, max: 23, style: { width: 70, flex: 'none' },
                'aria-label': t('hour'), onChange: function (ev) { set({ hour: ev.target.value }); }
              }),
              h('span', { style: { color: 'var(--ink-3)', fontSize: 12, flex: 'none' } }, t('hour')),
              h('input', {
                className: 'zp-input', type: 'number', value: f.minute, min: 0, max: 59, style: { width: 70, flex: 'none' },
                'aria-label': t('minute'), onChange: function (ev) { set({ minute: ev.target.value }); }
              }),
              h('div', { style: { flex: '1 1 0', minWidth: 120, marginLeft: 4 } },
                seg(f.gender, [{ value: 'male', label: t('male') }, { value: 'female', label: t('female') }],
                  function (v) { set({ gender: v }); })))),
          h('div', { className: 'zp-field' },
            h('label', { className: 'zp-field-label' }, t('lonLabel')),
            h('input', {
              className: 'zp-input', type: 'number', value: f.longitude, min: 60, max: 140, step: 'any',
              placeholder: t('lonPh'), 'aria-label': t('lonLabel'),
              onChange: function (ev) { set({ longitude: ev.target.value }); }
            })),
          h('div', { className: 'zp-field' },
            h('label', { className: 'zp-field-label' }, t('placeLabel')),
            h('input', {
              className: 'zp-input', type: 'text', value: f.place || '', maxLength: 30,
              placeholder: t('placePh'), 'aria-label': t('placeLabel'),
              onChange: function (ev) { set({ place: ev.target.value }); }
            })),
          h('div', { className: 'zp-field is-wide' },
            h('label', { className: 'zp-field-label' }, t('occupationLabel')),
            h('input', {
              className: 'zp-input', type: 'text', value: f.occupation || '', maxLength: 60,
              placeholder: t('occupationPh'), 'aria-label': t('occupationLabel'),
              onChange: function (ev) { set({ occupation: ev.target.value }); }
            })),
          h('details', { className: 'zp-field is-wide' },
            h('summary', { style: { fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer' } }, t('settings')),
            h('div', { style: { paddingTop: 12 } },
              h('div', { className: 'zp-field' },
                h('label', { className: 'zp-field-label' }, t('yearDivide')),
                seg(f.settings.yearDivide, [{ value: 'normal', label: t('ydNormal') }, { value: 'exact', label: t('ydExact') }],
                  function (v) { setSetting('yearDivide', v); })),
              h('div', { className: 'zp-field' },
                h('label', { className: 'zp-field-label' }, t('monthDivide')),
                seg(f.settings.monthDivide, [{ value: 'normal', label: t('mdNormal') }, { value: 'exact', label: t('mdExact') }],
                  function (v) { setSetting('monthDivide', v); }),
                h('div', { className: 'zp-settings-hint' }, t('monthDivideHint'))),
              h('div', { className: 'zp-field' },
                h('label', { className: 'zp-field-label' }, t('dayDivide')),
                seg(f.settings.dayDivide, [{ value: 'forward', label: t('ddForward') }, { value: 'current', label: t('ddCurrent') }],
                  function (v) { setSetting('dayDivide', v); })),
              h('div', { className: 'zp-field' },
                h('label', { className: 'zp-field-label' }, t('fixLeap')),
                seg(f.settings.fixLeap, [{ value: true, label: t('flTrue') }, { value: false, label: t('flFalse') }],
                  function (v) { setSetting('fixLeap', v); }))))),
        props.error ? h('div', { className: 'zp-error', style: { marginBottom: 10 } }, props.error) : null,
        h('div', { className: 'zp-create-submit' },
          h('button', { className: 'zp-pill is-primary', type: 'button', onClick: props.onSubmit },
            h(Icon, { name: 'chart', size: 14 }), props.submitLabel || t('createSubmit')),
          h('span', { className: 'zp-grow' }),
          h('button', { className: 'zp-pill is-quiet', type: 'button', onClick: props.onSample }, t('createSample'))));
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
    /* 左栏摘要：只读，最多 4 条；完整描述与多列布局仍在 PatternsView（顶部入口） */
    function PatternsSummary(props) {
      var t = props.t;
      var items = (props.patterns || []).slice(0, 4);
      return h('div', { className: 'zp-card zp-patterns-card', 'data-region': 'SIDE_PATTERNS' },
        h('div', { className: 'zp-patterns-card-head' },
          h('div', { className: 'zp-card-title', style: { marginBottom: 0 } }, t('patternTitle')),
          h('span', { className: 'zp-patterns-count' }, items.length + (props.patterns.length > 4 ? '+' : '')),
          h('button', {
            className: 'zp-mini-btn zp-patterns-all', type: 'button',
            onClick: props.onOpen
          }, t('openPatterns') + ' ›')),
        items.length
          ? items.map(function (p, i) {
            return h('div', { key: i, className: 'zp-pattern-mini' },
              h('div', { className: 'zp-pattern-mini-head' },
                h('span', null, p.name),
                p.level ? h('span', { className: 'zp-pattern-mini-level' }, p.level) : null),
              h('div', { className: 'zp-pattern-mini-desc' }, p.desc));
          })
          : h('div', { className: 'zp-pattern-mini-desc' }, t('patternEmpty')));
    }

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
      report: [
        ['rect', { x: 3.2, y: 2.2, width: 9.6, height: 11.6, rx: 1.6 }],
        ['path', { d: 'M5.6 5.4h4.8M5.6 8h4.8M5.6 10.6h3' }]
      ],
      check: [
        ['path', { d: 'M3.4 8.3l3.1 3.1 6.1-6.7' }]
      ],
      home: [
        ['path', { d: 'M2.4 7.2L8 2.6l5.6 4.6' }],
        ['path', { d: 'M4 6.6v6.6h8V6.6' }]
      ],
      chart: [
        ['rect', { x: 2.2, y: 2.2, width: 4.6, height: 4.6, rx: 1 }],
        ['rect', { x: 9.2, y: 2.2, width: 4.6, height: 4.6, rx: 1 }],
        ['rect', { x: 2.2, y: 9.2, width: 4.6, height: 4.6, rx: 1 }],
        ['rect', { x: 9.2, y: 9.2, width: 4.6, height: 4.6, rx: 1 }]
      ],
      clock: [
        ['circle', { cx: 8, cy: 8, r: 6 }],
        ['path', { d: 'M8 4.6V8l2.6 1.6' }]
      ],
      star: [
        ['path', { d: 'M8 2.2l1.7 3.6 3.9.5-2.9 2.7.8 3.9L8 11.1l-3.5 1.8.8-3.9L2.4 6.3l3.9-.5z' }]
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
    /* 抽屉回答的 markdown：表格/转义用 ZWReport 的共享解析器（v3.2），其它保持 zp-md 排版 */
    function renderChatMd(s) {
      try {
        if (window.ZWReport && typeof window.ZWReport.mdToChatHtml === 'function') {
          return window.ZWReport.mdToChatHtml(s);
        }
      } catch (e) { /* 回退纯文本 */ }
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }

    /* ================================================================
     * v4 通用小工具
     * ================================================================ */
    function relTime(t, ts) {
      if (!ts) return '';
      var d = Date.now() - ts;
      if (d < 60 * 1000) return t('relJustNow');
      if (d < 60 * 60 * 1000) return t('relMin').replace('{n}', String(Math.max(1, Math.floor(d / 60000))));
      if (d < 24 * 60 * 60 * 1000) return t('relHour').replace('{n}', String(Math.floor(d / 3600000)));
      if (d < 48 * 60 * 60 * 1000) return t('relYesterday');
      if (d < 30 * 24 * 60 * 60 * 1000) return t('relDays').replace('{n}', String(Math.floor(d / 86400000)));
      return fmtDate(ts);
    }
    function fmtDate(ts) {
      var d = new Date(ts);
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    function fmtDateTime(ts) {
      var d = new Date(ts);
      return fmtDate(ts) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    function inputKey(input) {
      if (!input) return '';
      return [input.calendar, input.year, input.month, input.day, input.isLeap ? 1 : 0,
        input.hour, input.minute, input.gender, input.longitude == null ? '' : input.longitude].join('|');
    }
    function cleanInput(form) {
      return {
        name: form.name || '', calendar: form.calendar, year: form.year, month: form.month, day: form.day,
        isLeap: !!form.isLeap, hour: form.hour, minute: form.minute, gender: form.gender,
        longitude: form.longitude, place: form.place || '', occupation: form.occupation || '',
        settings: Object.assign({}, form.settings)
      };
    }
    function reportProgress(text) {
      var s = String(text || '');
      var sections = (s.match(/^#{2,4}\s+/gm) || []).length;
      var last = '';
      var re = /^#{2,4}\s+(.+)$/gm;
      var m;
      while ((m = re.exec(s))) last = m[1];
      return { sections: Math.min(sections, 14), chars: s.length, last: last };
    }
    function reportExcerpt(text) {
      var s = String(text || '');
      if (s.length <= 1400) return s;
      var cut = s.slice(0, 1400);
      var lastBreak = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('\n'));
      return lastBreak > 600 ? cut.slice(0, lastBreak) : cut;
    }

    /* ================================================================
     * 首页命盘卡片
     * ================================================================ */
    function ChartCard(props) {
      var t = props.t;
      var item = props.item;
      var c = item.chart;
      var gz = c ? [c.pillars.yearly, c.pillars.monthly, c.pillars.daily, c.pillars.hourly].join(' ') : '';
      return h('div', { className: 'zp-chart-card' },
        h('button', {
          className: 'zp-chart-card-open', type: 'button', onClick: function () { props.onOpen(item); },
          'aria-label': (item.name || t('defaultName')) + '，' + gz
        },
          h('div', { className: 'zp-chart-card-top' },
            h('span', { className: 'zp-chart-badge' },
              c ? c.soulBranch : '盘',
              h('small', null, c ? c.fiveElementsClass : '')),
            h('div', { className: 'zp-chart-card-main' },
              h('div', { className: 'zp-chart-card-name' }, item.name || t('defaultName')),
              h('div', { className: 'zp-chart-card-gz' }, gz))),
          h('div', { className: 'zp-chart-card-foot' },
            h('span', null, item.lastViewedAt ? relTime(t, item.lastViewedAt) : t('chartSaved')),
            h('span', { className: 'zp-grow' }),
            item.saved
              ? h('span', { className: 'zp-chart-card-tag is-saved' }, t('homeSavedTag'))
              : h('span', { className: 'zp-chart-card-tag' }, t('homeRecentTag')))),
        h('div', { className: 'zp-chart-card-actions' },
          h('button', {
            className: 'zp-chart-card-save' + (item.saved ? ' is-saved' : ''), type: 'button',
            title: item.saved ? t('chartUnsave') : t('chartSave'),
            'aria-label': item.saved ? t('chartUnsave') : t('chartSave'),
            onClick: function (ev) { ev.stopPropagation(); props.onToggleSave(item); }
          }, h(Icon, { name: 'star', size: 13 })),
          item.saved ? null : h('button', {
            className: 'zp-chart-card-del', type: 'button',
            title: t('homeRemove'), 'aria-label': t('homeRemove'),
            onClick: function (ev) { ev.stopPropagation(); props.onRemove(item); }
          }, h(Icon, { name: 'close', size: 12 }))));
    }

    /* ================================================================
     * 解读页 · 聊天栏
     * ================================================================ */
    function ChatPane(props) {
      var t = props.t;
      var [q, setQ] = useState('');
      var bodyRef = useRef(null);
      var thread = props.thread || [];
      var streaming = props.streaming;
      var lastAssistant = -1;
      for (var i = thread.length - 1; i >= 0; i--) {
        if (thread[i].role === 'assistant' && thread[i].content) { lastAssistant = i; break; }
      }
      useEffect(function () {
        var el = bodyRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, [props.thread, props.streaming]);

      var submit = function () {
        var text = q.trim();
        if (!text || streaming || props.reportRunning) return;
        setQ('');
        props.onAsk(text);
      };
      var suggests = [
        { icon: 'chart', label: t('readingSug1') },
        { icon: 'clock', label: t('readingSug2') },
        { icon: 'sparkle', label: t('readingSug3') },
        { icon: 'report', label: t('readingSug4'), meta: t('readingSug4Meta'), report: true }
      ];
      return h('section', { className: 'zp-reading-chat', 'data-region': 'CHAT' },
        h('header', { className: 'zp-chat-head' },
          h('button', {
            className: 'zp-icon-btn zp-chat-back', type: 'button', title: t('navChart'),
            'aria-label': t('navChart'), onClick: props.onBack
          }, h(Icon, { name: 'back' })),
          h('div', { className: 'zp-chat-head-main' },
            h('div', { className: 'zp-chat-title' }, t('readingTitle')),
            h('div', { className: 'zp-chat-ctx' }, props.ctxLine || '')),
          props.onHandoff ? h('button', {
            className: 'zp-icon-btn', type: 'button', title: t('handoffHint'), 'aria-label': t('handoff'),
            disabled: streaming || props.reportRunning,
            onClick: props.onHandoff
          }, h(Icon, { name: 'handoff' })) : null,
          thread.length ? h('button', {
            className: 'zp-icon-btn', type: 'button', title: t('aiNewChat'), 'aria-label': t('aiNewChat'),
            disabled: streaming, onClick: props.onNewChat
          }, h(Icon, { name: 'newChat' })) : null),
        props.tabs || null,
        h('div', { className: 'zp-chat-scroll', ref: bodyRef },
          thread.length === 0
            ? h('div', { className: 'zp-chat-empty' },
              h('div', { className: 'zp-chat-greeting' }, t('readingGreeting')),
              h('p', { className: 'zp-chat-lead' }, t('readingLead')),
              h('div', { className: 'zp-chat-suggests' },
                suggests.map(function (s, idx) {
                  return h('button', {
                    key: idx, className: 'zp-suggest', type: 'button',
                    disabled: s.report ? (props.reportRunning || props.chatRunning) : false,
                    onClick: function () { s.report ? props.onGenerateReport() : props.onAsk(s.label); }
                  }, h(Icon, { name: s.icon, size: 14 }), h('span', null, s.label),
                    s.meta ? h('small', null, s.meta) : null);
                })))
            : h('div', { className: 'zp-chat-thread', role: 'log', 'aria-live': 'polite', 'aria-busy': streaming ? 'true' : 'false' },
              thread.map(function (m, idx) {
                if (m.role === 'user') {
                  return h('div', { key: 'm' + idx, className: 'zp-msg is-user' },
                    h('div', { className: 'zp-msg-bubble' }, m.content));
                }
                return h('div', { key: 'm' + idx, className: 'zp-msg' },
                  h('div', { className: 'zp-msg-ai-head' },
                    h('span', { className: 'zp-glyph-sm' }, h(Icon, { name: 'sparkle', size: 11 })),
                    h('span', null, t('readingTitle'))),
                  h('div', { className: 'zp-msg-ai-body' },
                    h('div', { className: 'zp-md', dangerouslySetInnerHTML: { __html: renderChatMd(m.content) } })),
                  idx === lastAssistant && !streaming && m.content
                    ? h('div', { className: 'zp-msg-actions' },
                      h('button', { type: 'button', onClick: props.onCopyAnswer },
                        h(Icon, { name: props.copied ? 'check' : 'copy', size: 12 }),
                        props.copied ? t('aiCopied') : t('aiCopy')))
                    : null);
              }),
              streaming
                ? h('div', { className: 'zp-typing' },
                  h('i', null), h('i', null), h('i', null),
                  h('span', null, props.thinkChars
                    ? t('aiThinking') + '（' + props.thinkChars + ' 字）'
                    : t('interpStreaming')))
                : null),
          props.error ? h('div', { className: 'zp-error-card' },
            h('b', null, t('reportFailed')),
            h('div', null, props.error),
            props.issue && props.issue.canContinue
              ? h('button', { className: 'zp-pill is-small', type: 'button', style: { marginTop: 8 }, onClick: props.onContinue }, t('aiContinue'))
              : null) : null),
        h('div', { className: 'zp-composer' },
          h('textarea', {
            rows: 2, value: q, placeholder: t('readingAskPh'), 'aria-label': t('readingAskPh'),
            disabled: streaming,
            onChange: function (ev) { setQ(ev.target.value); },
            onKeyDown: function (ev) {
              if (ev.nativeEvent && ev.nativeEvent.isComposing) return;
              if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); submit(); }
            }
          }),
          streaming
            ? h('button', { className: 'zp-send zp-send-stop', type: 'button', title: t('aiStop'), 'aria-label': t('aiStop'), onClick: props.onStop },
              h(Icon, { name: 'stop', size: 15 }))
            : h('button', {
              className: 'zp-send', type: 'button', disabled: !q.trim() || props.reportRunning,
              title: t('aiSend'), 'aria-label': t('aiSend'), onClick: submit
            }, h(Icon, { name: 'send', size: 15 })),
          h('div', { className: 'zp-composer-foot' },
            h('span', null, t('readingHint')),
            h('span', { className: 'zp-grow' }),
            props.reportRunning ? h('span', null, t('reportGenerating')) : null)),
        h('div', { className: 'zp-disclaimer-inline' }, t('disclaimerShort')));
    }

    /* ================================================================
     * 解读页 · 报告工位
     * ================================================================ */
    function ReportDock(props) {
      var t = props.t;
      var report = props.report || { status: 'idle', text: '' };
      var running = report.status === 'running';
      var done = report.status === 'done' && report.text;
      var progress = reportProgress(report.text || '');
      var pct = done ? 100 : Math.min(96, Math.round(progress.sections / 14 * 100) + (running ? 4 : 0));
      var dots = [];
      for (var i = 0; i < 14; i++) {
        dots.push(h('i', { key: i, className: i < progress.sections ? 'is-done' : (i === progress.sections && running ? 'is-active' : '') }));
      }
      var body = null;
      if (running) {
        body = h('div', { className: 'zp-progress-card' },
          h('div', { className: 'zp-progress-head' },
            h('span', { className: 'zp-progress-title' }, h('span', { className: 'zp-shimmer' }, t('reportGenerating'))),
            h('span', { className: 'zp-progress-meta' }, t('reportSections').replace('{n}', String(progress.sections)) + ' · ' + t('reportChars').replace('{n}', String(progress.chars)))),
          h('div', { className: 'zp-progress-list' },
            h('div', { className: 'zp-progress-step is-active' },
              h('i', null, '·'),
              h('span', null, (progress.last || t('reportGenerating')))),
            h('div', { className: 'zp-progress-step is-done' },
              h('i', null, h(Icon, { name: 'check', size: 9 })),
              h('span', null, progress.sections
                ? t('reportSections').replace('{n}', String(progress.sections)) + ' · ' + t('reportChars').replace('{n}', String(progress.chars))
                : t('reportGenerating'))),
            h('div', { className: 'zp-progress-step' },
              h('i', null), h('span', null, t('reportHintFoot')))),
          h('div', { className: 'zp-progress-bar' }, h('span', { style: { width: pct + '%' } })),
          h('div', { className: 'zp-dock-dots' }, dots),
          h('div', { className: 'zp-report-actions' },
            h('button', { className: 'zp-pill', type: 'button', onClick: props.onStop }, t('reportStop'))));
      } else if (report.status === 'error') {
        body = h('div', { className: 'zp-error-card' },
          h('b', null, t('reportFailed')),
          h('div', null, report.error || ''),
          h('div', { className: 'zp-report-actions' },
            h('button', { className: 'zp-pill is-primary', type: 'button', onClick: props.onRetry }, t('reportRetry')),
            report.issue && report.issue.canContinue
              ? h('button', { className: 'zp-pill', type: 'button', onClick: props.onContinue }, t('reportContinue'))
              : null));
      } else if (done) {
        body = h('div', null,
          h('div', { className: 'zp-report-card' },
            h('div', { className: 'zp-report-card-head' },
              h('div', { className: 'zp-report-card-main' },
                h('div', { className: 'zp-report-title' }, t('reportName')),
                h('div', { className: 'zp-report-meta' },
                  [t('reportSections').replace('{n}', String(progress.sections)),
                    t('reportChars').replace('{n}', String(progress.chars)),
                    report.finishedAt ? fmtDateTime(report.finishedAt) : ''].filter(Boolean).join(' · '))),
              h('span', { className: 'zp-chart-card-tag is-saved' }, t('reportReady'))),
            h('div', { className: 'zp-report-actions' },
              h('button', { className: 'zp-pill is-primary', type: 'button', onClick: props.onRead },
                h(Icon, { name: 'expand', size: 14 }), t('reportRead')),
              h('button', { className: 'zp-pill', type: 'button', onClick: props.onExport },
                h(Icon, { name: 'export', size: 14 }), t('reportExport')),
              h('button', { className: 'zp-pill is-quiet', type: 'button', onClick: props.onCopy },
                h(Icon, { name: 'copy', size: 14 }), props.copied ? t('reportCopied') : t('reportCopy'))),
            h('div', { className: 'zp-report-excerpt' },
              h('div', { className: 'zp-md', dangerouslySetInnerHTML: { __html: renderChatMd(reportExcerpt(report.text)) } })),
            h('div', { className: 'zp-report-hint' }, t('reportHint')),
            h('button', { className: 'zp-link-btn', type: 'button', style: { marginTop: 8 }, disabled: props.chatRunning, onClick: props.onRetry }, t('reportRegenerate'))));
      } else {
        body = h('div', { className: 'zp-dock-empty' },
          h('div', { className: 'zp-dock-eyebrow' }, t('dockEyebrow')),
          h('div', { className: 'zp-dock-hero' }, t('dockIdleTitle')),
          h('p', { className: 'zp-dock-lead' }, t('dockIdleLead')),
          h('div', { className: 'zp-report-actions' },
            h('button', { className: 'zp-pill is-primary', type: 'button', disabled: props.chatRunning, onClick: props.onGenerate },
              h(Icon, { name: 'sparkle', size: 14 }), t('reportGenerate'))),
          h('ul', { className: 'zp-parts-list' },
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(function (n) {
              return h('li', { key: n }, h('span', null, String(n).padStart(2, '0')), t('reportPart' + n));
            })));
      }
      return h('section', { className: 'zp-reading-dock', 'data-region': 'REPORT_DOCK' },
        h('header', { className: 'zp-dock-head' },
          h('div', { className: 'zp-chat-head-main' },
            h('div', { className: 'zp-chat-title' }, t('dockTitle')),
            h('div', { className: 'zp-chat-ctx' }, t('dockMeta'))),
          done ? h('button', {
            className: 'zp-icon-btn', type: 'button', title: t('reportRead'), 'aria-label': t('reportRead'), onClick: props.onRead
          }, h(Icon, { name: 'expand' })) : null),
        h('div', { className: 'zp-dock-scroll' }, body));
    }

    /* ================================================================
     * 报告全屏阅读页
     * ================================================================ */
    function ReaderPage(props) {
      var t = props.t;
      var boxRef = useRef(null);
      var [full, setFull] = useState(false);
      useEffect(function () {
        var onChange = function () { setFull(!!(document.fullscreenElement && boxRef.current && document.fullscreenElement === boxRef.current)); };
        document.addEventListener('fullscreenchange', onChange);
        return function () { document.removeEventListener('fullscreenchange', onChange); };
      }, []);
      var toggleFull = function () {
        var el = boxRef.current;
        if (!el) return;
        try {
          if (document.fullscreenElement) { document.exitFullscreen && document.exitFullscreen(); return; }
          if (el.requestFullscreen) el.requestFullscreen().catch(function () { /* 宿主 webview 不支持时静默 */ });
        } catch (e) { /* ignore */ }
      };
      var progress = reportProgress(props.text);
      return h('div', { className: 'zp-reader', 'data-region': 'READER', ref: boxRef },
        h('header', { className: 'zp-reader-head' },
          h('button', { className: 'zp-pill is-quiet', type: 'button', onClick: props.onBack },
            h(Icon, { name: 'back', size: 14 }), t('readerBack')),
          h('div', { className: 'zp-chat-head-main' },
            h('div', { className: 'zp-reader-title' }, t('reportName')),
            h('div', { className: 'zp-reader-meta' },
              [props.name, t('reportChars').replace('{n}', String(progress.chars)),
                t('reportSections').replace('{n}', String(progress.sections)),
                props.finishedAt ? fmtDateTime(props.finishedAt) : ''].filter(Boolean).join(' · '))),
          h('div', { className: 'zp-reader-actions' },
            h('button', { className: 'zp-pill is-small', type: 'button', onClick: toggleFull },
              h(Icon, { name: full ? 'close' : 'expand', size: 13 }), full ? t('readerExitFull') : t('readerFull')),
            h('button', { className: 'zp-pill is-small', type: 'button', onClick: props.onExport },
              h(Icon, { name: 'export', size: 13 }), t('reportExport')),
            h('button', { className: 'zp-pill is-small', type: 'button', onClick: props.onCopy },
              h(Icon, { name: props.copied ? 'check' : 'copy', size: 13 }), props.copied ? t('reportCopied') : t('reportCopy')))),
        h('div', { className: 'zp-reader-body' },
          h('div', { className: 'zp-reader-paper' },
            h('iframe', {
              className: 'zp-reader-frame', srcDoc: props.html,
              title: t('reportName'), sandbox: 'allow-same-origin'
            }))));
    }

    /* ---------------- 设置：面板内居中弹层 ---------------- */
    function SettingsModal(props) {
      var t = props.t;
      var boxRef = useDialogFocus();
      var [update, setUpdate] = useState(null);
      var checkVersion = function () {
        if (update && update.checking) return;
        setUpdate({ checking: true });
        fetch('/ziwei/version', { method: 'GET', headers: { accept: 'application/json' } })
          .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
          .then(function (out) { setUpdate({ result: out.j || {} }); })
          .catch(function (e) { setUpdate({ error: String((e && e.message) || e) }); });
      };
      return h('div', { className: 'zp-overlay' },
        h('div', { className: 'zp-overlay-mask', onClick: props.onClose, 'aria-hidden': true }),
        h('div', { className: 'zp-overlay-center' },
          h('div', { className: 'zp-settings', role: 'dialog', 'data-region': 'MODAL', 'aria-modal': 'true', 'aria-label': t('settingsTitle'), tabIndex: -1,
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
              h('div', { className: 'zp-update' },
                h('div', { className: 'zp-update-row' },
                  h('span', null, t('versionLabel')),
                  h('b', null, APP_VERSION),
                  h('button', {
                    className: 'zp-mini-btn', type: 'button',
                    disabled: !!(update && update.checking),
                    onClick: checkVersion
                  }, update && update.checking ? t('checking') : t('checkUpdate'))),
                h('div', { className: 'zp-settings-hint' }, t('updateHint')),
                update && update.error
                  ? h('div', { className: 'zp-update-new' }, t('updateFailed').replace('{reason}', update.error))
                  : null,
                update && update.result && update.result.ok
                  ? (update.result.updateAvailable
                    ? h('div', null,
                      h('div', { className: 'zp-update-new' }, t('updateAvailable').replace('{latest}', update.result.latest || '?')),
                      h('code', { className: 'zp-update-cmd' }, 'dsh plugin --profile <profile> update dsh-ziwei'))
                    : h('div', { className: 'zp-update-ok' }, t('upToDate').replace('{version}', update.result.current || APP_VERSION)))
                  : null,
                update && update.result && !update.result.ok
                  ? h('div', { className: 'zp-update-new' }, t('updateFailed').replace('{reason}', update.result.reason || 'unknown'))
                  : null),
              h('div', { className: 'zp-settings-about' },
                h('b', null, t('about')),
                h('span', null, t('aboutText')))))));
    }

    /* ---------------- 主应用 ---------------- */
    function ProApp(props) {
      var t = props.t;
      var actions = props.actions;

      /* ---------- 表单 ---------- */
      var [form, setFormRaw] = useState(function () {
        var init = Object.assign({}, DEFAULT_FORM);
        try {
          var saved = JSON.parse(localStorage.getItem('ziwei-pro.form') || 'null');
          if (saved && typeof saved === 'object') {
            Object.keys(init).forEach(function (k) { if (saved[k] !== undefined) init[k] = saved[k]; });
            if (saved.settings && typeof saved.settings === 'object') init.settings = Object.assign({}, init.settings, saved.settings);
          }
        } catch (e) { /* ignore */ }
        try {
          if (!localStorage.getItem('ziwei-pro.formV133')) {
            if (init.settings && init.settings.monthDivide === 'normal') {
              init.settings = Object.assign({}, init.settings, { monthDivide: 'exact' });
              try { localStorage.setItem('ziwei-pro.form', JSON.stringify(init)); } catch (e) { /* ignore */ }
            }
            localStorage.setItem('ziwei-pro.formV133', '1');
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

      /* ---------- 命盘与视图 ---------- */
      var [chart, setChart] = useState(null);
      var [error, setError] = useState('');
      var [selected, setSelected] = useState(-1);
      var [tab, setTab] = useState('natal');
      var [selDecadal, setSelDecadal] = useState(0);
      var [yearlyYear, setYearlyYear] = useState(String(new Date().getFullYear()));
      var [view, setView] = useState('chart');
      var [panelW, setPanelW] = useState(0);

      /* ---------- 页面导航 ---------- */
      var [page, setPage] = useState('home');
      var chartInputRef = useRef(null); /* home | create | chart | reading | report */
      var [createFrom, setCreateFrom] = useState('home');
      var [readingTab, setReadingTab] = useState('chat');

      /* ---------- 命盘库 / 最近看过 ---------- */
      var [library, setLibrary] = useState(function () {
        try { return JSON.parse(localStorage.getItem('ziwei-pro.library') || '[]'); } catch (e) { return []; }
      });
      var [history, setHistory] = useState(function () {
        try {
          var raw = JSON.parse(localStorage.getItem('ziwei-pro.history') || '[]');
          return Array.isArray(raw) ? raw.filter(function (h) { return h && h.input; }) : [];
        } catch (e) { return []; }
      });

      /* ---------- 偏好 ---------- */
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

      /* ---------- 解读状态 ---------- */
      var [thread, setThread] = useState([]);
      var [chatting, setChatting] = useState(false);
      var [interpError, setInterpError] = useState('');
      var [interpIssue, setInterpIssue] = useState(null);
      var [thinkChars, setThinkChars] = useState(0);
      var [report, setReport] = useState({ status: 'idle', text: '', error: '', issue: null, startedAt: 0, finishedAt: 0 });
      var [copied, setCopied] = useState(false);
      var [reportCopied, setReportCopied] = useState(false);
      var [handoffDone, setHandoffDone] = useState(false);
      var [synced, setSynced] = useState(false);
      var [modal, setModal] = useState(null);
      var chatAbortRef = useRef(null);
      var reportAbortRef = useRef(null);
      var stopChatRef = useRef(false);
      var stopReportRef = useRef(false);
      var lastModeRef = useRef('brief');

      /* 面板宽度 → 三档布局 */
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

      var layoutMode = panelW <= 0 ? 'narrow' : (panelW >= 1100 ? 'wide' : (panelW >= 880 ? 'mid' : 'narrow'));

      /* 浮层 Esc */
      useEffect(function () {
        if (!modal) return undefined;
        var onEsc = function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); setModal(null); } };
        window.addEventListener('keydown', onEsc);
        return function () { window.removeEventListener('keydown', onEsc); };
      }, [modal]);

      /* 启动自动打开工作台 */
      useEffect(function () {
        if (!autoOpen) return undefined;
        var timer = setTimeout(function () { actions.autoOpenPanel(); }, 250);
        return function () { clearTimeout(timer); };
      }, []);

      /* ---------- 计算 / 持久化 ---------- */
      var computeChartFromInput = function (input) {
        return E.computeChart({
          calendar: input.calendar,
          year: +input.year, month: +input.month, day: +input.day,
          isLeapMonth: !!input.isLeap,
          hour: +input.hour, minute: +input.minute,
          gender: input.gender,
          longitude: (input.longitude === '' || input.longitude === null || input.longitude === undefined) ? undefined : +input.longitude,
          settings: input.settings
        });
      };
      var currentInput = function () { return cleanInput(form); };

      var persistHistory = function (next) {
        setHistory(next);
        try { localStorage.setItem('ziwei-pro.history', JSON.stringify(next)); } catch (e) { /* ignore */ }
      };
      var persistLibrary = function (next) {
        setLibrary(next);
        try { localStorage.setItem('ziwei-pro.library', JSON.stringify(next)); } catch (e) { /* ignore */ }
      };
      var recordHistory = function (input) {
        var key = inputKey(input);
        var now = Date.now();
        var next = [{ id: 'h-' + now, input: input, lastViewedAt: now }];
        history.forEach(function (h) {
          if (inputKey(h.input) !== key) next.push(h);
        });
        persistHistory(next.slice(0, 16));
      };

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

      var resetReading = function () {
        setThread([]);
        setChatting(false);
        setInterpError('');
        setInterpIssue(null);
        setThinkChars(0);
        setReport({ status: 'idle', text: '', error: '', issue: null, startedAt: 0, finishedAt: 0 });
        setReadingTab('chat');
      };

      var adoptChart = function (res, input) {
        /* E.computeChart 成功时直接返回命盘对象（错误时返回 {error}） */
        var chartObj = res.chart || res;
        chartInputRef.current = input;
        setChart(chartObj);
        setSelected(chartObj.soulIndex);
        setSelDecadal(currentDecadeIndex(chartObj));
        setYearlyYear(String(new Date().getFullYear()));
        setTab('natal');
        setView('chart');
        setError('');
        resetReading();
        recordHistory(input);
        setPage('chart');
      };

      var compute = function () {
        setError('');
        var input = currentInput();
        var result;
        try { result = computeChartFromInput(input); } catch (e) { setError(String((e && e.message) || e)); return; }
        if (!result || result.error) { setError((result && result.error) || '排盘失败'); return; }
        adoptChart(result, input);
      };

      var SAMPLE_FORM = {
        name: '示例命主', calendar: 'solar', year: 1992, month: 5, day: 3,
        isLeap: false, hour: 9, minute: 30, gender: 'male',
        longitude: 105.97, place: '成都', occupation: '',
        settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
      };
      var computeSample = function () {
        var input = cleanInput(SAMPLE_FORM);
        setFormRaw(function () { return Object.assign({}, DEFAULT_FORM, SAMPLE_FORM, { settings: Object.assign({}, DEFAULT_FORM.settings, SAMPLE_FORM.settings) }); });
        var result = computeChartFromInput(input);
        if (result && !result.error) adoptChart(result, input);
      };

      var openInput = function (input) {
        /* 同一张盘：保留当前解读/报告，直接回命盘页 */
        if (chart && chartInputRef.current && inputKey(chartInputRef.current) === inputKey(input)) {
          setPage('chart');
          return;
        }
        var result;
        try { result = computeChartFromInput(input); } catch (e) { setError(String((e && e.message) || e)); return; }
        if (!result || result.error) { setError((result && result.error) || '排盘失败'); return; }
        setFormRaw(Object.assign({}, DEFAULT_FORM, input, { settings: Object.assign({}, DEFAULT_FORM.settings, input.settings || {}) }));
        adoptChart(result, input);
      };

      /* ---------- 大限 / 流年 / 格局 ---------- */
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
      var scopeLabel = scope ? scope.label : '';

      /* ---------- 命盘库交互 ---------- */
      var libraryIndexOf = function (input) {
        var key = inputKey(input);
        for (var i = 0; i < library.length; i++) if (inputKey(library[i].input) === key) return i;
        return -1;
      };
      var toggleSaveInput = function (input, name) {
        var idx = libraryIndexOf(input);
        if (idx >= 0) {
          var next = library.slice(); next.splice(idx, 1); persistLibrary(next);
          return false;
        }
        var entry = { id: 'lib-' + Date.now(), name: (name || input.name || t('defaultName')).trim() || t('defaultName'), input: input };
        persistLibrary([entry].concat(library).slice(0, 60));
        return true;
      };
      var removeHistoryItem = function (item) {
        persistHistory(history.filter(function (h) { return inputKey(h.input) !== item.key; }));
      };

      var homeItems = useMemo(function () {
        var map = {};
        var list = [];
        var push = function (input, saved, libId, lastViewedAt) {
          var key = inputKey(input);
          if (map[key]) {
            var ex = map[key];
            ex.saved = ex.saved || saved;
            ex.libId = ex.libId || libId || null;
            ex.lastViewedAt = Math.max(ex.lastViewedAt || 0, lastViewedAt || 0);
            return;
          }
          var entry = { key: key, input: input, saved: !!saved, libId: libId || null, lastViewedAt: lastViewedAt || 0, name: input.name || '', chart: null };
          try {
            var r = computeChartFromInput(input);
            if (r && (r.chart || r.palaces)) entry.chart = r.chart || r;
          } catch (e) { /* 坏记录不渲染 */ }
          map[key] = entry;
          list.push(entry);
        };
        (history || []).forEach(function (h) { push(h.input, false, null, h.lastViewedAt); });
        (library || []).forEach(function (l) { push(l.input, true, l.id, 0); });
        list.sort(function (a, b) { return (b.lastViewedAt || 0) - (a.lastViewedAt || 0); });
        return list;
      }, [history, library]);

      /* ---------- 解读：上下文 ---------- */
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
        } catch (e) { /* 回退 */ }
        return E.chartText(chart);
      };
      var lastAssistant = function () {
        for (var i = thread.length - 1; i >= 0; i--) if (thread[i].role === 'assistant' && thread[i].content) return thread[i].content;
        return '';
      };

      /* ---------- 解读：流式通道 ---------- */
      var runStream = function (mode, question, target, opts) {
        opts = opts || {};
        if (!chart) return;
        var controller = null;
        try { controller = new AbortController(); } catch (e) { controller = null; }
        var abortRef = target === 'chat' ? chatAbortRef : reportAbortRef;
        var stopRef = target === 'chat' ? stopChatRef : stopReportRef;
        abortRef.current = controller;
        stopRef.current = false;
        var base = opts.base || '';
        if (target === 'chat') {
          setChatting(true);
          setInterpError('');
          setInterpIssue(null);
          setThinkChars(0);
        } else {
          setReport({ status: 'running', text: base, error: '', issue: null, startedAt: Date.now(), finishedAt: 0 });
        }
        var pos = nowPosition();
        var selectedDecade = (tab === 'decadal' && decadalList[selDecadal]) ? decadalList[selDecadal].ageRange : null;
        var body = {
          chartText: chartContextText(),
          mode: mode === 'report' ? 'report' : 'brief',
          question: (question || '').trim(),
          history: opts.history || [],
          meta: {
            name: form.name, place: form.place, occupation: form.occupation,
            gender: form.gender === 'female' ? 'female' : 'male',
            currentAge: pos.currentAge, currentYear: pos.currentYear,
            decadalFocus: selectedDecade,
            yearlyFocus: (tab === 'yearly') ? (parseInt(yearlyYear, 10) || pos.currentYear) : null
          }
        };
        var settled = false, gotDone = false, gotError = false, produced = '', finalText = base;
        var finish = function (errMsg, issue) {
          if (settled) return;
          settled = true;
          abortRef.current = null;
          setThinkChars(0);
          if (target === 'chat') {
            setChatting(false);
            setInterpError(errMsg || '');
            setInterpIssue(issue || null);
            if (!errMsg) lastModeRef.current = 'brief';
          } else {
            setReport(function (prev) {
              return Object.assign({}, prev, {
                status: errMsg ? 'error' : 'done',
                text: finalText || prev.text,
                error: errMsg || '',
                issue: issue || null,
                finishedAt: Date.now()
              });
            });
            if (!errMsg) lastModeRef.current = 'report';
          }
        };
        var appendDelta = function (delta) {
          produced += delta;
          finalText = base + produced;
          if (target === 'chat') {
            setThread(function (prev) {
              if (!prev.length) return prev;
              var copy = prev.slice();
              var last = copy[copy.length - 1];
              if (!last || last.role !== 'assistant') return prev;
              copy[copy.length - 1] = { role: 'assistant', content: finalText };
              return copy;
            });
          } else {
            setReport(function (prev) { return Object.assign({}, prev, { text: finalText }); });
          }
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
          var reader = resp.body.getReader();
          var decoder = new TextDecoder();
          var buf = '';
          var pump = function () {
            return reader.read().then(function (chunk) {
              if (chunk.done) {
                if (!gotDone && !gotError) finish(t('aiDisconnected'), { kind: 'stream-closed', canContinue: !!produced.trim() });
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
                else if (ev === 'delta' && payload && payload.text) { setThinkChars(0); appendDelta(payload.text); }
                else if (ev === 'done') {
                  gotDone = true;
                  if (payload && typeof payload.text === 'string' && payload.text) {
                    produced = payload.text;
                    finalText = base + produced;
                    if (target === 'chat') {
                      setThread(function (prev) {
                        if (!prev.length) return prev;
                        var copy = prev.slice();
                        copy[copy.length - 1] = { role: 'assistant', content: payload.text };
                        return copy;
                      });
                    }
                  }
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
            if (stopRef.current) finish(t('aiStopped'), { kind: 'stopped', canContinue: !!produced.trim() });
            else finish('');
            return;
          }
          finish(String((e && e.message) || e), { kind: 'error', canContinue: !!produced.trim() });
        });
      };

      var runChat = function (question) {
        if (!chart || chatting || report.status === 'running') return;
        var asked = (question || '').trim();
        if (!asked) return;
        var history = thread.map(function (m) { return { role: m.role, content: m.content }; });
        setThread(thread.concat([{ role: 'user', content: asked }, { role: 'assistant', content: '' }]));
        runStream('brief', asked, 'chat', { history: history });
      };
      var continueChat = function () {
        if (!chart || chatting) return;
        var history = thread.map(function (m) { return { role: m.role, content: m.content }; });
        setThread(thread.concat([{ role: 'assistant', content: '' }]));
        runStream('brief', t('aiContinuePrompt'), 'chat', { history: history });
      };
      var stopChat = function () {
        if (!chatAbortRef.current) return;
        stopChatRef.current = true;
        try { chatAbortRef.current.abort(); } catch (e) { /* ignore */ }
      };
      var newChat = function () {
        if (chatting) return;
        setThread([]);
        setInterpError('');
        setInterpIssue(null);
      };

      var generateReport = function () {
        if (!chart || report.status === 'running' || chatting) return;
        setReadingTab('dock');
        runStream('report', '', 'report', { history: [] });
      };
      var regenerateReport = function () {
        if (!chart || report.status === 'running' || chatting) return;
        setReadingTab('dock');
        runStream('report', '', 'report', { history: [] });
      };
      var stopReport = function () {
        if (!reportAbortRef.current) return;
        stopReportRef.current = true;
        try { reportAbortRef.current.abort(); } catch (e) { /* ignore */ }
      };
      var continueReport = function () {
        if (!chart || report.status === 'running') return;
        var base = report.text || '';
        var hist = base ? [{ role: 'assistant', content: base }] : [];
        runStream('report', t('aiContinuePrompt'), 'report', { history: hist, base: base });
      };

      var reportMeta = function () {
        return { chart: chart, name: form.name, place: form.place, occupation: form.occupation, gender: form.gender === 'female' ? 'female' : 'male' };
      };
      var reportHtml = useMemo(function () {
        if (!chart || !report.text) return '';
        try { return actions.buildReportHtml(reportMeta(), report.text); } catch (e) { return ''; }
      }, [chart, report.text, form]);

      var copyReport = function () {
        if (!report.text) return;
        setReportCopied(true);
        setTimeout(function () { setReportCopied(false); }, 1600);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(report.text).catch(function () { /* ignore */ });
        } catch (e) { /* ignore */ }
      };
      var exportReportHtml = function () {
        if (!report.text) return;
        try {
          var html = actions.buildReportHtml(reportMeta(), report.text);
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
          setReport(function (prev) { return Object.assign({}, prev, { error: '导出失败: ' + String((e && e.message) || e) }); });
        }
      };
      var copyAnswer = function () {
        var text = lastAssistant();
        if (!text) return;
        setCopied(true);
        setTimeout(function () { setCopied(false); }, 1600);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(function () { /* ignore */ });
        } catch (e) { /* ignore */ }
      };

      /* 复制命盘 / 写入会话 / 交给会话 */
      var copyChart = function () {
        if (!chart) return;
        setCopied(true);
        setTimeout(function () { setCopied(false); }, 1600);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(E.chartText(chart)).catch(function () { /* ignore */ });
        } catch (e) { /* ignore */ }
      };
      var syncToSession = function () {
        if (!chart) return;
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
      var handoffToSession = function () {
        if (!chart || chatting || report.status === 'running') return;
        setInterpError('');
        setHandoffDone(false);
        var answer = report.text || lastAssistant();
        var mode = report.text ? 'report' : 'brief';
        fetch('/ziwei/handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chartText: E.chartText(chart),
            fullText: chartContextText(),
            name: form.name || '', place: form.place || '', occupation: form.occupation || '',
            gender: form.gender === 'female' ? 'female' : 'male',
            interpretation: answer,
            mode: mode
          })
        }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
          .then(function (out) {
            var j = out.j || {};
            if (j.ok && j.sessionId) {
              setHandoffDone(true);
              setTimeout(function () { setHandoffDone(false); }, 3000);
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
          .catch(function (e) { setInterpError(String((e && e.message) || e)); });
      };

      /* ---------- 页面导航 ---------- */
      var go = function (id) {
        if ((id === 'chart' || id === 'reading') && !chart) { setCreateFrom('home'); setPage('create'); return; }
        if (id === 'report' && !(report.status === 'done' && report.text)) { setPage('reading'); return; }
        setPage(id);
      };
      var openCreate = function (from) {
        setError('');
        setCreateFrom(from || 'home');
        setPage('create');
      };
      var backFromCreate = function () {
        if (createFrom === 'chart' && chart) {
          if (chartInputRef.current) {
            setFormRaw(Object.assign({}, DEFAULT_FORM, chartInputRef.current, {
              settings: Object.assign({}, DEFAULT_FORM.settings, chartInputRef.current.settings || {})
            }));
          }
          setPage('chart');
          return;
        }
        setPage('home');
      };

      /* ---------- 命盘操作 ---------- */
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
      var onStageKeyDown = function (ev) {
        if (!chart || modal || page !== 'chart' || view !== 'chart') return;
        var target = ev.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'left'); }); }
        else if (ev.key === 'ArrowRight') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'right'); }); }
        else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'opp'); }); }
      };

      /* ---------- 渲染：顶栏 ---------- */
      var navItems = [
        { id: 'home', label: t('navHome'), icon: 'home' },
        { id: 'chart', label: t('navChart'), icon: 'chart', disabled: !chart },
        { id: 'reading', label: t('navReading'), icon: 'sparkle', disabled: !chart },
        { id: 'report', label: t('navReport'), icon: 'report', hidden: !(report.status === 'done' && report.text) }
      ];
      var topAction = null;
      var topCtx = chart ? h('span', { className: 'zp-top-ctx' },
        h('b', null, form.name || t('defaultName')), ' · ', chart.fiveElementsClass, ' · ', form.gender === 'female' ? t('female') : t('male')) : null;
      var topbar = h('header', { className: 'zp-topbar', 'data-region': 'HEAD' },
        h('button', { className: 'zp-brand', type: 'button', onClick: function () { go('home'); }, title: t('navHome'), 'aria-label': t('navHome') },
          h('span', { className: 'zp-brand-mark' },
            h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true },
              h('circle', { cx: 12, cy: 12, r: 10, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, opacity: .5 }),
              h('path', { d: 'M12 2a10 10 0 0 1 0 20 5 5 0 0 1 0-10 5 5 0 0 0 0-10z', fill: 'currentColor' }))),
          h('span', { className: 'zp-brand-name' }, t('brand')),
          h('span', { className: 'zp-brand-pro' }, t('brandPro'))),
        h('nav', { className: 'zp-nav', 'aria-label': t('navLabel') },
          navItems.filter(function (n) { return !n.hidden; }).map(function (n) {
            return h('button', {
              key: n.id, type: 'button', className: page === n.id ? 'is-on' : undefined,
              'aria-current': page === n.id ? 'page' : undefined,
              disabled: !!n.disabled, title: n.disabled ? t('navNeedChart') : n.label,
              onClick: function () { go(n.id); }
            }, n.label);
          })),
        h('span', { className: 'zp-top-spacer' }),
        topCtx,
        h('div', { className: 'zp-top-actions' },
          topAction,
          actions.canReturnToConversation ? h('button', {
            className: 'zp-icon-btn zp-exit', type: 'button',
            title: t('backToConversation'), 'aria-label': t('backToConversation'),
            onClick: function () { actions.returnToConversation(); }
          }, h(Icon, { name: 'back' })) : null,
          h('button', {
            className: 'zp-icon-btn', type: 'button', title: t('settingsTitle'), 'aria-label': t('settingsTitle'),
            'aria-pressed': modal === 'settings' ? 'true' : 'false',
            onClick: function () { setModal(modal === 'settings' ? null : 'settings'); }
          }, h(Icon, { name: 'settings' }))));
      var ambient = h('div', { className: 'zp-ambient', 'aria-hidden': true }, h('i', null), h('i', null));

      /* ---------- 渲染：首页 ---------- */
      var renderHome = function () {
        var savedCount = library.length;
        var recentCount = history.length;
        var last = homeItems.filter(function (x) { return x.lastViewedAt; })[0];
        var stats = [];
        stats.push(h('span', { key: 's' }, h('b', null, String(savedCount)), ' ' + t('homeStatSavedBare')));
        stats.push(h('span', { key: 'r' }, h('b', null, String(recentCount)), ' ' + t('homeStatRecentBare')));
        if (last) stats.push(h('span', { key: 'l' }, t('homeStatLast').replace('{name}', last.name || t('defaultName')).replace('{time}', relTime(t, last.lastViewedAt))));
        return h('div', { className: 'zp-page', 'data-region': 'HOME' },
          h('div', { className: 'zp-page-inner' },
            h('section', { className: 'zp-home-hero' },
              h('div', { className: 'zp-hero-eyebrow' }, h(Icon, { name: 'sparkle', size: 13 }), t('homeEyebrow')),
              h('h1', { className: 'zp-hero-title' }, t('homeTitleA'), h('b', null, t('homeTitleB'))),
              h('div', { className: 'zp-hero-stats' }, stats),
              h('div', { className: 'zp-hero-actions' },
                h('button', { className: 'zp-pill is-primary', type: 'button', onClick: function () { openCreate('home'); } },
                  h(Icon, { name: 'newChat', size: 14 }), t('homeNew')),
                h('button', { className: 'zp-pill', type: 'button', onClick: computeSample },
                  h(Icon, { name: 'sparkle', size: 14 }), t('homeSample')))),
            homeItems.length
              ? h('div', null,
                h('div', { className: 'zp-section-head' },
                  h('h2', { className: 'zp-section-title' }, t('homeRecentTitle')),
                  h('span', { className: 'zp-section-meta' }, t('homeRecentMeta'))),
                h('div', { className: 'zp-chart-grid' },
                  homeItems.map(function (item) {
                    return h(ChartCard, {
                      key: item.key, t: t, item: item,
                      onOpen: function (it) { openInput(it.input); },
                      onToggleSave: function (it) {
                        if (it.saved && it.libId) persistLibrary(library.filter(function (x) { return x.id !== it.libId; }));
                        else toggleSaveInput(it.input, it.name || it.input.name);
                      },
                      onRemove: function (it) { removeHistoryItem(it); }
                    });
                  }),
                  h('button', { className: 'zp-chart-card-add', type: 'button', onClick: function () { openCreate('home'); } },
                    h(Icon, { name: 'newChat', size: 18 }), h('b', null, t('homeCardNew')))))
              : h('div', { style: { marginTop: 32 } },
                h('div', { className: 'zp-empty' },
                  h('div', { className: 'zp-empty-title' }, t('homeEmptyTitle')),
                  h('div', { className: 'zp-empty-hint' }, t('homeEmptyHint')),
                  h('div', { style: { marginTop: 16 } },
                    h('button', { className: 'zp-pill is-primary', type: 'button', onClick: function () { openCreate('home'); } },
                      h(Icon, { name: 'newChat', size: 14 }), t('homeNew')))))));
      };

      /* ---------- 渲染：新建命盘 ---------- */
      var renderCreate = function () {
        var items = [];
        [1, 2, 3, 4, 5].forEach(function (n) { items.push(h('li', { key: n }, h('span', null, '0' + n), t('createWhat' + n))); });
        return h('div', { className: 'zp-page', 'data-region': 'CREATE' },
          h('div', { className: 'zp-page-inner' },
            h('div', { className: 'zp-page-head is-stack' },
              h('button', { className: 'zp-icon-btn', type: 'button', title: t('readerBack'), 'aria-label': t('readerBack'), onClick: backFromCreate },
                h(Icon, { name: 'back' })),
              h('div', null,
                h('h1', { className: 'zp-page-title' }, createFrom === 'chart' ? t('chartEdit') : t('createTitle')),
                h('p', { className: 'zp-page-sub' }, t('createSub')))),
            h('div', { className: 'zp-create-grid' },
              h(BirthForm, {
                t: t, form: form, setForm: setForm, error: error,
                onSubmit: compute, onSample: computeSample,
                submitLabel: createFrom === 'chart' ? t('createSubmitEdit') : t('createSubmit')
              }),
              h('div', { className: 'zp-create-aside' },
                h('div', { className: 'zp-card' },
                  h('div', { className: 'zp-card-title' }, t('createWhat')),
                  h('ul', { className: 'zp-parts-list' }, items)),
                h('div', { className: 'zp-card' },
                  h('div', { className: 'zp-card-title' }, t('createAsideTitle')),
                  h('div', { className: 'zp-aside-note' },
                    h('div', null, t('note1')),
                    h('div', { style: { marginTop: 6 } }, t('note2'))))))));
      };

      /* ---------- 渲染：命盘页 ---------- */
      var renderChart = function () {
        if (!chart) return null;
        var palaceSelected = selected >= 0 ? chart.palaces[selected] : null;
        var curAge = nowPosition().currentAge;
        var currentDecadalIdx = -1;
        for (var ci = 0; ci < decadalList.length; ci++) {
          if (curAge >= decadalList[ci].ageRange[0] && curAge <= decadalList[ci].ageRange[1]) { currentDecadalIdx = ci; break; }
        }
        var timeNav = null;
        if (view === 'chart' && tab === 'decadal' && decadalList.length) {
          timeNav = h('div', { className: 'zp-time-nav', role: 'group', 'aria-label': t('tabDecadal') },
            h('button', { className: 'zp-time-btn', type: 'button', title: t('prevDecade'), 'aria-label': t('prevDecade'), disabled: selDecadal <= 0, onClick: function () { stepDecade(-1); } }, '‹'),
            h('select', {
              className: 'zp-time-select', value: String(selDecadal), 'aria-label': t('tabDecadal'),
              onChange: function (ev) { setSelDecadal(parseInt(ev.target.value, 10) || 0); }
            }, decadalList.map(function (dd, i) {
              return h('option', { key: i, value: String(i) }, dd.ageRange[0] + '–' + dd.ageRange[1] + ' 岁 · ' + dd.stem + dd.branch + ' · ' + dd.palaceName);
            })),
            h('button', { className: 'zp-time-btn', type: 'button', title: t('nextDecade'), 'aria-label': t('nextDecade'), disabled: selDecadal >= decadalList.length - 1, onClick: function () { stepDecade(1); } }, '›'),
            currentDecadalIdx >= 0 && selDecadal !== currentDecadalIdx
              ? h('button', { className: 'zp-time-now', type: 'button', title: t('backToCurrent'), onClick: function () { setSelDecadal(currentDecadalIdx); } }, t('backToCurrent'))
              : (currentDecadalIdx >= 0 ? h('span', { className: 'zp-time-chip' }, t('currentBadge')) : null));
        } else if (view === 'chart' && tab === 'yearly') {
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
        var timebar = h('div', { className: 'zp-timebar', 'data-region': 'TIMEBAR' },
          view === 'chart'
            ? h('div', { className: 'zp-tabs', role: 'tablist', 'aria-label': t('timeScope') },
              [['natal', t('tabNatal')], ['decadal', t('tabDecadal')], ['yearly', t('tabYearly')]].map(function (md) {
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
              className: 'zp-tool-btn' + (showAdj ? ' on' : ''), type: 'button', 'aria-pressed': !!showAdj,
              title: showAdj ? t('hideAdj') : t('showAdj'), onClick: function () { setShowAdj(!showAdj); }
            }, h(Icon, { name: 'adj', size: 12 }), t('adjChip')) : null));
        var genderCn = (function () {
          var yearStem = (chart.pillars && chart.pillars.yearly) ? String(chart.pillars.yearly).charAt(0) : '甲';
          var yang = '甲丙戊庚壬'.indexOf(yearStem) >= 0;
          return (yang ? '阳' : '阴') + (form.gender === 'female' ? '女' : '男');
        })();
        var hero = h('section', { className: 'zp-chart-hero' },
          h('div', { className: 'zp-chart-id' },
            h('div', { className: 'zp-chart-eyebrow' }, t('tabNatal') + ' · ' + chart.fiveElementsClass + ' · ' + genderCn),
            h('h1', { className: 'zp-chart-title' }, form.name || t('defaultName'),
              h('small', null, chart.zodiac + '年 · ' + chart.timeName)),
            h('div', { className: 'zp-chart-meta' },
              h('span', { className: 'zp-chip' }, h('b', null, t('solarLabel')), ' ', chart.solarDate),
              h('span', { className: 'zp-chip' }, h('b', null, t('lunarLabel')), ' ', chart.lunar.year + '年' + chart.lunarText),
              [chart.pillars.yearly, chart.pillars.monthly, chart.pillars.daily, chart.pillars.hourly].map(function (pz, i) {
                return h('span', { key: 'p' + i, className: 'zp-chip is-gold' }, h('b', null, pz));
              }),
              h('span', { className: 'zp-chip' }, h('b', null, t('soul') + '/' + t('body')), ' ', chart.soulBranch + ' / ' + chart.bodyBranch),
              h('span', { className: 'zp-chip' }, h('b', null, t('startAge')), ' ', chart.startAge + ' 岁'))),
          h('div', { className: 'zp-chart-actions' },
            h('button', { className: 'zp-pill is-primary', type: 'button', onClick: function () { go('reading'); } },
              h(Icon, { name: 'sparkle', size: 14 }), t('chartInterpret')),
            h('button', { className: 'zp-pill', type: 'button', onClick: function () { toggleSaveInput(currentInput(), form.name); } },
              h(Icon, { name: 'star', size: 14 }), libraryIndexOf(currentInput()) >= 0 ? t('chartSaved') : t('chartSave')),
            h('button', { className: 'zp-pill is-quiet', type: 'button', onClick: function () { openCreate('chart'); } },
              h(Icon, { name: 'adj', size: 13 }), t('chartEdit')),
            h('button', { className: 'zp-icon-btn', type: 'button', title: t('copy'), 'aria-label': t('copy'), onClick: copyChart }, h(Icon, { name: 'copy' })),
            h('button', { className: 'zp-icon-btn', type: 'button', title: t('syncHint'), 'aria-label': t('sync'), onClick: syncToSession }, h(Icon, { name: 'sync' }))));
        var board = null;
        if (view === 'chart' && !(tab === 'yearly' && yearlyChart && yearlyChart.error)) {
          board = h('div', { className: 'zp-chart-board', tabIndex: 0, onKeyDown: onStageKeyDown },
            h('div', { className: 'zp-board-wrap' + (palaceSelected && tab === 'natal' ? ' has-detail' : ''), 'data-region': 'BOARD' },
              h('div', { className: 'zp-board' },
                h('div', { className: 'zp-grid' },
                  [3, 4, 5, 6, 2, 7, 1, 8, 0, 11, 10, 9].map(function (idx) {
                    return h(PalaceCell, {
                      key: idx,
                      palace: Object.assign({}, chart.palaces[idx], { isSoul: idx === chart.soulIndex }),
                      chart: chart, selected: selected === idx,
                      onSelect: function () { setSelected(idx); },
                      t: t, showAdj: showAdj, scope: scope, scopeBadges: scopeBadges
                    });
                  }),
                  h(CenterCell, { chart: chart, t: t, name: form.name }))),
              palaceSelected && tab === 'natal' ? h(PalaceDetail, {
                chart: chart,
                palace: Object.assign({}, palaceSelected, { isSoul: selected === chart.soulIndex }),
                t: t, onSelect: setSelected
              }) : null),
            palaceSelected && tab === 'decadal' ? h('div', { className: 'zp-kbd-hint' }, t('keyboardHint')) : null);
        }
        if (tab === 'yearly' && yearlyChart && yearlyChart.error) {
          board = h('div', { className: 'zp-error', style: { marginBottom: 12 } }, yearlyChart.error);
        }
        var toolpage = null;
        if (view === 'patterns') toolpage = h(PatternsView, { patterns: patterns, t: t });
        if (view === 'dict') toolpage = h(DictView, { t: t });
        return h('div', { className: 'zp-page', 'data-region': 'CHART' },
          h('div', { className: 'zp-page-inner' },
            hero,
            timebar,
            board,
            toolpage,
            view === 'chart' ? h('div', { className: 'zp-chart-info' },
              h(Summary, { chart: chart, t: t }),
              h(PatternsSummary, { patterns: patterns, t: t, onOpen: function () { setView('patterns'); } })) : null));
      };

      /* ---------- 渲染：解读页 ---------- */
      var renderReading = function () {
        if (!chart) return null;
        var ctxLine = scopeLabel ? ('当前视角 · ' + scopeLabel) : t('readingCtxIn');
        var tabs = h('div', { className: 'zp-reading-tabs' },
          h(Seg, {
            value: readingTab,
            options: [
              { value: 'chat', label: t('readingTabChat') },
              { value: 'dock', label: t('readingTabDock') + (report.status === 'done' ? ' ·' : '') }
            ],
            onChange: setReadingTab
          }));
        return h('div', { className: 'zp-reading', 'data-tab': readingTab },
          tabs,
          h(ChatPane, {
            t: t, thread: thread, streaming: chatting, thinkChars: thinkChars,
            error: interpError, issue: interpIssue,
            ctxLine: ctxLine,
            copied: copied,
            onBack: function () { go('chart'); },
            onHandoff: handoffToSession,
            onNewChat: newChat,
            onAsk: runChat,
            onStop: stopChat,
            onContinue: continueChat,
            onCopyAnswer: copyAnswer,
            onGenerateReport: generateReport,
            reportRunning: report.status === 'running',
            chatRunning: chatting
          }),
          h(ReportDock, {
            t: t, report: report, copied: reportCopied,
            chatRunning: chatting,
            onGenerate: generateReport,
            onStop: stopReport,
            onContinue: continueReport,
            onRetry: regenerateReport,
            onRead: function () { setPage('report'); },
            onExport: exportReportHtml,
            onCopy: copyReport
          }));
      };

      /* ---------- 渲染：报告阅读页 ---------- */
      var renderReport = function () {
        if (!(report.status === 'done' && report.text && reportHtml)) {
          return h('div', { className: 'zp-page', 'data-region': 'READER' },
            h('div', { className: 'zp-page-inner' },
              h('div', { className: 'zp-empty', style: { marginTop: 40 } },
                h('div', { className: 'zp-empty-title' }, t('reportEmpty')),
                h('div', { className: 'zp-empty-hint' }, t('dockIdleLead')),
                h('div', { style: { marginTop: 16 } },
                  h('button', { className: 'zp-pill is-primary', type: 'button', onClick: function () { setPage('reading'); } }, t('readerBack'))))));
        }
        return h(ReaderPage, {
          t: t, html: reportHtml, text: report.text,
          name: form.name || t('defaultName'),
          finishedAt: report.finishedAt,
          copied: reportCopied,
          onBack: function () { setPage('reading'); },
          onExport: exportReportHtml,
          onCopy: copyReport
        });
      };

      var body = null;
      if (page === 'home') body = renderHome();
      else if (page === 'create') body = renderCreate();
      else if (page === 'chart') body = renderChart();
      else if (page === 'reading') body = renderReading();
      else if (page === 'report') body = renderReport();
      else body = renderHome();

      return h('div', {
        className: 'zp-root', ref: rootRef,
        'data-w': layoutMode,
        'data-page': page,
        'data-chart': chart ? '1' : undefined
      },
        ambient,
        topbar,
        body,
        modal === 'settings' ? h(SettingsModal, {
          t: t,
          autoOpen: autoOpen, setAutoOpen: setAutoOpen,
          showAdj: showAdj, setShowAdj: setShowAdj,
          onClose: function () { setModal(null); }
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
        var REPORT_CSS = ":root{--bg:#FAF6EF;--bg-card:#F4EFE5;--text:#2A2A2A;--text-sub:#666;--accent:#7C5C3C;--accent-lt:#9C6B47;--accent-dim:#C4A882;--border:#E8DDC8;--warn:#B85A3D;--white:#FEFCF8;--font-serif:\"Songti SC\",\"STSong\",\"Source Han Serif CN\",\"Noto Serif CJK SC\",Georgia,serif;--font-sans:\"PingFang SC\",\"Hiragino Sans GB\",\"Microsoft YaHei\",system-ui,sans-serif}@page{size:A4;margin:18mm 22mm}body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-serif);font-size:11pt;line-height:1.9}.page-wrap{max-width:210mm;margin:0 auto;padding:14mm 16mm}h1,h2,h3{font-family:var(--font-sans);color:var(--accent);font-weight:600}h2{font-size:15pt;border-bottom:1px solid var(--accent-dim);padding-bottom:.3em;margin-top:2em}h3{font-size:12.5pt;margin-top:1.4em}.body-text{text-indent:2em;text-align:justify}.quote-block{margin:1em 0;padding:.6em 1em;border-left:3px solid var(--accent-dim);background:var(--bg-card);color:var(--text-sub)}.highlight-box{margin:1em 0;padding:.8em 1em;background:var(--bg-card);border-left:4px solid var(--accent)}.warn-block{margin:1em 0;padding:.8em 1em;border:1px solid var(--warn);border-left:4px solid var(--warn);color:#7A3A24}.kw{display:inline-block;padding:0 .45em;margin:0 .1em;background:var(--accent);color:var(--white);font-size:.82em;border-radius:2px;font-family:var(--font-sans)}.palace-card{margin:.8em 0;padding:.8em 1em;background:var(--white);border:1px solid var(--border);border-radius:4px}.p-palace-name{font-family:var(--font-sans);color:var(--accent);font-weight:600}.p-stars{margin:.2em 0;color:var(--accent-lt)}.p-note{font-size:.85em;color:var(--text-sub)}.info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.6em;margin:1em 0}.info-cell{background:var(--white);border:1px solid var(--border);padding:.5em .7em;font-size:.95em}.info-cell span{display:block;color:var(--text-sub);font-size:.8em;font-family:var(--font-sans)}.pc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:var(--accent-dim);border:2px solid var(--accent);margin:1.5em 0}.pc-cell{background:var(--white);padding:.5em;min-height:4.2em;font-size:.9em}.pc-center{grid-column:2/4;grid-row:2/4;background:var(--bg-card);padding:1em;text-align:center;font-size:.95em}.p-ganzhi{color:var(--text-sub);font-size:.8em}.p-sihua{display:inline-block;font-size:.75em;color:var(--warn);border:1px solid var(--warn);padding:0 .3em;border-radius:50%;margin-left:.25em}.path-steps{display:flex;gap:.8em;margin:1em 0}.path-step{flex:1;background:var(--white);border:1px solid var(--accent-dim);border-top:3px solid var(--accent);padding:.7em;font-size:.9em}.cover{background:var(--accent);color:var(--white);text-align:center;padding:52mm 0 12mm;margin:-14mm -16mm 10mm}.p-center-title{font-family:var(--font-sans);font-size:34pt;letter-spacing:.35em;text-indent:.35em}.p-center-sub{margin-top:1.2em;color:var(--accent-dim);letter-spacing:.2em}.cover-band{margin-top:20mm;font-size:10pt;color:var(--bg-card)}.disclaimer{margin-top:2em;padding:.8em 1em;background:#EEE9DE;color:var(--text-sub);font-size:.9em}.colophon{margin-top:3em;text-align:center;color:var(--text-sub);font-size:.85em}.seal{display:inline-block;border:2px solid var(--warn);color:var(--warn);padding:.3em .5em;font-family:var(--font-sans);letter-spacing:.15em;transform:rotate(-4deg)}h4{font-family:var(--font-sans);color:var(--accent);font-weight:600;font-size:11.5pt;margin-top:1.4em}.md-table{width:100%;border-collapse:collapse;margin:1.1em 0;font-size:10.5pt;line-height:1.65}.md-table th,.md-table td{border:1px solid var(--border);padding:.45em .6em;vertical-align:top;text-align:left;word-break:break-word}.md-table th{background:var(--bg-card);font-family:var(--font-sans);font-weight:600;color:var(--accent)}.md-table tr{page-break-inside:avoid;break-inside:avoid}hr{border:none;border-top:1px solid var(--accent-dim);margin:1.8em 0}h2,h3,h4{page-break-after:avoid;break-after:avoid}.pc-grid,.info-grid{page-break-inside:avoid;break-inside:avoid}ul,ol{margin:.8em 0;padding-left:1.8em}li{margin:.3em 0}code{padding:.1em .35em;background:var(--bg-card);border-radius:2px;font-family:var(--font-sans);font-size:.92em}";
        var escHtml = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        /* 报告正文的极小 markdown：标题 / 加粗 / 引用 / 列表 / 管道表格 / 分隔线 / 段落。
           先转义再上标记；只放行 <br>，其它 HTML 不允许直通。 */
        var mdInline = function (t) {
          return escHtml(t)
            .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
        };
        var mdSplitRow = function (line) {
          var s = String(line).trim();
          if (s.charAt(0) === '|') s = s.slice(1);
          if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1);
          return s.split('|').map(function (c) { return c.trim(); });
        };
        var mdIsTableSep = function (line) {
          if (String(line).indexOf('|') < 0) return false;
          var cells = mdSplitRow(line);
          if (!cells.length) return false;
          for (var i = 0; i < cells.length; i++) {
            if (!/^:?-{1,}:?$/.test(cells[i])) return false;
          }
          return true;
        };
        var mdAlignOf = function (cell) {
          var left = cell.charAt(0) === ':';
          var right = cell.charAt(cell.length - 1) === ':';
          if (left && right) return 'center';
          if (right) return 'right';
          if (left) return 'left';
          return '';
        };
        var mdTableHtml = function (header, aligns, rows, cls) {
          var th = header.map(function (c, i) {
            return '<th' + (aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '') + '>' + mdInline(c) + '</th>';
          }).join('');
          var body = rows.map(function (row) {
            var tds = [];
            for (var i = 0; i < header.length; i++) {
              tds.push('<td' + (aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '') + '>' + mdInline(row[i] || '') + '</td>');
            }
            return '<tr>' + tds.join('') + '</tr>';
          }).join('');
          return '<table class="' + (cls || 'md-table') + '"><thead><tr>' + th + '</tr></thead>' +
            (body ? '<tbody>' + body + '</tbody>' : '') + '</table>';
        };
        var mdToHtml = function (md) {
          var lines = String(md || '').split('\n');
          var out = [];
          var inList = null;
          var flush = function () { if (inList) { out.push('</' + inList + '>'); inList = null; } };
          for (var i = 0; i < lines.length; i++) {
            var trimmed = lines[i].trim();
            if (!trimmed) { flush(); continue; }
            /* 管道表格：当前行以 | 开头、下一行是分隔行；行数按表头列数收口 */
            if (trimmed.charAt(0) === '|' && i + 1 < lines.length && mdIsTableSep(lines[i + 1])) {
              flush();
              var header = mdSplitRow(trimmed);
              var aligns = mdSplitRow(lines[i + 1]).map(mdAlignOf);
              var rows = [];
              var j = i + 2;
              while (j < lines.length && lines[j].trim().charAt(0) === '|' && !mdIsTableSep(lines[j])) {
                rows.push(mdSplitRow(lines[j]));
                j++;
              }
              out.push(mdTableHtml(header, aligns, rows));
              i = j - 1;
              continue;
            }
            var h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
            if (h) { flush(); var lv = Math.min(4, h[1].length + 1); out.push('<h' + lv + '>' + mdInline(h[2]) + '</h' + lv + '>'); continue; }
            if (/^([-*_])\1{2,}$/.test(trimmed)) { flush(); out.push('<hr>'); continue; }
            var q = /^>\s?(.*)$/.exec(trimmed);
            if (q) { flush(); out.push('<blockquote class="quote-block">' + mdInline(q[1]) + '</blockquote>'); continue; }
            var li = /^[-*•]\s+(.*)$/.exec(trimmed);
            if (li) { if (inList !== 'ul') { flush(); out.push('<ul>'); inList = 'ul'; } out.push('<li>' + mdInline(li[1]) + '</li>'); continue; }
            var num = /^\d+[.)]\s+(.*)$/.exec(trimmed) || /^\d+、\s*(.*)$/.exec(trimmed);
            if (num) { if (inList !== 'ol') { flush(); out.push('<ol>'); inList = 'ol'; } out.push('<li>' + mdInline(num[1]) + '</li>'); continue; }
            flush();
            out.push('<p class="body-text">' + mdInline(trimmed) + '</p>');
          }
          flush();
          return out.join('\n');
        };
        /* 抽屉回答用同一套表格解析，但保留 .zp-md-* 的对话排版（div 结构，不引入 h 标签） */
        var mdToChatHtml = function (md) {
          var lines = String(md || '').split('\n');
          var out = [];
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/\s+$/, '');
            if (!line.trim()) { out.push('<div class="zp-md-gap"></div>'); continue; }
            var trimmed = line.trim();
            if (/^([-*_])\1{2,}$/.test(trimmed)) { out.push('<hr>'); continue; }
            if (trimmed.charAt(0) === '|' && i + 1 < lines.length && mdIsTableSep(lines[i + 1])) {
              var header = mdSplitRow(trimmed);
              var aligns = mdSplitRow(lines[i + 1]).map(mdAlignOf);
              var rows = [];
              var j = i + 2;
              while (j < lines.length && lines[j].trim().charAt(0) === '|' && !mdIsTableSep(lines[j])) {
                rows.push(mdSplitRow(lines[j]));
                j++;
              }
              out.push(mdTableHtml(header, aligns, rows, 'zp-md-table'));
              i = j - 1;
              continue;
            }
            var hm = /^(#{1,4})\s+(.*)$/.exec(line);
            if (hm) { out.push('<div class="zp-md-h zp-md-h' + hm[1].length + '">' + mdInline(hm[2]) + '</div>'); continue; }
            var qm = /^>\s?(.*)$/.exec(line);
            if (qm) { out.push('<div class="zp-md-quote">' + mdInline(qm[1]) + '</div>'); continue; }
            var lm = /^\s*([-*]|\d+[.)])\s+(.*)$/.exec(line);
            if (lm) { out.push('<div class="zp-md-li">· ' + mdInline(lm[2]) + '</div>'); continue; }
            out.push('<div class="zp-md-p">' + mdInline(line) + '</div>');
          }
          return out.join('');
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
        /* 报告渲染是纯函数：暴露给自检与无头预览（与 window.ZWEngine / ZWCore 同一形态） */
        try {
          if (typeof window !== 'undefined') {
            window.ZWReport = { REPORT_CSS: REPORT_CSS, escHtml: escHtml, mdToHtml: mdToHtml, mdToChatHtml: mdToChatHtml, buildReportHtml: buildReportHtml };
          }
        } catch (e) { /* 非浏览器环境忽略 */ }

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
