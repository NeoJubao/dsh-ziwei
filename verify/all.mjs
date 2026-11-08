/**
 * verify/all.mjs — 一次跑完所有自检
 *
 *   node verify/all.mjs
 *
 * 包含:
 *   1. verify/verify.mjs        内核 + host 插件 + 客户端 bundle（含窗口 chrome 避让与「返回会话」出口防回归）
 *   2. verify/exports.mjs       宿主入口导出契约（name / inject / apply）
 *   3. verify/routes-auth.mjs   路由方法 / 鉴权 / JSON Content-Type 守卫
 *   4. verify/verify-tools.mjs  真实 dsh-tools 契约校验（25 项）
 *   5. verify/diff-runner.mjs   与独立版 run-paipan.js 逐字段差分（20 用例）
 *   6. verify/sse-hang.mjs      SSE 对无视 abort 的挂起流必须超时解锁（19 项）
 *   7. verify/pack.mjs          打包完整性（npm pack 必需文件）
 *   8. verify/ui-contract.mjs   界面契约体检（包装 scripts/audit-ui.mjs；区域 / token / 可访问性）
 */
/* 自检不写 interpret-diag.log（那是给真实面板排障用的） */
process.env.ZIWEI_DIAG = '0';

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const STEPS = [
  ['内核 / host 插件 / 客户端 bundle', 'verify.mjs'],
  ['宿主导出契约（name / inject / apply）', 'exports.mjs'],
  ['路由方法 / 鉴权 / JSON 守卫', 'routes-auth.mjs'],
  ['真实 dsh-tools 契约', 'verify-tools.mjs'],
  ['与独立版 run-paipan.js 逐字段差分', 'diff-runner.mjs'],
  ['SSE 挂起 / 超时解锁', 'sse-hang.mjs'],
  ['打包完整性（npm pack 必需文件）', 'pack.mjs'],
  ['界面契约（ui-contract）', 'ui-contract.mjs']
];

const results = [];
const EXIT_SKIPPED = 3; // 子脚本「已跳过」的专用退出码
const SKIPPED = new Set();
let skippedCount = 0;
for (const [label, file] of STEPS) {
  console.log(`\n${'━'.repeat(56)}\n▶ ${label}  (${file})\n${'━'.repeat(56)}`);
  const r = spawnSync(process.execPath, [join(here, file)], { encoding: 'utf8', cwd: join(here, '..') });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  /* 认退出码 3（子脚本的专用跳过码）——不认文案，避免文案一改就静默退绿 */
  if (r.status === EXIT_SKIPPED) SKIPPED.add(label);
  results.push([label, r.status]);
}

console.log(`\n${'━'.repeat(56)}\n总计\n${'━'.repeat(56)}`);
let bad = 0;
for (const [label, code] of results) {
  /* 子脚本「已跳过」时以专用退出码 3 退出 —— 跳过不是"验证过"，
     总计里单列并标 ⚠️，不标绿也不计入失败。 */
  const skipped = code === EXIT_SKIPPED;
  const mark = skipped ? '⚠️ ' : code === 0 ? '✅' : '❌';
  console.log(`  ${mark} ${label}${skipped ? '（已跳过，未验证）' : code === 0 ? '' : ` (exit ${code})`}`);
  if (skipped) skippedCount++;
  else if (code !== 0) bad++;
}
if (bad > 0) console.log(`\n${bad} 项自检失败。`);
else if (skippedCount > 0) console.log(`\n${skippedCount} 项自检被跳过（ZIWEI_ALLOW_SKIP=1）——**不代表全部验证通过**。`);
else console.log('\n全部自检通过。');
process.exit(bad === 0 ? 0 : 1);
