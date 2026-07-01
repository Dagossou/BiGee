// BiGee — service worker (installation + démarrage hors-ligne)
const CACHE = 'bigee-v1';
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
  // Toujours réseau d'abord pour Supabase (données à jour) ; cache pour le reste.
  if (url.hostname.endsWith('supabase.co')) return;
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});

// Rappels : affiche la notification poussée par le serveur (Supabase/cron)
self.addEventListener('push', (e) => {
  let data = { title: 'BiGee', body: 'Rappel : une action arrive bientôt.' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title || 'BiGee', {
    body: data.body || '', icon: 'icon-192.png', badge: 'icon-192.png'
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cl) => cl.length ? cl[0].focus() : self.clients.openWindow('./')));
});
