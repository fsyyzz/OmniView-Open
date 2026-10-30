import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const twPlugins = tailwindcss();
  const twPluginList = Array.isArray(twPlugins) ? twPlugins : [twPlugins];
  const serveTwPlugin =
    twPluginList.find((p: any) => p && p.apply === 'serve') || twPluginList[0];
  if (serveTwPlugin && typeof serveTwPlugin === 'object') {
    const origConfigureServer = serveTwPlugin.configureServer;
    serveTwPlugin.configureServer = function (server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const reqUrl = req.url || '';
        // 1. 防止浏览器或旧版 Service Worker 针对 /src/*、/sw.js、/index.html 命中 304 旧缓存
        if (
          reqUrl === '/' ||
          reqUrl.startsWith('/index.html') ||
          reqUrl.startsWith('/sw.js') ||
          reqUrl.startsWith('/src/')
        ) {
          delete req.headers['if-none-match'];
          delete req.headers['if-modified-since'];
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }

        // 2. 若旧页面请求带旧 ?v= 哈希的 .vite/deps 模块，自动对齐当前 browserHash，杜绝 504 Outdated Optimize Dep
        if (reqUrl.startsWith('/node_modules/.vite/deps/') && reqUrl.includes('?v=')) {
          const currentBrowserHash =
            server.environments?.client?.depsOptimizer?.metadata?.browserHash;
          if (currentBrowserHash) {
            req.url = reqUrl.replace(/\?v=[a-f0-9]+/, `?v=${currentBrowserHash}`);
          }
        }

        // 3. 在 /src/* 模块响应中注入跨 ?v= 哈希 React 单例桥接与 omniview-v1 缓存自愈逻辑
        if (reqUrl.startsWith('/src/')) {
          const origEnd = res.end;
          res.end = function (chunk: any, encoding?: any, cb?: any) {
            try {
              const contentType = String(res.getHeader('Content-Type') || '');
              if (chunk && contentType.includes('javascript')) {
                const rawCode =
                  typeof chunk === 'string'
                    ? chunk
                    : Buffer.isBuffer(chunk)
                      ? chunk.toString('utf-8')
                      : null;
                if (rawCode && rawCode.includes('/node_modules/.vite/deps/react')) {
                  const bridgedCode = rawCode.replace(
                    /import\s+(__vite__cjsImport\d+_[A-Za-z0-9_]+)\s+from\s+"(\/node_modules\/\.vite\/deps\/(?:react|react-dom|react_jsx-dev-runtime|react_jsx-runtime)\.js)\?v=([a-f0-9]+)";/g,
                    (_match, varName, depPath, depHash) =>
                      `import ${varName}_raw from "${depPath}?v=${depHash}"; const ${varName} = await (async () => { try { if (typeof window !== "undefined") { if ("caches" in window && !window.__OV_SW_CLEANED__) { window.__OV_SW_CLEANED__ = true; window.caches.keys().then((ks) => Promise.all(ks.map((k) => window.caches.delete(k)))).catch(() => {}); if (navigator.serviceWorker) { navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))).catch(() => {}); } } if (typeof performance !== "undefined" && performance.getEntriesByType) { const entries = performance.getEntriesByType("resource") || []; for (let i = 0; i < entries.length; i++) { const m = entries[i].name && entries[i].name.match(/\\/\\.vite\\/deps\\/react-dom_client\\.js\\?v=([a-f0-9]+)/); if (m && m[1] && m[1] !== "${depHash}") { const mod = await import("${depPath}?v=" + m[1]); return mod.default || mod; } } } } } catch {} return ${varName}_raw; })();`,
                  );
                  res.removeHeader('Content-Length');
                  res.removeHeader('Etag');
                  return origEnd.call(this, bridgedCode, encoding, cb);
                }
              }
            } catch {
              // ignore bridge errors
            }
            return origEnd.call(this, chunk, encoding, cb);
          };
        }

        next();
      });

      if (typeof origConfigureServer === 'function') {
        return origConfigureServer.call(this, server);
      }
      if (origConfigureServer && typeof origConfigureServer.handler === 'function') {
        return origConfigureServer.handler.call(this, server);
      }
    };
  }

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
    plugins: [react(), ...twPluginList],
    optimizeDeps: {
      entries: ['index.html', 'src/**/*.{ts,tsx}'],
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
        'prismjs/components/prism-bash',
        'prismjs/components/prism-c',
        'prismjs/components/prism-cpp',
        'prismjs/components/prism-csharp',
        'prismjs/components/prism-diff',
        'prismjs/components/prism-go',
        'prismjs/components/prism-java',
        'prismjs/components/prism-json',
        'prismjs/components/prism-jsx',
        'prismjs/components/prism-markdown',
        'prismjs/components/prism-python',
        'prismjs/components/prism-rust',
        'prismjs/components/prism-sql',
        'prismjs/components/prism-tsx',
        'prismjs/components/prism-typescript',
        'prismjs/components/prism-yaml',
        '@hpcc-js/wasm-graphviz',
        '@myriaddreamin/typst.ts',
      ],
    },
    define: {
      'process.env.IS_PREACT': JSON.stringify('false'),
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    },
    resolve: {
      dedupe: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
      alias: {
        '@': path.resolve(__dirname, '.'),
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
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
