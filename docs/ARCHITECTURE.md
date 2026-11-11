# 架构 / Architecture

本文说明紫微斗数工作台（DSH 插件）的构成、构建链与数据流。目标是让第一次读代码的人
在半小时内知道「哪个文件负责什么、改动会影响到哪里」。

- 形态：**单包 DSH 插件**（不是 monorepo）。仓库根目录即 npm 包根目录。
- 两个半区：Host 半（Node，跑在 DSH Host 进程里）与 Client 半（浏览器，跑在 DSH Web 前端里）。
- 构建产物**提交进仓库**：`client.js` 与 `engine-built.js` 由 `node build.mjs` 生成。

```text
┌──────────────────────────── DSH Host 进程 ────────────────────────────┐
│  index.js（Host 半）                                                  │
│    ├─ 4 个工具：ziwei_paipan / ziwei_check / ziwei_templates /         │
│    │            ziwei_context        （tools.register）                │
│    ├─ 系统提示词铁律                  （systemPrompt.section）          │
│    ├─ /ziwei/interpret   SSE 解读     ┐                               │
│    ├─ /ziwei/context     存盘上下文   ├─ ctx.inject(['webServer','llm'])│
│    ├─ /ziwei/handoff     开会话       │  按需注册（可选服务）           │
│    └─ /ziwei/workspace   诊断         ┘                               │
│         │                                                             │
│         └─ node:vm 沙箱加载 engine-built.js + src/ziwei-core.js        │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ 浏览器 fetch（同源本地路由）
┌───────────────────────────────┴───────────────────────────────────────┐
│  client.js（Client 半，__ModuleLoader__ 懒加载 factory）               │
│    ├─ 排盘引擎 ZWEngine（纯函数，无 DOM）                              │
│    ├─ 紫微师内核 ZWCore（人设/提示词/请求组装/黄金用例）                │
│    └─ 面板 UI（React，注册到 sidebar.panellist）                       │
│         左侧生辰表单 · 盘面/十二宫/四化/大限 · 解读抽屉 · 设置弹层      │
└───────────────────────────────────────────────────────────────────────┘
```

## 1. 包清单（`package.json` → DSH）

| 字段 | 值（本仓库） | 含义 |
| --- | --- | --- |
| `name` | `@local/ziwei-workbench` | **本机 link 安装用**。对外发布名由 `scripts/release-pack.mjs` 在 `dist/` 副本里改写，仓库内的名字不动 |
| `private` | `true` | 防止误发布；发布副本里由脚本改成 `false` |
| `type` | `module` | ESM |
| `exports` | `.` / `./client` / `./package.json` / `./locale/*.json` | Host 入口、浏览器入口、locale |
| `icon` | `./icon.svg` | Plugins 页与插件索引的图标来源 |
| `dsh.manifestVersion` | `1` | manifest 格式版本，与 npm 版本无关 |
| `dsh.bundle.patch` | `./cordis.patch.yml` | bundle 层声明；patch 里的 `name` 必须等于包名 |
| `dsh.client` | `platform: web`, `immediately: true`, `inject: [layout, sidebar]` | 浏览器半区的加载声明与 UI 依赖 |
| `engines` | `node >=22`, `dsh >=0.2.1-rc.5 <0.3.0` | 运行兼容声明（以 `package.json` 当前值为准） |

`cordis.patch.yml` 把插件作为一个 bundle 层插入：

```yaml
- insert:
    - id: ziwei-workbench
      name: '@local/ziwei-workbench'
      config: {}
```

## 2. Host 半（`index.js`）

### 2.1 依赖边界（重要）

插件以 `link:` 装进 profile，运行时**不能 `import` `@deepseek-ai/*`**。因此：

- **必需服务只有两个**：`inject = ['tools', 'systemPrompt']`。宿主会等它们就绪再 `apply()`。
- **可选服务一律 `ctx.get(...)`**：`agentDefaultModel` / `sessionController` / `workspaceRegistry`
  不存在时做降级或明确报错，绝不放进 `inject`（否则整个插件永远不 apply）。
- **面板路由的服务走 `ctx.inject(['webServer', 'llm'], onRoutes)` 按需等待**：
  没有这两个服务的 profile 仍能正常注册 4 个排盘工具，只是没有面板解读通道。
- 工具定义手工构造（不 import `defineTool`），所以必须自己校验入参；schema 类型只能是
  `object/array/string/number/integer/boolean/null`（没有 `json`）。

### 2.2 注册内容

