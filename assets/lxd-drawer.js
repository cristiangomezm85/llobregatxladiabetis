/* LXD · Drawer + Tram + Forms (auto-generat)
   Conté: tram selector amb pobles.json, municipi select, forms submit AJAX,
   drawer/popup overlay logic. Tot en un sol IIFE. */

(function() {
  'use strict';


  // FORM OPTIONS — mostra només el text de l'idioma actiu als <option>.
  // Suporta tant "CA · ES · EN" com "CA — ES — EN".
  const LXD_LANG_INDEX = { ca: 0, es: 1, en: 2 };
  function lxdActiveLang() {
    return document.documentElement.getAttribute('data-lang') || document.documentElement.getAttribute('lang') || 'ca';
  }
  function lxdOptionTranslation(opt, lang) {
    const key = 'i18n' + lang.charAt(0).toUpperCase() + lang.slice(1);
    if (opt.dataset[key]) return opt.dataset[key];
    if (opt.dataset.i18nCa || opt.dataset.i18nEs || opt.dataset.i18nEn) {
      return opt.dataset[key] || opt.dataset.i18nCa || opt.textContent;
    }

    const original = (opt.dataset.i18nOriginal || opt.textContent || '').trim();
    opt.dataset.i18nOriginal = original;
    let parts = original.split(/\s+—\s+/);
    if (parts.length < 3) parts = original.split(/\s+·\s+/);
    if (parts.length >= 3) {
      opt.dataset.i18nCa = parts[0].trim();
      opt.dataset.i18nEs = parts[1].trim();
      opt.dataset.i18nEn = parts.slice(2).join(' — ').trim();
      return opt.dataset[key] || opt.dataset.i18nCa;
    }
    return original;
  }
  function lxdSyncOptionLanguage() {
    const lang = lxdActiveLang();
    document.querySelectorAll('option[data-i18n-options], option[data-i18n-ca], option[data-i18n-es], option[data-i18n-en]').forEach(opt => {
      opt.textContent = lxdOptionTranslation(opt, lang);
    });
  }
  lxdSyncOptionLanguage();
  document.addEventListener('DOMContentLoaded', lxdSyncOptionLanguage);
  new MutationObserver(lxdSyncOptionLanguage).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-lang', 'lang']
  });

  // TRAM SELECTOR — versió unificada (JSON pobles)
  // Soporta múltiples blocs data-tram-block al DOM.
  // ============================================
  const TRAM_TOTALS = { 1: 62, 2: 75, 3: 69 };
  const TRAM_FULL_ROUTE_KM = 180;

  // Cache per al fitxer pobles.json
  let __poblesData = null;
  let __poblesPromise = null;
  function loadPobles() {
    if (__poblesData) return Promise.resolve(__poblesData);
    if (__poblesPromise) return __poblesPromise;
    __poblesPromise = fetch('pobles.json')
      .then(r => r.json())
      .then(d => {
        __poblesData = d.pobles || [];
        return __poblesData;
      })
      .catch(err => {
        console.warn('No s\'ha pogut carregar pobles.json', err);
        __poblesData = [];
        return [];
      });
    return __poblesPromise;
  }

  // Retorna els municipis d'un dia donat, ordenats per km
  function pobllesByDay(pobles, dia) {
    return pobles
      .filter(p => p.dia === Number(dia))
      .sort((a, b) => a.km - b.km);
  }

  // Omple un select amb una llista de punts (objects {id, nom, km})
  function fillSelect(sel, items, placeholder = '—', formatLabel = null) {
    if (!sel || sel.tagName !== 'SELECT') return;
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = placeholder;
    sel.appendChild(opt0);
    items.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id;
      o.dataset.km = p.km;
      o.dataset.dia = p.dia;
      o.textContent = formatLabel ? formatLabel(p) : `${p.nom} (km ${p.km})`;
      sel.appendChild(o);
    });
  }

  // === Inicialitza tots els blocs tram al DOM ===
  function initTramBlock(block) {
    if (block.dataset.tramInit === '1') return;
    block.dataset.tramInit = '1';

    const prefix = block.dataset.tramPrefix;
    const select = block.querySelector('[data-tram-select]');
    if (!select) return;

    // Sub-blocs: scoped al mateix bloc/section per suportar diversos selectors de tram dins un mateix form.
    const form = block.closest('form');
    const scope = block.closest('[data-universal-section]') || block.closest('.form-grid') || form;
    const subTramConcret = scope.querySelector(`[data-tram-sub="tram-concret"]`);
    const subLlocFix = scope.querySelector(`[data-tram-sub="lloc-fix"]`);

    const diaIniciSel = scope.querySelector('[data-tram-dia-inici]');
    const iniciSel = scope.querySelector('[data-tram-inici]');
    const diaFinalSel = scope.querySelector('[data-tram-dia-final]');
    const finalSel = scope.querySelector('[data-tram-final]');
    const llocFixSel = scope.querySelector('[data-tram-lloc-fix]');
    const kmBlock = scope.querySelector('[data-tram-km]');
    const kmVal = scope.querySelector('[data-tram-km-value]');
    const errBlock = scope.querySelector('[data-tram-error]');

    function updateSubVisibility() {
      const v = select.value;
      const isTramConcret = (v === 'tram-concret');
      const isLlocFix = (v === 'lloc-fix');

      if (subTramConcret) subTramConcret.hidden = !isTramConcret;
      if (subLlocFix) subLlocFix.hidden = !isLlocFix;

      const tramConcretReq = isTramConcret;
      if (diaIniciSel) {
        diaIniciSel.required = tramConcretReq;
        diaIniciSel.disabled = !isTramConcret;
        if (!isTramConcret) diaIniciSel.value = '';
      }
      if (iniciSel) {
        iniciSel.required = tramConcretReq;
        iniciSel.disabled = !isTramConcret || !(diaIniciSel && diaIniciSel.value);
        if (!isTramConcret) { iniciSel.value = ''; fillSelect(iniciSel, []); }
      }
      if (diaFinalSel) {
        diaFinalSel.required = tramConcretReq;
        diaFinalSel.disabled = !isTramConcret || !(diaIniciSel && diaIniciSel.value);
        if (!isTramConcret) diaFinalSel.value = '';
      }
      if (finalSel) {
        finalSel.required = tramConcretReq;
        finalSel.disabled = !isTramConcret || !(diaFinalSel && diaFinalSel.value);
        if (!isTramConcret) { finalSel.value = ''; fillSelect(finalSel, []); }
      }
      if (llocFixSel) {
        llocFixSel.required = isLlocFix;
        llocFixSel.disabled = !isLlocFix;
        if (!isLlocFix) llocFixSel.value = '';
      }
      if (!isTramConcret) {
        if (kmBlock) kmBlock.hidden = true;
        if (errBlock) errBlock.hidden = true;
      }
    }

    function populateMunicipisFor(selectEl, dia) {
      return loadPobles().then(pobles => {
        const items = pobllesByDay(pobles, dia);
        if (selectEl) {
          fillSelect(selectEl, items);
          selectEl.disabled = (select.value !== 'tram-concret') || items.length === 0;
        }
        return items;
      });
    }

    function populateLlocFix() {
      if (!llocFixSel || llocFixSel.tagName !== 'SELECT') return;
      loadPobles().then(pobles => {
        const items = pobles
          .filter(p => p.tipus === 'municipi' || p.tipus === 'nucli')
          .slice()
          .sort((a, b) => (a.dia - b.dia) || (a.km - b.km));
        fillSelect(llocFixSel, items, '—', p => `${p.nom} · Dia ${p.dia} · km ${p.km}`);
      });
    }

    // Quan tries dia-inici: omple municipi inici, també habilita dia-final
    function onDiaIniciChange() {
      if (!diaIniciSel || select.value !== 'tram-concret') return;
      const dia = diaIniciSel.value;
      if (!dia) {
        if (iniciSel) { iniciSel.disabled = true; iniciSel.value = ''; fillSelect(iniciSel, []); }
        if (diaFinalSel) { diaFinalSel.disabled = true; diaFinalSel.value = ''; }
        if (finalSel) { finalSel.disabled = true; finalSel.value = ''; fillSelect(finalSel, []); }
        recomputeKm();
        return;
      }
      populateMunicipisFor(iniciSel, dia);
      // Habilita el dia-final i deshabilita opcions < dia-inici
      if (diaFinalSel) {
        diaFinalSel.disabled = false;
        Array.from(diaFinalSel.options).forEach(opt => {
          if (!opt.value) return;
          opt.disabled = (Number(opt.value) < Number(dia));
        });
        // Si el dia-final actual queda invàlid, reset
        if (diaFinalSel.value && Number(diaFinalSel.value) < Number(dia)) {
          diaFinalSel.value = '';
          if (finalSel) { finalSel.value = ''; finalSel.disabled = true; fillSelect(finalSel, []); }
        } else if (diaFinalSel.value) {
          // Re-popular municipi final amb el mateix dia
          populateMunicipisFor(finalSel, diaFinalSel.value).then(() => refreshFinalOptions());
        }
      }
      recomputeKm();
    }

    function onDiaFinalChange() {
      if (!diaFinalSel || select.value !== 'tram-concret') return;
      const dia = diaFinalSel.value;
      if (!dia) {
        if (finalSel) { finalSel.disabled = true; finalSel.value = ''; fillSelect(finalSel, []); }
        recomputeKm();
        return;
      }
      populateMunicipisFor(finalSel, dia).then(() => refreshFinalOptions());
    }

    function refreshFinalOptions() {
      // Si dia-inici == dia-final, llavors municipi-final > municipi-inici (per km)
      if (select.value !== 'tram-concret' || !iniciSel || !finalSel || !diaIniciSel || !diaFinalSel) return;
      const dIni = diaIniciSel.value;
      const dFi = diaFinalSel.value;
      const iniciKm = (iniciSel.selectedOptions[0] && iniciSel.selectedOptions[0].value)
        ? Number(iniciSel.selectedOptions[0].dataset.km)
        : null;

      // Només deshabilita si mateix dia I km-inici està seleccionat
      if (dIni && dFi && dIni === dFi && iniciKm !== null) {
        Array.from(finalSel.options).forEach(opt => {
          if (!opt.value) { opt.disabled = false; return; }
          const km = Number(opt.dataset.km);
          opt.disabled = (km <= iniciKm);
        });
        if (finalSel.value) {
          const sel = finalSel.selectedOptions[0];
          if (sel && Number(sel.dataset.km) <= iniciKm) finalSel.value = '';
        }
      } else {
        // Dies diferents: totes les opcions del dia-final són vàlides
        Array.from(finalSel.options).forEach(opt => { opt.disabled = false; });
      }
    }

    function recomputeKm() {
      if (!kmBlock || !kmVal) return;
      const v = select.value;
      let km = null;
      let error = false;

      // La distància estimada es mostra per recorreguts amb distància definida.
      // Per "lloc fix" o "encara no ho sé" sempre queda amagada.
      if (!v || v === 'lloc-fix' || v === 'no-segur') {
        if (errBlock) errBlock.hidden = true;
        kmVal.textContent = '—';
        kmBlock.hidden = true;
        return;
      }

      if (v === 'tot') km = TRAM_FULL_ROUTE_KM;
      else if (v === 'dia-1') km = TRAM_TOTALS[1];
      else if (v === 'dia-2') km = TRAM_TOTALS[2];
      else if (v === 'dia-3') km = TRAM_TOTALS[3];
      else if (v === 'tram-concret') {
        if (diaIniciSel && diaFinalSel && iniciSel && finalSel
            && diaIniciSel.value && diaFinalSel.value
            && iniciSel.value && finalSel.value) {
          const dIni = Number(diaIniciSel.value);
          const dFi = Number(diaFinalSel.value);
          const kIni = Number(iniciSel.selectedOptions[0].dataset.km);
          const kFi = Number(finalSel.selectedOptions[0].dataset.km);

          if (dFi < dIni) { error = true; }
          else if (dFi === dIni) {
            if (kFi <= kIni) error = true;
            else km = kFi - kIni;
          } else {
            // Multi-dia: km del primer dia (des de kIni fins al total del dia)
            // + km dels dies intermedis sencers + km del dia final (de 0 a kFi)
            let total = TRAM_TOTALS[dIni] - kIni; // resta del dia inicial
            for (let d = dIni + 1; d < dFi; d++) {
              total += TRAM_TOTALS[d]; // dies sencers intermedis
            }
            total += kFi; // tram inicial del dia final
            km = total;
          }
        }
      }

      if (error) {
        if (errBlock) errBlock.hidden = false;
        kmVal.textContent = '—';
        kmBlock.hidden = true;
      } else {
        if (errBlock) errBlock.hidden = true;
        if (km != null) {
          kmVal.textContent = km + ' km';
          kmBlock.hidden = false;
        } else {
          kmVal.textContent = '—';
          kmBlock.hidden = true;
        }
      }
    }

    // Event listeners
    select.addEventListener('change', () => {
      updateSubVisibility();
      recomputeKm();
    });
    if (diaIniciSel) diaIniciSel.addEventListener('change', onDiaIniciChange);
    if (diaFinalSel) diaFinalSel.addEventListener('change', onDiaFinalChange);
    if (iniciSel) iniciSel.addEventListener('change', () => {
      refreshFinalOptions();
      recomputeKm();
    });
    if (finalSel) finalSel.addEventListener('change', recomputeKm);

    updateSubVisibility();
    recomputeKm();
  }

  // Inicialitza tots els blocs tram presents
  document.querySelectorAll('[data-tram-block]').forEach(initTramBlock);

  // ============================================
  // PARTICIPANT MODALITAT — si l'usuari tria voluntari/organització,
  // el tram pot quedar opcional. Mantenim aquesta lògica.
  // ============================================
  const participantModalitatSel = document.getElementById('ap-modalitat');
  const apTramSelect = document.getElementById('ap-tram');
  const tramlessModalitats = new Set(['organitzacio', 'voluntari-dia-d']);
  function syncParticipantTramRequirement() {
    if (!participantModalitatSel || !apTramSelect) return;
    const skip = tramlessModalitats.has(participantModalitatSel.value);
    apTramSelect.required = !skip;
    apTramSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (participantModalitatSel) {
    participantModalitatSel.addEventListener('change', syncParticipantTramRequirement);
    syncParticipantTramRequirement();
  }

  // ============================================
  // MUNICIPI DEL POBLE — desplegable des de pobles.json
  // ============================================
  document.querySelectorAll('[data-municipi-select]').forEach(sel => {
    loadPobles().then(pobles => {
      // Només municipis (no nuclis solts ni punts especials)
      const items = pobles
        .filter(p => p.tipus === 'municipi')
        .slice()
        .sort((a, b) => a.nom.localeCompare(b.nom, 'ca'));
      fillSelect(sel, items, '—', p => p.nom);
      // Permetre opció "Altre / no surt" al final, traduïda segons l'idioma actiu
      const opt = document.createElement('option');
      opt.value = '__altre__';
      opt.dataset.i18nCa = '— No el trobo / Altre municipi —';
      opt.dataset.i18nEs = '— No lo encuentro / Otro municipio —';
      opt.dataset.i18nEn = '— I can’t find it / Other town —';
      opt.textContent = lxdOptionTranslation(opt, lxdActiveLang());
      sel.appendChild(opt);
      lxdSyncOptionLanguage();
    });
  });

  // ============================================

  // FORM SUBMIT — Netlify Forms via AJAX (versió robusta)
  // - Event delegation al document: captura forms encara que es moguin al drawer.
  // - Feedback visible sempre (toast fallback si no troba data-form-status).
  // - En error: ofereix mailto fallback a info@llobregat.org amb les dades pre-omplertes.
  // ============================================
  function encodeForm(formData) {
    return new URLSearchParams(formData).toString();
  }

  function statusMessages(lang, kind) {
    const msgs = {
      ca: {
        sending: 'Enviant…',
        success: 'Gràcies! Hem rebut les teves dades. Et contactarem aviat.',
        successNewsletter: 'Subscripció confirmada! Rebràs les novetats del repte.',
        error: 'Alguna cosa no ha anat bé. Pots tornar-ho a provar o enviar les dades per email.',
        errorActionLabel: 'Envia per email',
      },
      es: {
        sending: 'Enviando…',
        success: '¡Gracias! Hemos recibido tus datos. Te contactaremos pronto.',
        successNewsletter: '¡Suscripción confirmada! Recibirás las novedades del reto.',
        error: 'Algo no ha ido bien. Puedes reintentarlo o enviar los datos por email.',
        errorActionLabel: 'Enviar por email',
      },
      en: {
        sending: 'Sending…',
        success: 'Thank you! We have received your details. We will get back to you soon.',
        successNewsletter: 'Subscription confirmed! You will receive challenge updates.',
        error: 'Something went wrong. You can try again or send the details by email.',
        errorActionLabel: 'Send by email',
      },
    };
    const l = (msgs[lang] || msgs.ca);
    return l[kind] || l.error;
  }

  function getActiveLang() {
    return document.documentElement.getAttribute('data-lang') || 'ca';
  }

  // Construeix mailto fallback amb totes les dades del form
  function buildMailtoFallback(formName, formData) {
    const lines = [];
    for (const [key, value] of formData.entries()) {
      if (key === 'form-name' || key === 'bot-field' || !value) continue;
      lines.push(key + ': ' + value);
    }
    const subject = '[LxD2026 · ' + formName + '] Enviament alternatiu per error tècnic';
    const body = 'Hola,\n\nNo s\'ha pogut enviar el formulari des de la web. Adjunto les dades:\n\n'
      + lines.join('\n')
      + '\n\nGràcies!';
    return 'mailto:info@llobregat.org?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body);
  }

  // Mostra un toast quan no hi ha statusEl visible al form
  function ensureToast() {
    let toast = document.getElementById('lxd-form-toast');
    if (toast) return toast;
    toast = document.createElement('div');
    toast.id = 'lxd-form-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'left:24px',
      'max-width:420px',
      'margin-left:auto',
      'background:#0E1B36',
      'color:white',
      'padding:1rem 1.25rem',
      'border-radius:12px',
      'box-shadow:0 16px 48px rgba(14,27,54,0.35)',
      'font-size:0.92rem',
      'line-height:1.4',
      'z-index:9999',
      'opacity:0',
      'transform:translateY(20px)',
      'transition:opacity 0.3s ease, transform 0.3s ease',
      'pointer-events:auto',
    ].join(';');
    document.body.appendChild(toast);
    return toast;
  }
  function showToast(text, kind, actionHref, actionLabel) {
    const toast = ensureToast();
    toast.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = text;
    toast.appendChild(span);
    if (actionHref) {
      toast.appendChild(document.createElement('br'));
      const a = document.createElement('a');
      a.href = actionHref;
      a.textContent = actionLabel || 'Email';
      a.style.cssText = 'color:#5AC0E6;text-decoration:underline;font-weight:600;margin-top:0.5rem;display:inline-block';
      toast.appendChild(a);
    }
    toast.style.background = kind === 'success' ? '#15315F'
      : kind === 'error' ? '#A8341A'
      : '#0E1B36';
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(toast._lxdTimer);
    toast._lxdTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
    }, actionHref ? 12000 : 6000);
  }

  // Pinta status al statusEl o cau a toast si no n'hi ha
  function paintStatus(statusEl, text, kind, mailtoHref, actionLabel) {
    if (!statusEl) {
      showToast(text, kind, mailtoHref, actionLabel);
      return;
    }
    statusEl.innerHTML = '';
    const txt = document.createElement('span');
    txt.textContent = text;
    statusEl.appendChild(txt);
    if (mailtoHref) {
      statusEl.appendChild(document.createTextNode(' '));
      const a = document.createElement('a');
      a.href = mailtoHref;
      a.textContent = actionLabel || 'Email';
      a.style.cssText = 'text-decoration:underline;font-weight:600;margin-left:0.3rem';
      statusEl.appendChild(a);
    }
    statusEl.className = (statusEl.className || '').replace(/\b(success|error|sending)\b/g, '').trim();
    if (kind) statusEl.classList.add(kind);
    // Garantir visibilitat
    statusEl.style.display = 'block';
    // Scroll suau cap a l'element del status
    try { statusEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(e) {}
  }

  function findStatusEl(form) {
    const isNewsletter = form.getAttribute('name') === 'newsletter';
    if (isNewsletter) {
      return form.querySelector('[data-newsletter-status]')
        || document.querySelector('[data-newsletter-status]');
    }
    // Primer dins el form, després el primer al document (per si està fora)
    return form.querySelector('[data-form-status]')
      || document.querySelector('[data-form-status]');
  }

  // === Event delegation al document: captura submits de qualsevol form Netlify,
  // estigui on estigui (a l'stash, dins del drawer, etc.)
  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    if (form.getAttribute('data-netlify') !== 'true') return;

    e.preventDefault();
    e.stopPropagation();

    const formName = form.getAttribute('name') || '';
    const isNewsletter = formName === 'newsletter';
    const lang = getActiveLang();

    // Bloca submits dobles
    if (form.dataset.submitting === '1') return;
    form.dataset.submitting = '1';

    const statusEl = findStatusEl(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    // Mostra "enviant…"
    paintStatus(statusEl, statusMessages(lang, 'sending'), 'sending');

    // Captura les dades AVANS d'intentar enviar (per al mailto fallback)
    const formDataForFallback = new FormData(form);
    if (!formDataForFallback.has('form-name') && formName) {
      formDataForFallback.append('form-name', formName);
    }

    try {
      const endpoint = form.getAttribute('action') || '/';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encodeForm(formDataForFallback),
      });

      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }

      // ÈXIT
      const successKey = isNewsletter ? 'successNewsletter' : 'success';
      paintStatus(statusEl, statusMessages(lang, successKey), 'success');

      // Reset suau (després d'un moment per donar temps a llegir el missatge)
      setTimeout(() => {
        try {
          form.reset();
          // Forçar refresh dels selects de tram (per amagar subcamps)
          form.querySelectorAll('[data-tram-select]').forEach(s => {
            s.dispatchEvent(new Event('change', { bubbles: true }));
          });
        } catch (resetErr) {
          console.warn('[LXD] form reset:', resetErr);
        }
      }, 600);

    } catch (err) {
      console.error('[LXD Form Submit] Failed for "' + formName + '":', err);
      const mailto = buildMailtoFallback(formName, formDataForFallback);
      paintStatus(
        statusEl,
        statusMessages(lang, 'error'),
        'error',
        mailto,
        statusMessages(lang, 'errorActionLabel')
      );
    } finally {
      form.dataset.submitting = '0';
      if (submitBtn) submitBtn.disabled = false;
    }
  }, true);  // true = captura fase, té prioritat sobre listeners directes al form

  // ============================================
  // COUNTDOWNS — donatius + inici del repte
  // ============================================
  const countdownBanners = document.querySelectorAll('[data-countdown-target]');

  function pad2(n) { return String(n).padStart(2, '0'); }

  function setCountdownOpenText(banner) {
    const kind = banner.getAttribute('data-countdown-kind');
    const translations = kind === 'event'
      ? {
          tag: { ca: 'En marxa', es: 'En marcha', en: 'Live' },
          label: { ca: 'El repte ja ha començat', es: 'El reto ya ha empezado', en: 'The challenge has started' },
          sublabel: { ca: 'Segueix les actualitzacions del recorregut i el track en temps real.', es: 'Sigue las actualizaciones del recorrido y el track en tiempo real.', en: 'Follow route updates and the real-time track.' },
        }
      : {
          tag: { ca: 'Obert', es: 'Abierto', en: 'Open' },
          label: { ca: 'Ja podem activar donatius i reptes personals', es: 'Ya podemos activar donativos y retos personales', en: 'Donations and personal challenges can now be activated' },
          sublabel: { ca: 'Ja pots donar o activar el teu repte personal a Mi Grano de Arena.', es: 'Ya puedes donar o activar tu reto personal en Mi Grano de Arena.', en: 'You can now donate or activate your personal challenge on Mi Grano de Arena.' },
        };

    banner.querySelectorAll('.countdown-banner-tag span').forEach(s => {
      const l = s.getAttribute('lang');
      if (translations.tag[l]) s.textContent = translations.tag[l];
    });
    banner.querySelectorAll('.countdown-banner-label span').forEach(s => {
      const l = s.getAttribute('lang');
      if (translations.label[l]) s.textContent = translations.label[l];
    });
    banner.querySelectorAll('.countdown-banner-sublabel span').forEach(s => {
      const l = s.getAttribute('lang');
      if (translations.sublabel[l]) s.textContent = translations.sublabel[l];
    });
    if (kind === 'donations') updateMgaLinks();
  }

  function updateCountdownBanner(banner) {
    const target = new Date(banner.getAttribute('data-countdown-target')).getTime();
    if (!target) return;
    const diff = target - Date.now();
    const daysEl = banner.querySelector('[data-cd-part="days"]');
    const hoursEl = banner.querySelector('[data-cd-part="hours"]');
    const minutesEl = banner.querySelector('[data-cd-part="minutes"]');
    const secondsEl = banner.querySelector('[data-cd-part="seconds"]');
    if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

    if (diff <= 0) {
      banner.classList.add('is-open');
      daysEl.textContent = '0';
      hoursEl.textContent = '00';
      minutesEl.textContent = '00';
      secondsEl.textContent = '00';
      if (!banner.dataset.openTextApplied) {
        setCountdownOpenText(banner);
        banner.dataset.openTextApplied = '1';
      }
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    daysEl.textContent = days;
    hoursEl.textContent = pad2(hours);
    minutesEl.textContent = pad2(minutes);
    secondsEl.textContent = pad2(seconds);
  }

  function updateCountdowns() {
    countdownBanners.forEach(updateCountdownBanner);
  }

  updateCountdowns();
  setInterval(updateCountdowns, 1000);

  // ============================================

})();

