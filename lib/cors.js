// Domaines autorisés à appeler cette API (CORS). Ajoutez ici tout autre
// domaine depuis lequel l'application serait un jour servie.
const ALLOWED_ORIGINS = [
  "https://laapps.github.io",
  "http://localhost:8199",
  "http://localhost:8080",
];

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = { applyCors, ALLOWED_ORIGINS };
