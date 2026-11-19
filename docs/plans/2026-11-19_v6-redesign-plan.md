# 实现计划：v6 界面重做

- Spec：[docs/specs/2026-11-19_v6-redesign.md](../specs/2026-11-19_v6-redesign.md)
- 分支：`feature/v6-redesign`（从 `feat/v5-ux-polish` 拉出）
- 执行方式：子 agent 逐个任务执行。主会话负责文档、3D 场景、复核和提交；其余任务各派一个实现 agent。
- 设计参考：`docs/design/v6-prototype/`（下文的"原型"都指这里的文件，行号以这里为准）
- 进度（2026-11-20）：T0、T1、T2、T3a、T3c、T4 已完成并提交；全部视图的样式表已由主会话按界面约定换算好（`src/ui/css/`，每个文件开头写明了它期待的结构），后面的视图任务只写组件、文案和检查。`client.js` 仍是 v5。

## 全局约束

从 spec 和仓库规则原样抄来，每个任务都适用：

1. 不改 `index.js`、`src/engine-core.js`、`src/ziwei-core.js`、`cordis.patch.yml`、`package.json` 的 `name` / `private` / `files`。
2. 不手改 `client.js`、`engine-built.js`、`vendor/three-r128.min.js`。
3. **切换之前 `client.js` 不变**：`node build.mjs` 之后 `git diff --exit-code -- client.js engine-built.js` 必须为空。这个目录直接挂在 Neo 的 DSH 里，改了 `client.js` 刷新就生效。
4. `build.mjs` 不接受任何命令行参数。
5. 不改已有 localStorage 键的含义和记录结构；新增的键只有 `ziwei-pro.sky` 和 `ziwei-pro.v6`。
6. v6 的界面代码只用这几个 React API：`createElement`、`Component`、`useState`、`useEffect`、`useLayoutEffect`、`useMemo`、`useRef`。渲染函数和 `apply()` 里不碰 DOM、WebGL、定时器；读写 localStorage 一律包 try/catch。
7. `client.js`（以及 v6 的拼接结果）里不出现 `setInterval(`、`position: fixed`、`api.deepseek.com`。
8. 代码、fixture、截图里只用黄金用例：1992-05-03 09:30，男，经度 105.97。文档和提交里不写本机绝对路径。
9. 不 push、不 rebase、不 amend、不 reset --hard；不改 `~/.dsh/`；不重启 DSH。
10. **实现 agent 不提交。** 写完文件、跑完检查就汇报；主会话复核后提交（Conventional Commits，一个提交一件事）。
11. 每个任务结束前贴出 `node build.mjs && node verify/all.mjs` 的结果，以及本任务自己的检查文件"先失败、后通过"的证据。看过预览壳就写看了哪些状态，没看就写"未做视觉复核"。

## 做法

- **v6 和 v5 并排，最后一次切换。** v6 的源码全部在新文件里（`src/ui/`、`src/sky.js`、`vendor/`）。`build.mjs` 重构成可导出的拼接函数，但在切换之前仍然只从 `src/ui-pro.js` 出 v5 的 `client.js`，逐字节不变。
- **v6 的检查是 `verify/all.mjs` 的第 9 组。** `verify/ui-v6.mjs` 在内存里拼出 v6 的 bundle，在 vm 里求值，并依次运行 `verify/ui-v6-*.mjs`（按文件名自动发现，各任务各加各的，不改同一个文件）。公共的装载和假 React 在 `verify/client-harness.mjs`。
- **界面约定先行。** T1 把 spec §4.6 写成 `docs/ui-contract/v6/` 下三份文档，体检脚本加 `--profile v6`（基线全 0）。之后的每个视图任务都要过 v6 的体检。
- **预览。** `node verify/ui-v6.mjs --write-preview` 把 v6 的 bundle 写到 `audit/preview-shell/client.v6.js`（`audit/` 不进仓库）。预览壳用宿主真实的 CSS 变量 + React 18.3.1 渲染面板，`/ziwei/interpret` 用模拟流，另有"反复挂载卸载"和"强制没有 WebGL"两个开关。
- **并行。** 文件互不重叠的任务可以同时做，各用自己的工作树；合回分支时用 `git merge --squash`。会碰同一个文件的任务按顺序做。
- **样式先于组件。** 样式表由主会话从原型换算（类名加前缀、颜色接宿主变量、字号 / 间距 / 圆角 / 时长收到档位、视口断点换成面板宽度分档），视图任务按样式表开头注释里的结构写组件，不重新设计；确实缺规则时做最小改动并在汇报里列出。

## 文件清单

| 文件 | 新建或修改 | 负责什么 |
|---|---|---|
| `build.mjs` | 修改 | 导出 `assembleUiV5` / `assembleUi` / `assembleSky` / `assembleClient`；直接运行时出 v5 产物（切换后出 v6） |
| `src/ui/*.js`、`src/ui/css/*.css`、`src/ui/i18n/*.json` | 新建 | v6 界面，分工见 spec §4.1 |
| `src/sky.js` | 新建 | 3D 场景 |
| `vendor/three-r128.min.js` | 新建 | Three.js r128，和 cdnjs 逐字节一致 |
| `verify/client-harness.mjs` | 新建 | 在 vm 里装载 bundle、假 React、浅渲染和深渲染、内存版 storage、假 fetch |
| `verify/ui-v6.mjs`、`verify/ui-v6-*.mjs` | 新建 | v6 的检查 |
| `verify/fixtures/horoscope-reference.json`、`verify/fixtures/storage-v5.json` | 新建 | 运限参考表；v5 形状的本机记录 |
| `verify/all.mjs` | 修改 | 加第 9 组 |
| `scripts/audit-ui.mjs` | 修改 | `--profile v6` |
| `docs/ui-contract/v6/{layout,design,tokens}.md`、`audit-baseline.json` | 新建 | v6 的界面约定和零基线 |
| `THIRD_PARTY_NOTICES.md` | 修改 | 登记 Three.js（T0 已做） |
| `verify/verify.mjs`、`docs/ui-contract/*`、`README.md`、`CHANGELOG.md`、`docs/ARCHITECTURE.md`、`CONTRIBUTING.md`、`REVIEW.md`、`locale/*.json`、`package.json`（只改 `version`） | 修改 | 只在切换（T10）时动 |
| `src/ui-pro.js` | 删除 | 只在切换之后删 |

