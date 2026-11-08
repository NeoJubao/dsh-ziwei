# 紫微斗数 Pro · v3 界面重构设计

> 信息架构 · 布局系统 · 时间维度导航 · 按钮层级 · 状态与改造清单

- **本文是什么**：可评审、可实施的设计规格。**不是实现**；实现由 Lead 并行做，本文不修改 `src/`。
- **依据快照**：`src/ui-pro.js` **2648 行**（2026-11-08 15:44 读取；v3 已有一版实现进行中）。源码还在改，**行号会漂移**——本文所有落点以**类名 / 组件名 / 函数名**为锚点，行号只作"当时在哪"的参考。
- **实现状态（2026-11-08 15:5x，Lead 同步）**：v3 已由 Lead 落地——TimeBar + 可收起左栏 + 工具视图 + 窄屏底栏 + `data-region` 14/14 + 契约更新，全量自检 218 项全绿。**本文是设计与验收依据，不再对齐逐行实现**；§10 的 as-built 对照保留为写稿时快照（可能已过期，以代码为准）。
- **上一版契约**：`docs/ui-contract/layout.md`（v2，12 个 RegionId）与 `内部设计审查底稿（不随仓库发布）`。本文是 v3，**取代 layout.md 的结构部分**（迁移见 §8.5 与 §10）。
- **读者**：Lead（实施）/ Neo（拍板，见 Appendix B）/ 后续评审。

### 需求覆盖对照

| 任务要求 | 本文位置 | 线框位置 |
|---|---|---|
| 1 信息架构与区域职责（8 区，允许放/禁止放） | §3 | 区域标注开关 |
| 2 布局系统（rail 320 / 自适应 / inspector 300；全宽；窄屏；断点公式；宽度计算表；侧边栏全屏） | §4 | 档位切换 |
| 3 时间维度导航（TimeBar；大限/流年导航；键盘；边界；高亮；解读联动） | §5 | 大限/流年视图 |
| 4 按钮层级（全量清单；唯一主行动；收纳；规格） | §6 | 全部按钮可点 |
| 5 窄屏与全屏 | §4.4 / §4.5 | 窄档 + 抽屉 + 底栏 |
| 6 状态与反馈 | §7 | 无盘/抽屉/流年 |
| 7 改造清单（组件/CSS/文案/测试/文档；S/M/L；风险） | §8 | — |
| 8 可点击线框 | §9 | `v3-wireframe.html` |

---

## 0. TL;DR

1. **病根一句话**：v2 把「时间」当成了**页面内容**（十二大限列表、年份输入框都堆在盘面上方），把「结构」当成了**卡片堆**（左栏 3 张同规格卡 + 盘面 + 详情 + 运限卡 = 最多 7 种卡型）。v3 的两次分离解决它：**时间离开内容 → 进常驻 TimeBar**；**结构离开卡片 → 靠栏与分隔线**。
2. **IA 12 区 → 9 区**：`AppBar / ContextRail / TimeBar / ChartStage / Inspector / Drawer / UtilityView / BottomBar / Modal`。`EMPTY` 降级为 ChartStage 的一个状态；`SIDE_FORM/PROFILE/LIBRARY` 合并为 ContextRail（子槽 `form/profile/library`）；`TABBAR` 升级为 TimeBar。**每个区都有「允许放 / 禁止放」白名单**（§3.2）。
3. **布局参数化**：`RAIL_W 320`（固定，永不拉伸）、`CHART_MAX 720`（xwide 才到 800）、`INSPECTOR_W 300`（xwide 320）、`DRAWER_W 520`、`READ_MAX 760`、`GUTTER 24`、`PAD 24`。**断点不是魔数，是参数的和**：`MID = 320+24+560+48 = 952`、`WIDE = 320+24+1044+48 = 1436`、`XWIDE = 1436+80+20 = 1536`（§4.3）。现有 `1072/1394` 两档字面量退役。
4. **「侧边栏全屏」的正解**：**栏通栏、内容簇居中、上限全部参数化**。全宽时左栏仍是 320、盘面仍 ≤720、详情仍 300 且与盘面只隔 24、抽屉仍 520——多出来的宽度**一律变成对称留白**，禁止分给控件（§4.4）。
5. **时间导航**：TimeBar 三模式（本命/大限/流年）+ 上下文导航（大限 `‹ 段位 干支 宫位 › + 回到当前 + 下拉跳转`；流年 `‹ 年份 › + 干支 + 小限 + 今年`）。**默认停当前大限/今年**（现状默认第 0 段，等于打开看到 3–12 岁）；**边界禁用**；**键盘区域化**；**非法年份不再摧毁盘面**（§5）。
6. **解读联动**：抽屉持有「当前时间上下文」chip；payload 既有 `decadalFocus` 保留，新增结构化 `decadal` / `yearly`；**现状流年选择根本没进 payload**（只有 `decadalFocus`，见 `runInterpretation`），v3 补上，并在 `src/ziwei-core.js` 的 `buildRequest` 增加流年聚焦句（§5.5）。
7. **唯一主行动**：无盘 = **排盘**（rail 表单 / 窄档底栏）；有盘 = **紫微师解读**（AppBar / 窄档底栏）；抽屉打开时主行动 = **发送**（流式中 = **停止**）；设置弹层没有主行动，关闭是唯一出口（§6.3）。复制/写入上下文 = AppBar 次级图标；设置 = AppBar 最右图标（窄档进底栏「更多」）；工具（格局/词典）= TimeBar 右侧。
8. **状态**：空 / 排盘失败 / 流年越界 / 解读中 / 断流 / 命盘库空 / 窄屏懒加载 / 无 layout 服务降级，逐条给了位置、形态、文案与 ARIA（§7）。
9. **改造 4 个 PR**：A 参数化断点 + 区域标记 + 外壳；B TimeBar 补全 + 死代码退役；C 全宽/窄屏/抽屉/懒加载；D 解读联动 + 文案 + 测试基线（§8.6）。
10. **需要拍板 2 件事**（其余给了推荐，见 Appendix B）：**(1)** 是否接受"分区独立滚动"的外壳重排（收益大、动 CSS 面最大）；**(2)** 全宽时盘面是否允许到 800（xwide 档）。

---

## 1. 现状：三句痛点 → 三个结构性错误

用户原话：**"侧边栏现在会全屏了；排盘信息之前在左边、盘在中、大限选择在上边，这些模块的设计和布局不符合用户体验。"**

| 用户说的 | 代码事实（v2 / 2648 行快照前） | 结构性错误 |
|---|---|---|
| 「侧边栏现在会全屏了」 | 面板是**主面板**，DSH 侧栏折叠后 `panelW` 可达 1600–2500。唯一上限是 `.zp-inner max-width:1460`；左栏 304 固定，盘面 `1fr` 内再 `max-width:720` 居中，详情 300 贴 stage 右缘。全宽时盘面与详情之间出现数百 px 空白，顶栏 `flex-wrap` 还会换行 | **没有"内容簇"概念**：每个元素各自设上限，合起来没有共同基线与居中线 |
| 「排盘信息之前在左边」 | `.zp-side` 是 296/304 固定列，里面三张**同规格卡片**：生辰表单（11 字段）/ 命主摘要 / 命盘库；顶栏又有姓名+四柱+五行局 chip，与命主卡重复 | **用卡片堆结构**：一屏 5 种卡型（表单/摘要/库/盘面/详情），大限页叠到 7 种；主次只靠位置，不靠层级 |
| 「大限选择在上边」 | `DecadalPanel` 把**十二大限卡片列表**渲染在盘面**上方**；`YearlyBar` 把**年份输入框**也放盘面上方；`selDecadal` 默认 `0`（=3–12 岁），不是当前大限；流年非法时整个盘面被错误提示替换 | **把时间当内容**：时间维度是**导航**，却做成了页面上的一块内容，还和盘面抢纵向空间 |

补充两个连带问题（v3 一并解决）：

- **时间选择不进解读**：`runInterpretation` 的 payload 只有 `decadalFocus`（且仅 `tab==='decadal'` 时给），**流年选中的年份完全没传**——用户看 2035 年流年再问"这年怎样"，模型只知道今天。见 §5.5。
- **首帧跳变**：`layoutMode = panelW<=0 ? 'narrow' : …`，宽屏下先渲染窄版再切宽（`ResizeObserver` 回调后）。见 §4.6。

> 注：v3 的一版实现已经在工作树里（`docs/ui-contract/layout.md` 仍是 v2 契约）。§10 给了「目标 vs 当前工作树」的逐项对照，避免设计文档与在改代码各说各话。

---

## 2. 设计原则（判断新情况的依据，不是描述现状）

1. **时间维度是导航，不是内容**：任何"选哪个时间范围"的控件都只能出现在 TimeBar；任何"这个范围里有什么"的内容才进 ChartStage / Inspector。
2. **工作台是分区，不是卡片墙**：结构靠"通栏 band + 栏 + 分隔线"表达；容器感（边框/圆角/阴影）只留给**浮层**（抽屉、弹层、窄档 sheet）与**盘面本体**。一屏最多 2 种容器（盘面 + Inspector 分隔块）。
3. **栏通栏，内容居中，上限参数化**：band 与 rail 靠边，阅读内容有上限并居中；宽度永远不给控件"摊大饼"。
4. **一屏一个主行动**：主行动要么在 AppBar 右端，要么在窄档底栏；同一时刻不可能出现两个填充按钮（唯一例外：盘面空态 CTA 是次按钮，见 §6.3）。
5. **窄档不是缩小版**：窄档重排（底栏 + sheet + 两行 TimeBar），不是把桌面三栏压扁。
6. **不加剧 v2 的历史欠账**：新增 CSS 只用 `design.md` 的字阶/间距/控件档位与 `tokens.md` 的 token 白名单；`audit-ui` 棘轮只许下降（§8.4）。

---

## 3. 信息架构

### 3.1 用户任务与页面状态

| # | 任务 | 入口 | 唯一主行动 | 涉及区域 | 验收信号 |
|---|---|---|---|---|---|
| T1 | 首次排盘 | 侧栏入口 → 面板默认页 | 排盘 | AppBar + ContextRail(form) + ChartStage(empty) | 3 步内出盘（姓名可选） |
| T2 | 回访看盘 | 命盘库列表 / 上次表单 | 解读 | ContextRail(library) + ChartStage | 点一条盘立刻出盘，且默认本命 |
| T3 | 时间维度切换 | TimeBar | 解读 | TimeBar + ChartStage + Inspector | 大限/流年各 ≤2 次点击到达任意范围 |
| T4 | 解读 | AppBar 主行动 → Drawer | 发送 | Drawer（叠加） | 打开抽屉即带当前时间上下文 |
| T5 | 管理 | 命盘库 / 设置 | 无（设置无主行动） | ContextRail(library) + Modal | 保存/删除/偏好各 ≤2 步 |
| T6 | 查工具 | TimeBar 右侧 格局/词典 | 解读（盘仍在） | UtilityView | 返回盘面 1 次点击 |

**页面状态（正交维：宽档 × 页型 × 浮层）**

| 状态 | 组成 | 主行动 |
|---|---|---|
| S0 无盘 | AppBar + ContextRail(form/library) + ChartStage(empty) | 排盘 |
| S1 有盘·本命 | AppBar + ContextRail + TimeBar(本命) + ChartStage + Inspector | 解读 |
| S2 有盘·大限 | 同上，TimeBar 显示大限导航；盘面带限星角标；Inspector 含本限四化 | 解读 |
| S3 有盘·流年 | 同上，TimeBar 显示流年导航；盘面带流曜角标 | 解读 |
| S4 工具视图 | AppBar + ContextRail + TimeBar(返回条) + UtilityView（**无盘面**） | 解读 |
| S5 抽屉 | 任意页型 + Drawer 覆盖 | 发送 / 停止 |
| S6 设置 | 任意页型 + Modal 覆盖 | 无（关闭是唯一出口） |
| S7 窄档 | 与 S0–S6 正交：无 rail、两行 TimeBar、底栏、sheet | 见 §6.3 |

### 3.2 区域白名单（9 个 RegionId）

