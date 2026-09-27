# District 6 — Application des personnels d'encadrement

Application web pour les personnels d'encadrement du **district 6 (Seine-Saint-Denis)** :

- **Annuaire** : nom, prénom, fonction, établissement, portable, fixe, mail. Chacun peut ajouter sa propre fiche et la modifier ; les administrateurs peuvent gérer toutes les fiches.
- **Ressources** : liens, PDF, ZIP classés par thématique (budget, DHG, management, montage de projet, IA, évaluations, syndicats, textes officiels, bulletins académiques, bulletins départementaux, courriers types, documents types). Consultation et téléchargement pour tous ; ajout/suppression réservés aux administrateurs. Contact administrateur.
- **Personnes ressources** : recherche par thème (budget, DHG, EDT, IA, bureautique/informatique, RH, gestion de crises, CPS, EVARS, évaluations nationales) → personnes à contacter (données reprises de l'Annuaire). Consultation pour tous ; chacun peut se déclarer soi-même comme personne ressource sur un thème existant (il faut d'abord avoir sa propre fiche dans l'Annuaire) ; création de thème et déclaration d'un·e collègue réservées aux administrateurs.
- **Import Excel** : chaque onglet dispose d'un bouton « Importer un fichier Excel » (+ un bouton pour télécharger un modèle vierge) permettant d'alimenter en masse l'annuaire, les ressources ou les personnes ressources depuis un fichier `.xlsx`/`.xls`/`.csv`.

Charte graphique : identité visuelle de l'État / Éducation nationale (bleu France `#000091`, rouge Marianne `#E1000F`, typographie Marianne).

## Architecture technique

C'est un site **100 % statique** (HTML/CSS/JS, aucune installation Node/npm requise) qui utilise **Firebase** (forfait gratuit **Spark**, aucune carte bancaire requise) comme backend partagé :

- **Firestore** : base de données (annuaire, ressources, thèmes, personnes ressources).
- **Firebase Authentication (e-mail + mot de passe)** : connexion restreinte aux adresses du domaine académique, pour protéger les données personnelles (téléphones, mails) des agents. Chaque personne crée son propre compte (adresse académique + mot de passe de son choix) directement dans l'application, sans dépendre d'un compte Google ni d'un e-mail envoyé automatiquement — les messageries académiques (`.gouv.fr` / Éducation nationale) bloquent souvent silencieusement les e-mails automatiques externes (testé et confirmé sur ce projet), ce qui rend inutilisables la connexion Google et le lien de connexion par e-mail.

Il n'y a volontairement **pas de Firebase Storage** (depuis fin 2024, Google exige un compte de facturation Blaze même pour le forfait gratuit de Storage). Les ressources de type PDF/ZIP ne sont donc pas uploadées dans l'application : on y renseigne l'URL d'un fichier déjà hébergé ailleurs (Drive, ENT, site académique…), exactement comme pour une ressource de type « lien ».

Cela permet de déployer le site tel quel sur **GitHub Pages** (ou tout hébergeur statique), sans serveur à maintenir et sans risque de facturation.

## 1. Créer le projet Firebase (gratuit, ~10 min, forfait Spark)

1. Aller sur <https://console.firebase.google.com> → **Ajouter un projet**.
2. Dans le projet : **Authentication** → Sign-in method → activer **E-mail/Mot de passe** (la première option, sans activer « Lien e-mail »).
3. **Firestore Database** → Créer une base → édition **Standard** → mode **production**.
4. **Paramètres du projet** (roue crantée) → **Vos applications** → **</> Web** → donner un nom → copier la config affichée.

## 2. Configurer l'application

Ouvrir [`assets/js/firebase-config.js`](assets/js/firebase-config.js) et :

- Coller les valeurs de config Firebase copiées à l'étape précédente.
- Adapter `ALLOWED_EMAIL_DOMAINS` (domaine(s) académique(s) autorisés à se connecter).
- Adapter `ADMIN_EMAIL` (adresse utilisée par le bouton « Contacter l'administrateur »).
- Adapter `ADMIN_EMAILS` (liste des adresses ayant les droits d'administration — voir section [Rôles](#rôles--administrateur-vs-utilisateur) ci-dessous).

**Important** : le domaine et la liste des administrateurs doivent être répétés à l'identique dans [`firestore.rules`](firestore.rules) (fonctions `isAcademicUser()` et `isAdmin()`) — c'est là qu'est la vraie barrière de sécurité, pas dans le JavaScript.

Copier ensuite le contenu de `firestore.rules` dans **Firestore Database → Règles** (bouton *Publier*).

Enfin, dans **Authentication → Paramètres → Domaines autorisés**, ajouter le domaine où le site sera hébergé (ex. `votre-utilisateur.github.io`).

## 3. Tester en local

Les modules JavaScript (`import`) nécessitent d'être servis via HTTP (pas `file://`). Depuis le dossier du projet :

```bash
python3 -m http.server 8080
```

Puis ouvrir <http://localhost:8080>. Pensez à ajouter `localhost` dans les domaines autorisés Firebase Auth si besoin (généralement déjà présent par défaut).

## 4. Déployer sur GitHub Pages

```bash
git init
git add .
git commit -m "Application District 6"
git branch -M main
git remote add origin https://github.com/<votre-utilisateur>/<votre-repo>.git
git push -u origin main
```

Puis, sur GitHub : **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`**. Le site sera servi à `https://<votre-utilisateur>.github.io/<votre-repo>/`.

N'oubliez pas d'ajouter cette URL (domaine `<votre-utilisateur>.github.io`) dans **Authentication → Settings → Domaines autorisés** côté Firebase (étape 2).

## Rôles : administrateur vs utilisateur

Il n'y a que deux niveaux d'accès, tous deux basés sur l'adresse e-mail du compte connecté :

- **Administrateur** (adresses listées dans `ADMIN_EMAILS`) : peut tout faire — importer un fichier Excel, ajouter/modifier/supprimer n'importe quelle ressource, thème, personne ressource, ou fiche annuaire.
- **Utilisateur standard** (toute autre adresse `@ac-creteil.fr`) : peut consulter l'annuaire, les ressources et les personnes ressources ; ajouter sa propre fiche annuaire et modifier/supprimer uniquement celle dont le champ « Mail » correspond à sa propre adresse de connexion ; se déclarer lui-même comme personne ressource sur un thème existant (nécessite d'avoir déjà sa fiche annuaire) et retirer sa propre déclaration. Les boutons réservés aux administrateurs sont automatiquement masqués dans l'interface.

**Pour ajouter un administrateur**, il faut modifier les **deux** endroits suivants (l'un sans l'autre ne suffit pas) :

1. `assets/js/firebase-config.js` → ajouter l'adresse dans le tableau `ADMIN_EMAILS` (contrôle l'affichage des boutons).
2. `firestore.rules` → ajouter la même adresse (en minuscules) dans la liste de la fonction `isAdmin()`, puis republier les règles dans la console Firebase (**Firestore Database → Règles → Publier**). C'est ce fichier qui fait réellement respecter la restriction, quel que soit ce qu'affiche l'interface.

## Modèle de données Firestore

| Collection | Champs principaux |
|---|---|
| `annuaire` | `nom`, `prenom`, `fonction`, `etablissement`, `portable`, `fixe`, `mail` |
| `ressources` | `titre`, `thematique`, `type` (`lien`\|`pdf`\|`zip`), `url`, `description`, `ajoutePar` |
| `themesReseau` | `nom` |
| `personnesRessources` | `themeId` (→ `themesReseau`), `annuaireId` (→ `annuaire`), `note` |

## Import Excel

Le bouton **Importer un fichier Excel** (présent sur les trois onglets) lit le fichier entièrement dans le navigateur via la librairie [SheetJS](https://sheetjs.com/) (chargée en CDN, aucune donnée n'est envoyée à un tiers) puis écrit chaque ligne valide dans Firestore. Un bouton **Télécharger le modèle Excel** génère un fichier d'exemple avec les bons en-têtes. Les noms de colonnes sont reconnus quelle que soit la casse ou les accents (« Prénom », « prenom », « PRENOM » sont équivalents).

| Onglet | Colonnes attendues | Règles |
|---|---|---|
| Annuaire | Nom, Prénom, Fonction, Établissement, Portable, Fixe, Mail | Nom et Prénom obligatoires |
| Ressources | Titre, Thématique, Type, URL, Description | Titre + Thématique (doit correspondre à une thématique existante) obligatoires. Type = `lien`, `pdf` ou `zip` (par défaut `lien` si une URL est fournie). Pour un PDF/ZIP, indiquez l'URL d'un fichier déjà hébergé ailleurs (Drive, site académique…) — l'application n'héberge pas de fichiers. |
| Personnes ressources | Thème, Nom, Prénom, Note | Le couple Nom + Prénom doit correspondre exactement à une fiche déjà présente dans l'Annuaire (importer l'annuaire en premier si besoin). Un thème inconnu est créé automatiquement. |

Après l'import, un rapport indique le nombre de lignes importées et détaille, ligne par ligne, les erreurs éventuelles (champ manquant, thématique inconnue, personne introuvable…).

## Limites connues / pistes d'évolution

- **Pas de vérification d'adresse e-mail à l'inscription** : comme les messageries académiques bloquent les e-mails automatiques de Firebase, aucun e-mail de confirmation n'est envoyé à la création d'un compte. Rien n'empêche donc techniquement quelqu'un de créer un compte avec l'adresse d'un·e collègue, qui pourrait alors modifier sa fiche — acceptable pour une petite équipe de confiance.
- **Mot de passe oublié = pas de récupération automatique** (même raison : pas d'e-mail de réinitialisation possible). Si quelqu'un perd son mot de passe, un administrateur du projet Firebase doit supprimer son compte manuellement dans **Authentication → Users** (la personne peut alors recréer un compte avec la même adresse) ; ses données dans l'Annuaire ne sont pas affectées, elles n'appartiennent pas à un compte en particulier.
- **Pas d'upload de fichiers** : choix volontaire pour rester sur le forfait gratuit Spark (voir plus haut). Si un jour le besoin d'upload direct se fait sentir, il suffit de passer le projet Firebase en forfait Blaze, de réactiver Firebase Storage et de restaurer la logique d'upload (facilement récupérable dans l'historique Git).
- **Police Marianne** : la vraie police officielle n'est pas incluse (fichiers à télécharger vous-même sur <https://www.systeme-de-design.gouv.fr/> et à déposer dans `assets/fonts/`) ; une police système proche est utilisée en attendant.
- **Contact administrateur** : implémenté via un simple lien `mailto:`, sans backend d'envoi d'e-mail.
- Aucune étape de build (pas de Node/npm) : c'est volontaire pour rester déployable tel quel n'importe où.
