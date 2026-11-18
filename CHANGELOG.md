# Changelog

本项目的所有重要改动都会记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> 开源前的历史（v1.2.0 之前）为私有开发期，未保留完整变更记录。
> 版本号遵循 SemVer；`package.json` 与本文的版本号在发布时一起更新。

## [Unreleased] — 2026-11-18

### Added

- **解读记录按命盘持久化**：同一生辰（历法/年月日/闰月/时分/性别/经度）再次打开会恢复
  上次的命盘与对话/报告；最多保留 8 张盘、每张 24 条消息，只写 `localStorage`，不上传。
  - `ziwei-pro.readings.v1`：对话 + 是否出过完整报告 + 上次模式；
  - `ziwei-pro.lastChart.v1`：启动时恢复上次命盘（没有记录时仍停在原有空态）；
  - 流式生成中不写，结束后一次落盘；「新对话」删除当前盘的记录。

### Fixed

- **解读记录 key 补上排盘设置**：月柱口径（农历月/节气）、晚子时、闰月设置会改变命盘，
  之前只按生辰拼 key，改设置后会套回另一张盘的旧解读；现在设置也参与 key。
- **流式开始时不再出现一条白色空横杠**：空的 assistant 占位不再渲染气泡，
  只显示思考提示；正文到达后才出现回答卡片。
- **思考提示改为「紫微师正在思考…」**，去掉容易误读的「（N 字）」；
  输入框占位改为「想问什么？事业、财运、大限…（Enter 发送）」。

### Changed

- `setSelDecadal` 改为直接读取命盘对象（`currentDecadeIndex(result)`），不再依赖不存在的 `result.chart`。

## [1.6.0] — 2026-11-15

界面 v3.2 / v3.3 的收口版本：解读抽屉不再自动开工、空态重做，并补上作者身份与联系方式。

### Added

- **「关于」/ README / 精装报告落款补身份与联系方式**：紫微师 · 金聚｜解读依据「道商意象紫微九诀」，
  微信 `neo2025new`。关于弹层里署名用主文字色、联系方式用次级色，中英文各有对应文案；
  精装报告的落款页同步带上署名与联系方式。

### Changed

- **点「紫微师解读」不再自动开始解读**（v3.3）：抽屉打开后停在空态，「速览解读 / 完整鲲鹏报告 /
  直接提问」都由用户自己点。v3.2 的「每张盘首次打开抽屉自动发起一次速览」已撤回：
  没打招呼就先花掉一次模型生成，用户也来不及先看盘或先问自己的问题。
  实现上删掉 `autoStartedRef` 与 `runInterpretation('', 'brief')` 的自动调用。
- **解读抽屉降噪**（v3.2）：删除标题下的副标题、空态重复标题 / 引擎说明 / 三条建议；
  复制 / 预览 / 导出改为图标按钮（保留 `title` + `aria-label`），免责声明压成一行短句，
  输入框 placeholder 收短。对话流、焦点陷阱、预览子层与 Esc 逐层关闭语义不变。
- **换盘清空旧对话**（v3.2 起）：重新排盘 / 载入命盘库时清空上一张盘的解读与「已出完整报告」标记，
  避免旧回答跟新盘串台；v3.3 起清空后不再自动生成。
- `layout.md` `DRAWER` 允许项同步（不再放「只在下次请求生效的模式切换」），§10 补两条反模式；
  `design.md` 登记「动作卡（列表式）」形态（圆角 12 / 内边 12 / 高由内容决定，不是按钮档位）。

### Fixed

- **解读抽屉空态不再拉满整行**（v3.3）：旧样式 `flex: 1 1 0` 让两个动作各占半屏、图标贴左、
  文字居中，外面再套一圈虚线框，整块空态悬在面板正中。改为「一行一个动作卡」：
  图标块 + 名称 + 一句说明 + 右侧箭头，块宽封顶 420 居中；首选动作只加品牌色描边与浅底，
  不再整块紫色。说明拆成「命盘已带入」+「直接提问，或先看一份解读。」
- **「鲲鹏精装 HTML」里的 markdown 表格不再原样露出管道符**（v3.2）：`mdToHtml` 支持 GFM 管道表格
  （表头 / 对齐 / 单元格内 `<br>`）、`---` 分隔线，并把标题层级收口到 `h2–h4`。
  导出的 12 宫表、大限表、四化表恢复成真正的表格；A4 打印时表格行不跨页断开。
