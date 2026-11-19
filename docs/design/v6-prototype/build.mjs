// 把 v6 原型的分文件拼成一个能直接用浏览器打开的页面。
//
//   node docs/design/v6-prototype/build.mjs            # 输出到 dist/v6-prototype.html（dist/ 不进仓库）
//   node docs/design/v6-prototype/build.mjs <输出路径>
//
// 原型只做设计参考，不是插件的一部分：排盘用仓库里真实的 engine-built.js，
// 3D 用 CDN 上的 Three.js r128（带 SRI），紫微师的回答和完整报告是写好的示例文字。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');
const rd = (name) => readFileSync(join(here, name), 'utf8');
const engine = readFileSync(join(root, 'engine-built.js'), 'utf8');

const THREE = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" ' +
  'integrity="sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu" crossorigin="anonymous"></script>';

const page = [
  '<!doctype html>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  '<title>紫微斗数 v6 原型</title>',
  '<style>', rd('style.css'), '</style>',
  rd('body.html'),
  THREE,
  '<script>', engine, '</script>',
  '<script>', rd('sky.js'), '</script>',
  '<script>', rd('report.js'), '</script>',
  '<script>', rd('app.js'), '</script>',
  ''
].join('\n');

const out = process.argv[2] ? resolve(process.argv[2]) : join(root, 'dist', 'v6-prototype.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log('built: ' + out + ' (' + Math.round(page.length / 1024) + ' KB)');
