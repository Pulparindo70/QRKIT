/* =========================================================
   QRKIT - Service Worker v2 (PWA offline + auto update)
   ========================================================= */
const CACHE_NAME = "qrkit-cache-v2";
const APP_SHELL = [
  "/",               // raíz
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/favicon.ico",
  "/assets/",        // carpeta de build de vite
];

// ✅ Instalar y cachear todo lo esencial
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ✅ Activar y limpiar versiones viejas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

// ✅ Estrategia de fetch: network-first para HTML, cache-first para assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo controlar requests del mismo origen
  if (url.origin !== location.origin) return;

  // --- HTML (React router) ---
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // --- Assets estáticos ---
  if (request.url.includes("/assets/") || request.url.endsWith(".js") || request.url.endsWith(".css")) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return res;
          })
          .catch(() => caches.match("/index.html"))
      )
    );
    return;
  }

  // --- Otros archivos (iconos, manifest, etc.) ---
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

// ✅ Actualización automática del SW
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
