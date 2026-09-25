// netlify/functions/lib/mailerlite.js
//
// Notificació a MailerLite quan una comanda queda pagada (via Stripe) o
// confirmada sense cost (codi de descompte d'Heroi). Compartit entre
// stripe-webhook.js i submit-registration.js.
//
// El camp "idioma" (CA/ES/EN) ja es guarda al subscriptor tal com es fa
// servir a la resta d'automatitzacions existents (newsletter): no calen
// grups nous per idioma, l'automatització de confirmació d'inscripció
// s'ha de muntar amb el mateix criteri (condició/filtre pel camp idioma)
// que ja feu servir.
//
// Els camps (name, modalitat, tram, samarretes...) es calculen a
// lib/dades-comanda.js, compartit amb lib/confirmacio-email.js (l'email
// transaccional per Resend), perquè els dos correus mostrin exactament els
// mateixos valors.

const { construirCampsComanda } = require("./dades-comanda");

async function notificarMailerLite(ordre, orderId) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_GROUP_ID;
  if (!apiKey || !groupId) return; // opcional, no bloqueja res si no està configurat

  const email = ordre.email_contacte;
  if (!email) return;

  const fields = construirCampsComanda(ordre, orderId);

  await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, groups: [groupId], fields }),
  });
}

module.exports = { notificarMailerLite };
