/* Photo booth service worker: works offline, picks up new versions when online.
   Bump CACHE on every release. */
const CACHE = 'booth-v1.1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') { e.respondWith(page(req)); return; }
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin === self.location.origin || fonts) e.respondWith(asset(req));
});

// The page: fresh from the network when it answers fast, otherwise the saved copy
async function page(req){
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req, {cache: 'no-store'}),
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 3500))
    ]);
    if (res && res.ok) cache.put('./index.html', res.clone());
    return res;
  } catch {
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
  }
}

// Everything else: saved copy first, refreshed in the background
async function asset(req){
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await net) || Response.error();
}
