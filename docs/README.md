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
| [architecture.md](./architecture.md) | **系统架构设计规范**：系统分层、物理拓扑、IPC 协议、驱动路由、安全矩阵与门禁全景 |
| [design/viewer-drivers.md](./design/viewer-drivers.md) | **Viewer 格式驱动设计规范**：18+ 格式驱动能力矩阵、生命周期、Props 契约与容错自愈 |
| [design/markdown-pipeline.md](./design/markdown-pipeline.md) | **Markdown 渲染流水线规范**：块级虚拟化、增量 Diff、慢块预算与 Word 剪贴板清洗 |
| [design/persistence-storage.md](./design/persistence-storage.md) | **持久化与存储子系统规范**：配置 Schema v2、跨版本迁移、安全钳位与容量度量 |
| [marketing/github-launch-guide.md](./marketing/github-launch-guide.md) | **GitHub 曝光与开源推广实战指南**：多渠道宣发文案（阮一峰周刊/HelloGitHub/V2EX）、SEO 标签与运营清单 |

## 后续规划扩展

以下目录将在后续按需补充：

```text
docs/
├── adr/           # 架构决策记录 (ADR)
└── engineering/   # 发布、验证与工程实践补充说明
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
