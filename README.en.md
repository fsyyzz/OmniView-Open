# OmniView

[中文](./README.md) | **English**

<p align="left">
  <a href="https://marketplace.visualstudio.com"><img src="https://img.shields.io/visual-studio-marketplace/v/omniview.omniview?style=flat-square&color=blue&logo=visual-studio-code" alt="Marketplace Version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License: MIT" /></a>
  <a href="./docs/architecture.md"><img src="https://img.shields.io/badge/Tests-85%20Passing-brightgreen?style=flat-square" alt="Tests" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Offline-100%25-orange?style=flat-square" alt="100% Offline" /></a>
  <a href="#"><img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React 19" /></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-5.7+-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome" /></a>
</p>

> OmniView is a multi-format file visualization workbench, available as a VS Code extension and a standalone web app. Built with React 19, TypeScript, Vite 6, and Tailwind CSS v4, it renders documents, diagrams, mind maps, vector drawings, data grids, cloud-native manifests, and structured configuration files — 23+ formats, fully offline.

<p align="left">
  <a href="https://ais-pre-3kity5ft64rqesjejxmxsu-168296143482.us-east1.run.app"><b>Web Live Demo</b></a> ·
  <a href="https://github.com/your-org/omniview/releases"><b>Download VSIX</b></a> ·
  <a href="./docs/architecture.md"><b>Architecture Docs</b></a> ·
  <a href="https://github.com/your-org/omniview/issues"><b>Feedback & Feature Requests</b></a>
</p>

![OmniView Showcase Banner](./docs/assets/omniview-showcase.png)

---

## Why OmniView

Previewing common file formats in VS Code usually means installing several separate extensions, many of which depend on online services. OmniView consolidates these capabilities into a single extension built on a unified microkernel architecture: 23+ formats out of the box, all computation done locally, UI following the VS Code theme, and stable scrolling on long documents.

| Dimension | Vanilla VS Code | Fragmented Standalone Extensions | OmniView |
| :--- | :--- | :--- | :--- |
| **Supported File Formats** | Plaintext & syntax coloring only | Requires 8–12 separate extensions | **23+ formats out of the box** (HTML5, Cloud-Native, TOML, Office, PDF, EPUB, Typst, Diagrams, Mindmaps, Whiteboards, Data) |
| **Network & Privacy** | Offline | Often relies on remote servers or paywalled APIs | **100% client-side offline**, zero cloud requests, automatic secret masking |
| **Office Trio (DOCX / PPTX / XLSX)** | Not supported | Heavy external runtimes required | **Pure in-memory OOXML decoding**, multi-sheet tabs, column profiling, and vector slide playback |
| **Markdown Copy to Word / WPS** | Black boxes, broken images, collapsed styles | Manual image saving and re-inserting | **Built-in dual-channel clipboard cleaning**, vector diagrams rasterized to high-resolution PNGs |
| **Host Theme Matching** | Native | Inconsistent UI across plugins | **Follows `--ov-*` and VS Code design tokens** |
| **Large Document Smoothness** | Good | Heavy diagrams cause frame drops | **Lazy-viewport unmounting (`LazyViewportBlock`) & FNV-1a incremental diffing** |

### Common Use Cases

1. **Copy technical documents into Word / WPS without breaking layouts**
   The clipboard cleaning pipeline filters floating toolbars and redundant borders, converts code blocks into native two-column Word tables, and rasterizes Mermaid/PlantUML/Graphviz diagrams into inline high-resolution PNGs.
2. **Open DOCX specs, PPTX slides, and XLSX workbooks inside the editor**
   Pure client-side OOXML extraction: XLSX supports multi-sheet switching, column profiling, and sparklines; PPTX supports 16:9 / 4:3 vector playback.
3. **Read hundreds of lines of JSON and microservice configs**
   JSON/YAML/XML can be projected into interactive mind maps and service dependency topologies, with automatic secret masking and JSONPath extraction.

---

## Feature Matrix

