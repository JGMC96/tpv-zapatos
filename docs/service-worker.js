const CACHE_NAME = "tpv-cache-v1";
const urlsToCache = [
  "./",
  "./index.html",
  "./menu.html",
  "./productos.html",
  "./historial.html",
  "./configuracion.html",
  "./style.css",
  "./js/menu.js",
  "./js/tpv-handler.js",
  "./js/productos-handler.js",
  "./js/configuracion-handler.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
