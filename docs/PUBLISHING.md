# 发布 / Publishing

本文是维护者发布插件的手册。**普通贡献者不需要读**，也不要执行
`npm publish`、不要改本机 profile。

>

## 0. 先明确两条底线

1. **仓库里的包名不动。** `package.json` 的 `name=@local/ziwei-workbench` 与
   `private=true` 是本机 DSH profile `link:` 挂载的前提。对外发布名由
   `scripts/release-pack.mjs` 在 `dist/` 发布副本里改写，**仓库文件一个字节不改**。
2. **本机 profile 不做改动。** 发布脚本只写 `<repo>/dist/`；不碰 `~/.dsh/profiles/*`、
   不执行 `dsh plugin add`、不重启 DSH、不调用 `npm publish`。发布是独立动作。

## 0.5 发布前人工闸门（全过才可公开 / 发布）

以下 7 项**不由脚本代替判断**。工程侧已完成项用 `[x]`，需要人确认的保持 `[ ]`：

- [ ] **真机视觉验收**：按 `docs/design/v3-review-checklist.md` 在真实 DSH 宿主走查浅/深色、
      darwin 侧栏折叠、窄屏、键盘；本机渲染 harness 的截图不能替代这一步。
- [x] **内容再分发授权**：2026-11-08 作者确认「紫微师 / 金聚」为自有内容，可随 MIT 仓库分发
      （人设 / 九诀 / 鲲鹏 14 部分 / 红线，见 `src/ziwei-core.js` 与 `index.js` 系统提示词）。
- [x] **差分 fixture 来源确认**：`verify/fixtures/paipan-reference.json` 由自有「紫微师」产品 runner
      捕获（20 用例），作者确认可公开；如需更保守，可改用 iztro（MIT）重生成。
- [x] 私密路径脱敏：`verify/runner-path.mjs` 已改为 env / `.ziwei-runner/` / `~/ziwei-runner/`；
      内部审计底稿 已 gitignore，不进入公开仓库。
- [x] **仓库元信息确认**：owner `NeoJubao`，仓库 `https://github.com/NeoJubao/dsh-plugin-ziwei-workbench`
      （private）；发布名默认 `dsh-plugin-ziwei-workbench`；版权人 `Neo / 2026`。
      本机 `gh api user` 实际登录为 `NeoJubao`（keyring 标签显示旧名，属显示问题）。
- [ ] **联系方式**：在 GitHub 仓库 Settings → Code security 手动开启 Private vulnerability reporting /
      Security Advisories（REST API 对 private repo 返回 404，需网页操作）；文档已不再留占位邮箱。
- [x] **干净环境安装冒烟（配置层）**：2026-11-08 用 `DSH_HOME=/tmp/dsh-smoke-home` 新建 `smoke` profile，
      对发布 tarball 执行 `dsh plugin --profile smoke add <tgz>`，`dsh --profile smoke --dump-config`
      已出现 `# == dsh-plugin-ziwei-workbench` 与 bundle 行；**未做 GUI 启动/点击**。
      正式发布前建议再做一次带界面的启动冒烟（同样用临时 DSH_HOME，不碰现有 profile）。

## 0.6 远端仓库状态（2026-11-08）

- 本地 `git init -b main`，首次提交 `75ec44f`；`audit/`、`dist/`、`*.log`、`.ref/`、
  `.ziwei-runner/` 均被 gitignore，未入库（62 文件 / 约 2.35 万行）。
- 已创建 **private** 仓库并推送 `main`：`https://github.com/NeoJubao/dsh-plugin-ziwei-workbench`。
- **CI 已绿**：三平台 × Node 22/24（run `42480774977`，workflow `ci.yml`）；
  Windows 的两处兼容问题（动态 import 的 file:// URL、npm.cmd 调用）已在主分支修复。
- 已加 topics：`dsh-plugin`、`dsh`、`deepseek-harness`、`ziwei`、`ziwei-doushu`。
- 发布 tarball 由 `node scripts/release-pack.mjs` 生成（`dist/`，gitignored）。
- **仓库仍为 private**；转 public 需先完成真机视觉验收 + 真实截图 + 开启私密漏洞报告。

## 0.7 命名分层（为什么仓库叫 dsh-plugin-*，而 package.json 还叫 @local/*）

DSH 生态的命名约定：npm 包用 `dsh-plugin-<name>`（或 `@user/dsh-<name>`），GitHub 仓库加
`dsh-plugin` topic。本仓库有四个名字，各有各的用途，不要混：

| 层 | 名字 | 作用 | 是否对外 |
|---|---|---|---|
| GitHub 仓库 | `NeoJubao/dsh-plugin-ziwei-workbench` | 代码托管与发现 | 是 |
| npm 发布包 | `dsh-plugin-ziwei-workbench` | `dsh plugin add` / 插件索引 | 是 |
| 仓库内 package.json | `@local/ziwei-workbench`（`private: true`） | 本机 profile `link:` 挂载的前提；**不能改**，改了正在用的插件会失效 | 否 |
| 插件显示名 | 紫微斗数 Pro / 紫微斗数工作台（`locale/*.json`） | Plugins 页、侧栏入口 | 是 |

