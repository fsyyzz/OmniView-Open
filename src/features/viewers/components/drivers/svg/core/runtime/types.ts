/**
 * OmniView SVG 编辑引擎 v2 — Runtime / Tool / Action 契约 (ADR-0001)
 *
 * 与 VectorCraft `crates/tools/src/lib.rs` 工具范式对齐：
 * - Tool 不直接 mutate 文档；
 * - Tool 仅发 `Action{Begin, Preview, Commit, Cancel, Exec}`；
 * - Runtime 负责把 Action 翻译成命令并在快照上执行；
 * - Runtime 同时负责 HistoryEntry 的写入。
 *
 * @see docs/adr/0001-svg-edit-engine-v2-document-model.md §2.3
 */

import type {
  CommandId,
  CommandParams,
  CommandResult,
} from '../commands/types';
import type {
  Document,
  History,
  PointerEvent,
  Selection,
  ToolContext,
  ToolKey,
} from '../model/types';

// ============================================================================
// 1. Action (Tool → Runtime)
// ============================================================================

/**
 * Tool 发出的动作。VectorCraft `vectorcraft_tools::Action` 对齐：
 *
 * - `Begin`：开启一次交互，Runtime 拷贝当前文档作为快照（undo 用）。
 * - `Preview`：在快照上重新执行同一命令；Runtime 用最新的 Preview 替换上一次。
 * - `Commit`：结束交互，把最后一次 Preview 落地为单个 HistoryEntry。
 * - `Cancel`：放弃本次交互，恢复 Begin 时的快照。
 * - `Exec`：单步命令（无 Begin/Commit 配对），Runtime 直接落地为 1 条 HistoryEntry。
 */
export type Action =
  | { readonly kind: 'Begin'; readonly label: string }
  | { readonly kind: 'Preview'; readonly commandId: CommandId; readonly params: CommandParams }
  | { readonly kind: 'Commit' }
  | { readonly kind: 'Cancel' }
  | { readonly kind: 'Exec'; readonly commandId: CommandId; readonly params: CommandParams };

// ============================================================================
// 2. Tool (UI 工具)
// ============================================================================

/** Tool 标识（P1 仅 select / node / pen 三件套）。 */
export type ToolId = 'select' | 'node' | 'pen';

/** Tool 接口。Tool 永远**纯函数式**：所有状态由 Runtime 持有。 */
export interface Tool {
  readonly id: ToolId;
  /** 接收 Runtime 推送的指针/键盘事件，返回 Action 列表（一般 0~1 条）。 */
  pointer(ctx: ToolContext, event: PointerEvent): ReadonlyArray<Action>;
  key(ctx: ToolContext, key: ToolKey, mods: { readonly shift: boolean; readonly alt: boolean; readonly meta: boolean; readonly ctrl: boolean }): ReadonlyArray<Action>;
  /** 工具被激活/失活时通知（用于重置内部 ephemeral state）。 */
  notify?(event: 'activated' | 'deactivated', ctx: ToolContext): void;
  /** 工具需要在画布上绘制的 overlay（Gizmo / 手柄 / 锚点等）。由 UI 渲染。 */
  overlay?(ctx: ToolContext): ReadonlyArray<OverlayElement>;
  /** 工具自定义的 cursor。 */
  cursor?(ctx: ToolContext): 'default' | 'pointer' | 'crosshair' | 'move' | 'grab' | 'grabbing' | 'text' | 'wait' | string;
}

/** Tool 在画布上的 overlay 元素（由 UI 渲染层解释）。 */
export type OverlayElement =
  | { readonly kind: 'rect'; readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }; readonly stroke: string; readonly fill: string; readonly dashed: boolean; readonly lineWidth: number }
  | { readonly kind: 'circle'; readonly center: { readonly x: number; readonly y: number }; readonly radius: number; readonly stroke: string; readonly fill: string; readonly lineWidth: number }
  | { readonly kind: 'line'; readonly from: { readonly x: number; readonly y: number }; readonly to: { readonly x: number; readonly y: number }; readonly stroke: string; readonly dashed: boolean; readonly lineWidth: number }
  | { readonly kind: 'polyline'; readonly points: ReadonlyArray<{ readonly x: number; readonly y: number }>; readonly stroke: string; readonly dashed: boolean; readonly lineWidth: number }
  | { readonly kind: 'handle'; readonly center: { readonly x: number; readonly y: number }; readonly color: 'fill' | 'stroke' | 'anchor' | 'control'; readonly size: number };

