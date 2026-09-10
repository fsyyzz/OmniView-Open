# Graphviz / DOT 架构图与拓扑可视化示例

本文档全面展示 OmniView 对 **Markdown 内嵌 Graphviz / DOT 矢量图表** 的渲染能力。支持 ````dot```` 与 ````graphviz```` 语法块、Web Worker 异步 WASM 编译、DOMPurify 安全清洗、全屏灯箱放大、缩放平移与源码在线编辑。

---

## 1. 经典服务架构有向图 (```dot)

```dot
digraph CloudArchitecture {
  rankdir=LR;
  node [shape=box, style="rounded,filled", fontname="sans-serif", fontsize=11];
  edge [color="#64748b", fontname="sans-serif", fontsize=10];

  subgraph cluster_frontend {
    label="前端层 (Edge & Gateway)";
    style="rounded,dashed";
    color="#3b82f6";
    bgcolor="#0f172a15";

    Client [label="客户端 (Web / App)", fillcolor="#dbeafe", fontcolor="#1e40af"];
    CDN [label="全球 CDN 节点", fillcolor="#e0e7ff", fontcolor="#3730a3"];
    Gateway [label="API 网关 (Nginx / Envoy)", fillcolor="#bfdbfe", fontcolor="#1d4ed8"];
  }

  subgraph cluster_backend {
    label="核心微服务集群 (Kubernetes)";
    style="rounded,dashed";
    color="#10b981";
    bgcolor="#0f172a15";

    AuthSvc [label="鉴权服务 (OAuth2 / JWT)", fillcolor="#d1fae5", fontcolor="#065f46"];
    OrderSvc [label="订单引擎 (Order Svc)", fillcolor="#d1fae5", fontcolor="#065f46"];
    PaySvc [label="支付结算 (Payment Svc)", fillcolor="#d1fae5", fontcolor="#065f46"];
  }

  subgraph cluster_data {
    label="持久化与缓存集群";
    style="rounded,dashed";
    color="#f59e0b";
    bgcolor="#0f172a15";

    Redis [label="Redis 缓存 (Cluster)", shape=cylinder, fillcolor="#fef3c7", fontcolor="#92400e"];
    MySQL [label="MySQL 主从库", shape=cylinder, fillcolor="#fed7aa", fontcolor="#9a3412"];
    Kafka [label="Kafka 事件总线", shape=component, fillcolor="#fde68a", fontcolor="#854d0e"];
  }

  Client -> CDN -> Gateway;
  Gateway -> AuthSvc;
  Gateway -> OrderSvc;
  OrderSvc -> PaySvc;
  OrderSvc -> Redis;
  OrderSvc -> MySQL;
  OrderSvc -> Kafka;
  PaySvc -> Kafka;
}
```

---

## 2. 状态机与网络拓扑无向图 (```graphviz)

```graphviz
graph ClusterTopology {
  layout=neato;
  node [shape=circle, style=filled, fillcolor="#e0f2fe", fontname="sans-serif", width=0.9, fixedsize=true];
  edge [color="#94a3b8", penwidth=1.5];

  Master [label="主节点", fillcolor="#fbcfe8", fontcolor="#9d174d", width=1.1];
  Worker1 [label="工作节点 1"];
  Worker2 [label="工作节点 2"];
  Worker3 [label="工作节点 3"];
  Worker4 [label="工作节点 4"];

  Master -- Worker1 [len=1.8];
  Master -- Worker2 [len=1.8];
  Master -- Worker3 [len=1.8];
  Master -- Worker4 [len=1.8];
  Worker1 -- Worker2 [len=1.5];
  Worker2 -- Worker3 [len=1.5];
  Worker3 -- Worker4 [len=1.5];
  Worker4 -- Worker1 [len=1.5];
}
```

---

## 3. 数据结构二叉搜索树 (```dot)

```dot
digraph BinarySearchTree {
  node [shape=circle, style=filled, fillcolor="#ede9fe", fontcolor="#5b21b6", fontname="sans-serif", fontmargin=0.1];
  edge [color="#8b5cf6", arrowsize=0.8];

  50 -> 30;
  50 -> 70;
  30 -> 20;
  30 -> 40;
  70 -> 60;
  70 -> 80;

  // 空节点占位
  node [shape=point, width=0.01, style=invis];
  n1 [style=invis];
  30 -> n1 [style=invis];
}
```

---

## 4. 容错与错误边界测试 (错误语法降级)

以下为一个包含故意的语法损坏的 DOT 代码块，用于验证局部错误诊断与降级能力（绝不白屏，提供源码编辑与错误详情一键复制）：

```dot
digraph BrokenSyntaxDemo {
  A ->
}
```
