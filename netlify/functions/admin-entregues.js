// netlify/functions/admin-entregues.js
//
// Panell d'administració de les entregues. Protegit amb ADMIN_TOKEN
// (Authorization: Bearer ...), igual que admin-inscripcions.js.
//   GET                          -> resum per zona/punt: assignats, lliurats, QR enviats i pendents d'enviar
//   GET ?q=text                  -> cerca de persones (nom, cognoms, correu, DNI, club, id de comanda)
//   POST {action:"desfer", id}   -> desfà el lliurament d'una comanda (queda a l'historial)
//   POST {action:"reenviar", id, email?}
//        -> reenvia el correu del QR a una persona; si porta "email", abans en
//           corregeix el correu de la comanda
//   POST {action:"enviar-qr", punt, aplicar, limit}
//        -> envia el correu del QR a les comandes pagades d'UNA zona que encara
//           no l'han rebut (per lots). Si la zona ja està enviada, ho rebutja.

const { llistarOrdres, obtenirOrdre, actualitzarOrdre, canviarEmailPagat } = require("./lib/store");
const { PUNTS, ALTRES, puntPerId, normalitzar } = require("./lib/punts");
const E = require("./lib/entregues");

function resp(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const netDni = (s) => String(s || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
const correuDe = (o) => String(o.email_contacte || (o.payload || {}).email_contacte || "").trim();

// Comandes pagades d'una zona que tenen alguna cosa a recollir.
function deLaZona(ordres, estats, puntId) {
  return ordres.filter(E.estaPagada).filter((o) => E.elementsComanda(o).res)
    .filter((o) => E.puntEfectiu(o, estats[o.order_id] || {}) === puntId);
}

function nomPunt(id) {
  const p = puntPerId(id) || ALTRES;
  return p.nom.ca;
}

async function cerca(q) {
  const ordres = await llistarOrdres();
  const qn = normalitzar(q);
  const toks = qn.split(" ").filter(Boolean);
  const ql = q.trim().toLowerCase();
  const qd = netDni(q);
  const trobades = ordres.filter((o) => {
    const p = o.payload || {};
    if (ql.includes("@")) return correuDe(o).toLowerCase().includes(ql);
    if (/^[0-9a-f-]{6,36}$/i.test(ql) && String(o.order_id).toLowerCase().includes(ql)) return true;
    if (qd.length >= 5 && /\d/.test(qd) && netDni(p.dni).includes(qd)) return true;
    const text = normalitzar(`${p.nom || ""} ${p.cognoms || ""} ${p.club_nom || ""}`);
    return toks.length > 0 && toks.every((t) => text.includes(t));
  }).slice(0, 25);

  return Promise.all(trobades.map(async (o) => {
    const p = o.payload || {};
    const est = await E.obtenirEstat(o.order_id);
    const cl = E.checklist(o, est);
    return {
      id: o.order_id, nom: p.nom || "", cognoms: p.cognoms || "", email: correuDe(o), dni: p.dni || "",
      modalitat: o.modalitat || p.modalitat || "", estat: o.estat || "", pagada: E.estaPagada(o),
      club: p.club_nom || "", punt: { id: E.puntEfectiu(o, est), nom: nomPunt(E.puntEfectiu(o, est)) },
      te_elements: E.elementsComanda(o).res,
      qr_enviat: est.qr_enviat || null,
      entrega: { complet: cl.complet, alguna: cl.items.some((i) => i.entregat), items: cl.items },
    };
  }));
}

exports.handler = async (event) => {
  const token = process.env.ADMIN_TOKEN;
  if (token) {
    const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
    if (auth !== `Bearer ${token}`) return resp(401, { ok: false, error: "No autoritzat" });
  }
  try {
    if (event.httpMethod === "GET") {
      const q = String((event.queryStringParameters && event.queryStringParameters.q) || "").trim();
      if (q) {
        if (q.length < 3) return resp(400, { ok: false, error: "Escriu almenys 3 caràcters" });
        return resp(200, { ok: true, persones: await cerca(q) });
      }
      const [ordres, estats] = await Promise.all([llistarOrdres(), E.llistarEstats()]);
      const files = {};
      PUNTS.concat([ALTRES]).forEach((p) => {
        files[p.id] = { id: p.id, nom: p.nom.ca, pendent: !!p.pendent, assignats: 0, complets: 0, parcials: 0, pendents: 0, qr_enviats: 0, qr_pendents: 0, sense_correu: 0 };
      });
      ordres.filter(E.estaPagada).forEach((o) => {
        const est = estats[o.order_id] || {};
        const cl = E.checklist(o, est);
        if (!cl.items.length) return;
        const f = files[E.puntEfectiu(o, est)] || files[ALTRES.id];
        f.assignats++;
        if (est.qr_enviat) f.qr_enviats++;
        else if (correuDe(o)) f.qr_pendents++;
        else f.sense_correu++;
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

      if (b.action === "reenviar") {
        if (!E.idValid(b.id)) return resp(400, { ok: false, error: "id invàlid" });
        const { enviarLotQr } = require("./lib/email-qr");
        let ordre = await obtenirOrdre(b.id);
        if (!ordre) return resp(404, { ok: false, error: "Comanda no trobada" });
        if (!E.estaPagada(ordre)) return resp(400, { ok: false, error: "Aquesta inscripció no està pagada: no té QR." });
        if (!E.elementsComanda(ordre).res) return resp(400, { ok: false, error: "Aquesta inscripció no té res a recollir." });

        const nou = String(b.email || "").trim();
        let canviat = false;
        if (nou) {
          if (!EMAIL_RE.test(nou)) return resp(400, { ok: false, error: "El correu no és vàlid" });
          const vell = correuDe(ordre);
          if (nou.toLowerCase() !== vell.toLowerCase()) {
            ordre = await actualitzarOrdre(b.id, { email_contacte: nou, payload: { ...(ordre.payload || {}), email_contacte: nou } });
            try { await canviarEmailPagat(vell, nou, b.id); } catch (e) { console.error("[admin-entregues] índex d'emails:", e); }
            canviat = true;
          }
        }
        if (!correuDe(ordre)) return resp(400, { ok: false, error: "La inscripció no té correu. Escriu-ne un." });

        const estat = await E.obtenirEstat(b.id);
        const r = await enviarLotQr([{ ordre: { ...ordre, email_contacte: correuDe(ordre) }, orderId: b.id, estat }]);
        if (!r.enviats.length) return resp(500, { ok: false, error: "No s'ha pogut preparar el correu" });
        await E.marcarQrEnviat(b.id);
        if (canviat) {
          try { await require("./lib/index-cerca").reconstruir(); } catch (e) { console.error("[admin-entregues] reindexar:", e); }
        }
        return resp(200, { ok: true, email: correuDe(ordre), canviat });
      }

      if (b.action === "enviar-qr") {
        const punt = puntPerId(String(b.punt || "")) || (b.punt === ALTRES.id ? ALTRES : null);
        if (!punt) return resp(400, { ok: false, error: "Cal indicar la zona" });
        const { enviarLotQr } = require("./lib/email-qr");
        const limit = Math.max(1, Math.min(Number(b.limit) || 40, 90));
        const [ordres, estats] = await Promise.all([llistarOrdres(), E.llistarEstats()]);
        const pendents = deLaZona(ordres, estats, punt.id)
          .filter((o) => correuDe(o))
          .filter((o) => !(estats[o.order_id] || {}).qr_enviat);
        if (!pendents.length) {
          return resp(409, { ok: false, error: `La zona «${punt.nom.ca}» ja està enviada: no queda cap correu pendent.` });
        }
        const lot = pendents.slice(0, limit);
        if (b.aplicar !== true) {
          return resp(200, { ok: true, simulacio: true, pendents_total: pendents.length, aquest_lot: lot.length });
        }
        const r = await enviarLotQr(lot.map((o) => ({ ordre: { ...o, email_contacte: correuDe(o) }, orderId: o.order_id, estat: estats[o.order_id] || {} })));
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
