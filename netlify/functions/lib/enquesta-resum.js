// netlify/functions/lib/enquesta-resum.js
//
// Correu "resum" posterior al repte: agraïment + fotos (Drive) + enquesta +
// testimoni en vídeo + botó per comunicar incidències de samarreta/bossa.
// Mateix disseny que la resta de correus. Es genera en CA / ES / EN, o en
// una versió trilingüe (per a MailerLite, on no es pot personalitzar l'idioma).
//
//   construirResum({ idioma, nom, linkEnquesta, linkIncidencia, mode })
//     mode "resend"     -> enllaços personals, peu amb contacte
//     mode "mailerlite" -> enllaços genèrics i {$unsubscribe}
//   construirResumTri({ linkEnquesta, linkIncidencia, mode })

const CFG = require("./enquesta-config");

const SITE = () => (process.env.SITE_URL || "https://llobregat.org").replace(/\/$/, "");

const TXT = {
  ca: {
    kicker: "REPTE SOLIDARI · 16–18 D'OCTUBRE 2026",
    assumpte: "Gràcies de tot cor! Fotos, enquesta i la teva gota",
    preheader: "Gràcies per fer-ho possible. L'ampolla de l'esperança continua oberta fins al 31 d'octubre.",
    gracies: (n) => (n ? `Gràcies, ${n}!` : "Gràcies!"),
    intro1: "Del 16 al 18 d'octubre el Llobregat va ser molt més que un riu: passos, ànims des de les voreres, mans esteses als avituallaments i gent que no es coneixia caminant plegada pel mateix motiu. Ho heu fet possible vosaltres: participants, voluntaris, ajuntaments, entitats i col·laboradors. Des del fons del cor, gràcies.",
    intro2: "Cada pas ha servit per recollir fons que van íntegrament a AREDI per investigar la cura de la diabetis tipus 1. Això és el que heu fet: donar esperança.",
    fotosT: "Les fotos del repte", fotosP: "Aquí a sota en tens algunes, però segur que vosaltres en teniu moltes més. Mira les que ja hi ha i puja les teves: entre tots fem l'àlbum del repte.", fotosB: "Veure i pujar fotos", fotosP2: "Aquí a sota en tens algunes, però segur que vosaltres en teniu moltes més. Mira l'àlbum i puja les teves: entre tots el fem gran.", fotosBV: "Veure les fotos", fotosBU: "Pujar les meves fotos",
    enqT: "Com ho hem fet?", enqP: "Necessitem la teva opinió per saber què ha anat bé i què es podria haver fet millor. Són uns 5 minuts i quasi tot és d'un clic.", enqB: "Respondre l'enquesta",
    vidT: "Un testimoni en vídeo (si vols)", vidP: "Grava un vídeo curt, d'uns 30–60 segons i millor en vertical, explicant què ha significat el repte per a tu, i puja'l des d'aquest botó (et demanarem el teu nom i correu per poder demanar-te permís). No el publicarem mai sense el teu consentiment.", vidB: "Pujar el vídeo",
    incT: "Tens alguna incidència pendent?", incP: "Si encara tens alguna cosa per resoldre amb la samarreta o la bossa (no vas rebre el correu, no vas poder anar a la recollida, et falta la samarreta, la talla no és la correcta…), explica-ho i et contactarem.", incB: "Comunicar una incidència",
    donaT: "L'ampolla de l'esperança continua oberta fins al 31 d'octubre", donaP: "Si encara no ho has fet, ara és el moment: posa la teva gota. Cada gota omple l'ampolla una mica més, i cada gota ens apropa a la cura.", donaB: "Posa la teva gota",
    aredi: "El 100% dels donatius van directament a AREDI per finançar la investigació de la cura de la diabetis tipus 1.",
    motiu: "Reps aquest correu perquè formes part del repte Llobregat x la Diabetis.",
    contacte: 'Dubtes? Escriu-nos a <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>. Si no vols rebre més correus, també ens ho pots dir allà.',
    baixa: "Cancel·lar la subscripció",
  },
  es: {
    kicker: "RETO SOLIDARIO · 16–18 DE OCTUBRE DE 2026",
    assumpte: "¡Gracias de corazón! Fotos, encuesta y tu gota",
    preheader: "Gracias por hacerlo posible. La botella de la esperanza sigue abierta hasta el 31 de octubre.",
    gracies: (n) => (n ? `¡Gracias, ${n}!` : "¡Gracias!"),
    intro1: "Del 16 al 18 de octubre el Llobregat fue mucho más que un río: pasos, ánimos desde las aceras, manos tendidas en los avituallamientos y gente que no se conocía caminando junta por el mismo motivo. Lo habéis hecho posible vosotros: participantes, voluntarios, ayuntamientos, entidades y colaboradores. Desde el fondo del corazón, gracias.",
    intro2: "Cada paso ha servido para recoger fondos que van íntegramente a AREDI para investigar la cura de la diabetes tipo 1. Esto es lo que habéis hecho: dar esperanza.",
    fotosT: "Las fotos del reto", fotosP: "Aquí debajo tienes algunas, pero seguro que vosotros tenéis muchas más. Mira las que ya hay y sube las tuyas: entre todos hacemos el álbum del reto.", fotosB: "Ver y subir fotos", fotosP2: "Aquí debajo tienes algunas, pero seguro que vosotros tenéis muchas más. Mira el álbum y sube las tuyas: entre todos lo hacemos grande.", fotosBV: "Ver las fotos", fotosBU: "Subir mis fotos",
    enqT: "¿Cómo lo hemos hecho?", enqP: "Necesitamos tu opinión para saber qué ha ido bien y qué se podría haber hecho mejor. Son unos 5 minutos y casi todo es de un clic.", enqB: "Responder la encuesta",
    vidT: "Un testimonio en vídeo (si quieres)", vidP: "Graba un vídeo corto, de unos 30–60 segundos y mejor en vertical, contando qué ha significado el reto para ti, y súbelo desde este botón (te pediremos tu nombre y correo para poder pedirte permiso). No lo publicaremos nunca sin tu consentimiento.", vidB: "Subir el vídeo",
    incT: "¿Tienes alguna incidencia pendiente?", incP: "Si todavía tienes algo por resolver con la camiseta o la bolsa (no recibiste el correo, no pudiste ir a la recogida, te falta la camiseta, la talla no es la correcta…), cuéntanoslo y te contactaremos.", incB: "Comunicar una incidencia",
    donaT: "La botella de la esperanza sigue abierta hasta el 31 de octubre", donaP: "Si todavía no lo has hecho, ahora es el momento: pon tu gota. Cada gota llena un poco más la botella, y cada gota nos acerca a la cura.", donaB: "Pon tu gota",
    aredi: "El 100% de los donativos van directamente a AREDI para financiar la investigación de la cura de la diabetes tipo 1.",
    motiu: "Recibes este correo porque formas parte del reto Llobregat x la Diabetis.",
    contacte: '¿Dudas? Escríbenos a <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>. Si no quieres recibir más correos, también puedes decírnoslo allí.',
    baixa: "Cancelar la suscripción",
  },
  en: {
    kicker: "CHARITY CHALLENGE · 16–18 OCTOBER 2026",
    assumpte: "Thank you from the heart! Photos, survey and your drop",
    preheader: "Thank you for making it happen. The bottle of hope stays open until 31 October.",
    gracies: (n) => (n ? `Thank you, ${n}!` : "Thank you!"),
    intro1: "From 16 to 18 October the Llobregat was so much more than a river: footsteps, cheers from the pavements, helping hands at the refreshment points and people who had never met, walking together for the same reason. You made it happen: participants, volunteers, town councils, organisations and sponsors. From the bottom of our hearts, thank you.",
    intro2: "Every step helped raise funds that go entirely to AREDI to research a cure for type 1 diabetes. This is what you did: you gave hope.",
    fotosT: "Photos of the challenge", fotosP: "Below are a few, but we're sure you have many more. Browse the ones already there and upload yours: together we build the challenge's album.", fotosB: "View and upload photos", fotosP2: "Below are a few, but we're sure you have many more. Browse the album and upload yours: together we make it grow.", fotosBV: "View the photos", fotosBU: "Upload my photos",
    enqT: "How did we do?", enqP: "We need your opinion to know what went well and what could have been done better. It takes about 5 minutes and almost everything is one click.", enqB: "Take the survey",
    vidT: "A video testimonial (if you like)", vidP: "Record a short video, about 30–60 seconds and ideally vertical, about what the challenge meant to you, and upload it with this button (we'll ask for your name and email so we can request your permission). We will never publish it without your consent.", vidB: "Upload the video",
    incT: "Any unresolved issue?", incP: "If you still have something to sort out with your T-shirt or bag (you didn't get the email, couldn't make the collection, your T-shirt is missing, wrong size…), tell us and we'll get in touch.", incB: "Report an issue",
    donaT: "The bottle of hope stays open until 31 October", donaP: "If you haven't yet, now is the moment: add your drop. Every drop fills the bottle a little more, and every drop brings us closer to a cure.", donaB: "Add your drop",
    aredi: "100% of donations go directly to AREDI to fund research into a cure for type 1 diabetes.",
    motiu: "You are receiving this email because you are part of the Llobregat x la Diabetis challenge.",
    contacte: 'Questions? Write to us at <a href="mailto:info@llobregat.org" style="color:#5AC0E6;">info@llobregat.org</a>. If you don\'t want to receive more emails, you can tell us there too.',
    baixa: "Unsubscribe",
  },
};

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const FONT = "font-family:Arial, Helvetica, sans-serif;";

