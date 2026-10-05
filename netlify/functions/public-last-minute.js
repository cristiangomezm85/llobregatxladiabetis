// netlify/functions/public-last-minute.js
//
// GET /.netlify/functions/public-last-minute
//
// Endpoint PÚBLIC (sense token) que alimenta el comptador en viu de
// places restants i el compte enrere de inscripcio-last-minute.html. No
// torna cap dada personal, només els números que la pàgina necessita.

const { comptarLastMinuteOcupades, LAST_MINUT_LIMIT, LAST_MINUT_CUTOFF_ISO } = require("./lib/pricing");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Mètode no permès" }),
    };
  }

  try {
    const ocupades = await comptarLastMinuteOcupades();
    const restants = Math.max(0, LAST_MINUT_LIMIT - ocupades);
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({
        ok: true,
        limit: LAST_MINUT_LIMIT,
        ocupades,
        restants,
        cutoff: LAST_MINUT_CUTOFF_ISO,
      }),
    };
  } catch (e) {
    console.error("Error a public-last-minute:", e);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: e.message || String(e) }),
    };
  }
};
