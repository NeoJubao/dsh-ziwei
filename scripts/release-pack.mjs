#!/usr/bin/env node
/**
 * scripts/release-pack.mjs — 生成可对外发布的 npm 包（只写 dist/，不发布）
 *
 * 背景
 *   仓库里的包名固定为 @local/ziwei-workbench 且 private=true，因为本机 DSH
 *   profile 用 link: 挂载它；改名会直接搞坏正在运行的插件。对外发布时不能改
 *   仓库里的 package.json，只能在 dist/ 里生成一个「发布用副本」：
 *
 *     - name 改成可发布名（默认 dsh-plugin-ziwei-workbench，可用 --name 覆盖）
 *     - private=false、publishConfig.access=public
 *     - files 增补 LICENSE / THIRD_PARTY_NOTICES.md / CHANGELOG.md（ISC 要求
 *       许可声明随副本分发；npm 只会自动带 README + LICENSE）
 *     - cordis.patch.yml 的 name 与新包名一致（不一致会导致安装后层加载不到）
 *     - client.js 里 __ModuleLoader__ 的 id 与新包名一致（DSH 用「解析后的包名」
 *       标识浏览器模块；不一致会导致客户端 bundle 找不到）
 *
 * 用法
 *   node scripts/release-pack.mjs            # 生成 dist/<包名>/ 并执行 npm pack
 *   node scripts/release-pack.mjs --dry      # 只打印计划，不写文件、不跑 npm
 *   node scripts/release-pack.mjs --name @neojubao/ziwei-workbench
 *
 * 注意
 *   - 不调用 `npm publish`；tarball 生成后由人或 release.yml 手动发布。
 *   - 只写 <repo>/dist/，不碰 ~/.dsh/profiles、不改仓库 package.json。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PUBLISH_NAME = 'dsh-plugin-ziwei-workbench';
/* 必附文件：package.json 是发布清单本身；其余四个是许可/说明，npm 只会自动带 README+LICENSE */
const ALWAYS_INCLUDE = ['package.json', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CHANGELOG.md'];
const TEXT_EXT = new Set(['.md', '.json', '.js', '.mjs', '.yml', '.yaml', '.txt']);
const NPM_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */
const argv = process.argv.slice(2);
const opts = { dry: false, name: DEFAULT_PUBLISH_NAME, help: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--dry' || a === '--dry-run') opts.dry = true;
  else if (a === '--help' || a === '-h') opts.help = true;
  else if (a === '--name') {
    opts.name = argv[++i];
    if (!opts.name) fail('--name 需要一个参数');
  } else if (a.startsWith('--name=')) opts.name = a.slice('--name='.length);
  else fail(`未知参数: ${a}（可用: --dry / --name <pkg> / --help）`);
}

if (opts.help) {
  console.log(`用法: node scripts/release-pack.mjs [--dry] [--name <npm 包名>]

  --dry          只打印发布计划：文件清单、改写项、校验结果；不写 dist/、不执行 npm pack
  --name <pkg>   指定发布包名（默认 ${DEFAULT_PUBLISH_NAME}；也可用 @scope/name）
  --help         显示本帮助`);
  process.exit(0);
}

function fail(msg) {
  console.error(`\n✗ release-pack 失败：${msg}\n`);
  process.exit(1);
}
function ok(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }

/* ------------------------------------------------------------------ *
 * 0. 参数与前置文件
 * ------------------------------------------------------------------ */
if (!NPM_NAME_RE.test(opts.name || '')) {
  fail(`发布包名不合法: ${JSON.stringify(opts.name)}（npm 包名只能小写字母/数字/-._~，scope 形如 @scope/name）`);
}
const pkgPath = join(ROOT, 'package.json');
if (!existsSync(pkgPath)) fail(`找不到 ${pkgPath}`);
let pkg;
try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch (e) { fail(`package.json 不是合法 JSON: ${e.message}`); }

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(pkg.version || ''))) {
  fail(`package.json version 不是合法 SemVer: ${JSON.stringify(pkg.version)}`);
}
if (pkg.license !== 'MIT') fail(`package.json license 必须是 MIT（当前 ${JSON.stringify(pkg.license)}）`);
if (!pkg.dsh || !pkg.dsh.bundle || !pkg.dsh.client) fail('package.json 缺 dsh.bundle / dsh.client 声明');
if (pkg.dsh.manifestVersion !== 1) fail('package.json dsh.manifestVersion 必须是 1');
if (!pkg.engines || !pkg.engines.dsh) fail('package.json 缺 engines.dsh（DSH 兼容范围声明）');

