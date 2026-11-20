/* ================================================================
 * 50-parts：通用部件（T5a）。后面的视图任务只读这段注释就该会用；样式在 css/10-base.css、css/50-parts.css。
 * 测试和 T9 的全面检查从 window.ZWUi.parts 拿到这里的每个部件（apply() 之后才有）。
 *
 * ---------------- store ----------------
 * appStore() → store
 *   默认 store（26-store 的 getStore）。apply() 不建它：第一次有组件用到时才建，带上 apply() 给的 openSession。
 *   组件里拿 store 调动作就用它（渲染里调用是纯的，只返回同一个实例）。
 * useStore(selector) → selector(state, store) 的值
 *   - 第一次渲染就返回当前值（不等 effect；自检的假 React 不跑 effect）。
 *   - effect 里订阅，订阅后立刻补读一次：渲染之后、订阅之前 store 变了也不会漏。卸载时退订。
 *   - store 每次变化都会同步调一遍 selector；选出来的值没变就不重渲染。比较：Object.is；selector 返回
 *     对象或数组时比一层（每一项 Object.is）。所以 selector 只能返回原始值、state 里原有的对象，或者一层
 *     由它们组成的新对象 / 数组——不要在 selector 里造嵌套的新对象（那样每次都"变了"）。
 *   - 选窄一点：流式增量每秒改很多次 readings（jobs 只在任务开始、结束、thinkChars 变时换），
 *     不看正文的组件别选 readings。selector 每次变化都会跑，里面不要做重活。
 * openSheet(kind, chartId?)   打开面板内浮层：patchSession({ sheet: kind, sheetChartId, modal: null })。
 *                             kind：'birth'（直接填表 / 改生辰，chartId = 要改的盘）| 'charts'（全部命盘）
 * openModal(name)             打开弹层：patchSession({ modal: name, sheet: null, sheetChartId: null })。name：'settings'
 * closeLayers()               关掉浮层和弹层（sheet、sheetChartId、modal 全部置空）
 *   同一时间只有一个模态层：sheet 和 modal 互斥；中、窄档里浮着的紫微师在浮层打开时由 ProApp 关上。
 *
 * ---------------- 部件 ----------------
 * Icon { name, size = 16 }
 *   svg.zp-icon（aria-hidden，线色随文字）。name 是 ICON_PATHS 的键（ZWUi.iconNames 列出全部）：
 *   exit back close more list gear settings caret chevronLeft chevronRight send stop sparkle newChat handoff
 *   copy download export report quote refresh check。新图标先加进表里再用。
 *
 * Seg { items, value, onChange(id), label, className?, region?, radio? }
 *   分段页签：div.zp-seg[role=tablist][aria-label=label]（className 追加在 zp-seg 后面，region → data-region）。
 *   radio: true 时是单选组（设置里的三选一）：div[role=radiogroup] > button[role=radio][aria-checked]，其余一样。
 *   items：[{ id, label, sep?, after?, disabled? }]。每项一个 button[role=tab][type=button]，
 *   aria-selected="true|false"，roving tabIndex（选中的 0，其余 -1；没有选中项时第一项 0）；
 *   sep: true 时在这一项前放 i.zp-seg-sep；after 是放在文字后面的元素（例如顶栏报告页签的 i.zp-pulse）。
 *   点未选中的项调 onChange(id)；←/→ 选上一个 / 下一个（绕回），Home / End 到头，焦点跟着走。key 是 'tab-' + id。
 *
 * Menu { label, icon = 'more', items, className? }
 *   div.zp-menu-wrap > button.zp-icon-btn（aria-label / title = label，aria-expanded）+ div.zp-menu[role=group]。
 *   菜单一直在树里，收着时带 hidden（打开时 CSS 的 zp-pop 动画重新播一次）。
 *   items：[{ id, label, onSelect(), pressed?, danger?, disabled? }]：每项一个 button[type=button]；
 *   pressed 是布尔值时带 aria-pressed（开关项，CSS 在右边画一个点）；danger 加 zp-danger。
 *   打开：点按钮；用键盘打开（click 的 detail 为 0）时焦点到第一项，↑/↓ 在项之间走（绕回）。
 *   关上：点一项（先关、焦点回到按钮，再调 onSelect——所以 onSelect 打开的浮层会把焦点还给这个按钮）、
 *   在菜单外按下指针、焦点 Tab 出菜单、Esc（document 捕获阶段处理并停止传播：Esc 先关菜单，不会同时关掉别的层；
 *   焦点回到按钮）。内部用 usePopoverDismiss。
 *
 * Sheet { title, onClose, children, footer?, headExtra?, className? }
 *   div.zp-overlay > div.zp-mask（点了 onClose）+ aside.zp-sheet[role=dialog][aria-modal=true][aria-label=title]
 *   [data-region=SHEET][data-dsh-automatic-focus][tabIndex=-1]
 *     > header.zp-dialog-h（h2 标题、headExtra、关闭按钮 button.zp-icon-btn aria-label 关闭）
 *     + div.zp-dialog-b（children）+ div.zp-dialog-f（footer，有才渲染）
 * Modal { 同上 }
 *   div.zp-overlay.zp-overlay-center > div.zp-mask + div.zp-modal[role=dialog]…[data-region=MODAL]，里面同上。
 * Overlay { kind: 'sheet' | 'modal', 同上 }   Sheet / Modal 的共同实现。
 *   焦点：挂上时（layout effect）记下当时的焦点（打开它的控件），把焦点放到弹层容器上（不画焦点框）；
 *   Tab / Shift+Tab 在弹层里循环（trapTab）；Esc 调 onClose 并停止传播；卸载时焦点回到记下的控件
 *   （它还在文档里、而且焦点没被用户挪到弹层外面时）。不要在弹层里用 autoFocus 或 useLayoutEffect 抢焦点：
 *   要聚焦某个输入框，在自己的 useEffect 里 focus()（那时打开它的控件已经记下了）。
 *   弹层是否出现由 store 决定（ProApp 在 session.sheet / session.modal 有值时才渲染 SheetHost / SettingsModal），
 *   onClose 一般就是 closeLayers。
 *
 * Toast {}
 *   读 session.toast：div.zp-toast[role=status][aria-live=polite][data-region=TOAST]（出错加 zp-error）
 *   > span 文字 + button（有 action 时，文字是 action.label）。点动作：先 action.run()，提示还是这一条才
 *   dismissToast()（动作常常换上一条新提示，例如"已撤销"）。自动消失由 store 计时（有订阅者时才开始）。
 *   ProApp 已经渲染了一个，视图里不要再放。
 *
 * ConfirmButton { label, confirmLabel, onConfirm(), className = 'zp-btn', needConfirm = true, disabled?, icon?, title? }
 *   会丢内容的按钮：第一次点只"上膛"（文字换成 confirmLabel，加 zp-armed），4 秒内再点才执行；4 秒没点就复原
 *   （定时器在 effect 里，卸载时清掉）。needConfirm: false 时点一次就执行。按钮带 aria-live=polite，换字会读出来。
 *
 * ---------------- 焦点和小工具 ----------------
 * useDialogFocus(active = true) → ref    挂到弹层容器上（容器要 tabIndex: -1）。active 变真：记下当前焦点、
 *   焦点进容器；变假或卸载：焦点回去。中、窄档浮着的紫微师面板用它（再配 trapTab、Esc）。
 * trapTab(ev, root)       keydown 里调：Tab / Shift+Tab 到头时绕回，焦点在容器本身上时也不漏出去
 * focusablesIn(root)      root 里能 Tab 到的控件（跳过禁用、隐藏、tabIndex=-1）
 * usePopoverDismiss(open, ref, close)   打开期间：在 ref 之外按下指针 → close(false)；Esc → close(true) 并停止传播
 * copyText(text) → Promise<boolean>     写剪贴板；没有剪贴板或被拒时是 false（调用方给提示，文字见 copyFailed）
 * starColorVar(name) → 'var(--zp-sN)' | ''   十四主星的颜色变量（顺序见 tokens.md）；内联成 style: { '--zp-c': … }
 * uiLater(fn, ms) → cancel()             window.setTimeout 的薄包装（没有定时器的环境里什么也不做）；在 effect 里用、在清理里 cancel
 *
 * 可以复用的字典键（i18n/00-common.json）：dialogClose「关闭」、copyFailed「复制失败，请手动选择文本」。
 * ================================================================ */

