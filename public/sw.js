// Le Carnet — service worker : réception des notifications push web.
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { /* payload vide */ }
  e.waitUntil(self.registration.showNotification(d.title || "Le Carnet", {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: d.tag || "le-carnet",
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of cs) {
      c.navigate(e.notification.data && e.notification.data.url || "/");
      return c.focus();
    }
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || "/");
  })());
});
