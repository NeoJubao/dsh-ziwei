/**
 * verify/verify.mjs — 紫微师工作台自检
 *
 * 覆盖:
 *  1. 引擎与 ziwei-core 契约 (黄金用例四断言 / 命盘文本 / 请求组装 / 参数归一化)
 *  2. host 插件 (index.js) 在假 ctx 下的工具注册与执行、SSE 路由、上下文路由
 *  3. 打包产物 (client.js / engine-built.js) 完整性
 *
 * 运行: node verify/verify.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { resolveRunner, runnerMissingHint } from './runner-path.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

/* ================================================================== *
 * 1. 引擎 + 内核
 * ================================================================== */
section('1. 引擎与 ziwei-core');
const sandbox = { console };
sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
const ctxVm = vm.createContext(sandbox);
new vm.Script(readFileSync(join(root, 'engine-built.js'), 'utf8'), { filename: 'engine-built.js' }).runInContext(ctxVm);
new vm.Script(readFileSync(join(root, 'src', 'ziwei-core.js'), 'utf8'), { filename: 'ziwei-core.js' }).runInContext(ctxVm);
const core = sandbox.ZWCore;
const engine = sandbox.ZWEngine;
ok('engine-built.js 挂载 ZWEngine', !!engine && typeof engine.computeChart === 'function');
ok('ziwei-core.js 挂载 ZWCore', !!core && typeof core.paipan === 'function');

const golden = core.goldenCheck();
ok('黄金用例 4/4 断言通过', golden.ok === true, JSON.stringify(golden.failures));
ok('黄金用例: 真太阳时 08:37 / 辰时 / 索引 4',
  golden.actual && golden.actual.solarTime === '08:37' && golden.actual.timeName === '辰时' && golden.actual.timeIndex === 4,
  JSON.stringify(golden.actual));
/* 月柱默认口径：1993-07-17 18:00 男，农历五月廿八（午月），节气已过小暑（未月）。
   八字通行口径应显示 己未；「农历月」选项保留 戊午。命宫/星曜不随该设置变化。 */
{
  const base = { calendar: 'solar', year: 1993, month: 7, day: 17, hour: 18, minute: 0, gender: 'male' };
  const cDefault = engine.computeChart(base);
  const cLunar = engine.computeChart(Object.assign({}, base, { settings: { monthDivide: 'normal' } }));
  ok('月柱默认按节气: 1993-07-17 18:00 → 己未', cDefault.pillars && cDefault.pillars.monthly === '己未', cDefault.pillars && cDefault.pillars.monthly);
  ok('月柱可选农历月: 同一生辰 → 戊午', cLunar.pillars && cLunar.pillars.monthly === '戊午', cLunar.pillars && cLunar.pillars.monthly);
  ok('月柱口径不影响命宫/星曜', cDefault.soulIndex === cLunar.soulIndex &&
    JSON.stringify(cDefault.palaces.map((p) => p.major.map((x) => x.name))) ===
    JSON.stringify(cLunar.palaces.map((p) => p.major.map((x) => x.name))));
}
ok('黄金用例: 命宫丑 · 太阳太阴 · 木三局',
  golden.actual && golden.actual.soulBranch === '丑' && golden.actual.soulMajor.join(',') === '太阳,太阴' && golden.actual.fiveElementsClass === '木三局');

