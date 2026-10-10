// ============================================================================
// Onglet Calendrier — événements du district. Consultation pour tous,
// ajout/modification/suppression réservés exclusivement à
// CALENDRIER_EDITOR_EMAIL (volontairement indépendant du rôle administrateur
// général — voir firebase-config.js). Chacun peut ajouter un événement à
// son propre agenda : le bouton "Ajouter à mon agenda" télécharge un
// fichier .ics (format standard), que les applications Calendrier/Agenda
// d'iPhone, Android, Outlook ou Google Agenda savent ouvrir directement
// pour créer l'événement.
// ============================================================================

import { EvenementsAPI } from "./db.js";
import { isCalendrierEditor } from "./auth.js";
import { escapeHtml, toast, openModal, closeModal, wireOverlayClose, capitalizeFirst } from "./utils.js";

let allEvents = [];
let editingId = null;

const els = {};

export async function initCalendrier() {
  els.groups = document.getElementById("calendrier-groups");
  els.empty = document.getElementById("calendrier-empty");
  els.addBtn = document.getElementById("btn-evenement-add");
  els.form = document.getElementById("form-evenement");
  els.modalTitle = document.getElementById("modal-evenement-title");
  els.deleteBtn = document.getElementById("btn-evenement-delete");

  wireOverlayClose("modal-evenement-overlay");

  const admin = isCalendrierEditor();
  els.addBtn.classList.toggle("hidden", !admin);
  els.addBtn.addEventListener("click", () => openForm(null));

  document.getElementById("btn-evenement-cancel").addEventListener("click", () => closeModal("modal-evenement-overlay"));
  document.getElementById("modal-evenement-close").addEventListener("click", () => closeModal("modal-evenement-overlay"));

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveForm();
  });

  els.deleteBtn.addEventListener("click", async () => {
    if (!editingId) return;
    if (!confirm("Supprimer définitivement cet événement ?")) return;
    try {
      await EvenementsAPI.remove(editingId);
      toast("Événement supprimé.", "success");
      closeModal("modal-evenement-overlay");
      await loadAndRender();
    } catch (err) {
      toast("Erreur lors de la suppression : " + err.message, "error");
    }
  });

  await loadAndRender();
}

async function loadAndRender() {
  try {
    allEvents = await EvenementsAPI.list();
  } catch (err) {
    toast("Impossible de charger le calendrier : " + err.message, "error");
    allEvents = [];
  }
  render();
}

function toDate(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}

function formatRange(ev) {
  const start = toDate(ev.dateDebut);
  if (!start) return "";
  const dateOpts = { weekday: "long", day: "2-digit", month: "long", year: "numeric" };
  const timeOpts = { hour: "2-digit", minute: "2-digit" };
  let str = capitalizeFirst(start.toLocaleDateString("fr-FR", dateOpts)) + " à " + start.toLocaleTimeString("fr-FR", timeOpts);
  const end = toDate(ev.dateFin);
  if (end) {
    const sameDay = start.toDateString() === end.toDateString();
    str += sameDay
      ? " – " + end.toLocaleTimeString("fr-FR", timeOpts)
      : " → " + capitalizeFirst(end.toLocaleDateString("fr-FR", dateOpts)) + " à " + end.toLocaleTimeString("fr-FR", timeOpts);
  }
  return str;
}

function render() {
  els.empty.classList.toggle("hidden", allEvents.length > 0);
  const admin = isCalendrierEditor();
  const now = new Date();

  const upcoming = allEvents.filter((e) => {
    const d = toDate(e.dateFin) || toDate(e.dateDebut);
    return d && d >= now;
  });
  const past = allEvents
    .filter((e) => {
      const d = toDate(e.dateFin) || toDate(e.dateDebut);
      return d && d < now;
    })
    .slice()
    .reverse();

  const groups = [
    { label: "À venir", items: upcoming },
    { label: "Passés", items: past },
  ].filter((g) => g.items.length > 0);

  els.groups.innerHTML = groups
    .map(
      (g) => `
      <div class="thematique-group">
        <h3 class="thematique-title">${g.label} <span class="thematique-count">${g.items.length}</span></h3>
        <div class="resource-grid">${g.items.map((e) => renderCard(e, admin)).join("")}</div>
      </div>`
    )
    .join("");

  els.groups.querySelectorAll('[data-action="ics"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const ev = allEvents.find((e) => e.id === btn.dataset.id);
      if (ev) downloadIcs(ev);
    });
  });
  els.groups.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const ev = allEvents.find((e) => e.id === btn.dataset.id);
      if (ev) openForm(ev);
    });
  });
  els.groups.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ev = allEvents.find((e) => e.id === btn.dataset.id);
      if (!ev) return;
      if (!confirm(`Supprimer définitivement l'événement « ${ev.titre} » ?`)) return;
      try {
        await EvenementsAPI.remove(ev.id);
        toast("Événement supprimé.", "success");
        await loadAndRender();
      } catch (err) {
        toast("Erreur : " + err.message, "error");
      }
    });
  });
}

