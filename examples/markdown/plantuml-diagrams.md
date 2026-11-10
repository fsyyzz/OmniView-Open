# PlantUML 架构与工程图表全景展馆 (PlantUML Visual Gallery)

> [!BANNER] OmniView PlantUML 专业矢量绘图展馆
> 本文档全面展示 OmniView 对 **PlantUML** 丰富工程与架构图表的解析和矢量渲染能力。
> 支持在【预览 / 源码】模式之间极速切换，双击全屏放大沉浸式检视，多主题高保真自适应渲染！

---

## 一、技术特性与渲染架构概览

> [!TABS]
> - 本地与私有服务架构: OmniView 内置轻量 PlantUML 编码压缩器，同时支持通过【设置 -> PlantUML 服务地址】配置团队私有本地/内网 PlantUML Server 容器（如 `http://localhost:8080`），数据永不出域。
> - 双向源码与预览交互: 在任意 PlantUML 图表右上角点击【源码】即可直接就地微调语法，点击【预览】或 Ctrl+S 实时重新编译渲染，丝滑无卡顿。
> - 外部文件引用联动: 不仅支持在 Markdown 中内嵌代码块，还支持通过 `external` 参数直接无缝加载工作区独立 `.puml` 架构文件。

> [!COMPARE]
> - PlantUML: 适合工业级复杂企业架构、时序生命周期微调、精细包依赖关系、复合状态机与 UML 严格规范建模。
> - Mermaid: 适合轻量内嵌流程图、敏捷快速原型、基础时序与现代网页端轻量可视化。

---

## 二、核心工程图表示例

### 1. 微服务认证与流式渲染时序图 (Sequence Diagram)

展示复杂调用时序、生命周期激活条 (`activate`/`deactivate`)、条件分支 (`alt`/`else`) 与自动序列编号：

```plantuml
@startuml
title 微服务鉴权与异步矢量渲染时序图
autonumber
skinparam responseMessageBelowArrow true

actor "客户端用户" as User #LightSkyBlue
participant "API 网关中枢" as Gateway #LightGreen
participant "鉴权与风控" as Auth #LightPink
participant "Markdown 渲染引擎" as Engine #Gold
database "持久化缓存 (Redis)" as Cache #LightCyan
queue "异步渲染队列" as MQ #Plum
participant "PlantUML 离线 Worker" as Worker #Orange

User -> Gateway : 发起文档查看请求 (GET /doc/spec.md)
activate Gateway

Gateway -> Auth : 校验 Bearer Token & 权限
activate Auth
Auth --> Gateway : 鉴权通过 (Role: Engineer)
deactivate Auth

Gateway -> Engine : 派发 Markdown 解析任务
activate Engine
Engine -> Cache : 查询当前 PlantUML 编译缓存

alt 缓存命中 (Cache Hit)
    Cache --> Engine : 毫秒级返回矢量 SVG 字符串
    Engine --> Gateway : 返回组装完成的排版视图
    Gateway --> User : 200 OK (极速呈现)
else 缓存未命中 (Cache Miss)
    Engine -> MQ : 发布图形编译事件 (diagram.compile.event)
    activate MQ
    MQ -> Worker : 消费并拉取 PlantUML DSL
    activate Worker
    Worker -> Worker : 编译生成高清 SVG 图元
    Worker -> Cache : 回写 SVG 缓存落盘
    Worker --> Engine : 回调通知编译完成
    deactivate Worker
    deactivate MQ
    Engine --> Gateway : 组装文档矢量流
    Gateway --> User : 200 OK (实时渲染完成)
end

deactivate Engine
deactivate Gateway
@enduml
```

---

### 2. 企业级云原生微服务组件与部署图 (Component Diagram)

展示跨网络边界、多层分包 (`package`)、组件依赖与外部服务网关关系：

```plantuml
@startuml
skinparam componentStyle rectangle

package "客户端呈现层 (Presentation)" {
  [VS Code 插件宿主] as VSCodeHost
  [Webview 交互画布] as Canvas
  [Monaco 源码编辑器] as Editor
}

package "本地中枢服务 (Core Engine)" {
  [AST 语法解析流水线] as AST_Pipeline
  [驱动分发路由器] as Router
  [SVG 矢量净化沙箱] as Sanitizer
}

package "图表编译子系统 (Diagram Subsystem)" {
  [Mermaid 客户端运行时] as Mermaid_Engine
  [Graphviz WASM 核心] as Graphviz_WASM
  [PlantUML 编码压缩器] as PlantUML_Codec
}

cloud "私有 PlantUML 集群" {
  [PlantUML Server 容器] as Remote_Server
}

database "工作区与本地存储" {
  [文件系统 / 磁盘文件] as FS
  [IndexedDB / LocalStorage] as Storage
}

VSCodeHost --> Canvas : 注入 Webview 流
Canvas --> Editor : 双向同步
Canvas --> AST_Pipeline : 提交 Markdown 纯文本
AST_Pipeline --> Router : 分块 AST 令牌派发
Router --> Mermaid_Engine : ```mermaid 代码块
Router --> Graphviz_WASM : ```dot / ```graphviz
Router --> PlantUML_Codec : ```plantuml 代码块
PlantUML_Codec --> Remote_Server : Deflate 压缩流通信
Remote_Server --> Sanitizer : 响应原生 SVG
Sanitizer --> Canvas : 挂载安全交互节点
Canvas --> Storage : 缓存渲染指标与分屏比例
VSCodeHost --> FS : 工作区文件读写
@enduml
```

