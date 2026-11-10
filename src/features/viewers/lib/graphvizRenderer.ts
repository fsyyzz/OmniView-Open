/**
 * Graphviz 渲染器服务 (支持 Web Worker 与 VS Code Webview 沙箱直接 WASM 双模回退)
 * 支持 14 大渲染主题高保真自适应 (Dracula, Catppuccin, Nord, Sepia, Tokyo Night 等)
 * 智能保留用户显式语法着色，并使默认黑白图元与多主题背景像素级深度融合
 */
import { validateGraphvizSource, sanitizeGraphvizSvg } from './graphvizSanitizer.ts';
import type { WorkerRequest, WorkerResponse } from '../workers/graphviz.worker.ts';
import { Graphviz, type Engine } from '@hpcc-js/wasm-graphviz';
import { persistentGraphvizCache, makeDeterministicCacheKey } from './diagramCache.ts';
import { appLogger } from '../../../shared/lib/appLogger.ts';
import type { ThemeId } from '../../../shared/types.ts';
import {
  GRAPHVIZ_THEME_PALETTES,
  resolveGraphvizPalette,
  solidifyGraphvizSvg,
  type GraphvizThemePalette,
} from './graphvizTheme.ts';

export type GraphvizEngine = Engine;
export {
  GRAPHVIZ_THEME_PALETTES,
  resolveGraphvizPalette,
  solidifyGraphvizSvg,
  type GraphvizThemePalette,
};

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
   * 获取直接在主线程/Webview 沙箱内运行的 Graphviz WASM 单例
   */
  private async getDirectGraphviz(): Promise<Graphviz> {
    if (!this.directGraphvizPromise) {
      this.directGraphvizPromise = Graphviz.load();
    }
    return this.directGraphvizPromise;
  }

  /**
   * 按需延迟初始化 Web Worker
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
    await new Promise((resolve) => setTimeout(resolve, 0));
    const graphviz = await this.getDirectGraphviz();
    const rawSvg = graphviz.layout(source, 'svg', engine);
    return sanitizeGraphvizSvg(rawSvg);
  }

  /**
   * 渲染 Graphviz 源码为 SVG 矢量图，并与当前 14 大渲染主题深度融合
   */
  public async render(
    source: string,
    engine: GraphvizEngine = 'dot',
    themeOrIsDark?: ThemeId | string | boolean
  ): Promise<string> {
    // 1. 前置安全与语法长度校验
    const validation = validateGraphvizSource(source);
    if (!validation.valid) {
      const err = validation.error || '无效的 Graphviz 源码';
      appLogger.warn('render:graphviz', err, source);
      throw new Error(err);
    }

    const activeThemeId = typeof themeOrIsDark === 'string' ? themeOrIsDark : (themeOrIsDark ? 'dark' : 'light');

    // 2. 检查双层持久化缓存命中 (0ms 内存 + IndexedDB 磁盘回填)
    const cacheKey = makeDeterministicCacheKey(`graphviz:v3:${engine}`, source, activeThemeId, 'svg');
    const cached = await persistentGraphvizCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 3. 尝试 Worker 渲染或沙箱直接降级
    let worker: Worker | null = null;
    try {
      worker = this.getOrCreateWorker();
    } catch {
      worker = null;
    }

    // 若无法使用 Worker，直接走内存 WASM
    if (!worker) {
      const rawSvg = await this.renderDirectly(source, engine);
      const cleanSvg = solidifyGraphvizSvg(rawSvg, themeOrIsDark);
      void persistentGraphvizCache.set(cacheKey, cleanSvg, 'svg');
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
          this.renderDirectly(source, engine)
            .then((raw) => {
              const svg = solidifyGraphvizSvg(raw, themeOrIsDark);
              void persistentGraphvizCache.set(cacheKey, svg, 'svg');
              resolve(svg);
            })
            .catch(reject);
        }
      }, this.timeoutMs);

      this.pendingTasks.set(requestId, {
        resolve: (rawSvg: string) => {
          const svg = solidifyGraphvizSvg(rawSvg, themeOrIsDark);
          void persistentGraphvizCache.set(cacheKey, svg, 'svg');
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
      } catch {
        clearTimeout(timer);
        this.pendingTasks.delete(requestId);
        this.renderDirectly(source, engine)
          .then((raw) => {
            const svg = solidifyGraphvizSvg(raw, themeOrIsDark);
            void persistentGraphvizCache.set(cacheKey, svg, 'svg');
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
