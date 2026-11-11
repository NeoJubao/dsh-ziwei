#!/usr/bin/env node
/**
 * scripts/audit-ui.mjs — 界面契约体检（ui-contract）
 *
 * 职责：**报告漂移，不修**。契约文档在 docs/ui-contract/，本脚本只做三件事：
 *   1. 按文档里的规则读源码（src/ui-pro.js）与构建产物（client.js）；
 *   2. 逐项输出 PASS / WARN / FAIL；
 *   3. 用「棘轮」把历史欠账锁住：违规数超过基线才 FAIL，等于基线是 WARN，低于基线提示可下调。
 *
 * 用法：
 *   node scripts/audit-ui.mjs                  体检；无 FAIL → exit 0
 *   node scripts/audit-ui.mjs --json           机器可读输出（verify/ui-contract.mjs 用）
 *   node scripts/audit-ui.mjs --update-baseline 重算基线并写 docs/ui-contract/audit-baseline.json
 *   node scripts/audit-ui.mjs --strict         历史欠账（WARN）也算失败
 *   node scripts/audit-ui.mjs -v               打印全部样例（不只前 5 条）
 *
 * 退出码：0 无 FAIL / 1 有 FAIL / 2 契约文档缺失或不可解析。
 *
 * 约束：不联网、不启动 GUI、不读第三方模块；只依赖 node:fs / node:path / node:url。
 * 行号随源码漂移，契约以选择器/类名为准；脚本不写死行号。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);

const PATHS = {
  src: join(ROOT, 'src', 'ui-pro.js'),
  built: join(ROOT, 'client.js'),
  layout: join(ROOT, 'docs', 'ui-contract', 'layout.md'),
  design: join(ROOT, 'docs', 'ui-contract', 'design.md'),
  tokens: join(ROOT, 'docs', 'ui-contract', 'tokens.md'),
  baseline: join(ROOT, 'docs', 'ui-contract', 'audit-baseline.json')
};

const ARGS = new Set(process.argv.slice(2));
const FLAG = {
  json: ARGS.has('--json'),
  update: ARGS.has('--update-baseline'),
  strict: ARGS.has('--strict'),
  verbose: ARGS.has('-v') || ARGS.has('--verbose')
};

/* ------------------------------------------------------------------ *
 * 基线（棘轮）
 * ------------------------------------------------------------------ */

/**
 * 内置默认基线 = 2026-11-07 首次实测值。JSON 文件存在时以文件为准；
 * 文件缺失（如全新 clone 未跑过 --update-baseline）时用这份兜底。
 */
const DEFAULT_BASELINE = {
  C1: 13,  // 字面色白名单外 literal（#fff 9 + 遮罩 2 + 滚动条 2）
  C2: 42,  // 字阶越界声明（CSS 39 + JSX 3）
  C3: 103, // 间距网格外取值（104 − 88 豁免 1）
  C4: 16,  // 字重越界（750×6 + 800×10）
  C15: 1,  // 深色对比度不达标组数（深色 accent 白字 2.72:1）
  C16: 49  // 已弃用私有品牌色引用数（accent 46 + accent-deep 3）
};

