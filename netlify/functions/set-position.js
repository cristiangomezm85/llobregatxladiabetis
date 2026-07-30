// POST /.netlify/functions/set-position
// Protegit per token d'admin. Gestiona start / confirm / setPace /
// undo / reset. Els checkpoints (noms, distàncies, ritme per
// defecte) es llegeixen de la configuració desada per
// config-admin.html — aquesta funció ja NO porta cap ruta fixa
// al codi.

const { openStore } = require("./lib/blobs");
const crypto = require("crypto");

const DEFAULT_STATE = {
  currentIndex: 0,
  status: "idle", // "idle" | "moving" | "finished"
  targetIndex: null,
  segmentStart: null,
  segmentDuration: null,
  paces: {},
  arrivals: {},
  history: [],
  garminUrl: null,
  garminSessionId: null,
  garminToken: null,
  updatedAt: null,
};

const MAX_HISTORY = 15;

function sha256hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function checkAuth(event) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  // Accepta tant si la variable d'entorn guarda el token en text pla
  // com si guarda el seu hash SHA-256.
  return token === expected || sha256hex(token) === expected;
}

/* Netlify Blobs llança un error si la clau encara no existeix, en
   comptes de retornar null — ho normalitzem aquí perquè la primera
   vegada (abans de desar res) no faci petar la funció. */
async function safeGet(store, key) {
  try {
    return await store.get(key, { type: "json" });
  } catch (e) {
    return null;
  }
}

/* Extreu la llista ordenada de checkpoints (només els punts amb
   nom) i les distàncies acumulades reals, a partir de la
   configuració desada per config-admin.html. */
function getCheckpointList(config) {
  const list = (config && Array.isArray(config.points) ? config.points : [])
    .filter((p) => p.checkpoint && p.checkpoint.name)
    .map((p) => p.checkpoint);

  const cumKm = [0];
  for (let i = 1; i < list.length; i++) {
    cumKm.push(cumKm[i - 1] + (Number(list[i].distFromPrevKm) || 0));
  }
  return { list, cumKm };
}

function snapshot(state) {
  const { history, ...rest } = state;
  return JSON.parse(JSON.stringify(rest));
}

function pushHistory(state) {
  state.history = state.history || [];
  state.history.push(snapshot(state));
  if (state.history.length > MAX_HISTORY) state.history.shift();
}

async function handleRequest(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!checkAuth(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: "No autoritzat" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON invàlid" }) };
  }

  const store = openStore("livetrack");
  const state = (await safeGet(store, "current")) || { ...DEFAULT_STATE };
  state.paces = state.paces || {};
  state.arrivals = state.arrivals || {};
  state.history = state.history || [];

  const { action, segmentIndex, pace } = body;

  if (action === "ping") {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  if (action === "setGarminUrl") {
    const { garminUrl } = body;
    if (typeof garminUrl !== "string") {
      return { statusCode: 400, body: JSON.stringify({ error: "garminUrl invàlid" }) };
    }
    const m = garminUrl.match(/session\/([a-f0-9-]+)\/token\/([A-Za-z0-9]+)/i);
    if (!m) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No s'ha reconegut l'enllaç de Garmin LiveTrack (ha de contenir /session/.../token/...)" }),
      };
    }
    pushHistory(state);
    state.garminUrl = garminUrl;
    state.garminSessionId = m[1];
    state.garminToken = m[2];
    state.updatedAt = Date.now();
    await store.setJSON("current", state);
    return { statusCode: 200, body: JSON.stringify(state) };
  }

  if (action === "setPace") {
    if (!Number.isInteger(segmentIndex) || segmentIndex < 1) {
      return { statusCode: 400, body: JSON.stringify({ error: "segmentIndex invàlid" }) };
    }
    if (typeof pace !== "number" || pace <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "pace invàlid" }) };
    }
    pushHistory(state);
    state.paces[String(segmentIndex)] = pace;
    state.updatedAt = Date.now();
    await store.setJSON("current", state);
    return { statusCode: 200, body: JSON.stringify(state) };
  }

  if (action === "start") {
    const config = await safeGet(store, "config");
    const { list, cumKm } = getCheckpointList(config);

    if (state.status !== "idle") {
      return { statusCode: 409, body: JSON.stringify({ error: "Ja hi ha un tram en marxa", state }) };
    }
    if (list.length === 0) {
      return { statusCode: 409, body: JSON.stringify({ error: "No hi ha cap checkpoint configurat" }) };
    }
    if (state.currentIndex >= list.length - 1) {
      return { statusCode: 409, body: JSON.stringify({ error: "Repte ja completat", state }) };
    }

    pushHistory(state);

    const target = state.currentIndex + 1;
    const usedPace =
      state.paces[String(target)] || pace || Number(list[target].paceMinKm) || 7.5;
    const distKm = cumKm[target] - cumKm[state.currentIndex];
    const durationMs = distKm * usedPace * 60000;

    state.targetIndex = target;
    state.segmentStart = Date.now();
    state.segmentDuration = durationMs;
    state.status = "moving";
    state.paces[String(target)] = usedPace;
    if (state.currentIndex === 0 && state.arrivals["0"] === undefined) {
      state.arrivals["0"] = state.segmentStart;
    }
    state.updatedAt = Date.now();

    await store.setJSON("current", state);
    return { statusCode: 200, body: JSON.stringify(state) };
  }

  if (action === "confirm") {
    if (state.status !== "moving") {
      return { statusCode: 409, body: JSON.stringify({ error: "No hi ha cap tram en marxa", state }) };
    }
    const config = await safeGet(store, "config");
    const { list } = getCheckpointList(config);

    pushHistory(state);

    state.arrivals[String(state.targetIndex)] = Date.now();
    state.currentIndex = state.targetIndex;
    state.targetIndex = null;
    state.segmentStart = null;
    state.segmentDuration = null;
    state.status = state.currentIndex >= list.length - 1 ? "finished" : "idle";
    state.updatedAt = Date.now();

    await store.setJSON("current", state);
    return { statusCode: 200, body: JSON.stringify(state) };
  }

  if (action === "undo") {
    if (!state.history || state.history.length === 0) {
      return { statusCode: 409, body: JSON.stringify({ error: "No hi ha res per desfer", state }) };
    }
    const prev = state.history.pop();
    const restored = { ...prev, history: state.history, updatedAt: Date.now() };
    await store.setJSON("current", restored);
    return { statusCode: 200, body: JSON.stringify(restored) };
  }

  if (action === "reset") {
    const fresh = { ...DEFAULT_STATE, history: [], updatedAt: Date.now() };
    await store.setJSON("current", fresh);
    return { statusCode: 200, body: JSON.stringify(fresh) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: "Acció desconeguda" }) };
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
  const result = await handleRequest(event);
  return {
    ...result,
    headers: { ...(result.headers || {}), ...CORS_HEADERS, "Content-Type": "application/json" },
  };
};
