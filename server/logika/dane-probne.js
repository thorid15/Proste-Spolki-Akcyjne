'use strict';

/**
 * Dane próbne do podglądu wzorów — jeden komplet na wszystkie dziesięć pism
 * (blok A2 sesji 8).
 *
 * PRZEPISANE 1:1 z `wzory/_generatory/dane_testowe.py` (`DANE`), które jest
 * jedynym źródłem prawdy o danych testowych — tam też trzyma się
 * `slownik.py`, lista kluczy. Fikcyjne dane; spółka i osoby nie istnieją.
 *
 * Przy zmianie `dane_testowe.py` ten plik trzeba przepisać ręcznie — nie ma
 * (i celowo nie będzie) automatycznego mostu Python → Node w aplikacji
 * (żadnych zależności ani wywołań procesu Python w czasie działania serwera).
 */

const DANE_PROBNE =
{
  notariusz_mianownik: 'Łukasz Kozon',
  notariusz_dopelniacz: 'Łukasza Kozona',
  notariusz_narzednik: 'Łukaszem Kozonem',
  podpisujacy_funkcja: 'Notariusz',
  podpisujacy_mianownik: 'Łukasz Kozon',
  kancelaria_miasto: 'Gdańsk',
  kancelaria_miasto_miejscownik: 'Gdańsku',
  kancelaria_ulica: 'Bolesława Leśmiana nr 3/U10',
  kancelaria_kod: '80-280',
  kancelaria_email: 'biuro@notariusz.gdansk.pl',
  kancelaria_telefon: '+48 455 406 290',
  kancelaria_nip: '9571165704',
  kancelaria_regon: '526934899',
  spolka_firma: 'CHARLIE UNICORN AI',
  spolka_siedziba_mianownik: 'Warszawa',
  spolka_siedziba_miejscownik: 'Warszawie',
  spolka_adres_pelny: '00-697 Warszawa, ulica Aleje Jerozolimskie nr 51',
  spolka_sad_rejestrowy: 'Sąd Rejonowy dla m.st. Warszawy w Warszawie, XII Wydział Gospodarczy Krajowego Rejestru Sądowego',
  spolka_krs: '0001257646',
  spolka_nip: '7011325910',
  spolka_regon: '545410859',
  spolka_email: 'kontakt@charlieunicorn.ai',
  spolka_organ: 'Zarząd',
  spolka_organ_czlonkowie: 'członków zarządu',
  pismo_data: '13.08.2026',
  sprawa_numer: 'RA/2026/0042',
  adresat_nazwa: 'Jan Kowalski',
  adresat_adres: '80-180 Gdańsk, ulica Kwiatowa nr 4 m. 2',
  reprezentant_biernik: 'Łukasza Adriana Szymborskiego',
  reprezentant_rodzice: 'Pawła i Izabelli',
  reprezentant_dowod: 'DGK 138559',
  reprezentant_pesel: '88081105939',
  reprezentant_adres: '76-015 Manowo, ulica Kasztanowa nr 17 m. 1',
  reprezentant_funkcja_biernik: 'Prezesa Zarządu',
  reprezentant_reprezentacja: 'uprawnionego do samodzielnej reprezentacji',
  reprezentant_syn_corka: 'syna',
  reprezentant_legitymujacy: 'legitymującego się',
  reprezentant_zamieszkaly: 'zamieszkałego',
  reprezentant_dzialajacy: 'działającego',
  zadanie_data: '13.08.2026',
  zadanie_data_wplywu: '10.08.2026',
  zadajacy_mianownik: 'Jan Kowalski',
  zadajacy_identyfikator: 'PESEL 88081105939',
  zadajacy_adres: '80-180 Gdańsk, ulica Kwiatowa nr 4 m. 2',
  zadajacy_adres_doreczen: 'jak wyżej',
  zadajacy_email: 'jan@kowalski.pl',
  zadajacy_rola: 'nabywca akcji',
  sposob_doreczen: 'na adres poczty elektronicznej jan@kowalski.pl',
  zgoda_email: 'Wyrażam zgodę',
  dokument_rodzaj: 'umowa sprzedaży akcji',
  dokument_data: '01.08.2026',
  dokument_strony: 'Anna Nowak (zbywca) i Jan Kowalski (nabywca)',
  zgadzajacy_mianownik: 'Anna Nowak',
  zgadzajacy_identyfikator: 'PESEL 75042311111',
  zadajacy_podpisany: 'podpisany',
  zadajacy_zamieszkaly: 'zamieszkały',
  zgadzajacy_podpisany: 'podpisana',
  zapoznany: 'zapoznałem się',
  wpis_data: '13.08.2026',
  wpis_godzina: '11:42',
  wpis_opis: 'wykreślenie Anny Nowak jako uprawnionej z 250 akcji serii A o numerach od 1 do 250 i wpisanie w to miejsce Jana Kowalskiego',
  termin_stanowiska: '20.08.2026',
  termin_usuniecia: '20.08.2026',
  sposob_usuniecia: 'przedłożenie zgody spółki na zbycie akcji nie w pełni pokrytej',
  umowa_data: '13.08.2026',
  umowa_data_slownie: '13 sierpnia 2026 roku',
  taksa_roczna: '1200',
  taksa_roczna_slownie: 'jeden tysiąc dwieście złotych',
  taksa_wpis: '100',
  taksa_wpis_slownie: 'sto złotych',
  taksa_informacja: '50',
  taksa_informacja_slownie: 'pięćdziesiąt złotych',
  uchwala_numer: '1',
  uchwala_data_slownie: '12 sierpnia 2026 roku',
  uchwala_tryb_glosowania: 'jednogłośnie',
  uchwala_glosy_za: '1000',
  uchwala_glosy_przeciw: '0',
  uchwala_glosy_wstrzymujace: '0',
  uchwala_procent_glosow: '100%',
  lista_stan_na_dzien: '13.08.2026',
  lista_akcje_razem: '1000',
  klauzula_paragraf: '7',
  zbywca_email: 'anna@nowak.pl',
  nabywca_email: 'jan@kowalski.pl',
  klauzula_pokrycie: 'zostały w całości pokryte',
  klauzula_ograniczenia: 'umowa spółki nie ogranicza rozporządzania akcjami',
  pozycje: [
    {
      pozycja_akcjonariusz: 'Jan Kowalski',
      pozycja_seria: 'A',
      pozycja_numery: '1–250',
      pozycja_liczba: '250',
      pozycja_obciazenia: 'brak'
    },
    {
      pozycja_akcjonariusz: 'Łukasz Adrian Szymborski',
      pozycja_seria: 'A',
      pozycja_numery: '251–1000',
      pozycja_liczba: '750',
      pozycja_obciazenia: 'brak'
    }
  ],
  akcjonariusze: [
    {
      akcjonariusz_lp: '1',
      akcjonariusz_nazwa: 'Jan Kowalski',
      akcjonariusz_seria: 'A',
      akcjonariusz_liczba_akcji: '250',
      akcjonariusz_liczba_glosow: '250',
      akcjonariusz_obciazenia: 'brak'
    },
    {
      akcjonariusz_lp: '2',
      akcjonariusz_nazwa: 'Łukasz Adrian Szymborski',
      akcjonariusz_seria: 'A',
      akcjonariusz_liczba_akcji: '750',
      akcjonariusz_liczba_glosow: '750',
      akcjonariusz_obciazenia: 'brak'
    }
  ],
  czlonkowie_organu: [ { czlonek_mianownik: 'Łukasz Adrian Szymborski', czlonek_funkcja: 'Prezes Zarządu' } ],
  zalaczniki: [ { zalacznik_opis: 'umowa sprzedaży akcji z dnia 1 sierpnia 2026 roku' } ],
  przeszkody: [ { przeszkoda_opis: 'brak zgody spółki na zbycie akcji nie w pełni pokrytej' } ],
  przyczyny: [ { przyczyna_opis: 'nieusunięcie przeszkody w wyznaczonym terminie' } ],
  wpis_konstytutywny: [ {} ],
  wpis_deklaratoryjny: [],
  zgoda: [ {} ],
  podstawa_dokument: [ {} ],
  adresat_zadajacy: [ {} ],
  adresat_spolka: []
};

module.exports = { DANE_PROBNE };
