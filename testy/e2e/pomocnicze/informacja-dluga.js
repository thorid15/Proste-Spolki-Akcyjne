'use strict';

/** Informacja z rejestru z 3 seriami i bardzo długim zakresem numerów (R4 K4, „Na co uważać” pkt 5). */

const widoki = require('../../../server/widoki');
const { informacjaZRejestru } = require('../../../server/logika/informacja-dokument');
const { bazaTestowa, dodajSpolke } = require('../../pomoc');

const DLUGI_ZAKRES = '000001–999999, 1000001–1000005';

function informacjaZTrzemaSeriami() {
  const db = bazaTestowa();
  const spolkaId = dodajSpolke(db);
  const stan = widoki.widokStanu(db, spolkaId, '2026-11-01');
  stan.emisje = ['A', 'B', 'C'].map((seria, i) => ({
    klucz: `e${i}`, seria, rodzaj_akcji: 'zwykla', zakres: i === 1 ? DLUGI_ZAKRES : `${i * 100 + 1}–${i * 100 + 100}`,
    ilosc: i === 1 ? 1000004 : 100, cena_emisyjna_grosze: 100, waluta: 'PLN', data_wpisu_krs: '2026-01-02',
  }));
  return informacjaZRejestru({
    kancelaria: { nazwa: 'Kancelaria Notarialna', adres: '', miejscowosc: '', email: '' },
    spolka: stan.spolka, data: '2026-11-01', stan, sporzadzono: '2026-11-01T10:00:00Z',
  });
}

module.exports = { informacjaZTrzemaSeriami, DLUGI_ZAKRES };