| 注册项 | 说明 |
| --- | --- |
| `ziwei_paipan` | 确定性排盘。只接原始四要素（日期 / 钟表时间 / 性别 / 经度），真太阳时校正与时辰索引在内部完成 |
| `ziwei_check` | 黄金用例四断言自检（工具损坏时必须停手，不带着坏工具出报告） |
| `ziwei_templates` | 紫微师方法论（人设 / 九诀 / 鲲鹏 14 部分 / 红线 / 交付前自检） |
| `ziwei_context` | 读取最近一次从面板交接过来的命盘（进程级 `lastContext`） |
| 系统提示词 | 排盘唯一来源、只传原始四要素、缺参追问、报告前取模板、文末免责声明 |

### 2.3 路由

| 路径 | 方法 | 作用 | 依赖 |
| --- | --- | --- | --- |
| `/ziwei/interpret` | POST（SSE） | 面板内解读：拼请求 → `llm` 服务流式输出 → `start/delta/thinking/done/error` 事件 | `webServer`, `llm` |
| `/ziwei/context` | POST (JSON) | 把命盘文本存进进程内 `lastContext`，供 `ziwei_context` 取用 | `webServer` |
| `/ziwei/handoff` | POST (JSON) | 存上下文 + 用 `sessionController.create/prompt` 真开新会话并灌入命盘 | `webServer`, `sessionController`（可选） |
| `/ziwei/workspace` | GET | 排查用：返回当前工作区目标 | `webServer` |

鉴权/守卫（所有路由共用）：

1. 方法白名单 + POST 的 `Content-Type: application/json` 校验；
2. `connection.requestRejection(req)` 复用宿主的 Host/Origin 校验与浏览器认证；
3. `connection.admit(req)` 返回 Peer，**只接受 `owner`**（与 `/api` 精确 Fetch 路由同口径），
   防止 remote-access / 非 owner Peer 借道消耗 LLM 或让 Host 建会话。

### 2.4 沙箱与资源清理

- `index.js` 用 `node:vm` 加载 `engine-built.js` 与 `src/ziwei-core.js`，拿到 `ZWEngine` / `ZWCore`。
  Host 与浏览器跑的是**同一份**引擎和同一份人设，不会两边走样。
- 所有注册都通过 `ctx.effect(() => disposers)` 在卸载时清理。
- 诊断日志：`host-diag.log`（装载过程）、`interpret-diag.log`（每次解读一行，512KB 轮转）；
  `ZIWEI_DIAG=0` 可关闭。两者都不进 npm 包。

## 3. Client 半（`client.js`）

`client.js` 是拼接产物，结构固定为：

```text
懒加载内核包装（__ziweiBootstrapKernel，定义但不执行）
  + engine-built.js（排盘引擎，挂 window.ZWEngine）
  + src/ziwei-core.js（紫微师内核，挂 window.ZWCore）
  + src/ui-pro.js（React 面板，window.__ModuleLoader__.load({ id, factory })）
```

- **lazy-CJS 契约**：脚本加载期只调用 `__ModuleLoader__.load(...)` 注册 factory；
  引擎/内核在 factory 首次物化（materialization）时才求值。因此 `client.js` 加载时不写
  `window.ZWEngine`、不执行 226KB 引擎代码。`verify/verify.mjs` 有静态断言防回退。
- `id` 必须等于**解析后的包名**：DSH 用包名标识浏览器模块。发布改名时
  `scripts/release-pack.mjs` 会同步改写这个 id（以及 `cordis.patch.yml` 的 `name`）。
- UI 只 `require('react')`（平台基线模块），不 `import` 任何 `@deepseek-ai/*` 客户端包。
- 面板入口：`ctx.slots.inject('sidebar.panellist', ...)` 注册「紫微斗数 Pro」。
- 退出/跳转：`ctx.layout.selectPanel(null)` 返回会话；`uiWorkspace.openSession(id)` 切会话
  （服务不可用时降级提示，不假装成功）。
- 主题：颜色只走 `--dsw-alias-*` token；星曜/四化等内容色集中在插件级 `--zp-*` 变量。
  darwin 桌面端避让窗口 chrome：`--dsh-frame-top-clearance` / `--dsh-frame-leading-clearance` /
  `--dsh-frame-overlay-top`（均带 `0px` 兜底），并用 `isolation: isolate` 把内部 z-index 收进
  面板自身上下文，避免盖住 frame 的 `shell.leading` 退出控件。
- **浏览器 localStorage 只存偏好与命盘库**：`ziwei-pro.form`（表单）、`ziwei-pro.library`
  （命盘库）、`ziwei-pro.focus`、`ziwei-pro.autopen`、`ziwei-pro.showadj`。
  **不存 API Key**；旧版本遗留的 `ziwei-workbench.apikey` 会在初始化时被清理。

## 4. 构建链（`build.mjs`）

```bash
node build.mjs
```

1. 读取 vendored 数据表 `src/lunar-data.js`（`LUNAR_INFO` / `LTERM_INFO`，各 201 项，
   由 `scripts/vendor-lunar-data.mjs` 从 `solarlunar@3.1.0` 的 ESM 产物抽取，**ISC**）。
   维护者本机有 `.ref/` 时，构建失败会回退到从 `.ref/` 重新抽取（仅维护者便利路径）。