function renderCard(e, admin) {
  return `
    <div class="resource-card">
      <div class="resource-card__top">
        <div class="resource-type-icon type-lien">📅</div>
        <div>
          <p class="resource-card__title">${escapeHtml(e.titre)}</p>
          <p class="resource-card__desc">${escapeHtml(formatRange(e))}${e.lieu ? " · " + escapeHtml(e.lieu) : ""}</p>
          ${e.description ? `<p class="resource-card__desc">${escapeHtml(e.description)}</p>` : ""}
        </div>
      </div>
      <div class="cell-actions">
        <button class="btn btn-primary btn-sm" data-action="ics" data-id="${e.id}">+ Ajouter à mon agenda</button>
        ${admin ? `<button class="btn btn-secondary btn-sm" data-action="edit" data-id="${e.id}">Modifier</button>` : ""}
        ${admin ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${e.id}">Supprimer</button>` : ""}
      </div>
    </div>`;
}

function toInputValue(date) {
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function openForm(ev) {
  editingId = ev ? ev.id : null;
  els.modalTitle.textContent = ev ? "Modifier l'événement" : "Ajouter un événement";
  els.deleteBtn.classList.toggle("hidden", !ev);
  els.form.reset();
  if (ev) {
    els.form.elements["titre"].value = ev.titre || "";
    els.form.elements["lieu"].value = ev.lieu || "";
    els.form.elements["description"].value = ev.description || "";
    els.form.elements["dateDebut"].value = toInputValue(toDate(ev.dateDebut));
    els.form.elements["dateFin"].value = toInputValue(toDate(ev.dateFin));
  }
  openModal("modal-evenement-overlay");
}

async function saveForm() {
  const titre = capitalizeFirst(els.form.elements["titre"].value.trim());
  const lieu = capitalizeFirst(els.form.elements["lieu"].value.trim());
  const description = capitalizeFirst(els.form.elements["description"].value.trim());
  const debutRaw = els.form.elements["dateDebut"].value;
  const finRaw = els.form.elements["dateFin"].value;

  if (!titre || !debutRaw) {
    toast("Le titre et la date de début sont obligatoires.", "error");
    return;
  }
  const dateDebut = new Date(debutRaw);
  const dateFin = finRaw ? new Date(finRaw) : null;
  if (dateFin && dateFin < dateDebut) {
    toast("La date de fin doit être après la date de début.", "error");
    return;
  }

  const data = { titre, lieu, description, dateDebut, dateFin: dateFin || null };

  try {
    if (editingId) {
      await EvenementsAPI.update(editingId, data);
      toast("Événement mis à jour.", "success");
    } else {
      await EvenementsAPI.add(data);
      toast("Événement ajouté.", "success");
    }
    closeModal("modal-evenement-overlay");
    await loadAndRender();
  } catch (err) {
    toast("Erreur lors de l'enregistrement : " + err.message, "error");
  }
}

// ----- Export .ics (ajout à l'agenda du téléphone/ordinateur) ----------------
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toIcsDate(date) {
  return (
    date.getUTCFullYear().toString() +
    pad2(date.getUTCMonth() + 1) +
    pad2(date.getUTCDate()) +
    "T" +
    pad2(date.getUTCHours()) +
    pad2(date.getUTCMinutes()) +
    pad2(date.getUTCSeconds()) +
    "Z"
  );
}
function escapeIcs(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
function downloadIcs(ev) {
  const start = toDate(ev.dateDebut);
  const end = toDate(ev.dateFin) || new Date(start.getTime() + 60 * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//District6//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.id}@district6-annuaire`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcs(ev.titre)}`,
    ev.lieu ? `LOCATION:${escapeIcs(ev.lieu)}` : "",
    ev.description ? `DESCRIPTION:${escapeIcs(ev.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(ev.titre || "evenement").replace(/[^\w\- ]/g, "").trim() || "evenement"}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
