/**
 * verify/client-harness.mjs — 在 node:vm 里装载客户端 bundle 的公共工具（v6 自检用）
 *
 * 和 verify/verify.mjs 第 3 节同一套假环境：极简假 React（只有 createElement / Component /
 * useState / useEffect / useMemo / useRef，没有 useLayoutEffect、Fragment、useCallback、useContext、
 * useReducer、memo）、假 __ModuleLoader__、只够注入 <style> 的假 document。
 *
 *   loadBundle(text)        求值 bundle，返回 { win, entries, entry, error, React, document, materialize }
 *   makeCtx(services)       假 cordis ctx：slots.inject / register 记账；effect 立即执行并收集清理函数
 *   renderShallow(el)       调一次函数组件（或 class 的 render），不展开子组件
 *   renderDeep(el)          递归展开所有组件，得到只含宿主元素的树（useState 返回初值，effect 不执行）
 *   find / findByClass / text / diffTrees   在元素树里查找、取文字、比较两棵树
 *   memoryStorage()         内存版 localStorage
 *   fakeFetch(script)       假 fetch：按脚本返回 JSON / 文本 / SSE 流，记录每次请求
 *   streamFetch(opts)       可控的流式假 fetch：每次调用开一条管道，测试一块一块往里推 SSE
 *   settle(n)               等 n 轮宏任务，让 vm 里的 promise 链跑完
 *   manualTimers()          手动定时器（setTimeout / clearTimeout / runAll / delays / pending）
 *   makeRuntime()           极简 React 运行时：effect 会跑、setState 会重渲染、有假 DOM 和事件（说明见定义处）
 *   bootRuntime(client, o)  装载 v6 bundle + 运行时 + 测试用的默认 store；视图的检查文件从这里起步
 */
import vm from 'node:vm';

/* ------------------------------------------------------------------ *
 * 假 React
 * ------------------------------------------------------------------ */

export function makeReact() {
  class Component {
    constructor(props) { this.props = props || {}; this.state = {}; this.context = null; }
    setState() {}
    componentDidCatch() {}
    render() { return null; }
  }
  return {
    Component,
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (init) => ({ current: init })
  };
}

/* ------------------------------------------------------------------ *
 * 装载 bundle
 * ------------------------------------------------------------------ */

function makeDocument() {
  const head = {
    children: [],
    appendChild(el) { el.parentNode = head; head.children.push(el); return el; },
    removeChild(el) {
      const i = head.children.indexOf(el);
      if (i >= 0) head.children.splice(i, 1);
      el.parentNode = null;
      return el;
    }
  };
  return {
    head,
    created: [],
    createElement(tag) {
      const el = { tagName: String(tag).toUpperCase(), textContent: '', parentNode: null, attributes: {}, setAttribute(k, v) { this.attributes[k] = String(v); } };
      this.created.push(el);
      return el;
    }
  };
}

/**
 * 在一个裸 vm 上下文里求值 bundle。只提供 verify.mjs 同款的最小宿主：
 * window.React、window.__ModuleLoader__、add/removeEventListener、document.createElement / head。
 * globals：额外放进沙箱的全局（例如 { AbortController }，让 vm 里的 SSE 客户端走浏览器那条中止路径）；默认不加。
 */
