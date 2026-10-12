// ============================================================================
// Onglet Annuaire — liste, recherche, ajout et modification des fiches.
// ============================================================================

import { AnnuaireAPI, ThemesReseauAPI, PersonnesRessourcesAPI, VILLES_DISTRICT, FONCTIONS_DISTRICT, ETABLISSEMENTS_DISTRICT } from "./db.js";
import {
  escapeHtml,
  toast,
  openModal,
  closeModal,
  wireOverlayClose,
  toUpperFr,
  capitalizeWords,
  capitalizeFirst,
  telHref,
  formatPhoneFr,
} from "./utils.js";
import { openImportModal } from "./import.js";
import { isCurrentUserAdmin, isOwnAnnuaireEntry, getCurrentUser } from "./auth.js";

let allEntries = [];
let themes = [];
let personnesRessources = [];
let searchTerm = "";
let filterFonction = "";
let filterEtablissement = "";
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
  els.filterFonction = document.getElementById("annuaire-filter-fonction");
  els.filterEtablissement = document.getElementById("annuaire-filter-etablissement");
  els.detailTitle = document.getElementById("modal-annuaire-detail-title");
  els.detailBody = document.getElementById("annuaire-detail-body");
  els.detailEditBtn = document.getElementById("btn-annuaire-detail-edit");
  els.detailDeleteBtn = document.getElementById("btn-annuaire-detail-delete");

  els.fonctionSelect = document.getElementById("f-fonction");
  els.etablissementSelect = document.getElementById("f-etablissement");

  els.villeSelect.innerHTML =
    `<option value="">—</option>` + VILLES_DISTRICT.map((v) => `<option value="${v}">${v}</option>`).join("");
  els.fonctionSelect.innerHTML =
    `<option value="">—</option>` + FONCTIONS_DISTRICT.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("");
  els.etablissementSelect.innerHTML =
    `<option value="">—</option>` +
    ETABLISSEMENTS_DISTRICT.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");

  wireOverlayClose("modal-annuaire-overlay");
  wireOverlayClose("modal-annuaire-detail-overlay");

  els.search.addEventListener("input", () => {
    searchTerm = els.search.value.trim().toLowerCase();
    render();
  });
  els.filterFonction.addEventListener("change", () => {
    filterFonction = els.filterFonction.value;
    render();
  });
  els.filterEtablissement.addEventListener("change", () => {
    filterEtablissement = els.filterEtablissement.value;
    render();
  });

  document.getElementById("modal-annuaire-detail-close").addEventListener("click", () => closeModal("modal-annuaire-detail-overlay"));
  document.getElementById("btn-annuaire-detail-fermer").addEventListener("click", () => closeModal("modal-annuaire-detail-overlay"));

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
  populateFilters();
  render();
}

function normKey(str) {
  return String(str || "").trim().toLowerCase();
}

// Reconstruit les options des filtres Fonction / Établissement à partir des
// valeurs réellement présentes dans l'annuaire, en regroupant les variantes
// de casse ("Principal" / "principal") sous une seule option, et en
// conservant la sélection en cours si elle existe toujours.
function populateFilters() {
  const buildOptions = (select, values, allLabel, current, formatLabel) => {
    const groups = new Map(); // clé normalisée -> libellé affiché
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
    allEntries.map((e) => e.fonction),
    "Toutes les fonctions",
    filterFonction,
    capitalizeFirst
  );
  filterEtablissement = buildOptions(
    els.filterEtablissement,
    allEntries.map((e) => e.etablissement),
    "Tous les établissements",
    filterEtablissement,
    toUpperFr
  );
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
  if (filterFonction && normKey(entry.fonction) !== filterFonction) return false;
  if (filterEtablissement && normKey(entry.etablissement) !== filterEtablissement) return false;
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
        <td data-label="Nom">${escapeHtml(e.nom)}</td>
        <td data-label="Prénom">${escapeHtml(e.prenom)}</td>
        <td data-label="Fonction">${escapeHtml(e.fonction)}</td>
        <td data-label="Établissement">${escapeHtml(e.etablissement)}</td>
        <td data-label="Ville">${escapeHtml(e.ville)}</td>
        <td data-label="Portable">${e.portable ? `<a href="${telHref(e.portable)}">${escapeHtml(e.portable)}</a>` : ""}</td>
        <td data-label="Ligne fixe">${e.fixe ? `<a href="${telHref(e.fixe)}">${escapeHtml(e.fixe)}</a>` : ""}</td>
        <td data-label="Mail">${e.mail ? `<a href="mailto:${escapeHtml(e.mail)}">${escapeHtml(e.mail)}</a>` : ""}</td>
        <td data-label="Actions" class="cell-actions">
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
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const entry = allEntries.find((e) => e.id === btn.dataset.id);
      openForm(entry);
    });
  });

  els.tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
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

  // Clic sur la ligne (hors liens/boutons) : ouvre la fiche détaillée —
  // utile surtout sur mobile, où seules Nom/Prénom/Fonction/Établissement
  // sont visibles par défaut.
  els.tbody.querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", (e) => {
      if (e.target.closest("a, button")) return;
      const entry = allEntries.find((en) => en.id === tr.dataset.id);
      if (entry) openDetail(entry);
    });
  });
}

function openDetail(entry) {
  const admin = isCurrentUserAdmin();
  els.detailTitle.textContent = `${entry.prenom} ${entry.nom}`.trim();

  const rows = [
    ["Fonction", entry.fonction ? escapeHtml(entry.fonction) : ""],
    ["Établissement", entry.etablissement ? escapeHtml(entry.etablissement) : ""],
    ["Ville", entry.ville ? escapeHtml(entry.ville) : ""],
    ["Portable", entry.portable ? `<a href="${telHref(entry.portable)}">${escapeHtml(entry.portable)}</a>` : ""],
    ["Ligne fixe", entry.fixe ? `<a href="${telHref(entry.fixe)}">${escapeHtml(entry.fixe)}</a>` : ""],
    ["Mail", entry.mail ? `<a href="mailto:${escapeHtml(entry.mail)}">${escapeHtml(entry.mail)}</a>` : ""],
  ].filter(([, value]) => value);

  els.detailBody.innerHTML = rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("");
  if (rows.length === 0) {
    els.detailBody.innerHTML = `<p class="field-hint" style="margin:0;">Aucune information complémentaire.</p>`;
  }

  const canEdit = admin || isOwnAnnuaireEntry(entry);
  els.detailEditBtn.classList.toggle("hidden", !canEdit);
  els.detailEditBtn.onclick = () => {
    closeModal("modal-annuaire-detail-overlay");
    openForm(entry);
  };

  els.detailDeleteBtn.classList.toggle("hidden", !admin);
  els.detailDeleteBtn.onclick = async () => {
    if (!confirm(`Supprimer définitivement la fiche de ${entry.prenom} ${entry.nom} ?`)) return;
    try {
      await AnnuaireAPI.remove(entry.id);
      toast("Fiche supprimée.", "success");
      closeModal("modal-annuaire-detail-overlay");
      await loadAndRender();
    } catch (err) {
      toast("Erreur lors de la suppression : " + err.message, "error");
    }
  };

  openModal("modal-annuaire-detail-overlay");
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
  data.portable = formatPhoneFr(data.portable);
  data.fixe = formatPhoneFr(data.fixe);
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
