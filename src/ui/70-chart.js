/* ================================================================
 * 70-chart：命盘页——时间卡、格局卡、宫位卡、盘面、三方四正连线、窄档页签（T5b）
 *
 * 结构和类名见 css/70-chart.css 开头。section.zp-chart 和它的入场类 zp-enter 是 ProApp 的；
 * ChartPage(props) 从 div.zp-body 开始渲染，看报告时（session.stage === 'report'）给它 hidden，不卸载。
 *
 * 一次选宫只该改：十二个宫格的状态属性（className 的 zp-rel、aria-pressed、tabIndex）、连线、宫位卡、窄档页签。
 * 所以订阅拆得很细（没有 memo：一个组件重渲染，它新建的子元素都跟着渲染；原样传下去的元素会被跳过）：
 *   ChartPage          stage（hidden）、当前命盘。卡片和盘面的元素用 useMemo 只建一次
 *   ChartSide          pane（div.zp-side[data-pane]），卡片作为 children 原样往下传
 *   ChartPanes         窄档才渲染：pane、tab、sel（第三个页签是选中宫的宫名）
 *   ScopeCard          tab、when（本命下不看 when）。ScopeReportButton 只选报告状态这一个字符串
 *   ScopeStrip         时间条，在时间卡里：tab、when。直接跳到某个大限 / 年 / 月 / 日（store.setWhen）
 *   PatternCard        当前命盘、pat。盘面够宽时由 CSS 藏起来，格局改在中宫里显示（PatternCenter，同一份状态）
 *   PalaceCard         sel、tab、when、showAdj；点星名看解释是组件内状态，换宫（或换盘）时复位。
 *                      多了三样：这一宫管什么、三方四正每一宫的主星、宫干四化落在哪
 *   ChartBoard         只选「是不是运限层级」（div.zp-board 的 zp-scoped）；宫格、中宫、连线的元素只建一次
 *   BoardCell × 12     每格自己选：选中 / 三方四正两个布尔值 + tab、when、showAdj；格子里的字按运限签名 useMemo
 *   BoardCenter        当前命盘、tab、when。字在 div.zp-plate 上（连线从它下面穿过）；里面的 PatternCenter 另外订阅 pat
 *   BoardLines         sel；layout effect 里量宫格 → ZWUI.linePoints，key 没变不重画；ResizeObserver 看盘面
 * 流式增量只换 readings：这里只有 ScopeReportButton 看它，选出来的是 'idle' | 'running' | 'resume' | 'done'，
 * 写的过程中一直是 'running'，所以整页只在任务开始、结束时各重渲染这一个按钮。
 *
 * key：宫格用宫位序号；个数随宫位变的列表（主星、辅星、三方四正、键值行）按位置排、不给 key——key 不能随选中宫变。
 * 连线：新选中的宫才播描线。g 的 key 在 'draw-a' / 'draw-b' 之间换（不含宫位序号），换了 g 就是新节点、CSS 的
 * zp-draw 重新播；位置变了而选中宫没变（窗口缩放）就原地改坐标并加 zp-still。挂载后的第一次画线也加 zp-still：
 * 面板切走再回来不重放。
 * ================================================================ */

/* ---------------- 常量 ---------------- */
/* 辅星吉凶看引擎给的 kind：文昌 文曲 左辅 右弼 天魁 天钺 是 soft，禄存 lucun，天马 tianma；擎羊 陀罗 火星 铃星 地空 地劫 是 tough */
const CHART_GOOD_KINDS = ['soft', 'lucun', 'tianma'];
/* 四化印，和 SCOPE_MU（禄权科忌，24-scope）同序：实心 = 生年四化，空心（zp-scoped）= 运限四化 */
const CHART_SEAL = ['zp-seal zp-lu', 'zp-seal zp-quan', 'zp-seal zp-ke', 'zp-seal zp-ji'];
const CHART_SEAL_SCOPED = ['zp-seal zp-scoped zp-lu', 'zp-seal zp-scoped zp-quan', 'zp-seal zp-scoped zp-ke', 'zp-seal zp-scoped zp-ji'];
/* 运限印和宫名标签的前缀：限 / 年 / 月 / 日 */
const CHART_PREFIX_KEYS = { decadal: 'chartPrefixDecadal', yearly: 'chartPrefixYearly', monthly: 'chartPrefixMonthly', daily: 'chartPrefixDaily' };
/* 格局的 level 是引擎给的「吉」「中」「凶」（\u5409 / \u4e2d / \u51f6）。50–90 段不写中文字面量，所以按 Unicode 转义比对；显示的字走 t() */
const CHART_LEVELS = {
  '\u5409': ['zp-lv zp-lv-ji', 'chartLvJi'],
  '\u4e2d': ['zp-lv zp-lv-zhong', 'chartLvZhong'],
  '\u51f6': ['zp-lv zp-lv-xiong', 'chartLvXiong']
};
const CHART_REPORT_KEYS = { idle: 'chartReportWrite', running: 'chartReportRunning', resume: 'chartReportResume', done: 'chartReportView' };
const CHART_PILLARS = [['yearly', 'chartPillarYear'], ['monthly', 'chartPillarMonth'], ['daily', 'chartPillarDay'], ['hourly', 'chartPillarHour']];
/* 方向键：左右沿十二宫的环走一格，上下跳到对宫（ZWUI.ringStep） */
const CHART_ARROWS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'opp', ArrowDown: 'opp' };
/* 宫格在 4×4 网格里的位置（CELL_POS，25-board）；每格一个固定的 style 对象，重渲染时不换 */
const CHART_CELL_STYLE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) {
  return { gridColumn: CELL_POS[i][0], gridRow: CELL_POS[i][1] };
});