export function loadBundle(text, { filename = 'client.v6.js', globals = null } = {}) {
  const React = makeReact();
  const entries = [];
  const document = makeDocument();
  const win = {
    React,
    __ModuleLoader__: { load: (entry) => { entries.push(entry); } },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  const sandbox = Object.assign({ console, TextEncoder, TextDecoder, document }, globals || {});
  sandbox.window = win;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.React = React;
  const context = vm.createContext(sandbox);
  let error = null;
  try {
    new vm.Script(text, { filename }).runInContext(context);
  } catch (e) {
    error = e;
  }
  const entry = entries.find((e) => e && e.id) || null;
  return {
    React, win, sandbox, document, entries, entry, error,
    /** 调 factory(require)；require('react') 返回假 React */
    materialize() { return entry.factory((name) => (name === 'react' ? React : undefined)); }
  };
}

/* ------------------------------------------------------------------ *
 * 假 cordis ctx
 * ------------------------------------------------------------------ */

/**
 * services：{ layout, locale, uiWorkspace, ... }，ctx.get(name) 按名字返回。
 * runEffects：true（默认，和 cordis 一样立即执行 effect 回调并收下清理函数）；
 *             false（verify.mjs 的旧写法：effect 什么都不做）。
 */
export function makeCtx(services = {}, { runEffects = true } = {}) {
  const injections = [];
  const registrations = [];
  const disposers = [];
  const effects = [];
  const ctx = {
    get: (name) => services[name],
    slots: {
      inject: (key, cb) => { injections.push(key); cb(); return { dispose() {} }; },
      register: (def, comp) => { registrations.push([def, comp]); return { dispose() {} }; }
    },
    effect: (fn, label) => {
      effects.push(label || '');
      if (!runEffects) return () => {};
      const d = fn();
      const dispose = typeof d === 'function' ? d : d && typeof d.dispose === 'function' ? () => d.dispose() : null;
      if (dispose) disposers.push(dispose);
      return () => {};
    },
    logger: { warn: () => {} }
  };
  return {
    ctx, injections, registrations, effects, disposers,
    /** 模拟插件卸载：倒序执行 effect 的清理函数 */
    disposeAll() { while (disposers.length) disposers.pop()(); },
    main() { const r = registrations.find(([d]) => d && d.name === 'main'); return r ? r[1] : null; },
    panel() { const r = registrations.find(([d]) => d && d.name === 'sidebar.panellist'); return r || null; }
  };
}

/** 假 locale 服务：记下 register / bind 的调用；bind 返回的 t 按当前语言查字典。 */
export function fakeLocale(lang = 'zh') {
  const calls = { register: [], bind: [] };
  let dicts = null;
  return {
    calls,
    register(ns, d) { calls.register.push([ns, d]); dicts = d; return () => { calls.disposed = (calls.disposed || 0) + 1; }; },
    bind(ns) {
      calls.bind.push(ns);
      return (key) => (dicts && dicts[lang] && dicts[lang][key] !== undefined ? dicts[lang][key] : key);
    }
  };
}

/* ------------------------------------------------------------------ *
 * 渲染
 * ------------------------------------------------------------------ */

const isElement = (n) => !!n && typeof n === 'object' && 'type' in n && 'children' in n;
const propsWithChildren = (el) => {
  const props = Object.assign({}, el.props || {});
  if (el.children && el.children.length) props.children = el.children.length === 1 ? el.children[0] : el.children;
  return props;
};

function callComponent(el) {
  const T = el.type;
  const props = propsWithChildren(el);
  if (T.prototype && typeof T.prototype.render === 'function') {
    const inst = new T(props);
    if (typeof T.getDerivedStateFromProps === 'function') Object.assign(inst.state, T.getDerivedStateFromProps(props, inst.state));
    return inst.render();
  }
  return T(props);
}

/** 浅渲染：只调用 el 自己这一层组件，返回它渲染出的元素树（子组件不展开）。 */
export function renderShallow(el) {
  if (!isElement(el) || typeof el.type !== 'function') return el;
  return callComponent(el);
}

/** 深渲染：递归展开所有函数 / class 组件，返回只含宿主元素（字符串 type）的树。 */
export function renderDeep(node, depth = 0) {
  if (depth > 200) throw new Error('renderDeep：组件嵌套超过 200 层');
  if (Array.isArray(node)) return node.map((n) => renderDeep(n, depth + 1));
  if (!isElement(node)) return node;
  if (typeof node.type === 'function') return renderDeep(callComponent(node), depth + 1);
  return { type: node.type, props: node.props, children: (node.children || []).map((c) => renderDeep(c, depth + 1)) };
}

/** 遍历树（含数组、跳过 null / false / 字符串），收集满足 pred 的元素。 */
export function find(tree, pred, hits = []) {
  if (Array.isArray(tree)) { for (const n of tree) find(n, pred, hits); return hits; }
  if (!isElement(tree)) return hits;
  if (pred(tree)) hits.push(tree);
  for (const c of tree.children || []) find(c, pred, hits);
  return hits;
}

export const classesOf = (el) => (el && el.props && typeof el.props.className === 'string' ? el.props.className.split(/\s+/).filter(Boolean) : []);
export const findByClass = (tree, cls) => find(tree, (n) => classesOf(n).includes(cls));

/** 树里所有文字节点拼起来（数字也算）。 */
export function text(tree) {
  if (tree === null || tree === undefined || tree === false || tree === true) return '';
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (!isElement(tree)) return '';
  return (tree.children || []).map(text).join('');
}

/**
 * 比较两棵（深渲染后的）树，返回差异列表 [{ path, kind, a, b }]。
 * kind：type（标签变了）、prop（某个属性值变了，函数属性只比是否存在）、children（子节点数变了）、text（文字变了）。
 */
export function diffTrees(a, b, path = 'root', out = []) {
  const norm = (x) => (Array.isArray(x) ? x.flat(Infinity) : [x]).filter((n) => n !== null && n !== undefined && n !== false && n !== true);
  if (!isElement(a) || !isElement(b)) {
    if (isElement(a) !== isElement(b)) out.push({ path, kind: 'type', a: isElement(a) ? a.type : a, b: isElement(b) ? b.type : b });
    else if (String(a) !== String(b)) out.push({ path, kind: 'text', a, b });
    return out;
  }
  if (a.type !== b.type) { out.push({ path, kind: 'type', a: a.type, b: b.type }); return out; }
  const pa = a.props || {};
  const pb = b.props || {};
  for (const k of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
    if (k === 'children') continue;
    const va = pa[k];
    const vb = pb[k];
    if (typeof va === 'function' || typeof vb === 'function') {
      if (typeof va !== typeof vb) out.push({ path: `${path}.${k}`, kind: 'prop', a: typeof va, b: typeof vb });
      continue;
    }
    if (JSON.stringify(va) !== JSON.stringify(vb)) out.push({ path: `${path}.${k}`, kind: 'prop', a: va, b: vb });
  }
  const ca = norm(a.children || []);
  const cb = norm(b.children || []);
  if (ca.length !== cb.length) out.push({ path, kind: 'children', a: ca.length, b: cb.length });
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i++) {
    const key = isElement(ca[i]) && ca[i].props && ca[i].props.key !== undefined ? `[key=${ca[i].props.key}]` : `[${i}]`;
    diffTrees(ca[i], cb[i], `${path}>${isElement(ca[i]) ? ca[i].type : '#text'}${key}`, out);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 存储与网络
 * ------------------------------------------------------------------ */

/** 内存版 localStorage（同步接口和浏览器一致；值一律存成字符串）。 */
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, String(v)]));
  return {
    getItem: (k) => (data.has(String(k)) ? data.get(String(k)) : null),
    setItem: (k, v) => { data.set(String(k), String(v)); },
    removeItem: (k) => { data.delete(String(k)); },
    clear: () => { data.clear(); },
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
    dump: () => Object.fromEntries(data)
  };
}

