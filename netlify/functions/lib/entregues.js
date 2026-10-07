// lib/entregues.js
//
// Estat del lliurament de bossa/pulsera/samarretes/pack Glucody i punt de
// recollida triat pel participant. Es guarda en un store de Netlify Blobs
// PROPI ("entregues"), una clau per comanda: la comanda original (blob
// "ordres") no es modifica mai.

const { getStore } = require("@netlify/blobs");
const { puntPerDefecte, puntPerId } = require("./punts");

function opcionsStore(name) {
  // "strong": llegeix sempre l'última versió (si no, una taula podria veure
  // dades de fa uns segons i lliurar dues vegades el mateix material).
  const opcions = { name, consistency: "strong" };
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) {
    opcions.siteID = process.env.NETLIFY_SITE_ID;
    opcions.token = process.env.NETLIFY_BLOBS_TOKEN;
  }
  return opcions;
}
function entreguesStore() { return getStore(opcionsStore("entregues")); }

// DISSENY PER A ÚS SIMULTANI I RÀPID: res no es reescriu mai sobre una mateixa
// clau des de dos llocs alhora. Cada lliurament és un esdeveniment NOU i únic
// i les dades que calen per saber l'estat van DINS DE LA CLAU, de manera que
// conèixer l'estat d'una comanda és UNA sola consulta de llista (sense llegir
// cada esdeveniment):
//   ev/<comanda>/<t>~<cid>~<elements>   valor: {tipus,data,mesa,voluntari}
//   punt/<comanda>                      {punt, punt_data, canvis_punt}
//   qr/<comanda>                        data ISO del correu amb el QR
//   index/cerca                         índex del buscador manual
// <t> és l'hora del toc al mòbil i <cid> un identificador únic de cada
// lliurament: si el mòbil repeteix la petició (mala cobertura), no es duplica.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function idValid(id) { return typeof id === "string" && UUID_RE.test(id); }

function codiItems(items) { return items.map((c) => String(c).replace("samarreta:", "samarreta_")).join(","); }
function itemsDeCodi(txt) { return txt.split(",").filter(Boolean).map((c) => (c.startsWith("samarreta_") ? "samarreta:" + c.slice(10) : c)); }

function parseEv(clau) {
  const parts = clau.split("/").slice(2).join("/").split("~");
  const [t, cid, elems] = parts;
  if (!t || !cid || elems === undefined) return null;
  if (elems === "!desfer") return { clau, t, cid, tipus: "desfer", items: [] };
  return { clau, t, cid, tipus: "entrega", items: itemsDeCodi(elems) };
}

function aplicaEvents(estat, events) {
  const ent = { bossa: false, pulsera: false, glucody: false, samarretes: {} };
  events.forEach((ev) => {
    if (ev.tipus === "desfer") {
      ent.bossa = ent.pulsera = ent.glucody = false; ent.samarretes = {};
    } else {
      ev.items.forEach((c) => {
        if (c.startsWith("samarreta:")) ent.samarretes[c.slice(10)] = true;
        else if (c in ent) ent[c] = true;
      });
    }
  });
  return { ...estat, entrega: ent, historial: events };
}

function eventsDeLlista(blobs) {
  return blobs.map((x) => parseEv(x.key)).filter(Boolean).sort((a, b) => (a.clau < b.clau ? -1 : 1));
}

// Llegeix l'estat d'una comanda: 3 consultes en paral·lel (punt, llista
// d'esdeveniments i marca del QR). Amb {detall:true} llegeix a més qui/quan
// va fer l'última entrega.
async function obtenirEstat(orderId, opcions) {
  const store = entreguesStore();
  const [punt, llista, qr] = await Promise.all([
    store.get(`punt/${orderId}`, { type: "json" }),
    store.list({ prefix: `ev/${orderId}/` }),
    store.get(`qr/${orderId}`),
  ]);
  const events = eventsDeLlista(llista.blobs);
  if (opcions && opcions.detall) {
    const ultima = events.filter((e) => e.tipus === "entrega").slice(-1)[0];
    if (ultima) Object.assign(ultima, (await store.get(ultima.clau, { type: "json" })) || {});
  }
  return aplicaEvents({ ...(punt || {}), qr_enviat: qr || undefined }, events);
}

