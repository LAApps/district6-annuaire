// ============================================================================
// Service worker minimal — nécessaire pour que les navigateurs (Chrome,
// Edge...) proposent l'installation de l'application sur le bureau/l'écran
// d'accueil. Ne met rien en cache : l'application nécessite de toute façon
// une connexion (Firebase) pour fonctionner, inutile de faire semblant de
// marcher hors-ligne.
// ============================================================================

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Un gestionnaire "fetch" vide est requis par certains navigateurs pour
// considérer le site comme installable.
self.addEventListener("fetch", () => {});
