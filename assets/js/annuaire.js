// ============================================================================
// Onglet Annuaire — liste, recherche, ajout et modification des fiches.
// ============================================================================

import { AnnuaireAPI, ThemesReseauAPI, PersonnesRessourcesAPI, VILLES_DISTRICT } from "./db.js";
import { escapeHtml, toast, openModal, closeModal, wireOverlayClose, toUpperFr, capitalizeWords } from "./utils.js";
import { openImportModal } from "./import.js";
import { isCurrentUserAdmin, isOwnAnnuaireEntry, getCurrentUser } from "./auth.js";

let allEntries = [];
let themes = [];
let personnesRessources = [];
let searchTerm = "";
let editingId = null;

const els = {};

export async function initAnnuaire() {
  els.tbody = document.getElementById("annuaire-tbody");
  els.empty = document.getElementById("annuaire-empty");
  els.search = document.getElementById("annuaire-search");
  els.addBtn = document.getElementById("btn-annuaire-add");
  els.importBtn = document.getElementById("btn-annuaire-import");
  els.exportBtn = document.getElementById("btn-annuaire-export");
  els.form = document.getElementById("form-annuaire");
  els.modalTitle = document.getElementById("modal-annuaire-title");
  els.deleteBtn = document.getElementById("btn-annuaire-delete");
  els.themesList = document.getElementById("f-themes-list");
  els.villeSelect = document.getElementById("f-ville");

  els.villeSelect.innerHTML =
    `<option value="">—</option>` + VILLES_DISTRICT.map((v) => `<option value="${v}">${v}</option>`).join("");

  wireOverlayClose("modal-annuaire-overlay");

  els.search.addEventListener("input", () => {
    searchTerm = els.search.value.trim().toLowerCase();
    render();
  });

  els.addBtn.addEventListener("click", () => openForm(null));
  els.importBtn.addEventListener("click", () => openImportModal("annuaire", loadAndRender));
  els.importBtn.classList.toggle("hidden", !isCurrentUserAdmin());
  els.exportBtn.addEventListener("click", exportToExcel);
  els.exportBtn.classList.toggle("hidden", !isCurrentUserAdmin());

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveForm();
  });

  document.getElementById("btn-annuaire-cancel").addEventListener("click", () => closeModal("modal-annuaire-overlay"));
  document.getElementById("modal-annuaire-close").addEventListener("click", () => closeModal("modal-annuaire-overlay"));

  els.deleteBtn.addEventListener("click", async () => {
    if (!editingId) return;
    if (!confirm("Supprimer définitivement cette fiche de l'annuaire ?")) return;
    try {
      await AnnuaireAPI.remove(editingId);
      toast("Fiche supprimée.", "success");
      closeModal("modal-annuaire-overlay");
      await loadAndRender();
    } catch (err) {
      toast("Erreur lors de la suppression : " + err.message, "error");
    }
  });

  await Promise.all([loadAndRender(), loadThemesAndLinks()]);
}

async function loadAndRender() {
  try {
    allEntries = await AnnuaireAPI.list();
  } catch (err) {
    toast("Impossible de charger l'annuaire : " + err.message, "error");
    allEntries = [];
  }
  render();
}

async function loadThemesAndLinks() {
  try {
    themes = isCurrentUserAdmin() ? await ThemesReseauAPI.ensureDefaults() : await ThemesReseauAPI.list();
  } catch (err) {
    themes = [];
  }
  try {
    personnesRessources = await PersonnesRessourcesAPI.list();
  } catch (err) {
    personnesRessources = [];
  }
}

