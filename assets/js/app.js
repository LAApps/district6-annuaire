// ============================================================================
// Orchestration générale : authentification + navigation par onglets.
// ============================================================================

import { sendLoginLink, isLoginLink, completeLoginFromLink, logout, onUserChange } from "./auth.js";
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

// ----- Écran de connexion (lien e-mail) --------------------------------------
const loginSteps = {
  request: document.getElementById("login-step-request"),
  sent: document.getElementById("login-step-sent"),
  confirm: document.getElementById("login-step-confirm"),
  loading: document.getElementById("login-step-loading"),
};
function showLoginStep(name) {
  Object.values(loginSteps).forEach((el) => el.classList.add("hidden"));
  loginSteps[name].classList.remove("hidden");
}
function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.remove("hidden");
}

document.getElementById("form-login-request").addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const email = document.getElementById("login-email").value.trim();
  try {
    await sendLoginLink(email);
    document.getElementById("login-sent-email").textContent = email;
    showLoginStep("sent");
  } catch (err) {
    showLoginError(err.message);
  }
});

document.getElementById("btn-resend-link").addEventListener("click", () => {
  loginError.classList.add("hidden");
  showLoginStep("request");
});

document.getElementById("form-login-confirm").addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const email = document.getElementById("login-confirm-email").value.trim();
  showLoginStep("loading");
  try {
    await completeLoginFromLink(email);
  } catch (err) {
    showLoginError(err.message);
    showLoginStep("confirm");
  }
});

// Retour depuis le lien reçu par e-mail
if (isLoginLink()) {
  showLoginStep("loading");
  completeLoginFromLink().catch((err) => {
    if (err.message === "EMAIL_NEEDED") {
      showLoginStep("confirm");
    } else {
      showLoginError(err.message);
      showLoginStep("request");
    }
  });
}

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