- **抽屉头部「速览解读 / 鲲鹏报告」点了没反应**（v3.2）：两个按钮只改下一次请求模式，
  不发起动作。已删除该模式条；空态改为两个一次点击就产出的动作，回答后工具条提供「完整报告」动作。

### Tests

- `verify/verify.mjs`：新增「点开抽屉不自动发起」「空态是动作卡、不再拉满整行」两条断言；
  换盘断言改为检查 `setThread([])` 仍在两处重置路径上。当前 116 项全过。
- `verify/all.mjs` 八组自检与 `scripts/audit-ui.mjs` 界面契约（11 通过 / 0 失败，五个棘轮
  计数维持基线）在 1.6.0 发布前重跑通过。

## [1.5.2] — 2026-11-08

### Fixed

- **左栏顺序仍不对（格局卡跑到最上面）**：`order: 1/2/3/4` 原本只给窄屏
  `display: contents` 重排用，却写成了全局规则；在宽/中/紧凑档的 flex 左栏里覆盖了
  DOM 顺序。已全部收窄到 `[data-w="narrow"]`，并补 `.zp-patterns-card` 的窄屏顺序。
  现在有盘时：命主信息 → 格局摘要 → 排盘输入 → 命盘库。

## [1.5.1] — 2026-11-08

### Changed

- **左栏顺序调整为**：命主信息 → 格局摘要 → 排盘输入 → 命盘库（有盘时阅读优先；
  无盘时自动回到「排盘输入 → 命盘库」）。
- `layout.md` 区域表按新顺序排列；A1 接线列表同步。

## [1.5.0] — 2026-11-08

### Changed

- **左栏新增「格局摘要」**（命主信息下方）：只读，最多 4 条（格局名 + 等级 + 一句话），
  带「查看全部」进入原格局分析页；顶部「格局分析」入口保留，窄屏仍可用。
- 新增区域 `SIDE_PATTERNS`，`data-region` 白名单 13 → 14，`layout.md` 同步。
- 格局名颜色改用官方 `--dsw-alias-brand-primary`（C16 私有 accent 引用不增加）。

## [1.4.0] — 2026-11-08

### Added

- **手动「检查更新」**：设置弹层显示当前版本与「检查更新」按钮；点击后经 Host 路由
  `/ziwei/version` 请求 npm registry 一次，显示最新版本与更新命令。
  只在点击时联网，不做后台轮询、不记录生辰数据；检查结果缓存 10 分钟。

## [1.3.3] — 2026-11-08

### Fixed

- **老用户本地缓存导致月柱仍显示「戊午」**：旧版把默认 `monthDivide: "normal"`（农历月）
  连同表单一起写进 `localStorage["ziwei-pro.form"]`，升级后只改默认值不会生效。
  新增一次性迁移（`ziwei-pro.formV133`）：把旧默认改写为「节气」并写回，之后用户显式选择的
  「农历月」不会再被覆盖。

## [1.3.2] — 2026-11-08

### Fixed

- **四柱月柱默认口径改为节气**（八字通行）：用户报告 1993-07-17 18:00 男命显示「戊午」、
  期望「己未」。原默认是「农历月」（农历五月 = 午月）；改为默认「节气」（小暑后 = 未月）后
  1993-07-17 显示「己未」。
  该设置只影响四柱月柱显示；命宫、星曜、四化与十二宫仍按农历月计算，不受影响。需要紫微传统
  口径可在「排盘设置 → 月柱」切回「农历月」。

## [1.3.1] — 2026-11-08

首个 npm 发布版本（2026-11-08 发布 `dsh-ziwei@1.3.1`）。

### Added

- 作者联系邮箱 `neo2025new@gmail.com` 写入 README / SECURITY / CODE_OF_CONDUCT / package.json / Issue 模板。
- README 增加界面预览（真实组件树本地渲染，非占位图）。

### Verified

- 2026-11-08 作者在真实 DSH 宿主完成 v3 界面验收（浅/深色、侧栏展开/折叠、窄屏、键盘），
  无阻塞问题；npm `dsh-ziwei@1.3.1` 与 GitHub v1.3.1 同日发布。

### Changed