---

### 3. 分布式交易订单流转复合状态机 (State Machine Diagram)

展示嵌套复合子状态、超时自愈、异常回滚与生命周期终态：

```plantuml
@startuml
skinparam state {
  StartColor #38bdf8
  EndColor #ef4444
}

[*] --> 待确认订单 : 用户加购并提交结算

state 待确认订单 {
  [*] --> 库存预占
  库存预占 --> 优惠券核销 : 预占成功
  优惠券核销 --> 生成支付网关单据 : 试算一致
}

待确认订单 --> 待支付 : 订单锁定成功 (15分钟支付倒计时)
待确认订单 --> 订单已取消 : 预占失败 / 风控拦截

state 待支付 {
  [*] --> 等待收银台回调
  等待收银台回调 --> 支付超时 : 超出 15 分钟
}

待支付 --> 订单已取消 : 超时未付 / 用户主动放弃
待支付 --> 支付成功 : 收到支付渠道同步对账 Webhook

state 支付成功 {
  [*] --> 资金划拨记账
  资金划拨记账 --> 扣减实际库存
}

支付成功 --> 仓配履约中 : 派发智能出库任务单

state 仓配履约中 {
  state "WMS 自动化波次分拣" as WMS_Pick
  state "质检、拍照与封箱打包" as WMS_Pack
  state "面单粘贴与称重集包" as WMS_Ship

  [*] --> WMS_Pick
  WMS_Pick --> WMS_Pack : 分拣扫描完成
  WMS_Pack --> WMS_Ship : 复核无误
  WMS_Ship --> [*]
}

仓配履约中 --> 干线物流配送中 : 运单号生成与快递揽收
干线物流配送中 --> 派送末端网点 : 城市分拨中心转运
派送末端网点 --> 用户已签收 : 派件员上门核销签收

state 用户已签收 {
  [*] --> 售后服务窗口期
  售后服务窗口期 --> 订单终态完成 : 满 7 天无售后申请
}

用户已签收 --> 售后退换中 : 用户发起退货退款
售后退换中 --> 订单已取消 : 逆向入库退款成功
订单终态完成 --> [*] : 生命周期圆满归档
@enduml
```

---

### 4. DDD 领域模型与聚合根类图 (Domain Model Class Diagram)

展示实体 (Entity)、值对象 (Value Object)、聚合根 (Aggregate Root) 泛型接口与枚举关系：

```plantuml
@startuml
interface Entity<ID> {
  +getId() : ID
  +equals(other: Object) : boolean
}

abstract class AggregateRoot<ID> implements Entity {
  -domainEvents : List<DomainEvent>
  #registerEvent(event: DomainEvent) : void
  +pullDomainEvents() : List<DomainEvent>
}

class Order <<(A,#F59E0B) Aggregate Root>> extends AggregateRoot {
  -orderId : OrderId
  -buyerId : BuyerId
  -items : List<OrderItem>
  -orderStatus : OrderStatus
  -paymentInfo : PaymentInfo
  -totalAmount : Money
  +addItem(item: OrderItem) : void
  +confirmPayment(payTxId: String) : void
  +cancelOrder(reason: String) : void
}

class OrderItem <<(E,#10B981) Entity>> {
  -itemId : String
  -skuCode : String
  -productName : String
  -unitPrice : Money
  -quantity : int
  +getSubtotal() : Money
}

class Money <<(V,#3B82F6) Value Object>> {
  -amount : BigDecimal
  -currency : Currency
  +plus(other: Money) : Money
  +minus(other: Money) : Money
}

enum OrderStatus {
  PENDING_PAYMENT
  PAID
  FULFILLING
  SHIPPED
  COMPLETED
  CANCELLED
}

interface OrderRepository <<(R,#8B5CF6) Repository>> {
  +findById(id: OrderId) : Optional<Order>
  +save(order: Order) : void
  +findByBuyerId(buyerId: BuyerId) : List<Order>
}

Order "1" *-- "1..*" OrderItem : 组合包容
Order --> OrderStatus : 状态引用
Order --> Money : 包含金额
OrderItem --> Money : 单价
OrderRepository ..> Order : 依赖持久化
@enduml
```

