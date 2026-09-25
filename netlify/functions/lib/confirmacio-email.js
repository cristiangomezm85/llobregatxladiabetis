// netlify/functions/lib/confirmacio-email.js
//
// Email de confirmació d'inscripció enviat per una via TRANSACCIONAL
// (Resend), separada de MailerLite. Motiu: l'automatització de
// MailerLite ("Joins a group") només dispara un cop cada 24h per
// subscriptor -- és una protecció anti-spam del propi motor d'automatitzacions
// de MailerLite, no una limitació del pla (ni passant a un pla de pagament
// desapareix). Si dues inscripcions independents comparteixen email el
// mateix dia (p. ex. una família inscrivint dos menors, o algú fent servir
// "Afegir un altre inscrit" des de gracies.html), la segona podria no rebre
// mai el correu de MailerLite.
//
// Aquest email es dispara SEMPRE, un cop per comanda, independentment de
// MailerLite i sense cap límit diari per destinatari -- Resend és un
// servei transaccional, pensat per a exactament aquest cas d'ús (pla
// gratuït: 3.000 emails/mes, topall de 100/dia, sense targeta de crèdit).
//
// La plantilla HTML reprodueix EXACTAMENT el disseny que ja fèieu servir a
// l'automatització de MailerLite (mateixos colors, mateixa maquetació,
// mateixos textos fixos, només traduïts a CA/ES/EN). Els valors dinàmics
// ({$name}, {$modalitat}, {$tram}...) es calculen a lib/dades-comanda.js,
// EL MATEIX mòdul que fa servir lib/mailerlite.js -- així els dos correus
// mostren sempre els mateixos valors, amb el mateix format (p. ex.
// l'import sempre amb punt decimal, la data sempre en format ca-ES), i el
// resum de samarretes recorre TOT l'array (talla i quantitat reals),
// perquè una compra de diverses samarretes o un tram de diversos dies es
// mostri bé -- que és precisament el bug que hi va haver abans.
//
// Configuració necessària (variables d'entorn a Netlify):
//   RESEND_API_KEY    -- token de l'API de Resend (comença per "re_")
//   RESEND_FROM_EMAIL -- adreça remitent, ha de ser d'un domini verificat
//                         a Resend (p. ex. inscripcions@llobregat.org).
//                         Resend NO permet enviar a destinataris arbitraris
//                         amb el domini de prova "resend.dev": només envia
//                         a l'email del propi compte. Cal verificar un
//                         domini propi (Resend > Domains > Add Domain,
//                         registres DNS) abans de rebre inscripcions reals.
//   RESEND_FROM_NAME  -- (opcional) nom del remitent que es mostra al
//                         destinatari; per defecte "Repte Llobregat x la
//                         Diabetis"
//
// Si falten aquestes variables, la funció no fa res (igual que
// notificarMailerLite quan no hi ha MAILERLITE_API_KEY): no bloqueja mai la
// inscripció ni el pagament.

const { construirCampsComanda } = require("./dades-comanda");

