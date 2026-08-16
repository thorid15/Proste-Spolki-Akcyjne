'use strict';

/**
 * Kontekst danych dla automatu pism (blok A3 sesji 8): mapowanie
 * spółka/sprawa/osoby na klucze wzorów 05/06/07/09 i renderowanie na
 * PRAWDZIWYCH plikach z `wzory/` — nie na atrapach.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Plik testowy dostaje wlasny proces (node --test) - bezpiecznie ustawic
// atomowe dane kancelarii PRZED pierwszym require modulu, ktory je czyta,
// zamiast polegac na tym, co akurat jest w .env tego srodowiska.
for (const [klucz, wartosc] of Object.entries({
  KANCELARIA_ULICA: 'Bolesława Leśmiana nr 3/U10',
  KANCELARIA_KOD: '80-280',
  KANCELARIA_MIASTO: 'Gdańsk',
  KANCELARIA_MIASTO_MIEJSCOWNIK: 'Gdańsku',
  KANCELARIA_EMAIL: 'biuro@notariusz.gdansk.pl',
  KANCELARIA_TELEFON: '+48 455 406 290',
  KANCELARIA_NIP: '9571165704',
  KANCELARIA_REGON: '526934899',
  NOTARIUSZ_MIANOWNIK: 'Łukasz Kozon',
  NOTARIUSZ_DOPELNIACZ: 'Łukasza Kozona',
  NOTARIUSZ_NARZEDNIK: 'Łukaszem Kozonem',
  PODPISUJACY_FUNKCJA: 'Notariusz',
  PODPISUJACY_MIANOWNIK: 'Łukasz Kozon',
})) {
  process.env[klucz] = wartosc;
}

const kontekst = require('../server/logika/kontekst-pisma');
const wzoryDysk = require('../server/logika/wzory-dysk');
const przepisy = require('../server/logika/przepisy');

// ─────────────────────────────────────────────────────────────
// Dane testowe wspólne
// ─────────────────────────────────────────────────────────────

const SPOLKA = {
  nazwa: 'CHARLIE UNICORN AI',
  miejscowosc: 'Warszawa',
  siedziba_miejscownik: 'Warszawie',
  kod_pocztowy: '00-697',
  ulica: 'Aleje Jerozolimskie',
  nr_domu: '51',
  nr_lokalu: null,
  sad_rejestrowy: 'Sąd Rejonowy dla m.st. Warszawy w Warszawie',
  wydzial: 'XII Wydział Gospodarczy',
  krs: '0001257646',
  nip: '7011325910',
  regon: '545410859',
  email: 'kontakt@charlieunicorn.ai',
  organ_rodzaj: 'zarzad',
};

const ZADAJACY = {
  typ: 'fizyczna',
  imie: 'Jan',
  nazwisko: 'Kowalski',
  kod_pocztowy: '80-180',
  miejscowosc: 'Gdańsk',
  ulica: 'Kwiatowa',
  nr_domu: '4',
  nr_lokalu: '2',
  adres_doreczen: null,
};

const SPRAWA = {
  numer: 'RA/2026/0042',
  typ_zdarzenia: 'umorzenie',
  data_wplywu: '2026-08-10',
  dokument_rodzaj: 'umowa_zbycia',
  dokument_data: '2026-08-01',
  powod_odmowy: 'Brak zgody spółki na zbycie akcji nie w pełni pokrytej.',
  sposob_usuniecia: 'Przedłożenie zgody spółki na zbycie akcji nie w pełni pokrytej.',
  termin_usuniecia: '2026-08-20',
  dane_wejsciowe_json: JSON.stringify({
    data_zdarzenia: '2026-08-13',
    dane: { seria: 'A', pozycje: [{ ilosc: 250 }] },
  }),
};

const AKCJONARIUSZE = [
  {
    osoba: { typ: 'fizyczna', imie: 'Jan', nazwisko: 'Kowalski' },
    seria: 'A',
    numery: '1–250',
    ilosc: 250,
    obciazenia: [],
  },
  {
    osoba: { typ: 'fizyczna', imie: 'Łukasz', nazwisko: 'Szymborski' },
    seria: 'A',
    numery: '251–1000',
    ilosc: 750,
    obciazenia: [{ typ: 'zastaw', uprawniony: { typ: 'fizyczna', imie: 'Anna', nazwisko: 'Nowak' } }],
  },
];

// ─────────────────────────────────────────────────────────────
// Formatowanie
// ─────────────────────────────────────────────────────────────

test('dataPl: RRRR-MM-DD -> DD.MM.RRRR, brak daty -> null', () => {
  assert.equal(kontekst.dataPl('2026-08-13'), '13.08.2026');
  assert.equal(kontekst.dataPl(null), null);
  assert.equal(kontekst.dataPl(''), null);
});

test('godzina: z chwili ISO, null gdy sama data', () => {
  assert.equal(kontekst.godzina('2026-08-13T11:42:07+02:00'), '11:42');
  assert.equal(kontekst.godzina('2026-08-13'), null);
  assert.equal(kontekst.godzina(null), null);
});

test('mianownik: fizyczna = imię + nazwisko, prawna = nazwa, null gdy brak osoby', () => {
  assert.equal(kontekst.mianownik(ZADAJACY), 'Jan Kowalski');
  assert.equal(kontekst.mianownik({ typ: 'prawna', nazwa: 'ACME sp. z o.o.' }), 'ACME sp. z o.o.');
  assert.equal(kontekst.mianownik(null), null);
});

test('adresPelny: sklada kod, miasto i ulice z numerem; adres_doreczen ma pierwszenstwo', () => {
  assert.equal(kontekst.adresPelny(ZADAJACY), '80-180 Gdańsk, ulica Kwiatowa nr 4/2');
  assert.equal(
    kontekst.adresPelny({ ...ZADAJACY, adres_doreczen: 'skrytka pocztowa 12' }),
    'skrytka pocztowa 12'
  );
  assert.equal(kontekst.adresPelny(null), null);
});

test('sadRejestrowyPelny: dopisuje sufiks do skroconego wydzialu, nie dubluje pelnego', () => {
  assert.equal(
    kontekst.sadRejestrowyPelny(SPOLKA),
    'Sąd Rejonowy dla m.st. Warszawy w Warszawie, XII Wydział Gospodarczy Krajowego Rejestru Sądowego'
  );
  assert.equal(
    kontekst.sadRejestrowyPelny({ ...SPOLKA, wydzial: 'XII Wydział Gospodarczy Krajowego Rejestru Sądowego' }),
    'Sąd Rejonowy dla m.st. Warszawy w Warszawie, XII Wydział Gospodarczy Krajowego Rejestru Sądowego'
  );
  assert.equal(kontekst.sadRejestrowyPelny({ ...SPOLKA, wydzial: null }), SPOLKA.sad_rejestrowy);
});

// ─────────────────────────────────────────────────────────────
// Bloki wspólne
// ─────────────────────────────────────────────────────────────

test('spolkaKlucze: organ_rodzaj rozwija sie w spolka_organ/spolka_organ_czlonkowie', () => {
  const k = kontekst.spolkaKlucze(SPOLKA);
  assert.equal(k.spolka_organ, 'Zarząd');
  assert.equal(k.spolka_organ_czlonkowie, 'członków zarządu');
  assert.equal(k.spolka_siedziba_miejscownik, 'Warszawie');

  const rada = kontekst.spolkaKlucze({ ...SPOLKA, organ_rodzaj: 'rada_dyrektorow' });
  assert.equal(rada.spolka_organ, 'Rada Dyrektorów');

  const brakOrganu = kontekst.spolkaKlucze({ ...SPOLKA, organ_rodzaj: null });
  assert.equal(brakOrganu.spolka_organ, null, 'bez wskazania organu klucz zostaje pusty, nie zgadniety');
});

test('pozycjeKlucze: obciazenia opisane tekstem, brak obciazen = "brak"', () => {
  const [bezObciazenia, zObciazeniem] = kontekst.pozycjeKlucze(AKCJONARIUSZE);
  assert.equal(bezObciazenia.pozycja_akcjonariusz, 'Jan Kowalski');
  assert.equal(bezObciazenia.pozycja_obciazenia, 'brak');
  assert.equal(zObciazeniem.pozycja_obciazenia, 'zastaw na rzecz Anna Nowak');
});

// ─────────────────────────────────────────────────────────────
// Kontekst per wzór — sprawdzone na PRAWDZIWYCH plikach z wzory/
// ─────────────────────────────────────────────────────────────

function bezBrakow(kod, dane) {
  const wynik = wzoryDysk.wypelnij(kod, dane);
  assert.deepEqual(wynik.bledy, [], `wzór ${kod}: błędy renderowania`);
  assert.deepEqual(wynik.brakujace, [], `wzór ${kod}: brakujące klucze — ${wynik.brakujace}`);
  return wynik;
}

test('zawiadomienieWpisu: wariant „zadajacy" wlacza sekcje adresat_zadajacy, nie adresat_spolka', () => {
  const zdarzenie = { typ: 'przeniesienie', data_wpisu: '2026-08-13T11:42:07+02:00', dane: {} };
  const dane = kontekst.zawiadomienieWpisu({
    spolka: SPOLKA, sprawa: SPRAWA, zdarzenie,
    wpisOpis: 'Przeniesienie 250 akcji serii A — Anna Nowak → Jan Kowalski.',
    zadajacy: ZADAJACY, akcjonariusze: AKCJONARIUSZE, wariant: 'zadajacy', dzis: '2026-08-13',
  });
  assert.deepEqual(dane.adresat_zadajacy, [{}]);
  assert.deepEqual(dane.adresat_spolka, []);
  assert.equal(dane.adresat_nazwa, 'Jan Kowalski');
  assert.equal(dane.wpis_konstytutywny.length, 1, 'przeniesienie bez tytulu deklaratoryjnego jest konstytutywne');
  assert.equal(dane.wpis_deklaratoryjny.length, 0);

  bezBrakow('07', dane);
});

test('zawiadomienieWpisu: wariant „spolka" wlacza sekcje adresat_spolka, adresatem jest spolka', () => {
  const zdarzenie = { typ: 'objecie', data_wpisu: '2026-08-13T11:42:07+02:00', dane: {} };
  const dane = kontekst.zawiadomienieWpisu({
    spolka: SPOLKA, sprawa: SPRAWA, zdarzenie,
    wpisOpis: 'Objęcie 250 akcji serii A przez Jana Kowalskiego.',
    zadajacy: ZADAJACY, akcjonariusze: AKCJONARIUSZE, wariant: 'spolka', dzis: '2026-08-13',
  });
  assert.deepEqual(dane.adresat_zadajacy, []);
  assert.deepEqual(dane.adresat_spolka, [{}]);
  assert.equal(dane.adresat_nazwa, SPOLKA.nazwa);
  assert.equal(dane.wpis_deklaratoryjny.length, 1, 'objecie jest deklaratoryjne (art. 300(37) § 2 KSH)');

  bezBrakow('07', dane);
});

test('wezwanieDoUzupelnienia: przeszkoda i sposob usuniecia trafiaja do sekcji i pol prostych', () => {
  const dane = kontekst.wezwanieDoUzupelnienia({
    spolka: SPOLKA, sprawa: SPRAWA, zadajacy: ZADAJACY, osoby: new Map(),
    powodWstrzymania: 'Brak zgody spółki na zbycie akcji nie w pełni pokrytej.',
    dzis: '2026-08-13',
  });
  assert.equal(dane.przeszkody.length, 1);
  assert.equal(dane.sposob_usuniecia, SPRAWA.sposob_usuniecia);
  assert.equal(dane.termin_usuniecia, '20.08.2026');

  bezBrakow('06', dane);
});

test('zawiadomienieNiedokonania: przyczyna odmowy trafia do sekcji przyczyny', () => {
  const dane = kontekst.zawiadomienieNiedokonania({
    spolka: SPOLKA, sprawa: SPRAWA, zadajacy: ZADAJACY, osoby: new Map(), dzis: '2026-08-13',
  });
  assert.equal(dane.przyczyny.length, 1);
  assert.equal(dane.przyczyny[0].przyczyna_opis, SPRAWA.powod_odmowy);

  bezBrakow('09', dane);
});

test('powiadomienieUprzednie: adresat to odbiorca, nie zadajacy — moga byc dwie rozne osoby', () => {
  const odbiorca = { typ: 'fizyczna', imie: 'Anna', nazwisko: 'Nowak', miejscowosc: 'Gdynia', kod_pocztowy: '81-000', ulica: 'Morska', nr_domu: '1' };
  const dane = kontekst.powiadomienieUprzednie({
    spolka: SPOLKA, sprawa: SPRAWA, zadajacy: ZADAJACY, odbiorca, osoby: new Map(),
    terminStanowiska: '2026-08-16', akcjonariusze: AKCJONARIUSZE, dzis: '2026-08-13',
  });
  assert.equal(dane.adresat_nazwa, 'Anna Nowak');
  assert.equal(dane.zadajacy_mianownik, 'Jan Kowalski');
  assert.notEqual(dane.adresat_nazwa, dane.zadajacy_mianownik);
  assert.equal(dane.termin_stanowiska, '16.08.2026');

  bezBrakow('05', dane);
});

test('brak dokumentu podstawy (sprawa bez dokument_rodzaj) zostaje WIDOCZNY brak, nie zgadniety', () => {
  const zdarzenie = { typ: 'objecie', data_wpisu: '2026-08-13T11:42:07+02:00', dane: {} };
  const dane = kontekst.zawiadomienieWpisu({
    spolka: SPOLKA, sprawa: { ...SPRAWA, dokument_rodzaj: null, dokument_data: null }, zdarzenie,
    wpisOpis: 'Objęcie akcji.', zadajacy: ZADAJACY, akcjonariusze: AKCJONARIUSZE, wariant: 'zadajacy', dzis: '2026-08-13',
  });
  assert.equal(dane.dokument_rodzaj, null);
  const wynik = wzoryDysk.wypelnij('07', dane);
  assert.deepEqual(wynik.bledy, []);
  assert.deepEqual(wynik.brakujace, ['dokument_rodzaj', 'dokument_data']);
});

test('charakterWpisu: sanity — konstytutywny i deklaratoryjny sie wykluczaja', () => {
  assert.notEqual(przepisy.CHARAKTER_WPISU.KONSTYTUTYWNY, przepisy.CHARAKTER_WPISU.DEKLARATORYJNY);
});
