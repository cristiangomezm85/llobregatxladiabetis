// GET /.netlify/functions/get-map-image?key=XXXX
// Lectura pública. Retorna la imatge desada amb save-map-image com
// a imatge binària de veritat (amb el Content-Type correcte), per
// poder-la fer servir directament com a <img src="...">.

const { openStore } = require("./lib/blobs");

exports.handler = async (event) => {
  const CORS = { "Access-Control-Allow-Origin": "*" };
  const key = event.queryStringParameters && event.queryStringParameters.key;

  if (!key) {
    return { statusCode: 400, headers: CORS, body: "Falta el paràmetre 'key'" };
  }

  try {
    const store = openStore("livetrack");
    let dataUri = null;
    try {
      dataUri = await store.get(`mapimg:${key}`, { type: "text" });
    } catch (e) {
      dataUri = null;
    }

    if (!dataUri) {
      return { statusCode: 404, headers: CORS, body: "Imatge no trobada" };
    }

    const match = dataUri.match(/^data:([^;]+);base64,([\s\S]*)$/);
    if (!match) {
      return { statusCode: 500, headers: CORS, body: "La imatge desada no té un format vàlid" };
    }
    const [, mime, base64Data] = match;

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        "Content-Type": mime,
        "Cache-Control": "public, max-age=3600",
      },
      body: base64Data,
      isBase64Encoded: true,
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: "Error llegint la imatge: " + String(err) };
  }
};
