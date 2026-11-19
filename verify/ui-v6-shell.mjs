/**
 * verify/ui-v6-shell.mjs — v6 外壳：源码能拼、bundle 能在裸 vm 里求值、宿主约定在位（T1）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。覆盖：
 *   - src/ui/ 的文件齐全、每个文件单独过语法检查；build.mjs 的拼接守卫真的会拦（重名声明、\r、反引号…）
 *   - 加载只注册 factory（ZWEngine / ZWCore / THREE 都不存在）；factory 返回 inject + apply
 *   - apply 注册侧栏入口和 main（key=ziwei），样式随 ctx.effect 注入、卸载时移除
 *   - 「返回会话」由 ProApp 自己渲染、是顶栏第一个控件、调用 layout.selectPanel(null)；layout 不可用时不渲染
 *   - 宿主约定的 CSS、产物里不该出现的字符串、字典、图标表、档位
 *   - （T5a）顶栏：首页 / 命盘页两种内容、六个页签、报告页签的脉冲点、「更多」菜单、问紫微师；根节点属性跟着 store；
 *     每个 role=dialog 有 aria-modal 和名字；每个按钮有文字或 aria-label；选宫前后顶栏一个字不差；提示条；
 *     视图组件存在才渲染、各自包在错误边界里；apply() 的生命周期（pagehide、卸载清理、自动打开、openSession）
 * 深渲染用 client-harness 的假 React（effect 不跑、setState 是空操作），所以这里测的是"给定 store 状态时渲染出什么"；
 * 订阅、重渲染次数、焦点这些要真跑 effect 的行为在 verify/ui-v6-parts.mjs。
 */
import vm from 'node:vm';
import { assembleUiFrom, readUiSources } from '../build.mjs';
import { classesOf, diffTrees, fakeFetch, fakeLocale, find, findByClass, loadBundle, makeCtx, manualTimers, memoryStorage, renderDeep, renderShallow, settle, streamFetch, text } from './client-harness.mjs';

const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '',
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
const GOLDEN_F = Object.assign({}, GOLDEN, { gender: 'female' });
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();


const SPEC_FILES = {
  js: ['00-head.js', '10-i18n.js', '20-util.js', '21-storage.js', '22-stream.js', '23-birth.js', '24-scope.js', '25-board.js',
    '26-store.js', '27-zwui.js', '30-report.js', '40-styles.js', '50-parts.js', '60-home.js', '62-onboarding.js', '64-sheets.js',
    '66-settings.js', '70-chart.js', '80-assistant.js', '85-reportview.js', '90-app.js'],
  css: ['00-tokens.css', '10-base.css', '50-parts.css', '60-home.css', '70-chart.css', '80-assistant.css', '85-prose.css', '86-reportview.css'],
  i18n: ['00-common.json']
};

const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

