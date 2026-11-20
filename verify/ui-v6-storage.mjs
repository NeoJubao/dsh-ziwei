/**
 * verify/ui-v6-storage.mjs — v6 小工具与本机存储（T3a）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。覆盖：
 *   - v5 的 ZWUi 断言表（verify/verify.mjs 第 626–756 行，去掉 revealDelta）在 v6 的 window.ZWUi 上通过；v5 城市表逐城一致
 *   - readingKeyOf / readingInput、DEFAULT_FORM
 *   - 存储层 ZWUi.createStorageApi(storage)：v5 形状的记录原样可读、v1 迁移只做一次、上限、running → 可继续的 error、
 *     setItem / getItem 抛错不外抛、写出去的记录结构、表单 formV133 迁移、偏好、旧 API Key 清理、清除本机记录
 *   - 命盘库：增 / 改名 / 改生辰 / 删 / 撤销 / openedAt / 最近 N 张
 *   - 一次性导入（spec §3.7）：只增不改、只做一次、记录仍能按 key 读到
 *   - 默认实例 ZWUi.localStore 懒绑定 window.localStorage，拿不到时不抛错
 * 期望值都是字面量或来自 verify/fixtures/storage-v5.json，不用被测代码重算。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBundle, makeCtx, memoryStorage } from './client-harness.mjs';

const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '',
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
const GOLDEN_KEY = 'solar|1992|5|3|0|9|30|male|105.97|normal,exact,current,1';
const DEFAULT_KEY = 'solar|1990|6|15|0|15|30|male||normal,exact,current,1';
/* 旧版 9 段 key 的那条记录，在 v2 里对应的 key（默认口径） */
const V1_AS_V2_KEY = 'solar|1992|5|3|0|9|30|male||normal,exact,current,1';
const V5_INPUT_FIELDS = 'name,calendar,year,month,day,isLeap,hour,minute,gender,longitude,city,place,occupation,settings';
const RECORD_FIELDS = 'thread,report,studioTab,name,updatedAt';

const json = (x) => JSON.stringify(x);
const clone = (x) => JSON.parse(JSON.stringify(x));

/** fixture 的 storage 段 → 内存版 localStorage（对象值 JSON.stringify，字符串原样） */
function fixtureStorage(fx) {
  const init = {};
  for (const [k, v] of Object.entries(fx.storage)) init[k] = typeof v === 'string' ? v : JSON.stringify(v);
  return memoryStorage(init);
}

/** setItem 一律抛错（隐私模式 / 配额满）的 storage */
function throwingSetStorage(initial) {
  const m = memoryStorage(initial);
  return Object.assign(Object.create(null), {
    getItem: m.getItem, removeItem: m.removeItem, dump: m.dump,
    setItem: () => { throw new Error('QuotaExceededError'); }
  });
}

/** 值超过 limit 个字符就抛错的 storage（模拟配额） */
function quotaStorage(limit, initial) {
  const m = memoryStorage(initial);
  return Object.assign(Object.create(null), {
    getItem: m.getItem, removeItem: m.removeItem, dump: m.dump,
    setItem: (k, v) => { if (String(v).length > limit) throw new Error('QuotaExceededError'); m.setItem(k, v); }
  });
}

/** 一个可控的时钟 */
function clock(start) {
  let t = start;
  const now = () => t;
  now.set = (v) => { t = v; };
  now.tick = (d = 1) => { t += d; return t; };
  return now;
}

/** 装载 v6 bundle、factory()、apply()，返回 { loaded, ui, err } */
function boot(client, beforeApply) {
  const loaded = loadBundle(client);
  if (loaded.error) return { loaded, ui: null, err: loaded.error };
  try {
    const plugin = loaded.materialize();
    if (beforeApply) beforeApply(loaded);
    plugin.apply(makeCtx().ctx);
  } catch (e) {
    return { loaded, ui: loaded.win.ZWUi || null, err: e };
  }
  return { loaded, ui: loaded.win.ZWUi || null, err: null };
}

