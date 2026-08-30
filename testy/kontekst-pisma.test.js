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
const docx = require('../server/logika/docx');

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
  data_umowy: '2026-08-13',
  // Mianownik (etap 2.3 poprawek) - odmiane liczy deklinacja.js w locie,
  // patrz test nizej "reprezentantKlucze: odmiana liczona automatycznie...".
  reprezentant_imie_nazwisko: 'Łukasz Adrian Szymborski',
  reprezentant_plec: 'mezczyzna',
  reprezentant_rodzice: 'Paweł i Izabella',
  reprezentant_dowod: 'DGK 138559',
  reprezentant_pesel: '88081105939',
  reprezentant_adres: '76-015 Manowo, ulica Kasztanowa nr 17 m. 1',
  reprezentant_funkcja: 'Prezes Zarządu',
  reprezentant_reprezentacja: 'uprawnionego do samodzielnej reprezentacji',
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

// ─────────────────────────────────────────────────────────────
// Wzory wystawiane na żądanie (blok A5) — sprawdzone na PRAWDZIWYCH plikach
// ─────────────────────────────────────────────────────────────

test('umowaOProwadzenieRejestru: taksy licza sie z konfiguracji stawek, slownie wylicza sie samo', () => {
  const dane = kontekst.umowaOProwadzenieRejestru({ spolka: SPOLKA, dzis: '2026-08-13' });
  assert.equal(dane.taksa_roczna, String(przepisy.STAWKI_GROSZE.PROWADZENIE_ROCZNIE / 100));
  assert.equal(dane.taksa_wpis, String(przepisy.STAWKI_GROSZE.WPIS / 100));
  // Mianownik "Łukasz Adrian Szymborski" -> biernik odmieniony automatycznie
  // (etap 2.3) - nie wpisywany recznie w SPOLKA, patrz deklinacja.test.js.
  assert.equal(dane.reprezentant_biernik, 'Łukasza Adriana Szymborskiego');
  assert.equal(dane.reprezentant_funkcja_biernik, 'Prezesa Zarządu');
  assert.equal(dane.reprezentant_rodzice, 'Pawła i Izabelli');
  assert.equal(dane.reprezentant_dzialajacy, 'działającego');
  assert.equal('spolka_vat' in dane, false, 'status VAT usuniety calkowicie (etap 1.6) - klucz nie istnieje');

  const wynik = wzoryDysk.wypelnij('01', dane);
  assert.deepEqual(wynik.bledy, []);
  assert.deepEqual(wynik.brakujace, []);
  assert.match(docx.tekst(wynik.plik), /jeden tysiąc dwieście złotych|1200/, 'stawka roczna widoczna w tresci');
});

test('umowaOProwadzenieRejestru: reczna korekta odmiany ma pierwszenstwo przed automatem', () => {
  const dane = kontekst.umowaOProwadzenieRejestru({
    spolka: { ...SPOLKA, reprezentant_biernik_recznie: 'Łukasza Adriana Szymborskiego (korekta)' },
    dzis: '2026-08-13',
  });
  assert.equal(dane.reprezentant_biernik, 'Łukasza Adriana Szymborskiego (korekta)');
});

test('umowaOProwadzenieRejestru: bez plci automat nie zgaduje biernika - zostaje null', () => {
  const { reprezentant_plec, ...bezPlci } = SPOLKA;
  const dane = kontekst.umowaOProwadzenieRejestru({ spolka: bezPlci, dzis: '2026-08-13' });
  assert.equal(dane.reprezentant_biernik, null);
});

test('informacjaRodo: forma czasownika zalezy od plci reprezentanta', () => {
  const meski = kontekst.informacjaRodo({ spolka: SPOLKA });
  assert.equal(meski.zapoznany, 'zapoznałem się');
  bezBrakow('02', meski);

  const zenski = kontekst.informacjaRodo({ spolka: { ...SPOLKA, reprezentant_plec: 'kobieta' } });
  assert.equal(zenski.zapoznany, 'zapoznałam się');
});

