## 改了什么

<!-- 一句话说明这个 PR 的目标 -->

## 为什么

<!-- 关联 issue；说明要解决的真实问题。没有 issue 的小改动也请写动机 -->

Closes #

## 自检清单

- [ ] `node build.mjs && node verify/all.mjs` 全绿（或已说明为何需要 `ZIWEI_ALLOW_SKIP=1` 及跳过项）
- [ ] 改了 `src/` 的话，`client.js` / `engine-built.js` 已重新生成并一起提交（没有手改产物）
- [ ] 没有提交 `host-diag.log` / `interpret-diag.log` / `dist/` / `*.tgz` / `.ref/`
- [ ] 没有改 `package.json` 的 `name` / `private`（发布名由 `scripts/release-pack.mjs` 在 `dist/` 里改写）
- [ ] 没有改 `~/.dsh/profiles/*`、没有自动重启 DSH、没有执行 `npm publish`
- [ ] PR 里没有真实用户的生辰/姓名等敏感信息
- [ ] 若引入第三方代码或数据：已更新 `THIRD_PARTY_NOTICES.md` 并保留原始许可证全文

## UI 改动（有可视改动时必填）

<!-- 没改 UI 可删掉本节 -->
- 附浅色 + 深色截图或短录屏：
- 检查过的状态（勾选实际看过的）：
  - [ ] 窄 / 中 / 宽 三档面板宽度
  - [ ] 解读抽屉（流式中 / 停止 / 继续生成 / 错误条）
  - [ ] 设置弹层、Esc 关闭、焦点与键盘操作
  - [ ] macOS 折叠侧栏后「返回会话」可用、不盖住窗口控件
- 未做视觉复核的部分（如实说明）：

## 其他说明

<!-- 兼容性影响、已知限制、后续 TODO -->
