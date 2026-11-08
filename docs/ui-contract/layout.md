# 界面契约 · 结构（layout.md）

> **给编码 agent 的三句话：**
> 1. 动手改界面结构之前，先走 §1 落位决策树。能落到某个 RegionId，直接实现，不用改本文。
> 2. 落不下来，**停**。不要自己新开区域 / 栏 / 浮层，走 §9 变更流程。
> 3. 代码里每个区域标记（`data-region`）的值都必须在 §2 白名单里；表外名字即违规。

- 适用对象：`ziwei-workbench` 客户端面板（`src/ui-pro.js` 内置 CSS + `client.js` 构建产物）
- 本文管**结构**：区域树、页型、栏宽、阈值、落位规则、降级顺序
- 本文**不含**颜色 / 字号 / 圆角 / 间距值（结构参数除外），那些在 [design.md](design.md)；值在 [tokens.md](tokens.md)
- 本版依据：`内部设计审查底稿（不随仓库发布）` §1/§5.2 + 当前源码实测（2026-11-07 20:10 快照，`src/ui-pro.js` 2501 行）
- **行号说明**：文中行号为上述快照值，源码改动后会漂移；契约校验以**选择器 / 类名**为准（`scripts/audit-ui.mjs` 不写死行号）

---

## §0 与视觉规范的分工

切线只有一条：**换一套品牌视觉时，这条规则会不会变？**

| 项 | 归属 | 为什么 |
|---|---|---|
| 区域树、哪些区域存在 | layout.md | 换品牌不变 |
| 栏宽、阈值、降级顺序 | layout.md | 换品牌不变 |
| 新东西放哪个区域 | layout.md §1/§2 | 换品牌不变 |
| 页型（有盘页 / 无盘页 / 工具页） | layout.md §4 | 换品牌不变 |
| 状态语义类（空/流式/错误）落在哪个区域 | layout.md §8 | 换品牌不变 |
| 字号、字重、行高 | design.md | 换品牌变 |
| 颜色、对比度底线 | design.md + tokens.md | 换品牌变 |
| 间距档位、圆角、控件几何 | design.md | 换品牌变 |
| 动效时长、状态渐变曲线 | design.md | 换品牌变 |
| token 名与其值 | tokens.md | 换品牌变（值） |

**硬规则**：本文不写视觉值；design.md 不写区域树与栏宽。唯一真实耦合点已双向标注：

> ⚠ **`BOARD_MIN` 与盘面字号下限耦合**：`BOARD_MIN` 决定单宫宽度下限，进而决定盘面无障碍字号下限。改 `BOARD_MIN` 必须回看 design.md §5「盘面数据子阶」；改盘面字号下限必须回看 §3.3 参数表。

**现有代码不是权威**：本文与代码冲突时，改的是代码。本文与代码当前的差异集中在 §11（as-built 对照），不藏在规则里。

---

## §1 落位决策树（入口）

### 1.1 短路（先判这 4 条）

| # | 条件 | 落位 |
|---|---|---|
| S1 | 是「与当前命盘无关的全局动作 / 全局身份」 | `HEAD`（且必须满足 §2 的 HEAD 约束） |
| S2 | 是一段需要宽度与专注的对话 / 长文本 | `DRAWER`（临时）或 `TOOLPAGE`（有持久入口的阅读） |
| S3 | 是「当前选中宫的一个切面」 | `INSPECTOR`（仅 natal 视图存在） |
| S4 | 是一批命盘的集合（保存/加载/删除） | `SIDE_LIBRARY` |

短路按**条件**引用（S1~S4 是固定编号），不要在代码注释里引用「第几条」，插入一行就错位。

### 1.2 主干（4 个问题，每片叶子是 RegionId）

```
Q1 这个东西依附于「当前命盘」吗？
├─ 否 → Q2
└─ 是 → Q3

Q2 它是全局动作 / 全局身份吗？
├─ 是 → HEAD
└─ 否 → 它是「设置 / 偏好」吗？
        ├─ 是 → MODAL
        └─ 否 → 停（§9）

Q3 它属于哪个切面？
├─ 盘面本体的组成（宫格、中宫、角标、选中环） → BOARD
├─ 当前选中宫的详情                        → INSPECTOR
├─ 命盘的身份摘要（四柱、五行局、命宫身宫） → SIDE_PROFILE
├─ 命盘结论摘要（格局名/等级/一句话） → SIDE_PATTERNS
├─ 生成命盘所需的输入                      → SIDE_FORM
├─ 时间维度 / 工具 / 视图开关              → TIMEBAR
├─ 一格新的视图内容（整页级）              → TOOLPAGE
└─ 无盘时的占位                          → EMPTY
```

### 1.3 落不下来：停

走 §9 提「区域申请」，**不许挑一个最像的区域塞进去**。所有「先放 settings 里吧」最后都会变成杂物抽屉，而用户正是因为这个才来要契约。

### 1.4 反向清单（出现下列想法说明已经走偏）

