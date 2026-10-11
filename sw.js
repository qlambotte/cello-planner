/* Cache hors ligne. À chaque mise en ligne d'une nouvelle version, incrémenter V. */
const V = 'cello-v11';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'css/app.css', 'js/util.js', 'js/store.js', 'js/plan.js', 'js/audio.js', 'js/chrono.js', 'js/tools.js', 'js/micro.js',
  'js/glyphs.js', 'js/engrave.js', 'js/chant-data.js', 'js/chant.js', 'js/import.js', 'js/app.js', 'js/today.js', 'js/week.js', 'js/stats.js', 'js/prog.js', 'js/wizard.js', 'js/main.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Réseau d'abord quand il est disponible (une mise à jour est visible tout de suite), cache sinon. */
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true })));
});
