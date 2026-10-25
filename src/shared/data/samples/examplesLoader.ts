/**
 * 基于 examples/ 目录的真实文件动态生成演示工作区 FileItem 列表。
 *
 * 替代原先 4 个庞大的内嵌样本文件 (diagramSamples / documentSamples /
 * dataSamples / cloudNativeSamples)，直接将 examples/ 中 80+ 个真实文件
 * 作为 INITIAL_FILES 注入工作区，避免数据双份维护。
 *
 * 文本文件通过 import(file + '?raw') 内联为 content 字符串；
 * 二进制文件（PDF/DOCX/PPTX/XLSX/图片）通过 import(file) 获取 asset URL，
 * 标记 binaryUrl 供浏览器按需加载。
 *
 * 使用同步 import 保证 dev 和 prod 均正确解析。
 */
import type { FileItem } from '../../types';

// ============================================================
// 文本文件：import ?raw 内联为字符串
// ============================================================

// Code
import codeGraphTopology from '../../../../examples/code/graph-topology.js?raw';
import codeNotes from '../../../../examples/code/notes.txt?raw';
import codeReactiveStateMachine from '../../../../examples/code/reactive-state-machine.ts?raw';
import codeTelemetryCard from '../../../../examples/code/telemetry-card.tsx?raw';

// CSV
import csvPerformanceBenchmarks from '../../../../examples/csv/performance-benchmarks.csv?raw';

// Docker
import dockerCompose from '../../../../examples/docker/docker-compose.yml?raw';
import dockerDockerfile from '../../../../examples/docker/Dockerfile?raw';

// Domain Story
import domainStoryEcommerce from '../../../../examples/domainstory/ecommerce-fulfillment.dst?raw';
import domainStoryEcommerceEgn from '../../../../examples/domainstory/ecommerce-fulfillment.egn?raw';
import domainStoryLeave from '../../../../examples/domainstory/leave-approval.domainstory?raw';

// Excalidraw
import excalidrawArchitecture from '../../../../examples/excalidraw/architecture-sketch.excalidraw?raw';
import excalidrawWireframe from '../../../../examples/excalidraw/wireframe-flow.excalidraw.json?raw';

// Graphviz
import graphvizCloud from '../../../../examples/graphviz/cloud-architecture.dot?raw';
import graphvizDependency from '../../../../examples/graphviz/dependency-graph.gv?raw';

// HTML
import htmlDashboard from '../../../../examples/html/interactive-dashboard.html?raw';

// JSON
import jsonPackage from '../../../../examples/json/package.json?raw';
import jsonRestApi from '../../../../examples/json/rest-api-v1-spec.json?raw';

// K8s
import k8sMicroservices from '../../../../examples/k8s/microservices.yaml?raw';

// Markdown
import mdArchitectureSpec from '../../../../examples/markdown/architecture-spec.md?raw';
import mdBasic from '../../../../examples/markdown/basic-markdown.md?raw';
import mdCallouts from '../../../../examples/markdown/callouts-and-tasks.md?raw';
import mdCodeBlocks from '../../../../examples/markdown/code-blocks.md?raw';
import mdCodeRendering from '../../../../examples/markdown/code-rendering-spec.md?raw';
import mdConsensus from '../../../../examples/markdown/consensus-algorithms.md?raw';
import mdDiagrams from '../../../../examples/markdown/diagrams.md?raw';
import mdDomainStory from '../../../../examples/markdown/domain-storytelling.md?raw';
import mdEcharts from '../../../../examples/markdown/echarts-charts.md?raw';
import mdExternalDiagrams from '../../../../examples/markdown/external-diagram-attachments.md?raw';
import mdGfm from '../../../../examples/markdown/gfm-features.md?raw';
import mdGithubAlerts from '../../../../examples/markdown/github-alert-callouts.md?raw';
import mdGraphvizDiagrams from '../../../../examples/markdown/graphviz-diagrams.md?raw';
import mdTables from '../../../../examples/markdown/markdown-tables.md?raw';
import mdMathTest from '../../../../examples/markdown/math-and-diagrams-test.md?raw';
import mdMathFormulas from '../../../../examples/markdown/math-formulas.md?raw';
import mdMermaidGallery from '../../../../examples/markdown/mermaid-visual-gallery.md?raw';
import mdObsidian from '../../../../examples/markdown/obsidian-wiki-links.md?raw';
import mdPandoc from '../../../../examples/markdown/pandoc-extras.md?raw';
import mdStability from '../../../../examples/markdown/stability-stress-test.md?raw';
import mdTableViz from '../../../../examples/markdown/table-visualization-spec.md?raw';
import mdTechGuide from '../../../../examples/markdown/technical-guide.md?raw';