/* ---------------- 选择器（store 每变一次都会跑：只取值，不做重活） ---------------- */
function chartPageOf(s, store) {
  return { hidden: s.session.stage === 'report', entry: store.currentEntry() };
}

function chartPaneOf(s) {
  return s.session.pane;
}

function chartScopedOf(s) {
  return s.session.tab !== 'natal';
}

function chartSelOf(s) {
  return s.session.sel;
}

/* 本命不看日期：前后翻只在运限页签上，本命下 when 变了不该让谁重渲染 */
function chartTimeOf(s, store) {
  const ss = s.session;
  return { entry: store.currentEntry(), tab: ss.tab, when: ss.tab === 'natal' ? null : ss.when };
}

function chartPatsOf(s, store) {
  return { entry: store.currentEntry(), pat: s.session.pat };
}

function chartPalaceOf(s, store) {
  const ss = s.session;
  return { entry: store.currentEntry(), tab: ss.tab, when: ss.tab === 'natal' ? null : ss.when, sel: ss.sel, adj: !!s.prefs.showAdj };
}

function chartPanesOf(s, store) {
  const ss = s.session;
  return { entry: store.currentEntry(), tab: ss.tab, sel: ss.sel, pane: ss.pane };
}

function chartCellOf(s, store, i) {
  const ss = s.session;
  const rel = relatedPalaces(ss.sel);
  return {
    entry: store.currentEntry(), tab: ss.tab, when: ss.tab === 'natal' ? null : ss.when, adj: !!s.prefs.showAdj,
    on: ss.sel === i, rel: rel.opp === i || rel.tri[0] === i || rel.tri[1] === i
  };
}

/* 报告按钮的状态：在写 / 写完 / 没写完但有字（可以接着写）/ 还没写 */
function chartReportOf(s, store) {
  const entry = store.currentEntry();
  const key = entry ? store.keyOf(entry) : '';
  if (!key) return 'idle';
  const job = s.jobs[key];
  if (job && job.kind === 'report') return 'running';
  const r = s.readings[key];
  const rep = r ? r.report : null;
  if (!rep) return 'idle';
  if (rep.status === 'done') return 'done';
  if (rep.status === 'running') return 'running';
  return rep.status === 'error' && /\S/.test(String(rep.text || '')) ? 'resume' : 'idle';
}

/* ---------------- 小工具 ---------------- */
/* 一个库条目的排盘结果不会变（改生辰会换一个条目对象），所以各组件按条目 useMemo，不在每次渲染里重新查 */
function chartOfEntry(entry) {
  return entry ? appStore().chartOf(entry) : null;
}

/* 当前页签那一层运限（本命是 null）。store.horoscope() 按命盘 + 日期记着上一次的结果，十二个宫格一起取不会重算 */
function chartScopeLayer(tab) {
  if (tab === 'natal') return null;
  const hh = appStore().horoscope();
  return hh && hh[tab] ? hh[tab] : null;
}

/* 个数会随宫位变的子元素按位置排、不给 key（key 不能随选中宫变）；参数照常传给 createElement */
function chartEl(type, props, list) {
  return h.apply(null, [type, props].concat(list));
}

function chartStarStyle(name) {
  const v = starColorVar(name);
  return v ? { '--zp-c': v } : undefined;
}

/* 运限四化：星名 → 序号（禄权科忌） */
function chartScopeMu(scope) {
  const mu = Object.create(null);
  if (scope) scope.mutagen.forEach(function (name, k) { if (name) mu[name] = k; });
  return mu;
}

function chartNatalSeal(star) {
  const k = SCOPE_MU.indexOf(star.mutagen);
  return k >= 0 ? h('i', { className: CHART_SEAL[k] }, star.mutagen) : null;
}