/* ---------------- store ---------------- */
/* apply() 填 openSession；默认 store 第一次被用到时才建（getStore 只认第一次的 deps，之后 apply() 用 configure 换） */
const zwStoreDeps = { openSession: null };

function appStore() {
  return getStore(zwStoreDeps);
}

/* 选出来的值是否"一样"：Object.is；两边都是对象 / 数组时比一层 */
function sameSelection(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !Object.is(a[ka[i]], b[ka[i]])) return false;
  }
  return true;
}

function bumpTick(n) {
  return n + 1;
}

function useStore(selector) {
  const store = appStore();
  const state = store.getState();
  const value = selector(state, store);
  const [, setTick] = useState(0);
  const box = useRef(null);
  if (box.current === null) box.current = { selector: selector, value: value };
  /* 每次提交后记下这次渲染用的 selector 和值；渲染到提交之间 store 换了快照（并发渲染才会有），补查一次 */
  useLayoutEffect(function () {
    const b = box.current;
    b.selector = selector;
    b.value = value;
    if (store.getState() === state) return;
    let changed = true;
    try { changed = !sameSelection(value, selector(store.getState(), store)); } catch (e) { changed = true; }
    if (changed) setTick(bumpTick);
  });
  useEffect(function () {
    const b = box.current;
    let live = true;
    const check = function () {
      if (!live) return;
      let next, changed;
      try {
        next = b.selector(store.getState(), store);
        changed = !sameSelection(b.value, next);
      } catch (e) {
        changed = true;    /* 让重渲染把错误抛给错误边界 */
      }
      if (!changed) return;
      b.value = next;
      setTick(bumpTick);
    };
    const off = store.subscribe(check);
    check();             /* 渲染之后、订阅之前的变化 */
    return function () { live = false; off(); };
  }, [store]);
  return value;
}

