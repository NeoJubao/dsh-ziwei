/* ================================================================
 * 60-home：首页（T8a）。一座可以拖动的 3D 星图（HOME_SKY）+ 底部居中的一列对话（HOME_TALK）。
 * 结构和类名见 css/60-home.css 开头。ProApp 一直挂着 HomeView（进了命盘也不卸载，CSS 把它藏起来）。
 *
 * 星图在 src/sky.js，这里只通过 __ziweiBootstrapSky() 用它，而且只在 effect 里：
 *   - 首页第一次显示、设置里开着"首页 3D 星图"时才向它要场景（acquire）；面板卸载时交回去停放（release），
 *     在设置里关掉时交回去并马上释放。渲染函数本身从不碰它，所以渲染首页不会执行 Three.js。
 *   - 要不到（没有 WebGL）、中途丢了上下文、或者设置里关着：section 带 data-nogl，改用静态星图
 *     （聚焦那张盘的徽记）加一排平铺的标签，其余功能一样。
 *   - 画布由 sky.js 建好放进一个空的 div，React 不管它里面的东西；标签节点的位置（transform / opacity /
 *     visibility）由场景每帧直接写，所以有 3D 时标签不传 style。平铺时标签另用一套 key，换模式时节点重建，
 *     不带着场景写过的内联样式。
 *
 * 状态放哪：
 *   props      tier（档位）、theme（dark / light，决定夜空还是晨光）
 *   store      看的是哪张盘、聚焦哪一张（session.focusId）、引导问答（session.onboarding）、开场播过没有
 *              （session.introPlayed）、操作提示看过没有（session.homeGestureSeen）
 *   组件自己   指着哪个标签、哪个标签的菜单开着、输入框里的字、界面是不是先收着（data-busy）
 *
 * 进出命盘：点标签、点星球、发问题、点快捷项都走 homeOpen —— 先让场景飞向那颗星（dive），回调里才
 * store.openChart；场景没回调（没有这颗星、被停放）也有保险，到时间照常进去。回到首页时从那颗星拉远（rise）。
 * 引导问答（62-onboarding.js 的 OnboardingTalk）：session.onboarding 有值、或者命盘库是空的时候，对话栏里日期行以下
 * 整个交给它（它自己带输入框）。空库时不用先"开始"：它把还没有状态当成第一问，所以新用户第一帧看到的就是引导。
 * 它排出新盘后调 props.onDone(entry)，这里放新星诞生（birth），再打开这张盘。
 * ================================================================ */

const HOME_MAX = 8;
const HOME_NAME_MAX = 12;
const HOME_RISE_MS = 750;        /* 回到首页：先看星图拉远，界面稍后再出来 */
const HOME_SKY_OFF_MS = 520;     /* 进了命盘、首页被盖住之后再停掉星图的渲染 */
const HOME_HOVER_OUT_MS = 280;   /* 指针离开标签后等一下再换回聚焦的那张，免得在标签之间移动时来回跳 */
const HOME_GESTURE_MS = 14000;
const HOME_STUCK_MS = 3200;      /* 飞入 / 新星动画的保险：场景一直没回调，到时间照常往下走 */

function homeShellOf(s) {
  const ss = s.session;
  return {
    view: ss.view, chartId: ss.chartId, focusId: ss.focusId, onboarding: !!ss.onboarding,
    skyPref: !!s.prefs.sky, library: s.library, gestureSeen: !!ss.homeGestureSeen
  };
}

/* 最近的 n 张：按 openedAt 新→旧，没打开过的按 id 里的时间（和 21-storage 的 library.recent 同一个排法，但不读 storage） */
function homeRecent(library) {
  const when = function (e) { return +(e && e.openedAt) || libIdTime(e); };
  return (library || []).map(function (e, i) { return { e: e, i: i }; })
    .sort(function (a, b) { return (when(b.e) - when(a.e)) || (a.i - b.i); })
    .slice(0, HOME_MAX).map(function (x) { return x.e; });
}

