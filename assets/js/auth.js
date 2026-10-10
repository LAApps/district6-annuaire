// ============================================================================
// Authentification — E-mail + mot de passe, restreinte au(x) domaine(s)
// académique(s). Pas de lien envoyé par e-mail : les messageries académiques
// (@ac-creteil.fr) bloquent silencieusement les e-mails automatiques de
// Firebase, rendant la connexion par lien e-mail inutilisable ici.
// La vraie barrière de sécurité est dans firestore.rules : ce fichier ne
// fait qu'offrir une expérience de connexion cohérente.
// ============================================================================

import { app, RecoverySecretsAPI } from "./db.js";
import { ALLOWED_EMAIL_DOMAINS, ADMIN_EMAILS, CALENDRIER_EDITOR_EMAIL } from "./firebase-config.js";
import { RECOVERY_API_BASE_URL } from "./recovery-config.js";
import { sha256Hex } from "./utils.js";
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

export async function signup(email, password, securityQuestion, securityAnswer) {
  if (!isAllowedDomain(email)) throw new Error(domainErrorMessage());
  if (!securityQuestion || !securityAnswer) {
    throw new Error("La question secrète et sa réponse sont obligatoires (pour pouvoir récupérer votre compte en cas d'oubli).");
  }
  let user;
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    user = result.user;
  } catch (err) {
    throw new Error(friendlyError(err));
  }
  try {
    const answerHash = await sha256Hex(securityAnswer.trim().toLowerCase());
    await RecoverySecretsAPI.set(email, securityQuestion.trim(), answerHash);
  } catch (err) {
    throw new Error(
      "Compte créé, mais la question secrète n'a pas pu être enregistrée (" +
        err.message +
        "). Contactez l'administrateur si vous perdez votre mot de passe."
    );
  }
  return user;
}

// Permet à un utilisateur déjà connecté de définir ou changer sa question
// secrète (utile pour les comptes créés avant l'ajout de cette fonctionnalité).
export async function updateSecurityQuestion(securityQuestion, securityAnswer) {
  if (!currentUser) throw new Error("Vous devez être connecté·e.");
  if (!securityQuestion || !securityAnswer) {
    throw new Error("La question et la réponse sont obligatoires.");
  }
  const answerHash = await sha256Hex(securityAnswer.trim().toLowerCase());
  await RecoverySecretsAPI.set(currentUser.email, securityQuestion.trim(), answerHash);
}

// ----- Récupération de mot de passe en libre-service (sans administrateur) ---
// Passe par une petite fonction serveur (Vercel) qui vérifie la réponse à la
// question secrète puis réinitialise le mot de passe via le SDK Admin
// Firebase. Voir api/get-question.js, api/reset-password.js et la section
// « Mot de passe oublié » du README pour la configuration.

async function callRecoveryApi(path, body) {
  if (!RECOVERY_API_BASE_URL || RECOVERY_API_BASE_URL === "VOTRE_URL_VERCEL") {
    throw new Error(
      "La récupération de mot de passe en libre-service n'est pas encore configurée. Contactez l'administrateur."
    );
  }
  const res = await fetch(`${RECOVERY_API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Erreur lors de la communication avec le serveur de récupération.");
  }
  return data;
}

export function fetchRecoveryQuestion(email) {
  return callRecoveryApi("/api/get-question", { email }).then((data) => data.question);
}

export function resetPasswordWithAnswer(email, answer, newPassword) {
  if (!isAllowedDomain(email)) throw new Error(domainErrorMessage());
  if (newPassword.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
  return callRecoveryApi("/api/reset-password", { email, answer, newPassword });
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

// Contrôle d'affichage côté client uniquement — la vraie restriction est
// dans firestore.rules (fonction isAdmin()), qui doit lister les mêmes adresses.
export function isCurrentUserAdmin() {
  const email = currentUser && currentUser.email;
  if (!email) return false;
  return ADMIN_EMAILS.some((a) => a.toLowerCase() === email.toLowerCase());
}

// Contrôle d'affichage côté client uniquement — la vraie restriction est
// dans firestore.rules (fonction isCalendrierEditor()). Volontairement
// indépendant de isCurrentUserAdmin() : seule cette adresse gère le Calendrier.
export function isCalendrierEditor() {
  const email = currentUser && currentUser.email;
  if (!email) return false;
  return email.toLowerCase() === CALENDRIER_EDITOR_EMAIL.toLowerCase();
}

export function isOwnAnnuaireEntry(entry) {
  const email = currentUser && currentUser.email;
  if (!email || !entry || !entry.mail) return false;
  return entry.mail.toLowerCase() === email.toLowerCase();
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
