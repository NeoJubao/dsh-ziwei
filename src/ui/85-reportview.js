/* ================================================================
 * 85-reportview：报告页（T7）。左边目录（REPORT_TOC），右边阅读栏（REPORT_DOC）；结构见 css/86-reportview.css 开头。
 *
 * 这一页是 store 的视图：开始写 / 接着写 / 重新写 / 停止都调 store 的动作（26-store），
 * markdown、分部、进度、徽记、导出文件都用 ZWREPORT（30-report）。这里自己只管三件事：
 * - 边写边读：正文一个部分一个节点（key 用位置）。rvChunks 把全文按「## 」切成各部分的原文，切法和
 *   ZWREPORT.splitSections 一样（自检逐个前缀比对过）；一个部分只在自己的原文变了时才重新解析、换元素，
 *   所以一次增量只重画最后一个部分，前面的元素对象原样复用。目录和状态栏只选进度、编号部分的位置，
 *   不选正文（rvOutline 只看标题行）。
 * - 滚动：离底部不到 80px 才跟着往下走（rvShouldStick）；读到哪里按命盘记在 store 的 session.readPos
 *   （{ part, offset, end }），滚动时用 requestAnimationFrame 节流写进去，effect 清理时再记一次；
 *   舞台重新显示、面板重新挂载时在 layout effect 里回到原处。目录高亮（aria-current）就是 readPos.part。
 *   写完时状态栏消失、阅读栏往上长一截：补回那段高度，屏幕上的字不跳。
 * - 下载 / 复制 / 问这段：下载用临时 <a download> + blob 链接（宿主不让 window.open 或跳转到 blob），
 *   文件名「人生鲲鹏计划_<称呼>_<yyyymmdd>.html」。品牌名只在导出文件里，面板上叫「完整报告」。
 * 组件：ReportStage（舞台）> ReportToc、ReportBar、ReportDoc（> ReportTop、ReportSections > ReportSection）或 ReportEmpty。
 * 自检用的纯函数挂在 ZWUI 上：rvShouldStick、rvChunks、rvSectionView、rvOutline、rvSafeName、rvFileName、rvPickPlace、rvUnwritten。
 * ================================================================ */

const RV_STICK_PX = 80;      /* 离底部不到这么多才跟随 */
const RV_SPY_PX = 60;        /* 部分的顶到阅读栏顶下这么多以内，就算在读这一部分 */
const RV_GAP = 8;            /* 跳到某部分时上面留的空；「问这段」离选区的距离 */
const RV_PICK = { back: 36, w: 84, h: 40 };   /* 「问这段」：左边从选区末尾往回 36px；按钮大约 84 × 40（含边距） */
const RV_PICK_MIN = 4;
const RV_QUOTE_MAX = 600;
const RV_NAME_MAX = 64;
const RV_REVOKE_MS = 1000;
/* 和 ZWREPORT.splitSections 的分部规则一样：「## 标题」开一个部分；末行只有 # 记号（标题还没写出字）时先不算 */
const RV_HEADING = /^##\s+(.+?)\s*$/;
const RV_BARE = /^#{1,6}\s*$/;
/* 导出文件名里的品牌名「人生鲲鹏计划」（spec §3.6）：只进文件名、不在面板上显示，所以不走字典
   （面板字典里不许出现这个词，自检会拦）；写成转义，是为了守住「50–90 段注释之外不写中文」 */
const RV_FILE_BRAND = '\u4eba\u751f\u9cb2\u9e4f\u8ba1\u5212';
const RV_FILE_BAD = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;

/* ---------------- 纯函数 ---------------- */
function rvShouldStick(scrollHeight, scrollTop, clientHeight) {
  return (+scrollHeight || 0) - (+scrollTop || 0) - (+clientHeight || 0) < RV_STICK_PX;
}

/* 按部分切原文：返回每个部分的 markdown（标题行 + 正文，去掉末尾的空行；空行不影响解析）。
   切法和 splitSections 一样：第一个 ## 之前有字才算开头一段；末行只有 # 记号时先去掉。 */
function rvChunks(md) {
  const lines = String(md || '').split('\n');
  if (lines.length && RV_BARE.test(lines[lines.length - 1])) lines.pop();
  const out = [];
  let head = false;
  let buf = [];
  const push = function () {
    if (!head && !buf.join('').trim()) return;
    let end = buf.length;
    while (end > 1 && !buf[end - 1].trim()) end--;
    out.push(buf.slice(0, end).join('\n'));
  };
  for (let i = 0; i < lines.length; i++) {
    if (RV_HEADING.test(lines[i])) { push(); head = true; buf = [lines[i]]; }
    else buf.push(lines[i]);
  }
  push();
  return out;
}

