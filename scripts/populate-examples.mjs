import fs from 'fs';
import path from 'path';

// 1. 从 sampleFiles.ts 提取各文件内容
const sampleFileContent = fs.readFileSync('src/shared/data/sampleFiles.ts', 'utf8');

function extractFileContent(fileName) {
  const needle = `name: '${fileName}'`;
  const idx = sampleFileContent.indexOf(needle);
  if (idx === -1) {
    console.warn(`File ${fileName} not found in sampleFiles.ts`);
    return null;
  }
  const contentIdx = sampleFileContent.indexOf('content: `', idx);
  if (contentIdx === -1) {
    console.warn(`Content for ${fileName} not found`);
    return null;
  }
  const start = contentIdx + 'content: `'.length;
  // find matching closing quote with `,
  // Note: content might contain \` or `,
  let end = -1;
  for (let i = start; i < sampleFileContent.length; i++) {
    if (sampleFileContent[i] === '`' && sampleFileContent[i - 1] !== '\\') {
      if (sampleFileContent.slice(i, i + 5).startsWith('`,\n') || sampleFileContent.slice(i, i + 5).startsWith('`,\r\n')) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) {
    console.warn(`Could not find end of content for ${fileName}`);
    return null;
  }
  return sampleFileContent.slice(start, end).replace(/\\`/g, '`').replace(/\\\$/g, '$');
}

// 确保目录存在
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 2. Excalidraw 示例
ensureDir('examples/excalidraw');
const excalidrawArch = extractFileContent('architecture-sketch.excalidraw');
if (excalidrawArch) {
  fs.writeFileSync('examples/excalidraw/architecture-sketch.excalidraw', excalidrawArch);
}

// 补充 .excalidraw.json 示例
const wireframeExcalidraw = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: [
    {
      id: "box-header",
      type: "rectangle",
      x: 100,
      y: 60,
      width: 600,
      height: 60,
      angle: 0,
      strokeColor: "#2563eb",
      backgroundColor: "#dbeafe",
      fillStyle: "hachure",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      seed: 104234,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false
    },
    {
      id: "text-header",
      type: "text",
      x: 130,
      y: 78,
      width: 320,
      height: 24,
      angle: 0,
      strokeColor: "#1e3a8a",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: 887123,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text: "OmniView 统一工作台 (Header Bar)",
      fontSize: 18,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      baseline: 18,
      containerId: null,
      originalText: "OmniView 统一工作台 (Header Bar)"
    },
    {
      id: "box-sidebar",
      type: "rectangle",
      x: 100,
      y: 140,
      width: 180,
      height: 380,
      angle: 0,
      strokeColor: "#059669",
      backgroundColor: "#d1fae5",
      fillStyle: "hachure",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      seed: 234125,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false
    },
    {
      id: "text-sidebar",
      type: "text",
      x: 120,
      y: 160,
      width: 140,
      height: 100,
      angle: 0,
      strokeColor: "#065f46",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: 554212,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text: "📁 文件资源管理器\n- markdown/\n- mermaid/\n- typst/\n- excalidraw/\n- notebook/",
      fontSize: 14,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      baseline: 14,
      containerId: null,
      originalText: "📁 文件资源管理器\n- markdown/\n- mermaid/\n- typst/\n- excalidraw/\n- notebook/"
    },
    {
      id: "box-preview",
      type: "rectangle",
      x: 300,
      y: 140,
      width: 400,
      height: 380,
      angle: 0,
      strokeColor: "#7c3aed",
      backgroundColor: "#ede9fe",
      fillStyle: "hachure",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      seed: 998124,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false
    },
    {
      id: "text-preview",
      type: "text",
      x: 330,
      y: 170,
      width: 340,
      height: 120,
      angle: 0,
      strokeColor: "#5b21b6",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: 332190,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text: "🖥️ 主视口渲染区 (Viewer Canvas)\n\n• 多驱动自动分发\n• 双向同步与热重载\n• 矢量高保真平移与缩放\n• A4 物理排版与多页打印",
      fontSize: 15,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      baseline: 15,
      containerId: null,
      originalText: "🖥️ 主视口渲染区 (Viewer Canvas)\n\n• 多驱动自动分发\n• 双向同步与热重载\n• 矢量高保真平移与缩放\n• A4 物理排版与多页打印"
    }
  ],
  appState: {
    viewBackgroundColor: "#f8fafc",
    gridSize: 20
  }
};
fs.writeFileSync('examples/excalidraw/wireframe-flow.excalidraw.json', JSON.stringify(wireframeExcalidraw, null, 2));

// 3. Jupyter Notebook 示例
ensureDir('examples/notebook');
const jupyterNotebook = extractFileContent('deep-learning-analysis.ipynb');
if (jupyterNotebook) {
  fs.writeFileSync('examples/notebook/deep-learning-analysis.ipynb', jupyterNotebook);
}

// 补充 data-exploration.ipynb
const dataExplorationNotebook = {
  nbformat: 4,
  nbformat_minor: 2,
  metadata: {
    language_info: { name: "python", version: "3.11" },
    kernelspec: { display_name: "Python 3 (Data Science)", language: "python", name: "python3" }
  },
  cells: [
    {
      cell_type: "markdown",
      metadata: {},
      source: [
        "# 数据探索与多维统计分析\n",
        "\n",
        "本 Notebook 演示 OmniView 的纯端侧 Jupyter Notebook 渲染引擎，支持 Pandas 汇总表、LaTeX 数学公式与 ANSI 格式化输出。"
      ]
    },
    {
      cell_type: "code",
      execution_count: 1,
      metadata: {},
      source: [
        "import numpy as np\n",
        "import pandas as pd\n",
        "\n",
        "# 构建高并发微服务调用时延数据集\n",
        "np.random.seed(42)\n",
        "df = pd.DataFrame({\n",
        "    'service': ['auth-srv', 'order-srv', 'pay-gateway', 'inventory-srv', 'notify-srv'],\n",
        "    'qps': [12500, 8900, 4200, 7800, 3100],\n",
        "    'p95_ms': [12.4, 28.6, 45.1, 18.2, 8.5],\n",
        "    'p99_ms': [24.1, 58.2, 92.4, 36.7, 15.2],\n",
        "    'error_rate_%': [0.01, 0.04, 0.08, 0.02, 0.00]\n",
        "})\n",
        "df"
      ],
      outputs: [
        {
          output_type: "execute_result",
          execution_count: 1,
          data: {
            "text/plain": "        service    qps  p95_ms  p99_ms  error_rate_%\n0      auth-srv  12500    12.4    24.1          0.01\n1     order-srv   8900    28.6    58.2          0.04\n2   pay-gateway   4200    45.1    92.4          0.08\n3  inventory-srv   7800    18.2    36.7          0.02\n4    notify-srv   3100     8.5    15.2          0.00",
            "text/html": "<table border=\"1\" class=\"dataframe\">\n  <thead>\n    <tr style=\"text-align: right;\">\n      <th></th>\n      <th>service</th>\n      <th>qps</th>\n      <th>p95_ms</th>\n      <th>p99_ms</th>\n      <th>error_rate_%</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <th>0</th>\n      <td>auth-srv</td>\n      <td>12500</td>\n      <td>12.4</td>\n      <td>24.1</td>\n      <td>0.01</td>\n    </tr>\n    <tr>\n      <th>1</th>\n      <td>order-srv</td>\n      <td>8900</td>\n      <td>28.6</td>\n      <td>58.2</td>\n      <td>0.04</td>\n    </tr>\n    <tr>\n      <th>2</th>\n      <td>pay-gateway</td>\n      <td>4200</td>\n      <td>45.1</td>\n      <td>92.4</td>\n      <td>0.08</td>\n    </tr>\n    <tr>\n      <th>3</th>\n      <td>inventory-srv</td>\n      <td>7800</td>\n      <td>18.2</td>\n      <td>36.7</td>\n      <td>0.02</td>\n    </tr>\n    <tr>\n      <th>4</th>\n      <td>notify-srv</td>\n      <td>3100</td>\n      <td>8.5</td>\n      <td>15.2</td>\n      <td>0.00</td>\n    </tr>\n  </tbody>\n</table>"
          },
          metadata: {}
        }
      ]
    },
    {
      cell_type: "markdown",
      metadata: {},
      source: [
        "## 统计汇总与 SLO 达标率评估\n",
        "\n",
        "$$ \\text{Availability} = \\frac{\\sum \\text{Success Requests}}{\\sum \\text{Total Requests}} \\times 100\\% \\ge 99.99\\% $$"
      ]
    },
    {
      cell_type: "code",
      execution_count: 2,
      metadata: {},
      source: [
        "print('\\033[92m[PASS]\\033[0m 全链路综合 SLO 达标率: 99.985%')\n",
        "print('\\033[94m[INFO]\\033[0m 总吞吐量: 36,500 QPS | 平均 P99 响应时延: 45.32ms')"
      ],
      outputs: [
        {
          output_type: "stream",
          name: "stdout",
          text: [
            "\u001b[92m[PASS]\u001b[0m 全链路综合 SLO 达标率: 99.985%\n",
            "\u001b[94m[INFO]\u001b[0m 总吞吐量: 36,500 QPS | 平均 P99 响应时延: 45.32ms\n"
          ]
        }
      ]
    }
  ]
};
fs.writeFileSync('examples/notebook/data-exploration.ipynb', JSON.stringify(dataExplorationNotebook, null, 2));

// 4. Typst 示例
ensureDir('examples/typst');
const typstPaper = extractFileContent('quantum-computing-paper.typ');
if (typstPaper) {
  fs.writeFileSync('examples/typst/quantum-computing-paper.typ', typstPaper);
}
const typstResume = extractFileContent('software-engineer-resume.typ');
if (typstResume) {
  fs.writeFileSync('examples/typst/software-engineer-resume.typ', typstResume);
}
// 补充 .typst 后缀示例
const typstTechReport = `#set page(
  paper: "a4",
  margin: (x: 2cm, y: 2.5cm),
  header: align(right, text(8pt, fill: luma(120))[OmniView Architecture Report 2026]),
  footer: locate(loc => {
    let page_number = counter(page).at(loc).first()
    let total_pages = counter(page).final(loc).first()
    align(center, text(9pt)[- #page_number / #total_pages -])
  })
)
#set text(
  font: ("Liberation Sans", "PingFang SC", "Microsoft YaHei"),
  size: 10.5pt,
  lang: "zh"
)

#align(center)[
  #v(1cm)
  #text(18pt, weight: "bold", fill: rgb("#1e293b"))[OmniView 多内核统一渲染引擎技术白皮书]
  
  #v(0.3cm)
  #text(11pt, fill: rgb("#475569"))[极速、轻量、纯端侧 0 外部网络依赖的多格式可视化体系]
  
  #v(0.5cm)
  #grid(
    columns: (1fr, 1fr),
    align: (center, center),
    [ *作者*: OmniView Core Team ],
    [ *发布日期*: 2026年9月 ]
  )
  #v(0.8cm)
]

#outline(indent: auto)

#v(1cm)

= 系统概述与设计哲学

OmniView 是专为现代工程研发打造的多格式一体化预览与可视化工作台。支持从 Markdown、图表（Mermaid、PlantUML、Graphviz）、矢量图形 (SVG)、PDF 到 Jupyter Notebook、Typst 与 Excalidraw 等 15+ 种工程研发格式。

== 核心技术指标

- *零冷启动开销*: 采用 Web Worker 与驱动动态分发，按需异步懒加载；
- *内存极致收敛*: 空载内存占用低于 45MB，无大文件内存泄漏风险；
- *出版级 A4 排版*: 原生提供厘米级物理边距控制与双向分页打印流。

= 数学与算法基准

系统的分布式一致性判定算法遵从下述评估方程：

$ cal(L)(theta) = - sum_(i=1)^N log P(y_i | x_i; theta) + lambda / 2 ||theta||_2^2 $

其中 $lambda$ 表示权重衰减系数，$theta$ 为模型参数张量。

= 结论

OmniView 成功证明了基于现代 Web 标准构建全能型工程文档渲染器的可行性，兼具极致性能与卓越的可维护性。
`;
fs.writeFileSync('examples/typst/tech-report.typst', typstTechReport);

// 5. 数据与结构化格式示例 (CSV / TSV / JSON / YAML / XML)
ensureDir('examples/csv');
const csvContent = extractFileContent('performance-benchmarks.csv');
if (csvContent) {
  fs.writeFileSync('examples/csv/performance-benchmarks.csv', csvContent);
}

ensureDir('examples/tsv');
const tsvContent = extractFileContent('microservices-slo-telemetry.tsv');
if (tsvContent) {
  fs.writeFileSync('examples/tsv/microservices-slo-telemetry.tsv', tsvContent);
}

ensureDir('examples/json');
const jsonSpec = extractFileContent('rest-api-v1-spec.json');
if (jsonSpec) {
  fs.writeFileSync('examples/json/rest-api-v1-spec.json', jsonSpec);
}
const pkgJson = extractFileContent('package.json');
if (pkgJson) {
  fs.writeFileSync('examples/json/package.json', pkgJson);
}

ensureDir('examples/yaml');
const k8sYaml = extractFileContent('k8s-cluster-deployment.yaml');
if (k8sYaml) {
  fs.writeFileSync('examples/yaml/k8s-cluster-deployment.yaml', k8sYaml);
}
const cloudYml = extractFileContent('cloud-infrastructure.yaml');
if (cloudYml) {
  fs.writeFileSync('examples/yaml/cloud-infrastructure.yml', cloudYml);
}

ensureDir('examples/xml');
const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.omniview.core</groupId>
    <artifactId>omniview-gateway-service</artifactId>
    <version>0.10.1</version>
    <packaging>jar</packaging>

    <name>OmniView Gateway Microservice</name>
    <description>高性能云原生统一网关与多协议渲染路由分发服务</description>

    <properties>
        <java.version>21</java.version>
        <spring.boot.version>3.3.2</spring.boot.version>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-webflux</artifactId>
            <version>\${spring.boot.version}</version>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
            <version>\${spring.boot.version}</version>
        </dependency>
        <dependency>
            <groupId>io.micrometer</groupId>
            <artifactId>micrometer-registry-prometheus</artifactId>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
`;
fs.writeFileSync('examples/xml/pom.xml', pomXml);

const serviceConfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <app-meta>
        <name>OmniView Platform Services</name>
        <environment>production</environment>
        <region>ap-east-1</region>
        <cluster>k8s-prod-cluster-01</cluster>
    </app-meta>

    <render-engines>
        <driver name="markdown" engine="marked" enable-okf="true" max-depth="6" />
        <driver name="mermaid" engine="mermaid.js" theme="dark" security-level="strict" />
        <driver name="plantuml" engine="plantuml-encoder" format="svg" />
        <driver name="graphviz" engine="hpcc-js-wasm" layout="dot" />
        <driver name="typst" engine="typst-ast" paper="a4" />
        <driver name="notebook" engine="nbformat-v4" render-ansi="true" />
        <driver name="excalidraw" engine="excalidraw-utils" auto-sanitize="true" />
    </render-engines>

    <security-policy>
        <csp-mode>sandboxed</csp-mode>
        <dompurify-enabled>true</dompurify-enabled>
        <allow-scripts>false</allow-scripts>
    </security-policy>
</configuration>
`;
fs.writeFileSync('examples/xml/service-config.xml', serviceConfigXml);

// 6. 代码与脚本示例 (TS / TSX / JS / TXT)
ensureDir('examples/code');
const tsCode = extractFileContent('reactive-state-machine.ts');
if (tsCode) {
  fs.writeFileSync('examples/code/reactive-state-machine.ts', tsCode);
}

const tsxCode = `import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Cpu, HardDrive } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  status: 'healthy' | 'warning' | 'critical';
}

export const TelemetryCard: React.FC<MetricCardProps> = ({ title, value, unit, status }) => {
  const statusColor = {
    healthy: 'text-emerald-500 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800',
    warning: 'text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
    critical: 'text-rose-500 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800',
  }[status];

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</span>
        <span className={\`text-xs px-2 py-0.5 rounded-full border \${statusColor}\`}>
          {status}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">{value}</span>
        {unit && <span className="text-xs text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
    </div>
  );
};
`;
fs.writeFileSync('examples/code/telemetry-card.tsx', tsxCode);

const jsCode = `/**
 * OmniView 拓扑节点邻接矩阵与拓扑排序分析器
 */
export class GraphTopologyAnalyzer {
  constructor() {
    this.adjacencyList = new Map();
  }

  addNode(node) {
    if (!this.adjacencyList.has(node)) {
      this.adjacencyList.set(node, new Set());
    }
  }

  addEdge(from, to) {
    this.addNode(from);
    this.addNode(to);
    this.adjacencyList.get(from).add(to);
  }

  topologicalSort() {
    const inDegree = new Map();
    for (const node of this.adjacencyList.keys()) {
      inDegree.set(node, 0);
    }
    for (const neighbors of this.adjacencyList.values()) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
      }
    }

    const queue = [];
    for (const [node, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(node);
    }

    const order = [];
    while (queue.length > 0) {
      const curr = queue.shift();
      order.push(curr);

      const neighbors = this.adjacencyList.get(curr) || [];
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (order.length !== this.adjacencyList.size) {
      throw new Error('Graph contains cyclical dependencies');
    }
    return order;
  }
}
`;
fs.writeFileSync('examples/code/graph-topology.js', jsCode);

const txtNotes = `================================================================================
OmniView 研发工作台统一技术规范与支持格式一览
================================================================================

1. 文档与图表混合排版：
   - Markdown: .md, .markdown
   - Open Knowledge Format (OKF): .okf, *.okf.md

2. 独立架构与拓扑图表：
   - Mermaid: .mmd, .mermaid
   - PlantUML: .puml, .plantuml, .iuml
   - Graphviz: .dot, .gv, .graphviz
   - SVG 矢量分析: .svg

3. 专业排版与数据科学：
   - Excalidraw 手绘白板: .excalidraw, .excalidraw.json
   - Jupyter Notebook: .ipynb
   - Typst 现代排版: .typ, .typst
   - PDF 现代化阅读器: .pdf

4. 数据表格与结构化配置：
   - 表格: .csv, .tsv
   - 结构化: .json, .yaml, .yml, .xml

5. 源代码高亮：
   - .ts, .tsx, .js, .jsx, .txt

更多信息请访问: https://github.com/fsyyzz/OmniView
`;
fs.writeFileSync('examples/code/notes.txt', txtNotes);

// 7. 多后缀扩充：PlantUML (.plantuml, .iuml)
ensureDir('examples/plantuml');
const pumlOrder = extractFileContent('order-fulfillment-lifecycle.puml');
if (pumlOrder) {
  fs.writeFileSync('examples/plantuml/order-fulfillment.plantuml', pumlOrder);
}
const pumlIuml = `@startuml
!theme plain
skinparam componentStyle rectangle
skinparam backgroundColor transparent

package "OmniView Webview Core" {
  [Driver Dispatcher] as Dispatcher
  [Markdown Engine] as Markdown
  [Excalidraw Engine] as Excalidraw
  [Jupyter Engine] as Jupyter
  [Typst Engine] as Typst
  [PDF.js Engine] as PdfJs
}

package "Extension Host" {
  [CustomEditorProvider] as Provider
  [File Watcher] as Watcher
  [IPC Channel] as IPC
}

Provider --> IPC : 双向 JSON-RPC
IPC --> Dispatcher : 广播 FileItem 数据
Dispatcher --> Markdown : 分发 .md / .okf
Dispatcher --> Excalidraw : 分发 .excalidraw
Dispatcher --> Jupyter : 分发 .ipynb
Dispatcher --> Typst : 分发 .typ
Dispatcher --> PdfJs : 分发 .pdf

@enduml
`;
fs.writeFileSync('examples/plantuml/component-diagram.iuml', pumlIuml);

// 8. 多后缀扩充：Mermaid (.mermaid)
ensureDir('examples/mermaid');
const mermaidUserJourney = `journey
    title 用户在 OmniView 打开并编辑多格式文件的完整旅程
    section 文件打开
      在 VS Code 资源管理器双击 .excalidraw 文件: 5: 用户
      OmniView 自定义编辑器毫秒级冷启动: 5: OmniView
      驱动路由自动匹配至 ExcalidrawViewer: 5: OmniView
    section 交互与编辑
      在矢量画布上拖拽节点、缩放与调整画笔: 4: 用户
      开启双向分屏模式同步修改 JSON 源码: 5: 用户, OmniView
      画布实时响应热重载: 5: OmniView
    section 产物交付
      导出出版级 A4 PDF 与 SVG 矢量图: 5: 用户
      一键无损保存至磁盘: 5: OmniView
`;
fs.writeFileSync('examples/mermaid/user-journey.mermaid', mermaidUserJourney);

// 9. 多后缀扩充：Graphviz (.gv)
ensureDir('examples/graphviz');
const gvDependency = `digraph OmniViewDependencies {
  rankdir=LR;
  node [shape=box, style="rounded,filled", fontname="sans-serif", fontsize=11, fillcolor="#f1f5f9", color="#94a3b8"];
  edge [fontname="sans-serif", fontsize=9, color="#64748b"];

  Webview [label="Webview App\n(React 19 + Vite 6)", fillcolor="#dbeafe", color="#3b82f6"];
  ExtensionHost [label="Extension Host\n(Node.js + VS Code API)", fillcolor="#e0e7ff", color="#6366f1"];

  Webview -> MarkmapLib [label="思维导图"];
  Webview -> MermaidJs [label="流程图/时序图"];
  Webview -> WasmGraphviz [label="DOT 拓扑 (WASM)"];
  Webview -> PdfJs [label="PDF 真实光栅化"];
  Webview -> ExcalidrawUtils [label="白板图元矢量流"];
  Webview -> TypstAst [label="出版级 A4 排版"];
  Webview -> Nbformat [label="Jupyter Notebook"];

  ExtensionHost -> Webview [label="postMessage (JSON-RPC)"];
}
`;
fs.writeFileSync('examples/graphviz/dependency-graph.gv', gvDependency);

// 10. 多后缀扩充：Mindmap (.mm, .km, .mindmap)
ensureDir('examples/markmap');
const freemindXml = `<map version="1.0.1">
  <node TEXT="OmniView 平台能力演进全景">
    <node TEXT="1. 核心排版引擎">
      <node TEXT="Markdown GFM 标准与 GitHub Callout 提醒块"/>
      <node TEXT="LaTeX 与 KaTeX 数学公式支持"/>
      <node TEXT="Google OKF (Open Knowledge Format) 知识图谱"/>
    </node>
    <node TEXT="2. 独立架构建模">
      <node TEXT="Mermaid 动态图表 (.mmd, .mermaid)"/>
      <node TEXT="PlantUML 架构时序 (.puml, .plantuml, .iuml)"/>
      <node TEXT="Graphviz DOT 拓扑 (.dot, .gv)"/>
    </node>
    <node TEXT="3. 数据科学与现代排版">
      <node TEXT="Excalidraw 手绘白板 (.excalidraw, .excalidraw.json)"/>
      <node TEXT="Jupyter Notebook 交互分析 (.ipynb)"/>
      <node TEXT="Typst 出版级学术排版 (.typ, .typst)"/>
    </node>
  </node>
</map>
`;
fs.writeFileSync('examples/markmap/feature-roadmap.mm', freemindXml);

const kityminderJson = {
  root: {
    data: { id: "root", text: "OmniView 产品规划与架构矩阵" },
    children: [
      {
        data: { id: "c1", text: "零网络依赖与纯端侧安全" },
        children: [
          { data: { id: "c11", text: "WASM 本地离线编译" } },
          { data: { id: "c12", text: "DOMPurify XSS 渗透防御" } },
          { data: { id: "c13", text: "CSP 严格沙箱隔离" } }
        ]
      },
      {
        data: { id: "c2", text: "全格式与双向编辑" },
        children: [
          { data: { id: "c21", text: "15+ 种研发文件格式全覆盖" } },
          { data: { id: "c22", text: "所见即所得与源码分屏双向联动" } },
          { data: { id: "c23", text: "A4 2.0 工业级物理分页与导出" } }
        ]
      }
    ]
  },
  template: "right",
  theme: "fresh-blue",
  version: "1.4.43"
};
fs.writeFileSync('examples/markmap/product-planning.km', JSON.stringify(kityminderJson, null, 2));

const decisionTreeMindmap = `# OmniView 文件格式与驱动路由判定树

## 1. 文档类文件
### 1.1 富文本 Markdown
- .md
- .markdown
- .mdown
### 1.2 知识图谱
- .okf
- *.okf.md

## 2. 独立图表与矢量
### 2.1 拓扑与时序
- Mermaid (.mmd, .mermaid)
- PlantUML (.puml, .plantuml, .iuml)
- Graphviz (.dot, .gv)
### 2.2 矢量分析
- SVG (.svg)

## 3. 专业白板与数据科学
### 3.1 手绘白板
- Excalidraw (.excalidraw, .excalidraw.json)
### 3.2 交互计算
- Jupyter Notebook (.ipynb)
### 3.3 现代排版
- Typst (.typ, .typst)
### 3.4 电子书与白皮书
- PDF (.pdf)

## 4. 结构化数据与代码
### 4.1 表格与配置
- .csv, .tsv
- .json, .yaml, .yml, .xml
### 4.2 源代码
- .ts, .tsx, .js, .jsx, .txt
`;
fs.writeFileSync('examples/markmap/decision-tree.mindmap', decisionTreeMindmap);

// 11. PDF 真实合法文件
ensureDir('examples/pdf');

function generateValidPdfBytes() {
  const pages = [
    {
      title: 'OmniView Architecture Standard Whitepaper',
      sub: 'Section 1.0 - Project Overview & Evolution (100% MIT License)',
      body: [
        'Visual Studio Code has become the primary workbench for global developers.',
        'OmniView delivers instant, lightweight, zero-paywall previewing for Markdown, Mermaid, PlantUML, SVG, and real PDF documents.',
        'Designed with a decoupled driver micro-kernel to keep RAM overhead under 45MB while eliminating commercial VIP restrictions.',
      ],
      tag: 'ARCHITECTURE SPECIFICATION',
    },
    {
      title: 'Sandboxed IPC Protocol & Security Architecture',
      sub: 'Section 2.0 - Security & Protocol Specification',
      body: [
        'The Extension Host (Node.js) and Webview (Chromium) operate in isolated process boundaries.',
        'All communications flow over typed JSON-RPC message contracts with bidirectional live hot reload.',
        'Rigorous Content Security Policies (CSP) and DOMPurify sanitization strictly eliminate XSS attack vectors.',
      ],
      tag: 'IPC SECURITY PROTOCOL',
    },
    {
      title: 'Multi-Driver Lazy Loading Architecture',
      sub: 'Section 3.0 - Driver Architecture Matrix',
      body: [
        'Each format (Markdown, PlantUML, SVG, CSV, PDF, Typst, Excalidraw, Notebook) is encapsulated into an isolated lazy-loaded driver.',
        'The PDF Driver utilizes Mozilla PDF.js v4+ with Web Worker acceleration and Canvas rasterization.',
        'Provides full resolution Hi-DPI multi-page navigation, smooth zooming, and clockwise 90 degree rotation.',
      ],
      tag: 'DRIVER LAZY-LOADING',
    },
    {
      title: 'Deployment & Verification Runbook',
      sub: 'Section 4.0 - Production Readiness Checklist',
      body: [
        'Packaged into standard .vsix extensions using official @vscode/vsce tooling.',
        'Continuous integration pipeline validates zero memory leaks and 100% diagram diagnostic test passes.',
        '100% Free & Open Source under the permissive MIT license for the entire developer community.',
      ],
      tag: 'PRODUCTION RUNBOOK',
    },
  ];

  let objId = 1;
  const catalogId = objId++;
  const pagesId = objId++;
  const fontId = objId++;
  const fontBoldId = objId++;

  const pageIds = [];
  const contentIds = [];

  for (let i = 0; i < pages.length; i++) {
    pageIds.push(objId++);
    contentIds.push(objId++);
  }

  const objects = [];

  // Catalog
  objects.push({ id: catalogId, data: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` });

  // Pages
  const kidsStr = pageIds.map(id => `${id} 0 R`).join(' ');
  objects.push({ id: pagesId, data: `<< /Type /Pages /Kids [${kidsStr}] /Count ${pages.length} >>` });

  // Fonts
  objects.push({ id: fontId, data: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>' });
  objects.push({ id: fontBoldId, data: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>' });

  // Each page and content
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const pageObjId = pageIds[i];
    const contentObjId = contentIds[i];

    objects.push({
      id: pageObjId,
      data: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 ${fontId} 0 R /F2 ${fontBoldId} 0 R >> >> >>`,
    });

    const stream = [
      '0.06 0.1 0.18 rg',
      '40 765 515 36 re f',
      'BT',
      '/F2 13 Tf',
      '0.3 0.7 1.0 rg',
      '55 778 Td',
      `(${p.tag}) Tj`,
      'ET',
      'BT',
      '/F2 20 Tf',
      '0.08 0.12 0.22 rg',
      '40 715 Td',
      `(${p.title}) Tj`,
      'ET',
      'BT',
      '/F1 12 Tf',
      '0.35 0.42 0.52 rg',
      '40 685 Td',
      `(${p.sub}) Tj`,
      'ET',
      '0.85 0.88 0.92 RG',
      '1 w',
      '40 665 m 555 665 l S',
      'BT',
      '/F1 11 Tf',
      '0.15 0.2 0.28 rg',
      '18 TL',
      '40 630 Td',
      `(${p.body[0]}) Tj T*`,
      `(${p.body[1]}) Tj T*`,
      `(${p.body[2]}) Tj T*`,
      'ET',
      '0.95 0.97 1.0 rg',
      '40 450 515 110 re f',
      '0.2 0.5 0.9 RG',
      '1.5 w',
      '40 450 515 110 re S',
      'BT',
      '/F2 12 Tf',
      '0.1 0.35 0.75 rg',
      '55 530 Td',
      '(OmniView Multi-Driver Highlights) Tj',
      'ET',
      'BT',
      '/F1 10 Tf',
      '0.2 0.25 0.35 rg',
      '16 TL',
      '55 505 Td',
      '(- 100% Free & Open-Source under MIT License) Tj T*',
      '(- Multi-core Canvas rasterization with Web Worker acceleration) Tj T*',
      '(- Zero telemetry, fully offline & zero network dependencies) Tj T*',
      'ET',
      '0.85 0.88 0.92 RG',
      '1 w',
      '40 60 m 555 60 l S',
      'BT',
      '/F1 9 Tf',
      '0.5 0.55 0.65 rg',
      '40 42 Td',
      '(OmniView Technical Whitepaper - Published with Pride under MIT License) Tj',
      'ET',
      'BT',
      '/F2 9 Tf',
      '0.2 0.4 0.8 rg',
      '510 42 Td',
      `([ Page ${i + 1} of ${pages.length} ]) Tj`,
      'ET',
    ].join('\n');

    const streamLength = Buffer.byteLength(stream, 'latin1');
    objects.push({
      id: contentObjId,
      data: `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`,
    });
  }

  // Sort by object id
  objects.sort((a, b) => a.id - b.id);

  let pdfStr = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const xrefOffsets = [];

  for (const obj of objects) {
    xrefOffsets.push(Buffer.byteLength(pdfStr, 'latin1'));
    pdfStr += `${obj.id} 0 obj\n${obj.data}\nendobj\n`;
  }

  const startxref = Buffer.byteLength(pdfStr, 'latin1');
  pdfStr += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of xrefOffsets) {
    const padded = String(offset).padStart(10, '0');
    pdfStr += `${padded} 00000 n \n`;
  }

  pdfStr += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(pdfStr, 'latin1');
}

fs.writeFileSync('examples/pdf/technical-whitepaper.pdf', generateValidPdfBytes());

console.log('Successfully generated all comprehensive example files!');
