// 构建脚本：把农历/节气数据表注入引擎，并组装客户端插件。
//
// 可重建性：数据表已随仓库 vendored 到 src/lunar-data.js（由
// scripts/vendor-lunar-data.mjs 从 solarlunar@3.1.0 抽取，ISC），
// 因此干净 clone 不依赖包外的 .ref/ 也能构建；.ref/ 仅作为再生成数据表时的来源。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)); // ziwei-workbench/
const srcDir = join(root, 'src');

function extractFromRef(name) {
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

let lunarInfo;
let lTermInfo;
try {
  const data = await import('./src/lunar-data.js');
  lunarInfo = data.LUNAR_INFO;
  lTermInfo = data.LTERM_INFO;
} catch (error) {
  console.warn(`[build] src/lunar-data.js 不可用（${error.message}），回退到 .ref/ 抽取`);
  lunarInfo = extractFromRef('lunarInfo');
  lTermInfo = extractFromRef('lTermInfo');
}

// 校验行数
const liCount = (lunarInfo.match(/0x/g) || []).length;
const ltCount = (lTermInfo.match(/'[^']+'/g) || []).length;
console.log(`lunarInfo entries: ${liCount} (expect 201), lTermInfo entries: ${ltCount} (expect 201)`);
if (liCount !== 201 || ltCount !== 201) throw new Error('data table extraction failed');

const engine = readFileSync(join(srcDir, 'engine-core.js'), 'utf8')
  .replace('/*__LUNAR_INFO__*/', lunarInfo)
  .replace('/*__LTERM_INFO__*/', lTermInfo);

const zcore = readFileSync(join(srcDir, 'ziwei-core.js'), 'utf8');
const ui = readFileSync(join(srcDir, 'ui-pro.js'), 'utf8');

// 引擎单独文件(供 Node 测试与 host 沙箱): 带数据
writeFileSync(join(root, 'engine-built.js'), engine);

// client.js = 懒加载内核包装 + 引擎 + 紫微师内核 + UI。
//
// 官方契约（cordis-plugin-development/references/ui-plugin.md）：
//   "Keep factories free of side effects... module-body side effects run at
//    materialization (factory(require) → exports)."
// 所以引擎/内核算在 __ziweiBootstrapKernel() 里，由 UI factory 首次物化时调用；
// bundle 加载期只注册 factory，不解析执行 226KB 的引擎，也不提前写 window 全局。
const KERNEL_HEAD = `/* 懒加载内核：bundle 加载期只注册 factory；引擎/内核在首次物化时求值。
 * 官方契约见 dsh-agent-preset/skills/cordis-plugin-development/references/ui-plugin.md
 * 与 practices.md（module-body side effects run at materialization）。
 * 防回归：verify/verify.mjs 断言求值前 window.ZWEngine 不存在。 */
function __ziweiBootstrapKernel() {
  if (typeof window !== 'undefined' && window.ZWEngine && window.ZWCore) return;
`;
const KERNEL_TAIL = `
}
`;

writeFileSync(join(root, 'client.js'), KERNEL_HEAD + engine + '\n' + zcore + KERNEL_TAIL + ui);

console.log('built: engine-built.js, client.js');
