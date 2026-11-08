/* ================================================================
 * 紫微师 · 内核 (确定性排盘 + 工具定义 + 人设/方法论)
 *
 * 平台无关: 不依赖 DOM、不依赖 require、不依赖 window。
 * - 浏览器: 由 client.js 拼接在引擎之后, 读到 window.ZWEngine,
 *           并把 window.ZWCore 交给 ui-pro.js 使用。
 * - Node/Host: index.js 在 vm 沙箱里按同样顺序求值本文件,
 *           通过 globalThis.ZWCore 取得同一份实现。
 *
 * 单一事实来源: 排盘只走 ZWEngine.computeChart(与 iztro 逐字段对齐验证)。
 * ================================================================ */
(function (root) {
  'use strict';

  var E = root.ZWEngine;
  if (!E) throw new Error('ziwei-core: 需要先加载引擎 (ZWEngine)');

  var Core = {};

  /* ---------------- 常量 ---------------- */
  var DISCLAIMER_BRIEF = '本内容基于中华传统文化（紫微斗数）体系生成，非现代科学结论，仅供参考。涉及医疗 / 法律 / 投资 / 婚姻等具体决策，请咨询相关专业人士。';
  var DISCLAIMER_REPORT = '本报告基于中华传统文化（紫微斗数）体系生成，非现代科学结论，仅供参考，不构成医疗 / 法律 / 金融 / 婚姻等专业领域的决策依据。';

  var GENDERS = { male: '男', female: '女' };

  /* ---------------- 人设 / 方法论 ---------------- */
  var PERSONA = [
    '你是「紫微师 · 人生规划报告师」— LifeView 的命理报告交付角色。',
    '你是一个独立交付的完整闭环：从排盘到解读到终稿，无需人工审核、无需等待外部指令，收到生辰信息后自主完成全流程并直接交付。',
    '',
    '## 工作三段式',
    '1. 工具层（机器精排）：真太阳时校正 → 农历干支 → 十二宫 + 十四主星 → 四化 → 命主/身主/大限。',
    '   **排盘唯一来源是确定性排盘工具（ziwei_paipan / 工作台引擎）。工具失败必须停止并如实报告「排盘工具暂不可用，请稍后再试」，严禁凭记忆、规则或任何其他方式手工排盘——这是 P0 事故换来的铁律。**',
    '   调用者只给原始四要素（阳历/农历日期、钟表时间、性别、出生地经度），不要自行换算真太阳时或时辰索引（换算已内置）。',
    '2. 解读层（文化解读）：意象解盘九诀逐诀运用 + 鲲鹏报告 14 部分模板填充。',
    '3. 自检交付层：终稿逐条过自检清单与红线，全部通过后直接交付。',
    '',
    '## 接单方式',
    '- 用户给出**生辰四要素**（阳历或农历生日 / 出生钟表时间 / 性别 / 出生地经度）即开工。',
    '- 信息不全时一次性列出所缺项；给齐后不再追问，一次成型。',
    '- **时辰模糊必须追问，不得静默任选**；时辰边界告警（校正后距边界 <3 分钟）须向用户声明。',
    '- 交付形态：默认对话输出 markdown 报告；用户要求精装版时产出单文件自包含 HTML（棕褐木色中式精装，含封面、命盘网格、印章与免责声明）。',
    '- **精装 HTML 按平台能力走双通道交付**：',
    '  - 通道 A（有文件写入能力）：把完整 HTML 写出为文件，命名 `人生鲲鹏计划_<化名>_<yyyymmdd>.html`，明确告知保存路径并指引用浏览器打开。',
    '  - 通道 B（纯对话界面）：把完整 HTML 全文放进**单个代码块**，指引用户复制全部内容、保存为 `.html` 再打开。',
    '  - 无论走哪条通道，HTML 必须**一次完整交付**：不拆成多个代码块、不截断、不只给片段。',
    '',
    '## 意象解盘九诀（每诀至少 1 条命盘证据，至少用 6 诀）',
    '1. 太极定准：命宫地支/阴阳男女/五行局/命主身主——太极未定，不得开盘。',
    '2. 关联参合：主星 → 辅吉（昌曲/辅弼/魁钺/禄存天马）→ 辅煞（火铃/羊陀/空劫）综合意象。',
    '3. 四化寻机：禄=得力财源；权=掌势主动；科=得名文采贵人；忌=阻滞必修课。',
    '4. 三盘联动：本命/大限/流年同宫共振则吉，冲忌则凶。',
    '5. 放大寻幽：空宫借三方四正借力补位。',
    '6. 解厄破局：煞星汇聚不直接断凶，只给方向——修身/修业/修缘/修心。',
    '7. 意象通流：紫微=帝王、天机=智者、太阳=光明、武曲=将军、太阴=母亲、七杀=武士……翻译成现代角色与场景。',
    '8. 同宫互参：同宫主星互制互生（紫贪/武杀/同巨…）。',
    '9. 古今映照：范蠡/计然/子贡/沈万三/胡雪岩/乔致庸等映照当下，让命理成为行动指引。',
    '',
    '## 鲲鹏报告 14 部分（固定顺序）',
    '1 命盘总览与星谱定局（太极定准+关联参合）→ 2 性格分析与人生大略 → 3 家庭关系与家族能量（父母+兄弟）→ 4 婚姻状态与情感攻略 → 5 子女培育与相处模式 → 6 财富管理与生财之道（财帛+田宅）→ 7 健康预警与养生指引（疾厄，必含养生）→ 8 朋友交往与贵人能量（交友）→ 9 事业发展与生涯规划（官禄，四化寻机+古今映照）→ 10 居家风水与不动产（田宅）→ 11 心灵福德与精神追求（福德）→ 12 出行迁移与外缘机遇（迁移）→ 13 大限运势与人生节奏（三盘联动）→ 14 鲲鹏志略综合建议（五财道）。',
    '',
    '**致命主书**：给命主本人的一封收束信——命格主线一句定调 → 当下大限课题 → 三条个人化行动指引 → 十二字心法收束。禁套话，每句只适用于此命主。',
    '**十二字心法**：以星悟道，知位知微；指危心钥，行要心药。',
    '**五财道**（第 14 部分）：① 明确方向专精主业（官禄+命）② 修身养性蓄积能量（福德+疾厄）③ 经营人脉汇聚贵气（交友+父母）④ 理财守富防耗避损（财帛+田宅）⑤ 守心定性远离纷扰（夫妻+福德）。',
    '',
    '每部分至少含：格言引用（道德经/庄子/紫微古诀，须确凿可查）+ 正文 + 宫位卡片（主星/辅星/关键词/简注）+ 强调框或预警块。',
    '',
    '## 红线（强制，违反即不出）',
    '- ❌ 不预测寿命 / 死亡时间 / 重大疾病。',
    '- ❌ 不写「您必会 / 一定会 / 100%」类断言。',
    '- ❌ 不替命主决断婚姻 / 投资 / 转行 / 医疗——只给信息层：「命盘显示…倾向，您可参考」「这是信息层，决策您自己来」。',
    '- ❌ 不写宿命语（「命中带 X 不能 Y」）。',
    '- ❌ 财帛宫禁单边断（消费倾向必须两面或中性表述）；贵人/长辈助力放软留余地。',
    '- ✅ 多写命格结构与意象，少写行为断言；预测性内容一律留余地。',
    '- ✅ 文风：古白话与现代文相间，去除 AI 味。',
    '- ✅ 每份报告末尾必含免责声明。',
    '',
    '## 用户隐私',
    '生辰与个人信息只用于本次排盘解读，不向第三方披露；不承诺「不存储」「阅后即焚」；举例一律化名与模糊信息。'
  ].join('\n');

  var SELFCHECK = [
    '交付前自检（逐条核，全过才交付）：',
    '- [ ] 真太阳时已校正（出生地经度 ≠120° 必做，且已核对校正后时辰）',
    '- [ ] 农历干支 / 五行局 / 命主身主 / 大限段位正确',
    '- [ ] 14 部分齐，无跳号、无占位符残留',
    '- [ ] 命盘图位 12 宫格已实填（不留空占位）',
    '- [ ] 大限时间轴 5 个节点齐全、当前大限有高亮',
    '- [ ] 五财道 5 条全部填实，逐条对上宫位',
    '- [ ] 九诀至少用 6 诀，每诀对应至少 1 条命盘证据',
    '- [ ] 每处格言引用确凿可查（能说出出处）',
    '- [ ] 致命主书 + 十二字心法必写、三层展开、无套话',
    '- [ ] 文风：古白话与现代文相间，AI 味已除',
    '- [ ] 合规红线 0 命中',
    '- [ ] 免责声明在报告末尾'
  ].join('\n');

  var BRIEF_SHAPE = [
    '请输出 800-1200 字的速览解读，结构固定：',
    '一、命格总纲（格局定性）；二、三方四正要点；三、四化分布；四、大限走势；五、中肯建议（三条）。',
    '结尾附免责声明：' + DISCLAIMER_BRIEF
  ].join('\n');

  /* 有具体问题时不再套“固定五段式”：模板会把“这 10 年大运如何”答成命格总纲。 */
  var QA_RULES = [
    '直接回答用户这一次的问题，不要输出固定五段式，也不要复述命格总纲。',
    '顺序：先给结论（2 句以内）→ 依据（引用宫位 / 星曜 / 庙旺 / 四化 / 大限段位）→ 可执行建议（1–3 条）。',
    '涉及大限 / 大运 / 流年时，必须使用下方的【当前定位】：明确写出大限段位、宫位、大限四化与流年落点；不得自行推算或改写。',
    '看不出依据时直说“此盘未显示”，不得编造星曜或四化。',
    '全文 800–1200 字；结尾附免责声明：' + DISCLAIMER_BRIEF
  ].join('\n');

  /* ---------------- 排盘 ---------------- */
  /**
   * 归一化输入 → 引擎入参。调用者只给原始四要素，换算全部交给引擎。
   */
  function normalizeInput(raw) {
    var r = raw || {};
    if (r.calendar !== undefined && r.calendar !== 'solar' && r.calendar !== 'lunar') {
      throw new Error('calendar 只接受 solar（阳历）或 lunar（农历），收到: ' + JSON.stringify(r.calendar));
    }
    var calendar = r.calendar === 'lunar' ? 'lunar' : 'solar';
    /* 性别决定阴阳男女与大限顺逆：缺失或非法一律拒绝，绝不静默兜底成男命 */
    if (r.gender !== 'male' && r.gender !== 'female' && r.gender !== '男' && r.gender !== '女') {
      throw new Error('性别必须显式给出 male(男) 或 female(女)，收到: ' + JSON.stringify(r.gender) +
        '。缺失或非法时不得默认，请先向命主确认性别。');
    }
    var gender = (r.gender === 'female' || r.gender === '女') ? 'female' : 'male';

    /* 日期：接受 1992-05-03 或 年/月/日 字段 */
    var year, month, day;
    if (typeof r.date === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(r.date.trim())) {
      var parts = r.date.trim().split('-');
      year = +parts[0]; month = +parts[1]; day = +parts[2];
    } else {
      year = +r.year; month = +r.month; day = +r.day;
    }
    if (!isFinite(year) || !isFinite(month) || !isFinite(day)) {
      throw new Error('日期缺失或格式错误：需要 date=YYYY-MM-DD，或 year/month/day 三个数字');
    }

    /* 时间：接受 09:30 或 hour/minute 字段 */
    var hour, minute, hasClock = true;
    if (typeof r.time === 'string' && /^\d{1,2}:\d{2}$/.test(r.time.trim())) {
      var tp = r.time.trim().split(':');
      hour = +tp[0]; minute = +tp[1];
    } else if (r.hour !== undefined && r.hour !== null && r.hour !== '') {
      hour = +r.hour;
      minute = (r.minute === undefined || r.minute === null || r.minute === '') ? 0 : +r.minute;
    } else {
      hasClock = false;
      hour = 0; minute = 0;
    }
    if (hasClock && (!isFinite(hour) || !isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59)) {
      throw new Error('时间超出范围：需要 HH:MM（24 小时制钟表时间）');
    }

    var longitude;
    if (r.longitude === undefined || r.longitude === null || r.longitude === '') {
      longitude = undefined;
    } else {
      longitude = +r.longitude;
      if (!isFinite(longitude) || longitude < 60 || longitude > 140) {
        throw new Error('经度须为 60~140 之间的数字（中国境内约 73~135），收到: ' + r.longitude);
      }
    }

    return {
      calendar: calendar,
      year: year, month: month, day: day,
      isLeapMonth: !!r.isLeapMonth,
      hour: hour, minute: minute,
      hasClock: hasClock,
      gender: gender,
      longitude: longitude,
      settings: r.settings
    };
  }

  /**
   * 确定性排盘。唯一来源 = ZWEngine.computeChart。
   * @returns {{ok: true, chart: object, input: object} | {ok: false, error: string}}
   */
  function paipan(raw) {
    var input;
    try { input = normalizeInput(raw); } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
    if (!input.hasClock) {
      return { ok: false, error: '缺少出生钟表时间：紫微斗数定时辰必需，请提供 HH:MM（如 09:30）；若只知道时辰（如「辰时」），请向命主确认后再排——不得静默任选。' };
    }
    var chart;
    try { chart = E.computeChart(input); } catch (e) {
      return { ok: false, error: '排盘引擎异常: ' + String((e && e.message) || e) };
    }
    if (!chart || chart.error) return { ok: false, error: (chart && chart.error) || '未知排盘错误' };
    return { ok: true, chart: chart, input: input };
  }

  /* ---------------- 命盘文本 ---------------- */
  /** 引擎原生命盘文本（含四柱/农历/真太阳时/十二宫/四化/大限）。 */
  function chartText(chart) { return E.chartText(chart); }

  /** 某宫主星/辅星单行文本。 */
  function starLine(p) {
    if (!p) return '—';
    var major = (p.major || []).map(function (s) {
      return s.name + (s.brightness ? '[' + s.brightness + ']' : '') + (s.mutagen ? '化' + s.mutagen : '');
    }).join(' ');
    var minor = (p.minor || []).map(function (s) {
      return s.name + (s.mutagen ? '化' + s.mutagen : '');
    }).join(' ');
    return (major || '空宫') + (minor ? ' | ' + minor : '');
  }

  /** 四化列表（星名数组，按 禄/权/科/忌 顺序）→ 带落宫文本。 */
  function mutagenLine(chart, stars) {
    if (!stars || !stars.length) return '无';
    var marks = ['禄', '权', '科', '忌'];
    return stars.map(function (name, i) {
      var where = '';
      for (var k = 0; k < chart.palaces.length; k++) {
        var all = (chart.palaces[k].major || []).concat(chart.palaces[k].minor || []);
        for (var j = 0; j < all.length; j++) if (all[j].name === name) { where = '（' + chart.palaces[k].name + '）'; break; }
        if (where) break;
      }
      return name + '化' + (marks[i] || '?') + where;
    }).join('、');
  }

  /** 按公历年近似虚岁（农历新年前可能差一岁，用于“这十年”定位够用）。 */
  function nominalAgeIn(chart, year) {
    var birthYear = chart && chart.lunar ? chart.lunar.year : null;
    if (!birthYear || !year) return null;
    return year - birthYear + 1;
  }

  /**
   * 当前时间定位：当前大限 + 当前流年。
   * 这是“问这 10 年大运却答成命格总纲”的根因修复点：模型必须拿到
   * “现在处于哪一段、它的宫位/四化/三方四正”才能定向回答，而不是只看到
   * 每宫里嵌着的“大限 35-44”标签。
   */
  function currentContext(chart, opts) {
    var o = opts || {};
    var year = Number(o.currentYear) || new Date().getFullYear();
    var age = Number(o.currentAge) || nominalAgeIn(chart, year);
    if (!age) return '';
    var L = [];
    L.push('【当前定位】排盘基准年 ' + year + '，虚岁 ' + age + '（按公历年近似）。');

    var dec = [];
    try { dec = E.decadalList(chart) || []; } catch (e) { dec = []; }
    var cur = null;
    for (var i = 0; i < dec.length; i++) {
      if (age >= dec[i].ageRange[0] && age <= dec[i].ageRange[1]) { cur = dec[i]; break; }
    }
    if (!cur) {
      L.push('当前虚岁不在已排大限区间内（起运前或超出 124 岁）；涉及大限的问题要如实说明。');
    } else {
      var names = cur.palaceNames || [];
      var at = function (name) { for (var k = 0; k < names.length; k++) if (names[k] === name) return chart.palaces[k]; return null; };
      L.push('当前大限：' + cur.ageRange[0] + '–' + cur.ageRange[1] + ' 虚岁（公历 ' + cur.yearRange[0] + '–' + cur.yearRange[1] + '），' +
        cur.stem + cur.branch + '，大限命宫落本命「' + cur.palaceName + '」宫。');
      L.push('大限四化：' + mutagenLine(chart, cur.mutagen) + '。');
      ['命宫', '财帛', '官禄', '迁移'].forEach(function (nm) {
        var p = at(nm);
        if (p) L.push('大限' + nm + '：本命' + p.name + '（' + p.stem + p.branch + '）' + starLine(p));
      });
    }

    var hs = null;
    try { hs = E.yearlyForYear(chart, year); } catch (e) { hs = null; }
    if (hs && hs.yearly) {
      var yp = hs.yearly;
      var yNames = yp.palaceNames || [];
      var yAt = function (name) { for (var k = 0; k < yNames.length; k++) if (yNames[k] === name) return chart.palaces[k]; return null; };
      var soul = yAt('命宫');
      L.push('流年 ' + year + '：' + yp.stem + yp.branch + '，流年命宫落本命「' + (soul ? soul.name : '?') + '」宫；流年四化：' +
        mutagenLine(chart, yp.mutagen) + '。');
      ['财帛', '官禄', '迁移'].forEach(function (nm) {
        var p = yAt(nm);
        if (p) L.push('流年' + nm + '：本命' + p.name + '（' + p.stem + p.branch + '）' + starLine(p));
      });
    }
    return L.join('\n');
  }

  /**
   * 面向上报交付的加长命盘上下文：基本盘 + 十二宫三方四正 + 四化落宫 +
   * 全部 12 段大限 + （给了当前年龄时）当前大限/流年定位 + 格局。
   * opts: { currentAge?, currentYear? } —— 面板问答与 agent 工具都走这里，保证两边口径一致。
   */
  function fullChartText(chart, opts) {
    var o = opts || {};
    var out = [];
    out.push(E.chartText(chart));
    out.push('');
    out.push('──── 解读用补充上下文 ────');

    var PALACE_ORDER = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
    var find = function (name) {
      for (var i = 0; i < chart.palaces.length; i++) if (chart.palaces[i].name === name) return chart.palaces[i];
      return null;
    };

    out.push('十二宫主星与辅星（逐宫）:');
    PALACE_ORDER.forEach(function (name) {
      var p = find(name);
      if (!p) return;
      out.push('  ' + name + '(' + p.stem + p.branch + (p.isBody ? '·身宫' : '') + ') ' + starLine(p));
    });

    out.push('');
    out.push('四化落宫: ' + (chart.mutagens || []).map(function (m) {
      return m.star + '化' + m.mutagen + '(' + m.palaceName + ')';
    }).join('  ') || '（无）');

    var dec = [];
    try { dec = E.decadalList(chart) || []; } catch (e) { dec = []; }
    if (dec.length) {
      out.push('');
      out.push('十二大限（按虚岁升序，全部 12 段）:');
      dec.forEach(function (d) {
        out.push('  ' + d.ageRange[0] + '–' + d.ageRange[1] + ' 虚岁（公历 ' + d.yearRange[0] + '–' + d.yearRange[1] + '）' +
          d.stem + d.branch + '（' + d.palaceName + '宫为限命）大限四化: ' + mutagenLine(chart, d.mutagen));
      });
    }

    var ctx = currentContext(chart, o);
    if (ctx) {
      out.push('');
      out.push(ctx);
    }

    var pats = [];
    try { pats = E.detectPatterns(chart) || []; } catch (e) { pats = []; }
    if (pats.length) {
      out.push('');
      out.push('格局识别: ' + pats.map(function (p) { return p.name + (p.note ? '（' + p.note + '）' : ''); }).join('；'));
    }
    return out.join('\n');
  }

  /* ---------------- 黄金用例自检 ---------------- */
  /* 与 verify/golden-test.sh 同一组断言：1992-05-03 09:30 男 经度 105.97 */
  var GOLDEN = {
    date: '1992-05-03', time: '09:30', gender: 'male', longitude: 105.97,
    expect: {
      solarTime: '08:37',
      timeName: '辰时',
      timeIndex: 4,
      lunarText: '4月初一',
      lunarYear: 1992,
      soulBranch: '丑',
      fiveElementsClass: '木三局',
      soulMajor: ['太阳', '太阴']
    }
  };

  /**
   * 跑黄金用例四断言。排盘工具、脚本、运行环境有任何改动后必跑。
   * 任何一项不符 = 工具损坏，停止交付并如实报告。
   */
  function goldenCheck() {
    var res = paipan(GOLDEN);
    if (!res.ok) {
      return { ok: false, passed: 0, total: 4, failures: ['排盘失败: ' + res.error], actual: null };
    }
    var c = res.chart;
    var corr = (c.meta && c.meta.solarCorrection) || {};
    var soul = null;
    for (var i = 0; i < c.palaces.length; i++) if (c.palaces[i].name === '命宫') soul = c.palaces[i];
    var soulMajor = (soul ? soul.major : []).map(function (s) { return s.name; }).sort();
    var expectMajor = GOLDEN.expect.soulMajor.slice().sort();
    var actual = {
      solarTime: corr.solarTime,
      timeName: c.timeName,
      timeIndex: c.timeIndex,
      lunarText: c.lunarText,
      lunarYear: c.lunar && c.lunar.year,
      soulBranch: c.soulBranch,
      fiveElementsClass: c.fiveElementsClass,
      soulMajor: soulMajor
    };
    var failures = [];
    if (corr.solarTime !== GOLDEN.expect.solarTime || c.timeIndex !== GOLDEN.expect.timeIndex) {
      failures.push('断言1 真太阳时/时辰索引: 期望 ' + GOLDEN.expect.solarTime + '/' + GOLDEN.expect.timeName +
        '(' + GOLDEN.expect.timeIndex + ')，实际 ' + corr.solarTime + '/' + c.timeName + '(' + c.timeIndex + ')');
    }
    if (c.lunarText !== GOLDEN.expect.lunarText || (c.lunar && c.lunar.year) !== GOLDEN.expect.lunarYear) {
      failures.push('断言2 农历: 期望 ' + GOLDEN.expect.lunarYear + '年' + GOLDEN.expect.lunarText +
        '，实际 ' + (c.lunar && c.lunar.year) + '年' + c.lunarText);
    }
    if (c.soulBranch !== GOLDEN.expect.soulBranch || soulMajor.join(',') !== expectMajor.join(',')) {
      failures.push('断言3 命宫: 期望 地支' + GOLDEN.expect.soulBranch + ' 主星[' + expectMajor.join(' ') +
        ']，实际 地支' + c.soulBranch + ' 主星[' + soulMajor.join(' ') + ']');
    }
    var tianzhai = null;
    for (var j = 0; j < c.palaces.length; j++) if (c.palaces[j].name === '田宅') tianzhai = c.palaces[j];
    var tzMajor = (tianzhai ? tianzhai.major : []).map(function (s) { return s.name; });
    if (c.fiveElementsClass !== GOLDEN.expect.fiveElementsClass || tzMajor.indexOf('紫微') < 0) {
      failures.push('断言4 五行局/田宅: 期望 五行局' + GOLDEN.expect.fiveElementsClass + ' 且 田宅含紫微，实际 五行局' +
        c.fiveElementsClass + ' 田宅[' + tzMajor.join(' ') + ']');
    }
    return {
      ok: failures.length === 0,
      passed: 4 - failures.length,
      total: 4,
      failures: failures,
      actual: actual
    };
  }

  /* ---------------- 解读请求组装 ---------------- */
  /** 把命盘 + 模式 + 追问组装成一次解读请求（host / client 共用同一份措辞）。 */
  function buildRequest(opts) {
    var o = opts || {};
    var meta = o.meta || {};
    var mode = o.mode === 'report' ? 'report' : 'brief';
    var question = o.question ? String(o.question).trim() : '';
    var history = Array.isArray(o.history) ? o.history : [];
    var currentAge = Number(meta.currentAge) || 0;
    var currentYear = Number(meta.currentYear) || 0;
    var chart = o.chart
      ? fullChartText(o.chart, { currentAge: currentAge, currentYear: currentYear })
      : String(o.chartText || '');
    var asked = question.length > 0;

    var system;
    if (mode === 'report') {
      system = PERSONA + '\n\n## 本次交付形态：完整鲲鹏报告\n' +
        '请基于下方确定性排盘输出完整鲲鹏报告（14 部分 + 致命主书 + 十二字心法，markdown 格式）。\n' +
        '全文用 markdown：## 章节（编号+名称）、### 小节、**加粗**、- 列表、> 格言引用（须确凿可查）。\n' +
        '文末必附免责声明：' + DISCLAIMER_REPORT + '\n\n' + SELFCHECK;
    } else if (asked) {
      system = PERSONA + '\n\n## 本次交付形态：定向问答\n' + QA_RULES;
    } else {
      system = PERSONA + '\n\n## 本次交付形态：速览解读\n' + BRIEF_SHAPE;
    }

    var metaLines = [];
    if (meta.name) metaLines.push('称呼：' + meta.name);
    if (meta.place) metaLines.push('籍贯/出生地：' + meta.place);
    if (meta.occupation) metaLines.push('职业/诉求：' + meta.occupation);
    if (meta.gender) metaLines.push('性别：' + (GENDERS[meta.gender] || meta.gender));

    var opener = mode === 'report'
      ? '请基于以下确定性排盘输出完整鲲鹏报告（14 部分 + 致命主书 + 十二字心法，markdown 格式）。'
      : (asked
        ? '以下是命主的确定性排盘与当前时间定位（非模型心算）。请回答随后的问题。'
        : '请解读以下紫微斗数命盘（由确定性排盘工具生成，非模型心算）。');

    var first = opener +
      (metaLines.length ? '\n' + metaLines.join('；') + '。' : '') +
      '\n\n' + chart;

    /* 问题意图定位：大限/大运/流年类问题必须钉在当前定位上，否则模型会滑回命格总纲。 */
    var focus = [];
    var focusText = question + ' ' + String(meta.occupation || '');
    var decadalIntent = /大限|大运|十年|这\s*10\s*年|未来十年|下一个十年|这步运|中年|当前阶段/.test(focusText);
    var yearlyIntent = /流年|今年|明年|去年|年运|流年盘|20\d{2}\s*年/.test(focusText);
    var decadalFocus = Array.isArray(meta.decadalFocus) && meta.decadalFocus.length === 2 ? meta.decadalFocus : null;
    var yearlyFocus = Number(meta.yearlyFocus) || 0;
    if (decadalFocus) {
      focus.push('命主在面板中选中的大限是 ' + decadalFocus[0] + '–' + decadalFocus[1] + ' 虚岁。');
    } else if (decadalIntent && !yearlyIntent) {
      focus.push('用户问的是大限 / 大运（这十年）。');
    }
    if (yearlyFocus) {
      focus.push('命主在面板中看的是 ' + yearlyFocus + ' 年流年。');
    } else if (yearlyIntent && !decadalIntent) {
      focus.push('用户问的是流年 / 年运。');
    }
    if (focus.length) {
      var focusBody = yearlyFocus || (yearlyIntent && !decadalFocus)
        ? '请以「当前定位」里的流年段落为主线：先写该年干支、流年命宫与本命落点、流年四化，再结合当前大限讲这一年的节奏与取舍，最后给 1–3 条建议；不要复述命格总纲。'
        : '请以「当前定位」里的当前大限为主线：先定位段位 / 宫位 / 大限四化，再讲这十年的三方四正与节奏，最后给 1–3 条建议；不要复述命格总纲。';
      first += '\n\n【本轮聚焦】' + focus.join('') + focusBody;
    }

    var messages = [{ role: 'user', content: first }];
    history.forEach(function (m) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) return;
      var text = typeof m.content === 'string' ? m.content : '';
      if (!text.trim()) return;
      messages.push({ role: m.role, content: text });
    });
    if (question) messages.push({ role: 'user', content: question });

    return { system: system, messages: messages, mode: mode };
  }

  /* ---------------- 导出 ---------------- */
  Core.PERSONA = PERSONA;
  Core.SELFCHECK = SELFCHECK;
  Core.DISCLAIMER_BRIEF = DISCLAIMER_BRIEF;
  Core.DISCLAIMER_REPORT = DISCLAIMER_REPORT;
  Core.GOLDEN = GOLDEN;
  Core.normalizeInput = normalizeInput;
  Core.paipan = paipan;
  Core.chartText = chartText;
  Core.fullChartText = fullChartText;
  Core.currentContext = currentContext;
  Core.goldenCheck = goldenCheck;
  Core.buildRequest = buildRequest;
  Core.VERSION = '1.0.0';

  root.ZWCore = Core;
})(typeof window !== 'undefined' ? window : globalThis);
