/* ==========================================================================
   PromptoBox — sw.js
   Static-asset caching only. Never caches OpenRouter API responses.
   ========================================================================== */
'use strict';

const CACHE_VERSION = 'promptobox-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => {
        // Precaching failure should not block installation.
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('promptobox-') && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (
      PRECACHE_URLS.some((p) => url.pathname.endsWith(p.replace('./', '/'))) ||
      /\.(css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
    )
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept/cache OpenRouter (or any cross-origin API) requests.
  if (url.origin !== self.location.origin) {
    return; // let the browser handle it normally (network only)
  }

  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('./index.html').then((cached) => cached || caches.match('./'))
      )
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Default: network, falling back to cache if available.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
