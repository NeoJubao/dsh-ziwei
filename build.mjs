// 构建脚本：把农历/节气数据表注入引擎，并组装客户端插件。
//
// 可重建性：数据表已随仓库 vendored 到 src/lunar-data.js（由
// scripts/vendor-lunar-data.mjs 从 solarlunar@3.1.0 抽取，ISC），
// 因此干净 clone 不依赖包外的 .ref/ 也能构建；.ref/ 仅作为再生成数据表时的来源。
//
// 两种用法：
//   node build.mjs          直接运行：写 engine-built.js 和 client.js（不接受任何参数）。
//   import '../build.mjs'   被自检 / 体检脚本导入：只导出拼接函数，不读写任何文件。
//
// client.js 的界面是 v6：src/ui/ 按文件名拼接（assembleUi），3D 星图是 vendor/three-r128.min.js + src/sky.js
// （assembleSky）。自检（verify/verify.mjs、verify/ui-v6.mjs）用同一组函数在内存里重拼，逐字节比对产物。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const ROOT = dirname(fileURLToPath(import.meta.url)); // ziwei-workbench/

/* ------------------------------------------------------------------ *
 * 引擎：农历数据注入
 * ------------------------------------------------------------------ */

function extractFromRef(root, name) {
  const refEsm = join(root, '..', '.ref', 'solarlunar-pkg', 'dist', 'solarlunar.esm.js');
  const esm = readFileSync(refEsm, 'utf8');
  const m = esm.match(new RegExp('var ' + name + ' = \\[([\\s\\S]*?)\\];'));
  if (!m) throw new Error('cannot find ' + name + ' in ' + refEsm);
  return m[1]
    .replace(/\/\*\*?[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/,\s*\]/g, ']')
    .trim();
}