## 任务

### T0：文档与设计稿入库（主会话）

- [x] 原型源码存进 `docs/design/v6-prototype/`
- [x] spec、本计划、ADR-0003、ADR-0004
- [x] `THIRD_PARTY_NOTICES.md` 登记 Three.js r128（排在入库之前）
- [x] `CLAUDE.md` 禁区措辞（Neo 的文件，只改一句，不代为提交）

### T1：构建与自检地基 + 行走骨架

目标：v6 能在内存里拼出来、在 vm 里求值、过宿主约定检查；预览壳里看到一个只有顶栏的空壳。v5 的产物逐字节不变。

文件：`build.mjs`、`src/ui/` 的全部文件（多数是占位）、`verify/client-harness.mjs`、`verify/ui-v6.mjs`、`verify/ui-v6-shell.mjs`、`verify/all.mjs`、`scripts/audit-ui.mjs`、`docs/ui-contract/v6/*`。

- [x] `build.mjs` 重构：把 `KERNEL_HEAD` / `KERNEL_TAIL` 和拼接逻辑提成导出函数，文件被直接运行时才执行构建。`assembleUiV5(root, { version })` 读 `src/ui-pro.js` 并替换版本占位符。证明：`node build.mjs && git diff --exit-code -- client.js engine-built.js`。
- [x] `assembleUi(root, { version })` 返回 `{ text, map }`：按文件名顺序拼 `src/ui/NN-*.js`；把 `css/NN-*.css` 拼起来注入 `40-styles.js` 的 `` `/*__ZIWEI_CSS__*/` ``，把 `css/85-prose.css` 另外注入 `30-report.js` 的 `` `/*__ZIWEI_CSS:prose__*/` ``；把 `i18n/NN-*.json` 合成 `{ 'zh-CN': {...}, 'en-US': {...} }` 注入 `10-i18n.js`。注入用函数替换或 split/join，不用带 `$` 语义的字符串替换。遇到 `\r`、缺结尾换行、i18n 键重复、CSS 含反引号 / `${` / 反斜杠、版本占位符不是恰好一次，直接抛错。`map` 记录每个文件在 `text` 里的起止位置，供体检脚本报行号。
- [x] `assembleSky(root)`：`vendor/three-r128.min.js` 和 `src/sky.js` 都在时返回 `__ziweiBootstrapSky` 的完整函数文本（形状见下），并核对 Three.js 的 SHA-384；任一文件不在时返回空串（T2 完成之前就是空串）。
- [x] `assembleClient({ engine, zcore, sky, ui })` = `KERNEL_HEAD + engine + '\n' + zcore + KERNEL_TAIL + sky + ui`。
- [x] v6 bundle 的形状：

  ```
  function __ziweiBootstrapSky() {
    if (__ziweiBootstrapSky.api) return __ziweiBootstrapSky.api;
    var module = { exports: {} }, exports = module.exports;
  <vendor/three-r128.min.js>
  ;var THREE = module.exports;
  <src/sky.js>
    return (__ziweiBootstrapSky.api = { acquire, release, destroy, create });   // 见 spec §4.5
  }
  window.__ModuleLoader__.load({
    id: '@local/ziwei-workbench',
    factory(require) {
      if (typeof __ziweiBootstrapKernel === 'function') __ziweiBootstrapKernel();
  /* ---- src/ui/00-head.js ---- */ … /* ---- src/ui/90-app.js ---- */
      return __ziweiPlugin;
    }
  });
  ```

- [x] `verify/client-harness.mjs`：`loadBundle(text)`（和 `verify/verify.mjs` 第 512–560 行同一套假环境）、`renderShallow`、`renderDeep`（递归调用函数组件；`useState(init)` 返回初值，effect 不执行）、`find` / `text` / `diffTrees`、`memoryStorage()`、`fakeFetch(script)`。
- [x] `verify/ui-v6.mjs`：拼出 v6 → 跑 `verify/ui-v6-*.mjs` → 汇总；`--write-preview` 只写 `audit/preview-shell/client.v6.js`。输出风格和其他自检一致（`== 标题 ==`、✅ / ❌、`N 通过, M 失败`，退出码 0 / 1）。
- [x] `verify/ui-v6-shell.mjs`（先写、先看它失败）：
  - 每个 `src/ui/*.js` 单独能过语法检查；拼起来没有重名的顶层声明；整个 bundle 能在裸 vm 里求值。
  - 只注册一个 id 为 `@local/ziwei-workbench` 的入口；求值之后、`factory()` 之前没有 `ZWEngine`、`ZWCore`、`THREE`。
  - `factory()` 返回带 `inject`（含 `slots`、`uiWorkspace`）和 `apply` 的对象；`apply()` 注册 `sidebar.panellist` 和 key 为 `ziwei` 的 `main`。
  - layout 服务可用时，`ProApp` 自己的渲染里恰好有一个类名含 `zp-exit` 的按钮（`type=button`，`title` 和 `aria-label` 都是"返回会话"），点击调用 `layout.selectPanel(null)`；不可用时没有这个按钮，面板仍能渲染。
  - 宿主约定的 CSS 在位：三条 darwin 规则（选择器和声明与现在 `verify/verify.mjs` 第 499–504 行断言的一致）、`.zp-root` 的 `isolation: isolate`、`:where(.zp-root) button { color: inherit }`、`data-dsh-automatic-focus` 的规则。
  - 不出现 `setInterval(`、`position: fixed`、`api.deepseek.com`、`__ZIWEI_VERSION__`；`id: '@local/ziwei-workbench'` 恰好一次。
  - 中英文字典键集合相等；中文值里没有 ✓ ⚠ 画布 鲲鹏 智能解读；每个键在字典之后的源码里被引用过。
  - `tierOf(w)`：0 → narrow，719 → narrow，720 → mid，1179 → mid，1180 → wide。
