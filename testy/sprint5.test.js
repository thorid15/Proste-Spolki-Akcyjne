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
const walidacje = require('../server/logika/walidacje');
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

test('Z-057: 1/3+1/3+1/3 tego samego numeru -> 1 akcja w sumie i jeden glos, nie trzy (art. 300(23) § 1 w zw. z art. 300(38) § 3 KSH)', () => {
  const zdarzenia = [
    emisjaZdarzenie(1, { ilosc: 1 }),
    zdarzenie(2, 'objecie', '2026-01-02', {
      emisja_zdarzenie_id: 1, pozycje: [{ osoba_id: 100, zakresy: [{ nr_od: 1, nr_do: 1 }] }],
    }),
    zdarzenie(3, 'przeniesienie_ulamka', '2026-01-03', {
      emisja_zdarzenie_id: 1, nr: 1, zbywca_osoba_id: 100, nabywca_osoba_id: 200,
      czesc_licznik: 1, czesc_mianownik: 3,
    }),
    zdarzenie(4, 'przeniesienie_ulamka', '2026-01-04', {
      emisja_zdarzenie_id: 1, nr: 1, zbywca_osoba_id: 100, nabywca_osoba_id: 300,
      czesc_licznik: 1, czesc_mianownik: 3,
    }),
  ];
  const stan = stanLogika.odtworzStan(zdarzenia);
  const { pozycje, razem_akcji } = stanLogika.akcjonariatNaDzien(stan, '2026-01-04');

  // Bez wskazanego przedstawiciela zaden z trzech wspoluprawnionych nie
  // dostaje wlasnego glosu za ten numer, ale glos NIE PRZEPADA - kazda
  // pozycja jest oznaczona jako wymagajaca wskazania przedstawiciela.
  assert.equal(pozycje.length, 3);
  assert.equal(razem_akcji, 1, '1 akcja w sumie, nie trzy');
  const sumaIlosci = pozycje.reduce((s, p) => s + p.ilosc, 0);
  assert.ok(Math.abs(sumaIlosci - 1) < 1e-9, 'suma udzialow wspoluprawnionych = 1 akcja');
  for (const p of pozycje) {
    assert.equal(p.glosy, 0);
    assert.equal(p.wymaga_przedstawiciela, true);
  }
  const sumaGlosowBezPrzedstawiciela = pozycje.reduce((s, p) => s + p.glosy, 0);
  assert.equal(sumaGlosowBezPrzedstawiciela, 0, 'glos nie przepada - czeka na wskazanie przedstawiciela, nie znika');

  // Wskazanie 200 na przedstawiciela numeru 1 - TERAZ glos jest oddawany:
  // dokladnie JEDEN, wylacznie przez 200, nie po jednym na kazdego z trzech.
  const zdarzeniaZPrzedstawicielem = [
    ...zdarzenia,
    zdarzenie(5, 'przedstawiciel', '2026-01-05', {
      emisja_zdarzenie_id: 1, nr: 1, przedstawiciel_osoba_id: 200,
    }),
  ];
  const stanPo = stanLogika.odtworzStan(zdarzeniaZPrzedstawicielem);
  const wynikPo = stanLogika.akcjonariatNaDzien(stanPo, '2026-01-05');
  assert.equal(wynikPo.razem_akcji, 1);
  const pozycja200 = wynikPo.pozycje.find((p) => p.osoba_id === 200);
  const pozycja100 = wynikPo.pozycje.find((p) => p.osoba_id === 100);
  const pozycja300 = wynikPo.pozycje.find((p) => p.osoba_id === 300);
  assert.equal(pozycja200.glosy, 1, 'wspolny przedstawiciel oddaje JEDEN glos za caly numer');
  assert.equal(pozycja100.glosy, 0);
  assert.equal(pozycja300.glosy, 0);
  assert.equal(pozycja200.wymaga_przedstawiciela, false);
  assert.equal(pozycja100.wymaga_przedstawiciela, false);
  assert.equal(pozycja300.wymaga_przedstawiciela, false);
  const sumaGlosowPo = wynikPo.pozycje.reduce((s, p) => s + p.glosy, 0);
  assert.equal(sumaGlosowPo, 1, 'jeden glos w sumie za jeden podzielony numer, nie trzy');
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

test('blokada: emisji bez data_wpisu_krs w ogole sie nie zapisuje (art. 300(30) § 2 KSH)', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);

  assert.throws(() => {
    rejestr.dokonajWpisu(db, {
      spolkaId: spolka, typ: 'emisja', teraz: '2026-01-01',
      wejscie: { seria: 'A', ilosc: 10 }, autor: 'Test',
    });
  }, /daty wpisu do KRS/);
});

