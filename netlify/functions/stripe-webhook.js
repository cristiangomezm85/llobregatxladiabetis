// netlify/functions/stripe-webhook.js
//
// PAS 3 del flux: Stripe truca aquest endpoint quan el pagament s'ha
// completat de veritat. Marca la comanda com a pagada. Configura'l a
// Stripe Dashboard > Developers > Webhooks apuntant a:
// https://EL_TEU_DOMINI/.netlify/functions/stripe-webhook
// Esdeveniment: checkout.session.completed

const Stripe = require("stripe");
const { obtenirOrdre, actualitzarOrdre } = require("./lib/store");
const { notificarMailerLite } = require("./lib/mailerlite");

exports.handler = async (event) => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Signatura de webhook invàlida:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: "Event ignorat" };
  }

  const session = stripeEvent.data.object;
  const orderId = session.metadata?.order_id || session.client_reference_id;
  if (!orderId) {
    console.error("checkout.session.completed sense order_id");
    return { statusCode: 400, body: "Falta order_id a la sessió" };
  }

  const ordre = await obtenirOrdre(orderId);
  if (!ordre) {
    console.error(`Comanda ${orderId} no trobada`);
    return { statusCode: 404, body: "Comanda no trobada" };
  }
  if (ordre.estat === "pagat") {
    return { statusCode: 200, body: "Ja processat prèviament" };
  }

  await actualitzarOrdre(orderId, {
    estat: "pagat",
    stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent,
    data_pagament: new Date().toISOString(),
  });

  try {
    await notificarMailerLite(ordre, orderId);
  } catch (e) {
    console.error("Error notificant MailerLite:", e);
  }

  return { statusCode: 200, body: "OK" };
};
