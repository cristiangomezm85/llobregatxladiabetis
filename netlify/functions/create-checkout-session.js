// netlify/functions/create-checkout-session.js
//
// PAS 2 del flux: crea la sessió de Stripe Checkout a partir d'una comanda
// ja validada. L'import es torna a llegir de Netlify Blobs (mai del
// frontend), en dues línies (inscripció/samarreta + donació) si aplica.

const Stripe = require("stripe");
const { obtenirOrdre } = require("./lib/store");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return resposta(405, { error: "Mètode no permès" });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return resposta(500, { error: "Falta configuració de Stripe al servidor" });
  }
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return resposta(400, { error: "JSON invàlid" });
  }

  const { order_id } = body;
  if (!order_id) return resposta(400, { error: "Falta order_id" });

  const ordre = await obtenirOrdre(order_id);
  if (!ordre) return resposta(404, { error: "Comanda no trobada" });
  if (ordre.estat === "pagat") return resposta(409, { error: "Aquesta comanda ja s'ha pagat" });

  const siteUrl = process.env.SITE_URL || "https://llobregat.org";
  const line_items = [];

  if (ordre.import_base_centims > 0) {
    line_items.push({
      price_data: {
        currency: "eur",
        product_data: { name: ordre.descripcio },
        unit_amount: ordre.import_base_centims,
      },
      quantity: 1,
    });
  }
  if (ordre.donacio_centims > 0) {
    line_items.push({
      price_data: {
        currency: "eur",
        product_data: { name: "Donació addicional a AREDI" },
        unit_amount: ordre.donacio_centims,
      },
      quantity: 1,
    });
  }
  if (line_items.length === 0) {
    return resposta(400, { error: "L'import de la comanda ha de ser superior a 0 €" });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: order_id,
      customer_email: ordre.email_contacte || undefined,
      // receipt_email força que Stripe enviï el seu rebut de pagament a
      // aquest email quan el pagament es completi, independentment de com
      // estigui configurat l'ajust "Successful payments" al Dashboard (que
      // a més es configura per separat en mode test i en mode live, i és
      // fàcil deixar-lo activat només en un dels dos per error).
      payment_intent_data: { receipt_email: ordre.email_contacte || undefined },
      line_items,
      metadata: { order_id },
      success_url: `${siteUrl}/gracies.html?order_id=${order_id}`,
      cancel_url: `${siteUrl}/inscripcio.html?cancelled=1&order_id=${order_id}`,
    });
  } catch (e) {
    console.error("Error creant Stripe Checkout Session:", e);
    return resposta(500, { error: "No s'ha pogut iniciar el pagament" });
  }

  return resposta(200, { checkout_url: session.url });
};

function resposta(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
