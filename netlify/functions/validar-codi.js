// netlify/functions/validar-codi.js
//
// Validació ràpida d'un codi de descompte (Heroi = gratuït, o parcial per
// cèntims -- p. ex. Corresolidaris) des del formulari, sense haver d'enviar
// tot el formulari. Diu si el codi és vàlid i, si aplica un descompte
// parcial, quin import té (per poder mostrar el preu final correcte al
// frontend abans d'enviar res). El càlcul real del preu es torna a fer (i
// verificar) a submit-registration.js, així que aquest endpoint no és una
// font de veritat, només UX.

const { trobarCodiDescompte } = require("./lib/pricing");

exports.handler = async (event) => {
  const codi = event.queryStringParameters?.codi || "";
  const info = trobarCodiDescompte(codi);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({
      valid: info !== null,
      gratis: info ? info.gratis : null,
      descompte_centims: info && !info.gratis ? info.descompteCentims : null,
    }),
  };
};