- 仓库与 npm 名称统一为 `dsh-ziwei`；GitHub release v1.3.0 为首个公开 tag。

## [1.3.0] — 2026-11-08

> 首个公开版本（此前 1.2.0 为私有开发版）。

### Added

- 开源治理文件：`LICENSE`（MIT）、`THIRD_PARTY_NOTICES.md`（solarlunar ISC 全文 +
  验证参考声明）、`CONTRIBUTING.md`、`SECURITY.md`、`CODE_OF_CONDUCT.md`、本 CHANGELOG。
- 发布工程：`scripts/release-pack.mjs` 生成可发布副本（只写 `dist/`，不发布；支持 `--dry`），
  负责改名、`private=false`、`publishConfig.access=public`，并同步
  `cordis.patch.yml` 的 `name` 与 `client.js` 的模块 `id`。
- CI 与发布工作流：`.github/workflows/ci.yml`（ubuntu/macos/windows × node 22/24 跑
  build + verify + 发布包 dry-run）、`.github/workflows/release.yml`（默认不执行，
  workflow_dispatch + 人工确认 + npm OIDC Trusted Publishing）。
- 文档：`docs/INSTALL.md`、`docs/PUBLISHING.md`、`docs/ARCHITECTURE.md`、
  `docs/assets/README.md`（截图占位说明）；`docs/ui-contract/`（界面契约：区域、字阶、
  token 与可自动检查项）。
- Issue 模板（bug / feature / config）与 PR 模板。
- **构建自包含**：农历/节气数据表 vendored 到 `src/lunar-data.js`（从 `solarlunar@3.1.0`
  抽取，ISC，Copyright (c) 2015, yize），`build.mjs` 不再依赖插件目录外的 `.ref/`；
  干净 clone 上直接 `node build.mjs` 可构建。
- **差分测试可离线**：新增 `verify/cases.mjs`（20 个共用用例）与
  `verify/fixtures/paipan-reference.json`（从来源产品 runner 捕获的期望输出）。
  `verify/diff-runner.mjs` 有 runner 时用 runner、无 runner 时自动用 fixture；
  `--write-fixture` 可在有 runner 的机器上重新捕获。
- `verify/all.mjs` 新增第 8 组 ui-contract 检查（区域/token/可访问性等可机械化规则），
  并配套 `scripts/audit-ui.mjs`（16 项检查 + 棘轮基线 `docs/ui-contract/audit-baseline.json`）。

### Changed（界面 v3：信息架构与布局重构）

- **修复「DSH 侧栏展开时中栏被异常拉成单列」**：新增 compact 档（面板 908–1071px）——
  左栏 264 + 盘面 600 + 详情下沉，不再掉进单列把内容拉满；`layout.md` 参数表与
  audit C13 公式同步（COMPACT = 264+12+600+32 = 908）。
- **修复 wide 档盘面被压成 23px**：`.zp-board` 作为 grid item 时 `margin:0 auto` 会让
  宽度按 fit-content 收缩；改为 `width:100%` + `max-width`。
- **头部高度与 sticky 对齐**：`.zp-head` 加 `box-sizing:border-box`（总高 56），
  TimeBar `sticky top:56` 不再压住头部；移除左栏内重复的「排盘输入/收起」标题行。
- **时间维度导航从「页签 + 盘上列表」改为常驻 TimeBar**：本命/大限/流年三个模式分段 + 上下文导航；
  大限用「‹ 段位 干支 宫位 › + 回到当前 + 下拉跳转」，流年用「‹ 年份 › + 今年」；
  原先压在盘面上方的十二大限卡片列表（`DecadalPanel`）与流年输入条（`YearlyBar`）已移除。
- **工具视图独立**：格局分析、星曜词典不再是主 tab，改为 TimeBar 右侧工具入口，打开后占用
  TOOLPAGE 并提供「返回盘面」。
- **左栏可收起**：AppBar 新增左栏开关（`aria-expanded`/`aria-controls`），窄屏出盘后自动收起；
  窄屏新增贴底行动条「生辰 / 紫微师解读」。
