// netlify/functions/admin-reindex-last-minute.js
//
// Ús puntual, protegit amb el mateix token que export-data:
//   /.netlify/functions/admin-reindex-last-minute?token=EL_TEU_TOKEN
//
// Reconstrueix l'índex de places last minute pagades a partir de totes les
// comandes. Cal executar-lo UN COP després de desplegar, perquè compti les
// inscripcions last minute fetes abans que existís l'índex.

const { reindexarLastMinute, comptarLastMinutePagades } = require("./lib/store");

exports.handler = async (event) => {
  const secretConfigurat = (process.env.EXPORT_SECRET || "").trim();
  const tokenRebut = (event.queryStringParameters?.token || "").trim();
  if (!secretConfigurat || tokenRebut !== secretConfigurat) {
    return { statusCode: 401, body: "Token incorrecte." };
  }
  try {
    const indexades = await reindexarLastMinute();
    const total = await comptarLastMinutePagades();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, indexades, total_a_l_index: total }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message || String(e) }) };
  }
};
