#!/usr/bin/env node
/**
 * scripts/audit-ui.mjs — 界面契约体检（ui-contract）
 *
 * 职责：**报告漂移，不修**。契约文档在 docs/ui-contract/（v6 的界面约定），本脚本只做三件事：
 *   1. 按文档里的规则读源码（src/ui/ 用 build.mjs 的 assembleUi 在内存里拼接后的全文）与构建产物（client.js）；
 *   2. 逐项输出 PASS / WARN / FAIL；样例位置报「源文件:行号」；
 *   3. 基线（docs/ui-contract/audit-baseline.json）全 0：C1–C4、C16–C18 是硬规则，C15 是基线为 0 的棘轮。
 *
 * 用法：
 *   node scripts/audit-ui.mjs                  体检；无 FAIL → exit 0
 *   node scripts/audit-ui.mjs --json           机器可读输出（verify/ui-contract.mjs 用）
 *   node scripts/audit-ui.mjs --strict         WARN 也算失败
 *   node scripts/audit-ui.mjs -v               打印全部样例（不只前 5 条）
 *   node scripts/audit-ui.mjs --profile v6     等于默认（只剩 v6 一个 profile；v5 的约定已被 v6 取代，旧命令照样能跑）
 *   不接受 --update-baseline：基线固定全 0，有违规就改代码或改约定文档。
 *
 * 退出码：0 无 FAIL / 1 有 FAIL / 2 契约文档缺失或不可解析、源码拼不起来、参数不对。
 *
 * 约束：不联网、不启动 GUI、不读第三方模块；只依赖 node:fs / node:path / node:url
 * 和仓库里的 build.mjs（拼接逻辑只写一份）。
 * 行号随源码漂移，契约以选择器/类名为准；脚本不写死行号。
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);

/** --profile v6（也可写 --profile=v6）；默认 v6，也只有 v6。v5 的约定文档已被 v6 取代，main() 里拒绝别的值。 */
function readProfile(argv) {
  let profile = 'v6';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile') profile = argv[i + 1];
    else if (argv[i].startsWith('--profile=')) profile = argv[i].slice('--profile='.length);
  }
  return profile;
}
const PROFILE = readProfile(process.argv.slice(2));
const CONTRACT_DIR = join(ROOT, 'docs', 'ui-contract');

const PATHS = {
  src: join(ROOT, 'src', 'ui'),
  built: join(ROOT, 'client.js'),
  layout: join(CONTRACT_DIR, 'layout.md'),
  design: join(CONTRACT_DIR, 'design.md'),
  tokens: join(CONTRACT_DIR, 'tokens.md'),
  baseline: join(CONTRACT_DIR, 'audit-baseline.json')
};

const ARGS = new Set(process.argv.slice(2));
const FLAG = {
  json: ARGS.has('--json'),
  update: ARGS.has('--update-baseline'),
  strict: ARGS.has('--strict'),
  verbose: ARGS.has('-v') || ARGS.has('--verbose')
};

/* ------------------------------------------------------------------ *
 * 基线（全 0）
 * ------------------------------------------------------------------ */

/**
 * 内置默认基线：全部为 0。C1–C4、C16–C18 是硬规则（不看基线），C15 是基线为 0 的棘轮。
 * JSON 文件存在时以文件为准（它也全是 0）；文件缺失时用这份兜底。
 */
const DEFAULT_BASELINE = {
  C1: 0, C2: 0, C3: 0, C4: 0, C15: 0, C16: 0, C17: 0, C18: 0
};

const DEFAULT_BASELINE_META = {
  version: 1,
  generatedAt: '2026-11-19T00:00:00.000Z',
  source: {}
};

function loadBaseline() {
  if (!existsSync(PATHS.baseline)) return { counts: { ...DEFAULT_BASELINE }, meta: { ...DEFAULT_BASELINE_META }, from: '内置' };
  try {
    const raw = JSON.parse(readFileSync(PATHS.baseline, 'utf8'));
    const counts = { ...DEFAULT_BASELINE };
    for (const [k, v] of Object.entries(raw.counts || {})) if (Number.isFinite(v)) counts[k] = v;
    return { counts, meta: { ...DEFAULT_BASELINE_META, ...raw }, from: 'JSON' };
  } catch {
    return { counts: { ...DEFAULT_BASELINE }, meta: { ...DEFAULT_BASELINE_META }, from: '内置（JSON 解析失败）' };
  }
}

/* ------------------------------------------------------------------ *
 * 读取与解析
 * ------------------------------------------------------------------ */

const read = (p) => {
  try { return readFileSync(p, 'utf8'); } catch { return ''; }
};

const countLines = (s) => (s ? s.split('\n').length : 0);

/** 从源码里截出 `const CSS = \`...\`` 模板；返回 {text, start, end, startLine}。 */
function extractCssTemplate(src, marker = 'const CSS = `') {
  const i = src.indexOf(marker);
  if (i < 0) return { text: '', startIndex: -1, endIndex: -1, startLine: 0 };
  const startIndex = i + marker.length;
  const endIndex = src.indexOf('`', startIndex);
  return {
    text: src.slice(startIndex, endIndex),
    startIndex,
    endIndex,
    startLine: src.slice(0, startIndex).split('\n').length
  };
}

/** 从表格里找表头包含全部关键词的那张表，收集其后连续表格行。 */
function tableRows(md, headerKeywords) {
  const lines = md.split('\n');
  const hi = lines.findIndex((l) => /^\s*\|/.test(l) && headerKeywords.every((k) => l.includes(k)));
  if (hi < 0) return null;
  const rows = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\|/.test(line)) {
      if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue; // 分隔行
      rows.push(line);
    } else if (rows.length > 0) {
      break;
    } else if (line.trim() === '') {
      continue;
    } else {
      break;
    }
  }
  return rows;
}

/** layout.md §3.3 参数表 → {SIDE_MID:296, ...}。 */
function parseLayoutParams(md) {
  const rows = tableRows(md, ['参数', '值']) || [];
  const params = {};
  for (const row of rows) {
    const m = /^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|\s*(\d+)/.exec(row);
    if (m) params[m[1]] = Number(m[2]);
  }
  return params;
}

/** layout.md §2 RegionId 白名单表 → ['HEAD', ...]。 */
function parseLayoutRegions(md) {
  const rows = tableRows(md, ['Region', '禁止放']);
  if (!rows) return null;
  const ids = [];
  for (const row of rows) {
    const m = /^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|/.exec(row);
    if (m) ids.push(m[1]);
  }
  return ids;
}

