// ============================================================================
// Onglet Ressources partagées (ex Dépôt de documents) — bibliothèque classée
// par catégorie, contribution libre (lien ou fichier) de tous les
// utilisateurs. Les fichiers sont hébergés sur Cloudinary (upload non signé,
// voir cloudinary-config.js) car l'application n'utilise pas Firebase
// Storage (reste sur le forfait gratuit).
// ============================================================================

import { DocumentsAPI, CategoriesDepotAPI } from "./db.js";
import { getCurrentUser, isCurrentUserAdmin } from "./auth.js";
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
  ACCEPTED_FILE_EXTENSIONS,
} from "./cloudinary-config.js";
import { escapeHtml, toast, openModal, closeModal, wireOverlayClose, formatDate, humanFileSize, capitalizeFirst } from "./utils.js";

let allDocuments = [];
let categories = [];
let searchTerm = "";
let filterCategorie = "";

const els = {};

export async function initDepot() {
  els.groups = document.getElementById("depot-groups");
  els.search = document.getElementById("depot-search");
  els.filter = document.getElementById("depot-filter-categorie");
  els.addBtn = document.getElementById("btn-depot-add");
  els.addCategorieBtn = document.getElementById("btn-depot-categorie-add");
  els.form = document.getElementById("form-depot");
  els.typeRadios = els.form.querySelectorAll('input[name="depotType"]');
  els.champLien = document.getElementById("champ-depot-lien");
  els.champFichier = document.getElementById("champ-depot-fichier");
  els.fileInput = document.getElementById("depot-fichier");
  els.fileSizeHint = document.getElementById("depot-file-size-hint");
  els.rgpdCheck = document.getElementById("depot-rgpd-check");
  els.submitBtn = document.getElementById("btn-depot-submit");
  els.formCategorie = document.getElementById("form-depot-categorie");

  els.fileInput.setAttribute("accept", ACCEPTED_FILE_EXTENSIONS);
  const maxSizeLabelEl = document.getElementById("depot-max-size-label");
  if (maxSizeLabelEl) maxSizeLabelEl.textContent = MAX_FILE_SIZE_LABEL;

  const admin = isCurrentUserAdmin();
  els.addCategorieBtn.classList.toggle("hidden", !admin);

  wireOverlayClose("modal-depot-overlay");
  wireOverlayClose("modal-depot-categorie-overlay");

  els.search.addEventListener("input", () => {
    searchTerm = els.search.value.trim().toLowerCase();
    render();
  });
  els.filter.addEventListener("change", () => {
    filterCategorie = els.filter.value;
    render();
  });

  els.addBtn.addEventListener("click", () => openForm());
  document.getElementById("btn-depot-cancel").addEventListener("click", () => closeModal("modal-depot-overlay"));
  document.getElementById("modal-depot-close").addEventListener("click", () => closeModal("modal-depot-overlay"));

  els.addCategorieBtn.addEventListener("click", () => {
    els.formCategorie.reset();
    openModal("modal-depot-categorie-overlay");
  });
  document.getElementById("btn-depot-categorie-cancel").addEventListener("click", () => closeModal("modal-depot-categorie-overlay"));
  document.getElementById("modal-depot-categorie-close").addEventListener("click", () => closeModal("modal-depot-categorie-overlay"));
  els.formCategorie.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nom = capitalizeFirst(els.formCategorie.elements["nom"].value.trim());
    if (!nom) return;
    try {
      await CategoriesDepotAPI.add(nom);
      toast("Catégorie ajoutée.", "success");
      closeModal("modal-depot-categorie-overlay");
      await loadCategories();
      populateSelects();
      render();
    } catch (err) {
      toast("Erreur : " + err.message, "error");
    }
  });

  els.typeRadios.forEach((radio) => radio.addEventListener("change", updateTypeFields));

  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files[0];
    if (!file) {
      els.fileSizeHint.textContent = "";
      els.fileSizeHint.classList.remove("error");
      return;
    }
    const tooBig = file.size > MAX_FILE_SIZE_BYTES;
    els.fileSizeHint.textContent = `Taille : ${humanFileSize(file.size)}${tooBig ? ` — dépasse la limite de ${MAX_FILE_SIZE_LABEL}, choisissez un fichier plus léger.` : ""}`;
    els.fileSizeHint.classList.toggle("error", tooBig);
  });

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveForm();
  });

  await Promise.all([loadCategories(), loadDocuments()]);
  populateSelects();
  render();
}

async function loadCategories() {
  try {
    categories = isCurrentUserAdmin() ? await CategoriesDepotAPI.ensureDefaults() : await CategoriesDepotAPI.list();
  } catch (err) {
    toast("Impossible de charger les catégories : " + err.message, "error");
    categories = [];
  }
}

async function loadDocuments() {
  try {
    allDocuments = await DocumentsAPI.list();
  } catch (err) {
    toast("Impossible de charger les documents : " + err.message, "error");
    allDocuments = [];
  }
}

async function loadAndRender() {
  await loadDocuments();
  render();
}

function populateSelects() {
  els.filter.innerHTML =
    `<option value="">Toutes les catégories</option>` +
    categories.map((c) => `<option value="${c.id}">${escapeHtml(c.nom)}</option>`).join("");

  const formSelect = els.form.elements["categorie"];
  formSelect.innerHTML = categories.map((c) => `<option value="${c.id}">${escapeHtml(c.nom)}</option>`).join("");
}

function matches(doc, term) {
  if (!term) return true;
  return `${doc.titre} ${doc.description || ""}`.toLowerCase().includes(term);
}

