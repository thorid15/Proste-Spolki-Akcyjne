// Ulepszenia progresywne strony publicznej (sekcja 9: <3 KB łącznie).
// Strona działa w pełni bez tego pliku — tu tylko kalkulator opłat i przyklejone CTA na telefonie.
(function () {
  'use strict';

  var cta = document.querySelector('.cta-przyklejone');
  var hero = document.querySelector('.hero');
  if (cta && hero && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (wpisy) {
      cta.classList.toggle('pokaz', !wpisy[0].isIntersecting);
    });
    obs.observe(hero);
  }

  var kalk = document.querySelector('.kalkulator');
  if (!kalk) return;
  var stawki = {
    prowadzenie: Number(kalk.dataset.prowadzenie),
    wpis: Number(kalk.dataset.wpis),
    informacja: Number(kalk.dataset.informacja),
    vat: Number(kalk.dataset.vat),
  };
  var poleWpisy = kalk.querySelector('#kalk-wpisy');
  var poleInfo = kalk.querySelector('#kalk-informacje');
  var wynik = kalk.querySelector('.kalkulator-wynik strong');

  function zlote(grosze) {
    return (grosze / 100).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 });
  }
  function przelicz() {
    var wpisy = Math.max(0, Number(poleWpisy.value) || 0);
    var info = Math.max(0, Number(poleInfo.value) || 0);
    var netto = stawki.prowadzenie + wpisy * stawki.wpis + info * stawki.informacja;
    var brutto = Math.round(netto * (1 + stawki.vat / 100));
    wynik.textContent = zlote(brutto);
  }
  kalk.hidden = false;
  poleWpisy.addEventListener('input', przelicz);
  poleInfo.addEventListener('input', przelicz);
  przelicz();
})();