const DEFAULT_BASELINE_META = {
  version: 1,
  generatedAt: '2026-11-07T12:00:00.000Z',
  source: { srcLines: 2501, srcBytes: 141034 }
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

/** 行号（基于原文），用于报样例。 */
function lineOf(src, index) {
  if (index < 0) return 0;
  let n = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
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

/** tokens.md 全文中登记过的私有变量名（宽松；只用于「变量定义行」白名单）。 */
function parseTokenVarNames(md) {
  return new Set([...md.matchAll(/--zp-[a-z0-9-]+/g)].map((m) => m[0]));
}

const PAGE_PARAMS = {
  SIDE_COMPACT: 264,
  BOARD_COMPACT: 600,
  GAP_COMPACT: 12,
  PAD_COMPACT: 32,
  SIDE_MID: 296,
  SIDE_WIDE: 304,
  BOARD_MAX: 720,
  BOARD_MIN: 560,
  INSPECTOR_W: 300,
  INSPECTOR_GAP: 14,
  GUTTER: 16,
  PAGE_PAD_X: 40,
  DRAWER_W: 464,
  MODAL_W: 520
};

/* ------------------------------------------------------------------ *
 * 通用小工具
 * ------------------------------------------------------------------ */

/** CSS 声明值：给定匹配位置，返回它所在的整条声明（去空白）。 */
function declarationAt(css, idx) {
  const b = Math.max(css.lastIndexOf(';', idx), css.lastIndexOf('{', idx), css.lastIndexOf('}', idx));
  const semi = css.indexOf(';', idx);
  const brace = css.indexOf('}', idx);
  let e = idx + 160;
  if (semi >= 0 && brace >= 0) e = Math.min(semi, brace);
  else if (semi >= 0) e = semi;
  else if (brace >= 0) e = brace;
  return css.slice(b + 1, e).trim();
}

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

function checkC1(ctx) {
  const samples = [];
  let count = 0;
  const css = ctx.css.text;
  const re = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
  let m;
  while ((m = re.exec(css))) {
    const value = m[0];
    const decl = declarationAt(css, m.index);
    const isVarDef = /^--zp-[a-z0-9-]+\s*:/.test(decl);
    const varName = isVarDef ? /^--zp-[a-z0-9-]+/.exec(decl)[0] : null;
    const isShadow = /^box-shadow\s*:/.test(decl);
    const normalized = value.toLowerCase();
    const isWhitelisted = ctx.tokenWhitelist.has(normalized);
    const allowed = (isVarDef && !varName ? false : isVarDef && ctx.tokenVars.has(varName)) || isShadow || isWhitelisted;
    if (!allowed) {
      count++;
      samples.push(`${lineOf(ctx.src, ctx.css.startIndex + m.index)} · ${value} · ${decl.slice(0, 80)}`);
    }
  }
  return { count, samples };
}

function checkC2(ctx) {
  const allowed = new Set([20, 14, 13.5, 13, 12, 11, 10.5, 9.5]);
  const samples = [];
  let count = 0;
  for (const m of ctx.css.text.matchAll(/(?<![\w-])font-size\s*:\s*([^;}]+)/g)) {
    const nums = extractPxNumbers(m[1]);
    if (!nums.length) continue;
    const bad = nums.filter((n) => !allowed.has(n));
    if (bad.length) {
      count++;
      samples.push(`${lineOf(ctx.src, ctx.css.startIndex + m.index)} · ${m[1].trim()}（越界 ${[...new Set(bad)].join('/')}）`);
    }
  }
  for (const m of ctx.jsx.matchAll(/fontSize\s*:\s*(\d+(?:\.\d+)?)/g)) {
    const n = Number(m[1]);
    if (!allowed.has(n)) {
      count++;
      samples.push(`${lineOf(ctx.src, ctx.jsxIndex(m.index))} · fontSize: ${n}`);
    }
  }
  return { count, samples };
}

function checkC3(ctx) {
  const allowed = new Set([0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48]);
  const exempt = new Set([88]); // 空态一次性版式值，tokens/design 已登记
  const props = ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'gap', 'row-gap', 'column-gap'];
  const byValue = new Map();
  let count = 0;
  for (const prop of props) {
    const re = new RegExp(`(?<![\\w-])${prop}\\s*:\\s*([^;}]+)`, 'g');
    let m;
    while ((m = re.exec(ctx.css.text))) {
      for (const n of extractPxNumbers(m[1])) {
        const mag = Math.abs(n); // 负值用于贴边出血，档位按绝对值判定
        if (allowed.has(mag) || exempt.has(mag)) continue;
        count++;
        byValue.set(n, (byValue.get(n) || 0) + 1);
      }
    }
  }
  const samples = [...byValue.entries()].sort((a, b) => b[1] - a[1]).map(([v, c]) => `${v}px ×${c}`);
  return { count, samples };
}

