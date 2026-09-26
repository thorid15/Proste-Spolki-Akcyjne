'use strict';

/**
 * Wspolne rusztowanie testow: baza w pamieci + skroty do budowania zdarzen.
 */

const baza = require('../server/baza');
const migracje = require('../server/migracje');
const rejestr = require('../server/rejestr');
const czas = require('../server/pomocnicze/czas');

/** Swiezia baza w pamieci z wykonanymi migracjami. */
function bazaTestowa() {
  const db = baza.otworz(':memory:');
  migracje.uruchom(db);
  return db;
}

function dodajSpolke(db, nadpisania = {}) {
  const dane = {
    krs: '0000111222',
    nip: '5252525252',
    regon: null,
    nazwa: 'Testowa P.S.A.',
    forma_prawna: 'PROSTA SPÓŁKA AKCYJNA',
    status: 'aktywna',
    data_umowy: '2026-01-02',
    opis: null,
    uwagi: null,
    zakaz_glosu_zastawnika_umowa: null,
    utworzono: czas.terazIso(),
    ...nadpisania,
  };
  const wynik = db
    .prepare(
      `INSERT INTO psa_spolki
         (krs, nip, regon, nazwa, forma_prawna, status, data_umowy, opis, uwagi,
          zakaz_glosu_zastawnika_umowa, utworzono)
       VALUES
         (@krs, @nip, @regon, @nazwa, @forma_prawna, @status, @data_umowy, @opis, @uwagi,
          @zakaz_glosu_zastawnika_umowa, @utworzono)`
    )
    .run(dane);
  return Number(wynik.lastInsertRowid);
}

function dodajOsobe(db, nadpisania = {}) {
  const dane = {
    typ: 'fizyczna',
    nazwisko: 'Kowalski',
    imie: 'Jan',
    nazwa: null,
    pesel: null,
    aml_status: 'wykonane',
    utworzono: czas.terazIso(),
    ...nadpisania,
  };
  const wynik = db
    .prepare(
      `INSERT INTO psa_osoby (typ, nazwisko, imie, nazwa, pesel, aml_status, utworzono)
       VALUES (@typ, @nazwisko, @imie, @nazwa, @pesel, @aml_status, @utworzono)`
    )
    .run(dane);
  return Number(wynik.lastInsertRowid);
}

/**
 * Skrot: dokonuje wpisu i zwraca zapisane zdarzenie.
 *
 * Emisje domyslnie dostaja `data_wpisu_krs` rowna dacie zdarzenia - wiekszosc
 * testow sprawdza logike NIEZWIAZANA z regula domenowa 12 (blokada wpisu akcji
 * przed wpisem emisji do KRS, sprint 5) i zaklada, ze akcje juz istnieja.
 * Testy TEJ konkretnej blokady nadpisuja `data_wpisu_krs: null` wprost.
 */
function wpis(db, spolkaId, typ, data, wejscie, opcje = {}) {
  const wejscieFinalne = typ === 'emisja' ? { data_wpisu_krs: data, ...wejscie } : wejscie;
  // D-R01: `data` to chwila wpisu z zegara wstrzykiwanego w testach
  // (`RRRR-MM-DD` = poludnie tego dnia czasu kancelarii).
  return rejestr.dokonajWpisu(db, {
    spolkaId,
    typ,
    teraz: data,
    wejscie: wejscieFinalne,
    autor: opcje.autor || 'Test',
  });
}

/**
 * Najkrotszy poprawny plik PDF — do testow wgrywania skanow.
 *
 * Serwer sprawdza SYGNATURE tresci, nie samo rozszerzenie nazwy (plik
 * „skan.pdf" o tresci HTML wracal wczesniej do pracownika jako wykonywalna
 * strona), wiec atrapa musi zaczynac sie od `%PDF-`.
 */
const PDF_TESTOWY =
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n' +
  'trailer<</Root 1 0 R>>\n%%EOF\n';

/**
 * Akcjonariusz KOMPLETNY wobec art. 300(33) § 1 KSH - nazwisko, PESEL i adres.
 * Od etapu "dane akcjonariuszy sa wymagane" zlozenie wniosku z brakami konczy
 * sie odmowa, wiec kazda przymiarka, ktora idzie dalej niz sam formularz,
 * musi wyjsc od pelnego zestawu. Uzycie: { ...AKCJONARIUSZ_PELNY, nazwisko: 'X' }.
 */
const AKCJONARIUSZ_PELNY = {
  typ: 'fizyczna',
  imie: 'Anna',
  nazwisko: 'Nowak',
  pesel: '85050512345',
  kod_pocztowy: '80-280',
  miejscowosc: 'Gdansk',
  ulica: 'Boleslawa Lesmiana 3/U10',
  // E-mail operacyjny (Z-006/P-004) - obowiazkowy do zlozenia wniosku,
  // niezalezny od zgody na e-mail W REJESTRZE (Z-157).
  email: 'anna.nowak@example-test.pl',
};

/** Zdarzenie w formie "surowej" - do testow czystej logiki, bez bazy. */
function zdarzenie(id, typ, data, dane) {
  return { id, typ, data_wpisu: data, dane };
}

module.exports = { bazaTestowa, dodajSpolke, dodajOsobe, wpis, zdarzenie, PDF_TESTOWY, AKCJONARIUSZ_PELNY };
