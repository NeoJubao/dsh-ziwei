# 界面约定 v6 · 结构（layout.md）

> **状态**：现行界面（v6）的约定（spec [2026-11-19_v6-redesign](../specs/2026-11-19_v6-redesign.md) §4.6）。
> 切换到 v6 时（计划 T10），这三份文档从 `docs/ui-contract/v6/` 移到本目录，取代了 v5 版；它们管着现在的 `client.js`。
>
> **给编码 agent 的三句话：**
> 1. 动手之前先看 §1：新东西能落到哪个 RegionId，就直接实现，不用改本文。
> 2. 落不下来就**停**，不要自己新开区域、栏或浮层；先改本文的 §2，再写代码。
> 3. 代码里每个 `data-region` 的值都必须在 §2 的表里，那个元素还要带上表里登记的类名。

- 适用对象：`src/ui/` 拼出来的 v6 面板（`node scripts/audit-ui.mjs --profile v6` 体检）
- 本文管**结构**：区域、页型、档位、栏宽、浮层规则、宿主约定
- 本文**不写**颜色、字号、圆角、间距（结构参数除外），那些在 [design.md](design.md)；颜色的值在 [tokens.md](tokens.md)
- 体检脚本读本文的两张表：§2 区域表（表头含 `Region` 和 `禁止放`）、§4.1 参数表（表头含 `参数` 和 `值`）。改表即改检查。

---

## §0 分工

切线只有一条：**换一套品牌视觉时，这条规则会不会变？** 会变的进 design.md / tokens.md，不会变的进本文。

---

## §1 落位

| 新东西是…… | 放在 |
|---|---|
| 和当前命盘无关的全局动作（设置、全部命盘） | `HEAD` |
| 首页的 3D 画面和星球 | `HOME_SKY` |
| 首页的对话一列（状态句、输入、快捷项、引导问答） | `HOME_TALK` |
| 当前时间层级的信息和前后翻 | `SCOPE` |
| 格局 | `PATTERNS` |
| 选中那一宫（或那颗星）的切面 | `INSPECTOR` |
| 十二宫、中宫、三方四正连线 | `BOARD` |
| 报告的目录和整份报告的操作 | `REPORT_TOC` |
| 报告正文和写作状态 | `REPORT_DOC` |
| 对话、速览、提问 | `ASSISTANT` |
| 要填表或要从一长串里选（生辰表单、全部命盘） | `SHEET` |
| 偏好 | `MODAL` |
| 一句操作结果，最多带一个撤销 | `TOAST` |

落不下来时不要硬塞：先在 §2 加一行（职责、选择器、允许放、禁止放），再写代码。

---

## §2 区域白名单（14 个 RegionId）

「选择器」一栏的第一个类名就是带 `data-region` 的那个元素的类名；同一格里列出的其他类名，在区域接线后也必须在 CSS 里存在（体检 C12）。

| Region | 职责 | 选择器 | 允许放 | 禁止放 |
|---|---|---|---|---|
| `HEAD` | 顶栏 | `.zp-head` | 位置（回首页的「星图」是命盘页顶栏的第一个控件，后面是盘名）、页签（本命 / 大限 / 流年 / 流月 / 流日，分隔线后是报告）、问紫微师、更多、全部命盘、设置。不放「返回会话」（§5） | 表单字段、命盘内容、第二个主按钮、删除和清除这类危险操作 |
| `HOME_SKY` | 首页星图 | `.zp-sky` | 3D 画布或静态星图、星球标签（真正的按钮）、准星 | 说明段落、输入框、设置项 |
| `HOME_TALK` | 首页底部一列 | `.zp-col` | 日期、状态句、引导问答的已答项、输入框（里面有模型按钮）、引导问答的提示、快捷项 | 盘面、报告正文、第二个输入框 |
| `SCOPE` | 时间卡 | `.zp-scope` | 层级名、这一层的时间、一句要点、四化四格、前后翻、回到今天、解读这一层 | 宫位详情、格局列表、对话 |
| `PATTERNS` | 格局卡 | `.zp-pats` | 引擎检出的全部格局（名称 + 吉 / 中 / 凶）、选中格局的说明 | 宫位详情、运限、对话 |
| `INSPECTOR` | 宫位卡 | `.zp-detail` | 宫名、干支、运限宫名、主星、辅星、杂曜（开关打开时）、一句星曜解释、三方四正、大限岁数、问这一宫 | 第二个宫的详情、报告正文、设置项 |
| `PANES` | 窄档下切换三张卡的页签 | `.zp-panes` | 时间卡 / 格局卡 / 宫位卡三个页签 | 第四个页签、页签以外的控件 |
| `BOARD` | 盘面 | `.zp-board` | 十二宫、中宫、三方四正连线、选中和高亮 | 说明长文、表格、解读正文、卡片 |
| `REPORT_TOC` | 报告目录和报告操作 | `.zp-rtoc` | 将要写 / 正在写 / 已写的部分、目录、下载报告、复制全文、重新写 | 报告正文、对话 |
| `REPORT_DOC` | 报告阅读栏 | `.zp-rmain` | 状态栏、空态、正文、问这段 | 盘面、目录、设置项 |
| `ASSISTANT` | 紫微师面板 | `.zp-assistant`、`.zp-chat-thread` | 速览、对话流（`.zp-chat-thread`，`role="log"`）、常驻的引导问题（输入框上方一排，跟着选中的宫和当前时间层级走）、输入区（输入框，下面一行是模型按钮和发送 / 停止）、接着写 / 重试 / 换个模型、新对话、在新会话里继续、免责声明 | 设置项、命盘库管理、整份报告正文 |
| `SHEET` | 面板内的浮层 | `.zp-sheet` | 生辰表单（直接填表 / 改生辰）、全部命盘 | 对话、设置项、第二个浮层 |
| `MODAL` | 设置、模型选择 | `.zp-modal` | 设置：外观、自动打开面板、首页 3D 星图、清除本机记录、检查更新、回到 DSH 对话、关于。模型选择：跟随 DSH 默认、按提供方分组的模型 | 命盘数据、解读正文、命盘库 |
| `TOAST` | 提示条 | `.zp-toast` | 一句结果，至多一个动作（撤销） | 第二个动作、表单、长文 |

