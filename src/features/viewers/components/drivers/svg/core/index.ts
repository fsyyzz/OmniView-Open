/**
 * OmniView SVG 编辑引擎 v2 — Core barrel export (ADR-0001)
 *
 * 公共入口。UI 层（`SvgCanvas.tsx`、`SvgInspectorPanel.tsx`、`SvgToolbar.tsx`
 * 等）只允许从此文件导入，禁止直接 `import` `core/*` 内部子路径。
 *
 * @see docs/adr/0001-svg-edit-engine-v2-document-model.md §2.4
 */

// ---- Model ----
export type {
  // IDs
  NodeId,
  StableId,
  // Enums
  NodeKind,
  AnchorKind,
  LengthUnit,
  LayerColorTag,
  BlendMode,
  // Geometry
  Vec2,
  AffineTransform,
  Rect,
  PathGeometry,
  SubPath,
  Anchor,
  // Appearance
  Color,
  Fill,
  Stroke,
  AppearanceItem,
  Appearance,
  // Nodes
  NodeBase,
  LayerNode,
  GroupNode,
  PathNode,
  TextNode,
  ImageNode,
  UseNode,
  Node,
  // Selection / Document / History
  Selection,
  Canvas,
  DocumentInternal,
  Document,
  HistoryEntry,
  History,
  // Tool input
  ToolMods,
  PointerEvent,
  ToolKey,
  ToolContext,
} from './model/types';

// ---- Commands ----
export type {
  CommandId,
  CommandParams,
  CommandResult,
  CommandError,
  CommandHandler,
  ParamType,
  ParamSpec,
  CommandSpec,
  CommandRegistry,
  PathSetParams,
  PathInsertAnchorParams,
  PathDeleteAnchorParams,
  PathCloseParams,
  ObjectMoveParams,
  ObjectScaleParams,
  ObjectRotateParams,
  ObjectTransformParams,
  ObjectGroupParams,
  ObjectUngroupParams,
  ObjectReorderParams,
  ObjectDeleteParams,
  ObjectSetNameParams,
  ObjectSetVisibleParams,
  ObjectSetLockedParams,
  ObjectAlignParams,
  ObjectDistributeParams,
  PaintSetFillParams,
  PaintSetStrokeParams,
  PaintSetOpacityParams,
  PaintSetBlendParams,
  PaintSetAppearanceParams,
  PaintSetColorParams,
  LayerAddParams,
  LayerRemoveParams,
  LayerRenameParams,
  LayerSetVisibilityParams,
  LayerSetLockParams,
  LayerReorderParams,
  LayerSetColorTagParams,
  SelectBoxParams,
  SelectSetParams,
  SelectAllParams,
  SelectClearParams,
  SelectSameParams,
  HistoryUndoParams,
  HistoryRedoParams,
  ToolSetActiveParams,
  ToolSetOptionParams,
} from './commands/types';

// ---- Runtime ----
export type {
  Action,
  ToolId,
  Tool,
  OverlayElement,
  Runtime,
  RuntimeListener,
  RuntimeSnapshot,
  JournalEntry,
  Journal,
  LoadResult,
  ExportOptions,
} from './runtime/types';

// ---- IO ----
export type {
  SvgWasmBridge,
  UsvgTree,
  UsvgNode,
  UsvgNodeBase,
  UsvgGroupNode,
  UsvgPathNode,
  UsvgImageNode,
  UsvgTextNode,
  UsvgUseNode,
  UsvgFill,
  UsvgStroke,
} from './io/types';

// ---- IO Function API (declaration-only; M1 阶段实现) ----
export type {
  importSvg as ImportSvgFn,
  exportSvg as ExportSvgFn,
  usvgTreeToDocument as UsvgTreeToDocumentFn,
  documentToUsvgTree as DocumentToUsvgTreeFn,
} from './io/types';

// ---- IO 实现回退（M1 阶段已落地，usvg-wasm 缺失时使用） ----
export { fallbackDomParse } from './io/fallbackDomParse';
export { fallbackDomSerialize } from './io/fallbackDomSerialize';
export { getSvgWasmBridge, createSvgWasmBridge } from './io/svgWasmBridge';
export type { SvgWasmBridgeImpl, SvgWasmBridgeOptions } from './io/svgWasmBridge';

// ---- Model 实现（M2 阶段） ----
export {
  makeNodeId,
  stableIdOf,
  createDocument,
  identityTransform,
  makeLayer,
  makeGroup,
  makePath,
  emptyAppearance,
  defaultStroke,
  updateNode,
  appendLayer,
  appendToLayer,
  removeNode,
  reorderInLayer,
  cloneDoc,
  applyTransform,
  composeTransforms,
  translateTransform,
  scaleTransform,
  rotateTransform,
  emptySelection,
  selectionWith,
  selectionAdd,
  selectionRemove,
  selectionClear,
  vec2,
  subPath,
  anchorCorner,
  anchorSmooth,
  pathGeometry,
  clonePathGeometry,
  cloneFill,
} from './model/document';
export type { DocumentPatch } from './model/document';

export {
  parsePathD,
  serializePathD,
  getBoundingBox,
} from './model/path';

// ---- Model 几何与树（图层/批量增强） ----
export {
  transformRect,
  unionRect,
  unionRects,
  nodeBBox,
  alignDelta,
  distributeOffsets,
} from './model/bbox';
export type { AlignMode, DistributeAxis } from './model/bbox';

export {
  flattenLayerTree,
  findParent,
  planReorderDrop,
} from './model/tree';
export type { LayerTreeRow, DropDrag, DropTarget, ReorderPlan } from './model/tree';

// ---- Runtime（M3 阶段） ----
export { createRuntime, RuntimeImpl } from './runtime/runtime';
export { commandRegistry } from './commands/registry';
export { getTool } from './runtime/tools';
export { useSvgRuntime } from './runtime/useSvgRuntime';
export { getSvgEngineFlag, setSvgEngineFlag, SVG_ENGINE_FLAG_KEY } from './featureFlag';
export type { SvgEngineVersion } from './featureFlag';
export { shouldWriteBackup, tagBackupContent, writeBackup, backupFileName } from './backup';
export type { BackupOptions } from './backup';