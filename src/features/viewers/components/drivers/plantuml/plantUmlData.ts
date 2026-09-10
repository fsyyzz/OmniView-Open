/**
 * PlantUML 架构驱动企业级模板、主题与快捷代码段
 */

export interface PlantUmlTemplate {
  id: string;
  name: string;
  category: 'architecture' | 'sequence' | 'state' | 'gantt' | 'mindmap' | 'database';
  categoryLabel: string;
  description: string;
  code: string;
}

export interface PlantUmlTheme {
  id: string;
  name: string;
  description: string;
  themeValue: string; // value to insert with !theme <value>
  isDark?: boolean;
}

export const PLANTUML_THEMES: PlantUmlTheme[] = [
  { id: 'none', name: '经典原版 (Default)', description: 'PlantUML 原生标准配色', themeValue: '' },
  { id: 'vibrant', name: '活力炫彩 (Vibrant)', description: '现代高对比明亮风格', themeValue: 'vibrant' },
  { id: 'materia', name: '扁平质感 (Materia)', description: 'Google Material 扁平极简风', themeValue: 'materia' },
  { id: 'superhero', name: '超级英雄 (Superhero)', description: '极客深蓝暗色主题', themeValue: 'superhero', isDark: true },
  { id: 'minty', name: '清新薄荷 (Minty)', description: '护眼薄荷绿清爽色调', themeValue: 'minty' },
  { id: 'sketchlib', name: '草图手绘 (Sketch)', description: '手绘白板架构风格', themeValue: 'sketchlib' },
  { id: 'cyborg', name: '赛博朋克 (Cyborg)', description: '深色高对比科技主题', themeValue: 'cyborg', isDark: true },
  { id: 'spacelab', name: '工业灰蓝 (Spacelab)', description: '严谨工程制图风格', themeValue: 'spacelab' },
  { id: 'plain', name: '极简黑白 (Plain)', description: '无色系高对比黑白打印风', themeValue: 'plain' },
];

