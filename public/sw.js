const VERSION = 'v2'
const STATIC_CACHE = `shipiq-static-${VERSION}`
const RUNTIME_CACHE = `shipiq-runtime-${VERSION}`
const OFFLINE_URL = '/offline'

// Pages and assets to pre-cache for offline access
const PRECACHE = [
  '/',
  '/offline',
  '/calculator',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// Origins whose images (store logos, product photos) we cache with SWR.
const LOGO_HOSTS = [
  'pzlckjasayitxcblvkjg.supabase.co',
  'logo.clearbit.com',
  't2.gstatic.com',
  'icon.horse',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  const keep = [STATIC_CACHE, RUNTIME_CACHE]
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Stale-while-revalidate: serve cache instantly, refresh in the background.
function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) cache.put(request, response.clone())
          return response
        })
        .catch(() => cached)
      return cached || network
    })
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Network-first for navigations, falling back to cache then the offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    )
    return
  }

  // Store logos / product photos — stale-while-revalidate from the runtime cache
  if (LOGO_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE))
    return
  }

  // API responses (e.g. exchange rate) — stale-while-revalidate so the UI
  // shows the last known value instantly and updates in the background.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE))
    return
  }

  // Static assets (JS, CSS, fonts) — cache-first, refreshing in the background
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
            const copy = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
    })
  )
})
