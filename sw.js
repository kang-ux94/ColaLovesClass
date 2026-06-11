// Service Worker - 可乐爱上课
// 版本号：每次发布代码时手动更新，强制刷新缓存
const CACHE_VERSION = 'v6-20260611';
const CACHE_NAME = 'cola-class-' + CACHE_VERSION;
const ASSETS_TO_CACHE = [
  './css/style.css',
  './js/app.js',
  './manifest.json',
];

// 安装：预缓存静态资源（不包括 HTML，HTML 必须网络优先）
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 预缓存 ' + CACHE_VERSION);
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] 部分缓存失败:', err);
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧版本缓存，通知客户端刷新
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] 清理旧缓存:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      // 通知所有打开的页面：有新版本可用
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'NEW_VERSION', version: CACHE_VERSION });
        });
      });
    })
  );
  self.clients.claim();
});

// 请求拦截：HTML 网络优先，静态资源缓存优先，其他网络优先
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  const isHTML = event.request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');
  
  if (isHTML) {
    // HTML: 网络优先，获取失败才用缓存
    event.respondWith(
      fetch(event.request).then((response) => {
        // 同时更新缓存
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        return caches.match(event.request).then(cached => cached || caches.match('./index.html'));
      })
    );
    return;
  }
  
  // 其他资源：缓存优先，后台更新
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => null);
      
      // 有缓存立即返回，同时后台更新
      if (cached) {
        fetchPromise; // 后台静默更新（fire and forget）
        return cached;
      }
      
      return fetchPromise.then(r => r || new Response('', { status: 408 }));
    })
  );
});
