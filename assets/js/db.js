// ============================================================================
// Initialisation Firebase + helpers d'accès aux données.
// SDK chargé en ESM directement depuis le CDN Google — aucune installation
// (npm/node) n'est nécessaire pour faire fonctionner ce site.
// ============================================================================

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ----- Collections -----------------------------------------------------
const col = {
  annuaire: collection(db, "annuaire"),
  ressources: collection(db, "ressources"),
  themesReseau: collection(db, "themesReseau"),
  personnesRessources: collection(db, "personnesRessources"),
};

// ----- Listes fixes (thématiques des ressources) ------------------------
export const THEMATIQUES_RESSOURCES = [
  { id: "budget", label: "Budget" },
  { id: "dhg", label: "DHG" },
  { id: "management", label: "Management" },
  { id: "montage-projet", label: "Montage de projet" },
  { id: "ia", label: "Intelligence artificielle" },
  { id: "evaluations", label: "Évaluations" },
  { id: "syndicats", label: "Syndicats" },
  { id: "textes-officiels", label: "Textes officiels" },
  { id: "bulletins-academiques", label: "Bulletins académiques" },
  { id: "bulletins-departementaux", label: "Bulletins départementaux" },
  { id: "courriers-types", label: "Courriers types" },
  { id: "documents-types", label: "Documents types" },
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

// ----- Ressources ----------------------------------------------------------
export const RessourcesAPI = {
  list: () => genericList(col.ressources, "createdAt"),
  add: (data) => genericAdd(col.ressources, data),
  remove: async (item) => {
    if (item.storagePath) {
      try {
        await deleteObject(storageRef(storage, item.storagePath));
      } catch (e) {
        console.warn("Suppression fichier storage impossible :", e);
      }
    }
    return genericDelete(col.ressources, item.id);
  },
  uploadFile: async (file, thematiqueId) => {
    const path = `ressources/${thematiqueId}/${Date.now()}_${file.name}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file);
    const url = await getDownloadURL(ref);
    return { url, storagePath: path };
  },
};

// ----- Thèmes réseau + personnes ressources -------------------------------
export const ThemesReseauAPI = {
  list: () => genericList(col.themesReseau, "nom"),
  add: (nom) => genericAdd(col.themesReseau, { nom }),
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
