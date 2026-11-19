/**
 * verify/verify.mjs — 紫微师工作台自检
 *
 * 覆盖:
 *  1. 引擎与 ziwei-core 契约 (黄金用例四断言 / 命盘文本 / 请求组装 / 参数归一化)
 *  2. host 插件 (index.js) 在假 ctx 下的工具注册与执行、SSE 路由、上下文路由
 *  3. 打包产物 (client.js / engine-built.js) 完整性：与 build.mjs 重拼的结果逐字节一致、
 *     可在 vm 里求值、宿主约定在位；再用 verify/client-harness.mjs 跑一遍面板的关键行为（薄版本，
 *     完整用例在 verify/ui-v6-*.mjs）
 *
 * 运行: node verify/verify.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { resolveRunner, runnerMissingHint } from './runner-path.mjs';
import { assembleClient, assembleSky, assembleUi, buildEngine, readPackageVersion } from '../build.mjs';
import { fakeLocale, find, findByClass, loadBundle, makeCtx, manualTimers, memoryStorage, renderDeep, settle, streamFetch } from './client-harness.mjs';

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
ok('注册 /ziwei/version（手动检查更新）', routes.has('/ziwei/version'));
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
/* v5 批 C：会话入口合并为「在新会话里继续」（/ziwei/handoff 先写上下文再开会话，ziwei_context 照常可读）；
   /ziwei/context 路由仍在 host 上，但面板不再单独调用它 */
ok('client.js 走 host 通道（interpret + handoff），不再有单独的「写入会话」',
  /\/ziwei\/interpret/.test(client) && /\/ziwei\/handoff/.test(client) && !/syncToSession/.test(client) && !/'\/ziwei\/context'/.test(client));
