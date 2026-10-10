// ============================================================================
// Configuration Cloudinary — À REMPLIR avec les informations de VOTRE compte
// Cloudinary gratuit (https://cloudinary.com, aucune carte bancaire requise).
//
// Étapes :
//   1. Créer un compte gratuit sur https://cloudinary.com/users/register/free
//   2. Noter votre "Cloud name" (visible sur le tableau de bord).
//   3. Créer un "Upload preset" non signé :
//      Settings → Upload → Upload presets → Add upload preset
//        - Signing Mode : Unsigned
//        - Folder : district6 (optionnel, pour ranger les fichiers à part)
//        - Max file size : 10 000 000 (10 Mo — doit correspondre à
//          MAX_FILE_SIZE_BYTES ci-dessous, c'est la vraie limite appliquée
//          côté serveur ; la limite JS n'est qu'un confort d'interface)
//        - Allowed formats : pdf,doc,docx,xls,xlsx,jpg,jpeg,png
//   4. Copier le "Cloud name" et le nom de l'upload preset ci-dessous.
//
// Ces valeurs ne sont pas secrètes (un upload preset non signé est conçu pour
// être utilisé côté client), mais restent ouvertes publiquement : n'importe
// qui ayant connaissance du cloud name + preset peut envoyer des fichiers
// vers ce compte. Les restrictions définies dans le preset (taille, formats)
// sont la vraie protection — configurez-les avec soin.
// ============================================================================

export const CLOUDINARY_CLOUD_NAME = "VOTRE_CLOUD_NAME";
export const CLOUDINARY_UPLOAD_PRESET = "VOTRE_UPLOAD_PRESET";

// Taille maximale acceptée pour un fichier déposé (en octets). 10 Mo est un
// bon compromis pour des PDF/Word/Excel/photos scannées sans saturer le
// forfait gratuit Cloudinary (25 Go). Doit correspondre au réglage
// "Max file size" du upload preset ci-dessus.
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = "10 Mo";

export const ACCEPTED_FILE_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";
