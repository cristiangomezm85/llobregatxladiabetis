/* LXD admin content API
 * Local: writes JSON/images directly to the project folder when used with `netlify dev`.
 * Production: if CONTENT_BACKEND=github (or GITHUB_TOKEN+GITHUB_REPO are set), writes through GitHub Contents API.
 */

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { llistarOrdres } = require('./lib/store');

const ROOT = process.env.LXD_CONTENT_ROOT || process.cwd();
const TODAY = () => new Date().toISOString().slice(0, 10);
const MAX_BODY_BYTES = Number(process.env.LXD_ADMIN_MAX_BODY_BYTES || 6 * 1024 * 1024);

const TYPES = {
  herois: {
    file: 'herois.json',
    key: 'herois',
    imageDir: 'img/herois',
    imageField: 'foto',
    sort: (a, b) => Number(b.destacat || 0) - Number(a.destacat || 0) || String(a.nom || '').localeCompare(String(b.nom || ''), 'ca'),
    empty: () => ({ actualitzat: TODAY(), estat: 'obert', herois: [] }),
  },
  pobles: {
    file: 'pobles.json',
    key: 'pobles',
    imageDir: 'img/pobles',
    imageField: 'foto',
    sort: (a, b) => (Number(a.dia || 0) - Number(b.dia || 0)) || (Number(a.km || 0) - Number(b.km || 0)) || String(a.nom || '').localeCompare(String(b.nom || ''), 'ca'),
    empty: () => ({ actualitzat: TODAY(), ordre: 'riu', pobles: [] }),
  },
  patrocinadors: {
    file: 'patrocinadors.json',
    key: 'patrocinadors',
    imageDir: 'img/patrocinadors',
    imageField: 'logo',
    sort: (a, b) => String(a.nivell || '').localeCompare(String(b.nivell || ''), 'ca') || String(a.nom || '').localeCompare(String(b.nom || ''), 'ca'),
    empty: () => ({ actualitzat: TODAY(), objectiu_recaptacio_eur: 10000, patrocinadors: [] }),
  },
  solicitudes: {
    file: 'admin/solicitudes-herois.json',
    key: 'solicitudes',
    private: true,
    sort: (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')),
    empty: () => ({ actualitzat: TODAY(), solicitudes: [] }),
  },
  inscripcions: {
    private: true,
    empty: () => ({ ordres: [] }),
  },
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
      ...extraHeaders,
    },
    body: JSON.stringify(body, null, 2),
  };
}

function safeType(type) {
  if (!type || !TYPES[type]) throw Object.assign(new Error('Tipo de contenido no válido'), { statusCode: 400 });
  return TYPES[type];
}

function isHostedNetlifyRuntime() {
  const context = String(process.env.CONTEXT || '').toLowerCase();
  return Boolean(
    process.env.DEPLOY_ID ||
    process.env.URL ||
    (process.env.NETLIFY === 'true' && context && context !== 'dev')
  );
}

function isLocalRequest(event) {
  if (isHostedNetlifyRuntime()) return false;
  const host = String(event.headers.host || event.headers.Host || '').toLowerCase();
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('0.0.0.0');
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function requireAuth(event, wantsPrivateOrWrite) {
  if (!wantsPrivateOrWrite) return;
  if ((isLocalRequest(event) && process.env.LXD_ADMIN_DISABLE_LOCAL_UNAUTH !== 'true') || process.env.LXD_ADMIN_ALLOW_UNAUTH === 'true') return;

  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    throw Object.assign(new Error('Admin no protegido: define ADMIN_TOKEN en Netlify para activar el acceso.'), { statusCode: 401 });
  }
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const tokenHeader = event.headers['x-admin-token'] || event.headers['X-Admin-Token'] || '';
  const supplied = auth.replace(/^Bearer\s+/i, '') || tokenHeader;
  if (!safeEqual(supplied, expected)) {
    throw Object.assign(new Error('Token admin incorrecto o ausente.'), { statusCode: 401 });
  }
}

function parseBody(event) {
  if (!event.body) return {};
  const byteLength = Buffer.byteLength(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
  if (byteLength > MAX_BODY_BYTES) {
    throw Object.assign(new Error('Petición demasiado grande.'), { statusCode: 413 });
  }
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw Object.assign(new Error('JSON inválido.'), { statusCode: 400 });
  }
}

function backendMode() {
  if (process.env.CONTENT_BACKEND === 'github') return 'github';
  if (process.env.GITHUB_TOKEN && (process.env.GITHUB_REPO || (process.env.GITHUB_OWNER && process.env.GITHUB_REPO_NAME))) return 'github';
  return 'local';
}

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

