// scripts/fetch-donaciones.mjs
//
// Genera dona/donaciones.json con las donaciones INDIVIDUALES de cada reto
// de Mi Grano de Arena (nombre, comentario, importe, fecha, reto) para la
// página /botella ("la botella de la esperanza").
//
// MGA no tiene API pública: igual que scripts/fetch-retos.mjs, esto hace
// scraping. Lee dona/retos.json (que mantiene fetch-retos.mjs) para saber
// qué retos hay, y visita la página de cada uno.
//
// ⚠️ La extracción (función extraerDonaciones) está escrita SIN haber visto
// el HTML real de la lista de donaciones de MGA. Antes de fiarse del
// resultado hay que ejecutar con --dump y ajustar SELECTORES (ver abajo):
//
//   node scripts/fetch-donaciones.mjs --dump
//
// Imprime, para el primer reto con dinero recaudado, el HTML que rodea a la
// lista de donaciones. Con eso se ajustan los selectores en 5 minutos.
//
// Garantías de seguridad:
//  - Si no se reconoce NINGUNA donación pero hay retos con dinero, el
//    script falla (exit 1) y NO toca donaciones.json.
//  - Nunca borra donaciones ya guardadas; solo añade las nuevas.
//
// ORDEN: cada donación tiene "orden" (1 = la primera que llegó). MGA lista
// la más reciente primero; las nuevas se numeran de la más antigua a la más
// nueva, para que la botella se llene en el orden real de llegada.

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';

const RETOS_PATH = new URL('../dona/retos.json', import.meta.url);
const OUT_PATH = new URL('../dona/donaciones.json', import.meta.url);
const DUMP = process.argv.includes('--dump');
const MAX_PAGES_POR_RETO = 20;
const PAUSA_MS = 400; // cortesía con el servidor

// ---------------------------------------------------------------------
// SELECTORES — AJUSTAR tras ver el HTML real (--dump).
// Cada uno puede ser una lista de alternativas separadas por coma.
// ---------------------------------------------------------------------
const SELECTORES = {
  item:    '.donation, .donor, .donacion, [class*="donation"] li, [class*="donor"] li, [class*="donacion"] li',
  nombre:  '.name, .donor-name, [class*="name"]',
  mensaje: '.message, .comment, .donor-message, [class*="message"], [class*="comment"]',
  importe: '.amount, [class*="amount"], [class*="importe"]',
  fecha:   'time, .date, [class*="date"], [class*="fecha"]',
  anonimo: /an[oòó]nim|anonym/i,
};