命名约定：设计名用任务里的 CamelCase（AppBar…）；**DOM `data-region` 用全大写**（沿用 layout.md 的契约习惯），二者一一对应。子槽用 `data-slot`（同区内的职责分工，不是新区域）。

> **给编码 agent 的三句话**
> 1. 改界面前先走 §3.4 决策树；能落到某个 RegionId 就直接做，不改本节。
> 2. 落不下来就**停**（§3.5），不要自己开区域/栏/浮层。
> 3. 代码里 `data-region` 的值必须逐字出现在下表；表外名字即违规（`audit-ui` C14）。

| Region（设计名 / DOM 值） | 职责 | 允许放（must hold） | 禁止放（must not hold） | 窄档归并 |
|---|---|---|---|---|
| **AppBar** / `APP_BAR` | 全局页头：身份、命主上下文、唯一主行动、全局入口 | 返回会话出口（第一个控件，仅 `canReturnToConversation` 时）、品牌「紫微斗数 Pro」、命主上下文 chip（**只放姓名 + 四柱**）、复制命盘、写入上下文、唯一主行动「紫微师解读」、设置、左栏开关（mid/wide） | 表单字段、时间导航、视图开关、工具入口、第二个 brand 填充按钮、命盘库、危险操作、长说明 | 底栏接管主行动；设置进「更多」；只留出口+品牌 |
| **ContextRail** / `CONTEXT_RAIL` | 当前命盘的上下文栏：生辰输入 / 命主摘要 / 命盘库（`data-slot="form\|profile\|library"`） | 11 个生辰字段、历法/性别分段、流派 `<details>`、排盘按钮（**有盘时降为次按钮**）、排盘错误条、命主摘要（四柱/五行局/命/身主/起运/真太阳时/四化）、命盘库（盘名 + 保存 + 列表 + 删除）、栏收起 | 时间导航、主行动（解读）、工具入口、解读正文、第二个品牌色块、批量操作 | 不常驻：无盘时表单内联首段；有盘时表单 sheet + 「生辰」摘要 chip；命盘库进「更多」 |
| **TimeBar** / `TIME_BAR` | **时间维度导航 + 视图选项**（通栏 band，不随内容滚动） | 三模式分段（本命/大限/流年）、运限上下文导航（`‹ ›`、跳转下拉、回到当前/今年、当前「今」标记）、工具入口（格局/词典，互斥 active）、视图开关（显示杂曜、专注看盘）、工具视图下的「返回盘面」 | 主行动、命主摘要、表单字段、运限四化正文（进 Inspector）、十二大限卡片列表、年份大输入框、长说明文字 | 两行：模式一行、导航/工具一行 |
| **ChartStage** / `CHART_STAGE` | 命盘本体 + 盘面级空/错状态 | 4×4 宫格、中宫、选中环、命/身角标、四化/庙旺/杂曜、运限星曜角标、空态（太极 + 一句 + 示例 CTA）、盘面级错误（流年越界提示条） | 时间导航控件（在 TimeBar）、十二大限列表、年份输入、说明性长文、第二张卡、主行动 | 盘面横向滚动（<608）；详情进 sheet |
| **Inspector** / `INSPECTOR` | 当前选中宫在**当前时间上下文**下的切面 | 主/辅/杂曜、大限·小限·十二神、对宫/三合导航、**本限/流年四化**、键盘提示 | 第二宫详情、报告正文、时间导航控件、设置项、跨宫对比表、主行动 | 点击宫位 → 底部 sheet（≤72% 高） |
| **UtilityView** / `UTILITY_VIEW` | 非盘面整页内容（格局/词典） | 格局卡网格、词典网格 + 搜索、空结果一句、阅读宽上限 760、加载更多 | 盘面（禁止同屏）、主行动、时间导航（TimeBar 已降级为返回条）、表单 | 单列，阅读宽 = 可用宽 |
| **Drawer** / `DRAWER` | 解读的阅读与对话（右侧浮层；`PREVIEW` 为其子层） | 对话流、模式分段（速览/鲲鹏报告）、建议、复制/预览/导出/新会话继续、**时间上下文 chip**、输入框、发送/停止、错误条 + 继续生成、免责声明、报告预览 iframe | 设置项、命盘库管理、第二个浮层、时间导航控件、主行动 | 全宽（`min(520px,100%)`） |
| **BottomBar** / `BOTTOM_BAR` | 窄档常驻行动条 | 主行动（排盘/解读，flex 1）、生辰（打开表单 sheet）、更多（**白名单**：复制命盘 / 写入上下文 / 命盘库 / 设置） | 时间导航（在 TimeBar）、超过 4 个菜单项、危险操作、第二个主行动 | 仅 narrow 渲染（`data-w="narrow"`） |
| **Modal** / `MODAL` | 持久偏好弹层 | 自动打开、宫格默认杂曜、关于（版本/许可/免责）、关闭 | 命盘数据、解读正文、命盘库、任何主行动、危险操作 | 同宽 520 |

**v2 → v3 区域迁移**

| v2（layout.md） | v3 | 说明 |
|---|---|---|
| `HEAD` | `APP_BAR` | 改名；去掉与命主卡重复的五行局 chip；左栏开关并入 |
| `SIDE_PROFILE` / `SIDE_PATTERNS` / `SIDE_FORM` / `SIDE_LIBRARY` | `CONTEXT_RAIL` | 四合一 + 子槽；阅读优先（有盘时摘要在上），窄档整栏折叠 |
| `TABBAR` | `TIME_BAR` | 语义升级；杂曜/专注/工具并入 |
| `BOARD` | `CHART_STAGE` | 改名；保留盘面本体 |
| `INSPECTOR` | `INSPECTOR` | 保留；新增运限四化段 |
| `TOOLPAGE` | `UTILITY_VIEW` | 改名；加阅读宽 |
| `EMPTY` | （`CHART_STAGE` 的 empty 状态） | **降为状态**，不占 RegionId |
| `DRAWER` / `PREVIEW` | `DRAWER`（PREVIEW 子层） | 保留；宽 464→520；加上下文 chip |
| `MODAL` | `MODAL` | 保留 |
| — | `BOTTOM_BAR` | **新增**（仅窄档） |

### 3.3 页型矩阵（`✓` 必有 / `○` 可选 / `—` 必无）

| 区域 | P1 无盘 | P2 盘面（本命/大限/流年） | P3 工具视图 |
|---|---|---|---|
| `APP_BAR` | ✓ | ✓ | ✓ |
| `CONTEXT_RAIL` | ✓ | ✓ | ✓ |
| `TIME_BAR` | — | ✓ | ✓（降级为返回条） |
| `CHART_STAGE` | ✓（empty 状态） | ✓ | — |
| `INSPECTOR` | — | ✓ wide 并列 / mid 下沉 / narrow sheet | — |
| `UTILITY_VIEW` | — | — | ✓ |
| `BOTTOM_BAR` | ○ 仅 narrow | ○ 仅 narrow | ○ 仅 narrow |
| `DRAWER` | ○ 浮层（无盘时不可开：主行动禁用） | ○ | ○ |
| `MODAL` | ○ | ○ | ○ |

浮层规则（沿用 v2 并收紧）：同一时刻只有一个顶层浮层（Drawer 或 Modal）；`PREVIEW` 只能是 Drawer 子层；抽屉里不开设置；浮层用面板内 `position:absolute; inset:0`（**禁止 `position:fixed`**，会盖住宿主侧栏出口）；Esc 逐层关闭（PREVIEW → 抽屉/弹层 → 无动作）。

### 3.4 落位决策树（新需求的入口）

**短路（按条件引用，不要引用位置编号）**

| 条件 | 落位 |
|---|---|
| S1 与当前命盘无关的全局身份 / 全局动作（返回会话、设置、品牌） | `APP_BAR` |
| S2 需要宽度与专注的对话 / 长文 / 报告 | `DRAWER` |
| S3 当前选中宫的一个切面 | `INSPECTOR` |
| S4 **改变时间范围**的选择（换大限/流年/今年） | `TIME_BAR`（**唯一允许**改时间范围的区域） |
| S5 一批命盘的集合操作（保存/加载/删除） | `CONTEXT_RAIL`（`data-slot="library"`；窄档进 BottomBar「更多」→ 命盘库） |

**主干**

```
Q1 它依附于「当前命盘」吗？
├─ 否 → Q2
└─ 是 → Q3

Q2 是全局身份 / 全局动作吗？
├─ 是 → APP_BAR
└─ 否 → 是「持久偏好」吗？
        ├─ 是 → MODAL
        └─ 否 → 停（§3.5）

Q3 它属于哪个切面？
├─ 盘面本体（宫格/中宫/角标/选中环）        → CHART_STAGE
├─ 时间范围的选择（本命/大限/流年/年份）      → TIME_BAR
├─ 当前时间范围下的「选中宫」详情            → INSPECTOR
├─ 生成命盘所需的输入                       → CONTEXT_RAIL/form
├─ 命盘身份摘要（四柱/五行局/命身）           → CONTEXT_RAIL/profile
├─ 命盘集合（保存/加载/删除）                → CONTEXT_RAIL/library
├─ 整页非盘面阅读内容（格局/词典）            → UTILITY_VIEW
└─ 无盘占位                                → CHART_STAGE（empty 状态）
```

**反向清单（出现下列念头说明已经走偏）**

1. 「先放大限列表进 ChartStage，以后再挪」——ChartStage 只放命盘本体，时间选择归 TimeBar。
2. 「在盘面上方加一条运限说明」——说明进 TimeBar 的导航文案或 Inspector，不占盘面纵向。
3. 「工具视图里顺便显示一小块盘面」——P3 与 P2 的区分特征就是有无盘面。
4. 「AppBar 再加一个填充按钮」——主行动必须唯一；次级动作一律 icon/文字按钮。
5. 「抽屉里再开设置」——浮层单层；先关抽屉再开设置。
6. 「窄档把 rail 塞回抽屉里当三栏」——窄档是重排，不是缩小。

### 3.5 落不下来：停

走变更流程（改本文 §3.2 → 联合类型/`data-region` → 代码，**顺序不可反**）。所有「先放 settings 里吧」最后都会变成杂物抽屉。

---

## 4. 布局系统

### 4.1 结构参数（代码只能引用这些值）

| 参数 | 值（px） | 用途 / 约束 | 现状 |
|---|---|---|---|
| `APP_BAR_H` | 56 | AppBar 内容高（darwin 另叠加 `--dsh-frame-top-clearance`） | v3 实现已按 56 写（`min-height:56px`） |
| `TIME_BAR_H` | 48 | TimeBar 单行高（窄档换行 ≤88） | 进行中，当前靠 padding 撑开 |
| `RAIL_W` | **320** | ContextRail 宽，**固定**，永不随面板拉伸 | v2 为 296/304 两档 → v3 统一 320 |
| `GUTTER` | 24 | rail ↔ work 间距（并入 design.md 的 24 档） | v2 16 → v3 24 |
| `PAD` | 24 | 舞台内容左右内边距（每侧，合计 48） | v2 20 → v3 24 |
| `CHART_MIN` | 560 | 盘面最小可读宽（低于则横向滚动）：单宫 ≥137px、主星 11.5px | 目标；v2 未实现 min-width |
| `CHART_MAX` | 720 | 盘面最大宽 | 已实现（`--zp-board-max`） |
| `CHART_MAX_XL` | 800 | 极宽档盘面上限（只允许一次 +80） | 新增 |
| `CHART_MAX_FOCUS` | 820 | 专注看盘上限 | 已实现（`.zp-board max-width:820`） |
| `INSPECTOR_W` | 300 | 宫位详情列宽（wide+） | 已实现 |
| `INSPECTOR_W_XL` | 320 | 极宽档详情宽 | 新增 |
| `INSPECTOR_GAP` | 24 | 盘面 ↔ 详情间隙（并入 24 档） | v2 14 → v3 24 |
| `CLUSTER` | **1044** | `CHART_MAX + INSPECTOR_GAP + INSPECTOR_W`（内容簇上限） | 新增（由公式算，不手写） |
| `CLUSTER_XL` | **1144** | `CHART_MAX_XL + INSPECTOR_GAP + INSPECTOR_W_XL` | 新增 |
| `READ_MAX` | 760 | 工具视图 / 长文阅读宽 | 新增（v2 用全局 1460） |
| `DRAWER_W` | **520** | 解读抽屉宽上限 `min(520px,100%)` | v2 464 → v3 520 |
| `MODAL_W` | 520 | 设置弹层宽上限 | 已实现 |
| `BOTTOM_BAR_H` | 56 | 窄档底栏高 | 新增（当前实现约 50） |
| `SHEET_MAX_H` | 72% | 窄档详情 sheet 高度上限 | 新增 |
| `MENU_W` | 240 | 底栏「更多」popover 宽 | 新增 |

