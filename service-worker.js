const CACHE_NAME = "comanda-facil-v21";
const FILES = [
  "./",
  "./index.html",
  "./admin.html",
  "./styles.css?v=2",
  "./site.css",
  "./site.js",
  "./supabase-config.js",
  "./supabase-client.js",
  "./qr.html",
  "./qr.css",
  "./painel.html",
  "./painel.css",
  "./painel.js",
  "./assets/sabor-de-mae-hero.png",
  "./assets/marmitex-menu.png",
  "./assets/prato-feito-menu.png",
  "./assets/refrigerante-menu.png",
  "./assets/qr-sabor-de-mae.png",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
