# Changelog

本项目的所有重要改动都会记录在此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> 开源前的历史（v1.2.0 之前）为私有开发期，未保留完整变更记录。
> 本轮开源源就绪改动先记在 `Unreleased`；具体发版版本号由维护者按 SemVer 决定
> （`package.json` 当前仍为 `1.2.0`，本次不擅自升版）。

## [1.3.1] — 2026-11-08

首个 npm 发布版本（2026-11-08 发布 `dsh-ziwei@1.3.1`）。

### Added

- 作者联系邮箱 `neo2025new@gmail.com` 写入 README / SECURITY / CODE_OF_CONDUCT / package.json / Issue 模板。
- README 增加界面预览（真实组件树本地渲染，非占位图）。

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