function iconLabel(type) {
  return { pdf: "PDF", word: "WORD", excel: "EXCEL", jpeg: "JPEG", png: "PNG", lien: "LIEN" }[type] || "FICHIER";
}

function detectType(fileName) {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["xls", "xlsx"].includes(ext)) return "excel";
  if (["jpg", "jpeg"].includes(ext)) return "jpeg";
  if (ext === "png") return "png";
  return "fichier";
}

function render() {
  const groups = categories.filter((c) => !filterCategorie || c.id === filterCategorie);

  els.groups.innerHTML = groups
    .map((c) => {
      const items = allDocuments.filter((d) => d.categorie === c.id && matches(d, searchTerm));
      return `
        <div class="thematique-group">
          <h3 class="thematique-title">${escapeHtml(c.nom)} <span class="thematique-count">${items.length}</span></h3>
          ${
            items.length === 0
              ? `<p class="empty-state" style="padding:1rem;">Aucun document pour le moment.</p>`
              : `<div class="resource-grid">${items.map(renderCard).join("")}</div>`
          }
        </div>`;
    })
    .join("");

  els.groups.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const doc = allDocuments.find((d) => d.id === btn.dataset.id);
      if (!doc) return;
      if (!confirm(`Retirer le document « ${doc.titre} » du dépôt ?`)) return;
      try {
        await DocumentsAPI.remove(doc.id);
        toast("Document retiré.", "success");
        await loadAndRender();
      } catch (err) {
        toast("Erreur : " + err.message, "error");
      }
    });
  });
}

function canDelete(doc) {
  const email = getCurrentUser() && getCurrentUser().email;
  return isCurrentUserAdmin() || (email && doc.ajoutePar && doc.ajoutePar.toLowerCase() === email.toLowerCase());
}

function renderCard(d) {
  return `
    <div class="resource-card">
      <div class="resource-card__top">
        <div class="resource-type-icon type-${d.type}">${iconLabel(d.type)}</div>
        <div>
          <p class="resource-card__title">${escapeHtml(d.titre)}</p>
          ${d.description ? `<p class="resource-card__desc">${escapeHtml(d.description)}</p>` : ""}
        </div>
      </div>
      <div class="resource-card__footer">
        <span>${d.ajoutePar ? "Déposé par " + escapeHtml(d.ajoutePar) : ""} ${d.createdAt ? "· " + formatDate(d.createdAt) : ""} ${d.fileSizeBytes ? "· " + humanFileSize(d.fileSizeBytes) : ""}</span>
      </div>
      <div class="cell-actions">
        <a class="btn btn-primary btn-sm" href="${escapeHtml(d.url)}" target="_blank" rel="noopener">
          ${d.type === "lien" ? "Ouvrir le lien" : "Télécharger"}
        </a>
        ${canDelete(d) ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${d.id}">Retirer</button>` : ""}
      </div>
    </div>`;
}

function updateTypeFields() {
  const type = els.form.elements["depotType"].value;
  els.champLien.classList.toggle("hidden", type !== "lien");
  els.champFichier.classList.toggle("hidden", type !== "fichier");
  els.form.elements["url"].required = type === "lien";
  els.fileInput.required = type === "fichier";
}

function openForm() {
  if (categories.length === 0) {
    toast("Aucune catégorie disponible pour le moment. Réessayez dans un instant.", "error");
    return;
  }
  els.form.reset();
  els.fileSizeHint.textContent = "";
  els.fileSizeHint.classList.remove("error");
  els.submitBtn.disabled = false;
  els.submitBtn.textContent = "Déposer";
  if (filterCategorie) els.form.elements["categorie"].value = filterCategorie;
  updateTypeFields();
  openModal("modal-depot-overlay");
}

async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body.error && body.error.message) || "Échec de l'envoi du fichier.");
  }
  return res.json();
}

async function saveForm() {
  const titre = capitalizeFirst(els.form.elements["titre"].value.trim());
  const categorie = els.form.elements["categorie"].value;
  const type = els.form.elements["depotType"].value;
  const description = capitalizeFirst(els.form.elements["description"].value.trim());

  if (!titre || !categorie) {
    toast("Le titre et la catégorie sont obligatoires.", "error");
    return;
  }
  if (!els.rgpdCheck.checked) {
    toast("Merci de confirmer l'engagement RGPD avant de déposer.", "error");
    return;
  }

  const user = getCurrentUser();
  const ajoutePar = user ? user.email : "";

  els.submitBtn.disabled = true;

  try {
    const data = { titre, categorie, description, ajoutePar };

    if (type === "lien") {
      const url = els.form.elements["url"].value.trim();
      if (!url) {
        toast("Merci de renseigner l'URL du lien.", "error");
        return;
      }
      data.type = "lien";
      data.url = url;
    } else {
      const file = els.fileInput.files[0];
      if (!file) {
        toast("Merci de sélectionner un fichier.", "error");
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast(`Ce fichier dépasse la taille maximale autorisée (${MAX_FILE_SIZE_LABEL}).`, "error");
        return;
      }
      els.submitBtn.textContent = "Envoi du fichier...";
      const result = await uploadToCloudinary(file);
      data.type = detectType(file.name);
      data.url = result.secure_url;
      data.fileName = file.name;
      data.fileSizeBytes = file.size;
    }

    els.submitBtn.textContent = "Enregistrement...";
    await DocumentsAPI.add(data);
    toast("Document déposé.", "success");
    closeModal("modal-depot-overlay");
    await loadAndRender();
  } catch (err) {
    toast("Erreur lors du dépôt : " + err.message, "error");
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Déposer";
  }
}
