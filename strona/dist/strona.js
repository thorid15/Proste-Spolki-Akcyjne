
(function () {
  'use strict';
  var d = document, ruch = d.documentElement.classList.contains('anim');

  var nav = d.getElementById('nav');
  function przewiniecie() { nav.classList.toggle('nav--przewiniety', window.scrollY > 8); }
  przewiniecie();
  window.addEventListener('scroll', przewiniecie, { passive: true });

  var przycisk = d.getElementById('przycisk-menu'), menu = d.getElementById('menu-mobilne');
  function ustawMenu(otwarte) {
    przycisk.setAttribute('aria-expanded', String(otwarte));
    menu.hidden = !otwarte;
    nav.classList.toggle('nav--menu', otwarte);
  }
  przycisk.addEventListener('click', function () { ustawMenu(menu.hidden); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) ustawMenu(false); });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { ustawMenu(false); przycisk.focus(); } });

  if (ruch) {
    var obserwator = new IntersectionObserver(function (wpisy) {
      wpisy.forEach(function (w) { if (w.isIntersecting) { w.target.classList.add('in'); obserwator.unobserve(w.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
    d.querySelectorAll('[data-reveal]').forEach(function (el) { obserwator.observe(el); });
  }
})();
