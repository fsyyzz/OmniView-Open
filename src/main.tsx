import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import { RenderErrorBoundary } from './features/viewers/components/common/RenderErrorBoundary.tsx';
import './index.css';
import 'prismjs/themes/prism-tomorrow.css';
import 'katex/dist/katex.min.css';

// PWA 与开发环境缓存自愈：在开发模式下挂载 React Root 前优先清理遗留 CacheStorage 与旧版 Service Worker，防止缓存旧版 ?v= 预构建哈希导致双 React 实例
async function bootstrapOmniView(): Promise<void> {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !window.location.protocol.startsWith('vscode')) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'OMNIVIEW_SW_PURGED') {
        window.location.reload();
      }
    });

    if (import.meta.env.DEV) {
      try {
        if ('caches' in window) {
          const keys = await window.caches.keys();
          if (keys.length > 0) {
            await Promise.all(keys.map((k) => window.caches.delete(k)));
          }
        }
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length > 0) {
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch {
        // ignore cleanup errors in restricted contexts
      }
    } else {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('[PWA] Service Worker 注册失败:', err);
        });
      });
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RenderErrorBoundary blockName="OmniView Application Root">
        <App />
      </RenderErrorBoundary>
    </StrictMode>,
  );
}

void bootstrapOmniView();

