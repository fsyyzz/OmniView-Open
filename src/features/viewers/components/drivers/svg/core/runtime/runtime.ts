/**
 * OmniView SVG 编辑引擎 v2 — Runtime 运行时核心 (ADR-0001 §2.5)
 *
 * 持有 Document / Selection / History / Journal，调度 Tool → Action →
 * Command 流水线，订阅者通过 subscribe 接收状态变化。
 *
 * 设计要点（参考 VectorCraft `crates/engine/src/lib.rs:60-90`）：
 * - Action 状态机：Begin → Preview* → Commit / Cancel；Exec 单步。
 * - Begin 时 snapshot 文档；Preview 重算快照并替换 prev-preview；
 *   Commit 把最后一份 Preview 写入 1 条 HistoryEntry。
 * - 撤销栈深度无硬上限（Illustrator 风格；快照成本由结构共享吸收）。
 */

import type {
  Action,
  Journal,
  JournalEntry,
  LoadResult,
  OverlayElement,
  Runtime,
  RuntimeListener,
  RuntimeSnapshot,
  ExportOptions,
  ToolId,
} from './types';
import type { PointerEvent } from '../model/types';
import type { CommandError, CommandId, CommandParams, CommandResult } from '../commands/types';
import type {
  Document,
  History,
  HistoryEntry,
  PointerGesture,
  Selection,
  ToolContext,
} from '../model/types';
import {
  emptySelection,
} from '../model/document';
import { commandRegistry } from '../commands/registry';
import { importSvg as ioImportSvg, exportSvg as ioExportSvg } from '../io/import-export';

const HISTORY_LIMIT = 1000;

// ============================================================================
// 1. 实现
// ============================================================================

export class RuntimeImpl implements Runtime {
  private _doc: Document;
  private _selection: Selection;
  private _history: History;
  private _activeToolId: ToolId = 'select';
  private _interaction: {
    label: string;
    snapshotDoc: Document;
    snapshotSelection: Selection;
    lastPreview: { commandId: CommandId; params: CommandParams } | null;
    undoLabel: string;
  } | null = null;
  private _journal: JournalImpl;
  private _listeners = new Set<RuntimeListener>();
  /** P0：进行中的指针手势（Tool 纯函数经 ToolContext 只读访问）。 */
  private _gesture: PointerGesture | null = null;

  constructor(initial?: LoadResult) {
    this._doc = initial?.document ?? createEmptyDocument();
    this._selection = emptySelection();
    this._history = { undo: [], redo: [], limit: HISTORY_LIMIT };
    this._journal = new JournalImpl();
  }

  // ---- Read ----
  get currentDocument(): Document { return this._doc; }
  get currentSelection(): Selection { return this._selection; }
  get history(): History { return this._history; }
  get activeToolId(): ToolId { return this._activeToolId; }
  get journal(): Journal { return this._journal; }

  // ---- Subscribe ----
  subscribe(listener: RuntimeListener): () => void {
    this._listeners.add(listener);
    listener(this._snapshot());
    return () => { this._listeners.delete(listener); };
  }

  // ---- Actions ----
  handleActions(actions: ReadonlyArray<Action>): void {
    let anyChange = false;
    for (const action of actions) {
      const changed = this.applyAction(action);
      anyChange = anyChange || changed;
    }
    if (anyChange) this.notify();
  }

  private applyAction(action: Action): boolean {
    switch (action.kind) {
      case 'Begin':
        if (this._interaction) {
          // 已有交互，先 cancel 旧的
          this.cancelInteraction();
        }
        this._interaction = {
          label: action.label,
          snapshotDoc: this._doc,
          snapshotSelection: this._selection,
          lastPreview: null,
          undoLabel: action.label,
        };
        return false;

      case 'Preview':
        if (!this._interaction) return false;
        this._interaction.lastPreview = { commandId: action.commandId, params: action.params };
        const r1 = this.runCommand(this._interaction.snapshotDoc, this._interaction.snapshotSelection, action.commandId, action.params);
        if (r1.ok) {
          this._doc = r1.doc;
          this._selection = r1.selection;
        }
        return r1.ok;

      case 'Commit':
        if (!this._interaction) return false;
        if (this._interaction.lastPreview) {
          const lp = this._interaction.lastPreview;
          // 再次执行确保最终结果
          const r2 = this.runCommand(this._interaction.snapshotDoc, this._interaction.snapshotSelection, lp.commandId, lp.params);
          if (r2.ok) {
            // P0：仅文档真实变更写历史（框选/选中类手势不污染撤销栈）
            if (r2.doc !== this._interaction.snapshotDoc) {
              this.pushHistory({
                label: this._interaction.undoLabel,
                docBefore: this._interaction.snapshotDoc,
                docAfter: r2.doc,
                selectionBefore: this._interaction.snapshotSelection,
                selectionAfter: r2.selection,
              });
            }
            this._doc = r2.doc;
            this._selection = r2.selection;
          }
        }
        this._interaction = null;
        return true;

      case 'Cancel':
        if (this._interaction) {
          this.cancelInteraction();
          return true;
        }
        return false;

      case 'Exec':
        return this.execute(action.commandId, action.params).ok;

      default:
        return false;
    }
  }