/**
 * 假 fetch。script 是函数 (url, init, n) => 回复，或回复数组（按调用次序取）。回复的形状：
 *   { json: any } / { text: string } / { sse: [[event, data], ...] }，可加 status（默认 200）。
 *   { error: '...' } 让这次 fetch 直接 reject；{ hang: true } 返回一个只在 abort 时结束的流。
 * 返回的 fetch 带 .calls：[{ url, init, body }]（body 已 JSON.parse，解析不了时是原文）。
 */
export function fakeFetch(script) {
  const calls = [];
  const enc = new TextEncoder();
  const respond = (url, init, reply) => {
    const status = reply.status || 200;
    const headers = { get: (k) => (/content-type/i.test(k) ? (reply.sse ? 'text/event-stream' : reply.json !== undefined ? 'application/json' : 'text/plain') : null) };
    let chunks = [];
    if (reply.sse) chunks = reply.sse.map(([ev, data]) => enc.encode(`event: ${ev}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`));
    else if (reply.text !== undefined) chunks = [enc.encode(reply.text)];
    else if (reply.json !== undefined) chunks = [enc.encode(JSON.stringify(reply.json))];
    const signal = init && init.signal;
    const reader = {
      read() {
        if (signal && signal.aborted) return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        if (chunks.length) return Promise.resolve({ done: false, value: chunks.shift() });
        if (reply.hang) {
          return new Promise((resolve, reject) => {
            if (signal) signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
          });
        }
        return Promise.resolve({ done: true, value: undefined });
      },
      cancel() { chunks = []; return Promise.resolve(); },
      releaseLock() {}
    };
    const whole = () => Promise.resolve(new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c)))));
    return {
      ok: status >= 200 && status < 300,
      status,
      headers,
      body: { getReader: () => reader },
      text: whole,
      json: () => whole().then((s) => JSON.parse(s))
    };
  };
  const fetch = (url, init = {}) => {
    const n = calls.length;
    let body = init.body;
    try { body = JSON.parse(init.body); } catch { /* 原文 */ }
    calls.push({ url: String(url), init, body });
    const reply = typeof script === 'function' ? script(String(url), init, n) : (script[n] || script[script.length - 1]);
    if (!reply) return Promise.reject(new Error(`fakeFetch：第 ${n + 1} 次调用没有准备回复（${url}）`));
    if (reply.error) return Promise.reject(new Error(reply.error));
    return Promise.resolve(respond(String(url), init, reply));
  };
  fetch.calls = calls;
  return fetch;
}

