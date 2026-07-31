// GET /.netlify/functions/get-gps-live
//
// Retorna el traçat GPS real, tal com l'hem anat rebent directament
// del mòbil via OwnTracks (receive-gps-point.js). No depèn de cap
// web externa (ni Garmin ni Wikiloc): les dades ja són nostres.

const { openStore } = require("./lib/blobs");

exports.handler = async () => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };

  try {
    const store = openStore("livetrack");

    let points = [];
    try {
      points = (await store.get("gps-track", { type: "json" })) || [];
    } catch (e) {
      points = [];
    }

    let latest = null;
    try {
      latest = await store.get("gps-latest", { type: "json" });
    } catch (e) {
      latest = null;
    }

    if (!Array.isArray(points) || points.length === 0) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          available: false,
          reason: "Encara no s'ha rebut cap punt del mòbil. Comprova que OwnTracks tingui el mode HTTP activat i apuntant a receive-gps-point.",
          points: [],
        }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        available: true,
        points,
        latest,
        numPoints: points.length,
        fetchedAt: Date.now(),
      }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ available: false, reason: "Error intern llegint el traçat GPS", detail: String(err) }),
    };
  }
};
