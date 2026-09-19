/* ═══════════════════════════════════════════════════════════════
   RICCHARY v2 · Service Worker

   Basado en la versión CORREGIDA (agosto 2026). Dos cosas que el
   service worker anterior hacía mal y aquí están resueltas:
   1. El index.html sí se guarda en caché, así que la app abre
      aunque no haya internet o el hosting falle.
   2. El respaldo actúa también cuando el servidor responde 404 o
      503, no solo cuando la red se cae. Un 404 es una respuesta
      válida para fetch(), y por eso antes se colaba la página de
      error en vez de la app.

   ⚠️ AL SUBIR CAMBIOS: sube el número de CACHE (v1 → v2 → ...).
   Es lo único que hay que tocar.
   ═══════════════════════════════════════════════════════════════ */
const CACHE = 'ricchary-v2-2';

// Rutas relativas: funcionan en cualquier repositorio sin editarlas.
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './fondo-app.jpg',
  './logo_animado.webm',
  './logo_animado_fallback.mp4'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Uno por uno: si falta un archivo se salta, en vez de tumbar
      // la instalación entera (addAll falla si UNO solo da error).
      Promise.all(ASSETS.map(u => c.add(u).catch(() => null)))
    )
  );
  /* SIN skipWaiting(): la versión nueva espera a que el usuario
     toque "Actualizar" en la barra de aviso. */
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* La app pide activar la versión nueva al tocar "Actualizar" */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // No tocar lo que va a Supabase, Apps Script, Datil o el SRI
  if (url.origin !== self.location.origin) return;

  const esHTML = e.request.mode === 'navigate' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');

  if (esHTML) {
    // RED PRIMERO, pero solo si la respuesta es BUENA
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (!r || !r.ok) throw new Error('respuesta ' + (r && r.status));
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copia));
          return r;
        })
        .catch(() =>
          caches.match('./index.html').then(c => c || caches.match('./'))
        )
    );
  } else {
    // CACHÉ PRIMERO para iconos, video y fondo
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(r => {
          if (r && r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, copia));
          }
          return r;
        })
      )
    );
  }
});