/* 与独立版 run-paipan.js 的输出做交叉核对（若源包存在） */
try {
  const { execFileSync } = await import('node:child_process');
  const runner = resolveRunner();
  if (!runner) throw new Error(runnerMissingHint());
  readFileSync(runner);
  const raw = execFileSync('node', [runner, '1992-05-03', '09:30', '男', '105.97'], { encoding: 'utf8' });
  const ref = JSON.parse(raw);
  const mine = core.paipan({ date: '1992-05-03', time: '09:30', gender: 'male', longitude: 105.97 }).chart;
  const refByPalace = {};
  ref.十二宫.forEach((p) => { refByPalace[p.宫] = p; });
  let mismatch = [];
  if (ref.校正.校正后真太阳时 !== mine.meta.solarCorrection.solarTime) mismatch.push('真太阳时');
  if (ref.时辰索引 !== mine.timeIndex) mismatch.push('时辰索引');
  if (ref.五行局 !== mine.fiveElementsClass) mismatch.push('五行局');
  if (ref.命宫地支 !== mine.soulBranch) mismatch.push('命宫地支');
  if (ref.命主 !== mine.soulMaster) mismatch.push('命主');
  if (ref.身主 !== mine.bodyMaster) mismatch.push('身主');
  for (const p of mine.palaces) {
    const rp = refByPalace[p.name];
    if (!rp) { mismatch.push('缺宫 ' + p.name); continue; }
    const a = (rp.主星 || []).map((s) => s.replace(/[（(].*$/, '')).sort().join(',');
    const b = (p.major || []).map((s) => s.name).sort().join(',');
    if (a !== b) mismatch.push(p.name + ' 主星 runner[' + a + '] vs workbench[' + b + ']');
  }
  ok('与独立版 run-paipan.js 逐字段一致（含十二宫主星）', mismatch.length === 0, mismatch.join('; '));
} catch (e) {
  console.log(`  ⚠️  跳过 run-paipan.js 交叉核对: ${String(e.message).split('\n')[0]}`);
}

/* 缺时间必须报错而不是静默任选 */
const noTime = core.paipan({ date: '1992-05-03', gender: 'male' });
ok('缺出生时间 → 拒绝排盘并提示追问', noTime.ok === false && /钟表时间/.test(noTime.error), noTime.error);
const badLon = core.paipan({ date: '1992-05-03', time: '09:30', gender: 'male', longitude: 5 });
ok('经度越界 → 拒绝', badLon.ok === false && /经度/.test(badLon.error), badLon.error);
const badDate = core.paipan({ date: '1992-02-31', time: '09:30', gender: 'male' });
ok('非法日期(2/31) → 拒绝', badDate.ok === false, JSON.stringify(badDate));
const noLon = core.paipan({ date: '1992-05-03', time: '09:30', gender: 'male' });
ok('无经度 → 不校正但可排盘', noLon.ok === true && !noLon.chart.meta.solarCorrection);
const lunarIn = core.paipan({ calendar: 'lunar', date: '1992-04-01', time: '09:30', gender: 'male', longitude: 105.97 });
ok('农历输入 → 与阳历输入同一张盘', lunarIn.ok === true && lunarIn.chart.solarDate === '1992-05-03', lunarIn.ok ? lunarIn.chart.solarDate : lunarIn.error);

const ch = core.paipan({ date: '1992-05-03', time: '09:30', gender: 'male', longitude: 105.97 }).chart;
const full = core.fullChartText(ch);
ok('fullChartText 含逐宫与四化', /十二宫主星与辅星/.test(full) && /四化落宫/.test(full) && /命宫\(癸丑/.test(full));
ok('人设含九诀/14部分/红线/免责', /意象解盘九诀/.test(core.PERSONA) && /鲲鹏报告 14 部分/.test(core.PERSONA) && /不预测寿命/.test(core.PERSONA) && /免责声明/.test(core.PERSONA));

const reqBrief = core.buildRequest({ chart: ch, mode: 'brief', question: '重点讲事业', meta: { name: '张三' }, history: [{ role: 'user', content: '在吗' }, { role: 'assistant', content: '在' }] });
ok('buildRequest(brief): 历史 + 追问都进 messages',
  reqBrief.messages.length === 4 && reqBrief.messages[0].role === 'user' && reqBrief.messages[1].role === 'user' && reqBrief.messages[3].content === '重点讲事业');
ok('buildRequest(brief): 有具体问题时走定向问答，不再套固定五段式',
  /定向问答/.test(reqBrief.system) && /直接回答用户这一次的问题/.test(reqBrief.system) && !/一、命格总纲/.test(reqBrief.system));
/* “这 10 年大运”类问题：必须给全 12 段大限 + 当前定位，并进入聚焦回答 */
{
  const ch2 = core.paipan({ calendar: 'lunar', date: '1990-05-23', time: '15:30', gender: 'male' }).chart;
  const fullAll = core.fullChartText(ch2, { currentAge: 37, currentYear: 2026 });
  ok('fullChartText: 十二大限全量（含 115–124 段，不再只给前 6 段）',
    /十二大限（按虚岁升序，全部 12 段）/.test(fullAll) && /115–124 虚岁/.test(fullAll));
  ok('fullChartText: 当前定位含大限段位/宫位/四化与流年',
    /当前大限：35–44 虚岁/.test(fullAll) && /大限命宫落本命「田宅」宫/.test(fullAll) &&
    /大限四化：武曲化禄（迁移）/.test(fullAll) && /流年 2026：丙午/.test(fullAll));
  const reqDec = core.buildRequest({ chart: ch2, mode: 'brief', question: '这 10 年大运如何？', meta: { currentAge: 37, currentYear: 2026 } });
  ok('大限问题 → user message 带当前定位 + 本轮聚焦', /35–44/.test(reqDec.messages[0].content) && /【本轮聚焦】/.test(reqDec.messages[0].content));
  const reqYear = core.buildRequest({ chart: ch2, mode: 'brief', question: '2035 年流年怎么样', meta: { currentAge: 37, currentYear: 2026, yearlyFocus: 2035 } });
  ok('流年问题 → user message 带年份聚焦 + 流年定位', /2035 年流年/.test(reqYear.messages[0].content) && /流年 2026|流年 2035/.test(reqYear.messages[0].content));
  ok('大限/流年聚焦互斥（流年问题不误判成大限）', !/用户问的是大限/.test(reqYear.messages[0].content));
  const reqSel = core.buildRequest({ chart: ch2, mode: 'brief', question: '这步运怎么样', meta: { currentAge: 37, currentYear: 2026, decadalFocus: [45, 54] } });
  ok('面板选中大限优先于自动定位', /选中的大限是 45–54/.test(reqSel.messages[0].content));
  const reqPlain = core.buildRequest({ chart: ch2, mode: 'brief' });
  ok('无问题且无当前定位时，仍保留速览五段式', /一、命格总纲/.test(reqPlain.system));
}

const reqReport = core.buildRequest({ chart: ch, mode: 'report' });
ok('buildRequest(report): system 含 14 部分与自检清单', /鲲鹏报告/.test(reqReport.system) && /交付前自检/.test(reqReport.system));

/* ================================================================== *
 * 2. host 插件
 * ================================================================== */
section('2. host 插件 (index.js)');
const registered = new Map();
const routes = new Map();
const promptSections = [];
const effects = [];
const logs = [];

const fakeCtx = {
  get(name) {
    if (name === 'tools') return { register: (d) => { registered.set(d.name, d); return () => registered.delete(d.name); } };
    if (name === 'systemPrompt') return {
      section: (s) => { promptSections.push(s); return () => {}; },
      getSectionOrder: () => 2900
    };
    if (name === 'webServer') return { register: (r) => { routes.set(r.path, r); return () => routes.delete(r.path); } };
    if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }) };
    if (name === 'llm') return {
      stream: () => (async function* () {
        yield { type: 'text-delta', index: 0, text: '命格总纲' };
        yield { type: 'text-delta', index: 0, text: '：太阳太阴坐命。' };
        yield { type: 'finish', reason: { kind: 'stop' } };
      })()
    };
    return undefined;
  },
  effect: (fn) => { effects.push(fn); return () => {}; },
  on: () => () => {},
  logger: { warn: (m) => logs.push(m) }
};

