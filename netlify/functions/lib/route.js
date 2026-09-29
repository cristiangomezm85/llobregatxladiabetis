// lib/route.js
// Càlcul de trams i quilòmetres sobre el recorregut oficial. Es carrega
// pobles.json EN VIU des del lloc (SITE_URL/pobles.json) en lloc de
// mantenir-ne una còpia duplicada: així no hi ha risc que aquest backend
// quedi desincronitzat si algú actualitza els municipis des de l'admin.

const TRAM_TOTALS = { 1: 60.3, 2: 76.5, 3: 66.7 }; // ha de coincidir amb inscripcio.html

// Sumar/restar els km (decimals com 60.3, 76.5...) amb float de JS acumula
// error de precisió binària (p. ex. 66.7 - 53.5 dona 13.200000000000003 en
// lloc de 13.2). Els km del recorregut sempre tenen com a molt 1 decimal,
// així que arrodonim a 1 decimal després de cada operació -- és un
// arrodoniment sense pèrdua (el valor "real" ja només tenia 1 decimal) que
// només neteja el soroll de precisió, mai canvia el resultat matemàtic.
function arrodonirKm(km) {
  return Math.round(km * 10) / 10;
}

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

  return { kmTotal: arrodonirKm(kmTotal), dies, iniciNom: inici.nom, finalNom: final.nom };
}

module.exports = { TRAM_TOTALS, carregarPobles, trobarPoble, calcularTram, arrodonirKm };
