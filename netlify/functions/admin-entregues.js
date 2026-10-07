// netlify/functions/admin-entregues.js
//
// Panell d'administració de les entregues. Protegit amb ADMIN_TOKEN
// (Authorization: Bearer ...), igual que admin-inscripcions.js.
//   GET                        -> resum per punt: assignats / lliurats / parcials
//   POST {action:"desfer", id} -> desfà el lliurament d'una comanda (queda a l'historial)
//   POST {action:"enviar-qr", aplicar:false|true, limit:40}
//        -> envia el correu del QR a les comandes pagades que encara no l'han
//           rebut (per lots). Sense "aplicar": simulació, no envia res.

const { llistarOrdres, obtenirOrdre } = require("./lib/store");
const { PUNTS, ALTRES, puntPerId } = require("./lib/punts");
const E = require("./lib/entregues");

function resp(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  const token = process.env.ADMIN_TOKEN;
  if (token) {
    const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
    if (auth !== `Bearer ${token}`) return resp(401, { ok: false, error: "No autoritzat" });
  }
  try {
    if (event.httpMethod === "GET") {
      const [ordres, estats] = await Promise.all([llistarOrdres(), E.llistarEstats()]);
      const files = {};
      PUNTS.concat([ALTRES]).forEach((p) => { files[p.id] = { id: p.id, nom: p.nom.ca, assignats: 0, complets: 0, parcials: 0, pendents: 0, qr_enviats: 0 }; });
      ordres.filter(E.estaPagada).forEach((o) => {
        const est = estats[o.order_id] || {};
        const cl = E.checklist(o, est);
        if (!cl.items.length) return;
        const f = files[E.puntEfectiu(o, est)] || files[ALTRES.id];
        f.assignats++;
        if (est.qr_enviat) f.qr_enviats++;
        if (cl.complet) f.complets++;
        else if (cl.items.some((i) => i.entregat)) f.parcials++;
        else f.pendents++;
      });
      return resp(200, { ok: true, punts: Object.values(files) });
    }

    if (event.httpMethod === "POST") {
      let b;
      try { b = JSON.parse(event.body || "{}"); } catch { return resp(400, { ok: false, error: "JSON invàlid" }); }

      if (b.action === "desfer") {
        if (!E.idValid(b.id)) return resp(400, { ok: false, error: "id invàlid" });
        const est = await E.desferEntrega(b.id, { qui: "admin" });
        return resp(200, { ok: true, estat: est });
      }

      if (b.action === "reindexar") {
        const { reconstruir } = require("./lib/index-cerca");
        const ix = await reconstruir();
        return resp(200, { ok: true, persones: ix.files.length });
      }

      if (b.action === "enviar-qr") {
        const { enviarLotQr } = require("./lib/email-qr");
        const limit = Math.max(1, Math.min(Number(b.limit) || 40, 90));
        const [ordres, estats] = await Promise.all([llistarOrdres(), E.llistarEstats()]);
        const pendents = ordres
          .filter(E.estaPagada)
          .filter((o) => E.elementsComanda(o).res && o.email_contacte)
          .filter((o) => !(estats[o.order_id] || {}).qr_enviat);
        const lot = pendents.slice(0, limit);
        if (b.aplicar !== true) {
          return resp(200, { ok: true, simulacio: true, pendents_total: pendents.length, aquest_lot: lot.length });
        }
        const r = await enviarLotQr(lot.map((o) => ({ ordre: o, orderId: o.order_id, estat: estats[o.order_id] || {} })));
        for (const id of r.enviats) await E.marcarQrEnviat(id);
        return resp(200, { ok: true, enviats: r.enviats.length, queden: pendents.length - r.enviats.length });
      }
      return resp(400, { ok: false, error: "Acció desconeguda" });
    }
    return resp(405, { ok: false });
  } catch (e) {
    console.error("[admin-entregues]", e);
    return resp(500, { ok: false, error: e.message || String(e) });
  }
};
