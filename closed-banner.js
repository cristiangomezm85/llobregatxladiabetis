/* =====================================================================
   AVÍS "REPTE FINALITZAT" · Llobregat x la Diabetis
   Es carrega amb:  <script src="closed-banner.js" data-page="..." defer></script>
   data-page: inscripcio | directe | recollida | briefing
   - Insereix una franja d'avís just sota la barra de navegació.
   - A "inscripcio" també amaga el formulari (#form-inscripcio).
   - Llegeix l'idioma de <html data-lang> (o localStorage llxd-lang).
   ===================================================================== */
(function () {
  'use strict';
  var script = document.currentScript;
  var page = (script && script.getAttribute('data-page')) || 'default';

  var T = {
    default: {
      ca: ['El repte 2026 ja ha acabat. Gràcies a tothom qui l\'ha fet possible!', 'Veure el balanç'],
      es: ['El reto 2026 ya ha terminado. ¡Gracias a todas las personas que lo han hecho posible!', 'Ver el balance'],
      en: ['The 2026 challenge is over. Thank you to everyone who made it possible!', 'See the results']
    },
    inscripcio: {
      ca: ['Les inscripcions estan tancades: el repte 2026 ja ha acabat. Gràcies a tothom qui hi ha participat!', 'Veure el balanç'],
      es: ['Las inscripciones están cerradas: el reto 2026 ya ha terminado. ¡Gracias a todas las personas que han participado!', 'Ver el balance'],
      en: ['Registration is closed: the 2026 challenge is over. Thank you to everyone who took part!', 'See the results']
    },
    directe: {
      ca: ['El seguiment en directe ha finalitzat: el repte 2026 ja ha acabat. Gràcies per acompanyar-nos!', 'Veure el balanç'],
      es: ['El seguimiento en directo ha finalizado: el reto 2026 ya ha terminado. ¡Gracias por acompañarnos!', 'Ver el balance'],
      en: ['Live tracking has ended: the 2026 challenge is over. Thank you for following along!', 'See the results']
    },
    recollida: {
      ca: ['La recollida de bossa i samarreta ha finalitzat: el repte 2026 ja ha acabat.', 'Veure el balanç'],
      es: ['La recogida de bolsa y camiseta ha finalizado: el reto 2026 ya ha terminado.', 'Ver el balance'],
      en: ['Bag and t-shirt collection has ended: the 2026 challenge is over.', 'See the results']
    },
    briefing: {
      ca: ['Aquest briefing correspon al repte del 16–18 d\'octubre de 2026, ja finalitzat. Es conserva com a arxiu.', 'Veure el balanç'],
      es: ['Este briefing corresponde al reto del 16–18 de octubre de 2026, ya finalizado. Se conserva como archivo.', 'Ver el balance'],
      en: ['This briefing is for the 16–18 October 2026 challenge, which has now ended. It is kept as an archive.', 'See the results']
    }
  };

  function lang() {
    var l = document.documentElement.getAttribute('data-lang');
    if (!l) { try { l = localStorage.getItem('llxd-lang'); } catch (e) {} }
    return (l === 'es' || l === 'en') ? l : 'ca';
  }

  function build() {
    var nav = document.getElementById('nav') || document.querySelector('nav.nav') || document.querySelector('nav');
    if (!nav || document.getElementById('llxdClosedBanner')) return;
    var box = document.createElement('div');
    box.id = 'llxdClosedBanner';
    box.setAttribute('role', 'status');
    box.style.cssText = 'background:#FF6B47;color:#fff;font:600 15px/1.45 "Manrope",system-ui,sans-serif;padding:12px 16px;text-align:center;';
    var txt = document.createElement('span');
    var link = document.createElement('a');
    link.href = 'index.html#balanc';
    link.style.cssText = 'color:#fff;text-decoration:underline;text-underline-offset:3px;margin-left:.6em;white-space:nowrap;font-weight:800;';
    box.appendChild(txt); box.appendChild(link);
    function paint() {
      var t = (T[page] || T.default)[lang()];
      txt.textContent = t[0];
      link.textContent = t[1] + ' →';
    }
    paint();
    nav.parentNode.insertBefore(box, nav.nextSibling);
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
  }

  function hideForm() {
    if (page !== 'inscripcio') return;
    var f = document.getElementById('form-inscripcio');
    if (f) f.style.display = 'none';
    var lm = document.querySelector('.lm-card');   // franja "Last minute" (comptador i places)
    if (lm) { var w = lm.parentNode; (w && w !== document.body && w.children.length === 1 ? w : lm).style.display = 'none'; }
  }

  function init() { build(); hideForm(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
