// Initialisation Firebase Admin SDK (droits serveur complets) à partir des
// variables d'environnement Vercel. NE JAMAIS committer la clé privée dans
// le dépôt : elle doit uniquement exister en tant que variable d'environnement
// Vercel (Project Settings → Environment Variables).

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

module.exports = { admin };
