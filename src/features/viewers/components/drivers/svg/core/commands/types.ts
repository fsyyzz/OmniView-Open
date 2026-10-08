/**
 * OmniView SVG 编辑引擎 v2 — 命令表契约 (ADR-0001)
 *
 * 与 VectorCraft `crates/engine/src/lib.rs` 的 `Session::execute` 范式对齐：
 * 每个 UI 动作 / Tool 手势 = 一个具名命令 + JSON 风格参数；命令在文档
 * 快照上执行，返回新的文档 / 错误。
 *
 * @see docs/adr/0001-svg-edit-engine-v2-document-model.md §2.3
 */

import type {
  AffineTransform,
  Appearance,
  BlendMode,
  Color,
  Document,
  Fill,
  NodeId,
  PathGeometry,
  Selection,
  Stroke,
} from '../model/types';
import type { AlignMode, DistributeAxis } from '../model/bbox';
export type { AlignMode, DistributeAxis };

// ============================================================================
// 1. 命令标识与参数
// ============================================================================

/**
 * 命令稳定 ID（kebab-case 命名空间风格）。命名空间分类：
 * - `path.*`     — 路径几何操作（set/insertAnchor/deleteAnchor/split/join）
 * - `object.*`   — 图元变换（move/scale/rotate/group/ungroup/reorder）
 * - `paint.*`    — 外观（setFill/setStroke/setOpacity/setBlend）
 * - `layer.*`    — 图层操作（add/remove/rename/reorder/setVisibility/setLock）
 * - `select.*`   — 选择（box/all/same/invert/clear）
 * - `history.*` — 撤销栈（undo/redo）
 * - `tool.*`     — 工具切换（setActive/setOption）
 */
export type CommandId =
  | `path.${string}`
  | `object.${string}`
  | `paint.${string}`
  | `layer.${string}`
  | `select.${string}`
  | `history.${string}`
  | `tool.${string}`;

/** 命令参数（JSON 风格；具体 schema 由各命令定义）。 */
export type CommandParams = Readonly<Record<string, unknown>>;

/** 命令执行结果（成功 = 新文档；失败 = 错误）。 */
export type CommandResult =
  | { readonly ok: true; readonly doc: Document; readonly selection: Selection; readonly warnings?: ReadonlyArray<string> }
  | { readonly ok: false; readonly error: CommandError };

/** 命令执行错误（与 VectorCraft `EngineError` 对齐）。 */
export interface CommandError {
  readonly kind:
    | 'unknown-command'
    | 'disabled'
    | 'bad-params'
    | 'no-document'
    | 'no-node'
    | 'precondition'
    | 'internal';
  readonly commandId: CommandId;
  readonly message: string;
}

// ============================================================================
// 2. 命令执行器
// ============================================================================

/** 单条命令的纯函数执行器：当前文档 + 参数 → 新文档。 */
export type CommandHandler = (
  doc: Document,
  selection: Selection,
  params: CommandParams,
) => CommandResult;

// ============================================================================
// 3. 命令 Schema 描述（用于面板 UI 与未来 MCP 化）
// ============================================================================

/** 参数类型（zod-lite；P1 仅描述意图，不强制运行时校验）。 */
export type ParamType =
  | 'string' | 'number' | 'integer' | 'boolean'
  | 'enum'
  | 'vec2' | 'rect' | 'transform'
  | 'color' | 'fill' | 'stroke' | 'appearance'
  | 'nodeId' | 'nodeIdArray'
  | 'object'; // 任意 JSON

/** 单条参数定义。 */
export interface ParamSpec {
  readonly key: string;
  readonly type: ParamType;
  readonly required: boolean;
  readonly description: string;
  /** enum 类型时必填。 */
  readonly values?: ReadonlyArray<string | number>;
  /** 默认值。 */
  readonly default?: unknown;
  /** 取值范围。 */
  readonly min?: number;
  readonly max?: number;
}

/** 单条命令的注册信息。 */
export interface CommandSpec {
  readonly id: CommandId;
  readonly title: string;
  /** 撤销 UI 上显示的标签。 */
  readonly undoLabel: string;
  readonly params: ReadonlyArray<ParamSpec>;
  readonly handler: CommandHandler;
  /** 当前命令在何种上下文下可用（无 = 始终）。 */
  readonly enabledWhen?: (doc: Document, selection: Selection) => boolean;
}

// ============================================================================
// 4. 命令注册表
// ============================================================================

/** 全局命令注册表。`Runtime` 通过此表查找并执行命令。 */
export interface CommandRegistry {
  /** 按 id 索引。 */
  readonly commands: ReadonlyMap<CommandId, CommandSpec>;
  /** 列出所有命令（用于 `engine.commands` 类 API 与面板构造）。 */
  list(): ReadonlyArray<CommandSpec>;
  /** 查找单条命令；不存在返回 null。 */
  find(id: CommandId): CommandSpec | null;
  /** 注册新命令（仅开发态；生产环境命令表冻结）。 */
  register(spec: CommandSpec): void;
}

