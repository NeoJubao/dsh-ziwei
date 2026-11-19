/* ================================================================
 * 90-app：ProApp（面板根组件）、顶栏、Boundary（错误边界）、插件入口 __ziweiPlugin（factory 的返回值）（T5a）
 *
 * ProApp 渲染的外壳（结构见 css/10-base.css 开头）：
 *   div.zp-root[data-w][data-view][data-stage][data-panel]        data-w 在 layout effect 里按面板实测宽度定
 *     div.zp-shell
 *       div.zp-main
 *         header.zp-head[data-region=HEAD]   第一个控件是「返回会话」（ProApp 自己渲染，不在任何错误边界里），
 *                                            后面是 HeadHome / HeadChart（各自包在错误边界里）
 *         HomeView        一直挂着（进了命盘也不卸载，CSS 把它藏起来），自己渲染 section.zp-home
 *         section.zp-chart（只在命盘页）     ProApp 的；进入命盘时由 layout effect 加一次性的 zp-enter（240ms 后移除；
 *                                            面板卸载再挂载回到同一张盘时不重放，记在 session.chartEntered）
 *           ChartPage     自己渲染 div.zp-body，看报告时（session.stage === 'report'）给它 hidden，不卸载
 *           ReportStage   自己渲染 div.zp-rbody，看盘面时给它 hidden，不卸载
 *       AssistantPanel   （只在命盘页）面板关着时它自己什么都不渲染
 *       SheetHost        session.sheet 有值时才渲染
 *       SettingsModal    session.modal === 'settings' 时才渲染
 *       Toast
 * 视图组件由后面的任务写：ProApp 用 typeof 判断它存在才渲染，所以那些任务不用改这个文件。
 * 每个视图都收到 props { tier: 'narrow' | 'mid' | 'wide' }（面板档位，不在 store 里），各包一层错误边界：
 * 一个视图出错只把它自己换成错误提示，「返回会话」和其余视图照常。
 *
 * ProApp 只订阅 view / stage / panelOpen / chartId / sheet / modal；顶栏的命盘部分（HeadChart）另外订阅
 * 盘名、命宫主星、tab、报告任务是否在跑、showAdj。选宫、流式增量都不会让这两个组件重渲染。
 *
 * Esc 从里往外关一层：「更多」菜单（它自己在 document 捕获阶段处理）→ 浮层 / 弹层（Overlay 自己处理；焦点不在
 * 浮层里时由根节点关）→ 中、窄档浮着的紫微师 → 什么都不做。
 * ================================================================ */

const ENTER_MS = 240;
const AUTO_OPEN_MS = 250;

function shellOf(s) {
  const ss = s.session;
  return {
    view: ss.view, stage: ss.stage, panel: !!ss.panelOpen, chartId: ss.chartId,
    sheet: ss.sheet || null, modal: ss.modal || null
  };
}

function chartHeadOf(s, store) {
  const ss = s.session;
  const entry = store.currentEntry();
  const chart = entry ? store.chartOf(entry) : null;
  const key = entry ? store.keyOf(entry) : '';
  const job = key ? s.jobs[key] : null;
  return {
    id: entry ? entry.id : null,
    name: entry ? String(entry.name || '') : '',
    star: chart ? (soulStars(chart).names[0] || '') : '',
    tab: ss.tab,
    stage: ss.stage,
    panel: !!ss.panelOpen,
    writing: !!job && job.kind === 'report',
    showAdj: !!s.prefs.showAdj
  };
}

/* 复制命盘文字：引擎的 chartText，成功、失败都给提示 */
function copyChartText() {
  const store = appStore();
  const chart = store.currentChart();
  if (!chart) return;
  let text = '';
  try { text = E.chartText(chart); } catch (e) { text = ''; }
  copyText(text).then(function (ok) {
    if (ok) store.showToast(t('headCopiedChart'));
    else store.showToast(t('copyFailed'), { error: true });
  });
}

/* ---------------- 顶栏：首页 ---------------- */
function HeadHome() {
  return [
    h('div', { key: 'grow', className: 'zp-grow' }),
    h('button', {
      key: 'charts', className: 'zp-icon-btn', type: 'button', title: t('headAllCharts'), 'aria-label': t('headAllCharts'),
      onClick: function () { openSheet('charts'); }
    }, h(Icon, { name: 'list' })),
    h('button', {
      key: 'settings', className: 'zp-icon-btn', type: 'button', title: t('headSettings'), 'aria-label': t('headSettings'),
      onClick: function () { openModal('settings'); }
    }, h(Icon, { name: 'gear' }))
  ];
}

