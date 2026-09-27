# District 6 — Application des personnels d'encadrement

Application web pour les personnels d'encadrement du **district 6 (Seine-Saint-Denis)** :

- **Annuaire** : nom, prénom, fonction, établissement, portable, fixe, mail. Ajout et modification des fiches.
- **Ressources** : liens, PDF, ZIP classés par thématique (budget, DHG, management, montage de projet, IA, évaluations, syndicats, textes officiels, bulletins académiques, bulletins départementaux, courriers types, documents types). Téléchargement, ajout de ressource, contact administrateur.
- **Personnes ressources** : recherche par thème (budget, DHG, EDT, IA, bureautique/informatique, RH, gestion de crises, CPS, EVARS, évaluations nationales) → personnes à contacter (données reprises de l'Annuaire). Ajout de thème et de personne ressource.
- **Import Excel** : chaque onglet dispose d'un bouton « Importer un fichier Excel » (+ un bouton pour télécharger un modèle vierge) permettant d'alimenter en masse l'annuaire, les ressources ou les personnes ressources depuis un fichier `.xlsx`/`.xls`/`.csv`.

Charte graphique : identité visuelle de l'État / Éducation nationale (bleu France `#000091`, rouge Marianne `#E1000F`, typographie Marianne).

## Architecture technique

C'est un site **100 % statique** (HTML/CSS/JS, aucune installation Node/npm requise) qui utilise **Firebase** (gratuit) comme backend partagé :

- **Firestore** : base de données (annuaire, ressources, thèmes, personnes ressources).
- **Firebase Storage** : hébergement des fichiers PDF/ZIP uploadés.
- **Firebase Authentication (Google)** : connexion restreinte aux adresses du domaine académique, pour protéger les données personnelles (téléphones, mails) des agents.

Cela permet de déployer le site tel quel sur **GitHub Pages** (ou tout hébergeur statique), sans serveur à maintenir.

## 1. Créer le projet Firebase (gratuit, ~10 min)

1. Aller sur <https://console.firebase.google.com> → **Ajouter un projet**.
2. Dans le projet : **Authentication** → Sign-in method → activer **Google**.
3. **Firestore Database** → Créer une base → mode **production**.
4. **Storage** → Commencer (mode production).
5. **Paramètres du projet** (roue crantée) → **Vos applications** → **</> Web** → donner un nom → copier la config affichée.

## 2. Configurer l'application

Ouvrir [`assets/js/firebase-config.js`](assets/js/firebase-config.js) et :

- Coller les valeurs de config Firebase copiées à l'étape précédente.
- Adapter `ALLOWED_EMAIL_DOMAINS` (domaine(s) académique(s) autorisés à se connecter).
- Adapter `ADMIN_EMAIL` (adresse utilisée par le bouton « Contacter l'administrateur »).

**Important** : le même domaine doit être répété dans [`firestore.rules`](firestore.rules) et [`storage.rules`](storage.rules) (ligne `.matches('.*@ac-creteil[.]fr$')`) — c'est la vraie barrière de sécurité, pas le JavaScript.

Copier ensuite :

- le contenu de `firestore.rules` dans **Firestore Database → Règles** (bouton *Publier*) ;
- le contenu de `storage.rules` dans **Storage → Règles** (bouton *Publier*).

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

N'oubliez pas d'ajouter cette URL (domaine `<votre-utilisateur>.github.io`) dans **Authentication → Domaines autorisés** côté Firebase (étape 2), sinon la connexion Google échouera.

## Modèle de données Firestore

| Collection | Champs principaux |
|---|---|
| `annuaire` | `nom`, `prenom`, `fonction`, `etablissement`, `portable`, `fixe`, `mail` |
| `ressources` | `titre`, `thematique`, `type` (`lien`\|`pdf`\|`zip`), `url`, `storagePath`, `description`, `ajoutePar` |
| `themesReseau` | `nom` |
| `personnesRessources` | `themeId` (→ `themesReseau`), `annuaireId` (→ `annuaire`), `note` |

## Import Excel

Le bouton **Importer un fichier Excel** (présent sur les trois onglets) lit le fichier entièrement dans le navigateur via la librairie [SheetJS](https://sheetjs.com/) (chargée en CDN, aucune donnée n'est envoyée à un tiers) puis écrit chaque ligne valide dans Firestore. Un bouton **Télécharger le modèle Excel** génère un fichier d'exemple avec les bons en-têtes. Les noms de colonnes sont reconnus quelle que soit la casse ou les accents (« Prénom », « prenom », « PRENOM » sont équivalents).

| Onglet | Colonnes attendues | Règles |
|---|---|---|
| Annuaire | Nom, Prénom, Fonction, Établissement, Portable, Fixe, Mail | Nom et Prénom obligatoires |
| Ressources | Titre, Thématique, Type, URL, Description | Titre + Thématique (doit correspondre à une thématique existante) obligatoires. Type = `lien`, `pdf` ou `zip` (par défaut `lien` si une URL est fournie). **L'import ne permet pas de joindre un fichier** : pour un PDF/ZIP, indiquez l'URL d'un fichier déjà hébergé ailleurs (Drive, site académique…). |
| Personnes ressources | Thème, Nom, Prénom, Note | Le couple Nom + Prénom doit correspondre exactement à une fiche déjà présente dans l'Annuaire (importer l'annuaire en premier si besoin). Un thème inconnu est créé automatiquement. |

Après l'import, un rapport indique le nombre de lignes importées et détaille, ligne par ligne, les erreurs éventuelles (champ manquant, thématique inconnue, personne introuvable…).

## Limites connues / pistes d'évolution

- **Édition des fiches** : par simplicité, toute personne connectée (compte académique) peut modifier ou supprimer n'importe quelle fiche de l'annuaire — il n'y a pas de notion de « propriétaire » de fiche. Une évolution possible serait de stocker l'UID Firebase Auth sur chaque fiche et de n'autoriser la modification qu'à son propriétaire (+ un rôle « administrateur »).
- **Police Marianne** : la vraie police officielle n'est pas incluse (fichiers à télécharger vous-même sur <https://www.systeme-de-design.gouv.fr/> et à déposer dans `assets/fonts/`) ; une police système proche est utilisée en attendant.
- **Contact administrateur** : implémenté via un simple lien `mailto:`, sans backend d'envoi d'e-mail.
- Aucune étape de build (pas de Node/npm) : c'est volontaire pour rester déployable tel quel n'importe où.
