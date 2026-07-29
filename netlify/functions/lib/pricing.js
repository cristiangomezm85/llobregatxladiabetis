// lib/pricing.js
// Fuente única de verdad para precios y validación legal. NUNCA se confía
// en el importe ni en las validaciones que vengan del frontend.

const { calcularTram } = require("./route");

// Tarifes per fases (early bird / estàndard / last call). Els preus de
// cada casella són valors fixos per tarifa, no una fórmula.
const TARIFES = [
  { id: "earlybird", cutoff: "2026-08-15", preus: { animar: 1000, 1: 1500, 2: 3000, 3: 4500 } },
  { id: "standard", cutoff: "2026-08-31", preus: { animar: 1200, 1: 2000, 2: 3500, 3: 5000 } },
  { id: "lastcall", cutoff: "2026-09-15", preus: { animar: 1500, 1: 2500, 2: 4500, 3: 6000 } },
];

function tarifaActual() {
  const avui = new Date().toISOString().slice(0, 10);
  for (const tarifa of TARIFES) {
    if (avui <= tarifa.cutoff) return tarifa;
  }
  return TARIFES[TARIFES.length - 1];
}

const TALLES_VALIDES = [
  "XS", "S", "M", "L", "XL", "XXL",
  "Infantil 3-4", "Infantil 5-6", "Infantil 7-8",
  "Infantil 9-10", "Infantil 11-12", "Infantil 13-14",
];

const DATA_INICI_REPTE = "2026-10-16";

function dataNaixementValida(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [any, mes, dia] = str.split("-").map(Number);
  if (any < 1900 || any > 2026) return false;
  if (mes < 1 || mes > 12) return false;
  const diesMes = new Date(any, mes, 0).getDate();
  return dia >= 1 && dia <= diesMes;
}

function calcularEsMenor(dataNaixementStr) {
  if (!dataNaixementValida(dataNaixementStr)) return null;
  const [any, mes, dia] = dataNaixementStr.split("-").map(Number);
  const [anyE, mesE, diaE] = DATA_INICI_REPTE.split("-").map(Number);
  let edat = anyE - any;
  if (mesE < mes || (mesE === mes && diaE < dia)) edat--;
  return edat < 18;
}