// ============================================================================
// 3. Runtime (Runtime)
// ============================================================================

/**
 * Runtime 是 Tool 与命令表之间的协调器，也是撤销栈的唯一持有者。
 *
 * 状态机：
 *
 * ```
 * Idle ──execute(Exec)──► Commit ──► Idle
 *   │
 *   ├──execute(Begin)──► Previewing ──execute(Preview)──► Previewing
 *   │                       │
 *   │                       ├──execute(Commit)──► Idle (写入 HistoryEntry)
 *   │                       └──execute(Cancel)──► Idle (丢弃)
 * ```
 *
 * Runtime 还负责：
 * - 把命令结果中的新 Document/Selection 写入内部状态；
 * - 触发订阅者（UI）重新渲染；
 * - 与 usvg-wasm IO 层桥接（import 时把 SVG 字符串塞入 initial Document；
 *   export 时把当前 Document 序列化为 SVG 字符串）。
 */
export interface Runtime {
  // ---- 读 ----
  readonly currentDocument: Document;
  readonly currentSelection: Selection;
  readonly history: History;
  readonly activeToolId: ToolId;

  // ---- 订阅 ----
  /** 订阅状态变化（任意内部状态变更 → 触发回调）。返回取消订阅函数。 */
  subscribe(listener: RuntimeListener): () => void;

  // ---- Tool → Runtime ----
  /** 处理 Tool 发出的 Action（一般 Tool 调此方法把 Action 列表一次性灌入）。 */
  handleActions(actions: ReadonlyArray<Action>): void;
  /** 工具切换。 */
  setActiveTool(id: ToolId): void;
  /** 把指针/键盘事件路由到当前 Tool。 */
  dispatchPointer(event: PointerEvent): void;
  dispatchKey(key: ToolKey, mods: { readonly shift: boolean; readonly alt: boolean; readonly meta: boolean; readonly ctrl: boolean }): void;

  // ---- 直接命令 ----
  /** 等价于把 [Exec] 灌入 handleActions（单步命令的便捷方法）。 */
  execute(commandId: CommandId, params: CommandParams): CommandResult;

  // ---- 撤销 ----
  undo(): boolean;
  redo(): boolean;

  // ---- IO ----
  /** 从 SVG 字符串加载（替换当前文档）。 */
  loadFromSvg(svg: string): Promise<LoadResult>;
  /** 当前文档导出为 SVG 字符串。 */
  exportToSvg(opts?: ExportOptions): Promise<string>;

  // ---- 销毁 ----
  dispose(): void;
}

/** 订阅回调签名。 */
export type RuntimeListener = (snapshot: RuntimeSnapshot) => void;

/** Runtime 快照（订阅者使用，避免整文档传输）。 */
export interface RuntimeSnapshot {
  readonly revision: number;
  readonly document: Document;
  readonly selection: Selection;
  readonly activeToolId: ToolId;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

// ============================================================================
// 4. Journal（命令日志；为后续 MCP 化与 Transform Again 留接口）
// ============================================================================

/** 单条 journal 条目。 */
export interface JournalEntry {
  readonly timestamp: number;
  readonly commandId: CommandId;
  readonly params: CommandParams;
  readonly resultRevision: number;
  /** 若由 Tool gesture 产生，记录对应 label。 */
  readonly label: string | null;
}

/** Journal 接口（Runtime 内部持有；M3 实现完整 API）。 */
export interface Journal {
  readonly entries: ReadonlyArray<JournalEntry>;
  append(entry: JournalEntry): void;
  clear(): void;
  /** 重放区间 `[from, to)` 的命令到给定文档（用于 MCP 化 / Transform Again）。 */
  replay(from: number, to: number): Document;
}

// ============================================================================
// 5. IO 桥接
// ============================================================================

/** 加载结果。 */
export interface LoadResult {
  readonly document: Document;
  readonly warnings: ReadonlyArray<string>;
}

/** 导出选项。 */
export interface ExportOptions {
  readonly pretty?: boolean;
  readonly indentSize?: number;
  readonly minimizeIds?: boolean;
  readonly omitMetadata?: boolean;
  readonly omitHiddenLayers?: boolean;
}