- **唯一主行动**：有盘后「排 盘」降为次按钮，HEAD 只保留「紫微师解读」一个 brand 填充按钮。
- **区域契约落地**：`data-region` 13/13 接线（HEAD / SIDE_FORM / SIDE_PROFILE / SIDE_LIBRARY /
  TIMEBAR / BOARD / INSPECTOR / TOOLPAGE / EMPTY / DRAWER / PREVIEW / MODAL / BOTTOMBAR），
  `docs/ui-contract/layout.md` §2 与页型矩阵同步（TABBAR → TIMEBAR，新增 BOTTOMBAR）。
- audit-ui 基线随 v3 更新（C16 私有 accent 引用 49→60；C2 42→41），其余欠账项不变；
  `verify/verify.mjs` 新增 6 条 v3 防回退断言。

### Changed（v3.1：深色可读性与布局细节）

- **深色白字填充对比度**：主按钮/选中页签/命身标记/发送按钮改用专用
  `--zp-fill-accent*`（深色 #6a4fe0 / #5840c0，白字 5.52 / 7.22），不再拿亮 accent
  （#a78bfa，白字 2.72:1）当填充；audit C15 从 WARN 转为 PASS。
- **mid/compact 详情卡限宽 760 居中**，不再横向铺满 stage。
- **窄屏头部**补「命主 · 五行局」紧凑摘要 chip；空态卡收窄到 560 居中。
- `tokens.md` 登记新增填充变量；audit 基线随 C15/C16 下降更新（234 → 226）。

### Fixed

- **P0：侧栏折叠后无法从紫微斗数面板退出或恢复侧栏。** 面板内容避让 darwin 窗口
  chrome（`--dsh-frame-top-clearance` / `--dsh-frame-leading-clearance` /
  `--dsh-frame-overlay-top`，均带 `0px` 兜底）；面板层叠收进自身上下文
  （`isolation: isolate`），不再盖住 frame 的 `shell.leading` 出口；顶栏新增
  「返回会话」按钮（`ctx.layout.selectPanel(null)`，带 `title` / `aria-label`，
  键盘可达）。`verify/verify.mjs` 增加对应静态防回归断言。
- **P0：移除浏览器端明文保存的 API Key。** 解读早已改走 Host `llm` 服务，客户端不再
  需要也不应保存密钥；升级时清理历史遗留的 `ziwei-workbench.apikey` localStorage 键。
- **P0：路由安全收紧。** 面板路由改用宿主 `connection.requestRejection(req)` 做
  Host/Origin/浏览器认证校验，并只接受 `owner` Peer（与 `/api` 精确 Fetch 路由同口径），
  避免 remote-access / 非 owner Peer 借道路由消耗 LLM 或让 Host 建会话。
- **P1：`webServer` / `llm` 改为 `ctx.inject` 按需等待。** 没有这两个服务的 profile
  仍能正常注册 4 个排盘工具，不再整插件不 apply。
- **P1：客户端改成 lazy-CJS。** bundle 加载期只注册 factory，不解析执行 226KB 引擎、
  不提前写 `window` 全局；引擎/内核在 UI factory 首次物化时 bootstrap（符合官方
  `ui-plugin` 契约）。`verify/verify.mjs` 断言加载期 `window.ZWEngine` 不存在。
- **P1：i18n 走 DSH `ctx.locale` 的 register/bind**，不再自建语言探测。
- **可访问性**：流式区 `aria-live`/`role="log"`、分段控件 `aria-pressed`、图标按钮
  `aria-label`、预览 iframe `title` + `sandbox`、弹层焦点管理。
- **`autoOpen` 默认改为关闭**：不再劫持主面板，用户可在设置里开启。
- 第三方许可标注：`solarlunar` 实际为 **ISC**（Copyright (c) 2015, yize），已在
  `src/lunar-data.js`、`src/engine-core.js` 头注释与 `THIRD_PARTY_NOTICES.md` 中标明并保留全文。

- **P0：问「这 10 年大运」却答成命格总纲。** 根因是面板问答只发 `E.chartText(chart)`：
  没有十二大限表、没有“现在处于哪一段”，而 system 又固定要求五段式（含“命格总纲”）。
  修复：① `fullChartText` 输出全部 12 段大限（虚岁 + 公历区间 + 宫位 + 大限四化 + 落宫）；
  ② 新增 `currentContext`（当前虚岁、当前大限的宫位/四化/大限命财官迁、当年流年与流年四化）；
  ③ 有具体问题时改走「定向问答」system，不再套固定五段式；大限/大运类问题自动注入
  【本轮聚焦】并把面板选中的大限优先；④ 面板 payload 改为完整上下文 + `currentAge` /
  `currentYear` / `decadalFocus`；⑤ `ziwei_paipan` 工具输出同步带上十二大限与当前定位。
  验证：`verify/verify.mjs` 新增 7 条断言（全量 12 段、当前定位、聚焦指令、选中大限优先、
  无问题仍保留五段式、工具输出、client payload）。

