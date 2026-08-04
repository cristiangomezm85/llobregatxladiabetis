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

async function notificarMailerLite(ordre) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_GROUP_ID;
  if (!apiKey || !groupId) return; // opcional, no bloqueja res si no està configurat

  const email = ordre.email_contacte;
  if (!email) return;

  const payload = ordre.payload || {};

  const municipi = ordre.recollida_text || payload.recollida_municipi_nom || "";

  // Un sol camp de tram, ja resolt segons modalitat, per no dependre de
  // contingut condicional a MailerLite (que no tenim):
  //  - caminant/corrent/bici: "Inici → Final"
  //  - animar: el municipi des d'on anima (el mateix que la recollida)
  //  - dorsal0: no hi ha tram, mostrem "Dorsal 0"
  let tram;
  if (payload.tram_inici_nom && payload.tram_final_nom) {
    tram = `${payload.tram_inici_nom} → ${payload.tram_final_nom}`;
  } else if (ordre.modalitat === "animar") {
    tram = municipi || "—";
  } else {
    tram = "Dorsal 0";
  }

  const fields = {
    name: payload.nom || "",
    last_name: payload.cognoms || "",
    phone: payload.telefon || "",
    idioma: (payload.idioma || "CA").toUpperCase(),
    modalitat: ordre.modalitat || "",
    municipi,
    colla_nom: payload.club_nom || "",
    tram,
  };

  await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, groups: [groupId], fields }),
  });
}

module.exports = { notificarMailerLite };