/**
 * 可控的流式假 fetch（T3b）：每次调用都马上回一个 200 的 SSE 响应，正文由测试一块一块推进去。
 * 返回的 fetch 带 .calls，每一项是一条管道：
 *   { url, init, body, send(event, data), raw(text), end(), fail(message), cancelled }
 *   send 推一个完整的 SSE 块；raw 原样推一段文字（可以把一个块拆在两次 raw 里）；end 正常关闭流；
 *   fail 让下一次 read() 抛错。init.signal 被中止时，挂着的 read() 以 AbortError 结束；reader.cancel() 记下 cancelled。
 * reply(url, init, n)：返回 fakeFetch 形状的回复时这次调用改用它（例如 { status: 503, json: {...} }）；返回空值走管道。
 */
export function streamFetch({ reply = null } = {}) {
  const calls = [];
  const enc = new TextEncoder();
  const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
  const fetch = (url, init = {}) => {
    const n = calls.length;
    let body = init.body;
    try { body = JSON.parse(init.body); } catch { /* 原文 */ }
    const fixed = reply ? reply(String(url), init, n) : null;
    if (fixed) {
      calls.push({ url: String(url), init, body, fixed: true });
      return fakeFetch(() => fixed)(url, init);
    }
    const queue = [];
    let waiter = null;
    let ended = false;
    let failed = null;
    const pump = () => {
      if (!waiter) return;
      const w = waiter;
      if (queue.length) { waiter = null; w.resolve({ done: false, value: queue.shift() }); }
      else if (failed) { waiter = null; w.reject(failed); }
      else if (ended) { waiter = null; w.resolve({ done: true, value: undefined }); }
    };
    const signal = init.signal;
    if (signal && typeof signal.addEventListener === 'function') {
      signal.addEventListener('abort', () => { failed = abortError(); pump(); }, { once: true });
    }
    const call = {
      url: String(url), init, body, cancelled: false,
      send(ev, data) { queue.push(enc.encode(`event: ${ev}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`)); pump(); return call; },
      raw(text) { queue.push(enc.encode(text)); pump(); return call; },
      end() { ended = true; pump(); return call; },
      fail(message) { failed = new Error(message || 'network error'); pump(); return call; }
    };
    calls.push(call);
    const reader = {
      read() {
        if (signal && signal.aborted) return Promise.reject(abortError());
        return new Promise((resolve, reject) => { waiter = { resolve, reject }; pump(); });
      },
      cancel() { call.cancelled = true; ended = true; queue.length = 0; pump(); return Promise.resolve(); },
      releaseLock() {}
    };
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: (k) => (/content-type/i.test(k) ? 'text/event-stream' : null) },
      body: { getReader: () => reader },
      text: () => Promise.resolve(''),
      json: () => Promise.reject(new Error('not json'))
    });
  };
  fetch.calls = calls;
  return fetch;
}

/** 等 n 轮宏任务（setImmediate），让 vm 里排队的 promise 回调全部跑完。 */
export async function settle(n = 4) {
  for (let i = 0; i < n; i++) await new Promise((resolve) => setImmediate(resolve));
}

/* ------------------------------------------------------------------ *
 * 手动定时器：记下 setTimeout，测试自己决定什么时候跑
 * ------------------------------------------------------------------ */
