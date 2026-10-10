// ============================================================================
// Orchestration générale : authentification + navigation par onglets.
// ============================================================================

import {
  signup,
  login,
  logout,
  onUserChange,
  fetchRecoveryQuestion,
  resetPasswordWithAnswer,
  updateSecurityQuestion,
} from "./auth.js";
import { initAnnuaire } from "./annuaire.js";
import { initRessources } from "./ressources.js";
import { initContacts } from "./contacts.js";
import { initDepot } from "./depot.js";
import { initContactsDsden } from "./contactsDsden.js";
import { initImport } from "./import.js";
import { toast, openModal, closeModal, wireOverlayClose } from "./utils.js";

initImport();

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const loginError = document.getElementById("login-error");
const btnLogout = document.getElementById("btn-logout");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");

const initialized = { annuaire: false, ressources: false, contacts: false, depot: false, dsden: false };

// ----- Écran de connexion (e-mail + mot de passe) ----------------------------
const formAuth = document.getElementById("form-auth");
const submitBtn = document.getElementById("btn-auth-submit");
const toggleLink = document.getElementById("btn-toggle-mode");
const modeQuestion = document.getElementById("login-mode-question");
const passwordHint = document.getElementById("login-password-hint");
const securityFields = document.getElementById("signup-security-fields");
const securityQuestionInput = document.getElementById("login-security-question");
const securityAnswerInput = document.getElementById("login-security-answer");

let mode = "login"; // "login" | "signup"

function applyMode() {
  if (mode === "login") {
    submitBtn.textContent = "Se connecter";
    modeQuestion.textContent = "Pas encore de compte ?";
    toggleLink.textContent = "Créer un compte";
    passwordHint.classList.add("hidden");
    securityFields.classList.add("hidden");
    securityQuestionInput.required = false;
    securityAnswerInput.required = false;
  } else {
    submitBtn.textContent = "Créer mon compte";
    modeQuestion.textContent = "Déjà un compte ?";
    toggleLink.textContent = "Se connecter";
    passwordHint.classList.remove("hidden");
    securityFields.classList.remove("hidden");
    securityQuestionInput.required = true;
    securityAnswerInput.required = true;
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
      await signup(email, password, securityQuestionInput.value, securityAnswerInput.value);
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

// ----- Mot de passe oublié (récupération en libre-service) -------------------
const panelLoginSignup = document.getElementById("panel-login-signup");
const panelRecovery = document.getElementById("panel-recovery");
const recoveryStepEmail = document.getElementById("recovery-step-email");
const recoveryStepAnswer = document.getElementById("recovery-step-answer");
const btnShowRecovery = document.getElementById("btn-show-recovery");
const btnBackToLogin = document.getElementById("btn-back-to-login");
const formRecoveryEmail = document.getElementById("form-recovery-email");
const formRecoveryAnswer = document.getElementById("form-recovery-answer");
const recoveryQuestionDisplay = document.getElementById("recovery-question-display");
const recoverySubmitBtn = document.getElementById("btn-recovery-submit");

let recoveryEmail = "";

function showRecoveryPanel() {
  loginError.classList.add("hidden");
  panelLoginSignup.classList.add("hidden");
  panelRecovery.classList.remove("hidden");
  recoveryStepEmail.classList.remove("hidden");
  recoveryStepAnswer.classList.add("hidden");
  formRecoveryEmail.reset();
  formRecoveryAnswer.reset();
}

function showLoginPanel(prefillEmail) {
  loginError.classList.add("hidden");
  panelRecovery.classList.add("hidden");
  panelLoginSignup.classList.remove("hidden");
  mode = "login";
  applyMode();
  if (prefillEmail) document.getElementById("login-email").value = prefillEmail;
}

btnShowRecovery.addEventListener("click", (e) => {
  e.preventDefault();
  showRecoveryPanel();
});
btnBackToLogin.addEventListener("click", (e) => {
  e.preventDefault();
  showLoginPanel();
});

formRecoveryEmail.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  recoveryEmail = document.getElementById("recovery-email").value.trim();
  try {
    const question = await fetchRecoveryQuestion(recoveryEmail);
    recoveryQuestionDisplay.textContent = question;
    recoveryStepEmail.classList.add("hidden");
    recoveryStepAnswer.classList.remove("hidden");
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  }
});

formRecoveryAnswer.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const answer = document.getElementById("recovery-answer").value;
  const newPassword = document.getElementById("recovery-new-password").value;
  const confirmPassword = document.getElementById("recovery-new-password-confirm").value;

  if (newPassword !== confirmPassword) {
    loginError.textContent = "Les deux mots de passe ne correspondent pas.";
    loginError.classList.remove("hidden");
    return;
  }

  recoverySubmitBtn.disabled = true;
  try {
    await resetPasswordWithAnswer(recoveryEmail, answer, newPassword);
    toast("Mot de passe réinitialisé. Vous pouvez vous reconnecter.", "success");
    showLoginPanel(recoveryEmail);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  } finally {
    recoverySubmitBtn.disabled = false;
  }
});

// ----- Ma question secrète (pour les comptes déjà connectés) -----------------
const btnSecurityQuestion = document.getElementById("btn-security-question");
const formSecurityQuestion = document.getElementById("form-security-question");
wireOverlayClose("modal-security-question-overlay");

btnSecurityQuestion.addEventListener("click", () => {
  formSecurityQuestion.reset();
  openModal("modal-security-question-overlay");
});
document.getElementById("btn-security-question-cancel").addEventListener("click", () =>
  closeModal("modal-security-question-overlay")
);
document.getElementById("modal-security-question-close").addEventListener("click", () =>
  closeModal("modal-security-question-overlay")
);
formSecurityQuestion.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = formSecurityQuestion.elements["securityQuestion"].value;
  const answer = formSecurityQuestion.elements["securityAnswer"].value;
  try {
    await updateSecurityQuestion(question, answer);
    toast("Question secrète enregistrée.", "success");
    closeModal("modal-security-question-overlay");
  } catch (err) {
    toast("Erreur : " + err.message, "error");
  }
});

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
    if (btn.dataset.view === "depot" && !initialized.depot) {
      initialized.depot = true;
      initDepot().catch((err) => toast("Erreur d'initialisation Dépôt de documents : " + err.message, "error"));
    }
    if (btn.dataset.view === "dsden" && !initialized.dsden) {
      initialized.dsden = true;
      initContactsDsden().catch((err) => toast("Erreur d'initialisation Contacts DSDEN : " + err.message, "error"));
    }
  });
});