// Markmap
import markmapDecisionTree from '../../../../examples/markmap/decision-tree.mindmap?raw';
import markmapFeatureRoadmap from '../../../../examples/markmap/feature-roadmap.mm?raw';
import markmapProductPlanning from '../../../../examples/markmap/product-planning.km?raw';
import markmapSystemArch from '../../../../examples/markmap/system-architecture.markmap?raw';

// Mermaid
import mermaidRenderPipeline from '../../../../examples/mermaid/omniview-render-pipeline.mmd?raw';
import mermaidUserJourney from '../../../../examples/mermaid/user-journey.mermaid?raw';

// Notebook
import notebookDataExploration from '../../../../examples/notebook/data-exploration.ipynb?raw';
import notebookDeepLearning from '../../../../examples/notebook/deep-learning-analysis.ipynb?raw';

// OKF
import okfIndex from '../../../../examples/okf/index.md?raw';
import okfKnowledgeCatalog from '../../../../examples/okf/knowledge-catalog.okf?raw';
import okfWauMetrics from '../../../../examples/okf/metrics/weekly_active_users.md?raw';
import okfWauMetricsOkf from '../../../../examples/okf/metrics/weekly_active_users.okf.md?raw';
import okfCustomers from '../../../../examples/okf/tables/customers.md?raw';
import okfCustomersOkf from '../../../../examples/okf/tables/customers.okf.md?raw';
import okfOrders from '../../../../examples/okf/tables/orders.md?raw';
import okfOrdersOkf from '../../../../examples/okf/tables/orders.okf.md?raw';

// PlantUML
import plantumlCloudTopology from '../../../../examples/plantuml/cloud-topology.puml?raw';
import plantumlComponentDiagram from '../../../../examples/plantuml/component-diagram.iuml?raw';
import plantumlOrderFulfillment from '../../../../examples/plantuml/order-fulfillment.plantuml?raw';

// SVG
import svg4c1 from '../../../../examples/svg/00-4加1架构视图模型.svg?raw';
import svgCloudInfra from '../../../../examples/svg/cloud-infrastructure.svg?raw';
import svgMicroservices from '../../../../examples/svg/microservices-cloud-topology.svg?raw';
import svgPerfRadar from '../../../../examples/svg/performance-radar-chart.svg?raw';
import svgServiceTelemetry from '../../../../examples/svg/service-telemetry-metrics.svg?raw';

// TOML
import tomlCargo from '../../../../examples/toml/cargo-workspace.toml?raw';
import tomlPyproject from '../../../../examples/toml/pyproject.toml?raw';

// TSV
import tsvMicroservices from '../../../../examples/tsv/microservices-slo-telemetry.tsv?raw';

// Typst
import typstQuantum from '../../../../examples/typst/quantum-computing-paper.typ?raw';
import typstResume from '../../../../examples/typst/software-engineer-resume.typ?raw';
import typstTechReport from '../../../../examples/typst/tech-report.typst?raw';

// XML
import xmlPom from '../../../../examples/xml/pom.xml?raw';
import xmlServiceConfig from '../../../../examples/xml/service-config.xml?raw';

// YAML
import yamlCloudInfra from '../../../../examples/yaml/cloud-infrastructure.yml?raw';
import yamlK8sCluster from '../../../../examples/yaml/k8s-cluster-deployment.yaml?raw';

// ============================================================
// 二进制文件：import(file) 获取 Vite asset URL
// ============================================================
import pdfUrl from '../../../../examples/pdf/technical-whitepaper.pdf';
import docxUrl from '../../../../examples/docx/omniview-architecture-guide.docx';
import pptxUrl from '../../../../examples/pptx/omniview-tech-presentation.pptx';
import xlsxUrl from '../../../../examples/xlsx/omniview-budget-report.xlsx';
import jpgUrl from '../../../../examples/image/cyberpunk-city-skyline.jpg';
import pngUrl from '../../../../examples/image/omniview-brand-logo.png';

// ============================================================
// 工具函数
// ============================================================

/** 获取文件扩展名（小写，不含点） */
function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return filename.slice(dotIndex + 1).toLowerCase();
}

/** 生成确定性 id */
function makeId(relPath: string): string {
  return `file-${relPath.replace(/^examples\//, '').replace(/[\/.]/g, '-')}`;
}

/** 创建 FileItem */
function makeFile(
  relPath: string,
  filename: string,
  content: string,
  binaryUrl?: string,
): FileItem {
  const ext = getExtension(filename);
  const isBinary = binaryUrl !== undefined;
  return {
    id: makeId(`examples/${relPath}`),
    name: filename,
    path: `/workspace/${relPath}`,
    extension: ext,
    content: isBinary ? '' : content,
    size: isBinary ? 0 : content.length,
    lastModified: Date.now(),
    binaryUrl: isBinary ? binaryUrl : undefined,
  };
}

