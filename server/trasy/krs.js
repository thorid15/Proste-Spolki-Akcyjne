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
const { parseKrsDate } = require('../logika/daty-krs');
const { normalizujRegon } = require('../logika/regon');
const { ustalSadRejestrowy } = require('../logika/sad-rejestrowy');

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

/** Zamienia „1,00" (zapis PLN z API KRS, przecinek dziesiętny) na grosze. */
function zlotePlnNaGrosze(tekst) {
  if (tekst == null || tekst === '') return null;
  const liczba = Number(String(tekst).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(liczba) ? Math.round(liczba * 100) : null;
}

/**
 * Mapuje odpowiedz API KRS na pola formularza spolki.
 * Mapowanie jest OBRONNE - struktura odpowiedzi bywa rozna dla roznych
 * rejestrow, a brak pojedynczego pola nie moze wywrocic calosci.
 */
/**
 * Ścieżki poniżej zweryfikowano na ŻYWEJ odpowiedzi API dla KRS 0001114217
 * (rejestr=P, PROSTA SPÓŁKA AKCYJNA, pobrane 17.08.2026) — patrz plik roboczy
 * z tej weryfikacji. Trzy ustalenia, które zmieniły wcześniejsze (niesprawdzone)
 * domysły z sesji 6/fazy 3:
 *   1. Kapitał akcyjny leży pod `dzial1.kapitalPSA.wysokoscKapitaluAkcyjnego`
 *      (obiekt `{wartosc, waluta}`, NIE płaski klucz) — osobna gałąź od
 *      kapitału zakładowego sp. z o.o./S.A., zapisana przecinkiem dziesiętnym
 *      ("1,00"), nie kropką.
 *   2. `dzial2.reprezentacja` to OBIEKT (`{nazwaOrganu, sposobReprezentacji,
 *      sklad: [...]}`), nie tablica — lista osób jest pod `.sklad`, a każda
 *      pozycja ma zagnieżdżone `nazwisko.nazwiskoICzlon` / `imiona.imie`
 *      (+ `imiona.imieDrugie`) / `funkcjaWOrganie`.
 *   3. W odpisie DLA REJESTRU P (przedsiębiorcy — spółki) NIE MA żadnego pola
 *      z oznaczeniem sądu rejestrowego — ani w `naglowekA`, ani w `dzial1`.
 *      Jedyne pole ze słowem „sąd" (`naglowekA.oznaczenieSaduDokonujacegoOstatniegoWpisu`)
 *      to sąd/system, który dokonał OSTATNIEGO WPISU (dla e-KRS zwykle
 *      „SYSTEM"), nie sąd prowadzący rejestr — to inna informacja, nie wolno
 *      jej użyć jako namiastki. Import sądu rejestrowego z tego API nie jest
 *      możliwy — patrz fallback z tabelą TERYT (sekcja 1.7 poprawek).
 * Pozostałe pola (nazwa, forma prawna, NIP, REGON, adres, e-mail, data
 * rejestracji, data ostatniego wpisu, adres do e-doręczeń) sprawdzone i
 * poprawione tak samo. Kandydaci ścieżek z wcześniejszej wersji zostają jako
 * DODATKOWY fallback (inne odpisy/rejestry mogą się różnić), ale sprawdzona
 * ścieżka jest zawsze pierwsza. Krok 1 kreatora rejestracji spółki nadal
 * pokazuje surowy JSON obok zmapowanego podglądu — do weryfikacji na
 * kolejnych, innych spółkach. Brakujące pole = wpis ręczny.
 */
function zmapuj(odpowiedz, numerKrs) {
  const dane = zeSciezek(odpowiedz, ['odpis.dane', 'dane']) || {};
  const naglowek = zeSciezek(odpowiedz, ['odpis.naglowekA', 'naglowekA']) || {};
  const podmiot = zeSciezek(dane, ['dzial1.danePodmiotu']) || {};
  const adres = zeSciezek(dane, ['dzial1.siedzibaIAdres']) || {};
  const kapital = zeSciezek(dane, ['dzial1.kapitalPSA', 'dzial1.kapitalSpolki', 'dzial1.kapital']) || {};
  const organ = zeSciezek(dane, ['dzial2.reprezentacja']) || {};
  const skladOrganu = Array.isArray(organ.sklad)
    ? organ.sklad
    : Array.isArray(organ)
      ? organ // starsza (niesprawdzona) hipoteza: reprezentacja wprost jako tablica
      : [];

  const kapitalWartosc = zeSciezek(kapital, [
    'wysokoscKapitaluAkcyjnego.wartosc',
    'wysokoscKapitaluAkcyjnego',
    'wysokoscKapitalu',
    'kapitalAkcyjny',
  ]);

  const { regon } = normalizujRegon(zeSciezek(podmiot, ['identyfikatory.regon']));

  // Fallback sadu rejestrowego (sekcja 1.7 poprawek) - API nie zwraca tego
  // pola (patrz komentarz wyzej), wiec dopasowujemy wg gminy siedziby spolki
  // z tej samej odpowiedzi. Baza (server/dane/sady-rejestrowe.json) pokrywa
  // ok. 2150 z ok. 2477 gmin w Polsce - reszta to nazwy powtarzajace sie w
  // kilku wojewodztwach (bez TERYT nie do rozstrzygniecia bez zgadywania)
  // oraz Warszawa/Krakow (podzial wlasciwosci na poziomie dzielnicy, ktorej
  // API KRS nie zwraca) - dla nich zwraca null i pole zostaje puste, jak
  // dotychczas. Patrz server/dane/README-SADY-REJESTROWE.md.
  const siedziba = zeSciezek(adres, ['siedziba']) || {};
  const propozycjaSadu = ustalSadRejestrowy({
    gmina: zeSciezek(siedziba, ['gmina']),
  });

  return {
    krs: numerKrs,
    nazwa: zeSciezek(podmiot, ['nazwa']) || null,
    forma_prawna: zeSciezek(podmiot, ['formaPrawna']) || null,
    nip: zeSciezek(podmiot, ['identyfikatory.nip']) || null,
    regon,
    kraj: zeSciezek(adres, ['adres.kraj', 'siedziba.kraj']) || 'Polska',
    kod_pocztowy: zeSciezek(adres, ['adres.kodPocztowy']) || null,
    miejscowosc: zeSciezek(adres, ['adres.miejscowosc', 'siedziba.miejscowosc']) || null,
    ulica: zeSciezek(adres, ['adres.ulica']) || null,
    nr_domu: zeSciezek(adres, ['adres.nrDomu']) || null,
    nr_lokalu: zeSciezek(adres, ['adres.nrLokalu']) || null,
    email: zeSciezek(adres, ['adresPocztyElektronicznej']) || null,
    www: zeSciezek(adres, ['adresStronyInternetowej']) || null,
    // Potwierdzone nieobecne w odpisie dla rejestru P — patrz komentarz wyżej.
    // `propozycjaSadu` (fallback TERYT) albo null — zawsze wymaga
    // potwierdzenia, pole w formularzu zostaje edytowalne (sekcja 1.7 pkt 3).
    sad_rejestrowy: propozycjaSadu ? propozycjaSadu.sad_rejestrowy : null,
    wydzial: propozycjaSadu ? propozycjaSadu.wydzial : null,
    sad_rejestrowy_propozycja: Boolean(propozycjaSadu),
    data_utworzenia_spolki: parseKrsDate(zeSciezek(naglowek, ['dataRejestracjiWKRS', 'dataRejestracji'])),
    // Data zawarcia UMOWY SPÓŁKI (akt założycielski) — różna od daty
    // rejestracji w KRS powyżej. Pierwszy wpis tablicy to zawarcie, kolejne
    // to późniejsze zmiany umowy — bierzemy indeks 0 (sekcja 2.5 poprawek).
    data_zawarcia_umowy_spolki: parseKrsDate(
      zeSciezek(dane, ['dzial1.umowaStatut.informacjaOZawarciuZmianieUmowyStatutu.0.zawarcieZmianaUmowyStatutu'])
    ),
    adres_edorecze:
      zeSciezek(adres, [
        'adresDoDoreczenElektronicznychWpisanyDoBAE',
        'adresDorReczenElektronicznych',
        'adresDoreczenElektronicznych',
        'aeDoreczenia',
      ]) || null,
    kapital_akcyjny_grosze: zlotePlnNaGrosze(kapitalWartosc),
    sklad_organu: skladOrganu
      .map((osoba) => ({
        nazwisko: zeSciezek(osoba, ['nazwisko.nazwiskoICzlon', 'nazwisko', 'nazwaLubFirma']) || null,
        imiona:
          [zeSciezek(osoba, ['imiona.imie', 'imiona']), zeSciezek(osoba, ['imiona.imieDrugie'])]
            .filter(Boolean)
            .join(' ') || null,
        funkcja:
          zeSciezek(osoba, ['funkcjaWOrganie', 'funkcjaWOrganieReprezentujacym', 'funkcja']) || null,
      }))
      .filter((o) => o.nazwisko || o.imiona),
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

  if (dane.regon) {
    const { ostrzezenie } = normalizujRegon(dane.regon);
    if (ostrzezenie) ostrzezenia.push(ostrzezenie);
  }

  const sadZaproponowany = dane.sad_rejestrowy_propozycja;
  delete dane.sad_rejestrowy_propozycja; // znacznik wewnetrzny, nie pole formularza
  if (sadZaproponowany) {
    ostrzezenia.push(
      'Sąd rejestrowy zaproponowany na podstawie siedziby spółki — sprawdź przed zapisaniem.'
    );
  } else if (!dane.sad_rejestrowy) {
    ostrzezenia.push('API KRS nie podaje oznaczenia sądu rejestrowego — uzupełnij pole ręcznie.');
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
  return {
    znaleziono: true,
    dane,
    surowa: tresc,
    dopuszczalna: true,
    ostrzezenia,
    sad_rejestrowy_propozycja: Boolean(sadZaproponowany),
  };
}

module.exports = { pobierzZKrs, zmapuj };