- [x] `docs/ui-contract/v6/`：按 spec §4.6 写三份文档，表格格式沿用旧版（体检脚本靠表头找表）。`audit-baseline.json` 全 0。
- [x] `scripts/audit-ui.mjs --profile v6`：改动点见附录 B。v5 的 profile 行为不变。
- [x] 骨架：`00-head`、`10-i18n` + `i18n/00-common.json`、`20-util`（`const ZWUI = {}`、`tierOf`）、`27-zwui`、`40-styles` + `css/00-tokens.css`（token、`--zp-*` 浅深两套、宿主约定规则）+ `css/10-base.css`、`50-parts`（Icon、图标表）、`90-app`（`ProApp` 只渲染根节点、顶栏、返回会话、一个空的首页占位；`Boundary`；`apply`）。其余文件建好、写一行文件头注释。
- [x] `verify/all.mjs` 加第 9 组"v6 界面（ui-v6）"。
- [x] `node build.mjs && node verify/all.mjs` 全绿；`node scripts/audit-ui.mjs --profile v6` 无 FAIL。

### T2：3D 场景（主会话）

目标：`src/sky.js` 进 bundle，观感和原型一致，生命周期正确。

- [x] `vendor/three-r128.min.js` 入库；`.gitattributes` 加 `vendor/** -text`。
- [x] 把原型的 `sky.js` 改成 `function createSky(THREE, canvas, opts)`：定义时不碰 DOM、不读 `window.THREE`；WebGL 上下文自己建，建不出来就安静地返回空实现。
- [x] 生命周期（清单见附录 C 的 sky.js 一节）：停放 / 取回、彻底释放、上下文丢失、不可见时停表、减少动态效果时按需渲染、释放之后所有接口是空操作而 `dive` / `birth` 仍然回调。
- [x] 画质和成本：不指定 `powerPreference`；`failIfMajorPerformanceCaveat: true`；像素上限 240 万，大画布用 2 倍多重采样。
- [x] 模块级的停放：`acquireSky` / `releaseSky` / `destroySky`，画布由场景持有。
- [x] `verify/ui-v6-sky.mjs`：进包方式、懒求值、不产生 `window.THREE`、没有 WebGL 时的空实现。这些检查是结构性的，写在实现之后。
- [x] 独立调试页（`audit/sky-dev/`，不进仓库）里看过：夜空 / 晨光、飞入、飞出、新星诞生；停放取回 30 次、彻底释放重建 12 次没有上下文警告；60 帧；减少动态效果下静止时不排帧；用 `WEBGL_lose_context` 模拟上下文丢失。
- [ ] 接进首页之后在预览壳里再看一遍（T8a）。

### T3a：小工具与本机存储

文件：`20-util.js`、`21-storage.js`、`27-zwui.js`、`verify/ui-v6-storage.mjs`、`verify/fixtures/storage-v5.json`。

- [x] 从 `src/ui-pro.js` 原样搬：`ZWUI` 的全部纯函数（第 1430–1541 行一带，含 100 城的经度表）、`DEFAULT_FORM`、`readingInput` / `readingKeyOf` / 解读记录的读写和 v1 迁移（第 2143–2313 行）、表单的 `formV133` 迁移、各偏好的读写。全部改成从注入的 `storage` 读写。
- [x] 新增：命盘库的增 / 改名 / 改生辰 / 删 / 撤销 / `openedAt`；首页取最近 8 张；一次性导入（spec §3.7）；`ziwei-pro.sky`。
- [x] 检查（先写）：
  - `verify/verify.mjs` 第 626–756 行那张 `ZWUi` 断言表（去掉 `revealDelta`）在 v6 的 `ZWUi` 上全部通过。
  - `readingKeyOf(黄金用例) === 'solar|1992|5|3|0|9|30|male|105.97|normal,exact,current,1'`。
  - v5 形状的 fixture 能读出命盘库、上次命盘、按 key 的对话和报告；一条 9 段的 v1 记录只迁移一次。
  - 保存最多留 8 张盘、每张 24 条消息、单条 120000 字；`running` 的报告存成可继续的 `error`；`setItem` 抛错时不抛出。
  - 写出去的记录的键恰好是 `thread, report, studioTab, name, updatedAt`；命盘库条目的 `id` 匹配 `/^lib-\d+$/`，`input` 是 v5 的那些字段。
  - 一次性导入：有 `lastChart` 和一条解读记录但命盘库为空 → 导入后命盘库有条目、记录仍能按 key 读到；再跑一次不新增。
  - 存储里 `monthDivide: 'normal'` 的旧表单只在第一次读时改成 `'exact'` 并写下 `formV133`；之后用户自己选的 `'normal'` 保留。
  - 清除本机记录：`readings.v2`、`readings.v1`、`lastChart.v1` 没了，命盘库还在。
  - 改名截到 12 个字；删除后撤销回到原位置；删到一张不剩时首页进入引导。

### T3c：生辰解析、时间层级、盘面几何

文件：`23-birth.js`、`24-scope.js`、`25-board.js`、`verify/ui-v6-scope.mjs`、`verify/fixtures/horoscope-reference.json`。

