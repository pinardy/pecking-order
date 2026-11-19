// Offline support: cache the app shell on install, serve from cache, refresh in the background.
// Bump when the shell changes in a way installed copies must pick up promptly.
const CACHE = "pecking-order-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

/** Tells every open page that a newer copy of the app has just been cached. */
function announceUpdate() {
  self.clients.matchAll().then((pages) => pages.forEach((p) => p.postMessage({ type: "po-update" })));
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // The whole app is one page, so a change to that page is a new version.
  const isApp = e.request.mode === "navigate" || url.pathname.endsWith("/index.html");
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const before = isApp && cached ? cached.clone() : null;
      // Give the page a moment to load before telling it, so the message is not sent into the void.
      let told = Promise.resolve();
      const fresh = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            if (before) {
              const now = res.clone();
              told = Promise.all([before.text(), now.text()]).then(([a, b]) => (a === b ? undefined : new Promise((r) => setTimeout(r, 2500)).then(announceUpdate)));
            }
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      e.waitUntil(fresh.then(() => told));
      return cached || fresh;
    }),
  );
});
