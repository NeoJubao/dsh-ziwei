/**
 * verify/pack.mjs — 打包完整性 (A5)
 *
 * 真正执行 `npm pack --dry-run --json`（不落盘 tarball），断言运行时必需文件
 * 确实在包内。历史上 package.json 的 files 漏了 engine-built.js / src/ziwei-core.js，
 * 按包安装后 index.js 的 kernel() 会 ENOENT，宿主半启动即失败。
 *
 * 运行: node verify/pack.mjs
 */
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};

const REQUIRED = [
  'package.json',
  'index.js',
  'client.js',
  'cordis.patch.yml',
  'engine-built.js',
  'src/ziwei-core.js'
];

console.log('== 打包完整性（npm pack --dry-run --json） ==');
/* 用独立缓存目录：机器上的 ~/.npm/_cacache 一旦出现 root 属主文件，
   npm 会以 EPERM 直接退出，这条自检就变成环境事故而不是包内容问题。 */
const tmpCache = join(tmpdir(), 'ziwei-pack-cache');
/* Windows 下 npm 是 .cmd，必须经 shell 才能 spawn（否则 ENOENT）。 */
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const r = spawnSync(npmCmd, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: root,
  encoding: 'utf8',
  timeout: 120000,
  shell: process.platform === 'win32',
  env: Object.assign({}, process.env, { npm_config_cache: tmpCache })
});

if (r.error) {
  console.log(`  ❌ 无法执行 npm pack: ${String(r.error.message || r.error).split('\n')[0]}`);
  process.exit(1);
}
if (r.status !== 0) {
  console.log(`  ❌ npm pack 退出码 ${r.status}`);
  console.log(String(r.stderr || '').slice(0, 2000));
  process.exit(1);
}

let meta = null;
try {
  meta = JSON.parse(r.stdout);
} catch (e) {
  console.log('  ❌ npm pack 输出不是 JSON: ' + String(r.stdout || '').slice(0, 800));
  process.exit(1);
}
/* npm 10/11 输出数组；npm 12 输出以包名为 key 的对象，两种都兼容 */
const entry = Array.isArray(meta) ? meta[0] : (meta[Object.keys(meta)[0]] || meta);
const files = new Set(((entry && entry.files) || []).map((f) => String(f.path)));
if (!files.size) {
  console.log('  ❌ npm pack 返回的包内文件列表为空');
  process.exit(1);
}

for (const f of REQUIRED) {
  ok(`包内含 ${f}`, files.has(f), `缺 ${f}；包内文件: ${[...files].sort().join(', ')}`);
}
/* 运行期诊断文件不应进入分发包 */
ok('包内不含 host-diag.log', !files.has('host-diag.log'));
ok('包内不含 interpret-diag.log（诊断日志不随包分发）', !files.has('interpret-diag.log'));

console.log(`\n包内文件共 ${files.size} 个：${[...files].sort().join(', ')}`);
console.log(`\n${'='.repeat(52)}`);
console.log(`打包完整性自检: ${pass} 通过, ${fail} 失败`);
console.log('='.repeat(52));
process.exit(fail === 0 ? 0 : 1);
