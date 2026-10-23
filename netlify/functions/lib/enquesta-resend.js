// netlify/functions/lib/enquesta-resend.js
// Enviament per Resend (API de lots: fins a 100 correus per crida).
// Variables: RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME (ja existents).

async function enviarLot(correus) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) throw new Error("Falten RESEND_API_KEY o RESEND_FROM_EMAIL");
  const fromName = process.env.RESEND_FROM_NAME || "Repte Llobregat x la Diabetis";
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(correus.map((c) => ({
      from: `${fromName} <${fromEmail}>`,
      to: [c.nom ? `${String(c.nom).replace(/[<>",]/g, "")} <${c.email}>` : c.email],
      subject: c.subject, html: c.html, text: c.text,
      ...(c.reply_to ? { reply_to: c.reply_to } : {}),
    }))),
  });
  if (!res.ok) {
    const cos = await res.text().catch(() => "");
    throw new Error(`Resend ha respost ${res.status}: ${cos.slice(0, 300)}`);
  }
}

module.exports = { enviarLot };