// ============================================================================
// 5. 命令分类参考（具体命令清单将在 M3 阶段定义并写入本文件）
// ============================================================================

// --- path.* ---
/** 改写节点几何。 */
export interface PathSetParams { readonly id: NodeId; readonly geometry: PathGeometry; }
export interface PathInsertAnchorParams { readonly id: NodeId; readonly segmentIndex: number; readonly point: { readonly x: number; readonly y: number }; readonly kind: 'corner' | 'smooth'; }
export interface PathDeleteAnchorParams { readonly id: NodeId; readonly anchorIndex: number; }
export interface PathCloseParams { readonly id: NodeId; readonly closed: boolean; }

// --- object.* ---
export interface ObjectMoveParams { readonly ids: ReadonlyArray<NodeId>; readonly delta: { readonly x: number; readonly y: number }; }
export interface ObjectScaleParams { readonly ids: ReadonlyArray<NodeId>; readonly origin: { readonly x: number; readonly y: number }; readonly factor: { readonly x: number; readonly y: number }; }
export interface ObjectRotateParams { readonly ids: ReadonlyArray<NodeId>; readonly origin: { readonly x: number; readonly y: number }; readonly angleDeg: number; }
export interface ObjectTransformParams { readonly ids: ReadonlyArray<NodeId>; readonly matrix: AffineTransform; }
export interface ObjectGroupParams { readonly ids: ReadonlyArray<NodeId>; readonly name?: string; }
export interface ObjectUngroupParams { readonly id: NodeId; }
export interface ObjectReorderParams { readonly id: NodeId; readonly direction?: 'front' | 'back' | 'forward' | 'backward'; /** 与 direction 互斥；拖拽排序用：移除自身后在父容器 children 中的插入下标 */ readonly toIndex?: number; }
export interface ObjectDeleteParams { readonly ids: ReadonlyArray<NodeId>; }
export interface ObjectSetNameParams { readonly id: NodeId; readonly name: string | null; }
export interface ObjectSetVisibleParams { readonly ids: ReadonlyArray<NodeId>; readonly visible: boolean; }
export interface ObjectSetLockedParams { readonly ids: ReadonlyArray<NodeId>; readonly locked: boolean; }
export interface ObjectAlignParams {
  readonly ids: ReadonlyArray<NodeId>;
  readonly align: AlignMode;
  /** 对齐基准：`selection` = 选区包围盒（默认）；`canvas` = 画布。 */
  readonly relative?: 'selection' | 'canvas';
}
export interface ObjectDistributeParams {
  readonly ids: ReadonlyArray<NodeId>;
  readonly axis: DistributeAxis;
}

// --- paint.* ---
export interface PaintSetFillParams { readonly ids: ReadonlyArray<NodeId>; readonly fill: Fill; }
export interface PaintSetStrokeParams { readonly ids: ReadonlyArray<NodeId>; readonly stroke: Stroke; }
export interface PaintSetOpacityParams { readonly ids: ReadonlyArray<NodeId>; readonly opacity: number; }
export interface PaintSetBlendParams { readonly ids: ReadonlyArray<NodeId>; readonly blend: BlendMode; }
export interface PaintSetAppearanceParams { readonly ids: ReadonlyArray<NodeId>; readonly appearance: Appearance; }
export interface PaintSetColorParams { readonly ids: ReadonlyArray<NodeId>; readonly target: 'fill' | 'stroke'; readonly color: Color; readonly opacity: number }

// --- layer.* ---
export interface LayerAddParams { readonly name?: string; readonly atIndex?: number; }
export interface LayerRemoveParams { readonly id: NodeId; }
export interface LayerRenameParams { readonly id: NodeId; readonly name: string; }
export interface LayerSetVisibilityParams { readonly id: NodeId; readonly visible: boolean; }
export interface LayerSetLockParams { readonly id: NodeId; readonly locked: boolean; }
export interface LayerReorderParams { readonly id: NodeId; readonly direction?: 'front' | 'back' | 'forward' | 'backward'; /** 与 direction 互斥；拖拽排序用：移除自身后在 doc.layers 中的插入下标 */ readonly toIndex?: number; }
export interface LayerSetColorTagParams { readonly id: NodeId; readonly color: 'none' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray'; }

// --- select.* ---
export interface SelectBoxParams { readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }; readonly additive: boolean; readonly mods: { readonly shift: boolean; readonly alt: boolean; readonly meta: boolean; readonly ctrl: boolean }; }
export interface SelectSetParams { readonly ids: ReadonlyArray<NodeId>; readonly additive: boolean; }
export interface SelectAllParams {}
export interface SelectClearParams {}
export interface SelectSameParams { readonly predicate: 'fill' | 'stroke' | 'opacity' | 'kind' | 'name'; }

// --- history.* ---
export interface HistoryUndoParams {}
export interface HistoryRedoParams {}

// --- tool.* ---
export interface ToolSetActiveParams { readonly tool: 'select' | 'node' | 'pen'; }
export interface ToolSetOptionParams { readonly key: string; readonly value: unknown; }