---
type: BigQuery Table
title: Customers (注册用户维度表)
description: 存储全渠道已注册买家主数据，维护会员级别、首单时间与用户生命周期阶段。
resource: https://console.cloud.google.com/bigquery?p=omniview-demo&d=sales&t=customers
tags: [crm, users, dimension, gdpr]
timestamp: 2026-06-10T08:00:00Z
owner: user-growth@omniview.internal
---

# 👤 客户主数据维度表 (Customers Concept)

> **知识图谱关系测试**：
> 点击右侧链接可回跳至订单概念：[查看关联订单表 (orders.md)](orders.md)

---

## 1. 字段字典 (Schema)

| 字段名称 | 数据类型 | 说明 | 示例 |
| :--- | :---: | :--- | :--- |
| `customer_id` | `STRING` | 客户唯一主键 (PK) | `CUST-88391` |
| `email` | `STRING` | 匿名脱敏用户邮箱 | `user***@example.com` |
| `tier` | `STRING` | 会员等级 (`STANDARD`, `VIP`, `ENTERPRISE`) | `VIP` |
| `country` | `STRING` | 国家/地区二字码 (ISO 3166-1) | `US` |
| `created_at` | `TIMESTAMP` | 账号注册 UTC 时间 | `2025-01-15 08:20:00` |

---

## 2. 关联概念与血缘

- 下游订单消费：[orders.md](orders.md)
- 核心增长分析：[weekly_active_users.md](../metrics/weekly_active_users.md)
- 返回索引：[全局知识索引](../index.md)