export default async function shell(t) {
  const { ok, section } = t;

  /* ---------------------------------------------------------------- */
  section('v6 外壳：源码与拼接');
  const sources = safe(() => readUiSources(t.root));
  for (const kind of ['js', 'css', 'i18n']) {
    const have = new Set(((sources && sources[kind]) || []).map((f) => f.name));
    const missing = SPEC_FILES[kind].filter((n) => !have.has(n));
    ok(`spec §4.1 列出的 src/ui/${kind === 'js' ? '' : kind + '/'}*.${kind === 'i18n' ? 'json' : kind} 都在`, !!sources && missing.length === 0, 'missing: ' + missing.join(', '));
  }
  const syntaxBad = [];
  for (const f of (sources && sources.js) || []) {
    try { new vm.Script('(function () {\n' + f.text + '\n})', { filename: 'src/ui/' + f.name }); } catch (e) { syntaxBad.push(`${f.name}: ${e.message}`); }
  }
  ok('每个 src/ui/*.js 单独能过语法检查', !!sources && sources.js.length > 0 && syntaxBad.length === 0, syntaxBad.join(' | '));
  ok('拼起来没有重名的顶层声明、能过严格模式编译（assembleUi 不抛错）', !!t.ui, t.uiError && t.uiError.message);

  /* 构建守卫：用一个最小的合法源码集，逐项改坏，assembleUiFrom 都要抛错 */
  const minimal = () => ({
    js: [
      { name: '00-head.js', text: "const APP_VERSION = '__ZIWEI_VERSION__';\nconst DICT = /*__ZIWEI_DICT__*/{};\n" },
      { name: '40-styles.js', text: 'const CSS = `/*__ZIWEI_CSS__*/`;\n' },
      { name: '90-app.js', text: 'function ProApp() { return null; }\nconst __ziweiPlugin = { inject: [], apply() {} };\n' }
    ],
    css: [{ name: '00-tokens.css', text: '.zp-root { color: inherit }\n' }],
    i18n: [{ name: '00-common.json', text: '{\n  "brand": ["紫微斗数", "Zi Wei Dou Shu"]\n}\n' }]
  });
  const throws = (mutate) => { const s = minimal(); mutate(s); try { assembleUiFrom(s, { version: '0.0.0' }); return ''; } catch (e) { return e.message; } };
  ok('构建守卫：最小源码集能拼', throws(() => {}) === '', throws(() => {}));
  const guards = [
    ['两个文件声明同名 function', (s) => { s.js[2].text += 'function ProApp() { return 1; }\n'; }],
    ['两个文件声明同名 var', (s) => { s.js[0].text += 'var dup = 1;\n'; s.js[1].text += 'var dup = 2;\n'; }],
    ['缩进里的同名声明（严格模式块编译兜底）', (s) => { s.js[0].text += '  function hidden() {}\n'; s.js[1].text += '  function hidden() {}\n'; }],
    ['i18n 键跨文件重复', (s) => { s.i18n.push({ name: '10-more.json', text: '{ "brand": ["甲", "A"] }\n' }); }],
    ['i18n 键在同一文件里重复', (s) => { s.i18n[0].text = '{ "brand": ["甲", "A"], "brand": ["乙", "B"] }\n'; }],
    ['i18n 值不是 [中文, English]', (s) => { s.i18n[0].text = '{ "brand": "紫微斗数" }\n'; }],
    ['CSS 含反引号', (s) => { s.css[0].text = '.zp-root { content: "`" }\n'; }],
    ['CSS 含 ${', (s) => { s.css[0].text = '.zp-root { --x: ${a} }\n'; }],
    ['CSS 含反斜杠', (s) => { s.css[0].text = '.zp-root { content: "\\201C" }\n'; }],
    ['版本占位符出现两次', (s) => { s.js[2].text += "const V2 = '__ZIWEI_VERSION__';\n"; }],
    ['源码含 \\r', (s) => { s.js[1].text = 'const CSS = `/*__ZIWEI_CSS__*/`;\r\n'; }],
    ['缺结尾换行', (s) => { s.css[0].text = '.zp-root { color: inherit }'; }],
    ['源码里写了包名', (s) => { s.js[2].text += "const PKG = '@local/ziwei-workbench';\n"; }],
    ['缺 const __ziweiPlugin', (s) => { s.js[2].text = 'function ProApp() { return null; }\n'; }],
    ['不认识的占位符', (s) => { s.js[1].text += 'const X = `/*__ZIWEI_NOPE__*/`;\n'; }]
  ];
  for (const [label, mutate] of guards) {
    const msg = throws(mutate);
    ok(`构建守卫：${label} → 抛错`, msg !== '', '没有抛错');
  }

  /* ---------------------------------------------------------------- */
  section('v6 外壳：加载与入口');
  const client = t.client || '';
  const loaded = t.client ? loadBundle(client) : null;
  ok('整个 v6 bundle 能在裸 vm 里求值', !!loaded && loaded.error === null, loaded ? loaded.error && loaded.error.message : '没有 bundle');
  const ids = loaded ? loaded.entries.filter((e) => e && e.id).map((e) => e.id) : [];
  ok('只注册一个入口，id 为 @local/ziwei-workbench', ids.length === 1 && ids[0] === '@local/ziwei-workbench', JSON.stringify(ids));
  ok('求值之后、factory() 之前没有 ZWEngine / ZWCore / THREE',
    !!loaded && !loaded.win.ZWEngine && !loaded.win.ZWCore && !loaded.win.THREE && !loaded.sandbox.THREE);

  let plugin = null, factoryErr = null;
  if (loaded && loaded.entry) { try { plugin = loaded.materialize(); } catch (e) { factoryErr = e; } }
  ok('factory() 首次物化时求值内核（ZWEngine / ZWCore 就绪）', !!plugin && !!loaded.win.ZWEngine && !!loaded.win.ZWCore, factoryErr && factoryErr.message);
  ok('factory() 返回带 inject（含 slots、uiWorkspace）和 apply 的对象',
    !!plugin && Array.isArray(plugin.inject) && plugin.inject.includes('slots') && plugin.inject.includes('uiWorkspace') && typeof plugin.apply === 'function',
    plugin ? JSON.stringify(plugin.inject) : '');
  ok('factory() 之后仍没有 THREE（3D 只在首页可见时才求值）', !!loaded && !loaded.win.THREE && !loaded.sandbox.THREE);

  /* apply：effect 立即执行（cordis 的语义） */
  const fakeLayout = { calls: [], selectPanel(id) { this.calls.push(id); } };
  const host = makeCtx({ layout: fakeLayout });
  let applyErr = null;
  if (plugin) { try { plugin.apply(host.ctx); } catch (e) { applyErr = e; } }
  ok('apply() 不抛错', !!plugin && applyErr === null, applyErr && applyErr.message);
  ok('apply() 注册 sidebar.panellist 和 main', host.injections.includes('sidebar.panellist') && host.injections.includes('main'), host.injections.join(','));
  const mainReg = host.registrations.find(([d]) => d && d.name === 'main');
  ok('main 的 key 是 ziwei', !!mainReg && mainReg[0].key === 'ziwei', mainReg && JSON.stringify(mainReg[0]));
  const panelReg = host.panel();
  ok('侧栏入口 id 是 ziwei，有 label 和图标组件',
    !!panelReg && panelReg[0].id === 'ziwei' && typeof panelReg[0].label === 'function' && typeof panelReg[1] === 'function' &&
    safe(() => panelReg[0].label()) === '紫微斗数 Pro',
    panelReg && safe(() => panelReg[0].label()));
  const styles = loaded ? loaded.document.head.children.filter((el) => el.tagName === 'STYLE') : [];
  ok('样式在 ctx.effect 里注入 <style>（一个，内容是面板 CSS）',
    styles.length === 1 && /\.zp-root \{/.test(styles[0].textContent) && /isolation: isolate;/.test(styles[0].textContent),
    `style 数 ${styles.length}`);
  ok('apply() 暴露 window.ZWUi（纯函数）', !!loaded && !!loaded.win.ZWUi && typeof loaded.win.ZWUi.tierOf === 'function');
  host.disposeAll();
  ok('插件卸载（ctx.effect 的清理）时移除样式', !!loaded && loaded.document.head.children.filter((el) => el.tagName === 'STYLE').length === 0);

  /* verify.mjs 旧写法的 ctx：effect 什么都不做，也不能抛错 */
  const legacy = makeCtx({}, { runEffects: false });
  let legacyErr = null;
  if (plugin) { try { plugin.apply(legacy.ctx); } catch (e) { legacyErr = e; } }
  ok('apply() 在 effect 不执行回调的 ctx 下也不抛错', !!plugin && legacyErr === null, legacyErr && legacyErr.message);

  /* ---------------------------------------------------------------- */
  section('v6 外壳：返回会话');
  const exitButtons = (tree) => find(tree, (n) => classesOf(n).includes('zp-exit'));
  let boundaryEl = null, proAppEl = null, tree = null, renderErr = null;
  try {
    boundaryEl = mainReg[1]();
    proAppEl = boundaryEl.children[0];
    tree = renderShallow(proAppEl);
  } catch (e) { renderErr = e; }
  const actions = proAppEl && proAppEl.props && proAppEl.props.actions;
  ok('main 渲染 Boundary > ProApp，actions 暴露返回会话出口',
    renderErr === null && !!actions && actions.canReturnToConversation === true && typeof actions.returnToConversation === 'function',
    renderErr ? renderErr.message : '');
  const exits = tree ? exitButtons(tree) : [];
  const exitBtn = exits.length === 1 ? exits[0] : null;
  ok('ProApp 自己的渲染里恰好一个 zp-exit 按钮（type=button，title / aria-label 都是「返回会话」）',
    !!exitBtn && exitBtn.type === 'button' && exitBtn.props.type === 'button' &&
    exitBtn.props.title === '返回会话' && exitBtn.props['aria-label'] === '返回会话',
    exitBtn ? JSON.stringify({ title: exitBtn.props.title, aria: exitBtn.props['aria-label'] }) : `找到 ${exits.length} 个`);
  const head = tree ? find(tree, (n) => n.props && n.props['data-region'] === 'HEAD')[0] : null;
  const firstControl = head ? (head.children || []).flat(Infinity).find((c) => c && typeof c === 'object') : null;
  ok('「返回会话」是顶栏（HEAD）的第一个控件', !!head && !!exitBtn && firstControl === exitBtn);
  if (exitBtn && typeof exitBtn.props.onClick === 'function') { try { exitBtn.props.onClick(); } catch { /* 记在下面 */ } }
  ok('点击调用 layout.selectPanel(null)', fakeLayout.calls.length === 1 && fakeLayout.calls[0] === null, JSON.stringify(fakeLayout.calls));
  let deepErr = null;
  try { renderDeep(boundaryEl); } catch (e) { deepErr = e; }
  ok('整棵面板能深渲染（layout 可用）', !!boundaryEl && deepErr === null, deepErr && deepErr.message);

  const noLayout = makeCtx({});
  let tree3 = null, err3 = null;
  try {
    plugin.apply(noLayout.ctx);
    const b3 = noLayout.main()();
    tree3 = renderShallow(b3.children[0]);
    renderDeep(b3);
  } catch (e) { err3 = e; }
  ok('layout 不可用时：不渲染返回会话按钮，面板仍能渲染', err3 === null && !!tree3 && exitButtons(tree3).length === 0 &&
    find(tree3, (n) => n.props && n.props['data-region'] === 'HEAD').length === 1,
    err3 ? err3.message : '');
  noLayout.disposeAll();

  /* Boundary：出错时显示错误和重试 */
  let crash = null;
  try {
    const B = boundaryEl.type;
    const inst = new B({ children: proAppEl });
    inst.state = Object.assign({}, inst.state, B.getDerivedStateFromError(new Error('测试错误')));
    crash = inst.render();
  } catch (e) { crash = null; }
  ok('Boundary 捕获错误后显示错误信息和「重试」按钮',
    !!crash && text(crash).includes('测试错误') && find(crash, (n) => n.type === 'button' && text(n) === '重试').length === 1,
    crash ? text(crash) : '');

  /* ---------------------------------------------------------------- */
  section('v6 外壳：宿主约定（产物字符串）');
  ok('避让 darwin 窗口 chrome（top / leading / overlay 三个 frame 变量都带兜底）',
    /html\[data-platform="darwin"\] \.zp-root \{\s*padding-top: var\(--dsh-frame-top-clearance, 0px\)/.test(client) &&
    /html\[data-platform="darwin"\] \[data-sidebar-collapsed\] \.zp-head \{[\s\S]{0,200}?var\(--dsh-frame-leading-clearance, 0px\)/.test(client) &&
    /html\[data-platform="darwin"\] \.zp-root \.zp-overlay-center \{[\s\S]{0,200}?var\(--dsh-frame-overlay-top, 46px\)/.test(client));
  ok('.zp-root 有 isolation: isolate', /\.zp-root \{[\s\S]{0,2000}?isolation: isolate;/.test(client));
  ok(':where(.zp-root) button { color: inherit }', /:where\(\.zp-root\) button \{[^}]*color:\s*inherit/.test(client));
  ok('data-dsh-automatic-focus 的容器不画焦点框', /\.zp-root \[data-dsh-automatic-focus\]:focus \{[^}]*outline:\s*none/.test(client));
  ok('不出现 setInterval(', !!client && !/setInterval\(/.test(client));
  ok('不出现 position: fixed', !!client && !/position\s*:\s*fixed/.test(client));
  ok('不出现 api.deepseek.com', !!client && !/api\.deepseek\.com/.test(client));
  ok('不残留 __ZIWEI_VERSION__，版本号已注入', !!client && !client.includes('__ZIWEI_VERSION__') &&
    client.includes('const APP_VERSION = ' + JSON.stringify(t.version) + ';'));
  ok("id: '@local/ziwei-workbench' 恰好出现一次", client.split("id: '@local/ziwei-workbench'").length - 1 === 1);

  /* ---------------------------------------------------------------- */
  section('v6 外壳：字典与图标');
  const loc = fakeLocale('en');
  const withLocale = makeCtx({ layout: fakeLayout, locale: loc });
  let enTitle = null;
  try {
    plugin.apply(withLocale.ctx);
    const exit = exitButtons(renderShallow(withLocale.main()().children[0]))[0];
    enTitle = exit && exit.props.title;
  } catch { enTitle = null; }
  ok("locale 服务：一次 register('ziwei', { zh, en }) 和一次 bind('ziwei')",
    loc.calls.register.length === 1 && loc.calls.register[0][0] === 'ziwei' && !!loc.calls.register[0][1].zh && !!loc.calls.register[0][1].en &&
    loc.calls.bind.length === 1 && loc.calls.bind[0] === 'ziwei', JSON.stringify({ register: loc.calls.register.length, bind: loc.calls.bind }));
  ok('界面文字随 locale 切换（英文下「返回会话」是 Back to conversation）', enTitle === 'Back to conversation', String(enTitle));
  withLocale.disposeAll();
  let zhAgain = null;
  try {
    const again = makeCtx({ layout: fakeLayout });
    plugin.apply(again.ctx);
    zhAgain = exitButtons(renderShallow(again.main()().children[0]))[0].props.title;
    again.disposeAll();
  } catch { zhAgain = null; }
  ok('locale 服务缺失时退回内置中文', zhAgain === '返回会话', String(zhAgain));

  const dicts = loc.calls.register[0] ? loc.calls.register[0][1] : { zh: {}, en: {} };
  const zhKeys = Object.keys(dicts.zh || {});
  const enKeys = Object.keys(dicts.en || {});
  const onlyZh = zhKeys.filter((k) => !(k in dicts.en));
  const onlyEn = enKeys.filter((k) => !(k in dicts.zh));
  ok('中英文字典键集合相等', zhKeys.length > 0 && onlyZh.length === 0 && onlyEn.length === 0, 'zh only: ' + onlyZh.join(' ') + ' | en only: ' + onlyEn.join(' '));
  const banned = ['✓', '⚠', '画布', '鲲鹏', '智能解读'];
  const hits = banned.filter((w) => Object.values(dicts.zh || {}).some((v) => String(v).includes(w)));
  ok('中文文案里没有 ✓ ⚠ 画布 鲲鹏 智能解读', zhKeys.length > 0 && hits.length === 0, 'hits: ' + hits.join(','));
  const dictSeg = t.ui ? t.ui.map.find((m) => m.file === 'src/ui/i18n/*.json') : null;
  const afterDict = dictSeg ? t.ui.text.slice(dictSeg.end) : '';
  const unused = zhKeys.filter((k) => !afterDict.includes("'" + k + "'"));
  ok('每个字典键在字典之后的源码里被引用过', zhKeys.length > 0 && !!dictSeg && unused.length === 0, 'unused: ' + unused.join(' '));

  const ZWUi = loaded && loaded.win.ZWUi;
  const used = new Set([...client.matchAll(/h\(Icon, \{ name: '(\w+)'/g)].map((m) => m[1]));
  const names = new Set((ZWUi && ZWUi.iconNames) || []);
  const missingIcons = [...used].filter((n) => !names.has(n));
  ok('ZWUi.iconNames 包含源码里用到的每个图标名', names.size > 0 && used.size > 0 && missingIcons.length === 0, 'missing: ' + missingIcons.join(','));

  /* ---------------------------------------------------------------- */
  section('v6 外壳：档位');
  const tierOf = ZWUi && ZWUi.tierOf;
  const cases = [[0, 'narrow'], [-5, 'narrow'], [719, 'narrow'], [720, 'mid'], [1179, 'mid'], [1180, 'wide'], [2400, 'wide']];
  const got = tierOf ? cases.map(([w]) => tierOf(w)) : [];
  ok('tierOf：0 / 719 → narrow，720 / 1179 → mid，1180 → wide（首帧 0 按窄档）',
    !!tierOf && cases.every(([, want], i) => got[i] === want), JSON.stringify(got));
  const root0 = tree ? findByClass(tree, 'zp-root')[0] : null;
  ok('首帧（面板宽度还没量到）根节点 data-w="narrow"', !!root0 && root0.props['data-w'] === 'narrow', root0 && root0.props['data-w']);

  await shellViews(t);
  await shellLifecycle(t);
}

/* ================================================================ *
 * T5a：顶栏、页签、根节点属性、浮层语义、提示条（深渲染）
 * ================================================================ */
async function shellViews(t) {
  const { ok, section } = t;
  const J = (v) => JSON.stringify(v);
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);
  const attr = (el, k) => (el && el.props ? el.props[k] : undefined);

  section('v6 外壳：顶栏和视图（深渲染）');
  const b = t.client ? loadBundle(t.client, { globals: { AbortController } }) : null;
  let plugin = null, bootErr = null;
  const timers = manualTimers();
  const layout = { calls: [], selectPanel(id) { this.calls.push(id); } };
  const host = makeCtx({ layout });
  const pipe = streamFetch();
  let store = null;
  try {
    plugin = b.materialize();
    b.win.setTimeout = timers.setTimeout;
    b.win.clearTimeout = timers.clearTimeout;
    plugin.apply(host.ctx);
    store = b.win.ZWStore.getStore({ storage: memoryStorage(), now: () => NOW, fetch: pipe, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout });
  } catch (e) { bootErr = e; }
  ok('装载、apply()、用内存 storage 建默认 store', !!store && !bootErr, bootErr && bootErr.message);
  if (!store) return;
  const Main = host.main();
  const BoundaryT = Main().type;
  const P = (b.win.ZWUi && b.win.ZWUi.parts) || {};
  const E = b.win.ZWEngine;
  let renderErr = null;
  const render = () => { try { renderErr = null; return renderDeep(Main()); } catch (e) { renderErr = e; return null; } };
  const head = (tree) => find(tree, (n) => attr(n, 'data-region') === 'HEAD')[0] || null;
  const rootOf = (tree) => findByClass(tree, 'zp-root')[0] || null;
  const headControls = (tree) => {
    const hd = head(tree);
    return hd ? find(hd, (n) => n.type === 'button' || attr(n, 'role') === 'tablist' || classesOf(n).includes('zp-grow') || n.type === 'nav' || classesOf(n).includes('zp-menu-wrap'))
      .filter((n, i, all) => !all.some((o) => o !== n && (o.type === 'nav' || attr(o, 'role') === 'tablist' || classesOf(o).includes('zp-menu-wrap')) && find(o, (x) => x === n).length)) : [];
  };
  const label = (n) => (n.type === 'button' ? (attr(n, 'aria-label') || text(n)) : n.type === 'nav' ? 'nav' : attr(n, 'role') === 'tablist' ? 'tablist' : classesOf(n).includes('zp-menu-wrap') ? 'menu' : 'grow');
  const allButtonsNamed = (tree) => find(tree, (n) => n.type === 'button').filter((n) => !(String(attr(n, 'aria-label') || '').trim() || text(n).trim()));
  const dialogsOk = (tree) => find(tree, (n) => attr(n, 'role') === 'dialog').filter((n) => !(attr(n, 'aria-modal') === 'true' && String(attr(n, 'aria-label') || '').trim()));
  const states = [];

  /* ---------- 首页 ---------- */
  let tree = render();
  ok('没有命盘时整棵面板能深渲染', !!tree, renderErr && renderErr.message);
  states.push(['首页', tree]);
  eq('首页：根节点 data-view="home"、data-stage="board"、data-panel="closed"',
    [attr(rootOf(tree), 'data-view'), attr(rootOf(tree), 'data-stage'), attr(rootOf(tree), 'data-panel')], ['home', 'board', 'closed']);
  eq('首页顶栏：返回会话、空白、全部命盘、设置', headControls(tree).map(label), ['返回会话', 'grow', '全部命盘', '设置']);
  const homeBtn = (name) => find(head(render()), (n) => n.type === 'button' && attr(n, 'aria-label') === name)[0];
  ok('首页顶栏的图标按钮有 title、type=button', ['全部命盘', '设置'].every((n) => { const x = homeBtn(n); return x && attr(x, 'title') === n && attr(x, 'type') === 'button' && classesOf(x).includes('zp-icon-btn'); }));
  homeBtn('全部命盘').props.onClick();
  eq('点「全部命盘」：只改 store 的 sheet（charts）', [store.getState().session.sheet, store.getState().session.modal], ['charts', null]);
  homeBtn('设置').props.onClick();
  eq('点「设置」：modal = settings，同时关掉 sheet（同一时间一个模态层）', [store.getState().session.sheet, store.getState().session.modal], [null, 'settings']);
  store.patchSession({ modal: null });

  /* ---------- 命盘页 ---------- */
  const entry = store.addChart(GOLDEN, '甲');
  const other = store.addChart(GOLDEN_F, '乙');
  store.openChart(entry.id);
  tree = render();
  ok('打开命盘后整棵面板能深渲染', !!tree, renderErr && renderErr.message);
  states.push(['命盘页', tree]);
  eq('命盘页：根节点 data-view="chart"、data-stage="board"、data-panel="closed"',
    [attr(rootOf(tree), 'data-view'), attr(rootOf(tree), 'data-stage'), attr(rootOf(tree), 'data-panel')], ['chart', 'board', 'closed']);
  eq('命盘页顶栏：返回会话、位置、空白、页签、问紫微师、更多、设置',
    headControls(tree).map(label), ['返回会话', 'nav', 'grow', 'tablist', '问紫微师', 'menu', '设置']);
  const crumb = find(head(tree), (n) => n.type === 'nav')[0];
  const orb = findByClass(crumb, 'zp-orb')[0];
  eq('位置：nav.zp-crumb（aria-label 位置）> button.zp-crumb-home「星图」、小星球（命宫主星太阳的颜色）、盘名；没有角标',
    [classesOf(crumb), attr(crumb, 'aria-label'), text(findByClass(crumb, 'zp-crumb-home')[0]), orb && orb.type, attr(orb, 'style'), text(findByClass(crumb, 'zp-crumb-name')[0]), findByClass(crumb, 'zp-badge').length],
    [['zp-crumb'], '位置', '星图', 'i', { '--zp-c': 'var(--zp-s2)' }, '甲', 0]);
  const tabsOf = (tr) => find(find(head(tr), (n) => attr(n, 'role') === 'tablist')[0], (n) => attr(n, 'role') === 'tab');
  const tablist = find(head(tree), (n) => attr(n, 'role') === 'tablist')[0];
  eq('页签：div.zp-seg[role=tablist]（aria-label 视图）里六个 button[role=tab]，顺序是 本命 大限 流年 流月 流日 | 报告',
    [classesOf(tablist).includes('zp-seg'), attr(tablist, 'aria-label'), tabsOf(tree).map((n) => [n.type, text(n)])],
    [true, '视图', [['button', '本命'], ['button', '大限'], ['button', '流年'], ['button', '流月'], ['button', '流日'], ['button', '报告']]]);
  const kids = tablist.children.flat(Infinity).filter((c) => c && typeof c === 'object');
  eq('分隔线 i.zp-seg-sep 在流日和报告之间', kids.map((k) => (k.type === 'i' ? 'sep' : text(k))), ['本命', '大限', '流年', '流月', '流日', 'sep', '报告']);
  const selected = (tr) => tabsOf(tr).filter((n) => attr(n, 'aria-selected') === 'true').map(text);
  eq('恰好一个 aria-selected="true"：本命', selected(tree), ['本命']);
  store.setTab('yearly');
  eq('setTab(yearly) 之后：流年', selected(render()), ['流年']);
  tabsOf(render())[4].props.onClick();
  eq('点「流日」页签：store 的 tab 变成 daily', [store.getState().session.tab, selected(render())], ['daily', ['流日']]);
  store.setStage('report');
  tree = render();
  states.push(['报告页', tree]);
  eq('setStage(report) 之后：报告；根节点 data-stage="report"', [selected(tree), attr(rootOf(tree), 'data-stage')], [['报告'], 'report']);
  tabsOf(tree)[1].props.onClick();
  eq('在报告页点「大限」：回到盘面、tab = decadal', [store.getState().session.stage, store.getState().session.tab, selected(render())], ['board', 'decadal', ['大限']]);
  tabsOf(render())[5].props.onClick();
  eq('点「报告」：stage = report，tab 不变', [store.getState().session.stage, store.getState().session.tab], ['report', 'decadal']);
  store.setTab('natal');

  /* 问紫微师 */
  const askBtn = (tr) => find(head(tr), (n) => n.type === 'button' && text(n) === '问紫微师')[0];
  eq('问紫微师：button.zp-btn-primary，面板关着时显示', [classesOf(askBtn(render())), attr(askBtn(render()), 'hidden')], [['zp-btn-primary'], false]);
  askBtn(render()).props.onClick();
  tree = render();
  states.push(['紫微师打开', tree]);
  eq('点「问紫微师」：面板打开、data-panel="open"、按钮隐藏', [store.getState().session.panelOpen, attr(rootOf(tree), 'data-panel'), attr(askBtn(tree), 'hidden')], [true, 'open', true]);
  store.setPanel(false);

  /* 报告页签的脉冲点 */
  const pulses = (tr) => findByClass(tabsOf(tr)[5], 'zp-pulse').length;
  eq('没有报告任务：报告页签没有脉冲点', pulses(render()), 0);
  ok('开始写报告', store.startReport() === true);
  await settle();
  const p1 = pipe.calls[pipe.calls.length - 1];
  eq('报告在写：报告页签里有 i.zp-pulse（aria-hidden）', [pulses(render()), attr(findByClass(tabsOf(render())[5], 'zp-pulse')[0], 'aria-hidden')], [1, true]);
  store.setTab('daily');
  eq('不管停在哪个页签都有', pulses(render()), 1);
  p1.send('delta', { text: '## 一、命盘总览\n正文' });
  await settle();
  eq('增量来了：还在', pulses(render()), 1);
  p1.send('done', { text: '## 一、命盘总览\n正文' }).end();
  await settle(6);
  eq('写完：脉冲点消失', pulses(render()), 0);
  store.openChart(other.id);
  store.startReport();
  await settle();
  const p2 = pipe.calls[pipe.calls.length - 1];
  store.openChart(entry.id);
  eq('别的盘在写报告：这张盘的报告页签没有脉冲点', pulses(render()), 0);
  store.openChart(other.id);
  eq('切回在写的那张盘：有', pulses(render()), 1);
  p2.send('done', { text: '## 一、命盘总览\n乙' }).end();
  await settle(6);
  store.openChart(entry.id);

  /* 更多菜单 */
  const menuItems = (tr) => find(findByClass(head(tr), 'zp-menu')[0], (n) => n.type === 'button');
  const trigger = find(findByClass(head(render()), 'zp-menu-wrap')[0], (n) => n.type === 'button' && attr(n, 'aria-label') === '更多')[0];
  eq('「更多」：图标按钮（aria-label / title 更多，aria-expanded=false），菜单默认收着',
    [!!trigger && classesOf(trigger).includes('zp-icon-btn'), attr(trigger, 'title'), attr(trigger, 'aria-expanded'), attr(findByClass(head(render()), 'zp-menu')[0], 'hidden')],
    [true, '更多', 'false', true]);
  eq('菜单项：复制命盘文字、显示杂曜（aria-pressed 开关）、改生辰',
    menuItems(render()).map((n) => [text(n), attr(n, 'aria-pressed')]), [['复制命盘文字', undefined], ['显示杂曜', 'false'], ['改生辰', undefined]]);
  store.setPref('showAdj', true);
  eq('setPref(showAdj, true) 之后 aria-pressed="true"', attr(menuItems(render())[1], 'aria-pressed'), 'true');
  menuItems(render())[1].props.onClick({});
  eq('点「显示杂曜」：切换偏好', store.getState().prefs.showAdj, false);
  menuItems(render())[2].props.onClick({});
  eq('点「改生辰」：sheet = birth，sheetChartId = 这张盘', [store.getState().session.sheet, store.getState().session.sheetChartId, store.getState().session.modal], ['birth', entry.id, null]);
  store.patchSession({ sheet: null, sheetChartId: null });
  let wrote = null;
  b.win.navigator = { clipboard: { writeText: (s) => { wrote = s; return Promise.resolve(); } } };
  menuItems(render())[0].props.onClick({});
  await settle();
  const toast1 = store.getState().session.toast;
  eq('复制命盘文字：写进剪贴板的是 E.chartText(chart)，提示「命盘已复制」',
    [wrote === E.chartText(store.currentChart()), toast1 && toast1.text, toast1 && toast1.error], [true, '命盘已复制', false]);
  b.win.navigator = { clipboard: { writeText: () => Promise.reject(new Error('denied')) } };
  menuItems(render())[0].props.onClick({});
  await settle();
  const toast2 = store.getState().session.toast;
  eq('剪贴板失败：错误提示', [toast2 && toast2.text, toast2 && toast2.error], ['复制失败，请手动选择文本', true]);
  delete b.win.navigator;
  store.dismissToast();

  /* 星图 → 首页 */
  find(crumb, (n) => n.type === 'button')[0].props.onClick();
  eq('点「星图」：回首页', store.getState().session.view, 'home');

  /* 示例盘 */
  store.openSample();
  tree = render();
  states.push(['示例盘', tree]);
  const crumb2 = find(head(tree), (n) => n.type === 'nav')[0];
  eq('示例盘：盘名就叫「示例盘」，不再另加「示例」角标；小星球取贪狼的颜色',
    [text(findByClass(crumb2, 'zp-crumb-name')[0]), findByClass(crumb2, 'zp-badge').length, attr(findByClass(crumb2, 'zp-orb')[0], 'style')],
    ['示例盘', 0, { '--zp-c': 'var(--zp-s8)' }]);
  store.openChart(entry.id);

  /* 选宫前后，顶栏一个字不差 */
  store.selectPalace(1);
  const before = render();
  store.selectPalace(6);
  const after = render();
  const headDiff = diffTrees(head(before), head(after));
  eq('selectPalace 前后两次深渲染：顶栏没有任何差异', headDiff, []);
  eq('selectPalace 前后：根节点属性不变', ['data-w', 'data-view', 'data-stage', 'data-panel'].map((k) => attr(rootOf(before), k) === attr(rootOf(after), k)), [true, true, true, true]);
  const keysOf = (tr) => find(tr, (n) => n.props && n.props.key !== undefined).map((n) => String(n.props.key));
  eq('selectPalace 前后：整棵树的 key 一个不变（key 不含选中宫）', keysOf(before).join('|') === keysOf(after).join('|') && keysOf(after).length > 0, true);

  /* 提示条 */
  const ran = [];
  store.showToast('紫微师回答好了', { action: { label: '查看', run: () => ran.push(1) } });
  tree = render();
  states.push(['提示条', tree]);
  const toastEl = findByClass(tree, 'zp-toast')[0];
  eq('提示条渲染 session.toast：文字和动作按钮（在 .zp-shell 里）',
    [!!toastEl && find(findByClass(tree, 'zp-shell')[0], (n) => n === toastEl).length === 1, attr(toastEl, 'role'), attr(toastEl, 'data-region'), text(find(toastEl, (n) => n.type === 'span')[0]), text(find(toastEl, (n) => n.type === 'button')[0])],
    [true, 'status', 'TOAST', '紫微师回答好了', '查看']);
  find(toastEl, (n) => n.type === 'button')[0].props.onClick();
  eq('点动作：执行并收起', [ran.length, store.getState().session.toast], [1, null]);

  /* 视图：组件存在才渲染；都包在错误边界里 */
  const declared = (name) => new RegExp('^function ' + name + '\\(', 'm').test(t.ui ? t.ui.text : '');
  store.setStage('board');
  tree = render();
  const viewRoots = [['HomeView', 'zp-home'], ['ChartPage', 'zp-body'], ['ReportStage', 'zp-rbody']];
  eq('HomeView / ChartPage / ReportStage：声明了才渲染（看各自的根类名）',
    viewRoots.map(([n, cls]) => findByClass(tree, cls).length > 0), viewRoots.map(([n]) => declared(n)));
  const chartSec = findByClass(tree, 'zp-chart')[0];
  ok('命盘页有 section.zp-chart（ProApp 的），在 .zp-main 里、顶栏之后', !!chartSec && chartSec.type === 'section' &&
    find(findByClass(tree, 'zp-main')[0], (n) => n === chartSec).length === 1);
  store.goHome();
  ok('首页没有 section.zp-chart', findByClass(render(), 'zp-chart').length === 0);
  store.openChart(entry.id);
  const shallow = renderShallow(Main().children[0]);
  /* 不进 Boundary 往下找：边界之外的组件只能是图标 */
  const outside = [];
  const boundaries = [];
  const walkOut = (n) => {
    if (Array.isArray(n)) { n.forEach(walkOut); return; }
    if (!n || typeof n !== 'object' || !('type' in n)) return;
    if (n.type === BoundaryT) { boundaries.push(n); return; }
    if (typeof n.type === 'function') outside.push(n.type.name);
    (n.children || []).forEach(walkOut);
  };
  walkOut(shallow);
  ok('ProApp 自己的渲染里，顶栏的命盘部分、各视图、提示条都包在错误边界（Boundary）里；边界之外只有「返回会话」和图标',
    boundaries.length >= 2 && outside.every((name) => name === 'Icon') && find(shallow, (n) => classesOf(n).includes('zp-exit')).length === 1 &&
    boundaries.every((n) => find(n, (x) => classesOf(x).includes('zp-exit')).length === 0), 'outside: ' + outside.join(','));

  /* 浮层部件和全局的可访问性约束 */
  const h = b.React.createElement;
  const sheetTree = renderDeep(h(P.Sheet, { title: '全部命盘', onClose: () => {} }, h('p', null, '正文')));
  const modalTree = renderDeep(h(P.Modal, { title: '设置', onClose: () => {}, footer: h('button', { type: 'button', className: 'zp-btn' }, '完成') }, h('p', null, '正文')));
  states.push(['Sheet 部件', sheetTree], ['Modal 部件', modalTree]);
  const dialogs = states.flatMap(([, tr]) => find(tr, (n) => attr(n, 'role') === 'dialog'));
  ok(`每个 role="dialog" 都有 aria-modal="true" 和 aria-label（${dialogs.length} 个）`, dialogs.length >= 2 && states.every(([, tr]) => dialogsOk(tr).length === 0),
    states.map(([n, tr]) => n + ':' + dialogsOk(tr).length).join(' '));
  const unnamed = states.flatMap(([n, tr]) => allButtonsNamed(tr).map((x) => n + ':' + (classesOf(x).join('.') || x.type)));
  ok(`每个按钮都有文字或 aria-label（${states.length} 种状态）`, unnamed.length === 0, unnamed.join(' '));
  const tabsOutside = states.flatMap(([n, tr]) => find(tr, (x) => attr(x, 'role') === 'tab').filter((x) => !find(tr, (l) => attr(l, 'role') === 'tablist' && find(l, (y) => y === x).length).length).map(() => n));
  ok('每个 role="tab" 都在 role="tablist" 里', tabsOutside.length === 0, tabsOutside.join(' '));
}

/* ================================================================ *
 * T5a：apply() 的生命周期
 * ================================================================ */
async function shellLifecycle(t) {
  const { ok, section } = t;
  const J = (v) => JSON.stringify(v);
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);
  section('v6 外壳：apply() 的生命周期');
  if (!t.client) { ok('有 v6 bundle', false); return; }

  /* pagehide、卸载清理、3D 场景释放 */
  {
    const b = loadBundle(t.client, { globals: { AbortController } });
    const listeners = [];
    b.win.addEventListener = (type, fn) => { listeners.push(['add', type, fn]); };
    b.win.removeEventListener = (type, fn) => { listeners.push(['remove', type, fn]); };
    const plugin = b.materialize();
    let destroyed = 0;
    const hasSky = typeof b.sandbox.__ziweiBootstrapSky === 'function';
    if (hasSky) b.sandbox.__ziweiBootstrapSky.api = { destroy() { destroyed++; } };
    const host = makeCtx({});
    plugin.apply(host.ctx);
    const adds = listeners.filter(([op, type]) => op === 'add' && type === 'pagehide');
    ok('apply() 登记一个 pagehide 监听', adds.length === 1);
    ok('apply() 不建默认 store（第一次渲染面板时才建）', b.win.ZWStore.hasDefaultStore() === false);
    let threw = null;
    try { adds[0][2]({ type: 'pagehide' }); } catch (e) { threw = e; }
    ok('还没有 store 时 pagehide 不报错、也不建 store', threw === null && b.win.ZWStore.hasDefaultStore() === false, threw && threw.message);
    const store = b.win.ZWStore.getStore({ storage: memoryStorage(), now: () => NOW });
    let flushed = 0, aborted = 0;
    const realFlush = store.flush, realAbort = store.abortAll;
    store.flush = () => { flushed++; return realFlush(); };
    store.abortAll = () => { aborted++; return realAbort(); };
    adds[0][2]({ type: 'pagehide' });
    eq('pagehide → store.flush()', flushed, 1);
    host.disposeAll();
    const removes = listeners.filter(([op, type, fn]) => op === 'remove' && type === 'pagehide' && fn === adds[0][2]);
    eq('插件卸载：摘掉同一个 pagehide 监听、store.abortAll()、释放 3D 场景（有场景时）', [removes.length, aborted, hasSky ? destroyed : 1], [1, 1, 1]);
  }

  /* 自动打开面板（偏好默认关） */
  {
    const run = (prefs) => {
      const b = loadBundle(t.client);
      const timers = manualTimers();
      b.win.setTimeout = timers.setTimeout;
      b.win.clearTimeout = timers.clearTimeout;
      b.win.localStorage = memoryStorage(prefs);
      const plugin = b.materialize();
      const layout = { calls: [], selectPanel(id) { this.calls.push(id); } };
      const host = makeCtx({ layout });
      plugin.apply(host.ctx);
      return { timers, layout, host };
    };
    const off = run({});
    eq('偏好关（默认）：不排定时器、不切面板', [off.timers.pending.size, off.layout.calls], [0, []]);
    const on = run({ 'ziwei-pro.autopen': '1' });
    eq('偏好开：250ms 后 selectPanel("ziwei")', on.timers.delays(), [250]);
    on.timers.runAll();
    eq('定时器到点：切到紫微面板', on.layout.calls, ['ziwei']);
    const gone = run({ 'ziwei-pro.autopen': '1' });
    gone.host.disposeAll();
    eq('到点之前插件卸载：定时器清掉', [gone.timers.pending.size, gone.layout.calls], [0, []]);
  }

  /* openSession 交给 store（在新会话里继续） */
  {
    const b = loadBundle(t.client);
    b.win.fetch = fakeFetch([{ json: { ok: true, sessionId: 's-1' } }]);
    const opened = [];
    const plugin = b.materialize();
    const host = makeCtx({ uiWorkspace: { openSession: (id) => { opened.push(['first', id]); } } });
    plugin.apply(host.ctx);
    let err = null;
    try { renderShallow(host.main()().children[0]); } catch (e) { err = e; }
    ok('第一次渲染面板时建默认 store', err === null && b.win.ZWStore.hasDefaultStore() === true, err && err.message);
    const store = b.win.ZWStore.getStore();
    const e1 = store.addChart(GOLDEN, '甲');
    store.openChart(e1.id);
    const r1 = await store.handoff();
    await settle();
    eq('在新会话里继续：store 用 apply() 给的 openSession 跳过去', [r1, opened], [true, [['first', 's-1']]]);
    const host2 = makeCtx({ uiWorkspace: { openSession: (id) => { opened.push(['second', id]); } } });
    plugin.apply(host2.ctx);
    const r2 = await store.handoff();
    await settle();
    eq('再 apply 一次（store 已经在了）：换成新的 openSession', [r2, opened[1]], [true, ['second', 's-1']]);
  }
}
