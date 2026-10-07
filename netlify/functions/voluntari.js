// netlify/functions/voluntari.js
//
// API de l'escàner dels voluntaris. Accés amb un codi compartit (variable
// d'entorn VOLUNTARI_CODE) enviat a la capçalera "x-voluntari-code". Si la
// variable no existeix, l'endpoint queda TANCAT.
//
// Accions (POST JSON):
//   login    {}                       -> comprova el codi, retorna les taules
//   escaneig {text, mesa}             -> valida un QR (o un id) per a una taula
//   cerca    {q}                      -> cerca manual per nom, email o DNI
//   entrega  {id, mesa, voluntari, items:[clau,...]} -> registra el lliurament
//
// Regla (bloqueig total): una persona només es pot atendre a la taula que
// té assignada. Si no és la seva, es retorna l'error i la taula assignada.

const { obtenirOrdre } = require("./lib/store");
const { cercar } = require("./lib/index-cerca");
const { PUNTS, puntPerId, publicPunt } = require("./lib/punts");
const E = require("./lib/entregues");

const UUID_BUSCAR = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function resp(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

function maskDni(d4) { return d4 ? "···" + d4 : ""; }

// Llegeix la comanda i el seu estat EN PARAL·LEL (una sola ronda de consultes).
async function carrega(idBrut, detall) {
  const m = String(idBrut || "").match(UUID_BUSCAR);
  if (!m) return null;
  const id = m[0].toLowerCase();
  const [ordre, estat] = await Promise.all([obtenirOrdre(id), E.obtenirEstat(id, { detall: !!detall })]);
  return ordre ? { id, ordre, estat } : null;
}

function veredicte(c, mesa) {
  if (!c) return { estat: "invalid" };
  const { id, ordre, estat } = c;
  if (!E.estaPagada(ordre)) return { estat: "no_pagada" };
  const cl = E.checklist(ordre, estat);
  const p = ordre.payload || {};
  const base = { id, nom: p.nom || "", cognoms: p.cognoms || "", modalitat: ordre.modalitat };
  if (!cl.items.length) return { ...base, estat: "sense_entrega" };
  const puntId = E.puntEfectiu(ordre, estat);
  const assignada = puntPerId(puntId);
  if (puntId !== mesa) return { ...base, estat: "altra_mesa", assignada: assignada ? publicPunt(assignada) : null };
  const darrera = (estat.historial || []).filter((h) => h.tipus === "entrega").slice(-1)[0] || null;
  return {
    ...base,
    estat: cl.complet ? "ja_entregat" : "ok",
    items: cl.items,
    darrera_entrega: darrera && darrera.voluntari ? { data: darrera.data, mesa: darrera.mesa, voluntari: darrera.voluntari } : null,
  };
}

async function avaluar(idBrut, mesa) {
  const c = await carrega(idBrut, true);
  return veredicte(c, mesa);
}

exports.handler = async (event) => {
  const codi = process.env.VOLUNTARI_CODE;
  if (!codi) return resp(503, { ok: false, codi: "no_configurat" });
  if (event.httpMethod !== "POST") return resp(405, { ok: false });
  const h = event.headers || {};
  if ((h["x-voluntari-code"] || h["X-Voluntari-Code"] || "") !== codi) return resp(401, { ok: false, codi: "codi_incorrecte" });

  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return resp(400, { ok: false, codi: "json" }); }

  try {
    if (b.action === "login") {
      return resp(200, { ok: true, mesas: PUNTS.filter((p) => p.mesa).map(publicPunt) });
    }

    const mesa = String(b.mesa || "");
    const punt = puntPerId(mesa);

    if (b.action === "escaneig") {
      if (!punt || !punt.mesa) return resp(400, { ok: false, codi: "mesa_invalida" });
      return resp(200, { ok: true, ...(await avaluar(b.text, mesa)) });
    }

    if (b.action === "cerca") {
      const q = String(b.q || "").trim().slice(0, 80);
      if (q.length < 3) return resp(200, { ok: true, resultats: [] });
      const r = await cercar(q);
      return resp(200, {
        ok: true,
        total: r.length,
        resultats: r.slice(0, 8).map((f) => ({ id: f.id, nom: f.nom, cognoms: f.cognoms, modalitat: f.modalitat, dni: maskDni(f.dni4) })),
      });
    }

    if (b.action === "entrega") {
      if (!punt || !punt.mesa) return resp(400, { ok: false, codi: "mesa_invalida" });
      const voluntari = String(b.voluntari || "").trim().slice(0, 40);
      if (voluntari.length < 2) return resp(400, { ok: false, codi: "falta_voluntari" });
      const c = await carrega(b.id, false);
      const av = veredicte(c, mesa);
      // Un reintent del mateix lliurament (mateix cid) ja registrat és un èxit.
      const jaFet = c && (c.estat.historial || []).find((e) => e.cid === b.cid);
      if (jaFet) return resp(200, { ok: true, repetit: true, aplicats: jaFet.items, duplicats: [], estat: "ok" });
      if (av.estat !== "ok") return resp(409, { ok: false, ...av });
      const r = await E.registrarEntrega(c.id, c.ordre, Array.isArray(b.items) ? b.items.map(String) : [], { mesa, voluntari, cid: b.cid, t: b.t }, c.estat);
      const cl = E.checklist(c.ordre, r.estat);
      return resp(200, { ok: true, aplicats: r.aplicats, duplicats: r.duplicats || [], complet: cl.complet, pendents: cl.items.filter((i) => !i.entregat).length });
    }

    return resp(400, { ok: false, codi: "accio_desconeguda" });
  } catch (e) {
    console.error("[voluntari]", e);
    return resp(500, { ok: false, codi: "error" });
  }
};
