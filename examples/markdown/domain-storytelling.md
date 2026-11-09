# DDD 领域驱动设计战略建模与领域故事 (Domain Storytelling / Event Storming / Context Map / Core Domain / Context Canvas)

本示例展示 OmniView 对 **DDD 领域驱动设计五大视图描述语言**（**领域故事 `Domain Storytelling`**、**事件风暴 `Event Storming`**、**限界上下文映射 `Context Map`**、**核心域投资象限图 `Core Domain Chart`**、**限界上下文战略画布 `Context Canvas`**）在 Markdown 内部声明式 DSL 的原生支持。所有图表均支持点击工具栏 **「演播」** 逐帧回放，或**双击画布**打开独立全屏高清灯箱。

---

## 1. 领域故事讲授法 (`Domain Storytelling`)

使用 ```domainstory 语法清晰描述研发团队、产品经理、CI/CD 平台与云集群之间的业务流转：

```domainstory
title: 敏捷团队用户故事端到端交付流水线
description: 业务负责人、开发工程师、CI自动化流水线与K8s云集群的端到端协作

actors:
  - 业务负责人 [person]
  - 敏捷看板平台 [system]
  - 全栈开发专员 [person]
  - 持续集成流水线 [system]
  - Kubernetes集群 [system]

groups:
  - 产研敏捷协作圈: 敏捷看板平台, 全栈开发专员
  - 云原生基础设施: 持续集成流水线, Kubernetes集群

activities:
  1. 业务负责人 -> 录入需求卡片 -> 需求故事卡 [document] -> 敏捷看板平台
  2. 全栈开发专员 -> 领取故事并检出分支 -> 任务详情 [data] -> 敏捷看板平台
  3. 全栈开发专员 -> 提交工程代码 -> Git变更集 [document] -> 持续集成流水线
  4. 持续集成流水线 -> 执行测试套件与安全扫描 -> 自动化测试报告 [data] -> 持续集成流水线
  5. 持续集成流水线 -> 构建并分发容器镜像 -> Docker镜像制品 [package] -> Kubernetes集群
  6. Kubernetes集群 -> 滚动发布并健康探测 -> 运行状态指标 [data] -> 全栈开发专员
  7. 持续集成流水线 -> 广播发布完成事件 -> 飞书通知消息 [email] -> 业务负责人
```

### 单行极简流语法

```domainstory
title: 跨境电商闪电履约故事
1. 海外买家 (person) -> 选购商品并提交订单 -> 支付结算请求 [document] -> 国际收银台 (system)
2. 国际收银台 -> 调用风控引擎评估 -> 交易风险分 [data] -> 反欺诈中台 (system)
3. 反欺诈中台 -> 核验通过下发指令 -> 履约发单 [document] -> 智能保税仓WMS (system)
4. 智能保税仓WMS -> 自动化打包并贴单 -> 跨境包裹与报关单 [package] -> 国际物流承运商 (system)
5. 国际物流承运商 -> 揽收出库并揽收更新 -> 物流跟踪轨迹 [data] -> 海外买家
```

---

## 2. DDD 事件风暴时间轴 (`Event Storming`)

使用 ```event-storming 代码块（或在 ```ddd 中声明 `mode: event-storming`），将命令（`[cmd]`）、聚合根（`[agg]` 或 `@`）、领域事件（`[evt]` 或 `!`）、响应策略（`[policy]` 或 `?`）、外部系统（`[ext]` 或 `$`）、读模型（`read:`）与风险痛点（`hotspot:`）自动渲染为 **Alberto Brandolini 标准色板便利贴时间轴**：

```event-storming
mode: event-storming
title: 电商大促下单与履约事件风暴
context: 交易与履约核心域 [core]
description: 围绕下单、风控、支付、锁库与出库的完整事件因果链

timeline:
  1. 买家 [actor] -> 提交购物车结算单 [cmd] -> @订单聚合 [agg] -> 订单已创建 [evt]
     read: 订单确认页读视图 [readmodel]
     hotspot: 秒杀高并发下预占库存超卖风险？是否引入 Redis 预扣减？
  2. 订单已创建 [evt] -> 自动触发风控与支付策略 [policy] -> 发起渠道扣款 [cmd] -> $微信支付网关 [ext] -> 支付已成功 [evt]
     read: 实时交易风控监控大盘 [readmodel]
  3. 支付已成功 [evt] -> 驱动履约配货策略 [policy] -> 下发波次分拣指令 [cmd] -> @履约单聚合 [agg] -> 仓库已接单出库 [evt]
     read: 买家物流轨迹实时看板 [readmodel]
     hotspot: 跨仓拆单场景下部分商品缺货如何触发逆向部分退款？
```

---

## 3. DDD 战略设计：限界上下文映射图 (`Context Map`)

使用 ```context-map 代码块（或在 ```ddd 中声明 `mode: context-map`），直观刻画核心域（`[core]`）、支撑域（`[supporting]`）、通用域（`[generic]`）以及上下游防腐层（`[D: ACL]`）、开放主机与发布语言（`[U: OHS, PL]`）、遵奉者（`[D: Conformist]`）战略契约：

```context-map
mode: context-map
title: 智慧零售核心领域上下文映射图 (Context Map)
description: 核心域、支撑域与通用域的上下游防腐层 (ACL) 与开放主机 (OHS/PL) 协同拓扑

