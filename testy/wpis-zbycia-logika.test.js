'use strict';

/** R4 zad. 15 (D-091): logika nowego przebiegu zbycia — zbywcy, dobór akcji, widoczność pól. */

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../publiczne/js/wpis-zbycia-logika.js');

const osoba = (id, n) => ({ id, oznaczenie: n });
const STAN = {
  emisje: [{ klucz: 10, seria: 'A' }, { klucz: 20, seria: 'B' }],
  akcjonariusze: [
    { osoba_id: 1, osoba: osoba(1, 'Kowalski Jan'), emisja_klucz: 20, seria: 'B', ilosc: 50, zakresy: [{ nr_od: 1001, nr_do: 1050 }], pokryta: 'tak', obciazenia: [] },
    { osoba_id: 1, osoba: osoba(1, 'Kowalski Jan'), emisja_klucz: 10, seria: 'A', ilosc: 30, zakresy: [{ nr_od: 1, nr_do: 10 }], pokryta: 'tak', obciazenia: [{ id: 5 }] },
    { osoba_id: 1, osoba: osoba(1, 'Kowalski Jan'), emisja_klucz: 10, seria: 'A', ilosc: 20, zakresy: [{ nr_od: 11, nr_do: 20 }, { nr_od: 41, nr_do: 50 }], pokryta: 'tak', obciazenia: [] },
    { osoba_id: 2, osoba: osoba(2, 'Nowak Anna'), emisja_klucz: 10, seria: 'A', ilosc: 20, zakresy: [{ nr_od: 21, nr_do: 40 }], pokryta: null, obciazenia: [] },
  ],
  ograniczenia: [],
};

test('lista zbywców = akcjonariusze tej spółki (unikalni, z łączną liczbą akcji)', () => {
  assert.deepEqual(L.zbywcyZRejestru(STAN).map((z) => [z.osoba_id, z.ilosc]), [[1, 100], [2, 20]]);
});

test('dobór: seria wg kolejności emisji, numery rosnąco, obciążone i niepokryte na końcu', () => {
  const d = L.dobierzAkcje(STAN, 1, 25);
  assert.equal(d.seria, 'A');
  assert.equal(d.zakresyTekst, '11-20, 41-50, 1-5');
  assert.equal(d.dobrano, 25);
  assert.equal(d.obciazone, true, 'dobrano akcje obciążone — krok 3 to pokazuje');
  assert.equal(d.niepokryte, false);
  const tylkoWolne = L.dobierzAkcje(STAN, 1, 15);
  assert.equal(tylkoWolne.zakresyTekst, '11-20, 41-45');
  assert.equal(tylkoWolne.obciazone, false);
  const zaDuzo = L.dobierzAkcje(STAN, 1, 40);
  assert.equal(zaDuzo.brakuje, 10, 'w serii A zbywca ma 30 — jeden wpis = jedna seria');
  assert.deepEqual(zaDuzo.inneSerie, ['B']);
  assert.equal(L.dobierzAkcje(STAN, 1, 5, { emisjaKlucz: 20 }).zakresyTekst, '1001-1005');
  assert.equal(L.dobierzAkcje(STAN, 2, 5).niepokryte, true, 'brak informacji o pokryciu = nie w pełni pokryte');
});

test('widoczność: „zgoda spółki” tylko przy ograniczeniu wymagającym zgody albo niepełnym pokryciu; pierwszeństwo tylko przy takim ograniczeniu', () => {
  const pole = (klucz) => L.definicjaWpisu.przeniesienie.pola.find((p) => p.klucz === klucz);
  const kontekst = (stan, osobaId, ilosc) => ({ stan, dobor: L.dobierzAkcje(stan, osobaId, ilosc) });
  assert.equal(pole('zgoda_spolki').widoczneGdy(kontekst(STAN, 1, 5)), false);
  assert.equal(pole('zgoda_spolki_niepelne_pokrycie').widoczneGdy(kontekst(STAN, 1, 5)), false);
  assert.equal(pole('zgoda_spolki_niepelne_pokrycie').widoczneGdy(kontekst(STAN, 2, 5)), true);
  assert.equal(pole('pierwszenstwo_wyczerpane').widoczneGdy(kontekst(STAN, 1, 5)), false);
  const zOgraniczeniami = { ...STAN, ograniczenia: [
    { status: 'aktywne', zakres: 'emisja', emisja_klucz: 10, wymaga_zgody_spolki: 1, prawo_pierwszenstwa: 0 },
    { status: 'aktywne', zakres: 'wszystkie', wymaga_zgody_spolki: 0, prawo_pierwszenstwa: 1 },
  ] };
  assert.equal(pole('zgoda_spolki').widoczneGdy(kontekst(zOgraniczeniami, 1, 5)), true);
  assert.equal(pole('pierwszenstwo_wyczerpane').widoczneGdy(kontekst(zOgraniczeniami, 1, 5)), true);
  assert.equal(pole('zgoda_spolki').widoczneGdy(kontekst(zOgraniczeniami, 1, 5, 20)), true);
});