1. 「我先放进 `HEAD`，以后再挪」——HEAD 只放全局身份与唯一主行动，不是 tmp 目录。
2. 「在 `BOARD` 里加一张小卡片说明一下」——盘面只放命盘本体，说明性长文去 `INSPECTOR` / `TOOLPAGE`。
3. 「`TOOLPAGE` 里顺便显示一小块盘面」——工具页禁止出现盘面（§4 矩阵）。
4. 「两个浮层叠一起：抽屉里再开设置」——浮层单层，见 §4.3。
5. 「`INSPECTOR` 装不下，我在盘面右边再加一列」——加列是结构变更，走 §9。

### 1.5 树必须全覆盖

每个输入恰好到达**一个** RegionId 或明确的「停」，不能 0 个、不能 2 个。五种破法：缝隙（某类需求谁都不接）、双解（叶子写了 A 或 B）、落进真实区域当兜底（「没匹配就放设置」）、回环（停又指回主干）、开放边界（枚举满了没规则）。

敌意输入 + 普通输入的追踪记录在 **Appendix C**。只写结论不写追踪等于没追踪。

---

## §2 区域白名单（14 个 RegionId）

命名约定：**全大写、下划线分段、扁平单段以上最多两段**（`SIDE_FORM` 是两段）。同一个名字必须逐字出现在 **本文表格、DOM 的 `data-region` 属性、（将来）`src/ui-region.js` 的联合类型** 三处；改名即三处同时改，缺一即 audit 失败。

| Region | 职责（Responsibility） | 对应选择器 / JSX 位置 | 允许放（Must hold） | 禁止放（Must not hold） |
|---|---|---|---|---|
| `HEAD` | 全局页头：品牌、当前命主上下文、唯一主行动、全局入口 | `.zp-head`（CSS 238 / JSX 2153） | 页面标题、命主摘要 chip、返回会话出口（`.zp-exit`，HEAD 的第一个控件）、复制/写入会话、唯一主行动「紫微师解读」、设置入口 | 表单字段、设置项正文、第二个 brand 填充按钮、危险操作（删除/清空）、命盘库管理 |
| `SIDE_PROFILE` | 当前命盘只读摘要 | `.zp-summary-card`（CSS 281 / JSX 1132） | 四柱、生肖/星座、命宫身宫、五行局、命主身主、起运、真太阳时、四化 strip | 任何可编辑控件、任何按钮、已保存盘列表 |
| `SIDE_PATTERNS` | 命主信息下方的格局摘要（只读） | `.zp-patterns-card`（v1.5.0） | 格局名、等级、一句话说明、查看全部入口（最多 4 条） | 完整格局正文、可编辑控件、盘面内容 |
| `SIDE_FORM` | 生辰输入与排盘 | `.zp-input-card`（CSS 279 / JSX 1109） | 11 个字段、历法/性别分段、流派折叠 `<details>`、排盘按钮、错误条 | 已保存盘列表、解读入口、命主摘要、命盘库 |
| `SIDE_LIBRARY` | 命盘资产管理 | `.zp-lib-card`（CSS 282 / JSX 1160） | 保存输入、盘列表（每项最多 1 个删除按钮）、当前选中态 | 编辑盘名（保存时输入）、批量操作、导入导出、解读正文 |
| `TIMEBAR` | 时间维度切换、运限导航、工具入口与视图级开关 | `.zp-timebar` / `.zp-tabs` / `.zp-time-nav`（v3） | 本命/大限/流年 3 个模式页签；大限「‹ 段位 干支 宫位 › + 回到当前 + 下拉」；流年「‹ 年份 › + 今年」；格局/词典工具入口；杂曜/专注开关 | 状态告警、主行动、设置、盘面内容、第二套导航条、把十二大限列表或年份输入堆在盘面上方 |
| `BOTTOMBAR` | 窄屏（`data-w="narrow"`）贴底行动条 | `.zp-bottombar`（v3，仅窄屏有盘时渲染） | 「生辰」（展开左栏并回到顶部）、唯一主行动「紫微师解读」 | 第三个动作、设置、复制/写入会话（这些在 HEAD 或 TIMEBAR）、盘面内容 |
| `BOARD` | 命盘本体 | `.zp-board-wrap` / `.zp-board` / `.zp-grid`（CSS 432/436/444 / JSX 2235） | 16 宫、中宫、选中环、命/身标记、四化/庙旺角标、盘面横向滚动容器 | 说明性长文、表格、跨宫对比、解读正文、第二张卡片 |
| `INSPECTOR` | 当前选中宫的一个切面 | `.zp-detail`（CSS 571 / JSX 1275） | 主/辅/杂曜、大限小限十二神、对宫/三合导航、宫位四化 | 第二宫详情、报告文本、设置项、跨宫对比 |
| `TOOLPAGE` | 非盘面视图的整页内容 | `.zp-patterns` / `.zp-dict-grid` / `.zp-decadal-list` / 流年条（CSS 831/839/381） | 各自网格/列表（格局卡、词典条目、十二大限列表、流年选择条） | 盘面（不得与 BOARD 同屏）、主行动、第二套卡片语言 |
| `EMPTY` | 未出盘时的占位 | `.zp-empty`（CSS 846 / JSX 2221） | 太极符号、一句说明、一个示例 CTA | 第二张卡、第二个 CTA、表单（表单在 SIDE_FORM） |
| `DRAWER` | 解读抽屉（右滑浮层） | `.zp-overlay > .zp-ai`（CSS 651/663 / JSX 1522） | 对话流、模式切换、建议、复制/预览/导出/带到会话、输入框、免责声明 | 设置项、命盘库管理、第二个弹层（PREVIEW 是它的子层，见下） |
| `PREVIEW` | 报告 HTML 只读预览（DRAWER 内层） | `.zp-ai-preview > iframe`（CSS 763 / JSX 1604/1609） | iframe、关闭、返回会话 | 编辑控件、导出按钮（导出在 DRAWER 工具条）、第二个 iframe |
| `MODAL` | 持久偏好弹层 | `.zp-settings`（CSS 773 / JSX 1619） | API Key（可后置）、自动打开、默认杂曜、关于 | 命盘数据、解读正文、命盘库、危险操作 |

