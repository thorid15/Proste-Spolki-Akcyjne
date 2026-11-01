/*
 * Czerwony pasek trybu testowego (T6) na kazdym ekranie kancelarii i portalu.
 * Serwowany WYLACZNIE w trybie testowym (/test/pasek.js) i wstrzykiwany do
 * index.html/portal.html przez serwer.js — poza trybem testowym nie istnieje.
 */
(function () {
  'use strict';
  var stan = window.PSA_TRYB_TESTOWY;
  if (!stan || document.getElementById('psa-pasek-testowy')) return;
  var pasek = document.createElement('div');
  pasek.id = 'psa-pasek-testowy';
  pasek.setAttribute('role', 'status');
  pasek.style.cssText = 'background:#b00020;color:#fff;font:600 13px/1.4 system-ui,sans-serif;' +
    'padding:6px 16px;display:flex;flex-wrap:wrap;gap:4px 16px;align-items:center;position:relative;z-index:10000';
  function element(znacznik, tekst, href) {
    var e = document.createElement(znacznik);
    e.textContent = tekst;
    if (href) { e.href = href; e.style.color = '#fff'; }
    return e;
  }
  pasek.appendChild(element('strong', 'TRYB TESTOWY — e-maile nie są wysyłane'));
  pasek.appendChild(element('span', 'Data: ' + stan.data + (stan.symulowana ? ' (symulowana)' : '')));
  pasek.appendChild(element('a', 'Skrzynka testowa', '/test/skrzynka'));
  pasek.appendChild(element('a', 'Panel testowy (data, atrapy)', '/test'));
  document.body.insertBefore(pasek, document.body.firstChild);
})();
