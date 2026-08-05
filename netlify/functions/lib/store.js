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

// Com MailerLite no permet enviar més d'un correu igual el mateix dia,
// forcem que la inscripció sigui única per email: mirem si ja existeix
// alguna comanda PAGADA amb aquest email abans de deixar continuar cap a
// pagament. Comparació sense distingir majúscules/minúscules ni espais.
async function emailJaRegistrat(email) {
  const emailNormalitzat = String(email || "").trim().toLowerCase();
  if (!emailNormalitzat) return false;
  const ordres = await llistarOrdres();
  return ordres.some(
    (o) => o.estat === "pagat" && String(o.email_contacte || "").trim().toLowerCase() === emailNormalitzat
  );
}

module.exports = { crearOrdre, obtenirOrdre, actualitzarOrdre, llistarOrdres, emailJaRegistrat };
