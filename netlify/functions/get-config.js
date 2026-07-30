// GET /.netlify/functions/get-config
// Lectura pública de la configuració del recorregut: imatge del
// mapa, sprite del corredor, i tots els punts (de traçat i de
// poble). No requereix autenticació — és només lectura.

const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  try {
    const store = getStore("livetrack");
    let config = null;
    try {
      config = await store.get("config", { type: "json" });
    } catch (e) {
      config = null; // clau encara no creada — és normal la primera vegada
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(config || { points: [], mapImage: null, runnerSprite: null }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "No s'ha pogut llegir la configuració", detail: String(err) }),
    };
  }
};
