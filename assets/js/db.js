// ============================================================================
// Initialisation Firebase + helpers d'accès aux données.
// SDK chargé en ESM directement depuis le CDN Google — aucune installation
// (npm/node) n'est nécessaire pour faire fonctionner ce site.
// ============================================================================

import { firebaseConfig } from "./firebase-config.js";
import { IA_IPR_REFERENTS_SEED, IA_IPR_SECTEURS_SEED } from "./iaIprData.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ----- Collections -----------------------------------------------------
const col = {
  annuaire: collection(db, "annuaire"),
  themesReseau: collection(db, "themesReseau"),
  personnesRessources: collection(db, "personnesRessources"),
  documents: collection(db, "documents"),
  contactsDsden: collection(db, "contactsDsden"),
  categoriesDepot: collection(db, "categoriesDepot"),
  recoverySecrets: collection(db, "recoverySecrets"),
  evenements: collection(db, "evenements"),
  iaIprReferents: collection(db, "iaIprReferents"),
  iaIprSecteurs: collection(db, "iaIprSecteurs"),
};

// Villes du district (menu déroulant de la fiche Annuaire).
export const VILLES_DISTRICT = ["BAGNOLET", "NOISY LE SEC", "MONTREUIL", "ROMAINVILLE", "ROSNY-SOUS-BOIS"];

// Fonctions possibles (menu déroulant de la fiche Annuaire).
export const FONCTIONS_DISTRICT = [
  "Chef.fe d'établissement",
  "Chef.fe d'établissement adjoint.e",
  "Secrétaire générale",
  "IEN",
  "DCIO",
  "IA IPR",
  "IA IPR EVS",
  "Coordos MLDS",
  "CT AS",
  "DDFPT",
];

// Établissements du district (menu déroulant de la fiche Annuaire), classés
// par catégorie (collèges, puis lycées, puis le reste) et par ordre
// alphabétique au sein de chaque catégorie.
export const ETABLISSEMENTS_DISTRICT = [
  // Collèges
  "COLLEGE ALBERT CAMUS",
  "COLLEGE CESARIA EVORA",
  "COLLEGE COLONEL FABIEN",
  "COLLEGE FRANCOISE HERITTIER",
  "COLLEGE GEORGES POLITZER",
  "COLLEGE GUSTAVE COURBET",
  "COLLEGE JACQUES PREVERT",
  "COLLEGE JEAN JAURES",
  "COLLEGE JEAN MOULIN",
  "COLLEGE LANGEVIN WALLON",
  "COLLEGE MARAIS DE VILLIERS",
  "COLLEGE MARCELIN BERTHELOT",
  "COLLEGE OLYMPE DE GOUGES",
  "COLLEGE OUM KALTHOUM",
  "COLLEGE PAUL ELUARD",
  "COLLEGE PIERRE-ANDRE HOUEL",
  "COLLEGE RENE CASSIN",
  "COLLEGE SAINT-EXUPERY",
  "COLLEGE SOLVEIG-ANSPACH",
  "COLLEGE TRAVAIL LANGEVIN",
  // Lycées
  "LYC GT CHARLES DE GAULLE",
  "LYC POLYV CONDORCET",
  "LYC POLYV EUGENE HENAFF",
  "LYC POLYV EUGENIE COTTON",
  "LYC GT JEAN JAURES",
  "LYC PROF JEAN MOULIN",
  "LYC POLYV L'HORTICULTURE ET PAYSAGE",
  "LYC POLYV LIBERTE",
  "LYC GT OLYMPE DE GOUGES",
  "LYC PROF THEODORE MONOD",
  // Autres structures
  "CIO MONTREUIL",
  "CIO NOISY LE SEC",
  "CT Assist. Soc.",
  "IA IPR",
  "IEN",
  "IEN-IO",
];

// Thèmes réseau par défaut (créés automatiquement si la collection est vide).
export const THEMES_RESEAU_DEFAUT = [
  "Budget",
  "DHG",
  "EDT",
  "IA",
  "Bureautique / Informatique",
  "RH",
  "Gestion de crises",
  "CPS",
  "EVARS",
  "Évaluations nationales",
];