export function manualTimers() {
  let seq = 0;
  const pending = new Map();
  return {
    pending,
    setTimeout: (fn, ms) => { const id = ++seq; pending.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => { pending.delete(id); },
    runAll() { const list = [...pending.values()]; pending.clear(); list.forEach((x) => x.fn()); return list.length; },
    delays() { return [...pending.values()].map((x) => x.ms); }
  };
}

export class FakeResizeObserver {
  constructor(cb) { this.cb = cb; }
  observe() {}
  disconnect() {}
}

/* ------------------------------------------------------------------ *
 * 极简 React 运行时（makeRuntime）：effect 会跑、setState 会重渲染
 *
 * 上面的假 React 不跑 effect、setState 是空操作，测不出订阅、焦点和"谁重渲染了"。这个运行时只有 v6 允许的
 * 那几个 API：
 *   - 函数组件和 class 组件，hooks：useState / useRef / useMemo / useEffect / useLayoutEffect
 *   - setState → 标脏，flush() 时从上往下重渲染；父组件重渲染时子组件跟着渲染（没有 memo），
 *     同一个元素对象原样传下来时跳过（和 React 一样）
 *   - 先跑 layout effect，再跑 passive effect；mount(el, { passive: false }) 把 passive effect 扣住，
 *     releasePassive() 再放行，用来模拟"渲染之后、订阅之前"的空档
 *   - getDerivedStateFromError 的错误边界
 *   - 假 DOM：每个宿主元素一个节点（parentNode / contains / focus / querySelectorAll / classList / hidden →
 *     offsetParent / getBoundingClientRect 的宽度取 rt.width），document 的捕获监听；
 *     事件按 React 的冒泡顺序调用 onX
 * rt：{ React, mount(el, opts), unmount(), flush(), tree()（只含宿主元素的树，节点在不可枚举的 .node 上）,
 *       fire(target, type, init) / click(target) / key(target, key, init), count(组件函数名) → 渲染次数,
 *       renders, doc, container, width, errors }
 * ------------------------------------------------------------------ */
const TEXT = '#text';
const FRAG = '#frag';
const HANDLERS = {
  click: 'onClick', keydown: 'onKeyDown', pointerdown: 'onPointerDown', focusout: 'onBlur', mousedown: 'onMouseDown',
  scroll: 'onScroll', change: 'onChange', submit: 'onSubmit', mouseenter: 'onMouseEnter', mouseleave: 'onMouseLeave', focusin: 'onFocus'
};

export function makeRuntime() {
  const rt = { width: 0, renders: new Map(), deferPassive: false, errors: [] };
  let current = null;
  let hookIdx = 0;
  const dirty = new Set();
  const layoutQ = new Map();
  const passiveQ = new Map();
  let passiveCleanups = [];
  const created = [];

  /* ---------- 假 DOM ---------- */
  const docListeners = [];
  const doc = {
    activeElement: null,
    addEventListener(type, fn, opt) { docListeners.push({ type, fn, capture: opt === true || !!(opt && opt.capture) }); },
    removeEventListener(type, fn, opt) {
      const capture = opt === true || !!(opt && opt.capture);
      const i = docListeners.findIndex((l) => l.type === type && l.fn === fn && l.capture === capture);
      if (i >= 0) docListeners.splice(i, 1);
    },
    listenerCount: (type) => docListeners.filter((l) => l.type === type).length
  };
  const propsOf = (n) => (n && n.__inst && n.__inst.el && n.__inst.el.props) || {};
  const attrOf = (n, name) => {
    const p = propsOf(n);
    if (name === 'tabindex') return p.tabIndex === undefined || p.tabIndex === null ? null : String(p.tabIndex);
    if (name === 'disabled' || name === 'hidden') return p[name] ? '' : null;
    if (name === 'class') return p.className === undefined ? null : p.className;
    const v = p[name];
    return v === undefined || v === null || v === false ? null : String(v);
  };
  const matchSimple = (n, sel) => {
    let rest = sel.trim();
    let neg = null;
    const notM = rest.match(/:not\((.+)\)$/);
    if (notM) { neg = notM[1]; rest = rest.slice(0, notM.index); }
    const tagM = rest.match(/^[a-z][a-z0-9]*/i);
    if (tagM) { if (n.tagName !== tagM[0].toUpperCase()) return false; rest = rest.slice(tagM[0].length); }
    for (const m of rest.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]|\.([\w-]+)/g)) {
      if (m[3]) { if (!classesOf({ props: propsOf(n) }).includes(m[3])) return false; continue; }
      const v = attrOf(n, m[1]);
      if (m[2] === undefined ? v === null : v !== m[2]) return false;
    }
    if (neg && matchSimple(n, neg)) return false;
    return true;
  };
  const matches = (n, sel) => sel.split(',').some((s) => matchSimple(n, s));
  const walk = (n, fn) => { for (const c of n.childNodes) { fn(c); walk(c, fn); } };
  const isFocusable = (n) => {
    if (!n || !n.__inst) return false;
    const p = propsOf(n);
    if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(n.tagName)) return !p.disabled;
    return p.href !== undefined || (p.tabIndex !== undefined && p.tabIndex !== null);
  };
  const makeNode = (tag, inst) => {
    const classes = new Set();
    return {
      tagName: String(tag).toUpperCase(), __inst: inst, parentNode: null, childNodes: [], ownerDocument: doc,
      get isConnected() { let n = this; while (n) { if (n === doc.body) return true; n = n.parentNode; } return false; },
      get disabled() { return !!propsOf(this).disabled; },
      get offsetParent() {
        if (!this.isConnected) return null;
        for (let n = this; n && n !== doc.body; n = n.parentNode) if (propsOf(n).hidden) return null;
        return doc.body;
      },
      classList: { add: (c) => { classes.add(c); }, remove: (c) => { classes.delete(c); }, contains: (c) => classes.has(c) },
      focus() { if (isFocusable(this) && this.offsetParent !== null) doc.activeElement = this; },
      blur() { if (doc.activeElement === this) doc.activeElement = doc.body; },
      contains(o) { for (let n = o; n; n = n.parentNode) if (n === this) return true; return false; },
      querySelectorAll(sel) { const out = []; walk(this, (n) => { if (matches(n, sel)) out.push(n); }); return out; },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      getBoundingClientRect() { return { width: rt.width, height: 640, left: 0, top: 0, right: rt.width, bottom: 640, x: 0, y: 0 }; },
      setAttribute() {},
      removeAttribute() {}
    };
  };
  doc.body = makeNode('body', null);
  doc.activeElement = doc.body;
  const container = makeNode('div', null);
  container.parentNode = doc.body;
  doc.body.childNodes = [container];

  /* ---------- 实例树 ---------- */
  const root = { kind: 'root', depth: 0, children: [] };
  const isClass = (T) => !!(T && T.prototype && typeof T.prototype.render === 'function');
  const propsWithChildren = (el) => {
    const p = Object.assign({}, el.props || {});
    if (el.children && el.children.length) p.children = el.children.length === 1 ? el.children[0] : el.children;
    return p;
  };
  const markDirty = (inst) => { if (!inst || inst.dead) return; inst.dirty = true; dirty.add(inst); };

  class Component {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      const next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
      this.state = Object.assign({}, this.state, next);
      markDirty(this.__inst);
    }
    render() { return null; }
  }

  const hookSlot = (init) => {
    if (!current) throw new Error('hook 在组件之外调用');
    const i = hookIdx++;
    if (!(i in current.hooks)) current.hooks[i] = init();
    return current.hooks[i];
  };
  const depsChanged = (a, b) => !a || !b || a.length !== b.length || a.some((d, j) => !Object.is(d, b[j]));
  const effect = (fn, deps, layout) => {
    const inst = current;
    const slot = hookSlot(() => ({ layout, deps: null, cleanup: null, mounted: false }));
    if (!slot.mounted || deps === undefined || depsChanged(deps, slot.deps)) (layout ? layoutQ : passiveQ).set(slot, { inst, slot, fn, deps });
  };
  rt.React = {
    Component,
    createElement: (type, props, ...children) => ({ type, props: props || null, children }),
    useState(init) {
      const inst = current;
      const slot = hookSlot(() => ({ value: typeof init === 'function' ? init() : init }));
      if (!slot.set) {
        slot.set = (v) => {
          if (inst.dead) return;
          const next = typeof v === 'function' ? v(slot.value) : v;
          if (Object.is(next, slot.value)) return;
          slot.value = next;
          markDirty(inst);
        };
      }
      return [slot.value, slot.set];
    },
    useRef: (init) => hookSlot(() => ({ current: init })),
    useMemo(fn, deps) {
      const slot = hookSlot(() => ({ deps: null, value: undefined, ready: false }));
      if (!slot.ready || deps === undefined || depsChanged(deps, slot.deps)) { slot.value = fn(); slot.deps = deps; slot.ready = true; }
      return slot.value;
    },
    useEffect: (fn, deps) => effect(fn, deps, false),
    useLayoutEffect: (fn, deps) => effect(fn, deps, true)
  };

  const setRef = (ref, value) => {
    if (!ref) return;
    if (typeof ref === 'function') ref(value); else ref.current = value;
  };
  const nearestBoundary = (inst) => {
    for (let p = inst; p && p.kind !== 'root'; p = p.parent) {
      if (p.kind === 'component' && isClass(p.type) && typeof p.type.getDerivedStateFromError === 'function' && p.obj) return p;
    }
    return null;
  };

  function renderInst(inst) {
    inst.dirty = false;
    dirty.delete(inst);
    const T = inst.type;
    const name = T.name || '(anonymous)';
    rt.renders.set(name, (rt.renders.get(name) || 0) + 1);
    const props = propsWithChildren(inst.el);
    if (isClass(T)) {
      if (!inst.obj) { inst.obj = new T(props); inst.obj.__inst = inst; }
      inst.obj.props = props;
      if (typeof T.getDerivedStateFromError === 'function') {
        const mark = created.length;
        try {
          reconcile(inst, [inst.obj.render()]);
        } catch (err) {
          recover(inst, err, mark);
        }
        return;
      }
      reconcile(inst, [inst.obj.render()]);
      return;
    }
    const prev = current, prevIdx = hookIdx;
    current = inst;
    hookIdx = 0;
    let out;
    try { out = T(props); } finally { current = prev; hookIdx = prevIdx; }
    reconcile(inst, [out]);
  }
  function recover(boundary, err, mark) {
    rt.errors.push(err);
    created.slice(mark).forEach((c) => { c.dead = true; });
    for (const c of boundary.children) unmount(c);
    boundary.children = [];
    boundary.obj.state = Object.assign({}, boundary.obj.state, boundary.type.getDerivedStateFromError(err));
    reconcile(boundary, [boundary.obj.render()]);
  }

  function reconcile(parent, kids) {
    const old = new Map();
    for (const c of parent.children || []) old.set(c.slot, c);
    const next = [];
    kids.forEach((k, i) => {
      if (k === null || k === undefined || typeof k === 'boolean') return;
      let kind, type, slot;
      if (Array.isArray(k)) { kind = 'frag'; type = FRAG; slot = 'i' + i; }
      else if (typeof k === 'string' || typeof k === 'number') { kind = 'text'; type = TEXT; slot = 'i' + i; }
      else {
        type = k.type;
        kind = typeof type === 'function' ? 'component' : 'host';
        const key = k.props && k.props.key;
        slot = key !== undefined && key !== null ? 'k' + key : 'i' + i;
      }
      let inst = old.get(slot);
      if (inst && inst.type === type) {
        old.delete(slot);
        const same = inst.el === k;
        inst.el = k;
        next.push(inst);
        if (kind === 'text') inst.text = String(k);
        else if (kind === 'frag') reconcile(inst, k);
        else if (kind === 'host') { if (!same) reconcile(inst, k.children || []); }
        else if (!same || inst.dirty) renderInst(inst);
      } else {
        inst = { kind, type, el: k, slot, parent, depth: (parent.depth || 0) + 1, children: [], hooks: [], dead: false, dirty: false };
        created.push(inst);
        next.push(inst);
        if (kind === 'text') inst.text = String(k);
        else if (kind === 'frag') reconcile(inst, k);
        else if (kind === 'host') {
          inst.node = makeNode(type, inst);
          setRef(k.props && k.props.ref, inst.node);
          reconcile(inst, k.children || []);
        } else renderInst(inst);
      }
    });
    for (const c of old.values()) unmount(c);
    parent.children = next;
  }

  function unmount(inst) {
    if (inst.dead && inst.unmounted) return;
    inst.dead = true;
    inst.unmounted = true;
    inst.dirty = false;
    dirty.delete(inst);
    if (inst.kind === 'component') {
      /* 和 React 一样：被删掉的组件，layout effect 的清理在宿主节点摘下之前跑，passive 的在之后 */
      for (const s of inst.hooks) {
        if (s && s.layout === true && s.cleanup) { const c = s.cleanup; s.cleanup = null; c(); }
        if (s && s.layout === false && s.cleanup) { passiveCleanups.push(s.cleanup); s.cleanup = null; }
      }
    }
    for (const c of inst.children || []) unmount(c);
    if (inst.kind === 'host') {
      setRef(inst.el.props && inst.el.props.ref, null);
      inst.node.parentNode = null;
    }
  }

  const hostKids = (inst) => {
    const out = [];
    for (const c of inst.children || []) {
      if (c.kind === 'host') out.push(c.node);
      else if (c.kind !== 'text') out.push(...hostKids(c));
    }
    return out;
  };
  const relinkInst = (inst, parentNode) => {
    if (inst.kind === 'host') {
      inst.node.parentNode = parentNode;
      inst.node.childNodes = hostKids(inst);
      for (const c of inst.children) relinkInst(c, inst.node);
    } else {
      for (const c of inst.children || []) relinkInst(c, parentNode);
    }
  };
  function relink() {
    container.childNodes = hostKids(root);
    for (const c of root.children) relinkInst(c, container);
    if (!doc.activeElement || !doc.activeElement.isConnected) doc.activeElement = doc.body;
  }

  function runEffect(e) {
    if (e.inst.dead) return;
    if (e.slot.cleanup) { const c = e.slot.cleanup; e.slot.cleanup = null; c(); }
    const r = e.fn();
    e.slot.cleanup = typeof r === 'function' ? r : null;
    e.slot.deps = e.deps;
    e.slot.mounted = true;
  }
  function runLayout() { const q = [...layoutQ.values()]; layoutQ.clear(); q.forEach(runEffect); }
  function runPassive() {
    const cl = passiveCleanups; passiveCleanups = [];
    cl.forEach((c) => c());
    const q = [...passiveQ.values()]; passiveQ.clear();
    q.forEach(runEffect);
  }
  function renderDirty() {
    const list = [...dirty].sort((a, b) => a.depth - b.depth);
    for (const inst of list) {
      if (!inst.dirty || inst.dead) continue;
      const mark = created.length;
      try {
        if (inst.kind === 'component') renderInst(inst);
      } catch (err) {
        const b = nearestBoundary(inst.parent);
        if (!b) throw err;
        recover(b, err, mark);
      }
    }
  }
  function flush() {
    for (let guard = 0; guard < 500; guard++) {
      if (dirty.size) { renderDirty(); relink(); continue; }
      if (layoutQ.size) { runLayout(); relink(); continue; }
      if (!rt.deferPassive && (passiveQ.size || passiveCleanups.length)) { runPassive(); relink(); continue; }
      return;
    }
    throw new Error('运行时没有稳定下来（可能是无限重渲染）');
  }

  rt.mount = (el, { passive = true } = {}) => {
    rt.deferPassive = !passive;
    reconcile(root, [el]);
    relink();
    flush();
  };
  rt.releasePassive = () => { rt.deferPassive = false; flush(); };
  rt.unmount = () => { for (const c of root.children) unmount(c); root.children = []; relink(); rt.deferPassive = false; flush(); };
  rt.flush = flush;
  rt.count = (name) => rt.renders.get(name) || 0;
  rt.doc = doc;
  rt.container = container;
  const out = (inst) => {
    if (inst.kind === 'text') return inst.text;
    if (inst.kind === 'host') {
      const o = { type: inst.type, props: inst.el.props || {}, children: inst.children.map(out) };
      Object.defineProperty(o, 'node', { value: inst.node, enumerable: false });
      return o;
    }
    const kids = inst.children.map(out);
    return kids.length === 1 ? kids[0] : kids;
  };
  rt.tree = () => root.children.map(out);
  /* 事件：先 document 的捕获监听，再按 React 的冒泡顺序调用 onX，最后 document 的冒泡监听；之后 flush */
  rt.fire = (target, type, init = {}) => {
    const node = target && target.node ? target.node : target;
    let stopped = false, prevented = false;
    const native = Object.assign({ type, target: node, isComposing: false }, init, {
      stopPropagation() { stopped = true; },
      preventDefault() { prevented = true; }
    });
    for (const l of docListeners.filter((x) => x.type === type && x.capture)) { l.fn(native); if (stopped) break; }
    for (let n = node; n && n !== container && !stopped; n = n.parentNode) {
      const fn = propsOf(n)[HANDLERS[type]];
      if (typeof fn !== 'function') continue;
      fn(Object.assign({}, init, {
        type, target: node, currentTarget: n, nativeEvent: native,
        get defaultPrevented() { return prevented; },
        preventDefault() { prevented = true; },
        stopPropagation() { stopped = true; },
        isPropagationStopped: () => stopped
      }));
    }
    if (!stopped) for (const l of docListeners.filter((x) => x.type === type && !x.capture)) l.fn(native);
    flush();
    return { stopped, prevented };
  };
  rt.click = (el, init) => rt.fire(el, 'click', Object.assign({ detail: 1 }, init));
  rt.key = (el, key, init) => rt.fire(el, 'keydown', Object.assign({ key }, init));
  return rt;
}

