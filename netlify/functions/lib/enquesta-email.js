// netlify/functions/lib/enquesta-email.js
//
// Correu de petició d'opinió (4 grups x CA/ES/EN), amb el mateix disseny que
// el correu de confirmació d'inscripció. Es fa servir per:
//   - enviar via Resend des de admin-enquestes.js (construirCorreu)
//   - baixar l'HTML per enganxar-lo a una campanya de MailerLite
//     (construirCorreu amb placeholders: nom "{$name}", enllaç "{$enquesta_link}")

const SITE = () => (process.env.SITE_URL || "https://llobregat.org").replace(/\/$/, "");

const TEXTOS = {
  ca: {
    kicker: "REPTE SOLIDARI · LLOBREGAT X LA DIABETIS",
    saluda: (nom) => (nom ? `Gràcies, ${nom}!` : "Gràcies!"),
    boto: "Respondre l'enquesta →",
    durada: "Et portarà uns 5 minuts. Gairebé tot són valoracions d'un clic.",
    privacitat: "Les respostes es tracten de forma confidencial i només es comuniquen de forma agregada, tret que ens autoritzis a citar-te.",
    peuLink: "Si el botó no funciona, copia aquest enllaç al navegador:",
    footerAredi: "El 100% dels donatius van directament a AREDI per finançar la investigació de la cura de la diabetis tipus 1.",
    footerContacte: 'Llobregat x la Diabetis · AREDI · Dubtes? Escriu-nos a <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>',
    grups: {
      participant: {
        assumpte: "Com ha anat el repte? Dona'ns la teva opinió",
        preheader: "Ajuda'ns a fer el repte millor l'any vinent: 5 minuts, un clic per resposta.",
        intro: "El repte Llobregat x la Diabetis ja ha arribat a la meta, i és gràcies a tu. Ara ens agradaria saber com ho has viscut: què t'ha agradat, què es pot millorar i si tornaràs a ser-hi.",
        ask: "La teva opinió ens ajudarà a decidir com serà la propera edició.",
      },
      ajuntament: {
        assumpte: "El vostre municipi i el repte: ens ajudeu a millorar?",
        preheader: "Volem la valoració del vostre ajuntament o entitat anfitriona. 5 minuts.",
        intro: "Gràcies per haver obert les portes del vostre municipi al repte Llobregat x la Diabetis. Res no hauria estat possible sense la vostra implicació i la de la vostra gent.",
        ask: "Volem saber com ha anat la coordinació, què podem fer per posar-vos-ho més fàcil i com us agradaria participar-hi en properes edicions.",
      },
      voluntari: {
        assumpte: "Gràcies per ajudar-nos! Com ha anat per a tu?",
        preheader: "Volem aprendre de la teva experiència com a voluntari/ària. 5 minuts.",
        intro: "Aquest repte l'han fet possible persones com tu, que heu donat temps, esforç i bon humor. Gràcies de part de tot l'equip.",
        ask: "Per organitzar-nos millor l'any vinent, necessitem saber què ha funcionat, què t'ha faltat i com t'has sentit.",
      },
      entitat: {
        assumpte: "Gràcies per col·laborar amb el repte. Ens dones la teva opinió?",
        preheader: "Volem la valoració de la vostra col·laboració. 5 minuts.",
        intro: "Gràcies per sumar-vos al repte Llobregat x la Diabetis. La vostra col·laboració ha estat clau per arribar tan lluny.",
        ask: "Ens agradaria saber com ha estat l'experiència, què podem fer millor i com us agradaria col·laborar en el futur.",
      },
    },
  },
  es: {
    kicker: "RETO SOLIDARIO · LLOBREGAT X LA DIABETIS",
    saluda: (nom) => (nom ? `¡Gracias, ${nom}!` : "¡Gracias!"),
    boto: "Responder la encuesta →",
    durada: "Te llevará unos 5 minutos. Casi todo son valoraciones de un clic.",
    privacitat: "Las respuestas se tratan de forma confidencial y solo se comunican de forma agregada, salvo que nos autorices a citarte.",
    peuLink: "Si el botón no funciona, copia este enlace en el navegador:",
    footerAredi: "El 100% de los donativos van directamente a AREDI para financiar la investigación de la cura de la diabetes tipo 1.",
    footerContacte: 'Llobregat x la Diabetis · AREDI · ¿Dudas? Escríbenos a <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>',
    grups: {
      participant: {
        assumpte: "¿Cómo ha ido el reto? Danos tu opinión",
        preheader: "Ayúdanos a hacer el reto mejor el año que viene: 5 minutos, un clic por respuesta.",
        intro: "El reto Llobregat x la Diabetis ya ha llegado a la meta, y es gracias a ti. Ahora nos gustaría saber cómo lo has vivido: qué te ha gustado, qué se puede mejorar y si volverás a estar.",
        ask: "Tu opinión nos ayudará a decidir cómo será la próxima edición.",
      },
      ajuntament: {
        assumpte: "Vuestro municipio y el reto: ¿nos ayudáis a mejorar?",
        preheader: "Queremos la valoración de vuestro ayuntamiento o entidad anfitriona. 5 minutos.",
        intro: "Gracias por abrir las puertas de vuestro municipio al reto Llobregat x la Diabetis. Nada habría sido posible sin vuestra implicación y la de vuestra gente.",
        ask: "Queremos saber cómo ha ido la coordinación, qué podemos hacer para ponéroslo más fácil y cómo os gustaría participar en próximas ediciones.",
      },
      voluntari: {
        assumpte: "¡Gracias por ayudarnos! ¿Cómo ha ido para ti?",
        preheader: "Queremos aprender de tu experiencia como voluntario/a. 5 minutos.",
        intro: "Este reto lo han hecho posible personas como tú, que habéis dado tiempo, esfuerzo y buen humor. Gracias de parte de todo el equipo.",
        ask: "Para organizarnos mejor el año que viene, necesitamos saber qué ha funcionado, qué te ha faltado y cómo te has sentido.",
      },
      entitat: {
        assumpte: "Gracias por colaborar con el reto. ¿Nos das tu opinión?",
        preheader: "Queremos la valoración de vuestra colaboración. 5 minutos.",
        intro: "Gracias por sumaros al reto Llobregat x la Diabetis. Vuestra colaboración ha sido clave para llegar tan lejos.",
        ask: "Nos gustaría saber cómo ha sido la experiencia, qué podemos hacer mejor y cómo os gustaría colaborar en el futuro.",
      },
    },
  },
  en: {
    kicker: "CHARITY CHALLENGE · LLOBREGAT X LA DIABETIS",
    saluda: (nom) => (nom ? `Thank you, ${nom}!` : "Thank you!"),
    boto: "Take the survey →",
    durada: "It takes about 5 minutes. Almost everything is a one-click rating.",
    privacitat: "Answers are kept confidential and only reported in aggregate, unless you allow us to quote you.",
    peuLink: "If the button doesn't work, copy this link into your browser:",
    footerAredi: "100% of donations go directly to AREDI to fund research into a cure for type 1 diabetes.",
    footerContacte: 'Llobregat x la Diabetis · AREDI · Questions? Write to us at <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>',
    grups: {
      participant: {
        assumpte: "How was the challenge? Tell us what you think",
        preheader: "Help us make next year's challenge better: 5 minutes, one click per answer.",
        intro: "The Llobregat x la Diabetis challenge has crossed the finish line, and it's thanks to you. Now we'd love to hear how it went for you: what you liked, what we can improve and whether you'll be back.",
        ask: "Your feedback will help us decide what the next edition looks like.",
      },
      ajuntament: {
        assumpte: "Your municipality and the challenge: will you help us improve?",
        preheader: "We'd like the view of your town council or host organisation. 5 minutes.",
        intro: "Thank you for opening your municipality's doors to the Llobregat x la Diabetis challenge. None of it would have been possible without your involvement and that of your people.",
        ask: "We'd like to know how the coordination went, what we can do to make it easier for you and how you'd like to take part in future editions.",
      },
      voluntari: {
        assumpte: "Thank you for helping! How was it for you?",
        preheader: "We want to learn from your experience as a volunteer. 5 minutes.",
        intro: "This challenge was made possible by people like you, who gave time, effort and good spirits. Thank you from the whole team.",
        ask: "To organise ourselves better next year, we need to know what worked, what was missing and how you felt.",
      },
      entitat: {
        assumpte: "Thank you for supporting the challenge. May we ask your opinion?",
        preheader: "We'd like your view on how your support went. 5 minutes.",
        intro: "Thank you for joining the Llobregat x la Diabetis challenge. Your support was key to getting this far.",
        ask: "We'd like to know how the experience was, what we can do better and how you'd like to support us in the future.",
      },
    },
  },
};