// Si l'enllaç per pujar fotos és llobregat.org/fotos (o el web d'Apps Script), hi afegim l'idioma (?l=ca|es|en).
function ambIdioma(url, idioma) {
  if (!url || !/script\.google\.com|script\.googleusercontent\.com|\/(fotos|video)(\?|$)/.test(url)) return url;
  return url + (url.indexOf("?") >= 0 ? "&" : "?") + "l=" + idioma;
}

function boto(href, text, color) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;"><tr><td align="center" style="border-radius:8px; background-color:${color};">
        <a href="${href}" target="_blank" style="display:inline-block; padding:13px 26px; ${FONT} font-size:15px; font-weight:bold; color:#FFFFFF;">${esc(text)}</a>
      </td></tr></table>`;
}

function targeta(titol, text, btnHtml, accent) {
  return `<tr><td class="llxd-px" style="padding:14px 40px 2px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FAFAF6; border-radius:10px; border-left:4px solid ${accent};">
      <tr><td style="padding:18px 22px 20px;">
        <div style="${FONT} font-size:18px; line-height:24px; font-weight:bold; color:#15315F; margin-bottom:6px;">${esc(titol)}</div>
        <div style="${FONT} font-size:15px; line-height:22px; color:#0E1B36;">${esc(text)}</div>
        ${btnHtml}
      </td></tr>
    </table>
  </td></tr>`;
}

function fotosHtml(fotos) {
  const f = (fotos || []).slice(0, 3);
  if (!f.length) return "";
  const w = Math.floor(520 / f.length) - 6;
  const cel = f.map((u) => `<td width="${Math.round(100 / f.length)}%" style="padding:0 3px;"><img src="${esc(u)}" width="${w}" alt="" style="display:block; width:100%; height:auto; border-radius:8px;"></td>`).join("");
  return `<tr><td class="llxd-px" style="padding:18px 40px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cel}</tr></table></td></tr>`;
}

