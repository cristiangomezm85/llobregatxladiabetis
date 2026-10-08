// lib/samarretes.js
//
// UNA SOLA font de veritat per saber quines samarretes té una comanda. La fan
// servir l'entrega (perfil, escàner dels voluntaris, correu del QR, panell) i
// ha de coincidir amb el recompte de l'admin i l'Excel.
//
//  1. Cas normal: payload.samarretes = [{talla, quantitat}].
//  2. Comandes antigues (anteriors a payload.samarretes): talla_samarreta +
//     unitats (o camisetes_total / samarretes_total) soltes.
//  3. Si una mateixa talla surt repetida, se sumen (una sola fila per talla).
function samarretesDeComanda(ordre) {
  const o = ordre || {};
  const p = o.payload || {};
  const perTalla = new Map();
  const afegeix = (talla, q) => {
    const t = String(talla || "").trim();
    const n = Math.floor(Number(q) || 0);
    if (!t || n <= 0) return;
    perTalla.set(t, (perTalla.get(t) || 0) + n);
  };
  if (Array.isArray(p.samarretes)) {
    p.samarretes.forEach((s) => afegeix((s && s.talla) || p.talla_samarreta, s && s.quantitat));
  }
  if (perTalla.size === 0) {
    afegeix(p.talla_samarreta || o.talla_samarreta, o.camisetes_total || o.samarretes_total || o.unitats || p.unitats);
  }
  return Array.from(perTalla, ([talla, quantitat]) => ({ talla, quantitat }));
}

module.exports = { samarretesDeComanda };
