// ============================================================================
// Onglet Contacts DSDEN / Rectorat — annuaire institutionnel géré par
// les administrateurs (consultation ouverte à tous).
// ============================================================================

import { ContactsDsdenAPI } from "./db.js";
import { isCurrentUserAdmin } from "./auth.js";
import { escapeHtml, toast, openModal, closeModal, wireOverlayClose } from "./utils.js";
import { openImportModal } from "./import.js";

let allContacts = [];
let searchTerm = "";
let editingId = null;

const els = {};

export async function initContactsDsden() {
  els.tbody = document.getElementById("dsden-tbody");
  els.empty = document.getElementById("dsden-empty");
  els.search = document.getElementById("dsden-search");
  els.addBtn = document.getElementById("btn-dsden-add");
  els.importBtn = document.getElementById("btn-dsden-import");
  els.form = document.getElementById("form-dsden");
  els.modalTitle = document.getElementById("modal-dsden-title");
  els.deleteBtn = document.getElementById("btn-dsden-delete");

  wireOverlayClose("modal-dsden-overlay");

  const admin = isCurrentUserAdmin();
  els.addBtn.classList.toggle("hidden", !admin);
  els.importBtn.classList.toggle("hidden", !admin);

  els.search.addEventListener("input", () => {
    searchTerm = els.search.value.trim().toLowerCase();
    render();
  });

  els.addBtn.addEventListener("click", () => openForm(null));
  els.importBtn.addEventListener("click", () => openImportModal("contacts-dsden", loadAndRender));

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveForm();
  });

  document.getElementById("btn-dsden-cancel").addEventListener("click", () => closeModal("modal-dsden-overlay"));
  document.getElementById("modal-dsden-close").addEventListener("click", () => closeModal("modal-dsden-overlay"));

  els.deleteBtn.addEventListener("click", async () => {
    if (!editingId) return;
    if (!confirm("Supprimer définitivement ce contact ?")) return;
    try {
      await ContactsDsdenAPI.remove(editingId);
      toast("Contact supprimé.", "success");
      closeModal("modal-dsden-overlay");
      await loadAndRender();
    } catch (err) {
      toast("Erreur lors de la suppression : " + err.message, "error");
    }
  });

  await loadAndRender();
}

async function loadAndRender() {
  try {
    allContacts = await ContactsDsdenAPI.list();
  } catch (err) {
    toast("Impossible de charger les contacts : " + err.message, "error");
    allContacts = [];
  }
  render();
}

function matches(c, term) {
  if (!term) return true;
  const haystack = [c.service, c.nom, c.prenom, c.fonction, c.mail].join(" ").toLowerCase();
  return haystack.includes(term);
}

function render() {
  const filtered = allContacts.filter((c) => matches(c, searchTerm));
  els.empty.classList.toggle("hidden", filtered.length > 0);
  const admin = isCurrentUserAdmin();

  els.tbody.innerHTML = filtered
    .map(
      (c) => `
      <tr data-id="${c.id}">
        <td>${escapeHtml(c.service)}</td>
        <td>${escapeHtml(c.nom)}</td>
        <td>${escapeHtml(c.prenom)}</td>
        <td>${escapeHtml(c.fonction)}</td>
        <td>${escapeHtml(c.telephone)}</td>
        <td>${c.mail ? `<a href="mailto:${escapeHtml(c.mail)}">${escapeHtml(c.mail)}</a>` : ""}</td>
        <td class="cell-actions">
          ${admin ? `<button class="btn btn-secondary btn-sm" data-action="edit" data-id="${c.id}">Modifier</button>` : ""}
        </td>
      </tr>`
    )
    .join("");

  els.tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const contact = allContacts.find((c) => c.id === btn.dataset.id);
      openForm(contact);
    });
  });
}

function openForm(contact) {
  editingId = contact ? contact.id : null;
  els.modalTitle.textContent = contact ? "Modifier le contact" : "Ajouter un contact";
  els.deleteBtn.classList.toggle("hidden", !contact);
  els.form.reset();
  if (contact) {
    for (const field of ["service", "nom", "prenom", "fonction", "telephone", "mail"]) {
      const input = els.form.elements[field];
      if (input) input.value = contact[field] || "";
    }
  }
  openModal("modal-dsden-overlay");
}

async function saveForm() {
  const data = {};
  for (const field of ["service", "nom", "prenom", "fonction", "telephone", "mail"]) {
    data[field] = els.form.elements[field].value.trim();
  }
  if (!data.service && !data.nom) {
    toast("Merci de renseigner au moins le service ou le nom.", "error");
    return;
  }
  try {
    if (editingId) {
      await ContactsDsdenAPI.update(editingId, data);
      toast("Contact mis à jour.", "success");
    } else {
      await ContactsDsdenAPI.add(data);
      toast("Contact ajouté.", "success");
    }
    closeModal("modal-dsden-overlay");
    await loadAndRender();
  } catch (err) {
    toast("Erreur lors de l'enregistrement : " + err.message, "error");
  }
}