function chartScopeSeal(star, mu, prefix) {
  const k = mu[star.name];
  return k === undefined ? null : h('i', { className: CHART_SEAL_SCOPED[k] }, prefix + SCOPE_MU[k]);
}

function chartAdjNames(p) {
  return (p.adjective || []).map(function (a) { return typeof a === 'string' ? a : (a && a.name) || ''; }).filter(Boolean);
}

/* 阴阳男女：年柱地支的阴阳（地支序号偶数为阳，和引擎排大限的规则一样）。宫位序号 0 是寅，地支序号 = 宫位序号 + 2，奇偶相同 */
function chartYinYangKey(chart) {
  const branch = String((chart.pillars && chart.pillars.yearly) || '').charAt(1);
  let idx = -1;
  chart.palaces.forEach(function (p, i) { if (p.branch === branch) idx = i; });
  const yang = idx >= 0 && idx % 2 === 0;
  const female = !!chart.meta && chart.meta.gender === 'female';
  if (yang) return female ? 'chartYangFemale' : 'chartYangMale';
  return female ? 'chartYinFemale' : 'chartYinMale';
}

/* 时间卡的时间行：运限层级的干支加粗（p.zp-when b） */
function chartWhenKids(model) {
  const s = String(model.whenText || '');
  const gz = model.tab === 'natal' ? '' : String(model.ganzhi || '');
  const at = gz ? s.lastIndexOf(gz) : -1;
  if (at < 0) return [s];
  return [s.slice(0, at), h('b', null, gz), s.slice(at + gz.length)];
}

/* ---------------- 动作 ---------------- */
/* 读这张盘：空问题 = 速览（没有用户气泡）。不带别处留下的引用：速览不是对那段话的提问 */
function chartReadChart() {
  const store = appStore();
  store.setPanel(true);
  store.ask('', { quote: null });
}

/* 解读今天 / 这个月 / 今年 / 这十年：问「<那个词>怎么样」，带上这一层的定位 */
function chartReadScope() {
  const store = appStore();
  const chart = store.currentChart();
  if (!chart) return;
  const s = store.getState().session;
  const rel = relWord(chart, s.tab, s.when, store.todayOf());
  store.setPanel(true);
  store.ask(t('chartAskScope', { rel: rel }), { scope: true, quote: null });
}

function chartBackToNow() {
  appStore().backToNow();
}

function chartOpenReport() {
  appStore().setStage('report');
}

/* 问这一宫：这一宫的星曜作为引用，直接提问 */
function chartAskPalace(chart, sel) {
  const store = appStore();
  const p = chart.palaces[sel];
  store.setPanel(true);
  store.ask(t('chartAskPalace', { palace: p.name }), {
    quote: { label: t('chartQuotePalaceLabel'), text: palaceQuoteText(p, t('chartEmptyPalace')) }
  });
}