/* 一个部分的原文 → section 元素要的东西。解析交给 ZWREPORT（末尾补一个换行：
   单独解析一段时，最后一行不该被当成"还没写完的标题"去掉）；id 按它在全文里的位置。 */
function rvSectionView(chunk, index) {
  const s = ZWREPORT.splitSections(String(chunk == null ? '' : chunk) + '\n')[0];
  if (!s) return null;
  const id = 'zr-s' + index;
  const html = ZWREPORT.sectionHtml(Object.assign({}, s, { id: id }));
  const open = /^<section class="([^"]*)"[^>]*>/.exec(html);
  const close = '</section>';
  if (!open || html.slice(-close.length) !== close) return null;
  return { id: id, num: s.num, title: s.title, cls: open[1], inner: html.slice(open[0].length, html.length - close.length) };
}

/* 只看标题行的提纲：进度、编号部分的位置（逗号连起来，便于订阅时比较）、字数。
   ZWREPORT.progress 只数有编号的部分，开头一段不影响它，所以只拿标题行去算，结果和拿全文算一样。
   流式时每个增量都会来问一次，按全文记一份。 */
let rvOutlineMemo = null;
function rvOutlineOf(md) {
  const text = String(md || '');
  if (rvOutlineMemo && rvOutlineMemo.text === text) return rvOutlineMemo.value;
  const lines = text.split('\n');
  if (lines.length && RV_BARE.test(lines[lines.length - 1])) lines.pop();
  const heads = [];
  let lead = false;
  for (let i = 0; i < lines.length; i++) {
    if (RV_HEADING.test(lines[i])) heads.push(lines[i]);
    else if (!heads.length && !lead && lines[i].trim()) lead = true;
  }
  const headsMd = heads.join('\n');
  const base = lead ? 1 : 0;
  const marks = [];
  ZWREPORT.splitSections(headsMd).forEach(function (s, i) { if (s.num) marks.push(base + i); });
  const value = {
    lead: lead, heads: headsMd, marks: marks.join(','), count: marks.length,
    progress: ZWREPORT.progress(headsMd), chars: text.replace(/\s/g, '').length
  };
  rvOutlineMemo = { text: text, value: value };
  return value;
}

function rvSafeName(name) {
  const s = String(name == null ? '' : name).replace(/\s+/g, ' ').replace(RV_FILE_BAD, '').trim();
  return Array.from(s).slice(0, RV_NAME_MAX).join('').trim();
}

function rvPad2(n) {
  return ('0' + n).slice(-2);
}

function rvFileName(name, ymd) {
  const nm = rvSafeName(name) || rvSafeName(t('headUnnamed'));
  return RV_FILE_BRAND + '_' + nm + '_' + ymd.y + rvPad2(ymd.m) + rvPad2(ymd.d) + '.html';
}

/* 「问这段」放在选区右下方（ZWUI.pickPoint 管最小边距），不出阅读栏。按钮在 .zp-rmain 里，不随正文滚动 */
function rvPickPlace(rect, box) {
  const p = ZWUI.pickPoint({ left: rect.right - RV_PICK.back, top: rect.bottom + RV_GAP }, box, 0, 0);
  return {
    x: Math.round(Math.min(p.x, Math.max(RV_GAP, box.width - RV_PICK.w))),
    y: Math.round(Math.min(p.y, Math.max(RV_GAP, box.height - RV_PICK.h)))
  };
}

