/**
 * OmniView SVG 编辑引擎 v2 — Web Worker (M1 阶段 usvg-wasm 集成点)
 *
 * 当前为骨架实现：usvg-wasm 尚未编译落地（需 Rust toolchain，见
 * ADR-0001 §10），因此本 Worker 仅维护消息协议 + 透传逻辑。
 *
 * 一旦 `public/usvg-wasm/` 产物就绪（M1 实际编译），将启用
 * `import init, { parse_svg, serialize_tree } from '../../../../public/usvg-wasm/usvg_wasm.js'`
 * 并把 worker 切换到 WASM 模式。
 *
 * @see docs/adr/0001-svg-edit-engine-v2-document-model.md §10
 */

// ============================================================================
// 1. Worker 协议（与 main 线程约定的消息 schema）
// ============================================================================

/** 主线程 → Worker：请求解析 SVG。 */
export interface ParseRequest {
  readonly kind: 'parse';
  readonly id: number;
  readonly svg: string;
}

/** 主线程 → Worker：请求序列化 UsvgTree JSON → SVG 字符串。 */
export interface SerializeRequest {
  readonly kind: 'serialize';
  readonly id: number;
  readonly treeJson: string;
}

/** 主线程 → Worker：健康检查。 */
export interface PingRequest {
  readonly kind: 'ping';
  readonly id: number;
}

export type WorkerRequest = ParseRequest | SerializeRequest | PingRequest;

export interface ParseResponse {
  readonly kind: 'parse';
  readonly id: number;
  readonly ok: boolean;
  readonly treeJson?: string;
  readonly error?: string;
}

export interface SerializeResponse {
  readonly kind: 'serialize';
  readonly id: number;
  readonly ok: boolean;
  readonly svg?: string;
  readonly error?: string;
}

export interface PingResponse {
  readonly kind: 'pong';
  readonly id: number;
  readonly engine: 'usvg-wasm' | 'fallback-dom';
  readonly usvgVersion?: string;
}

export type WorkerResponse = ParseResponse | SerializeResponse | PingResponse;

// ============================================================================
// 2. WASM 懒加载（仅在首次 parse/scale 请求时触发）
// ============================================================================

type UsvgWasmModule = typeof import('../../../../public/usvg-wasm/usvg_wasm.js');

let wasmModule: UsvgWasmModule | null = null;
let wasmInitPromise: Promise<void> | null = null;
let wasmInitFailed = false;

/**
 * 尝试加载 usvg-wasm 产物。若产物缺失或加载失败，置 `wasmInitFailed = true`
 * 并永久回退到 fallback DOM 模式（见 ADR-0001 §10.3）。
 */
async function tryLoadUsvgWasm(): Promise<boolean> {
  if (wasmModule) return true;
  if (wasmInitFailed) return false;

  try {
    // dynamic import：产物不存在时浏览器抛 SyntaxError / 404，捕获后走 fallback
    const mod = await import(/* @vite-ignore */ '../../../../public/usvg-wasm/usvg_wasm.js');
    const init = (mod as unknown as { default?: (input?: unknown) => Promise<void> }).default;
    if (typeof init !== 'function') {
      wasmInitFailed = true;
      return false;
    }
    await init();
    wasmModule = mod as UsvgWasmModule;
    return true;
  } catch {
    wasmInitFailed = true;
    return false;
  }
}

// ============================================================================
// 3. 主消息循环
// ============================================================================

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;

  if (req.kind === 'ping') {
    const wasmOk = await tryLoadUsvgWasm();
    const resp: PingResponse = {
      kind: 'pong',
      id: req.id,
      engine: wasmOk ? 'usvg-wasm' : 'fallback-dom',
    };
    self.postMessage(resp);
    return;
  }

  if (req.kind === 'parse') {
    const wasmOk = await tryLoadUsvgWasm();
    if (!wasmOk || !wasmModule) {
      // M1 fallback：直接返回占位 tree；调用方 SvgWasmBridge 应当走 fallbackDomParse
      const resp: ParseResponse = {
        kind: 'parse',
        id: req.id,
        ok: false,
        error: 'usvg-wasm not available; caller should use fallbackDomParse()',
      };
      self.postMessage(resp);
      return;
    }

    try {
      const treeJson = wasmModule.parse_svg(req.svg);
      const resp: ParseResponse = { kind: 'parse', id: req.id, ok: true, treeJson };
      self.postMessage(resp);
    } catch (e) {
      const resp: ParseResponse = {
        kind: 'parse',
        id: req.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
      self.postMessage(resp);
    }
    return;
  }

  if (req.kind === 'serialize') {
    const wasmOk = await tryLoadUsvgWasm();
    if (!wasmOk || !wasmModule) {
      const resp: SerializeResponse = {
        kind: 'serialize',
        id: req.id,
        ok: false,
        error: 'usvg-wasm not available; caller should use fallbackDomSerialize()',
      };
      self.postMessage(resp);
      return;
    }

    try {
      const svg = wasmModule.serialize_tree(req.treeJson);
      const resp: SerializeResponse = { kind: 'serialize', id: req.id, ok: true, svg };
      self.postMessage(resp);
    } catch (e) {
      const resp: SerializeResponse = {
        kind: 'serialize',
        id: req.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
      self.postMessage(resp);
    }
    return;
  }
});

export {}; // 强制模块模式