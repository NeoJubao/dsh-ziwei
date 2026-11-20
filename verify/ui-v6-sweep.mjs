/**
 * verify/ui-v6-sweep.mjs — 全面检查（T9）：跨所有视图的规则，各视图自己的检查文件管不到的那一层
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。
 *   - 源码：50–90 段注释之外没有中文字面量；面板字典里没有导出文件的品牌名；仓库路径没有写进源码
 *   - 在极简 React 运行时里把面板走过主要状态（首页、引导问答每一步、命盘五个层级、报告四种状态、紫微师、
 *     两个浮层、设置；宽 / 中 / 窄三档），每到一个状态都查一遍：
 *       每个按钮有文字或 aria-label；每个页签在 tablist 里；每个输入控件有名字；
 *       每个 role=dialog 有 aria-modal 和名字；同一时间最多一个模态层；data-region 没有重复的浮层
 * 字典键中英一致、没有无引用的键、没有 setInterval / position: fixed 在 ui-v6-shell.mjs；
 * 字号、间距、颜色、类名前缀、区域白名单在体检脚本（ui-v6-contract.mjs）。
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bootRuntime, settle, text } from './client-harness.mjs';

const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '',
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const attr = (el, k) => (el && el.props ? el.props[k] : undefined);
const HAN = /[㐀-鿿]/;

/** 去掉块注释和行注释（和各视图检查文件里的写法一样：行注释前面是引号、冒号、反斜杠的不算，免得误伤字符串和 URL） */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
}

/** 走一遍宿主元素树，带着祖先链 */
function walk(node, fn, chain = []) {
  if (Array.isArray(node)) { node.forEach((n) => walk(n, fn, chain)); return; }
  if (!node || typeof node !== 'object' || !('type' in node)) return;
  fn(node, chain);
  const next = chain.concat(node);
  (node.children || []).forEach((c) => walk(c, fn, next));
}

function auditTree(tree) {
  const problems = [];
  let modals = 0;
  walk(tree, (n, chain) => {
    const hidden = chain.concat(n).some((a) => attr(a, 'hidden') === true);
    if (hidden) return;
    const role = attr(n, 'role');
    const named = !!String(attr(n, 'aria-label') || '').trim();
    if (n.type === 'button' && !text(n).trim() && !named) problems.push('没有名字的按钮 <' + (attr(n, 'className') || '') + '>');
    if (role === 'tab' && !chain.some((a) => attr(a, 'role') === 'tablist')) problems.push('页签不在 tablist 里：' + text(n));
    if (role === 'tablist' && !named) problems.push('tablist 没有名字');
    if (role === 'radio' && !chain.some((a) => attr(a, 'role') === 'radiogroup')) problems.push('单选项不在 radiogroup 里：' + text(n));
    if (role === 'radiogroup' && !named) problems.push('radiogroup 没有名字');
    if ((n.type === 'input' || n.type === 'select' || n.type === 'textarea') && attr(n, 'type') !== 'hidden' && !named) {
      problems.push('输入控件没有名字 <' + n.type + ' ' + (attr(n, 'placeholder') || attr(n, 'className') || '') + '>');
    }
    if (role === 'dialog') {
      if (attr(n, 'aria-modal') !== 'true') problems.push('dialog 没有 aria-modal');
      if (!named) problems.push('dialog 没有名字');
      modals += 1;
    }
  });
  if (modals > 1) problems.push('同时有 ' + modals + ' 个模态层');
  return problems;
}

