'use strict';

/**
 * D-R01 — stan rejestru liczony wyłącznie od chwili wpisu (art. 300³⁷ § 1
 * i art. 300³⁸ § 1 KSH). Kryteria akceptacji z docs/krn/PROMPT-CLAUDE-CODE-PSA-KRN.md.
 */
process.env.TZ = 'Europe/Warsaw';

const test = require('node:test');
const assert = require('node:assert/strict');

const rejestr = require('../server/rejestr');
const widoki = require('../server/widoki');
const { informacjaZRejestru } = require('../server/logika/informacja-dokument');
const { bazaTestowa, dodajSpolke, dodajOsobe, wpis } = require('./pomoc');

const KANCELARIA = { nazwa: 'Kancelaria Notarialna', adres: '', miejscowosc: '', email: '' };

function spolkaZAkcjonariuszem() {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const zbywca = dodajOsobe(db, { nazwisko: 'Zbywca', imie: 'Jan' });
  const nabywca = dodajOsobe(db, { nazwisko: 'Nabywca', imie: 'Anna' });
  const emisja = wpis(db, spolka, 'emisja', '2026-10-01', { seria: 'A', ilosc: 100 });
  wpis(db, spolka, 'objecie', '2026-10-01', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    pozycje: [{ osoba_id: zbywca, ilosc: 100 }],
  });
  return { db, spolka, zbywca, nabywca, emisjaId: emisja.zdarzenie.id };
}

function akcjonariusze(db, spolka, data) {
  return widoki.widokStanu(db, spolka, data).akcjonariusze.map((a) => [a.osoba_id, a.ilosc]);
}

function informacja(db, spolka, data) {
  const stan = widoki.widokStanu(db, spolka, data);
  return informacjaZRejestru({
    kancelaria: KANCELARIA,
    spolka: stan.spolka,
    data,
    stan,
    sporzadzono: '2026-10-07T10:00:00Z',
  });
}

test('umowa zbycia wpisana 06.10 o 14:00: na 05.10 zbywca, na 06.10 nabywca', () => {
  const { db, spolka, zbywca, nabywca, emisjaId } = spolkaZAkcjonariuszem();
  wpis(db, spolka, 'przeniesienie', '2026-10-06T14:00', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: zbywca,
    tytul_prawny: 'sprzedaż',
    pozycje: [{ nabywca_osoba_id: nabywca, ilosc: 100 }],
  });

  assert.deepEqual(akcjonariusze(db, spolka, '2026-10-05'), [[zbywca, 100]]);
  assert.deepEqual(akcjonariusze(db, spolka, '2026-10-06'), [[nabywca, 100]]);
  // Tego samego dnia przed wpisem akcjonariuszem jest jeszcze zbywca.
  assert.deepEqual(akcjonariusze(db, spolka, '2026-10-06T13:59'), [[zbywca, 100]]);
});

test('informacja „stan na 05.10” jest identyczna przed i po wpisie z 06.10', () => {
  const { db, spolka, zbywca, nabywca, emisjaId } = spolkaZAkcjonariuszem();
  const sporzadzona0510 = informacja(db, spolka, '2026-10-05');

  wpis(db, spolka, 'przeniesienie', '2026-10-06T14:00', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: zbywca,
    pozycje: [{ nabywca_osoba_id: nabywca, ilosc: 100 }],
  });
  const sporzadzona0710 = informacja(db, spolka, '2026-10-05');

  assert.equal(sporzadzona0710, sporzadzona0510);
});

test('dziedziczenie wpisane 10.10: do 09.10 spadkodawca, od 10.10 spadkobierca', () => {
  const { db, spolka, zbywca, nabywca, emisjaId } = spolkaZAkcjonariuszem();
  const z = wpis(db, spolka, 'przeniesienie', '2026-10-10T09:00', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: zbywca,
    tytul_prawny: 'dziedziczenie',
    pozycje: [{ nabywca_osoba_id: nabywca, ilosc: 100 }],
  });

  assert.deepEqual(akcjonariusze(db, spolka, '2026-10-09'), [[zbywca, 100]]);
  assert.deepEqual(akcjonariusze(db, spolka, '2026-10-10'), [[nabywca, 100]]);
  // W modelu nie ma daty zdarzenia ani daty śmierci — jest tylko chwila wpisu.
  const zapisane = db.prepare('SELECT * FROM psa_zdarzenia WHERE id = ?').get(z.zdarzenie.id);
  assert.equal('data_zdarzenia' in zapisane, false);
  assert.equal(zapisane.data_wpisu, '2026-10-10T07:00:00Z');
});

test('sprostowanie działa od chwili swojego wpisu — informacja na dzień wcześniejszy bez zmian (A5)', () => {
  const { db, spolka, zbywca, nabywca, emisjaId } = spolkaZAkcjonariuszem();
  const przeniesienie = wpis(db, spolka, 'przeniesienie', '2026-10-06T14:00', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: zbywca,
    pozycje: [{ nabywca_osoba_id: nabywca, ilosc: 100 }],
  });
  const przed = informacja(db, spolka, '2026-10-07');

  rejestr.dokonajSprostowania(db, {
    zdarzeniePierwotneId: przeniesienie.zdarzenie.id,
    uzasadnienie: 'Pomyłka co do liczby akcji',
    zamiast: {
      typ: 'przeniesienie',
      dane: {
        emisja_zdarzenie_id: emisjaId,
        zbywca_osoba_id: zbywca,
        pozycje: [{ nabywca_osoba_id: nabywca, ilosc: 60 }],
      },
    },
    autor: 'Test',
    teraz: '2026-10-08T10:00',
  });

  assert.equal(informacja(db, spolka, '2026-10-07'), przed);
  assert.deepEqual(
    akcjonariusze(db, spolka, '2026-10-08').sort(),
    [[zbywca, 40], [nabywca, 60]].sort()
  );
});

test('integralność łańcucha po zapisach bez daty zdarzenia', () => {
  const { db, spolka, zbywca, nabywca, emisjaId } = spolkaZAkcjonariuszem();
  wpis(db, spolka, 'przeniesienie', '2026-10-06T14:00', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: zbywca,
    pozycje: [{ nabywca_osoba_id: nabywca, ilosc: 10 }],
  });
  const wynik = rejestr.zweryfikujIntegralnosc(db);
  assert.equal(wynik.ok, true);
  assert.equal(wynik.sprawdzono, 3);
});

test('migracja 57 odmawia wykonania na niepustym rejestrze', () => {
  const migracje = require('../server/migracje');
  const m57 = migracje.MIGRACJE.find((m) => m.wersja === 57);
  const { db } = spolkaZAkcjonariuszem();
  assert.throws(() => m57.warunek(db), /wymaga pustej tabeli psa_zdarzenia/);
});
