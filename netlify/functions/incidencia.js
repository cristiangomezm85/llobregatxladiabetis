// netlify/functions/incidencia.js
//
// Formulari públic d'incidències pendents (samarreta, bossa, correu de
// confirmació, recollida...). Només per a incidencia.html.
//   GET  /api/incidencia?t=<token>  -> nom i email per precarregar (si l'enllaç ve d'un correu)
//   POST /api/incidencia            -> desa la incidència i avisa per correu
//
// Cada incidència es desa a Netlify Blobs (store "incidencies"), es pot consultar
// a /incidencies-admin i en entrar-ne una s'envia un avís a INCIDENCIA_EMAIL
// (per defecte info@llobregat.org) i una confirmació a qui l'ha enviat.
// Si Resend no està configurat, la incidència es desa igualment.

const I = require("./lib/incidencies-store");
const E = require("./lib/enquesta-store");
const { enviarLot } = require("./lib/enquesta-resend");

const TIPUS = {
  no_email: { ca: "No he rebut el correu de confirmació", es: "No he recibido el correo de confirmación", en: "I didn't get the confirmation email" },
  no_recollida: { ca: "No vaig poder anar a la recollida", es: "No pude ir a la recogida", en: "I couldn't make the collection" },
  falta_samarreta: { ca: "Em falta la samarreta", es: "Me falta la camiseta", en: "My T-shirt is missing" },
  talla: { ca: "La talla de la samarreta no és la correcta", es: "La talla de la camiseta no es la correcta", en: "The T-shirt size is wrong" },
  falta_bossa: { ca: "Em falta la bossa", es: "Me falta la bolsa", en: "My bag is missing" },
  altre: { ca: "Una altra cosa", es: "Otra cosa", en: "Something else" },
};
const IDIOMES = ["ca", "es", "en"];

function resp(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
const neteja = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const CONF = {
  ca: { assumpte: "Hem rebut la teva incidència", t: (n) => `Hola${n ? ", " + n : ""}!`, p: "Hem rebut la teva incidència i la mirarem aviat. Et contactarem pel correu o el telèfon que ens has indicat.", resum: "El que ens has explicat:", peu: "Llobregat x la Diabetis · info@llobregat.org" },
  es: { assumpte: "Hemos recibido tu incidencia", t: (n) => `¡Hola${n ? ", " + n : ""}!`, p: "Hemos recibido tu incidencia y la miraremos pronto. Te contactaremos por el correo o el teléfono que nos has indicado.", resum: "Lo que nos has contado:", peu: "Llobregat x la Diabetis · info@llobregat.org" },
  en: { assumpte: "We received your issue", t: (n) => `Hi${n ? " " + n : ""}!`, p: "We received your issue and will look into it soon. We'll contact you at the email or phone you gave us.", resum: "What you told us:", peu: "Llobregat x la Diabetis · info@llobregat.org" },
};

async function avisar(inc) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
  const destAdmin = process.env.INCIDENCIA_EMAIL || "info@llobregat.org";
  const tipusTxt = inc.tipus.map((t) => TIPUS[t].ca).join(", ");
  const admin = {
    email: destAdmin, nom: "",
    subject: `Nova incidència: ${tipusTxt}`.slice(0, 150),
    reply_to: inc.email,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#0E1B36">
      <h2 style="color:#15315F;margin:0 0 10px">Nova incidència</h2>
      <p><b>Nom:</b> ${esc(inc.nom)}<br><b>Email:</b> ${esc(inc.email)}<br><b>Telèfon:</b> ${esc(inc.telefon)}<br><b>Idioma:</b> ${esc(inc.idioma)}</p>
      <p><b>Problema:</b> ${esc(tipusTxt)}</p>
      ${inc.detall ? `<p><b>Detalls:</b><br>${esc(inc.detall).replace(/\n/g, "<br>")}</p>` : ""}
      <p><a href="${esc((process.env.SITE_URL || "https://llobregat.org").replace(/\/$/, ""))}/incidencies-admin" style="color:#1E72D4">Veure-la al panell d'incidències →</a></p></div>`,
    text: `Nova incidència\nNom: ${inc.nom}\nEmail: ${inc.email}\nTelèfon: ${inc.telefon}\nProblema: ${tipusTxt}\n${inc.detall ? "Detalls: " + inc.detall + "\n" : ""}`,
  };
  const c = CONF[inc.idioma] || CONF.ca;
  const usuari = {
    email: inc.email, nom: inc.nom, subject: c.assumpte,
    reply_to: destAdmin,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#0E1B36;max-width:560px">
      <h2 style="color:#1E72D4;margin:0 0 10px">${esc(c.t(inc.nom.split(" ")[0]))}</h2><p>${esc(c.p)}</p>
      <p style="color:#5A6478;font-size:13px"><b>${esc(c.resum)}</b><br>${esc(inc.tipus.map((t) => TIPUS[t][inc.idioma] || TIPUS[t].ca).join(", "))}${inc.detall ? "<br>" + esc(inc.detall).replace(/\n/g, "<br>") : ""}</p>
      <p style="color:#7C8AA5;font-size:12px">${esc(c.peu)}</p></div>`,
    text: `${c.t(inc.nom.split(" ")[0])}\n\n${c.p}`,
  };
  await enviarLot([admin, usuari]);
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      const t = (event.queryStringParameters || {}).t;
      if (!t || !E.tokenValid(t)) return resp(200, { ok: false });
      const tok = await E.llegir("tok/" + t);
      if (!tok) return resp(200, { ok: false });
      return resp(200, { ok: true, nom: tok.nom || "", email: tok.email || "", idioma: tok.idioma || "ca" });
    }
    if (event.httpMethod !== "POST") return resp(405, { ok: false });
    if ((event.body || "").length > 20000) return resp(413, { ok: false, error: "Massa gran" });
    let b;
    try { b = JSON.parse(event.body); } catch { return resp(400, { ok: false, error: "JSON invàlid" }); }
    if (b.hp) return resp(200, { ok: true });
    if (typeof b.ms === "number" && b.ms < 1500) return resp(200, { ok: true });

    const nom = neteja(b.nom, 120);
    const email = neteja(b.email, 200).toLowerCase();
    const telefon = neteja(b.telefon, 40);
    const detall = neteja(b.detall, 2000);
    const idioma = IDIOMES.includes(b.idioma) ? b.idioma : "ca";
    const tipus = [...new Set((Array.isArray(b.tipus) ? b.tipus : []).map(String).filter((x) => TIPUS[x]))];
    const faltes = [];
    if (nom.length < 2) faltes.push("nom");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) faltes.push("email");
    if (telefon.replace(/\D/g, "").length < 7) faltes.push("telefon");
    if (!tipus.length) faltes.push("tipus");
    if (b.consentiment !== true) faltes.push("consentiment");
    if (faltes.length) return resp(400, { ok: false, error: "Falten dades", faltes });

    const inc = {
      id: I.nouId(), data: new Date().toISOString(), nom, email, telefon, tipus, detall, idioma,
      estat: "pendent", nota: "", amb_enllac: !!b.t,
    };
    await I.desar(inc);
    try { await avisar(inc); } catch (e) { console.error("incidencia avís:", e.message); }
    return resp(200, { ok: true });
  } catch (e) {
    console.error("incidencia:", e);
    return resp(500, { ok: false, error: "Error del servidor" });
  }
};

module.exports.TIPUS = TIPUS;
