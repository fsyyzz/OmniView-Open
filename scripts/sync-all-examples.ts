import fs from 'fs';
import path from 'path';
import { INITIAL_FILES } from '../src/shared/data/sampleFiles';

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const fileMap = new Map<string, string>();
for (const f of INITIAL_FILES) {
  fileMap.set(f.name, f.content);
}

// 1. Markdown 目录
ensureDir('examples/markdown');
if (fileMap.has('callouts-and-tasks.md')) {
  fs.writeFileSync('examples/markdown/callouts-and-tasks.md', fileMap.get('callouts-and-tasks.md')!);
}
if (fileMap.has('markdown-tables.md')) {
  fs.writeFileSync('examples/markdown/markdown-tables.md', fileMap.get('markdown-tables.md')!);
}
if (fileMap.has('table-visualization-spec.md')) {
  fs.writeFileSync('examples/markdown/table-visualization-spec.md', fileMap.get('table-visualization-spec.md')!);
}
if (fileMap.has('code-rendering-spec.md')) {
  fs.writeFileSync('examples/markdown/code-rendering-spec.md', fileMap.get('code-rendering-spec.md')!);
}
if (fileMap.has('architecture-spec.md')) {
  fs.writeFileSync('examples/markdown/architecture-spec.md', fileMap.get('architecture-spec.md')!);
}
if (fileMap.has('mermaid-visual-gallery.md')) {
  fs.writeFileSync('examples/markdown/mermaid-visual-gallery.md', fileMap.get('mermaid-visual-gallery.md')!);
}

// 2. OKF 目录
ensureDir('examples/okf/tables');
ensureDir('examples/okf/metrics');
if (fileMap.has('knowledge-catalog.okf')) {
  fs.writeFileSync('examples/okf/knowledge-catalog.okf', fileMap.get('knowledge-catalog.okf')!);
}
if (fileMap.has('orders.okf.md')) {
  fs.writeFileSync('examples/okf/tables/orders.okf.md', fileMap.get('orders.okf.md')!);
}
if (fileMap.has('customers.okf.md')) {
  fs.writeFileSync('examples/okf/tables/customers.okf.md', fileMap.get('customers.okf.md')!);
}
if (fileMap.has('weekly_active_users.okf.md')) {
  fs.writeFileSync('examples/okf/metrics/weekly_active_users.okf.md', fileMap.get('weekly_active_users.okf.md')!);
}

// 3. PlantUML 目录 (.puml, .plantuml, .iuml)
ensureDir('examples/plantuml');
if (fileMap.has('cloud-topology.puml')) {
  fs.writeFileSync('examples/plantuml/cloud-topology.puml', fileMap.get('cloud-topology.puml')!);
}
if (fileMap.has('order-fulfillment-lifecycle.puml')) {
  fs.writeFileSync('examples/plantuml/order-fulfillment.plantuml', fileMap.get('order-fulfillment-lifecycle.puml')!);
}

// 4. Mermaid 目录 (.mmd, .mermaid)
ensureDir('examples/mermaid');

// 5. Graphviz 目录 (.dot, .gv)
ensureDir('examples/graphviz');

// 6. SVG 目录 (.svg)
ensureDir('examples/svg');
if (fileMap.has('cloud-infrastructure.svg')) {
  fs.writeFileSync('examples/svg/cloud-infrastructure.svg', fileMap.get('cloud-infrastructure.svg')!);
}
if (fileMap.has('service-telemetry-metrics.svg')) {
  fs.writeFileSync('examples/svg/service-telemetry-metrics.svg', fileMap.get('service-telemetry-metrics.svg')!);
}

// 7. CSV / TSV 目录 (.csv, .tsv)
ensureDir('examples/csv');
if (fileMap.has('performance-benchmarks.csv')) {
  fs.writeFileSync('examples/csv/performance-benchmarks.csv', fileMap.get('performance-benchmarks.csv')!);
}
ensureDir('examples/tsv');
if (fileMap.has('microservices-slo-telemetry.tsv')) {
  fs.writeFileSync('examples/tsv/microservices-slo-telemetry.tsv', fileMap.get('microservices-slo-telemetry.tsv')!);
}

// 8. JSON / YAML / XML 目录 (.json, .yaml, .yml, .xml)
ensureDir('examples/json');
if (fileMap.has('rest-api-v1-spec.json')) {
  fs.writeFileSync('examples/json/rest-api-v1-spec.json', fileMap.get('rest-api-v1-spec.json')!);
}
if (fileMap.has('package.json')) {
  fs.writeFileSync('examples/json/package.json', fileMap.get('package.json')!);
}

ensureDir('examples/yaml');
if (fileMap.has('k8s-cluster-deployment.yaml')) {
  fs.writeFileSync('examples/yaml/k8s-cluster-deployment.yaml', fileMap.get('k8s-cluster-deployment.yaml')!);
}
if (fileMap.has('cloud-infrastructure.yaml')) {
  fs.writeFileSync('examples/yaml/cloud-infrastructure.yml', fileMap.get('cloud-infrastructure.yaml')!);
}

// 9. Code 目录 (.ts, .tsx, .js, .txt)
ensureDir('examples/code');
if (fileMap.has('reactive-state-machine.ts')) {
  fs.writeFileSync('examples/code/reactive-state-machine.ts', fileMap.get('reactive-state-machine.ts')!);
}

// 10. Jupyter Notebook (.ipynb)
ensureDir('examples/notebook');
if (fileMap.has('deep-learning-analysis.ipynb')) {
  fs.writeFileSync('examples/notebook/deep-learning-analysis.ipynb', fileMap.get('deep-learning-analysis.ipynb')!);
}

// 11. Typst (.typ, .typst)
ensureDir('examples/typst');
if (fileMap.has('quantum-computing-paper.typ')) {
  fs.writeFileSync('examples/typst/quantum-computing-paper.typ', fileMap.get('quantum-computing-paper.typ')!);
}
if (fileMap.has('software-engineer-resume.typ')) {
  fs.writeFileSync('examples/typst/software-engineer-resume.typ', fileMap.get('software-engineer-resume.typ')!);
}

// 12. Excalidraw (.excalidraw, .excalidraw.json)
ensureDir('examples/excalidraw');
if (fileMap.has('architecture-sketch.excalidraw')) {
  fs.writeFileSync('examples/excalidraw/architecture-sketch.excalidraw', fileMap.get('architecture-sketch.excalidraw')!);
}

// 13. Mindmap (.markmap, .mm, .km, .mindmap)
ensureDir('examples/markmap');
if (fileMap.has('system-architecture.markmap')) {
  fs.writeFileSync('examples/markmap/system-architecture.markmap', fileMap.get('system-architecture.markmap')!);
}

console.log('Synchronized sample files from INITIAL_FILES successfully.');
