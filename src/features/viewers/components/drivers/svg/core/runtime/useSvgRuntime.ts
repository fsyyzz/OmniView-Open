/**
 * OmniView SVG 编辑引擎 v2 — React Hook (M4)
 *
 * useSvgRuntime：在 React 组件里订阅 Runtime 状态变化。
 * useSvgRuntimeCommand：派发命令到 Runtime。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Runtime, RuntimeSnapshot, ToolId } from './types';
import type { CommandId, CommandParams } from '../commands/types';
import type { Document, Selection } from '../model/types';
import { createRuntime } from './runtime';

export function useSvgRuntime(initialContent?: string): {
  runtime: Runtime;
  snapshot: RuntimeSnapshot;
  document: Document;
  selection: Selection;
  activeToolId: ToolId;
  canUndo: boolean;
  canRedo: boolean;
  execute: (id: CommandId, params: CommandParams) => void;
  undo: () => void;
  redo: () => void;
  setActiveTool: (id: ToolId) => void;
} {
  const runtimeRef = useRef<Runtime | null>(null);
  if (runtimeRef.current === null) {
    runtimeRef.current = createRuntime();
  }
  const runtime = runtimeRef.current;
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(() => ({
    revision: 0,
    document: runtime.currentDocument,
    selection: runtime.currentSelection,
    activeToolId: runtime.activeToolId,
    canUndo: runtime.history.undo.length > 0,
    canRedo: runtime.history.redo.length > 0,
  }));

  useEffect(() => {
    if (initialContent) {
      runtime.loadFromSvg(initialContent).catch(() => { /* fallback handled by importSvg */ });
    }
    return runtime.subscribe(setSnapshot);
  }, [runtime, initialContent]);

  const execute = useCallback((id: CommandId, params: CommandParams) => {
    runtime.execute(id, params);
  }, [runtime]);

  const undo = useCallback(() => { runtime.undo(); }, [runtime]);
  const redo = useCallback(() => { runtime.redo(); }, [runtime]);
  const setActiveTool = useCallback((id: ToolId) => { runtime.setActiveTool(id); }, [runtime]);

  return {
    runtime,
    snapshot,
    document: snapshot.document,
    selection: snapshot.selection,
    activeToolId: snapshot.activeToolId,
    canUndo: snapshot.canUndo,
    canRedo: snapshot.canRedo,
    execute,
    undo,
    redo,
    setActiveTool,
  };
}