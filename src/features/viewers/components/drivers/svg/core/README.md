# svg/core

SVG 编辑引擎 v2 核心层（与 View 解耦）。所有文件遵循 ADR-0001。

子目录契约：

| 子目录 | 依赖方向 | 导出 |
|---|---|---|
| `model/` | 不依赖其他子目录 | `Document` / `Node` / `Selection` / `Snapshot` / `Geometry` / `Path` |
| `io/` | 依赖 `model/` | `importSvg(svg, opts) → Document` / `exportSvg(doc, opts) → string` |
| `commands/` | 依赖 `model/` | `Command` / `CommandRegistry` / 命令注册表条目 |
| `runtime/` | 依赖 `model/` + `commands/` + `io/` | `Runtime` / `Tool` / `Action` / `HistoryEntry` / `Journal`

跨层禁止反向依赖：UI (`SvgCanvas.tsx` 等) 仅允许 `import { … } from './core/runtime'` 或 `'./core'` 的 barrel export，不得绕过 `runtime` 直接调用 `model`/`io`/`commands` 内部。