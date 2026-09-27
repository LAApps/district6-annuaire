// ============================================================================
// Configuration Firebase — À REMPLIR avec les clés de VOTRE projet Firebase.
// Console : https://console.firebase.google.com  →  Paramètres du projet
//           →  Vos applications  →  Config SDK
// Ces valeurs ne sont pas secrètes (elles s'affichent côté navigateur), mais
// la sécurité réelle des données est assurée par les règles Firestore/Storage
// (voir firestore.rules et storage.rules) + l'authentification Google
// restreinte au domaine académique.
// ============================================================================

export const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJET.firebaseapp.com",
  projectId: "VOTRE_PROJET",
  storageBucket: "VOTRE_PROJET.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID",
};

// Domaine(s) autorisés à se connecter (adresses académiques).
// Utilisé côté client pour l'affichage ; la vraie restriction se fait dans
// firestore.rules / storage.rules (indispensable, ne pas s'appuyer que sur le JS).
export const ALLOWED_EMAIL_DOMAINS = ["ac-creteil.fr"];

// Adresse e-mail de l'administrateur de l'application (bouton "Contacter l'administrateur").
export const ADMIN_EMAIL = "administrateur.district6@ac-creteil.fr";

// Nom affiché dans l'en-tête.
export const APP_TITLE = "District 6 — Seine-Saint-Denis";
export const APP_SUBTITLE = "Espace des personnels d'encadrement";
