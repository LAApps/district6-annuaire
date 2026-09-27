// ============================================================================
// Authentification — E-mail + mot de passe, restreinte au(x) domaine(s)
// académique(s). Pas de lien envoyé par e-mail : les messageries académiques
// (@ac-creteil.fr) bloquent silencieusement les e-mails automatiques de
// Firebase, rendant la connexion par lien e-mail inutilisable ici.
// La vraie barrière de sécurité est dans firestore.rules : ce fichier ne
// fait qu'offrir une expérience de connexion cohérente.
// ============================================================================

import { app } from "./db.js";
import { ALLOWED_EMAIL_DOMAINS } from "./firebase-config.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

export const auth = getAuth(app);

let currentUser = null;
const listeners = [];

export function onUserChange(cb) {
  listeners.push(cb);
  cb(currentUser);
}
function notify() {
  listeners.forEach((cb) => cb(currentUser));
}

function isAllowedDomain(email) {
  if (!email) return false;
  if (!ALLOWED_EMAIL_DOMAINS || ALLOWED_EMAIL_DOMAINS.length === 0) return true;
  return ALLOWED_EMAIL_DOMAINS.some((domain) => email.toLowerCase().endsWith("@" + domain.toLowerCase()));
}

function domainErrorMessage() {
  return `Seules les adresses ${ALLOWED_EMAIL_DOMAINS.join(", ")} sont autorisées à se connecter.`;
}

const ERROR_MESSAGES = {
  "auth/email-already-in-use": "Un compte existe déjà avec cette adresse. Utilisez plutôt « Se connecter ».",
  "auth/invalid-email": "Adresse e-mail invalide.",
  "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
  "auth/wrong-password": "Mot de passe incorrect.",
  "auth/user-not-found": "Aucun compte ne correspond à cette adresse. Utilisez « Créer un compte ».",
  "auth/invalid-credential": "Adresse ou mot de passe incorrect.",
  "auth/too-many-requests": "Trop de tentatives. Réessayez dans quelques minutes.",
};

function friendlyError(err) {
  return ERROR_MESSAGES[err.code] || err.message;
}

export async function signup(email, password) {
  if (!isAllowedDomain(email)) throw new Error(domainErrorMessage());
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

export async function login(email, password) {
  if (!isAllowedDomain(email)) throw new Error(domainErrorMessage());
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (err) {
    throw new Error(friendlyError(err));
  }
}

export function logout() {
  return signOut(auth);
}

export function getCurrentUser() {
  return currentUser;
}

onAuthStateChanged(auth, (user) => {
  if (user && !isAllowedDomain(user.email || "")) {
    signOut(auth);
    currentUser = null;
  } else {
    currentUser = user;
  }
  notify();
});
