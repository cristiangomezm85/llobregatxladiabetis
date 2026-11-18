/* =====================================================================
   MENÚ COMÚ · Llobregat x la Diabetis  (complement de menu.css)
   - Desplegables (clic / tàctil; a l'escriptori també en passar el ratolí)
   - Menú hamburguesa en mòbil
   - Total recaptat al botó "Dona"
   ===================================================================== */
(function () {
  'use strict';
  var nav = document.getElementById('nav');
  if (!nav) return;
  var links = document.getElementById('navLinks');
  var burger = document.getElementById('burger');
  var wide = function () { return window.matchMedia('(min-width: 1101px)').matches; };

  /* Ombra/línia inferior en fer scroll */
  function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 30); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Desplegables ---------- */
  function closeAll(except) {
    nav.querySelectorAll('.nav-dd.open').forEach(function (d) {
      if (d === except) return;
      d.classList.remove('open');
      var b = d.querySelector('.nav-dd-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  nav.querySelectorAll('.nav-dd').forEach(function (dd) {
    var b = dd.querySelector('.nav-dd-btn');
    if (!b) return;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !dd.classList.contains('open');
      closeAll(dd);
      dd.classList.toggle('open', open);
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    dd.addEventListener('mouseleave', function () {
      if (!wide()) return;
      dd.classList.remove('open');
      b.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('click', function (e) { if (!nav.contains(e.target)) closeAll(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeAll();
    if (links) links.classList.remove('open');
    if (burger) burger.setAttribute('aria-expanded', 'false');
  });

  /* ---------- Hamburguesa ----------
     Algunes pàgines ja hi lliguen el seu propi gestor: aquest, en fase de
     captura, s'executa primer i evita que el menú s'obri i es tanqui alhora. */
  if (burger && links) {
    burger.setAttribute('aria-expanded', 'false');
    burger.addEventListener('click', function (e) {
      e.stopImmediatePropagation();
      var open = !links.classList.contains('open');
      links.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) closeAll();
    }, true);
    links.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) {
        links.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
    window.addEventListener('resize', function () { if (wide()) { links.classList.remove('open'); closeAll(); } });
  }

  /* ---------- Total final recaptat al botó Dona ---------- */
  /* Repte tancat: xifra final fixa (si es canvia, canviar-la també a index.html i dona/index.html). */
  (function totalDona() {
    var el = nav.querySelector('.nav-dona-total');
    if (!el) return;
    var TOTAL_FINAL = 18854.31;
    var LOCALES = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB' };
    function pinta() {
      var lang = document.documentElement.getAttribute('data-lang') || 'ca';
      var f = new Intl.NumberFormat(LOCALES[lang] || 'ca-ES', { maximumFractionDigits: 0 }).format(Math.round(TOTAL_FINAL));
      el.textContent = '· ' + (lang === 'en' ? '€' + f : f + '€');
      el.hidden = false;
    }
    pinta();
    new MutationObserver(pinta).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
  })();
})();
