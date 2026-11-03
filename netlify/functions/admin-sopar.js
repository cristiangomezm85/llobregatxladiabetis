// netlify/functions/admin-sopar.js
// Panell de reserves d'El Desenllaç (admin-sopar.html). Llegeix els enviaments
// del formulari Netlify "reserva-sopar-desenllac" i hi afegeix l'estat intern
// (confirmat / baixa / nota) que es desa a Netlify Blobs, store "sopar-desenllac".
//
// Protegit amb "Authorization: Bearer <ADMIN_TOKEN>" com la resta de l'admin.
// Si ADMIN_TOKEN no està definit, NO respon (no queda obert).
//
// Variables d'entorn (Site configuration → Environment variables):
//   ADMIN_TOKEN        (ja existeix)
//   NETLIFY_API_TOKEN  token personal de Netlify (User settings → Applications →
//                      Personal access tokens). Si no hi és, es fa servir
//                      NETLIFY_BLOBS_TOKEN, que ja teniu i també serveix.
//   NETLIFY_SITE_ID    (ja existeix; si no, s'usa SITE_ID, que Netlify posa sol)
//
//   GET                      -> { reserves: [...] }
//   GET ?format=csv          -> CSV de totes les respostes (Excel)
//   POST {id, confirmat?, baixa?, nota?} -> desa l'estat intern

const { getStore } = require("@netlify/blobs");

const FORM = "reserva-sopar-desenllac";
const API = "https://api.netlify.com/api/v1";

function resp(statusCode, body, headers) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(headers || {}) }, body: typeof body === "string" ? body : JSON.stringify(body) };
}
const cel = (v) => { const s = String(v == null ? "" : v).replace(/\r?\n/g, " "); return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function store() {
  const opcions = { name: "sopar-desenllac" };
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) {
    opcions.siteID = process.env.NETLIFY_SITE_ID;
    opcions.token = process.env.NETLIFY_BLOBS_TOKEN;
  }
  return getStore(opcions);
}
async function llegirEstat() { return (await store().get("estat", { type: "json" })) || {}; }

async function netlify(path) {
  const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_BLOBS_TOKEN;
  if (!token) throw Object.assign(new Error("Falta NETLIFY_API_TOKEN a les variables d'entorn de Netlify"), { statusCode: 500 });
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw Object.assign(new Error(`API de Netlify: ${r.status} ${(await r.text()).slice(0, 200)}`), { statusCode: 502 });
  return r.json();
}

const enter = (v, def) => { const n = parseInt(String(v == null ? "" : v).trim(), 10); return Number.isFinite(n) && n >= 0 ? Math.min(n, 50) : def; };
function llista(v) {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v || "").split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
}

async function reserves() {
  const site = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  if (!site) throw Object.assign(new Error("Falta NETLIFY_SITE_ID"), { statusCode: 500 });
  const forms = await netlify(`/sites/${site}/forms`);
  const form = forms.find((f) => f.name === FORM);
  if (!form) return [];
  const subs = [];
  for (let page = 1; page <= 20; page++) {
    const lot = await netlify(`/forms/${form.id}/submissions?per_page=100&page=${page}`);
    subs.push(...lot);
    if (lot.length < 100) break;
  }
  const estat = await llegirEstat();
  return subs.map((s) => {
    const d = s.data || {};
    const e = estat[s.id] || {};
    return {
      id: s.id,
      data: s.created_at,
      nom: String(d.nom || s.name || "").trim(),
      telefon: String(d.telefon || "").trim(),
      email: String(d.email || s.email || "").trim(),
      adults: enter(d.adults, 1),
      infants: enter(d.infants, 0),
      parades: llista(d.parades),
      sopar: /^(si|sí|yes|true|on)$/i.test(String(d.sopar || "").trim()),
      alergies: String(d.alergies || "").trim(),
      comentaris: String(d.comentaris || "").trim(),
      confirmat: !!e.confirmat,
      baixa: !!e.baixa,
      nota: e.nota || "",
    };
  }).sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

exports.handler = async (event) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return resp(500, { ok: false, error: "Admin no protegit: defineix ADMIN_TOKEN a Netlify." });
  const auth = event.headers.authorization || event.headers.Authorization || "";
  if (auth !== `Bearer ${token}`) return resp(401, { ok: false, error: "No autoritzat" });

  try {
    if (event.httpMethod === "GET") {
      const llistat = await reserves();
      if ((event.queryStringParameters || {}).format === "csv") {
        const cap = ["ordre", "data", "nom", "telefon", "email", "sopar", "adults", "infants", "parades", "alergies", "comentaris", "confirmat", "baixa", "nota"];
        const files = [cap].concat(llistat.map((x, i) => [i + 1, x.data, x.nom, x.telefon, x.email, x.sopar ? "Sí" : "No", x.adults, x.infants, x.parades.join(" | "), x.alergies, x.comentaris, x.confirmat ? "Sí" : "", x.baixa ? "Sí" : "", x.nota]));
        return resp(200, "﻿" + files.map((f) => f.map(cel).join(";")).join("\r\n"), { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="reserves-desenllac.csv"' });
      }
      return resp(200, { ok: true, reserves: llistat });
    }
    if (event.httpMethod === "POST") {
      let b;
      try { b = JSON.parse(event.body); } catch { return resp(400, { ok: false, error: "JSON invàlid" }); }
      if (!b.id || !/^[0-9a-f]{12,40}$/i.test(String(b.id))) return resp(400, { ok: false, error: "id no vàlid" });
      const s = store();
      const estat = await llegirEstat();
      const e = estat[b.id] || {};
      if (b.confirmat !== undefined) e.confirmat = !!b.confirmat;
      if (b.baixa !== undefined) e.baixa = !!b.baixa;
      if (b.nota !== undefined) e.nota = String(b.nota).slice(0, 1000);
      e.actualitzat = new Date().toISOString();
      estat[b.id] = e;
      await s.setJSON("estat", estat);
      return resp(200, { ok: true, estat: e });
    }
    return resp(405, { ok: false });
  } catch (e) {
    console.error("admin-sopar:", e);
    return resp(e.statusCode || 500, { ok: false, error: String(e.message || e) });
  }
};