### 4.2 外壳骨架

**目标结构（分区独立滚动，band 不滚）**

```
.zp-app                             height:100%; overflow:hidden;
                                    padding-top: var(--dsh-frame-top-clearance,0px)   ← darwin 安全区
                                    isolation:isolate                                  ← 保留 v2 硬规则
├─ APP_BAR            .zp-appbar      =APP_BAR_H（固定，通栏，不滚）
├─ .zp-main            flex:1; min-height:0; display:flex
│   ├─ CONTEXT_RAIL    .zp-rail       =RAIL_W（固定）；overflow-y:auto；右分隔线
│   └─ .zp-work        flex:1; min-width:0; display:flex; flex-direction:column
│       ├─ TIME_BAR    .zp-timebar    ~TIME_BAR_H（固定，不滚；底部分隔线）
│       ├─ .zp-content   flex:1; min-height:0; display:flex
│       │   ├─ .zp-stage-scroll  flex:1; overflow:auto
│       │   │   └─ CHART_STAGE   .zp-cluster（max-width 由档位给；居中）
│       │   │        └─ UTILITY_VIEW（max-width READ_MAX；与 CHART_STAGE 互斥渲染）
│       │   └─ INSPECTOR  .zp-inspector =INSPECTOR_W（仅 wide/xwide；自身 overflow-y:auto）
│       └─ BOTTOM_BAR   .zp-bottombar（仅 narrow；固定）
├─ DRAWER（absolute inset:0 内的右侧层；PREVIEW 子层）
└─ MODAL （absolute 居中）
```

**三条图上看不出的结构事实**

1. **「内容簇」不是 `.zp-content`，是 `.zp-cluster`**：ChartStage 与 Inspector 一起构成一个 `max-width = CHART_MAX + GAP + INSPECTOR_W` 的居中簇；`.zp-content` 永远占满剩余宽度。**改栏宽只能改参数与公式**，不要在各元素上分别写 max-width（v2 的病就是各处各自设限）。
2. **band 通栏、内容簇居中**：AppBar / TimeBar / BottomBar 的底色与分隔线通栏，但 TimeBar 的**控制点**对齐内容簇左沿（`max-width:CLUSTER; margin:0 auto`），这样"导航条左端 = 盘面左缘"。AppBar 例外：它靠边对齐（左端 24、右端 24），因为它是 chrome，不是阅读内容。
3. **没有页面级滚动**：v2 的 `.zp-scroll` 唯一滚动容器被拆成 4 个（rail / stage / inspector / drawer-body）。副作用是 TimeBar 永远可见、rail 与盘面互不牵连。**若暂不采纳（见 Appendix B Q1）**，退路是：保留 `.zp-scroll`，TimeBar `sticky; top: APP_BAR_H`，且该妥协必须写进 layout.md §11，不允许出现"TimeBar 滚出视口"。

**(a) wide / xwide（≥1436）**

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ APP_BAR  ⏴返回会话 │ 紫微斗数 Pro 陈默 · 壬申 乙巳 己卯 戊辰     ⧉复制 ↻写入 │ ✦紫微师解读 ⚙│ 56
├───────────────────────────┬──────────────────────────────────────────────────────────┤
│ CONTEXT_RAIL (320)        │ TIME_BAR  [本命│大限│流年]  ‹ [4·33–42岁 甲辰 田宅] › [回到当前]  [格局][词典] │ 48
│ ├ 生辰（折叠为一行）       ├──────────────────────────────────────────────────────────┤
│ │ 陈默 1992-05-03 09:30 男 │ .zp-stage-scroll                                        │
│ │ 105.97°E · 真太阳时 08:37│        ┌─────────── CLUSTER 1044 ───────────┐            │
│ ├ 命主                     │        │ CHART_STAGE            │ INSPECTOR 300 │            │
│ │ 四柱 / 五行局 / 命身主 …  │        │  ┌──────────────────┐  │ 命宫 癸丑       │            │
│ │ 起运 3 岁 / 真太阳时      │        │  │  4×4 宫格 + 中宫  │  │ 太阳(不) 太阴(庙)│            │
│ ├ 命盘库                   │        │  │  选中宫：命宫     │  │ 大限 33–42 甲辰 │            │
│ │ [盘名____] [保存]         │        │  └──────────────────┘  │ 本限四化 廉贞…  │            │
│ │ 盘列表…（≤20/页）         │        │  （盘面 ≤720，XL 800）  │ 对宫/三合 →     │            │
└───────────────────────────┴────────┴────────────────────────┴────────────────┘
```

**(b) mid（952–1435）**：rail 保留；**无详情列**，Inspector 下沉到盘面下方（同一条 stage 滚动流）；TimeBar 仍单行。

```
┌───────────────────────────────────────────────────────────────────────┐
│ APP_BAR …                                                             │
├──────────────────────┬────────────────────────────────────────────────┤
│ CONTEXT_RAIL (320)   │ TIME_BAR                                        │
│                      ├────────────────────────────────────────────────┤
│ 生辰（折叠/展开）     │        ЧАРТ 720 居中（两侧留白）               │
│ 命主                 │        ┌──────────────────────┐                │
│ 命盘库               │        │      4×4 宫格         │                │
│                      │        └──────────────────────┘                │
│                      │        Inspector（下沉，宽 = 盘面宽）           │
└──────────────────────┴────────────────────────────────────────────────┘
```

**(c) narrow（<952）**：无 rail；TimeBar 两行；底部行动条；详情进 sheet。

```
┌─────────────────────────────────────────────┐
│ APP_BAR  ⏴ 紫微斗数 Pro                      │ 56
├─────────────────────────────────────────────┤
│ TIME_BAR  [ 本命 │ 大限 │ 流年 ]              │
│           ‹ [4·33–42岁 甲辰 田宅] › [回到当前] │ ≤88
├─────────────────────────────────────────────┤
│  陈默 1992-05-03 09:30 男 116.4°E · 改生辰 →  │
│                                             │
│        ┌─ 4×4 宫格（≥560，窄于 608 横向滚）─┐ │
│        │                                    │ │
│        └────────────────────────────────────┘ │
│        点宫位 → 详情 sheet（≤72% 高）           │
├─────────────────────────────────────────────┤
│ BOTTOM_BAR  [生辰] [更多] [  ✦ 紫微师解读  ]  │ 56
└─────────────────────────────────────────────┘
```

### 4.3 断点：公式与各档计算表

档位由**面板实测宽度 `panelW`** 决定（`ResizeObserver`，与 v2 一致，**不用 viewport media query**）。

```
PAD        = 24            （每侧，合计 48）
CLUSTER    = CHART_MAX + INSPECTOR_GAP + INSPECTOR_W        = 720+24+300 = 1044
CLUSTER_XL = CHART_MAX_XL + INSPECTOR_GAP + INSPECTOR_W_XL  = 800+24+320 = 1144

TINY  = CHART_MIN + PAD*2                       = 560+48  = 608    （盘面开始横向滚动）
MID   = RAIL_W + GUTTER + CHART_MIN + PAD*2     = 320+24+560+48 = 952  （三栏最小可读）
WIDE  = RAIL_W + GUTTER + CLUSTER + PAD*2       = 320+24+1044+48 = 1436（可并列 Inspector）
XWIDE = WIDE + (CHART_MAX_XL−CHART_MAX) + (INSPECTOR_W_XL−INSPECTOR_W)
      = 1436 + 80 + 20 = 1536
