'use strict';

/**
 * Faza 1 — rdzeń rejestru: schemat (U-01), łańcuch i tylko dopisywanie, odtworzenie stanu, każda
 * operacja, bilans, ułamki, sprostowanie, blokady R6, liczba niezgodna z numerami (R8), stany
 * sprawy, opłata (U-02), z urzędu (R3), edycja danych z historią (U-25), stan na dzień (U-22).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const migracje = require('../server/migracje');
const rejestr = require('../server/rejestr');
const sprawy = require('../server/sprawy');
const stan = require('../server/logika/stan');
const sprawyLogika = require('../server/logika/sprawy');
const osobyLogika = require('../server/logika/osoby');
const daneOsoby = require('../server/dane/osoby');
const daneSpolki = require('../server/dane/spolki');
const daneRejestr = require('../server/dane/rejestr');
const historia = require('../server/dane/historia');
const pisma = require('../server/logika/pisma');
const czas = require('../server/pomocnicze/czas');
const { bazaTestowa, dodajSpolke, dodajOsobe, wpisz, otworz, akcjonariat, CHECKLISTA_PELNA } = require('./pomoc');

const SERIA_A = { seria: 'A', numery: '1-200', liczba: 200, data_wpisu_krs: '2026-01-10' };
const akcje = (numery, liczba, seria = 'A', ulamek) => ({ seria, numery, liczba, ...(ulamek ? { ulamek } : {}) });

/** Spółka z otwartym rejestrem: A ma A 1–100, B ma A 101–200; C bez akcji. */
function spolkaZRejestrem() {
  const db = bazaTestowa();
  const s = dodajSpolke(db);
  const a = dodajOsobe(db, { nazwa: 'Anna A' });
  const b = dodajOsobe(db, { nazwa: 'Bartosz B' });
  const c = dodajOsobe(db, { nazwa: 'Cezary C' });
  otworz(db, s, {
    serie: [SERIA_A],
    akcjonariusze: [
      { osoba_id: a, akcje: [akcje('1-100', 100)] },
      { osoba_id: b, akcje: [akcje('101-200', 100)] },
    ],
  });
  return { db, s, a, b, c };
}

function odrzucone(fn, fragment) {
  assert.throws(fn, (e) => {
    assert.equal(e.name, 'BladWalidacji', e.message);
    const komunikaty = e.bledy.map((b) => b.komunikat).join(' | ');
    assert.ok(komunikaty.includes(fragment), `brak „${fragment}” w: ${komunikaty}`);
    return true;
  });
}

function atrybut(db, s, rodzaj) {
  const a = stan.widok(rejestr.stanSpolki(db, s)).atrybuty.find((x) => x.rodzaj === rodzaj);
  return { zdarzenie_id: a.zdarzenie_id, pozycja: a.pozycja };
}

// ─────────────────────────────────────────────────────────────
// Schemat (U-01)
// ─────────────────────────────────────────────────────────────

test('U-01: jeden schemat bazowy — 21 tabel psa_*, ponowne uruchomienie niczego nie zmienia', () => {
  const db = bazaTestowa();
  const tabele = db.prepare("SELECT COUNT(*) AS ile FROM sqlite_master WHERE type = 'table' AND name LIKE 'psa_%'").get().ile;
  assert.equal(tabele, 21);
  assert.deepEqual(migracje.uruchom(db), []);
  assert.ok(db.prepare("SELECT COUNT(*) AS ile FROM pragma_table_info('psa_osoby')").get().ile <= 15);
});

