const CACHE_NAME = 'vitae-forge-v1';
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/static/css/studio.css',
  '/static/img/icon-192x192.png',
  '/static/img/icon-512x512.png',
  // Include JS modules if needed, but dynamically fetching them is better
];

// Install event - cache core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Stale-while-revalidate for static, Network-first for dynamic/HTML
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude API calls and specific routes from aggressive caching
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/health') || event.request.method !== 'GET') {
    return;
  }

  // Static assets (CSS, JS, Images) -> Stale-while-revalidate
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // HTML Pages (e.g. /, /login) -> Network First, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
