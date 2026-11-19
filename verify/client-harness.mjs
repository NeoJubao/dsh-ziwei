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
