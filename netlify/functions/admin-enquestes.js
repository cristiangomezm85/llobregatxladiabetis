// netlify/functions/admin-enquestes.js
//
// Panell d'administració de l'enquesta de valoració (el fa servir
// enquesta-admin.html). Protegit com la resta de l'admin:
// "Authorization: Bearer <ADMIN_TOKEN>". Si ADMIN_TOKEN no existeix, no es demana.
//
// GET  ?accio=estat                       -> comptadors per grup
//      ?accio=resum                       -> resultats agregats (mitjanes, NPS, textos)
//      ?accio=respostes&format=csv|json[&grup=]  -> totes les respostes
//      ?accio=llista&grup=X[&format=csv]  -> destinataris + enllaç personal (per MailerLite)
//      ?accio=plantilla&grup=X&idioma=ca  -> HTML del correu per enganxar a MailerLite
// POST {accio:"preparar_inscripcions"}                         -> participants = comandes pagades
//      {accio:"preparar_llista", grup, files:[{email,nom,org,idioma}]}
//      {accio:"enviar", grup, quant}                           -> envia el proper lot per Resend
//      {accio:"prova", grup, idioma, email}                    -> un correu de prova
//      {accio:"esborrar_destinatari", grup, h}                 -> treu un destinatari
//
// Variables d'entorn: RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME (ja existents),
// SITE_URL (opcional, per defecte https://llobregat.org),
// ENQUESTA_LIMIT_DIARI (opcional, per defecte 90: el pla gratuït de Resend en permet 100/dia).

const E = require("./lib/enquesta-store");
const Q = require("./lib/enquesta-preguntes");
const M = require("./lib/enquesta-email");

const IDIOMES = ["ca", "es", "en"];

function resp(statusCode, body, extraHeaders) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(extraHeaders || {}) }, body: JSON.stringify(body) };
}
function respText(statusCode, text, contentType, filename) {
  return {
    statusCode,
    headers: {
      "Content-Type": contentType, "Cache-Control": "no-store",
      ...(filename ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
    },
    body: text,
  };
}

const idioma = (x) => { const s = String(x || "").toLowerCase().slice(0, 2); return IDIOMES.includes(s) ? s : "ca"; };
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const avui = () => new Date().toISOString().slice(0, 10);

async function llegirDest(grup) { return (await E.llegir("dest/" + grup)) || []; }
async function desarDest(grup, llista) { await E.escriure("dest/" + grup, llista); }

// Afegeix destinataris nous (dedupe per email) i crea el seu token personal.
async function afegirDestinataris(grup, entrades) {
  const llista = await llegirDest(grup);
  const existents = new Set(llista.map((d) => d.h));
  const nous = [];
  let ignorats = 0;
  for (const r of entrades) {
    const email = String(r.email || "").trim().toLowerCase();
    if (!emailOk(email)) { ignorats++; continue; }
    const h = E.hashEmail(email);
    if (existents.has(h)) { ignorats++; continue; }
    existents.add(h);
    nous.push({
      email, h,
      nom: String(r.nom || "").trim().slice(0, 120),
      org: String(r.org || "").trim().slice(0, 160),
      idioma: idioma(r.idioma),
      modalitat: r.modalitat || "",
      tram: String(r.tram || "").slice(0, 200),
      token: E.nouToken(),
    });
  }
  await E.enBlocs(nous, (d) => E.escriure("tok/" + d.token, {
    grup, nom: d.nom, org: d.org, idioma: d.idioma, modalitat: d.modalitat, tram: d.tram, creat: new Date().toISOString(),
  }));
  await desarDest(grup, llista.concat(nous));
  return { afegits: nous.length, ignorats, total: llista.length + nous.length };
}

async function destinatarisInscripcions() {
  const { llistarOrdres } = require("./lib/store");
  const ordres = await llistarOrdres();
  const sortida = [];
  for (const o of ordres) {
    if (o.estat !== "pagat" || !o.email_contacte) continue;
    const p = o.payload || {};
    const tram = [p.tram_inici_nom, p.tram_final_nom].filter(Boolean).join(" → ");
    sortida.push({
      email: o.email_contacte,
      nom: p.nom || "",
      org: p.club_nom || p.recollida_municipi_nom || "",
      idioma: p.idioma,
      modalitat: o.modalitat || p.modalitat || "",
      tram,
    });
  }
  return sortida;
}

function linkDe(d) { return M.enllacPer(d.token, d.idioma); }

async function enviarLot(correus) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) throw new Error("Falten RESEND_API_KEY o RESEND_FROM_EMAIL");
  const fromName = process.env.RESEND_FROM_NAME || "Repte Llobregat x la Diabetis";
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(correus.map((c) => ({
      from: `${fromName} <${fromEmail}>`,
      to: [c.nom ? `${c.nom.replace(/[<>",]/g, "")} <${c.email}>` : c.email],
      subject: c.subject, html: c.html, text: c.text,
    }))),
  });
  if (!res.ok) {
    const cos = await res.text().catch(() => "");
    throw new Error(`Resend ha respost ${res.status}: ${cos.slice(0, 300)}`);
  }
}