test('uchwalaWyboru: dane glosowania sa AD HOC (podaje notariusz), sekcja akcjonariusze z rejestru', () => {
  const dane = kontekst.uchwalaWyboru({
    spolka: SPOLKA, akcjonariusze: AKCJONARIUSZE,
    uchwala: { numer: '1', dataSlownie: '12 sierpnia 2026 roku', trybGlosowania: 'jednogłośnie', glosyZa: 1000, glosyPrzeciw: 0, glosyWstrzymujace: 0, procentGlosow: '100%' },
    dzis: '2026-08-13',
  });
  assert.equal(dane.akcjonariusze.length, 2);
  assert.equal(dane.akcjonariusze[0].akcjonariusz_nazwa, 'Jan Kowalski');
  assert.equal(dane.akcjonariusze[0].akcjonariusz_liczba_glosow, dane.akcjonariusze[0].akcjonariusz_liczba_akcji, 'bez wagi glosu - 1 akcja = 1 glos');
  assert.equal(dane.uchwala_glosy_za, '1000');

  bezBrakow('03', dane);
});

test('uchwalaWyboru: bez danych glosowania pola zostaja WIDOCZNYM brakiem', () => {
  const dane = kontekst.uchwalaWyboru({ spolka: SPOLKA, akcjonariusze: AKCJONARIUSZE, dzis: '2026-08-13' });
  const wynik = wzoryDysk.wypelnij('03', dane);
  assert.ok(wynik.brakujace.includes('uchwala_numer'));
  assert.ok(wynik.brakujace.includes('uchwala_glosy_za'));
});

test('listaAkcjonariuszyDoSadu: razem akcji i sklad organu z importu KRS', () => {
  const dane = kontekst.listaAkcjonariuszyDoSadu({
    spolka: SPOLKA, akcjonariusze: AKCJONARIUSZE, razemAkcji: 1000,
    czlonkowieOrganu: [{ imiona: 'Łukasz Adrian', nazwisko: 'Szymborski', funkcja: 'Prezes Zarządu' }],
    adresatNazwa: 'Sąd Rejonowy dla m.st. Warszawy w Warszawie', adresatAdres: 'ul. Czerniakowska 100A, 00-454 Warszawa',
    dzis: '2026-08-13',
  });
  assert.equal(dane.lista_akcje_razem, '1000');
  assert.equal(dane.czlonkowie_organu[0].czlonek_mianownik, 'Łukasz Adrian Szymborski');

  bezBrakow('08', dane);
});

test('listaAkcjonariuszyDoSadu: bez adresata podpowiada sad rejestrowy spolki jako domyslny adresat', () => {
  const dane = kontekst.listaAkcjonariuszyDoSadu({
    spolka: SPOLKA, akcjonariusze: AKCJONARIUSZE, razemAkcji: 1000, czlonkowieOrganu: [], dzis: '2026-08-13',
  });
  assert.equal(dane.adresat_nazwa, kontekst.sadRejestrowyPelny(SPOLKA));
  assert.equal(dane.adresat_adres, null, 'adres sadu nie ma zrodla w schemacie - zostaje widoczny brak');
});

test('klauzulaZbycia: zbywca i nabywca to dwie rozne osoby z kartoteki', () => {
  const zbywca = { typ: 'fizyczna', imie: 'Anna', nazwisko: 'Nowak', email: 'anna@nowak.pl' };
  const nabywca = { typ: 'fizyczna', imie: 'Jan', nazwisko: 'Kowalski', email: 'jan@kowalski.pl' };
  const dane = kontekst.klauzulaZbycia({
    spolka: SPOLKA, klauzula: { paragraf: '7', pokrycie: 'zostały w całości pokryte', ograniczenia: 'umowa spółki nie ogranicza rozporządzania akcjami' },
    zbywca, nabywca,
  });
  assert.equal(dane.zbywca_email, 'anna@nowak.pl');
  assert.equal(dane.nabywca_email, 'jan@kowalski.pl');

  bezBrakow('10', dane);
});

// ─────────────────────────────────────────────────────────────
// Wzór 04 — żądanie dokonania wpisu (wystawiane ze SPRAWY, blok A7)
// ─────────────────────────────────────────────────────────────

const ZADAJACY_PELNY = {
  ...ZADAJACY,
  typ: 'fizyczna',
  pesel: '88081105939',
  email: 'jan.kowalski@example.pl',
  zgoda_email: 1,
};

const DOKUMENTY_SPRAWY = [{ typ_dokumentu: 'umowa_zbycia', nazwa_pliku: 'umowa-zbycia.pdf' }];