/* 必附文件 + 许可/隐私检查（CI 也靠这一步兜底） */
const requiredFiles = { 'LICENSE': null, 'THIRD_PARTY_NOTICES.md': null, 'README.md': null, 'CHANGELOG.md': null };
for (const f of Object.keys(requiredFiles)) {
  const p = join(ROOT, f);
  if (!existsSync(p)) fail(`缺必附文件 ${f}（发布包必须包含 LICENSE / THIRD_PARTY_NOTICES / README / CHANGELOG）`);
  requiredFiles[f] = p;
}
const licenseText = readFileSync(requiredFiles['LICENSE'], 'utf8');
if (!/^MIT License/m.test(licenseText) || !/Copyright \(c\) \d{4}/.test(licenseText)) {
  fail('LICENSE 不是标准 MIT 文本（缺少 "MIT License" 头或版权行）');
}
const noticesText = readFileSync(requiredFiles['THIRD_PARTY_NOTICES.md'], 'utf8');
for (const marker of ['solarlunar', 'ISC', 'yize', '3.1.0']) {
  if (!noticesText.includes(marker)) fail(`THIRD_PARTY_NOTICES.md 缺关键标记 "${marker}"（solarlunar ISC 全文/版本必须保留）`);
}
const readmeText = readFileSync(requiredFiles['README.md'], 'utf8');
if (/\/Users\//.test(readmeText)) fail('README.md 含本机绝对路径 "/Users/"，先脱敏再发布');

/* ------------------------------------------------------------------ *
 * 1. 计算源文件清单：package.json.files 展开 + 必附文件
 * ------------------------------------------------------------------ */
/** 递归列出目录下的所有文件（返回相对 ROOT 的路径，用 / 分隔）。 */
function walkDir(relDir) {
  const out = [];
  const walk = (absDir, relBase) => {
    for (const name of readdirSync(absDir).sort()) {
      if (name === '.DS_Store' || name === 'Thumbs.db') continue;
      const abs = join(absDir, name);
      const rel = relBase ? `${relBase}/${name}` : name;
      const st = statSync(abs);
      if (st.isDirectory()) walk(abs, rel);
      else out.push(rel);
    }
  };
  walk(join(ROOT, relDir), '');
  return out;
}

function expandFiles(patterns) {
  const out = [];
  for (const raw of patterns) {
    const pattern = String(raw).replace(/^\.\//, '').replace(/\/+$/, '');
    if (pattern.includes('*')) {
      /* 只支持单层 basename glob（例如 locale/*.json） */
      const m = pattern.match(/^([^*]+)\/([^/]*\*[^/]*)$/);
      if (!m) fail(`不支持的 files glob 形式: ${pattern}（只支持 dir/*.ext，目录可多级）`);
      const dir = join(ROOT, m[1]);
      if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`files glob 的目录不存在: ${m[1]}`);
      const re = new RegExp('^' + m[2].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      const hits = readdirSync(dir).filter((n) => re.test(n)).sort();
      if (!hits.length) fail(`files glob 没匹配到文件: ${pattern}`);
      for (const n of hits) out.push(`${m[1]}/${n}`);
      continue;
    }
    const abs = join(ROOT, pattern);
    if (!existsSync(abs)) fail(`package.json files 里的 ${pattern} 不存在`);
    /* npm files 允许写目录：目录按递归内容打包，这里同样递归复制 */
    if (statSync(abs).isDirectory()) out.push(...walkDir(pattern));
    else out.push(pattern);
  }
  return out;
}

const declared = Array.isArray(pkg.files) ? pkg.files : [];
if (!declared.length) fail('package.json 缺 files 清单');
const sourceFiles = [...new Set([...declared.flatMap((p) => expandFiles([p])), ...ALWAYS_INCLUDE])].sort();

/* 隐私兜底：README / docs 等对外文档硬拒绝本机绝对路径；
   其它随包文件（多为开发期 verify 脚本）先告警——发布前请清零，不要装看不见。 */
const PUBLIC_DOC_RE = /^(README[^/]*\.md|docs\/)/;
const localPathHits = [];
for (const rel of sourceFiles) {
  const abs = join(ROOT, rel);
  if (!TEXT_EXT.has(rel.slice(rel.lastIndexOf('.')).toLowerCase())) continue;
  if (!/\/Users\//.test(readFileSync(abs, 'utf8'))) continue;
  localPathHits.push(rel);
  if (PUBLIC_DOC_RE.test(rel)) fail(`${rel} 含本机绝对路径 "/Users/"，对外文档必须先脱敏`);
}
if (localPathHits.length) {
  warn(`以下随包文件含本机绝对路径 "/Users/"（不阻断生成，但发布前应改为可移植解析）：\n    - ${localPathHits.join('\n    - ')}`);
}
for (const rel of sourceFiles) {
  if (/\.log$/i.test(rel)) fail(`files 清单里不应包含日志文件: ${rel}`);
}

/* ------------------------------------------------------------------ *
 * 2. 发布计划
 * ------------------------------------------------------------------ */
const distRoot = join(ROOT, 'dist');
const distDir = join(distRoot, opts.name);
if (!resolve(distDir).startsWith(resolve(distRoot) + sep)) fail(`dist 路径越界: ${distDir}`);

const totalBytes = sourceFiles.reduce((n, rel) => n + statSync(join(ROOT, rel)).size, 0);
const rewrites = [
  ['package.json', `name → ${opts.name}；private=false；publishConfig.access=public；files 增补 ${ALWAYS_INCLUDE.filter((f) => !declared.some((d) => d === f)).join('/')}`],
  ['cordis.patch.yml', `name → '${opts.name}'（必须与包名一致，否则安装后层不生效）`],
  ['client.js', `__ModuleLoader__ 的 id → '${opts.name}'（浏览器模块以解析后的包名为标识）`]
];

console.log('== release-pack 发布计划 ==');
console.log(`  仓库根目录 : ${ROOT}`);
console.log(`  版本       : ${pkg.version}（保留；发布前先决定是否按 SemVer 升版）`);
console.log(`  源包名     : ${pkg.name}（private=${pkg.private === true}，仓库内保持不变）`);
console.log(`  发布包名   : ${opts.name}`);
console.log(`  输出目录   : ${distDir}`);
console.log(`  文件       : ${sourceFiles.length} 个 / ${(totalBytes / 1024).toFixed(1)} KB（改写前）`);
for (const rel of sourceFiles) {
  const size = statSync(join(ROOT, rel)).size;
  console.log(`    - ${rel} (${(size / 1024).toFixed(1)} KB)`);
}
console.log('  改写项:');
for (const [file, what] of rewrites) console.log(`    - ${file}: ${what}`);
console.log('  前置校验: LICENSE(MIT) ✓ / THIRD_PARTY_NOTICES(solarlunar ISC 全文) ✓ / README 无绝对路径 ✓ / dsh 声明完整 ✓');

if (opts.dry) {
  console.log('\n--dry：仅打印计划，未写 dist/、未执行 npm pack、未发布。');
  process.exit(0);
}

/* ------------------------------------------------------------------ *
 * 3. 复制到 dist/<发布包名>/
 * ------------------------------------------------------------------ */
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
for (const rel of sourceFiles) {
  const dest = join(distDir, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, readFileSync(join(ROOT, rel)));
}

/* ------------------------------------------------------------------ *
 * 4. 改写发布副本（只改 dist/，仓库文件一个字节都不动）
 * ------------------------------------------------------------------ */
const distPkgPath = join(distDir, 'package.json');
const distPkg = JSON.parse(readFileSync(distPkgPath, 'utf8'));
distPkg.name = opts.name;
distPkg.private = false;
distPkg.publishConfig = Object.assign({}, distPkg.publishConfig, { access: 'public' });
distPkg.files = [...new Set([...(distPkg.files || []), ...ALWAYS_INCLUDE.filter((f) => f !== 'package.json')])].sort();
writeFileSync(distPkgPath, JSON.stringify(distPkg, null, 2) + '\n');
ok(`package.json 已改写（name=${opts.name}, private=false, access=public）`);

const patchPath = join(distDir, 'cordis.patch.yml');
const patchBefore = readFileSync(patchPath, 'utf8');
const patchAfter = patchBefore.replace(
  /^(\s*name:\s*)'@local\/ziwei-workbench'\s*$/m,
  (_, head) => `${head}'${opts.name}'`
);
if (patchAfter === patchBefore) fail('cordis.patch.yml 里没找到 name: \'@local/ziwei-workbench\'，无法与新包名同步');
writeFileSync(patchPath, patchAfter);
ok(`cordis.patch.yml 已把 name 改成 ${opts.name}`);

const clientPath = join(distDir, 'client.js');
const clientBefore = readFileSync(clientPath, 'utf8');
const ID_RE = /id: '@local\/ziwei-workbench'/g;
const idHits = (clientBefore.match(ID_RE) || []).length;
if (idHits !== 1) fail(`client.js 里 '@local/ziwei-workbench' 出现 ${idHits} 次（预期 1 次，模块 id 未按预期改写）`);
const clientAfter = clientBefore.replace(ID_RE, `id: '${opts.name}'`);
writeFileSync(clientPath, clientAfter);
ok(`client.js 已把 __ModuleLoader__ id 改成 ${opts.name}`);

/* 改写后自检：dist 副本必须是自洽的 */
const checkPkg = JSON.parse(readFileSync(distPkgPath, 'utf8'));
if (checkPkg.name !== opts.name) fail('dist package.json 改写后 name 不一致');
if (checkPkg.private !== false) fail('dist package.json private 仍非 false');
if (!readFileSync(patchPath, 'utf8').includes(`name: '${opts.name}'`)) fail('dist cordis.patch.yml 改写后 name 不一致');
if (!readFileSync(clientPath, 'utf8').includes(`id: '${opts.name}'`)) fail('dist client.js 改写后 id 不一致');

/* ------------------------------------------------------------------ *
 * 5. npm pack 生成 tarball（不发布）
 * ------------------------------------------------------------------ */
const npmCache = join(tmpdir(), 'ziwei-release-pack-cache');
mkdirSync(npmCache, { recursive: true });
const pack = spawnSync('npm', ['pack', '--ignore-scripts', '--json'], {
  cwd: distDir,
  encoding: 'utf8',
  timeout: 180000,
  env: Object.assign({}, process.env, { npm_config_cache: npmCache })
});
if (pack.error) fail(`无法执行 npm pack: ${String(pack.error.message || pack.error).split('\n')[0]}`);
if (pack.status !== 0) fail(`npm pack 退出码 ${pack.status}\n${String(pack.stderr || '').slice(0, 2000)}`);

let packMeta;
try { packMeta = JSON.parse(pack.stdout); } catch (e) {
  fail(`npm pack 输出不是 JSON: ${String(pack.stdout || '').slice(0, 800)}`);
}
const entry = Array.isArray(packMeta) ? packMeta[0] : packMeta[Object.keys(packMeta)[0]];
const tarball = join(distDir, entry.filename);
const packed = (entry.files || []).map((f) => f.path);
for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'CHANGELOG.md', 'cordis.patch.yml']) {
  if (!packed.includes(f)) fail(`tarball 内缺 ${f}（files 清单或 .npmignore 有问题）`);
}

console.log('\n== 打包完成（未发布） ==');
console.log(`  tarball : ${tarball}（${statSync(tarball).size} bytes）`);
console.log(`  包内文件: ${packed.length} 个`);
console.log('\n下一步（由维护者手动执行，本脚本不会发布）：');
console.log(`  npm publish "${tarball}" --access public        # 或走 .github/workflows/release.yml（OIDC）`);
console.log('  发布流程与前置条件见 docs/PUBLISHING.md。');
