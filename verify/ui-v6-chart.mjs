/**
 * verify/ui-v6-chart.mjs — 命盘页（src/ui/70-chart.js，T5b）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。两种渲染：
 *   - 深渲染（client-harness 的假 React，effect 不跑、setState 是空操作）：给定 store 状态时的结构、文字、属性，
 *     以及选宫前后、切页签前后两棵树的差异
 *   - 极简 React 运行时（bootRuntime）：重渲染次数、宫格节点是否原地复用、连线的 layout effect 和 ResizeObserver、
 *     方向键和焦点、点星名（组件内状态）、窄档页签、看报告时隐藏、卸载再挂载
 * 两条钉死的行为：选宫只改宫格的状态属性、连线、宫位卡、窄档页签；时间卡跟着顶栏页签走。
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）；"今天"固定为 2026-11-19。期望值都是字面量。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bootRuntime, classesOf, diffTrees, find, findByClass, loadBundle, makeCtx, manualTimers, memoryStorage,
  renderDeep, renderShallow, settle, streamFetch, text
} from './client-harness.mjs';

const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '',
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const J = (v) => JSON.stringify(v);

/* 十二宫的「宫名 干支」（宫位序号 0 = 寅） */
const LABELS = ['父母 壬寅', '福德 癸卯', '田宅 甲辰', '官禄 乙巳', '仆役 丙午', '迁移 丁未', '疾厄 戊申', '财帛 己酉', '子女 庚戌', '夫妻 辛亥', '兄弟 壬子', '命宫 癸丑'];
const BRIEF = {
  太阳: '光明之星，主名声、公益与付出。坐命者热情坦荡、乐于助人；庙旺显达，落陷则劳碌。',
  太阴: '富星，主财富、审美与内敛。坐命者心思细腻、重感情，宜不动产、财务、文艺；夜生人尤佳。',
  天机: '智慧之星，主谋略、机变与思考。坐命者聪明好学、反应敏捷，善筹划却易多虑；宜研究、企划、咨询。',
  天魁: '六吉之一，主贵人提携。坐命者气度不凡，遇难有长辈贵人相助，男命尤佳。'
};
const PATTERNS = [
  ['日月同宫', '日月同守一宫（丑未），性格刚柔并济，早年顺遂，得父母长辈之荫。'],
  ['双禄交流', '禄存与化禄同宫或对拱，财禄双美，进财顺遂，理财有方。'],
  ['铃贪格', '铃星与贪狼同宫，主突发横财，蓄势而发，机遇多在暗中酝酿。'],
  ['左右同宫', '左辅右弼同宫，辅佐之星齐聚，主得人缘、多助力，贵人多而有力。']
];
/* 五个页签（"今天" 2026-11-19）：标题、时间行（加粗的干支）、要点、四化、运限命宫、前后翻、解读按钮、中宫多出的一项、切过去后选中的宫 */
const TABS = [
  { tab: 'natal', label: '本命', when: '命宫 癸丑 · 身宫在财帛', bold: null, line: '命宫坐太阳、太阴，身宫在财帛。', mut: ['天梁', '紫微', '左辅', '武曲'], focus: -1, steps: [], read: '读这张盘', fact: null, sel: 11, pal: '命宫', tag: null },
  { tab: 'decadal', label: '大限', when: '33–42 岁 · 甲辰限', bold: '甲辰', line: '这十年大限命宫在田宅，重心在家和住处。', mut: ['廉贞', '破军', '武曲', '太阳'], focus: 2, steps: ['上一个十年', '下一个十年'], read: '解读这十年', fact: '大限 甲辰', sel: 2, pal: '田宅', tag: '限·命宫' },
  { tab: 'yearly', label: '流年', when: '2026年 · 丙午年 · 虚岁 35', bold: '丙午', line: '今年流年命宫在仆役，重心在朋友与合作。', mut: ['天同', '天机', '文昌', '廉贞'], focus: 4, steps: ['上一年', '下一年'], read: '解读今年', fact: '流年 丙午', sel: 4, pal: '仆役', tag: '年·命宫' },
  { tab: 'monthly', label: '流月', when: '2026年农历十月 · 己亥月', bold: '己亥', line: '这个月流月命宫在田宅，重心在家和住处。', mut: ['武曲', '贪狼', '天梁', '文曲'], focus: 2, steps: ['上个月', '下个月'], read: '解读这个月', fact: '流月 己亥', sel: 2, pal: '田宅', tag: '月·命宫' },
  { tab: 'daily', label: '流日', when: '11月19日 · 农历十月十一 · 丁酉日', bold: '丁酉', line: '今天流日命宫在父母，重心在长辈与文书。', mut: ['太阴', '天同', '天机', '巨门'], focus: 0, steps: ['前一天', '后一天'], read: '解读今天', fact: '流日 丁酉', sel: 0, pal: '父母', tag: '日·命宫' }
];
const CHART_COMPONENTS = ['ChartPage', 'ChartSide', 'ChartPanes', 'ScopeCard', 'ScopeReportButton', 'PatternCard', 'PalaceCard', 'ChartBoard', 'BoardCell', 'BoardCenter', 'BoardLines'];
/* CELL_POS（25-board）：宫位序号 → [列, 行] */
const CELL_POS = { 3: [1, 1], 4: [2, 1], 5: [3, 1], 6: [4, 1], 2: [1, 2], 7: [4, 2], 1: [1, 3], 8: [4, 3], 0: [1, 4], 11: [2, 4], 10: [3, 4], 9: [4, 4] };

const attr = (el, k) => (el && el.props ? el.props[k] : undefined);
const isEl = (n) => !!n && typeof n === 'object' && !Array.isArray(n) && 'type' in n && 'children' in n;
const kidsOf = (el) => (el ? (el.children || []).flat(Infinity).filter(isEl) : []);
const region = (tree, id) => find(tree, (n) => attr(n, 'data-region') === id);
const first = (tree, cls) => findByClass(tree, cls)[0] || null;
const cellsOf = (tree) => find(tree, (n) => n.type === 'button' && classesOf(n).includes('zp-cell'));
const keysOf = (tree) => find(tree, (n) => n.props && n.props.key !== undefined && n.props.key !== null).map((n) => String(n.props.key));
const buttons = (tree) => find(tree, (n) => n.type === 'button');
const byText = (tree, s) => buttons(tree).find((n) => text(n) === s) || null;
const byLabel = (tree, s) => buttons(tree).find((n) => attr(n, 'aria-label') === s) || null;
const scopeCard = (tree) => region(tree, 'SCOPE')[0] || null;
const patsCard = (tree) => region(tree, 'PATTERNS')[0] || null;
const palaceCard = (tree) => region(tree, 'INSPECTOR')[0] || null;
const board = (tree) => region(tree, 'BOARD')[0] || null;
const centerOf = (tree) => first(tree, 'zp-center');
const kv = (card) => {
  const dl = first(card, 'zp-kv');
  return kidsOf(dl).map((n) => [n.type, text(n)]);
};

/* 选宫允许变的地方：宫位卡、连线、窄档页签整棵子树（连同左栏的 data-pane：store 在选宫时把 pane 切到宫位卡）；
   宫格只许变 className（zp-rel）、aria-pressed、tabIndex */
const ZONES = ['zp-detail', 'zp-lines', 'zp-panes'];
function maskSelection(node) {
  if (Array.isArray(node)) return node.map(maskSelection);
  if (!isEl(node)) return node;
  const cls = classesOf(node);
  const zone = ZONES.find((z) => cls.includes(z));
  if (zone) return { type: 'masked', props: { zone }, children: [] };
  let props = node.props || {};
  if (cls.includes('zp-side')) props = Object.assign({}, props, { 'data-pane': 'masked' });
  if (cls.includes('zp-cell')) {
    props = Object.assign({}, props, { className: cls.filter((c) => c !== 'zp-rel').join(' ') });
    delete props['aria-pressed'];
    delete props.tabIndex;
  }
  return { type: node.type, props, children: (node.children || []).map(maskSelection) };
}
function dropToast(node) {
  if (Array.isArray(node)) return node.map(dropToast);
  if (!isEl(node)) return node;
  if (classesOf(node).includes('zp-toast')) return null;
  return { type: node.type, props: node.props, children: (node.children || []).map(dropToast) };
}
/* 重挂载后宫格是新节点、位置重新量，连线的坐标和描不描线另外看；这里只比别的 */
function maskLines(node) {
  if (Array.isArray(node)) return node.map(maskLines);
  if (!isEl(node)) return node;
  if (classesOf(node).includes('zp-lines')) return { type: 'svg', props: { lines: true }, children: [] };
  return { type: node.type, props: node.props, children: (node.children || []).map(maskLines) };
}
/* 运行时的树里，选宫允许变的区域之外的宿主节点（按文档顺序）；宫格节点本身也算在内，只是它的属性可以变 */
function stableNodes(el, out = []) {
  if (Array.isArray(el)) { el.forEach((x) => stableNodes(x, out)); return out; }
  if (!isEl(el)) return out;
  out.push(el.node);
  const cls = classesOf(el);
  if (cls.includes('zp-detail') || cls.includes('zp-lines') || cls.includes('zp-panes')) return out;
  (el.children || []).forEach((c) => stableNodes(c, out));
  return out;
}
const sameNodes = (a, b) => a.length === b.length && a.length > 0 && a.every((n, i) => n === b[i]);