async function main() {
  const retosJson = JSON.parse(await readFile(RETOS_PATH, 'utf8'));
  let previo = { donaciones: [] };
  try { previo = JSON.parse(await readFile(OUT_PATH, 'utf8')); } catch {}
  const vistos = new Map(previo.donaciones.map(d => [d.id, d]));
  let maxOrden = previo.donaciones.reduce((m, d) => Math.max(m, d.orden || 0), 0);

  const nuevas = [];
  let retosConDinero = 0;
  let donacionesReconocidas = 0;

  for (const reto of retosJson.retos) {
    if (!(reto.recaudado > 0)) continue;
    retosConDinero++;
    const base = typeof reto.url === 'string' ? reto.url : reto.url?.es;
    if (!base) continue;

    const delReto = [];
    for (let page = 1; page <= MAX_PAGES_POR_RETO; page++) {
      const url = page === 1 ? base : `${base}${base.includes('?') ? '&' : '?'}page=${page}`;
      const html = await fetchText(url);
      if (DUMP && retosConDinero === 1 && page === 1) volcar(reto.slug, html);
      const items = extraerDonaciones(html);
      if (!items.length) break;
      // Si la página 2 repite la 1 (MGA ignora ?page), paramos.
      const firma = items.map(i => i.mensaje + i.nombre + i.importe).join('|');
      if (delReto._ultimaFirma === firma) break;
      delReto._ultimaFirma = firma;
      delReto.push(...items);
      await pausa();
    }
    donacionesReconocidas += delReto.length;

    // Identificador estable (con contador para donaciones idénticas).
    const contador = new Map();
    for (const it of delReto) {
      const clave = [reto.slug, it.nombre, it.importe, it.mensaje, it.fechaTexto].join('|');
      const n = (contador.get(clave) || 0) + 1; contador.set(clave, n);
      it.id = createHash('sha1').update(clave + '#' + n).digest('hex').slice(0, 12);
      it.reto = reto.slug; it.retoNombre = reto.nombre;
    }
    // delReto viene "más reciente primero" -> la damos la vuelta (antigua primero).
    for (const it of delReto.slice().reverse()) {
      if (!vistos.has(it.id)) nuevas.push(it);
    }
  }

  if (DUMP) { console.log('\nReconocidas:', donacionesReconocidas); return; }

  if (retosConDinero > 0 && donacionesReconocidas === 0) {
    console.error('❌ Hay retos con dinero pero no se reconoció ninguna donación. Revisa SELECTORES (node scripts/fetch-donaciones.mjs --dump). No se modifica donaciones.json.');
    process.exit(1);
  }

  // Entre retos distintos: por fecha si la hay, si no se mantiene el orden de recogida.
  nuevas.sort((a, b) => (a.fecha && b.fecha) ? a.fecha.localeCompare(b.fecha) : 0);
  for (const it of nuevas) { it.orden = ++maxOrden; vistos.set(it.id, limpiar(it)); }

  const donaciones = [...vistos.values()].sort((a, b) => a.orden - b.orden);
  const salida = {
    objectiuGotes: previo.objectiuGotes || 250,
    actualizado: new Date().toISOString(),
    total: donaciones.length,
    donaciones
  };
  await writeFile(OUT_PATH, JSON.stringify(salida, null, 2) + '\n', 'utf8');
  console.log(`✅ donaciones.json — ${donaciones.length} donaciones (${nuevas.length} nuevas)`);
}

function extraerDonaciones(html) {
  const $ = cheerio.load(html);
  const out = [];
  $(SELECTORES.item).each((_, el) => {
    const $el = $(el);
    const txt = (sel) => $el.find(sel).first().text().replace(/\s+/g, ' ').trim();
    const importeTxt = txt(SELECTORES.importe) || ($el.text().match(/([\d.,]+)\s*€/) || [])[1] || '';
    const nombre = txt(SELECTORES.nombre);
    const mensaje = txt(SELECTORES.mensaje);
    if (!importeTxt && !nombre && !mensaje) return;
    const t = $el.find(SELECTORES.fecha).first();
    const fechaTexto = (t.attr('datetime') || t.text() || '').replace(/\s+/g, ' ').trim();
    const fecha = fechaTexto && !isNaN(Date.parse(fechaTexto)) ? new Date(fechaTexto).toISOString() : null;
    out.push({
      nombre: nombre || null,
      anonimo: !nombre || SELECTORES.anonimo.test(nombre),
      importe: parseImporte(importeTxt),
      mensaje,
      fecha, fechaTexto
    });
  });
  return out;
}

function limpiar(it) {
  // fechaTexto solo sirve para generar el id; no se publica.
  const { fechaTexto, ...resto } = it;
  return resto;
}

function volcar(slug, html) {
  const $ = cheerio.load(html);
  console.log(`\n===== DUMP ${slug} =====`);
  const candidatos = $('*').filter((_, el) => /don(ac|or)|donat/i.test($(el).attr('class') || '') || /don(ac|or)|donat/i.test($(el).attr('id') || ''));
  console.log('Elementos con "donac/donor/donat" en class/id:', candidatos.length);
  candidatos.slice(0, 6).each((_, el) => console.log('\n---', el.tagName, $(el).attr('class') || '', '\n' + $.html(el).slice(0, 1500)));
  console.log('\nTrozos con "€":');
  $('*:contains("€")').filter((_, el) => $(el).children().length === 0).slice(0, 8).each((_, el) => console.log(' ', $(el).parent().html()?.slice(0, 300)));
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LlobregatDonaBot/1.0)' } });
  if (!res.ok) throw new Error(`No se pudo descargar ${url} (HTTP ${res.status})`);
  return res.text();
}
const pausa = () => new Promise(r => setTimeout(r, PAUSA_MS));
function parseImporte(s) {
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