export const PLANTUML_TEMPLATES: PlantUmlTemplate[] = [
  {
    id: 'c4-container',
    name: 'C4 容器分层架构',
    category: 'architecture',
    categoryLabel: '系统架构',
    description: 'C4 Model 标准容器架构图（网关、微服务与数据库）',
    code: `@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

title 电商支付中心 - 容器架构图 (C4 Model)

Person(customer, "终端用户", "使用移动 App 或网页下单")

System_Boundary(c1, "电商核心平台") {
    Container(web_app, "前端应用 (SPA)", "React / Vite", "提供商品选购与收银台交互")
    Container(api_gw, "API 网关", "Go / Envoy", "负责路由鉴权、限流熔断与负载均衡")
    Container(pay_srv, "支付结算服务", "Java / Spring Boot", "处理订单扣款与三方对账")
    ContainerDb(db, "支付中心主库", "PostgreSQL", "存储交易流水、快照与账户记账")
}

System_Ext(alipay, "第三方支付渠道", "支付宝 / 微信支付开放平台")

Rel(customer, web_app, "浏览与点击支付", "HTTPS")
Rel(web_app, api_gw, "发起扣款请求", "JSON/HTTPS")
Rel(api_gw, pay_srv, "转发支付指令", "gRPC")
Rel(pay_srv, db, "写入交易快照与流水", "JDBC/SSL")
Rel(pay_srv, alipay, "代扣签署与扣款", "HTTPS/TLS")
@enduml`,
  },
  {
    id: 'microservices',
    name: '微服务集群拓扑',
    category: 'architecture',
    categoryLabel: '系统架构',
    description: 'Kubernetes 集群微服务、注册中心与存储拓扑',
    code: `@startuml
title 生产级微服务集群架构拓扑
skinparam componentStyle uml2

node "Kubernetes Cluster" {
  [API Gateway] as GW
  [Auth Service] as Auth
  [Order Core Service] as Order
  [Inventory Svc] as Inv
  database "Redis Cluster" as Cache
  database "PostgreSQL Primary" as DB
  queue "Kafka Event Bus" as MQ
}

cloud "Public Internet" {
  [Client App] as Client
}

Client --> GW : HTTPS / TLS
GW --> Auth : JWT 验签与限流
GW --> Order : 业务路由
Order --> Inv : gRPC 扣减库存
Order --> DB : 事务写操作
Order --> MQ : 发布 OrderCreated 事件
Auth ..> Cache : 鉴权 Token 缓存
@enduml`,
  },
  {
    id: 'sequence-ipc',
    name: '双向 IPC 通信时序',
    category: 'sequence',
    categoryLabel: '时序通信',
    description: '展示前端 Webview、VS Code 宿主与云端编译器通信',
    code: `@startuml
autonumber
title OmniViewer 双向类型化 IPC 时序

actor "工程师" as Dev
participant "Webview 前端" as Webview
participant "VS Code 宿主" as Host
participant "PlantUML 渲染引擎" as Compiler

Dev -> Webview: 编辑 PlantUML DSL 代码
activate Webview
Webview -> Webview: 启动 300ms 防抖计时器
Webview -> Compiler: 发送 Base64/Deflate 编码请求
activate Compiler
Compiler --> Webview: 返回 SVG 矢量图流 (200 OK)
deactivate Compiler

Webview -> Host: postMessage({ type: 'contentChange', isDirty: true })
activate Host
Host --> Webview: postMessage({ type: 'stateAck', status: 'saved' })
deactivate Host
deactivate Webview
@enduml`,
  },
  {
    id: 'state-machine',
    name: '驱动生命周期状态机',
    category: 'state',
    categoryLabel: '系统状态',
    description: '驱动注册、AST 校验、沙箱编译与就绪状态机',
    code: `@startuml
title 驱动微内核生命周期状态流转

[*] --> Idle : 注册并注入驱动插槽

state Idle {
  [*] --> Standby
  Standby --> Parsing : 接收新文件流
}

Parsing --> SyntaxValid : AST 校验通过
Parsing --> SyntaxError : 发现词法/语法错误

SyntaxValid --> Compiling : 构建 Deflate 载荷
Compiling --> Ready : SVG 矢量渲染就绪
Ready --> [*] : 交付视图展示

SyntaxError --> Idle : 报告诊断信息并等待修复
@enduml`,
  },
  {
    id: 'gantt-release',
    name: '项目研发甘特图',
    category: 'gantt',
    categoryLabel: '排期规划',
    description: '研发阶段、关键任务依赖与里程碑交付规划',
    code: `@startgantt
title OmniViewer V2.0 架构升级排期甘特图
dateFormat YYYY-MM-DD

[需求调研与竞品对标] as [PRD] lasts 4 days
[PRD] starts 2026-09-01

[驱动微内核接口重构] as [Core] lasts 6 days
[Core] starts at [PRD]'s end

[PlantUML 交互视口升级] as [PUML] lasts 5 days
[PUML] starts at [Core]'s end

[自动化测试与回归验收] as [QA] lasts 4 days
[QA] starts at [PUML]'s end

[里程碑 V2.0 生产准入] happens at [QA]'s end
@endgantt`,
  },
  {
    id: 'mindmap-overview',
    name: '架构全景思维导图',
    category: 'mindmap',
    categoryLabel: '思维导图',
    description: '梳理多驱动全景架构、安全防线与构建流',
    code: `@startmindmap
* OmniViewer 技术架构全景
** 宿主扩展层 (Extension Host)
*** VS Code CustomEditor API
*** 类型化 IPC 消息总线
*** 本地文件安全读写
** 渲染驱动微内核
*** Markdown + Mermaid 驱动
*** PlantUML 架构图视口驱动
*** SVG 矢量平移与缩放驱动
*** PDF.js 高清翻页驱动
** 安全防御防线
*** CSP Level 3 策略
*** DOMPurify 消毒过滤
*** 0 字节遥测完全离线
@endmindmap`,
  },
  {
    id: 'database-er',
    name: '数据库实体关系 ER 图',
    category: 'database',
    categoryLabel: '数据建模',
    description: '用户中心、角色权限与组织机构关系建模',
    code: `@startuml
title 企业权限管理中心 (RBAC) 数据模型

entity "users" as user {
  * id : BIGINT <<PK>>
  --
  * username : VARCHAR(64)
  * email : VARCHAR(128)
  password_hash : VARCHAR(255)
  status : SMALLINT
  created_at : TIMESTAMP
}

entity "roles" as role {
  * id : INT <<PK>>
  --
  * code : VARCHAR(32)
  * name : VARCHAR(64)
  description : VARCHAR(255)
}

entity "permissions" as perm {
  * id : INT <<PK>>
  --
  * action : VARCHAR(64)
  * resource : VARCHAR(128)
}

entity "user_roles" as ur {
  * user_id : BIGINT <<FK>>
  * role_id : INT <<FK>>
  assigned_at : TIMESTAMP
}

entity "role_permissions" as rp {
  * role_id : INT <<FK>>
  * perm_id : INT <<FK>>
}

user ||--o{ ur : "拥有"
role ||--o{ ur : "分配至"
role ||--o{ rp : "包含"
perm ||--o{ rp : "关联至"
@enduml`,
  },
];

