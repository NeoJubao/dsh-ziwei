# Security Policy / 安全说明

## 支持范围

| 版本 | 是否接受安全修复 |
| --- | --- |
| 最新发布版（`npm` 上的 latest） | ✅ |
| 更早版本 / 未发布的分支 | ❌（请先升级；本插件跟随 DSH preview 版本节奏，不回退维护旧版） |

## 如何私下报告漏洞

**不要用公开 issue 报告安全问题。** 请优先使用仓库的
**GitHub Security Advisories**（仓库 → Security → Report a vulnerability），
这样报告、讨论和修复都在私下进行，修复发布后再公开。

Private vulnerability reporting 已在本仓库开启。如果 GitHub 入口暂时不可用，可邮件联系
**neo2025new@gmail.com**（标题写 `[SECURITY]`）；**不要用公开 issue**。

请在报告里尽量包含：受影响的版本、DSH 版本与操作系统、复现步骤、影响面（数据泄露 / 命令执行 /
拒绝服务等）、以及你希望的处理方式。**不要在报告里附带真实用户的生辰数据**，用黄金用例复现即可。

## 威胁边界（如实说明）

这个插件不是一个独立服务，它的安全边界由 DSH 决定：

- **Host 半运行在 DSH Host 进程内**，拥有与 DSH 相同的权限：可以读写工作区文件、
  注册 HTTP 路由、调用 `llm` / `tools` / `systemPrompt` / `webServer` 服务。
  DSH 本身是 developer preview，并明确会有破坏性变更；插件的权限上限 = 用户运行 DSH 的权限上限。
- **路由是本机 Web 服务的一部分**（`/ziwei/interpret`、`/ziwei/context`、`/ziwei/handoff`、
  `/ziwei/workspace`），只做方法/Content-Type/来源等本地守卫，**不是面向公网的服务**；
  不要把这些路由反向代理到公网。
- **排盘数据包含个人敏感信息**：出生日期、钟表时间、出生地经度。数据流向：
  浏览器面板 → 本机 Host 路由 → 会话上下文 / 用户已配置的模型提供方。
  插件不额外向第三方上传数据，但**模型请求会经过你配置的 provider**，这是 DSH 会话本身的
  数据路径，不是本插件引入的。
- **不存储**：插件不落盘保存出生数据；`interpret-diag.log` 只记录模型、档位、输出预算、
  结束原因、耗时与 token 用量，不含生辰原文；不承诺「阅后即焚」或「绝不外发」这类无法证明的说法。
- **浏览器端不放 API Key**：解读走 Host 的 `llm` 服务，客户端没有也不应保存任何密钥。
- **日志**：`host-diag.log` / `interpret-diag.log` 是排障用的本地文件，默认不会进 npm 包
  （`verify/pack.mjs` 有断言）。粘贴日志到 issue 前请自行检查是否含敏感信息。

不属于本仓库处理范围的问题：DSH 本体漏洞（请报给 DSH 官方）、用户自己配置的模型提供方、
用户本机其它插件。

## 处理预期

- 这是单人维护的开源项目，**没有 SLA**；收到报告后会尽力在合理时间内确认与修复。
- 修复会以新版本发布并在 CHANGELOG 中说明（漏洞利用细节在修复版本发布后再公开）。
- 不提供赏金计划。

## 供应链卫生

- 本插件**零运行期依赖**；构建产物随仓库提交。
- 发布走 npm **Trusted Publishing（OIDC）+ `--provenance`**，不使用长期 npm token
  （前置条件见 `docs/PUBLISHING.md`）。
- 请只从 npm 官方 registry 或本仓库安装；第三方镜像/自建索引无法保证内容一致。
