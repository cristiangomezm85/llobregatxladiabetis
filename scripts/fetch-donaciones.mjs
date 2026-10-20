// scripts/fetch-donaciones.mjs
//
// Genera dona/donaciones.json con las donaciones de cada reto de Mi Grano
// de Arena (MGA), para la página /botella ("la botella de la esperanza").
//
// Qué muestra MGA en la página de cada reto (verificado a mano en
// /reto/carlos-912runners-x-la-diabetes):
//   · "Donantes (N)"    -> lista de: nombre, importe (o "Donación oculta") y
//                          fecha RELATIVA ("Hace 2 días"), la más reciente primero.
//   · "Comentarios (M)" -> lista de: nombre, fecha relativa y texto.
//   Los comentarios NO llevan importe ni enlace al donante: se emparejan por
//   nombre. Un comentario sin donante con ese nombre se guarda como gota propia.
//
// Como no dependemos de nombres de clase CSS (no los conocemos y pueden
// cambiar), el parser trabaja con el TEXTO de la página, localizando los
// encabezados "Donantes (N)" y "Comentarios (M)" y clasificando cada trozo
// de texto (importe, "Donación oculta", fecha relativa, resto).
//
// Seguridad:
//  - Si hay retos con dinero pero no se reconoce NINGUNA donación, falla
//    (exit 1) y NO toca donaciones.json.
//  - Si se leen menos donantes que el "(N)" del encabezado, avisa en el log
//    (puede haber una paginación "Ver más donantes" por JS).
//  - Nunca borra donaciones ya guardadas; la fecha se fija la primera vez que
//    se ve una donación (la fecha relativa de MGA cambia cada día).
//
// Depuración:  node scripts/fetch-donaciones.mjs --dump   (no escribe nada)
//
// ORDEN: cada donación tiene "orden" (1 = la primera que llegó). Las nuevas
// se numeran de la más antigua a la más reciente.

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import * as cheerio from 'cheerio';

const RETOS_PATH = new URL('../dona/retos.json', import.meta.url);
const OUT_PATH = new URL('../dona/donaciones.json', import.meta.url);
const DUMP = process.argv.includes('--dump');
const PAUSA_MS = 400;