/* 星球的颜色交给 WebGL，要的是具体的色值：用导出文件那套深色星色（和原型一致，浅色主题下星球也是这套） */
function homeSkyColor(name) {
  const i = name ? ZWREPORT.STARS14.indexOf(name) : -1;
  return i < 0 ? '' : ZWREPORT.STAR_DARK[i];
}

function homeColorStyle(name) {
  const v = starColorVar(name);
  return v ? { '--zp-c': v } : undefined;
}

function homeRow(store, entry, today) {
  const chart = entry ? store.chartOf(entry) : null;
  if (!chart) return null;
  return {
    id: entry.id, key: store.keyOf(entry), name: String(entry.name || '') || t('headUnnamed'),
    chart: chart, soul: soulStars(chart), h: horoscopeAt(chart, today)
  };
}

/* 排不出来的条目不上星图（"全部命盘"里还看得到、能改生辰） */
function homeModel(store, library, today) {
  const rows = [];
  homeRecent(library).forEach(function (entry) {
    const r = homeRow(store, entry, today);
    if (r) rows.push(r);
  });
  return {
    rows: rows,
    planets: rows.map(function (r) { return planetItem(r.id, r.chart, r.h, homeSkyColor); }),
    sig: rows.map(function (r) { return r.id + '~' + r.key; }).join('|')
  };
}

/* ---------------- 只在 effect 和事件里用的小工具（碰 DOM / window） ---------------- */
/* 面板底色的计算值：给场景做飞入 / 拉远时的过渡色，以及文字背后的衬底 */
function homeBg(el) {
  try {
    const root = el && typeof el.closest === 'function' ? el.closest('.zp-root') : null;
    const win = root && root.ownerDocument && root.ownerDocument.defaultView;
    if (!root || !win || typeof win.getComputedStyle !== 'function') return '';
    return win.getComputedStyle(root).backgroundColor || '';
  } catch (e) { return ''; }
}

function homeMedia(query) {
  try { return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia(query).matches); } catch (e) { return false; }
}

