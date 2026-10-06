// lib/pricing.js
// Fuente única de verdad para precios y validación legal. NUNCA se confía
// en el importe ni en las validaciones que vengan del frontend.

const { calcularTram, arrodonirKm } = require("./route");
const { llistarOrdres, comptarLastMinutePagades } = require("./store");

// Interruptor únic i manual per tancar les inscripcions (totes les
// modalitats, incloent Dorsal 0 -- qui vulgui col·laborar un cop tancat ho
// fa fent una donació a /dona, no inscrivint-se aquí). Mentre sigui `true`,
// calcularImport() rebutja QUALSEVOL comanda nova abans de validar res més
// -- és el mateix punt d'entrada que fa servir submit-registration.js per a
// totes les modalitats, així que n'hi ha prou amb aquest únic lloc. No és
// una data de tall automàtica (com les tarifes TARIFES de sota): algú ha de
// tornar a posar-ho a `false` (i desplegar) si mai es reobrissin les
// inscripcions.
const INSCRIPCIONS_TANCADES = true;

// Inscripcions "last minute" (octubre 2026): una finestra curta i molt
// restringida que s'obre MALGRAT INSCRIPCIONS_TANCADES -- vegeu
// calcularImport() més avall, on el flag payload.last_minute salta el
// tancament general nomes per a dorsal0/caminant/corrent/bici (mai per
// "animar"). Nomes des de 4 punts molt a prop del final, o des de la
// Caminada de Cloenda; preu fix, sense samarreta, aforament limitat.
// MANTENIR SINCRONITZAT amb les mateixes constants al frontend
// (inscripcio-last-minute.html): no hi ha cap mecanisme automàtic que ho
// faci per nosaltres.
const LAST_MINUT_LIMIT = 100;
const LAST_MINUT_PREU_CENTIMS = 700; // 7 € tancats, independents de tarifes/etapes
// Fi de la finestra: final del dilluns 12 d'octubre de 2026, hora
// peninsular espanyola (CEST, UTC+2) -> 2026-10-12T22:00:00Z. Si en
// realitat es volia tallar a una altra hora, només cal canviar aquesta
// constant (i la mateixa de inscripcio-last-minute.html).
const LAST_MINUT_CUTOFF_ISO = "2026-10-12T22:00:00.000Z";
const LAST_MINUT_FINAL_ID = "desembocadura-del-llobregat";
const LAST_MINUT_PUNTS_PERMESOS = [
  "sant-boi-de-llobregat",
  "sant-joan-despi",
  "cornella-de-llobregat",
  "l-hospitalet-de-llobregat",
];

// Tarifes per fases (early bird / estàndard / last call). Els preus de
// cada casella són valors fixos per tarifa, no una fórmula.
const TARIFES = [
  { id: "earlybird", cutoff: "2026-09-10", preus: { animar: 1000, 1: 1500, 2: 3000, 3: 4500 } },
  { id: "standard", cutoff: "2026-10-02", preus: { animar: 1200, 1: 2000, 2: 3500, 3: 5000 } },
  { id: "lastcall", cutoff: "2026-10-04", preus: { animar: 1500, 1: 2200, 2: 4000, 3: 5500 } },
];

function tarifaActual() {
  const avui = new Date().toISOString().slice(0, 10);
  for (const tarifa of TARIFES) {
    if (avui <= tarifa.cutoff) return tarifa;
  }
  return TARIFES[TARIFES.length - 1];
}

// Cada valor porta el prefix de categoria (home- / dona- / infantil-) perquè
// una mateixa lletra (p. ex. "M") és un tall diferent segons la categoria.
const TALLES_ADULT = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const TALLES_INFANTIL = ["4", "6", "8", "10", "12", "14"];

