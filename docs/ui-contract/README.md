# 界面契约（ui-contract）· 方法说明与使用

这套文档解决一个问题：**「新功能该放哪」没有答案**，于是每次改动都把东西塞进最近的地方，半年后结构不可恢复。

做法借自 [`yannikzz/ui-contract`](https://github.com/yannikzz/ui-contract)：先用**一条切线**把界面拆成两半，再用**白名单 + 决策树 + 体检脚本**三层约束把漂移挡在提交前。

切线只有一条：**换一套品牌视觉时，这条规则会不会变？**

| 会变 → `design.md` + `tokens.md`（视觉） | 不会变 → `layout.md`（结构） |
|---|---|
| 字号、字重、颜色、间距、圆角、动效、状态样式 | 区域树、栏宽、阈值、页型、落位规则、降级顺序 |

---

## 三份文档 + 一个脚本

| 文件 | 管什么 | 硬规则 |
|---|---|---|
| [layout.md](layout.md) | 结构：14 个 RegionId 白名单、落位决策树、外壳骨架、三档阈值公式、4 种页型、降级顺序 | **不写颜色/字号/圆角/间距值**（结构参数除外） |
| [design.md](design.md) | 视觉规则：字阶、字重、间距档位、控件几何、状态阶梯、明暗底线、动效时长、迁移清单 | **不写区域树与栏宽**；引用数值仅用于迁移 |
| [tokens.md](tokens.md) | 值：`--dsw-alias-*` 系统色映射、`--zp-*` 内容色白名单、literal 违规清单、对比度结论 | 白名单表是 audit C1 的唯一判据 |
| `scripts/audit-ui.mjs` | 体检脚本：报告漂移，**不修** | 无第三方依赖、不联网、不启动 GUI |

**文档与代码冲突时，改代码**（ui-contract 原文的硬规则）。本文档集当前与代码的差异集中写在 `layout.md §11 as-built 对照`，不藏在规则里。

---

## 体检脚本

```bash
# 体检（无 FAIL → exit 0）
node scripts/audit-ui.mjs

# 机器可读（verify/ui-contract.mjs 用）
node scripts/audit-ui.mjs --json

# 重算棘轮基线（有改善后手动下调）
node scripts/audit-ui.mjs --update-baseline

# 历史欠账清零后，把 WARN 也当失败（CI 可切）
node scripts/audit-ui.mjs --strict
```

退出码：`0` 无 FAIL；`1` 有 FAIL；`2` 契约文档缺失（`docs/ui-contract/` 三份不全）。

### 检查项

| # | 检查 | 级别 | 说明 |
|---|---|---|---|
| C1 | 字面色白名单 | 棘轮 | CSS 内白名单外 `#hex`/`rgb()` ≤ 基线（当前 13） |
| C2 | 字阶白名单 | 棘轮 | `font-size` 落在目标 8 值外 ≤ 基线（当前 42） |
| C3 | 间距 4/8 网格 | 棘轮 | `padding/margin/gap` 表外值 ≤ 基线（当前 103） |
| C4 | 字重白名单 | 棘轮 | 字重落在 5 档外 ≤ 基线（当前 16） |
| C5 | darwin 窗口 chrome | 硬 | 三个 `--dsh-frame-*` 变量必须存在且带兜底 |
| C6 | 层叠隔离 | 硬 | `.zp-root` 必须有 `isolation: isolate` |
| C7 | 无 `position:fixed` | 硬 | 浮层只许面板内绝对定位 |
| C8 | 弹层语义 | 硬 | `role=dialog` 必须带 `aria-modal`/`aria-label`/焦点陷阱 |
| C9 | iframe 安全 | 硬 | 必须有 `title` + `sandbox` |
| C10 | 表单可访问名称 | 硬 | 每个 input/select/textarea 要有 `aria-label`/`id`/包裹 label |
| C11 | 对话流 aria-live | 硬 | 对话容器必须有 `role="log" aria-live` |
| C12 | 结构类 + 构建产物 | 硬 | 关键 class 在 CSS 与 `client.js` 都存在（防「源码改了没构建」） |
| C13 | 阈值公式对账 | 硬 | `1072/1394` 字面量必须等于 layout.md 参数公式；参数表与 CSS 实现一致 |
| C14 | RegionId 白名单 | 硬 | 源码 `data-region` 值必须在 layout.md §2 表内 |
| C15 | 深色成对 + 对比度 | 棘轮 | 浅/深 `--zp-*` 键集合相等；对比度不达标组数 ≤ 基线（当前 1） |
| C16 | 私有品牌色退役 | 棘轮 | `var(--zp-accent*)` 引用数 ≤ 基线（当前 49），只减不增 |

### 棘轮（ratchet）怎么工作

历史欠账不是「先全部修完才能上检查」——那样永远上不了。脚本内置当前计数作基线（`docs/ui-contract/audit-baseline.json`，缺失时用脚本内置默认值）：

- 违规数 **> 基线** → **FAIL**（新增漂移）
- 违规数 **= 基线** → **WARN**（历史欠账，锁住）
- 违规数 **< 基线** → **WARN** + 提示可下调
- 违规数 **= 0** → **PASS**

无 FAIL 时退出码 0。等某项降到 0，把该检查改成硬规则（或加 `--strict`）。

---

## 与官方 DSH 插件规范的关系

| 官方规范 | 本契约怎么用 |
|---|---|
| `ui-taste` 技能（字阶/间距/控件/明暗） | design.md 的规范来源之一；与官方值冲突时以「不破坏宿主一致性」为先 |
| `@deepseek-ai/dsh-client-ui-plugin-manager` 入口页 CSS（标题 20/500/28、区块间距 32、darwin `padding-top`） | layout.md §3.3 的参数与 design.md §2.1 的 display 档参照 |
| `@deepseek-ai/dsh-client-ui-layout` 的 window-chrome seat（`--dsh-frame-top-clearance` 等） | layout.md §3.2 事实 4/5 + audit C5；这是宿主契约，不许绕开 |
| `@deepseek-ai/dsh-client-ui-primitives`（`useModalLayer`、`SegmentedControl`、Button 几何） | layout.md §4.3 浮层规则、design.md §4 控件几何、audit C8 |

**不复制官方样式值**：官方 token 的**值**由宿主主题持有，本仓库只消费**名字**（tokens.md §1/§2）。抄值会在主题切换时错。

---

## 更新流程

1. **新增功能落位**：先走 `layout.md §1` 决策树。能落到 RegionId → 直接实现，不改文档。
2. **落不下来**：走 `layout.md §9` 区域申请（五个必答问题），通过后按 **白名单 → 类型 → DOM → 实现** 顺序改，绝不反向。
3. **改视觉**：先改 `design.md` 的规则与迁移清单，再改 `tokens.md` 的值，最后改代码。新增字号/颜色**先入表**。
4. **修完欠账**：跑 `node scripts/audit-ui.mjs`，低于基线时 `--update-baseline` 下调，并在 design.md §11 划掉对应行。
5. **推翻旧结论**：不删除，记 `layout.md Appendix B`（曾是什么 / 现在是什么 / 为什么）。
6. **CI 接线**：`verify/all.mjs` 里加 `verify/ui-contract.mjs`（由仓库维护者接，本目录不自动改 `verify/all.mjs`）。

---

## 当前状态（2026-11-07）

- 契约已落：三份文档 + 体检脚本可跑，`node scripts/audit-ui.mjs` 与 `node verify/ui-contract.mjs` 均 exit 0。
- **未接线（需改 src，不在本轮范围）**：`data-region` 标记 0 处、`RegionId` 联合类型未建（layout.md §11 A1/A2）。因此 C14 目前只做「出现即校验」，不会要求必须出现。
- **历史欠账（基线内，见 design.md §11）**：字阶 42、间距 103、字重 16、literal 色 13、私牌色 49、深色对比度 1 组。
- **必须 GUI 复核的项**（本机无浏览器控制，未实测）：深色主题实际观感、darwin 顶栏遮挡、窄面板真实宽度、报告 iframe 版式。审计脚本只做静态检查，**不替代视觉走查**。

## 基线更新记录

- 2026-11-08（v3 布局）：新增 TimeBar / 左栏开关 / 窄屏底栏 / 工具视图等结构，`data-region` 13/13 接线；
  C16 私有 accent 引用 49→60、C2 字阶违规 42→41，其余项不变。基线 224→234 为**一次有理由的上调**
  （新增控件复用 `--zp-accent`，品牌 token 迁移仍待 v3.1）；之后只许下降。
- 2026-11-08（v3.1）：白字填充改用新增 `--zp-fill-accent*`，C15 深色对比度 1→0、C16 私有 accent 引用
  60→53；基线 234→226（下调）。
