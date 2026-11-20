# 界面契约（ui-contract）· 方法说明与使用

这套文档解决一个问题：**「新功能该放哪」没有答案**，于是每次改动都把东西塞进最近的地方，半年后结构不可恢复。

做法借自 [`yannikzz/ui-contract`](https://github.com/yannikzz/ui-contract)：先用**一条切线**把界面拆成两半，再用**白名单 + 落位表 + 体检脚本**三层约束把漂移挡在提交前。

切线只有一条：**换一套品牌视觉时，这条规则会不会变？**

| 会变 → `design.md` + `tokens.md`（视觉） | 不会变 → `layout.md`（结构） |
|---|---|
| 字号、字重、颜色、间距、圆角、动效、类名 | 区域、页型、档位、栏宽、浮层规则、宿主约定 |

现在这三份文档是 **v6 界面的约定**（spec [2026-11-19_v6-redesign](../specs/2026-11-19_v6-redesign.md) §4.6）。切换到 v6 时它们取代了 v5 版；v5 版和它的棘轮基线只留在 git 历史里，被推翻的结论记在 `layout.md` Appendix B。

---

## 三份文档 + 一个脚本

| 文件 | 管什么 | 硬规则 |
|---|---|---|
| [layout.md](layout.md) | 结构：落位表、14 个 RegionId 白名单、三种页型与外壳、三档阈值公式、宿主约定 | **不写颜色/字号/圆角/间距值**（结构参数除外） |
| [design.md](design.md) | 视觉规则：颜色规则、字号与字重、间距档位、圆角与控件、动效（含豁免表）、类名 / 单位 / 选择器（含例外表） | **不写区域与栏宽** |
| [tokens.md](tokens.md) | 值：面板自带的两套配色 `--zp-*`（浅 / 深成对，含系统色和内容色）、还在用的宿主变量、退役的变量、对比度底线 | 配色表是 audit C1 / C15 的判据 |
| `scripts/audit-ui.mjs` | 体检脚本：报告漂移，**不修** | 无第三方依赖、不联网、不启动 GUI |

**文档与代码冲突时，改代码**（ui-contract 原文的硬规则）。

---

## 体检脚本

```bash
# 体检（无 FAIL → exit 0）；源码是 src/ui/ 用 build.mjs 的 assembleUi 在内存里拼出的全文，样例报「源文件:行号」
node scripts/audit-ui.mjs

# 机器可读（verify/ui-contract.mjs 用，即 verify/all.mjs 第 8 组）
node scripts/audit-ui.mjs --json

# 打印全部样例
node scripts/audit-ui.mjs -v
```

`--profile v6` 仍然接受（等于默认）；`--update-baseline` 被拒绝：基线固定全 0，有违规就改代码或改约定文档。

退出码：`0` 无 FAIL；`1` 有 FAIL；`2` 契约文档缺失（`docs/ui-contract/` 三份不全）或源码拼不起来。

### 检查项

| # | 检查 | 级别 | 说明 |
|---|---|---|---|
| C1 | 字面色 | 硬 | 字面色只在 `tokens.md` §2 登记的 `--zp-*` 定义和阴影里 |
| C2 | 字号 | 硬 | `design.md` §2.1 的 14 个值；`font` 简写、`clamp` 端点、JSX `fontSize` 都算 |
| C3 | 间距 | 硬 | `design.md` §3 的 12 个值 |
| C4 | 字重 | 硬 | `design.md` §2.2 |
| C5 | darwin 窗口 chrome | 硬 | 三个 `--dsh-frame-*` 变量必须存在、带兜底、限定在 darwin 选择器里 |
| C6 | 层叠隔离 | 硬 | `.zp-root` 必须有 `isolation: isolate`；构建产物 `client.js` 里也要有 |
| C7 | 无 `position:fixed` | 硬 | 浮层只许面板内绝对定位 |
| C8 | 弹层语义 | 硬 | `role=dialog` 必须带 `aria-modal`/`aria-label`/焦点陷阱 |
| C9 | iframe 安全 | 硬 | 有 iframe 时必须有 `title` + `sandbox`（v6 面板里没有 iframe） |
| C10 | 表单可访问名称 | 硬 | 每个 input/select/textarea 要有 `aria-label`/`id`/包裹 label |
| C11 | 对话流 aria-live | 硬 | `ASSISTANT` 接线后必须有 `.zp-chat-thread`，带 `role="log"`、`aria-live="polite"` |
| C12 | 结构类 + 区域接线 | 硬 | `layout.md` §2「选择器」列：接了线的区域，登记的类名都在 CSS 里，带 `data-region` 的元素带着第一个类名 |
| C13 | 阈值公式对账 | 硬 | `layout.md` §4.1 参数齐全；`MID`、`WIDE` 等于公式；源码里和 `panelW` 比较的字面量恰好是这两个值 |
| C14 | RegionId 白名单 | 硬 | 源码 `data-region` 值必须在 `layout.md` §2 表内 |
| C15 | 深色成对 + 对比度 | 棘轮（基线 0） | `.zp-root` 和 `.zp-root[data-theme="dark"]` 两块的颜色键集合相等、和 `tokens.md` §2 一致；对比度不低于 `tokens.md` §5 的底线 |
| C16 | 退役的品牌色 | 硬 | `--zp-accent*`、`--zp-fill-accent*` 不定义、不引用 |
| C17 | 动效 | 硬 | 时长 ≤ 300ms、`infinite` 只在 `design.md` §5.2 登记的类上、布局属性不过渡、有 reduced-motion 段 |
| C18 | 单位、选择器、类名 | 硬 | 没有 `vw` / `vh`、按宽高的 `@media`、id 选择器、`env(`；类名以 `zp-` 开头（`design.md` §6 的例外除外） |

### 基线

v6 没有历史欠账：`audit-baseline.json` 全部为 0。C15 是唯一的棘轮项，基线 0，计数一超过就 **FAIL**；其余都是硬规则，出现一处就 **FAIL**。
`verify/ui-contract.mjs` 把 WARN（检查被跳过，或有人上调了基线）也算失败。

---

## 与官方 DSH 插件规范的关系

| 官方规范 | 本契约怎么用 |
|---|---|
| `ui-taste` 技能（字阶/间距/控件/明暗） | design.md 的规范来源之一；与官方值冲突时以「不破坏宿主一致性」为先 |
| `@deepseek-ai/dsh-client-ui-plugin-manager` 入口页 CSS（标题、区块间距、darwin `padding-top`） | design.md §2.1 字号档与 layout.md §5 的参照 |
| `@deepseek-ai/dsh-client-ui-layout` 的 window-chrome seat（`--dsh-frame-top-clearance` 等） | layout.md §5 + audit C5；这是宿主契约，不许绕开 |
| `@deepseek-ai/dsh-client-ui-primitives`（`useModalLayer`、`SegmentedControl`、Button 几何） | layout.md §3 浮层规则、design.md §4 控件几何、audit C8 |

**颜色自己管，其余跟宿主**：2026-11-20 起面板自带深浅两套配色（[ADR-0005](../adr/0005-own-palette-and-theme.md)），不再读宿主的颜色变量；字体族和窗口避让仍然读宿主的变量（tokens.md §1），不抄它们的值。

---

## 更新流程

1. **新增功能落位**：先查 `layout.md §1` 落位表。能落到 RegionId → 直接实现，不改文档。
2. **落不下来**：停下，先改 `layout.md §2` 区域表（职责、选择器、允许放、禁止放），再写代码，绝不反向。
3. **改视觉**：先改 `design.md` 的规则，再改 `tokens.md` 的值，最后改代码。新增字号 / 间距 / 颜色**先入表**。
4. **推翻旧结论**：不删除，记 `layout.md Appendix B`（曾是什么 / 现在是什么 / 为什么）。
5. **交付前**：跑 `node scripts/audit-ui.mjs`（或 `node verify/all.mjs`），按 `design.md §8` 自查。

---

## 当前状态（2026-11-20，切换到 v6）

- `node scripts/audit-ui.mjs`：18 项全部通过，0 警告，0 失败；`verify/all.mjs` 第 8 组跑同一份体检。
- 体检报 `data-region` 接线 13/14：它只认源码里 `'data-region': '…'` 的字面写法，`PANES`（窄档切卡的页签）的标记是 `Seg` 部件按 `region: 'PANES'` 在渲染时加上的，静态扫描看不到。C14 只做「出现即校验」，不要求每个区域都出现。
- **必须 GUI 复核的项**（体检只做静态检查，不替代视觉走查）：深色主题实际观感、darwin 顶栏遮挡、窄 / 中 / 宽三档的真实宽度、首页 3D 星图。v6 还没有在真实 DSH 里打开过。
