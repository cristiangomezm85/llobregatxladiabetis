// lib/email-qr.js
//
// Correu massiu "Aquí tens el teu QR de recollida" per a les inscripcions que
// ja estaven pagades abans d'existir el sistema de recollida. S'envia amb
// l'API de lots de Resend (fins a 100 correus per petició).
// Ús des de admin-entregues.js (acció "enviar-qr"), per lots i amb simulació.

const { blocQr, esc } = require("./qr-bloc");
const { construirCampsComanda } = require("./dades-comanda");

const TXT = {
  CA: { assumpte: "El teu QR per recollir la bossa i la samarreta — Llobregat x la Diabetis", salut: (n) => `Hola${n ? ", " + n : ""}!`, intro: "Ja tenim els punts de recollida. Aquí tens el teu QR personal i el punt que t'hem assignat." , kicker: "REPTE SOLIDARI · 16–18 OCTUBRE 2026", peu: 'Dubtes? Escriu-nos a <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>' },
  ES: { assumpte: "Tu QR para recoger la bolsa y la camiseta — Llobregat x la Diabetis", salut: (n) => `¡Hola${n ? ", " + n : ""}!`, intro: "Ya tenemos los puntos de recogida. Aquí tienes tu QR personal y el punto que te hemos asignado.", kicker: "RETO SOLIDARIO · 16–18 OCTUBRE 2026", peu: '¿Dudas? Escríbenos a <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>' },
  EN: { assumpte: "Your QR to collect your bag and t-shirt — Llobregat x la Diabetis", salut: (n) => `Hi${n ? ", " + n : ""}!`, intro: "The pickup points are ready. Here is your personal QR and the point we have assigned to you.", kicker: "SOLIDARITY CHALLENGE · OCTOBER 16–18, 2026", peu: 'Questions? Email us at <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>' },
};

function construirEmailQr(ordre, orderId, estat) {
  const camps = construirCampsComanda(ordre, orderId);
  const idioma = ["CA", "ES", "EN"].includes(camps.idioma) ? camps.idioma : "CA";
  const t = TXT[idioma];
  const bloc = blocQr(ordre, orderId, idioma, estat);
  if (!bloc) return null;
  const html = `<!DOCTYPE html>
<html lang="${idioma.toLowerCase()}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(t.assumpte)}</title>
<style>body{margin:0;padding:0;background:#E9EDF3}img{border:0}a{text-decoration:none}@media screen and (max-width:600px){.llxd-wrapper{width:100%!important}.llxd-px{padding-left:20px!important;padding-right:20px!important}}</style></head>
<body style="margin:0;padding:0;background-color:#E9EDF3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E9EDF3;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="llxd-wrapper" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#FFFFFF;border-radius:14px;overflow:hidden;">
<tr><td align="center" style="background-color:#15315F;padding:28px 24px 24px;">
<img src="https://llobregat.org/img/logo-footer-white.png" width="64" height="64" alt="Llobregat x la Diabetis" style="display:block;margin:0 auto 12px;width:64px;height:64px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:1.5px;font-weight:bold;color:#5AC0E6;text-transform:uppercase;">${t.kicker}</div></td></tr>
<tr><td class="llxd-px" style="padding:30px 40px 4px;"><h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;font-weight:800;color:#1E72D4;">${esc(t.salut(camps.name))}</h1>
<p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#0E1B36;">${esc(t.intro)}</p></td></tr>
${bloc.html}
<tr><td style="background-color:#0E1B36;padding:22px 40px;margin-top:20px;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#7C8AA5;">Llobregat x la Diabetis · AREDI · ${t.peu}</p></td></tr>
</table></td></tr></table></body></html>`;
  const text = [t.salut(camps.name), "", t.intro, "", bloc.text].join("\n");
  return { subject: t.assumpte, html, text };
}

// Envia fins a 100 correus d'una sola petició. "elements": [{ordre, orderId, estat}]
async function enviarLotQr(elements) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) throw new Error("Falta RESEND_API_KEY o RESEND_FROM_EMAIL");
  const fromName = process.env.RESEND_FROM_NAME || "Repte Llobregat x la Diabetis";
  const fitxes = [];
  const valids = [];
  for (const el of elements) {
    const email = el.ordre.email_contacte;
    const c = email ? construirEmailQr(el.ordre, el.orderId, el.estat) : null;
    if (!c) continue;
    const p = el.ordre.payload || {};
    const nom = [p.nom, p.cognoms].filter(Boolean).join(" ");
    fitxes.push({ from: `${fromName} <${fromEmail}>`, to: [nom ? `${nom} <${email}>` : email], subject: c.subject, html: c.html, text: c.text });
    valids.push(el.orderId);
  }
  if (!fitxes.length) return { enviats: [] };
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(fitxes),
  });
  const cos = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Resend ha respost ${res.status}: ${cos.slice(0, 300)}`);
  return { enviats: valids };
}

module.exports = { construirEmailQr, enviarLotQr };
