// GET /.netlify/functions/debug-config
// Diagnòstic directe: llegeix la clau "config" tal com és al servidor
// ARA MATEIX, sense passar per cap pàgina ni JavaScript intermedi.
// Serveix per treure tota ambigüitat sobre si el problema és de
// persistència real o de caché al navegador.

const { openStore } = require("./lib/blobs");

exports.handler = async () => {
  const CORS = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  try {
    const store = openStore("livetrack");
    let raw = null;
    try {
      raw = await store.get("config", { type: "text" });
    } catch (e) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ exists: false, reason: "No s'ha pogut llegir la clau 'config' (probablement encara no existeix)", detail: String(e) }, null, 2),
      };
    }

    if (!raw) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ exists: false, reason: "La clau 'config' és buida al servidor" }, null, 2) };
    }

    const sizeKB = Math.round(raw.length / 1024);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({ exists: true, sizeKB, parseable: false, reason: "El contingut guardat no és JSON vàlid", snippet: raw.slice(0, 200) }, null, 2),
      };
    }

    const checkpoints = (parsed.points || []).filter(p => p.checkpoint);
    const totalKm = checkpoints.reduce((s, p, i) => i === 0 ? s : s + (Number(p.checkpoint.distFromPrevKm) || 0), 0);
    const spriteSizes = {};
    ["moving", "idle", "sleeping"].forEach(k => {
      const v = parsed.runnerSprites && parsed.runnerSprites[k];
      spriteSizes[k] = v ? `${Math.round(v.length / 1024)} KB` : "buit";
    });

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        exists: true,
        parseable: true,
        sizeTotalKB: sizeKB,
        updatedAt: parsed.updatedAt || null,
        updatedAtReadable: parsed.updatedAt ? new Date(parsed.updatedAt).toString() : null,
        numPoints: (parsed.points || []).length,
        numCheckpoints: checkpoints.length,
        checkpointNames: checkpoints.map(p => p.checkpoint.name),
        totalKm: Number(totalKm.toFixed(2)),
        spriteSizes,
        hasMapImage: !!parsed.mapImage,
      }, null, 2),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Error inesperat", detail: String(err) }, null, 2) };
  }
};