test('Z-012/P-006: emisja zalozycielska musi miec date wpisu do KRS rowna dacie rejestracji spolki', () => {
  const spolka = { id: 1, status: 'aktywna', data_utworzenia_spolki: '2026-03-10' };

  const zla = walidacje.sprawdz({
    zdarzenia: [],
    spolka,
    dzisiaj: '2026-12-31',
    propozycja: { typ: 'emisja', chwila: '2026-03-10', dane: { seria: 'A', ilosc: 100, nr_pierwszy: 1, data_wpisu_krs: '2026-03-15' } },
  });
  assert.equal(zla.dopuszczalne, false);
  assert.ok(zla.bledy.some((b) => /założycielska.*równą dacie rejestracji/.test(b)), zla.bledy.join(' | '));

  const dobra = walidacje.sprawdz({
    zdarzenia: [],
    spolka,
    dzisiaj: '2026-12-31',
    propozycja: { typ: 'emisja', chwila: '2026-03-10', dane: { seria: 'A', ilosc: 100, nr_pierwszy: 1, data_wpisu_krs: '2026-03-10' } },
  });
  assert.equal(dobra.dopuszczalne, true, dobra.bledy.join(' | '));
});

test('Z-012/P-006: kolejna emisja (podwyzszenie) musi miec date wpisu PO dacie rejestracji spolki, nigdy przed ani rowno', () => {
  const spolka = { id: 1, status: 'aktywna', data_utworzenia_spolki: '2026-03-10' };
  const zdarzenia = [emisjaZdarzenie(1, { data_wpisu_krs: '2026-03-10' })];

  const przed = walidacje.sprawdz({
    zdarzenia,
    spolka,
    dzisiaj: '2026-12-31',
    propozycja: { typ: 'emisja', chwila: '2026-05-01', dane: { seria: 'B', ilosc: 50, nr_pierwszy: 101, data_wpisu_krs: '2026-03-01' } },
  });
  assert.equal(przed.dopuszczalne, false);
  assert.ok(przed.bledy.some((b) => /musi być późniejsza/.test(b)), przed.bledy.join(' | '));

  const rowno = walidacje.sprawdz({
    zdarzenia,
    spolka,
    dzisiaj: '2026-12-31',
    propozycja: { typ: 'emisja', chwila: '2026-05-01', dane: { seria: 'B', ilosc: 50, nr_pierwszy: 101, data_wpisu_krs: '2026-03-10' } },
  });
  assert.equal(rowno.dopuszczalne, false, 'rowna dacie rejestracji spolki tez jest za wczesnie dla KOLEJNEJ emisji');

  const po = walidacje.sprawdz({
    zdarzenia,
    spolka,
    dzisiaj: '2026-12-31',
    propozycja: { typ: 'emisja', chwila: '2026-05-01', dane: { seria: 'B', ilosc: 50, nr_pierwszy: 101, data_wpisu_krs: '2026-05-01' } },
  });
  assert.equal(po.dopuszczalne, true, po.bledy.join(' | '));
});

test('Z-012/P-006: data wpisu emisji do KRS z przyszlosci jest odrzucona', () => {
  const wynik = walidacje.sprawdz({
    zdarzenia: [],
    spolka: { id: 1, status: 'aktywna' },
    dzisiaj: '2026-06-01',
    propozycja: { typ: 'emisja', chwila: '2026-05-01', dane: { seria: 'A', ilosc: 10, data_wpisu_krs: '2026-07-01' } },
  });
  assert.equal(wynik.dopuszczalne, false);
  assert.ok(wynik.bledy.some((b) => /z przyszłości/.test(b)), wynik.bledy.join(' | '));
});

/* Emisji bez daty wpisu do KRS nie da sie juz zapisac, ale w bazach zalozonych
   PRZED ta zmiana takie emisje siedza — dziennik zdarzen jest append-only, wiec
   nie znikna. Bramka przy objeciu zostaje wlasnie dla nich i sprawdzamy ja tam,
   gdzie mieszka: na samej walidacji, na recznie zlozonym dzienniku. */
