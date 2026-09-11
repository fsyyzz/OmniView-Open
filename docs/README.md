# OmniView 文档索引

本目录存放面向贡献者与维护者的技术文档。产品功能介绍与安装说明请先阅读仓库根目录：

- [README.md](../README.md)（中文）
- [README.en.md](../README.en.md)（English）
- [CONTRIBUTING.md](../CONTRIBUTING.md) — 开发与 PR 流程
- [SECURITY.md](../SECURITY.md) — 漏洞披露
- [CHANGELOG.md](../CHANGELOG.md) — 版本变更
- [LICENSE](../LICENSE) — MIT

## 本目录

| 文档 | 说明 |
| --- | --- |
| [architecture.md](./architecture.md) | 系统分层、驱动矩阵、Markdown 渲染管道、安全与校验基线 |

## 规划中的扩展（尚未落地）

以下目录将在后续按需补充，**当前请勿假设已存在**：

```text
docs/
├── adr/           # 架构决策记录 (ADR)
├── design/        # 各 Viewer / 工作台详细设计
└── engineering/   # 发布、验证与工程实践说明
```

若你要贡献上述文档，请先开 Issue 对齐范围，并遵循 [CONTRIBUTING.md](../CONTRIBUTING.md)。

## 示例

| 资源 | 说明 |
| --- | --- |
| [examples/](../examples/) | 可直接用 OmniView 打开的样例文件 |

## 维护原则

1. **事实可追溯**：文档中的路径、命令、能力清单须与代码一致。
2. **改代码即改文档**：驱动路由、安全边界、持久化契约变更时同步更新本目录与 README。
3. **校验**：`npm run check:doc-code-consistency` 与 `npm run verify` 会检查关键文档是否存在且无陈旧绝对路径。
