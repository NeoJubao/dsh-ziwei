/* ================================================================
 * 紫微斗数 Pro — 专业独立工作台 (Harness Web UI 插件)
 * 架构: 顶栏 + 左栏(输入/命主/命盘库) + 主舞台(命盘盘面/详情/工具页)
 * ================================================================ */
window.__ModuleLoader__.load({
  id: '@local/ziwei-workbench',
  factory(require) {
    /* 首次物化时才求值引擎/内核（懒加载，见 build.mjs 的 KERNEL_HEAD） */
    if (typeof __ziweiBootstrapKernel === 'function') __ziweiBootstrapKernel();
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useMemo, useRef } = React;
    const E = window.ZWEngine;
    /* 构建时由 build.mjs 注入 package.json 的版本号；未构建的源码里保留占位符。 */
    const APP_VERSION = '__ZIWEI_VERSION__';

    /* ---------------- i18n ---------------- */
    const DICT = {
      'zh-CN': {
        brand: '紫微斗数', brandPro: 'Pro', tagline: '专业排盘 · 智能解读',
        formTitle: '排盘输入', name: '姓名', namePh: '命主称呼（选填）',
        calendar: '历法', solar: '公历', lunar: '农历',
        year: '年', month: '月', day: '日', leap: '闰月',
        time: '出生时间', hour: '时', minute: '分',
        gender: '性别', male: '男', female: '女',
        lonLabel: '出生地经度', lonPh: '如 116.4（真太阳时校正，可留空）',
        placeLabel: '籍贯', placePh: '选填，用于报告',
        occupationLabel: '职业 / 诉求', occupationPh: '选填，用于报告',
        compute: '排 盘',
        settings: '排盘设置', yearDivide: '年柱', ydNormal: '正月初一', ydExact: '立春',
        monthDivide: '月柱', mdNormal: '农历月', mdExact: '节气',
        monthDivideHint: '四柱月柱默认按节气；命宫/星曜仍按农历月，不受此处影响。',
        dayDivide: '晚子时', ddForward: '按次日', ddCurrent: '按当日',
        fixLeap: '闰月', flTrue: '下半月按下月', flFalse: '整月按本月',
        summaryTitle: '命主信息', solarLabel: '公历', lunarLabel: '农历',
        zodiac: '生肖', sign: '星座', soul: '命宫', body: '身宫', class5: '五行局',
        soulMaster: '命主', bodyMaster: '身主', startAge: '起运', solarTime: '真太阳时',
        uncorrected: '未校正', boundaryWarn: '⚠ 时辰边界告警：校正后时刻贴近时辰交界，请核对出生钟表时间',
        tabNatal: '本命盘', tabDecadal: '大限', tabYearly: '流年', tabPatterns: '格局分析', tabDict: '星曜词典',
        decadalListTitle: '十二大限', decadalInfoTitle: '大限四化',
        yearlyLabel: '流年', yearlyYear: '年份', yearlyPlaceholder: '如 2026',
        smallLimit: '小限', decadal: '大限', twelveGods: '十二神',
        bodyMark: '身', mingMark: '命',
        palace: '宫', emptyState: '填写出生信息，点击「排 盘」开始',
        mainStars: '主星', minorStars: '辅星', adjStars: '杂曜',
        showAdj: '显示杂曜', hideAdj: '隐藏杂曜', adjChip: '杂曜',
        editBirth: '改生辰', collapseForm: '收起', expandForm: '展开',
        focusOn: '专注看盘', focusOff: '退出专注', emptyPalace: '空宫',
        emptyCta: '用示例生辰先排一盘', defaultName: '命主',
        oppPalace: '对宫', triPalace: '三合', detailTitle: '宫位详情',
        mutagenTitle: '四化', noMutagen: '—',
        ai: '紫微师解读', aiTitle: '紫微师解读',

        /* ---- v4 工作台 ---- */
        navHome: '首页', navChart: '命盘', navReading: '解读', navReport: '报告',
        navLabel: '工作台导航', navNeedChart: '先新建一张命盘',
        homeEyebrow: '紫微斗数 · 人生规划工作台',
        homeTitleA: '把一张命盘，', homeTitleB: '读成一条人生路线。',
        homeStatSavedBare: '张已保存', homeStatRecentBare: '张最近看过',
        homeStatLast: '上次：{name} · {time}',
        homeNew: '新建命盘', homeSample: '示例命盘',
        homeRecentTitle: '我的命盘', homeRecentMeta: '最近看过的盘会自动出现在这里',
        homeCardNew: '新建一张', homeEmptyTitle: '还没有命盘',
        homeEmptyHint: '新建一张，排盘后会自动出现在这里。',
        homeSavedTag: '已保存', homeRecentTag: '最近', homeRemove: '移除记录',
        createTitle: '新建命盘', createSub: '填写出生信息，排盘后进入命盘阅读。',
        createSubmit: '排盘并查看', createSample: '用示例生辰',
        createWhat: '你会得到', createAsideTitle: '排盘与隐私',
        createWhat1: '确定性命盘、四化与大限',
        createWhat2: '格局分析：一眼看懂盘面结构',
        createWhat3: '紫微师解读：带上下文直接聊',
        createWhat4: '完整鲲鹏报告：14 个部分',
        createWhat5: '精装 HTML：可离线阅读、打印',
        createSubmitEdit: '重新排盘',
        chartInterpret: '解读这张盘', chartEdit: '改生辰',
        chartSave: '保存命盘', chartSaved: '已保存', chartUnsave: '取消保存',
        readingTitle: '紫微师解读', readingGreeting: '先把这张盘读懂。',
        readingLead: '命盘已经带入。可以直接问一个问题，也可以先出一份速览解读。',
        readingSug1: '重点讲事业与财运', readingSug2: '这十年大限要注意什么',
        readingSug3: '我的性格与优势', readingSug4: '写完整鲲鹏报告', readingSug4Meta: '完整报告',
        readingAskPh: '问事业、财运、大限…', readingHint: 'Enter 发送 · Shift+Enter 换行',
        readingTabChat: '对话', readingTabDock: '报告', readingCtxIn: '命盘已带入',
        dockEyebrow: '完整鲲鹏报告', dockTitle: '报告工位', dockMeta: '生成后可预览、全屏阅读、导出 HTML',
        dockIdleTitle: '把这张盘读成一份完整报告。',
        dockIdleLead: '14 个部分：命盘总览、性格大略、家庭、婚姻、子女、财富、健康、朋友、事业、居所、福德、迁移、大限、综合建议。约 2–3 分钟。',
        reportGenerate: '生成完整报告', reportGenerating: '正在撰写完整报告…',
        reportChars: '{n} 字', reportSections: '{n} / 14 部分',
        reportStop: '停止', reportContinue: '继续生成', reportRetry: '重试', reportRegenerate: '重新生成',
        reportRead: '全屏阅读', reportExport: '导出 HTML', reportCopy: '复制全文', reportCopied: '已复制',
        reportReady: '报告已完成', reportFailed: '报告生成中断', reportEmpty: '还没有生成报告',
        reportHint: '报告会保留在本页；导出 HTML 后可离线阅读、打印或转发。',
        reportHintFoot: '完成后可全屏阅读、导出 HTML', reportName: '人生鲲鹏计划 · 完整报告',
        reportPart1: '命盘总览', reportPart2: '性格大略', reportPart3: '家庭关系', reportPart4: '婚姻情感',
        reportPart5: '子女培育', reportPart6: '财富管理', reportPart7: '健康养生', reportPart8: '朋友贵人',
        reportPart9: '事业发展', reportPart10: '居家风水', reportPart11: '心灵福德', reportPart12: '出行迁移',
        reportPart13: '大限节奏', reportPart14: '综合建议',
        readerBack: '返回解读', readerFull: '全屏', readerExitFull: '退出全屏',
        relJustNow: '刚刚', relMin: '{n} 分钟前', relHour: '{n} 小时前', relYesterday: '昨天', relDays: '{n} 天前',
        aiSend: '发送', aiNewChat: '新对话', aiAskPh: '追问命盘，Enter 发送',
        aiStartBrief: '速览解读', aiStartReport: '完整鲲鹏报告',
        aiFullReport: '完整报告', aiFullReportHint: '基于当前命盘生成完整鲲鹏报告（14 部分）',
        aiEmptyHint: '命盘已带入。直接提问，或先看一份解读。',
        timeScope: '命盘时间维度', backToBoard: '返回盘面',
        prevDecade: '上一个大限', nextDecade: '下一个大限', backToCurrent: '回到当前',
        currentBadge: '当前', thisYear: '今年', prevYear: '上一年', nextYear: '下一年',
        collapseRail: '收起生辰栏', expandRail: '展开生辰栏', editBirthShort: '生辰',
        chartTools: '工具', openPatterns: '格局分析', openDict: '星曜词典',
        handoff: '新会话解读', handoffDone: '已开新会话 ✓',
        handoffHint: '把当前命盘交给会话；之后在对话里说「继续聊这个盘」或「写鲲鹏报告」即可',
        disclaimerShort: '传统文化解读，非科学结论，仅供参考。具体决策请咨询专业人士。',
        aiInterpreting: '解读中…', interpStreaming: '生成中…',
        aiThinking: '思考中…', aiStop: '停止', aiContinue: '继续生成',
        aiStopped: '已停止生成，内容可能不完整；可点「继续生成」接着写',
        aiDisconnected: '连接中断，内容可能不完整；可点「继续生成」接着写',
        aiContinuePrompt: '请接着上文继续写：从断处接着写，不要重复已写内容，也不要重新开头。',
        aiCopy: '复制', aiCopied: '已复制',
        sync: '写入会话', synced: '已写入 ✓',
        syncHint: '只把当前命盘写进会话上下文（不新建会话）；之后在任意会话里说「读取工作台命盘并写鲲鹏报告」即可', exportHtml: '导出精装 HTML', previewHtml: '预览报告', closePreview: '关闭预览',
        aiRetry: '重新解读',
        autoOpen: '启动时自动打开工作台', showAdjSet: '宫格默认显示杂曜',
        settingsTitle: '设置', close: '关闭', about: '关于',
        versionLabel: '版本', checkUpdate: '检查更新', checking: '检查中…',
        updateHint: '仅点击时检查一次，不后台联网；更新需你自己执行命令。',
        upToDate: '已是最新（{version}）', updateAvailable: '发现新版本 {latest}；更新：',
        updateFailed: '检查失败：{reason}',
        backToConversation: '返回会话',
        aboutText: '紫微斗数 Pro · 算法依据《紫微斗数全书》安星诀，与开源库 iztro 逐字段交叉验证。真太阳时校正含经度差与均时差。本工具仅供研究参考。',
        libTitle: '命盘库', libName: '盘名', libSave: '保存', libEmpty: '暂无保存的命盘', libDelete: '删除',
        patternTitle: '格局分析', patternEmpty: '未检测到显著格局',
        dictTitle: '星曜词典', dictPlaceholder: '搜索星曜…',
        keyboardHint: '点盘面后：←→ 切换宫位 · ↑↓ 跳对宫',
        copy: '复制命盘', copied: '已复制',
        note1: '算法依据《紫微斗数全书》安星诀（14 主星 · 14 辅星 · 38 杂曜 · 十二神 · 大限小限 · 流曜），与开源库 iztro 逐字段交叉验证。',
        note2: '流派选项：年柱可按正月初一或立春分界；月柱可按农历月或节气；晚子时可换日或按当日；闰月下半月可按下月。'
      },
      'en-US': {
        brand: 'Zi Wei Dou Shu', brandPro: 'Pro', tagline: 'Charting · Analysis',
        formTitle: 'Birth Data', name: 'Name', namePh: 'Name (optional)',
        calendar: 'Calendar', solar: 'Solar', lunar: 'Lunar',
        year: 'Year', month: 'Month', day: 'Day', leap: 'Leap',
        time: 'Birth Time', hour: 'Hr', minute: 'Min',
        gender: 'Gender', male: 'Male', female: 'Female',
        lonLabel: 'Longitude °E', lonPh: 'e.g. 116.4 (true solar time)',
        placeLabel: 'Place', placePh: 'optional', occupationLabel: 'Occupation / Focus', occupationPh: 'optional',
        compute: 'Draw Chart',
        settings: 'Options', yearDivide: 'Year', ydNormal: 'LNY', ydExact: 'Lichun',
        monthDivide: 'Month', mdNormal: 'Lunar', mdExact: 'Terms',
        monthDivideHint: 'Month pillar uses solar terms by default; palaces and stars still use the lunar month.',
        dayDivide: 'Late Rat', ddForward: 'Next Day', ddCurrent: 'Same Day',
        fixLeap: 'Leap', flTrue: '2nd half next', flFalse: 'whole month',
        summaryTitle: 'Profile', solarLabel: 'Solar', lunarLabel: 'Lunar',
        zodiac: 'Zodiac', sign: 'Sign', soul: 'Soul', body: 'Body', class5: 'Class',
        soulMaster: 'Soul Star', bodyMaster: 'Body Star', startAge: 'Start', solarTime: 'True Solar',
        uncorrected: 'uncorrected', boundaryWarn: '⚠ Near hour boundary — verify clock time',
        tabNatal: 'Natal', tabDecadal: 'Decades', tabYearly: 'Yearly', tabPatterns: 'Patterns', tabDict: 'Dictionary',
        decadalListTitle: 'Decades', decadalInfoTitle: 'Decade Transforms',
        yearlyLabel: 'Yearly', yearlyYear: 'Year', yearlyPlaceholder: 'e.g. 2026',
        smallLimit: 'Xiaoxian', decadal: 'Decade', twelveGods: 'Gods',
        bodyMark: 'Body', mingMark: 'Soul',
        palace: 'Palace', emptyState: 'Fill birth data and press "Draw Chart"',
        mainStars: 'Major', minorStars: 'Minor', adjStars: 'Adj',
        showAdj: 'Show adj', hideAdj: 'Hide adj', adjChip: 'Adj',
        editBirth: 'Edit birth data', collapseForm: 'Collapse', expandForm: 'Expand',
        focusOn: 'Focus chart', focusOff: 'Exit focus', emptyPalace: 'Empty',
        emptyCta: 'Draw a sample chart', defaultName: 'Native',
        oppPalace: 'Opposite', triPalace: 'Trine', detailTitle: 'Palace Detail',
        mutagenTitle: 'Transforms', noMutagen: '—',
        ai: 'Reading', aiTitle: 'Zi Wei Reading',

        /* ---- v4 workbench ---- */
        navHome: 'Home', navChart: 'Chart', navReading: 'Reading', navReport: 'Report',
        navLabel: 'Workbench navigation', navNeedChart: 'Create a chart first',
        homeEyebrow: 'Zi Wei Dou Shu · Life planning desk',
        homeTitleA: 'Turn one chart ', homeTitleB: 'into a life route.',
        homeStatSavedBare: 'saved', homeStatRecentBare: 'recently viewed',
        homeStatLast: 'Last: {name} · {time}',
        homeNew: 'New chart', homeSample: 'Sample chart',
        homeRecentTitle: 'My charts', homeRecentMeta: 'Charts you open show up here',
        homeCardNew: 'Create one', homeEmptyTitle: 'No charts yet',
        homeEmptyHint: 'Create one and it will appear here.',
        homeSavedTag: 'Saved', homeRecentTag: 'Recent', homeRemove: 'Remove',
        createTitle: 'New chart', createSub: 'Enter the birth data, then read the chart.',
        createSubmit: 'Draw chart', createSample: 'Use sample',
        createWhat: 'What you get', createAsideTitle: 'Charting & privacy',
        createWhat1: 'Deterministic chart, transforms and decades',
        createWhat2: 'Pattern analysis of the chart structure',
        createWhat3: 'Zi Wei reading with chart context',
        createWhat4: 'Full Kunpeng report in 14 parts',
        createWhat5: 'Self-contained HTML for offline reading',
        createSubmitEdit: 'Redraw chart',
        chartInterpret: 'Read this chart', chartEdit: 'Edit birth data',
        chartSave: 'Save chart', chartSaved: 'Saved', chartUnsave: 'Remove from saved',
        readingTitle: 'Zi Wei reading', readingGreeting: 'Start with this chart.',
        readingLead: 'The chart is attached. Ask a question, or start with a quick reading.',
        readingSug1: 'Career and money', readingSug2: 'What to watch in this decade',
        readingSug3: 'Strengths and blind spots', readingSug4: 'Write the full Kunpeng report', readingSug4Meta: 'Full report',
        readingAskPh: 'Ask about career, money, decades…', readingHint: 'Enter to send · Shift+Enter for newline',
        readingTabChat: 'Chat', readingTabDock: 'Report', readingCtxIn: 'Chart attached',
        dockEyebrow: 'Full Kunpeng report', dockTitle: 'Report desk', dockMeta: 'Preview, read full screen and export HTML',
        dockIdleTitle: 'Turn this chart into a full report.',
        dockIdleLead: '14 parts: overview, personality, family, marriage, children, wealth, health, friends, career, home, spirit, travel, decades, advice. Takes 2–3 minutes.',
        reportGenerate: 'Generate full report', reportGenerating: 'Drafting the full report…',
        reportChars: '{n} chars', reportSections: '{n} / 14 parts',
        reportStop: 'Stop', reportContinue: 'Continue', reportRetry: 'Retry', reportRegenerate: 'Regenerate',
        reportRead: 'Read full screen', reportExport: 'Export HTML', reportCopy: 'Copy all', reportCopied: 'Copied',
        reportReady: 'Report ready', reportFailed: 'Report interrupted', reportEmpty: 'No report yet',
        reportHint: 'The report stays on this page. Export HTML to read, print or share offline.',
        reportHintFoot: 'Then read full screen or export HTML', reportName: 'Life Kunpeng Report',
        reportPart1: 'Chart overview', reportPart2: 'Personality', reportPart3: 'Family', reportPart4: 'Marriage',
        reportPart5: 'Children', reportPart6: 'Wealth', reportPart7: 'Health', reportPart8: 'Friends',
        reportPart9: 'Career', reportPart10: 'Home', reportPart11: 'Spirit', reportPart12: 'Travel',
        reportPart13: 'Decades', reportPart14: 'Advice',
        readerBack: 'Back to reading', readerFull: 'Fullscreen', readerExitFull: 'Exit fullscreen',
        relJustNow: 'just now', relMin: '{n} min ago', relHour: '{n} h ago', relYesterday: 'yesterday', relDays: '{n} d ago',
        aiSend: 'Send', aiNewChat: 'New chat', aiAskPh: 'Follow-up — Enter to send',
        aiStartBrief: 'Quick reading', aiStartReport: 'Full Kunpeng report',
        aiFullReport: 'Full report', aiFullReportHint: 'Generate the full 14-part Kunpeng report for this chart',
        aiEmptyHint: 'Chart attached. Ask away, or start with a reading.',
        timeScope: 'Time scope', backToBoard: 'Back to chart',
        prevDecade: 'Previous decade', nextDecade: 'Next decade', backToCurrent: 'Back to current',
        currentBadge: 'Current', thisYear: 'This year', prevYear: 'Previous year', nextYear: 'Next year',
        collapseRail: 'Collapse birth panel', expandRail: 'Expand birth panel', editBirthShort: 'Birth data',
        chartTools: 'Tools', openPatterns: 'Patterns', openDict: 'Star dictionary',
        handoff: 'New session', handoffDone: 'Session opened ✓',
        handoffHint: 'Hand this chart to the session so the agent can continue the reading.',
        disclaimerShort: 'Traditional interpretation, not a scientific conclusion. Consult a professional for decisions.',
        aiInterpreting: 'Reading…', interpStreaming: 'Generating…',
        aiThinking: 'Thinking…', aiStop: 'Stop', aiContinue: 'Continue',
        aiStopped: 'Stopped; the answer may be incomplete — press Continue to resume.',
        aiDisconnected: 'Connection lost; the answer may be incomplete — press Continue to resume.',
        aiContinuePrompt: 'Continue from where you stopped; do not repeat or restart the answer.',
        aiCopy: 'Copy', aiCopied: 'Copied',
        sync: 'Write to session', synced: 'Written ✓',
        syncHint: 'Write this chart into the session context (no new session); then ask the agent to read it.', exportHtml: 'Export HTML', previewHtml: 'Preview', closePreview: 'Close Preview',
        aiRetry: 'Retry',
        autoOpen: 'Open workbench on launch', showAdjSet: 'Show adjective stars in cells by default',
        settingsTitle: 'Settings', close: 'Close', about: 'About',
        versionLabel: 'Version', checkUpdate: 'Check for updates', checking: 'Checking…',
        updateHint: 'Manual check only — no background polling; updates are installed by you.',
        upToDate: 'Up to date ({version})', updateAvailable: 'Version {latest} available. Update with:',
        updateFailed: 'Check failed: {reason}',
        backToConversation: 'Back to conversation',
        aboutText: 'Zi Wei Dou Shu Pro. Algorithm verified field-by-field against the open-source iztro library. True solar time correction included.',
        libTitle: 'Chart Library', libName: 'Name', libSave: 'Save', libEmpty: 'No saved charts', libDelete: 'Delete',
        patternTitle: 'Patterns', patternEmpty: 'No notable patterns detected',
        dictTitle: 'Star Dictionary', dictPlaceholder: 'Search stars…',
        keyboardHint: 'Click chart: ←→ palace · ↑↓ opposite',
        copy: 'Copy Chart', copied: 'Copied',
        note1: 'Algorithm per the classic ZWDS star-placement rules (14 major + 14 minor + 38 adjective stars), cross-verified with iztro.',
        note2: 'School options: year pillar by LNY or Lichun; month pillar by lunar month or solar terms.'
      }
    };

    /* ---------------- 星曜色板与角标 ---------------- */
    const MAJOR_COLOR = {
      紫微: '#9d6fd1', 天机: '#4d9fce', 太阳: '#e08a4a', 武曲: '#c19a3c',
      天同: '#d16a8e', 廉贞: '#c45948', 天府: '#a97a50', 太阴: '#7d8dd0',
      贪狼: '#4fae7d', 巨门: '#8da0aa', 天相: '#43b19d', 天梁: '#9a8a76',
      七杀: '#b04555', 破军: '#5d78b8'
    };
    const MINOR_GOOD = ['文昌', '文曲', '左辅', '右弼', '天魁', '天钺', '禄存', '天马', '天喜', '天官', '天福', '台辅', '封诰'];
    const MINOR_BAD = ['火星', '铃星', '擎羊', '陀罗', '地空', '地劫', '天刑', '阴煞', '天空', '天哭', '天虚', '劫煞', '灾煞', '孤辰', '寡宿'];
    const starColor = (name) => MAJOR_COLOR[name] || null;
    const starClass = (name) => {
      if (MAJOR_COLOR[name]) return 'major';
      if (MINOR_GOOD.indexOf(name) >= 0) return 'good';
      if (MINOR_BAD.indexOf(name) >= 0) return 'bad';
      return 'adj';
    };
    const MU_CHARS = ['禄', '权', '科', '忌'];
    const MU_CLASS = { '禄': 'lu', '权': 'quan', '科': 'ke', '忌': 'ji' };
    const BRIGHT_CLASS = { '庙': 'miao', '旺': 'wang', '得': 'de', '利': 'li', '平': 'ping', '不': 'bu', '陷': 'xian' };

    /* ---------------- 样式 (设计系统) ---------------- */
    /* 设计系统样式在 src/ui.css；由 build.mjs 注入，避免 900 行 CSS 埋在 JS 里。 */
    const CSS = '__ZIWEI_CSS__';

    /* ---------------- 基础组件 ---------------- */
    function Seg(props) {
      return h('div', { className: 'zp-seg', role: 'group' },
        props.options.map(function (o) {
          var on = props.value === o.value;
          return h('button', {
            key: String(o.value), type: 'button',
            className: on ? 'on' : undefined,
            'aria-pressed': on ? 'true' : 'false',
            onClick: function () { props.onChange(o.value); }
          }, o.label);
        }));
    }

    /* 浮层键盘纪律：初始聚焦到浮层内、Tab/Shift+Tab 在浮层内循环、关闭后焦点归还。
       与官方 Modal 的行为对齐（参考 dsh-client-ui-primitives 的 useModalLayer 文档）。 */
    function focusablesIn(root) {
      if (!root) return [];
      var nodes = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      var out = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!n.disabled && n.offsetParent !== null) out.push(n);
      }
      return out;
    }
    function trapTab(ev, root) {
      if (ev.key !== 'Tab' || !root) return;
      var list = focusablesIn(root);
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
    function useDialogFocus() {
      var boxRef = useRef(null);
      useEffect(function () {
        var prev = document.activeElement;
        /* 聚焦弹层容器本身（tabIndex=-1），而不是第一个按钮：
           否则一打开抽屉，关闭/新对话按钮就被画上 focus ring，看起来像选错目标。
           Tab 仍会从容器进入第一个可聚焦控件。 */
        var box = boxRef.current;
        try { if (box && typeof box.focus === 'function') box.focus(); } catch (e) { /* ignore */ }
        return function () {
          try { if (prev && typeof prev.focus === 'function') prev.focus(); } catch (e) { /* ignore */ }
        };
      }, []);
      return boxRef;
    }

    function Taiji(props) {
      return h('svg', { className: 'zp-taiji', viewBox: '0 0 48 48', 'aria-hidden': true },
        h('circle', { cx: 24, cy: 24, r: 22, fill: 'none', stroke: 'var(--zp-gold-dim)', strokeWidth: 1.2, opacity: 0.7 }),
        h('path', { d: 'M24 2 A22 22 0 0 1 24 46 A11 11 0 0 1 24 24 A11 11 0 0 0 24 2', fill: 'var(--zp-accent)' }),
        h('path', { d: 'M24 46 A22 22 0 0 1 24 2 A11 11 0 0 1 24 24 A11 11 0 0 0 24 46', fill: 'var(--zp-gold)' }),
        h('circle', { cx: 24, cy: 13, r: 3.2, fill: 'var(--zp-gold)' }),
        h('circle', { cx: 24, cy: 35, r: 3.2, fill: 'var(--zp-accent)' }));
    }

    function StarEl(s, extra) {
      var color = starColor(s.name);
      var cls = 'zp-star ' + starClass(s.name) + (extra && extra.minorLine ? ' minor-line' : '');
      /* 星曜主色走 CSS 变量：深色主题可在 CSS 里统一提亮，不必逐处内联判断 */
      return h('span', { key: s.name, className: cls, style: color ? { '--zp-star-color': color } : undefined },
        s.name,
        s.brightness ? h('span', { className: 'zp-bright' }, s.brightness) : null,
        s.mutagen ? h('span', { className: 'zp-mu-badge ' + MU_CLASS[s.mutagen] }, s.mutagen) : null,
        extra && extra.badge ? h('span', { className: 'zp-mu-badge ' + MU_CLASS[extra.badge] }, extra.text) : null);
    }

    /* ---------------- 排盘输入（新建命盘页） ---------------- */
    function BirthForm(props) {
      var f = props.form;
      var t = props.t;
      var set = props.setForm;
      var lunarMode = f.calendar === 'lunar';
      var leapAvailable = lunarMode && E.leapMonth(+f.year) === +f.month;
      var setSetting = function (k, v) {
        var next = Object.assign({}, f.settings);
        next[k] = v;
        set({ settings: next });
      };
      var seg = function (value, options, onChange) {
        return h(Seg, { value: value, options: options, onChange: onChange });
      };
      return h('div', { className: 'zp-card zp-create-form' },
        h('div', { className: 'zp-card-title' }, t('formTitle')),
        h('div', { className: 'zp-form-grid' },
          h('div', { className: 'zp-field is-wide' },
            h('label', { className: 'zp-field-label' }, t('name')),
            h('input', {
              className: 'zp-input', type: 'text', value: f.name || '', maxLength: 20,
              placeholder: t('namePh'), 'aria-label': t('name'),
              onChange: function (ev) { set({ name: ev.target.value }); }
            })),
          h('div', { className: 'zp-field' },
            h('label', { className: 'zp-field-label' }, t('calendar')),
            seg(f.calendar, [{ value: 'solar', label: t('solar') }, { value: 'lunar', label: t('lunar') }],
              function (v) { set({ calendar: v, isLeap: false }); })),
          h('div', { className: 'zp-field is-wide' },
            h('label', { className: 'zp-field-label' }, t('year') + ' / ' + t('month') + ' / ' + t('day')),
            h('div', { className: 'zp-row' },
              h('input', {
                className: 'zp-input', type: 'number', value: f.year, min: 1900, max: 2100, style: { flex: '1 1 0', minWidth: 0 },
                'aria-label': t('year'), onChange: function (ev) { set({ year: ev.target.value }); }
              }),
              h('input', {
                className: 'zp-input', type: 'number', value: f.month, min: 1, max: 12, style: { flex: '1 1 0', minWidth: 0 },
                'aria-label': t('month'), onChange: function (ev) { set({ month: ev.target.value }); }
              }),
              h('input', {
                className: 'zp-input', type: 'number', value: f.day, min: 1, max: 30, style: { flex: '1 1 0', minWidth: 0 },
                'aria-label': t('day'), onChange: function (ev) { set({ day: ev.target.value }); }
              }),
              lunarMode ? h('label', { className: 'zp-check', style: { flex: 'none' } },
                h('input', {
                  type: 'checkbox', checked: !!f.isLeap, disabled: !leapAvailable,
                  onChange: function (ev) { set({ isLeap: ev.target.checked }); }
                }), t('leap')) : null)),
          h('div', { className: 'zp-field is-wide' },
            h('label', { className: 'zp-field-label' }, t('time') + ' · ' + t('gender')),
            h('div', { className: 'zp-row' },
              h('input', {
                className: 'zp-input', type: 'number', value: f.hour, min: 0, max: 23, style: { width: 70, flex: 'none' },
                'aria-label': t('hour'), onChange: function (ev) { set({ hour: ev.target.value }); }
              }),
              h('span', { style: { color: 'var(--ink-3)', fontSize: 12, flex: 'none' } }, t('hour')),
              h('input', {
                className: 'zp-input', type: 'number', value: f.minute, min: 0, max: 59, style: { width: 70, flex: 'none' },
                'aria-label': t('minute'), onChange: function (ev) { set({ minute: ev.target.value }); }
              }),
              h('div', { style: { flex: '1 1 0', minWidth: 120, marginLeft: 4 } },
                seg(f.gender, [{ value: 'male', label: t('male') }, { value: 'female', label: t('female') }],
                  function (v) { set({ gender: v }); })))),
          h('div', { className: 'zp-field' },
            h('label', { className: 'zp-field-label' }, t('lonLabel')),
            h('input', {
              className: 'zp-input', type: 'number', value: f.longitude, min: 60, max: 140, step: 'any',
              placeholder: t('lonPh'), 'aria-label': t('lonLabel'),
              onChange: function (ev) { set({ longitude: ev.target.value }); }
            })),
          h('div', { className: 'zp-field' },
            h('label', { className: 'zp-field-label' }, t('placeLabel')),
            h('input', {
              className: 'zp-input', type: 'text', value: f.place || '', maxLength: 30,
              placeholder: t('placePh'), 'aria-label': t('placeLabel'),
              onChange: function (ev) { set({ place: ev.target.value }); }
            })),
          h('div', { className: 'zp-field is-wide' },
            h('label', { className: 'zp-field-label' }, t('occupationLabel')),
            h('input', {
              className: 'zp-input', type: 'text', value: f.occupation || '', maxLength: 60,
              placeholder: t('occupationPh'), 'aria-label': t('occupationLabel'),
              onChange: function (ev) { set({ occupation: ev.target.value }); }
            })),
          h('details', { className: 'zp-field is-wide' },
            h('summary', { style: { fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer' } }, t('settings')),
            h('div', { style: { paddingTop: 12 } },
              h('div', { className: 'zp-field' },
                h('label', { className: 'zp-field-label' }, t('yearDivide')),
                seg(f.settings.yearDivide, [{ value: 'normal', label: t('ydNormal') }, { value: 'exact', label: t('ydExact') }],
                  function (v) { setSetting('yearDivide', v); })),
              h('div', { className: 'zp-field' },
                h('label', { className: 'zp-field-label' }, t('monthDivide')),
                seg(f.settings.monthDivide, [{ value: 'normal', label: t('mdNormal') }, { value: 'exact', label: t('mdExact') }],
                  function (v) { setSetting('monthDivide', v); }),
                h('div', { className: 'zp-settings-hint' }, t('monthDivideHint'))),
              h('div', { className: 'zp-field' },
                h('label', { className: 'zp-field-label' }, t('dayDivide')),
                seg(f.settings.dayDivide, [{ value: 'forward', label: t('ddForward') }, { value: 'current', label: t('ddCurrent') }],
                  function (v) { setSetting('dayDivide', v); })),
              h('div', { className: 'zp-field' },
                h('label', { className: 'zp-field-label' }, t('fixLeap')),
                seg(f.settings.fixLeap, [{ value: true, label: t('flTrue') }, { value: false, label: t('flFalse') }],
                  function (v) { setSetting('fixLeap', v); }))))),
        props.error ? h('div', { className: 'zp-error', style: { marginBottom: 10 } }, props.error) : null,
        h('div', { className: 'zp-create-submit' },
          h('button', { className: 'zp-pill is-primary', type: 'button', onClick: props.onSubmit },
            h(Icon, { name: 'chart', size: 14 }), props.submitLabel || t('createSubmit')),
          h('span', { className: 'zp-grow' }),
          h('button', { className: 'zp-pill is-quiet', type: 'button', onClick: props.onSample }, t('createSample'))));
    }

    /* ---------------- 命主信息 ---------------- */
    function Summary(props) {
      var c = props.chart;
      var t = props.t;
      var sc = c.meta && c.meta.solarCorrection;
      var kv = function (label, value, wide) {
        return h('div', { className: 'zp-kv' + (wide ? ' zp-kv-wide' : '') },
          h('span', null, label), h('b', null, value));
      };
      return h('div', { className: 'zp-card zp-summary-card', 'data-region': 'SIDE_PROFILE' },
        h('div', { className: 'zp-card-title' }, t('summaryTitle')),
        h('div', { className: 'zp-pillars' },
          [c.pillars.yearly, c.pillars.monthly, c.pillars.daily, c.pillars.hourly].map(function (pz, i) {
            return h('div', { key: i, className: 'zp-pillar' }, pz);
          })),
        h('div', { className: 'zp-kv-grid' },
          kv(t('solarLabel'), c.solarDate + ' ' + c.timeName, true),
          kv(t('lunarLabel'), c.lunar.year + '年' + c.lunarText, true),
          kv(t('solarTime'), sc ? sc.solarTime + '（' + sc.longitude + '°E）' : t('uncorrected')),
          kv(t('soul'), c.soulBranch + ' · ' + c.soulMaster),
          kv(t('body'), c.bodyBranch + ' · ' + c.bodyMaster),
          kv(t('class5'), c.fiveElementsClass),
          kv(t('startAge'), c.startAge + ' 岁'),
          kv(t('zodiac') + ' / ' + t('sign'), c.zodiac + ' · ' + c.sign)),
        sc && sc.boundaryWarning ? h('div', { className: 'zp-warn' }, t('boundaryWarn')) : null,
        h('div', { className: 'zp-detail-section-label', style: { marginTop: 12, marginBottom: 6 } }, t('mutagenTitle')),
        h('div', { className: 'zp-mutagen-strip' },
          c.mutagens.map(function (m, i) {
            return h('span', { key: i, className: 'zp-mu zp-mu-' + MU_CLASS[m.mutagen] },
              m.star + '化' + m.mutagen + ' · ' + m.palaceName);
          })));
    }

    /* ---------------- 命盘宫格 ---------------- */
    /* 索引 → 网格位置 (紫微盘方位: 命宫左上, 顺时针) */
    const CELL_POS = {
      3: { col: 1, row: 1 }, 4: { col: 2, row: 1 }, 5: { col: 3, row: 1 }, 6: { col: 4, row: 1 },
      2: { col: 1, row: 2 }, 7: { col: 4, row: 2 },
      1: { col: 1, row: 3 }, 8: { col: 4, row: 3 },
      0: { col: 1, row: 4 }, 11: { col: 2, row: 4 }, 10: { col: 3, row: 4 }, 9: { col: 4, row: 4 }
    };
    /* 键盘方向 → 目标索引: [左,右,上,下] 各为分支环上移动 */
    function ringStep(idx, dir) {
      if (dir === 'left') return (idx + 11) % 12;
      if (dir === 'right') return (idx + 1) % 12;
      if (dir === 'opp') return (idx + 6) % 12;
      return idx;
    }

    function PalaceCell(props) {
      var p = props.palace;
      var t = props.t;
      var scopeBadges = props.scopeBadges || {};
      var scopeName = props.scope ? props.scope.palaceNames[p.index] : null;
      var scopeStars = props.scope ? props.scope.stars[p.index] : null;
      var gods = [p.changsheng12, p.boshi12].filter(Boolean).join(' · ');
      var pos = CELL_POS[p.index] || { col: 1, row: 1 };
      var empty = !p.major.length;
      return h('div', {
        className: 'zp-cell' + (props.selected ? ' on' : '') + (empty ? ' empty' : ''),
        style: { gridColumn: pos.col, gridRow: pos.row },
        onClick: props.onSelect,
        tabIndex: props.selected ? 0 : -1,
        role: 'button', 'aria-pressed': !!props.selected,
        title: p.name + ' · ' + p.stem + p.branch
      },
        h('div', { className: 'zp-cell-top' },
          h('span', { className: 'zp-cell-name' },
            p.name,
            p.isSoul ? h('span', { className: 'zp-mark zp-mark-soul' }, t('mingMark')) : null,
            p.isBody ? h('span', { className: 'zp-mark zp-mark-body' }, t('bodyMark')) : null),
          h('span', { className: 'zp-cell-gz' }, p.stem + p.branch)),
        h('div', { className: 'zp-stars-line zp-stars-major' },
          p.major.length
            ? p.major.map(function (s) { return StarEl(s, scopeBadges[s.name]); })
            : h('span', { className: 'zp-star-none' }, t('emptyPalace'))),
        p.minor.length ? h('div', { className: 'zp-stars-line zp-stars-minor' },
          p.minor.map(function (s) {
            return StarEl(s, { minorLine: true, badge: scopeBadges[s.name] && scopeBadges[s.name].badge, text: scopeBadges[s.name] && scopeBadges[s.name].text });
          })) : null,
        props.showAdj && p.adjective.length ? h('div', { className: 'zp-adj-line' }, p.adjective.join(' ')) : null,
        scopeName ? h('div', { className: 'zp-cell-scope' }, scopeName) : null,
        scopeStars && scopeStars.length ? h('div', { className: 'zp-stars-line zp-stars-scope' },
          scopeStars.map(function (s) { return StarEl(s, { minorLine: true }); })) : null,
        h('div', { className: 'zp-cell-foot' },
          h('span', { className: 'zp-cell-dec' }, t('decadal') + ' ' + p.decadal.range[0] + '~' + p.decadal.range[1]),
          h('span', { className: 'zp-cell-gods' }, gods)));
    }

    /* 中宫：盘名 + 关键盘面参数，窄盘下按容器宽度等比缩小（字号见 CSS cqw） */
    function CenterCell(props) {
      var c = props.chart;
      var t = props.t;
      return h('div', { className: 'zp-center' },
        h('div', { className: 'zp-taiji-wrap' }, h(Taiji, null)),
        h('div', { className: 'zp-center-name' }, props.name || t('defaultName')),
        h('div', { className: 'zp-center-chips' },
          h('span', { className: 'zp-center-chip' }, t('soul') + ' ' + c.soulBranch),
          h('span', { className: 'zp-center-chip' }, t('body') + ' ' + c.bodyBranch),
          h('span', { className: 'zp-center-chip' }, c.fiveElementsClass),
          h('span', { className: 'zp-center-chip' }, c.zodiac)),
        h('div', { className: 'zp-center-sub' },
          t('soulMaster') + ' ' + c.soulMaster + ' · ' + t('bodyMaster') + ' ' + c.bodyMaster),
        h('div', { className: 'zp-center-dec' }, t('startAge') + ' ' + c.startAge + ' 岁起运'));
    }

    /* ---------------- 宫位详情 ---------------- */
    function PalaceDetail(props) {
      var p = props.palace;
      var t = props.t;
      var opp = (p.index + 6) % 12;
      var tri1 = (p.index + 4) % 12;
      var tri2 = (p.index + 8) % 12;
      var gods = [p.changsheng12, p.boshi12].filter(Boolean);
      var section = function (label, body) {
        return h('div', { className: 'zp-detail-section' },
          h('div', { className: 'zp-detail-section-label' }, label),
          body);
      };
      return h('div', { className: 'zp-detail', 'data-region': 'INSPECTOR' },
        h('div', { className: 'zp-detail-head' },
          h('span', { className: 'zp-detail-name' }, p.name),
          p.isSoul ? h('span', { className: 'zp-mark zp-mark-soul' }, t('mingMark')) : null,
          p.isBody ? h('span', { className: 'zp-mark zp-mark-body' }, t('bodyMark')) : null,
          h('span', { className: 'zp-detail-gz' }, p.stem + p.branch),
          h('div', { className: 'zp-detail-nav' },
            h('button', { className: 'zp-btn', type: 'button', onClick: function () { props.onSelect(opp); } },
              t('oppPalace') + ' · ' + props.chart.palaces[opp].name),
            h('button', { className: 'zp-btn', type: 'button', onClick: function () { props.onSelect(tri1); } },
              t('triPalace') + ' · ' + props.chart.palaces[tri1].name),
            h('button', { className: 'zp-btn', type: 'button', onClick: function () { props.onSelect(tri2); } },
              t('triPalace') + ' · ' + props.chart.palaces[tri2].name))),
        h('div', { className: 'zp-detail-body' },
          section(t('mainStars'),
            h('div', { className: 'zp-detail-stars' }, p.major.length
              ? p.major.map(function (s) { return StarEl(s); })
              : h('span', { className: 'zp-star adj' }, t('emptyPalace')))),
          section(t('minorStars'),
            h('div', { className: 'zp-detail-stars' }, p.minor.length
              ? p.minor.map(function (s) { return StarEl(s, { minorLine: true }); })
              : h('span', { className: 'zp-star adj' }, '—'))),
          p.adjective.length ? section(t('adjStars'),
            h('div', { className: 'zp-detail-stars' },
              p.adjective.map(function (n) { return h('span', { key: n, className: 'zp-star adj' }, n); }))) : null,
          section(t('decadal') + ' · ' + t('smallLimit') + ' · ' + t('twelveGods'),
            h('div', { className: 'zp-detail-chips' },
              h('span', { className: 'zp-chip' }, t('decadal') + ' ', h('b', null, p.decadal.stem + p.decadal.branch + ' ' + p.decadal.range[0] + '~' + p.decadal.range[1] + '岁')),
              h('span', { className: 'zp-chip' }, t('smallLimit') + ' ', h('b', null, p.ages.join(', '))),
              gods.length ? h('span', { className: 'zp-chip' }, t('twelveGods') + ' ', h('b', null, gods.join(' · '))) : null))),
        h('div', { className: 'zp-kbd-hint' }, t('keyboardHint')));
    }

    /* ---------------- 格局分析 / 星曜词典 ---------------- */
    /* 左栏摘要：只读，最多 4 条；完整描述与多列布局仍在 PatternsView（顶部入口） */
    function PatternsSummary(props) {
      var t = props.t;
      var items = (props.patterns || []).slice(0, 4);
      return h('div', { className: 'zp-card zp-patterns-card', 'data-region': 'SIDE_PATTERNS' },
        h('div', { className: 'zp-patterns-card-head' },
          h('div', { className: 'zp-card-title', style: { marginBottom: 0 } }, t('patternTitle')),
          h('span', { className: 'zp-patterns-count' }, items.length + (props.patterns.length > 4 ? '+' : '')),
          h('button', {
            className: 'zp-mini-btn zp-patterns-all', type: 'button',
            onClick: props.onOpen
          }, t('openPatterns') + ' ›')),
        items.length
          ? items.map(function (p, i) {
            return h('div', { key: i, className: 'zp-pattern-mini' },
              h('div', { className: 'zp-pattern-mini-head' },
                h('span', null, p.name),
                p.level ? h('span', { className: 'zp-pattern-mini-level' }, p.level) : null),
              h('div', { className: 'zp-pattern-mini-desc' }, p.desc));
          })
          : h('div', { className: 'zp-pattern-mini-desc' }, t('patternEmpty')));
    }

    function PatternsView(props) {
      var t = props.t;
      if (!props.patterns.length) {
        return h('div', { className: 'zp-card', style: { textAlign: 'center', padding: 40, color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, t('patternEmpty'));
      }
      return h('div', { className: 'zp-patterns', 'data-region': 'TOOLPAGE' },
        props.patterns.map(function (p, i) {
          return h('div', { key: i, className: 'zp-pattern-card' },
            h('div', { className: 'zp-pattern-name' }, p.name + (p.level ? ' · ' + p.level : '')),
            h('div', { className: 'zp-pattern-desc' }, p.desc),
            p.detail ? h('div', { className: 'zp-pattern-desc', style: { marginTop: 4, color: 'var(--dsw-alias-label-secondary)' } }, p.detail) : null);
        }));
    }

    function DictView(props) {
      var t = props.t;
      var [q, setQ] = useState('');
      var keys = Object.keys(E.starDict);
      var filtered = q.trim()
        ? keys.filter(function (k) { return k.indexOf(q.trim()) >= 0; })
        : keys;
      return h('div', { 'data-region': 'TOOLPAGE' },
        h('div', { className: 'zp-toolbar' },
          h('input', {
            className: 'zp-input', type: 'text', value: q, style: { maxWidth: 260 },
            placeholder: t('dictPlaceholder'), 'aria-label': t('dictTitle'),
            onChange: function (ev) { setQ(ev.target.value); }
          })),
        h('div', { className: 'zp-dict-grid' },
          filtered.map(function (k) {
            var d = E.starDict[k];
            return h('div', { key: k, className: 'zp-dict-item' },
              h('div', { className: 'zp-dict-name', style: starColor(k) ? { color: starColor(k) } : undefined }, k),
              h('div', { className: 'zp-dict-desc' }, (d.wu || '') + (d.yy || '') + (d.qi ? ' · ' + d.qi : '')),
              h('div', { className: 'zp-dict-desc', style: { marginTop: 4 } }, d.brief),
              d.good ? h('div', { className: 'zp-dict-desc', style: { marginTop: 4, opacity: .85 } }, '庙旺: ' + d.good) : null);
          })));
    }

    /* ---------------- 内联图标（1.5px 线性，随文字色；避免 emoji 跨平台不一致） ---------------- */
    const ICON_PATHS = {
      panelLeft: [
        ['rect', { x: 2.2, y: 2.8, width: 11.6, height: 10.4, rx: 2 }],
        ['path', { d: 'M6.6 2.8v10.4' }]
      ],
      back: [
        ['path', { d: 'M13.4 8H3.2' }],
        ['path', { d: 'M7 4.2L3.2 8l3.8 3.8' }]
      ],
      copy: [
        ['rect', { x: 5.6, y: 5.6, width: 7.6, height: 7.6, rx: 1.6 }],
        ['path', { d: 'M10.6 5.6V4.3c0-.9-.7-1.6-1.6-1.6H4.3c-.9 0-1.6.7-1.6 1.6v4.7c0 .9.7 1.6 1.6 1.6h1.3' }]
      ],
      sync: [
        ['path', { d: 'M13.2 6.4a5.2 5.2 0 0 0-9.1-1.7' }],
        ['path', { d: 'M2.8 9.6a5.2 5.2 0 0 0 9.1 1.7' }],
        ['path', { d: 'M13.2 2.9v3.5h-3.5' }],
        ['path', { d: 'M2.8 13.1v-3.5h3.5' }]
      ],
      settings: [
        ['circle', { cx: 8, cy: 8, r: 2.1 }],
        ['path', { d: 'M8 1.9v2.1M8 12v2.1M1.9 8h2.1M12 8h2.1M3.7 3.7L5.2 5.2M10.8 10.8l1.5 1.5M12.3 3.7L10.8 5.2M5.2 10.8l-1.5 1.5' }]
      ],
      close: [
        ['path', { d: 'M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6' }]
      ],
      send: [
        ['path', { d: 'M2.6 8.1L13.2 3l-5.1 10.5L7 9.3z' }]
      ],
      stop: [
        ['rect', { x: 4.8, y: 4.8, width: 6.4, height: 6.4, rx: 1.6, fill: 'currentColor', stroke: 'none' }]
      ],
      sparkle: [
        ['path', { d: 'M8 1.9l1.5 4.2 4.2 1.5-4.2 1.5L8 13.3 6.5 9.1 2.3 7.6l4.2-1.5z' }]
      ],
      preview: [
        ['path', { d: 'M1.9 8s2.3-3.9 6.1-3.9S14.1 8 14.1 8s-2.3 3.9-6.1 3.9S1.9 8 1.9 8z' }],
        ['circle', { cx: 8, cy: 8, r: 1.8 }]
      ],
      export: [
        ['path', { d: 'M8 2.1v7M5.3 6.4L8 9.1l2.7-2.7' }],
        ['path', { d: 'M3.1 10.4v1.7c0 .9.7 1.6 1.6 1.6h6.6c.9 0 1.6-.7 1.6-1.6v-1.7' }]
      ],
      report: [
        ['rect', { x: 3.2, y: 2.2, width: 9.6, height: 11.6, rx: 1.6 }],
        ['path', { d: 'M5.6 5.4h4.8M5.6 8h4.8M5.6 10.6h3' }]
      ],
      check: [
        ['path', { d: 'M3.4 8.3l3.1 3.1 6.1-6.7' }]
      ],
      home: [
        ['path', { d: 'M2.4 7.2L8 2.6l5.6 4.6' }],
        ['path', { d: 'M4 6.6v6.6h8V6.6' }]
      ],
      chart: [
        ['rect', { x: 2.2, y: 2.2, width: 4.6, height: 4.6, rx: 1 }],
        ['rect', { x: 9.2, y: 2.2, width: 4.6, height: 4.6, rx: 1 }],
        ['rect', { x: 2.2, y: 9.2, width: 4.6, height: 4.6, rx: 1 }],
        ['rect', { x: 9.2, y: 9.2, width: 4.6, height: 4.6, rx: 1 }]
      ],
      clock: [
        ['circle', { cx: 8, cy: 8, r: 6 }],
        ['path', { d: 'M8 4.6V8l2.6 1.6' }]
      ],
      star: [
        ['path', { d: 'M8 2.2l1.7 3.6 3.9.5-2.9 2.7.8 3.9L8 11.1l-3.5 1.8.8-3.9L2.4 6.3l3.9-.5z' }]
      ],
      newChat: [
        ['path', { d: 'M8 2.9v10.2M2.9 8h10.2' }]
      ],
      handoff: [
        ['path', { d: 'M2.6 8h7.1M7 5l3.1 3L7 11' }],
        ['path', { d: 'M12.4 3.2v9.6' }]
      ],
      expand: [
        ['path', { d: 'M2.7 6.1V2.7h3.4M9.9 2.7h3.4v3.4M13.3 9.9v3.4H9.9M6.1 13.3H2.7V9.9' }]
      ],
      adj: [
        ['path', { d: 'M8 2.4v11.2M3.1 5.2l9.8 5.6M12.9 5.2L3.1 10.8' }]
      ]
    };

    function Icon(props) {
      var paths = ICON_PATHS[props.name] || [];
      return h('svg', {
        viewBox: '0 0 16 16', width: props.size || 15, height: props.size || 15,
        'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
        strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block', flex: 'none' }
      }, paths.map(function (p, i) {
        return h(p[0], Object.assign({ key: i }, p[1]));
      }));
    }

    /* ---------------- 紫微师对话：面板内右侧阅读抽屉 ---------------- */
    /* 抽屉回答的 markdown：表格/转义用 ZWReport 的共享解析器（v3.2），其它保持 zp-md 排版 */
    function renderChatMd(s) {
      try {
        if (window.ZWReport && typeof window.ZWReport.mdToChatHtml === 'function') {
          return window.ZWReport.mdToChatHtml(s);
        }
      } catch (e) { /* 回退纯文本 */ }
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }

    /* ================================================================
     * v4 通用小工具
     * ================================================================ */
    function relTime(t, ts) {
      if (!ts) return '';
      var d = Date.now() - ts;
      if (d < 60 * 1000) return t('relJustNow');
      if (d < 60 * 60 * 1000) return t('relMin').replace('{n}', String(Math.max(1, Math.floor(d / 60000))));
      if (d < 24 * 60 * 60 * 1000) return t('relHour').replace('{n}', String(Math.floor(d / 3600000)));
      if (d < 48 * 60 * 60 * 1000) return t('relYesterday');
      if (d < 30 * 24 * 60 * 60 * 1000) return t('relDays').replace('{n}', String(Math.floor(d / 86400000)));
      return fmtDate(ts);
    }
    function fmtDate(ts) {
      var d = new Date(ts);
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    function fmtDateTime(ts) {
      var d = new Date(ts);
      return fmtDate(ts) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    function inputKey(input) {
      if (!input) return '';
      return [input.calendar, input.year, input.month, input.day, input.isLeap ? 1 : 0,
        input.hour, input.minute, input.gender, input.longitude == null ? '' : input.longitude].join('|');
    }
    function cleanInput(form) {
      return {
        name: form.name || '', calendar: form.calendar, year: form.year, month: form.month, day: form.day,
        isLeap: !!form.isLeap, hour: form.hour, minute: form.minute, gender: form.gender,
        longitude: form.longitude, place: form.place || '', occupation: form.occupation || '',
        settings: Object.assign({}, form.settings)
      };
    }
    function reportProgress(text) {
      var s = String(text || '');
      var sections = (s.match(/^#{2,4}\s+/gm) || []).length;
      var last = '';
      var re = /^#{2,4}\s+(.+)$/gm;
      var m;
      while ((m = re.exec(s))) last = m[1];
      return { sections: Math.min(sections, 14), chars: s.length, last: last };
    }
    function reportExcerpt(text) {
      var s = String(text || '');
      if (s.length <= 1400) return s;
      var cut = s.slice(0, 1400);
      var lastBreak = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('\n'));
      return lastBreak > 600 ? cut.slice(0, lastBreak) : cut;
    }

    /* ================================================================
     * 首页命盘卡片
     * ================================================================ */
    function ChartCard(props) {
      var t = props.t;
      var item = props.item;
      var c = item.chart;
      var gz = c ? [c.pillars.yearly, c.pillars.monthly, c.pillars.daily, c.pillars.hourly].join(' ') : '';
      return h('div', { className: 'zp-chart-card' },
        h('button', {
          className: 'zp-chart-card-open', type: 'button', onClick: function () { props.onOpen(item); },
          'aria-label': (item.name || t('defaultName')) + '，' + gz
        },
          h('div', { className: 'zp-chart-card-top' },
            h('span', { className: 'zp-chart-badge' },
              c ? c.soulBranch : '盘',
              h('small', null, c ? c.fiveElementsClass : '')),
            h('div', { className: 'zp-chart-card-main' },
              h('div', { className: 'zp-chart-card-name' }, item.name || t('defaultName')),
              h('div', { className: 'zp-chart-card-gz' }, gz))),
          h('div', { className: 'zp-chart-card-foot' },
            h('span', null, item.lastViewedAt ? relTime(t, item.lastViewedAt) : t('chartSaved')),
            h('span', { className: 'zp-grow' }),
            item.saved
              ? h('span', { className: 'zp-chart-card-tag is-saved' }, t('homeSavedTag'))
              : h('span', { className: 'zp-chart-card-tag' }, t('homeRecentTag')))),
        h('div', { className: 'zp-chart-card-actions' },
          h('button', {
            className: 'zp-chart-card-save' + (item.saved ? ' is-saved' : ''), type: 'button',
            title: item.saved ? t('chartUnsave') : t('chartSave'),
            'aria-label': item.saved ? t('chartUnsave') : t('chartSave'),
            onClick: function (ev) { ev.stopPropagation(); props.onToggleSave(item); }
          }, h(Icon, { name: 'star', size: 13 })),
          item.saved ? null : h('button', {
            className: 'zp-chart-card-del', type: 'button',
            title: t('homeRemove'), 'aria-label': t('homeRemove'),
            onClick: function (ev) { ev.stopPropagation(); props.onRemove(item); }
          }, h(Icon, { name: 'close', size: 12 }))));
    }

    /* ================================================================
     * 解读页 · 聊天栏
     * ================================================================ */
    function ChatPane(props) {
      var t = props.t;
      var [q, setQ] = useState('');
      var bodyRef = useRef(null);
      var thread = props.thread || [];
      var streaming = props.streaming;
      var lastAssistant = -1;
      for (var i = thread.length - 1; i >= 0; i--) {
        if (thread[i].role === 'assistant' && thread[i].content) { lastAssistant = i; break; }
      }
      useEffect(function () {
        var el = bodyRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      }, [props.thread, props.streaming]);

      var submit = function () {
        var text = q.trim();
        if (!text || streaming || props.reportRunning) return;
        setQ('');
        props.onAsk(text);
      };
      var suggests = [
        { icon: 'chart', label: t('readingSug1') },
        { icon: 'clock', label: t('readingSug2') },
        { icon: 'sparkle', label: t('readingSug3') },
        { icon: 'report', label: t('readingSug4'), meta: t('readingSug4Meta'), report: true }
      ];
      return h('section', { className: 'zp-reading-chat', 'data-region': 'CHAT' },
        h('header', { className: 'zp-chat-head' },
          h('button', {
            className: 'zp-icon-btn zp-chat-back', type: 'button', title: t('navChart'),
            'aria-label': t('navChart'), onClick: props.onBack
          }, h(Icon, { name: 'back' })),
          h('div', { className: 'zp-chat-head-main' },
            h('div', { className: 'zp-chat-title' }, t('readingTitle')),
            h('div', { className: 'zp-chat-ctx' }, props.ctxLine || '')),
          props.onHandoff ? h('button', {
            className: 'zp-icon-btn', type: 'button', title: t('handoffHint'), 'aria-label': t('handoff'),
            disabled: streaming || props.reportRunning,
            onClick: props.onHandoff
          }, h(Icon, { name: 'handoff' })) : null,
          thread.length ? h('button', {
            className: 'zp-icon-btn', type: 'button', title: t('aiNewChat'), 'aria-label': t('aiNewChat'),
            disabled: streaming, onClick: props.onNewChat
          }, h(Icon, { name: 'newChat' })) : null),
        props.tabs || null,
        h('div', { className: 'zp-chat-scroll', ref: bodyRef },
          thread.length === 0
            ? h('div', { className: 'zp-chat-empty' },
              h('div', { className: 'zp-chat-greeting' }, t('readingGreeting')),
              h('p', { className: 'zp-chat-lead' }, t('readingLead')),
              h('div', { className: 'zp-chat-suggests' },
                suggests.map(function (s, idx) {
                  return h('button', {
                    key: idx, className: 'zp-suggest', type: 'button',
                    disabled: s.report ? (props.reportRunning || props.chatRunning) : false,
                    onClick: function () { s.report ? props.onGenerateReport() : props.onAsk(s.label); }
                  }, h(Icon, { name: s.icon, size: 14 }), h('span', null, s.label),
                    s.meta ? h('small', null, s.meta) : null);
                })))
            : h('div', { className: 'zp-chat-thread', role: 'log', 'aria-live': 'polite', 'aria-busy': streaming ? 'true' : 'false' },
              thread.map(function (m, idx) {
                if (m.role === 'user') {
                  return h('div', { key: 'm' + idx, className: 'zp-msg is-user' },
                    h('div', { className: 'zp-msg-bubble' }, m.content));
                }
                return h('div', { key: 'm' + idx, className: 'zp-msg' },
                  h('div', { className: 'zp-msg-ai-head' },
                    h('span', { className: 'zp-glyph-sm' }, h(Icon, { name: 'sparkle', size: 11 })),
                    h('span', null, t('readingTitle'))),
                  h('div', { className: 'zp-msg-ai-body' },
                    h('div', { className: 'zp-md', dangerouslySetInnerHTML: { __html: renderChatMd(m.content) } })),
                  idx === lastAssistant && !streaming && m.content
                    ? h('div', { className: 'zp-msg-actions' },
                      h('button', { type: 'button', onClick: props.onCopyAnswer },
                        h(Icon, { name: props.copied ? 'check' : 'copy', size: 12 }),
                        props.copied ? t('aiCopied') : t('aiCopy')))
                    : null);
              }),
              streaming
                ? h('div', { className: 'zp-typing' },
                  h('i', null), h('i', null), h('i', null),
                  h('span', null, props.thinkChars
                    ? t('aiThinking') + '（' + props.thinkChars + ' 字）'
                    : t('interpStreaming')))
                : null),
          props.error ? h('div', { className: 'zp-error-card' },
            h('b', null, t('reportFailed')),
            h('div', null, props.error),
            props.issue && props.issue.canContinue
              ? h('button', { className: 'zp-pill is-small', type: 'button', style: { marginTop: 8 }, onClick: props.onContinue }, t('aiContinue'))
              : null) : null),
        h('div', { className: 'zp-composer' },
          h('textarea', {
            rows: 2, value: q, placeholder: t('readingAskPh'), 'aria-label': t('readingAskPh'),
            disabled: streaming,
            onChange: function (ev) { setQ(ev.target.value); },
            onKeyDown: function (ev) {
              if (ev.nativeEvent && ev.nativeEvent.isComposing) return;
              if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); submit(); }
            }
          }),
          streaming
            ? h('button', { className: 'zp-send zp-send-stop', type: 'button', title: t('aiStop'), 'aria-label': t('aiStop'), onClick: props.onStop },
              h(Icon, { name: 'stop', size: 15 }))
            : h('button', {
              className: 'zp-send', type: 'button', disabled: !q.trim() || props.reportRunning,
              title: t('aiSend'), 'aria-label': t('aiSend'), onClick: submit
            }, h(Icon, { name: 'send', size: 15 })),
          h('div', { className: 'zp-composer-foot' },
            h('span', null, t('readingHint')),
            h('span', { className: 'zp-grow' }),
            props.reportRunning ? h('span', null, t('reportGenerating')) : null)),
        h('div', { className: 'zp-disclaimer-inline' }, t('disclaimerShort')));
    }

    /* ================================================================
     * 解读页 · 报告工位
     * ================================================================ */
    function ReportDock(props) {
      var t = props.t;
      var report = props.report || { status: 'idle', text: '' };
      var running = report.status === 'running';
      var done = report.status === 'done' && report.text;
      var progress = reportProgress(report.text || '');
      var pct = done ? 100 : Math.min(96, Math.round(progress.sections / 14 * 100) + (running ? 4 : 0));
      var dots = [];
      for (var i = 0; i < 14; i++) {
        dots.push(h('i', { key: i, className: i < progress.sections ? 'is-done' : (i === progress.sections && running ? 'is-active' : '') }));
      }
      var body = null;
      if (running) {
        body = h('div', { className: 'zp-progress-card' },
          h('div', { className: 'zp-progress-head' },
            h('span', { className: 'zp-progress-title' }, h('span', { className: 'zp-shimmer' }, t('reportGenerating'))),
            h('span', { className: 'zp-progress-meta' }, t('reportSections').replace('{n}', String(progress.sections)) + ' · ' + t('reportChars').replace('{n}', String(progress.chars)))),
          h('div', { className: 'zp-progress-list' },
            h('div', { className: 'zp-progress-step is-active' },
              h('i', null, '·'),
              h('span', null, (progress.last || t('reportGenerating')))),
            h('div', { className: 'zp-progress-step is-done' },
              h('i', null, h(Icon, { name: 'check', size: 9 })),
              h('span', null, progress.sections
                ? t('reportSections').replace('{n}', String(progress.sections)) + ' · ' + t('reportChars').replace('{n}', String(progress.chars))
                : t('reportGenerating'))),
            h('div', { className: 'zp-progress-step' },
              h('i', null), h('span', null, t('reportHintFoot')))),
          h('div', { className: 'zp-progress-bar' }, h('span', { style: { width: pct + '%' } })),
          h('div', { className: 'zp-dock-dots' }, dots),
          h('div', { className: 'zp-report-actions' },
            h('button', { className: 'zp-pill', type: 'button', onClick: props.onStop }, t('reportStop'))));
      } else if (report.status === 'error') {
        body = h('div', { className: 'zp-error-card' },
          h('b', null, t('reportFailed')),
          h('div', null, report.error || ''),
          h('div', { className: 'zp-report-actions' },
            h('button', { className: 'zp-pill is-primary', type: 'button', onClick: props.onRetry }, t('reportRetry')),
            report.issue && report.issue.canContinue
              ? h('button', { className: 'zp-pill', type: 'button', onClick: props.onContinue }, t('reportContinue'))
              : null));
      } else if (done) {
        body = h('div', null,
          h('div', { className: 'zp-report-card' },
            h('div', { className: 'zp-report-card-head' },
              h('div', { className: 'zp-report-card-main' },
                h('div', { className: 'zp-report-title' }, t('reportName')),
                h('div', { className: 'zp-report-meta' },
                  [t('reportSections').replace('{n}', String(progress.sections)),
                    t('reportChars').replace('{n}', String(progress.chars)),
                    report.finishedAt ? fmtDateTime(report.finishedAt) : ''].filter(Boolean).join(' · '))),
              h('span', { className: 'zp-chart-card-tag is-saved' }, t('reportReady'))),
            h('div', { className: 'zp-report-actions' },
              h('button', { className: 'zp-pill is-primary', type: 'button', onClick: props.onRead },
                h(Icon, { name: 'expand', size: 14 }), t('reportRead')),
              h('button', { className: 'zp-pill', type: 'button', onClick: props.onExport },
                h(Icon, { name: 'export', size: 14 }), t('reportExport')),
              h('button', { className: 'zp-pill is-quiet', type: 'button', onClick: props.onCopy },
                h(Icon, { name: 'copy', size: 14 }), props.copied ? t('reportCopied') : t('reportCopy'))),
            h('div', { className: 'zp-report-excerpt' },
              h('div', { className: 'zp-md', dangerouslySetInnerHTML: { __html: renderChatMd(reportExcerpt(report.text)) } })),
            h('div', { className: 'zp-report-hint' }, t('reportHint')),
            h('button', { className: 'zp-link-btn', type: 'button', style: { marginTop: 8 }, disabled: props.chatRunning, onClick: props.onRetry }, t('reportRegenerate'))));
      } else {
        body = h('div', { className: 'zp-dock-empty' },
          h('div', { className: 'zp-dock-eyebrow' }, t('dockEyebrow')),
          h('div', { className: 'zp-dock-hero' }, t('dockIdleTitle')),
          h('p', { className: 'zp-dock-lead' }, t('dockIdleLead')),
          h('div', { className: 'zp-report-actions' },
            h('button', { className: 'zp-pill is-primary', type: 'button', disabled: props.chatRunning, onClick: props.onGenerate },
              h(Icon, { name: 'sparkle', size: 14 }), t('reportGenerate'))),
          h('ul', { className: 'zp-parts-list' },
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(function (n) {
              return h('li', { key: n }, h('span', null, String(n).padStart(2, '0')), t('reportPart' + n));
            })));
      }
      return h('section', { className: 'zp-reading-dock', 'data-region': 'REPORT_DOCK' },
        h('header', { className: 'zp-dock-head' },
          h('div', { className: 'zp-chat-head-main' },
            h('div', { className: 'zp-chat-title' }, t('dockTitle')),
            h('div', { className: 'zp-chat-ctx' }, t('dockMeta'))),
          done ? h('button', {
            className: 'zp-icon-btn', type: 'button', title: t('reportRead'), 'aria-label': t('reportRead'), onClick: props.onRead
          }, h(Icon, { name: 'expand' })) : null),
        h('div', { className: 'zp-dock-scroll' }, body));
    }

    /* ================================================================
     * 报告全屏阅读页
     * ================================================================ */
    function ReaderPage(props) {
      var t = props.t;
      var boxRef = useRef(null);
      var [full, setFull] = useState(false);
      useEffect(function () {
        var onChange = function () { setFull(!!(document.fullscreenElement && boxRef.current && document.fullscreenElement === boxRef.current)); };
        document.addEventListener('fullscreenchange', onChange);
        return function () { document.removeEventListener('fullscreenchange', onChange); };
      }, []);
      var toggleFull = function () {
        var el = boxRef.current;
        if (!el) return;
        try {
          if (document.fullscreenElement) { document.exitFullscreen && document.exitFullscreen(); return; }
          if (el.requestFullscreen) el.requestFullscreen().catch(function () { /* 宿主 webview 不支持时静默 */ });
        } catch (e) { /* ignore */ }
      };
      var progress = reportProgress(props.text);
      return h('div', { className: 'zp-reader', 'data-region': 'READER', ref: boxRef },
        h('header', { className: 'zp-reader-head' },
          h('button', { className: 'zp-pill is-quiet', type: 'button', onClick: props.onBack },
            h(Icon, { name: 'back', size: 14 }), t('readerBack')),
          h('div', { className: 'zp-chat-head-main' },
            h('div', { className: 'zp-reader-title' }, t('reportName')),
            h('div', { className: 'zp-reader-meta' },
              [props.name, t('reportChars').replace('{n}', String(progress.chars)),
                t('reportSections').replace('{n}', String(progress.sections)),
                props.finishedAt ? fmtDateTime(props.finishedAt) : ''].filter(Boolean).join(' · '))),
          h('div', { className: 'zp-reader-actions' },
            h('button', { className: 'zp-pill is-small', type: 'button', onClick: toggleFull },
              h(Icon, { name: full ? 'close' : 'expand', size: 13 }), full ? t('readerExitFull') : t('readerFull')),
            h('button', { className: 'zp-pill is-small', type: 'button', onClick: props.onExport },
              h(Icon, { name: 'export', size: 13 }), t('reportExport')),
            h('button', { className: 'zp-pill is-small', type: 'button', onClick: props.onCopy },
              h(Icon, { name: props.copied ? 'check' : 'copy', size: 13 }), props.copied ? t('reportCopied') : t('reportCopy')))),
        h('div', { className: 'zp-reader-body' },
          h('div', { className: 'zp-reader-paper' },
            h('iframe', {
              className: 'zp-reader-frame', srcDoc: props.html,
              title: t('reportName'), sandbox: 'allow-same-origin'
            }))));
    }

    /* ---------------- 设置：面板内居中弹层 ---------------- */
    function SettingsModal(props) {
      var t = props.t;
      var boxRef = useDialogFocus();
      var [update, setUpdate] = useState(null);
      var checkVersion = function () {
        if (update && update.checking) return;
        setUpdate({ checking: true });
        fetch('/ziwei/version', { method: 'GET', headers: { accept: 'application/json' } })
          .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
          .then(function (out) { setUpdate({ result: out.j || {} }); })
          .catch(function (e) { setUpdate({ error: String((e && e.message) || e) }); });
      };
      return h('div', { className: 'zp-overlay' },
        h('div', { className: 'zp-overlay-mask', onClick: props.onClose, 'aria-hidden': true }),
        h('div', { className: 'zp-overlay-center' },
          h('div', { className: 'zp-settings', role: 'dialog', 'data-region': 'MODAL', 'aria-modal': 'true', 'aria-label': t('settingsTitle'), tabIndex: -1,
            ref: boxRef, onKeyDown: function (ev) { trapTab(ev, ev.currentTarget); } },
            h('header', { className: 'zp-settings-head' },
              h('div', { className: 'zp-settings-title' }, t('settingsTitle')),
              h('button', {
                className: 'zp-icon-btn', type: 'button', title: t('close'), 'aria-label': t('close'), onClick: props.onClose,
                style: { marginLeft: 'auto' }
              }, h(Icon, { name: 'close' }))),
            h('div', { className: 'zp-settings-body' },
              h('label', { className: 'zp-check' },
                h('input', { type: 'checkbox', checked: props.autoOpen, onChange: function (ev) { props.setAutoOpen(ev.target.checked); } }),
                h('span', null, t('autoOpen'))),
              h('label', { className: 'zp-check' },
                h('input', { type: 'checkbox', checked: props.showAdj, onChange: function (ev) { props.setShowAdj(ev.target.checked); } }),
                h('span', null, t('showAdjSet'))),
              h('div', { className: 'zp-update' },
                h('div', { className: 'zp-update-row' },
                  h('span', null, t('versionLabel')),
                  h('b', null, APP_VERSION),
                  h('button', {
                    className: 'zp-mini-btn', type: 'button',
                    disabled: !!(update && update.checking),
                    onClick: checkVersion
                  }, update && update.checking ? t('checking') : t('checkUpdate'))),
                h('div', { className: 'zp-settings-hint' }, t('updateHint')),
                update && update.error
                  ? h('div', { className: 'zp-update-new' }, t('updateFailed').replace('{reason}', update.error))
                  : null,
                update && update.result && update.result.ok
                  ? (update.result.updateAvailable
                    ? h('div', null,
                      h('div', { className: 'zp-update-new' }, t('updateAvailable').replace('{latest}', update.result.latest || '?')),
                      h('code', { className: 'zp-update-cmd' }, 'dsh plugin --profile <profile> update dsh-ziwei'))
                    : h('div', { className: 'zp-update-ok' }, t('upToDate').replace('{version}', update.result.current || APP_VERSION)))
                  : null,
                update && update.result && !update.result.ok
                  ? h('div', { className: 'zp-update-new' }, t('updateFailed').replace('{reason}', update.result.reason || 'unknown'))
                  : null),
              h('div', { className: 'zp-settings-about' },
                h('b', null, t('about')),
                h('span', null, t('aboutText')))))));
    }

    /* ---------------- 主应用 ---------------- */
    function ProApp(props) {
      var t = props.t;
      var actions = props.actions;

      /* ---------- 表单 ---------- */
      var [form, setFormRaw] = useState(function () {
        var init = Object.assign({}, DEFAULT_FORM);
        try {
          var saved = JSON.parse(localStorage.getItem('ziwei-pro.form') || 'null');
          if (saved && typeof saved === 'object') {
            Object.keys(init).forEach(function (k) { if (saved[k] !== undefined) init[k] = saved[k]; });
            if (saved.settings && typeof saved.settings === 'object') init.settings = Object.assign({}, init.settings, saved.settings);
          }
        } catch (e) { /* ignore */ }
        try {
          if (!localStorage.getItem('ziwei-pro.formV133')) {
            if (init.settings && init.settings.monthDivide === 'normal') {
              init.settings = Object.assign({}, init.settings, { monthDivide: 'exact' });
              try { localStorage.setItem('ziwei-pro.form', JSON.stringify(init)); } catch (e) { /* ignore */ }
            }
            localStorage.setItem('ziwei-pro.formV133', '1');
          }
        } catch (e) { /* ignore */ }
        return init;
      });
      var setForm = function (patch) {
        setFormRaw(function (prev) {
          var next = Object.assign({}, prev, patch);
          try { localStorage.setItem('ziwei-pro.form', JSON.stringify(next)); } catch (e) { /* ignore */ }
          return next;
        });
      };

      /* ---------- 命盘与视图 ---------- */
      var [chart, setChart] = useState(null);
      var [error, setError] = useState('');
      var [selected, setSelected] = useState(-1);
      var [tab, setTab] = useState('natal');
      var [selDecadal, setSelDecadal] = useState(0);
      var [yearlyYear, setYearlyYear] = useState(String(new Date().getFullYear()));
      var [view, setView] = useState('chart');
      var [panelW, setPanelW] = useState(0);

      /* ---------- 页面导航 ---------- */
      var [page, setPage] = useState('home');
      var chartInputRef = useRef(null); /* home | create | chart | reading | report */
      var [createFrom, setCreateFrom] = useState('home');
      var [readingTab, setReadingTab] = useState('chat');

      /* ---------- 命盘库 / 最近看过 ---------- */
      var [library, setLibrary] = useState(function () {
        try { return JSON.parse(localStorage.getItem('ziwei-pro.library') || '[]'); } catch (e) { return []; }
      });
      var [history, setHistory] = useState(function () {
        try {
          var raw = JSON.parse(localStorage.getItem('ziwei-pro.history') || '[]');
          return Array.isArray(raw) ? raw.filter(function (h) { return h && h.input; }) : [];
        } catch (e) { return []; }
      });

      /* ---------- 偏好 ---------- */
      useEffect(function () {
        try { localStorage.removeItem('ziwei-workbench.apikey'); } catch (e) { /* ignore */ }
      }, []);
      var [autoOpen, setAutoOpenState] = useState(function () {
        try { return localStorage.getItem('ziwei-pro.autopen') === '1'; } catch (e) { return false; }
      });
      var setAutoOpen = function (v) {
        setAutoOpenState(v);
        try { localStorage.setItem('ziwei-pro.autopen', v ? '1' : '0'); } catch (e) { /* ignore */ }
      };
      var [showAdj, setShowAdjState] = useState(function () {
        try { return localStorage.getItem('ziwei-pro.showadj') === '1'; } catch (e) { return false; }
      });
      var setShowAdj = function (v) {
        setShowAdjState(v);
        try { localStorage.setItem('ziwei-pro.showadj', v ? '1' : '0'); } catch (e) { /* ignore */ }
      };

      /* ---------- 解读状态 ---------- */
      var [thread, setThread] = useState([]);
      var [chatting, setChatting] = useState(false);
      var [interpError, setInterpError] = useState('');
      var [interpIssue, setInterpIssue] = useState(null);
      var [thinkChars, setThinkChars] = useState(0);
      var [report, setReport] = useState({ status: 'idle', text: '', error: '', issue: null, startedAt: 0, finishedAt: 0 });
      var [copied, setCopied] = useState(false);
      var [reportCopied, setReportCopied] = useState(false);
      var [handoffDone, setHandoffDone] = useState(false);
      var [synced, setSynced] = useState(false);
      var [modal, setModal] = useState(null);
      var chatAbortRef = useRef(null);
      var reportAbortRef = useRef(null);
      var stopChatRef = useRef(false);
      var stopReportRef = useRef(false);
      var lastModeRef = useRef('brief');

      /* 面板宽度 → 三档布局 */
      var rootRef = useRef(null);
      useEffect(function () {
        var el = rootRef.current;
        if (!el) return undefined;
        var apply = function (w) {
          if (!w || w <= 0) return;
          setPanelW(function (prev) {
            var next = Math.round(w);
            return Math.abs(prev - next) >= 6 ? next : prev;
          });
        };
        var boxWidth = function () { return el.getBoundingClientRect().width; };
        apply(boxWidth());
        if (typeof ResizeObserver === 'function') {
          var ro = new ResizeObserver(function () { apply(boxWidth()); });
          ro.observe(el);
          return function () { ro.disconnect(); };
        }
        var onWinResize = function () { apply(boxWidth()); };
        window.addEventListener('resize', onWinResize);
        return function () { window.removeEventListener('resize', onWinResize); };
      }, []);

      var layoutMode = panelW <= 0 ? 'narrow' : (panelW >= 1100 ? 'wide' : (panelW >= 880 ? 'mid' : 'narrow'));

      /* 浮层 Esc */
      useEffect(function () {
        if (!modal) return undefined;
        var onEsc = function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); setModal(null); } };
        window.addEventListener('keydown', onEsc);
        return function () { window.removeEventListener('keydown', onEsc); };
      }, [modal]);

      /* 启动自动打开工作台 */
      useEffect(function () {
        if (!autoOpen) return undefined;
        var timer = setTimeout(function () { actions.autoOpenPanel(); }, 250);
        return function () { clearTimeout(timer); };
      }, []);

      /* ---------- 计算 / 持久化 ---------- */
      var computeChartFromInput = function (input) {
        return E.computeChart({
          calendar: input.calendar,
          year: +input.year, month: +input.month, day: +input.day,
          isLeapMonth: !!input.isLeap,
          hour: +input.hour, minute: +input.minute,
          gender: input.gender,
          longitude: (input.longitude === '' || input.longitude === null || input.longitude === undefined) ? undefined : +input.longitude,
          settings: input.settings
        });
      };
      var currentInput = function () { return cleanInput(form); };

      var persistHistory = function (next) {
        setHistory(next);
        try { localStorage.setItem('ziwei-pro.history', JSON.stringify(next)); } catch (e) { /* ignore */ }
      };
      var persistLibrary = function (next) {
        setLibrary(next);
        try { localStorage.setItem('ziwei-pro.library', JSON.stringify(next)); } catch (e) { /* ignore */ }
      };
      var recordHistory = function (input) {
        var key = inputKey(input);
        var now = Date.now();
        var next = [{ id: 'h-' + now, input: input, lastViewedAt: now }];
        history.forEach(function (h) {
          if (inputKey(h.input) !== key) next.push(h);
        });
        persistHistory(next.slice(0, 16));
      };

      var currentDecadeIndex = function (chartObj) {
        if (!chartObj || !chartObj.lunar) return 0;
        var age = new Date().getFullYear() - chartObj.lunar.year + 1;
        var list = [];
        try { list = E.decadalList(chartObj) || []; } catch (e) { list = []; }
        for (var i = 0; i < list.length; i++) {
          if (age >= list[i].ageRange[0] && age <= list[i].ageRange[1]) return i;
        }
        return 0;
      };

      var resetReading = function () {
        setThread([]);
        setChatting(false);
        setInterpError('');
        setInterpIssue(null);
        setThinkChars(0);
        setReport({ status: 'idle', text: '', error: '', issue: null, startedAt: 0, finishedAt: 0 });
        setReadingTab('chat');
      };

      var adoptChart = function (res, input) {
        /* E.computeChart 成功时直接返回命盘对象（错误时返回 {error}） */
        var chartObj = res.chart || res;
        chartInputRef.current = input;
        setChart(chartObj);
        setSelected(chartObj.soulIndex);
        setSelDecadal(currentDecadeIndex(chartObj));
        setYearlyYear(String(new Date().getFullYear()));
        setTab('natal');
        setView('chart');
        setError('');
        resetReading();
        recordHistory(input);
        setPage('chart');
      };

      var compute = function () {
        setError('');
        var input = currentInput();
        var result;
        try { result = computeChartFromInput(input); } catch (e) { setError(String((e && e.message) || e)); return; }
        if (!result || result.error) { setError((result && result.error) || '排盘失败'); return; }
        adoptChart(result, input);
      };

      var SAMPLE_FORM = {
        name: '示例命主', calendar: 'solar', year: 1992, month: 5, day: 3,
        isLeap: false, hour: 9, minute: 30, gender: 'male',
        longitude: 105.97, place: '成都', occupation: '',
        settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
      };
      var computeSample = function () {
        var input = cleanInput(SAMPLE_FORM);
        setFormRaw(function () { return Object.assign({}, DEFAULT_FORM, SAMPLE_FORM, { settings: Object.assign({}, DEFAULT_FORM.settings, SAMPLE_FORM.settings) }); });
        var result = computeChartFromInput(input);
        if (result && !result.error) adoptChart(result, input);
      };

      var openInput = function (input) {
        /* 同一张盘：保留当前解读/报告，直接回命盘页 */
        if (chart && chartInputRef.current && inputKey(chartInputRef.current) === inputKey(input)) {
          setPage('chart');
          return;
        }
        var result;
        try { result = computeChartFromInput(input); } catch (e) { setError(String((e && e.message) || e)); return; }
        if (!result || result.error) { setError((result && result.error) || '排盘失败'); return; }
        setFormRaw(Object.assign({}, DEFAULT_FORM, input, { settings: Object.assign({}, DEFAULT_FORM.settings, input.settings || {}) }));
        adoptChart(result, input);
      };

      /* ---------- 大限 / 流年 / 格局 ---------- */
      var decadalList = useMemo(function () { return chart ? E.decadalList(chart) : []; }, [chart]);
      var yearlyChart = useMemo(function () {
        if (!chart) return null;
        var y = parseInt(yearlyYear, 10);
        if (isNaN(y)) return { error: '年份无效' };
        return E.yearlyForYear(chart, y);
      }, [chart, yearlyYear]);
      var patterns = useMemo(function () { return chart ? E.detectPatterns(chart) : []; }, [chart]);

      var scope = null, scopeBadges = {};
      if (chart && tab === 'decadal' && decadalList[selDecadal]) {
        var d = decadalList[selDecadal];
        scope = {
          label: '大限 ' + d.ageRange[0] + '~' + d.ageRange[1] + '岁 ' + d.stem + d.branch + '（' + d.palaceName + '）',
          palaceNames: d.palaceNames,
          stars: d.stars
        };
        d.mutagen.forEach(function (star, mi) {
          scopeBadges[star] = { text: '限' + MU_CHARS[mi], badge: MU_CHARS[mi] };
        });
      } else if (chart && tab === 'yearly' && yearlyChart && !yearlyChart.error) {
        var y = yearlyChart.yearly;
        scope = {
          label: '流年 ' + y.stem + y.branch + ' · 小限 ' + yearlyChart.nominalAge + '岁',
          palaceNames: y.palaceNames,
          stars: y.stars
        };
      }
      var scopeLabel = scope ? scope.label : '';

      /* ---------- 命盘库交互 ---------- */
      var libraryIndexOf = function (input) {
        var key = inputKey(input);
        for (var i = 0; i < library.length; i++) if (inputKey(library[i].input) === key) return i;
        return -1;
      };
      var toggleSaveInput = function (input, name) {
        var idx = libraryIndexOf(input);
        if (idx >= 0) {
          var next = library.slice(); next.splice(idx, 1); persistLibrary(next);
          return false;
        }
        var entry = { id: 'lib-' + Date.now(), name: (name || input.name || t('defaultName')).trim() || t('defaultName'), input: input };
        persistLibrary([entry].concat(library).slice(0, 60));
        return true;
      };
      var removeHistoryItem = function (item) {
        persistHistory(history.filter(function (h) { return inputKey(h.input) !== item.key; }));
      };

      var homeItems = useMemo(function () {
        var map = {};
        var list = [];
        var push = function (input, saved, libId, lastViewedAt) {
          var key = inputKey(input);
          if (map[key]) {
            var ex = map[key];
            ex.saved = ex.saved || saved;
            ex.libId = ex.libId || libId || null;
            ex.lastViewedAt = Math.max(ex.lastViewedAt || 0, lastViewedAt || 0);
            return;
          }
          var entry = { key: key, input: input, saved: !!saved, libId: libId || null, lastViewedAt: lastViewedAt || 0, name: input.name || '', chart: null };
          try {
            var r = computeChartFromInput(input);
            if (r && (r.chart || r.palaces)) entry.chart = r.chart || r;
          } catch (e) { /* 坏记录不渲染 */ }
          map[key] = entry;
          list.push(entry);
        };
        (history || []).forEach(function (h) { push(h.input, false, null, h.lastViewedAt); });
        (library || []).forEach(function (l) { push(l.input, true, l.id, 0); });
        list.sort(function (a, b) { return (b.lastViewedAt || 0) - (a.lastViewedAt || 0); });
        return list;
      }, [history, library]);

      /* ---------- 解读：上下文 ---------- */
      var nowPosition = function () {
        var cy = new Date().getFullYear();
        var birthYear = (chart && chart.lunar && chart.lunar.year) ? chart.lunar.year : (+form.year || 0);
        return { currentYear: cy, currentAge: birthYear ? (cy - birthYear + 1) : 0 };
      };
      var chartContextText = function () {
        if (!chart) return '';
        var pos = nowPosition();
        try {
          if (window.ZWCore && typeof window.ZWCore.fullChartText === 'function') {
            return window.ZWCore.fullChartText(chart, pos);
          }
        } catch (e) { /* 回退 */ }
        return E.chartText(chart);
      };
      var lastAssistant = function () {
        for (var i = thread.length - 1; i >= 0; i--) if (thread[i].role === 'assistant' && thread[i].content) return thread[i].content;
        return '';
      };

      /* ---------- 解读：流式通道 ---------- */
      var runStream = function (mode, question, target, opts) {
        opts = opts || {};
        if (!chart) return;
        var controller = null;
        try { controller = new AbortController(); } catch (e) { controller = null; }
        var abortRef = target === 'chat' ? chatAbortRef : reportAbortRef;
        var stopRef = target === 'chat' ? stopChatRef : stopReportRef;
        abortRef.current = controller;
        stopRef.current = false;
        var base = opts.base || '';
        if (target === 'chat') {
          setChatting(true);
          setInterpError('');
          setInterpIssue(null);
          setThinkChars(0);
        } else {
          setReport({ status: 'running', text: base, error: '', issue: null, startedAt: Date.now(), finishedAt: 0 });
        }
        var pos = nowPosition();
        var selectedDecade = (tab === 'decadal' && decadalList[selDecadal]) ? decadalList[selDecadal].ageRange : null;
        var body = {
          chartText: chartContextText(),
          mode: mode === 'report' ? 'report' : 'brief',
          question: (question || '').trim(),
          history: opts.history || [],
          meta: {
            name: form.name, place: form.place, occupation: form.occupation,
            gender: form.gender === 'female' ? 'female' : 'male',
            currentAge: pos.currentAge, currentYear: pos.currentYear,
            decadalFocus: selectedDecade,
            yearlyFocus: (tab === 'yearly') ? (parseInt(yearlyYear, 10) || pos.currentYear) : null
          }
        };
        var settled = false, gotDone = false, gotError = false, produced = '', finalText = base;
        var finish = function (errMsg, issue) {
          if (settled) return;
          settled = true;
          abortRef.current = null;
          setThinkChars(0);
          if (target === 'chat') {
            setChatting(false);
            setInterpError(errMsg || '');
            setInterpIssue(issue || null);
            if (!errMsg) lastModeRef.current = 'brief';
          } else {
            setReport(function (prev) {
              return Object.assign({}, prev, {
                status: errMsg ? 'error' : 'done',
                text: finalText || prev.text,
                error: errMsg || '',
                issue: issue || null,
                finishedAt: Date.now()
              });
            });
            if (!errMsg) lastModeRef.current = 'report';
          }
        };
        var appendDelta = function (delta) {
          produced += delta;
          finalText = base + produced;
          if (target === 'chat') {
            setThread(function (prev) {
              if (!prev.length) return prev;
              var copy = prev.slice();
              var last = copy[copy.length - 1];
              if (!last || last.role !== 'assistant') return prev;
              copy[copy.length - 1] = { role: 'assistant', content: finalText };
              return copy;
            });
          } else {
            setReport(function (prev) { return Object.assign({}, prev, { text: finalText }); });
          }
        };
        fetch('/ziwei/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller ? controller.signal : undefined
        }).then(function (resp) {
          if (!resp.ok) {
            return resp.text().then(function (txt) {
              var reason = 'HTTP ' + resp.status;
              try { var j = JSON.parse(txt); if (j && j.reason) reason = j.reason; } catch (e) { /* 非 JSON */ }
              finish(reason);
            }).catch(function () { finish('HTTP ' + resp.status); });
          }
          if (!resp.body || typeof resp.body.getReader !== 'function') {
            finish('浏览器不支持流式响应');
            return undefined;
          }
          var reader = resp.body.getReader();
          var decoder = new TextDecoder();
          var buf = '';
          var pump = function () {
            return reader.read().then(function (chunk) {
              if (chunk.done) {
                if (!gotDone && !gotError) finish(t('aiDisconnected'), { kind: 'stream-closed', canContinue: !!produced.trim() });
                return;
              }
              buf += decoder.decode(chunk.value, { stream: true });
              var parts = buf.split('\n\n');
              buf = parts.pop();
              parts.forEach(function (block) {
                var ev = 'message', data = '';
                block.split('\n').forEach(function (line) {
                  if (line.indexOf('event: ') === 0) ev = line.slice(7).trim();
                  else if (line.indexOf('data: ') === 0) data += line.slice(6);
                });
                if (!data) return;
                var payload = null;
                try { payload = JSON.parse(data); } catch (e) { return; }
                if (ev === 'start') { setThinkChars(0); }
                else if (ev === 'thinking') { setThinkChars((payload && payload.chars) || 0); }
                else if (ev === 'delta' && payload && payload.text) { setThinkChars(0); appendDelta(payload.text); }
                else if (ev === 'done') {
                  gotDone = true;
                  if (payload && typeof payload.text === 'string' && payload.text) {
                    produced = payload.text;
                    finalText = base + produced;
                    if (target === 'chat') {
                      setThread(function (prev) {
                        if (!prev.length) return prev;
                        var copy = prev.slice();
                        copy[copy.length - 1] = { role: 'assistant', content: payload.text };
                        return copy;
                      });
                    }
                  }
                  finish('');
                } else if (ev === 'error') {
                  gotError = true;
                  finish((payload && payload.reason) || '解读失败', payload);
                }
              });
              return pump();
            });
          };
          return pump();
        }).catch(function (e) {
          if (e && e.name === 'AbortError') {
            if (stopRef.current) finish(t('aiStopped'), { kind: 'stopped', canContinue: !!produced.trim() });
            else finish('');
            return;
          }
          finish(String((e && e.message) || e), { kind: 'error', canContinue: !!produced.trim() });
        });
      };

      var runChat = function (question) {
        if (!chart || chatting || report.status === 'running') return;
        var asked = (question || '').trim();
        if (!asked) return;
        var history = thread.map(function (m) { return { role: m.role, content: m.content }; });
        setThread(thread.concat([{ role: 'user', content: asked }, { role: 'assistant', content: '' }]));
        runStream('brief', asked, 'chat', { history: history });
      };
      var continueChat = function () {
        if (!chart || chatting) return;
        var history = thread.map(function (m) { return { role: m.role, content: m.content }; });
        setThread(thread.concat([{ role: 'assistant', content: '' }]));
        runStream('brief', t('aiContinuePrompt'), 'chat', { history: history });
      };
      var stopChat = function () {
        if (!chatAbortRef.current) return;
        stopChatRef.current = true;
        try { chatAbortRef.current.abort(); } catch (e) { /* ignore */ }
      };
      var newChat = function () {
        if (chatting) return;
        setThread([]);
        setInterpError('');
        setInterpIssue(null);
      };

      var generateReport = function () {
        if (!chart || report.status === 'running' || chatting) return;
        setReadingTab('dock');
        runStream('report', '', 'report', { history: [] });
      };
      var regenerateReport = function () {
        if (!chart || report.status === 'running' || chatting) return;
        setReadingTab('dock');
        runStream('report', '', 'report', { history: [] });
      };
      var stopReport = function () {
        if (!reportAbortRef.current) return;
        stopReportRef.current = true;
        try { reportAbortRef.current.abort(); } catch (e) { /* ignore */ }
      };
      var continueReport = function () {
        if (!chart || report.status === 'running') return;
        var base = report.text || '';
        var hist = base ? [{ role: 'assistant', content: base }] : [];
        runStream('report', t('aiContinuePrompt'), 'report', { history: hist, base: base });
      };

      var reportMeta = function () {
        return { chart: chart, name: form.name, place: form.place, occupation: form.occupation, gender: form.gender === 'female' ? 'female' : 'male' };
      };
      var reportHtml = useMemo(function () {
        if (!chart || !report.text) return '';
        try { return actions.buildReportHtml(reportMeta(), report.text); } catch (e) { return ''; }
      }, [chart, report.text, form]);

      var copyReport = function () {
        if (!report.text) return;
        setReportCopied(true);
        setTimeout(function () { setReportCopied(false); }, 1600);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(report.text).catch(function () { /* ignore */ });
        } catch (e) { /* ignore */ }
      };
      var exportReportHtml = function () {
        if (!report.text) return;
        try {
          var html = actions.buildReportHtml(reportMeta(), report.text);
          var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          var now = new Date();
          var ymd = now.getFullYear() + ('0' + (now.getMonth() + 1)).slice(-2) + ('0' + now.getDate()).slice(-2);
          a.href = url;
          a.download = '人生鲲鹏计划_' + (form.name || '命主') + '_' + ymd + '.html';
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
        } catch (e) {
          setReport(function (prev) { return Object.assign({}, prev, { error: '导出失败: ' + String((e && e.message) || e) }); });
        }
      };
      var copyAnswer = function () {
        var text = lastAssistant();
        if (!text) return;
        setCopied(true);
        setTimeout(function () { setCopied(false); }, 1600);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(function () { /* ignore */ });
        } catch (e) { /* ignore */ }
      };

      /* 复制命盘 / 写入会话 / 交给会话 */
      var copyChart = function () {
        if (!chart) return;
        setCopied(true);
        setTimeout(function () { setCopied(false); }, 1600);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(E.chartText(chart)).catch(function () { /* ignore */ });
        } catch (e) { /* ignore */ }
      };
      var syncToSession = function () {
        if (!chart) return;
        fetch('/ziwei/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chartText: E.chartText(chart),
            fullText: chartContextText(),
            name: form.name || '', place: form.place || '', occupation: form.occupation || '',
            gender: form.gender === 'female' ? 'female' : 'male'
          })
        }).then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.ok) { setSynced(true); setTimeout(function () { setSynced(false); }, 2200); }
          else setInterpError((j && j.reason) || '同步失败');
        }).catch(function (e) { setInterpError(String((e && e.message) || e)); });
      };
      var handoffToSession = function () {
        if (!chart || chatting || report.status === 'running') return;
        setInterpError('');
        setHandoffDone(false);
        var answer = report.text || lastAssistant();
        var mode = report.text ? 'report' : 'brief';
        fetch('/ziwei/handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chartText: E.chartText(chart),
            fullText: chartContextText(),
            name: form.name || '', place: form.place || '', occupation: form.occupation || '',
            gender: form.gender === 'female' ? 'female' : 'male',
            interpretation: answer,
            mode: mode
          })
        }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
          .then(function (out) {
            var j = out.j || {};
            if (j.ok && j.sessionId) {
              setHandoffDone(true);
              setTimeout(function () { setHandoffDone(false); }, 3000);
              var tries = 0;
              var openIt = function () {
                tries += 1;
                if (actions.openSession(j.sessionId)) return;
                if (tries < 6) { setTimeout(openIt, 350 * tries); return; }
                setInterpError('会话已创建，但界面没能自动跳过去——请在左侧会话列表里打开新会话继续。');
              };
              openIt();
            } else {
              setInterpError(j.reason || ('交给会话失败 (HTTP ' + out.status + ')'));
            }
          })
          .catch(function (e) { setInterpError(String((e && e.message) || e)); });
      };

      /* ---------- 页面导航 ---------- */
      var go = function (id) {
        if ((id === 'chart' || id === 'reading') && !chart) { setCreateFrom('home'); setPage('create'); return; }
        if (id === 'report' && !(report.status === 'done' && report.text)) { setPage('reading'); return; }
        setPage(id);
      };
      var openCreate = function (from) {
        setError('');
        setCreateFrom(from || 'home');
        setPage('create');
      };
      var backFromCreate = function () {
        if (createFrom === 'chart' && chart) {
          if (chartInputRef.current) {
            setFormRaw(Object.assign({}, DEFAULT_FORM, chartInputRef.current, {
              settings: Object.assign({}, DEFAULT_FORM.settings, chartInputRef.current.settings || {})
            }));
          }
          setPage('chart');
          return;
        }
        setPage('home');
      };

      /* ---------- 命盘操作 ---------- */
      var stepDecade = function (delta) {
        if (!decadalList.length) return;
        var next = selDecadal + delta;
        if (next < 0 || next > decadalList.length - 1) return;
        setSelDecadal(next);
      };
      var yearNum = function () { var n = parseInt(yearlyYear, 10); return isNaN(n) ? new Date().getFullYear() : n; };
      var stepYear = function (delta) {
        var next = yearNum() + delta;
        if (next < 1900 || next > 2100) return;
        setYearlyYear(String(next));
      };
      var onStageKeyDown = function (ev) {
        if (!chart || modal || page !== 'chart' || view !== 'chart') return;
        var target = ev.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'left'); }); }
        else if (ev.key === 'ArrowRight') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'right'); }); }
        else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'opp'); }); }
      };

      /* ---------- 渲染：顶栏 ---------- */
      var navItems = [
        { id: 'home', label: t('navHome'), icon: 'home' },
        { id: 'chart', label: t('navChart'), icon: 'chart', disabled: !chart },
        { id: 'reading', label: t('navReading'), icon: 'sparkle', disabled: !chart },
        { id: 'report', label: t('navReport'), icon: 'report', hidden: !(report.status === 'done' && report.text) }
      ];
      var topAction = null;
      var topCtx = chart ? h('span', { className: 'zp-top-ctx' },
        h('b', null, form.name || t('defaultName')), ' · ', chart.fiveElementsClass, ' · ', form.gender === 'female' ? t('female') : t('male')) : null;
      var topbar = h('header', { className: 'zp-topbar', 'data-region': 'HEAD' },
        h('button', { className: 'zp-brand', type: 'button', onClick: function () { go('home'); }, title: t('navHome'), 'aria-label': t('navHome') },
          h('span', { className: 'zp-brand-mark' },
            h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true },
              h('circle', { cx: 12, cy: 12, r: 10, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, opacity: .5 }),
              h('path', { d: 'M12 2a10 10 0 0 1 0 20 5 5 0 0 1 0-10 5 5 0 0 0 0-10z', fill: 'currentColor' }))),
          h('span', { className: 'zp-brand-name' }, t('brand')),
          h('span', { className: 'zp-brand-pro' }, t('brandPro'))),
        h('nav', { className: 'zp-nav', 'aria-label': t('navLabel') },
          navItems.filter(function (n) { return !n.hidden; }).map(function (n) {
            return h('button', {
              key: n.id, type: 'button', className: page === n.id ? 'is-on' : undefined,
              'aria-current': page === n.id ? 'page' : undefined,
              disabled: !!n.disabled, title: n.disabled ? t('navNeedChart') : n.label,
              onClick: function () { go(n.id); }
            }, n.label);
          })),
        h('span', { className: 'zp-top-spacer' }),
        topCtx,
        h('div', { className: 'zp-top-actions' },
          topAction,
          actions.canReturnToConversation ? h('button', {
            className: 'zp-icon-btn zp-exit', type: 'button',
            title: t('backToConversation'), 'aria-label': t('backToConversation'),
            onClick: function () { actions.returnToConversation(); }
          }, h(Icon, { name: 'back' })) : null,
          h('button', {
            className: 'zp-icon-btn', type: 'button', title: t('settingsTitle'), 'aria-label': t('settingsTitle'),
            'aria-pressed': modal === 'settings' ? 'true' : 'false',
            onClick: function () { setModal(modal === 'settings' ? null : 'settings'); }
          }, h(Icon, { name: 'settings' }))));
      var ambient = h('div', { className: 'zp-ambient', 'aria-hidden': true }, h('i', null), h('i', null));

      /* ---------- 渲染：首页 ---------- */
      var renderHome = function () {
        var savedCount = library.length;
        var recentCount = history.length;
        var last = homeItems.filter(function (x) { return x.lastViewedAt; })[0];
        var stats = [];
        stats.push(h('span', { key: 's' }, h('b', null, String(savedCount)), ' ' + t('homeStatSavedBare')));
        stats.push(h('span', { key: 'r' }, h('b', null, String(recentCount)), ' ' + t('homeStatRecentBare')));
        if (last) stats.push(h('span', { key: 'l' }, t('homeStatLast').replace('{name}', last.name || t('defaultName')).replace('{time}', relTime(t, last.lastViewedAt))));
        return h('div', { className: 'zp-page', 'data-region': 'HOME' },
          h('div', { className: 'zp-page-inner' },
            h('section', { className: 'zp-home-hero' },
              h('div', { className: 'zp-hero-eyebrow' }, h(Icon, { name: 'sparkle', size: 13 }), t('homeEyebrow')),
              h('h1', { className: 'zp-hero-title' }, t('homeTitleA'), h('b', null, t('homeTitleB'))),
              h('div', { className: 'zp-hero-stats' }, stats),
              h('div', { className: 'zp-hero-actions' },
                h('button', { className: 'zp-pill is-primary', type: 'button', onClick: function () { openCreate('home'); } },
                  h(Icon, { name: 'newChat', size: 14 }), t('homeNew')),
                h('button', { className: 'zp-pill', type: 'button', onClick: computeSample },
                  h(Icon, { name: 'sparkle', size: 14 }), t('homeSample')))),
            homeItems.length
              ? h('div', null,
                h('div', { className: 'zp-section-head' },
                  h('h2', { className: 'zp-section-title' }, t('homeRecentTitle')),
                  h('span', { className: 'zp-section-meta' }, t('homeRecentMeta'))),
                h('div', { className: 'zp-chart-grid' },
                  homeItems.map(function (item) {
                    return h(ChartCard, {
                      key: item.key, t: t, item: item,
                      onOpen: function (it) { openInput(it.input); },
                      onToggleSave: function (it) {
                        if (it.saved && it.libId) persistLibrary(library.filter(function (x) { return x.id !== it.libId; }));
                        else toggleSaveInput(it.input, it.name || it.input.name);
                      },
                      onRemove: function (it) { removeHistoryItem(it); }
                    });
                  }),
                  h('button', { className: 'zp-chart-card-add', type: 'button', onClick: function () { openCreate('home'); } },
                    h(Icon, { name: 'newChat', size: 18 }), h('b', null, t('homeCardNew')))))
              : h('div', { style: { marginTop: 32 } },
                h('div', { className: 'zp-empty' },
                  h('div', { className: 'zp-empty-title' }, t('homeEmptyTitle')),
                  h('div', { className: 'zp-empty-hint' }, t('homeEmptyHint')),
                  h('div', { style: { marginTop: 16 } },
                    h('button', { className: 'zp-pill is-primary', type: 'button', onClick: function () { openCreate('home'); } },
                      h(Icon, { name: 'newChat', size: 14 }), t('homeNew')))))));
      };

      /* ---------- 渲染：新建命盘 ---------- */
      var renderCreate = function () {
        var items = [];
        [1, 2, 3, 4, 5].forEach(function (n) { items.push(h('li', { key: n }, h('span', null, '0' + n), t('createWhat' + n))); });
        return h('div', { className: 'zp-page', 'data-region': 'CREATE' },
          h('div', { className: 'zp-page-inner' },
            h('div', { className: 'zp-page-head is-stack' },
              h('button', { className: 'zp-icon-btn', type: 'button', title: t('readerBack'), 'aria-label': t('readerBack'), onClick: backFromCreate },
                h(Icon, { name: 'back' })),
              h('div', null,
                h('h1', { className: 'zp-page-title' }, createFrom === 'chart' ? t('chartEdit') : t('createTitle')),
                h('p', { className: 'zp-page-sub' }, t('createSub')))),
            h('div', { className: 'zp-create-grid' },
              h(BirthForm, {
                t: t, form: form, setForm: setForm, error: error,
                onSubmit: compute, onSample: computeSample,
                submitLabel: createFrom === 'chart' ? t('createSubmitEdit') : t('createSubmit')
              }),
              h('div', { className: 'zp-create-aside' },
                h('div', { className: 'zp-card' },
                  h('div', { className: 'zp-card-title' }, t('createWhat')),
                  h('ul', { className: 'zp-parts-list' }, items)),
                h('div', { className: 'zp-card' },
                  h('div', { className: 'zp-card-title' }, t('createAsideTitle')),
                  h('div', { className: 'zp-aside-note' },
                    h('div', null, t('note1')),
                    h('div', { style: { marginTop: 6 } }, t('note2'))))))));
      };

      /* ---------- 渲染：命盘页 ---------- */
      var renderChart = function () {
        if (!chart) return null;
        var palaceSelected = selected >= 0 ? chart.palaces[selected] : null;
        var curAge = nowPosition().currentAge;
        var currentDecadalIdx = -1;
        for (var ci = 0; ci < decadalList.length; ci++) {
          if (curAge >= decadalList[ci].ageRange[0] && curAge <= decadalList[ci].ageRange[1]) { currentDecadalIdx = ci; break; }
        }
        var timeNav = null;
        if (view === 'chart' && tab === 'decadal' && decadalList.length) {
          timeNav = h('div', { className: 'zp-time-nav', role: 'group', 'aria-label': t('tabDecadal') },
            h('button', { className: 'zp-time-btn', type: 'button', title: t('prevDecade'), 'aria-label': t('prevDecade'), disabled: selDecadal <= 0, onClick: function () { stepDecade(-1); } }, '‹'),
            h('select', {
              className: 'zp-time-select', value: String(selDecadal), 'aria-label': t('tabDecadal'),
              onChange: function (ev) { setSelDecadal(parseInt(ev.target.value, 10) || 0); }
            }, decadalList.map(function (dd, i) {
              return h('option', { key: i, value: String(i) }, dd.ageRange[0] + '–' + dd.ageRange[1] + ' 岁 · ' + dd.stem + dd.branch + ' · ' + dd.palaceName);
            })),
            h('button', { className: 'zp-time-btn', type: 'button', title: t('nextDecade'), 'aria-label': t('nextDecade'), disabled: selDecadal >= decadalList.length - 1, onClick: function () { stepDecade(1); } }, '›'),
            currentDecadalIdx >= 0 && selDecadal !== currentDecadalIdx
              ? h('button', { className: 'zp-time-now', type: 'button', title: t('backToCurrent'), onClick: function () { setSelDecadal(currentDecadalIdx); } }, t('backToCurrent'))
              : (currentDecadalIdx >= 0 ? h('span', { className: 'zp-time-chip' }, t('currentBadge')) : null));
        } else if (view === 'chart' && tab === 'yearly') {
          timeNav = h('div', { className: 'zp-time-nav', role: 'group', 'aria-label': t('tabYearly') },
            h('button', { className: 'zp-time-btn', type: 'button', title: t('prevYear'), 'aria-label': t('prevYear'), onClick: function () { stepYear(-1); } }, '‹'),
            h('input', {
              className: 'zp-time-input', type: 'number', min: 1900, max: 2100, value: yearlyYear,
              'aria-label': t('yearlyYear'),
              onChange: function (ev) { setYearlyYear(ev.target.value); }
            }),
            h('button', { className: 'zp-time-btn', type: 'button', title: t('nextYear'), 'aria-label': t('nextYear'), onClick: function () { stepYear(1); } }, '›'),
            String(yearNum()) === String(new Date().getFullYear())
              ? h('span', { className: 'zp-time-chip' }, t('currentBadge'))
              : h('button', { className: 'zp-time-now', type: 'button', title: t('thisYear'), onClick: function () { setYearlyYear(String(new Date().getFullYear())); } }, t('thisYear')));
        }
        var timebar = h('div', { className: 'zp-timebar', 'data-region': 'TIMEBAR' },
          view === 'chart'
            ? h('div', { className: 'zp-tabs', role: 'tablist', 'aria-label': t('timeScope') },
              [['natal', t('tabNatal')], ['decadal', t('tabDecadal')], ['yearly', t('tabYearly')]].map(function (md) {
                return h('button', {
                  key: md[0], type: 'button', role: 'tab', 'aria-selected': tab === md[0],
                  className: tab === md[0] ? 'on' : undefined,
                  onClick: function () { setTab(md[0]); }
                }, md[1]);
              }))
            : h('div', { className: 'zp-toolview-head', style: { marginBottom: 0 } },
              h('button', { className: 'zp-icon-btn', type: 'button', title: t('backToBoard'), 'aria-label': t('backToBoard'), onClick: function () { setView('chart'); } }, h(Icon, { name: 'back' })),
              h('span', { className: 'zp-toolview-title' }, view === 'patterns' ? t('openPatterns') : t('openDict'))),
          view === 'chart' ? timeNav : null,
          h('div', { className: 'zp-timebar-right' },
            view === 'chart' ? h('button', { className: 'zp-tool-btn', type: 'button', title: t('openPatterns'), onClick: function () { setView('patterns'); } }, t('openPatterns')) : null,
            view === 'chart' ? h('button', { className: 'zp-tool-btn', type: 'button', title: t('openDict'), onClick: function () { setView('dict'); } }, t('openDict')) : null,
            view === 'chart' ? h('button', {
              className: 'zp-tool-btn' + (showAdj ? ' on' : ''), type: 'button', 'aria-pressed': !!showAdj,
              title: showAdj ? t('hideAdj') : t('showAdj'), onClick: function () { setShowAdj(!showAdj); }
            }, h(Icon, { name: 'adj', size: 12 }), t('adjChip')) : null));
        var genderCn = (function () {
          var yearStem = (chart.pillars && chart.pillars.yearly) ? String(chart.pillars.yearly).charAt(0) : '甲';
          var yang = '甲丙戊庚壬'.indexOf(yearStem) >= 0;
          return (yang ? '阳' : '阴') + (form.gender === 'female' ? '女' : '男');
        })();
        var hero = h('section', { className: 'zp-chart-hero' },
          h('div', { className: 'zp-chart-id' },
            h('div', { className: 'zp-chart-eyebrow' }, t('tabNatal') + ' · ' + chart.fiveElementsClass + ' · ' + genderCn),
            h('h1', { className: 'zp-chart-title' }, form.name || t('defaultName'),
              h('small', null, chart.zodiac + '年 · ' + chart.timeName)),
            h('div', { className: 'zp-chart-meta' },
              h('span', { className: 'zp-chip' }, h('b', null, t('solarLabel')), ' ', chart.solarDate),
              h('span', { className: 'zp-chip' }, h('b', null, t('lunarLabel')), ' ', chart.lunar.year + '年' + chart.lunarText),
              [chart.pillars.yearly, chart.pillars.monthly, chart.pillars.daily, chart.pillars.hourly].map(function (pz, i) {
                return h('span', { key: 'p' + i, className: 'zp-chip is-gold' }, h('b', null, pz));
              }),
              h('span', { className: 'zp-chip' }, h('b', null, t('soul') + '/' + t('body')), ' ', chart.soulBranch + ' / ' + chart.bodyBranch),
              h('span', { className: 'zp-chip' }, h('b', null, t('startAge')), ' ', chart.startAge + ' 岁'))),
          h('div', { className: 'zp-chart-actions' },
            h('button', { className: 'zp-pill is-primary', type: 'button', onClick: function () { go('reading'); } },
              h(Icon, { name: 'sparkle', size: 14 }), t('chartInterpret')),
            h('button', { className: 'zp-pill', type: 'button', onClick: function () { toggleSaveInput(currentInput(), form.name); } },
              h(Icon, { name: 'star', size: 14 }), libraryIndexOf(currentInput()) >= 0 ? t('chartSaved') : t('chartSave')),
            h('button', { className: 'zp-pill is-quiet', type: 'button', onClick: function () { openCreate('chart'); } },
              h(Icon, { name: 'adj', size: 13 }), t('chartEdit')),
            h('button', { className: 'zp-icon-btn', type: 'button', title: t('copy'), 'aria-label': t('copy'), onClick: copyChart }, h(Icon, { name: 'copy' })),
            h('button', { className: 'zp-icon-btn', type: 'button', title: t('syncHint'), 'aria-label': t('sync'), onClick: syncToSession }, h(Icon, { name: 'sync' }))));
        var board = null;
        if (view === 'chart' && !(tab === 'yearly' && yearlyChart && yearlyChart.error)) {
          board = h('div', { className: 'zp-chart-board', tabIndex: 0, onKeyDown: onStageKeyDown },
            h('div', { className: 'zp-board-wrap' + (palaceSelected && tab === 'natal' ? ' has-detail' : ''), 'data-region': 'BOARD' },
              h('div', { className: 'zp-board' },
                h('div', { className: 'zp-grid' },
                  [3, 4, 5, 6, 2, 7, 1, 8, 0, 11, 10, 9].map(function (idx) {
                    return h(PalaceCell, {
                      key: idx,
                      palace: Object.assign({}, chart.palaces[idx], { isSoul: idx === chart.soulIndex }),
                      chart: chart, selected: selected === idx,
                      onSelect: function () { setSelected(idx); },
                      t: t, showAdj: showAdj, scope: scope, scopeBadges: scopeBadges
                    });
                  }),
                  h(CenterCell, { chart: chart, t: t, name: form.name }))),
              palaceSelected && tab === 'natal' ? h(PalaceDetail, {
                chart: chart,
                palace: Object.assign({}, palaceSelected, { isSoul: selected === chart.soulIndex }),
                t: t, onSelect: setSelected
              }) : null),
            palaceSelected && tab === 'decadal' ? h('div', { className: 'zp-kbd-hint' }, t('keyboardHint')) : null);
        }
        if (tab === 'yearly' && yearlyChart && yearlyChart.error) {
          board = h('div', { className: 'zp-error', style: { marginBottom: 12 } }, yearlyChart.error);
        }
        var toolpage = null;
        if (view === 'patterns') toolpage = h(PatternsView, { patterns: patterns, t: t });
        if (view === 'dict') toolpage = h(DictView, { t: t });
        return h('div', { className: 'zp-page', 'data-region': 'CHART' },
          h('div', { className: 'zp-page-inner' },
            hero,
            timebar,
            board,
            toolpage,
            view === 'chart' ? h('div', { className: 'zp-chart-info' },
              h(Summary, { chart: chart, t: t }),
              h(PatternsSummary, { patterns: patterns, t: t, onOpen: function () { setView('patterns'); } })) : null));
      };

      /* ---------- 渲染：解读页 ---------- */
      var renderReading = function () {
        if (!chart) return null;
        var ctxLine = scopeLabel ? ('当前视角 · ' + scopeLabel) : t('readingCtxIn');
        var tabs = h('div', { className: 'zp-reading-tabs' },
          h(Seg, {
            value: readingTab,
            options: [
              { value: 'chat', label: t('readingTabChat') },
              { value: 'dock', label: t('readingTabDock') + (report.status === 'done' ? ' ·' : '') }
            ],
            onChange: setReadingTab
          }));
        return h('div', { className: 'zp-reading', 'data-tab': readingTab },
          tabs,
          h(ChatPane, {
            t: t, thread: thread, streaming: chatting, thinkChars: thinkChars,
            error: interpError, issue: interpIssue,
            ctxLine: ctxLine,
            copied: copied,
            onBack: function () { go('chart'); },
            onHandoff: handoffToSession,
            onNewChat: newChat,
            onAsk: runChat,
            onStop: stopChat,
            onContinue: continueChat,
            onCopyAnswer: copyAnswer,
            onGenerateReport: generateReport,
            reportRunning: report.status === 'running',
            chatRunning: chatting
          }),
          h(ReportDock, {
            t: t, report: report, copied: reportCopied,
            chatRunning: chatting,
            onGenerate: generateReport,
            onStop: stopReport,
            onContinue: continueReport,
            onRetry: regenerateReport,
            onRead: function () { setPage('report'); },
            onExport: exportReportHtml,
            onCopy: copyReport
          }));
      };

      /* ---------- 渲染：报告阅读页 ---------- */
      var renderReport = function () {
        if (!(report.status === 'done' && report.text && reportHtml)) {
          return h('div', { className: 'zp-page', 'data-region': 'READER' },
            h('div', { className: 'zp-page-inner' },
              h('div', { className: 'zp-empty', style: { marginTop: 40 } },
                h('div', { className: 'zp-empty-title' }, t('reportEmpty')),
                h('div', { className: 'zp-empty-hint' }, t('dockIdleLead')),
                h('div', { style: { marginTop: 16 } },
                  h('button', { className: 'zp-pill is-primary', type: 'button', onClick: function () { setPage('reading'); } }, t('readerBack'))))));
        }
        return h(ReaderPage, {
          t: t, html: reportHtml, text: report.text,
          name: form.name || t('defaultName'),
          finishedAt: report.finishedAt,
          copied: reportCopied,
          onBack: function () { setPage('reading'); },
          onExport: exportReportHtml,
          onCopy: copyReport
        });
      };

      var body = null;
      if (page === 'home') body = renderHome();
      else if (page === 'create') body = renderCreate();
      else if (page === 'chart') body = renderChart();
      else if (page === 'reading') body = renderReading();
      else if (page === 'report') body = renderReport();
      else body = renderHome();

      return h('div', {
        className: 'zp-root', ref: rootRef,
        'data-w': layoutMode,
        'data-page': page,
        'data-chart': chart ? '1' : undefined
      },
        ambient,
        topbar,
        body,
        modal === 'settings' ? h(SettingsModal, {
          t: t,
          autoOpen: autoOpen, setAutoOpen: setAutoOpen,
          showAdj: showAdj, setShowAdj: setShowAdj,
          onClose: function () { setModal(null); }
        }) : null);
    }

    /* ---------------- 默认表单 ---------------- */
    const DEFAULT_FORM = {
      name: '', calendar: 'solar', year: 1990, month: 6, day: 15,
      isLeap: false, hour: 15, minute: 30, gender: 'male',
      longitude: '', place: '', occupation: '',
      /* dayDivide 默认 current（按当日），与紫微师/独立版 iztro runner 一致 */
      settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
    };

    /* ---------------- 错误边界 ---------------- */
    class Boundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) {
        return { error: error };
      }
      render() {
        if (this.state.error) {
          var err = this.state.error;
          return h('div', { className: 'zp-card', style: { margin: 16 } },
            h('div', { className: 'zp-error' }, '界面渲染异常：' + String((err && err.message) || err)),
            h('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginTop: 8 } }, '请把这行错误信息发给开发者。'),
            h('button', { className: 'zp-btn', type: 'button', style: { marginTop: 10 }, onClick: () => this.setState({ error: null }) }, '重试'));
        }
        return this.props.children;
      }
    }

    /* ---------------- 挂载 ---------------- */
    return {
      inject: ['slots', 'sessions', 'uiWorkspace'],
      apply(ctx) {
        /* 普通 client bundle 没有 `styles` 内建（dynamic runner 才有），统一用 <style> 注入；
           注册在 ctx.effect 里，插件卸载时移除（官方模板同样把样式作为插件拥有的资源）。 */
        var disposeStyle = function () { };
        {
          var el = document.createElement('style');
          el.textContent = CSS;
          document.head.appendChild(el);
          disposeStyle = function () { if (el && el.parentNode) el.parentNode.removeChild(el); };
        }

        var layout = null;
        try { layout = ctx.get && ctx.get('layout'); } catch (e) { layout = null; }
        /* 客户端导航: 让 GUI 选中新会话（服务不可用时静默降级） */
        var openSession = function (sessionId) {
          if (!sessionId) return false;
          try {
            var svc = ctx.get && ctx.get('uiWorkspace');
            if (svc && typeof svc.openSession === 'function') { svc.openSession(sessionId); return true; }
          } catch (e) { /* 降级 */ }
          return false;
        };

        var autoOpenPanel = function () {
          try {
            if (layout && typeof layout.selectPanel === 'function') layout.selectPanel('ziwei');
          } catch (e) { /* ignore */ }
        };

        /* 面板显式出口: 返回会话。
         * 官方语义见 @deepseek-ai/dsh-client-ui-layout README:
         *   ctx.layout.selectPanel(id) 选中已注册的主面板；
         *   selectPanel(null) 选中 Conversation 且不切换当前 Session。
         * 布局服务缺失（例如纯 Web 预览）时不渲染该按钮，面板其余功能不受影响。 */
        var canReturnToConversation = !!(layout && typeof layout.selectPanel === 'function');
        var returnToConversation = function () {
          if (!canReturnToConversation) return false;
          try { layout.selectPanel(null); return true; } catch (e) { /* 降级: 保持当前面板 */ }
          return false;
        };

        /* 语言：按官方规范走 Client locale 服务。
         * - register(namespace, { zh, en }) 把本插件的双语字典登记进宿主；
         * - bind(namespace) 返回随当前语言即时切换的 t()；
         * - 服务缺失（旧宿主 / 非 Web 组合）时退回内置 zh 字典，面板仍可用。 */
        var t = function (k) { return DICT['zh-CN'][k] !== undefined ? DICT['zh-CN'][k] : k; };
        try {
          var locale = ctx.get && ctx.get('locale');
          if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
            var disposeLocale = locale.register('ziwei', { zh: DICT['zh-CN'], en: DICT['en-US'] });
            if (typeof disposeLocale === 'function' && typeof ctx.effect === 'function') {
              ctx.effect(function () { return disposeLocale; }, 'ziwei-workbench: locale dictionaries');
            }
            t = locale.bind('ziwei');
          }
        } catch (e) { /* 回退内置字典 */ }


        /* ---- 鲲鹏精装报告 HTML ---- */
        var REPORT_CSS = ":root{--bg:#FAF6EF;--bg-card:#F4EFE5;--text:#2A2A2A;--text-sub:#666;--accent:#7C5C3C;--accent-lt:#9C6B47;--accent-dim:#C4A882;--border:#E8DDC8;--warn:#B85A3D;--white:#FEFCF8;--font-serif:\"Songti SC\",\"STSong\",\"Source Han Serif CN\",\"Noto Serif CJK SC\",Georgia,serif;--font-sans:\"PingFang SC\",\"Hiragino Sans GB\",\"Microsoft YaHei\",system-ui,sans-serif}@page{size:A4;margin:18mm 22mm}body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-serif);font-size:11pt;line-height:1.9}.page-wrap{max-width:210mm;margin:0 auto;padding:14mm 16mm}h1,h2,h3{font-family:var(--font-sans);color:var(--accent);font-weight:600}h2{font-size:15pt;border-bottom:1px solid var(--accent-dim);padding-bottom:.3em;margin-top:2em}h3{font-size:12.5pt;margin-top:1.4em}.body-text{text-indent:2em;text-align:justify}.quote-block{margin:1em 0;padding:.6em 1em;border-left:3px solid var(--accent-dim);background:var(--bg-card);color:var(--text-sub)}.highlight-box{margin:1em 0;padding:.8em 1em;background:var(--bg-card);border-left:4px solid var(--accent)}.warn-block{margin:1em 0;padding:.8em 1em;border:1px solid var(--warn);border-left:4px solid var(--warn);color:#7A3A24}.kw{display:inline-block;padding:0 .45em;margin:0 .1em;background:var(--accent);color:var(--white);font-size:.82em;border-radius:2px;font-family:var(--font-sans)}.palace-card{margin:.8em 0;padding:.8em 1em;background:var(--white);border:1px solid var(--border);border-radius:4px}.p-palace-name{font-family:var(--font-sans);color:var(--accent);font-weight:600}.p-stars{margin:.2em 0;color:var(--accent-lt)}.p-note{font-size:.85em;color:var(--text-sub)}.info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.6em;margin:1em 0}.info-cell{background:var(--white);border:1px solid var(--border);padding:.5em .7em;font-size:.95em}.info-cell span{display:block;color:var(--text-sub);font-size:.8em;font-family:var(--font-sans)}.pc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:var(--accent-dim);border:2px solid var(--accent);margin:1.5em 0}.pc-cell{background:var(--white);padding:.5em;min-height:4.2em;font-size:.9em}.pc-center{grid-column:2/4;grid-row:2/4;background:var(--bg-card);padding:1em;text-align:center;font-size:.95em}.p-ganzhi{color:var(--text-sub);font-size:.8em}.p-sihua{display:inline-block;font-size:.75em;color:var(--warn);border:1px solid var(--warn);padding:0 .3em;border-radius:50%;margin-left:.25em}.path-steps{display:flex;gap:.8em;margin:1em 0}.path-step{flex:1;background:var(--white);border:1px solid var(--accent-dim);border-top:3px solid var(--accent);padding:.7em;font-size:.9em}.cover{background:var(--accent);color:var(--white);text-align:center;padding:52mm 0 12mm;margin:-14mm -16mm 10mm}.p-center-title{font-family:var(--font-sans);font-size:34pt;letter-spacing:.35em;text-indent:.35em}.p-center-sub{margin-top:1.2em;color:var(--accent-dim);letter-spacing:.2em}.cover-band{margin-top:20mm;font-size:10pt;color:var(--bg-card)}.disclaimer{margin-top:2em;padding:.8em 1em;background:#EEE9DE;color:var(--text-sub);font-size:.9em}.colophon{margin-top:3em;text-align:center;color:var(--text-sub);font-size:.85em}.seal{display:inline-block;border:2px solid var(--warn);color:var(--warn);padding:.3em .5em;font-family:var(--font-sans);letter-spacing:.15em;transform:rotate(-4deg)}h4{font-family:var(--font-sans);color:var(--accent);font-weight:600;font-size:11.5pt;margin-top:1.4em}.md-table{width:100%;border-collapse:collapse;margin:1.1em 0;font-size:10.5pt;line-height:1.65}.md-table th,.md-table td{border:1px solid var(--border);padding:.45em .6em;vertical-align:top;text-align:left;word-break:break-word}.md-table th{background:var(--bg-card);font-family:var(--font-sans);font-weight:600;color:var(--accent)}.md-table tr{page-break-inside:avoid;break-inside:avoid}hr{border:none;border-top:1px solid var(--accent-dim);margin:1.8em 0}h2,h3,h4{page-break-after:avoid;break-after:avoid}.pc-grid,.info-grid{page-break-inside:avoid;break-inside:avoid}ul,ol{margin:.8em 0;padding-left:1.8em}li{margin:.3em 0}code{padding:.1em .35em;background:var(--bg-card);border-radius:2px;font-family:var(--font-sans);font-size:.92em}";
        var escHtml = function (t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
        /* 报告正文的极小 markdown：标题 / 加粗 / 引用 / 列表 / 管道表格 / 分隔线 / 段落。
           先转义再上标记；只放行 <br>，其它 HTML 不允许直通。 */
        var mdInline = function (t) {
          return escHtml(t)
            .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
        };
        var mdSplitRow = function (line) {
          var s = String(line).trim();
          if (s.charAt(0) === '|') s = s.slice(1);
          if (s.charAt(s.length - 1) === '|') s = s.slice(0, -1);
          return s.split('|').map(function (c) { return c.trim(); });
        };
        var mdIsTableSep = function (line) {
          if (String(line).indexOf('|') < 0) return false;
          var cells = mdSplitRow(line);
          if (!cells.length) return false;
          for (var i = 0; i < cells.length; i++) {
            if (!/^:?-{1,}:?$/.test(cells[i])) return false;
          }
          return true;
        };
        var mdAlignOf = function (cell) {
          var left = cell.charAt(0) === ':';
          var right = cell.charAt(cell.length - 1) === ':';
          if (left && right) return 'center';
          if (right) return 'right';
          if (left) return 'left';
          return '';
        };
        var mdTableHtml = function (header, aligns, rows, cls) {
          var th = header.map(function (c, i) {
            return '<th' + (aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '') + '>' + mdInline(c) + '</th>';
          }).join('');
          var body = rows.map(function (row) {
            var tds = [];
            for (var i = 0; i < header.length; i++) {
              tds.push('<td' + (aligns[i] ? ' style="text-align:' + aligns[i] + '"' : '') + '>' + mdInline(row[i] || '') + '</td>');
            }
            return '<tr>' + tds.join('') + '</tr>';
          }).join('');
          return '<table class="' + (cls || 'md-table') + '"><thead><tr>' + th + '</tr></thead>' +
            (body ? '<tbody>' + body + '</tbody>' : '') + '</table>';
        };
        var mdToHtml = function (md) {
          var lines = String(md || '').split('\n');
          var out = [];
          var inList = null;
          var flush = function () { if (inList) { out.push('</' + inList + '>'); inList = null; } };
          for (var i = 0; i < lines.length; i++) {
            var trimmed = lines[i].trim();
            if (!trimmed) { flush(); continue; }
            /* 管道表格：当前行以 | 开头、下一行是分隔行；行数按表头列数收口 */
            if (trimmed.charAt(0) === '|' && i + 1 < lines.length && mdIsTableSep(lines[i + 1])) {
              flush();
              var header = mdSplitRow(trimmed);
              var aligns = mdSplitRow(lines[i + 1]).map(mdAlignOf);
              var rows = [];
              var j = i + 2;
              while (j < lines.length && lines[j].trim().charAt(0) === '|' && !mdIsTableSep(lines[j])) {
                rows.push(mdSplitRow(lines[j]));
                j++;
              }
              out.push(mdTableHtml(header, aligns, rows));
              i = j - 1;
              continue;
            }
            var h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
            if (h) { flush(); var lv = Math.min(4, h[1].length + 1); out.push('<h' + lv + '>' + mdInline(h[2]) + '</h' + lv + '>'); continue; }
            if (/^([-*_])\1{2,}$/.test(trimmed)) { flush(); out.push('<hr>'); continue; }
            var q = /^>\s?(.*)$/.exec(trimmed);
            if (q) { flush(); out.push('<blockquote class="quote-block">' + mdInline(q[1]) + '</blockquote>'); continue; }
            var li = /^[-*•]\s+(.*)$/.exec(trimmed);
            if (li) { if (inList !== 'ul') { flush(); out.push('<ul>'); inList = 'ul'; } out.push('<li>' + mdInline(li[1]) + '</li>'); continue; }
            var num = /^\d+[.)]\s+(.*)$/.exec(trimmed) || /^\d+、\s*(.*)$/.exec(trimmed);
            if (num) { if (inList !== 'ol') { flush(); out.push('<ol>'); inList = 'ol'; } out.push('<li>' + mdInline(num[1]) + '</li>'); continue; }
            flush();
            out.push('<p class="body-text">' + mdInline(trimmed) + '</p>');
          }
          flush();
          return out.join('\n');
        };
        /* 抽屉回答用同一套表格解析，但保留 .zp-md-* 的对话排版（div 结构，不引入 h 标签） */
        var mdToChatHtml = function (md) {
          var lines = String(md || '').split('\n');
          var out = [];
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/\s+$/, '');
            if (!line.trim()) { out.push('<div class="zp-md-gap"></div>'); continue; }
            var trimmed = line.trim();
            if (/^([-*_])\1{2,}$/.test(trimmed)) { out.push('<hr>'); continue; }
            if (trimmed.charAt(0) === '|' && i + 1 < lines.length && mdIsTableSep(lines[i + 1])) {
              var header = mdSplitRow(trimmed);
              var aligns = mdSplitRow(lines[i + 1]).map(mdAlignOf);
              var rows = [];
              var j = i + 2;
              while (j < lines.length && lines[j].trim().charAt(0) === '|' && !mdIsTableSep(lines[j])) {
                rows.push(mdSplitRow(lines[j]));
                j++;
              }
              out.push(mdTableHtml(header, aligns, rows, 'zp-md-table'));
              i = j - 1;
              continue;
            }
            var hm = /^(#{1,4})\s+(.*)$/.exec(line);
            if (hm) { out.push('<div class="zp-md-h zp-md-h' + hm[1].length + '">' + mdInline(hm[2]) + '</div>'); continue; }
            var qm = /^>\s?(.*)$/.exec(line);
            if (qm) { out.push('<div class="zp-md-quote">' + mdInline(qm[1]) + '</div>'); continue; }
            var lm = /^\s*([-*]|\d+[.)])\s+(.*)$/.exec(line);
            if (lm) { out.push('<div class="zp-md-li">· ' + mdInline(lm[2]) + '</div>'); continue; }
            out.push('<div class="zp-md-p">' + mdInline(line) + '</div>');
          }
          return out.join('');
        };
        var buildReportHtml = function (meta, reportText) {
          var c = meta.chart;
          var today = new Date();
          var ymd = today.getFullYear() + ('0' + (today.getMonth() + 1)).slice(-2) + ('0' + today.getDate()).slice(-2);
          var name = meta.name || '命主';
          /* 阳/阴由年干决定（甲丙戊庚壬为阳），只看性别会有一半标错 */
          var yearStem = (c.pillars && c.pillars.yearly) ? String(c.pillars.yearly).charAt(0) : '甲';
          var yang = '甲丙戊庚壬'.indexOf(yearStem) >= 0;
          var genderCn = (yang ? '阳' : '阴') + (meta.gender === 'female' ? '女' : '男');
          /* 自动排布按行流填坑：中宫固定占 2/4 行列，其余必须按环序给出，
             否则 9/12 个宫会落到错误位置（旧顺序 2,1,0,11,10,9,7,8 就是错的） */
          var order = [3, 4, 5, 6, 'center', 2, 7, 1, 8, 0, 11, 10, 9];
          var sihua = { '禄': '禄', '权': '权', '科': '科', '忌': '忌' };
          var cellsHtml = order.map(function (o) {
            if (o === 'center') {
              return '<div class="pc-center"><div style="font-weight:600">' + escHtml(name) + '</div>' +
                '<div style="margin-top:.4em">' + escHtml(c.fiveElementsClass + ' · ' + c.zodiac) + '</div>' +
                '<div>命主 ' + escHtml(c.soulMaster) + ' · 身主 ' + escHtml(c.bodyMaster) + '</div>' +
                '<div>起运 ' + c.startAge + ' 岁</div></div>';
            }
            var p = c.palaces[o];
            var stars = p.major.map(function (st) {
              return escHtml(st.name + (st.brightness ? '(' + st.brightness + ')' : '')) +
                (st.mutagen ? '<span class="p-sihua">' + sihua[st.mutagen] + '</span>' : '');
            }).join(' ');
            return '<div class="pc-cell"><div class="p-palace-name">' + escHtml(p.name) + (p.isBody ? '·身' : '') + '</div>' +
              '<div class="p-ganzhi">' + escHtml(p.stem + p.branch) + '</div>' +
              '<div class="p-stars">' + stars + '</div></div>';
          }).join('');
          var solarLine = c.meta && c.meta.solarCorrection
            ? c.solarDate + ' ' + c.meta.solarCorrection.solarTime + '（真太阳时，经度 ' + c.meta.solarCorrection.longitude + '°E）'
            : c.solarDate + '（未做真太阳时校正）';
          return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>人生鲲鹏计划 · ' + escHtml(name) + '</title><style>' + REPORT_CSS + '</style></head><body><div class="page-wrap">' +
            '<div class="cover"><div class="p-center-title">人生鲲鹏计划</div>' +
            '<div class="p-center-sub">LifeView · 人生画板 · 紫微人生规划报告</div>' +
            '<div class="cover-band">' + escHtml(c.fiveElementsClass + ' · ' + c.zodiac + '年生 · 报告日期 ' + today.getFullYear() + ' 年 ' + (today.getMonth() + 1) + ' 月') + '</div></div>' +
            '<div class="info-grid">' +
            '<div class="info-cell"><span>称呼</span>' + escHtml(name) + '</div>' +
            '<div class="info-cell"><span>阳历</span>' + escHtml(solarLine) + '</div>' +
            '<div class="info-cell"><span>农历</span>' + escHtml(c.lunar.year + '年' + c.lunarText + ' ' + c.timeName) + '</div>' +
            '<div class="info-cell"><span>五行局</span>' + escHtml(c.fiveElementsClass) + '</div>' +
            '<div class="info-cell"><span>性别</span>' + genderCn + '</div>' +
            '<div class="info-cell"><span>籍贯</span>' + escHtml(meta.place || '未提供') + '</div>' +
            '<div class="info-cell"><span>职业</span>' + escHtml(meta.occupation || '未提供') + '</div>' +
            '<div class="info-cell"><span>命宫/身宫</span>' + escHtml(c.soulBranch + ' / ' + c.bodyBranch) + '</div></div>' +
            '<div class="pc-grid">' + cellsHtml + '</div>' +
            mdToHtml(reportText) +
            '<div class="disclaimer">本报告基于中华传统文化（紫微斗数）体系生成，非现代科学结论，仅供参考，不构成医疗 / 法律 / 金融 / 婚姻等专业领域的决策依据。</div>' +
            '<div class="colophon"><span class="seal">LifeView</span><div style="margin-top:.6em">紫微师 · 人生画板 · ' + ymd + '</div></div>' +
            '</div></body></html>';
        };
        /* 报告渲染是纯函数：暴露给自检与无头预览（与 window.ZWEngine / ZWCore 同一形态） */
        try {
          if (typeof window !== 'undefined') {
            window.ZWReport = { REPORT_CSS: REPORT_CSS, escHtml: escHtml, mdToHtml: mdToHtml, mdToChatHtml: mdToChatHtml, buildReportHtml: buildReportHtml };
          }
        } catch (e) { /* 非浏览器环境忽略 */ }

        /* 侧栏入口 (id 即主面板 key) */
        var PanelIcon = function () {
          return h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': true },
            h('circle', { cx: 12, cy: 12, r: 10.2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, opacity: 0.55 }),
            h('circle', { cx: 12, cy: 12, r: 4.6, fill: '#8b5cf6' }),
            h('path', { d: 'M12 6.6 L13.6 10.4 L17.4 12 L13.6 13.6 L12 17.4 L10.4 13.6 L6.6 12 L10.4 10.4 Z', fill: '#fff' }),
            h('circle', { cx: 17.8, cy: 6.2, r: 1.1, fill: 'currentColor', opacity: 0.8 }));
        };
        ctx.slots.inject('sidebar.panellist', function () {
          return ctx.slots.register({
            name: 'sidebar.panellist',
            id: 'ziwei',
            order: 20,
            label: function () { return t('brand') + ' ' + t('brandPro'); }
          }, PanelIcon);
        });

        ctx.slots.inject('main', function () {
          return ctx.slots.register({
            name: 'main',
            key: 'ziwei'
          }, function () {
            return h(Boundary, null, h(ProApp, {
              t: t,
              actions: {
                buildReportHtml: buildReportHtml,
                openSession: openSession,
                autoOpenPanel: autoOpenPanel,
                returnToConversation: returnToConversation,
                canReturnToConversation: canReturnToConversation
              }
            }));
          });
        });

        ctx.effect(function () { return disposeStyle; }, 'ziwei-workbench: styles');
      }
    };
  }
});
