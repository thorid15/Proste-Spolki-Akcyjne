'use strict';

/**
 * Sprint 2 - pozostale typy zdarzen: obciazenia, zajecia, prawo glosu
 * zastawnika, uprawnienia, ograniczenia, zmiana danych akcjonariusza,
 * sprostowanie.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { bazaTestowa, dodajSpolke, dodajOsobe, wpis } = require('./pomoc');
const rejestr = require('../server/rejestr');
const stanLogika = require('../server/logika/stan');
const n = require('../server/logika/numery');

function scenariusz() {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const kowalski = dodajOsobe(db, { nazwisko: 'Kowalski', imie: 'Jan' });
  const bank = dodajOsobe(db, { typ: 'prawna', nazwa: 'Bank Zastawny S.A.', nazwisko: null, aml_status: 'wykonane' });
  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 100 });
  wpis(db, spolka, 'objecie', '2026-01-10', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    pozycje: [{ osoba_id: kowalski, ilosc: 100 }],
  });
  return { db, spolka, kowalski, bank, emisjaId: emisja.zdarzenie.id };
}

function stanBiezacy(db, spolka) {
  return stanLogika.odtworzStan(rejestr.wczytajZdarzenia(db, spolka));
}

test('obciazenie: ustanowienie zastawu blokuje rozporzadzanie akcjami', () => {
  const { db, spolka, kowalski, bank, emisjaId } = scenariusz();

  const zdarzenieObciazenia = wpis(db, spolka, 'obciazenie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    akcjonariusz_osoba_id: kowalski,
    osoba_id: bank,
    typ_obciazenia: 'zastaw',
    ilosc: 30,
  });

  const stan = stanBiezacy(db, spolka);
  const obciazenia = stanLogika.obciazeniaNaDzien(stan, '2026-02-01');
  assert.equal(obciazenia.length, 1);
  assert.equal(n.opisz(obciazenia[0].zakresy), '1–30');
  assert.equal(obciazenia[0].blokuje_rozporzadzanie, 1);

  // Proba przeniesienia obciazonych akcji jest blokowana.
  assert.throws(
    () =>
      wpis(db, spolka, 'przeniesienie', '2026-02-05', {
        emisja_zdarzenie_id: emisjaId,
        zbywca_osoba_id: kowalski,
        pozycje: [{ nabywca_osoba_id: bank, ilosc: 10, zakresy: [{ nr_od: 1, nr_do: 9 }, { nr_od: 10, nr_do: 10 }] }],
      }),
    /blokującym rozporządzanie/
  );

  // Nieobciazona czesc pakietu przenosi sie normalnie.
  wpis(db, spolka, 'przeniesienie', '2026-02-05', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: kowalski,
    pozycje: [{ nabywca_osoba_id: bank, ilosc: 10, zakresy: [{ nr_od: 40, nr_do: 49 }] }],
  });
  assert.equal(zdarzenieObciazenia.zdarzenie.id, 3);
});

test('obciazenie: nie mozna obciazyc akcji, ktorych akcjonariusz nie posiada', () => {
  const { db, spolka, bank, emisjaId } = scenariusz();
  const inny = dodajOsobe(db, { nazwisko: 'Nowak', imie: 'Anna' });
  assert.throws(
    () =>
      wpis(db, spolka, 'obciazenie', '2026-02-01', {
        emisja_zdarzenie_id: emisjaId,
        akcjonariusz_osoba_id: inny,
        osoba_id: bank,
        ilosc: 10,
      }),
    /Brak pokrycia/
  );
});

test('wykreslenie_obciazenia znosi blokade rozporzadzania', () => {
  const { db, spolka, kowalski, bank, emisjaId } = scenariusz();
  const obciazenie = wpis(db, spolka, 'obciazenie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    akcjonariusz_osoba_id: kowalski,
    osoba_id: bank,
    ilosc: 30,
  });

  wpis(db, spolka, 'wykreslenie_obciazenia', '2026-03-01', {
    obciazenie_zdarzenie_id: obciazenie.zdarzenie.id,
  });

  const stan = stanBiezacy(db, spolka);
  assert.equal(stanLogika.obciazeniaNaDzien(stan, '2026-03-01').length, 0);

  // Po wykresleniu przeniesienie tych samych akcji jest juz mozliwe.
  wpis(db, spolka, 'przeniesienie', '2026-03-02', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: kowalski,
    pozycje: [{ nabywca_osoba_id: bank, ilosc: 10, zakresy: [{ nr_od: 1, nr_do: 10 }] }],
  });
});

test('prawo_glosu_zastawnika zmienia atrybut istniejacego obciazenia', () => {
  const { db, spolka, kowalski, bank, emisjaId } = scenariusz();
  const obciazenie = wpis(db, spolka, 'obciazenie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    akcjonariusz_osoba_id: kowalski,
    osoba_id: bank,
    ilosc: 30,
  });

  let stan = stanBiezacy(db, spolka);
  assert.equal(stanLogika.obciazeniaNaDzien(stan, '2026-02-01')[0].prawo_glosu, 0);

  wpis(db, spolka, 'prawo_glosu_zastawnika', '2026-02-10', {
    obciazenie_zdarzenie_id: obciazenie.zdarzenie.id,
    prawo_glosu: true,
  });

  stan = stanBiezacy(db, spolka);
  assert.equal(stanLogika.obciazeniaNaDzien(stan, '2026-02-10')[0].prawo_glosu, 1);
  // Uproszczenie modelu (patrz komentarz w stan.js): prawo_glosu jest
  // atrybutem BIEZACYM obciazenia, bez wlasnej osi czasu - "stan na dzien"
  // odtwarza wiernie SKLAD akcjonariatu i to, ktore akcje sa obciazone,
  // nie historyczna wartosc samego prawa glosu sprzed jego zmiany.
});

test('zajecie jest z urzedu: wolne od oplat, bez blokady przez wczesniejsze obciazenie', () => {
  const { db, spolka, kowalski, bank, emisjaId } = scenariusz();
  const komornik = dodajOsobe(db, { typ: 'prawna', nazwa: 'Komornik Sądowy X', nazwisko: null });

  wpis(db, spolka, 'obciazenie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    akcjonariusz_osoba_id: kowalski,
    osoba_id: bank,
    ilosc: 30,
  });

  const zajecie = wpis(db, spolka, 'zajecie', '2026-03-01', {
    emisja_zdarzenie_id: emisjaId,
    akcjonariusz_osoba_id: kowalski,
    osoba_id: komornik,
    zakresy: [{ nr_od: 1, nr_do: 10 }],
  });
  assert.equal(zajecie.typ.odplatne, false, 'zajecie jest wolne od oplat - art. 300(34) § 2 KSH');

  const stan = stanBiezacy(db, spolka);
  const obciazenia = stanLogika.obciazeniaNaDzien(stan, '2026-03-01');
  assert.equal(obciazenia.length, 2);
  assert.ok(obciazenia.some((o) => o.typ === 'zajecie'));
  assert.ok(obciazenia.some((o) => o.typ === 'zastaw'));
});

test('wykreslenie_zajecia (uchylenie) dziala niezaleznie od wykreslenie_obciazenia', () => {
  const { db, spolka, kowalski, emisjaId } = scenariusz();
  const komornik = dodajOsobe(db, { typ: 'prawna', nazwa: 'Komornik Sądowy X', nazwisko: null });
  const zajecie = wpis(db, spolka, 'zajecie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    akcjonariusz_osoba_id: kowalski,
    osoba_id: komornik,
    zakresy: [{ nr_od: 1, nr_do: 10 }],
  });

  assert.throws(
    () => wpis(db, spolka, 'wykreslenie_obciazenia', '2026-03-01', { obciazenie_zdarzenie_id: zajecie.zdarzenie.id }),
    /nie istnieje w rejestrze albo zostało już wykreślone/
  );

  wpis(db, spolka, 'wykreslenie_zajecia', '2026-03-01', { obciazenie_zdarzenie_id: zajecie.zdarzenie.id });
  const stan = stanBiezacy(db, spolka);
  assert.equal(stanLogika.obciazeniaNaDzien(stan, '2026-03-01').length, 0);
});

test('uprawnienie: ustanowienie i wykreslenie', () => {
  const { db, spolka, kowalski, emisjaId } = scenariusz();
  const uprawnienie = wpis(db, spolka, 'uprawnienie', '2026-02-01', {
    rodzaj: 'przywilej',
    zakres: 'akcjonariusz',
    osoba_id: kowalski,
    tytul: 'Uprzywilejowanie co do głosu',
    tresc: '2 głosy na akcję',
  });

  let stan = stanBiezacy(db, spolka);
  assert.equal(stan.uprawnienia.filter((u) => u.status === 'aktywne').length, 1);

  wpis(db, spolka, 'uprawnienie', '2026-03-01', {
    wykresla_zdarzenie_id: uprawnienie.zdarzenie.id,
  });

  stan = stanBiezacy(db, spolka);
  assert.equal(stan.uprawnienia.filter((u) => u.status === 'aktywne').length, 0);
  assert.equal(stan.uprawnienia[0].data_wykreslenia, '2026-03-01');
});

test('uprawnienie wymaga tytulu albo tresci', () => {
  const { db, spolka } = scenariusz();
  assert.throws(
    () => wpis(db, spolka, 'uprawnienie', '2026-02-01', { rodzaj: 'obowiazek', zakres: 'spolka' }),
    /tytuł albo treść/
  );
});

test('ograniczenie: prawo pierwszenstwa blokuje przeniesienie bez odnotowanego wyczerpania', () => {
  const { db, spolka, kowalski, bank, emisjaId } = scenariusz();

  wpis(db, spolka, 'ograniczenie', '2026-01-15', {
    zakres: 'emisja',
    emisja_zdarzenie_id: emisjaId,
    prawo_pierwszenstwa: true,
    opis: 'Statutowe prawo pierwszeństwa pozostałych akcjonariuszy',
  });

  assert.throws(
    () =>
      wpis(db, spolka, 'przeniesienie', '2026-02-01', {
        emisja_zdarzenie_id: emisjaId,
        zbywca_osoba_id: kowalski,
        pozycje: [{ nabywca_osoba_id: bank, ilosc: 10 }],
      }),
    /prawo pierwszeństwa/
  );

  wpis(db, spolka, 'przeniesienie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: kowalski,
    pierwszenstwo_wyczerpane: true,
    pozycje: [{ nabywca_osoba_id: bank, ilosc: 10 }],
  });
});

test('zmiana_danych_akcjonariusza aktualizuje kartotekę psa_osoby', () => {
  const { db, spolka, kowalski } = scenariusz();
  wpis(db, spolka, 'zmiana_danych_akcjonariusza', '2026-02-01', {
    osoba_id: kowalski,
    po: { email: 'jan.kowalski@example.pl', miejscowosc: 'Wrocław' },
  });

  const osoba = db.prepare('SELECT * FROM psa_osoby WHERE id = ?').get(kowalski);
  assert.equal(osoba.email, 'jan.kowalski@example.pl');
  assert.equal(osoba.miejscowosc, 'Wrocław');

  const stan = stanBiezacy(db, spolka);
  // Zmiana danych nie wplywa na stan akcji.
  assert.equal(stanLogika.sprawdzBilans(stan).length, 0);
});

test('zmiana_danych_akcjonariusza bez zadanej zmiany jest odrzucana', () => {
  const { db, spolka, kowalski } = scenariusz();
  const osoba = db.prepare('SELECT * FROM psa_osoby WHERE id = ?').get(kowalski);
  assert.throws(
    () =>
      wpis(db, spolka, 'zmiana_danych_akcjonariusza', '2026-02-01', {
        osoba_id: kowalski,
        po: { email: osoba.email },
      }),
    /żadnej zmiany/
  );
});

test('sprostowanie bez „zamiast” jest PELNYM WYCOFANIEM zdarzenia (nie ma czym go zastąpić)', () => {
  // Zdarzenie bez skutku strukturalnego i bez zaleznych - wycofanie go
  // faktycznie niczego w stanie akcji nie zmienia.
  const { db, spolka } = scenariusz();
  const inne = wpis(db, spolka, 'zdarzenie_inne', '2026-01-20', { opis: 'Nadzwyczajne walne zgromadzenie.' });
  const przed = stanBiezacy(db, spolka);

  const wynik = rejestr.dokonajSprostowania(db, {
    zdarzeniePierwotneId: inne.zdarzenie.id,
    uzasadnienie: 'Zdarzenie zostało zarejestrowane omyłkowo — do zgromadzenia nie doszło.',
    zamiast: null,
    autor: 'Test',
  });
  assert.equal(wynik.zdarzenie.typ, 'sprostowanie');
  assert.equal(wynik.zdarzenie.zdarzenie_prostowane_id, inne.zdarzenie.id);

  const po = stanBiezacy(db, spolka);
  assert.deepEqual(po.emisje, przed.emisje);
});

test('sprostowanie bez „zamiast” nie może wycofać zdarzenia, od którego zależą inne (integralność referencyjna)', () => {
  const { db, emisjaId } = scenariusz();
  // emisjaId ma juz zalezne zdarzenie „objecie” - wycofanie samej emisji
  // zostawiloby je odwolujace sie do niczego.
  assert.throws(
    () =>
      rejestr.dokonajSprostowania(db, {
        zdarzeniePierwotneId: emisjaId,
        uzasadnienie: 'Próba wycofania emisji, do której odwołuje się już objęcie.',
        zamiast: null,
        autor: 'Test',
      }),
    /nieistniejącą emisję/
  );
});

test('sprostowanie z tresc zamiast koryguje bledna emisje', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const zla = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 100 });

  const wynik = rejestr.dokonajSprostowania(db, {
    zdarzeniePierwotneId: zla.zdarzenie.id,
    uzasadnienie: 'Błędna liczba akcji — powinno być 90, nie 100.',
    zamiast: { typ: 'emisja', dane: { seria: 'A', ilosc: 90 } },
    autor: 'Test',
    data_zdarzenia: '2026-01-10',
  });

  const stan = stanBiezacy(db, spolka);
  assert.equal(stan.emisje.length, 1);
  assert.equal(stan.emisje[0].ilosc, 90);
  assert.equal(stanLogika.sprawdzBilans(stan).length, 0);
  assert.equal(wynik.zdarzenie.typ, 'sprostowanie');
});

test('nie mozna sprostowac zdarzenia dwukrotnie', () => {
  const { db, spolka } = scenariusz();
  const inne = wpis(db, spolka, 'zdarzenie_inne', '2026-01-20', { opis: 'Zdarzenie do sprostowania.' });
  rejestr.dokonajSprostowania(db, {
    zdarzeniePierwotneId: inne.zdarzenie.id,
    uzasadnienie: 'Pierwsza korekta.',
    autor: 'Test',
  });
  assert.throws(
    () =>
      rejestr.dokonajSprostowania(db, {
        zdarzeniePierwotneId: inne.zdarzenie.id,
        uzasadnienie: 'Druga korekta.',
        autor: 'Test',
      }),
    /zostało już sprostowane/
  );
});

test('sprostowanie wymaga uzasadnienia', () => {
  const { db, emisjaId } = scenariusz();
  assert.throws(
    () => rejestr.dokonajSprostowania(db, { zdarzeniePierwotneId: emisjaId, uzasadnienie: '', autor: 'Test' }),
    /wymaga uzasadnienia/
  );
});

test('lancuch skrotow pozostaje ciagly po zdarzeniach nowych typow', () => {
  const { db, spolka, kowalski, bank, emisjaId } = scenariusz();
  wpis(db, spolka, 'obciazenie', '2026-02-01', {
    emisja_zdarzenie_id: emisjaId, akcjonariusz_osoba_id: kowalski, osoba_id: bank, ilosc: 10,
  });
  const inne = wpis(db, spolka, 'zdarzenie_inne', '2026-02-05', { opis: 'Do sprostowania.' });
  rejestr.dokonajSprostowania(db, {
    zdarzeniePierwotneId: inne.zdarzenie.id, uzasadnienie: 'Adnotacja.', autor: 'Test',
  });
  assert.equal(rejestr.zweryfikujIntegralnosc(db).ok, true);
});
