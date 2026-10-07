// lib/punts.js
//
// ÚNICA font de veritat dels punts de recollida (bossa, pulsera, samarreta i
// pack Glucody): la fan servir el perfil del participant, l'escàner dels
// voluntaris, els correus i la pàgina informativa. Si canvia un horari o un
// lloc, es canvia NOMÉS aquí.
//
// El punt escollit per cada participant NO es guarda a la comanda (blob
// "ordres"), sinó a part, al store "entregues" (vegeu lib/entregues.js).

const { ORDRES: ORDRES_SANT_JUST } = require("./recollida-especial");

// Últim moment per canviar de punt: 11/10/2026 23:59:59 hora de Madrid
// (CEST = UTC+2). A partir del 12/10 ja no es pot canviar.
const LIMIT_CANVI_ISO = "2026-10-11T21:59:59.999Z";

const SANT_JUST = new Set(ORDRES_SANT_JUST.map(([id]) => id));

// seleccionable: apareix al desplegable del participant.
// mesa: un voluntari pot triar-lo com a taula d'entrega.
// claus: fragments (sense accents ni majúscules) del text de recollida de la
//        comanda que assignen aquest punt per defecte.
const PUNTS = [
  {
    id: "alsamasa", seleccionable: true, mesa: true, claus: ["hospitalet", "cornella"],
    nom: { ca: "Alsamasa (Esplugues de Llobregat)", es: "Alsamasa (Esplugues de Llobregat)", en: "Alsamasa (Esplugues de Llobregat)" },
    quan: { ca: "14, 15 i 16 d'octubre, de 9h a 19h", es: "14, 15 y 16 de octubre, de 9h a 19h", en: "October 14, 15 and 16, 9am–7pm" },
    per: { ca: "L'Hospitalet i Cornellà", es: "L'Hospitalet y Cornellà", en: "L'Hospitalet and Cornellà" },
  },
  {
    id: "biblioteca-sjd", seleccionable: true, mesa: true,
    claus: ["sant joan desp", "sant boi", "sant vicen", "pallej", "sant andreu", "santa coloma"],
    nom: { ca: "Biblioteca Mercè Rodoreda (Sant Joan Despí)", es: "Biblioteca Mercè Rodoreda (Sant Joan Despí)", en: "Mercè Rodoreda Library (Sant Joan Despí)" },
    quan: { ca: "14 d'octubre, de 16h a 20h", es: "14 de octubre, de 16h a 20h", en: "October 14, 4pm–8pm" },
    per: { ca: "Sant Joan Despí i municipis veïns riu amunt", es: "Sant Joan Despí y municipios vecinos río arriba", en: "Sant Joan Despí and neighbouring towns upstream" },
  },
  {
    id: "salvador-boada", seleccionable: true, mesa: true, claus: ["martorell", "esparreguera", "olesa"],
    nom: { ca: "Complex esportiu municipal Salvador Boada (Martorell)", es: "Complejo deportivo municipal Salvador Boada (Martorell)", en: "Salvador Boada municipal sports complex (Martorell)" },
    quan: { ca: "14, 15 i 16 d'octubre, de 7h a 22h", es: "14, 15 y 16 de octubre, de 7h a 22h", en: "October 14, 15 and 16, 7am–10pm" },
    per: { ca: "Martorell, Esparreguera i Olesa", es: "Martorell, Esparreguera y Olesa", en: "Martorell, Esparreguera and Olesa" },
  },
  {
    id: "castellar", seleccionable: true, mesa: true, claus: ["castellar"],
    nom: { ca: "Castellar de n'Hug (Hostal La Closa / plaça de l'Ajuntament)", es: "Castellar de n'Hug (Hostal La Closa / plaza del Ayuntamiento)", en: "Castellar de n'Hug (Hostal La Closa / Town Hall square)" },
    quan: { ca: "15 d'octubre de 20h a 22h a l'Hostal La Closa · 16 d'octubre de 7:30h a 7:50h a la plaça de l'Ajuntament", es: "15 de octubre de 20h a 22h en el Hostal La Closa · 16 de octubre de 7:30h a 7:50h en la plaza del Ayuntamiento", en: "October 15, 8pm–10pm at Hostal La Closa · October 16, 7:30am–7:50am at the Town Hall square" },
    per: { ca: "Castellar de n'Hug", es: "Castellar de n'Hug", en: "Castellar de n'Hug" },
  },
  {
    id: "gironella", seleccionable: true, mesa: true, claus: ["gironella"],
    nom: { ca: "Gironella (arribada de la 1a etapa)", es: "Gironella (llegada de la 1.ª etapa)", en: "Gironella (stage 1 finish)" },
    quan: { ca: "16 d'octubre, de 18h a 19h", es: "16 de octubre, de 18h a 19h", en: "October 16, 6pm–7pm" },
    per: { ca: "Gironella", es: "Gironella", en: "Gironella" },
  },
  {
    id: "monistrol", seleccionable: true, mesa: true, claus: ["monistrol"],
    nom: { ca: "Monistrol de Montserrat (arribada de la 2a etapa)", es: "Monistrol de Montserrat (llegada de la 2.ª etapa)", en: "Monistrol de Montserrat (stage 2 finish)" },
    quan: { ca: "17 d'octubre, de 18h a 19h", es: "17 de octubre, de 18h a 19h", en: "October 17, 6pm–7pm" },
    per: { ca: "Monistrol de Montserrat", es: "Monistrol de Montserrat", en: "Monistrol de Montserrat" },
  },
  {
    id: "berga", seleccionable: true, mesa: true, claus: ["berga"],
    nom: { ca: "Berga (Escola Fedac Xarxa)", es: "Berga (Escola Fedac Xarxa)", en: "Berga (Escola Fedac Xarxa)" },
    quan: { ca: "16 d'octubre, de 9h a 16h", es: "16 de octubre, de 9h a 16h", en: "October 16, 9am–4pm" },
    per: { ca: "Berga", es: "Berga", en: "Berga" },
  },
  {
    id: "sallent", seleccionable: true, mesa: true, claus: ["sallent"],
    nom: { ca: "Sallent (lliurament amb l'Eli)", es: "Sallent (entrega con Eli)", en: "Sallent (handover with Eli)" },
    quan: { ca: "Durant el 15 d'octubre", es: "Durante el 15 de octubre", en: "During October 15" },
    per: { ca: "Sallent", es: "Sallent", en: "Sallent" },
  },
  {
    id: "navas", seleccionable: true, mesa: true, claus: ["navas"],
    nom: { ca: "Navàs (lliurament a la pujada)", es: "Navàs (entrega en la subida)", en: "Navàs (handover on the climb)" },
    quan: { ca: "Durant el 15 d'octubre", es: "Durante el 15 de octubre", en: "During October 15" },
    per: { ca: "Navàs", es: "Navàs", en: "Navàs" },
  },
  {
    id: "manresa", seleccionable: true, mesa: true, claus: ["manresa"],
    nom: { ca: "Manresa (lliurament amb l'ADCC)", es: "Manresa (entrega con la ADCC)", en: "Manresa (handover with ADCC)" },
    quan: { ca: "Durant el 15 d'octubre", es: "Durante el 15 de octubre", en: "During October 15" },
    per: { ca: "Manresa", es: "Manresa", en: "Manresa" },
  },
  {
    id: "cal-rosal", seleccionable: true, mesa: true, claus: ["cal rosal"],
    nom: { ca: "Cal Rosal (lliurament amb la Montse)", es: "Cal Rosal (entrega con Montse)", en: "Cal Rosal (handover with Montse)" },
    quan: { ca: "La Montse ho coordinarà amb tu", es: "Montse lo coordinará contigo", en: "Montse will arrange it with you" },
    per: { ca: "Cal Rosal", es: "Cal Rosal", en: "Cal Rosal" },
  },
  {
    id: "prat", seleccionable: true, mesa: true, claus: ["prat", "desembocadura"],
    nom: { ca: "El Prat de Llobregat (Parking Cal Tet)", es: "El Prat de Llobregat (Parking Cal Tet)", en: "El Prat de Llobregat (Cal Tet car park)" },
    quan: { ca: "Diumenge 18 d'octubre, de 15h a 16h", es: "Domingo 18 de octubre, de 15h a 16h", en: "Sunday October 18, 3pm–4pm" },
    per: { ca: "El Prat i Desembocadura", es: "El Prat y Desembocadura", en: "El Prat and the river mouth" },
  },
  {
    // Llista especial de l'organització: no es pot canviar des del perfil.
    id: "sant-just", seleccionable: false, mesa: true, claus: [],
    nom: { ca: "Club Bàsquet Sant Just", es: "Club Bàsquet Sant Just", en: "Club Bàsquet Sant Just" },
    quan: { ca: "Ho gestiona el club; consulta amb l'organització", es: "Lo gestiona el club; consulta con la organización", en: "Handled by the club; check with the organisation" },
    per: { ca: "Llista de l'organització", es: "Lista de la organización", en: "Organisation list" },
  },
];