const plugin = await import(pathToFileURL(join(root, 'index.js')).href + '?v=' + Date.now());
plugin.apply(fakeCtx);

ok('注册 4 个工具', registered.size === 4 && ['ziwei_paipan', 'ziwei_check', 'ziwei_context', 'ziwei_templates'].every((n) => registered.has(n)),
  [...registered.keys()].join(','));
ok('注册 /ziwei/interpret 与 /ziwei/context', routes.has('/ziwei/interpret') && routes.has('/ziwei/context'));
ok('注册 systemPrompt 段落并声明铁律', promptSections.length === 1 && /排盘的唯一来源/.test(promptSections[0].text) && /绝不手工排盘/.test(promptSections[0].text));
ok('注册过程无警告', logs.length === 0, logs.join(' | '));

const paipanTool = registered.get('ziwei_paipan');
ok('ziwei_paipan 参数为 JSON Schema 且 required 三项',
  paipanTool.parameters.type === 'object' && Array.isArray(paipanTool.parameters.required) && paipanTool.parameters.required.length === 3);
ok('ziwei_paipan 声明 output.schema 与 render', !!paipanTool.output && !!paipanTool.output.schema && typeof paipanTool.output.render === 'function');

/* output.schema 的 type 必须是 dsh-tools 认识的类型（json 不在其列，会让 register 抛错） */
{
  const ALLOWED = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);
  const bad = [];
  for (const [n, d] of registered) {
    const t = d.output && d.output.schema && d.output.schema.type;
    if (t !== undefined && !ALLOWED.has(t)) bad.push(n + ':' + JSON.stringify(t));
  }
  ok('所有 output.schema.type 都在 dsh-tools 支持集内', bad.length === 0, bad.join(', '));
}

/* 工具缺参必须拒绝: 手工构造的定义绕过 defineTool 校验, 插件要自己兜 */
{
  const req = registered.get('ziwei_paipan');
  const callFails = async (args, pat) => {
    try { await req.execute(args, {}); return false; }
    catch (e) { return pat.test(String(e && e.message)); }
  };
  const r1 = await callFails({ date: '1992-05-03', time: '09:30' }, /gender/);
  const r2 = await callFails({ date: '1992-05-03', time: '09:30', gender: 'x' }, /gender/);
  ok('ziwei_paipan 缺/错 gender 一律拒绝（不静默按男命）', r1 && r2, 'missing=' + r1 + ' invalid=' + r2);
}
ok('ziwei_paipan 可通过 JSON 序列化（会进入 ToolSchema）', (() => {
  try { JSON.parse(JSON.stringify({ name: paipanTool.name, description: paipanTool.description, parameters: paipanTool.parameters })); return true; } catch (e) { return false; }
})());

const ctxBefore = await registered.get('ziwei_context').execute({}, {});
ok('ziwei_context 无上下文时给出可操作提示', /还没有命盘上下文/.test(ctxBefore.text));

const p1 = await paipanTool.execute({ date: '1992-05-03', time: '09:30', gender: 'male', longitude: 105.97 }, {});
ok('ziwei_paipan 执行: 返回命盘文本 + 关键字段',
  /辰时/.test(p1.text) && /真太阳时：08:37/.test(p1.text) && p1.fiveElementsClass === '木三局' && p1.soulBranch === '丑' && p1.corrected === true);
ok('ziwei_paipan 返回十二大限 + 当前定位（agent 问“这十年”有据可依）',
  /十二大限（按虚岁升序，全部 12 段）/.test(p1.text) && /【当前定位】/.test(p1.text) &&
  new RegExp('流年 ' + new Date().getFullYear() + '：').test(p1.text));
ok('ziwei_paipan render 返回文本块', (() => {
  const blocks = paipanTool.output.render({}, p1);
  return Array.isArray(blocks) && blocks.length === 1 && blocks[0].type === 'text' && blocks[0].text === p1.text;
})());

