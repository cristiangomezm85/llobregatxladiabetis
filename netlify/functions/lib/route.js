// lib/route.js
// Càlcul de trams i quilòmetres sobre el recorregut oficial. Es carrega
// pobles.json EN VIU des del lloc (SITE_URL/pobles.json) en lloc de
// mantenir-ne una còpia duplicada: així no hi ha risc que aquest backend
// quedi desincronitzat si algú actualitza els municipis des de l'admin.

const TRAM_TOTALS = { 1: 62, 2: 75, 3: 69 }; // ha de coincidir amb inscripcio.html

let cachedPobles = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuts

async function carregarPobles() {
  const ara = Date.now();
  if (cachedPobles && ara - cachedAt < CACHE_TTL_MS) return cachedPobles;

  const siteUrl = process.env.SITE_URL || "https://llobregat.org";
  const res = await fetch(`${siteUrl}/pobles.json`);
  if (!res.ok) {
    throw new Error("No s'ha pogut carregar la llista de municipis del recorregut");
  }
  const data = await res.json();
  cachedPobles = data.pobles || [];
  cachedAt = ara;
  return cachedPobles;
}

async function trobarPoble(id) {
  const pobles = await carregarPobles();
  return pobles.find((p) => p.id === id) || null;
}

/**
 * Calcula el tram entre dos punts del recorregut. Retorna
 * { kmTotal, dies, iniciNom, finalNom } o llança un Error si el punt final
 * no és posterior al punt d'inici. `dies` és un array d'strings ("1","2","3").
 */
async function calcularTram(iniciId, finalId) {
  const inici = await trobarPoble(iniciId);
  const final = await trobarPoble(finalId);
  if (!inici) throw new Error(`Municipi d'inici desconegut: ${iniciId}`);
  if (!final) throw new Error(`Municipi final desconegut: ${finalId}`);

  const dIni = inici.dia;
  const dFi = final.dia;
  const kIni = inici.km;
  const kFi = final.km;

  if (dFi < dIni || (dFi === dIni && kFi <= kIni)) {
    throw new Error(
      `El municipi final (${final.nom}) ha de ser posterior al municipi d'inici (${inici.nom}) dins el recorregut`
    );
  }

  let kmTotal;
  const dies = [];
  if (dFi === dIni) {
    kmTotal = kFi - kIni;
    dies.push(String(dIni));
  } else {
    kmTotal = TRAM_TOTALS[dIni] - kIni;
    dies.push(String(dIni));
    for (let d = dIni + 1; d < dFi; d++) {
      kmTotal += TRAM_TOTALS[d];
      dies.push(String(d));
    }
    kmTotal += kFi;
    dies.push(String(dFi));
  }

  return { kmTotal, dies, iniciNom: inici.nom, finalNom: final.nom };
}

module.exports = { TRAM_TOTALS, carregarPobles, trobarPoble, calcularTram };
