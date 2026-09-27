// ============================================================================
// Import Excel/CSV générique pour Annuaire, Ressources et Personnes ressources.
// Utilise la librairie SheetJS (global `XLSX`, chargée en CDN dans index.html).
// ============================================================================

import { AnnuaireAPI, RessourcesAPI, ThemesReseauAPI, PersonnesRessourcesAPI, THEMATIQUES_RESSOURCES } from "./db.js";
import { toast, openModal, closeModal, escapeHtml } from "./utils.js";

let currentType = null;
let onImportedCallback = null;

const TEMPLATES = {
  annuaire: {
    title: "Importer l'annuaire depuis Excel",
    instructions: "Colonnes attendues : Nom, Prénom, Fonction, Établissement, Portable, Fixe, Mail. Nom et Prénom sont obligatoires.",
    sheetName: "Annuaire",
    fileName: "modele-annuaire.xlsx",
    sampleRows: [
      {
        Nom: "Dupont",
        Prénom: "Marie",
        Fonction: "Principale",
        Établissement: "Collège Jean Moulin",
        Portable: "0600000000",
        Fixe: "0140000000",
        Mail: "marie.dupont@ac-creteil.fr",
      },
    ],
  },
  ressources: {
    title: "Importer des ressources depuis Excel",
    instructions:
      `Colonnes attendues : Titre, Thématique (${THEMATIQUES_RESSOURCES.map((t) => t.label).join(", ")}), Type (lien, pdf ou zip), URL, Description. ` +
      "L'application n'héberge pas de fichiers : pour un PDF/ZIP, indiquez l'URL d'un fichier déjà déposé sur Drive, l'ENT ou un site académique.",
    sheetName: "Ressources",
    fileName: "modele-ressources.xlsx",
    sampleRows: [
      { Titre: "Guide DHG 2026", Thématique: "DHG", Type: "lien", URL: "https://exemple.fr/guide-dhg", Description: "Guide de répartition horaire" },
    ],
  },
  "personnes-ressources": {
    title: "Importer des personnes ressources depuis Excel",
    instructions:
      "Colonnes attendues : Thème, Nom, Prénom, Note. Le Nom + Prénom doit correspondre à une fiche déjà existante dans l'Annuaire (importez l'annuaire d'abord si besoin). Les thèmes inconnus sont créés automatiquement.",
    sheetName: "PersonnesRessources",
    fileName: "modele-personnes-ressources.xlsx",
    sampleRows: [{ Thème: "Budget", Nom: "Dupont", Prénom: "Marie", Note: "Disponible le matin uniquement" }],
  },
};

export function initImport() {
  document.getElementById("modal-import-close").addEventListener("click", closeImport);
  document.getElementById("btn-import-cancel").addEventListener("click", closeImport);
  document.getElementById("btn-import-template").addEventListener("click", downloadTemplate);
  document.getElementById("btn-import-submit").addEventListener("click", runImport);
  document.getElementById("modal-import-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-import-overlay") closeImport();
  });
}

export function openImportModal(type, onImported) {
  currentType = type;
  onImportedCallback = onImported;
  const cfg = TEMPLATES[type];

  document.getElementById("modal-import-title").textContent = cfg.title;
  document.getElementById("import-instructions").textContent = cfg.instructions;
  document.getElementById("import-file").value = "";

  const resultEl = document.getElementById("import-result");
  resultEl.className = "hidden";
  resultEl.innerHTML = "";

  const submitBtn = document.getElementById("btn-import-submit");
  submitBtn.disabled = false;
  submitBtn.textContent = "Importer";

  openModal("modal-import-overlay");
}

function closeImport() {
  closeModal("modal-import-overlay");
}

function downloadTemplate() {
  const cfg = TEMPLATES[currentType];
  const ws = XLSX.utils.json_to_sheet(cfg.sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, cfg.sheetName);
  XLSX.writeFile(wb, cfg.fileName);
}

// ----- Helpers de normalisation des en-têtes de colonnes --------------------
function normalizeKey(s) {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}
function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}
function pick(normRow, candidates) {
  for (const c of candidates) {
    if (normRow[c] !== undefined && normRow[c] !== null && normRow[c] !== "") return String(normRow[c]).trim();
  }
  return "";
}