function checkC4(ctx) {
  const allowed = new Set([400, 500, 600, 650, 700]);
  const samples = [];
  let count = 0;
  for (const m of ctx.css.text.matchAll(/font-weight\s*:\s*([^;}]+)/g)) {
    const v = m[1].trim();
    if (!/^\d+$/.test(v)) continue;
    if (!allowed.has(Number(v))) {
      count++;
      samples.push(`${lineOf(ctx.src, ctx.css.startIndex + m.index)} · ${v}`);
    }
  }
  for (const m of ctx.jsx.matchAll(/fontWeight\s*:\s*(\d+)/g)) {
    if (!allowed.has(Number(m[1]))) {
      count++;
      samples.push(`${lineOf(ctx.src, ctx.jsxIndex(m.index))} · fontWeight: ${m[1]}`);
    }
  }
  return { count, samples };
}

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
    samples.push(`${lineOf(ctx.src, ctx.css.startIndex + m.index)} · CSS position:fixed（浮层只许面板内 absolute）`);
  }
  for (const m of ctx.jsx.matchAll(/position\s*:\s*['"]fixed['"]/g)) {
    count++;
    samples.push(`${lineOf(ctx.src, ctx.jsxIndex(m.index))} · JSX position:'fixed'`);
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
    const line = lineOf(ctx.src, ctx.jsxIndex(m.index));
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
    const line = lineOf(ctx.src, ctx.jsxIndex(f.index));
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
      const line = lineOf(ctx.src, ctx.jsxIndex(el.index));
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

function checkC11(ctx) {
  const samples = [];
  let count = 0;
  const thread = collectElements(ctx.jsx, 'div').find((el) => /zp-chat-thread/.test(el.props));
  if (!thread) {
    return { count: 1, samples: ['找不到 .zp-chat-thread 对话容器（class 改名？）'] };
  }
  const line = lineOf(ctx.src, ctx.jsxIndex(thread.index));
  if (!/aria-live/.test(thread.props)) { count++; samples.push(`${line} · 对话流缺 aria-live（读屏静默）`); }
  if (!/role\s*:\s*['"]log['"]/.test(thread.props)) { count++; samples.push(`${line} · 对话流缺 role="log"`); }
  if (count === 0) samples.push('对话流 role=log + aria-live 齐备');
  return { count, samples };
}

function checkC12(ctx) {
  const samples = [];
  let count = 0;
  const CSS_REQUIRED = ['.zp-root', '.zp-head', '.zp-body', '.zp-side', '.zp-stage', '.zp-board', '.zp-grid',
    '.zp-detail', '.zp-overlay', '.zp-ai', '.zp-settings', '.zp-empty', '.zp-tabs'];
  for (const cls of CSS_REQUIRED) {
    const re = new RegExp(cls.replace('.', '\\.') + '\\s*[,{]', 'm');
    if (!re.test(ctx.css.text)) {
      count++;
      samples.push(`CSS 缺结构类 ${cls}`);
    }
  }
  const BUILD_REQUIRED = ['.zp-exit', '.zp-board', '.zp-ai', '--dsh-frame-top-clearance', 'zp-scroll'];
  if (!ctx.built) {
    return { count, samples: [...samples, 'client.js 缺失：构建一致性未验证'], skipped: true };
  }
  for (const needle of BUILD_REQUIRED) {
    if (!ctx.built.includes(needle)) {
      count++;
      samples.push(`client.js 缺 ${needle}（源码改了没构建？）`);
    }
  }
  if (count === 0) samples.push(`CSS 结构类 ${CSS_REQUIRED.length} 个齐备；构建产物关键串 ${BUILD_REQUIRED.length} 个齐备`);
  return { count, samples };
}

function checkC13(ctx) {
  const samples = [];
  let count = 0;
  const P = { ...PAGE_PARAMS, ...ctx.params };
  const COMPACT = P.SIDE_COMPACT + P.GAP_COMPACT + P.BOARD_COMPACT + P.PAD_COMPACT;
  const MID = P.SIDE_MID + P.GUTTER + P.BOARD_MAX + P.PAGE_PAD_X;
  const WIDE = P.SIDE_WIDE + P.GUTTER + P.BOARD_MAX + P.INSPECTOR_GAP + P.INSPECTOR_W + P.PAGE_PAD_X;

  for (const key of ['SIDE_COMPACT', 'BOARD_COMPACT', 'GAP_COMPACT', 'PAD_COMPACT', 'SIDE_MID', 'SIDE_WIDE', 'BOARD_MAX', 'INSPECTOR_W', 'INSPECTOR_GAP', 'GUTTER', 'PAGE_PAD_X', 'COMPACT', 'MID', 'WIDE']) {
    if (!(key in ctx.params)) {
      count++;
      samples.push(`layout.md §3.3 参数表缺 ${key}`);
    }
  }
  if (ctx.params.COMPACT && ctx.params.COMPACT !== COMPACT) {
    count++;
    samples.push(`layout.md COMPACT=${ctx.params.COMPACT} 与公式 ${COMPACT} 不符`);
  }
  if (ctx.params.MID && ctx.params.MID !== MID) {
    count++;
    samples.push(`layout.md MID=${ctx.params.MID} 与公式 ${MID} 不符`);
  }
  if (ctx.params.WIDE && ctx.params.WIDE !== WIDE) {
    count++;
    samples.push(`layout.md WIDE=${ctx.params.WIDE} 与公式 ${WIDE} 不符`);
  }

  const css = ctx.css.text;
  const boardMax = /--zp-board-max\s*:\s*(\d+)px/.exec(css);
  if (!boardMax || Number(boardMax[1]) !== P.BOARD_MAX) {
    count++;
    samples.push(`--zp-board-max: ${boardMax ? boardMax[1] + 'px' : '缺失'}，期望 ${P.BOARD_MAX}px`);
  }
  const compactMax = /data-w="compact"\]\s*\{\s*--zp-board-max:\s*(\d+)px/.exec(css);
  if (!compactMax || Number(compactMax[1]) !== P.BOARD_COMPACT) {
    count++;
    samples.push(`compact 档盘面上限 ${compactMax ? compactMax[1] : '缺失'}px，期望 ${P.BOARD_COMPACT}px`);
  }
  const compactGrid = /data-w="compact"\]\s*\.zp-body\s*\{[^}]*grid-template-columns:\s*(\d+)px/.exec(css);
  if (!compactGrid || Number(compactGrid[1]) !== P.SIDE_COMPACT) {
    count++;
    samples.push(`compact 档左栏宽 ${compactGrid ? compactGrid[1] : '缺失'}px，期望 ${P.SIDE_COMPACT}px`);
  }
  const midGrid = /data-w="mid"\]\s*\.zp-body\s*\{[^}]*grid-template-columns:\s*(\d+)px/.exec(css);
  if (!midGrid || Number(midGrid[1]) !== P.SIDE_MID) {
    count++;
    samples.push(`mid 档左栏宽 ${midGrid ? midGrid[1] : '缺失'}px，期望 ${P.SIDE_MID}px`);
  }
  const wideGrid = /data-w="wide"\]\s*\.zp-body\s*\{[^}]*grid-template-columns:\s*(\d+)px/.exec(css);
  if (!wideGrid || Number(wideGrid[1]) !== P.SIDE_WIDE) {
    count++;
    samples.push(`wide 档左栏宽 ${wideGrid ? wideGrid[1] : '缺失'}px，期望 ${P.SIDE_WIDE}px`);
  }
  const detailGrid = /\.zp-board-wrap\.has-detail\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*(\d+)px[^}]*gap:\s*(\d+)px/.exec(css);
  if (!detailGrid) {
    count++;
    samples.push('找不到 .zp-board-wrap.has-detail 的两列栅格');
  } else {
    if (Number(detailGrid[1]) !== P.INSPECTOR_W) {
      count++;
      samples.push(`详情列宽 ${detailGrid[1]}px，期望 ${P.INSPECTOR_W}px`);
    }
    if (Number(detailGrid[2]) !== P.INSPECTOR_GAP) {
      count++;
      samples.push(`盘面/详情间隙 ${detailGrid[2]}px，期望 ${P.INSPECTOR_GAP}px`);
    }
  }

  const scrollPad = /\.zp-scroll\s*\{[^}]*padding:\s*0\s+(\d+)px/.exec(css);
  if (!scrollPad || Number(scrollPad[1]) * 2 !== P.PAGE_PAD_X) {
    count++;
    samples.push(`滚动区横向内边距 ${scrollPad ? scrollPad[1] + 'px×2' : '缺失'}，期望合计 ${P.PAGE_PAD_X}px`);
  }
  const drawer = /width:\s*min\((\d+)px,\s*100%\)/.exec(css);
  if (!drawer || Number(drawer[1]) !== P.DRAWER_W) {
    count++;
    samples.push(`抽屉宽 ${drawer ? drawer[1] : '缺失'}px，期望 ${P.DRAWER_W}px`);
  }
  if (!new RegExp(`width:\\s*min\\(${P.MODAL_W}px,\\s*100%\\)`).test(css)) {
    count++;
    samples.push(`设置弹层宽不是 min(${P.MODAL_W}px, 100%)`);
  }

  const thresholds = [...ctx.src.matchAll(/panelW\s*>=\s*(\d+)/g)].map((m) => Number(m[1]));
  const expected = [COMPACT, MID, WIDE];
  if (thresholds.length !== 3 || thresholds.slice().sort((a, b) => a - b).join() !== expected.slice().sort((a, b) => a - b).join()) {
    count++;
    samples.push(`阈值字面量 [${thresholds.join(', ')}] 与公式 [${expected.join(', ')}] 不符`);
  }
  const hasConstants = /const\s+(LAYOUT|METRICS|MID_W|WIDE_W|SIDE_MID|BOARD_MAX)\b/.test(ctx.src);
  if (!hasConstants) {
    samples.push('阈值仍为字面量（P1-5 未做：应抽常量后由公式算出）');
  }
  if (count === 0) samples.push(`阈值 ${thresholds.join('/')} = 公式 ${expected.join('/')}；CSS 结构参数一致`);
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

function checkC15(ctx) {
  const samples = [];
  let count = 0;
  const css = ctx.css.text;
  const light = readCustomProps(css, '.zp-root {') || {};
  const dark = readCustomProps(css, 'body[data-ds-dark-theme] .zp-root') || {};
  const STRUCTURAL = new Set(['--zp-board-max']);
  const contentLight = new Set(Object.keys(light).filter((k) => !STRUCTURAL.has(k)));
  const contentDark = new Set(Object.keys(dark).filter((k) => !STRUCTURAL.has(k)));
  for (const k of contentLight) if (!contentDark.has(k)) { count++; samples.push(`深色缺内容色 ${k}`); }
  for (const k of contentDark) if (!contentLight.has(k)) { count++; samples.push(`深色多出未配对的 ${k}`); }
  if (count === 0) samples.push(`内容色浅/深配对 ${contentLight.size}/${contentDark.size} 全等`);

  const contrast = (fg, bg) => {
    const r = contrastRatio(fg, bg);
    return r === null ? null : Math.round(r * 100) / 100;
  };
  /* 白字填充统一走 --zp-fill-accent*（v3.1 新增）；没有定义时回退到 accent。 */
  const fillLight = light['--zp-fill-accent'] || light['--zp-accent'];
  const fillDark = dark['--zp-fill-accent'] || dark['--zp-accent'];
  const fillLightDeep = light['--zp-fill-accent-deep'] || light['--zp-accent-deep'];
  const fillDarkDeep = dark['--zp-fill-accent-deep'] || dark['--zp-accent-deep'];
  const pairs = [
    [fillLight, '#ffffff', '浅色填充色上的白字'],
    [fillDark, '#ffffff', '深色填充色上的白字'],
    [fillLightDeep, '#ffffff', '浅色填充色深端上的白字'],
    [fillDarkDeep, '#ffffff', '深色填充色深端上的白字'],
    [light['--zp-gold'], '#3c2f14', '浅色金底深字'],
    [dark['--zp-gold'], '#2a2210', '深色金底深字']
  ];
  for (const [fg, bg, label] of pairs) {
    if (!fg) continue;
    const r = contrast(fg, bg);
    if (r === null) continue;
    if (r < 4.5) {
      count++;
      samples.push(`${label}: ${fg} on ${bg} = ${r}:1 < 4.5:1`);
    }
  }
  return { count, samples };
}

function checkC16(ctx) {
  const samples = [];
  let count = 0;
  for (const m of ctx.css.text.matchAll(/var\(\s*--zp-accent(?:-deep)?\b/g)) {
    count++;
    if (samples.length < 5) samples.push(`${lineOf(ctx.src, ctx.css.startIndex + m.index)} · var(${/--zp-accent(?:-deep)?/.exec(m[0])[0]})`);
  }
  samples.push(`私有品牌色引用 ${count} 处（迁移目标：--dsw-alias-brand-primary / button-primary-hover）`);
  return { count, samples };
}

/* ------------------------------------------------------------------ *
 * 检查清单
 * ------------------------------------------------------------------ */

const CHECKS = [
  { id: 'C1', title: '字面色白名单', kind: 'ratchet', run: checkC1 },
  { id: 'C2', title: '字阶白名单（8 档）', kind: 'ratchet', run: checkC2 },
  { id: 'C3', title: '间距 4/8 网格', kind: 'ratchet', run: checkC3 },
  { id: 'C4', title: '字重白名单（5 档）', kind: 'ratchet', run: checkC4 },
  { id: 'C5', title: 'darwin 窗口 chrome 避让', kind: 'hard', run: checkC5 },
  { id: 'C6', title: '层叠隔离 isolation', kind: 'hard', run: checkC6 },
  { id: 'C7', title: '无 position:fixed', kind: 'hard', run: checkC7 },
  { id: 'C8', title: '弹层语义（dialog）', kind: 'hard', run: checkC8 },
  { id: 'C9', title: 'iframe title/sandbox', kind: 'hard', run: checkC9 },
  { id: 'C10', title: '表单控件可访问名称', kind: 'hard', run: checkC10 },
  { id: 'C11', title: '对话流 aria-live', kind: 'hard', run: checkC11 },
  { id: 'C12', title: '结构类 + 构建一致性', kind: 'hard', run: checkC12 },
  { id: 'C13', title: '阈值公式对账', kind: 'hard', run: checkC13 },
  { id: 'C14', title: 'RegionId 白名单', kind: 'hard', run: checkC14 },
  { id: 'C15', title: '深色成对 + 对比度', kind: 'ratchet', run: checkC15 },
  { id: 'C16', title: '私有品牌色退役', kind: 'ratchet', run: checkC16 }
];

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

function failExit(msg) {
  console.error(`\n[audit-ui] ${msg}\n`);
  process.exit(2);
}

function loadContext() {
  const src = read(PATHS.src);
  if (!src) failExit(`读不到源码 ${relative(ROOT, PATHS.src)}（工作目录应是 ziwei-workbench/）`);
  const layoutMd = read(PATHS.layout);
  const designMd = read(PATHS.design);
  const tokensMd = read(PATHS.tokens);
  if (!layoutMd || !designMd || !tokensMd) {
    failExit(`契约文档缺失：需 docs/ui-contract/{layout,design,tokens}.md 三份齐全`);
  }
  const css = extractCssTemplate(src);
  if (!css.text) failExit('源码里找不到 const CSS = `...` 模板（结构变了？）');
  const jsx = src.slice(0, css.startIndex) + src.slice(css.endIndex);
  const cssLenBefore = css.startIndex;
  return {
    src,
    built: read(PATHS.built),
    css,
    jsx,
    jsxIndex: (idx) => (idx < cssLenBefore ? idx : idx + (css.endIndex - css.startIndex)),
    layoutMd,
    designMd,
    tokensMd,
    params: parseLayoutParams(layoutMd),
    regions: parseLayoutRegions(layoutMd),
    tokenWhitelist: parseTokenWhitelist(tokensMd),
    tokenVars: parseTokenVarNames(tokensMd)
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
  if (r.count < base) return `${r.count} 处 < 基线 ${base}（可 --update-baseline 下调）`;
  return '0 处';
}

function printHuman(results, baseline, meta) {
  const icon = { PASS: 'PASS', WARN: 'WARN', FAIL: 'FAIL' };
  console.log('紫微斗数 Pro · 界面契约体检（ui-contract）');
  console.log(`契约：docs/ui-contract/{layout,design,tokens}.md · 源码：src/ui-pro.js（${countLines(meta.src)} 行）· 构建：client.js（${meta.builtBytes} B）`);
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
  process.stdout.write(JSON.stringify({
    tool: 'ui-contract-audit',
    version: 1,
    ok: exitCode === 0,
    exitCode,
    contract: {
      layout: 'docs/ui-contract/layout.md',
      design: 'docs/ui-contract/design.md',
      tokens: 'docs/ui-contract/tokens.md',
      baselineSource: baseline.from
    },
    source: { file: 'src/ui-pro.js', lines: meta.srcLines, bytes: meta.srcBytes, builtBytes: meta.builtBytes },
    checks: results.map((r) => ({ ...r })),
    summary
  }, null, 2) + '\n');
}

function updateBaseline(ctx, results, meta) {
  const counts = {};
  for (const r of results) {
    if (r.kind === 'ratchet') counts[r.id] = r.count;
  }
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    note: 'ui-contract 棘轮基线：只许下降。由 node scripts/audit-ui.mjs --update-baseline 生成。',
    source: { srcLines: meta.srcLines, srcBytes: meta.srcBytes },
    counts
  };
  writeFileSync(PATHS.baseline, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log('基线已更新：docs/ui-contract/audit-baseline.json');
  const old = loadBaseline();
  for (const [k, v] of Object.entries(counts)) {
    const before = old.counts[k];
    const delta = before === undefined ? '新增' : v === before ? '不变' : v < before ? `↓ ${before - v}` : `↑ ${v - before}（注意：上涨）`;
    console.log(`  ${k.padEnd(4)} ${String(v).padStart(4)}  ${delta}`);
  }
}

function main() {
  const ctx = loadContext();
  const baseline = loadBaseline();
  const meta = {
    src: ctx.src,
    srcLines: countLines(ctx.src),
    srcBytes: Buffer.byteLength(ctx.src, 'utf8'),
    builtBytes: Buffer.byteLength(ctx.built || '', 'utf8')
  };
  const results = evaluate(ctx, baseline);

  if (FLAG.update) {
    updateBaseline(ctx, results, meta);
    return 0;
  }
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

process.exitCode = main();
