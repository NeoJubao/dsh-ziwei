/* 诊断日志在自检里关掉，避免往包目录写 interpret-diag.log */
process.env.ZIWEI_DIAG = '0';

/**
 * verify/sse-hang.mjs — SSE 必须对「无视 abort 的挂起流」也能超时解锁
 *
 * 这是第一轮验证发现的缺口：只检查 `signal.aborted` 而不同时与
 * `iterator.next()` 竞态时，上游若不响应 abort，循环会永远停在 await，
 * 超时分支与 finally 都不执行 —— 面板永久停在「解读中」。
 *
 * 本脚本注入一个很短的超时预算，直接驱动真实 handleInterpret。
 *
 * 运行: node verify/sse-hang.mjs
 */
import { EventEmitter } from 'node:events';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};

/* 装载内核（buildRequest 要用） */
const sb = { console };
sb.window = sb; sb.globalThis = sb; sb.self = sb;
const cx = vm.createContext(sb);
new vm.Script(readFileSync(join(root, 'engine-built.js'), 'utf8')).runInContext(cx);
new vm.Script(readFileSync(join(root, 'src', 'ziwei-core.js'), 'utf8')).runInContext(cx);
const core = sb.ZWCore;

const { handleInterpret } = await import(pathToFileURL(join(root, 'index.js')).href + '?v=' + Date.now());

/* 真实的 http 风格 req/res */
const makeRes = () => {
  const res = new EventEmitter();
  res.statusCode = 0;
  res.headers = {};
  res.body = '';
  res.ended = false;
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.write = (s) => { res.body += s; return true; };
  res.end = (s) => { if (s) res.body += s; res.ended = true; res.emit('finish'); return res; };
  res.flushHeaders = () => {};
  return res;
};
const makeReq = (payload) => {
  const req = new EventEmitter();
  req.url = '/ziwei/interpret';
  setTimeout(() => {
    req.emit('data', Buffer.from(JSON.stringify(payload)));
    req.emit('end');
  }, 0);
  return req;
};

const mkCtx = (stream) => ({
  get(name) {
    if (name === 'llm') return { stream };
    if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'm' }) };
    return undefined;
  }
});

const BODY = { chartText: '命盘X', mode: 'brief' };

/* 每个场景都要有上限: 若被测实现真的挂住, 也要继续往下报 ❌ 而不是让进程
   因 "unsettled top-level await" 直接 exit 13（那样一条断言都不会输出）。 */
const withTimeout = (p, ms, label) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`场景超时(${label}, ${ms}ms)`)), ms))
]).catch((e) => { console.log(`  ⚠️  ${e.message}`); });
const withBudget = (ms) => ({ overallMs: ms });

/* ---- 场景 1a: 首帧之前就挂起（还没写过任何 SSE 帧）→ JSON 错误即可 ---- */
{
  let returnCalled = false;
  const hanging = {
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise(() => {}),           // 永不 settle，无视 abort
        return: () => { returnCalled = true; return Promise.resolve({ done: true }); }
      };
    }
  };
  const res = makeRes();
  const t0 = Date.now();
  await withTimeout(handleInterpret(mkCtx(() => hanging), core, makeReq(BODY), res, withBudget(400)), 5000, '首帧前挂起');
  const ms = Date.now() - t0;
  ok('首帧前挂起: 超时后连接被关闭', res.ended === true, `ended=${res.ended}`);
  ok('首帧前挂起: 超时预算内收尾（< 5s）', ms < 5000, `${ms}ms`);
  ok('首帧前挂起: finally 关掉迭代器', returnCalled === true);
  ok('首帧前挂起: 以 JSON 报错（此时还没有 SSE 帧可发）', /解读超时/.test(res.body), res.body.slice(0, 160));
}

