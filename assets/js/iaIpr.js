// ============================================================================
// Onglet IA-IPR — référent·es IA-IPR par ville et discipline, issus de la
// note d'information « Répartition des secteurs » (voir iaIprData.js).
// Consultation pour tous : on choisit une ville, on obtient la liste des
// disciplines avec le nom du référent ; cliquer dessus ouvre sa fiche
// (nom, prénom, téléphone, mail — même format que les autres fiches de
// l'application), modifiable par les administrateurs.
// ============================================================================

import { IaIprReferentsAPI, IaIprSecteursAPI, VILLES_DISTRICT } from "./db.js";
import { IA_IPR_REFERENTS_SEED, IA_IPR_SECTEURS_SEED } from "./iaIprData.js";
import { isCurrentUserAdmin } from "./auth.js";
import { escapeHtml, toast, openModal, closeModal, wireOverlayClose, telHref, toUpperFr, capitalizeWords } from "./utils.js";

let referents = [];
let secteurs = [];
let selectedVille = "";
let editingId = null;

const els = {};

export async function initIaIpr() {
  els.villeSelect = document.getElementById("iaipr-ville-select");
  els.tableWrap = document.getElementById("iaipr-table-wrap");
  els.tbody = document.getElementById("iaipr-tbody");
  els.hint = document.getElementById("iaipr-hint");
  els.empty = document.getElementById("iaipr-empty");

  els.detailTitle = document.getElementById("modal-iaipr-detail-title");
  els.detailBody = document.getElementById("iaipr-detail-body");
  els.detailEditBtn = document.getElementById("btn-iaipr-detail-edit");

  els.form = document.getElementById("form-iaipr");
  els.modalTitle = document.getElementById("modal-iaipr-title");

  wireOverlayClose("modal-iaipr-detail-overlay");
  wireOverlayClose("modal-iaipr-overlay");

  els.villeSelect.innerHTML =
    `<option value="">— Choisir une ville —</option>` + VILLES_DISTRICT.map((v) => `<option value="${v}">${v}</option>`).join("");
  els.villeSelect.addEventListener("change", () => {
    selectedVille = els.villeSelect.value;
    render();
  });

  document.getElementById("modal-iaipr-detail-close").addEventListener("click", () => closeModal("modal-iaipr-detail-overlay"));
  document.getElementById("btn-iaipr-detail-fermer").addEventListener("click", () => closeModal("modal-iaipr-detail-overlay"));
  document.getElementById("modal-iaipr-close").addEventListener("click", () => closeModal("modal-iaipr-overlay"));
  document.getElementById("btn-iaipr-cancel").addEventListener("click", () => closeModal("modal-iaipr-overlay"));

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveForm();
  });

  await loadAndRender();
}

async function loadAndRender() {
  try {
    if (isCurrentUserAdmin()) {
      const [existingReferents, existingSecteurs] = await Promise.all([IaIprReferentsAPI.list(), IaIprSecteursAPI.list()]);
      const incomplete =
        existingReferents.length < IA_IPR_REFERENTS_SEED.length || existingSecteurs.length < IA_IPR_SECTEURS_SEED.length;
      if (incomplete) {
        toast("Mise à jour des données IA-IPR en cours, cela peut prendre quelques secondes…", "info");
      }
      const seeded = await IaIprSecteursAPI.ensureDefaults();
      referents = seeded.referents;
      secteurs = seeded.secteurs;
      if (incomplete && seeded.seededNow) {
        toast("Données IA-IPR complétées.", "success");
      }
    } else {
      [referents, secteurs] = await Promise.all([IaIprReferentsAPI.list(), IaIprSecteursAPI.list()]);
    }
  } catch (err) {
    toast("Impossible de charger les référents IA-IPR : " + err.message, "error");
    referents = [];
    secteurs = [];
  }
  render();
}

function render() {
  const hasVille = Boolean(selectedVille);
  els.hint.classList.toggle("hidden", hasVille);

  if (!hasVille) {
    els.tableWrap.classList.add("hidden");
    els.empty.classList.add("hidden");
    return;
  }

  const items = secteurs.filter((s) => s.ville === selectedVille).sort((a, b) => a.discipline.localeCompare(b.discipline, "fr"));

  els.tableWrap.classList.toggle("hidden", items.length === 0);
  els.empty.classList.toggle("hidden", items.length > 0);

  els.tbody.innerHTML = items
    .map((s) => {
      const r = referents.find((ref) => ref.id === s.referentId);
      const nomComplet = r ? `${r.prenom} ${r.nom}`.trim() : "—";
      return `
      <tr data-secteur-id="${s.id}">
        <td data-label="Discipline">${escapeHtml(s.discipline)}</td>
        <td data-label="IA-IPR référent">${escapeHtml(nomComplet)}</td>
      </tr>`;
    })
    .join("");

  els.tbody.querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", () => {
      const s = items.find((x) => x.id === tr.dataset.secteurId);
      if (!s) return;
      const r = referents.find((ref) => ref.id === s.referentId);
      if (r) openDetail(r, s.discipline);
    });
  });
}

function openDetail(referent, discipline) {
  const admin = isCurrentUserAdmin();
  els.detailTitle.textContent = `${referent.prenom} ${referent.nom}`.trim();

  const rows = [
    ["Discipline", discipline ? escapeHtml(discipline) : ""],
    ["Téléphone", referent.telephone ? `<a href="${telHref(referent.telephone)}">${escapeHtml(referent.telephone)}</a>` : ""],
    ["Mail", referent.mail ? `<a href="mailto:${escapeHtml(referent.mail)}">${escapeHtml(referent.mail)}</a>` : ""],
  ].filter(([, value]) => value);

  els.detailBody.innerHTML = rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("");
  if (rows.length === 0) {
    els.detailBody.innerHTML = `<p class="field-hint" style="margin:0;">Aucune information complémentaire.</p>`;
  }

  els.detailEditBtn.classList.toggle("hidden", !admin);
  els.detailEditBtn.onclick = () => {
    closeModal("modal-iaipr-detail-overlay");
    openForm(referent);
  };

  openModal("modal-iaipr-detail-overlay");
}

function openForm(referent) {
  editingId = referent.id;
  els.modalTitle.textContent = "Modifier le référent";
  els.form.reset();
  els.form.elements["nom"].value = referent.nom || "";
  els.form.elements["prenom"].value = referent.prenom || "";
  els.form.elements["telephone"].value = referent.telephone || "";
  els.form.elements["mail"].value = referent.mail || "";
  openModal("modal-iaipr-overlay");
}

async function saveForm() {
  if (!editingId) return;
  const data = {
    nom: toUpperFr(els.form.elements["nom"].value.trim()),
    prenom: capitalizeWords(els.form.elements["prenom"].value.trim()),
    telephone: els.form.elements["telephone"].value.trim(),
    mail: els.form.elements["mail"].value.trim(),
  };
  if (!data.nom || !data.prenom) {
    toast("Le nom et le prénom sont obligatoires.", "error");
    return;
  }
  try {
    await IaIprReferentsAPI.update(editingId, data);
    toast("Fiche mise à jour.", "success");
    closeModal("modal-iaipr-overlay");
    await loadAndRender();
  } catch (err) {
    toast("Erreur lors de l'enregistrement : " + err.message, "error");
  }
}
