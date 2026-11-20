/**
 * verify/ui-v6-models.mjs — 模型选择（68-models.js，spec 2026-11-20 §3.5）和「模型没有作答」在面板上的样子
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。在 client-harness 的极简 React 运行时里挂真的面板。
 *   - 模型按钮：首页提问框和紫微师输入区各一个；挂上它、打开面板都不发请求
 *   - 模型弹层：读取中 / 读到了 / 列表是空的 / 读不到（旧 Host）；选一项之后的偏好、提示、请求体
 *   - 模型没有作答：Host 在同一个请求里再问一次时的提示；两次都空时错误条给「重试」和「换个模型」
 * store 这一层（请求体、loadModels、lastModel、retried）在 ui-v6-store.mjs。
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）。
 */
import { bootRuntime, classesOf, find, findByClass, settle, text } from './client-harness.mjs';

const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '',
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const J = (v) => JSON.stringify(v);
const attr = (el, k) => (el && el.props ? el.props[k] : undefined);
const LIST = {
  ok: true,
  providers: [
    { id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }, { id: 'deepseek-pro', name: 'DeepSeek Pro' }] },
    { id: 'other', name: 'Other', models: [{ id: 'm-1', name: 'M One' }] }
  ],
  default: { provider: 'deepseek-official', model: 'deepseek-flash' }
};