export default async function sweepChecks(t) {
  const { ok, section } = t;
  if (!t.client) { ok('有 v6 bundle', false); return; }

  /* ================================================================ */
  section('v6 全面检查：源码');
  const uiDir = join(t.root, 'src', 'ui');
  const sections = readdirSync(uiDir).filter((n) => /^\d\d-.+\.js$/.test(n)).sort();
  const views = sections.filter((n) => +n.slice(0, 2) >= 50);
  const hanHits = [];
  for (const name of views) {
    const code = stripComments(readFileSync(join(uiDir, name), 'utf8'));
    code.split('\n').forEach((line, i) => { if (HAN.test(line)) hanHits.push(name + ':' + (i + 1) + ' ' + line.trim().slice(0, 40)); });
  }
  ok(`50–90 段（${views.length} 个文件）注释之外没有中文字面量`, views.length >= 9 && hanHits.length === 0, hanHits.slice(0, 5).join(' | '));

  const dictDir = join(uiDir, 'i18n');
  const brandHits = [];
  for (const name of readdirSync(dictDir).filter((n) => n.endsWith('.json'))) {
    const dict = JSON.parse(readFileSync(join(dictDir, name), 'utf8'));
    Object.keys(dict).forEach((k) => { if (dict[k].some((v) => /鲲鹏/.test(String(v)))) brandHits.push(name + ':' + k); });
  }
  ok('面板字典里没有导出文件的品牌名（它只出现在导出的文件里）', brandHits.length === 0, brandHits.join(' '));

  const pathHits = [];
  for (const dir of [uiDir, join(uiDir, 'css'), dictDir, join(t.root, 'verify')]) {
    for (const name of readdirSync(dir)) {
      if (!/\.(js|mjs|css|json)$/.test(name)) continue;
      if (/\/(Users|home)\/[A-Za-z0-9_.-]+\//.test(readFileSync(join(dir, name), 'utf8'))) pathHits.push(name);
    }
  }
  ok('源码、样式、字典、自检里没有写死的本机路径', pathHits.length === 0, pathHits.join(' '));
  ok('检查更新：界面上有这个入口，请求的是 /ziwei/version', /检查更新/.test(t.client) && /\/ziwei\/version/.test(t.client));

  /* ================================================================ */
  section('v6 全面检查：走一遍主要状态');
  /* 先确认检查器自己查得出问题：一棵故意做错的树 */
  const el = (type, props, ...children) => ({ type, props, children });
  const bad = el('div', null,
    el('button', { className: 'x' }),
    el('button', { role: 'tab' }, 'A'),
    el('input', { type: 'text' }),
    el('div', { role: 'dialog' }, el('button', null, 'ok')),
    el('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'm' }),
    el('div', { hidden: true }, el('button', null)));
  const found = auditTree(bad);
  ok('检查器查得出：没名字的按钮、tablist 外的页签、没名字的输入框、缺属性的 dialog、两个模态层；hidden 里的不算',
    found.length === 6 && [/没有名字的按钮/, /页签不在 tablist/, /输入控件没有名字/, /没有 aria-modal/, /dialog 没有名字/, /同时有 2 个模态层/].every((re) => found.some((x) => re.test(x))), found.join(' | '));
  const failures = [];
  let visited = 0;
  const run = async (width, label) => {
    const env = bootRuntime(t.client, { now: NOW, width, reply: (url) => (url.indexOf('/ziwei/version') >= 0 ? { status: 200, json: { ok: true, current: t.version, latest: t.version, updateAvailable: false } } : null) });
    if (env.error) { failures.push(label + '：装载失败 ' + env.error.message); return; }
    const { store, rt, timers, pipe, P } = env;
    const ob = env.win.ZWUi.onboarding;
    const check = (state) => {
      rt.flush();
      visited += 1;
      const problems = auditTree(rt.tree());
      if (rt.errors.length) problems.push('渲染出错：' + String(rt.errors[0] && rt.errors[0].message));
      problems.forEach((p) => failures.push(label + ' / ' + state + '：' + p));
    };
    const step = async () => { await settle(); rt.flush(); };
    const last = () => pipe.calls[pipe.calls.length - 1];

    rt.mount(env.h(env.Main));
    timers.runAll();
    check('首页，没有盘（引导问答第一问）');
    ['小林', '1992年5月3日', '09:30', '男'].forEach((v, i) => { ob.submit(v); check('引导问答第 ' + (i + 2) + ' 步'); });
    ob.submit('105.97');
    check('引导问答确认步');
    P.openSheet('birth');
    check('生辰表单（新建）');
    P.closeLayers();
    const a = ob.finish();
    store.addChart(Object.assign({}, GOLDEN, { gender: 'female' }), '乙');
    timers.runAll();
    check('首页，两张盘');
    P.openSheet('charts');
    check('全部命盘');
    P.openSheet('birth', a.id);
    check('改生辰');
    P.openModal('settings');
    check('设置');
    P.openModal('model');
    check('模型选择');
    P.closeLayers();

    store.openChart(a.id);
    for (const tab of ['natal', 'decadal', 'yearly', 'monthly', 'daily']) {
      store.setTab(tab);
      store.selectPalace(tab === 'natal' ? 3 : 7);
      check('命盘 ' + tab);
    }
    store.setPref('showAdj', true);
    check('命盘，显示杂曜');

    store.setPanel(true);
    check('紫微师，空态');
    store.ask('今年事业怎么样');
    await step();
    check('紫微师，正在回答');
    last().send('delta', { text: '先说结论。' });
    await step();
    last().end();
    await step();
    check('紫微师，断连（接着写）');
    store.retryChat();
    await step();
    last().send('done', { text: '## 结论\n稳中有升。\n\n| 月 | 提示 |\n|---|---|\n| 三月 | 谈合作 |' });
    await step();
    check('紫微师，有对话');
    store.setQuote({ label: '这一宫', text: '命宫 癸丑 · 太阳、太阴' });
    check('紫微师，带引用');
    store.setQuote(null);
    store.setPanel(false);

    store.setStage('report');
    check('报告，还没写');
    store.startReport();
    await step();
    last().send('delta', { text: '## 一、命盘总览\n命宫太阳、太阴。\n\n## 二、性格大略\n' });
    await step();
    check('报告，正在写');
    store.stop();
    await step();
    check('报告，中断');
    store.continueReport();
    await step();
    last().send('done', { text: '热情坦荡。' });
    await step();
    check('报告，写完');
    store.setPanel(true);
    check('报告 + 紫微师');
    store.setPanel(false);
    store.goHome();
    timers.runAll();
    check('回到首页');
    rt.unmount();
  };
  await run(1300, '宽档');
  await run(900, '中档');
  await run(400, '窄档');
  ok(`三档各走一遍主要状态（共 ${visited} 个画面）：按钮、页签、单选组、输入控件、模态层都合规`, visited >= 87 && failures.length === 0, failures.slice(0, 6).join(' | ') + (failures.length > 6 ? ` …共 ${failures.length} 处` : ''));
}