/** tokens.md §4.3 字面色白名单（表头含「白名单值」）→ Set('#hex')。 */
function parseTokenWhitelist(md) {
  const rows = tableRows(md, ['白名单值']) || [];
  const out = new Set();
  for (const row of rows) {
    for (const m of row.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) out.add(m[0].toLowerCase());
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 通用小工具
 * ------------------------------------------------------------------ */

/** 给定 CSS 内位置，返回其所在选择器（`{` 前、上一个 `}`/`;` 后的文本）。 */
function selectorAt(css, idx) {
  const open = css.lastIndexOf('{', idx);
  if (open < 0) return '';
  const start = Math.max(css.lastIndexOf('}', open), css.lastIndexOf(';', open)) + 1;
  return css.slice(start, open).trim();
}

/** 取 `h('tag', { ... })` 的 props 文本（按花括号配平，跳过字符串）。 */
function propsAfter(src, idx) {
  const open = src.indexOf('{', idx);
  if (open < 0) return '';
  let depth = 1;
  let i = open + 1;
  let quote = null;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
    }
    i++;
  }
  return src.slice(open + 1, i - 1);
}

/** 取「包含 idx 的那个 h(...) 调用」的 props（向前找最近的 h(）。 */
function propsEnclosingCall(src, idx) {
  const hIdx = src.lastIndexOf('h(', idx);
  if (hIdx < 0) return '';
  return propsAfter(src, hIdx);
}

/** 收集某 tag 的所有出现：{index, props}。tag 形如 "input"/"iframe"。 */
function collectElements(src, tag) {
  const out = [];
  const re = new RegExp(`h\\(\\s*'${tag}'`, 'g');
  let m;
  while ((m = re.exec(src))) out.push({ index: m.index, props: propsAfter(src, m.index) });
  return out;
}

