// GET /.netlify/functions/get-gps-track
// Lectura pública. Fa de pont cap a Garmin LiveTrack:
// - Llegeix la sessió/token desats per l'admin (setGarminUrl)
// - Consulta el servei NO OFICIAL de Garmin (patró conegut de la
//   comunitat, no documentat per Garmin — pot deixar de funcionar
//   sense avís, per això tot va amb try/catch i missatges clars)
// - Guarda en caché uns segons perquè encara que 50 persones
//   estiguin mirant el mapa, Garmin només rep una petició real
//   cada cert temps.
//
// ⚠️ IMPORTANT: aquest endpoint de Garmin és reverse-engineered
// per la comunitat (veure github.com/renarsvilnis/garmin-livetrack
// i projectes similars). Abans de confiar-hi per a l'esdeveniment
// real, cal provar-ho amb una sessió LiveTrack real i revisar la
// forma exacta de la resposta — el parsing de punts de sota prova
// diversos noms de camp habituals, però pot necessitar ajust.

const { openStore } = require("./lib/blobs");

const CACHE_TTL_MS = 30000; // no tornem a trucar a Garmin més sovint que això

function extractPoints(trackLogJson) {
  // Diferents variants conegudes de la resposta de trackLog.
  // Provem diverses formes habituals de camp.
  const raw =
    trackLogJson.trackPoints ||
    trackLogJson.points ||
    trackLogJson.positions ||
    trackLogJson.track ||
    (Array.isArray(trackLogJson) ? trackLogJson : null);

  if (!raw || !Array.isArray(raw)) return [];

  return raw
    .map((p) => {
      const lat = p.lat ?? p.latitude ?? p.Latitude ?? (Array.isArray(p) ? p[0] : null);
      const lng = p.lon ?? p.lng ?? p.longitude ?? p.Longitude ?? (Array.isArray(p) ? p[1] : null);
      const t = p.time ?? p.timestamp ?? p.dateTime ?? null;
      if (lat == null || lng == null) return null;
      return { lat: Number(lat), lng: Number(lng), t: t ? Number(t) : null };
    })
    .filter(Boolean);
}

exports.handler = async () => {
  const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

  try {
    const store = openStore("livetrack");
    let state = null;
    try { state = await store.get("current", { type: "json" }); } catch (e) { state = null; }

    if (!state || !state.garminSessionId || !state.garminToken) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ available: false, reason: "No hi ha cap enllaç de Garmin LiveTrack configurat", points: [] }),
      };
    }

    // Caché: si tenim dades recents, no truquem a Garmin de nou
    let cached = null;
    try { cached = await store.get("gps-cache", { type: "json" }); } catch (e) { cached = null; }
    if (cached && cached.sessionId === state.garminSessionId && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ available: true, ...cached }) };
    }

    const { garminSessionId, garminToken } = state;
    const requestTime = Date.now();
    const trackLogUrl = `https://livetrack.garmin.com/services/trackLog/${garminSessionId}/token/${garminToken}?requestTime=${requestTime}&from=0`;

    let res;
    try {
      res = await fetch(trackLogUrl, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; LlobregatXLaDiabetis/1.0)" },
      });
    } catch (fetchErr) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          available: false,
          reason: "No s'ha pogut connectar amb Garmin (xarxa)",
          detail: String(fetchErr),
          triedUrl: trackLogUrl,
        }),
      };
    }

    if (!res.ok) {
      let bodyText = "";
      try { bodyText = (await res.text()).slice(0, 300); } catch (e) {}
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          available: false,
          reason: `Garmin ha respost ${res.status} — la sessió pot haver caducat o l'enllaç no és correcte`,
          garminStatus: res.status,
          garminBody: bodyText,
          triedUrl: trackLogUrl,
        }),
      };
    }

    let json;
    let rawText = "";
    try {
      rawText = await res.text();
      json = JSON.parse(rawText);
    } catch (parseErr) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          available: false,
          reason: "Garmin ha respost però no és JSON vàlid",
          rawResponseSnippet: rawText.slice(0, 300),
        }),
      };
    }

    const points = extractPoints(json);

    if (points.length === 0) {
      // Diagnòstic: expliquem quines claus de primer nivell hem rebut
      // perquè, si el format real de Garmin no coincideix amb el que
      // esperàvem, ho puguem veure sense haver d'endevinar més.
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          available: false,
          reason: "Garmin ha respost correctament però no s'hi han trobat punts (0 punts). Pot ser que encara no hi hagi activitat en marxa, o que el format de resposta sigui diferent de l'esperat.",
          responseTopLevelKeys: Array.isArray(json) ? `array[${json.length}]` : Object.keys(json || {}),
          responseSample: JSON.stringify(json).slice(0, 500),
        }),
      };
    }

    const result = {
      sessionId: garminSessionId,
      points,
      fetchedAt: Date.now(),
    };

    await store.setJSON("gps-cache", result);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ available: true, ...result }) };
  } catch (err) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ available: false, reason: "Error connectant amb Garmin: " + String(err), points: [] }),
    };
  }
};