- [x] `parseDate` / `parseTime` / 时辰换算：行为以原型 `app.js` 第 108–162 行为准，改成纯函数（不读界面状态；公历 / 农历作为参数）。"不确定"不返回默认时间。
- [x] `horoscopeAt(chart, when)`：调用 `E.computeHoroscope`，传入的命盘副本把 `yearDivide`、`monthDivide` 都设成 `'normal'`（运限按农历分界，spec §3.3）。出生之前返回 null。
- [x] 流月单位：`lunarUnit(when)` 用 `E.solar2lunar` 得到 `{ year, month, leap, half }` 和显示用的文字；`stepScope(chart, tab, when, dir)`：流日 ±1 天，流月走到相邻流月单位的第一天（包括 2025 年 六月 → 闰六月下半 → 七月），流年 ±1 年，大限 ±10 年；越界返回 null。
- [x] 童限：`decadalInfo(chart, h)` 返回 `{ childhood, range }`，不从 `palaces[index].decadal.range` 硬取。
- [x] `relWord` / `whenLine` / `scopeCardModel(chart, { tab, when }, today)`：每个页签一份数据（标题、时间行、要点句、四化、是否有前后翻、是否显示"回到今天"）。
- [x] `scopeRequest(chart, h, tab, when)`：大限 → `{ decadalFocus }`，流年 → `{ yearlyFocus }`，流月 / 流日 → `{ contextBlock, focusLine }`（定位文字不超过 600 字）。
- [x] `planetItem(id, chart, todayHoroscope)`、`homeStatus(chart, todayHoroscope)`、`quickLook(chart, today)`（速览）。
- [x] 盘面：三方四正复用 `relatedPalaces`；`ringStep` 沿用 v5 的走法（`src/ui-pro.js` 第 1870 行）；`linePoints(rects, sel)` 返回四个朝向中宫的端点和一个稳定的 key。
- 结果：iztro 2.6.1 的 `horoscopeDivide` 默认就是 `'normal'`；`horoscopeAt` 在 45 个日期上四层全部一致，不加包装时有 19 处流月干支不同。闰月下半和下个月是同一个流月单位；流年、大限按农历年前后翻。
- [x] 参考表：用本机 iztro 2.6.1 对照环境（仓库外，不入库）导出黄金用例在约 40 个日期上的运限（大限、流年、流月、流日各自的宫位序号、干支、四化），覆盖 2025 年闰六月前后、2026 年春节前后、换大限前后、起运之前。只把结果存成 fixture。
- [x] 检查（先写）：
  - `parseDate`：`1990年6月15日`、`90.6.15`、`农历1990年五月廿三`、不存在的闰月、2 月 30 日。
  - `parseTime`：`下午三点半`、`15:30`、`申时`、`晚子时`、`25点`、`不确定`。
  - `horoscopeAt` 在参考表的每个日期上和 iztro 一致。
  - 连续 400 天：同一个流月单位内 `monthly` 的序号、干支、四化不变；`daily.index === (monthly.index + 农历日 − 1) % 12`。
  - `stepScope`：流日 ±1 天；流月走过闰月；出生之前和 2100 年之后返回 null。
  - `scopeCardModel` 每个页签的标题等于页签名；本命没有前后翻；其余有，四化等于 `h[tab].mutagen`。
  - `scopeRequest('daily')` 含干支和四个四化星名，不超过 600 字。
  - `linePoints` 对相同输入给出相同的 key。

### T4：报告模块与导出文件

文件：`30-report.js`、`css/85-prose.css`、`verify/ui-v6-report.mjs`。

- [x] 以原型的 `report.js` 为底：`mdToHtml`、`splitSections`、`sectionHtml`、`emblemSvg`、`boardHtml`、`buildReportHtml`。去掉 `sampleReport`。并入 v5 的 `mdToChatHtml` 和 `escHtml`（`src/ui-pro.js` 第 4196–4311 行）。对外是 `window.ZWReport`。
- [x] 正文版式拆到 `css/85-prose.css`（字号、间距收到 spec §4.6 的档位）；导出文件独有的样式留在 JS 里。导出文件里那段内联脚本（打印按钮、目录高亮）保留。
- [x] 四化配色用 v5 的（权蓝、科金）。
- [x] `progress(md)` 返回 `{ done, total: 14, current }`。
- [x] 检查（先写）：
  - `verify/verify.mjs` 第 598–622 行原样通过。
  - `mdToHtml('<img onerror=1>')` 被转义，只放行 `<br>`；称呼里的 `<script>` 在导出文件的标题里被转义。
  - `splitSections`：标题写到一半也算一个部分；往后追加文字，前面各部分的 `html` 严格相等。
  - `emblemSvg(黄金用例)` 两次调用结果相同；星点数等于 14；`{ id: 'a' }` 和 `{ id: 'b' }` 没有相同的 `id="…"`。
  - 导出文件：有 doctype、charset、深色变量块、`@media print`、12 个宫格加中宫、免责声明；除 SVG 命名空间外没有 `http`；浅 / 深变量的键集合相等。
  - `30-report.js` 里的正文样式等于 `css/85-prose.css` 的内容。

### T3b：数据流与 store

依赖 T3a。文件：`22-stream.js`、`26-store.js`、`verify/ui-v6-store.mjs`。这是逻辑上风险最高的一步。

- [x] `22-stream.js`：SSE 解析和结束语义照搬 v5 的 `openStream`（`src/ui-pro.js` 第 3364–3463 行），`fetch` 由调用方注入。
- [x] `26-store.js`：`createStore({ storage, fetch, now, engine, core, setTimeout, clearTimeout, openSession })`；`getStore()` 给出每个 factory 唯一的默认实例。内容：
  - `session`（spec §4.4）及其动作：`openChart`、`goHome`、`setTab`、`selectPalace`、`stepScope`、`backToNow`、`setPane`、`setPanel`、引导问答的 reducer。
  - `readings`：按命盘 key 的对话和报告。
  - `jobs`：`ask`（含空问题的速览）、`continueChat`、`retryChat`、`startReport` / `continueReport` / `regenerateReport`、`stop`。任务把增量写进 `readings`，结束时落盘；`pagehide` 时把写了一半的报告按可继续落盘。
  - 订阅：`subscribe(fn)`；派生数据用读函数（`currentChart()`、`horoscope()`、`reading()`、`job()` 等），没有做 `select(selectorName)`。完整接口见 `src/ui/26-store.js` 的头注释。
