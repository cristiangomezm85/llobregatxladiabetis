/* LXD · language + form sync (safe)
   - Mantiene un campo oculto "idioma" en los formularios Netlify.
   - Sincroniza accesibilidad/SEO ligero por idioma activo sin usar hidden/inert.
   - No toca el selector original de idioma de la web.
 */
(function () {
  'use strict';
  if (window.__LXD_LANG_SYNC__) return;
  window.__LXD_LANG_SYNC__ = true;

  const LABELS = {
    ca: { label: 'Idioma', title: 'Idioma del formulari' },
    es: { label: 'Idioma', title: 'Idioma del formulario' },
    en: { label: 'Language', title: 'Form language' },
  };

  const LANG_CODES = { ca: 'CA', es: 'ES', en: 'EN' };
  const CODE_TO_LANG = { CA: 'ca', ES: 'es', EN: 'en' };

  const SEO = {
    'index.html': {
      title: {
        ca: 'Llobregat x la Diabetis · Repte solidari · 16–18 octubre 2026',
        es: 'Llobregat x la Diabetes · Reto solidario · 16–18 octubre 2026',
        en: 'Llobregat for Diabetes · Charity challenge · 16–18 October 2026',
      },
      desc: {
        ca: '180 km corrent del naixement del Llobregat fins al mar per visibilitzar la diabetis tipus 1 i recaptar fons per a AREDI.',
        es: '180 km corriendo desde el nacimiento del Llobregat hasta el mar para visibilizar la diabetes tipo 1 y recaudar fondos para AREDI.',
        en: 'A 180 km charity challenge along the Llobregat river to raise awareness of type 1 diabetes and funds for AREDI.',
      },
    },
    'el-repte.html': {
      title: {
        ca: 'El Repte · Llobregat x la Diabetis',
        es: 'El Reto · Llobregat x la Diabetes',
        en: 'The Challenge · Llobregat for Diabetes',
      },
      desc: {
        ca: '180 km pel riu Llobregat en tres dies per visibilitzar la diabetis tipus 1 i recaptar fons per a AREDI.',
        es: '180 km por el río Llobregat en tres días para visibilizar la diabetes tipo 1 y recaudar fondos para AREDI.',
        en: '180 km along the Llobregat river over three days to raise awareness of type 1 diabetes and funds for AREDI.',
      },
    },
    'persones.html': {
      title: {
        ca: 'Persones · Llobregat x la Diabetis',
        es: 'Personas · Llobregat x la Diabetes',
        en: 'People · Llobregat for Diabetes',
      },
      desc: {
        ca: 'Herois, heroïnes, participants i equips que se sumen al repte solidari del Llobregat.',
        es: 'Héroes, heroínas, participantes y equipos que se suman al reto solidario del Llobregat.',
        en: 'Heroes, heroines, participants and teams joining the Llobregat charity challenge.',
      },
    },
    'pobles.html': {
      title: {
        ca: 'Pobles del Llobregat Solidari · Llobregat x la Diabetis',
        es: 'Pueblos del Llobregat Solidario · Llobregat x la Diabetes',
        en: 'Solidarity Llobregat Towns · Llobregat for Diabetes',
      },
      desc: {
        ca: 'Municipis i punts del recorregut que poden adherir-se al repte solidari del Llobregat.',
        es: 'Municipios y puntos del recorrido que pueden adherirse al reto solidario del Llobregat.',
        en: 'Towns and route points that can join the Llobregat charity challenge.',
      },
    },
    'patrocina.html': {
      title: {
        ca: 'Patrocina el repte · Llobregat x la Diabetis',
        es: 'Patrocina el reto · Llobregat x la Diabetes',
        en: 'Sponsor the challenge · Llobregat for Diabetes',
      },
      desc: {
        ca: 'Posa la teva marca al riu Llobregat i contribueix a la recerca en diabetis tipus 1.',
        es: 'Pon tu marca en el río Llobregat y contribuye a la investigación en diabetes tipo 1.',
        en: 'Put your brand on the Llobregat river and support type 1 diabetes research.',
      },
    },
    'patrocinadors.html': {
      title: {
        ca: 'Patrocinadors · Llobregat x la Diabetis',
        es: 'Patrocinadores · Llobregat x la Diabetes',
        en: 'Sponsors · Llobregat for Diabetes',
      },
      desc: {
        ca: 'Empreses, institucions i aliances que fan possible el repte solidari del Llobregat.',
        es: 'Empresas, instituciones y alianzas que hacen posible el reto solidario del Llobregat.',
        en: 'Companies, institutions and partners making the Llobregat charity challenge possible.',
      },
    },
  };

  function normaliseLang(value) {
    const raw = String(value || '').slice(0, 2).toLowerCase();
    return raw === 'es' || raw === 'en' ? raw : 'ca';
  }

  function activeLang() {
    const html = document.documentElement;
    let saved = '';
    try { saved = localStorage.getItem('llxd-lang') || ''; } catch (_) {}
    return normaliseLang(html.getAttribute('data-lang') || html.getAttribute('lang') || saved || 'ca');
  }

  function pageKey() {
    const last = (location.pathname.split('/').filter(Boolean).pop() || 'index.html').toLowerCase();
    return last || 'index.html';
  }

  function ensureMeta(selector, attrs) {
    let el = document.head && document.head.querySelector(selector);
    if (!el && document.head) {
      el = document.createElement('meta');
      Object.entries(attrs || {}).forEach(([key, value]) => el.setAttribute(key, value));
      document.head.appendChild(el);
    }
    return el;
  }

  function syncSeoTags(lang) {
    const seo = SEO[pageKey()] || SEO['index.html'];
    const title = seo.title[lang] || seo.title.ca;
    const desc = seo.desc[lang] || seo.desc.ca;
    if (title) document.title = title;
    const metaDesc = ensureMeta('meta[name="description"]', { name: 'description' });
    if (metaDesc && desc) metaDesc.setAttribute('content', desc);
    const ogTitle = ensureMeta('meta[property="og:title"]', { property: 'og:title' });
    if (ogTitle && title) ogTitle.setAttribute('content', title);
    const ogDesc = ensureMeta('meta[property="og:description"]', { property: 'og:description' });
    if (ogDesc && desc) ogDesc.setAttribute('content', desc);
    const twitterTitle = ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title' });
    if (twitterTitle && title) twitterTitle.setAttribute('content', title);
    const twitterDesc = ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description' });
    if (twitterDesc && desc) twitterDesc.setAttribute('content', desc);
  }

  function ensureStyle() {
    if (document.getElementById('lxd-lang-sync-style')) return;
    const style = document.createElement('style');
    style.id = 'lxd-lang-sync-style';
    style.textContent = `
      .lxd-language-field { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  function isNetlifyForm(form) {
    return form && form.tagName === 'FORM' && (
      form.getAttribute('data-netlify') === 'true' ||
      form.hasAttribute('netlify') ||
      !!form.querySelector('input[name="form-name"]')
    );
  }

  function createOption(value, label) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    return opt;
  }

  function ensureLanguageField(form) {
    if (!isNetlifyForm(form)) return;
    let control = form.querySelector('input[name="idioma"]');

    // Si versiones anteriores dejaron un desplegable visible, lo sustituimos por un hidden.
    const visibleControl = form.querySelector('select[name="idioma"]');
    if (visibleControl) {
      const oldValue = visibleControl.value;
      const wrapper = visibleControl.closest('.lxd-language-field');
      control = document.createElement('input');
      control.type = 'hidden';
      control.name = 'idioma';
      if (oldValue && CODE_TO_LANG[String(oldValue).toUpperCase()]) control.value = String(oldValue).toUpperCase();
      if (wrapper && wrapper.parentNode) wrapper.parentNode.replaceChild(control, wrapper);
      else visibleControl.parentNode.replaceChild(control, visibleControl);
    }

    if (!control) {
      control = document.createElement('input');
      control.type = 'hidden';
      control.name = 'idioma';
      const anchor = form.querySelector('input[name="form-name"]') || form.querySelector('input[name="bot-field"]');
      if (anchor && anchor.parentNode === form && anchor.nextSibling) form.insertBefore(control, anchor.nextSibling);
      else form.insertBefore(control, form.firstChild);
    }
  }

  function syncFragmentAccessibility(lang) {
    // La visibilidad visual ya la controla el CSS existente con [data-lang].
    // Aquí ayudamos a lectores de pantalla y evitamos que anuncien los idiomas inactivos.
    document.querySelectorAll('[lang="ca"], [lang="es"], [lang="en"]').forEach(el => {
      if (el === document.documentElement) return;
      if (el.getAttribute('lang') === lang) el.removeAttribute('aria-hidden');
      else el.setAttribute('aria-hidden', 'true');
    });
  }

  function syncFormLanguage(lang) {
    const code = LANG_CODES[lang] || 'CA';
    document.querySelectorAll('form').forEach(ensureLanguageField);
    document.querySelectorAll('input[name="idioma"]').forEach(control => {
      control.value = code;
      control.defaultValue = code;
    });
  }

  function resetManualLanguageFields(form) {
    if (!form) return;
    form.querySelectorAll('select[name="idioma"], input[name="idioma"]').forEach(control => {
      delete control.dataset.lxdManual;
    });
  }

  let scheduled = false;
  function syncAll() {
    scheduled = false;
    ensureStyle();
    const lang = activeLang();
    syncSeoTags(lang);
    syncFragmentAccessibility(lang);
    syncFormLanguage(lang);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || window.setTimeout)(syncAll, 0);
  }

  document.addEventListener('DOMContentLoaded', scheduleSync);
  window.addEventListener('pageshow', scheduleSync);
  document.addEventListener('submit', scheduleSync, true);
  document.addEventListener('reset', event => {
    resetManualLanguageFields(event.target);
    setTimeout(scheduleSync, 0);
  }, true);

  new MutationObserver(scheduleSync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-lang', 'lang'],
  });

  function observeBody() {
    if (!document.body) return;
    new MutationObserver(mutations => {
      if (mutations.some(m => m.addedNodes && m.addedNodes.length)) scheduleSync();
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) observeBody();
  else document.addEventListener('DOMContentLoaded', observeBody, { once: true });

  scheduleSync();
})();
