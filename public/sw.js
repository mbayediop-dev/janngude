/* Janngude — service worker : page hors ligne et médias téléchargés.
 * Les fichiers JavaScript/CSS de l’application ne sont volontairement PAS mis en cache ici : en développement,
 * leurs URL ne changent pas entre deux modifications et un cache « cache d’abord » servait d’anciens bundles
 * (erreurs d’hydratation, fonctionnalités invisibles). En production, Next.js les sert déjà avec un cache HTTP immuable. */
const MEDIA_CACHE = "janngude-media-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(MEDIA_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/khadija/headphones.png", "/khadija/offline.png"]))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // Supprime les anciens caches (dont « janngude-static-v1 », qui conservait des bundles périmés).
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== MEDIA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navigation : réseau d’abord ; sans réseau, la page hors ligne.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const media = await caches.open(MEDIA_CACHE);
        return (await media.match(OFFLINE_URL)) || Response.error();
      }),
    );
    return;
  }

  // Médias téléchargés (MP3, transcriptions, page hors ligne) : cache d’abord ; tout le reste : réseau.
  event.respondWith(
    caches.open(MEDIA_CACHE).then(async (media) => {
      const cached = await media.match(request, { ignoreVary: true });
      return cached || fetch(request);
    }),
  );
});
