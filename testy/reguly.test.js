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
const daneOsoby = require('../server/dane/osoby');
const { bazaTestowa, dodajSpolke, dodajOsobe, otworz } = require('./pomoc');

const OSOBA = {
  id: 7,
  typ: 'fizyczna',
  nazwa: 'Jan Kowalski',
  pesel: '44051401359',
  data_urodzenia: '1944-05-14',
  adres: 'ul. Długa 5, 30-002 Kraków',
  rodzaj_adresu: 'glowny',
  email: 'jan@example.pl',
  zgoda_email: 1,
  aml_data: '2026-01-01',
  uwagi: 'notatka wewnętrzna',
  pep: 1,
  pep_opis: 'radny gminy',
};

test('REGUŁA 9: inny akcjonariusz nie widzi PESEL, daty urodzenia, adresu zamieszkania ani e-maila', () => {
  const wynik = maskowanie.zamaskujOsobe(OSOBA, przepisy.ROLE_ODBIORCY.AKCJONARIUSZ, 99);
  assert.equal(wynik.zamaskowane, true);
  for (const pole of ['pesel', 'data_urodzenia', 'adres', 'email']) {
    assert.equal(wynik[pole], maskowanie.ZASLONA, `pole ${pole} musi być zasłonięte`);
  }
  // AML, PEP i uwagi to dane kancelarii, nie treść rejestru — nie wychodzą w żadnym wariancie.
  for (const pole of ['aml_data', 'uwagi', 'pep', 'pep_opis']) assert.equal(wynik[pole], undefined, pole);
  assert.equal(wynik.nazwa, 'Jan Kowalski');
});

test('poz. 23: siedziba osoby prawnej i adres do doręczeń nie są adresem zamieszkania — widoczne dla akcjonariusza', () => {
  const rola = przepisy.ROLE_ODBIORCY.AKCJONARIUSZ;
  assert.equal(maskowanie.zamaskujOsobe({ ...OSOBA, rodzaj_adresu: 'doreczen' }, rola, 99).adres, OSOBA.adres);
  const prawna = { id: 8, typ: 'prawna', nazwa: 'Gamma sp. z o.o.', numer_rejestru: '0000123456', adres: 'ul. Morska 3, Gdynia', rodzaj_adresu: 'glowny' };
  assert.equal(maskowanie.zamaskujOsobe(prawna, rola, 99).adres, prawna.adres);
  assert.equal(maskowanie.opisOsoby(prawna, rola, 99), 'Gamma sp. z o.o., nr w rejestrze 0000123456\nul. Morska 3, Gdynia');
  assert.equal(maskowanie.opisOsoby(OSOBA, rola, 99), 'Jan Kowalski');
});

test('Z-150: rola „spółka”/„organ” ma pełny wgląd do treści rejestru (PESEL), ale AML/PEP nie wychodzi poza kancelarię', () => {
  for (const rola of [przepisy.ROLE_ODBIORCY.SPOLKA, przepisy.ROLE_ODBIORCY.ORGAN]) {
    const wynik = maskowanie.zamaskujOsobe(OSOBA, rola);
    assert.equal(wynik.pesel, OSOBA.pesel, `rola ${rola} musi widzieć PESEL (treść rejestru)`);
    assert.equal(wynik.aml_data, undefined, `rola ${rola} nie może widzieć aml_data`);
    assert.equal(wynik.pep, undefined, `rola ${rola} nie może widzieć pep`);
    assert.equal(wynik.uwagi, undefined, `rola ${rola} nie może widzieć uwagi`);
  }
});

test('Z-150: nowe, nieznane pole w psa_osoby jest domyślnie NIEWIDOCZNE dla ról ograniczonych, nie wyciekające', () => {
  // Biala lista: kazde pole spoza katalogu (POLA_TOZSAMOSCI/POLA_WRAZLIWE/
  // POLA_KONTAKTOWE) jest z definicji pomijane, wiec dodanie kolumny do
  // schematu w przyszlosci nie wymaga "pamietania" o dopisaniu jej do listy
  // usuwanych (jak przy starym, czarnolistowym podejsciu).
  const zNowymPolem = { ...OSOBA, zupelnie_nowe_pole_z_przyszlosci: 'coś wrażliwego' };
  const dlaAkcjonariusza = maskowanie.zamaskujOsobe(zNowymPolem, przepisy.ROLE_ODBIORCY.AKCJONARIUSZ, 99);
  const dlaSpolki = maskowanie.zamaskujOsobe(zNowymPolem, przepisy.ROLE_ODBIORCY.SPOLKA);
  assert.equal(dlaAkcjonariusza.zupelnie_nowe_pole_z_przyszlosci, undefined);
  assert.equal(dlaSpolki.zupelnie_nowe_pole_z_przyszlosci, undefined);
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
  const inwestor = dodajOsobe(db, { typ: 'prawna', nazwa: 'Fundusz sp. z o.o.', data_urodzenia: null, numer_rejestru: '0000123123' });
  for (const nazwa of ['Alfa P.S.A.', 'Beta P.S.A.']) {
    otworz(db, dodajSpolke(db, { nazwa }), {
      serie: [{ seria: 'A', numery: '1-100', liczba: 100, data_wpisu_krs: '2026-01-10' }],
      akcjonariusze: [{ osoba_id: inwestor, akcje: [{ seria: 'A', numery: '1-100', liczba: 100 }] }],
    });
  }
  assert.deepEqual(daneOsoby.powiazania(db, inwestor).akcje.map((x) => x.nazwa), ['Alfa P.S.A.', 'Beta P.S.A.']);
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

test('D-R01: data zdarzenia nie wchodzi do skrótu (pole usunięte z łańcucha)', () => {
  const r = {
    id: 1, spolka_id: 1, typ: 'emisja', data_wpisu: '2026-01-10T11:00:00Z',
    autor: 'A', dane_json: '{}', hash_poprzedni: lancuch.HASH_POCZATKOWY,
  };
  assert.equal(lancuch.skrot({ ...r, data_zdarzenia: '2020-01-01' }), lancuch.skrot(r));
});

test('skrót zmienia się przy każdej zmianie pola zdarzenia', () => {
  const podstawa = {
    id: 1,
    spolka_id: 1,
    typ: 'emisja',
    data_wpisu: '2026-01-10T11:00:00Z',
    autor: 'Łukasz Kozon',
    dane_json: '{"ilosc":100}',
    hash_poprzedni: lancuch.HASH_POCZATKOWY,
  };
  const wzorcowy = lancuch.skrot(podstawa);
  assert.equal(lancuch.skrot({ ...podstawa }), wzorcowy, 'ten sam rekord daje ten sam skrót');

  for (const [pole, wartosc] of Object.entries({
    id: 2,
    spolka_id: 2,
    typ: 'przeniesienie',
    data_wpisu: '2026-01-10T11:00:01Z',
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
  const a = { id: 1, spolka_id: 1, typ: 'ab', data_wpisu: 'c', autor: 'e', dane_json: 'f', hash_poprzedni: 'g' };
  const b = { ...a, typ: 'a', data_wpisu: 'bc' };
  assert.notEqual(lancuch.skrot(a), lancuch.skrot(b));
});
