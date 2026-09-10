/**
 * OmniView 文本编辑器撤销/重做历史状态管理 Hook (useTextHistory)
 * 基于纯逻辑 TextHistoryStack 实现，提供完备的 Undo / Redo 历史快照栈与快捷响应
 */
import { useRef, useState, useCallback } from 'react';
import { TextHistoryStack, HistorySnapshot, TextHistoryOptions } from '../lib/historyStack';

export type { HistorySnapshot, TextHistoryOptions };

export interface UseTextHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  recordChange: (
    newValue: string,
    selectionStart?: number,
    selectionEnd?: number,
    forceNewSnapshot?: boolean
  ) => void;
  undo: () => HistorySnapshot | null;
  redo: () => HistorySnapshot | null;
  reset: (initialValue: string) => void;
  historyLength: number;
  currentIndex: number;
}

export function useTextHistory(
  initialValue: string,
  options: TextHistoryOptions = {}
): UseTextHistoryReturn {
  const stackRef = useRef<TextHistoryStack>(new TextHistoryStack(initialValue, options));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(stackRef.current.canUndo);
    setCanRedo(stackRef.current.canRedo);
  }, []);

  const recordChange = useCallback(
    (
      newValue: string,
      selectionStart?: number,
      selectionEnd?: number,
      forceNewSnapshot = false
    ) => {
      stackRef.current.recordChange(newValue, selectionStart, selectionEnd, forceNewSnapshot);
      syncFlags();
    },
    [syncFlags]
  );

  const undo = useCallback((): HistorySnapshot | null => {
    const res = stackRef.current.undo();
    syncFlags();
    return res;
  }, [syncFlags]);

  const redo = useCallback((): HistorySnapshot | null => {
    const res = stackRef.current.redo();
    syncFlags();
    return res;
  }, [syncFlags]);

  const reset = useCallback(
    (newInitialValue: string) => {
      stackRef.current.reset(newInitialValue);
      syncFlags();
    },
    [syncFlags]
  );

  return {
    canUndo,
    canRedo,
    recordChange,
    undo,
    redo,
    reset,
    historyLength: stackRef.current.length,
    currentIndex: stackRef.current.index,
  };
}