const pBad = await Promise.resolve()
  .then(() => paipanTool.execute({ date: '1992-05-03', time: '25:00', gender: 'male' }, {}))
  .then(() => null, (e) => e);
ok('ziwei_paipan 非法输入 → 抛出可读错误（不静默排盘）', !!pBad && /失败/.test(pBad.message) && /严禁手工排盘/.test(pBad.message), pBad && pBad.message);

const checkRes = await registered.get('ziwei_check').execute({}, {});
ok('ziwei_check 报告 4/4 通过', /4\/4/.test(checkRes.text) && checkRes.ok === true);

const tmpl = await registered.get('ziwei_templates').execute({}, {});
ok('ziwei_templates 给出九诀 + 14 部分 + 免责', /意象解盘九诀/.test(tmpl.text) && /鲲鹏报告 14 部分/.test(tmpl.text) && /非现代科学结论/.test(tmpl.text));

const ctxFromTool = await registered.get('ziwei_context').execute({}, {});
ok('ziwei_paipan 之后 ziwei_context 能读到本会话命盘', /本进程内 ziwei_paipan 排盘/.test(ctxFromTool.text) && /辰时/.test(ctxFromTool.text));

/* /ziwei/context 路由写入上下文 → ziwei_context 读到 */
const fakeRes = () => {
  const r = new EventEmitter();
  r.statusCode = 0; r.headers = {}; r.body = '';
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.write = (s) => { r.body += s; return true; };
  r.end = (s) => { if (s) r.body += s; r.emit('finish'); };
  r.flushHeaders = () => {};
  return r;
};
const fakeReq = (payload, options) => {
  const r = new EventEmitter();
  r.url = '/ziwei/context';
  /* A3 守卫要求: 写路由 POST + application/json；带 loopback Host 走 fallback fence */
  r.method = (options && options.method) || 'POST';
  r.headers = Object.assign({ 'content-type': 'application/json', host: '127.0.0.1:50922' }, (options && options.headers) || {});
  setTimeout(() => {
    r.emit('data', Buffer.from(JSON.stringify(payload)));
    r.emit('end');
  }, 0);
  return r;
};

const cRes = fakeRes();
await routes.get('/ziwei/context').handler(fakeReq({ chartText: '命盘X', fullText: '完整命盘X', name: '李四', interpretation: '面板解读Y' }), cRes);
ok('/ziwei/context 返回 ok', cRes.statusCode === 200 && JSON.parse(cRes.body).ok === true, cRes.body);
const ctxAfter = await registered.get('ziwei_context').execute({}, {});
ok('ziwei_context 读到面板命盘(面板优先)', /完整命盘X/.test(ctxAfter.text) && /李四/.test(ctxAfter.text) && /工作台面板/.test(ctxAfter.text));
const cEmpty = fakeRes();
await routes.get('/ziwei/context').handler(fakeReq({ chartText: '' }), cEmpty);
ok('/ziwei/context 空命盘 → 400', cEmpty.statusCode === 400);
const ctxWithInterp = await registered.get('ziwei_context').execute({}, {});
ok('ziwei_context 带出面板已给出的解读', /面板解读Y/.test(ctxWithInterp.text) && /不要重复/.test(ctxWithInterp.text));

/* /ziwei/interpret SSE */
const iRes = fakeRes();
await routes.get('/ziwei/interpret').handler(fakeReq({ chartText: '命盘X', mode: 'brief', question: '事业' }), iRes);
ok('/ziwei/interpret 返回 SSE 头', /text\/event-stream/.test(iRes.headers['content-type'] || ''), JSON.stringify(iRes.headers));
ok('/ziwei/interpret 流式输出 delta 与 done',
  /event: delta/.test(iRes.body) && /命格总纲/.test(iRes.body) && /event: done/.test(iRes.body), iRes.body.slice(0, 200));

const iEmpty = fakeRes();
await routes.get('/ziwei/interpret').handler(fakeReq({ chartText: '' }), iEmpty);
ok('/ziwei/interpret 空命盘 → 400 JSON', iEmpty.statusCode === 400 && /命盘内容为空/.test(iEmpty.body));

/* /ziwei/handoff：无 sessionController → 503 并给出可操作退路 */
const hRes = fakeRes();
await routes.get('/ziwei/handoff').handler(fakeReq({ chartText: '命盘X', mode: 'report' }), hRes);
ok('/ziwei/handoff 无 sessionController → 503 + 退路提示',
  hRes.statusCode === 503 && /无法自动开会话/.test(hRes.body) && /ziwei_context|读取工作台命盘/.test(hRes.body), hRes.body);
const hEmpty = fakeRes();
await routes.get('/ziwei/handoff').handler(fakeReq({ chartText: '' }), hEmpty);
ok('/ziwei/handoff 空命盘 → 400', hEmpty.statusCode === 400, hEmpty.body);

