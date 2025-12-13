const CACHE_NAME = 'winscan-v4';
const STATIC_CACHE = 'winscan-static-v4';
const DYNAMIC_CACHE = 'winscan-dynamic-v4';

const urlsToCache = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Cache duration - lebih lama untuk mengurangi agresivitas
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for dynamic content
const API_CACHE_DURATION = 10 * 1000; // 10 seconds for API calls (real-time data)

// Install service worker - tidak paksa skipWaiting
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => console.log('[SW] Static assets cached'))
  );
});

// Check if cached response is still fresh
function isCacheFresh(response, isApiCall = false) {
  if (!response) return false;
  
  const cachedTime = response.headers.get('sw-cache-time');
  if (!cachedTime) return false;
  
  const age = Date.now() - parseInt(cachedTime);
  const maxAge = isApiCall ? API_CACHE_DURATION : CACHE_DURATION;
  
  return age < maxAge;
}

// Add timestamp to response
function addCacheTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cache-time', Date.now().toString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

// Fetch resources
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip caching for external domains
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }
  
  // Network First for API calls - cache hanya sebagai fallback offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Simpan ke cache untuk offline fallback
          const responseToCache = addCacheTimestamp(networkResponse.clone());
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Fallback ke cache hanya jika offline
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] Serving cached API response (offline)');
              return cachedResponse;
            }
            return new Response(JSON.stringify({ error: 'Offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }
  
  // Stale-While-Revalidate untuk dynamic pages - tidak agresif
  if (url.pathname.match(/^\/[a-z]+-(?:mainnet|test)(?:\/|$)/) ||
      url.pathname.includes('/validators/') ||
      url.pathname.includes('/transactions/') ||
      url.pathname.includes('/blocks/')) {
    
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            // Update cache in background
            const responseToCache = addCacheTimestamp(networkResponse.clone());
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => cachedResponse);
        
        // Return cache immediately if available, update in background
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise wait for network
        return fetchPromise;
      })
    );
    return;
  }
  
  // Cache First for static assets (JS, CSS, images)
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(STATIC_CACHE)
            .then((cache) => {
              cache.put(request, responseToCache);
            });
          return response;
        });
      })
  );
});

// Activate and clean old caches - tidak agresif claim
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      // Tidak langsung claim - biarkan user refresh manual
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  // Only skip waiting if explicitly requested
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
  
  // Clear cache on demand
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Clearing cache...');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('[SW] Clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
});
