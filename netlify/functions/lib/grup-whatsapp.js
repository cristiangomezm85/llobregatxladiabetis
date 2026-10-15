// lib/grup-whatsapp.js
//
// Correu (català + castellà en un de sol) amb l'enllaç al grup privat de WhatsApp
// de seguretat de l'ETAPA 1. S'envia amb l'API de lots de Resend (fins a 100 per
// petició), un correu per adreça (les famílies que comparteixen correu en reben un).
// Ús des de admin-grup-whatsapp.js.

const { esc } = require("./qr-bloc");

const PARTICIPANTS = new Set(["caminant", "corrent", "bici"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ENLLAC_RE = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,}(\?[^\s]*)?$/;
const ETAPA = 1;

const correuDe = (o) => String(o.email_contacte || (o.payload || {}).email_contacte || "").trim();

// tram_dies pot ser una llista ([1,2,3]) o un text ("1+2+3").
function diesDe(p) {
  const d = p.tram_dies;
  if (Array.isArray(d)) return d.map(Number);
  if (typeof d === "string") return d.split(/[+,\s]+/).filter(Boolean).map(Number);
  if (typeof d === "number") return [d];
  return null;
}

// Qui s'ha d'invitar: participants pagats (caminant/corrent/bici) que fan l'etapa 1.
function classificar(ordres) {
  const dins = [];
  const resum = { participants_pagats: 0, dins: 0, sense_etapa: [], sense_correu: [] };
  ordres.forEach((o) => {
    if (String(o.estat || "").trim().toLowerCase() !== "pagat") return;
    const p = o.payload || {};
    const mod = String(o.modalitat || p.modalitat || "").toLowerCase();
    if (!PARTICIPANTS.has(mod)) return;
    resum.participants_pagats++;
    const nom = [p.nom, p.cognoms].filter(Boolean).join(" ");
    const dies = diesDe(p);
    if (!dies || !dies.length) { resum.sense_etapa.push({ id: o.order_id, nom }); return; }
    if (!dies.includes(ETAPA)) return;
    const email = correuDe(o);
    if (!EMAIL_RE.test(email)) { resum.sense_correu.push({ id: o.order_id, nom }); return; }
    dins.push({ o, email, nom: p.nom || "", cognoms: p.cognoms || "", telefon: p.telefon || "", inici: p.tram_inici_nom || "", final: p.tram_final_nom || "" });
  });
  resum.dins = dins.length;
  return { dins, resum };
}

// Un correu per adreça. Si una adreça té diverses inscripcions, se n'envia un de sol.
function agruparPerCorreu(dins) {
  const m = new Map();
  dins.forEach((d) => {
    const k = d.email.toLowerCase();
    const g = m.get(k) || { email: d.email, nom: d.nom, ids: [], persones: [] };
    g.ids.push(d.o.order_id);
    g.persones.push(d);
    m.set(k, g);
  });
  return Array.from(m.values());
}

const ASSUMPTE = "Entra al grup de WhatsApp de l'etapa 1 · Entra en el grupo de WhatsApp de la etapa 1";

function construirEmailGrup(g, enllac, opcions) {
  const prova = !!(opcions && opcions.prova);
  const assumpte = (prova ? "[PROVA] " : "") + ASSUMPTE;
  const hola = g.nom ? `Hola, ${g.nom}!` : "Hola!";
  const ca = [
    "Per la teva seguretat a l'etapa 1, entra al grup privat de WhatsApp amb l'organització i els voluntaris.",
    "Durant la teva etapa, comparteix-hi la teva ubicació en temps real. Només la veuran les persones del grup.",
  ];
  const es = [
    "Por tu seguridad en la etapa 1, entra en el grupo privado de WhatsApp con la organización y los voluntarios.",
    "Durante tu etapa, comparte en él tu ubicación en tiempo real. Solo la verán las personas del grupo.",
  ];
  const nota = "En una emergència greu, truca primer al 112. · En una emergencia grave, llama primero al 112.";
  const p = (s, extra) => `<p style="margin:0 0 10px;font-size:16px;line-height:24px;${extra || ""}">${esc(s)}</p>`;
  const html = `<!DOCTYPE html>
<html lang="ca"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(assumpte)}</title></head>
<body style="margin:0;padding:0;background-color:#E9EDF3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E9EDF3;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background-color:#FFFFFF;border-radius:14px;overflow:hidden;">
<tr><td align="center" style="background-color:#15315F;padding:24px;">
<img src="https://llobregat.org/img/logo-footer-white.png" width="56" height="56" alt="Llobregat x la Diabetis" style="display:block;margin:0 auto;width:56px;height:56px;"></td></tr>
<tr><td style="padding:28px 36px 12px;font-family:Arial,Helvetica,sans-serif;color:#0E1B36;">
<h1 style="margin:0 0 16px;font-size:24px;line-height:30px;font-weight:800;color:#1E72D4;">${esc(hola)}</h1>
${ca.map((s) => p(s)).join("")}
<div style="height:1px;background-color:#E1E6EE;margin:14px 0;"></div>
${es.map((s) => p(s)).join("")}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:22px auto 10px;"><tr><td align="center" style="background-color:#25D366;border-radius:10px;"><a href="${esc(enllac)}" style="display:inline-block;padding:15px 26px;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Entrar al grup · Entrar al grupo</a></td></tr></table>
<p style="margin:0 0 18px;font-size:12px;line-height:18px;color:#5A6478;text-align:center;word-break:break-all;"><a href="${esc(enllac)}" style="color:#1E72D4;">${esc(enllac)}</a></p>
<p style="margin:0 0 6px;font-size:13px;line-height:19px;color:#5A6478;">${esc(nota)}</p>
<p style="margin:0 0 20px;font-size:14px;line-height:21px;color:#0E1B36;">Gràcies! · ¡Gracias!<br><span style="color:#5A6478;">Llobregat x la Diabetis</span></p></td></tr>
</table></td></tr></table></body></html>`;
  const text = [hola, "", ...ca, "", ...es, "", `Entrar al grup · Entrar al grupo: ${enllac}`, "", nota, "", "Gràcies! · ¡Gracias!", "Llobregat x la Diabetis"].join("\n");
  return { subject: assumpte, html, text };
}

// Envia fins a 100 correus d'una sola petició. "grups": resultat d'agruparPerCorreu().
async function enviarLotGrup(grups, enllac, opcions) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) throw new Error("Falta RESEND_API_KEY o RESEND_FROM_EMAIL");
  const fromName = process.env.RESEND_FROM_NAME || "Repte Llobregat x la Diabetis";
  const fitxes = grups.map((g) => {
    const c = construirEmailGrup(g, enllac, opcions);
    return { from: `${fromName} <${fromEmail}>`, to: [g.email], subject: c.subject, html: c.html, text: c.text };
  });
  if (!fitxes.length) return { enviats: [] };
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(fitxes),
  });
  const cos = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Resend ha respost ${res.status}: ${cos.slice(0, 300)}`);
  return { enviats: grups.map((g) => g.email) };
}

module.exports = { classificar, agruparPerCorreu, construirEmailGrup, enviarLotGrup, ENLLAC_RE, EMAIL_RE };