2. 校验两项都是 201 项，数量不符直接失败。
3. 把数据表注入 `src/engine-core.js` 的两个占位符：
   `/*__LUNAR_INFO__*/`、`/*__LTERM_INFO__*/`。
4. 产出：
   - `engine-built.js`：只有引擎（Node/host 沙箱与测试用）；
   - `client.js`：懒加载内核包装 + 引擎 + `src/ziwei-core.js` + `src/ui-pro.js`。

产物提交进仓库；`verify/verify.mjs` 会逐字节比较「当前产物」与「源码重新拼接的结果」，
所以**改了 `src/` 必须重新 `node build.mjs` 并一起提交**。`npm pack` 之前也要先构建，
否则打进去的是旧产物。

## 5. 数据流

### 5.1 排盘（纯本地）

```text
面板表单（日期/时间/性别/经度）
  → ZWEngine.computeChart（浏览器内，纯函数）
  → UI 渲染十二宫 / 四化 / 大限 / 流年 / 格局
```

排盘在浏览器内完成，不把生辰发到 Host；只有「解读」「交给会话」才把**命盘文本**
（含出生四要素）发到本机 Host 路由。

### 5.2 面板内解读（SSE）

```text
面板 POST /ziwei/interpret
  → guard（方法/JSON/requestRejection/owner-only）
  → ZWCore.buildRequest（人设 + 命盘 + 模式 + 历史）
  → llm 服务流式生成
  → SSE: start → (thinking | delta)… → done
         （max-tokens/超时/断连 → error + 保留前文 + canContinue）
  → 面板：只有收到 done 才当写完；其它情况保留部分正文并给「继续生成」
```

### 5.3 交给会话

```text
面板 POST /ziwei/handoff
  → 存 lastContext（供之后 ziwei_context 读）
  → sessionController.create + prompt（把命盘与已有解读作为首条消息）
  → 返回 sessionId
  → 面板 uiWorkspace.openSession(sessionId)（重试；失败提示去侧栏打开）
```

## 6. 分发

| 方式 | 用途 | 备注 |
| --- | --- | --- |
| 本地 `link:` / `plugin_manager install_bundle` 绝对目录 | 开发、本机试用 | 详见 `docs/INSTALL.md`；Host 半改动需重启 DSH |
| npm 包 + 插件索引 | 对外发布 | `scripts/release-pack.mjs` 生成改名后的发布副本；详见 `docs/PUBLISHING.md` |

发布副本必须同时改写三处身份：`package.json.name`、`cordis.patch.yml` 的 `name`、
`client.js` 里 `__ModuleLoader__` 的 `id`。漏改任何一处都会出现「装上了但不生效」或
「Host 层生效、面板不出现」。

## 7. 自检地图（`verify/all.mjs`，8 组）

| 组 | 脚本 | 覆盖 |
| --- | --- | --- |
| 1 | `verify/verify.mjs` | 引擎契约、黄金用例、host 注册/路由、客户端 bundle 可求值、产物新鲜度、chrome 避让 |
| 2 | `verify/exports.mjs` | 宿主导出契约（`name` / `inject` / `apply`）、路由依赖走 `ctx.inject` |
| 3 | `verify/routes-auth.mjs` | 路由方法 / `requestRejection` / owner-only / JSON 守卫 |
| 4 | `verify/verify-tools.mjs` | 真实 `dsh-tools` 契约；无 DSH 环境时按退出码 3 显式跳过 |
| 5 | `verify/diff-runner.mjs` | 20 用例逐字段差分：有来源产品 runner 用 runner，无则用 `verify/fixtures/paipan-reference.json` |
| 6 | `verify/sse-hang.mjs` | SSE 超时解锁、max-tokens 不算 done、断连语义 |
| 7 | `verify/pack.mjs` | `npm pack --dry-run` 打包完整性（运行时文件齐全、日志不进包） |
| 8 | `verify/ui-contract.mjs` | 界面契约的可机械化检查（区域 / token / a11y，`scripts/audit-ui.mjs` 的包装） |

## 8. 已知限制

- 跟随 DSH **developer preview**：`@deepseek-ai/*` 私有/实验 API 可能随版本变化；兼容声明
  只看 `engines.dsh`，升级时可能需要发版。
- UI 没有浏览器端自动化测试：`verify` 只做静态断言与假 DOM 可求值，**视觉与交互仍需人工复核**
  （见 CONTRIBUTING「UI 改动必须亲眼看」）。
- 命理内容属传统文化娱乐参考，不是现代科学结论；排盘数据含个人敏感信息，数据路径见
  `SECURITY.md`。
