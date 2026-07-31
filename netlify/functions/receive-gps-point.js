// POST /.netlify/functions/receive-gps-point
//
// Rep cada punt de posició que envia l'app OwnTracks (mode HTTP) des
// del mòbil del corredor, i el guarda. Substitueix l'intent anterior
// de treure les dades directament de Garmin (que Garmin bloqueja amb
// protecció anti-bots): ara és el propi mòbil qui ens envia la
// posició directament, sense passar per cap altra web.
//
// Configuració a l'app OwnTracks (mode HTTP):
//   Host: https://<el-teu-domini>/.netlify/functions/receive-gps-point?token=<ADMIN_TOKEN>
//   (o bé deixa el token fora de la URL i fes servir Basic Auth amb
//   qualsevol nom d'usuari i com a contrasenya el mateix ADMIN_TOKEN)
//
// OwnTracks envia missatges de diversos tipus (_type). Només ens
// interessen els de tipus "location". La resta els ignorem sense
// donar error, perquè és normal que en rebi.

const { openStore } = require("./lib/blobs");
const crypto = require("crypto");

const MAX_POINTS = 20000; // límit de seguretat perquè el blob no creixi sense control

function sha256hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function checkAuth(event) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;

  // 1) Token per query string (?token=...) — el més fàcil de configurar
  //    al camp "Host" de OwnTracks, sense haver de tocar cap altre camp.
  const qsToken = (event.queryStringParameters && event.queryStringParameters.token) || "";
  if (qsToken && (qsToken === expected || sha256hex(qsToken) === expected)) return true;

  // 2) HTTP Basic Auth — el mètode natiu que documenta OwnTracks.
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  if (authHeader.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(authHeader.slice(6).trim(), "base64").toString("utf8");
      const pass = decoded.split(":").slice(1).join(":"); // per si la contrasenya té ":"
      if (pass && (pass === expected || sha256hex(pass) === expected)) return true;
    } catch (e) {
      // ignorem, es tractarà com a no autoritzat
    }
  }

  // 3) Bearer, per si algú vol provar-ho manualment amb curl/Postman.
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (bearer && (bearer === expected || sha256hex(bearer) === expected)) return true;

  return false;
}

async function safeGetJSON(store, key, fallback) {
  try {
    const v = await store.get(key, { type: "json" });
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

exports.handler = async (event) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Mètode no permès" }) };
  }

  if (!checkAuth(event)) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "No autoritzat" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "JSON invàlid" }) };
  }

  // OwnTracks pot enviar-nos missatges que no són de localització
  // (per exemple "transition" o "waypoints" o un array buit). Els
  // ignorem sense error — OwnTracks espera sempre una resposta 200.
  const isLocation = body && body._type === "location" && typeof body.lat === "number" && typeof body.lon === "number";

  if (isLocation) {
    try {
      const store = openStore("livetrack");
      const points = await safeGetJSON(store, "gps-track", []);

      const point = {
        lat: body.lat,
        lng: body.lon,
        t: body.tst ? body.tst * 1000 : Date.now(), // OwnTracks envia tst en segons UNIX
        acc: typeof body.acc === "number" ? body.acc : null,
        batt: typeof body.batt === "number" ? body.batt : null,
      };

      points.push(point);
      if (points.length > MAX_POINTS) {
        points.splice(0, points.length - MAX_POINTS);
      }

      await store.setJSON("gps-track", points);
      await store.setJSON("gps-latest", point);
    } catch (err) {
      // No fem fallar la resposta a OwnTracks per un error de guardat:
      // si Blobs falla puntualment, és millor perdre un punt que fer
      // que l'app del mòbil comenci a acumular errors i reintents.
      console.error("Error guardant punt GPS:", err);
    }
  }

  // OwnTracks, en mode HTTP, espera un array JSON (normalment buit)
  // com a resposta correcta.
  return { statusCode: 200, headers: CORS, body: "[]" };
};
