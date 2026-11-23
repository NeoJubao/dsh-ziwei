/* ================================================================
 * 64-sheets：生辰表单、全部命盘（T8b）。都是 SHEET（右侧滑入的面板内浮层），结构见 css/50-parts.css。
 *
 * function SheetHost({ tier })
 *   ProApp 在 session.sheet 有值时渲染它：'birth' → 生辰表单，'charts' → 全部命盘，别的什么都不渲染。
 *   开关都走 50-parts 的 openSheet(kind, chartId) / closeLayers()；外框用 Sheet 部件（遮罩、焦点陷阱、Esc、焦点归还）。
 *
 * 生辰表单（BirthFormSheet）：v5 InputForm 的全部内容——称呼、公历 / 农历、年月日、闰月、时、分、性别、
 *   出生城市（实时提示按哪里校正）、「更多选项」里的职业和四项排盘口径（各带一行说明）。
 *   - 新建（直接填表；sheetChartId 为空，或是示例盘）：预填 v5 的表单草稿（store.api.form；挂载后在 layout effect 里读，
 *     渲染里不碰 storage），改动随手写回草稿。排盘 → store.addChart（v5 形状，最前面）、引导结束、关浮层、
 *     打开新盘的本命并打开紫微师面板（和引导问答排盘一样）。
 *   - 改生辰（sheetChartId = 命盘库里的一张）：预填这张盘的 input，不写草稿。提交 → store.updateChartInput
 *     （id、盘名不变；称呼改了且不空时一并 renameChart），关浮层；不在这张盘上时打开它。
 *   - 出错（没填年月日或钟点、时分超出范围、引擎排不出来）：留在表单里，页脚显示原因；改任何一项清掉。
 *     钟点空着不替用户默认（时辰决定命宫）；分钟空着按 0。
 * 全部命盘（ChartListSheet）：命盘库每张一行，最近打开的在前（openedAt，没打开过的按 id 里的时间；同时按库里的顺序）。
 *   一行：称呼、公历生日 YYYY.MM.DD、「X坐命 · 五行局」（命宫空宫时「命宫空宫，借X · 五行局」）；
 *   点了关浮层、进入那张盘的流日（和首页星球一样）。每行一个 ⋯ 菜单：改名（就地换成输入框，最多 12 个字，
 *   Enter 保存、Esc 取消）、改生辰（换成生辰表单）、删除（这一行先问一句，再点删除才删；store 给可撤销的提示）。
 *   空库只有一句话。
 *
 * 测试接口：ZWUi.sheets = { SheetHost, BirthFormSheet, ChartListSheet }。
 * ================================================================ */

const SHEET_FORM_ID = 'zp-birth-form';
const SHEET_CITY_LIST = 'zp-city-list';
const SHEET_NAME_MAX = 12;

function sheetSelect(s) {
  return { sheet: s.session.sheet || null, id: s.session.sheetChartId == null ? null : s.session.sheetChartId };
}

function SheetHost(props) {
  const m = useStore(sheetSelect);
  if (m.sheet === 'birth') return h(BirthFormSheet, { key: 'birth:' + (m.id || ''), chartId: m.id, tier: props.tier });
  if (m.sheet === 'charts') return h(ChartListSheet, { key: 'charts', tier: props.tier });
  return null;
}

/* ---------------- 生辰表单 ---------------- */
/* 命盘库条目的 input → 表单（出生城市框：有 city 用 city，旧条目退回籍贯 / 经度数字，和 v5 一样） */
function sheetFormOf(input) {
  const x = input || {};
  const r = readingInput(x);
  return {
    name: r.name, calendar: r.calendar, year: r.year, month: r.month, day: r.day, isLeap: r.isLeap,
    hour: r.hour, minute: r.minute, gender: r.gender, longitude: r.longitude,
    city: String(x.city || '') || String(x.place || '') || r.longitude, place: r.place, occupation: r.occupation,
    settings: Object.assign({}, DEFAULT_FORM.settings, r.settings)
  };
}

