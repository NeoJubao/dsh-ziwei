# 界面约定 v6 · token（tokens.md）

> **状态**：现行界面（v6）的约定（spec [2026-11-19_v6-redesign](../specs/2026-11-19_v6-redesign.md) §4.6）；切换到 v6 时取代了 v5 版。
> **分工**：layout.md 管「放哪里」，design.md 管「什么规则」，本文管「用哪个名字、值是多少」。
> 系统色的值由宿主主题提供，本仓库不拥有、不复制、不覆盖，本文只登记名字。

- 适用对象：`src/ui/css/00-tokens.css`（`--zp-*` 的定义都在这里）
- 体检脚本读本文的两张表：§2 内容色（表头含 `变量`、`浅色`、`深色`）——C1 的白名单和 C15 的成对、取值、对比度都从它来；§4 字面色白名单（表头含 `白名单值`）。改表即改检查。

---

## §1 系统色（宿主 token，只消费）

| 用途 | token |
|---|---|
| 底 | `--dsw-alias-bg-base`、`--dsw-alias-bg-layer-1`、`--dsw-alias-bg-layer-2`、`--dsw-alias-bg-layer-3` |
| 描边 | `--dsw-alias-border-l1`、`--dsw-alias-border-l2` |
| 文字 | `--dsw-alias-label-primary`、`--dsw-alias-label-secondary`、`--dsw-alias-label-tertiary`、`--dsw-alias-label-caption` |
| 主按钮 | `--dsw-alias-button-primary-fill` + `--dsw-alias-label-primary-inverted` |
| 悬停 | `--dsw-alias-interactive-bg-hover` |
| 遮罩 | `--dsw-alias-bg-mask-1` |

原型的颜色变量按这张表换：`--bg` → `bg-base`，`--l1/2/3` → `bg-layer-1/2/3`，`--border` → `border-l1`，`--border-soft` → `border-l2`，`--text` / `-2` / `-3` / `-4` → `label-primary` / `-secondary` / `-tertiary` / `-caption`，`--btn` → `button-primary-fill`，`--btn-text` → `label-primary-inverted`，`--hover` → `interactive-bg-hover`。

---

## §2 内容色（`--zp-*`，浅 / 深成对）

浅色写在 `.zp-root`，深色写在 `body[data-ds-dark-theme] .zp-root`，两边的键集合完全相同。

| 变量 | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--zp-zi` | `#6b55d4` | `#b9a7fa` | 紫微色：选中宫的描边和底、命宫标记。只在盘面内容里用 |
| `--zp-gold` | `#a07a2c` | `#dcb96f` | 金：连线、时间层级的标记、编号、徽记 |
| `--zp-gold-text` | `#8a6a1f` | `#dcb96f` | 金色小字（浅色底上对比度约 5:1） |
| `--zp-mu-lu` | `#15803d` | `#4ade80` | 化禄、吉 |
| `--zp-mu-quan` | `#1d4ed8` | `#7aa2ff` | 化权 |
| `--zp-mu-ke` | `#a16207` | `#e3b341` | 化科、中 |
| `--zp-mu-ji` | `#b91c1c` | `#f87171` | 化忌、凶 |
| `--zp-s0` | `#8a5cc4` | `#c7aaf5` | 紫微 |
| `--zp-s1` | `#2f84b8` | `#86c3e8` | 天机 |
| `--zp-s2` | `#c96a24` | `#f3ab70` | 太阳 |
| `--zp-s3` | `#a07b1c` | `#e2c06e` | 武曲 |
| `--zp-s4` | `#c04d78` | `#ef97b5` | 天同 |
| `--zp-s5` | `#b5402f` | `#ec8a7b` | 廉贞 |
| `--zp-s6` | `#93633a` | `#d6a982` | 天府 |
| `--zp-s7` | `#5b6cc0` | `#aab6f2` | 太阴 |
| `--zp-s8` | `#2f9363` | `#86d6a9` | 贪狼 |
| `--zp-s9` | `#6d808a` | `#b4c3cb` | 巨门 |
| `--zp-s10` | `#21917d` | `#7bd6c3` | 天相 |
| `--zp-s11` | `#7d6c56` | `#c9b9a2` | 天梁 |
| `--zp-s12` | `#a3354a` | `#e48190` | 七杀 |
| `--zp-s13` | `#4560a6` | `#93aaea` | 破军 |
| `--zp-orb-hi` | `#ffffff` | `#ffffff` | 小星球（盘名旁、中宫）的高光。两套主题同值 |
| `--zp-orb-lo` | `#0b0b14` | `#0b0b14` | 小星球的暗面。两套主题同值 |

