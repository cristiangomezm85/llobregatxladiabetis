// netlify/functions/qr.js
// Imatge PNG del QR d'una comanda. El QR conté l'enllaç al perfil del
// participant (https://llobregat.org/perfil?id=<order_id>): amb la càmera del
// mòbil s'obre el perfil, i l'escàner dels voluntaris en llegeix l'id.
// No llegeix cap dada: només codifica l'id rebut (format UUID).
const QRCode = require("qrcode");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE = process.env.PUBLIC_BASE_URL || "https://llobregat.org";

exports.handler = async (event) => {
  const id = (event.queryStringParameters && event.queryStringParameters.id) || "";
  if (!UUID_RE.test(id)) return { statusCode: 400, body: "id invàlid" };
  const png = await QRCode.toBuffer(`${BASE}/perfil?id=${id.toLowerCase()}`, {
    type: "png", errorCorrectionLevel: "M", margin: 2, width: 480,
  });
  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" },
    body: png.toString("base64"),
  };
};