```

| 档位 | 条件 | 布局 | 栅格 |
|---|---|---|---|
| `narrow` | `panelW < 952` | 单列；无 rail；TimeBar 两行；底栏；详情 sheet | 1 列 |
| `mid` | `952 ≤ panelW < 1436` | rail 320 + 盘面（≤720 居中）+ 详情下沉 | `RAIL_W + 1fr` |
| `wide` | `1436 ≤ panelW < 1536` | rail + 内容簇（盘面 720 + 24 + 详情 300）居中 | `RAIL_W + 1fr`，簇内 `1fr 300` |
| `xwide` | `panelW ≥ 1536` | 同 wide，盘面 800 / 详情 320 | 簇内 `1fr 320` |

**各档宽度计算表**（`work = panelW − RAIL_W − GUTTER`（narrow 时 `work = panelW`）；`inner = work − PAD*2`）

| panelW | 档位 | work | inner | 盘面渲染宽 | Inspector | 布局判读 |
|---|---|---|---|---|---|---|
| 2400 | xwide | 2056 | 2008 | 800 | 320 并列 | 簇 1144 居中，两侧各 432 留白（**不拉伸**） |
| 1600 | xwide | 1256 | 1208 | 800 | 320 并列 | 两侧各 32 留白 |
| 1536 | xwide | 1192 | 1144 | 800 | 320 并列 | 边界：簇正好占满 |
| 1500 | wide | 1156 | 1108 | 720 | 300 并列 | 两侧各 32 留白 |
| 1436 | wide | 1092 | 1044 | 720 | 300 并列 | 边界：簇正好占满 |
| 1380 | mid | 1036 | 988 | 720 | 下沉 | 盘面居中，两侧各 134 |
| 1200 | mid | 856 | 808 | 720 | 下沉 | 两侧各 44 |
| 1100 | mid | 756 | 708 | 708 | 下沉 | 盘面开始随宽度收缩 |
| 1000 | mid | 656 | 608 | 608 | 下沉 | — |
| 952 | mid | 608 | 560 | 560 | 下沉 | 边界：盘面最小可读宽 |
| 900 | narrow | 900 | 852 | 720 | sheet | 盘面居中，两侧各 66；底栏出现 |
| 700 | narrow | 700 | 652 | 652 | sheet | — |
| 608 | narrow | 608 | 560 | 560 | sheet | 边界：开始横向滚动 |
| 480 | narrow | 480 | 432 | **560（滚动）** | sheet | `.zp-board min-width:560`，提示"可左右拖动" |
| 360 | narrow | 360 | 312 | 560（滚动） | sheet | 同上 |

> 判读：`952 / 1436 / 1536` 三个阈值不是拍脑袋，是参数的和。改 `RAIL_W`、`CHART_MAX`、`INSPECTOR_W`、`GUTTER`、`PAD` 任一项，必须重算本节并跑 `audit-ui`（C13 对账）。**代码里不允许出现 952/1436/1536 字面量**，只能由常量算出。

### 4.4 「侧边栏全屏」怎么处理（DSH 侧栏隐藏 / 面板全宽）

用户说的"侧边栏现在会全屏了"，本质是：**面板是全宽主面板，不是侧栏弹层**。v3 的正解不是"别全屏"，而是**全屏时内容不摊开**。规则六条，按优先级：

1. **栏固定**：`CONTEXT_RAIL` 永远 320（mid/wide/xwide），不随面板拉伸；窄档整栏折叠。
2. **内容簇有上限并居中**：`CHART_MAX + INSPECTOR_GAP + INSPECTOR_W = 1044` 的簇在 `.zp-content` 内水平居中。多出来的宽度**只允许变成对称留白**，禁止分配给盘面、不禁止给控件加宽。
3. **上限分档**：只有 `xwide`（≥1536）才允许盘面到 800、详情到 320；**视口越宽盘面越大**是反模式（单宫会被撑到 300px+，视线跳跃、字距失控）。
4. **抽屉有上限**：`min(520px, 100%)`。全宽 ≥1436 时抽屉只覆盖右侧 520，左边仍能看到盘面与 rail；遮罩保留（点击遮罩关闭）。**不允许**抽屉铺满 2400。
5. **阅读宽**：工具视图正文 `max-width:760` 居中；不要把 1460 当阅读宽。
6. **对齐**：AppBar 内容靠边（左 24 / 右 24）；TimeBar 控制点与内容簇左沿对齐；BottomBar 通栏。

> **反例（明确不做）**：① 让盘面 `width:100%` 铺满全宽；② 把 rail 拉到 420 让表单更"舒展"；③ 在右侧再加第 4 列（解读摘要/时间轴）；④ 全宽时把 Inspector 贴到视口最右（与盘面隔 700px）——这正是 v2 在 1600+ 宽度下的观感问题。

### 4.5 窄屏（<952）：重排而不是压缩

| 元素 | 桌面（mid+） | 窄档 |
|---|---|---|
| ContextRail | 常驻 320 栏 | **不常驻**。无盘：表单内联为舞台首段（单列）；有盘：表单一律折叠成一行「生辰摘要 chip」（`editBirthShort`），点击打开 **rail sheet**（宽 `min(320,100%)`，从左滑入，含完整 ContextRail；Esc/点遮罩关闭） |
| TimeBar | 单行 | **两行**：行 1 三模式分段占满；行 2 运限导航（仅大限/流年）+ 工具入口 + 视图开关（可换行，≤88 高） |
| 盘面 | 居中，max 720 | `min(720, inner)`；`inner < 560` 时 `.zp-board min-width:560` + stage 横向滚动（`overflow-x:auto`），盘面下方一行 caption「可左右拖动查看完整盘面」 |
| 详情 | 右列 / 下沉 | **点击宫位 → 底部 sheet**（`max-height:72%`，`role=dialog`，焦点陷阱，Esc 关，关闭后焦点回宫位）。sheet 打开前 **Inspector 不 mount**（懒加载） |
| 主行动 | AppBar 右端 | **BottomBar**（56 高）：`[生辰][更多][主行动 flex:1]`；AppBar 只剩出口 + 品牌 |
| 工具视图 | 正常 | TimeBar 降级为「返回盘面」条；正文阅读宽 = 100%（内侧 16+16） |
| 浮层 | Drawer 右侧 520 | Drawer 全宽 `min(520,100%)`（<520 时铺满），遮罩常显 |
| 开关 | TimeBar 右侧 | 保留在 TimeBar 行 2；窄到放不下时**只保留图标 + aria-label** |

**窄屏懒加载清单**（首次渲染不做的计算/挂载）

1. Inspector（sheet 内容）——打开 sheet 才 mount；
2. 流年盘 `E.yearlyForYear`——仅 `mode==='yearly'` 时计算（现状：chart 一变就算，`useMemo([chart, yearlyYear])` 在命盘页也跑）；
3. 格局 `E.detectPatterns`——仅工具视图/格局页计算（现状 eager）；
4. 报告预览 HTML——点「预览」才 `buildReportHtml`（现状每轮回答后 eager 生成 `previewHtml`）；iframe `srcDoc` 同理；
5. 词典——首屏 40 条 + 「加载更多」（每页 40）；
6. 命盘库——首屏 20 条 + 「显示全部 (N)」；删除只在展开后可用。

### 4.6 滚动、sticky 与首帧

- **目标**：没有页面级滚动。滚动容器 = `.zp-rail` / `.zp-stage-scroll` / `.zp-inspector` / `.zp-ai-body` / `.zp-utility`。
- **sticky**：wide+ 的 Inspector `position:sticky; top:0`（相对 stage 滚动容器，**不再用 `top:64px` 魔数**）；TimeBar 在目标结构里不 sticky（它是 band）。
- **降级（若不拆滚动容器）**：`.zp-scroll` 保留，TimeBar `position:sticky; top:var(--zp-appbar-h,56px)`，`--zp-appbar-h` 由 `ResizeObserver` 写（AppBar 换行时也正确）。
- **首帧不跳变**：用 `useLayoutEffect` 在首次绘制前同步测量 `panelW`（宽屏首帧就是 wide，不出现 narrow→wide 闪跳）；`panelW<=0` 时按 `mid` 兜底并隐藏舞台（`visibility:hidden`），而不是渲染一版完整窄版。
- **专注看盘**：`data-focus="1"` 隐藏 rail + inspector，盘面到 `CHART_MAX_FOCUS 820`；TimeBar **必须保留**（时间导航不能因为"专注"消失）。无盘时不允许进专注态（沿用 v2 规则）。

---

## 5. 时间维度导航（重点）

### 5.1 为什么必须从"盘面上方"移走

| 现状 | 代价 |
|---|---|
| `DecadalPanel`：十二大限卡片列表（`grid auto-fill minmax(248px,1fr)`）渲染在盘面**之前** | 大限页纵向被吃掉 200–400px，盘面被推到折叠线以下；12 张卡里 11 张是"非当前"的噪声 |
| `YearlyBar`：年份 `<input type=number>` 在盘面上方 | 把"导航"做成"填表"；非法输入时 `yearlyChart.error` 使整个盘面被替换成错误条 |
| `selDecadal` 初值 `0` | 用户点开「大限」看到的是 3–12 岁，不是他现在所在的第 4 段 |
| 大限/流年选择不进解读 payload（流年完全没传） | 用户"看 2035 年 + 问这年"时，模型不知道 2035 |
| 运限上下文用 `.zp-scope-bar` 在盘面上方重复一遍 | 时间信息出现在 2 个位置（TimeBar + scope bar），且 scope bar 随滚动消失 |

### 5.2 TimeBar 结构

```
TIME_BAR（通栏 band；内含 max-width=CLUSTER 居中的 .zp-timebar-in）
┌───────────────────────────────────────────────────────────────────────────────┐
│ [本命 │ 大限 │ 流年]   ‹  [第4段 · 33–42岁 · 甲辰 · 田宅]  ›   [回到当前]  …  │
│  模式分段（tablist）      运限上下文导航（group）              视图区：          │
│                                                                [格局][词典]     │
│                                                                [杂曜][专注]     │
└───────────────────────────────────────────────────────────────────────────────┘
```

三模式的状态矩阵：

| 模式 | 左侧 | 中部（运限导航） | 右侧 | 盘面 | Inspector |
|---|---|---|---|---|---|
| 本命 | `[本命]` selected | **无**（可放一行 chip：`现在 · 2026 · 虚岁35`，点击跳到流年今年） | 工具/开关 | 本命盘 | 宫位切面 + 本命四化（已有） |
| 大限 | `[大限]` selected | `‹ [第4段 33–42岁 甲辰 田宅] › [回到当前（当前段时显示"当前"chip）]` | 工具/开关 | 本命盘 + **限星/限四化角标** | 宫位切面 + **本限四化** |
| 流年 | `[流年]` selected | `‹ [2026] › [丙午 · 虚岁35] [今年（非今年时）]` | 工具/开关 | 本命盘 + **流曜/流四化角标** | 宫位切面 + **流年四化** |

### 5.3 大限导航规格

| 项 | 规格 |
|---|---|
| 数据 | `E.decadalList(chart)` → 12 条 `{ageRange, stem, branch, palaceName, mutagen, palaceNames, stars}` |
| 位置 | TimeBar 中部；`role="group" aria-label="大限导航"` |
| 显示 | 段位（第 N 段，1 起）+ 年龄区间 + 干支 + 宫位：`第4段 · 33–42岁 · 甲辰 · 田宅` |
| 默认 | **当前大限**（虚岁落在 `ageRange` 内的那一段）。计算：`currentAge = 当前年 − 农历生年 + 1`；出盘 / 从命盘库载入时都重置到当前段；无当前段（超出 120 岁）时落第 1 段 |
| 边界 | `‹` 在 index 0 禁用、`›` 在 index 11 禁用（`disabled` + `aria-disabled`），**不循环** |
| 当前高亮 | 下拉选项里当前段后缀「（当前）」；选中段 = 当前段时，`回到当前` 位置显示 `当前` chip；选中段 ≠ 当前段时，显示 `回到当前` 按钮（品牌描边胶囊） |
| 跳转 | 下拉 `<select>`，12 个选项（不是 12 张卡）；原生 select 负责跨段跳转与键盘 |
| 键盘 | 焦点在 group 内：`←/→` 上一/下一段；`Home` 回到当前（不是第一段）；`Shift+←/→` ±1；`Esc` 不处理（留给浮层）。**事件必须 `stopPropagation`**，不得被盘面宫位导航接管 |
| 与盘面联动 | 选中段驱动 `scope`（`palaceNames` / `stars`）与 `scopeBadges`（`限+禄/权/科/忌`），盘面宫格显示限宫名与限星；**移除 `.zp-scope-bar`**（上下文只在 TimeBar 出现一次） |
| 与解读联动 | 见 §5.5 |
| 持久化 | 会话内保留（切到流年再切回不重置）；不写 localStorage（每次启动回到当前段） |

### 5.4 流年导航规格

| 项 | 规格 |
|---|---|
| 数据 | `E.yearlyForYear(chart, year)` → `{yearly:{stem,branch,palaceNames,stars}, nominalAge}` |
| 显示 | `‹ [2026] ›` + `丙午 · 虚岁35` + `[今年]`（非今年时） |
| 默认 | **今年**（若今年超出可排范围，取范围内最近的一年） |
| 范围 | `[max(1900, 农历生年), min(2100, 农历生年+120)]`；边界时 `‹`/`›` 禁用 |
| 输入 | **推荐**：年份只读展示 + ‹ › 步进 + 下拉跳转（避免非法输入）。**若保留输入框**（现状）：失焦/Enter 时钳制到范围并提示「已回到 2026（可排范围 1992–2112）」；输入过程中的半成品不触发重算 |
| 非法状态 | **不摧毁盘面**：保留上一张有效流年盘，TimeBar 内联一行 caption 提示原因；禁止再用"错误条替换整个盘面"的写法 |
| 键盘 | `←/→` ±1 年；`Shift+←/→` ±10 年；`Home` 今年；同大限，`stopPropagation` |
| 联动 | 流年星曜角标 + Inspector 流年四化；**payload 必须带年份**（§5.5） |

### 5.5 与解读上下文联动

**现状**：`runInterpretation` 的 payload 只有 `meta.currentAge / currentYear / decadalFocus`，其中 `decadalFocus = tab==='decadal' ? d.ageRange : null`。`src/ziwei-core.js` 的 `buildRequest` 认 `meta.decadalFocus`（长度 2 的年龄区间）并生成「命主在面板中选中的大限是 X–Y 虚岁」。**流年选择完全不进 payload**。

**v3 payload（客户端 `runInterpretation`）**

```js
meta: {
  name, place, occupation, gender,
  currentAge, currentYear,
  // 兼容字段：host/core 已在消费，保持形状不变
  decadalFocus: mode==='decadal' ? [from, to] : null,
  // 新增结构化字段（供 prompt 与调试；不改变 decadalFocus 语义）
  timeFocus: {
    mode,                                  // 'natal' | 'decadal' | 'yearly'
    decadal: mode==='decadal' ? { index, ageRange:[from,to], stemBranch:'甲辰', palaceName:'田宅', isCurrent:boolean } : null,
    yearly:  mode==='yearly'  ? { year:2026, stemBranch:'丙午', nominalAge:35 } : null
  }
}
```

**host/core 侧改动（一处）**：`src/ziwei-core.js` 的 `buildRequest` 在现有 `decadalFocus` 分支后增加：

```
若 meta.timeFocus.mode === 'yearly' && meta.timeFocus.yearly
  → focus.push('命主在面板中选中的流年是 2026 年（丙午），流年虚岁 35。');
