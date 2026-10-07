// netlify/functions/perfil-api.js
//
// API del perfil del participant (pàgina /perfil?id=<order_id>).
//   GET  ?id=...            -> dades segures + checklist + punt de recollida
//   POST {id, punt}         -> canvia el punt de recollida (fins l'11/10)
// L'order_id (UUID impossible d'endevinar) fa de clau d'accés. Mai
// retornem DNI, telèfon, email ni data de naixement.

const { obtenirOrdre } = require("./lib/store");
const { construirCampsComanda } = require("./lib/dades-comanda");
const { PUNTS, LIMIT_CANVI_ISO, puntPerId, dinsDeTermini, publicPunt } = require("./lib/punts");
const E = require("./lib/entregues");

function resp(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

function vista(ordre, estat, orderId) {
  const camps = construirCampsComanda(ordre, orderId);
  const p = ordre.payload || {};
  const cl = E.checklist(ordre, estat);
  const puntId = E.puntEfectiu(ordre, estat);
  const punt = puntPerId(puntId);
  const bloquejat = puntId === "sant-just";
  return {
    ok: true,
    id: orderId,
    nom: camps.name,
    cognoms: camps.last_name,
    idioma: camps.idioma,
    modalitat: ordre.modalitat,
    tram: camps.tram,
    num_comanda: camps.num_comanda,
    te_entrega: cl.items.length > 0,
    items: cl.items,
    complet: cl.complet,
    punt: punt ? publicPunt(punt) : null,
    punts: PUNTS.filter((x) => x.seleccionable).map(publicPunt),
    pot_canviar: dinsDeTermini() && !bloquejat && cl.items.length > 0 && !cl.complet,
    bloquejat_organitzacio: bloquejat,
    limit_canvi: LIMIT_CANVI_ISO,
    entregat_data: (estat.historial || []).filter((h) => h.tipus === "entrega").slice(-1)[0]?.data || null,
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      const id = (event.queryStringParameters && event.queryStringParameters.id) || "";
      if (!E.idValid(id)) return resp(400, { ok: false, codi: "id_invalid" });
      const ordre = await obtenirOrdre(id.toLowerCase());
      if (!ordre) return resp(404, { ok: false, codi: "no_trobada" });
      if (!E.estaPagada(ordre)) return resp(200, { ok: false, codi: "no_pagada" });
      const estat = await E.obtenirEstat(id.toLowerCase(), { detall: true });
      return resp(200, vista(ordre, estat, id.toLowerCase()));
    }

    if (event.httpMethod === "POST") {
      let body;
      try { body = JSON.parse(event.body || "{}"); } catch { return resp(400, { ok: false, codi: "json" }); }
      const id = String(body.id || "").toLowerCase();
      if (!E.idValid(id)) return resp(400, { ok: false, codi: "id_invalid" });
      if (!dinsDeTermini()) return resp(403, { ok: false, codi: "termini_tancat" });
      const nou = puntPerId(String(body.punt || ""));
      if (!nou || !nou.seleccionable) return resp(400, { ok: false, codi: "punt_invalid" });
      const ordre = await obtenirOrdre(id);
      if (!ordre) return resp(404, { ok: false, codi: "no_trobada" });
      if (!E.estaPagada(ordre)) return resp(409, { ok: false, codi: "no_pagada" });
      let estat = await E.obtenirEstat(id);
      if (E.puntEfectiu(ordre, estat) === "sant-just") return resp(403, { ok: false, codi: "bloquejat" });
      if (!E.checklist(ordre, estat).items.length) return resp(409, { ok: false, codi: "sense_entrega" });
      if (E.checklist(ordre, estat).complet) return resp(409, { ok: false, codi: "ja_entregat" });
      estat = await E.canviarPunt(id, nou.id);
      return resp(200, vista(ordre, estat, id));
    }

    return resp(405, { ok: false, codi: "metode" });
  } catch (e) {
    console.error("[perfil-api]", e);
    return resp(500, { ok: false, codi: "error" });
  }
};
