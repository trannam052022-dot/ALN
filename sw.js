/* Service worker tối thiểu cho PWA "App Làm Nhà".
   Mục đích: đủ điều kiện cài app + mở nhanh/offline vỏ trang.
   AN TOÀN: chỉ xử lý GET cùng origin. Mọi request cross-origin
   (Firebase Auth/Firestore, App Check, Google APIs, Jitsi, Pixel...)
   được bỏ qua hoàn toàn để không phá đăng nhập/ghi dữ liệu. */
var CACHE = 'aln-shell-v1';
var SHELL = ['./home.html', './aln-tokens.css', './icon-192.png', './icon-512.png', './manifest.json'];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(SHELL).catch(function(){}); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch(err){ return; }
  if(url.origin !== self.location.origin) return; // KHÔNG động cross-origin
  // Network-first: luôn ưu tiên bản mới, offline mới lấy cache
  e.respondWith(
    fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
      return res;
    }).catch(function(){ return caches.match(req); })
  );
});
