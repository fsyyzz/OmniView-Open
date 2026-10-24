import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import { RenderErrorBoundary } from './features/viewers/components/common/RenderErrorBoundary.tsx';
import './index.css';
import 'prismjs/themes/prism-tomorrow.css';
import 'katex/dist/katex.min.css';

// PWA: 注册 Service Worker（仅纯 Web 应用模式，VS Code Webview 中不注册）
if ('serviceWorker' in navigator && !window.location.protocol.startsWith('vscode')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] Service Worker 注册失败:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RenderErrorBoundary blockName="OmniView Application Root">
      <App />
    </RenderErrorBoundary>
  </StrictMode>,
);