// Catégories par défaut de la bibliothèque du Dépôt de documents (créées
// automatiquement si la collection est vide).
export const CATEGORIES_DEPOT_DEFAUT = [
  "Courriers types",
  "Examens collège",
  "Examens LGT",
  "Examens LP",
  "Bulletin académique",
  "Syndicats",
  "DHG",
  "Budget",
  "Infographies",
];

async function genericAdd(colRef, data) {
  return addDoc(colRef, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
async function genericUpdate(colRef, id, data) {
  return updateDoc(doc(colRef, id), { ...data, updatedAt: serverTimestamp() });
}
async function genericDelete(colRef, id) {
  return deleteDoc(doc(colRef, id));
}
async function genericList(colRef, orderField = "createdAt") {
  const snap = await getDocs(query(colRef, orderBy(orderField, "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ----- Annuaire ----------------------------------------------------------
export const AnnuaireAPI = {
  list: () => genericList(col.annuaire, "nom"),
  add: (data) => genericAdd(col.annuaire, data),
  update: (id, data) => genericUpdate(col.annuaire, id, data),
  remove: (id) => genericDelete(col.annuaire, id),
};

// ----- Thèmes réseau + personnes ressources -------------------------------
export const ThemesReseauAPI = {
  list: () => genericList(col.themesReseau, "nom"),
  add: (nom) => genericAdd(col.themesReseau, { nom }),
  remove: (id) => genericDelete(col.themesReseau, id),
  ensureDefaults: async () => {
    const existing = await genericList(col.themesReseau, "nom");
    if (existing.length > 0) return existing;
    for (const nom of THEMES_RESEAU_DEFAUT) {
      await genericAdd(col.themesReseau, { nom });
    }
    return genericList(col.themesReseau, "nom");
  },
};

export const PersonnesRessourcesAPI = {
  list: () => genericList(col.personnesRessources, "createdAt"),
  add: (data) => genericAdd(col.personnesRessources, data),
  remove: (id) => genericDelete(col.personnesRessources, id),
};

// ----- Dépôt de documents ----------------------------------------------------
// Contributions libres (lien ou fichier hébergé sur Cloudinary) de tous les
// utilisateurs. Voir assets/js/depot.js et assets/js/cloudinary-config.js.
export const DocumentsAPI = {
  list: () => genericList(col.documents, "createdAt"),
  add: (data) => genericAdd(col.documents, data),
  remove: (id) => genericDelete(col.documents, id),
};

// ----- Catégories du Dépôt de documents (bibliothèque) ------------------------
export const CategoriesDepotAPI = {
  list: () => genericList(col.categoriesDepot, "nom"),
  add: (nom) => genericAdd(col.categoriesDepot, { nom }),
  ensureDefaults: async () => {
    const existing = await genericList(col.categoriesDepot, "nom");
    if (existing.length > 0) return existing;
    for (const nom of CATEGORIES_DEPOT_DEFAUT) {
      await genericAdd(col.categoriesDepot, { nom });
    }
    return genericList(col.categoriesDepot, "nom");
  },
};

// ----- Question secrète de récupération de mot de passe ----------------------
// Document ID = adresse e-mail en minuscules. Jamais lisible depuis le client
// (voir firestore.rules) : seule la fonction serveur (api/get-question.js,
// api/reset-password.js, avec les droits Admin SDK) peut la lire.
export const RecoverySecretsAPI = {
  set: (email, question, answerHash) =>
    setDoc(doc(col.recoverySecrets, email.trim().toLowerCase()), {
      email: email.trim().toLowerCase(),
      question,
      answerHash,
      attempts: [],
      updatedAt: serverTimestamp(),
    }),
};

// ----- Contacts DSDEN / Rectorat ----------------------------------------------
export const ContactsDsdenAPI = {
  list: () => genericList(col.contactsDsden, "service"),
  add: (data) => genericAdd(col.contactsDsden, data),
  update: (id, data) => genericUpdate(col.contactsDsden, id, data),
  remove: (id) => genericDelete(col.contactsDsden, id),
};

// ----- Calendrier --------------------------------------------------------------
// Événements du district. Consultation pour tous ; création/modification/
// suppression réservées aux administrateurs (voir assets/js/calendrier.js).
export const EvenementsAPI = {
  list: () => genericList(col.evenements, "dateDebut"),
  add: (data) => genericAdd(col.evenements, data),
  update: (id, data) => genericUpdate(col.evenements, id, data),
  remove: (id) => genericDelete(col.evenements, id),
};

// Identifiant de document stable à partir d'une clé texte (supprime les
// accents, met en minuscules, remplace tout caractère non alphanumérique
// par un tiret). Permet un amorçage réessayable par setDoc (voir plus bas) :
// relancer l'amorçage ne duplique jamais rien et complète seulement ce qui
// manque encore, même si un chargement précédent a été interrompu en cours
// de route (page rechargée/fermée avant la fin des ~120 écritures).
function slugify(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ----- IA-IPR (référents par ville / discipline) ------------------------------
// Fiches des référent·es IA-IPR (nom, prénom, téléphone, mail — même format
// que les autres fiches de l'application), reliées à une ville + discipline
// via iaIprSecteurs. Données d'amorçage extraites de la note d'information
// « Répartition des secteurs » (voir assets/js/iaIprData.js), créées avec un
// identifiant déterministe pour que l'amorçage soit réessayable sans jamais
// dupliquer : à chaque chargement par un administrateur, seules les fiches ou
// associations encore manquantes sont (re)créées. Ensuite, les fiches restent
// modifiables normalement ; consultation ouverte à tous.
export const IaIprReferentsAPI = {
  list: () => genericList(col.iaIprReferents, "nom"),
  add: (data) => genericAdd(col.iaIprReferents, data),
  update: (id, data) => genericUpdate(col.iaIprReferents, id, data),
  remove: (id) => genericDelete(col.iaIprReferents, id),
};

export const IaIprSecteursAPI = {
  list: () => genericList(col.iaIprSecteurs, "ville"),
  // Complète les deux collections (référents, puis secteurs qui les
  // référencent) avec tout ce qui manque encore, puis renvoie l'état courant
  // des deux ainsi qu'un indicateur signalant si une écriture a eu lieu.
  ensureDefaults: async () => {
    const keyToId = new Map(IA_IPR_REFERENTS_SEED.map((r) => [r.key, `ref-${slugify(r.key)}`]));

    let referents = await genericList(col.iaIprReferents, "nom");
    const existingRefIds = new Set(referents.map((r) => r.id));
    let wroteReferents = false;
    for (const r of IA_IPR_REFERENTS_SEED) {
      const id = keyToId.get(r.key);
      if (existingRefIds.has(id)) continue;
      await setDoc(doc(col.iaIprReferents, id), {
        nom: r.nom,
        prenom: r.prenom,
        telephone: "",
        mail: r.mail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      wroteReferents = true;
    }
    if (wroteReferents) referents = await genericList(col.iaIprReferents, "nom");

    let secteurs = await genericList(col.iaIprSecteurs, "ville");
    const existingSecteurIds = new Set(secteurs.map((s) => s.id));
    let wroteSecteurs = false;
    for (const s of IA_IPR_SECTEURS_SEED) {
      const referentId = keyToId.get(s.referentKey);
      if (!referentId) continue;
      const id = `sec-${slugify(s.ville)}__${slugify(s.discipline)}`;
      if (existingSecteurIds.has(id)) continue;
      await setDoc(doc(col.iaIprSecteurs, id), {
        ville: s.ville,
        discipline: s.discipline,
        referentId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      wroteSecteurs = true;
    }
    if (wroteSecteurs) secteurs = await genericList(col.iaIprSecteurs, "ville");

    return { referents, secteurs, seededNow: wroteReferents || wroteSecteurs };
  },
};
