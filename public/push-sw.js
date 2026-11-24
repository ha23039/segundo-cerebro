/* Recordatorios: el service worker generado importa este archivo para recibir los avisos push. */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = typeof data.title === 'string' && data.title ? data.title.slice(0, 80) : 'Segundo Cerebro'
  const body = typeof data.body === 'string' ? data.body.slice(0, 200) : ''
  // Solo rutas de la propia app: nunca una dirección externa
  const url = typeof data.url === 'string' && /^\/(?!\/)/.test(data.url) ? data.url : '/'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin) && 'focus' in w) {
          return w.focus().then((c) => ('navigate' in c ? c.navigate(target) : undefined))
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
