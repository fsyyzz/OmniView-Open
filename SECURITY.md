# 安全策略 (Security Policy)

OmniView 作为在 VS Code Webview 沙箱中渲染不可信文件内容的工具，将 XSS、恶意 SVG/HTML、以及意外外联视为一等公民风险。

## 支持的版本

| 版本 | 安全修复支持 |
| --- | --- |
| `0.9.x`（当前发布线） | ✅ 积极修复 |
| 更早的预览包 | ❌ 请升级到最新 VSIX |

## 如何报告漏洞

**请勿**在公开 Issue、Discussions 或社交媒体中披露可复现的利用细节。

请优先使用下列之一：

1. **GitHub Private Vulnerability Reporting**  
   仓库 → **Security** → **Report a vulnerability**  
   （仓库地址：https://github.com/fsyyzz/OmniView）
2. 若私密报告暂不可用，请创建 **不包含 PoC 细节** 的 Issue，标题标明 `[SECURITY]`，并留下可私下联系的方式；维护者会跟进后再索取复现步骤。

报告中尽量包含：

- 受影响版本（`package.json` / VSIX 文件名）
- 影响面（例如：Markdown 内嵌 SVG、Graphviz、自定义主题 HTML 等）
- 复现步骤与期望/实际行为
- 是否在 VS Code Webview 与独立浏览器均可复现

## 响应预期

我们会尽力遵循以下节奏（尽力而为，非 SLA）：

| 阶段 | 目标时间 |
| --- | --- |
| 确认收到 | 7 天内 |
| 初步评估与分级 | 14 天内 |
| 修复发布或缓解说明 | 视严重程度，优先处理高危 |

确认修复后，可在 [`CHANGELOG.md`](./CHANGELOG.md) 中以安全条目公开致谢（可按报告人意愿匿名）。

## 安全设计要点（供审计参考）

- 渲染产物经 **DOMPurify** 白名单清洗（HTML / SVG / 图表输出）。
- 图表块级 **错误边界隔离**，避免单块崩溃拖垮整页。
- Graphviz 等重计算优先走 **Web Worker / WASM**，并在沙箱受限时降级。
- 结构化数据敏感字段支持 **Secret Masking**；转换与预览默认本地内存执行。
- Extension Host 与 Webview 通过受控 `postMessage` 交互，并限制 `localResourceRoots`。

相关架构说明见 [`docs/architecture.md`](./docs/architecture.md)。

## 非安全类问题

功能缺陷、文档笔误、体验建议请走 [GitHub Issues](https://github.com/fsyyzz/OmniView/issues)，并参考 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。
