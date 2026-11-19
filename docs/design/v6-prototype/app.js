/* 紫微斗数 v6 原型：界面逻辑。排盘用真实引擎（window.ZWEngine），紫微师的回答是本地拼的示例文字。 */
(function () {
  'use strict';
  const E = window.ZWEngine, Sky = window.ZWSky, R = window.ZWReportV6;
  const $ = id => document.getElementById(id);
  const app = $('app');
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const isDark = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); };
  const bgColor = () => (isDark() ? '#151517' : '#ffffff');

  /* 报告正文的样式和星曜颜色变量，由 report.js 给出；这里按页面主题挂上去 */
  (function () {
    const st = document.createElement('style');
    st.textContent = '.zr-scope{' + R.FONTS + R.LIGHT + '}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .zr-scope{' + R.DARK + '}}:root[data-theme="dark"] .zr-scope{' + R.DARK + '}' + R.PROSE_CSS;
    document.head.appendChild(st);
  })();

  /* ================= 数据与文字 ================= */
  const COLOR_LIGHT = R.STAR_LIGHT, COLOR_DARK = R.STAR_DARK;
  const starColor = n => (isDark() ? COLOR_DARK : COLOR_LIGHT)[n] || '';
  const MINOR_GOOD = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺', '禄存', '天马'];
  const MU_KIND = { 禄: 'lu', 权: 'quan', 科: 'ke', 忌: 'ji' };
  const MU_ORDER = ['禄', '权', '科', '忌'];
  const CELL_POS = { 3: [1, 1], 4: [2, 1], 5: [3, 1], 6: [4, 1], 2: [1, 2], 7: [4, 2], 1: [1, 3], 8: [4, 3], 0: [1, 4], 11: [2, 4], 10: [3, 4], 9: [4, 4] };
  const THEME = { 命宫: '你自己', 兄弟: '兄弟和同辈', 夫妻: '伴侣与感情', 子女: '子女和创作', 财帛: '钱和收入', 疾厄: '身体',
    迁移: '出门和外面的人', 仆役: '朋友与合作', 官禄: '工作', 田宅: '家和住处', 福德: '心情和兴趣', 父母: '长辈与文书' };
  const LM = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const SC = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const lunarDay = d => d <= 10 ? '初' + CN[d] : d < 20 ? '十' + CN[d - 10] : d === 20 ? '二十' : d < 30 ? '廿' + CN[d - 20] : '三十';
  const lunarText = s => { const p = String(s).split('-'); return LM[+p[1] - 1] + '月' + lunarDay(+p[2]); };
  const CITY = { 北京: 116.4, 天津: 117.2, 上海: 121.5, 重庆: 106.5, 石家庄: 114.5, 太原: 112.5, 呼和浩特: 111.7, 沈阳: 123.4, 长春: 125.3, 哈尔滨: 126.5,
    南京: 118.8, 杭州: 120.2, 合肥: 117.3, 福州: 119.3, 南昌: 115.9, 济南: 117.0, 郑州: 113.6, 武汉: 114.3, 长沙: 112.9, 广州: 113.3, 南宁: 108.4, 海口: 110.3,
    成都: 104.1, 贵阳: 106.6, 昆明: 102.7, 拉萨: 91.1, 西安: 108.9, 兰州: 103.8, 西宁: 101.8, 银川: 106.2, 乌鲁木齐: 87.6, 香港: 114.2, 澳门: 113.5, 台北: 121.6,
    深圳: 114.1, 苏州: 120.6, 宁波: 121.6, 厦门: 118.1, 青岛: 120.4, 大连: 121.6, 佛山: 113.1, 东莞: 113.8, 珠海: 113.6, 无锡: 120.3, 温州: 120.7, 泉州: 118.7 };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pad = n => ('0' + n).slice(-2);
  const now = new Date();
  const TODAY = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  const ymd = d => ({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
  const dnum = w => Math.round(new Date(w.y, w.m - 1, w.d).getTime() / 86400000);
  const stSpan = n => '<span class="st" style="--c:' + starColor(n) + '">' + esc(n) + '</span>';
  const cache = {};
  function chartOf(e) { if (!cache[e.id]) { const c = E.computeChart(e.input); if (!c || c.error) return null; cache[e.id] = { c: c, h: E.computeHoroscope(c, TODAY) }; } return cache[e.id].c; }
  const todayOf = e => (chartOf(e) ? cache[e.id].h : null);
  const majorsOf = (c, i) => c.palaces[i].major.map(s => s.name);
  /* 命宫主星；空宫就借对宫 */
  function soulStar(c) { const m = majorsOf(c, c.soulIndex); if (m.length) return { names: m, borrowed: false }; return { names: majorsOf(c, (c.soulIndex + 6) % 12), borrowed: true }; }

  /* ================= 存储（只在本浏览器） ================= */
  const KEY = 'zw-v6-proto';
  const mkS = (id, name, place, y, m, d, hh, mm, g, lon) => ({ id: id, name: name, sample: true, place: place, input: { calendar: 'solar', year: y, month: m, day: d, hour: hh, minute: mm, gender: g, longitude: lon } });
  const SAMPLES = [
    mkS('s1', '小林', '东经 105.97°', 1992, 5, 3, 9, 30, 'male', 105.97),
    mkS('s2', '阿青', '上海', 1990, 6, 15, 15, 30, 'female', 121.5),
    mkS('s3', '小满', '成都', 1996, 5, 21, 6, 10, 'female', 104.1),
    mkS('s4', '阿岚', '杭州', 1988, 11, 2, 21, 40, 'female', 120.2),
    mkS('s5', '阿砚', '广州', 1989, 7, 17, 5, 50, 'female', 113.3)
  ];
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  const stored = Object.assign({ charts: [], hidden: [], names: {}, focus: '' }, load() || {});
  const S = { scene: stored.scene || 'returning', charts: [], view: 'home', onboarding: false, step: 0, data: {}, calMode: 'solar', focusId: stored.focus || '', hoverId: null, menuId: null,
    current: null, chart: null, h: null, when: TODAY, tab: 'natal', stage: 'board', sel: 0, pat: 0, pane: 'scope', panel: false, msgs: [], quote: null, streaming: false, leaving: false };
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ scene: S.scene, charts: stored.charts, hidden: stored.hidden, names: stored.names, focus: S.focusId })); } catch (e) { /* 隐私模式 */ } }
  const nameOf = e => (e.sample && stored.names[e.id]) || e.name || '未命名';
  const byId = id => S.charts.filter(e => e.id === id)[0] || null;
  function rebuildCharts() {
    const samples = SAMPLES.filter(s => stored.hidden.indexOf(s.id) < 0);
    S.charts = (S.scene === 'returning' ? stored.charts.concat(samples) : stored.charts.slice()).filter(e => chartOf(e));
    if (!byId(S.focusId)) S.focusId = S.charts.length ? S.charts[0].id : '';
  }

  /* ================= 顶栏 ================= */
  const TABS = [['natal', '本命'], ['decadal', '大限'], ['yearly', '流年'], ['monthly', '流月'], ['daily', '流日']];
  const TABNAME = { natal: '本命', decadal: '大限', yearly: '流年', monthly: '流月', daily: '流日' };
  const PREFIX = { decadal: '限', yearly: '年', monthly: '月', daily: '日' };
  function renderHead() {
    const hd = $('head');
    const exit = '<button class="icon-btn" type="button" id="exitBtn" title="返回会话" aria-label="返回会话"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 6l-6 6 6 6M4 12h11a5 5 0 0 1 0 10h-2"/></svg></button>';
    const gear = '<button class="icon-btn" type="button" id="gearBtn" title="设置" aria-label="设置"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg></button>';
    if (S.view === 'home') hd.innerHTML = exit + '<div class="grow"></div>' + gear;
    else {
      const e = S.current, st = soulStar(S.chart);
      hd.innerHTML = exit +
        '<nav class="crumb" aria-label="位置"><button type="button" id="toHome">星图</button><span>/</span><i class="orb" style="--c:' + (COLOR_DARK[st.names[0]] || '#b4c3cb') + '"></i><b>' + esc(nameOf(e)) + '</b>' + (e.sample ? '<span class="sample">示例</span>' : '') + '</nav>' +
        '<div class="grow"></div>' +
        '<div class="seg" role="tablist" aria-label="看什么">' + TABS.map(t => '<button type="button" role="tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') +
        '<i class="sep" aria-hidden="true"></i><button type="button" role="tab" data-tab="report">报告</button></div>' +
        '<button class="btn-primary" type="button" id="openTalk">问紫微师</button>' + gear;
      $('toHome').onclick = goHome;
      hd.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => setTab(b.getAttribute('data-tab')); });
      $('openTalk').onclick = () => setPanel(true);
      syncHead();
    }
    $('exitBtn').onclick = () => toast('回到 DSH 的对话（插件里会切回会话页）');
    $('gearBtn').onclick = () => toast('原型里不展开设置');
  }
  function syncHead() {
    const cur = S.stage === 'report' ? 'report' : S.tab;
    document.querySelectorAll('#head [data-tab]').forEach(b => { const on = b.getAttribute('data-tab') === cur; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    syncReportMarks();
  }

  /* ================= 首页：对话引导 ================= */
  const STEPS = [
    { key: 'name', ask: () => '我是紫微师。<br><strong>先说说，怎么称呼你？</strong>', ph: '称呼，比如 小林', chips: ['跳过'],
      parse: v => { if (!v || v === '跳过') return { value: '', show: '未填称呼' }; return v.length > 12 ? { err: '称呼短一点，12 个字以内' } : { value: v, show: v }; } },
    { key: 'date', ask: d => (d.name && d.name.value ? esc(d.name.value) + '，' : '') + '<strong>哪天出生的？</strong><br>公历、农历都可以。', ph: '比如 1990年6月15日，或 农历1990年五月廿三', chips: [], parse: parseDate },
    { key: 'time', ask: () => '<strong>几点出生？</strong><br>记不清，就选个时辰。', ph: '比如 下午三点半、15:30、申时', parse: parseTime,
      chips: ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时', '不知道'] },
    { key: 'gender', ask: () => '<strong>男生还是女生？</strong>', ph: '男 或 女', chips: ['男', '女'],
      parse: v => /男/.test(v) ? { value: 'male', show: '男' } : /女/.test(v) ? { value: 'female', show: '女' } : { err: '点一下「男」或「女」' } },
    { key: 'city', ask: () => '<strong>在哪个城市出生？</strong><br>用来校正出生时间，不填也行。', ph: '城市名，或直接填经度',
      chips: ['北京', '上海', '广州', '深圳', '成都', '杭州', '武汉', '西安', '跳过'], parse: parseCity },
    { key: 'confirm', ask: d => '好，我来排这张盘：<br><strong>' + esc((d.name.value ? d.name.value + '，' : '') + d.date.show + ' ' + d.time.short + '，' + d.gender.show + (d.city.value ? '，' + d.city.show : '')) + '</strong>',
      ph: '', chips: ['排盘', '重新填'], parse: v => v === '重新填' ? { restart: true } : { value: true } }
  ];
  function parseDate(raw) {
    let v = raw.replace(/\s+/g, ''), lunar = S.calMode === 'lunar' || /农历|阴历/.test(v);
    if (/公历|阳历/.test(v)) lunar = false;
    v = v.replace(/农历|阴历|公历|阳历/g, ''); const leap = /闰/.test(v); v = v.replace('闰', '');
    let y, m, d, mm;
    if ((mm = v.match(/^(\d{2}|\d{4})[年.\-\/](\d{1,2})[月.\-\/](\d{1,2})[日号]?$/))) { y = +mm[1]; m = +mm[2]; d = +mm[3]; }
    else if ((mm = v.match(/^(\d{2}|\d{4})年?(十一|十二|正|一|二|三|四|五|六|七|八|九|十|冬|腊)月(初[一二三四五六七八九十]|十[一二三四五六七八九]?|二十|廿[一二三四五六七八九]|三十|\d{1,2})[日号]?$/))) {
      const MW = { 正: 1, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 冬: 11, 十二: 12, 腊: 12 };
      y = +mm[1]; m = MW[mm[2]];
      if (/^\d+$/.test(mm[3])) d = +mm[3]; else { const DW = { 十: 10 }; for (let i = 1; i <= 30; i++) DW[lunarDay(i)] = i; d = DW[mm[3]]; }
      lunar = true;
    } else return { err: '没读懂这个日期。试试「1990年6月15日」或「农历1990年五月廿三」' };
    if (y < 100) y += y > 30 ? 1900 : 2000;
    if (y < 1900 || y > 2100) return { err: '年份要在 1900 到 2100 之间' };
    if (!(m >= 1 && m <= 12)) return { err: '月份要在 1 到 12 之间' };
    if (lunar) {
      if (leap && E.leapMonth(y) !== m) return { err: y + ' 年没有闰' + LM[m - 1] + '月' };
      const days = E.lunarMonthDays(y, m, leap);
      if (!(d >= 1 && d <= days)) return { err: '农历' + y + '年' + (leap ? '闰' : '') + LM[m - 1] + '月只有 ' + days + ' 天' };
      return { value: { lunar: true, y: y, m: m, d: d, leap: leap }, show: '农历' + y + '年' + (leap ? '闰' : '') + LM[m - 1] + '月' + lunarDay(d) };
    }
    const dt = new Date(y, m - 1, d);
    if (dt.getMonth() !== m - 1 || dt.getDate() !== d) return { err: y + '年' + m + '月没有' + d + '日' };
    return { value: { lunar: false, y: y, m: m, d: d, leap: false }, show: y + '年' + m + '月' + d + '日' };
  }
  const shichen = h => SC[Math.floor(((h + 1) % 24) / 2)] + '时';
  function parseTime(raw) {
    const v = raw.replace(/\s+/g, '');
    if (/不知道|不清楚|不记得|不详/.test(v)) return { value: { h: 12, m: 0, unknown: true }, show: '时辰不详', short: '时辰不详（先按午时）' };
    let mm = v.match(/^(早|晚)?([子丑寅卯辰巳午未申酉戌亥])时?$/);
    if (mm) { const idx = SC.indexOf(mm[2]), h = idx === 0 ? (mm[1] === '晚' ? 23 : 0) : idx * 2; return { value: { h: h, m: idx === 0 ? 30 : 0 }, show: (mm[1] || '') + mm[2] + '时', short: (mm[1] || '') + mm[2] + '时' }; }
    mm = v.match(/^(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里)?(\d{1,2})(?:[:：点时](\d{1,2}|半)?分?)?$/);
    if (!mm) {
      const CNH = { 零: 0, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 };
      const m2 = v.match(/^(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里)?(十一|十二|十|两|[零一二三四五六七八九])点(半|一刻|三刻)?$/);
      if (!m2) return { err: '没读懂这个时间。试试「15:30」「下午三点半」，或点一个时辰' };
      mm = [m2[0], m2[1], String(CNH[m2[2]]), m2[3] === '半' ? '30' : m2[3] === '一刻' ? '15' : m2[3] === '三刻' ? '45' : ''];
    }
    let hh = +mm[2]; const mn = mm[3] === '半' ? 30 : +(mm[3] || 0), per = mm[1] || '';
    if (/下午|傍晚|晚上|夜里/.test(per) && hh < 12) hh += 12;
    if (per === '中午' && hh < 6) hh += 12;
    if (/凌晨/.test(per) && hh === 12) hh = 0;
    if (hh > 23 || mn > 59) return { err: '时间超出范围了' };
    const s = pad(hh) + ':' + pad(mn);
    return { value: { h: hh, m: mn }, show: s + '（' + shichen(hh) + '）', short: s + ' ' + shichen(hh) };
  }
  function parseCity(raw) {
    const v = raw.trim();
    if (!v || v === '跳过') return { value: null, show: '未填出生地' };
    const num = v.replace(/^东经\s*/, '').replace(/\s*(°|度)?\s*(E|东)?$/i, '');
    if (/^\d+(\.\d+)?$/.test(num)) { const x = +num; return x >= 60 && x <= 140 ? { value: { lon: x, name: '东经 ' + x + '°' }, show: '东经 ' + x + '°' } : { err: '经度要在 60 到 140 之间' }; }
    let best = null; Object.keys(CITY).forEach(c => { if (v.indexOf(c) >= 0 && (!best || c.length > best.length)) best = c; });
    return best ? { value: { lon: CITY[best], name: best }, show: best } : { err: '没找到「' + v + '」。换个写法，或直接填经度（如 116.4）；也可以跳过' };
  }

  /* ================= 首页 ================= */
  let statusFor = '';
  function renderStatus(force) {
    const e = byId(S.hoverId) || byId(S.focusId) || S.charts[0]; if (!e) return;
    const key = e.id + '|' + isDark() + '|' + nameOf(e); if (key === statusFor && !force) return; statusFor = key;
    const c = chartOf(e), h = todayOf(e), focus = c.palaces[h.daily.index].name;
    $('status').innerHTML = '<span class="fade-in">' + esc(nameOf(e)) + '，今天流日命宫走到你的<strong>' + esc(focus) + '</strong>，' +
      stSpan(h.daily.mutagen[0]) + '化禄，' + stSpan(h.daily.mutagen[3]) + '化忌。重心在<strong>' + esc(THEME[focus]) + '</strong>。</span>';
  }
  function renderHome() {
    const ref = S.charts[0] ? todayOf(S.charts[0]) : E.computeHoroscope(E.computeChart(SAMPLES[0].input), TODAY);
    $('dateLine').innerHTML = TODAY.m + '月' + TODAY.d + '日 · 农历' + lunarText(ref.lunarDate) + ' · <b>' + ref.daily.stem + ref.daily.branch + '日</b>';
    const status = $('status'), input = $('ask'), rec = $('receipts');
    rec.innerHTML = ''; $('chips').innerHTML = '';
    app.classList.toggle('onboarding', S.onboarding);
    if (S.onboarding) {
      const st = STEPS[S.step]; statusFor = '';
      status.innerHTML = '<span class="fade-in">' + st.ask(S.data) + '</span>';
      input.placeholder = st.ph || '点下面的按钮'; input.disabled = st.key === 'confirm'; $('askSend').disabled = st.key === 'confirm';
      STEPS.slice(0, S.step).forEach((s, i) => {
        const a = S.data[s.key]; if (!a) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'receipt'; b.title = '改这一项';
        b.innerHTML = { name: '称呼', date: '生日', time: '时间', gender: '性别', city: '城市' }[s.key] + ' <b>' + esc(a.show) + '</b>';
        b.onclick = () => { S.step = i; renderHome(); input.focus(); };
        rec.appendChild(b);
      });
      if (st.key === 'date') [['solar', '公历'], ['lunar', '农历']].forEach(m => chip(m[1], () => { S.calMode = m[0]; renderHome(); input.focus(); }, S.calMode === m[0] ? 'on' : ''));
      (st.chips || []).forEach(c => {
        let label = c;
        if (st.key === 'time' && c !== '不知道') { const i2 = SC.indexOf(c.charAt(0)); label = c + '<small>' + (i2 === 0 ? '23–1' : (i2 * 2 - 1) + '–' + (i2 * 2 + 1)) + '</small>'; }
        chip(label, () => answer(c), c === '排盘' ? 'primary' : '');
      });
      if (S.charts.length) chip('取消', () => { S.onboarding = false; render(); });
    } else {
      renderStatus(true);
      input.placeholder = '问紫微师'; input.disabled = false; $('askSend').disabled = false;
      const cur = () => byId(S.focusId) || S.charts[0];
      chip('看今天', () => openChart(cur(), 'daily'));
      chip('这十年要注意什么', () => openChart(cur(), 'decadal', '这十年要注意什么'));
      chip('排一张新盘', () => { S.onboarding = true; S.step = 0; S.data = {}; renderHome(); input.focus(); });
    }
    syncPlanets();
    hint('');
  }
  /* 星球本身是 WebGL 画的；这里只管名字标签和它背后的数据 */
  let planetSig = '';
  function skyItem(e) {
    const c = chartOf(e), h = todayOf(e), st = soulStar(c), beads = [], names = [];
    c.palaces.forEach(p => { const b = SC.indexOf(p.branch); names[b] = p.name; p.major.forEach((s, k) => beads.push({ name: s.name, b: b, k: k, n: p.major.length, color: COLOR_DARK[s.name], big: /庙|旺/.test(s.brightness || '') })); });
    return { id: e.id, star: st.names[0] || '', color: COLOR_DARK[st.names[0]] || '#b4c3cb', beads: beads, names: names, ming: SC.indexOf(c.palaces[c.soulIndex].branch), today: SC.indexOf(c.palaces[h.daily.index].branch) };
  }
  function syncPlanets() {
    const list = S.charts.slice(0, 8), sig = list.map(e => e.id + ':' + nameOf(e)).join('|') + '|' + isDark();
    if (sig !== planetSig) { planetSig = sig; renderTags(list); Sky.setPlanets(list.map(skyItem)); Sky.layers($('planets'), $('reticle'), document.querySelector('.col')); }
    Sky.focus(S.focusId);
  }
  function renderTags(list) {
    const box = $('planets'); box.innerHTML = ''; S.menuId = null;
    list.forEach(e => {
      const c = chartOf(e), st = soulStar(c);
      const tag = document.createElement('div'); tag.className = 'ptag'; tag.setAttribute('data-pid', e.id); tag.style.setProperty('--c', COLOR_DARK[st.names[0]] || '#b4c3cb');
      tag.innerHTML = '<div class="ptag-in"><button type="button" class="ptag-main" aria-label="打开 ' + esc(nameOf(e)) + ' 的命盘"><b>' + esc(nameOf(e)) + '</b><span>' + c.solarDate.replace(/-/g, '.') + (e.sample ? ' · 示例' : '') + '</span>' +
        '<i>' + (st.borrowed ? '命宫空宫，借' + esc(st.names.join('、')) : esc(st.names.join('、')) + '坐命') + ' · ' + esc(c.fiveElementsClass) + '</i></button>' +
        '<button type="button" class="ptag-more" aria-label="给 ' + esc(nameOf(e)) + ' 改名或删除"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>' +
        '<div class="ptag-menu" hidden></div></div>';
      const main = tag.querySelector('.ptag-main'), more = tag.querySelector('.ptag-more');
      tag.onmouseenter = () => preview(e.id); tag.onmouseleave = () => preview(null);
      main.onfocus = more.onfocus = () => preview(e.id); main.onblur = () => preview(null);
      main.onclick = () => openChart(e, 'daily');
      more.onclick = ev => { ev.stopPropagation(); if (S.menuId === e.id) closeMenu(); else openMenu(e, tag); };
      box.appendChild(tag);
    });
    markTags();
  }
  function markTags() { const on = S.menuId || S.hoverId; document.querySelectorAll('.ptag').forEach(t => t.classList.toggle('on', t.getAttribute('data-pid') === on)); }
  let prevTimer = 0;
  function preview(id, fromSky) {
    clearTimeout(prevTimer); if (S.menuId || S.onboarding || S.view !== 'home') return;
    const apply = () => { S.hoverId = id; if (!fromSky) Sky.hover(id); markTags(); renderStatus(); };
    if (id) apply(); else prevTimer = setTimeout(apply, 280);
  }
  function closeMenu() { if (!S.menuId) return; document.querySelectorAll('.ptag-menu').forEach(m => { m.hidden = true; m.innerHTML = ''; }); S.menuId = null; preview(null); }
  function openMenu(e, tag) {
    closeMenu(); clearTimeout(prevTimer); S.hoverId = e.id; S.menuId = e.id; Sky.hover(e.id); markTags(); renderStatus();
    const m = tag.querySelector('.ptag-menu'); m.hidden = false;
    const base = () => { m.innerHTML = '<button type="button" data-a="rename">改名</button><button type="button" data-a="del" class="danger">删除</button>'; };
    base();
    m.onclick = ev => {
      const a = ev.target.getAttribute && ev.target.getAttribute('data-a'); if (!a) return; ev.stopPropagation();
      if (a === 'rename') { m.innerHTML = '<input id="renameInput" type="text" maxlength="12" aria-label="新的称呼" value="' + esc(nameOf(e)) + '"><button type="button" data-a="save">保存</button>'; const inp = m.querySelector('input'); inp.focus(); inp.select(); inp.onkeydown = k => { if (k.key === 'Enter' && !k.isComposing) { k.preventDefault(); rename(e, inp.value); } }; }
      else if (a === 'save') rename(e, m.querySelector('input').value);
      else if (a === 'del') m.innerHTML = '<span>删除「' + esc(nameOf(e)) + '」？</span><button type="button" data-a="yes" class="danger">删除</button><button type="button" data-a="no">取消</button>';
      else if (a === 'no') base();
      else if (a === 'yes') remove(e);
    };
  }
  function rename(e, v) { v = String(v || '').trim().slice(0, 12); if (!v) { closeMenu(); return; } if (e.sample) stored.names[e.id] = v; else e.name = v; S.menuId = null; save(); renderHome(); toast('已改名为「' + v + '」'); }
  function remove(e) {
    const nm = nameOf(e); if (e.sample) stored.hidden.push(e.id); else stored.charts = stored.charts.filter(x => x.id !== e.id);
    S.menuId = null; S.hoverId = null; Sky.hover(null); rebuildCharts(); if (!S.charts.length) { S.onboarding = true; S.step = 0; S.data = {}; } save(); renderHome(); toast('已删除「' + nm + '」');
  }
  document.addEventListener('pointerdown', ev => { if (S.menuId && !(ev.target.closest && ev.target.closest('.ptag'))) closeMenu(); });
  function chip(html, fn, cls) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (cls ? ' ' + cls : ''); b.innerHTML = html; b.onclick = fn; $('chips').appendChild(b); }
  function hint(msg, err) { const h = $('hint'); h.textContent = msg || ''; h.className = 'hint' + (err ? ' err' : ''); }
  function answer(raw) {
    const st = STEPS[S.step], v = String(raw || '').trim(), r = st.parse(v);
    if (r.restart) { S.step = 0; S.data = {}; renderHome(); return; }
    if (r.err) { hint(r.err, true); return; }
    $('ask').value = '';
    if (st.key === 'confirm') { finish(); return; }
    S.data[st.key] = r;
    let next = S.step + 1; while (next < STEPS.length - 1 && S.data[STEPS[next].key]) next++;
    S.step = next; renderHome(); $('ask').focus();
  }
  function finish() {
    const d = S.data, dv = d.date.value;
    const input = { calendar: dv.lunar ? 'lunar' : 'solar', year: dv.y, month: dv.m, day: dv.d, isLeapMonth: dv.leap, hour: d.time.value.h, minute: d.time.value.m, gender: d.gender.value };
    if (d.city.value) input.longitude = d.city.value.lon;
    const entry = { id: 'u' + Date.now(), name: d.name.value, place: d.city.value ? d.city.value.name : '', input: input, timeUnknown: !!d.time.value.unknown };
    if (!chartOf(entry)) { hint('这个生辰排不出来，检查一下日期', true); return; }
    stored.charts = [entry].concat(stored.charts); rebuildCharts();
    S.onboarding = false; S.focusId = entry.id; save();
    /* 新盘 = 一颗新星：从紫微星里飞出来，落到自己的轨道上，再进去看盘 */
    app.classList.add('busy'); renderHome();
    Sky.birth(entry.id, () => openChart(entry, 'natal', null, true));
  }
  $('askForm').addEventListener('submit', e => {
    e.preventDefault(); const v = $('ask').value.trim();
    if (S.onboarding) { answer(v); return; }
    if (!v) return; $('ask').value = ''; openChart(byId(S.focusId) || S.charts[0], 'natal', v);
  });

  /* ================= 命盘页 ================= */
  function openChart(entry, tab, ask, fresh) {
    const c = entry && chartOf(entry); if (!c || S.leaving) return;
    S.leaving = true; closeMenu(); app.classList.add('busy');
    Sky.dive(entry.id, bgColor(), () => {
      S.leaving = false; S.current = entry; S.chart = c; S.when = TODAY; S.h = E.computeHoroscope(c, S.when); S.tab = tab || 'natal'; S.stage = 'board';
      S.sel = S.tab === 'natal' ? c.soulIndex : S.h[S.tab].index; S.pat = 0; S.pane = 'scope';
      S.view = 'chart'; S.msgs = []; S.quote = null; S.focusId = entry.id; S.hoverId = null; save(); render(); app.classList.remove('busy');
      /* 入场动画只在进入命盘时放一次；之后选宫、切层级、翻日期都不重放 */
      const ch = $('chart'); ch.classList.add('enter'); setTimeout(() => ch.classList.remove('enter'), 620);
      setTimeout(() => { if (S.view === 'chart') Sky.show(false); }, 520);
      if (fresh) { setPanel(true); bot(introText()); } else if (ask) { setPanel(true); userAsk(ask); }
    });
  }
  function goHome() {
    const id = S.current && S.current.id;
    closeExport(); S.view = 'home'; setPanel(false); app.classList.add('busy'); render();
    Sky.show(true); Sky.rise(id, bgColor());
    setTimeout(() => app.classList.remove('busy'), reduceMotion ? 0 : 750);
  }
  const rangeOf = h => S.chart.palaces[h.decadal.index].decadal.range;
  const scopeOf = () => (S.tab === 'natal' ? null : S.h[S.tab]);
  const muOf = scope => { const mu = {}; if (scope) scope.mutagen.forEach((n, i) => { mu[n] = MU_ORDER[i]; }); return mu; };
  const cellEl = i => $('board').querySelector('.cell[data-i="' + i + '"]');
  /* 现在看的这一段时间，用人话怎么叫 */
  function relWord() {
    const h = S.h, t = todayOf(S.current), w = S.when, lp = String(h.lunarDate).split('-'), tp = String(t.lunarDate).split('-');
    if (S.tab === 'daily') { const k = dnum(w) - dnum(TODAY); return k === 0 ? '今天' : k === 1 ? '明天' : k === -1 ? '昨天' : w.m + '月' + w.d + '日'; }
    if (S.tab === 'monthly') return lp[0] === tp[0] && lp[1] === tp[1] ? '这个月' : (lp[0] !== tp[0] ? lp[0] + '年' : '') + '农历' + LM[+lp[1] - 1] + '月';
    if (S.tab === 'yearly') { const k = +lp[0] - +tp[0]; return k === 0 ? '今年' : k === 1 ? '明年' : k === -1 ? '去年' : lp[0] + '年'; }
    if (S.tab === 'decadal') { const r = rangeOf(h); return r[0] === rangeOf(t)[0] ? '这十年' : r[0] + '–' + r[1] + ' 岁那十年'; }
    return '';
  }
  function whenLine() {
    const c = S.chart, h = S.h, w = S.when, lp = String(h.lunarDate).split('-');
    if (S.tab === 'daily') return w.m + '月' + w.d + '日 · 农历' + lunarText(h.lunarDate) + ' · <b>' + h.daily.stem + h.daily.branch + '日</b>';
    if (S.tab === 'monthly') return lp[0] + '年农历' + LM[+lp[1] - 1] + '月 · <b>' + h.monthly.stem + h.monthly.branch + '月</b>';
    if (S.tab === 'yearly') return lp[0] + '年 · <b>' + h.yearly.stem + h.yearly.branch + '年</b> · 虚岁 ' + h.nominalAge;
    if (S.tab === 'decadal') { const r = rangeOf(h); return r[0] + '–' + r[1] + ' 岁 · <b>' + h.decadal.stem + h.decadal.branch + '限</b>'; }
    const soul = c.palaces[c.soulIndex]; return '命宫 ' + soul.stem + soul.branch + ' · 身宫在' + c.palaces[c.bodyIndex].name;
  }
  function natalMutagen(c) { const out = ['', '', '', '']; c.palaces.forEach(p => p.major.concat(p.minor).forEach(s => { const i = MU_ORDER.indexOf(s.mutagen); if (i >= 0) out[i] = s.name; })); return out; }
  function shiftWhen(dir) {
    const c = S.chart, w = S.when; let d = new Date(w.y, w.m - 1, w.d);
    if (S.tab === 'daily') d.setDate(d.getDate() + dir);
    else if (S.tab === 'monthly') { const key = String(S.h.lunarDate).split('-').slice(0, 2).join('-'); d.setDate(d.getDate() + dir * 29); if (String(E.computeHoroscope(c, ymd(d)).lunarDate).split('-').slice(0, 2).join('-') === key) d.setDate(d.getDate() + dir); }
    else if (S.tab === 'yearly') d = new Date(w.y + dir, w.m - 1, Math.min(w.d, 28));
    else if (S.tab === 'decadal') d = new Date(w.y + dir * 10, w.m - 1, Math.min(w.d, 28));
    else return;
    const n = ymd(d), yb = +String(c.solarDate).slice(0, 4); let h2 = null;
    try { h2 = E.computeHoroscope(c, n); } catch (e) { h2 = null; }
    if (!h2 || n.y < yb || n.y > yb + 110 || !h2.decadal || !(h2.decadal.index >= 0) || !c.palaces[h2.decadal.index]) { toast(dir < 0 ? '再往前就到出生之前了' : '再往后就超出这张盘的范围了'); return; }
    S.when = n; S.h = h2; S.sel = h2[S.tab].index; updateScope();
  }
  const STEP_LABEL = { daily: ['前一天', '后一天'], monthly: ['上个月', '下个月'], yearly: ['上一年', '下一年'], decadal: ['上一个十年', '下一个十年'] };

  /* 整张盘的骨架只建一次。之后三种变化各改各的：
     选宫 → 十二个宫格的高亮、连线、宫位卡；切层级 / 翻日期 → 时间卡、宫格里的字、中宫；看报告 → 换一个舞台，盘面原样留着。 */
  function mountChart() {
    const c = S.chart; let cells = '';
    for (let i = 0; i < 12; i++) { const pos = CELL_POS[i], p = c.palaces[i]; cells += '<button type="button" class="cell" data-i="' + i + '" style="grid-column:' + pos[0] + ';grid-row:' + pos[1] + '" aria-label="' + esc(p.name + ' ' + p.stem + p.branch) + '"></button>'; }
    $('chart').innerHTML = '<div class="body" id="boardStage"><div class="side" id="side"><div class="panes" id="panes" role="tablist" aria-label="下面看什么"></div>' +
      '<section class="card scope" id="scopeCard"></section><section class="card pats" id="patsCard"></section><section class="card detail" id="detailCard"></section></div>' +
      '<div class="board-wrap"><div class="board" id="board">' + cells + '<div class="center" id="center"></div><svg class="lines" id="lines" aria-hidden="true"></svg></div></div></div>' +
      '<div class="rbody" id="reportStage" hidden><aside class="rside"><section class="card rtoc" id="rToc"></section></aside><div class="rmain" id="rMain"></div></div>';
    renderPats(); updateScope(); showStage();
  }
  function showStage() {
    const rep = S.stage === 'report';
    $('boardStage').hidden = rep; $('reportStage').hidden = !rep;
    if (rep) renderReport(); else requestAnimationFrame(drawLines);
  }
  function setTab(k) {
    if (k === 'report') S.stage = 'report';
    else { S.stage = 'board'; if (S.tab !== k) { S.tab = k; if (k !== 'natal') S.sel = S.h[k].index; S.pane = 'scope'; updateScope(); } }
    syncHead(); showStage();
  }
  function updateScope() {
    const c = S.chart, scope = scopeOf(), mu = muOf(scope);
    $('board').classList.toggle('scoped', !!scope);
    for (let i = 0; i < 12; i++) { const b = cellEl(i); b.innerHTML = cellInner(c, i, scope, mu); b.classList.toggle('focus', !!scope && i === scope.index); }
    renderScopeCard(); renderCenter(); updateSelection();
  }
  function updateSelection() {
    const rel = [(S.sel + 6) % 12, (S.sel + 4) % 12, (S.sel + 8) % 12];
    for (let i = 0; i < 12; i++) { const b = cellEl(i), on = i === S.sel; b.classList.toggle('sel', on); b.classList.toggle('rel', rel.indexOf(i) >= 0); b.tabIndex = on ? 0 : -1; b.setAttribute('aria-pressed', on); }
    renderDetail(); renderPanes(); drawLines();
  }
  function renderPanes() {
    $('side').setAttribute('data-pane', S.pane);
    $('panes').innerHTML = [['scope', TABNAME[S.tab]], ['pats', '格局'], ['detail', S.chart.palaces[S.sel].name]].map(t => '<button type="button" role="tab" data-pane="' + t[0] + '" class="' + (S.pane === t[0] ? 'on' : '') + '" aria-selected="' + (S.pane === t[0]) + '">' + esc(t[1]) + '</button>').join('');
  }
  /* 第一张卡：跟着顶上的本命 / 大限 / 流年 / 流月 / 流日走 */
  function renderScopeCard() {
    const c = S.chart, scope = scopeOf(), isNow = dnum(S.when) === dnum(TODAY), rel = relWord();
    const mut = scope ? scope.mutagen : natalMutagen(c);
    let line, actions;
    if (!scope) {
      const st = soulStar(c);
      line = (st.borrowed ? '命宫没有主星，借对宫的<b>' + esc(st.names.join('、')) + '</b>来看' : '命宫坐<b>' + esc(st.names.join('、')) + '</b>') + '，身宫在<b>' + esc(c.palaces[c.bodyIndex].name) + '</b>。';
      actions = '<button class="btn" type="button" data-act="read">读这张盘</button><button class="btn" type="button" data-act="report" id="fullReport">' + reportBtnLabel() + '</button>';
    } else {
      const pn = c.palaces[scope.index].name;
      line = esc(rel) + (/^(今天|明天|昨天|这个月|今年|明年|去年|这十年)$/.test(rel) ? '' : '，') + esc(TABNAME[S.tab]) + '命宫在<b>' + esc(pn) + '</b>，重心在' + esc(THEME[pn]) + '。';
      actions = '<button class="btn" type="button" data-act="read">解读' + esc(rel) + '</button>' + (isNow ? '' : '<button class="link" type="button" data-act="now">回到今天</button>');
    }
    const arrow = d => '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="' + d + '"/></svg>';
    $('scopeCard').innerHTML = '<div class="card-h"><h3>' + TABNAME[S.tab] + '</h3>' +
      (scope ? '<div class="right"><button class="step" type="button" data-act="prev" title="' + STEP_LABEL[S.tab][0] + '" aria-label="' + STEP_LABEL[S.tab][0] + '">' + arrow('M15 6l-6 6 6 6') + '</button>' +
        '<button class="step" type="button" data-act="next" title="' + STEP_LABEL[S.tab][1] + '" aria-label="' + STEP_LABEL[S.tab][1] + '">' + arrow('M9 6l6 6-6 6') + '</button></div>' : '') + '</div>' +
      '<p class="when">' + whenLine() + '</p><p class="line">' + line + '</p>' +
      '<div class="mut" aria-label="四化">' + mut.map((n, i) => n ? '<span title="' + esc(n) + '化' + MU_ORDER[i] + '"><b style="color:' + starColor(n) + '">' + esc(n) + '</b><i class="seal ' + MU_KIND[MU_ORDER[i]] + '">' + MU_ORDER[i] + '</i></span>' : '<span></span>').join('') + '</div>' +
      '<div class="card-f">' + actions + '</div>';
  }
  /* 第二张卡：格局简述。换格局只换高亮和那句说明 */
  let patList = [];
  function renderPats() {
    patList = E.detectPatterns(S.chart).slice(0, 6); if (S.pat >= patList.length) S.pat = 0;
    $('patsCard').innerHTML = '<div class="card-h"><h3>格局</h3><span class="cnt">' + (patList.length ? patList.length + ' 个' : '') + '</span></div>' +
      (patList.length ? '<div class="pat-chips">' + patList.map((x, i) => { const cls = x.level === '吉' ? 'ji' : x.level === '凶' ? 'xiong' : 'zhong'; return '<button type="button" class="pat" data-pat="' + i + '">' + esc(x.name) + '<i class="' + cls + '">' + esc(x.level) + '</i></button>'; }).join('') + '</div><p class="pat-desc" id="patDesc"></p>'
        : '<p class="pat-desc">这张盘没有明显的格局。</p>');
    markPat();
  }
  function markPat() {
    if (!patList.length) return;
    $('patsCard').querySelectorAll('.pat').forEach((b, i) => { b.classList.toggle('on', i === S.pat); b.setAttribute('aria-pressed', i === S.pat); });
    $('patDesc').textContent = patList[S.pat].desc;
  }
  /* 第三张卡：点到的那一宫 */
  function renderDetail() {
    const c = S.chart, scope = scopeOf(), mu = muOf(scope), p = c.palaces[S.sel];
    const brief = p.major.length && E.starDict[p.major[0].name] ? E.starDict[p.major[0].name].brief : (p.major.length ? '' : '这一宫没有主星，看对宫来借星。');
    const trio = [(S.sel + 6) % 12, (S.sel + 4) % 12, (S.sel + 8) % 12].map(i => c.palaces[i].name).join(' · ');
    $('detailCard').innerHTML = '<div class="card-h"><h3 class="serif">' + esc(p.name) + '<small>' + esc(p.stem + p.branch) + '</small></h3>' +
      (scope ? '<span class="tag">' + PREFIX[S.tab] + '·' + esc(scope.palaceNames[S.sel]) + '</span>' : '') +
      '<div class="right"><button class="link" type="button" data-act="askPalace">问这一宫</button></div></div>' +
      (p.major.length ? '<div class="stars">' + p.major.map(s => starHtml(s, mu)).join('') + '</div>' : '') +
      (brief ? '<p class="brief">' + esc(brief) + '</p>' : '') +
      '<dl class="kv"><dt>辅星</dt><dd>' + (p.minor.map(s => esc(s.name)).join('、') || '—') + '</dd>' +
      '<dt>三方四正</dt><dd>' + esc(trio) + '</dd></dl>';
  }
  function renderCenter() {
    const c = S.chart, e = S.current, scope = scopeOf();
    const yinyang = ('甲丙戊庚壬'.indexOf(c.pillars.yearly.charAt(0)) >= 0 ? '阳' : '阴') + (e.input.gender === 'female' ? '女' : '男');
    $('center').innerHTML = '<div class="nm"><i class="orb" style="--c:' + (COLOR_DARK[soulStar(c).names[0]] || '#b4c3cb') + '"></i>' + esc(nameOf(e)) + '</div>' +
      '<div class="birth">' + esc(c.solarDate.replace(/-/g, '.') + ' · 农历' + R.lunarOf(c) + ' · ' + c.timeName) + (e.place ? ' · ' + esc(e.place) : '') + '</div>' +
      '<div class="pillars" aria-label="四柱">' + [['yearly', '年'], ['monthly', '月'], ['daily', '日'], ['hourly', '时']].map(k => '<span>' + esc(c.pillars[k[0]]) + '<small>' + k[1] + '</small></span>').join('') + '</div>' +
      '<div class="facts"><span><b>' + esc(c.fiveElementsClass) + '</b> · ' + yinyang + '</span><span>命主 <b>' + esc(c.soulMaster) + '</b> · 身主 <b>' + esc(c.bodyMaster) + '</b></span>' +
      '<span>起运 <b>' + c.startAge + ' 岁</b></span><span>真太阳时 <b>' + (c.meta.solarCorrection ? esc(c.meta.solarCorrection.solarTime) : '未校正') + '</b></span>' +
      (scope ? '<span>' + esc(scope.name) + ' <b>' + esc(scope.stem + scope.branch) + '</b></span>' : '') + '</div>';
  }
  function starHtml(s, mu) {
    const seal = s.mutagen ? '<i class="seal ' + MU_KIND[s.mutagen] + '">' + s.mutagen + '</i>' : '';
    const sc = mu[s.name] ? '<i class="seal scope ' + MU_KIND[mu[s.name]] + '">' + PREFIX[S.tab] + mu[s.name] + '</i>' : '';
    return '<span class="star" style="--c:' + starColor(s.name) + '">' + esc(s.name) + (s.brightness ? '<sup>' + esc(s.brightness) + '</sup>' : '') + seal + sc + '</span>';
  }
  function cellInner(c, i, scope, mu) {
    const p = c.palaces[i];
    const minors = p.minor.map(s => {
      const sm = s.mutagen ? '<i class="seal ' + MU_KIND[s.mutagen] + '">' + s.mutagen + '</i>' : '';
      const sc = mu[s.name] ? '<i class="seal scope ' + MU_KIND[mu[s.name]] + '">' + PREFIX[S.tab] + mu[s.name] + '</i>' : '';
      return '<span class="' + (MINOR_GOOD.indexOf(s.name) >= 0 ? 'good' : 'bad') + '">' + esc(s.name) + sm + sc + '</span>';
    }).join('');
    return '<div class="cell-head"><span class="pname">' + esc(p.name) + (i === c.soulIndex ? '<span class="mk">命</span>' : '') + (i === c.bodyIndex ? '<span class="mk body">身</span>' : '') + '</span>' +
      (scope ? '<span class="scope-tag">' + PREFIX[S.tab] + '·' + esc(scope.palaceNames[i]) + '</span>' : '') + '<span class="gz">' + esc(p.stem + p.branch) + '</span></div>' +
      '<div class="majors">' + (p.major.length ? p.major.map(s => starHtml(s, mu)).join('') : '<span class="empty-p">空宫</span>') + '</div>' +
      (minors ? '<div class="minors">' + minors + '</div>' : '') +
      '<div class="cell-foot"><span class="dec">' + p.decadal.range[0] + '–' + p.decadal.range[1] + '</span><span class="gods">' + esc([p.changsheng12, p.boshi12].filter(Boolean).join('·')) + '</span></div>';
  }
  /* 三方四正：从选中宫朝向中宫的那个角，连到对宫和两个三合宫 */
  function drawLines() {
    const board = $('board'), svg = $('lines'); if (!board || !svg) return;
    const br = board.getBoundingClientRect(), cx = br.width / 2, cy = br.height / 2; if (!br.width) return;
    const at = i => { const r = cellEl(i).getBoundingClientRect(), l = r.left - br.left, t = r.top - br.top; return [Math.min(Math.max(cx, l), l + r.width), Math.min(Math.max(cy, t), t + r.height)]; };
    const a = at(S.sel), o = at((S.sel + 6) % 12), t1 = at((S.sel + 4) % 12), t2 = at((S.sel + 8) % 12);
    const P = q => q[0].toFixed(1) + ' ' + q[1].toFixed(1);
    const key = S.sel + '|' + [a, o, t1, t2].map(P).join('|');
    if (svg.getAttribute('data-key') === key) return;            /* 位置没变就不重画，窗口抖一下不会让连线闪 */
    const moved = svg.getAttribute('data-sel') !== String(S.sel);  /* 只有换了宫才播放描线动画 */
    svg.setAttribute('data-key', key); svg.setAttribute('data-sel', S.sel);
    svg.setAttribute('viewBox', '0 0 ' + br.width + ' ' + br.height);
    svg.classList.toggle('still', !moved);
    svg.innerHTML = '<path d="M' + P(a) + ' L' + P(t1) + ' L' + P(t2) + ' Z"/><path class="dash" d="M' + P(a) + ' L' + P(o) + '"/>' +
      [a, o, t1, t2].map((pt, k) => '<circle cx="' + pt[0].toFixed(1) + '" cy="' + pt[1].toFixed(1) + '" r="' + (k ? 2.5 : 3.5) + '"/>').join('');
  }
  if (window.ResizeObserver) new ResizeObserver(() => { if (S.view === 'chart' && S.stage === 'board') requestAnimationFrame(drawLines); }).observe($('chart'));

  /* 命盘页的点击都在这里分发，按钮不用每次重新绑 */
  const ACTS = {
    prev: () => shiftWhen(-1), next: () => shiftWhen(1),
    now: () => { S.when = TODAY; S.h = E.computeHoroscope(S.chart, TODAY); S.sel = S.h[S.tab].index; updateScope(); },
    read: () => { setPanel(true); if (scopeOf()) userAsk(relWord() + '怎么样', scopeText()); else userAsk('讲讲这张盘', introText()); },
    report: () => setTab('report'),
    askPalace: () => { setPanel(true); userAsk('讲讲我的' + S.chart.palaces[S.sel].name); },
    rStart: () => startReport(false), rResume: () => startReport(true), rStop: stopReport, rCopy: copyReport, rDownload: openExport,
    rRedo: b => { if (b.classList.contains('armed')) { startReport(false); return; } b.classList.add('armed'); b.textContent = '确定重新写？旧的会被替换'; setTimeout(() => { if (b.isConnected) { b.classList.remove('armed'); b.textContent = '重新写'; } }, 4000); },
    toc: b => { const el = document.getElementById(b.getAttribute('data-sec')); if (el) { $('rScroll').scrollTo({ top: el.offsetTop - 8, behavior: reduceMotion ? 'auto' : 'smooth' }); } },
    pick: b => { S.quote = b._text || ''; b.hidden = true; const sel = window.getSelection(); if (sel) sel.removeAllRanges(); setPanel(true); renderQuote(); }
  };
  $('chart').addEventListener('click', ev => {
    const t = ev.target.closest && ev.target.closest('button'); if (!t || !$('chart').contains(t)) return;
    if (t.hasAttribute('data-i')) { S.sel = +t.getAttribute('data-i'); S.pane = 'detail'; updateSelection(); return; }
    if (t.hasAttribute('data-pane')) { S.pane = t.getAttribute('data-pane'); renderPanes(); return; }
    if (t.hasAttribute('data-pat')) { S.pat = +t.getAttribute('data-pat'); markPat(); return; }
    const act = t.getAttribute('data-act'); if (act && ACTS[act]) ACTS[act](t);
  });
  $('chart').addEventListener('keydown', ev => {
    const cell = ev.target.closest && ev.target.closest('.cell'); if (!cell) return;
    const step = { ArrowLeft: 11, ArrowRight: 1, ArrowUp: 6, ArrowDown: 6 }[ev.key]; if (step == null) return;
    ev.preventDefault(); S.sel = (S.sel + step) % 12; S.pane = 'detail'; updateSelection(); cellEl(S.sel).focus();
  });

  /* ================= 完整报告（原型：样稿，写的过程是快进演示） ================= */
  const reports = {};
  const sampleMd = e => R.sampleReport(chartOf(e), nameOf(e), todayOf(e).nominalAge);
  function repOf(e) {
    if (!reports[e.id]) reports[e.id] = e.id === 's1' ? { status: 'done', md: sampleMd(e), shown: '', at: Date.now() - 2 * 86400000 } : { status: 'none', md: '', shown: '', at: 0 };
    const r = reports[e.id]; if (r.status === 'done' && !r.shown) r.shown = r.md; return r;
  }
  const reportBtnLabel = () => { const st = repOf(S.current).status; return st === 'done' ? '看完整报告' : st === 'running' ? '报告正在写…' : st === 'stopped' ? '接着写报告' : '写完整报告'; };
  const numbered = r => R.splitSections(r.shown || '').filter(s => s.num);
  function syncReportMarks() {
    const b = $('fullReport'); if (b) b.textContent = reportBtnLabel();
    const tab = document.querySelector('#head [data-tab="report"]'); if (tab && S.current) tab.classList.toggle('busy', repOf(S.current).status === 'running');
  }
  function renderReport() {
    const c = S.chart, r = repOf(S.current), main = $('rMain');
    renderToc(); syncReportMarks();
    if (r.status === 'none') {
      main.innerHTML = '<div class="rempty zr-scope"><div class="rempty-em">' + R.emblemSvg(c, { id: 'zre0', label: nameOf(S.current) + ' 的星图' }) + '</div><h2>完整报告</h2>' +
        '<p>14 个方面，约 3 分钟。写完自动保存在本机，可以下载。</p><button class="btn-primary" type="button" data-act="rStart">开始写</button></div>';
      return;
    }
    if (!$('rDoc')) {
      main.innerHTML = '<div class="rbar" id="rBar" hidden></div><div class="rscroll" id="rScroll" tabindex="0"><article class="zr zr-scope rdoc" id="rDoc"><header class="rtop" id="rTop"></header><div id="rSecs"></div></article></div>' +
        '<button class="rpick" type="button" id="rPick" data-act="pick" hidden>问这段</button>';
      const sc = $('rScroll'); let spy = 0;
      sc.addEventListener('scroll', () => { stickBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80; $('rPick').hidden = true; if (!spy) spy = requestAnimationFrame(() => { spy = 0; markToc(); }); });
      sc.addEventListener('mouseup', () => setTimeout(pickCheck, 0)); sc.addEventListener('keyup', pickCheck);
    }
    renderTop(); renderBar(); renderSecs(); markToc();
  }
  function renderTop() {
    const c = S.chart, r = repOf(S.current), chars = (r.shown || '').replace(/\s/g, '').length, d = r.at ? new Date(r.at) : null;
    $('rTop').innerHTML = '<div class="em">' + R.emblemSvg(c, { id: 'zre1', small: true, label: nameOf(S.current) + ' 的星图' }) + '</div><div><h1>' + esc(nameOf(S.current)) + ' · 完整报告</h1>' +
      '<p>' + esc(c.solarDate.replace(/-/g, '.') + ' · 农历' + R.lunarOf(c) + ' · ' + c.timeName + ' · ' + c.fiveElementsClass) + '</p>' +
      '<p>' + (r.status === 'done' ? numbered(r).length + ' 部分 · ' + chars.toLocaleString('en-US') + ' 字' + (d ? ' · ' + (d.getMonth() + 1) + '月' + d.getDate() + '日写完' : '') : '已写 ' + chars.toLocaleString('en-US') + ' 字') + '</p></div>';
  }
  function renderBar() {
    const r = repOf(S.current), bar = $('rBar'); if (!bar) return;
    const n = numbered(r).length, cur = Math.max(1, n);
    if (r.status === 'running') { bar.hidden = false; bar.innerHTML = '<i class="pulse" aria-hidden="true"></i><span>正在写第 ' + cur + ' / 14 部分 · ' + esc(R.TITLES[cur - 1] || '') + '</span><span class="note">原型里是样稿快进</span><button class="btn" type="button" data-act="rStop">停止</button>'; }
    else if (r.status === 'stopped') { bar.hidden = false; bar.innerHTML = '<span>写到第 ' + cur + ' 部分停了，已经写的都在下面。</span><button class="btn" type="button" data-act="rResume">接着写</button><button class="link" type="button" data-act="rRedo">重新写</button>'; }
    else { bar.hidden = true; bar.innerHTML = ''; }
  }
  /* 正文按部分增量更新：写的过程中只动最后那一部分，前面的不重排 */
  let secCache = [], stickBottom = true;
  function renderSecs() {
    const box = $('rSecs'), r = repOf(S.current), secs = R.splitSections(r.shown || '');
    if (box.getAttribute('data-for') !== S.current.id) { box.innerHTML = ''; box.setAttribute('data-for', S.current.id); secCache = []; }
    secs.forEach((s, i) => {
      const html = R.sectionHtml(s); if (secCache[i] === html) return;
      if (box.children[i]) box.children[i].outerHTML = html; else box.insertAdjacentHTML('beforeend', html);
      secCache[i] = html;
    });
    while (box.children.length > secs.length) { box.lastElementChild.remove(); secCache.pop(); }
  }
  function renderToc() {
    const r = repOf(S.current), secs = R.splitSections(r.shown || '').filter(s => s.title), nums = secs.filter(s => s.num), chars = (r.shown || '').replace(/\s/g, '').length;
    let items;
    if (r.status === 'done') items = secs.map(s => ({ id: s.id, num: s.num, title: s.title, st: 'done' }));
    else items = R.TITLES.map((t, i) => ({ id: nums[i] ? nums[i].id : '', num: R.NUM[i], title: t, st: i < nums.length - 1 ? 'done' : i === nums.length - 1 ? (r.status === 'running' ? 'now' : 'done') : 'todo' }));
    const meta = r.status === 'done' ? chars.toLocaleString('en-US') + ' 字' : r.status === 'running' ? '正在写' : r.status === 'stopped' ? '没写完' : '还没写';
    $('rToc').innerHTML = '<div class="card-h"><h3>完整报告</h3><span class="cnt">' + meta + '</span></div>' +
      '<nav class="toc" id="toc" aria-label="目录">' + items.map(it => '<button type="button" class="' + it.st + '"' + (it.id ? ' data-act="toc" data-sec="' + it.id + '"' : ' disabled') + '><i>' + esc(it.num) + '</i><span>' + esc(it.title) + '</span></button>').join('') + '</nav>' +
      (r.status === 'done' ? '<div class="card-f"><button class="btn" type="button" data-act="rDownload">下载报告</button><button class="btn" type="button" data-act="rCopy">复制全文</button><button class="link" type="button" data-act="rRedo">重新写</button></div>' : '');
  }
  function markToc() {
    const sc = $('rScroll'), toc = $('toc'); if (!sc || !toc) return;
    let cur = ''; const first = toc.querySelector('button[data-sec]');
    sc.querySelectorAll('.zr-sec[id]').forEach(s => { if (s.offsetTop <= sc.scrollTop + 60 && toc.querySelector('[data-sec="' + s.id + '"]')) cur = s.id; });
    if (!cur && first) cur = first.getAttribute('data-sec');
    toc.querySelectorAll('button').forEach(b => { const on = !!cur && b.getAttribute('data-sec') === cur; if (b.classList.contains('on') !== on) { b.classList.toggle('on', on); if (on && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } });
  }
  function startReport(resume) {
    const e = S.current, r = repOf(e); if (r.status === 'running') return;
    if (!resume || !r.md) { r.md = sampleMd(e); r.shown = ''; }
    r.status = 'running'; r.at = 0; stickBottom = true;
    const lines = r.md.split('\n'); let n = r.shown ? r.shown.split('\n').length : 0;
    const here = () => S.current === e && S.view === 'chart';
    if (here() && S.stage === 'report') renderReport(); else syncReportMarks();
    const tick = () => {
      if (r.status !== 'running') return;
      n = Math.min(lines.length, n + 2); r.shown = lines.slice(0, n).join('\n');
      if (n >= lines.length) { r.status = 'done'; r.at = Date.now(); }
      if (here()) {
        if (S.stage === 'report') { renderSecs(); renderBar(); renderToc(); renderTop(); markToc(); const sc = $('rScroll'); if (sc && stickBottom && r.status === 'running') sc.scrollTop = sc.scrollHeight; }
        syncReportMarks();
        if (r.status === 'done') toast('报告写好了');
      }
      if (r.status === 'running') r.timer = setTimeout(tick, reduceMotion ? 8 : 120);
    };
    r.timer = setTimeout(tick, 450);
  }
  function stopReport() { const r = repOf(S.current); if (r.status !== 'running') return; clearTimeout(r.timer); r.status = r.shown ? 'stopped' : 'none'; renderReport(); }
  function copyReport() {
    const r = repOf(S.current), ok = () => toast('已复制全文'), bad = () => toast('复制失败，可以手动选中文字复制');
    try { navigator.clipboard.writeText(r.md).then(ok, bad); } catch (err) { bad(); }
  }
  /* 选中一段文字 → 「问这段」，带着这段话去问紫微师 */
  function pickCheck() {
    const sc = $('rScroll'), btn = $('rPick'); if (!sc || !btn) return;
    const sel = window.getSelection(), text = sel ? String(sel).trim() : '';
    if (!text || text.length < 4 || !sel.rangeCount || !sc.contains(sel.anchorNode)) { btn.hidden = true; return; }
    const rc = sel.getRangeAt(0).getBoundingClientRect(), box = $('rMain').getBoundingClientRect();
    btn._text = text.slice(0, 600); btn.hidden = false;
    btn.style.left = Math.max(8, Math.min(box.width - 84, rc.right - box.left - 36)) + 'px';
    btn.style.top = Math.max(8, Math.min(box.height - 40, rc.bottom - box.top + 8)) + 'px';
  }
  /* 「下载报告」得到的那个文件。原型里不能真的下载，就地预览它的样子 */
  function openExport() {
    const e = S.current, c = S.chart, host = $('xhost');
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>:host{display:block;background:var(--zr-bg);color:var(--zr-ink);font-family:var(--zr-sans);' + R.FONTS + (isDark() ? R.DARK : R.LIGHT) + '}' + R.DOC_CSS + R.PROSE_CSS + '.zr-print{display:none}</style>' +
      R.docBody({ chart: c, name: nameOf(e), gender: e.input.gender, place: e.place || '', occupation: '' }, repOf(e).md);
    root.onclick = ev => { const a = ev.target.closest && ev.target.closest('a[data-to]'); if (!a) return; ev.preventDefault(); const el = root.getElementById(a.getAttribute('data-to')); if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); };
    $('xname').textContent = '人生鲲鹏计划_' + nameOf(e) + '_' + TODAY.y + pad(TODAY.m) + pad(TODAY.d) + '.html';
    host.scrollTop = 0; $('xprev').hidden = false; $('xclose').focus();
  }
  function closeExport() { const x = $('xprev'); if (x && !x.hidden) { x.hidden = true; return true; } return false; }
  $('xclose').onclick = closeExport;

  /* ================= 紫微师（原型：本地生成示例文字） ================= */
  function setPanel(on) {
    S.panel = on; app.classList.toggle('panel-open', on);
    if (S.view === 'chart') setTimeout(drawLines, 380);
    renderPanel(); renderQuote();
    if (on) setTimeout(() => { if (!S.streaming) $('asInput').focus(); }, 380);
  }
  const SUGGEST = ['今年事业怎么样', '这十年感情要注意什么', '我适合做什么工作'];
  function renderPanel() {
    $('asSub').textContent = S.chart && S.view === 'chart' ? '「' + nameOf(S.current) + '」这张盘' : '';
    const box = $('msgs');
    if (!S.msgs.length) box.innerHTML = '<div class="as-empty"><p class="l1">想问什么，直接说。</p><p class="l2">' + (S.chart ? '命盘已经带进来了。' : '先排一张盘，或打开一张已有的盘。') + '</p></div>';
    else {
      box.innerHTML = S.msgs.map(m => m.me ? '<div class="msg me">' + (m.quote ? '<q>' + esc(m.quote.slice(0, 90)) + (m.quote.length > 90 ? '…' : '') + '</q>' : '') + esc(m.text) + '</div>' : '<div class="msg bot">' + md(m.text) + (m.done ? '<span class="proto-note">原型示例文字，真实版本由紫微师根据整张盘作答</span>' : '<div class="typing">紫微师正在写…</div>') + '</div>').join('');
      box.scrollTop = box.scrollHeight;
    }
    const sg = $('suggest'); sg.innerHTML = '';
    if (S.chart && !S.streaming) SUGGEST.forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = () => userAsk(q); sg.appendChild(b); });
  }
  const md = t => t.split('\n').map(l => { if (!l.trim()) return ''; const hm = /^\*\*(.+)\*\*$/.exec(l.trim()); return hm ? '<h4>' + esc(hm[1]) + '</h4>' : '<p>' + esc(l) + '</p>'; }).join('');
  function userAsk(q, reply) {
    if (!S.chart) { toast('先打开一张盘'); return; } if (S.streaming) return;
    const quote = S.quote; S.quote = null; renderQuote();
    S.msgs.push({ me: true, text: q, quote: quote });
    bot(reply || (quote ? '**关于你选的这段**\n真实版本会把这段话连同整张盘一起交给紫微师，围绕它展开回答。' : answerText(q)));
  }
  function renderQuote() {
    const q = $('quote'); if (!q) return;
    if (!S.quote) { q.hidden = true; q.innerHTML = ''; return; }
    q.hidden = false; q.innerHTML = '<span>引用：' + esc(S.quote.slice(0, 60)) + (S.quote.length > 60 ? '…' : '') + '</span><button type="button" aria-label="不引用了">×</button>';
    q.querySelector('button').onclick = () => { S.quote = null; renderQuote(); };
    setTimeout(() => { if (!S.streaming) $('asInput').focus(); }, 60);
  }
  function bot(text) {
    const m = { text: '', done: false }; S.msgs.push(m); S.streaming = true; renderPanel();
    if (reduceMotion) { m.text = text; m.done = true; S.streaming = false; renderPanel(); return; }
    let i = 0; const tick = () => { i = Math.min(text.length, i + 3); m.text = text.slice(0, i); if (i >= text.length) { m.done = true; S.streaming = false; } renderPanel(); if (!m.done) setTimeout(tick, 22); };
    setTimeout(tick, 400);
  }
  function curDecade(c) { const age = todayOf(S.current).nominalAge, l = E.decadalList(c); for (let i = 0; i < l.length; i++) if (age >= l[i].ageRange[0] && age <= l[i].ageRange[1]) return l[i]; return l[0]; }
  function scopeText() {
    const c = S.chart, sc = S.h[S.tab], pn = c.palaces[sc.index].name;
    return '**' + relWord() + ' · ' + sc.stem + sc.branch + '**\n' + TABNAME[S.tab] + '命宫落在本命' + pn + '，重心在' + THEME[pn] + '。\n' + sc.mutagen[0] + '化禄，顺的事多从这里来；' + sc.mutagen[3] + '化忌，相关的事放慢一点。';
  }
  function introText() {
    const c = S.chart, e = S.current, soul = c.palaces[c.soulIndex], m = majorsOf(c, c.soulIndex);
    const first = m[0] && E.starDict[m[0]] ? E.starDict[m[0]].brief : '', dec = curDecade(c), h = todayOf(e), focus = c.palaces[h.daily.index].name;
    const pats = E.detectPatterns(c);
    return '**先看命宫**\n' + nameOf(e) + '的命宫在' + soul.stem + soul.branch + '，' + (m.length ? '坐' + m.join('、') + '。' + first : '没有主星，要借对宫的星来看。') +
      (pats.length ? '\n**格局**\n' + pats.slice(0, 2).map(x => x.name + '：' + x.desc).join('\n') : '') +
      '\n**这十年**\n现在走' + dec.palaceName + '大限（' + dec.ageRange[0] + '–' + dec.ageRange[1] + ' 岁），重心在' + (THEME[dec.palaceName] || dec.palaceName) + '。' +
      '\n**今天**\n流日命宫在' + focus + '，' + h.daily.mutagen[0] + '化禄、' + h.daily.mutagen[3] + '化忌；重心在' + THEME[focus] + '。' +
      (e.timeUnknown ? '\n时辰不详，先按午时排的；知道准确时间后改一下，命宫会跟着变。' : '');
  }
  function answerText(q) {
    const c = S.chart, dec = curDecade(c);
    const mm = /讲讲我的(.+)/.exec(q);
    if (mm) { const p = c.palaces.filter(x => x.name === mm[1])[0] || c.palaces[S.sel]; return '**' + p.name + ' ' + p.stem + p.branch + '**\n' + (p.major.length ? '主星' + p.major.map(s => s.name + (s.brightness ? '（' + s.brightness + '）' : '')).join('、') + '。' : '空宫，借对宫来看。') + '\n这一宫管' + (THEME[p.name] || '') + '。三方四正已经在盘上连出来了，一起看。'; }
    return '**' + q + '**\n真实版本会把你的问题和整张盘交给你在 DSH 里配置的模型。\n从盘面看：现在走' + dec.palaceName + '大限（' + dec.ageRange[0] + '–' + dec.ageRange[1] + ' 岁），重心在' + (THEME[dec.palaceName] || dec.palaceName) + '。';
  }
  $('asForm').addEventListener('submit', e => { e.preventDefault(); const ta = $('asInput'), v = ta.value.trim(); if (!v) return; ta.value = ''; userAsk(v); });
  $('asInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('asForm').requestSubmit(); } });
  $('asClose').onclick = () => setPanel(false);

  /* ================= 场景、主题、渲染 ================= */
  let tt = 0;
  function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, 2200); }
  document.addEventListener('keydown', e => { if (e.key !== 'Escape' || e.isComposing) return; if (closeExport()) return; if (S.menuId) closeMenu(); else if (S.panel) setPanel(false); });
  document.querySelectorAll('[data-scene]').forEach(b => { b.onclick = () => setScene(b.getAttribute('data-scene')); });
  document.querySelectorAll('[data-theme-set]').forEach(b => { b.onclick = () => document.documentElement.setAttribute('data-theme', b.getAttribute('data-theme-set')); });
  function intro() { if (!Sky.ok) return; app.classList.add('busy'); setTimeout(() => { if (!S.leaving) app.classList.remove('busy'); }, Sky.introMs * (isDark() ? 0.52 : 0.8)); }
  $('replay').onclick = () => { Sky.replay(); intro(); };
  function onTheme() { Sky.grade(!isDark()); statusFor = ''; planetSig = ''; render(); }
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onTheme);
  new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  function setScene(sc) {
    S.scene = sc; rebuildCharts();
    S.onboarding = !S.charts.length; S.step = 0; S.data = {}; S.calMode = 'solar'; S.msgs = []; S.view = 'home'; S.hoverId = null;
    closeExport(); setPanel(false); save(); render();
  }
  function render() {
    app.setAttribute('data-view', S.view);
    $('home').hidden = S.view !== 'home'; $('chart').hidden = S.view !== 'chart';
    document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('on', b.getAttribute('data-scene') === S.scene));
    document.querySelectorAll('[data-theme-set]').forEach(b => b.classList.toggle('on', (b.getAttribute('data-theme-set') === 'dark') === isDark()));
    renderHead(); if (S.view === 'home') renderHome(); else mountChart();
    renderPanel();
  }
  Sky.onHover(id => preview(id, true));
  Sky.onPick(id => { const e = byId(id); if (e) openChart(e, 'daily'); });
  const g = $('gesture');
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) g.textContent = '拖动旋转 · 双指缩放 · 点星球打开命盘';
  Sky.onGesture(() => g.classList.add('gone'));
  setTimeout(() => g.classList.add('gone'), 14000);
  if (!Sky.ok) { app.classList.add('no-gl'); $('planets').classList.add('flat'); g.hidden = true; }
  Sky.grade(!isDark());
  setScene(S.scene);
  if (Sky.ok && Sky.introMs) intro(); else app.classList.remove('busy');
})();
