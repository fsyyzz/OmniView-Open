/**
 * OmniView 文本历史栈状态机 (TextHistoryStack)
 * 纯逻辑层：无 React / DOM 依赖，支持单测、无缝状态迁移与高性能 Undo/Redo
 */

export interface HistorySnapshot {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  timestamp: number;
}

export interface TextHistoryOptions {
  maxDepth?: number;
  mergeThresholdMs?: number;
}

export class TextHistoryStack {
  private history: HistorySnapshot[];
  private currentIndex: number;
  private maxDepth: number;
  private mergeThresholdMs: number;

  constructor(initialValue: string = '', options: TextHistoryOptions = {}) {
    this.maxDepth = options.maxDepth ?? 150;
    this.mergeThresholdMs = options.mergeThresholdMs ?? 600;
    this.history = [
      {
        value: initialValue,
        selectionStart: initialValue.length,
        selectionEnd: initialValue.length,
        timestamp: Date.now(),
      },
    ];
    this.currentIndex = 0;
  }

  get canUndo(): boolean {
    return this.currentIndex > 0;
  }

  get canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  get length(): number {
    return this.history.length;
  }

  get index(): number {
    return this.currentIndex;
  }

  get currentSnapshot(): HistorySnapshot {
    return this.history[this.currentIndex];
  }

  /**
   * 记录一次新的文本输入/修改
   */
  recordChange(
    newValue: string,
    selectionStart?: number,
    selectionEnd?: number,
    forceNewSnapshot = false
  ): boolean {
    const currentSnapshot = this.history[this.currentIndex];
    const now = Date.now();
    const start = selectionStart ?? newValue.length;
    const end = selectionEnd ?? start;

    // 内容完全相同，仅更新当前光标
    if (currentSnapshot && currentSnapshot.value === newValue) {
      currentSnapshot.selectionStart = start;
      currentSnapshot.selectionEnd = end;
      return false;
    }

    // 判定是否符合打字合并策略：
    // 注意：只有在 currentIndex > 0（非初始基线快照）时才允许就地合并，
    // 确保用户的首次编辑能够独立成步，初始文件内容永远可以被撤回！
    const isTypingMerge =
      this.currentIndex > 0 &&
      !forceNewSnapshot &&
      currentSnapshot &&
      now - currentSnapshot.timestamp < this.mergeThresholdMs &&
      newValue.includes('\n') === currentSnapshot.value.includes('\n') &&
      Math.abs(newValue.length - currentSnapshot.value.length) < 8;

    if (isTypingMerge && currentSnapshot) {
      currentSnapshot.value = newValue;
      currentSnapshot.selectionStart = start;
      currentSnapshot.selectionEnd = end;
      currentSnapshot.timestamp = now;
      return false;
    }

    // 截断未来分支
    const nextHistory = this.history.slice(0, this.currentIndex + 1);
    nextHistory.push({
      value: newValue,
      selectionStart: start,
      selectionEnd: end,
      timestamp: now,
    });

    if (nextHistory.length > this.maxDepth) {
      nextHistory.shift();
    }

    this.history = nextHistory;
    this.currentIndex = nextHistory.length - 1;
    return true;
  }

  /**
   * 撤销 (Undo)
   */
  undo(): HistorySnapshot | null {
    if (!this.canUndo) {
      return null;
    }
    this.currentIndex -= 1;
    return this.history[this.currentIndex];
  }

  /**
   * 重做 (Redo)
   */
  redo(): HistorySnapshot | null {
    if (!this.canRedo) {
      return null;
    }
    this.currentIndex += 1;
    return this.history[this.currentIndex];
  }

  /**
   * 重置历史栈为指定初始值
   */
  reset(newInitialValue: string) {
    this.history = [
      {
        value: newInitialValue,
        selectionStart: newInitialValue.length,
        selectionEnd: newInitialValue.length,
        timestamp: Date.now(),
      },
    ];
    this.currentIndex = 0;
  }
}