function stripEmpty(value) {
  if (Array.isArray(value)) return value.map(stripEmpty).filter(v => v !== undefined && v !== null && v !== '');
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const clean = stripEmpty(v);
      if (clean !== undefined && clean !== null && clean !== '') out[k] = clean;
    }
    return out;
  }
  if (value === '') return undefined;
  return value;
}

function normaliseItem(type, item) {
  const clean = stripEmpty(item || {}) || {};
  clean.id = slugify(clean.id || clean.nom || clean.nombre || clean.municipi || clean.organitzacio);
  if (type === 'herois') {
    clean.nom = clean.nom || 'Heroi sense nom';
    clean.rol = clean.rol || { ca: 'Heroi o Heroïna', es: 'Héroe o Heroína', en: 'Hero or Heroine' };
    clean.modalitat = clean.modalitat || 'corrent';
    clean.destacat = !!clean.destacat;
    clean.estat_publicacio = clean.estat_publicacio || 'publicat';
  }
  if (type === 'pobles') {
    clean.nom = clean.nom || 'Poble sense nom';
    clean.dia = Number(clean.dia || 1);
    clean.km = Number(clean.km || 0);
    clean.tipus = clean.tipus || 'municipi';
    clean.estat = clean.estat || 'pendent';
    if (!Array.isArray(clean.aporta)) clean.aporta = [];
    if (!clean.embaixador || !clean.embaixador.nom) clean.embaixador = null;
  }
  if (type === 'patrocinadors') {
    clean.nom = clean.nom || 'Patrocinador sense nom';
    clean.nivell = clean.nivell || 'km';
    clean.tipus = clean.tipus || 'empresa';
    clean.estat_publicacio = clean.estat_publicacio || 'publicat';
    if (clean.km !== undefined) clean.km = Number(clean.km);
  }
  return clean;
}

async function readLocal(def) {
  const filePath = path.join(ROOT, def.file);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return def.empty();
    throw err;
  }
}

async function writeLocal(def, data) {
  const filePath = path.join(ROOT, def.file);
  data.actualitzat = TODAY();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw Object.assign(new Error('Imagen inválida: se esperaba data URL base64'), { statusCode: 400 });
  const mime = match[1].toLowerCase();
  const ext = mime.includes('webp') ? 'webp' : mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'bin';
  return { buffer: Buffer.from(match[2], 'base64'), ext, mime };
}

async function writeImageLocal(def, id, image) {
  if (!image || !image.dataUrl) return null;
  const { buffer, ext } = decodeDataUrl(image.dataUrl);
  const baseName = slugify(image.filename ? image.filename.replace(/\.[^.]+$/, '') : id);
  const filename = `${slugify(id || baseName)}.${ext}`;
  const rel = path.posix.join(def.imageDir, filename);
  const full = path.join(ROOT, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return rel;
}

async function upsertLocal(type, item, image) {
  const def = TYPES[type];
  const data = await readLocal(def);
  const list = Array.isArray(data[def.key]) ? data[def.key] : [];
  const clean = normaliseItem(type, item);
  const imagePath = await writeImageLocal(def, clean.id, image);
  if (imagePath && def.imageField) clean[def.imageField] = imagePath;
  const idx = list.findIndex(x => String(x.id) === String(clean.id));
  if (idx >= 0) list[idx] = { ...list[idx], ...clean };
  else list.push(clean);
  if (def.sort) list.sort(def.sort);
  data[def.key] = list;
  await writeLocal(def, data);
  return { item: clean, data };
}

async function deleteLocal(type, id) {
  const def = TYPES[type];
  const data = await readLocal(def);
  const list = Array.isArray(data[def.key]) ? data[def.key] : [];
  const next = list.filter(x => String(x.id) !== String(id));
  data[def.key] = next;
  await writeLocal(def, data);
  return { deleted: list.length - next.length, data };
}

async function githubFetch(url, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw Object.assign(new Error('Falta GITHUB_TOKEN'), { statusCode: 500 });
  const res = await fetch(url, {
    ...options,
    headers: {
      'accept': 'application/vnd.github+json',
      'authorization': `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`), { statusCode: 502 });
  }
  return res.json();
}

function repoInfo() {
  const repoFull = process.env.GITHUB_REPO;
  let owner = process.env.GITHUB_OWNER;
  let repo = process.env.GITHUB_REPO_NAME;
  if (repoFull && repoFull.includes('/')) [owner, repo] = repoFull.split('/');
  if (!owner || !repo) throw Object.assign(new Error('Configura GITHUB_REPO=owner/repo o GITHUB_OWNER + GITHUB_REPO_NAME'), { statusCode: 500 });
  return { owner, repo, branch: process.env.GITHUB_BRANCH || 'main' };
}


async function getGitHubFileMeta(relPath) {
  const { owner, repo, branch } = repoInfo();
  const encPath = relPath.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encPath}?ref=${encodeURIComponent(branch)}`;
  try {
    const meta = await githubFetch(url);
    return { sha: meta.sha };
  } catch (err) {
    if (String(err.message).includes('GitHub API 404')) return { sha: null };
    throw err;
  }
}

async function readGitHubFile(relPath, defForEmpty) {
  const { owner, repo, branch } = repoInfo();
  const encPath = relPath.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encPath}?ref=${encodeURIComponent(branch)}`;
  try {
    const meta = await githubFetch(url);
    const content = Buffer.from(meta.content || '', 'base64').toString('utf8');
    return { data: JSON.parse(content), sha: meta.sha };
  } catch (err) {
    if (String(err.message).includes('GitHub API 404')) return { data: defForEmpty.empty(), sha: null };
    throw err;
  }
}

