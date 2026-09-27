// ============================================================================
// Onglet Annuaire — liste, recherche, ajout et modification des fiches.
// ============================================================================

import { AnnuaireAPI } from "./db.js";
import { escapeHtml, toast, openModal, closeModal, wireOverlayClose } from "./utils.js";
import { openImportModal } from "./import.js";

let allEntries = [];
let searchTerm = "";
let editingId = null;

const els = {};

export async function initAnnuaire() {
  els.tbody = document.getElementById("annuaire-tbody");
  els.empty = document.getElementById("annuaire-empty");
  els.search = document.getElementById("annuaire-search");
  els.addBtn = document.getElementById("btn-annuaire-add");
  els.importBtn = document.getElementById("btn-annuaire-import");
  els.form = document.getElementById("form-annuaire");
  els.modalTitle = document.getElementById("modal-annuaire-title");
  els.deleteBtn = document.getElementById("btn-annuaire-delete");

  wireOverlayClose("modal-annuaire-overlay");

  els.search.addEventListener("input", () => {
    searchTerm = els.search.value.trim().toLowerCase();
    render();
  });

  els.addBtn.addEventListener("click", () => openForm(null));
  els.importBtn.addEventListener("click", () => openImportModal("annuaire", loadAndRender));

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

  await loadAndRender();
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

function matches(entry, term) {
  if (!term) return true;
  const haystack = [entry.nom, entry.prenom, entry.fonction, entry.etablissement, entry.mail]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function render() {
  const filtered = allEntries.filter((e) => matches(e, searchTerm));
  els.empty.classList.toggle("hidden", filtered.length > 0);

  els.tbody.innerHTML = filtered
    .map(
      (e) => `
      <tr data-id="${e.id}">
        <td>${escapeHtml(e.nom)}</td>
        <td>${escapeHtml(e.prenom)}</td>
        <td>${escapeHtml(e.fonction)}</td>
        <td>${escapeHtml(e.etablissement)}</td>
        <td>${escapeHtml(e.portable)}</td>
        <td>${escapeHtml(e.fixe)}</td>
        <td>${e.mail ? `<a href="mailto:${escapeHtml(e.mail)}">${escapeHtml(e.mail)}</a>` : ""}</td>
        <td class="cell-actions">
          <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${e.id}">Modifier</button>
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
}

function openForm(entry) {
  editingId = entry ? entry.id : null;
  els.modalTitle.textContent = entry ? "Modifier la fiche" : "Ajouter une fiche";
  els.deleteBtn.classList.toggle("hidden", !entry);
  els.form.reset();
  if (entry) {
    for (const field of ["nom", "prenom", "fonction", "etablissement", "portable", "fixe", "mail"]) {
      const input = els.form.elements[field];
      if (input) input.value = entry[field] || "";
    }
  }
  openModal("modal-annuaire-overlay");
}

async function saveForm() {
  const data = {};
  for (const field of ["nom", "prenom", "fonction", "etablissement", "portable", "fixe", "mail"]) {
    data[field] = els.form.elements[field].value.trim();
  }
  if (!data.nom || !data.prenom) {
    toast("Le nom et le prénom sont obligatoires.", "error");
    return;
  }
  try {
    if (editingId) {
      await AnnuaireAPI.update(editingId, data);
      toast("Fiche mise à jour.", "success");
    } else {
      await AnnuaireAPI.add(data);
      toast("Fiche ajoutée.", "success");
    }
    closeModal("modal-annuaire-overlay");
    await loadAndRender();
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