/* ---------------- 顶栏：命盘页 ---------------- */
function HeadChart() {
  const m = useStore(chartHeadOf);
  const store = appStore();
  const color = starColorVar(m.star);
  const tabs = SCOPE_TABS.map(function (tab) { return { id: tab, label: scopeTabName(tab) }; });
  tabs.push({
    id: 'report', label: t('headTabReport'), sep: true,
    after: m.writing ? h('i', { className: 'zp-pulse', 'aria-hidden': true }) : null
  });
  return [
    h('nav', { key: 'crumb', className: 'zp-crumb', 'aria-label': t('headCrumb') },
      h('button', { className: 'zp-crumb-home', type: 'button', onClick: function () { store.goHome(); } }, t('headHome')),
      h('span', { 'aria-hidden': true }, '/'),
      h('i', { className: 'zp-orb', 'aria-hidden': true, style: color ? { '--zp-c': color } : undefined }),
      h('span', { className: 'zp-crumb-name' }, m.name || t('headUnnamed'))),
    h('div', { key: 'grow', className: 'zp-grow' }),
    h(Seg, {
      key: 'tabs', label: t('headTabs'), items: tabs, value: m.stage === 'report' ? 'report' : m.tab,
      onChange: function (id) { store.setTab(id); }
    }),
    h('button', {
      key: 'ask', className: 'zp-btn-primary', type: 'button', hidden: m.panel,
      onClick: function () { store.setPanel(true); }
    }, t('headAsk')),
    h(Menu, {
      key: 'more', label: t('headMore'), icon: 'more',
      items: [
        { id: 'copy', label: t('headCopyChart'), onSelect: copyChartText },
        { id: 'adj', label: t('headShowAdj'), pressed: m.showAdj, onSelect: function () { store.setPref('showAdj', !m.showAdj); } },
        { id: 'birth', label: t('headEditBirth'), onSelect: function () { openSheet('birth', m.id); } }
      ]
    }),
    h('button', {
      key: 'settings', className: 'zp-icon-btn', type: 'button', title: t('headSettings'), 'aria-label': t('headSettings'),
      onClick: function () { openModal('settings'); }
    }, h(Icon, { name: 'gear' }))
  ];
}

/* ---------------- 面板根 ---------------- */
function ProApp(props) {
  const actions = props.actions || {};
  const app = useStore(shellOf);
  /* 档位按面板实测宽度（不用视口媒体查询）；首帧 0 → 窄档。在 layout effect 里量，宽面板不会先画一帧窄档 */
  const [panelW, setPanelW] = useState(0);
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const tier = tierOf(panelW);
  useLayoutEffect(function () {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver !== 'function') return undefined;
    const measure = function () {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setPanelW(w);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return function () { ro.disconnect(); };
  }, []);

  /* 进入命盘的一次性入场：同一张盘在面板卸载再挂载时不重放；回首页再进来才重放 */
  useLayoutEffect(function () {
    const store = appStore();
    const entered = store.getState().session.chartEntered || null;
    if (app.view !== 'chart') {
      if (entered) store.patchSession({ chartEntered: null });
      return undefined;
    }
    const el = chartRef.current;
    if (!el || !el.classList || entered === app.chartId) return undefined;
    store.patchSession({ chartEntered: app.chartId });
    el.classList.remove('zp-enter');
    void el.offsetWidth;
    el.classList.add('zp-enter');
    const cancel = uiLater(function () { el.classList.remove('zp-enter'); }, ENTER_MS);
    return function () { cancel(); el.classList.remove('zp-enter'); };
  }, [app.view, app.chartId]);

  /* 同一时间一个模态层：中、窄档里浮层打开时，浮着的紫微师先关上 */
  useLayoutEffect(function () {
    if ((app.sheet || app.modal) && app.panel && tier !== 'wide') appStore().setPanel(false);
  }, [app.sheet, app.modal, app.panel, tier]);

  /* Esc：菜单和浮层自己先处理并停止传播；到这里时关掉还开着的浮层，再不然关中、窄档浮着的紫微师 */
  const onKeyDown = function (ev) {
    if (ev.key !== 'Escape' || ev.defaultPrevented || isComposingKey(ev)) return;
    const store = appStore();
    const s = store.getState().session;
    if (s.sheet || s.modal) { closeLayers(); ev.stopPropagation(); return; }
    if (s.view === 'chart' && s.panelOpen && tier !== 'wide') { store.setPanel(false); ev.stopPropagation(); }
  };

  const viewProps = { tier: tier };
  const inChart = app.view === 'chart';
  return h('div', {
    className: 'zp-root', ref: rootRef, onKeyDown: onKeyDown,
    'data-w': tier, 'data-view': app.view, 'data-stage': app.stage, 'data-panel': app.panel ? 'open' : 'closed'
  },
  h('div', { className: 'zp-shell' },
    h('div', { className: 'zp-main' },
      h('header', { className: 'zp-head', 'data-region': 'HEAD' },
        /* 显式出口：返回会话。顶栏第一个控件，由 ProApp 自己渲染、不在错误边界里；layout 服务不可用时不渲染 */
        actions.canReturnToConversation ? h('button', {
          className: 'zp-icon-btn zp-exit', type: 'button',
          title: t('backToConversation'), 'aria-label': t('backToConversation'),
          onClick: function () { actions.returnToConversation(); }
        }, h(Icon, { name: 'exit' })) : null,
        h(Boundary, { key: inChart ? 'head-chart' : 'head-home' }, inChart ? h(HeadChart) : h(HeadHome))),
      typeof HomeView === 'function' ? h(Boundary, { key: 'home' }, h(HomeView, viewProps)) : null,
      inChart ? h('section', { key: 'chart', className: 'zp-chart', ref: chartRef },
        typeof ChartPage === 'function' ? h(Boundary, { key: 'board' }, h(ChartPage, viewProps)) : null,
        typeof ReportStage === 'function' ? h(Boundary, { key: 'report' }, h(ReportStage, viewProps)) : null) : null),
    inChart && typeof AssistantPanel === 'function' ? h(Boundary, { key: 'assistant' }, h(AssistantPanel, viewProps)) : null,
    app.sheet && typeof SheetHost === 'function' ? h(Boundary, { key: 'sheet' }, h(SheetHost, viewProps)) : null,
    app.modal === 'settings' && typeof SettingsModal === 'function' ? h(Boundary, { key: 'modal' }, h(SettingsModal, viewProps)) : null,
    h(Boundary, { key: 'toast' }, h(Toast))));
}