function sheetInt(v) {
  const s = String(v == null ? '' : v).trim();
  return /^\d+$/.test(s) ? +s : null;
}

/* 表单 → { input }（v5 computeFrom 的字段）或 { error } */
function sheetInputOf(f) {
  const y = sheetInt(f.year), mo = sheetInt(f.month), d = sheetInt(f.day);
  if (y === null || mo === null || d === null) return { error: t('sheetDateMissing') };
  const hh = sheetInt(f.hour);
  if (hh === null) return { error: t('sheetHourMissing') };
  const minuteText = String(f.minute == null ? '' : f.minute).trim();
  const mi = minuteText === '' ? 0 : sheetInt(minuteText);
  if (hh > 23 || mi === null || mi > 59) return { error: t('sheetTimeRange') };
  const lunar = f.calendar === 'lunar';
  let leapOk = false;
  try { leapOk = lunar && E.leapMonth(y) === mo; } catch (e) { leapOk = false; }
  const input = {
    name: String(f.name || '').trim(), calendar: lunar ? 'lunar' : 'solar', year: y, month: mo, day: d,
    isLeap: !!f.isLeap && leapOk, hour: hh, minute: mi, gender: f.gender === 'female' ? 'female' : 'male',
    longitude: f.longitude === '' || f.longitude == null ? '' : String(f.longitude),
    city: String(f.city || ''), place: String(f.place || ''), occupation: String(f.occupation || '').trim(),
    settings: Object.assign({}, DEFAULT_FORM.settings, f.settings || {})
  };
  const check = obChartOf(input);
  return check.error ? { error: check.error } : { input: input };
}

/* 这张盘是不是选了不校正（settings.trueSolar === false；没写就是校正） */
function sheetSolarOff(f) {
  return !!(f && f.settings && f.settings.trueSolar === false);
}

/* 填的是省名时举几个这个省的城市 */
const SHEET_PROVINCE_SAMPLES = 4;

function sheetCityHint(f) {
  const cityText = f.city != null ? String(f.city) : (f.place || (f.longitude === '' || f.longitude == null ? '' : String(f.longitude)));
  const parsed = parseBirthplace(cityText);
  const hasLon = !(f.longitude === '' || f.longitude == null);
  if (hasLon) {
    /* 选了不校正：经度照常记下，但不拿去校正，城市只作出生地 */
    if (sheetSolarOff(f)) {
      return { text: cityText, warn: false, hint: parsed.kind === 'city' ? t('sheetCityHintOffCity', { city: parsed.city }) : t('sheetCityHintOffLon') };
    }
    return {
      text: cityText, warn: false,
      hint: parsed.kind === 'city' ? t('sheetCityHintCity', { city: parsed.city, lon: f.longitude }) : t('sheetCityHintLon', { lon: f.longitude })
    };
  }
  /* 只认出了省：范围太大，定不了经度，请填到市 */
  if (parsed.kind === 'province') {
    return {
      text: cityText, warn: true,
      hint: t('sheetCityHintProvince', { province: parsed.province, cities: parsed.cities.slice(0, SHEET_PROVINCE_SAMPLES).join(t('sheetStarSep')) })
    };
  }
  if (parsed.kind === 'unknown') return { text: cityText, warn: true, hint: t('sheetCityHintUnknown', { text: cityText.trim() }) };
  return { text: cityText, warn: false, hint: t('sheetCityHintEmpty') };
}

/* 一个表单项：标签文字 + 控件 + 可选的一行说明 */
function sheetField(key, label, control, hint, warn) {
  return h('div', { key: key, className: 'zp-field' },
    h('span', null, label),
    control,
    hint ? h('p', { className: 'zp-field-hint' + (warn ? ' zp-err' : '') }, hint) : null);
}

