// netlify/functions/punts-publics.js
// Llista pública dels punts de recollida (nom, horari, municipis). Surt de
// lib/punts.js, la mateixa font que fa servir el perfil i l'escàner.
const { VERSIO, PUNTS, LIMIT_CANVI_ISO, publicPunt } = require("./lib/punts");

exports.handler = async () => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    // El navegador sempre revalida (un canvi d'horari o lloc es veu al moment) i el CDN
    // el guarda només 60 s.
    "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate",
  },
  body: JSON.stringify({
    ok: true,
    versio: VERSIO,
    limit_canvi: LIMIT_CANVI_ISO,
    punts: PUNTS.filter((p) => p.seleccionable).map(publicPunt),
  }),
});
