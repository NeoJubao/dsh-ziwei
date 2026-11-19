/* ================================================================
 * 30-report：报告——markdown、分部、徽记、静态命盘、导出文件（window.ZWReport，由 27-zwui 暴露）
 *
 * - 纯逻辑：定义时和调用时都不碰 DOM、定时器、存储；每个函数返回字符串或普通对象。
 * - 设计参考 docs/design/v6-prototype/report.js（原型专用的样稿没有搬）；markdown 口径沿用 v5（src/ui-pro.js）。
 * - 正文版式在 css/85-prose.css：构建时注入下面的 PROSE_CSS（面板 CSS 里也有同一份），导出文件用它的压缩版。
 * - 导出文件独有的封面、命盘页、目录、落款、打印规则在 DOC_CSS / PRINT_CSS 里：那是独立文档，
 *   用自己的颜色（--zr-* 的浅 / 深 / 打印三组）和 pt 单位，不走面板 token。
 * - 四化配色沿用 v5：禄绿、权蓝、科金、忌红（原型里权和科对调了，没有照搬）。
 * - 整个模块包在一个函数里，只有 ZWREPORT 一个顶层名字，不和其它文件的小工具重名。
 * ================================================================ */
const ZWREPORT = (function () {
  /* 构建时由 build.mjs 换成 src/ui/css/85-prose.css 的全文 */
  const PROSE_CSS = `/*__ZIWEI_CSS:prose__*/`;

  const escHtml = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* v5 报告的 14 个部分（ziwei-core 的方法论顺序） */
  const REPORT_SECTION_TITLES = [
    '命盘总览', '性格大略', '家庭关系', '婚姻情感', '子女培育', '财富管理', '健康养生',
    '事业发展', '朋友贵人', '居家风水', '心灵福德', '出行迁移', '大限节奏', '综合建议'
  ];
  const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  /* 十四主星，顺序同 --zp-s0…13 / --zr-s0…13（tokens.md） */
  const STARS14 = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
  const STAR_LIGHT = ['#8a5cc4', '#2f84b8', '#c96a24', '#a07b1c', '#c04d78', '#b5402f', '#93633a', '#5b6cc0', '#2f9363', '#6d808a', '#21917d', '#7d6c56', '#a3354a', '#4560a6'];
  const STAR_DARK = ['#c7aaf5', '#86c3e8', '#f3ab70', '#e2c06e', '#ef97b5', '#ec8a7b', '#d6a982', '#aab6f2', '#86d6a9', '#b4c3cb', '#7bd6c3', '#c9b9a2', '#e48190', '#93aaea'];
  const MINOR_GOOD = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺', '禄存', '天马'];
  const MU_KIND = { 禄: 'lu', 权: 'quan', 科: 'ke', 忌: 'ji' };
  const starVar = (name) => { const i = STARS14.indexOf(name); return i < 0 ? 'var(--zr-gold)' : 'var(--zr-s' + i + ')'; };
  const lunarOf = (c) => String(c.lunarText || '').replace(/(\d+)月/, (_, m) => (LUNAR_MONTHS[+m - 1] || m) + '月');
  const pad2 = (n) => ('0' + n).slice(-2);

  /* ---------------- markdown（v5 口径：先转义再上标记，只放行 <br>） ---------------- */
  const mdInline = (t) => escHtml(t)
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const mdSplitRow = (line) => {
    let s = String(line).trim();
    if (s.charAt(0) === '|') s = s.slice(1);
    if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1);
    return s.split('|').map((c) => c.trim());
  };
  const mdIsTableSep = (line) => {
    if (String(line).indexOf('|') < 0) return false;
    const cells = mdSplitRow(line);
    return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c));
  };
  const mdAlignOf = (cell) => {
    const left = cell.charAt(0) === ':';
    const right = cell.charAt(cell.length - 1) === ':';
    return left && right ? 'center' : right ? 'right' : left ? 'left' : '';
  };
  const mdTableHtml = (header, aligns, rows, cls) => {
    const al = (i) => (aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '');
    const th = header.map((c, i) => '<th' + al(i) + '>' + mdInline(c) + '</th>').join('');
    const body = rows.map((row) => '<tr>' + header.map((_, i) => '<td' + al(i) + '>' + mdInline(row[i] || '') + '</td>').join('') + '</tr>').join('');
    return '<table class="' + (cls || 'md-table') + '"><thead><tr>' + th + '</tr></thead>' + (body ? '<tbody>' + body + '</tbody>' : '') + '</table>';
  };
  /* 管道表格：当前行以 | 开头、下一行是分隔行；读到不以 | 开头的行为止。返回 { header, aligns, rows, next } */
  const mdReadTable = (lines, i) => {
    const header = mdSplitRow(lines[i].trim());
    const aligns = mdSplitRow(lines[i + 1]).map(mdAlignOf);
    const rows = [];
    let j = i + 2;
    while (j < lines.length && lines[j].trim().charAt(0) === '|' && !mdIsTableSep(lines[j])) { rows.push(mdSplitRow(lines[j])); j++; }
    return { header, aligns, rows, next: j };
  };

  /* 报告正文：## → h3，### → h4，管道表格，引用，列表，分隔线，段落 */
  function mdToHtml(md) {
    const lines = String(md || '').split('\n');
    const out = [];
    let inList = null;
    const flush = () => { if (inList) { out.push('</' + inList + '>'); inList = null; } };
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t) { flush(); continue; }
      if (t.charAt(0) === '|' && i + 1 < lines.length && mdIsTableSep(lines[i + 1])) {
        flush();
        const tb = mdReadTable(lines, i);
        out.push(mdTableHtml(tb.header, tb.aligns, tb.rows));
        i = tb.next - 1;
        continue;
      }
      const h = /^(#{1,6})\s+(.*)$/.exec(t);
      if (h) { flush(); const lv = Math.min(4, h[1].length + 1); out.push('<h' + lv + '>' + mdInline(h[2]) + '</h' + lv + '>'); continue; }
      if (/^([-*_])\1{2,}$/.test(t)) { flush(); out.push('<hr>'); continue; }
      const q = /^>\s?(.*)$/.exec(t);
      if (q) { flush(); out.push('<blockquote class="quote-block">' + mdInline(q[1]) + '</blockquote>'); continue; }
      const li = /^[-*•]\s+(.*)$/.exec(t);
      if (li) { if (inList !== 'ul') { flush(); out.push('<ul>'); inList = 'ul'; } out.push('<li>' + mdInline(li[1]) + '</li>'); continue; }
      const num = /^\d+[.)]\s+(.*)$/.exec(t) || /^\d+、\s*(.*)$/.exec(t);
      if (num) { if (inList !== 'ol') { flush(); out.push('<ol>'); inList = 'ol'; } out.push('<li>' + mdInline(num[1]) + '</li>'); continue; }
      flush();
      out.push('<p class="body-text">' + mdInline(t) + '</p>');
    }
    flush();
    return out.join('\n');
  }

  /* 紫微师面板的回答：同一套表格解析，但用 .zp-md-* 的对话排版（div 结构，不出 h 标签） */
  function mdToChatHtml(md) {
    const lines = String(md || '').split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\s+$/, '');
      if (!line.trim()) { out.push('<div class="zp-md-gap"></div>'); continue; }
      const t = line.trim();
      if (t.charAt(0) === '|' && i + 1 < lines.length && mdIsTableSep(lines[i + 1])) {
        const tb = mdReadTable(lines, i);
        out.push(mdTableHtml(tb.header, tb.aligns, tb.rows, 'zp-md-table'));
        i = tb.next - 1;
        continue;
      }
      const hm = /^(#{1,4})\s+(.*)$/.exec(line);
      if (hm) { out.push('<div class="zp-md-h zp-md-h' + hm[1].length + '">' + mdInline(hm[2]) + '</div>'); continue; }
      const qm = /^>\s?(.*)$/.exec(line);
      if (qm) { out.push('<div class="zp-md-quote">' + mdInline(qm[1]) + '</div>'); continue; }
      const lm = /^\s*([-*]|\d+[.)])\s+(.*)$/.exec(line);
      if (lm) { out.push('<div class="zp-md-li">· ' + mdInline(lm[2]) + '</div>'); continue; }
      out.push('<div class="zp-md-p">' + mdInline(line) + '</div>');
    }
    return out.join('');
  }

  /* ---------------- 分部 ---------------- */
  const SECTION_HEADING = /^##\s+(.+?)\s*$/;
  /* 流式输出时最后一行可能只有 # 记号（标题还没写出字） */
  const BARE_MARKS = /^#{1,6}\s*$/;
  const NUMBERED = /^([一二三四五六七八九十百]+|\d{1,2})[、.．]\s*(.*)$/;
  const NUMERALS_ONLY = /^(?:[一二三四五六七八九十百]+|\d{1,2})$/;
  const TRAILING_RULE = /\n\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

  /**
   * 按「## 」切成部分。标题里的「一、」拆成编号；没有编号的部分（盘前须知、十二字心法）不补编号；
   * 第一个 ## 之前的文字是 lead 部分（没有标题）。部分末尾的分隔线不画（下一部分自带分界），表格包一层横向滚动。
   * 流式安全：标题写到一半也算一个部分；末尾只有 # 记号的那一行先不算；往后追加文字，除了最后一个部分，
   * 前面各部分的结果不变（id 按位置编号）。返回 [{ id, num, title, html, lead, motto }]。
   */
  function splitSections(md) {
    const lines = String(md || '').split('\n');
    if (lines.length && BARE_MARKS.test(lines[lines.length - 1])) lines.pop();
    const raw = [];
    let cur = { heading: false, title: '', body: [] };
    for (const line of lines) {
      const m = SECTION_HEADING.exec(line);
      if (m) {
        if (cur.heading || cur.body.join('').trim()) raw.push(cur);
        cur = { heading: true, title: m[1], body: [] };
      } else {
        cur.body.push(line);
      }
    }
    if (cur.heading || cur.body.join('').trim()) raw.push(cur);
    return raw.map((s, i) => {
      const full = s.title.replace(/\*\*|`/g, '').trim();
      const nm = NUMBERED.exec(full);
      const onlyNum = !nm && NUMERALS_ONLY.test(full);
      const num = nm ? nm[1] : onlyNum ? full : '';
      const title = nm ? nm[2].trim() : onlyNum ? '' : full;
      const body = s.body.join('\n').replace(TRAILING_RULE, '\n');
      const html = mdToHtml(body)
        .split('<table class="md-table">').join('<div class="zr-tw"><table class="md-table">')
        .split('</table>').join('</table></div>');
      return { id: 'zr-s' + i, num, title, html, lead: !s.heading, motto: /心法/.test(title) };
    });
  }

  const sectionHtml = (s) => '<section class="zr-sec' + (s.motto ? ' zr-motto' : '') + (s.lead ? ' zr-lead' : '') + '" id="' + escHtml(s.id) + '" data-sec="' + escHtml(s.id) + '">' +
    (s.title || s.num ? '<h2 class="zr-h">' + (s.num ? '<i>' + escHtml(s.num) + '</i>' : '') + (s.title ? '<b>' + escHtml(s.title) + '</b>' : '') + '</h2>' : '') +
    (s.html || '') + '</section>';

  /**
   * 写到哪了：只数有编号的部分。后面已经出现下一个部分的算写完（done），current 是正在写的那一部分（从 1 起，最多 14）。
   * 第 14 部分之后又出现一个部分（例如十二字心法）时 done = 14；流结束之后由调用方自己把最后一部分算作写完。
   */
  function progress(md) {
    const secs = splitSections(md);
    const total = REPORT_SECTION_TITLES.length;
    let done = 0;
    secs.forEach((s, i) => { if (s.num && i < secs.length - 1) done++; });
    done = Math.min(done, total);
    return { done, total, current: Math.min(done + 1, total) };
  }

  /* ---------------- 徽记：这张盘的浑天仪 ----------------
   * 十二地支环（午在上，顺时针），十四主星按所在宫的地支落位（data-star 标出每颗星），命宫那一格点亮。
   * 颜色全走 CSS 变量（--zr-s0…13、--zr-gold、--zr-ink…），换主题不用重画。
   * opts：small（小尺寸：线加粗、不画刻度和地支）、labels（星名写在星点旁）、id（渐变 id 的前缀，同页多枚时各不相同）、label（无障碍名称）。 */
  function emblemSvg(c, o) {
    o = o || {};
    const uid = String(o.id || 'zre').replace(/[^\w-]/g, '') || 'zre';
    const G = 'var(--zr-em-gold, var(--zr-gold))', INK = 'var(--zr-em-ink, var(--zr-ink))';
    const K = o.small ? 2.1 : 1;
    const W = (w) => (w * K).toFixed(2);
    const D = Math.PI / 180;
    const ang = (b) => (180 + b * 30) * D;
    const pt = (r, a) => (200 + r * Math.sin(a)).toFixed(1) + ' ' + (200 - r * Math.cos(a)).toFixed(1);
    const FONT = 'font-family="Songti SC,STSong,Noto Serif SC,SimSun,serif"';
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="' + escHtml(o.label || '这张盘的星图') + '">' +
      '<defs><radialGradient id="' + uid + 'c"><stop offset="0" stop-color="#fff"/><stop offset=".4" style="stop-color:var(--zr-em-core,#cdb8f4)"/><stop offset="1" stop-color="#8a5cc4" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + uid + 'h"><stop offset="0" style="stop-color:var(--zr-zi);stop-opacity:var(--zr-em-halo,.26)"/><stop offset="1" stop-color="#8a5cc4" stop-opacity="0"/></radialGradient></defs>';
    /* 命宫那一格 */
    const mb = BRANCHES.indexOf(c.palaces[c.soulIndex].branch);
    const a0 = ang(mb) - 15 * D, a1 = ang(mb) + 15 * D;
    s += '<path d="M' + pt(186, a0) + ' A186 186 0 0 1 ' + pt(186, a1) + ' L' + pt(158, a1) + ' A158 158 0 0 0 ' + pt(158, a0) + ' Z" style="fill:' + G + '" fill-opacity=".22"/>';
    s += '<g fill="none" style="stroke:' + G + '"><circle cx="200" cy="200" r="186" stroke-width="' + W(1.3) + '"/><circle cx="200" cy="200" r="158" stroke-width="' + W(0.8) + '" stroke-opacity=".8"/>';
    for (let b = 0; b < 12; b++) { const a = ang(b) + 15 * D; s += '<path d="M' + pt(158, a) + ' L' + pt(186, a) + '" stroke-width="' + W(0.8) + '" stroke-opacity=".7"/>'; }
    if (!o.small) {
      for (let k = 0; k < 72; k++) { const a = k * 5 * D; s += '<path d="M' + pt(186, a) + ' L' + pt(k % 6 === 3 ? 193 : k % 2 ? 189 : 190.5, a) + '" stroke-width=".6" stroke-opacity=".55"/>'; }
    }
    /* 仪环 */
    s += '<circle cx="200" cy="200" r="104" stroke-width="' + W(1.5) + '"/>' +
      '<ellipse cx="200" cy="200" rx="104" ry="39" transform="rotate(-28 200 200)" stroke-width="' + W(1.2) + '" stroke-opacity=".9"/>' +
      '<ellipse cx="200" cy="200" rx="104" ry="67" transform="rotate(34 200 200)" stroke-width="' + W(0.9) + '" stroke-opacity=".7"/>' +
      '<ellipse cx="200" cy="200" rx="104" ry="16" transform="rotate(76 200 200)" stroke-width="' + W(0.9) + '" stroke-opacity=".6"/>' +
      '<path d="M' + pt(113, 24 * D) + ' L' + pt(113, 204 * D) + '" stroke-width="' + W(0.8) + '" stroke-opacity=".7"/></g>';
    [24, 204].forEach((d) => { const q = pt(113, d * D).split(' '); s += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="2.6" style="fill:' + G + '"/>'; });
    /* 地支 */
    if (!o.small) {
      s += '<g ' + FONT + ' font-size="13" text-anchor="middle" style="fill:' + INK + '">';
      for (let b = 0; b < 12; b++) {
        const p = pt(172, ang(b)).split(' ');
        s += '<text x="' + p[0] + '" y="' + (+p[1] + 4.6).toFixed(1) + '"' + (b === mb ? ' font-weight="600"' : ' fill-opacity=".72"') + '>' + BRANCHES[b] + '</text>';
      }
      s += '</g>';
    }
    /* 十四主星 */
    c.palaces.forEach((p) => {
      const b = BRANCHES.indexOf(p.branch), n = p.major.length;
      p.major.forEach((st, k) => {
        const a = ang(b) + (k - (n - 1) / 2) * 11 * D;
        const big = /庙|旺/.test(st.brightness || '');
        const r = (big ? 4.8 : 3.5) * (o.small ? 1.5 : 1);
        const q = pt(o.small ? 139 : 136, a).split(' ');
        const f = starVar(st.name);
        s += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + (r * 2.5).toFixed(1) + '" style="fill:' + f + '" fill-opacity=".16"/>' +
          '<circle data-star="' + escHtml(st.name) + '" cx="' + q[0] + '" cy="' + q[1] + '" r="' + r.toFixed(1) + '" style="fill:' + f + '"/>';
        if (o.labels && !o.small) {
          const tp = pt(121, a).split(' ');
          s += '<text x="' + tp[0] + '" y="' + (+tp[1] + 3.2).toFixed(1) + '" ' + FONT + ' font-size="9" text-anchor="middle" style="fill:' + INK + ';stroke:var(--zr-em-back,var(--zr-paper))" fill-opacity=".9" stroke-width="2.6" stroke-opacity=".85" paint-order="stroke">' + escHtml(st.name) + '</text>';
        }
      });
    });
    /* 中心的紫微星 */
    s += '<circle cx="200" cy="200" r="46" fill="url(#' + uid + 'h)"/><circle cx="200" cy="200" r="17" fill="url(#' + uid + 'c)"/>' +
      '<path d="M200 176 L203.4 196.6 L224 200 L203.4 203.4 L200 224 L196.6 203.4 L176 200 L196.6 196.6 Z" fill="#fff" fill-opacity=".94"/>' +
      '<path d="M200 186 L201.6 198.4 L214 200 L201.6 201.6 L200 214 L198.4 201.6 L186 200 L198.4 198.4 Z" transform="rotate(45 200 200)" style="fill:' + G + '" fill-opacity=".85"/></svg>';
    return s;
  }

  /* 封面上的星点：按生辰定种子，同一张盘每次都一样；中间一条留给徽记和文字 */
  function specksSvg(c) {
    let seed = 0;
    String(c.solarDate + c.timeName).split('').forEach((ch) => { seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; });
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let s = '<svg class="zr-specks" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';
    for (let i = 0; i < 150; i++) {
      const big = rnd() > 0.93, x = rnd() * 800, y = rnd() * 1000, r = big ? 1.1 + rnd() * 0.6 : 0.45 + rnd() * 0.6, op = 0.25 + rnd() * 0.65;
      if (x > 215 && x < 585) continue;
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(2) + '" fill-opacity="' + op.toFixed(2) + '"/>';
    }
    return s + '</svg>';
  }

  /* ---------------- 静态命盘（导出文件里的那张盘） ---------------- */
  /* 宫位序号 → [列, 行]：寅在左下，逆时针排一圈，中宫占 2–3 行列 */
  const CELL_POS = { 3: [1, 1], 4: [2, 1], 5: [3, 1], 6: [4, 1], 2: [1, 2], 7: [4, 2], 1: [1, 3], 8: [4, 3], 0: [1, 4], 11: [2, 4], 10: [3, 4], 9: [4, 4] };
  const sealHtml = (mu) => (MU_KIND[mu] ? '<i class="zr-seal zr-' + MU_KIND[mu] + '">' + escHtml(mu) + '</i>' : '');
  function boardHtml(c, name) {
    const star = (s) => '<span class="zr-star" style="color:' + starVar(s.name) + '">' + escHtml(s.name) +
      (s.brightness ? '<sup>' + escHtml(s.brightness) + '</sup>' : '') + sealHtml(s.mutagen) + '</span>';
    let h = '<div class="zr-board">';
    for (let i = 0; i < 12; i++) {
      const p = c.palaces[i], pos = CELL_POS[i];
      const range = p.decadal && p.decadal.range ? p.decadal.range[0] + '–' + p.decadal.range[1] : '';
      h += '<div class="zr-cell" style="grid-column:' + pos[0] + ';grid-row:' + pos[1] + '">' +
        '<div class="zr-cell-h"><b>' + escHtml(p.name) + (i === c.soulIndex ? '<em>命</em>' : '') + (i === c.bodyIndex ? '<em class="zr-body-mark">身</em>' : '') + '</b><span>' + escHtml(p.stem + p.branch) + '</span></div>' +
        '<div class="zr-majors">' + (p.major.length ? p.major.map(star).join('') : '<span class="zr-none">空宫</span>') + '</div>' +
        (p.minor.length ? '<div class="zr-minors">' + p.minor.map((s) => '<span class="' + (MINOR_GOOD.indexOf(s.name) >= 0 ? 'zr-good' : 'zr-bad') + '">' + escHtml(s.name) + sealHtml(s.mutagen) + '</span>').join('') + '</div>' : '') +
        '<div class="zr-cell-f"><span>' + escHtml(range) + '</span><span>' + escHtml(p.changsheng12 || '') + '</span></div></div>';
    }
    const pillars = [['yearly', '年'], ['monthly', '月'], ['daily', '日'], ['hourly', '时']]
      .map((k) => '<span>' + escHtml(c.pillars[k[0]]) + '<small>' + k[1] + '</small></span>').join('');
    h += '<div class="zr-center"><b>' + escHtml(name) + '</b><div class="zr-pillars">' + pillars + '</div>' +
      '<p>' + escHtml(c.fiveElementsClass + ' · 命主 ' + c.soulMaster + ' · 身主 ' + c.bodyMaster) + '</p>' +
      '<p>' + escHtml('起运 ' + c.startAge + ' 岁 · 属' + c.zodiac) + '</p></div></div>';
    return h;
  }

  /* ---------------- 导出文件的版式 ---------------- */
  const FONTS = '--zr-serif:"Songti SC","STSong","Noto Serif SC","Source Han Serif SC","SimSun",serif;' +
    '--zr-kai:"Kaiti SC","STKaiti","KaiTi",serif;' +
    '--zr-sans:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif;';
  const starVars = (list) => list.map((c, i) => '--zr-s' + i + ':' + c + ';').join('');
  /* 浅色 / 深色两组，键集合完全相同（自检逐个比对）；打印一律用浅色 */
  const LIGHT = '--zr-bg:#f4f3f7;--zr-paper:#ffffff;--zr-fill:#f5f6f8;--zr-ink:#14161b;--zr-ink-2:#4c525c;--zr-ink-3:#6b7079;--zr-rule:rgba(15,17,21,.12);' +
    '--zr-gold:#a07a2c;--zr-gold-text:#8a6a1f;--zr-zi:#6b55d4;--zr-lu:#15803d;--zr-quan:#1d4ed8;--zr-ke:#a16207;--zr-ji:#b91c1c;' +
    '--zr-cover:linear-gradient(180deg,#e6e1f6 0%,#f1e6ee 50%,#fbeee2 100%);--zr-cover-ink:#231d3a;--zr-cover-sub:#5f587a;--zr-cover-back:#efe6ef;' +
    '--zr-speck:#a07a2c;--zr-speck-o:.5;--zr-em-core:#cdb8f4;--zr-em-halo:.26;' + starVars(STAR_LIGHT);
  const DARK = '--zr-bg:#0f0f12;--zr-paper:#19191c;--zr-fill:#232326;--zr-ink:#f4f5f6;--zr-ink-2:#c6cacf;--zr-ink-3:#969ba3;--zr-rule:rgba(255,255,255,.14);' +
    '--zr-gold:#dcb96f;--zr-gold-text:#dcb96f;--zr-zi:#b9a7fa;--zr-lu:#4ade80;--zr-quan:#7aa2ff;--zr-ke:#e3b341;--zr-ji:#f87171;' +
    '--zr-cover:radial-gradient(120% 80% at 50% 34%,#2b2050 0%,#17122e 46%,#0b0a18 100%);--zr-cover-ink:#f4f1ff;--zr-cover-sub:#b3abd0;--zr-cover-back:#1c1638;' +
    '--zr-speck:#ffffff;--zr-speck-o:1;--zr-em-core:#e3d4ff;--zr-em-halo:.5;' + starVars(STAR_DARK);
  /* 封面、命盘页、目录、落款、打印按钮（屏幕）。排在正文样式之后：同权重时以这里为准（例如中宫、落款里的 p 不要正文的段距）。
   * --zr-vh 由文件里的小脚本按窗口高度设置，没有脚本时按 960px 高算。 */
  const DOC_CSS = [
    '*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--zr-bg);color:var(--zr-ink);font-family:var(--zr-sans)}',
    '.zr-page{container-type:inline-size;max-width:1180px;margin:0 auto;background:var(--zr-paper)}',
    '.zr-tools{position:sticky;top:0;z-index:5;height:0}',
    '.zr-print{position:absolute;right:20px;top:20px;height:34px;padding:0 14px;border:1px solid var(--zr-rule);border-radius:8px;background:var(--zr-paper);color:var(--zr-ink);font:500 13px var(--zr-sans);cursor:pointer;box-shadow:0 6px 20px -10px rgba(0,0,0,.4)}',
    '.zr-print:hover{background:var(--zr-fill)}',
    '.zr-cover{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:min(880px,calc(var(--zr-vh,9.6px)*92));padding:56px 24px 44px;text-align:center;background:var(--zr-cover);color:var(--zr-cover-ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.zr-cover{--zr-em-ink:var(--zr-cover-ink);--zr-em-back:var(--zr-cover-back)}.zr-specks{position:absolute;inset:0;width:100%;height:100%;fill:var(--zr-speck);opacity:var(--zr-speck-o)}.zr-cover>*:not(.zr-specks){position:relative}',
    '.zr-cover .zr-em{width:min(360px,70%);aspect-ratio:1;margin-bottom:18px}.zr-cover .zr-em svg{display:block;width:100%;height:100%}',
    '.zr-cover h1{margin:0;font:600 clamp(34px,6.4cqw,54px)/1.25 var(--zr-serif);letter-spacing:.3em;text-indent:.3em}',
    '.zr-sub{margin:8px 0 0;font-size:13px;letter-spacing:.22em;text-indent:.22em;color:var(--zr-cover-sub)}',
    '.zr-who{margin:34px 0 0;font:600 24px/1.4 var(--zr-serif);letter-spacing:.12em}',
    '.zr-when{margin:4px 0 0;font-size:14px;color:var(--zr-cover-sub);font-variant-numeric:tabular-nums}',
    '.zr-band{margin-top:30px;padding-top:14px;border-top:1px solid color-mix(in srgb,var(--zr-cover-ink) 22%,transparent);font-size:12.5px;letter-spacing:.12em;color:var(--zr-cover-sub)}',
    '.zr-layout{display:grid;grid-template-columns:minmax(0,1fr);padding:44px clamp(20px,5cqw,56px) 56px}',
    '.zr-main{min-width:0;max-width:720px;width:100%;margin:0 auto}',
    '.zr-toc{display:none}',
    '.zr-toc b{display:block;margin-bottom:10px;font:600 13px var(--zr-sans);color:var(--zr-ink-3);letter-spacing:.2em}',
    '.zr-toc a{display:flex;gap:10px;align-items:baseline;padding:5px 10px;border-radius:6px;color:var(--zr-ink-2);text-decoration:none;font-size:13.5px;line-height:1.5}',
    '.zr-toc a i{flex:none;width:2.2em;font:600 13px var(--zr-serif);font-style:normal;color:var(--zr-gold-text)}',
    '.zr-toc a:hover,.zr-toc a.zr-on{background:var(--zr-fill);color:var(--zr-ink)}',
    '@container (min-width:1040px){.zr-layout{grid-template-columns:216px minmax(0,720px);justify-content:center;column-gap:56px}.zr-main{margin:0}.zr-toc{display:block;position:sticky;top:28px;align-self:start;max-height:calc(var(--zr-vh,9.6px)*100 - 56px);overflow:auto}.zr-toc-inline{display:none}}',
    '.zr-chart h2{margin:0 0 14px;font:600 13px var(--zr-sans);letter-spacing:.2em;color:var(--zr-ink-3)}',
    '.zr-info{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:0 0 18px;border-top:1px solid var(--zr-rule)}',
    '.zr-info div{padding:9px 10px 9px 0;border-bottom:1px solid var(--zr-rule);font-size:14px;line-height:1.5;min-width:0}',
    '.zr-info span{display:block;font-size:12px;color:var(--zr-ink-3)}',
    '@container (max-width:640px){.zr-info{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '.zr-board{container-type:inline-size;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,auto);gap:4px;break-inside:avoid;page-break-inside:avoid}',
    '.zr-cell{display:flex;flex-direction:column;gap:2px;min-width:0;min-height:clamp(74px,17cqw,118px);padding:7px 8px 6px;border:1px solid var(--zr-rule);border-radius:8px;background:var(--zr-paper)}',
    '.zr-cell-h{display:flex;justify-content:space-between;align-items:baseline;gap:4px;white-space:nowrap}',
    '.zr-cell-h b{font:600 clamp(11.5px,2.1cqw,14.5px)/1.3 var(--zr-serif);letter-spacing:.04em}',
    '.zr-cell-h em{display:inline-block;margin-left:3px;padding:0 3px;border-radius:4px;font:500 10px/1.5 var(--zr-sans);font-style:normal;vertical-align:1px;background:var(--zr-zi);color:var(--zr-paper);-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.zr-cell-h em.zr-body-mark{background:var(--zr-gold)}',
    '.zr-cell-h span{font:clamp(10px,1.7cqw,12px)/1 var(--zr-serif);color:var(--zr-ink-3);letter-spacing:.06em}',
    '.zr-majors{display:flex;flex-wrap:wrap;gap:0 7px}',
    '.zr-star{font:600 clamp(12px,2.3cqw,16px)/1.4 var(--zr-serif);white-space:nowrap}',
    '.zr-star sup{margin-left:1px;font:400 10px var(--zr-sans);color:var(--zr-ink-3);vertical-align:5px}',
    '.zr-seal{display:inline-block;margin-left:3px;padding:0 3px;border-radius:3px;font:500 10px/1.45 var(--zr-sans);font-style:normal;vertical-align:2px;color:var(--zr-paper);-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.zr-seal.zr-lu{background:var(--zr-lu)}.zr-seal.zr-quan{background:var(--zr-quan)}.zr-seal.zr-ke{background:var(--zr-ke)}.zr-seal.zr-ji{background:var(--zr-ji)}',
    '.zr-minors{display:flex;flex-wrap:wrap;gap:0 6px;font:500 clamp(10px,1.75cqw,12px)/1.5 var(--zr-serif)}.zr-minors .zr-good{color:var(--zr-lu)}.zr-minors .zr-bad{color:var(--zr-ji)}',
    '.zr-none{font:12px var(--zr-serif);color:var(--zr-ink-3)}',
    '.zr-cell-f{margin-top:auto;display:flex;justify-content:space-between;gap:6px;font-size:clamp(9.5px,1.55cqw,11px);line-height:1.3;color:var(--zr-ink-3);font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.zr-cell-f span:first-child{color:var(--zr-gold-text)}',
    '.zr-center{grid-column:2/4;grid-row:2/4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:10px;border-radius:10px;background:var(--zr-fill);text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.zr-center b{font:600 clamp(16px,3.6cqw,26px)/1.2 var(--zr-serif)}.zr-center p{margin:0;font-size:clamp(10.5px,1.8cqw,12.5px);color:var(--zr-ink-2)}',
    '.zr-pillars{display:flex;gap:6px}.zr-pillars span{display:grid;gap:1px;padding:4px 8px;border-radius:6px;border:1px solid var(--zr-rule);background:var(--zr-paper);font:600 clamp(12px,2.1cqw,15px)/1.2 var(--zr-serif)}.zr-pillars small{font:400 10px var(--zr-sans);color:var(--zr-ink-3)}',
    '.zr-toc-inline{margin:28px 0 0;padding:16px 0 0;border-top:1px solid var(--zr-rule);columns:2;column-gap:32px}',
    '.zr-toc-inline a{display:flex;gap:10px;align-items:baseline;padding:3px 0;color:var(--zr-ink);text-decoration:none;font-size:14px;break-inside:avoid}',
    '.zr-toc-inline a i{flex:none;width:2.2em;font:600 13.5px var(--zr-serif);font-style:normal;color:var(--zr-gold-text)}',
    '.zr-body{margin-top:44px}',
    '.zr-end{break-inside:avoid;page-break-inside:avoid;margin-top:56px;padding-top:22px;border-top:1px solid var(--zr-rule);text-align:center;font-size:12.5px;line-height:1.9;color:var(--zr-ink-3)}',
    '.zr-stamp{display:inline-block;margin-bottom:10px;padding:5px 9px;border:1.5px solid var(--zr-ji);border-radius:4px;color:var(--zr-ji);font:600 13px var(--zr-serif);letter-spacing:.18em;text-indent:.18em;transform:rotate(-3deg)}',
    '.zr-end p{margin:0}.zr-end .zr-note{max-width:34em;margin:14px auto 0;font-size:12px;line-height:1.75}'
  ].join('');
  /* 打印：一律浅色；封面单独一页且铺满（第一页没有页边距）；命盘和目录一页；排在正文样式之后，才能盖住正文的屏幕字号 */
  const PRINT_CSS = '@page{size:A4;margin:17mm 18mm}@page :first{margin:0}' +
    '@media print{:root{color-scheme:light;' + LIGHT + '}' +
    'body{background:#fff}.zr-page{max-width:none}.zr-tools{display:none}.zr-toc{display:none}' +
    '.zr-cover{min-height:0;height:296mm;break-after:page;page-break-after:always}' +
    '.zr-layout{display:block;padding:0}.zr-main{max-width:none}.zr-toc-inline{display:block}' +
    '.zr-chart{break-after:page;page-break-after:always}.zr-body{margin-top:0}' +
    '.zr-prose{font-size:10.5pt}.zr-h b{font-size:16pt}.zr-h i{font-size:12pt}.zr-prose h3,.zr-prose h4{font-size:12pt}' +
    '.zr-prose blockquote{font-size:11pt}.zr-prose .md-table{font-size:9.5pt}.zr-motto p{font-size:16pt}.zr-sec{padding-top:24pt}}';
  /* 文件里唯一的脚本：窗口高度、打印按钮、宽屏目录随滚动高亮 */
  const DOC_SCRIPT = '(function(){var d=document,r=d.documentElement;' +
    'function vh(){r.style.setProperty("--zr-vh",window.innerHeight/100+"px")}vh();window.addEventListener("resize",vh);' +
    'var b=d.querySelector("[data-print]");if(b)b.onclick=function(){window.print()};' +
    'var links=[].slice.call(d.querySelectorAll(".zr-toc a"));if(!links.length||!("IntersectionObserver" in window))return;' +
    'var cur="";var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)cur=e.target.getAttribute("data-sec")});' +
    'links.forEach(function(a){a.classList.toggle("zr-on",a.getAttribute("data-to")===cur)})},{rootMargin:"-10% 0px -70% 0px"});' +
    '[].forEach.call(d.querySelectorAll("[data-sec]"),function(s){io.observe(s)})})();';

  /* 压缩 CSS：去注释、合并空白、去掉 { } ; , 两侧和冒号后的空格；引号里的内容原样保留 */
  function minifyCss(css) {
    const parts = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '').split(/("[^"]*"|'[^']*')/);
    return parts.map((p, i) => (i % 2 ? p : p.replace(/\s+/g, ' ').replace(/\s*([{};,])\s*/g, '$1').replace(/:\s+/g, ':')))
      .join('').replace(/;\}/g, '}').trim();
  }

  const fmtMonth = (d) => d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月';
  const ymdOf = (d) => d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  function soulLine(c) {
    const m = c.palaces[c.soulIndex].major.map((s) => s.name);
    if (m.length) return m.join('、') + '坐命';
    const opp = c.palaces[(c.soulIndex + 6) % 12].major.map((s) => s.name);
    return opp.length ? '命宫无主星，借' + opp.join('、') : '命宫无主星';
  }
  function solarLineOf(c) {
    const sc = c.meta && c.meta.solarCorrection;
    if (sc) {
      const lon = Number(sc.longitude);
      return c.solarDate + ' ' + sc.solarTime + '（真太阳时，' + (lon < 0 ? '西经 ' + Math.abs(lon) : '东经 ' + sc.longitude) + '°）';
    }
    const m = c.meta || {};
    const clock = typeof m.hour === 'number' ? ' ' + pad2(m.hour) + ':' + pad2(m.minute || 0) : '';
    return c.solarDate + clock + '（按钟表时间）';
  }
  const DISCLAIMER = '本报告基于中华传统文化（紫微斗数）体系生成，非现代科学结论，仅供参考，不构成医疗 / 法律 / 金融 / 婚姻等专业领域的决策依据。';

  /* 文档主体（不含 <html> 外壳）：打印按钮、封面、命盘页（基本信息 + 十二宫 + 目录）、正文、落款。颜色全走变量。 */
  function docBody(meta, md) {
    const c = meta.chart;
    const name = String(meta.name || '').trim() || '未命名';
    const today = new Date();
    const secs = splitSections(md);
    const yang = '甲丙戊庚壬'.indexOf(String(c.pillars && c.pillars.yearly).charAt(0)) >= 0;
    const sex = (yang ? '阳' : '阴') + (meta.gender === 'female' ? '女' : '男');
    const sp = String(c.solarDate).split('-');
    const solarCn = +sp[0] + ' 年 ' + +sp[1] + ' 月 ' + +sp[2] + ' 日';
    const toc = secs.filter((s) => s.title || s.num)
      .map((s) => '<a href="#' + s.id + '" data-to="' + s.id + '"><i>' + escHtml(s.num) + '</i>' + escHtml(s.title || s.num) + '</a>').join('');
    const info = [['称呼', name], ['性别', sex], ['公历', solarLineOf(c)], ['农历', c.lunar.year + ' 年' + lunarOf(c) + ' ' + c.timeName],
      ['五行局', c.fiveElementsClass], ['命宫 / 身宫', c.soulBranch + ' / ' + c.bodyBranch], ['出生地', meta.place || '未填'], ['职业', meta.occupation || '未填']];
    return '<div class="zr-page">' +
      '<div class="zr-tools"><button class="zr-print" type="button" data-print>打印 / 存为 PDF</button></div>' +
      '<header class="zr-cover">' + specksSvg(c) +
      '<div class="zr-em">' + emblemSvg(c, { labels: true, id: 'zrc', label: name + ' 的星图' }) + '</div>' +
      '<h1>人生鲲鹏计划</h1><p class="zr-sub">LifeView · 人生画板 · 紫微人生规划报告</p>' +
      '<p class="zr-who">' + escHtml(name) + '</p>' +
      '<p class="zr-when">' + escHtml(solarCn + ' · 农历' + lunarOf(c) + ' · ' + c.timeName) + '</p>' +
      '<div class="zr-band">' + escHtml(c.fiveElementsClass + ' · ' + soulLine(c) + ' · ' + fmtMonth(today)) + '</div></header>' +
      '<div class="zr-layout"><nav class="zr-toc" aria-label="目录"><b>目录</b><a href="#zr-chart" data-to="zr-chart"><i></i>命盘</a>' + toc + '</nav>' +
      '<main class="zr-prose zr-main"><section class="zr-chart" id="zr-chart" data-sec="zr-chart"><h2>命盘</h2>' +
      '<div class="zr-info">' + info.map((k) => '<div><span>' + k[0] + '</span>' + escHtml(k[1]) + '</div>').join('') + '</div>' +
      boardHtml(c, name) + '<nav class="zr-toc-inline" aria-label="目录">' + toc + '</nav></section>' +
      '<div class="zr-body">' + secs.map(sectionHtml).join('') + '</div>' +
      '<footer class="zr-end"><span class="zr-stamp">LifeView</span><p>紫微师 · 金聚｜道商意象紫微九诀</p><p>微信：neo2025new</p>' +
      '<p>人生画板 · ' + ymdOf(today) + '</p><p class="zr-note">' + DISCLAIMER + '</p></footer>' +
      '</main></div></div>';
  }

  /**
   * 导出文件：自带样式的单个 HTML，不依赖任何外部资源。屏幕上跟随系统深浅色，打印一律浅色。
   * meta：{ chart, name, place, occupation, gender }（和 v5 相同）；md：报告全文。文件名由调用方拼。
   */
  function buildReportHtml(meta, md) {
    meta = meta || {};
    const name = String(meta.name || '').trim() || '未命名';
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>人生鲲鹏计划 · ' + escHtml(name) + '</title><style>' +
      ':root{color-scheme:light dark;' + FONTS + '}:root{' + LIGHT + '}@media screen and (prefers-color-scheme:dark){:root{' + DARK + '}}' +
      minifyCss(PROSE_CSS) + DOC_CSS + PRINT_CSS +
      '</style></head><body>' + docBody(meta, md) + '<script>' + DOC_SCRIPT + '</script></body></html>';
  }

  return {
    REPORT_SECTION_TITLES, STARS14, STAR_LIGHT, STAR_DARK, FONTS, LIGHT, DARK, PROSE_CSS, DOC_CSS, PRINT_CSS, DISCLAIMER,
    escHtml, mdToHtml, mdToChatHtml, splitSections, sectionHtml, progress,
    emblemSvg, specksSvg, boardHtml, docBody, buildReportHtml, minifyCss, lunarOf
  };
})();