```

`index.js` **不需要改**：`/ziwei/interpret` 已把 `payload.meta` 原样透传给 `buildRequest`（`index.js:705-710` 附近），加字段即可。

**抽屉联动**

- Drawer 头部增加**只读上下文 chip**：`本命` / `大限 第4段 33–42岁 甲辰 田宅` / `流年 2026 丙午 · 虚岁35`。chip 随 TimeBar 实时更新（读同一份 state）。
- 若已有对话且时间上下文变化：在对话流底部插入一行提示「时间上下文已切换为大限 33–42 岁；点「重新解读」按新范围重问」，**不自动重跑**。
- 空对话时的建议问题（`aiSug1..3`）按模式换：大限模式第一条改为「这个大限要注意什么」，流年模式改为「这一年（2026）的重点是什么」；减少"问大限答命格"的错配。

### 5.6 键盘与焦点（区域化，冲突规避）

| 区域 | 按键 | 行为 | 前提 |
|---|---|---|---|
| TimeBar 模式分段 | `←/→`、`Home/End` | 切换 本命/大限/流年（roving tabindex） | 焦点在分段按钮上；`stopPropagation` |
| TimeBar 运限导航 | `←/→` | 上一/下一段（年） | 焦点在导航 group 内 |
| TimeBar 运限导航 | `Home` | 回到当前段 / 今年 | 同上 |
| TimeBar 运限导航 | 原生 select | 展开/选择跳转 | — |
| ChartStage | `←/→` | 环上移宫 | 焦点在**宫格内**（`ev.target` 在 `.zp-grid` 内），且不是输入框 |
| Inspector | `Tab` | 对宫/三合按钮 | — |
| Drawer | `Esc` | 关闭（先关 PREVIEW） | 焦点在抽屉内 |
| 全局 | `Esc` | 逐层关浮层 | 无浮层时无动作 |

**硬规则**：v2 的 bug 是 `onStageKeyDown` 挂在 `.zp-stage` 上，页签按钮在 stage 内，焦点在页签上按 `←/→` 会切宫位而不是切页签。v3 要求**每个区域的键盘处理器只处理自己区域内的焦点**（先判 `ev.currentTarget.contains(document.activeElement)` 或给每个区域独立 handler），不允许全局/祖先劫持。

### 5.7 盘面运限角标

- 大限：宫格内显示限宫名（`zp-cell-scope`）与限星；四化角标加前缀「限」；选中段的三方四正高亮可选（P2，不做）。
- 流年：流曜以次级星行显示；流年四化角标前缀「流」。
- Inspector「本限四化 / 流年四化」段：`太阳化禄 · 官禄` 形式，数据取 `d.mutagen` + 宫位（v2 `scopeMutagenPositions` 逻辑可直接复用）。
- 颜色：四化沿用 tokens.md 内容色；**不得只用颜色**表达（角标本身带「禄/权/科/忌」字，满足）。

---

## 6. 按钮层级

### 6.1 层级定义

| 层级 | 视觉 | 用途 | 规则 |
|---|---|---|---|
| Primary | 品牌填充（`button-primary-fill` + `label-primary-inverted`），高 32 | **一屏唯一主行动** | 同屏 ≤1 个；禁用时降为 secondary 外观（保留槽位不跳动） |
| Secondary | `bg-layer-2` + `border-l1`，高 32/28 | 常规动作、表单提交（有盘时降级） | 不抢视觉 |
| Tertiary / 文字 | 透明底 + `label-secondary` | 卡内"收起/展开/改生辰"、建议 | 高 28，字 12 |
| Icon | 32×32（TimeBar 内 28×28） | 复制、写入、设置、关闭、步进 | **必须有 `aria-label` + `title`** |
| Segmented | 容器 32，项 28 | 模式、历法、性别、抽屉模式 | `role=tablist`（模式）或 `role=group & aria-pressed`（普通分段） |
| Toggle | 28 高胶囊 | 杂曜、专注 | `aria-pressed`；不得做成页签 |
| Danger | 仅 hover 变 `state-error-primary` 的图标 | 删除命盘 | 不做填充红按钮 |

### 6.2 全量按钮清单

> `条件`：`无盘` = 尚未出盘；`有盘` = 已出盘。`aria` 列只写关键语义（全部控件必须有可访问名称）。

| # | 控件 | 区域 | 类型/尺寸 | 出现条件 | 状态规则 |
|---|---|---|---|---|---|
| 1 | 返回会话 | AppBar | 图标+文字 / 32 | `canReturnToConversation` | 无 | 
| 2 | 左栏开关（收起/展开生辰栏） | AppBar | 图标 / 32 | mid/wide（narrow 不渲染） | `aria-expanded` + `aria-controls="zp-rail"` |
| 3 | 复制命盘 | AppBar | 图标（wide 带文字）/ 32 | 有盘 | 点击后 1.6s「已复制」；无盘不渲染 |
| 4 | 写入上下文（写入会话） | AppBar | 图标（wide 带文字）/ 32 | 有盘 | 成功 → 「已写入 ✓」2.2s；失败 → 就地错误条 |
| 5 | **紫微师解读** | AppBar | **primary** / 32（窄档在底栏 40） | 常驻槽位 | 无盘：secondary + disabled + `title="先排盘"`；有盘：primary；抽屉打开时：secondary + `aria-expanded=true` |
| 6 | 设置 | AppBar | 图标 / 32 | 常驻（narrow 移入「更多」） | `aria-expanded`；打开时 `aria-pressed` **不用** |
| 7 | 收起/展开表单 | ContextRail | 文字 / 28 | 常驻 | — |
| 8 | **排 盘** | ContextRail | primary（无盘）/ secondary（有盘）/ 32 | 常驻 | 无盘 = 唯一主行动；排盘中 disabled |
| 9 | 改生辰 | ContextRail | secondary / 28 | 有盘且表单折叠 | 点开展开表单并聚焦第一个字段 |
| 10 | 保存命盘 | ContextRail | secondary / 28 | 有盘 | 盘名为空时 disabled + `title="先填盘名"` |
| 11 | 删除命盘 | ContextRail | 图标 / 24 | 有盘且库非空 | hover 变 danger；二次确认用 `title` 或行内「再点一次」 |
| 12 | 命盘列表项 | ContextRail | 行（`role=button`，roving tabindex） | 有盘 | 选中态 `aria-current`；↑↓ 切换 |
| 13 | 本命 / 大限 / 流年 | TimeBar | segmented（tablist）/ 28 | 有盘 | `role=tab` + `aria-selected`；←→ 切换 |
| 14 | ‹ 上一个大限 / 上一年 | TimeBar | 图标 / 28 | 对应模式 | 边界 `disabled` |
| 15 | › 下一个大限 / 下一年 | TimeBar | 图标 / 28 | 对应模式 | 边界 `disabled` |
| 16 | 跳转下拉（大限/年份） | TimeBar | select / 28 | 对应模式 | 选项带「（当前）」 |
| 17 | 回到当前 / 今年 | TimeBar | 胶囊 / 28 | 对应模式且**不在当前** | 在当前时替换为 `当前` chip（非按钮） |
| 18 | 格局分析 | TimeBar | 胶囊 / 28 | 有盘 | `aria-pressed`（当前视图高亮） |
| 19 | 星曜词典 | TimeBar | 胶囊 / 28 | 有盘 | 同上，与格局互斥 |
| 20 | 返回盘面 | TimeBar | 图标+文字 / 28 | 工具视图 | 关闭工具视图 |
| 21 | 显示杂曜 | TimeBar | toggle / 28 | 有盘 | `aria-pressed`，持久化 |
| 22 | 专注看盘 | TimeBar | toggle / 28 | 有盘且 mid+ | `aria-pressed`；narrow 不渲染 |
| 23 | 宫位格 ×16 | ChartStage | 宫格（`role=button`，roving tabindex） | 有盘 | `aria-pressed` 选中；←→↑↓ |
| 24 | 用示例生辰排一盘 | ChartStage（empty） | secondary / 32 | 无盘 | 与 rail 主行动等价，**次按钮** |
| 25 | 对宫 · X | Inspector | secondary / 28 | 有盘 | — |
| 26 | 三合 · X（×2） | Inspector | secondary / 28 | 有盘 | — |
| 27 | 关闭详情 sheet | Inspector（窄档） | 图标 / 32 | narrow 且 sheet 开 | Esc 同效，焦点回宫位 |
| 28 | 关闭 | Drawer | 图标 / 32 | 抽屉开 | Esc 同效 |
| 29 | 新对话 | Drawer | 图标 / 32 | 抽屉开且有对话 | 流式中 disabled |
| 30 | 速览 / 鲲鹏报告 | Drawer | segmented / 28 | 抽屉开 | 切换只改下一次请求模式，不重跑 |
| 31 | 复制 | Drawer | 图标+文字 / 28 | 有回答 | 1.6s「已复制」 |
| 32 | 预览报告 | Drawer | 图标+文字 / 28 | 有回答 | 打开 PREVIEW 子层；`aria-expanded` |
| 33 | 导出精装 HTML | Drawer | 图标+文字 / 28 | 有回答 | 触发下载；失败就地错误 |
| 34 | 新会话继续（原「新会话解读」） | Drawer | 图标+文字 / 28（accent 描边） | 有盘 | 请求中 disabled；失败给可操作提示 |
| 35 | 发送 | Drawer | 图标 / 36 | 抽屉开 | 空输入 disabled；Enter 发送 |
| 36 | 停止 | Drawer | 图标 / 36 | 流式中 | 点击后保留已生成文本 |
| 37 | 继续生成 | Drawer（错误条内） | secondary / 28 | 中断且 `canContinue` | — |
| 38 | 建议问题 ×3 | Drawer（空对话） | tertiary 行 / 28 | 空对话 | 流式时 disabled |
| 39 | 关闭预览 | Drawer/PREVIEW | 图标 / 32 | 预览开 | 回到抽屉，不关抽屉 |
| 40 | 关闭设置 | Modal | 图标 / 32 | 弹层开 | Esc 同效 |
| 41 | 自动打开 / 宫格默认杂曜 | Modal | checkbox | 常驻 | 立即保存 |
| 42 | 生辰 | BottomBar | 图标+文字 / 40 | 仅 narrow 且无盘=不渲染？**有盘时**渲染 | 打开表单 sheet |
| 43 | 更多 | BottomBar | 图标 / 40 + popover | 仅 narrow 且有盘 | 菜单 4 项（复制/写入/命盘库/设置） |
| 44 | 主行动 | BottomBar | primary / 40 | 仅 narrow | 无盘=排盘，有盘=解读，抽屉开=关闭解读 |
| 45 | 重试（错误边界） | 全屏兜底 | secondary / 32 | 渲染异常 | 重置边界 |

### 6.3 唯一主行动矩阵

| 状态 | 唯一主行动 | 位置 | 其他填充按钮 |
|---|---|---|---|
| 无盘（S0） | **排 盘** | ContextRail 表单底部 / 窄档底栏 | 无（示例 CTA 是次按钮；AppBar 解读 disabled+secondary 外观） |
| 有盘·本命（S1） | **紫微师解读** | AppBar 右端 / 窄档底栏 | 无 |
| 有盘·大限（S2） | **紫微师解读**（上下文 = 选中大限） | 同上 | 无 |
| 有盘·流年（S3） | **紫微师解读**（上下文 = 选中流年） | 同上 | 无 |
| 工具视图（S4） | **紫微师解读** | AppBar | 无（返回盘面是次按钮） |
| 抽屉开·空闲（S5） | **发送** | Drawer composer | 无 |
| 抽屉开·流式 | **停止** | Drawer composer | 无 |
| 抽屉开·有错误 | **继续生成** | Drawer 错误条 | 无 |
| 设置开（S6） | **无**（关闭是唯一出口） | Modal 右上 | 无 |
| 排盘失败 | **排 盘**（重试） | ContextRail | 无 |
| 流年非法 | **紫微师解读**（保持） | AppBar | 无（TimeBar 内联提示，非弹层） |

**检验方法**：截屏后只看"品牌填充色出现在哪里"，全屏应恰好一处（流式时在 composer 的停止按钮）。

### 6.4 按钮规格

| 控件 | 高 | 圆角 | 内边距 | 字号/字重 | 备注 |
|---|---|---|---|---|---|
| Primary md | 32 | 8 | 0 16 | 13/650 | 与 design.md §4 一致；填充 `button-primary-fill`，前景 `label-primary-inverted` |
| Secondary md | 32 | 8 | 0 12 | 13/400 | `bg-layer-2` + `border-l1` |
| Secondary sm | 28 | 8 | 0 10 | 12/600 | 卡内、Inspector 导航 |
| Icon | 32×32（TimeBar 28×28） | 8（TimeBar 999） | 0 | — | 必须有 aria-label |
| Segmented | 容器 32 / 项 28 | 8（容器）/6（项） | 项 0 12 | 12/600 | 选中项 `brand-primary` 底 + inverted 前景 |
| Toggle | 28 | 999 | 0 10 | 11/600 | `aria-pressed` |
| Select / 年份 | 28 | 8 | 0 8 | 12 | 原生控件，单行 |
| 底栏按钮（窄档例外） | **40** | 10 | 0 14 | 13/650 | **登记例外**：触控目标 ≥40；其余档位严格 32/28 |
| 发送按钮 | 36×36 | 10 | — | — | 沿用 |
| 卡片圆角 | — | 12（浮层壳 16） | — | — | 容器只给盘面/浮层 |

### 6.5 收纳决策（不喧宾夺主）

| 动作 | 桌面档 | 窄档 | 理由 |
|---|---|---|---|
| 复制命盘 | AppBar 次级 icon（wide ≥1536 带文字，mid 仅图标） | 底栏「更多」菜单 | 使用频率中、需要一步可达；不是主行动 |
| 写入上下文 | 同上 | 同上 | 与复制成对出现，放一起 |
| 设置 | AppBar 最右 icon（全局唯一位置） | 底栏「更多」菜单 | 低频、全局 |
| 工具（格局/词典） | TimeBar 右侧两个胶囊 | TimeBar 行 2（同位置） | 与盘面同屏的"查阅"动作，必须在盘面附近，不进 AppBar |
| 导出/预览/新会话继续 | Drawer 底部工具条 | 同 | 只在有回答时出现 |
| 删除命盘 | 库行尾 icon | 库（更多→命盘库）内 | 危险动作不升级为主按钮 |

### 6.6 文案表（统一术语）

| 旧 | 新 | 原因 |
|---|---|---|
| 紫微师解读 / 紫微师 · 直接聊 / 新会话解读 | **紫微师解读**（区域统一叫"解读"）；**新会话继续**（原"新会话解读"） | 三个名字指同一件事，用户分不清哪个是"新建会话" |
| 速览解读 / 鲲鹏报告 | **速览** / **鲲鹏报告** | 去掉重复的"解读"二字 |
| 写入会话 | **写入上下文**（title 说明"只写命盘，不新建会话"） | 与"新会话继续"区分 |
| tabNatal 本命盘 / tabDecadal 大限 / tabYearly 流年 | **本命 / 大限 / 流年** | 模式是导航，不是页面标题 |
| 收起 / 展开（表单卡） | **收起生辰 / 展开生辰**；折叠行按钮 **改生辰** | 动作对象明确 |
| 年份无效 | **已回到 2026（可排范围 1992–2112）** | 说明"改哪个字段"，可操作 |
| 界面渲染异常 | **界面渲染异常，可点「重试」；若反复出现请刷新面板** | 给下一步 |
| 收起生辰栏/展开生辰栏（左栏开关） | 保留（`collapseRail/expandRail`） | 语义清楚 |

新增 i18n key（zh/en 必须成对，现 147 键对齐的约束不能破）：`currentBadge`（已加）、`backToCurrent`/`thisYear`（已加）、`prevDecade`/`nextDecade`/`prevYear`/`nextYear`（已加）、`timeScope`（已加）；**待加**：`timeNatal/timeDecadal/timeYearly`（若不复用 tab* 键）、`decadalCurrentTag`（"（当前）"）、`timeInvalidRange`、`contextChipDecadal/contextChipYearly`、`contextChanged`、`menuMore`、`menuLibrary`、`bottomBirth`、`chartDragHint`、`loadingMore`、`showAll`、`formErrorField`、`retryHint`。

---

## 7. 状态与反馈

| # | 状态 | 位置 | 形态 | 文案 | ARIA / 行为 |
|---|---|---|---|---|---|
| 1 | 无盘 | ChartStage | 太极 + 标题 + 一句 + 示例 CTA；rail 表单展开 | 「填写出生信息，点击「排 盘」开始」 | CTA 是**次**按钮；主行动唯一在 rail |
| 2 | 排盘进行中 | ContextRail 按钮 | 按钮 disabled + 文案不变（≤200ms 不显式 loading） | — | `aria-busy` 在表单区 |
| 3 | 排盘失败 | ContextRail 表单下方 | 就地错误条 + 指明字段 | 「请检查 出生时间：…」 | `role=alert`；焦点移到首个非法字段；主行动仍为排盘 |
| 4 | 流年越界/非法 | TimeBar（导航内） | 内联一行 caption（不替换盘面） | 「已回到 2026（可排范围 1992–2112）」 | `role=status`；盘面保留上一张有效流年盘 |
| 5 | 大限/流年边界 | TimeBar | `‹`/`›` disabled | — | `disabled` + `title="已到最早/最晚"` |
| 6 | 解读空闲 | Drawer | 空对话 + 3 条建议 + 引擎说明 | — | 建议按钮 `<button>`；主行动=发送 |
| 7 | 解读思考中 | Drawer 对话流 | 「思考中…（N 字）」 | — | `aria-live=polite`；可停止 |
| 8 | 解读流式 | Drawer | 打字行 + 字数 + 停止按钮 | 「生成中…」 | `role=log aria-live=polite aria-busy=true` |
| 9 | 用户停止 | Drawer 错误条 | 保留已生成 + 「继续生成」 | 「已停止生成，内容可能不完整；可点「继续生成」接着写」 | 错误条 `role=status` |
| 10 | 断流/超时/截断 | 同上 | 区分 `stream-closed`/`error`/`timed-out`；继续生成 | 「连接中断…」 | 不得静默丢弃已生成文本 |
| 11 | 命盘库空 | ContextRail/library | 一句文案（区域仍可见） | 「暂无保存的命盘」 | 不隐藏卡片/区域 |
| 12 | 命盘库过长 | ContextRail/library | 首屏 20 + 「显示全部 (N)」 | — | 懒加载 |
| 13 | 工具视图空结果 | UtilityView | 就地一句 | 「未检测到显著格局」/「没有匹配的星曜」 | 不隐藏区域 |
| 14 | 窄屏 sheet 打开 | Inspector（sheet） | 底部弹层 + 遮罩，≤72% 高 | — | `role=dialog aria-modal`、焦点陷阱、Esc、焦点归还 |
| 15 | 无 layout 服务 | AppBar | 不渲染「返回会话」按钮与分隔线（其余不变） | — | `canReturnToConversation=false`；不得显示死按钮 |
| 16 | 无 locale 服务 | 全局 | 回退内置 zh 字典 | — | 已实现；保持 |
| 17 | 无 ResizeObserver | 布局 | 退回 window resize 测量 | — | 已实现；保持 |
| 18 | 渲染崩溃 | 全屏兜底 | 错误边界 + 重试 | 「界面渲染异常，可点「重试」；若反复出现请刷新面板」 | 不白屏 |
| 19 | 报告预览 iframe 失败 | Drawer/PREVIEW | 空白 + 一句「预览加载失败，可直接导出」 | — | `iframe title` + `sandbox`（沿用） |

**文案总则**：错误必须回答"改哪个字段 / 下一步点哪"；禁用必须给 `title` 原因；不得用灰色文字替代禁用态。

---

## 8. 改造清单

> 锚点优先，行号只作快照参考（源码在并行改动，写稿时 2648 行）。`S` ≈ ≤0.5 天、`M` ≈ 0.5–1.5 天、`L` ≈ 2 天+。

### 8.1 组件级

| # | 改动 | 锚点（组件 / 函数 / 选择器） | 动作 | 复用 | S/M/L | 风险 |
|---|---|---|---|---|---|---|
| C1 | 新增 `AppBar` | `ProApp` 内 `.zp-head` 渲染块 | 抽出组件；去掉五行局 chip；左栏开关并入 | 现有 icon 按钮 | S | 低 |
| C2 | 新增 `ContextRail` | `.zp-side` + `InputForm`/`Summary`/`Library` | 三张卡 → 一个栏 + 三个 `data-slot` 区块；窄档 sheet 复用同一组件 | InputForm/Summary/Library 全复用 | M | 中（窄档 DOM 复用要避免双实例状态） |
| C3 | 重写 `TimeBar` | `.zp-timebar` 渲染块（当前已有一版） | 补：默认当前段、边界禁用、回到当前/今年、跳转下拉、键盘、模式 tablist 语义 | `Seg`、`Icon` | M | 中（键盘冲突） |
| C4 | 退役 `DecadalPanel`/`YearlyBar` | 两组件已从渲染移除 | 删除组件与 `.zp-decadal-list`/`.zp-scope-bar` 死 CSS | — | S | 低 |
| C5 | `ChartStage` | `.zp-board-wrap` 渲染块 | 抽出组件；加 `.zp-stage-scroll`/清单；流年错误改为内联提示 | `PalaceCell`/`CenterCell` | M | 中 |
| C6 | `Inspector` | `PalaceDetail` | 加「本限/流年四化」段（复用 v2 `scopeMutagenPositions`）；窄档 sheet 模式 | `PalaceDetail` | S | 低 |
| C7 | `UtilityView` | `PatternsView`/`DictView` + 新 `view` state | 阅读宽 760；词典分页；返回条 | 两组件复用 | S | 低 |
| C8 | 新增 `BottomBar` | `.zp-bottombar`（已有一版） | 补无盘状态（主行动=排盘）+「更多」popover；主行动与 AppBar 互斥渲染 | `Icon` | M | 低 |
| C9 | 抽屉改宽 + 上下文 chip | `AIModal` | 464→520；头部 chip；模式建议按上下文换 | `AIModal` 复用 | S | 低 |
| C10 | 解读 payload 扩展 | `runInterpretation` | 加 `timeFocus`；修 `decadalFocus` 触发条件；`ziwei-core.js buildRequest` 加流年聚焦句 | — | S | 低（core 一处纯文本） |
| C11 | 布局常量 + 档位 | `layoutMode` 表达式、`ResizeObserver` | 抽 `LAYOUT` 常量（RAIL_W/CHART_MAX/…）；`MID/WIDE/XWIDE` 由公式算；`useLayoutEffect` 首帧测量 | — | S | 低 |
| C12 | 状态/文案 | `DICT`、错误分支 | 按 §6.6/§7 改；补 i18n 键（zh/en 成对） | — | S | 低 |
| C13 | 空盘主行动 | `InputForm` 的排盘按钮 + `AppBar` 解读按钮 | 已部分实现（`hasChart` 降级）；补齐 disabled+title | — | S | 低 |

**明确复用、不重写**：`InputForm`、`Summary`、`Library`、`PalaceCell`、`CenterCell`、`PalaceDetail`、`StarEl`、`Taiji`、`Seg`、`Icon`（新增 chevron/clock/tools/more 图标）、`AIModal`、`SettingsModal`、`PatternsView`、`DictView`、`Boundary`、`buildReportHtml`、`focusablesIn/trapTab/useDialogFocus`。

### 8.2 CSS

| # | 改动 | 锚点 | 说明 | 风险 |
|---|---|---|---|---|
| S1 | 外壳分区 | `.zp-root` / `.zp-scroll` / `.zp-inner` / `.zp-body` | 拆成 `.zp-app` + `.zp-main` + `.zp-rail` + `.zp-work` + `.zp-content`（§4.2）；保留 `isolation:isolate` 与 darwin 规则 | **高**（牵一发动全身；见 Appendix B Q1） |
| S2 | AppBar | `.zp-head`/`.zp-brand*`/`.zp-head-sum`/`.zp-head-actions` | `min-height:56`、`flex-wrap:nowrap`、标题 20/650、上下文 chip 只留姓名+四柱 | 中（darwin padding 联动） |
| S3 | TimeBar | `.zp-timebar` 及新增 `.zp-time-nav/.zp-time-btn/.zp-time-select/.zp-time-now/.zp-time-chip/.zp-tool-btn` | 并入参数：高 48、`--zp-appbar-h`；步进按钮 28；去掉 24 的临时代码 | 低 |
| S4 | ContextRail | `.zp-side` → `.zp-rail`；`.zp-card` 在栏内失效 | 栏底 `bg-layer-1` + 右分隔线；区块用分隔线不用卡 | 中 |
| S5 | ChartStage | `.zp-board-wrap/.zp-board/.zp-grid` | `.zp-stage-scroll` + `.zp-cluster`；`.zp-board{min-width:560;max-width:CHART_MAX}`；横向滚动 | 中 |
| S6 | Inspector | `.zp-detail` | wide 去卡（左侧分隔线 + sticky top 0）；mid 下沉；narrow sheet 容器 | 低 |
| S7 | Drawer | `.zp-ai` | 宽 464→520；`min(520px,100%)`；头部 chip 样式 | 低 |
| S8 | BottomBar / 更多 / sheet | 新增 | 56 高、按钮 40、popover 240、sheet 72% | 低 |
| S9 | 死代码清理 | `.zp-scope-bar`、`.zp-decadal-list` | 删除（渲染已无引用） | 低 |
| S10 | 响应式 | `data-w` 三档 → 四档 | 新增 `xwide` 规则；阈值常量入 JS | 中 |
| S11 | 专注态 | `data-focus` | 保留；TimeBar 不隐藏；窄档不渲染开关 | 低 |

**CSS 硬约束**：新增声明必须落在 design.md 字阶（20/14/13/12/11 + 盘面 13.5/12/10.5/9.5）与间距档（0/2/4/6/8/12/16/24/32/40）内；不允许新增 `#hex`（除内容色白名单）；不允许 `position:fixed`；弹层一律 `absolute; inset:0`。

