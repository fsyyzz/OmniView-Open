/**
 * OmniView SVG 编辑引擎 v2 — SvgWasmBridge 主线程门面 (M1)
 *
 * 单一职责：把对 Worker 的请求收敛为 Promise API；自动检测 usvg-wasm
 * 不可用并走 fallback。
 *
 * @see docs/adr/0001-svg-edit-engine-v2-document-model.md §10
 */

import type {
  PingResponse,
  WorkerRequest,
  WorkerResponse,
} from '../../../../../workers/svg.worker';
import type { UsvgTree } from './types';

// ============================================================================
// 1. SvgWasmBridge 实现
// ============================================================================

export interface SvgWasmBridgeOptions {
  /** Worker 构造器；测试态可注入 mock。 */
  readonly workerFactory?: () => Worker;
  /** 请求超时（毫秒）；默认 5000。 */
  readonly timeoutMs?: number;
}

export class SvgWasmBridgeImpl {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, {
    readonly kind: WorkerRequest['kind'];
    readonly resolve: (value: WorkerResponse) => void;
    readonly reject: (error: Error) => void;
    readonly timer: ReturnType<typeof setTimeout>;
  }>();
  private readonly timeoutMs: number;
  private readonly workerFactory: () => Worker;

  constructor(options: SvgWasmBridgeOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.workerFactory = options.workerFactory ?? defaultWorkerFactory;
  }

  /** 懒启动 worker；返回是否就绪。 */
  async ping(): Promise<PingResponse> {
    return new Promise<PingResponse>((resolve, reject) => {
      this.request(
        { kind: 'ping', id: this.allocId() },
        'ping',
        (resp) => resolve(resp as PingResponse),
        reject,
      );
    });
  }

  /** 解析 SVG → UsvgTree JSON。 */
  async parse(svg: string): Promise<UsvgTree> {
    const id = this.allocId();
    const resp = await new Promise<WorkerResponse>((resolve, reject) => {
      this.request({ kind: 'parse', id, svg }, 'parse', resolve, reject);
    });
    if (resp.kind !== 'parse' || !resp.ok || !resp.treeJson) {
      throw new Error(resp.kind === 'parse' ? (resp.error ?? 'parse failed') : 'unexpected response');
    }
    return JSON.parse(resp.treeJson) as UsvgTree;
  }

  /** 序列化 UsvgTree JSON → SVG 字符串。 */
  async serialize(_tree: UsvgTree, _opts?: { pretty?: boolean; indentSize?: number }): Promise<string> {
    const id = this.allocId();
    const resp = await new Promise<WorkerResponse>((resolve, reject) => {
      this.request({
        kind: 'serialize',
        id,
        treeJson: JSON.stringify(_tree),
      }, 'serialize', resolve, reject);
    });
    if (resp.kind !== 'serialize' || !resp.ok || !resp.svg) {
      throw new Error(resp.kind === 'serialize' ? (resp.error ?? 'serialize failed') : 'unexpected response');
    }
    return resp.svg;
  }

  /** 释放资源。 */
  dispose(): void {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('SvgWasmBridge disposed'));
    }
    this.pending.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /** 当前是否已就绪（worker 已创建且握手成功）。 */
  get ready(): boolean {
    return this.worker !== null;
  }

  // ------------------------------------------------------------------------

  private allocId(): number {
    return this.nextId++;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const w = this.workerFactory();
    w.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const resp = event.data;
      const entry = this.pending.get(resp.id);
      if (!entry) return;
      if (resp.kind !== entry.kind) {
        // 类型不匹配（ping/parse/serialize），拒收
        return;
      }
      this.pending.delete(resp.id);
      clearTimeout(entry.timer);
      entry.resolve(resp);
    });
    w.addEventListener('error', (event) => {
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new Error(`worker error: ${event.message ?? 'unknown'}`));
      }
      this.pending.clear();
    });
    this.worker = w;
    return w;
  }

  private request(
    payload: WorkerRequest,
    kind: WorkerRequest['kind'],
    resolve: (value: WorkerResponse) => void,
    reject: (error: Error) => void,
  ): void {
    const w = this.ensureWorker();
    const timer = setTimeout(() => {
      this.pending.delete(payload.id);
      reject(new Error(`SvgWasmBridge request ${kind}#${payload.id} timed out`));
    }, this.timeoutMs);
    this.pending.set(payload.id, { kind, resolve, reject, timer });
    w.postMessage(payload);
  }
}

// ============================================================================
// 2. 默认 worker 工厂（Vite ?worker import）
// ============================================================================

/**
 * 默认 worker 工厂。Vite 6 支持 `new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })`
 * 模式；M1 阶段引入 usvg-wasm 后该工厂才会真正启动。
 *
 * 当前为骨架：返回一个会被 init 阶段立刻失败的 mock worker（产物缺失 → 走 fallback）。
 */
function defaultWorkerFactory(): Worker {
  // Vite 在构建时会处理 `new Worker(new URL(...), { type: 'module' })` 模式。
  // 这里直接构造；运行时若产物缺失，bridge.ping() 会通过 PongResponse.engine='fallback-dom' 告知调用方。
  const url = new URL('../../../../../workers/svg.worker.ts', import.meta.url);
  return new Worker(url, { type: 'module' });
}

// ============================================================================
// 3. 单例门面（导出）
// ============================================================================

let _instance: SvgWasmBridgeImpl | null = null;

/** 获取全局 SvgWasmBridge 单例；首次调用时懒创建。 */
export function getSvgWasmBridge(): SvgWasmBridgeImpl {
  if (!_instance) _instance = new SvgWasmBridgeImpl();
  return _instance;
}

/** 测试/多实例用：创建新实例。 */
export function createSvgWasmBridge(opts?: SvgWasmBridgeOptions): SvgWasmBridgeImpl {
  return new SvgWasmBridgeImpl(opts);
}