test('U-01: zakładanie schematu od nowa odmawia, gdy rejestr ma wpisy, a baza nie jest testowa', () => {
  const { db } = spolkaZRejestrem();
  db.prepare("UPDATE psa_migracje SET nazwa = 'inna wersja schematu'").run();
  assert.throws(() => migracje.uruchom(db), /odmawia działania/);
  assert.equal(db.prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia').get().ile, 1);

  db.prepare("INSERT INTO psa_baza_testowa (id, oznaczono, opis) VALUES (1, '2026-11-07', 'test')").run();
  assert.deepEqual(migracje.uruchom(db), [1]);
  assert.equal(db.prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia').get().ile, 0);
  assert.ok(db.prepare('SELECT 1 FROM psa_baza_testowa WHERE id = 1').get(), 'oznaczenie bazy testowej zostaje');
});

// ─────────────────────────────────────────────────────────────
// Łańcuch, tylko dopisywanie, odtworzenie
// ─────────────────────────────────────────────────────────────

test('psa_zdarzenia i psa_historia_danych — tylko dopisywanie (UPDATE i DELETE odrzucone)', () => {
  const { db, a } = spolkaZRejestrem();
  daneOsoby.zmien(db, a, { nazwa: 'Anna Nowa' }, 'Test');
  for (const sql of [
    "UPDATE psa_zdarzenia SET autor = 'X'",
    'DELETE FROM psa_zdarzenia',
    "UPDATE psa_historia_danych SET kto = 'X'",
    'DELETE FROM psa_historia_danych',
  ]) {
    assert.throws(() => db.prepare(sql).run(), /append-only/, sql);
  }
});

test('łańcuch skrótów: kontrola integralności przechodzi i wykrywa zmianę treści wpisu', () => {
  const { db, s, a, c } = spolkaZRejestrem();
  wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1-10', 10)] }] }]);
  assert.deepEqual(rejestr.zweryfikujIntegralnosc(db), { ok: true, sprawdzono: 2, blad: null });
  db.exec('DROP TRIGGER psa_zdarzenia_bez_update');
  db.prepare("UPDATE psa_zdarzenia SET dane_json = replace(dane_json, '\"nr_do\":10', '\"nr_do\":11') WHERE id = 2").run();
  const wynik = rejestr.zweryfikujIntegralnosc(db);
  assert.equal(wynik.ok, false);
  assert.equal(wynik.blad.rodzaj, 'zmieniona_tresc');

  const drugi = spolkaZRejestrem();
  wpisz(drugi.db, drugi.s, [{ typ: 'umorzenie', podstawa: 'uchwala', akcje: [akcje('1', 1)] }]);
  drugi.db.exec('DROP TRIGGER psa_zdarzenia_bez_delete');
  drugi.db.pragma('foreign_keys = OFF');
  drugi.db.prepare('DELETE FROM psa_zdarzenia WHERE id = 1').run();
  assert.equal(rejestr.zweryfikujIntegralnosc(drugi.db).blad.rodzaj, 'zerwane_ogniwo', 'usunięcie całego rekordu wykryte');
});

test('D-R01: chwilę wpisu nadaje system — wpis nie może poprzedzać ostatniego wpisu spółki', () => {
  const { db, s } = spolkaZRejestrem();
  czas.ustawPrzesuniecie(-24 * 60 * 60 * 1000);
  try {
    odrzucone(() => wpisz(db, s, [{ typ: 'umorzenie', podstawa: 'uchwala', akcje: [akcje('1', 1)] }]), 'Zegar systemu');
  } finally {
    czas.ustawPrzesuniecie(0);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia').get().ile, 1);
});

test('odtworzenie = stan bieżący: materializacje równe odtworzeniu ze wpisów; wpis bez danych osobowych (R10)', () => {
  const { db, s, a, b, c } = spolkaZRejestrem();
  wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('5', 1, 'A', '1/2'), akcje('20-30', 11)] }] }]);
  wpisz(db, s, [{ typ: 'umorzenie', podstawa: 'uchwala', akcje: [akcje('190-200', 11)] }]);
  wpisz(db, s, [{ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zastaw', osoba_id: c, prawo_glosu: true, akcje: [akcje('101-120', 20)] }]);
  wpisz(db, s, [{ typ: 'obciazenie', operacja: 'wykreslenie', atrybut: atrybut(db, s, 'zastaw'), akcje: [akcje('101-105', 5)] }]);
  wpisz(db, s, [{ typ: 'emisja', seria: 'B', numery: '1-50', liczba: 50, data_wpisu_krs: '2026-03-01', pokryte: false, obejmujacy: [{ osoba_id: b, numery: '1-50', liczba: 50 }] }]);

  const odtworzony = stan.odtworzStan(daneRejestr.zdarzeniaSpolki(db, s));
  const klucz = (w) => [w.seria, w.kategoria, w.osoba_id, w.nr_od, w.nr_do, w.czesc_licznik, w.czesc_mianownik, w.zdarzenie_od_id, w.data_od, w.zdarzenie_do_id, w.data_do].join('|');
  const zBazy = db.prepare('SELECT * FROM psa_stan_akcji WHERE spolka_id = ?').all(s).map(klucz).sort();
  assert.deepEqual(zBazy, odtworzony.przedzialy.map(klucz).sort());
  const kluczA = (w) => [w.zdarzenie_id, w.pozycja, w.rodzaj, w.seria, w.nr_od, w.nr_do, w.osoba_id, w.prawo_glosu, w.data_od, w.data_do].join('|');
  assert.deepEqual(
    db.prepare('SELECT * FROM psa_atrybuty WHERE spolka_id = ?').all(s).map(kluczA).sort(),
    odtworzony.atrybuty.map(kluczA).sort()
  );
  assert.deepEqual(stan.sprawdzBilans(odtworzony), []);
  for (const z of db.prepare('SELECT dane_json FROM psa_zdarzenia').all()) {
    assert.doesNotMatch(z.dane_json, /Anna|Bartosz|Cezary|Kraków/, 'w treści wpisu tylko identyfikatory osób');
  }
});

// ─────────────────────────────────────────────────────────────
// Operacje — tabelarycznie
// ─────────────────────────────────────────────────────────────

const OPERACJE = [
  {
    nazwa: 'emisja — nowa seria od razu u obejmujących, pokryta',
    operacje: ({ c }) => [{ typ: 'emisja', seria: 'B', numery: '1-50', liczba: 50, data_wpisu_krs: '2026-03-01', pokryte: true, obejmujacy: [{ osoba_id: c, numery: '1-50', liczba: 50 }] }],
    sprawdz: ({ db, s, c }) => {
      assert.equal(akcjonariat(db, s)[`${c}:B`], '1–50');
      const w = stan.widok(rejestr.stanSpolki(db, s));
      assert.equal(w.akcjonariusze.find((p) => p.seria === 'B').pokryte, true);
      assert.equal(w.serie.find((x) => x.seria === 'B').data_wpisu_krs, '2026-03-01');
    },
  },
  {
    nazwa: 'emisja niepokryta — adnotacja „niepokryte” na całej serii (U-17)',
    operacje: ({ c }) => [{ typ: 'emisja', seria: 'B', numery: '1-50', liczba: 50, data_wpisu_krs: '2026-03-01', pokryte: false, obejmujacy: [{ osoba_id: c, numery: '1-50', liczba: 50 }] }],
    sprawdz: ({ db, s }) => {
      const w = stan.widok(rejestr.stanSpolki(db, s));
      assert.equal(w.akcjonariusze.find((p) => p.seria === 'B').pokryte, false);
      assert.deepEqual(w.atrybuty.map((a) => [a.rodzaj, a.seria, a.zakresy]), [['niepokryte', 'B', [{ nr_od: 1, nr_do: 50 }]]]);
    },
  },
  {
    nazwa: 'przeniesienie całych akcji',
    operacje: ({ a, c }) => [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1-10', 10)] }] }],
    sprawdz: ({ db, s, a, c }) => {
      const m = akcjonariat(db, s);
      assert.equal(m[`${a}:A`], '11–100');
      assert.equal(m[`${c}:A`], '1–10');
    },
  },
  {
    nazwa: 'przeniesienie ułamka jednej akcji (art. 300⁴³)',
    operacje: ({ a, c }) => [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('5', 1, 'A', '1/3')] }] }],
    sprawdz: ({ db, s, a, c }) => {
      const m = akcjonariat(db, s);
      assert.equal(m[`${a}:A`], '1–4, 6–100; 5 (2/3)');
      assert.equal(m[`${c}:A`], '5 (1/3)');
    },
  },
  {
    nazwa: 'umorzenie — akcje przestają istnieć, podstawa w stanie',
    operacje: () => [{ typ: 'umorzenie', podstawa: 'orzeczenie', akcje: [akcje('1-10', 10)] }],
    sprawdz: ({ db, s, a }) => {
      assert.equal(akcjonariat(db, s)[`${a}:A`], '11–100');
      assert.deepEqual(stan.widok(rejestr.stanSpolki(db, s)).serie[0].umorzone, [{ nr_od: 1, nr_do: 10 }]);
    },
  },
  {
    nazwa: 'obciążenie — ustanowienie zastawu z prawem głosu',
    operacje: ({ c }) => [{ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zastaw', osoba_id: c, prawo_glosu: true, tresc: 'umowa zastawu', akcje: [akcje('1-10', 10)] }],
    sprawdz: ({ db, s, c }) => {
      const [z] = stan.widok(rejestr.stanSpolki(db, s)).atrybuty;
      assert.deepEqual([z.rodzaj, z.osoba_id, z.prawo_glosu, z.tresc, z.zakresy], ['zastaw', c, true, 'umowa zastawu', [{ nr_od: 1, nr_do: 10 }]]);
    },
  },
  {
    nazwa: 'obciążenie — zmiana prawa głosu na części akcji',
    przed: ({ db, s, c }) => wpisz(db, s, [{ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'uzytkowanie', osoba_id: c, prawo_glosu: true, akcje: [akcje('1-10', 10)] }]),
    operacje: ({ db, s }) => [{ typ: 'obciazenie', operacja: 'zmiana_prawa_glosu', atrybut: atrybut(db, s, 'uzytkowanie'), prawo_glosu: false, akcje: [akcje('1-4', 4)] }],
    sprawdz: ({ db, s }) => {
      const at = stan.widok(rejestr.stanSpolki(db, s)).atrybuty.map((a) => [a.zakresy[0].nr_od, a.zakresy[0].nr_do, a.prawo_glosu]).sort((x, y) => x[0] - y[0]);
      assert.deepEqual(at, [[1, 4, false], [5, 10, true]]);
    },
  },
  {
    nazwa: 'obciążenie — wykreślenie z części akcji',
    przed: ({ db, s, c }) => wpisz(db, s, [{ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zastaw', osoba_id: c, akcje: [akcje('1-10', 10)] }]),
    operacje: ({ db, s }) => [{ typ: 'obciazenie', operacja: 'wykreslenie', atrybut: atrybut(db, s, 'zastaw'), akcje: [akcje('1-5', 5)] }],
    sprawdz: ({ db, s }) => {
      assert.deepEqual(stan.widok(rejestr.stanSpolki(db, s)).atrybuty.map((a) => a.zakresy), [[{ nr_od: 6, nr_do: 10 }]]);
    },
  },
  {
    nazwa: 'adnotacja — uprawnienie czyni akcje uprzywilejowanymi (U-17)',
    operacje: () => [{ typ: 'adnotacja', operacja: 'dodanie', rodzaj: 'uprawnienie', tresc: 'dwa głosy na akcję', akcje: [akcje('1-50', 50)] }],
    sprawdz: ({ db, s }) => {
      assert.deepEqual(stan.widok(rejestr.stanSpolki(db, s)).serie[0].uprzywilejowane, [{ nr_od: 1, nr_do: 50 }]);
    },
  },
  {
    nazwa: 'adnotacja — wykreślenie (np. „niepokryte” po pokryciu)',
    przed: ({ db, s }) => wpisz(db, s, [{ typ: 'adnotacja', operacja: 'dodanie', rodzaj: 'ograniczenie', tresc: 'zgoda zarządu na zbycie', akcje: [akcje('1-200', 200)] }]),
    operacje: ({ db, s }) => [{ typ: 'adnotacja', operacja: 'wykreslenie', atrybut: atrybut(db, s, 'ograniczenie'), akcje: [akcje('1-200', 200)] }],
    sprawdz: ({ db, s }) => assert.deepEqual(stan.widok(rejestr.stanSpolki(db, s)).atrybuty, []),
  },
  {
    nazwa: 'zamknięcie — rejestr zamknięty z powodem (U-14)',
    operacje: () => [{ typ: 'zamkniecie', powod: 'przekazanie' }],
    sprawdz: ({ db, s }) => {
      const sp = daneSpolki.wczytaj(db, s);
      assert.equal(sp.powod_zamkniecia, 'przekazanie');
      assert.equal(sp.data_zamkniecia, czas.dzisIso());
    },
  },
];

for (const p of OPERACJE) {
  test(`operacja: ${p.nazwa}`, () => {
    const ctx = spolkaZRejestrem();
    if (p.przed) p.przed(ctx);
    wpisz(ctx.db, ctx.s, p.operacje(ctx));
    p.sprawdz(ctx);
    assert.deepEqual(stan.sprawdzBilans(rejestr.stanSpolki(ctx.db, ctx.s)), []);
  });
}

// ─────────────────────────────────────────────────────────────
// Bilans i ułamki
// ─────────────────────────────────────────────────────────────

test('bilans (art. 300³¹ § 2): luka albo akcje u dwóch osób blokują otwarcie', () => {
  const db = bazaTestowa();
  const s = dodajSpolke(db);
  const a = dodajOsobe(db);
  const b = dodajOsobe(db);
  odrzucone(() => otworz(db, s, { serie: [SERIA_A], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-150', 150)] }] }), 'nie mają akcjonariusza');
  odrzucone(
    () => otworz(db, s, { serie: [SERIA_A], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-120', 120)] }, { osoba_id: b, akcje: [akcje('100-200', 101)] }] }),
    'więcej niż jednemu akcjonariuszowi'
  );
});

test('ułamki: współuprawnieni do jednej akcji — ułamki muszą dać całość', () => {
  const db = bazaTestowa();
  const s = dodajSpolke(db);
  const a = dodajOsobe(db);
  const b = dodajOsobe(db);
  const seria = { seria: 'A', numery: '1-2', liczba: 2, data_wpisu_krs: '2026-01-10' };
  odrzucone(
    () => otworz(db, s, { serie: [seria], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1', 1, 'A', '1/2'), akcje('2', 1)] }, { osoba_id: b, akcje: [akcje('1', 1, 'A', '1/3')] }] }),
    'sumują się do 5/6'
  );
  otworz(db, s, { serie: [seria], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1', 1, 'A', '1/2'), akcje('2', 1)] }, { osoba_id: b, akcje: [akcje('1', 1, 'A', '2/4')] }] });
  assert.deepEqual(akcjonariat(db, s), { [`${a}:A`]: '1 (1/2); 2', [`${b}:A`]: '1 (1/2)' });
});

test('ułamki: ułamek tylko dla jednej akcji; zbywca nie zbędzie więcej, niż ma; nabywca sumuje części', () => {
  const { db, s, a, c } = spolkaZRejestrem();
  odrzucone(
    () => wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1-2', 2, 'A', '1/2')] }] }]),
    'dokładnie jednej akcji'
  );
  wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('7', 1, 'A', '1/2')] }] }]);
  odrzucone(
    () => wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('7', 1, 'A', '2/3')] }] }]),
    'ponad stan posiadania'
  );
  odrzucone(
    () => wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('5-8', 4)] }] }]),
    'nie ma w całości akcji serii A nr 7'
  );
  wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('7', 1, 'A', '1/2')] }] }]);
  assert.equal(akcjonariat(db, s)[`${c}:A`], '7', 'dwie połowy dają całą akcję u nabywcy');
  assert.equal(akcjonariat(db, s)[`${a}:A`], '1–6, 8–100');
});