// Resum de tots els estats (admin): una llista de claus + els punts triats.
async function llistarEstats() {
  const store = entreguesStore();
  const { blobs } = await store.list();
  const out = {};
  const get = (id) => (out[id] = out[id] || { _ev: [] });
  const lectures = [];
  blobs.forEach((b) => {
    const [tipus, id] = b.key.split("/");
    if (!UUID_RE.test(id || "")) return;
    if (tipus === "qr") get(id).qr_enviat = true;
    else if (tipus === "punt") lectures.push(store.get(b.key, { type: "json" }).then((v) => { if (v) Object.assign(get(id), v); }));
    else if (tipus === "ev") { const e = parseEv(b.key); if (e) get(id)._ev.push(e); }
  });
  for (let i = 0; i < lectures.length; i += 50) await Promise.all(lectures.slice(i, i + 50));
  Object.keys(out).forEach((id) => {
    const evs = out[id]._ev.sort((x, y) => (x.clau < y.clau ? -1 : 1));
    delete out[id]._ev;
    out[id] = aplicaEvents(out[id], evs);
  });
  return out;
}

// Què ha de rebre cada comanda. Regles:
//  - bossa i pulsera: només participants (caminant / corrent / bici).
//  - pack Glucody: qui té diabetis tipus 1 o un familiar/amic (relacio
//    "tinc" o "familiar"), de qualsevol modalitat excepte dorsal 0.
//  - samarretes: les de payload.samarretes (talla + quantitat).
const PARTICIPANTS = new Set(["caminant", "corrent", "bici"]);

function elementsComanda(ordre) {
  const p = (ordre && ordre.payload) || {};
  const mod = String((ordre && ordre.modalitat) || p.modalitat || "").toLowerCase();
  const participant = PARTICIPANTS.has(mod);
  const relacio = String(p.relacio || "").toLowerCase();
  const glucody = mod !== "dorsal0" && (relacio === "tinc" || relacio === "familiar");
  const samarretes = (Array.isArray(p.samarretes) ? p.samarretes : [])
    .map((s) => ({ talla: String((s && s.talla) || ""), quantitat: Number((s && s.quantitat) || 0) }))
    .filter((s) => s.talla && s.quantitat > 0);
  const e = { bossa: participant, pulsera: participant, glucody, samarretes };
  e.res = e.bossa || e.pulsera || e.glucody || e.samarretes.length > 0;
  return e;
}

function estaPagada(ordre) {
  return String((ordre && ordre.estat) || "").trim().toLowerCase() === "pagat";
}

function puntEfectiu(ordre, estat) {
  const triat = estat && estat.punt;
  if (triat && puntPerId(triat)) return triat;
  return puntPerDefecte(ordre);
}

// Elements lliurats fins ara.
function entregat(estat) {
  const it = (estat && estat.entrega) || {};
  return { bossa: !!it.bossa, pulsera: !!it.pulsera, glucody: !!it.glucody, samarretes: it.samarretes || {} };
}

function checklist(ordre, estat) {
  const e = elementsComanda(ordre);
  const d = entregat(estat);
  const items = [];
  if (e.bossa) items.push({ clau: "bossa", entregat: d.bossa });
  if (e.pulsera) items.push({ clau: "pulsera", entregat: d.pulsera });
  if (e.glucody) items.push({ clau: "glucody", entregat: d.glucody });
  e.samarretes.forEach((s) =>
    items.push({ clau: "samarreta:" + s.talla, talla: s.talla, quantitat: s.quantitat, entregat: !!d.samarretes[s.talla] }));
  return { items, complet: items.length > 0 && items.every((i) => i.entregat) };
}

