// service-worker.js

// 1) Recebe o evento de PUSH enviado pelo seu backend (via web-push)
self.addEventListener('push', event => {
  // Se não houver dados, encerramos
  if (!event.data) return;

  // Lê o payload JSON enviado pelo backend
  const data = event.data.json();
  const title   = data.title   || 'Nova notificação';
  const options = {
    body: data.body || '',
    icon: data.icon || '/assets/img/notification-icon.png',
    badge: data.badge || '/assets/img/notification-badge.png',
    data: data.data || {}  // ex: { url: '/pages/admin.html' }
  };

  // Mostra a notificação nativa
  event.waitUntil(self.registration.showNotification(title, options));
});

// 2) Captura o clique na notificação e abre/foca a URL desejada
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/pages/admin.html';

  // Abre (ou foca) a aba correta
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Se já houver uma aba com aquela URL, foca ela
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Caso contrário, abre uma nova aba
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
