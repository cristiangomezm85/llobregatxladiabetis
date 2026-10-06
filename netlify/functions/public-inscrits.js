// netlify/functions/public-inscrits.js
//
// GET /.netlify/functions/public-inscrits (o /api/public-inscrits)
//
// Endpoint PÚBLIC (sense token) per alimentar inscrits.html: llista
// estadístiques i un directori d'inscrits PAGATS, amb totes les dades
// personals sensibles retallades. NOMÉS torna:
//   - nom_public: nom + inicial del cognom ("Cristian G."), mai el cognom
//     complet, ni DNI, telèfon, email, contacte d'emergència, tutor, etc.
//   - club (nom del club, si en té)
//   - modalitat, tram_km, tram_inici/tram_final (ids + noms), tram_dies
//   - sexe i relació amb la diabetis (només per fer estadístiques
//     agregades a la pàgina -- mai es mostren lligades a un nom complet)
//
// Fa servir el mateix magatzem que admin-inscripcions.js (lib/store.js),
// però aquí NO cal cap token: només llegim, i només els camps de dalt.
//
// El Dorsal 0 (donació simbòlica, sense participació real) queda EXCLÒS:
// vegeu esDorsal0() més avall.

const { llistarOrdres } = require("./lib/store");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function status(o) {
  return String((o && o.estat) || "").trim().toLowerCase();
}

function paid(o) {
  return status(o) === "pagat";
}

// El Dorsal 0 és una donació simbòlica, no una inscripció real: qui el
// compra no participa físicament ni virtualment al repte. Es queda fora
// del directori/estadístiques d'inscrits.html perquè no és lògic comptar-lo
// com a "inscrit" (abans sí es comptava al total però no sempre tenia tots
// els camps d'estadístiques, cosa que feia que els gràfics no quadressin
// amb el total -- ara simplement no hi entra).
function esDorsal0(o) {
  const p = (o && o.payload && typeof o.payload === "object") ? o.payload : {};
  return String(o.modalitat || p.modalitat || "").trim().toLowerCase() === "dorsal0";
}

function nomPublic(nom, cognoms) {
  const n = String(nom || "").trim();
  const c = String(cognoms || "").trim();
  if (!n) return "—";
  const inicial = c ? c.charAt(0).toUpperCase() + "." : "";
  return inicial ? `${n} ${inicial}` : n;
}

// Llegir totes les comandes (una per una) és el que fa lenta aquesta
// pàgina. Guardem el resultat uns segons a la memòria de la funció, i el CDN
// de Netlify reutilitza la resposta (vegeu Cache-Control més avall): la
// majoria de visites ja no arriben a llegir res.
const TTL_MS = 60 * 1000;
let cache = { ts: 0, cos: null };

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Mètode no permès" }),
    };
  }

  try {
    if (cache.cos && Date.now() - cache.ts < TTL_MS) {
      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=600",
        },
        body: cache.cos,
      };
    }
    const ordres = await llistarOrdres();
    const pagats = ordres.filter(paid).filter((o) => !esDorsal0(o));

    const inscrits = pagats.map((o) => {
      const p = (o && o.payload && typeof o.payload === "object") ? o.payload : {};
      return {
        nom_public: nomPublic(p.nom, p.cognoms),
        club: (p.club_nom || "").trim() || null,
        modalitat: o.modalitat || p.modalitat || null,
        tram_km: typeof p.tram_km === "number" ? p.tram_km : null,
        tram_inici: p.tram_inici || null,
        tram_final: p.tram_final || null,
        tram_inici_nom: p.tram_inici_nom || null,
        tram_final_nom: p.tram_final_nom || null,
        tram_dies: Array.isArray(p.tram_dies) ? p.tram_dies : [],
        tram_tipus: p.tram_tipus || null,
        sexe: p.sexe || null,
        relacio: p.relacio || null,
      };
    });

    const cos = JSON.stringify({ ok: true, total: inscrits.length, inscrits, actualitzat: Date.now() });
    cache = { ts: Date.now(), cos };
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=600",
      },
      body: cos,
    };
  } catch (e) {
    console.error("Error a public-inscrits:", e);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: e.message || String(e) }),
    };
  }
};