function rvGroup(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function rvDateOf(ms) {
  const d = new Date(ms);
  const m = d.getMonth() + 1, day = d.getDate();
  return t('rvDate', { y: d.getFullYear(), m: m, d: day, mm: rvPad2(m), dd: rvPad2(day) });
}

/* 四种状态：还没写 empty / 正在写 writing / 中断 stopped（有字但没写完）/ 写完 done */
function rvPhaseOf(rep) {
  if (!rep) return 'empty';
  if (rep.status === 'running') return 'writing';
  if (!/\S/.test(String(rep.text || ''))) return 'empty';
  return rep.status === 'done' ? 'done' : 'stopped';
}

/* 写完了，但写出来的不是一份报告：模型有时不写报告，只回一小段话（2026-11-24 真机：约 300 字，问出生地的经度），
   这段话照样按「写完」存了下来。正文不到 RV_UNWRITTEN_MAX 个字、又没有一个「## 」标题，就算没写成：
   正文照常显示（看得到它说了什么），状态栏说明情况并给「重新生成」。按正文判断，所以以前存下的也认得出来。 */
const RV_UNWRITTEN_MAX = 1500;
function rvUnwritten(rep) {
  if (!rep || rep.status !== 'done') return false;
  const text = String(rep.text || '').trim();
  if (!text || text.length >= RV_UNWRITTEN_MAX) return false;
  return !text.split('\n').some(function (line) { return RV_HEADING.test(line); });
}

/* 中断的原因：用户自己停的、写到一半被打断的不用再说；断连、出错要说 */
function rvWhyOf(rep) {
  const kind = rep && rep.issue ? rep.issue.kind : '';
  return rep && rep.error && kind !== 'stopped' && kind !== 'interrupted' ? String(rep.error) : '';
}

/* ---------------- 读 store ---------------- */
function rvCurrentOf(store) {
  const entry = store.currentEntry();
  const key = entry ? store.keyOf(entry) : '';
  const r = key ? store.reading(key) : null;
  return { entry: entry, key: key, rep: r && r.report ? r.report : null };
}

/* 这张盘上正在跑的是对话：一张盘同一时间只有一个任务，报告的按钮先不能点 */
function rvBusyOf(s, key) {
  const j = key ? s.jobs[key] : null;
  return !!j && j.kind === 'chat';
}

function rvStageOf(s, store) {
  const c = rvCurrentOf(store);
  return { hidden: s.session.stage !== 'report', key: c.key, phase: rvPhaseOf(c.rep) };
}

function rvTocOf(s, store) {
  const c = rvCurrentOf(store);
  const phase = rvPhaseOf(c.rep);
  const pos = c.key ? s.session.readPos[c.key] : null;
  const part = pos && typeof pos === 'object' && typeof pos.part === 'number' ? pos.part : -1;
  const busy = rvBusyOf(s, c.key);
  if (phase === 'empty') return { phase: phase, busy: busy };
  const o = rvOutlineOf(c.rep.text);
  if (phase === 'done') return { phase: phase, heads: o.heads, lead: o.lead, chars: o.chars, part: part, busy: busy };
  return { phase: phase, done: o.progress.done, marks: o.marks, part: part, busy: busy };
}

function rvBarOf(s, store) {
  const c = rvCurrentOf(store);
  const phase = rvPhaseOf(c.rep);
  if (phase === 'done' && rvUnwritten(c.rep)) return { phase: phase, unwritten: true, busy: rvBusyOf(s, c.key) };
  if (phase !== 'writing' && phase !== 'stopped') return { phase: phase };
  const o = rvOutlineOf(c.rep.text);
  return {
    phase: phase, current: o.progress.current, total: o.progress.total,
    why: phase === 'stopped' ? rvWhyOf(c.rep) : '', busy: rvBusyOf(s, c.key)
  };
}

function rvEmptyOf(s, store) {
  const c = rvCurrentOf(store);
  return {
    id: c.entry ? c.entry.id : null, name: c.entry ? String(c.entry.name || '') : '',
    failed: c.rep && c.rep.status === 'error' ? rvWhyOf(c.rep) : '', busy: rvBusyOf(s, c.key)
  };
}

function rvDocOf(s, store) {
  const c = rvCurrentOf(store);
  const r = c.rep || {};
  return {
    text: String(r.text || ''), status: r.status || 'idle', finishedAt: +r.finishedAt || 0,
    name: c.entry ? String(c.entry.name || '') : ''
  };
}

/* ---------------- DOM 小工具（只在 effect 和事件里用） ---------------- */
function rvFrame(fn) {
  try {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      const id = window.requestAnimationFrame(fn);
      return function () { try { window.cancelAnimationFrame(id); } catch (e) { /* ignore */ } };
    }
  } catch (e) { /* 落到下面 */ }
  return uiLater(fn, 16);
}

function rvReducedMotion() {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
      !!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
}

function rvLaidOut(el) {
  return !!el && +el.clientHeight > 0;
}

/* 节点的顶在阅读栏正文里的位置（不管 offsetParent 是谁） */
function rvTopIn(el, node) {
  return node.getBoundingClientRect().top - el.getBoundingClientRect().top + (+el.scrollTop || 0);
}

