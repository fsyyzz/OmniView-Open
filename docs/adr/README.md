# OmniView 架构决策记录 (ADR)

> 本目录存放 OmniView 在重大架构演进、技术选型与协议变更中沉淀的决策记录（Architecture Decision Records）。每条 ADR 采用 Nygard 风格的 Context / Decision / Consequences 结构，状态机：`Proposed` → `Accepted` → `Superseded` / `Deprecated`。

## 索引

| 编号 | 标题 | 状态 | 决策日期 | 影响子系统 |
|---|---|---|---|---|
| [0001](./0001-svg-edit-engine-v2-document-model.md) | SVG 编辑引擎 v2 — 引入文档模型与命令管线 | Accepted | 2025-10-08 | `src/features/viewers/components/drivers/svg/*` |

## 状态机

```
Proposed ──评审通过──► Accepted ──被新ADR取代──► Superseded
   │                    │
   │                    └──不再适用──► Deprecated
   │
   └──评审否决──► Rejected
```

## 编写规范

- **编号**：五位递增（`0001`、`0002`…），按目录创建顺序。
- **文件名**：`NNNN-kebab-case-topic.md`。
- **模板字段**：Context / Decision / Positive Consequences / Negative Consequences & Mitigations / Considered Alternatives / Milestones / Acceptance Criteria / Open Questions / Changelog。
- **状态变更**：通过 PR 提交并附带 ADR diff；评审人需在 Changelog 标注。
- **追溯**：被 Superseded 时必须显式链接后续 ADR；不得静默删除历史决策。

## 关联

- 上游：`.codex/workflows/architecture-change.md`（L3 严苛通道）
- 模板：`docs/adr/_template.md`（未来按需补充）