/* PromptoBox service worker
   Cache-first for the app shell, network-first fallback for everything else.
   The OpenRouter API is never cached — generation always needs a live connection. */

const CACHE_VERSION = "promptobox-v1.0.1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./assets/logo.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/favicon.png",
  "./assets/favicon.ico",
  "./assets/apple-touch-icon.png",
];

// Best-effort precache of CDN assets (fonts, icon font). Failures here
// must never block installation, since they're cross-origin and optional.
const CDN_SHELL = [
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(async (cache) => {
        await cache.addAll(APP_SHELL).catch(() => {});
        await Promise.all(
          CDN_SHELL.map((url) =>
            fetch(url, { mode: "cors" })
              .then((res) => (res && res.ok ? cache.put(url, res) : null))
              .catch(() => {})
          )
        );
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  // Never intercept the OpenRouter API — always go live.
  if (url.hostname.includes("openrouter.ai")) return;

  // App shell / same-origin: cache-first, fall back to network, then update cache.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
            }
            return res;
          })
          .catch(() => cached || caches.match("./index.html"));
        return cached || networkFetch;
      })
    );
    return;
  }

  // Cross-origin (fonts, icons CDN): network-first, cache fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
