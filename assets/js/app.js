// ============================================================================
// Orchestration générale : authentification + navigation par onglets.
// ============================================================================

import { login, logout, onUserChange } from "./auth.js";
import { initAnnuaire } from "./annuaire.js";
import { initRessources } from "./ressources.js";
import { initContacts } from "./contacts.js";
import { initImport } from "./import.js";
import { toast } from "./utils.js";

initImport();

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const loginError = document.getElementById("login-error");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");

const initialized = { annuaire: false, ressources: false, contacts: false };

btnLogin.addEventListener("click", async () => {
  loginError.classList.add("hidden");
  btnLogin.disabled = true;
  try {
    await login();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  } finally {
    btnLogin.disabled = false;
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
