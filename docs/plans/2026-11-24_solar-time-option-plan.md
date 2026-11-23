# 实现计划：真太阳时可选、出生城市补全、没校正也能出报告

- Spec：[docs/specs/2026-11-24_solar-time-option.md](../specs/2026-11-24_solar-time-option.md)
- 分支：`feat/solar-time-option`
- 执行方式：单个会话，一个任务一个提交，上一个全绿再做下一个

## 全局约束

- `src/engine-core.js` 不动；已存的盘结果不变。
- 条目只在不校正时多 `settings.trueSolar: false`；命盘 key 格式不变。
- 不手改 `client.js`、`engine-built.js`；不重启 DSH、不发布、不 push。
- 测试和文档只用黄金用例（1992-05-03 09:30，男，经度 105.97）和它的合成变体。
- 城市数据入表之前先补 `THIRD_PARTY_NOTICES.md`。

## 文件清单

| 文件 | 新建或修改 | 负责什么 |
|---|---|---|
| `THIRD_PARTY_NOTICES.md` | 修改 | GeoNames 的署名和许可 |
| `src/ui/20-util.js` | 修改 | 按省分组的城市表、`parseBirthplace` |
| `src/ui/21-storage.js` | 修改 | `effectiveLongitude`，key 和自动盘名用它 |
| `src/ui/26-store.js` | 修改 | 交给引擎的经度用它 |
| `src/ui/23-birth.js` | 修改 | 时辰结果带 `shichen` |
| `src/ui/62-onboarding.js`、`i18n/62-onboarding.json` | 修改 | 时辰不校正、确认步的开关、省名出城市选项 |
| `src/ui/64-sheets.js`、`i18n/64-sheets.json` | 修改 | 表单里的单选组和说明 |
| `src/ui/70-chart.js`、`i18n/70-chart.json` | 修改 | 中宫的三种写法 |
| `src/ziwei-core.js`、`index.js` | 修改 | 时间口径一节、交接首条消息 |
| `src/ui/85-reportview.js`、`i18n/85-report.json` | 修改 | 没写成报告的提示 |
| `verify/ui-v6-storage.mjs`、`ui-v6-onboarding.mjs`、`ui-v6-store.mjs`、`ui-v6-chart.mjs`、`ui-v6-reportview.mjs`、`verify.mjs` | 修改 | 新断言 |
| `CHANGELOG.md` | 修改 | 未发布一节 |

## 任务

每个任务都是：先写失败的断言 → 运行确认失败 → 实现 → `node build.mjs && node verify/all.mjs` 全绿 → 提交（`src/` 和重新生成的 `client.js` 一起）。

### 任务 1：城市表和解析
- [x] `THIRD_PARTY_NOTICES.md` 加 GeoNames 一节
- [x] 断言（`ui-v6-storage.mjs`）：spec §3.4 的用例、城市名不重复、条数、v5 94 城不变
- [x] `CITY_TABLE` 和 `parseBirthplace`

### 任务 2：口径字段
- [x] 断言（`ui-v6-storage.mjs`、`ui-v6-store.mjs`）：`effectiveLongitude`、key 相同、`trueSolar: false` 的条目排出 spec §3.1 表里的结果
- [x] `effectiveLongitude`，三处调用改用它

### 任务 3：引导问答
- [x] 断言（`ui-v6-onboarding.mjs`）：spec §3.2
- [x] `parseBirthTime`、`obInputOf`、reducer、确认句、chip、文案

### 任务 4：生辰表单和中宫
- [x] 断言（`ui-v6-onboarding.mjs`、`ui-v6-chart.mjs`）：spec §3.3、§3.5
- [x] 单选组、说明、中宫写法

### 任务 5：提示词
- [x] 断言（`verify.mjs`）：spec §3.6，已校正的三种模式和改动前逐字相同（改动前的输出先存成 fixture）
- [x] `buildRequest`、`handoffPrompt`

### 任务 6：报告页兜底
- [x] 断言（`ui-v6-reportview.mjs`）：spec §3.7
- [x] 判断函数和提示

### 任务 7：收尾
- [x] `CHANGELOG.md`
- [x] 预览壳里看引导确认步、生辰表单、中宫、报告页提示：浅色和深色、窄中宽

## 执行记录（2026-11-24）

- 任务 1–7 都做完了，每个任务一个提交，每次提交前 `node build.mjs && node verify/all.mjs` 全绿（唯一的 ⚠️ 是本机没有独立版
  `run-paipan.js`，这一项原本就是可选的）；`node verify/pack.mjs` 9 项通过，`node scripts/audit-ui.mjs` 18 项通过。
- 城市数据：GeoNames `CN.zip` / `TW.zip`（2026-11-23 的导出）。按名单自动匹配后逐个核对，三处匹配到了同名的县驻地或区划中心点
  （本溪、潜江、天门），改用市区那条记录的值。v5 的 94 城和 GeoNames 的差都在 0.2° 以内，原值没动。
- 和计划不一样的地方：
  - 「是时辰」这个标记放在时间结果的顶层（`{ value, show, short, shichen: true }`），`value` 仍是 `{ h, m }`：现有自检把 `value` 的形状钉住了。
  - 直接给时辰、又没填城市时，确认步不提校正（没什么可校正的）。
  - 「命主在这里无法回答追问」那一句只加在未校正的盘上：已校正的盘发出去的请求要和改动前逐字相同。
  - 多了一个小修：确认步那句生辰在窄档不折行、右边被裁掉（原有的 `.zp-status strong { white-space: nowrap }`），预览壳里看到后修了。
- 视觉：在本机预览壳（`audit/preview-shell/`，加载仓库根的 `client.js`）里看过引导问答的省名选项和确认步、生辰表单、命盘中宫、
  报告页的「没写成报告」提示。深色宽 / 中 / 窄、浅色宽 / 窄都截图看过；浅色中档没有单独看。
- **没验证的**：
  - 未在 DSH 真机复核（不重启 DSH）。提示词在 Host 侧，要重启后才生效。
  - 真实模型在未校正的盘上会不会照新的提示词写完报告，没有实测：自检只能证明发出去的请求变了。
    它仍然拒写的话，报告页会显示「没写成报告」和「重新生成」。

## 审查重点

- 旧条目（没有 `trueSolar`）经过表单保存一次之后，`settings` 里不能多出这个字段。
- 不校正的盘换回校正：key 变回带经度的，原来那张盘的对话和报告要找得回来。
- 省名开头但后面是别省城市的输入（例如写错了省）：应落到省，不能悄悄用别省的城市。
- 时辰答完又回去改成钟表时间：`trueSolar` 要跟着变回来，用户在确认步手动关掉的不能被冲掉。
- 旧 Host + 新 Client、新 Host + 旧 Client 都不能坏。

## 风险与回滚

- 风险：提示词改了之后模型在未校正的盘上仍然拒写。有报告页兜底（任务 6）；真机结果由 Neo 重启后确认。
- 风险：城市表里有个别经度不准。差 0.1° 约等于 0.4 分钟；用户看得到用的是哪个城市和经度，也可以直接填经度。
- 回滚办法：每个任务一个提交，可以单独 `git revert`。任务 2 之后写出的 `trueSolar: false` 条目在旧版本里会被当成校正的盘（字段被忽略）。

## 验证

- 全量：`node build.mjs && node verify/all.mjs`，`node verify/pack.mjs`
- 人工：预览壳里看浅色和深色、窄中宽三档；DSH 真机由 Neo 重启后看