### 8.3 测试

**新增 `verify/verify.mjs` 断言（V1–V12，全部为静态字符串/结构断言，不需要 GUI）**

| # | 断言 | 防回归点 |
|---|---|---|
| V1 | 源码含 `data-region` 且值为 9 个白名单之一；九区都出现 | §3.2 |
| V2 | 源码无 `1072`/`1394` 字面量；`MID/WIDE/XWIDE` 由 `RAIL_W/CHART_MAX/...` 计算 | §4.3 |
| V3 | `.zp-board` 同时有 `min-width:560` 与 `max-width`；`.zp-stage-scroll` 含 `overflow-x:auto` | §4.5 |
| V4 | `.zp-ai` 宽为 `min(520px,100%)`；无 `position:fixed` | §4.4/§3.3 |
| V5 | 源码不含 `DecadalPanel`/`YearlyBar`；`.zp-timebar` 存在且含模式 tablist | §5 |
| V6 | 时间导航边界有 `disabled`；`回到当前`/`今年` 按钮存在 | §5.3/§5.4 |
| V7 | `selDecadal` 初值不再是 `0` 字面量（由当前大限计算） | §5.3 |
| V8 | `runInterpretation` payload 含 `timeFocus` 与 `yearly`；core `buildRequest` 含流年聚焦句 | §5.5 |
| V9 | 抽屉按钮用 `aria-expanded`，不是 `aria-pressed`（设置/解读/左栏）；切换类仍用 `aria-pressed` | §6/§3.3 |
| V10 | 键盘：TimeBar handler 内 `stopPropagation`；`onStageKeyDown` 先判 `ev.target` 在宫格内 | §5.6 |
| V11 | 窄档底栏只在 `data-w="narrow"` 渲染（CSS 或条件渲染其一）；主行动不双渲染 | §6.3 |
| V12 | i18n zh/en 键集合仍相等（新增键成对） | §6.6 |