**表尾指认代码形态**：当前 `data-region` 在源码中为 **0 处**（见 §11）；将来落地形态是 `src/ui-region.js` 里的 `type RegionId = 'HEAD' | 'SIDE_FORM' | ...` + 每区域元数据。改这张表必须同时改联合类型与 `data-region`，顺序见 §9。

**逐区允许/禁止的判定口径**：允许放 = 用户预期它能在这个区域找到；禁止放 = 放进去会让「同一类东西两个位置」或「主行动不唯一」，是本契约要防的漂移。

---

## §3 外壳骨架

### 3.1 区域树（`=` 固定，`~` 弹性）

```
.zp-root                     容器 height:100%; overflow:hidden; isolation:isolate
└─ .zp-scroll                唯一滚动容器 height:100%; overflow:auto
   └─ .zp-inner              max-width 1460（全局上限，见 §3.2 事实 3）
      ├─ HEAD    .zp-head              ~auto（sticky top:0; z-index:20）
      └─ .zp-body             grid（narrow 1 列 / mid 296px+1fr / wide 304px+1fr）
         ├─ .zp-side         =SIDE_MID / SIDE_WIDE（narrow 下 display:contents 拆散重排）
         │  ├─ SIDE_FORM     .zp-input-card      ~auto
         │  ├─ SIDE_PROFILE  .zp-summary-card    ~auto（无盘时不渲染）
         │  └─ SIDE_LIBRARY  .zp-lib-card        ~auto
         └─ .zp-stage        =剩余宽（main 区）
            ├─ TIMEBAR       .zp-timebar      auto（无盘时不渲染；窄屏非 sticky）
            ├─ EMPTY         .zp-empty         ~auto（无盘时）
            ├─ TOOLPAGE      .zp-patterns / .zp-dict-grid / .zp-decadal-list   ~auto
            └─ BOARD         .zp-board-wrap
               ├─ BOARD      .zp-board  max-width:720（居中）
               └─ INSPECTOR  .zp-detail  宽 300（仅 wide 并列，否则下沉）
浮层（都绝对定位在 .zp-root 内，不按视口坐标）：
   DRAWER  .zp-overlay > .zp-ai        =min(464px,100%)，右贴边
      └─ PREVIEW .zp-ai-preview        =inset:0（DRAWER 子层，z-index:5）
   MODAL   .zp-overlay-center > .zp-settings   =min(520px,100%)
```

### 3.2 关键结构事实（图上看不出来、但改扩展规则时会踩的）

1. **wide 不是三列**：`.zp-body` 始终是两列（`304px minmax(0,1fr)`），第三列「宫位详情」由 `.zp-board-wrap.has-detail` 在 `.zp-stage` **内部**再切两列（`minmax(0,1fr) 300px`）。所以「加第三栏」不是改 `.zp-body`，是改 `.zp-board-wrap`。把 300 挪出 stage 会同时改阈值公式。
2. **narrow 用 `display:contents` 拆掉左栏**：`.zp-side` 失去盒模型，其子卡片与 `.zp-stage` 一起参与 `.zp-body` 单列栅格，靠 `order` 重排（出盘后 BOARD 在前，见 `.zp-root[data-w="narrow"][data-chart="1"]` 规则）。改动顺序只能改 `order`，不能改 DOM 顺序——DOM 顺序决定 Tab 顺序。
3. **`.zp-inner` 的 1460 是全局上限，不属于任何区域**：盘面自身另有 `--zp-board-max:720`。两个上限叠加时，盘面在 1460 内居中；工具页正文没有独立阅读宽（`READ_MAX` 尚未落地，§11）。
4. **浮层是「面板内绝对定位」不是「视口 fixed」**：`.zp-root` 是 `position:relative` 的不滚动外壳，`.zp-overlay` 是 `position:absolute; inset:0; z-index:100`。因此浮层只覆盖工作台、不覆盖宿主侧栏，也不受侧栏宽度变化影响。**禁止**改成 `position:fixed`——那会盖住 DSH 侧栏折叠后的出口按钮（本仓库已有回归：`.zp-exit`）。
5. **`.zp-root` 的 `isolation:isolate` 是外壳契约不是样式偏好**：它把面板内的 z-index（20 顶栏 / 100 浮层）关进面板自己的层叠上下文，保证宿主 frame 的侧栏出口（leading 层）不被面板内部浮层盖住。删掉它，`MODAL` 打开时侧栏出口可能点不到。

