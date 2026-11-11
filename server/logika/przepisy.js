'use strict';

/**
 * JEDYNE zrodlo wiedzy prawnej modulu (sekcja 3 i 16 specyfikacji).
 *
 * Zmiana prawa = edycja TEGO pliku + nowe testy. Nigdzie indziej nie wolno
 * hardkodowac stawek, terminow ani regul prawnych.
 *
 * Kazda regula ponizej wskazuje jednostke redakcyjna z `PRZEPISY-PSA.md`
 * (w korzeniu repozytorium) - jedynego zrodla prawnego modulu. Legenda z
 * tamtego pliku: 🟢 obowiazuje, 🔵 wchodzi w zycie 18.02.2027, ⚠️ nie
 * pochodzi z wydruku KSH - wymaga weryfikacji przez Lukasza i NIE moze byc
 * podstawa blokady, dopoki nie zostanie potwierdzone (PRZEPISY-PSA.md § 13).
 *
 * Sprint 5 (zgodnosc z ustawa, 08.2026) przepisal ten plik od podstaw po
 * odkryciu, ze wczesniejsze wersje mieszaly przepisy P.S.A. z przepisami
 * spolki akcyjnej (PRZEPISY-PSA.md § 12 - "Czego w P.S.A. NIE MA"). Cztery
 * poprawki wobec wersji z 08.2026, przed sprintem 5:
 *   1. brak pośredniczenia w wypłatach - w tym pliku nigdy nie bylo takiej
 *      logiki, wiec nic nie usunieto; odnotowane dla porzadku;
 *   2. nowelizacja NIE rozszerza katalogu danych rejestru (art. 300(33) § 1
 *      pkt 1-11 bez zmian) - dodaje WYLACZNIE maskowanie (POLA_WRAZLIWE);
 *   3. USUNIETO `FORMY_ZGODY` - katalog form zgody na wpis (podpis notarialnie
 *      poswiadczony / kwalifikowany / zaufany / osobisty) nie ma podstawy w
 *      art. 300(34) § 3 KSH - to regulacja spolki akcyjnej, mechanicznie
 *      przeniesiona do wczesniejszej wersji tego pliku;
 *   4. zgloszenie zmian danych z art. 300(33) § 3 KSH idzie DO PODMIOTU
 *      PROWADZACEGO REJESTR (do nas), nie do sadu rejestrowego.
 */

// ─────────────────────────────────────────────────────────────
// TERMINY
// ─────────────────────────────────────────────────────────────

const TERMINY = {
  /**
   * PRZEPISY-PSA.md art. 300(34) § 1 🟢 - wpis nie pozniej niz 7 dni od otrzymania zadania; po usunieciu
   * przeszkody termin biegnie od nowa (`server/logika/terminy.js`).
   */
  WPIS_DNI: 7,
};

/**
 * PRZEPISY-PSA.md art. 300(32) § 3 🔵 (od 18.02.2027) - podmiot prowadzacy rejestr zawiadamia sad rejestrowy
 * (system teleinformatyczny KRS) o wygasnieciu albo rozwiazaniu umowy w terminie 7 dni od tej daty. Data
 * rozwiazania = data zamkniecia rejestru. Zwraca termin (RRRR-MM-DD) albo null, gdy obowiazek nie dotyczy.
 */
