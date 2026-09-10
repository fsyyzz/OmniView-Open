/**
 * Graphviz Web Worker - 负责在独立线程执行 WASM 布局计算
 */
import { Graphviz, Engine } from '@hpcc-js/wasm-graphviz';

let graphvizPromise: Promise<Graphviz> | null = null;

async function getGraphviz(): Promise<Graphviz> {
  if (!graphvizPromise) {
    graphvizPromise = Graphviz.load();
  }
  return graphvizPromise;
}

export interface WorkerRequest {
  id: string;
  source: string;
  engine?: Engine;
}

export interface WorkerResponse {
  id: string;
  success: boolean;
  svg?: string;
  error?: string;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, source, engine = 'dot' } = e.data;

  try {
    const graphviz = await getGraphviz();
    const svg = graphviz.layout(source, 'svg', engine);
    const response: WorkerResponse = {
      id,
      success: true,
      svg,
    };
    self.postMessage(response);
  } catch (err: any) {
    const errorMsg = err?.message || String(err) || 'Graphviz 编译失败';
    const response: WorkerResponse = {
      id,
      success: false,
      error: errorMsg,
    };
    self.postMessage(response);
  }
};
