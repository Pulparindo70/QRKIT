/* =========================================================
   QRKIT - Service Worker v2 (PWA offline + auto update)
   ========================================================= */
const CACHE_NAME = "qrkit-cache-v3";
const APP_SHELL = [
  "/",               // raíz
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  // Vite build assets (se cachean dinámicamente, pero aquí puedes poner los críticos si quieres)
];

// Instalar y cachear App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// Limpiar caches viejos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

// Estrategia offline: network-first para HTML, cache-first para assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo controlar requests del mismo origen
  if (url.origin !== location.origin) return;

  // Navegación (SPA)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Si la respuesta es válida, actualiza el cache
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", clone));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Assets estáticos (Vite, JS, CSS, imágenes)
  if (
    request.url.includes("/assets/") ||
    request.url.endsWith(".js") ||
    request.url.endsWith(".css") ||
    request.url.endsWith(".png") ||
    request.url.endsWith(".svg") ||
    request.url.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return res;
          })
          .catch(() => caches.match(request))
      )
    );
    return;
  }

  // Otros archivos (manifest, iconos, etc.)
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
