'use strict';

/**
 * Sprint 5 — zgodnosc z ustawa: ulamkowe czesci akcji (art. 300(2) § 3 +
 * art. 300(43) KSH), pokrycie akcji, blokada wpisu przed KRS, wspolny
 * przedstawiciel, migracja istniejacego stanu na 1/1.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const stanLogika = require('../server/logika/stan');
const rejestr = require('../server/rejestr');
const { bazaTestowa, dodajSpolke, dodajOsobe, wpis, zdarzenie } = require('./pomoc');

function emisjaZdarzenie(id, dane = {}) {
  return zdarzenie(id, 'emisja', '2026-01-01', { seria: 'A', nr_pierwszy: 1, ilosc: 10, ...dane });
}

// ─────────────────────────────────────────────────────────────
// Bilans per numer akcji (regula domenowa 3 + 4a) - logika czysta
// ─────────────────────────────────────────────────────────────

test('bilans: trzej wspoluprawnieni po 1/3 tego samego numeru sumuja sie do 1, bez bledu', () => {
  const zdarzenia = [
    emisjaZdarzenie(1),
    zdarzenie(2, 'objecie', '2026-01-02', {
      emisja_zdarzenie_id: 1,
      pozycje: [{ osoba_id: 100, zakresy: [{ nr_od: 1, nr_do: 10 }] }],
    }),
    zdarzenie(3, 'przeniesienie_ulamka', '2026-01-03', {
      emisja_zdarzenie_id: 1, nr: 5, zbywca_osoba_id: 100, nabywca_osoba_id: 200,
      czesc_licznik: 1, czesc_mianownik: 3,
    }),
    zdarzenie(4, 'przeniesienie_ulamka', '2026-01-04', {
      emisja_zdarzenie_id: 1, nr: 5, zbywca_osoba_id: 100, nabywca_osoba_id: 300,
      czesc_licznik: 1, czesc_mianownik: 3,
    }),
  ];
  const stan = stanLogika.odtworzStan(zdarzenia);
  assert.deepEqual(stanLogika.sprawdzBilans(stan), []);

  const naNumerze5 = stanLogika
    .otwarte(stan)
    .filter((p) => p.nr_od <= 5 && 5 <= p.nr_do && p.kategoria === stanLogika.KATEGORIE.AKCJONARIUSZ);
  assert.equal(naNumerze5.length, 3);
  const sumaLicznikow = naNumerze5.reduce((s, p) => s + p.czesc_licznik / p.czesc_mianownik, 0);
  assert.equal(Math.abs(sumaLicznikow - 1) < 1e-9, true);
});

test('bilans: ulamki niesumujace sie do 1 na tym samym numerze sa bledem blokujacym', () => {
  // Bezposrednia manipulacja stanu (poza normalnym handlerem) - symuluje
  // uszkodzony/niespojny zapis, zeby sprawdzic samo sprawdzBilans w izolacji.
  const stan = stanLogika.odtworzStan([
    emisjaZdarzenie(1),
    zdarzenie(2, 'objecie', '2026-01-02', {
      emisja_zdarzenie_id: 1,
      pozycje: [{ osoba_id: 100, zakresy: [{ nr_od: 1, nr_do: 10 }] }],
    }),
    zdarzenie(3, 'przeniesienie_ulamka', '2026-01-03', {
      emisja_zdarzenie_id: 1, nr: 5, zbywca_osoba_id: 100, nabywca_osoba_id: 200,
      czesc_licznik: 1, czesc_mianownik: 3,
    }),
  ]);
  // Zbywca powinien miec teraz 2/3 na numerze 5 - psujemy to recznie na 1/4,
  // zeby suma z nabywca (1/3) nie wynosila 1.
  const wiersz100 = stanLogika
    .otwarte(stan)
    .find((p) => p.osoba_id === 100 && p.nr_od === 5 && p.nr_do === 5);
  wiersz100.czesc_licznik = 1;
  wiersz100.czesc_mianownik = 4;

  const bledy = stanLogika.sprawdzBilans(stan);
  assert.equal(bledy.length > 0, true);
  assert.match(bledy.join(' '), /suma ułamków współuprawnionych do akcji nr 5/);
});

test('przeniesienie_ulamka: zbywca nie moze zbyc wiecej niz posiada', () => {
  assert.throws(() => {
    stanLogika.odtworzStan([
      emisjaZdarzenie(1),
      zdarzenie(2, 'objecie', '2026-01-02', {
        emisja_zdarzenie_id: 1,
        pozycje: [{ osoba_id: 100, zakresy: [{ nr_od: 1, nr_do: 10 }] }],
      }),
      zdarzenie(3, 'przeniesienie_ulamka', '2026-01-03', {
        emisja_zdarzenie_id: 1, nr: 5, zbywca_osoba_id: 100, nabywca_osoba_id: 200,
        czesc_licznik: 1, czesc_mianownik: 3,
      }),
      // Zbywcy zostalo 2/3 - proba zbycia calej (1/1) reszcie musi sie nie udac.
      zdarzenie(4, 'przeniesienie_ulamka', '2026-01-04', {
        emisja_zdarzenie_id: 1, nr: 5, zbywca_osoba_id: 100, nabywca_osoba_id: 300,
        czesc_licznik: 1, czesc_mianownik: 1,
      }),
    ]);
  }, stanLogika.BladStanu);
});

test('przeniesienie_ulamka: ulamek musi obejmowac dokladnie jeden numer (regula domenowa 4a)', () => {
  assert.throws(() => {
    stanLogika.odtworzStan([
      emisjaZdarzenie(1),
      zdarzenie(2, 'objecie', '2026-01-02', {
        emisja_zdarzenie_id: 1,
        pozycje: [{ osoba_id: 100, zakresy: [{ nr_od: 1, nr_do: 10 }] }],
      }),
      // nr poza zakresem (0) wywoluje BladStanu z ulamekOsobyNaNumerze==0 -> mniejszyRowny fail.
      zdarzenie(3, 'przeniesienie_ulamka', '2026-01-03', {
        emisja_zdarzenie_id: 1, nr: 999, zbywca_osoba_id: 100, nabywca_osoba_id: 200,
        czesc_licznik: 1, czesc_mianownik: 3,
      }),
    ]);
  }, stanLogika.BladStanu);
});

test('pula() wyklucza wiersze ulamkowe - zwykle przeniesienie nie moze zabrac czesciowej akcji jako calej', () => {
  const stan = stanLogika.odtworzStan([
    emisjaZdarzenie(1),
    zdarzenie(2, 'objecie', '2026-01-02', {
      emisja_zdarzenie_id: 1,
      pozycje: [{ osoba_id: 100, zakresy: [{ nr_od: 1, nr_do: 10 }] }],
    }),
    zdarzenie(3, 'przeniesienie_ulamka', '2026-01-03', {
      emisja_zdarzenie_id: 1, nr: 5, zbywca_osoba_id: 100, nabywca_osoba_id: 200,
      czesc_licznik: 1, czesc_mianownik: 3,
    }),
  ]);
  const pula100 = stanLogika.pula(stan, 1, stanLogika.KATEGORIE.AKCJONARIUSZ, 100);
  // Numer 5 NIE jest w puli calo-akcyjnej osoby 100, mimo ze wciaz ma tam 2/3.
  assert.deepEqual(pula100, [{ nr_od: 1, nr_do: 4 }, { nr_od: 6, nr_do: 10 }]);
});

test('przedstawiciel: musi istniec przynajmniej jeden uprawniony na wskazanym numerze', () => {
  assert.throws(() => {
    stanLogika.odtworzStan([
      emisjaZdarzenie(1),
      zdarzenie(2, 'przedstawiciel', '2026-01-02', {
        emisja_zdarzenie_id: 1, nr: 5, przedstawiciel_osoba_id: 200,
      }),
    ]);
  }, stanLogika.BladStanu);
});

test('pokrycie_akcji: wzmianka o pokryciu obejmuje wszystkie akcje akcjonariusza w danej emisji (art. 300(9) § 3 KSH)', () => {
  const stan = stanLogika.odtworzStan([
    emisjaZdarzenie(1),
    zdarzenie(2, 'objecie', '2026-01-02', {
      emisja_zdarzenie_id: 1,
      pozycje: [{ osoba_id: 100, zakresy: [{ nr_od: 1, nr_do: 10 }] }],
    }),
    zdarzenie(3, 'pokrycie_akcji', '2026-01-03', {
      emisja_zdarzenie_id: 1, osoba_id: 100, pokryta: 'czesciowo',
    }),
  ]);
  const wiersze = stanLogika.otwarte(stan).filter((p) => p.osoba_id === 100);
  assert.equal(wiersze.length, 1);
  assert.equal(wiersze[0].pokryta, 'czesciowo');
});

// ─────────────────────────────────────────────────────────────
// Migracja: istniejacy stan (sprzed sprintu 5) domyslnie 1/1
// ─────────────────────────────────────────────────────────────

test('migracja: zdarzenia sprzed sprintu 5 (bez pol ulamkowych w dane_json) odtwarzaja sie jako 1/1', () => {
  const stan = stanLogika.odtworzStan([
    emisjaZdarzenie(1),
    zdarzenie(2, 'objecie', '2026-01-02', {
      emisja_zdarzenie_id: 1,
      pozycje: [{ osoba_id: 100, zakresy: [{ nr_od: 1, nr_do: 10 }] }],
    }),
  ]);
  const wiersze = stanLogika.otwarte(stan).filter((p) => p.kategoria === stanLogika.KATEGORIE.AKCJONARIUSZ);
  assert.equal(wiersze.length, 1);
  assert.equal(wiersze[0].czesc_licznik, 1);
  assert.equal(wiersze[0].czesc_mianownik, 1);
  assert.equal(wiersze[0].przedstawiciel_osoba_id, null);
  assert.equal(wiersze[0].pokryta, null);
  assert.deepEqual(stanLogika.sprawdzBilans(stan), []);
});

// ─────────────────────────────────────────────────────────────
// Blokady (walidacje.js) — przez pelny stos rejestr.dokonajWpisu
// ─────────────────────────────────────────────────────────────

test('blokada: objecie akcji jest odrzucane, gdy emisja nie ma data_wpisu_krs (art. 300(30) § 2 KSH)', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const osoba = dodajOsobe(db);

  const emisja = rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'emisja', data_zdarzenia: '2026-01-01',
    wejscie: { seria: 'A', ilosc: 10 }, autor: 'Test',
  });

  assert.throws(() => {
    rejestr.dokonajWpisu(db, {
      spolkaId: spolka, typ: 'objecie', data_zdarzenia: '2026-01-02',
      wejscie: { emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: osoba, ilosc: 10 }] },
      autor: 'Test',
    });
  }, /nie ma wpisu do KRS/);
});

test('sprostowanie emisji o data_wpisu_krs odblokowuje objecie', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const osoba = dodajOsobe(db);

  const emisja = rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'emisja', data_zdarzenia: '2026-01-01',
    wejscie: { seria: 'A', ilosc: 10 }, autor: 'Test',
  });
  rejestr.dokonajSprostowania(db, {
    zdarzeniePierwotneId: emisja.zdarzenie.id,
    uzasadnienie: 'Uzupełnienie daty wpisu do KRS',
    zamiast: { typ: 'emisja', dane: { seria: 'A', ilosc: 10, data_wpisu_krs: '2026-01-01' } },
    autor: 'Test',
  });

  const objecie = rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'objecie', data_zdarzenia: '2026-01-02',
    wejscie: { emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: osoba, ilosc: 10 }] },
    autor: 'Test',
  });
  assert.ok(objecie.zdarzenie.id);
});

test('blokada: zbycie ulamka akcji nie w pelni pokrytej bez zgody spolki jest odrzucane (art. 300(40) § 1 KSH)', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const zbywca = dodajOsobe(db, { nazwisko: 'Zbywca' });
  const nabywca = dodajOsobe(db, { nazwisko: 'Nabywca' });

  const emisja = rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'emisja', data_zdarzenia: '2026-01-01',
    wejscie: { seria: 'A', ilosc: 10, data_wpisu_krs: '2026-01-01' }, autor: 'Test',
  });
  rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'objecie', data_zdarzenia: '2026-01-02',
    wejscie: {
      emisja_zdarzenie_id: emisja.zdarzenie.id,
      pozycje: [{ osoba_id: zbywca, ilosc: 10, pokryta: 'nie' }],
    },
    autor: 'Test',
  });

  assert.throws(() => {
    rejestr.dokonajWpisu(db, {
      spolkaId: spolka, typ: 'przeniesienie_ulamka', data_zdarzenia: '2026-01-03',
      wejscie: {
        emisja_zdarzenie_id: emisja.zdarzenie.id, nr: 3,
        zbywca_osoba_id: zbywca, nabywca_osoba_id: nabywca,
        czesc_licznik: 1, czesc_mianownik: 2,
      },
      autor: 'Test',
    });
  }, /nie są w pełni pokryte/);

  // Ze zgoda spolki - przechodzi.
  const wpisZgoda = rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'przeniesienie_ulamka', data_zdarzenia: '2026-01-03',
    wejscie: {
      emisja_zdarzenie_id: emisja.zdarzenie.id, nr: 3,
      zbywca_osoba_id: zbywca, nabywca_osoba_id: nabywca,
      czesc_licznik: 1, czesc_mianownik: 2,
      zgoda_spolki_niepelne_pokrycie: true,
    },
    autor: 'Test',
  });
  assert.ok(wpisZgoda.zdarzenie.id);
});

// ─────────────────────────────────────────────────────────────
// Pelny stos, przez kreator + materializacja do bazy
// ─────────────────────────────────────────────────────────────

test('pelny cykl: emisja -> objecie -> przeniesienie_ulamka -> przedstawiciel, materializacja w psa_stan_akcji', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const a = dodajOsobe(db, { nazwisko: 'Kowalski' });
  const b = dodajOsobe(db, { nazwisko: 'Nowak' });

  const emisja = wpis(db, spolka, 'emisja', '2026-01-01', { seria: 'A', ilosc: 10 });
  wpis(db, spolka, 'objecie', '2026-01-02', {
    emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: a, ilosc: 10, pokryta: 'tak' }],
  });
  wpis(db, spolka, 'przeniesienie_ulamka', '2026-01-03', {
    emisja_zdarzenie_id: emisja.zdarzenie.id, nr: 4, zbywca_osoba_id: a, nabywca_osoba_id: b,
    czesc_licznik: 1, czesc_mianownik: 4,
  });
  wpis(db, spolka, 'przedstawiciel', '2026-01-04', {
    emisja_zdarzenie_id: emisja.zdarzenie.id, nr: 4, przedstawiciel_osoba_id: b,
  });

  const wiersze = db
    .prepare(
      `SELECT osoba_id, czesc_licznik, czesc_mianownik, przedstawiciel_osoba_id, pokryta
         FROM psa_stan_akcji
        WHERE spolka_id = ? AND kategoria = 'akcjonariusz' AND nr_od <= 4 AND nr_do >= 4 AND data_do IS NULL
        ORDER BY osoba_id`
    )
    .all(spolka);

  assert.equal(wiersze.length, 2);
  const zA = wiersze.find((w) => w.osoba_id === a);
  const zB = wiersze.find((w) => w.osoba_id === b);
  assert.deepEqual(
    [zA.czesc_licznik, zA.czesc_mianownik],
    [3, 4]
  );
  assert.deepEqual(
    [zB.czesc_licznik, zB.czesc_mianownik],
    [1, 4]
  );
  assert.equal(zA.przedstawiciel_osoba_id, b);
  assert.equal(zB.przedstawiciel_osoba_id, b);
  assert.equal(zA.pokryta, 'tak');
  assert.equal(zB.pokryta, 'tak');

  // Odbudowa ze zdarzen = stan biezacy (regula domenowa nr 2).
  const { niezgodnosci } = rejestr.przelicz(db, spolka);
  assert.deepEqual(niezgodnosci, []);
  const poOdbudowie = db
    .prepare(
      `SELECT osoba_id, czesc_licznik, czesc_mianownik FROM psa_stan_akcji
        WHERE spolka_id = ? AND kategoria = 'akcjonariusz' AND nr_od <= 4 AND nr_do >= 4 AND data_do IS NULL
        ORDER BY osoba_id`
    )
    .all(spolka);
  assert.deepEqual(poOdbudowie, [
    { osoba_id: a, czesc_licznik: 3, czesc_mianownik: 4 },
    { osoba_id: b, czesc_licznik: 1, czesc_mianownik: 4 },
  ]);

  // Integralnosc lancucha nienaruszona.
  const integralnosc = rejestr.zweryfikujIntegralnosc(db);
  assert.equal(integralnosc.ok, true);
});
