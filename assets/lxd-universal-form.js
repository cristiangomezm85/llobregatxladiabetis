/* LXD · Universal form router
   - Redirige los CTA antiguos al formulario universal.
   - Preselecciona el tipo de solicitud según el botón pulsado.
   - Bloquea la inscripción de participantes hasta que se abra oficialmente.
 */
(function () {
  'use strict';
  if (window.__LXD_UNIVERSAL_FORM__) return;
  window.__LXD_UNIVERSAL_FORM__ = true;

  const TYPES = new Set(['newsletter', 'heroi', 'colla', 'poble', 'patrocini', 'colaborador', 'participant', 'contacte']);
  const TYPE_MAP = {
    newsletter: 'newsletter',
    heroi: 'heroi',
    hero: 'heroi',
    colla: 'colla',
    equip: 'colla',
    equipo: 'colla',
    team: 'colla',
    pobles: 'poble',
    poble: 'poble',
    town: 'poble',
    patrocini: 'patrocini',
    patrocinio: 'patrocini',
    sponsor: 'patrocini',
    colaborador: 'colaborador',
    collaborador: 'colaborador',
    'col·laborador': 'colaborador',
    voluntari: 'colaborador',
    voluntariado: 'colaborador',
    voluntariat: 'colaborador',
    voluntario: 'colaborador',
    volunteer: 'colaborador',
    participant: 'participant',
    participants: 'participant',
    contacto: 'contacte',
    contact: 'contacte',
    contacte: 'contacte',
    universal: ''
  };

  const TITLE = {
    ca: 'Suma\'t al Llobregat x la Diabetis',
    es: 'Súmate al Llobregat x la Diabetes',
    en: 'Join Llobregat for Diabetes'
  };

  function activeLang() {
    const raw = (document.documentElement.getAttribute('data-lang') || document.documentElement.getAttribute('lang') || 'ca').slice(0, 2).toLowerCase();
    return raw === 'es' || raw === 'en' ? raw : 'ca';
  }

  function mapType(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (TYPES.has(raw)) return raw;
    return TYPE_MAP[raw] || '';
  }

  function setDrawerTitle() {
    const title = document.getElementById('lxd-drawer-title');
    if (!title) return;
    title.innerHTML = '<span lang="ca">' + TITLE.ca + '</span><span lang="es">' + TITLE.es + '</span><span lang="en">' + TITLE.en + '</span>';
  }

  function setControlsDisabled(container, disabled) {
    if (!container) return;
    container.querySelectorAll('input, select, textarea, button').forEach(control => {
      if (control.matches('[data-universal-type], [data-universal-submit]')) return;
      control.disabled = !!disabled;
      if (disabled) control.required = false;
    });
  }

  function requiredApplies(rule, type, showCommon) {
    if (!showCommon || !rule) return false;
    const rules = String(rule).split(/[\s,]+/).filter(Boolean);
    return rules.some(r => {
      if (r === 'always') return true;
      if (r === 'non-newsletter') return type && type !== 'newsletter';
      return r === type;
    });
  }

  function updateRequiredMarks(form, type, showCommon) {
    form.querySelectorAll('[data-required-mark]').forEach(mark => {
      mark.hidden = !requiredApplies(mark.dataset.requiredMark, type, showCommon);
    });
  }

  function updateSubmitNote(form, type, blocked) {
    const note = form.querySelector('[data-universal-submit-note]');
    if (!note) return;
    if (!type) {
      note.innerHTML = '<span lang="ca">Tria una opció per començar.</span><span lang="es">Elige una opción para empezar.</span><span lang="en">Choose an option to start.</span>';
    } else if (blocked) {
      note.innerHTML = '<span lang="ca">Inscripció de participants encara no oberta. Properament.</span><span lang="es">Inscripción de participantes todavía no abierta. Próximamente.</span><span lang="en">Participant registration is not open yet. Coming soon.</span>';
    } else if (type === 'patrocini') {
      note.innerHTML = '<span lang="ca">Revisarem la proposta i et contactarem per concretar el patrocini.</span><span lang="es">Revisaremos la propuesta y te contactaremos para concretar el patrocinio.</span><span lang="en">We will review the proposal and contact you to arrange the sponsorship.</span>';
    } else {
      note.innerHTML = '<span lang="ca">Revisarem la sol·licitud i et contactarem.</span><span lang="es">Revisaremos la solicitud y te contactaremos.</span><span lang="en">We will review the request and contact you.</span>';
    }
    // Reaplica accesibilidad por idioma si el sincronizador está activo.
    setTimeout(() => document.documentElement.dispatchEvent(new Event('lxd-universal-updated')), 0);
  }

  function updateUniversalForm(form) {
    if (!form) return;
    const typeSelect = form.querySelector('[data-universal-type]');
    const type = mapType(typeSelect && typeSelect.value);
    const blocked = type === 'participant';
    const showCommon = !!type && !blocked;

    const common = form.querySelector('[data-universal-common]');
    if (common) common.hidden = !showCommon;
    setControlsDisabled(common, !showCommon);

    form.querySelectorAll('[data-universal-section]').forEach(section => {
      const show = section.dataset.universalSection === type;
      section.hidden = !show;
      setControlsDisabled(section, !show);
    });

    const consent = form.querySelector('[data-universal-consent]');
    if (consent) {
      consent.hidden = !showCommon;
      setControlsDisabled(consent, !showCommon);
    }
    form.querySelectorAll('[data-universal-required]').forEach(control => {
      if (control.disabled) {
        control.required = false;
        return;
      }
      control.required = requiredApplies(control.dataset.universalRequired, type, showCommon);
    });

    updateRequiredMarks(form, type, showCommon);

    form.querySelectorAll('[data-tram-select]').forEach(select => {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const submit = form.querySelector('[data-universal-submit]');
    if (submit) submit.disabled = !type || blocked;
    updateSubmitNote(form, type, blocked);
  }

  function findUniversalForm() {
    return document.querySelector('form[data-universal-form]');
  }

  function applyPreselection(type, opts) {
    const form = findUniversalForm();
    if (!form) return;
    const mapped = mapType(type);
    const typeSelect = form.querySelector('[data-universal-type]');
    if (typeSelect) {
      typeSelect.value = mapped || '';
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    updateUniversalForm(form);

    if ((mapped === 'patrocini') && opts && opts.nivell) {
      const nivell = form.querySelector('[data-patro-nivell]');
      if (nivell) {
        nivell.value = opts.nivell;
        nivell.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    setDrawerTitle();
    setTimeout(() => {
      const target = form.querySelector('[data-universal-type]') || form.querySelector('input:not([type=hidden]), select, textarea');
      if (target) target.focus({ preventScroll: true });
    }, 80);
  }

  function openUniversal(type, opts) {
    opts = opts || {};
    if (typeof window.lxdOpenDrawer === 'function') {
      window.lxdOpenDrawer('universal', opts);
      setTimeout(() => applyPreselection(type, opts), 40);
      setTimeout(() => applyPreselection(type, opts), 220);
    } else {
      applyPreselection(type, opts);
    }
  }

  function initForms(root) {
    (root || document).querySelectorAll('form[data-universal-form]').forEach(form => {
      if (form.dataset.universalReady === '1') return;
      form.dataset.universalReady = '1';
      const typeSelect = form.querySelector('[data-universal-type]');
      if (typeSelect) typeSelect.addEventListener('change', () => updateUniversalForm(form));
      form.addEventListener('reset', () => setTimeout(() => updateUniversalForm(form), 0));
      form.addEventListener('submit', e => {
        const type = mapType(typeSelect && typeSelect.value);
        if (!type || type === 'participant') {
          e.preventDefault();
          e.stopPropagation();
          updateUniversalForm(form);
        }
      }, true);
      updateUniversalForm(form);
    });
  }

  document.addEventListener('click', e => {
    const popup = e.target.closest('[data-open-popup="newsletter"]');
    if (popup) {
      e.preventDefault();
      e.stopPropagation();
      openUniversal('newsletter');
      return;
    }

    const drawerEl = e.target.closest('[data-open-drawer], [data-role-cta]');
    if (drawerEl) {
      const rawId = drawerEl.dataset.openDrawer || drawerEl.dataset.roleCta;
      const explicitUniversal = drawerEl.hasAttribute('data-universal-type') || rawId === 'universal';
      if (!explicitUniversal && (rawId === 'colla' || rawId === 'equip' || rawId === 'equipo')) return;
      const mapped = mapType(drawerEl.dataset.universalType || rawId);
      if (mapped || rawId === 'universal') {
        e.preventDefault();
        e.stopPropagation();
        const opts = {};
        if (drawerEl.dataset.nivell) opts.nivell = drawerEl.dataset.nivell;
        openUniversal(mapped, opts);
      }
      return;
    }

    const formLink = e.target.closest('a[href^="#form-"]');
    if (formLink) {
      const m = formLink.getAttribute('href').match(/^#form-(\w+)/);
      const mapped = m && mapType(m[1]);
      if (mapped && m[1] !== 'colla') {
        e.preventDefault();
        e.stopPropagation();
        openUniversal(mapped);
      }
    }
  }, true);

  function handleHashUniversal() {
    const hash = window.location.hash || '';
    const m = hash.match(/^#open=(\w+)(?:&(.+))?$/);
    if (!m) return;
    const type = mapType(m[1]);
    const params = {};
    if (m[2]) {
      m[2].split('&').forEach(pair => {
        const parts = pair.split('=');
        if (parts[0]) params[parts[0]] = decodeURIComponent(parts.slice(1).join('=') || '');
      });
    }
    if (type || m[1] === 'universal') {
      setTimeout(() => openUniversal(type || params.tipo || '', params), 260);
      setTimeout(() => history.replaceState(null, '', window.location.pathname + window.location.search), 360);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initForms(document);
    handleHashUniversal();
  });
  window.addEventListener('pageshow', () => initForms(document));
  window.addEventListener('hashchange', handleHashUniversal);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node && node.nodeType === 1) initForms(node);
      });
    }
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }), { once: true });

  window.lxdOpenUniversalForm = openUniversal;
})();
