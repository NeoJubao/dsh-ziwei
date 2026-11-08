/**
 * verify/runner-path.mjs — 定位可选的「来源产品」run-paipan.js
 *
 * 这个 runner 是可选的第二证据来源：本机有它时，diff-runner / verify-tools 会优先用
 * 真实 runner 做逐字段差分；没有时自动退回仓库内的 fixture（verify/fixtures/）。
 *
 * 解析顺序：ZIWEI_RUNNER 环境变量 → 项目内 `.ziwei-runner/run-paipan.js`（已 gitignore）
 * → 用户主目录下的 `ziwei-runner/run-paipan.js`。找不到返回 ''，不报错、不写死任何私人路径。
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = homedir();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = [
  process.env.ZIWEI_RUNNER,
  join(ROOT, '.ziwei-runner', 'run-paipan.js'),
  join(HOME, 'ziwei-runner', 'run-paipan.js')
];

/** @returns {string} 可用的 runner 路径；找不到时返回 ''。 */
export function resolveRunner() {
  for (const p of CANDIDATES) {
    if (!p) continue;
    try { if (existsSync(p)) return p; } catch (e) { /* 继续找 */ }
  }
  return '';
}

/** 找不到时的排查提示（只列公共位置，不暴露本机私人目录）。 */
export function runnerMissingHint() {
  return '未找到可选的来源产品 runner（不影响 fixture 差分）；需要真实 runner 时用 ZIWEI_RUNNER=/path/to/run-paipan.js 指定，或放到：\n' +
    '  - <repo>/.ziwei-runner/run-paipan.js\n' +
    '  - ~/ziwei-runner/run-paipan.js';
}
