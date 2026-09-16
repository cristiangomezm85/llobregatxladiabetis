// netlify/functions/admin-corregir-tram.js
//
// Endpoint d'administració per corregir manualment el municipi d'inici i/o
// final del tram (etapa) d'una comanda ja guardada al Blob "ordres",
// després que la persona afectada confirmi per email quin tram volia
// realment (modalitats físiques: caminant/corrent/bici).
//
// Motiu: admin-inscripcions.js (l'editor general de l'admin) bloqueja a
// propòsit els camps tram_inici/tram_final/tram_dies/tram_km perquè
// normalment determinen el preu ja cobrat -- no es poden tocar des d'allà
// sense arriscar-se a descol·locar un pagament. Aquest endpoint és la porta
// estreta i deliberada per al cas concret en què això NO passa: la persona
// es va equivocar de municipi d'inici/final però el tram correcte té el
// MATEIX NOMBRE DE DIES (etapes) que el que ja té guardat -- per tant el
// preu ja cobrat segueix sent correcte. Si el nombre de dies no coincideix,
// l'endpoint rebutja el canvi (per no acabar canviant preu sense voler);
// en aquest cas cal parlar amb la persona sobre un reemborsament/cobrament
// addicional en comptes de fer servir aquesta eina.
//
// Protegit amb el mateix ADMIN_TOKEN que la resta de l'admin (Site
// configuration > Environment variables), enviat com a capçalera
// "x-admin-token" -- igual que admin-corregir-talla.js.
//
// Crida per POST:
//
//   POST /.netlify/functions/admin-corregir-tram
//   Header: x-admin-token: <ADMIN_TOKEN>
//
//   Cos (una comanda):
//     { "orderId": "xxxxx-xxxx-...", "tramIniciNou": "berga", "tramFinalNou": "cal-rosal" }
//
//   Els valors de tramIniciNou/tramFinalNou són els "id" dels municipis tal
//   com apareixen a pobles.json (no el nom visible).
//
// Resposta: per cada comanda, l'estat abans i després -- guarda-la com a
// justificant del canvi (aquí no es crea cap registre d'auditoria propi).

const { obtenirOrdre, actualitzarOrdre } = require("./lib/store");
const { calcularTram } = require("./lib/route");

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
      resultats.push(await corregirTram(peticio));
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

async function corregirTram({ orderId, tramIniciNou, tramFinalNou }) {
  if (!orderId) throw new Error("Falta orderId");
  if (!tramIniciNou) throw new Error("Falta tramIniciNou");
  if (!tramFinalNou) throw new Error("Falta tramFinalNou");

  const ordre = await obtenirOrdre(orderId);
  if (!ordre) throw new Error(`Ordre ${orderId} no trobada`);

  const payloadActual = ordre.payload || {};
  if (!payloadActual.tram_inici || !payloadActual.tram_final || !Array.isArray(payloadActual.tram_dies)) {
    throw new Error(
      `La comanda ${orderId} no té un tram físic (caminant/corrent/bici) -- aquesta eina només serveix per a aquest tipus d'inscripció`
    );
  }

  const diesAbans = payloadActual.tram_dies.length;

  // calcularTram valida que els dos municipis existeixin i que el final
  // sigui posterior a l'inici dins el recorregut -- si no, ja llança un
  // error prou clar (es propaga tal qual a la resposta).
  const tramNou = await calcularTram(tramIniciNou, tramFinalNou);

  if (tramNou.dies.length !== diesAbans) {
    throw new Error(
      `El tram nou té ${tramNou.dies.length} dia(es) i l'actual en té ${diesAbans} -- ` +
      `això canviaria el preu ja cobrat, així que NO s'ha aplicat cap canvi. ` +
      `Si el tram correcte és realment d'un altre nombre de dies, cal gestionar-ho ` +
      `com un reemborsament o cobrament addicional en comptes de corregir-ho aquí.`
    );
  }

  const abans = {
    tram_inici: payloadActual.tram_inici,
    tram_final: payloadActual.tram_final,
    tram_inici_nom: payloadActual.tram_inici_nom,
    tram_final_nom: payloadActual.tram_final_nom,
    tram_dies: payloadActual.tram_dies,
    tram_km: payloadActual.tram_km,
  };

  const payloadNou = {
    ...payloadActual,
    tram_inici: tramIniciNou,
    tram_final: tramFinalNou,
    tram_inici_nom: tramNou.iniciNom,
    tram_final_nom: tramNou.finalNom,
    tram_dies: tramNou.dies,
    tram_km: payloadActual.tram_tipus === "cloenda" ? tramNou.kmTotal * 2 : tramNou.kmTotal,
  };

  // Les samarretes d'un tram físic són sempre "1 per dia" (veure
  // validarFisic a lib/pricing.js) -- com el nombre de dies no canvia,
  // aquest recompte tampoc hauria de canviar, però el regenerem igualment
  // per deixar-lo consistent amb tram_dies si mai s'havia desincronitzat.
  if (Array.isArray(payloadActual.samarretes) && payloadActual.samarretes[0]) {
    payloadNou.samarretes = payloadActual.samarretes.map((s, i) =>
      i === 0 ? { ...s, quantitat: tramNou.dies.length } : s
    );
  }

  const actualitzat = await actualitzarOrdre(orderId, { payload: payloadNou });

  return {
    ok: true,
    orderId,
    abans,
    despres: {
      tram_inici: actualitzat.payload.tram_inici,
      tram_final: actualitzat.payload.tram_final,
      tram_inici_nom: actualitzat.payload.tram_inici_nom,
      tram_final_nom: actualitzat.payload.tram_final_nom,
      tram_dies: actualitzat.payload.tram_dies,
      tram_km: actualitzat.payload.tram_km,
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
