---
type: Knowledge Catalog Bundle
title: Omnichannel Analytics OKF Bundle (全局知识索引)
description: 基于 Google Open Knowledge Format (OKF v0.1) 规范编排的全渠道电商与智能体知识库索引。
resource: https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing
tags: [okf, bigquery, knowledge-graph, ai-agent, catalog]
timestamp: 2026-06-12T12:00:00Z
owner: data-architecture@omniview.internal
specification_version: 0.1
---

# 🌐 Google Open Knowledge Format (OKF) 演示知识库

欢迎体验基于 **Google Open Knowledge Format (OKF v0.1)** 规范构建的结构化知识库。

> **关于 OKF 规范**：
> - 由 Google Cloud 数据分析与 BigQuery 团队倡导，形式化了 Andrej Karpathy 提出的 **LLM-Wiki** 理念。
> - 核心格式为 **Markdown + YAML Frontmatter**，无需私有 SDK，兼具人类可读性与 AI 智能体结构化解析能力。
> - 概念间的 Markdown 相对链接构成了**知识图谱的关系边 (Graph Edges)**。

---

## 📚 概念导航目录 (Concepts Hierarchy)

### 1. 核心事实与维度数据表 (Tables)
- 📦 [orders.md](tables/orders.md) —— 电商核心订单事实表 (`type: BigQuery Table`, 包含订单流水、金额、外键与 Mermaid ER 实体关系)。
- 👤 [customers.md](tables/customers.md) —— 客户注册与画像维度表 (`type: BigQuery Table`, 包含会员等级与生命周期阶段)。

### 2. 业务指标与统计口径 (Metrics)
- 📈 [weekly_active_users.md](metrics/weekly_active_users.md) —— 周活跃买家数 (`type: Metric`, 包含 LaTeX 严格数学集合推导与 SLA 说明)。

### 3. 原生扩展名演示
- 🧩 [knowledge-catalog.okf](knowledge-catalog.okf) —— 原生 `.okf` 后缀知识包概念文件。

---

## 💡 交互测试提示

1. **元数据与 Tags 卡片**：观察本页面顶部由 OmniView 自动渲染的 OKF 概念元数据卡片，包含类型徽标、多彩 `#tags` 胶囊与时间戳。
2. **YAML 抽屉**：点击右上角 `YAML` 按钮，可折叠/展开并一键复制原始 YAML Frontmatter 内容。
3. **跨文件无缝跳转**：直接点击上方任意相对链接，可在 OmniView 预览器中平滑切换至对应的概念文件。
