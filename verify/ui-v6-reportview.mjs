/**
 * verify/ui-v6-reportview.mjs — 报告页（src/ui/85-reportview.js，T7）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。用 client-harness 的极简 React 运行时（bootRuntime）挂整块面板，
 * 通过 store 的动作和可控的流驱动界面，在渲染出的树上断言。覆盖 plan T7 的检查清单：
 *   - 纯函数：离底部不到 80px 才跟随（rvShouldStick）；按部分切原文（rvChunks + rvSectionView）和
 *     ZWReport.splitSections / sectionHtml 逐个前缀一致；进度只看标题行（rvOutline）和 ZWReport.progress 一致；
 *     文件名清理；「问这段」按钮的位置
 *   - 四种状态（还没写 / 正在写 / 中断 / 写完）各自的控件；两个区域的 data-region
 *   - 一次增量之后：前面各部分的元素对象原样复用，只有最后一部分（换部分时加上状态栏、目录）变化
 *   - 舞台切换时报告舞台留在树里（hidden，不卸载）；命盘舞台（T5b 的 ChartPage）在的时候也一样
 *   - 「重新写」要在 4 秒内（注入的定时器）点第二次；顶栏「报告」页签在写的时候带脉冲点，不管在哪个页签
 *   - 下载：调 buildReportHtml(meta, report.text)，文件名清理过，blob 链接用完撤销；复制全文；成功失败都有提示
 *   - 跟随底部、阅读位置（requestAnimationFrame 节流写进 store，再显示 / 重新挂载时回到原处）、目录高亮和跳转
 *   - 选中至少 4 个字出现「问这段」，引用截到 600 字，打开紫微师、清掉选区
 * 运行时里的假 DOM 没有滚动和布局：测试直接给节点写 scrollTop / scrollHeight / clientHeight，
 * 给部分节点换 getBoundingClientRect，用手动的 requestAnimationFrame 队列。
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）。"今天"固定为 2026-11-19。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bootRuntime, classesOf, diffTrees, find, findByClass, settle, text } from './client-harness.mjs';

const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '',
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const J = (v) => JSON.stringify(v);

const TITLES14 = ['命盘总览', '性格大略', '家庭关系', '婚姻情感', '子女培育', '财富管理', '健康养生',
  '事业发展', '朋友贵人', '居家风水', '心灵福德', '出行迁移', '大限节奏', '综合建议'];
const NUMS14 = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四'];

/* 样稿：盘前一句（没有标题的开头）、14 个有编号的部分（段落、小标题、列表、表格、引用、分隔线）、十二字心法 */
const body = (i) => [
  `第 ${i + 1} 部分的第一段，讲这一方面的大势。`,
  '',
  `### 小节 ${i + 1}`,
  '',
  '- 要点一',
  '- 要点二',
  '',
  '| 项 | 说明 |',
  '|---|---|',
  '| 甲 | 乙 |',
  '',
  '> 一句提醒。',
  '',
  '---'
].join('\n');
const LEAD = '> 盘前须知：以下据命盘而写，仅供参考。';
const PARTS = TITLES14.map((title, i) => `## ${NUMS14[i]}、${title}\n\n${body(i)}`);
const MOTTO = '## 十二字心法\n\n守正 知时 惜缘 行远';
const REPORT = [LEAD, ...PARTS, MOTTO].join('\n\n');

/* 流式切点：第三部分写了一句 / 第三部分写完 / 第四部分刚开头 */
const CUT1 = REPORT.indexOf('## 三、家庭关系') + '## 三、家庭关系\n\n第 3 部分的第一段'.length;
const CUT2 = REPORT.indexOf('\n\n## 四、婚姻情感');
const CUT3 = REPORT.indexOf('## 四、婚姻情感') + '## 四、婚姻情感\n\n第 4 部分'.length;

const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const charsOf = (s) => String(s).replace(/\s/g, '').length;

const attr = (el, k) => (el && el.props ? el.props[k] : undefined);
const isEl = (n) => !!n && typeof n === 'object' && 'type' in n && 'children' in n;
const norm = (x) => (Array.isArray(x) ? x.flat(Infinity) : [x]).filter((n) => n !== null && n !== undefined && n !== false && n !== true);

/** diffTrees 用 JSON.stringify 比属性：对象 ref 里装着运行时的假 DOM 节点（有环），先去掉 ref 再比 */
const stripRefs = (n) => {
  if (Array.isArray(n)) return n.map(stripRefs);
  if (!isEl(n)) return n;
  const props = Object.assign({}, n.props || {});
  delete props.ref;
  return { type: n.type, props, children: (n.children || []).map(stripRefs) };
};

/** 和 diffTrees 同一种路径写法：root>tag[key=k] 或 root>tag[i] */
function pathTo(node, target, path = 'root') {
  if (node === target) return path;
  if (!isEl(node)) return null;
  const kids = norm(node.children || []);
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    const key = isEl(k) && k.props && k.props.key !== undefined ? `[key=${k.props.key}]` : `[${i}]`;
    const p = pathTo(k, target, `${path}>${isEl(k) ? k.type : '#text'}${key}`);
    if (p) return p;
  }
  return null;
}

