/**
 * OmniView Markdown 块渲染高度缓存池 (BlockHeightCache)
 * 
 * 核心机制:
 * 1. LRU 容量淘汰机制 (默认最多缓存 1000 个块高度，防止超长文档内存泄露);
 * 2. 块类型启发式高度智能预估 (在首次挂载未出 DOM 尺寸前提供加权预估);
 * 3. 真实物理渲染高度记忆 (配合 ResizeObserver 0.5px 精确测量写回);
 * 4. 彻底消除长文档反向滚动时的累积布局偏移 (CLS = 0)。
 */

export type BlockType = 'math' | 'diagram' | 'code' | 'table' | 'html' | 'default';

export interface HeightCacheEntry {
  height: number;
  type: BlockType;
  updatedAt: number;
}

export class BlockHeightCache {
  private cache = new Map<string, HeightCacheEntry>();
  private readonly maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  /**
   * 记录块的测量高度 (精确至整数像素)
   */
  public set(id: string, height: number, type: BlockType = 'default'): void {
    if (!id || height <= 0 || Number.isNaN(height)) return;

    // LRU 淘汰：若超限且 key 不在 Map 中，删除最久未访问的条目
    if (this.cache.size >= this.maxEntries && !this.cache.has(id)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(id, {
      height: Math.round(height),
      type,
      updatedAt: Date.now(),
    });
  }

  /**
   * 获取块高度：若已测量则返回真实历史高度，否则返回类型预估高度
   */
  public get(id?: string, fallbackType?: BlockType, defaultMin = 140): number {
    if (id && this.cache.has(id)) {
      const entry = this.cache.get(id)!;
      // 刷新访问顺序
      this.cache.delete(id);
      this.cache.set(id, { ...entry, updatedAt: Date.now() });
      if (entry.height > 20) {
        return entry.height;
      }
    }

    return this.getEstimatedHeight(fallbackType, defaultMin);
  }

  /**
   * 基于块类型启发式评估首屏占位高度，减轻视觉落差
   */
  public getEstimatedHeight(type?: BlockType, defaultMin = 140): number {
    switch (type) {
      case 'math':
        return 110;
      case 'diagram':
        return 320;
      case 'code':
        return 180;
      case 'table':
        return 220;
      case 'html':
        return 80;
      default:
        return defaultMin;
    }
  }

  public has(id: string): boolean {
    return this.cache.has(id);
  }

  public size(): number {
    return this.cache.size;
  }

  public clear(): void {
    this.cache.clear();
  }
}

// 全局单例
export const globalBlockHeightCache = new BlockHeightCache(1500);

