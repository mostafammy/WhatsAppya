const SHELL_CACHE = "whatsappya-shell-v2";
const SHARE_CACHE = "whatsappya-share-v1";
const SHARED_EXPORT_KEY = "/shared-export";
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Intercept Android Web Share Target POST /share-target
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const file = formData.get("export");
        if (file && typeof file !== "string") {
          const cache = await caches.open(SHARE_CACHE);
          const headers = new Headers({
            "Content-Type": file.type || "application/zip",
            "X-Filename": encodeURIComponent(file.name || "export.zip"),
          });
          await cache.put(SHARED_EXPORT_KEY, new Response(file, { headers }));
        }
        return Response.redirect("/?shared=1", 303);
      })(),
    );
    return;
  }

  // Only handle same-origin GET requests (strict zero-egress privacy)
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Network-first for HTML navigations so fresh deploys replace stale app shells automatically
  const isNavigation =
    event.request.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html";
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            const rootCopy = url.pathname === "/" && url.search ? response.clone() : null;
            void caches.open(SHELL_CACHE).then(async (cache) => {
              await cache.put(event.request, copy);
              if (rootCopy) await cache.put("/", rootCopy);
            });
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(event.request)) || (await caches.match("/")) || Response.error()
          );
        }),
    );
    return;
  }

  // Cache-first for hashed static assets and icons
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            void caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }),
    ),
  );
});
