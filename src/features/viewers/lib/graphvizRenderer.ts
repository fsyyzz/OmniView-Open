/**
 * Graphviz 渲染器服务 (支持 Web Worker 与 VS Code Webview 沙箱直接 WASM 双模回退)
 */
import { validateGraphvizSource, sanitizeGraphvizSvg } from './graphvizSanitizer';
import type { WorkerRequest, WorkerResponse } from '../workers/graphviz.worker';
import { Graphviz, type Engine } from '@hpcc-js/wasm-graphviz';

export type GraphvizEngine = Engine;

interface PendingTask {
  resolve: (svg: string) => void;
  reject: (err: Error) => void;
  timer: any;
  requestId: string;
}

class GraphvizRendererService {
  private worker: Worker | null = null;
  private workerFailed: boolean = false;
  private pendingTasks: Map<string, PendingTask> = new Map();
  private cache: Map<string, string> = new Map();
  private maxCacheSize: number = 100;
  private reqSeq: number = 0;
  private timeoutMs: number = 10000;
  private directGraphvizPromise: Promise<Graphviz> | null = null;

  /**
   * 生成缓存 Key
   */
  private getCacheKey(source: string, engine: GraphvizEngine): string {
    return `${engine}:${source.trim()}`;
  }

  /**
   * 获取直接在主线程/Webview 沙箱内运行的 Graphviz WASM 单例
   */
  private async getDirectGraphviz(): Promise<Graphviz> {
    if (!this.directGraphvizPromise) {
      this.directGraphvizPromise = Graphviz.load();
    }
    return this.directGraphvizPromise;
  }

  /**
   * 按需延迟初始化 Web Worker（若受 VS Code Webview 跨源策略限制，则标记失败并安全降级）
   */
  private getOrCreateWorker(): Worker | null {
    if (this.workerFailed) {
      return null;
    }
    if (this.worker) {
      return this.worker;
    }

    try {
      const worker = new Worker(
        new URL('../workers/graphviz.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { id, success, svg, error } = e.data;
        const task = this.pendingTasks.get(id);
        if (!task) return;

        clearTimeout(task.timer);
        this.pendingTasks.delete(id);

        if (success && svg) {
          try {
            const cleanSvg = sanitizeGraphvizSvg(svg);
            task.resolve(cleanSvg);
          } catch (sanitizeErr: any) {
            task.reject(sanitizeErr);
          }
        } else {
          task.reject(new Error(error || 'Graphviz 渲染失败'));
        }
      };

      worker.onerror = (err) => {
        console.warn('[OmniView Graphviz Worker] Worker 异常，自动降级至进程内 WASM 渲染:', err);
        this.workerFailed = true;
        this.restartWorker();
      };

      this.worker = worker;
      return worker;
    } catch (err: any) {
      console.warn('[OmniView Graphviz Worker] Webview 沙箱不支持直接构造跨源 Worker，已无缝切换至进程内 WASM 引擎:', err?.message);
      this.workerFailed = true;
      return null;
    }
  }

  /**
   * 重启 Worker 并清理悬挂任务
   */
  private restartWorker(): void {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }

    this.pendingTasks.forEach((task) => {
      clearTimeout(task.timer);
      task.reject(new Error('Graphviz Worker 异常重启'));
    });
    this.pendingTasks.clear();
  }

  /**
   * 进程内直接异步执行 Graphviz WASM 渲染
   */
  private async renderDirectly(source: string, engine: GraphvizEngine): Promise<string> {
    // 让出微任务时间切片，保证 UI 响应
    await new Promise((resolve) => setTimeout(resolve, 0));
    const graphviz = await this.getDirectGraphviz();
    const rawSvg = graphviz.layout(source, 'svg', engine);
    return sanitizeGraphvizSvg(rawSvg);
  }

  /**
   * 渲染 Graphviz 源码为 SVG 矢量图
   */
  public async render(source: string, engine: GraphvizEngine = 'dot'): Promise<string> {
    // 1. 前置安全与语法长度校验
    const validation = validateGraphvizSource(source);
    if (!validation.valid) {
      throw new Error(validation.error || '无效的 Graphviz 源码');
    }

    // 2. 检查缓存命中
    const cacheKey = this.getCacheKey(source, engine);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 3. 尝试 Worker 渲染或沙箱直接降级
    let worker: Worker | null = null;
    try {
      worker = this.getOrCreateWorker();
    } catch {
      worker = null;
    }

    // 若无法使用 Worker（如 VS Code Webview 沙箱跨源策略拦截），直接走内存 WASM
    if (!worker) {
      const cleanSvg = await this.renderDirectly(source, engine);
      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, cleanSvg);
      return cleanSvg;
    }

    // 4. 分配唯一请求 ID
    const requestId = `gv-${Date.now()}-${++this.reqSeq}`;

    // 5. Worker 异步等待 Promise
    const svgPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingTasks.has(requestId)) {
          this.pendingTasks.delete(requestId);
          this.restartWorker();
          // 超时后自动尝试直接渲染降级
          this.renderDirectly(source, engine)
            .then((svg) => {
              this.cache.set(cacheKey, svg);
              resolve(svg);
            })
            .catch(reject);
        }
      }, this.timeoutMs);

      this.pendingTasks.set(requestId, {
        resolve: (svg: string) => {
          if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
          }
          this.cache.set(cacheKey, svg);
          resolve(svg);
        },
        reject,
        timer,
        requestId,
      });

      try {
        const msg: WorkerRequest = {
          id: requestId,
          source,
          engine,
        };
        worker.postMessage(msg);
      } catch (postErr: any) {
        clearTimeout(timer);
        this.pendingTasks.delete(requestId);
        // postMessage 失败时立即自动走直接渲染
        this.renderDirectly(source, engine)
          .then((svg) => {
            this.cache.set(cacheKey, svg);
            resolve(svg);
          })
          .catch(reject);
      }
    });

    return svgPromise;
  }

  /**
   * 释放资源（在文档卸载时调用）
   */
  public dispose(): void {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }
    this.pendingTasks.forEach((task) => {
      clearTimeout(task.timer);
    });
    this.pendingTasks.clear();
    this.cache.clear();
  }
}

export const graphvizRenderer = new GraphvizRendererService();
