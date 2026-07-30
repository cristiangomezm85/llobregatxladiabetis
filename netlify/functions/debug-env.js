// GET /.netlify/functions/debug-env
// Diagnòstic temporal. NO revela cap valor secret — només diu si
// cada variable esperada existeix (true/false) i, si existeix,
// quants caràcters té (per detectar espais extra o valors buits
// per error). Esborra aquesta funció quan ja no la necessitis.

exports.handler = async () => {
  const check = (name) => {
    const val = process.env[name];
    return {
      present: typeof val === "string" && val.length > 0,
      length: typeof val === "string" ? val.length : 0,
    };
  };

  let blobsVersion = "desconeguda";
  try {
    blobsVersion = require("@netlify/blobs/package.json").version;
  } catch (e) {
    blobsVersion = "no s'ha pogut llegir: " + String(e);
  }

  const body = {
    ADMIN_TOKEN: check("ADMIN_TOKEN"),
    BLOBS_SITE_ID: check("BLOBS_SITE_ID"),
    BLOBS_TOKEN: check("BLOBS_TOKEN"),
    nodeVersion: process.version,
    netlifyBlobsPackageVersion: blobsVersion,
    // Algunes variables que Netlify hauria d'injectar automàticament,
    // útils per saber si estem realment en runtime de Netlify:
    hasSITE_ID: !!process.env.SITE_ID,
    hasDEPLOY_ID: !!process.env.DEPLOY_ID,
    hasCONTEXT: process.env.CONTEXT || null,
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body, null, 2),
  };
};