function emailValid(str) {
  return typeof str === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function validarDonacio(payload) {
  const raw = payload.donacio_centims;
  if (raw === undefined || raw === null || raw === "") return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error("L'import de donació no és vàlid");
  return n;
}

async function validarDorsal0(payload, donacioCentims) {
  if (!payload.nom || !payload.cognoms) throw new Error("Falta el nom i cognoms");
  if (!emailValid(payload.email_contacte)) throw new Error("Falta un email vàlid");
  if (!payload.telefon) throw new Error("Falta el telèfon");
  if (donacioCentims <= 0) {
    throw new Error("El Dorsal 0 requereix una donació superior a 0 €");
  }
  return { baseCentims: 0, unitats: 0 };
}

async function validarAnimar(payload) {
  if (!payload.nom || !payload.cognoms) throw new Error("Falta el nom i cognoms");
  if (!emailValid(payload.email_contacte)) throw new Error("Falta un email vàlid");
  if (!payload.telefon) throw new Error("Falta el telèfon");
  if (!payload.relacio) throw new Error("Falta la relació amb la diabetis tipus 1");
  if (!Array.isArray(payload.samarretes) || payload.samarretes.length === 0) {
    throw new Error("Cal afegir almenys una samarreta (talla i quantitat)");
  }
  let unitats = 0;
  for (const s of payload.samarretes) {
    if (!TALLES_VALIDES.includes(s.talla)) throw new Error("Talla de samarreta no vàlida");
    const q = Number(s.quantitat);
    if (!Number.isInteger(q) || q < 1) throw new Error("Quantitat de samarretes no vàlida");
    unitats += q;
  }
  if (payload.corporativa) {
    if (!payload.empresa_nom || !payload.empresa_cif) {
      throw new Error("Falta el nom o el CIF/NIF de l'empresa");
    }
  }
  if (payload.recollida_idx === undefined || payload.recollida_idx === null || payload.recollida_idx === "") {
    throw new Error("Falta el punt de recollida de la samarreta");
  }
  const tarifa = tarifaActual();
  return { baseCentims: tarifa.preus.animar * unitats, unitats };
}

async function validarFisic(payload) {
  if (!payload.nom || !payload.cognoms || !payload.dni || !payload.data_naixement) {
    throw new Error("Falten dades d'identificació");
  }
  if (!dataNaixementValida(payload.data_naixement)) {
    throw new Error("La data de naixement no és vàlida");
  }
  if (!payload.telefon) throw new Error("Falta el telèfon mòbil");
  if (!emailValid(payload.email_contacte)) throw new Error("Falta un email vàlid");
  if (!payload.contacte_emergencia_nom || !payload.contacte_emergencia_telefon) {
    throw new Error("Falta el contacte d'emergència");
  }
  if (!payload.relacio) throw new Error("Falta la relació amb la diabetis tipus 1");
  if (!TALLES_VALIDES.includes(payload.talla_samarreta)) {
    throw new Error("Talla de samarreta no vàlida");
  }
  if (!payload.tram_inici || !payload.tram_final) {
    throw new Error("Falta el municipi d'inici o final del tram");
  }

  const tram = await calcularTram(payload.tram_inici, payload.tram_final);
  payload.tram_dies = tram.dies;
  payload.tram_km = tram.kmTotal;
  payload.tram_inici_nom = tram.iniciNom;
  payload.tram_final_nom = tram.finalNom;

  if (payload.federat && !payload.num_llicencia_federativa) {
    throw new Error("Falta el número de llicència federativa");
  }

  const esMenor = calcularEsMenor(payload.data_naixement);
  payload.es_menor = esMenor === true;
  if (payload.es_menor) {
    if (!payload.tutor_nom || !payload.tutor_cognoms || !payload.tutor_dni ||
        !payload.tutor_data_naixement || !payload.tutor_consentiment) {
      throw new Error("Falten les dades i el consentiment del mare/pare/tutor legal (participant menor d'edat)");
    }
  }

  if (!payload.acceptacio_reglament || !payload.consentiment_dades || !payload.cessio_imatge) {
    throw new Error("Falta acceptar totes les caselles legals");
  }
  if (payload.recollida_idx === undefined || payload.recollida_idx === null || payload.recollida_idx === "") {
    throw new Error("Falta el punt de recollida de la samarreta");
  }

  const tarifa = tarifaActual();
  const etapes = tram.dies.length;
  const baseCentims = tarifa.preus[etapes] || 0;
  return { baseCentims, unitats: etapes };
}

/**
 * Calcula l'import (en cèntims) d'una comanda i valida totes les dades
 * legals necessàries. Retorna { baseCentims, donacioCentims, totalCentims,
 * unitats }. MUTA `payload` per adjuntar-hi tram_dies/tram_km/es_menor
 * quan correspongui.
 */
async function calcularImport(payload) {
  if (!payload || !payload.modalitat) {
    throw new Error("Falta el camp 'modalitat'");
  }

  const donacioCentims = validarDonacio(payload);
  let resultat;

  if (payload.modalitat === "dorsal0") {
    resultat = await validarDorsal0(payload, donacioCentims);
  } else if (payload.modalitat === "animar") {
    resultat = await validarAnimar(payload);
  } else if (["caminant", "corrent", "bici"].includes(payload.modalitat)) {
    resultat = await validarFisic(payload);
  } else {
    throw new Error(`Modalitat desconeguda: ${payload.modalitat}`);
  }

  return {
    baseCentims: resultat.baseCentims,
    donacioCentims,
    totalCentims: resultat.baseCentims + donacioCentims,
    unitats: resultat.unitats,
  };
}

function descripcioComanda(payload) {
  const NOMS = {
    dorsal0: "Dorsal 0 (donació simbòlica)",
    animar: "Samarreta solidària",
    caminant: "Repte Llobregat x la Diabetis — Caminant",
    corrent: "Repte Llobregat x la Diabetis — Corrent",
    bici: "Repte Llobregat x la Diabetis — Bici",
  };
  return NOMS[payload.modalitat] || "Inscripció Llobregat x la Diabetis";
}

module.exports = {
  TARIFES,
  TALLES_VALIDES,
  DATA_INICI_REPTE,
  tarifaActual,
  calcularEsMenor,
  emailValid,
  calcularImport,
  descripcioComanda,
};
