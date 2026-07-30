// netlify/functions/get-order.js
//
// Retorna només un subconjunt PÚBLIC i segur d'una comanda ja pagada,
// per generar la targeta de compartir a la pàgina de gràcies. No exposa
// DNI, telèfon, email ni dades del tutor. L'order_id és un UUID
// impossible d'endevinar, així que no cal cap token addicional.

const { obtenirOrdre } = require("./lib/store");

exports.handler = async (event) => {
  const orderId = event.queryStringParameters?.order_id;
  if (!orderId) return resposta(400, { error: "Falta order_id" });

  const ordre = await obtenirOrdre(orderId);
  if (!ordre || ordre.estat !== "pagat") {
    return resposta(404, { error: "Comanda no trobada" });
  }

  const p = ordre.payload || {};
  return resposta(200, {
    modalitat: ordre.modalitat,
    nom: p.nom || "",
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
