// ============================================================================
// Onglet Contacts DSDEN / Rectorat — annuaire institutionnel géré par
// les administrateurs (consultation ouverte à tous).
// ============================================================================

import { ContactsDsdenAPI } from "./db.js";
import { isCurrentUserAdmin } from "./auth.js";
import { escapeHtml, toast, openModal, closeModal, wireOverlayClose, capitalizeFirst, telHref, formatPhoneFr } from "./utils.js";
import { openImportModal } from "./import.js";

let allContacts = [];
let searchTerm = "";
let filterFonction = "";
let filterService = "";
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
  els.filterFonction = document.getElementById("dsden-filter-fonction");
  els.filterService = document.getElementById("dsden-filter-service");
  els.detailTitle = document.getElementById("modal-dsden-detail-title");
  els.detailBody = document.getElementById("dsden-detail-body");
  els.detailEditBtn = document.getElementById("btn-dsden-detail-edit");

  wireOverlayClose("modal-dsden-overlay");
  wireOverlayClose("modal-dsden-detail-overlay");

  const admin = isCurrentUserAdmin();
  els.addBtn.classList.toggle("hidden", !admin);
  els.importBtn.classList.toggle("hidden", !admin);

  els.search.addEventListener("input", () => {
    searchTerm = els.search.value.trim().toLowerCase();
    render();
  });
  els.filterFonction.addEventListener("change", () => {
    filterFonction = els.filterFonction.value;
    render();
  });
  els.filterService.addEventListener("change", () => {
    filterService = els.filterService.value;
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
  document.getElementById("modal-dsden-detail-close").addEventListener("click", () => closeModal("modal-dsden-detail-overlay"));
  document.getElementById("btn-dsden-detail-fermer").addEventListener("click", () => closeModal("modal-dsden-detail-overlay"));

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
  populateFilters();
  render();
}

function normKey(str) {
  return String(str || "").trim().toLowerCase();
}

// Regroupe les variantes de casse ("Gestionnaire" / "gestionnaire") sous une
// seule option, en conservant la sélection en cours si elle existe toujours.
function populateFilters() {
  const buildOptions = (select, values, allLabel, current, formatLabel) => {
    const groups = new Map();
    values.filter(Boolean).forEach((v) => {
      const key = normKey(v);
      if (!groups.has(key)) groups.set(key, formatLabel(v));
    });
    const options = Array.from(groups.entries()).sort((a, b) => a[1].localeCompare(b[1], "fr"));
    const keep = options.some(([key]) => key === current) ? current : "";
    select.innerHTML =
      `<option value="">${allLabel}</option>` +
      options.map(([key, label]) => `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`).join("");
    select.value = keep;
    return keep;
  };

  filterFonction = buildOptions(
    els.filterFonction,
    allContacts.map((c) => c.fonction),
    "Toutes les fonctions",
    filterFonction,
    capitalizeFirst
  );
  filterService = buildOptions(
    els.filterService,
    allContacts.map((c) => c.service),
    "Tous les services",
    filterService,
    capitalizeFirst
  );
}

function matches(c, term) {
  if (filterFonction && normKey(c.fonction) !== filterFonction) return false;
  if (filterService && normKey(c.service) !== filterService) return false;
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
        <td data-label="Service">${escapeHtml(c.service)}</td>
        <td data-label="Nom">${escapeHtml(c.nom)}</td>
        <td data-label="Prénom">${escapeHtml(c.prenom)}</td>
        <td data-label="Fonction">${escapeHtml(c.fonction)}</td>
        <td data-label="Téléphone">${c.telephone ? `<a href="${telHref(c.telephone)}">${escapeHtml(c.telephone)}</a>` : ""}</td>
        <td data-label="Mail">${c.mail ? `<a href="mailto:${escapeHtml(c.mail)}">${escapeHtml(c.mail)}</a>` : ""}</td>
        <td data-label="Actions" class="cell-actions">
          ${admin ? `<button class="btn btn-secondary btn-sm" data-action="edit" data-id="${c.id}">Modifier</button>` : ""}
        </td>
      </tr>`
    )
    .join("");

  els.tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const contact = allContacts.find((c) => c.id === btn.dataset.id);
      openForm(contact);
    });
  });

  // Clic sur la ligne (hors liens/boutons) : ouvre la fiche détaillée —
  // utile surtout sur mobile, où seuls Service/Nom/Prénom/Fonction sont
  // visibles par défaut.
  els.tbody.querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", (e) => {
      if (e.target.closest("a, button")) return;
      const contact = allContacts.find((c) => c.id === tr.dataset.id);
      if (contact) openDetail(contact);
    });
  });
}

function openDetail(contact) {
  const admin = isCurrentUserAdmin();
  els.detailTitle.textContent = `${contact.prenom || ""} ${contact.nom || ""}`.trim() || contact.service || "Contact";

  const rows = [
    ["Service", contact.service ? escapeHtml(contact.service) : ""],
    ["Fonction", contact.fonction ? escapeHtml(contact.fonction) : ""],
    ["Téléphone", contact.telephone ? `<a href="${telHref(contact.telephone)}">${escapeHtml(contact.telephone)}</a>` : ""],
    ["Mail", contact.mail ? `<a href="mailto:${escapeHtml(contact.mail)}">${escapeHtml(contact.mail)}</a>` : ""],
  ].filter(([, value]) => value);

  els.detailBody.innerHTML = rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("");
  if (rows.length === 0) {
    els.detailBody.innerHTML = `<p class="field-hint" style="margin:0;">Aucune information complémentaire.</p>`;
  }

  els.detailEditBtn.classList.toggle("hidden", !admin);
  els.detailEditBtn.onclick = () => {
    closeModal("modal-dsden-detail-overlay");
    openForm(contact);
  };

  openModal("modal-dsden-detail-overlay");
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
  data.service = capitalizeFirst(data.service);
  data.nom = capitalizeFirst(data.nom);
  data.prenom = capitalizeFirst(data.prenom);
  data.fonction = capitalizeFirst(data.fonction);
  data.telephone = formatPhoneFr(data.telephone);
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
