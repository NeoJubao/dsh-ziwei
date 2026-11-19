/* 紫微斗数 v6 原型：完整报告。
   阅读页（应用内）和导出文件共用同一套正文版式（PROSE_CSS）和同一枚徽记（emblemSvg）；
   导出文件是自带样式的单个 HTML，可以直接打印成 PDF。markdown 解析沿用插件现有的 mdToHtml 口径。 */
(function () {
  'use strict';
  const E = window.ZWEngine;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const SC = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const LM = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  /* 十四主星的颜色走变量（--zr-s0…13），浅色、深色各一套；SVG 和文字都引用变量，换主题不用重画 */
  const STARS14 = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
  const STAR_LIGHT = { 紫微: '#8a5cc4', 天机: '#2f84b8', 太阳: '#c96a24', 武曲: '#a07b1c', 天同: '#c04d78', 廉贞: '#b5402f', 天府: '#93633a',
    太阴: '#5b6cc0', 贪狼: '#2f9363', 巨门: '#6d808a', 天相: '#21917d', 天梁: '#7d6c56', 七杀: '#a3354a', 破军: '#4560a6' };
  const STAR_DARK = { 紫微: '#c7aaf5', 天机: '#86c3e8', 太阳: '#f3ab70', 武曲: '#e2c06e', 天同: '#ef97b5', 廉贞: '#ec8a7b', 天府: '#d6a982',
    太阴: '#aab6f2', 贪狼: '#86d6a9', 巨门: '#b4c3cb', 天相: '#7bd6c3', 天梁: '#c9b9a2', 七杀: '#e48190', 破军: '#93aaea' };
  const starVars = map => STARS14.map((n, i) => '--zr-s' + i + ':' + map[n] + ';').join('');
  const sv = n => { const i = STARS14.indexOf(n); return i < 0 ? 'var(--zr-gold)' : 'var(--zr-s' + i + ')'; };
  const MINOR_GOOD = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺', '禄存', '天马'];
  const MU_KIND = { 禄: 'lu', 权: 'quan', 科: 'ke', 忌: 'ji' };
  const TITLES = ['命盘总览', '性格大略', '家庭关系', '婚姻情感', '子女培育', '财富管理', '健康养生', '事业发展', '朋友贵人', '居家风水', '心灵福德', '出行迁移', '大限节奏', '综合建议'];
  const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四'];
  const lunarOf = c => c.lunarText.replace(/^(\d+)月/, (_, m) => LM[+m - 1] + '月');

  /* ---------- markdown（与插件 mdToHtml 同口径：## → h3，### → h4，管道表格，引用，列表） ---------- */
  const mdInline = t => esc(t).replace(/&lt;br\s*\/?&gt;/gi, '<br>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const mdSplitRow = line => { let s = String(line).trim(); if (s.charAt(0) === '|') s = s.slice(1); if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1); return s.split('|').map(c => c.trim()); };
  const mdIsTableSep = line => { if (String(line).indexOf('|') < 0) return false; const cells = mdSplitRow(line); return cells.length > 0 && cells.every(c => /^:?-{1,}:?$/.test(c)); };
  const mdAlignOf = cell => { const l = cell.charAt(0) === ':', r = cell.charAt(cell.length - 1) === ':'; return l && r ? 'center' : r ? 'right' : l ? 'left' : ''; };
  function mdTableHtml(header, aligns, rows) {
    const al = i => (aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '');
    return '<table class="md-table"><thead><tr>' + header.map((c, i) => '<th' + al(i) + '>' + mdInline(c) + '</th>').join('') + '</tr></thead>' +
      (rows.length ? '<tbody>' + rows.map(row => '<tr>' + header.map((_, i) => '<td' + al(i) + '>' + mdInline(row[i] || '') + '</td>').join('') + '</tr>').join('') + '</tbody>' : '') + '</table>';
  }
  function mdToHtml(md) {
    const lines = String(md || '').split('\n'), out = []; let inList = null;
    const flush = () => { if (inList) { out.push('</' + inList + '>'); inList = null; } };
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t) { flush(); continue; }
      if (t.charAt(0) === '|' && i + 1 < lines.length && mdIsTableSep(lines[i + 1])) {
        flush(); const header = mdSplitRow(t), aligns = mdSplitRow(lines[i + 1]).map(mdAlignOf), rows = []; let j = i + 2;
        while (j < lines.length && lines[j].trim().charAt(0) === '|' && !mdIsTableSep(lines[j])) { rows.push(mdSplitRow(lines[j])); j++; }
        out.push(mdTableHtml(header, aligns, rows)); i = j - 1; continue;
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
      flush(); out.push('<p class="body-text">' + mdInline(t) + '</p>');
    }
    flush(); return out.join('\n');
  }
  /* 按「## 」切成部分；标题里的「一、」拆成编号。没有编号的部分（盘前须知、心法）不补编号。 */
  function splitSections(md) {
    const lines = String(md || '').split('\n'), raw = []; let cur = { title: '', body: [] };
    lines.forEach(line => { const m = /^##\s+(.+?)\s*$/.exec(line); if (m) { if (cur.title || cur.body.join('').trim()) raw.push(cur); cur = { title: m[1], body: [] }; } else cur.body.push(line); });
    if (cur.title || cur.body.join('').trim()) raw.push(cur);
    return raw.map((s, i) => {
      const mm = /^([一二三四五六七八九十百]+)[、.．]\s*(.*)$/.exec(s.title);
      const body = s.body.join('\n').replace(/\n\s*(-{3,}|\*{3,})\s*$/, '\n');
      const html = mdToHtml(body).replace(/<table class="md-table">/g, '<div class="zr-tw"><table class="md-table">').replace(/<\/table>/g, '</table></div>');
      const title = mm ? mm[2] : s.title;
      return { id: 'zr-s' + i, num: mm ? mm[1] : '', title: title, html: html, lead: !title, motto: /心法/.test(title) };
    });
  }
  const sectionHtml = s => '<section class="zr-sec' + (s.motto ? ' zr-motto' : '') + (s.lead ? ' zr-lead' : '') + '" id="' + s.id + '" data-sec="' + s.id + '">' +
    (s.title ? '<h2 class="zr-h">' + (s.num ? '<i>' + esc(s.num) + '</i>' : '') + '<b>' + esc(s.title) + '</b></h2>' : '') + s.html + '</section>';

  /* ---------- 徽记：这张盘的浑天仪。十二地支环（午在上，顺时针），十四主星按所在宫的地支落位，命宫那一格点亮 ---------- */
  function emblemSvg(c, o) {
    o = o || {};
    const uid = o.id || 'zre', G = 'var(--zr-em-gold, var(--zr-gold))', INK = 'var(--zr-em-ink, var(--zr-ink))', K = o.small ? 2.1 : 1, W = w => (w * K).toFixed(2);
    const ang = b => (180 + b * 30) * Math.PI / 180;
    const pt = (r, a) => (200 + r * Math.sin(a)).toFixed(1) + ' ' + (200 - r * Math.cos(a)).toFixed(1);
    const D = Math.PI / 180, FONT = 'font-family="Songti SC,STSong,Noto Serif SC,SimSun,serif"';
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="' + esc(o.label || '这张盘的星图') + '">' +
      '<defs><radialGradient id="' + uid + 'c"><stop offset="0" stop-color="#fff"/><stop offset=".4" style="stop-color:var(--zr-em-core,#cdb8f4)"/><stop offset="1" stop-color="#8a5cc4" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + uid + 'h"><stop offset="0" style="stop-color:var(--zr-zi);stop-opacity:var(--zr-em-halo,.26)"/><stop offset="1" stop-color="#8a5cc4" stop-opacity="0"/></radialGradient></defs>';
    /* 命宫那一格 */
    const mb = SC.indexOf(c.palaces[c.soulIndex].branch), a0 = ang(mb) - 15 * D, a1 = ang(mb) + 15 * D;
    s += '<path d="M' + pt(186, a0) + ' A186 186 0 0 1 ' + pt(186, a1) + ' L' + pt(158, a1) + ' A158 158 0 0 0 ' + pt(158, a0) + ' Z" style="fill:' + G + '" fill-opacity=".22"/>';
    s += '<g fill="none" style="stroke:' + G + '"><circle cx="200" cy="200" r="186" stroke-width="' + W(1.3) + '"/><circle cx="200" cy="200" r="158" stroke-width="' + W(0.8) + '" stroke-opacity=".8"/>';
    for (let b = 0; b < 12; b++) { const a = ang(b) + 15 * D; s += '<path d="M' + pt(158, a) + ' L' + pt(186, a) + '" stroke-width="' + W(0.8) + '" stroke-opacity=".7"/>'; }
    if (!o.small) for (let k = 0; k < 72; k++) { const a = k * 5 * D; s += '<path d="M' + pt(186, a) + ' L' + pt(k % 6 === 3 ? 193 : k % 2 ? 189 : 190.5, a) + '" stroke-width=".6" stroke-opacity=".55"/>'; }
    /* 仪环 */
    s += '<circle cx="200" cy="200" r="104" stroke-width="' + W(1.5) + '"/>' +
      '<ellipse cx="200" cy="200" rx="104" ry="39" transform="rotate(-28 200 200)" stroke-width="' + W(1.2) + '" stroke-opacity=".9"/>' +
      '<ellipse cx="200" cy="200" rx="104" ry="67" transform="rotate(34 200 200)" stroke-width="' + W(0.9) + '" stroke-opacity=".7"/>' +
      '<ellipse cx="200" cy="200" rx="104" ry="16" transform="rotate(76 200 200)" stroke-width="' + W(0.9) + '" stroke-opacity=".6"/>' +
      '<path d="M' + pt(113, 24 * D) + ' L' + pt(113, 204 * D) + '" stroke-width="' + W(0.8) + '" stroke-opacity=".7"/></g>';
    [24, 204].forEach(d => { const q = pt(113, d * D).split(' '); s += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="2.6" style="fill:' + G + '"/>'; });
    /* 地支 */
    if (!o.small) s += '<g ' + FONT + ' font-size="13" text-anchor="middle" style="fill:' + INK + '">';
    for (let b = 0; b < 12 && !o.small; b++) { const p = pt(172, ang(b)).split(' '); s += '<text x="' + p[0] + '" y="' + (+p[1] + 4.6).toFixed(1) + '"' + (b === mb ? ' font-weight="700"' : ' fill-opacity=".72"') + '>' + SC[b] + '</text>'; }
    if (!o.small) s += '</g>';
    /* 十四主星 */
    c.palaces.forEach(p => {
      const b = SC.indexOf(p.branch), n = p.major.length;
      p.major.forEach((st, k) => {
        const a = ang(b) + (k - (n - 1) / 2) * 11 * D, big = /庙|旺/.test(st.brightness || ''), r = (big ? 4.8 : 3.5) * (o.small ? 1.5 : 1), q = pt(o.small ? 139 : 136, a).split(' '), f = sv(st.name);
        s += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + (r * 2.5).toFixed(1) + '" style="fill:' + f + '" fill-opacity=".16"/><circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + r + '" style="fill:' + f + '"/>';
        if (o.labels && !o.small) { const t = pt(121, a).split(' '); s += '<text x="' + t[0] + '" y="' + (+t[1] + 3.2).toFixed(1) + '" ' + FONT + ' font-size="9" text-anchor="middle" style="fill:' + INK + ';stroke:var(--zr-em-back,var(--zr-paper))" fill-opacity=".9" stroke-width="2.6" stroke-opacity=".85" paint-order="stroke">' + esc(st.name) + '</text>'; }
      });
    });
    /* 紫微星 */
    s += '<circle cx="200" cy="200" r="46" fill="url(#' + uid + 'h)"/><circle cx="200" cy="200" r="17" fill="url(#' + uid + 'c)"/>' +
      '<path d="M200 176 L203.4 196.6 L224 200 L203.4 203.4 L200 224 L196.6 203.4 L176 200 L196.6 196.6 Z" fill="#fff" fill-opacity=".94"/>' +
      '<path d="M200 186 L201.6 198.4 L214 200 L201.6 201.6 L200 214 L198.4 201.6 L186 200 L198.4 198.4 Z" transform="rotate(45 200 200)" style="fill:' + G + '" fill-opacity=".85"/></svg>';
    return s;
  }
  /* 封面上的星点：按生辰定种子，同一张盘每次都一样 */
  function specksSvg(c) {
    let seed = 0; String(c.solarDate + c.timeName).split('').forEach(ch => { seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; });
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let s = '<svg class="zr-specks" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';
    /* 中间一条留给徽记和文字，星点只落在两侧 */
    for (let i = 0; i < 150; i++) {
      const big = rnd() > 0.93, x = rnd() * 800, y = rnd() * 1000, r = big ? 1.1 + rnd() * 0.6 : 0.45 + rnd() * 0.6, o = 0.25 + rnd() * 0.65;
      if (x > 215 && x < 585) continue;
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(2) + '" fill-opacity="' + o.toFixed(2) + '"/>';
    }
    return s + '</svg>';
  }

  /* ---------- 静态命盘（导出文件里的那张盘，和应用里的盘面同一套样式） ---------- */
  const CELL_POS = { 3: [1, 1], 4: [2, 1], 5: [3, 1], 6: [4, 1], 2: [1, 2], 7: [4, 2], 1: [1, 3], 8: [4, 3], 0: [1, 4], 11: [2, 4], 10: [3, 4], 9: [4, 4] };
  function boardHtml(c, name) {
    const star = s => '<span class="zr-star" style="color:' + sv(s.name) + '">' + esc(s.name) + (s.brightness ? '<sup>' + esc(s.brightness) + '</sup>' : '') + (s.mutagen ? '<i class="zr-seal ' + MU_KIND[s.mutagen] + '">' + s.mutagen + '</i>' : '') + '</span>';
    let h = '<div class="zr-board">';
    for (let i = 0; i < 12; i++) {
      const p = c.palaces[i], pos = CELL_POS[i];
      h += '<div class="zr-cell" style="grid-column:' + pos[0] + ';grid-row:' + pos[1] + '"><div class="zr-cell-h"><b>' + esc(p.name) + (i === c.soulIndex ? '<em>命</em>' : '') + (i === c.bodyIndex ? '<em class="body">身</em>' : '') + '</b><span>' + esc(p.stem + p.branch) + '</span></div>' +
        '<div class="zr-majors">' + (p.major.length ? p.major.map(star).join('') : '<span class="zr-none">空宫</span>') + '</div>' +
        (p.minor.length ? '<div class="zr-minors">' + p.minor.map(s => '<span class="' + (MINOR_GOOD.indexOf(s.name) >= 0 ? 'good' : 'bad') + '">' + esc(s.name) + (s.mutagen ? '<i class="zr-seal ' + MU_KIND[s.mutagen] + '">' + s.mutagen + '</i>' : '') + '</span>').join('') + '</div>' : '') +
        '<div class="zr-cell-f"><span>' + p.decadal.range[0] + '–' + p.decadal.range[1] + '</span><span>' + esc(p.changsheng12 || '') + '</span></div></div>';
    }
    h += '<div class="zr-center"><b>' + esc(name) + '</b><div class="zr-pillars">' + [['yearly', '年'], ['monthly', '月'], ['daily', '日'], ['hourly', '时']].map(k => '<span>' + esc(c.pillars[k[0]]) + '<small>' + k[1] + '</small></span>').join('') + '</div>' +
      '<p>' + esc(c.fiveElementsClass) + ' · 命主 ' + esc(c.soulMaster) + ' · 身主 ' + esc(c.bodyMaster) + '</p><p>起运 ' + c.startAge + ' 岁 · 属' + esc(c.zodiac) + '</p></div></div>';
    return h;
  }

  /* ---------- 版式 ---------- */
  const FONTS = '--zr-serif:"Songti SC","STSong","Noto Serif SC","Source Han Serif SC","SimSun",serif;--zr-kai:"Kaiti SC","STKaiti","KaiTi",serif;--zr-sans:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif;';
  const LIGHT = '--zr-bg:#f4f3f7;--zr-paper:#ffffff;--zr-fill:#f5f6f8;--zr-ink:#14161b;--zr-ink-2:#4c525c;--zr-ink-3:#81858c;--zr-rule:rgba(15,17,21,.12);--zr-gold:#a07a2c;--zr-gold-soft:rgba(160,122,44,.12);--zr-zi:#6b55d4;--zr-lu:#15803d;--zr-quan:#b45309;--zr-ke:#1d4ed8;--zr-ji:#b91c1c;' +
    '--zr-cover:linear-gradient(180deg,#e6e1f6 0%,#f1e6ee 50%,#fbeee2 100%);--zr-cover-ink:#231d3a;--zr-cover-sub:#6a6384;--zr-cover-back:#efe6ef;--zr-speck:#a07a2c;--zr-speck-o:.5;--zr-em-core:#cdb8f4;--zr-em-halo:.26;' + starVars(STAR_LIGHT);
  const DARK = '--zr-bg:#0f0f12;--zr-paper:#19191c;--zr-fill:#232326;--zr-ink:#f4f5f6;--zr-ink-2:#c6cacf;--zr-ink-3:#969ba3;--zr-rule:rgba(255,255,255,.14);--zr-gold:#dcb96f;--zr-gold-soft:rgba(220,185,111,.16);--zr-zi:#b9a7fa;--zr-lu:#4ade80;--zr-quan:#fbbf24;--zr-ke:#7aa2ff;--zr-ji:#f87171;' +
    '--zr-cover:radial-gradient(120% 80% at 50% 34%,#2b2050 0%,#17122e 46%,#0b0a18 100%);--zr-cover-ink:#f4f1ff;--zr-cover-sub:#b3abd0;--zr-cover-back:#1c1638;--zr-speck:#ffffff;--zr-speck-o:1;--zr-em-core:#e3d4ff;--zr-em-halo:.5;' + starVars(STAR_DARK);
  /* 正文：阅读页和导出文件一起用。只认 .zr 里的变量，不依赖外面的样式。 */
  const PROSE_CSS = [
    '.zr{color:var(--zr-ink);font:15.5px/1.9 var(--zr-sans);-webkit-font-smoothing:antialiased;overflow-wrap:anywhere}',
    '.zr-sec{padding-top:38px}.zr-sec:first-child{padding-top:0}',
    '.zr-h{display:flex;align-items:baseline;gap:14px;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid var(--zr-rule);text-wrap:balance}',
    '.zr-h{align-items:center}.zr-h i{flex:none;display:inline-grid;place-items:center;min-width:32px;height:32px;padding:0 7px;border:1px solid var(--zr-gold);border-radius:7px;font:600 17px/1 var(--zr-serif);font-style:normal;color:var(--zr-gold)}',
    '.zr-h b{font:600 23px/1.4 var(--zr-serif);letter-spacing:.04em}',
    '.zr h3,.zr h4{margin:26px 0 8px;font:600 17px/1.5 var(--zr-serif);letter-spacing:.02em}',
    '.zr p{margin:0 0 12px}.zr strong{font-weight:600}',
    '.zr ul,.zr ol{margin:0 0 12px;padding-left:1.5em}.zr li{margin:4px 0;padding-left:2px}.zr li::marker{color:var(--zr-gold);font-family:var(--zr-serif)}',
    '.zr blockquote{margin:18px 0;padding:1px 0 1px 18px;border-left:2px solid var(--zr-gold);font:17px/1.85 var(--zr-kai);color:var(--zr-ink-2)}',
    '.zr code{padding:1px 5px;border-radius:4px;background:var(--zr-fill);font:inherit;font-size:.94em}',
    '.zr-tw{margin:14px 0 18px;overflow-x:auto}',
    '.zr .md-table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.65;font-variant-numeric:tabular-nums}',
    '.zr .md-table th{padding:8px 10px;text-align:left;font-weight:600;font-size:12.5px;color:var(--zr-ink-2);border-bottom:1px solid var(--zr-ink);white-space:nowrap}',
    '.zr .md-table td{padding:8px 10px;border-bottom:1px solid var(--zr-rule);vertical-align:top}',
    '.zr .md-table tr{break-inside:avoid;page-break-inside:avoid}',
    '.zr hr{border:0;margin:30px 0 0;text-align:center;line-height:1}.zr hr::after{content:"· · ·";color:var(--zr-gold);letter-spacing:.5em;font:600 16px var(--zr-serif)}',
    '.zr-lead blockquote{margin:0;border:0;padding:10px 14px;border-radius:8px;background:var(--zr-fill);font:13.5px/1.7 var(--zr-sans);color:var(--zr-ink-2)}',
    '.zr-motto{text-align:center}.zr-motto .zr-h{justify-content:center;border-bottom:0;margin-bottom:6px}.zr-motto .zr-h b{font-size:15px;letter-spacing:.3em;color:var(--zr-ink-3);font-weight:400}',
    '.zr-motto p{font:600 24px/1.9 var(--zr-serif);letter-spacing:.3em;text-indent:.3em;margin:0}',
    '.zr h2,.zr h3,.zr h4{break-after:avoid;page-break-after:avoid}'
  ].join('');
  /* 导出文件自己的部分：封面、命盘页、目录、落款、打印 */
  const DOC_CSS = [
    '*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--zr-bg);color:var(--zr-ink);font-family:var(--zr-sans)}',
    '.zr-page{container-type:inline-size;max-width:1180px;margin:0 auto;background:var(--zr-paper)}',
    '.zr-cover{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:min(880px,92vh);padding:56px 24px 44px;text-align:center;background:var(--zr-cover);color:var(--zr-cover-ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.zr-cover{--zr-em-ink:var(--zr-cover-ink);--zr-em-back:var(--zr-cover-back)}.zr-specks{position:absolute;inset:0;width:100%;height:100%;fill:var(--zr-speck);opacity:var(--zr-speck-o)}.zr-cover>*:not(.zr-specks){position:relative}',
    '.zr-cover .zr-em{width:min(360px,70%);aspect-ratio:1;margin-bottom:18px}.zr-cover .zr-em svg{display:block;width:100%;height:100%}',
    '.zr-cover h1{margin:0;font:600 clamp(34px,6.4cqw,54px)/1.25 var(--zr-serif);letter-spacing:.3em;text-indent:.3em}',
    '.zr-cover .sub{margin:8px 0 0;font-size:13px;letter-spacing:.22em;text-indent:.22em;color:var(--zr-cover-sub)}',
    '.zr-cover .who{margin:34px 0 0;font:600 24px/1.4 var(--zr-serif);letter-spacing:.12em}',
    '.zr-cover .when{margin:4px 0 0;font-size:14px;color:var(--zr-cover-sub);font-variant-numeric:tabular-nums}',
    '.zr-cover .band{margin-top:30px;padding-top:14px;border-top:1px solid color-mix(in srgb,var(--zr-cover-ink) 22%,transparent);font-size:12.5px;letter-spacing:.12em;color:var(--zr-cover-sub)}',
    '.zr-layout{display:grid;grid-template-columns:minmax(0,1fr);padding:44px clamp(20px,5cqw,56px) 56px}',
    '.zr-main{min-width:0;max-width:720px;width:100%;margin:0 auto}',
    '.zr-toc{display:none}',
    '.zr-toc b{display:block;margin-bottom:10px;font:600 13px var(--zr-sans);color:var(--zr-ink-3);letter-spacing:.2em}',
    '.zr-toc a{display:flex;gap:10px;align-items:baseline;padding:5px 10px;border-radius:6px;color:var(--zr-ink-2);text-decoration:none;font-size:13.5px;line-height:1.5}',
    '.zr-toc a i{flex:none;width:2.2em;font:600 13px var(--zr-serif);font-style:normal;color:var(--zr-gold)}',
    '.zr-toc a:hover,.zr-toc a.on{background:var(--zr-fill);color:var(--zr-ink)}',
    '@container (min-width:1040px){.zr-layout{grid-template-columns:216px minmax(0,720px);justify-content:center;column-gap:56px}.zr-main{margin:0}.zr-toc{display:block;position:sticky;top:28px;align-self:start;max-height:calc(100vh - 56px);overflow:auto}.zr-toc-inline{display:none}}',
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
    '.zr-cell-h em.body{background:var(--zr-gold)}',
    '.zr-cell-h span{font:clamp(10px,1.7cqw,12px)/1 var(--zr-serif);color:var(--zr-ink-3);letter-spacing:.06em}',
    '.zr-majors{display:flex;flex-wrap:wrap;gap:0 7px}',
    '.zr-star{font:600 clamp(12px,2.3cqw,16px)/1.4 var(--zr-serif);white-space:nowrap}',
    '.zr-star sup{margin-left:1px;font:400 10px var(--zr-sans);color:var(--zr-ink-3);vertical-align:5px}',
    '.zr-seal{display:inline-block;margin-left:3px;padding:0 3px;border-radius:3px;font:500 10px/1.45 var(--zr-sans);font-style:normal;vertical-align:2px;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.zr-seal.lu{background:var(--zr-lu)}.zr-seal.quan{background:var(--zr-quan)}.zr-seal.ke{background:var(--zr-ke)}.zr-seal.ji{background:var(--zr-ji)}',
    '.zr-minors{display:flex;flex-wrap:wrap;gap:0 6px;font:500 clamp(10px,1.75cqw,12px)/1.5 var(--zr-serif)}.zr-minors .good{color:var(--zr-lu)}.zr-minors .bad{color:var(--zr-ji)}',
    '.zr-none{font:12px var(--zr-serif);color:var(--zr-ink-3)}',
    '.zr-cell-f{margin-top:auto;display:flex;justify-content:space-between;gap:6px;font-size:clamp(9.5px,1.55cqw,11px);line-height:1.3;color:var(--zr-ink-3);font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.zr-cell-f span:first-child{color:var(--zr-gold)}',
    '.zr-center{grid-column:2/4;grid-row:2/4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:10px;border-radius:10px;background:var(--zr-fill);text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    '.zr-center b{font:600 clamp(16px,3.6cqw,26px)/1.2 var(--zr-serif)}.zr-center p{margin:0;font-size:clamp(10.5px,1.8cqw,12.5px);color:var(--zr-ink-2)}',
    '.zr-pillars{display:flex;gap:6px}.zr-pillars span{display:grid;gap:1px;padding:4px 8px;border-radius:6px;border:1px solid var(--zr-rule);background:var(--zr-paper);font:600 clamp(12px,2.1cqw,15px)/1.2 var(--zr-serif)}.zr-pillars small{font:400 10px var(--zr-sans);color:var(--zr-ink-3)}',
    '.zr-toc-inline{margin:28px 0 0;padding:16px 0 0;border-top:1px solid var(--zr-rule);columns:2;column-gap:32px}',
    '.zr-toc-inline a{display:flex;gap:10px;align-items:baseline;padding:3px 0;color:var(--zr-ink);text-decoration:none;font-size:14px;break-inside:avoid}',
    '.zr-toc-inline a i{flex:none;width:2.2em;font:600 13.5px var(--zr-serif);font-style:normal;color:var(--zr-gold)}',
    '.zr-body{margin-top:44px}',
    '.zr-end{margin-top:56px;padding-top:22px;border-top:1px solid var(--zr-rule);text-align:center;font-size:12.5px;line-height:1.9;color:var(--zr-ink-3)}',
    '.zr-end .zr-stamp{display:inline-block;margin-bottom:10px;padding:5px 9px;border:1.5px solid var(--zr-ji);border-radius:4px;color:var(--zr-ji);font:600 13px var(--zr-serif);letter-spacing:.18em;text-indent:.18em;transform:rotate(-3deg)}',
    '.zr-end p{margin:0}.zr-end .zr-note{max-width:34em;margin:14px auto 0;font-size:12px;line-height:1.75}',
    '.zr-print{position:fixed;right:20px;top:20px;z-index:5;height:34px;padding:0 14px;border:1px solid var(--zr-rule);border-radius:8px;background:var(--zr-paper);color:var(--zr-ink);font:500 13px var(--zr-sans);cursor:pointer;box-shadow:0 6px 20px -10px rgba(0,0,0,.4)}',
    '.zr-print:hover{background:var(--zr-fill)}',
    '@page{size:A4;margin:17mm 18mm}@page :first{margin:0}',
    '@media print{:root{' + LIGHT + '}body{background:#fff}.zr-page{max-width:none}.zr-cover{min-height:0;height:297mm;break-after:page;page-break-after:always}.zr-layout{display:block;padding:0}.zr-main{max-width:none}.zr-toc,.zr-print{display:none}.zr-toc-inline{display:block}.zr-chart{break-after:page;page-break-after:always}.zr-body{margin-top:0}.zr{font-size:10.5pt}.zr-h b{font-size:16pt}.zr-h i{font-size:20pt}}'
  ].join('');
  const fmtDate = d => d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月';
  const ymdOf = d => d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
  function soulLine(c) {
    const m = c.palaces[c.soulIndex].major.map(s => s.name);
    if (m.length) return m.join('、') + '坐命';
    return '命宫借' + c.palaces[(c.soulIndex + 6) % 12].major.map(s => s.name).join('、');
  }
  /* 文档主体（不含 <html> 外壳），导出和原型里的预览都用它。颜色全部走变量，深浅色只换变量。 */
  function docBody(meta, md) {
    const c = meta.chart, name = meta.name || '未命名', today = new Date(), secs = splitSections(md);
    const yang = '甲丙戊庚壬'.indexOf(String(c.pillars.yearly).charAt(0)) >= 0, sex = (yang ? '阳' : '阴') + (meta.gender === 'female' ? '女' : '男');
    const sp = String(c.solarDate).split('-'), solarCn = +sp[0] + ' 年 ' + +sp[1] + ' 月 ' + +sp[2] + ' 日';
    const solarLine = c.meta && c.meta.solarCorrection ? c.solarDate + ' ' + c.meta.solarCorrection.solarTime + '（真太阳时，东经 ' + c.meta.solarCorrection.longitude + '°）' : c.solarDate + '（按钟表时间）';
    const toc = secs.filter(s => s.title).map(s => '<a href="#' + s.id + '" data-to="' + s.id + '">' + '<i>' + esc(s.num) + '</i>' + esc(s.title) + '</a>').join('');
    const info = [['称呼', name], ['性别', sex], ['公历', solarLine], ['农历', c.lunar.year + ' 年' + lunarOf(c) + ' ' + c.timeName], ['五行局', c.fiveElementsClass], ['命宫 / 身宫', c.soulBranch + ' / ' + c.bodyBranch], ['出生地', meta.place || '未填'], ['职业', meta.occupation || '未填']];
    return '<div class="zr-page">' +
      '<header class="zr-cover">' + specksSvg(c) + '<div class="zr-em">' + emblemSvg(c, { labels: true, id: 'zrc', label: name + ' 的星图' }) + '</div>' +
      '<h1>人生鲲鹏计划</h1><p class="sub">LifeView · 人生画板 · 紫微人生规划报告</p>' +
      '<p class="who">' + esc(name) + '</p><p class="when">' + esc(solarCn + ' · 农历' + lunarOf(c) + ' · ' + c.timeName) + '</p>' +
      '<div class="band">' + esc(c.fiveElementsClass + ' · ' + soulLine(c) + ' · ' + fmtDate(today)) + '</div></header>' +
      '<div class="zr-layout"><nav class="zr-toc" aria-label="目录"><b>目录</b><a href="#zr-chart" data-to="zr-chart"><i></i>命盘</a>' + toc + '</nav>' +
      '<main class="zr zr-main"><section class="zr-chart" id="zr-chart" data-sec="zr-chart"><h2>命盘</h2><div class="zr-info">' + info.map(k => '<div><span>' + k[0] + '</span>' + esc(k[1]) + '</div>').join('') + '</div>' +
      boardHtml(c, name) + '<nav class="zr-toc-inline" aria-label="目录">' + toc + '</nav></section>' +
      '<div class="zr-body">' + secs.map(sectionHtml).join('') + '</div>' +
      '<footer class="zr-end"><span class="zr-stamp">LifeView</span><p>紫微师 · 金聚｜道商意象紫微九诀</p><p>微信：neo2025new</p><p>人生画板 · ' + ymdOf(today) + '</p>' +
      '<p class="zr-note">本报告基于中华传统文化（紫微斗数）体系生成，非现代科学结论，仅供参考，不构成医疗 / 法律 / 金融 / 婚姻等专业领域的决策依据。</p></footer>' +
      '</main></div><button class="zr-print" type="button" data-print>打印 / 存为 PDF</button></div>';
  }
  const SPY = '(function(){var b=document.querySelector("[data-print]");if(b)b.onclick=function(){window.print()};var links=[].slice.call(document.querySelectorAll(".zr-toc a"));if(!links.length||!("IntersectionObserver" in window))return;var cur="";var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)cur=e.target.getAttribute("data-sec")});links.forEach(function(a){a.classList.toggle("on",a.getAttribute("data-to")===cur)})},{rootMargin:"-10% 0px -70% 0px"});[].forEach.call(document.querySelectorAll("[data-sec]"),function(s){io.observe(s)})})();';
  /* 导出文件：屏幕上跟随系统深浅色，打印一律用浅色 */
  function buildReportHtml(meta, md) {
    const name = (meta && meta.name) || '未命名';
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>人生鲲鹏计划 · ' + esc(name) + '</title><style>' +
      ':root{color-scheme:light dark;' + FONTS + LIGHT + '}@media screen and (prefers-color-scheme:dark){:root{' + DARK + '}}' +
      DOC_CSS + PROSE_CSS + '</style></head><body>' + docBody(meta, md) + '<script>' + SPY + '<\/script></body></html>';
  }

  /* ---------- 原型专用：样稿。星曜、四化、格局、大限取自这张盘，解读文字是示例 ---------- */
  const THEME = { 命宫: '自己', 兄弟: '兄弟和同辈', 夫妻: '伴侣与感情', 子女: '子女和创作', 财帛: '钱和收入', 疾厄: '身体',
    迁移: '出门和外面的人', 仆役: '朋友与合作', 官禄: '工作', 田宅: '家和住处', 福德: '心情和兴趣', 父母: '长辈与文书' };
  function sampleReport(c, name, age) {
    const P = n => c.palaces.filter(p => p.name === n)[0];
    const st = p => p.major.map(s => s.name + (s.brightness ? '（' + s.brightness + '）' : '') + (s.mutagen ? '化' + s.mutagen : ''));
    const line = n => { const p = P(n), o = c.palaces[(p.index + 6) % 12]; return p.name + '在' + p.stem + p.branch + '，' + (p.major.length ? '坐' + st(p).join('、') : '没有主星，借对宫' + o.name + '的' + (st(o).join('、') || '星') + '来看') + (p.minor.length ? '，同宫有' + p.minor.map(s => s.name).join('、') : '') + '。'; };
    const briefs = n => { const p = P(n), src = p.major.length ? p : c.palaces[(p.index + 6) % 12]; return src.major.map(s => (E.starDict[s.name] ? '**' + s.name + '**：' + E.starDict[s.name].brief : '')).filter(Boolean).join('\n\n'); };
    const body = c.palaces[c.bodyIndex], who = name || '你';
    const mu = { 禄: null, 权: null, 科: null, 忌: null };
    c.palaces.forEach(p => p.major.concat(p.minor).forEach(s => { if (s.mutagen && mu[s.mutagen] === null) mu[s.mutagen] = [s.name, p.name]; }));
    const tip = { 禄: '顺的事多从这里来', 权: '愿意花力气、也说了算的地方', 科: '名声和贵人从这里来', 忌: '容易放不下，多留余地' };
    const pats = E.detectPatterns(c), decs = E.decadalList(c);
    let cur = decs[0]; decs.forEach(d => { if (age >= d.ageRange[0] && age <= d.ageRange[1]) cur = d; });
    const out = [];
    out.push('> 这是一份样稿。星曜、四化、格局和大限取自这张盘，解读文字是示例；真实版本由紫微师根据整张盘来写。', '');
    out.push('## 一、命盘总览', '', who + '，' + c.solarDate.replace(/-/g, '.') + ' 出生，农历' + lunarOf(c) + c.timeName + '。' + line('命宫') + '身宫落在' + body.name + '。' + c.fiveElementsClass + '，' + c.startAge + ' 岁起运。', '',
      '### 生年四化', '', '| 四化 | 星曜 | 落宫 | 提示 |', '| :-- | :-- | :-- | :-- |');
    ['禄', '权', '科', '忌'].forEach(k => { if (mu[k]) out.push('| 化' + k + ' | ' + mu[k][0] + ' | ' + mu[k][1] + ' | ' + tip[k] + ' |'); });
    out.push('', '### 格局', '');
    if (pats.length) pats.slice(0, 5).forEach(x => out.push('- **' + x.name + '**（' + x.level + '）：' + x.desc)); else out.push('这张盘没有明显的格局，按宫位一项一项看就好。');
    out.push('', '## 二、性格大略', '', line('命宫'), '', briefs('命宫'), '', '身宫在' + body.name + '，三十岁以后，心思会更多放在' + (THEME[body.name] || body.name) + '上。先天的性子是底色，后天往哪里用力，看的是身宫。', '', '> 知人者智，自知者明。——《道德经》');
    out.push('', '## 三、家庭关系', '', line('父母') + line('兄弟'), '', '和长辈之间，先听清对方真正担心的是什么，再说自己的打算，会省掉很多来回。同辈之间，钱和人情分开算，关系反而长久。');
    out.push('', '## 四、婚姻情感', '', line('夫妻'), '', briefs('夫妻'), '', '### 相处上', '', '- 把期待说出口，不靠对方猜。', '- 吵起来先停一停，隔天再谈。', '- 一起做一件看得见进度的事，比如存一笔钱，或者一趟计划了很久的旅行。');
    out.push('', '## 五、子女培育', '', line('子女'), '', '对孩子，给空间比给答案有用。先看他对什么事愿意自己花时间，再决定往哪边添一把力。');
    out.push('', '## 六、财富管理', '', line('财帛') + line('田宅'), '', briefs('财帛'), '', '| 方向 | 做法 |', '| :-- | :-- |', '| 进财 | 靠主业和专业吃饭，副业只留一条 |', '| 守财 | 每月先存后花，大额支出隔三天再决定 |', '| 避开 | 朋友之间的担保，还有合伙借钱 |');
    out.push('', '## 七、健康养生', '', line('疾厄'), '', '作息比补品管用。固定睡觉的时间，每周三次出汗的运动，体检按年做，别等不舒服了才去。');
    out.push('', '## 八、事业发展', '', line('官禄'), '', briefs('官禄'), '', '### 这十年', '', '现在走' + cur.palaceName + '大限（' + cur.ageRange[0] + '–' + cur.ageRange[1] + ' 岁，' + cur.stem + cur.branch + '），重心在' + (THEME[cur.palaceName] || cur.palaceName) + '。大限化禄在' + cur.mutagen[0] + '，化忌在' + cur.mutagen[3] + '：前者是这十年顺手的方向，后者是要放慢的地方。', '', '> 不积跬步，无以至千里。——《荀子·劝学》');
    out.push('', '## 九、朋友贵人', '', line('仆役'), '', '朋友不在多。能在你做决定之前说一句实话的人，留住两三个就够了。');
    out.push('', '## 十、居家风水', '', line('田宅'), '', '书桌靠实墙，床头不对门。比摆设更要紧的是先清掉用不上的东西，屋子透气，人也松快。');
    out.push('', '## 十一、心灵福德', '', line('福德'), '', briefs('福德'), '', '给自己留一件不为结果的事：写字、跑步、种东西都行。它不挣钱，但能把心稳住。');
    out.push('', '## 十二、出行迁移', '', line('迁移'), '', '出门在外，机会多半来自愿意多聊两句的陌生人。换城市之前，先去住上两周，再做决定。');
    out.push('', '## 十三、大限节奏', '', '| 年龄 | 年份 | 干支 | 大限命宫 | 重心 |', '| :-- | :-- | :-- | :-- | :-- |');
    decs.slice(0, 9).forEach(d => out.push('| ' + (d === cur ? '**' + d.ageRange[0] + '–' + d.ageRange[1] + '**' : d.ageRange[0] + '–' + d.ageRange[1]) + ' | ' + d.yearRange[0] + '–' + d.yearRange[1] + ' | ' + d.stem + d.branch + ' | ' + d.palaceName + (d === cur ? '（现在）' : '') + ' | ' + (THEME[d.palaceName] || d.palaceName) + ' |'));
    out.push('', '十年一换的是重心，不是命。每到换限的那两年，把上一个十年没做完的事收个尾，再开新的。');
    out.push('', '## 十四、综合建议', '', '1. **主业做深**：选一件事做到别人愿意付钱请教。', '2. **把身体当本钱**：睡够，动起来，按年体检。', '3. **人脉重质不重量**：常联系的人不必多，要真。', '4. **钱先守后攻**：留足半年的生活费，再谈投资。', '5. **少掺和是非**：不该接的话不接，不该管的事不管。',
      '', '---', '', '## 十二字心法', '', '守其正，务其实，惜其缘，缓其行');
    return out.join('\n');
  }

  window.ZWReportV6 = { STARS14: STARS14, STAR_LIGHT: STAR_LIGHT, STAR_DARK: STAR_DARK, TITLES: TITLES, NUM: NUM, FONTS: FONTS, LIGHT: LIGHT, DARK: DARK, PROSE_CSS: PROSE_CSS, DOC_CSS: DOC_CSS,
    mdToHtml: mdToHtml, splitSections: splitSections, sectionHtml: sectionHtml, emblemSvg: emblemSvg, boardHtml: boardHtml, docBody: docBody, buildReportHtml: buildReportHtml, sampleReport: sampleReport, lunarOf: lunarOf };
})();
