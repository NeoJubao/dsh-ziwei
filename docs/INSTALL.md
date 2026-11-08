# 安装 / Installation

本插件是一个 **DSH（DeepSeek Harness）插件**。它没有独立应用，必须装进某个 DSH
profile 里使用。三种安装方式按用途选一种即可。

> ⚠️ **Host 半（`index.js`：工具 / 提示词 / 路由）装完或更新后必须重启 DSH 才生效**；
> 只改浏览器半（`client.js`：面板 UI）刷新页面即可。插件不会自己重启 DSH。

> 兼容性：Node.js **>= 22**；DSH 兼容范围以 `package.json` 的 `engines.dsh` 为准
> （当前 `>=0.2.1-rc.5 <0.3.0`）。首次安装前建议先用 `dsh --version` 确认。

---

## 方式一：本地 link（开发 / 本机试用）

适合自己改代码、调试插件。**推荐用 `plugin_manager` 的 `install_bundle`**，它会先
inspect 再写 profile、失败回滚；不要手写 `~/.dsh/profiles/*`。

### 1.1 先用 Plugins 页 / `install_bundle` 装绝对目录

在 DSH Web 的 **Settings → Plugins** 里添加本地插件目录，或让 agent 调用
`plugin_manager` 工具：

- `action: install_bundle`
- `target: /绝对路径/到/ziwei-workbench`（必须是包含 `package.json` 的目录）

> `install_bundle` 需要 `danger-full-access` 或用户审批；被 pnpm 拦的构建脚本需要
> `approvedBuilds`。本插件零依赖、无构建脚本，正常情况下不需要。

### 1.2 或者用 CLI 转发给 pnpm

```bash
dsh plugin --profile <profile> add "/绝对路径/到/ziwei-workbench"
```

安装后检查 profile 里出现 `link:` 依赖（本机示例）：

```jsonc
// ~/.dsh/profiles/<profile>/package.json
{ "@local/ziwei-workbench": "link:/绝对路径/到/ziwei-workbench" }
```

### 1.3 重启并验证

```bash
# 手动重启 DSH（关闭后重新启动；不要由插件/脚本自动重启）
dsh --profile <profile> --dump-config | grep -F "# == @local/ziwei-workbench"
```

看到 `# == @local/ziwei-workbench` 这一行，说明 bundle 层被加载；在侧栏应出现
「紫微斗数 Pro」入口。

**开发时的构建**：改 `src/` 后先 `node build.mjs`，再按「Host 改重启 / Client 改刷新」生效。
`npm pack` 之前也要先 `node build.mjs`，否则打进去的是旧产物。

---

## 方式二：`plugin_manager install_bundle`（绝对目录 / tarball）

与方式一其实同一条通道，只是 target 可以是构建好的 tarball：

```text
plugin_manager({
  action: 'install_bundle',
  target: '/绝对路径/dist/dsh-ziwei/dsh-ziwei-1.2.0.tgz'
})
```

也可以在 DSH Web Plugins 页粘贴该 tarball 的路径。装完同样**手动重启 DSH**。

> tarball 由 `node scripts/release-pack.mjs` 生成（会先要求 `node build.mjs` 产物就绪）。
> 发布名与仓库内名不同：仓库内是 `@local/ziwei-workbench`，tarball 里是发布名
> （默认 `dsh-ziwei`）。两者不要混用。

---

## 方式三：npm + 插件索引（对外用户，发布后可用）

> 这一节假设维护者已经按 `docs/PUBLISHING.md` 把包发布到 npm。**未发布前该包不存在**，
> 请用方式一/二。

### 3.1 从 npm 安装

```bash
dsh plugin --profile <profile> add dsh-ziwei@1.3.1
```

或在 DSH Web **Settings → Plugins → Add plugin** 里输入包名安装。装完**手动重启 DSH**，
并在 `dsh --profile <profile> --dump-config` 里确认出现 `# == dsh-ziwei`。

### 3.2 通过插件索引（Discover）

若维护者提供了 **format-1 的 `index.json`**（见 `docs/PUBLISHING.md`）：

1. DSH Web → **Plugins → Discover → Add index source**；
2. 填入索引 URL（必须是可直接访问的 https 静态地址，不要跟随重定向，15s 超时）；
3. 在 Discover 里找到 Zi Wei Dou Shu Workbench → 安装 → **手动重启**。

没有索引也可以直接按 3.1 用包名安装。

---

## 卸载

```bash
dsh plugin --profile <profile> remove dsh-ziwei
# 本地 link 安装时用仓库名：
dsh plugin --profile <profile> remove @local/ziwei-workbench
```

或从 DSH Web Plugins 页移除。移除后**手动重启 DSH**。插件不写用户级全局配置；
浏览器端 `localStorage` 里的偏好/命盘库如需清除，在浏览器开发者工具里删除
`ziwei-pro.*` 键即可（旧版遗留的 `ziwei-workbench.apikey` 会在启动时被自动清理）。

## 常见问题

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 侧栏没有「紫微斗数 Pro」 | Host 半没生效 / bundle 层没加载 | 确认 `--dump-config` 有 `# == <包名>`；重启 DSH |
| 面板出现但排盘报错 | `engine-built.js` / `src/ziwei-core.js` 缺失（历史打包事故） | 重新安装；运行 `node verify/pack.mjs` 检查包内容 |
| 解读提示「未挂载 sessionController」 | profile 缺该服务 | 改用「读取工作台命盘上下文」：在会话里让 agent 调 `ziwei_context` |
| 解读一直「思考中」后中断 | 模型 `max-tokens` / 超时被截断 | 面板会保留已生成部分并给「继续生成」；看 `interpret-diag.log` 的 `finish=` |
| 装完没变化 | 只刷新了页面但改的是 Host 半 | 重启 DSH（Host 半在启动时装载） |
| `link:` 安装后改 `src/` 无效 | 忘了构建 | `node build.mjs`，再重启/刷新 |

更多排障：`SECURITY.md`（数据与权限边界）、`docs/ARCHITECTURE.md`（模块分工）。