contexts:
  - 交易订单上下文 [core] (team: 交易研发组, desc: 购物车结算、订单生命周期与状态机, aggregates: 订单聚合, 履约单聚合)
  - 商品与价格上下文 [core] (team: 商品中心组, desc: SPU/SKU 多维规格体系与动态价格树, aggregates: 商品聚合, 价格表聚合)
  - 营销促销上下文 [supporting] (team: 增长营销组, desc: 优惠券、满减算价与秒杀活动引擎, aggregates: 优惠券聚合, 促销规则)
  - 仓储物流上下文 [supporting] (team: 供应链研发组, desc: 智能分仓路由、WMS 波次拣货与运单跟踪, aggregates: 出库单聚合, 库存台账)
  - 统一支付网关 [generic] (team: 金融基础设施组, desc: 微信/支付宝/银联多渠道收单与清结算对账, aggregates: 支付流水聚合)

relationships:
  1. 商品与价格上下文 [U: OHS, PL] -> 交易订单上下文 [D: ACL] : 商品快照与实时目录价格查询契约
  2. 营销促销上下文 [U: OHS, PL] -> 交易订单上下文 [D: ACL] : 优惠试算与锁券核销防腐契约
  3. 交易订单上下文 [U] <-> 统一支付网关 [D: ACL] : 预支付指令与渠道回调防腐适配
  4. 交易订单上下文 [U: PL] ->> 仓储物流上下文 [D: Conformist] : OrderPaidEvent (订单已支付异步领域事件)
```

---

## 4. DDD 战略设计：核心域投资象限图 (`Core Domain Chart`)

使用 ```core-domain 代码块（或在 ```ddd 中声明 `mode: core-domain-chart`），基于 **业务模型复杂度 (Model Complexity)** 与 **业务差异化优势 (Business Differentiation)** 建立 4 象限战略投资决策分析图：

```core-domain
mode: core-domain-chart
title: 新零售战略子域分类与投资决策矩阵
description: 评估核心域自研投资、支撑域敏捷自建与通用域 SaaS 采购的资源分配与技术演进

domains:
  - 智能动态推荐引擎 [core] (complexity: 88, diff: 94, invest: 战略自研/专利算法) -> 保持核心差异化壁垒
  - 实时订单履约编排 [core] (complexity: 82, diff: 86, invest: 精细自研/高可用架构)
  - 动态营销促活算价 [supporting] (complexity: 65, diff: 45, invest: 敏捷自建/规则引擎)
  - 智能分仓路径调度 [supporting] (complexity: 72, diff: 38, invest: 半自研+运筹SDK)
  - 多渠道收单清结算 [generic] (complexity: 35, diff: 15, invest: 采购成熟SaaS/聚合支付)
  - 员工考勤与薪资结算 [generic] (complexity: 25, diff: 8, invest: 标准商业ERP软件)
```

---

## 5. DDD 架构画布：限界上下文战略画布 (`Context Canvas`)

使用 ```context-canvas 代码块（或在 ```ddd 中声明 `mode: context-canvas`），基于 Bento Grid 现代三栏卡片式布局，完整呈现 **输入通信 (Inbound Communication)**、**战略内核 (Strategic Heart: 决策规则与统一语言)**、**输出通信与下游依赖 (Outbound Communication)**：

```context-canvas
mode: context-canvas
context: 订单履约上下文 (Order Fulfillment Context)
classification: core
team: 交易核心研发组
description: 负责全渠道订单从创建、风控支付、分仓分单、锁定发货至售后完结的全生命周期编排与状态一致性保障

inbound:
  commands:
    - SubmitOrderCommand (提交下单)
    - PayOrderCommand (支付订单)
    - CancelOrderCommand (取消订单)
    - RequestRefundCommand (发起售后退款)
  events:
    - PaymentSuccessEvent (支付渠道到账)
    - InventoryLockedEvent (分仓实物锁库)
    - WaybillDispatchedEvent (运单已揽件)
  queries:
    - GetOrderDetailQuery (查询订单全景详情)
    - GetFulfillmentTimelineQuery (订单履约轨迹时间轴)

decisions:
  - 严格幂等保障: 采用 CommandId 与分布式 Redis 租约锁，彻底避免重复扣款与重发
  - 状态机强约束: 订单生命周期仅允许单向确定性状态流转，取消/退款必须触发补偿 Saga
  - 最终一致性保障: 跨仓储与支付网关交互一律基于 Outbox 模式发布领域事件，杜绝分布式悬挂事务

language:
  - 订单聚合 (Order Aggregate) : 订单业务唯一凭据与聚合根，守护金额及项明细不变式
  - 履约单 (Fulfillment Order) : 面向仓库与配送承运商派发的实际发货实物包
  - 补偿流 (Compensating Saga) : 当支付失败或库存售罄时执行的反向回滚编排
  - 幂等键 (Idempotency Key) : 客户端唯一请求序列标识，用于去重防刷

outbound:
  events:
    - OrderCreatedEvent (订单已创建事件)
    - OrderPaidEvent (订单已支付事件)
    - OrderDeliveredEvent (订单已完成交付)
  dependencies:
    - 统一支付网关 (Generic) : ACL 防腐层 RPC 预支付收单与回调鉴权
    - 仓储配送上下文 (Supporting) : OHS/PL 异步投递分拣发货任务
```

---

## 6. 核心功能说明

- **完全本地优先与安全沙箱**：解析与矢量渲染 100% 在本地内存运行，零外部网络请求。
- **逐帧交互演播 (`DiagramStepPlayer`)**：全套 5 类 DDD 图表均支持点击右上角「演播」按钮，按业务步骤 / 事件流 / 上下文集成契约 / 投资子域 / 架构卡片逐帧高亮。
- **Polyglot 双向导出**：支持导出为标准 `.dst` / `.ddd` JSON 以及包含结构化源数据的 Polyglot SVG。
- **双击全屏灯箱**：双击任意图表即可进入沉浸式全屏 Lightbox 缩放查看。
