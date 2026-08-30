# -*- coding: utf-8 -*-
"""Jedyne źródło prawdy o kluczach wzorów PSA.
Test spójności (test_wzorow.py) porównuje z tym plikiem klucze faktycznie
występujące w .docx. Dodanie klucza do wzoru bez wpisu tutaj = błąd testu."""

# --- konfiguracja modułu (nie z formularza) -------------------------------
KANCELARIA = [
    # notariusz_mianownik: wartość konfiguracyjna — zasila domyślnie podpisujacy_mianownik,
    # nie występuje bezpośrednio w żadnym wzorze
    'notariusz_mianownik', 'notariusz_dopelniacz', 'notariusz_narzednik',
    'podpisujacy_funkcja', 'podpisujacy_mianownik',
    'kancelaria_miasto', 'kancelaria_miasto_miejscownik', 'kancelaria_ulica',
    'kancelaria_kod', 'kancelaria_email', 'kancelaria_telefon',
    'kancelaria_nip', 'kancelaria_regon',
]

# --- spółka (KRS / formularz) ---------------------------------------------
SPOLKA = [
    'spolka_firma', 'spolka_siedziba_mianownik', 'spolka_siedziba_miejscownik',
    'spolka_adres_pelny',
    'spolka_sad_rejestrowy', 'spolka_krs', 'spolka_nip', 'spolka_regon',
    'spolka_email', 'spolka_organ', 'spolka_organ_czlonkowie',
]

# --- pismo / sprawa --------------------------------------------------------
PISMO = ['pismo_data', 'sprawa_numer', 'adresat_nazwa', 'adresat_adres']

# --- reprezentant spółki (wzór 01) ----------------------------------------
REPREZENTANT = [
    'reprezentant_biernik', 'reprezentant_rodzice', 'reprezentant_dowod',
    'reprezentant_pesel', 'reprezentant_adres', 'reprezentant_funkcja_biernik',
    'reprezentant_reprezentacja',
    # formy pochodne z pola plec:
    'reprezentant_syn_corka', 'reprezentant_legitymujacy',
    'reprezentant_zamieszkaly', 'reprezentant_dzialajacy',
]

# --- żądanie i żądający ----------------------------------------------------
ZADANIE = [
    'zadanie_data', 'zadanie_data_wplywu',
    'zadajacy_mianownik', 'zadajacy_identyfikator', 'zadajacy_adres',
    'zadajacy_adres_doreczen', 'zadajacy_email', 'zadajacy_rola',
    'sposob_doreczen', 'zgoda_email',
    'dokument_rodzaj', 'dokument_data', 'dokument_strony',
    'zgadzajacy_mianownik', 'zgadzajacy_identyfikator',
    # formy pochodne z pola plec:
    'zadajacy_podpisany', 'zadajacy_zamieszkaly', 'zgadzajacy_podpisany', 'zapoznany',
]

# --- wpis ------------------------------------------------------------------
WPIS = [
    'wpis_data', 'wpis_godzina', 'wpis_opis',
    'termin_stanowiska', 'termin_usuniecia',
    'sposob_usuniecia',
]

# --- umowa i uchwała -------------------------------------------------------
UMOWA = ['umowa_data', 'umowa_data_slownie',
         'taksa_roczna', 'taksa_roczna_slownie', 'taksa_wpis', 'taksa_wpis_slownie',
         'taksa_informacja', 'taksa_informacja_slownie']
UCHWALA = ['uchwala_numer', 'uchwala_data_slownie', 'uchwala_tryb_glosowania',
           'uchwala_glosy_za', 'uchwala_glosy_przeciw', 'uchwala_glosy_wstrzymujace',
           'uchwala_procent_glosow']

# --- lista akcjonariuszy i klauzula ---------------------------------------
LISTA = ['lista_stan_na_dzien', 'lista_akcje_razem']
KLAUZULA = ['klauzula_paragraf', 'klauzula_pokrycie', 'klauzula_ograniczenia',
            'zbywca_email', 'nabywca_email']

PROSTE = set(KANCELARIA + SPOLKA + PISMO + REPREZENTANT + ZADANIE + WPIS +
             UMOWA + UCHWALA + LISTA + KLAUZULA)

