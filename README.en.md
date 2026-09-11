# OmniView

[中文](./README.md) | **English**

> **OmniView** is a high-performance, multi-format visualization workbench and VS Code extension for modern document workflows. Built with React 19, TypeScript, Vite 6, and Tailwind CSS v4, it follows the philosophy of **turning data into immersive windows and simplifying complex layout**—covering documents, diagrams, mind maps, vector design, data grids, paginated readers, and structured configuration files.

---

## Feature Matrix

### 1. Structured Data Studio
For **JSON, YAML, TOML, and XML**, OmniView goes beyond plain-text viewing with multi-projection visualization:
- **Interactive Tree View**:
  - Smart type color mapping (String / Number / Boolean / Null / Object), item-count badges, and depth connectors;
  - Expand all / collapse to root, structure-aware live search over keys and values;
  - **KeyPath inspector**: click any node to resolve and copy a standard JSONPath (e.g. `$.services.web.ports[0]`).
- **Mindmap Projection**:
  - Zero-config uplift of deep nested structures into an interactive SVG mind map;
  - Unlimited pan/zoom, graded fold/expand, outline navigation, and high-res SVG export.
- **Homogeneous Array Drill-down (Table & Chart)**:
  - Auto-detect root or first-level homogeneous object arrays (e.g. `cluster_nodes`, `items`, `users`) and open an interactive table;
  - Sticky headers, multi-mode sorting, full-text filter, and one-click bar/line micro-charts.
- **Cloud-native Topology View**:
  - Detect Docker Compose / microservice fields such as `services`, `depends_on`, `ports`, and network flow;
  - Auto-generate a clear service-dependency topology.
- **Secret Masking**:
  - Heuristic engine for fields like `password`, `token`, `secret`, `jwt`, and `api_key`;
  - Toggle between masked mode (hover to peek) and plaintext—safe for screen sharing and demos.
- **Offline Format Converter**:
  - Bidirectional live conversion across **JSON ⇄ YAML ⇄ TOML ⇄ XML**;
  - Pretty / compact output, copy or download converted files;
  - **100% local in-memory serialization**—no network requests.

### 2. Enhanced Markdown Rendering Engine
- **Multi-engine diagram matrix**:
  - **Mermaid.js**: flowcharts, sequence diagrams, class/state diagrams, Git graphs, Gantt, C4, and more;
  - **PlantUML**: architecture / sequence / component diagrams with preview ↔ source dual-mode hot render and private server URL config;
  - **Graphviz / DOT**: native ````dot```` / ````graphviz```` fenced blocks via `@hpcc-js/wasm-graphviz` offline WASM + Web Worker;
  - **SVG driver**: inline ````svg```` blocks and local relative `.svg` references, with dark / grid / light backgrounds;
- **KaTeX math**:
  - Inline `$E=mc^2$` with currency false-positive filtering (e.g. `$100`, `$5.99`);
  - Block equations such as `$$\int_{-\infty}^{+\infty} e^{-x^2} dx = \sqrt{\pi}$$`;
  - Direct ````math```` / ````katex```` / ````latex```` academic blocks;
- **Interactive data tables**:
  - Sticky headers and horizontal scroll wrappers for wide tables;
  - Cell-level rich Markdown (inline code, badges);
  - Smart sorting: string, numeric, unit-aware (`128MB` vs `2GB`, `15ms` vs `1.2s`), and datetime;
  - Numeric-column chart sniffing (bar / line);
  - Copy table content; export as CSV or Markdown.
- **Image & diagram lightbox**:
  - Fullscreen or double-click lightbox for images and diagrams;
  - Smooth `0.2x ~ 5.0x` wheel zoom, pan, 90° rotate, copy, and lossless download;
- **RenderErrorBoundary**:
  - Block-level isolation—broken diagram syntax shows a diagnostic card with fix hints while the rest of the document stays interactive;
- **Outline & search**:
  - Collapsible multi-level TOC with scroll-spy;
  - Keyword search with hit highlighting.

### 3. Mindmap Studio
- Native `.markmap`, `.mm`, `.mindmap`, `.km` with live bi-directional sync;
- Code / split / immersive mindmap modes with 30:70, 50:50, 70:30 presets and free resize;
- Markdown shortcut templates and keyboard support (Tab / Shift+Tab indent, Enter continues hierarchy);
- Zoom, fit-to-view, and high-res SVG export.

### 4. SVG Studio
- Split graphics/code, graphics-only, and code-only modes;
- **Element pick & tweak**: position, size, fill, stroke, radius, opacity, and rotation;
- **Free transform**: 8-handle resize, proportional scale, grid snap, canvas align;
- **Layering**: bring forward / send backward (to front / to back);
- **Developer exports**: reverse jump to source line, SVGO cleanup, React JSX / Vue 3 / Base64 Data URI export.

### 5. Modern PDF Reader
- Mozilla PDF.js v4+ binary parse + Canvas rendering;
- **Three layouts**: continuous flow, single-page, dual-page book view;
- **Reading awareness**: scroll-spy progress, lazy viewport rendering;
- **Annotate & search**: cross-page search highlight, outline bookmarks, selection highlights with Markdown export, PNG snapshot, and print.

### 6. CSV / TSV Smart Grid
- Lightweight RFC 4180 parser with quoted escapes, multi-line cells, and ragged-width normalization;
- Fuzzy filter, multi-column sort, pagination, stats overview, and export.

