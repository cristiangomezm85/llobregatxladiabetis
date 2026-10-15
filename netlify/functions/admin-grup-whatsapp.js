// netlify/functions/admin-grup-whatsapp.js
//
// Invitació al grup privat de WhatsApp de seguretat de l'etapa 1 (correu en català
// i castellà). Protegit amb ADMIN_TOKEN (Authorization: Bearer ...). SEMPRE cal
// ADMIN_TOKEN: sense, la funció no s'executa.
//   GET                   -> simulació: quants correus s'enviarien i quants ja s'han enviat
//   GET ?llista=1         -> llista de persones (nom, telèfon, tram) per revisar-la o afegir-les
//   POST {action:"prova", email, enllac}
//        -> envia UN correu de prova (assumpte "[PROVA]"); no marca res
//   POST {action:"enviar", enllac, aplicar, limit?}
//        -> envia un lot (fins a 90) als que encara no l'han rebut i els marca. Sense
//           "aplicar:true" només simula. Es repeteix fins que "queden" sigui 0.

const { llistarOrdres } = require("./lib/store");
const E = require("./lib/entregues");
const G = require("./lib/grup-whatsapp");

const CLAU = "grupwa-etapa1";

function resp(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return resp(503, { ok: false, error: "Falta ADMIN_TOKEN al servidor: aquesta funció no s'executa sense." });
  const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  if (auth !== `Bearer ${token}`) return resp(401, { ok: false, error: "No autoritzat" });

  try {
    const ordres = await llistarOrdres();
    const { dins, resum } = G.classificar(ordres);
    const grups = G.agruparPerCorreu(dins);
    const ja = await E.avisosEnviats(CLAU);
    const pendents = grups.filter((g) => !g.ids.some((id) => ja.has(id)));

    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      if (q.llista) {
        return resp(200, { ok: true, persones: dins.map((d) => ({ nom: d.nom, cognoms: d.cognoms, telefon: d.telefon, email: d.email, inici: d.inici, final: d.final })) });
      }
      return resp(200, { ok: true, ...resum, correus_unics: grups.length, ja_enviats: grups.length - pendents.length, pendents: pendents.length });
    }

    if (event.httpMethod !== "POST") return resp(405, { ok: false });
    let b;
    try { b = JSON.parse(event.body || "{}"); } catch { return resp(400, { ok: false, error: "JSON no vàlid" }); }
    const enllac = String(b.enllac || "").trim();
    if (!G.ENLLAC_RE.test(enllac)) return resp(400, { ok: false, error: "L'enllaç ha de ser el del grup: https://chat.whatsapp.com/…" });

    if (b.action === "prova") {
      const email = String(b.email || "").trim();
      if (!G.EMAIL_RE.test(email)) return resp(400, { ok: false, error: "Correu de prova no vàlid" });
      await G.enviarLotGrup([{ email, nom: "", ids: [], persones: [] }], enllac, { prova: true });
      return resp(200, { ok: true, enviat_a: email });
    }

    if (b.action === "enviar") {
      if (!pendents.length) return resp(409, { ok: false, error: "Ja s'ha enviat a tothom: no queda cap correu pendent." });
      if (resum.sense_etapa.length) {
        return resp(409, { ok: false, error: `Hi ha ${resum.sense_etapa.length} inscripcions sense etapes definides; revisa-les abans d'enviar.`, sense_etapa: resum.sense_etapa });
      }
      const limit = Math.max(1, Math.min(Number(b.limit) || 80, 90));
      const lot = pendents.slice(0, limit);
      if (b.aplicar !== true) return resp(200, { ok: true, simulacio: true, pendents_total: pendents.length, aquest_lot: lot.length });
      await G.enviarLotGrup(lot, enllac);
      for (const g of lot) for (const id of g.ids) await E.marcarAvis(CLAU, id);
      return resp(200, { ok: true, enviats: lot.length, queden: pendents.length - lot.length });
    }
    return resp(400, { ok: false, error: "Acció desconeguda" });
  } catch (e) {
    console.error("[admin-grup-whatsapp]", e);
    return resp(500, { ok: false, error: e.message || String(e) });
  }
};
