/**
 * OmniView 容器集成服务网关 (Node.js 原生零额外依赖)
 * 职责：
 * 1. 托管 OmniView Web 纯静态 SPA 工作台
 * 2. 智能反向代理 /plantuml/* 到内部 PlantUML 渲染服务
 * 3. 提供 /api/health 健康探针
 * 作者: 周赞
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8080', 10);
const PLANTUML_INTERNAL_PORT = parseInt(process.env.PLANTUML_INTERNAL_PORT || '8081', 10);
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(__dirname, '../dist'));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * 代理请求到内嵌 PlantUML 服务
 */
function proxyToPlantUml(req, res) {
  const targetUrl = new URL(req.url, `http://127.0.0.1:${PLANTUML_INTERNAL_PORT}`);

  const options = {
    hostname: '127.0.0.1',
    port: PLANTUML_INTERNAL_PORT,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${PLANTUML_INTERNAL_PORT}`,
      'x-forwarded-for': req.socket.remoteAddress || '',
      'x-forwarded-proto': 'http',
    },
  };

  const proxyReq = http.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', err => {
    console.error('[OmniView Gateway] PlantUML proxy error:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        error: 'Bad Gateway',
        message: 'Internal PlantUML service is starting or unreachable',
        detail: err.message,
      })
    );
  });

  req.pipe(proxyReq);
}

/**
 * 静态文件托管
 */
function serveStatic(req, res) {
  let reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(STATIC_DIR, reqPath);

  // 安全防护：防目录穿越
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const headers = { 'Content-Type': contentType };

      // 静态资源长期缓存，index.html 不缓存
      if (ext !== '.html') {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
      } else {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      }

      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    } else {
      // SPA Fallback: 非 API 请求降级为 index.html
      const indexPath = path.join(STATIC_DIR, 'index.html');
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (!indexErr && indexStats.isFile()) {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          });
          fs.createReadStream(indexPath).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found - OmniView Web assets not ready');
        }
      });
    }
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // 1. 健康探针
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(
      JSON.stringify({
        status: 'UP',
        service: 'OmniView Unified Rendering Hub',
        version: '0.11.8',
        author: '周赞',
        timestamp: new Date().toISOString(),
        features: {
          webWorkbench: true,
          plantumlEmbedded: true,
          offlineRendering: true,
        },
      })
    );
  }

  // 2. PlantUML 反代服务 (支持 /plantuml/*)
  if (pathname.startsWith('/plantuml')) {
    return proxyToPlantUml(req, res);
  }

  // 3. 静态 SPA 托管
  return serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 OmniView 集中渲染应用已就绪!`);
  console.log(`   - 作者: 周赞`);
  console.log(`   - 监听端口: http://0.0.0.0:${PORT}`);
  console.log(`   - Web 工作台: http://localhost:${PORT}/`);
  console.log(`   - PlantUML 离线渲染入口: http://localhost:${PORT}/plantuml/`);
  console.log(`   - 健康探针: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
});

// 优雅关机
const shutdown = () => {
  console.log('\n[OmniView Gateway] 收到终止信号，正在关闭服务...');
  server.close(() => {
    console.log('[OmniView Gateway] 服务已退出。');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