### 3.3 结构参数表（代码只能引用这些值）

| 参数 | 值 | 用途 / 约束 | 现状 |
|---|---|---|---|
| `SIDE_COMPACT` | 264 | compact 档左栏宽（px） | 已实现（`.zp-body` compact 栅格） |
| `SIDE_MID` | 296 | mid 档左栏宽（px） | 已实现（`.zp-body` mid 栅格） |
| `SIDE_WIDE` | 304 | wide 档左栏宽（px） | 已实现（`.zp-body` wide 栅格） |
| `BOARD_MAX` | 720 | mid/wide 盘面最大宽（px） | 已实现（`--zp-board-max`） |
| `BOARD_COMPACT` | 600 | compact 档盘面最大宽（px） | 已实现（compact 的 `--zp-board-max` 覆盖） |
| `BOARD_MIN` | 560 | 盘面最小可读宽（px），低于则横向滚动 | 目标值，代码未实现（P0-3） |
| `INSPECTOR_W` | 300 | 宫位详情列宽（px） | 已实现（`.zp-board-wrap.has-detail`） |
| `INSPECTOR_GAP` | 14 | 盘面与详情列的间隙（px） | 已实现（同上 `gap:14px`） |
| `GUTTER` | 16 | mid/wide 的栏间距（px） | 已实现（`.zp-body` gap） |
| `GAP_COMPACT` | 12 | compact 档栏间距（px） | 已实现（`.zp-body` compact gap） |
| `PAGE_PAD_X` | 40 | mid/wide 滚动区横向内边距合计（20×2，px） | 已实现（`.zp-scroll` padding） |
| `PAD_COMPACT` | 32 | compact 滚动区横向内边距合计（16×2，px） | 已实现（compact 的 `.zp-scroll` padding） |
| `DRAWER_W` | 464 | 解读抽屉宽（px，`min(464px,100%)`） | 已实现（`.zp-ai`） |
| `MODAL_W` | 520 | 设置弹层宽（px，`min(520px,100%)`） | 已实现（`.zp-settings`） |
| `COMPACT` | 908 | = `SIDE_COMPACT + GAP_COMPACT + BOARD_COMPACT + PAD_COMPACT` = 264+12+600+32 | 已实现，但以字面量出现（§3.4） |
| `MID` | 1072 | = `SIDE_MID + GUTTER + BOARD_MAX + PAGE_PAD_X` | 已实现，但以字面量出现（§3.4） |
| `WIDE` | 1394 | = `SIDE_WIDE + GUTTER + BOARD_MAX + INSPECTOR_GAP + INSPECTOR_W + PAGE_PAD_X` | 已实现，但以字面量出现（§3.4） |

⚠ 改 `SIDE_*` / `BOARD_*` / `INSPECTOR_*` / `GUTTER` / `PAGE_PAD_X` 任一项，必须重算 `COMPACT`/`MID`/`WIDE`、更新本表、跑 `node scripts/audit-ui.mjs`（C13 会核对公式与代码字面量）。

### 3.4 四档阈值：公式与当前硬编码对照

三档由**面板实测宽度** `panelW` 决定（`ResizeObserver`，不是 viewport media query）：

| 档位 | 条件 | 栅格 | 阈值公式 | 当前硬编码值 |
|---|---|---|---|---|
| `narrow` | `panelW < COMPACT` | 单列；`.zp-side` 拆散；详情下沉到盘面下方 | — | `panelW <= 0 ? 'narrow'`（首帧兜底） |
| `compact` | `COMPACT ≤ panelW < MID` | `264px + 1fr`；盘面 ≤600；详情下沉 | `COMPACT = SIDE_COMPACT + GAP_COMPACT + BOARD_COMPACT + PAD_COMPACT` = 264+12+600+32 = **908** | `908`（ui-pro.js，字面量） |
| `mid` | `MID ≤ panelW < WIDE` | `296px + 1fr`；详情下沉到盘面下方 | `MID = SIDE_MID + GUTTER + BOARD_MAX + PAGE_PAD_X` = 296+16+720+40 = **1072** | `1072`（ui-pro.js，字面量） |
| `wide` | `panelW ≥ WIDE` | `304px + 1fr`，stage 内再切 `1fr + 300px` | `WIDE = SIDE_WIDE + GUTTER + BOARD_MAX + INSPECTOR_GAP + INSPECTOR_W + PAGE_PAD_X` = 304+16+720+14+300+40 = **1394** | `1394`（ui-pro.js:2141，字面量） |

