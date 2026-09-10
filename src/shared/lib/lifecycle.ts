/**
 * OmniView 资源与生命周期管理工具 (Lifecycle & Memory Management)
 * 提供 Blob URL 集中追踪与自动销毁、DisposableStore 及 React Hook
 */
import { useEffect, useRef } from 'react';

export interface IDisposable {
  dispose(): void;
}

/**
 * 集中管理和自动回收各种资源对象的容器
 */
export class DisposableStore implements IDisposable {
  private _toDispose = new Set<IDisposable>();
  private _isDisposed = false;

  public add<T extends IDisposable>(t: T): T {
    if (!t) return t;
    if (this._isDisposed) {
      t.dispose();
      return t;
    }
    this._toDispose.add(t);
    return t;
  }

  public trackBlob(url: string): string {
    if (!url || !url.startsWith('blob:')) return url;
    this.add({
      dispose: () => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      },
    });
    return url;
  }

  public dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    for (const item of this._toDispose) {
      try {
        item.dispose();
      } catch (err) {
        console.warn('[OmniView Lifecycle] Error during dispose:', err);
      }
    }
    this._toDispose.clear();
  }
}

/**
 * 全局活跃 Blob URL 注册表（提供安全垃圾回收保护）
 */
const activeBlobUrls = new Set<string>();

export function registerBlobUrl(url: string): string {
  if (url && url.startsWith('blob:')) {
    activeBlobUrls.add(url);
  }
  return url;
}

export function revokeBlobUrl(url?: string): void {
  if (!url || !url.startsWith('blob:')) return;
  activeBlobUrls.delete(url);
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}

export function revokeAllBlobUrls(): void {
  for (const url of activeBlobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
  activeBlobUrls.clear();
}

/**
 * React 组件生命周期 Hook，组件卸载时自动销毁所有注册的资源
 */
export function useLifecycle(): DisposableStore {
  const storeRef = useRef<DisposableStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new DisposableStore();
  }

  useEffect(() => {
    return () => {
      storeRef.current?.dispose();
    };
  }, []);

  return storeRef.current;
}
