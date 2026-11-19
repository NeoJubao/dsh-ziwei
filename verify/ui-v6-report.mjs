/**
 * verify/ui-v6-report.mjs — v6 报告模块（window.ZWReport）与导出文件（T4）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。覆盖：
 *   - verify/verify.mjs 第 598–622 行的 v5 断言原样跑在 v6 模块上（表格、对齐、加粗、<br>、标题 / 分隔线 / 列表、打印分页）
 *   - 转义：markdown 里的 HTML 只放行 <br>；称呼、出生地、职业在导出文件里都被转义
 *   - 分部：编号拆分、没有编号的部分不补号、标题写到一半也算一个部分、往后追加文字前面各部分的 html 严格相等
 *   - 进度 progress(md)、徽记（确定、良构、14 个星点、id 不冲突）、静态命盘（12 宫 + 中宫）
 *   - 导出文件：doctype、charset、浅 / 深 / 打印三组变量（键集合相等）、四化配色沿用 v5、
 *     封面 / 命盘 / 目录 / 落款 / 免责声明、不依赖任何外部资源
 *   - 模块里的正文样式等于 src/ui/css/85-prose.css；面板里用到的 --zr-* 都映射到宿主 / --zp-* 变量
 * 只用黄金用例：1992-05-03 09:30，男，经度 105.97。期望值都是字面量。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle, makeCtx } from './client-harness.mjs';

const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
const count = (s, needle) => String(s).split(needle).length - 1;

/** 标签成对、只有一个根元素（够检查我们自己拼的 SVG；属性里不含 >）。 */
function wellFormed(xml) {
  const s = String(xml).trim();
  if (!s.startsWith('<svg') || !s.endsWith('</svg>')) return false;
  const stack = [];
  let roots = 0;
  const re = /<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g;
  let m;
  let last = 0;
  while ((m = re.exec(s))) {
    if (/[<>]/.test(s.slice(last, m.index))) return false;
    last = re.lastIndex;
    const [, close, name, self] = m;
    if (self) { if (!stack.length) roots++; continue; }
    if (close) { if (stack.pop() !== name) return false; continue; }
    if (!stack.length) roots++;
    stack.push(name);
  }
  return stack.length === 0 && roots === 1 && last === s.length;
}