/* ---------------- 错误边界 ----------------
 * props.root：面板最外层那个（出错时自己就是 .zp-root，并带上「返回会话」，用户不会被困住）；
 * 其余的包在单个视图外面，出错时只替换那个视图。 */
class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error: error };
  }
  render() {
    if (!this.state.error) return this.props.children === undefined ? null : this.props.children;
    const err = this.state.error;
    const self = this;
    const actions = this.props.actions || null;
    return h('div', { className: this.props.root ? 'zp-root zp-crash' : 'zp-crash', role: 'alert' },
      actions && actions.canReturnToConversation ? h('button', {
        className: 'zp-icon-btn zp-exit', type: 'button',
        title: t('backToConversation'), 'aria-label': t('backToConversation'),
        onClick: function () { actions.returnToConversation(); }
      }, h(Icon, { name: 'exit' })) : null,
      h('p', { className: 'zp-crash-msg' }, t('crashMessage', { message: String((err && err.message) || err) })),
      h('p', { className: 'zp-crash-hint' }, t('crashHint')),
      h('button', { className: 'zp-btn', type: 'button', onClick: function () { self.setState({ error: null }); } }, t('retry')));
  }
}

/* 侧栏入口图标（在面板之外的宿主侧栏里渲染，面板的 --zp-* 用不到；和 v5 同一个图形） */
function PanelIcon() {
  return h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': true },
    h('circle', { cx: 12, cy: 12, r: 10.2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, opacity: 0.55 }),
    h('circle', { cx: 12, cy: 12, r: 4.6, fill: '#8b5cf6' }),
    h('path', { d: 'M12 6.6 L13.6 10.4 L17.4 12 L13.6 13.6 L12 17.4 L10.4 13.6 L6.6 12 L10.4 10.4 Z', fill: '#fff' }),
    h('circle', { cx: 17.8, cy: 6.2, r: 1.1, fill: 'currentColor', opacity: 0.8 }));
}