// ─────────────────────────────────────────────────────────────
// Sprostowanie — dla każdego typu
// ─────────────────────────────────────────────────────────────

function sprostuj(db, s, zdarzenieId, tryb, zamiast) {
  return wpisz(db, s, [{ typ: 'sprostowanie', zdarzenie_id: zdarzenieId, tryb, ...(zamiast ? { zamiast } : {}) }], { zadajacy: 'brak' });
}
const ostatniWpis = (db, s) => daneRejestr.zdarzeniaSpolki(db, s).pop().id;

const SPROSTOWANIA = [
  {
    typ: 'otwarcie (zastąpienie — błędny akcjonariusz)',
    wpis: null,
    tryb: 'zastap',
    zamiast: ({ a, c }) => ({ typ: 'otwarcie', zrodlo: 'zalozenie', serie: [SERIA_A], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-100', 100)] }, { osoba_id: c, akcje: [akcje('101-200', 100)] }] }),
    sprawdz: ({ db, s, b, c }) => {
      const m = akcjonariat(db, s);
      assert.equal(m[`${c}:A`], '101–200');
      assert.equal(m[`${b}:A`], undefined);
    },
  },
  {
    typ: 'emisja (zastąpienie — inny obejmujący)',
    wpis: ({ b }) => ({ typ: 'emisja', seria: 'B', numery: '1-5', liczba: 5, data_wpisu_krs: '2026-03-01', pokryte: true, obejmujacy: [{ osoba_id: b, numery: '1-5', liczba: 5 }] }),
    tryb: 'zastap',
    zamiast: ({ c }) => ({ typ: 'emisja', seria: 'B', numery: '1-5', liczba: 5, data_wpisu_krs: '2026-03-01', pokryte: true, obejmujacy: [{ osoba_id: c, numery: '1-5', liczba: 5 }] }),
    sprawdz: ({ db, s, b, c }) => {
      assert.equal(akcjonariat(db, s)[`${c}:B`], '1–5');
      assert.equal(akcjonariat(db, s)[`${b}:B`], undefined);
    },
  },
  {
    typ: 'przeniesienie (zastąpienie — inne numery)',
    wpis: ({ a, c }) => ({ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1-10', 10)] }] }),
    tryb: 'zastap',
    zamiast: ({ a, c }) => ({ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('11-20', 10)] }] }),
    sprawdz: ({ db, s, a, c }) => {
      assert.equal(akcjonariat(db, s)[`${c}:A`], '11–20');
      assert.equal(akcjonariat(db, s)[`${a}:A`], '1–10, 21–100');
    },
  },
  {
    typ: 'przeniesienie (wycofanie)',
    wpis: ({ a, c }) => ({ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1-10', 10)] }] }),
    tryb: 'wycofaj',
    sprawdz: ({ db, s, a, c }) => {
      assert.equal(akcjonariat(db, s)[`${a}:A`], '1–100');
      assert.equal(akcjonariat(db, s)[`${c}:A`], undefined);
    },
  },
  {
    typ: 'umorzenie (wycofanie)',
    wpis: () => ({ typ: 'umorzenie', podstawa: 'uchwala', akcje: [akcje('1-10', 10)] }),
    tryb: 'wycofaj',
    sprawdz: ({ db, s, a }) => assert.equal(akcjonariat(db, s)[`${a}:A`], '1–100'),
  },
  {
    typ: 'obciążenie (wycofanie)',
    wpis: ({ c }) => ({ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zastaw', osoba_id: c, akcje: [akcje('1-10', 10)] }),
    tryb: 'wycofaj',
    sprawdz: ({ db, s }) => assert.deepEqual(stan.widok(rejestr.stanSpolki(db, s)).atrybuty, []),
  },
  {
    typ: 'wykreślenie obciążenia (zastąpienie — wykreślenie z mniejszej liczby akcji)',
    przed: ({ db, s, c }) => wpisz(db, s, [{ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zastaw', osoba_id: c, akcje: [akcje('1-10', 10)] }]),
    wpis: ({ db, s }) => ({ typ: 'obciazenie', operacja: 'wykreslenie', atrybut: atrybut(db, s, 'zastaw'), akcje: [akcje('1-10', 10)] }),
    tryb: 'zastap',
    zamiast: () => ({ typ: 'obciazenie', operacja: 'wykreslenie', atrybut: { zdarzenie_id: 2, pozycja: 0 }, akcje: [akcje('1-4', 4)] }),
    sprawdz: ({ db, s }) => assert.deepEqual(stan.widok(rejestr.stanSpolki(db, s)).atrybuty.map((a) => a.zakresy), [[{ nr_od: 5, nr_do: 10 }]]),
  },
  {
    typ: 'adnotacja (zastąpienie treści)',
    wpis: () => ({ typ: 'adnotacja', operacja: 'dodanie', rodzaj: 'obowiazek', tresc: 'świadczenie A', akcje: [akcje('1-10', 10)] }),
    tryb: 'zastap',
    zamiast: () => ({ typ: 'adnotacja', operacja: 'dodanie', rodzaj: 'obowiazek', tresc: 'świadczenie B', akcje: [akcje('1-10', 10)] }),
    sprawdz: ({ db, s }) => assert.equal(stan.widok(rejestr.stanSpolki(db, s)).atrybuty[0].tresc, 'świadczenie B'),
  },
  {
    typ: 'zamknięcie (wycofanie — rejestr znów otwarty)',
    wpis: () => ({ typ: 'zamkniecie', powod: 'rozwiazanie_umowy' }),
    tryb: 'wycofaj',
    sprawdz: ({ db, s }) => {
      assert.equal(daneSpolki.wczytaj(db, s).data_zamkniecia, null);
      assert.equal(rejestr.stanSpolki(db, s).otwarty, true);
    },
  },
];

for (const p of SPROSTOWANIA) {
  test(`sprostowanie: ${p.typ}`, () => {
    const ctx = spolkaZRejestrem();
    if (p.przed) p.przed(ctx);
    if (p.wpis) wpisz(ctx.db, ctx.s, [p.wpis(ctx)]);
    const cel = ostatniWpis(ctx.db, ctx.s);
    sprostuj(ctx.db, ctx.s, cel, p.tryb, p.zamiast && p.zamiast(ctx));
    p.sprawdz(ctx);
    const wpisy = rejestr.stanSpolki(ctx.db, ctx.s).wpisy;
    const prostowany = wpisy.find((w) => w.id === cel);
    assert.ok(p.tryb === 'wycofaj' ? prostowany.wycofany : prostowany.sprostowany, 'historia pokazuje sprostowanie');
    assert.equal(ctx.db.prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia').get().ile, (p.przed ? 1 : 0) + (p.wpis ? 3 : 2), 'nic nie zostało usunięte');
  });
}

test('sprostowanie: formularz „Sprostuj” wypełniony treścią wpisu; otwarcia nie wycofuje się; sprostowania nie prostuje się', () => {
  const { db, s, a, c } = spolkaZRejestrem();
  wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1-10', 10)] }] }]);
  const cel = ostatniWpis(db, s);
  const { id } = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'brak', operacje: [{ typ: 'sprostowanie', zdarzenie_id: cel, tryb: 'zastap' }] }, 'Test');
  const [op] = sprawy.podglad(db, id).sprawa.operacje;
  assert.deepEqual(op.zamiast, { typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [{ seria: 'A', numery: '1–10', liczba: 10 }] }] });

  odrzucone(() => sprostuj(db, s, 1, 'wycofaj'), 'Otwarcia rejestru nie wycofuje się');
  sprostuj(db, s, cel, 'wycofaj');
  odrzucone(() => sprostuj(db, s, ostatniWpis(db, s), 'wycofaj'), 'Sprostowania nie prostuje się');
  const inna = dodajSpolke(db);
  odrzucone(() => sprostuj(db, inna, cel, 'wycofaj'), 'Wskaż wpis do sprostowania');
  odrzucone(() => wpisz(db, s, [{ typ: 'umorzenie', podstawa: 'uchwala', akcje: [akcje('90', 1)] }], { zadajacy: 'brak' }), 'wyłącznie sprostowania');
});

// ─────────────────────────────────────────────────────────────
// Blokady R6 i błędy przy polach (R8)
// ─────────────────────────────────────────────────────────────

test('R6: emisja bez daty wpisu do KRS, z przyszłości albo nie później niż rejestracja spółki', () => {
  const { db, s, c } = spolkaZRejestrem();
  const emisja = (data) => [{ typ: 'emisja', seria: 'B', numery: '1-5', liczba: 5, data_wpisu_krs: data, pokryte: true, obejmujacy: [{ osoba_id: c, numery: '1-5', liczba: 5 }] }];
  odrzucone(() => wpisz(db, s, emisja(null)), 'Podaj datę wpisu emisji do KRS');
  odrzucone(() => wpisz(db, s, emisja('2099-01-01')), 'jest z przyszłości');
  odrzucone(() => wpisz(db, s, emisja('2026-01-10')), 'musi być późniejsza niż data rejestracji spółki');
  odrzucone(() => wpisz(db, s, [{ ...emisja('2026-03-01')[0], pokryte: undefined }]), 'czy akcje są pokryte w całości');
});

test('R6: otwarcie — emisja założycielska ma datę rejestracji spółki; drugi raz rejestru nie otwiera się', () => {
  const db = bazaTestowa();
  const s = dodajSpolke(db);
  const a = dodajOsobe(db);
  odrzucone(() => otworz(db, s, { serie: [{ ...SERIA_A, data_wpisu_krs: '2026-02-01' }], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-200', 200)] }] }), 'Emisja założycielska');
  odrzucone(() => wpisz(db, s, [{ typ: 'umorzenie', podstawa: 'uchwala', akcje: [akcje('1', 1)] }]), 'nie został otwarty');
  otworz(db, s, { serie: [SERIA_A], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-200', 200)] }] });
  odrzucone(() => otworz(db, s, { serie: [SERIA_A], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-200', 200)] }] }), 'został już otwarty');
});

test('R6: rozporządzenie ponad stan posiadania; akcje nieistniejące; nieudany wpis nie zostawia śladu', () => {
  const { db, s, a, c } = spolkaZRejestrem();
  const hashPrzed = db.prepare('SELECT hash FROM psa_zdarzenia ORDER BY id DESC LIMIT 1').get().hash;
  odrzucone(() => wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('95-105', 11)] }] }]), 'ponad stan posiadania');
  odrzucone(() => wpisz(db, s, [{ typ: 'umorzenie', podstawa: 'uchwala', akcje: [akcje('195-205', 11)] }]), 'nie istnieją');
  odrzucone(() => wpisz(db, s, [{ typ: 'umorzenie', podstawa: 'uchwala', akcje: [akcje('1', 1, 'Z')] }]), 'Seria „Z” nie istnieje');
  assert.equal(db.prepare('SELECT hash FROM psa_zdarzenia ORDER BY id DESC LIMIT 1').get().hash, hashPrzed);
  assert.equal(db.prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia').get().ile, 1);
});

test('R6: rejestr zamknięty — wpisy niemożliwe poza sprostowaniem zamknięcia', () => {
  const { db, s, a, c } = spolkaZRejestrem();
  wpisz(db, s, [{ typ: 'zamkniecie', powod: 'wykreslenie_spolki' }]);
  odrzucone(() => wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1', 1)] }] }]), 'Rejestr spółki jest zamknięty');
  odrzucone(() => sprostuj(db, s, 1, 'zastap', { typ: 'otwarcie', zrodlo: 'zalozenie', serie: [SERIA_A], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-200', 200)] }] }), 'Rejestr spółki jest zamknięty');
  sprostuj(db, s, ostatniWpis(db, s), 'wycofaj');
  wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1', 1)] }] }]);
});

test('R5/R6: checklista — trzy pozycje stałe i pozycje z atrybutów akcji; bez kompletu wpis zablokowany', () => {
  const { db, s, a, c } = spolkaZRejestrem();
  wpisz(db, s, [
    { typ: 'adnotacja', operacja: 'dodanie', rodzaj: 'ograniczenie', tresc: 'zgoda zarządu', akcje: [akcje('1-10', 10)] },
    { typ: 'adnotacja', operacja: 'dodanie', rodzaj: 'niepokryte', akcje: [akcje('1-10', 10)] },
  ]);
  wpisz(db, s, [{ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zajecie', akcje: [akcje('1-10', 10)] }], { zadajacy: 'organ', zadajacy_opis: 'Komornik — Km 1/26' });

  const { id } = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'osoba', zadajacy_osoba_id: c, operacje: [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1-10', 10)] }] }] }, 'Test');
  assert.deepEqual(sprawy.podglad(db, id).checklista.map((p) => p.klucz), ['zadajacy', 'dokumenty', 'identyfikacja', 'ograniczenie', 'zgoda_spolki', 'zajecie']);
  sprawy.dalej(db, id, 'Test');
  sprawy.zmien(db, id, { oplata: 'nie', zgody: [{ osoba_id: a, dopuszczalna: true, data: czas.dzisIso() }], checklista: { zadajacy: true, dokumenty: true, identyfikacja: true } }, 'Test');
  odrzucone(() => sprawy.zmienStan(db, id, 'wpisana', {}, 'Test'), 'Ograniczenie uwzględnione; Zgoda spółki na zbycie; Zbycie dopuszczalne mimo zajęcia');
  sprawy.zmien(db, id, { checklista: CHECKLISTA_PELNA }, 'Test');
  assert.equal(sprawy.zmienStan(db, id, 'wpisana', {}, 'Test').stan, 'wpisana');

  const glos = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'spolka', operacje: [{ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zastaw', osoba_id: c, prawo_glosu: true, akcje: [akcje('150', 1)] }] }, 'Test');
  assert.ok(sprawy.podglad(db, glos.id).checklista.some((p) => p.klucz === 'prawo_glosu'));
});

test('U-18: nieprawidłowy PESEL blokuje zapis osoby i wpis z jej udziałem', () => {
  assert.equal(osobyLogika.poprawnyPesel('44051401359'), true);
  assert.equal(osobyLogika.poprawnyPesel('44051401358'), false, 'suma kontrolna');
  assert.equal(osobyLogika.poprawnyPesel('44133101350'), false, 'miesiąc 13');
  assert.deepEqual(osobyLogika.sprawdz({ typ: 'fizyczna', nazwa: 'X', adres: 'Y', pesel: '44051401358' }).bledy.map((b) => b.pole), ['pesel']);
  assert.deepEqual(osobyLogika.sprawdz({ typ: 'fizyczna', nazwa: 'X', adres: 'Y' }).bledy.map((b) => b.komunikat), ['Podaj PESEL albo datę urodzenia.']);

  const { db, s, a } = spolkaZRejestrem();
  const zly = dodajOsobe(db, { pesel: '44051401358', data_urodzenia: null });
  odrzucone(() => wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: zly, akcje: [akcje('1', 1)] }] }]), 'nieprawidłowy PESEL');
});

test('R8: liczba akcji niezgodna z numerami i nieczytelne numery — błędy przy polach', () => {
  const { db, s, a, c } = spolkaZRejestrem();
  const { id } = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'spolka', operacje: [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1-10', 11), akcje('x', 1)] }] }] }, 'Test');
  assert.deepEqual(
    sprawy.podglad(db, id).bledy.map((b) => b.pole),
    ['operacje.0.nabywcy.0.akcje.0.liczba', 'operacje.0.nabywcy.0.akcje.1.numery']
  );
  odrzucone(() => sprawy.dalej(db, id, 'Test'), 'Liczba akcji (11) nie zgadza się z numerami 1–10 (10 akcji).');
});

// ─────────────────────────────────────────────────────────────
// Stany sprawy, opłata, z urzędu
// ─────────────────────────────────────────────────────────────

test('stany sprawy: tabela przejść (§ 3.3)', () => {
  const stany = Object.keys(sprawyLogika.PRZEJSCIA);
  assert.deepEqual(stany, ['w_toku', 'wstrzymana', 'wpisana', 'odmowa', 'wycofana']);
  const dozwolone = { w_toku: ['wstrzymana', 'wpisana', 'odmowa', 'wycofana'], wstrzymana: ['w_toku', 'odmowa', 'wycofana'] };
  for (const z of stany) {
    for (const na of stany) {
      const ok = (dozwolone[z] || []).includes(na);
      if (ok) assert.doesNotThrow(() => sprawyLogika.sprawdzPrzejscie(z, na), `${z} → ${na}`);
      else assert.throws(() => sprawyLogika.sprawdzPrzejscie(z, na), /nie może przejść/, `${z} → ${na}`);
    }
  }
});

test('stany sprawy: wstrzymanie (wezwanie), wznowienie (data usunięcia przeszkody), odmowa (przyczyna), wycofanie', () => {
  const { db, s, a, c } = spolkaZRejestrem();
  const op = [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1', 1)] }] }];
  const { id } = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'osoba', zadajacy_osoba_id: c, operacje: op }, 'Test');
  assert.equal(sprawy.podglad(db, id).sprawa.stan, 'w_toku', 'każda sprawa zaczyna od w_toku');
  odrzucone(() => sprawy.zmienStan(db, id, 'wstrzymana', {}, 'Test'), 'treść wezwania');
  sprawy.zmienStan(db, id, 'wstrzymana', { tresc_wezwania: 'Proszę dosłać umowę.' }, 'Test');
  assert.equal(sprawy.podglad(db, id).termin.zamrozony, true);
  odrzucone(() => sprawy.zmienStan(db, id, 'w_toku', { data_usuniecia_przeszkody: '2020-01-01' }, 'Test'), 'od dnia wstrzymania do dziś');
  const wzn = sprawy.zmienStan(db, id, 'w_toku', {}, 'Test');
  assert.equal(wzn.wznowiona_od, czas.dzisIso(), 'domyślnie dziś — brak nowych plików');
  sprawy.dalej(db, id, 'Test');
  odrzucone(() => sprawy.zmienStan(db, id, 'odmowa', {}, 'Test'), 'przyczynę odmowy');
  sprawy.zmienStan(db, id, 'odmowa', { przyczyna: 'Brak umowy zbycia.' }, 'Test');
  const typyPism = pisma.lista(db, { sprawaId: id }).map((p) => p.typ);
  assert.deepEqual(typyPism, ['powiadomienie_odmowa'], 'niewysłane wezwanie i powiadomienie o zamierzonym wpisie usunięte');
  odrzucone(() => sprawy.zmien(db, id, { podstawa: 'x' }, 'Test'), 'zakończona');
  odrzucone(() => sprawy.zmienStan(db, id, 'w_toku', {}, 'Test'), 'nie może przejść');

  const w = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'spolka', operacje: op }, 'Test');
  sprawy.dalej(db, w.id, 'Test');
  assert.equal(pisma.lista(db, { sprawaId: w.id }).length, 1);
  sprawy.zmienStan(db, w.id, 'wycofana', {}, 'Test');
  assert.equal(pisma.lista(db, { sprawaId: w.id }).length, 0, 'wycofanie usuwa niewysłane pisma');
});

test('U-02: odpłatna sprawa wymaga wyboru; „tak” — jedna opłata 100 zł netto od żądającego; nieodpłatna bez opłaty', () => {
  const { db, s, a, c } = spolkaZRejestrem();
  const op = [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1', 1)] }] }];
  odrzucone(() => wpisz(db, s, op, { zadajacy: 'osoba', zadajacy_osoba_id: c, oplata: null }), 'opłata 100 zł netto albo bez opłaty');
  const id = wpisz(db, s, op, { zadajacy: 'osoba', zadajacy_osoba_id: c, oplata: 'tak' });
  assert.deepEqual(
    db.prepare('SELECT typ, platnik, platnik_osoba_id, kwota_netto_grosze, stawka_vat_procent, stan FROM psa_oplaty WHERE sprawa_id = ?').all(id),
    [{ typ: 'wpis', platnik: 'osoba', platnik_osoba_id: c, kwota_netto_grosze: 10000, stawka_vat_procent: 23, stan: 'do_zaplaty' }]
  );
  wpisz(db, s, [{ ...op[0], nabywcy: [{ osoba_id: c, akcje: [akcje('2', 1)] }] }], { oplata: 'nie' });
  odrzucone(() => wpisz(db, s, [{ typ: 'adnotacja', operacja: 'dodanie', rodzaj: 'inna', tresc: 'x', akcje: [akcje('3', 1)] }], { oplata: 'tak' }), 'nie podlega opłacie');
  assert.equal(db.prepare("SELECT COUNT(*) AS ile FROM psa_oplaty WHERE typ = 'wpis'").get().ile, 1);
});

test('R3: zajęcie z urzędu — żądający organ, bez opłaty i bez powiadomień; nie łączy się z innymi zmianami', () => {
  const { db, s, a, c } = spolkaZRejestrem();
  const zajecie = { typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zajecie', akcje: [akcje('1-10', 10)] };
  odrzucone(() => wpisz(db, s, [zajecie]), 'wskaż organ');
  odrzucone(() => wpisz(db, s, [zajecie, { typ: 'umorzenie', podstawa: 'uchwala', akcje: [akcje('11', 1)] }], { zadajacy: 'organ', zadajacy_opis: 'Komornik' }), 'w osobnej sprawie');
  odrzucone(() => wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1', 1)] }] }], { zadajacy: 'organ', zadajacy_opis: 'Sąd' }), 'tylko przy zajęciu');
  const { id } = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'organ', zadajacy_opis: 'Komornik przy SR Gdańsk — Km 5/26', operacje: [zajecie], checklista: CHECKLISTA_PELNA }, 'Test');
  sprawy.dalej(db, id, 'Test');
  const p = sprawy.podglad(db, id);
  assert.deepEqual(p.osoby, []);
  assert.equal(p.oplata.wymagana, false);
  sprawy.zmienStan(db, id, 'wpisana', {}, 'Test');
  wpisz(db, s, [{ typ: 'obciazenie', operacja: 'wykreslenie', atrybut: atrybut(db, s, 'zajecie'), akcje: [akcje('1-10', 10)] }], { zadajacy: 'organ', zadajacy_opis: 'Komornik — Km 5/26' });
  assert.deepEqual(pisma.lista(db, {}).filter((x) => x.typ === 'powiadomienie_wpis' && x.adresat === 'organ').map((x) => x.kanal), ['list', 'list']);
});

test('idempotencja zakładania sprawy — ten sam klucz zwraca tę samą sprawę', () => {
  const { db, s } = spolkaZRejestrem();
  const raz = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'spolka', klucz_idempotencji: 'k-1' }, 'Test');
  const dwa = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'spolka', klucz_idempotencji: 'k-1' }, 'Test');
  assert.equal(dwa.id, raz.id);
  assert.equal(dwa.istniala, true);
});

// ─────────────────────────────────────────────────────────────
// Edycja danych (U-25) i stan na dzień (U-22)
// ─────────────────────────────────────────────────────────────

test('U-25: edycja osoby i spółki — zmiana w miejscu, wiersze historii, żadnego wpisu w łańcuchu', () => {
  const { db, s, a } = spolkaZRejestrem();
  const wpisyPrzed = db.prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia').get().ile;
  assert.equal(daneOsoby.zmien(db, a, { nazwa: 'Anna Kowalska', adres: 'ul. Nowa 1' }, 'Pracownik'), 2);
  assert.equal(daneOsoby.zmien(db, a, { nazwa: 'Anna Kowalska' }, 'Pracownik'), 0, 'bez zmiany — bez historii');
  assert.equal(daneSpolki.zmien(db, s, { nazwa: 'Nowa Firma P.S.A.', platnosc: 'miesieczna' }, 'Pracownik'), 2);
  assert.equal(daneOsoby.wczytaj(db, a).nazwa, 'Anna Kowalska');
  assert.deepEqual(
    historia.lista(db, { osobaId: a }).map((h) => [h.pole, h.stara, h.nowa, h.kto]).sort(),
    [['adres', 'ul. Długa 5, 30-002 Kraków', 'ul. Nowa 1', 'Pracownik'], ['nazwa', 'Anna A', 'Anna Kowalska', 'Pracownik']]
  );
  assert.deepEqual(historia.lista(db, { spolkaId: s }).map((h) => h.pole).sort(), ['nazwa', 'platnosc']);
  assert.equal(db.prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia').get().ile, wpisyPrzed);
});

test('U-22: stan na dzień — wpisy z danego dnia widoczne na jego koniec, późniejsze nie', () => {
  const { db, s, a, c } = spolkaZRejestrem();
  const dzis = czas.dzisIso();
  czas.ustawPrzesuniecie(2 * 24 * 60 * 60 * 1000);
  try {
    wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('1-10', 10)] }] }]);
    const naDzis = stan.widok(rejestr.stanSpolki(db, s, dzis));
    assert.equal(naDzis.akcjonariusze.some((p) => p.osoba_id === c), false);
    const biezacy = stan.widok(rejestr.stanSpolki(db, s));
    assert.equal(biezacy.akcjonariusze.find((p) => p.osoba_id === c).data_wpisu, czas.dzisIso());
  } finally {
    czas.ustawPrzesuniecie(0);
  }
});
