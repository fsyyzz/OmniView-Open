/**
 * OmniView 弹性异步加载器 (Resilient Dynamic Import)
 * 具备网络波动与构建热更自动重试、缓存穿透与组件重置自愈能力
 */

export interface ResilientImportOptions {
  /** 最大重试次数 (默认 3 次) */
  retries?: number;
  /** 初始重试延迟 (毫秒，默认 400ms) */
  initialDelayMs?: number;
  /** 失败回退日志标签 */
  tag?: string;
}

/**
 * 带有指数退避与自动重试的 dynamic import 包装器
 */
export async function resilientImport<T>(
  importer: () => Promise<T>,
  options: ResilientImportOptions = {}
): Promise<T> {
  const { retries = 3, initialDelayMs = 400, tag = 'ResilientImport' } = options;

  let lastError: any = null;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await importer();
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        console.warn(
          `[${tag}] 模块动态加载失败 (第 ${attempt}/${retries} 次尝试)，将在 ${delay}ms 后重试:`,
          err?.message || err
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.round(delay * 1.5);
      } else {
        console.error(
          `[${tag}] 模块动态加载已达到最大重试次数 (${retries})，最终抛出错误:`,
          err
        );
      }
    }
  }

  throw lastError;
}

/** 全局驱动组件缓存清理回调注册表 */
const cacheClearHandlers = new Set<() => void>();

/** 注册组件缓存清理器 */
export function registerDriverCacheClearer(handler: () => void): () => void {
  cacheClearHandlers.add(handler);
  return () => {
    cacheClearHandlers.delete(handler);
  };
}

/** 触发全量驱动缓存清理（用于错误边界自愈重置） */
export function clearAllDriverCaches(): void {
  cacheClearHandlers.forEach((handler) => {
    try {
      handler();
    } catch {
      // 容错降级
    }
  });
}
