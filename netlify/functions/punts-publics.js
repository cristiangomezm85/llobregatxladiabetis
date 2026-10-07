// netlify/functions/punts-publics.js
// Llista pública dels punts de recollida (nom, horari, municipis). Surt de
// lib/punts.js, la mateixa font que fa servir el perfil i l'escàner.
const { PUNTS, LIMIT_CANVI_ISO, publicPunt } = require("./lib/punts");

exports.handler = async () => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
  },
  body: JSON.stringify({
    ok: true,
    limit_canvi: LIMIT_CANVI_ISO,
    punts: PUNTS.filter((p) => p.seleccionable).map(publicPunt),
  }),
});
