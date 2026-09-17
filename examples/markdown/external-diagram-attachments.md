# Markdown 全量外挂图形与导图文件直接内联渲染示例

本示例展示了 OmniView 在 Markdown 中对全系列外挂图形与导图工程文件（`.egn` 领域故事、`.excalidraw` 手绘白板、`.mmd` / `.mermaid` 流程图、`.puml` / `.plantuml` 架构图、`.dot` / `.graphviz` 拓扑图、`.markmap` 思维导图、`.svg` 矢量图）进行**直接内联渲染**的完整效果。

---

## 1. 领域故事模型 (`.egn` / `.domainstory`) 直接内联渲染

读取外挂 `.egn` 业务模型文件，自动解析并在正文直接生成可交互流程图卡片：

### A. WikiLink 嵌入语法 (`![[...]]`)
![[../domainstory/ecommerce-fulfillment.egn]]

---

## 2. Excalidraw 手绘白板 (`.excalidraw`) 直接内联渲染

直接嵌入 `.excalidraw` JSON 源文件，自动通过矢量渲染管线解析并内嵌为高清晰手绘白板图像：

### A. WikiLink 嵌入语法 (`![[...]]`)
![[../excalidraw/architecture-sketch.excalidraw]]

---

## 3. Mermaid 图表 (`.mmd` / `.mermaid`) 直接内联渲染

嵌入独立的外部 `.mmd` 流程图源文件：

### A. Standard Markdown 图片嵌入 (`![alt](...)`)
![OmniView 渲染管线图](../mermaid/omniview-render-pipeline.mmd)

### B. WikiLink 嵌入语法 (`![[...]]`)
![[../mermaid/user-journey.mermaid]]

---

## 4. PlantUML 架构图 (`.puml` / `.plantuml`) 直接内联渲染

外部独立的 `.puml` 与 `.plantuml` 云架构图文件嵌入：

### A. WikiLink 嵌入语法 (`![[...]]`)
![[../plantuml/cloud-topology.puml]]

### B. Standard Markdown 图片嵌入 (`![alt](...)`)
![订单履约架构图](../plantuml/order-fulfillment.plantuml)

---

## 5. Graphviz DOT 拓扑图 (`.dot` / `.graphviz`) 直接内联渲染

嵌入外部独立的 Graphviz `.dot` 有向图与拓扑图文本文件：

### A. WikiLink 嵌入语法 (`![[...]]`)
![[../graphviz/cloud-architecture.dot]]

---

## 6. Markmap 思维导图 (`.markmap`) 直接内联渲染

外部独立的 `.markmap` 思维导图节点源文件嵌入：

### A. Standard Markdown 图片嵌入 (`![alt](...)`)
![系统架构思维导图](../markmap/system-architecture.markmap)

---

## 7. SVG 矢量图直接内联渲染 (原生完美支持)

支持嵌入外部 `.svg` 矢量文件并自定义呈现宽度：

![[../svg/performance-radar-chart.svg|360]]

---

## 8. 外挂文件超链接挂载与独立跳转

如果您希望仅保留快捷打开链接，可以使用不带 `!` 前缀的普通跳转链接：

- [[../domainstory/ecommerce-fulfillment.egn|点击在独立工作台中打开领域故事 (.egn)]]
- [[../excalidraw/architecture-sketch.excalidraw|点击在独立工作台中打开手绘白板 (.excalidraw)]]
- [在独立 Viewer 中打开 Mermaid](../mermaid/omniview-render-pipeline.mmd)
- [在独立 Viewer 中打开 PlantUML](../plantuml/cloud-topology.puml)
- [在独立 Viewer 中打开 Graphviz](../graphviz/cloud-architecture.dot)
- [在独立 Viewer 中打开 Markmap](../markmap/system-architecture.markmap)

---

## 9. 全支持外挂格式矩阵汇总

| 格式分类 | 支持的扩展名 | 外挂嵌入语法示例 | 渲染机制与效果 |
| :--- | :--- | :--- | :--- |
| **Domain Story** | `.egn`, `.domainstory` | `![[../domainstory/ecommerce-fulfillment.egn]]` | 正文直接解析并渲染为全功能交互领域故事卡片 |
| **Excalidraw 白板** | `.excalidraw`, `.excalidraw.json` | `![[../excalidraw/architecture-sketch.excalidraw]]` | 正文直接解析 JSON 并绘制内嵌高清手绘 SVG 画布 |
| **Mermaid 图表** | `.mmd`, `.mermaid` | `![](../mermaid/omniview-render-pipeline.mmd)` | 正文直接解析 `.mmd` 源码并渲染为 Mermaid 流程图卡片 |
| **PlantUML 架构** | `.puml`, `.plantuml` | `![[../plantuml/cloud-topology.puml]]` | 正文直接解析 `.puml` 并实时渲染为 PlantUML 矢量图 |
| **Graphviz 拓扑** | `.dot`, `.graphviz` | `![[../graphviz/cloud-architecture.dot]]` | 正文直接解析 `.dot` 并渲染为 Graphviz 拓扑网络 |
| **Markmap 导图** | `.markmap` | `![](../markmap/system-architecture.markmap)` | 正文直接解析 Markdown 节点并渲染为 Markmap 导图 |
| **SVG 矢量图** | `.svg` | `![[../svg/performance-radar-chart.svg\|360]]` | 正文直接展示矢量图像（支持灯箱放大预览） |