function extractPxNumbers(value) {
  return [...value.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
}

/* ---------- WCAG 对比度 ---------- */

function srgbLum(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a, b) {
  const la = srgbLum(a);
  const lb = srgbLum(b);
  if (la === null || lb === null) return null;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** 从 CSS 的某个块里读 `--var: value` 声明；返回 {name: value}。 */
function readCustomProps(css, selectorNeedle) {
  const at = css.indexOf(selectorNeedle);
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  if (open < 0 || close < 0) return null;
  const block = css.slice(open + 1, close);
  const out = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/* ------------------------------------------------------------------ *
 * 检查实现
 * ------------------------------------------------------------------ */

function checkC5(ctx) {
  const REQUIRED = ['--dsh-frame-top-clearance', '--dsh-frame-leading-clearance', '--dsh-frame-overlay-top'];
  const samples = [];
  let count = 0;
  const css = ctx.css.text;
  if (!/data-platform\s*=\s*["']?darwin/.test(css)) {
    count++;
    samples.push('缺少 html[data-platform="darwin"] 选择器');
  }
  for (const name of REQUIRED) {
    const re = new RegExp(`var\\(\\s*${name}\\s*([,)])`, 'g');
    let m;
    let uses = 0;
    let fallbackOk = true;
    let scopeOk = true;
    while ((m = re.exec(css))) {
      uses++;
      if (m[1] !== ',') fallbackOk = false;
      if (!/data-platform\s*=\s*["']?darwin/.test(selectorAt(css, m.index))) scopeOk = false;
    }
    if (uses === 0) {
      count++;
      samples.push(`${name} 未被使用（darwin 安全区缺失）`);
    } else if (!fallbackOk) {
      count++;
      samples.push(`var(${name}) 缺兜底值`);
    }
    if (uses > 0 && !scopeOk) {
      count++;
      samples.push(`var(${name}) 不在 darwin 选择器作用域内`);
    }
  }
  return { count, samples };
}

function checkC6(ctx) {
  const samples = [];
  let count = 0;
  const rootBlock = /\.zp-root\s*\{([^}]*)\}/.exec(ctx.css.text);
  if (!rootBlock || !/isolation\s*:\s*isolate/.test(rootBlock[1])) {
    count++;
    samples.push('.zp-root 缺少 isolation: isolate（子层 z-index 会盖住宿主侧栏出口）');
  }
  if (ctx.built && !/isolation:\s*isolate/.test(ctx.built)) {
    count++;
    samples.push('构建产物 client.js 缺 isolation:isolate（源码改了没构建？）');
  }
  return { count, samples };
}

function checkC7(ctx) {
  const samples = [];
  let count = 0;
  for (const m of ctx.css.text.matchAll(/position\s*:\s*fixed/g)) {
    count++;
    samples.push(`${ctx.where(ctx.css.startIndex + m.index)} · CSS position:fixed（浮层只许面板内 absolute）`);
  }
  for (const m of ctx.jsx.matchAll(/position\s*:\s*['"]fixed['"]/g)) {
    count++;
    samples.push(`${ctx.where(ctx.jsxIndex(m.index))} · JSX position:'fixed'`);
  }
  return { count, samples };
}

function checkC8(ctx) {
  const samples = [];
  let count = 0;
  const re = /role\s*:\s*['"]dialog['"]/g;
  let m;
  while ((m = re.exec(ctx.jsx))) {
    const props = propsEnclosingCall(ctx.jsx, m.index);
    const line = ctx.where(ctx.jsxIndex(m.index));
    if (!/aria-modal/.test(props)) { count++; samples.push(`${line} · role=dialog 缺 aria-modal`); }
    if (!/aria-label/.test(props)) { count++; samples.push(`${line} · role=dialog 缺 aria-label`); }
    if (!/(trapTab|useModalLayer|onKeyDown)/.test(props)) { count++; samples.push(`${line} · role=dialog 缺焦点陷阱`); }
  }
  if (count === 0) {
    const dialogs = (ctx.jsx.match(/role\s*:\s*['"]dialog['"]/g) || []).length;
    samples.push(`共 ${dialogs} 个 role=dialog，语义齐备`);
  }
  return { count, samples };
}

function checkC9(ctx) {
  const frames = collectElements(ctx.jsx, 'iframe');
  const samples = [];
  let count = 0;
  if (frames.length === 0) {
    return { count: 0, samples: ['无 iframe'] };
  }
  for (const f of frames) {
    const line = ctx.where(ctx.jsxIndex(f.index));
    if (!/\btitle\s*:/.test(f.props)) { count++; samples.push(`${line} · iframe 缺 title`); }
    if (!/\bsandbox\s*:/.test(f.props)) { count++; samples.push(`${line} · iframe 缺 sandbox`); }
  }
  if (count === 0) samples.push(`共 ${frames.length} 个 iframe，title/sandbox 齐备`);
  return { count, samples };
}

function checkC10(ctx) {
  const samples = [];
  let count = 0;
  let total = 0;
  for (const tag of ['input', 'select', 'textarea']) {
    for (const el of collectElements(ctx.jsx, tag)) {
      total++;
      const line = ctx.where(ctx.jsxIndex(el.index));
      const hasName = /(?:'aria-label'|aria-label|\bid\s*:)/.test(el.props);
      if (hasName) continue;
      // 包裹式 label：最近的 h('label' 出现在本控件之前、且晚于上一个控件
      const before = ctx.jsx.slice(0, el.index);
      const lastLabel = before.lastIndexOf("h('label'");
      const lastControl = Math.max(
        before.lastIndexOf("h('input'"),
        before.lastIndexOf("h('select'"),
        before.lastIndexOf("h('textarea'")
      );
      const wrapped = lastLabel > lastControl && el.index - lastLabel < 500;
      if (!wrapped) {
        count++;
        samples.push(`${line} · <${tag}> 无可访问名称（aria-label / id + htmlFor / 包裹 label 三选一）`);
      }
    }
  }
  if (count === 0) samples.push(`共 ${total} 个表单控件，命名齐备`);
  return { count, samples };
}

function checkC14(ctx) {
  const samples = [];
  let count = 0;
  if (!ctx.regions || ctx.regions.length === 0) {
    return { count: 1, samples: ['layout.md §2 区域白名单表不可解析（表头须含 Region 与 禁止放）'] };
  }
  const allow = new Set(ctx.regions);
  const found = [];
  for (const m of ctx.src.matchAll(/'data-region'\s*:\s*'([^']+)'|data-region="([^"]+)"/g)) {
    found.push(m[1] || m[2]);
  }
  for (const id of found) {
    if (!allow.has(id)) {
      count++;
      samples.push(`未登记 RegionId: ${id}`);
    }
  }
  const wired = new Set(found.filter((x) => allow.has(x)));
  samples.push(`data-region 已接线 ${wired.size}/${allow.size}（未接线的区域本轮不可能出现标记）`);
  return { count, samples };
}

/* ------------------------------------------------------------------ *
 * v6 约定的解析与检查（C1–C4、C11–C13、C15–C18；C5–C10、C14 在上面，和 v5 时相同）
 * 约定文档在 docs/ui-contract/；源码由 build.mjs 的 assembleUi 拼出来（样例位置报「源文件:行号」）。
 * ------------------------------------------------------------------ */

const cellsOf = (row) => row.split('|').slice(1, -1).map((c) => c.trim());
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** v6 layout.md §2：Region → 「选择器」列登记的类名（不带点）。第一个是带 data-region 的元素的类名。 */
function parseRegionSelectors(md) {
  const out = {};
  for (const row of tableRows(md, ['Region', '禁止放']) || []) {
    const cells = cellsOf(row);
    const m = /^`([A-Z][A-Z0-9_]*)`$/.exec(cells[0] || '');
    if (m) out[m[1]] = [...(cells[2] || '').matchAll(/`\.([a-z][\w-]*)`/g)].map((x) => x[1]);
  }
  return out;
}

/** v6 tokens.md §2：{ '--zp-zi': { light: '#6b55d4', dark: '#b9a7fa' }, ... } */
function parseContentColors(md) {
  const out = {};
  for (const row of tableRows(md, ['变量', '浅色', '深色']) || []) {
    const cells = cellsOf(row);
    const name = /^`(--zp-[a-z0-9-]+)`$/.exec(cells[0] || '');
    const light = /`(#[0-9a-fA-F]{3,8})`/.exec(cells[1] || '');
    const dark = /`(#[0-9a-fA-F]{3,8})`/.exec(cells[2] || '');
    if (name && light && dark) out[name[1]] = { light: light[1].toLowerCase(), dark: dark[1].toLowerCase() };
  }
  return out;
}

/** v6 design.md §5.2：动效豁免类 → { infinite, long } */
function parseMotionExempt(md) {
  const out = {};
  for (const row of tableRows(md, ['动效豁免类']) || []) {
    const cells = cellsOf(row);
    const m = /^`([a-z][\w-]*)`$/.exec(cells[0] || '');
    if (m) out[m[1]] = { infinite: /infinite/.test(cells[1] || ''), long: />300ms/.test(cells[1] || '') };
  }
  return out;
}

/** v6 design.md §6：类名例外 → { prefixes: ['zr-'], names: ['md-table'] } */
function parseClassExceptions(md) {
  const prefixes = [];
  const names = [];
  for (const row of tableRows(md, ['类名例外']) || []) {
    const m = /^\|\s*`([a-z][\w-]*?)(-\*)?`\s*\|/.exec(row);
    if (!m) continue;
    if (m[2]) prefixes.push(m[1] + '-');
    else names.push(m[1]);
  }
  return { prefixes, names };
}

/** CSS → 规则列表 [{ selector, body, bodyStart, atRules }]。注释换成等长空白（位置不变），@keyframes 里的帧不算规则。 */
function cssRules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const rules = [];
  const stack = [];
  let preludeStart = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '{') {
      stack.push({ prelude: clean.slice(preludeStart, i).trim(), start: i + 1 });
      preludeStart = i + 1;
    } else if (ch === '}') {
      const top = stack.pop();
      if (top && !top.prelude.startsWith('@')) {
        const atRules = stack.map((x) => x.prelude).filter((p) => p.startsWith('@'));
        if (!atRules.some((p) => /^@(?:-webkit-)?keyframes\b/.test(p))) {
          rules.push({ selector: top.prelude, body: clean.slice(top.start, i), bodyStart: top.start, atRules });
        }
      }
      preludeStart = i + 1;
    } else if (ch === ';') {
      preludeStart = i + 1;
    }
  }
  return { clean, rules };
}

/** 规则里的声明：[{ prop, value, index }]，index 是声明在 CSS 文本里的位置。 */
function declsOf(rule) {
  const out = [];
  let offset = 0;
  for (const part of rule.body.split(';')) {
    const at = part.indexOf(':');
    if (at > 0) {
      const lead = part.length - part.trimStart().length;
      out.push({ prop: part.slice(0, at).trim().toLowerCase(), value: part.slice(at + 1).trim(), index: rule.bodyStart + offset + lead });
    }
    offset += part.length + 1;
  }
  return out;
}

/** 选择器里的类名（去掉属性选择器和字符串，避免把 [data-x=".a"] 当类名）。 */
const selectorClasses = (selector) =>
  [...selector.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"|'[^']*'/g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]);

const forEachDecl = (ctx, fn) => {
  for (const rule of ctx.cssRules) for (const d of declsOf(rule)) fn(d, rule);
};
const cssWhere = (ctx, index) => ctx.where(ctx.css.startIndex + index);

/** 找包住 idx 的那个 h(...) 调用（只认 `h(` 前面不是标识符或点，避免把 match( 之类当成 h(）。 */
function propsEnclosingH(src, idx) {
  const re = /(?<![\w$.])h\(\s*['A-Za-z]/g;
  let last = -1;
  let m;
  while ((m = re.exec(src)) && m.index < idx) last = m.index;
  return last < 0 ? '' : propsAfter(src, last);
}

/** className: 表达式里的字符串字面量（到同层的 , 或闭括号为止），拆成类名。模板字符串的 ${} 两侧各算一段。 */
function classNameTokens(jsx) {
  const out = [];
  const re = /\bclassName\s*:\s*/g;
  let m;
  while ((m = re.exec(jsx))) {
    const lits = [];
    let depth = 0;
    let i = re.lastIndex;
    while (i < jsx.length) {
      const ch = jsx[i];
      if (ch === "'" || ch === '"' || ch === '`') {
        let j = i + 1;
        let lit = '';
        while (j < jsx.length && jsx[j] !== ch) {
          if (jsx[j] === '\\') { lit += jsx[j + 1] || ''; j += 2; continue; }
          if (ch === '`' && jsx[j] === '$' && jsx[j + 1] === '{') {
            lits.push(lit);
            lit = '';
            let d = 1;
            j += 2;
            while (j < jsx.length && d > 0) { if (jsx[j] === '{') d++; else if (jsx[j] === '}') d--; j++; }
            continue;
          }
          lit += jsx[j];
          j++;
        }
        lits.push(lit);
        i = j + 1;
        continue;
      }
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') { if (depth === 0) break; depth--; }
      else if (ch === ',' && depth === 0) break;
      i++;
    }
    for (const l of lits) for (const tok of l.split(/\s+/)) if (tok) out.push({ name: tok, index: m.index });
  }
  return out;
}

function classAllowed(ctx, name) {
  return name.startsWith('zp-') || ctx.classExceptions.names.includes(name) || ctx.classExceptions.prefixes.some((p) => name.startsWith(p));
}

function checkC1v6(ctx) {
  const samples = [];
  let count = 0;
  forEachDecl(ctx, (d, rule) => {
    const isShadow = d.prop === 'box-shadow' || d.prop === 'text-shadow';
    const registered = d.prop.startsWith('--') && !!ctx.contentColors[d.prop];
    const hits = [
      ...[...d.value.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)].map((m) => m[0]),
      ...[...d.value.replace(/--[\w-]+/g, '').matchAll(/\b(?:white|black)\b/gi)].map((m) => m[0])
    ];
    for (const lit of hits) {
      if (isShadow || registered || ctx.tokenWhitelist.has(lit.toLowerCase())) continue;
      count++;
      samples.push(`${cssWhere(ctx, d.index)} · ${lit} · ${rule.selector} { ${d.prop}: ${d.value.slice(0, 60)} }`);
    }
  });
  if (count === 0) samples.push(`字面色只出现在已登记的 ${Object.keys(ctx.contentColors).length} 个 --zp-* 定义和阴影里`);
  return { count, samples };
}

const V6_FONT_SIZES = new Set([9.5, 10.5, 11, 11.5, 12, 13, 13.5, 14, 15, 16, 18, 20, 24, 28]);
const V6_SPACING = new Set([0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48]);

function checkC2v6(ctx) {
  const samples = [];
  let count = 0;
  forEachDecl(ctx, (d, rule) => {
    let nums = [];
    if (d.prop === 'font-size') nums = extractPxNumbers(d.value);
    else if (d.prop === 'font') nums = extractPxNumbers(d.value.split('/')[0]);
    const bad = nums.filter((n) => !V6_FONT_SIZES.has(n));
    if (bad.length) {
      count++;
      samples.push(`${cssWhere(ctx, d.index)} · ${rule.selector} { ${d.prop}: ${d.value} }（表外 ${[...new Set(bad)].join('/')}）`);
    }
  });
  for (const m of ctx.jsx.matchAll(/fontSize\s*:\s*['"]?(\d+(?:\.\d+)?)/g)) {
    const n = Number(m[1]);
    if (!V6_FONT_SIZES.has(n)) {
      count++;
      samples.push(`${ctx.where(ctx.jsxIndex(m.index))} · fontSize: ${n}`);
    }
  }
  return { count, samples };
}

function checkC3v6(ctx) {
  const samples = [];
  let count = 0;
  const PROP = /^(?:padding|margin)(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?$|^(?:row-|column-)?gap$/;
  forEachDecl(ctx, (d, rule) => {
    if (!PROP.test(d.prop)) return;
    /* 宿主变量的兜底值是宿主约定，不是面板间距（design.md §3） */
    const value = d.value.replace(/var\(\s*--dsh-frame-[a-z-]+\s*,[^)]*\)/g, 'var()');
    const bad = extractPxNumbers(value).filter((n) => !V6_SPACING.has(Math.abs(n)));
    if (bad.length) {
      count += bad.length;
      samples.push(`${cssWhere(ctx, d.index)} · ${rule.selector} { ${d.prop}: ${d.value} }（表外 ${[...new Set(bad)].join('/')}）`);
    }
  });
  return { count, samples };
}

function checkC4v6(ctx) {
  const samples = [];
  let count = 0;
  const weightOf = (tok) => (/^\d{3}$/.test(tok) ? Number(tok) : tok === 'bold' ? 700 : tok === 'normal' ? 400 : tok === 'bolder' || tok === 'lighter' ? NaN : null);
  forEachDecl(ctx, (d, rule) => {
    let tokens = [];
    if (d.prop === 'font-weight') tokens = [d.value.replace(/\s*!important$/, '').trim()];
    else if (d.prop === 'font') tokens = d.value.split('/')[0].split(/\s+/).filter((x) => /^\d{3}$|^(?:bold|bolder|lighter)$/.test(x));
    for (const tok of tokens) {
      const w = weightOf(tok);
      if (w === null) continue;
      const board = /\.zp-board(?![\w-])/.test(rule.selector);
      const ok = w === 400 || w === 500 || w === 600 || (board && (w === 650 || w === 700));
      if (!ok) {
        count++;
        samples.push(`${cssWhere(ctx, d.index)} · ${rule.selector} { ${d.prop}: ${d.value} }${(w === 650 || w === 700) ? '（650 / 700 只给盘面主星，选择器要含 .zp-board）' : ''}`);
      }
    }
  });
  for (const m of ctx.jsx.matchAll(/fontWeight\s*:\s*['"]?(\d+|bold)/g)) {
    const w = m[1] === 'bold' ? 700 : Number(m[1]);
    if (w !== 400 && w !== 500 && w !== 600) {
      count++;
      samples.push(`${ctx.where(ctx.jsxIndex(m.index))} · fontWeight: ${m[1]}`);
    }
  }
  return { count, samples };
}

function checkC11v6(ctx) {
  const samples = [];
  let count = 0;
  const threads = [];
  for (const m of ctx.jsx.matchAll(/(?<![\w$.])h\(\s*'(\w+)'/g)) {
    const props = propsAfter(ctx.jsx, m.index);
    if (/zp-chat-thread/.test(props)) threads.push({ index: m.index, props });
  }
  const wired = /'data-region'\s*:\s*'ASSISTANT'/.test(ctx.jsx);
  if (!threads.length) {
    if (wired) return { count: 1, samples: ['ASSISTANT 已接线，但找不到 .zp-chat-thread 对话流'] };
    return { count: 0, samples: ['ASSISTANT 还没接线：对话流检查在它接线后生效'] };
  }
  for (const th of threads) {
    const line = ctx.where(ctx.jsxIndex(th.index));
    if (!/'aria-live'\s*:\s*'polite'/.test(th.props)) { count++; samples.push(`${line} · 对话流缺 aria-live="polite"`); }
    if (!/role\s*:\s*['"]log['"]/.test(th.props)) { count++; samples.push(`${line} · 对话流缺 role="log"`); }
  }
  if (count === 0) samples.push(`对话流 ${threads.length} 处，role=log + aria-live=polite 齐备`);
  return { count, samples };
}

function checkC12v6(ctx) {
  const samples = [];
  let count = 0;
  const css = ctx.css.text;
  const hasClass = (cls) => new RegExp('\\.' + escapeRe(cls) + '(?![\\w-])').test(css);
  for (const cls of ['zp-root', 'zp-head', 'zp-exit']) {
    if (!hasClass(cls)) { count++; samples.push(`CSS 缺结构类 .${cls}`); }
  }
  if (!/className\s*:\s*['"][^'"]*\bzp-exit\b/.test(ctx.jsx)) { count++; samples.push('源码里没有 className 含 zp-exit 的「返回会话」按钮'); }
  const wired = new Map();
  for (const m of ctx.jsx.matchAll(/'data-region'\s*:\s*'([A-Z][A-Z0-9_]*)'/g)) {
    if (!wired.has(m[1])) wired.set(m[1], []);
    wired.get(m[1]).push(m.index);
  }
  for (const [region, indexes] of wired) {
    const classes = ctx.regionSelectors[region] || [];
    if (!classes.length) continue; /* 未登记的区域由 C14 报 */
    for (const cls of classes) {
      if (!hasClass(cls)) { count++; samples.push(`${region} 已接线，CSS 缺 .${cls}`); }
    }
    for (const idx of indexes) {
      const props = propsEnclosingH(ctx.jsx, idx);
      const own = classNameTokens(props).map((x) => x.name);
      if (!own.includes(classes[0])) {
        count++;
        samples.push(`${ctx.where(ctx.jsxIndex(idx))} · data-region=${region} 的元素没带 .${classes[0]}`);
      }
    }
  }
  if (count === 0) samples.push(`结构类齐备；已接线区域 ${[...wired.keys()].join('、') || '无'} 的类名都在`);
  return { count, samples };
}

function checkC13v6(ctx) {
  const samples = [];
  let count = 0;
  const P = ctx.params;
  const KEYS = ['SIDE_MIN', 'SIDE_MAX', 'GUTTER', 'PAGE_PAD_X', 'PAD_NARROW', 'BOARD_MIN', 'BOARD_COMFORT', 'ASSISTANT_W', 'SHEET_W', 'MODAL_W', 'DOC_MAX', 'MID', 'WIDE'];
  for (const key of KEYS) {
    if (!(key in P)) { count++; samples.push(`layout.md §4.1 参数表缺 ${key}`); }
  }
  const MID = P.SIDE_MIN + P.GUTTER + P.BOARD_MIN + P.PAGE_PAD_X;
  const WIDE = P.ASSISTANT_W + P.SIDE_MIN + P.GUTTER + P.BOARD_COMFORT + P.PAGE_PAD_X;
  if (P.MID !== MID) { count++; samples.push(`layout.md MID=${P.MID} 与公式 ${MID} 不符`); }
  if (P.WIDE !== WIDE) { count++; samples.push(`layout.md WIDE=${P.WIDE} 与公式 ${WIDE} 不符`); }
  const ge = [...ctx.src.matchAll(/panelW\s*>=\s*(\d+)/g)].map((m) => Number(m[1]));
  const others = [...ctx.src.matchAll(/panelW\s*(?:<=?|>(?!=))\s*(\d+)/g)].map((m) => Number(m[1])).filter((n) => n !== 0);
  const want = [MID, WIDE].sort((a, b) => a - b).join();
  if (ge.slice().sort((a, b) => a - b).join() !== want) {
    count++;
    samples.push(`源码里 panelW >= 的字面量 [${ge.join(', ')}] 应恰好是 [${want}]`);
  }
  if (others.some((n) => n !== MID && n !== WIDE)) {
    count++;
    samples.push(`源码里 panelW 还和 [${others.join(', ')}] 比较（只许 ${MID} / ${WIDE}，首帧兜底用 0）`);
  }
  if (count === 0) samples.push(`阈值 ${ge.join('/')} = 公式 MID ${MID} / WIDE ${WIDE}`);
  return { count, samples };
}

/** 宿主底色（2026-11 实测，和 tokens.md §5 同一组） */
const V6_BACKGROUNDS = { light: ['#ffffff', '#ffffff'], dark: ['#151517', '#232324'] };
const V6_CONTRAST = [
  ['--zp-gold-text', 4.5], ['--zp-mu-lu', 4.5], ['--zp-mu-quan', 4.5], ['--zp-mu-ke', 4.5], ['--zp-mu-ji', 4.5],
  ['--zp-zi', 3], ['--zp-gold', 3],
  ...Array.from({ length: 14 }, (_, i) => [`--zp-s${i}`, 3])
];

function checkC15v6(ctx) {
  const samples = [];
  let count = 0;
  const css = ctx.css.text;
  const isColor = (v) => /^#[0-9a-f]{3,8}$/i.test(v) || /^(?:rgb|hsl)a?\(/i.test(v);
  const pick = (block) => Object.fromEntries(Object.entries(block || {}).filter(([, v]) => isColor(v)).map(([k, v]) => [k, v.toLowerCase()]));
  const light = pick(readCustomProps(css, '.zp-root {'));
  const dark = pick(readCustomProps(css, 'body[data-ds-dark-theme] .zp-root'));
  for (const k of Object.keys(light)) if (!(k in dark)) { count++; samples.push(`深色缺内容色 ${k}`); }
  for (const k of Object.keys(dark)) if (!(k in light)) { count++; samples.push(`深色多出未配对的 ${k}`); }
  const reg = ctx.contentColors;
  for (const k of new Set([...Object.keys(light), ...Object.keys(dark)])) {
    if (!reg[k]) { count++; samples.push(`${k} 没在 tokens.md §2 登记`); }
  }
  for (const [k, v] of Object.entries(reg)) {
    if (light[k] !== v.light) { count++; samples.push(`${k} 浅色是 ${light[k] || '缺失'}，tokens.md 登记 ${v.light}`); }
    if (dark[k] !== v.dark) { count++; samples.push(`${k} 深色是 ${dark[k] || '缺失'}，tokens.md 登记 ${v.dark}`); }
  }
  let groups = 0;
  for (const [name, bar] of V6_CONTRAST) {
    for (const [theme, values] of [['浅色', light], ['深色', dark]]) {
      const fg = values[name];
      if (!fg || !/^#/.test(fg)) continue;
      groups++;
      const bgs = V6_BACKGROUNDS[theme === '浅色' ? 'light' : 'dark'];
      const worst = Math.min(...bgs.map((bg) => contrastRatio(fg, bg)).filter((r) => r !== null));
      if (worst < bar) {
        count++;
        samples.push(`${theme} ${name} ${fg}：最低 ${Math.round(worst * 100) / 100}:1 < ${bar}:1`);
      }
    }
  }
  if (count === 0) samples.push(`内容色浅 / 深 ${Object.keys(light).length}/${Object.keys(dark).length} 成对、和 tokens.md 一致；对比度 ${groups} 组都达标`);
  return { count, samples };
}

function checkC16v6(ctx) {
  const samples = [];
  let count = 0;
  const re = /--zp-(?:fill-)?accent(?:-deep)?(?![\w-])/g;
  for (const m of ctx.css.text.matchAll(re)) { count++; samples.push(`${cssWhere(ctx, m.index)} · ${m[0]}`); }
  for (const m of ctx.jsx.matchAll(re)) { count++; samples.push(`${ctx.where(ctx.jsxIndex(m.index))} · ${m[0]}`); }
  if (count === 0) samples.push('--zp-accent*、--zp-fill-accent* 没有出现');
  return { count, samples };
}

function checkC17(ctx) {
  const samples = [];
  let count = 0;
  let motion = false;
  const LAYOUT = /^(?:all|width|height|min-width|max-width|min-height|max-height|top|right|bottom|left|inset|flex|flex-basis|margin(?:-[a-z-]+)?|padding(?:-[a-z-]+)?|grid-template(?:-[a-z-]+)?)$/;
  const TIMING = /^(?:ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end|cubic-bezier\(.*|steps\(.*)$/;
  const TIME = /^-?\d*\.?\d+m?s$/;
  const toMs = (n, unit) => (unit === 's' ? Number(n) * 1000 : Number(n));
  forEachDecl(ctx, (d, rule) => {
    const isMotion = /^(?:transition|animation)(?:-|$)/.test(d.prop);
    if (!isMotion && !d.prop.startsWith('--')) return;
    if (isMotion && !/^none\b/.test(d.value)) motion = true;
    const classes = selectorClasses(rule.selector);
    const exemptLong = classes.some((c) => ctx.motionExempt[c] && ctx.motionExempt[c].long);
    const exemptInf = classes.some((c) => ctx.motionExempt[c] && ctx.motionExempt[c].infinite);
    const where = cssWhere(ctx, d.index);
    const long = [...d.value.matchAll(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)].map((m) => toMs(m[1], m[2])).filter((ms) => ms > 300);
    if (long.length && !exemptLong) { count++; samples.push(`${where} · ${rule.selector} { ${d.prop}: ${d.value} }（${long.join('/')}ms > 300ms）`); }
    if (/\binfinite\b/.test(d.value) && !exemptInf) { count++; samples.push(`${where} · ${rule.selector} 用了 infinite（只许 design.md §5.2 登记的类）`); }
    if (d.prop === 'transition' || d.prop === 'transition-property') {
      const items = d.value.replace(/!important/, '').split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);
      for (const item of items) {
        let prop;
        if (d.prop === 'transition-property') prop = item;
        else prop = item.split(/\s+/).find((tok) => !TIME.test(tok) && !TIMING.test(tok)) || 'all';
        if (prop !== 'none' && LAYOUT.test(prop)) {
          count++;
          samples.push(`${where} · ${rule.selector} 过渡了布局属性 ${prop}`);
        }
      }
    }
  });
  if (motion && !/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/.test(ctx.css.text)) {
    count++;
    samples.push('有过渡 / 动画，但没有 @media (prefers-reduced-motion: reduce) 段');
  }
  if (count === 0) samples.push('过渡和动画都不超过 300ms；infinite 只在登记的类上；不过渡布局属性');
  return { count, samples };
}

function checkC18(ctx) {
  const samples = [];
  let count = 0;
  const { clean } = ctx.cssParsed;
  const UNIT = /(?<![\w.#-])-?\d*\.?\d+(?:[dsl]?v[wh]|vmin|vmax|v[ib])\b/g;
  for (const m of clean.matchAll(UNIT)) { count++; samples.push(`${cssWhere(ctx, m.index)} · 视口单位 ${m[0]}`); }
  for (const m of ctx.jsx.matchAll(/\b\d+(?:\.\d+)?(?:[dsl]?v[wh]|vmin|vmax)\b/g)) { count++; samples.push(`${ctx.where(ctx.jsxIndex(m.index))} · 视口单位 ${m[0]}`); }
  for (const m of clean.matchAll(/@media([^{]*)\{/g)) {
    if (/\b(?:min-|max-)?(?:device-)?(?:width|height|aspect-ratio|orientation)\b/.test(m[1])) {
      count++;
      samples.push(`${cssWhere(ctx, m.index)} · 按宽高的 @media${m[1].trimEnd()}（档位看 .zp-root[data-w]）`);
    }
  }
  for (const m of clean.matchAll(/\benv\(/g)) { count++; samples.push(`${cssWhere(ctx, m.index)} · env(（标题带用 --dsh-frame-*）`); }
  for (const m of ctx.jsx.matchAll(/\benv\(/g)) { count++; samples.push(`${ctx.where(ctx.jsxIndex(m.index))} · env(`); }
  for (const rule of ctx.cssRules) {
    const sel = rule.selector.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"|'[^']*'/g, '');
    for (const m of sel.matchAll(/#[A-Za-z_-][\w-]*/g)) {
      count++;
      samples.push(`${cssWhere(ctx, rule.bodyStart)} · id 选择器 ${m[0]}（${rule.selector}）`);
    }
    for (const cls of selectorClasses(rule.selector)) {
      if (!classAllowed(ctx, cls)) {
        count++;
        samples.push(`${cssWhere(ctx, rule.bodyStart)} · 类名 .${cls} 没有 zp- 前缀（${rule.selector}）`);
      }
    }
  }
  for (const tok of classNameTokens(ctx.jsx)) {
    if (!classAllowed(ctx, tok.name)) {
      count++;
      samples.push(`${ctx.where(ctx.jsxIndex(tok.index))} · className 里的 ${tok.name} 没有 zp- 前缀`);
    }
  }
  if (count === 0) samples.push('没有视口单位、按宽高的 @media、id 选择器、env(；类名都带 zp- 前缀（或在 design.md §6 登记）');
  return { count, samples };
}

/* ------------------------------------------------------------------ *
 * 检查清单
 * ------------------------------------------------------------------ */

/** C1–C4、C16–C18 是硬规则（必须为 0）；C15 是基线为 0 的棘轮；C5–C10、C14 和 v5 时相同。 */
const CHECKS = [
  { id: 'C1', title: '字面色只在 --zp-* 定义和阴影里', kind: 'hard', run: checkC1v6 },
  { id: 'C2', title: '字号（14 个值）', kind: 'hard', run: checkC2v6 },
  { id: 'C3', title: '间距档位', kind: 'hard', run: checkC3v6 },
  { id: 'C4', title: '字重', kind: 'hard', run: checkC4v6 },
  { id: 'C5', title: 'darwin 窗口 chrome 避让', kind: 'hard', run: checkC5 },
  { id: 'C6', title: '层叠隔离 isolation', kind: 'hard', run: checkC6 },
  { id: 'C7', title: '无 position:fixed', kind: 'hard', run: checkC7 },
  { id: 'C8', title: '弹层语义（dialog）', kind: 'hard', run: checkC8 },
  { id: 'C9', title: 'iframe title/sandbox', kind: 'hard', run: checkC9 },
  { id: 'C10', title: '表单控件可访问名称', kind: 'hard', run: checkC10 },
  { id: 'C11', title: '对话流 aria-live', kind: 'hard', run: checkC11v6 },
  { id: 'C12', title: '结构类 + 区域接线', kind: 'hard', run: checkC12v6 },
  { id: 'C13', title: '阈值公式对账', kind: 'hard', run: checkC13v6 },
  { id: 'C14', title: 'RegionId 白名单', kind: 'hard', run: checkC14 },
  { id: 'C15', title: '深色成对 + 对比度', kind: 'ratchet', run: checkC15v6 },
  { id: 'C16', title: '退役的品牌色', kind: 'hard', run: checkC16v6 },
  { id: 'C17', title: '动效时长与循环', kind: 'hard', run: checkC17 },
  { id: 'C18', title: '单位、选择器、类名前缀', kind: 'hard', run: checkC18 }
];

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

function failExit(msg) {
  console.error(`\n[audit-ui] ${msg}\n`);
  process.exit(2);
}

/** 用 build.mjs 的 assembleUi 在内存里拼 src/ui/ 当源码；「构建」读磁盘上的 client.js（node build.mjs 的产物）。 */
async function loadContext() {
  const build = await import(pathToFileURL(join(ROOT, 'build.mjs')).href);
  let ui = null;
  try {
    ui = build.assembleUi(ROOT, { version: '0' });
  } catch (err) {
    failExit(`v6 界面拼不起来（src/ui/）：${err.message}`);
  }
  const src = ui.text;
  const layoutMd = read(PATHS.layout);
  const designMd = read(PATHS.design);
  const tokensMd = read(PATHS.tokens);
  if (!layoutMd || !designMd || !tokensMd) {
    failExit(`契约文档缺失：需 docs/ui-contract/{layout,design,tokens}.md 三份齐全`);
  }
  const css = extractCssTemplate(src);
  if (!css.text) failExit('拼好的 v6 源码里找不到 const CSS = `...` 模板（40-styles.js 变了？）');
  const jsx = src.slice(0, css.startIndex) + src.slice(css.endIndex);
  const cssLenBefore = css.startIndex;
  const cssParsed = cssRules(css.text);
  const contentColors = parseContentColors(tokensMd);
  return {
    src,
    built: read(PATHS.built),
    css,
    cssParsed,
    cssRules: cssParsed.rules,
    jsx,
    jsxIndex: (idx) => (idx < cssLenBefore ? idx : idx + (css.endIndex - css.startIndex)),
    layoutMd,
    designMd,
    tokensMd,
    params: parseLayoutParams(layoutMd),
    regions: parseLayoutRegions(layoutMd),
    regionSelectors: parseRegionSelectors(layoutMd),
    tokenWhitelist: parseTokenWhitelist(tokensMd),
    contentColors,
    motionExempt: parseMotionExempt(designMd),
    classExceptions: parseClassExceptions(designMd),
    where: (idx) => {
      const at = build.locate(ui.map, src, idx);
      return `${at.file}:${at.line}`;
    }
  };
}

function evaluate(ctx, baseline) {
  const results = [];
  for (const check of CHECKS) {
    let r;
    try {
      r = check.run(ctx) || { count: 0, samples: [] };
    } catch (err) {
      r = { count: 1, samples: [`检查自身异常：${err.message}`] };
    }
    const base = baseline.counts[check.id];
    let status;
    if (check.kind === 'hard') {
      status = r.count > 0 ? 'FAIL' : 'PASS';
    } else if (base === undefined) {
      status = r.count > 0 ? 'WARN' : 'PASS';
    } else if (r.count > base) {
      status = 'FAIL';
    } else if (r.count > 0) {
      status = 'WARN';
    } else {
      status = 'PASS';
    }
    if (r.skipped && status === 'PASS') status = 'WARN';
    results.push({
      id: check.id,
      title: check.title,
      kind: check.kind,
      status,
      count: r.count,
      baseline: base,
      skipped: !!r.skipped,
      samples: (r.samples || []).filter(Boolean),
      detail: statusDetail(check, r, base)
    });
  }
  return results;
}

function statusDetail(check, r, base) {
  if (check.kind === 'hard') {
    return r.count === 0 ? '通过' : `${r.count} 处违规（硬规则）`;
  }
  if (base === undefined) return `${r.count} 处`;
  if (r.count > base) return `${r.count} 处 > 基线 ${base}（新增漂移）`;
  if (r.count === base && r.count > 0) return `${r.count} 处 = 基线 ${base}（历史欠账锁住）`;
  if (r.count < base) return `${r.count} 处 < 基线 ${base}（基线可以下调）`;
  return '0 处';
}

function printHuman(results, baseline, meta) {
  const icon = { PASS: 'PASS', WARN: 'WARN', FAIL: 'FAIL' };
  console.log('紫微斗数 · 界面约定 v6 体检');
  console.log(`契约：docs/ui-contract/{layout,design,tokens}.md · 源码：src/ui/（拼接后 ${countLines(meta.src)} 行）· 构建：client.js（${meta.builtBytes} B）`);
  console.log(`基线：${baseline.from}${baseline.from === '内置' ? '' : ' docs/ui-contract/audit-baseline.json'}`);
  console.log('');
  let pass = 0; let warn = 0; let fail = 0; let debt = 0; let debtBaseline = 0;
  for (const r of results) {
    if (r.status === 'PASS') pass++;
    else if (r.status === 'WARN') warn++;
    else fail++;
    if (r.kind === 'ratchet' && r.count > 0) {
      debt += r.count;
      if (Number.isFinite(r.baseline)) debtBaseline += r.baseline;
    }
    console.log(`${icon[r.status].padEnd(4)} ${r.id.padEnd(3)} ${r.title.padEnd(22)} ${r.detail}`);
    const show = FLAG.verbose ? r.samples : r.samples.slice(0, r.status === 'FAIL' ? 8 : 3);
    if (show.length && r.status !== 'PASS') {
      for (const s of show) console.log(`       · ${s}`);
      if (!FLAG.verbose && r.samples.length > show.length) console.log(`       · …还有 ${r.samples.length - show.length} 条（-v 看全部）`);
    } else if (r.status === 'PASS' && FLAG.verbose) {
      for (const s of show) console.log(`       · ${s}`);
    }
  }
  console.log('');
  console.log('─'.repeat(72));
  console.log(`结果：${pass} 通过 / ${warn} 警告 / ${fail} 失败 · 历史欠账 ${debt} 项（基线 ${debtBaseline}）· exit ${fail ? 1 : 0}`);
  return { pass, warn, fail, debt, debtBaseline };
}

function printJson(results, baseline, meta) {
  const summary = { pass: 0, warn: 0, fail: 0, debt: 0, debtBaseline: 0 };
  for (const r of results) {
    if (r.status === 'PASS') summary.pass++;
    else if (r.status === 'WARN') summary.warn++;
    else summary.fail++;
    if (r.kind === 'ratchet' && r.count > 0) {
      summary.debt += r.count;
      if (Number.isFinite(r.baseline)) summary.debtBaseline += r.baseline;
    }
  }
  const exitCode = summary.fail > 0 ? 1 : 0;
  const dir = 'docs/ui-contract';
  process.stdout.write(JSON.stringify({
    tool: 'ui-contract-audit',
    version: 1,
    profile: 'v6',
    ok: exitCode === 0,
    exitCode,
    contract: {
      layout: `${dir}/layout.md`,
      design: `${dir}/design.md`,
      tokens: `${dir}/tokens.md`,
      baselineSource: baseline.from
    },
    source: { file: 'src/ui/', lines: meta.srcLines, bytes: meta.srcBytes, builtBytes: meta.builtBytes },
    checks: results.map((r) => ({ ...r })),
    summary
  }, null, 2) + '\n');
}

async function main() {
  if (PROFILE === 'v5') failExit('v5 的界面约定已被 v6 取代（docs/ui-contract/ 现在是 v6 的约定），--profile v5 不再可用。');
  if (PROFILE !== 'v6') failExit(`--profile 只认 v6（收到 ${PROFILE}）`);
  if (FLAG.update) failExit('v6 的基线固定全 0，不接受 --update-baseline：有违规就改代码或改约定文档。');
  const ctx = await loadContext();
  const baseline = loadBaseline();
  const meta = {
    src: ctx.src,
    srcLines: countLines(ctx.src),
    srcBytes: Buffer.byteLength(ctx.src, 'utf8'),
    builtBytes: Buffer.byteLength(ctx.built || '', 'utf8')
  };
  const results = evaluate(ctx, baseline);

  if (FLAG.json) {
    printJson(results, baseline, meta);
    const summary = results.reduce((acc, r) => { acc[r.status.toLowerCase()]++; return acc; }, { pass: 0, warn: 0, fail: 0 });
    if (FLAG.strict && summary.warn > 0) return 1;
    return summary.fail > 0 ? 1 : 0;
  }
  const summary = printHuman(results, baseline, meta);
  if (FLAG.strict && summary.warn > 0) {
    console.log('--strict：历史欠账也计失败。');
    return 1;
  }
  return summary.fail > 0 ? 1 : 0;
}

process.exitCode = await main();
