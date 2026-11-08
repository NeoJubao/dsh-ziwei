/**
 * verify/exports.mjs — 宿主入口导出契约 (A1)
 *
 * bundle 以 link: 方式装载时，DSH 的 cordis 装载器从 index.js 的命名导出读取
 * name / inject / apply。inject 缺失会让 apply 在宿主服务就绪前执行，导致
 * 工具/提示词/路由全部静默不注册（P0）。本脚本只做静态导出断言，不调用 apply。
 *
 * 运行: node verify/exports.mjs
 */
/* 自检不写 interpret-diag.log（那是给真实面板排障用的） */
process.env.ZIWEI_DIAG = '0';

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

/* 必需服务：缺任意一个，工具/提示词就注册不了。
   webServer / llm 只服务面板解读通道，改走 ctx.inject(['webServer','llm']) 按需等待，
   不再进 inject —— 否则没有这两个服务的 profile 连排盘工具都会丢（官方 practices）。 */
const REQUIRED_INJECT = ['tools', 'systemPrompt'];
const ROUTE_INJECT = ['webServer', 'llm'];
const OPTIONAL_SERVICES = ['agentDefaultModel', 'sessionController', 'workspaceRegistry'];

section('宿主入口导出');
const plugin = await import(pathToFileURL(join(root, 'index.js')).href + '?v=' + Date.now());

ok("导入 index.js 露出 apply", typeof plugin.apply === 'function', typeof plugin.apply);
ok("name === 'ziwei-workbench'", plugin.name === 'ziwei-workbench', String(plugin.name));
ok('inject 是数组且恰含 2 项必需依赖',
  Array.isArray(plugin.inject) && plugin.inject.length === REQUIRED_INJECT.length,
  JSON.stringify(plugin.inject));
for (const n of REQUIRED_INJECT) {
  ok(`inject 含 ${n}`, Array.isArray(plugin.inject) && plugin.inject.includes(n), JSON.stringify(plugin.inject));
}
/* 可选服务不能放进 inject：任一服务在该 profile 不存在会让插件永不 apply。 */
for (const n of OPTIONAL_SERVICES) {
  ok(`inject 不含可选服务 ${n}`, !Array.isArray(plugin.inject) || !plugin.inject.includes(n), JSON.stringify(plugin.inject));
}
/* 路由依赖走 ctx.inject：静态确认 index.js 真的这么写了（避免回退成硬依赖） */
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(join(root, 'index.js'), 'utf8');
  ok('路由依赖 webServer/llm 通过 ctx.inject 按需等待',
    /ctx\.inject\(\['webServer', 'llm'\]/.test(src), 'ctx.inject([webServer, llm]) not found');
  for (const n of ROUTE_INJECT) {
    ok(`inject 不再硬依赖 ${n}`, !plugin.inject.includes(n), JSON.stringify(plugin.inject));
  }
}
ok('仍导出 handleInterpret（供 sse-hang.mjs 直接驱动）', typeof plugin.handleInterpret === 'function', typeof plugin.handleInterpret);

console.log(`\n${'='.repeat(52)}`);
console.log(`导出契约自检: ${pass} 通过, ${fail} 失败`);
console.log('='.repeat(52));
process.exit(fail === 0 ? 0 : 1);
