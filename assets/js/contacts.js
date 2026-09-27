// ============================================================================
// Onglet Personnes ressources — thèmes du réseau -> personnes à contacter
// (informations reprises de l'Annuaire).
// ============================================================================

import { AnnuaireAPI, ThemesReseauAPI, PersonnesRessourcesAPI } from "./db.js";
import { escapeHtml, toast, openModal, closeModal, wireOverlayClose } from "./utils.js";
import { openImportModal } from "./import.js";
import { isCurrentUserAdmin, isOwnAnnuaireEntry } from "./auth.js";

let themes = [];
let liens = []; // personnesRessources : {id, themeId, annuaireId, note}
let annuaire = [];
let selectedThemeId = null;

const els = {};

export async function initContacts() {
  els.themeGrid = document.getElementById("theme-grid");
  els.contactList = document.getElementById("contact-list");
  els.hint = document.getElementById("contact-hint");
  els.addThemeBtn = document.getElementById("btn-theme-add");
  els.addLienBtn = document.getElementById("btn-personne-ressource-add");
  els.importBtn = document.getElementById("btn-personnes-ressources-import");

  els.formTheme = document.getElementById("form-theme");
  els.formLien = document.getElementById("form-personne-ressource");

  wireOverlayClose("modal-theme-overlay");
  wireOverlayClose("modal-personne-ressource-overlay");

  const admin = isCurrentUserAdmin();
  els.addThemeBtn.classList.toggle("hidden", !admin);
  els.importBtn.classList.toggle("hidden", !admin);
  // "Ajouter une personne ressource" reste visible à tous : un utilisateur
  // standard peut se déclarer lui-même (voir openLienForm / firestore.rules).

  els.addThemeBtn.addEventListener("click", () => {
    els.formTheme.reset();
    openModal("modal-theme-overlay");
  });
  document.getElementById("btn-theme-cancel").addEventListener("click", () => closeModal("modal-theme-overlay"));
  document.getElementById("modal-theme-close").addEventListener("click", () => closeModal("modal-theme-overlay"));

  els.formTheme.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nom = els.formTheme.elements["nom"].value.trim();
    if (!nom) return;
    try {
      await ThemesReseauAPI.add(nom);
      toast("Thème ajouté.", "success");
      closeModal("modal-theme-overlay");
      await loadThemes();
      render();
    } catch (err) {
      toast("Erreur : " + err.message, "error");
    }
  });

  els.addLienBtn.addEventListener("click", () => openLienForm());
  els.importBtn.addEventListener("click", () => openImportModal("personnes-ressources", refreshContacts));
  document.getElementById("btn-personne-ressource-cancel").addEventListener("click", () =>
    closeModal("modal-personne-ressource-overlay")
  );
  document.getElementById("modal-personne-ressource-close").addEventListener("click", () =>
    closeModal("modal-personne-ressource-overlay")
  );

  els.formLien.addEventListener("submit", async (e) => {
    e.preventDefault();
    const themeId = els.formLien.elements["themeId"].value;
    const annuaireId = els.formLien.elements["annuaireId"].value;
    const note = els.formLien.elements["note"].value.trim();
    if (!themeId || !annuaireId) {
      toast("Merci de choisir un thème et une personne.", "error");
      return;
    }
    try {
      await PersonnesRessourcesAPI.add({ themeId, annuaireId, note });
      toast("Personne ressource ajoutée.", "success");
      closeModal("modal-personne-ressource-overlay");
      await loadLiens();
      render();
    } catch (err) {
      toast("Erreur : " + err.message, "error");
    }
  });

  await Promise.all([loadThemes(), loadLiens(), loadAnnuaire()]);
  render();
}

async function loadThemes() {
  try {
    themes = isCurrentUserAdmin() ? await ThemesReseauAPI.ensureDefaults() : await ThemesReseauAPI.list();
  } catch (err) {
    toast("Impossible de charger les thèmes : " + err.message, "error");
    themes = [];
  }
}
async function loadLiens() {
  try {
    liens = await PersonnesRessourcesAPI.list();
  } catch (err) {
    toast("Impossible de charger les personnes ressources : " + err.message, "error");
    liens = [];
  }
}
async function loadAnnuaire() {
  try {
    annuaire = await AnnuaireAPI.list();
  } catch (err) {
    annuaire = [];
  }
}

