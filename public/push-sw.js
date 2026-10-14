// Notifications (étape 12) : ajouté au service worker de l'appli (vite.config.ts, workbox.importScripts).
// Le serveur envoie { title, body, url, tag } (api/_push.ts). Toucher la notif ouvre l'écran prévu dans l'appli.
self.addEventListener("push", function (event) {
  var d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(d.title || "Frigia", {
    body: d.body || "",
    icon: "/icon-192.png",
    tag: d.tag || undefined,
    data: { url: d.url || "/notifications" },
  }));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (new URL(c.url).origin === self.location.origin && "focus" in c) {
        // L'appli est ouverte : elle change d'écran sans se recharger
        c.postMessage({ type: "frigia-notif", url: url });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
