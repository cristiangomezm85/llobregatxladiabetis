// netlify/functions/submit-registration.js
//
// PAS 1 del flux: rep el payload del formulari, calcula i valida l'import
// (calcularImport muta el payload per adjuntar tram_dies/tram_km/es_menor),
// i crea una comanda "pendent" a Netlify Blobs. Encara no cobra res.

const { randomUUID } = require("crypto");
const { calcularImport, descripcioComanda } = require("./lib/pricing");
const { textPerIdx } = require("./lib/pickup");
const { crearOrdre } = require("./lib/store");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return resposta(405, { error: "Mètode no permès" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return resposta(400, { error: "JSON invàlid" });
  }

  let calcul;
  try {
    calcul = await calcularImport(payload);
  } catch (e) {
    return resposta(400, { error: e.message });
  }

  const orderId = randomUUID();
  const descripcio = descripcioComanda(payload);
  const recollidaText = payload.recollida_idx !== undefined ? textPerIdx(payload.recollida_idx) : "";

  try {
    await crearOrdre(orderId, {
      modalitat: payload.modalitat,
      payload, // es desa tal qual (ja inclou tram_dies/tram_km/es_menor si aplica)
      recollida_text: recollidaText,
      import_base_centims: calcul.baseCentims,
      donacio_centims: calcul.donacioCentims,
      import_centims: calcul.totalCentims,
      unitats: calcul.unitats,
      estat: "pendent",
      email_contacte: payload.email_contacte || "",
      descripcio,
      data_creacio: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Error creant comanda:", e);
    return resposta(500, { error: "No s'ha pogut registrar la comanda. Torna-ho a provar." });
  }

  return resposta(200, {
    order_id: orderId,
    import_centims: calcul.totalCentims,
    import_eur: (calcul.totalCentims / 100).toFixed(2),
    descripcio,
  });
};

function resposta(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
