import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import { RenderErrorBoundary } from './features/viewers/components/common/RenderErrorBoundary.tsx';
import './index.css';
import 'prismjs/themes/prism-tomorrow.css';
import 'katex/dist/katex.min.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RenderErrorBoundary blockName="OmniView Application Root">
      <App />
    </RenderErrorBoundary>
  </StrictMode>,
);
