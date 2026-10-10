const { admin } = require("../lib/firebaseAdmin");
const { applyCors } = require("../lib/cors");

module.exports = async (req, res) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  const { email } = req.body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Adresse e-mail requise." });
  }

  try {
    const db = admin.firestore();
    const snap = await db.collection("recoverySecrets").doc(email.trim().toLowerCase()).get();
    if (!snap.exists) {
      return res.status(404).json({
        error: "Aucune question secrète n'est configurée pour cette adresse. Contactez l'administrateur.",
      });
    }
    return res.status(200).json({ question: snap.data().question });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur." });
  }
};