/* 旧界面删掉的东西不许回来：已删除的接口、v3 退役的十二大限列表 / 流年输入条、v3.2 的模式条、
   v3.3 撤回的「打开就自动解读」、批 C 去掉的「专注看盘」和设置里重复的「显示杂曜」。
   （v5 的 zp-suggest 指模式条旁的建议按钮；v6 重新用这个类名做报告写完后的追问建议，所以不在此列。） */
{
  const RETIRED = [
    ['interpretChart', /interpretChart/],
    ['function DecadalPanel', /function DecadalPanel/],
    ['function YearlyBar', /function YearlyBar/],
    ["className: 'zp-stage-bar'", /className: 'zp-stage-bar'/],
    ['modeBrief', /modeBrief/],
    ['modeReport', /modeReport/],
    ['zp-ai-mode', /zp-ai-mode/],
    ['autoStartedRef', /autoStartedRef/],
    ["runInterpretation('', 'brief')", /runInterpretation\('', 'brief'\)/],
    ['toggleFocus', /toggleFocus/],
    ['data-focus', /data-focus/],
    ['focusOn', /focusOn/],
    ["t('showAdjSet')", /t\('showAdjSet'\)/]
  ];
  const back = RETIRED.filter(([, re]) => re.test(client)).map(([name]) => name);
  ok(`已删除的旧标识符都不在 client.js 里（${RETIRED.length} 个：interpretChart、旧时间组件、模式条、自动解读、专注看盘、重复的杂曜开关）`,
    back.length === 0, 'found: ' + back.join(', '));
}
/* P0-2: 旧版浏览器明文 API Key 必须消失（只保留升级清理逻辑） */
ok('client 不再持久化 API Key（已无消费方）',
  !/localStorage\.setItem\('ziwei-workbench\.apikey'/.test(client) && !/type: 'password'/.test(client) && /removeItem\('ziwei-workbench\.apikey'\)/.test(client));

/* v1.4.0: 手动检查更新（无轮询、无后台联网） */
{
  const pkgVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  ok('v1.4.0: client 注入版本号且接通 /ziwei/version',
    new RegExp("APP_VERSION = ['\"]" + pkgVersion.replace(/\./g, '\\.') + "['\"]").test(client) && client.includes('/ziwei/version') &&
    client.includes('检查更新') && !client.includes('__ZIWEI_VERSION__'));
  ok('v1.4.0: 版本检查无轮询定时器', !/setInterval\(/.test(client));
}
ok('engine-built.js 与内核解耦（不含 UI）', !/__ModuleLoader__/.test(readFileSync(join(root, 'engine-built.js'), 'utf8')));

/* H2: 构建产物新鲜度 —— 改了 src 忘记 build、或产物被手改, 都必须报错。
   用 build.mjs 导出的同一组拼接函数在内存里重拼一遍，和磁盘上的产物逐字节比：
   client.js = 懒加载内核包装 + engine + ziwei-core + 3D 星图（vendor/three-r128.min.js + src/sky.js）+ src/ui/ 拼接。 */
{
  const eng = readFileSync(join(root, 'engine-built.js'), 'utf8');
  const zc = readFileSync(join(root, 'src', 'ziwei-core.js'), 'utf8');
  let engineNow = null, expected = null, buildErr = null;
  try {
    engineNow = await buildEngine(root);
    expected = assembleClient({ engine: engineNow, zcore: zc, sky: assembleSky(root), ui: assembleUi(root, { version: readPackageVersion(root) }).text });
  } catch (e) { buildErr = e; }
  let firstDiff = -1;
  if (expected !== null && client !== expected) {
    firstDiff = 0;
    while (firstDiff < client.length && client[firstDiff] === expected[firstDiff]) firstDiff++;
  }
  ok('client.js = build.mjs 现在拼出来的结果（逐字节；产物未过期、没有手改）',
    buildErr === null && expected !== null && client === expected,
    buildErr ? buildErr.message : `磁盘 ${client.length} 字符 / 重拼 ${expected && expected.length} 字符，第一处不同在 ${firstDiff}`);
  ok('engine-built.js = build.mjs 现在拼出来的引擎（逐字节）', engineNow !== null && eng === engineNow, buildErr && buildErr.message);
  ok('engine-built.js 已注入农历数据（无占位符残留）',
    !/\/\*__LUNAR_INFO__\*\//.test(eng) && !/\/\*__LTERM_INFO__\*\//.test(eng) && /lunarInfo|LUNAR_INFO/.test(eng));
}

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
/* 按钮本身（zp-exit、title、aria-label）由下面「主面板顶栏渲染出唯一的返回会话按钮」在渲染级核对 */
ok('client 提供「返回会话」出口：官方 selectPanel(null)', /selectPanel\(null\)/.test(client));
/* 48px 是宿主窗口标题带的高度。顶部避让只能走 --dsh-frame-top-clearance：外壳（.zp-root / .zp-shell）、
   顶栏（.zp-head）和 darwin 规则上都不许写死 padding-top: 48px。
   v6 首页没有 WebGL 时星图区（.zp-sky）的 padding-top: 48px 是版面间距、所有平台都生效，不是避让，不在此列。 */
{
  const hits = [];
  for (const m of client.matchAll(/padding-top: ?48px/g)) {
    const open = client.lastIndexOf('{', m.index);
    const selector = client.slice(client.lastIndexOf('}', open) + 1, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const parts = selector.split(',').map((s) => s.trim());
    if (parts.some((s) => /data-platform/.test(s) || /\.zp-(root|shell|head)$/.test(s))) hits.push(selector);
  }
  ok('chrome 避让不用魔法数字写死（外壳 / 顶栏 / darwin 规则不写 padding-top: 48px，顶部偏移只走 --dsh-frame-top-clearance）',
    hits.length === 0 && /--dsh-frame-top-clearance/.test(client), hits.join(' | '));
}

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

  /* ---- 精装报告渲染（v3.2：表格 / <br> / 分隔线 / 打印分页） ---- */
  const reportApi = win.ZWReport;
  ok('client 暴露精装报告渲染（window.ZWReport）',
    !!reportApi && typeof reportApi.mdToHtml === 'function' && typeof reportApi.buildReportHtml === 'function');
  const mdTable = [
    '| 宫位 | 主星 | 备注 |',
    '| :--- | :---: | ---: |',
    '| 命宫 | 天机[庙]·**化权** | 灯芯<br>谋略 |',
    '| 夫妻 | 太阳[不] | — |'
  ].join('\n');
  const htmlTable = reportApi ? reportApi.mdToHtml(mdTable) : '';
  ok('报告表格 → <table>（表头 / 三向对齐 / 单元格 <br> / 行内强调）',
    /<table class="md-table">/.test(htmlTable) &&
    /<th style="text-align:left">宫位<\/th>/.test(htmlTable) &&
    /<th style="text-align:center">主星<\/th>/.test(htmlTable) &&
    /<th style="text-align:right">备注<\/th>/.test(htmlTable) &&
    /天机\[庙\]·<strong>化权<\/strong>/.test(htmlTable) &&
    /灯芯<br>谋略/.test(htmlTable) &&
    !/\|/.test(htmlTable.replace(/<[^>]+>/g, '')),
    htmlTable.slice(0, 200));
  const chatTable = reportApi ? reportApi.mdToChatHtml(mdTable) : '';
  ok('抽屉回答里的管道表格也渲染（zp-md-table，不露管道符）',
    /<table class="zp-md-table">/.test(chatTable) &&
    /<th style="text-align:left">宫位<\/th>/.test(chatTable) &&
    /灯芯<br>谋略/.test(chatTable) &&
    !/\|/.test(chatTable.replace(/<[^>]+>/g, '')),
    chatTable.slice(0, 200));
  const htmlMixed = reportApi ? reportApi.mdToHtml('## 标题\n\n---\n\n正文**加粗**\n\n- 甲\n- 乙') : '';
  ok('报告标题 / 分隔线 / 列表渲染',
    /<h3>标题<\/h3>/.test(htmlMixed) && /<hr>/.test(htmlMixed) &&
    /<strong>加粗<\/strong>/.test(htmlMixed) && /<ul>\s*<li>甲<\/li>\s*<li>乙<\/li>\s*<\/ul>/.test(htmlMixed),
    htmlMixed.slice(0, 200));
  const htmlDoc = reportApi ? reportApi.buildReportHtml({ chart: ch, name: '测试', gender: 'male' }, mdTable) : '';
  ok('精装报告壳含表格样式、<table> 与打印分页保护',
    /\.md-table\{/.test(htmlDoc) && /<table class="md-table">/.test(htmlDoc) &&
    /page-break-inside:avoid/.test(htmlDoc) && /<\/html>/.test(htmlDoc));
  /* 报告按 14 部分算进度：标题行之前的「盘前须知」不算一部分 */
  const progress = (md) => (reportApi && typeof reportApi.progress === 'function' ? JSON.stringify(reportApi.progress(md)) : '');
  ok('报告按部分算进度（ZWReport.progress：共 14 部分，写到第几部分）',
    progress('') === '{"done":0,"total":14,"current":1}' &&
    progress('## 盘前须知\n\n甲\n\n## 一、命盘总览\n\n乙\n\n## 二、性格大略\n\n丙') === '{"done":1,"total":14,"current":2}',
    progress('') + ' / ' + progress('## 盘前须知\n\n甲\n\n## 一、命盘总览\n\n乙\n\n## 二、性格大略\n\n丙'));

  /* ---- 界面纯逻辑（window.ZWUi，v5 体验打磨 spec 2026-11-18_v5-ux-polish；v6 原样搬进 src/ui/20-util.js） ---- */
  const ui = win.ZWUi;
  ok('client 暴露界面纯逻辑（window.ZWUi）', !!ui && typeof ui.mergeReportText === 'function');
  if (ui && typeof ui.mergeReportText === 'function') {
    /* 续写时流式增量已经累计进正文；done 携带的是本轮全文。收尾必须是「续写前正文 + 本轮全文」 */
    ok('报告续写收尾：续写前正文 + 本轮正文，不重复拼接',
      ui.mergeReportText({ cont: true, base: '第一部分。', accumulated: '第一部分。第二部分。', done: '第二部分。' }) === '第一部分。第二部分。');
    ok('报告首次生成收尾：以 done 全文为准',
      ui.mergeReportText({ cont: false, base: '', accumulated: '半截', done: '完整全文' }) === '完整全文');
    ok('报告首次生成收尾：done 为空时保留已累计正文',
      ui.mergeReportText({ cont: false, base: '', accumulated: '已写部分', done: '' }) === '已写部分');
  }
  {
    /* 对话流式：host 的 delta 是增量片段（index.js sseSend('delta')），气泡必须累加；done 带本轮全文，替换本轮气泡 */
    const apply = ui && typeof ui.applyAssistantText === 'function' ? ui.applyAssistantText : null;
    let th = [{ role: 'user', content: '问' }];
    if (apply) {
      th = apply(th, '第一句。', 'new');
      th = apply(th, '第二句。', 'append');
    }
    ok('对话流式中气泡累加增量（不是只显示最后一段）',
      th.length === 2 && th[1].role === 'assistant' && th[1].content === '第一句。第二句。', JSON.stringify(th));
    if (apply) th = apply(th, '第一句。第二句。第三句。', 'replace');
    ok('对话收到 done 时用本轮全文替换本轮气泡',
      th.length === 2 && th[1].content === '第一句。第二句。第三句。', JSON.stringify(th));
    const prevAnswer = [{ role: 'assistant', content: '上一轮回答' }];
    const fresh = apply ? apply(prevAnswer, '新回答', 'new') : prevAnswer;
    ok('新一轮回答另起气泡，不接在上一轮回答后面',
      fresh.length === 2 && fresh[0].content === '上一轮回答' && fresh[1].content === '新回答', JSON.stringify(fresh));
  }
  {
    /* 三方四正：对宫 = +6，三合 = +4 / +8（mod 12） */
    const rel = ui && typeof ui.relatedPalaces === 'function' ? ui.relatedPalaces : null;
    const r0 = rel ? rel(0) : null;
    const r10 = rel ? rel(10) : null;
    ok('三方四正索引：0 → 对宫 6、三合 4/8；10 → 对宫 4、三合 2/6',
      !!r0 && r0.opp === 6 && r0.tri[0] === 4 && r0.tri[1] === 8 &&
      !!r10 && r10.opp === 4 && r10.tri[0] === 2 && r10.tri[1] === 6, JSON.stringify([r0, r10]));
  }
  {
    /* 表单与当前命盘的生辰是否一致：只比会改变命盘的字段；表单里是字符串，快照里是数字 */
    const same = ui && typeof ui.sameBirthInput === 'function' ? ui.sameBirthInput : null;
    const snap = { name: '甲', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male', longitude: '105.97', place: '', occupation: '',
      settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true } };
    const formSame = Object.assign({}, snap, { year: '1992', month: '5', day: '3', hour: '9', minute: '30', name: '乙', place: '成都', occupation: '设计' });
    ok('生辰一致判断：只改称呼/籍贯/职业、数字以字符串出现，仍算同一张盘', !!same && same(formSame, snap) === true);
    ok('生辰一致判断：改了出生时辰就不是同一张盘', !!same && same(Object.assign({}, formSame, { hour: '10' }), snap) === false);
    ok('生辰一致判断：改了晚子时口径就不是同一张盘',
      !!same && same(Object.assign({}, formSame, { settings: Object.assign({}, snap.settings, { dayDivide: 'forward' }) }), snap) === false);
  }
  {
    /* 出生城市：城市名查内置表（城市中心近似经度，0.1°），也接受直接填经度 */
    const pb = ui && typeof ui.parseBirthplace === 'function' ? ui.parseBirthplace : null;
    const P = (x) => pb ? pb(x) : null;
    ok('出生城市：北京 → 东经 116.4', !!pb && P('北京').kind === 'city' && P('北京').city === '北京' && P('北京').lon === 116.4, JSON.stringify(P('北京')));
    ok('出生城市：「北京市」去掉市字也能认', !!pb && P('北京市').city === '北京');
    ok('出生城市：「四川成都」取包含的城市 → 成都 104.1', !!pb && P('四川成都').city === '成都' && P('四川成都').lon === 104.1, JSON.stringify(P('四川成都')));
    ok('出生城市：「吉林长春」省名与城市同名时取后面的城市 → 长春', !!pb && P('吉林长春').city === '长春', JSON.stringify(P('吉林长春')));
    ok('出生城市：直接填经度 116.4 / 东经105.97°', !!pb && P('116.4').kind === 'number' && P('116.4').lon === 116.4 && P('东经105.97°').lon === 105.97, JSON.stringify(P('东经105.97°')));
    ok('出生城市：查不到 → unknown 且不给经度', !!pb && P('火星基地').kind === 'unknown' && P('火星基地').lon === null);
    ok('出生城市：空 → empty（按钟表时间排盘）', !!pb && P('  ').kind === 'empty' && P('  ').lon === null);
    ok('出生城市：越界数字不当经度', !!pb && P('400').kind === 'unknown');
  }
  {
    /* 批 C 功能收束：一个任务只留一条路径（「专注看盘」「显示杂曜」的旧入口见上面「已删除的旧标识符」） */
    const autoName = ui && typeof ui.autoChartName === 'function' ? ui.autoChartName : null;
    ok('命盘库不填名时自动命名：日期 + 时辰 + 性别',
      !!autoName && autoName({ name: '', year: 1990, month: 6, day: 15, gender: 'male' }, '申时') === '1990-06-15 申时 男',
      autoName && autoName({ name: '', year: 1990, month: 6, day: 15, gender: 'male' }, '申时'));
    ok('命盘库不填名时有称呼就用称呼',
      !!autoName && autoName({ name: ' 张三 ', year: 1992, month: 5, day: 3, gender: 'female' }, '巳时') === '张三');
  }
  {
    /* 引用宫位：用引擎宫位对象的真实字段（stem/branch/major/minor），不能读不存在的 gz/stars */
    const soul = ch.palaces[ch.soulIndex];
    const quoteText = ui && typeof ui.palaceQuoteText === 'function' ? ui.palaceQuoteText(soul, '空宫') : '';
    const starNames = soul.major.concat(soul.minor).map((s) => s.name);
    ok('引用宫位文本含宫名、干支与本宫星曜',
      quoteText.startsWith(soul.name + ' ' + soul.stem + soul.branch + ' · ') &&
      starNames.length > 0 && starNames.every((n) => quoteText.includes(n)), quoteText);
    const emptyText = ui && typeof ui.palaceQuoteText === 'function'
      ? ui.palaceQuoteText({ name: '迁移', stem: '庚', branch: '辰', major: [], minor: [] }, '空宫') : '';
    ok('引用空宫时写明空宫', emptyText === '迁移 庚辰 · 空宫', emptyText);
  }
  {
    /* 报告选段按钮坐标：按钮绝对定位在可滚动的正文容器里，必须计入 scrollTop/scrollLeft */
    const pick = ui && typeof ui.pickPoint === 'function'
      ? ui.pickPoint({ left: 340, top: 260 }, { left: 100, top: 200 }, 900, 0) : null;
    ok('报告选段按钮坐标计入正文滚动量（滚过第一屏后仍贴着选区）',
      !!pick && pick.x === 240 && pick.y === 960, JSON.stringify(pick));
    const pickEdge = ui && typeof ui.pickPoint === 'function'
      ? ui.pickPoint({ left: 110, top: 205 }, { left: 100, top: 200 }, 0, 0) : null;
    ok('报告选段按钮坐标在容器左上角时保留最小边距',
      !!pickEdge && pickEdge.x === 80 && pickEdge.y === 32, JSON.stringify(pickEdge));
    /* ---- CSS 静态断言（批 A：A1–A4） ---- */
    const cssRule = (sel) => {
      const i = client.indexOf('\n' + sel + ' {');
      if (i < 0) return '';
      return client.slice(i, client.indexOf('}', i));
    };
    const btnRule = cssRule('.zp-btn');
    ok('.zp-btn 是 inline-flex 且垂直居中（图标与文字同一行）',
      /display:\s*inline-flex/.test(btnRule) && /align-items:\s*center/.test(btnRule), btnRule.slice(0, 160));
    ok('按钮颜色继承（:where 零权重重置，深色下不落回浏览器默认黑字）',
      /:where\(\.zp-root\) button \{[^}]*color:\s*inherit/.test(client));
    /* v5 用 setAttribute 在挂载后补这个属性；v6 直接写在浮层容器的 props 里（50-parts 的 Modal / Sheet、80-assistant 的浮动面板） */
    ok('程序聚焦的浮层容器带宿主约定的 data-dsh-automatic-focus，且不画焦点框',
      /'data-dsh-automatic-focus': ''/.test(client) &&
      /\.zp-root \[data-dsh-automatic-focus\]:focus \{[^}]*outline:\s*none/.test(client));
    /* 图标表完整：源码里用到的图标名都必须在 ZWUi.iconNames（= ICON_PATHS 的键）里，否则渲染成空白 svg */
    const icons = new Set((ui && ui.iconNames) || []);
    const usedIcons = new Set([
      ...[...client.matchAll(/h\(Icon, \{ name: '(\w+)'/g)].map((m) => m[1]),
      ...[...client.matchAll(/h\(Icon, \{ name: [^,}]*\? '(\w+)' : '(\w+)'/g)].flatMap((m) => [m[1], m[2]]),
      ...[...client.matchAll(/h\(Icon, \{ name: [\w.]+ \|\| '(\w+)'/g)].map((m) => m[1]),
      ...[...client.matchAll(/\bicon: '(\w+)'/g)].map((m) => m[1])
    ]);
    const missingIcons = [...usedIcons].filter((n) => !icons.has(n));
    ok(`源码引用的图标都在 ZWUi.iconNames 里有定义（${usedIcons.size} 个）`, icons.size > 10 && usedIcons.size > 0 && missingIcons.length === 0, 'missing: ' + missingIcons.join(','));
  }

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

/* ---- 产物的行为（v6）：用 verify/client-harness.mjs 在 vm 里装载磁盘上的 client.js ----
 * 这里只留每条约定的一个薄版本，盯住「发出去的就是这样」；完整的用例在 verify/ui-v6-*.mjs（第 9 组）。
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）；第二张盘是同一生辰的女命。"今天"固定为 2026-11-19。 */
{
  const J = (v) => JSON.stringify(v);
  const attr = (el, k) => (el && el.props ? el.props[k] : undefined);
  const GOLDEN = {
    name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
    longitude: '105.97', city: '', place: '', occupation: '',
    settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
  };
  const GOLDEN_F = Object.assign({}, GOLDEN, { gender: 'female' });
  const KEY_A = 'solar|1992|5|3|0|9|30|male|105.97|normal,exact,current,1';
  const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
  const TODAY = { y: 2026, m: 11, d: 19 };
  /** 装载 client.js → factory → apply()；返回 { b（loadBundle 的结果）, host（makeCtx 的结果）, err } */
  const boot = (services = {}, beforeApply = null) => {
    const b = loadBundle(client, { filename: 'client.js', globals: { AbortController } });
    if (b.error || !b.entry) return { b, host: null, err: b.error || new Error('没有入口') };
    const host = makeCtx(services);
    try {
      const plugin = b.materialize();
      if (beforeApply) beforeApply(b);
      plugin.apply(host.ctx);
    } catch (e) { return { b, host, err: e }; }
    return { b, host, err: null };
  };

  /* 字典与 locale：P1-1 可见文案走官方 Client locale 服务（register + bind），不读私有 tr.i18n */
  const loc = fakeLocale('zh');
  const withLocale = boot({ locale: loc });
  ok("client 走官方 locale 服务：一次 register('ziwei', { zh, en })、一次 bind('ziwei')，不再读 tr.i18n",
    !withLocale.err && loc.calls.register.length === 1 && loc.calls.register[0][0] === 'ziwei' &&
    !!loc.calls.register[0][1].zh && !!loc.calls.register[0][1].en &&
    loc.calls.bind.length === 1 && loc.calls.bind[0] === 'ziwei' && !/\.i18n\[0\]/.test(client),
    withLocale.err ? withLocale.err.message : J({ register: loc.calls.register.length, bind: loc.calls.bind }));
  {
    /* 文案检查（批 C「去 AI 味」）：取 vm 里登记给 locale 的字典对象来比，不靠源码缩进 */
    const dicts = loc.calls.register[0] ? loc.calls.register[0][1] : { zh: {}, en: {} };
    const zhKeys = Object.keys(dicts.zh || {});
    const enKeys = Object.keys(dicts.en || {});
    const banned = ['✓', '⚠', '画布', '把这盘读懂', '智能解读', '鲲鹏'];
    const hits = banned.filter((w) => zhKeys.some((k) => String(dicts.zh[k]).includes(w)));
    ok('界面文案不含装饰符号、口号和「鲲鹏」品牌词（品牌只留在导出报告）', zhKeys.length > 100 && hits.length === 0, `keys ${zhKeys.length}; hits: ${hits.join(',')}`);
    /* 构建把字典按 JSON.stringify(dict, null, 2) 注入；字典之后的源码里每个键都要以 '键' 出现过 */
    const dictText = JSON.stringify({ 'zh-CN': dicts.zh, 'en-US': dicts.en }, null, 2);
    const dictAt = client.indexOf(dictText);
    const afterDict = dictAt >= 0 ? client.slice(dictAt + dictText.length) : '';
    const unusedKeys = zhKeys.filter((k) => !afterDict.includes("'" + k + "'"));
    ok('界面字典没有无引用的键', zhKeys.length > 0 && dictAt >= 0 && unusedKeys.length === 0, dictAt < 0 ? '在 client.js 里找不到字典原文' : unusedKeys.join(' '));
    const onlyZh = zhKeys.filter((k) => !(k in dicts.en)), onlyEn = enKeys.filter((k) => !(k in dicts.zh));
    ok('中英文案键一一对应', zhKeys.length > 0 && onlyZh.length === 0 && onlyEn.length === 0, 'zh only: ' + onlyZh.join(' ') + ' | en only: ' + onlyEn.join(' '));
    ok('默认称呼不再是「命主」（和星曜术语「命主 禄存」撞名）：没填称呼的盘显示「未命名」', dicts.zh.headUnnamed === '未命名', String(dicts.zh.headUnnamed));
    ok('紫微师面板的会话入口叫「在新会话里继续」', dicts.zh.asHandoff === '在新会话里继续', String(dicts.zh.asHandoff));
  }

  /* H1: 默认口径与默认偏好必须进产物 */
  {
    const runAutoOpen = (prefs) => {
      const timers = manualTimers();
      const layout = { calls: [], selectPanel(id) { this.calls.push(id); } };
      const r = boot({ layout }, (b) => {
        b.win.setTimeout = timers.setTimeout;
        b.win.clearTimeout = timers.clearTimeout;
        b.win.localStorage = memoryStorage(prefs);
      });
      timers.runAll();
      return r.err ? 'err: ' + r.err.message : J(layout.calls);
    };
    const off = runAutoOpen({});
    const on = runAutoOpen({ 'ziwei-pro.autopen': '1' });
    ok('autoOpen 默认关闭：空 storage 时插件装上不切面板（设置里打开后才切到紫微面板）', off === '[]' && on === '["ziwei"]', `空 storage ${off}；autopen=1 ${on}`);
  }
  const { b: env, err: envErr } = boot();
  const ZW = env && env.win.ZWUi;
  const S = env && env.win.ZWStore;
  const E = env && env.win.ZWEngine;
  const C = env && env.win.ZWCore;
  ok('client.js 在 client-harness 里装载、apply() 后有 ZWUi / ZWStore / ZWEngine / ZWCore', !envErr && !!ZW && !!S && !!E && !!C, envErr && envErr.message);
  if (ZW && S && E && C) {
    ok('面板默认 dayDivide = current（与紫微师口径一致）：DEFAULT_FORM.settings = normal / exact / current / true',
      J(ZW.DEFAULT_FORM && ZW.DEFAULT_FORM.settings) === J({ yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }),
      J(ZW.DEFAULT_FORM && ZW.DEFAULT_FORM.settings));

    /* v1.3.3: 旧持久化表单的一次性月柱口径迁移 */
    {
      const oldForm = { name: '', calendar: 'solar', year: 1990, month: 6, day: 15, isLeap: false, hour: 15, minute: 30, gender: 'male', longitude: '', place: '', occupation: '',
        settings: { yearDivide: 'normal', monthDivide: 'normal', dayDivide: 'current', fixLeap: true } };
      const s = memoryStorage({ 'ziwei-pro.form': J(oldForm) });
      let detail = '';
      let migrated = false, kept = false;
      try {
        const f = ZW.createStorageApi(s).form.load();
        migrated = f.settings.monthDivide === 'exact' && JSON.parse(s.getItem('ziwei-pro.form')).settings.monthDivide === 'exact' && s.getItem('ziwei-pro.formV133') === '1';
        ZW.createStorageApi(s).form.save(Object.assign({}, f, { settings: Object.assign({}, f.settings, { monthDivide: 'normal' }) }));
        kept = ZW.createStorageApi(s).form.load().settings.monthDivide === 'normal';
        detail = J(s.dump());
      } catch (e) { detail = 'threw: ' + e.message; }
      ok('v1.3.3: localStorage 旧默认一次性迁移到节气（迁移之后用户自己选的农历月保留）', migrated && kept, detail.slice(0, 200));
    }

    /* v1.7: 解读记录按命盘保存：最多 8 张盘、每张 24 条；key 含排盘口径 */
    {
      let t = 1763600000000;
      const s = memoryStorage();
      const api = ZW.createStorageApi(s, { now: () => t });
      const keys = [];
      for (let i = 0; i < 9; i++) {
        t += 1000;
        const k = `solar|1990|6|${i + 1}|0|15|30|male||normal,exact,current,1`;
        keys.push(k);
        api.readings.save(k, { thread: [{ role: 'user', content: '问' + i }] });
      }
      const left = Object.keys(JSON.parse(s.getItem('ziwei-pro.readings.v2') || '{}'));
      t += 1000;
      api.readings.save(keys[8], { thread: Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: '第' + i + '条' })) });
      const rec = JSON.parse(s.getItem('ziwei-pro.readings.v2'))[keys[8]];
      ok('v1.7: 解读记录按命盘持久化（最多 8 张，挤掉最久没更新的；每张留最后 24 条）',
        left.length === 8 && !left.includes(keys[0]) && rec.thread.length === 24 && rec.thread[0].content === '第6条',
        `${left.length} 张；第一条 ${rec && rec.thread[0].content}，共 ${rec && rec.thread.length} 条`);
      const k0 = ZW.readingKeyOf(GOLDEN);
      const withSetting = (patch) => ZW.readingKeyOf(Object.assign({}, GOLDEN, { settings: Object.assign({}, GOLDEN.settings, patch) }));
      const variants = [k0, withSetting({ yearDivide: 'exact' }), withSetting({ monthDivide: 'normal' }), withSetting({ dayDivide: 'forward' })];
      ok('v1.7: 解读记录 key 含排盘设置（换年界 / 月柱 / 晚子时口径不会套回旧解读）',
        k0 === KEY_A && new Set(variants).size === 4, J(variants));
    }

    /* 会话态（store）：换盘各自恢复、启动恢复、报告任务、请求体 */
    const mk = (storage) => {
      const fetch = streamFetch();
      const timers = manualTimers();
      const st = S.createStore({
        storage, fetch, now: () => NOW, engine: E, core: C,
        setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, openSession: () => true
      });
      st.subscribe(() => {});
      return { st, fetch };
    };
    const last = (f) => f.calls[f.calls.length - 1];
    {
      const storage = memoryStorage();
      const { st, fetch } = mk(storage);
      const a = st.addChart(GOLDEN, '甲');
      const b = st.addChart(GOLDEN_F, '乙');
      st.openChart(a.id);
      st.setPanel(true);
      st.ask('命宫怎么看');
      await settle();
      last(fetch).send('done', { text: '甲的回答' });
      await settle();
      const threadA = J(st.reading().thread);
      const calls = fetch.calls.length;
      st.openChart(b.id);
      const threadB = J(st.reading().thread);
      st.openChart(a.id);
      const threadA2 = J(st.reading().thread);
      ok('v1.7: 换盘按命盘 key 各自恢复记录；没有记录的盘是空的，换盘不自动发请求',
        threadA === J([{ role: 'user', content: '命宫怎么看' }, { role: 'assistant', content: '甲的回答' }]) &&
        threadB === '[]' && threadA2 === threadA && fetch.calls.length === calls,
        `A ${threadA}；B ${threadB}；回到 A ${threadA2}；请求 ${calls} → ${fetch.calls.length}`);
      const second = mk(storage);
      const s2 = second.st.getState().session;
      ok('v1.7: 启动时恢复上一次命盘与它的解读记录（首页聚焦上次的盘，记录按 key 读回）',
        s2.view === 'home' && s2.focusId === a.id && J(second.st.reading(KEY_A).thread) === threadA,
        J([s2.view, s2.focusId, second.st.reading(KEY_A).thread]));
    }
    {
      const { st, fetch } = mk(memoryStorage());
      const a = st.addChart(GOLDEN, '甲');
      st.openChart(a.id);
      st.setStage('report');
      st.startReport();
      await settle();
      last(fetch).send('delta', { text: '## 一、' }).send('delta', { text: '命宫' }).end();
      await settle();
      const cut = st.reading().report;
      const cutOk = cut.status === 'error' && cut.issue && cut.issue.canContinue === true && cut.text === '## 一、命宫';
      st.continueReport();
      await settle();
      last(fetch).send('delta', { text: '续' }).send('done', { text: '续写' });
      await settle();
      const rp = st.reading().report;
      ok('报告任务：断连保留正文可续写；续写在假流上以 done 结束，正文 = 原文 + 本轮全文；报告和对话分开',
        cutOk && rp.status === 'done' && rp.text === '## 一、命宫续写' && J(st.reading().thread) === '[]',
        J([cut.status, cut.text, rp.status, rp.text, st.reading().thread.length]));
    }
    {
      const chart = E.computeChart({ calendar: 'solar', year: 1992, month: 5, day: 3, hour: 9, minute: 30, gender: 'male', longitude: 105.97 });
      const B = (o) => S.buildInterpretBody(Object.assign({ chart, input: GOLDEN, now: NOW, core: C, tab: 'natal', when: TODAY, mode: 'brief', question: '事业', history: [] }, o));
      const b0 = B({});
      ok('问答请求体带完整命盘文字与当前虚岁（chartText = fullChartText(chart, { currentAge: 35, currentYear: 2026 })）',
        J(Object.keys(b0)) === J(['chartText', 'mode', 'question', 'history', 'meta']) &&
        b0.chartText === C.fullChartText(chart, { currentAge: 35, currentYear: 2026 }) && b0.meta.currentAge === 35 && b0.meta.currentYear === 2026,
        J(Object.keys(b0)) + ' ' + J(b0.meta));
      const bd = B({ tab: 'decadal', scope: true });
      const by = B({ tab: 'yearly', scope: true });
      ok('大限默认是当前这一段（不是第 0 段）、流年选择进请求体：decadalFocus [33, 42]、yearlyFocus 2026',
        J(bd.meta.decadalFocus) === '[33,42]' && by.meta.yearlyFocus === 2026, J([bd.meta.decadalFocus, by.meta.yearlyFocus]));
    }
  }

  /* P2-8 / a11y：深渲染（effect 不跑、面板宽度还没量到 = 窄档）打开紫微师面板的命盘页 */
  {
    const timers = manualTimers();
    const layout = { calls: [], selectPanel(id) { this.calls.push(id); } };
    const r = boot({ layout }, (b) => { b.win.setTimeout = timers.setTimeout; b.win.clearTimeout = timers.clearTimeout; });
    let tree = null, renderErr = r.err;
    if (!renderErr) {
      try {
        const store = r.b.win.ZWStore.getStore({ storage: memoryStorage(), now: () => NOW, fetch: streamFetch(), setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout });
        const e = store.addChart(GOLDEN, '甲');
        store.openChart(e.id);
        store.setPanel(true);
        tree = renderDeep(r.host.main()());
      } catch (e) { renderErr = e; }
    }
    const thread = tree ? findByClass(tree, 'zp-chat-thread') : [];
    ok('紫微师面板渲染出对话区：唯一的 div.zp-chat-thread[role=log][aria-live=polite]',
      !renderErr && thread.length === 1 && thread[0].type === 'div' && attr(thread[0], 'role') === 'log' && attr(thread[0], 'aria-live') === 'polite',
      renderErr ? renderErr.message : J(thread.map((n) => [n.type, attr(n, 'role'), attr(n, 'aria-live')])));
    const dialogs = tree ? find(tree, (n) => attr(n, 'role') === 'dialog') : [];
    const badDialogs = dialogs.filter((n) => !(attr(n, 'aria-modal') === 'true' && String(attr(n, 'aria-label') || '').trim()));
    ok(`每个 role="dialog" 都有 aria-modal="true" 和 aria-label（${dialogs.length} 个）`,
      !renderErr && dialogs.length >= 1 && badDialogs.length === 0,
      renderErr ? renderErr.message : J(badDialogs.map((n) => [n.type, attr(n, 'className')])));
  }
}

console.log(`\n${'='.repeat(52)}`);
console.log(`自检结果: ${pass} 通过, ${fail} 失败`);
console.log('='.repeat(52));
process.exit(fail === 0 ? 0 : 1);
