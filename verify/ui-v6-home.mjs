/**
 * verify/ui-v6-home.mjs — 首页（60-home.js，T8a）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。都在 client-harness 的极简 React 运行时里：
 *   - 把 passive effect 扣住（mount 的 passive: false）看静态结构：标签、状态句、区域标记，以及"渲染首页不执行 3D 那一段"；
 *   - 装一个假的星图（记录调用，不画任何东西）看行为：场景的创建 / 停放、标签和星图互相通知、
 *     飞入 / 飞出、开场、没有 3D 时的退路、改名 / 删除。
 * 画面本身（星图、标签跟着星球走、过渡）只能在浏览器里看，见 docs/plans 里 T8a 的复核项。
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）和它的女命变体。"今天"固定为 2026-11-19。
 */
import vm from 'node:vm';
import { bootRuntime, classesOf, find, findByClass, memoryStorage, settle, text } from './client-harness.mjs';

const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '',
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
const GOLDEN_F = Object.assign({}, GOLDEN, { gender: 'female' });
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const J = (v) => JSON.stringify(v);
const attr = (el, k) => (el && el.props ? el.props[k] : undefined);

/** 假星图：接口和 src/sky.js 一样，只记账。hold 里点名的动画不自动回调，测试自己放行。 */
function fakeSky({ ok = true, introMs = 0, hold = [] } = {}) {
  const log = [];
  const cb = {};
  const names = () => log.map((x) => x[0]);
  const make = () => {
    const sky = { ok, introMs, canvas: {}, isDead: () => false };
    ['setPlanets', 'focus', 'hover', 'layers', 'grade', 'scrim', 'show', 'replay', 'rise', 'resize', 'park', 'reopen', 'dispose']
      .forEach((k) => { sky[k] = (...a) => { log.push([k, ...a]); }; });
    ['onHover', 'onPick', 'onGesture', 'onLost'].forEach((k) => { sky[k] = (fn) => { cb[k] = fn; }; });
    sky.dive = (id, _col, done) => { log.push(['dive', id]); if (hold.includes('dive')) cb.dive = done; else done(); };
    sky.birth = (id, done) => { log.push(['birth', id]); if (hold.includes('birth')) cb.birth = done; else done(); };
    return sky;
  };
  const api = {
    acquire(host, opts) { log.push(['acquire', opts, !!host]); api.last = make(); return api.last; },
    release(sky, keep) { log.push(['release', keep]); },
    destroy() { log.push(['destroy']); },
    create() { return make(); }
  };
  const boot = () => api;
  boot.api = api;
  return { api, boot, log, cb, names, count: (k) => log.filter((x) => x[0] === k).length, last: (k) => log.filter((x) => x[0] === k).pop() };
}

