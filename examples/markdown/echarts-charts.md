# Apache ECharts 商业级图表与响应式仪表盘示例

本文档用于演示 OmniView 对 **Apache ECharts** 矢量图表引擎的深度集成。支持在 Markdown 中直接内嵌标准 ECharts 配置、类型快捷语法糖、纯数据简写，并可与 `> [!CARDS:列数]` 响应式卡片网格无缝组合，打造工业级指标监控仪表盘。

---

## 💡 核心特性概览

> [!TIP] OmniView ECharts 原生集成优势
> - **SVG 矢量渲染**：默认采用 `renderer: 'svg'`，在 Retina 高分屏与缩放下保持绝对高清无锯齿；
> - **`--ov-*` 设计令牌自适应**：图表背景、文字、坐标轴、网格线与悬浮 Tooltip 自动适应 VS Code 深色与浅色主题；
> - **微型交互胶囊**：图表右上角提供**重绘**、**复制代码**、**导出 SVG/PNG** 与 **全屏灯箱沉浸式检视**；
> - **微秒级尺寸响应**：内置 `ResizeObserver`，无论是分屏、侧边栏拉伸还是卡片网格重排，图表始终 100% 贴合容器。

---

## 一、标准 ECharts 图表 (YAML / JSON 配置)

在 Markdown 中使用 ```` ```echarts ```` 声明图表，支持标准 YAML 或 JSON 配置语法：

### 1. 多维度业务吞吐与延迟趋势折线图

```echarts
title:
  text: "生产集群 QPS 吞吐量与平均延迟趋势"
  subtext: "数据采集周期: 最近 24 小时 (按小时聚合)"
tooltip:
  trigger: "axis"
legend:
  data: ["QPS (kReq/s)", "P99 延迟 (ms)"]
xAxis:
  type: "category"
  boundaryGap: false
  data: ["00:00", "03:00", "06:00", "09:00", "12:00", "15:00", "18:00", "21:00", "24:00"]
yAxis:
  - type: "value"
    name: "吞吐量"
  - type: "value"
    name: "延迟 (ms)"
series:
  - name: "QPS (kReq/s)"
    type: "line"
    smooth: true
    data: [35, 28, 42, 125, 210, 245, 290, 185, 92]
  - name: "P99 延迟 (ms)"
    type: "line"
    smooth: true
    yAxisIndex: 1
    data: [18, 16, 17, 32, 45, 48, 52, 38, 22]
```

---

## 二、类型前缀语法糖 (`echarts:类型`)

使用 ```` ```echarts:类型 ```` 语法糖，OmniView 会自动推断并补齐基础坐标轴与骨架配置：

### 1. 柱状图 (`echarts:bar`)

```echarts:bar
title:
  text: "各格式 Viewer 首次渲染耗时对比 (ms)"
xAxis:
  data: ["Markdown", "Mermaid", "Graphviz", "Typst", "PDF.js", "Docx"]
yAxis:
  type: "value"
series:
  - name: "冷启动耗时"
    type: "bar"
    data: [42, 85, 120, 140, 180, 210]
  - name: "二次热重载耗时"
    type: "bar"
    data: [6, 12, 15, 18, 24, 30]
```

### 2. 环形占比图 (`echarts:pie`)

```echarts:pie
title:
  text: "工作台文档格式访问占比分布"
  left: "center"
series:
  - name: "访问量"
    type: "pie"
    radius: ["40%", "70%"]
    avoidLabelOverlap: false
    itemStyle:
      borderRadius: 10
      borderColor: "#fff"
      borderWidth: 2
    data:
      - value: 1048
        name: "Markdown"
      - value: 735
        name: "Mermaid / 图表"
      - value: 580
        name: "PDF 电子书"
      - value: 484
        name: "Office 文档"
      - value: 300
        name: "代码与数据源"
```

### 3. 雷达图 (`echarts:radar`)

```echarts:radar
title:
  text: "多维架构治理能力雷达"
radar:
  indicator:
    - name: "渲染稳帧"
      max: 100
    - name: "安全防护"
      max: 100
    - name: "分层解耦"
      max: 100
    - name: "自动化门禁"
      max: 100
    - name: "离线优先"
      max: 100
    - name: "主题贴合"
      max: 100
series:
  - name: "OmniView 评分"
    type: "radar"
    data:
      - value: [96, 99, 95, 98, 100, 97]
        name: "OmniView v1.3.22"
```

---

## 三、极速纯数据数组语法糖

无需书写任何配置层级，直接放入数组即可生成极速简报图：

```echarts:line
[120, 182, 191, 234, 290, 330, 310, 420, 480]
```

---

## 四、与 `> [!CARDS:列数]` 结合的多列指标监控大屏

ECharts 图表可直接作为内容嵌套在 OmniView 多列卡片矩阵中，构建真正的商业级交互仪表盘。

### 1. 双列运维监控看板 (`> [!CARDS:2]`)

> [!CARDS:2] 核心集群指标实时监控
> - ### 📊 节点异常与告警分类
>   ```echarts:pie
>   series:
>     - name: "告警分类"
>       type: "pie"
>       radius: "60%"
>       data:
>         - value: 40
>           name: "内存水位高"
>         - value: 28
>           name: "网络丢包"
>         - value: 20
>           name: "磁盘空间预警"
>         - value: 12
>           name: "GC 停顿超阈值"
>   ```
> - ### 📈 自动化门禁各阶段耗时 (ms)
>   ```echarts:bar
>   xAxis:
>     type: "category"
>     data: ["Lint", "AST", "Diff", "E2E", "Build"]
>   yAxis:
>     type: "value"
>   series:
>     - type: "bar"
>       data: [120, 45, 80, 210, 160]
>   ```

---

### 2. 三列微服务度量看板 (`> [!CARDS:3]`)

> [!CARDS:3] 微服务调用质量与健康度
> - ### ⚡ RPC 接口成功率 (%)
>   ```echarts:line
>   xAxis:
>     type: "category"
>     data: ["10:00", "11:00", "12:00", "13:00", "14:00"]
>   yAxis:
>     min: 99.5
>     max: 100
>   series:
>     - type: "line"
>       smooth: true
>       data: [99.95, 99.98, 99.89, 99.99, 100]
>   ```
> - ### 📦 容器副本扩展分布
>   ```echarts:bar
>   xAxis:
>     type: "category"
>     data: ["Auth", "Order", "Pay", "Doc"]
>   yAxis:
>     type: "value"
>   series:
>     - type: "bar"
>       data: [8, 16, 24, 6]
>   ```
> - ### ⏱️ 缓存命中率分布
>   ```echarts:pie
>   series:
>     - type: "pie"
>       radius: ["35%", "65%"]
>       data:
>         - value: 85
>           name: "L1 本地缓存"
>         - value: 12
>           name: "L2 Redis"
>         - value: 3
>           name: "DB 回源"
>   ```