  private cancelInteraction(): void {
    if (this._interaction) {
      this._doc = this._interaction.snapshotDoc;
      this._selection = this._interaction.snapshotSelection;
    }
    this._interaction = null;
  }

  setActiveTool(id: ToolId): void {
    if (this._activeToolId === id) return;
    this._activeToolId = id;
    this._gesture = null;
    if (this._interaction) this.cancelInteraction();
    this.notify();
  }

  dispatchPointer(event: PointerEvent): void {
    if (event.kind === 'cancel') {
      // 指针被捕获中断 → 取消手势并恢复快照
      if (this._gesture || this._interaction) {
        this.handleActions([{ kind: 'Cancel' }]);
        this._gesture = null;
      }
      return;
    }
    const ctx = this.makeToolContext();
    const tool = getTool(this._activeToolId);
    const actions = tool.pointer(ctx, event);
    this.handleActions(actions);

    if (event.kind === 'down') {
      const begin = actions.find(
        (a): a is Extract<Action, { readonly kind: 'Begin' }> => a.kind === 'Begin',
      );
      this._gesture = begin
        ? {
            kind: begin.gestureMode ?? 'move',
            startPoint: event.point,
            currentPoint: event.point,
            ids: begin.gestureMode === 'marquee' ? [] : [...this._selection.nodeIds],
          }
        : null;
    } else if (event.kind === 'drag' || event.kind === 'move') {
      if (this._gesture) {
        this._gesture = { ...this._gesture, currentPoint: event.point };
      }
    } else if (event.kind === 'up') {
      this._gesture = null;
    }
  }

  dispatchKey(key: Parameters<Runtime['dispatchKey']>[0], mods: Parameters<Runtime['dispatchKey']>[1]): void {
    // 手势进行中 Escape → 取消手势（优先于工具自身的 Escape 处理）
    if (key === 'Escape' && (this._gesture || this._interaction)) {
      this.handleActions([{ kind: 'Cancel' }]);
      this._gesture = null;
      return;
    }
    const ctx = this.makeToolContext();
    const tool = getTool(this._activeToolId);
    const actions = tool.key(ctx, key, mods);
    this.handleActions(actions);
  }

  overlay(): ReadonlyArray<OverlayElement> {
    const tool = getTool(this._activeToolId);
    if (!tool.overlay) return [];
    return tool.overlay(this.makeToolContext());
  }

  execute(commandId: CommandId, params: CommandParams): CommandResult {
    const spec = commandRegistry.find(commandId);
    if (!spec) {
      const err: CommandError = { kind: 'unknown-command', commandId, message: `unknown command ${commandId}` };
      return { ok: false, error: err };
    }
    if (commandId === 'history.undo') { this.undo(); return { ok: true, doc: this._doc, selection: this._selection }; }
    if (commandId === 'history.redo') { this.redo(); return { ok: true, doc: this._doc, selection: this._selection }; }
    if (commandId === 'tool.setActive') {
      const p = params as { tool: ToolId };
      this.setActiveTool(p.tool);
      return { ok: true, doc: this._doc, selection: this._selection };
    }

    const r = this.runCommand(this._doc, this._selection, commandId, params);
    if (r.ok) {
      // P0：仅文档真实变更写历史（select.*/tool.* 等选择类命令不入撤销栈）
      if (r.doc !== this._doc) {
        this.pushHistory({
          label: spec.undoLabel,
          docBefore: this._doc,
          docAfter: r.doc,
          selectionBefore: this._selection,
          selectionAfter: r.selection,
        });
      }
      this._doc = r.doc;
      this._selection = r.selection;
      this.notify();
    }
    return r;
  }

