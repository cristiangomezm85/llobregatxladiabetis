// GET /.netlify/functions/get-position
// Lectura pública, sense autenticació — qualsevol pot consultar
// l'estat actual de la cursa (no pot modificar-lo).

const { getStore } = require("@netlify/blobs");

const DEFAULT_STATE = {
  currentIndex: 0,
  status: "idle", // "idle" | "moving" | "finished"
  targetIndex: null,
  segmentStart: null,
  segmentDuration: null,
  paces: {}, // { "1": 7.5, "2": 8.0, ... } ritme min/km per segment (index = targetIndex)
  arrivals: {}, // { "0": tsSortida, "1": tsArribadaReal, ... }
  garminUrl: null,
  updatedAt: null,
};

exports.handler = async () => {
  try {
    const store = getStore("livetrack");
    const data = await store.get("current", { type: "json" });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data || DEFAULT_STATE),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "No s'ha pogut llegir la posició", detail: String(err) }),
    };
  }
};