/* ============================================
   DRAWER + POPUP SYSTEM
   - Mou (no clona) el form-panel cap al drawer.
   - Quan es tanca, el retorna a la seva posició original.
   - Llegeix #open=X de la URL per obrir des d'altres pàgines.
   ============================================ */
(function() {
  const drawerOverlay = document.getElementById('lxd-drawer-overlay');
  const drawerBody = document.getElementById('lxd-drawer-body');
  const drawerTitleEl = document.getElementById('lxd-drawer-title');
  const popupOverlay = document.getElementById('lxd-popup-overlay');
  const popupBody = document.getElementById('lxd-popup-body');
  if (!drawerOverlay || !popupOverlay) return;

  // Title multilingüe per a cada form (CA · ES · EN)
  const FORM_TITLES = {
    heroi:       ['Sigues Heroi o Heroïna',     'Sé Héroe o Heroína',          'Be a Hero or Heroine'],
    poble:       ['Adhereix el teu poble',      'Adhiere tu pueblo',           'Add your town'],
    colla:       ['Apunta la teva colla',       'Apunta tu equipo',            'Sign up your team'],
    participant: ['Apunta-t\'hi al repte',      'Apúntate al reto',            'Join the challenge'],
    patrocini:   ['Patrocina el repte',         'Patrocina el reto',           'Sponsor the challenge'],
    contacte:    ['Contacte',                   'Contacto',                    'Contact'],
  };

  // Mantenim referències per restaurar
  let stash = null; // { panel, parent, nextSibling }

  function restoreStashed() {
    if (!stash) return;
    if (stash.nextSibling && stash.parent.contains(stash.nextSibling)) {
      stash.parent.insertBefore(stash.panel, stash.nextSibling);
    } else {
      stash.parent.appendChild(stash.panel);
    }
    stash = null;
  }

  function setDrawerTitle(formId) {
    const t = FORM_TITLES[formId];
    if (!t) { drawerTitleEl.textContent = ''; return; }
    drawerTitleEl.innerHTML =
      '<span lang="ca">' + t[0] + '</span>' +
      '<span lang="es">' + t[1] + '</span>' +
      '<span lang="en">' + t[2] + '</span>';
  }

  function openDrawer(formId, opts) {
    opts = opts || {};
    closePopup();
    if (drawerOverlay.classList.contains('is-open')) {
      // Si ja n'hi ha un d'obert, restaurem i obrim el nou
      restoreStashed();
      drawerBody.innerHTML = '';
    }
    const panel = document.getElementById('form-' + formId);
    if (!panel) return;

    stash = {
      panel,
      parent: panel.parentNode,
      nextSibling: panel.nextSibling,
    };
    drawerBody.appendChild(panel);

    setDrawerTitle(formId);

    drawerOverlay.hidden = false;
    document.body.classList.add('lxd-no-scroll');
    // Forçar reflow per garantir l'animació
    void drawerOverlay.offsetWidth;
    drawerOverlay.classList.add('is-open');

    // Aplicar opcions de pre-selecció (ex: nivell de patrocini)
    if (opts.nivell && formId === 'patrocini') {
      const nivellSel = panel.querySelector('[data-patro-nivell]');
      if (nivellSel) {
        nivellSel.value = opts.nivell;
        // Trigger change per si hi ha lògica dependent
        nivellSel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // Focus al primer input que NO sigui el preseleccionat
    setTimeout(() => {
      const allInputs = drawerBody.querySelectorAll('input:not([type=hidden]), select, textarea');
      let target = allInputs[0];
      // Si hem preseleccionat un select, saltem al següent input buit
      if (opts.nivell) {
        for (let i = 0; i < allInputs.length; i++) {
          if (!allInputs[i].value) { target = allInputs[i]; break; }
        }
      }
      if (target) target.focus();
    }, 380);
  }

  function closeDrawer() {
    if (!drawerOverlay.classList.contains('is-open')) return;
    drawerOverlay.classList.remove('is-open');
    document.body.classList.remove('lxd-no-scroll');
    setTimeout(() => {
      restoreStashed();
      drawerBody.innerHTML = '';
      drawerOverlay.hidden = true;
    }, 360);
  }

  function openPopupNewsletter() {
    closeDrawer();
    const form = document.querySelector('form[name="newsletter"]');
    if (!form) return;
    if (popupOverlay.classList.contains('is-open')) return;

    stash = {
      panel: form,
      parent: form.parentNode,
      nextSibling: form.nextSibling,
    };
    popupBody.appendChild(form);

    popupOverlay.hidden = false;
    document.body.classList.add('lxd-no-scroll');
    void popupOverlay.offsetWidth;
    popupOverlay.classList.add('is-open');

    setTimeout(() => {
      const firstInput = popupBody.querySelector('input[type="email"]');
      if (firstInput) firstInput.focus();
    }, 240);
  }

  function closePopup() {
    if (!popupOverlay.classList.contains('is-open')) return;
    popupOverlay.classList.remove('is-open');
    document.body.classList.remove('lxd-no-scroll');
    setTimeout(() => {
      restoreStashed();
      popupBody.innerHTML = '';
      popupOverlay.hidden = true;
    }, 240);
  }

  // === Click handlers per a close buttons + clic fora ===
  drawerOverlay.querySelector('[data-lxd-close-drawer]').addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', (e) => {
    if (e.target === drawerOverlay) closeDrawer();
  });
  popupOverlay.querySelector('[data-lxd-close-popup]').addEventListener('click', closePopup);
  popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) closePopup();
  });
  // Esc per tancar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      closePopup();
    }
  });

  // === Triggers via EVENT DELEGATION ===
  // Capturem clics a tot el document, així funciona també amb elements
  // injectats dinàmicament (ex: ghost cards renderitzades després de fetch).
  document.addEventListener('click', (e) => {
    const drawerEl = e.target.closest('[data-open-drawer], [data-role-cta]');
    if (drawerEl) {
      e.preventDefault();
      const id = drawerEl.dataset.openDrawer || drawerEl.dataset.roleCta;
      const opts = {};
      if (drawerEl.dataset.nivell) opts.nivell = drawerEl.dataset.nivell;
      if (id) openDrawer(id, opts);
      return;
    }
    const popupEl = e.target.closest('[data-open-popup="newsletter"]');
    if (popupEl) {
      e.preventDefault();
      openPopupNewsletter();
      return;
    }
    const formLink = e.target.closest('a[href^="#form-"]');
    if (formLink) {
      const m = formLink.getAttribute('href').match(/^#form-(\w+)/);
      if (m) {
        e.preventDefault();
        openDrawer(m[1]);
      }
    }
  });

  // === Hash-based opening (per altres pàgines → index.html#open=X) ===
  // Format: #open=patrocini  o  #open=patrocini&nivell=km
  function handleHash() {
    const hash = window.location.hash;
    const m = hash.match(/^#open=(\w+)(?:&(.+))?$/);
    if (!m) return;
    const id = m[1];
    // El flujo de participantes se gestiona solo desde el formulario universal, donde queda bloqueado hasta nueva apertura.
    if (id === 'participant' || id === 'participants' || id === 'universal') return;
    const params = {};
    if (m[2]) {
      m[2].split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k && v) params[k] = decodeURIComponent(v);
      });
    }
    setTimeout(() => {
      if (id === 'newsletter') {
        openPopupNewsletter();
      } else if (FORM_TITLES[id]) {
        openDrawer(id, params);
      }
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }, 80);
  }
  handleHash();
  window.addEventListener('hashchange', handleHash);

  // Expose
  window.lxdOpenDrawer = openDrawer;
  window.lxdOpenPopup = openPopupNewsletter;
})();
