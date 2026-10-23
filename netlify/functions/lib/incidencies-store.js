// netlify/functions/lib/incidencies-store.js
// Incidències (samarreta, bossa, correu...) a Netlify Blobs, store "incidencies":
// una clau per incidència (inc-<data>-<aleatori>), amb estat pendent/resolta.

const crypto = require("crypto");
const { getStore } = require("@netlify/blobs");

function store() {
  const opcions = { name: "incidencies" };
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) {
    opcions.siteID = process.env.NETLIFY_SITE_ID;
    opcions.token = process.env.NETLIFY_BLOBS_TOKEN;
  }
  return getStore(opcions);
}

function nouId() {
  return "inc-" + new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + crypto.randomBytes(3).toString("hex");
}

async function desar(inc) { await store().setJSON(inc.id, inc); return inc; }
async function obtenir(id) { return store().get(id, { type: "json" }); }
async function llistar() {
  const s = store();
  const { blobs } = await s.list();
  const out = [];
  for (let i = 0; i < blobs.length; i += 25) {
    out.push(...(await Promise.all(blobs.slice(i, i + 25).map((b) => s.get(b.key, { type: "json" })))));
  }
  return out.filter(Boolean);
}

module.exports = { nouId, desar, obtenir, llistar };
