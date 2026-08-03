// netlify/functions/export-data.js
//
// Endpoint de només lectura, protegit amb token, per descarregar un CSV
// de totes les comandes (pagades i pendents).
// Ús: /.netlify/functions/export-data?token=EL_TEU_TOKEN

const { llistarOrdres } = require("./lib/store");

exports.handler = async (event) => {
  const secretConfigurat = (process.env.EXPORT_SECRET || "").trim();
  const tokenRebut = (event.queryStringParameters?.token || "").trim();

  if (!secretConfigurat) {
    // Ajuda a diagnosticar: si veus aquest missatge, la variable EXPORT_SECRET
    // no està configurada a Netlify, o es va afegir sense fer un nou deploy
    // després (els canvis a variables d'entorn requereixen redeploy).
    return {
      statusCode: 500,
      body: "EXPORT_SECRET no configurat al servidor. Afegeix-lo a Netlify (Environment variables) i torna a desplegar.",
    };
  }

  if (tokenRebut !== secretConfigurat) {
    return { statusCode: 401, body: "Token incorrecte." };
  }

  let ordres;
  try {
    ordres = await llistarOrdres();
  } catch (err) {
    return {
      statusCode: 500,
      body: "Error accedint a l'emmagatzematge: " + (err && err.message ? err.message : String(err)),
    };
  }

  const columnes = [
    "order_id", "modalitat", "estat", "import_base_centims", "donacio_centims",
    "import_centims", "unitats", "email_contacte", "recollida_text",
    "nom", "cognoms", "telefon", "dni", "data_naixement", "es_menor",
    "tutor_nom", "tutor_cognoms", "relacio", "talla_samarreta", "samarretes",
    "club_nom",
    "tram_inici_nom", "tram_final_nom", "tram_km", "tram_dies",
    "federat", "num_llicencia_federativa",
    "acceptacio_reglament", "consentiment_dades", "cessio_imatge",
    "data_creacio", "data_pagament",
  ];

  const files = ordres.map((o) => {
    const p = o.payload || {};
    return {
      order_id: o.order_id,
      modalitat: o.modalitat,
      estat: o.estat,
      import_base_centims: o.import_base_centims,
      donacio_centims: o.donacio_centims,
      import_centims: o.import_centims,
      unitats: o.unitats,
      email_contacte: o.email_contacte,
      recollida_text: o.recollida_text,
      nom: p.nom, cognoms: p.cognoms, telefon: p.telefon,
      dni: p.dni, data_naixement: p.data_naixement, es_menor: p.es_menor,
      tutor_nom: p.tutor_nom, tutor_cognoms: p.tutor_cognoms,
      relacio: p.relacio, talla_samarreta: p.talla_samarreta,
      samarretes: Array.isArray(p.samarretes)
        ? p.samarretes.map((s) => `${s.talla}×${s.quantitat}`).join(" + ")
        : "",
      club_nom: p.club_nom,
      tram_inici_nom: p.tram_inici_nom, tram_final_nom: p.tram_final_nom,
      tram_km: p.tram_km, tram_dies: Array.isArray(p.tram_dies) ? p.tram_dies.join("+") : "",
      federat: p.federat, num_llicencia_federativa: p.num_llicencia_federativa,
      acceptacio_reglament: p.acceptacio_reglament, consentiment_dades: p.consentiment_dades,
      cessio_imatge: p.cessio_imatge,
      data_creacio: o.data_creacio, data_pagament: o.data_pagament,
    };
  });

  const csv = aCsv(files, columnes);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="inscripcions.csv"',
    },
    body: csv,
  };
};

function aCsv(files, columnes) {
  const escapar = (val) => {
    if (val === undefined || val === null) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const capçalera = columnes.join(",");
  const files_csv = files.map((f) => columnes.map((c) => escapar(f[c])).join(","));
  return [capçalera, ...files_csv].join("\n");
}