/* 过 n 帧再调 fn（没有 requestAnimationFrame 的环境退成一个 0 毫秒的定时器）；返回取消函数 */
function homeAfterFrames(n, fn) {
  let raf = null;
  try { raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function' ? window : null; } catch (e) { raf = null; }
  if (!raf) return uiLater(fn, 0);
  let left = n, id = 0, off = false;
  const step = function () {
    if (off) return;
    left -= 1;
    if (left <= 0) { fn(); return; }
    id = raf.requestAnimationFrame(step);
  };
  id = raf.requestAnimationFrame(step);
  return function () {
    off = true;
    try { raf.cancelAnimationFrame(id); } catch (e) { /* ignore */ }
  };
}

/* 字典里的一句话按 {占位} 拆开，占位换成元素或文字（给状态句里的宫名、星名上样式用） */
function homeRich(template, parts) {
  const out = [];
  const re = /\{(\w+)\}/g;
  let last = 0, m = re.exec(template);
  while (m) {
    if (m.index > last) out.push(template.slice(last, m.index));
    out.push(parts[m[1]] !== undefined ? parts[m[1]] : m[0]);
    last = re.lastIndex;
    m = re.exec(template);
  }
  if (last < template.length) out.push(template.slice(last));
  return out;
}

/* ---------------- 状态句、日期行、标签第三行 ---------------- */
function homeStatusNode(row) {
  if (!row) return null;
  const st = homeStatus(row.chart, row.h);
  const body = !st ? t('homeStatusOut', { name: row.name }) : homeRich(t('homeStatus'), {
    name: row.name,
    palace: h('strong', { key: 'palace' }, scopeZhPalace(st.palace)),
    lu: h('span', { key: 'lu', className: 'zp-st', style: homeColorStyle(st.lu) }, st.lu),
    ji: h('span', { key: 'ji', className: 'zp-st', style: homeColorStyle(st.ji) }, st.ji),
    theme: h('strong', { key: 'theme' }, st.theme)
  });
  /* span 的 key 是命盘 id：换一张盘时这句话重新进场（CSS 的 zp-rise），别的重渲染不重放 */
  return h('h1', { key: 'status', className: 'zp-status' }, h('span', { key: row.id }, body));
}

function homeDateNode(today, hRef) {
  const l = scopeLunar(today);
  if (!l || !hRef || !hRef.daily) return h('p', { key: 'date', className: 'zp-date-line' }, t('homeDatePlain', { m: today.m, d: today.d }));
  return h('p', { key: 'date', className: 'zp-date-line' }, homeRich(t('homeDateLine'), {
    m: String(today.m), d: String(today.d),
    lunar: birthLunarMonthText(l.month, l.isLeap) + birthLunarDayText(l.day),
    gzDay: h('b', { key: 'gz' }, t('homeGzDay', { gz: hRef.daily.stem + hRef.daily.branch }))
  }));
}

function homeTagLine(row) {
  const wuxing = row.chart.fiveElementsClass;
  if (!row.soul.names.length) return t('homeTagEmpty', { wuxing: wuxing });
  return t(row.soul.borrowed ? 'homeTagBorrowed' : 'homeTagSoul', { stars: row.soul.names.join(t('homeListSep')), wuxing: wuxing });
}

/* ---------------- 一颗星球的标签 ----------------
 * props：{ row, flat, on（悬停 / 聚焦中）, menu（菜单开着）, onPreview(id|null), onOpen(id), onMenu(id|null) } */
function HomeTag(props) {
  const row = props.row;
  const open = !!props.menu;
  const [mode, setMode] = useState('base');     /* base：三个选项；rename：改名；confirm：确认删除 */
  const [draft, setDraft] = useState('');
  const rootRef = useRef(null);
  const moreRef = useRef(null);
  const inputRef = useRef(null);
  const close = function (refocus) {
    props.onMenu(null);
    if (refocus && moreRef.current) focusQuietly(moreRef.current);
  };
  usePopoverDismiss(open, rootRef, close);
  useEffect(function () {
    if (!open) setMode('base');
  }, [open]);
  useEffect(function () {
    const el = inputRef.current;
    if (!open || mode !== 'rename' || !el) return;
    focusQuietly(el);
    try { el.select(); } catch (e) { /* ignore */ }
  }, [open, mode]);

  const save = function () {
    const name = Array.from(String(draft || '').trim()).slice(0, HOME_NAME_MAX).join('');
    const store = appStore();
    if (name && name !== row.name && store.renameChart(row.id, name)) store.showToast(t('homeRenamed', { name: name }));
    close(true);
  };

  let menu = null;
  if (open && mode === 'rename') {
    menu = [
      h('input', {
        key: 'name', type: 'text', name: 'zp-chart-name', ref: inputRef, value: draft, maxLength: HOME_NAME_MAX, 'aria-label': t('homeRenameLabel'),
        autoComplete: 'off',
        onChange: function (ev) { setDraft(ev.target.value); },
        onKeyDown: function (ev) {
          if (ev.key !== 'Enter' || isComposingKey(ev)) return;
          ev.preventDefault();
          save();
        }
      }),
      h('button', { key: 'save', type: 'button', onClick: save }, t('homeMenuSave'))
    ];
  } else if (open && mode === 'confirm') {
    menu = [
      h('span', { key: 'ask' }, t('homeDeleteAsk')),
      h('button', {
        key: 'yes', type: 'button', className: 'zp-danger',
        onClick: function () { props.onMenu(null); appStore().removeChart(row.id); }
      }, t('homeMenuDelete')),
      h('button', { key: 'no', type: 'button', onClick: function () { setMode('base'); } }, t('homeMenuCancel'))
    ];
  } else if (open) {
    menu = [
      h('button', { key: 'rename', type: 'button', onClick: function () { setDraft(row.name); setMode('rename'); } }, t('homeMenuRename')),
      h('button', { key: 'birth', type: 'button', onClick: function () { close(false); openSheet('birth', row.id); } }, t('headEditBirth')),
      h('button', { key: 'del', type: 'button', className: 'zp-danger', onClick: function () { setMode('confirm'); } }, t('homeMenuDelete'))
    ];
  }

  return h('div', {
    className: 'zp-ptag' + (props.on || open ? ' zp-on' : ''), 'data-pid': row.id, ref: rootRef,
    style: props.flat ? homeColorStyle(row.soul.names[0]) : undefined,
    onMouseEnter: function () { props.onPreview(row.id); },
    onMouseLeave: function () { props.onPreview(null); }
  },
  h('div', { className: 'zp-ptag-in' },
    h('button', {
      className: 'zp-ptag-main', type: 'button', 'aria-label': t('homeTagOpen', { name: row.name }),
      onClick: function () { props.onOpen(row.id); },
      onFocus: function () { props.onPreview(row.id); },
      onBlur: function () { props.onPreview(null); }
    },
    h('b', null, row.name),
    h('span', null, String(row.chart.solarDate || '').replace(/-/g, '.')),
    h('i', null, homeTagLine(row))),
    h('button', {
      className: 'zp-ptag-more', type: 'button', ref: moreRef,
      'aria-label': t('homeTagMore', { name: row.name }), 'aria-expanded': open ? 'true' : 'false',
      onClick: function () { props.onMenu(open ? null : row.id); },
      onFocus: function () { props.onPreview(row.id); }
    }, h(Icon, { name: 'more', size: 14 })),
    menu ? h('div', { className: 'zp-ptag-menu', role: 'group', 'aria-label': row.name }, menu) : null));
}

/* ---------------- 首页 ---------------- */
function HomeView(props) {
  const store = appStore();
  const m = useStore(homeShellOf);
  const today = store.todayOf();
  const todayKey = today.y + '-' + today.m + '-' + today.d;
  const model = useMemo(function () { return homeModel(store, m.library, today); }, [m.library, todayKey]);

  const skyBundled = typeof __ziweiBootstrapSky === 'function';
  const [seen, setSeen] = useState(m.view === 'home');             /* 首页在这次挂载里显示过没有 */
  const [glState, setGl] = useState('pending');                    /* pending：还没要到；ok；none：要不到或丢了 */
  const [busy, setBusy] = useState(m.skyPref && skyBundled && m.view === 'home');
  const [hoverId, setHoverId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [ask, setAsk] = useState('');
  const [birthId, setBirthId] = useState(null);
  const [gestureGone, setGestureGone] = useState(false);
  const [coarse, setCoarse] = useState(false);

  const sectionRef = useRef(null);
  const hostRef = useRef(null);
  const tagsRef = useRef(null);
  const reticleRef = useRef(null);
  const colRef = useRef(null);
  const skyRef = useRef(null);
  const live = useRef({});
  const leaving = useRef(false);
  const prevView = useRef(m.view);
  const prefRef = useRef(m.skyPref);
  const planetKeys = useRef({});
  const hoverOff = useRef(null);
  /* 夜空 / 晨光跟面板的外观走（props.theme 是 ProApp 解析好的 dark / light） */
  const darkRef = useRef(props.theme !== 'light');
  prefRef.current = m.skyPref;
  darkRef.current = props.theme !== 'light';

  const want = m.skyPref && skyBundled && seen;
  const mode = !m.skyPref || !skyBundled ? 'none' : glState;
  const flat = mode === 'none';
  /* 在引导问答里：用户点了「排一张新盘」，或者一张盘都没有 */
  const onboarding = m.onboarding || !m.library.length;

  /* 聚焦的那张：session.focusId 指的盘；没有（或已经删了）就是最近的一张 */
  const focusRow = useMemo(function () {
    const id = m.focusId;
    for (let i = 0; i < model.rows.length; i++) if (model.rows[i].id === id) return model.rows[i];
    const far = id ? homeRow(store, store.entryById(id), today) : null;     /* 聚焦的盘不在最近 8 张里 */
    return far || model.rows[0] || null;
  }, [model, m.focusId]);
  let shownRow = focusRow;
  for (let i = 0; i < model.rows.length; i++) if (hoverId && model.rows[i].id === hoverId) shownRow = model.rows[i];

  /* ---------- 动作 ---------- */
  const preview = function (id, fromSky) {
    if (hoverOff.current) { hoverOff.current(); hoverOff.current = null; }
    if (menuId || onboarding || m.view !== 'home') return;
    const apply = function () {
      hoverOff.current = null;
      setHoverId(id);
      if (!fromSky && skyRef.current) skyRef.current.hover(id);
    };
    if (id) apply(); else hoverOff.current = uiLater(apply, HOME_HOVER_OUT_MS);
  };
  const setMenu = function (id) {
    if (hoverOff.current) { hoverOff.current(); hoverOff.current = null; }
    setMenuId(id);
    if (id) {
      setHoverId(id);
      if (skyRef.current) skyRef.current.hover(id);
    }
  };
  /* o：{ tab, panel, ask, scope }。先飞向那颗星，回调里才真的打开 */
  const homeOpen = function (id, o) {
    if (leaving.current || !id) return;
    const entry = store.entryById(id);
    if (!entry || !store.chartOf(entry)) return;
    const opts = o || {};
    leaving.current = true;
    setMenuId(null);
    setHoverId(null);
    setBusy(true);
    let done = false, stop = null;
    const go = function () {
      if (done) return;
      done = true;
      if (stop) stop();
      leaving.current = false;
      const okOpen = store.openChart(id, { tab: opts.tab, panel: opts.panel });
      if (okOpen && opts.ask) store.ask(opts.ask, opts.scope ? { scope: true } : undefined);
      setBusy(false);
    };
    const sky = skyRef.current;
    if (!sky || mode !== 'ok') { go(); return; }
    stop = uiLater(go, HOME_STUCK_MS);
    sky.dive(id, homeBg(sectionRef.current), go);
  };
  const gestured = function () {
    if (gestureGone) return;
    setGestureGone(true);
    store.patchSession({ homeGestureSeen: true });
  };
  /* 引导问答排出了新盘：有 3D 就先放"新星诞生"，再打开这张盘（本命，紫微师打开） */
  const onBorn = function (entry) {
    if (!entry || !entry.id) return;
    store.patchSession({ focusId: entry.id });
    if (!skyRef.current || mode !== 'ok') { store.openChart(entry.id, { tab: 'natal', panel: true }); return; }
    leaving.current = true;
    setBusy(true);
    setBirthId(entry.id);
  };
  live.current = { preview: preview, open: homeOpen, gestured: gestured };

  /* ---------- 场景：要来、交回 ---------- */
  useEffect(function () {
    if (!want) return undefined;
    const el = sectionRef.current;
    const dark = darkRef.current;
    let api = null, sky = null;
    try {
      api = __ziweiBootstrapSky();
      sky = api.acquire(hostRef.current, { day: !dark, playIntro: !store.getState().session.introPlayed });
    } catch (e) { sky = null; }
    if (!sky || !sky.ok) {
      setGl('none');
      setBusy(false);
      return undefined;
    }
    let held = true;
    const drop = function (keepMs) {
      if (!held) return;
      held = false;
      if (skyRef.current === sky) skyRef.current = null;
      try { api.release(sky, keepMs); } catch (e) { /* ignore */ }
    };
    skyRef.current = sky;
    sky.onLost(function () { drop(); setGl('none'); setBusy(false); });
    sky.onHover(function (id) { live.current.preview(id || null, true); });
    sky.onPick(function (id) { live.current.open(id, { tab: 'daily' }); });
    sky.onGesture(function () { live.current.gestured(); });
    sky.grade(!dark);
    sky.scrim(homeBg(el));
    setGl('ok');
    /* 开场在一次 DSH 运行里只播一次：一开始就记下，中途切走再回来也不重播 */
    const introMs = store.getState().session.introPlayed ? 0 : (+sky.introMs || 0);
    store.patchSession({ introPlayed: true });
    const ready = function () { if (!leaving.current) setBusy(false); };
    /* 开场时等它播过大半再把界面放出来；不播开场就等场景画出一帧、把标签摆到位 */
    const cancel = introMs > 0 ? uiLater(ready, Math.round(introMs * (dark ? 0.52 : 0.8))) : homeAfterFrames(2, ready);
    return function () {
      cancel();
      drop(prefRef.current ? undefined : 0);     /* 设置里关掉的：不停放，马上释放 */
    };
  }, [want]);

  /* ---------- 场景：星球、标签层 ---------- */
  useEffect(function () {
    const sky = skyRef.current;
    if (mode !== 'ok' || !sky) return;
    /* 同一张盘改了生辰：星球的样子是创建时定的，先拿掉再加回来 */
    const before = planetKeys.current, after = {};
    model.rows.forEach(function (r) { after[r.id] = r.key; });
    const stale = model.rows.filter(function (r) { return before[r.id] && before[r.id] !== r.key; }).map(function (r) { return r.id; });
    if (stale.length) sky.setPlanets(model.planets.filter(function (p) { return stale.indexOf(p.id) < 0; }));
    sky.setPlanets(model.planets);
    planetKeys.current = after;
    sky.layers(tagsRef.current, reticleRef.current, colRef.current);
  }, [mode, model.sig]);

  const focusId = focusRow ? focusRow.id : null;
  useEffect(function () {
    if (mode === 'ok' && skyRef.current) skyRef.current.focus(focusId);
  }, [mode, focusId]);

  /* ---------- 新星诞生（排在"星球"那个 effect 后面：这时新星已经加进场景） ---------- */
  useEffect(function () {
    const sky = skyRef.current;
    if (!birthId) return undefined;
    const id = birthId;
    let done = false, stop = null;
    const go = function () {
      if (done) return;
      done = true;
      if (stop) stop();
      leaving.current = false;
      setBirthId(null);
      store.openChart(id, { tab: 'natal', panel: true });
      setBusy(false);
    };
    if (!sky || mode !== 'ok') { go(); return undefined; }
    stop = uiLater(go, HOME_STUCK_MS + 1200);
    sky.birth(id, go);
    return function () { if (stop) stop(); };
  }, [birthId]);

  /* ---------- 进出命盘 ---------- */
  useEffect(function () {
    const prev = prevView.current;
    prevView.current = m.view;
    const sky = skyRef.current;
    if (m.view !== 'home') {
      setHoverId(null);
      setMenuId(null);
      if (!sky) return undefined;
      return uiLater(function () { if (skyRef.current === sky) sky.show(false); }, HOME_SKY_OFF_MS);
    }
    if (!seen) setSeen(true);
    if (sky) sky.show(true);
    if (prev !== 'chart') return undefined;
    if (!sky) {
      if (mode === 'pending') setBusy(true);      /* 场景马上就要来：等它画好再放出界面 */
      return undefined;
    }
    sky.rise(m.chartId, homeBg(sectionRef.current));
    if (homeMedia('(prefers-reduced-motion: reduce)')) return undefined;
    setBusy(true);
    return uiLater(function () { if (!leaving.current) setBusy(false); }, HOME_RISE_MS);
  }, [m.view, mode]);

  /* ---------- 外观变了：夜空 / 晨光跟着换（根节点的 data-theme 这时已经更新，底色读得到新的） ---------- */
  const themeSeen = useRef(props.theme);
  useEffect(function () {
    const sky = skyRef.current;
    if (themeSeen.current === props.theme) return;
    themeSeen.current = props.theme;
    if (mode !== 'ok' || !sky) return;
    sky.grade(props.theme === 'light');
    sky.scrim(homeBg(sectionRef.current));
  }, [mode, props.theme]);

  /* ---------- 操作提示：动过一次或者 14 秒后收起，这次 DSH 运行里不再出现 ---------- */
  const showGesture = mode === 'ok' && !onboarding && (!m.gestureSeen || gestureGone);
  useEffect(function () {
    if (!showGesture || gestureGone) return undefined;
    setCoarse(homeMedia('(pointer: coarse)'));
    return uiLater(function () { live.current.gestured(); }, HOME_GESTURE_MS);
  }, [showGesture, gestureGone]);

  /* 卸载时停掉还没到点的悬停定时器 */
  useEffect(function () {
    return function () {
      if (hoverOff.current) { hoverOff.current(); hoverOff.current = null; }
    };
  }, []);

  /* ---------- 渲染 ---------- */
  const emblem = useMemo(function () {
    if (!flat || !focusRow) return '';
    return ZWREPORT.emblemSvg(focusRow.chart, { id: 'zph', labels: true, label: t('homeEmblemLabel', { name: focusRow.name }) });
  }, [flat, focusRow]);

  const tags = model.rows.map(function (row) {
    return h(HomeTag, {
      key: (flat ? 'flat:' : 'sky:') + row.id, row: row, flat: flat,
      on: hoverId === row.id, menu: menuId === row.id,
      onPreview: preview, onMenu: setMenu,
      onOpen: function (id) { homeOpen(id, { tab: 'daily' }); }
    });
  });

  let talk = null;
  if (onboarding) {
    talk = h(OnboardingTalk, { key: 'onboarding', tier: props.tier, onDone: onBorn });
  } else if (focusRow) {
    const submit = function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      const q = ask.trim();
      if (!q) return;
      setAsk('');
      homeOpen(focusRow.id, { tab: 'natal', panel: true, ask: q });
    };
    talk = [
      homeStatusNode(shownRow),
      h('form', { key: 'ask', className: 'zp-ask', onSubmit: submit },
        h('input', {
          type: 'text', name: 'zp-home-ask', value: ask, 'aria-label': t('homeAskLabel'), placeholder: t('homeAskPlaceholder'),
          autoComplete: 'off', enterKeyHint: 'send',
          onChange: function (ev) { setAsk(ev.target.value); }
        }),
        h('button', { className: 'zp-send', type: 'submit', title: t('homeSend'), 'aria-label': t('homeSend') }, h(Icon, { name: 'send' }))),
      h('p', { key: 'hint', className: 'zp-hint' }),
      h('div', { key: 'chips', className: 'zp-chips' },
        h('button', { className: 'zp-chip', type: 'button', onClick: function () { homeOpen(focusRow.id, { tab: 'daily' }); } }, t('homeChipToday')),
        h('button', {
          className: 'zp-chip', type: 'button',
          onClick: function () { homeOpen(focusRow.id, { tab: 'decadal', panel: true, ask: t('homeChipDecade'), scope: true }); }
        }, t('homeChipDecade')),
        h('button', { className: 'zp-chip', type: 'button', onClick: function () { obStart(); } }, t('homeChipNew')))
    ];
  }

  /* 日期行要当天的干支：从任意一张盘今天的运限里取（没有盘时用示例盘） */
  const dayRef = model.rows.length ? model.rows[0].h : (function () {
    const sample = store.chartOf(store.entryById(SAMPLE_ID));
    return sample ? horoscopeAt(sample, today) : null;
  })();

  return h('section', {
    className: 'zp-home', ref: sectionRef,
    'data-busy': busy ? '' : undefined, 'data-onboarding': onboarding ? '' : undefined, 'data-nogl': flat ? '' : undefined
  },
  h('div', { className: 'zp-sky', 'data-region': 'HOME_SKY' },
    /* 画布的家：sky.js 把 canvas 放进来，React 不管它里面的东西 */
    h('div', { key: 'host', ref: hostRef, hidden: flat, 'aria-hidden': true }),
    h('div', { key: 'reticle', className: 'zp-reticle', ref: reticleRef, 'aria-hidden': true }),
    flat && emblem ? h('div', { key: 'emblem', className: 'zp-emblem zr-prose', dangerouslySetInnerHTML: { __html: emblem } }) : null,
    h('div', { key: 'tags', className: 'zp-planets' + (flat ? ' zp-flat' : ''), ref: tagsRef }, tags)),
  h('div', { className: 'zp-col', 'data-region': 'HOME_TALK', ref: colRef }, homeDateNode(today, dayRef), talk),
  showGesture ? h('p', { className: 'zp-gesture' + (gestureGone ? ' zp-gone' : ''), 'aria-hidden': gestureGone ? true : undefined },
    t(coarse ? 'homeGestureTouch' : 'homeGesture')) : null);
}
