// lib/store.js
// Emmagatzematge amb Netlify Blobs: inclòs gratis amb Netlify, sense compte
// externa ni API key que gestionar.
//
// En principi getStore(name) hauria de detectar automàticament el context
// (site ID i token) quan la funció corre desplegada a Netlify. Si per
// qualsevol motiu no ho fa ("The environment has not been configured to
// use Netlify Blobs..."), calen les variables d'entorn NETLIFY_SITE_ID i
// NETLIFY_BLOBS_TOKEN (Site configuration > Environment variables), que ja
// estaven documentades com a necessàries per aquest projecte. Les passem
// explícitament sempre que existeixin, com a xarxa de seguretat.

const { getStore } = require("@netlify/blobs");

function opcionsStore(name) {
  const opcions = { name };
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) {
    opcions.siteID = process.env.NETLIFY_SITE_ID;
    opcions.token = process.env.NETLIFY_BLOBS_TOKEN;
  }
  return opcions;
}

function ordresStore() {
  return getStore(opcionsStore("ordres"));
}

// Índex lleuger, només per emails amb comanda ja PAGADA: una entrada per
// email (clau normalitzada), en comptes de llistar totes les comandes en
// cada inscripció (lent i, amb prou comandes, arriba a fallar). S'escriu
// quan una comanda passa a "pagat" (gratuïta a l'instant, o des del
// webhook de Stripe) i només es llegeix (1 lectura) per comprovar-ho.
// Una clau per cada comanda last minute física (caminant/corrent/bici).
// Comptar-ne les claus és molt més ràpid que llegir totes les comandes una
// per una (que és el que feia el comptador de places i el trigava molt).
function placesLastMinuteStore() {
  return getStore(opcionsStore("places-last-minute"));
}

// Còpies ja calculades de dades agregades que costa molt recalcular en
// cada visita (p. ex. les estadístiques públiques).
function snapshotsStore() {
  return getStore(opcionsStore("snapshots"));
}
async function llegirSnapshot(clau) {
  return snapshotsStore().get(clau, { type: "json" });
}
async function desarSnapshot(clau, dades) {
  await snapshotsStore().setJSON(clau, { desat: new Date().toISOString(), dades });
}

function emailsPagatsStore() {
  return getStore(opcionsStore("emails-pagats"));
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

// Llegeix com a molt aquestes claus alhora. Abans es llegia una comanda
// darrera l'altra (una per una): amb desenes/centenars de comandes això
// arribava a trigar 20-30 segons (i la pàgina pública de donatius es
// quedava penjada esperant-ho). Llegint-les en paral·lel, per blocs, baixa
// a 1-2 segons sense arribar a saturar Netlify Blobs amb centenars de
// peticions simultànies de cop.
const CONCURRENCIA_LECTURA = 25;

async function llistarOrdres() {
  const store = ordresStore();
  const { blobs } = await store.list();
  const resultats = [];
  for (let i = 0; i < blobs.length; i += CONCURRENCIA_LECTURA) {
    const bloc = blobs.slice(i, i + CONCURRENCIA_LECTURA);
    const valors = await Promise.all(
      bloc.map(b => store.get(b.key, { type: "json" }).then(val => (val ? { order_id: b.key, ...val } : null)))
    );
    for (const v of valors) if (v) resultats.push(v);
  }
  return resultats;
}

// Elimina una comanda (des de l'admin: tant "pagades" com "incompletes").
// Si tenia email marcat com a pagat a l'índex, el treiem també, perquè
// aquell email pugui tornar a inscriure's si cal.
async function marcarPlacaLastMinute(orderId) {
  await placesLastMinuteStore().set(orderId, new Date().toISOString());
}

async function comptarPlacesLastMinute() {
  const { blobs } = await placesLastMinuteStore().list();
  return blobs.length;
}

async function eliminarOrdre(orderId) {
  const actual = await obtenirOrdre(orderId);
  await ordresStore().delete(orderId);
  try {
    await placesLastMinuteStore().delete(orderId); // allibera la plaça last minute
  } catch (e) {
    // si no hi era, no passa res
  }
  if (actual && actual.estat === "pagat" && actual.email_contacte) {
    try {
      await emailsPagatsStore().delete(normalitzarEmail(actual.email_contacte));
    } catch (e) {
      // no bloquegem l'eliminació de la comanda per això
    }
  }
  return true;
}

// Marca un email com a ja inscrit i pagat. Cal cridar-ho just quan una
// comanda passa a estat "pagat" (des de submit-registration.js si és
// gratuïta, o des de stripe-webhook.js quan Stripe confirma el pagament).
async function marcarEmailPagat(email, orderId) {
  const key = normalitzarEmail(email);
  if (!key) return;
  await emailsPagatsStore().set(key, orderId);
}

// Quan es corregeix el correu d'una comanda pagada: treu l'antic de l'índex
// d'emails ja inscrits i hi posa el nou.
async function canviarEmailPagat(emailVell, emailNou, orderId) {
  const vell = normalitzarEmail(emailVell);
  if (vell) {
    try { await emailsPagatsStore().delete(vell); } catch (e) { /* no passa res */ }
  }
  await marcarEmailPagat(emailNou, orderId);
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
  eliminarOrdre,
  marcarPlacaLastMinute,
  comptarPlacesLastMinute,
  emailJaRegistrat,
  canviarEmailPagat,
  marcarEmailPagat,
  llegirSnapshot,
  desarSnapshot,
};