### 7. Preferences & Workspace Persistence
- **Central settings hub (`settingsStorage.ts`)**: `v2` keys with seamless legacy migration;
- **Hard clamps**: zoom (0.5~2.5x), font size (12~22px), and split ratios to keep UI stable;
- **Workspace lifecycle (`fileStorage.ts`)**: remember sidebar/explorer state, tab order, and last opened file;
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

### Build & package the VS Code extension (VSIX)

```bash
# 1. Run full verification gates + build
npm run verify

# 2. Package offline VSIX
npm run package:vsix

# 3. Install into local VS Code (keep version in sync with package.json)
code --install-extension omniview-0.9.23.vsix --force
```

After install, right-click a supported file in the Explorer and choose **“Open with OmniView File Renderer”**, or use **“OmniView: Open Side Preview”** from the editor toolbar.

---

## Docs & Collaboration

| Doc | Description |
|---|---|
| [`docs/README.md`](./docs/README.md) | Documentation index |
| [`docs/architecture.md`](./docs/architecture.md) | Layering & render pipeline |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Dev setup, gates, and PR flow |
| [`SECURITY.md`](./SECURITY.md) | Vulnerability disclosure |
| [`CHANGELOG.md`](./CHANGELOG.md) | Release notes |

---

## Example Files

Ready-to-open samples live under [`examples/`](./examples) (see [`examples/README.md`](./examples/README.md)):

| Example | Highlights |
|---|---|
| [`mermaid/omniview-render-pipeline.mmd`](./examples/mermaid/omniview-render-pipeline.mmd) | Standalone Mermaid render-pipeline flowchart |
| [`plantuml/cloud-topology.puml`](./examples/plantuml/cloud-topology.puml) | Standalone PlantUML microservice sequence topology |
| [`graphviz/cloud-architecture.dot`](./examples/graphviz/cloud-architecture.dot) | Standalone Graphviz cloud digraph |
| [`markmap/system-architecture.markmap`](./examples/markmap/system-architecture.markmap) | Standalone Markmap capability map |
| [`diagrams.md`](./examples/markdown/diagrams.md) | Mermaid, PlantUML, SVG, and Graphviz / DOT showcase |
| [`math-formulas.md`](./examples/markdown/math-formulas.md) | KaTeX calculus, linear algebra, physics, attention formulas |
| [`graphviz-diagrams.md`](./examples/markdown/graphviz-diagrams.md) | Layered digraphs, undirected topology, error recovery |
| [`consensus-algorithms.md`](./examples/markdown/consensus-algorithms.md) | Raft / PBFT / PoW-PoS state machines and sequence diagrams |
| [`technical-guide.md`](./examples/markdown/technical-guide.md) | Engineering mixed docs—architecture diagrams, code, tables |
| [`stability-stress-test.md`](./examples/markdown/stability-stress-test.md) | Broken diagrams, missing images, ultra-wide tables, error isolation |

---

## Architecture & Security

OmniView uses a modular layered architecture for reliability in both browser and VS Code sandboxes:

```mermaid
flowchart LR
    subgraph Host ["VS Code Extension Host"]
        HE["Custom Editor Provider<br/>FileSystemWatcher<br/>VSIX Entry"]
    end

    HE <-->|"Bidirectional secure message bridge<br/>(RPC PostMessage)"| Core

    subgraph Core ["OmniView Webview Core Runtime"]
        direction TB
        WS["Workbench Shell<br/>(Tabs, Layout, Themes)"]
        DM["Driver Manager<br/>(Routing & Dispatcher)"]
        WS <--> DM

        subgraph Drivers ["Multi-Format Drivers"]
            direction LR
            D1["Markdown/SVG<br/>(KaTeX/Graph)"]
            D2["Mindmap/Mark<br/>(Interactive)"]
            D3["Structured Data<br/>(JSON/YAML/TOML)"]
            D4["PDF (PDF.js)"]
            D5["CSV/TSV Grid"]
            D6["Code Highlighting"]
        end
        DM --> Drivers

        Drivers --- S["Security Sanitizer<br/>(DOMPurify / XSS / DoS)"]
        Drivers --- P["Persistent Storage v2<br/>(Settings / Workspaces)"]
    end
```

1. **Offline by default**:
   - Parsing, conversion, and rendering (Graphviz WASM, KaTeX, Markmap, format conversion) run entirely in local memory—no outbound network for core workflows.
2. **Multi-layer XSS & DoS defense**:
   - DOMPurify whitelist + HTML entity encoding for SVG, Markdown, and diagram outputs;
   - Oversized text / complex node thresholds to reduce UI freezes and OOM risk.
3. **Graceful degradation**:
   - Failed diagram blocks fall back to diagnostic cards without breaking reading or outline navigation;
   - WASM Worker failures seamlessly fall back to in-process main-thread execution.

---

## Tests & Quality

- **Unit tests (`npm test`)**: diagram diagnostics, mindmap drivers, settings/workspace persistence, CSV/TSV parsing, XSS filters, driver routing, and more;
- **Typecheck & build**: `npm run lint` (TypeScript), `npm run build:plugin` (extension artifacts).

---

## License

Released under the [MIT License](./LICENSE). Feedback via [Issues](https://github.com/fsyyzz/OmniView/issues); see [CONTRIBUTING.md](./CONTRIBUTING.md) to contribute.
