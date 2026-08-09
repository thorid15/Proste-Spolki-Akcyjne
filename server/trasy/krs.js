'use strict';

/**
 * Pobranie danych spolki z otwartego API KRS.
 *
 * Sekcja 8 specyfikacji: przy bledzie zwracamy 200 z pustym wynikiem
 * i komunikatem - formularz uzupelnia sie recznie. Awaria zewnetrznego
 * API nie moze blokowac zalozenia rejestru.
 */

const konfiguracja = require('../konfiguracja');
const przepisy = require('../logika/przepisy');

const LIMIT_CZASU_MS = 8000;

/** Siega po pierwsza niepusta wartosc ze wskazanych sciezek. */
function zeSciezek(zrodlo, sciezki) {
  for (const sciezka of sciezki) {
    let biezacy = zrodlo;
    for (const klucz of sciezka.split('.')) {
      if (biezacy == null) break;
      biezacy = biezacy[klucz];
    }
    if (biezacy != null && biezacy !== '') return biezacy;
  }
  return null;
}

/**
 * Mapuje odpowiedz API KRS na pola formularza spolki.
 * Mapowanie jest OBRONNE - struktura odpowiedzi bywa rozna dla roznych
 * rejestrow, a brak pojedynczego pola nie moze wywrocic calosci.
 */
/**
 * Pola dopisane w sesji 6, fazie 3 (import rozszerzony) NIE zostaly
 * zweryfikowane wprost przeciwko zywej odpowiedzi API - srodowisko
 * deweloperskie, w ktorym powstal ten kod, nie mialo dostepu sieciowego do
 * api-krs.ms.gov.pl. Kandydaci scieżek sa oparte o realny odpis (PDF Rubryka
 * 2.5/8.1/Dzial 2 Rubryka 1) i konwencje juz potwierdzonych pol powyzej
 * (`naglowekA`, `dzial1.siedzibaIAdres`), ale sa NAJLEPSZYM PRZYBLIZENIEM,
 * nie potwierdzonym faktem. Dlatego krok 1 kreatora rejestracji spolki
 * ZAWSZE pokazuje surowy JSON obok zmapowanego podgladu (sekcja 3 sesji) -
 * to wlasciwe miejsce weryfikacji, na zywych danych, nie ten komentarz.
 * Brakujace pole = wpis reczny (bez zmian w tej regule).
 */
function zmapuj(odpowiedz, numerKrs) {
  const dane = zeSciezek(odpowiedz, ['odpis.dane', 'dane']) || {};
  const naglowek = zeSciezek(odpowiedz, ['odpis.naglowekA', 'naglowekA']) || {};
  const podmiot = zeSciezek(dane, ['dzial1.danePodmiotu']) || {};
  const adres = zeSciezek(dane, ['dzial1.siedzibaIAdres']) || {};
  const kapital = zeSciezek(dane, ['dzial1.kapitalSpolki', 'dzial1.kapital']) || {};
  const reprezentacja =
    zeSciezek(dane, ['dzial2.reprezentacja', 'dzial2.organReprezentujacy']) || [];

  const kapitalZlote = zeSciezek(kapital, [
    'wysokoscKapitaluAkcyjnego',
    'wysokoscKapitalu',
    'kapitalAkcyjny',
  ]);

  return {
    krs: numerKrs,
    nazwa: zeSciezek(podmiot, ['nazwa']) || null,
    forma_prawna: zeSciezek(podmiot, ['formaPrawna']) || null,
    nip: zeSciezek(podmiot, ['identyfikatory.nip']) || null,
    regon: zeSciezek(podmiot, ['identyfikatory.regon']) || null,
    kraj: zeSciezek(adres, ['adres.kraj', 'siedziba.kraj']) || 'Polska',
    kod_pocztowy: zeSciezek(adres, ['adres.kodPocztowy']) || null,
    miejscowosc: zeSciezek(adres, ['adres.miejscowosc', 'siedziba.miejscowosc']) || null,
    ulica: zeSciezek(adres, ['adres.ulica']) || null,
    nr_domu: zeSciezek(adres, ['adres.nrDomu']) || null,
    nr_lokalu: zeSciezek(adres, ['adres.nrLokalu']) || null,
    email: zeSciezek(adres, ['adresPocztyElektronicznej']) || null,
    www: zeSciezek(adres, ['adresStronyInternetowej']) || null,
    sad_rejestrowy:
      zeSciezek(naglowek, ['oznaczenieSaduPrzechowujacegoAkta', 'sadRejestrowy']) || null,
    data_utworzenia_spolki:
      zeSciezek(naglowek, ['dataRejestracjiWKRS', 'dataRejestracji']) || null,
    // ── Rozszerzony import (faza 3) — patrz zastrzeżenie w komentarzu wyżej.
    data_ostatniego_wpisu_krs:
      zeSciezek(naglowek, [
        'dataDokonaniaOstatniegoWpisu',
        'ostatniWpis.dataDokonaniaWpisu',
        'dataWpisu',
      ]) || null,
    adres_edorecze:
      zeSciezek(adres, [
        'adresDorReczenElektronicznych',
        'adresDoreczenElektronicznych',
        'aeDoreczenia',
      ]) || null,
    kapital_akcyjny_grosze: kapitalZlote != null ? Math.round(Number(kapitalZlote) * 100) : null,
    sklad_organu: Array.isArray(reprezentacja)
      ? reprezentacja
          .map((osoba) => ({
            nazwisko: zeSciezek(osoba, ['nazwisko', 'nazwaLubFirma']) || null,
            imiona: zeSciezek(osoba, ['imiona']) || null,
            funkcja: zeSciezek(osoba, ['funkcjaWOrganieReprezentujacym', 'funkcja']) || null,
          }))
          .filter((o) => o.nazwisko || o.imiona)
      : [],
  };
}

