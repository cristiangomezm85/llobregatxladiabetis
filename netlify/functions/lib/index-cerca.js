// lib/index-cerca.js
//
// Índex de cerca per al buscador manual dels voluntaris. En lloc de llegir
// les ~700 comandes a cada cerca (lent, i amb molts voluntaris alhora
// saturaria), es guarda UN sol blob amb el mínim necessari i es llegeix amb
// una sola petició (+ caché en memòria d'1 minut).
//
// No es guarda el DNI sencer: només els 4 últims caràcters i un hash
// (SHA-256) del DNI complet per poder-lo cercar sencer.

const crypto = require("crypto");
const { llistarOrdres } = require("./store");
const E = require("./entregues");
const { normalitzar } = require("./punts");

const TTL_MEM_MS = 60 * 1000;
const EDAT_MAX_RECONSTRUIR_MS = 5 * 60 * 1000;
let mem = { ts: 0, ix: null };
let construint = null; // evita reconstruccions simultànies dins la mateixa instància

function hashDni(d) { return crypto.createHash("sha256").update(d).digest("hex").slice(0, 24); }
function netDni(s) { return String(s || "").replace(/[^a-z0-9]/gi, "").toUpperCase(); }

async function construir() {
  const ordres = await llistarOrdres();
  const files = ordres.filter(E.estaPagada).filter((o) => E.elementsComanda(o).res).map((o) => {
    const p = o.payload || {};
    const dni = netDni(p.dni);
    return {
      id: o.order_id, nom: p.nom || "", cognoms: p.cognoms || "", modalitat: o.modalitat,
      nomN: normalitzar(`${p.nom || ""} ${p.cognoms || ""}`),
      email: String(o.email_contacte || p.email_contacte || "").trim().toLowerCase(),
      dni4: dni.slice(-4), dniH: dni ? hashDni(dni) : "",
    };
  });
  const ix = { ts: Date.now(), files };
  await E.desarIndex(ix);
  mem = { ts: Date.now(), ix };
  return ix;
}

function reconstruir() {
  if (!construint) construint = construir().finally(() => { construint = null; });
  return construint;
}

async function obtenir() {
  if (mem.ix && Date.now() - mem.ts < TTL_MEM_MS) return mem.ix;
  let ix = await E.llegirIndex();
  if (!ix) ix = await reconstruir();
  else mem = { ts: Date.now(), ix };
  return ix;
}

function filtrar(ix, q) {
  const qn = normalitzar(q);
  const qd = netDni(q);
  const toks = qn.split(" ").filter(Boolean);
  const ql = q.trim().toLowerCase();
  if (q.includes("@")) return ix.files.filter((f) => f.email.includes(ql));
  if (/\d/.test(q) && qd.length >= 4) {
    if (qd.length === 4) return ix.files.filter((f) => f.dni4 === qd);
    if (qd.length >= 8) { const h = hashDni(qd); return ix.files.filter((f) => f.dniH === h); }
    return []; // 5–7 caràcters: ni 4 últims ni DNI complet
  }
  return ix.files.filter((f) => toks.every((t) => f.nomN.includes(t)));
}

async function cercar(q) {
  let ix = await obtenir();
  let r = filtrar(ix, q);
  // Sense resultats i índex antic: potser s'ha inscrit algú fa poc. Es
  // reconstrueix com a màxim un cop cada 5 minuts.
  if (!r.length && Date.now() - ix.ts > EDAT_MAX_RECONSTRUIR_MS) {
    try { ix = await reconstruir(); r = filtrar(ix, q); } catch (e) { console.error("[index-cerca] reconstrucció:", e); }
  }
  return r;
}

module.exports = { cercar, reconstruir };