const RE_DONANTES = /^(donantes|donants|donors|donaciones|donacions|donations)\s*\((\d+)\)/i;
const RE_COMENTARIOS = /^(comentarios|comentaris|comments)\s*\((\d+)\)/i;
const RE_IMPORTE = /^([\d.]+(?:,\d+)?)\s*€$|^€\s*([\d.]+(?:,\d+)?)$/;
const RE_OCULTA = /^(donaci[oó]n oculta|donaci[oó] oculta|hidden donation)$/i;
const RE_ANON = /^(an[oòó]nim[oa]?|anonymous)$/i;
const RE_VERMAS = /^(ver m[aá]s|veure'n m[eé]s|veure m[eé]s|show more|ver todos)/i;
const RE_FIN_SECCION = /^(patrocin|sponsor|col[·.]?labora|newsletter|suscr[ií]b|subscr|©|aviso legal|avís legal|pol[ií]tica|cookies|compart|comparteix|share)/i;
const RE_FINALIZADO_PAG = /^(?:(?:reto|repte|campa[ñn]a|campanya)\s+)?(?:finalizad[oa]|finalitzat|finalitzada|terminad[oa]|cerrad[oa]|tancat|tancada|ended|finished|closed)\b/i;
const RE_RECAUDADO = /recaudad|recaptad|raised/i;
const RE_FECHA = /^(hace|fa|hace\s+un[ao]?|hoy|avui|ayer|ahir|today|yesterday)\b|\bago$/i;

async function main() {
  const retosJson = JSON.parse(await readFile(RETOS_PATH, 'utf8'));
  let previo = { donaciones: [] };
  try { previo = JSON.parse(await readFile(OUT_PATH, 'utf8')); } catch {}
  const guardadas = new Map(previo.donaciones.map(d => [d.id, { ...d, nombre: decodificar(d.nombre), mensaje: decodificar(d.mensaje), retoNombre: decodificar(d.retoNombre) }]));
  let maxOrden = previo.donaciones.reduce((m, d) => Math.max(m, d.orden || 0), 0);

  const nuevas = [];
  let retosConDinero = 0, reconocidas = 0, actualizadas = 0, diagnosticoDado = false;

  // Se leen primero los retos "buenos" (heroe/poble) y al final los "pendiente", y cada
  // página de reto una sola vez aunque aparezca repetida en retos.json.
  const orden = retosJson.retos.slice().sort((a, b) => (a.tipo === 'pendiente') - (b.tipo === 'pendiente'));
  const vistos = new Set();
  const firmas = new Map();      // firma de la lista de donaciones -> slug que la leyó primero
  const duplicados = new Set();  // slugs cuya página es copia exacta de otra (mismo reto con otra URL)
  let retosCambiados = 0;

  for (const reto of orden) {
    const base = typeof reto.url === 'string' ? reto.url : reto.url?.es;
    if (!base || vistos.has(base)) continue;
    // Se leen los retos con dinero, los FINALIZADOS y los que ya no salen en el listado
    // del evento (MGA los saca de ahí al terminar y el importe podía quedarse a 0 €).
    // Solo se salta un reto activo, visible en el listado y con 0 € de verdad.
    if (!(reto.recaudado > 0) && !reto.finalizado && reto.enListado !== false) continue;
    vistos.add(base);
    retosConDinero++;

    const html = await fetchText(base);
    const { donantes, comentarios, totalDonantes, totalComentarios, tokens } = parsear(html);
    if (DUMP) volcar(reto.slug, tokens, donantes, comentarios, totalDonantes, totalComentarios);
    // Resumen por reto (queda en dona/_log-donaciones.txt para poder diagnosticar sin entrar a Actions).
    console.log(`${reto.slug}: donantes ${donantes.length}/${totalDonantes ?? '?'} · comentarios ${comentarios.length}/${totalComentarios ?? '?'} · textos ${tokens.length}`);
    if (totalDonantes == null && !diagnosticoDado) { diagnosticoDado = true; diagnostico(reto.slug, html, tokens); }
    if (totalDonantes != null && donantes.length < totalDonantes)
      console.warn(`⚠️  ${reto.slug}: la página dice ${totalDonantes} donantes pero se leyeron ${donantes.length} (¿paginación por JS?)`);
    if (totalComentarios != null && comentarios.length < totalComentarios)
      console.warn(`⚠️  ${reto.slug}: la página dice ${totalComentarios} comentarios pero se leyeron ${comentarios.length}`);

    // Importe y estado según la propia página del reto (por si el listado del evento no los da).
    const importePagina = totalDePagina(tokens);
    const sumaPublica = donantes.reduce((t, d) => t + (d.importe || 0), 0);
    const estimado = Math.max(importePagina ?? 0, sumaPublica);
    if (estimado > (Number(reto.recaudado) || 0)) {
      console.log(`  ↳ ${reto.slug}: importe ${reto.recaudado || 0}€ -> ${estimado}€ (${importePagina != null ? 'leído de la página' : 'suma de donantes visibles'})`);
      reto.recaudado = estimado; retosCambiados++;
    }
    if (tokens.slice(0, 80).some(t => t.length < 50 && RE_FINALIZADO_PAG.test(t)) && !reto.finalizado) {
      reto.finalizado = true; reto.diasRestantes = null; retosCambiados++;
      console.log(`  ↳ ${reto.slug}: marcado como finalizado`);
    }
    // Mismo reto publicado con dos URLs (p. ej. slug antiguo y nuevo): se queda una sola copia.
    if (donantes.length >= 3) {   // con menos donantes no se puede distinguir una copia de un reto distinto
      const firma = donantes.map(d => [norm(d.nombre), d.importe ?? 'x'].join('~')).join('|');
      if (firmas.has(firma)) { duplicados.add(reto.slug); console.log(`  ↳ ${reto.slug}: copia de ${firmas.get(firma)}, se ignora`); await pausa(); continue; }
      firmas.set(firma, reto.slug);
    }

    // Emparejar comentarios con donantes por nombre (sin tener en cuenta mayúsculas/tildes).
    const libres = comentarios.map(c => ({ ...c, usado: false }));
    const items = donantes.map(d => {
      const c = libres.find(x => !x.usado && norm(x.nombre) === norm(d.nombre));
      if (c) c.usado = true;
      return { ...d, mensaje: c ? c.texto : '', _fechaRel: d.fechaRel };
    });
    for (const c of libres) {
      if (!c.usado) items.push({ nombre: c.nombre, anonimo: RE_ANON.test(c.nombre), importe: null, mensaje: c.texto, _fechaRel: c.fechaRel, soloComentario: true });
    }

    // Ids estables: sin fecha (cambia cada día) y sin mensaje (puede llegar después).
    // El contador de repetidos se cuenta desde el final (lo más antiguo) para que
    // las donaciones nuevas, que entran por arriba, no cambien los ids de las viejas.
    const cont = new Map();
    for (const it of items.slice().reverse()) {
      const clave = [reto.slug, it.soloComentario ? 'c' : 'd', norm(it.nombre), it.importe ?? 'x', it.soloComentario ? it.mensaje : ''].join('|');
      const n = (cont.get(clave) || 0) + 1; cont.set(clave, n);
      it.id = createHash('sha1').update(clave + '#' + n).digest('hex').slice(0, 12);
    }
    reconocidas += items.length;

    for (const it of items.slice().reverse()) {
      const ya = guardadas.get(it.id);
      if (ya) {
        // Un comentario puede llegar después de la donación.
        if (!ya.mensaje && it.mensaje) { ya.mensaje = decodificar(it.mensaje); actualizadas++; }
        continue;
      }
      nuevas.push({
        id: it.id, reto: reto.slug, retoNombre: reto.nombre,
        nombre: it.anonimo ? null : decodificar(it.nombre), anonimo: !!it.anonimo,
        importe: it.importe, mensaje: decodificar(it.mensaje || ''),
        fecha: aproximarFecha(it._fechaRel)
      });
    }
    await pausa();
  }

  if (DUMP) { console.log('\nReconocidas:', reconocidas); return; }

  if (retosConDinero > 0 && reconocidas === 0) {
    console.error('❌ Hay retos con dinero pero no se reconoció ninguna donación (¿cambió el HTML de MGA?). Ejecuta: node scripts/fetch-donaciones.mjs --dump. No se modifica donaciones.json.');
    process.exit(1);
  }

  // Quita lo que se guardó antes de otra copia del mismo reto (mismos donantes, otra URL).
  if (duplicados.size) {
    for (const [id, d] of [...guardadas]) if (duplicados.has(d.reto)) guardadas.delete(id);
  }
  if (retosCambiados) {
    await writeFile(RETOS_PATH, JSON.stringify(retosJson, null, 2) + '\n', 'utf8');
    console.log(`retos.json: ${retosCambiados} cambio(s) de importe/estado`);
  }

  nuevas.sort((a, b) => (a.fecha && b.fecha) ? a.fecha.localeCompare(b.fecha) : 0);
  for (const it of nuevas) { it.orden = ++maxOrden; guardadas.set(it.id, it); }

  const donaciones = [...guardadas.values()].sort((a, b) => a.orden - b.orden);
  const salida = {
    objectiuGotes: previo.objectiuGotes || 250,
    actualizado: new Date().toISOString(),
    total: donaciones.length,
    donaciones
  };
  await writeFile(OUT_PATH, JSON.stringify(salida, null, 2) + '\n', 'utf8');
  console.log(`✅ donaciones.json — ${donaciones.length} donaciones (${nuevas.length} nuevas, ${actualizadas} con comentario añadido)`);
}

// ---------------------------------------------------------------------
// Parser basado en texto
// ---------------------------------------------------------------------
export function parsear(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, template').remove();
  const tokens = [];
  const visita = (nodo) => {
    nodo.contents().each((_, n) => {
      if (n.type === 'text') {
        const t = (n.data || '').replace(/\s+/g, ' ').trim();
        if (t) tokens.push(t);
      } else if (n.type === 'tag') visita($(n));
    });
  };
  visita($('body').length ? $('body') : $.root());
  // En MGA el encabezado viene partido en dos textos ("Donantes" + "(14)"): los unimos.
  for (let i = tokens.length - 1; i > 0; i--) {
    if (/^\(\d+\)$/.test(tokens[i])) { tokens[i - 1] += ' ' + tokens[i]; tokens.splice(i, 1); }
  }

  const iD = tokens.findIndex(t => RE_DONANTES.test(t));
  const iC = tokens.findIndex((t, i) => i > iD && RE_COMENTARIOS.test(t));
  const totalDonantes = iD >= 0 ? Number(tokens[iD].match(RE_DONANTES)[2]) : null;
  const totalComentarios = iC >= 0 ? Number(tokens[iC].match(RE_COMENTARIOS)[2]) : null;

  const tramoDon = iD < 0 ? [] : tokens.slice(iD + 1, iC >= 0 ? iC : undefined);
  const tramoCom = iC < 0 ? [] : tokens.slice(iC + 1);
  return { donantes: parsearDonantes(tramoDon), comentarios: parsearComentarios(tramoCom), totalDonantes, totalComentarios, tokens };
}

// Importe total del reto según su página: texto con "recaudado/recaptat/raised" y un importe en € al lado.
export function totalDePagina(tokens) {
  const conImporte = t => { const m = String(t || '').match(/([\d.]+(?:,\d+)?)\s*€|€\s*([\d.]+(?:,\d+)?)/); return m ? parseImporte(m[1] || m[2]) : null; };
  for (let i = 0; i < Math.min(tokens.length, 120); i++) {
    if (!RE_RECAUDADO.test(tokens[i])) continue;
    for (const j of [i, i - 1, i + 1]) {
      const v = conImporte(tokens[j]);
      if (v != null) return v;
    }
  }
  return null;
}

function parsearDonantes(t) {
  // Patrón: NOMBRE, IMPORTE|"Donación oculta", FECHA — ancla en cada IMPORTE/OCULTA.
  const out = [];
  for (let i = 1; i < t.length; i++) {
    const esImp = RE_IMPORTE.test(t[i]), esOcu = RE_OCULTA.test(t[i]);
    if (!esImp && !esOcu) continue;
    const nombre = t[i - 1];
    if (RE_IMPORTE.test(nombre) || RE_OCULTA.test(nombre) || RE_FECHA.test(nombre) || RE_VERMAS.test(nombre)) continue;
    const fechaRel = RE_FECHA.test(t[i + 1] || '') ? t[i + 1] : null;
    out.push({ nombre, anonimo: RE_ANON.test(nombre), importe: esImp ? parseImporte(t[i]) : null, fechaRel });
  }
  return out;
}

function parsearComentarios(t) {
  // Patrón: NOMBRE, FECHA, TEXTO... — ancla en cada FECHA relativa.
  const idx = [];
  for (let i = 1; i < t.length; i++) if (RE_FECHA.test(t[i]) && !RE_FECHA.test(t[i - 1])) idx.push(i);
  const out = [];
  idx.forEach((i, k) => {
    const sig = k + 1 < idx.length ? idx[k + 1] - 1 : t.length;   // el nombre del siguiente va justo antes de su fecha
    let texto = [];
    for (let j = i + 1; j < sig; j++) {
      if (RE_FIN_SECCION.test(t[j]) || RE_VERMAS.test(t[j])) break;
      texto.push(t[j]);
      if (k + 1 >= idx.length && texto.length >= 4) break;       // último comentario: sin delimitador fiable
    }
    out.push({ nombre: t[i - 1], fechaRel: t[i], texto: texto.join(' ').trim() });
  });
  return out.filter(c => c.texto);
}

// "Hace 2 días" / "Hace un mes" / "Fa 3 hores" / "2 days ago" -> fecha ISO aproximada.
export function aproximarFecha(rel, ahora = new Date()) {
  const base = ahora.getTime();
  if (!rel) return new Date(base).toISOString();
  const s = rel.toLowerCase();
  if (/hoy|avui|today/.test(s)) return new Date(base).toISOString();
  if (/ayer|ahir|yesterday/.test(s)) return new Date(base - 864e5).toISOString();
  const m = s.match(/(\d+|un|una)\s*(minut|min|hor|hour|d[ií]a|die|dia|day|semana|setman|week|mes|month|a[ñn]o|any|year)/);
  if (!m) return new Date(base).toISOString();
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  const u = m[2];
  const ms = /^min/.test(u) ? 6e4 : /^(hor|hour)/.test(u) ? 36e5 : /^(d[ií]a|die|dia|day)/.test(u) ? 864e5
    : /^(semana|setman|week)/.test(u) ? 7 * 864e5 : /^(mes|month)/.test(u) ? 30 * 864e5 : 365 * 864e5;
  return new Date(base - n * ms).toISOString();
}

function diagnostico(slug, html, tokens) {
  console.log(`--- DIAGNÓSTICO ${slug}: no se encontró el encabezado "Donantes (N)" ---`);
  console.log(`HTML: ${html.length} caracteres · <title>: ${(html.match(/<title>([^<]*)/i) || [])[1] || '(sin título)'}`);
  console.log('Primeros textos:', JSON.stringify(tokens.slice(0, 25)));
  const hits = [];
  tokens.forEach((t, i) => { if (/donan|donor|donat|coment|comment/i.test(t) && hits.length < 8) hits.push([i, tokens.slice(Math.max(0, i - 1), i + 4)]); });
  console.log('Textos con donan/coment:', JSON.stringify(hits));
}

function volcar(slug, tokens, donantes, comentarios, td, tc) {
  console.log(`\n===== DUMP ${slug} =====`);
  console.log(`Encabezados: Donantes(${td}) Comentarios(${tc}) · tokens de texto: ${tokens.length}`);
  console.log('Donantes leídos:', donantes.length); donantes.slice(0, 5).forEach(d => console.log('  ', JSON.stringify(d)));
  console.log('Comentarios leídos:', comentarios.length); comentarios.slice(0, 5).forEach(c => console.log('  ', JSON.stringify(c)));
}

// MGA entrega algunos textos con entidades HTML (&#039; &quot;...), a veces doblemente escapadas.
export function decodificar(t) {
  if (t == null) return t;
  let s = String(t);
  for (let i = 0; i < 3 && /&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(s); i++) s = cheerio.load(`<i>${s}</i>`, null, false).text();
  return s;
}
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LlobregatDonaBot/1.0)', 'Accept-Language': 'es-ES,es;q=0.9,ca;q=0.8,en;q=0.5' } });
  if (!res.ok) throw new Error(`No se pudo descargar ${url} (HTTP ${res.status})`);
  return res.text();
}
const pausa = () => new Promise(r => setTimeout(r, PAUSA_MS));
function parseImporte(s) {
  const n = parseFloat(String(s).replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error('❌', err.message); process.exit(1); });
}
