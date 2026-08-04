'use strict';

/**
 * Reguly domenowe, ktore nie dotyczaja samego obrotu akcjami:
 * maskowanie (nr 9), kartoteka wspolna (nr 10), zakres podmiotowy (nr 11)
 * oraz powtarzalnosc skrotu.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const przepisy = require('../server/logika/przepisy');
const maskowanie = require('../server/logika/maskowanie');
const lancuch = require('../server/logika/lancuch');
const widoki = require('../server/widoki');
const { bazaTestowa, dodajSpolke, dodajOsobe, wpis } = require('./pomoc');

const OSOBA = {
  id: 7,
  typ: 'fizyczna',
  nazwisko: 'Kowalski',
  imie: 'Jan',
  pesel: '44051401359',
  data_urodzenia: '1944-05-14',
  kod_pocztowy: '30-002',
  miejscowosc: 'Kraków',
  ulica: 'Długa',
  nr_domu: '5',
  email: 'jan@example.pl',
  telefon: '600100200',
  aml_status: 'wykonane',
  aml_notatka: 'weryfikacja na podstawie dowodu osobistego',
  uwagi: 'notatka wewnętrzna',
};

test('REGUŁA 9: inny akcjonariusz nie widzi PESEL, daty urodzenia ani adresu', () => {
  const wynik = maskowanie.zamaskujOsobe(OSOBA, przepisy.ROLE_ODBIORCY.AKCJONARIUSZ, 99);

  assert.equal(wynik.zamaskowane, true);
  for (const pole of ['pesel', 'data_urodzenia', 'kod_pocztowy', 'miejscowosc', 'ulica', 'nr_domu']) {
    assert.equal(wynik[pole], maskowanie.ZASLONA, `pole ${pole} musi być zasłonięte`);
  }
  // Dane kontaktowe innych akcjonariuszy też nie wychodzą (sekcja 10).
  assert.equal(wynik.email, maskowanie.ZASLONA);
  assert.equal(wynik.telefon, maskowanie.ZASLONA);
  // Notatki AML i uwagi wewnętrzne nie opuszczają kancelarii w żadnym wariancie.
  assert.equal(wynik.aml_notatka, undefined);
  assert.equal(wynik.aml_status, undefined);
  assert.equal(wynik.uwagi, undefined);
  // Nazwisko pozostaje - rejestr jest jawny dla akcjonariuszy co do składu.
  assert.equal(wynik.nazwisko, 'Kowalski');
});

test('REGUŁA 9: spółka, organ, kancelaria i sama osoba widzą pełne dane', () => {
  const pelne = [
    przepisy.ROLE_ODBIORCY.KANCELARIA,
    przepisy.ROLE_ODBIORCY.SPOLKA,
    przepisy.ROLE_ODBIORCY.ORGAN,
  ];
  for (const rola of pelne) {
    assert.equal(maskowanie.zamaskujOsobe(OSOBA, rola).pesel, OSOBA.pesel, `rola ${rola}`);
  }
  // Akcjonariusz widzi WŁASNE dane w całości.
  assert.equal(
    maskowanie.zamaskujOsobe(OSOBA, przepisy.ROLE_ODBIORCY.AKCJONARIUSZ, OSOBA.id).pesel,
    OSOBA.pesel
  );
});

test('REGUŁA 9: maskowanie działa w widoku rejestru, nie tylko w funkcji', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const a = dodajOsobe(db, { nazwisko: 'Kowalski', imie: 'Jan', pesel: '44051401359' });
  const b = dodajOsobe(db, { nazwisko: 'Nowak', imie: 'Anna', pesel: '02070803628' });

  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 100 });
  wpis(db, spolka, 'objecie', '2026-01-10', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    pozycje: [{ osoba_id: a, ilosc: 50 }, { osoba_id: b, ilosc: 50 }],
  });

  const dlaB = widoki.widokStanu(db, spolka, '2026-01-10', {
    rola: przepisy.ROLE_ODBIORCY.AKCJONARIUSZ,
    odbiorcaOsobaId: b,
  });
  const wpisA = dlaB.akcjonariusze.find((p) => p.osoba_id === a);
  const wpisB = dlaB.akcjonariusze.find((p) => p.osoba_id === b);

  assert.equal(wpisA.osoba.pesel, maskowanie.ZASLONA, 'cudzy PESEL zasłonięty');
  assert.equal(wpisB.osoba.pesel, '02070803628', 'własny PESEL widoczny');

  const dlaKancelarii = widoki.widokStanu(db, spolka, '2026-01-10');
  assert.equal(
    dlaKancelarii.akcjonariusze.find((p) => p.osoba_id === a).osoba.pesel,
    '44051401359'
  );
});

test('REGUŁA 9: pole „uwagi” spółki nie wychodzi poza kancelarię', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db, { uwagi: 'klient zalega z opłatą' });

  assert.equal(widoki.widokStanu(db, spolka, '2026-01-10').spolka.uwagi, 'klient zalega z opłatą');
  const dlaSpolki = widoki.widokStanu(db, spolka, '2026-01-10', {
    rola: przepisy.ROLE_ODBIORCY.SPOLKA,
  });
  assert.equal('uwagi' in dlaSpolki.spolka, false);
});

test('REGUŁA 11: rejestru nie prowadzimy dla S.A. ani S.K.A.', () => {
  assert.equal(przepisy.ocenFormePrawna('PROSTA SPÓŁKA AKCYJNA').dozwolona, true);
  assert.equal(przepisy.ocenFormePrawna('prosta spółka akcyjna').dozwolona, true);
  assert.equal(przepisy.ocenFormePrawna('P.S.A.').dozwolona, true);

  const sa = przepisy.ocenFormePrawna('SPÓŁKA AKCYJNA');
  assert.equal(sa.dozwolona, false);
  assert.match(sa.powod, /nie może prowadzić rejestru/);

  assert.equal(przepisy.ocenFormePrawna('SPÓŁKA KOMANDYTOWO-AKCYJNA').dozwolona, false);
  assert.equal(przepisy.ocenFormePrawna('SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ').dozwolona, false);
  assert.equal(przepisy.ocenFormePrawna('').dozwolona, false);
});

test('REGUŁA 10: jedna osoba z kartoteki jest akcjonariuszem w wielu spółkach', () => {
  const db = bazaTestowa();
  const inwestor = dodajOsobe(db, { typ: 'prawna', nazwa: 'Fundusz sp. z o.o.', nazwisko: null });

  for (const nazwa of ['Alfa P.S.A.', 'Beta P.S.A.']) {
    const spolka = dodajSpolke(db, { nazwa, krs: null });
    const emisja = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 100 });
    wpis(db, spolka, 'objecie', '2026-01-10', {
      emisja_zdarzenie_id: emisja.zdarzenie.id,
      pozycje: [{ osoba_id: inwestor, ilosc: 100 }],
    });
  }

  const spolki = db
    .prepare(
      `SELECT COUNT(DISTINCT spolka_id) AS ile FROM psa_stan_akcji
        WHERE osoba_id = ? AND data_do IS NULL`
    )
    .get(inwestor).ile;
  assert.equal(spolki, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS ile FROM psa_osoby').get().ile, 1);
});

test('kanoniczny JSON nie zależy od kolejności kluczy', () => {
  const a = lancuch.kanonicznyJson({ seria: 'A', ilosc: 10, pozycje: [{ b: 2, a: 1 }] });
  const b = lancuch.kanonicznyJson({ pozycje: [{ a: 1, b: 2 }], ilosc: 10, seria: 'A' });
  assert.equal(a, b);
  // Kolejność elementów tablicy JEST znacząca - to pozycje zdarzenia.
  assert.notEqual(
    lancuch.kanonicznyJson({ p: [1, 2] }),
    lancuch.kanonicznyJson({ p: [2, 1] })
  );
});

test('skrót zmienia się przy każdej zmianie pola zdarzenia', () => {
  const podstawa = {
    id: 1,
    spolka_id: 1,
    typ: 'emisja',
    data_zdarzenia: '2026-01-10',
    data_wpisu: '2026-01-10T12:00:00+01:00',
    autor: 'Łukasz Kozon',
    dane_json: '{"ilosc":100}',
    hash_poprzedni: lancuch.HASH_POCZATKOWY,
  };
  const wzorcowy = lancuch.skrot(podstawa);
  assert.equal(lancuch.skrot({ ...podstawa }), wzorcowy, 'ten sam rekord daje ten sam skrót');

  for (const [pole, wartosc] of Object.entries({
    id: 2,
    spolka_id: 2,
    typ: 'objecie',
    data_zdarzenia: '2026-01-11',
    data_wpisu: '2026-01-10T12:00:01+01:00',
    autor: 'Ktoś inny',
    dane_json: '{"ilosc":101}',
    hash_poprzedni: 'f'.repeat(64),
  })) {
    assert.notEqual(
      lancuch.skrot({ ...podstawa, [pole]: wartosc }),
      wzorcowy,
      `zmiana pola ${pole} musi zmienić skrót`
    );
  }
});

test('granice pól są jednoznaczne — przesunięcie treści między polami zmienia skrót', () => {
  const a = { id: 1, spolka_id: 1, typ: 'ab', data_zdarzenia: 'c', data_wpisu: 'd', autor: 'e', dane_json: 'f', hash_poprzedni: 'g' };
  const b = { ...a, typ: 'a', data_zdarzenia: 'bc' };
  assert.notEqual(lancuch.skrot(a), lancuch.skrot(b));
});
