import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/@excalidraw')) {
              return 'vendor-excalidraw';
            }
            if (id.includes('node_modules/pdfjs-dist')) {
              return 'vendor-pdf';
            }
            if (
              id.includes('node_modules/mermaid') ||
              id.includes('node_modules/cytoscape') ||
              id.includes('node_modules/dagre') ||
              id.includes('node_modules/markmap-view') ||
              id.includes('node_modules/markmap-lib') ||
              id.includes('node_modules/d3')
            ) {
              return 'vendor-diagram';
            }
            if (id.includes('node_modules/katex')) {
              return 'vendor-katex';
            }
            if (id.includes('node_modules/@hpcc-js/wasm-graphviz')) {
              return 'vendor-graphviz';
            }
            if (id.includes('node_modules/prismjs')) {
              return 'vendor-prism';
            }
            if (id.includes('node_modules/js-yaml')) {
              return 'vendor-yaml';
            }
          },
        },
      },
    },
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.IS_PREACT': JSON.stringify('false'),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