function exportToExcel() {
  if (allEntries.length === 0) {
    toast("L'annuaire est vide, rien à exporter.", "error");
    return;
  }
  const rows = allEntries.map((e) => ({
    Nom: e.nom || "",
    Prénom: e.prenom || "",
    Fonction: e.fonction || "",
    Établissement: e.etablissement || "",
    Ville: e.ville || "",
    Portable: e.portable || "",
    Fixe: e.fixe || "",
    Mail: e.mail || "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Annuaire");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `annuaire-district6-${date}.xlsx`);
}

function matches(entry, term) {
  if (!term) return true;
  const haystack = [entry.nom, entry.prenom, entry.fonction, entry.etablissement, entry.ville, entry.mail]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function render() {
  const filtered = allEntries.filter((e) => matches(e, searchTerm));
  els.empty.classList.toggle("hidden", filtered.length > 0);
  const admin = isCurrentUserAdmin();

  els.tbody.innerHTML = filtered
    .map(
      (e) => `
      <tr data-id="${e.id}">
        <td>${escapeHtml(e.nom)}</td>
        <td>${escapeHtml(e.prenom)}</td>
        <td>${escapeHtml(e.fonction)}</td>
        <td>${escapeHtml(e.etablissement)}</td>
        <td>${escapeHtml(e.ville)}</td>
        <td>${escapeHtml(e.portable)}</td>
        <td>${escapeHtml(e.fixe)}</td>
        <td>${e.mail ? `<a href="mailto:${escapeHtml(e.mail)}">${escapeHtml(e.mail)}</a>` : ""}</td>
        <td class="cell-actions">
          ${
            admin || isOwnAnnuaireEntry(e)
              ? `<button class="btn btn-secondary btn-sm" data-action="edit" data-id="${e.id}">Modifier</button>`
              : ""
          }
          ${admin ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${e.id}">Supprimer</button>` : ""}
        </td>
      </tr>`
    )
    .join("");

  els.tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const entry = allEntries.find((e) => e.id === btn.dataset.id);
      openForm(entry);
    });
  });

  els.tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const entry = allEntries.find((e) => e.id === btn.dataset.id);
      if (!entry) return;
      if (!confirm(`Supprimer définitivement la fiche de ${entry.prenom} ${entry.nom} ?`)) return;
      try {
        await AnnuaireAPI.remove(entry.id);
        toast("Fiche supprimée.", "success");
        await loadAndRender();
      } catch (err) {
        toast("Erreur lors de la suppression : " + err.message, "error");
      }
    });
  });
}

function openForm(entry) {
  editingId = entry ? entry.id : null;
  const admin = isCurrentUserAdmin();
  els.modalTitle.textContent = entry ? "Modifier la fiche" : "Ajouter une fiche";
  els.deleteBtn.classList.toggle("hidden", !entry || !(admin || isOwnAnnuaireEntry(entry)));
  els.form.reset();
  if (entry) {
    for (const field of ["nom", "prenom", "fonction", "etablissement", "ville", "portable", "fixe", "mail"]) {
      const input = els.form.elements[field];
      if (input) input.value = entry[field] || "";
    }
  }

  const mailInput = els.form.elements["mail"];
  if (!admin) {
    const ownEmail = (getCurrentUser() && getCurrentUser().email) || "";
    mailInput.value = ownEmail;
    mailInput.readOnly = true;
  } else {
    mailInput.readOnly = false;
  }

  const linkedThemeIds = entry ? personnesRessources.filter((l) => l.annuaireId === entry.id).map((l) => l.themeId) : [];
  els.themesList.innerHTML = themes
    .map(
      (t) => `
      <label style="font-weight:400;display:flex;gap:.4rem;align-items:center;">
        <input type="checkbox" value="${t.id}" ${linkedThemeIds.includes(t.id) ? "checked" : ""} />
        ${escapeHtml(t.nom)}
      </label>`
    )
    .join("");
  if (themes.length === 0) {
    els.themesList.innerHTML = `<p class="field-hint" style="margin:0;">Aucun thème disponible pour le moment.</p>`;
  }

  openModal("modal-annuaire-overlay");
}

async function syncPersonnesRessources(annuaireId) {
  const checkedThemeIds = Array.from(els.themesList.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => cb.value);
  const existingLinks = personnesRessources.filter((l) => l.annuaireId === annuaireId);
  const existingThemeIds = existingLinks.map((l) => l.themeId);

  const toAdd = checkedThemeIds.filter((id) => !existingThemeIds.includes(id));
  const toRemove = existingLinks.filter((l) => !checkedThemeIds.includes(l.themeId));

  for (const themeId of toAdd) {
    await PersonnesRessourcesAPI.add({ themeId, annuaireId, note: "" });
  }
  for (const link of toRemove) {
    await PersonnesRessourcesAPI.remove(link.id);
  }
}

async function saveForm() {
  const data = {};
  for (const field of ["nom", "prenom", "fonction", "etablissement", "ville", "portable", "fixe", "mail"]) {
    data[field] = els.form.elements[field].value.trim();
  }
  data.nom = toUpperFr(data.nom);
  data.prenom = capitalizeWords(data.prenom);
  data.etablissement = toUpperFr(data.etablissement);
  if (!data.nom || !data.prenom) {
    toast("Le nom et le prénom sont obligatoires.", "error");
    return;
  }
  try {
    let annuaireId = editingId;
    if (editingId) {
      await AnnuaireAPI.update(editingId, data);
    } else {
      const ref = await AnnuaireAPI.add(data);
      annuaireId = ref.id;
    }
    try {
      await syncPersonnesRessources(annuaireId);
    } catch (err) {
      toast("Fiche enregistrée, mais erreur sur les thèmes personne ressource : " + err.message, "error");
    }
    toast(editingId ? "Fiche mise à jour." : "Fiche ajoutée.", "success");
    closeModal("modal-annuaire-overlay");
    await Promise.all([loadAndRender(), loadThemesAndLinks()]);
  } catch (err) {
    toast("Erreur lors de l'enregistrement : " + err.message, "error");
  }
}

export function getAnnuaireEntries() {
  return allEntries;
}

export function refreshAnnuaire() {
  return loadAndRender();
}
