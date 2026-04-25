/**
 * ============================================================================
 * SERVICE WORKER (sw.js) - GHOST VERSION CONTROL v2.0
 * ============================================================================
 */

// CHANGE THIS VERSION (v1, v2, v3) every time you upload a big update!
const CACHE_NAME = 'workshop-vault-v0.15'; 

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './logo.png',
  './manifest.json'
  // Note: core.data is NOT in this list anymore. 
  // index.html will fetch it freshly using the timestamp logic.
];

// Install: Clear memory and save shell
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the new service worker to take over immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Activate: Delete any old caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch logic
self.addEventListener('fetch', (event) => {
  // logic: For core.data, always go to the network (Internet)
  if (event.request.url.includes('core.data')) {
      return fetch(event.request);
  }
  
  // For other files, use cache but update in background
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});