test('definicja wpisu: trzy kroki i pola z krokiem, źródłem i wymaganiem', () => {
  const d = L.definicjaWpisu.przeniesienie;
  assert.deepEqual(d.kroki, ['Co się zbywa', 'Podstawa', 'Sprawdzenie i wpis']);
  for (const p of d.pola) {
    assert.ok(p.klucz && [1, 2, 3].includes(p.krok), p.klucz);
    assert.ok(['reczne', 'kartoteka', 'rejestr', 'auto', 'domyslne'].includes(p.zrodlo), p.klucz);
    assert.equal(typeof p.widoczneGdy, 'function', p.klucz);
  }
  assert.equal(d.pola.find((p) => p.klucz === 'tytul_prawny').domyslna, 'sprzedaż');
  assert.equal(d.pola.find((p) => p.klucz === 'dokument_rodzaj').domyslna, 'umowa_zbycia');
});

test('dane zdarzenia z formularza: jedna seria, numery z doboru, pola warunkowe', () => {
  const dane = L.daneZdarzenia(STAN, { zbywca_osoba_id: 1, ilosc: 15, nabywca_osoba_id: 9, tytul_prawny: 'sprzedaż', zgoda_spolki: true });
  assert.deepEqual(dane, {
    emisja_zdarzenie_id: 10, zbywca_osoba_id: 1, tytul_prawny: 'sprzedaż',
    pozycje: [{ nabywca_osoba_id: 9, ilosc: 15, zakresy_tekst: '11-20, 41-45' }],
    zgoda_spolki: 0, pierwszenstwo_wyczerpane: 0, zgoda_spolki_niepelne_pokrycie: 0,
  }, 'pole niewidoczne (brak ograniczenia) nie trafia do danych');
  const zOgr = { ...STAN, ograniczenia: [{ status: 'aktywne', zakres: 'wszystkie', wymaga_zgody_spolki: 1 }] };
  assert.equal(L.daneZdarzenia(zOgr, { zbywca_osoba_id: 1, ilosc: 15, nabywca_osoba_id: 9, zgoda_spolki: true }).zgoda_spolki, 1);
});

// B-005 (SESJA-PSA-ANALIZA-PRZEPLYWOW): kreator zbycia dostaje stan z `GET /api/psa/spolki/:id`
// (`widoki.widokStanu`), nie surowy stan z `stan.js` — pola warunkowe muszą działać na TYM kształcie.
test('B-005: ograniczenie z widoku API (prawo pierwszeństwa, zgoda spółki) pokazuje pola warunkowe zbycia', () => {
  const { bazaTestowa, dodajSpolke, dodajOsobe, wpis } = require('./pomoc');
  const widoki = require('../server/widoki');
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const kowalski = dodajOsobe(db, { nazwisko: 'Kowalski', imie: 'Jan' });
  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 100 });
  wpis(db, spolka, 'objecie', '2026-01-10', { emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: kowalski, ilosc: 100 }] });
  wpis(db, spolka, 'ograniczenie', '2026-01-15', { zakres: 'emisja', emisja_zdarzenie_id: emisja.zdarzenie.id, prawo_pierwszenstwa: true, opis: 'PP' });
  wpis(db, spolka, 'ograniczenie', '2026-01-16', {
    zakres: 'emisja', emisja_zdarzenie_id: emisja.zdarzenie.id, wymaga_zgody_spolki: true,
    zgoda_termin_wskazania_dni: 30, zgoda_cena_opis: 'wartość godziwa', zgoda_termin_zaplaty_dni: 14, opis: 'Zgoda',
  });
  const stan = widoki.widokStanu(db, spolka);
  const dobor = L.dobierzAkcje(stan, kowalski, 10);
  assert.ok(dobor, 'dobór akcji na stanie z widoku');
  const kontekst = { stan, dobor };
  assert.equal(L.ograniczeniaDlaDoboru(stan, dobor).length, 2, 'oba ograniczenia serii A');
  assert.equal(L.poleWidoczne('przeniesienie', 'pierwszenstwo_wyczerpane', kontekst), true);
  assert.equal(L.poleWidoczne('przeniesienie', 'zgoda_spolki', kontekst), true);
});
