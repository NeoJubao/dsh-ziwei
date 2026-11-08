/**
 * verify/routes-auth.mjs — 路由方法 / 鉴权 / JSON Content-Type 守卫 (A3)
 *
 * 覆盖:
 *  - 4 条路由注册齐全；
 *  - 有 connection 服务: connection.admit 拒绝 → 401/403；GET 写路由 → 405；非 JSON POST → 415；
 *  - 无 connection（非 Web 组合）: Host / Origin / sec-fetch-site fallback fence + 只 warn 一次；
 *  - 合法请求进入 handler 且**不触发 LLM**（/ziwei/interpret 用空命盘，在 llm.stream 之前 400）。
 *
 * 运行: node verify/routes-auth.mjs
 */
import { EventEmitter } from 'node:events';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

const plugin = await import(pathToFileURL(join(root, 'index.js')).href + '?v=' + Date.now());

/* ---------------- 最小 HTTP 桩 ---------------- */
function makeRes() {
  const res = new EventEmitter();
  res.statusCode = 0; res.headers = {}; res.body = ''; res.ended = false;
  res.setHeader = (k, v) => { res.headers[String(k).toLowerCase()] = v; };
  res.write = (s) => { res.body += s; return true; };
  res.end = (s) => { if (s) res.body += s; res.ended = true; res.emit('finish'); };
  res.flushHeaders = () => {};
  return res;
}
function makeReq({ method = 'POST', headers = {}, body = '{}', url = '/' } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = Object.assign({ host: '127.0.0.1:50922' }, headers);
  setTimeout(() => {
    if (body) req.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
    req.emit('end');
  }, 0);
  return req;
}
async function call(routes, path, options) {
  const route = routes.get(path);
  if (!route) throw new Error('路由未注册: ' + path);
  const req = makeReq(options);
  const res = makeRes();
  await route.handler(req, res);
  await new Promise((r) => setTimeout(r, 30)); /* 等 body 事件与异步 handler 收尾 */
  return res;
}
function makeCtx({ connection = null, omit = [] } = {}) {
  const routes = new Map();
  const logs = [];
  const llmCalls = { count: 0 };
  const injections = [];
  const stats = { toolsRegistered: 0 };
  const ctx = {
    inject(deps, callback) { injections.push(deps); callback(ctx); return () => {}; },
    get(name) {
      if (omit.includes(name)) return undefined;
      if (name === 'webServer') return { register: (r) => { routes.set(r.path, r); return () => {}; } };
      if (name === 'tools') return { register: () => { stats.toolsRegistered++; return () => {}; } };
      if (name === 'systemPrompt') return { section: () => () => {}, getSectionOrder: () => 2900 };
      if (name === 'llm') return {
        stream: () => {
          llmCalls.count++;
          return (async function* () { yield { type: 'finish', reason: { kind: 'stop' } }; })();
        }
      };
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'test', model: 'test' }) };
      if (name === 'connection') return connection || undefined;
      return undefined;
    },
    effect: () => () => {},
    logger: {
      info: (m) => logs.push({ level: 'info', msg: m }),
      warn: (m) => logs.push({ level: 'warn', msg: m }),
      error: (m) => logs.push({ level: 'error', msg: m })
    }
  };
  plugin.apply(ctx);
  return { routes, logs, llmCalls, injections, stats };
}
const ROUTES = ['/ziwei/interpret', '/ziwei/context', '/ziwei/handoff', '/ziwei/workspace'];

/* ================================================================== *
 * 1. 启动健康日志
 * ================================================================== */
