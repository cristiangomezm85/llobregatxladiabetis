/* LXD public stats API
 * Datos AGREGADOS y anónimos calculados a partir de las inscripciones al
 * repte — pensado para páginas públicas (dona.html, y en el futuro una
 * página de estadísticas: modalidad, camisetas, municipios...).
 *
 * A diferencia de admin-content.js (?type=inscripcions), esta función:
 *   - NO pide token: es de acceso público a propósito.
 *   - NUNCA devuelve el array de "ordres" tal cual, ni ningún campo que
 *     identifique a una persona (nombre, email, DNI, teléfono, fecha de
 *     nacimiento, Instagram...). Solo recuentos y sumas.
 *
 * Si en el futuro añadís una estadística nueva aquí, que sea SIEMPRE un
 * recuento o una suma agregada — nunca un listado de inscripciones ni un
 * campo personal. Si os hace falta un dato que hoy no se guarda en cada
 * inscripción (por ejemplo género, que mencionasteis para más adelante),
 * hay que añadirlo primero al formulario/al store — este archivo no
 * puede inventarlo.
 *
 * Requiere vivir en la MISMA carpeta que admin-content.js, porque reutiliza
 * su mismo import relativo "./lib/store".
 */

const { llistarOrdres } = require('./lib/store');

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Los agregados no cambian segundo a segundo: 5 minutos de caché en
      // el CDN de Netlify quita carga sin que se note en la web pública.
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
    body: JSON.stringify(body, null, 2),
  };
}

function payload(o) {
  return o && o.payload && typeof o.payload === 'object' ? o.payload : {};
}
function status(o) {
  return String((o && o.estat) || '').trim().toLowerCase();
}
function paid(o) {
  return status(o) === 'pagat';
}
function daysOf(p) {
  if (Array.isArray(p.tram_dies) && p.tram_dies.length) return p.tram_dies.map(Number).filter(n => n >= 1 && n <= 3);
  const a = Number(p.tram_dia_inici), b = Number(p.tram_dia_final);
  if (a && b && b >= a) { const out = []; for (let i = a; i <= b; i++) out.push(i); return out; }
  const m = String(p.tram_tipus || '').match(/^dia-(\d)$/); if (m) return [Number(m[1])];
  if (String(p.tram_tipus || '').toLowerCase() === 'tot') return [1, 2, 3];
  return [];
}
function shirtEntries(o) {
  const p = payload(o), out = [];
  if (Array.isArray(p.samarretes)) {
    p.samarretes.forEach(x => {
      const q = Number((x && x.quantitat) || 0);
      if (q > 0) out.push({ talla: String(x.talla || p.talla_samarreta || 'Sense talla'), q });
    });
  }
  if (!out.length) {
    const q = Number(o.camisetes_total || o.samarretes_total || o.unitats || 0), talla = p.talla_samarreta;
    if (q > 0 && talla) out.push({ talla, q });
  }
  return out;
}
function normalizeSize(s) {
  return String(s || '')
    .replace(/^home[-_]/i, 'Hombre ')
    .replace(/^dona[-_]/i, 'Mujer ')
    .replace(/^unisex[-_]/i, 'Unisex ')
    .replace(/[-_]/g, ' ')
    .trim() || 'Sin talla';
}

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Método no permitido' });

    const ordres = await llistarOrdres();
    // Operativa = SOLO inscripciones pagadas, igual que en el admin.
    const pagats = ordres.filter(paid);

    const dies = { 1: 0, 2: 0, 3: 0 };
    pagats.forEach(o => daysOf(payload(o)).forEach(d => { dies[d] = (dies[d] || 0) + 1; }));

    const modalitats = { caminant: 0, corrent: 0, bici: 0, animar: 0, dorsal0: 0 };
    let modalitatsAltres = 0;
    pagats.forEach(o => {
      const k = String(o.modalitat || payload(o).modalitat || '').toLowerCase();
      if (modalitats[k] !== undefined) modalitats[k]++;
      else if (k) modalitatsAltres++;
    });

    const camisetesPerTalla = {};
    let camisetesTotal = 0;
    pagats.forEach(o => shirtEntries(o).forEach(x => {
      const k = normalizeSize(x.talla);
      camisetesPerTalla[k] = (camisetesPerTalla[k] || 0) + x.q;
      camisetesTotal += x.q;
    }));

    const perMunicipi = {};
    pagats.forEach(o => {
      const nom = payload(o).recollida_municipi_nom || payload(o).recollida_municipi;
      if (nom) perMunicipi[nom] = (perMunicipi[nom] || 0) + 1;
    });

    // El import de la donació es guarda a "payload.donacio_centims" — és el
    // mateix camp que pricing.js llegeix a validarDonacio() per calcular
    // donacioCentims/totalCentims. Ve en cèntims, per això es divideix
    // entre 100.
    const donatiusInscripcionsEur =
      pagats.reduce((sum, o) => sum + (Number(payload(o).donacio_centims) || 0), 0) / 100;

    return json(200, {
      ok: true,
      actualitzat: new Date().toISOString(),
      inscritsPagats: pagats.length,
      dies,
      modalitats: { ...modalitats, altres: modalitatsAltres },
      camisetes: { total: camisetesTotal, perTalla: camisetesPerTalla },
      perMunicipi,
      donatiusInscripcionsEur,
    });
  } catch (err) {
    console.error('[public-stats]', err);
    return json(err.statusCode || 500, { ok: false, error: 'Error inesperado' });
  }
};
