/**
 * Norte — Service Worker
 * Estrategia: Cache-first para el app shell, network-first para Firebase/APIs.
 */

const CACHE_NAME = 'norte-v1';
const BASE = '/norte-finanzas';

// Recursos del app shell que se cachean en la instalación
const APP_SHELL = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
];

// ── INSTALL: cachear el app shell ─────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches viejos ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia según el tipo de recurso ────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Siempre ir a la red para Firebase, MercadoPago, Cloud Functions y APIs externas
  const networkOnly = [
    'firebaseio.com',
    'cloudfunctions.net',
    'mercadopago.com',
    'mercadolibre.com',
    'resend.com',
    'googleapis.com',
    'gstatic.com',
  ];
  if (networkOnly.some(domain => url.hostname.includes(domain))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Para todo lo demás: cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Solo cachear respuestas exitosas y estáticas
        if (
          response.ok &&
          event.request.method === 'GET' &&
          url.origin === self.location.origin
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Sin red y sin cache: para navegación, servir index.html offline
        if (event.request.mode === 'navigate') {
          return caches.match(BASE + '/index.html');
        }
      });
    })
  );
});
