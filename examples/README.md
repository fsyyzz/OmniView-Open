# OmniView 示例文件集

用于验证 VS Code 插件与独立工作台的多格式渲染。安装插件后，可用 **OmniView 文件渲染器** 打开对应文件。

## 目录总览

| 目录 | 格式 | 说明 |
| --- | --- | --- |
| [markdown/](./markdown/) | `.md` | Markdown 排版、内嵌图表、公式与压测 |
| [mermaid/](./mermaid/) | `.mmd` | 独立 Mermaid 图表源文件 |
| [plantuml/](./plantuml/) | `.puml` | 独立 PlantUML 架构建模文件 |
| [graphviz/](./graphviz/) | `.dot` | 独立 Graphviz / DOT 拓扑文件 |
| [markmap/](./markmap/) | `.markmap` | 独立 Markmap 思维导图文件 |
| [svg/](./svg/) | `.svg` | 独立 SVG 矢量示例 |
| [okf/](./okf/) | `.okf` / OKF Markdown | Open Knowledge Format 知识目录 |

## 独立图表示例（本次补齐）

| 文件 | 驱动 | 覆盖内容 |
| --- | --- | --- |
| [mermaid/omniview-render-pipeline.mmd](./mermaid/omniview-render-pipeline.mmd) | Mermaid | 渲染流水线流程图 |
| [plantuml/cloud-topology.puml](./plantuml/cloud-topology.puml) | PlantUML | 微服务时序拓扑 |
| [graphviz/cloud-architecture.dot](./graphviz/cloud-architecture.dot) | Graphviz | 云原生有向拓扑 |
| [markmap/system-architecture.markmap](./markmap/system-architecture.markmap) | Mindmap / Markmap | 平台能力思维导图 |

建议验证顺序：先打开四个独立图表文件确认驱动分发，再进入 `markdown/` 验证内嵌代码块渲染。
