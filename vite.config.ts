import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  return {
    base: isProd ? './' : '/',
    assetsInclude: [
      '**/*.docx',
      '**/*.pptx',
      '**/*.xlsx',
      '**/*.pdf',
      '**/*.webm',
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 4000,
      target: 'esnext',
      minify: 'esbuild',
      sourcemap: false,
    },
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'lucide-react',
        'jszip',
        'docx-preview',
        'dompurify',
        'echarts',
        'js-yaml',
        'katex',
        'marked',
        'markmap-lib',
        'markmap-view',
        'mermaid',
        'pdfjs-dist',
        'plantuml-encoder',
        'prismjs',
      ],
    },
    define: {
      'process.env.IS_PREACT': JSON.stringify('false'),
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
