// POST /.netlify/functions/set-config
// Protegit pel mateix token/hash d'admin. Desa la configuració
// completa del recorregut (mapa, sprite, punts i checkpoints).
// El panell config-admin.html envia l'objecte sencer cada vegada
// que es prem "Desar" — no cal fer merges parcials.

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!checkAuth(event)) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: "No autoritzat" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "JSON invàlid" }) };
  }

  if (!Array.isArray(body.points)) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Falta l'array 'points'" }) };
  }

  const config = {
    mapImage: body.mapImage || null,
    runnerSprite: body.runnerSprite || null,
    points: body.points,
    updatedAt: Date.now(),
  };

  try {
    const store = openStore("livetrack");
    await store.setJSON("config", config);
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, updatedAt: config.updatedAt }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "No s'ha pogut desar", detail: String(err) }),
    };
  }
};