/* ---- 场景 1b: 已发过 delta 之后挂起 —— 用户实际会遇到的形态 ---- */
{
  let returnCalled = false;
  const lateHang = {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next: () => (++i === 1
          ? Promise.resolve({ done: false, value: { type: 'text-delta', index: 0, text: '开头' } })
          : new Promise(() => {})),
        return: () => { returnCalled = true; return Promise.resolve({ done: true }); }
      };
    }
  };
  const res = makeRes();
  const t0 = Date.now();
  /* 让第一帧先出去, 再让超时到点 */
  await withTimeout(handleInterpret(mkCtx(() => lateHang), core, makeReq(BODY), res, withBudget(500)), 5000, '已出帧后挂起');
  const ms = Date.now() - t0;
  ok('已出帧后挂起: 不再永久卡住', res.ended === true);
  ok('已出帧后挂起: 发 event: error（SSE 通道）', /event: error/.test(res.body) && /解读超时/.test(res.body), res.body.slice(0, 220));
  ok('已出帧后挂起: 保留已生成部分', /开头/.test(res.body) && /已保留已生成部分/.test(res.body));
  ok('已出帧后挂起: 预算内收尾（< 5s）', ms < 5000, `${ms}ms`);
  ok('已出帧后挂起: 关掉迭代器', returnCalled === true);
}

/* ---- 场景 2: 流响应 abort 但先给了一些 delta ---- */
{
  const partial = {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next: () => {
          i++;
          if (i === 1) return Promise.resolve({ done: false, value: { type: 'text-delta', index: 0, text: '命格总纲：' } });
          return new Promise(() => {});
        },
        return: () => Promise.resolve({ done: true })
      };
    }
  };
  const res = makeRes();
  await withTimeout(handleInterpret(mkCtx(() => partial), core, makeReq(BODY), res, withBudget(400)), 5000, '部分输出后挂起');
  ok('已有 delta 时超时仍保留已生成部分', /命格总纲/.test(res.body) && /已保留已生成部分/.test(res.body), res.body.slice(0, 200));
  ok('上述场景连接被关闭', res.ended === true);
}

/* ---- 场景 3: 客户端中途断开，挂起流也要收尾 ---- */
{
  let returnCalled = false;
  const hanging = {
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise(() => {}),
        return: () => { returnCalled = true; return Promise.resolve({ done: true }); }
      };
    }
  };
  const req = makeReq(BODY);
  const res = makeRes();
  const p = handleInterpret(mkCtx(() => hanging), core, req, res, withBudget(60000));
  setTimeout(() => res.emit('close'), 100);   // 模拟客户端断开
  const t0 = Date.now();
  await withTimeout(p, 5000, '客户端断开');
  const ms = Date.now() - t0;
  ok('客户端断开后挂起流被解锁（不再等满 60s 预算）', ms < 5000, `${ms}ms`);
  ok('断开路径也关掉了迭代器', returnCalled === true);
}

/* ---- 场景 3b: 真实 async generator 挂起 ----
   这是关键补充：普通对象 {next, return} 的 return() 不会被串行在 next() 之后，
   而真实 async generator 会 —— return() 排队在一个永不 settle 的 next() 后面。
   所以必须用真的是 generator 来测，并断言响应真的 end 了。 */
{
  let returnCalled = false;
  const genFactory = () => (async function* () {
    yield { type: 'text-delta', index: 0, text: '开头' };
    await new Promise(() => {});                 // 永不 settle，无视 abort
  })();
  const wrap = {
    [Symbol.asyncIterator]() {
      const it = genFactory()[Symbol.asyncIterator]();
      return {
        next: () => it.next(),
        return: () => { returnCalled = true; return it.return(); }
      };
    }
  };
  const res = makeRes();
  const t0 = Date.now();
  await withTimeout(handleInterpret(mkCtx(() => wrap), core, makeReq(BODY), res, withBudget(500)), 8000, '真实 generator 挂起');
  const ms = Date.now() - t0;
  ok('真实 async generator 挂起: 超时后响应必须已 end（不能只发 error 帧）', res.ended === true,
    `ended=${res.ended} ms=${ms} body=${JSON.stringify(res.body.slice(0, 160))}`);
  ok('真实 async generator 挂起: 预算内收尾（< 5s）', ms < 5000, `${ms}ms`);
  ok('真实 async generator 挂起: 已发 error 帧且保留部分', /event: error/.test(res.body) && /开头/.test(res.body));
  ok('真实 async generator 挂起: return() 被调用', returnCalled === true);
}

