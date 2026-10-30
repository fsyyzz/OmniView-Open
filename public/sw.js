/* OmniView PWA Service Worker — 离线缓存与防陈旧模块污染策略 */
/* 仅对应用外壳静态资源启用 Network-First 离线兜底，绝不缓存 /src/* 与 /node_modules/.vite/* 动态模块 */
const CACHE_NAME = 'omniview-v2';
const SHELL_ASSETS = [
  '/manifest.json',
  '/icon.svg',
];

/**
 * 判断请求是否为 Vite 开发模块或源码/依赖预构建产物（此类请求严禁走 SW 缓存，防止 ?v= 哈希不一致引发双份 React 实例）
 */
function isViteDevOrModuleRequest(url) {
  const p = url.pathname;
  return (
    p === '/sw.js' ||
    p.startsWith('/src/') ||
    p.startsWith('/node_modules/') ||
    p.startsWith('/@') ||
    p.endsWith('.ts') ||
    p.endsWith('.tsx') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t')
  );
}

let purgedLegacyCacheDuringInstall = false;

/** 安装：立即接管等待态并第一时间清除旧版缓存 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        const staleKeys = keys.filter((k) => k !== CACHE_NAME);
        if (staleKeys.length > 0) {
          purgedLegacyCacheDuringInstall = true;
          await Promise.all(staleKeys.map((k) => caches.delete(k)));
        }
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(SHELL_ASSETS);
      } catch {
        // ignore cache errors
      }
    })()
  );
});

/** 激活：彻底清理 omniview-v1 等旧版本缓存，并在检测到旧缓存污染时通知/刷新受控客户端 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const staleKeys = keys.filter((k) => k !== CACHE_NAME);
      const hadLegacyCache = purgedLegacyCacheDuringInstall || staleKeys.length > 0;

      if (staleKeys.length > 0) {
        await Promise.all(staleKeys.map((k) => caches.delete(k)));
      }
      await self.clients.claim();

      if (hadLegacyCache) {
        const windowClients = await self.clients.matchAll({ type: 'window' });
        for (const client of windowClients) {
          try {
            client.postMessage({ type: 'OMNIVIEW_SW_PURGED' });
            if ('navigate' in client && client.url) {
              await client.navigate(client.url);
            }
          } catch {
            // 忽略跨域或导航受限异常
          }
        }
      }
    })()
  );
});

/** 拦截 fetch：Vite 模块直接放行；同域外壳资源采用 Network-First + 离线回退 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 严禁缓存 Vite 源码模块与 .vite/deps 预构建依赖
  if (isViteDevOrModuleRequest(url)) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return caches.match('/index.html');
      })
  );
});