section('1. 健康日志（A1）');
{
  const { logs, injections, stats } = makeCtx();
  ok('服务齐全 → info「注册完成 tools=4 prompt=ok」',
    logs.some((l) => l.level === 'info' && /注册完成 tools=4 prompt=ok/.test(l.msg)),
    JSON.stringify(logs));
  ok('webServer/llm 通过 ctx.inject 按需等待（不再进必需 inject）',
    injections.some((deps) => deps.includes('webServer') && deps.includes('llm')),
    JSON.stringify(injections));
  const { logs: logs2, stats: stats2 } = makeCtx({ omit: ['webServer'] });
  ok('缺 webServer 不再报缺失，4 个工具仍全部注册（P1-3 防回归）',
    !logs2.some((l) => l.level === 'error' && /webServer/.test(l.msg)) && stats2.toolsRegistered === 4,
    JSON.stringify(logs2.filter((l) => l.level === 'error')) + ' tools=' + stats2.toolsRegistered);
  const { logs: logs3 } = makeCtx({ omit: ['tools', 'systemPrompt'] });
  ok('多个缺失服务都出现在 error 里',
    logs3.some((l) => l.level === 'error' && /tools/.test(l.msg) && /systemPrompt/.test(l.msg)),
    JSON.stringify(logs3.filter((l) => l.level === 'error')));
}

/* ================================================================== *
 * 2. 有 connection 服务: admit 鉴权 + 方法 + JSON
 * ================================================================== */
section('2. connection.admit 鉴权');
const connection = {
  requestRejection(req) {
    const cookie = String((req.headers && req.headers.cookie) || '');
    return /cookie/.test(cookie) ? undefined : 401;
  },
  admit(req) {
    const cookie = String((req.headers && req.headers.cookie) || '');
    if (!/cookie/.test(cookie)) return { rejection: 401 };
    if (/nonowner/.test(cookie)) return { peer: { id: 'peer-2', principal: { kind: 'viewer' } } };
    return { peer: { id: 'peer-1', principal: { kind: 'owner' } } };
  }
};
const { routes, llmCalls } = makeCtx({ connection });
ok('注册 4 条 ziwei 路由', ROUTES.every((p) => routes.has(p)), [...routes.keys()].join(','));

let r = await call(routes, '/ziwei/interpret', { method: 'POST', headers: { 'content-type': 'application/json' } });
ok('无 cookie POST /ziwei/interpret → 401', r.statusCode === 401 && /未授权/.test(r.body), `${r.statusCode} ${r.body}`);
r = await call(routes, '/ziwei/context', { method: 'POST', headers: { 'content-type': 'application/json' } });
ok('无 cookie POST /ziwei/context → 401', r.statusCode === 401, `${r.statusCode} ${r.body}`);
r = await call(routes, '/ziwei/workspace', { method: 'GET', body: '' });
ok('无 cookie GET /ziwei/workspace → 401', r.statusCode === 401, `${r.statusCode} ${r.body}`);

r = await call(routes, '/ziwei/interpret', { method: 'POST', headers: { cookie: 'session=cookie; role=nonowner', 'content-type': 'application/json' }, body: '{}' });
ok('非 owner Peer → 403（与 /api 精确 Fetch 路由同口径）', r.statusCode === 403 && /所有者/.test(r.body), `${r.statusCode} ${r.body}`);

r = await call(routes, '/ziwei/interpret', { method: 'GET', body: '' });
ok('GET /ziwei/interpret → 405 且 Allow: POST', r.statusCode === 405 && r.headers.allow === 'POST', `${r.statusCode} allow=${r.headers.allow}`);
r = await call(routes, '/ziwei/workspace', { method: 'POST', headers: { cookie: 'session=cookie' } });
ok('POST /ziwei/workspace → 405 且 Allow: GET', r.statusCode === 405 && r.headers.allow === 'GET', `${r.statusCode} allow=${r.headers.allow}`);

r = await call(routes, '/ziwei/context', { method: 'POST', headers: { cookie: 'session=cookie' } });
ok('已授权但非 JSON Content-Type → 415', r.statusCode === 415 && /application\/json/i.test(r.body), `${r.statusCode} ${r.body}`);

r = await call(routes, '/ziwei/context', { method: 'POST', headers: { cookie: 'session=cookie', 'content-type': 'application/json' }, body: '{}' });
ok('合法 POST /ziwei/context 进入 handler（空盘 → 400）', r.statusCode === 400 && /命盘内容为空/.test(r.body), `${r.statusCode} ${r.body}`);

