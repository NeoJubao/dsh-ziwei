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

/* ---- 场景 9–12: 模型只思考、不作答（2026-11-20 真机：deepseek-flash 对一句「你好」思考 408 字、正文 0 字） ----
   正常结束但正文为空时，Host 在同一个请求里自动再问一次（最多一次）：末尾加一句「请直接给出回答」，
   模型有思考档位时用最低一档。第二次还是空才报 kind: 'empty'。 */
const scripted = (runs, info) => {
  const calls = [];
  const llm = {
    stream(opts) {
      const chunks = runs[Math.min(calls.length, runs.length - 1)];
      calls.push(opts);
      let i = 0;
      return { [Symbol.asyncIterator]() { return { next: () => Promise.resolve(i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) }; } };
    }
  };
  if (info !== undefined) llm.resolveModelInfo = async () => info;
  const ctx = {
    get(name) {
      if (name === 'llm') return llm;
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'm' }) };
      return undefined;
    }
  };
  return { ctx, calls };
};
const THINK_ONLY = [{ type: 'reasoning-delta', index: 0, text: '用户只是打招呼' }, { type: 'finish', reason: { kind: 'stop' } }];
const ANSWER = [{ type: 'text-delta', index: 0, text: '你好，想看哪方面？' }, { type: 'finish', reason: { kind: 'stop' } }];
const lastText = (opts) => { const m = opts.messages[opts.messages.length - 1]; return m && m.content && m.content[0] ? m.content[0].text : ''; };
{
  const { ctx, calls } = scripted([THINK_ONLY, ANSWER], { defaultMaxTokens: 4096, reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }] } });
  const res = makeRes();
  await withTimeout(handleInterpret(ctx, core, makeReq({ chartText: '命盘X', mode: 'brief', question: '你好' }), res, withBudget(5000)), 8000, '空答重试');
  ok('只思考不作答: 自动再问一次（共 2 次模型调用）', calls.length === 2, 'calls=' + calls.length);
  ok('只思考不作答: 第二次的回答以 done 收尾，没有 error 帧', /event: done/.test(res.body) && /你好，想看哪方面/.test(res.body) && !/event: error/.test(res.body), res.body.slice(-300));
  ok('只思考不作答: 两次之间发一个 retry 帧（旧面板不认识会跳过）', /event: retry/.test(res.body) && res.body.indexOf('event: retry') < res.body.indexOf('event: delta'));
  ok('第一次不带思考档位，第二次用最低一档', calls[0].reasoningEffort === undefined && calls[1] && calls[1].reasoningEffort === 'low', JSON.stringify([calls[0].reasoningEffort, calls[1] && calls[1].reasoningEffort]));
  ok('第二次在末尾加一句「请直接给出回答」，前面的消息原样保留',
    !!calls[1] && calls[1].messages.length === calls[0].messages.length + 1 && /请直接给出回答/.test(lastText(calls[1])) &&
    JSON.stringify(calls[1].messages.slice(0, -1)) === JSON.stringify(calls[0].messages), calls[1] ? lastText(calls[1]) : '');
  ok('done 帧里的正文只有第二次的回答', /"text":"你好，想看哪方面？"/.test(res.body));
}
{
  const { ctx, calls } = scripted([THINK_ONLY, ANSWER]);   /* 没有 resolveModelInfo：不知道档位 */
  const res = makeRes();
  await withTimeout(handleInterpret(ctx, core, makeReq({ chartText: '命盘X', mode: 'brief', question: '你好' }), res, withBudget(5000)), 8000, '空答重试（无档位）');
  ok('模型没有档位信息: 照样重试，第二次不带 reasoningEffort', calls.length === 2 && !('reasoningEffort' in calls[1]) && /event: done/.test(res.body), JSON.stringify(Object.keys(calls[1] || {})));
}
{
  const { ctx, calls } = scripted([THINK_ONLY, THINK_ONLY, ANSWER]);
  const res = makeRes();
  await withTimeout(handleInterpret(ctx, core, makeReq({ chartText: '命盘X', mode: 'brief', question: '你好' }), res, withBudget(5000)), 8000, '两次都空');
  ok('两次都空: 只重试一次（不问第三次）', calls.length === 2, 'calls=' + calls.length);
  ok('两次都空: 报 kind: empty，说明模型只做了思考', /event: error/.test(res.body) && /"kind":"empty"/.test(res.body) && /只做了思考/.test(res.body) && !/event: done/.test(res.body), res.body.slice(-300));
  ok('两次都空: 带上重试过的次数', /"attempts":2/.test(res.body));
}
{
  const NOTHING = [{ type: 'finish', reason: { kind: 'stop' } }];
  const { ctx, calls } = scripted([NOTHING, NOTHING]);
  const res = makeRes();
  await withTimeout(handleInterpret(ctx, core, makeReq(BODY), res, withBudget(5000)), 8000, '什么都没返回');
  ok('连思考都没有的空答: 也重试一次，仍然空就报「模型返回为空」', calls.length === 2 && /"kind":"empty"/.test(res.body) && /模型返回为空/.test(res.body), res.body.slice(-200));
}
{
  /* 写了一半就撞上长度上限、流意外结束：不是空答，不重试 */
  const CAPPED_EMPTY = [{ type: 'reasoning-delta', index: 0, text: '想了很久' }, { type: 'finish', reason: { kind: 'max-tokens' } }];
  const { ctx, calls } = scripted([CAPPED_EMPTY, ANSWER]);
  const res = makeRes();
  await withTimeout(handleInterpret(ctx, core, makeReq(BODY), res, withBudget(5000)), 8000, '上限不重试');
  ok('思考把长度用完（max-tokens）: 不重试，照旧报长度上限', calls.length === 1 && /长度上限/.test(res.body), 'calls=' + calls.length);
}

/* ---- 场景 13: 请求体可以指定模型（面板的模型选择） ---- */
{
  const run = async (model) => {
    const { ctx, calls } = scripted([ANSWER]);
    const res = makeRes();
    await withTimeout(handleInterpret(ctx, core, makeReq(Object.assign({ chartText: '命盘X', mode: 'brief' }, model === undefined ? {} : { model })), res, withBudget(5000)), 8000, '指定模型');
    return { used: calls[0] ? calls[0].provider + '/' + calls[0].model : '', body: res.body };
  };
  const a = await run({ provider: 'px', model: 'mx' });
  ok('请求体带 model: { provider, model } → 用它调用模型，start 帧里也是它', a.used === 'px/mx' && /"provider":"px","model":"mx"/.test(a.body), a.used + ' ' + a.body.slice(0, 120));
  ok('不带 model → 用 DSH 的默认模型', (await run(undefined)).used === 'p/m');
  const bad = [{ provider: 'px' }, { model: 'mx' }, { provider: 1, model: 2 }, { provider: '', model: 'mx' }, 'px/mx', null, { provider: 'x'.repeat(201), model: 'mx' }];
  const got = [];
  for (const b of bad) got.push((await run(b)).used);
  ok('只给一半、不是字符串、空串、超过 200 字：忽略，用默认模型', got.every((u) => u === 'p/m'), JSON.stringify(got));
}

console.log(`\n${'='.repeat(52)}`);
console.log(`SSE 挂起自检: ${pass} 通过, ${fail} 失败`);
console.log('='.repeat(52));
process.exit(fail === 0 ? 0 : 1);
