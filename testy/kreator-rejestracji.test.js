'use strict';

/**
 * Sesja 6 (interfejs), faza 3 — nowa domenowa logika wymagana przez kreator
 * rejestracji spółki: otwarcie rejestru w jednej transakcji, kompletność
 * postanowienia o zgodzie spółki na zbycie (art. 300(39) § 1, 3 KSH) i bramka
 * zakazu prawa głosu zastawnika z umowy spółki (art. 300(23) § 2 KSH).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const rejestr = require('../server/rejestr');
const { bazaTestowa, dodajSpolke, dodajOsobe, wpis } = require('./pomoc');

test('otworzRejestr: emisja + objęcie zapisane atomowo w jednej transakcji (odwołanie przez klucz_tymczasowy)', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const jan = dodajOsobe(db, { imie: 'Jan', nazwisko: 'Kowalski' });

  // Kreator rejestracji spolki zna prawdziwe ID emisji dopiero PO jej
  // zapisaniu w TEJ SAMEJ transakcji - odwoluje sie do niej przez znacznik
  // klucza tymczasowego, nie liczbe (patrz rejestr.podstawKluczePartii).
  const wynik = rejestr.otworzRejestr(db, spolka, {
    autor: 'Test',
    dzisiaj: '2026-12-31',
    zdarzenia: [
      {
        typ: 'emisja',
        klucz_tymczasowy: 'emisja-A',
        data_zdarzenia: '2026-01-10',
        dane: { seria: 'A', ilosc: 100, data_wpisu_krs: '2026-01-10' },
      },
      {
        typ: 'objecie',
        data_zdarzenia: '2026-01-10',
        dane: {
          emisja_zdarzenie_id: { __odwolanie_do_partii: 'emisja-A' },
          pozycje: [{ osoba_id: jan, ilosc: 100 }],
        },
      },
    ],
  });

  assert.equal(wynik[1].zdarzenie.typ, 'objecie');
  const stan = db
    .prepare('SELECT osoba_id, ilosc FROM psa_stan_akcji WHERE spolka_id = ? AND kategoria = ?')
    .all(spolka, 'akcjonariusz');
  assert.equal(stan.length, 1);
  assert.equal(stan[0].osoba_id, jan);
  assert.equal(stan[0].ilosc, 100);
});

test('otworzRejestr: odwołanie do nieistniejącego klucza tymczasowego jest odrzucane', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const jan = dodajOsobe(db, { imie: 'Jan', nazwisko: 'Kowalski' });

  assert.throws(
    () =>
      rejestr.otworzRejestr(db, spolka, {
        autor: 'Test',
        dzisiaj: '2026-12-31',
        zdarzenia: [
          {
            typ: 'emisja',
            klucz_tymczasowy: 'emisja-A',
            data_zdarzenia: '2026-01-10',
            dane: { seria: 'A', ilosc: 100, data_wpisu_krs: '2026-01-10' },
          },
          {
            typ: 'objecie',
            data_zdarzenia: '2026-01-10',
            dane: {
              emisja_zdarzenie_id: { __odwolanie_do_partii: 'literowka' },
              pozycje: [{ osoba_id: jan, ilosc: 100 }],
            },
          },
        ],
      }),
    /literowka/
  );
  const zdarzenia = db.prepare('SELECT COUNT(*) AS n FROM psa_zdarzenia WHERE spolka_id = ?').get(spolka);
  assert.equal(zdarzenia.n, 0, 'blędne odwołanie cofa całą partię, łącznie z poprawną emisją');
});

test('otworzRejestr: gdy drugie zdarzenie zawodzi, PIERWSZE też się cofa (atomowość)', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const jan = dodajOsobe(db, { imie: 'Jan', nazwisko: 'Kowalski' });

  assert.throws(() =>
    rejestr.otworzRejestr(db, spolka, {
      autor: 'Test',
      dzisiaj: '2026-12-31',
      zdarzenia: [
        { typ: 'emisja', data_zdarzenia: '2026-01-10', dane: { seria: 'A', ilosc: 100, data_wpisu_krs: '2026-01-10' } },
        // Objecie przekracza pule emisji - walidacja bilansu odrzuci cala partie.
        {
          typ: 'objecie',
          data_zdarzenia: '2026-01-10',
          dane: { emisja_zdarzenie_id: 1, pozycje: [{ osoba_id: jan, ilosc: 999 }] },
        },
      ],
    })
  );

  const zdarzenia = db.prepare('SELECT COUNT(*) AS n FROM psa_zdarzenia WHERE spolka_id = ?').get(spolka);
  assert.equal(zdarzenia.n, 0, 'transakcja cofnięta w całości — nawet poprawna emisja nie została zapisana');
});

test('ograniczenie: zgoda spółki wymaga kompletu trzech pól, inaczej odrzucona jako bezskuteczna', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 100 });

  assert.throws(
    () =>
      wpis(db, spolka, 'ograniczenie', '2026-01-15', {
        zakres: 'wszystkie',
        wymaga_zgody_spolki: true,
        // brak zgoda_cena_opis i zgoda_termin_zaplaty_dni
        zgoda_termin_wskazania_dni: 14,
      }),
    /kompletu trzech elementów/
  );
});

test('ograniczenie: komplet trzech pól zapisuje skuteczne postanowienie o zgodzie spółki', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 100 });

  wpis(db, spolka, 'ograniczenie', '2026-01-15', {
    zakres: 'wszystkie',
    wymaga_zgody_spolki: true,
    zgoda_termin_wskazania_dni: 30,
    zgoda_cena_opis: 'wartość księgowa akcji na dzień zgłoszenia zamiaru zbycia',
    zgoda_termin_zaplaty_dni: 14,
  });

  const wiersz = db.prepare('SELECT * FROM psa_ograniczenia WHERE spolka_id = ?').get(spolka);
  assert.equal(wiersz.wymaga_zgody_spolki, 1);
  assert.equal(wiersz.zgoda_termin_wskazania_dni, 30);
  assert.equal(wiersz.zgoda_termin_zaplaty_dni, 14);
  assert.match(wiersz.zgoda_cena_opis, /wartość księgowa/);
});

test('ograniczenie: termin wskazania nabywcy dłuższy niż miesiąc jest odrzucany (art. 300(39) § 3)', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 100 });

  assert.throws(
    () =>
      wpis(db, spolka, 'ograniczenie', '2026-01-15', {
        zakres: 'wszystkie',
        wymaga_zgody_spolki: true,
        zgoda_termin_wskazania_dni: 45,
        zgoda_cena_opis: 'cena rynkowa',
        zgoda_termin_zaplaty_dni: 14,
      }),
    /dłuższy niż miesiąc/
  );
});

test('obciążenie: umowa spółki zakazująca głosu zastawnika blokuje przyznanie prawa głosu', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db, { zakaz_glosu_zastawnika_umowa: 'zakazane' });
  const wlasciciel = dodajOsobe(db, { imie: 'Jan', nazwisko: 'Kowalski' });
  const bank = dodajOsobe(db, { typ: 'prawna', nazwa: 'Bank Testowy' });
  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 100 });
  wpis(db, spolka, 'objecie', '2026-01-10', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    pozycje: [{ osoba_id: wlasciciel, ilosc: 100 }],
  });

  assert.throws(
    () =>
      wpis(db, spolka, 'obciazenie', '2026-02-01', {
        emisja_zdarzenie_id: emisja.zdarzenie.id,
        typ_obciazenia: 'zastaw',
        akcjonariusz_osoba_id: wlasciciel,
        osoba_id: bank,
        ilosc: 10,
        prawo_glosu: true,
      }),
    /zakazuje przyznawania prawa głosu/
  );

  // Bez prawa glosu ten sam wpis przechodzi bez przeszkod.
  wpis(db, spolka, 'obciazenie', '2026-02-01', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    typ_obciazenia: 'zastaw',
    akcjonariusz_osoba_id: wlasciciel,
    osoba_id: bank,
    ilosc: 10,
    prawo_glosu: false,
  });
});

test('obciążenie: spółka bez zakazu w umowie pozwala przyznać prawo głosu zastawnikowi', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const wlasciciel = dodajOsobe(db, { imie: 'Jan', nazwisko: 'Kowalski' });
  const bank = dodajOsobe(db, { typ: 'prawna', nazwa: 'Bank Testowy' });
  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 100 });
  wpis(db, spolka, 'objecie', '2026-01-10', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    pozycje: [{ osoba_id: wlasciciel, ilosc: 100 }],
  });

  wpis(db, spolka, 'obciazenie', '2026-02-01', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    typ_obciazenia: 'zastaw',
    akcjonariusz_osoba_id: wlasciciel,
    osoba_id: bank,
    ilosc: 10,
    prawo_glosu: true,
  });
});