判读：两个阈值不是拍脑袋，是**布局参数的精确和**——这正是最危险的魔数：看起来有理由，但没写在任何文档里，改一个栏宽就静默失配。**§11 的 P1-5 是把字面量换成常量并由本表公式算出**；在那之前 audit 的 C13 会把字面量与本文公式对账，对不上即 FAIL。

### 3.5 降级顺序

空间不足时，按下列顺序降级（后者在前者之后）：

```
wide（详情并列）
  → mid（详情下沉到盘面下方，左栏 296，盘面 720）
    → compact（左栏 264，盘面 600，详情下沉）
      → narrow（左栏拆成单列，盘面优先）
      → 表单折叠（.zp-input-card 折叠为一行摘要）
        → 盘面横向滚动（宽度 < BOARD_MIN 560）
```

- 手动「专注看盘」（`data-focus`）**双向优先**于自动降级：手动进专注态时，即使 wide 也隐藏左栏；手动退出后回到自动档位。用户优先于自动。
- 降级只看**面板宽度**，不看 window 宽度，不用 media query。改判定方式等于改契约。
- 首帧 `panelW <= 0` 强制 narrow，ResizeObserver 回调后才切档——宽屏下有一次可见的布局跳变，属已知行为（§11）。

---

## §4 页型

### 4.1 四种页型

| 页型 | 组成 | 用途 | 区分特征 |
|---|---|---|---|
| P1 未出盘 | `HEAD` + `SIDE_FORM` + `SIDE_LIBRARY` + `EMPTY` | 还没排盘 | **无 TIMEBAR、无 BOARD、无 INSPECTOR、无 BOTTOMBAR** |
| P2 本命页 | `HEAD` + `SIDE_*` + `TIMEBAR` + `BOARD` + `INSPECTOR` | 看本命盘与选中宫 | 唯一会出现 INSPECTOR 的页型 |
| P3 大限/流年页 | `HEAD` + `SIDE_*` + `TIMEBAR` + `BOARD` | 运限视角 | 盘面 + TIMEBAR 内的段位/年份步进，**无 INSPECTOR、不再有盘上列表** |
| P4 工具页 | `HEAD` + `SIDE_*` + `TIMEBAR` + `TOOLPAGE` | 格局 / 词典 | **无 BOARD**（工具页禁止盘面） |

`DRAWER`（解读抽屉）与 `MODAL`（设置）**不是页型**，是任意页型上叠加的浮层；`PREVIEW` 是 `DRAWER` 的子层。

### 4.2 页型 × 区域矩阵（`✓` 必有 / `○` 可选 / `—` 必无）

| 区域 | P1 未出盘 | P2 本命 | P3 大限 | P4 工具 |
|---|---|---|---|---|
| `HEAD` | ✓ | ✓ | ✓ | ✓ |
| `SIDE_FORM` | ✓ | ✓ | ✓ | ✓ |
| `SIDE_PROFILE` | — | ✓ | ✓ | ✓ |
| `SIDE_LIBRARY` | ✓ | ✓ | ✓ | ✓ |
| `TIMEBAR` | — | ✓ | ✓ | ✓ |
| `BOARD` | — | ✓ | ✓ | — |
| `INSPECTOR` | — | ○（选中宫时） | — | — |
| `TOOLPAGE` | — | — | ✓ | ✓ |
| `EMPTY` | ✓ | — | — | — |
| `DRAWER` | ○ 浮层 | ○ 浮层 | ○ 浮层 | ○ 浮层 |
| `PREVIEW` | — | ○（DRAWER 内） | ○ | ○ |
| `MODAL` | ○ 浮层 | ○ 浮层 | ○ 浮层 | ○ 浮层 |

矩阵之外不得新增勾。想让 `BOARD` 出现在 P4，改变的是 §4.1 的定义，走 §9。

### 4.3 浮层规则

- **同一时间只有一个顶层浮层**：`DRAWER` 或 `MODAL`，二选一。打开另一个必须先关当前（当前代码：`modal` 单值状态，天然满足）。
- **`PREVIEW` 只能作为 `DRAWER` 的子层**，不得独立存在；关闭 `PREVIEW` 回到 `DRAWER`，不是关闭全部。
- 抽屉与设置**不得互相嵌套**（「抽屉里开设置」是反模式 §10）。
- 浮层用 `position:absolute; inset:0` 覆盖面板，**不得**用 `position:fixed`（理由见 §3.2 事实 4）。
- Esc 逐层关闭：先 `PREVIEW` → 再 `DRAWER`/`MODAL` → 无层时无动作。
- 开关类按钮用 `aria-expanded` + `aria-controls`；`aria-pressed` 只用于「切换态」（杂曜/专注），不用于「打开浮层」（§11 现状欠账）。

