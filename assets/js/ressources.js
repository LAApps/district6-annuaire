// ============================================================================
// Onglet Ressources — classement par thématique, ajout (lien / pdf / zip),
// téléchargement, contact administrateur.
// ============================================================================

import { RessourcesAPI, THEMATIQUES_RESSOURCES } from "./db.js";
import { getCurrentUser, isCurrentUserAdmin } from "./auth.js";
import { ADMIN_EMAIL } from "./firebase-config.js";
import { escapeHtml, toast, openModal, closeModal, wireOverlayClose, formatDate } from "./utils.js";
import { openImportModal } from "./import.js";

let allResources = [];
let searchTerm = "";
let filterThematique = "";

const els = {};

export async function initRessources() {
  els.container = document.getElementById("ressources-groups");
  els.search = document.getElementById("ressources-search");
  els.filter = document.getElementById("ressources-filter-thematique");
  els.addBtn = document.getElementById("btn-ressource-add");
  els.importBtn = document.getElementById("btn-ressources-import");
  els.contactBtn = document.getElementById("btn-contact-admin");
  els.form = document.getElementById("form-ressource");
  els.typeRadios = els.form.querySelectorAll('input[name="type"]');
  els.champLien = document.getElementById("champ-ressource-lien");
  els.urlLabel = document.getElementById("r-url-label");
  els.urlHint = document.getElementById("r-url-hint");
  els.submitBtn = document.getElementById("btn-ressource-submit");

  wireOverlayClose("modal-ressource-overlay");

  els.filter.innerHTML =
    `<option value="">Toutes les thématiques</option>` +
    THEMATIQUES_RESSOURCES.map((t) => `<option value="${t.id}">${escapeHtml(t.label)}</option>`).join("");

  const selectThematiqueForm = els.form.elements["thematique"];
  selectThematiqueForm.innerHTML = THEMATIQUES_RESSOURCES.map(
    (t) => `<option value="${t.id}">${escapeHtml(t.label)}</option>`
  ).join("");

  els.search.addEventListener("input", () => {
    searchTerm = els.search.value.trim().toLowerCase();
    render();
  });
  els.filter.addEventListener("change", () => {
    filterThematique = els.filter.value;
    render();
  });

  const admin = isCurrentUserAdmin();
  els.addBtn.classList.toggle("hidden", !admin);
  els.importBtn.classList.toggle("hidden", !admin);
  els.addBtn.addEventListener("click", () => openForm());
  els.importBtn.addEventListener("click", () => openImportModal("ressources", loadAndRender));
  document.getElementById("btn-ressource-cancel").addEventListener("click", () => closeModal("modal-ressource-overlay"));
  document.getElementById("modal-ressource-close").addEventListener("click", () => closeModal("modal-ressource-overlay"));

  els.typeRadios.forEach((radio) => radio.addEventListener("change", updateUrlFieldLabel));

  els.contactBtn.addEventListener("click", () => {
    const subject = encodeURIComponent("Contact — Application District 6 (Ressources)");
    const body = encodeURIComponent(
      "Bonjour,\n\nJe vous contacte au sujet de l'espace Ressources de l'application District 6.\n\n"
    );
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
  });

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveForm();
  });

  await loadAndRender();
}

async function loadAndRender() {
  try {
    allResources = await RessourcesAPI.list();
  } catch (err) {
    toast("Impossible de charger les ressources : " + err.message, "error");
    allResources = [];
  }
  render();
}

function matches(res, term) {
  if (!term) return true;
  return `${res.titre} ${res.description || ""}`.toLowerCase().includes(term);
}

function iconLabel(type) {
  return type === "pdf" ? "PDF" : type === "zip" ? "ZIP" : "LIEN";
}

