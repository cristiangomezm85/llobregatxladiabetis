// netlify/functions/submit-registration.js
//
// PAS 1 del flux: rep el payload del formulari, calcula i valida l'import
// (calcularImport muta el payload per adjuntar tram_dies/tram_km/es_menor),
// i crea una comanda "pendent" a Netlify Blobs. Encara no cobra res.

const { randomUUID } = require("crypto");
const { calcularImport, descripcioComanda } = require("./lib/pricing");
const { crearOrdre, emailJaRegistrat, marcarEmailPagat } = require("./lib/store");
const { notificarMailerLite } = require("./lib/mailerlite");

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

  // Inscripció única per email: si ja hi ha una comanda pagada amb aquest
  // mateix email, no deixem continuar (MailerLite no permet enviar-hi un
  // altre correu igual el mateix dia). No aplica a "animar" (compra de
  // samarretes) ni a "dorsal0" (donació simbòlica): cap dels dos és "una
  // inscripció de participant", així que la mateixa persona ha de poder
  // repetir amb el mateix email tants cops com vulgui.
  const MODALITATS_SENSE_RESTRICCIO_EMAIL = new Set(["animar", "dorsal0"]);
  try {
    if (
      !MODALITATS_SENSE_RESTRICCIO_EMAIL.has(payload.modalitat) &&
      (await emailJaRegistrat(payload.email_contacte))
    ) {
      return resposta(409, { error: "EMAIL_JA_REGISTRAT" });
    }
  } catch (e) {
    console.error("Error comprovant email duplicat:", e);
    // Si la comprovació falla per error tècnic, deixem continuar: és
    // preferible arriscar-se a un duplicat rar que bloquejar inscripcions
    // legítimes per una caiguda temporal de l'emmagatzematge.
  }

  let calcul;
  try {
    calcul = await calcularImport(payload);
  } catch (e) {
    return resposta(400, { error: e.message });
  }

  const orderId = randomUUID();
  let descripcio;
  try {
    descripcio = descripcioComanda(payload);
  } catch (e) {
    console.error("Error generant la descripció de la comanda:", e);
    return resposta(500, {
      error: "No s'ha pogut registrar la comanda. Torna-ho a provar.",
      detall: e && e.message ? e.message : String(e),
    });
  }
  // El municipi de recollida ve ja resolt des del frontend (id + nom),
  // no cal cap taula de correspondència al backend.
  const recollidaText = payload.recollida_municipi_nom || payload.recollida_municipi || "";

  // Si el codi de descompte d'Heroi ha deixat l'import total a 0, no cal
  // passar per Stripe: confirmem la comanda directament.
  const esGratuit = calcul.totalCentims === 0;

  const dadesOrdre = {
    modalitat: payload.modalitat,
    payload, // es desa tal qual (ja inclou tram_dies/tram_km/es_menor si aplica)
    recollida_text: recollidaText,
    import_base_centims: calcul.baseCentims,
    donacio_centims: calcul.donacioCentims,
    import_centims: calcul.totalCentims,
    unitats: calcul.unitats,
    descompte_heroi: !!calcul.descompteHeroiAplicat,
    estat: esGratuit ? "pagat" : "pendent",
    email_contacte: payload.email_contacte || "",
    descripcio,
    data_creacio: new Date().toISOString(),
  };
  if (esGratuit) dadesOrdre.data_pagament = dadesOrdre.data_creacio;

  try {
    await crearOrdre(orderId, dadesOrdre);
  } catch (e) {
    console.error("Error creant comanda:", e);
    return resposta(500, {
      error: "No s'ha pogut registrar la comanda. Torna-ho a provar.",
      detall: e && e.message ? e.message : String(e),
    });
  }

  if (esGratuit) {
    if (!MODALITATS_SENSE_RESTRICCIO_EMAIL.has(dadesOrdre.modalitat)) {
      try {
        await marcarEmailPagat(dadesOrdre.email_contacte, orderId);
      } catch (e) {
        console.error("Error marcant email com a pagat:", e);
      }
    }
    try {
      await notificarMailerLite(dadesOrdre, orderId);
    } catch (e) {
      console.error("Error notificant MailerLite:", e);
    }
  }

  return resposta(200, {
    order_id: orderId,
    import_centims: calcul.totalCentims,
    import_eur: (calcul.totalCentims / 100).toFixed(2),
    descripcio,
    gratuit: esGratuit,
  });
};

function resposta(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
