// ============================================================================
// Orchestration générale : authentification + navigation par onglets.
// ============================================================================

import { signup, login, logout, onUserChange } from "./auth.js";
import { initAnnuaire } from "./annuaire.js";
import { initRessources } from "./ressources.js";
import { initContacts } from "./contacts.js";
import { initImport } from "./import.js";
import { toast } from "./utils.js";

initImport();

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const loginError = document.getElementById("login-error");
const btnLogout = document.getElementById("btn-logout");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");

const initialized = { annuaire: false, ressources: false, contacts: false };

// ----- Écran de connexion (e-mail + mot de passe) ----------------------------
const formAuth = document.getElementById("form-auth");
const submitBtn = document.getElementById("btn-auth-submit");
const toggleLink = document.getElementById("btn-toggle-mode");
const modeQuestion = document.getElementById("login-mode-question");
const passwordHint = document.getElementById("login-password-hint");

let mode = "login"; // "login" | "signup"

function applyMode() {
  if (mode === "login") {
    submitBtn.textContent = "Se connecter";
    modeQuestion.textContent = "Pas encore de compte ?";
    toggleLink.textContent = "Créer un compte";
    passwordHint.classList.add("hidden");
  } else {
    submitBtn.textContent = "Créer mon compte";
    modeQuestion.textContent = "Déjà un compte ?";
    toggleLink.textContent = "Se connecter";
    passwordHint.classList.remove("hidden");
  }
}
applyMode();

toggleLink.addEventListener("click", (e) => {
  e.preventDefault();
  mode = mode === "login" ? "signup" : "login";
  loginError.classList.add("hidden");
  applyMode();
});

formAuth.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  submitBtn.disabled = true;
  try {
    if (mode === "signup") {
      await signup(email, password);
    } else {
      await login(email, password);
    }
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
  }
});

btnLogout.addEventListener("click", () => logout());

onUserChange((user) => {
  if (user) {
    loginScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    userName.textContent = user.displayName || user.email;
    if (user.photoURL) {
      userAvatar.src = user.photoURL;
      userAvatar.classList.remove("hidden");
    }
    if (!initialized.annuaire) {
      initialized.annuaire = true;
      initAnnuaire().catch((err) => toast("Erreur d'initialisation Annuaire : " + err.message, "error"));
    }
  } else {
    loginScreen.classList.remove("hidden");
    appShell.classList.add("hidden");
  }
});

// ----- Navigation par onglets (initialisation paresseuse des modules) ------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`view-${btn.dataset.view}`).classList.add("active");

    if (btn.dataset.view === "ressources" && !initialized.ressources) {
      initialized.ressources = true;
      initRessources().catch((err) => toast("Erreur d'initialisation Ressources : " + err.message, "error"));
    }
    if (btn.dataset.view === "contacts" && !initialized.contacts) {
      initialized.contacts = true;
      initContacts().catch((err) => toast("Erreur d'initialisation Personnes ressources : " + err.message, "error"));
    }
  });
});