---

## §3 页型

| 页型 | 组成 |
|---|---|
| P1 首页 | `HEAD` + `HOME_SKY` + `HOME_TALK` |
| P2 命盘页 | `HEAD` + `SCOPE` + `PATTERNS` + `INSPECTOR` + `BOARD`（窄档多 `PANES`，三张卡一次只显示一张） |
| P3 报告页 | `HEAD` + `REPORT_TOC` + `REPORT_DOC` |

- `ASSISTANT` 可以出现在 P2、P3 上：宽档并排（不是浮层），中、窄档是模态浮层。
- `SHEET`、`MODAL` 是模态浮层。**同一时间只有一个模态浮层**；Esc 关最上面的一层，焦点回到触发它的控件。
- 浮层用 `position: absolute; inset: 0` 盖住面板，**不用** `position: fixed`。居中的浮层容器是 `.zp-overlay-center`（darwin 下的上内边距见 §5）。
- 一屏放完：命盘页在三档下都不出现面板级的纵向滚动条；空间不够先收说明文字，卡片本身不滚动。

### 外壳

```
.zp-root                 position: relative; height: 100%; overflow: hidden; isolation: isolate; data-w = narrow | mid | wide
└─ .zp-shell             在文档流里的相对定位盒子（吃得到根节点 darwin 的 padding-top）
   ├─ HEAD    .zp-head
   ├─ 首页    .zp-home  ── HOME_SKY .zp-sky / HOME_TALK .zp-col
   ├─ 命盘页  左栏（SCOPE / PATTERNS / INSPECTOR，窄档 PANES）+ BOARD
   ├─ 报告页  REPORT_TOC + REPORT_DOC
   └─ 浮层    ASSISTANT（中、窄档）/ SHEET / MODAL / TOAST，都在 .zp-shell 里绝对定位
```

原型的顶栏是绝对定位的；绝对定位的子元素不受根节点 `padding-top` 影响，所以插件里外壳必须是在文档流中的相对定位盒子。

---

## §4 档位

按面板实测宽度 `panelW` 分档（`ResizeObserver`），**不用视口媒体查询**；首帧 `panelW <= 0` 按窄档。

### 4.1 结构参数（代码只能用这些值）

| 参数 | 值 | 用途 |
|---|---|---|
| `SIDE_MIN` | 244 | 左栏最小宽 |
| `SIDE_MAX` | 316 | 左栏最大宽（`clamp(244px, 25%, 316px)`） |
| `GUTTER` | 16 | 栏间距 |
| `PAGE_PAD_X` | 40 | 中、宽档横向内边距合计（20 × 2） |
| `PAD_NARROW` | 24 | 窄档横向内边距合计（12 × 2） |
| `BOARD_MIN` | 420 | 两栏布局下盘面的最小宽 |
| `BOARD_COMFORT` | 520 | 紫微师并排时留给盘面的最小宽 |
| `ASSISTANT_W` | 360 | 紫微师面板宽 |
| `SHEET_W` | 420 | 生辰表单 / 全部命盘浮层宽（`min(420px, 100%)`） |
| `MODAL_W` | 520 | 设置弹层宽（`min(520px, 100%)`） |
| `DOC_MAX` | 700 | 报告正文最大行宽 |
| `MID` | 720 | = `SIDE_MIN + GUTTER + BOARD_MIN + PAGE_PAD_X` = 244 + 16 + 420 + 40 |
| `WIDE` | 1180 | = `ASSISTANT_W + SIDE_MIN + GUTTER + BOARD_COMFORT + PAGE_PAD_X` = 360 + 244 + 16 + 520 + 40 |

### 4.2 三档