function rvSecNodes(el) {
  return el && typeof el.querySelectorAll === 'function' ? el.querySelectorAll('[data-sec]') : [];
}

/* 现在读到哪里：顶在阅读栏顶下 60px 以内的最后一个部分 + 部分内偏移 + 是否在底部 */
function rvPosOf(el) {
  const top = +el.scrollTop || 0;
  const secs = rvSecNodes(el);
  let part = 0, at = 0;
  for (let i = 0; i < secs.length; i++) {
    const y = rvTopIn(el, secs[i]);
    if (i > 0 && y > top + RV_SPY_PX) break;
    part = i;
    at = y;
  }
  return { part: part, offset: Math.round(top - at), end: rvShouldStick(el.scrollHeight, top, el.clientHeight) };
}

function rvRestore(el, pos) {
  if (!el || pos == null) return false;
  if (typeof pos === 'number') { el.scrollTop = Math.max(0, pos); return true; }
  if (pos.end) { el.scrollTop = +el.scrollHeight || 0; return true; }
  const node = rvSecNodes(el)[pos.part];
  if (!node) return false;
  el.scrollTop = Math.max(0, Math.round(rvTopIn(el, node) + (+pos.offset || 0)));
  return true;
}

/* 跳到第 part 部分（上面留 8px）；返回目标 scrollTop，找不到时是 null */
function rvJump(el, part, smooth) {
  const node = el ? rvSecNodes(el)[part] : null;
  if (!node) return null;
  const top = Math.max(0, Math.round(rvTopIn(el, node) - RV_GAP));
  if (smooth && typeof el.scrollTo === 'function') el.scrollTo({ top: top, behavior: 'smooth' });
  else el.scrollTop = top;
  return top;
}

/* 让目录里高亮的那一项露出来：只滚目录自己（scrollIntoView 会连带滚外层） */
function rvReveal(nav, btn) {
  if (!nav || !btn) return;
  const a = nav.getBoundingClientRect(), b = btn.getBoundingClientRect();
  if (!(a.height > 0) || !(a.width > 0)) return;
  if (b.top < a.top) nav.scrollTop -= a.top - b.top;
  else if (b.bottom > a.bottom) nav.scrollTop += b.bottom - a.bottom;
  if (b.left < a.left) nav.scrollLeft -= a.left - b.left;
  else if (b.right > a.right) nav.scrollLeft += b.right - a.right;
}

function rvSelection() {
  try {
    return typeof window !== 'undefined' && typeof window.getSelection === 'function' ? window.getSelection() : null;
  } catch (e) {
    return null;
  }
}

function rvClearSelection() {
  const sel = rvSelection();
  try { if (sel && typeof sel.removeAllRanges === 'function') sel.removeAllRanges(); } catch (e) { /* ignore */ }
}

/* 选区在正文里、至少 4 个字：{ text（截到 600 字）, x, y }；否则 null */
function rvPickFrom(el, main) {
  const sel = rvSelection();
  if (!el || !main || !sel || !sel.rangeCount) return null;
  const chars = Array.from(String(sel).trim());
  if (chars.length < RV_PICK_MIN || !el.contains(sel.anchorNode)) return null;
  let rect;
  try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { return null; }
  const p = rvPickPlace(rect, main.getBoundingClientRect());
  return { text: chars.slice(0, RV_QUOTE_MAX).join(''), x: p.x, y: p.y };
}

/* ---------------- 下载、复制 ---------------- */
function rvMetaOf(entry, chart) {
  const x = entry && entry.input ? entry.input : {};
  return {
    chart: chart,
    name: String((entry && entry.name) || x.name || '').trim(),
    place: String(x.place || ''),
    occupation: String(x.occupation || ''),
    gender: x.gender === 'female' ? 'female' : 'male'
  };
}

