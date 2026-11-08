#!/usr/bin/env node
/**
 * scripts/vendor-lunar-data.mjs — 重新生成 src/lunar-data.js 的农历/节气数据表。
 *
 * 数据来源：solarlunar@3.1.0 的 ESM 产物（ISC License, Copyright (c) 2015, yize）。
 * 抽取 lunarInfo / lTermInfo 各 201 项，校验数量后写入 src/lunar-data.js。
 *
 * 用法：
 *   node scripts/vendor-lunar-data.mjs                 # 从本机 .ref/ 抽取（维护者工作区）
 *   node scripts/vendor-lunar-data.mjs --esm <path>    # 指定 solarlunar.esm.js
 *   node scripts/vendor-lunar-data.mjs --check         # 只校验当前 src/lunar-data.js 是否 201 项
 *
 * 注意：生成文件是构建期数据，不属于运行时逻辑；提交前跑 --check。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'src', 'lunar-data.js');
const args = process.argv.slice(2);
const esmArgIdx = args.indexOf('--esm');
const checkOnly = args.includes('--check');

function count(lunarInfo, lTermInfo) {
  return {
    lunar: (lunarInfo.match(/0x/g) || []).length,
    term: (lTermInfo.match(/'[^']+'/g) || []).length
  };
}

function extractArray(esm, name) {
  const m = esm.match(new RegExp('var ' + name + ' = \\[([\\s\\S]*?)\\];'));
  if (!m) throw new Error('cannot find ' + name);
  return m[1]
    .replace(/\/\*\*?[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .replace(/,\s*\]/g, ']')
    .trim();
}

if (checkOnly) {
  const current = readFileSync(outFile, 'utf8');
  const lunarInfo = (current.match(/LUNAR_INFO = "([^"]+)"/) || [])[1] || '';
  const lTermInfo = (current.match(/LTERM_INFO = "([^"]+)"/) || [])[1] || '';
  const { lunar, term } = count(lunarInfo, lTermInfo);
  console.log(`src/lunar-data.js: lunarInfo=${lunar} lTermInfo=${term}`);
  process.exit(lunar === 201 && term === 201 ? 0 : 1);
}

const candidates = [
  esmArgIdx >= 0 ? args[esmArgIdx + 1] : '',
  join(root, '..', '.ref', 'solarlunar-pkg', 'dist', 'solarlunar.esm.js'),
  join(root, 'node_modules', 'solarlunar', 'dist', 'solarlunar.esm.js')
].filter(Boolean);

const esmFile = candidates.find((p) => {
  try { readFileSync(p); return true; } catch (e) { return false; }
});
if (!esmFile) {
  console.error('找不到 solarlunar ESM 产物；用 --esm <path> 指定，或先 `npm i solarlunar@3.1.0`。');
  process.exit(1);
}

const esm = readFileSync(resolve(esmFile), 'utf8');
const lunarInfo = extractArray(esm, 'lunarInfo');
const lTermInfo = extractArray(esm, 'lTermInfo');
const { lunar, term } = count(lunarInfo, lTermInfo);
console.log(`from ${esmFile}: lunarInfo=${lunar} lTermInfo=${term}`);
if (lunar !== 201 || term !== 201) {
  console.error('抽取数量不符（expect 201/201），拒绝写入。');
  process.exit(1);
}

const header = `/* ================================================================
 * 农历 / 节气数据表 (1900-2100) — 构建期数据, 不属于运行时逻辑。
 *
 * 来源: solarlunar@3.1.0 的 ESM 产物 (dist/solarlunar.esm.js)
 *   https://github.com/yize/solarlunar
 *   License: ISC, Copyright (c) 2015, yize
 *   许可见 ../THIRD_PARTY_NOTICES.md
 *
 * 本文件由 scripts/vendor-lunar-data.mjs 从上述来源抽取生成, 不再手改;
 * build.mjs 读取这两张表注入 src/engine-core.js 的占位符。
 * ================================================================ */
`;
const body = `export const LUNAR_INFO = ${JSON.stringify(lunarInfo)};\n\nexport const LTERM_INFO = ${JSON.stringify(lTermInfo)};\n`;
writeFileSync(outFile, header + body);
console.log(`wrote ${outFile}`);