async function putGitHubFile(relPath, contentBuffer, message, sha) {
  const { owner, repo, branch } = repoInfo();
  const encPath = relPath.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encPath}`;
  const body = {
    message,
    content: Buffer.from(contentBuffer).toString('base64'),
    branch,
    committer: {
      name: process.env.GITHUB_COMMITTER_NAME || 'LXD Admin',
      email: process.env.GITHUB_COMMITTER_EMAIL || 'admin@llobregat.org',
    },
  };
  if (sha) body.sha = sha;
  return githubFetch(url, { method: 'PUT', body: JSON.stringify(body) });
}

async function writeImageGitHub(def, id, image) {
  if (!image || !image.dataUrl) return null;
  const { buffer, ext } = decodeDataUrl(image.dataUrl);
  const filename = `${slugify(id)}.${ext}`;
  const rel = path.posix.join(def.imageDir, filename);
  const existing = await getGitHubFileMeta(rel);
  await putGitHubFile(rel, buffer, `LXD admin: actualitza imatge ${rel}`, existing.sha || null);
  return rel;
}

async function upsertGitHub(type, item, image) {
  const def = TYPES[type];
  const clean = normaliseItem(type, item);
  const file = await readGitHubFile(def.file, def);
  const data = file.data;
  const list = Array.isArray(data[def.key]) ? data[def.key] : [];
  const imagePath = await writeImageGitHub(def, clean.id, image);
  if (imagePath && def.imageField) clean[def.imageField] = imagePath;
  const idx = list.findIndex(x => String(x.id) === String(clean.id));
  if (idx >= 0) list[idx] = { ...list[idx], ...clean };
  else list.push(clean);
  if (def.sort) list.sort(def.sort);
  data[def.key] = list;
  data.actualitzat = TODAY();
  await putGitHubFile(def.file, Buffer.from(JSON.stringify(data, null, 2) + '\n'), `LXD admin: guarda ${type}/${clean.id}`, file.sha);
  return { item: clean, data };
}

async function deleteGitHub(type, id) {
  const def = TYPES[type];
  const file = await readGitHubFile(def.file, def);
  const data = file.data;
  const list = Array.isArray(data[def.key]) ? data[def.key] : [];
  data[def.key] = list.filter(x => String(x.id) !== String(id));
  data.actualitzat = TODAY();
  await putGitHubFile(def.file, Buffer.from(JSON.stringify(data, null, 2) + '\n'), `LXD admin: elimina ${type}/${id}`, file.sha);
  return { deleted: list.length - data[def.key].length, data };
}

async function readContent(type) {
  const def = TYPES[type];
  if (type === 'inscripcions') {
    const ordres = await llistarOrdres();
    ordres.sort((a, b) => String(b.data_creacio || '').localeCompare(String(a.data_creacio || '')));
    return { ordres };
  }
  if (backendMode() === 'github' && !def.private) {
    return (await readGitHubFile(def.file, def)).data;
  }
  return readLocal(def);
}

async function upsertContent(type, item, image) {
  if (backendMode() === 'github' && !TYPES[type].private) return upsertGitHub(type, item, image);
  return upsertLocal(type, item, image);
}

async function deleteContent(type, id) {
  if (backendMode() === 'github' && !TYPES[type].private) return deleteGitHub(type, id);
  return deleteLocal(type, id);
}

function requestToHero(req) {
  const nom = [req.nom, req.cognoms].filter(Boolean).join(' ') || req.nom_public || 'Heroi o Heroïna';
  return normaliseItem('herois', {
    id: req.id ? slugify(req.id.replace(/^req-/, '')) : slugify(nom),
    nom,
    poble: req.poble || req.municipi || '',
    modalitat: req.modalitat || 'corrent',
    rol: {
      ca: 'Heroi o Heroïna',
      es: 'Héroe o Heroína',
      en: 'Hero or Heroine',
    },
    tram: {
      ca: req.tram || req.tram_text || 'Tram per confirmar',
      es: req.tram || req.tram_text || 'Tramo por confirmar',
      en: req.tram || req.tram_text || 'Section to be confirmed',
    },
    motiu: {
      ca: req.motiu || req.comentari || '',
      es: req.motiu || req.comentari || '',
      en: '',
    },
    repte: {
      ca: req.repte_personal || '',
      es: req.repte_personal || '',
      en: '',
    },
    instagram: req.instagram || '',
    destacat: false,
    estat_publicacio: 'borrador',
  });
}

async function seedRequest() {
  const def = TYPES.solicitudes;
  const data = await readLocal(def);
  const list = Array.isArray(data[def.key]) ? data[def.key] : [];
  const id = 'req-demo-' + Date.now();
  list.unshift({
    id,
    created_at: new Date().toISOString(),
    estado: 'pendiente',
    nom: 'Sol·licitud',
    cognoms: 'de prova',
    email: 'demo@example.com',
    telefon: '600000000',
    poble: 'Sant Boi de Llobregat',
    modalitat: 'corrent',
    motiu: 'Vull sumar quilòmetres per visibilitzar la diabetis tipus 1.',
    repte_personal: 'Fer un tram del Llobregat i compartir el repte amb la meva xarxa.',
    instagram: '@llobregatxladiabetis',
    idioma: 'CA',
  });
  data[def.key] = list;
  await writeLocal(def, data);
  return { id, data };
}

async function approveRequest(requestId, item, image) {
  const hero = item && item.nom ? item : requestToHero((await readLocal(TYPES.solicitudes)).solicitudes.find(r => r.id === requestId) || {});
  const saved = await upsertContent('herois', hero, image);
  const def = TYPES.solicitudes;
  const data = await readLocal(def);
  data[def.key] = (data[def.key] || []).map(r => r.id === requestId ? { ...r, estado: 'convertida_a_borrador', heroId: saved.item.id, converted_at: new Date().toISOString() } : r);
  await writeLocal(def, data);
  return { hero: saved.item, solicitudes: data };
}

exports.handler = async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') return json(204, {});

    const method = event.httpMethod;
    const qs = event.queryStringParameters || {};

    if (method === 'GET') {
      const type = qs.type || 'herois';
      const def = safeType(type);
      requireAuth(event, true);
      const data = await readContent(type);
      return json(200, { ok: true, type, backend: backendMode(), data });
    }

    if (method !== 'POST') return json(405, { ok: false, error: 'Método no permitido' });

    const body = parseBody(event);
    const action = body.action || 'save';
    requireAuth(event, true);

    if (action === 'seed-request') {
      if (!isLocalRequest(event) && process.env.LXD_ADMIN_ALLOW_SEED !== 'true') {
        return json(403, { ok: false, error: 'Las solicitudes demo solo están permitidas en local.' });
      }
      const result = await seedRequest();
      return json(200, { ok: true, action, result });
    }

    if (action === 'request-to-hero') {
      const data = await readLocal(TYPES.solicitudes);
      const req = (data.solicitudes || []).find(r => r.id === body.requestId);
      if (!req) return json(404, { ok: false, error: 'Solicitud no encontrada' });
      return json(200, { ok: true, hero: requestToHero(req), request: req });
    }

    if (action === 'approve-request') {
      const result = await approveRequest(body.requestId, body.item, body.image);
      return json(200, { ok: true, action, result });
    }

    const type = body.type;
    safeType(type);

    if (action === 'delete') {
      const result = await deleteContent(type, body.id);
      return json(200, { ok: true, action, type, result });
    }

    if (action === 'save') {
      const result = await upsertContent(type, body.item, body.image);
      return json(200, { ok: true, action, type, result });
    }

    return json(400, { ok: false, error: 'Acción no válida' });
  } catch (err) {
    console.error('[admin-content]', err);
    return json(err.statusCode || 500, { ok: false, error: err.message || 'Error inesperado' });
  }
};