---

## §5 焦点槽：`INSPECTOR`

### 5.1 类型枚举（当前 1 种，封闭集）

| 类型 | 承载对象 | 初始切面组 |
|---|---|---|
| `palace` | 当前选中的宫位 | 主星 / 辅星 / 杂曜 / 运限 / 对宫三合导航 |

新增第 2 种类型要过 §9 的准入判据，不能顺手加。

### 5.2 准入规则

只有「一类一等对象（命盘/宫位）的一个切面」能进 `INSPECTOR`。典型**非准入项**与去处：

| 非准入项 | 去处 |
|---|---|
| 跨宫对比表 | 拒绝；或新建 `TOOLPAGE` 页签（走 §9） |
| 整盘解读长文 | `DRAWER` 或 `TOOLPAGE` |
| 运限详情 | P3 的 `TOOLPAGE`（十二大限列表 / 流年条） |
| 设置项 | `MODAL` |
| 跨命盘对比 | 拒绝，先申请新页型 |

### 5.3 内部结构

所有类型共享一组段（每段可选）：`头（宫名+干支）` / `主星` / `辅星` / `杂曜` / `运限` / `导航（对宫/三合）`。三个典型组合：`full`（默认）、`compact`（窄档下沉后）、`nav-only`（只留导航，用于专注看盘）。组合名固定，后续讨论用这些名字。

### 5.4 切换与键盘

- 谁决定显示：`BOARD` 的宫位选中态（`selected`）。`INSPECTOR` 不自己决定看哪一宫。
- 切换成本一步：点宫 / ←→↑↓ 方向键（在 `.zp-stage` 上，roving tabindex）。焦点在输入框时不接管方向键。
- `INSPECTOR` 不自带上下文：选中态在所有页型里唯一，切视图不重置。
- wide 下 `INSPECTOR` 是 `position:sticky; top:64px`（`64` 是魔数，待 P1-4 变量化）；mid/narrow 下沉到盘面下方，来源同一份数据。

---

## §6 主区内容路由

| 内容 | 落位 | 形态 | 为什么 |
|---|---|---|---|
| 16 宫格 / 中宫 / 选中环 / 四化角标 | `BOARD` | 4×4 栅格 | 命盘本体，唯一「命理图形」 |
| 选中宫的星曜与运限详情 | `INSPECTOR` | 分段卡片 | 一个切面 |
| 十二大限列表 / 流年选择条 | `TOOLPAGE` | 列表 / 单选条 | 整页级内容，不是宫位切面 |
| 格局卡片网格 | `TOOLPAGE` | `auto-fill` 网格 | 阅读性内容 |
| 星曜词典网格 | `TOOLPAGE` | `auto-fit` 网格 | 阅读性内容 |
| 命盘摘要（四柱/五行局/命宫） | `SIDE_PROFILE` | 只读字段 | 命盘身份 |
| 命盘库列表 | `SIDE_LIBRARY` | 列表 | 资产 |
| 对话与解读 | `DRAWER` | 对话流 | 需要宽度与专注 |
| 设置项 | `MODAL` | 表单 | 全局偏好 |

**兜底**：上表之外的内容 = 停，走 §9。不要发明第 N+1 种形态。

**「一个组件多个入口」与「两套实现」的区别**：同一组件在多个页型出现（如 TIMEBAR 在本命/大限/流年/工具页）必须渲染同一个 `.zp-tabs` 组件；复制一份新的就叫两套实现，是漂移。

---

## §7 导航准入：`TIMEBAR`

**3 个模式页签封闭集：本命 / 大限 / 流年**；格局、词典不是页签，是 `TIMEBAR` 右侧的**工具入口**（打开后占用 `TOOLPAGE`，提供「返回盘面」）。

| 模式 | 区分特征 | 不该进模式的东西 |
|---|---|---|
| 本命 | 静态命盘 + 选中宫详情 | 运限导航、工具结果 |
| 大限 | 盘面 + TIMEBAR 段位步进（‹ 段位 干支 宫位 › + 回到当前 + 下拉） | 十二大限卡片列表（已移除）、年份选择 |
| 流年 | 盘面 + TIMEBAR 年份步进（‹ 年份 › + 今年） | 大限段位选择、十二大限列表 |
| （工具）格局 | 工具页：格局卡片网格 | 盘面（工具页禁止） |
| （工具）词典 | 工具页：星曜词典 | 盘面 |

| 页签 | 区分特征 | 不该上页签的东西 |
|---|---|---|
| 本命 | 静态命盘 + 选中宫详情 | 运限数据、工具结果 |
| 大限 | 运限 + 十二大限列表 | 本命单宫详情（INSPECTOR 只在 P2） |
| 流年 | 运限 + 年份选择 | 大限列表 |
| 格局 | 格局卡片网格 | 盘面（工具页禁止） |
| 词典 | 星曜词典 | 盘面 |

