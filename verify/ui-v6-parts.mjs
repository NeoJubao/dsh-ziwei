/**
 * verify/ui-v6-parts.mjs — 通用部件（50-parts.js）和外壳在"真的会重渲染"的运行时里的行为（T5a）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。client-harness 的假 React 不跑 effect、setState 是空操作，
 * 测不出订阅和焦点；这里用 client-harness 的极简 React 运行时（makeRuntime / bootRuntime，说明在那边）。
 * 渲染次数按组件函数名计（ProApp、HeadChart …），用来断言"选宫、流式增量时顶栏不重渲染"。
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）。"今天"固定为 2026-11-19。
 */
import { bootRuntime, classesOf, find, findByClass, settle, text } from './client-harness.mjs';

const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '',
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
const GOLDEN_F = Object.assign({}, GOLDEN, { gender: 'female' });
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const J = (v) => JSON.stringify(v);

const boot = (client, o = {}) => bootRuntime(client, Object.assign({ now: NOW }, o));

const attr = (el, k) => (el && el.props ? el.props[k] : undefined);
const byLabel = (tree, label) => find(tree, (n) => n.type === 'button' && (attr(n, 'aria-label') === label || text(n) === label))[0] || null;

export default async function partsChecks(t) {
  const { ok, section } = t;
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);
  const safe = (name, fn) => { try { return fn(); } catch (e) { ok(name, false, 'threw: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')); return undefined; } };

  section('v6 部件：装载（极简 React 运行时）');
  const env = t.client ? boot(t.client) : { error: new Error('没有 v6 bundle') };
  ok('v6 bundle 在运行时里装载、apply()、建默认 store', !env.error, env.error && env.error.message);
  if (env.error) return;
  const { rt, store, P, h, timers, pipe } = env;
  const PARTS = ['useStore', 'appStore', 'Icon', 'Seg', 'Menu', 'Overlay', 'Sheet', 'Modal', 'Toast', 'ConfirmButton',
    'useDialogFocus', 'trapTab', 'focusablesIn', 'usePopoverDismiss', 'copyText', 'starColorVar', 'openSheet', 'openModal', 'closeLayers'];
  const missing = PARTS.filter((k) => typeof P[k] !== 'function');
  ok('ZWUi.parts 暴露全部部件（测试和后面的视图任务用）', missing.length === 0, 'missing: ' + missing.join(', '));
  if (missing.length) return;
  ok('appStore() 就是 getStore() 的默认实例', P.appStore() === store);

  /* 订阅计数：包一层 store.subscribe */
  let active = 0;
  const realSubscribe = store.subscribe;
  store.subscribe = (fn) => {
    active++;
    const off = realSubscribe(fn);
    let done = false;
    return () => { if (!done) { done = true; active--; } off(); };
  };

  const entry = store.addChart(GOLDEN, '甲');
  const other = store.addChart(GOLDEN_F, '乙');
  const keyA = store.keyOf(entry);
  store.openChart(entry.id);

  /* ---------------------------------------------------------------- */
  section('v6 部件：useStore');
  const seen = [];
  function Probe(props) {
    const v = P.useStore(props.sel);
    seen.push(v);
    return h('span', { className: 'zp-probe' }, typeof v === 'object' ? J(v) : String(v));
  }
  const probeText = () => text(rt.tree());

  safe('useStore 首次渲染', () => {
    seen.length = 0;
    rt.mount(h(Probe, { sel: (s) => s.session.tab }), { passive: false });
    eq('第一次渲染就是当前值（passive effect 还没跑、还没订阅）', [probeText(), seen.length, active], ['natal', 1, 0]);
    store.setTab('yearly');
    eq('渲染之后、订阅之前 store 变了：这时还没重渲染', [probeText(), seen.length], ['natal', 1]);
    rt.releasePassive();
    eq('订阅时补读一次：跟上了这次变化（重渲染一次）', [probeText(), seen.length, active], ['yearly', 2, 1]);
    store.selectPalace(3);
    store.selectPalace(4);
    store.setPane('pats');
    rt.flush();
    eq('选中的值没变（选宫、换窄档页签）：不重渲染', seen.length, 2);
    store.setTab('monthly');
    rt.flush();
    eq('选中的值变了：重渲染一次，拿到新值', [probeText(), seen.length], ['monthly', 3]);
    rt.unmount();
    eq('卸载后退订', active, 0);
    store.setTab('daily');
    rt.flush();
    eq('卸载之后 store 再变：不渲染、不报错', seen.length, 3);
  });

  safe('useStore 返回对象', () => {
    seen.length = 0;
    rt.mount(h(Probe, { sel: (s) => ({ tab: s.session.tab, stage: s.session.stage }) }));
    store.selectPalace(7);
    store.selectPalace(8);
    rt.flush();
    eq('选择器每次返回新对象：浅比较相等就不重渲染', seen.length, 1);
    store.setStage('report');
    rt.flush();
    eq('对象里有一项变了：重渲染', [seen.length, JSON.parse(probeText()).stage], [2, 'report']);
    store.setStage('board');
    rt.unmount();
  });

  safe('useStore 反复挂载卸载', () => {
    let worst = 0;
    let firstOk = true;
    const tabs = ['natal', 'decadal', 'yearly', 'monthly', 'daily'];
    for (let i = 0; i < 30; i++) {
      store.setTab(tabs[i % 5]);
      seen.length = 0;
      rt.mount(h(Probe, { sel: (s) => s.session.tab }));
      if (seen[0] !== tabs[i % 5]) firstOk = false;
      worst = Math.max(worst, active);
      rt.unmount();
    }
    ok('挂载卸载 30 次：每次第一次渲染都是当前值', firstOk);
    eq('挂载卸载 30 次：同时最多一个订阅，最后一个不剩', [worst, active], [1, 0]);
  });

  await (async () => {
    store.setTab('natal');
    seen.length = 0;
    const busySeen = [];
    function Busy() {
      const v = P.useStore((s) => !!s.jobs[keyA]);
      busySeen.push(v);
      return h('i', null, String(v));
    }
    rt.mount(h('div', null, h(Probe, { sel: (s) => s.session.view }), h(Busy)));
    const before = [seen.length, busySeen.length];
    const asked = store.ask('今年怎么样');
    rt.flush();
    const p = pipe.calls[pipe.calls.length - 1];
    await settle();
    rt.flush();
    const afterStart = [seen.length, busySeen.length];
    for (let i = 0; i < 120; i++) p.send('delta', { text: '字' });
    await settle(6);
    rt.flush();
    const afterDeltas = [seen.length, busySeen.length];
    p.send('done', { text: '字'.repeat(120) }).end();
    await settle(6);
    rt.flush();
    ok('高频流式增量：发出了提问', asked === true && !!p);
    eq('任务开始：只选了"有没有任务"的组件重渲染一次，选 view 的不动', [afterStart[0] - before[0], afterStart[1] - before[1]], [0, 1]);
    eq('120 次增量：两个订阅者都一次也不重渲染', [afterDeltas[0] - afterStart[0], afterDeltas[1] - afterStart[1]], [0, 0]);
    eq('任务结束：选"有没有任务"的组件重渲染一次', [seen.length - afterDeltas[0], busySeen.length - afterDeltas[1], busySeen[busySeen.length - 1]], [0, 1, false]);
    rt.unmount();
  })();

  /* ---------------------------------------------------------------- */
  section('v6 外壳：真实挂载下的重渲染边界');
  await (async () => {
    store.openChart(entry.id);
    rt.width = 1300;
    rt.mount(h(env.Main));
    const tree0 = rt.tree();
    const root = findByClass(tree0, 'zp-root')[0];
    eq('layout effect 里量宽：1300px 的面板首次提交后就是 data-w="wide"', attr(root, 'data-w'), 'wide');
    const c0 = { app: rt.count('ProApp'), head: rt.count('HeadChart'), toast: rt.count('Toast') };
    store.selectPalace(2);
    store.selectPalace(9);
    rt.flush();
    eq('选宫两次：ProApp、HeadChart、Toast 都不重渲染', [rt.count('ProApp') - c0.app, rt.count('HeadChart') - c0.head, rt.count('Toast') - c0.toast], [0, 0, 0]);
    store.ask('事业');
    await settle();
    rt.flush();
    const p = pipe.calls[pipe.calls.length - 1];
    const c1 = { app: rt.count('ProApp'), head: rt.count('HeadChart') };
    for (let i = 0; i < 60; i++) p.send('delta', { text: '写' });
    await settle(6);
    rt.flush();
    eq('对话流式 60 次增量：ProApp、HeadChart 都不重渲染', [rt.count('ProApp') - c1.app, rt.count('HeadChart') - c1.head], [0, 0]);
    p.send('done', { text: '写'.repeat(60) }).end();
    await settle(6);
    rt.flush();
    const c2 = { app: rt.count('ProApp'), head: rt.count('HeadChart') };
    store.startReport();
    await settle();
    rt.flush();
    const rp = pipe.calls[pipe.calls.length - 1];
    const reportTab = () => find(rt.tree(), (n) => attr(n, 'role') === 'tab' && text(n).startsWith('报告'))[0];
    eq('报告开始写：顶栏重渲染一次（页签上出现脉冲点），ProApp 不重渲染',
      [rt.count('ProApp') - c2.app, rt.count('HeadChart') - c2.head, findByClass(reportTab(), 'zp-pulse').length], [0, 1, 1]);
    const c3 = rt.count('HeadChart');
    for (let i = 0; i < 40; i++) rp.send('delta', { text: '文' });
    await settle(6);
    rt.flush();
    eq('报告流式 40 次增量：顶栏不重渲染', rt.count('HeadChart') - c3, 0);
    rp.send('done', { text: '文'.repeat(40) }).end();
    await settle(6);
    rt.flush();
    eq('报告写完：脉冲点消失', findByClass(reportTab(), 'zp-pulse').length, 0);
    rt.unmount();
  })();

  safe('进入命盘的一次性入场类', () => {
    timers.pending.clear();
    store.goHome();
    rt.mount(h(env.Main));
    store.openChart(entry.id);
    rt.flush();
    const section0 = findByClass(rt.tree(), 'zp-chart')[0];
    const node = section0 && section0.node;
    ok('进入命盘：section.zp-chart 由 layout effect 加上 zp-enter', !!node && node.classList.contains('zp-enter'));
    ok('入场类 240ms 后移除', timers.delays().includes(240));
    timers.runAll();
    ok('定时器跑完：zp-enter 不在了', !!node && !node.classList.contains('zp-enter'));
    rt.unmount();
    rt.mount(h(env.Main));
    const node2 = findByClass(rt.tree(), 'zp-chart')[0].node;
    ok('面板卸载再挂载（同一张盘）：不重放入场', !node2.classList.contains('zp-enter'));
    store.goHome();
    rt.flush();
    store.openChart(other.id);
    rt.flush();
    const node3 = findByClass(rt.tree(), 'zp-chart')[0].node;
    ok('回首页再进一张盘：重新播入场', node3.classList.contains('zp-enter'));
    timers.runAll();
    rt.unmount();
  });

  safe('Esc 的层级', () => {
    store.openChart(entry.id);
    store.setPanel(false);
    rt.width = 900;
    rt.mount(h(env.Main));
    eq('900px 是中档', attr(findByClass(rt.tree(), 'zp-root')[0], 'data-w'), 'mid');
    store.setPanel(true);
    rt.flush();
    const trigger = () => byLabel(rt.tree(), '更多');
    const menu = () => findByClass(rt.tree(), 'zp-menu')[0];
    rt.click(trigger());
    eq('点「更多」：菜单打开', [attr(menu(), 'hidden'), attr(trigger(), 'aria-expanded')], [false, 'true']);
    const r1 = rt.key(trigger(), 'Escape');
    eq('Esc 第一下：只关菜单（事件不再往外传），焦点回到「更多」，紫微师还开着',
      [attr(menu(), 'hidden'), r1.stopped, rt.doc.activeElement === trigger().node, store.getState().session.panelOpen], [true, true, true, true]);
    rt.key(trigger(), 'Escape');
    eq('Esc 第二下：中档浮着的紫微师关上', store.getState().session.panelOpen, false);
    P.openSheet('charts');
    rt.flush();
    rt.key(trigger(), 'Escape');
    eq('浮层（sheet）开着时 Esc：关浮层', [store.getState().session.sheet, store.getState().session.modal], [null, null]);
    P.openModal('settings');
    rt.flush();
    rt.key(trigger(), 'Escape');
    eq('设置开着时 Esc：关设置', store.getState().session.modal, null);
    rt.unmount();
    rt.width = 1300;
    rt.mount(h(env.Main));
    store.setPanel(true);
    rt.flush();
    rt.key(trigger(), 'Escape');
    eq('宽档并排的紫微师不是浮层：Esc 不关它', store.getState().session.panelOpen, true);
    store.setPanel(false);
    rt.unmount();
  });

  safe('同一时间一个模态层', () => {
    rt.width = 900;
    rt.mount(h(env.Main));
    store.setPanel(true);
    rt.flush();
    P.openSheet('birth', entry.id);
    rt.flush();
    eq('中档：打开浮层时浮着的紫微师先关上', [store.getState().session.sheet, store.getState().session.panelOpen], ['birth', false]);
    P.openModal('settings');
    eq('打开设置时生辰浮层关上（sheet 和 modal 互斥）', [store.getState().session.sheet, store.getState().session.sheetChartId, store.getState().session.modal], [null, null, 'settings']);
    P.closeLayers();
    rt.unmount();
    rt.width = 1300;
    rt.mount(h(env.Main));
    store.setPanel(true);
    rt.flush();
    P.openModal('settings');
    rt.flush();
    eq('宽档：并排的紫微师不算模态层，打开设置时不关', store.getState().session.panelOpen, true);
    P.closeLayers();
    store.setPanel(false);
    rt.unmount();
  });

  safe('视图出错时面板其余部分照常', () => {
    store.openChart(entry.id);
    rt.mount(h(env.Main));
    const realChartOf = store.chartOf;
    store.chartOf = () => { throw new Error('测试：顶栏取盘失败'); };
    store.setTab('daily');
    rt.flush();
    const tree = rt.tree();
    const head = find(tree, (n) => attr(n, 'data-region') === 'HEAD')[0];
    ok('顶栏的命盘部分渲染出错：错误边界接住，面板其余部分照常',
      !!head && findByClass(head, 'zp-crash').length === 1 && findByClass(tree, 'zp-shell').length === 1 && text(findByClass(head, 'zp-crash')[0]).includes('测试：顶栏取盘失败'));
    ok('视图里的错误提示只有「重试」，不带「返回会话」（那是最外层错误页的事）',
      find(head, (n) => n.type === 'button').map(text).join('|') === '重试' && findByClass(tree, 'zp-exit').length === 0);
    store.chartOf = realChartOf;
    const retry = find(head, (n) => n.type === 'button' && text(n) === '重试')[0];
    rt.click(retry);
    ok('点「重试」恢复顶栏', find(rt.tree(), (n) => attr(n, 'role') === 'tablist').length === 1 && findByClass(rt.tree(), 'zp-crash').length === 0);
    rt.unmount();
  });

  /* ---------------------------------------------------------------- */
  section('v6 部件：分段页签（Seg）');
  safe('Seg', () => {
    const changes = [];
    function SegHost() {
      const [v, setV] = rt.React.useState('b');
      return h(P.Seg, {
        label: '看什么', value: v, onChange: (id) => { changes.push(id); setV(id); },
        items: [{ id: 'a', label: '甲' }, { id: 'b', label: '乙' }, { id: 'c', label: '丙', sep: true, after: h('i', { className: 'zp-pulse', 'aria-hidden': true }) }]
      });
    }
    rt.mount(h(SegHost));
    const list = () => find(rt.tree(), (n) => attr(n, 'role') === 'tablist')[0];
    const tabs = () => find(list(), (n) => attr(n, 'role') === 'tab');
    eq('div.zp-seg[role=tablist]，有名字', [list().type, classesOf(list()).includes('zp-seg'), attr(list(), 'aria-label')], ['div', true, '看什么']);
    eq('三个 button[role=tab]，aria-selected 和 roving tabIndex 跟着值',
      tabs().map((n) => [n.type, attr(n, 'type'), text(n), attr(n, 'aria-selected'), attr(n, 'tabIndex')]),
      [['button', 'button', '甲', 'false', -1], ['button', 'button', '乙', 'true', 0], ['button', 'button', '丙', 'false', -1]]);
    const kids = list().children.flat(Infinity).filter((c) => c && typeof c === 'object');
    eq('sep: true 在这一项前面放 i.zp-seg-sep（aria-hidden），after 放在文字后面',
      [kids.map((k) => k.type), classesOf(kids[2]), attr(kids[2], 'aria-hidden'), findByClass(tabs()[2], 'zp-pulse').length], [['button', 'button', 'i', 'button'], ['zp-seg-sep'], true, 1]);
    rt.click(tabs()[0]);
    eq('点一个页签：onChange(id)', changes, ['a']);
    rt.click(tabs()[0]);
    eq('点已选中的页签：不再调 onChange', changes, ['a']);
    rt.fire(tabs()[0], 'keydown', { key: 'ArrowRight' });
    eq('→：选下一个，焦点跟过去', [changes, rt.doc.activeElement === tabs()[1].node], [['a', 'b'], true]);
    rt.fire(tabs()[1], 'keydown', { key: 'End' });
    rt.fire(tabs()[2], 'keydown', { key: 'ArrowRight' });
    rt.fire(tabs()[0], 'keydown', { key: 'ArrowLeft' });
    eq('End、→ 到头绕回、← 绕回', changes, ['a', 'b', 'c', 'a', 'c']);
    rt.unmount();
  });

  /* ---------------------------------------------------------------- */
  section('v6 部件：菜单（Menu）');
  safe('Menu', () => {
    const picked = [];
    function MenuHost(props) {
      return h('div', { className: 'zp-mhost' },
        h('button', { type: 'button', className: 'zp-outside' }, '外面'),
        h(P.Menu, {
          label: '更多', icon: 'more', items: [
            { id: 'copy', label: '复制', onSelect: () => picked.push('copy') },
            { id: 'adj', label: '显示杂曜', pressed: props.on, onSelect: () => picked.push('adj') },
            { id: 'del', label: '删除', danger: true, onSelect: () => picked.push('del') }
          ]
        }));
    }
    rt.mount(h(MenuHost, { on: true }));
    const trig = () => byLabel(rt.tree(), '更多');
    const pop = () => findByClass(rt.tree(), 'zp-menu')[0];
    const items = () => find(pop(), (n) => n.type === 'button');
    const wrap = findByClass(rt.tree(), 'zp-menu-wrap')[0];
    eq('结构：div.zp-menu-wrap > button.zp-icon-btn（aria-label / title / aria-expanded）+ div.zp-menu',
      [!!wrap, classesOf(trig()).includes('zp-icon-btn'), attr(trig(), 'title'), attr(trig(), 'aria-expanded'), attr(pop(), 'hidden')], [true, true, '更多', 'false', true]);
    eq('菜单项是 button；开关项带 aria-pressed；危险项带 zp-danger',
      items().map((n) => [text(n), attr(n, 'type'), attr(n, 'aria-pressed'), classesOf(n).includes('zp-danger')]),
      [['复制', 'button', undefined, false], ['显示杂曜', 'button', 'true', false], ['删除', 'button', undefined, true]]);
    rt.click(trig());
    eq('点按钮：打开', [attr(pop(), 'hidden'), attr(trig(), 'aria-expanded')], [false, 'true']);
    rt.fire(trig(), 'pointerdown');
    eq('在菜单里面按下：不关', attr(pop(), 'hidden'), false);
    rt.fire(byLabel(rt.tree(), '外面'), 'pointerdown');
    eq('在外面按下：关上', attr(pop(), 'hidden'), true);
    rt.click(trig());
    const r = rt.key(trig(), 'Escape');
    eq('Esc：关上、焦点回到按钮、事件不再往外传', [attr(pop(), 'hidden'), rt.doc.activeElement === trig().node, r.stopped], [true, true, true]);
    eq('关上之后不留 document 监听', [rt.doc.listenerCount('pointerdown'), rt.doc.listenerCount('keydown')], [0, 0]);
    rt.click(trig(), { detail: 0 });
    eq('用键盘打开（click 的 detail 为 0）：焦点到第一项', rt.doc.activeElement === items()[0].node, true);
    rt.key(items()[0], 'ArrowDown');
    eq('↓：下一项', rt.doc.activeElement === items()[1].node, true);
    rt.key(items()[1], 'ArrowUp');
    rt.key(items()[0], 'ArrowUp');
    eq('↑ 到头绕到最后一项', rt.doc.activeElement === items()[2].node, true);
    rt.click(items()[1]);
    eq('点菜单项：执行、关上、焦点回到按钮', [picked, attr(pop(), 'hidden'), rt.doc.activeElement === trig().node], [['adj'], true, true]);
    rt.click(trig());
    rt.fire(trig(), 'focusout', { relatedTarget: byLabel(rt.tree(), '外面').node });
    eq('焦点 Tab 出菜单：关上', attr(pop(), 'hidden'), true);
    rt.unmount();
    rt.mount(h(MenuHost, { on: false }));
    eq('开关项的 aria-pressed 跟着 props', attr(find(findByClass(rt.tree(), 'zp-menu')[0], (n) => text(n) === '显示杂曜')[0], 'aria-pressed'), 'false');
    rt.unmount();
  });

  /* ---------------------------------------------------------------- */
  section('v6 部件：浮层（Sheet / Modal）');
  safe('Sheet', () => {
    const closes = [];
    function SheetHostT(props) {
      const [open, setOpen] = rt.React.useState(false);
      const close = () => { closes.push(1); setOpen(false); };
      return h('div', { className: 'zp-thost' },
        h('button', { type: 'button', className: 'zp-opener', onClick: () => setOpen(true) }, '打开'),
        open ? h(props.part, { title: '全部命盘', onClose: close, footer: h('button', { type: 'button', className: 'zp-btn' }, '确定') },
          h('button', { type: 'button', className: 'zp-btn' }, '第一个'),
          h('input', { className: 'zp-input', 'aria-label': '称呼' })) : null);
    }
    for (const [name, part, wrapCls, boxCls, region, tag] of [['Sheet', P.Sheet, null, 'zp-sheet', 'SHEET', 'aside'], ['Modal', P.Modal, 'zp-overlay-center', 'zp-modal', 'MODAL', 'div']]) {
      closes.length = 0;
      rt.mount(h(SheetHostT, { part }));
      const opener = () => find(rt.tree(), (n) => text(n) === '打开' && n.type === 'button')[0];
      opener().node.focus();
      rt.click(opener());
      const tree = rt.tree();
      const overlay = findByClass(tree, 'zp-overlay')[0];
      const box = find(tree, (n) => attr(n, 'role') === 'dialog')[0];
      eq(`${name}：.zp-overlay${wrapCls ? '.' + wrapCls : ''} > .zp-mask + ${tag}.${boxCls}[role=dialog]`,
        [!!overlay && (!wrapCls || classesOf(overlay).includes(wrapCls)), overlay && overlay.children.flat(Infinity).filter(Boolean).map((c) => classesOf(c)[0]), box && box.type],
        [true, ['zp-mask', boxCls], tag]);
      eq(`${name}：aria-modal、aria-label、data-region、data-dsh-automatic-focus、tabIndex -1`,
        [attr(box, 'aria-modal'), attr(box, 'aria-label'), attr(box, 'data-region'), attr(box, 'data-dsh-automatic-focus'), attr(box, 'tabIndex')],
        ['true', '全部命盘', region, '', -1]);
      const headEl = findByClass(box, 'zp-dialog-h')[0];
      eq(`${name}：标题区 h2 + 关闭按钮（zp-icon-btn，aria-label 关闭），正文 .zp-dialog-b，底部 .zp-dialog-f`,
        [text(find(headEl, (n) => n.type === 'h2')[0]), !!byLabel(headEl, '关闭') && classesOf(byLabel(headEl, '关闭')).includes('zp-icon-btn'),
          findByClass(box, 'zp-dialog-b').length, text(findByClass(box, 'zp-dialog-f')[0])],
        ['全部命盘', true, 1, '确定']);
      ok(`${name}：打开后焦点在弹层容器上`, rt.doc.activeElement === box.node);
      const focusables = box.node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const first = focusables[0], last = focusables[focusables.length - 1];
      let r = rt.key(box, 'Tab', { shiftKey: true });
      ok(`${name}：在容器上 Shift+Tab → 最后一个控件（不漏出去）`, r.prevented && rt.doc.activeElement === last);
      r = rt.fire(last, 'keydown', { key: 'Tab' });
      ok(`${name}：最后一个控件上 Tab → 第一个`, r.prevented && rt.doc.activeElement === first);
      r = rt.fire(first, 'keydown', { key: 'Tab', shiftKey: true });
      ok(`${name}：第一个控件上 Shift+Tab → 最后一个`, r.prevented && rt.doc.activeElement === last);
      r = rt.fire(first, 'keydown', { key: 'Escape' });
      ok(`${name}：Esc 关闭、事件不再往外传、焦点回到打开它的按钮`,
        closes.length === 1 && r.stopped && find(rt.tree(), (n) => attr(n, 'role') === 'dialog').length === 0 && rt.doc.activeElement === opener().node);
      rt.click(opener());
      rt.click(findByClass(rt.tree(), 'zp-mask')[0]);
      ok(`${name}：点遮罩关闭`, closes.length === 2 && find(rt.tree(), (n) => attr(n, 'role') === 'dialog').length === 0);
      rt.click(opener());
      rt.click(byLabel(rt.tree(), '关闭'));
      ok(`${name}：点关闭按钮关闭，焦点回到打开它的按钮`, closes.length === 3 && rt.doc.activeElement === opener().node);
      rt.unmount();
    }
  });

  safe('useDialogFocus(active)', () => {
    function Floating(props) {
      const ref = P.useDialogFocus(props.on);
      return h('div', { className: 'zp-fhost' },
        h('button', { type: 'button', className: 'zp-opener' }, '问紫微师'),
        h('aside', { className: 'zp-fbox', ref, tabIndex: -1, hidden: !props.on }, h('button', { type: 'button' }, '发送')));
    }
    const opener = () => find(rt.tree(), (n) => text(n) === '问紫微师')[0];
    let on = null;
    function Toggle() {
      const [v, setV] = rt.React.useState(false);
      on = setV;
      return h(Floating, { on: v });
    }
    rt.mount(h(Toggle));
    opener().node.focus();
    on(true);
    rt.flush();
    ok('useDialogFocus(true)：焦点进容器', rt.doc.activeElement === findByClass(rt.tree(), 'zp-fbox')[0].node);
    on(false);
    rt.flush();
    ok('useDialogFocus(false)：焦点回到打开前的控件', rt.doc.activeElement === opener().node);
    rt.unmount();
  });

  safe('trapTab / focusablesIn', () => {
    function Box() {
      return h('div', { className: 'zp-box', tabIndex: -1 },
        h('button', { type: 'button' }, '一'),
        h('button', { type: 'button', disabled: true }, '禁用'),
        h('div', { hidden: true }, h('button', { type: 'button' }, '藏起来')),
        h('a', { href: '#x' }, '链接'),
        h('span', { tabIndex: -1 }, '不进 Tab'),
        h('textarea', { 'aria-label': '问题' }));
    }
    rt.mount(h(Box));
    const box = findByClass(rt.tree(), 'zp-box')[0].node;
    eq('focusablesIn：跳过禁用的、隐藏的、tabIndex=-1 的', P.focusablesIn(box).map((n) => n.tagName), ['BUTTON', 'A', 'TEXTAREA']);
    eq('focusablesIn(null) 是空数组', P.focusablesIn(null), []);
    rt.unmount();
  });

  /* ---------------------------------------------------------------- */
  section('v6 部件：提示条（Toast）和确认按钮（ConfirmButton）');
  safe('Toast', () => {
    const undone = [];
    store.dismissToast();
    rt.mount(h(P.Toast));
    eq('没有提示时什么都不渲染', findByClass(rt.tree(), 'zp-toast').length, 0);
    store.showToast('已删除命盘', { undo: () => undone.push(1) });
    rt.flush();
    const el = findByClass(rt.tree(), 'zp-toast')[0];
    eq('div.zp-toast[role=status][aria-live=polite][data-region=TOAST] > span 文字 + button 动作',
      [attr(el, 'role'), attr(el, 'aria-live'), attr(el, 'data-region'), text(find(el, (n) => n.type === 'span')[0]), text(find(el, (n) => n.type === 'button')[0])],
      ['status', 'polite', 'TOAST', '已删除命盘', '撤销']);
    rt.click(find(el, (n) => n.type === 'button')[0]);
    eq('点动作：执行，提示还是这一条就收起', [undone.length, store.getState().session.toast], [1, null]);
    store.showToast('已删除命盘', { undo: () => store.showToast('已撤销') });
    rt.flush();
    rt.click(find(findByClass(rt.tree(), 'zp-toast')[0], (n) => n.type === 'button')[0]);
    eq('动作换了一条新提示：不把新的收掉', store.getState().session.toast && store.getState().session.toast.text, '已撤销');
    store.showToast('复制失败', { error: true });
    rt.flush();
    ok('出错的提示带 zp-error、没有动作就没有按钮',
      classesOf(findByClass(rt.tree(), 'zp-toast')[0]).includes('zp-error') && find(findByClass(rt.tree(), 'zp-toast')[0], (n) => n.type === 'button').length === 0);
    store.dismissToast();
    rt.flush();
    eq('提示收起后不渲染', findByClass(rt.tree(), 'zp-toast').length, 0);
    rt.unmount();
  });

  safe('ConfirmButton', () => {
    const runs = [];
    timers.pending.clear();
    rt.mount(h(P.ConfirmButton, { className: 'zp-link', label: '重新写', confirmLabel: '再点一次，替换旧报告', onConfirm: () => runs.push(1) }));
    const btn = () => find(rt.tree(), (n) => n.type === 'button')[0];
    eq('button[type=button]，带传入的类和文字', [attr(btn(), 'type'), classesOf(btn()), text(btn())], ['button', ['zp-link'], '重新写']);
    rt.click(btn());
    eq('第一次点：不执行，换成确认文字、加 zp-armed、排一个 4 秒的定时器',
      [runs.length, text(btn()), classesOf(btn()).includes('zp-armed'), timers.delays()], [0, '再点一次，替换旧报告', true, [4000]]);
    rt.click(btn());
    eq('4 秒内第二次点：执行一次，恢复原样', [runs.length, text(btn()), classesOf(btn()).includes('zp-armed'), timers.pending.size], [1, '重新写', false, 0]);
    rt.click(btn());
    timers.runAll();
    rt.flush();
    eq('过了 4 秒：解除，不执行', [runs.length, text(btn())], [1, '重新写']);
    rt.click(btn());
    rt.unmount();
    eq('上膛时卸载：定时器清掉', timers.pending.size, 0);
    rt.mount(h(P.ConfirmButton, { label: '清除', confirmLabel: '确定清除', needConfirm: false, onConfirm: () => runs.push(2) }));
    rt.click(btn());
    eq('needConfirm: false：点一次就执行', runs, [1, 2]);
    rt.unmount();
    rt.mount(h(P.ConfirmButton, { label: '重新写', confirmLabel: '再点一次', disabled: true, onConfirm: () => runs.push(3) }));
    eq('disabled 透传', attr(btn(), 'disabled'), true);
    rt.unmount();
  });

  /* ---------------------------------------------------------------- */
  section('v6 部件：小工具');
  await (async () => {
    const win = env.win;
    let wrote = null;
    win.navigator = { clipboard: { writeText: (s) => { wrote = s; return Promise.resolve(); } } };
    const a = await P.copyText('命盘文字');
    win.navigator = { clipboard: { writeText: () => Promise.reject(new Error('denied')) } };
    const b = await P.copyText('命盘文字');
    win.navigator = {};
    const c = await P.copyText('命盘文字');
    delete win.navigator;
    const d = await P.copyText('命盘文字');
    eq('copyText：写进剪贴板 → true；被拒、没有剪贴板、没有 navigator → false', [a, wrote, b, c, d], [true, '命盘文字', false, false, false]);
  })();
  eq('starColorVar：十四主星按 tokens.md 的顺序给 var(--zp-sN)，其他星是空串',
    ['紫微', '太阳', '贪狼', '破军', '文昌', ''].map((n) => P.starColorVar(n)),
    ['var(--zp-s0)', 'var(--zp-s2)', 'var(--zp-s8)', 'var(--zp-s13)', '', '']);
  const icons = new Set(env.win.ZWUi.iconNames || []);
  const wantIcons = ['back', 'exit', 'close', 'more', 'list', 'gear', 'chevronLeft', 'chevronRight', 'send', 'stop', 'newChat', 'handoff', 'copy', 'download', 'refresh', 'check'];
  eq('图标表有各视图要用的图标', wantIcons.filter((n) => !icons.has(n)), []);
}
