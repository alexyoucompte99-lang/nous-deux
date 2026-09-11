/* Nous · service worker : réseau d'abord, cache en secours + notifications push. */
const CACHE = "nous-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});

// Notif reçue : on l'affiche (obligatoire sur iPhone) et on prévient l'appli ouverte pour qu'elle se mette à jour tout de suite.
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || "Nous", { body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", data: { kind: d.kind || "" } }),
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => cs.forEach(c => c.postMessage({ type: "nous-push", d }))),
  ]));
});
// Toucher la notif ouvre Nous sur le bon écran.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const kind = (e.notification.data && e.notification.data.kind) || "";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => "focus" in x);
    if (c) { c.postMessage({ type: "nous-open", kind }); return c.focus(); }
    return self.clients.openWindow("./" + (kind ? "?k=" + encodeURIComponent(kind) : ""));
  }));
});