/**
 * 装载 v6 bundle + 运行时 + 默认 store（内存 storage、固定时钟、手动定时器、可控的流）。
 * 返回 { rt, loaded, host, layout, store, P（ZWUi.parts）, timers, pipe（streamFetch）, Main（main 槽的组件）, h, win, error }。
 * 默认 store 在这里用测试的 deps 建好（getStore 只认第一次的 deps），所以要在任何组件渲染之前调用。
 */
export function bootRuntime(client, { width = 1300, services = {}, now = Date.now(), storage = null } = {}) {
  const rt = makeRuntime();
  rt.width = width;
  const loaded = loadBundle(client, { globals: { AbortController, ResizeObserver: FakeResizeObserver } });
  if (loaded.error || !loaded.entry) return { error: loaded.error || new Error('没有入口') };
  Object.assign(loaded.React, rt.React);
  const timers = manualTimers();
  loaded.win.setTimeout = timers.setTimeout;
  loaded.win.clearTimeout = timers.clearTimeout;
  const plugin = loaded.materialize();
  const layout = { calls: [], selectPanel(id) { this.calls.push(id); } };
  const host = makeCtx(Object.assign({ layout }, services));
  plugin.apply(host.ctx);
  const S = loaded.win.ZWStore;
  const pipe = streamFetch();
  const store = S.getStore({ storage: storage || memoryStorage(), now: () => now, fetch: pipe, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout });
  const P = (loaded.win.ZWUi && loaded.win.ZWUi.parts) || {};
  return { rt, loaded, host, layout, store, P, timers, pipe, Main: host.main(), h: loaded.React.createElement, win: loaded.win, error: null };
}