export default async function chartChecks(t) {
  const { ok, section } = t;
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);
  const guard = async (name, fn) => {
    try { await fn(); } catch (e) { ok(name + '（跑完没有抛错）', false, String((e && e.stack) || e).split('\n').slice(0, 4).join(' | ')); }
  };
  if (!t.client) { ok('命盘页：有 v6 bundle', false); return; }
  await guard('命盘页：深渲染', () => deepChecks(t, ok, eq, section));
  await guard('命盘页：运行时', () => runtimeChecks(t, ok, eq, section));
  await guard('命盘页：源码和样式', () => sourceChecks(t, ok, eq, section));
}

/* ================================================================ *
 * 深渲染
 * ================================================================ */
async function deepChecks(t, ok, eq, section) {
  section('命盘页（T5b）：结构（深渲染）');
  const b = loadBundle(t.client, { globals: { AbortController } });
  const timers = manualTimers();
  const host = makeCtx({ layout: { calls: [], selectPanel() {} } });
  const pipe = streamFetch();
  const plugin = b.materialize();
  b.win.setTimeout = timers.setTimeout;
  b.win.clearTimeout = timers.clearTimeout;
  plugin.apply(host.ctx);
  const store = b.win.ZWStore.getStore({ storage: memoryStorage(), now: () => NOW, fetch: pipe, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout });
  const Main = host.main();
  const E = b.win.ZWEngine;
  const h = b.React.createElement;
  const entry = store.addChart(GOLDEN, '甲');
  store.openChart(entry.id);

  const pro = renderShallow(Main().children[0]);
  const pageEl = find(pro, (n) => typeof n.type === 'function' && n.type.name === 'ChartPage')[0];
  ok('ProApp 在命盘页渲染 ChartPage（70-chart.js 声明了 function ChartPage）', !!pageEl);
  if (!pageEl) return;
  const ChartPage = pageEl.type;
  eq('ChartPage 收到 tier（首帧还没量宽，是 narrow）', attr(pageEl, 'tier'), 'narrow');
  const page = (tier = 'narrow') => renderDeep(h(ChartPage, { tier }));
  let tree = page();

  /* ---------- 骨架和区域 ---------- */
  eq('根节点是 div.zp-body，不隐藏', [tree.type, classesOf(tree), attr(tree, 'hidden')], ['div', ['zp-body'], false]);
  const side = first(tree, 'zp-side');
  eq('div.zp-side[data-pane="scope"]：窄档页签、时间卡、格局卡、宫位卡依次排列',
    [attr(side, 'data-pane'), kidsOf(side).map((n) => classesOf(n).join('.'))],
    ['scope', ['zp-seg.zp-panes', 'zp-card.zp-scope', 'zp-card.zp-pats', 'zp-card.zp-detail']]);
  eq('四个区域各一个，data-region 在带区域首类名的元素上',
    [['SCOPE', 'zp-scope'], ['PATTERNS', 'zp-pats'], ['INSPECTOR', 'zp-detail'], ['BOARD', 'zp-board']].map(([id, cls]) => {
      const els = region(tree, id);
      return [id, els.length, els[0] && els[0].type, els[0] && classesOf(els[0]).includes(cls)];
    }),
    [['SCOPE', 1, 'section', true], ['PATTERNS', 1, 'section', true], ['INSPECTOR', 1, 'section', true], ['BOARD', 1, 'div', true]]);
  const panes = region(tree, 'PANES')[0];
  eq('窄档：PANES 是 div.zp-seg.zp-panes[role=tablist]（有名字），三个 button[role=tab]：页签名 / 格局 / 选中宫名',
    [panes && classesOf(panes), attr(panes, 'role'), attr(panes, 'aria-label'), find(panes, (n) => attr(n, 'role') === 'tab').map((n) => [n.type, text(n), attr(n, 'aria-selected')])],
    [['zp-seg', 'zp-panes'], 'tablist', '下面看什么', [['button', '本命', 'true'], ['button', '格局', 'false'], ['button', '命宫', 'false']]]);
  const wide = page('wide');
  eq('中、宽档：不渲染窄档页签，其余一样', [region(wide, 'PANES').length, kidsOf(first(wide, 'zp-side')).map((n) => classesOf(n).join('.'))],
    [0, ['zp-card.zp-scope', 'zp-card.zp-pats', 'zp-card.zp-detail']]);
  eq('盘面在 div.zp-board-wrap 里：12 个宫格按钮、中宫、连线 svg（aria-hidden）',
    [classesOf(kidsOf(tree)[1]), kidsOf(board(tree)).map((n) => n.type + '.' + classesOf(n)[0]).filter((x, i, a) => a.indexOf(x) === i), cellsOf(tree).length, attr(first(tree, 'zp-lines'), 'aria-hidden')],
    [['zp-board-wrap'], ['button.zp-cell', 'div.zp-center', 'svg.zp-lines'], 12, true]);

  /* ---------- 宫格 ---------- */
  let cells = cellsOf(tree);
  eq('宫格：type=button，data-i 0–11 依次，aria-label「宫名 干支」', cells.map((c) => [attr(c, 'type'), attr(c, 'data-i'), attr(c, 'aria-label')]),
    LABELS.map((l, i) => ['button', i, l]));
  eq('打开时选中命宫：恰好一个 aria-pressed="true"，它的 tabIndex 是 0，其余 11 个是 aria-pressed="false"、tabIndex -1',
    [cells.filter((c) => attr(c, 'aria-pressed') === 'true').map((c) => [attr(c, 'data-i'), attr(c, 'tabIndex')]),
      cells.filter((c) => attr(c, 'aria-pressed') === 'false' && attr(c, 'tabIndex') === -1).length],
    [[[11, 0]], 11]);
  eq('三方四正（对宫、两个三合宫）加 zp-rel；本命下没有 zp-scope-focus；盘面不带 zp-scoped',
    [cells.filter((c) => classesOf(c).includes('zp-rel')).map((c) => attr(c, 'data-i')), cells.filter((c) => classesOf(c).includes('zp-scope-focus')).length, classesOf(board(tree))],
    [[3, 5, 7], 0, ['zp-board']]);
  eq('宫格按 CELL_POS 放进 4×4 网格（内联 gridColumn / gridRow）', cells.map((c) => attr(c, 'style')),
    LABELS.map((_, i) => ({ gridColumn: CELL_POS[i][0], gridRow: CELL_POS[i][1] })));
  const c11 = cells[11], c7 = cells[7], c10 = cells[10], c1 = cells[1], c5 = cells[5], c0 = cells[0];
  const headOf = (c) => kidsOf(first(c, 'zp-cell-head')).map((n) => [classesOf(n).join('.'), text(n)]);
  eq('命宫格：头部 span.zp-pname（含 span.zp-mk「命」）+ span.zp-gz；本命下没有 zp-scope-tag',
    [headOf(c11), findByClass(c11, 'zp-mk').map((n) => [n.type, classesOf(n), text(n)])],
    [[['zp-pname', '命宫命'], ['zp-gz', '癸丑']], [['span', ['zp-mk'], '命']]]);
  eq('身宫标记 span.zp-mk.zp-mk-body「身」（财帛）', findByClass(c7, 'zp-mk').map((n) => [classesOf(n), text(n)]), [[['zp-mk', 'zp-mk-body'], '身']]);
  const majorsOf = (c) => find(first(c, 'zp-majors'), (n) => classesOf(n).includes('zp-star')).map((n) => [n.type, text(n), attr(n, 'style')]);
  eq('主星：span.zp-star，星色走 --zp-c 内联变量，亮度在 sup 里', [majorsOf(c11), find(c11, (n) => n.type === 'sup').map(text)],
    [[['span', '太阳不', { '--zp-c': 'var(--zp-s2)' }], ['span', '太阴庙', { '--zp-c': 'var(--zp-s7)' }]], ['不', '庙']]);
  eq('生年四化：实心印 i.zp-seal.zp-ji「忌」（兄弟宫武曲）', [majorsOf(c10).map((x) => x[1]), findByClass(c10, 'zp-seal').map((n) => [n.type, classesOf(n), text(n)])],
    [['武曲旺忌', '天府庙'], [['i', ['zp-seal', 'zp-ji'], '忌']]]);
  eq('空宫：span.zp-empty-p「空宫」，没有辅星时不渲染 div.zp-minors', [findByClass(c7, 'zp-empty-p').map(text), findByClass(c7, 'zp-star').length, findByClass(c7, 'zp-minors').length],
    [['空宫'], 0, 0]);
  const minorsOf = (c) => kidsOf(first(c, 'zp-minors')).map((n) => [classesOf(n), text(n)]);
  eq('辅星：文昌 文曲 左辅 右弼 天魁 天钺 禄存 天马是 zp-good，其余 zp-bad；生年四化的印跟在后面',
    [minorsOf(c1), minorsOf(c5), minorsOf(c0), findByClass(c5, 'zp-seal').map((n) => [classesOf(n), text(n)])],
    [[[['zp-good'], '天魁'], [['zp-bad'], '地劫']], [[['zp-good'], '左辅科'], [['zp-good'], '右弼'], [['zp-bad'], '地空']], [[['zp-good'], '天马'], [['zp-bad'], '铃星']], [[['zp-seal', 'zp-ke'], '科']]]);
  eq('宫格底部：span.zp-dec 大限岁数，span.zp-gods 长生十二神·博士十二神',
    [c11, c0].map((c) => kidsOf(first(c, 'zp-cell-foot')).map((n) => [classesOf(n).join('.'), text(n)])),
    [[['zp-dec', '3–12'], ['zp-gods', '冠带·青龙']], [['zp-dec', '13–22'], ['zp-gods', '临官·小耗']]]);
  eq('杂曜开关关着：没有 div.zp-adj', findByClass(tree, 'zp-adj').length, 0);

  /* ---------- 中宫 ---------- */
  const center = centerOf(tree);
  eq('中宫：字都在一块牌子（div.zp-plate）上，连线从它下面穿过。牌子里是称呼（带命宫主星颜色的小星球）、生日行、四柱、底数、格局；没有时辰边界告警',
    [kidsOf(center).map((n) => classesOf(n).join('.')), kidsOf(first(center, 'zp-plate')).map((n) => classesOf(n).join('.')), text(first(center, 'zp-nm')), attr(first(center, 'zp-orb'), 'style'), text(first(center, 'zp-birth'))],
    [['zp-plate'], ['zp-nm', 'zp-birth', 'zp-pillars', 'zp-facts', 'zp-cpats'], '甲', { '--zp-c': 'var(--zp-s2)' }, '1992.05.03 · 农历四月初一 · 辰时']);
  eq('四柱：四个 span（干支 + small 年月日时），容器有名字', [kidsOf(first(center, 'zp-pillars')).map((n) => [text(n), text(find(n, (x) => x.type === 'small')[0])]), attr(first(center, 'zp-pillars'), 'aria-label')],
    [[['壬申年', '年'], ['甲辰月', '月'], ['己卯日', '日'], ['戊辰时', '时']], '四柱']);
  const facts = (tr) => kidsOf(first(centerOf(tr), 'zp-facts')).map(text);
  eq('底数：五行局 · 阴阳男女、命主 · 身主、起运、真太阳时', facts(tree), ['木三局 · 阳男', '命主 巨门 · 身主 天梁', '起运 3 岁', '真太阳时 08:37']);
  const chart = store.currentChart();
  const sc = chart.meta.solarCorrection;
  sc.boundaryWarning = true;
  const warned = first(centerOf(page()), 'zp-warn');
  sc.boundaryWarning = false;
  eq('boundaryWarning 为真时中宫多一行 p.zp-warn（v5 的文案）', [warned && warned.type, text(warned)], ['p', '出生时间离两个时辰的交界很近，请确认钟表时间是否准确']);
  chart.meta.solarCorrection = null;
  const uncorrected = facts(page());
  chart.meta.solarCorrection = sc;
  eq('没校正真太阳时：写「未校正」', uncorrected[3], '真太阳时 未校正');

  /* ---------- 时间卡（本命） ---------- */
  const sc0 = scopeCard(tree);
  const mutOf = (card) => kidsOf(first(card, 'zp-mut')).map((n) => [text(n), attr(find(n, (x) => x.type === 'b')[0], 'style') || null, classesOf(find(n, (x) => x.type === 'i')[0]), attr(n, 'title')]);
  eq('本命时间卡：标题、时间行、要点；没有前后翻',
    [text(find(sc0, (n) => n.type === 'h3')[0]), text(first(sc0, 'zp-when')), text(first(sc0, 'zp-line')), findByClass(sc0, 'zp-step').length],
    ['本命', '命宫 癸丑 · 身宫在财帛', '命宫坐太阳、太阴，身宫在财帛。', 0]);
  eq('四化四格：b 星名（--zp-c）+ i.zp-seal.zp-lu|quan|ke|ji，title「星化X」；容器有名字',
    [mutOf(sc0), attr(first(sc0, 'zp-mut'), 'aria-label')],
    [[['天梁禄', { '--zp-c': 'var(--zp-s11)' }, ['zp-seal', 'zp-lu'], '天梁化禄'], ['紫微权', { '--zp-c': 'var(--zp-s0)' }, ['zp-seal', 'zp-quan'], '紫微化权'],
      ['左辅科', null, ['zp-seal', 'zp-ke'], '左辅化科'], ['武曲忌', { '--zp-c': 'var(--zp-s3)' }, ['zp-seal', 'zp-ji'], '武曲化忌']], '四化']);
  eq('本命的动作：读这张盘、写完整报告（都是 button.zp-btn）', buttons(first(sc0, 'zp-card-f')).map((n) => [classesOf(n), text(n)]),
    [[['zp-btn'], '读这张盘'], [['zp-btn'], '写完整报告']]);

  /* ---------- 格局卡 ---------- */
  const pc = patsCard(tree);
  eq('格局卡：标题、个数、每个格局一个 button.zp-pat（名称 + i.zp-lv.zp-lv-ji「吉」），第一个按下，说明是它的',
    [text(find(pc, (n) => n.type === 'h3')[0]), text(first(pc, 'zp-cnt')),
      findByClass(pc, 'zp-pat').map((n) => [n.type, attr(n, 'type'), text(n), classesOf(find(n, (x) => x.type === 'i')[0]), attr(n, 'aria-pressed')]),
      text(first(pc, 'zp-pat-desc'))],
    ['格局', '4 个', PATTERNS.map(([n], i) => ['button', 'button', n + '吉', ['zp-lv', 'zp-lv-ji'], i === 0 ? 'true' : 'false']), PATTERNS[0][1]]);
  findByClass(pc, 'zp-pat')[1].props.onClick();
  const pc2 = patsCard(page());
  eq('点第二个格局：store.setPat(1)，按下的和说明跟着换', [store.getState().session.pat, findByClass(pc2, 'zp-pat').map((n) => attr(n, 'aria-pressed')), text(first(pc2, 'zp-pat-desc'))],
    [1, ['false', 'true', 'false', 'false'], PATTERNS[1][1]]);
  store.setPat(0);
  const realDetect = E.detectPatterns;
  E.detectPatterns = () => [];
  const pcEmpty = patsCard(page());
  E.detectPatterns = realDetect;
  eq('没有格局：没有按钮，只写一句「这张盘没有明显的格局。」', [findByClass(pcEmpty, 'zp-pat').length, text(first(pcEmpty, 'zp-pat-desc'))], [0, '这张盘没有明显的格局。']);

  /* ---------- 宫位卡 ---------- */
  const pal = palaceCard(tree);
  const palHead = (card) => [text(find(card, (n) => n.type === 'h3')[0]), classesOf(find(card, (n) => n.type === 'h3')[0]), text(find(card, (n) => n.type === 'small')[0]), findByClass(card, 'zp-tag').map(text)];
  const starsOf = (card) => buttons(first(card, 'zp-stars')).map((n) => [classesOf(n), text(n), attr(n, 'aria-pressed')]);
  eq('宫位卡（命宫）：h3.zp-serif 宫名 + small 干支；本命下没有 zp-tag', palHead(pal), ['命宫癸丑', ['zp-serif'], '癸丑', []]);
  eq('「问这一宫」是 div.zp-card-right 里的 button.zp-link', buttons(first(pal, 'zp-card-right')).map((n) => [classesOf(n), text(n)]), [[['zp-link'], '问这一宫']]);
  eq('主星是 button.zp-star[aria-pressed]（第一颗按下），下面是它的解释', [starsOf(pal), text(first(pal, 'zp-brief'))],
    [[[['zp-star'], '太阳不', 'true'], [['zp-star'], '太阴庙', 'false']], BRIEF.太阳]);
  /* 三方四正每一宫带主星（空宫写「空宫」）；宫干四化：癸干让破军化禄、巨门化权、太阴化科、贪狼化忌，各落在哪一宫 */
  eq('键值：辅星（没有写 —）、对宫、三合（两宫在同一行里，一宫一组）、宫干四化、大限', kv(pal),
    [['dt', '辅星'], ['dd', '—'], ['dt', '对宫'], ['dd', '迁移空宫'], ['dt', '三合'], ['dd', '官禄天梁财帛空宫'],
      ['dt', '癸干四化'], ['dd', '破军禄子女巨门权福德太阴科命宫贪狼忌父母'], ['dt', '大限'], ['dd', '3–12 岁']]);
  eq('三方四正一宫一组：span.zp-kv-pal > button.zp-kv-link（宫名）+ span.zp-kv-stars（主星，空宫写「空宫」）',
    findByClass(pal, 'zp-kv-pal').map((g) => [text(first(g, 'zp-kv-link')), text(first(g, 'zp-kv-stars'))]), [['迁移', '空宫'], ['官禄', '天梁'], ['财帛', '空宫']]);
  eq('宫名后面写这一宫管什么', text(first(pal, 'zp-theme')), '看你自己');
  const fly = first(pal, 'zp-fly');
  eq('宫干四化：四颗星按星色，各带一个空心的四化印（禄权科忌）', [kidsOf(fly).map((n) => text(find(n, (x) => x.type === 'b')[0])), findByClass(fly, 'zp-seal').map((n) => [text(n), classesOf(n).includes('zp-scoped')]), attr(find(fly, (x) => x.type === 'b')[0], 'style')],
    [['破军', '巨门', '太阴', '贪狼'], [['禄', true], ['权', true], ['科', true], ['忌', true]], { '--zp-c': 'var(--zp-s13)' }]);
  const links = findByClass(pal, 'zp-kv-link');
  eq('宫名都是 button.zp-kv-link：对宫、两个三合宫，再加四化落的四宫', links.map((n) => [n.type, attr(n, 'type'), text(n)]),
    [['button', 'button', '迁移'], ['button', 'button', '官禄'], ['button', 'button', '财帛'], ['button', 'button', '子女'], ['button', 'button', '福德'], ['button', 'button', '命宫'], ['button', 'button', '父母']]);
  links[1].props.onClick();
  eq('点三方四正里的「官禄」：选中官禄（store.selectPalace(3)），窄档页签切到宫位卡', [store.getState().session.sel, store.getState().session.pane], [3, 'detail']);
  store.selectPalace(1);
  const pal1 = palaceCard(page());
  eq('福德宫：辅星在键值里也是 button.zp-star.zp-minor（点了换解释）',
    [kv(pal1)[1], buttons(find(pal1, (n) => n.type === 'dd')[0]).map((n) => [classesOf(n), text(n), attr(n, 'aria-pressed')]), text(first(pal1, 'zp-brief'))],
    [['dd', '天魁、地劫'], [[['zp-star', 'zp-minor'], '天魁', 'false'], [['zp-star', 'zp-minor'], '地劫', 'false']], BRIEF.天机]);
  store.selectPalace(7);
  const pal7 = palaceCard(page());
  eq('空宫（财帛）：没有主星按钮，解释写「这一宫没有主星，看对宫来借星。」', [buttons(first(pal7, 'zp-stars')).length, text(first(pal7, 'zp-brief'))], [0, '这一宫没有主星，看对宫来借星。']);
  store.selectPalace(11);

  /* ---------- 杂曜开关 ---------- */
  store.setPref('showAdj', true);
  tree = page();
  eq('显示杂曜：每个宫格多一行 div.zp-adj', findByClass(tree, 'zp-adj').map(text).slice(0, 3).concat([findByClass(tree, 'zp-adj').length]),
    ['凤阁 天月 截路 天虚 年解', '空亡', '天姚 华盖 蜚廉', 12]);
  eq('显示杂曜：宫位卡多一行「杂曜」（在辅星和对宫之间）', kv(palaceCard(tree)).slice(0, 6),
    [['dt', '辅星'], ['dd', '—'], ['dt', '杂曜'], ['dd', '天喜、月德'], ['dt', '对宫'], ['dd', '迁移空宫']]);
  store.setPref('showAdj', false);
  tree = page();
  eq('关掉：宫格和宫位卡都不再有杂曜', [findByClass(tree, 'zp-adj').length, kv(palaceCard(tree)).filter((x) => x[1] === '杂曜').length], [0, 0]);

  /* ---------- 选宫：只改宫格状态、连线、宫位卡、窄档页签 ---------- */
  section('命盘页（T5b）：选宫（深渲染前后比较）');
  store.selectPalace(2);
  const A = page();
  store.selectPalace(9);
  const B = page();
  eq('时间卡、格局卡、中宫：选宫前后一模一样', [diffTrees(scopeCard(A), scopeCard(B)), diffTrees(patsCard(A), patsCard(B)), diffTrees(centerOf(A), centerOf(B))], [[], [], []]);
  eq('把宫位卡、连线、窄档页签整棵盖住，宫格去掉 zp-rel / aria-pressed / tabIndex：整页没有任何差异（没有节点增减）',
    diffTrees(maskSelection(A), maskSelection(B)), []);
  const cA = cellsOf(A), cB = cellsOf(B);
  const changed = cA.map((c, i) => [i, diffTrees(c, cB[i])]).filter(([, d]) => d.length);
  eq('有差异的宫格：选中宫和三方四正（2 → 9：8 格）', changed.map(([i]) => i), [1, 2, 3, 5, 6, 8, 9, 10]);
  eq('宫格的差异只在 className / aria-pressed / tabIndex，格子里的内容不变',
    [...new Set(changed.flatMap(([, d]) => d.map((x) => x.kind + ':' + x.path.split('.').pop())))].sort(),
    ['prop:aria-pressed', 'prop:className', 'prop:tabIndex']);
  eq('选中 9：恰好一个按下、tabIndex 0；zp-rel 是 3 / 1 / 5', [cB.filter((c) => attr(c, 'aria-pressed') === 'true').map((c) => [attr(c, 'data-i'), attr(c, 'tabIndex')]), cB.filter((c) => classesOf(c).includes('zp-rel')).map((c) => attr(c, 'data-i'))],
    [[[9, 0]], [1, 3, 5]]);
  eq('整棵树的 key 选宫前后一个不变（key 不随选中宫变）', [keysOf(A).length > 12, keysOf(A).join('|') === keysOf(B).join('|')], [true, true]);
  /* 辛干四化：巨门禄、太阳权、文曲科、文昌忌 */
  eq('宫位卡跟着换：夫妻 辛亥、天同、禄存；对宫官禄、三合福德和迁移各带主星；辛干四化；103–112 岁',
    [palHead(palaceCard(B))[0], starsOf(palaceCard(B)).map((x) => x[1]), kv(palaceCard(B)).map((x) => x[1]), text(first(palaceCard(B), 'zp-theme'))],
    ['夫妻辛亥', ['天同庙'], ['辅星', '禄存', '对宫', '官禄天梁', '三合', '福德天机、巨门迁移空宫', '辛干四化', '巨门禄福德太阳权命宫文曲科疾厄文昌忌仆役', '大限', '103–112 岁'], '看伴侣与感情']);
  eq('窄档页签第三个换成新宫名', find(region(B, 'PANES')[0], (n) => attr(n, 'role') === 'tab').map(text), ['本命', '格局', '夫妻']);
  cellsOf(B)[4].props.onClick();
  eq('点宫格：store.selectPalace(4)，页签切到宫位卡', [store.getState().session.sel, store.getState().session.pane], [4, 'detail']);
  find(region(page(), 'PANES')[0], (n) => text(n) === '格局')[0].props.onClick();
  eq('点窄档页签「格局」：store.setPane("pats")，div.zp-side 的 data-pane 跟着变', [store.getState().session.pane, attr(first(page(), 'zp-side'), 'data-pane')], ['pats', 'pats']);

  /* ---------- 时间卡跟着页签 ---------- */
  section('命盘页（T5b）：时间卡跟着页签（深渲染）');
  store.openChart(entry.id);
  const trees = [];
  for (const x of TABS) {
    store.setTab(x.tab);
    const tr = page();
    trees.push(tr);
    const card = scopeCard(tr);
    const when = first(card, 'zp-when');
    eq(`${x.label}：时间卡标题等于页签名`, text(find(card, (n) => n.type === 'h3')[0]), x.label);
    eq(`${x.label}：时间行（干支加粗）、要点、四化`,
      [text(when), find(when, (n) => n.type === 'b').map(text), text(first(card, 'zp-line')), mutOf(card).map((m) => m[0].slice(0, -1))],
      [x.when, x.bold ? [x.bold] : [], x.line, x.mut]);
    eq(`${x.label}：前后翻（button.zp-step，aria-label / title）、解读按钮`,
      [findByClass(card, 'zp-step').map((n) => [attr(n, 'type'), attr(n, 'aria-label'), attr(n, 'title')]), text(buttons(first(card, 'zp-card-f'))[0])],
      [x.steps.map((s) => ['button', s, s]), x.read]);
    const cs = cellsOf(tr);
    eq(`${x.label}：12 个宫格；运限命宫 zp-scope-focus；盘面${x.tab === 'natal' ? '不' : ''}带 zp-scoped；选中运限命宫`,
      [cs.length, cs.filter((c) => classesOf(c).includes('zp-scope-focus')).map((c) => attr(c, 'data-i')), classesOf(board(tr)).includes('zp-scoped'), cs.filter((c) => attr(c, 'aria-pressed') === 'true').map((c) => attr(c, 'data-i'))],
      [12, x.focus < 0 ? [] : [x.focus], x.tab !== 'natal', [x.sel]]);
    eq(`${x.label}：窄档页签第一个是页签名，第三个是选中宫；宫位卡的运限宫名`,
      [find(region(tr, 'PANES')[0], (n) => attr(n, 'role') === 'tab').map(text), findByClass(palaceCard(tr), 'zp-tag').map(text)],
      [[x.label, '格局', x.pal], x.tag ? [x.tag] : []]);
    eq(`${x.label}：中宫的底数${x.fact ? '多一项当前层的干支' : ''}`, facts(tr).slice(4), x.fact ? [x.fact] : []);
  }
  const patDiffs = trees.slice(1).map((tr) => diffTrees(patsCard(trees[0]), patsCard(tr)).length);
  eq('任意两个页签之间：格局卡子树相同', patDiffs, [0, 0, 0, 0]);
  const boardKeys = trees.map((tr) => keysOf(board(tr)).join('|'));
  eq('任意两个页签之间：盘面的 key 一个不变（宫格不重建）', boardKeys.every((k) => k === boardKeys[0]), true);
  const yearly = trees[2];
  eq('流年：每个宫格头部有 span.zp-scope-tag「年·运限宫名」',
    cellsOf(yearly).map((c) => text(first(c, 'zp-scope-tag'))),
    ['财帛', '子女', '夫妻', '兄弟', '命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄'].map((n) => '年·' + n));
  const scoped = {};
  cellsOf(yearly).forEach((c, i) => { const s = find(c, (n) => classesOf(n).includes('zp-scoped')); if (s.length) scoped[i] = s.map((n) => [classesOf(n), text(n)]); });
  eq('流年四化：空心印 i.zp-seal.zp-scoped，字是「年」+ 禄权科忌（主星、辅星都标）', scoped, {
    1: [[['zp-seal', 'zp-scoped', 'zp-quan'], '年权']], 4: [[['zp-seal', 'zp-scoped', 'zp-ke'], '年科']],
    6: [[['zp-seal', 'zp-scoped', 'zp-ji'], '年忌']], 9: [[['zp-seal', 'zp-scoped', 'zp-lu'], '年禄']]
  });
  eq('流年：宫位卡（仆役）的辅星带运限四化印', buttons(find(palaceCard(yearly), (n) => n.type === 'dd')[0]).map((n) => [classesOf(n), text(n)]),
    [[['zp-star', 'zp-minor'], '文昌年科'], [['zp-star', 'zp-minor'], '火星']]);
  eq('流月 / 流日的印用「月」「日」，大限用「限」', [trees[1], trees[3], trees[4]].map((tr) => find(board(tr), (n) => n.type === 'i' && classesOf(n).includes('zp-scoped')).map(text)[0].charAt(0)), ['限', '月', '日']);

  /* ---------- 前后翻、回到今天、到头 ---------- */
  section('命盘页：时间条、中宫里的格局（spec 2026-11-20 §3.8，深渲染）');
  {
    const strip = (tr) => first(scopeCard(tr), 'zp-strip');
    const grid = (tr) => first(strip(tr), 'zp-strip-grid');
    const sc = (tr) => findByClass(strip(tr), 'zp-strip-cell');
    const onOf = (tr) => sc(tr).filter((c) => attr(c, 'aria-pressed') === 'true').map(text);
    const nowOf = (tr) => sc(tr).filter((c) => classesOf(c).includes('zp-now')).map(text);
    store.openChart(entry.id);
    let tr = page('wide');
    const rows = findByClass(strip(tr), 'zp-now-row');
    eq('本命：时间卡里是「此刻」四行（大限 / 流年 / 流月 / 流日），每行一个按钮',
      [attr(strip(tr), 'data-kind'), attr(strip(tr), 'role'), attr(strip(tr), 'aria-label'), rows.map((r) => text(find(r, (n) => n.type === 'b')[0])), rows.every((r) => attr(r, 'type') === 'button')],
      ['now', 'group', '此刻', ['大限', '流年', '流月', '流日'], true]);
    eq('时间条在四化和按钮之间', kidsOf(scopeCard(tr)).map((n) => classesOf(n)[0]), ['zp-card-h', 'zp-when', 'zp-line', 'zp-mut', 'zp-strip', 'zp-card-f']);
    rows[1].props.onClick();
    eq('点「流年」那一行：切到流年页签，日期是今天', [store.getState().session.tab, store.getState().session.when], ['yearly', { y: 2026, m: 11, d: 19 }]);
    tr = page('wide');
    eq('流年：这个大限的十年（5 列），今年按下、带今天的标记；每格是 type=button、有 aria-pressed',
      [attr(strip(tr), 'data-kind'), attr(grid(tr), 'data-cols'), sc(tr).length, onOf(tr), nowOf(tr), sc(tr).every((c) => attr(c, 'type') === 'button' && ['true', 'false'].includes(attr(c, 'aria-pressed')))],
      ['yearly', 5, 10, ['2026丙午'], ['2026丙午'], true]);
    sc(tr)[4].props.onClick();
    eq('点 2028：跳到 2028 年同一个农历月日，选中宫跟到那一年的流年命宫（戊申年 → 申宫）',
      [store.getState().session.when.y, chart.palaces[store.getState().session.sel].branch], [2028, '申']);
    tr = page('wide');
    eq('时间条跟着变：按下的是 2028，今天的标记还在 2026', [onOf(tr), nowOf(tr)], [['2028戊申'], ['2026丙午']]);
    store.setTab('decadal');
    tr = page('wide');
    eq('大限：十二格（4 列）；2100 年以后的那一个不可点', [sc(tr).length, attr(grid(tr), 'data-cols'), sc(tr).filter((c) => attr(c, 'disabled')).map(text)], [12, 4, ['113–122兄弟']]);
    store.setTab('monthly');
    tr = page('wide');
    eq('流月：十二格（6 列）', [sc(tr).length, attr(grid(tr), 'data-cols')], [12, 6]);
    store.backToNow();
    store.setTab('daily');
    tr = page('wide');
    const heads = find(grid(tr), (n) => n.type === 'i');
    eq('流日：月历 42 格（7 列），上面一行星期（aria-hidden）；今天按下；离选中那周超过一周的格子带 zp-far（左栏不够高时收起来，剩三周）',
      [sc(tr).length, attr(grid(tr), 'data-cols'), heads.map(text), heads.every((n) => attr(n, 'aria-hidden') === true), onOf(tr), sc(tr).filter((c) => !classesOf(c).includes('zp-far')).length],
      [42, 7, ['一', '二', '三', '四', '五', '六', '日'], true, ['19'], 21]);
    sc(tr)[0].props.onClick();
    eq('点月历里上个月的日子：翻到那一天（月历随后显示那个月）', store.getState().session.when, { y: 2026, m: 10, d: 26 });
    store.backToNow();
    store.setTab('natal');
    store.selectPalace(chart.soulIndex);

    tr = page('wide');
    const sidePats = patsCard(tr), centerPats = first(centerOf(tr), 'zp-cpats');
    const names = findByClass(sidePats, 'zp-pat').map(text);
    eq('格局在两处都渲染：左栏的格局卡和中宫里，内容一样（显示哪一处由样式按盘面宽度定）',
      [names.length >= 2, findByClass(centerPats, 'zp-pat').map(text), attr(centerPats, 'role'), attr(centerPats, 'aria-label')], [true, names, 'group', '格局']);
    const lastPat = findByClass(centerPats, 'zp-pat').pop();
    lastPat.props.onClick();
    tr = page('wide');
    const pressedIn = (root) => findByClass(root, 'zp-pat').filter((b) => attr(b, 'aria-pressed') === 'true').map(text);
    eq('在中宫点另一个格局：两处一起换（同一份 session.pat），说明也一样',
      [pressedIn(first(centerOf(tr), 'zp-cpats')), pressedIn(patsCard(tr)), text(first(first(centerOf(tr), 'zp-cpats'), 'zp-pat-desc')) === text(first(patsCard(tr), 'zp-pat-desc'))],
      [[names[names.length - 1]], [names[names.length - 1]], true]);
    store.setPat(0);
    const realDetect2 = E.detectPatterns;
    E.detectPatterns = () => [];
    const trNone = renderDeep(h(ChartPage, { tier: 'wide' }));
    E.detectPatterns = realDetect2;
    eq('没有格局：中宫里不留那一块', findByClass(centerOf(trNone), 'zp-cpats').length, 0);
    ok('样式：盘面够宽时格局在中宫、左栏的格局卡收起；默认相反（同一时间只显示一处）',
      /@container zp-body \(min-width: 980px\) \{\s*\.zp-side \.zp-pats \{ display: none \}\s*\.zp-cpats \{ display: flex \}\s*\}/.test(t.client) &&
      /\.zp-cpats \{\s*display: none;/.test(t.client));
    ok('样式：中宫的字在 .zp-plate 上，它排在连线上面（z-index 1 对 0）',
      /\.zp-plate \{[^}]*z-index: 1;/.test(t.client) && /\.zp-lines \{[^}]*z-index: 0;/.test(t.client));
  }

  section('命盘页（T5b）：前后翻和动作（深渲染）');
  store.setTab('yearly');
  byLabel(scopeCard(page()), '下一年').props.onClick();
  tree = page();
  eq('点「下一年」：store.stepScope(1)，时间行换到 2027 年，出现 button.zp-link「回到今天」',
    [J(store.getState().session.when), text(first(scopeCard(tree), 'zp-when')), buttons(first(scopeCard(tree), 'zp-card-f')).map((n) => [classesOf(n), text(n)])],
    [J({ y: 2027, m: 11, d: 8 }), '2027年 · 丁未年 · 虚岁 36', [[['zp-btn'], '解读明年'], [['zp-link'], '回到今天']]]);
  byText(scopeCard(tree), '回到今天').props.onClick();
  eq('点「回到今天」：store.backToNow()，按钮消失', [J(store.getState().session.when), byText(scopeCard(page()), '回到今天')], [J({ y: 2026, m: 11, d: 19 }), null]);
  store.openChart(entry.id, { tab: 'daily', when: { y: 1992, m: 5, d: 3 } });
  const edge0 = renderDeep(Main());
  byLabel(scopeCard(edge0), '前一天').props.onClick();
  const edge1 = renderDeep(Main());
  eq('翻到出生以前：状态不变，只多一条提示', [J(store.getState().session.when), store.getState().session.toast && store.getState().session.toast.text], [J({ y: 1992, m: 5, d: 3 }), '再往前就到出生以前了']);
  eq('翻到头：除了提示条，整棵面板一个字不差', diffTrees(dropToast(edge0), dropToast(edge1)), []);
  store.dismissToast();

  /* 读这张盘 / 解读这一层 / 问这一宫 / 报告按钮 */
  const lastCall = () => pipe.calls[pipe.calls.length - 1];
  const stopJob = async () => { store.stop(); await settle(6); };
  store.openChart(entry.id);
  store.setQuote({ label: '报告里的一段', text: '某一段' });
  byText(scopeCard(page()), '读这张盘').props.onClick();
  await settle();
  eq('读这张盘：打开紫微师，发空问题（速览，没有用户气泡），不带别处留下的引用',
    [store.getState().session.panelOpen, pipe.calls.length, lastCall() && lastCall().body.question, lastCall() && lastCall().body.mode, store.reading().thread.filter((m) => m.role === 'user').length],
    [true, 1, '', 'brief', 0]);
  await stopJob();
  store.setPanel(false);
  store.setTab('yearly');
  byText(scopeCard(page()), '解读今年').props.onClick();
  await settle();
  const yq = lastCall();
  eq('流年「解读今年」：打开紫微师，问「今年怎么样」，带流年定位（meta.yearlyFocus）',
    [store.getState().session.panelOpen, yq.body.question, yq.body.meta.yearlyFocus, store.reading().thread.filter((m) => m.role === 'user').map((m) => m.content).slice(-1)],
    [true, '今年怎么样', 2026, ['今年怎么样']]);
  await stopJob();
  store.setPanel(false);
  store.setTab('monthly');
  byText(scopeCard(page()), '解读这个月').props.onClick();
  await settle();
  const mq = lastCall();
  eq('流月「解读这个月」：问题前面加聚焦说明，定位拼在 chartText 末尾；气泡里只有用户那句',
    [mq.body.question.startsWith('【本轮聚焦】'), mq.body.question.endsWith('\n这个月怎么样'), /【当前定位 · 流月】/.test(mq.body.chartText), store.reading().thread.filter((m) => m.role === 'user').map((m) => m.content).slice(-1)],
    [true, true, true, ['这个月怎么样']]);
  await stopJob();
  store.setPanel(false);
  store.setTab('natal');
  store.selectPalace(11);
  byText(palaceCard(page()), '问这一宫').props.onClick();
  await settle();
  eq('问这一宫：打开紫微师，带上这一宫的星曜作为引用直接提问',
    [store.getState().session.panelOpen, lastCall().body.question, store.getState().session.quote],
    [true, '【引用：这一宫】\n命宫 癸丑 · 太阳、太阴\n\n讲讲我的命宫', null]);
  await stopJob();
  store.setPanel(false);

  const reportBtn = () => buttons(first(scopeCard(page()), 'zp-card-f'))[1];
  eq('报告按钮：还没写时「写完整报告」', text(reportBtn()), '写完整报告');
  reportBtn().props.onClick();
  eq('点报告按钮：store.setStage("report")，盘面 div.zp-body 隐藏（不卸载）', [store.getState().session.stage, attr(page(), 'hidden')], ['report', true]);
  store.setStage('board');
  store.startReport();
  await settle();
  const rp = lastCall();
  eq('报告在写：「报告正在写…」', text(reportBtn()), '报告正在写…');
  rp.send('delta', { text: '## 一、命盘总览\n正文' });
  await settle();
  rp.send('done', { text: '## 一、命盘总览\n正文' }).end();
  await settle(6);
  eq('写完：「看完整报告」', text(reportBtn()), '看完整报告');
  store.regenerateReport();
  await settle();
  lastCall().send('delta', { text: '## 一、命盘总览\n半截' });
  await settle();
  await stopJob();
  eq('写到一半停了：「接着写报告」', text(reportBtn()), '接着写报告');
  store.dismissToast();

  /* 每个按钮都有名字、type=button */
  const all = buttons(page()).concat(buttons(page('wide')));
  eq('命盘页的每个按钮：type=button，有文字或 aria-label', all.filter((n) => attr(n, 'type') !== 'button' || !(String(attr(n, 'aria-label') || '').trim() || text(n).trim())).length, 0);
}

/* ================================================================ *
 * 运行时
 * ================================================================ */
async function runtimeChecks(t, ok, eq, section) {
  section('命盘页（T5b）：重渲染边界（运行时）');
  const env = bootRuntime(t.client, { now: NOW, width: 1300 });
  ok('运行时装载、建默认 store', !env.error, env.error && env.error.message);
  if (env.error) return;
  const { rt, store, h, timers, pipe } = env;
  /* 记下每个 ResizeObserver 观察了什么，测试自己决定什么时候回调 */
  const ros = [];
  env.loaded.sandbox.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.targets = []; this.off = false; ros.push(this); }
    observe(el) { this.targets.push(el); }
    unobserve() {}
    disconnect() { this.off = true; }
  };
  const entry = store.addChart(GOLDEN, '甲');
  store.openChart(entry.id);
  rt.mount(h(env.Main));
  timers.runAll();
  const tree = () => rt.tree();
  const body = () => first(tree(), 'zp-body');
  ok('挂载后有 div.zp-body（宽档）', !!body() && attr(first(tree(), 'zp-root'), 'data-w') === 'wide');
  if (!body()) return;
  const counts = () => Object.fromEntries(CHART_COMPONENTS.map((n) => [n, rt.count(n)]));
  const delta = (c0) => Object.fromEntries(CHART_COMPONENTS.map((n) => [n, rt.count(n) - c0[n]]));
  eq('命盘页的组件都在（按函数名计渲染次数）', CHART_COMPONENTS.filter((n) => n !== 'ChartPanes' && rt.count(n) === 0), []);
  const cellNode = (i) => cellsOf(tree())[i].node;
  const boardNode = () => board(tree()).node;
  const linesEl = () => first(tree(), 'zp-lines');
  const lineParts = () => {
    const svg = linesEl();
    const g = kidsOf(svg)[0];
    return {
      cls: classesOf(svg), g: g ? g.node : null,
      paths: find(svg, (n) => n.type === 'path').map((n) => [classesOf(n).join('.'), attr(n, 'd')]),
      circles: find(svg, (n) => n.type === 'circle').map((n) => [attr(n, 'cx'), attr(n, 'cy'), attr(n, 'r')])
    };
  };

  /* ---------- 连线 ---------- */
  const ro = ros.find((r) => r.targets.includes(boardNode()));
  ok('连线：ResizeObserver 观察 div.zp-board', !!ro);
  const l0 = lineParts();
  eq('挂载后第一次画线：选中宫（命宫）连到对宫和两个三合宫：两条 path（三角 + 虚线 zp-dash）、四个点；不播描线（zp-still）',
    [l0.cls, l0.paths.map((p) => p[0]), l0.circles.length], [['zp-lines', 'zp-still'], ['', 'zp-dash'], 4]);
  /* 给盘面和宫格真实的位置：盘面在 (10, 20)，宫格 96 × 96、间距 100 */
  board(tree()).node.getBoundingClientRect = () => ({ left: 10, top: 20, width: 400, height: 400, x: 10, y: 20, right: 410, bottom: 420 });
  for (let i = 0; i < 12; i++) {
    const [col, row] = CELL_POS[i];
    const l = 10 + (col - 1) * 100, tp = 20 + (row - 1) * 100;
    cellNode(i).getBoundingClientRect = () => ({ left: l, top: tp, width: 96, height: 96, x: l, y: tp, right: l + 96, bottom: tp + 96 });
  }
  if (ro) { ro.cb([]); rt.flush(); }
  const l1 = lineParts();
  eq('尺寸变了（ResizeObserver 回调）：按宫格相对盘面的位置重画，选中宫没变 → zp-still，g 原地更新',
    [l1.cls, l1.paths, l1.circles, l1.g === l0.g],
    [['zp-lines', 'zp-still'], [['', 'M196.0 300.0 L96.0 96.0 L300.0 196.0 Z'], ['zp-dash', 'M196.0 300.0 L200.0 96.0']],
      [[196, 300, 3.5], [200, 96, 2.5], [96, 96, 2.5], [300, 196, 2.5]], true]);
  const lc = rt.count('BoardLines');
  if (ro) { ro.cb([]); rt.flush(); }
  eq('位置没变再回调一次：连线组件不重渲染', rt.count('BoardLines') - lc, 0);

  /* ---------- 选宫的重渲染次数和节点复用 ---------- */
  const section0 = first(tree(), 'zp-chart').node;
  const nodes0 = stableNodes(body());
  const masked0 = maskSelection(body());
  const c0 = counts();
  store.selectPalace(2);
  rt.flush();
  const d1 = delta(c0);
  eq('选宫 11 → 2：时间卡、报告按钮、格局卡、中宫、盘面、ChartPage 都不重渲染',
    [d1.ScopeCard, d1.ScopeReportButton, d1.PatternCard, d1.BoardCenter, d1.ChartBoard, d1.ChartPage], [0, 0, 0, 0, 0, 0]);
  eq('选宫 11 → 2：只有状态变了的 8 个宫格重渲染，各一次', d1.BoardCell, 8);
  ok('选宫：宫位卡和连线重渲染', d1.PalaceCard >= 1 && d1.BoardLines >= 1, J(d1));
  const l2 = lineParts();
  eq('新选中的宫：重画并播描线（去掉 zp-still，g 换成新节点）',
    [l2.cls, l2.paths, l2.g !== l1.g],
    [['zp-lines'], [['', 'M96.0 196.0 L300.0 96.0 L200.0 300.0 Z'], ['zp-dash', 'M96.0 196.0 L300.0 200.0']], true]);
  const c1 = counts();
  store.selectPalace(9);
  rt.flush();
  eq('选宫 2 → 9：同样只有 8 个宫格重渲染，时间卡、格局卡、中宫 0 次', [delta(c1).BoardCell, delta(c1).ScopeCard, delta(c1).PatternCard, delta(c1).BoardCenter], [8, 0, 0, 0]);
  ok('选宫两次：宫位卡、连线、窄档页签以外的宿主节点一个没换（没有增、删、换 key），宫格按钮还是那 12 个节点',
    sameNodes(nodes0, stableNodes(body())), `${nodes0.length} → ${stableNodes(body()).length}`);
  eq('选宫两次：盖住允许变的地方后，运行时的树也一个属性不差', diffTrees(masked0, maskSelection(body())), []);
  ok('选宫不重放入场：section.zp-chart 没有 zp-enter', !section0.classList.contains('zp-enter') && first(tree(), 'zp-chart').node === section0);
  /* 宽档：再挪一次位置（宫格变大），选中宫没变 → zp-still，g 不换 */
  for (let i = 0; i < 12; i++) {
    const [col, row] = CELL_POS[i];
    const l = 10 + (col - 1) * 150, tp = 20 + (row - 1) * 150;
    cellNode(i).getBoundingClientRect = () => ({ left: l, top: tp, width: 146, height: 146, x: l, y: tp, right: l + 146, bottom: tp + 146 });
  }
  const g9 = lineParts().g;
  if (ro) { ro.cb([]); rt.flush(); }
  eq('选宫之后窗口变了：重画、不播描线（zp-still），g 原地更新', [lineParts().cls, lineParts().g === g9, lineParts().paths[1][1]], [['zp-lines', 'zp-still'], true, 'M450.0 450.0 L146.0 146.0']);

  /* ---------- 方向键 ---------- */
  section('命盘页（T5b）：方向键、点星名、窄档、隐藏、重挂载（运行时）');
  cellNode(9).focus();
  const r1 = rt.key(cellNode(9), 'ArrowRight');
  eq('→：沿十二宫的环顺走一格（9 → 10），焦点跟着到新宫格，阻止默认滚动', [store.getState().session.sel, rt.doc.activeElement === cellNode(10), r1.prevented], [10, true, true]);
  rt.key(cellNode(10), 'ArrowLeft');
  eq('←：逆走一格（10 → 9）', [store.getState().session.sel, rt.doc.activeElement === cellNode(9)], [9, true]);
  rt.key(cellNode(9), 'ArrowUp');
  eq('↑：跳到对宫（9 → 3）', [store.getState().session.sel, rt.doc.activeElement === cellNode(3)], [3, true]);
  rt.key(cellNode(3), 'ArrowDown');
  eq('↓：也跳到对宫（3 → 9）', [store.getState().session.sel, rt.doc.activeElement === cellNode(9)], [9, true]);
  eq('roving tabIndex：只有选中的宫格是 0', cellsOf(tree()).map((c) => attr(c, 'tabIndex')).map((x, i) => (x === 0 ? i : null)).filter((x) => x !== null), [9]);
  const r2 = rt.key(cellNode(9), 'Enter');
  eq('别的键不管（不改选中、不阻止默认）', [store.getState().session.sel, r2.prevented], [9, false]);
  rt.click(cellNode(11));
  eq('点宫格：选中它', store.getState().session.sel, 11);

  /* ---------- 点星名（组件内状态，换宫复位） ---------- */
  const pal = () => palaceCard(tree());
  const starBtns = () => buttons(first(pal(), 'zp-stars'));
  rt.click(starBtns()[1]);
  eq('点「太阴」：解释换成太阴的，它按下、太阳弹起', [text(first(pal(), 'zp-brief')), starBtns().map((n) => attr(n, 'aria-pressed'))], [BRIEF.太阴, ['false', 'true']]);
  store.selectPalace(1);
  rt.flush();
  eq('换到福德：解释是福德第一颗主星（天机）的', text(first(pal(), 'zp-brief')), BRIEF.天机);
  rt.click(buttons(find(pal(), (n) => n.type === 'dd')[0])[0]);
  eq('点辅星「天魁」：解释换成天魁的', [text(first(pal(), 'zp-brief')), attr(buttons(find(pal(), (n) => n.type === 'dd')[0])[0], 'aria-pressed')], [BRIEF.天魁, 'true']);
  store.selectPalace(11);
  rt.flush();
  eq('回到命宫：点过的星已经复位，解释回到太阳', [text(first(pal(), 'zp-brief')), starBtns().map((n) => attr(n, 'aria-pressed'))], [BRIEF.太阳, ['true', 'false']]);

  /* ---------- 流式增量 ---------- */
  store.setTab('natal');
  rt.flush();
  store.ask('事业');
  await settle();
  rt.flush();
  const chat = pipe.calls[pipe.calls.length - 1];
  const cc = counts();
  for (let i = 0; i < 60; i++) chat.send('delta', { text: '写' });
  await settle(6);
  rt.flush();
  eq('对话流式 60 次增量：命盘页没有任何组件重渲染', Object.values(delta(cc)).filter((n) => n !== 0).length, 0);
  chat.send('done', { text: '写'.repeat(60) }).end();
  await settle(6);
  rt.flush();
  const reportBtn = () => buttons(first(scopeCard(tree()), 'zp-card-f'))[1];
  const cr = counts();
  store.startReport();
  await settle();
  rt.flush();
  const rp = pipe.calls[pipe.calls.length - 1];
  eq('报告开始写：只有报告按钮重渲染一次，字换成「报告正在写…」', [delta(cr).ScopeReportButton, delta(cr).ScopeCard, text(reportBtn())], [1, 0, '报告正在写…']);
  const cd = counts();
  for (let i = 0; i < 100; i++) rp.send('delta', { text: '文' });
  await settle(8);
  rt.flush();
  eq('报告流式 100 次增量：命盘页没有任何组件重渲染', delta(cd), Object.fromEntries(CHART_COMPONENTS.map((n) => [n, 0])));
  rp.send('done', { text: '文'.repeat(100) }).end();
  await settle(6);
  rt.flush();
  eq('报告写完：报告按钮再重渲染一次，「看完整报告」；其余不动', [delta(cd).ScopeReportButton, delta(cd).ScopeCard, delta(cd).BoardCell, text(reportBtn())], [1, 0, 0, '看完整报告']);
  store.dismissToast();

  /* ---------- 看报告时隐藏，不卸载 ---------- */
  const bodyNode = body().node;
  const cellNodes = cellsOf(tree()).map((c) => c.node);
  store.setStage('report');
  rt.flush();
  eq('看报告：div.zp-body 带 hidden，还是同一个节点，宫格节点都在', [attr(body(), 'hidden'), body().node === bodyNode, sameNodes(cellNodes, cellsOf(tree()).map((c) => c.node))], [true, true, true]);
  store.setStage('board');
  rt.flush();

  /* ---------- 卸载再挂载 ---------- */
  store.selectPalace(5);
  rt.flush();
  const before = maskLines(body());
  rt.unmount();
  eq('卸载：ResizeObserver 都断开了', ros.filter((r) => r.targets.length && !r.off).length, 0);
  rt.mount(h(env.Main));
  rt.flush();
  eq('卸载再挂载：命盘页一模一样（选中宫、页签、卡片；连线另看）', diffTrees(before, maskLines(body())), []);
  eq('重挂载后的第一次画线不播描线（zp-still），点和线都在', [lineParts().cls, lineParts().paths.length, lineParts().circles.length], [['zp-lines', 'zp-still'], 2, 4]);
  ok('再挂载不重放入场', !first(tree(), 'zp-chart').node.classList.contains('zp-enter'));
  rt.unmount();

  /* ---------- 窄档 ---------- */
  rt.width = 600;
  rt.mount(h(env.Main));
  timers.runAll();
  const panes = () => region(tree(), 'PANES')[0];
  const paneTabs = () => find(panes(), (n) => attr(n, 'role') === 'tab');
  eq('窄档（600px）：有 PANES，三个页签，按下的是宫位卡（之前点过宫）',
    [attr(first(tree(), 'zp-root'), 'data-w'), paneTabs().map((n) => [text(n), attr(n, 'aria-selected')]), attr(first(tree(), 'zp-side'), 'data-pane')],
    ['narrow', [['本命', 'false'], ['格局', 'false'], ['迁移', 'true']], 'detail']);
  rt.click(paneTabs()[0]);
  eq('点「本命」页签：pane = scope，data-pane 跟着变', [store.getState().session.pane, attr(first(tree(), 'zp-side'), 'data-pane')], ['scope', 'scope']);
  const cs = counts();
  rt.click(cellNode(4));
  eq('窄档点宫格：切到宫位卡，第三个页签换成新宫名；时间卡、格局卡、中宫不重渲染',
    [store.getState().session.pane, attr(first(tree(), 'zp-side'), 'data-pane'), paneTabs().map((n) => text(n)), delta(cs).ScopeCard, delta(cs).PatternCard, delta(cs).BoardCenter],
    ['detail', 'detail', ['本命', '格局', '仆役'], 0, 0, 0]);
  rt.unmount();
}

