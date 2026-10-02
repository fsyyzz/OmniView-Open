import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  return {
    base: './',
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
      include: ['mermaid'],
    },
    define: {
      'process.env.IS_PREACT': JSON.stringify('false'),
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
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