规则：

- 模式页签（`role=tablist`）与视图级开关（toggle，`aria-pressed`）同在 `TIMEBAR`，但层级不同：不得给开关加页签样式，也不得把开关做成第 4 个模式。
- 运限导航是 `TIMEBAR` 内的普通控件（按钮 + `<select>` / `<input>`），不是新页签；键盘进入控件时不触发 BOARD 的宫位导航。
- **加第 4 个模式页签是结构变更**：必须先答「为什么现有 3 个接不住」+「新模式的 TIMEBAR/会话形态」，走 §9；加模式同时要更新 §4.2 矩阵。
- 模式收在 3 个以内：工具/参考类视图一律走 `TIMEBAR` 工具入口或 `TOOLPAGE`，不再扩页签。
- 页签键盘：方向键切页签、`aria-selected` 同步（待做，§11）。页签的 ←→ 不得被 BOARD 的宫位导航截胡；`TIMEBAR` 内 `<select>/<input>` 获得焦点时 BOARD 导航必须让路（已实现）。

---

## §8 非正常路径的落位

| 状态 | 区域 | 形态 | 禁止 |
|---|---|---|---|
| 未出盘 | `EMPTY` | 太极符号 + 一句说明 + 示例 CTA | 第二个 CTA；把主行动藏起来 |
| 排盘错误 | `SIDE_FORM` 内错误条 | 文本 + 指明字段 | 全屏弹层；只给「出错了」 |
| 计算中 / 流式 | 对应区域就地 | 打字行 + 字数 + 停止按钮 | 阻塞式全屏 loading；无 `aria-live` |
| 流式中断 | `DRAWER` 错误条 + 「继续生成」 | 区分截断/断连/超时 | 静默丢弃已生成文本 |
| 命盘库空 | `SIDE_LIBRARY` | 一句「暂无保存的命盘」 | 隐藏整张卡（区域必须稳定可见） |
| 禁用（未出盘时解读） | `HEAD` 主行动 | `disabled` + 说明原因（tooltip/title） | 隐藏按钮；点了无反应 |
| 崩溃兜底 | 整面板错误边界 | 「界面渲染异常」+ 重试 | 白屏 |
| 单区域失败（某卡片渲染失败） | 该区域 | 局部错误占位 | 整面板卸载 |

规则：**空态替代内容区，不新增页型**；错误就近显示在触发它的区域；任何浮层里出错，浮层不自动关闭。

---

## §9 变更流程

1. **落位成功**：直接实现，不改本文。若发现新的一类需求反复落不下来，才进 2。
2. **落位失败 → 区域申请**，必须一笔答全：
   - 它是哪类一等对象的切面？
   - 为什么现有 12 个区域装不下（逐区说明）？
   - 它会变空吗？空态长什么样？
   - 需要多少宽度（对照 §3.3 参数）？
   - 不给新区域时，最接近的折中是什么？
   答不全 = 需求本身没想清楚，不是布局问题。
3. **同步顺序**：`layout.md` §2 表 →（将来）`src/ui-region.js` 联合类型 → DOM `data-region` → 实现。**绝不反向**。文档与代码冲突时改代码。
4. **阈值/参数变更**：改 §3.3 参数 → 重算 §3.4 公式 → 改代码 → `node scripts/audit-ui.mjs`。
5. **推翻旧结论**：不删除，进 Appendix B 记「曾是 / 现在是 / 为什么推翻」。

---

## §10 反模式

| 不要 | 为什么 | 改成 |
|---|---|---|
| 在 `HEAD` 加第二个 brand 填充按钮 | 主行动不唯一，用户不知道点哪个 | 出盘后「排 盘」降为次按钮，HEAD 只留「解读」 |
| 给 `BOARD` 加说明性小卡片 | 盘面是命理图形，说明文字会稀释主视觉 | 说明进 `INSPECTOR`；整页内容进 `TOOLPAGE` |
| 用 `position:fixed` 做浮层 | 会盖住宿主侧栏出口（已有回归） | `position:absolute; inset:0`（§3.2 事实 4） |
| 抽屉里再开设置层 | 浮层叠层后 Esc/焦点语义不可预测 | 先关抽屉再开设置（§4.3） |
| 工具页顺便显示盘面 | 两种页型的区分特征被破坏 | 盘面只在 P2/P3 |
| 把新字号/颜色写进 layout.md | 与 design.md/tokens.md 重复，必漂移 | 只写结构参数 |
| 阈值不写公式只写数字 | 改栏宽即静默失配（本轮修的就是这个） | 写公式 + audit 对账 |
| 新区域名不进表就写在代码里 | 白名单失效 | 先 §9，再入表、类型、DOM |

---

## §11 as-built 对照：本文与当前代码的差异

本节是**契约 vs 现状**的诚实清单（2026-11-07 实测），不是规则。修完一项，删一项；不要留着当待办博物馆。

