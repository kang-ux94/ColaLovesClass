// Service Worker - 可乐爱上课
const CACHE_NAME = 'cola-class-v2';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
];

// 安装：预缓存核心文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 缓存核心文件');
      return cache.addAll(FILES_TO_CACHE).catch((err) => {
        console.warn('[SW] 部分文件缓存失败（可能离线）:', err);
      });
    })
  );
  // 立即激活，不等待旧SW
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：缓存优先策略
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 有缓存直接用
      if (cached) return cached;

      // 没缓存就请求网络，同时缓存结果
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(() => {
        // 离线且没缓存，返回首页
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 408 });
      });
    })
  );
});
