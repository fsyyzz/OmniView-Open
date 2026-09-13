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

> **知识图谱跳转测试**：
> 点击关联链接可快速回跳至订单概念：[查看关联订单表](/workspace/sales/tables/orders.okf.md)

---

## 1. 字段字典 (Schema)

| 字段名称 | 类型 | 说明 |
| :--- | :---: | :--- |
| `customer_id` | `STRING` | 客户唯一主键 (PK) |
| `email` | `STRING` | 匿名脱敏用户邮箱 |
| `tier` | `STRING` | 会员等级 (`STANDARD`, `VIP`, `ENTERPRISE`) |
| `country` | `STRING` | 国家/地区二字码 (ISO 3166-1) |
