const crypto = require("crypto");
const { admin } = require("../lib/firebaseAdmin");
const { applyCors } = require("../lib/cors");

const MAX_ATTEMPTS_PER_HOUR = 5;
const ONE_HOUR_MS = 60 * 60 * 1000;

function sha256Hex(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

module.exports = async (req, res) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  const { email, answer, newPassword } = req.body || {};
  if (!email || !answer || !newPassword) {
    return res.status(400).json({ error: "Adresse e-mail, réponse et nouveau mot de passe requis." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const db = admin.firestore();
    const docRef = db.collection("recoverySecrets").doc(normalizedEmail);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Aucune question secrète n'est configurée pour cette adresse." });
    }
    const data = snap.data();

    const now = Date.now();
    const recentAttempts = (data.attempts || []).filter((t) => now - t < ONE_HOUR_MS);
    if (recentAttempts.length >= MAX_ATTEMPTS_PER_HOUR) {
      return res.status(429).json({ error: "Trop de tentatives. Réessayez dans une heure." });
    }

    const answerHash = sha256Hex(answer.trim().toLowerCase());
    if (answerHash !== data.answerHash) {
      await docRef.update({ attempts: [...recentAttempts, now] });
      return res.status(401).json({ error: "Réponse incorrecte." });
    }

    const user = await admin.auth().getUserByEmail(normalizedEmail);
    await admin.auth().updateUser(user.uid, { password: newPassword });
    await docRef.update({ attempts: [] });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === "auth/user-not-found") {
      return res.status(404).json({ error: "Aucun compte ne correspond à cette adresse." });
    }
    return res.status(500).json({ error: "Erreur serveur." });
  }
};
