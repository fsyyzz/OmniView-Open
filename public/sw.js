/* OmniView PWA Service Worker — 离线缓存策略 */
/* 缓存应用外壳（HTML/JS/CSS）+ 静态资源，API 请求走网络 */
const CACHE_NAME = 'omniview-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

/** 安装：预缓存应用外壳 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

/** 激活：清理旧版本缓存 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/** 拦截 fetch：静态资源 cache-first，API 请求 network-first */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // 仅拦截 GET 请求
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 同域静态资源 → cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            // 缓存成功的 GET 响应
            const clone = response.clone();
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => {
            // 网络失败 → 回退到缓存的 index.html（SPA 兜底）
            return caches.match('/index.html');
          });
      })
    );
    return;
  }

  // 跨域资源（WASM 等）→ 直接走网络
});
