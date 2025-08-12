const CACHE = 'cashivo-cache-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/add-transaction.html',
  '/payment.html',
  '/admin.html',
  '/profile.html',
  '/css/styles.css',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/transactions.js',
  '/js/storage.js',
  '/js/payment.js',
  '/js/admin.js',
  '/js/offline.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((resp) => {
            const copy = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
            return resp;
          }).catch(() => cached)
        );
      })
    );
  }
});