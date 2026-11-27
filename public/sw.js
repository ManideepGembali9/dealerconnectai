const CACHE_NAME = 'dealerconnect-static-v3';
const PUBLIC_STATIC_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/manifest-dealer.json',
  '/manifest-admin.json',
  '/icon.svg',
  '/icon-192.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/dealer-192x192.png',
  '/icons/dealer-512x512.png',
  '/icons/admin-192x192.png',
  '/icons/admin-512x512.png',
];

const PRIVATE_PREFIXES = [
  '/api/',
  '/admin',
  '/dealer',
  '/profile',
  '/customer/',
  '/messages',
  '/notifications',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Security guard: NEVER cache API routes, auth cookies, or private portal/account pages
  const isPrivatePath = PRIVATE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
  if (isPrivatePath || request.headers.has('authorization')) {
    if (request.mode === 'navigate') {
      event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    }
    return;
  }

  // Navigations always fetch network directly (never persist HTML containing user/account state)
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  // Only cache immutable public static assets cleanly
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.json') ||
    request.destination === 'font' ||
    request.destination === 'style';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((res) => {
            const cc = res.headers.get('cache-control') || '';
            if (res.ok && !cc.includes('no-store') && !cc.includes('private')) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return res;
          })
          .catch(() => cached);
      })
    );
  }
});