const TALLES_VALIDES = [
  ...TALLES_ADULT.map((t) => `home-${t}`),
  ...TALLES_ADULT.map((t) => `dona-${t}`),
  ...TALLES_INFANTIL.map((t) => `infantil-${t}`),
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

// Validacions mínimes al backend (mateix criteri que el formulari): no és
// una font de veritat estricta (no comprovem dígit de control del DNI),
// només evitar valors clarament random si algú crida l'API directament.
function telefonValid(str) {
  return typeof str === "string" && /^[0-9]{9,15}$/.test(str.trim());
}
function dniValid(str) {
  return typeof str === "string" && /^[A-Za-z0-9]{5,12}$/.test(str.trim());
}

// Codis de descompte vàlids: llista separada per comes a la variable
// d'entorn HEROIS_CODES (p. ex. "ANNA2026,MARC2026,CORESOLIDARIS5:500"). Es
// guarda com a secret a Netlify, no al codi, perquè es pugui actualitzar
// sense fer deploy.
//
// Cada entrada és:
//   - "CODI"          -> descompte complet (gratuït). Comportament per
//                        defecte, el que ja tenien els codis d'Heroi:
//                        participació sense cost com a reconeixement per
//                        qui ajuda a recaptar fons.
//   - "CODI:CENTIMS"  -> descompte parcial d'aquest import, en cèntims
//                        (p. ex. ":500" = 5 €). Pensat per a col·laboradors
//                        com Corresolidaris, que no participen gratis sinó
//                        amb un descompte fix.
function parsCodisDescompte() {
  return (process.env.HEROIS_CODES || "")
    .split(",")
    .map((entrada) => entrada.trim())
    .filter(Boolean)
    .map((entrada) => {
      const [codiRaw, centimsRaw] = entrada.split(":");
      const codi = (codiRaw || "").trim().toUpperCase();
      const centims = centimsRaw !== undefined ? parseInt(centimsRaw.trim(), 10) : NaN;
      const gratis = !Number.isFinite(centims);
      return { codi, gratis, descompteCentims: gratis ? null : centims };
    })
    .filter((c) => c.codi);
}

// Retorna la info del codi ({ codi, gratis, descompteCentims }) o null si
// no existeix. No valida encara el modalitat/import -- això es fa a
// calcularImport.
function trobarCodiDescompte(codi) {
  if (!codi) return null;
  const cercat = String(codi).trim().toUpperCase();
  return parsCodisDescompte().find((c) => c.codi === cercat) || null;
}

// Manté el nom històric (usat per validar-codi.js i el frontend antic):
// només diu si el codi existeix, sense revelar l'import del descompte.
function codiHeroiValid(codi) {
  return trobarCodiDescompte(codi) !== null;
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
  if (!telefonValid(payload.telefon)) throw new Error("El telèfon no és vàlid");
  if (donacioCentims <= 0) {
    throw new Error("El Dorsal 0 requereix una donació superior a 0 €");
  }
  return { baseCentims: 0, unitats: 0 };
}

async function validarAnimar(payload) {
  if (!payload.nom || !payload.cognoms) throw new Error("Falta el nom i cognoms");
  if (!emailValid(payload.email_contacte)) throw new Error("Falta un email vàlid");
  if (!payload.telefon) throw new Error("Falta el telèfon");
  if (!telefonValid(payload.telefon)) throw new Error("El telèfon no és vàlid");
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
  if (!payload.recollida_municipi) {
    throw new Error("Falta el municipi de recollida de la samarreta");
  }
  const tarifa = tarifaActual();
  return { baseCentims: tarifa.preus.animar * unitats, unitats };
}

async function validarFisic(payload) {
  if (!payload.nom || !payload.cognoms || !payload.dni || !payload.data_naixement) {
    throw new Error("Falten dades d'identificació");
  }
  if (!dniValid(payload.dni)) throw new Error("El DNI/NIE/Passaport no és vàlid");
  if (!dataNaixementValida(payload.data_naixement)) {
    throw new Error("La data de naixement no és vàlida");
  }
  if (!payload.telefon) throw new Error("Falta el telèfon mòbil");
  if (!telefonValid(payload.telefon)) throw new Error("El telèfon no és vàlid");
  if (!emailValid(payload.email_contacte)) throw new Error("Falta un email vàlid");
  if (!payload.relacio) throw new Error("Falta la relació amb la diabetis tipus 1");
  // "altre" és una opció vàlida al formulari (select .fi-sexe) des de fa
  // temps — aquesta llista blanca es va quedar desactualitzada i rebutjava
  // qualsevol inscripció amb sexe "altre" amb un error confús ("Falta
  // indicar el sexe" encara que sí que s'hagués triat). La talla de
  // samarreta no depèn d'això (TALLES_VALIDES ja accepta home-* i dona-*
  // independentment del sexe marcat), així que només calia ampliar
  // aquesta llista.
  if (!["home", "dona", "altre"].includes(payload.sexe)) throw new Error("Falta indicar el sexe");
  if (!payload.contacte_emergencia_nom || !payload.contacte_emergencia_telefon) {
    throw new Error("Falta el contacte d'emergència");
  }
  if (!telefonValid(payload.contacte_emergencia_telefon)) {
    throw new Error("El telèfon d'emergència no és vàlid");
  }
  if (!TALLES_VALIDES.includes(payload.talla_samarreta)) {
    throw new Error("Talla de samarreta no vàlida");
  }
  if (!payload.tram_inici || !payload.tram_final) {
    throw new Error("Falta el municipi d'inici o final del tram");
  }

  const tram = await calcularTram(payload.tram_inici, payload.tram_final);
  payload.tram_dies = tram.dies;
  // La Caminada de Cloenda es fa d'anada i tornada des d'un mateix punt: el
  // km que dona calcularTram es nomes la meitat (la distancia entre els dos
  // punts), aixi que el dupliquem aqui, a l'origen, perque tot el que es
  // deriva d'aquest valor (MailerLite, la targeta de gracies.html, el propi
  // resum de la comanda) surti ja consistent amb els 4 km reals.
  payload.tram_km = payload.tram_tipus === "cloenda" ? arrodonirKm(tram.kmTotal * 2) : tram.kmTotal;
  payload.tram_inici_nom = tram.iniciNom;
  payload.tram_final_nom = tram.finalNom;

  // Cada etapa inclou una samarreta. Guardem també aquesta informació de
  // manera explícita dins del payload perquè quedi visible al Blob i es
  // pugui enviar a MailerLite igual que les samarretes de "animar".
  payload.samarretes = [{
    talla: payload.talla_samarreta,
    quantitat: tram.dies.length,
  }];

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
    if (!dniValid(payload.tutor_dni)) {
      throw new Error("El DNI/NIE/Passaport del tutor legal no és vàlid");
    }
  }

  if (!payload.acceptacio_reglament || !payload.consentiment_dades || !payload.cessio_imatge) {
    throw new Error("Falta acceptar totes les caselles legals");
  }
  if (!payload.recollida_municipi) {
    throw new Error("Falta el municipi de recollida de la samarreta");
  }

  const tarifa = tarifaActual();
  const etapes = tram.dies.length;
  // La Caminada de Cloenda (tram_tipus === "cloenda") té preu fix, igual
  // que la samarreta solidària -- no es cobra segons el nombre de
  // dies/etapes com la resta de trams físics (de fet sempre és 1 dia,
  // però encara que no ho fos, el preu seria sempre aquest).
  const baseCentims = payload.tram_tipus === "cloenda"
    ? tarifa.preus.animar
    : (tarifa.preus[etapes] || 0);
  return { baseCentims, unitats: etapes };
}

