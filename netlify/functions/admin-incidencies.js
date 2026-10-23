// netlify/functions/admin-incidencies.js
// Panell d'incidències (incidencies-admin.html). Protegit amb "Authorization:
// Bearer <ADMIN_TOKEN>" com la resta de l'admin.
//   GET                      -> llista (més recents primer)
//   GET ?format=csv          -> CSV per a Excel
//   POST {id, estat, nota}   -> actualitza l'estat (pendent/resolta) i la nota interna

const I = require("./lib/incidencies-store");
const { TIPUS } = require("./incidencia");

function resp(statusCode, body, headers) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(headers || {}) }, body: typeof body === "string" ? body : JSON.stringify(body) };
}
const cel = (v) => { const s = String(v == null ? "" : v).replace(/\r?\n/g, " "); return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

exports.handler = async (event) => {
  const token = process.env.ADMIN_TOKEN;
  if (token) {
    const auth = event.headers.authorization || event.headers.Authorization || "";
    if (auth !== `Bearer ${token}`) return resp(401, { ok: false, error: "No autoritzat" });
  }
  try {
    if (event.httpMethod === "GET") {
      const llista = (await I.llistar()).sort((a, b) => String(b.data).localeCompare(String(a.data)));
      if ((event.queryStringParameters || {}).format === "csv") {
        const cap = ["data", "estat", "nom", "email", "telefon", "problema", "detalls", "nota", "id"];
        const files = [cap].concat(llista.map((x) => [x.data, x.estat, x.nom, x.email, x.telefon, x.tipus.map((t) => (TIPUS[t] || { ca: t }).ca).join(" | "), x.detall, x.nota, x.id]));
        return resp(200, "﻿" + files.map((f) => f.map(cel).join(";")).join("\r\n"), { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="incidencies.csv"' });
      }
      return resp(200, { ok: true, incidencies: llista, tipus: Object.fromEntries(Object.entries(TIPUS).map(([k, v]) => [k, v.ca])) });
    }
    if (event.httpMethod === "POST") {
      let b;
      try { b = JSON.parse(event.body); } catch { return resp(400, { ok: false, error: "JSON invàlid" }); }
      const inc = b.id && /^inc-[0-9a-f-]+$/.test(b.id) ? await I.obtenir(b.id) : null;
      if (!inc) return resp(404, { ok: false, error: "No trobada" });
      if (b.estat !== undefined) {
        if (!["pendent", "resolta"].includes(b.estat)) return resp(400, { ok: false, error: "Estat no vàlid" });
        inc.estat = b.estat;
        inc.resolta_data = b.estat === "resolta" ? new Date().toISOString() : undefined;
      }
      if (b.nota !== undefined) inc.nota = String(b.nota).slice(0, 2000);
      await I.desar(inc);
      return resp(200, { ok: true, incidencia: inc });
    }
    return resp(405, { ok: false });
  } catch (e) {
    console.error("admin-incidencies:", e);
    return resp(500, { ok: false, error: String(e.message || e) });
  }
};
