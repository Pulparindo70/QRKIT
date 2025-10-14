const CACHE = "qrkit-v1";
const PRECACHE = ["/","/index.html","/manifest.json","/icons/icon-192.png","/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        e.waitUntil(fetch(req).then((res) => res && res.status === 200 && caches.open(CACHE).then((c) => c.put(req, res.clone()))).catch(()=>{}));
        return cached;
      }
      return fetch(req)
        .then((res) => {
          if (!res || res.status !== 200) return res;
          const dest = req.destination || "";
          if (["script","style","image","font","document"].includes(dest)) {
            caches.open(CACHE).then((c) => c.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => (req.mode === "navigate" ? caches.match("/index.html") : undefined));
    })
  );
});