test('zadanieWpisu: dane zadajacego, podstawa dokumentowa i zalaczniki z realnej sprawy', () => {
  const dane = kontekst.zadanieWpisu({
    spolka: SPOLKA,
    sprawa: { ...SPRAWA, zadajacy_rola: 'nabywca' },
    zadajacy: ZADAJACY_PELNY,
    osoby: new Map(),
    dokumenty: DOKUMENTY_SPRAWY,
    dzis: '2026-08-13',
  });
  assert.equal(dane.zadajacy_mianownik, 'Jan Kowalski');
  assert.equal(dane.zadajacy_identyfikator, 'PESEL 88081105939');
  assert.equal(dane.zadajacy_rola, przepisy.OPISY_ROL_ZADAJACEGO.nabywca);
  assert.equal(dane.sposob_doreczen, 'na adres poczty elektronicznej jan.kowalski@example.pl');
  assert.equal(dane.zgoda_email, 'Wyrażam zgodę');
  assert.deepEqual(dane.podstawa_dokument, [{}]);
  assert.equal(dane.zalaczniki.length, 1);
  assert.match(dane.zalaczniki[0].zalacznik_opis, /umowa zbycia akcji.*umowa-zbycia\.pdf/);
  assert.deepEqual(dane.zgoda, [], 'bez wskazanego zgadzajacego sekcja IV zostaje wylaczona');

  bezBrakow('04', dane);
});

test('zadanieWpisu: adres do doreczen inny niz adres zamieszkania, gdy wskazany osobno', () => {
  const dane = kontekst.zadanieWpisu({
    spolka: SPOLKA,
    sprawa: { ...SPRAWA, zadajacy_rola: 'akcjonariusz' },
    zadajacy: { ...ZADAJACY_PELNY, adres_doreczen: 'skrytka pocztowa 12' },
    osoby: new Map(),
    dokumenty: DOKUMENTY_SPRAWY,
    dzis: '2026-08-13',
  });
  assert.equal(dane.zadajacy_adres, '80-180 Gdańsk, ulica Kwiatowa nr 4/2', 'adres zamieszkania NIE ustepuje adresowi do doreczen (w odroznieniu od adresPelny)');
  assert.equal(dane.zadajacy_adres_doreczen, 'skrytka pocztowa 12');
});

test('zadanieWpisu: zgoda innej osoby (sekcja IV) - formy zalezne od plci zgadzajacego', () => {
  const zgadzajaca = { typ: 'fizyczna', imie: 'Anna', nazwisko: 'Nowak', pesel: '85050512309', plec: 'kobieta' };
  const dane = kontekst.zadanieWpisu({
    spolka: SPOLKA,
    sprawa: { ...SPRAWA, zadajacy_rola: 'nabywca' },
    zadajacy: ZADAJACY_PELNY,
    osoby: new Map(),
    dokumenty: DOKUMENTY_SPRAWY,
    zgadzajacy: zgadzajaca,
    dzis: '2026-08-13',
  });
  assert.equal(dane.zgadzajacy_mianownik, 'Anna Nowak');
  assert.equal(dane.zgadzajacy_identyfikator, 'PESEL 85050512309');
  assert.equal(dane.zgadzajacy_podpisany, 'podpisana');
  assert.deepEqual(dane.zgoda, [{}]);

  bezBrakow('04', dane);
});

test('zadanieWpisu: bez dokumentu bedacego podstawa wpisu sekcja "podstawa_dokument" jest pusta, nie brakiem', () => {
  const dane = kontekst.zadanieWpisu({
    spolka: SPOLKA,
    sprawa: { ...SPRAWA, zadajacy_rola: 'akcjonariusz', dokument_rodzaj: null, dokument_data: null },
    zadajacy: ZADAJACY_PELNY,
    osoby: new Map(),
    dokumenty: [],
    dzis: '2026-08-13',
  });
  assert.deepEqual(dane.podstawa_dokument, []);
  assert.deepEqual(dane.zalaczniki, []);
  const wynik = wzoryDysk.wypelnij('04', dane);
  assert.deepEqual(wynik.bledy, []);
  assert.ok(!wynik.brakujace.includes('podstawa_dokument (sekcja)'));
  assert.ok(!wynik.brakujace.includes('zalaczniki (sekcja)'));
});
