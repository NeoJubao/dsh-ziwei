/**
 * verify/ui-v6.mjs — v6 界面自检（verify/all.mjs 第 9 组）
 *
 *   node verify/ui-v6.mjs                  在内存里拼出 v6 的 client（build.mjs 的拼接函数），
 *                                          再按文件名顺序运行 verify/ui-v6-*.mjs
 *   node verify/ui-v6.mjs --write-preview  另外把拼好的 client 写到 audit/preview-shell/client.v6.js
 *                                          （本机预览壳读它；audit/ 不进仓库）。除此之外不写任何文件。
 *
 * 切换之前 client.js 仍是 v5（node build.mjs 只出 v5），v6 只在这里检查。
 *
 * 检查文件的写法：export default async function (t) { ... }。t 里有
 *   root / version          仓库根目录、package.json 的版本号
 *   ui                      assembleUi 的结果 { text, map }；拼接失败时为 null，原因在 uiError
 *   sky / engine / zcore    3D 星图（没有 vendor 或 sky.js 时是空串）、引擎全文、紫微师内核
 *   client                  拼好的完整 client（= assembleClient(...)）；拼接失败时为 null
 *   ok(name, cond, detail)  记一条断言；section(title) 打印小节标题
 * 公共的装载工具和假 React 在 verify/client-harness.mjs。
 */
/* 自检不写 interpret-diag.log（那是给真实面板排障用的） */
process.env.ZIWEI_DIAG = '0';

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assembleClient, assembleSky, assembleUi, buildEngine, readPackageVersion } from '../build.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const args = process.argv.slice(2);
const WRITE_PREVIEW = args.includes('--write-preview');
const unknown = args.filter((a) => a !== '--write-preview');
if (unknown.length) {
  console.error(`未知参数：${unknown.join(' ')}（只认 --write-preview）`);
  process.exit(2);
}

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};
const section = (title) => console.log(`\n== ${title} ==`);

section('v6 拼接（build.mjs）');
const version = readPackageVersion(root);
let ui = null, uiError = null;
try { ui = assembleUi(root, { version }); } catch (e) { uiError = e; }
ok('assembleUi 拼出 v6 界面（src/ui/）', !!ui, uiError && uiError.message);
let sky = '', skyError = null;
try { sky = assembleSky(root); } catch (e) { skyError = e; }
ok('assembleSky 不抛错（vendor/three-r128.min.js 或 src/sky.js 缺一个时为空串）', !skyError, skyError && skyError.message);
const engine = await buildEngine(root);
const zcore = readFileSync(join(root, 'src', 'ziwei-core.js'), 'utf8');
const client = ui ? assembleClient({ engine, zcore, sky, ui: ui.text }) : null;

if (WRITE_PREVIEW) {
  if (client) {
    const dir = join(root, 'audit', 'preview-shell');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'client.v6.js'), client);
    console.log(`  写出 audit/preview-shell/client.v6.js（${(Buffer.byteLength(client) / 1024).toFixed(1)} KB）`);
  } else {
    ok('--write-preview：v6 拼接成功才能写预览', false, '拼接失败，没有写文件');
  }
}

const files = readdirSync(here).filter((n) => /^ui-v6-[a-z0-9-]+\.mjs$/.test(n)).sort();
ok(`找到 v6 检查文件（${files.join(', ') || '无'}）`, files.length > 0);

const t = { root, version, ui, uiError, sky, engine, zcore, client, ok, section };
for (const file of files) {
  let mod = null;
  try {
    mod = await import(pathToFileURL(join(here, file)).href);
  } catch (e) {
    ok(`${file} 可以加载`, false, e.message);
    continue;
  }
  if (typeof mod.default !== 'function') {
    ok(`${file} 导出 default 函数`, false);
    continue;
  }
  try {
    await mod.default(t);
  } catch (e) {
    ok(`${file} 跑完没有抛错`, false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | '));
  }
}

console.log(`\n${'='.repeat(52)}`);
console.log(`v6 界面自检: ${pass} 通过, ${fail} 失败`);
console.log('='.repeat(52));
process.exit(fail === 0 ? 0 : 1);
