// lib/qr-bloc.js
//
// Bloc "el teu QR de recollida" que es reutilitza al correu de confirmació
// (inscripcions noves) i al correu massiu per a les ja pagades.

const { puntPerId } = require("./punts");
const E = require("./entregues");

const BASE = process.env.PUBLIC_BASE_URL || "https://llobregat.org";

const T = {
  CA: {
    titol: "El teu QR de recollida",
    intro: "Mostra aquest QR a la taula de recollida del teu punt per agafar la bossa, la pulsera i la samarreta (si en tens). La pulsera és obligatòria durant el repte: és necessària per l'assegurança i per accedir a l'avituallament.",
    punt: "El teu punt de recollida", codi: "Codi d'inscripció",
    canvi: "Pots canviar el punt de recollida des del teu perfil fins l'11 d'octubre. A partir del 12 d'octubre ja no es podrà modificar.",
    boto: "Veure el meu perfil →", alt: "QR de recollida", sense: "Si no et carrega la imatge, obre el teu perfil amb el botó de sota: el QR també hi surt.",
  },
  ES: {
    titol: "Tu QR de recogida",
    intro: "Muestra este QR en la mesa de recogida de tu punto para llevarte la bolsa, la pulsera y la camiseta (si tienes). La pulsera es obligatoria durante el reto: es necesaria para el seguro y para acceder al avituallamiento.",
    punt: "Tu punto de recogida", codi: "Código de inscripción",
    canvi: "Puedes cambiar el punto de recogida desde tu perfil hasta el 11 de octubre. A partir del 12 de octubre ya no se podrá modificar.",
    boto: "Ver mi perfil →", alt: "QR de recogida", sense: "Si no te carga la imagen, abre tu perfil con el botón de abajo: el QR también aparece ahí.",
  },
  EN: {
    titol: "Your pickup QR",
    intro: "Show this QR at your point's pickup table to collect your bag, wristband and t-shirt (if you have one). The wristband is mandatory during the challenge: it is required for insurance and to access the aid stations.",
    punt: "Your pickup point", codi: "Registration code",
    canvi: "You can change your pickup point from your profile until October 11. From October 12 it can no longer be changed.",
    boto: "View my profile →", alt: "Pickup QR", sense: "If the image doesn't load, open your profile with the button below: the QR is there too.",
  },
};
const IDIOMA_MIN = { CA: "ca", ES: "es", EN: "en" };

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Retorna null si la comanda no té res a recollir (p. ex. dorsal 0).
function blocQr(ordre, orderId, idioma, estat) {
  if (!E.elementsComanda(ordre).res) return null;
  const t = T[idioma] || T.CA;
  const l = IDIOMA_MIN[idioma] || "ca";
  const punt = puntPerId(E.puntEfectiu(ordre, estat || {}));
  const puntNom = punt ? punt.nom[l] : "";
  const puntQuan = punt ? punt.quan[l] : "";
  const urlQr = `${BASE}/.netlify/functions/qr?id=${orderId}`;
  const urlPerfil = `${BASE}/perfil?id=${orderId}&lang=${l}`;
  const codi = orderId.slice(0, 8).toUpperCase();

  const html = `
          <tr>
            <td class="llxd-px" style="padding:24px 40px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF5FF; border:2px solid #1E72D4; border-radius:10px;">
                <tr>
                  <td align="center" style="padding:22px 22px 8px;">
                    <div style="font-family:Arial, Helvetica, sans-serif; font-size:13px; font-weight:bold; letter-spacing:0.5px; text-transform:uppercase; color:#1E72D4; margin-bottom:8px;">${esc(t.titol)}</div>
                    <img src="${urlQr}" width="200" height="200" alt="${esc(t.alt)}" style="display:block; margin:0 auto 8px; width:200px; height:200px; background:#fff; border-radius:8px;">
                    <div style="font-family:Arial, Helvetica, sans-serif; font-size:13px; color:#5A6478;">${esc(t.codi)}: <b style="color:#0E1B36;">${esc(codi)}</b></div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 22px 4px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:21px; color:#0E1B36;">
                    <p style="margin:0 0 10px;">${esc(t.intro)}</p>
                    <p style="margin:0 0 10px;"><b>${esc(t.punt)}:</b><br>${esc(puntNom)}<br><span style="color:#5A6478;">${esc(puntQuan)}</span></p>
                    <p style="margin:0 0 10px; color:#B3361B;"><b>${esc(t.canvi)}</b></p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:6px 22px 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td align="center" style="border-radius:8px; background-color:#1E72D4;">
                        <a href="${urlPerfil}" target="_blank" style="display:inline-block; padding:12px 26px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:bold; color:#FFFFFF;">${esc(t.boto)}</a>
                      </td>
                    </tr></table>
                    <p style="margin:10px 0 0; font-family:Arial, Helvetica, sans-serif; font-size:12px; color:#5A6478;">${esc(t.sense)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

  const text = [t.titol, `${t.codi}: ${codi}`, `${t.punt}: ${puntNom} — ${puntQuan}`, t.intro, t.canvi, `${t.boto.replace(" →", "")}: ${urlPerfil}`].join("\n");
  return { html, text, urlPerfil, urlQr };
}

module.exports = { blocQr, T, esc };