/** 读农历 / 节气数据表；log 给了就打印条目数（直接运行时的那一行）。条目数不对直接抛错。 */
export async function loadLunarTables(root = ROOT, { log } = {}) {
  let lunarInfo;
  let lTermInfo;
  try {
    const data = await import(pathToFileURL(join(root, 'src', 'lunar-data.js')).href);
    lunarInfo = data.LUNAR_INFO;
    lTermInfo = data.LTERM_INFO;
  } catch (error) {
    console.warn(`[build] src/lunar-data.js 不可用（${error.message}），回退到 .ref/ 抽取`);
    lunarInfo = extractFromRef(root, 'lunarInfo');
    lTermInfo = extractFromRef(root, 'lTermInfo');
  }

  // 校验行数
  const liCount = (lunarInfo.match(/0x/g) || []).length;
  const ltCount = (lTermInfo.match(/'[^']+'/g) || []).length;
  if (log) log(`lunarInfo entries: ${liCount} (expect 201), lTermInfo entries: ${ltCount} (expect 201)`);
  if (liCount !== 201 || ltCount !== 201) throw new Error('data table extraction failed');
  return { lunarInfo, lTermInfo };
}

/** engine-built.js 的全文 = src/engine-core.js + 注入的数据表。 */
export async function buildEngine(root = ROOT, { log } = {}) {
  const { lunarInfo, lTermInfo } = await loadLunarTables(root, { log });
  return readFileSync(join(root, 'src', 'engine-core.js'), 'utf8')
    .replace('/*__LUNAR_INFO__*/', () => lunarInfo)
    .replace('/*__LTERM_INFO__*/', () => lTermInfo);
}

export function readPackageVersion(root = ROOT) {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  if (!version) throw new Error('package.json version missing');
  return version;
}

/* ------------------------------------------------------------------ *
 * client.js 的外壳
 * ------------------------------------------------------------------ */

// client.js = 懒加载内核包装 + 引擎 + 紫微师内核 + [3D 星图] + UI。
//
// 官方契约（cordis-plugin-development/references/ui-plugin.md）：
//   "Keep factories free of side effects... module-body side effects run at
//    materialization (factory(require) → exports)."
// 所以引擎/内核算在 __ziweiBootstrapKernel() 里，由 UI factory 首次物化时调用；
// bundle 加载期只注册 factory，不解析执行 226KB 的引擎，也不提前写 window 全局。
export const KERNEL_HEAD = `/* 懒加载内核：bundle 加载期只注册 factory；引擎/内核在首次物化时求值。
 * 官方契约见 dsh-agent-preset/skills/cordis-plugin-development/references/ui-plugin.md
 * 与 practices.md（module-body side effects run at materialization）。
 * 防回归：verify/verify.mjs 断言求值前 window.ZWEngine 不存在。 */
function __ziweiBootstrapKernel() {
  if (typeof window !== 'undefined' && window.ZWEngine && window.ZWCore) return;
`;
export const KERNEL_TAIL = `
}
`;

export function assembleClient({ engine, zcore, sky = '', ui }) {
  return KERNEL_HEAD + engine + '\n' + zcore + KERNEL_TAIL + sky + ui;
}

/* ------------------------------------------------------------------ *
 * v6：3D 星图（Three.js r128 + src/sky.js）
 * ------------------------------------------------------------------ */

/** vendor/three-r128.min.js 的 SHA-384（base64），和 cdnjs 公布的 SRI 一致。 */
export const THREE_SHA384 = 'CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu';

const SKY_HEAD = `/* 3D 星图：vendor/three-r128.min.js（MIT）+ src/sky.js。首页第一次可见时才调用 __ziweiBootstrapSky()。
 * 局部的 module / exports 接住 Three.js 的 UMD 导出，不产生 window.THREE；第一次调用后缓存。 */
function __ziweiBootstrapSky() {
  if (__ziweiBootstrapSky.api) return __ziweiBootstrapSky.api;
  var module = { exports: {} }, exports = module.exports;
`;
const SKY_MID = `
;var THREE = module.exports;
`;
const SKY_TAIL = `  return (__ziweiBootstrapSky.api = {
    acquire: function (host, opts) { return acquireSky(THREE, host, opts); },
    release: releaseSky,
    destroy: destroySky,
    create: function (canvas, opts) { return createSky(THREE, canvas, opts); }
  });
}
`;

/** vendor/three-r128.min.js 和 src/sky.js 都在时返回 __ziweiBootstrapSky 的完整函数文本，否则返回空串。 */
export function assembleSky(root = ROOT) {
  const threePath = join(root, 'vendor', 'three-r128.min.js');
  const skyPath = join(root, 'src', 'sky.js');
  if (!existsSync(threePath) || !existsSync(skyPath)) return '';
  const threeBuf = readFileSync(threePath);
  const digest = createHash('sha384').update(threeBuf).digest('base64');
  if (digest !== THREE_SHA384) {
    throw new Error(`vendor/three-r128.min.js 的 SHA-384 是 ${digest}，应为 ${THREE_SHA384}（文件被改过或不是 r128）`);
  }
  const sky = readFileSync(skyPath, 'utf8');
  checkTextFile('src/sky.js', sky);
  return SKY_HEAD + threeBuf.toString('utf8') + SKY_MID + sky + SKY_TAIL;
}

/* ------------------------------------------------------------------ *
 * v6：界面（src/ui/）
 * ------------------------------------------------------------------ */

const UI_HEAD = `/* ================================================================
 * 紫微斗数 v6 界面：由 build.mjs 按文件名顺序拼接 src/ui/（css、i18n 在构建时注入）。
 * 不要手改产物；改 src/ui/ 再构建。
 * ================================================================ */
window.__ModuleLoader__.load({
  id: '@local/ziwei-workbench',
  factory(require) {
    /* 首次物化时才求值引擎/内核（懒加载，见 build.mjs 的 KERNEL_HEAD） */
    if (typeof __ziweiBootstrapKernel === 'function') __ziweiBootstrapKernel();
`;
const UI_TAIL = `    return __ziweiPlugin;
  }
});
`;

const PH_CSS = '/*__ZIWEI_CSS__*/';
const PH_PROSE = '/*__ZIWEI_CSS:prose__*/';
const PH_DICT = '/*__ZIWEI_DICT__*/{}';
const PH_VERSION = "'__ZIWEI_VERSION__'";
const PROSE_FILE = '85-prose.css';
const NAME_RE = { js: /^\d{2}-[a-z0-9][a-z0-9-]*\.js$/, css: /^\d{2}-[a-z0-9][a-z0-9-]*\.css$/, json: /^\d{2}-[a-z0-9][a-z0-9-]*\.json$/ };

function checkTextFile(label, text) {
  if (text.includes('\r')) throw new Error(`${label} 含 \\r（只用 LF 换行）`);
  if (!text.endsWith('\n')) throw new Error(`${label} 缺结尾换行`);
}

function listSources(dir, re, label) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) continue;
    if (!re.test(name)) throw new Error(`${label}/${name}：文件名应形如 NN-名字（两位数字 + 小写字母、数字、连字符）`);
    out.push({ name, text: readFileSync(abs, 'utf8') });
  }
  return out;
}

