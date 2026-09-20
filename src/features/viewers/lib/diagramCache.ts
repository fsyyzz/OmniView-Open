/**
 * 图表与复杂渲染块通用 LRU 内存缓存池 (Diagram & Math Content-Hash Cache)
 * 支持哈希索引、容量限制与命中统计，避免频繁编译导致的卡顿与 CPU 尖刺。
 */

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * 快速 32 位 FNV-1a 哈希算法（执行耗时 < 0.05ms）
 */
export function fastFnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export class DiagramLruCache<T = string> {
  private cache = new Map<string, T>();
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  /**
   * 生成复合缓存键
   */
  public makeKey(prefix: string, code: string, extra = ''): string {
    const hash = fastFnv1a(code.trim());
    return extra ? `${prefix}:${extra}:${hash}` : `${prefix}:${hash}`;
  }

  /**
   * 获取缓存项，命中时将其推到最近使用的尾部
   */
  public get(key: string): T | undefined {
    if (!this.cache.has(key)) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    const value = this.cache.get(key)!;
    // LRU 换出机制：重新插入到 Map 尾部
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * 写入缓存项并触发淘汰
   */
  public set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 淘汰最久未访问的首个条目
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  /**
   * 判断是否存在缓存
   */
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * 清空缓存
   */
  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 获取当前缓存运行统计指标
   */
  public getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number((this.hits / total).toFixed(4)) : 0,
    };
  }
}

/** 全局共享单例：Mermaid 渲染缓存 */
export const mermaidRenderCache = new DiagramLruCache<string>(100);

/** 全局共享单例：KaTeX 数学公式渲染缓存 */
export const katexRenderCache = new DiagramLruCache<string>(150);

/** 全局共享单例：Graphviz 渲染缓存 */
export const graphvizRenderCache = new DiagramLruCache<string>(100);