function openSheet(kind, chartId) {
  return appStore().patchSession({ sheet: kind || null, sheetChartId: chartId == null ? null : chartId, modal: null });
}

function openModal(name) {
  return appStore().patchSession({ modal: name || null, sheet: null, sheetChartId: null });
}

function closeLayers() {
  return appStore().patchSession({ sheet: null, sheetChartId: null, modal: null });
}

/* ---------------- 小工具 ---------------- */
function uiLater(fn, ms) {
  let id = null;
  try {
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') id = window.setTimeout(fn, ms);
  } catch (e) { id = null; }
  return function () {
    if (id === null) return;
    try { window.clearTimeout(id); } catch (e) { /* ignore */ }
    id = null;
  };
}

function copyText(text) {
  return new Promise(function (resolve) {
    try {
      const nav = typeof window !== 'undefined' ? window.navigator : null;
      if (text && nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
        Promise.resolve(nav.clipboard.writeText(String(text))).then(function () { resolve(true); }, function () { resolve(false); });
        return;
      }
    } catch (e) { /* 落到下面 */ }
    resolve(false);
  });
}

function starColorVar(name) {
  const i = name ? ZWREPORT.STARS14.indexOf(name) : -1;
  return i < 0 ? '' : 'var(--zp-s' + i + ')';
}

function isComposingKey(ev) {
  return !!(ev && ((ev.nativeEvent && ev.nativeEvent.isComposing) || ev.isComposing || ev.keyCode === 229));
}

/* ---------------- 焦点 ---------------- */
const FOCUSABLE_SEL = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function focusablesIn(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const nodes = root.querySelectorAll(FOCUSABLE_SEL);
  const out = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n.disabled && n.offsetParent !== null) out.push(n);
  }
  return out;
}

function trapTab(ev, root) {
  if (!ev || ev.key !== 'Tab' || !root) return;
  const list = focusablesIn(root);
  const doc = root.ownerDocument;
  const active = doc ? doc.activeElement : null;
  if (!list.length) { ev.preventDefault(); return; }
  const first = list[0], last = list[list.length - 1];
  if (ev.shiftKey && (active === first || active === root)) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && (active === last || active === root)) { ev.preventDefault(); first.focus(); }
}

function focusQuietly(el) {
  try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
}