- [x] 请求体由 `buildInterpretBody(state)` 生成：`chartText === ZWCore.fullChartText(chart, pos)`（流月 / 流日时在末尾追加定位文字），`meta` 里的 `decadalFocus` / `yearlyFocus` / `currentAge` / `currentYear` 和 v5 同名同义。层级定位只在从时间卡发起的提问里带（spec §3.4），这一点和 v5 不同。
- [x] 检查（先写）：
  - 假流 delta、delta、done → 干净结束；没有 done 就关闭 → `stream-closed` 且可继续；HTTP 503 带 `{reason}` → 显示这个原因；用户停止 → `stopped`。
  - 对话：续写接在同一条回答后面；重试去掉失败的那一轮；忙的时候第二次提问被忽略；空问题的速览不产生用户气泡。
  - 报告：续写的结果等于原文加新文；重新写却一个字没写出来 → 恢复原报告。
  - 生成中换盘：旧盘的任务继续，结果存在旧盘的 key 下，新盘里没有。
  - **没有任何订阅者时**，进行中的报告继续累积并在结束时落盘；在同一份 storage 上新建一个 store 能读到它。
  - `selectPalace(b)` 之后 `session.sel` 变了，`tab`、`when`、`pat` 没变；`setTab('monthly')` 之后选中宫等于 `h.monthly.index`。
  - `stepScope(+1)` 在流日上前进一天且选中宫跟着走；到边界时状态不变并留下一条提示。
  - 打开紫微师面板不发请求。
  - 草稿按命盘 key 留在内存里，不写 storage。

### T5a：外壳与通用部件

依赖 T1、T3b 的接口。文件：`50-parts.js`、`90-app.js`、`css/10-base.css`、`css/50-parts.css`、`i18n/00-common.json`、`i18n/90-app.json`、`verify/ui-v6-shell.mjs`（补充）。

- [x] `ProApp`：量面板宽度（`ResizeObserver`，放在 layout effect 里，避免首帧跳档）→ `data-w`；订阅 store；顶栏（返回会话、位置、六个页签、问紫微师、更多、全部命盘、设置）；按 `session.view` / `stage` 渲染首页、命盘页、报告页；宽档下紫微师并排。各视图组件由后面的任务填，这里先放占位。
- [x] 部件：按钮、图标按钮、分段、chip、提示条（带撤销 / 查看）、确认按钮、菜单、浮层容器（焦点陷阱、Esc、遮罩、`data-dsh-automatic-focus`）。
- [x] 深色主题、macOS 标题带、键盘焦点样式。
- [x] 检查：T1 的外壳检查继续通过；深渲染里顶栏有六个页签且恰好一个 `aria-selected`；每个 `role=dialog` 都有 `aria-modal` 和 `aria-label`；每个按钮有文字或 `aria-label`。
- 实际做出来和上面写的不同之处：默认 store 不在 `apply()` 里建，面板第一次渲染时才建（`appStore()`）；「自动打开面板」的偏好改在 `apply()` 里生效（v5 把它放在面板组件的挂载里，而宿主只在面板已经打开时才挂载这个组件，等于不起作用）；每个视图组件收到 `props.tier`；`section.zp-chart` 和它的入场类由 `ProApp` 管；"更多"菜单（复制命盘文字、显示杂曜、改生辰）在顶栏里，不属于 T5b。自检用的极简 React 运行时在 `verify/client-harness.mjs`（`makeRuntime` / `bootRuntime`）。

### T5b：命盘页

依赖 T5a、T3c。文件：`70-chart.js`、`css/70-chart.css`、`i18n/70-chart.json`、`verify/ui-v6-chart.mjs`。原型对应 `app.js` 第 300–560 行、`style.css` 的命盘段。

- [ ] 时间卡、格局卡、宫位卡、盘面（12 个宫格按钮 + 中宫 + 连线）、窄档页签。（"更多"菜单已在 T5a 的顶栏里做完。）
- [ ] 连线端点在 layout effect 里量；位置没变不重画；只有换了宫才播描线。
- [ ] 检查（先写）：
  - 深渲染有 `SCOPE`、`PATTERNS`、`INSPECTOR`、`BOARD` 四个区域；12 个 `zp-cell` 按钮，`aria-label` 是"宫名 干支"；恰好一个 `aria-pressed=true` 且 `tabIndex` 为 0。
  - **选宫**：`selectPalace(a)` 和 `selectPalace(b)` 两次深渲染的差异只在宫格的 `className` / `aria-pressed` / `tabIndex`（最多 8 个宫格）、连线子树、宫位卡子树、窄档页签；别处没有节点增减；没有任何 `key` 含选中宫的序号。
  - **时间卡跟着页签**：五个页签各渲染一次，时间卡的标题等于页签名；任意两个页签之间，格局卡子树相同，宫格数量不变。
  - 宫位卡里点星名换解释；点三方四正的宫名换选中宫。
  - 入场动画的类只由一次性的 effect 加上并定时移除；宫格、卡片的 CSS 规则里没有 `animation`。

### T6：紫微师面板

依赖 T5a、T3b。文件：`80-assistant.js`、`css/80-assistant.css`、`i18n/80-assistant.json`、`verify/ui-v6-assistant.mjs`。行为以 v5 的 `StudioChat`（`src/ui-pro.js` 第 2349–2485 行）为准，外观以原型为准。

- [ ] 速览、起手动作、示例问题、对话、思考 / 输入指示、错误条（接着写 / 重试）、引用条、输入框、停止、新对话（可撤销）、在新会话里继续、免责声明。
- [ ] 宽档并排（`aside`），中、窄档是模态浮层。
- [ ] 检查（先写）：对话区是 `role=log` 且 `aria-live=polite`，类名含 `zp-chat-thread`；输入框有名字；忙的时候显示停止；可继续的错误显示"接着写"和"重试"；流式空回答显示输入指示而不是空气泡；从时间卡提问带上层级定位，"问这一宫"带上 `palaceQuoteText`；报告选段引用截到 600 字、发出后清掉；面板关着时生成结束，排一条带"查看"的提示；交接的请求字段和 v5 一样。

