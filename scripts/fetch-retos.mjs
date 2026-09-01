// scripts/fetch-retos.mjs
//
// Actualiza dona/retos.json leyendo los retos del evento en Mi Grano de
// Arena. MGA no tiene API pública, así que esto hace "screen scraping".
//
// La página del evento (una sola petición GET) solo trae renderizados en
// el HTML los retos de la PRIMERA página del listado — el resto de
// páginas las carga el navegador por JS al hacer clic en el paginador,
// contra un endpoint interno:
//
//   GET /searcheventcauses?event=<uuid-del-evento>&page=<n>
//   -> { "count": <total de retos>, "html": "<fragmento con las cards>" }
//
// Así que replicamos eso: sacamos el uuid del evento del propio HTML de
// la página (aparece en la URL de la imagen de cabecera,
// /uploads/event/<uuid>/...), y vamos pidiendo página a página ese
// endpoint hasta reunir "count" retos.
//
// Pensado para ejecutarse vía GitHub Actions (ver
// .github/workflows/actualizar-retos.yml) — gratis, sin depender de
// Netlify Functions. Cada ejecución hace commit del JSON actualizado, lo
// que dispara automáticamente un nuevo deploy en Netlify.
//
// Nunca sobreescribe "tipo", "foto" ni "nombre" de un reto ya existente
// — esos los decides tú a mano en dona/retos.json, porque MGA no los
// expone. Tampoco reordena ni elimina retos ya existentes: solo
// actualiza su "recaudado"/"diasRestantes" (y la parte "es" de su url,
// por si MGA cambia el slug), y añade al FINAL, con tipo:"pendiente" y
// foto:null, cualquier reto nuevo que no reconozca — para que lo
// completes a mano.

import { readFile, writeFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';

const JSON_PATH = new URL('../dona/retos.json', import.meta.url);
const MAX_PAGES = 15; // salvaguarda por si "count" viniera mal

async function main() {
  const current = JSON.parse(await readFile(JSON_PATH, 'utf8'));
  const eventoUrl = current.eventoUrl;

  console.log(`Descargando ${eventoUrl} ...`);
  const eventHtml = await fetchText(eventoUrl);

  // --- Total del evento ---------------------------------------------
  const $event = cheerio.load(eventHtml);
  const bodyText = $event('body').text().replace(/\s+/g, ' ');
  const totalMatch = bodyText.match(/Total recaudado\s*:?\s*([\d.,]+)\s*€/i);
  const totalRecaudado = totalMatch
    ? parseImporte(totalMatch[1])
    : current.totalRecaudado;

  // --- UUID del evento (para poder paginar el listado de retos) ------
  const uuidMatch = eventHtml.match(
    /\/uploads\/event\/([0-9a-f-]{36})\//i
  );
  if (!uuidMatch) {
    throw new Error(
      'No se pudo encontrar el UUID del evento en la página (¿cambió el HTML de MGA?)'
    );
  }
  const eventUuid = uuidMatch[1];

  // --- Recorremos TODAS las páginas del listado de retos --------------
  const scrapedBySlug = new Map();
  let page = 1;
  let expectedCount = null;
  while (page <= MAX_PAGES) {
    const searchUrl = `https://www.migranodearena.org/searcheventcauses?event=${eventUuid}&page=${page}`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LlobregatDonaBot/1.0)' }
    });
    if (!res.ok) {
      throw new Error(`No se pudo descargar la página ${page} de retos (HTTP ${res.status})`);
    }
    const data = await res.json();
    expectedCount = data.count ?? expectedCount;

    const found = extractCausesFromHtml(data.html, eventoUrl);
    if (found.size === 0) break; // no hay más páginas
    for (const [slug, info] of found) scrapedBySlug.set(slug, info);

    console.log(`  página ${page}: +${found.size} retos (acumulado ${scrapedBySlug.size}/${expectedCount ?? '?'})`);

    if (expectedCount != null && scrapedBySlug.size >= expectedCount) break;
    page++;
  }

  if (expectedCount != null && scrapedBySlug.size < expectedCount) {
    console.warn(
      `⚠️  Se esperaban ${expectedCount} retos pero solo se recogieron ${scrapedBySlug.size} — revisa el paginador de MGA.`
    );
  }

  // --- Fusionamos con lo que ya teníamos, SIN perder nada -------------
  // Cada reto existente se busca por el slug de su propia url (o su
  // "slug" interno si la url no tiene uno reconocible) para que
  // coincida aunque el "slug" interno no sea idéntico al de MGA (p.ej.
  // "pksteam-x-la-diabetes" en el json vs "pk-s-team-x-la-diabetes" en
  // MGA).
  const consumed = new Set();
  const retos = current.retos.map(reto => {
    const mgaSlug = extractSlugFromUrl(reto.url) || reto.slug;
    const scraped = scrapedBySlug.get(mgaSlug);
    if (!scraped) return reto; // no lo hemos visto en este scrape: se deja tal cual

    consumed.add(mgaSlug);
    return {
      ...reto,
      url: mergeUrl(reto.url, scraped.url),
      recaudado: scraped.recaudado ?? reto.recaudado,
      diasRestantes: scraped.diasRestantes ?? reto.diasRestantes
    };
  });

  // Retos nuevos que no reconocemos todavía: se añaden al final.
  for (const [slug, scraped] of scrapedBySlug) {
    if (consumed.has(slug)) continue;
    console.warn(`⚠️  Reto nuevo sin clasificar: "${scraped.nombre}" (${slug}) — añádele "tipo" y "foto" en dona/retos.json`);
    retos.push({
      slug,
      nombre: scraped.nombre,
      tipo: 'pendiente',
      foto: null,
      url: scraped.url,
      recaudado: scraped.recaudado ?? 0,
      diasRestantes: scraped.diasRestantes ?? null
    });
  }

  const updated = {
    ...current,
    totalRecaudado,
    actualizado: new Date().toISOString(),
    retos
  };

  await writeFile(JSON_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  console.log(`✅ retos.json actualizado — ${retos.length} retos, total ${totalRecaudado}€`);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LlobregatDonaBot/1.0)' }
  });
  if (!res.ok) throw new Error(`No se pudo descargar ${url} (HTTP ${res.status})`);
  return res.text();
}

