// Minimal service worker used by PushService.initialize().
//
// The web build has no VAPID/FCM-web credentials, so there is no `push`
// handler here. This worker exists to keep notification clicks working if a
// future Web Push transport is added, and to satisfy the same registration
// call the Flutter app makes to its messaging plugin.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if (target) client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target || '/');
    }),
  );
});