const idsOf = (html) => [...String(html).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const varsOf = (block) => Object.fromEntries([...String(block || '').matchAll(/(--zr-[\w-]+)\s*:\s*([^;]*)/g)].map((m) => [m[1], m[2].trim()]));
const sameKeys = (a, b) => {
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return ka.length > 0 && ka.length === kb.length && ka.every((k, i) => k === kb[i]);
};

const TITLES14 = ['命盘总览', '性格大略', '家庭关系', '婚姻情感', '子女培育', '财富管理', '健康养生',
  '事业发展', '朋友贵人', '居家风水', '心灵福德', '出行迁移', '大限节奏', '综合建议'];
const NUMS14 = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四'];
const STARS14 = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
/* spec §4.6 / tokens.md：十四主星的浅 / 深两套颜色 */
const STAR_LIGHT = ['#8a5cc4', '#2f84b8', '#c96a24', '#a07b1c', '#c04d78', '#b5402f', '#93633a', '#5b6cc0', '#2f9363', '#6d808a', '#21917d', '#7d6c56', '#a3354a', '#4560a6'];
const STAR_DARK = ['#c7aaf5', '#86c3e8', '#f3ab70', '#e2c06e', '#ef97b5', '#ec8a7b', '#d6a982', '#aab6f2', '#86d6a9', '#b4c3cb', '#7bd6c3', '#c9b9a2', '#e48190', '#93aaea'];
const DISCLAIMER = '本报告基于中华传统文化（紫微斗数）体系生成，非现代科学结论，仅供参考，不构成医疗 / 法律 / 金融 / 婚姻等专业领域的决策依据。';

/* 一份短样稿：盘前一句、两个有编号的部分（含表格、小标题、引用、列表）、分隔线、十二字心法 */
const SAMPLE_MD = [
  '> 盘前一句：以下据命盘而写。',
  '',
  '## 一、命盘总览',
  '',
  '命宫在丑，**太阳、太阴**同坐。',
  '',
  '| 四化 | 星曜 | 落宫 |',
  '| :-- | :-: | --: |',
  '| 化禄 | 天梁 | 官禄 |',
  '| 化忌 | 武曲 | 兄弟 |',
  '',
  '### 格局',
  '',
  '- 日月同宫',
  '- 机月同梁',
  '',
  '## 二、性格大略',
  '',
  '> 知人者智，自知者明。',
  '',
  '1. 先看命宫',
  '2. 再看身宫',
  '',
  '---',
  '',
  '## 十二字心法',
  '',
  '以星悟道，知位知微；指危心钥，行要心药'
].join('\n');

export default async function report(t) {
  const { ok, section } = t;

  section('v6 报告模块：装载（window.ZWReport）');
  const b = t.client ? loadBundle(t.client) : null;
  let applyErr = null;
  if (b && b.entry) {
    try { const plugin = b.materialize(); plugin.apply(makeCtx({}).ctx); } catch (e) { applyErr = e; }
  }
  const win = b ? b.win : {};
  const R = win.ZWReport;
  ok('apply() 暴露 window.ZWReport（mdToHtml / mdToChatHtml / splitSections / buildReportHtml …）',
    !!R && ['escHtml', 'mdToHtml', 'mdToChatHtml', 'splitSections', 'sectionHtml', 'progress', 'emblemSvg', 'boardHtml', 'buildReportHtml']
      .every((k) => typeof R[k] === 'function'),
    applyErr ? applyErr.message : R ? 'keys: ' + Object.keys(R).join(',') : '没有 window.ZWReport');
  if (!R) return;
  const golden = safe(() => win.ZWCore.paipan({ date: '1992-05-03', time: '09:30', gender: 'male', longitude: 105.97 }).chart);
  ok('黄金用例排盘可用（1992-05-03 09:30 男 105.97）', !!golden && golden.soulBranch === '丑');
  if (!golden) return;
  ok('REPORT_SECTION_TITLES 是 v5 的 14 个部分', JSON.stringify(R.REPORT_SECTION_TITLES) === JSON.stringify(TITLES14), JSON.stringify(R.REPORT_SECTION_TITLES));

  /* ---------------------------------------------------------------- */
  section('v6 报告模块：v5 的断言原样通过（verify/verify.mjs 598–622）');
  {
    const reportApi = R;
    const ch = golden;
    const mdTable = [
      '| 宫位 | 主星 | 备注 |',
      '| :--- | :---: | ---: |',
      '| 命宫 | 天机[庙]·**化权** | 灯芯<br>谋略 |',
      '| 夫妻 | 太阳[不] | — |'
    ].join('\n');
    const htmlTable = reportApi ? reportApi.mdToHtml(mdTable) : '';
    ok('报告表格 → <table>（表头 / 三向对齐 / 单元格 <br> / 行内强调）',
      /<table class="md-table">/.test(htmlTable) &&
      /<th style="text-align:left">宫位<\/th>/.test(htmlTable) &&
      /<th style="text-align:center">主星<\/th>/.test(htmlTable) &&
      /<th style="text-align:right">备注<\/th>/.test(htmlTable) &&
      /天机\[庙\]·<strong>化权<\/strong>/.test(htmlTable) &&
      /灯芯<br>谋略/.test(htmlTable) &&
      !/\|/.test(htmlTable.replace(/<[^>]+>/g, '')),
      htmlTable.slice(0, 200));
    const chatTable = reportApi ? reportApi.mdToChatHtml(mdTable) : '';
    ok('抽屉回答里的管道表格也渲染（zp-md-table，不露管道符）',
      /<table class="zp-md-table">/.test(chatTable) &&
      /<th style="text-align:left">宫位<\/th>/.test(chatTable) &&
      /灯芯<br>谋略/.test(chatTable) &&
      !/\|/.test(chatTable.replace(/<[^>]+>/g, '')),
      chatTable.slice(0, 200));
    const htmlMixed = reportApi ? reportApi.mdToHtml('## 标题\n\n---\n\n正文**加粗**\n\n- 甲\n- 乙') : '';
    ok('报告标题 / 分隔线 / 列表渲染',
      /<h3>标题<\/h3>/.test(htmlMixed) && /<hr>/.test(htmlMixed) &&
      /<strong>加粗<\/strong>/.test(htmlMixed) && /<ul>\s*<li>甲<\/li>\s*<li>乙<\/li>\s*<\/ul>/.test(htmlMixed),
      htmlMixed.slice(0, 200));
    const htmlDoc = reportApi ? reportApi.buildReportHtml({ chart: ch, name: '测试', gender: 'male' }, mdTable) : '';
    ok('精装报告壳含表格样式、<table> 与打印分页保护',
      /\.md-table\{/.test(htmlDoc) && /<table class="md-table">/.test(htmlDoc) &&
      /page-break-inside:avoid/.test(htmlDoc) && /<\/html>/.test(htmlDoc));
  }

  /* ---------------------------------------------------------------- */
  section('v6 报告模块：markdown 口径与转义');
  ok('mdToHtml：### → h4、引用 → blockquote.quote-block、有序列表、行内代码（v5 口径，逐字）',
    R.mdToHtml('### 小节\n\n> 格言\n\n1. 一\n2. 二\n\n`码`') ===
      '<h4>小节</h4>\n<blockquote class="quote-block">格言</blockquote>\n<ol>\n<li>一</li>\n<li>二</li>\n</ol>\n<p class="body-text"><code>码</code></p>',
    JSON.stringify(R.mdToHtml('### 小节\n\n> 格言\n\n1. 一\n2. 二\n\n`码`')));
  ok('mdToChatHtml：zp-md-* 的对话排版（v5 口径，逐字）',
    R.mdToChatHtml('## 标题\n> 引用\n- 甲\n\n正文') ===
      '<div class="zp-md-h zp-md-h2">标题</div><div class="zp-md-quote">引用</div><div class="zp-md-li">· 甲</div><div class="zp-md-gap"></div><div class="zp-md-p">正文</div>',
    JSON.stringify(R.mdToChatHtml('## 标题\n> 引用\n- 甲\n\n正文')));
  const imgMd = R.mdToHtml('<img onerror=1>');
  ok('mdToHtml 转义 <img onerror=1>', imgMd === '<p class="body-text">&lt;img onerror=1&gt;</p>', imgMd);
  const brMd = R.mdToHtml('甲<br>乙<BR/>丙<br />丁<script>x</script>');
  ok('只放行 <br>（各种写法），其它标签都被转义',
    brMd === '<p class="body-text">甲<br>乙<br>丙<br>丁&lt;script&gt;x&lt;/script&gt;</p>', brMd);
  const chatImg = R.mdToChatHtml('<img src=x onerror=1>');
  ok('mdToChatHtml 同样转义', chatImg === '<div class="zp-md-p">&lt;img src=x onerror=1&gt;</div>', chatImg);
  ok('escHtml 转义 & < > " \'，null 是空串',
    R.escHtml('<b class="x">\'&') === '&lt;b class=&quot;x&quot;&gt;&#39;&amp;' && R.escHtml(null) === '' && R.escHtml(undefined) === '',
    R.escHtml('<b class="x">\'&'));

  /* ---------------------------------------------------------------- */
  section('v6 报告模块：分部与进度');
  const secs = R.splitSections(SAMPLE_MD);
  ok('splitSections：盘前一句 + 两个编号部分 + 十二字心法 = 4 部分，id 依次为 zr-s0…zr-s3',
    secs.length === 4 && secs.map((s) => s.id).join(',') === 'zr-s0,zr-s1,zr-s2,zr-s3',
    JSON.stringify(secs.map((s) => [s.id, s.num, s.title])));
  ok('每个部分是 { id, num, title, html, lead, motto }',
    secs.every((s) => ['id', 'num', 'title', 'html', 'lead', 'motto'].every((k) => k in s) && typeof s.html === 'string'));
  ok('「一、命盘总览」→ num 一、title 命盘总览', secs[1] && secs[1].num === '一' && secs[1].title === '命盘总览', secs[1] && JSON.stringify([secs[1].num, secs[1].title]));
  ok('没有标题的开头是 lead 部分（num、title 都为空）', secs[0] && secs[0].lead === true && secs[0].num === '' && secs[0].title === '' && /盘前一句/.test(secs[0].html));
  ok('「十二字心法」不补编号（num === \'\'），标为 motto，不是 lead',
    secs[3] && secs[3].num === '' && secs[3].title === '十二字心法' && secs[3].motto === true && secs[3].lead === false && secs[1].motto === false);
  const pre = R.splitSections('## 盘前须知\n\n先说明一句');
  ok('「盘前须知」不补编号', pre.length === 1 && pre[0].num === '' && pre[0].title === '盘前须知' && pre[0].lead === false, JSON.stringify(pre.map((s) => [s.num, s.title])));
  ok('部分里的表格包在横向滚动容器里（.zr-tw）',
    secs[1] && secs[1].html.includes('<div class="zr-tw"><table class="md-table">') && secs[1].html.includes('</table></div>') &&
    count(secs[1].html, '<div class="zr-tw">') === 1, secs[1] && secs[1].html.slice(0, 160));
  ok('部分末尾的分隔线不重复画（下一部分自带分界）', secs[2] && !secs[2].html.includes('<hr>') && /<ol>/.test(secs[2].html), secs[2] && secs[2].html);
  ok('部分标题里的 markdown 记号去掉（**、`）', (() => { const s = R.splitSections('## 三、**家庭**关系\n\n甲'); return s[0].num === '三' && s[0].title === '家庭关系'; })());

  const typing = R.splitSections('## 一、命盘总览\n\n正文\n\n## 二、性');
  ok('标题写到一半也算一个部分（## 二、性 → num 二、title 性）',
    typing.length === 2 && typing[1].num === '二' && typing[1].title === '性', JSON.stringify(typing.map((s) => [s.num, s.title])));
  const typingNum = R.splitSections('## 一、命盘总览\n\n正文\n\n## 二');
  ok('只写了编号（## 二）也算一个部分：num 二、title 空', typingNum.length === 2 && typingNum[1].num === '二' && typingNum[1].title === '', JSON.stringify(typingNum.map((s) => [s.num, s.title])));
  const base1 = R.splitSections('## 一、命盘总览\n\n正文');
  const typingHash = R.splitSections('## 一、命盘总览\n\n正文\n\n##');
  ok('末尾只有 ## 还没写标题：不进上一部分的正文', typingHash.length === 1 && typingHash[0].html === base1[0].html, typingHash[0] && typingHash[0].html);

  /* 逐字追加：任何时刻，除了最后一个部分，前面各部分的 html / title / num 都和上一刻严格相等 */
  {
    let bad = '';
    let prev = R.splitSections('');
    for (let k = 1; k <= SAMPLE_MD.length && !bad; k++) {
      const cur = R.splitSections(SAMPLE_MD.slice(0, k));
      for (let i = 0; i < prev.length - 1; i++) {
        const a = prev[i], c = cur[i];
        if (!c || c.html !== a.html || c.title !== a.title || c.num !== a.num || c.id !== a.id) {
          bad = `第 ${k} 个字时第 ${i} 部分变了：${JSON.stringify(a && a.html).slice(0, 80)} → ${JSON.stringify(c && c.html).slice(0, 80)}`;
          break;
        }
      }
      if (cur.length < prev.length) bad = `第 ${k} 个字时部分数从 ${prev.length} 变成 ${cur.length}`;
      prev = cur;
    }
    ok('逐字追加样稿：已写完的部分的 html 严格相等，部分数不减少', !bad, bad);
  }

  ok('progress(\'\') 是 { done: 0, total: 14, current: 1 }', JSON.stringify(R.progress('')) === '{"done":0,"total":14,"current":1}', JSON.stringify(R.progress('')));
  ok('progress：正在写第一部分 → done 0、current 1',
    JSON.stringify(R.progress('## 一、命盘总览\n\n甲')) === '{"done":0,"total":14,"current":1}', JSON.stringify(R.progress('## 一、命盘总览\n\n甲')));
  ok('progress：只数有编号的部分（盘前须知不算）→ done 1、current 2',
    JSON.stringify(R.progress('## 盘前须知\n\n甲\n\n## 一、命盘总览\n\n乙\n\n## 二、性格大略\n\n丙')) === '{"done":1,"total":14,"current":2}',
    JSON.stringify(R.progress('## 盘前须知\n\n甲\n\n## 一、命盘总览\n\n乙\n\n## 二、性格大略\n\n丙')));
  const full14 = TITLES14.map((x, i) => '## ' + NUMS14[i] + '、' + x + '\n\n正文').join('\n\n');
  ok('progress：14 部分都开了头、第 14 部分还在写 → done 13、current 14',
    JSON.stringify(R.progress(full14)) === '{"done":13,"total":14,"current":14}', JSON.stringify(R.progress(full14)));
  ok('progress：第 14 部分之后又有一部分（十二字心法）→ done 14、current 14',
    JSON.stringify(R.progress(full14 + '\n\n## 十二字心法\n\n守其正')) === '{"done":14,"total":14,"current":14}',
    JSON.stringify(R.progress(full14 + '\n\n## 十二字心法\n\n守其正')));

  const sh = R.sectionHtml({ id: 'zr-s1', num: '一', title: '命盘总览', html: '<p>x</p>', lead: false, motto: false });
  ok('sectionHtml：编号和标题分开排（逐字）',
    sh === '<section class="zr-sec" id="zr-s1" data-sec="zr-s1"><h2 class="zr-h"><i>一</i><b>命盘总览</b></h2><p>x</p></section>', sh);
  const shEsc = R.sectionHtml({ id: 'zr-s2', num: '', title: '<b>x</b>', html: '', lead: false, motto: true });
  ok('sectionHtml：标题被转义；心法部分带 zr-motto；没有编号不出 <i>',
    shEsc === '<section class="zr-sec zr-motto" id="zr-s2" data-sec="zr-s2"><h2 class="zr-h"><b>&lt;b&gt;x&lt;/b&gt;</b></h2></section>', shEsc);

  /* ---------------------------------------------------------------- */
  section('v6 报告模块：徽记与静态命盘');
  const em1 = R.emblemSvg(golden), em2 = R.emblemSvg(golden);
  ok('emblemSvg(黄金用例) 两次调用结果相同', typeof em1 === 'string' && em1.length > 500 && em1 === em2);
  ok('徽记是良构的 SVG（标签成对、只有一个根 <svg>）', wellFormed(em1) && count(em1, '<svg') === 1, em1.slice(0, 120));
  const dots = [...em1.matchAll(/data-star="([^"]+)"/g)].map((m) => m[1]);
  ok('徽记恰好 14 个星点，每颗主星一个', dots.length === 14 && [...dots].sort().join() === [...STARS14].sort().join(), dots.join(','));
  ok('星点颜色走变量（var(--zr-s0) 是紫微），不写死颜色', em1.includes('var(--zr-s0)') && !STAR_LIGHT.some((c) => em1.toLowerCase().includes('fill="' + c)));
  const small = R.emblemSvg(golden, { small: true });
  ok('small：仍是 14 个星点、良构、不出地支文字', wellFormed(small) && count(small, 'data-star="') === 14 && !small.includes('<text'));
  const labeled = R.emblemSvg(golden, { labels: true });
  ok('labels：星名写在星点旁', wellFormed(labeled) && labeled.includes('>紫微</text>') && labeled.includes('>破军</text>'));
  const ea = R.emblemSvg(golden, { id: 'a' }), eb = R.emblemSvg(golden, { id: 'b' });
  const ia = idsOf(ea), ib = idsOf(eb);
  ok('{ id: \'a\' } 和 { id: \'b\' } 没有相同的 id="…"，url(#…) 都指向自己的 id',
    ia.length > 0 && ib.length > 0 && !ia.some((x) => ib.includes(x)) &&
    [...ea.matchAll(/url\(#([^)]+)\)/g)].every((m) => ia.includes(m[1])) && [...eb.matchAll(/url\(#([^)]+)\)/g)].every((m) => ib.includes(m[1])),
    ia.join(',') + ' / ' + ib.join(','));
  const xssLabel = R.emblemSvg(golden, { label: '"><script>' });
  ok('徽记的 aria-label 被转义', !xssLabel.includes('"><script>') && xssLabel.includes('&quot;&gt;&lt;script&gt;'));

  const board = R.boardHtml(golden, '<i>测</i>');
  ok('boardHtml：12 个宫格 + 中宫', count(board, 'class="zr-cell"') === 12 && count(board, 'class="zr-center"') === 1, `${count(board, 'class="zr-cell"')} / ${count(board, 'class="zr-center"')}`);
  ok('boardHtml：命宫、身宫各标一次；称呼被转义', count(board, '<em>命</em>') === 1 && count(board, '<em class="zr-body-mark">身</em>') === 1 && board.includes('&lt;i&gt;测&lt;/i&gt;') && !board.includes('<i>测</i>'));
  ok('boardHtml：四化印章（天梁禄、紫微权、左辅科、武曲忌）',
    /天梁(?:<sup>[^<]*<\/sup>)?<i class="zr-seal zr-lu">禄<\/i>/.test(board) && /紫微(?:<sup>[^<]*<\/sup>)?<i class="zr-seal zr-quan">权<\/i>/.test(board) &&
    /左辅<i class="zr-seal zr-ke">科<\/i>/.test(board) && /武曲(?:<sup>[^<]*<\/sup>)?<i class="zr-seal zr-ji">忌<\/i>/.test(board));
  ok('boardHtml：星名颜色走变量', board.includes('color:var(--zr-s0)') && !/color:#/.test(board));

  /* ---------------------------------------------------------------- */
  section('v6 报告模块：导出文件');
  const meta = { chart: golden, name: '<script>alert(1)</script>', place: '<img src=x onerror=1>', occupation: '"><svg onload=1>', gender: 'male' };
  const doc = R.buildReportHtml(meta, SAMPLE_MD + '\n\n<img onerror=1>');
  ok('有 doctype、charset、lang，以 </html> 结尾',
    doc.startsWith('<!DOCTYPE html>') && /<meta charset="utf-8">/.test(doc) && /<html lang="zh-CN">/.test(doc) && doc.endsWith('</html>'));
  ok('称呼里的 <script> 在 <title> 里被转义', doc.includes('<title>人生鲲鹏计划 · &lt;script&gt;alert(1)&lt;/script&gt;</title>'));
  ok('称呼、出生地、职业、正文里的 HTML 都被转义（没有 <script>alert、<img、<svg onload）',
    !doc.includes('<script>alert') && !/<img/i.test(doc) && !/<svg onload/i.test(doc) &&
    doc.includes('&lt;img src=x onerror=1&gt;') && doc.includes('&quot;&gt;&lt;svg onload=1&gt;') && doc.includes('&lt;img onerror=1&gt;'));
  const scripts = [...doc.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]);
  ok('只有一段内联脚本（打印按钮、目录高亮），没有 <script src', scripts.length === 1 && scripts[0] === '<script>', scripts.join(' '));
  const noNs = doc.split('http://www.w3.org/2000/svg').join('');
  ok('不依赖外部资源：除 SVG 命名空间外没有 http，没有 <link、@import、外部 url(',
    !/https?:/i.test(noNs) && !/<link\b/i.test(doc) && !/@import/i.test(doc) && [...doc.matchAll(/url\(([^)]*)\)/g)].every((m) => /^#/.test(m[1])),
    (noNs.match(/.{0,40}https?:.{0,40}/i) || [''])[0]);
  ok('品牌名「人生鲲鹏计划」在封面上', /<header class="zr-cover">[\s\S]*<h1>人生鲲鹏计划<\/h1>/.test(doc));
  ok('封面有这张盘的徽记、生辰、五行局和命宫主星',
    /<header class="zr-cover">[\s\S]*data-star=[\s\S]*<\/header>/.test(doc) && doc.includes('1992 年 5 月 3 日 · 农历四月初一 · 辰时') && /木三局 · 太阳、太阴坐命/.test(doc));
  ok('命盘页：基本信息（阳男、真太阳时）+ 12 个宫格 + 中宫',
    count(doc, 'class="zr-cell"') === 12 && count(doc, 'class="zr-center"') === 1 && doc.includes('阳男') &&
    doc.includes('1992-05-03 08:37（真太阳时，东经 105.97°）'));
  ok('目录：链到每个有标题的部分', ['zr-s1', 'zr-s2', 'zr-s3'].every((id) => doc.includes('href="#' + id + '"')) && /class="zr-toc"/.test(doc));
  ok('正文的四个部分都在', ['zr-s0', 'zr-s1', 'zr-s2', 'zr-s3'].every((id) => doc.includes('id="' + id + '"')));
  ok('落款沿用 v5：LifeView、紫微师 · 金聚｜道商意象紫微九诀、微信、人生画板 · 日期',
    doc.includes('>LifeView<') && doc.includes('紫微师 · 金聚｜道商意象紫微九诀') && doc.includes('微信：neo2025new') && /人生画板 · \d{8}</.test(doc));
  ok('免责声明逐字', doc.includes(DISCLAIMER));
  ok('页面上有「打印 / 存为 PDF」按钮', doc.includes('>打印 / 存为 PDF</button>') && doc.includes('data-print'));

  const css = (/<style>([\s\S]*?)<\/style>/.exec(doc) || ['', ''])[1];
  const light = varsOf((/(?:^|\})\s*:root\{([^}]*--zr-bg:[^}]*)\}/.exec(css) || [])[1]);
  const dark = varsOf((/@media screen and \(prefers-color-scheme:\s*dark\)\s*\{\s*:root\{([^}]*)\}\s*\}/.exec(css) || [])[1]);
  const print = varsOf((/@media print\s*\{\s*:root\{([^}]*)\}/.exec(css) || [])[1]);
  ok('屏幕：浅色变量 + prefers-color-scheme: dark 的深色变量，键集合相等', sameKeys(light, dark) && Object.keys(light).length >= 30,
    `浅 ${Object.keys(light).length} / 深 ${Object.keys(dark).length}；只在一边：${[...Object.keys(light).filter((k) => !(k in dark)), ...Object.keys(dark).filter((k) => !(k in light))].join(',')}`);
  ok('打印一律浅色：@media print 里的变量和浅色逐个相等', sameKeys(light, print) && Object.keys(light).every((k) => light[k] === print[k]));
  ok('color-scheme: light dark（屏幕跟随系统）', /color-scheme:\s*light dark/.test(css));
  ok('四化配色沿用 v5（禄绿、权蓝、科金、忌红）：浅色',
    light['--zr-lu'] === '#15803d' && light['--zr-quan'] === '#1d4ed8' && light['--zr-ke'] === '#a16207' && light['--zr-ji'] === '#b91c1c',
    JSON.stringify([light['--zr-lu'], light['--zr-quan'], light['--zr-ke'], light['--zr-ji']]));
  ok('四化配色沿用 v5：深色',
    dark['--zr-lu'] === '#4ade80' && dark['--zr-quan'] === '#7aa2ff' && dark['--zr-ke'] === '#e3b341' && dark['--zr-ji'] === '#f87171',
    JSON.stringify([dark['--zr-lu'], dark['--zr-quan'], dark['--zr-ke'], dark['--zr-ji']]));
  ok('十四主星浅 / 深两套颜色和 tokens.md 一致',
    STAR_LIGHT.every((c, i) => light['--zr-s' + i] === c) && STAR_DARK.every((c, i) => dark['--zr-s' + i] === c));
  ok('打印规则：@page A4、封面单独一页、命盘和目录一页、标题不落页尾、表格行不跨页、打印按钮隐藏',
    /@page\{size:A4/.test(css) && /@media print\{/.test(css) &&
    /\.zr-cover\{[^}]*break-after:page/.test(css) && /\.zr-chart\{[^}]*break-after:page/.test(css) &&
    /h2,[^{]*h3,[^{]*h4\{[^}]*break-after:avoid/.test(css) && /\.md-table tr\{[^}]*break-inside:avoid/.test(css) &&
    /\.zr-tools\{display:none/.test(css));
  ok('导出文件不用 position: fixed、视口单位', !/position\s*:\s*fixed/.test(doc) && !/\b\d+(?:\.\d+)?(?:[dsl]?v[wh]|vmin|vmax)\b/.test(css));

  /* ---------------------------------------------------------------- */
  section('v6 报告模块：正文样式（css/85-prose.css）');
  const proseFile = safe(() => readFileSync(join(t.root, 'src', 'ui', 'css', '85-prose.css'), 'utf8'), '');
  ok('模块里的 PROSE_CSS 等于 src/ui/css/85-prose.css', typeof R.PROSE_CSS === 'string' && proseFile.length > 200 && R.PROSE_CSS === proseFile,
    `模块 ${String(R.PROSE_CSS || '').length} 字 / 文件 ${proseFile.length} 字`);
  ok('85-prose.css 里没有字面色（颜色都走 --zr-* 变量）', !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|(?<![\w-])(?:white|black)(?![\w-])/.test(proseFile.replace(/\/\*[\s\S]*?\*\//g, '')));
  const panelMap = (/\.zp-root \.zr-prose\s*\{([^}]*)\}/.exec(proseFile) || [])[1] || '';
  ok('面板里把 --zr-* 映射到宿主 token 和 --zp-*（四化用 --zp-mu-*）',
    /--zr-lu:\s*var\(--zp-mu-lu\)/.test(panelMap) && /--zr-quan:\s*var\(--zp-mu-quan\)/.test(panelMap) &&
    /--zr-ke:\s*var\(--zp-mu-ke\)/.test(panelMap) && /--zr-ji:\s*var\(--zp-mu-ji\)/.test(panelMap) &&
    /--zr-ink:\s*var\(--dsw-alias-label-primary\)/.test(panelMap) && /--zr-s13:\s*var\(--zp-s13\)/.test(panelMap));
  const used = [...new Set([...proseFile.replace(/\.zp-root \.zr-prose\s*\{[^}]*\}/, '').matchAll(/var\((--zr-[\w-]+)/g)].map((m) => m[1]))];
  const panelVars = varsOf(panelMap);
  const exportVars = { ...varsOf(R.FONTS), ...varsOf(R.LIGHT) };
  ok('正文用到的每个 --zr-* 在面板映射和导出文件里都有定义',
    used.length > 5 && used.every((v) => v in panelVars && v in exportVars),
    'missing: ' + used.filter((v) => !(v in panelVars) || !(v in exportVars)).join(','));
  ok('导出文件里的正文样式就是 85-prose.css（压缩后）', css.includes('.zr-prose{') && css.includes('.zr-prose .md-table{'));
}