| # | 契约要求 | 现状 | 处置 |
|---|---|---|---|
| A1 | `data-region` 14 处与 §2 一一对应 | v1.5.0 已接 **14/14**（HEAD/SIDE_PROFILE/SIDE_PATTERNS/SIDE_FORM/SIDE_LIBRARY/TIMEBAR/BOARD/INSPECTOR/TOOLPAGE/EMPTY/DRAWER/PREVIEW/MODAL/BOTTOMBAR） | 已接线；改区域名须同步本文与源码 |
| A2 | `RegionId` 联合类型 | 无 `src/ui-region.js` | 待接线 |
| A3 | `COMPACT`/`MID`/`WIDE` 由参数公式计算 | 仍为字面量 `908`/`1072`/`1394`（与公式一致）；compact 档为 v3.1 新增 | P1-5 待做；audit C13 已对账 |
| A4 | `BOARD_MIN 560` + 盘面横向滚动 | `.zp-board` 只有 `max-width:720`，无 `min-width` | P0-3 待做 |
| A5 | 工具页独立阅读宽 `READ_MAX 760` | 全局 `max-width:1460` | P2-2 待做 |
| A6 | `INSPECTOR` 的 `sticky top` 用变量 | 字面量 `top:64px`（ui-pro.js:575） | P1-4 待做 |
| A7 | 页签方向键切页签 | 未实现；←→ 仍会被舞台宫位导航接管 | P0-4 待做 |
| A8 | 浮层开关用 `aria-expanded` | HEAD 的解读/设置仍用 `aria-pressed`；v3 左栏开关已用 `aria-expanded` + `aria-controls` | 部分完成 |
| A9 | 首帧不跳变 | `panelW<=0` 强制 narrow，回调后切档 | 可接受，记录在案 |
| A10 | `HEAD` 首个控件是 `.zp-exit` 返回会话 | 已实现（仅宿主支持时渲染） | — |

---

## Appendix A — 本文不决定的事

| 问题 | 归属 |
|---|---|
| 颜色、字号、间距、圆角、动效 | design.md |
| token 名与值 | tokens.md |
| 排盘算法、真太阳时、历法换算 | `src/ziwei-core.js` / `engine-built.js` |
| 解读提示词、模型选择、流式协议 | `index.js`（host 侧） |
| 权限、数据持久化、命盘库存储格式 | `index.js` |
| 宿主窗口 chrome（darwin 安全区数值） | `@deepseek-ai/dsh-client-ui-layout` README |

## Appendix B — 已推翻的结论

| 曾是 | 现在是 | 为什么推翻 |
|---|---|---|
| 阈值写死 1072/1394 | 参数公式 + 对账 | 改栏宽会静默失配；本轮已把公式写进 §3.4 |
| 浮层用 `position:fixed` 覆盖视口 | 面板内 `absolute` | 会盖住侧栏出口；已修复为绝对定位 |
| 详情列作为 `.zp-body` 第三列 | 在 `.zp-board-wrap` 内部切两列 | 改第三列会连带改阈值；内部切列让 stage 仍是一个区域 |
| 顶栏 sticky `top:0` 视为天经地义 | 保留但需 darwin clearance | mac 窗口控件遮挡；已加 `--dsh-frame-*` 避让 |

## Appendix C — 落位追踪

验证 §1 全覆盖的一次记录（2026-11-07，本文初版）。每行必须落到一个 RegionId 或明确的「停」。

| 输入 | 敌意/普通 | 落位 | 这次暴露了什么 |
|---|---|---|---|
| 「导出全部命盘」 | 敌意（无归属对象的一次性动作） | 停 → §9 | 初版树会把「没归属」漏进 SIDE_LIBRARY；补了 S4 的边界（只限单盘集合操作） |
| 「在盘面下加一行运势解释」 | 敌意（两处都像） | `INSPECTOR`（选中宫切面） | 补 §1.4 反向清单第 2 条，明确盘面不放说明文字 |
| 「给页签加第 6 个『神煞』」 | 敌意（枚举已满） | 停 → §7 合并规则 | 初版 §7 只写「5 个页签」，没写满了怎么办；补「合并而非溢出菜单」 |
| 「顶栏加『分享』按钮」 | 普通 | `HEAD` | 普通动作大部分能落；但 HEAD 主行动唯一性需在 §2 的禁止放里重申 |
| 「宫位详情加一个『复制此宫』」 | 普通 | `INSPECTOR` | 通过；但暴露「复制类动作在 HEAD 已有先例」，在 §2 INSPECTOR 允许放里补「宫位四化」而非复制按钮 |
| 「命盘库加导入 JSON」 | 普通 | `SIDE_LIBRARY` | 通过（导入=资产集合操作） |

追踪规则：树上每次改动都要重跑一次敌意 + 普通输入，**追加不覆盖**，并写清触发原因（「某日，因为 §1.1 插入了 S1」）。
