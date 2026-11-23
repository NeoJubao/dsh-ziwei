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

## 5. three.js r128 — MIT（首页 3D 场景，代码随包分发）

- 上游项目：<https://github.com/mrdoob/three.js>
- 版本：`r128`（0.128.0）的 UMD 压缩版 `build/three.min.js`，603,445 字节
- 取得方式：<https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js>，
  SHA-384（base64）`CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu`，与 cdnjs 公布的 SRI 一致
- 在本仓库的位置：`vendor/three-r128.min.js`（逐字节原样，不修改）；`build.mjs` 把它拼进 `client.js`，
  包在一个懒加载函数里，只在首页 3D 星图第一次显示时执行
- 用途：场景管理、PBR 金属材质和环境贴图预滤波。星球、尘埃盘、星云和后期处理的着色器是本项目自己写的
- 为什么这样引入：见 `docs/adr/0004-vendored-three-for-home-scene.md`。`package.json` 没有因此增加任何依赖
- 许可：MIT。按 MIT 条款，以下版权声明与许可全文必须随任何副本分发。

```text
The MIT License

Copyright © 2010-2021 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

---

## 6. GeoNames — CC BY 4.0（出生城市的经度，数据随包分发）

- 来源：GeoNames 地名数据库 <https://www.geonames.org/>，国家导出文件 `CN.zip` 和 `TW.zip`
  （<https://download.geonames.org/export/dump/>，2026-11-23 的导出，2026-11-24 取得）
- 在本仓库的位置：`src/ui/20-util.js` 的 `CITY_TABLE`（出生城市 → 东经），构建后在 `client.js` 里
- 用了什么：表里比 v5 多出来的 262 个城市的经度。取各地级单位驻地那条记录（GeoNames 的
  PPLC / PPLA / PPLA2 等）的经度，四舍五入到 0.1°
- 做了哪些改动：只取经度一项并四舍五入；城市名单、省份分组和中文简称是本项目自己列的；
  本溪、潜江、天门三处按名字自动匹配到的是同名的县驻地或区划中心点，改用 GeoNames 里市区那条记录的值
- 没用它的部分：v5 就有的 94 个城市是此前自编的值，没有取自 GeoNames（只拿它核对过，差都在 0.2° 以内）
- 仓库和分发包里都不包含 GeoNames 的原始文件
- 许可：Creative Commons Attribution 4.0 <https://creativecommons.org/licenses/by/4.0/>。
  GeoNames 按「现状」提供数据，不对准确性、时效性和完整性作任何担保

---

*本文件随 npm 分发包一起发布（发布脚本会把本文件加入包内文件清单）。*
