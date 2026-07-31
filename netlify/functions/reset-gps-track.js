// POST /.netlify/functions/reset-gps-track
// Protegit per token d'admin (Bearer). Esborra el traçat GPS
// acumulat — útil per començar de nou després de fer proves amb
// OwnTracks abans del dia de la cursa real.

const { openStore } = require("./lib/blobs");
const crypto = require("crypto");

function sha256hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function checkAuth(event) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  return token === expected || sha256hex(token) === expected;
}

exports.handler = async (event) => {
  const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Mètode no permès" }) };
  }
  if (!checkAuth(event)) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "No autoritzat" }) };
  }

  try {
    const store = openStore("livetrack");
    await store.setJSON("gps-track", []);
    await store.setJSON("gps-latest", null);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Error esborrant", detail: String(err) }) };
  }
};
