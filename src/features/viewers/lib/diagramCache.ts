/**
 * 图表与复杂渲染块通用 LRU 内存缓存池与持久化门面 (Diagram & Math Content-Hash Cache)
 * 1. 内存层：DiagramLruCache (0ms 快速响应)
 * 2. 磁盘层：PersistentDiagramCache (结合 IndexedDB render_cache，带 50MB 配额守护与离线化)
 */
import {
  idbGetRenderCache,
  idbSetRenderCache,
  idbDeleteRenderCache,
} from '../../../shared/lib/indexedDbStorage';

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

/**
 * 生成全系统统一的确定性渲染快照唯一键
 * 经过输入规范化（CRLF 统一与首尾裁剪），正交组合 engine、format、theme、hash
 */
export function makeDeterministicCacheKey(
  engine: 'plantuml' | 'mermaid' | 'graphviz' | 'katex' | string,
  code: string,
  theme: string | boolean = 'dark',
  format: 'svg' | 'png' = 'svg'
): string {
  const normalizedCode = code.replace(/\r\n/g, '\n').trim();
  const themeStr = typeof theme === 'boolean' ? (theme ? 'dark' : 'light') : theme || 'dark';
  const hash = fastFnv1a(normalizedCode);
  return `cache:render:${engine}:${format}:${themeStr}:${hash}`;
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

/**
 * 融合双层缓存（内存 LRU + IndexedDB 持久化）的高级门面
 */
export class PersistentDiagramCache {
  private memoryLru: DiagramLruCache<string>;
  private engine: string;
  private pendingReads = new Map<string, Promise<string | undefined>>();

  constructor(engine: string, memoryMaxSize = 100) {
    this.engine = engine;
    this.memoryLru = new DiagramLruCache<string>(memoryMaxSize);
  }

  /**
   * 优先查内存，未命中异步查 IndexedDB（查到后回填内存）
   */
  public async get(key: string): Promise<string | undefined> {
    // 1. 内存层命中 (0ms)
    const memVal = this.memoryLru.get(key);
    if (memVal !== undefined) {
      return memVal;
    }

    // 2. 避免并发击穿：复用正在读取中的同一 Promise
    const pending = this.pendingReads.get(key);
    if (pending) {
      return pending;
    }

    const readPromise = (async () => {
      try {
        const idbVal = await idbGetRenderCache(key);
        if (idbVal !== undefined) {
          this.memoryLru.set(key, idbVal);
          return idbVal;
        }
        return undefined;
      } finally {
        this.pendingReads.delete(key);
      }
    })();

    this.pendingReads.set(key, readPromise);
    return readPromise;
  }

  /**
   * 同步直接获取内存中的缓存（用于无法 await 的同步渲染生命周期）
   */
  public getSync(key: string): string | undefined {
    return this.memoryLru.get(key);
  }

  /**
   * 写入缓存：立即写入内存，并后台非阻塞持久化至 IndexedDB
   */
  public async set(key: string, data: string, format = 'svg'): Promise<void> {
    this.memoryLru.set(key, data);
    try {
      await idbSetRenderCache({
        key,
        engine: this.engine,
        format,
        data,
      });
    } catch {
      // 存储失败静默降级，不阻断前端渲染流程
    }
  }

  /**
   * 删除指定条目
   */
  public async delete(key: string): Promise<void> {
    this.memoryLru.set(key, '');
    await idbDeleteRenderCache(key);
  }

  /**
   * 清空内存缓存
   */
  public clearMemory(): void {
    this.memoryLru.clear();
  }
}

/** 全局共享单例：Mermaid 渲染缓存 */
export const mermaidRenderCache = new DiagramLruCache<string>(100);

/** 全局共享单例：KaTeX 数学公式渲染缓存 */
export const katexRenderCache = new DiagramLruCache<string>(150);

/** 全局共享单例：Graphviz 渲染缓存 */
export const graphvizRenderCache = new DiagramLruCache<string>(100);

/** 全局共享持久化单例：PlantUML 在线渲染持久化快照缓存池 */
export const persistentPlantUmlCache = new PersistentDiagramCache('plantuml', 100);

/** 全局共享持久化单例：Mermaid 持久化快照缓存池 */
export const persistentMermaidCache = new PersistentDiagramCache('mermaid', 100);

/** 全局共享持久化单例：Graphviz 持久化快照缓存池 */
export const persistentGraphvizCache = new PersistentDiagramCache('graphviz', 100);