function nouCid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
const CID_RE = /^[a-z0-9-]{6,40}$/i;

// Aplica una entrega: només es poden MARCAR elements. Escriu un esdeveniment
// NOU (mai reescriu res). Idempotent: si arriba dues vegades el mateix "cid"
// (reintent per mala cobertura), la segona no fa res i diu que ja estava.
async function registrarEntrega(orderId, ordre, claus, meta, estatPrevi) {
  const store = entreguesStore();
  const estat = estatPrevi || (await obtenirEstat(orderId));
  const cid = CID_RE.test(String(meta.cid || "")) ? String(meta.cid) : nouCid();
  const repetit = estat.historial.find((e) => e.cid === cid);
  if (repetit) return { estat, aplicats: repetit.items, duplicats: [], repetit: true };

  const cl = checklist(ordre, estat);
  const valides = new Set(cl.items.filter((i) => !i.entregat).map((i) => i.clau));
  const aplicats = (claus || []).filter((c) => valides.has(c));
  if (!aplicats.length) return { estat, aplicats: [], duplicats: [] };

  let t = new Date().toISOString();
  const tc = meta.t ? new Date(meta.t) : null;
  if (tc && !isNaN(tc) && Math.abs(tc - Date.now()) < 24 * 3600 * 1000) t = tc.toISOString();
  const clau = `ev/${orderId}/${t}~${cid}~${codiItems(aplicats)}`;
  await store.setJSON(clau, { tipus: "entrega", data: new Date().toISOString(), mesa: meta.mesa, voluntari: meta.voluntari });

  // Detecció de duplicats: esdeveniments d'altres voluntaris que han aparegut
  // DESPRÉS de la nostra primera lectura i inclouen el mateix element.
  const coneguts = new Set(estat.historial.map((e) => e.clau));
  const { blobs } = await store.list({ prefix: `ev/${orderId}/` });
  const events = eventsDeLlista(blobs);
  const duplicats = [];
  events.forEach((e) => {
    if (e.clau === clau || coneguts.has(e.clau) || e.tipus !== "entrega") return;
    e.items.forEach((c) => { if (aplicats.includes(c) && !duplicats.includes(c)) duplicats.push(c); });
  });
  return { estat: aplicaEvents(estat, events), aplicats, duplicats };
}

// Desfer (només admin): nou esdeveniment; l'historial es conserva.
async function desferEntrega(orderId) {
  await entreguesStore().setJSON(`ev/${orderId}/${new Date().toISOString()}~admin${nouCid()}~!desfer`, { tipus: "desfer", data: new Date().toISOString() });
  return obtenirEstat(orderId);
}

async function canviarPunt(orderId, punt) {
  const store = entreguesStore();
  const actual = (await store.get(`punt/${orderId}`, { type: "json" })) || {};
  const data = new Date().toISOString();
  const nou = { punt, punt_data: data, canvis_punt: (actual.canvis_punt || []).concat([{ data, de: actual.punt || null, a: punt }]).slice(-20) };
  await store.setJSON(`punt/${orderId}`, nou);
  return obtenirEstat(orderId);
}

async function marcarQrEnviat(orderId) {
  await entreguesStore().set(`qr/${orderId}`, new Date().toISOString());
}

// Índex lleuger per a la cerca manual (una sola lectura en lloc de llegir
// totes les comandes a cada cerca). Es reconstrueix des de l'admin o
// automàticament si no n'hi ha.
async function llegirIndex() { return entreguesStore().get("index/cerca", { type: "json" }); }
async function desarIndex(ix) { await entreguesStore().setJSON("index/cerca", ix); }

module.exports = {
  idValid, obtenirEstat, llistarEstats, elementsComanda, estaPagada,
  puntEfectiu, checklist, entregat, registrarEntrega, desferEntrega, canviarPunt, marcarQrEnviat, llegirIndex, desarIndex,
};
