// BiGee — service worker v3 (mise à jour immédiate + hors-ligne + notifications)
const CACHE = 'bigee-v3';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Données Supabase : toujours le réseau, jamais le cache
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;

  // Ouverture de l'app : RESEAU d'abord (on voit tout de suite les mises à jour),
  // et repli sur le cache seulement si hors-ligne.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const r = await fetch(req);
        cache.put('./index.html', r.clone());
        return r;
      } catch (_) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Autres ressources : cache d'abord, sinon réseau (et on met en cache)
  e.respondWith(
    caches.match(req).then((c) => c || fetch(req).then((r) => {
      const cp = r.clone();
      caches.open(CACHE).then((x) => x.put(req, cp)).catch(() => {});
      return r;
    }).catch(() => c))
  );
});

// Notifications poussées par le serveur (rappels)
self.addEventListener('push', (e) => {
  let data = { title: 'BiGee', body: 'Rappel' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title || 'BiGee', {
    body: data.body || '', icon: 'icon-192.png', badge: 'icon-192.png'
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cl) => cl.length ? cl[0].focus() : self.clients.openWindow('./')));
});