### 1. Structured Data Studio
For **JSON, YAML, TOML, and XML**, OmniView goes beyond plain-text viewing with multiple view projections:
- **Interactive Tree View**:
  - Type color mapping (String / Number / Boolean / Null / Object), item-count badges, and depth connectors;
  - Expand all / collapse to root, structure-aware live search over keys and values;
  - **KeyPath inspector**: click any node to resolve and copy a standard JSONPath (e.g. `$.services.web.ports[0]`).
- **Mindmap Projection**:
  - Converts deeply nested structures into an interactive SVG mind map;
  - Pan/zoom, graded fold/expand, outline navigation, and SVG export.
- **Homogeneous Array Drill-down (Table & Chart)**:
  - Auto-detects root or first-level homogeneous object arrays (e.g. `cluster_nodes`, `items`, `users`) and opens an interactive table;
  - Sticky headers, sorting, full-text filter, and bar/line micro-charts for numeric columns.
- **Cloud-native Topology View**:
  - Detects Docker Compose / microservice fields such as `services`, `depends_on`, `ports`, and network flow;
  - Generates a service-dependency topology.
- **Secret Masking**:
  - Heuristic engine for fields like `password`, `token`, `secret`, `jwt`, and `api_key`;
  - Toggle between masked mode (hover to peek) and plaintext — suitable for screen sharing and demos.
- **Offline Format Converter**:
  - Bidirectional live conversion across **JSON ⇄ YAML ⇄ TOML ⇄ XML**;
  - Pretty / compact output, copy or download converted files;
  - **Local in-memory serialization** — no network requests.

### 2. Markdown Rendering Engine
- **Multi-engine diagram matrix**:
  - **Mermaid.js**: flowcharts, sequence diagrams, class/state diagrams (stateDiagram / stateDiagram-v2 with dark/light adaptive contrast), Git graphs, Gantt, C4, and more;
  - **PlantUML**: architecture / sequence / component diagrams with preview ↔ source dual-mode render and private server URL config;
  - **Graphviz / DOT**: native ````dot```` / ````graphviz```` fenced blocks via `@hpcc-js/wasm-graphviz` offline WASM + Web Worker;
  - **SVG driver**: inline ````svg```` blocks and local relative `.svg` references, with dark / grid / light backgrounds;
- **KaTeX math**:
  - Inline `$E=mc^2$` with currency false-positive filtering (e.g. `$100`, `$5.99`);
  - Block equations such as `$$\int_{-\infty}^{+\infty} e^{-x^2} dx = \sqrt{\pi}$$`;
  - ````math```` / ````katex```` / ````latex```` fenced blocks;
- **Interactive data tables**:
  - Sticky headers and horizontal scroll wrappers for wide tables;
  - Cell-level rich Markdown (inline code, badges);
  - Sorting: string (pinyin/alphabetical), numeric, unit-aware (`128MB` vs `2GB`, `15ms` vs `1.2s`), and datetime;
  - Numeric-column chart sniffing (bar / line);
  - Copy table content; export as CSV or Markdown.
- **Image & diagram lightbox**:
  - Fullscreen or double-click lightbox for images and diagrams;
  - `0.2x ~ 5.0x` wheel zoom, pan, 90° rotate, copy, and download;
- **Incremental Re-rendering & Dynamic Viewport Unmount (Zero CLS)**:
  - **FNV-1a block-level memoization**: reuses stable block object references by line range and hash during partial edits, preventing whole-tree recalculations;
  - **Unloadable viewport memory management**: heavy diagrams (Mermaid, Graphviz, KaTeX, wide tables) unload outside the viewport buffer to free DOM and WASM memory, backed by a global height cache for zero layout shift on revisit;
- **In-place Block Editor & CRUD Engine**:
  - **Block action capsule (`MarkdownBlockActionBar`)**: hover over any paragraph, list, table, or diagram block to insert new blocks below, duplicate in place, or swap adjacent blocks;
  - **Focused editor & undo protection**: source-only / live side-preview editing card (`MarkdownFocusedBlockEditor`), inline delete confirmation with a 6-second undo toast (`MarkdownBlockUndoToast`), and whitespace normalization;
