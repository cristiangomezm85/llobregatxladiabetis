// netlify/functions/export-samarretes.js
//
// Endpoint de només lectura, protegit amb el mateix token que export-data.js
// (EXPORT_SECRET), per descarregar un Excel amb el recompte de samarretes a
// preparar: quantes de cada talla, ordenades de petita a gran, primer Home,
// després Dona i finalment Infantil.
// Ús: /.netlify/functions/export-samarretes?token=EL_TEU_TOKEN
//
// Només compta comandes PAGADES (mateix criteri que "Operativa" a
// admin/index.html): les pendents/incompletes no es tenen en compte perquè
// encara no és segur que arribin a fer-se realitat.

const ExcelJS = require("exceljs");
const { llistarOrdres } = require("./lib/store");
const { TALLES_ADULT, TALLES_INFANTIL } = require("./lib/pricing");

// Ordre de categories tal com es demana: Home, Dona, Infantil. Home i Dona
// fan servir el mateix conjunt de talles d'adult (TALLES_ADULT); Infantil
// té la seva pròpia llista (TALLES_INFANTIL). Totes dues llistes ja venen
// ordenades de petita a gran des de lib/pricing.js, font única de veritat
// per a les talles vàlides.
const CATEGORIES = [
  { prefix: "home-", nom: "Home", talles: TALLES_ADULT },
  { prefix: "dona-", nom: "Dona", talles: TALLES_ADULT },
  { prefix: "infantil-", nom: "Infantil", talles: TALLES_INFANTIL },
];

exports.handler = async (event) => {
  const secretConfigurat = (process.env.EXPORT_SECRET || "").trim();
  const tokenRebut = (event.queryStringParameters?.token || "").trim();

  if (!secretConfigurat) {
    return {
      statusCode: 500,
      body: "EXPORT_SECRET no configurat al servidor. Afegeix-lo a Netlify (Environment variables) i torna a desplegar.",
    };
  }
  if (tokenRebut !== secretConfigurat) {
    return { statusCode: 401, body: "Token incorrecte." };
  }

  let ordres;
  try {
    ordres = await llistarOrdres();
  } catch (err) {
    return {
      statusCode: 500,
      body: "Error accedint a l'emmagatzematge: " + (err && err.message ? err.message : String(err)),
    };
  }

  // Només comandes pagades -- mateix criteri "operatiu" que fa servir
  // l'admin per a qualsevol recompte de samarretes/recollides.
  const pagades = ordres.filter((o) => String(o?.estat || "").trim().toLowerCase() === "pagat");

  const recompte = {}; // talla (p.ex. "home-M") -> unitats
  for (const ordre of pagades) {
    for (const entry of samarretesDeComanda(ordre)) {
      recompte[entry.talla] = (recompte[entry.talla] || 0) + entry.quantitat;
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Repte Llobregat x la Diabetis";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Samarretes", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "Categoria", key: "categoria", width: 16 },
    { header: "Talla", key: "talla", width: 12 },
    { header: "Unitats", key: "unitats", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };

  let totalGeneral = 0;
  const tallesVistes = new Set();

  for (const categoria of CATEGORIES) {
    for (const talla of categoria.talles) {
      const codi = `${categoria.prefix}${talla}`;
      const unitats = recompte[codi] || 0;
      tallesVistes.add(codi);
      if (unitats === 0) continue; // no cal omplir l'Excel amb zeros
      sheet.addRow({ categoria: categoria.nom, talla, unitats });
      totalGeneral += unitats;
    }
  }

  // Qualsevol talla que no encaixi amb els prefixos coneguts (registres
  // antics, dades incompletes...) -- es mostra igualment perquè no
  // desaparegui cap samarreta del recompte, en un bloc "Altres" al final.
  const desconegudes = Object.keys(recompte).filter((k) => !tallesVistes.has(k));
  for (const codi of desconegudes.sort()) {
    const unitats = recompte[codi];
    if (!unitats) continue;
    sheet.addRow({ categoria: "Altres", talla: codi, unitats });
    totalGeneral += unitats;
  }

  const totalRow = sheet.addRow({ categoria: "", talla: "Total", unitats: totalGeneral });
  totalRow.font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.border = { top: { style: "thin" } };
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="samarretes.xlsx"',
    },
    body: Buffer.from(buffer).toString("base64"),
    isBase64Encoded: true,
  };
};

// Mateixa lògica que shirtEntries() a admin/index.html: primer mira
// payload.samarretes (el cas normal, tant per "animar" com per les
// modalitats físiques -- validarFisic ja hi desa una entrada amb la talla i
// el nombre de dies/etapes), i si no n'hi ha, cau a la compatibilitat amb
// registres antics (talla_samarreta + unitats/camisetes_total solts).
function samarretesDeComanda(ordre) {
  const payload = (ordre && ordre.payload) || {};
  const out = [];
  if (Array.isArray(payload.samarretes)) {
    for (const s of payload.samarretes) {
      const quantitat = Number(s && s.quantitat) || 0;
      if (quantitat > 0) {
        out.push({ talla: String((s && s.talla) || payload.talla_samarreta || ""), quantitat });
      }
    }
  }
  if (out.length === 0) {
    const quantitat = Number(ordre.camisetes_total || ordre.samarretes_total || ordre.unitats || 0);
    const talla = payload.talla_samarreta;
    if (quantitat > 0 && talla) out.push({ talla: String(talla), quantitat });
  }
  return out;
}
