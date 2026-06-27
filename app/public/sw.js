// Service Worker for Spouse Interview PWA
const CACHE_NAME = 'spouse-interview-free-v4';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/manifest.json',
  '/couple-hero.jpg',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

const NETWORK_ONLY_PATH_PREFIXES = [
  '/api/',
  '/account',
  '/dashboard',
  '/messages',
  '/robin',
  '/reset-password',
  '/admin',
  '/superadmin',
  '/billing-',
  '/pricing',
];

function isHttpRequest(requestUrl) {
  return requestUrl.startsWith('http://') || requestUrl.startsWith('https://');
}

function shouldUseNetworkOnly(url) {
  if (url.origin !== self.location.origin) {
    return true;
  }

  return NETWORK_ONLY_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
        }
      })
      .catch(() => undefined);
    return cachedResponse;
  }

  const response = await fetch(request);
  if (response && response.status === 200 && response.type === 'basic') {
    const responseToCache = response.clone();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, responseToCache);
  }
  return response;
}

async function appShellOrOffline(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    return (await caches.match('/index.html')) || caches.match(OFFLINE_URL);
  }
}

async function networkOnlyNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    return caches.match(OFFLINE_URL);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch((err) => {
        console.log('Cache install failed:', err);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    ))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !isHttpRequest(event.request.url)) return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('.pdf')) return;

  const networkOnly = shouldUseNetworkOnly(url);

  if (event.request.mode === 'navigate') {
    event.respondWith(networkOnly ? networkOnlyNavigation(event.request) : appShellOrOffline(event.request));
    return;
  }

  if (networkOnly) return;

  event.respondWith(
    cacheFirst(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});