- **Selection Formatting & Safe Writeback**:
  - Single-line formatting for bold (`**B**`), italic, strikethrough (`~~S~~`), highlight (`==H==`), superscript/subscript, `<kbd>`, inline code, hyperlinks, and wiki links (`WikiLink`);
  - Multi-line block conversion into blockquotes (`>`), code fences, and Callout admonitions (`[!NOTE]` / `[!TIP]` / `[!WARNING]`), plus image drag-resize writeback (`<img width="..." />`);
  - Writes are pre-checked with line numbers and contextual text fingerprints; mismatches are rejected to protect the source document;
- **Render Time Budget & Slow Block Observability**:
  - Millisecond render budget per block (800ms threshold) with fallback source cards and outline `ZapOff` warning badges;
- **RenderErrorBoundary**:
  - Block-level isolation — broken diagram syntax shows a diagnostic card with fix hints while the rest of the document stays interactive;
- **Outline & search**:
  - Physical heading DOM mounting for accurate outline jumping;
  - Collapsible multi-level TOC with scroll-spy;
  - Keyword search with hit highlighting.

### 3. Mindmap Studio
- Native `.markmap`, `.mm`, `.mindmap`, `.km` with live bi-directional sync;
- Code / split / immersive mindmap modes with 30:70, 50:50, 70:30 presets and free resize;
- Markdown shortcut templates and keyboard support (Tab / Shift+Tab indent, Enter continues hierarchy);
- Zoom, fit-to-view, and SVG export.

### 4. SVG Studio v2
- **Immutable document model & command pipeline**: full Undo/Redo history stack with structural sharing snapshots;
- **8 core vector tools**: Select (`select`), Node/Anchor edit (`node`), Pen (`pen`), Rectangle (`rect`), Ellipse (`ellipse`), Line (`line`), Arrow (`arrow`), and Text (`text`);
- **Drag-to-draw**: real-time translucent preview while dragging; Shift locks 1:1 square/circle or 15° ray angles, Alt draws from center, accidental single clicks cancel cleanly;
- **Two-point arrowhead controls**: dedicated Arrow tool (`W`); selecting lines/arrows shows a dashed axis with dual endpoint handles, individually draggable, with one-click direction reverse (`ArrowLeftRight`);
- **Line-to-polyline evolution**:
  - **Ghost midpoint drag**: dragging a midpoint handle pulls out a new vertex, turning lines into polylines; double-click or delete a vertex to restore;
  - **One-click orthogonal routing (`path.convertLineStyle`)**: toggle across Straight, Z-orthogonal (horizontal-first), V-orthogonal (vertical-first), and L-orthogonal styles;
- **Developer exports**: reverse jump to source line, SVGO cleanup, React JSX / Vue 3 / Base64 Data URI export.

### 5. EPUB Reader Studio
- Native `.epub` reflowable rendering and unpacked reading;
- **Three flow modes**:
  - **Two-page spread**: CSS Multi-Column book layout with spine creases and narrow-screen fallback;
  - **Single-page flow**: centered column with hover navigation hotspots and arrow key/spacebar shortcuts;
  - **Continuous scroll**: vertical reflowable reading with automatic chapter triggers and progress tracking;
- **3D page flip effect**: GPU-accelerated page flip animation, toggleable at any time;
- **Typography & reading progress persistence (`epubSettingsStorage`)**: font size (A-/A+), font family (Serif, Sans, Kai, Mono), first-line indent, alignment, line height (1.5x/1.75x/2.0x), page width, reading themes (Auto, Sepia, Light, Dark), and book-specific progress (chapter, page, percentage).

