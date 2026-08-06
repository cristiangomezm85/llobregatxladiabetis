// POST /.netlify/functions/save-map-image
// Desa UNA imatge de mapa (dia o nit d'una etapa concreta) com a
// entrada pròpia a Blobs, separada de la configuració general.
//
// Per què cal això: si totes les imatges de mapa anessin dins del
// mateix JSON que es desa amb set-config, amb 3 etapes × 2 mapes
// cada una, la petició acabaria superant el límit de 6 MB que tenen
// les Netlify Functions (és un límit d'AWS Lambda per sota, no es
// pot ampliar des de Netlify). Guardant cada imatge per separat,
// cada petició és petita (una sola imatge, mai s'acosta al límit),
// i la configuració general només guarda una referència (la key)
// a cada imatge, no la imatge en si.

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
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Mètode no permès" }) };
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

  const { key, dataUri } = body;
  if (!key || typeof key !== "string" || !/^[a-zA-Z0-9_-]+$/.test(key)) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Falta 'key' vàlida (només lletres, números, _ i -)" }) };
  }
  if (!dataUri || typeof dataUri !== "string" || !dataUri.startsWith("data:")) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Falta 'dataUri' vàlid" }) };
  }

  try {
    const store = openStore("livetrack");
    await store.set(`mapimg:${key}`, dataUri);
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, key, sizeKB: Math.round(dataUri.length / 1024) }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Error desant la imatge", detail: String((err && err.stack) || err) }),
    };
  }
};