/* 宿主不让 window.open blob、也不让整页跳到 blob / data 链接；临时 <a download> 点一下可以。用完撤销链接 */
function rvSaveFile(fileName, content) {
  const w = window;
  const url = w.URL.createObjectURL(new w.Blob([content], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  let done = false;
  const tidy = function () {
    if (done) return;
    done = true;
    try { if (a.parentNode) a.parentNode.removeChild(a); } catch (e) { /* ignore */ }
    try { w.URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
  };
  try {
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
  } catch (e) {
    tidy();
    throw e;
  }
  if (typeof w.setTimeout === 'function') uiLater(tidy, RV_REVOKE_MS);
  else tidy();
}

function rvDownload(store) {
  const c = rvCurrentOf(store);
  const chart = c.entry ? store.chartOf(c.entry) : null;
  const md = c.rep ? String(c.rep.text || '') : '';
  if (!chart || !/\S/.test(md)) return false;
  try {
    const meta = rvMetaOf(c.entry, chart);
    rvSaveFile(rvFileName(meta.name, store.todayOf()), ZWREPORT.buildReportHtml(meta, md));
  } catch (e) {
    store.showToast(t('rvDownloadFailed', { reason: String((e && e.message) || e) }), { error: true });
    return false;
  }
  store.showToast(t('rvDownloaded'));
  return true;
}

function rvCopyAll(store) {
  const c = rvCurrentOf(store);
  const md = c.rep ? String(c.rep.text || '') : '';
  if (!/\S/.test(md)) return;
  copyText(md).then(function (ok) {
    if (ok) store.showToast(t('rvCopied'));
    else store.showToast(t('copyFailed'), { error: true });
  });
}

/* ---------------- 目录 ---------------- */
/* 目录项：写完时是正文里的实际标题（开头那段不算；有编号的出编号）；其余时候是将要写的 14 个部分。
   pos 是它对应的部分在正文里的位置，还没写出来的是 -1（不能点）。 */
function rvTocItems(o) {
  if (o.phase === 'done') {
    const base = o.lead ? 1 : 0;
    return ZWREPORT.splitSections(o.heads).map(function (s, i) {
      return { key: base + i, pos: base + i, num: s.num, label: s.title || s.num, state: 'zp-done' };
    }).filter(function (it) { return !!it.label; });
  }
  const nums = t('rvNumerals').split(',');
  const marks = o.marks ? String(o.marks).split(',').map(Number) : [];
  return ZWREPORT.REPORT_SECTION_TITLES.map(function (title, i) {
    let state = 'zp-todo';
    if (o.phase === 'writing') state = i < o.done ? 'zp-done' : (i === o.done ? 'zp-now' : 'zp-todo');
    else if (o.phase === 'stopped' && i < marks.length) state = 'zp-done';
    const pos = state !== 'zp-todo' && i < marks.length ? marks[i] : -1;
    return { key: i, pos: pos, num: nums[i] || '', label: title, state: state };
  });
}

/* 高亮哪一项：位置不超过读到的部分的最后一项；还没读（或在开头那段）时是第一项 */
function rvActiveOf(items, part) {
  let at = -1, first = -1;
  for (let i = 0; i < items.length; i++) {
    const p = items[i].pos;
    if (p < 0) continue;
    if (first < 0) first = p;
    if (part >= 0 && p <= part) at = p;
  }
  return at >= 0 ? at : first;
}

function ReportToc(props) {
  const o = useStore(rvTocOf);
  const store = appStore();
  const navRef = useRef(null);
  const items = useMemo(function () { return rvTocItems(o); }, [o.phase, o.heads, o.lead, o.done, o.marks]);
  const active = rvActiveOf(items, o.part);
  useEffect(function () {
    const nav = navRef.current;
    if (!nav || active < 0 || typeof nav.querySelector !== 'function') return;
    rvReveal(nav, nav.querySelector('[aria-current="true"]'));
  }, [active]);
  const go = function (pos) {
    const el = props.scrollRef.current;
    const top = rvJump(el, pos, o.phase !== 'writing' && !rvReducedMotion());
    if (top === null) return;
    props.stickRef.current = rvShouldStick(el.scrollHeight, top, el.clientHeight);
    store.setReadPos({ part: pos, offset: -RV_GAP, end: props.stickRef.current });
  };
  const cnt = o.phase === 'done' ? t('rvCntDone', { chars: rvGroup(o.chars) })
    : o.phase === 'writing' ? t('rvWriting') : o.phase === 'stopped' ? t('rvCntStopped') : t('rvCntIdle');
  return h('section', { className: 'zp-card zp-rtoc', 'data-region': 'REPORT_TOC' },
    h('div', { className: 'zp-card-h' }, h('h3', null, t('rvTitle')), h('span', { className: 'zp-cnt' }, cnt)),
    h('nav', { className: 'zp-toc', 'aria-label': t('rvToc'), ref: navRef }, items.map(function (it) {
      return h('button', {
        key: it.key, type: 'button', className: it.state,
        disabled: it.pos < 0 ? true : undefined,
        'aria-current': it.pos >= 0 && it.pos === active ? 'true' : undefined,
        onClick: function () { go(it.pos); }
      },
      h('i', null, it.num),
      h('span', null, it.label),
      it.state === 'zp-now' ? h('span', { className: 'zp-toc-now' }, t('rvWriting')) : null);
    })),
    o.phase === 'done' ? h('div', { className: 'zp-card-f' },
      h('button', { className: 'zp-btn', type: 'button', onClick: function () { rvDownload(store); } }, t('rvDownload')),
      h('button', { className: 'zp-btn', type: 'button', onClick: function () { rvCopyAll(store); } }, t('rvCopy')),
      h(ConfirmButton, {
        className: 'zp-link', label: t('rvRedo'), confirmLabel: t('rvRedoConfirm'),
        disabled: o.busy, title: o.busy ? t('rvBusyChat') : undefined,
        onConfirm: function () { store.regenerateReport(); }
      })) : null);
}

/* ---------------- 状态栏 ---------------- */
function ReportBar() {
  const b = useStore(rvBarOf);
  const store = appStore();
  if (b.phase === 'writing') {
    return h('div', { className: 'zp-rbar', role: 'status' },
      h('i', { className: 'zp-pulse', 'aria-hidden': true }),
      h('span', { className: 'zp-rbar-text' },
        t('rvBarWriting', { n: b.current, total: b.total, name: ZWREPORT.REPORT_SECTION_TITLES[b.current - 1] || '' })),
      h('button', { className: 'zp-btn', type: 'button', onClick: function () { store.stop(); } }, t('rvStop')));
  }
  if (b.phase === 'stopped') {
    return h('div', { className: 'zp-rbar', role: 'status' },
      h('span', { className: 'zp-rbar-text' },
        b.why ? t('rvBarStoppedWhy', { n: b.current, reason: b.why }) : t('rvBarStopped', { n: b.current })),
      h('button', {
        className: 'zp-btn', type: 'button', disabled: b.busy ? true : undefined, title: b.busy ? t('rvBusyChat') : undefined,
        onClick: function () { store.continueReport(); }
      }, t('rvContinue')),
      h(ConfirmButton, {
        className: 'zp-link', label: t('rvRedo'), confirmLabel: t('rvRedoConfirm'),
        disabled: b.busy, title: b.busy ? t('rvBusyChat') : undefined,
        onConfirm: function () { store.regenerateReport(); }
      }));
  }
  /* 没写成报告：那一小段话没什么可丢的，重新生成不用二次确认 */
  if (b.unwritten) {
    return h('div', { className: 'zp-rbar', role: 'status' },
      h('span', { className: 'zp-rbar-text' }, t('rvBarUnwritten')),
      h('button', {
        className: 'zp-btn', type: 'button', disabled: b.busy ? true : undefined, title: b.busy ? t('rvBusyChat') : undefined,
        onClick: function () { store.regenerateReport(); }
      }, t('rvRegenerate')));
  }
  return null;
}

/* ---------------- 还没写 ---------------- */
function ReportEmpty() {
  const e = useStore(rvEmptyOf);
  const store = appStore();
  const chart = store.currentChart();
  const name = e.name || t('headUnnamed');
  const svg = useMemo(function () {
    return chart ? ZWREPORT.emblemSvg(chart, { id: 'zrv0', label: t('rvEmblemLabel', { name: name }) }) : '';
  }, [chart, name]);
  return h('div', { className: 'zp-rempty' },
    /* 徽记的颜色走 --zr-*：带上 zr-prose，用 85-prose.css 末尾那段面板映射 */
    h('div', { className: 'zp-emblem zr-prose', dangerouslySetInnerHTML: { __html: svg } }),
    h('h2', null, t('rvTitle')),
    h('p', null, t('rvEmptyHint')),
    e.failed ? h('p', null, t('rvEmptyFailed', { reason: e.failed })) : null,
    h('button', {
      className: 'zp-btn-primary', type: 'button', disabled: e.busy ? true : undefined, title: e.busy ? t('rvBusyChat') : undefined,
      onClick: function () { store.startReport(); }
    }, t('rvStart')));
}

/* ---------------- 正文 ---------------- */
function ReportTop(props) {
  const chart = props.chart;
  const name = props.name;
  const svg = useMemo(function () {
    return chart ? ZWREPORT.emblemSvg(chart, { id: 'zrv1', small: true, label: t('rvEmblemLabel', { name: name }) }) : '';
  }, [chart, name]);
  const birth = chart ? t('rvTopBirth', {
    solar: String(chart.solarDate || '').replace(/-/g, '.'), lunar: ZWREPORT.lunarOf(chart),
    time: chart.timeName, element: chart.fiveElementsClass
  }) : '';
  return h('header', { className: 'zp-rtop' },
    h('div', { className: 'zp-emblem', dangerouslySetInnerHTML: { __html: svg } }),
    h('div', null,
      h('h1', null, t('rvTopTitle', { name: name })),
      h('p', null, birth),
      h('p', null, props.line3)));
}

/* 一个部分：只在自己的原文或位置变了时重新解析（正文已由 ZWREPORT 转义，只放行 <br>） */
function ReportSection(props) {
  return useMemo(function () {
    const v = rvSectionView(props.md, props.index);
    return v ? h('section', { className: v.cls, id: v.id, 'data-sec': v.id, dangerouslySetInnerHTML: { __html: v.inner } }) : null;
  }, [props.md, props.index]);
}

/* 部分列表：原文没变的部分沿用上一次的元素对象，React 直接跳过它们；一次增量只重画最后一个 */
function ReportSections(props) {
  const chunks = props.chunks;
  const prev = useRef(null);
  const last = prev.current;
  const kids = chunks.map(function (md, i) {
    return last && last.chunks[i] === md && last.kids[i] ? last.kids[i] : h(ReportSection, { key: i, md: md, index: i });
  });
  useLayoutEffect(function () { prev.current = { chunks: chunks, kids: kids }; });
  return h('div', { className: 'zp-rsecs' }, kids);
}

function ReportDoc(props) {
  const d = useStore(rvDocOf);
  const store = appStore();
  const chart = store.currentChart();
  const chunks = useMemo(function () { return rvChunks(d.text); }, [d.text]);
  const running = d.status === 'running';
  const [pick, setPick] = useState(null);
  const stick = props.stickRef;
  const top = useRef(0);           /* 最近一次知道的 scrollTop（滚动事件或我们自己滚的） */
  const barH = useRef(0);          /* 状态栏的高度：写完它消失时补回来 */
  const prevPhase = useRef(props.phase);
  const frame = useRef(null);      /* 排着的那一帧（取消函数） */
  const pickLater = useRef(null);

  const o = rvOutlineOf(d.text);
  const name = d.name || t('headUnnamed');
  const line3 = props.phase === 'done'
    ? (d.finishedAt ? t('rvTopDone', { n: o.count, chars: rvGroup(o.chars), date: rvDateOf(d.finishedAt) }) : t('rvTopDoneNoDate', { n: o.count, chars: rvGroup(o.chars) }))
    : props.phase === 'stopped' ? t('rvTopStopped', { chars: rvGroup(o.chars) }) : t('rvTopWriting');
  /* 写的过程中页头的三行都不变：同一个元素，不跟着增量重画 */
  const head = useMemo(function () { return h(ReportTop, { chart: chart, name: name, line3: line3 }); }, [chart, name, line3]);

  /* 显示时回到读到的地方；隐藏 / 卸载时再记一次（隐藏后已经没有布局，就不记） */
  useLayoutEffect(function () {
    const el = props.scrollRef.current;
    if (!el || props.hidden) return undefined;
    rvRestore(el, store.readPos(props.chartKey));
    top.current = +el.scrollTop || 0;
    stick.current = rvShouldStick(el.scrollHeight, el.scrollTop, el.clientHeight);
    return function () {
      if (frame.current) { frame.current(); frame.current = null; }
      if (rvLaidOut(el)) store.setReadPos(rvPosOf(el), props.chartKey);
    };
  }, [props.hidden]);

  /* 开始写（重新写、接着写）时按现在的位置重新判断要不要跟随 */
  useLayoutEffect(function () {
    const el = props.scrollRef.current;
    if (!running || !el || props.hidden) return;
    stick.current = rvShouldStick(el.scrollHeight, el.scrollTop, el.clientHeight);
  }, [running]);

  /* 新内容来了：在底部附近才跟到底 */
  useLayoutEffect(function () {
    const el = props.scrollRef.current;
    if (!el || props.hidden || !running || !stick.current) return;
    el.scrollTop = +el.scrollHeight || 0;
    top.current = +el.scrollTop || 0;
  }, [d.text]);

  /* 状态栏在的时候量它的高度；它消失（写完）时阅读栏往上长了这么多，scrollTop 减回去，屏幕上的字不动 */
  useLayoutEffect(function () {
    const el = props.scrollRef.current, main = props.mainRef.current;
    const had = prevPhase.current === 'writing' || prevPhase.current === 'stopped';
    prevPhase.current = props.phase;
    if (!el || !main || props.hidden || typeof main.querySelector !== 'function') return;
    const bar = main.querySelector('.zp-rbar');
    if (bar) { barH.current = +bar.offsetHeight || 0; return; }
    if (had && barH.current > 0) {
      el.scrollTop = Math.max(0, top.current - barH.current);
      top.current = +el.scrollTop || 0;
    }
  }, [props.phase]);

  useEffect(function () {
    return function () {
      if (pickLater.current) { pickLater.current(); pickLater.current = null; }
      if (frame.current) { frame.current(); frame.current = null; }
    };
  }, []);

  const onScroll = function () {
    const el = props.scrollRef.current;
    if (!el) return;
    top.current = +el.scrollTop || 0;
    stick.current = rvShouldStick(el.scrollHeight, el.scrollTop, el.clientHeight);
    if (pick) setPick(null);
    if (frame.current) return;
    frame.current = rvFrame(function () {
      frame.current = null;
      if (rvLaidOut(el)) store.setReadPos(rvPosOf(el), props.chartKey);
    });
  };
  /* 松开鼠标 / 键盘选完之后再看选区（点一下取消选区时，选区在 mouseup 之后才清掉） */
  const onPickCheck = function () {
    if (pickLater.current) pickLater.current();
    pickLater.current = uiLater(function () {
      pickLater.current = null;
      setPick(rvPickFrom(props.scrollRef.current, props.mainRef.current));
    }, 0);
  };
  const onAsk = function () {
    if (!pick) return;
    store.setQuote({ label: t('rvQuoteLabel'), text: pick.text });
    store.setPanel(true);
    rvClearSelection();
    setPick(null);
  };

  return [
    h('div', {
      key: 'scroll', className: 'zp-rscroll', tabIndex: 0, role: 'region', 'aria-label': t('rvDocLabel'),
      ref: props.scrollRef, onScroll: onScroll, onMouseUp: onPickCheck, onKeyUp: onPickCheck
    },
    h('article', { className: 'zr-prose zp-rdoc' }, head, h(ReportSections, { chunks: chunks }))),
    pick ? h('button', {
      key: 'pick', className: 'zp-rpick', type: 'button', style: { left: pick.x, top: pick.y },
      onMouseDown: function (ev) { ev.preventDefault(); },
      onClick: onAsk
    }, t('rvAsk')) : null
  ];
}

/* ---------------- 舞台 ---------------- */
/* ProApp 一直挂着它，看盘面时给 hidden（不卸载）。正文按命盘 key 挂：换了盘就是一份新的正文、新的阅读位置。 */
function ReportStage() {
  const v = useStore(rvStageOf);
  const scrollRef = useRef(null);
  const mainRef = useRef(null);
  const stickRef = useRef(true);
  const hasDoc = v.phase !== 'empty';
  return h('div', { className: 'zp-rbody', hidden: v.hidden },
    h('aside', { className: 'zp-rside' }, h(ReportToc, { scrollRef: scrollRef, stickRef: stickRef })),
    h('div', { className: 'zp-rmain', 'data-region': 'REPORT_DOC', ref: mainRef },
      hasDoc ? h(ReportBar, { key: 'bar' }) : null,
      hasDoc
        ? h(ReportDoc, { key: 'doc-' + v.key, chartKey: v.key, phase: v.phase, hidden: v.hidden, scrollRef: scrollRef, mainRef: mainRef, stickRef: stickRef })
        : h(ReportEmpty, { key: 'empty' })));
}

ZWUI.rvShouldStick = rvShouldStick;
ZWUI.rvChunks = rvChunks;
ZWUI.rvSectionView = rvSectionView;
ZWUI.rvOutline = rvOutlineOf;
ZWUI.rvSafeName = rvSafeName;
ZWUI.rvFileName = rvFileName;
ZWUI.rvPickPlace = rvPickPlace;
ZWUI.rvUnwritten = rvUnwritten;