### 6. PDF Reader
- Mozilla PDF.js v4+ binary parsing + Hi-DPI Canvas rasterization;
- **Focal point wheel zoom**: Ctrl/Cmd + wheel / trackpad pinch zoom keeps the pixel under the cursor stable, synchronized via React `useLayoutEffect`;
- **Zero-flicker zooming**: the previous frame bitmap is scaled via GPU-accelerated CSS during gestures, then replaced with crisp high-DPI rendering once the gesture pauses;
- **Hand pan tool & Space+Drag**: toggle between Select and Hand modes; hold Spacebar or middle mouse button to pan freely;
- **Zoom presets**: 50%, 75%, 100% (actual size), 125%, 150%, 200%, 300%, 400%, 500%, Fit Width (W), and Fit Page (H);
- **Centered HUD zoom capsule**: translucent floating badge showing real-time zoom percentage with a visual scale track;
- **Three layouts**: continuous flow, single-page, and dual-page book view;
- **Annotate & search**: cross-page search highlight, outline bookmarks, selection highlights with Markdown export, PNG snapshot, and system printing.

### 7. Excalidraw Whiteboard Studio
- Native `.excalidraw` file format support;
- **Four view modes**: interactive canvas, dual-pane split, read-only preview, and JSON source editor;
- **Self-healing data pipe**: built-in `sanitizeExcalidrawElements` and `restoreElements` repair invalid element schemas and prevent canvas crashes;
- **Starter templates & export**: 8 architecture and flowchart templates with SVG, PNG, and `.excalidraw` export.

### 8. Typst Studio (A4 2.0)
- Pure client-side AST compiler for `.typ` and `.typst` files;
- **Typography**: outline TOC, physical page breaks, multi-page continuous SVG flow, KaTeX math, and CJK text-width overlap prevention;
- **A4 2.0 print engine**: dynamic header/footer macro variables (`{{page}}`, `{{totalPages}}`, `{{title}}`, `{{date}}`), alternating gutter margins for bookbinding, and `@page` rules.

### 9. Jupyter Notebook (.ipynb v4)
- Client-side offline parser and renderer for Jupyter Notebook v4 format;
- Markdown narrative cells, syntax-highlighted Python code cells, execution counters, multi-format outputs, and ANSI traceback coloration;
- One-click export to Markdown (`.md`) or Python script (`.py`).

### 10. CSV / TSV Grid
- Lightweight RFC 4180 parser with quoted escapes, multi-line cells, and ragged-width normalization;
- Fuzzy filter, multi-column sort, pagination, stats overview, and export.

### 11. OKF (Open Knowledge Format) Cards
- Native recognition of `.okf` files and Markdown Frontmatter OKF headers;
- Extracts Knowledge ID, version, tags, and summary into structured knowledge cards.

### 12. Word (.docx) Viewer
- Client-side offline OOXML rendering via `docx-preview` with A4 paper simulation and continuous flow;
- 50% ~ 200% zoom, merged table cells, borders, shading, multi-level numbering, images, and headers/footers;
- Classic paper, sepia, and dark mode color inversion with one-click print and PDF export.

### 13. PowerPoint (.pptx) Viewer
- Offline OOXML shape and asset unpacking with 16:9 / 4:3 auto-scaling vector stage;
- Fullscreen slideshow (F5 / play button), keyboard navigation (`←` `→` / Space / PageUp / PageDown);
- Slide thumbnail outline drawer and speaker notes drawer.

### 14. Excel (.xlsx / .xls) Spreadsheet
- **Client-side offline OOXML engine**: multi-sheet tabs, SharedStrings pool, formula computed values, and hidden sheet detection;
- **Data grid**: first-row headers / column letters toggle, global search with highlight, column sorting, cell copying, and pagination;
- **Data profiling & sparklines**: type inference, min/max/quartile distribution analysis, and embedded SVG sparklines;
- **Multi-format export**: export the active worksheet to CSV, TSV, JSON, or Markdown.