async function parseWorkbook(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

async function runImport() {
  const fileInput = document.getElementById("import-file");
  const file = fileInput.files[0];
  if (!file) {
    toast("Merci de sélectionner un fichier.", "error");
    return;
  }

  const submitBtn = document.getElementById("btn-import-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Import en cours...";

  try {
    const rows = await parseWorkbook(file);
    if (rows.length === 0) throw new Error("Le fichier ne contient aucune ligne de données.");

    let report;
    if (currentType === "annuaire") report = await importAnnuaire(rows);
    else if (currentType === "ressources") report = await importRessources(rows);
    else report = await importPersonnesRessources(rows);

    showReport(report);
    if (report.added > 0 && onImportedCallback) await onImportedCallback();
  } catch (err) {
    toast("Erreur d'import : " + err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Importer";
  }
}

function showReport(report) {
  const el = document.getElementById("import-result");
  el.className = "";
  const errorsHtml = report.errors
    .map((e) => `<li style="color:var(--rouge-marianne);">Ligne ${e.row} : ${escapeHtml(e.message)}</li>`)
    .join("");
  el.innerHTML = `
    <p style="color:var(--vert-succes);font-weight:600;margin:0 0 .4rem;">${report.added} ligne(s) importée(s) sur ${report.total}.</p>
    ${report.errors.length ? `<ul style="margin:0;padding-left:1.2rem;font-size:.85rem;">${errorsHtml}</ul>` : ""}
  `;
  if (report.added > 0) toast(`${report.added} ligne(s) importée(s).`, "success");
}

// ----- Import Annuaire -------------------------------------------------------
async function importAnnuaire(rows) {
  const report = { total: rows.length, added: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const n = normalizeRow(rows[i]);
    const nom = pick(n, ["nom"]);
    const prenom = pick(n, ["prenom"]);
    if (!nom || !prenom) {
      report.errors.push({ row: i + 2, message: "Nom et Prénom sont obligatoires." });
      continue;
    }
    const data = {
      nom,
      prenom,
      fonction: pick(n, ["fonction"]),
      etablissement: pick(n, ["etablissement"]),
      portable: pick(n, ["portable", "telephoneportable", "mobile", "tel", "telephone"]),
      fixe: pick(n, ["fixe", "lignefixe", "telephonefixe"]),
      mail: pick(n, ["mail", "email", "courriel"]),
    };
    try {
      await AnnuaireAPI.add(data);
      report.added++;
    } catch (err) {
      report.errors.push({ row: i + 2, message: err.message });
    }
  }
  return report;
}

// ----- Import Ressources ------------------------------------------------------
async function importRessources(rows) {
  const labelToId = new Map();
  THEMATIQUES_RESSOURCES.forEach((t) => {
    labelToId.set(normalizeKey(t.label), t.id);
    labelToId.set(normalizeKey(t.id), t.id);
  });

  const report = { total: rows.length, added: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const n = normalizeRow(rows[i]);
    const titre = pick(n, ["titre"]);
    const thematiqueRaw = pick(n, ["thematique"]);
    const url = pick(n, ["url", "lien"]);
    let type = pick(n, ["type"]).toLowerCase();
    const description = pick(n, ["description"]);

    if (!titre) {
      report.errors.push({ row: i + 2, message: "Le titre est obligatoire." });
      continue;
    }
    const thematique = labelToId.get(normalizeKey(thematiqueRaw));
    if (!thematique) {
      report.errors.push({ row: i + 2, message: `Thématique « ${thematiqueRaw} » inconnue.` });
      continue;
    }
    if (!type) type = url ? "lien" : "";
    if (!["lien", "pdf", "zip"].includes(type)) {
      report.errors.push({ row: i + 2, message: `Type « ${type} » invalide (attendu : lien, pdf ou zip).` });
      continue;
    }
    if (!url) {
      report.errors.push({ row: i + 2, message: "L'URL est obligatoire pour un import (fichier déjà hébergé en ligne)." });
      continue;
    }
    try {
      await RessourcesAPI.add({ titre, thematique, type, url, description, ajoutePar: "Import Excel" });
      report.added++;
    } catch (err) {
      report.errors.push({ row: i + 2, message: err.message });
    }
  }
  return report;
}

// ----- Import Personnes ressources --------------------------------------------
async function importPersonnesRessources(rows) {
  const [annuaire, themes] = await Promise.all([AnnuaireAPI.list(), ThemesReseauAPI.ensureDefaults()]);
  const personKey = (nom, prenom) => normalizeKey(nom) + "|" + normalizeKey(prenom);
  const personMap = new Map(annuaire.map((p) => [personKey(p.nom, p.prenom), p]));
  const themeMap = new Map(themes.map((t) => [normalizeKey(t.nom), t]));

  const report = { total: rows.length, added: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const n = normalizeRow(rows[i]);
    const themeNom = pick(n, ["theme"]);
    const nom = pick(n, ["nom"]);
    const prenom = pick(n, ["prenom"]);
    const note = pick(n, ["note"]);

    if (!themeNom || !nom || !prenom) {
      report.errors.push({ row: i + 2, message: "Thème, Nom et Prénom sont obligatoires." });
      continue;
    }
    const person = personMap.get(personKey(nom, prenom));
    if (!person) {
      report.errors.push({ row: i + 2, message: `Personne « ${prenom} ${nom} » introuvable dans l'Annuaire.` });
      continue;
    }
    let theme = themeMap.get(normalizeKey(themeNom));
    if (!theme) {
      try {
        const ref = await ThemesReseauAPI.add(themeNom);
        theme = { id: ref.id, nom: themeNom };
        themeMap.set(normalizeKey(themeNom), theme);
      } catch (err) {
        report.errors.push({ row: i + 2, message: "Impossible de créer le thème : " + err.message });
        continue;
      }
    }
    try {
      await PersonnesRessourcesAPI.add({ themeId: theme.id, annuaireId: person.id, note });
      report.added++;
    } catch (err) {
      report.errors.push({ row: i + 2, message: err.message });
    }
  }
  return report;
}
