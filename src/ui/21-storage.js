/* 21-storage：本机存储——命盘库、解读记录、偏好、一次性导入（T3a）
 *
 * createStorageApi(storage, { now }) 返回一组读写函数；storage 是和 localStorage 同接口的对象
 * （getItem / setItem / removeItem），也可以是返回这种对象的函数（取的时候才拿，见文末的默认实例）。
 * 自检在 vm 里注入内存版 storage 和假时钟。
 *
 * 键和记录结构沿用 v5，含义不变（spec §4.3）：
 *   ziwei-pro.library        命盘库 [{ id: 'lib-<毫秒>', name, input, openedAt? }]，最多 60 条，新→旧
 *   ziwei-pro.readings.v2    { [命盘 key]: { thread, report, studioTab, name, updatedAt } }，最多 8 张盘
 *   ziwei-pro.readings.v1    旧版记录（9 段 key），读到时迁进 v2
 *   ziwei-pro.lastChart.v1   上次打开的盘（readingInput 的形状）
 *   ziwei-pro.form / ziwei-pro.formV133   生辰表单草稿 / v1.3.3 的一次性迁移标记
 *   ziwei-pro.autopen / ziwei-pro.showadj 偏好（'1' 开）
 *   ziwei-pro.sky（新）      首页 3D 星图（'0' 关，其余开）
 *   ziwei-pro.theme（新）    外观：'dark'（默认）/ 'light' / 'auto'（跟随 DSH）；没有这个键或值不认识按 'dark'
 *   ziwei-pro.model（新）    紫微师用的模型 { provider, model }；没有这个键 = 跟随 DSH 的默认模型
 *   ziwei-pro.v6（新）       '1' = 已做过一次性导入（上次命盘和解读记录进命盘库）
 * v5 的 ziwei-pro.studio / .rail / .focus 不读不写，也不删。
 * 所有读写都包在 try/catch 里：storage 拿不到、读写抛错（隐私模式、配额满、沙箱 iframe）时返回默认值，不外抛。 */

const READINGS_KEY = 'ziwei-pro.readings.v2';
const READINGS_V1_KEY = 'ziwei-pro.readings.v1';
const LAST_CHART_KEY = 'ziwei-pro.lastChart.v1';
const LIBRARY_KEY = 'ziwei-pro.library';
const V6_IMPORT_KEY = 'ziwei-pro.v6';
const READINGS_MAX = 8;
const LIBRARY_MAX = 60;
const LIBRARY_NAME_MAX = 12;
const LIBRARY_RECENT = 8;

/* ---------------- 解读记录的纯函数（v5 原样） ----------------
   同一生辰 + 同一排盘设置视为同一张盘；聊天、完整报告、最后停留的页签一起保存。
   只写浏览器本地，不上传；最多 8 张盘，每张最多 24 条消息。 */
function emptyReport() {
  return { status: 'idle', text: '', startedAt: 0, finishedAt: 0, error: '', issue: null };
}
ZWUI.emptyReport = emptyReport;

function normalizeReport(r) {
  if (!r || typeof r !== 'object') return emptyReport();
  let status = ['idle', 'running', 'done', 'error'].indexOf(r.status) >= 0 ? r.status : 'idle';
  /* 刷新/重开时不可能真的还在跑，恢复成可继续的错误态 */
  if (status === 'running') status = 'error';
  return {
    status: status,
    text: String(r.text || '').slice(0, 120000),
    startedAt: +r.startedAt || 0,
    finishedAt: +r.finishedAt || 0,
    error: String(r.error || ''),
    issue: r.issue || null
  };
}
ZWUI.normalizeReport = normalizeReport;

function readingInput(input) {
  const x = input || {};
  let lon = x.longitude;
  lon = (lon === '' || lon === null || lon === undefined) ? '' : String(+lon);
  return {
    name: String(x.name || ''),
    calendar: x.calendar === 'lunar' ? 'lunar' : 'solar',
    year: +x.year || 0,
    month: +x.month || 0,
    day: +x.day || 0,
    isLeap: !!x.isLeap,
    hour: +x.hour || 0,
    minute: +x.minute || 0,
    gender: x.gender === 'female' ? 'female' : 'male',
    longitude: lon,
    place: String(x.place || ''),
    occupation: String(x.occupation || ''),
    settings: Object.assign({}, x.settings || {})
  };
}
ZWUI.readingInput = readingInput;

