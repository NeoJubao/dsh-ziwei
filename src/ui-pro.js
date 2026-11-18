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
        aiSend: '发送', aiNewChat: '新对话', aiAskPh: '问事业、财运、大限…（Enter 发送）',
        aiStartBrief: '速览解读', aiStartReport: '完整鲲鹏报告',
        aiStartBriefDesc: '命格总纲与当前大限，几分钟读完',
        aiStartReportDesc: '14 个部分，可导出精装 HTML',
        aiFullReport: '完整报告', aiFullReportHint: '基于当前命盘生成完整鲲鹏报告（14 部分）',
        aiEmptyLead: '命盘已带入', aiEmptyHint: '直接提问，或先看一份解读。',
        viewMode: '工作台视图', modeChart: '看盘', modeRead: '解读',
        studioChatLabel: '紫微师对话', studioTabs: '解读面板', studioChatTab: '对话', studioReportTab: '报告', studioEmptyTitle: '说一句话，把这盘读懂。',
        studioEmptyHint: '可以直接问，也可以先看一份解读；命盘和对话会一起保留。',
        studioWaitPh: '正在生成，先等这一轮写完…',
        canvasTabs: '画布视图', canvasChart: '盘面', canvasReport: '报告',
        reportTitle: '人生鲲鹏计划 · 完整报告', reportOpen: '查看完整报告',
        reportRunningHint: '完整报告正在画布生成，写完会自动保存。',
        reportWriting: '正在写完整报告', reportPaused: '报告生成中断',
        reportProgressMeta: '已完成 {n}/{total} 部分 · {chars} 字',
        reportCurrent: '正在写第 {n} 部分 · {name}', reportToc: '报告目录',
        reportQuoteLabel: '报告选段', reportQuoteAction: '让紫微师改这段',
        reportIdleTitle: '把这盘读成一份完整报告。',
        reportIdleHint: '14 个部分：命盘总览、性格、家庭、婚姻、财富、事业、大限与综合建议。约 2–3 分钟。',
        reportGenerate: '生成完整报告', reportRegenerate: '重新生成',
        reportFinePrint: '报告会保存在本机，可随时回来继续读；导出 HTML 后可离线阅读。',
        reportError: '报告生成中断', reportErrorHint: '已生成的部分会保留；可以接着写，或重新生成。',
        reportPartial: '报告已生成的部分保留；可以继续生成补齐。',
        reportReader: '全屏阅读', reportNeeded: '先生成完整报告',
        fullscreen: '全屏', exitFullscreen: '退出全屏',
        quoteRemove: '取消引用', quotePalaceLabel: '当前宫位', quotePalace: '引用宫位',
        suggestCareer: '重点讲事业与财运', suggestLove: '这十年感情要注意什么',
        suggestPlain: '说得再口语一点', suggestPalace: '解释一下当前宫位',
        copyFailed: '复制失败，请手动选择文本', syncFailed: '写入会话失败',
        exported: '已导出 HTML', exportFailed: '导出失败',
        aiThreadCleared: '已清空对话', aiRecordCleared: '已清除本机解读记录',
        localDataTitle: '本机数据', localDataHint: '命盘、对话与报告只存在这个浏览器里；清除后不可恢复。',
        clearLocal: '清除本机解读记录', clearLocalConfirm: '确定清除？命盘库会保留。',
        confirmClear: '确定清除', cancel: '取消', undo: '撤销',
        sampleChart: '示例盘', switchToMyBirth: '换成我的生辰', libDeleted: '已删除命盘', undoDone: '已撤销',
        reportSec01: '命盘总览', reportSec02: '性格大略', reportSec03: '家庭关系', reportSec04: '婚姻情感',
        reportSec05: '子女培育', reportSec06: '财富管理', reportSec07: '健康养生', reportSec08: '事业发展',
        reportSec09: '朋友贵人', reportSec10: '居家风水', reportSec11: '心灵福德', reportSec12: '出行迁移',
        reportSec13: '大限节奏', reportSec14: '综合建议',
        timeScope: '命盘时间维度', backToBoard: '返回盘面',
        prevDecade: '上一个大限', nextDecade: '下一个大限', backToCurrent: '回到当前',
        currentBadge: '当前', thisYear: '今年', prevYear: '上一年', nextYear: '下一年',
        collapseRail: '收起生辰栏', expandRail: '展开生辰栏', editBirthShort: '生辰',
        chartTools: '工具', openPatterns: '格局分析', openDict: '星曜词典',
        handoff: '新会话解读', handoffDone: '已开新会话 ✓',
        handoffHint: '把当前命盘交给会话；之后在对话里说「继续聊这个盘」或「写鲲鹏报告」即可',
        disclaimerShort: '传统文化解读，非科学结论，仅供参考。具体决策请咨询专业人士。',
        aiInterpreting: '解读中…', interpStreaming: '正在生成…',
        aiThinking: '紫微师正在思考…', aiStop: '停止', aiContinue: '继续生成',
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
        signature: '紫微师 · 金聚｜道商意象紫微九诀',
        contactWechat: '微信：neo2025new',
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
        aiSend: 'Send', aiNewChat: 'New chat', aiAskPh: 'Ask about career, money, decades… (Enter)',
        aiStartBrief: 'Quick reading', aiStartReport: 'Full Kunpeng report',
        aiStartBriefDesc: 'Core profile and current decade, a few minutes',
        aiStartReportDesc: '14 parts, exportable to HTML',
        aiFullReport: 'Full report', aiFullReportHint: 'Generate the full 14-part Kunpeng report for this chart',
        aiEmptyLead: 'Chart ready', aiEmptyHint: 'Ask directly, or start with a reading.',
        viewMode: 'Workbench view', modeChart: 'Chart', modeRead: 'Reading',
        studioChatLabel: 'Zi Wei chat', studioTabs: 'Reading panel', studioChatTab: 'Chat', studioReportTab: 'Report', studioEmptyTitle: 'Say one thing, and we read the chart.',
        studioEmptyHint: 'Ask directly, or start with a reading. The chart and conversation stay together.',
        studioWaitPh: 'Generating — wait for this turn to finish…',
        canvasTabs: 'Canvas view', canvasChart: 'Chart', canvasReport: 'Report',
        reportTitle: 'Life Kunpeng Plan · Full Report', reportOpen: 'Open full report',
        reportRunningHint: 'The full report is being written on the canvas; it saves when done.',
        reportWriting: 'Writing the full report', reportPaused: 'Report paused',
        reportProgressMeta: '{n}/{total} sections · {chars} chars',
        reportCurrent: 'Writing section {n} · {name}', reportToc: 'Report contents',
        reportQuoteLabel: 'Report excerpt', reportQuoteAction: 'Ask Zi Wei to revise this',
        reportIdleTitle: 'Turn this chart into a full report.',
        reportIdleHint: '14 sections: overview, character, family, marriage, wealth, career, decades and advice. About 2–3 minutes.',
        reportGenerate: 'Generate full report', reportRegenerate: 'Regenerate',
        reportFinePrint: 'The report is stored locally and can be reopened; export HTML for offline reading.',
        reportError: 'Report generation interrupted', reportErrorHint: 'The partial report is kept; continue or regenerate.',
        reportPartial: 'The partial report is kept; continue to fill the rest.',
        reportReader: 'Full screen', reportNeeded: 'Generate the full report first',
        fullscreen: 'Full screen', exitFullscreen: 'Exit full screen',
        quoteRemove: 'Remove quote', quotePalaceLabel: 'Current palace', quotePalace: 'Quote palace',
        suggestCareer: 'Focus on career and money', suggestLove: 'What to watch in love this decade',
        suggestPlain: 'Make it more conversational', suggestPalace: 'Explain the current palace',
        copyFailed: 'Copy failed — select the text manually', syncFailed: 'Write to session failed',
        exported: 'HTML exported', exportFailed: 'Export failed',
        aiThreadCleared: 'Conversation cleared', aiRecordCleared: 'Local reading records cleared',
        localDataTitle: 'Local data', localDataHint: 'Charts, conversations and reports live only in this browser. Clearing cannot be undone.',
        clearLocal: 'Clear local reading records', clearLocalConfirm: 'Clear now? Saved charts are kept.',
        confirmClear: 'Clear', cancel: 'Cancel', undo: 'Undo',
        sampleChart: 'Sample chart', switchToMyBirth: 'Use my birth data', libDeleted: 'Chart deleted', undoDone: 'Undone',
        reportSec01: 'Chart overview', reportSec02: 'Character', reportSec03: 'Family', reportSec04: 'Marriage',
        reportSec05: 'Children', reportSec06: 'Wealth', reportSec07: 'Health', reportSec08: 'Career',
        reportSec09: 'Mentors & friends', reportSec10: 'Home', reportSec11: 'Inner life', reportSec12: 'Travel & moves',
        reportSec13: 'Decade rhythm', reportSec14: 'Advice',
        timeScope: 'Time scope', backToBoard: 'Back to chart',
        prevDecade: 'Previous decade', nextDecade: 'Next decade', backToCurrent: 'Back to current',
        currentBadge: 'Current', thisYear: 'This year', prevYear: 'Previous year', nextYear: 'Next year',
        collapseRail: 'Collapse birth panel', expandRail: 'Expand birth panel', editBirthShort: 'Birth data',
        chartTools: 'Tools', openPatterns: 'Patterns', openDict: 'Star dictionary',
        handoff: 'New session', handoffDone: 'Session opened ✓',
        handoffHint: 'Hand this chart to the session so the agent can continue the reading.',
        disclaimerShort: 'Traditional interpretation, not a scientific conclusion. Consult a professional for decisions.',
        aiInterpreting: 'Reading…', interpStreaming: 'Writing…',
        aiThinking: 'Zi Wei Master is thinking…', aiStop: 'Stop', aiContinue: 'Continue',
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
        signature: 'Zi Wei Master · Jin Ju｜Daoshang Yixiang Ziwei Nine Keys',
        contactWechat: 'WeChat: neo2025new',
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
    const CSS = `
/* ================================================================
 * 设计系统 v2
 * - 所有底色/边框/文字只走 --dsw-alias-* token；星曜/四化等内容色单列
 * - 命盘盘面优先占宽: 布局按面板实测宽度切换 (data-w)，不再用 viewport media query
 * - 盘面字号用容器查询单位 (cqw) 随盘宽等比缩放，窄面板下不挤字
 * - 支持深色主题 (body[data-ds-dark-theme]) 与专注看盘 (data-focus)
 * ================================================================ */
.zp-root {
  --zp-accent: #7c5cf0;
  --zp-accent-deep: #5b3fd6;
  --zp-fill-accent: #7c5cf0;
  --zp-fill-accent-deep: #5b3fd6;
  --zp-gold: #c9a35c;
  --zp-gold-dim: #8a7550;
  --zp-mu-lu: #15803d;
  --zp-mu-quan: #1d4ed8;
  --zp-mu-ke: #a16207;
  --zp-mu-ji: #b91c1c;
  --zp-good: #15803d;
  --zp-bad: #b91c1c;
  --zp-board-max: 720px;
  position: relative;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsh-font-family-text-default, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", sans-serif);
  -webkit-font-smoothing: antialiased;
  scrollbar-width: thin;
  /* 把面板内部的 z-index（sticky 头 z20、浮层 z100）关进本面板自己的层叠上下文：
     frame 的 shell.leading（z-index 15，侧栏折叠后的「展开侧栏 / 新会话」出口）
     是 frame 的直接子元素，不能再被面板内部的高 z-index 盖住或抢走点击。 */
  isolation: isolate;
}

/* ---------------- 窗口 chrome 避让（macOS 桌面端） ----------------
 * 契约见 @deepseek-ai/dsh-client-ui-layout README「Window-chrome seat」：
 * - html[data-platform=darwin] 发布 --dsh-frame-top-clearance（48px），入口页要把内容压到窗口标题带之下；
 * - 侧栏完全隐藏时 frame 追加发布 --dsh-frame-leading-clearance（160px，全屏 84px），
 *   此时面板左缘即窗口左缘，左上角必须让出 traffic lights + leading 控件的横向条带；
 * - 浮层用 --dsh-frame-overlay-top（= top-clearance + 20px）作为视口内边距。
 * 变量全部带 0px 兜底、选择器限定 darwin：Web / Windows 渲染不受影响。
 * 选择器加 html + 2 个类/属性（0,3,1），高于 .zp-root[data-w="narrow"] 的 (0,3,0)，
 * 窄面板规则不会把这里的 padding 覆盖回去。 */
html[data-platform="darwin"] .zp-root {
  padding-top: var(--dsh-frame-top-clearance, 0px);
}
html[data-platform="darwin"] [data-sidebar-collapsed] .zp-head {
  /* 顶栏内容起点 = max(设计内边距 22px, leading 条带宽度)；侧栏隐藏时面板左缘即窗口左缘 */
  padding-left: max(22px, var(--dsh-frame-leading-clearance, 0px));
}
html[data-platform="darwin"] .zp-root .zp-overlay-center {
  /* 设置弹层：上内边距取官方浮层 inset（68px 普通 / 全屏 20px），不钻到窗口标题带里 */
  padding-top: max(46px, var(--dsh-frame-overlay-top, 46px));
}
/* 宿主全局只给 button 重置了 font-family，没有 color，也没设 color-scheme：
   没写颜色的按钮会落回浏览器默认黑字，深色主题下看不见。:where() 权重 0,0,1，不盖组件自己的颜色。 */
:where(.zp-root) button { color: inherit }
/* 浮层打开时程序聚焦容器（tabIndex=-1）。沿用宿主约定的 data-dsh-automatic-focus：容器不画焦点框，
   内部控件的 :focus-visible 不受影响。 */
.zp-root [data-dsh-automatic-focus]:focus { outline: none }
.zp-scroll {
  height: 100%; overflow: auto; box-sizing: border-box;
  padding: 0 20px 40px; scrollbar-width: thin;
}
.zp-root[data-w="narrow"] .zp-scroll { padding: 0 16px 32px; }
.zp-scroll-locked { overflow: hidden }
.zp-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.zp-scroll::-webkit-scrollbar-thumb {
  background: rgba(128,128,128,.35);
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 30%, transparent);
  border-radius: 6px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.zp-inner { max-width: 1460px; margin: 0 auto; display: flex; flex-direction: column; min-height: 100% }

/* ---------------- 顶栏 ---------------- */
.zp-head {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 12px 2px 11px; position: sticky; top: 0; z-index: 20;
  background: var(--dsw-alias-bg-base);
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 90%, transparent);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  margin: 0 -20px 14px; padding-left: 22px; padding-right: 22px;
}
.zp-root[data-w="narrow"] .zp-head { margin: 0 -14px 12px; padding-left: 16px; padding-right: 16px; }
.zp-brand { display: flex; align-items: center; gap: 8px; flex: none }
.zp-brand-name { font-size: 17px; font-weight: 750; letter-spacing: 1.5px }
.zp-brand-pro {
  font-size: 10px; font-weight: 800; letter-spacing: 1px; line-height: 1.5;
  color: var(--zp-accent); border: 1px solid color-mix(in srgb, var(--zp-accent) 45%, transparent);
  border-radius: 6px; padding: 0 6px;
}
.zp-brand-tag {
  display: none; font-size: 11px; color: var(--dsw-alias-label-secondary); letter-spacing: .5px;
  border-left: 1px solid var(--dsw-alias-border-l1); padding-left: 10px; margin-left: 2px;
}
.zp-root[data-w="wide"] .zp-brand-tag { display: inline }
.zp-head-sum { display: none; align-items: center; gap: 6px; min-width: 0; flex: 1 1 0; overflow: hidden }
.zp-root[data-w="mid"] .zp-head-sum, .zp-root[data-w="wide"] .zp-head-sum, .zp-root[data-w="compact"] .zp-head-sum { display: flex }
.zp-sum-chip {
  font-size: 11.5px; color: var(--dsw-alias-label-secondary); white-space: nowrap;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px; padding: 2px 9px;
}
.zp-sum-chip b { color: var(--dsw-alias-label-primary); font-weight: 650 }
.zp-sum-gz { letter-spacing: 1.5px; font-variant-numeric: tabular-nums }
.zp-root[data-w="mid"] .zp-sum-class, .zp-root[data-w="compact"] .zp-sum-class { display: none }
.zp-head-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap }

/* ---------------- 布局骨架 ---------------- */
.zp-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start }
.zp-root[data-w="mid"] .zp-body { grid-template-columns: 296px minmax(0, 1fr); gap: 16px }
.zp-root[data-w="wide"] .zp-body { grid-template-columns: 304px minmax(0, 1fr); gap: 16px }
.zp-side { display: flex; flex-direction: column; gap: 12px; min-width: 0 }
/* 窄面板: 左栏拆开重排 —— 出盘前生辰输入在上；出盘后盘面在前（见 data-chart 规则），命主信息/命盘库沉底 */
.zp-root[data-w="narrow"] .zp-side { display: contents }
/* 这些 order 只服务 narrow 的 display:contents 重排；放在全局会在宽/中/紧凑档的
   flex 左栏里覆盖 DOM 顺序（1.5.1 把摘要移到 DOM 前面后，格局卡会被顶到最上面）。 */
.zp-root[data-w="narrow"] .zp-input-card { order: 1 }
.zp-root[data-w="narrow"] .zp-stage { order: 2 }
.zp-root[data-w="narrow"] .zp-summary-card { order: 3 }
.zp-root[data-w="narrow"] .zp-patterns-card { order: 3 }
.zp-root[data-w="narrow"] .zp-lib-card { order: 4 }
.zp-root[data-w="narrow"][data-chart="1"] .zp-stage { order: 1 }
.zp-root[data-w="narrow"][data-chart="1"] .zp-input-card { order: 2 }
.zp-stage { min-width: 0; outline: none; border-radius: 14px }
.zp-stage:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 3px }

/* ---------------- 卡片 ---------------- */
.zp-card {
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 14px; padding: 16px;
}
.zp-card-title {
  font-size: 11px; font-weight: 800; letter-spacing: 1.8px; color: var(--dsw-alias-label-secondary);
  margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
}
.zp-card-title::before {
  content: ''; width: 3px; height: 12px; border-radius: 2px; flex: none;
  background: linear-gradient(180deg, var(--zp-accent), var(--zp-gold));
}
.zp-title-actions { margin-left: auto; display: flex; gap: 6px; align-items: center }
.zp-link-btn {
  border: none; background: transparent; color: var(--dsw-alias-label-secondary);
  font-size: 11px; font-weight: 600; font-family: inherit; cursor: pointer;
  padding: 2px 6px; border-radius: 6px; letter-spacing: .5px; height: auto;
}
.zp-link-btn:hover { color: var(--zp-accent); background: color-mix(in srgb, var(--zp-accent) 10%, transparent) }

/* ---------------- 表单 ---------------- */
.zp-field { margin-bottom: 9px }
.zp-field-label { display: block; font-size: 11px; color: var(--dsw-alias-label-secondary); margin-bottom: 4px; letter-spacing: .5px }
.zp-input {
  box-sizing: border-box; width: 100%;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px; color: var(--dsw-alias-label-primary); padding: 6px 9px;
  font-size: 13px; font-family: inherit; transition: border-color .12s, box-shadow .12s;
}
.zp-input::placeholder { color: color-mix(in srgb, var(--dsw-alias-label-secondary) 80%, transparent) }
.zp-input:focus {
  border-color: var(--zp-accent); outline: none;
  box-shadow: 0 0 0 2px var(--dsw-alias-border-l2);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--zp-accent) 24%, transparent);
}
.zp-row { display: flex; gap: 6px; align-items: center; min-width: 0 }
.zp-birth-line {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; padding: 8px 10px;
}
.zp-birth-text { font-size: 12.5px; color: var(--dsw-alias-label-secondary); line-height: 1.6; flex: 1 1 180px; letter-spacing: .3px }
.zp-birth-text b { color: var(--dsw-alias-label-primary); font-weight: 700 }

/* 分段控件 / 按钮 */
.zp-seg {
  display: inline-flex; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px; padding: 2px; gap: 2px; width: 100%; box-sizing: border-box;
}
.zp-seg button {
  flex: 1; border: none; background: transparent; color: var(--dsw-alias-label-secondary);
  padding: 4px 8px; font-size: 12px; cursor: pointer; border-radius: 6px; font-weight: 600; font-family: inherit;
  transition: background .12s, color .12s;
}
.zp-seg button.on { background: var(--zp-fill-accent); color: #fff }
.zp-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  box-sizing: border-box; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 9px; color: var(--dsw-alias-label-primary); padding: 0 13px; height: 32px;
  font-size: 12.5px; cursor: pointer; font-family: inherit;
  transition: border-color .12s, background .12s, opacity .12s; white-space: nowrap;
}
.zp-btn:hover { border-color: color-mix(in srgb, var(--zp-accent) 55%, var(--dsw-alias-border-l1)) }
.zp-btn:active { opacity: .86 }
.zp-btn:disabled { opacity: .5; cursor: default }
.zp-btn-primary {
  background: linear-gradient(135deg, var(--zp-fill-accent), var(--zp-fill-accent-deep));
  border: none; color: #fff; font-weight: 650; height: 34px;
}
.zp-btn-primary:hover { opacity: .93; border: none }
.zp-btn:focus-visible, .zp-input:focus-visible, .zp-toggle:focus-visible, .zp-tabs button:focus-visible, .zp-link-btn:focus-visible {
  outline: 2px solid var(--zp-accent); outline-offset: 2px;
}
.zp-error { color: var(--dsw-alias-state-error-primary); font-size: 12px; margin-top: 8px; line-height: 1.55 }
.zp-warn { color: var(--dsw-alias-state-warn-primary); font-size: 11px; margin-top: 6px; line-height: 1.55 }
.zp-note {
  font-size: 11px; color: var(--dsw-alias-label-secondary); line-height: 1.65;
  margin-top: 12px; border-top: 1px dashed var(--dsw-alias-border-l1); padding-top: 10px;
}

/* ---------------- 命主信息 ---------------- */
.zp-pillars { display: flex; gap: 6px; margin-bottom: 10px }
.zp-pillar {
  flex: 1; text-align: center; padding: 6px 2px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2); font-size: 15px; font-weight: 750; letter-spacing: 2px;
}
.zp-kv-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0 18px }
.zp-root[data-w="narrow"] .zp-kv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) }
.zp-kv { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 12px; padding: 3px 0; min-width: 0 }
.zp-kv > span { color: var(--dsw-alias-label-secondary); flex: none; font-size: 11px }
.zp-kv > b { font-weight: 650; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: .2px }
.zp-kv-wide { grid-column: 1 / -1 }
.zp-decadal-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(248px, 1fr)); gap: 6px }
.zp-decadal-list .zp-list-item { margin-bottom: 0 }
.zp-mutagen-strip { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px }
.zp-mu {
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;
  border: 1px solid; background: color-mix(in srgb, currentColor 12%, transparent);
}
.zp-mu-lu { color: var(--zp-mu-lu) }
.zp-mu-quan { color: var(--zp-mu-quan) }
.zp-mu-ke { color: var(--zp-mu-ke) }
.zp-mu-ji { color: var(--zp-mu-ji) }

/* ---------------- 舞台：页签 / 工具 ---------------- */
.zp-stage-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px }
.zp-tabs {
  display: inline-flex; align-items: center; gap: 2px; padding: 3px;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 999px; max-width: 100%; overflow-x: auto; scrollbar-width: none;
}
.zp-tabs::-webkit-scrollbar { display: none }
.zp-tabs button {
  border: none; background: transparent; color: var(--dsw-alias-label-secondary);
  padding: 5px 13px; font-size: 12.5px; font-weight: 650; cursor: pointer;
  border-radius: 999px; font-family: inherit; white-space: nowrap; transition: background .12s, color .12s;
}
.zp-tabs button:hover { color: var(--dsw-alias-label-primary) }
.zp-tabs button.on { background: var(--zp-fill-accent); color: #fff }
.zp-stage-ctrl { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap }
.zp-toggle {
  display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px;
  font-size: 11.5px; font-weight: 600; font-family: inherit; letter-spacing: .3px;
  color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; cursor: pointer;
  transition: color .12s, border-color .12s, background .12s;
}
.zp-toggle:hover { color: var(--dsw-alias-label-primary) }
.zp-toggle.on {
  color: var(--zp-accent);
  border-color: var(--zp-accent);
  border-color: color-mix(in srgb, var(--zp-accent) 50%, transparent);
  background: var(--dsw-alias-bg-layer-2);
  background: color-mix(in srgb, var(--zp-accent) 12%, transparent);
}
.zp-scope-bar {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding: 6px 10px;
  font-size: 12px; color: var(--dsw-alias-label-secondary); flex-wrap: wrap;
  background: var(--dsw-alias-bg-layer-2); border-left: 3px solid var(--zp-accent); border-radius: 0 8px 8px 0;
}
.zp-scope-bar b { color: var(--zp-accent); font-weight: 750 }

/* ---------------- 命盘盘面 ---------------- */
.zp-board-wrap { display: block }
.zp-root[data-w="wide"] .zp-board-wrap.has-detail {
  display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; align-items: start;
}
.zp-board {
  width: 100%; max-width: var(--zp-board-max); margin: 0 auto; padding: 5px; border-radius: 18px; box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1);
  border: 1px solid color-mix(in srgb, var(--zp-gold) 26%, var(--dsw-alias-border-l1));
  background: var(--dsw-alias-bg-layer-2);
  background: linear-gradient(180deg, color-mix(in srgb, var(--zp-gold) 6%, transparent), transparent 55%);
  box-shadow: 0 1px 2px color-mix(in srgb, #000 5%, transparent);
}
.zp-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(4, auto);
  gap: 3px; overflow: hidden; border-radius: 14px;
  background: var(--dsw-alias-border-l1); border: 1px solid var(--dsw-alias-border-l1);
  container-type: inline-size;
}
.zp-cell {
  background: var(--dsw-alias-bg-layer-1);
  padding: 8px;
  padding: clamp(6px, 1.35cqw, 11px);
  min-height: 96px; min-height: clamp(96px, 19cqw, 150px);
  cursor: pointer; display: flex; flex-direction: column; gap: 2px;
  position: relative; min-width: 0; transition: background .12s, box-shadow .12s;
}
.zp-cell:hover { background: var(--dsw-alias-bg-layer-2); background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 90%, var(--zp-accent) 10%) }
.zp-cell.on {
  background: var(--dsw-alias-bg-layer-2);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 84%, var(--zp-accent) 16%);
  box-shadow: inset 0 0 0 2px var(--zp-accent);
}
.zp-cell.empty .zp-cell-name { color: var(--dsw-alias-label-secondary) }
.zp-cell:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: -2px }
.zp-cell-top { display: flex; justify-content: space-between; align-items: baseline; gap: 2px 4px; flex-wrap: wrap; min-width: 0 }
.zp-cell-name {
  font-size: 13px; font-size: clamp(11px, 1.95cqw, 14px);
  font-weight: 800; letter-spacing: .5px; white-space: nowrap;
}
.zp-cell-gz {
  font-size: 10px; font-size: clamp(8.5px, 1.35cqw, 10.5px);
  color: var(--dsw-alias-label-secondary); letter-spacing: 1px; white-space: nowrap;
}
.zp-mark {
  display: inline-block; font-size: 9px; font-weight: 800; color: #fff; line-height: 1.5;
  border-radius: 4px; padding: 0 3.5px; margin-left: 4px; vertical-align: 1px; letter-spacing: 0;
}
.zp-mark-soul { background: var(--zp-fill-accent) }
.zp-mark-body { background: var(--zp-gold); color: #3c2f14 }
.zp-stars-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 6px; line-height: 1.3; min-width: 0 }
.zp-stars-major { margin-top: 1px }
.zp-stars-minor { margin-top: 1px }
.zp-stars-scope { opacity: .92 }
.zp-star {
  font-size: 13px; font-size: clamp(10.5px, 2.05cqw, 14.5px);
  font-weight: 800; white-space: nowrap;
}
.zp-star.major { color: var(--zp-star-color, var(--dsw-alias-label-primary)) }
.zp-star.minor-line { font-size: 11.5px; font-size: clamp(9.5px, 1.7cqw, 12px); font-weight: 650 }
.zp-star.good { color: var(--zp-good) }
.zp-star.bad { color: var(--zp-bad) }
.zp-star.adj { color: var(--dsw-alias-label-secondary); font-weight: 500 }
.zp-star-none {
  font-size: 10px; font-size: clamp(8.5px, 1.4cqw, 10.5px);
  color: var(--dsw-alias-label-secondary); letter-spacing: 1px;
  border: 1px dashed var(--dsw-alias-border-l2); border-radius: 4px; padding: 0 4px;
}
.zp-bright {
  font-size: 8.5px; font-size: clamp(7.5px, 1.15cqw, 9.5px); font-weight: 700;
  color: var(--zp-gold-dim); border: 1px solid currentColor; border-radius: 3px;
  padding: 0 2px; margin-left: 2px; vertical-align: 1px;
}
.zp-mu-badge {
  font-size: 8.5px; font-size: clamp(7.5px, 1.15cqw, 9.5px); font-weight: 800; color: #fff;
  border-radius: 3px; padding: 0 2.5px; margin-left: 2px; vertical-align: 1px;
}
.zp-mu-badge.lu { background: var(--zp-mu-lu) }
.zp-mu-badge.quan { background: var(--zp-mu-quan) }
.zp-mu-badge.ke { background: var(--zp-mu-ke) }
.zp-mu-badge.ji { background: var(--zp-mu-ji) }
.zp-adj-line {
  font-size: 9.5px; font-size: clamp(8.5px, 1.45cqw, 10.5px);
  color: var(--dsw-alias-label-secondary); line-height: 1.45; opacity: .9; margin-top: 1px;
}
.zp-cell-scope {
  font-size: 9px; font-size: clamp(8px, 1.3cqw, 10px);
  color: var(--zp-accent); font-weight: 700; letter-spacing: .5px; margin-top: 1px;
}
.zp-cell-foot {
  display: flex; justify-content: space-between; align-items: baseline; gap: 4px;
  margin-top: auto; padding-top: 3px; min-width: 0;
}
.zp-cell-dec {
  font-size: 9.5px; font-size: clamp(8.5px, 1.3cqw, 10.5px);
  color: var(--zp-gold-dim); letter-spacing: .3px; white-space: nowrap;
}
.zp-cell-gods {
  font-size: 9px; font-size: clamp(8px, 1.2cqw, 10px);
  color: var(--dsw-alias-label-secondary); opacity: .8; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
/* 中宫 */
.zp-center {
  grid-column: 2 / 4; grid-row: 2 / 4; position: relative; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; gap: clamp(3px, .9cqw, 7px);
  padding: 12px; padding: clamp(8px, 2cqw, 18px); text-align: center;
  background: var(--dsw-alias-bg-layer-2);
  background:
    radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--zp-accent) 15%, transparent), transparent 68%),
    var(--dsw-alias-bg-layer-2);
}
.zp-center::before {
  content: ''; position: absolute; inset: 7px; inset: clamp(5px, 1.3cqw, 9px);
  border: 1px dashed var(--dsw-alias-border-l2);
  border: 1px dashed color-mix(in srgb, var(--zp-accent) 28%, transparent);
  border-radius: 10px; pointer-events: none;
}
.zp-taiji-wrap { display: flex; align-items: center; justify-content: center }
.zp-taiji { width: 44px; width: clamp(30px, 6.2cqw, 52px); height: auto; display: block }
.zp-center-name { font-size: 14.5px; font-size: clamp(12px, 2.1cqw, 16.5px); font-weight: 800; letter-spacing: 2px }
.zp-center-chips { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; max-width: 100% }
.zp-center-chip {
  font-size: 10px; font-size: clamp(8.5px, 1.45cqw, 10.5px); line-height: 1.6;
  padding: 0 6px; border-radius: 999px; color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 65%, transparent);
  white-space: nowrap;
}
.zp-center-sub {
  font-size: 11px; font-size: clamp(9.5px, 1.65cqw, 11.5px);
  color: var(--dsw-alias-label-secondary); letter-spacing: .5px; line-height: 1.55;
}
.zp-center-dec {
  font-size: 10.5px; font-size: clamp(9px, 1.45cqw, 10.5px);
  color: var(--zp-gold-dim); letter-spacing: .5px;
}

/* ---------------- 宫位详情 ---------------- */
.zp-detail {
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 14px; padding: 16px; margin-top: 12px; min-width: 0;
}
.zp-root:not([data-w="wide"]) .zp-detail { max-width: 760px; margin-left: auto; margin-right: auto }
.zp-root[data-w="wide"] .zp-detail { margin-top: 0; position: sticky; top: 64px }
.zp-detail-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 10px }
.zp-detail-name { font-size: 16px; font-weight: 800; letter-spacing: 1px }
.zp-detail-gz { font-size: 12px; color: var(--dsw-alias-label-secondary); letter-spacing: 1px }
.zp-detail-nav { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap }
.zp-detail-nav .zp-btn { height: 26px; font-size: 11.5px; padding: 0 9px }
.zp-detail-body { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px 18px }
.zp-root[data-w="wide"] .zp-detail-body { grid-template-columns: minmax(0, 1fr) }
.zp-detail-section { min-width: 0 }
.zp-detail-section-label {
  font-size: 10px; font-weight: 800; letter-spacing: 1.8px; color: var(--dsw-alias-label-secondary);
  margin-bottom: 5px;
}
.zp-detail-stars { display: flex; flex-wrap: wrap; gap: 2px 10px; align-items: baseline }
.zp-detail-stars .zp-star { font-size: 14px }
.zp-detail-stars .zp-star.minor-line { font-size: 12px }
.zp-detail-stars .zp-star.adj { font-size: 12px }
.zp-detail-chips { display: flex; flex-wrap: wrap; gap: 6px }
.zp-chip {
  font-size: 11px; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2);
  border-radius: 8px; padding: 3px 8px; line-height: 1.6;
}
.zp-chip b { font-weight: 700 }
.zp-kbd-hint { font-size: 10.5px; color: var(--dsw-alias-label-secondary); margin-top: 10px; letter-spacing: .5px }

/* ---------------- 列表（命盘库 / 大限） ---------------- */
.zp-list-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 9px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; margin-bottom: 6px;
  cursor: pointer; font-size: 12px; transition: border-color .12s, background .12s; min-width: 0;
}
.zp-list-item:hover { border-color: color-mix(in srgb, var(--zp-accent) 55%, var(--dsw-alias-border-l1)) }
.zp-list-item.on { border-color: var(--zp-accent); background: color-mix(in srgb, var(--zp-accent) 8%, transparent) }
.zp-list-item b { font-weight: 650; white-space: nowrap }
.zp-list-item .zp-list-sub { color: var(--dsw-alias-label-secondary); font-size: 11px; margin-left: auto; white-space: nowrap }
.zp-list-del {
  background: none; border: none; color: var(--dsw-alias-label-secondary); cursor: pointer;
  font-size: 13px; padding: 1px 5px; border-radius: 6px; font-family: inherit; line-height: 1.4;
}
.zp-list-del:hover { color: var(--dsw-alias-state-error-primary); background: var(--dsw-alias-bg-layer-2) }

/* ---------------- 顶栏动作 / 图标按钮 ---------------- */
.zp-btn-label { white-space: nowrap }
.zp-icon-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; min-width: 32px; padding: 0 9px; box-sizing: border-box;
  border: 1px solid transparent; border-radius: 9px; background: transparent;
  color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: 12px;
  cursor: pointer; transition: color .12s, background .12s, border-color .12s;
}
.zp-icon-btn:hover {
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l1);
}
.zp-icon-btn:disabled { opacity: .45; cursor: default }
.zp-icon-btn:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 2px }
.zp-head-sep { width: 1px; height: 18px; background: var(--dsw-alias-border-l1); flex: none; margin: 0 1px }
/* 「返回会话」出口：顶栏最左侧常驻，图标 + 文案（窄面板只留图标），键盘可聚焦 */
.zp-exit {
  flex: none;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l1);
}
.zp-exit:hover {
  border-color: color-mix(in srgb, var(--zp-accent) 45%, var(--dsw-alias-border-l1));
  background: color-mix(in srgb, var(--zp-accent) 10%, var(--dsw-alias-bg-layer-2));
}
.zp-btn-ai { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px }
.zp-btn-ai[aria-pressed="true"] { box-shadow: inset 0 0 0 1px color-mix(in srgb, #fff 35%, transparent) }
.zp-root[data-w="narrow"] .zp-icon-btn { padding: 0; width: 32px }
.zp-root[data-w="narrow"] .zp-icon-btn .zp-btn-label { display: none }

/* ---------------- 面板内浮层（抽屉 / 设置） ----------------
 * .zp-root 是不滚动外壳（position:relative），内容在 .zp-scroll 里滚；
 * 浮层绝对定位在外壳内，所以只覆盖工作台，不按视口坐标、也不受侧栏宽度变化影响。 */
.zp-overlay { position: absolute; inset: 0; z-index: 100 }
.zp-overlay-mask {
  position: absolute; inset: 0;
  background: rgba(0,0,0,.38); background: color-mix(in srgb, #000 38%, transparent);
  animation: zp-fade-in .14s ease-out;
}
.zp-overlay-center {
  position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center;
  padding: 46px 18px; overflow: auto;
}

/* 右侧阅读抽屉 */
.zp-ai {
  position: absolute; top: 0; right: 0; bottom: 0; width: min(464px, 100%);
  display: flex; flex-direction: column; min-height: 0;
  background: var(--dsw-alias-bg-layer-1);
  border-left: 1px solid var(--dsw-alias-border-l1);
  box-shadow: -18px 0 48px rgba(0,0,0,.22);
  box-shadow: -18px 0 48px color-mix(in srgb, #000 22%, transparent);
  animation: zp-slide-in .18s cubic-bezier(.22,.61,.36,1);
}
.zp-ai-head {
  flex: none; display: flex; align-items: center; gap: 10px;
  padding: 11px 12px 11px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.zp-ai-heading { display: flex; align-items: center; gap: 9px; min-width: 0; flex: 1 }
.zp-ai-glyph {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 28px; height: 28px; border-radius: 9px; color: #fff;
  background: linear-gradient(135deg, var(--zp-fill-accent), var(--zp-fill-accent-deep));
}
.zp-ai:focus, .zp-settings:focus { outline: none }
.zp-ai-title { font-size: 13.5px; font-weight: 750; letter-spacing: .5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.zp-ai-body {
  flex: 1; min-height: 0; overflow-y: auto; padding: 14px;
  display: flex; flex-direction: column; gap: 10px; scrollbar-width: thin;
}
.zp-ai-body::-webkit-scrollbar { width: 8px }
.zp-ai-body::-webkit-scrollbar-thumb {
  background: rgba(128,128,128,.35);
  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 30%, transparent);
  border-radius: 4px; border: 2px solid transparent; background-clip: padding-box;
}
.zp-ai-foot {
  flex: none; border-top: 1px solid var(--dsw-alias-border-l1);
  padding: 10px 14px 12px; display: flex; flex-direction: column; gap: 8px;
  background: var(--dsw-alias-bg-layer-1);
}
.zp-ai-tools { display: flex; gap: 6px; flex-wrap: wrap; align-items: center }
.zp-ai-tools .zp-mini-btn { height: 28px }
.zp-ai-composer { display: flex; gap: 8px; align-items: flex-end }
.zp-ai-disclaimer { font-size: 11px; color: var(--dsw-alias-label-secondary); line-height: 1.5; opacity: .9 }
.zp-ai-error {
  flex: none; display: flex; align-items: flex-start; gap: 8px;
  padding: 8px 10px; border-radius: 9px; font-size: 12px; line-height: 1.5;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 42%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
  color: var(--dsw-alias-label-primary);
}
.zp-ai-error-text { flex: 1; min-width: 0; word-break: break-word }
/* 空态：居中一小块（一句说明 + 两个动作卡），不铺满整张宽抽屉 */
.zp-ai-empty-wrap {
  flex: 1; min-height: 0; display: flex; justify-content: center; align-items: center;
}
.zp-ai-empty { box-sizing: border-box; width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 4px }
.zp-ai-empty-lead { font-size: 14px; font-weight: 700; letter-spacing: .2px; color: var(--dsw-alias-label-primary) }
.zp-ai-empty-hint { font-size: 12px; line-height: 1.7; color: var(--dsw-alias-label-secondary) }
/* 空态的两个动作：点一次就产出内容，不再是"只改下一次请求"的模式条 */
.zp-ai-start { display: flex; flex-direction: column; gap: 8px; margin-top: 12px }
.zp-ai-start-btn {
  box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 12px; border-radius: 12px; cursor: pointer; font-family: inherit; text-align: left;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
  transition: border-color .12s, background .12s, transform .12s;
}
.zp-ai-start-btn:hover { border-color: color-mix(in srgb, var(--zp-fill-accent) 52%, var(--dsw-alias-border-l1)) }
.zp-ai-start-btn:active { transform: translateY(1px) }
.zp-ai-start-btn:disabled { opacity: .5; cursor: default; transform: none }
.zp-ai-start-btn:focus-visible { outline: 2px solid var(--zp-fill-accent); outline-offset: 2px }
.zp-ai-start-glyph {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  color: var(--zp-fill-accent); background: color-mix(in srgb, var(--zp-fill-accent) 12%, transparent);
}
.zp-ai-start-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0 }
.zp-ai-start-arrow { flex: none; margin-left: auto; color: var(--dsw-alias-label-tertiary) }
.zp-ai-start-name { font-size: 13px; font-weight: 650; line-height: 1.5 }
.zp-ai-start-desc { font-size: 11px; line-height: 1.5; color: var(--dsw-alias-label-secondary) }
/* 首选动作：只加一层品牌色描边和一点底色，不做整块紫色大按钮 */
.zp-ai-start-btn.primary {
  border-color: color-mix(in srgb, var(--zp-fill-accent) 42%, var(--dsw-alias-border-l1));
  background: color-mix(in srgb, var(--zp-fill-accent) 7%, var(--dsw-alias-bg-layer-2));
}
.zp-ai-start-btn.primary .zp-ai-start-glyph { background: color-mix(in srgb, var(--zp-fill-accent) 18%, transparent) }
.zp-send {
  width: 36px; height: 36px; flex: none; display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 10px; color: #fff; cursor: pointer;
  background: linear-gradient(135deg, var(--zp-accent), var(--zp-accent-deep));
  transition: opacity .12s;
}
.zp-send:hover { opacity: .92 }
.zp-send:disabled { opacity: .5; cursor: default }
.zp-send-stop {
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
}
.zp-mini-btn {
  display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px; box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: transparent;
  color: var(--dsw-alias-label-secondary); font-family: inherit; font-size: 11.5px;
  cursor: pointer; transition: color .12s, background .12s, border-color .12s;
}
.zp-mini-btn:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2) }
.zp-mini-btn:focus-visible, .zp-send:focus-visible {
  outline: 2px solid var(--zp-accent); outline-offset: 2px;
}
.zp-mini-btn:disabled { opacity: .5; cursor: default }
.zp-mini-icon { width: 28px; height: 28px; padding: 0; justify-content: center }
.zp-mini-btn-accent {
  margin-left: auto; color: var(--zp-accent);
  border-color: color-mix(in srgb, var(--zp-accent) 42%, transparent);
}
.zp-mini-btn-accent:hover {
  color: var(--zp-accent); background: color-mix(in srgb, var(--zp-accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--zp-accent) 62%, transparent);
}
.zp-ai-preview {
  position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-base); animation: zp-fade-in .14s ease-out;
}
.zp-ai-preview-head {
  flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 12px 9px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); font-size: 12.5px;
}

/* 设置弹层 */
.zp-settings {
  width: min(520px, 100%); max-height: 86%; display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 16px; box-shadow: 0 24px 64px rgba(0,0,0,.28);
  box-shadow: 0 24px 64px color-mix(in srgb, #000 30%, transparent);
  animation: zp-pop-in .16s cubic-bezier(.22,.61,.36,1);
}
.zp-settings-head { flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1) }
.zp-settings-title { font-size: 14px; font-weight: 750; letter-spacing: .5px }
.zp-settings-body { padding: 16px; overflow: auto }
.zp-settings-hint { font-size: 11px; color: var(--dsw-alias-label-secondary); margin-top: 4px; line-height: 1.55 }
.zp-check {
  display: flex; align-items: center; gap: 8px; font-size: 12.5px;
  margin-bottom: 10px; cursor: pointer; color: var(--dsw-alias-label-primary);
}
.zp-check input { accent-color: var(--zp-accent) }
.zp-settings-about {
  margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--dsw-alias-border-l1);
  font-size: 11px; line-height: 1.7; color: var(--dsw-alias-label-secondary);
  display: flex; flex-direction: column; gap: 4px;
}
.zp-settings-about b { color: var(--dsw-alias-label-primary); font-size: 11px; letter-spacing: 1px }
.zp-settings-sign { color: var(--dsw-alias-label-primary); font-weight: 600 }
.zp-settings-contact { color: var(--dsw-alias-label-secondary) }
.zp-update { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--dsw-alias-border-l1); display: flex; flex-direction: column; gap: 8px }
.zp-update-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--dsw-alias-label-secondary) }
.zp-update-row b { font-size: 12px; color: var(--dsw-alias-label-primary) }
.zp-update-cmd { display: block; padding: 8px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); font-size: 11px; line-height: 1.6; color: var(--dsw-alias-label-primary); word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace }
.zp-update-new { font-size: 11px; line-height: 1.6; color: var(--dsw-alias-state-warn-primary) }
.zp-update-ok { font-size: 11px; line-height: 1.6; color: var(--dsw-alias-label-secondary) }

@keyframes zp-slide-in { from { transform: translateX(24px); opacity: .55 } to { transform: none; opacity: 1 } }
@keyframes zp-fade-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes zp-pop-in { from { transform: translateY(6px) scale(.99); opacity: .4 } to { transform: none; opacity: 1 } }

/* ---------------- 对话气泡 / 预览 ---------------- */
.zp-chat-thread { display: flex; flex-direction: column; gap: 10px }
.zp-bubble { max-width: 88%; border-radius: 12px; padding: 9px 12px; font-size: 13px; line-height: 1.7 }
.zp-bubble-user {
  align-self: flex-end; background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1); white-space: pre-wrap; word-break: break-word;
}
.zp-bubble-ai { align-self: flex-start; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); width: 100%; max-width: 100% }
.zp-bubble-text { white-space: pre-wrap; word-break: break-word }
.zp-md-h { font-weight: 650; color: var(--dsw-alias-label-primary); margin: 10px 0 4px }
.zp-md-h1 { font-size: 15px } .zp-md-h2 { font-size: 14px } .zp-md-h3 { font-size: 13.5px } .zp-md-h4 { font-size: 13px }
.zp-md-p { margin: 3px 0 }
.zp-md-li { margin: 2px 0 2px 4px }
.zp-md-quote {
  margin: 6px 0; padding: 4px 10px; border-left: 3px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary); font-style: italic;
}
.zp-md-gap { height: 6px }
.zp-md code { background: var(--dsw-alias-bg-layer-2); padding: 1px 4px; border-radius: 4px; font-size: 12px }
/* 抽屉里的报告表格（v3.2）：与精装报告共用解析器，避免回答里露出管道符 */
.zp-md-table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12px; line-height: 1.6 }
.zp-md-table th, .zp-md-table td {
  border: 1px solid var(--dsw-alias-border-l1); padding: 4px 6px;
  vertical-align: top; text-align: left; word-break: break-word;
}
.zp-md-table th { background: var(--dsw-alias-bg-layer-2); font-weight: 600 }
.zp-typing { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--dsw-alias-label-secondary); padding: 6px 2px }
.zp-typing-dots { display: inline-flex; align-items: center; gap: 4px }
.zp-typing-dots i {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--dsw-alias-label-tertiary);
  animation: zp-typing-blink 1.2s ease-in-out infinite;
}
.zp-typing-dots i:nth-child(2) { animation-delay: .15s }
.zp-typing-dots i:nth-child(3) { animation-delay: .3s }
@keyframes zp-typing-blink {
  0%, 100% { opacity: .25; transform: translateY(0) }
  50% { opacity: 1; transform: translateY(-1px) }
}
.zp-chat-ta { flex: 1; resize: vertical; min-height: 46px; max-height: 180px; font-family: inherit; line-height: 1.6; font-size: 13px }
.zp-preview-frame {
  width: 100%; height: 60vh; border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 10px; background: #FAF6EF; margin-top: 10px;
}
.zp-preview-frame-full { flex: 1; height: auto; min-height: 0; margin: 0; border: none; border-radius: 0 }
/* 窄面板：抽屉铺满工作台，头部收紧 */
.zp-root[data-w="narrow"] .zp-ai { width: 100%; border-left: none; box-shadow: none }
.zp-root[data-w="narrow"] .zp-overlay-center { padding: 18px 12px }
/* ---------------- 格局 / 词典 / 空态 ---------------- */
.zp-patterns { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px }
/* 左栏「格局摘要」：命主信息下面的只读结论（完整页仍在 PatternsView） */
.zp-patterns-card { margin-top: 12px }
.zp-patterns-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px }
.zp-patterns-count { font-size: 11px; color: var(--dsw-alias-label-tertiary) }
.zp-patterns-all { margin-left: auto }
.zp-pattern-mini { display: flex; flex-direction: column; gap: 2px; padding: 6px 0; border-top: 1px dashed var(--dsw-alias-border-l1) }
.zp-pattern-mini:first-of-type { border-top: none; padding-top: 0 }
.zp-pattern-mini-head { display: flex; align-items: baseline; gap: 6px; font-size: 12px; font-weight: 700; color: var(--dsw-alias-brand-primary) }
.zp-pattern-mini-level { font-size: 10.5px; font-weight: 600; color: var(--dsw-alias-label-tertiary) }
.zp-pattern-mini-desc { font-size: 11px; line-height: 1.55; color: var(--dsw-alias-label-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden }
.zp-pattern-card {
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 12px 14px;
  margin-bottom: 0; background: var(--dsw-alias-bg-layer-1);
}
.zp-pattern-name { font-size: 13.5px; font-weight: 800; color: var(--zp-accent); margin-bottom: 4px; letter-spacing: .3px }
.zp-pattern-desc { font-size: 12.5px; line-height: 1.65; color: var(--dsw-alias-label-primary) }
.zp-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap }
.zp-dict-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px }
.zp-dict-item {
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 10px 12px;
  background: var(--dsw-alias-bg-layer-1);
}
.zp-dict-name { font-size: 13px; font-weight: 750; margin-bottom: 3px; letter-spacing: .5px }
.zp-dict-desc { font-size: 11px; color: var(--dsw-alias-label-secondary); line-height: 1.6 }
.zp-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  max-width: 560px; margin: 0 auto; width: 100%;
  padding: 48px 20px; text-align: center; color: var(--dsw-alias-label-secondary);
  border: 1px dashed var(--dsw-alias-border-l1); border-radius: 16px; background: var(--dsw-alias-bg-layer-1);
}
.zp-empty-taiji { opacity: .3 }
.zp-empty-title { font-size: 14px; letter-spacing: 1px; color: var(--dsw-alias-label-primary); font-weight: 650 }
.zp-empty-hint { font-size: 12px; line-height: 1.7 }

/* ---------------- 窄面板微调 ---------------- */
.zp-root[data-w="narrow"] .zp-head-actions .zp-btn { height: 30px; padding: 0 10px; font-size: 12px }
.zp-root[data-w="narrow"] .zp-detail { padding: 12px 14px }
.zp-root[data-w="narrow"] .zp-detail-body { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) }
.zp-root[data-w="narrow"] .zp-card { padding: 12px 14px }

/* ---------------- 专注看盘 ----------------
 * 注意：这些规则靠「同特异性 + 位置靠后」覆盖上面的 data-w / has-detail 规则，
 * 必须保持在布局规则之后、深色主题之前；往后追加布局规则会静默破坏专注态。 */

.zp-root[data-focus="1"] .zp-side { display: none }
.zp-root[data-focus="1"] .zp-body { grid-template-columns: minmax(0, 1fr) }
.zp-root[data-focus="1"] .zp-board-wrap.has-detail, .zp-root[data-focus="1"] .zp-board-wrap { display: block }
.zp-root[data-focus="1"] .zp-board { max-width: 820px }
.zp-root[data-focus="1"] .zp-detail { display: none }

/* ---------------- v3：AppBar / TimeBar / Rail / BottomBar ---------------- */
.zp-head { flex-wrap: nowrap; min-height: 56px; box-sizing: border-box }
.zp-rail-toggle { flex: none }
.zp-root[data-rail="closed"] .zp-side { display: none }
.zp-root[data-rail="closed"] .zp-body { grid-template-columns: minmax(0, 1fr) }
.zp-timebar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 12px; margin: 0 0 12px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
  position: sticky; top: 56px; z-index: 12;
}
.zp-timebar .zp-tabs { background: transparent; border: 0; padding: 0 }
.zp-timebar .zp-stage-ctrl { margin-left: 0 }
.zp-time-nav { display: inline-flex; align-items: center; gap: 4px; min-width: 0 }
.zp-time-btn {
  width: 24px; height: 24px; padding: 0; flex: none; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
  font-family: inherit; font-size: 14px; line-height: 1;
}
.zp-time-btn:hover { color: var(--dsw-alias-label-primary); border-color: var(--zp-accent) }
.zp-time-btn:disabled { opacity: .45; cursor: default }
.zp-time-btn:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 1px }
.zp-time-select {
  height: 28px; max-width: 280px; min-width: 0; padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font-family: inherit; font-size: 12px;
}
.zp-time-select:focus-visible, .zp-time-input:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 1px }
.zp-time-input {
  width: 72px; height: 28px; padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  font-family: inherit; font-size: 12px;
}
.zp-time-now {
  height: 28px; padding: 0 8px; cursor: pointer; white-space: nowrap;
  border: 1px solid color-mix(in srgb, var(--zp-accent) 45%, transparent); border-radius: 999px;
  background: color-mix(in srgb, var(--zp-accent) 12%, transparent); color: var(--zp-accent);
  font-family: inherit; font-size: 11px; font-weight: 650;
}
.zp-time-now:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 1px }
.zp-time-chip {
  padding: 0 4px; font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap;
}
.zp-timebar-right { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-wrap: wrap }
.zp-tool-btn {
  height: 28px; padding: 0 8px; cursor: pointer; white-space: nowrap;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font-family: inherit; font-size: 11px; font-weight: 600;
}
.zp-tool-btn:hover { color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2) }
.zp-tool-btn.on { color: var(--zp-accent); border-color: color-mix(in srgb, var(--zp-accent) 50%, transparent); background: color-mix(in srgb, var(--zp-accent) 10%, transparent) }
.zp-tool-btn:focus-visible { outline: 2px solid var(--zp-accent); outline-offset: 1px }
.zp-toolview-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap }
.zp-toolview-title { font-size: 14px; font-weight: 650 }
.zp-toolview-sub { font-size: 11px; color: var(--dsw-alias-label-secondary) }
.zp-bottombar { display: none }
/* sticky 的贴边位置按滚动区内边距内缩：有盘窄档把底部内边距让给底栏，底栏才真正贴住面板底边 */
.zp-root[data-w="narrow"][data-chart="1"] .zp-scroll { padding-bottom: 0 }
.zp-root[data-w="narrow"][data-chart="1"] .zp-bottombar {
  display: flex; align-items: center; gap: 8px; position: sticky; bottom: 0; z-index: 14;
  margin: 12px -16px 0; padding: 8px 16px calc(8px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--dsw-alias-border-l1);
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 92%, transparent);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
}
.zp-bottombar .zp-btn { flex: 1 1 0; height: 34px }
.zp-root[data-w="narrow"] .zp-head .zp-btn-ai { display: none }
.zp-root[data-w="narrow"] .zp-timebar { position: static; margin-bottom: 8px }
.zp-root[data-w="narrow"] .zp-time-select { max-width: 168px }
.zp-head-mini { display: none }
.zp-root[data-w="narrow"] .zp-head-mini {
  display: inline-flex; flex: 0 1 auto; min-width: 0; max-width: 168px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* compact 档（908–1071）：左栏 264 + 盘面 600，详情下沉；专治侧栏展开时中栏单列拉满 */
.zp-root[data-w="compact"] { --zp-board-max: 600px }
.zp-root[data-w="compact"] .zp-scroll { padding: 0 16px 32px }
.zp-root[data-w="compact"] .zp-body { grid-template-columns: 264px minmax(0, 1fr); gap: 12px }
.zp-root[data-w="compact"] .zp-rail-head .zp-mini-btn { display: none }
.zp-root[data-w="compact"] .zp-head { margin: 0 -16px 12px; padding-left: 16px; padding-right: 16px }
.zp-root[data-w="compact"] .zp-icon-btn { width: 32px; padding: 0 }
.zp-root[data-w="compact"] .zp-icon-btn .zp-btn-label { display: none }
.zp-root[data-w="compact"] .zp-time-btn { width: 24px }
/* 收起左栏必须压过所有档位栅格（同特异性，放最后） */
.zp-root[data-rail="closed"] .zp-body { grid-template-columns: minmax(0, 1fr) }

/* ---------------- v5 工位：模式 / 对话 / 报告 ---------------- */
.zp-mode-switch {
  display: flex; align-items: center; gap: 2px; padding: 4px; flex: none;
  border-radius: 10px; background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
}
.zp-mode-switch button {
  border: 0; background: transparent; font-family: inherit; cursor: pointer;
  position: relative; display: inline-flex; align-items: center; gap: 4px;
  height: 26px; padding: 0 12px; border-radius: 8px; font-size: 12px;
  color: var(--dsw-alias-label-secondary); white-space: nowrap;
}
.zp-mode-switch button:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover) }
.zp-mode-switch button.is-on { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); box-shadow: var(--dsw-elevation-soft) }
.zp-sample-badge {
  display: inline-flex; align-items: center; height: 18px; padding: 0 6px;
  border-radius: 999px; background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 14%, transparent);
  color: var(--dsw-alias-state-warn-primary); font-size: 10.5px; line-height: 18px; font-weight: 600;
}
.zp-sample-switch {
  border: 0; background: transparent; color: var(--dsw-alias-label-secondary);
  font-size: 11px; line-height: 16px; text-decoration: underline; text-underline-offset: 2px;
  white-space: nowrap; cursor: pointer;
}
.zp-sample-switch:hover { color: var(--dsw-alias-label-primary) }
.zp-mode-switch button:focus-visible, .zp-canvas-tabs button:focus-visible,
.zp-pill-btn:focus-visible, .zp-sample-switch:focus-visible,
.zp-report-toc button:focus-visible, .zp-report-pick:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px;
}

.zp-mode-dot {
  display: inline-block; width: 6px; height: 6px; border-radius: 50%;
  background: var(--dsw-alias-brand-primary); flex: none;
}
.zp-root[data-studio="1"] .zp-scroll { overflow: hidden }
.zp-root[data-studio="1"] .zp-inner { height: 100%; min-height: 0 }
.zp-root[data-studio="1"] .zp-body { flex: 1 1 auto; min-height: 0 }
.zp-root[data-studio="1"] .zp-stage { overflow-y: auto; padding-bottom: 16px }
.zp-root[data-studio="1"][data-chart="1"] .zp-bottombar { display: none }
.zp-body.is-studio { display: flex; align-items: stretch; min-height: 0; }
.zp-root[data-studio="1"] .zp-side { display: none; }
.zp-root[data-studio="1"] .zp-stage { flex: 1; min-width: 0; }
.zp-studio-chat {
  flex: 0 0 340px; width: 340px; min-width: 0; min-height: 0;
  display: flex; flex-direction: column;
  border-right: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
}
.zp-body.is-studio:not(.is-studio-split) .zp-stage { display: none; }
.zp-body.is-studio:not(.is-studio-split) .zp-studio-chat { flex: 1 1 auto; width: auto; border-right: 0; }
.zp-body.is-studio:not(.is-studio-split).is-studio-report .zp-stage { display: block; }
.zp-body.is-studio:not(.is-studio-split).is-studio-report .zp-studio-chat { display: none; }
.zp-studio-head {
  flex: none; display: flex; align-items: center; gap: 8px;
  padding: 12px 12px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.zp-studio-title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px }
.zp-studio-title b { font-size: 13px; line-height: 20px; font-weight: 600 }
.zp-studio-title span { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.zp-studio-head-actions { display: flex; gap: 2px; flex: none }
.zp-studio-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px }
.zp-studio-empty { margin: auto 0; display: flex; flex-direction: column; gap: 12px }
.zp-studio-empty-title { font-size: 20px; line-height: 28px; font-weight: 300; letter-spacing: -.01em }
.zp-studio-empty-hint { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary) }
.zp-studio-start-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px }
.zp-studio-start {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px;
  border-radius: 10px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); text-align: left;
}
.zp-studio-start:hover { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2) }
.zp-studio-start:disabled { opacity: .5; cursor: default }
.zp-studio-start.is-primary { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, var(--dsw-alias-border-l1)); background: color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, var(--dsw-alias-bg-layer-1)) }
.zp-studio-start-icon { flex: none; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-brand-primary) }
.zp-studio-start-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px }
.zp-studio-start-name { font-size: 13px; line-height: 20px; font-weight: 600 }
.zp-studio-start-desc { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary) }
.zp-studio-start-arrow { flex: none; color: var(--dsw-alias-label-tertiary) }
.zp-studio-report-link { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; font-size: 12px; color: var(--dsw-alias-brand-primary) }
.zp-studio-thread { display: flex; flex-direction: column; gap: 12px }
.zp-msg { font-size: 13px; line-height: 22px; overflow-wrap: anywhere; animation: zp-fade-in .16s ease-out }
.zp-msg.is-user { align-self: flex-end; max-width: 88%; padding: 8px 12px; border-radius: 10px; background: var(--dsw-alias-bg-layer-2); white-space: pre-wrap }
.zp-msg.is-bot { width: 100% }
.zp-msg.is-bot .zp-md { font-size: 13.5px; line-height: 23px }
.zp-studio-error {
  flex: none; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin: 0 12px 8px; padding: 8px 12px; border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 36%, transparent);
  color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 18px;
}
.zp-studio-report-running {
  flex: none; display: flex; align-items: center; gap: 6px;
  margin: 0 12px 8px; padding: 8px 12px; border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary);
  font-size: 12px; line-height: 18px;
}
.zp-studio-suggest { flex: none; display: flex; flex-wrap: wrap; gap: 4px 6px; padding: 0 12px 8px }
.zp-studio-suggest button {
  height: 26px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1);
  background: transparent; color: var(--dsw-alias-label-secondary); font-size: 12px;
}
.zp-studio-suggest button:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary) }
.zp-studio-suggest button:disabled { opacity: .5; cursor: default }
.zp-studio-composer {
  flex: none; margin: 0 12px 12px; padding: 8px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1); box-shadow: var(--dsw-elevation-soft);
}
.zp-studio-composer:focus-within { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-border-l1)) }
.zp-studio-composer-row { display: flex; align-items: flex-end; gap: 6px }
.zp-studio-ta {
  flex: 1; min-width: 0; min-height: 44px; max-height: 132px; padding: 4px 6px;
  border: 0; outline: 0; background: transparent; resize: none;
  font-family: inherit; font-size: 13px; line-height: 21px; color: var(--dsw-alias-label-primary);
}
.zp-studio-ta::placeholder { color: var(--dsw-alias-label-tertiary) }
.zp-quote-chip {
  display: flex; align-items: center; gap: 4px; min-width: 0;
  margin-bottom: 6px; padding: 4px 8px; border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary);
  font-size: 11px; line-height: 16px;
}
.zp-quote-chip span { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis }
.zp-quote-chip button { flex: none; display: flex; color: var(--dsw-alias-label-tertiary) }
.zp-studio-disclaimer { flex: none; padding: 0 16px 12px; color: var(--dsw-alias-label-caption); font-size: 10.5px; line-height: 15px }
.zp-studio-chat .zp-typing { flex: none; padding: 2px 0 }
.zp-canvas-tabs { flex: none; display: flex; align-items: center; gap: 4px; padding: 8px 16px 0 }
.zp-canvas-tabs button {
  display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 12px;
  border-radius: 8px; border: 1px solid transparent; color: var(--dsw-alias-label-secondary); font-size: 12px;
}
.zp-canvas-tabs button:hover { background: var(--dsw-alias-bg-layer-2) }
.zp-canvas-tabs button.is-on { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary) }
.zp-report-artifact { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 12px 16px 16px; overflow: hidden }
.zp-report-idle { justify-content: center; overflow-y: auto }
.zp-report-head { flex: none; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap }
.zp-report-head h2 { font-size: 16px; line-height: 24px; font-weight: 650 }
.zp-report-meta { margin-top: 2px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px }
.zp-report-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap }
.zp-pill-btn {
  display: inline-flex; align-items: center; gap: 4px; height: 30px; padding: 0 12px;
  border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 12px;
}
.zp-pill-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary) }
.zp-pill-btn:disabled { opacity: .5; cursor: default }
.zp-pill-btn.is-primary { background: var(--zp-fill-accent); border-color: transparent; color: var(--dsw-alias-label-primary-inverted) }
.zp-body.is-studio-split .zp-report-chat-btn { display: none }
.zp-report-note { flex: none; margin-top: 8px; padding: 6px 8px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px }
.zp-report-layout { flex: 1; min-height: 0; display: flex; gap: 16px; margin-top: 12px }
.zp-report-toc { flex: 0 0 148px; min-width: 0; overflow-y: auto; padding-right: 8px; border-right: 1px solid var(--dsw-alias-border-l1) }
.zp-report-toc button { border: 0; background: transparent; font-family: inherit; cursor: pointer; display: block; width: 100%; padding: 4px 8px; border-radius: 6px; text-align: left; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px }
.zp-report-toc button:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary) }
.zp-report-toc button.is-on { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary) }
.zp-report-body { position: relative; flex: 1; min-width: 0; overflow-y: auto; padding: 0 8px 24px 0 }
.zp-report-sec { padding: 0 0 16px }
.zp-report-sec h2 { max-width: 720px; margin: 0 0 8px; font-size: 16px; line-height: 24px; font-weight: 600 }
.zp-report-prose { max-width: 720px; font-size: 13px; line-height: 23px; color: var(--dsw-alias-label-primary) }
.zp-report-prose p { margin: 0 0 8px }
.zp-report-prose ul, .zp-report-prose ol { margin: 0 0 8px; padding-left: 16px }
.zp-report-prose h3 { margin: 12px 0 6px; font-size: 14px; line-height: 22px; font-weight: 600 }
.zp-report-prose blockquote { margin: 0 0 8px; padding-left: 8px; border-left: 2px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary) }
.zp-report-pick {
  border: 0; cursor: pointer;
  position: absolute; z-index: 4; transform: translate(-50%, -100%);
  display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 12px;
  border-radius: 999px; background: var(--zp-fill-accent); color: var(--dsw-alias-label-primary-inverted);
  box-shadow: var(--dsw-elevation-prominent); font-size: 12px; white-space: nowrap;
}
.zp-report-progress-card { padding: 16px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; background: var(--dsw-alias-bg-layer-1); box-shadow: var(--dsw-elevation-soft) }
.zp-report-progress-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px }
.zp-report-progress-head b { display: block; font-size: 14px; line-height: 22px; font-weight: 600 }
.zp-report-progress-head span { display: block; margin-top: 2px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px }
.zp-report-bar { height: 6px; margin-top: 12px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); overflow: hidden }
.zp-report-bar i { display: block; height: 100%; border-radius: 999px; background: var(--zp-fill-accent); transition: width .3s ease }
.zp-report-steps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 12px; margin-top: 12px }
.zp-report-step { display: flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-tertiary); font-size: 11.5px; line-height: 17px }
.zp-report-step i { flex: none; display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l2) }
.zp-report-step.is-active { color: var(--dsw-alias-label-secondary) }
.zp-report-step.is-active i { box-shadow: inset 0 0 0 1.5px var(--dsw-alias-label-secondary) }
.zp-report-step.is-done { color: var(--dsw-alias-label-secondary) }
.zp-report-step.is-done i { background: var(--zp-fill-accent); color: var(--dsw-alias-label-primary-inverted); box-shadow: none }
.zp-report-current { margin-top: 12px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px }
.zp-report-error { max-width: 560px; margin: 0 auto; padding: 20px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 32%, transparent); background: var(--dsw-alias-bg-layer-1) }
.zp-report-error b { display: block; font-size: 14px; line-height: 22px; color: var(--dsw-alias-state-error-primary) }
.zp-report-error p { margin: 6px 0 12px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 19px }
.zp-report-empty { max-width: 640px; margin: auto; display: flex; flex-direction: column; align-items: flex-start; gap: 8px }
.zp-report-empty-icon { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-brand-primary) }
.zp-report-empty h2 { font-size: 20px; line-height: 28px; font-weight: 300 }
.zp-report-empty p { color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 21px }
.zp-report-section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 12px; margin: 4px 0 8px; width: 100%; color: var(--dsw-alias-label-secondary); font-size: 11.5px; line-height: 18px }
.zp-report-fine { color: var(--dsw-alias-label-caption); font-size: 10.5px; line-height: 16px }
.zp-reader { position: absolute; inset: 0; z-index: 65; display: flex; flex-direction: column; background: var(--dsw-alias-bg-base) }
.zp-reader-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--dsw-alias-border-l1) }
.zp-reader-title { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px }
.zp-reader-title b { font-size: 14px; line-height: 21px; font-weight: 600 }
.zp-reader-title span { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px }
.zp-reader-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap }
.zp-reader-body { flex: 1; min-height: 0; padding: 16px 24px 24px; display: flex }
.zp-reader .zp-report-layout { flex: 1; min-height: 0 }
.zp-reader .zp-report-toc { flex-basis: 180px }
.zp-reader .zp-report-body { padding-right: 24px }
.zp-reader .zp-report-sec h2 { font-size: 20px; line-height: 28px }
.zp-reader .zp-report-prose { font-size: 14px; line-height: 26px }
.zp-toast {
  position: absolute; z-index: 80; left: 50%; bottom: 24px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; max-width: min(520px, calc(100% - 32px));
  padding: 8px 16px; border-radius: 10px; background: var(--dsw-alias-label-primary);
  color: var(--dsw-alias-label-primary-inverted); box-shadow: var(--dsw-elevation-prominent);
  font-size: 12px; line-height: 18px; animation: zp-fade-in .16s ease-out;
}
.zp-toast.is-error { background: var(--dsw-alias-state-error-primary) }
.zp-toast button { border: 0; background: transparent; cursor: pointer; flex: none; color: inherit; text-decoration: underline; text-underline-offset: 2px }
.zp-settings-local { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; border-top: 1px solid var(--dsw-alias-border-l1); margin-top: 8px }
.zp-settings-local b { font-size: 12px; line-height: 18px; font-weight: 600 }
.zp-settings-local > span { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 17px }
.zp-settings-confirm { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px }
.zp-settings-confirm span { color: var(--dsw-alias-state-error-primary); font-size: 11px; line-height: 16px }
.zp-root[data-studio="1"][data-w="mid"] .zp-report-section-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) }
.zp-root[data-w="narrow"] .zp-studio-chat { flex-basis: auto; width: 100%; border-right: 0 }
.zp-root[data-w="narrow"] .zp-report-layout { flex-direction: column; gap: 8px }
.zp-root[data-w="narrow"] .zp-report-toc { flex: none; display: flex; gap: 4px; overflow-x: auto; padding: 0 0 6px; border-right: 0; border-bottom: 1px solid var(--dsw-alias-border-l1) }
.zp-root[data-w="narrow"] .zp-report-toc button { width: auto; white-space: nowrap }
.zp-root[data-w="narrow"] .zp-report-section-grid { grid-template-columns: 1fr }
.zp-root[data-w="narrow"] .zp-report-steps { grid-template-columns: 1fr }
.zp-root[data-w="narrow"] .zp-reader-head { flex-wrap: wrap }
.zp-root[data-w="narrow"] .zp-reader-body { padding: 12px 16px 16px }

/* ---------------- v5 抽屉（默认解读形态） ---------------- */
.zp-drawer-overlay { position: absolute; inset: 0; z-index: 55; display: flex; justify-content: flex-end }
.zp-drawer-mask {
  position: absolute; inset: 0; animation: zp-fade-in .14s ease-out;
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 26%, transparent);
}
.zp-drawer {
  position: relative; z-index: 1; width: min(560px, 100%); height: 100%; min-width: 0;
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--dsw-alias-bg-base); border-left: 1px solid var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-prominent);
  animation: zp-drawer-in .2s cubic-bezier(.2, .8, .2, 1) both;
}
@keyframes zp-drawer-in { from { opacity: 0; transform: translateX(16px) } }
.zp-drawer-head {
  flex: none; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.zp-drawer-title { flex: 1 1 150px; min-width: 0; display: flex; flex-direction: column; gap: 2px }
.zp-drawer-title b { font-size: 13px; line-height: 20px; font-weight: 600 }
.zp-drawer-title span { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.zp-drawer-tabs { display: inline-flex; align-items: center; gap: 2px; padding: 4px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); flex: none }
.zp-drawer-tabs button {
  display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent;
  height: 26px; padding: 0 12px; border-radius: 6px; color: var(--dsw-alias-label-secondary);
  font-family: inherit; font-size: 12px; cursor: pointer; white-space: nowrap;
}
.zp-drawer-tabs button.is-on { background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); box-shadow: var(--dsw-elevation-soft) }
.zp-drawer-actions { display: flex; align-items: center; gap: 2px; flex: none }
.zp-drawer-body { flex: 1; min-height: 0; display: flex; flex-direction: column }
.zp-drawer .zp-studio-chat { flex: 1 1 auto; width: auto; border-right: 0 }
.zp-drawer .zp-studio-scroll { padding: 16px }
.zp-drawer .zp-studio-composer { margin: 0 12px 8px }
.zp-drawer .zp-studio-disclaimer { padding: 0 16px 8px }
.zp-drawer .zp-report-artifact { flex: 1; min-height: 0; padding: 12px 16px 16px }
.zp-drawer .zp-report-head h2 { font-size: 16px; line-height: 24px }
.zp-drawer .zp-report-actions { gap: 4px }
.zp-drawer .zp-pill-btn { height: 28px; padding: 0 12px; font-size: 11px }
.zp-drawer .zp-report-toc { flex-basis: 124px }
.zp-drawer .zp-report-prose { font-size: 13px; line-height: 22px; max-width: none }
.zp-drawer .zp-report-sec h2 { font-size: 16px; max-width: none }
.zp-drawer .zp-report-chat-btn { display: none }
.zp-root[data-w="narrow"] .zp-drawer { width: 100%; border-left: 0; box-shadow: none }

/* ---------------- 深色主题：内容色提亮一档 ---------------- */
body[data-ds-dark-theme] .zp-root {
  --zp-accent: #a78bfa;
  --zp-accent-deep: #7c5cf0;
  --zp-fill-accent: #6a4fe0;
  --zp-fill-accent-deep: #5840c0;
  --zp-gold: #d8b877;
  --zp-gold-dim: #b9a075;
  --zp-mu-lu: #4ade80;
  --zp-mu-quan: #7aa2ff;
  --zp-mu-ke: #e3b341;
  --zp-mu-ji: #f87171;
  --zp-good: #4ade80;
  --zp-bad: #f87171;
}
body[data-ds-dark-theme] .zp-star.major { color: color-mix(in srgb, var(--zp-star-color, #fff) 58%, #fff) }
body[data-ds-dark-theme] .zp-star.good { color: var(--zp-good) }
body[data-ds-dark-theme] .zp-star.bad { color: var(--zp-bad) }
body[data-ds-dark-theme] .zp-star-none { border-color: var(--dsw-alias-border-l2) }
body[data-ds-dark-theme] .zp-mark-body { color: #2a2210 }
body[data-ds-dark-theme] .zp-mu-badge { color: #14161a }
body[data-ds-dark-theme] .zp-preview-frame { background: #FAF6EF }
body[data-ds-dark-theme] .zp-mu { background: color-mix(in srgb, currentColor 18%, transparent) }

/* ---------------- 动效偏好 ---------------- */
@media (prefers-reduced-motion: reduce) {
  .zp-root *, .zp-root *::before, .zp-root *::after { transition: none !important; animation: none !important }
}
`;

    /* ---------------- 界面纯逻辑 ----------------
     * 无副作用、不依赖 React，由 apply() 暴露为 window.ZWUi 供自检断言
     * （见 verify/verify.mjs 与 docs/specs/2026-11-18_v5-ux-polish.md）。 */
    var ZWUI = {
      /* 报告收尾正文。流式增量已累计进 accumulated；done 是本轮全文。
         续写时本轮全文只接在续写前正文 base 之后，不能再接在 accumulated 之后（否则重复）。 */
      mergeReportText: function (o) {
        var done = String((o && o.done) || '');
        if (o && o.cont) return String(o.base || '') + done;
        return done || String((o && o.accumulated) || '');
      },
      /* 对话流式写入：host 的 delta 是增量片段。
         new = 另起一个回答气泡；append = 接在本轮气泡后；replace = 用 done 的本轮全文替换本轮气泡。 */
      applyAssistantText: function (thread, text, mode) {
        var copy = (thread || []).slice();
        var last = copy[copy.length - 1];
        var s = String(text || '');
        if (mode !== 'new' && last && last.role === 'assistant') {
          copy[copy.length - 1] = { role: 'assistant', content: mode === 'replace' ? s : String(last.content || '') + s };
          return copy;
        }
        copy.push({ role: 'assistant', content: s });
        return copy;
      },
      /* 宫位的「宫名 干支」。引擎宫位对象只有 stem/branch，没有 gz 字段。 */
      palaceLabel: function (p) {
        if (!p) return '';
        return String(p.name || '') + ' ' + String(p.stem || '') + String(p.branch || '');
      },
      /* 引用宫位时带给模型的文本：宫名 干支 · 主星与辅星名；无星时写空宫。 */
      palaceQuoteText: function (p, emptyLabel) {
        if (!p) return '';
        var names = [].concat(p.major || [], p.minor || []).map(function (s) { return s && s.name; }).filter(Boolean);
        return ZWUI.palaceLabel(p) + ' · ' + (names.length ? names.join('、') : String(emptyLabel || ''));
      },
      /* 报告选段浮动按钮的坐标。按钮绝对定位在可滚动的正文容器内，
         所以视口差之外还要加上容器的滚动量；左/上保留最小边距。 */
      pickPoint: function (rangeRect, boxRect, scrollTop, scrollLeft) {
        return {
          x: Math.max(80, rangeRect.left - boxRect.left + (scrollLeft || 0)),
          y: Math.max(32, rangeRect.top - boxRect.top + (scrollTop || 0))
        };
      }
    };

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
        try {
          if (box && typeof box.setAttribute === 'function') box.setAttribute('data-dsh-automatic-focus', '');
          if (box && typeof box.focus === 'function') box.focus();
        } catch (e) { /* ignore */ }
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

    /* ---------------- 排盘输入 ---------------- */
    function InputForm(props) {
      var f = props.form;
      var t = props.t;
      var set = props.setForm;
      var collapsed = !!props.collapsed;
      var onToggle = props.onToggleCollapse || function () { };
      var lunarMode = f.calendar === 'lunar';
      var leapAvailable = lunarMode && E.leapMonth(+f.year) === +f.month;
      var pad2 = function (v) { return ('0' + (+v || 0)).slice(-2); };
      var birthText = [
        f.year + '-' + pad2(f.month) + '-' + pad2(f.day),
        pad2(f.hour) + ':' + pad2(f.minute),
        f.gender === 'female' ? t('female') : t('male'),
        (f.longitude === '' || f.longitude === null || f.longitude === undefined) ? t('uncorrected') : f.longitude + '°E'
      ].join(' · ');

      var setSetting = function (k, v) {
        var next = Object.assign({}, f.settings);
        next[k] = v;
        set({ settings: next });
      };

      var formBody = [
        h('div', { key: 'r1', className: 'zp-row', style: { gap: 8, alignItems: 'flex-start' } },
          h('div', { className: 'zp-field', style: { flex: 1, marginBottom: 9 } },
            h('label', { className: 'zp-field-label' }, t('name')),
            h('input', {
              className: 'zp-input', type: 'text', value: f.name || '', maxLength: 20,
              placeholder: t('namePh'), 'aria-label': t('name'),
              onChange: function (ev) { set({ name: ev.target.value }); }
            })),
          h('div', { className: 'zp-field', style: { flex: 1, marginBottom: 9 } },
            h('label', { className: 'zp-field-label' }, t('calendar')),
            h(Seg, {
              value: f.calendar,
              options: [{ value: 'solar', label: t('solar') }, { value: 'lunar', label: t('lunar') }],
              onChange: function (v) { set({ calendar: v, isLeap: false }); }
            }))),
        h('div', { key: 'r2', className: 'zp-field' },
          h('label', { className: 'zp-field-label' }, t('year') + ' / ' + t('month') + ' / ' + t('day')),
          h('div', { className: 'zp-row' },
            h('input', {
              className: 'zp-input', type: 'number', value: f.year, min: 1900, max: 2100, style: { flex: 1, minWidth: 0 },
              'aria-label': t('year'),
              onChange: function (ev) { set({ year: ev.target.value }); }
            }),
            h('input', {
              className: 'zp-input', type: 'number', value: f.month, min: 1, max: 12, style: { width: 58, flex: 'none' },
              'aria-label': t('month'),
              onChange: function (ev) { set({ month: ev.target.value }); }
            }),
            h('input', {
              className: 'zp-input', type: 'number', value: f.day, min: 1, max: 30, style: { width: 58, flex: 'none' },
              'aria-label': t('day'),
              onChange: function (ev) { set({ day: ev.target.value }); }
            }),
            lunarMode ? h('label', { className: 'zp-row', style: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)', gap: 4, flex: 'none' } },
              h('input', {
                type: 'checkbox', checked: !!f.isLeap, disabled: !leapAvailable,
                onChange: function (ev) { set({ isLeap: ev.target.checked }); }
              }), t('leap')) : null)),
        h('div', { key: 'r3', className: 'zp-field' },
          h('label', { className: 'zp-field-label' }, t('time') + ' · ' + t('gender')),
          h('div', { className: 'zp-row' },
            h('input', {
              className: 'zp-input', type: 'number', value: f.hour, min: 0, max: 23, style: { width: 58, flex: 'none' },
              'aria-label': t('hour'),
              onChange: function (ev) { set({ hour: ev.target.value }); }
            }),
            h('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', flex: 'none' } }, t('hour')),
            h('input', {
              className: 'zp-input', type: 'number', value: f.minute, min: 0, max: 59, style: { width: 58, flex: 'none' },
              'aria-label': t('minute'),
              onChange: function (ev) { set({ minute: ev.target.value }); }
            }),
            h('div', { style: { flex: 1, minWidth: 96 } },
              h(Seg, {
                value: f.gender,
                options: [{ value: 'male', label: t('male') }, { value: 'female', label: t('female') }],
                onChange: function (v) { set({ gender: v }); }
              })))),
        h('div', { key: 'r4', className: 'zp-row', style: { gap: 8, alignItems: 'flex-start' } },
          h('div', { className: 'zp-field', style: { flex: 1, marginBottom: 9 } },
            h('label', { className: 'zp-field-label' }, t('lonLabel')),
            h('input', {
              className: 'zp-input', type: 'number', value: f.longitude, min: 60, max: 140, step: 'any',
              placeholder: t('lonPh'), 'aria-label': t('lonLabel'),
              onChange: function (ev) { set({ longitude: ev.target.value }); }
            })),
          h('div', { className: 'zp-field', style: { flex: 1, marginBottom: 9 } },
            h('label', { className: 'zp-field-label' }, t('placeLabel')),
            h('input', {
              className: 'zp-input', type: 'text', value: f.place || '', maxLength: 30,
              placeholder: t('placePh'), 'aria-label': t('placeLabel'),
              onChange: function (ev) { set({ place: ev.target.value }); }
            }))),
        h('div', { key: 'r5', className: 'zp-field' },
          h('label', { className: 'zp-field-label' }, t('occupationLabel')),
          h('input', {
            className: 'zp-input', type: 'text', value: f.occupation || '', maxLength: 60,
            placeholder: t('occupationPh'), 'aria-label': t('occupationLabel'),
            onChange: function (ev) { set({ occupation: ev.target.value }); }
          })),
        h('details', { key: 'r6', style: { marginBottom: 10 } },
          h('summary', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer', letterSpacing: '.5px' } }, t('settings')),
          h('div', { style: { paddingTop: 8 } },
            h('div', { className: 'zp-field' },
              h('label', { className: 'zp-field-label' }, t('yearDivide')),
              h(Seg, {
                value: f.settings.yearDivide,
                options: [{ value: 'normal', label: t('ydNormal') }, { value: 'exact', label: t('ydExact') }],
                onChange: function (v) { setSetting('yearDivide', v); }
              })),
            h('div', { className: 'zp-field' },
              h('label', { className: 'zp-field-label' }, t('monthDivide')),
              h(Seg, {
                value: f.settings.monthDivide,
                options: [{ value: 'normal', label: t('mdNormal') }, { value: 'exact', label: t('mdExact') }],
                onChange: function (v) { setSetting('monthDivide', v); }
              }),
              h('div', { className: 'zp-settings-hint' }, t('monthDivideHint'))),
            h('div', { className: 'zp-field' },
              h('label', { className: 'zp-field-label' }, t('dayDivide')),
              h(Seg, {
                value: f.settings.dayDivide,
                options: [{ value: 'forward', label: t('ddForward') }, { value: 'current', label: t('ddCurrent') }],
                onChange: function (v) { setSetting('dayDivide', v); }
              })),
            h('div', { className: 'zp-field' },
              h('label', { className: 'zp-field-label' }, t('fixLeap')),
              h(Seg, {
                value: f.settings.fixLeap,
                options: [{ value: true, label: t('flTrue') }, { value: false, label: t('flFalse') }],
                onChange: function (v) { setSetting('fixLeap', v); }
              })))),
        h('button', { key: 'r7', className: 'zp-btn' + (props.hasChart ? '' : ' zp-btn-primary'), type: 'button', style: { width: '100%' }, onClick: props.onCompute },
          t('compute'))
      ];
      if (props.error) formBody.push(h('div', { key: 'r8', className: 'zp-error' }, props.error));
      formBody.push(h('div', { key: 'r9', className: 'zp-note' },
        h('div', null, t('note1')),
        h('div', null, t('note2'))));

      return h('div', { className: 'zp-card zp-input-card', 'data-region': 'SIDE_FORM' },
        h('div', { className: 'zp-card-title' }, t('formTitle'),
          h('span', { className: 'zp-title-actions' },
            h('button', { className: 'zp-link-btn', type: 'button', onClick: onToggle },
              collapsed ? t('expandForm') : t('collapseForm')))),
        collapsed
          ? h('div', { className: 'zp-birth-line' },
            h('span', { className: 'zp-birth-text' }, h('b', null, f.name || t('defaultName')), '　' + birthText),
            h('button', { className: 'zp-btn', type: 'button', style: { height: 30 }, onClick: onToggle }, t('editBirth')),
            h('button', { className: 'zp-btn' + (props.hasChart ? '' : ' zp-btn-primary'), type: 'button', style: { height: 30 }, onClick: props.onCompute }, t('compute')))
          : h('div', null, formBody),
        collapsed && props.error ? h('div', { className: 'zp-error' }, props.error) : null);
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

    /* ---------------- 命盘库 ---------------- */
    function Library(props) {
      var t = props.t;
      var [name, setName] = useState('');
      return h('div', { className: 'zp-card zp-lib-card', 'data-region': 'SIDE_LIBRARY' },
        h('div', { className: 'zp-card-title' }, t('libTitle')),
        h('div', { className: 'zp-row', style: { marginBottom: 8 } },
          h('input', {
            className: 'zp-input', type: 'text', value: name, maxLength: 20, style: { flex: 1, minWidth: 0 },
            placeholder: t('libName'), 'aria-label': t('libName'),
            onChange: function (ev) { setName(ev.target.value); }
          }),
          h('button', {
            className: 'zp-btn', type: 'button',
            disabled: !props.hasChart || !name.trim(),
            onClick: function () {
              if (props.onSave(name)) setName('');
            }
          }, t('libSave'))),
        props.items.length === 0
          ? h('div', { style: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' } }, t('libEmpty'))
          : props.items.map(function (item) {
            return h('div', {
              key: item.id, className: 'zp-list-item' + (props.current === item.id ? ' on' : ''),
              onClick: function () { props.onLoad(item); }
            },
              h('b', null, item.name),
              h('span', { className: 'zp-list-sub' }, item.input.year + '-' + item.input.month + '-' + item.input.day),
              h('button', {
                className: 'zp-list-del', type: 'button', title: t('libDelete'),
                onClick: function (ev) { ev.stopPropagation(); props.onDelete(item.id); }
              }, '×'));
          }));
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
              t('triPalace') + ' · ' + props.chart.palaces[tri2].name),
            props.onQuote ? h('button', { className: 'zp-btn', type: 'button', onClick: props.onQuote }, t('quotePalace')) : null)),
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
      caret: [
        ['path', { d: 'M6.2 3.6L10.6 8l-4.4 4.4' }]
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
      ],
      quote: [
        ['path', { d: 'M3 3.4h10M3 6.2h10M3 9h6.4' }],
        ['path', { d: 'M3 12.6h4.4' }]
      ],
      refresh: [
        ['path', { d: 'M13 7.6A5 5 0 1 1 11.4 4' }],
        ['path', { d: 'M13.2 2.6v3.2H10' }]
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

    /* ---------------- 解读记录：按命盘存本地（localStorage） ----------------
       同一生辰 + 同一排盘设置视为同一张盘；聊天、完整报告、最后停留的画布页签
       一起保存。只写浏览器本地，不上传；最多 8 张盘，每张最多 24 条消息。 */
    var READINGS_KEY = 'ziwei-pro.readings.v2';
    var READINGS_V1_KEY = 'ziwei-pro.readings.v1';
    var LAST_CHART_KEY = 'ziwei-pro.lastChart.v1';
    var READINGS_MAX = 8;
    function emptyReport() {
      return { status: 'idle', text: '', startedAt: 0, finishedAt: 0, error: '', issue: null };
    }
    function normalizeReport(r) {
      if (!r || typeof r !== 'object') return emptyReport();
      var status = ['idle', 'running', 'done', 'error'].indexOf(r.status) >= 0 ? r.status : 'idle';
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
    function readingInput(input) {
      var x = input || {};
      var lon = x.longitude;
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
    function readingKeyOf(input) {
      var x = readingInput(input);
      var st = x.settings || {};
      /* 排盘设置会改变命盘（月柱口径 / 晚子时 / 闰月），必须进 key，否则换设置会套回旧解读 */
      var settingsKey = [st.yearDivide || 'normal', st.monthDivide || 'exact', st.dayDivide || 'current', st.fixLeap === false ? 0 : 1].join(',');
      return [x.calendar, x.year, x.month, x.day, x.isLeap ? 1 : 0, x.hour, x.minute, x.gender, x.longitude, settingsKey].join('|');
    }
    function readStorageMap(key) {
      try {
        var raw = JSON.parse(localStorage.getItem(key) || '{}');
        return raw && typeof raw === 'object' ? raw : {};
      } catch (e) { return {}; }
    }
    function loadReadingMap() { return readStorageMap(READINGS_KEY); }
    function loadLegacyReadingMap() { return readStorageMap(READINGS_V1_KEY); }
    function writeReadingMap(map) {
      try { localStorage.setItem(READINGS_KEY, JSON.stringify(map)); return true; } catch (e) { return false; }
    }
    function trimReadings(map) {
      var keys = Object.keys(map).sort(function (a, b) { return (map[b].updatedAt || 0) - (map[a].updatedAt || 0); });
      keys.slice(READINGS_MAX).forEach(function (k) { delete map[k]; });
      return map;
    }
    function cleanThread(thread) {
      return (Array.isArray(thread) ? thread : []).slice(-24).map(function (m) {
        return {
          role: m && m.role === 'user' ? 'user' : 'assistant',
          content: String((m && m.content) || '').slice(0, 60000)
        };
      }).filter(function (m) { return m.role === 'user' || m.content; });
    }
    function saveReadingRecord(key, data) {
      if (!key) return;
      var map = loadReadingMap();
      var thread = cleanThread(data && data.thread);
      var report = normalizeReport(data && data.report);
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
        updatedAt: Date.now()
      };
      trimReadings(map);
      var tries = 0;
      while (!writeReadingMap(map) && tries < READINGS_MAX) {
        tries++;
        var keys = Object.keys(map).sort(function (a, b) { return (map[a].updatedAt || 0) - (map[b].updatedAt || 0); });
        if (!keys.length) break;
        delete map[keys[0]];
      }
    }
    function findLegacyReading(key) {
      if (!key) return null;
      /* v1 key = 前 9 段生辰；v1.7 起第 10 段是排盘设置。旧记录可迁移一次。 */
      var prefix = String(key).split('|').slice(0, 9).join('|');
      var map = loadLegacyReadingMap();
      var hit = null;
      Object.keys(map).some(function (k) {
        if (k === prefix || k.indexOf(prefix + '|') === 0) { hit = map[k]; return true; }
        return false;
      });
      if (!hit) return null;
      var thread = cleanThread(hit.thread);
      var report = emptyReport();
      if (hit.hasReport) {
        for (var i = thread.length - 1; i >= 0; i--) {
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
      var rec = loadReadingMap()[key];
      if (!rec) rec = findLegacyReading(key);
      if (!rec || typeof rec !== 'object') return null;
      var thread = cleanThread(rec.thread);
      var report = normalizeReport(rec.report);
      if (!thread.length && !String(report.text || '').trim()) return null;
      return {
        thread: thread,
        report: report,
        studioTab: rec.studioTab === 'report' ? 'report' : 'chat',
        updatedAt: rec.updatedAt || 0
      };
    }
    function clearReadingRecord(key) {
      if (!key) return;
      var map = loadReadingMap();
      var changed = false;
      if (map[key]) { delete map[key]; changed = true; }
      if (changed) writeReadingMap(map);
      /* 清掉同生辰的旧版记录，避免迁移后残留 */
      var legacy = loadLegacyReadingMap();
      var prefix = String(key).split('|').slice(0, 9).join('|');
      var legacyChanged = false;
      Object.keys(legacy).forEach(function (k) {
        if (k === prefix || k.indexOf(prefix + '|') === 0) { delete legacy[k]; legacyChanged = true; }
      });
      if (legacyChanged) {
        try { localStorage.setItem(READINGS_V1_KEY, JSON.stringify(legacy)); } catch (e) { /* ignore */ }
      }
    }
    function clearAllReadings() {
      try { localStorage.removeItem(READINGS_KEY); } catch (e) { /* ignore */ }
      try { localStorage.removeItem(READINGS_V1_KEY); } catch (e) { /* ignore */ }
      try { localStorage.removeItem(LAST_CHART_KEY); } catch (e) { /* ignore */ }
    }
    function saveLastChart(input) {
      try { localStorage.setItem(LAST_CHART_KEY, JSON.stringify(readingInput(input))); } catch (e) { /* ignore */ }
    }
    function loadLastChart() {
      try {
        var raw = JSON.parse(localStorage.getItem(LAST_CHART_KEY) || 'null');
        return raw && raw.year ? readingInput(raw) : null;
      } catch (e) { return null; }
    }

    /* ---------------- 解读工位：聊天 / 报告产物 ---------------- */
    var REPORT_SECTION_TITLES = [
      '命盘总览', '性格大略', '家庭关系', '婚姻情感', '子女培育', '财富管理', '健康养生',
      '事业发展', '朋友贵人', '居家风水', '心灵福德', '出行迁移', '大限节奏', '综合建议'
    ];
    function splitReportSections(md) {
      var lines = String(md || '').split('\n');
      var out = [];
      var cur = { title: '', body: [] };
      lines.forEach(function (line) {
        var m = /^##\s+(.+?)\s*$/.exec(line);
        if (m) {
          if (cur.title || cur.body.join('').trim()) out.push(cur);
          cur = { title: m[1].replace(/^[一二三四五六七八九十百]+、\s*/, ''), body: [] };
        } else {
          cur.body.push(line);
        }
      });
      if (cur.title || cur.body.join('').trim()) out.push(cur);
      if (!out.length) out.push({ title: '', body: lines });
      return out.map(function (sec, i) {
        return { title: sec.title || REPORT_SECTION_TITLES[i] || ('第 ' + (i + 1) + ' 部分'), html: renderChatMd(sec.body.join('\n')) };
      });
    }
    function countReportSections(md) {
      var m = String(md || '').match(/^##\s+/gm);
      return m ? Math.min(m.length, REPORT_SECTION_TITLES.length) : 0;
    }
    function fmtClock(ts) {
      if (!ts) return '';
      var d = new Date(ts);
      return ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + ' ' +
        ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    function StudioChat(props) {
      var t = props.t;
      var [q, setQ] = useState('');
      var scrollRef = useRef(null);
      var taRef = useRef(null);
      var stickRef = useRef(true);
      var thread = props.thread || [];
      var lastAssistant = '';
      for (var i = thread.length - 1; i >= 0; i--) {
        if (thread[i].role === 'assistant') { lastAssistant = thread[i].content || ''; break; }
      }
      useEffect(function () {
        var el = scrollRef.current;
        if (el && stickRef.current) el.scrollTop = el.scrollHeight;
      }, [thread, props.streaming]);
      useEffect(function () {
        var el = taRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 132) + 'px';
      }, [q]);
      var submit = function (text) {
        var value = String(text == null ? q : text).trim();
        if (!value || props.streaming || props.reportRunning) return;
        setQ('');
        props.onAsk(value);
      };
      var start = function (mode) {
        if (props.streaming || props.reportRunning) return;
        if (mode === 'report') props.onGenerateReport();
        else props.onAsk('');
      };
      var startBtn = function (mode, iconName, name, desc, primary) {
        return h('button', {
          className: 'zp-studio-start' + (primary ? ' is-primary' : ''), type: 'button',
          disabled: props.streaming || props.reportRunning,
          onClick: function () { start(mode); }
        },
        h('span', { className: 'zp-studio-start-icon' }, h(Icon, { name: iconName, size: 15 })),
        h('span', { className: 'zp-studio-start-copy' },
          h('span', { className: 'zp-studio-start-name' }, name),
          h('span', { className: 'zp-studio-start-desc' }, desc)),
        h('span', { className: 'zp-studio-start-arrow' }, h(Icon, { name: 'caret', size: 14 })));
      };
      var hasThread = thread.length > 0;
      return h('aside', { className: 'zp-studio-chat', 'aria-label': t('studioChatLabel') },
        props.hideHead ? null : h('header', { className: 'zp-studio-head' },
          h('button', {
            className: 'zp-icon-btn', type: 'button', title: t('modeChart'), 'aria-label': t('modeChart'),
            onClick: props.onExit
          }, h(Icon, { name: 'back' })),
          h('div', { className: 'zp-studio-title' },
            h('b', null, t('aiTitle')),
            h('span', null, props.contextLine + (props.selectedPalace ? ' · ' + props.selectedPalace : ''))),
          h('div', { className: 'zp-studio-head-actions' },
            hasThread ? h('button', {
              className: 'zp-icon-btn', type: 'button', title: t('aiNewChat'), 'aria-label': t('aiNewChat'),
              disabled: props.streaming || props.reportRunning, onClick: props.onClear
            }, h(Icon, { name: 'newChat' })) : null,
            props.onHandoff ? h('button', {
              className: 'zp-icon-btn', type: 'button', title: t('handoffHint'), 'aria-label': t('handoff'),
              disabled: props.streaming || props.reportRunning, onClick: props.onHandoff
            }, h(Icon, { name: 'handoff' })) : null,
            props.onOpenReport && props.hasReport ? h('button', {
              className: 'zp-icon-btn', type: 'button', title: t('reportOpen'), 'aria-label': t('reportOpen'),
              onClick: props.onOpenReport
            }, h(Icon, { name: 'report' })) : null)),
        h('div', {
          className: 'zp-studio-scroll', ref: scrollRef,
          onScroll: function (ev) {
            var el = ev.currentTarget;
            stickRef.current = (el.scrollHeight - el.scrollTop - el.clientHeight) < 48;
          }
        },
        !hasThread
          ? h('div', { className: 'zp-studio-empty' },
            h('div', { className: 'zp-studio-empty-title' }, t('studioEmptyTitle')),
            h('div', { className: 'zp-studio-empty-hint' }, t('studioEmptyHint')),
            h('div', { className: 'zp-studio-start-list' },
              startBtn('brief', 'sparkle', t('aiStartBrief'), t('aiStartBriefDesc'), true),
              startBtn('report', 'report', t('aiStartReport'), t('aiStartReportDesc'), false)),
            props.hasReport ? h('button', {
              className: 'zp-studio-report-link', type: 'button', onClick: props.onOpenReport
            }, h(Icon, { name: 'report', size: 13 }), t('reportOpen')) : null)
          : h('div', { className: 'zp-studio-thread zp-chat-thread', role: 'log', 'aria-live': 'polite', 'aria-busy': props.streaming ? 'true' : 'false' },
            thread.map(function (m, idx) {
              if (m.role !== 'user' && !String(m.content || '').trim()) return null;
              return h('div', { key: 'm' + idx, className: 'zp-msg ' + (m.role === 'user' ? 'is-user' : 'is-bot') },
                m.role === 'user'
                  ? m.content
                  : h('div', { className: 'zp-md', dangerouslySetInnerHTML: { __html: renderChatMd(m.content) } }));
            }),
            props.streaming ? h('div', { className: 'zp-typing' },
              h('span', { className: 'zp-typing-dots', 'aria-hidden': true }, h('i'), h('i'), h('i')),
              h('span', null, props.thinkChars ? t('aiThinking') : t('interpStreaming'))) : null),
        props.interpError ? h('div', { className: 'zp-studio-error' },
          h('span', null, props.interpError),
          props.interpIssue && props.interpIssue.canContinue
            ? h('button', { className: 'zp-mini-btn', type: 'button', disabled: props.streaming, onClick: props.onContinue }, t('aiContinue'))
            : null) : null,
        props.reportRunning ? h('div', { className: 'zp-studio-report-running' },
          h(Icon, { name: 'report', size: 13 }), t('reportRunningHint')) : null),
        props.suggestions && props.suggestions.length
          ? h('div', { className: 'zp-studio-suggest' }, props.suggestions.slice(0, 4).map(function (s, si) {
            return h('button', { key: si, type: 'button', disabled: props.streaming || props.reportRunning, onClick: function () { submit(s); } }, s);
          })) : null,
        h('div', { className: 'zp-studio-composer' },
          props.quote ? h('div', { className: 'zp-quote-chip' },
            h(Icon, { name: 'quote', size: 12 }),
            h('span', { title: props.quote.text }, props.quote.label + '：' + String(props.quote.text || '').slice(0, 70)),
            h('button', { type: 'button', title: t('quoteRemove'), 'aria-label': t('quoteRemove'), onClick: props.onClearQuote }, h(Icon, { name: 'close', size: 11 }))) : null,
          h('div', { className: 'zp-studio-composer-row' },
            h('textarea', {
              className: 'zp-studio-ta', rows: 2, ref: taRef, value: q,
              placeholder: props.streaming || props.reportRunning ? t('studioWaitPh') : t('aiAskPh'),
              'aria-label': t('aiAskPh'),
              disabled: props.reportRunning,
              onChange: function (ev) { setQ(ev.target.value); },
              onKeyDown: function (ev) {
                if (ev.nativeEvent && ev.nativeEvent.isComposing) return;
                if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); submit(); }
              }
            }),
            props.streaming || props.reportRunning
              ? h('button', { className: 'zp-send zp-send-stop', type: 'button', title: t('aiStop'), 'aria-label': t('aiStop'), onClick: props.onStop },
                h(Icon, { name: 'stop', size: 15 }))
              : h('button', { className: 'zp-send', type: 'button', disabled: !q.trim(), title: t('aiSend'), 'aria-label': t('aiSend'), onClick: function () { submit(); } },
                h(Icon, { name: 'send', size: 15 })))),
        h('div', { className: 'zp-studio-disclaimer' }, t('disclaimerShort')));
    }

    function StudioDrawer(props) {
      var t = props.t;
      var boxRef = useDialogFocus();
      var tab = props.tab === 'report' ? 'report' : 'chat';
      var hasThread = (props.thread || []).length > 0;
      var busy = props.streaming || props.reportRunning;
      return h('div', { className: 'zp-drawer-overlay' },
        h('div', { className: 'zp-drawer-mask', onClick: props.onClose, 'aria-hidden': true }),
        h('aside', {
          className: 'zp-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('aiTitle'),
          tabIndex: -1, ref: boxRef, onKeyDown: function (ev) { trapTab(ev, ev.currentTarget); }
        },
        h('header', { className: 'zp-drawer-head' },
          h('div', { className: 'zp-drawer-title' },
            h('b', null, t('aiTitle')),
            h('span', null, props.contextLine + (props.selectedPalace ? ' · ' + props.selectedPalace : ''))),
          h('div', { className: 'zp-drawer-tabs', role: 'tablist', 'aria-label': t('studioTabs') },
            h('button', {
              type: 'button', role: 'tab', 'aria-selected': tab === 'chat',
              className: tab === 'chat' ? 'is-on' : '',
              onClick: function () { props.onTab('chat'); }
            }, t('studioChatTab')),
            h('button', {
              type: 'button', role: 'tab', 'aria-selected': tab === 'report',
              className: tab === 'report' ? 'is-on' : '',
              onClick: function () { props.onTab('report'); }
            }, h(Icon, { name: 'report', size: 12 }), t('studioReportTab'),
            (props.hasReport || props.reportRunning) ? h('i', { className: 'zp-mode-dot', 'aria-hidden': true }) : null)),
          h('div', { className: 'zp-drawer-actions' },
            hasThread ? h('button', {
              className: 'zp-icon-btn', type: 'button', title: t('aiNewChat'), 'aria-label': t('aiNewChat'),
              disabled: busy, onClick: props.onClear
            }, h(Icon, { name: 'newChat' })) : null,
            h('button', {
              className: 'zp-icon-btn', type: 'button', title: t('handoffHint'), 'aria-label': t('handoff'),
              disabled: busy, onClick: props.onHandoff
            }, h(Icon, { name: 'handoff' })),
            h('button', {
              className: 'zp-icon-btn', type: 'button', title: t('close'), 'aria-label': t('close'), onClick: props.onClose
            }, h(Icon, { name: 'close' })))),
        h('div', { className: 'zp-drawer-body' },
          tab === 'report'
            ? h(ReportArtifact, {
              t: t,
              report: props.report,
              copied: props.reportCopied,
              onGenerate: props.onGenerate,
              onStop: props.onStop,
              onCopy: props.onReportCopy,
              onExport: props.onExport,
              onReader: props.onReader,
              onQuote: props.onQuote,
              onChat: function () { props.onTab('chat'); }
            })
            : h(StudioChat, {
              t: t,
              hideHead: true,
              thread: props.thread,
              streaming: props.streaming,
              reportRunning: props.reportRunning,
              thinkChars: props.thinkChars,
              interpError: props.interpError,
              interpIssue: props.interpIssue,
              hasReport: props.hasReport,
              quote: props.quote,
              suggestions: props.suggestions,
              contextLine: props.contextLine,
              selectedPalace: props.selectedPalace,
              onExit: props.onClose,
              onClear: props.onClear,
              onAsk: props.onAsk,
              onGenerateReport: props.onGenerateReport,
              onOpenReport: function () { props.onTab('report'); },
              onClearQuote: props.onClearQuote,
              onContinue: props.onContinue,
              onStop: props.onStop,
              onHandoff: props.onHandoff
            }))));
    }

    function ReportProgress(props) {
      var t = props.t;
      var text = props.report.text || '';
      var done = countReportSections(text);
      var running = props.report.status === 'running';
      var current = Math.min(done + 1, REPORT_SECTION_TITLES.length);
      var chars = text.replace(/\s/g, '').length;
      var pct = Math.round((done / REPORT_SECTION_TITLES.length) * 100);
      return h('div', { className: 'zp-report-progress-card' },
        h('div', { className: 'zp-report-progress-head' },
          h('div', null,
            h('b', null, running ? t('reportWriting') : t('reportPaused')),
            h('span', null, t('reportProgressMeta').replace('{n}', done).replace('{total}', REPORT_SECTION_TITLES.length).replace('{chars}', chars))),
          running ? h('button', { className: 'zp-mini-btn', type: 'button', onClick: props.onStop }, t('aiStop')) : null),
        h('div', { className: 'zp-report-bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
          h('i', { style: { width: pct + '%' } })),
        h('div', { className: 'zp-report-steps' }, REPORT_SECTION_TITLES.map(function (name, i) {
          var state = i < done ? 'is-done' : (running && i === done ? 'is-active' : '');
          return h('div', { key: i, className: 'zp-report-step ' + state },
            h('i', null, i < done ? h(Icon, { name: 'check', size: 9 }) : null),
            h('span', null, name));
        })),
        running ? h('div', { className: 'zp-report-current' },
          h('span', { className: 'zp-shimmer' }, t('reportCurrent').replace('{n}', current).replace('{name}', REPORT_SECTION_TITLES[current - 1] || ''))) : null);
    }

    function ReportDocument(props) {
      var t = props.t;
      var sections = props.sections || [];
      var [active, setActive] = useState(0);
      var bodyRef = useRef(null);
      var [pick, setPick] = useState(null);
      var goto = function (idx) {
        setActive(idx);
        var el = bodyRef.current && bodyRef.current.querySelector('[data-sec="' + idx + '"]');
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      };
      var onPick = function () {
        var sel = window.getSelection && window.getSelection();
        var text = sel ? String(sel).trim() : '';
        if (!text || text.length < 4 || !bodyRef.current) { setPick(null); return; }
        var anchor = sel.anchorNode;
        if (!anchor || !bodyRef.current.contains(anchor)) { setPick(null); return; }
        try {
          var range = sel.getRangeAt(0);
          var rect = range.getBoundingClientRect();
          var box = bodyRef.current.getBoundingClientRect();
          var pt = ZWUI.pickPoint(rect, box, bodyRef.current.scrollTop, bodyRef.current.scrollLeft);
          setPick({ text: text.slice(0, 2400), x: pt.x, y: pt.y });
        } catch (e) { setPick(null); }
      };
      return h('div', { className: 'zp-report-layout' },
        h('nav', { className: 'zp-report-toc', 'aria-label': t('reportToc') },
          sections.map(function (sec, i) {
            return h('button', { key: i, type: 'button', className: active === i ? 'is-on' : '', onClick: function () { goto(i); } }, sec.title);
          })),
        h('div', { className: 'zp-report-body', ref: bodyRef, onMouseUp: onPick, onScroll: function () { if (pick) setPick(null); } },
          sections.map(function (sec, i) {
            return h('section', { key: i, className: 'zp-report-sec', 'data-sec': i },
              h('h2', null, sec.title),
              h('div', { className: 'zp-report-prose', dangerouslySetInnerHTML: { __html: sec.html } }));
          }),
          pick ? h('button', {
            className: 'zp-report-pick', type: 'button', style: { left: pick.x, top: pick.y },
            onMouseDown: function (ev) { ev.preventDefault(); },
            onClick: function () { props.onQuote({ label: t('reportQuoteLabel'), text: pick.text }); setPick(null); }
          }, h(Icon, { name: 'quote', size: 12 }), t('reportQuoteAction')) : null));
    }

    function ReportArtifact(props) {
      var t = props.t;
      var report = props.report || emptyReport();
      var running = report.status === 'running';
      var done = report.status === 'done';
      var sections = useMemo(function () { return splitReportSections(report.text); }, [report.text]);
      var chars = String(report.text || '').replace(/\s/g, '').length;
      if (done) {
        var sectionCount = Math.min(sections.length, REPORT_SECTION_TITLES.length);
        return h('div', { className: 'zp-report-artifact' },
          h('header', { className: 'zp-report-head' },
            h('div', null,
              h('h2', null, t('reportTitle')),
              h('div', { className: 'zp-report-meta' },
                (sectionCount || REPORT_SECTION_TITLES.length) + ' / ' + REPORT_SECTION_TITLES.length + ' 部分 · ' + chars + ' 字' +
                (report.finishedAt ? ' · ' + fmtClock(report.finishedAt) : ''))),
            h('div', { className: 'zp-report-actions' },
              props.onChat ? h('button', { className: 'zp-pill-btn zp-report-chat-btn', type: 'button', onClick: props.onChat },
                h(Icon, { name: 'back', size: 13 }), t('modeRead')) : null,
              h('button', { className: 'zp-pill-btn', type: 'button', onClick: props.onReader },
                h(Icon, { name: 'expand', size: 13 }), t('reportReader')),
              h('button', { className: 'zp-pill-btn', type: 'button', onClick: props.onExport },
                h(Icon, { name: 'export', size: 13 }), t('exportHtml')),
              h('button', { className: 'zp-pill-btn', type: 'button', onClick: props.onCopy },
                h(Icon, { name: props.copied ? 'check' : 'copy', size: 13 }), props.copied ? t('aiCopied') : t('aiCopy')),
              h('button', { className: 'zp-pill-btn', type: 'button', disabled: running, onClick: function () { props.onGenerate(false); } },
                h(Icon, { name: 'refresh', size: 13 }), t('reportRegenerate')))),
          sectionCount < REPORT_SECTION_TITLES.length
            ? h('div', { className: 'zp-report-note' }, t('reportPartial'))
            : null,
          h(ReportDocument, {
            t: t, sections: sections,
            onQuote: function (q) { props.onQuote(q); }
          }));
      }
      return h('div', { className: 'zp-report-artifact zp-report-idle' },
        running ? h(ReportProgress, { t: t, report: report, onStop: props.onStop }) : null,
        !running && report.status === 'error'
          ? h('div', { className: 'zp-report-error' },
            h('b', null, t('reportError')),
            h('p', null, report.error || t('reportErrorHint')),
            h('div', { className: 'zp-report-actions' },
              report.text ? h('button', { className: 'zp-pill-btn', type: 'button', onClick: function () { props.onGenerate(true); } }, t('aiContinue')) : null,
              h('button', { className: 'zp-pill-btn is-primary', type: 'button', onClick: function () { props.onGenerate(false); } }, t('reportRegenerate'))))
          : null,
        !running && report.status !== 'error'
          ? h('div', { className: 'zp-report-empty' },
            h('div', { className: 'zp-report-empty-icon' }, h(Icon, { name: 'report', size: 20 })),
            h('h2', null, t('reportIdleTitle')),
            h('p', null, t('reportIdleHint')),
            h('div', { className: 'zp-report-section-grid' }, REPORT_SECTION_TITLES.map(function (name, i) {
              return h('span', { key: i }, ('0' + (i + 1)).slice(-2) + ' ' + name);
            })),
            h('button', { className: 'zp-btn zp-btn-primary', type: 'button', onClick: function () { props.onGenerate(false); } },
              h(Icon, { name: 'sparkle', size: 14 }), t('reportGenerate')),
            h('div', { className: 'zp-report-fine' }, t('reportFinePrint')))
          : null);
    }

    function ReportReader(props) {
      var t = props.t;
      var report = props.report || emptyReport();
      var sections = useMemo(function () { return splitReportSections(report.text); }, [report.text]);
      var ref = useDialogFocus();
      var [fs, setFs] = useState(false);
      var boxRef = useRef(null);
      useEffect(function () {
        var onEsc = function (ev) {
          if (ev.key === 'Escape') { ev.preventDefault(); if (fs && document.exitFullscreen) { document.exitFullscreen().catch(function () {}); } else props.onClose(); }
        };
        window.addEventListener('keydown', onEsc);
        return function () { window.removeEventListener('keydown', onEsc); };
      }, [fs]);
      var toggleFullscreen = function () {
        var el = boxRef.current;
        if (!el) return;
        try {
          if (!document.fullscreenElement && el.requestFullscreen) {
            el.requestFullscreen().then(function () { setFs(true); }).catch(function () {});
          } else if (document.exitFullscreen) {
            document.exitFullscreen().then(function () { setFs(false); }).catch(function () {});
          }
        } catch (e) { /* ignore */ }
      };
      return h('div', { className: 'zp-reader', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('reportTitle'), tabIndex: -1, ref: function (el) { boxRef.current = el; ref.current = el; }, onKeyDown: function (ev) { trapTab(ev, ev.currentTarget); } },
        h('header', { className: 'zp-reader-head' },
          h('button', { className: 'zp-icon-btn', type: 'button', title: t('backToBoard'), 'aria-label': t('backToBoard'), onClick: props.onClose }, h(Icon, { name: 'back' })),
          h('div', { className: 'zp-reader-title' },
            h('b', null, t('reportTitle')),
            h('span', null, String(report.text || '').replace(/\s/g, '').length + ' 字 · ' + t('reportReader'))),
          h('div', { className: 'zp-reader-actions' },
            h('button', { className: 'zp-pill-btn', type: 'button', onClick: toggleFullscreen }, h(Icon, { name: 'expand', size: 13 }), fs ? t('exitFullscreen') : t('fullscreen')),
            h('button', { className: 'zp-pill-btn', type: 'button', onClick: props.onExport }, h(Icon, { name: 'export', size: 13 }), t('exportHtml')),
            h('button', { className: 'zp-pill-btn', type: 'button', onClick: props.onCopy }, h(Icon, { name: props.copied ? 'check' : 'copy', size: 13 }), props.copied ? t('aiCopied') : t('aiCopy')),
            h('button', { className: 'zp-icon-btn', type: 'button', title: t('close'), 'aria-label': t('close'), onClick: props.onClose }, h(Icon, { name: 'close' })))),
        h('div', { className: 'zp-reader-body' },
          h(ReportDocument, { t: t, sections: sections, onQuote: props.onQuote })));
    }

    function Toast(props) {
      if (!props.toast) return null;
      return h('div', { className: 'zp-toast' + (props.toast.error ? ' is-error' : ''), role: 'status', 'aria-live': 'polite' },
        h('span', null, props.toast.text),
        props.toast.undo ? h('button', { type: 'button', onClick: props.toast.undo }, '撤销') : null);
    }

    /* ---------------- 设置：面板内居中弹层 ---------------- */
    function SettingsModal(props) {
      var t = props.t;
      var boxRef = useDialogFocus();
      var [update, setUpdate] = useState(null);
      var [confirmClear, setConfirmClear] = useState(false);
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
              h('div', { className: 'zp-settings-local' },
                h('b', null, t('localDataTitle')),
                h('span', null, t('localDataHint')),
                confirmClear
                  ? h('div', { className: 'zp-settings-confirm' },
                    h('span', null, t('clearLocalConfirm')),
                    h('button', { className: 'zp-mini-btn', type: 'button', onClick: function () { props.onClearAll(); setConfirmClear(false); } }, t('confirmClear')),
                    h('button', { className: 'zp-mini-btn', type: 'button', onClick: function () { setConfirmClear(false); } }, t('cancel')))
                  : h('button', { className: 'zp-mini-btn', type: 'button', onClick: function () { setConfirmClear(true); } }, t('clearLocal'))),
              h('div', { className: 'zp-settings-about' },
                h('b', null, t('about')),
                h('span', null, t('aboutText')),
                h('span', { className: 'zp-settings-sign' }, t('signature')),
                h('span', { className: 'zp-settings-contact' }, t('contactWechat')))))));
    }

    /* ---------------- 主应用 ---------------- */
    function ProApp(props) {
      var t = props.t;
      var actions = props.actions;

      /* 表单与命盘 */
      var [form, setFormRaw] = useState(function () {
        var init = Object.assign({}, DEFAULT_FORM);
        try {
          var saved = JSON.parse(localStorage.getItem('ziwei-pro.form') || 'null');
          if (saved && typeof saved === 'object') {
            Object.keys(init).forEach(function (k) { if (saved[k] !== undefined) init[k] = saved[k]; });
            if (saved.settings && typeof saved.settings === 'object') init.settings = Object.assign({}, init.settings, saved.settings);
          }
        } catch (e) { /* ignore */ }
        /* v1.3.3 一次性迁移：旧版把默认 monthDivide='normal'（农历月）连同表单一起持久化，
           升级后仅改默认值不会生效；这里把「旧默认」改写成节气并写回，只做一次。
           迁移之后用户显式选择的「农历月」不会再被覆盖。 */
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
      var [chart, setChart] = useState(null);
      var [error, setError] = useState('');
      var [selected, setSelected] = useState(-1);
      var [tab, setTab] = useState('natal');
      var [selDecadal, setSelDecadal] = useState(0);
      /* v3：默认停在「当前大限」，而不是第 0 段（3–12 岁）——旧默认会让用户打开大限页就看到童年。 */
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
      var [yearlyYear, setYearlyYear] = useState(String(new Date().getFullYear()));

      /* 布局：面板实测宽度（0 = 尚未测量，按窄面板安全兜底）、专注看盘、生辰输入折叠 */
      var [panelW, setPanelW] = useState(0);
      var [focus, setFocus] = useState(function () {
        try { return localStorage.getItem('ziwei-pro.focus') === '1'; } catch (e) { return false; }
      });
      var [formCollapsed, setFormCollapsed] = useState(false);
      /* v3：左栏可收起（窄屏出盘后自动收起，给盘面让宽）；view 区分「盘面」与工具视图 */
      var [railOpen, setRailOpenState] = useState(function () {
        try { return localStorage.getItem('ziwei-pro.rail') !== '0'; } catch (e) { return true; }
      });
      var setRail = function (v) {
        setRailOpenState(!!v);
        try { localStorage.setItem('ziwei-pro.rail', v ? '1' : '0'); } catch (e) { /* ignore */ }
      };
      var [view, setView] = useState('chart');

      /* 命盘库 */
      var [library, setLibrary] = useState(function () {
        try { return JSON.parse(localStorage.getItem('ziwei-pro.library') || '[]'); } catch (e) { return []; }
      });
      var [currentLibId, setCurrentLibId] = useState(null);

      /* 偏好。旧版曾在 localStorage 明文保存 DeepSeek API Key（已无消费方），
         这里启动时清掉残留，避免升级后继续把密钥留在浏览器里。 */
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

      /* AI / 工位状态 */
      var [modal, setModal] = useState(null);
      var [interpreting, setInterpreting] = useState(false);   /* 聊天流 */
      var [thread, setThread] = useState([]);
      var [report, setReport] = useState(emptyReport);          /* 完整报告是独立产物 */
      var [studioOpen, setStudioOpenState] = useState(function () {
        try { return localStorage.getItem('ziwei-pro.studio') === '1'; } catch (e) { return false; }
      });
      var setStudioOpen = function (v) {
        setStudioOpenState(!!v);
        try { localStorage.setItem('ziwei-pro.studio', v ? '1' : '0'); } catch (e) { /* ignore */ }
      };
      var [studioTab, setStudioTab] = useState('chat');         /* 抽屉页签: chat | report */
      var [mobilePane, setMobilePane] = useState('chat');      /* 窄屏工位: chat | chart（预留，当前由 CSS 切换） */
      var [interpError, setInterpError] = useState('');
      var [interpIssue, setInterpIssue] = useState(null);   /* {kind, canContinue}: 截断/断连/超时的结构化原因 */
      var [thinkChars, setThinkChars] = useState(0);        /* 思考阶段已产出的字数（来自 start/thinking 事件） */
      var [interpCopied, setInterpCopied] = useState(false);
      var [reportCopied, setReportCopied] = useState(false);
      var [handoffDone, setHandoffDone] = useState(false);
      var [synced, setSynced] = useState(false);
      var [quote, setQuote] = useState(null);               /* {label, text}: 宫位/报告选段引用 */
      var [readerOpen, setReaderOpen] = useState(false);
      var [toast, setToast] = useState(null);
      var toastTimerRef = useRef(null);
      var showToast = function (text, opts) {
        var o = opts || {};
        setToast({ text: String(text || ''), error: !!o.error, undo: o.undo || null, key: Date.now() });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(function () { setToast(null); }, o.undo ? 6000 : 3200);
      };
      var chartKeyRef = useRef('');
      var reportRunning = report.status === 'running';
      var hasReport = report.status === 'done' && !!report.text;
      var lastMode = hasReport ? 'report' : 'brief';
      var busy = interpreting || reportRunning;

      /* 面板宽度监听：布局切换与盘面缩放都靠它，避免用 viewport media query 误判面板宽度 */
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
      var toggleFocus = function () {
        setFocus(function (prev) {
          var next = !prev;
          try { localStorage.setItem('ziwei-pro.focus', next ? '1' : '0'); } catch (e) { /* ignore */ }
          return next;
        });
      };

      /* 浮层（抽屉 / 设置）是 .zp-root 内的绝对定位层：只在工作台范围内出现，
         不按视口坐标算位置，也不受祖先 transform / 侧栏变化影响；打开时锁住背景滚动。 */
      var openModal = function (name) { setModal(name); };
      var closeModal = function () { setModal(null); };
      useEffect(function () {
        if (!modal) return undefined;
        var onEsc = function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); setModal(null); } };
        window.addEventListener('keydown', onEsc);
        return function () { window.removeEventListener('keydown', onEsc); };
      }, [modal]);

      /* 换盘：设置命盘状态，并按「命盘 key」恢复/清空解读记录 */
      var adoptChart = function (result, input) {
        var key = readingKeyOf(input);
        chartKeyRef.current = key;
        setChart(result);
        setSelected(result.soulIndex);
        setSelDecadal(currentDecadeIndex(result));
        setYearlyYear(String(new Date().getFullYear()));
        setTab('natal');
        setView('chart');
        var saved = loadReadingRecord(key);
        if (saved) {
          setThread(saved.thread || []);
          setReport(normalizeReport(saved.report));
          setStudioTab(saved.studioTab === 'report' ? 'report' : 'chat');
        } else {
          setThread([]);
          setReport(emptyReport());
          setStudioTab('chart');
        }
        setStudioOpen(false);
        setMobilePane('chat');
        setInterpError('');
        setInterpIssue(null);
        setThinkChars(0);
        setError('');
        setFormCollapsed(true);
        if (panelW > 0 && panelW < 908) setRail(false);
        saveLastChart(input);
      };

      /* 启动时恢复上一次的命盘；解读记录随命盘 key 一起回来。没有记录就停在空态。 */
      var restoredRef = useRef(false);
      useEffect(function () {
        if (restoredRef.current) return;
        restoredRef.current = true;
        var input = loadLastChart();
        if (!input) return;
        var result;
        try {
          result = E.computeChart({
            calendar: input.calendar,
            year: +input.year, month: +input.month, day: +input.day,
            isLeapMonth: !!input.isLeap,
            hour: +input.hour, minute: +input.minute,
            gender: input.gender,
            longitude: input.longitude === '' ? undefined : +input.longitude,
            settings: input.settings
          });
        } catch (e) { return; }
        if (!result || result.error) return;
        var nextForm = Object.assign({}, DEFAULT_FORM, input, {
          settings: Object.assign({}, DEFAULT_FORM.settings, input.settings || {})
        });
        setFormRaw(nextForm);
        try { localStorage.setItem('ziwei-pro.form', JSON.stringify(nextForm)); } catch (e) { /* ignore */ }
        adoptChart(result, input);
      }, []);

      /* 解读记录落盘：流式过程中不写，结束（interpreting=false）后一次写；
         清空对话（thread=[]）则删除这张盘的记录。 */
      useEffect(function () {
        var key = chartKeyRef.current;
        if (!key || !chart) return;
        if (interpreting || report.status === 'running') return;
        var hasAnswer = false;
        for (var hi = 0; hi < thread.length; hi++) {
          if (thread[hi].role === 'assistant' && String(thread[hi].content || '').trim()) { hasAnswer = true; break; }
        }
        if (!hasAnswer && report.status !== 'done') { clearReadingRecord(key); return; }
        saveReadingRecord(key, {
          thread: thread, report: report, studioTab: studioTab, name: form.name
        });
      }, [thread, report, studioTab, interpreting, chart, form.name]);

      var compute = function () {
        setError('');
        var input = {
          name: form.name, calendar: form.calendar,
          year: +form.year, month: +form.month, day: +form.day,
          isLeap: !!form.isLeap, hour: +form.hour, minute: +form.minute,
          gender: form.gender, longitude: form.longitude,
          place: form.place, occupation: form.occupation, settings: form.settings
        };
        var result = E.computeChart({
          calendar: input.calendar, year: input.year, month: input.month, day: input.day,
          isLeapMonth: input.isLeap, hour: input.hour, minute: input.minute,
          gender: input.gender,
          longitude: (input.longitude === '' || input.longitude === null || input.longitude === undefined) ? undefined : +input.longitude,
          settings: input.settings
        });
        if (!result || result.error) { setError((result && result.error) || '排盘失败'); return; }
        adoptChart(result, input);
      };

      /* 大限/流年/格局 */
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

      /* 键盘导航：只在舞台（盘面）内部获得焦点时接管方向键，避免全局劫持页面滚动/其他输入区 */
      var onStageKeyDown = function (ev) {
        if (!chart || modal) return;
        var target = ev.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'left'); }); }
        else if (ev.key === 'ArrowRight') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'right'); }); }
        else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); setSelected(function (s) { return ringStep(s < 0 ? chart.soulIndex : s, 'opp'); }); }
      };

      /* 命盘库操作 */
      var saveChart = function (name) {
        if (!chart || !name || !String(name).trim()) return false;
        var entry = {
          id: 'lib-' + Date.now(),
          name: name.trim(),
          input: {
            name: form.name, calendar: form.calendar, year: form.year, month: form.month, day: form.day,
            isLeap: form.isLeap, hour: form.hour, minute: form.minute, gender: form.gender,
            longitude: form.longitude, place: form.place, occupation: form.occupation,
            settings: form.settings
          }
        };
        var next = [entry].concat(library).slice(0, 60);
        setLibrary(next);
        setCurrentLibId(entry.id);
        try { localStorage.setItem('ziwei-pro.library', JSON.stringify(next)); } catch (e) { /* ignore */ }
        return true;
      };
      var loadSaved = function (item) {
        var input = readingInput(item.input);
        var result;
        try {
          result = E.computeChart({
            calendar: input.calendar,
            year: input.year, month: input.month, day: input.day,
            isLeapMonth: input.isLeap,
            hour: input.hour, minute: input.minute,
            gender: input.gender,
            longitude: input.longitude === '' ? undefined : +input.longitude,
            settings: input.settings
          });
        } catch (e) { setError(String((e && e.message) || e)); return; }
        if (!result || result.error) { setError((result && result.error) || '排盘失败'); return; }
        var nextForm = Object.assign({}, DEFAULT_FORM, input, {
          settings: Object.assign({}, DEFAULT_FORM.settings, input.settings || {})
        });
        setFormRaw(nextForm);
        try { localStorage.setItem('ziwei-pro.form', JSON.stringify(nextForm)); } catch (e) { /* ignore */ }
        setCurrentLibId(item.id);
        adoptChart(result, input);
      };
      var deleteSaved = function (id) {
        var prev = library;
        var next = library.filter(function (x) { return x.id !== id; });
        setLibrary(next);
        if (currentLibId === id) setCurrentLibId(null);
        try { localStorage.setItem('ziwei-pro.library', JSON.stringify(next)); } catch (e) { /* ignore */ }
        showToast(t('libDeleted'), { undo: function () {
          setLibrary(prev);
          try { localStorage.setItem('ziwei-pro.library', JSON.stringify(prev)); } catch (e) { /* ignore */ }
          showToast(t('undoDone'));
        } });
      };
      var reportMeta = function () {
        return {
          chart: chart, name: form.name, place: form.place, occupation: form.occupation,
          gender: form.gender === 'female' ? 'female' : 'male'
        };
      };
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
        } catch (e) { /* 回退原生文本 */ }
        return E.chartText(chart);
      };

      /* 面板内「直接聊」/「写报告」共用一个 SSE 通道；报告与聊天是两条独立状态。 */
      var chatAbortRef = useRef(null);
      var stopReqRef = useRef(false);
      var buildInterpretBody = function (mode, question, history) {
        var pos = nowPosition();
        var selectedDecade = (tab === 'decadal' && decadalList[selDecadal]) ? decadalList[selDecadal].ageRange : null;
        return {
          chartText: chartContextText(),
          mode: mode === 'report' ? 'report' : 'brief',
          question: question || '',
          history: (history || []).slice(-20),
          meta: {
            name: form.name, place: form.place, occupation: form.occupation,
            gender: form.gender === 'female' ? 'female' : 'male',
            currentAge: pos.currentAge, currentYear: pos.currentYear,
            decadalFocus: selectedDecade,
            yearlyFocus: (tab === 'yearly') ? (parseInt(yearlyYear, 10) || pos.currentYear) : null
          }
        };
      };
      var openStream = function (opts) {
        var body = buildInterpretBody(opts.mode, opts.question, opts.history);
        var controller = null;
        try { controller = new AbortController(); chatAbortRef.current = controller; } catch (e) { controller = null; }
        var settled = false;
        var gotDone = false;
        var produced = '';
        var finish = function (err, issue) {
          if (settled) return;
          settled = true;
          chatAbortRef.current = null;
          if (opts.onFinish) opts.onFinish(err || '', issue || null, produced);
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
          if (opts.onOpen) opts.onOpen();
          var reader = resp.body.getReader();
          var decoder = new TextDecoder();
          var buf = '';
          var pump = function () {
            return reader.read().then(function (chunk) {
              if (chunk.done) {
                if (!gotDone) finish(t('aiDisconnected'), { kind: 'stream-closed', canContinue: !!produced.trim() });
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
                if (ev === 'start') {
                  if (opts.onStart) opts.onStart();
                } else if (ev === 'thinking') {
                  if (opts.onThinking) opts.onThinking((payload && payload.chars) || 0);
                } else if (ev === 'delta' && payload && payload.text) {
                  produced += payload.text;
                  if (opts.onDelta) opts.onDelta(payload.text);
                } else if (ev === 'done') {
                  gotDone = true;
                  if (opts.onDone) opts.onDone((payload && typeof payload.text === 'string') ? payload.text : produced);
                  finish('');
                } else if (ev === 'error') {
                  finish((payload && payload.reason) || '解读失败', payload);
                }
              });
              return pump();
            });
          };
          return pump();
        }).catch(function (e) {
          if (e && e.name === 'AbortError') {
            if (stopReqRef.current) finish(t('aiStopped'), { kind: 'stopped', canContinue: !!produced.trim() });
            else finish('');
            return;
          }
          finish(String((e && e.message) || e), { kind: 'error', canContinue: !!produced.trim() });
        });
      };

      var appendAssistant = function (text, mode) {
        setThread(function (prev) { return ZWUI.applyAssistantText(prev, text, mode); });
      };

      var runChat = function (question) {
        if (!chart || busy) return;
        var asked = (question || '').trim();
        var history = thread.map(function (m) { return { role: m.role, content: m.content }; });
        var nextThread = thread.concat(asked ? [{ role: 'user', content: asked }] : []);
        setThread(nextThread);
        setInterpreting(true);
        setInterpError('');
        setInterpIssue(null);
        setThinkChars(0);
        setHandoffDone(false);
        setQuote(null);
        stopReqRef.current = false;
        var added = false;
        openStream({
          mode: 'brief', question: asked, history: history,
          onStart: function () { setThinkChars(0); },
          onThinking: function (chars) { setThinkChars(chars); },
          onDelta: function (text) {
            setThinkChars(0);
            appendAssistant(text, added ? 'append' : 'new');
            added = true;
          },
          onDone: function (text) {
            if (text) appendAssistant(text, added ? 'replace' : 'new');
            added = true;
          },
          onFinish: function (err, issue) {
            setInterpreting(false);
            setThinkChars(0);
            setInterpError(err || '');
            setInterpIssue(issue || null);
          }
        });
      };

      var runReport = function (opts) {
        if (!chart || busy) return;
        var cont = !!(opts && opts.continue);
        setStudioOpen(true);
        setStudioTab('report');
        setMobilePane('chat');
        setInterpError('');
        setInterpIssue(null);
        setReportCopied(false);
        setQuote(null);
        var base = cont ? String(report.text || '') : '';
        setReport({
          status: 'running', text: base, startedAt: Date.now(), finishedAt: 0,
          error: '', issue: null
        });
        stopReqRef.current = false;
        openStream({
          mode: 'report',
          question: cont ? t('aiContinuePrompt') : '',
          history: cont && base ? [{ role: 'assistant', content: base }] : thread.slice(),
          onThinking: function (chars) { setThinkChars(chars); },
          onDelta: function (text) {
            setThinkChars(0);
            setReport(function (prev) { return Object.assign({}, prev, { text: (prev.text || '') + text }); });
          },
          onDone: function (text) {
            setReport(function (prev) {
              var full = ZWUI.mergeReportText({ cont: cont, base: base, accumulated: prev.text, done: text });
              return Object.assign({}, prev, { status: 'done', text: full, finishedAt: Date.now(), error: '', issue: null });
            });
          },
          onFinish: function (err, issue) {
            setReport(function (prev) {
              if (prev.status === 'done') return prev;
              return Object.assign({}, prev, { status: 'error', error: err || '', issue: issue || null, finishedAt: Date.now() });
            });
          }
        });
      };
      var stopInterpretation = function () {
        if (!chatAbortRef.current) return;
        stopReqRef.current = true;
        try { chatAbortRef.current.abort(); } catch (e) { /* ignore */ }
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
          if (j && j.ok) {
            setSynced(true);
            setTimeout(function () { setSynced(false); }, 2200);
            showToast(t('synced'));
          } else {
            showToast((j && j.reason) || t('syncFailed'), { error: true });
          }
        }).catch(function (e) { showToast(String((e && e.message) || e), { error: true }); });
      };

      var lastAnswer = function () {
        for (var i = thread.length - 1; i >= 0; i--) if (thread[i].role === 'assistant') return thread[i].content || '';
        return '';
      };
      var handoffToSession = function (mode) {
        if (!chart || busy) return;
        setHandoffDone(false);
        setInterpreting(true);
        var payload = {
          chartText: E.chartText(chart),
          fullText: chartContextText(),
          name: form.name || '',
          place: form.place || '',
          occupation: form.occupation || '',
          gender: form.gender === 'female' ? 'female' : 'male',
          interpretation: (mode === 'report' && hasReport) ? report.text : lastAnswer(),
          mode: mode === 'report' ? 'report' : 'brief'
        };
        fetch('/ziwei/handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
          .then(function (out) {
            setInterpreting(false);
            var j = out.j || {};
            if (j.ok && j.sessionId) {
              setHandoffDone(true);
              showToast(t('handoffDone'));
              setTimeout(function () { setHandoffDone(false); }, 3000);
              var tries = 0;
              var openIt = function () {
                tries += 1;
                if (actions.openSession(j.sessionId)) return;
                if (tries < 6) { setTimeout(openIt, 350 * tries); return; }
                showToast('会话已创建，但界面没能自动跳过去——请在左侧会话列表里打开新会话继续。', { error: true });
              };
              openIt();
            } else {
              showToast(j.reason || ('交给会话失败 (HTTP ' + out.status + ')'), { error: true });
            }
          })
          .catch(function (e) { setInterpreting(false); showToast(String((e && e.message) || e), { error: true }); });
      };

      var clearThread = function () {
        if (busy) return;
        var prev = thread;
        if (!prev.length) return;
        setThread([]);
        setInterpError('');
        setInterpIssue(null);
        setThinkChars(0);
        setQuote(null);
        showToast(t('aiThreadCleared'), { undo: function () { setThread(prev); showToast(t('undoDone')); } });
      };
      var clearAllReading = function () {
        if (busy) return;
        clearAllReadings();
        setThread([]);
        setReport(emptyReport());
        setStudioTab('chart');
        setInterpError('');
        setInterpIssue(null);
        setQuote(null);
        showToast(t('aiRecordCleared'));
      };

      var interpretation = useMemo(function () {
        for (var i = thread.length - 1; i >= 0; i--) if (thread[i].role === 'assistant') return thread[i].content || '';
        return '';
      }, [thread]);
      var copyText = function (text, done) {
        if (!text) return;
        var okay = function () { if (done) done(true); };
        var fail = function () { if (done) done(false); };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(okay).catch(fail);
            return;
          }
          fail();
        } catch (e) { fail(); }
      };
      var copyInterpretation = function () {
        if (!interpretation) return;
        copyText(interpretation, function (ok) {
          setInterpCopied(ok);
          if (ok) setTimeout(function () { setInterpCopied(false); }, 1600);
          else showToast(t('copyFailed'), { error: true });
        });
      };
      var copyReport = function () {
        if (!hasReport) return;
        copyText(report.text, function (ok) {
          setReportCopied(ok);
          if (ok) setTimeout(function () { setReportCopied(false); }, 1600);
          else showToast(t('copyFailed'), { error: true });
        });
      };
      var exportReportHtml = function () {
        if (!hasReport) { showToast(t('reportNeeded'), { error: true }); return; }
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
          showToast(t('exported'));
        } catch (e) {
          showToast(t('exportFailed') + ': ' + String((e && e.message) || e), { error: true });
        }
      };
      var [copied, setCopied] = useState(false);
      var copyChart = function () {
        if (!chart) return;
        copyText(E.chartText(chart), function (ok) {
          setCopied(ok);
          if (ok) setTimeout(function () { setCopied(false); }, 1600);
          else showToast(t('copyFailed'), { error: true });
        });
      };

      useEffect(function () {
        if (!autoOpen) return;
        var timer = setTimeout(function () { actions.autoOpenPanel(); }, 250);
        return function () { clearTimeout(timer); };
      }, []);

      /* 渲染（v3 布局：AppBar / TimeBar / ContextRail / ChartStage / BottomBar） */
      var palaceSelected = chart && selected >= 0 ? chart.palaces[selected] : null;
      /* 面板实测宽度 → 三档布局：看的是面板自身宽度，不是视口宽度（media query 会把盘面挤扁） */
      /* 四档：compact 档专治「DSH 侧栏展开 -> 面板 ~900-1070 -> 旧逻辑掉进单列、中栏被拉满」。 */
      var layoutMode = panelW <= 0 ? 'narrow'
        : (panelW >= 1394 ? 'wide'
        : (panelW >= 1072 ? 'mid'
        : (panelW >= 908 ? 'compact' : 'narrow')));
      /* 示例盘识别：用默认生辰且没有额外姓名/地点/经度；只用于提示，不改变数据 */
      var isSampleChart = !!chart &&
        form.calendar === DEFAULT_FORM.calendar &&
        +form.year === DEFAULT_FORM.year && +form.month === DEFAULT_FORM.month && +form.day === DEFAULT_FORM.day &&
        !form.isLeap && +form.hour === DEFAULT_FORM.hour && +form.minute === DEFAULT_FORM.minute &&
        form.gender === DEFAULT_FORM.gender && String(form.longitude || '') === '' &&
        !String(form.name || '').trim() && !String(form.place || '').trim();
      var modeDefs = [['natal', t('tabNatal')], ['decadal', t('tabDecadal')], ['yearly', t('tabYearly')]];
      var curAgeForDecade = nowPosition().currentAge;
      var currentDecadalIdx = -1;
      if (chart) {
        for (var ci = 0; ci < decadalList.length; ci++) {
          if (curAgeForDecade >= decadalList[ci].ageRange[0] && curAgeForDecade <= decadalList[ci].ageRange[1]) { currentDecadalIdx = ci; break; }
        }
      }
      useEffect(function () {
        if (!studioOpen) return undefined;
        var onEsc = function (ev) {
          if (ev.key === 'Escape' && !readerOpen) { ev.preventDefault(); setStudioOpen(false); }
        };
        window.addEventListener('keydown', onEsc);
        return function () { window.removeEventListener('keydown', onEsc); };
      }, [studioOpen, readerOpen]);
      var openStudio = function () {
        if (!chart) return;
        setStudioOpen(true);
        setMobilePane('chat');
        setStudioTab('chat');
      };
      var closeStudio = function () {
        setStudioOpen(false);
      };
      var openAI = function () {
        if (!chart) return;
        if (studioOpen) closeStudio(); else openStudio();
      };
      var askQuestion = function (text) {
        var value = String(text || '').trim();
        var q = quote;
        if (!q && palaceSelected && value === t('suggestPalace')) {
          q = { label: t('quotePalaceLabel'), text: ZWUI.palaceQuoteText(palaceSelected, t('emptyPalace')) };
        }
        if (q) {
          value = '【引用：' + q.label + '】\n' + q.text + '\n\n' + (value || '请针对这段展开说说。');
        }
        setQuote(null);
        setStudioTab('chart');
        runChat(value);
      };
      var generateReport = function (cont) {
        if (!chart) return;
        setStudioOpen(true);
        runReport({ continue: !!cont });
      };
      var continueChat = function () { runChat(t('aiContinuePrompt')); };
      var quoteFromReport = function (q) {
        setQuote(q);
        setStudioTab('chat');
        setStudioOpen(true);
        setMobilePane('chat');
      };
      var quotePalace = function () {
        if (!palaceSelected) return;
        setQuote({ label: t('quotePalaceLabel'), text: ZWUI.palaceQuoteText(palaceSelected, t('emptyPalace')) });
        openStudio();
      };
      var editBirth = function () {
        if (studioOpen) setStudioOpen(false);
        setRail(true);
        setFormCollapsed(false);
        try {
          var sc = rootRef.current && rootRef.current.querySelector('.zp-scroll');
          if (sc) { if (sc.scrollTo) sc.scrollTo({ top: 0, behavior: 'smooth' }); else sc.scrollTop = 0; }
        } catch (e) { /* ignore */ }
      };
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
      var timeNav = null;
      if (chart && view === 'chart' && tab === 'decadal' && decadalList.length) {
        timeNav = h('div', { className: 'zp-time-nav', role: 'group', 'aria-label': t('tabDecadal') },
          h('button', { className: 'zp-time-btn', type: 'button', title: t('prevDecade'), 'aria-label': t('prevDecade'), disabled: selDecadal <= 0, onClick: function () { stepDecade(-1); } }, '‹'),
          h('select', {
            className: 'zp-time-select', value: String(selDecadal), 'aria-label': t('tabDecadal'),
            onChange: function (ev) { setSelDecadal(parseInt(ev.target.value, 10) || 0); }
          }, decadalList.map(function (d, i) {
            return h('option', { key: i, value: String(i) }, d.ageRange[0] + '–' + d.ageRange[1] + ' 岁 · ' + d.stem + d.branch + ' · ' + d.palaceName);
          })),
          h('button', { className: 'zp-time-btn', type: 'button', title: t('nextDecade'), 'aria-label': t('nextDecade'), disabled: selDecadal >= decadalList.length - 1, onClick: function () { stepDecade(1); } }, '›'),
          currentDecadalIdx >= 0 && selDecadal !== currentDecadalIdx
            ? h('button', { className: 'zp-time-now', type: 'button', title: t('backToCurrent'), onClick: function () { setSelDecadal(currentDecadalIdx); } }, t('backToCurrent'))
            : (currentDecadalIdx >= 0 ? h('span', { className: 'zp-time-chip' }, t('currentBadge')) : null));
      } else if (chart && view === 'chart' && tab === 'yearly') {
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
      var timebar = chart ? h('div', { className: 'zp-timebar', 'data-region': 'TIMEBAR' },
        view === 'chart'
          ? h('div', { className: 'zp-tabs', role: 'tablist', 'aria-label': t('timeScope') },
            modeDefs.map(function (md) {
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
            className: 'zp-toggle' + (showAdj ? ' on' : ''), type: 'button', 'aria-pressed': !!showAdj,
            title: showAdj ? t('hideAdj') : t('showAdj'), onClick: function () { setShowAdj(!showAdj); }
          }, h(Icon, { name: 'adj', size: 12 }), t('adjChip')) : null,
          view === 'chart' ? h('button', {
            className: 'zp-toggle' + (focus ? ' on' : ''), type: 'button', 'aria-pressed': !!focus,
            title: focus ? t('focusOff') : t('focusOn'), onClick: toggleFocus
          }, h(Icon, { name: 'expand', size: 12 }), focus ? t('focusOff') : t('focusOn')) : null)) : null;

      /* 没盘时左栏必须始终可见（否则用户只剩空态、没有输入入口）；有盘才允许收起。 */
      var railVisible = !chart || railOpen;
      return h('div', {
        className: 'zp-root',
        ref: rootRef,
        'data-w': layoutMode,
        'data-chart': chart ? '1' : undefined,
        'data-rail': railVisible ? 'open' : 'closed',
        /* 没有盘时不能进专注态：否则左栏（生辰输入）被隐藏且没有退出按钮 */
        'data-focus': (focus && chart) ? '1' : undefined
      },
        h('div', { className: 'zp-scroll' + (modal ? ' zp-scroll-locked' : '') },
          h('div', { className: 'zp-inner' },
          h('div', { className: 'zp-head', 'data-region': 'HEAD' },
            /* 显式出口: 返回会话（不依赖侧栏，layout 服务缺失时不渲染） */
            actions.canReturnToConversation ? h('button', {
              className: 'zp-icon-btn zp-exit', type: 'button',
              title: t('backToConversation'), 'aria-label': t('backToConversation'),
              onClick: function () { actions.returnToConversation(); }
            }, h(Icon, { name: 'back' }), h('span', { className: 'zp-btn-label' }, t('backToConversation'))) : null,
            actions.canReturnToConversation ? h('span', { className: 'zp-head-sep' }) : null,
            /* 左栏开关：桌面/中档常驻，窄屏用底部「生辰」按钮 */
            chart && layoutMode !== 'narrow' ? h('button', {
              className: 'zp-icon-btn zp-rail-toggle', type: 'button',
              title: railVisible ? t('collapseRail') : t('expandRail'),
              'aria-label': railVisible ? t('collapseRail') : t('expandRail'),
              'aria-expanded': railVisible ? 'true' : 'false',
              'aria-controls': 'zp-rail',
              onClick: function () { setRail(!railVisible); }
            }, h(Icon, { name: 'panelLeft' })) : null,
            h('div', { className: 'zp-brand' },
              h('span', { className: 'zp-brand-name' }, t('brand')),
              h('span', { className: 'zp-brand-pro' }, t('brandPro'))),
            /* 窄屏头部只留图标，补一个紧凑命主摘要，避免头部空荡 */
            chart && layoutMode === 'narrow' ? h('span', {
              className: 'zp-sum-chip zp-head-mini',
              title: (form.name || t('defaultName')) + ' · ' + chart.fiveElementsClass
            }, (form.name || t('defaultName')) + ' · ' + chart.fiveElementsClass) : null,
            !chart ? h('span', { className: 'zp-brand-tag' }, t('tagline')) : null,
            chart ? h('div', { className: 'zp-head-sum' },
              h('span', { className: 'zp-sum-chip' }, h('b', null, form.name || t('defaultName'))),
              isSampleChart ? h('span', { className: 'zp-sample-badge' }, t('sampleChart')) : null,
              isSampleChart ? h('button', {
                className: 'zp-sample-switch', type: 'button', onClick: editBirth
              }, t('switchToMyBirth')) : null,
              h('span', { className: 'zp-sum-chip zp-sum-gz' },
                [chart.pillars.yearly, chart.pillars.monthly, chart.pillars.daily, chart.pillars.hourly].join(' ')),
              h('span', { className: 'zp-sum-chip zp-sum-class' }, chart.fiveElementsClass)) : null,
            h('div', { className: 'zp-head-actions' },
              chart ? h('button', {
                className: 'zp-icon-btn', type: 'button', title: t('copy'), 'aria-label': t('copy'), onClick: copyChart
              }, h(Icon, { name: 'copy' }), h('span', { className: 'zp-btn-label' }, copied ? t('copied') : t('copy'))) : null,
              chart ? h('button', {
                className: 'zp-icon-btn', type: 'button', title: t('syncHint'), 'aria-label': t('sync'), onClick: syncToSession
              }, h(Icon, { name: 'sync' }), h('span', { className: 'zp-btn-label' }, synced ? t('synced') : t('sync'))) : null,
              chart ? h('span', { className: 'zp-head-sep' }) : null,
              chart ? h('button', {
                className: 'zp-btn zp-btn-primary zp-btn-ai', type: 'button',
                'aria-pressed': studioOpen ? 'true' : 'false',
                onClick: openAI
              }, h(Icon, { name: 'sparkle', size: 14 }), h('span', null, studioOpen ? t('modeRead') : t('ai'))) : null,
              h('button', {
                className: 'zp-icon-btn', type: 'button', title: t('settingsTitle'), 'aria-label': t('settingsTitle'),
                'aria-pressed': modal === 'settings' ? 'true' : 'false',
                onClick: function () { if (modal === 'settings') closeModal(); else openModal('settings'); }
              }, h(Icon, { name: 'settings' })))),
          h('div', { className: 'zp-body' },
            h('div', { className: 'zp-side', id: 'zp-rail' },
              /* 阅读优先：有盘时 命主信息 → 格局摘要 → 排盘输入 → 命盘库；
                 无盘时 Summary/Patterns 不渲染，输入自然回到顶部。 */
              chart ? h(Summary, { chart: chart, t: t }) : null,
              chart ? h(PatternsSummary, { patterns: patterns, t: t, onOpen: function () { setView('patterns'); } }) : null,
              h(InputForm, {
                form: form, setForm: setForm, t: t, onCompute: compute, error: error, hasChart: !!chart,
                collapsed: formCollapsed,
                onToggleCollapse: function () { setFormCollapsed(!formCollapsed); }
              }),
              h(Library, { items: library, current: currentLibId, t: t, hasChart: !!chart, onSave: saveChart, onLoad: loadSaved, onDelete: deleteSaved })),
            h('div', { className: 'zp-stage', tabIndex: chart ? 0 : -1, onKeyDown: onStageKeyDown },
              h(React.Fragment, null,
              timebar,
              !chart ? h('div', { className: 'zp-empty', 'data-region': 'EMPTY' },
                h('div', { className: 'zp-empty-taiji' }, h(Taiji, null)),
                h('div', { className: 'zp-empty-title' }, t('brand') + ' ' + t('brandPro')),
                h('div', { className: 'zp-empty-hint' }, t('emptyState')),
                h('button', { className: 'zp-btn', type: 'button', onClick: compute }, t('emptyCta'))) : null,
              chart && view === 'chart' && tab === 'yearly' && yearlyChart && yearlyChart.error
                ? h('div', { className: 'zp-error', style: { marginBottom: 12 } }, yearlyChart.error)
                : null,
              chart && view === 'chart' && !(tab === 'yearly' && yearlyChart && yearlyChart.error) ? h('div', null,
                h('div', { className: 'zp-board-wrap' + (palaceSelected && tab === 'natal' ? ' has-detail' : ''), 'data-region': 'BOARD' },
                  h('div', { className: 'zp-board' },
                    h('div', { className: 'zp-grid' },
                      [3, 4, 5, 6, 2, 7, 1, 8, 0, 11, 10, 9].map(function (idx) {
                        return h(PalaceCell, {
                          key: idx,
                          palace: Object.assign({}, chart.palaces[idx], { isSoul: idx === chart.soulIndex }),
                          chart: chart,
                          selected: selected === idx,
                          onSelect: function () { setSelected(idx); },
                          t: t,
                          showAdj: showAdj,
                          scope: scope,
                          scopeBadges: scopeBadges
                        });
                      }),
                      h(CenterCell, { chart: chart, t: t, name: form.name }))),
                  palaceSelected && tab === 'natal' ? h(PalaceDetail, {
                    chart: chart,
                    palace: Object.assign({}, palaceSelected, { isSoul: selected === chart.soulIndex }),
                    t: t,
                    onSelect: setSelected,
                    onQuote: quotePalace
                  }) : null),
                palaceSelected && tab === 'decadal' ? h('div', { className: 'zp-kbd-hint' }, t('keyboardHint')) : null) : null,
              chart && view === 'patterns' ? h(PatternsView, { patterns: patterns, t: t }) : null,
              chart && view === 'dict' ? h(DictView, { t: t }) : null))),
          chart ? h('div', { className: 'zp-bottombar', 'data-region': 'BOTTOMBAR' },
            h('button', { className: 'zp-btn', type: 'button', onClick: editBirth },
              h(Icon, { name: 'panelLeft', size: 14 }), h('span', null, t('editBirthShort'))),
            h('button', { className: 'zp-btn zp-btn-primary', type: 'button', onClick: openAI },
              h(Icon, { name: 'sparkle', size: 14 }), h('span', null, t('ai')))) : null
          )),
        studioOpen && chart ? h(StudioDrawer, {
            t: t,
            tab: studioTab,
            onTab: setStudioTab,
            thread: thread,
            streaming: interpreting,
            reportRunning: reportRunning,
            thinkChars: thinkChars,
            interpError: interpError,
            interpIssue: interpIssue,
            hasReport: hasReport,
            report: report,
            reportCopied: reportCopied,
            quote: quote,
            suggestions: hasReport ? [t('suggestCareer'), t('suggestLove'), t('suggestPlain'), t('suggestPalace')] : [],
            contextLine: (isSampleChart ? t('sampleChart') + ' · ' : '') + (form.name || t('defaultName')) + ' · ' + (chart ? chart.fiveElementsClass : ''),
            selectedPalace: palaceSelected ? ZWUI.palaceLabel(palaceSelected) : '',
            onClose: closeStudio,
            onClear: clearThread,
            onAsk: askQuestion,
            onGenerateReport: function () { generateReport(false); },
            onGenerate: generateReport,
            onStop: stopInterpretation,
            onReportCopy: copyReport,
            onExport: exportReportHtml,
            onReader: function () { setReaderOpen(true); },
            onQuote: quoteFromReport,
            onClearQuote: function () { setQuote(null); },
            onContinue: continueChat,
            onHandoff: function () { handoffToSession(hasReport ? 'report' : 'brief'); }
          }) : null,
        readerOpen && hasReport ? h(ReportReader, {
            t: t,
            report: report,
            copied: reportCopied,
            onClose: function () { setReaderOpen(false); },
            onCopy: copyReport,
            onExport: exportReportHtml,
            onQuote: function (q) { setReaderOpen(false); quoteFromReport(q); }
          }) : null,
          modal === 'settings' ? h(SettingsModal, {
            t: t,
            autoOpen: autoOpen, setAutoOpen: setAutoOpen,
            showAdj: showAdj, setShowAdj: setShowAdj,
            onClearAll: clearAllReading,
            reportCount: thread.length,
            hasReport: hasReport,
            onClose: closeModal
          }) : null,
          h(Toast, { toast: toast }));
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
            '<div class="colophon"><span class="seal">LifeView</span>' +
            '<div style="margin-top:.6em">紫微师 · 金聚｜道商意象紫微九诀</div>' +
            '<div style="margin-top:.2em;color:var(--text-sub)">微信：neo2025new</div>' +
            '<div style="margin-top:.2em">人生画板 · ' + ymd + '</div></div>' +
            '</div></body></html>';
        };
        /* 报告渲染是纯函数：暴露给自检与无头预览（与 window.ZWEngine / ZWCore 同一形态） */
        try {
          if (typeof window !== 'undefined') {
            window.ZWReport = { REPORT_CSS: REPORT_CSS, escHtml: escHtml, mdToHtml: mdToHtml, mdToChatHtml: mdToChatHtml, buildReportHtml: buildReportHtml };
            window.ZWUi = ZWUI;
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
