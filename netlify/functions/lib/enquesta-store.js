// netlify/functions/lib/enquesta-store.js
//
// Emmagatzematge de l'enquesta a Netlify Blobs (store "enquesta"), amb les
// mateixes opcions que lib/store.js (NETLIFY_SITE_ID + NETLIFY_BLOBS_TOKEN
// si existeixen). Claus:
//   tok/<token>        perfil de qui rep l'enllaç (grup, nom, org, idioma…)
//   dest/<grup>        llista de destinataris d'aquell grup (inclou email)
//   resp/<id>          una resposta (id = hash del token, o "anon-…")
//   dia/<aaaa-mm-dd>   comptador d'emails enviats aquell dia (límit de Resend)

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

function store() {
  const opcions = { name: "enquesta" };
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) {
    opcions.siteID = process.env.NETLIFY_SITE_ID;
    opcions.token = process.env.NETLIFY_BLOBS_TOKEN;
  }
  return getStore(opcions);
}

const CONCURRENCIA = 25;

async function enBlocs(elements, fn) {
  const out = [];
  for (let i = 0; i < elements.length; i += CONCURRENCIA) {
    const bloc = elements.slice(i, i + CONCURRENCIA);
    out.push(...(await Promise.all(bloc.map(fn))));
  }
  return out;
}

function nouToken() {
  return crypto.randomBytes(12).toString("base64url"); // 16 caràcters, no endevinable
}
function idResposta(token) {
  return "t-" + crypto.createHash("sha256").update(String(token)).digest("hex").slice(0, 14);
}
function hashEmail(email) {
  return crypto.createHash("sha256").update(String(email || "").trim().toLowerCase()).digest("hex").slice(0, 16);
}
function tokenValid(t) {
  return typeof t === "string" && /^[A-Za-z0-9_-]{16}$/.test(t);
}

async function llegir(clau) { return store().get(clau, { type: "json" }); }
async function escriure(clau, valor) { await store().setJSON(clau, valor); }

async function llistarRespostes() {
  const s = store();
  const { blobs } = await s.list({ prefix: "resp/" });
  const valors = await enBlocs(blobs, (b) => s.get(b.key, { type: "json" }));
  return valors.filter(Boolean);
}
async function clausRespostes() {
  const { blobs } = await store().list({ prefix: "resp/" });
  return new Set(blobs.map((b) => b.key.slice(5)));
}

module.exports = {
  store, enBlocs, nouToken, idResposta, hashEmail, tokenValid,
  llegir, escriure, llistarRespostes, clausRespostes,
};