# --- sekcje powtarzalne i warunkowe ---------------------------------------
# warunkowe = kolekcja o 0 albo 1 elemencie (bez nowej składni)
SEKCJE = {
    'pozycje':          ['pozycja_akcjonariusz', 'pozycja_seria', 'pozycja_numery',
                         'pozycja_liczba', 'pozycja_obciazenia'],
    'akcjonariusze':    ['akcjonariusz_lp', 'akcjonariusz_nazwa', 'akcjonariusz_seria',
                         'akcjonariusz_liczba_akcji', 'akcjonariusz_liczba_glosow',
                         'akcjonariusz_obciazenia'],
    'czlonkowie_organu': ['czlonek_mianownik', 'czlonek_funkcja'],
    'zalaczniki':       ['zalacznik_opis'],
    'przeszkody':       ['przeszkoda_opis'],
    'przyczyny':        ['przyczyna_opis'],
    'zgoda':            [],                      # warunkowa 0/1 — art. 300(34) § 3
    'podstawa_dokument': [],                     # warunkowa 0/1 — wpis oparty na dokumencie
    'adresat_zadajacy': [],                      # warunkowa 0/1 — wariant adresata wzoru 07
    'adresat_spolka':   [],                      # warunkowa 0/1 — wariant adresata wzoru 07
    'wpis_konstytutywny': [],                    # warunkowa 0/1 — art. 300(37) § 1
    'wpis_deklaratoryjny': [],                   # warunkowa 0/1 — art. 300(37) § 2
}

W_SEKCJACH = {k for v in SEKCJE.values() for k in v}
ZNANE = PROSTE | W_SEKCJACH | set(SEKCJE)

# --- mapa migracji: stary klucz -> nowy ------------------------------------
MIGRACJA = {
    'miejscowosc': 'kancelaria_miasto',
    'spolka_siedziba': 'spolka_siedziba_mianownik / spolka_siedziba_miejscownik (zależnie od zdania)',
    'data_pisma': 'pismo_data',
    'kancelaria_nazwa': '(rozłożony na tekst stały + notariusz_dopelniacz)',
    'kancelaria_adres': '(rozłożony na kancelaria_ulica/kod/miasto)',
    'kancelaria_kontakt': '(rozłożony na kancelaria_email + kancelaria_telefon)',
    'podpisujacy_imie_nazwisko': 'podpisujacy_mianownik',
    'spolka_adres': 'spolka_adres_pelny',
    'organ_podpisujacy': 'spolka_organ_czlonkowie',
    'data_wplywu_zadania': 'zadanie_data_wplywu',
    'zdarzenie_opis': 'wpis_opis',
    'podstawa_wpisu': 'wpis_podstawa',
    'pouczenie_charakter_wpisu': '(zastąpiony sekcjami warunkowymi wpis_konstytutywny / wpis_deklaratoryjny)',
    'zadajacy_nazwa': 'zadajacy_mianownik',
    'zadajacy_pesel': 'zadajacy_identyfikator',
    'zgadzajacy_nazwa': 'zgadzajacy_mianownik',
    'zadajacy_edoreczenia': 'sposob_doreczen',
    'interes_prawny': 'interes_prawny_opis',
    'inny_dokument': 'dokument_rodzaj',
    'data_dokumentu': 'dokument_data',
    'strony_dokumentu': 'dokument_strony',
    'nazwa_zalacznika': 'zalacznik_opis',
    'opis_przeszkody': 'przeszkoda_opis',
    'opis_przyczyny': 'przyczyna_opis',
    'akcjonariusz': 'pozycja_akcjonariusz',
    'seria': 'pozycja_seria / akcjonariusz_seria',
    'numery': 'pozycja_numery',
    'liczba': 'pozycja_liczba',
    'obciazenia': 'pozycja_obciazenia / akcjonariusz_obciazenia',
    'lp': 'akcjonariusz_lp',
    'nazwa': 'akcjonariusz_nazwa',
    'liczba_akcji': 'akcjonariusz_liczba_akcji',
    'imie_nazwisko': 'czlonek_mianownik',
    'funkcja': 'czlonek_funkcja',
    'stan_na_dzien': 'lista_stan_na_dzien',
    'akcje_razem': 'lista_akcje_razem',
    'numer_paragrafu': 'klauzula_paragraf',
    'oswiadczenie_pokrycie': 'klauzula_pokrycie',
    'oswiadczenie_ograniczenia': 'klauzula_ograniczenia',
    'przewodniczacy_nazwa': '(usunięty — uchwała w trybie pisemnym nie ma przewodniczącego)',
    'tresc_zadanego_wpisu': 'wpis_opis',
    'wpis_podstawa': 'dokument_rodzaj + dokument_data (opis skrócony)',
    'interes_prawny_opis': '(usunięty — rola żądającego wystarcza)',
}