**`scripts/audit-ui.mjs` 变更**

| 检查 | 变更 |
|---|---|
| C13 阈值公式 | 读 layout.md v3 参数表，断言 `MID/WIDE/XWIDE` 与源码常量一致；`1072/1394` 出现即 FAIL |
| C14 RegionId | 从"出现即校验"升级为**硬检查**：九区必须全部出现在源码 `data-region`；表外名 FAIL |
| **C17（新增）上限参数** | `.zp-rail width == RAIL_W`；`.zp-board max-width == CHART_MAX`（xwide 规则 == CHART_MAX_XL）；`.zp-ai width == min(DRAWER_W,100%)`；工具视图 `max-width == READ_MAX` |
| **C18（新增）无页面级滚动** | 不存在 `.zp-scroll` 单滚动容器（或豁免登记）；TimeBar 不在滚动容器内 |
| **C19（新增）时间导航语义** | 模式分段 `role=tablist` + `aria-selected`；步进按钮 `aria-label`；边界 `disabled` |
| **C20（新增）死代码** | `.zp-scope-bar` / `.zp-decadal-list` / `DecadalPanel` / `YearlyBar` 不得出现在 src 与构建产物 |

**棘轮基线（2026-11-08 运行时实测）**：C1 13 · C2 41 · C3 103 · C4 16 · C15 1 · C16 60，合计 234；当前 exit 0。改造期间：**只允许下降**；新增 CSS 不得让计数上涨；每 PR 跑 `node scripts/audit-ui.mjs`，下降后立刻 `--update-baseline` 并在 design.md §11 划掉对应行。注意 `docs/ui-contract/audit-baseline.json` 已由 42/49 更新为 41/60，三份契约文档里的旧数字需同步（文档漂移，属文档债）。

**测试顺序**：`node build.mjs` → `node verify/all.mjs`（含 `verify/ui-contract.mjs`）→ `node scripts/audit-ui.mjs` → 人工按 `v3-review-checklist.md` 走查。

### 8.4 文档

| 文档 | 改什么 |
|---|---|
| `docs/ui-contract/layout.md` | **§2 区域表整体替换为 9 区**（含迁移表）；§3 参数表/阈值公式替换为 §4.1/§4.3；§4 页型改为 P1/P2/P3（EMPTY 降为状态）；§5 Inspector 增加运限四化；§6 内容路由更新；§7 由 TABBAR 改为 TimeBar 导航准入（含"时间范围只能在 TIME_BAR"硬规则）；§8 状态表对齐 §7；§9 变更流程保留；§11 as-built 重写 |
| `docs/ui-contract/design.md` | §4 控件几何补 TimeBar 步进/胶囊/select、底栏 40 触控例外、sheet；§8 动效补 TimeBar/底栏（无动画）；其余不变 |
| `docs/ui-contract/tokens.md` | 无需新增 token（结构尺寸仍放 layout.md 参数表；若要变量化，加 `--zp-rail-w/--zp-chart-max/--zp-drawer-w` 三个结构变量并登记） |
| `README.md` | "界面 v2/v2.1"一节追加 v3 三条（时间导航/全宽策略/区域化），保留历史 |
| `docs/design/v3-review-checklist.md` | 本设计的**人眼验收清单**（另附） |

### 8.5 实施顺序（4 个 PR + 门禁）

| PR | 内容 | 依赖 | 门禁 |
|---|---|---|---|
| **A** 参数与结构 | 布局常量/公式/四档（C11）、`data-region` 九区（C1/C2/C5 的壳）、CSS 参数化（S1–S5、S10） | 无 | `verify` 全绿 + audit C13/C14/C17 绿；截图宽/中/窄三档 |
| **B** 时间导航 | TimeBar 补全（C3）、退役死代码（C4、S9）、默认当前段/边界/键盘（V5–V7） | A | 时间导航手工用例（12 段边界、键盘、回到当前、流年钳制） |
| **C** 全宽与窄屏 | 抽屉 520（C9）、底栏补全（C8）、窄档 sheet/懒加载（C6/C7）、`readMax` | A | 窄屏走查；全宽 2400 截图（不松散） |
| **D** 解读与文案 | payload 联动（C10、V8）、文案/i18n（C12、V12）、状态（§7）、文档同步（§8.4） | B | `verify` + core 断言 + 抽屉 chip 走查 |

**合并顺序不可颠倒**：A 是一切的地基；B/C 可并行（不同文件区）；D 依赖 B 的上下文 state。

---

## 9. 可点击线框（`v3-wireframe.html`）

- **打开方式**：浏览器直接打开（`file://` 即可，无外网依赖、无构建）。
- **控制条**：档位（1600 xwide / 1440 wide / 1200 mid / 700 narrow）、视图（本命 / 大限 / 流年 / 格局 / 词典）、抽屉开合、主题（浅/深）、有盘/无盘、**区域标注**（显示 9 个 RegionId 的虚线框与名字）。
- **数据**：用仓库自身引擎排出的**真实样例命盘**（1992-05-03 09:30 男 经度 105.97，真太阳时 08:37 辰时；命宫癸丑、太阳太阴、木三局；壬申 乙巳 己卯 戊辰；四化 天梁禄/紫微权/左辅科/武曲忌），页面内标注「示例数据，仅示意布局与字段」。
- **刻意不做**：不做品牌视觉（只用中性灰），避免它变成"第二套视觉权威源"（ui-contract 的硬规则：线框不带品牌色，token 以 `tokens.md` 为唯一权威）；不实现数据逻辑。
- **覆盖状态**：宽/中/窄（1600/1440/1200/700 四档可切）× 本命/大限/流年/工具 × 抽屉开合 × 无盘 × 明暗 × 区域标注。**未画**：设置弹层（MODAL）与窄档详情 sheet 的展开态——前者无结构争议，后者见 §4.5 规格；线框不实现窄屏 sheet 动画。
- **与最终实现的差异**：配色、字号、动效以实现为准；线框只对齐结构、层级与交互。实现已落地（Lead 同步 218 项全绿），**线框与实现的差异以设计 §10 与 checklist 为准**。

---

## 10. 与当前实现的对照（as-built delta）

> 快照：2026-11-08 15:44，`src/ui-pro.js` 2648 行。写稿时 Lead 正并行推进 v3-lite；**其后 Lead 已确认 v3 落地**（TimeBar / 可收起左栏 / 工具视图 / 窄屏底栏 / `data-region` 14/14 / 契约更新 / 218 项自检全绿）。因此本节保留为「写稿时差异记录」，**D6/D7/D8/D15 等可能已在落地版本中解决，一律以代码为准**；下表的价值是给出验收时应逐项复核的清单，而不是当前缺陷清单。

| # | 目标（本文） | 当前工作树 | 处置 |
|---|---|---|---|
| D1 | TimeBar 取代十二大限列表/年份输入 | ✅ 已实现：`.zp-timebar` + `timeNav`；`DecadalPanel`/`YearlyBar` 已删除 | 保留；按 §5.3/§5.4 补默认当前段、边界、键盘、钳制 |
| D2 | 左栏可收起 | ✅ `data-rail` + `.zp-rail-toggle` + `localStorage('ziwei-pro.rail')` | 保留；并入 ContextRail 语义 |
| D3 | 窄档底栏 | 🟡 `.zp-bottombar` 仅在 `data-chart="1"` 渲染，只含「生辰 + 解读」 | 补无盘态（排盘）与「更多」popover（§4.5/§6.2） |
| D4 | 工具视图 | ✅ `view='chart'|'patterns'|'dict'` + `.zp-toolview-head` + 返回盘面 | 保留；补阅读宽 760 与词典分页 |
| D5 | 有盘时排盘降级 | ✅ `InputForm hasChart` → `zp-btn`（去 primary） | 保留；补 AppBar 解读"无盘时 secondary+disabled+title" |
| D6 | 断点参数化 | ❌ 仍 `panelW >= 1394 ? 'wide' : panelW >= 1072 ? 'mid'`（字面量） | PR-A：常量 + 公式 + 四档（§4.3） |
| D7 | 分区独立滚动 / 无页面级滚动 | ❌ 仍 `.zp-scroll` 单滚动 + `.zp-body` 两列栅格 | PR-A：按 §4.2 拆；**若不愿拆，见 Appendix B Q1** |
| D8 | `data-region` 九区 | ❌ 0 处 | PR-A：加标记 + audit C14 硬检查 |
| D9 | 抽屉 520 | ❌ 仍 `min(464px,100%)` | PR-C |
| D10 | 流年非法不摧毁盘面 | ❌ 仍以错误条替换盘面（`!(tab==='yearly' && yearlyChart.error)` 条件） | PR-B：内联提示 + 保留上一张有效盘（§7 #4） |
| D11 | 大限默认当前段 | ❌ `selDecadal` 初值 `0` | PR-B |
| D12 | 解读 payload 带流年 | ❌ 仍只有 `decadalFocus` | PR-D（+ core `buildRequest` 一句） |
| D13 | Inspector 运限四化 | ❌ 详情仅 natal | PR-C |
| D14 | 死代码 | ❌ `.zp-scope-bar`（CSS 残留）、`.zp-decadal-list`（CSS 残留） | PR-B 清理 |
| D15 | 首帧不跳变 | ❌ `panelW<=0 → narrow` | PR-A：`useLayoutEffect` 首帧测量 |
| D16 | 时间步进按钮尺寸 | 🟡 `.zp-time-btn` 24×24 | PR-B：28×28（§6.4） |