export default async function homeChecks(t) {
  const { ok, section } = t;
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);
  if (!t.client) { ok('有 v6 bundle', false); return; }

  /** 一套新环境：bundle + 运行时 + 默认 store；sky 给了就把假星图装到 __ziweiBootstrapSky 上 */
  const fresh = (o = {}) => {
    const env = bootRuntime(t.client, { now: NOW, width: o.width || 1300, storage: o.storage || null });
    if (env.error) throw env.error;
    if (o.sky) env.loaded.sandbox.__ziweiBootstrapSky = o.sky.boot;
    env.mount = () => env.rt.mount(env.h(env.Main));
    env.tree = () => env.rt.tree();
    env.home = () => findByClass(env.tree(), 'zp-home')[0];
    env.tags = () => findByClass(env.tree(), 'zp-ptag');
    env.byText = (label) => find(env.tree(), (n) => n.type === 'button' && (text(n) === label || attr(n, 'aria-label') === label))[0] || null;
    env.settleAll = async () => { await settle(); env.rt.flush(); };
    return env;
  };
  const has = (el, k) => !!el && el.props && el.props[k] !== undefined && el.props[k] !== null && el.props[k] !== false;

  /* ================================================================ */
  section('v6 首页：结构（passive effect 扣住，场景还没创建）');
  {
    const env = fresh();
    const { store, rt, h, Main } = env;
    const a = store.addChart(GOLDEN, '甲');
    const b = store.addChart(GOLDEN_F, '乙');
    rt.mount(h(Main), { passive: false });
    const tree = env.tree();
    const home = findByClass(tree, 'zp-home')[0];
    ok('section.zp-home 在面板里', !!home && home.type === 'section');
    eq('两个区域：div.zp-sky 是 HOME_SKY，div.zp-col 是 HOME_TALK',
      [attr(findByClass(home, 'zp-sky')[0], 'data-region'), attr(findByClass(home, 'zp-col')[0], 'data-region')], ['HOME_SKY', 'HOME_TALK']);
    ok('渲染首页不执行 3D 那一段（__ziweiBootstrapSky.api 还不存在）',
      vm.runInContext('typeof __ziweiBootstrapSky === "function" && typeof __ziweiBootstrapSky.api', env.loaded.sandbox) === 'undefined');

    const tags = findByClass(home, 'zp-ptag');
    eq('两张盘 → 两个标签，按最近的在前；data-pid 是命盘 id', tags.map((x) => attr(x, 'data-pid')), [b.id, a.id]);
    ok('有 3D 时标签节点不带 style（位置由场景直接写）', tags.every((x) => attr(x, 'style') === undefined));
    const tagA = tags[1];
    const main = findByClass(tagA, 'zp-ptag-main')[0];
    eq('标签三行：称呼、公历生日、命宫主星和五行局', [main && main.type, find(main, (n) => n.type === 'b').map(text), find(main, (n) => n.type === 'span').map(text), find(main, (n) => n.type === 'i').map(text)],
      ['button', ['甲'], ['1992.05.03'], ['太阳、太阴坐命 · 木三局']]);
    eq('标签的两个按钮都有名字', [attr(main, 'aria-label'), attr(findByClass(tagA, 'zp-ptag-more')[0], 'aria-label')], ['打开甲的命盘', '甲：改名、改生辰或删除']);
    ok('菜单默认不渲染', findByClass(home, 'zp-ptag-menu').length === 0);

    const status = findByClass(home, 'zp-status')[0];
    eq('状态句是当前聚焦那张盘（没有聚焦时取最近的一张）今天的流日：宫名、化禄星、化忌星、这一宫管什么',
      [status && status.type, text(status)], ['h1', '乙，今天流日命宫走到你的父母宫，太阴化禄，巨门化忌。重心在长辈与文书。']);
    eq('宫名和重心加粗，两颗星按星色', [find(status, (n) => n.type === 'strong').map(text), findByClass(status, 'zp-st').map((n) => [text(n), attr(n, 'style')])],
      [['父母宫', '长辈与文书'], [['太阴', { '--zp-c': 'var(--zp-s7)' }], ['巨门', { '--zp-c': 'var(--zp-s9)' }]]]);
    const date = findByClass(home, 'zp-date-line')[0];
    eq('日期行：公历、农历、当天干支（干支加重）', [text(date), find(date, (n) => n.type === 'b').map(text)], ['11月19日 · 农历十月十一 · 丁酉日', ['丁酉日']]);

    const form = findByClass(home, 'zp-ask')[0];
    const input = find(form, (n) => n.type === 'input')[0];
    eq('输入框：form.zp-ask > input + button.zp-send，都有名字', [form && form.type, attr(input, 'aria-label'), attr(input, 'placeholder'), attr(findByClass(form, 'zp-send')[0], 'aria-label'), attr(findByClass(form, 'zp-send')[0], 'type')],
      ['form', '向紫微师提问', '问紫微师', '发送', 'submit']);
    eq('三个快捷项', findByClass(home, 'zp-chip').map(text), ['看今天', '这十年要注意什么', '排一张新盘']);
    ok('首页不重复顶栏的按钮（没有"全部命盘""设置"）', find(home, (n) => n.type === 'button' && ['全部命盘', '设置'].includes(attr(n, 'aria-label'))).length === 0);
    ok('每个按钮都有文字或 aria-label', find(home, (n) => n.type === 'button').every((n) => text(n).trim() || attr(n, 'aria-label')));

    rt.unmount();
  }
  {
    const env = fresh();
    const { store, rt, h, Main } = env;
    const ids = [];
    for (let i = 0; i < 11; i++) ids.push(store.addChart(Object.assign({}, GOLDEN, { minute: i }), '盘' + i).id);
    store.openChart(ids[0]);
    store.goHome();
    rt.mount(h(Main), { passive: false });
    /* 自检的时钟是固定的：打开过的那张 openedAt 等于它自己的建盘时间，比后建的 10 张都早，所以排在 8 张之外 */
    eq('命盘超过 8 张：只有最近的 8 个标签（按时间新→旧）', env.tags().map((x) => attr(x, 'data-pid')), ids.slice(3).reverse());
    eq('聚焦的盘不在这 8 张里：状态句照样说它', text(findByClass(env.home(), 'zp-status')[0]).slice(0, 3), '盘0，');
    rt.unmount();
  }
  {
    const env = fresh();
    env.rt.mount(env.h(env.Main), { passive: false });
    const tree = env.tree();
    eq('没有盘：没有标签', findByClass(tree, 'zp-ptag').length, 0);
    eq('没有盘：第一帧就是引导问答的第一问（section 带 data-onboarding；还没回答，session.onboarding 不用先写）',
      [has(env.home(), 'data-onboarding'), text(findByClass(tree, 'zp-status')[0]), env.store.getState().session.onboarding], [true, '我是紫微师。先说说，怎么称呼你？', null]);
    eq('没有盘时的快捷项是引导问答的：跳过、直接填表、看示例盘（没有"取消"）', findByClass(tree, 'zp-chip').map(text), ['跳过', '直接填表', '看示例盘']);
    ok('日期行还在（没有盘时用示例盘取当天干支）', text(findByClass(tree, 'zp-date-line')[0]) === '11月19日 · 农历十月十一 · 丁酉日');
    env.rt.unmount();
  }

  /* ================================================================ */
  section('v6 首页：星图的创建、停放和标签');
  {
    const sky = fakeSky();
    const env = fresh({ sky });
    const { store, rt, timers } = env;
    const a = store.addChart(GOLDEN, '甲');
    const b = store.addChart(GOLDEN_F, '乙');
    env.mount();
    eq('首页第一次显示：向场景要一次画面，默认外观是深色、用夜空，开场还没播过', [sky.count('acquire'), sky.last('acquire').slice(1)], [1, [{ day: false, playIntro: true }, true]]);
    eq('开场只算一次：会话里记下已经播过', store.getState().session.introPlayed, true);
    const planets = sky.last('setPlanets')[1];
    eq('星球：最近的 8 张盘，id 和标签一致；颜色是命宫主星的星色（太阳）', [planets.map((p) => p.id), planets.map((p) => p.color), planets[0].star],
      [[b.id, a.id], ['#f3ab70', '#f3ab70'], '太阳']);
    eq('把标签层、准星、对话栏交给场景（三个节点）', sky.last('layers').slice(1).map((n) => !!n && !!n.tagName), [true, true, true]);
    eq('聚焦的星球：没有记录时是最近的一张', sky.last('focus')[1], b.id);
    ok('场景画出第一帧之前界面先收着（data-busy）', has(env.home(), 'data-busy'));
    timers.runAll(); rt.flush();
    ok('画出来之后放开', !has(env.home(), 'data-busy'));
    ok('有 3D：没有 data-nogl，标签层不是平铺', !has(env.home(), 'data-nogl') && !classesOf(findByClass(env.home(), 'zp-planets')[0]).includes('zp-flat'));

    /* 悬停：标签 → 场景 */
    const tagOf = (id) => env.tags().find((x) => attr(x, 'data-pid') === id);
    attr(tagOf(a.id), 'onMouseEnter')(); rt.flush();
    eq('指到标签上：告诉场景、标签加 zp-on、状态句换成这张盘', [sky.last('hover')[1], classesOf(tagOf(a.id)).includes('zp-on'), text(findByClass(env.home(), 'zp-status')[0]).slice(0, 2)], [a.id, true, '甲，']);
    const hovers = sky.count('hover');
    sky.cb.onHover(b.id); rt.flush();
    eq('场景里指到星球：标签和状态句跟着换，不再回头通知场景', [classesOf(tagOf(b.id)).includes('zp-on'), classesOf(tagOf(a.id)).includes('zp-on'), text(findByClass(env.home(), 'zp-status')[0]).slice(0, 2), sky.count('hover')], [true, false, '乙，', hovers]);
    sky.cb.onHover(null); timers.runAll(); rt.flush();
    eq('移开一会儿之后回到聚焦的那张', [env.tags().some((x) => classesOf(x).includes('zp-on')), text(findByClass(env.home(), 'zp-status')[0]).slice(0, 2)], [false, '乙，']);

    /* 点标签：飞进去，落在流日 */
    rt.click(findByClass(tagOf(a.id), 'zp-ptag-main')[0]);
    const s1 = store.getState().session;
    eq('点标签：先让场景飞向那颗星，再打开这张盘的流日，选中流日命宫', [sky.last('dive')[1], s1.view, s1.chartId, s1.tab, s1.sel === store.horoscope().daily.index, s1.panelOpen], [a.id, 'chart', a.id, 'daily', true, false]);
    timers.runAll(); rt.flush();
    eq('进了命盘之后停掉星图的渲染', sky.last('show')[1], false);

    /* 回首页：拉远 */
    store.goHome(); rt.flush();
    eq('回到首页：星图重新开画，从刚才那颗星拉远', [sky.names().slice(-2), sky.last('rise')[1]], [['show', 'rise'], a.id]);
    ok('拉远的时候界面先收着', has(env.home(), 'data-busy'));
    timers.runAll(); rt.flush();
    ok('随后放开', !has(env.home(), 'data-busy'));
    eq('刚看过的盘成为聚焦', sky.last('focus')[1], a.id);

    /* 点 3D 里的星球 */
    sky.cb.onPick(b.id); rt.flush();
    eq('点星球：进入那张盘的流日', [store.getState().session.view, store.getState().session.chartId, store.getState().session.tab], ['chart', b.id, 'daily']);
    store.goHome(); rt.flush(); timers.runAll(); rt.flush();

    /* 卸载 / 再挂载 */
    const acquired = sky.count('acquire');
    rt.unmount();
    eq('面板卸载：把场景停放起来（不带时限 = 默认停放）', [sky.count('release'), sky.last('release')[1]], [1, undefined]);
    env.mount();
    eq('再挂载：重新要回场景，这次不播开场', [sky.count('acquire') - acquired, sky.last('acquire')[1].playIntro], [1, false]);
    timers.runAll(); rt.flush();
    ok('再挂载之后界面是放开的', !has(env.home(), 'data-busy'));
    rt.unmount();
  }
  {
    /* 在命盘页挂载：先不创建场景 */
    const sky = fakeSky();
    const env = fresh({ sky });
    const { store, rt, timers } = env;
    const a = store.addChart(GOLDEN, '甲');
    store.openChart(a.id);
    env.mount();
    eq('面板挂载时停在命盘页：不创建星图', sky.count('acquire'), 0);
    store.goHome(); rt.flush(); timers.runAll(); rt.flush();
    eq('回到首页才创建', sky.count('acquire'), 1);
    ok('创建好之后界面放开', !has(env.home(), 'data-busy'));
    rt.unmount();
  }
  {
    /* 开场 */
    const sky = fakeSky({ introMs: 3600 });
    const env = fresh({ sky });
    const { store, rt, timers } = env;
    store.addChart(GOLDEN, '甲');
    env.mount();
    ok('开场播放时界面收着', has(env.home(), 'data-busy'));
    eq('深色下等开场过半（3600 × 0.52 = 1872ms）再放开', timers.delays().includes(1872), true);
    timers.runAll(); rt.flush();
    ok('开场过后放开', !has(env.home(), 'data-busy'));
    rt.unmount();
  }
  {
    /* 外观：夜空 / 晨光跟面板自己的 data-theme 走，不看宿主 */
    const sky = fakeSky({ introMs: 3600 });
    const env = fresh({ sky, storage: memoryStorage({ 'ziwei-pro.theme': 'light' }) });
    const { store, rt, timers } = env;
    store.addChart(GOLDEN, '甲');
    env.mount();
    eq('外观选了浅色：根节点 data-theme="light"，场景用晨光，等开场的八成（2880ms）再放开',
      [attr(findByClass(env.tree(), 'zp-root')[0], 'data-theme'), sky.last('acquire')[1].day, timers.delays().includes(2880)], ['light', true, true]);
    timers.runAll(); rt.flush();
    const before = [sky.count('grade'), sky.count('scrim')];
    store.setPref('theme', 'dark');
    rt.flush();
    eq('用着的时候换成深色：根节点跟着变，场景换成夜空（grade(false)）并重取一次底色（scrim）',
      [attr(findByClass(env.tree(), 'zp-root')[0], 'data-theme'), sky.count('grade') - before[0], sky.last('grade')[1], sky.count('scrim') - before[1]], ['dark', 1, false, 1]);
    eq('偏好写进了本机记录', env.storage.getItem('ziwei-pro.theme'), 'dark');
    store.setPref('theme', 'dark');
    rt.flush();
    eq('同一个值再设一次：场景不动', sky.count('grade') - before[0], 1);
    rt.unmount();
  }

  /* ================================================================ */
  section('v6 首页：提问和快捷项');
  {
    const sky = fakeSky();
    const env = fresh({ sky });
    const { store, rt, timers, pipe } = env;
    const a = store.addChart(GOLDEN, '甲');
    env.mount(); timers.runAll(); rt.flush();
    const input = () => find(env.home(), (n) => n.type === 'input')[0];
    const form = () => findByClass(env.home(), 'zp-ask')[0];
    const submit = () => { attr(form(), 'onSubmit')({ preventDefault() {} }); rt.flush(); };

    submit();
    eq('空着发送：什么都不做', [store.getState().session.view, pipe.calls.length], ['home', 0]);
    attr(input(), 'onChange')({ target: { value: '  今年适合换工作吗 ' } }); rt.flush();
    eq('输入框受控', attr(input(), 'value'), '  今年适合换工作吗 ');
    submit();
    await env.settleAll();
    const s = store.getState().session;
    eq('发送问题：打开聚焦的盘（本命）、打开紫微师、把问题发出去', [s.view, s.chartId, s.tab, s.panelOpen, pipe.calls.length, pipe.calls[0] && pipe.calls[0].body.question, store.reading().thread[0]],
      ['chart', a.id, 'natal', true, 1, '今年适合换工作吗', { role: 'user', content: '今年适合换工作吗' }]);
    pipe.calls[0].send('done', { text: '答' });
    await env.settleAll();
    store.goHome(); rt.flush(); timers.runAll(); rt.flush();
    eq('回来之后输入框是空的', attr(input(), 'value'), '');

    rt.click(env.byText('看今天'));
    eq('看今天：进入聚焦那张盘的流日', [store.getState().session.view, store.getState().session.tab, store.getState().session.panelOpen], ['chart', 'daily', false]);
    store.goHome(); rt.flush(); timers.runAll(); rt.flush();

    rt.click(env.byText('这十年要注意什么'));
    await env.settleAll();
    const s2 = store.getState().session;
    const call = pipe.calls[pipe.calls.length - 1];
    eq('这十年要注意什么：进入大限、打开紫微师并提问，带上这十年的定位', [s2.tab, s2.panelOpen, pipe.calls.length, call.body.question, Array.isArray(call.body.meta.decadalFocus)], ['decadal', true, 2, '这十年要注意什么', true]);
    call.send('done', { text: '答' });
    await env.settleAll();
    store.goHome(); rt.flush(); timers.runAll(); rt.flush();

    rt.click(env.byText('排一张新盘'));
    eq('排一张新盘：进入引导问答（第 0 步，section 带 data-onboarding），有"取消"', [store.getState().session.onboarding && store.getState().session.onboarding.step, has(env.home(), 'data-onboarding'), !!env.byText('取消')], [0, true, true]);
    ok('引导问答时平常的快捷项收起', !env.byText('看今天'));
    rt.click(env.byText('取消'));
    eq('取消：回到平常的首页', [store.getState().session.onboarding, has(env.home(), 'data-onboarding'), !!env.byText('看今天')], [null, false, true]);
    rt.unmount();
  }

  /* ================================================================ */
  section('v6 首页：引导问答排出新盘');
  {
    const sky = fakeSky({ hold: ['birth'] });
    const env = fresh({ sky });
    const { store, rt, timers } = env;
    env.mount(); timers.runAll(); rt.flush();
    const say = (v) => { const r = env.loaded.win.ZWUi.onboarding.submit(v); rt.flush(); return r; };
    say('小林'); say('1992年5月3日'); say('09:30'); say('男'); say('105.97');
    eq('答完五项到确认步，确认句里说明校正后时辰变了', [store.getState().session.onboarding.step, /校正后是 08:37，落在辰时（钟表时间 09:30 是巳时）/.test(text(findByClass(env.home(), 'zp-status')[0]))], [5, true]);
    const planetsBefore = sky.count('setPlanets');
    rt.click(env.byText('排盘'));
    const lib = store.getState().library;
    eq('点排盘：命盘进库、引导结束、聚焦新盘；还在首页，界面收着', [lib.length, lib[0] && lib[0].name, store.getState().session.onboarding, store.getState().session.focusId === (lib[0] && lib[0].id), store.getState().session.view, has(env.home(), 'data-busy')],
      [1, '小林', null, true, 'home', true]);
    eq('先把新星加进场景，再放诞生动画', [sky.count('setPlanets') > planetsBefore, sky.last('setPlanets')[1].map((p) => p.id), sky.last('birth')[1], sky.names().lastIndexOf('setPlanets') < sky.names().lastIndexOf('birth')],
      [true, [lib[0].id], lib[0].id, true]);
    sky.cb.birth(); rt.flush();
    const s = store.getState().session;
    eq('动画放完：进入这张盘的本命，紫微师打开；没有发任何请求', [s.view, s.chartId, s.tab, s.panelOpen, env.pipe.calls.length], ['chart', lib[0].id, 'natal', true, 0]);
    rt.unmount();
  }
  {
    /* 没有 3D：排盘之后直接进命盘 */
    const sky = fakeSky({ ok: false });
    const env = fresh({ sky });
    const { store, rt, timers } = env;
    env.mount(); timers.runAll(); rt.flush();
    const say = (v) => { env.loaded.win.ZWUi.onboarding.submit(v); rt.flush(); };
    say('小林'); say('1992年5月3日'); say('09:30'); say('男'); say('跳过');
    rt.click(env.byText('排盘'));
    eq('没有 3D：排盘之后直接进入本命、紫微师打开', [store.getState().session.view, store.getState().session.tab, store.getState().session.panelOpen, sky.count('birth')], ['chart', 'natal', true, 0]);
    rt.unmount();
  }

  /* ================================================================ */
  section('v6 首页：标签菜单（改名、改生辰、删除）');
  {
    const sky = fakeSky();
    const env = fresh({ sky });
    const { store, rt, timers } = env;
    const a = store.addChart(GOLDEN, '甲');
    env.mount(); timers.runAll(); rt.flush();
    const tag = () => env.tags()[0];
    const more = () => findByClass(tag(), 'zp-ptag-more')[0];
    const menu = () => findByClass(tag(), 'zp-ptag-menu')[0];
    const item = (label) => find(menu(), (n) => n.type === 'button' && text(n) === label)[0];

    rt.click(more());
    eq('点 ⋯：菜单里是改名、改生辰、删除；按钮标明已展开；标签保持高亮', [find(menu(), (n) => n.type === 'button').map(text), attr(more(), 'aria-expanded'), classesOf(tag()).includes('zp-on')], [['改名', '改生辰', '删除'], 'true', true]);
    rt.key(more(), 'Escape');
    eq('Esc 关菜单', [!!menu(), attr(more(), 'aria-expanded')], [false, 'false']);

    rt.click(more()); rt.click(item('改名'));
    const field = () => find(menu(), (n) => n.type === 'input')[0];
    eq('改名：输入框带着原来的称呼，有名字，限 12 个字', [attr(field(), 'value'), attr(field(), 'aria-label'), attr(field(), 'maxLength')], ['甲', '新的称呼', 12]);
    attr(field(), 'onChange')({ target: { value: '一二三四五六七八九十甲乙丙丁' } }); rt.flush();
    rt.key(field(), 'Enter', { isComposing: true });
    ok('输入法还在选字时按回车不保存', !!menu() && store.entryById(a.id).name === '甲');
    rt.key(field(), 'Enter');
    eq('回车保存：截到 12 个字，菜单关上，提示改好了', [store.entryById(a.id).name, !!menu(), store.getState().session.toast && store.getState().session.toast.text], ['一二三四五六七八九十甲乙', false, '已改名为「一二三四五六七八九十甲乙」']);
    eq('标签上的称呼跟着变', find(findByClass(tag(), 'zp-ptag-main')[0], (n) => n.type === 'b').map(text), ['一二三四五六七八九十甲乙']);

    rt.click(more()); rt.click(item('改生辰'));
    eq('改生辰：打开生辰表单，指向这张盘；菜单关上', [store.getState().session.sheet, store.getState().session.sheetChartId, !!menu()], ['birth', a.id, false]);
    env.P.closeLayers(); rt.flush();

    rt.click(more()); rt.click(item('删除'));
    eq('删除要再确认一次', [text(find(menu(), (n) => n.type === 'span')[0]), find(menu(), (n) => n.type === 'button').map(text), store.getState().library.length], ['删除这张盘？', ['删除', '取消'], 1]);
    rt.click(item('取消'));
    eq('取消：回到三个选项', find(menu(), (n) => n.type === 'button').map(text), ['改名', '改生辰', '删除']);
    rt.click(item('删除')); rt.click(item('删除'));
    const toast = store.getState().session.toast;
    eq('确认删除：命盘库里没了，提示可以撤销', [store.getState().library.length, toast && toast.action && toast.action.label], [0, '撤销']);
    eq('最后一张盘删掉之后，首页就是引导问答的第一问', [has(env.home(), 'data-onboarding'), env.tags().length, text(findByClass(env.home(), 'zp-status')[0])], [true, 0, '我是紫微师。先说说，怎么称呼你？']);
    toast.action.run(); rt.flush();
    eq('撤销：盘回来了，标签回来了，首页也回到平常的样子', [store.getState().library.length, env.tags().length, has(env.home(), 'data-onboarding'), !!env.byText('看今天')], [1, 1, false, true]);
    rt.unmount();
  }

  /* ================================================================ */
  section('v6 首页：没有 3D 时的退路');
  const flatChecks = async (label, prepare) => {
    const sky = fakeSky(prepare.sky || {});
    const env = fresh({ sky });
    const { store, rt, timers, pipe } = env;
    const a = store.addChart(GOLDEN, '甲');
    if (prepare.before) prepare.before(env, sky);
    env.mount(); timers.runAll(); rt.flush();
    if (prepare.after) { prepare.after(env, sky); rt.flush(); timers.runAll(); rt.flush(); }
    const home = env.home();
    const layer = findByClass(home, 'zp-planets')[0];
    const emblem = findByClass(home, 'zp-emblem')[0];
    ok(label + '：section 带 data-nogl，界面不收着，标签层平铺', has(home, 'data-nogl') && !has(home, 'data-busy') && classesOf(layer).includes('zp-flat'));
    eq(label + '：平铺的标签带自己的星色', env.tags().map((x) => attr(x, 'style')), [{ '--zp-c': 'var(--zp-s2)' }]);
    ok(label + '：静态星图是聚焦那张盘的徽记（SVG，有名字）', !!emblem && /^<svg[^>]+aria-label="甲的星图"/.test((attr(emblem, 'dangerouslySetInnerHTML') || {}).__html || ''));
    ok(label + '：没有操作提示', findByClass(home, 'zp-gesture').length === 0);
    store.renameChart(a.id, '<img src=x>');
    rt.flush();
    const hostile = (attr(findByClass(env.home(), 'zp-emblem')[0], 'dangerouslySetInnerHTML') || {}).__html || '';
    ok(label + '：称呼里的尖括号在徽记里是转义过的', hostile.includes('&lt;img src=x&gt;') && !hostile.includes('<img'));
    store.renameChart(a.id, '甲');
    rt.flush();
    rt.click(findByClass(env.tags()[0], 'zp-ptag-main')[0]);
    eq(label + '：点标签照样进入流日（不等动画）', [store.getState().session.view, store.getState().session.tab, sky.count('dive')], ['chart', 'daily', 0]);
    store.goHome(); rt.flush(); timers.runAll(); rt.flush();
    ok(label + '：回来之后界面是放开的', !has(env.home(), 'data-busy'));
    attr(find(env.home(), (n) => n.type === 'input')[0], 'onChange')({ target: { value: '问一句' } }); rt.flush();
    attr(findByClass(env.home(), 'zp-ask')[0], 'onSubmit')({ preventDefault() {} }); rt.flush();
    await env.settleAll();
    eq(label + '：提问照常', [store.getState().session.panelOpen, pipe.calls.length, store.getState().session.chartId], [true, 1, a.id]);
    rt.unmount();
    return sky;
  };
  {
    const sky = await flatChecks('设置里关掉 3D', { before: (e) => { e.store.setPref('sky', false); } });
    eq('设置里关掉 3D：根本不去要场景', sky.count('acquire'), 0);
  }
  {
    const sky = await flatChecks('场景说自己不可用', { sky: { ok: false } });
    eq('场景说自己不可用：要过一次', sky.count('acquire'), 1);
  }
  {
    const sky = await flatChecks('WebGL 上下文丢了', { after: (e, s) => { s.cb.onLost(); } });
    ok('WebGL 上下文丢了：把场景交回去', sky.count('release') >= 1);
  }
  {
    const sky = await flatChecks('用着的时候关掉 3D', { after: (e) => { e.store.setPref('sky', false); } });
    eq('用着的时候关掉 3D：场景交回去并且马上释放（时限 0）', [sky.count('release') >= 1, sky.log.filter((x) => x[0] === 'release')[0][1]], [true, 0]);
  }
  {
    /* 真的 bundle、没有 WebGL 的环境（vm 里就是）：不抛错，退到静态星图 */
    const env = fresh();
    const { store, rt, timers } = env;
    store.addChart(GOLDEN, '甲');
    let err = null;
    try { env.mount(); timers.runAll(); rt.flush(); } catch (e) { err = e; }
    ok('真的星图代码在没有 WebGL 的环境里：不抛错，退到静态星图', !err && has(env.home(), 'data-nogl') && rt.errors.length === 0, err ? String(err.stack || err).split('\n').slice(0, 2).join(' | ') : J(rt.errors.map(String)));
    rt.unmount();
  }

  /* ================================================================ */
  section('v6 首页：飞入动画没回调也不卡住');
  {
    const sky = fakeSky({ hold: ['dive'] });
    const env = fresh({ sky });
    const { store, rt, timers } = env;
    const a = store.addChart(GOLDEN, '甲');
    env.mount(); timers.runAll(); rt.flush();
    rt.click(findByClass(env.tags()[0], 'zp-ptag-main')[0]);
    eq('飞入途中：还在首页，界面收着', [store.getState().session.view, has(env.home(), 'data-busy')], ['home', true]);
    rt.click(findByClass(env.tags()[0], 'zp-ptag-main')[0]);
    sky.cb.onPick(a.id);
    eq('飞入途中再点：不重复', sky.count('dive'), 1);
    timers.runAll(); rt.flush();
    eq('场景一直没回调：到时间自己进去', [store.getState().session.view, store.getState().session.chartId], ['chart', a.id]);
    sky.cb.dive(); rt.flush();
    eq('迟到的回调不会再开一次', [store.getState().session.view, store.getState().session.tab], ['chart', 'daily']);
    rt.unmount();
  }
}