function chartCellKey(ev, i) {
  const dir = Object.prototype.hasOwnProperty.call(CHART_ARROWS, ev.key) ? CHART_ARROWS[ev.key] : null;
  if (!dir || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
  ev.preventDefault();
  const next = ringStep(i, dir);
  appStore().selectPalace(next);
  /* 焦点跟着选中走：新宫格的 tabIndex 等重渲染才变成 0，按钮本身现在就能聚焦 */
  const boardEl = ev.currentTarget ? ev.currentTarget.parentNode : null;
  const el = boardEl && typeof boardEl.querySelector === 'function' ? boardEl.querySelector('[data-i="' + next + '"]') : null;
  if (el) focusQuietly(el);
}

/* ---------------- 页面 ---------------- */
function ChartPage(props) {
  const m = useStore(chartPageOf);
  const cards = useMemo(function () {
    return [h(ScopeCard, { key: 'scope' }), h(PatternCard, { key: 'pats' }), h(PalaceCard, { key: 'detail' })];
  }, []);
  const boardEl = useMemo(function () { return h(ChartBoard, null); }, []);
  const chart = useMemo(function () { return chartOfEntry(m.entry); }, [m.entry]);
  const ok = !!chart;
  return h('div', { className: 'zp-body', hidden: m.hidden },
    ok ? h(ChartSide, { narrow: props.tier === 'narrow' }, cards) : null,
    ok ? h('div', { className: 'zp-board-wrap' }, boardEl) : null);
}

function ChartSide(props) {
  const pane = useStore(chartPaneOf);
  return h('div', { className: 'zp-side', 'data-pane': pane }, props.narrow ? h(ChartPanes, null) : null, props.children);
}

function ChartPanes() {
  const m = useStore(chartPanesOf);
  const chart = useMemo(function () { return chartOfEntry(m.entry); }, [m.entry]);
  return h(Seg, {
    items: [
      { id: 'scope', label: scopeTabName(m.tab) },
      { id: 'pats', label: t('chartPatsTitle') },
      { id: 'detail', label: chart ? chart.palaces[m.sel].name : '' }
    ],
    value: m.pane, label: t('chartPanes'), className: 'zp-panes', region: 'PANES',
    onChange: function (id) { appStore().setPane(id); }
  });
}

/* ---------------- 时间卡 ---------------- */
function ScopeCard() {
  const m = useStore(chartTimeOf);
  const chart = useMemo(function () { return chartOfEntry(m.entry); }, [m.entry]);
  const model = useMemo(function () {
    return chart ? scopeCardModel(chart, { tab: m.tab, when: m.when }, appStore().todayOf()) : null;
  }, [chart, m.tab, m.when]);
  if (!model) {
    return h('section', { className: 'zp-card zp-scope', 'data-region': 'SCOPE' },
      h('div', { className: 'zp-card-h' }, h('h3', null, scopeTabName(m.tab))));
  }
  const natal = model.tab === 'natal';
  const labels = model.stepLabels || ['', ''];
  return h('section', { className: 'zp-card zp-scope', 'data-region': 'SCOPE' },
    h('div', { className: 'zp-card-h' },
      h('h3', null, model.title),
      model.canStep ? h('div', { className: 'zp-card-right' },
        h('button', {
          type: 'button', className: 'zp-step', title: labels[0], 'aria-label': labels[0],
          onClick: function () { appStore().stepScope(-1); }
        }, h(Icon, { name: 'chevronLeft', size: 14 })),
        h('button', {
          type: 'button', className: 'zp-step', title: labels[1], 'aria-label': labels[1],
          onClick: function () { appStore().stepScope(1); }
        }, h(Icon, { name: 'chevronRight', size: 14 }))) : null),
    chartEl('p', { className: 'zp-when' }, chartWhenKids(model)),
    h('p', { className: 'zp-line' }, model.line),
    h('div', { className: 'zp-mut', role: 'group', 'aria-label': t('chartMutagen') }, model.mutagen.map(function (name, k) {
      return h('span', { key: k, title: name ? t('chartMutTitle', { star: name, mu: SCOPE_MU[k] }) : undefined },
        name ? h('b', { style: chartStarStyle(name) }, name) : null,
        name ? h('i', { className: CHART_SEAL[k] }, SCOPE_MU[k]) : null);
    })),
    h(ScopeStrip, null),
    h('div', { className: 'zp-card-f' },
      h('button', { type: 'button', className: 'zp-btn', onClick: natal ? chartReadChart : chartReadScope }, model.readLabel),
      natal ? h(ScopeReportButton, null)
        : (model.isNow ? null : h('button', { type: 'button', className: 'zp-link', onClick: chartBackToNow }, t('chartBackToToday')))));
}

/* 时间条（spec 2026-11-20 §3.8）：直接跳到某个大限、某一年、某个月、某一天，不用一下一下翻。
   本命下是「此刻」四行（大限 / 流年 / 流月 / 流日各走到哪），点一行切到那个页签的今天。
   数据是 24-scope 的 scopeStrip；这里只订阅命盘、页签、日期，选宫不重画。左栏不够高时由 CSS 先把它收起来。 */
function ScopeStrip() {
  const m = useStore(chartTimeOf);
  const store = appStore();
  const chart = useMemo(function () { return chartOfEntry(m.entry); }, [m.entry]);
  const today = store.todayOf();
  const todayKey = today.y + '-' + today.m + '-' + today.d;
  const strip = useMemo(function () {
    return chart ? scopeStrip(chart, m.tab, m.when || today, today) : null;
  }, [chart, m.tab, m.when, todayKey]);
  if (!strip) return null;
  if (strip.kind === 'now') {
    return h('div', { className: 'zp-strip', 'data-kind': 'now', role: 'group', 'aria-label': strip.title }, strip.items.map(function (it) {
      return h('button', {
        key: it.key, type: 'button', className: 'zp-now-row',
        onClick: function () { store.setWhen(it.target, it.key); }
      }, h('b', null, it.label), h('span', null, it.text), h(Icon, { name: 'caret', size: 12 }));
    }));
  }
  return h('div', { className: 'zp-strip', 'data-kind': strip.kind, role: 'group', 'aria-label': strip.title },
    h('div', { className: 'zp-strip-h' }, strip.title),
    h('div', { className: 'zp-strip-grid', 'data-cols': strip.cols },
      strip.head ? strip.head.map(function (x, i) { return h('i', { key: 'h' + i, 'aria-hidden': true }, x); }) : null,
      strip.items.map(function (it) {
        return h('button', {
          key: it.key, type: 'button', title: it.title,
          className: 'zp-strip-cell' + (it.now ? ' zp-now' : '') + (it.dim ? ' zp-dim' : '') + (it.far ? ' zp-far' : ''),
          'aria-pressed': it.on ? 'true' : 'false', disabled: it.target ? undefined : true,
          onClick: function () { store.setWhen(it.target); }
        }, it.label, it.sub ? h('small', null, it.sub) : null);
      })));
}

/* 报告按钮：字跟着报告状态走，点了都是去报告页（开始写、接着写在报告页上） */
function ScopeReportButton() {
  const kind = useStore(chartReportOf);
  return h('button', { type: 'button', className: 'zp-btn', onClick: chartOpenReport }, t(CHART_REPORT_KEYS[kind] || CHART_REPORT_KEYS.idle));
}

/* ---------------- 格局 ----------------
 * 格局不随选宫和时间变，所以放在同样不动的中宫里（PatternCenter）；盘面窄、中宫放不下时仍在左栏（PatternCard，
 * 窄档是第二个页签）。两处都渲染、共用 session.pat，由 CSS 按 .zp-body 的宽度只显示一处（css/70-chart.css）。 */
function chartPatternsOf(chart) {
  if (!chart) return [];
  try { return E.detectPatterns(chart) || []; } catch (e) { return []; }
}

function chartPatChips(list, at) {
  return h('div', { className: 'zp-pat-chips' }, list.map(function (x, i) {
    const lv = CHART_LEVELS[x.level] || CHART_LEVELS['\u4e2d'];
    return h('button', {
      key: i, type: 'button', className: 'zp-pat', 'aria-pressed': i === at ? 'true' : 'false',
      onClick: function () { appStore().setPat(i); }
    }, x.name, h('i', { className: lv[0] }, t(lv[1])));
  }));
}

function PatternCard() {
  const m = useStore(chartPatsOf);
  const chart = useMemo(function () { return chartOfEntry(m.entry); }, [m.entry]);
  const list = useMemo(function () { return chartPatternsOf(chart); }, [chart]);
  const at = m.pat >= 0 && m.pat < list.length ? m.pat : 0;
  return h('section', { className: 'zp-card zp-pats', 'data-region': 'PATTERNS' },
    h('div', { className: 'zp-card-h' },
      h('h3', null, t('chartPatsTitle')),
      list.length ? h('span', { className: 'zp-cnt' }, t('chartPatCount', { n: list.length })) : null),
    list.length ? chartPatChips(list, at) : null,
    h('p', { className: 'zp-pat-desc' }, list.length ? list[at].desc : t('chartPatEmpty')));
}

/* 中宫里的格局：一排格局名，点哪个下面显示哪个的说明。没有格局时不占地方 */
function PatternCenter() {
  const m = useStore(chartPatsOf);
  const chart = useMemo(function () { return chartOfEntry(m.entry); }, [m.entry]);
  const list = useMemo(function () { return chartPatternsOf(chart); }, [chart]);
  if (!list.length) return null;
  const at = m.pat >= 0 && m.pat < list.length ? m.pat : 0;
  return h('div', { className: 'zp-cpats', role: 'group', 'aria-label': t('chartPatsTitle') },
    chartPatChips(list, at),
    h('p', { className: 'zp-pat-desc' }, list[at].desc));
}

/* ---------------- 宫位卡 ---------------- */
function PalaceCard() {
  const m = useStore(chartPalaceOf);
  const [pick, setPick] = useState(null);
  const chart = useMemo(function () { return chartOfEntry(m.entry); }, [m.entry]);
  /* 点过的星只属于那一宫：换宫、换盘就复位（渲染时已经按 sel 判断过，这里只是把状态清掉） */
  useEffect(function () { setPick(null); }, [m.sel, chart]);
  if (!chart) return h('section', { className: 'zp-card zp-detail', 'data-region': 'INSPECTOR' });
  const sel = m.sel;
  const p = chart.palaces[sel];
  const scope = chartScopeLayer(m.tab);
  const mu = chartScopeMu(scope);
  const prefix = scope ? t(CHART_PREFIX_KEYS[m.tab]) : '';
  const picked = pick && pick.sel === sel && pick.chart === chart &&
    p.major.concat(p.minor).some(function (s) { return s.name === pick.name; }) ? pick.name : '';
  const shown = picked || (p.major[0] ? p.major[0].name : '');
  const dict = E.starDict || {};
  const brief = shown ? ((dict[shown] && dict[shown].brief) || '') : t('chartEmptyBrief');
  const starButton = function (s, minor) {
    return h('button', {
      type: 'button', className: minor ? 'zp-star zp-minor' : 'zp-star', style: chartStarStyle(s.name),
      'aria-pressed': s.name === shown ? 'true' : 'false',
      onClick: function () { setPick({ sel: sel, chart: chart, name: s.name }); }
    }, s.name, !minor && s.brightness ? h('sup', null, s.brightness) : null, chartNatalSeal(s), chartScopeSeal(s, mu, prefix));
  };
  const sep = t('chartListSep');
  const minors = [];
  p.minor.forEach(function (s, k) {
    if (k) minors.push(sep);
    minors.push(starButton(s, true));
  });
  /* 三方四正每一宫带上它的主星；宫干四化是这一宫的天干让哪四颗星化禄权科忌、各落在哪一宫（24-scope 的 palaceFacts） */
  const facts = palaceFacts(chart, sel);
  const palaceLink = function (idx, name) {
    return h('button', { type: 'button', className: 'zp-kv-link', onClick: function () { appStore().selectPalace(idx); } }, name);
  };
  /* 一宫一组：宫名（可点）+ 它的主星。三合的两宫放在同一个 dd 里，放不下自己换行 */
  const palGroup = function (x) {
    return h('span', { className: 'zp-kv-pal' }, palaceLink(x.index, x.name),
      h('span', { className: 'zp-kv-stars' }, x.stars.length ? x.stars.join(sep) : t('chartEmptyPalace')));
  };
  const range = p.decadal && p.decadal.range ? p.decadal.range : [0, 0];
  const rows = [h('dt', null, t('chartKvMinor')), minors.length ? chartEl('dd', null, minors) : h('dd', null, t('chartNone'))];
  if (m.adj) {
    const adj = chartAdjNames(p);
    rows.push(h('dt', null, t('chartKvAdj')), h('dd', null, adj.length ? adj.join(sep) : t('chartNone')));
  }
  rows.push(
    h('dt', null, t('chartKvOpp')), h('dd', { className: 'zp-kv-trio' }, palGroup(facts.trio[0])),
    h('dt', null, t('chartKvTri')), h('dd', { className: 'zp-kv-trio' }, palGroup(facts.trio[1]), palGroup(facts.trio[2])));
  if (facts.fly.length) {
    rows.push(h('dt', { className: 'zp-kv-fly' }, t('chartKvFly', { stem: facts.stem })),
      chartEl('dd', { className: 'zp-fly zp-kv-fly' }, facts.fly.map(function (x, k) {
        return h('span', null,
          h('b', { style: chartStarStyle(x.star) }, x.star), h('i', { className: CHART_SEAL_SCOPED[k] }, x.mu),
          x.index >= 0 ? palaceLink(x.index, x.palace) : null);
      })));
  }
  rows.push(h('dt', null, t('chartKvDecade')), h('dd', null, t('chartDecadeAges', { from: range[0], to: range[1] })));
  return h('section', { className: 'zp-card zp-detail', 'data-region': 'INSPECTOR' },
    h('div', { className: 'zp-card-h' },
      h('h3', { className: 'zp-serif' }, p.name, h('small', null, p.stem + p.branch)),
      h('span', { className: 'zp-theme' }, t('chartPalaceTheme', { theme: facts.theme })),
      scope ? h('span', { className: 'zp-tag' }, t('chartScopeTag', { prefix: prefix, palace: scope.palaceNames[sel] })) : null,
      h('div', { className: 'zp-card-right' },
        h('button', { type: 'button', className: 'zp-link', onClick: function () { chartAskPalace(chart, sel); } }, t('chartAskThisPalace')))),
    p.major.length ? chartEl('div', { className: 'zp-stars' }, p.major.map(function (s) { return starButton(s, false); })) : null,
    brief ? h('p', { className: 'zp-brief' }, brief) : null,
    chartEl('dl', { className: 'zp-kv' }, rows));
}

/* ---------------- 盘面 ---------------- */
function ChartBoard() {
  const scoped = useStore(chartScopedOf);
  const kids = useMemo(function () {
    const out = [];
    for (let i = 0; i < 12; i++) out.push(h(BoardCell, { key: i, i: i }));
    out.push(h(BoardCenter, { key: 'center' }), h(BoardLines, { key: 'lines' }));
    return out;
  }, []);
  return h('div', { className: 'zp-board' + (scoped ? ' zp-scoped' : ''), 'data-region': 'BOARD' }, kids);
}

/* 一格里的字：宫名（命 / 身）、运限宫名、干支、主星（亮度、四化印）、辅星、杂曜、大限岁数和两个十二神 */
function chartCellInner(chart, i, scope, tab, adj) {
  const p = chart.palaces[i];
  const mu = chartScopeMu(scope);
  const prefix = scope ? t(CHART_PREFIX_KEYS[tab]) : '';
  const star = function (s) {
    return h('span', { className: 'zp-star', style: chartStarStyle(s.name) },
      s.name, s.brightness ? h('sup', null, s.brightness) : null, chartNatalSeal(s), chartScopeSeal(s, mu, prefix));
  };
  const minor = function (s) {
    return h('span', { className: CHART_GOOD_KINDS.indexOf(s.kind) >= 0 ? 'zp-good' : 'zp-bad' },
      s.name, chartNatalSeal(s), chartScopeSeal(s, mu, prefix));
  };
  const adjNames = adj ? chartAdjNames(p) : [];
  const range = p.decadal && p.decadal.range ? p.decadal.range[0] + '–' + p.decadal.range[1] : '';
  return [
    h('div', { key: 'head', className: 'zp-cell-head' },
      h('span', { className: 'zp-pname' }, p.name,
        i === chart.soulIndex ? h('span', { className: 'zp-mk' }, t('chartMarkSoul')) : null,
        i === chart.bodyIndex ? h('span', { className: 'zp-mk zp-mk-body' }, t('chartMarkBody')) : null),
      scope ? h('span', { className: 'zp-scope-tag' }, t('chartScopeTag', { prefix: prefix, palace: scope.palaceNames[i] })) : null,
      h('span', { className: 'zp-gz' }, p.stem + p.branch)),
    p.major.length ? chartEl('div', { key: 'majors', className: 'zp-majors' }, p.major.map(star))
      : h('div', { key: 'majors', className: 'zp-majors' }, h('span', { className: 'zp-empty-p' }, t('chartEmptyPalace'))),
    p.minor.length ? chartEl('div', { key: 'minors', className: 'zp-minors' }, p.minor.map(minor)) : null,
    adjNames.length ? h('div', { key: 'adj', className: 'zp-adj' }, adjNames.join(' ')) : null,
    h('div', { key: 'foot', className: 'zp-cell-foot' },
      h('span', { className: 'zp-dec' }, range),
      h('span', { className: 'zp-gods' }, [p.changsheng12, p.boshi12].filter(Boolean).join('·')))
  ];
}

function BoardCell(props) {
  const i = props.i;
  const m = useStore(function (s, store) { return chartCellOf(s, store, i); });
  const chart = useMemo(function () { return chartOfEntry(m.entry); }, [m.entry]);
  const scope = chart ? chartScopeLayer(m.tab) : null;
  /* 格子里的字只随命盘、这一层运限（页签 + 运限命宫 + 四化）和杂曜开关变；选宫时原样复用 */
  const sig = scope ? m.tab + '|' + scope.index + '|' + scope.mutagen.join(',') : '';
  const inner = useMemo(function () {
    return chart ? chartCellInner(chart, i, scope, m.tab, m.adj) : null;
  }, [chart, sig, m.adj]);
  if (!chart) return null;
  return h('button', {
    type: 'button', 'data-i': i,
    className: 'zp-cell' + (m.rel ? ' zp-rel' : '') + (scope && scope.index === i ? ' zp-scope-focus' : ''),
    'aria-pressed': m.on ? 'true' : 'false', 'aria-label': palaceLabel(chart.palaces[i]), tabIndex: m.on ? 0 : -1,
    style: CHART_CELL_STYLE[i],
    onClick: function () { appStore().selectPalace(i); },
    onKeyDown: function (ev) { chartCellKey(ev, i); }
  }, inner);
}

/* ---------------- 中宫 ---------------- */
function BoardCenter() {
  const m = useStore(chartTimeOf);
  const chart = useMemo(function () { return chartOfEntry(m.entry); }, [m.entry]);
  if (!chart) return null;
  const scope = chartScopeLayer(m.tab);
  const input = m.entry.input || {};
  const sc = chart.meta ? chart.meta.solarCorrection : null;
  const birth = [String(chart.solarDate || '').replace(/-/g, '.'), t('chartLunarDate', { date: ZWREPORT.lunarOf(chart) }), chart.timeName];
  if (input.place) birth.push(String(input.place));
  const facts = [
    h('span', null, h('b', null, chart.fiveElementsClass), ' · ', t(chartYinYangKey(chart))),
    h('span', null, t('chartFactSoulMaster'), ' ', h('b', null, chart.soulMaster), ' · ', t('chartFactBodyMaster'), ' ', h('b', null, chart.bodyMaster)),
    h('span', null, t('chartFactStart'), ' ', h('b', null, t('chartFactAge', { age: chart.startAge }))),
    /* 校正后的钟点；这张盘选了不校正写「不校正」；没填城市、没东西可校正写「未校正」 */
    h('span', null, t('chartFactSolarTime'), ' ', h('b', null, sc && sc.solarTime ? sc.solarTime
      : t(input.settings && input.settings.trueSolar === false ? 'chartFactSolarOff' : 'chartFactUncorrected')))
  ];
  if (scope) facts.push(h('span', null, scopeTabName(m.tab), ' ', h('b', null, scope.stem + scope.branch)));
  /* 字都放在一块牌子（div.zp-plate）上：三方四正的连线从牌子下面穿过，不压在字上 */
  return h('div', { className: 'zp-center' },
    h('div', { className: 'zp-plate' },
      h('div', { className: 'zp-nm' },
        h('i', { className: 'zp-orb', 'aria-hidden': true, style: chartStarStyle(soulStars(chart).names[0]) }),
        String(m.entry.name || '') || t('headUnnamed')),
      h('div', { className: 'zp-birth' }, birth.join(' · ')),
      chartEl('div', { className: 'zp-pillars', role: 'group', 'aria-label': t('chartPillars') }, CHART_PILLARS.map(function (k) {
        return h('span', null, chart.pillars[k[0]], h('small', null, t(k[1])));
      })),
      chartEl('div', { className: 'zp-facts' }, facts),
      sc && sc.boundaryWarning ? h('p', { className: 'zp-warn' }, t('chartBoundaryWarn')) : null,
      h(PatternCenter, null)));
}

/* ---------------- 三方四正连线 ---------------- */
/* 十二个宫格相对盘面的矩形；盘面没显示（看报告时 hidden、宽度 0）返回 null，留着上一次的线 */
function chartLineRects(boardEl) {
  if (!boardEl || typeof boardEl.getBoundingClientRect !== 'function' || typeof boardEl.querySelector !== 'function') return null;
  const br = boardEl.getBoundingClientRect();
  if (!(br.width > 0) || !(br.height > 0)) return null;
  const rects = [];
  for (let i = 0; i < 12; i++) {
    const el = boardEl.querySelector('[data-i="' + i + '"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    rects.push({ left: r.left - br.left, top: r.top - br.top, width: r.width, height: r.height });
  }
  return rects;
}

/* key 没变就还是原来那份（不重渲染）；选中宫没变（只是位置变了）或第一次画：zp-still、g 不换；换了宫：g 换 key、播描线 */
function chartNextDraw(prev, lp) {
  if (prev && prev.key === lp.key) return prev;
  const still = !prev || prev.sel === lp.sel;
  return { key: lp.key, sel: lp.sel, points: lp.points, still: still, flip: prev ? (still ? prev.flip : !prev.flip) : false };
}

function chartRedraw(svg, sel, setDraw) {
  const rects = chartLineRects(svg ? svg.parentNode : null);
  const lp = rects ? linePoints(rects, sel) : null;
  if (lp) setDraw(function (prev) { return chartNextDraw(prev, lp); });
}

function chartPt(q) {
  return q[0].toFixed(1) + ' ' + q[1].toFixed(1);
}

function BoardLines() {
  const sel = useStore(chartSelOf);
  const [draw, setDraw] = useState(null);
  const svgRef = useRef(null);
  const selRef = useRef(sel);
  /* 盘面是父元素，它的 ref 在子组件的 layout effect 之后才挂上；所以从自己的 svg 往上找盘面 */
  useLayoutEffect(function () {
    selRef.current = sel;
    chartRedraw(svgRef.current, sel, setDraw);
  }, [sel]);
  useLayoutEffect(function () {
    const svg = svgRef.current;
    const boardEl = svg ? svg.parentNode : null;
    if (!boardEl || typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(function () { chartRedraw(svg, selRef.current, setDraw); });
    ro.observe(boardEl);
    return function () { ro.disconnect(); };
  }, []);
  let g = null;
  if (draw) {
    const a = draw.points[0], o = draw.points[1], t1 = draw.points[2], t2 = draw.points[3];
    g = h('g', { key: draw.flip ? 'draw-b' : 'draw-a' },
      h('path', { d: 'M' + chartPt(a) + ' L' + chartPt(t1) + ' L' + chartPt(t2) + ' Z' }),
      h('path', { className: 'zp-dash', d: 'M' + chartPt(a) + ' L' + chartPt(o) }),
      h('circle', { cx: a[0], cy: a[1], r: 3.5 }),
      h('circle', { cx: o[0], cy: o[1], r: 2.5 }),
      h('circle', { cx: t1[0], cy: t1[1], r: 2.5 }),
      h('circle', { cx: t2[0], cy: t2[1], r: 2.5 }));
  }
  return h('svg', { className: 'zp-lines' + (draw && draw.still ? ' zp-still' : ''), 'aria-hidden': true, ref: svgRef }, g);
}
