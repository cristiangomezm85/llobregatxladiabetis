// netlify/functions/voluntari.js
//
// API de l'escàner dels voluntaris. Accés amb un codi compartit (variable
// d'entorn VOLUNTARI_CODE) enviat a la capçalera "x-voluntari-code". Si cap
// de les dues variables existeix, l'endpoint queda TANCAT.
//
// Codi d'ADMIN (variable d'entorn VOLUNTARI_ADMIN_CODE, opcional i diferent del
// de voluntari): qui entra amb aquest codi pot atendre persones de QUALSEVOL
// taula, sense haver d'escollir-ne cap. Els lliuraments queden registrats amb la
// taula assignada de la persona i la marca admin:true.
//
// Accions (POST JSON):
//   login    {}                       -> comprova el codi, retorna les taules
//   escaneig {text, mesa}             -> valida un QR (o un id) per a una taula
//   cerca    {q}                      -> cerca manual per nom, email o DNI
//   entrega  {id, mesa, voluntari, items:[clau,...], treure:[clau,...]}
//            -> registra el lliurament (items) i/o desmarca elements marcats
//               per error (treure); l'historial es conserva
//
// Regla (bloqueig total): una persona només es pot atendre a la taula que
// té assignada. Si no és la seva, es retorna l'error i la taula assignada.
// Excepció: el codi d'admin les pot atendre totes.

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

function veredicte(c, mesa, admin) {
  if (!c) return { estat: "invalid" };
  const { id, ordre, estat } = c;
  if (!E.estaPagada(ordre)) return { estat: "no_pagada" };
  const cl = E.checklist(ordre, estat);
  const p = ordre.payload || {};
  const base = { id, nom: p.nom || "", cognoms: p.cognoms || "", modalitat: ordre.modalitat };
  if (!cl.items.length) return { ...base, estat: "sense_entrega" };
  const puntId = E.puntEfectiu(ordre, estat);
  const assignada = puntPerId(puntId);
  if (!admin && puntId !== mesa) return { ...base, estat: "altra_mesa", assignada: assignada ? publicPunt(assignada) : null };
  const darrera = (estat.historial || []).filter((h) => h.tipus === "entrega").slice(-1)[0] || null;
  return {
    ...base,
    estat: cl.complet ? "ja_entregat" : "ok",
    // Els items es retornen també quan ja ho ha recollit tot: així es pot desmarcar un error.
    items: cl.items,
    punt_id: puntId,
    ...(admin ? { assignada: assignada ? publicPunt(assignada) : null } : {}),
    darrera_entrega: darrera && darrera.voluntari ? { data: darrera.data, mesa: darrera.mesa, voluntari: darrera.voluntari } : null,
  };
}

async function avaluar(idBrut, mesa, admin) {
  const c = await carrega(idBrut, true);
  return veredicte(c, mesa, admin);
}

exports.handler = async (event) => {
  const codi = process.env.VOLUNTARI_CODE || "";
  const codiAdmin = process.env.VOLUNTARI_ADMIN_CODE || "";
  if (!codi && !codiAdmin) return resp(503, { ok: false, codi: "no_configurat" });
  if (event.httpMethod !== "POST") return resp(405, { ok: false });
  const h = event.headers || {};
  const rebut = String(h["x-voluntari-code"] || h["X-Voluntari-Code"] || "");
  const admin = !!codiAdmin && rebut === codiAdmin;
  if (!admin && !(codi && rebut === codi)) return resp(401, { ok: false, codi: "codi_incorrecte" });

  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return resp(400, { ok: false, codi: "json" }); }

  try {
    if (b.action === "login") {
      return resp(200, { ok: true, admin, mesas: PUNTS.filter((p) => p.mesa).map(publicPunt) });
    }

    const mesa = String(b.mesa || "");
    const punt = puntPerId(mesa);

    if (b.action === "escaneig") {
      if (!admin && (!punt || !punt.mesa)) return resp(400, { ok: false, codi: "mesa_invalida" });
      return resp(200, { ok: true, ...(await avaluar(b.text, mesa, admin)) });
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
      if (!admin && (!punt || !punt.mesa)) return resp(400, { ok: false, codi: "mesa_invalida" });
      const voluntari = String(b.voluntari || "").trim().slice(0, 40);
      if (voluntari.length < 2) return resp(400, { ok: false, codi: "falta_voluntari" });
      const c = await carrega(b.id, false);
      const av = veredicte(c, mesa, admin);
      // Un reintent del mateix lliurament (mateix cid) ja registrat és un èxit.
      const cidTreure = b.cid ? (String(b.cid) + "-x").slice(0, 40) : null;
      const jaFet = c && (c.estat.historial || []).find((e) => e.cid === b.cid || (cidTreure && e.cid === cidTreure));
      if (jaFet) return resp(200, { ok: true, repetit: true, aplicats: jaFet.tipus === "entrega" ? jaFet.items : [], duplicats: [], estat: "ok" });
      // "ja_entregat" també es pot editar (per desmarcar un error o completar-ho).
      if (av.estat !== "ok" && av.estat !== "ja_entregat") return resp(409, { ok: false, ...av });
      const llista = (x) => (Array.isArray(x) ? x.map(String) : []);
      // Taula registrada: la de la persona (a l'admin la taula escollida no existeix).
      const mesaReg = admin ? (av.punt_id || "admin") : mesa;
      const r = await E.registrarEntrega(c.id, c.ordre, llista(b.items), { mesa: mesaReg, voluntari, cid: b.cid, t: b.t, admin }, c.estat, llista(b.treure));
      const cl = E.checklist(c.ordre, r.estat);
      return resp(200, { ok: true, aplicats: r.aplicats, tretes: r.tretes || [], duplicats: r.duplicats || [], complet: cl.complet, pendents: cl.items.filter((i) => !i.entregat).length });
    }

    return resp(400, { ok: false, codi: "accio_desconeguda" });
  } catch (e) {
    console.error("[voluntari]", e);
    return resp(500, { ok: false, codi: "error" });
  }
};