/** 读 src/ui/ 的源文件：{ js, css, i18n }，每项是按文件名排好序的 [{ name, text }]。 */
export function readUiSources(root = ROOT) {
  const dir = join(root, 'src', 'ui');
  if (!existsSync(dir)) throw new Error('找不到 src/ui/');
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    if (statSync(join(dir, name)).isDirectory() && name !== 'css' && name !== 'i18n') {
      throw new Error(`src/ui/${name}/：只认 css/ 和 i18n/ 两个子目录`);
    }
  }
  return {
    js: listSources(dir, NAME_RE.js, 'src/ui'),
    css: listSources(join(dir, 'css'), NAME_RE.css, 'src/ui/css'),
    i18n: listSources(join(dir, 'i18n'), NAME_RE.json, 'src/ui/i18n')
  };
}

/** JSON 顶层对象的键（按出现顺序，含重复）。JSON.parse 会悄悄吞掉重复键，所以单独扫一遍。 */
function topLevelJsonKeys(text) {
  const keys = [];
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      let s = '';
      while (j < text.length && text[j] !== '"') {
        if (text[j] === '\\') { s += text.slice(j, j + 2); j += 2; continue; }
        s += text[j];
        j++;
      }
      if (depth === 1) {
        let k = j + 1;
        while (k < text.length && /\s/.test(text[k])) k++;
        if (text[k] === ':') keys.push(JSON.parse('"' + s + '"'));
      }
      i = j + 1;
      continue;
    }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    i++;
  }
  return keys;
}