test('blokada: objecie akcji jest odrzucane, gdy emisja nie ma data_wpisu_krs (wpisy sprzed zmiany)', () => {
  const dziennik = [emisjaZdarzenie(1)]; // bez `data_wpisu_krs`
  const wynik = walidacje.sprawdz({
    zdarzenia: dziennik,
    spolka: { id: 1, status: 'aktywna' },
    osoby: new Map([[7, { id: 7, nazwisko: 'Kowalski', imie: 'Jan' }]]),
    dzisiaj: '2026-02-01',
    propozycja: {
      typ: 'objecie',
      chwila: '2026-01-02',
      dane: { emisja_zdarzenie_id: 1, pozycje: [{ osoba_id: 7, zakresy: [{ nr_od: 1, nr_do: 10 }] }] },
    },
  });

  assert.equal(wynik.dopuszczalne, false);
  assert.ok(
    wynik.bledy.some((b) => /nie ma wpisu do KRS/.test(b)),
    `oczekiwano blokady wpisu przed KRS, dostano: ${wynik.bledy.join(' | ')}`
  );
});

test('sprostowanie emisji poprawia date wpisu do KRS, objecie dziala dalej', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const osoba = dodajOsobe(db);

  const emisja = rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'emisja', teraz: '2026-01-06',
    wejscie: { seria: 'A', ilosc: 10, data_wpisu_krs: '2026-01-05' }, autor: 'Test',
  });
  // Zla data wpisu do KRS prostuje sie zdarzeniem, nie edycja — dziennik jest
  // append-only.
  rejestr.dokonajSprostowania(db, {
    zdarzeniePierwotneId: emisja.zdarzenie.id,
    uzasadnienie: 'Sąd zarejestrował emisję w innej dacie',
    zamiast: { typ: 'emisja', dane: { seria: 'A', ilosc: 10, data_wpisu_krs: '2026-01-01' } },
    autor: 'Test',
    teraz: '2026-01-07',
  });

  const objecie = rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'objecie', teraz: '2026-01-08',
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
    spolkaId: spolka, typ: 'emisja', teraz: '2026-01-01',
    wejscie: { seria: 'A', ilosc: 10, data_wpisu_krs: '2026-01-01' }, autor: 'Test',
  });
  rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'objecie', teraz: '2026-01-02',
    wejscie: {
      emisja_zdarzenie_id: emisja.zdarzenie.id,
      pozycje: [{ osoba_id: zbywca, ilosc: 10, pokryta: 'nie' }],
    },
    autor: 'Test',
  });

  assert.throws(() => {
    rejestr.dokonajWpisu(db, {
      spolkaId: spolka, typ: 'przeniesienie_ulamka', teraz: '2026-01-03',
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
    spolkaId: spolka, typ: 'przeniesienie_ulamka', teraz: '2026-01-03',
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

test('Z-054: blokada zbycia niepokrytych CALYCH akcji dziala przy KAZDYM kolejnym przeniesieniu, nie tylko pierwszym (art. 300(40) § 1 KSH)', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const a = dodajOsobe(db, { nazwisko: 'Adamski' });
  const b = dodajOsobe(db, { nazwisko: 'Borowska' });
  const c = dodajOsobe(db, { nazwisko: 'Cieslak' });

  const emisja = rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'emisja', teraz: '2026-01-01',
    wejscie: { seria: 'A', ilosc: 10, data_wpisu_krs: '2026-01-01' }, autor: 'Test',
  });
  rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'objecie', teraz: '2026-01-02',
    wejscie: { emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: a, ilosc: 10, pokryta: 'nie' }] },
    autor: 'Test',
  });

  // Pierwsze zbycie niepokrytych akcji bez zgody spolki - odrzucone.
  assert.throws(() => {
    rejestr.dokonajWpisu(db, {
      spolkaId: spolka, typ: 'przeniesienie', teraz: '2026-01-03',
      wejscie: { emisja_zdarzenie_id: emisja.zdarzenie.id, zbywca_osoba_id: a, pozycje: [{ nabywca_osoba_id: b, ilosc: 10 }] },
      autor: 'Test',
    });
  }, /nie są w pełni pokryte/);

  // Ze zgoda - przechodzi. Wzmianka o pokryciu MUSI przejsc na nabywce B
  // niezmieniona ('nie'), nie zzerowac sie do null ("nieustalone").
  rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'przeniesienie', teraz: '2026-01-03',
    wejscie: {
      emisja_zdarzenie_id: emisja.zdarzenie.id, zbywca_osoba_id: a,
      pozycje: [{ nabywca_osoba_id: b, ilosc: 10 }], zgoda_spolki_niepelne_pokrycie: true,
    },
    autor: 'Test',
  });
  const stanPoPierwszym = stanLogika.odtworzStan(rejestr.wczytajZdarzenia(db, spolka));
  const pozycjaB = stanLogika.otwarte(stanPoPierwszym).find(
    (p) => p.kategoria === 'akcjonariusz' && Number(p.osoba_id) === b
  );
  assert.equal(pozycjaB.pokryta, 'nie', 'pokrycie akcji przechodzi na nabywce, nie zeruje sie');

  // DRUGIE zbycie (B -> C) TYCH SAMYCH, wciaz niepokrytych akcji, bez zgody -
  // przed naprawa Z-054 przechodziloby bez przeszkod, bo `otworz()` dostawal
  // `pokryta: undefined` przy pierwszym przeniesieniu i zerowal go do null.
  assert.throws(() => {
    rejestr.dokonajWpisu(db, {
      spolkaId: spolka, typ: 'przeniesienie', teraz: '2026-01-04',
      wejscie: { emisja_zdarzenie_id: emisja.zdarzenie.id, zbywca_osoba_id: b, pozycje: [{ nabywca_osoba_id: c, ilosc: 10 }] },
      autor: 'Test',
    });
  }, /nie są w pełni pokryte/);

  // Ze zgoda spolki drugie zbycie tez przechodzi.
  const wpisDrugi = rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'przeniesienie', teraz: '2026-01-04',
    wejscie: {
      emisja_zdarzenie_id: emisja.zdarzenie.id, zbywca_osoba_id: b,
      pozycje: [{ nabywca_osoba_id: c, ilosc: 10 }], zgoda_spolki_niepelne_pokrycie: true,
    },
    autor: 'Test',
  });
  assert.ok(wpisDrugi.zdarzenie.id);
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

