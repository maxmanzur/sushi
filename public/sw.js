const CACHE = "gotoku-shell-v7";
const SHELL = [
  "/",
  "/css/app.css",
  "/js/app.js",
  "/js/api.js",
  "/js/cart.js",
  "/manifest.webmanifest",
  "/img/icon-192.png",
  "/img/icon-512.png"
];
const SHELL_PATHS = new Set(SHELL);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("gotoku-shell-") && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirstShell(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || new Response("No hay conexión. Volvé a intentarlo.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function networkFirstMenu(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put("/api/menu", response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match("/api/menu");
    return cached || new Response(JSON.stringify({ error: "Menú no disponible sin conexión." }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // La API, salvo el menú público, siempre trabaja directamente contra la red.
  if (path === "/api/menu") {
    event.respondWith(networkFirstMenu(request));
    return;
  }
  if (path.startsWith("/api/")) return;

  // Seguimiento y administración nunca se interceptan ni se guardan en caché.
  if (
    path === "/seguimiento.html" ||
    path === "/js/track.js" ||
    path === "/admin" ||
    path.startsWith("/admin/")
  ) return;

  // Solo los recursos del shell público usan network-first con fallback.
  if (!SHELL_PATHS.has(path)) return;
  event.respondWith(networkFirstShell(request));
});
