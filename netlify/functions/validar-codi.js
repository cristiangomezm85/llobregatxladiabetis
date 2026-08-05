// netlify/functions/validar-codi.js
//
// Validació ràpida d'un codi de descompte d'Heroi des del formulari, sense
// haver d'enviar tot el formulari. Nomes diu si el codi és vàlid o no; el
// càlcul real del preu es torna a fer (i verificar) a submit-registration.js,
// així que aquest endpoint no és una font de veritat, només UX.

const { codiHeroiValid } = require("./lib/pricing");

exports.handler = async (event) => {
  const codi = event.queryStringParameters?.codi || "";
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ valid: codiHeroiValid(codi) }),
  };
};