/**
 * @returns {{ znaleziono: boolean, dane?: object, ostrzezenia?: string[], komunikat?: string }}
 */
async function pobierzZKrs(numerKrs) {
  const url = `${konfiguracja.KRS_API_URL}/OdpisAktualny/${numerKrs}?rejestr=P&format=json`;

  let odpowiedz;
  try {
    odpowiedz = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(LIMIT_CZASU_MS),
    });
  } catch (e) {
    return {
      znaleziono: false,
      komunikat:
        'Nie udało się połączyć z API KRS. Uzupełnij dane spółki ręcznie — ' +
        'pobranie można powtórzyć później.',
    };
  }

  if (odpowiedz.status === 404) {
    return {
      znaleziono: false,
      komunikat:
        `W rejestrze przedsiębiorców nie znaleziono podmiotu o numerze KRS ${numerKrs}. ` +
        'Sprawdź numer albo uzupełnij dane ręcznie.',
    };
  }
  if (!odpowiedz.ok) {
    return {
      znaleziono: false,
      komunikat: `API KRS odpowiedziało błędem (${odpowiedz.status}). Uzupełnij dane ręcznie.`,
    };
  }

  let tresc;
  try {
    tresc = await odpowiedz.json();
  } catch {
    return {
      znaleziono: false,
      komunikat: 'Odpowiedź API KRS jest nieczytelna. Uzupełnij dane ręcznie.',
    };
  }

  const dane = zmapuj(tresc, numerKrs);
  const ostrzezenia = [];

  if (!dane.nazwa) {
    ostrzezenia.push('API KRS nie zwróciło nazwy spółki — sprawdź i uzupełnij ręcznie.');
  }

  // Regula domenowa nr 11: rejestru nie prowadzimy dla S.A. ani S.K.A.
  const ocena = przepisy.ocenFormePrawna(dane.forma_prawna);
  if (dane.forma_prawna && !ocena.dozwolona) {
    return { znaleziono: true, dane, surowa: tresc, dopuszczalna: false, komunikat: ocena.powod };
  }
  if (!dane.forma_prawna) {
    ostrzezenia.push(
      'API KRS nie zwróciło formy prawnej. Potwierdź, że podmiot jest prostą spółką akcyjną.'
    );
  }

  // `surowa` niesie NIEPRZETWORZONA odpowiedz API - krok 1 kreatora (faza 3)
  // pokazuje ja obok zmapowanego podgladu, zeby dalo sie sprawdzic mapowanie
  // na zywych danych (patrz zastrzezenie przy `zmapuj`).
  return { znaleziono: true, dane, surowa: tresc, dopuszczalna: true, ostrzezenia };
}

module.exports = { pobierzZKrs, zmapuj };
