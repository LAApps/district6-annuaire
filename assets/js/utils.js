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
