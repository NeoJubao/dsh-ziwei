/**
 * verify/ui-v6-settings.mjs — 设置弹层（66-settings.js，T9）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。在 client-harness 的极简 React 运行时里挂真的面板，从顶栏的设置按钮打开。
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）。
 */
import { bootRuntime, classesOf, find, findByClass, settle, text } from './client-harness.mjs';

const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '',
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const READINGS = 'ziwei-pro.readings.v2';
const J = (v) => JSON.stringify(v);
const attr = (el, k) => (el && el.props ? el.props[k] : undefined);

export default async function settingsChecks(t) {
  const { ok, section } = t;
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);
  if (!t.client) { ok('有 v6 bundle', false); return; }

  let versionReply = { status: 200, json: { ok: true, current: t.version, latest: t.version, updateAvailable: false } };
  const env = bootRuntime(t.client, { now: NOW, reply: (url) => (url.indexOf('/ziwei/version') >= 0 ? versionReply : null) });
  if (env.error) { ok('v6 bundle 装载', false, env.error.message); return; }
  const { store, rt, timers, pipe, storage } = env;
  const tree = () => rt.tree();
  const modal = () => findByClass(tree(), 'zp-modal')[0] || null;
  const button = (root, label) => find(root, (n) => n.type === 'button' && (text(n) === label || attr(n, 'aria-label') === label))[0] || null;
  const rowOf = (title) => findByClass(modal(), 'zp-setting').find((r) => text(find(r, (n) => n.type === 'b')[0]) === title) || null;
  const step = async () => { await settle(); rt.flush(); };

  section('v6 设置：打开、关闭');
  const a = store.addChart(GOLDEN, '甲');
  rt.mount(env.h(env.Main));
  timers.runAll(); rt.flush();
  ok('平时不渲染设置弹层', !modal());
  const gear = () => button(findByClass(tree(), 'zp-head')[0], '设置');
  gear().node.focus();
  rt.click(gear());
  eq('点顶栏的设置：div.zp-modal[role=dialog]，有名字、aria-modal、MODAL 区域', [!!modal(), attr(modal(), 'role'), attr(modal(), 'aria-modal'), attr(modal(), 'aria-label'), attr(modal(), 'data-region')], [true, 'dialog', 'true', '设置', 'MODAL']);
  eq('七块：外观、自动打开、首页 3D 星图、本机数据、版本、回到 DSH 对话、关于', [findByClass(modal(), 'zp-setting').map((r) => text(find(r, (n) => n.type === 'b')[0])), findByClass(modal(), 'zp-about').length >= 1],
    [['外观', '启动时自动打开工作台', '首页 3D 星图', '本机数据', '版本 ' + t.version, '回到 DSH 对话'], true]);
  ok('弹层里每个按钮都有文字或名字', find(modal(), (n) => n.type === 'button').every((n) => text(n).trim() || attr(n, 'aria-label')));
  ok('焦点进了弹层', modal().node.contains(rt.doc.activeElement));
  rt.key(modal(), 'Escape');
  eq('Esc 关掉，焦点回到设置按钮', [!!modal(), rt.doc.activeElement === gear().node], [false, true]);
  rt.click(gear());
  rt.click(findByClass(tree(), 'zp-mask')[0]);
  ok('点遮罩也关掉', !modal());

  section('v6 设置：外观');
  rt.click(gear());
  {
    const group = () => find(rowOf('外观'), (n) => attr(n, 'role') === 'radiogroup')[0];
    const radios = () => find(group(), (n) => attr(n, 'role') === 'radio');
    const root = () => findByClass(tree(), 'zp-root')[0];
    eq('外观是一个单选组（radiogroup，有名字），三项：深色 / 浅色 / 跟随 DSH；默认选深色，根节点 data-theme="dark"',
      [attr(group(), 'aria-label'), radios().map(text), radios().map((n) => attr(n, 'aria-checked')), attr(root(), 'data-theme'), store.getState().prefs.theme],
      ['外观', ['深色', '浅色', '跟随 DSH'], ['true', 'false', 'false'], 'dark', 'dark']);
    rt.click(radios()[1]);
    eq('选浅色：偏好、本机记录、根节点都变了', [store.getState().prefs.theme, storage.getItem('ziwei-pro.theme'), attr(root(), 'data-theme'), radios().map((n) => attr(n, 'aria-checked'))],
      ['light', 'light', 'light', ['false', 'true', 'false']]);
    rt.click(radios()[2]);
    eq('选跟随 DSH：宿主是浅色（body 上没有 data-ds-dark-theme）时解析成浅色', [store.getState().prefs.theme, attr(root(), 'data-theme')], ['auto', 'light']);
    rt.doc.body.setAttribute('data-ds-dark-theme', '');
    rt.flush();
    eq('宿主切到深色：面板跟着变', attr(root(), 'data-theme'), 'dark');
    rt.doc.body.removeAttribute('data-ds-dark-theme');
    rt.flush();
    eq('宿主切回浅色：面板跟着变', attr(root(), 'data-theme'), 'light');
    rt.doc.body.setAttribute('data-ds-dark-theme', '');
    rt.click(radios()[0]);
    rt.doc.body.removeAttribute('data-ds-dark-theme');
    rt.flush();
    eq('选回深色之后不再看宿主', [store.getState().prefs.theme, attr(root(), 'data-theme')], ['dark', 'dark']);
  }

  section('v6 设置：两个开关');
  const sw = (title) => findByClass(rowOf(title), 'zp-switch')[0];
  eq('开关的初值跟着偏好：自动打开 关，3D 星图 开；开关有名字', [attr(sw('启动时自动打开工作台'), 'aria-pressed'), attr(sw('首页 3D 星图'), 'aria-pressed'), attr(sw('启动时自动打开工作台'), 'aria-label'), sw('首页 3D 星图').type],
    ['false', 'true', '启动时自动打开工作台', 'button']);
  rt.click(sw('启动时自动打开工作台'));
  eq('打开"自动打开"：偏好和本机记录都写了', [store.getState().prefs.autoOpen, storage.getItem('ziwei-pro.autopen'), attr(sw('启动时自动打开工作台'), 'aria-pressed')], [true, '1', 'true']);
  rt.click(sw('启动时自动打开工作台'));
  eq('再点关掉', [store.getState().prefs.autoOpen, storage.getItem('ziwei-pro.autopen')], [false, '0']);
  rt.click(sw('首页 3D 星图'));
  eq('关掉 3D 星图：偏好变了，首页退到静态星图', [store.getState().prefs.sky, attr(sw('首页 3D 星图'), 'aria-pressed'), attr(findByClass(tree(), 'zp-home')[0], 'data-nogl') !== undefined], [false, 'false', true]);
  rt.click(sw('首页 3D 星图'));
  eq('再打开', store.getState().prefs.sky, true);

  section('v6 设置：清除本机记录');
  env.P.closeLayers(); rt.flush();
  store.openChart(a.id);
  store.ask('问一句');
  await step();
  pipe.calls[pipe.calls.length - 1].send('done', { text: '答' });
  await step();
  ok('先有一条对话记录在本机', !!JSON.parse(storage.getItem(READINGS) || '{}')[store.keyOf(a)]);
  store.startReport();
  await step();
  rt.click(button(findByClass(tree(), 'zp-head')[0], '设置'));
  const clearBtn = () => find(rowOf('本机数据'), (n) => n.type === 'button')[0];
  eq('有任务在跑：清除按钮禁用，说明原因', [!!attr(clearBtn(), 'disabled'), attr(clearBtn(), 'title')], [true, '正在生成，写完后再清除']);
  pipe.calls[pipe.calls.length - 1].send('done', { text: '## 一、命盘总览\n好。' });
  await step();
  eq('任务结束：按钮可点', [!!attr(clearBtn(), 'disabled'), text(clearBtn())], [false, '清除对话与报告']);
  rt.click(clearBtn());
  eq('第一次点只是确认：按钮换字，记录还在', [text(clearBtn()), !!JSON.parse(storage.getItem(READINGS) || '{}')[store.keyOf(a)]], ['确定清除？清除后不可恢复', true]);
  rt.click(clearBtn());
  const toast = store.getState().session.toast;
  eq('第二次点才清：对话和报告没了，命盘库还在，给提示', [storage.getItem(READINGS), store.reading().thread.length, store.reading().report.text, store.getState().library.length, toast && toast.text], [null, 0, '', 1, '已清除对话与报告']);
  rt.click(clearBtn());
  timers.runAll(); rt.flush();
  eq('确认的字 4 秒后复原', text(clearBtn()), '清除对话与报告');

  section('v6 设置：检查更新');
  const verRow = () => rowOf('版本 ' + t.version);
  const check = () => button(verRow(), '检查更新');
  const versionCalls = () => pipe.calls.filter((c) => c.url.indexOf('/ziwei/version') >= 0);
  eq('打开设置不联网', versionCalls().length, 0);
  rt.click(check());
  eq('点一次只请求一次 GET /ziwei/version', [versionCalls().length, versionCalls()[0] && versionCalls()[0].init.method], [1, 'GET']);
  await step();
  eq('已是最新', text(findByClass(modal(), 'zp-update')[0]), '已是最新（' + t.version + '）');
  versionReply = { status: 200, json: { ok: true, current: t.version, latest: '9.9.9', updateAvailable: true } };
  rt.click(check());
  await step();
  eq('有新版本：给出版本号和终端命令', [text(findByClass(modal(), 'zp-update')[0]), find(modal(), (n) => n.type === 'code').map(text)], ['有新版本 9.9.9，在终端执行：', ['dsh plugin --profile <profile> update dsh-ziwei']]);
  versionReply = { status: 200, json: { ok: false, reason: 'npm registry 超时' } };
  rt.click(check());
  await step();
  eq('检查失败：说明原因', [text(findByClass(modal(), 'zp-update')[0]), classesOf(findByClass(modal(), 'zp-update')[0]).includes('zp-err')], ['检查失败：npm registry 超时', true]);
  versionReply = { status: 404, text: '<!DOCTYPE html><title>Not found</title>' };
  rt.click(check());
  await step();
  eq('路由不在（回的不是 JSON）：说 HTTP 状态，不把解析错误甩给用户', text(findByClass(modal(), 'zp-update')[0]), '检查失败：HTTP 404');
  eq('四次点击一共四次请求（没有轮询、没有自动重试）', versionCalls().length, 4);
  timers.runAll(); rt.flush(); await step();
  eq('放着不动不会再请求', versionCalls().length, 4);

  section('v6 设置：回到 DSH 对话（顶栏不再有「返回会话」，出口在这里）');
  {
    const exitBtn = () => button(rowOf('回到 DSH 对话'), '返回会话');
    eq('最后一行有「返回会话」按钮（type=button，带 zp-exit）', [!!exitBtn(), attr(exitBtn(), 'type'), classesOf(exitBtn()).includes('zp-exit')], [true, 'button', true]);
    env.layout.calls.length = 0;
    rt.click(exitBtn());
    eq('点了：关掉设置，调用 layout.selectPanel(null)', [!!modal(), env.layout.calls], [false, [null]]);
  }
  rt.unmount();

  /* layout 服务不可用：没有这一行，其余照常 */
  {
    const env2 = bootRuntime(t.client, { now: NOW, services: { layout: undefined } });
    if (env2.error) { ok('v6 bundle 装载（没有 layout）', false, env2.error.message); return; }
    env2.rt.mount(env2.h(env2.Main));
    env2.P.openModal('settings');
    env2.rt.flush();
    const m2 = findByClass(env2.rt.tree(), 'zp-modal')[0];
    eq('layout 服务不可用时：设置里没有「回到 DSH 对话」这一行，别的行都在',
      [!!m2, findByClass(m2, 'zp-setting').map((r) => text(find(r, (n) => n.type === 'b')[0])).includes('回到 DSH 对话'), findByClass(m2, 'zp-setting').length, findByClass(env2.rt.tree(), 'zp-exit').length],
      [true, false, 5, 0]);
    env2.rt.unmount();
  }
}
