/**
 * verify/ui-v6-contract.mjs — v6 界面约定体检接线（由 verify/ui-v6.mjs 调用）
 *
 * 只做包装：调用 scripts/audit-ui.mjs --profile v6 --json，把每项检查翻译成一条断言。
 * 约定在 docs/ui-contract/v6/，检查逻辑都在体检脚本里，本文件不改约定。
 * 通过标准：体检没有 FAIL（v6 的基线全 0，所以也不该有 WARN；有就照实标出来）。
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export default async function contract(t) {
  const { ok, section } = t;
  section('v6 界面约定体检（scripts/audit-ui.mjs --profile v6）');
  const r = spawnSync(process.execPath, [join(t.root, 'scripts', 'audit-ui.mjs'), '--profile', 'v6', '--json'], {
    encoding: 'utf8',
    cwd: t.root,
    env: { ...process.env, ZIWEI_DIAG: '0' }
  });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch { report = null; }
  if (!report || !Array.isArray(report.checks)) {
    ok('体检脚本输出可解析', false, `exit ${r.status}${r.stderr ? '：' + r.stderr.trim().split('\n')[0] : ''}`);
    return;
  }
  for (const c of report.checks) {
    const detail = c.status === 'PASS' ? '' : [c.detail, ...(c.samples || []).slice(0, 3)].join(' · ');
    ok(`${c.id} ${c.title}${c.status === 'WARN' ? '（WARN）' : ''}`, c.status === 'PASS', detail);
  }
  ok('体检退出码和报告一致', report.exitCode === r.status, `报告 ${report.exitCode}，实际 ${r.status}`);
}
