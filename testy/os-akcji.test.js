'use strict';

/**
 * Sprint 6 (interfejs), faza 2.1/2.4 — `widoki.widokOsiAkcji`.
 *
 * W odróżnieniu od `widoki.widokStanu` (przekrój na jeden dzień) ten widok
 * zwraca PEŁNĄ historię przedziałów własnościowych (otwarte i zamknięte,
 * z `data_od`/`data_do`) — to surowiec dla osi akcji (wykres numer × czas).
 * Testy sprawdzają, że projekcja poprawnie przepisuje `stan.przedzialy`/
 * `stan.obciazenia`, nie że stan.js coś nowego liczy (nic tam nie zmieniono).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const widoki = require('../server/widoki');
const { bazaTestowa, dodajSpolke, dodajOsobe, wpis } = require('./pomoc');

test('emisja bez objęcia: jedno pasmo nieobjęte, brak akcjonariusza', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 10 });

  const os = widoki.widokOsiAkcji(db, spolka);
  assert.equal(os.emisje.length, 1);
  assert.equal(os.pasma.length, 1);
  assert.equal(os.pasma[0].kategoria, 'nieobjeta');
  assert.equal(os.pasma[0].osoba, null);
  assert.equal(os.pasma[0].nr_od, 1);
  assert.equal(os.pasma[0].nr_do, 10);
  assert.equal(os.pasma[0].data_od, '2026-01-10');
  assert.equal(os.pasma[0].data_do, null, 'pasmo wciąż otwarte');
});

test('objęcie całości: pasmo nieobjęte zamyka się, pasmo akcjonariusza się otwiera', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const jan = dodajOsobe(db, { imie: 'Jan', nazwisko: 'Kowalski' });
  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 10 });
  wpis(db, spolka, 'objecie', '2026-01-15', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    pozycje: [{ osoba_id: jan, ilosc: 10 }],
  });

  const os = widoki.widokOsiAkcji(db, spolka);
  // Nieobjęte 1-10 zamknięte 15.01, akcjonariusz Jan 1-10 otwarty od 15.01.
  const zamkniete = os.pasma.filter((p) => p.data_do !== null);
  const otwarte = os.pasma.filter((p) => p.data_do === null);
  assert.equal(zamkniete.length, 1);
  assert.equal(zamkniete[0].kategoria, 'nieobjeta');
  assert.equal(zamkniete[0].data_do, '2026-01-15');
  assert.equal(otwarte.length, 1);
  assert.equal(otwarte[0].kategoria, 'akcjonariusz');
  assert.equal(otwarte[0].osoba_id, jan);
  assert.equal(otwarte[0].osoba.oznaczenie, 'Kowalski Jan');
  assert.equal(otwarte[0].data_od, '2026-01-15');
});

test('częściowe przeniesienie: pasmo zbywcy się rozszczepia (pozostałe + zamknięte + nowe nabywcy)', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const zbywca = dodajOsobe(db, { imie: 'Jędrzej', nazwisko: 'Grabski' });
  const nabywca = dodajOsobe(db, { imie: 'Izabella', nazwisko: 'Grabska' });
  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'AZ', ilosc: 100 });
  wpis(db, spolka, 'objecie', '2026-01-10', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    pozycje: [{ osoba_id: zbywca, ilosc: 100 }],
  });
  wpis(db, spolka, 'przeniesienie', '2026-03-12', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    zbywca_osoba_id: zbywca,
    tytul_prawny: 'sprzedaż',
    pozycje: [{ nabywca_osoba_id: nabywca, ilosc: 5 }],
  });

  const os = widoki.widokOsiAkcji(db, spolka);
  const pasmaZbywcy = os.pasma.filter((p) => p.osoba_id === zbywca);
  const pasmaNabywcy = os.pasma.filter((p) => p.osoba_id === nabywca);

  // Zbywca: jedno pasmo zamknięte 12.03 na zbytej części, jedno otwarte na reszcie.
  assert.equal(pasmaZbywcy.length, 2);
  const zbywcaZamkniete = pasmaZbywcy.find((p) => p.data_do !== null);
  const zbywcaOtwarte = pasmaZbywcy.find((p) => p.data_do === null);
  assert.ok(zbywcaZamkniete && zbywcaOtwarte);
  assert.equal(zbywcaZamkniete.data_do, '2026-03-12');
  assert.equal(zbywcaZamkniete.nr_do - zbywcaZamkniete.nr_od + 1, 5);
  assert.equal(zbywcaOtwarte.nr_do - zbywcaOtwarte.nr_od + 1, 95);

  // Nabywca: jedno nowe pasmo otwarte od 12.03.
  assert.equal(pasmaNabywcy.length, 1);
  assert.equal(pasmaNabywcy[0].data_od, '2026-03-12');
  assert.equal(pasmaNabywcy[0].data_do, null);
});

test('obciążenie: surowe zakresy dostępne wprost, bez parsowania sformatowanego tekstu', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const zastawnik = dodajOsobe(db, { typ: 'prawna', nazwa: 'Bank Testowy' });
  const wlasciciel = dodajOsobe(db, { imie: 'Jan', nazwisko: 'Kowalski' });
  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 10 });
  wpis(db, spolka, 'objecie', '2026-01-10', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    pozycje: [{ osoba_id: wlasciciel, ilosc: 10 }],
  });
  wpis(db, spolka, 'obciazenie', '2026-02-01', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    typ_obciazenia: 'zastaw',
    akcjonariusz_osoba_id: wlasciciel,
    osoba_id: zastawnik,
    zakresy: [{ nr_od: 3, nr_do: 5 }],
    prawo_glosu: false,
    blokuje_rozporzadzanie: true,
  });

  const os = widoki.widokOsiAkcji(db, spolka);
  assert.equal(os.obciazenia.length, 1);
  const o = os.obciazenia[0];
  assert.deepEqual(o.zakresy, [{ nr_od: 3, nr_do: 5 }]);
  assert.equal(o.uprawniony.oznaczenie, 'Bank Testowy');
  assert.equal(o.blokuje_rozporzadzanie, true);
  assert.equal(o.data_do, null, 'obciążenie wciąż aktywne');
  assert.equal(typeof o.zdarzenie_od_id, 'number', 'id zdarzenia ustanawiającego — do mapowania na oś ordynalną');
  assert.equal(o.zdarzenie_do_id, null);
});

test('zdarzenia posortowane rosnąco — kolejność, w jakiej porusza się playhead', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 10 });
  wpis(db, spolka, 'emisja', '2026-01-05', { seria: 'B', ilosc: 5 });

  const os = widoki.widokOsiAkcji(db, spolka);
  assert.equal(os.zdarzenia.length, 2);
  assert.equal(os.zdarzenia[0].data_zdarzenia, '2026-01-05', 'najstarsze zdarzenie pierwsze');
  assert.equal(os.zdarzenia[1].data_zdarzenia, '2026-01-10');
  assert.ok(os.zdarzenia[0].podsumowanie.includes('Emisja'));
});

test('nieistniejąca spółka zwraca null', () => {
  const db = bazaTestowa();
  assert.equal(widoki.widokOsiAkcji(db, 99999), null);
});