// Extrae {slug -> {slug, nombre, url, recaudado, diasRestantes}} del
// fragmento de HTML que devuelve /searcheventcauses para una página.
function extractCausesFromHtml(html, eventoUrl) {
  const $ = cheerio.load(html);
  const out = new Map();

  $('a[href*="/reto/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const m = href.match(/\/reto\/([a-z0-9-]+)/i);
    if (!m) return;
    const slug = m[1];
    if (out.has(slug)) return;

    const url = href.startsWith('http')
      ? href
      : new URL(href, eventoUrl).toString();

    // Subimos por los ancestros del enlace hasta encontrar un bloque que
    // contenga tanto un importe en € como "Faltan N días" — así no
    // dependemos de nombres de clase CSS que puedan cambiar.
    let node = $(el);
    let container = null;
    for (let i = 0; i < 6 && node.length; i++) {
      const text = node.text();
      if (/€/.test(text) && /Faltan/i.test(text)) {
        container = text;
        break;
      }
      node = node.parent();
    }

    let recaudado = null;
    let diasRestantes = null;
    if (container) {
      const importeMatch = container.match(/([\d.,]+)\s*€/);
      const diasMatch = container.match(/Faltan\s*(\d+)\s*d/i);
      if (importeMatch) recaudado = parseImporte(importeMatch[1]);
      if (diasMatch) diasRestantes = parseInt(diasMatch[1], 10);
    }

    const nombre = $(el).text().trim() || slug;

    out.set(slug, { slug, nombre, url, recaudado, diasRestantes });
  });

  return out;
}

// Saca el "slug" de MGA (el que usan en /reto/<slug>) a partir del campo
// "url" de una entrada de retos.json, sea string o {es, ca}.
function extractSlugFromUrl(url) {
  if (!url) return null;
  const s = typeof url === 'string' ? url : url.es;
  if (!s) return null;
  const m = s.match(/\/reto\/([a-z0-9-]+)/i);
  return m ? m[1] : null;
}

// Actualiza la url "es" con la recién descargada sin tocar "ca"/"en" si
// la entrada ya era un objeto multi-idioma.
function mergeUrl(existingUrl, scrapedUrl) {
  if (existingUrl && typeof existingUrl === 'object') {
    return { ...existingUrl, es: scrapedUrl };
  }
  return scrapedUrl;
}

function parseImporte(s) {
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

main().catch(err => {
  console.error('❌ Error actualizando retos.json:', err.message);
  process.exit(1);
});
