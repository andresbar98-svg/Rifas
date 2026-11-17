// Service worker de la Rifa: deja usar la app sin señal.
const CACHE = 'rifa-cache-v1';
const PRE = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Luckiest+Guy&family=Pacifico&family=Montserrat:wght@400;600;700;900&display=swap',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js'
];
const HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com', 'images.unsplash.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(PRE.map((u) => fetch(u, { cache: 'reload' }).then((r) => (r.ok ? c.put(u, r) : null)).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

async function guardar(req, res) {
  try { const c = await caches.open(CACHE); await c.put(req, res); } catch (e) {}
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && !HOSTS.includes(url.hostname)) return; // Firestore va directo

  // Página: primero internet (siempre la última versión); si no hay señal o tarda, la copia guardada
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const red = fetch(req).then((r) => { if (r && r.ok) guardar(req, r.clone()); return r; });
      const copia = (await caches.match(req, { ignoreSearch: true })) || (await caches.match('./index.html')) || (await caches.match('./'));
      if (!copia) return red;
      return Promise.race([red.catch(() => copia), new Promise((res) => setTimeout(() => res(copia), 4000))]);
    })());
    return;
  }

  // Librerías, fuentes e imágenes: copia guardada al instante y se actualiza en segundo plano
  e.respondWith((async () => {
    const hit = await caches.match(req);
    const red = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) guardar(req, r.clone()); return r; }).catch(() => hit);
    return hit || red;
  })());
});
