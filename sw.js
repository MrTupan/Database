/**
 * ============================================================================
 * SERVICE WORKER (sw.js) - LEMAR WORKSHOP DATABASE v1.0
 * ============================================================================
 * This script runs in the background and enables:
 * 1. Offline Support: Saves project files to the phone's cache.
 * 2. Standalone Mode: Tells iOS this is a real PWA to hide Safari UI.
 * 3. Performance: Loads the app shell instantly.
 * ============================================================================
 */

const CACHE_NAME = 'lemar-workshop-cache-v1';

// List of all files the Service Worker should "steal" and save to memory
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './utils.js',
  './contexts.js',
  './login.js',
  './sidebar.js',
  './dashboard.js',
  './transactions.js',
  './expenses.js',
  './loans.js',
  './workers.js',
  './reports.js',
  './partner-mechanic.js',
  './partner-painter.js',
  './partner-electrician.js',
  './partner-tire-shop.js',
  './partner-spare-parts.js',
  './partner-oil-sales.js',
  './partner-dent-repairer.js',
  './main-app.js',
  './translations.js',
  './firebase-config.js',
  './logo.png',
  './manifest.json'
];

// 1. INSTALL EVENT: Download all files into the phone's browser cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE EVENT: Clean up old versions of the app if you update files
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 3. FETCH EVENT: When user opens the app, try network first, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});