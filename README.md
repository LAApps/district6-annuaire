# District 6 — Application des personnels d'encadrement

Application web pour les personnels d'encadrement du **district 6 (Seine-Saint-Denis)** :

- **Annuaire** : nom, prénom, fonction, établissement, portable, fixe, mail. Chacun peut ajouter sa propre fiche et la modifier ; les administrateurs peuvent gérer toutes les fiches, les supprimer directement depuis le tableau (utile pour retirer les personnes qui quittent le district) et exporter l'annuaire complet en un clic (bouton « Exporter en Excel »). Depuis la fiche, chacun peut aussi cocher les thèmes pour lesquels il/elle souhaite apparaître comme personne ressource — ça alimente automatiquement l'onglet Personnes ressources, sans passer par ce dernier.
- **Ressources** : liens, PDF, ZIP classés par thématique (budget, DHG, management, montage de projet, IA, évaluations, syndicats, textes officiels, bulletins académiques, bulletins départementaux, courriers types, documents types). Consultation et téléchargement pour tous ; ajout/suppression réservés aux administrateurs. Contact administrateur.
- **Personnes ressources** : recherche par thème (budget, DHG, EDT, IA, bureautique/informatique, RH, gestion de crises, CPS, EVARS, évaluations nationales) → personnes à contacter (données reprises de l'Annuaire). Consultation pour tous ; chacun peut se déclarer soi-même comme personne ressource sur un thème existant (il faut d'abord avoir sa propre fiche dans l'Annuaire) ; création de thème et déclaration d'un·e collègue réservées aux administrateurs.
- **Dépôt de documents** : bibliothèque classée par catégorie (Courriers types, Examens collège, Examens LGT, Examens LP, Bulletin académique, Syndicats, DHG, Budget, Infographies par défaut — les administrateurs peuvent en ajouter d'autres à tout moment). Contribution libre, ouverte à tous — chacun peut déposer un lien ou un fichier (PDF, Word, Excel, JPEG, PNG ; 10 Mo maximum) dans la catégorie de son choix. Un avertissement RGPD rappelle que le déposant reste seul responsable du contenu partagé. Chacun peut retirer sa propre contribution ; les administrateurs peuvent retirer n'importe laquelle.
- **Contacts DSDEN/Rectorat** : annuaire institutionnel (service, nom, prénom, fonction, téléphone, mail). Consultation pour tous ; ajout, modification, suppression et import Excel réservés aux administrateurs.
- **Import Excel** : les onglets Annuaire, Ressources, Personnes ressources et Contacts DSDEN/Rectorat disposent d'un bouton « Importer un fichier Excel » (+ un bouton pour télécharger un modèle vierge) permettant d'alimenter en masse les données depuis un fichier `.xlsx`/`.xls`/`.csv`.
- **Mot de passe oublié en libre-service** : à la création du compte, chacun définit une question secrète. En cas d'oubli du mot de passe, il suffit de répondre correctement à sa question pour en choisir un nouveau, sans intervention d'un administrateur. Nécessite une petite fonction serveur (Vercel, gratuit) — voir la section dédiée plus bas.

Charte graphique : identité visuelle de l'État / Éducation nationale (bleu France `#000091`, rouge Marianne `#E1000F`, typographie Marianne).

## Architecture technique

C'est un site **100 % statique** (HTML/CSS/JS, aucune installation Node/npm requise) qui utilise **Firebase** (forfait gratuit **Spark**, aucune carte bancaire requise) comme backend partagé :

- **Firestore** : base de données (annuaire, ressources, thèmes, personnes ressources).
- **Firebase Authentication (e-mail + mot de passe)** : connexion restreinte aux adresses du domaine académique, pour protéger les données personnelles (téléphones, mails) des agents. Chaque personne crée son propre compte (adresse académique + mot de passe de son choix) directement dans l'application, sans dépendre d'un compte Google ni d'un e-mail envoyé automatiquement — les messageries académiques (`.gouv.fr` / Éducation nationale) bloquent souvent silencieusement les e-mails automatiques externes (testé et confirmé sur ce projet), ce qui rend inutilisables la connexion Google et le lien de connexion par e-mail.

Il n'y a volontairement **pas de Firebase Storage** (depuis fin 2024, Google exige un compte de facturation Blaze même pour le forfait gratuit de Storage). Les ressources de type PDF/ZIP ne sont donc pas uploadées dans l'application : on y renseigne l'URL d'un fichier déjà hébergé ailleurs (Drive, ENT, site académique…), exactement comme pour une ressource de type « lien ».

Le **Dépôt de documents** est la seule rubrique à proposer un vrai upload de fichier depuis l'application. Il utilise **Cloudinary** (forfait gratuit, 25 Go, aucune carte bancaire) via un « upload preset non signé » appelé directement depuis le navigateur — voir [`assets/js/cloudinary-config.js`](assets/js/cloudinary-config.js) et la section [Dépôt de documents](#dépôt-de-documents--cloudinary) ci-dessous.

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

## Dépôt de documents — Cloudinary

Pour que le bouton **+ Déposer un document** (upload de fichier) fonctionne, il faut un compte Cloudinary gratuit :

1. Créer un compte sur <https://cloudinary.com/users/register/free> (aucune carte bancaire demandée).
2. Noter le **Cloud name** affiché sur le tableau de bord.
3. Aller dans **Settings → Upload → Upload presets → Add upload preset** et créer un preset :
   - **Signing Mode : Unsigned** (indispensable, sinon l'upload depuis le navigateur échoue).
   - **Max file size : 10 000 000** (10 Mo — à garder identique à `MAX_FILE_SIZE_BYTES`, voir ci-dessous).
   - **Allowed formats : pdf,doc,docx,xls,xlsx,jpg,jpeg,png**.
   - Un dossier (**Folder**) dédié, par ex. `district6`, est recommandé pour s'y retrouver dans la médiathèque Cloudinary.
4. Ouvrir [`assets/js/cloudinary-config.js`](assets/js/cloudinary-config.js) et renseigner `CLOUDINARY_CLOUD_NAME` et `CLOUDINARY_UPLOAD_PRESET` avec les valeurs ci-dessus.

**À savoir** : un upload preset non signé est par nature public — son nom est visible dans le code source de l'application. N'importe qui le découvrant pourrait théoriquement envoyer des fichiers vers votre compte Cloudinary (en restant dans les limites de taille/format définies dans le preset). C'est un compromis accepté pour éviter toute carte bancaire ; en cas d'abus constaté, il suffit de supprimer/recréer le preset dans Cloudinary. Les documents retirés depuis l'application (bouton « Retirer ») disparaissent de la liste mais **restent stockés sur Cloudinary** (la suppression réelle du fichier nécessite une clé API signée, volontairement absente du code côté client) — à nettoyer manuellement dans la médiathèque Cloudinary si besoin.

## Mot de passe oublié — réinitialisation en libre-service

Firebase ne permet de réinitialiser un mot de passe que de deux façons : par e-mail (bloqué ici par les messageries académiques, voir plus haut) ou via un serveur disposant des droits d'administration Firebase. Comme l'application n'a pas de serveur, cette fonctionnalité utilise **Vercel** (hébergement gratuit de fonctions serveur, aucune carte bancaire requise) pour héberger deux petites fonctions :

- `api/get-question.js` : renvoie la question secrète associée à un e-mail.
- `api/reset-password.js` : vérifie la réponse (comparaison de hash SHA-256, jamais en clair) puis change le mot de passe via le SDK Admin Firebase. Limité à 5 tentatives par heure et par compte.

**⚠️ Ces fonctions utilisent une clé de compte de service Firebase, qui donne un accès administrateur complet à votre projet (lecture/écriture/suppression de toutes les données, contournement de toutes les règles Firestore). Cette clé ne doit JAMAIS être commitée dans le dépôt Git ni partagée — elle est stockée uniquement en variable d'environnement sur Vercel.**

### Étapes de configuration

1. **Générer la clé de compte de service** : Firebase Console → ⚙️ **Paramètres du projet** → onglet **Comptes de service** → **Générer une nouvelle clé privée**. Un fichier JSON se télécharge — gardez-le précieusement, ne le partagez à personne, ne le commitez pas.
2. **Créer un compte Vercel gratuit** sur <https://vercel.com/signup> (connexion possible directement avec votre compte GitHub, aucune carte bancaire demandée).
3. **Importer ce dépôt** : sur le tableau de bord Vercel, **Add New → Project**, choisissez le dépôt GitHub `district6-annuaire`, laissez les réglages par défaut, cliquez sur **Deploy** (le site statique sera aussi déployé sur Vercel, sans conséquence — seules les fonctions `/api/*` sont utilisées).
4. **Ajouter les variables d'environnement** : sur le projet Vercel → **Settings → Environment Variables**, ajoutez, à partir du fichier JSON téléchargé à l'étape 1 :
   - `FIREBASE_PROJECT_ID` → valeur du champ `project_id`
   - `FIREBASE_CLIENT_EMAIL` → valeur du champ `client_email`
   - `FIREBASE_PRIVATE_KEY` → valeur du champ `private_key` (collez-la telle quelle, avec les `-----BEGIN PRIVATE KEY-----` ; Vercel gère très bien les valeurs multi-lignes)
   
   Puis redéployez le projet (**Deployments → ⋯ → Redeploy**) pour que les variables soient prises en compte.
5. **Récupérer l'URL du projet** (ex. `https://district6-annuaire.vercel.app`) et la coller dans [`assets/js/recovery-config.js`](assets/js/recovery-config.js) (`RECOVERY_API_BASE_URL`).
6. **Publier les règles Firestore mises à jour** (collection `recoverySecrets`, voir [`firestore.rules`](firestore.rules)) dans **Firestore Database → Règles**.
7. Si votre site est hébergé ailleurs que `https://laapps.github.io`, ajoutez son origine dans [`lib/cors.js`](lib/cors.js) (`ALLOWED_ORIGINS`).

Une fois ces étapes faites, chaque nouveau compte créé définit sa question secrète, et le lien « Mot de passe oublié ? » de l'écran de connexion fonctionne de façon autonome. **Les comptes déjà créés avant cette mise à jour n'ont pas de question secrète enregistrée** — chacun·e peut la définir rétroactivement une fois connecté·e, via le bouton **« Ma question secrète »** en haut à droite de l'application (à côté de « Déconnexion »).

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

- **Administrateur** (adresses listées dans `ADMIN_EMAILS`) : peut tout faire — importer un fichier Excel, ajouter/modifier/supprimer n'importe quelle ressource, thème, personne ressource, fiche annuaire, document déposé ou contact DSDEN/Rectorat.
- **Utilisateur standard** (toute autre adresse `@ac-creteil.fr`) : peut consulter l'annuaire, les ressources, les personnes ressources, le dépôt de documents et les contacts DSDEN/Rectorat ; ajouter sa propre fiche annuaire et modifier/supprimer uniquement celle dont le champ « Mail » correspond à sa propre adresse de connexion ; se déclarer lui-même comme personne ressource sur un thème existant (nécessite d'avoir déjà sa fiche annuaire) et retirer sa propre déclaration ; déposer un document (lien ou fichier) et retirer uniquement ses propres dépôts. Les contacts DSDEN/Rectorat sont entièrement gérés par les administrateurs. Les boutons réservés aux administrateurs sont automatiquement masqués dans l'interface.

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
| `documents` | `titre`, `categorie` (→ `categoriesDepot`), `type` (`lien`\|`pdf`\|`word`\|`excel`\|`jpeg`\|`png`), `url`, `fileName`, `fileSizeBytes`, `description`, `ajoutePar` |
| `categoriesDepot` | `nom` |
| `contactsDsden` | `service`, `nom`, `prenom`, `fonction`, `telephone`, `mail` |
| `recoverySecrets` | ID = e-mail en minuscules · `question`, `answerHash` (SHA-256), `attempts` — illisible depuis le client, uniquement via le SDK Admin (fonctions Vercel) |

## Import Excel

Le bouton **Importer un fichier Excel** (présent sur les onglets Annuaire, Ressources, Personnes ressources et Contacts DSDEN/Rectorat) lit le fichier entièrement dans le navigateur via la librairie [SheetJS](https://sheetjs.com/) (chargée en CDN, aucune donnée n'est envoyée à un tiers) puis écrit chaque ligne valide dans Firestore. Un bouton **Télécharger le modèle Excel** génère un fichier d'exemple avec les bons en-têtes. Les noms de colonnes sont reconnus quelle que soit la casse ou les accents (« Prénom », « prenom », « PRENOM » sont équivalents).

| Onglet | Colonnes attendues | Règles |
|---|---|---|
| Annuaire | Nom, Prénom, Fonction, Établissement, Portable, Fixe, Mail | Nom et Prénom obligatoires |
| Ressources | Titre, Thématique, Type, URL, Description | Titre + Thématique (doit correspondre à une thématique existante) obligatoires. Type = `lien`, `pdf` ou `zip` (par défaut `lien` si une URL est fournie). Pour un PDF/ZIP, indiquez l'URL d'un fichier déjà hébergé ailleurs (Drive, site académique…) — l'application n'héberge pas de fichiers. |
| Personnes ressources | Thème, Nom, Prénom, Note | Le couple Nom + Prénom doit correspondre exactement à une fiche déjà présente dans l'Annuaire (importer l'annuaire en premier si besoin). Un thème inconnu est créé automatiquement. |
| Contacts DSDEN/Rectorat | Service, Nom, Prénom, Fonction, Téléphone, Mail | Le Service ou le Nom est obligatoire (au moins l'un des deux). Réservé aux administrateurs. |

Après l'import, un rapport indique le nombre de lignes importées et détaille, ligne par ligne, les erreurs éventuelles (champ manquant, thématique inconnue, personne introuvable…).

## Limites connues / pistes d'évolution

- **Pas de vérification d'adresse e-mail à l'inscription** : comme les messageries académiques bloquent les e-mails automatiques de Firebase, aucun e-mail de confirmation n'est envoyé à la création d'un compte. Rien n'empêche donc techniquement quelqu'un de créer un compte avec l'adresse d'un·e collègue, qui pourrait alors modifier sa fiche — acceptable pour une petite équipe de confiance.
- **Mot de passe oublié** : en libre-service via question secrète + fonction Vercel (voir section dédiée) une fois configuré. Sans cette configuration, ou pour les comptes créés avant sa mise en place, la récupération reste manuelle : un administrateur supprime le compte dans **Authentication → Users**, la personne recrée un compte avec la même adresse (ses données dans l'Annuaire ne sont pas affectées, elles n'appartiennent pas à un compte en particulier).
- **Question secrète en clair côté serveur de vérification** : la réponse n'est jamais stockée ni transmise en clair (hash SHA-256), mais ce n'est pas un hash à itérations lentes (type bcrypt) — suffisant pour un outil interne à faible enjeu, pas pour protéger des données très sensibles.
- **Pas d'upload de fichiers pour les Ressources** : choix volontaire pour rester sur le forfait gratuit Spark (voir plus haut) ; seul le Dépôt de documents permet un vrai upload, via Cloudinary.
- **Suppression Cloudinary non synchronisée** : retirer un document depuis l'application l'enlève de la liste mais ne supprime pas le fichier sur Cloudinary (voir section [Dépôt de documents](#dépôt-de-documents--cloudinary)).
- **Upload preset Cloudinary public** : son nom est visible dans le code source ; les restrictions de taille/format définies dans le preset Cloudinary sont la vraie protection contre les abus, pas une barrière côté application.
- **Police Marianne** : la vraie police officielle n'est pas incluse (fichiers à télécharger vous-même sur <https://www.systeme-de-design.gouv.fr/> et à déposer dans `assets/fonts/`) ; une police système proche est utilisée en attendant.
- **Contact administrateur** : implémenté via un simple lien `mailto:`, sans backend d'envoi d'e-mail.
- Aucune étape de build (pas de Node/npm) : c'est volontaire pour rester déployable tel quel n'importe où.