### T7：报告页

依赖 T4、T5a、T3b。文件：`85-reportview.js`、`css/86-reportview.css`、`i18n/85-report.json`、`verify/ui-v6-reportview.mjs`。原型对应 `app.js` 第 562–640 行。

- [ ] 空态、进行中（状态栏 + 目录进度 + 正文逐段出现）、完成（目录、滚动高亮、下载、复制、重新写）、中断（接着写 / 重新写）、选中文字"问这段"。
- [ ] 正文按部分渲染，`key` 用部分序号；写的过程中只有最后一部分的内容在变。
- [ ] 检查（先写）：四种状态各自的控件；切到报告页签时盘面子树还在（隐藏，不卸载）；一次增量之后，前面各部分的元素相同，只有最后一部分、状态栏、目录不同；"重新写"在 4 秒内第二次点击才执行；顶栏"报告"页签在生成中带进行标记，不管当前在哪个页签；下载调用 `buildReportHtml(meta, report.text)`，文件名里的非法字符被清理；离底部不到 80px 才自动跟随。

### T8b：引导问答、生辰表单、全部命盘

依赖 T5a、T3c。文件：`62-onboarding.js`、`64-sheets.js`、`i18n/62-onboarding.json`、`i18n/64-sheets.json`、`verify/ui-v6-onboarding.mjs`。原型对应 `app.js` 第 98–107、173–296 行；表单以 v5 的 `InputForm`（`src/ui-pro.js` 第 1617–1789 行）为准。

- [ ] 检查（先写）：引导的 reducer——改已答项回到那一步且后面的答案保留；确认步在时辰因校正而变时给出说明；"不确定"不前进；完成后命盘库最前面多一条 v5 形状的条目。表单保留农历、闰月、四项口径、职业；每个输入控件有名字。全部命盘列表能打开、改名、删除。

### T8a：首页

依赖 T2、T5a、T8b。文件：`60-home.js`、`css/60-home.css`、`i18n/60-home.json`、`verify/ui-v6-home.mjs`。

- [ ] 画布宿主（首页第一次可见才调用 `__ziweiBootstrapSky`）、星球标签（React 渲染，不设 `style`）、准星、状态句、输入框、快捷项、手势提示、静态星图兜底、主题跟随、飞入 / 飞出 / 新星诞生和视图切换的衔接。
- [ ] 检查（先写）：渲染首页不触发 3D 的求值；没有盘时显示引导第一步、没有标签；有 N 张盘时有 `min(N, 8)` 个带 `data-pid` 的标签且没有 `style` 属性；`homeStatus(黄金用例, 固定日期)` 给出宫名、化禄星、化忌星；点星球进入流日且选中宫是 `h.daily.index`；首页提问会打开命盘和紫微师并发出问题；3D 不可用时渲染静态星图和列表。

### T9：设置与全面检查

文件：`66-settings.js`、`i18n/66-settings.json`、`verify/ui-v6-settings.mjs`。

- [ ] 设置：自动打开面板、首页 3D 星图、清除本机记录（要确认）、版本和检查更新（每次点击只请求一次 `/ziwei/version`，没有轮询）、关于。
- [ ] 全面检查：`60`–`90` 的源码里注释以外没有中文字面量；每个按钮有文字或 `aria-label`，每个页签在 tablist 里，每个输入有名字；`--profile v6` 的体检全部为 0。

### T10：切换

前提：T1–T9 完成，主会话在预览壳里看过全部状态。

- [ ] **一次原子提交**：`build.mjs` 改成出 v6（`ui = assembleUi(...).text`，`sky = assembleSky(root)`；最后一行日志仍是 `built: engine-built.js, client.js`）；重新生成的 `client.js`；`verify/verify.mjs` 第 3 节按附录 A 处理；体检脚本默认 profile 改成 v6；`git mv docs/ui-contract/v6/* docs/ui-contract/`。
- [ ] 后续提交：删 `src/ui-pro.js` 和体检脚本的 v5 profile；`README.md` / `docs/ARCHITECTURE.md` / `CONTRIBUTING.md` / `REVIEW.md` 里"8 组自检"和 `src/ui-pro.js` 的说法；`CHANGELOG.md`、`package.json` 的 `version`（`2.0.0-dogfood.1`）、`locale/*.json` 的描述。
- [ ] `node build.mjs && node verify/all.mjs` 全绿；`node verify/pack.mjs`；`node scripts/release-pack.mjs --dry`。

### T11：复核（主会话）

- [ ] 代码审查；预览壳截图：浅 / 深 × 窄 / 中 / 宽 × 首页、引导、命盘（五个层级）、紫微师、报告四种状态、设置、浮层。
- [ ] 浏览器里做自检做不到的：点宫位时用 `MutationObserver` 确认只有属性变化和宫位卡、连线两处子树变化；一屏是否放得下；导出文件打印成 PDF 看分页；挂载卸载 30 次。
- [ ] 汇报里列出没验证到的（真实 DSH）。

## 附录 A：`verify/verify.mjs` 第 3 节在切换时的去向

行号是 `feat/v5-ux-polish` 上的。

**原样保留**：343–344、347–348、352–353、381–387、462、479–480、490、499–504、509–510、528–585、587–622、626–661、673–683、703–715、720–738、748–756、763–765、775–779、784–867。