/**
 * Naprawa Z-203: bramka AML rozroznia nabywce-osobe fizyczna i prawna w
 * tresci komunikatu (bez blokowania - P-013 - i bez osobnego sygnalu o
 * braku wskazania beneficjenta rzeczywistego, ktore P-001 celowo zostawia
 * bez zadnego ostrzezenia).
 */
test('Z-203: ostrzezenie AML rozroznia nabywce-osobe prawna od fizycznej w tresci komunikatu', () => {
  const dziennik = [emisjaZdarzenie(1, { data_wpisu_krs: '2026-01-01' })];

  const wynikPrawna = walidacje.sprawdz({
    zdarzenia: dziennik,
    spolka: { id: 1, status: 'aktywna' },
    osoby: new Map([[7, { id: 7, typ: 'prawna', nazwa: 'Inwestor Sp. z o.o.', aml_status: 'brak' }]]),
    dzisiaj: '2026-02-01',
    propozycja: {
      typ: 'objecie',
      chwila: '2026-01-02',
      dane: { emisja_zdarzenie_id: 1, pozycje: [{ osoba_id: 7, zakresy: [{ nr_od: 1, nr_do: 10 }] }] },
    },
  });
  assert.equal(wynikPrawna.dopuszczalne, true, wynikPrawna.bledy.join(' | '));
  assert.ok(
    wynikPrawna.ostrzezenia.some((o) => /nabywcy \(podmiotu\)/.test(o) && /Inwestor Sp\. z o\.o\./.test(o)),
    wynikPrawna.ostrzezenia.join(' | ')
  );

  const wynikFizyczna = walidacje.sprawdz({
    zdarzenia: dziennik,
    spolka: { id: 1, status: 'aktywna' },
    osoby: new Map([[8, { id: 8, typ: 'fizyczna', nazwisko: 'Kowalski', imie: 'Jan', aml_status: 'brak' }]]),
    dzisiaj: '2026-02-01',
    propozycja: {
      typ: 'objecie',
      chwila: '2026-01-02',
      dane: { emisja_zdarzenie_id: 1, pozycje: [{ osoba_id: 8, zakresy: [{ nr_od: 1, nr_do: 10 }] }] },
    },
  });
  assert.equal(wynikFizyczna.dopuszczalne, true, wynikFizyczna.bledy.join(' | '));
  assert.ok(
    wynikFizyczna.ostrzezenia.some((o) => /^Wobec nabywcy „Kowalski Jan”/.test(o)),
    wynikFizyczna.ostrzezenia.join(' | ')
  );
  assert.ok(!wynikFizyczna.ostrzezenia.some((o) => /podmiotu/.test(o)), 'osoba fizyczna nie dostaje etykiety "podmiotu"');
});
