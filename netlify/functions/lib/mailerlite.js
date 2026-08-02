// netlify/functions/lib/mailerlite.js
//
// Notificació opcional a MailerLite quan una comanda queda pagada
// (via Stripe) o confirmada sense cost (codi de descompte d'Heroi).
// Compartit entre stripe-webhook.js i submit-registration.js.

async function notificarMailerLite(ordre) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_GROUP_ID;
  if (!apiKey || !groupId) return; // opcional, no bloqueja res si no està configurat

  const email = ordre.email_contacte;
  if (!email) return;

  await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      groups: [groupId],
      fields: { modalitat: ordre.modalitat || "" },
    }),
  });
}

module.exports = { notificarMailerLite };
