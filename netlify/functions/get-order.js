// netlify/functions/get-order.js
//
// Retorna només un subconjunt PÚBLIC i segur d'una comanda, per generar la
// targeta de compartir a la pàgina de gràcies. No exposa DNI, telèfon,
// email ni dades del tutor. L'order_id és un UUID impossible d'endevinar,
// així que no cal cap token addicional.
//
// Nota: no exigim que estat==='pagat'. Stripe redirigeix a gràcies.html
// just després del pagament, però el webhook que marca la comanda com a
// pagada pot trigar uns segons més a arribar; si féssim dependre la
// targeta d'aquest estat, es podria quedar sense mostrar mai per una
// simple carrera de temps. Com que l'order_id ja actua de clau d'accés
// (impossible d'endevinar), no hi ha risc de seguretat en servir-la abans.

const { obtenirOrdre } = require("./lib/store");

exports.handler = async (event) => {
  const orderId = event.queryStringParameters?.order_id;
  if (!orderId) return resposta(400, { error: "Falta order_id" });

  const ordre = await obtenirOrdre(orderId);
  if (!ordre) return resposta(404, { error: "Comanda no trobada" });

  const p = ordre.payload || {};
  return resposta(200, {
    modalitat: ordre.modalitat,
    nom: p.nom || "",
    club_nom: p.club_nom || "",
    municipi: ordre.recollida_text || p.recollida_municipi_nom || "",
    tram_inici_nom: p.tram_inici_nom || "",
    tram_final_nom: p.tram_final_nom || "",
    tram_km: typeof p.tram_km === "number" ? p.tram_km : null,
    tram_dies: Array.isArray(p.tram_dies) ? p.tram_dies.length : null,
    unitats: ordre.unitats || null,
  });
};

function resposta(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