### 15. ImageViewer & Pixel Inspector
- **Format support**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.ico`, `.avif`, `.tiff`;
- **10% ~ 3200% zoom**: smooth wheel zoom with pixelated rendering mode, free panning, and auto-fit;
- **16x pixel crosshair loupe & color sampler**: floating HUD tracking cursor coordinates `(X, Y)` with live `HEX`, `RGBA`, and `HSLA` sampling, single-click copy;
- **Quad-mode canvas background**: transparent checkerboard, dark, white, and native VS Code theme;
- **Geometric transforms & export**: 90° clockwise/counterclockwise rotation, horizontal/vertical flip, copy Base64 Data URI, and download original;
- **EXIF metadata extraction**: dimensions, megapixels, aspect ratio, file size, and camera exposure parameters (aperture, shutter, ISO, focal length).

### 16. DDD & Domain Storytelling Studio
- **Unified DDD Extension (`.ddd`)**:
  - Unified `.ddd` extension covering all 5 DDD views: Domain Story (`mode: domain-story`), Event Storming (`mode: event-storming`), Context Map (`mode: context-map`), Core Domain Chart (`mode: core-domain-chart`), and Context Canvas (`mode: context-canvas`);
  - Markdown integration: ````ddd```` and ````domainstory```` fenced DSL blocks plus natural stream syntax;
- **Domain topology & actor relationships**:
  - Renders Actors (person, system, group), Work Objects (document, data, package, email, etc.), and numbered activity arrows;
  - Boundary group zones with adaptive heuristic layout;
- **Step-by-step playback & export**:
  - Integrated `DiagramStepPlayer` for step-by-step playback, forward/backward navigation, and spotlight focus;
  - Export **Polyglot SVG** with embedded domain model for lossless bi-directional extraction.

### 17. Cloud-Native Infrastructure Studio
- **Dockerfile Studio**:
  - Parses and generates the multi-stage build pipeline DAG (e.g. `base -> builder -> runner`);
  - Layered instruction classification (base images, build steps, env config, ports, runtime);
  - Environment variable and exposed port extraction;
  - Static checks: `:latest` tag drift, excessive RUN layers, non-root user compliance, etc.;
  - Split-view source editing.
- **Compose Studio**:
  - Renders service dependency topologies with automatic wiring;
  - Network isolation clusters (Networks) and persistent volume (Volumes) mappings;
  - Config matrix: image versions, exposed ports, restart policies, and resource parameters;
  - Secret masking for sensitive environment variables with hover-to-peek;
  - Static checks: port conflicts, dangling depends_on, and undeclared networks.
- **Kubernetes Manifest Studio**:
  - Offline parsing of multi-document YAML manifests (`---` splitting);
  - Four-layer dependency topology: `Ingress / Gateway` → `Service` → `Workload (Deployment/StatefulSet/Pod/Job)` → `Config/Storage (ConfigMap/Secret/PVC)`;
  - Cross-resource selector wiring: Service ↔ Deployment via `matchLabels`, PVC/ConfigMap ↔ Workload via `volumeMounts`;
  - Resource overview board: cards grouped by Workload, Network, Config, Storage, and RBAC with live search;
  - Best-practice checks: missing liveness/readiness probes, missing resource limits, dangling Services with fix suggestions;
  - Split-view source editing and navigation.

### 18. HTML5 Web Sandbox Studio
- **Dual-layer isolated sandbox**: strict `iframe` sandbox without `allow-same-origin` or `allow-top-navigation`, preventing host escape and style contamination;
- **Device viewport simulator**: toggle between **Desktop (100%)**, **iPad (768px)**, and **iPhone (375px)**;
- **Canvas backgrounds**: white, dark, transparent checkerboard, and host theme;
- **Local split-view live edit**: side-by-side editing with undo/redo history and debounced hot reload.

### 19. Preferences & Workspace Persistence
- **Central settings hub (`settingsStorage.ts`)**: `v2` keys with legacy migration;
- **Hard clamps**: zoom (0.5~2.5x), font size (12~22px), and split ratios to keep the UI stable;
- **Workspace lifecycle (`fileStorage.ts`)**: remembers sidebar/explorer state, tab order, and last opened file;
- **Storage analytics & backup**: LocalStorage usage stats, export/import workspace JSON, factory reset.

---

## Quick Start

### Local development

```bash
# 1. Install dependencies
npm install