/* /ziwei/handoff：有 sessionController → 真的开会话并灌首条消息 */
const routes3 = new Map();
const created = [];
let prompted = null;
plugin.apply({
  get(name) {
    if (name === 'webServer') return { register: (r) => { routes3.set(r.path, r); return () => {}; } };
    if (name === 'sessionController') return {
      create: async (target) => { created.push(target); return { sessionId: 'sess-ziwei-1' }; },
      prompt: async (request) => { prompted = request; return { accepted: true }; }
    };
    if (name === 'workspaceRegistry') return { resolveByPath: async () => ({ id: 'ws-1' }) };
    return undefined;
  },
  effect: () => () => {},
  logger: { warn: () => {} }
});
const h2 = fakeRes();
await routes3.get('/ziwei/handoff').handler(fakeReq({ chartText: '命盘Y', fullText: '完整命盘Y', name: '王五', cwd: '/tmp/ws', mode: 'report' }), h2);
const h2j = JSON.parse(h2.body);
ok('/ziwei/handoff 开会话 → 返回 sessionId', h2j.ok === true && h2j.sessionId === 'sess-ziwei-1', h2.body);
ok('/ziwei/handoff 落到 cwd 所属工作区', created.length === 1 && created[0].workspaceId === 'ws-1', JSON.stringify(created));
ok('/ziwei/handoff 用 queue 模式灌入首条消息',
  !!prompted && prompted.mode === 'queue' && prompted.sessionId === 'sess-ziwei-1' && Array.isArray(prompted.content) && prompted.content[0].type === 'text',
  JSON.stringify(prompted && { mode: prompted.mode, sessionId: prompted.sessionId }));
ok('/ziwei/handoff 首条消息带命盘 + 工具指引 + 免责要求',
  !!prompted && /完整命盘Y/.test(prompted.content[0].text) && /ziwei_check/.test(prompted.content[0].text) && /ziwei_templates/.test(prompted.content[0].text) && /免责声明/.test(prompted.content[0].text) && /王五/.test(prompted.content[0].text));
ok('/ziwei/handoff requestId 非空且为字符串', !!prompted && typeof prompted.requestId === 'string' && prompted.requestId.length > 0);

/* 无 llm 服务时明确报错 */
const routes2 = new Map();
plugin.apply({
  get(name) {
    if (name === 'tools') return undefined;
    if (name === 'systemPrompt') return undefined;
    if (name === 'webServer') return { register: (r) => { routes2.set(r.path, r); return () => {}; } };
    if (name === 'llm') return undefined;
    return undefined;
  },
  effect: () => () => {},
  logger: { warn: () => {} }
});
const nRes = fakeRes();
await routes2.get('/ziwei/interpret').handler(fakeReq({ chartText: 'x' }), nRes);
ok('无 llm 服务 → 503 且不崩溃', nRes.statusCode === 503 && /llm 服务不可用/.test(nRes.body), nRes.body);

/* ================================================================== *
 * 3. 打包产物
 * ================================================================== */
section('3. 打包产物');
const client = readFileSync(join(root, 'client.js'), 'utf8');
ok('client.js 含引擎 + 内核 + UI', /ZWEngine/.test(client) && /ZWCore/.test(client) && /__ModuleLoader__/.test(client));
ok('client.js 不再直连 api.deepseek.com', !/api\.deepseek\.com/.test(client));
ok('client.js 走 host 通道（interpret + context + handoff，三条都有入口）',
  /\/ziwei\/interpret/.test(client) && /\/ziwei\/context/.test(client) && /\/ziwei\/handoff/.test(client) && /syncToSession/.test(client));
ok('client.js 不再引用已删除的 interpretChart', !/interpretChart/.test(client));
ok('client.js 含新 UI 文案与组件', /zp-chat-thread/.test(client) && /交给会话/.test(client));
/* P0-2: 旧版浏览器明文 API Key 必须消失（只保留升级清理逻辑） */
ok('client 不再持久化 API Key（已无消费方）',
  !/localStorage\.setItem\('ziwei-workbench\.apikey'/.test(client) && !/type: 'password'/.test(client) && /removeItem\('ziwei-workbench\.apikey'\)/.test(client));
/* P1-1: 可见文案必须走官方 Client locale 服务（register + bind），不再读私有 tr.i18n */
/* v1.3.3: 旧持久化表单的一次性月柱口径迁移 */
ok('v1.3.3: localStorage 旧默认一次性迁移到节气',
  /ziwei-pro\.formV133/.test(client) && /monthDivide === 'normal'/.test(client) &&
  /JSON\.stringify\(init\)/.test(client));

/* v3.1: 深色白字填充专用色（对比度 ≥4.5）与 mid 详情/窄屏头部微调 */
ok('v3.1: 深色白字填充走 --zp-fill-accent*（不再拿亮 accent 配白字）',
  /--zp-fill-accent: #7c5cf0/.test(client) && /--zp-fill-accent: #6a4fe0/.test(client) &&
  /--zp-fill-accent-deep: #5840c0/.test(client) && /var\(--zp-fill-accent\)/.test(client));
ok('v3.1: mid/窄档详情卡 max-width 760 居中 + 窄屏头部命主摘要',
  /:not\(\[data-w="wide"\]\) \.zp-detail \{[^}]*max-width: 760px/.test(client) && /zp-head-mini/.test(client));
/* v3.1: 侧栏展开时面板 ~908–1071，必须有 compact 两栏，不能掉进单列把中栏拉满 */
ok('v3.1: 四档布局含 compact（908 起两栏，264+600），防止侧栏展开时中栏被拉成单列',
  /panelW >= 908/.test(client) && /data-w="compact"/.test(client) &&
  /data-w="compact"[^}]*grid-template-columns:\s*264px/.test(client) &&
  /data-w="compact"[^}]*--zp-board-max:\s*600px/.test(client));