/* 真太阳时校正是每张盘的口径：settings.trueSolar === false 是不校正，没写或是别的值都是校正（有经度才校正得了）。
   这里是交给引擎、也是进命盘 key 的经度：不校正时是空的。条目里原始的 longitude / city / place 照常留着，
   只是不拿去校正。不校正的盘和「同生辰、没填城市」的盘算出来是同一张盘，所以 key 也相同。 */
function effectiveLongitude(input) {
  const x = readingInput(input);
  return x.settings && x.settings.trueSolar === false ? '' : x.longitude;
}
ZWUI.effectiveLongitude = effectiveLongitude;

/* 命盘 key：生辰 + 排盘口径，不含称呼。
   calendar|year|month|day|leap|hour|minute|gender|longitude|yearDivide,monthDivide,dayDivide,fixLeap
   longitude 那一段是 effectiveLongitude（不校正的盘是空的）；格式没变。 */
function readingKeyOf(input) {
  const x = readingInput(input);
  const st = x.settings || {};
  /* 排盘设置会改变命盘（月柱口径 / 晚子时 / 闰月），必须进 key，否则换设置会套回旧解读 */
  const settingsKey = [st.yearDivide || 'normal', st.monthDivide || 'exact', st.dayDivide || 'current', st.fixLeap === false ? 0 : 1].join(',');
  return [x.calendar, x.year, x.month, x.day, x.isLeap ? 1 : 0, x.hour, x.minute, x.gender, effectiveLongitude(x), settingsKey].join('|');
}
ZWUI.readingKeyOf = readingKeyOf;

function cleanThread(thread) {
  return (Array.isArray(thread) ? thread : []).slice(-24).map(function (m) {
    return {
      role: m && m.role === 'user' ? 'user' : 'assistant',
      content: String((m && m.content) || '').slice(0, 60000)
    };
  }).filter(function (m) { return m.role === 'user' || m.content; });
}
ZWUI.cleanThread = cleanThread;

function trimReadings(map) {
  const keys = Object.keys(map).sort(function (a, b) { return (map[b].updatedAt || 0) - (map[a].updatedAt || 0); });
  keys.slice(READINGS_MAX).forEach(function (k) { delete map[k]; });
  return map;
}

/* 从命盘 key 还原生辰输入（一次性导入用）。10 段是 v2 的 key；9 段是 v1 的生辰前缀，口径取默认值。
   认不出的 key 返回 null。 */
