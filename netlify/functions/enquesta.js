// netlify/functions/enquesta.js
//
// API pública de l'enquesta de valoració (només per a enquesta.html).
//
//   GET  /api/enquesta?def=1        -> definició (grups, seccions, preguntes)
//   GET  /api/enquesta?t=<token>    -> perfil de qui ve d'un enllaç de correu
//                                      (grup, nom, org, modalitat, tram, idioma)
//                                      sense mai tornar l'email
//   POST /api/enquesta              -> desa una resposta
//        { t?, grup?, idioma, perfil:{nom,org,modalitat,tram}, respostes:{…},
//          contacte_email?, hp, ms }
//
// Si hi ha token vàlid, el grup i el perfil surten del token (no del client).
// Tornar a enviar l'enquesta amb el mateix token SOBREESCRIU la resposta
// anterior (una per persona). Sense token es desa com a resposta anònima.

const crypto = require("crypto");
const E = require("./lib/enquesta-store");
const Q = require("./lib/enquesta-preguntes");

const LLETRA_MAX = 2000;
const IDIOMES = ["ca", "es", "en"];

function resp(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}

const neteja = (s, max = LLETRA_MAX) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);

// Valida la resposta d'UNA pregunta; retorna { ok, valor, extra } on extra és
// el text d'"Altres" (només per multi/unica amb altre:true).
function validarResposta(p, brut, errors) {
  if (brut === undefined || brut === null || brut === "" || (Array.isArray(brut) && !brut.length)) return undefined;
  switch (p.tipus) {
    case "estrelles": {
      if (brut === "na" && p.na) return "na";
      const n = Number(brut);
      if (Number.isInteger(n) && n >= 1 && n <= 5) return n;
      errors.push(p.id);
      return undefined;
    }
    case "nps": {
      const n = Number(brut);
      if (Number.isInteger(n) && n >= 0 && n <= 10) return n;
      errors.push(p.id);
      return undefined;
    }
    case "unica": {
      const v = String(brut);
      if ((p.opcions || []).some((o) => o.v === v)) return v;
      errors.push(p.id);
      return undefined;
    }
    case "multi": {
      const arr = (Array.isArray(brut) ? brut : [brut]).map(String);
      const valids = new Set((p.opcions || []).map((o) => o.v));
      const net = [...new Set(arr.filter((v) => valids.has(v)))];
      if (net.length !== arr.length) errors.push(p.id);
      return net.length ? net : undefined;
    }
    case "text": {
      const t = neteja(brut);
      return t || undefined;
    }
    default:
      return undefined;
  }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "GET") {
      const q = event.queryStringParameters || {};
      if (q.def) return resp(200, { ok: true, definicio: Q.definicio() });
      if (q.t) {
        if (!E.tokenValid(q.t)) return resp(200, { ok: false, motiu: "token" });
        const tok = await E.llegir("tok/" + q.t);
        if (!tok) return resp(200, { ok: false, motiu: "token" });
        const jaRespost = !!(await E.llegir("resp/" + E.idResposta(q.t)));
        return resp(200, {
          ok: true,
          grup: tok.grup,
          idioma: tok.idioma || "ca",
          nom: tok.nom || "",
          org: tok.org || "",
          modalitat: tok.modalitat || "",
          tram: tok.tram || "",
          ja_respost: jaRespost,
        });
      }
      return resp(400, { ok: false, error: "Falta paràmetre" });
    }

    if (event.httpMethod !== "POST") return resp(405, { ok: false });
    if ((event.body || "").length > 60000) return resp(413, { ok: false, error: "Massa gran" });

    let body;
    try { body = JSON.parse(event.body); } catch { return resp(400, { ok: false, error: "JSON invàlid" }); }

    // Antibots: camp amagat que ha de ser buit i temps mínim (1,5 s) a la pàgina.
    if (body.hp) return resp(200, { ok: true });
    if (typeof body.ms === "number" && body.ms < 1500) return resp(200, { ok: true });

    let grup = String(body.grup || "");
    let perfil = {};
    let idResp;
    let amb_token = false;
    let idioma = IDIOMES.includes(body.idioma) ? body.idioma : "ca";

    if (body.t) {
      if (!E.tokenValid(body.t)) return resp(400, { ok: false, error: "Enllaç no vàlid" });
      const tok = await E.llegir("tok/" + body.t);
      if (!tok) return resp(400, { ok: false, error: "Enllaç no vàlid" });
      grup = tok.grup;
      perfil = { nom: tok.nom || "", org: tok.org || "", modalitat: tok.modalitat || "", tram: tok.tram || "" };
      idResp = E.idResposta(body.t);
      amb_token = true;
    } else {
      if (!Q.GRUPS_IDS.includes(grup)) return resp(400, { ok: false, error: "Falta indicar qui ets" });
      const p = body.perfil || {};
      perfil = { nom: neteja(p.nom, 120), org: neteja(p.org, 160), modalitat: "", tram: neteja(p.tram, 200) };
      const mod = Q.PERFIL.find((x) => x.id === "modalitat");
      if (grup === "participant" && mod.opcions.some((o) => o.v === p.modalitat)) perfil.modalitat = p.modalitat;
      idResp = "anon-" + crypto.randomBytes(7).toString("hex");
    }

    const preguntes = Q.preguntesDelGrup(grup);
    const errors = [];
    const input = body.respostes && typeof body.respostes === "object" ? body.respostes : {};
    const respostes = {};
    for (const p of preguntes) {
      const v = validarResposta(p, input[p.id], errors);
      if (v !== undefined) respostes[p.id] = v;
      if (p.altre) {
        const alt = neteja(input[p.id + "_altre"], 300);
        if (alt) respostes[p.id + "_altre"] = alt;
      }
    }
    const faltes = preguntes.filter((p) => p.req && respostes[p.id] === undefined).map((p) => p.id);
    if (faltes.length) return resp(400, { ok: false, error: "Falten respostes obligatòries", faltes });
    if (errors.length) return resp(400, { ok: false, error: "Respostes no vàlides", errors });

    let contacteEmail = "";
    if (respostes.contactar === "si" && !amb_token) {
      const e = neteja(body.contacte_email, 200);
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) contacteEmail = e;
    }

    const anterior = await E.llegir("resp/" + idResp);
    const ara = new Date().toISOString();
    await E.escriure("resp/" + idResp, {
      id: idResp,
      grup,
      idioma,
      amb_token,
      perfil,
      respostes,
      contacte_email: contacteEmail || undefined,
      data: anterior ? anterior.data : ara,
      actualitzada: anterior ? ara : undefined,
    });
    return resp(200, { ok: true, actualitzada: !!anterior });
  } catch (e) {
    console.error("enquesta:", e);
    return resp(500, { ok: false, error: "Error del servidor" });
  }
};