这些断言钉住了 v6 的源码文本，写 v6 时就要满足：调用 `/ziwei/interpret` 和 `/ziwei/handoff`；`removeItem('ziwei-workbench.apikey')`；`const APP_VERSION = `；字符串"检查更新"；三条 darwin 规则的选择器和声明；`.zp-btn` 的规则从行首开始；`:where(.zp-root) button { color: inherit }`；`setAttribute('data-dsh-automatic-focus'`；类名 `zp-md-table`；`inject` 含 `slots` 和 `uiWorkspace`；main 的 key 是 `ziwei`；`actions.canReturnToConversation` / `returnToConversation`；`zp-exit` 按钮由 `ProApp` 自己渲染。

**改写**：

| 原断言（行） | 改成 |
|---|---|
| 350 | 字典里 `handoff` 的中文是"在新会话里继续"，且紫微师面板渲染出 `zp-chat-thread` 节点 |
| 356–358 | T3a 的表单迁移检查 |
| 423–436 | T3a / T3b 的 store 检查（换盘各自恢复、8 张 / 24 条、key 随口径变、启动恢复上次命盘） |
| 440–444 | `buildInterpretBody(state)` 的字段检查 |
| 445–446 | 假 `locale` 服务记录到一次 `register('ziwei', { zh, en })` 和一次 `bind('ziwei')` |
| 448–450 | 深渲染：对话区 `role=log` + `aria-live=polite`；每个 `role=dialog` 有 `aria-modal` 和 `aria-label` |
| 454–456、460–461 | 假流上的报告任务以 `done` 结束且正文合并正确；`ZWReport.progress(md)` |
| 466–478 | `client.js` 等于 `assembleClient(...)` 的结果，逐字节 |
| 484–487 | 空 storage 下自动打开为关；`DEFAULT_FORM.settings` 等于 normal / exact / current / true |
| 505–508 | 只留 `/selectPanel\(null\)/`（按钮本身由 815–833 断言） |
| 685–702 | 取 vm 里的字典对象来比键、查禁用词、查引用，不再靠缩进正则 |
| 739–747、780–781 | `ZWUi.iconNames` 包含源码里用到的每个图标名 |
| 349、403–404、412–413、417–418、718–719 | 合成一条：这些已删除的旧标识符都不出现在 `client.js` 里 |

**删除**（旧布局专属）：361–363、366–374、377–378、390–392、393–394、396–399、401–402、405–406、407–408、409–410、414–416、419–422、437–439、451–453、457–459、663–671、766–774。

## 附录 B：`scripts/audit-ui.mjs` 的改动点

| 位置 | 改动 |
|---|---|
| 输入和参数（第 30–45 行） | `--profile v5\|v6`：决定源码怎么读、约定文档目录、基线文件 |
| 默认基线（55–68） | v6 全 0 |
| `lineOf`（107–112）及各处调用 | v6 用 `assembleUi` 返回的 `map` 报"文件 + 行号" |
| `loadContext`（758–785） | v6：`src = assembleUi(root, { version: '0' }).text`；`extractCssTemplate` 不用改 |
| C2 字号、C4 字重（319–384） | 能解析 `font:` 简写，或者在 v6 里禁用简写里的字号（原型有 25 处简写，现在的正则看不见） |
| C2 白名单 | spec §4.6 的 14 个值 |
| C3 间距（343–344） | 去掉 88 这个豁免 |
| C11、C12（517、531–540） | v6 的类名清单（保留 `zp-chat-thread`、`.zp-exit`、`.zp-head`、`.zp-root`） |
| C13 阈值（174–189、554–649） | 按 v6 的参数表和公式重写：`MID` = 720、`WIDE` = 1180，源码里的 `panelW` 判定恰好这两个值 |
| C15（679、695–702） | v6 的 `--zp-*` 集合和对比度组（`--zp-gold-text`、`--zp-zi` 对底色） |
| C16、分级（715–747） | v6 下 C1–C4、C16 都是硬规则，必须为 0 |
| 新增 C17 | 过渡和动画不超过 300ms；`infinite` 只出现在 `design.md` 列出的选择器上 |
| 新增 C18 | 没有 `vw` / `vh`、没有按宽高的 `@media`、没有 id 选择器、没有 `env(`；每个类名以 `zp-` 开头（报告正文的 `zr-` 和 `md-table` 例外，在文档里登记） |

不变：C5–C10、C14（C14 读 v6 的 `layout.md`）。约定：C8–C11 只认 `h('input', {` 这种字面写法。

## 附录 C：原型移植清单

**`style.css`**

| 原型里 | 行 | 插件里 |
|---|---|---|
| `#app { position: fixed }` | 59 | `.zp-root`，`position: relative; height: 100%` |
| `:root` 上的调色板（浅 / 深 / `data-theme`） | 4–52 | 宿主 token；少量登记过的 `--zp-*` 写在 `.zp-root` 和 `body[data-ds-dark-theme] .zp-root` |
| 全局重置（`*`、`html, body`、`button, input, textarea`、`:focus-visible`） | 53–57 | 都限定在 `.zp-root` 下 |
| 视口媒体查询 | 371、377、383 | `data-w` 三档 |
| 7 处视口单位 | 101、111、183、283、335、373、414 | 容器查询单位或面板尺寸 |
| 24 处 `env(safe-area-*)` | 各处 | 去掉；macOS 标题带用三个 `--dsh-frame-*` |
| id 选择器 `#app` `#sky` `#planets` `#openTalk` | 各处 | 带前缀的类 |
| 146 个没有前缀的类名 | 各处 | 加 `zp-` |
| 作用在全局 `*` 上的减少动态效果规则 | 421–423 | 限定在 `.zp-root` 下 |
| 导出预览、原型开关条 | 320–326、361–367 | 不搬 |
| `spin 40s linear infinite` | 166 | 属于 `HOME_SKY` 的豁免 |
| 6 处画布上方的 `backdrop-filter` | 例如 76、107 | 保留，在预览壳和真机里看性能 |

顶栏在原型里是绝对定位（第 70 行）；绝对定位的子元素不受根节点 darwin `padding-top` 的影响，所以插件里外壳要是 `.zp-root` 里一个在文档流中的相对定位盒子。