export default async function modelChecks(t) {
  const { ok, section } = t;
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);
  if (!t.client) { ok('有 v6 bundle', false); return; }

  let modelsReply = { status: 200, json: LIST };
  const env = bootRuntime(t.client, { now: NOW, reply: (url) => (url.indexOf('/ziwei/models') >= 0 ? modelsReply : null) });
  if (env.error) { ok('v6 bundle 装载', false, env.error.message); return; }
  const { store, rt, timers, pipe, storage, P } = env;
  const tree = () => rt.tree();
  const one = (root, cls) => findByClass(root, cls)[0] || null;
  const modal = () => one(tree(), 'zp-modal');
  const chips = () => findByClass(tree(), 'zp-model');
  const opts = () => findByClass(modal(), 'zp-opt');
  const pressed = () => opts().filter((b) => attr(b, 'aria-pressed') === 'true').map(text);
  const step = async () => { await settle(); rt.flush(); };
  const modelCalls = () => pipe.calls.filter((c) => c.url.indexOf('/ziwei/models') >= 0);
  const askCalls = () => pipe.calls.filter((c) => c.url.indexOf('/ziwei/interpret') >= 0);
  const toast = () => { const x = store.getState().session.toast; return x ? x.text : null; };

  /* ================================================================ */
  section('v6 模型选择：模型按钮');
  const a = store.addChart(GOLDEN, '甲');
  rt.mount(env.h(env.Main));
  timers.runAll(); rt.flush();
  {
    const home = one(tree(), 'zp-home');
    const chip = one(home, 'zp-model');
    eq('首页提问框里有一个模型按钮（form.zp-ask 里，输入框和发送键之间），没选过模型、没读过列表时写「默认模型」',
      [findByClass(one(home, 'zp-ask'), 'zp-model').length, attr(chip, 'type'), text(chip), attr(chip, 'aria-label'), attr(chip, 'aria-haspopup'), classesOf(chip).includes('zp-compact')],
      [1, 'button', '默认模型', '选择模型', 'dialog', true]);
    eq('挂上模型按钮不发任何请求', pipe.calls.length, 0);
  }
  store.openChart(a.id, { panel: true });
  rt.flush();
  {
    const form = one(tree(), 'zp-as-form');
    const tools = one(form, 'zp-as-tools');
    eq('紫微师输入区：form.zp-as-form > textarea + div.zp-as-tools（模型按钮在左，发送键在右）',
      [form && form.type, find(form, (n) => n.type === 'textarea').length, !!tools, findByClass(tools, 'zp-model').length, findByClass(tools, 'zp-send').length,
        find(tools, (n) => n.type === 'button').map((b) => classesOf(b)[0])],
      ['form', 1, true, 1, 1, ['zp-model', 'zp-send']]);
    eq('打开紫微师也不发请求（列模型可能要去问提供方，只在打开模型弹层时读）', pipe.calls.length, 0);
  }

  /* ================================================================ */
  section('v6 模型选择：模型弹层');
  rt.click(one(one(tree(), 'zp-as-form'), 'zp-model'));
  eq('点模型按钮：div.zp-modal[role=dialog]，名字是「模型」，这时才读一次列表',
    [!!modal(), attr(modal(), 'role'), attr(modal(), 'aria-modal'), attr(modal(), 'aria-label'), modelCalls().length, modelCalls()[0] && modelCalls()[0].init.method],
    [true, 'dialog', 'true', '模型', 1, 'GET']);
  eq('读取中：第一项「跟随 DSH 默认」已经在（选中），下面说正在读取', [opts().map(text), pressed(), /正在读取可用模型/.test(text(modal()))], [['跟随 DSH 默认'], ['跟随 DSH 默认'], true]);
  await step();
  eq('读到了：第一项带上 DSH 默认模型的名字，下面按提供方分组（组有名字）',
    [opts().map(text), find(modal(), (n) => attr(n, 'role') === 'group').map((g) => attr(g, 'aria-label')), pressed()],
    [['跟随 DSH 默认（deepseek-flash）', 'DeepSeek Flash', 'DeepSeek Pro', 'M One'], ['DeepSeek', 'Other'], ['跟随 DSH 默认（deepseek-flash）']]);
  ok('每个选项都是 type=button，带 aria-pressed', opts().every((b) => attr(b, 'type') === 'button' && ['true', 'false'].includes(attr(b, 'aria-pressed'))));
  rt.click(opts()[2]);
  eq('选 DeepSeek Pro：弹层关掉，偏好和本机记录写了，提示已切换',
    [!!modal(), store.getState().prefs.model, storage.getItem('ziwei-pro.model'), toast()],
    [false, { provider: 'deepseek-official', model: 'deepseek-pro' }, '{"provider":"deepseek-official","model":"deepseek-pro"}', '已切换到 DeepSeek Pro']);
  eq('模型按钮上的名字跟着变（两个按钮都是）', chips().map(text), ['deepseek-pro', 'deepseek-pro']);
  store.dismissToast();
  store.ask('问一句');
  await step();
  eq('下一次提问的请求体带上选的模型', askCalls().pop().body.model, { provider: 'deepseek-official', model: 'deepseek-pro' });
  askCalls().pop().send('done', { text: '答' });
  await step();

  rt.click(one(one(tree(), 'zp-as-form'), 'zp-model'));
  await step();
  eq('再打开：重新读一次列表，当前选的那项是按下的', [modelCalls().length, pressed()], [2, ['DeepSeek Pro']]);
  rt.click(opts()[2]);
  eq('再点同一项：关掉，不提示（没有变化）', [!!modal(), toast()], [false, null]);
  rt.click(one(one(tree(), 'zp-as-form'), 'zp-model'));
  await step();
  rt.click(opts()[0]);
  eq('选「跟随 DSH 默认」：偏好清掉，本机记录里不留这个键，按钮显示 DSH 的默认模型',
    [store.getState().prefs.model, storage.getItem('ziwei-pro.model'), toast(), chips().map(text)], [null, null, '已改回跟随 DSH 默认', ['deepseek-flash', 'deepseek-flash']]);
  store.dismissToast();

  modelsReply = { status: 200, json: { ok: true, providers: [], default: null } };
  P.openModal('model');
  rt.flush();
  await step();
  eq('列表是空的：说明还没有接入提供方，只有「跟随 DSH 默认」一项', [opts().map(text), /还没有接入模型提供方/.test(text(modal()))], [['跟随 DSH 默认'], true]);
  P.closeLayers();
  rt.flush();

  modelsReply = { status: 404, text: '<!DOCTYPE html><title>Not found</title>' };
  P.openModal('model');
  rt.flush();
  await step();
  eq('读不到（旧 Host 没有这条路由）：说明原因和「要重启 DeepSeek Harness」，给「重新读取」；仍然可以选跟随默认',
    [/读不到模型列表（HTTP 404）/.test(text(modal())), /重启 DeepSeek Harness/.test(text(modal())), find(modal(), (n) => n.type === 'button' && text(n) === '重新读取').length, opts().map(text)],
    [true, true, 1, ['跟随 DSH 默认']]);
  modelsReply = { status: 200, json: LIST };
  const n0 = modelCalls().length;
  rt.click(find(modal(), (n) => n.type === 'button' && text(n) === '重新读取')[0]);
  await step();
  eq('点「重新读取」：再读一次，读到了就列出来', [modelCalls().length - n0, opts().length], [1, 4]);
  store.setModel({ provider: 'gone', model: 'old-model' });
  rt.flush();
  eq('选过的模型不在列表里：按钮仍显示它，弹层里提醒可能失败', [chips().map(text)[0], /现在选的 old-model 不在列表里/.test(text(modal())), pressed()], ['old-model', true, []]);
  store.setModel(null);
  rt.key(modal(), 'Escape');
  ok('Esc 关掉模型弹层', !modal());

  /* ================================================================ */
  section('v6 模型选择：模型没有作答');
  {
    const log = () => one(tree(), 'zp-chat-thread');
    const typing = () => one(log(), 'zp-typing');
    const errBar = () => one(tree(), 'zp-as-error');
    store.ask('你好');
    await step();
    const p = askCalls().pop();
    p.send('start', { provider: 'deepseek-official', model: 'deepseek-flash' });
    p.send('thinking', { chars: 40 });
    await step();
    eq('思考中', text(typing()), '紫微师正在思考…');
    p.send('retry', { reason: 'empty', attempt: 2 });
    await step();
    eq('Host 在同一个请求里再问一次：提示换成「正在再问一次」，没有错误条', [text(typing()), errBar()], ['模型第一次没有作答，正在再问一次…', null]);
    p.send('error', { reason: '模型只做了思考，没有给出回答', kind: 'empty', attempts: 2 });
    await step();
    const btns = () => find(errBar(), (n) => n.type === 'button').map(text);
    eq('两次都空：错误条说明原因（role=alert），给「重试」和「换个模型」', [text(find(errBar(), (n) => n.type === 'span')[0]), attr(errBar(), 'role'), btns()], ['模型只做了思考，没有给出回答', 'alert', ['重试', '换个模型']]);
    rt.click(find(errBar(), (n) => n.type === 'button' && text(n) === '换个模型')[0]);
    eq('点「换个模型」：打开模型弹层', [!!modal(), attr(modal(), 'aria-label')], [true, '模型']);
    P.closeLayers();
    rt.flush();
    const n1 = askCalls().length;
    rt.click(find(errBar(), (n) => n.type === 'button' && text(n) === '重试')[0]);
    await step();
    eq('点「重试」：同一个问题再问一次，气泡不重复', [askCalls().length - n1, askCalls().pop().body.question, findByClass(log(), 'zp-me').map(text).filter((x) => x === '你好').length], [1, '你好', 1]);
    askCalls().pop().send('error', { reason: '命中长度上限', kind: 'max-tokens', canContinue: true });
    await step();
    eq('别的错误（长度上限）：只有「接着写」或「重试」，没有「换个模型」', btns().includes('换个模型'), false);
  }
  rt.unmount();
}