/* ================================================================ *
 * 源码和样式
 * ================================================================ */
async function sourceChecks(t, ok, eq, section) {
  section('命盘页（T5b）：源码和样式');
  const src = readFileSync(join(t.root, 'src', 'ui', '70-chart.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const cjk = code.match(/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/g) || [];
  eq('70-chart.js：注释之外没有中文（可见文字都走 t()）', cjk.length, 0);
  const dict = JSON.parse(readFileSync(join(t.root, 'src', 'ui', 'i18n', '70-chart.json'), 'utf8'));
  const keys = Object.keys(dict);
  eq('i18n/70-chart.json：每个键都以 chart 开头、是 [中文, English]', keys.filter((k) => !/^chart[A-Z]/.test(k) || !Array.isArray(dict[k]) || dict[k].length !== 2 || !dict[k].every((s) => typeof s === 'string' && s)), []);
  eq('i18n/70-chart.json：每个键都在 70-chart.js 里引用', keys.filter((k) => !code.includes("'" + k + "'")), []);
  const used = [...code.matchAll(/\bt\('(chart\w+)'/g)].map((m) => m[1]);
  eq('70-chart.js 里 t("chart…") 用到的键都在 70-chart.json 里', [...new Set(used.filter((k) => !(k in dict)))], []);
  const names = [...code.matchAll(/^(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  eq('顶层名字都带 T5b 的前缀（Chart / Board / Scope / Palace / Pattern 组件，chart / CHART_ 小工具）',
    names.filter((n) => !/^(?:Chart|Board|Scope|Palace|Pattern)[A-Z]|^ChartPage$|^chart[A-Z]|^CHART_[A-Z]/.test(n)), []);
  ok('70-chart.js 声明了 function ChartPage(props)', /^function ChartPage\(/m.test(code));
  eq('70-chart.js 没有 setInterval( / animation / window. / document.', ['setInterval(', 'animation', 'window.', 'document.'].filter((s) => code.includes(s)), []);

  const css = ['10-base.css', '70-chart.css'].map((f) => readFileSync(join(t.root, 'src', 'ui', 'css', f), 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
  const STILL = /\.zp-(?:cell|card|scope|pats|detail|board|center|side|body|star|pat|step|mut|strip|strip-cell|now-row|plate|cpats|fly)(?![\w-])/;
  const bad = rules.filter(([sel, body]) => STILL.test(sel) && /(^|[;\s])animation(-name)?\s*:/.test(body)).map(([sel]) => sel);
  eq('样式：宫格、卡片、盘面、中宫、左栏的规则里没有 animation（选宫、切页签不重放任何东西）', bad, []);
  ok('样式：.zp-cell 和 .zp-card 的规则都找到了', rules.some(([sel]) => /\.zp-cell(?![\w-])/.test(sel)) && rules.some(([sel]) => /\.zp-card(?![\w-])/.test(sel)));
}
