// ALN service worker — tối giản, ưu tiên mạng (network-first)
// Mục tiêu: đủ điều kiện để cài PWA (có icon trên màn hình),
// KHÔNG cache HTML để app luôn hiện bản mới nhất từ Firebase Hosting.

const CACHE = 'aln-shell-v1';
const SHELL = ['./icons/icon-192.png', './icons/icon-512.png', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Network-first cho mọi thứ; rơi về cache nếu offline (chủ yếu là icon).
  e.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