/** 聚合全部 examples 文件为 INITIAL_FILES */
export const INITIAL_FILES: FileItem[] = [
  // Code
  makeFile('code/graph-topology.js', 'graph-topology.js', codeGraphTopology),
  makeFile('code/notes.txt', 'notes.txt', codeNotes),
  makeFile('code/reactive-state-machine.ts', 'reactive-state-machine.ts', codeReactiveStateMachine),
  makeFile('code/telemetry-card.tsx', 'telemetry-card.tsx', codeTelemetryCard),

  // CSV
  makeFile('csv/performance-benchmarks.csv', 'performance-benchmarks.csv', csvPerformanceBenchmarks),

  // Docker
  makeFile('docker/docker-compose.yml', 'docker-compose.yml', dockerCompose),
  makeFile('docker/Dockerfile', 'Dockerfile', dockerDockerfile),

  // Domain Story
  makeFile('domainstory/ecommerce-fulfillment.dst', 'ecommerce-fulfillment.dst', domainStoryEcommerce),
  makeFile('domainstory/ecommerce-fulfillment.egn', 'ecommerce-fulfillment.egn', domainStoryEcommerceEgn),
  makeFile('domainstory/leave-approval.domainstory', 'leave-approval.domainstory', domainStoryLeave),

  // Excalidraw
  makeFile('excalidraw/architecture-sketch.excalidraw', 'architecture-sketch.excalidraw', excalidrawArchitecture),
  makeFile('excalidraw/wireframe-flow.excalidraw.json', 'wireframe-flow.excalidraw.json', excalidrawWireframe),

  // Graphviz
  makeFile('graphviz/cloud-architecture.dot', 'cloud-architecture.dot', graphvizCloud),
  makeFile('graphviz/dependency-graph.gv', 'dependency-graph.gv', graphvizDependency),

  // HTML
  makeFile('html/interactive-dashboard.html', 'interactive-dashboard.html', htmlDashboard),

  // JSON
  makeFile('json/package.json', 'package.json', jsonPackage),
  makeFile('json/rest-api-v1-spec.json', 'rest-api-v1-spec.json', jsonRestApi),

  // K8s
  makeFile('k8s/microservices.yaml', 'microservices.yaml', k8sMicroservices),

  // Markdown
  makeFile('markdown/architecture-spec.md', 'architecture-spec.md', mdArchitectureSpec),
  makeFile('markdown/basic-markdown.md', 'basic-markdown.md', mdBasic),
  makeFile('markdown/callouts-and-tasks.md', 'callouts-and-tasks.md', mdCallouts),
  makeFile('markdown/code-blocks.md', 'code-blocks.md', mdCodeBlocks),
  makeFile('markdown/code-rendering-spec.md', 'code-rendering-spec.md', mdCodeRendering),
  makeFile('markdown/consensus-algorithms.md', 'consensus-algorithms.md', mdConsensus),
  makeFile('markdown/diagrams.md', 'diagrams.md', mdDiagrams),
  makeFile('markdown/domain-storytelling.md', 'domain-storytelling.md', mdDomainStory),
  makeFile('markdown/echarts-charts.md', 'echarts-charts.md', mdEcharts),
  makeFile('markdown/external-diagram-attachments.md', 'external-diagram-attachments.md', mdExternalDiagrams),
  makeFile('markdown/gfm-features.md', 'gfm-features.md', mdGfm),
  makeFile('markdown/github-alert-callouts.md', 'github-alert-callouts.md', mdGithubAlerts),
  makeFile('markdown/graphviz-diagrams.md', 'graphviz-diagrams.md', mdGraphvizDiagrams),
  makeFile('markdown/markdown-tables.md', 'markdown-tables.md', mdTables),
  makeFile('markdown/math-and-diagrams-test.md', 'math-and-diagrams-test.md', mdMathTest),
  makeFile('markdown/math-formulas.md', 'math-formulas.md', mdMathFormulas),
  makeFile('markdown/mermaid-visual-gallery.md', 'mermaid-visual-gallery.md', mdMermaidGallery),
  makeFile('markdown/obsidian-wiki-links.md', 'obsidian-wiki-links.md', mdObsidian),
  makeFile('markdown/pandoc-extras.md', 'pandoc-extras.md', mdPandoc),
  makeFile('markdown/stability-stress-test.md', 'stability-stress-test.md', mdStability),
  makeFile('markdown/table-visualization-spec.md', 'table-visualization-spec.md', mdTableViz),
  makeFile('markdown/technical-guide.md', 'technical-guide.md', mdTechGuide),

  // Markmap
  makeFile('markmap/decision-tree.mindmap', 'decision-tree.mindmap', markmapDecisionTree),
  makeFile('markmap/feature-roadmap.mm', 'feature-roadmap.mm', markmapFeatureRoadmap),
  makeFile('markmap/product-planning.km', 'product-planning.km', markmapProductPlanning),
  makeFile('markmap/system-architecture.markmap', 'system-architecture.markmap', markmapSystemArch),

  // Mermaid
  makeFile('mermaid/omniview-render-pipeline.mmd', 'omniview-render-pipeline.mmd', mermaidRenderPipeline),
  makeFile('mermaid/user-journey.mermaid', 'user-journey.mermaid', mermaidUserJourney),

  // Notebook
  makeFile('notebook/data-exploration.ipynb', 'data-exploration.ipynb', notebookDataExploration),
  makeFile('notebook/deep-learning-analysis.ipynb', 'deep-learning-analysis.ipynb', notebookDeepLearning),

  // OKF
  makeFile('okf/index.md', 'index.md', okfIndex),
  makeFile('okf/knowledge-catalog.okf', 'knowledge-catalog.okf', okfKnowledgeCatalog),
  makeFile('okf/metrics/weekly_active_users.md', 'weekly_active_users.md', okfWauMetrics),
  makeFile('okf/metrics/weekly_active_users.okf.md', 'weekly_active_users.okf.md', okfWauMetricsOkf),
  makeFile('okf/tables/customers.md', 'customers.md', okfCustomers),
  makeFile('okf/tables/customers.okf.md', 'customers.okf.md', okfCustomersOkf),
  makeFile('okf/tables/orders.md', 'orders.md', okfOrders),
  makeFile('okf/tables/orders.okf.md', 'orders.okf.md', okfOrdersOkf),

  // PlantUML
  makeFile('plantuml/cloud-topology.puml', 'cloud-topology.puml', plantumlCloudTopology),
  makeFile('plantuml/component-diagram.iuml', 'component-diagram.iuml', plantumlComponentDiagram),
  makeFile('plantuml/order-fulfillment.plantuml', 'order-fulfillment.plantuml', plantumlOrderFulfillment),

  // SVG
  makeFile('svg/00-4加1架构视图模型.svg', '00-4加1架构视图模型.svg', svg4c1),
  makeFile('svg/cloud-infrastructure.svg', 'cloud-infrastructure.svg', svgCloudInfra),
  makeFile('svg/microservices-cloud-topology.svg', 'microservices-cloud-topology.svg', svgMicroservices),
  makeFile('svg/performance-radar-chart.svg', 'performance-radar-chart.svg', svgPerfRadar),
  makeFile('svg/service-telemetry-metrics.svg', 'service-telemetry-metrics.svg', svgServiceTelemetry),

  // TOML
  makeFile('toml/cargo-workspace.toml', 'cargo-workspace.toml', tomlCargo),
  makeFile('toml/pyproject.toml', 'pyproject.toml', tomlPyproject),

  // TSV
  makeFile('tsv/microservices-slo-telemetry.tsv', 'microservices-slo-telemetry.tsv', tsvMicroservices),

  // Typst
  makeFile('typst/quantum-computing-paper.typ', 'quantum-computing-paper.typ', typstQuantum),
  makeFile('typst/software-engineer-resume.typ', 'software-engineer-resume.typ', typstResume),
  makeFile('typst/tech-report.typst', 'tech-report.typst', typstTechReport),

  // XML
  makeFile('xml/pom.xml', 'pom.xml', xmlPom),
  makeFile('xml/service-config.xml', 'service-config.xml', xmlServiceConfig),

  // YAML
  makeFile('yaml/cloud-infrastructure.yml', 'cloud-infrastructure.yml', yamlCloudInfra),
  makeFile('yaml/k8s-cluster-deployment.yaml', 'k8s-cluster-deployment.yaml', yamlK8sCluster),

  // 二进制
  makeFile('pdf/technical-whitepaper.pdf', 'technical-whitepaper.pdf', '', pdfUrl),
  makeFile('docx/omniview-architecture-guide.docx', 'omniview-architecture-guide.docx', '', docxUrl),
  makeFile('pptx/omniview-tech-presentation.pptx', 'omniview-tech-presentation.pptx', '', pptxUrl),
  makeFile('xlsx/omniview-budget-report.xlsx', 'omniview-budget-report.xlsx', '', xlsxUrl),
  makeFile('image/cyberpunk-city-skyline.jpg', 'cyberpunk-city-skyline.jpg', '', jpgUrl),
  makeFile('image/omniview-brand-logo.png', 'omniview-brand-logo.png', '', pngUrl),
];
