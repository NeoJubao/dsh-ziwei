# Contributing to Zi Wei Dou Shu Workbench

感谢你愿意贡献。这个仓库是一个 **单包 DSH（DeepSeek Harness）插件**：Host 半在 DSH
进程内注册工具/提示词/路由，Client 半是浏览器里的排盘工作台面板。以下规则不是流程表演，
都是这个项目真实踩过坑之后留下的。

## 环境要求

| 项 | 要求 |
| --- | --- |
| Node.js | **>= 22**（CI 覆盖 22 / 24） |
| npm | 随 Node 安装即可；本项目**零运行期依赖**，不需要额外安装 |
| DSH | `>= 0.2.1-rc.5 < 0.3.0`（声明在 `package.json.engines.dsh`，见 README 兼容性表） |

构建前置（自包含）：农历/节气数据表已封装在本仓库内，构建脚本**不读取插件目录之外的
任何本地路径**，干净检出上直接 `node build.mjs` 即可。CI 也是这样跑的。若构建提示缺少
数据表，说明 checkout 不完整，请重新检出，不要从本机其他目录手动补文件。

## 开发命令

在仓库根目录执行：

```bash
node build.mjs          # 由 src/ 生成 client.js（浏览器产物）与 engine-built.js（Node/host 产物）
node verify/all.mjs     # 全量自检（8 组，聚合列表见 verify/all.mjs）
node verify/pack.mjs    # 只查打包完整性（npm pack --dry-run，确认运行时文件都进包）
```

单独跑某一组自检时直接执行 `verify/` 下的脚本（如 `node verify/verify.mjs`）。
`npm pack` 之前必须先 `node build.mjs`，否则打进去的是旧产物。

### 关于 `ZIWEI_ALLOW_SKIP=1`

`verify/all.mjs` 里有一组自检依赖作者本机的 DSH 安装：

- `verify/verify-tools.mjs`：需要真实 `@deepseek-ai/dsh-tools` 运行时（按 `DSH_NODE_MODULES` /
  `DSH_PROFILE_DIR` / `DSH_HOME` / 常见安装位置自动探测）。

没有 DSH 的机器（例如公开 CI runner）上，设 `ZIWEI_ALLOW_SKIP=1` 会让它以专用退出码 **3**
表示「已显式跳过」，聚合器把它标成 ⚠️「已跳过，未验证」——不标绿、不算通过。

**差分测试（第 5 组）不需要这个开关**：仓库随附 `verify/fixtures/paipan-reference.json`
（20 个用例的期望输出，从来源产品 runner 捕获），无 runner 时自动走 fixture，照样真断言。
维护者本机有 runner 时自动优先用 runner；要重新捕获 fixture：

```bash
# 需要来源产品 runner（ZIWEI_RUNNER 或默认安装位置），只在维护者机器上执行
node verify/diff-runner.mjs --write-fixture
```

环境缺失时（runner 与 fixture 都没有）差分默认失败——这是刻意的：否则「排盘与来源产品
逐字段一致」这条保证会无声消失。

## 硬规则

1. **产物是构建出来的，不要手改。** `client.js` / `engine-built.js` 是 `build.mjs` 的输出；
   改 `src/` 后必须 `node build.mjs`，并**把重新生成的产物与源码一起提交**。
   `verify/verify.mjs` 会逐字节比较产物，手改或忘记重建都会红。
2. **UI 改动必须亲眼看。** 这是本项目反复吃亏的地方（历史上多次出现「自检全绿但界面是坏的」）。
   任何 `src/ui-pro.js` 的可视改动，PR 里必须附**浅色 + 深色**截图或一段短录屏，并写明检查过
   哪些状态：
   - 窄面板 / 中 / 宽三档（拖侧栏改变可用宽度）；
   - 解读抽屉、设置弹层、流式中 / 停止 / 继续生成 / 错误条；
   - macOS 桌面端折叠侧栏后，面板左上角「返回会话」可用、不盖住窗口控件。
   没有实机截图时，请明确写「未做视觉复核」，不要用「应该没问题」代替。
3. **不改仓库的本地身份。** `package.json` 的 `name=@local/ziwei-workbench` 与 `private=true`
   是本机 DSH profile `link:` 挂载的前提；改它会直接搞坏运行中的插件。对外发布名由
   `scripts/release-pack.mjs` 在 `dist/` 副本里改写（见 `docs/PUBLISHING.md`）。
4. **不碰用户环境。** 不要在 PR 里要求改 `~/.dsh/profiles/*`、不要自动重启 DSH、
   不要新增会修改用户全局配置的脚本。安装/重启类操作一律由人手动执行。
5. **不发布。** 本仓库的发布是维护者的动作：`release-pack.mjs` 只生成 tarball，
   `.github/workflows/release.yml` 需要人工确认 + npm OIDC 配置。贡献者不要调用 `npm publish`。
6. **不提交运行时垃圾。** `host-diag.log`、`interpret-diag.log`、`dist/`、`*.tgz`、`.ref/`
   已在 `.gitignore` 里；不要 `git add -f` 绕过。
7. **改前先看文档。** 架构看 `docs/ARCHITECTURE.md`，安装看 `docs/INSTALL.md`，
   发布看 `docs/PUBLISHING.md`；历史问题看 README「口径与踩过的坑」和 内部审计底稿（只读历史，
   不要改审计报告）。

## 新增自检脚本

- 放在 `verify/`（或 `scripts/`，如果是对外工具），用 ESM，**不引入第三方依赖、不联网、不启动 GUI**。
- 输出风格与现有脚本一致：`== 标题 ==`、逐项 `✅ / ❌`，最后一行 `N 通过, M 失败`；
  退出码 `0` 全通过 / `1` 失败 / `3` 显式跳过（仅当环境缺失且调用方接受跳过时）。
- 不要自行改 `verify/all.mjs` 的聚合列表——由维护者接线，避免并发冲突和意外退绿。
- 能静态检查的就不要写运行时测试；能离线复现的就不要依赖本机路径。

## 提交与 PR

- 提交信息用 Conventional Commits 风格，简版即可：
  `fix: 侧栏折叠后无法返回会话`、`docs: 补充安装方式`、`chore: 更新 notices`。
- 一个 PR 一件事；不要顺手改无关文件、不要格式化整个文件制造大 diff、不要升版本号
  （版本由维护者在发布前统一决定）。
- PR 模板里的自检清单请逐条勾选；CI 是底线，不是替代品。
- 涉及排盘结果变化的改动，请附上受影响用例（日期 / 时间 / 性别 / 经度）与前后对比。

## 隐私

- issue / PR / 截图里**不要**放真实生辰、真实姓名、住址或经度等可识别信息；复现请用
  黄金用例（1992-05-03 09:30 男 经度 105.97）或自造数据。
- 诊断日志里不要贴用户会话内容；`interpret-diag.log` 只记录模型/档位/预算/结束原因/用量。

## 许可证

提交贡献即表示你同意以本仓库的 **MIT** 许可证发布你的贡献（见 `LICENSE`）。
引入第三方代码/数据前必须先补 `THIRD_PARTY_NOTICES.md`（保留原始许可证全文与来源），
并在 PR 里说明。不要引入来源不明或许可不兼容的素材（图标、字体、文案、数据表）。
