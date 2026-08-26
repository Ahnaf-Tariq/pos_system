/* eslint-disable no-restricted-globals */
const CACHE_VERSION = 'shell-v6'
const CACHE_NAME = `auric-pos-${CACHE_VERSION}`
const OFFLINE_ROUTES = ['/pos', '/tables', '/cash-drawer', '/kds']
const FALLBACK_URL = '/offline-fallback.html'

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin
  } catch {
    return false
  }
}

function isOfflineRoute(pathname) {
  return OFFLINE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

function isRscRequest(request, url) {
  return (
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1' ||
    url.searchParams.has('_rsc')
  )
}

function htmlKey(pathname) {
  return `html:${self.location.origin}${pathname}`
}

function rscKey(url) {
  return `rsc:${url.origin}${url.pathname}${url.search}`
}

function isHtmlResponse(response) {
  const type = response.headers.get('content-type') || ''
  return type.includes('text/html')
}

function isShellRequest(request, url) {
  if (request.method !== 'GET' || !isSameOrigin(request.url)) return false
  if (url.pathname.startsWith('/_next/static/')) return true
  if (url.pathname.startsWith('/_next/image')) return true
  if (url.pathname === FALLBACK_URL) return true
  if (request.mode === 'navigate') return true
  if (isRscRequest(request, url)) return true
  if (isOfflineRoute(url.pathname)) return true
  return false
}

async function putHtmlShell(cache, pathname, response) {
  if (!response.ok || !isHtmlResponse(response)) return
  await cache.put(htmlKey(pathname), response.clone())
}

async function putRsc(cache, url, response) {
  if (!response.ok) return
  await cache.put(rscKey(url), response.clone())
}

async function matchHtmlShell(cache, pathname) {
  const hit = await cache.match(htmlKey(pathname))
  if (!hit) return null
  if (!isHtmlResponse(hit)) {
    await cache.delete(htmlKey(pathname))
    return null
  }
  return hit
}

async function storeOnlineResponse(request, response, cache, url) {
  if (!isOfflineRoute(url.pathname)) return

  if (isRscRequest(request, url)) {
    await putRsc(cache, url, response)
    return
  }

  // Any HTML for an offline route — navigate, prefetch, or plain fetch.
  if (isHtmlResponse(response)) {
    await putHtmlShell(cache, url.pathname, response)
  }
}

async function precacheShellRoutes(routes) {
  const cache = await caches.open(CACHE_NAME)
  await Promise.all(
    routes.map(async (route) => {
      try {
        const url = new URL(route, self.location.origin)
        if (!isOfflineRoute(url.pathname)) return

        const response = await fetch(url.href, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'text/html' },
        })
        await putHtmlShell(cache, url.pathname, response)
      } catch {
        // Precache is best-effort while online.
      }
    })
  )
}

async function handleOffline(request, cache, url) {
  if (request.mode === 'navigate' || !isRscRequest(request, url)) {
    if (request.mode === 'navigate' || isOfflineRoute(url.pathname)) {
      const html = await matchHtmlShell(cache, url.pathname)
      if (html) return html

      if (isOfflineRoute(url.pathname) && request.mode === 'navigate') {
        const fallback = await cache.match(FALLBACK_URL)
        if (fallback) return fallback
      }
    }
  }

  if (isRscRequest(request, url)) {
    const rsc = await cache.match(rscKey(url))
    if (rsc) return rsc
    // Offline client transition without RSC cache: fall back to HTML shell
    // so a full document load can recover instead of dumping flight text.
    const html = await matchHtmlShell(cache, url.pathname)
    if (html) return html
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  if (request.mode === 'navigate') {
    return new Response('Offline — page not cached', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const cached = await cache.match(request)
  if (cached) return cached
  return new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

async function staleWhileRevalidate(request, cache) {
  const cached = await cache.match(request)
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone())
      return response
    })
    .catch(() => null)

  if (cached) {
    void networkPromise
    return cached
  }
  return (await networkPromise) || new Response('Offline', { status: 503 })
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.add(FALLBACK_URL)
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith('auric-pos-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'PRECACHE_SHELL') return
  const routes = Array.isArray(data.routes) ? data.routes : OFFLINE_ROUTES
  event.waitUntil(precacheShellRoutes(routes))
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (!isShellRequest(request, url)) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)

      if (url.pathname.startsWith('/_next/static/')) {
        return staleWhileRevalidate(request, cache)
      }

      // Online: network only. Cache HTML/RSC in the background for later offline use.
      if (self.navigator.onLine) {
        try {
          const response = await fetch(request)
          const copy = response.clone()
          event.waitUntil(storeOnlineResponse(request, copy, cache, url))
          return response
        } catch {
          // Brief network blip while browser still reports online — prefer shell, never invent RSC.
          const html = await matchHtmlShell(cache, url.pathname)
          if (html) return html
          throw new Error('Network failed')
        }
      }

      return handleOffline(request, cache, url)
    })()
  )
})