// Comanda "last minute" si el seu payload du el flag (vegeu calcularImport).
// Comptem pendents + pagades perquè reservin plaça igual que una pagada:
// si només comptéssim les pagades, molta gent podria arribar alhora al
// checkout de Stripe i es sobrevendria l'aforament abans que cap arribés a
// pagar. No hi ha cap transacció atòmica real aquí (Netlify Blobs no en
// dona), així que en un pic de trànsit extremadament just hi pot haver
// algun petit marge d'error -- igual que a la resta del lloc, que tampoc
// en té enlloc.
function esComandaLastMinute(o) {
  // Dorsal 0 ("dorsal 0 se mantiene") no consumeix plaça física last
  // minute: només compten caminant/corrent/bici contra el límit de 100.
  return !!(
    o &&
    o.payload &&
    o.payload.last_minute === true &&
    ["caminant", "corrent", "bici"].includes(o.payload.modalitat)
  );
}

// Només compten les comandes last minute PAGADES (índex lleuger a
// store.js). Abans es llegien totes les comandes (lent) i a més comptaven
// també les pendents/abandonades, que ocupaven plaça sense haver pagat.
async function comptarLastMinuteOcupades() {
  return comptarLastMinutePagades();
}

async function validarFisicLastMinute(payload) {
  if (Date.now() > new Date(LAST_MINUT_CUTOFF_ISO).getTime()) {
    throw new Error("Les inscripcions last minute ja han tancat.");
  }
  const ocupades = await comptarLastMinuteOcupades();
  if (ocupades >= LAST_MINUT_LIMIT) {
    throw new Error("Ja no queden places last minute disponibles.");
  }

  if (!payload.nom || !payload.cognoms || !payload.dni || !payload.data_naixement) {
    throw new Error("Falten dades d'identificació");
  }
  if (!dniValid(payload.dni)) throw new Error("El DNI/NIE/Passaport no és vàlid");
  if (!dataNaixementValida(payload.data_naixement)) {
    throw new Error("La data de naixement no és vàlida");
  }
  if (!payload.telefon) throw new Error("Falta el telèfon mòbil");
  if (!telefonValid(payload.telefon)) throw new Error("El telèfon no és vàlid");
  if (!emailValid(payload.email_contacte)) throw new Error("Falta un email vàlid");
  if (!payload.relacio) throw new Error("Falta la relació amb la diabetis tipus 1");
  if (!["home", "dona", "altre"].includes(payload.sexe)) throw new Error("Falta indicar el sexe");
  if (!payload.contacte_emergencia_nom || !payload.contacte_emergencia_telefon) {
    throw new Error("Falta el contacte d'emergència");
  }
  if (!telefonValid(payload.contacte_emergencia_telefon)) {
    throw new Error("El telèfon d'emergència no és vàlid");
  }

  // Nomes des de la Caminada de Cloenda (inici i final fixos), o des d'un
  // dels 4 punts permesos amb el final lliure: calcularTram ja comprova que
  // el final existeix i és posterior a l'inici dins el recorregut.
  let iniciId;
  let finalId = LAST_MINUT_FINAL_ID;
  if (payload.tram_tipus === "cloenda") {
    iniciId = "el-prat-de-llobregat";
  } else if (payload.tram_tipus === "personalitzat" && LAST_MINUT_PUNTS_PERMESOS.includes(payload.tram_inici)) {
    iniciId = payload.tram_inici;
    if (!payload.tram_final) throw new Error("Falta el municipi final del tram");
    finalId = payload.tram_final;
  } else {
    throw new Error(
      "Aquesta inscripció last minute només es pot fer des de Sant Boi, Sant Joan Despí, Cornellà o l'Hospitalet, o fent la Caminada de Cloenda."
    );
  }
  const tram = await calcularTram(iniciId, finalId);
  payload.tram_inici = iniciId;
  payload.tram_final = finalId;
  payload.tram_dies = tram.dies;
  payload.tram_km = payload.tram_tipus === "cloenda" ? arrodonirKm(tram.kmTotal * 2) : tram.kmTotal;
  payload.tram_inici_nom = tram.iniciNom;
  payload.tram_final_nom = tram.finalNom;

  if (!payload.recollida_municipi) {
    throw new Error("Falta el municipi de recollida");
  }

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
    if (!dniValid(payload.tutor_dni)) {
      throw new Error("El DNI/NIE/Passaport del tutor legal no és vàlid");
    }
  }

  if (!payload.acceptacio_reglament || !payload.consentiment_dades || !payload.cessio_imatge) {
    throw new Error("Falta acceptar totes les caselles legals");
  }

  // Sense samarreta: no es demana talla_samarreta, i
  // no s'afegeix res a payload.samarretes -- shirtEntries() a
  // public-stats.js ja ignora les comandes sense talla/array, així que no
  // calen canvis allà per excloure-les del recompte de samarretes.
  return { baseCentims: LAST_MINUT_PREU_CENTIMS, unitats: 1 };
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

  // El flag last_minute (vegeu inscripcio-last-minute.html) salta el
  // tancament general -- però només per a dorsal0/caminant/corrent/bici:
  // "animar" (samarreta solidària) es queda tancat sempre, encara que
  // algú manipulés la petició per afegir-hi el flag.
  const ferLastMinute = payload.last_minute === true &&
    ["dorsal0", "caminant", "corrent", "bici"].includes(payload.modalitat);

  if (INSCRIPCIONS_TANCADES && !ferLastMinute) {
    throw new Error(
      "Les inscripcions estan tancades. Si vols col·laborar amb el repte, pots fer una donació a /dona."
    );
  }

  const donacioCentims = validarDonacio(payload);
  let resultat;

  if (payload.modalitat === "dorsal0") {
    resultat = await validarDorsal0(payload, donacioCentims);
  } else if (payload.modalitat === "animar") {
    resultat = await validarAnimar(payload);
  } else if (["caminant", "corrent", "bici"].includes(payload.modalitat)) {
    resultat = ferLastMinute ? await validarFisicLastMinute(payload) : await validarFisic(payload);
  } else {
    throw new Error(`Modalitat desconeguda: ${payload.modalitat}`);
  }

  // Codi de descompte (Heroi = gratuït, o parcial per cèntims -- p. ex.
  // Corresolidaris). El Dorsal 0 ja és una donació simbòlica, així que el
  // codi no hi aplica.
  let descompteHeroiAplicat = false;
  let descompteCentimsAplicat = 0;
  // Last minute: preu fix, no admet cap codi de descompte (s'ignora).
  if (ferLastMinute) payload.codi_descompte = "";
  if (payload.codi_descompte && payload.modalitat !== "dorsal0") {
    const info = trobarCodiDescompte(payload.codi_descompte);
    if (!info) {
      throw new Error("El codi de descompte no és vàlid");
    }
    if (info.gratis) {
      descompteCentimsAplicat = resultat.baseCentims;
      resultat.baseCentims = 0;
    } else {
      descompteCentimsAplicat = Math.min(info.descompteCentims, resultat.baseCentims);
      resultat.baseCentims -= descompteCentimsAplicat;
    }
    descompteHeroiAplicat = true;
  }

  return {
    baseCentims: resultat.baseCentims,
    donacioCentims,
    totalCentims: resultat.baseCentims + donacioCentims,
    unitats: resultat.unitats,
    descompteHeroiAplicat,
    descompteCentimsAplicat,
  };
}

function descripcioComanda(payload) {
  if (payload && payload.last_minute === true && ["caminant", "corrent", "bici"].includes(payload.modalitat)) {
    return "Repte Llobregat x la Diabetis — Inscripció last minute";
  }
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
  INSCRIPCIONS_TANCADES,
  LAST_MINUT_LIMIT,
  LAST_MINUT_PREU_CENTIMS,
  LAST_MINUT_CUTOFF_ISO,
  LAST_MINUT_FINAL_ID,
  LAST_MINUT_PUNTS_PERMESOS,
  comptarLastMinuteOcupades,
  TARIFES,
  TALLES_VALIDES,
  TALLES_ADULT,
  TALLES_INFANTIL,
  DATA_INICI_REPTE,
  tarifaActual,
  calcularEsMenor,
  emailValid,
  calcularImport,
  descripcioComanda,
  codiHeroiValid,
  trobarCodiDescompte,
};