/* v3 布局：时间维度导航、左栏收起、工具视图、窄屏底栏 —— 防回退成「列表堆在盘上」 */
ok('v3: 时间维度导航常驻 TimeBar（模式分段 + 大限/流年步进 + 回到当前）',
  /zp-timebar/.test(client) && /zp-time-nav/.test(client) && /backToCurrent/.test(client) && /thisYear/.test(client));
ok('v3: 十二大限列表/流年输入不再压在盘面上方（旧组件已移除）',
  !/function DecadalPanel/.test(client) && !/function YearlyBar/.test(client) && !/className: 'zp-stage-bar'/.test(client));
ok('v3: 左栏可收起（rail toggle + data-rail），窄屏有底部行动条',
  /'data-rail': railVisible/.test(client) && /zp-rail-toggle/.test(client) && /zp-bottombar/.test(client));
ok('v3: 格局/词典移到 TimeBar 工具区，有返回盘面出口',
  /openPatterns/.test(client) && /openDict/.test(client) && /backToBoard/.test(client));
ok('v3: 有盘时排盘降级为次按钮（唯一主行动 = 紫微师解读）',
  /className: 'zp-btn' \+ \(props\.hasChart \? '' : ' zp-btn-primary'\)/.test(client));
ok('client 大限默认停在当前段（不是第 0 段）且流年选择进 payload',
  /function currentDecadeIndex|var currentDecadeIndex = function/.test(client) && /setSelDecadal\(currentDecadeIndex\(result\.chart\)\)/.test(client) && /yearlyFocus:/.test(client));
ok('client 问答 payload 带完整上下文与当前年龄（大限定位）',
  /var chartContextText = function/.test(client) && /chartText: chartContextText\(\)/.test(client) &&
  /currentAge: pos\.currentAge/.test(client) && /decadalFocus: selectedDecade/.test(client));