function updateUrlFieldLabel() {
  const type = els.form.elements["type"].value;
  if (type === "lien") {
    els.urlLabel.textContent = "URL du lien *";
    els.urlHint.textContent = "";
  } else {
    els.urlLabel.textContent = `URL du fichier ${type.toUpperCase()} *`;
    els.urlHint.textContent = "L'application n'héberge pas les fichiers : indiquez le lien vers un fichier déjà déposé sur Drive, l'ENT ou un site académique.";
  }
}

function render() {
  const groups = THEMATIQUES_RESSOURCES.filter((t) => !filterThematique || t.id === filterThematique);

  els.container.innerHTML = groups
    .map((t) => {
      const items = allResources.filter((r) => r.thematique === t.id && matches(r, searchTerm));
      return `
        <div class="thematique-group">
          <h3 class="thematique-title">${escapeHtml(t.label)} <span class="thematique-count">${items.length}</span></h3>
          ${
            items.length === 0
              ? `<p class="empty-state" style="padding:1rem;">Aucune ressource pour le moment.</p>`
              : `<div class="resource-grid">${items.map(renderCard).join("")}</div>`
          }
        </div>`;
    })
    .join("");

  els.container.querySelectorAll("[data-open]").forEach((a) => {
    a.addEventListener("click", (e) => {
      // liens ouverts normalement (target=_blank), rien à faire ici
    });
  });
  els.container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = allResources.find((r) => r.id === btn.dataset.id);
      if (!item) return;
      if (!confirm(`Supprimer la ressource « ${item.titre} » ?`)) return;
      try {
        await RessourcesAPI.remove(item);
        toast("Ressource supprimée.", "success");
        await loadAndRender();
      } catch (err) {
        toast("Erreur : " + err.message, "error");
      }
    });
  });
}

function renderCard(r) {
  return `
    <div class="resource-card">
      <div class="resource-card__top">
        <div class="resource-type-icon type-${r.type}">${iconLabel(r.type)}</div>
        <div>
          <p class="resource-card__title">${escapeHtml(r.titre)}</p>
          ${r.description ? `<p class="resource-card__desc">${escapeHtml(r.description)}</p>` : ""}
        </div>
      </div>
      <div class="resource-card__footer">
        <span>${r.ajoutePar ? "Ajouté par " + escapeHtml(r.ajoutePar) : ""} ${r.createdAt ? "· " + formatDate(r.createdAt) : ""}</span>
      </div>
      <div class="cell-actions">
        <a class="btn btn-primary btn-sm" data-open href="${escapeHtml(r.url)}" target="_blank" rel="noopener">
          ${r.type === "lien" ? "Ouvrir le lien" : "Télécharger"}
        </a>
        ${isCurrentUserAdmin() ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${r.id}">Supprimer</button>` : ""}
      </div>
    </div>`;
}

function openForm() {
  els.form.reset();
  els.submitBtn.disabled = false;
  els.submitBtn.textContent = "Ajouter";
  updateUrlFieldLabel();
  openModal("modal-ressource-overlay");
}

async function saveForm() {
  const titre = els.form.elements["titre"].value.trim();
  const thematique = els.form.elements["thematique"].value;
  const type = els.form.elements["type"].value;
  const url = els.form.elements["url"].value.trim();
  const description = els.form.elements["description"].value.trim();

  if (!titre || !type) {
    toast("Le titre et le type de ressource sont obligatoires.", "error");
    return;
  }
  if (!url) {
    toast("Merci de renseigner l'URL de la ressource.", "error");
    return;
  }

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Enregistrement...";

  try {
    const user = getCurrentUser();
    const data = {
      titre,
      thematique,
      type,
      url,
      description,
      ajoutePar: user ? user.displayName || user.email : "",
    };

    await RessourcesAPI.add(data);
    toast("Ressource ajoutée.", "success");
    closeModal("modal-ressource-overlay");
    await loadAndRender();
  } catch (err) {
    toast("Erreur lors de l'enregistrement : " + err.message, "error");
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Ajouter";
  }
}
