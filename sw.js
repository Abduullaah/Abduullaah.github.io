/* sw.js — offline shell.
   App files: always fetched fresh from the network, bypassing the browser's HTTP cache
   (GitHub Pages sets max-age=600, which would otherwise serve a stale app for 10 minutes).
   The cache is only a fallback for when you are offline. */
const CACHE = "backstage-v9";
const CORE = ["./", "./index.html", "./css/app.css", "./config.js", "./manifest.webmanifest",
  "./js/app.js", "./js/ui.js", "./js/dates.js", "./js/store.js", "./js/auth.js", "./js/migrate.js",
  "./js/pages/home.js", "./js/pages/tasks.js", "./js/pages/commission.js", "./js/pages/settings.js",
  "./icons/favicon.svg", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" })))).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  if (url.origin === location.origin) {
    e.respondWith(
      fetch(new Request(e.request, { cache: "reload" }))          // ignore the HTTP cache: always the newest deploy
        .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
        .catch(() => caches.match(e.request).then(r => r || (e.request.mode === "navigate" ? caches.match("./index.html") : undefined)))
    );
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com|gstatic\.com\/firebasejs/.test(url.host + url.pathname)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })));
  }
});