const IDIOMES = ["ca", "es", "en"];

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function enllacPer(token, idioma) {
  return `${SITE()}/enquesta?t=${encodeURIComponent(token)}&l=${idioma}`;
}

// opcions: { grup, idioma, nom, link, nomRaw, linkRaw }
//   nom / link s'escapen; nomRaw / linkRaw s'inserten tal qual (per als
//   marcadors de MailerLite, p. ex. "{$name}" i "{$enquesta_link}").
function construirCorreu(opcions) {
  const idioma = IDIOMES.includes(opcions.idioma) ? opcions.idioma : "ca";
  const t = TEXTOS[idioma];
  const g = t.grups[opcions.grup] || t.grups.participant;
  const nomHtml = opcions.nomRaw !== undefined ? opcions.nomRaw : esc(opcions.nom || "");
  const linkHtml = opcions.linkRaw !== undefined ? opcions.linkRaw : esc(opcions.link || "");
  const saludaHtml = opcions.nomRaw !== undefined
    ? t.saluda("\u0000").replace("\u0000", nomRaw_(opcions.nomRaw))
    : esc(t.saluda(opcions.nom || ""));

  const html = `<!DOCTYPE html>
<html lang="${idioma}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Llobregat x la Diabetis</title>
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
  <div style="display:none; font-size:1px; color:#E9EDF3; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${esc(g.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E9EDF3;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" class="llxd-wrapper" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border-radius:14px; overflow:hidden;">
        <tr>
          <td align="center" style="background-color:#15315F; padding:32px 24px 28px;">
            <img src="https://llobregat.org/img/logo-footer-white.png" width="72" height="72" alt="Llobregat x la Diabetis" style="display:block; margin:0 auto 14px; width:72px; height:72px;">
            <div style="font-family:Arial, Helvetica, sans-serif; font-size:12px; letter-spacing:1.5px; font-weight:bold; color:#5AC0E6; text-transform:uppercase;">${esc(t.kicker)}</div>
          </td>
        </tr>
        <tr>
          <td class="llxd-px" style="padding:36px 40px 8px;">
            <h1 class="llxd-h1" style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:30px; line-height:36px; font-weight:800; color:#1E72D4;">${saludaHtml}</h1>
          </td>
        </tr>
        <tr>
          <td class="llxd-px" style="padding:12px 40px 4px;">
            <p style="margin:0 0 14px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:#0E1B36;">${esc(g.intro)}</p>
            <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:24px; color:#0E1B36;">${esc(g.ask)}</p>
          </td>
        </tr>
        <tr>
          <td class="llxd-px" align="center" style="padding:26px 40px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr><td align="center" style="border-radius:8px; background-color:#FF6B47;">
                <a href="${linkHtml}" target="_blank" style="display:inline-block; padding:15px 32px; font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:bold; color:#FFFFFF;">${esc(t.boto)}</a>
              </td></tr>
            </table>
            <p style="margin:14px 0 0; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:20px; color:#5A6478;">${esc(t.durada)}</p>
          </td>
        </tr>
        <tr>
          <td class="llxd-px" style="padding:20px 40px 30px;">
            <p style="margin:0 0 10px; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#7C8AA5;">${esc(t.privacitat)}</p>
            <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#7C8AA5; word-break:break-all;">${esc(t.peuLink)}<br><a href="${linkHtml}" style="color:#1E72D4;">${linkHtml}</a></p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#0E1B36; padding:26px 40px;">
            <p style="margin:0 0 16px; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:19px; color:#B9C6DE;">${esc(t.footerAredi)}</p>
            <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; color:#7C8AA5;">${t.footerContacte}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    t.saluda(opcions.nomRaw !== undefined ? opcions.nomRaw : opcions.nom || ""),
    "",
    g.intro,
    g.ask,
    "",
    t.boto.replace(/ →$/, "") + ": " + (opcions.linkRaw !== undefined ? opcions.linkRaw : opcions.link || ""),
    t.durada,
    "",
    t.privacitat,
    "",
    t.footerAredi,
  ].join("\n");

  return { subject: g.assumpte, html, text };
}

function nomRaw_(raw) { return raw; }

module.exports = { construirCorreu, enllacPer, IDIOMES, SITE };
