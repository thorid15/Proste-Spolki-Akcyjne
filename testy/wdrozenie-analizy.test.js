'use strict';

/**
 * Wdrożenie decyzji z SESJA-PSA-ANALIZA-PRZEPLYWOW (docs/analiza/RAPORT-PRZEPLYWY.md, D-095–D-106, B-001–B-006).
 * Testy jednostkowe; przebiegi w przeglądarce — `npm run e2e` (testy/e2e/scenariusze).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const typyZdarzen = require('../server/logika/typy-zdarzen');
const kreator = require('../server/logika/kreator');

test('D-103 / B-002: sprostowanie tylko z historii zdarzeń — nie ma go w kreatorze (każdy typ kreatora ma budowniczego)', () => {
  const wKreatorze = typyZdarzen.dostepneWKreatorze().map((t) => t.kod);
  assert.ok(!wKreatorze.includes('sprostowanie'), 'sprostowanie poza kafelkami kreatora');
  const bezBudowniczego = wKreatorze.filter((kod) => {
    try { kreator.przygotuj({ emisje: [], akcje: [], obciazenia: [], ograniczenia: [], uprawnienia: [] }, { typ: kod, dane: {} }); } catch (e) {
      return /nie jest jeszcze obsługiwany/.test(e.message);
    }
    return false;
  });
  assert.deepEqual(bezBudowniczego, []);
});

const L = require('../publiczne/js/wpis-zbycia-logika.js');

test('D-104: domyślny adresat uprzedniego powiadomienia = osoba, której prawa zmienia wpis', () => {
  assert.equal(L.odbiorcaPowiadomienia('przeniesienie', { zbywca_osoba_id: 7 }), 7);
  assert.equal(L.odbiorcaPowiadomienia('przeniesienie_ulamka', { zbywca_osoba_id: 8 }), 8);
  assert.equal(L.odbiorcaPowiadomienia('umorzenie', { pozycje: [{ osoba_id: 3, ilosc: 10 }] }), 3);
  assert.equal(L.odbiorcaPowiadomienia('obciazenie', { akcjonariusz_osoba_id: 4 }), 4);
  assert.equal(L.odbiorcaPowiadomienia('zobowiazanie', { akcjonariusz_osoba_id: 5 }), 5);
  const stan = { obciazenia: [{ klucz: 11, akcjonariusz: { id: 6 } }] }; // kształt `GET /api/psa/spolki/:id`
  assert.equal(L.odbiorcaPowiadomienia('prawo_glosu_zastawnika', { obciazenie_zdarzenie_id: 11 }, stan), 6);
  assert.equal(L.odbiorcaPowiadomienia('emisja', { seria: 'B' }), null, 'typ bez powiadomienia');
  assert.equal(L.odbiorcaPowiadomienia('obciazenie', {}), null, 'brak danych — brak domyślnego');
});

test('A-013: domyślny charakter żądającego wynika z typu wpisu', () => {
  assert.equal(L.domyslnyCharakterZadajacego('przeniesienie'), 'nabywca');
  assert.equal(L.domyslnyCharakterZadajacego('obciazenie'), 'zastawnik');
  assert.equal(L.domyslnyCharakterZadajacego('wykreslenie_obciazenia'), 'akcjonariusz');
  assert.equal(L.domyslnyCharakterZadajacego('emisja'), 'spolka');
  assert.equal(L.domyslnyCharakterZadajacego('zajecie'), '', 'z urzędu — bez żądającego');
});

test('D-100: w interfejsie „Zbycie akcji” zamiast „Przeniesienie akcji” (pisma — nazwa typu bez zmian)', () => {
  assert.equal(L.nazwaCzynnosci('przeniesienie', 'Przeniesienie akcji'), 'Zbycie akcji');
  assert.equal(L.nazwaCzynnosci('przeniesienie_ulamka', 'Przeniesienie ułamkowej części akcji'), 'Zbycie ułamkowej części akcji');
  assert.equal(L.nazwaCzynnosci('emisja', 'Emisja akcji'), 'Emisja akcji');
  assert.equal(typyZdarzen.typ('przeniesienie').nazwa, 'Przeniesienie akcji', 'nazwa typu (pisma) bez zmian');
});
