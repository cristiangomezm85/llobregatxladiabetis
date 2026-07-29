// lib/pickup.js
// Llista de punts de recollida de samarreta. Ha de coincidir exactament
// (mateix ordre) amb la llista PICKUP_POINTS del formulari inscripcio.html,
// perquè el frontend envia només l'índex (recollida_idx).

const DIA_LABELS = { fri: "Div.", thu: "Dij." };

const PICKUP_POINTS = [
  { store: "Decathlon Puigcerdà", day: "fri", date: "9/10" },
  { store: "Decathlon Puigcerdà", day: "thu", date: "15/10" },
  { store: "Decathlon Manresa", day: "fri", date: "9/10" },
  { store: "Decathlon Manresa", day: "thu", date: "15/10" },
  { store: "Decathlon Sant Boi", day: "fri", date: "9/10" },
  { store: "Decathlon Sant Boi", day: "thu", date: "15/10" },
  { store: "Decathlon L'Illa Diagonal", day: "fri", date: "9/10" },
  { store: "Decathlon L'Illa Diagonal", day: "thu", date: "15/10" },
];

function etiquetaPickup(p) {
  return `${p.store} ${DIA_LABELS[p.day]} ${p.date}`;
}

function textPerIdx(idx) {
  const p = PICKUP_POINTS[Number(idx)];
  return p ? etiquetaPickup(p) : "";
}

module.exports = { PICKUP_POINTS, etiquetaPickup, textPerIdx };
