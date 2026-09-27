// ============================================================================
// Authentification — Connexion Google restreinte au(x) domaine(s) académique(s).
// La vraie barrière de sécurité est dans firestore.rules / storage.rules :
// ce fichier ne fait qu'offrir une expérience de connexion cohérente et un
// message clair si un compte hors domaine tente de se connecter.
// ============================================================================

import { app } from "./db.js";
import { ALLOWED_EMAIL_DOMAINS } from "./firebase-config.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

export const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAINS[0] || "" });

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

export async function login() {
  const result = await signInWithPopup(auth, provider);
  const email = result.user.email || "";
  if (!isAllowedDomain(email)) {
    await signOut(auth);
    throw new Error(
      `Ce compte (${email}) n'appartient pas au domaine académique autorisé (${ALLOWED_EMAIL_DOMAINS.join(", ")}).`
    );
  }
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