const ALTRES = {
  id: "altres", seleccionable: false, mesa: false, claus: [],
  nom: { ca: "Per assignar (consulta amb l'organització)", es: "Por asignar (consulta con la organización)", en: "To be assigned (check with the organisation)" },
  quan: { ca: "Tria un punt al desplegable", es: "Elige un punto en el desplegable", en: "Choose a point from the list" },
  per: { ca: "Resta", es: "Resto", en: "Other" },
};

const PER_ID = new Map(PUNTS.concat([ALTRES]).map((p) => [p.id, p]));

function normalitzar(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function puntPerId(id) { return PER_ID.get(id) || null; }

// Punt assignat per defecte segons el lloc de recollida de la comanda.
function puntPerDefecte(ordre) {
  if (!ordre) return ALTRES.id;
  if (SANT_JUST.has(ordre.order_id)) return "sant-just";
  const p = ordre.payload || {};
  // Inscripcions noves: el participant ja ha triat un punt concret al formulari.
  const triat = p.recollida_punt && PER_ID.get(String(p.recollida_punt));
  if (triat && triat.seleccionable) return triat.id;
  const t = normalitzar(ordre.recollida_text || p.recollida_municipi_nom || p.recollida_municipi);
  for (const pt of PUNTS) {
    if (pt.claus.some((k) => t.includes(k))) return pt.id;
  }
  return ALTRES.id;
}

function dinsDeTermini(ara) {
  return (ara || new Date()).getTime() <= new Date(LIMIT_CANVI_ISO).getTime();
}

// Versió per enviar al navegador (sense claus internes).
function publicPunt(p) {
  return { id: p.id, nom: p.nom, quan: p.quan, per: p.per, seleccionable: p.seleccionable, mesa: p.mesa };
}

module.exports = {
  PUNTS, ALTRES, LIMIT_CANVI_ISO, puntPerId, puntPerDefecte, dinsDeTermini,
  publicPunt, normalitzar,
};