function restoreFocus(doc, prev, box) {
  try {
    if (!doc || !prev || prev === doc.body || typeof prev.focus !== 'function' || prev.isConnected === false) return;
    const cur = doc.activeElement;
    /* 用户已经把焦点挪到弹层外面的别处：不抢回来 */
    if (cur && cur !== doc.body && cur.isConnected !== false && !(box && box.contains(cur))) return;
    focusQuietly(prev);
    if (doc.activeElement !== prev) {
      /* 打开它的控件这一刻还是隐藏的（例如面板关上时才重新出现的「问紫微师」）：等它显示出来再试一次 */
      uiLater(function () {
        const now = doc.activeElement;
        if (prev.isConnected !== false && (!now || now === doc.body)) focusQuietly(prev);
      }, 0);
    }
  } catch (e) { /* ignore */ }
}

function useDialogFocus(active) {
  const ref = useRef(null);
  const on = active !== false;
  useLayoutEffect(function () {
    if (!on) return undefined;
    const box = ref.current;
    const doc = box && box.ownerDocument;
    if (!doc) return undefined;
    const prev = doc.activeElement;
    if (!box.contains(prev)) focusQuietly(box);
    return function () { restoreFocus(doc, prev, box); };
  }, [on]);
  return ref;
}

function usePopoverDismiss(open, ref, close) {
  const latest = useRef(close);
  latest.current = close;
  useEffect(function () {
    if (!open) return undefined;
    const node = ref.current;
    const doc = node && node.ownerDocument;
    if (!doc || typeof doc.addEventListener !== 'function') return undefined;
    const onDown = function (ev) {
      if (!node.contains(ev.target)) latest.current(false);
    };
    const onKey = function (ev) {
      if (ev.key !== 'Escape' || ev.isComposing) return;
      ev.stopPropagation();
      latest.current(true);
    };
    doc.addEventListener('pointerdown', onDown, true);
    doc.addEventListener('keydown', onKey, true);
    return function () {
      doc.removeEventListener('pointerdown', onDown, true);
      doc.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
}

/* ---------------- 内联图标：16 × 16 网格、1.5px 线、随文字色（不用 emoji，跨平台一致）。新图标先加进这张表再用。 ---------------- */
/* gear / settings 画的是两条滑杆：v5 的圆加八条短线像"亮度"，容易被看成切换深浅色 */
const ICON_PATHS = {
  exit: [
    ['path', { d: 'M6.7 4L2.7 8l4 4' }],
    ['path', { d: 'M2.7 8h7.3a3.3 3.3 0 0 1 0 6.7H8.7' }]
  ],
  back: [
    ['path', { d: 'M13.4 8H3.2' }],
    ['path', { d: 'M7 4.2L3.2 8l3.8 3.8' }]
  ],
  caret: [
    ['path', { d: 'M6.2 3.6L10.6 8l-4.4 4.4' }]
  ],
  chevronLeft: [
    ['path', { d: 'M9.8 3.6L5.4 8l4.4 4.4' }]
  ],
  chevronRight: [
    ['path', { d: 'M6.2 3.6L10.6 8l-4.4 4.4' }]
  ],
  more: [
    ['circle', { cx: 3.4, cy: 8, r: 1.1, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 8, cy: 8, r: 1.1, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 12.6, cy: 8, r: 1.1, fill: 'currentColor', stroke: 'none' }]
  ],
  list: [
    ['path', { d: 'M5.8 4.3h7.4M5.8 8h7.4M5.8 11.7h7.4' }],
    ['circle', { cx: 2.9, cy: 4.3, r: 0.9, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 2.9, cy: 8, r: 0.9, fill: 'currentColor', stroke: 'none' }],
    ['circle', { cx: 2.9, cy: 11.7, r: 0.9, fill: 'currentColor', stroke: 'none' }]
  ],
  gear: [
    ['path', { d: 'M2.4 4.9h5M11.2 4.9h2.4M2.4 11.1h2.4M8.6 11.1h5' }],
    ['circle', { cx: 9.3, cy: 4.9, r: 1.9 }],
    ['circle', { cx: 6.7, cy: 11.1, r: 1.9 }]
  ],
  settings: [
    ['path', { d: 'M2.4 4.9h5M11.2 4.9h2.4M2.4 11.1h2.4M8.6 11.1h5' }],
    ['circle', { cx: 9.3, cy: 4.9, r: 1.9 }],
    ['circle', { cx: 6.7, cy: 11.1, r: 1.9 }]
  ],
  copy: [
    ['rect', { x: 5.6, y: 5.6, width: 7.6, height: 7.6, rx: 1.6 }],
    ['path', { d: 'M10.6 5.6V4.3c0-.9-.7-1.6-1.6-1.6H4.3c-.9 0-1.6.7-1.6 1.6v4.7c0 .9.7 1.6 1.6 1.6h1.3' }]
  ],
  close: [
    ['path', { d: 'M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6' }]
  ],
  send: [
    ['path', { d: 'M2.6 8.1L13.2 3l-5.1 10.5L7 9.3z' }]
  ],
  stop: [
    ['rect', { x: 4.8, y: 4.8, width: 6.4, height: 6.4, rx: 1.6, fill: 'currentColor', stroke: 'none' }]
  ],
  sparkle: [
    ['path', { d: 'M8 1.9l1.5 4.2 4.2 1.5-4.2 1.5L8 13.3 6.5 9.1 2.3 7.6l4.2-1.5z' }]
  ],
  download: [
    ['path', { d: 'M8 2.1v7M5.3 6.4L8 9.1l2.7-2.7' }],
    ['path', { d: 'M3.1 10.4v1.7c0 .9.7 1.6 1.6 1.6h6.6c.9 0 1.6-.7 1.6-1.6v-1.7' }]
  ],
  export: [
    ['path', { d: 'M8 2.1v7M5.3 6.4L8 9.1l2.7-2.7' }],
    ['path', { d: 'M3.1 10.4v1.7c0 .9.7 1.6 1.6 1.6h6.6c.9 0 1.6-.7 1.6-1.6v-1.7' }]
  ],
  report: [
    ['rect', { x: 3.2, y: 2.2, width: 9.6, height: 11.6, rx: 1.6 }],
    ['path', { d: 'M5.6 5.4h4.8M5.6 8h4.8M5.6 10.6h3' }]
  ],
  check: [
    ['path', { d: 'M3.4 8.3l3.1 3.1 6.1-6.7' }]
  ],
  newChat: [
    ['path', { d: 'M8 2.9v10.2M2.9 8h10.2' }]
  ],
  handoff: [
    ['path', { d: 'M2.6 8h7.1M7 5l3.1 3L7 11' }],
    ['path', { d: 'M12.4 3.2v9.6' }]
  ],
  quote: [
    ['path', { d: 'M3 3.4h10M3 6.2h10M3 9h6.4' }],
    ['path', { d: 'M3 12.6h4.4' }]
  ],
  refresh: [
    ['path', { d: 'M13 7.6A5 5 0 1 1 11.4 4' }],
    ['path', { d: 'M13.2 2.6v3.2H10' }]
  ]
};

function Icon(props) {
  const paths = ICON_PATHS[props.name] || [];
  return h('svg', {
    className: 'zp-icon', viewBox: '0 0 16 16', width: props.size || 16, height: props.size || 16,
    'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
    strokeLinecap: 'round', strokeLinejoin: 'round'
  }, paths.map(function (p, i) {
    return h(p[0], Object.assign({ key: i }, p[1]));
  }));
}

/* ---------------- 分段页签 ---------------- */
function Seg(props) {
  const items = props.items || [];
  const value = props.value;
  /* radio: true 时是单选组（选一个值，不是切换视图）：radiogroup > radio[aria-checked]；键盘和样式一样 */
  const role = props.radio ? 'radio' : 'tab';
  const stateAttr = props.radio ? 'aria-checked' : 'aria-selected';
  const hasValue = items.some(function (it) { return it.id === value; });
  const onKeyDown = function (ev) {
    const k = ev.key;
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
    const live = [];
    items.forEach(function (it, i) { if (!it.disabled) live.push(i); });
    if (!live.length) return;
    let at = -1;
    live.forEach(function (i, j) { if (items[i].id === value) at = j; });
    let j;
    if (k === 'Home') j = 0;
    else if (k === 'End') j = live.length - 1;
    else if (k === 'ArrowRight') j = (at + 1) % live.length;
    else j = at < 0 ? live.length - 1 : (at - 1 + live.length) % live.length;
    ev.preventDefault();
    const idx = live[j];
    if (items[idx].id !== value) props.onChange(items[idx].id);
    const root = ev.currentTarget;
    const tabs = root && typeof root.querySelectorAll === 'function' ? root.querySelectorAll('[role="' + role + '"]') : [];
    if (tabs[idx]) focusQuietly(tabs[idx]);
  };
  const kids = [];
  items.forEach(function (it, i) {
    const on = it.id === value;
    if (it.sep) kids.push(h('i', { key: 'sep-' + it.id, className: 'zp-seg-sep', 'aria-hidden': true }));
    const p = {
      key: 'tab-' + it.id, type: 'button', role: role,
      tabIndex: on || (!hasValue && i === 0) ? 0 : -1,
      disabled: it.disabled ? true : undefined,
      onClick: function () { if (!on) props.onChange(it.id); }
    };
    p[stateAttr] = on ? 'true' : 'false';
    kids.push(h('button', p, it.label, it.after || null));
  });
  return h('div', {
    className: 'zp-seg' + (props.className ? ' ' + props.className : ''),
    role: props.radio ? 'radiogroup' : 'tablist', 'aria-label': props.label, 'data-region': props.region || undefined, onKeyDown: onKeyDown
  }, kids);
}

/* ---------------- 菜单 ---------------- */
function Menu(props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const byKey = useRef(false);
  const items = props.items || [];
  const close = function (refocus) {
    setOpen(false);
    if (refocus && btnRef.current) focusQuietly(btnRef.current);
  };
  usePopoverDismiss(open, wrapRef, close);
  useEffect(function () {
    if (!open || !byKey.current) return;
    byKey.current = false;
    const list = focusablesIn(wrapRef.current && wrapRef.current.querySelector ? wrapRef.current.querySelector('.zp-menu') : null);
    if (list.length) focusQuietly(list[0]);
  }, [open]);
  const onMenuKey = function (ev) {
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    const list = focusablesIn(ev.currentTarget);
    if (!list.length) return;
    ev.preventDefault();
    const doc = ev.currentTarget.ownerDocument;
    const at = list.indexOf(doc ? doc.activeElement : null);
    const next = ev.key === 'ArrowDown' ? (at + 1) % list.length : (at <= 0 ? list.length - 1 : at - 1);
    focusQuietly(list[next]);
  };
  const onBlur = function (ev) {
    const to = ev.relatedTarget;
    if (open && to && wrapRef.current && !wrapRef.current.contains(to)) setOpen(false);
  };
  return h('div', { className: 'zp-menu-wrap', ref: wrapRef, onBlur: onBlur },
    h('button', {
      className: 'zp-icon-btn' + (props.className ? ' ' + props.className : ''), type: 'button', ref: btnRef,
      title: props.label, 'aria-label': props.label, 'aria-expanded': open ? 'true' : 'false',
      onClick: function (ev) {
        const next = !open;
        byKey.current = next && !!ev && ev.detail === 0;
        setOpen(next);
      }
    }, h(Icon, { name: props.icon || 'more' })),
    h('div', { className: 'zp-menu', role: 'group', 'aria-label': props.label, hidden: !open, onKeyDown: onMenuKey },
      items.map(function (it) {
        return h('button', {
          key: it.id, type: 'button', className: it.danger ? 'zp-danger' : undefined,
          'aria-pressed': typeof it.pressed === 'boolean' ? (it.pressed ? 'true' : 'false') : undefined,
          disabled: it.disabled ? true : undefined,
          onClick: function () {
            close(true);
            if (typeof it.onSelect === 'function') it.onSelect();
          }
        }, it.label);
      })));
}

/* ---------------- 浮层 ---------------- */
function dialogKeyDown(onClose) {
  return function (ev) {
    if (ev.key === 'Escape') {
      if (isComposingKey(ev)) return;
      ev.stopPropagation();
      if (typeof onClose === 'function') onClose();
      return;
    }
    trapTab(ev, ev.currentTarget);
  };
}

function dialogInner(props) {
  return [
    h('header', { key: 'h', className: 'zp-dialog-h' },
      h('h2', null, props.title),
      props.headExtra || null,
      h('button', {
        className: 'zp-icon-btn', type: 'button', title: t('dialogClose'), 'aria-label': t('dialogClose'),
        onClick: function () { if (typeof props.onClose === 'function') props.onClose(); }
      }, h(Icon, { name: 'close' }))),
    h('div', { key: 'b', className: 'zp-dialog-b' }, props.children),
    props.footer ? h('div', { key: 'f', className: 'zp-dialog-f' }, props.footer) : null
  ];
}

function Overlay(props) {
  const ref = useDialogFocus(true);
  const onMask = function () { if (typeof props.onClose === 'function') props.onClose(); };
  const extra = props.className ? ' ' + String(props.className) : '';
  if (props.kind === 'modal') {
    return h('div', { className: 'zp-overlay zp-overlay-center' },
      h('div', { className: 'zp-mask', 'aria-hidden': true, onClick: onMask }),
      h('div', {
        className: 'zp-modal' + extra, role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title, 'data-region': 'MODAL',
        'data-dsh-automatic-focus': '', tabIndex: -1, ref: ref, onKeyDown: dialogKeyDown(props.onClose)
      }, dialogInner(props)));
  }
  return h('div', { className: 'zp-overlay' },
    h('div', { className: 'zp-mask', 'aria-hidden': true, onClick: onMask }),
    h('aside', {
      className: 'zp-sheet' + extra, role: 'dialog', 'aria-modal': 'true', 'aria-label': props.title, 'data-region': 'SHEET',
      'data-dsh-automatic-focus': '', tabIndex: -1, ref: ref, onKeyDown: dialogKeyDown(props.onClose)
    }, dialogInner(props)));
}

function Sheet(props) {
  return h(Overlay, Object.assign({}, props, { kind: 'sheet' }));
}

function Modal(props) {
  return h(Overlay, Object.assign({}, props, { kind: 'modal' }));
}

/* ---------------- 提示条 ---------------- */
function selectToast(s) {
  return s.session.toast;
}

function Toast() {
  const toast = useStore(selectToast);
  if (!toast) return null;
  const action = toast.action;
  return h('div', {
    className: 'zp-toast' + (toast.error ? ' zp-error' : ''), role: 'status', 'aria-live': 'polite', 'data-region': 'TOAST'
  },
  h('span', null, toast.text),
  action ? h('button', {
    type: 'button',
    onClick: function () {
      const store = appStore();
      try { action.run(); } finally {
        if (store.getState().session.toast === toast) store.dismissToast();
      }
    }
  }, action.label) : null);
}

/* ---------------- 确认按钮 ---------------- */
const CONFIRM_MS = 4000;

function ConfirmButton(props) {
  const [armed, setArmed] = useState(false);
  useEffect(function () {
    if (!armed) return undefined;
    return uiLater(function () { setArmed(false); }, CONFIRM_MS);
  }, [armed]);
  const needConfirm = props.needConfirm !== false;
  return h('button', {
    className: (props.className || 'zp-btn') + (armed ? ' zp-armed' : ''), type: 'button',
    disabled: props.disabled ? true : undefined, title: props.title, 'aria-live': 'polite',
    onClick: function () {
      if (!needConfirm || armed) {
        setArmed(false);
        props.onConfirm();
        return;
      }
      setArmed(true);
    }
  }, props.icon ? h(Icon, { name: props.icon, size: 14 }) : null, armed ? props.confirmLabel : props.label);
}

ZWUI.iconNames = Object.keys(ICON_PATHS);
ZWUI.parts = {
  useStore: useStore, appStore: appStore, openSheet: openSheet, openModal: openModal, closeLayers: closeLayers,
  Icon: Icon, Seg: Seg, Menu: Menu, Overlay: Overlay, Sheet: Sheet, Modal: Modal, Toast: Toast, ConfirmButton: ConfirmButton,
  useDialogFocus: useDialogFocus, trapTab: trapTab, focusablesIn: focusablesIn, usePopoverDismiss: usePopoverDismiss,
  copyText: copyText, starColorVar: starColorVar, uiLater: uiLater
};