function inputFromReadingKey(key) {
  const seg = String(key == null ? '' : key).split('|');
  if (seg.length !== 9 && seg.length !== 10) return null;
  const isInt = function (s) { return /^\d+$/.test(s); };
  if (seg[0] !== 'solar' && seg[0] !== 'lunar') return null;
  if (!isInt(seg[1]) || !isInt(seg[2]) || !isInt(seg[3]) || !isInt(seg[5]) || !isInt(seg[6])) return null;
  if (seg[4] !== '0' && seg[4] !== '1') return null;
  if (seg[7] !== 'male' && seg[7] !== 'female') return null;
  if (seg[8] !== '' && !/^-?\d+(\.\d+)?$/.test(seg[8])) return null;
  const year = +seg[1], month = +seg[2], day = +seg[3], hour = +seg[5], minute = +seg[6];
  if (!(year > 0) || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  let settings = Object.assign({}, DEFAULT_FORM.settings);
  if (seg.length === 10) {
    const st = seg[9].split(',');
    if (st.length !== 4 || !st[0] || !st[1] || !st[2] || (st[3] !== '0' && st[3] !== '1')) return null;
    settings = { yearDivide: st[0], monthDivide: st[1], dayDivide: st[2], fixLeap: st[3] === '1' };
  }
  return {
    name: '', calendar: seg[0], year: year, month: month, day: day, isLeap: seg[4] === '1',
    hour: hour, minute: minute, gender: seg[7], longitude: seg[8], city: '', place: '', occupation: '',
    settings: settings
  };
}
ZWUI.inputFromReadingKey = inputFromReadingKey;

/* 命盘库条目的 input：v5 saveChart 写的那些字段，顺序也一样。 */
function libraryInput(input) {
  const x = input || {};
  const r = readingInput(x);
  return {
    name: r.name, calendar: r.calendar, year: r.year, month: r.month, day: r.day,
    isLeap: r.isLeap, hour: r.hour, minute: r.minute, gender: r.gender,
    longitude: r.longitude, city: String(x.city || ''), place: r.place, occupation: r.occupation,
    settings: Object.assign({}, DEFAULT_FORM.settings, r.settings)
  };
}

/* 不填名时的盘名：和 v5 saveChart 一样，用引擎算出公历日期和时辰（这张盘校正的话是校正后的），
   交给 autoChartName；引擎不可用时按输入的日期、不带时辰。labels 是性别的叫法，默认男 / 女。 */
function defaultChartName(input, labels) {
  const x = readingInput(input);
  const named = { name: x.name, year: x.year, month: x.month, day: x.day, gender: x.gender };
  let timeName = '';
  const lon = effectiveLongitude(x);
  try {
    if (E && typeof E.computeChart === 'function') {
      const c = E.computeChart({
        calendar: x.calendar, year: x.year, month: x.month, day: x.day, isLeapMonth: x.isLeap,
        hour: x.hour, minute: x.minute, gender: x.gender,
        longitude: lon === '' ? undefined : +lon,
        settings: x.settings
      });
      if (c && !c.error) {
        const sd = String(c.solarDate || '').split('-');
        if (sd.length === 3) { named.year = sd[0]; named.month = sd[1]; named.day = sd[2]; }
        timeName = c.timeName || '';
      }
    }
  } catch (e) { /* 没有引擎：按输入日期命名 */ }
  return autoChartName(named, timeName, labels);
}
ZWUI.defaultChartName = defaultChartName;

/* 命盘库条目 id 里的时间（lib-<毫秒>）。命盘库按这个时间新→旧排列。 */
function libIdTime(entry) {
  return +String((entry && entry.id) || '').replace('lib-', '') || 0;
}

/* 按 id 时间插回：插在第一条比它早的条目前面（v5 撤销删除的做法） */
function insertByTime(list, entry) {
  const ts = libIdTime(entry);
  let at = -1;
  for (let i = 0; i < list.length; i++) { if (libIdTime(list[i]) < ts) { at = i; break; } }
  list.splice(at < 0 ? list.length : at, 0, entry);
  return list;
}

/* 'lib-' + 毫秒；同一毫秒已有条目时往后挪一毫秒，保证不重复 */
function uniqueLibId(list, ts) {
  const taken = {};
  list.forEach(function (e) { if (e && e.id) taken[e.id] = true; });
  let n = Math.max(0, Math.floor(+ts || 0));
  while (taken['lib-' + n]) n++;
  return 'lib-' + n;
}

function createStorageApi(storage, opts) {
  const o = opts || {};
  const now = typeof o.now === 'function' ? o.now : function () { return Date.now(); };
  const src = typeof storage === 'function' ? storage : function () { return storage; };
  const get = function (k) {
    try { const s = src(); return s ? s.getItem(k) : null; } catch (e) { return null; }
  };
  const set = function (k, v) {
    try { const s = src(); if (!s) return false; s.setItem(k, v); return true; } catch (e) { return false; }
  };
  const remove = function (k) {
    try { const s = src(); if (s) s.removeItem(k); } catch (e) { /* ignore */ }
  };
  const copy = function (x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); };

  /* ---------------- 解读记录（v5 原样，localStorage 换成注入的 storage） ---------------- */
  function readStorageMap(key) {
    try {
      const raw = JSON.parse(get(key) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) { return {}; }
  }
  function loadReadingMap() { return readStorageMap(READINGS_KEY); }
  function loadLegacyReadingMap() { return readStorageMap(READINGS_V1_KEY); }
  function writeReadingMap(map) {
    return set(READINGS_KEY, JSON.stringify(map));
  }
  function saveReadingRecord(key, data) {
    if (!key) return;
    const map = loadReadingMap();
    const thread = cleanThread(data && data.thread);
    const report = normalizeReport(data && data.report);
    if (!thread.length && !String(report.text || '').trim()) {
      delete map[key];
      writeReadingMap(map);
      return;
    }
    map[key] = {
      thread: thread,
      report: report.text ? report : null,
      studioTab: data && data.studioTab === 'report' ? 'report' : 'chat',
      name: String((data && data.name) || ''),
      updatedAt: now()
    };
    trimReadings(map);
    let tries = 0;
    /* 写不下（配额满）就挤掉最旧的一张再试 */
    while (!writeReadingMap(map) && tries < READINGS_MAX) {
      tries++;
      const keys = Object.keys(map).sort(function (a, b) { return (map[a].updatedAt || 0) - (map[b].updatedAt || 0); });
      if (!keys.length) break;
      delete map[keys[0]];
    }
  }
  function findLegacyReading(key) {
    if (!key) return null;
    /* v1 key = 前 9 段生辰；v1.7 起第 10 段是排盘设置。旧记录可迁移一次。 */
    const prefix = String(key).split('|').slice(0, 9).join('|');
    const map = loadLegacyReadingMap();
    let hit = null;
    Object.keys(map).some(function (k) {
      if (k === prefix || k.indexOf(prefix + '|') === 0) { hit = map[k]; return true; }
      return false;
    });
    if (!hit) return null;
    const thread = cleanThread(hit.thread);
    let report = emptyReport();
    if (hit.hasReport) {
      for (let i = thread.length - 1; i >= 0; i--) {
        if (thread[i].role === 'assistant' && thread[i].content) {
          report = { status: 'done', text: thread[i].content, startedAt: 0, finishedAt: 0, error: '', issue: null };
          break;
        }
      }
    }
    return { thread: thread, report: report.status === 'done' ? report : null, studioTab: 'chat', updatedAt: hit.updatedAt || 0 };
  }
  function loadReadingRecord(key) {
    if (!key) return null;
    let rec = loadReadingMap()[key];
    let fromLegacy = false;
    if (!rec) { rec = findLegacyReading(key); fromLegacy = !!rec; }
    if (!rec || typeof rec !== 'object') return null;
    const thread = cleanThread(rec.thread);
    const report = normalizeReport(rec.report);
    if (!thread.length && !String(report.text || '').trim()) return null;
    /* v1 → v2 只迁一次：v5 是换盘后由落盘 effect 顺手写进 v2，v6 在第一次读到时写进 v2，之后读的都是 v2。
       v1 原样保留（v5 也不删；清掉这张盘时一起清）。 */
    if (fromLegacy) saveReadingRecord(key, { thread: thread, report: report, studioTab: rec.studioTab, name: '' });
    return {
      thread: thread,
      report: report,
      studioTab: rec.studioTab === 'report' ? 'report' : 'chat',
      name: String(rec.name || ''),
      updatedAt: rec.updatedAt || 0
    };
  }
  function clearReadingRecord(key) {
    if (!key) return;
    const map = loadReadingMap();
    let changed = false;
    if (map[key]) { delete map[key]; changed = true; }
    if (changed) writeReadingMap(map);
    /* 清掉同生辰的旧版记录，避免迁移后残留 */
    const legacy = loadLegacyReadingMap();
    const prefix = String(key).split('|').slice(0, 9).join('|');
    let legacyChanged = false;
    Object.keys(legacy).forEach(function (k) {
      if (k === prefix || k.indexOf(prefix + '|') === 0) { delete legacy[k]; legacyChanged = true; }
    });
    if (legacyChanged) set(READINGS_V1_KEY, JSON.stringify(legacy));
  }
  /* 「清除本机记录」：所有对话和报告（v2 + v1）和上次命盘；命盘库不动 */
  function clearLocalRecords() {
    remove(READINGS_KEY);
    remove(READINGS_V1_KEY);
    remove(LAST_CHART_KEY);
  }
  function saveLastChart(input) {
    set(LAST_CHART_KEY, JSON.stringify(readingInput(input)));
  }
  function loadLastChart() {
    try {
      const raw = JSON.parse(get(LAST_CHART_KEY) || 'null');
      return raw && raw.year ? readingInput(raw) : null;
    } catch (e) { return null; }
  }

  /* ---------------- 生辰表单草稿（v5 原样） ---------------- */
  function loadForm() {
    const init = Object.assign({}, DEFAULT_FORM, { settings: Object.assign({}, DEFAULT_FORM.settings) });
    try {
      const saved = JSON.parse(get('ziwei-pro.form') || 'null');
      if (saved && typeof saved === 'object') {
        Object.keys(init).forEach(function (k) { if (saved[k] !== undefined) init[k] = saved[k]; });
        if (saved.settings && typeof saved.settings === 'object') init.settings = Object.assign({}, init.settings, saved.settings);
      }
    } catch (e) { /* ignore */ }
    /* v1.3.3 一次性迁移：旧版把默认 monthDivide='normal'（农历月）连同表单一起持久化，
       升级后仅改默认值不会生效；这里把「旧默认」改写成节气并写回，只做一次。
       迁移之后用户显式选择的「农历月」不会再被覆盖。 */
    try {
      const s = src();
      if (s && !s.getItem('ziwei-pro.formV133')) {
        if (init.settings && init.settings.monthDivide === 'normal') {
          init.settings = Object.assign({}, init.settings, { monthDivide: 'exact' });
          try { s.setItem('ziwei-pro.form', JSON.stringify(init)); } catch (e) { /* ignore */ }
        }
        s.setItem('ziwei-pro.formV133', '1');
      }
    } catch (e) { /* ignore */ }
    return init;
  }
  function saveForm(form) {
    set('ziwei-pro.form', JSON.stringify(form));
  }

  /* ---------------- 偏好 ---------------- */
  const prefs = {
    /* 自动打开面板：默认关（不劫持主面板；用户可在设置里开启） */
    autoOpen: function () {
      try { const s = src(); return !!s && s.getItem('ziwei-pro.autopen') === '1'; } catch (e) { return false; }
    },
    setAutoOpen: function (v) { set('ziwei-pro.autopen', v ? '1' : '0'); },
    showAdj: function () {
      try { const s = src(); return !!s && s.getItem('ziwei-pro.showadj') === '1'; } catch (e) { return false; }
    },
    setShowAdj: function (v) { set('ziwei-pro.showadj', v ? '1' : '0'); },
    /* 首页 3D 星图：只有 '0' 是关 */
    sky: function () {
      try { const s = src(); return !s || s.getItem('ziwei-pro.sky') !== '0'; } catch (e) { return true; }
    },
    setSky: function (v) { set('ziwei-pro.sky', v ? '1' : '0'); },
    /* 外观：没有这个键、或值不认识，都按深色 */
    theme: function () {
      try { const s = src(); return themePrefOf(s ? s.getItem('ziwei-pro.theme') : null); } catch (e) { return 'dark'; }
    },
    setTheme: function (v) { set('ziwei-pro.theme', themePrefOf(v)); },
    /* 紫微师用的模型：null = 跟随 DSH 默认（这时不留这个键） */
    model: function () {
      try { return modelPrefOf(JSON.parse(get('ziwei-pro.model') || 'null')); } catch (e) { return null; }
    },
    setModel: function (v) {
      const m = modelPrefOf(v);
      if (m) set('ziwei-pro.model', JSON.stringify(m)); else remove('ziwei-pro.model');
    }
  };

  /* 旧版曾在 localStorage 明文保存 DeepSeek API Key（已无消费方），启动时清掉残留 */
  function cleanupLegacy() {
    try { const s = src(); if (s) s.removeItem('ziwei-workbench.apikey'); } catch (e) { /* ignore */ }
  }

  /* ---------------- 命盘库 ----------------
     第一次用时从 storage 读，之后留在本实例里、每次改动写穿（v5 也是 state + 写 localStorage）：
     写不进去（隐私模式、配额满）时本次会话里照样能用。storage 里的值读不出来（不是 JSON 数组）时按空库处理，
     和 v5 一样下次保存会覆盖它；但一次性导入遇到这种情况跳过，不去覆盖。 */
  let libCache = null;
  let libReadable = true;
  function readLibrary() {
    if (libCache) return libCache;
    let raw = null;
    try { const s = src(); raw = s ? s.getItem(LIBRARY_KEY) : null; } catch (e) { raw = null; libReadable = false; }
    let list = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed; else libReadable = false;
      } catch (e) { libReadable = false; }
    }
    libCache = list;
    return libCache;
  }
  function writeLibrary(list) {
    libCache = list;
    return set(LIBRARY_KEY, JSON.stringify(list));
  }
  function indexOfId(list, id) {
    for (let i = 0; i < list.length; i++) { if (list[i] && list[i].id === id) return i; }
    return -1;
  }
  function done(entry, list) { return { entry: copy(entry), list: copy(list) }; }

  const library = {
    list: function () { return copy(readLibrary()); },
    /* 新增：排在最前，最多 60 条（挤掉最旧的）；name 空时自动命名（labels 是性别叫法） */
    add: function (input, name, labels) {
      const list = readLibrary();
      const entry = {
        id: uniqueLibId(list, now()),
        name: String(name || '').trim() || defaultChartName(input, labels),
        input: libraryInput(input)
      };
      const next = [entry].concat(list).slice(0, LIBRARY_MAX);
      writeLibrary(next);
      return done(entry, next);
    },
    /* 改名：去首尾空白、最多 12 个字；entry.name 和 entry.input.name 一起改。空名或找不到返回 null */
    rename: function (id, name) {
      const nm = Array.from(String(name == null ? '' : name).trim()).slice(0, LIBRARY_NAME_MAX).join('').trim();
      if (!nm) return null;
      const list = readLibrary();
      const i = indexOfId(list, id);
      if (i < 0) return null;
      const entry = Object.assign({}, list[i], { name: nm, input: Object.assign({}, list[i].input || {}, { name: nm }) });
      const next = list.slice();
      next[i] = entry;
      writeLibrary(next);
      return done(entry, next);
    },
    /* 改生辰：id 和盘名不变，key 随之改变；旧 key 下的对话和报告留在原处 */
    updateInput: function (id, input) {
      const list = readLibrary();
      const i = indexOfId(list, id);
      if (i < 0) return null;
      const entry = Object.assign({}, list[i], { input: libraryInput(Object.assign({}, list[i].input || {}, input || {})) });
      const next = list.slice();
      next[i] = entry;
      writeLibrary(next);
      return done(entry, next);
    },
    /* 删除：返回 { entry, index, list }，交给 undo 撤销 */
    remove: function (id) {
      const list = readLibrary();
      const i = indexOfId(list, id);
      if (i < 0) return null;
      const removed = list[i];
      const next = list.slice();
      next.splice(i, 1);
      writeLibrary(next);
      return { entry: copy(removed), index: i, list: copy(next) };
    },
    /* 撤销删除 = 把这一条按 id 里的时间插回当前列表；不用删除前的快照覆盖（会丢掉之后新存的盘）。已经在了就不动 */
    undo: function (removed) {
      const entry = removed && removed.entry ? removed.entry : removed;
      if (!entry || !entry.id) return null;
      const list = readLibrary();
      if (indexOfId(list, entry.id) >= 0) return done(entry, list);
      const next = insertByTime(list.slice(), copy(entry));
      writeLibrary(next);
      return done(entry, next);
    },
    /* 打开一张盘：记下 openedAt（毫秒），不改顺序 */
    touch: function (id) {
      const list = readLibrary();
      const i = indexOfId(list, id);
      if (i < 0) return null;
      const entry = Object.assign({}, list[i], { openedAt: now() });
      const next = list.slice();
      next[i] = entry;
      writeLibrary(next);
      return done(entry, next);
    },
    /* 最近 n 张（默认 8，首页星球用）：按 openedAt 新→旧，没打开过的按 id 里的时间 */
    recent: function (n) {
      const k = n === undefined ? LIBRARY_RECENT : Math.max(0, Math.floor(+n) || 0);
      const when = function (e) { return +(e && e.openedAt) || libIdTime(e); };
      const ranked = readLibrary().map(function (e, i) { return { e: e, i: i }; });
      ranked.sort(function (a, b) { return (when(b.e) - when(a.e)) || (a.i - b.i); });
      return copy(ranked.slice(0, k).map(function (x) { return x.e; }));
    },
    /* 按命盘 key 找条目（没有返回 null） */
    findByKey: function (key) {
      const list = readLibrary();
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].input && readingKeyOf(list[i].input) === key) return copy(list[i]);
      }
      return null;
    }
  };

  /* ---------------- 一次性导入（spec §3.7） ----------------
     第一次运行 v6 时：上次命盘，以及解读记录（v2 和 v1）里有对话或报告、但命盘库里没有同一个 key 的盘，加进命盘库。
     只增不改：已有条目原样不动，解读记录、上次命盘一个字节都不改；命盘库满 60 条时不挤掉已有的。
     条目格式和 v5 一样（id = lib-<毫秒>，取记录的更新时间；上次命盘取现在），按 id 时间插进去，命盘库仍是新→旧。
     称呼取记录里存的，没有就自动命名（opts.nameOf(input) 可替换，opts.labels 是性别叫法）。
     做完记下 ziwei-pro.v6 = 1，以后不再做；命盘库读不出来或写不进去时不记，下次再试（按 key 去重，重跑不会重复加）。
     返回 { ran, added }。 */
  function importV5Once(opts) {
    const io = opts || {};
    const nameOf = typeof io.nameOf === 'function' ? io.nameOf : function (input) { return defaultChartName(input, io.labels); };
    const result = { ran: false, added: [] };
    let flag = null;
    try { const s = src(); if (!s) return result; flag = s.getItem(V6_IMPORT_KEY); } catch (e) { return result; }
    if (flag === '1') return result;
    const list = readLibrary();
    if (!libReadable) return result;
    result.ran = true;

    const keys = {};
    const prefixes = {};
    const prefixOf = function (k) { return String(k).split('|').slice(0, 9).join('|'); };
    const remember = function (input) { const k = readingKeyOf(input); keys[k] = true; prefixes[prefixOf(k)] = true; };
    list.forEach(function (e) { if (e && e.input && typeof e.input === 'object') remember(e.input); });

    const map = loadReadingMap();
    const legacy = loadLegacyReadingMap();
    const byNewest = function (m) {
      return function (a, b) { return (+(m[b] && m[b].updatedAt) || 0) - (+(m[a] && m[a].updatedAt) || 0); };
    };
    const hasContent = function (rec) {
      return !!rec && typeof rec === 'object' &&
        (cleanThread(rec.thread).length > 0 || !!String(normalizeReport(rec.report).text || '').trim());
    };
    const t0 = now();
    const candidates = [];
    const last = loadLastChart();
    if (last) {
      const rec = map[readingKeyOf(last)];
      const nm = String(last.name || '').trim() || String((rec && rec.name) || '').trim();
      candidates.push({ input: Object.assign({}, last, { name: nm }), ts: t0, legacy: false });
    }
    Object.keys(map).filter(function (k) { return hasContent(map[k]); }).sort(byNewest(map)).forEach(function (k) {
      const input = inputFromReadingKey(k);
      if (!input || String(k).split('|').length !== 10 || readingKeyOf(input) !== k) return;
      input.name = String(map[k].name || '').trim();
      candidates.push({ input: input, ts: +map[k].updatedAt || 0, legacy: false });
    });
    Object.keys(legacy).filter(function (k) {
      const rec = legacy[k];
      return !!rec && typeof rec === 'object' && cleanThread(rec.thread).length > 0;
    }).sort(byNewest(legacy)).forEach(function (k) {
      const input = inputFromReadingKey(prefixOf(k));
      if (!input) return;
      candidates.push({ input: input, ts: +legacy[k].updatedAt || 0, legacy: true });
    });

    const next = list.slice();
    candidates.forEach(function (c) {
      if (next.length >= LIBRARY_MAX) return;
      const k = readingKeyOf(c.input);
      /* v1 记录按前 9 段生辰匹配任何口径（findLegacyReading 的规则），所以只要同生辰的盘在库里就算有了 */
      if (keys[k] || (c.legacy && prefixes[prefixOf(k)])) return;
      const input = libraryInput(c.input);
      let name = '';
      try { name = String(nameOf(input) || '').trim(); } catch (e) { name = ''; }
      const ts = c.ts > 0 && c.ts <= t0 ? Math.floor(c.ts) : t0;
      const entry = { id: uniqueLibId(next, ts), name: name || autoChartName(input, '', io.labels), input: input };
      insertByTime(next, entry);
      result.added.push(entry);
      remember(input);
    });
    if (result.added.length && !writeLibrary(next)) {
      result.added = copy(result.added);
      return result;
    }
    set(V6_IMPORT_KEY, '1');
    result.added = copy(result.added);
    return result;
  }

  return {
    readingInput: readingInput,
    readingKeyOf: readingKeyOf,
    readings: {
      load: loadReadingRecord,
      save: saveReadingRecord,
      clear: clearReadingRecord
    },
    lastChart: { load: loadLastChart, save: saveLastChart },
    clearLocalRecords: clearLocalRecords,
    form: { load: loadForm, save: saveForm },
    prefs: prefs,
    cleanupLegacy: cleanupLegacy,
    library: library,
    importV5Once: importV5Once
  };
}
ZWUI.createStorageApi = createStorageApi;

/* 默认实例：懒绑定 window.localStorage——每次读写时才去取（取本身在沙箱 iframe 里可能抛 SecurityError）。
   定义时不碰 storage。 */
function browserLocalStorage() {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch (e) { return null; }
}
const localStore = createStorageApi(browserLocalStorage);
ZWUI.localStore = localStore;