### Changed

- README 重构为对外可读版本：删除本机绝对路径与内部产品名，保留全部技术事实
  （排盘口径、踩过的坑、SSE 收尾语义、界面布局演进、验证方式）。
- `package.json` 补齐开源元数据（`license` / `author` / `repository` / `homepage` /
  `bugs` / `keywords` / `engines.node` / `engines.dsh` / `dsh.manifestVersion`）；
  为不破坏本机 `link:` 安装，`name=@local/ziwei-workbench` 与 `private=true` 保持不变。

## [1.2.0] — 2026-10-30

### Added

- 界面 v2：盘面优先的自适应布局。用 ResizeObserver 实测面板宽度分三档
  （窄 <1072 / 中 1072–1393 / 宽 ≥1394，按「侧栏出现后盘面仍有 720px」反推阈值）；
  详情卡在窄/中档移入盘面下方多列信息卡、宽档才回右栏；宫格改为 CSS 容器，
  字号用 `cqw` + `clamp()` 随盘宽缩放；出盘后自动收起生辰表单；新增「专注看盘」；
  视觉重做（金线外框、圆角宫格、太极中宫、庙旺/四化角标统一规格、sticky 毛玻璃顶栏）。
- 界面 v2.1：紫微师解读从 `position:fixed` 整窗弹窗改为**面板内右侧阅读抽屉**，
  设置改为面板内居中弹层；顶栏按钮分层（次级工具 → 分隔线 → 主行动 → 设置）；
  抽屉内部按「头部 → 对话 → 工具条 → 输入区 → 免责声明」重排；空对话给三条示例问题；
  统一内联 SVG 图标。
- 解读改走 Harness 会话模型（`/ziwei/interpret` SSE），不再需要另配 DeepSeek API Key。

### Fixed

- **流式收尾语义（2026-10-19）**：只有收到 `event: done` 才算写完；命中模型输出上限
  （`max-tokens`）、整体超时、连接中断都保留已生成部分并给「继续生成」，不再把半截
  正文当完整结果。详情：输出预算 brief 8192 / report 32768 并按 `defaultMaxTokens` 封顶；
  `stop → done`、`max-tokens → error(kind:"max-tokens", canContinue:true)`、
  无 `finish` 帧 → `stream-closed`；请求先发 `start` 帧并 flush，15s `: ping` 心跳，
  `reasoning-delta` 转 `thinking` 事件；整体超时与 `iterator.next()` 竞态（`Promise.race`）；
  先 `res.end()` 再 fire-and-forget 关迭代器，避免连接泄漏。
- 大限四化 chip 类名算错（`MU_CLASS[MU_CHARS.indexOf(...)]`）导致小标签一直没颜色。
- 宽档下「大限 / 流年」页签没有宫位详情却仍占 300px 右栏。
- 方向键挂在 `window` 并 `preventDefault`，抢页面滚动和其他输入区；改为宫位获得焦点后接管。
- 精装报告 HTML 的宫格顺序错位（中宫固定占位后其余宫按行流落错格）。
- 报告抬头「阴女/阳男」只看性别；改为按年干阴阳（甲丙戊庚壬为阳）。
- 流年年份非法时静默显示本命盘；改为错误提示。
- 未出盘时点「紫微师解读」是空操作；改为按钮禁用。
- 预览 iframe 的 memo 漏 `form` 依赖，改名后预览仍是旧名。
- 修掉旧 token 拼写：`--dsw-alias-state-warning-primary` → `--dsw-alias-state-warn-primary`。

### Changed

- 颜色只走 `--dsw-alias-*`，星曜/四化等内容色集中成插件级 CSS 变量；
  `cqw` / `color-mix()` 不支持时退回固定字号与 token 底色；`prefers-reduced-motion`
  下关闭过渡。
