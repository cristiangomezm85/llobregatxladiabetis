// netlify/functions/admin-inscripcions.js
//
// Endpoint per al tab "Inscripcions" de l'admin: llistar totes les
// comandes (pagades i incompletes), editar-ne les dades de contacte/
// personals (mai el preu ni res que en depengui) i eliminar-les.
//
// Protegit amb el mateix token que la resta de l'admin (ADMIN_TOKEN),
// enviat com a "Authorization: Bearer <token>" — igual que fa
// lxd-admin.js amb /api/admin-content. Si ADMIN_TOKEN no està definit
// (per exemple en local), no es demana token, igual que a l'altre editor.

const { llistarOrdres, obtenirOrdre, actualitzarOrdre, eliminarOrdre } = require("./lib/store");

// Camps que MAI es poden tocar des d'aquí perquè determinen o deriven el
// preu ja cobrat (o l'estat de pagament). Qualsevol altra cosa de
// contacte/identificació es pot corregir sense problema.
const CAMPS_PROHIBITS_TOP = new Set([
  "estat", "import_base_centims", "donacio_centims", "import_centims", "unitats",
  "stripe_session_id", "stripe_payment_intent", "data_pagament", "data_creacio",
  "descripcio", "modalitat",
]);
const CAMPS_PROHIBITS_PAYLOAD = new Set([
  "modalitat", "tram_km", "tram_dies", "tram_inici", "tram_final",
  "codi_descompte", "donacio_centims",
]);

exports.handler = async (event) => {
  const token = process.env.ADMIN_TOKEN;
  if (token) {
    const auth = event.headers.authorization || event.headers.Authorization || "";
    if (auth !== `Bearer ${token}`) {
      return resposta(401, { ok: false, error: "No autoritzat" });
    }
  }

  try {
    if (event.httpMethod === "GET") {
      const ordres = await llistarOrdres();
      // Ordenem més recent primer (data_creacio ISO és ordenable com a text).
      ordres.sort((a, b) => String(b.data_creacio || "").localeCompare(String(a.data_creacio || "")));
      return resposta(200, { ok: true, ordres });
    }

    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body);
      } catch {
        return resposta(400, { ok: false, error: "JSON invàlid" });
      }

      if (body.action === "delete") {
        if (!body.order_id) return resposta(400, { ok: false, error: "Falta order_id" });
        await eliminarOrdre(body.order_id);
        return resposta(200, { ok: true });
      }

      if (body.action === "update") {
        if (!body.order_id) return resposta(400, { ok: false, error: "Falta order_id" });
        const actual = await obtenirOrdre(body.order_id);
        if (!actual) return resposta(404, { ok: false, error: "Comanda no trobada" });

        const patch = body.patch || {};
        const patchTop = {};
        Object.keys(patch).forEach((k) => {
          if (k === "payload") return;
          if (CAMPS_PROHIBITS_TOP.has(k)) return;
          patchTop[k] = patch[k];
        });

        const payloadActual = actual.payload || {};
        const payloadPatch = patch.payload || {};
        const payloadNou = { ...payloadActual };
        Object.keys(payloadPatch).forEach((k) => {
          if (CAMPS_PROHIBITS_PAYLOAD.has(k)) return;
          payloadNou[k] = payloadPatch[k];
        });

        const actualitzat = await actualitzarOrdre(body.order_id, {
          ...patchTop,
          payload: payloadNou,
          // Si l'email de contacte canvia, mantenim sincronitzat el
          // camp top-level (usat per cercar/enviar correus) i el del
          // payload.
          email_contacte: patchTop.email_contacte || payloadNou.email_contacte || actual.email_contacte,
        });
        return resposta(200, { ok: true, ordre: actualitzat });
      }

      return resposta(400, { ok: false, error: "Acció desconeguda" });
    }

    return resposta(405, { ok: false, error: "Mètode no permès" });
  } catch (e) {
    console.error("Error a admin-inscripcions:", e);
    return resposta(500, { ok: false, error: e.message || String(e) });
  }
};

function resposta(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
