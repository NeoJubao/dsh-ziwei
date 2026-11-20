# 界面约定 v6 · 视觉（design.md）

> **状态**：现行界面（v6）的约定（spec [2026-11-19_v6-redesign](../specs/2026-11-19_v6-redesign.md) §4.6）；切换到 v6 时取代了 v5 版。
> **新增字号、间距、颜色先进本文和体检脚本，再进代码。** 文档和代码冲突时改代码。

- 适用对象：`src/ui/css/*.css`（拼进面板 CSS）和 `src/ui/*.js` 里的内联样式
- 本文管**规则**：字号、字重、间距、圆角、控件几何、动效、类名；颜色的值在 [tokens.md](tokens.md)，结构在 [layout.md](layout.md)
- v6 的体检里 C1–C4、C16–C18 都是硬规则：出现一处就失败，没有基线可以锁（基线文件全是 0，见 §9）
- 体检脚本读本文的两张表：§5.2 动效豁免（表头含 `动效豁免类`）、§6 类名例外（表头含 `类名例外`）

---

## §1 颜色（规则）

| 组 | 用什么 | 说明 |
|---|---|---|
| 底 | `--zp-bg`（面板的底）/ `--zp-surface`（卡片、宫格、浮层）/ `--zp-raised`（卡片里再抬一层） | 层级靠底色差，不靠阴影 |
| 描边 | `--zp-line` / `--zp-line-2` | 一档宽度 1px |
| 文字 | `--zp-ink` / `--zp-ink-2` / `--zp-ink-3` / `--zp-ink-4` | 四级封顶 |
| 主按钮 | `--zp-primary` + `--zp-on-primary` | 一屏一个 |
| 悬停、淡底色 | `--zp-hover` | 一层叠色，落在哪层底上都看得出 |
| 遮罩 | `--zp-mask` | 浮层后面那一层 |
| 内容色（紫微、金、四化、十四主星） | `--zp-zi`、`--zp-gold*`、`--zp-mu-*`、`--zp-s0…13` | 值和用途见 tokens.md |

- 面板自带深浅两套配色（[ADR-0005](../adr/0005-own-palette-and-theme.md)）：根节点 `data-theme="dark" | "light"`，默认深色，设置里可以切到浅色或跟随 DSH。样式表里不读宿主的颜色变量，也不用 `body[data-ds-dark-theme]` 选择器；换外观只换 `--zp-*` 的值，组件的规则不分深浅。

- 面板 CSS 里的字面色（`#hex`、`rgb()`、`hsl()`、`white`、`black`）只允许出现在已登记的 `--zp-*` 定义和阴影（`box-shadow`、`text-shadow`）里。
- 星名、四化用 `var(--zp-…)` 引用，不在 JS 里写颜色值；换主题不需要重新渲染。
- 首页的毛玻璃底和文字光晕用 `color-mix()` 从 `--zp-bg` 派生。
- 颜色不是唯一的信息载体：四化有字（禄权科忌），格局吉凶有字。
- 焦点框的颜色和粗细由宿主的 `:focus-visible` 给，面板只补 `outline-style` 和 `outline-offset`。

---

## §2 字号与字重

### 2.1 字号（px）

| 档 | 值 | 用途 |
|---|---|---|
| display | 20–28（`clamp`，端点 20 和 28） | 首页状态句 |
| title | 24 | 报告页标题、报告分部标题、空态标题 |
| page | 20 | 弹层标题 |
| serif-lg | 18 | 宫位卡宫名、报告小标题 |
| reading | 15 | 报告正文 |
| body-lg | 14 | 时间卡要点、对话正文、输入框、卡片标题 |
| body | 13 | 按钮、页签、列表项 |
| label | 12 | 元信息、chip |
| caption | 11 | 免责声明、角标 |
| 盘面子阶 | `clamp` 端点取 9.5 / 10.5 / 11.5 / 12 / 13.5 / 16；中宫称呼端点 16 / 24 | 仅 `BOARD` 内 |

**允许出现的 px 值**：9.5、10.5、11、11.5、12、13、13.5、14、15、16、18、20、24、28。`clamp()` 的端点也必须是这些值。

- `font-size`、`font` 简写、JSX 的 `fontSize` 都算；`font` 简写里斜杠前面的 px 值是字号。
- 衬线字体（宋体栈 `--zp-font-serif`）只用于：状态句、宫名、星名、四柱、报告标题；其余用宿主的正文字体。

### 2.2 字重

- 只用 400、500、600。
- 650、700 保留给盘面主星：只能出现在选择器含 `.zp-board` 的规则里，JSX 里不写。
- `bold` 按 700 算，`normal` 按 400 算；`bolder` / `lighter` 不用。

---

## §3 间距

只用 **0、2、4、6、8、12、16、20、24、32、40、48**（负值按绝对值算）。盘面宫格内部用 `clamp()` 时端点也取这些值。

- 检查的属性：`padding*`、`margin*`（含 `-inline` / `-block` 逻辑属性）、`gap`、`row-gap`、`column-gap`。
- 宿主变量的兜底值不算面板间距：`var(--dsh-frame-*, Npx)` 里的 `Npx` 是宿主约定（例如 `--dsh-frame-overlay-top` 的兜底 46px，见 layout.md §5），不受本表约束。
- v5 的 88px 豁免不再有。

---

## §4 圆角与控件

