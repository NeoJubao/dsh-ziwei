# 计划：v6 真机反馈后的第二轮打磨

- spec：[docs/specs/2026-11-20_v6-polish.md](../specs/2026-11-20_v6-polish.md)
- 分支：`feature/v6-redesign`（接着做，不 push）
- 每个任务以一次提交结束，提交前过 `node build.mjs && node verify/all.mjs`

## 根因（2026-11-20 查到的）

| 现象 | 根因 | 证据 |
|---|---|---|
| 输入框两层框 | `.zp-root :focus-visible { outline-style: solid }` 的优先级（0,2,0）高过各输入框自己的 `outline: none`（0,1,1），而 `outline: none` 又把宽度、颜色重置成 `medium` / `currentColor`：聚焦时画出一圈 3px、文字色的方框，叠在圆角容器的描边里 | 预览壳补上宿主的 `focus.css` 后复现：`scratchpad/r2-02-home-focus.png` |
| 关 3D 后右上角点不动 | 没有 3D 时 `.zp-sky` 是 `position: relative; z-index: 4; pointer-events: auto`，`.zp-home` 自己不成层叠上下文，于是它盖过了 `z-index: 2` 的顶栏 | `css/60-home.css` |
| 「模型返回为空」 | `deepseek-official/deepseek-flash` 那一次正常结束（`finish=stop`），思考 408 字、正文 0 字。Host 把它当错误直接返回，没有重试；提示词也没说寒暄怎么回 | `interpret-diag.log` 2026-11-20T12:58:12Z |

## 任务

- [x] P1 配色和主题：`--dsw-alias-*` → `--zp-*`、`data-theme`、偏好 `theme`、设置里的「外观」；约定文档和体检脚本同步
- [x] P2 焦点：输入框只有一处高亮；按钮的焦点框
- [ ] P3 顶栏去掉「返回会话」，出口放进设置和错误页；首页层叠（关 3D 后顶栏可点）；首页输入框下面的空行
- [ ] P4 Host：`/ziwei/models`、`model` 覆盖、空答重试、寒暄规则
- [ ] P5 模型选择：偏好、store、模型按钮、模型弹层
- [ ] P6 紫微师输入区重做、引导常驻、空答的错误条
- [ ] P7 命盘页：格局进中宫、连线不压字、时间条、宫位卡
- [ ] P8 预览壳逐屏复核、版本号和更新日志、收尾

## 复核记录

（做完后填：看过什么、量过什么、没验证什么）