export default async function reportView(t) {
  const { ok, section } = t;
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);
  const skip = (name, why) => console.log(`  ⚠️ 已跳过，未验证：${name}（${why}）`);
  const guard = async (name, fn) => {
    try { await fn(); } catch (e) { ok(name + '：跑完没有抛错', false, String((e && e.stack) || e).split('\n').slice(0, 4).join(' | ')); }
  };

  section('v6 报告页：装载（极简 React 运行时）');
  const env = t.client ? bootRuntime(t.client, { now: NOW, width: 1300 }) : { error: new Error('没有 v6 bundle') };
  ok('v6 bundle 在运行时里装载、apply()、建默认 store', !env.error, env.error && env.error.message);
  if (env.error) return;
  const { rt, store, h, timers, pipe, win, loaded } = env;
  const U = win.ZWUi;
  const R = win.ZWReport;
  ok('ReportStage 已声明（ProApp 按这个名字渲染报告舞台）', /^function ReportStage\(/m.test(t.ui ? t.ui.text : ''));

  /* 手动的 requestAnimationFrame：测试自己决定什么时候过一帧 */
  const frames = new Map();
  let frameSeq = 0;
  win.requestAnimationFrame = (fn) => { frameSeq += 1; frames.set(frameSeq, fn); return frameSeq; };
  win.cancelAnimationFrame = (id) => { frames.delete(id); };
  const runFrames = () => { const list = [...frames.values()]; frames.clear(); list.forEach((f) => f()); rt.flush(); return list.length; };

  /* ---------------------------------------------------------------- */
  section('v6 报告页：纯函数');
  await guard('纯函数', () => {
    const have = ['rvShouldStick', 'rvChunks', 'rvSectionView', 'rvOutline', 'rvSafeName', 'rvFileName', 'rvPickPlace'].filter((k) => typeof U[k] === 'function');
    eq('ZWUi 暴露报告页的纯函数（rvShouldStick / rvChunks / rvSectionView / rvOutline / rvSafeName / rvFileName / rvPickPlace）', have.length, 7);
    if (have.length < 7) return;
    eq('rvShouldStick：离底部 79px 跟随、80px 不跟随；整篇比窗口短时跟随；在顶上的长文不跟随',
      [U.rvShouldStick(2000, 1321, 600), U.rvShouldStick(2000, 1320, 600), U.rvShouldStick(600, 0, 600), U.rvShouldStick(2000, 0, 600)],
      [true, false, true, false]);

    /* 按部分切：每一个前缀上都和 ZWReport.splitSections + sectionHtml 一字不差 */
    const rebuilt = (v) => '<section class="' + v.cls + '" id="' + v.id + '" data-sec="' + v.id + '">' + v.inner + '</section>';
    const viaChunks = (md) => U.rvChunks(md).map((c, i) => { const v = U.rvSectionView(c, i); return v ? rebuilt(v) : null; });
    const viaModule = (md) => R.splitSections(md).map(R.sectionHtml);
    const lines = REPORT.split('\n');
    const prefixes = new Set();
    for (let i = 0; i <= lines.length; i++) prefixes.add(lines.slice(0, i).join('\n'));
    for (let i = 0; i <= REPORT.length; i += 7) prefixes.add(REPORT.slice(0, i));
    ['', '#', '## ', '##', '\n\n#', '> 开头\n##', '## 一、\n正文\n#', '## 一、命盘\n正文\n\n\n', '## 一、命盘\n---\n\n## 二', '  \n  \n## 五\n###', '正文\n###\n## 二、乙']
      .forEach((s) => prefixes.add(s));
    const bad = [...prefixes].filter((md) => J(viaChunks(md)) !== J(viaModule(md)));
    eq(`rvChunks + rvSectionView 在 ${prefixes.size} 个前缀和边界写法上都等于 ZWReport.splitSections + sectionHtml`, bad.slice(0, 3), []);
    const badProg = [...prefixes].filter((md) => J(U.rvOutline(md).progress) !== J(R.progress(md)));
    eq('rvOutline(md).progress 只看标题行，在每个前缀上都等于 ZWReport.progress(md)', badProg.slice(0, 3), []);
    const o = U.rvOutline(REPORT);
    eq('rvOutline(全文)：有开头一段、14 个有编号的部分在第 1–14 位、字数', [o.lead, o.count, o.marks, o.chars],
      [true, 14, '1,2,3,4,5,6,7,8,9,10,11,12,13,14', charsOf(REPORT)]);
    eq('增量只改最后一个部分的原文（前面各部分的切片逐字相同）',
      [J(U.rvChunks(REPORT.slice(0, CUT2)).slice(0, 4)) === J(U.rvChunks(REPORT.slice(0, CUT3)).slice(0, 4)),
        U.rvChunks(REPORT.slice(0, CUT1)).length, U.rvChunks(REPORT.slice(0, CUT3)).length], [true, 4, 5]);

    eq('rvSafeName：去掉文件名里的非法字符和控制字符、合并空白', U.rvSafeName('a/b:c*?"<>|d\u0001\te  f\\g'), 'abcd e fg');
    eq('rvFileName：人生鲲鹏计划_<称呼>_<yyyymmdd>.html', U.rvFileName('甲/乙', { y: 2026, m: 11, d: 9 }), '人生鲲鹏计划_甲乙_20261109.html');
    eq('rvFileName：称呼清理后为空时用「未命名」', U.rvFileName(' :*? ', { y: 2026, m: 1, d: 19 }), '人生鲲鹏计划_未命名_20260119.html');
    const box = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
    eq('rvPickPlace：放在选区右下方（经 ZWUi.pickPoint），不出阅读栏',
      [U.rvPickPlace({ left: 100, right: 300, top: 200, bottom: 220 }, box), U.rvPickPlace({ left: 700, right: 799, top: 580, bottom: 598 }, box), U.rvPickPlace({ left: 0, right: 10, top: 0, bottom: 4 }, box)],
      [{ x: 264, y: 228 }, { x: 716, y: 560 }, { x: 80, y: 32 }]);
  });

  /* ---------------------------------------------------------------- */
  const entry = store.addChart(GOLDEN, '甲');
  const keyA = store.keyOf(entry);
  store.openChart(entry.id);
  store.setStage('report');
  rt.mount(h(env.Main));

  const tree = () => rt.tree();
  const stageEl = () => findByClass(tree(), 'zp-rbody')[0];
  const tocEl = () => findByClass(stageEl(), 'zp-rtoc')[0];
  const mainEl = () => findByClass(stageEl(), 'zp-rmain')[0];
  const barEl = () => findByClass(mainEl(), 'zp-rbar')[0];
  const scrollEl = () => findByClass(mainEl(), 'zp-rscroll')[0];
  const topEl = () => findByClass(mainEl(), 'zp-rtop')[0];
  const secsEl = () => find(mainEl(), (n) => n.type === 'section' && classesOf(n).includes('zr-sec'));
  const items = () => find(findByClass(tocEl(), 'zp-toc')[0], (n) => n.type === 'button');
  const btnIn = (root, label) => find(root, (n) => n.type === 'button' && text(n) === label)[0] || null;
  const footBtns = () => find(findByClass(tocEl(), 'zp-card-f')[0], (n) => n.type === 'button');
  const reportTab = () => find(tree(), (n) => attr(n, 'role') === 'tab' && text(n).startsWith('报告'))[0];
  const pulses = () => findByClass(reportTab(), 'zp-pulse').length;
  const tocText = () => items().map((n) => [text(find(n, (x) => x.type === 'i')[0]), text(find(n, (x) => x.type === 'span')[0])].join(''));
  const states = (list) => list.map((n) => classesOf(n).find((c) => /^zp-(done|now|todo)$/.test(c)) || '');
  const secHtml = (el) => '<section class="' + attr(el, 'className') + '" id="' + attr(el, 'id') + '" data-sec="' + attr(el, 'data-sec') + '">' +
    ((attr(el, 'dangerouslySetInnerHTML') || {}).__html || '') + '</section>';
  const lastPipe = () => pipe.calls[pipe.calls.length - 1];

  /* ---------------------------------------------------------------- */
  section('v6 报告页：还没写');
  await guard('还没写', async () => {
    const stage = stageEl();
    ok('报告舞台 div.zp-rbody 在 section.zp-chart 里，看报告时不隐藏', !!stage && stage.type === 'div' && attr(stage, 'hidden') === false &&
      find(findByClass(tree(), 'zp-chart')[0], (n) => n.node === stage.node).length === 1);
    eq('两个区域：section.zp-card.zp-rtoc[data-region=REPORT_TOC] 在 aside.zp-rside 里；div.zp-rmain[data-region=REPORT_DOC]',
      [tocEl() && tocEl().type, classesOf(tocEl()), attr(tocEl(), 'data-region'), find(findByClass(stage, 'zp-rside')[0], (n) => n.node === tocEl().node).length,
        mainEl() && mainEl().type, attr(mainEl(), 'data-region')],
      ['section', ['zp-card', 'zp-rtoc'], 'REPORT_TOC', 1, 'div', 'REPORT_DOC']);
    const empty = findByClass(mainEl(), 'zp-rempty')[0];
    const em = findByClass(empty, 'zp-emblem')[0];
    const svg = (attr(em, 'dangerouslySetInnerHTML') || {}).__html || '';
    eq('阅读栏：徽记（在有 --zr-* 映射的 .zr-prose 里）、标题、一句说明、开始写；没有状态栏和正文',
      [!!empty, classesOf(em), svg.startsWith('<svg') && svg.includes('aria-label="甲 的星图"'), text(find(empty, (n) => n.type === 'h2')[0]),
        text(find(empty, (n) => n.type === 'p')[0]), classesOf(btnIn(empty, '开始写')), !!barEl(), !!scrollEl()],
      [true, ['zp-emblem', 'zr-prose'], true, '完整报告', '14 个方面，约 3 分钟。写完自动保存在本机，可以下载。', ['zp-btn-primary'], false, false]);
    eq('目录：标题「完整报告」、计数「还没写」、nav[aria-label=目录]，14 个将要写的部分，全是 zp-todo 且不能点；没有底部按钮',
      [text(find(tocEl(), (n) => n.type === 'h3')[0]), text(findByClass(tocEl(), 'zp-cnt')[0]), attr(findByClass(tocEl(), 'zp-toc')[0], 'aria-label'),
        tocText(), states(items()).every((s) => s === 'zp-todo'), items().every((n) => attr(n, 'disabled') === true), findByClass(tocEl(), 'zp-card-f').length],
      ['完整报告', '还没写', '目录', NUMS14.map((n, i) => n + TITLES14[i]), true, true, 0]);

    /* 紫微师在回答时（同一张盘只有一个任务）：开始写不能点 */
    store.ask('事业');
    await settle();
    rt.flush();
    const busyBtn = btnIn(mainEl(), '开始写');
    eq('紫微师在回答：开始写 disabled，title 说明原因', [attr(busyBtn, 'disabled'), attr(busyBtn, 'title')], [true, '紫微师正在回答，答完再写']);
    lastPipe().send('done', { text: '答' }).end();
    await settle(6);
    store.dismissToast();
    rt.flush();
    eq('回答完：开始写可以点', attr(btnIn(mainEl(), '开始写'), 'disabled'), undefined);
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：正在写');
  let pipeA = null;
  await guard('正在写', async () => {
    const before = pipe.calls.length;
    rt.click(btnIn(mainEl(), '开始写'));
    await settle();
    rt.flush();
    pipeA = lastPipe();
    eq('点「开始写」：store.startReport() 发出 mode=report 的请求', [pipe.calls.length - before, pipeA.body && pipeA.body.mode], [1, 'report']);
    const bar = barEl();
    eq('状态栏：role=status，脉冲点（aria-hidden）、「正在写第 1 / 14 部分 · 命盘总览」、停止',
      [attr(bar, 'role'), attr(findByClass(bar, 'zp-pulse')[0], 'aria-hidden'), text(findByClass(bar, 'zp-rbar-text')[0]), find(bar, (n) => n.type === 'button').map(text)],
      ['status', true, '正在写第 1 / 14 部分 · 命盘总览', ['停止']]);
    const sc = scrollEl();
    const art = find(sc, (n) => n.type === 'article')[0];
    eq('正文：div.zp-rscroll[tabIndex=0]（有名字）> article.zr-prose.zp-rdoc > header.zp-rtop + div.zp-rsecs（还没有部分）',
      [attr(sc, 'tabIndex'), attr(sc, 'aria-label'), classesOf(art), classesOf(art.children.flat(Infinity).filter(isEl)[0]), classesOf(art.children.flat(Infinity).filter(isEl)[1]), secsEl().length],
      [0, '报告正文', ['zr-prose', 'zp-rdoc'], ['zp-rtop'], ['zp-rsecs'], 0]);
    const top = topEl();
    const topSvg = (attr(findByClass(top, 'zp-emblem')[0], 'dangerouslySetInnerHTML') || {}).__html || '';
    eq('页头：小徽记、「甲 · 完整报告」、生辰一行、写的时候不变的一行',
      [topSvg.startsWith('<svg') && topSvg.includes('aria-label="甲 的星图"'), text(find(top, (n) => n.type === 'h1')[0]), find(top, (n) => n.type === 'p').map(text)],
      [true, '甲 · 完整报告', ['1992.05.03 · 农历四月初一 · 辰时 · 木三局', '正在写，写完自动保存在本机']]);
    eq('目录：计数「正在写」；第一部分 zp-now（带「正在写」，还没有正文所以不能点），其余 zp-todo',
      [text(findByClass(tocEl(), 'zp-cnt')[0]), states(items()).slice(0, 3), text(findByClass(items()[0], 'zp-toc-now')[0]), attr(items()[0], 'disabled'), findByClass(tocEl(), 'zp-card-f').length],
      ['正在写', ['zp-now', 'zp-todo', 'zp-todo'], '正在写', true, 0]);

    eq('顶栏「报告」页签：写的时候有脉冲点', pulses(), 1);
    store.setTab('daily');
    rt.flush();
    eq('换到「流日」页签：报告舞台隐藏（还在树里），脉冲点还在', [attr(stageEl(), 'hidden'), pulses()], [true, 1]);
    store.setStage('report');
    rt.flush();

    pipeA.send('delta', { text: REPORT.slice(0, CUT1) });
    await settle();
    rt.flush();
    const want = R.splitSections(REPORT.slice(0, CUT1)).map(R.sectionHtml);
    eq('第一次增量：正文按部分出现（开头一段 + 一、二、三），每个部分就是 sectionHtml 的结果',
      [secsEl().length, secsEl().map(secHtml).every((s, i) => s === want[i]), classesOf(secsEl()[0])], [4, true, ['zr-sec', 'zr-lead']]);
    eq('状态栏：正在写第 3 / 14 部分 · 家庭关系', text(findByClass(barEl(), 'zp-rbar-text')[0]), '正在写第 3 / 14 部分 · 家庭关系');
    eq('目录：一、二 zp-done，三 zp-now；写过的能点', [states(items()).slice(0, 4), items().slice(0, 3).map((n) => attr(n, 'disabled'))],
      [['zp-done', 'zp-done', 'zp-now', 'zp-todo'], [undefined, undefined, undefined]]);
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：一次增量只动最后一部分');
  const snap = () => stripRefs(stageEl());
  const zrSecs = (root) => find(root, (n) => n.type === 'section' && classesOf(n).includes('zr-sec'));
  await guard('增量', async () => {
    const stage0 = snap();
    const props0 = secsEl().map((n) => n.props);
    const c0 = { sec: rt.count('ReportSection'), toc: rt.count('ReportToc'), bar: rt.count('ReportBar'), stage: rt.count('ReportStage'), top: rt.count('ReportTop') };
    pipeA.send('delta', { text: REPORT.slice(CUT1, CUT2) });
    await settle();
    rt.flush();
    const stage1 = snap();
    const props1 = secsEl().map((n) => n.props);
    eq('段内增量：前三个部分的元素对象原样复用（props 是同一个对象），最后一个换了',
      [props1.slice(0, 3).map((p, i) => p === props0[i]), props1[3] === props0[3], secHtml(secsEl()[3]).includes('| 甲 | 乙 |') || secHtml(secsEl()[3]).includes('<table')],
      [[true, true, true], false, true]);
    eq('段内增量：只重画最后一个部分；目录、状态栏、页头、舞台都不重画',
      [rt.count('ReportSection') - c0.sec, rt.count('ReportToc') - c0.toc, rt.count('ReportBar') - c0.bar, rt.count('ReportTop') - c0.top, rt.count('ReportStage') - c0.stage],
      [1, 0, 0, 0, 0]);
    const lastPath = pathTo(stage0, zrSecs(stage0)[3]);
    const d1 = diffTrees(stage0, stage1);
    ok('段内增量：报告舞台里的差异都在最后一个部分里', d1.length > 0 && !!lastPath && d1.every((x) => x.path.startsWith(lastPath)), J(d1.map((x) => x.path).slice(0, 4)));

    const props2 = secsEl().map((n) => n.props);
    const c1 = { sec: rt.count('ReportSection'), toc: rt.count('ReportToc'), bar: rt.count('ReportBar') };
    const before = snap();
    pipeA.send('delta', { text: REPORT.slice(CUT2, CUT3) });
    await settle();
    rt.flush();
    const after = snap();
    eq('换部分的增量：前四个部分的元素对象原样复用，新出现第五个；只画新的那一个',
      [secsEl().length, secsEl().slice(0, 4).map((n, i) => n.props === props2[i]), rt.count('ReportSection') - c1.sec], [5, [true, true, true, true], 1]);
    eq('换部分：状态栏、目录各重画一次（进度变了）', [rt.count('ReportBar') - c1.bar, rt.count('ReportToc') - c1.toc, text(findByClass(barEl(), 'zp-rbar-text')[0])],
      [1, 1, '正在写第 4 / 14 部分 · 婚姻情感']);
    const allowed = [pathTo(before, findByClass(before, 'zp-rsecs')[0]), pathTo(before, findByClass(before, 'zp-rbar')[0]), pathTo(before, findByClass(before, 'zp-rtoc')[0])];
    const oldSecs = zrSecs(before).map((n) => pathTo(before, n));
    const d2 = diffTrees(before, after);
    ok('换部分：差异只在部分列表（多了一个）、状态栏、目录里，前面的部分没有差异',
      d2.length > 0 && allowed.every(Boolean) && d2.every((x) => allowed.some((p) => x.path.startsWith(p))) && d2.every((x) => !oldSecs.some((p) => x.path.startsWith(p))),
      J(d2.map((x) => x.path).slice(0, 6)));

    const c2 = { sec: rt.count('ReportSection'), toc: rt.count('ReportToc'), bar: rt.count('ReportBar') };
    for (let i = 0; i < 30; i++) pipeA.send('delta', { text: '字' });
    await settle(8);
    rt.flush();
    eq('30 次段内增量：目录、状态栏都不重画；每次只画最后一个部分',
      [rt.count('ReportToc') - c2.toc, rt.count('ReportBar') - c2.bar, rt.count('ReportSection') - c2.sec <= 30], [0, 0, true]);
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：中断');
  let base = '';
  await guard('中断', async () => {
    rt.click(btnIn(barEl(), '停止'));
    await settle();
    rt.flush();
    base = store.reading().report.text;
    eq('点「停止」：任务停下，已写的保留', [store.job(), store.reading().report.status, base === REPORT.slice(0, CUT3) + '字'.repeat(30)], [null, 'error', true]);
    const bar = barEl();
    eq('状态栏：写到第几部分停了（没有脉冲点）、接着写、重新写（zp-link）',
      [findByClass(bar, 'zp-pulse').length, text(findByClass(bar, 'zp-rbar-text')[0]), find(bar, (n) => n.type === 'button').map((n) => [text(n), classesOf(n)])],
      [0, '写到第 4 部分停了，已经写的都在下面。', [['接着写', ['zp-btn']], ['重新写', ['zp-link']]]]);
    eq('正文照常可读；页头第三行说写了多少字', [secsEl().length, find(topEl(), (n) => n.type === 'p').map(text)[1]],
      [5, `已写 ${group(charsOf(base))} 字，没写完`]);
    eq('目录：计数「没写完」；写过的四个 zp-done（能点），其余 zp-todo；没有 zp-now', [text(findByClass(tocEl(), 'zp-cnt')[0]), states(items()).slice(0, 6), items().slice(0, 5).map((n) => attr(n, 'disabled'))],
      ['没写完', ['zp-done', 'zp-done', 'zp-done', 'zp-done', 'zp-todo', 'zp-todo'], [undefined, undefined, undefined, undefined, true]]);
    eq('顶栏脉冲点消失', pulses(), 0);

    const before = pipe.calls.length;
    rt.click(btnIn(barEl(), '接着写'));
    await settle();
    rt.flush();
    const p = lastPipe();
    eq('点「接着写」：store.continueReport()（续写的提示 + 已写的正文作为上文）',
      [pipe.calls.length - before, p.body.question, p.body.history.length, p.body.history[0] && p.body.history[0].content === base],
      [1, '请接着上文继续写：从断处接着写，不要重复已写内容，也不要重新开头。', 1, true]);
    eq('接着写：状态栏回到正在写第 4 部分', text(findByClass(barEl(), 'zp-rbar-text')[0]), '正在写第 4 / 14 部分 · 婚姻情感');
    p.fail('network down');
    await settle(6);
    rt.flush();
    eq('连接断了：状态栏带上原因', text(findByClass(barEl(), 'zp-rbar-text')[0]), '写到第 4 部分停了：network down');
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：写完');
  let doneText = '';
  await guard('写完', async () => {
    store.continueReport();
    await settle();
    rt.flush();
    const tail = REPORT.slice(base.length);
    lastPipe().send('done', { text: tail }).end();
    await settle(6);
    rt.flush();
    const rep = store.reading().report;
    doneText = rep.text;
    eq('写完：report.status = done，正文 = 续写前 + 续写的', [rep.status, rep.text === base + tail], ['done', true]);
    eq('没有状态栏；十六个部分', [!!barEl(), secsEl().length], [false, 16]);
    eq('页头第三行：<n> 部分 · <字数> 字 · <日期>写完', find(topEl(), (n) => n.type === 'p').map(text)[1], `14 部分 · ${group(charsOf(rep.text))} 字 · 11月19日写完`);
    const its = items();
    eq('目录：以正文里的实际标题为准（有编号的出编号，十二字心法没有编号），开头那段不进目录',
      [tocText(), text(find(its[14], (n) => n.type === 'i')[0])], [[...NUMS14.map((n, i) => n + TITLES14[i]), '十二字心法'], '']);
    eq('目录计数是字数；底部：下载报告、复制全文、重新写（zp-link）',
      [text(findByClass(tocEl(), 'zp-cnt')[0]), footBtns().map((n) => [text(n), classesOf(n)])],
      [`${group(charsOf(rep.text))} 字`, [['下载报告', ['zp-btn']], ['复制全文', ['zp-btn']], ['重新写', ['zp-link']]]]);
    eq('在看着的时候写完：不弹「查看」提示', store.getState().session.toast, null);
    const buttons = find(stageEl(), (n) => n.type === 'button');
    ok(`报告舞台里每个按钮都有文字或 aria-label（${buttons.length} 个）`, buttons.length > 0 && buttons.every((n) => text(n).trim() || attr(n, 'aria-label')));
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：舞台切换');
  await guard('舞台切换', async () => {
    const node = stageEl().node;
    store.setTab('yearly');
    rt.flush();
    eq('切到盘面：报告舞台还在树里，只是 hidden；是同一个 DOM 节点（没有卸载）', [attr(stageEl(), 'hidden'), stageEl().node === node, secsEl().length], [true, true, 16]);
    const declared = /^function ChartPage\(/m.test(t.ui ? t.ui.text : '');
    if (declared) {
      const board = findByClass(tree(), 'zp-body')[0];
      const bnode = board && board.node;
      store.setStage('report');
      rt.flush();
      const board2 = findByClass(tree(), 'zp-body')[0];
      eq('切到报告：命盘舞台 div.zp-body 还在树里，hidden，同一个节点', [!!board2 && attr(board2, 'hidden'), !!board2 && board2.node === bnode], [true, true]);
    } else {
      skip('切到报告时命盘舞台（ChartPage 的 div.zp-body）留在树里', 'ChartPage 还没合进这个分支（T5b），合并后这条会自动运行');
      store.setStage('report');
      rt.flush();
    }
    eq('切回报告：同一个节点，不隐藏', [attr(stageEl(), 'hidden'), stageEl().node === node], [false, true]);
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：重新写要确认');
  await guard('重新写', async () => {
    timers.pending.clear();
    const before = pipe.calls.length;
    const redo = () => footBtns().find((n) => /重新写/.test(text(n)));
    rt.click(redo());
    eq('第一次点：只上膛（文字换成确认语、加 zp-armed），不发请求；挂了一个 4 秒的定时器',
      [text(redo()), classesOf(redo()).includes('zp-armed'), pipe.calls.length - before, timers.delays().includes(4000)],
      ['确定重新写？旧的会被替换', true, 0, true]);
    timers.runAll();
    rt.flush();
    eq('4 秒没再点：复原', [text(redo()), classesOf(redo()).includes('zp-armed')], ['重新写', false]);
    rt.click(redo());
    eq('复原后再点一次：又只是上膛', [pipe.calls.length - before, classesOf(redo()).includes('zp-armed')], [0, true]);
    rt.click(redo());
    await settle();
    rt.flush();
    eq('4 秒内第二次点：重新写（发请求，正在写）', [pipe.calls.length - before, store.reading().report.status, !!barEl()], [1, 'running', true]);
    lastPipe().fail('boom');
    await settle(6);
    rt.flush();
    const rep = store.reading().report;
    eq('重新写一个字都没写出来就失败：恢复原来的报告并提示', [rep.status, !!doneText && rep.text === doneText, store.getState().session.toast && store.getState().session.toast.text, secsEl().length],
      ['done', true, '重新生成没有写出内容，已保留原报告', 16]);
    store.dismissToast();
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：下载和复制');
  await guard('下载和复制', async () => {
    store.renameChart(entry.id, 'a/b:c*?"<>|d');
    rt.flush();
    const calls = [];
    const realBuild = R.buildReportHtml;
    R.buildReportHtml = (meta, md) => { calls.push([meta, md]); return '<!DOCTYPE html><title>x</title>'; };
    const blobs = [];
    win.Blob = class { constructor(parts, opts) { this.parts = parts; this.type = opts && opts.type; blobs.push(this); } };
    const revoked = [];
    win.URL = { createObjectURL: () => 'blob:zw-1', revokeObjectURL: (u) => { revoked.push(u); } };
    const doc = loaded.document;
    const clicks = [];
    const attached = [];
    doc.body = {
      appendChild: (el) => { el.parentNode = doc.body; attached.push(el); return el; },
      removeChild: (el) => { const i = attached.indexOf(el); if (i >= 0) attached.splice(i, 1); el.parentNode = null; return el; }
    };
    const realCreate = doc.createElement;
    doc.createElement = (tag) => ({ tagName: String(tag).toUpperCase(), parentNode: null, click() { clicks.push({ href: this.href, download: this.download, attached: attached.includes(this) }); } });
    timers.pending.clear();
    rt.click(btnIn(tocEl(), '下载报告'));
    const meta = calls[0] && calls[0][0];
    eq('下载：调 buildReportHtml(meta, report.text) 一次；meta 是这张盘的排盘结果、称呼、出生地、职业、性别',
      [calls.length, !!meta && meta.chart === store.currentChart(), meta && meta.name, meta && meta.place, meta && meta.occupation, meta && meta.gender, calls[0] && calls[0][1] === store.reading().report.text],
      [1, true, 'a/b:c*?"<>|d', '', '', 'male', true]);
    eq('文件：text/html 的 Blob，临时 <a download> 挂上去点一下；文件名清理过非法字符',
      [blobs.length, blobs[0] && blobs[0].type, blobs[0] && blobs[0].parts[0], clicks], [1, 'text/html;charset=utf-8', '<!DOCTYPE html><title>x</title>',
        [{ href: 'blob:zw-1', download: '人生鲲鹏计划_abcd_20261119.html', attached: true }]]);
    eq('提示「已开始下载报告」；blob 链接这时还没撤销', [store.getState().session.toast && store.getState().session.toast.text, revoked.length], ['已开始下载报告', 0]);
    timers.runAll();
    eq('稍后撤销 blob 链接、摘掉临时链接', [revoked, attached.length], [['blob:zw-1'], 0]);
    R.buildReportHtml = () => { throw new Error('坏了'); };
    rt.click(btnIn(tocEl(), '下载报告'));
    const tf = store.getState().session.toast;
    eq('生成失败：出错的提示（带原因），不点链接', [tf && tf.text, tf && tf.error, clicks.length], ['下载失败：坏了', true, 1]);
    R.buildReportHtml = realBuild;
    doc.createElement = realCreate;

    let wrote = null;
    win.navigator = { clipboard: { writeText: (s) => { wrote = s; return Promise.resolve(); } } };
    rt.click(btnIn(tocEl(), '复制全文'));
    await settle();
    const t1 = store.getState().session.toast;
    eq('复制全文：剪贴板里是报告全文，提示「已复制全文」', [wrote === store.reading().report.text, t1 && t1.text, t1 && t1.error], [true, '已复制全文', false]);
    win.navigator = { clipboard: { writeText: () => Promise.reject(new Error('denied')) } };
    rt.click(btnIn(tocEl(), '复制全文'));
    await settle();
    const t2 = store.getState().session.toast;
    eq('剪贴板被拒：出错的提示', [t2 && t2.text, t2 && t2.error], ['复制失败，请手动选择文本', true]);
    store.dismissToast();
    store.renameChart(entry.id, '甲');
    rt.flush();
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：问这段');
  await guard('问这段', async () => {
    const pick = () => findByClass(mainEl(), 'zp-rpick')[0];
    let cleared = 0;
    const select = (str, anchor) => {
      win.getSelection = () => ({
        rangeCount: 1, anchorNode: anchor, toString: () => str,
        getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 100, right: 300, top: 200, bottom: 220, width: 200, height: 20 }) }),
        removeAllRanges: () => { cleared++; }
      });
    };
    const mouseUp = () => { scrollEl().props.onMouseUp({}); timers.runAll(); rt.flush(); };
    timers.pending.clear();
    select('三个字', secsEl()[2].node);
    mouseUp();
    eq('选中不到 4 个字：没有「问这段」', !!pick(), false);
    select('命盘总览的一段话', tocEl().node);
    mouseUp();
    eq('选区不在正文里：没有「问这段」', !!pick(), false);
    const long = '长'.repeat(700);
    select('  ' + long + '  ', secsEl()[2].node);
    mouseUp();
    const b = pick();
    eq('选中正文里至少 4 个字：button.zp-rpick「问这段」出现在选区右下（绝对定位在 .zp-rmain 里）',
      [!!b && b.type, text(b), attr(b, 'type'), attr(b, 'style'), !!b && b.node.parentNode === mainEl().node], ['button', '问这段', 'button', { left: 264, top: 228 }, true]);
    const prevented = [];
    b.props.onMouseDown({ preventDefault: () => prevented.push(1) });
    rt.click(b);
    const q = store.getState().session.quote;
    eq('点「问这段」：按下时不抢走选区；引用截到 600 字、打开紫微师、清掉选区、按钮收起',
      [prevented.length, q && q.label, q && Array.from(q.text).length, store.getState().session.panelOpen, cleared, !!pick()],
      [1, '报告里的一段', 600, true, 1, false]);
    store.setQuote(null);
    store.setPanel(false);
    rt.flush();
    select('再选一段长一点的话', secsEl()[3].node);
    scrollEl().props.onKeyUp({});
    timers.runAll();
    rt.flush();
    ok('用键盘选（keyup）也会出现', !!pick());
    scrollEl().props.onScroll({});
    rt.flush();
    ok('滚动时「问这段」收起', !pick());
    runFrames();
    win.getSelection = undefined;
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：阅读位置和目录高亮');
  const layout = (heights) => {
    const sc = scrollEl().node;
    const ys = [];
    let y = 160;
    heights.forEach((hgt) => { ys.push(y); y += hgt; });
    secsEl().forEach((s, i) => {
      s.node.getBoundingClientRect = () => ({ top: ys[i] - (sc.scrollTop || 0), bottom: ys[i] + heights[i] - (sc.scrollTop || 0), left: 0, right: 0, width: 0, height: heights[i] });
    });
    return ys;
  };
  const dims = (o) => Object.assign(scrollEl().node, o);
  await guard('阅读位置', async () => {
    frames.clear();
    const ys = layout(new Array(16).fill(400));
    dims({ scrollHeight: 160 + 16 * 400 + 48, clientHeight: 600, scrollTop: ys[3] + 50 });
    scrollEl().props.onScroll({});
    scrollEl().props.onScroll({});
    eq('滚动事件用 requestAnimationFrame 节流：两次滚动只排一帧，过帧前不写 store', [frames.size, store.readPos(keyA)], [1, null]);
    runFrames();
    eq('过一帧：读到哪里记进 store（第几部分 + 部分内偏移 + 是否在底部）', store.readPos(keyA), { part: 3, offset: 50, end: false });
    const cur = () => items().filter((n) => attr(n, 'aria-current') === 'true').map((n) => text(find(n, (x) => x.type === 'span')[0]));
    eq('目录高亮（aria-current）跟着读到的部分', cur(), ['家庭关系']);

    rt.click(items()[5]);
    eq('点目录「六、财富管理」：阅读栏滚到那一部分（留 8px），readPos 跟着改、高亮跟着走',
      [scrollEl().node.scrollTop, store.readPos(keyA), cur()], [ys[6] - 8, { part: 6, offset: -8, end: false }, ['财富管理']]);

    /* 切到盘面再回来：隐藏后浏览器丢了滚动位置（clientHeight 为 0、scrollTop 归零），回来时按 readPos 回到原处 */
    dims({ scrollTop: ys[8] + 120 });
    scrollEl().props.onScroll({});
    runFrames();
    eq('又滚了一段：readPos = 第 8 部分、偏移 120', store.readPos(keyA), { part: 8, offset: 120, end: false });
    dims({ clientHeight: 0 });
    store.setStage('board');
    rt.flush();
    eq('隐藏时不拿隐藏后的布局覆盖 readPos', store.readPos(keyA), { part: 8, offset: 120, end: false });
    dims({ clientHeight: 600, scrollTop: 0 });
    store.setStage('report');
    rt.flush();
    eq('再显示：在 layout effect 里回到原处', scrollEl().node.scrollTop, ys[8] + 120);

    /* 面板卸载再挂载：卸载前记一次，挂上后回到原处（新节点没有布局，部分都在 0 处：落在偏移上） */
    dims({ scrollTop: ys[10] + 30 });
    rt.unmount();
    eq('面板卸载：effect 清理时把当前位置再记一次', store.readPos(keyA), { part: 10, offset: 30, end: false });
    rt.mount(h(env.Main));
    eq('重新挂载：同样的目录、同样的正文、同样的页头', [items().length, secsEl().length, text(find(topEl(), (n) => n.type === 'h1')[0]), attr(stageEl(), 'hidden')],
      [15, 16, '甲 · 完整报告', false]);
    eq('重新挂载：按 readPos 滚到第 10 部分 + 30', scrollEl().node.scrollTop, 30);
    eq('重新挂载：目录高亮还是读到的那一部分', cur(), ['居家风水']);
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：写的时候跟随底部');
  await guard('跟随底部', async () => {
    store.regenerateReport();
    await settle();
    rt.flush();
    const p = lastPipe();
    const sc = () => scrollEl().node;
    dims({ scrollHeight: 600, clientHeight: 600, scrollTop: 0 });
    scrollEl().props.onScroll({});
    runFrames();
    p.send('delta', { text: REPORT.slice(0, CUT1) });
    await settle();
    dims({ scrollHeight: 1400 });
    rt.flush();
    eq('在底部附近：新内容来了就跟到底', sc().scrollTop, 1400);
    dims({ scrollTop: 500 });
    scrollEl().props.onScroll({});
    runFrames();
    p.send('delta', { text: REPORT.slice(CUT1, CUT2) });
    await settle();
    dims({ scrollHeight: 2000 });
    rt.flush();
    eq('往上翻了（离底部 300px）：新内容来了不拉回去', sc().scrollTop, 500);
    dims({ scrollTop: 1340 });
    scrollEl().props.onScroll({});
    runFrames();
    p.send('delta', { text: REPORT.slice(CUT2, CUT3) });
    await settle();
    dims({ scrollHeight: 2600 });
    rt.flush();
    eq('回到离底部 60px 以内：又开始跟随', sc().scrollTop, 2600);

    const ys = layout([300, 500, 500, 500, 200]);
    dims({ scrollHeight: 2600, clientHeight: 600, scrollTop: 2000 });
    rt.click(items()[1]);
    const jumped = sc().scrollTop;
    eq('写的时候点目录里写完的部分：直接跳过去（不平滑），不再跟随', jumped, ys[2] - 8);
    p.send('delta', { text: '新的字' });
    await settle();
    dims({ scrollHeight: 2800 });
    rt.flush();
    eq('跳过去以后新内容来了：位置不动', sc().scrollTop, jumped);

    /* 停在中间时写完：状态栏消失，阅读栏往上长了一截；补回这段高度，屏幕上的字不跳 */
    const barNode = barEl().node;
    barNode.offsetHeight = 44;
    store.stop();
    await settle();
    rt.flush();
    barEl().node.offsetHeight = 44;
    rt.click(btnIn(barEl(), '接着写'));
    await settle();
    rt.flush();
    dims({ scrollTop: 900 });
    scrollEl().props.onScroll({});
    runFrames();
    lastPipe().send('done', { text: '收尾。' }).end();
    await settle(6);
    rt.flush();
    eq('写完、状态栏消失：scrollTop 减去状态栏高度，正文在屏幕上不动', [!!barEl(), sc().scrollTop], [false, 856]);
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：没写成报告');
  /* 2026-11-24 真机：模型没写报告，只回了约 300 字要出生地经度，这段话被当成写完的报告存了下来
     （spec 2026-11-24_solar-time-option §3.7）。报告页要认得出来，给「重新生成」。 */
  await guard('没写成报告', async () => {
    const REFUSAL = '在动笔之前，需要先和您确认一件事：这张盘没有提供出生地的经度，真太阳时还没有校正。请告诉我出生的城市，我核对时辰之后再写完整报告。';
    ok('ZWUi 暴露 rvUnwritten', typeof U.rvUnwritten === 'function');
    if (typeof U.rvUnwritten !== 'function') return;
    eq('rvUnwritten：写完、不到 1500 字、没有「## 」标题才算没写成；有标题、够长、还在写、出错、空的都不算',
      [U.rvUnwritten({ status: 'done', text: REFUSAL }), U.rvUnwritten({ status: 'done', text: REFUSAL + '\n\n### 小标题\n\n一句。' }),
        U.rvUnwritten({ status: 'done', text: REPORT }), U.rvUnwritten({ status: 'done', text: '## 一、命盘总览\n\n短短一段。' }),
        U.rvUnwritten({ status: 'done', text: '字'.repeat(1500) }), U.rvUnwritten({ status: 'done', text: '字'.repeat(1499) }),
        U.rvUnwritten({ status: 'running', text: REFUSAL }), U.rvUnwritten({ status: 'error', text: REFUSAL }),
        U.rvUnwritten({ status: 'done', text: '  ' }), U.rvUnwritten(null)],
      [true, true, false, false, false, true, false, false, false, false]);

    const env2 = bootRuntime(t.client, { now: NOW, width: 1300 });
    const st2 = env2.store;
    const rt2 = env2.rt;
    const e2 = st2.addChart(GOLDEN, '乙');
    st2.openChart(e2.id);
    st2.setStage('report');
    rt2.mount(env2.h(env2.Main));
    const main2 = () => findByClass(findByClass(rt2.tree(), 'zp-rbody')[0], 'zp-rmain')[0];
    const bar2 = () => findByClass(main2(), 'zp-rbar')[0];
    const last2 = () => env2.pipe.calls[env2.pipe.calls.length - 1];
    st2.startReport();
    await settle();
    rt2.flush();
    last2().send('done', { text: REFUSAL }).end();
    await settle(6);
    st2.dismissToast();
    rt2.flush();
    const rep = st2.reading().report;
    eq('模型只回了一小段话：report.status 是 done，正文原样留着', [rep.status, rep.text], ['done', REFUSAL]);
    const bar = bar2();
    eq('状态栏（role=status）：说明没写成报告，给「重新生成」（一点就写，不用二次确认）',
      [attr(bar, 'role'), text(findByClass(bar, 'zp-rbar-text')[0]), find(bar, (n) => n.type === 'button').map((n) => [text(n), classesOf(n)])],
      ['status', '紫微师没有写成报告，只回了下面这段话。', [['重新生成', ['zp-btn']]]]);
    /* 正文各部分是 dangerouslySetInnerHTML，树里的文字读不到，直接看 HTML */
    const shown = find(main2(), (n) => n.type === 'section').map((n) => (attr(n, 'dangerouslySetInnerHTML') || {}).__html || '').join('');
    ok('那段话还在正文里（看得到它说了什么）', shown.includes('需要先和您确认一件事'), shown.slice(0, 80));
    const before = env2.pipe.calls.length;
    rt2.click(find(bar2(), (n) => n.type === 'button' && text(n) === '重新生成')[0]);
    await settle();
    rt2.flush();
    eq('点重新生成：发出一次 mode=report 的请求，状态栏回到正在写',
      [env2.pipe.calls.length - before, last2().body && last2().body.mode, text(findByClass(bar2(), 'zp-rbar-text')[0])],
      [1, 'report', '正在写第 1 / 14 部分 · 命盘总览']);
    last2().send('done', { text: REPORT }).end();
    await settle(6);
    st2.dismissToast();
    rt2.flush();
    eq('这次写出了完整报告：没有状态栏', [st2.reading().report.status, !!bar2()], ['done', false]);
    rt2.unmount();
  });

  /* ---------------------------------------------------------------- */
  section('v6 报告页：文案和源码');
  await guard('源码', () => {
    const src = readFileSync(join(t.root, 'src', 'ui', '85-reportview.js'), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
    const cjk = code.match(/[　-〿㐀-鿿＀-￯]/g) || [];
    eq('85-reportview.js 注释之外没有中文（可见文字都走 t()；导出文件名里的品牌名用转义写）', cjk.slice(0, 5), []);
    eq('面板里没有「鲲鹏」：报告舞台渲染出的文字里不出现', text(stageEl()).includes('鲲鹏'), false);
    const dict = JSON.parse(readFileSync(join(t.root, 'src', 'ui', 'i18n', '85-report.json'), 'utf8'));
    const bad = Object.keys(dict).filter((k) => !/^rv[A-Z]/.test(k) || !Array.isArray(dict[k]) || dict[k].length !== 2 || !dict[k][1]);
    eq('i18n/85-report.json：键都以 rv 开头，中英文都有', bad, []);
    ok('不用 setInterval', !/setInterval\(/.test(code));
  });
  rt.unmount();
}
