/* ═══ ALN — Service Worker nhận push khi trình duyệt đóng/nền ═══ */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCPv-KbyK8ajRba1b2wy5qSwc--m_vbRUc",
  authDomain: "aln-platform.firebaseapp.com",
  projectId: "aln-platform",
  storageBucket: "aln-platform.firebasestorage.app",
  messagingSenderId: "1073827504988",
  appId: "1:1073827504988:web:8895fd6b68dff00a67d799"
});

const messaging = firebase.messaging();

/* Tin data-only từ Cloud Function -> tự dựng thông báo */
messaging.onBackgroundMessage(function(payload) {
  const d = (payload && payload.data) || {};
  return self.registration.showNotification(d.title || 'ALN — Tin nhắn mới', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'aln-push',
    data: d
  });
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return clients.openWindow('./login.html');
    })
  );
});
