(function () {
  'use strict';

  const API = '/api/admin-content';
  const state = {
    tab: 'herois',
    data: {},
    selected: { herois: null, pobles: null, patrocinadors: null },
    images: {},
    pendingRequestId: null,
    token: (sessionStorage.getItem('lxd-admin-token') || localStorage.getItem('lxd-admin-token') || ''),
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const FORMS = {
    herois: $('#heroisForm'),
    pobles: $('#poblesForm'),
    patrocinadors: $('#patroForm'),
  };

  const LISTS = {
    herois: $('#heroisList'),
    pobles: $('#poblesListAdmin'),
    patrocinadors: $('#patroListAdmin'),
  };

  const CONFIG = {
    herois: {
      key: 'herois',
      list: LISTS.herois,
      form: FORMS.herois,
      title: x => x.nom || '(sin nombre)',
      meta: x => [x.estat_publicacio === 'borrador' ? 'borrador' : 'publicado', x.poble, x.modalitat].filter(Boolean).join(' · '),
      empty: () => ({
        id: '', nom: '', poble: '', modalitat: 'corrent', estat_publicacio: 'publicat',
        rol: { ca: 'Heroi o Heroïna', es: 'Héroe o Heroína', en: 'Hero or Heroine' },
        tram: { ca: '', es: '', en: '' }, motiu: { ca: '', es: '', en: '' }, repte: { ca: '', es: '', en: '' },
        instagram: '', foto: '', destacat: false,
      }),
      preview: $('#heroisPreview'),
    },
    pobles: {
      key: 'pobles',
      list: LISTS.pobles,
      form: FORMS.pobles,
      title: x => x.nom || '(sin nombre)',
      meta: x => `Día ${x.dia || '-'} · km ${x.km ?? '-'} · ${x.estat || 'pendent'}`,
      empty: () => ({
        id: '', nom: '', dia: 1, km: 0, comarca: '', tipus: 'municipi', estat: 'pendent', municipi_principal: '',
        embaixador: { nom: '', instagram: '' }, aporta: [], notes: { ca: '', es: '', en: '' }, foto: '',
      }),
    },
    patrocinadors: {
      key: 'patrocinadors',
      list: LISTS.patrocinadors,
      form: FORMS.patrocinadors,
      title: x => x.nom || '(sin nombre)',
      meta: x => [x.estat_publicacio === 'borrador' ? 'borrador' : 'publicado', x.nivell, x.tipus, x.km ? `km ${x.km}` : ''].filter(Boolean).join(' · '),
      empty: () => ({
        id: '', nom: '', nivell: 'km', tipus: 'empresa', web: '', km: '', estat_publicacio: 'publicat',
        aporta: { ca: '', es: '', en: '' }, missatge: { ca: '', es: '', en: '' }, logo: '',
      }),
      preview: $('#patroPreview'),
    },
  };

  function notify(text, isError) {
    const el = $('#adminNotice');
    el.textContent = text;
    el.classList.toggle('is-error', !!isError);
    el.classList.add('is-visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('is-visible'), isError ? 9000 : 4500);
  }

  function slugify(input) {
    return String(input || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function get(obj, path) {
    return String(path).split('.').reduce((acc, key) => acc && acc[key] !== undefined ? acc[key] : undefined, obj);
  }

  function set(obj, path, value) {
    const parts = String(path).split('.');
    let cur = obj;
    parts.forEach((part, idx) => {
      if (idx === parts.length - 1) cur[part] = value;
      else {
        cur[part] = cur[part] || {};
        cur = cur[part];
      }
    });
  }

  function clean(obj) {
    if (Array.isArray(obj)) return obj.map(clean).filter(v => v !== '' && v !== undefined && v !== null);
    if (obj && typeof obj === 'object') {
      const out = {};
      Object.entries(obj).forEach(([key, val]) => {
        const v = clean(val);
        if (v !== '' && v !== undefined && v !== null && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)) out[key] = v;
      });
      return out;
    }
    return obj;
  }

  function headers() {
    const out = { 'content-type': 'application/json' };
    if (state.token) out.authorization = 'Bearer ' + state.token;
    return out;
  }

  async function apiGet(type) {
    const res = await fetch(`${API}?type=${encodeURIComponent(type)}`, { headers: headers(), cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo cargar ' + type);
    return json;
  }

  async function apiPost(payload) {
    const res = await fetch(API, { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo guardar');
    return json;
  }

  async function loadType(type) {
    const result = await apiGet(type);
    state.data[type] = result.data;
    return result.data;
  }

  async function loadAll() {
    try {
      await Promise.all(['herois', 'pobles', 'patrocinadors', 'solicitudes'].map(type => loadType(type).catch(err => {
        if (type === 'solicitudes') return { solicitudes: [] };
        throw err;
      })));
      renderAll();
      notify('Datos cargados. En local, los cambios se escriben en los JSON del proyecto.');
    } catch (err) {
      notify(err.message, true);
    }
  }

  function items(type) {
    const cfg = CONFIG[type];
    const data = state.data[type] || {};
    return Array.isArray(data[cfg.key]) ? data[cfg.key] : [];
  }

  function renderList(type) {
    const cfg = CONFIG[type];
    const list = items(type);
    cfg.list.innerHTML = '';
    if (!list.length) {
      cfg.list.innerHTML = '<div class="empty-state">Aún no hay elementos.</div>';
      fillForm(type, cfg.empty());
      return;
    }
    list.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item-button' + (state.selected[type] === item.id ? ' is-selected' : '');
      const badge = item.estat_publicacio === 'borrador' ? '<span class="badge draft">borrador</span> ' : '';
      btn.innerHTML = `<span class="item-title">${badge}${escapeHtml(cfg.title(item))}</span><span class="item-meta">${escapeHtml(cfg.meta(item))}</span>`;
      btn.addEventListener('click', () => selectItem(type, item.id));
      cfg.list.appendChild(btn);
    });
    if (!state.selected[type] || !list.some(x => x.id === state.selected[type])) state.selected[type] = list[0].id;
    const selected = list.find(x => x.id === state.selected[type]) || list[0];
    fillForm(type, selected);
  }

  function renderRequests() {
    const wrap = $('#requestsList');
    const data = state.data.solicitudes || { solicitudes: [] };
    const list = Array.isArray(data.solicitudes) ? data.solicitudes : [];
    const pending = list.filter(r => r.estado !== 'aprobada' && r.estado !== 'rechazada');
    if (!pending.length) {
      wrap.innerHTML = '<div class="empty-state">No hay solicitudes pendientes. Usa “Crear solicitud demo local” para probar el flujo de aprobación.</div>';
      return;
    }
    wrap.innerHTML = '';
    pending.forEach(req => {
      const card = document.createElement('article');
      card.className = 'request-card';
      card.innerHTML = `
        <div>
          <strong>${escapeHtml([req.nom, req.cognoms].filter(Boolean).join(' ') || req.nom_public || req.id)}</strong>
          <p>${escapeHtml([req.poble, req.modalitat, req.email, req.idioma].filter(Boolean).join(' · '))}</p>
          <p>${escapeHtml(req.motiu || req.comentari || '')}</p>
        </div>
        <div class="request-actions">
          <button type="button" class="btn" data-convert="${escapeHtml(req.id)}">Convertir a héroe</button>
          <button type="button" class="btn btn-danger" data-reject="${escapeHtml(req.id)}">Rechazar</button>
        </div>`;
      wrap.appendChild(card);
    });
  }

  function renderAll() {
    ['herois', 'pobles', 'patrocinadors'].forEach(renderList);
    renderRequests();
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function selectItem(type, id) {
    state.selected[type] = id;
    const item = items(type).find(x => x.id === id) || CONFIG[type].empty();
    fillForm(type, item);
    renderList(type);
  }

  function fillForm(type, item) {
    const cfg = CONFIG[type];
    const form = cfg.form;
    if (!form) return;
    form.reset();
    state.images[type] = null;
    $$('input, textarea, select', form).forEach(input => {
      if (input.type === 'file') return;
      if (input.type === 'checkbox') {
        if (input.name === 'aporta') input.checked = Array.isArray(item.aporta) && item.aporta.includes(input.value);
        else input.checked = !!get(item, input.name);
        return;
      }
      const val = get(item, input.name);
      if (val !== undefined && val !== null) input.value = val;
    });
    const preview = cfg.preview;
    if (preview) {
      const src = item.foto || item.logo;
      preview.hidden = !src;
      if (src) preview.src = '../' + src.replace(/^\.\.\//, '');
    }
  }

  function readForm(type) {
    const cfg = CONFIG[type];
    const form = cfg.form;
    const item = {};
    $$('input, textarea, select', form).forEach(input => {
      if (input.type === 'file') return;
      if (input.name === 'aporta') return;
      if (input.type === 'checkbox') {
        set(item, input.name, input.checked);
        return;
      }
      if (input.name) set(item, input.name, input.value.trim());
    });
    if (type === 'pobles') {
      item.aporta = $$('input[name="aporta"]:checked', form).map(x => x.value);
      item.dia = Number(item.dia || 1);
      item.km = Number(item.km || 0);
      if (!item.embaixador || !item.embaixador.nom) item.embaixador = null;
    }
    if (type === 'patrocinadors' && item.km !== undefined && item.km !== '') item.km = Number(item.km);
    if (!item.id) item.id = slugify(item.nom || item.organitzacio || item.municipi || 'item');
    return clean(item);
  }

  async function saveType(type, requestId) {
    const cfg = CONFIG[type];
    const item = readForm(type);
    const payload = requestId
      ? { action: 'approve-request', requestId, item, image: state.images[type] }
      : { action: 'save', type, item, image: state.images[type] };

    cfg.form.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      const res = await apiPost(payload);
      const savedId = requestId ? (res.result && res.result.hero && res.result.hero.id) : (res.result && res.result.item && res.result.item.id);
      if (requestId) state.pendingRequestId = null;
      await loadType(type);
      if (requestId) await loadType('solicitudes');
      state.selected[type] = savedId || item.id;
      renderAll();
      notify(requestId ? 'Solicitud aprobada y héroe guardado.' : 'Guardado correctamente.');
    } catch (err) {
      notify(err.message, true);
    } finally {
      cfg.form.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  }

  async function deleteType(type) {
    const id = state.selected[type] || CONFIG[type].form.elements.id.value;
    if (!id) return notify('No hay elemento seleccionado para eliminar.', true);
    if (!confirm('¿Eliminar “' + id + '” del JSON? Esta acción no borra la imagen.')) return;
    try {
      await apiPost({ action: 'delete', type, id });
      state.selected[type] = null;
      await loadType(type);
      renderList(type);
      notify('Eliminado.');
    } catch (err) {
      notify(err.message, true);
    }
  }

  async function convertRequest(id) {
    try {
      const res = await apiPost({ action: 'request-to-hero', requestId: id });
      state.pendingRequestId = id;
      switchTab('herois');
      fillForm('herois', res.hero);
      notify('Solicitud cargada como borrador. Revisa textos/foto y pulsa “Guardar héroe” para aprobar.');
    } catch (err) {
      notify(err.message, true);
    }
  }

  async function rejectRequest(id) {
    if (!confirm('¿Marcar esta solicitud como rechazada/eliminada de la bandeja local?')) return;
    try {
      await apiPost({ action: 'delete', type: 'solicitudes', id });
      await loadType('solicitudes');
      renderRequests();
      notify('Solicitud retirada de la bandeja.');
    } catch (err) {
      notify(err.message, true);
    }
  }

  async function seedRequest() {
    try {
      await apiPost({ action: 'seed-request' });
      await loadType('solicitudes');
      renderRequests();
      notify('Solicitud demo creada.');
    } catch (err) {
      notify(err.message, true);
    }
  }

  function newItem(type) {
    state.pendingRequestId = null;
    state.selected[type] = null;
    fillForm(type, CONFIG[type].empty());
    $$('.item-button', CONFIG[type].list).forEach(btn => btn.classList.remove('is-selected'));
  }

  function switchTab(tab) {
    state.tab = tab;
    $$('.tab-btn').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tab === tab));
    $$('.panel').forEach(panel => panel.classList.toggle('is-active', panel.dataset.panel === tab));
  }

  function setupTabs() {
    $$('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    $$('[data-new]').forEach(btn => btn.addEventListener('click', () => newItem(btn.dataset.new)));
    $$('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteType(btn.dataset.delete)));
    $('#reloadBtn').addEventListener('click', loadAll);
    $('#seedRequestBtn').addEventListener('click', seedRequest);
    $('#requestsList').addEventListener('click', e => {
      const convert = e.target.closest('[data-convert]');
      if (convert) return convertRequest(convert.dataset.convert);
      const reject = e.target.closest('[data-reject]');
      if (reject) return rejectRequest(reject.dataset.reject);
    });
  }

  function setupForms() {
    Object.entries(CONFIG).forEach(([type, cfg]) => {
      cfg.form.addEventListener('submit', e => {
        e.preventDefault();
        const requestId = type === 'herois' ? state.pendingRequestId : null;
        saveType(type, requestId);
      });
      const nameInput = cfg.form.elements.nom;
      const idInput = cfg.form.elements.id;
      if (nameInput && idInput) {
        nameInput.addEventListener('input', () => {
          if (!state.selected[type] && !idInput.value) idInput.value = slugify(nameInput.value);
        });
      }
      const file = cfg.form.elements.image;
      if (file) {
        file.addEventListener('change', () => handleImage(type, file.files && file.files[0]));
      }
    });
  }

  async function handleImage(type, file) {
    if (!file) {
      state.images[type] = null;
      return;
    }
    try {
      const dataUrl = await imageToWebpDataUrl(file, type === 'patrocinadors' ? 700 : 900);
      state.images[type] = { filename: file.name.replace(/\.[^.]+$/, '.webp'), dataUrl };
      const preview = CONFIG[type].preview;
      if (preview) {
        preview.src = dataUrl;
        preview.hidden = false;
      }
    } catch (err) {
      notify('No se pudo procesar la imagen: ' + err.message, true);
    }
  }

  function imageToWebpDataUrl(file, maxSize) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('lectura fallida'));
      reader.onload = () => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
          canvas.width = Math.max(1, Math.round(img.width * ratio));
          canvas.height = Math.max(1, Math.round(img.height * ratio));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/webp', 0.84));
        };
        img.onerror = () => reject(new Error('imagen no válida'));
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function setupToken() {
    const input = $('#adminTokenInput');
    input.value = state.token;
    $('#saveTokenBtn').addEventListener('click', () => {
      state.token = input.value.trim();
      localStorage.removeItem('lxd-admin-token');
      if (state.token) sessionStorage.setItem('lxd-admin-token', state.token);
      else sessionStorage.removeItem('lxd-admin-token');
      notify('Token guardado solo para esta sesión.');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupForms();
    setupToken();
    loadAll();
  });
})();