function countForTheme(themeId) {
  return liens.filter((l) => l.themeId === themeId).length;
}

function render() {
  els.themeGrid.innerHTML = themes
    .map(
      (t) => `
      <div class="theme-card ${t.id === selectedThemeId ? "selected" : ""}" data-id="${t.id}">
        ${escapeHtml(t.nom)}
        <span class="count">${countForTheme(t.id)} contact(s)</span>
      </div>`
    )
    .join("");

  els.themeGrid.querySelectorAll(".theme-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedThemeId = selectedThemeId === card.dataset.id ? null : card.dataset.id;
      render();
    });
  });

  if (!selectedThemeId) {
    els.hint.classList.remove("hidden");
    els.contactList.innerHTML = "";
    return;
  }
  els.hint.classList.add("hidden");

  const items = liens.filter((l) => l.themeId === selectedThemeId);
  if (items.length === 0) {
    els.contactList.innerHTML = `<p class="empty-state">Aucune personne ressource associée à ce thème pour le moment.</p>`;
    return;
  }

  els.contactList.innerHTML = items
    .map((l) => {
      const p = annuaire.find((a) => a.id === l.annuaireId);
      if (!p) return "";
      return `
        <div class="contact-card">
          <h3>${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</h3>
          <p class="fonction">${escapeHtml(p.fonction)}${p.etablissement ? " — " + escapeHtml(p.etablissement) : ""}</p>
          <dl>
            ${p.portable ? `<dt>Portable</dt><dd>${escapeHtml(p.portable)}</dd>` : ""}
            ${p.fixe ? `<dt>Fixe</dt><dd>${escapeHtml(p.fixe)}</dd>` : ""}
            ${p.mail ? `<dt>Mail</dt><dd><a href="mailto:${escapeHtml(p.mail)}">${escapeHtml(p.mail)}</a></dd>` : ""}
          </dl>
          ${l.note ? `<p class="field-hint" style="margin-top:.5rem;">${escapeHtml(l.note)}</p>` : ""}
          ${
            isCurrentUserAdmin() || isOwnAnnuaireEntry(p)
              ? `<div class="cell-actions" style="margin-top:.6rem;">
                  <button class="btn btn-danger btn-sm" data-action="remove-lien" data-id="${l.id}">Retirer</button>
                </div>`
              : ""
          }
        </div>`;
    })
    .join("");

  els.contactList.querySelectorAll('[data-action="remove-lien"]').forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Retirer cette personne ressource de ce thème ?")) return;
      try {
        await PersonnesRessourcesAPI.remove(btn.dataset.id);
        await loadLiens();
        render();
      } catch (err) {
        toast("Erreur : " + err.message, "error");
      }
    });
  });
}

function openLienForm() {
  const admin = isCurrentUserAdmin();
  const choices = admin ? annuaire : annuaire.filter((p) => isOwnAnnuaireEntry(p));

  if (choices.length === 0) {
    toast("Ajoutez d'abord votre fiche dans l'onglet Annuaire avant de vous déclarer comme personne ressource.", "error");
    return;
  }

  els.formLien.reset();
  const themeSelect = els.formLien.elements["themeId"];
  themeSelect.innerHTML = themes.map((t) => `<option value="${t.id}">${escapeHtml(t.nom)}</option>`).join("");
  if (selectedThemeId) themeSelect.value = selectedThemeId;

  const personneSelect = els.formLien.elements["annuaireId"];
  personneSelect.innerHTML = choices
    .map((p) => `<option value="${p.id}">${escapeHtml(p.prenom)} ${escapeHtml(p.nom)} — ${escapeHtml(p.fonction || "")}</option>`)
    .join("");
  personneSelect.disabled = !admin && choices.length === 1;

  openModal("modal-personne-ressource-overlay");
}

export async function refreshContacts() {
  await Promise.all([loadThemes(), loadLiens(), loadAnnuaire()]);
  render();
}
