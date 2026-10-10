// ============================================================================
// Onglet Dépôt de documents — contribution libre (lien ou fichier) de tous
// les utilisateurs. Les fichiers sont hébergés sur Cloudinary (upload non
// signé, voir assets/js/cloudinary-config.js) car l'application n'utilise
// pas Firebase Storage (reste sur le forfait gratuit).
// ============================================================================

import { DocumentsAPI } from "./db.js";
import { getCurrentUser, isCurrentUserAdmin } from "./auth.js";
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
  ACCEPTED_FILE_EXTENSIONS,
} from "./cloudinary-config.js";
import { escapeHtml, toast, openModal, closeModal, wireOverlayClose, formatDate, humanFileSize } from "./utils.js";

let allDocuments = [];
let searchTerm = "";

const els = {};

export async function initDepot() {
  els.grid = document.getElementById("depot-grid");
  els.empty = document.getElementById("depot-empty");
  els.search = document.getElementById("depot-search");
  els.addBtn = document.getElementById("btn-depot-add");
  els.form = document.getElementById("form-depot");
  els.typeRadios = els.form.querySelectorAll('input[name="depotType"]');
  els.champLien = document.getElementById("champ-depot-lien");
  els.champFichier = document.getElementById("champ-depot-fichier");
  els.fileInput = document.getElementById("depot-fichier");
  els.fileSizeHint = document.getElementById("depot-file-size-hint");
  els.rgpdCheck = document.getElementById("depot-rgpd-check");
  els.submitBtn = document.getElementById("btn-depot-submit");

  els.fileInput.setAttribute("accept", ACCEPTED_FILE_EXTENSIONS);
  const maxSizeLabelEl = document.getElementById("depot-max-size-label");
  if (maxSizeLabelEl) maxSizeLabelEl.textContent = MAX_FILE_SIZE_LABEL;

  wireOverlayClose("modal-depot-overlay");

  els.search.addEventListener("input", () => {
    searchTerm = els.search.value.trim().toLowerCase();
    render();
  });

  els.addBtn.addEventListener("click", () => openForm());
  document.getElementById("btn-depot-cancel").addEventListener("click", () => closeModal("modal-depot-overlay"));
  document.getElementById("modal-depot-close").addEventListener("click", () => closeModal("modal-depot-overlay"));

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

  await loadAndRender();
}

async function loadAndRender() {
  try {
    allDocuments = await DocumentsAPI.list();
  } catch (err) {
    toast("Impossible de charger les documents : " + err.message, "error");
    allDocuments = [];
  }
  render();
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
  const filtered = allDocuments.filter((d) => matches(d, searchTerm));
  els.empty.classList.toggle("hidden", filtered.length > 0);

  els.grid.innerHTML = filtered.map(renderCard).join("");

  els.grid.querySelectorAll('[data-action="delete"]').forEach((btn) => {
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
  els.form.reset();
  els.fileSizeHint.textContent = "";
  els.fileSizeHint.classList.remove("error");
  els.submitBtn.disabled = false;
  els.submitBtn.textContent = "Déposer";
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
  const titre = els.form.elements["titre"].value.trim();
  const type = els.form.elements["depotType"].value;
  const description = els.form.elements["description"].value.trim();

  if (!titre) {
    toast("Le titre est obligatoire.", "error");
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
    const data = { titre, description, ajoutePar };

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
