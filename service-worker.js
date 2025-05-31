// frontend/service-worker.js

self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const title = data.title || 'Notificação';
    const options = {
      body: data.body || '',
      icon: '/assets/img/notification-icon.png',
      badge: '/assets/img/notification-badge.png',
      data: data.data || {}
    };
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