const ZAWIADOMIENIE_SADU = { OD: '2027-02-18', DNI: 7 };
function terminZawiadomieniaSadu(dzienZamkniecia) {
  if (!dzienZamkniecia || dzienZamkniecia < ZAWIADOMIENIE_SADU.OD) return null;
  const d = new Date(`${dzienZamkniecia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ZAWIADOMIENIE_SADU.DNI);
  return d.toISOString().slice(0, 10);
}

/** Progi ostrzegania o zblizajacym sie terminie (sekcja 9 - pulpit). */
const PROGI_TERMINU = {
  /** <= tyle dni do konca terminu USTAWOWEGO = sprawa pilna. */
  PILNE_DNI: 2,
};

/**
 * Cel wewnetrzny kancelarii - NIE jest terminem ustawowym.
 *
 * Art. 300(34) § 1 KSH nakazuje dokonac wpisu "niezwlocznie, ale nie pozniej
 * niz w terminie siedmiu dni". Siedem dni to SUFIT, nie cel: samo
 * "niezwlocznie" znaczy krocej. Kolejka spraw pokazuje obie wartosci i
 * wyrozna sprawe po przekroczeniu celu, a nie dopiero pod koniec terminu
 * ustawowego.
 *
 * Wartosc jest zobowiazaniem HANDLOWYM (regulamin, umowa ze spolka), nie
 * ustawowym - jej przekroczenie nie narusza ustawy i nie moze byc
 * prezentowane jak naruszenie. Dni KALENDARZOWE, spojnie z terminem
 * ustawowym liczonym w `terminy.js`.
 */
const CEL_WEWNETRZNY = {
  WPIS_DNI: 3,
};

// ─────────────────────────────────────────────────────────────
// STAWKI (taksa notarialna)
// ─────────────────────────────────────────────────────────────

/**
 * PRZEPISY-PSA.md § 9 ⚠️ - stawki NIE pochodza z wydruku KSH (to rozporzadzenie
 * o taksie notarialnej), wymagaja weryfikacji przez Lukasza. Do czasu
 * weryfikacji sluza WYLACZNIE do naliczania oplat (decyzja juz podjeta,
 * dzialanie juz zbudowane w sprincie 4) - NIE sa i nie moga stac sie podstawa
 * ZADNEJ nowej blokady wpisu (PRZEPISY-PSA.md § 13).
 *
 * Decyzja nr 4 (sekcja 15 CLAUDE-PSA.md): stosujemy stawki MAKSYMALNE.
 * Kwoty w groszach (INTEGER) - regula domenowa nr 5, zadnych floatow.
 */
const STAWKI_GROSZE = {
  /** prowadzenie rejestru: 1200 zl za kazdy rozpoczety rok. */
  PROWADZENIE_ROCZNIE: 120000,
  /** prowadzenie rejestru płatne co miesiąc (U-30): 100 zl za miesiąc. */
  PROWADZENIE_MIESIECZNIE: 10000,
  /** wpis w rejestrze: 100 zl. */
  WPIS: 10000,
  /** informacja z rejestru: 50 zl. */
  INFORMACJA: 5000,
};

/**
 * VAT (naprawa Z-100..Z-109 / sekcja 2.1 promptu naprawczego) - kwoty
 * z rozporzadzenia sa NETTO, do kazdej dolicza sie 23% VAT. To korekta
 * mylnego twierdzenia RAPORT.md § 5 (audyt pomylil usuniecie migracja 17
 * pola `platnik_vat` spolki - status podatnika do klauzuli umownej - z
 * jakoby swiadomym usunieciem VAT z oplat; migracja 17 nigdy nie dotyczyla
 * oplat), nie zmiana polityki - `psa_spolki.platnik_vat` NIE wraca.
 *
 * `psa_oplaty.kwota_grosze` pozostaje NETTO. Brutto NIGDY nie jest
 * przechowywane, wylacznie wyliczane - tu, w jednym miejscu, uzywanym
 * wszedzie (kancelaria i portal, `server/platnosci.js`).
 */
const STAWKA_VAT_PROCENT = 23;

/** Brutto z netto w groszach - zaokraglenie matematyczne do pelnego grosza, na POZYCJI. */
function obliczBrutto(nettoGrosze, vatProcent = STAWKA_VAT_PROCENT) {
  return Math.round((Number(nettoGrosze) * (100 + Number(vatProcent))) / 100);
}

// ─────────────────────────────────────────────────────────────
// ZAKRES PODMIOTOWY
// ─────────────────────────────────────────────────────────────

/** Warianty zapisu formy prawnej spotykane w KRS i we wpisach recznych. */
const FORMA_PRAWNA_WARIANTY = [
  'PROSTA SPÓŁKA AKCYJNA',
  'PROSTA SPOLKA AKCYJNA',
  'P.S.A.',
  'PSA',
  'P.S.A',
];

/** Formy prawne, dla ktorych wprost odmawiamy prowadzenia rejestru. */
const FORMY_PRAWNE_ZABRONIONE = [
  { wzorzec: 'SPÓŁKA AKCYJNA', nazwa: 'spółka akcyjna' },
  { wzorzec: 'SPOLKA AKCYJNA', nazwa: 'spółka akcyjna' },
  { wzorzec: 'SPÓŁKA KOMANDYTOWO-AKCYJNA', nazwa: 'spółka komandytowo-akcyjna' },
  { wzorzec: 'SPOLKA KOMANDYTOWO-AKCYJNA', nazwa: 'spółka komandytowo-akcyjna' },
];

// ─────────────────────────────────────────────────────────────
// DANE WRAZLIWE I MASKOWANIE
// ─────────────────────────────────────────────────────────────

/**
 * PRZEPISY-PSA.md art. 300(35) § 1(1) 🔵 - pozostali akcjonariusze nie maja
 * dostepu do numeru PESEL, daty urodzenia i adresu zamieszkania.
 * Regula domenowa nr 9. Wdrazamy od pierwszego dnia (addytywne, nie wymaga
 * weryfikacji brzmienia).
 *
 * UWAGA (poprawka erraty nr 2, PRZEPISY-PSA.md § 12 pkt 2): nowelizacja NIE
 * rozszerza katalogu danych rejestru (art. 300(33) § 1 pkt 1-11 bez zmian).
 * PESEL, data urodzenia, numer w rejestrze osob prawnych i wspolwlasnosc NIE
 * sa obowiazkowa trescia rejestru P.S.A. - sa informacyjnymi polami
 * dodatkowymi juz istniejacymi w systemie. Jedyna zmiana wprowadzona przez
 * nowelizacje to ZAKAZ udostepniania ponizszych pol pozostalym akcjonariuszom.
 */
const POLA_WRAZLIWE = ['pesel', 'data_urodzenia', 'adres'];

const POLA_KONTAKTOWE = ['email'];

const POLA_TOZSAMOSCI = ['id', 'typ', 'nazwa', 'numer_rejestru', 'rodzaj_adresu'];

const POLA_OSWIADCZEN = ['zgoda_email'];

const ROLE_ODBIORCY = {
  /** Kancelaria prowadzaca rejestr - pelny wglad z definicji. */
  KANCELARIA: 'kancelaria',
  /** Spolka, ktorej rejestr dotyczy - pelny wglad (art. 300(35) § 1 🟢). */
  SPOLKA: 'spolka',
  /** Osoba, ktorej dane dotycza - pelny wglad we wlasne dane. */
  WLASCICIEL_DANYCH: 'wlasciciel_danych',
  /** Inny akcjonariusz - dane zamaskowane (art. 300(35) § 1(1) 🔵). */
  AKCJONARIUSZ: 'akcjonariusz',
  /** Sad, prokuratura, komornik, administracyjny organ egzekucyjny (art. 300(35) § 4 🔵) - pelny wglad. */
  ORGAN: 'organ',
};

/**
 * Biala lista pol widocznych per rola (naprawa Z-150). Poprzednia wersja
 * budowala odpowiedz przez USUWANIE pol z pelnego obiektu - kazde nowe pole
 * dodane do `psa_osoby` (np. AML/PEP w kolejnym sprincie) bylo domyslnie
 * WIDOCZNE, dopoki ktos rowniez nie dopisal go do listy usuwanych. Tak
 * wyciekly `aml_status`/`aml_notatka`/`pep`/`beneficjent_rzeczywisty_id` do
 * roli `spolka`/`organ` (maja "pelny dostep" do TRESCI REJESTRU, ale to nie
 * jest tresc rejestru), a pola PEP/beneficjenta - nawet do roli
 * `akcjonariusz` (bo lista usuwanych obejmowala tylko 4 z ~14 pol
 * kancelaryjnych). Teraz: kazda rola dostaje WYLACZNIE to, co jest na jej
 * liscie - nowe pole w schemacie jest domyslnie NIEWIDOCZNE wszedzie poza
 * kancelaria, dopoki ktos świadomie nie doda go do wlasciwej listy.
 *
 * `null` = pelny dostep (wszystkie pola, wlacznie z kancelaryjnymi) -
 * wylacznie kancelaria i sama osoba (jej wlasne dane).
 */
const BIALE_LISTY = {
  [ROLE_ODBIORCY.KANCELARIA]: null,
  [ROLE_ODBIORCY.WLASCICIEL_DANYCH]: null,
  [ROLE_ODBIORCY.SPOLKA]: [...POLA_TOZSAMOSCI, ...POLA_OSWIADCZEN, ...POLA_WRAZLIWE, ...POLA_KONTAKTOWE],
  [ROLE_ODBIORCY.ORGAN]: [...POLA_TOZSAMOSCI, ...POLA_OSWIADCZEN, ...POLA_WRAZLIWE, ...POLA_KONTAKTOWE],
  // D-182: e-mail innych akcjonariuszy jawny (przy zgodzie — `maskowanie.js`); art. 300³⁵ § 1¹ go nie wymienia.
  [ROLE_ODBIORCY.AKCJONARIUSZ]: [...POLA_TOZSAMOSCI, ...POLA_KONTAKTOWE],
};

// ─────────────────────────────────────────────────────────────
// PODSTAWY PRAWNE - teksty na wydruki i do uzasadnien
// ─────────────────────────────────────────────────────────────

const PODSTAWY = {
  PROWADZENIE_REJESTRU: 'art. 300(31) § 1 KSH',
  ZGODNOSC_LICZBY_AKCJI: 'art. 300(31) § 2 KSH',
  UMOWA_O_PROWADZENIE: 'art. 300(32) KSH',
  KATALOG_DANYCH: 'art. 300(33) § 1 KSH',
  RODZAJ_AKCJI: 'art. 300(33) § 1 pkt 4 KSH',
  WZMIANKA_O_POKRYCIU: 'art. 300(33) § 1 pkt 9 KSH',
  OBOWIAZKI_WOBEC_SPOLKI: 'art. 300(33) § 1 pkt 11 KSH',
  DODATKOWE_INFORMACJE_UMOWY: 'art. 300(33) § 2 KSH',
  ZGLOSZENIE_ZMIAN_PRZEZ_ZARZAD: 'art. 300(33) § 3 KSH',
  TRYB_WPISU: 'art. 300(34) § 1 KSH',
  ZAJECIE_Z_URZEDU: 'art. 300(34) § 2 KSH',
  UPRZEDNIE_POWIADOMIENIE: 'art. 300(34) § 3 KSH',
  // PRZEPISY-PSA.md art. 300(34) § 3 zd. 2 (🔵, stosowane od dzis — D-076).
  FORMA_ZGODY_NA_WPIS: 'art. 300(34) § 3 zd. 2 KSH',
  FORMA_ZBYCIA: 'art. 300(36) § 4 KSH',
  FORMA_ZGODY_SPOLKI: 'art. 300(39) § 4 KSH, art. 300(40) § 1 KSH',
  WYBOR_PODMIOTU: 'art. 300(31) § 5 KSH',
  // W5.5 — PRZEPISY-PSA.md § 9 (taksa) i § 8 (art. 89 § 2 PrNot), art. 300(35) § 3 KSH.
  WYNAGRODZENIE_INFORMACJI: '§ 15b ust. 3 rozporządzenia w sprawie maksymalnych stawek taksy notarialnej, '
    + 'art. 300(35) § 3 KSH, art. 89 § 2 ustawy — Prawo o notariacie',
  DOSTEP_ORGANOW: 'art. 300(35) § 4 KSH',
  DOKUMENTY_PODSTAWA: 'art. 300(34) § 4 KSH',
  BADANIE_TRESCI_I_FORMY: 'art. 300(34) § 5 KSH',
  OGRANICZENIA_ROZPORZADZANIA: 'art. 300(34) § 6 KSH',
  ZGODA_SPOLKI_NA_ZBYCIE: 'art. 300(39) § 1, 3 KSH',
  PRAWO_PIERWSZENSTWA: 'art. 300(42) KSH',
  OGRANICZENIE_DZIEDZICZENIA: 'art. 300(41) § 3 KSH',
  ZAWIADOMIENIE_O_WPISIE: 'art. 300(34) § 7 KSH',
  LISTA_AKCJONARIUSZY_KRS: 'art. 300(34) § 8 KSH',
  JAWNOSC_REJESTRU: 'art. 300(35) § 1 KSH',
  MASKOWANIE: 'art. 300(35) § 1(1) KSH',
  ZAPYTANIA_ORGANOW: 'art. 300(35) § 4 KSH',
  UNIEWAZNIENIE_AKCJI: 'art. 300(51) KSH',
  ULAMKOWE_CZESCI_AKCJI: 'art. 300(2) § 3 oraz art. 300(43) KSH',
  POKRYCIE_WKLADOW: 'art. 300(9) § 2-3 KSH',
  WNIESIENIE_WKLADOW_TERMIN: 'art. 300(9) § 1 KSH',
  PRAWO_GLOSU: 'art. 300(23) § 1 KSH',
  ZAKAZ_GLOSU_ZASTAWNIKA: 'art. 300(23) § 2 KSH',
  WPIS_WARUNEK_KRS: 'art. 300(30) § 2 KSH',
  WPIS_KONSTYTUTYWNY_DEKLARATORYJNY: 'art. 300(37) § 2 KSH',
  WSPOLNY_PRZEDSTAWICIEL: 'art. 300(38) § 3-4 KSH',
  NIEPELNE_POKRYCIE: 'art. 300(40) § 1 KSH',
  EMISJA_POWSTAJE_Z_WPISEM_KRS: 'art. 300(107) § 3 KSH',
  SANKCJA_WPIS_PRZED_KRS: 'art. 592 § 3 KSH',
  NOTARIAT_REJESTR: 'art. 108a ustawy — Prawo o notariacie',
  NOTARIAT_WYLACZENIA: 'art. 108b ustawy — Prawo o notariacie',
  TAKSA: '§ 15b rozporządzenia w sprawie maksymalnych stawek taksy notarialnej',
  WYKAZ_PRZY_WYKRESLENIU: 'art. 476 § 1(1) KSH',
  ZAPYTANIE_SADU: 'art. 25da ustawy o Krajowym Rejestrze Sądowym',
};

/**
 * Czy podana forma prawna kwalifikuje spolke do prowadzenia rejestru przez
 * notariusza. Zwraca { dozwolona, powod }.
 */
function ocenFormePrawna(formaPrawna) {
  const tekst = String(formaPrawna || '').trim().toUpperCase();
  if (!tekst) {
    return { dozwolona: false, powod: 'Nie podano formy prawnej spółki.' };
  }
  // Warianty skrocone ("PSA", "P.S.A.") dopuszczamy wylacznie jako doslowna
  // wartosc pola, zeby nie zlapac przypadkowego podciagu w nazwie wlasnej.
  // Warianty pelne dopuszczamy takze jako fragment, bo KRS bywa rozwlekly.
  const doslowny = FORMA_PRAWNA_WARIANTY.some((w) => tekst === w);
  const pelny = tekst.includes('PROSTA SPÓŁKA AKCYJNA') || tekst.includes('PROSTA SPOLKA AKCYJNA');
  if (doslowny || pelny) {
    // "SPÓŁKA AKCYJNA" jest podciagiem "PROSTA SPÓŁKA AKCYJNA" - kolejnosc
    // sprawdzen ma znaczenie, dlatego wariant P.S.A. badamy jako pierwszy.
    return { dozwolona: true, powod: null };
  }
  const zabroniona = FORMY_PRAWNE_ZABRONIONE.find((f) => tekst.includes(f.wzorzec));
  if (zabroniona) {
    return {
      dozwolona: false,
      powod:
        `Notariusz nie może prowadzić rejestru akcjonariuszy dla formy prawnej: ` +
        `${zabroniona.nazwa}. Rejestr notarialny dotyczy wyłącznie prostych spółek akcyjnych ` +
        `(${PODSTAWY.PROWADZENIE_REJESTRU}).`,
    };
  }
  return {
    dozwolona: false,
    powod:
      `Forma prawna „${formaPrawna}” nie jest prostą spółką akcyjną. ` +
      `Rejestr prowadzimy wyłącznie dla P.S.A. (${PODSTAWY.PROWADZENIE_REJESTRU}).`,
  };
}

module.exports = {
  terminZawiadomieniaSadu,
  TERMINY,
  PROGI_TERMINU,
  CEL_WEWNETRZNY,
  STAWKI_GROSZE,
  STAWKA_VAT_PROCENT,
  obliczBrutto,
  POLA_WRAZLIWE,
  POLA_KONTAKTOWE,
  POLA_TOZSAMOSCI,
  ROLE_ODBIORCY,
  BIALE_LISTY,
  ocenFormePrawna,
};
