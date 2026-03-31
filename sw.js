const CACHE_NAME = "mobile-shell-v1";
const CORE_ASSETS = [
  "/mobile.html",
  "/styles.css",
  "/src/main-mobile.js",
  "/src/auth-client.js",
  "/src/leaderboard-client.js",
  "/src/leaderboard-utils.js",
  "/src/game-access.js",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!request || request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const requestUrl = new URL(request.url);
      const isSameOrigin = requestUrl.origin === self.location.origin;

      if (cached) {
        const updatePromise = isSameOrigin
          ? fetch(request)
              .then((response) => {
                if (response && response.ok) {
                  const cloned = response.clone();
                  caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
                }
              })
              .catch(() => {})
          : Promise.resolve();

        event.waitUntil(updatePromise);
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (!response || !response.ok) {
            return response;
          }

          if (isSameOrigin) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }

          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("/mobile.html");
          }
          return undefined;
        });
    })
  );
});