function etiqueta(p, v, ll = "ca") {
  if (v === undefined || v === null) return "";
  if (v === "na") return "N/A";
  if (Array.isArray(v)) return v.map((x) => etiqueta(p, x, ll)).join(" | ");
  if (p && p.opcions) { const o = p.opcions.find((x) => x.v === v); if (o) return o[ll]; }
  return String(v);
}

function resumir(respostes) {
  const sortida = { total: respostes.length, grups: {} };
  for (const grup of Q.GRUPS_IDS) {
    const rs = respostes.filter((r) => r.grup === grup);
    const preguntes = Q.preguntesDelGrup(grup);
    const qs = [];
    for (const p of preguntes) {
      const valors = rs.map((r) => r.respostes[p.id]).filter((v) => v !== undefined);
      const base = { id: p.id, tipus: p.tipus, text: p.text.ca, n: valors.length };
      if (p.tipus === "estrelles" || p.tipus === "nps") {
        const nums = valors.filter((v) => typeof v === "number");
        base.mitjana = nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : null;
        base.dist = {};
        const max = p.tipus === "nps" ? 10 : 5;
        for (let i = p.tipus === "nps" ? 0 : 1; i <= max; i++) base.dist[i] = nums.filter((v) => v === i).length;
        if (p.na) base.na = valors.filter((v) => v === "na").length;
        if (p.tipus === "nps" && nums.length) {
          const pro = nums.filter((v) => v >= 9).length, det = nums.filter((v) => v <= 6).length;
          base.nps = Math.round(((pro - det) / nums.length) * 100);
        }
      } else if (p.tipus === "unica" || p.tipus === "multi") {
        base.opcions = p.opcions.map((o) => ({
          v: o.v, ca: o.ca,
          n: valors.filter((v) => (Array.isArray(v) ? v.includes(o.v) : v === o.v)).length,
        }));
        if (p.altre) base.altres = rs.map((r) => r.respostes[p.id + "_altre"]).filter(Boolean);
      } else if (p.tipus === "text") {
        base.textos = rs
          .filter((r) => r.respostes[p.id])
          .map((r) => ({ text: r.respostes[p.id], qui: [r.perfil.nom, r.perfil.org].filter(Boolean).join(" · ") || (r.amb_token ? "" : "anònim") }));
      }
      qs.push(base);
    }
    const g = { n: rs.length, amb_token: rs.filter((r) => r.amb_token).length, preguntes: qs };
    if (grup === "participant") {
      const per = {};
      for (const r of rs) {
        const m = r.perfil.modalitat || "(sense indicar)";
        per[m] = per[m] || { n: 0, suma: 0, nG: 0 };
        per[m].n++;
        if (typeof r.respostes.global === "number") { per[m].suma += r.respostes.global; per[m].nG++; }
      }
      g.per_modalitat = Object.entries(per).map(([m, x]) => ({ modalitat: m, n: x.n, global: x.nG ? +(x.suma / x.nG).toFixed(2) : null }));
    }
    sortida.grups[grup] = g;
  }
  return sortida;
}

