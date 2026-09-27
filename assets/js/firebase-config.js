// ============================================================================
// Configuration Firebase — À REMPLIR avec les clés de VOTRE projet Firebase.
// Console : https://console.firebase.google.com  →  Paramètres du projet
//           →  Vos applications  →  Config SDK
// Ces valeurs ne sont pas secrètes (elles s'affichent côté navigateur), mais
// la sécurité réelle des données est assurée par les règles Firestore
// (voir firestore.rules) + l'authentification par lien e-mail restreinte
// au domaine académique.
// ============================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyCUqqkeXqoJTKZQoiUa_F-jpl9rLBIGmQ8",
  authDomain: "annuaired6.firebaseapp.com",
  projectId: "annuaired6",
  storageBucket: "annuaired6.firebasestorage.app",
  messagingSenderId: "233254619364",
  appId: "1:233254619364:web:5eea31b1d653a3e3f604f1",
};

// Domaine(s) autorisés à se connecter (adresses académiques).
// Utilisé côté client pour l'affichage ; la vraie restriction se fait dans
// firestore.rules / storage.rules (indispensable, ne pas s'appuyer que sur le JS).
export const ALLOWED_EMAIL_DOMAINS = ["ac-creteil.fr"];

// Adresse e-mail de l'administrateur de l'application (bouton "Contacter l'administrateur").
export const ADMIN_EMAIL = "lazzouzi@ac-creteil.fr";

// Adresses ayant les droits d'administration (import Excel, ajout/suppression
// de ressources, thèmes, personnes ressources, et modification de n'importe
// quelle fiche annuaire). Les autres utilisateurs ne peuvent modifier que
// leur propre fiche annuaire (celle dont le champ "mail" correspond à leur
// adresse de connexion).
// IMPORTANT : cette liste doit être répétée à l'identique dans firestore.rules
// (fonction isAdmin()) — c'est là qu'est la vraie barrière de sécurité.
export const ADMIN_EMAILS = ["lazzouzi@ac-creteil.fr"];

// Nom affiché dans l'en-tête.
export const APP_TITLE = "District 6 — Seine-Saint-Denis";
export const APP_SUBTITLE = "Espace des personnels d'encadrement";