发布脚本会在 `dist/` 副本里把仓库内包名改写成 npm 发布名，并同步 `cordis.patch.yml` 与
`client.js` 的模块 id；仓库文件一个字节不改。

## 1. 发布包名

二选一，本仓库默认选 **A**：

| 方案 | 名字 | 优缺点 |
| --- | --- | --- |
| **A（默认）** | `dsh-plugin-ziwei-workbench` | 无 scope，任何有 npm 账号的人都能直接发布；名字本身带 `dsh-plugin`，利于搜索 |
| B | `@neojubao/ziwei-workbench` | 需要拥有对应 npm scope；更短，但需要额外维护 scope 权限 |

切换方式：`node scripts/release-pack.mjs --name @neojubao/ziwei-workbench`，
或修改脚本顶部 `DEFAULT_PUBLISH_NAME`。显示名与图标不取决于包名：
Plugins 页和插件索引读的是 `locale/*.json` 的 `meta.title/meta.description` 与 `icon`。

## 2. 生成发布副本

```bash
# 1) 先构建（产物提交进仓库；npm pack 前必须是最新产物）
node build.mjs

# 2) 只打印计划，不写任何文件、不执行 npm pack
node scripts/release-pack.mjs --dry

# 3) 真正生成 dist/ 并打包 tarball（仍不发布）
node scripts/release-pack.mjs
```

脚本会做这些事：

- 按 `package.json.files`（含目录与 `dir/*.ext` glob）+ 必附文件复制到
  `dist/<发布包名>/`，必附 `README.md`、`LICENSE`、`THIRD_PARTY_NOTICES.md`、`CHANGELOG.md`；
- 发布副本里改写：`name` → 发布名、`private` → `false`、`publishConfig.access` → `public`、
  `files` 增补必附文件；
- 同步改写三处身份（漏一处就会「装上了不生效」）：
  1. `package.json.name`
  2. `cordis.patch.yml` 的 `name:`
  3. `client.js` 里 `__ModuleLoader__` 的 `id:`（DSH 用解析后的包名标识浏览器模块）
- 校验：`LICENSE` 是 MIT、`THIRD_PARTY_NOTICES.md` 含 solarlunar ISC 全文标记
  （`solarlunar`/`ISC`/`yize`/`3.1.0`）、README 与 docs 无本机绝对路径、
  `dsh.bundle`/`dsh.client`/`dsh.manifestVersion` 齐全；
- 执行 `npm pack` 生成 tarball（**不执行 `npm publish`**）。

产物示例：

```text
dist/dsh-plugin-ziwei-workbench/
├── package.json          # 发布名 / private=false / access=public
├── cordis.patch.yml      # name 已同步
├── client.js             # 模块 id 已同步
├── index.js, engine-built.js, src/…, locale/…, icon.svg
├── LICENSE, THIRD_PARTY_NOTICES.md, README.md, CHANGELOG.md
└── dsh-plugin-ziwei-workbench-1.2.0.tgz
```

## 3. 发布前必须完成的一次性配置（npm OIDC）

发布工作流 `.github/workflows/release.yml` **默认不会执行**：它需要人工触发 +
人工确认 + 以下配置全部就位。缺任何一项，它都不会发布任何东西。

1. **npm Trusted Publishing**：在 npmjs.com 打开该包 → Settings → Publishing access →
   Trusted Publisher 选 GitHub Actions，填：
   - Organization or user：`<GitHub owner>`
   - Repository：`ziwei-workbench`
   - Workflow filename：`release.yml`
   - Environment：`npm-publish`
   （即 OIDC 发布，不使用长期 npm token。）
2. **GitHub Environment**：仓库 → Settings → Environments → 新建 `npm-publish`，
   配置 **Required reviewers**（发布前必须有人点批准）。
3. **仓库 Variables**：Settings → Variables → 新建 `RELEASE_ENABLED = 1`。
4. **版本与标签**：把 `package.json` 的 `version` 升到本次发布版本（SemVer，
   由维护者决定；**当前仓库保持 1.2.0 不受发布流程影响**），然后：
   ```bash
   git tag -a v<version> -m "v<version>"
   git push origin v<version>
   ```
5. **Actions 权限**：release.yml 已声明 `id-token: write` + `contents: write`；
   若组织策略禁用了 OIDC，需要组织管理员放行。

### 触发发布

GitHub → Actions → **Release** → Run workflow：

- `confirm` 输入 `PUBLISH`（其他值直接跳过）；
- `npm_tag` 默认 `latest`（预发可填 `next` / `alpha`）。

工作流会：构建 → 全量自检（`ZIWEI_ALLOW_SKIP=1`，只让 verify-tools 在无 DSH 的
runner 上标「已跳过」）→ 生成 dist 发布副本 → 校验 `v<version>` 标签在 HEAD 上 →
`npm publish ./dist/<包名> --provenance --access public` → 创建 GitHub Release。

