/**
 * verify/ui-v6-shell.mjs — v6 外壳：源码能拼、bundle 能在裸 vm 里求值、宿主约定在位（T1）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。覆盖：
 *   - src/ui/ 的文件齐全、每个文件单独过语法检查；build.mjs 的拼接守卫真的会拦（重名声明、\r、反引号…）
 *   - 加载只注册 factory（ZWEngine / ZWCore / THREE 都不存在）；factory 返回 inject + apply
 *   - apply 注册侧栏入口和 main（key=ziwei），样式随 ctx.effect 注入、卸载时移除
 *   - 「返回会话」由 ProApp 自己渲染、是顶栏第一个控件、调用 layout.selectPanel(null)；layout 不可用时不渲染
 *   - 宿主约定的 CSS、产物里不该出现的字符串、字典、图标表、档位
 */
import vm from 'node:vm';
import { assembleUiFrom, readUiSources } from '../build.mjs';
import { classesOf, fakeLocale, find, findByClass, loadBundle, makeCtx, renderDeep, renderShallow, text } from './client-harness.mjs';

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
}
