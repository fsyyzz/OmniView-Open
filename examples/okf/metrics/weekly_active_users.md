---
type: Metric
title: Weekly Active Users (周活跃买家数)
description: 滚动过去 7 个自然日内至少完成过一次有效加购或支付动作的独立客户数。
resource: https://lookerstudio.google.com/reporting/omniview-wau
tags: [metrics, growth, kpi, analytics, bi]
timestamp: 2026-06-11T16:00:00Z
owner: bi-team@omniview.internal
sla: Daily 04:00 UTC
unit: Count (Distinct Users)
---

# 📈 WAU 指标定义与计算口径

## 1. 统计学数学公式定义

周活跃度指标定义为在滑窗 $T = [t - 6, t]$ 内去重客户集合的基数测度：

$$\text{WAU}(t) = \left| \bigcup_{i=0}^{6} \mathcal{U}_{t - i} \right|$$

其中 $\mathcal{U}_k$ 代表第 $k$ 天发生核心交易或支付行为的非空客户子集：

$$\mathcal{U}_k = \{ c \in \text{Customers} \mid \exists e \in \text{Orders}_k : \text{status}(e) = \text{'PAID'} \}$$

---

## 2. 依赖上游数据源实体 (Lineage)

- 核心交易事实来源：[orders.md](../tables/orders.md)
- 会员主数据源：[customers.md](../tables/customers.md)
- 返回知识库导览：[全局知识索引](../index.md)