// Cos d'UN idioma (sense capçalera ni peu).
function cosIdioma(idioma, o) {
  const t = TXT[idioma];
  const nom = o.nomRaw !== undefined ? o.nomRaw : esc(o.nom || "");
  const titol = o.nomRaw !== undefined && o.nomRaw ? t.gracies("\u0000").replace("\u0000", o.nomRaw) : esc(t.gracies(o.nom || ""));
  void nom;
  const fotos = o.fotos !== undefined ? o.fotos : CFG.fotos;
  const fotosUrl = o.fotosUrl !== undefined ? o.fotosUrl : CFG.fotosUrl;
  const videosUrl = o.videosUrl !== undefined ? o.videosUrl : CFG.videosUrl;
  let h = `<tr><td class="llxd-px" style="padding:34px 40px 6px;">
    <h1 class="llxd-h1" style="margin:0; ${FONT} font-size:32px; line-height:38px; font-weight:800; color:#1E72D4;">${titol}</h1>
  </td></tr>
  <tr><td class="llxd-px" style="padding:10px 40px 4px;">
    <p style="margin:0 0 12px; ${FONT} font-size:16px; line-height:24px; color:#0E1B36;">${esc(t.intro1)}</p>
    <p style="margin:0; ${FONT} font-size:16px; line-height:24px; color:#0E1B36;">${esc(t.intro2)}</p>
  </td></tr>
  ${fotosHtml(fotos)}`;
  const fotosPujarUrl = o.fotosPujarUrl !== undefined ? o.fotosPujarUrl : CFG.fotosPujarUrl;
  if (fotosUrl && fotosPujarUrl) {
    const dos = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;"><tr>
      <td style="border-radius:8px; background-color:#1E72D4;"><a href="${esc(fotosUrl)}" target="_blank" style="display:inline-block; padding:13px 22px; ${FONT} font-size:15px; font-weight:bold; color:#FFFFFF;">${esc(t.fotosBV)}</a></td>
      <td width="10" style="font-size:0; line-height:0;">&nbsp;</td>
      <td style="border-radius:8px; background-color:#15315F;"><a href="${esc(ambIdioma(fotosPujarUrl, idioma))}" target="_blank" style="display:inline-block; padding:13px 22px; ${FONT} font-size:15px; font-weight:bold; color:#FFFFFF;">${esc(t.fotosBU)}</a></td>
    </tr></table>`;
    h += targeta(t.fotosT, t.fotosP2, dos, "#5AC0E6");
  } else if (fotosUrl) h += targeta(t.fotosT, t.fotosP, boto(esc(fotosUrl), t.fotosB, "#1E72D4"), "#5AC0E6");
  h += targeta(t.enqT, t.enqP, boto(o.linkEnquesta, t.enqB, "#FF6B47"), "#FF6B47");
  if (videosUrl) h += targeta(t.vidT, t.vidP, boto(esc(ambIdioma(videosUrl, idioma)), t.vidB, "#1E72D4"), "#1E72D4");
  h += targeta(t.incT, t.incP, boto(o.linkIncidencia, t.incB, "#15315F"), "#15315F");
  h += `<tr><td class="llxd-px" style="padding:22px 40px 30px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#15315F; border-radius:12px;">
      <tr><td align="center" style="padding:28px 24px 30px;">
        <div style="${FONT} font-size:30px; line-height:34px; margin-bottom:8px;">&#128167;</div>
        <div style="${FONT} font-size:22px; line-height:28px; font-weight:800; color:#FFFFFF; margin-bottom:10px;">${esc(t.donaT)}</div>
        <div style="${FONT} font-size:16px; line-height:24px; color:#DCE6F7;">${esc(t.donaP)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 0;"><tr><td align="center" style="border-radius:8px; background-color:#FF6B47;">
          <a href="https://llobregat.org/dona" target="_blank" style="display:inline-block; padding:15px 32px; ${FONT} font-size:16px; font-weight:bold; color:#FFFFFF;">${esc(t.donaB)} &rarr;</a>
        </td></tr></table>
      </td></tr>
    </table>
  </td></tr>`;
  return h;
}

function envolta(idioma, cos, o, idiomaPeu) {
  const t = TXT[idiomaPeu];
  const baixa = o.mode === "mailerlite"
    ? `<br><a href="{$unsubscribe}" style="color:#B9C6DE; text-decoration:underline;">${esc(t.baixa)}</a>` : "";
  const html = `<!DOCTYPE html>
<html lang="${idioma === "tri" ? "ca" : idioma}">
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
    .llxd-h1 { font-size:27px !important; line-height:33px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#E9EDF3;">
  <div style="display:none; font-size:1px; color:#E9EDF3; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${esc(TXT[idioma === "tri" ? "ca" : idioma].preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#E9EDF3;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" class="llxd-wrapper" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border-radius:14px; overflow:hidden;">
        <tr><td align="center" style="background-color:#15315F; padding:32px 24px 28px;">
          <img src="https://llobregat.org/img/logo-footer-white.png" width="72" height="72" alt="Llobregat x la Diabetis" style="display:block; margin:0 auto 14px; width:72px; height:72px;">
          <div style="${FONT} font-size:12px; letter-spacing:1.5px; font-weight:bold; color:#5AC0E6; text-transform:uppercase;">${esc(TXT[idioma === "tri" ? "ca" : idioma].kicker)}</div>
        </td></tr>
        ${cos}
        <tr><td style="background-color:#0E1B36; padding:26px 40px;">
          <p style="margin:0 0 14px; ${FONT} font-size:13px; line-height:19px; color:#B9C6DE;">${esc(t.aredi)}</p>
          <p style="margin:0 0 8px; ${FONT} font-size:12px; line-height:18px; color:#7C8AA5;">${esc(t.motiu)}</p>
          <p style="margin:0; ${FONT} font-size:12px; line-height:18px; color:#7C8AA5;">${t.contacte}${baixa}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return html;
}

function textPla(idioma, o) {
  const t = TXT[idioma];
  const fotosUrl = o.fotosUrl !== undefined ? o.fotosUrl : CFG.fotosUrl;
  const videosUrl = o.videosUrl !== undefined ? o.videosUrl : CFG.videosUrl;
  return [
    t.gracies(o.nom || ""), "", t.intro1, t.intro2, "",
    ...(fotosUrl ? [t.fotosT + ": " + fotosUrl] : []),
    ...(CFG.fotosPujarUrl && o.fotosPujarUrl === undefined ? [t.fotosBU + ": " + CFG.fotosPujarUrl] : (o.fotosPujarUrl ? [t.fotosBU + ": " + o.fotosPujarUrl] : [])),
    t.enqT + " " + o.linkEnquesta,
    ...(videosUrl ? [t.vidT + ": " + videosUrl] : []),
    t.incT + " " + o.linkIncidencia, "",
    t.donaT + ". " + t.donaP + " https://llobregat.org/dona", "", t.aredi,
  ].join("\n");
}

function construirResum(o) {
  const idioma = TXT[o.idioma] ? o.idioma : "ca";
  const opcions = { mode: "resend", ...o };
  const html = envolta(idioma, cosIdioma(idioma, opcions), opcions, idioma);
  return { subject: TXT[idioma].assumpte, html, text: textPla(idioma, opcions) };
}

// Versió trilingüe (CA, ES, EN en un sol correu) per a MailerLite.
function construirResumTri(o) {
  const opcions = { mode: "mailerlite", ...o };
  const sep = `<tr><td class="llxd-px" style="padding:6px 40px 0;"><div style="border-top:2px solid #E4E8F0;"></div></td></tr>`;
  const cos = ["ca", "es", "en"].map((i) => cosIdioma(i, opcions)).join(sep);
  const html = envolta("tri", cos, opcions, "ca");
  return { subject: "Gràcies! · ¡Gracias! · Thank you! — Llobregat x la Diabetis", html };
}

module.exports = { construirResum, construirResumTri, TXT_RESUM: TXT, SITE };
