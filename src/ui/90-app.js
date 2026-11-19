/* 90-app：ProApp（面板根组件）、Boundary（错误边界）、插件入口 __ziweiPlugin（factory 的返回值）。 */

function ProApp(props) {
  const actions = props.actions || {};
  /* 档位按面板实测宽度（不用视口媒体查询）；首帧 0 → 窄档 */
  const [panelW, setPanelW] = useState(0);
  const rootRef = useRef(null);
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

  return h('div', { className: 'zp-root', ref: rootRef, 'data-w': tierOf(panelW), 'data-view': 'home' },
    h('div', { className: 'zp-shell' },
      h('header', { className: 'zp-head', 'data-region': 'HEAD' },
        /* 显式出口：返回会话。顶栏第一个控件，由 ProApp 自己渲染；layout 服务不可用时不渲染 */
        actions.canReturnToConversation ? h('button', {
          className: 'zp-icon-btn zp-exit', type: 'button',
          title: t('backToConversation'), 'aria-label': t('backToConversation'),
          onClick: function () { actions.returnToConversation(); }
        }, h(Icon, { name: 'exit' })) : null),
      h('div', { className: 'zp-home' },
        h('div', { className: 'zp-sky', 'data-region': 'HOME_SKY' }),
        h('div', { className: 'zp-col', 'data-region': 'HOME_TALK' }))));
}

/* ---------------- 错误边界 ---------------- */
class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error: error };
  }
  render() {
    if (this.state.error) {
      const err = this.state.error;
      const self = this;
      return h('div', { className: 'zp-root zp-crash', role: 'alert' },
        h('p', { className: 'zp-crash-msg' }, t('crashMessage', { message: String((err && err.message) || err) })),
        h('p', { className: 'zp-crash-hint' }, t('crashHint')),
        h('button', { className: 'zp-btn', type: 'button', onClick: function () { self.setState({ error: null }); } }, t('retry')));
    }
    return this.props.children;
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
    /* 客户端导航：让 GUI 选中新会话（服务不可用时静默降级） */
    const openSession = function (sessionId) {
      if (!sessionId) return false;
      try {
        const svc = ctx.get && ctx.get('uiWorkspace');
        if (svc && typeof svc.openSession === 'function') { svc.openSession(sessionId); return true; }
      } catch (e) { /* 降级 */ }
      return false;
    };
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

    ctx.slots.inject('main', function () {
      return ctx.slots.register({
        name: 'main',
        key: 'ziwei'
      }, function () {
        return h(Boundary, null, h(ProApp, {
          actions: {
            openSession: openSession,
            autoOpenPanel: autoOpenPanel,
            returnToConversation: returnToConversation,
            canReturnToConversation: canReturnToConversation
          }
        }));
      });
    });
  }
};
