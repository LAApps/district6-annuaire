// Petits utilitaires partagés par les modules de vue.

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type === "info" ? "" : type}`.trim();
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function openModal(id) {
  document.getElementById(id).classList.add("open");
}
export function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

// Ferme une modale au clic sur l'overlay (en dehors de la boîte .modal)
export function wireOverlayClose(overlayId) {
  const overlay = document.getElementById(overlayId);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal(overlayId);
  });
}

export function formatDate(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Hash SHA-256 (hexadécimal) côté navigateur, via l'API Web Crypto native.
// Utilisé pour ne jamais stocker ni transmettre la réponse secrète en clair.
export async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Nom / établissement : toujours en majuscules.
export function toUpperFr(str) {
  return String(str || "").toUpperCase();
}

// Prénom : première lettre de chaque mot en majuscule, le reste en
// minuscules ("jean-pierre" -> "Jean-Pierre", "marie claire" -> "Marie Claire").
export function capitalizeWords(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/(^|[^\p{L}])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());
}

// Première lettre en majuscule, le reste inchangé (fonction, titre,
// description, service…) — règle générale appliquée à toutes les colonnes
// texte de l'application.
export function capitalizeFirst(str) {
  const s = String(str || "").trim();
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Construit un lien "tel:" utilisable sur mobile (et sur ordinateur avec un
// logiciel de téléphonie) à partir d'un numéro saisi avec espaces/points/tirets.
export function telHref(str) {
  const digits = String(str || "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

export function humanFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["o", "Ko", "Mo", "Go"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