| 档位 | 条件 | 布局 |
|---|---|---|
| `narrow` | `panelW < MID` | 单栏；盘面在上，`PANES` + 一张卡在下；顶栏在命盘页是两行；紫微师铺满 |
| `mid` | `MID ≤ panelW < WIDE` | 两栏（左栏 + 盘面）；紫微师浮在右侧 |
| `wide` | `panelW ≥ WIDE` | 两栏；紫微师打开时并排，成为第三栏 |

- 代码里的判定只有一处（`src/ui/20-util.js` 的 `tierOf`），写成 `panelW >= 1180`、`panelW >= 720` 两个字面量；体检 C13 核对它们等于上表的公式。
- 盘面在可用区域内按宽高比伸缩：中、宽档 1.05–1.62，窄档 0.74–0.92；宫格里的字用容器查询单位随盘面缩放。

---

## §5 宿主约定（不许绕开）

1. **返回会话**：2026-11-20 起不在顶栏里（Neo 真机反馈；侧栏折叠时宿主放在左上角的出口由第 2、4 条保证不被盖住）。面板自己的出口留两处，类名都含 `zp-exit`、`type="button"`、文字是「返回会话」、点击调用 `layout.selectPanel(null)`：设置弹层的最后一行「回到 DSH 对话」，和面板最外层出错时的错误页。layout 服务不可用时两处都不渲染，其余功能不受影响。
2. **层叠隔离**：`.zp-root` 保持 `isolation: isolate`，面板里的 z-index 关在自己的层叠上下文里，盖不住宿主 frame 的侧栏出口。
3. **不用 `position: fixed`**：浮层都在面板内绝对定位。
4. **macOS 窗口标题带**：三个变量都带兜底值、选择器都限定 `html[data-platform="darwin"]`：
   - `.zp-root` 的 `padding-top: var(--dsh-frame-top-clearance, 0px)`；
   - 侧栏折叠时顶栏左内边距 `max(20px, var(--dsh-frame-leading-clearance, 0px))`；
   - 居中浮层 `.zp-overlay-center` 的上内边距 `max(48px, var(--dsh-frame-overlay-top, 46px))`。
   首页的 3D 画布可以铺到标题带下面，可点的控件不行。
5. **加载只注册 factory**：`window.ZWEngine` / `window.ZWCore` 在 factory 第一次物化时才有；Three.js 和 3D 场景在首页第一次可见时才执行，不产生 `window.THREE`。

---

## §6 和体检脚本的对应（`--profile v6`）

| 检查 | 读本文哪里 | 判定 |
|---|---|---|
| C12 结构类 | §2「选择器」列、§5 第 1 条 | `.zp-root`、`.zp-head`、`.zp-exit` 必须在 CSS 里，源码里要有带 `zp-exit` 的出口；某个区域在源码里接了线（出现 `data-region`），它登记的类名都必须在 CSS 里，且带 `data-region` 的元素带着第一个类名 |
| C11 对话流 | §2 `ASSISTANT` 行 | `ASSISTANT` 接线后必须有 `.zp-chat-thread`，且带 `role="log"`、`aria-live="polite"` |
| C13 阈值公式 | §4.1 参数表 | 参数齐全；`MID`、`WIDE` 等于公式；源码里和 `panelW` 比较的字面量恰好是这两个值 |
| C14 区域白名单 | §2 区域表 | 源码里的 `data-region` 值都在表里 |

---

## Appendix B — 已推翻的结论（v5 → v6）

| 曾是（v5） | 现在是（v6） | 为什么推翻 |
|---|---|---|
| 左栏是生辰表单 + 命盘库（`SIDE_FORM` / `SIDE_LIBRARY`） | 首页星球 + 引导问答；完整表单在 `SHEET` | 入口多、第一次打开要先学会填表 |
| 四档（narrow / compact / mid / wide，908 / 1072 / 1394） | 三档（720 / 1180），公式见 §4.1 | v6 的命盘页一屏放完，左栏和盘面都能缩，不需要 compact |
| 解读在右侧抽屉（`DRAWER`），报告是抽屉里的页签 | 紫微师面板 `ASSISTANT`（宽档并排）；报告是顶栏的「报告」页签（P3） | 报告要整屏阅读；对话要和盘面同屏（ADR-0003） |
| 格局、星曜词典是工具页（`TOOLPAGE`），和盘面不同屏 | 格局卡 `PATTERNS`；星曜解释在宫位卡里点星名看 | 一屏看全，不来回切页 |
| 时间栏 `TIMEBAR` 只有本命 / 大限 / 流年 | 顶栏页签加流月、流日；时间卡 `SCOPE` 跟着切、能前后翻 | 流月、流日是 v6 新增的层级 |
| 窄屏底栏 `BOTTOMBAR` | 取消 | 窄档下用 `PANES` 切卡，紫微师从顶栏打开 |
| 报告 HTML 只读预览 `PREVIEW`（iframe） | 取消；报告页直接排版正文，下载得到独立文件 | 报告页本身就是阅读视图 |
| 内容滚动在 `.zp-scroll` 里 | 面板不滚动，一屏放完（报告正文、对话流在各自区域内滚） | 一屏放完是 v6 的验收标准（spec §3.3） |
