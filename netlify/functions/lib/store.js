// lib/store.js
// Emmagatzematge amb Netlify Blobs.
//
// Important: el mode "automàtic" de Netlify Blobs (sense passar credencials)
// només funciona quan el lloc es desplega via Git connectat a Netlify. Si el
// desplegament es fa pujant fitxers manualment (drag & drop o reemplaçant
// fitxers solts), Netlify no injecta el context necessari i salta
// "MissingBlobsEnvironmentError". Per això aquí es configura sempre de
// forma manual, amb el Site ID i un token d'accés (variables d'entorn
// NETLIFY_SITE_ID i NETLIFY_BLOBS_TOKEN).

const { getStore } = require("@netlify/blobs");

function ordresStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;

  if (siteID && token) {
    return getStore({ name: "ordres", siteID, token });
  }

  // Fallback al mode automàtic, per si algun dia es desplega via Git
  // (en aquest cas sí que Netlify injecta el context tot sol).
  return getStore("ordres");
}

async function crearOrdre(orderId, fields) {
  await ordresStore().setJSON(orderId, fields);
  return fields;
}

async function obtenirOrdre(orderId) {
  return ordresStore().get(orderId, { type: "json" });
}

async function actualitzarOrdre(orderId, patch) {
  const actual = await obtenirOrdre(orderId);
  if (!actual) throw new Error(`Ordre ${orderId} no trobada`);
  const actualitzat = { ...actual, ...patch };
  await ordresStore().setJSON(orderId, actualitzat);
  return actualitzat;
}

async function llistarOrdres() {
  const store = ordresStore();
  const { blobs } = await store.list();
  const resultats = [];
  for (const b of blobs) {
    const val = await store.get(b.key, { type: "json" });
    if (val) resultats.push({ order_id: b.key, ...val });
  }
  return resultats;
}

module.exports = { crearOrdre, obtenirOrdre, actualitzarOrdre, llistarOrdres };
