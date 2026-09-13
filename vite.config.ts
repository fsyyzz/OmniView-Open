import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    build: {
      outDir: 'dist/webview',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/pdfjs-dist')) {
              return 'vendor-pdf';
            }
            if (id.includes('node_modules/mermaid') || id.includes('node_modules/cytoscape') || id.includes('node_modules/dagre')) {
              return 'vendor-mermaid';
            }
            if (id.includes('node_modules/katex')) {
              return 'vendor-katex';
            }
            if (id.includes('node_modules/@hpcc-js/wasm-graphviz')) {
              return 'vendor-graphviz';
            }
            if (id.includes('node_modules/markmap-view') || id.includes('node_modules/markmap-lib') || id.includes('node_modules/d3')) {
              return 'vendor-markmap';
            }
            if (id.includes('node_modules/prismjs')) {
              return 'vendor-prism';
            }
            if (id.includes('node_modules/js-yaml')) {
              return 'vendor-yaml';
            }
            if (id.includes('node_modules/@excalidraw')) {
              return 'vendor-excalidraw';
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
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
