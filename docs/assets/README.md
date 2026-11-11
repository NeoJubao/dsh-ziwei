# 截图与演示素材（待补）

README 顶部的截图位需要真实界面截图。**当前仓库还没有这些文件**，README 里只放了
占位注释，没有用假图。补齐方式如下。

## 待补清单

| 文件 | 内容 | 尺寸建议 |
| --- | --- | --- |
| `screenshot-light.png` | 浅色主题：已出盘的完整工作台（盘面 + 十二宫 + 右侧详情） | 宽 1600–1920，PNG |
| `screenshot-dark.png` | 深色主题：同一张盘 | 同上 |
| `screenshot-interpret.png` | 解读抽屉打开、流式中或已完成 | 裁到面板区域 |
| `demo.gif` | 10–15s：填生辰 → 排盘 → 切宫位 → 打开解读抽屉 | 宽 960，≤ 8 MB |

命名固定，README 之后按这些文件名引用；market index 的 `icon` 仍用 `icon.svg`，不要用截图。

## 怎么录（可复现）

1. 起一个干净 profile（不要用日常使用的那个），装本地插件：
   `dsh plugin --profile demo add "/绝对路径/到/ziwei-workbench"`，然后手动重启 DSH。
2. 用固定黄金用例排盘，保证截图可复现：
   **1992-05-03 09:30 男，出生地经度 105.97**。
3. 截图：只截插件面板区域，不要带无关会话内容；浅色/深色各一组。
4. 录屏转 GIF（macOS 可用 QuickTime 录屏 + ffmpeg）：
   `ffmpeg -i in.mov -vf "fps=12,scale=960:-1" -loop 0 demo.gif`
5. 放到本目录后，更新 README 的截图位（去掉 HTML 注释占位）。

## 注意

- 截图里**不要出现真实姓名、真实生辰、工作区路径**；用黄金用例或自造数据。
- 界面改动后旧截图会过期：发版前重录，或在 README 标注「截图非最新版本」。
- 本目录只放界面素材，不放构建产物、日志或凭据。

## 现有截图

均为 2026-11-08 在真实 DSH 宿主（macOS，浅色主题，1280×820 窗口 @2x）抓取：

- `screenshot-light.png`：本命盘工作台（示例生辰排盘后的完整面板）。
- `screenshot-ai.png`：「紫微师 · 直接聊」抽屉，选中示例问题「这个大限要注意什么」后的回答。
- `screenshot-sidebar.png`：DSH 左侧栏局部，显示「紫微斗数 Pro」入口。

深色主题、侧栏折叠、窄屏截图待补；渲染预览见 `docs/design/assets/`（本地渲染）。

## v4 截图（2026-11-11，无头 Chrome 渲染真实 client.js）

用 `/tmp` 下的无头 Chrome harness 物化真实 `client.js`（假 ModuleLoader + React + 假 SSE）截取，
固定示例生辰 1992-05-03 09:30 男 / 经度 105.97；不含真实客户信息：

| 文件 | 内容 |
|---|---|
| `v4-home.jpg` | 首页：Hero + 我的命盘卡片 |
| `v4-create.jpg` | 新建命盘表单页 |
| `v4-chart.jpg` | 命盘页：Hero + 时间栏 + 盘面 + 详情 |
| `v4-reading-empty.jpg` | 解读页空态：聊天引导 + 报告工位 |
| `v4-reading-answer.jpg` | 解读页：速览回答 |
| `v4-report-progress.jpg` | 报告生成中：章节进度 / 字数 / 停止 |
| `v4-report-dock.jpg` | 报告完成卡：全屏阅读 / 导出 / 复制 |
| `v4-reader.jpg` | 报告全屏阅读页 |
| `v4-reader-dark.jpg` | 深色主题下的报告阅读页 |

录屏与真机截图仍建议在干净 profile 里补；v4 这批用于文档与 PR 说明，不替代真机走查。
