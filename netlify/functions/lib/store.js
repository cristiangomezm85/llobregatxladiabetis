// lib/store.js
// Emmagatzematge amb Netlify Blobs: inclòs gratis amb Netlify, sense compte
// externa ni API key que gestionar.

const { getStore } = require("@netlify/blobs");

function ordresStore() {
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