export default async function storageChecks(t) {
  const { ok, section } = t;
  /** 断言：fn 返回 true，或 [条件, 详情]；抛错算失败 */
  const check = (name, fn) => {
    let r;
    try { r = fn(); } catch (e) { ok(name, false, 'threw: ' + String((e && e.message) || e)); return; }
    if (Array.isArray(r)) ok(name, r[0] === true, r[1] === undefined ? '' : String(r[1]));
    else ok(name, r === true, r === false ? '' : String(r));
  };

  const fx = JSON.parse(readFileSync(join(t.root, 'verify', 'fixtures', 'storage-v5.json'), 'utf8'));
  const client = t.client || '';
  const { loaded, ui: maybeUi, err: bootErr } = t.client ? boot(client) : { loaded: null, ui: null, err: new Error('没有 v6 bundle') };
  const ui = maybeUi || {};

  /* ---------------------------------------------------------------- */
  section('v6 小工具：v5 的 ZWUi 断言表');
  check('v6 bundle 装载、apply() 后有 window.ZWUi', () => [!bootErr && !!maybeUi, bootErr && bootErr.message]);

  check('报告续写收尾：续写前正文 + 本轮正文，不重复拼接',
    () => ui.mergeReportText({ cont: true, base: '第一部分。', accumulated: '第一部分。第二部分。', done: '第二部分。' }) === '第一部分。第二部分。');
  check('报告首次生成收尾：以 done 全文为准',
    () => ui.mergeReportText({ cont: false, base: '', accumulated: '半截', done: '完整全文' }) === '完整全文');
  check('报告首次生成收尾：done 为空时保留已累计正文',
    () => ui.mergeReportText({ cont: false, base: '', accumulated: '已写部分', done: '' }) === '已写部分');

  check('对话流式中气泡累加增量（不是只显示最后一段）', () => {
    let th = [{ role: 'user', content: '问' }];
    th = ui.applyAssistantText(th, '第一句。', 'new');
    th = ui.applyAssistantText(th, '第二句。', 'append');
    return [th.length === 2 && th[1].role === 'assistant' && th[1].content === '第一句。第二句。', json(th)];
  });
  check('对话收到 done 时用本轮全文替换本轮气泡', () => {
    let th = [{ role: 'user', content: '问' }, { role: 'assistant', content: '第一句。第二句。' }];
    th = ui.applyAssistantText(th, '第一句。第二句。第三句。', 'replace');
    return [th.length === 2 && th[1].content === '第一句。第二句。第三句。', json(th)];
  });
  check('新一轮回答另起气泡，不接在上一轮回答后面', () => {
    const fresh = ui.applyAssistantText([{ role: 'assistant', content: '上一轮回答' }], '新回答', 'new');
    return [fresh.length === 2 && fresh[0].content === '上一轮回答' && fresh[1].content === '新回答', json(fresh)];
  });

  check('三方四正索引：0 → 对宫 6、三合 4/8；10 → 对宫 4、三合 2/6', () => {
    const r0 = ui.relatedPalaces(0), r10 = ui.relatedPalaces(10);
    return [r0.opp === 6 && r0.tri[0] === 4 && r0.tri[1] === 8 && r10.opp === 4 && r10.tri[0] === 2 && r10.tri[1] === 6, json([r0, r10])];
  });
  check('revealDelta 是 v5 旧布局专属，v6 不再提供', () => ui.revealDelta === undefined);

  {
    const snap = { name: '甲', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male', longitude: '105.97', place: '', occupation: '',
      settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true } };
    const formSame = Object.assign({}, snap, { year: '1992', month: '5', day: '3', hour: '9', minute: '30', name: '乙', place: '成都', occupation: '设计' });
    check('生辰一致判断：只改称呼/籍贯/职业、数字以字符串出现，仍算同一张盘', () => ui.sameBirthInput(formSame, snap) === true);
    check('生辰一致判断：改了出生时辰就不是同一张盘', () => ui.sameBirthInput(Object.assign({}, formSame, { hour: '10' }), snap) === false);
    check('生辰一致判断：改了晚子时口径就不是同一张盘',
      () => ui.sameBirthInput(Object.assign({}, formSame, { settings: Object.assign({}, snap.settings, { dayDivide: 'forward' }) }), snap) === false);
    check('生辰一致判断：缺一边就不是同一张盘', () => ui.sameBirthInput(null, snap) === false);
  }

  {
    const P = (x) => ui.parseBirthplace(x);
    check('出生城市：北京 → 东经 116.4', () => [P('北京').kind === 'city' && P('北京').city === '北京' && P('北京').lon === 116.4, json(P('北京'))]);
    check('出生城市：「北京市」去掉市字也能认', () => P('北京市').city === '北京');
    check('出生城市：「四川成都」取包含的城市 → 成都 104.1', () => [P('四川成都').city === '成都' && P('四川成都').lon === 104.1, json(P('四川成都'))]);
    check('出生城市：「吉林长春」省名与城市同名时取后面的城市 → 长春', () => [P('吉林长春').city === '长春', json(P('吉林长春'))]);
    check('出生城市：直接填经度 116.4 / 东经105.97°',
      () => [P('116.4').kind === 'number' && P('116.4').lon === 116.4 && P('东经105.97°').lon === 105.97, json(P('东经105.97°'))]);
    check('出生城市：查不到 → unknown 且不给经度', () => P('火星基地').kind === 'unknown' && P('火星基地').lon === null);
    check('出生城市：空 → empty（按钟表时间排盘）', () => P('  ').kind === 'empty' && P('  ').lon === null);
    check('出生城市：越界数字不当经度', () => P('400').kind === 'unknown');
    check('出生城市：表的两端（喀什 76.0、台北 121.6、拉萨 91.1）',
      () => [P('喀什').lon === 76 && P('台北').lon === 121.6 && P('拉萨').lon === 91.1, json([P('喀什'), P('台北'), P('拉萨')])]);
    /* 和 v5 的城市表逐城对照：94 个城市一个不少、经度一致（v5 的表在删掉 src/ui-pro.js 之前导出成了 fixture） */
    {
      const cities = JSON.parse(readFileSync(join(t.root, 'verify', 'fixtures', 'cities-v5.json'), 'utf8')).cities;
      check('出生城市：v5 城市表 94 城逐城一致（城市名 → 同一经度）', () => {
        const bad = cities.filter(([name, lon]) => { const r = P(name); return r.kind !== 'city' || r.city !== name || r.lon !== lon; });
        return [cities.length === 94 && bad.length === 0, `v5 表 ${cities.length} 城；不一致：${bad.map((c) => c[0]).join(',')}`];
      });
    }
  }

  check('不再有「专注看盘」（并入左栏开关）', () => !/toggleFocus/.test(client) && !/data-focus/.test(client) && !/focusOn/.test(client));
  check('设置里不再重复「显示杂曜」（时间栏开关是唯一入口）', () => !/t\('showAdjSet'\)/.test(client));
  check('命盘库不填名时自动命名：日期 + 时辰 + 性别',
    () => [ui.autoChartName({ name: '', year: 1990, month: 6, day: 15, gender: 'male' }, '申时') === '1990-06-15 申时 男',
      ui.autoChartName({ name: '', year: 1990, month: 6, day: 15, gender: 'male' }, '申时')]);
  check('命盘库不填名时有称呼就用称呼（去掉首尾空白）',
    () => ui.autoChartName({ name: ' 甲 ', year: 1992, month: 5, day: 3, gender: 'female' }, '巳时') === '甲');

  check('引用宫位文本含宫名、干支与本宫星曜（黄金用例的命宫）', () => {
    const ch = loaded.win.ZWCore.paipan({ date: '1992-05-03', time: '09:30', gender: 'male', longitude: 105.97 }).chart;
    const soul = ch.palaces[ch.soulIndex];
    const quoteText = ui.palaceQuoteText(soul, '空宫');
    const starNames = soul.major.concat(soul.minor).map((s) => s.name);
    return [quoteText.startsWith(soul.name + ' ' + soul.stem + soul.branch + ' · ') && starNames.length > 0 && starNames.every((n) => quoteText.includes(n)), quoteText];
  });
  check('引用空宫时写明空宫', () => {
    const s = ui.palaceQuoteText({ name: '迁移', stem: '庚', branch: '辰', major: [], minor: [] }, '空宫');
    return [s === '迁移 庚辰 · 空宫', s];
  });
  check('宫位标签：「宫名 干支」；没有宫位时为空串',
    () => ui.palaceLabel({ name: '命宫', stem: '甲', branch: '子' }) === '命宫 甲子' && ui.palaceLabel(null) === '');
  check('报告选段按钮坐标计入正文滚动量（滚过第一屏后仍贴着选区）', () => {
    const p = ui.pickPoint({ left: 340, top: 260 }, { left: 100, top: 200 }, 900, 0);
    return [p.x === 240 && p.y === 960, json(p)];
  });
  check('报告选段按钮坐标在容器左上角时保留最小边距', () => {
    const p = ui.pickPoint({ left: 110, top: 205 }, { left: 100, top: 200 }, 0, 0);
    return [p.x === 80 && p.y === 32, json(p)];
  });

  /* ---------------------------------------------------------------- */
  section('v6 小工具：命盘 key 与默认表单');
  check('readingKeyOf(黄金用例) 的字面值', () => [ui.readingKeyOf(GOLDEN) === GOLDEN_KEY, ui.readingKeyOf(GOLDEN)]);
  check('readingKeyOf：经度写成数字、日期写成字符串、带称呼 → 同一个 key',
    () => ui.readingKeyOf(Object.assign({}, GOLDEN, { longitude: 105.97, year: '1992', name: '甲' })) === GOLDEN_KEY);
  check('readingKeyOf：没有 settings 时按默认口径（normal,exact,current,1）',
    () => ui.readingKeyOf({ calendar: 'solar', year: 1990, month: 6, day: 15, hour: 15, minute: 30, gender: 'male', longitude: '' }) === DEFAULT_KEY);
  check('readingInput 的字段和归一化（v5 原样：不含 city，经度是字符串）', () => {
    const x = ui.readingInput(Object.assign({}, GOLDEN, { longitude: 105.97, city: '某城' }));
    return [Object.keys(x).join(',') === 'name,calendar,year,month,day,isLeap,hour,minute,gender,longitude,place,occupation,settings' &&
      x.longitude === '105.97' && x.year === 1992, json(x)];
  });
  check('DEFAULT_FORM：v5 的默认值，口径 normal / exact / current / true', () => {
    const d = ui.DEFAULT_FORM;
    return [!!d && d.name === '' && d.calendar === 'solar' && d.year === 1990 && d.month === 6 && d.day === 15 && d.isLeap === false &&
      d.hour === 15 && d.minute === 30 && d.gender === 'male' && d.longitude === '' && d.city === '' && d.place === '' && d.occupation === '' &&
      json(d.settings) === json({ yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }), json(d)];
  });
  check('源码保留 v5 的默认口径原文（settings: { yearDivide: …, fixLeap: true }）',
    () => /settings: \{ yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true \}/.test(client));
  check('源码保留：autopen 默认关（=== \'1\'）、旧 API Key 清理、formV133 迁移的判断',
    () => /getItem\('ziwei-pro\.autopen'\) === '1'/.test(client) && !/getItem\('ziwei-pro\.autopen'\) !== '0'/.test(client) &&
      /removeItem\('ziwei-workbench\.apikey'\)/.test(client) && !/setItem\('ziwei-workbench\.apikey'/.test(client) &&
      /ziwei-pro\.formV133/.test(client) && /monthDivide === 'normal'/.test(client));

  /* ---------------------------------------------------------------- */
  section('v6 本机存储：读 v5 的记录');
  /* 工厂不存在时返回一个一碰就抛错的占位，让后面的每条检查各自失败，而不是整个文件中途退出 */
  const missing = new Proxy({}, { get() { throw new Error('ZWUi.createStorageApi 不存在'); } });
  const mk = (storage, now) => (typeof ui.createStorageApi === 'function' ? ui.createStorageApi(storage, now ? { now } : undefined) : missing);
  check('ZWUi.createStorageApi 是工厂函数', () => typeof ui.createStorageApi === 'function');

  {
    const s = fixtureStorage(fx);
    const api = mk(s, clock(1763500000000));
    check('命盘库：读出 v5 的条目（id、名字、input 原样）', () => {
      const list = api.library.list();
      return [list.length === 1 && list[0].id === 'lib-1763000000000' && list[0].name === '1990-06-15 申时 男' &&
        json(list[0].input) === json(fx.storage['ziwei-pro.library'][0].input), json(list)];
    });
    check('上次命盘：读出黄金用例', () => {
      const last = api.lastChart.load();
      return [!!last && ui.readingKeyOf(last) === GOLDEN_KEY && last.longitude === '105.97', json(last)];
    });
    check('按 key 读出对话和报告（v2）', () => {
      const r = api.readings.load(GOLDEN_KEY);
      return [!!r && r.thread.length === 2 && r.thread[1].content === '命宫的示例回答。' && r.report.status === 'done' &&
        r.report.text === '## 一、命宫\n\n示例报告正文。' && r.studioTab === 'report' && r.updatedAt === 1763000200000, json(r)];
    });
    check('存着 running 的报告读出来是可继续的 error（正文保留）', () => {
      const r = api.readings.load(DEFAULT_KEY);
      return [!!r && r.report.status === 'error' && r.report.text === '写了一半的报告' && r.thread.length === 1, json(r && r.report)];
    });
    check('没有记录的 key → null', () => api.readings.load('solar|2000|1|1|0|0|0|male||normal,exact,current,1') === null);
    check('偏好：autopen = 1 → 开；showadj = 1 → 开；sky 没存 → 开',
      () => api.prefs.autoOpen() === true && api.prefs.showAdj() === true && api.prefs.sky() === true);

    const v1Before = s.getItem('ziwei-pro.readings.v1');
    check('v1 的 9 段 key：按 10 段 key 读出（报告取最后一条回答）', () => {
      const r = api.readings.load(V1_AS_V2_KEY);
      return [!!r && r.thread.length === 2 && r.report.status === 'done' && r.report.text === '旧版的完整报告正文。', json(r)];
    });
    check('v1 记录读一次就迁进 v2（键恰好是 thread, report, studioTab, name, updatedAt），v1 原样保留', () => {
      const v2 = JSON.parse(s.getItem('ziwei-pro.readings.v2'));
      const rec = v2[V1_AS_V2_KEY];
      return [!!rec && Object.keys(rec).join(',') === RECORD_FIELDS && rec.report.text === '旧版的完整报告正文。' &&
        s.getItem('ziwei-pro.readings.v1') === v1Before, json(rec)];
    });
    check('v1 记录只迁移一次：之后改 v1 不影响，读的是 v2', () => {
      const legacy = JSON.parse(s.getItem('ziwei-pro.readings.v1'));
      legacy['solar|1992|5|3|0|9|30|male|'].thread = [{ role: 'user', content: '被改过的旧版' }];
      s.setItem('ziwei-pro.readings.v1', JSON.stringify(legacy));
      const r = api.readings.load(V1_AS_V2_KEY);
      return [!!r && r.thread.length === 2 && r.thread[0].content === '旧版提问', json(r && r.thread)];
    });
    check('清掉一张盘的记录：v2 和同生辰的 v1 都清掉，别的盘不动', () => {
      api.readings.clear(V1_AS_V2_KEY);
      const v2 = JSON.parse(s.getItem('ziwei-pro.readings.v2'));
      const v1 = JSON.parse(s.getItem('ziwei-pro.readings.v1'));
      return [!v2[V1_AS_V2_KEY] && !v1['solar|1992|5|3|0|9|30|male|'] && !!v2[GOLDEN_KEY] && api.readings.load(V1_AS_V2_KEY) === null, json(Object.keys(v2))];
    });
  }

  /* ---------------------------------------------------------------- */
  section('v6 本机存储：写解读记录（上限与容错）');
  {
    const now = clock(1763600000000);
    const s = memoryStorage();
    const api = mk(s, now);
    check('写出去的记录：键恰好是 thread, report, studioTab, name, updatedAt', () => {
      api.readings.save(GOLDEN_KEY, { thread: [{ role: 'user', content: '问' }, { role: 'assistant', content: '答' }], report: null, studioTab: 'chat', name: '甲', extra: 1 });
      const rec = JSON.parse(s.getItem('ziwei-pro.readings.v2'))[GOLDEN_KEY];
      return [Object.keys(rec).join(',') === RECORD_FIELDS && rec.report === null && rec.studioTab === 'chat' && rec.name === '甲' && rec.updatedAt === 1763600000000, json(rec)];
    });
    check('studioTab 只有 report / chat 两种（v5 原样）', () => {
      api.readings.save(GOLDEN_KEY, { thread: [{ role: 'user', content: '问' }], studioTab: 'chart' });
      return JSON.parse(s.getItem('ziwei-pro.readings.v2'))[GOLDEN_KEY].studioTab === 'chat';
    });
    check('最多留 8 张盘，挤掉最久没更新的', () => {
      const keys = [];
      for (let i = 0; i < 9; i++) {
        now.tick(1000);
        const k = `solar|1990|6|${i + 1}|0|15|30|male||normal,exact,current,1`;
        keys.push(k);
        api.readings.save(k, { thread: [{ role: 'user', content: '问' + i }] });
      }
      const map = JSON.parse(s.getItem('ziwei-pro.readings.v2'));
      const left = Object.keys(map);
      /* 循环前已有一张（GOLDEN），共 10 张：留最新的 8 张，GOLDEN 和循环里的第一张被挤掉 */
      return [left.length === 8 && !map[GOLDEN_KEY] && !map[keys[0]] && keys.slice(1).every((k) => !!map[k]), left.join(' ')];
    });
    check('每张盘最多 24 条消息（留最后 24 条）', () => {
      const thread = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: '第' + i + '条' }));
      api.readings.save(GOLDEN_KEY, { thread });
      const rec = JSON.parse(s.getItem('ziwei-pro.readings.v2'))[GOLDEN_KEY];
      return [rec.thread.length === 24 && rec.thread[0].content === '第6条' && rec.thread[23].content === '第29条', rec.thread.length];
    });
    check('单条消息最多 60000 字，单份报告最多 120000 字', () => {
      api.readings.save(GOLDEN_KEY, { thread: [{ role: 'assistant', content: '字'.repeat(70000) }], report: { status: 'done', text: '文'.repeat(130000) } });
      const rec = JSON.parse(s.getItem('ziwei-pro.readings.v2'))[GOLDEN_KEY];
      return [rec.thread[0].content.length === 60000 && rec.report.text.length === 120000, `${rec.thread[0].content.length} / ${rec.report.text.length}`];
    });
    check('running 的报告存成 error（正文保留，可接着写）', () => {
      api.readings.save(GOLDEN_KEY, { thread: [], report: { status: 'running', text: '半截正文', startedAt: 5 } });
      const rec = JSON.parse(s.getItem('ziwei-pro.readings.v2'))[GOLDEN_KEY];
      const back = api.readings.load(GOLDEN_KEY);
      return [rec.report.status === 'error' && rec.report.text === '半截正文' && back.report.status === 'error' && back.report.text === '半截正文', json(rec.report)];
    });
    check('对话和报告都空 → 删掉这张盘的记录', () => {
      api.readings.save(GOLDEN_KEY, { thread: [], report: { status: 'done', text: '   ' } });
      return !JSON.parse(s.getItem('ziwei-pro.readings.v2'))[GOLDEN_KEY];
    });
    check('key 为空时什么都不做', () => {
      const before = s.getItem('ziwei-pro.readings.v2');
      api.readings.save('', { thread: [{ role: 'user', content: '问' }] });
      return s.getItem('ziwei-pro.readings.v2') === before && api.readings.load('') === null;
    });
  }
  {
    check('setItem 抛错时保存记录、上次命盘、表单、偏好、命盘库都不抛错', () => {
      const api = mk(throwingSetStorage(), clock(1763600000000));
      api.readings.save(GOLDEN_KEY, { thread: [{ role: 'user', content: '问' }] });
      api.readings.clear(GOLDEN_KEY);
      api.lastChart.save(GOLDEN);
      api.form.save(Object.assign({}, GOLDEN));
      api.form.load();
      api.prefs.setAutoOpen(true); api.prefs.setShowAdj(true); api.prefs.setSky(false);
      const added = api.library.add(GOLDEN, '甲');
      api.importV5Once();
      api.clearLocalRecords();
      api.cleanupLegacy();
      return [!!added && !!added.entry && api.library.list().length === 1, '命盘库在本次会话里仍然更新'];
    });
    check('getItem 抛错时一律返回默认值', () => {
      const bad = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); }, removeItem() { throw new Error('SecurityError'); } };
      const api = mk(bad);
      const f = api.form.load();
      return [api.readings.load(GOLDEN_KEY) === null && api.lastChart.load() === null && api.library.list().length === 0 &&
        api.prefs.autoOpen() === false && api.prefs.showAdj() === false && api.prefs.sky() === true &&
        f.monthDivide === undefined && f.settings.monthDivide === 'exact' && f.year === 1990, json(f)];
    });
    check('配额不够时挤掉最旧的记录直到写得下（v5 原样）', () => {
      const now = clock(1763600000000);
      const s = quotaStorage(1400);
      const api = mk(s, now);
      const keys = [1, 2, 3].map((d) => `solar|1990|6|${d}|0|15|30|male||normal,exact,current,1`);
      for (const k of keys) { now.tick(1000); api.readings.save(k, { thread: [{ role: 'user', content: '问'.repeat(150) }] }); }
      now.tick(1000);
      api.readings.save(GOLDEN_KEY, { thread: [{ role: 'user', content: '问'.repeat(500) }] });
      const map = JSON.parse(s.getItem('ziwei-pro.readings.v2') || '{}');
      return [!!map[GOLDEN_KEY] && !map[keys[0]], Object.keys(map).join(' ')];
    });
  }

  /* ---------------------------------------------------------------- */
  section('v6 本机存储：上次命盘、清除本机记录、表单、偏好');
  {
    const s = memoryStorage();
    const api = mk(s);
    check('上次命盘：存的是 readingInput（v5 原样），读回同一个 key', () => {
      api.lastChart.save(Object.assign({}, GOLDEN, { longitude: 105.97, city: '某城' }));
      const raw = JSON.parse(s.getItem('ziwei-pro.lastChart.v1'));
      return [!('city' in raw) && raw.longitude === '105.97' && ui.readingKeyOf(api.lastChart.load()) === GOLDEN_KEY, json(raw)];
    });
    check('上次命盘：没有年份的记录当作没有', () => { s.setItem('ziwei-pro.lastChart.v1', '{"name":""}'); return api.lastChart.load() === null; });
  }
  {
    const s = fixtureStorage(fx);
    const api = mk(s, clock(1763500000000));
    const libBefore = s.getItem('ziwei-pro.library');
    check('清除本机记录：readings.v2、readings.v1、lastChart.v1 没了，命盘库、表单、偏好还在', () => {
      api.clearLocalRecords();
      return [s.getItem('ziwei-pro.readings.v2') === null && s.getItem('ziwei-pro.readings.v1') === null && s.getItem('ziwei-pro.lastChart.v1') === null &&
        s.getItem('ziwei-pro.library') === libBefore && s.getItem('ziwei-pro.form') !== null && s.getItem('ziwei-pro.autopen') === '1', json(Object.keys(s.dump()))];
    });
    check('旧版遗留的 ziwei-workbench.apikey 被清掉；v5 的 studio / rail 不读不删', () => {
      api.cleanupLegacy();
      return s.getItem('ziwei-workbench.apikey') === null && s.getItem('ziwei-pro.studio') === '1' && s.getItem('ziwei-pro.rail') === '0';
    });
  }
  {
    const s = fixtureStorage(fx);
    const api = mk(s);
    check('表单：旧默认 monthDivide normal 第一次读时改成 exact，写回表单并记下 formV133', () => {
      const f = api.form.load();
      const saved = JSON.parse(s.getItem('ziwei-pro.form'));
      return [f.settings.monthDivide === 'exact' && saved.settings.monthDivide === 'exact' && s.getItem('ziwei-pro.formV133') === '1' &&
        f.city === '' && f.year === 1990 && f.settings.dayDivide === 'current', json(f)];
    });
    check('表单：迁移之后用户自己选的 normal 保留', () => {
      const f = api.form.load();
      api.form.save(Object.assign({}, f, { settings: Object.assign({}, f.settings, { monthDivide: 'normal' }) }));
      return [api.form.load().settings.monthDivide === 'normal' && mk(s).form.load().settings.monthDivide === 'normal', s.getItem('ziwei-pro.form')];
    });
    check('表单：空 storage → DEFAULT_FORM 的值，也记下 formV133（不改写表单）', () => {
      const e = memoryStorage();
      const f = mk(e).form.load();
      return [json(f) === json(ui.DEFAULT_FORM) && e.getItem('ziwei-pro.formV133') === '1' && e.getItem('ziwei-pro.form') === null, json(e.dump())];
    });
    check('表单：存下的未知字段不进表单；settings 用存下的那份（v5 原样，不和默认值合并）', () => {
      const e = memoryStorage({ 'ziwei-pro.formV133': '1', 'ziwei-pro.form': JSON.stringify({ hour: 9, junk: 1, settings: { dayDivide: 'forward' } }) });
      const f = mk(e).form.load();
      return [f.hour === 9 && !('junk' in f) && f.year === 1990 && json(f.settings) === json({ dayDivide: 'forward' }), json(f)];
    });
    check('表单：返回的 settings 不是 DEFAULT_FORM.settings 本身（改它不污染默认值）', () => {
      const f = mk(memoryStorage()).form.load();
      f.settings.monthDivide = 'normal';
      return ui.DEFAULT_FORM.settings.monthDivide === 'exact';
    });
  }
  {
    const s = memoryStorage();
    const api = mk(s);
    check('偏好：空 storage 下自动打开关、杂曜关、3D 星图开', () => api.prefs.autoOpen() === false && api.prefs.showAdj() === false && api.prefs.sky() === true);
    check('偏好：写成 1 / 0（v5 原样），读回一致', () => {
      api.prefs.setAutoOpen(true); api.prefs.setShowAdj(true); api.prefs.setSky(false);
      const a = [s.getItem('ziwei-pro.autopen'), s.getItem('ziwei-pro.showadj'), s.getItem('ziwei-pro.sky')].join(',');
      const b = [api.prefs.autoOpen(), api.prefs.showAdj(), api.prefs.sky()].join(',');
      api.prefs.setAutoOpen(false); api.prefs.setShowAdj(false); api.prefs.setSky(true);
      const c = [s.getItem('ziwei-pro.autopen'), s.getItem('ziwei-pro.showadj'), s.getItem('ziwei-pro.sky')].join(',');
      return [a === '1,1,0' && b === 'true,true,false' && c === '0,0,1', `${a} | ${b} | ${c}`];
    });
    check('偏好：sky 只有 \'0\' 是关，其余都是开；autopen 只有 \'1\' 是开', () => {
      s.setItem('ziwei-pro.sky', 'off'); const sky = api.prefs.sky();
      s.setItem('ziwei-pro.autopen', 'true'); const auto = api.prefs.autoOpen();
      return sky === true && auto === false;
    });
    check('偏好：外观默认深色；只认 dark / light / auto，别的值读写都按 dark', () => {
      const s2 = memoryStorage();
      const api2 = mk(s2);
      const first = api2.prefs.theme();
      api2.prefs.setTheme('light'); const a = [s2.getItem('ziwei-pro.theme'), api2.prefs.theme()].join(',');
      api2.prefs.setTheme('auto'); const b = [s2.getItem('ziwei-pro.theme'), api2.prefs.theme()].join(',');
      api2.prefs.setTheme('sepia'); const c = [s2.getItem('ziwei-pro.theme'), api2.prefs.theme()].join(',');
      s2.setItem('ziwei-pro.theme', 'LIGHT'); const d = api2.prefs.theme();
      return [first === 'dark' && a === 'light,light' && b === 'auto,auto' && c === 'dark,dark' && d === 'dark', `${first} | ${a} | ${b} | ${c} | ${d}`];
    });
    check('外观解析：dark / light 原样；auto 看宿主是不是深色', () => {
      const r = ui.resolveTheme;
      const got = [r('dark', false), r('light', true), r('auto', true), r('auto', false), r(undefined, false), r('x', true)].join(',');
      return [got === 'dark,light,dark,light,dark,dark', got];
    });
  }

  /* ---------------------------------------------------------------- */
  section('v6 本机存储：命盘库');
  {
    const now = clock(1763700000000);
    const s = memoryStorage();
    const api = mk(s, now);
    check('新增：id 是 lib-<毫秒>，input 恰好是 v5 的那些字段，排在最前', () => {
      const a = api.library.add(Object.assign({}, ui.DEFAULT_FORM), '');
      now.tick(5);
      const b = api.library.add(Object.assign({}, GOLDEN, { longitude: 105.97, city: '某城', extra: 1 }), '  甲  ');
      const list = JSON.parse(s.getItem('ziwei-pro.library'));
      return [/^lib-\d+$/.test(b.entry.id) && b.entry.id === 'lib-1763700000005' && list.length === 2 && list[0].id === b.entry.id &&
        Object.keys(list[0].input).join(',') === V5_INPUT_FIELDS && Object.keys(list[1].input).join(',') === V5_INPUT_FIELDS &&
        Object.keys(list[0]).join(',') === 'id,name,input' &&
        list[0].name === '甲' && list[0].input.isLeap === false && list[0].input.city === '某城' && list[0].input.longitude === '105.97' &&
        ui.readingKeyOf(list[0].input) === GOLDEN_KEY && a.entry.name === '1990-06-15 申时 男', json(list)];
    });
    check('新增：不填名时用引擎的时辰和公历日期自动命名（黄金用例经真太阳时校正后是辰时）', () => {
      const r = api.library.add(Object.assign({}, GOLDEN), '');
      return [r.entry.name === '1992-05-03 辰时 男', r.entry.name];
    });
    check('新增：同一毫秒连加两张，id 不重复', () => {
      const x = api.library.add(GOLDEN, '乙'), y = api.library.add(GOLDEN, '丙');
      return [x.entry.id !== y.entry.id && /^lib-\d+$/.test(y.entry.id), `${x.entry.id} ${y.entry.id}`];
    });
    check('新增：最多 60 张，挤掉最旧的', () => {
      for (let i = 0; i < 70; i++) { now.tick(10); api.library.add(GOLDEN, '丁' + i); }
      const list = api.library.list();
      return [list.length === 60 && list[0].name === '丁69' && list[59].name === '丁10' &&
        JSON.parse(s.getItem('ziwei-pro.library')).length === 60, `${list.length} ${list[0].name} ${list[59].name}`];
    });
  }
  {
    const now = clock(1763800000000);
    const s = memoryStorage();
    const api = mk(s, now);
    let a = {}, b = {}, c = {};
    try {
      a = api.library.add(GOLDEN, '甲').entry; now.tick(10);
      b = api.library.add(GOLDEN, '乙').entry; now.tick(10);
      c = api.library.add(GOLDEN, '丙').entry; now.tick(10);
    } catch { /* 下面的检查各自失败 */ }
    check('改名：去首尾空白、截到 12 个字，entry.name 和 entry.input.name 一起改', () => {
      const r = api.library.rename(b.id, '  一二三四五六七八九十甲乙丙  ');
      const saved = JSON.parse(s.getItem('ziwei-pro.library')).find((e) => e.id === b.id);
      return [!!r && saved.name === '一二三四五六七八九十甲乙' && saved.input.name === '一二三四五六七八九十甲乙' &&
        ui.readingKeyOf(saved.input) === GOLDEN_KEY, json(saved)];
    });
    check('改名：空名不改，找不到的 id 返回 null', () => {
      const r1 = api.library.rename(b.id, '   ');
      const r2 = api.library.rename('lib-1', '甲');
      return [r1 === null && r2 === null && api.library.list().find((e) => e.id === b.id).name === '一二三四五六七八九十甲乙', json([r1, r2])];
    });
    check('改生辰：id 和名字不变，key 随生辰变；旧 key 下的记录留在原处', () => {
      api.readings.save(GOLDEN_KEY, { thread: [{ role: 'user', content: '问' }] });
      const r = api.library.updateInput(c.id, Object.assign({}, GOLDEN, { hour: 10, name: '丙' }));
      const saved = JSON.parse(s.getItem('ziwei-pro.library')).find((e) => e.id === c.id);
      return [!!r && saved.name === '丙' && Object.keys(saved.input).join(',') === V5_INPUT_FIELDS &&
        ui.readingKeyOf(saved.input) === 'solar|1992|5|3|0|10|30|male|105.97|normal,exact,current,1' &&
        api.readings.load(GOLDEN_KEY) !== null, json(saved)];
    });
    check('按 key 找条目', () => {
      const e = api.library.findByKey('solar|1992|5|3|0|10|30|male|105.97|normal,exact,current,1');
      return [!!e && e.id === c.id && api.library.findByKey('nope') === null, json(e)];
    });
    check('删除后撤销：回到原位置（按 id 里的时间插回，期间新加的盘不丢）', () => {
      const removed = api.library.remove(b.id);
      const mid = api.library.list().map((e) => e.id);
      now.tick(10);
      const d = api.library.add(GOLDEN, '丁').entry;
      api.library.undo(removed);
      const after = JSON.parse(s.getItem('ziwei-pro.library')).map((e) => e.id);
      return [!!removed && removed.entry.id === b.id && mid.join() === [c.id, a.id].join() &&
        after.join() === [d.id, c.id, b.id, a.id].join() && json(api.library.list().find((e) => e.id === b.id)) === json(removed.entry), after.join(' ')];
    });
    check('撤销两次不重复插入', () => {
      const removed = api.library.remove(a.id);
      api.library.undo(removed); api.library.undo(removed);
      return api.library.list().filter((e) => e.id === a.id).length === 1;
    });
    check('打开时记 openedAt；最近 N 张按 openedAt 新→旧，没打开过的按 id 时间', () => {
      now.set(1763900000000);
      api.library.touch(a.id);
      const touched = JSON.parse(s.getItem('ziwei-pro.library')).find((e) => e.id === a.id);
      const ids = api.library.list().map((e) => e.id);
      const recent = api.library.recent(2).map((e) => e.id);
      const all = api.library.recent().map((e) => e.id);
      return [touched.openedAt === 1763900000000 && recent.join() === [a.id, ids[0]].join() && all.length === ids.length &&
        api.library.list().map((e) => e.id).join() === ids.join(), `${recent.join(' ')} | ${all.join(' ')}`];
    });
    check('最近 N 张默认取 8 张', () => {
      for (let i = 0; i < 10; i++) { now.tick(10); api.library.add(GOLDEN, '戊' + i); }
      return api.library.recent().length === 8;
    });
    check('删到一张不剩：命盘库为空（首页据此进入引导）', () => {
      for (const e of api.library.list()) api.library.remove(e.id);
      return [api.library.list().length === 0 && s.getItem('ziwei-pro.library') === '[]' && api.library.recent().length === 0, s.getItem('ziwei-pro.library')];
    });
    check('新开一个实例（相当于刷新）读到同样的命盘库', () => {
      const api2 = mk(s);
      return api2.library.list().length === 0;
    });
  }

  /* ---------------------------------------------------------------- */
  section('v6 本机存储：一次性导入（spec §3.7）');
  {
    const s = fixtureStorage(fx);
    const api = mk(s, clock(1763500000000));
    const before = s.dump();
    let res = null;
    check('首次运行：上次命盘和不在命盘库里的解读记录进命盘库', () => {
      res = api.importV5Once();
      const list = JSON.parse(s.getItem('ziwei-pro.library'));
      return [!!res && res.added.length === 2 && list.map((e) => e.id).join() === 'lib-1763500000000,lib-1763000000000,lib-1700000000000' &&
        list[0].name === '甲' && list[0].input.name === '甲' && ui.readingKeyOf(list[0].input) === GOLDEN_KEY &&
        list[2].name === '1992-05-03 巳时 男' && ui.readingKeyOf(list[2].input) === V1_AS_V2_KEY, json(list.map((e) => [e.id, e.name]))];
    });
    check('导入的条目和 v5 的格式完全一样（id lib-<毫秒>、input 是 v5 的字段、没有 openedAt）', () => {
      const list = JSON.parse(s.getItem('ziwei-pro.library'));
      return [list.every((e) => /^lib-\d+$/.test(e.id) && Object.keys(e).join(',') === 'id,name,input' && Object.keys(e.input).join(',') === V5_INPUT_FIELDS &&
        typeof e.input.isLeap === 'boolean' && typeof e.input.year === 'number' && typeof e.input.longitude === 'string'), json(list)];
    });
    check('已有的条目原样不动；记下 ziwei-pro.v6 = 1', () => {
      const list = JSON.parse(s.getItem('ziwei-pro.library'));
      return [json(list[1]) === json(fx.storage['ziwei-pro.library'][0]) && s.getItem('ziwei-pro.v6') === '1', s.getItem('ziwei-pro.v6')];
    });
    check('只增不改：除命盘库和 ziwei-pro.v6 之外，所有键的值一个字节都没变', () => {
      const after = s.dump();
      const changed = Object.keys(Object.assign({}, before, after)).filter((k) => k !== 'ziwei-pro.library' && k !== 'ziwei-pro.v6' && before[k] !== after[k]);
      return [changed.length === 0, changed.join(',')];
    });
    check('导入后每个条目的对话和报告仍能按 key 读到', () => {
      const list = api.library.list();
      const recs = list.map((e) => api.readings.load(ui.readingKeyOf(e.input)));
      return [recs.every(Boolean) && recs[0].report.text === '## 一、命宫\n\n示例报告正文。' && recs[2].report.text === '旧版的完整报告正文。', json(recs.map((r) => r && r.thread.length))];
    });
    check('再跑一次不新增（有 v6 标记）', () => {
      const r = api.importV5Once();
      return [r.added.length === 0 && api.library.list().length === 3, json(r)];
    });
    check('去掉 v6 标记再跑也不新增（按 key 去重）', () => {
      s.removeItem('ziwei-pro.v6');
      const r = mk(s, clock(1763600000000)).importV5Once();
      return [r.added.length === 0 && JSON.parse(s.getItem('ziwei-pro.library')).length === 3 && s.getItem('ziwei-pro.v6') === '1', json(r)];
    });
    check('导入过之后删光命盘库，再跑也不会把盘加回来', () => {
      const api3 = mk(s, clock(1763700000000));
      for (const e of api3.library.list()) api3.library.remove(e.id);
      const r = api3.importV5Once();
      return [r.added.length === 0 && api3.library.list().length === 0, json(r)];
    });
  }
  {
    check('命盘库为空、只有上次命盘和一条解读记录 → 导入后命盘库有这张盘，记录按 key 读得到', () => {
      const s = memoryStorage({
        'ziwei-pro.lastChart.v1': JSON.stringify(fx.storage['ziwei-pro.lastChart.v1']),
        'ziwei-pro.readings.v2': JSON.stringify({ [GOLDEN_KEY]: fx.storage['ziwei-pro.readings.v2'][GOLDEN_KEY] })
      });
      const api = mk(s, clock(1763500000000));
      const r = api.importV5Once();
      const list = api.library.list();
      return [r.added.length === 1 && list.length === 1 && list[0].name === '甲' && api.readings.load(ui.readingKeyOf(list[0].input)) !== null, json(list)];
    });
    check('只有解读记录（没有上次命盘）→ 从 key 还原生辰，称呼取记录里存的', () => {
      const s = memoryStorage({ 'ziwei-pro.readings.v2': JSON.stringify(fx.storage['ziwei-pro.readings.v2']) });
      const api = mk(s, clock(1763500000000));
      api.importV5Once();
      const list = api.library.list();
      return [list.length === 2 && list.map((e) => e.id).join() === 'lib-1763000200000,lib-1763000100000' &&
        list[0].name === '甲' && ui.readingKeyOf(list[0].input) === GOLDEN_KEY &&
        list[1].name === '1990-06-15 申时 男' && ui.readingKeyOf(list[1].input) === DEFAULT_KEY, json(list.map((e) => [e.id, e.name]))];
    });
    check('没有对话也没有报告的记录、认不出的 key 不导入', () => {
      const s = memoryStorage({ 'ziwei-pro.readings.v2': JSON.stringify({
        [GOLDEN_KEY]: { thread: [], report: null, studioTab: 'chat', name: '', updatedAt: 1763000000000 },
        'not|a|key': { thread: [{ role: 'user', content: '问' }], report: null, studioTab: 'chat', name: '', updatedAt: 1763000000000 }
      }) });
      const r = mk(s, clock(1763500000000)).importV5Once();
      return [r.added.length === 0 && s.getItem('ziwei-pro.library') === null && s.getItem('ziwei-pro.v6') === '1', json(r)];
    });
    check('命盘库已满 60 张时不导入，也不挤掉已有的', () => {
      const lib = Array.from({ length: 60 }, (_, i) => ({ id: 'lib-' + (1762000000000 - i), name: '己' + i, input: fx.storage['ziwei-pro.library'][0].input }));
      const s = memoryStorage({ 'ziwei-pro.library': JSON.stringify(lib), 'ziwei-pro.lastChart.v1': JSON.stringify(fx.storage['ziwei-pro.lastChart.v1']) });
      const r = mk(s, clock(1763500000000)).importV5Once();
      return [r.added.length === 0 && s.getItem('ziwei-pro.library') === JSON.stringify(lib), json(r)];
    });
    check('命盘库读不出来（不是 JSON 数组）时不导入、不覆盖', () => {
      const s = memoryStorage({ 'ziwei-pro.library': '{broken', 'ziwei-pro.lastChart.v1': JSON.stringify(fx.storage['ziwei-pro.lastChart.v1']) });
      const r = mk(s, clock(1763500000000)).importV5Once();
      return [r.added.length === 0 && s.getItem('ziwei-pro.library') === '{broken' && s.getItem('ziwei-pro.v6') === null, json(r)];
    });
    check('写不进命盘库时不记 v6 标记（下次再试）', () => {
      const m = memoryStorage({ 'ziwei-pro.lastChart.v1': JSON.stringify(fx.storage['ziwei-pro.lastChart.v1']) });
      const s = Object.assign(Object.create(null), {
        getItem: m.getItem, removeItem: m.removeItem,
        setItem: (k, v) => { if (k === 'ziwei-pro.library') throw new Error('QuotaExceededError'); m.setItem(k, v); }
      });
      const r = mk(s, clock(1763500000000)).importV5Once();
      return [r.added.length === 1 && m.getItem('ziwei-pro.library') === null && m.getItem('ziwei-pro.v6') === null, json(m.dump())];
    });
  }

  /* ---------------------------------------------------------------- */
  section('v6 本机存储：默认实例（window.localStorage）');
  check('vm 里没有 window.localStorage：默认实例读到默认值、写也不抛错', () => {
    const api = ui.localStore;
    api.readings.save(GOLDEN_KEY, { thread: [{ role: 'user', content: '问' }] });
    api.library.add(GOLDEN, '甲');
    return [!!api && api.prefs.autoOpen() === false && api.readings.load(GOLDEN_KEY) === null && api.lastChart.load() === null, ''];
  });
  check('读 window.localStorage 本身抛错（沙箱 iframe）时也不抛错', () => {
    const b = boot(client, (l) => { Object.defineProperty(l.win, 'localStorage', { get() { throw new Error('SecurityError'); }, configurable: true }); });
    const api = b.ui && b.ui.localStore;
    return [!b.err && !!api && api.prefs.autoOpen() === false && api.library.list().length === 0 && api.form.load().year === 1990, b.err && b.err.message];
  });
  check('懒绑定：apply() 之后才出现的 window.localStorage 也读得到', () => {
    const b = boot(client);
    b.loaded.win.localStorage = fixtureStorage(fx);
    const api = b.ui && b.ui.localStore;
    return [!b.err && !!api && api.library.list().length === 1 && api.prefs.autoOpen() === true, b.err && b.err.message];
  });
}
