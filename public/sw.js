// v2 — stratégie réseau-d'abord pour les pages HTML afin d'éviter de servir
// une version périmée après chaque redéploiement (bug corrigé : le v1
// utilisait "cache d'abord" pour tout, y compris les pages HTML, ce qui
// gelait l'app sur la première version installée par l'utilisateur).
const CACHE_NAME = "peche-connect-v2";
const URLS_A_METTRE_EN_CACHE = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_A_METTRE_EN_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Jamais de cache pour l'API (données dynamiques / IA)
  if (request.url.includes("/api/")) return;

  // Pages HTML (navigation) : réseau d'abord, pour toujours servir le
  // dernier déploiement. Cache utilisé uniquement en secours hors-ligne.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((reseauReponse) => {
          const clone = reseauReponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return reseauReponse;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Assets statiques (JS/CSS/icônes) : cache d'abord, réseau en secours
  event.respondWith(
    caches.match(request).then((reponse) => {
      return (
        reponse ||
        fetch(request).then((reseauReponse) => {
          const clone = reseauReponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return reseauReponse;
        })
      );
    })
  );
});