function sheetNumber(key, label, value, min, max, onValue) {
  return h('input', {
    key: key, className: 'zp-input', type: 'number', inputMode: 'numeric', min: min, max: max,
    value: value == null ? '' : value, 'aria-label': label,
    onChange: function (ev) { onValue(ev.target.value); }
  });
}

function BirthFormFields(props) {
  const f = props.form;
  const set = props.set;
  const lunar = f.calendar === 'lunar';
  let leapAvailable = false;
  try { leapAvailable = lunar && E.leapMonth(+f.year) === +f.month; } catch (e) { leapAvailable = false; }
  const city = sheetCityHint(f);
  const settings = Object.assign({}, DEFAULT_FORM.settings, f.settings || {});
  const setSetting = function (k, v) {
    const next = Object.assign({}, settings);
    next[k] = v;
    set({ settings: next });
  };
  /* 真太阳时校正：只在不校正时写 trueSolar: false，校正时不留这个字段（校正的条目和以前一个样） */
  const solarOff = sheetSolarOff(f);
  const setSolar = function (v) {
    const next = Object.assign({}, settings);
    if (v === 'off') next.trueSolar = false; else delete next.trueSolar;
    set({ settings: next });
  };
  const onCity = function (v) {
    const r = parseBirthplace(v);
    set({
      city: v,
      longitude: r.lon == null ? '' : String(r.lon),
      place: r.kind === 'city' ? r.city : (r.kind === 'unknown' || r.kind === 'province' ? String(v).trim() : '')
    });
  };
  const choice = function (key, labelKey, hintKey, value, items) {
    return sheetField(key, t(labelKey), h(Seg, {
      radio: true, label: t(labelKey), value: value, items: items, onChange: function (v) { setSetting(key, v); }
    }), t(hintKey));
  };
  return h('form', {
    id: SHEET_FORM_ID, noValidate: true, autoComplete: 'off',
    onSubmit: function (ev) { if (ev && typeof ev.preventDefault === 'function') ev.preventDefault(); props.onSubmit(); }
  },
  sheetField('name', t('sheetName'), h('input', {
    className: 'zp-input', type: 'text', value: f.name || '', maxLength: SHEET_NAME_MAX, placeholder: t('sheetNamePh'),
    'aria-label': t('sheetName'), onChange: function (ev) { set({ name: ev.target.value }); }
  })),
  sheetField('calendar', t('sheetCalendar'), h(Seg, {
    radio: true, label: t('sheetCalendar'), value: lunar ? 'lunar' : 'solar',
    items: [{ id: 'solar', label: t('obSolar') }, { id: 'lunar', label: t('obLunar') }],
    onChange: function (v) { set({ calendar: v, isLeap: false }); }
  })),
  sheetField('date', t('sheetDateLabel'), h('div', { className: 'zp-field-row' },
    sheetNumber('y', t('sheetYear'), f.year, 1900, 2100, function (v) { set({ year: v, isLeap: false }); }),
    sheetNumber('m', t('sheetMonth'), f.month, 1, 12, function (v) { set({ month: v, isLeap: false }); }),
    sheetNumber('d', t('sheetDay'), f.day, 1, lunar ? 30 : 31, function (v) { set({ day: v }); }),
    lunar ? h('label', { key: 'leap', className: 'zp-check' },
      h('input', {
        type: 'checkbox', checked: !!f.isLeap && leapAvailable, disabled: leapAvailable ? undefined : true, 'aria-label': t('sheetLeap'),
        onChange: function (ev) { set({ isLeap: !!ev.target.checked }); }
      }),
      h('span', null, t('sheetLeap'))) : null)),
  sheetField('time', t('sheetTime'), h('div', { className: 'zp-field-row' },
    sheetNumber('h', t('sheetHour'), f.hour, 0, 23, function (v) { set({ hour: v }); }),
    sheetNumber('mi', t('sheetMinute'), f.minute, 0, 59, function (v) { set({ minute: v }); }))),
  sheetField('gender', t('sheetGender'), h(Seg, {
    radio: true, label: t('sheetGender'), value: f.gender === 'female' ? 'female' : 'male',
    items: [{ id: 'male', label: t('obMale') }, { id: 'female', label: t('obFemale') }],
    onChange: function (v) { set({ gender: v }); }
  })),
  sheetField('city', t('sheetCity'), [
    h('input', {
      key: 'in', className: 'zp-input', type: 'text', value: city.text, maxLength: 30, list: SHEET_CITY_LIST,
      placeholder: t('sheetCityPh'), 'aria-label': t('sheetCity'), onChange: function (ev) { onCity(ev.target.value); }
    }),
    /* 候选只列不带省也能认的名字（青海的海南州要写成「青海海南」，单写「海南」是省） */
    h('datalist', { key: 'list', id: SHEET_CITY_LIST }, CITY_NAMES_BARE.map(function (nm) { return h('option', { key: nm, value: nm }); }))
  ], city.hint, city.warn),
  /* 和年界、月界那几项一样是这张盘的口径，但放在主区域：它直接决定时辰 */
  sheetField('solar', t('sheetSolar'), h(Seg, {
    radio: true, label: t('sheetSolar'), value: solarOff ? 'off' : 'on',
    items: [{ id: 'on', label: t('sheetSolarOn') }, { id: 'off', label: t('sheetSolarOff') }],
    onChange: setSolar
  }), t('sheetSolarHint')),
  h('details', { className: 'zp-more' },
    h('summary', null, t('sheetMoreOptions')),
    sheetField('occupation', t('sheetOccupation'), h('input', {
      className: 'zp-input', type: 'text', value: f.occupation || '', maxLength: 60, placeholder: t('sheetOccupationPh'),
      'aria-label': t('sheetOccupation'), onChange: function (ev) { set({ occupation: ev.target.value }); }
    })),
    choice('yearDivide', 'sheetYearDivide', 'sheetYearDivideHint', settings.yearDivide,
      [{ id: 'normal', label: t('sheetYdNormal') }, { id: 'exact', label: t('sheetYdExact') }]),
    choice('monthDivide', 'sheetMonthDivide', 'sheetMonthDivideHint', settings.monthDivide,
      [{ id: 'normal', label: t('sheetMdNormal') }, { id: 'exact', label: t('sheetMdExact') }]),
    choice('dayDivide', 'sheetDayDivide', 'sheetDayDivideHint', settings.dayDivide,
      [{ id: 'forward', label: t('sheetDdForward') }, { id: 'current', label: t('sheetDdCurrent') }]),
    choice('fixLeap', 'sheetFixLeap', 'sheetFixLeapHint', settings.fixLeap,
      [{ id: true, label: t('sheetFlTrue') }, { id: false, label: t('sheetFlFalse') }])));
}

