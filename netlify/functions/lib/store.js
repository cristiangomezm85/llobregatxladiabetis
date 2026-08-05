// lib/store.js
// Emmagatzematge amb Netlify Blobs: inclòs gratis amb Netlify, sense compte
// externa ni API key que gestionar.

const { getStore } = require("@netlify/blobs");

function ordresStore() {
  return getStore("ordres");
}

// Índex lleuger, només per emails amb comanda ja PAGADA: una entrada per
// email (clau normalitzada), en comptes de llistar totes les comandes en
// cada inscripció (lent i, amb prou comandes, arriba a fallar). S'escriu
// quan una comanda passa a "pagat" (gratuïta a l'instant, o des del
// webhook de Stripe) i només es llegeix (1 lectura) per comprovar-ho.
function emailsPagatsStore() {
  return getStore("emails-pagats");
}

function normalitzarEmail(email) {
  return String(email || "").trim().toLowerCase();
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

// Marca un email com a ja inscrit i pagat. Cal cridar-ho just quan una
// comanda passa a estat "pagat" (des de submit-registration.js si és
// gratuïta, o des de stripe-webhook.js quan Stripe confirma el pagament).
async function marcarEmailPagat(email, orderId) {
  const key = normalitzarEmail(email);
  if (!key) return;
  await emailsPagatsStore().set(key, orderId);
}

// Com MailerLite no permet enviar més d'un correu igual el mateix dia,
// forcem que la inscripció sigui única per email: mirem si ja existeix
// alguna comanda PAGADA amb aquest email abans de deixar continuar cap a
// pagament. Una sola lectura directa per clau (no cal llistar res).
async function emailJaRegistrat(email) {
  const key = normalitzarEmail(email);
  if (!key) return false;
  const val = await emailsPagatsStore().get(key);
  return !!val;
}

module.exports = {
  crearOrdre,
  obtenirOrdre,
  actualitzarOrdre,
  llistarOrdres,
  emailJaRegistrat,
  marcarEmailPagat,
};