/** i18n/*.json → { 'zh-CN': {...}, 'en-US': {...} }。键重复、值不是 [中文, English] 都抛错。 */
function buildDict(files) {
  const zh = {};
  const en = {};
  const seen = new Map();
  for (const f of files) {
    const label = `src/ui/i18n/${f.name}`;
    checkTextFile(label, f.text);
    let data;
    try { data = JSON.parse(f.text); } catch (e) { throw new Error(`${label} 不是合法 JSON：${e.message}`); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${label} 顶层应是对象`);
    for (const key of topLevelJsonKeys(f.text)) {
      if (seen.has(key)) throw new Error(`i18n 键重复：${key}（${seen.get(key)} 和 ${label}）`);
      seen.set(key, label);
    }
    for (const [key, pair] of Object.entries(data)) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error(`${label}：键 ${JSON.stringify(key)} 应是驼峰标识符`);
      if (!Array.isArray(pair) || pair.length !== 2 || pair.some((v) => typeof v !== 'string' || !v)) {
        throw new Error(`${label}：${key} 的值应是 ["中文", "English"]，两项都非空`);
      }
      zh[key] = pair[0];
      en[key] = pair[1];
    }
  }
  return { 'zh-CN': zh, 'en-US': en };
}

const countOf = (text, needle) => text.split(needle).length - 1;

/** 顶层声明（按约定写在行首）：function / class / const / let / var。 */
function columnZeroNames(text) {
  const names = [];
  const re = /^(?:async\s+)?(?:function\*?\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm;
  let m;
  while ((m = re.exec(text))) names.push({ name: m[1] || m[2] || m[3], line: text.slice(0, m.index).split('\n').length });
  return names;
}

/** assembleUi 的结果里，text 下标 index 来自哪个源文件的第几行；落在生成的外壳里时 file 为 '(generated)'。 */
export function locate(map, text, index) {
  for (const seg of map) {
    if (index >= seg.start && index < seg.end) {
      return { file: seg.file, line: seg.line + countOf(text.slice(seg.start, index), '\n') };
    }
  }
  return { file: '(generated)', line: 0 };
}

/**
 * 纯函数版拼接：sources = { js, css, i18n }（readUiSources 的形状），返回 { text, map }。
 * map 是 [{ file, start, end, line }]：text 里 [start, end) 这一段来自 file，从它的第 line 行开始。
 * 构建期拒绝：\r、缺结尾换行、CSS 含反引号 / ${ / 反斜杠、i18n 键重复、占位符次数不对、
 * 重名的顶层声明、拼起来过不了语法检查。
 */
export function assembleUiFrom(sources, { version }) {
  if (!version) throw new Error('assembleUi 需要 version');
  const js = sources.js || [];
  const css = sources.css || [];
  if (!js.length) throw new Error('src/ui/ 下没有 NN-*.js');

  for (const f of js) checkTextFile(`src/ui/${f.name}`, f.text);
  for (const f of css) {
    const label = `src/ui/css/${f.name}`;
    checkTextFile(label, f.text);
    if (f.text.includes('`')) throw new Error(`${label} 含反引号（CSS 注入在模板字符串里）`);
    if (f.text.includes('${')) throw new Error(`${label} 含 \${（CSS 注入在模板字符串里）`);
    if (f.text.includes('\\')) throw new Error(`${label} 含反斜杠（CSS 注入在模板字符串里）`);
  }
  const dict = buildDict(sources.i18n || []);
  const dictText = JSON.stringify(dict, null, 2);

  const allJs = js.map((f) => f.text).join('\n');
  const count = (needle) => countOf(allJs, needle);
  if (count(PH_VERSION) !== 1) throw new Error(`${PH_VERSION} 应在 src/ui/*.js 里恰好出现一次（现在 ${count(PH_VERSION)} 次）`);
  if (count(PH_CSS) !== 1) throw new Error(`${PH_CSS} 应恰好出现一次（现在 ${count(PH_CSS)} 次）`);
  if (count(PH_DICT) !== 1) throw new Error(`${PH_DICT} 应恰好出现一次（现在 ${count(PH_DICT)} 次）`);
  if (count(PH_PROSE) > 1) throw new Error(`${PH_PROSE} 最多出现一次（现在 ${count(PH_PROSE)} 次）`);
  const prose = css.find((f) => f.name === PROSE_FILE);
  if (count(PH_PROSE) === 1 && !prose) throw new Error(`${PH_PROSE} 需要 src/ui/css/${PROSE_FILE}`);
  if (/@local\/ziwei-workbench/.test(allJs)) throw new Error('src/ui/*.js 里不能出现包名 @local/ziwei-workbench（入口 id 只在外壳里出现一次）');
  if (!/^const __ziweiPlugin\b/m.test(allJs)) throw new Error('src/ui/ 里缺 const __ziweiPlugin（factory 的返回值）');

  /* 重名的顶层声明：行首的声明按名字查一遍（覆盖 var），再用严格模式块编译兜底（function / class / const / let） */
  const owner = new Map();
  for (const f of js) {
    for (const { name, line } of columnZeroNames(f.text)) {
      const at = `src/ui/${f.name}:${line}`;
      if (owner.has(name)) throw new Error(`重名的顶层声明 ${name}：${owner.get(name)} 和 ${at}`);
      owner.set(name, at);
    }
  }

  /* 拼接：每个文件前面一行标记；占位符处切开，注入的内容单独记一段 map */
  const pieces = [];
  const push = (text, file, line) => { if (text) pieces.push({ text, file, line }); };
  const cssPieces = (list) => list.map((f) => [
    { text: `/* ---- src/ui/css/${f.name} ---- */\n`, file: null, line: 0 },
    { text: f.text, file: `src/ui/css/${f.name}`, line: 1 }
  ]).flat();
  const injections = [
    [PH_CSS, cssPieces(css)],
    [PH_PROSE, prose ? [{ text: prose.text, file: `src/ui/css/${prose.name}`, line: 1 }] : []],
    [PH_DICT, [{ text: dictText, file: 'src/ui/i18n/*.json', line: 1 }]],
    [PH_VERSION, [{ text: JSON.stringify(version), file: null, line: 0 }]]
  ];

  push(UI_HEAD, null, 0);
  for (const f of js) {
    const file = `src/ui/${f.name}`;
    push(`/* ---- ${file} ---- */\n`, null, 0);
    let rest = f.text;
    let restLine = 1;
    for (;;) {
      let hit = null;
      for (const [ph, inject] of injections) {
        const at = rest.indexOf(ph);
        if (at >= 0 && (!hit || at < hit.at)) hit = { at, ph, inject };
      }
      if (!hit) break;
      const before = rest.slice(0, hit.at);
      push(before, file, restLine);
      for (const p of hit.inject) push(p.text, p.file, p.line);
      restLine += countOf(before, '\n');
      rest = rest.slice(hit.at + hit.ph.length);
    }
    push(rest, file, restLine);
  }
  push(UI_TAIL, null, 0);

  const map = [];
  let text = '';
  for (const p of pieces) {
    if (p.file) map.push({ file: p.file, start: text.length, end: text.length + p.text.length, line: p.line });
    text += p.text;
  }

  const leftover = /\/\*__ZIWEI_[A-Z_:a-z]*__\*\//.exec(text);
  if (leftover) {
    const at = locate(map, text, leftover.index);
    throw new Error(`不认识的占位符 ${leftover[0]}（${at.file}:${at.line}）`);
  }
  if (countOf(text, "id: '@local/ziwei-workbench'") !== 1) throw new Error("id: '@local/ziwei-workbench' 应恰好出现一次");

  /* 语法：真实形状（sloppy 的 factory 方法体）先编一次；再在严格模式的块里编一次，查重名声明 */
  const fail = (err, prefix, offset) => {
    const m = /:(\d+)\s*$/.exec(String(err.stack || '').split('\n')[0]);
    let where = '';
    if (m) {
      const lineNo = Number(m[1]) - offset;
      const lines = text.split('\n');
      const index = lines.slice(0, Math.max(0, lineNo - 1)).join('\n').length + (lineNo > 1 ? 1 : 0);
      const at = locate(map, text, index);
      where = `（${at.file}:${at.line}）`;
    }
    throw new Error(`${prefix}：${err.message}${where}`);
  };
  try {
    new vm.Script(text, { filename: 'v6-ui.js' });
  } catch (err) { fail(err, 'v6 界面语法错误', 0); }
  const body = text.slice(UI_HEAD.length, text.length - UI_TAIL.length);
  try {
    new vm.Script('"use strict";(function(){{\n' + body + '\n}})', { filename: 'v6-ui-strict.js' });
  } catch (err) { fail(err, 'v6 界面源码须兼容严格模式且没有重名的顶层声明', 1 - countOf(UI_HEAD, '\n')); }

  return { text, map };
}

/** v6 界面：读 src/ui/ 并拼接，返回 { text, map }。 */
export function assembleUi(root = ROOT, { version }) {
  return assembleUiFrom(readUiSources(root), { version });
}

/* ------------------------------------------------------------------ *
 * 直接运行：出 v6 产物
 * ------------------------------------------------------------------ */

async function main() {
  const engine = await buildEngine(ROOT, { log: (s) => console.log(s) });
  const version = readPackageVersion(ROOT);
  const zcore = readFileSync(join(ROOT, 'src', 'ziwei-core.js'), 'utf8');
  const ui = assembleUi(ROOT, { version }).text;
  const sky = assembleSky(ROOT);

  // 引擎单独文件(供 Node 测试与 host 沙箱): 带数据
  writeFileSync(join(ROOT, 'engine-built.js'), engine);
  writeFileSync(join(ROOT, 'client.js'), assembleClient({ engine, zcore, sky, ui }));

  console.log('built: engine-built.js, client.js');
}

const isMain = (() => {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) await main();