# 2. Start the Webview dev server (port 3000)
npm run dev
```

### Tests & verification gates

```bash
# Run all unit tests and driver verification suites
npm test

# Run full verification gates + build (including doc consistency and architecture checks)
npm run verify
```

### Settings & persistence

OmniView ships with a two-way configuration sync and persistence layer (`settingsStorage`):
- **Workspace & global settings**: theme, typography, split ratios, outline state, and locale preferences are stored in VS Code global and workspace configuration;
- **Render state & history**: edit caches and zoom/pan views are persisted offline and restored on the next open.

### Build & package the VS Code extension (VSIX)

```bash
# 1. Run full verification gates + build
npm run verify

# 2. Package offline VSIX
npm run package:vsix

# 3. Install into local VS Code (keep version in sync with package.json)
code --install-extension omniview-1.3.42.vsix --force
```

After install, right-click a supported file in the Explorer and choose **“Open with OmniView File Renderer”**, or use **“OmniView: Open Side Preview”** from the editor toolbar.

---

## Docs

| Doc | Description |
|---|---|
| [`docs/README.md`](./docs/README.md) | Documentation index |
| [`docs/architecture.md`](./docs/architecture.md) | Layering & render pipeline |
| [`docs/features-capabilities.md`](./docs/features-capabilities.md) | 23-format capability evaluation manual |
| [`docs/design/svg-v2-editor.md`](./docs/design/svg-v2-editor.md) | SVG v2 vector editing engine spec |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Dev setup, gates, and PR flow |
| [`SECURITY.md`](./SECURITY.md) | Vulnerability disclosure |
| [`CHANGELOG.md`](./CHANGELOG.md) | Release notes |

---

## Example Files

Ready-to-open samples live under [`examples/`](./examples) (see [`examples/README.md`](./examples/README.md)):

| Example | Description |
|---|---|
| [`mermaid/omniview-render-pipeline.mmd`](./examples/mermaid/omniview-render-pipeline.mmd) | Standalone Mermaid render-pipeline flowchart |
| [`plantuml/cloud-topology.puml`](./examples/plantuml/cloud-topology.puml) | Standalone PlantUML microservice sequence topology |
| [`graphviz/cloud-architecture.dot`](./examples/graphviz/cloud-architecture.dot) | Standalone Graphviz cloud digraph |
| [`markmap/system-architecture.markmap`](./examples/markmap/system-architecture.markmap) | Standalone Markmap capability map |
| [`diagrams.md`](./examples/markdown/diagrams.md) | Mermaid, PlantUML, SVG, and Graphviz / DOT showcase |
| [`math-formulas.md`](./examples/markdown/math-formulas.md) | KaTeX calculus, linear algebra, physics, attention formulas |
| [`graphviz-diagrams.md`](./examples/markdown/graphviz-diagrams.md) | Layered digraphs, undirected topology, error recovery |
| [`consensus-algorithms.md`](./examples/markdown/consensus-algorithms.md) | Raft / PBFT / PoW-PoS state machines and sequence diagrams |
| [`technical-guide.md`](./examples/markdown/technical-guide.md) | Mixed engineering doc — architecture diagrams, code, tables |
| [`stability-stress-test.md`](./examples/markdown/stability-stress-test.md) | Broken diagrams, missing images, ultra-wide tables, error isolation |
| [`domainstory/ecommerce-fulfillment.ddd`](./examples/domainstory/ecommerce-fulfillment.ddd) | Unified `.ddd` format cross-border e-commerce fulfillment domain story |
| [`markdown/domain-storytelling.md`](./examples/markdown/domain-storytelling.md) | Markdown embedded Domain Storytelling DSL case |
| [`html/interactive-dashboard.html`](./examples/html/interactive-dashboard.html) | HTML5 responsive monitoring dashboard, sandbox script interaction, and device viewports |

---

## License

Released under the [MIT License](./LICENSE). Feedback via [Issues](https://github.com/fsyyzz/OmniView/issues); see [CONTRIBUTING.md](./CONTRIBUTING.md) to contribute.
