/**
 * verify/ui-contract.mjs — 界面契约体检接线（ui-contract）
 *
 * 只做包装：调用 scripts/audit-ui.mjs --json（默认就是 v6 的约定），把每项检查翻译成一条断言。
 * 契约本身（docs/ui-contract/ 的 layout.md / design.md / tokens.md）与检查逻辑都在 audit 里，本文件不改契约。
 * 体检只在这里跑一次（verify/all.mjs 第 8 组）；第 9 组 verify/ui-v6.mjs 不再重复跑。
 *
 * 通过标准：audit 无 FAIL，也没有 WARN。v6 的基线全 0，没有可以锁住的历史欠账，
 * 所以 WARN（检查被跳过，或 C15 的计数没超过一个被人上调过的基线）同样算失败，照实标出来。
 *
 * 运行: node verify/ui-contract.mjs
 */
/* 自检不写 interpret-diag.log（那是给真实面板排障用的） */
process.env.ZIWEI_DIAG = '0';

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT = join(root, 'scripts', 'audit-ui.mjs');

let pass = 0;
let fail = 0;
let warn = 0;
const line = (mark, name, detail) => console.log(`  ${mark} ${name}${detail ? ' — ' + detail : ''}`);
const section = (t) => console.log(`\n== ${t} ==`);

section('界面契约（ui-contract）');

const r = spawnSync(process.execPath, [AUDIT, '--json'], {
  encoding: 'utf8',
  cwd: root,
  env: { ...process.env, ZIWEI_DIAG: '0' }
});

if (r.error) {
  fail++;
  line('❌', 'audit-ui.mjs 可执行', r.error.message);
} else {
  let report = null;
  try {
    report = JSON.parse(r.stdout);
  } catch {
    report = null;
  }

  if (!report || !Array.isArray(report.checks)) {
    fail++;
    line('❌', 'audit-ui.mjs 输出可解析', `exit ${r.status}${r.stderr ? '：' + r.stderr.trim().split('\n')[0] : ''}`);
  } else {
    for (const c of report.checks) {
      const detail = c.detail || (c.status === 'PASS' ? '通过' : '');
      if (c.status === 'PASS') {
        pass++;
        line('✅', `${c.id} ${c.title}`, detail);
      } else {
        if (c.status === 'WARN') warn++;
        fail++;
        line('❌', `${c.id} ${c.title}${c.status === 'WARN' ? '（WARN）' : ''}`, detail);
        const samples = (c.samples || []).slice(0, 3);
        for (const s of samples) console.log(`       · ${s}`);
        if ((c.samples || []).length > samples.length) {
          console.log(`       · …还有 ${c.samples.length - samples.length} 条（node scripts/audit-ui.mjs -v 看全部）`);
        }
      }
    }

    /* audit 的退出码必须与它自报的一致，防止「报告说 0 项失败但进程 exit 1」的静默错位 */
    const declared = report.exitCode;
    if (typeof declared === 'number' && declared !== r.status) {
      fail++;
      line('❌', '退出码与报告一致', `audit 自报 exit ${declared}，实际 ${r.status}`);
    }
  }
}

console.log(`\n${'='.repeat(52)}`);
console.log(`界面契约自检: ${pass} 通过, ${fail} 失败${warn > 0 ? `（其中 ${warn} 项是 WARN，v6 基线全 0，照样算失败）` : ''}`);
console.log('='.repeat(52));
process.exit(fail === 0 ? 0 : 1);