  undo(): boolean {
    if (this._interaction) this.cancelInteraction();
    const entry = this._history.undo[this._history.undo.length - 1];
    if (!entry) return false;
    const newUndo = this._history.undo.slice(0, -1);
    this._history = { ...this._history, undo: newUndo, redo: [...this._history.redo, entry] };
    this._doc = entry.docBefore;
    this._selection = entry.selectionBefore;
    this.notify();
    return true;
  }

  redo(): boolean {
    if (this._interaction) this.cancelInteraction();
    const entry = this._history.redo[this._history.redo.length - 1];
    if (!entry) return false;
    const newRedo = this._history.redo.slice(0, -1);
    this._history = { ...this._history, redo: newRedo, undo: [...this._history.undo, entry] };
    this._doc = entry.docAfter;
    this._selection = entry.selectionAfter;
    this.notify();
    return true;
  }

  async loadFromSvg(svg: string): Promise<LoadResult> {
    const r = await ioImportSvg(svg);
    this._doc = r.document;
    this._selection = emptySelection();
    this._history = { undo: [], redo: [], limit: HISTORY_LIMIT };
    this._gesture = null;
    this._interaction = null;
    this.notify();
    return r;
  }

  async exportToSvg(opts?: ExportOptions): Promise<string> {
    return ioExportSvg(this._doc, opts);
  }

  dispose(): void {
    this._listeners.clear();
  }

  // ---- Internals ----
  private pushHistory(entry: HistoryEntry): void {
    let undo = [...this._history.undo, entry];
    if (this._history.limit > 0 && undo.length > this._history.limit) {
      undo = undo.slice(undo.length - this._history.limit);
    }
    this._history = { ...this._history, undo, redo: [] };
    this._journal.append({
      timestamp: Date.now(),
      commandId: 'history.undo',
      params: {},
      resultRevision: this._doc._internal.revision,
      label: entry.label,
    });
  }

  private runCommand(
    doc: Document,
    selection: Selection,
    commandId: CommandId,
    rawParams: CommandParams,
  ): CommandResult {
    const spec = commandRegistry.find(commandId);
    if (!spec) {
      return { ok: false, error: { kind: 'unknown-command', commandId, message: `unknown ${commandId}` } };
    }
    try {
      return spec.handler(doc, selection, rawParams);
    } catch (e) {
      return {
        ok: false,
        error: {
          kind: 'internal',
          commandId,
          message: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  private makeToolContext(): ToolContext {
    return {
      doc: this._doc,
      selection: this._selection,
      zoom: 1,
      fillActive: true,
      constrainAngle: 0,
      snapToGrid: false,
      snapToPoint: false,
      snapTolerance: 4,
      gesture: this._gesture ?? undefined,
    };
  }

  private notify(): void {
    const snap = this._snapshot();
    for (const listener of this._listeners) listener(snap);
  }

  private _snapshot(): RuntimeSnapshot {
    return {
      revision: this._doc._internal.revision,
      document: this._doc,
      selection: this._selection,
      activeToolId: this._activeToolId,
      canUndo: this._history.undo.length > 0,
      canRedo: this._history.redo.length > 0,
    };
  }
}

// ============================================================================
// 2. Journal
// ============================================================================

class JournalImpl implements Journal {
  private _entries: JournalEntry[] = [];
  get entries(): ReadonlyArray<JournalEntry> { return this._entries; }
  append(entry: JournalEntry): void { this._entries = [...this._entries, entry]; }
  clear(): void { this._entries = []; }
  replay(_from: number, _to: number): Document {
    // P1 阶段 stub：replay 不重新生成 Document（M2 阶段实装）
    return createEmptyDocument();
  }
}

// ============================================================================
// 3. 工具桩（select/node/pen 实际逻辑在 M3-tools.ts 实现）
// ============================================================================

import { getTool } from './tools';

// ============================================================================
// 4. 工厂
// ============================================================================

function createEmptyDocument(): Document {
  return {
    canvas: { width: 100, height: 100, unit: 'px', viewBox: null },
    layers: [],
    nodes: new Map(),
    nextNodeId: 1,
    metadata: {},
    _internal: { revision: 0 },
  };
}

export function createRuntime(initial?: LoadResult): Runtime {
  return new RuntimeImpl(initial);
}