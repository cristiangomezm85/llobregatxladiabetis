// netlify/functions/admin-corregir-talla.js
//
// Endpoint d'administració per corregir manualment la talla/categoria de
// samarreta d'una comanda ja guardada al Blob "ordres", després que la
// persona afectada confirmi per email quina volia realment.
//
// Motiu: el desplegable de talla del formulari (inscripcio.html) tenia el
// mateix text visible ("XS", "M", "XL"...) repetit idèntic als grups Home i
// Dona -- només el value ocult portava el prefix. Això va fer que algunes
// comandes es guardessin amb la categoria equivocada (sempre cap a "Home",
// el primer grup) encara que la persona triés "Dona". Ja està arreglat al
// formulari (veure opcionsTallaHTML a inscripcio.html), però les comandes
// fetes abans de l'arreglo han de corregir-se a mà, una a una, després de
// confirmar amb cada persona quina talla volia de veritat.
//
// Protegit amb un token (variable d'entorn ADMIN_TOKEN -- afegeix-la a Site
// configuration > Environment variables abans de fer servir això; si ja
// tens un token d'admin per a export-data.js, pots reutilitzar el mateix
// nom de variable aquí sota en comptes de crear-ne un de nou).
//
// Crida per POST:
//
//   POST /.netlify/functions/admin-corregir-talla
//   Header: x-admin-token: <ADMIN_TOKEN>
//
//   Cos (una comanda, modalitat física -- un sol camp talla_samarreta):
//     { "orderId": "xxxxx-xxxx-...", "tallaNova": "dona-XL" }
//
//   Cos (una samarreta concreta d'una comanda "animar" amb diverses,
//        samarretaIndex és la posició dins l'array "samarretes", 0 = primera):
//     { "orderId": "xxxxx-xxxx-...", "tallaNova": "dona-XL", "samarretaIndex": 1 }
//
//   Cos (varies comandes d'una tirada, per exemple les 5 de "dona"):
//     [
//       { "orderId": "...", "tallaNova": "dona-XL" },
//       { "orderId": "...", "tallaNova": "dona-M" }
//     ]
//
// Resposta: per cada comanda, l'estat abans i després -- guarda-la com a
// justificant del canvi (aquí no es crea cap registre d'auditoria propi).

const { obtenirOrdre, actualitzarOrdre } = require("./lib/store");
const { TALLES_VALIDES } = require("./lib/pricing");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return resposta(405, { error: "Mètode no permès" });
  }

  const token =
    event.headers["x-admin-token"] || event.headers["X-Admin-Token"] || "";
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return resposta(401, { error: "Token invàlid o absent (capçalera x-admin-token)" });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return resposta(400, { error: "JSON invàlid" });
  }

  const peticions = Array.isArray(body) ? body : [body];
  if (peticions.length === 0) {
    return resposta(400, { error: "Cap comanda a corregir" });
  }

  const resultats = [];
  for (const peticio of peticions) {
    try {
      resultats.push(await corregirTalla(peticio));
    } catch (e) {
      resultats.push({
        ok: false,
        orderId: peticio && peticio.orderId,
        error: e.message,
      });
    }
  }

  const totOk = resultats.every((r) => r.ok);
  return resposta(totOk ? 200 : 207, { resultats });
};

async function corregirTalla({ orderId, tallaNova, samarretaIndex }) {
  if (!orderId) throw new Error("Falta orderId");
  if (!tallaNova) throw new Error("Falta tallaNova");
  if (!TALLES_VALIDES.includes(tallaNova)) {
    throw new Error(
      `Talla no vàlida: "${tallaNova}". Valors possibles: ${TALLES_VALIDES.join(", ")}`
    );
  }

  const ordre = await obtenirOrdre(orderId);
  if (!ordre) throw new Error(`Ordre ${orderId} no trobada`);

  const payloadActual = ordre.payload || {};
  const payloadNou = { ...payloadActual };

  const abans = {
    talla_samarreta: payloadActual.talla_samarreta,
    samarretes: payloadActual.samarretes,
  };

  if (payloadActual.talla_samarreta === undefined && !Array.isArray(payloadActual.samarretes)) {
    throw new Error(`La comanda ${orderId} no té cap camp de talla de samarreta`);
  }

  // Modalitats físiques (caminant/corrent/bici): un sol camp talla_samarreta.
  if (payloadActual.talla_samarreta !== undefined) {
    payloadNou.talla_samarreta = tallaNova;
  }

  // pricing.js sempre deixa un array "samarretes" (tant a "animar" com a les
  // modalitats físiques, on en té una sola entrada) -- l'actualitzem també
  // perquè no torni a quedar desincronitzat amb talla_samarreta.
  if (Array.isArray(payloadActual.samarretes)) {
    const idx = samarretaIndex != null ? samarretaIndex : 0;
    if (!payloadActual.samarretes[idx]) {
      throw new Error(
        `La comanda ${orderId} no té cap samarreta a l'índex ${idx} (en té ${payloadActual.samarretes.length})`
      );
    }
    payloadNou.samarretes = payloadActual.samarretes.map((s, i) =>
      i === idx ? { ...s, talla: tallaNova } : s
    );
  }

  const actualitzat = await actualitzarOrdre(orderId, { payload: payloadNou });

  return {
    ok: true,
    orderId,
    abans,
    despres: {
      talla_samarreta: actualitzat.payload.talla_samarreta,
      samarretes: actualitzat.payload.samarretes,
    },
  };
}

function resposta(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body, null, 2),
  };
}
