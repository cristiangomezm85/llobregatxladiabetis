// Helper compartit: obre el store "livetrack" de Netlify Blobs.
//
// Per defecte s'intenta el mode automàtic (getStore(nom)), que
// hauria de funcionar en desplegaments normals via git. Si el teu
// entorn dona "MissingBlobsEnvironmentError" malgrat desplegar per
// git, defineix aquestes dues variables d'entorn a Netlify i el
// codi passarà a mode explícit, que funciona sempre:
//
//   BLOBS_SITE_ID  → Site settings → General → Site details → Site ID
//   BLOBS_TOKEN    → User settings → Applications → New access token
//
const { getStore } = require("@netlify/blobs");

function openStore(name) {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name, siteID, token });
  }
  return getStore(name);
}

module.exports = { openStore };
