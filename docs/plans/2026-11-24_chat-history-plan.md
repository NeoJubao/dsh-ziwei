# 实现计划：按命盘的历史对话

- Spec：[docs/specs/2026-11-24_chat-history.md](../specs/2026-11-24_chat-history.md)
- 分支：`feat/chat-history`（叠在 `feat/solar-time-option` 上，见下面「分支」）
- 执行方式：单个会话，一个任务一个提交，上一个全绿再做下一个

## 分支

Plan mode 里说的是两个分支都从 `main` 起。实际改成叠在 `feat/solar-time-option` 上：DSH 用 `link:` 挂的就是这个工作目录，
从 `main` 起的话工作区里没有功能一的修复，重启 DSH 验证报告时测不到。合并时先合 `feat/solar-time-option`，再合这个分支。

## 全局约束

- `ziwei-pro.readings.v2` 的记录格式不改；历史只新增 `ziwei-pro.chats.v1`。
- 只改 Client 半。
- 任务在跑时不能开新对话、不能切对话。
- 不手改 `client.js`、`engine-built.js`；不重启 DSH、不发布、不 push。
- 测试只用黄金用例（1992-05-03 09:30，男，经度 105.97）。

## 文件清单

| 文件 | 新建或修改 | 负责什么 |
|---|---|---|
| `src/ui/21-storage.js` | 修改 | `chats` 的读写、上限、配额回退、清除；`READINGS_MAX` |
| `src/ui/26-store.js` | 修改 | reading 的 `chats`、`newChat` / `openChat` / `removeChat`、`session.asHistory` |
| `src/ui/80-assistant.js` | 修改 | 头部按钮、历史列表 |
| `src/ui/50-parts.js` | 修改 | `history` 图标 |
| `src/ui/css/80-assistant.css` | 修改 | 历史列表的样式 |
| `src/ui/i18n/80-assistant.json`、`26-store.json` | 修改 | 文案 |
| `docs/ui-contract/layout.md` | 修改 | ASSISTANT 一行 |
| `verify/ui-v6-storage.mjs`、`ui-v6-store.mjs`、`ui-v6-assistant.mjs` | 修改 | 新断言 |
| `CHANGELOG.md` | 修改 | 未发布一节 |

## 任务

每个任务都是：先写失败的断言 → 运行确认失败 → 实现 → `node build.mjs && node verify/all.mjs` 全绿 → 提交。

### 任务 1：存储
- [x] 断言（`ui-v6-storage.mjs`）：spec §3.1
- [x] `api.chats`、`clearLocalRecords`、`READINGS_MAX`

### 任务 2：store
- [x] 断言（`ui-v6-store.mjs`）：spec §3.2
- [x] reading 的 `chats`、三个动作、`session.asHistory`

### 任务 3：界面
- [x] 断言（`ui-v6-assistant.mjs`）：spec §3.3
- [x] 图标、头部按钮、`AssistantHistory`、样式、文案、`docs/ui-contract/layout.md`

### 任务 4：收尾
- [x] `CHANGELOG.md`
- [x] 预览壳里看历史列表：浅色和深色、窄中宽

## 执行记录（2026-11-24）

- 任务 1–4 都做完了，每个任务一个提交，每次提交前 `node build.mjs && node verify/all.mjs` 全绿（唯一的 ⚠️ 是本机没有独立版
  `run-paipan.js`，原本就是可选的）；`node verify/pack.mjs` 9 项通过，`node scripts/audit-ui.mjs` 18 项通过
  （它拦下过一处不在间距档位里的 10px，改成了 8px）。
- 和 spec 相比多做的两处，都是写的时候想到的失败情况：
  - 历史怎么都写不下时（配额满），已经存好的别的盘的历史原样不动，`save` 返回 false。一开始的写法会把它们一条条去掉、最后连键都删了。
  - 历史写不进去时「新对话」照样能开，那条对话留在本次会话里，提示里明说没存下来。
- 另外改了：头部的「历史对话」开着时有按下的样子；点开时焦点留在这个按钮上（输入框连同里面的焦点一起卸掉了）。
- README 和 `docs/ARCHITECTURE.md` 里「最多 8 张盘」「新对话清空对话」的说法改了；README 里出生城市和真太阳时可选的说明是功能一的，
  也在这个分支的同一个文档提交里补上了。
- 视觉：在本机预览壳里看过历史列表（当前和历史各一条、长标题截断、按下状态、空列表之前的各个状态），深色宽 / 中、浅色窄截图看过；
  浅色宽 / 中、深色窄没有单独看。在预览壳里实际走过一遍：提问 → 新对话 → 再提问 → 历史对话 → 切回旧的那条 → 刷新页面后历史还在。
- 一件没查清的事：中档下有一次截图时紫微师面板是关着的（脚本结束时它还开着、列表也在）。之后带着事件记录按同样的步骤重跑了两次
  （一次从头加载，一次原地），面板都一直开着，记录里也没有多余的点击、按键或尺寸变化。没能复现，原因不明；
  那个浏览器窗口是可见的，不排除当时有真实的点击或按键落在遮罩上。
- **没验证的**：未在 DSH 真机复核（不重启 DSH）。这个功能只改了 Client 半，重新加载面板就能看到。

## 审查重点

- 这张盘没有当前对话和报告、只有历史：`readings.v2` 里没有它的记录，历史仍然要读得到。
- 切对话时当前对话只有一句没答上来的提问（出错后）：也要进历史，不能丢。
- 撤销删除时这条历史已经因为别的操作回来了（同一个 id 已在列表里）：不能出现两份。
- 改生辰之后命盘 key 变了：旧 key 下的历史留在原处（和对话、报告现在的规则一样）。
- 两个 DSH 窗口同时开着同一张盘：后写的覆盖先写的（现有的对话和报告也是这样），不做合并。

## 风险与回滚

- 风险：本机存储和 DSH 共用一个源的配额。兜底是每张盘 20 条、每条 24 条消息、写不下时去掉最旧的。
- 回滚办法：每个任务一个提交，可以单独 `git revert`。回滚后 `ziwei-pro.chats.v1` 留在本机，不读不写，不影响别的记录。

## 验证

- 全量：`node build.mjs && node verify/all.mjs`，`node verify/pack.mjs`，`node scripts/audit-ui.mjs`
- 人工：预览壳里看浅色和深色、窄中宽三档；DSH 真机由 Neo 重启后看