按现在的体检规则数，原型的 CSS 有：字号 10 处表外、`font:` 简写 25 处、间距 93 处表外、字面色 85 处、超过 300ms 的时长 14 处、无限循环 3 处。移植时全部收到 spec §4.6 的档位上。

**`app.js`**（行为说明，不是可搬的代码）

- 全局对象和按 id 取节点（第 5 行）、文档级监听和观察器（274、490、704、710–711）、运行时注入样式（12–16）：都换成组件和 effect。
- 需要能在卸载时取消的定时器：252、314–315、323、500、605–607、640–642、668、673–674、703、707、730。
- 只属于原型：场景和主题开关（705–708）、导出预览（625–635）、假的流式和示例回答（589–608、656、670–696）、示例报告（517–523）、存储键 `zw-v6-proto`（51–64）、`SAMPLES`（52–59）、"返回会话""设置"的占位提示（95–96）。
- 飞入时的闪色写死了 `#151517` / `#ffffff`（第 9 行）：改成读面板底色的计算值。
- 城市表只有 46 个且匹配规则不同（32–35、164–171）：用 `parseBirthplace` 和 v5 的 100 城表。
- 所有中文都是拼出来的（例如 179–180、404–409）：改成带占位符的字典键，中英文各一份。
- 方向键按序号走（513）：改回 v5 沿宫格环走的 `ringStep`。
- 复制只用了 `navigator.clipboard`（612）：沿用 v5 的失败提示。
- 流月前后翻按 ±29 天（350）、闰月和童限的处理：按 T3c 重做。
- "读这张盘"发了一句"讲讲这张盘"：改成空问题。
- 新盘的 id 写成 `'u' + Date.now()`、字段叫 `isLeapMonth`（289–291）：命盘库条目必须是 `lib-<毫秒>` 和 `input.isLeap`。

**`report.js`**

- 去掉 `sampleReport`；`window.ZWReportV6` 并进 `window.ZWReport`，补上 `mdToChatHtml` 和 `escHtml`。
- 两套 14 色的星曜色取代 `tokens.md` 里的旧表。
- 面板里的正文样式必须在受检查的 CSS 里，不能是运行时注入的字符串。

**`sky.js`：正确的释放需要做什么**

- 把立即执行函数（第 4 行）改成 `createSky(THREE, canvas, opts)`。现在它在加载时读 `window.THREE` 和 `getElementById('sky')`（第 6 行），并且立刻开始渲染（735）。
- 保存动画帧的 id。现在 `frame` 在隐藏时也会继续排下一帧（728–729），减少动态效果时也每帧渲染（731）。隐藏时停掉循环；减少动态效果时按需渲染。
- 移除画布上的七个监听（529–557），最好用一个 `AbortController` 的 signal。
- 保存并断开 `ResizeObserver`，去掉 `window` 上的 `resize` 兜底（617）。
- 清空 `layers()` 传进来的 DOM 引用（742），重置三个回调。
- 修 `dropPlanet`（496）：它漏了大气材质、光环材质和光环几何体。
- 停放时显式释放：`rtScene` / `rtOcc` / `rtRays` / `dn[6]` / `up[6]`（563–568）。
- 完整释放时：保留对 PMREM 渲染目标的引用以便释放（现在只留了 `.texture`，第 48 行）；释放两张源画布贴图（45）、星云烘焙目标和它的匿名材质（89–114）、宫盘贴图（219）；然后 `renderer.dispose()`，再 `renderer.forceContextLoss()`（r128 的 `dispose()` 自己不释放着色器程序和贴图）；之后不再复用那块画布。
- 处理 `webglcontextlost` / `webglcontextrestored`：烘焙的星云和环境贴图恢复不了，要么重建，要么退回静态星图。
- 释放之后每个接口都是空操作，`dive` / `birth` 仍然调用回调。
- 遮罩色（602）和昼夜档位取自宿主主题：监听 `body[data-ds-dark-theme]`，停放时断开。
- 画布状态类改名（528、531、549）。
- React 不能给标签节点设 `style`：`place()` 每帧写 transform、opacity、visibility（724）。
- 成本：每次创建要做两次 PMREM 烘焙（47–49）、一次 2048×1024 的噪声烘焙（89–115）、约 25 个着色器的同步编译和 13 万个点的缓冲（316）；`rtScene` 是 4 倍 MSAA 的 RGBA16F（564），3.3 百万像素的上限（610）在高分屏上一定会碰到，单是颜色缓冲就约 105MB。所以要做停放，并下调上限和 MSAA。

## 审查重点

1. v5 用户的数据：一次性导入只增不改；切回 v5 分支后旧界面能读 v6 写过的全部记录。
2. 生成任务在没有组件挂载时的行为，以及 `pagehide`、插件卸载时的收尾。
3. 流月在闰月、春节、月末那几天的显示和前后翻。
4. 3D 的释放：反复进出面板之后的上下文数和显存。
5. 切换提交里被删掉的旧断言，是否每一条都有替代或者确实只属于旧布局。

## 风险与回滚

- 风险：真实 DSH 里的 WebGL 表现没验证过；`client.js` 变成约 1MB；自检大面积改写可能削弱覆盖；v6 第一次用到引擎的流月、流日。
- 回滚办法：切换之前 `client.js` 一直是 v5，随时停下都不影响正在用的插件。切换之后不满意，`git switch feat/v5-ux-polish` 即回到 v5；localStorage 只新增了两个键，旧界面照常读取。

## 验证

- 全量：`node build.mjs && node verify/all.mjs`
- v6 单独：`node verify/ui-v6.mjs`；`node scripts/audit-ui.mjs --profile v6`
- 预览：`node verify/ui-v6.mjs --write-preview`，然后开 `audit/preview-shell/`
- 人工：切换之后，在 DSH 里打开面板，看浅色和深色、窄、中、宽三档，以及 spec §3 的各个状态（由 Neo 做；安装和重启不由 agent 执行）