- 十四主星按「紫微、天机、太阳、武曲、天同、廉贞、天府、太阴、贪狼、巨门、天相、天梁、七杀、破军」的顺序编号 `s0`–`s13`。
- 四化的配色沿用 v5：禄绿、权蓝、科金、忌红（原型里权和科的颜色对调了，不照搬）。
- 新增内容色要同时：在本表加一行（浅、深两个值）、在 `00-tokens.css` 两个块里都定义、在 §5 判断要不要进对比度组。

### 非颜色变量

| 变量 | 值 | 用途 |
|---|---|---|
| `--zp-font-serif` | `"Songti SC", "STSong", "SimSun", "Noto Serif SC", serif` | 宋体栈：状态句、宫名、星名、四柱、报告标题 |
| `--zp-c` | 没有默认值，由 JS 内联成 `var(--zp-sN)` | 星曜色的管道：星名、小星球、星球标签用它取色，换主题不用重新渲染 |

---

## §3 退役（v6 不再定义、不再引用）

| 变量 | 去向 |
|---|---|
| `--zp-accent`、`--zp-accent-deep` | 选中、高亮用 `--zp-zi`（只在盘面内）；按钮用宿主主按钮 token（体检 C16） |
| `--zp-fill-accent`、`--zp-fill-accent-deep` | 同上（体检 C16） |
| `--zp-gold-dim` | `--zp-gold-text` |
| `--zp-good`、`--zp-bad` | `--zp-mu-lu`、`--zp-mu-ji` |
| `--zp-star-color`（JSX 内联注入星曜色） | `var(--zp-s0)` … `var(--zp-s13)` |
| `--zp-board-max` | 盘面按宽高比在可用区域内伸缩（layout.md §4） |

---

## §4 字面色白名单（机器可读）

v6 不设白名单：面板 CSS 里的字面色只允许出现在 §2 登记的 `--zp-*` 定义和阴影（`box-shadow`、`text-shadow`）里。下表留空是有意的。

| 白名单值 | 所属 | 说明 |
|---|---|---|
| — | — | v6 无 |

不在体检范围、也不走面板 token 的颜色：

- **3D 场景**（`src/sky.js`）和**导出文件**（`30-report.js` 里的独立文档样式）：插画和独立文档，不计入字面色检查。
- **侧栏入口图标**（`90-app.js` 的 `PanelIcon`）：在宿主侧栏里渲染、在 `.zp-root` 之外，用不到 `--zp-*`；沿用 v5 的两个字面色 `#8b5cf6`、`#fff`，写在 JSX 里。

---

## §5 深色与对比度

宿主底色（2026-11 从宿主主题实测，`--dsw-static-neutral-bluish-*`）。体检脚本内置同一组值：

| 主题 | `bg-base` | `bg-layer-1` |
|---|---|---|
| 浅色 | `#ffffff` | `#ffffff` |
| 深色 | `#151517` | `#232324` |

对比度组（每个前景分别对上表同一主题的两种底色计算，取较低值）：

| 前景 | 底线 | 理由 | 浅色实测（最低） | 深色实测（最低） |
|---|---|---|---|---|
| `--zp-gold-text` | 4.5:1 | 金色小字 | 5.05 | 8.38 |
| `--zp-mu-lu` / `-quan` / `-ke` / `-ji` | 4.5:1 | 四化是字（禄权科忌） | 4.92（科） | 5.68（忌） |
| `--zp-zi` | 3:1 | 描边、标记（图形） | 5.42 | 7.46 |
| `--zp-gold` | 3:1 | 连线、标记、徽记（图形） | 3.95 | 8.38 |
| `--zp-s0` … `--zp-s13` | 3:1 | 星名是加粗的衬线字，按大字计 | 3.77（太阳） | 5.86（七杀） |

低于底线的组数就是 C15 的计数，基线 0。系统色 token 的值以宿主主题为准，宿主改了主题要回来更新上表。

---

## §6 和体检脚本的对应（`--profile v6`）

| 检查 | 读本文哪里 | 判定 |
|---|---|---|
| C1 字面色 | §2 表、§4 表 | 字面色只在 §2 登记的变量定义和阴影里 |
| C15 深色成对 + 对比度 | §2 表、§5 | CSS 里浅 / 深两块的内容色键集合相等、和 §2 表一致、取值一致；对比度不低于底线 |
| C16 退役的品牌色 | §3 | `--zp-accent*`、`--zp-fill-accent*` 出现即失败 |
