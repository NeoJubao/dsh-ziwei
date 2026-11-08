# Third-Party Notices / 第三方作品声明

本项目（Zi Wei Dou Shu Workbench，紫微斗数工作台）以 **MIT** 许可证发布，见 [LICENSE](./LICENSE)。
下列第三方作品按各自许可证被使用；本文件不改变、也不扩大其许可条款。

> 机器可校验标记（`scripts/release-pack.mjs` 会检查）：`solarlunar`、`ISC`、`yize`、`3.1.0`。
> 修改本文件时请保留这三段（solarlunar 许可全文 / 参考实现声明 / 图标字体声明）的结构。

---

## 1. solarlunar 3.1.0 — ISC（数据表来源，必附全文）

- 上游项目：<https://github.com/yize/solarlunar>
- 版本：`3.1.0`（本项目实际抽取的版本）
- 用途：构建脚本 `build.mjs` 从该包的 ESM 产物 `dist/solarlunar.esm.js` 中**抽取数据表**，
  注入到构建产物 `engine-built.js` 与 `client.js`：
  - `lunarInfo`：农历年数据表，201 项；
  - `lTermInfo`：二十四节气数据表，201 项。
  构建脚本会校验两项均为 201 项，数量不符直接失败。
- 许可：ISC。按 ISC 条款，以下版权声明与许可全文必须随任何副本分发。

```text
ISC License

Copyright (c) 2015, yize

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

---

## 2. 算法对照与验证参考（未复制代码）

以下项目只作为排盘输出的逐字段对照/交叉核对基准。本项目的引擎与数据表为独立实现，
**未复制**其源代码；因此不附其许可证全文，仅按学术与工程惯例致谢（MIT 要求保留的是
被复制/实质性使用部分的版权声明，本项目未复制）。

- **iztro 2.6.1**（MIT，Copyright (c) 2023 All Contributors）— <https://github.com/SylarLong/iztro>
  用途：`src/engine-core.js` / `src/ziwei-core.js` 的安星结果与 iztro 逐字段对齐验证
  （庙旺表曾按其逐格校正）。仅作验证基准，运行时不需要该依赖。
- **lunar-lite 0.2.8**（MIT，Copyright (c) 2023 Sylar）— <https://github.com/SylarLong/lunar-lite>
  用途：农历转换的交叉核对参考。仅作验证参考，未打包其代码、运行时不需要该依赖。

若后续维护者从上述项目复制了任何代码或数据片段，必须把对应的 MIT 许可全文补到本节。

---

## 3. 图标与字体

- `icon.svg`：本项目自绘几何图形（同心圆 + 星形路径 + 圆点），随仓库许可证发布。
  **TODO（作者确认）**：若该图标曾参考/改编自第三方素材，请在此补上该素材的来源与许可证。
- 字体：本项目**未打包任何字体文件**。界面使用 DSH 主题字体变量与系统字体栈
  （`var(--dsh-font-family-text-default, -apple-system, BlinkMacSystemFont, "PingFang SC", …)`），
  不涉及字体授权。

---

## 4. 内容与声明

- 紫微斗数安星规则基于明代公版典籍《紫微斗数全书》，属公有领域的方法与规则；
  本项目的人设、报告结构、提示词与代码为作者原创（来源产品为作者内部实现，未随仓库分发）。
- 本项目不包含任何商业命理产品的素材、报告模板或授权内容。

---

*本文件随 npm 分发包一起发布（发布脚本会把本文件加入包内文件清单）。*