function csvCell(v) {
  const s = String(v == null ? "" : v).replace(/\r?\n/g, " ");
  return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(files) { return "﻿" + files.map((f) => f.map(csvCell).join(";")).join("\r\n"); }

exports.handler = async (event) => {
  const token = process.env.ADMIN_TOKEN;
  if (token) {
    const auth = event.headers.authorization || event.headers.Authorization || "";
    if (auth !== `Bearer ${token}`) return resp(401, { ok: false, error: "No autoritzat" });
  }

  try {
    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      const accio = q.accio || "estat";

      if (accio === "estat") {
        const respostes = await E.clausRespostes();
        const grups = {};
        for (const g of Q.GRUPS_IDS) {
          const llista = await llegirDest(g);
          const respostesToken = llista.filter((d) => respostes.has(E.idResposta(d.token))).length;
          grups[g] = {
            destinataris: llista.length,
            enviats: llista.filter((d) => d.enviat).length,
            respostes_de_destinataris: respostesToken,
          };
        }
        const total = respostes.size;
        const anonimes = [...respostes].filter((k) => k.startsWith("anon-")).length;
        const dia = (await E.llegir("dia/" + avui())) || { n: 0 };
        return resp(200, {
          ok: true, grups, respostes_total: total, respostes_anonimes: anonimes,
          enviats_avui: dia.n, limit_diari: Number(process.env.ENQUESTA_LIMIT_DIARI) || 90,
          resend_configurat: !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
          site: M.SITE(),
        });
      }

      if (accio === "resum") {
        const respostes = await E.llistarRespostes();
        return resp(200, { ok: true, resum: resumir(respostes) });
      }

      if (accio === "respostes") {
        let respostes = await E.llistarRespostes();
        if (q.grup) respostes = respostes.filter((r) => r.grup === q.grup);
        respostes.sort((a, b) => String(a.data).localeCompare(String(b.data)));
        if (q.format === "json") return resp(200, { ok: true, respostes });
        const grups = q.grup ? [q.grup] : Q.GRUPS_IDS;
        // Qui ve d'enllaç i diu que se'l pot contactar: recuperem el seu email de la llista de destinataris.
        const emailPerResposta = new Map();
        for (const g of Q.GRUPS_IDS) for (const d of await llegirDest(g)) emailPerResposta.set(E.idResposta(d.token), d.email);
        const cols = [];
        for (const g of grups) for (const p of Q.preguntesDelGrup(g)) {
          cols.push({ g, p });
          if (p.altre) cols.push({ g, p, altre: true });
        }
        const cap = ["data", "grup", "idioma", "via", "nom", "org", "modalitat", "tram", "email_contacte"]
          .concat(cols.map((c) => (q.grup ? "" : c.g + ".") + c.p.id + (c.altre ? "_altre" : "")));
        const files = [cap];
        for (const r of respostes) {
          files.push([
            r.data, r.grup, r.idioma, r.amb_token ? "enllaç" : "obert", r.perfil.nom, r.perfil.org,
            r.perfil.modalitat, r.perfil.tram, r.contacte_email || (r.respostes.contactar === "si" ? emailPerResposta.get(r.id) || "" : ""),
            ...cols.map((c) => {
              if (c.g !== r.grup) return "";
              const v = r.respostes[c.p.id + (c.altre ? "_altre" : "")];
              return c.altre ? (v || "") : etiqueta(c.p, v);
            }),
          ]);
        }
        return respText(200, csv(files), "text/csv; charset=utf-8", `enquesta-respostes-${avui()}.csv`);
      }

      if (accio === "llista") {
        if (!Q.GRUPS_IDS.includes(q.grup)) return resp(400, { ok: false, error: "Grup desconegut" });
        const llista = await llegirDest(q.grup);
        const respostes = await E.clausRespostes();
        const files = [["email", "nom", "org", "idioma", "grup", "enquesta_link", "enviat", "respost"]].concat(
          llista.map((d) => [d.email, d.nom, d.org, d.idioma, q.grup, linkDe(d), d.enviat ? "si" : "", respostes.has(E.idResposta(d.token)) ? "si" : ""])
        );
        return respText(200, csv(files), "text/csv; charset=utf-8", `enquesta-${q.grup}-destinataris.csv`);
      }

      if (accio === "plantilla") {
        if (!Q.GRUPS_IDS.includes(q.grup)) return resp(400, { ok: false, error: "Grup desconegut" });
        const c = M.construirCorreu({ grup: q.grup, idioma: idioma(q.idioma), nom: "", linkRaw: "{$enquesta_link}" });
        return respText(200, c.html, "text/html; charset=utf-8", `enquesta-${q.grup}-${idioma(q.idioma)}.html`);
      }

      return resp(400, { ok: false, error: "Acció desconeguda" });
    }

    if (event.httpMethod === "POST") {
      let body;
      try { body = JSON.parse(event.body); } catch { return resp(400, { ok: false, error: "JSON invàlid" }); }

      if (body.accio === "preparar_inscripcions") {
        const r = await afegirDestinataris("participant", await destinatarisInscripcions());
        return resp(200, { ok: true, ...r });
      }

      if (body.accio === "preparar_llista") {
        if (!Q.GRUPS_IDS.includes(body.grup)) return resp(400, { ok: false, error: "Grup desconegut" });
        if (!Array.isArray(body.files) || !body.files.length) return resp(400, { ok: false, error: "Llista buida" });
        if (body.files.length > 1500) return resp(400, { ok: false, error: "Massa files d'un cop" });
        const r = await afegirDestinataris(body.grup, body.files);
        return resp(200, { ok: true, ...r });
      }

      if (body.accio === "esborrar_destinatari") {
        if (!Q.GRUPS_IDS.includes(body.grup)) return resp(400, { ok: false, error: "Grup desconegut" });
        const llista = await llegirDest(body.grup);
        await desarDest(body.grup, llista.filter((d) => d.h !== body.h));
        return resp(200, { ok: true });
      }

      if (body.accio === "prova") {
        if (!Q.GRUPS_IDS.includes(body.grup)) return resp(400, { ok: false, error: "Grup desconegut" });
        if (!emailOk(String(body.email || ""))) return resp(400, { ok: false, error: "Email no vàlid" });
        const id = idioma(body.idioma);
        const tk = E.nouToken();
        const nom = "Prova";
        await E.escriure("tok/" + tk, {
          grup: body.grup, nom, org: "Entitat de prova", idioma: id,
          modalitat: body.grup === "participant" ? "caminant" : "", tram: body.grup === "participant" ? "Prova → Prova" : "",
          creat: new Date().toISOString(), prova: true,
        });
        const c = M.construirCorreu({ grup: body.grup, idioma: id, nom, link: M.enllacPer(tk, id) });
        await enviarLot([{ email: body.email, nom: "", ...c }]);
        return resp(200, { ok: true });
      }

      if (body.accio === "enviar") {
        if (!Q.GRUPS_IDS.includes(body.grup)) return resp(400, { ok: false, error: "Grup desconegut" });
        const limit = Number(process.env.ENQUESTA_LIMIT_DIARI) || 90;
        const dia = (await E.llegir("dia/" + avui())) || { n: 0 };
        const queden = Math.max(0, limit - dia.n);
        const quant = Math.min(Number(body.quant) || 50, 100, queden);
        if (queden <= 0) return resp(200, { ok: true, enviats: 0, motiu: "limit_diari", enviats_avui: dia.n, limit_diari: limit });
        const llista = await llegirDest(body.grup);
        const respostes = await E.clausRespostes();
        const pendents = llista.filter((d) => !d.enviat && !d.baixa).slice(0, quant);
        if (!pendents.length) return resp(200, { ok: true, enviats: 0, motiu: "res_pendent", enviats_avui: dia.n, limit_diari: limit });
        const correus = pendents.map((d) => ({
          email: d.email, nom: d.nom,
          ...M.construirCorreu({ grup: body.grup, idioma: d.idioma, nom: (d.nom || "").split(" ")[0], link: linkDe(d) }),
        }));
        await enviarLot(correus);
        const ara = new Date().toISOString();
        const hs = new Set(pendents.map((d) => d.h));
        await desarDest(body.grup, llista.map((d) => (hs.has(d.h) ? { ...d, enviat: ara } : d)));
        await E.escriure("dia/" + avui(), { n: dia.n + pendents.length });
        return resp(200, { ok: true, enviats: pendents.length, enviats_avui: dia.n + pendents.length, limit_diari: limit });
      }

      return resp(400, { ok: false, error: "Acció desconeguda" });
    }

    return resp(405, { ok: false });
  } catch (e) {
    console.error("admin-enquestes:", e);
    return resp(500, { ok: false, error: String(e.message || e) });
  }
};