const TEXTOS = {
  CA: {
    titlePage: "Llobregat x la Diabetis",
    preheader: "Confirmació de la teva inscripció al repte solidari Llobregat x la Diabetis.",
    kicker: "REPTE SOLIDARI · 16–18 OCTUBRE 2026",
    assumpte: "Ja estàs dins! — Repte Llobregat x la Diabetis",
    saluda: (nom) => `Ja estàs dins${nom ? ", " + nom : ""}!`,
    intro: "Gràcies per inscriure't a Llobregat x la Diabetis. La teva inscripció ja està confirmada i aviat rebràs tots els detalls pràctics per correu i a les nostres xarxes.",
    resumTitol: "El teu resum",
    etiquetes: {
      modalitat: "Modalitat", tram: "Tram", municipi: "Punt de recollida",
      samarretes: "Samarretes", colla_nom: "Club / colla",
      num_comanda: "Núm. de comanda", import_pagat: "Import", data_inscripcio: "Data",
    },
    queSaberTitol: "Què has de saber ara",
    bullets: [
      "Llegeix el reglament del repte: horaris, seguretat i normes de la cursa.",
      "La samarreta i la bossa es recolliran al punt disponible més proper al municipi que has triat. No podem garantir que sigui exactament aquest municipi; ho confirmarem més endavant.",
      'Consulta les distàncies i tots els punts de pas del recorregut a llobregat.org/pobles.&nbsp; <a href="https://llobregat.org/pobles" target="_blank" style="color:#1E72D4; font-weight:bold;">Veure els punts del recorregut →</a>',
      "Anirem actualitzant l'hora estimada de pas per cada punt i les franges d'avituallament a mesura que ho concretem amb els respectius ajuntaments.",
      "Segueix-nos a Instagram per no perdre't res dels preparatius.",
    ],
    ctaBoto: "Llegir el reglament →",
    xarxesText: "T'hi apuntes a les xarxes?",
    footerAredi: "El 100% dels donatius van directament a AREDI per finançar la investigació de la cura de la diabetis tipus 1.",
    footerContacte: 'Llobregat x la Diabetis · AREDI · Dubtes? Escriu-nos a <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>',
  },
  ES: {
    titlePage: "Llobregat x la Diabetis",
    preheader: "Confirmación de tu inscripción al reto solidario Llobregat x la Diabetis.",
    kicker: "RETO SOLIDARIO · 16–18 OCTUBRE 2026",
    assumpte: "¡Ya estás dentro! — Repte Llobregat x la Diabetis",
    saluda: (nom) => `¡Ya estás dentro${nom ? ", " + nom : ""}!`,
    intro: "Gracias por inscribirte en Llobregat x la Diabetis. Tu inscripción ya está confirmada y en breve recibirás todos los detalles prácticos por correo y en nuestras redes.",
    resumTitol: "Tu resumen",
    etiquetes: {
      modalitat: "Modalidad", tram: "Tramo", municipi: "Punto de recogida",
      samarretes: "Camisetas", colla_nom: "Club / peña",
      num_comanda: "Núm. de pedido", import_pagat: "Importe", data_inscripcio: "Fecha",
    },
    queSaberTitol: "Qué debes saber ahora",
    bullets: [
      "Lee el reglamento del reto: horarios, seguridad y normas de la carrera.",
      "La camiseta y la bolsa se recogerán en el punto disponible más cercano al municipio que has elegido. No podemos garantizar que sea exactamente ese municipio; lo confirmaremos más adelante.",
      'Consulta las distancias y todos los puntos de paso del recorrido en llobregat.org/pobles.&nbsp; <a href="https://llobregat.org/pobles" target="_blank" style="color:#1E72D4; font-weight:bold;">Ver los puntos del recorrido →</a>',
      "Iremos actualizando la hora estimada de paso por cada punto y las franjas de avituallamiento a medida que lo concretemos con los respectivos ayuntamientos.",
      "Síguenos en Instagram para no perderte nada de los preparativos.",
    ],
    ctaBoto: "Leer el reglamento →",
    xarxesText: "¿Te sumas en redes?",
    footerAredi: "El 100% de los donativos van directamente a AREDI para financiar la investigación de la cura de la diabetes tipo 1.",
    footerContacte: 'Llobregat x la Diabetis · AREDI · ¿Dudas? Escríbenos a <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>',
  },
  EN: {
    titlePage: "Llobregat x la Diabetis",
    preheader: "Confirmation of your registration for the Llobregat x la Diabetis solidarity challenge.",
    kicker: "SOLIDARITY CHALLENGE · OCTOBER 16–18, 2026",
    assumpte: "You're in! — Repte Llobregat x la Diabetis",
    saluda: (nom) => `You're in${nom ? ", " + nom : ""}!`,
    intro: "Thank you for registering for Llobregat x la Diabetis. Your registration is now confirmed, and you'll soon receive all the practical details by email and on our social media.",
    resumTitol: "Your summary",
    etiquetes: {
      modalitat: "Category", tram: "Segment", municipi: "Pickup point",
      samarretes: "T-shirts", colla_nom: "Club / team",
      num_comanda: "Order no.", import_pagat: "Amount", data_inscripcio: "Date",
    },
    queSaberTitol: "What you need to know now",
    bullets: [
      "Read the challenge rules: schedules, safety, and race rules.",
      "The t-shirt and bag will be collected at the available point closest to the town you chose. We can't guarantee it will be exactly that town; we'll confirm it later.",
      'Check the distances and all the route\'s waypoints at llobregat.org/pobles.&nbsp; <a href="https://llobregat.org/pobles" target="_blank" style="color:#1E72D4; font-weight:bold;">See the route waypoints →</a>',
      "We'll keep updating the estimated time at each point and the refreshment stop windows as we confirm them with each town council.",
      "Follow us on Instagram so you don't miss any of the preparations.",
    ],
    ctaBoto: "Read the rules →",
    xarxesText: "Join us on social media?",
    footerAredi: "100% of donations go directly to AREDI to fund research into the cure for type 1 diabetes.",
    footerContacte: 'Llobregat x la Diabetis · AREDI · Questions? Email us at <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>',
  },
};

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function construirContingut(ordre, orderId, idioma) {
  const camps = construirCampsComanda(ordre, orderId);
  const t = TEXTOS[idioma];
  const et = t.etiquetes;

  const files = [
    [et.modalitat, camps.modalitat],
    [et.tram, camps.tram],
    [et.municipi, camps.municipi],
    [et.samarretes, camps.samarretes],
    [et.colla_nom, camps.colla_nom],
  ];
  const filesPeu = [
    [et.num_comanda, camps.num_comanda],
    [et.import_pagat, camps.import_pagat],
    [et.data_inscripcio, camps.data_inscripcio],
  ];

  const filaHtml = (label, valor, mida) => `
                      <tr>
                        <td style="padding:5px 0; font-family:Arial, Helvetica, sans-serif; font-size:${mida}px; color:#5A6478; width:42%; vertical-align:top;">${escapeHtml(label)}</td>
                        <td style="padding:5px 0; font-family:Arial, Helvetica, sans-serif; font-size:${mida}px; color:${mida === 14 ? "#0E1B36" : "#5A6478"}; ${mida === 14 ? "font-weight:bold;" : ""}">${escapeHtml(valor)}</td>
                      </tr>`;

  const filesHtml = files.map(([label, valor]) => filaHtml(label, valor, 14)).join("");
  const filesPeuHtml = filesPeu.map(([label, valor]) => filaHtml(label, valor, 13)).join("");

  const bulletsHtml = t.bullets.map((b) => `
                <tr>
                  <td style="padding:0 0 12px; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:22px; color:#0E1B36;">
                    <span style="color:#FF6B47; font-weight:bold;">&#8226;</span>&nbsp; ${b}
                  </td>
                </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="${idioma.toLowerCase()}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${t.titlePage}</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  body, table, td { font-family: Arial, Helvetica, sans-serif; }
  body { margin:0; padding:0; background-color:#E9EDF3; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; }
  a { text-decoration:none; }
  @media screen and (max-width:600px) {
    .llxd-wrapper { width:100% !important; }
    .llxd-px { padding-left:20px !important; padding-right:20px !important; }
    .llxd-h1 { font-size:26px !important; line-height:32px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#E9EDF3;">
  <div style="display:none; font-size:1px; color:#E9EDF3; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    ${t.preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E9EDF3;">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <table role="presentation" class="llxd-wrapper" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border-radius:14px; overflow:hidden;">

          <tr>
            <td align="center" style="background-color:#15315F; padding:32px 24px 28px;">
              <img src="https://llobregat.org/img/logo-footer-white.png" width="72" height="72" alt="Llobregat x la Diabetis" style="display:block; margin:0 auto 14px; width:72px; height:72px;">
              <div style="font-family:Arial, Helvetica, sans-serif; font-size:12px; letter-spacing:1.5px; font-weight:bold; color:#5AC0E6; text-transform:uppercase;">
                ${t.kicker}
              </div>
            </td>
          </tr>

          <tr>
            <td class="llxd-px" style="padding:36px 40px 8px;">
              <h1 class="llxd-h1" style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:30px; line-height:36px; font-weight:800; color:#1E72D4;">
                ${escapeHtml(t.saluda(camps.name))}
              </h1>
            </td>
          </tr>

          <tr>
            <td class="llxd-px" style="padding:12px 40px 8px;">
              <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:#0E1B36;">
                ${t.intro}
              </p>
            </td>
          </tr>

          <tr>
            <td class="llxd-px" style="padding:20px 40px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAFAF6; border-radius:10px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <div style="font-family:Arial, Helvetica, sans-serif; font-size:13px; font-weight:bold; letter-spacing:0.5px; text-transform:uppercase; color:#5A6478; margin-bottom:10px;">
                      ${t.resumTitol}
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${filesHtml}
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px; border-top:1px solid #E4E8F0; padding-top:8px;">
                      ${filesPeuHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="llxd-px" style="padding:28px 40px 4px;">
              <div style="font-family:Arial, Helvetica, sans-serif; font-size:13px; font-weight:bold; letter-spacing:0.5px; text-transform:uppercase; color:#5A6478; margin-bottom:12px;">
                ${t.queSaberTitol}
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${bulletsHtml}
              </table>
            </td>
          </tr>

          <tr>
            <td class="llxd-px" align="center" style="padding:26px 40px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius:8px; background-color:#FF6B47;">
                    <a href="https://llobregat.org/reglament" target="_blank" style="display:inline-block; padding:14px 30px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:bold; color:#FFFFFF;">
                      ${t.ctaBoto}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="llxd-px" align="center" style="padding:20px 40px 36px;">
              <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:20px; color:#5A6478;">
                ${t.xarxesText}<br>
                <a href="https://instagram.com/llobregatxladiabetis" target="_blank" style="color:#1E72D4; font-weight:bold;">@llobregatxladiabetis</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#0E1B36; padding:26px 40px;">
              <p style="margin:0 0 16px; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:19px; color:#B9C6DE;">
                ${t.footerAredi}
              </p>
              <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#7C8AA5;">
                ${t.footerContacte}
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  const textFiles = [...files, ...filesPeu].map(([label, valor]) => `${label}: ${valor}`);
  const textBullets = t.bullets.map((b) => "- " + b.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&#8226;/g, ""));
  const text = [
    t.saluda(camps.name),
    "",
    t.intro,
    "",
    t.resumTitol + ":",
    ...textFiles,
    "",
    t.queSaberTitol + ":",
    ...textBullets,
    "",
    t.footerAredi,
    t.footerContacte.replace(/<[^>]+>/g, ""),
  ].join("\n");

  return { subject: t.assumpte, html, text };
}

async function enviarEmailConfirmacio(ordre, orderId) {
  // NOTA DE DIAGNÒSTIC (temporal): logs explícits a cada pas perquè, mirant
  // els logs de la funció a Netlify, es vegi sense ambigüitat si s'ha
  // arribat a trucar Resend o s'ha aturat abans (i per quin motiu). Un cop
  // confirmat que els correus arriben bé, es poden treure aquests
  // console.log (deixant els console.error, que ja hi eren).
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  console.log(
    `[RESEND] comanda=${orderId} RESEND_API_KEY=${apiKey ? "definida (" + apiKey.slice(0, 6) + "…)" : "NO DEFINIDA"} RESEND_FROM_EMAIL=${fromEmail || "NO DEFINIDA"}`
  );
  if (!apiKey || !fromEmail) {
    console.log(`[RESEND] comanda=${orderId} -> S'OMET l'enviament: falta RESEND_API_KEY o RESEND_FROM_EMAIL`);
    return; // opcional, no bloqueja res si no està configurat
  }

  const email = ordre.email_contacte;
  if (!email) {
    console.log(`[RESEND] comanda=${orderId} -> S'OMET l'enviament: la comanda no té email_contacte`);
    return;
  }

  const payload = ordre.payload || {};
  const idiomaRaw = (payload.idioma || "CA").toUpperCase();
  const idioma = ["CA", "ES", "EN"].includes(idiomaRaw) ? idiomaRaw : "CA";

  const { subject, html, text } = construirContingut(ordre, orderId, idioma);
  const fromName = process.env.RESEND_FROM_NAME || "Repte Llobregat x la Diabetis";
  const nomDesti = [payload.nom, payload.cognoms].filter(Boolean).join(" ");

  console.log(`[RESEND] comanda=${orderId} -> Enviant a ${email} (idioma ${idioma}) des de ${fromEmail}...`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [nomDesti ? `${nomDesti} <${email}>` : email],
      subject,
      html,
      text,
    }),
  });

  const cos = await res.text().catch(() => "");
  console.log(`[RESEND] comanda=${orderId} -> Resend ha respost status=${res.status} body=${cos.slice(0, 300)}`);

  if (!res.ok) {
    throw new Error(`Resend ha respost ${res.status}: ${cos.slice(0, 300)}`);
  }
}

module.exports = { enviarEmailConfirmacio, construirContingut };
