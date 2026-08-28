// fetch-retos.mjs
//
// Actualiza retos.json leyendo la página del evento en Mi Grano de Arena.
// Mi Grano de Arena no tiene API pública, así que esto hace "screen scraping"
// de la página del evento (que lista todos los retos con su importe y días
// restantes) en una sola petición.
//
// USO:
//   npm install cheerio
//   node fetch-retos.mjs
//
// Pensado para ejecutarse periódicamente: como Netlify Scheduled Function,
// GitHub Action con cron, o a mano antes de un despliegue. Nunca borra ni
// sobreescribe el campo "tipo" de un reto ya existente en el JSON — ese
// campo lo decides tú a mano (poble / heroe), porque MGA no lo expone.
//
// Si aparece un reto nuevo en MGA que no está todavía en retos.json, se
// añade con tipo:"pendiente" y se avisa por consola para que lo clasifiques.

import { readFile, writeFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';

const JSON_PATH = new URL('./retos.json', import.meta.url);

async function main() {
  const current = JSON.parse(await readFile(JSON_PATH, 'utf8'));
  const eventoUrl = current.eventoUrl;

  console.log(`Descargando ${eventoUrl} ...`);
  const res = await fetch(eventoUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LlobregatDonaBot/1.0)' }
  });
  if (!res.ok) {
    throw new Error(`No se pudo descargar el evento (HTTP ${res.status})`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  // --- Total del evento ---------------------------------------------
  const bodyText = $('body').text().replace(/\s+/g, ' ');
  const totalMatch = bodyText.match(/Total recaudado\s*:?\s*([\d.,]+)\s*€/i);
  const totalRecaudado = totalMatch
    ? parseImporte(totalMatch[1])
    : current.totalRecaudado;

  // --- Cada reto individual -------------------------------------------
  const knownBySlug = new Map(current.retos.map(r => [r.slug, r]));
  const seenSlugs = new Set();
  const retos = [];

  $('a[href*="/reto/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const m = href.match(/\/reto\/([a-z0-9-]+)/i);
    if (!m) return;
    const slug = m[1];
    if (seenSlugs.has(slug)) return;
    seenSlugs.add(slug);

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

    let recaudado = knownBySlug.get(slug)?.recaudado ?? 0;
    let diasRestantes = knownBySlug.get(slug)?.diasRestantes ?? null;
    if (container) {
      const importeMatch = container.match(/([\d.,]+)\s*€/);
      const diasMatch = container.match(/Faltan\s*(\d+)\s*d/i);
      if (importeMatch) recaudado = parseImporte(importeMatch[1]);
      if (diasMatch) diasRestantes = parseInt(diasMatch[1], 10);
    }

    // Nombre: preferimos el que ya tenemos guardado (más limpio); si es
    // nuevo, usamos el texto del propio enlace como mejor esfuerzo.
    const nombre = knownBySlug.get(slug)?.nombre || $(el).text().trim() || slug;
    const tipo = knownBySlug.get(slug)?.tipo || 'pendiente';

    if (tipo === 'pendiente') {
      console.warn(`⚠️  Reto nuevo sin clasificar: "${nombre}" (${slug}) — añádele "tipo": "poble" o "heroe" en retos.json`);
    }

    retos.push({ slug, nombre, tipo, url, recaudado, diasRestantes });
  });

  const updated = {
    ...current,
    totalRecaudado,
    actualizado: new Date().toISOString(),
    retos
  };

  await writeFile(JSON_PATH, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  console.log(`✅ retos.json actualizado — ${retos.length} retos, total ${totalRecaudado}€`);
}

function parseImporte(s) {
  // "1.234,56" -> 1234.56  /  "1234" -> 1234
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

main().catch(err => {
  console.error('❌ Error actualizando retos.json:', err.message);
  process.exit(1);
});