### 手动发布（备用路径）

如果暂时不配 OIDC，也可以在可信机器上手动执行（需要 npm 2FA 与发布权限）：

```bash
node build.mjs
node scripts/release-pack.mjs
npm publish "./dist/dsh-plugin-ziwei-workbench" --access public
```

> 手动发布没有 `--provenance` 证明，安全性弱于 OIDC；发布后建议在 npm 页面补上
> Trusted Publishing，后续版本走 workflow。

## 4. 发布后验证

```bash
# 1) npm 上确实有该版本
npm view dsh-plugin-ziwei-workbench version dist-tags

# 2) 装进一个一次性 profile 并确认 bundle 层生效（不要用生产 profile）
dsh plugin --profile oss-test add dsh-plugin-ziwei-workbench@<version>
dsh --profile oss-test --dump-config | grep -F "# == dsh-plugin-ziwei-workbench"

# 3) 启动一次，确认侧栏出现「紫微斗数 Pro」
```

## 5.（可选）自建 format-1 插件索引

DSH 没有官方插件市场，但 `plugin_market` / Plugins → Discover 支持第三方索引：
一份 **format-1 JSON**，source 只支持 npm 或 git(commit pin)。

最小示例（字段以官方 `dsh-plugin-market-index` 为准，`publishTimestamp` 用毫秒时间戳）：

```json
{
  "format": 1,
  "title": "Zi Wei Dou Shu Workbench",
  "description": "紫微斗数排盘工作台（DSH 插件）",
  "metadata": { "categories": ["astrology"], "labels": ["ziwei"], "sortKeys": ["ziwei-workbench"] },
  "plugins": [
    {
      "name": "dsh-plugin-ziwei-workbench",
      "title": "紫微斗数工作台",
      "icon": "https://example.com/icon.svg",
      "author": "Neo",
      "homepage": "https://github.com/NeoJubao/dsh-plugin-ziwei-workbench#readme",
      "repository": "https://github.com/NeoJubao/dsh-plugin-ziwei-workbench",
      "metadata": { "categories": ["astrology"], "labels": ["ziwei"] },
      "dist-tags": { "latest": "1.2.0" },
      "versions": [
        {
          "version": "1.2.0",
          "publishTimestamp": 0,
          "source": { "type": "npm" },
          "engines": { "dsh": ">=0.2.1-rc.5 <0.3.0" }
        }
      ]
    }
  ]
}
```

托管建议：

- 静态托管（GitHub Pages / 对象存储）都可以；**Host 不跟随重定向、默认 15s 超时、
  最大 128MiB**，GitHub Pages 在慢网络下可能超时。
- 社区常用做法：把 `index.json` 作为 npm 包发布，用 jsDelivr 托管
  （`https://cdn.jsdelivr.net/npm/<pkg>/index.json`），绕开 15s 限制。
- 用户侧：Plugins → Discover → Add index source → 填 URL → 安装 → 手动重启。

## 6. GitHub 仓库设置（发布后）

- **Description**：一句话（含「DSH 插件」「紫微斗数」）。
- **Topics**：`dsh-plugin`（官方用来发现插件）、`deepseek-harness`、`ziwei`、`doushu`、`astrology`。
  官方 CONTRIBUTING 明确把「给仓库加 `dsh-plugin` topic」列为主推的社区贡献方式。
- **Security**：开启 GitHub Security Advisories（`SECURITY.md` 的私密报告入口依赖它）。
- **Releases**：release.yml 会用 `gh release create` 创建 Release 与 tarball 附件。

## 7. 发布前 checklist

- [ ] `node build.mjs && node verify/all.mjs` 全绿（CI 里 `verify-tools` 在无 DSH 环境会标「已跳过」，属预期）
- [ ] `node scripts/release-pack.mjs --dry` 通过（README/docs 无本机绝对路径、notices 标记齐全）
- [ ] `engines.dsh` 覆盖本次声明支持的 DSH 版本；兼容性表已更新
- [ ] `cordis.patch.yml` 的 `name` 与发布包名一致（发布副本由脚本自动改，检查 `dist/` 里的内容）
- [ ] `client.js` 的模块 `id` 与发布包名一致（同上）
- [ ] `locale/en.json` + `locale/zh.json` 的 `meta.title/description` 齐全
- [ ] `THIRD_PARTY_NOTICES.md` 含 solarlunar ISC 全文；`LICENSE` 年份/署名正确
- [ ] README 无本机路径、无内部产品名；截图/录屏是当前版本（暂缺时已明确标注「待补」）
- [ ] `npm pack` 文件清单无日志、无 `.ref`、无私有目录（`verify/pack.mjs` 有断言）
- [ ] 版本号已升、`v<version>` 标签已推送；npm Trusted Publisher / Environment / Variables 已配置
- [ ] 发布后按第 4 节在一个**一次性 profile** 里验证安装与层生效
