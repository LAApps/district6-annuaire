// ============================================================================
// Authentification — Connexion par lien e-mail (passwordless), restreinte
// au(x) domaine(s) académique(s). Adapté aux adresses académiques qui ne
// sont pas des comptes Google (ex. @ac-creteil.fr).
// La vraie barrière de sécurité est dans firestore.rules : ce fichier ne
// fait qu'offrir une expérience de connexion cohérente.
// ============================================================================

import { app } from "./db.js";
import { ALLOWED_EMAIL_DOMAINS } from "./firebase-config.js";
import {
  getAuth,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

export const auth = getAuth(app);

const STORAGE_KEY = "district6_email_for_signin";

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

// ----- Envoi du lien de connexion --------------------------------------------
export async function sendLoginLink(email) {
  if (!isAllowedDomain(email)) throw new Error(domainErrorMessage());
  const actionCodeSettings = {
    url: window.location.href.split("?")[0].split("#")[0],
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem(STORAGE_KEY, email);
}

// ----- Complétion de la connexion (retour depuis le lien reçu par mail) ------
export function isLoginLink() {
  return isSignInWithEmailLink(auth, window.location.href);
}

export async function completeLoginFromLink(emailOverride) {
  const email = emailOverride || window.localStorage.getItem(STORAGE_KEY);
  if (!email) {
    throw new Error("EMAIL_NEEDED");
  }
  if (!isAllowedDomain(email)) throw new Error(domainErrorMessage());

  const result = await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem(STORAGE_KEY);
  window.history.replaceState({}, document.title, window.location.pathname);
  return result.user;
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