export interface PlantUmlSnippet {
  label: string;
  code: string;
  tooltip: string;
}

export const PLANTUML_SNIPPETS: PlantUmlSnippet[] = [
  { label: '+ 参与者', code: 'participant "服务名" as Svc\n', tooltip: '插入 participant 声明' },
  { label: '+ 角色', code: 'actor "终端用户" as User\n', tooltip: '插入 actor 参与者' },
  { label: '+ 数据库', code: 'database "PostgreSQL" as DB\n', tooltip: '插入 database 节点' },
  { label: '+ 队列', code: 'queue "Kafka Topic" as MQ\n', tooltip: '插入 queue 消息队列' },
  {
    label: '+ 条件分支',
    code: `alt 验证通过
  Server -> Client: 200 OK
else 鉴权失败
  Server -> Client: 403 Forbidden
end\n`,
    tooltip: '插入 alt / else 条件逻辑块',
  },
  {
    label: '+ 循环探测',
    code: `loop 每隔 30 秒健康检查
  Client -> Server: GET /health
  Server --> Client: status: UP
end\n`,
    tooltip: '插入 loop 轮询探测块',
  },
  {
    label: '+ 备注说明',
    code: 'note over Client, Server: 通信通道已建立 TLS 1.3\n',
    tooltip: '插入 note over 跨节点注释',
  },
  {
    label: '+ 安全边界框',
    code: `box "安全隔离区 (VPC)" #LightSlateGray
  participant WAF
  participant Gateway
end box\n`,
    tooltip: '插入 box 逻辑分组背景框',
  },
];

/**
 * 在 PlantUML 源码中应用/替换/移除 !theme 指令
 */
export function applyPlantUmlTheme(code: string, themeValue: string): string {
  if (!themeValue) {
    // 移除已有的 !theme 行
    return code.replace(/^[ \t]*!theme\s+[^\r\n]+\r?\n?/m, '');
  }

  // 如果已存在 !theme，则原位替换
  if (/^[ \t]*!theme\s+[^\r\n]+/m.test(code)) {
    return code.replace(/^[ \t]*!theme\s+[^\r\n]+/m, `!theme ${themeValue}`);
  }

  // 否则插入在 @start... 开头行之后
  const startMatch = code.match(/^[ \t]*@start[a-z]+\b[^\r\n]*\r?\n/m);
  if (startMatch && startMatch.index !== undefined) {
    const insertPos = startMatch.index + startMatch[0].length;
    return code.slice(0, insertPos) + `!theme ${themeValue}\n` + code.slice(insertPos);
  }

  return `!theme ${themeValue}\n` + code;
}

/**
 * 从代码中检测当前生效的 !theme 主题
 */
export function detectPlantUmlTheme(code: string): string {
  const match = code.match(/^[ \t]*!theme\s+([a-zA-Z0-9_-]+)/m);
  return match ? match[1] : '';
}

