'use strict';

/**
 * Przypadki brzegowe przeniesienia akcji (sprint 1, ostatni punkt listy testow).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { bazaTestowa, dodajSpolke, dodajOsobe, wpis } = require('./pomoc');
const rejestr = require('../server/rejestr');
const stanLogika = require('../server/logika/stan');
const n = require('../server/logika/numery');

function przygotuj({ ilosc = 100 } = {}) {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const a = dodajOsobe(db, { nazwisko: 'Adamski', imie: 'Adam' });
  const b = dodajOsobe(db, { nazwisko: 'Borowska', imie: 'Beata' });
  const c = dodajOsobe(db, { nazwisko: 'Cieślak', imie: 'Cezary' });

  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc });
  wpis(db, spolka, 'objecie', '2026-01-10', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    pozycje: [{ osoba_id: a, ilosc }],
  });

  return { db, spolka, a, b, c, emisjaId: emisja.zdarzenie.id };
}

function akcjonariat(db, spolka, data) {
  const stan = stanLogika.odtworzStan(rejestr.wczytajZdarzenia(db, spolka));
  return stanLogika.akcjonariatNaDzien(stan, data);
}

test('przeniesienie CALOSCI pakietu usuwa zbywce z akcjonariatu', () => {
  const { db, spolka, a, b, emisjaId } = przygotuj();

  wpis(db, spolka, 'przeniesienie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: a,
    pozycje: [{ nabywca_osoba_id: b, ilosc: 100 }],
  });

  const wynik = akcjonariat(db, spolka, '2026-02-01');
  assert.equal(wynik.pozycje.length, 1);
  assert.equal(wynik.pozycje[0].osoba_id, b);
  assert.equal(wynik.pozycje[0].ilosc, 100);
  assert.equal(wynik.pozycje[0].procent, 100);
  assert.equal(n.opisz(wynik.pozycje[0].zakresy), '1–100');
});

test('przeniesienie CZESCI rozcina pakiet, reszta zostaje u zbywcy', () => {
  const { db, spolka, a, b, emisjaId } = przygotuj();

  wpis(db, spolka, 'przeniesienie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: a,
    pozycje: [{ nabywca_osoba_id: b, ilosc: 30 }],
  });

  const wynik = akcjonariat(db, spolka, '2026-02-01');
  const wgOsoby = new Map(wynik.pozycje.map((p) => [p.osoba_id, p]));
  assert.equal(n.opisz(wgOsoby.get(b).zakresy), '1–30', 'nabywca dostaje najnizsze wolne numery');
  assert.equal(n.opisz(wgOsoby.get(a).zakresy), '31–100');
  assert.equal(wgOsoby.get(a).ilosc, 70);
  assert.equal(wynik.razem_akcji, 100);
});

test('WIELU NABYWCOW w jednym zdarzeniu - zakresy rozlaczne, przydzial po kolei', () => {
  const { db, spolka, a, b, c, emisjaId } = przygotuj();

  wpis(db, spolka, 'przeniesienie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: a,
    pozycje: [
      { nabywca_osoba_id: b, ilosc: 25 },
      { nabywca_osoba_id: c, ilosc: 15 },
    ],
  });

  const wynik = akcjonariat(db, spolka, '2026-02-01');
  const wgOsoby = new Map(wynik.pozycje.map((p) => [p.osoba_id, p]));
  assert.equal(n.opisz(wgOsoby.get(b).zakresy), '1–25');
  assert.equal(n.opisz(wgOsoby.get(c).zakresy), '26–40');
  assert.equal(n.opisz(wgOsoby.get(a).zakresy), '41–100');
  assert.equal(wynik.razem_akcji, 100);

  // Zadna akcja nie zostala przypisana dwa razy.
  const stan = stanLogika.odtworzStan(rejestr.wczytajZdarzenia(db, spolka));
  assert.deepEqual(stanLogika.sprawdzBilans(stan), []);
});

test('przeniesienie wszystkich akcji do wielu nabywcow oproznia pakiet zbywcy', () => {
  const { db, spolka, a, b, c, emisjaId } = przygotuj();

  wpis(db, spolka, 'przeniesienie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: a,
    pozycje: [
      { nabywca_osoba_id: b, ilosc: 60 },
      { nabywca_osoba_id: c, ilosc: 40 },
    ],
  });

  const wynik = akcjonariat(db, spolka, '2026-02-01');
  assert.equal(wynik.pozycje.some((p) => p.osoba_id === a), false);
  assert.equal(wynik.razem_akcji, 100);
});

test('reczne wskazanie zakresu ma pierwszenstwo przed FIFO', () => {
  const { db, spolka, a, b, emisjaId } = przygotuj();

  wpis(db, spolka, 'przeniesienie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: a,
    pozycje: [{ nabywca_osoba_id: b, ilosc: 10, zakresy: [{ nr_od: 50, nr_do: 59 }] }],
  });

  const wynik = akcjonariat(db, spolka, '2026-02-01');
  const wgOsoby = new Map(wynik.pozycje.map((p) => [p.osoba_id, p]));
  assert.equal(n.opisz(wgOsoby.get(b).zakresy), '50–59');
  assert.equal(n.opisz(wgOsoby.get(a).zakresy), '1–49, 60–100', 'pakiet zbywcy rozpada sie na dwa bloki');
});

test('FIFO na pakiecie nieciaglym bierze najnizszy wolny numer', () => {
  const { db, spolka, a, b, c, emisjaId } = przygotuj();

  // Najpierw wycinamy zbywcy dziure w srodku pakietu.
  wpis(db, spolka, 'przeniesienie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: a,
    pozycje: [{ nabywca_osoba_id: c, ilosc: 10, zakresy: [{ nr_od: 5, nr_do: 14 }] }],
  });
  // Teraz zwykle FIFO: 1–4 to najnizsze wolne, reszta z bloku za dziura.
  wpis(db, spolka, 'przeniesienie', '2026-02-02', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: a,
    pozycje: [{ nabywca_osoba_id: b, ilosc: 10 }],
  });

  const wynik = akcjonariat(db, spolka, '2026-02-02');
  const wgOsoby = new Map(wynik.pozycje.map((p) => [p.osoba_id, p]));
  assert.equal(n.opisz(wgOsoby.get(b).zakresy), '1–4, 15–20');
  assert.equal(n.opisz(wgOsoby.get(a).zakresy), '21–100');
});

test('lancuch przeniesien A → B → C i odbudowa stanu', () => {
  const { db, spolka, a, b, c, emisjaId } = przygotuj();

  wpis(db, spolka, 'przeniesienie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: a,
    pozycje: [{ nabywca_osoba_id: b, ilosc: 50 }],
  });
  wpis(db, spolka, 'przeniesienie', '2026-03-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: b,
    pozycje: [{ nabywca_osoba_id: c, ilosc: 20 }],
  });

  const wynik = akcjonariat(db, spolka, '2026-03-01');
  const wgOsoby = new Map(wynik.pozycje.map((p) => [p.osoba_id, p]));
  assert.equal(wgOsoby.get(a).ilosc, 50);
  assert.equal(wgOsoby.get(b).ilosc, 30);
  assert.equal(wgOsoby.get(c).ilosc, 20);

  const zapytanie =
    'SELECT emisja_id, kategoria, osoba_id, nr_od, nr_do, data_od, data_do FROM psa_stan_akcji WHERE spolka_id = ? ORDER BY nr_od, data_od, data_do';
  const przed = db.prepare(zapytanie).all(spolka);
  rejestr.przelicz(db, spolka);
  assert.deepEqual(db.prepare(zapytanie).all(spolka), przed);
});

test('data nabycia pozostalej czesci pakietu nie zmienia sie po czesciowym zbyciu', () => {
  const { db, spolka, a, b, emisjaId } = przygotuj();

  wpis(db, spolka, 'przeniesienie', '2026-05-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: a,
    pozycje: [{ nabywca_osoba_id: b, ilosc: 10 }],
  });

  const reszta = db
    .prepare(
      `SELECT data_od FROM psa_stan_akcji
       WHERE spolka_id = ? AND osoba_id = ? AND data_do IS NULL`
    )
    .get(spolka, a);
  assert.equal(reszta.data_od, '2026-01-10', 'zbywca posiada resztę od dnia objęcia, nie od dnia zbycia');
});

test('dwie pozycje nie moga siegac po te same akcje', () => {
  const { db, spolka, a, b, c, emisjaId } = przygotuj();
  assert.throws(
    () =>
      wpis(db, spolka, 'przeniesienie', '2026-02-01', {
        emisja_zdarzenie_id: emisjaId,
        zbywca_osoba_id: a,
        pozycje: [
          { nabywca_osoba_id: b, ilosc: 10, zakresy: [{ nr_od: 1, nr_do: 10 }] },
          { nabywca_osoba_id: c, ilosc: 5, zakresy: [{ nr_od: 5, nr_do: 9 }] },
        ],
      }),
    /nie są dostępne|dwukrotnie/
  );
});

test('zbywca i nabywca nie moga byc ta sama osoba', () => {
  const { db, spolka, a, emisjaId } = przygotuj();
  assert.throws(
    () =>
      wpis(db, spolka, 'przeniesienie', '2026-02-01', {
        emisja_zdarzenie_id: emisjaId,
        zbywca_osoba_id: a,
        pozycje: [{ nabywca_osoba_id: a, ilosc: 10 }],
      }),
    /ta sama osoba/
  );
});

test('przeniesienie jednej akcji - najmniejszy mozliwy pakiet', () => {
  const { db, spolka, a, b, emisjaId } = przygotuj({ ilosc: 1 });

  wpis(db, spolka, 'przeniesienie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: a,
    pozycje: [{ nabywca_osoba_id: b, ilosc: 1 }],
  });

  const wynik = akcjonariat(db, spolka, '2026-02-01');
  assert.equal(wynik.pozycje.length, 1);
  assert.equal(wynik.pozycje[0].osoba_id, b);
  assert.equal(n.opisz(wynik.pozycje[0].zakresy), '1');
});