ok('client 走官方 locale 服务（register + bind，不再读 tr.i18n）',
  /locale\.register\('ziwei'/.test(client) && /locale\.bind\('ziwei'\)/.test(client) && !/\.i18n\[0\]/.test(client));
/* P2-8 / a11y 回归：流式区 aria-live、分段控件 aria-pressed、图标出口 aria-label、预览 iframe title+sandbox */
ok('client 可访问性契约在位（aria-live / aria-pressed / iframe title+sandbox）',
  /role: 'log'/.test(client) && /'aria-live': 'polite'/.test(client) && /'aria-pressed':/.test(client) && /title: t\('previewHtml'\)/.test(client) && /sandbox: 'allow-same-origin'/.test(client));
ok('engine-built.js 与内核解耦（不含 UI）', !/__ModuleLoader__/.test(readFileSync(join(root, 'engine-built.js'), 'utf8')));

/* H2: 构建产物新鲜度 —— 改了 src 忘记 build、或产物被手改, 都必须报错。
   产物形态 = 懒加载内核头 + engine-built + ziwei-core + 头尾闭合 + ui-pro（见 build.mjs）。 */
{
  const eng = readFileSync(join(root, 'engine-built.js'), 'utf8');
  const zc = readFileSync(join(root, 'src', 'ziwei-core.js'), 'utf8');
  const ui = readFileSync(join(root, 'src', 'ui-pro.js'), 'utf8');
  const headEnd = client.indexOf(eng);
  const tailStart = headEnd + eng.length + 1 + zc.length;
  const fresh = headEnd > 0
    && client.slice(0, headEnd).includes('function __ziweiBootstrapKernel()')
    && client.slice(tailStart).startsWith('\n}\n')
    && client.endsWith(ui);
  ok('client.js = 懒加载内核包装 + engine-built + ziwei-core + ui-pro（产物未过期）', fresh);
  ok('engine-built.js 已注入农历数据（无占位符残留）',
    !/\/\*__LUNAR_INFO__\*\//.test(eng) && !/\/\*__LTERM_INFO__\*\//.test(eng) && /lunarInfo|LUNAR_INFO/.test(eng));
}

/* H1: 面板默认口径必须进产物 —— 只改 src/ui-pro.js 而忘记 build 会静默漏掉 */
ok('autoOpen 默认关闭（不劫持主面板；用户可在设置里开启）',
  /localStorage\.getItem\('ziwei-pro\.autopen'\) === '1'/.test(client) && !/getItem\('ziwei-pro\.autopen'\) !== '0'/.test(client));
ok('面板默认 dayDivide = current（与紫微师口径一致）',
  /settings: \{ yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true \}/.test(client));

/* 引擎默认口径必须进产物 */
ok('引擎默认 dayDivide = current', /dayDivide: 'current'/.test(readFileSync(join(root, 'engine-built.js'), 'utf8')));

/* H3: 窗口 chrome 避让 + 面板出口 —— 侧栏折叠后不能把用户困在面板里。
 * 背景（官方源码 dsh-client-ui-layout/lib/client.js）:
 *   - darwin 下 sidebar 整列隐藏时, frame 才挂 shell.leading（展开侧栏/新会话控件, z-index:15）,
 *     同时发布 --dsh-frame-leading-clearance; html 上另有 --dsh-frame-top-clearance,
 *     浮层用 --dsh-frame-overlay-top;
 *   - 本面板的 sticky 头 z-index:20 曾直接盖住 z-index:15 的 shell.leading,
 *     且面板没有返回会话的出口 → 用户被困。三条断言一起防回归。 */
ok('面板避让 darwin 窗口 chrome（top / leading / overlay 三个 frame 变量都带 0px 兜底）',
  /html\[data-platform="darwin"\] \.zp-root \{\s*padding-top: var\(--dsh-frame-top-clearance, 0px\)/.test(client) &&
  /html\[data-platform="darwin"\] \[data-sidebar-collapsed\] \.zp-head \{[\s\S]{0,200}?var\(--dsh-frame-leading-clearance, 0px\)/.test(client) &&
  /html\[data-platform="darwin"\] \.zp-root \.zp-overlay-center \{[\s\S]{0,200}?var\(--dsh-frame-overlay-top, 46px\)/.test(client));
ok('面板层叠收进自身上下文（内部 z-index 不再盖住 frame 的 shell.leading 出口）',
  /\.zp-root \{[\s\S]{0,2000}?isolation: isolate;/.test(client));
ok('client 提供「返回会话」出口：官方 selectPanel(null) + title/aria-label（键盘可达）',
  /selectPanel\(null\)/.test(client) &&
  /className: 'zp-icon-btn zp-exit', type: 'button'/.test(client) &&
  /title: t\('backToConversation'\), 'aria-label': t\('backToConversation'\)/.test(client));
ok('chrome 避让不用魔法数字写死（顶部偏移只走 --dsh-frame-top-clearance）',
  !/padding-top: ?48px/.test(client) && /--dsh-frame-top-clearance/.test(client));

/* 真正把 client.js 跑一遍: 假 ModuleLoader + 极简 React, 确保 factory/apply 不抛错 */
{
  class Component {
    constructor(props) { this.props = props || {}; this.state = {}; this.context = null; }
    setState() {}
    componentDidCatch() {}
    render() { return null; }
  }
  const React = {
    Component,
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (init) => ({ current: init })
  };
  const injections = [];
  const registrations = [];
  const fakeCtx = {
    get: () => undefined,
    slots: {
      inject: (key, cb) => { injections.push(key); cb(); return { dispose() {} }; },
      register: (def, comp) => { registrations.push(def); return { dispose() {} }; }
    },
    effect: () => () => {},
    logger: { warn: () => {} }
  };
  const win = {
    React,
    __ModuleLoader__: { load: (entry) => { registrations.push(entry); } },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  const stubEl = { textContent: '', parentNode: null, appendChild() {}, removeChild() {} };
  const sandbox2 = {
    console, TextEncoder, TextDecoder,
    document: { createElement: () => stubEl, head: { appendChild() {} } }
  };
  sandbox2.window = win;
  sandbox2.globalThis = sandbox2;
  sandbox2.self = sandbox2;
  sandbox2.React = React;
  sandbox2.document = sandbox2.document;
  const c2 = vm.createContext(sandbox2);

  let loadErr = null;
  try {
    new vm.Script(readFileSync(join(root, 'client.js'), 'utf8'), { filename: 'client.js' }).runInContext(c2);
  } catch (e) { loadErr = e; }
  ok('client.js 可完整求值（引擎+内核+UI 无语法/引用错误）', loadErr === null, loadErr && loadErr.message);
  ok('client.js 加载期不执行引擎（懒加载内核，加载只注册 factory）',
    !win.ZWEngine && !win.ZWCore && /function __ziweiBootstrapKernel/.test(client));

  const entry = registrations.find((r) => r && r.id);
  ok('client.js 以 @local/ziwei-workbench 注册', !!entry && entry.id === '@local/ziwei-workbench', entry && entry.id);

  let factoryErr = null, pluginObj = null;
  try { pluginObj = entry.factory(() => React); } catch (e) { factoryErr = e; }
  ok('client factory 首次物化时求值内核（ZWEngine / ZWCore 就绪）',
    factoryErr === null && !!win.ZWEngine && !!win.ZWCore);
  ok('client factory 执行成功且暴露 inject/apply',
    factoryErr === null && pluginObj && typeof pluginObj.apply === 'function',
    factoryErr ? factoryErr.message : JSON.stringify(pluginObj && Object.keys(pluginObj)));
  ok('client 声明注入 slots/sessions/uiWorkspace',
    !!pluginObj && Array.isArray(pluginObj.inject) && pluginObj.inject.includes('slots') && pluginObj.inject.includes('uiWorkspace'),
    pluginObj && JSON.stringify(pluginObj.inject));

  let applyErr = null;
  try { pluginObj.apply(fakeCtx); } catch (e) { applyErr = e; }
  ok('client apply() 不抛错（<style> 注入与资源清理可用）', applyErr === null, applyErr && applyErr.message);
  ok('client apply() 注册 sidebar.panellist 与 main',
    injections.includes('sidebar.panellist') && injections.includes('main'), injections.join(','));
  const panelReg = registrations.filter((r) => r && !r.id).map((r) => r.key || r.name);
  ok('client 主面板 key=ziwei', panelReg.includes('ziwei'), JSON.stringify(panelReg));

  /* H3 动态: 布局服务可用时, 主面板必须真的能通过官方 API 回到 Conversation。
   * 用第二次 apply 注入一个假 layout, 从 main 注册项里取出 ProApp 的 actions 调用。 */
  {
    const fakeLayout = { calls: [], selectPanel(id) { this.calls.push(id); } };
    const regs2 = [];
    const fakeCtx2 = {
      get: (name) => (name === 'layout' ? fakeLayout : undefined),
      slots: {
        inject: (key, cb) => { cb(); return { dispose() {} }; },
        register: (def, comp) => { regs2.push([def, comp]); return { dispose() {} }; }
      },
      effect: () => () => {},
      logger: { warn: () => {} }
    };
    let apply2Err = null;
    try { pluginObj.apply(fakeCtx2); } catch (e) { apply2Err = e; }
    ok('client apply() 在 layout 服务可用时不抛错', apply2Err === null, apply2Err && apply2Err.message);
    const main = regs2.find(([d]) => d && d.name === 'main' && d.key === 'ziwei');
    let actions2 = null, renderErr = null;
    try {
      const tree = main[1]();
      actions2 = tree.children[0].props.actions;
    } catch (e) { renderErr = e; }
    ok('主面板 actions 暴露「返回会话」出口（layout 可用时）',
      renderErr === null && !!actions2 && actions2.canReturnToConversation === true && typeof actions2.returnToConversation === 'function',
      renderErr ? renderErr.message : JSON.stringify(actions2 && Object.keys(actions2)));
    let exitOk = false;
    try { exitOk = actions2.returnToConversation() === true; } catch (e) { exitOk = false; }
    ok('出口调用官方 layout.selectPanel(null)（选中 Conversation, 不换 Session）',
      exitOk && fakeLayout.calls.length === 1 && fakeLayout.calls[0] === null, JSON.stringify(fakeLayout.calls));

    /* 渲染级: 主面板顶栏真的渲染出「返回会话」按钮（图标 + title + aria-label） */
    const collectExitButtons = (node, hits = []) => {
      if (!node || typeof node !== 'object') return hits;
      if (node.props && typeof node.props.className === 'string' &&
        node.props.className.split(/\s+/).includes('zp-exit')) hits.push(node);
      for (const child of node.children || []) collectExitButtons(child, hits);
      return hits;
    };
    let exitBtn = null, render2Err = null;
    try {
      const boundaryEl = main[1]();
      const proAppEl = boundaryEl.children[0];
      const hits = collectExitButtons(proAppEl.type(proAppEl.props));
      if (hits.length === 1) exitBtn = hits[0];
    } catch (e) { render2Err = e; }
    ok('主面板顶栏渲染出唯一的「返回会话」按钮（图标 + title + aria-label）',
      render2Err === null && !!exitBtn && exitBtn.props.type === 'button' &&
      exitBtn.props.title === '返回会话' && exitBtn.props['aria-label'] === '返回会话',
      render2Err ? render2Err.message : JSON.stringify(exitBtn && exitBtn.props));
  }

  /* H3 动态（降级）: layout 不可用时按钮不渲染, 面板其余渲染不受影响 */
  {
    const regs3 = [];
    const fakeCtx3 = {
      get: () => undefined,
      slots: {
        inject: (key, cb) => { cb(); return { dispose() {} }; },
        register: (def, comp) => { regs3.push([def, comp]); return { dispose() {} }; }
      },
      effect: () => () => {},
      logger: { warn: () => {} }
    };
    let apply3Err = null;
    try { pluginObj.apply(fakeCtx3); } catch (e) { apply3Err = e; }
    const main3 = regs3.find(([d]) => d && d.name === 'main' && d.key === 'ziwei');
    let exit3 = [], render3Err = null;
    try {
      const boundaryEl3 = main3[1]();
      const proAppEl3 = boundaryEl3.children[0];
      const collect = (node, hits = []) => {
        if (!node || typeof node !== 'object') return hits;
        if (node.props && typeof node.props.className === 'string' &&
          node.props.className.split(/\s+/).includes('zp-exit')) hits.push(node);
        for (const child of node.children || []) collect(child, hits);
        return hits;
      };
      exit3 = collect(proAppEl3.type(proAppEl3.props));
    } catch (e) { render3Err = e; }
    ok('layout 不可用时降级：不渲染返回会话按钮、面板仍可渲染',
      apply3Err === null && render3Err === null && exit3.length === 0,
      (apply3Err || render3Err || {}).message || ('exit=' + exit3.length));
  }
}

console.log(`\n${'='.repeat(52)}`);
console.log(`自检结果: ${pass} 通过, ${fail} 失败`);
console.log('='.repeat(52));
process.exit(fail === 0 ? 0 : 1);