function BirthFormSheet(props) {
  const store = appStore();
  /* 打开时定下来：改哪张盘（示例盘、找不到的盘都按新建，示例盘的生辰作预填） */
  const [target] = useState(function () {
    const e = props.chartId ? store.entryById(props.chartId) : null;
    return e ? { id: e.sample ? null : e.id, input: e.input } : null;
  });
  const editId = target && target.id ? target.id : null;
  const [form, setForm] = useState(function () { return target ? sheetFormOf(target.input) : null; });
  const [error, setError] = useState('');
  /* 新建：草稿在 storage 里，挂载后读（渲染里不碰 storage）；layout effect 里设，第一帧画出来之前就换上 */
  useLayoutEffect(function () {
    if (form === null) setForm(appStore().api.form.load());
  }, []);

  const set = function (patch) {
    const next = Object.assign({}, form, patch);
    setForm(next);
    if (error) setError('');
    if (!editId) appStore().api.form.save(next);
  };
  const submit = function () {
    if (!form) return;
    const r = sheetInputOf(form);
    if (r.error) { setError(r.error); return; }
    const st = appStore();
    if (editId) {
      const before = st.entryById(editId);
      const updated = st.updateChartInput(editId, r.input);
      if (updated) {
        const oldName = String((before && before.input && before.input.name) || '');
        if (r.input.name && r.input.name !== oldName) st.renameChart(editId, r.input.name);
        closeLayers();
        const s = st.getState().session;
        if (!(s.view === 'chart' && s.chartId === editId)) st.openChart(editId);
        return;
      }
      /* 这张盘在表单开着的时候被删了：按新建存 */
    }
    const entry = st.addChart(r.input, r.input.name);
    if (!entry) return;
    st.patchSession({ onboarding: null });
    closeLayers();
    st.openChart(entry.id, { tab: 'natal', panel: true });
  };

  const footer = [
    error ? h('p', { key: 'err', className: 'zp-field-hint zp-err', role: 'alert' }, error) : null,
    h('button', {
      key: 'go', className: 'zp-btn-primary', type: 'submit', form: SHEET_FORM_ID, disabled: form ? undefined : true
    }, editId ? t('sheetRecompute') : t('obDraw'))
  ];
  return h(Sheet, { title: editId ? t('headEditBirth') : t('sheetNewTitle'), onClose: closeLayers, footer: footer },
    form ? h(BirthFormFields, { form: form, set: set, onSubmit: submit }) : null);
}