---

### 5. 战略业务用例图 (Use Case Diagram with Boundaries)

展示外部角色参与者 (Actor)、业务边界与用例依赖 (`<<include>>`, `<<extend>>`)：

> [!NOTE] 全主题自适应渲染保障
> OmniView 内置多主题自适应渲染引擎，会自动为用例图的 `usecase` 椭圆、边界 `rectangle` 与外部 `actor` 注入高对比度主题样式，彻底杜绝深色模式下常见的“白底白字”显示异常，并支持双击全屏无级放大检视。

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle

actor "普通注册买家" as Buyer #LightSkyBlue
actor "电商平台运营" as Operator #LightGreen
actor "统一支付渠道" as PayGateway #Gold

rectangle "智慧商城交易核心系统" {
  usecase "浏览商品与领券" as UC_Browse
  usecase "提交购物车结算" as UC_Checkout
  usecase "在线安全收银支付" as UC_Pay
  usecase "申请售后退货退款" as UC_Refund
  usecase "订单异常风控拦截" as UC_FraudCheck
  usecase "人工退款仲裁审核" as UC_AuditRefund
  usecase "对账与财务结算流水" as UC_Settlement
}

Buyer --> UC_Browse
Buyer --> UC_Checkout
Buyer --> UC_Pay
Buyer --> UC_Refund

UC_Checkout .> UC_FraudCheck : <<include>>
UC_Pay .> UC_Checkout : <<extend>>
UC_Refund .> UC_AuditRefund : <<include>>

PayGateway --> UC_Pay
PayGateway --> UC_Settlement
Operator --> UC_AuditRefund
Operator --> UC_Settlement
@enduml
```

---

### 6. 现代活动泳道流程图 (Activity Diagram with Swimlanes)

展示跨部门跨泳道的协作流转、判定与并行汇聚 (`fork`/`join`)：

```plantuml
@startuml
|买家用户|
start
:挑选商品并加入购物车;
:点击去结算并核验收货地址;

|交易系统|
:生成唯一待支付订单号;
:冻结对应商品分布式库存;

|风控系统|
if (风控信用评级合规?) then (通过)
  :放行进入收银台;
else (拦截)
  |交易系统|
  :释放预占库存;
  :标记订单为高危关闭;
  |买家用户|
  :展示风险提示弹窗;
  stop
endif

|买家用户|
:选择第三方支付工具扣款;

|支付网关|
:执行通道借记划拨;
if (扣款是否成功?) then (扣款成功)
  :向交易系统推送扣款 Webhook;
else (支付失败/超时)
  |交易系统|
  :恢复库存配额;
  stop
endif

|仓储物流中心|
fork
  :智能仓库按单波次拣货;
fork again
  :打印电子面单与电子发票;
end fork
:包裹集装出库装车;

|买家用户|
:收到商品并核验防伪签收;
stop
@enduml
```

---

### 7. 架构与知识体系思维脑图 (PlantUML Mindmap)

展示树状发散的架构解耦分解与技术栈全景：

> [!TIP] 现代思维脑图原生样式规范
> PlantUML 脑图基于 `@startmindmap` 语法构建，OmniView 渲染引擎会自动注入原生 `<style>` 脑图图元样式契约，为各层级节点与折叠树枝提供深邃自适应底色与高对比文字，彻底告别传统 PlantUML 脑图节点文字与背景同色的问题。

```plantuml
@startmindmap
* OmniView 多格式统一文档视界
** 核心渲染引擎
*** Marked AST 自适应分块
*** DOMPurify 工业级安全清洗
*** 60 FPS 平滑滚动同步
** 现代专业图表体系
*** Mermaid.js (流程/时序/类图/状态机)
*** PlantUML (架构/组件/状态机/用例)
*** Graphviz DOT (WASM 拓扑分析)
*** Apache ECharts (矢量商业图表)
*** SVG 矢量交互画布 (内嵌代码块 & 外部文件)
** 领域驱动设计 (DDD) 专属生态
*** 领域故事 (Domain Storytelling)
*** 事件风暴 (Event Storming)
*** 限界上下文映射图 (Context Map)
** 交互式排版扩展组件
*** Tabs 多标签卡片
*** Steps 流程步骤指引
*** Compare 方案优劣对比
*** Timeline 路线时间轴
*** Metrics 关键指标网格
@endmindmap
```

---

### 8. 外部工作区独立 `.puml` 架构文件挂载

通过 `external` 参数直接无缝加载同工作区内的独立 PlantUML 架构源文件：

```plantuml external="../plantuml/cloud-topology.puml"
```

> [!NOTE] 外部引用提示
> 当使用 `external="../plantuml/cloud-topology.puml"` 时，OmniView 会自动监视源文件的磁盘变动；当上游架构文件修改并保存时，本文档内的图表会自动无缝热重载并同步最新矢量视图！

