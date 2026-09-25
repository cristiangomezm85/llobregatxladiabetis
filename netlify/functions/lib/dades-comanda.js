// netlify/functions/lib/dades-comanda.js
//
// Càlcul dels camps "human readable" d'una comanda (nom, modalitat, tram,
// municipi, samarretes, import, data, número de comanda...), en un únic lloc.
//
// Aquesta lògica vivia només dins de lib/mailerlite.js. S'ha extret aquí
// perquè lib/confirmacio-email.js (l'email transaccional per Resend) l'ha
// de reutilitzar EXACTAMENT igual: el correu de Resend ha de mostrar els
// mateixos valors, amb el mateix format, que els camps que rep MailerLite
// -- una sola font de veritat, sense poder-se desincronitzar.
//
// IMPORTANT: els valors que es retornen aquí NO es "maquillen" ni es
// tradueixen (p. ex. "modalitat" és el slug intern tal qual: "caminant",
// "animar", "dorsal0"...; "import_pagat" fa servir sempre punt decimal,
// mai coma; "data_inscripcio" es formata sempre en ca-ES). És deliberat:
// són els mateixos camps que ja s'envien a MailerLite des de fa temps, i
// canviar-ne el format aquí (encara que "quedi més bonic") trencaria la
// paritat entre els dos correus.

function construirCampsComanda(ordre, orderId) {
  const payload = ordre.payload || {};

  const municipi = ordre.recollida_text || payload.recollida_municipi_nom || "";

  // Un sol camp de tram, ja resolt segons modalitat, per no dependre de
  // contingut condicional (que no tenim ni a MailerLite ni al Resend):
  //  - caminant/corrent/bici: "Inici → Final"
  //  - animar: el municipi des d'on anima (el mateix que la recollida)
  //  - dorsal0: no hi ha tram, mostrem "Dorsal 0"
  let tram;
  if (payload.tram_inici_nom && payload.tram_final_nom) {
    tram = `${payload.tram_inici_nom} → ${payload.tram_final_nom}`;
  } else if (ordre.modalitat === "animar") {
    tram = municipi || "—";
  } else {
    tram = "Dorsal 0";
  }

  // Dades perquè el correu funcioni com a comprovant d'inscripció (a banda
  // del rebut de pagament que envia Stripe): numero de comanda curt, import
  // i data. La data que fem servir és la de pagament si ja existeix
  // (comanda pagada) o la de creació (comanda gratuïta/Heroi).
  const numComanda = orderId ? orderId.slice(0, 8).toUpperCase() : "";
  const importPagat = ordre.import_centims != null ? (ordre.import_centims / 100).toFixed(2) + " €" : "";
  const dataIso = ordre.data_pagament || ordre.data_creacio || "";
  let dataInscripcio = "";
  if (dataIso) {
    const d = new Date(dataIso);
    if (!isNaN(d)) dataInscripcio = d.toLocaleDateString("ca-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  // Resum de les samarretes. Tant "animar" (una entrada per talla triada,
  // amb la quantitat que hagi demanat la persona) com les modalitats
  // físiques (pricing.js hi posa una única entrada amb la talla i una
  // quantitat igual al nombre d'etapes -- una samarreta per etapa) arriben
  // aquí amb payload.samarretes com a array de {talla, quantitat}. Sumar
  // bé aquesta quantitat (i no deixar-la sempre a "x1") és el que es va
  // haver d'arreglar quan algú compra més d'una samarreta o fa un tram de
  // diversos dies: cal recórrer TOT l'array i mostrar cada entrada amb la
  // seva quantitat real, no només la primera.
  let samarretesResum = "";
  if (Array.isArray(payload.samarretes) && payload.samarretes.length) {
    samarretesResum = payload.samarretes
      .map((s) => `${s.talla || "?"} x${s.quantitat || 0}`)
      .join(", ");
  }

  return {
    name: payload.nom || "",
    last_name: payload.cognoms || "",
    phone: payload.telefon || "",
    idioma: (payload.idioma || "CA").toUpperCase(),
    modalitat: ordre.modalitat || "",
    municipi,
    colla_nom: payload.club_nom || "",
    tram,
    num_comanda: numComanda,
    import_pagat: importPagat,
    data_inscripcio: dataInscripcio,
    samarretes: samarretesResum,
  };
}

module.exports = { construirCampsComanda };