r = await call(routes, '/ziwei/interpret', { method: 'POST', headers: { cookie: 'session=cookie', 'content-type': 'application/json' }, body: '{}' });
ok('合法 POST /ziwei/interpret 进入 handler 且未触发 LLM（空盘 → 400）',
  r.statusCode === 400 && /命盘内容为空/.test(r.body) && llmCalls.count === 0,
  `${r.statusCode} ${r.body} llmCalls=${llmCalls.count}`);

r = await call(routes, '/ziwei/handoff', { method: 'POST', headers: { cookie: 'session=cookie', 'content-type': 'application/json' }, body: '{}' });
ok('合法 POST /ziwei/handoff 进入 handler（空盘 → 400）', r.statusCode === 400 && /命盘内容为空/.test(r.body), `${r.statusCode} ${r.body}`);

r = await call(routes, '/ziwei/workspace', { method: 'GET', headers: { cookie: 'session=cookie' }, body: '' });
ok('带 cookie GET /ziwei/workspace → 200 JSON', (() => {
  try { return r.statusCode === 200 && JSON.parse(r.body).ok === true; } catch (e) { return false; }
})(), `${r.statusCode} ${r.body}`);

/* ================================================================== *
 * 3. 无 connection: fallback fence
 * ================================================================== */
section('3. 无 connection 的 fallback fence');
const { routes: fbRoutes, logs: fbLogs } = makeCtx();

r = await call(fbRoutes, '/ziwei/context', {
  method: 'POST',
  headers: { host: '127.0.0.1:50922', origin: 'https://evil.example', 'content-type': 'application/json' },
  body: '{}'
});
ok('跨站 Origin → 403', r.statusCode === 403 && /来源不可信/.test(r.body), `${r.statusCode} ${r.body}`);

r = await call(fbRoutes, '/ziwei/context', {
  method: 'POST',
  headers: { host: 'evil.example:8080', 'content-type': 'application/json' },
  body: '{}'
});
ok('非 loopback Host → 403', r.statusCode === 403, `${r.statusCode} ${r.body}`);

r = await call(fbRoutes, '/ziwei/context', {
  method: 'POST',
  headers: { host: '127.0.0.1:50922', 'sec-fetch-site': 'cross-site', 'content-type': 'application/json' },
  body: '{}'
});
ok('sec-fetch-site: cross-site → 403', r.statusCode === 403, `${r.statusCode} ${r.body}`);

r = await call(fbRoutes, '/ziwei/workspace', { method: 'GET', headers: { host: '127.0.0.1:50922' }, body: '' });
ok('loopback Host GET /ziwei/workspace → 200', r.statusCode === 200 && JSON.parse(r.body).ok === true, `${r.statusCode} ${r.body}`);

r = await call(fbRoutes, '/ziwei/workspace', { method: 'GET', headers: {}, body: '' });
ok('无 Host 视为本机 → 200', r.statusCode === 200, `${r.statusCode} ${r.body}`);

r = await call(fbRoutes, '/ziwei/context', {
  method: 'POST',
  headers: { host: '127.0.0.1:50922', origin: 'http://127.0.0.1:50922', 'content-type': 'application/json' },
  body: '{}'
});
ok('同源 Origin + loopback Host 放行进入 handler（空盘 → 400）', r.statusCode === 400 && /命盘内容为空/.test(r.body), `${r.statusCode} ${r.body}`);

const fallbackWarns = fbLogs.filter((l) => l.level === 'warn' && /connection/.test(l.msg));
ok('fallback 警告只 warn 一次', fallbackWarns.length === 1, `warn=${fallbackWarns.length} ${JSON.stringify(fallbackWarns)}`);

console.log(`\n${'='.repeat(52)}`);
console.log(`路由守卫自检: ${pass} 通过, ${fail} 失败`);
console.log('='.repeat(52));
process.exit(fail === 0 ? 0 : 1);