- 圆角只用 4、8、12、16、999：卡片 12，按钮和输入 8，宫格 8，chip 和首页输入条 999。
- 按钮高 32（常规）/ 28（小）；图标按钮 32 × 32；首页输入条高 48；禁用态 0.55 透明度。
- 卡片：`bg-layer-1` 底 + 一层描边，不加阴影。浮层才有阴影。

（圆角和控件几何暂不进体检，靠评审。）

---

## §5 动效

### 5.1 时长

| 场景 | 时长 | 曲线 |
|---|---|---|
| hover、颜色变化 | 120ms | ease |
| 弹层出现 | 160ms | cubic-bezier(.22,.61,.36,1) |
| 面板滑入（`ASSISTANT`、`SHEET`） | 180ms | 同上 |
| 视图淡入、入场 | 240ms | ease |
| 三方四正连线描画 | 300ms | ease |

- 界面过渡和动画（含延迟）都不超过 300ms。
- 布局属性不做过渡：`transition` 里不出现 `all`、宽高、`top` / `right` / `bottom` / `left` / `inset`、`margin*`、`padding*`、`grid-template-*`、`flex-basis`。
- 除加载指示（脉冲点）外不用无限循环动画。
- `prefers-reduced-motion: reduce` 时全部关闭（面板 CSS 里有一段 `@media (prefers-reduced-motion: reduce)`），3D 只画静止的一帧。

### 5.2 豁免（机器可读）

`HOME_SKY` 区域内的内容（3D 画布里的一切、星球标签跟随、准星旋转），以及进出命盘时画布里的飞入、飞出、新星诞生（1.3–2.1 秒）不受 300ms 限制；这段时间里界面元素只做 240ms 的淡入淡出。CSS 里只有下表登记的类名可以用 `infinite` 或超过 300ms：规则的选择器里含这个类名才算。

| 动效豁免类 | 允许 | 为什么 |
|---|---|---|
| `zp-pulse` | `infinite`、`>300ms` | 加载指示（脉冲点）：报告页签上的进行中小点、报告状态栏。脉冲的周期（1.2 秒）不是界面过渡 |
| `zp-reticle` | `infinite`、`>300ms` | `HOME_SKY` 的准星旋转 |
| `zp-sky` | `>300ms` | `HOME_SKY` 的画布淡入淡出 |

---

## §6 类名、单位、选择器

- 每个类名以 `zp-` 开头（CSS 选择器里的类名和 JSX `className` 里的每个词都算）。状态也用带前缀的类名或属性（`zp-on`、`aria-pressed`、`data-*`），不用裸的 `on`。
- 不用 `vw` / `vh`（含 `dvh` 等变体和 `vmin` / `vmax`）：按面板尺寸或容器查询单位来。
- 不用按宽高的 `@media`（`width`、`height`、`aspect-ratio`、`orientation`）：档位看 `.zp-root[data-w]`。`@container` 和 `prefers-*` 可以用。
- 不用 id 选择器；不用 `env(`（macOS 标题带用三个 `--dsh-frame-*`，见 layout.md §5）。
- 不用 `position: fixed`。

| 类名例外 | 范围 | 为什么 |
|---|---|---|
| `zr-*` | 前缀 | 报告正文的版式类（面板报告页和导出文件共用 `css/85-prose.css`） |
| `md-table` | 单个类名 | markdown 管道表格（`mdToHtml` 输出，v5 起沿用，自检按它断言） |

---

## §7 原型到插件的换算

照 spec §4.7：类名加 `zp-` 前缀；原型的颜色变量换成 tokens.md §1 那张对应表里的 `--zp-*`；`@media (max-width: 720px)` → `.zp-root[data-w="narrow"]`，`@media (max-width: 1180px)` → `.zp-root:not([data-w="wide"])`；字号、间距、圆角、时长就近取本文的档位（12.5 → 12，15 → 14，17 → 18，22 / 23 → 24；10 / 14 的间距 → 8 或 12 / 12 或 16；350–500ms → 180 或 240ms）；`#app { position: fixed }` → `.zp-root { position: relative; height: 100% }`。

---

## §8 交付前自查

- [ ] `node scripts/audit-ui.mjs --profile v6` 没有 FAIL
- [ ] 新字号、新颜色先进了本文 / tokens.md
- [ ] 浅色和深色都看过；窄、中、宽三档都看过（没看就写「未做视觉复核」）

---

## §9 和体检脚本的对应（`--profile v6`）

| 检查 | 级别 | 判定 |
|---|---|---|
| C1 字面色 | 硬 | §1：字面色只在已登记的 `--zp-*` 定义和阴影里 |
| C2 字号 | 硬 | §2.1 的 14 个值；`font` 简写、`clamp` 端点、JSX `fontSize` 都算 |
| C3 间距 | 硬 | §3 的 12 个值 |
| C4 字重 | 硬 | §2.2 |
| C5–C10 | 硬 | 宿主约定和可访问性，和 v5 相同 |
| C11–C14 | 硬 | 见 layout.md §6 |
| C15 深色成对 + 对比度 | 棘轮（基线 0） | 见 tokens.md §5 |
| C16 退役的品牌色 | 硬 | `--zp-accent*`、`--zp-fill-accent*` 不定义、不引用 |
| C17 动效 | 硬 | §5：时长 ≤ 300ms、`infinite` 只在 §5.2 登记的类上、布局属性不过渡、有 reduced-motion 段 |
| C18 单位、选择器、类名 | 硬 | §6 |
