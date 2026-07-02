const CACHE_NAME = "comanda-facil-v30";
const FILES = [
  "./",
  "./index.html",
  "./index.html",
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
  "./assets/no-image.png",
  "./assets/products/marmitex.jpg",
  "./assets/products/espetinhos.jpg",
  "./assets/products/bebidas.jpg",
  "./assets/products/sobremesas.jpg",
  "./assets/qr-sabor-de-mae.png",
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
  const url = new URL(event.request.url);
  if (url.pathname.endsWith(".js")) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
