# 实现计划：v5 工作台体验打磨

- Spec：docs/specs/2026-11-18_v5-ux-polish.md
- 分支：feat/v5-ux-polish（从 feat/v5-chart-studio 拉出）
- 执行方式：单个会话，按批 A → B → C 执行；每批结束跑全量自检并截图，确认后进入下一批

## 全局约束

- 只改 `src/ui-pro.js`、`verify/verify.mjs`、文档、`CHANGELOG.md`、`package.json` 的 version
- `client.js` 和 `engine-built.js` 只由 `node build.mjs` 生成，与 `src/` 一起提交
- 不改 localStorage 的键和记录结构；不改区域白名单和三档阈值；audit 计数只减不增
- 一个提交只做一件事，用 Conventional Commits

## 文件清单

| 文件 | 新建或修改 | 负责什么 |
|---|---|---|
| `src/ui-pro.js` | 修改 | CSS、组件、状态与流控制 |
| `verify/verify.mjs` | 修改 | `window.ZWUi` 纯函数断言、CSS 静态断言 |
| `client.js`、`engine-built.js` | 重新生成 | 构建产物 |
| `CHANGELOG.md`、`package.json` | 修改 | 记录 `[Unreleased]`；version 升到 1.7.0-dogfood.3 |

## 任务

### 批 A：修坏的
1. **A1–A4 CSS 缺陷**
   - 修四处：`.zp-btn` 改为 inline-flex；窄屏底栏的边距与 sticky 偏移；按钮颜色重置；自动聚焦容器去掉焦点框。
   - 先在 `verify/verify.mjs` 里写 CSS 静态断言，确认失败后再修。
2. **A5 报告续写合并**
   - 提取 `mergeReportText(base, doneText, cont)`。
   - 断言：续写时 `base + done`，不续写时用 `done || 已累计的正文`。
3. **A6 换盘与流**
   - `adoptChart` 改为：先按旧 key 落盘，再中止流。
   - `openStream` 记下开始时的 key，回调时 key 不一致就丢弃。
   - 在预览壳里用模拟 SSE 回放验证。
4. **A7 选段坐标**
   - 提取 `pickPoint(rangeRect, boxRect, scrollTop, scrollLeft)` 并写断言。
5. **A8 宫位引用**
   - 提取 `palaceQuoteText(palace)` 并写断言。
   - 在 Icon 表补上 `quote`、`refresh` 两个图标。
6. **A9 中断报告**
   - 中断时照常渲染已写正文。
   - 落盘条件改为：只要报告正文非空就落盘。
7. **A10 重新生成**
   - 加两步确认。
   - 保留旧报告快照，新报告失败且没有正文时恢复。
8. **A11 全屏同步**
   - 监听 `fullscreenchange`。
   - Esc 改看 `document.fullscreenElement`。

### 批 B：交互
1. **B1 选宫反馈**
   - 提取 `relatedPalaces(index)` 并写断言。
   - 盘面标出对宫和两个三合宫。
   - 非 wide 档下，详情用 `scrollIntoView` 滚入视野。
   - 方向键只在盘面视图里切换宫位。
2. **B2 后台运行**
   - 抽屉关着时，「紫微师解读」按钮显示运行标记。
   - 完成或失败时弹出带「查看」的提示（把 toast 的撤销动作泛化成通用动作）。
3. **B3 速览解读**
   - 点击后立刻显示「正在思考」。
4. **B4 草稿与 Esc**
   - 草稿按命盘 key 存在内存里。
   - 输入法候选框打开（`isComposing`）时，Esc 不关闭抽屉。
5. **B5 输入快照**
   - 提取 `sameBirthInput(a, b)` 并写断言。
   - 存库、AI 请求、示例盘判断都改用排盘时的快照。
   - 表单改过但没排盘时，给出「生辰已改」提示。
6. **B6 专注模式与窄屏「生辰」**
7. **B7 示例盘身份**
8. **B8 反馈诚实**
9. **B9 阅读位置**
10. **B10 续写与重试**
11. **B11 换盘残留**
12. **B12 小修**
13. **文案**

### 批 C：产品收束 + 文案 + 视觉布局（2026-11-19 扩充）
1. **C1 功能收束**
   - 会话入口合并为「在新会话里继续」，删掉写入会话（`syncToSession`）。
   - 删掉「专注看盘」，迁移旧偏好；`layout.md` 先改，Appendix B 记录。
   - 设置里删掉「显示杂曜」。
   - 命盘库不填名也能保存（`ZWUI.autoChartName`）。
   - 「引用宫位」改名「问这一宫」；格局卡按钮改为「查看全部」。
   - 删掉无引用的字典键。
2. **C2 表单与出生城市**
   - `ZWUI.parseBirthplace` 加内置城市表；籍贯和经度合并为「出生城市」。
   - 职业与排盘口径折叠进「更多选项」。
   - 算法说明移到「关于」。
3. **C3 文案**
   - 逐键走中英字典，去口号、去装饰符号、改晦涩说法。
   - 加文案检查自检。
4. **C4 视觉与布局**
   - 盘面按高度适配；宫格字号下界按子阶。
   - 顶栏去重四柱。
   - 详情区去掉胶囊样式。
   - 空态与表单。
5. **收口**
   - 版本 1.7.0-dogfood.3。
   - CHANGELOG、README、locale 同步。

每个任务都按同一个流程走：
- 先写会失败的断言（纯逻辑或 CSS 静态检查）。
- 实现。
- 跑 `node build.mjs && node verify/all.mjs` 和 `node scripts/audit-ui.mjs`。
- 提交。

## 审查重点

1. 换盘时落盘旧记录，不能覆盖新盘的记录（key 必须在换盘前取到）。
2. `:where(.zp-root) button` 不能改变已有组件的颜色（权重 0,0,1）。
3. 续写、中断、重新生成三者交叉时，快照恢复不能丢正文。
4. 方向键收窄后，盘面上的 roving tabindex 仍然可用。
5. 宫格高度适配不能让 compact 档的盘面比现在更挤（下限 84px）。

## 风险与回滚

- 风险：宫格高度规则在极矮窗口下变挤；toast 动作泛化后，撤销和查看两种动作混用。
- 回滚：每批是独立的一组提交，按批 `git revert`；分支不合入 main。

## 验证

- 全量：`node build.mjs && node verify/all.mjs`
- 预览壳：720 / 1000 / 1470px × 浅色 / 深色截图；用模拟 SSE 回放流式场景
- 人工：在 DSH 里打开面板，看浅色和深色、窄中宽三档，以及这次改到的状态；没做时写「未做视觉复核」