**内部设计审查底稿的部分结论已过期**（该报告基于 2407 行快照；v2.2 已修，本文不重复记欠账）：

| 内部设计审查底稿的说法 | 2648 行现状 |
|---|---|
| 「0 处 `aria-live`」 | 已有 `role="log" aria-live="polite"`（对话流） |
| 「两个 dialog 无焦点陷阱/初始聚焦/归还」 | 已有 `useDialogFocus` + `trapTab`（背景 `inert` 仍缺，属可改进项） |
| 「iframe 无 title/sandbox」 | 已有 `title` + `sandbox` |
| 「全文无 `data-platform`/`--dsh-frame-*`」 | 已有 darwin 避让 + `.zp-exit` 出口 |
| 「Seg 无 `aria-pressed`」 | 已有 |
| 「表单 12 处无标签」 | 已有 `aria-label`（`htmlFor` 仍可补，非阻塞） |

---

## 11. 方法与局限

**已核实（A/B 级）**

- 代码事实：区域、组件、状态、payload、错误分支、阈值字面量、死代码——全部来自直接读源码（2648 行快照）。
- 数值：断点公式用参数算术推导并用 15 个 panelW 样例反算（§4.3 表），非估算。
- 线框数据：用本仓库确定性引擎实际排盘（1992-05-03 09:30 男 105.97），非手写假数据。
- 官方形态：DSH 入口页样板（标题 20/500/28、`pageHead padding-top:28px`、darwin `--dsh-frame-top-clearance`、区块 gap 32、子元素 max-width 960）——来自本机安装包源码，已抄录对照。
- 方法：ui-contract 的「一条切线 / 区域白名单 / 落位决策树 / 线框不带品牌 / 体检脚本」——来自其 README、layout-md-outline、design-md-outline 与 AI Native 手册「UI 项目：先定结构约定」一节。

**未验证（C 级，必须人工走查）**

1. **真实面板宽度**：`panelW` 取决于宿主侧栏与窗口，本文用假设值（360–2400）推导档位；实际是否存在 952/1436 附近"卡在边界反复切换"的抖动，未实测（已用 6px 阈值防抖，仍需走查）。
2. **全宽观感**：2400 下两侧 432px 留白是否"空"，只能人眼判断；本文给的是结构约束，不是审美结论。
3. **darwin 遮挡**：chrome 避让沿用 v2 已修规则，未复测。
4. **深色主题**：内容色/对比度沿用 tokens.md；v3 新增容器未引入新色，但深色下分隔线密度需走查。
5. **窄屏 sheet 手势**：未做拖拽关闭（v3 不做），键盘/Esc 路径需测。
6. **性能收益**：懒加载（流年/格局/预览）收益取决于真实机型，未测。
7. **本文与 Lead 并行实现的最终差异**：§10 是写稿时快照，实现继续推进后需重跑对照。

**方法局限**：ui-contract 的脚本只能抓机械漂移（字面量、区域名、上限、语义），抓不到"功能放进了合法但错误的区域"——放置是否合规仍需评审。线框是结构示意，不是视觉验收依据。

---

## Appendix A — v2/v3 术语对照

| v2（代码 / 契约） | v3（设计） |
|---|---|
| `.zp-head` | `APP_BAR` / `.zp-appbar` |
| `.zp-side` / `.zp-input-card` / `.zp-summary-card` / `.zp-lib-card` | `CONTEXT_RAIL` / `.zp-rail`（`data-slot=form/profile/library`） |
| `.zp-stage-bar` / `.zp-tabs` | `TIME_BAR` / `.zp-timebar` |
| `.zp-board-wrap` / `.zp-board` / `.zp-grid` | `CHART_STAGE` / `.zp-stage-scroll` + `.zp-cluster` |
| `.zp-detail` | `INSPECTOR` / `.zp-inspector` |
| `.zp-patterns` / `.zp-dict-grid` | `UTILITY_VIEW` / `.zp-utility` |
| `.zp-overlay > .zp-ai` / `.zp-ai-preview` | `DRAWER` / `PREVIEW` 子层 |
| `.zp-settings` | `MODAL` |
| （无） | `BOTTOM_BAR` / `.zp-bottombar` |
| `tab`（natal/decadal/yearly/patterns/dict） | `mode`（natal/decadal/yearly）+ `view`（chart/patterns/dict） |
| `selDecadal` / `yearlyYear` | 并入 TimeBar 状态；默认取当前大限/今年 |

## Appendix B — 需要拍板的点（含推荐）

| # | 问题 | 选项 | 推荐 | 影响 |
|---|---|---|---|---|
| Q1 | 是否拆"分区独立滚动"外壳（`.zp-scroll` → `.zp-main/.zp-rail/.zp-content`）？ | A 拆（§4.2）；B 不拆，TimeBar `sticky top:56` 妥协 | **A**：TimeBar 常驻是本次设计的核心；B 会让"时间导航永不消失"在长内容时失效 | A = CSS 面最大、收益最高；B = 改动小、留一项 v2 级妥协 |
| Q2 | 全宽时盘面是否允许 800（xwide）？ | A 允许（1536+ 到 800/320）；B 永远 720/300 | **A**：极宽下 720 会显得盘面偏小；但需走查单宫密度 | 影响 §4.1 的 `CHART_MAX_XL/INSPECTOR_W_XL` 与 §4.3 阈值 |
| Q3 | 流年年份：只读展示+步进，还是保留输入框？ | A 只读+步进+下拉；B 保留输入框+钳制 | **B（渐进）**：现有输入框可保留，但必须钳制且不摧毁盘面；下一版再收成只读 | 影响 §5.4 与表单可访问名称 |
| Q4 | 命主摘要卡是否合并进 ContextRail 的折叠区块？ | A 保持独立区块（可折叠）；B 全部塞进 AppBar chip | **A**：AppBar chip 只留姓名+四柱，五行局/命身主仍在 rail | 影响 §3.2/§6.5 去重口径 |
| Q5 | 工具视图用「两个入口（格局/词典）」还是「一个工具入口 + 页内子页签」？ | A 两个入口；B 一个入口 | **A**：当前实现已是两个入口，层级扁平、少一次点击 | 影响 §5.2 与 §6.2 #18/#19 |

## Appendix C — 边界纪律（我们不做什么）

1. **不重做视觉皮肤**：颜色/字阶/圆角沿用 ui-contract；本设计只改结构、导航、层级与状态。
2. **不新增第 4 个时间模式**（如"小限"独立页）；小限在 Inspector 内展示。
3. **不做移动端手势**（拖拽关闭 sheet、左右滑动切大限）；先做键盘与按钮可达。
4. **不做多盘对比 / 同屏双盘**；需要时先申请新页型。
5. **不改引擎、不改 `/ziwei/*` 路由契约**；解读联动只在 payload 加字段 + core 加一句 prompt。
6. **不做 URL 深链**（把"大限/流年"放进地址栏）——记为 P2，等结构稳定后再评估。
7. **不在本轮引入新依赖/新框架**（React 已够，状态仍在 `ProApp`）。

---

## §12 v3.0 落地对照（Lead，2026-11-08）

本节记录**实际合入的这一版**与上文设计的差异，避免「文档 vs 代码」各说各话。原则：**先落地结构，再逐步参数化**；能复用现有契约与测试的地方不推倒重来。

### 12.1 已落地（v3.0）

| 设计项 | 落地情况 |
|---|---|
| TimeBar 常驻：本命/大限/流年 3 模式 | ✅ `.zp-timebar` + `.zp-tabs`（`role=tablist`） |
| 大限导航：`‹ 段位 干支 宫位 ›` + 回到当前 + 下拉 | ✅ `select` + 前后按钮 + 当前态；默认停在**当前大限**（新增 `currentDecadeIndex`），不再是第 0 段 |
| 流年导航：`‹ 年份 ›` + 今年 | ✅ 输入框 + 步进 + 今年；非法年份只显示错误条，不摧毁盘面 |
| 十二大限列表 / 年份输入不再压在盘面上方 | ✅ `DecadalPanel` 与 `YearlyBar` 已移除（死代码删除） |
| 格局/词典移出主 tab | ✅ TimeBar 右侧工具入口 + `TOOLPAGE` + 「返回盘面」 |
| 左栏可收起、窄屏贴底行动条 | ✅ `data-rail=open/closed`、`aria-expanded/aria-controls`、`.zp-bottombar`（窄屏有盘时） |
| 唯一主行动 | ✅ 有盘后「排 盘」降为次按钮；HEAD 只保留「紫微师解读」 |
| 区域标记 | ✅ `data-region` **14/14**：HEAD / SIDE_PROFILE / SIDE_PATTERNS / SIDE_FORM / SIDE_LIBRARY / TIMEBAR / BOARD / INSPECTOR / TOOLPAGE / EMPTY / DRAWER / PREVIEW / MODAL / BOTTOMBAR |
| 契约同步 | ✅ `docs/ui-contract/layout.md`：TABBAR → TIMEBAR、新增 BOTTOMBAR、13 区、页型矩阵与 §11 as-built 更新 |
| 解读联动 | ✅ 保留 `decadalFocus`，新增 `yearlyFocus`；`buildRequest` 增加流年聚焦句；大限/流年意图互斥，避免误判 |
| 防回退 | ✅ `verify/verify.mjs` 新增 8 条 v3 断言；全量 **225** 项通过 |

### 12.2 本轮**未**采纳（有意为之）

| 设计项 | 处理 | 原因 / 下一步 |
|---|---|---|
| Q1 分区独立滚动外壳（拆 `.zp-scroll`） | 暂用 **Q1-B**：保留单一 `.zp-scroll`，TimeBar `sticky; top:56px` | 收益大但 CSS 与事件面最大；需真人走查确认 sticky 在长表单/窄屏不漂移后再决定是否升级 |
| 参数化断点 952 / 1436 / 1536 | 保留 1072 / 1394 与 296/304/720/300/464 | 与 `layout.md` 参数表、audit C13 公式、`ui-contract` 既有测量值一致；一次性改尺寸会把「契约→审计→测试」三层同时翻掉，风险高于收益 |
| 全宽盘面 800（xwide） | 保持 720 | 待 Q2 拍板 + 真机看单宫密度 |
| 抽屉 520 | 保持 464 | 同上，属尺寸参数，不与本次结构改动混做 |
| 9 区合并命名（APP_BAR/CONTEXT_RAIL…） | 先保留 13 个 RegionId，v1.5.0 增补 SIDE_PATTERNS 为 14 个 | 契约按「区域白名单」运作，改名要同时改三处（表 / `data-region` / 未来联合类型）；等 v3.1 再统一 |
| `timeFocus` 结构化 payload | 用 `currentAge/currentYear/decadalFocus/yearlyFocus` 四个字段 | 足够驱动 prompt；等服务端契约稳定再收成一个对象 |
| audit C17–C20 | 未新增 | 现有 C1–C16 + verify v3 断言已覆盖本次改动；新增规则随 v3.1 一起做 |

### 12.3 验收方式

- 自动：`node build.mjs && node verify/all.mjs`（8 组 225 项）；`node scripts/audit-ui.mjs`（10 通过 / 6 历史欠账 WARN / 0 失败）。
- **人工（必须）**：按 `docs/design/v3-review-checklist.md` 逐项看；本机无浏览器控制，**未做视觉复核**，不能声称界面已验收。