/* ---------------- 挂载 ---------------- */
const __ziweiPlugin = {
  inject: ['slots', 'sessions', 'uiWorkspace'],
  apply: function (ctx) {
    /* 普通 client bundle 没有 `styles` 内建，用 <style> 注入。和 v5 一样在 apply() 里同步插入
       （真实宿主里验证过的做法；不依赖 ctx.effect 何时调用回调），清理函数交给 ctx.effect，插件卸载时移除。
       这是 apply() 里唯一碰 DOM 的地方。 */
    const styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);
    const disposeStyle = function () { if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl); };
    ctx.effect(function () { return disposeStyle; }, 'ziwei-workbench: styles');

    let layout = null;
    try { layout = ctx.get && ctx.get('layout'); } catch (e) { layout = null; }
    /* 客户端导航：让 GUI 选中新会话（服务不可用时静默降级）。交给 store，「在新会话里继续」成功后调用 */
    const openSession = function (sessionId) {
      if (!sessionId) return false;
      try {
        const svc = ctx.get && ctx.get('uiWorkspace');
        if (svc && typeof svc.openSession === 'function') { svc.openSession(sessionId); return true; }
      } catch (e) { /* 降级 */ }
      return false;
    };
    /* store 第一次被面板用到时才建（建的时候读本机记录、清旧版 API Key 残留、做一次性导入）；已经建了就换上这次的 openSession */
    zwStoreDeps.openSession = openSession;
    if (ZWSTORE.hasDefaultStore()) getStore().configure({ openSession: openSession });

    const autoOpenPanel = function () {
      try {
        if (layout && typeof layout.selectPanel === 'function') layout.selectPanel('ziwei');
      } catch (e) { /* ignore */ }
    };
    /* 面板显式出口：返回会话。官方语义见 @deepseek-ai/dsh-client-ui-layout README：
       selectPanel(null) 选中 Conversation 且不切换当前 Session。layout 服务缺失时不渲染按钮。 */
    const canReturnToConversation = !!(layout && typeof layout.selectPanel === 'function');
    const returnToConversation = function () {
      if (!canReturnToConversation) return false;
      try { layout.selectPanel(null); return true; } catch (e) { /* 降级：保持当前面板 */ }
      return false;
    };

    /* 生命周期：页面关闭前把写了一半的报告按"中断、可接着写"落盘；插件卸载时静默中止全部任务、彻底释放 3D 场景 */
    ctx.effect(function () {
      const onPageHide = function () {
        if (ZWSTORE.hasDefaultStore()) { try { getStore().flush(); } catch (e) { /* ignore */ } }
      };
      let target = null;
      try {
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('pagehide', onPageHide);
          target = window;
        }
      } catch (e) { target = null; }
      return function () {
        try { if (target && typeof target.removeEventListener === 'function') target.removeEventListener('pagehide', onPageHide); } catch (e) { /* ignore */ }
        if (ZWSTORE.hasDefaultStore()) { try { getStore().abortAll(); } catch (e) { /* ignore */ } }
        try {
          if (typeof __ziweiBootstrapSky === 'function' && __ziweiBootstrapSky.api) __ziweiBootstrapSky.api.destroy();
        } catch (e) { /* ignore */ }
      };
    }, 'ziwei-workbench: jobs and 3D scene');

    /* 启动时自动打开面板（设置里的偏好，默认关）：插件装上后稍等一下再切到紫微面板 */
    ctx.effect(function () {
      let on = false;
      try { on = ZWSTORE.hasDefaultStore() ? !!getStore().getState().prefs.autoOpen : localStore.prefs.autoOpen(); } catch (e) { on = false; }
      const cancel = on ? uiLater(autoOpenPanel, AUTO_OPEN_MS) : null;
      return function () { if (cancel) cancel(); };
    }, 'ziwei-workbench: auto-open panel');

    /* 语言：按官方规范走 Client locale 服务。register 登记双语字典，bind 返回随当前语言切换的 t()；
       服务缺失（旧宿主 / 非 Web 组合）时 t() 查内置中文。 */
    let bound = null;
    try {
      const locale = ctx.get && ctx.get('locale');
      if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
        const disposeLocale = locale.register('ziwei', { zh: DICT['zh-CN'], en: DICT['en-US'] });
        if (typeof disposeLocale === 'function') {
          ctx.effect(function () { return disposeLocale; }, 'ziwei-workbench: locale dictionaries');
        }
        bound = locale.bind('ziwei');
      }
    } catch (e) { /* 回退内置字典 */ }
    setTranslator(bound);

    exposeTestApis();

    /* 侧栏入口（id 即主面板 key） */
    ctx.slots.inject('sidebar.panellist', function () {
      return ctx.slots.register({
        name: 'sidebar.panellist',
        id: 'ziwei',
        order: 20,
        label: function () { return t('sidebarLabel'); }
      }, PanelIcon);
    });

    const actions = {
      returnToConversation: returnToConversation,
      canReturnToConversation: canReturnToConversation
    };
    ctx.slots.inject('main', function () {
      return ctx.slots.register({
        name: 'main',
        key: 'ziwei'
      }, function () {
        return h(Boundary, { root: true, actions: actions }, h(ProApp, { actions: actions }));
      });
    });
  }
};