/* ---- 场景 4: 正常流不受影响 ---- */
{
  const normal = {
    [Symbol.asyncIterator]() {
      const chunks = [
        { type: 'text-delta', index: 0, text: '甲' },
        { type: 'text-delta', index: 0, text: '乙' },
        { type: 'finish', reason: { kind: 'stop' } }
      ];
      let i = 0;
      return { next: () => Promise.resolve(i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) };
    }
  };
  const res = makeRes();
  await withTimeout(handleInterpret(mkCtx(() => normal), core, makeReq(BODY), res, withBudget(5000)), 8000, '正常流');
  ok('正常流仍以 done 收尾', /event: done/.test(res.body) && /甲乙/.test(res.body), res.body.slice(0, 200));
  ok('正常流没有 error 帧', !/event: error/.test(res.body));
}

/* ---- 场景 5: 命中输出上限 (finish.reason = max-tokens) ----
   这才是用户看到的「输出一半就中断」：思考 token 先吃掉预算，正文撞上限。
   旧实现把 max-tokens 当 stop，发 done，面板于是把半截正文当完整结果。 */
{
  const capped = {
    [Symbol.asyncIterator]() {
      const chunks = [
        { type: 'text-delta', index: 0, text: '命格总纲：' },
        { type: 'finish', reason: { kind: 'max-tokens' } }
      ];
      let i = 0;
      return { next: () => Promise.resolve(i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) };
    }
  };
  const res = makeRes();
  await withTimeout(handleInterpret(mkCtx(() => capped), core, makeReq(BODY), res, withBudget(5000)), 8000, '命中输出上限');
  ok('命中 max-tokens: 发 error 帧而不是 done', /event: error/.test(res.body) && !/event: done/.test(res.body), res.body.slice(-260));
  ok('命中 max-tokens: 说清是长度上限', /长度上限/.test(res.body));
  ok('命中 max-tokens: 允许继续生成', /"canContinue":true/.test(res.body));
  ok('命中 max-tokens: 保留已生成部分', /命格总纲/.test(res.body));
}

/* ---- 场景 6: 流结束但没给 finish 帧 —— 视为不完整，不能当 done ---- */
{
  const broken = {
    [Symbol.asyncIterator]() {
      const chunks = [{ type: 'text-delta', index: 0, text: '半截' }];
      let i = 0;
      return { next: () => Promise.resolve(i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) };
    }
  };
  const res = makeRes();
  await withTimeout(handleInterpret(mkCtx(() => broken), core, makeReq(BODY), res, withBudget(5000)), 8000, '无结束标记');
  ok('无 finish 帧: 发 error 而不当 done', /event: error/.test(res.body) && /意外结束/.test(res.body));
  ok('无 finish 帧: 保留已生成部分', /半截/.test(res.body));
}

/* ---- 场景 7: 首 token 之前就要立通道（start 帧先出） ---- */
{
  const slow = { [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}) }; } };
  const res = makeRes();
  await withTimeout(handleInterpret(mkCtx(() => slow), core, makeReq(BODY), res, withBudget(300)), 5000, '首 token 前');
  ok('首 token 之前就发 start 帧（连接先建立）', /event: start/.test(res.body), res.body.slice(0, 160));
}

/* ---- 场景 8: 思考 delta 透出 thinking 事件（面板显示「思考中」） ---- */
{
  const thinking = {
    [Symbol.asyncIterator]() {
      const chunks = [
        { type: 'reasoning-delta', index: 0, text: '想' },
        { type: 'text-delta', index: 0, text: '答' },
        { type: 'finish', reason: { kind: 'stop' } }
      ];
      let i = 0;
      return { next: () => Promise.resolve(i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) };
    }
  };
  const res = makeRes();
  await withTimeout(handleInterpret(mkCtx(() => thinking), core, makeReq(BODY), res, withBudget(5000)), 8000, '思考事件');
  ok('思考 delta 会发 thinking 事件', /event: thinking/.test(res.body), res.body.slice(0, 200));
  ok('思考之后正常收尾仍是 done', /event: done/.test(res.body));
}

console.log(`\n${'='.repeat(52)}`);
console.log(`SSE 挂起自检: ${pass} 通过, ${fail} 失败`);
console.log('='.repeat(52));
process.exit(fail === 0 ? 0 : 1);