/* ---------------- 全部命盘 ---------------- */
function sheetSelectLibrary(s) {
  return s.library;
}

function sheetSoulLine(chart) {
  if (!chart) return '';
  const st = soulStars(chart);
  return t(st.borrowed ? 'sheetSoulBorrowed' : 'sheetSoulLine', { stars: st.names.join(t('sheetStarSep')), five: chart.fiveElementsClass || '' });
}

/* 最近打开的在前：openedAt，没打开过的按 id 里的时间；一样时按命盘库的顺序（和 store.api.library.recent 同一个排法） */
function sheetRowsOf(library, store) {
  const when = function (e) { return +(e && e.openedAt) || libIdTime(e); };
  return library.map(function (e, i) { return { e: e, i: i }; })
    .sort(function (a, b) { return (when(b.e) - when(a.e)) || (a.i - b.i); })
    .map(function (x) {
      const chart = store.chartOf(x.e);
      return {
        id: x.e.id, name: String(x.e.name || ''),
        birth: chart ? String(chart.solarDate || '').replace(/-/g, '.') : '', line: sheetSoulLine(chart)
      };
    });
}

function ChartListSheet() {
  const library = useStore(sheetSelectLibrary);
  const store = appStore();
  const rows = useMemo(function () { return sheetRowsOf(library, store); }, [library]);
  /* 这一行正在改名或在问要不要删：{ id, kind: 'rename' | 'delete' }；只在组件里（不值得跨卸载留着） */
  const [mode, setMode] = useState(null);
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const renameRef = useRef(null);
  const askRef = useRef(null);
  const focusNext = useRef(null);

  /* 换了一行的样子之后把焦点放到该去的地方：改名框、"取消"、回到那一行、或删完之后的第一行 */
  useEffect(function () {
    const want = focusNext.current;
    if (!want) return;
    focusNext.current = null;
    let el = null;
    if (want === 'rename') el = renameRef.current;
    else if (want === 'ask') el = askRef.current;
    else {
      const box = listRef.current;
      if (box && typeof box.querySelector === 'function') {
        if (want.indexOf('row:') === 0) el = box.querySelector('[data-cid="' + want.slice(4) + '"]');
        if (!el) el = box.querySelector('.zp-list-open');
      }
    }
    if (el) {
      focusQuietly(el);
      if (want === 'rename' && typeof el.select === 'function') el.select();
    }
  });

  const startRename = function (row) {
    setDraft(row.name);
    setMode({ id: row.id, kind: 'rename' });
    focusNext.current = 'rename';
  };
  const startDelete = function (row) {
    setMode({ id: row.id, kind: 'delete' });
    focusNext.current = 'ask';
  };
  const endMode = function (row) {
    setMode(null);
    focusNext.current = 'row:' + row.id;
  };
  const saveRename = function (row) {
    const nm = Array.from(String(draft || '').trim()).slice(0, SHEET_NAME_MAX).join('').trim();
    if (nm && nm !== row.name) {
      const e = store.renameChart(row.id, nm);
      if (e) store.showToast(t('sheetRenamed', { name: e.name }));
    }
    endMode(row);
  };
  const remove = function (row) {
    setMode(null);
    focusNext.current = 'first';
    store.removeChart(row.id);
  };
  const open = function (row) {
    closeLayers();
    store.openChart(row.id, { tab: 'daily' });
  };
  const onEsc = function (row) {
    return function (ev) {
      if (ev.key !== 'Escape' || isComposingKey(ev)) return;
      ev.stopPropagation();
      endMode(row);
    };
  };

  const items = rows.map(function (row) {
    const kind = mode && mode.id === row.id ? mode.kind : null;
    if (kind === 'rename') {
      return h('li', { key: row.id, className: 'zp-list-item', onKeyDown: onEsc(row) },
        h('input', {
          className: 'zp-input', type: 'text', value: draft, maxLength: SHEET_NAME_MAX, 'aria-label': t('sheetRenameLabel'), ref: renameRef,
          onChange: function (ev) { setDraft(ev.target.value); },
          onKeyDown: function (ev) {
            if (ev.key !== 'Enter' || isComposingKey(ev)) return;
            ev.preventDefault();
            saveRename(row);
          }
        }),
        h('button', { className: 'zp-btn zp-sm', type: 'button', onClick: function () { saveRename(row); } }, t('sheetSave')),
        h('button', { className: 'zp-btn zp-sm', type: 'button', onClick: function () { endMode(row); } }, t('obCancel')));
    }
    if (kind === 'delete') {
      return h('li', { key: row.id, className: 'zp-list-item', onKeyDown: onEsc(row) },
        h('span', { className: 'zp-list-ask' }, t('sheetDeleteAsk', { name: row.name })),
        h('button', { className: 'zp-btn zp-sm zp-danger', type: 'button', onClick: function () { remove(row); } }, t('sheetDelete')),
        h('button', { className: 'zp-btn zp-sm', type: 'button', ref: askRef, onClick: function () { endMode(row); } }, t('obCancel')));
    }
    return h('li', { key: row.id, className: 'zp-list-item' },
      h('button', { className: 'zp-list-open', type: 'button', 'data-cid': row.id, onClick: function () { open(row); } },
        h('span', { className: 'zp-list-name' }, row.name || t('headUnnamed')),
        h('span', { className: 'zp-list-meta' }, row.birth),
        row.line ? h('span', { className: 'zp-list-meta' }, row.line) : null),
      h(Menu, {
        label: t('sheetRowMenu', { name: row.name }),
        items: [
          { id: 'rename', label: t('sheetRename'), onSelect: function () { startRename(row); } },
          { id: 'birth', label: t('headEditBirth'), onSelect: function () { openSheet('birth', row.id); } },
          { id: 'delete', label: t('sheetDelete'), danger: true, onSelect: function () { startDelete(row); } }
        ]
      }));
  });

  return h(Sheet, { title: t('headAllCharts'), onClose: closeLayers },
    rows.length
      ? h('ul', { className: 'zp-list', ref: listRef }, items)
      : h('p', { className: 'zp-list-empty' }, t('sheetListEmpty')));
}

ZWUI.sheets = { SheetHost: SheetHost, BirthFormSheet: BirthFormSheet, ChartListSheet: ChartListSheet };
