/**
 * OmniView 渲染耗时预算与慢块监控体系 (Render Time Budget & Slow Block Registry)
 * 职责：
 * 1. 记录各个重块（Mermaid, Graphviz, PlantUML, Table, Math, Excalidraw 等）的解析与渲染耗时毫秒
 * 2. 对超过预算门限 (默认 800ms) 的重块进行标记与降级保护
 * 3. 向大纲导航提供慢块信息，在大纲中清晰标识慢块与耗时
 */

export interface BlockPerformanceMetric {
  blockId: string;
  blockType: string;
  durationMs: number;
  isSlow: boolean;
  startLine?: number;
  endLine?: number;
  timestamp: number;
}

// 默认单块渲染耗时预算门限 (毫秒)
export const DEFAULT_BLOCK_TIME_BUDGET_MS = 800;

// 全局内存单例指标仓储
class RenderTimeBudgetRegistry {
  private metrics = new Map<string, BlockPerformanceMetric>();
  private slowLines = new Set<number>();
  private listeners = new Set<() => void>();

  public recordTime(
    blockId: string,
    blockType: string,
    durationMs: number,
    startLine?: number,
    endLine?: number,
    budgetMs = DEFAULT_BLOCK_TIME_BUDGET_MS
  ): boolean {
    const isSlow = durationMs >= budgetMs;
    const metric: BlockPerformanceMetric = {
      blockId,
      blockType,
      durationMs: Math.round(durationMs),
      isSlow,
      startLine,
      endLine,
      timestamp: Date.now(),
    };

    this.metrics.set(blockId, metric);

    if (isSlow && typeof startLine === 'number') {
      this.slowLines.add(startLine);
    } else if (!isSlow && typeof startLine === 'number') {
      this.slowLines.delete(startLine);
    }

    this.notify();
    return isSlow;
  }

  public getMetric(blockId: string): BlockPerformanceMetric | undefined {
    return this.metrics.get(blockId);
  }

  public isLineSlow(line: number): boolean {
    return this.slowLines.has(line);
  }

  public getSlowMetrics(): BlockPerformanceMetric[] {
    return Array.from(this.metrics.values()).filter(m => m.isSlow);
  }

  public clear(): void {
    this.metrics.clear();
    this.slowLines.clear();
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        // ignore
      }
    }
  }
}

export const renderTimeBudgetRegistry = new RenderTimeBudgetRegistry();
