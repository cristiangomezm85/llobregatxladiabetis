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

  // Una mateixa adreça només pot fer una inscripció de participant o un
  // "Dorsal 0". La compra de samarretes ("animar") queda expressament fora
  // d'aquesta restricció i es pot repetir amb el mateix email.
  const MODALITATS_SENSE_RESTRICCIO_EMAIL = ["animar"];
  const emailContacte = String(payload.email_contacte || "").trim().toLowerCase();

  if (!emailContacte) {
    return resposta(400, { error: "Falta l'email de contacte" });
  }

  if (!MODALITATS_SENSE_RESTRICCIO_EMAIL.includes(payload.modalitat)) {
    try {
      if (await emailJaRegistrat(emailContacte)) {
        return resposta(409, { error: "EMAIL_JA_REGISTRAT" });
      }
    } catch (e) {
      console.error("Error comprovant email duplicat:", e);
      // Si no podem comprovar el duplicat, no continuem: així no es pot
      // crear una inscripció duplicada per un error temporal de l'emmagatzematge.
      return resposta(503, {
        error: "No s'ha pogut comprovar l'email. Torna-ho a provar.",
      });
    }
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
    email_contacte: emailContacte,
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
    if (!MODALITATS_SENSE_RESTRICCIO_EMAIL.includes(dadesOrdre.modalitat)) {
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
