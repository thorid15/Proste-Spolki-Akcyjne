'use strict';

/**
 * JEDYNE zrodlo wiedzy prawnej modulu (sekcja 3 i 16 specyfikacji).
 *
 * Zmiana prawa = edycja TEGO pliku + nowe testy. Nigdzie indziej nie wolno
 * hardkodowac stawek, terminow ani regul prawnych.
 *
 * Stan prawny: obowiazujacy na 2026-08 + nowelizacja Dz.U. 2026 poz. 176
 * (wejscie w zycie 18.02.2027). Rozwiazania nowelizacji, ktore sa addytywne
 * i nie wymagaja weryfikacji brzmienia (maskowanie, szerszy katalog danych),
 * wdrazamy od pierwszego dnia.
 *
 * UWAGA (decyzja nr 2 z sekcji 15 specyfikacji): brzmienie przepisow
 * nowelizacji spisane z opracowan branzowych. Kazda pozycja oznaczona
 * `DO_WERYFIKACJI: true` czeka na potwierdzenie tekstu ustawy przez Lukasza
 * i NIE moze byc podstawa walidacji blokujacej dopoki nie zostanie
 * potwierdzona.
 */

// ─────────────────────────────────────────────────────────────
// TERMINY
// ─────────────────────────────────────────────────────────────

const TERMINY = {
  /** art. 300(34) § 1 KSH - wpis nie pozniej niz 7 dni od otrzymania zadania. */
  WPIS_DNI: 7,

  /**
   * art. 300(34) § 1 zd. 2 KSH - przy przeszkodzie termin biegnie od nowa,
   * liczony od dnia jej usuniecia (nie: doliczany do reszty starego terminu).
   */
  WPIS_PO_USUNIECIU_PRZESZKODY_DNI: 7,

  /** art. 300(32) § 2 KSH - minimalny okres wypowiedzenia umowy przez notariusza. */
  WYPOWIEDZENIE_MIESIACE: 3,

  /**
   * art. 300(32) § 3 KSH (nowelizacja) - zawiadomienie sadu rejestrowego
   * o wygasnieciu lub rozwiazaniu umowy o prowadzenie rejestru.
   */
  ZAWIADOMIENIE_SADU_DNI: 7,
  ZAWIADOMIENIE_SADU_DO_WERYFIKACJI: true,

  /**
   * art. 300(33) § 3 KSH (nowelizacja) - zarzad zglasza zmiane danych
   * w terminie 7 dni od zdarzenia. Nasza rola: przypomnienie, nie egzekucja.
   */
  ZGLOSZENIE_ZMIANY_PRZEZ_ZARZAD_DNI: 7,
  ZGLOSZENIE_ZMIANY_DO_WERYFIKACJI: true,
};

/** Progi ostrzegania o zblizajacym sie terminie (sekcja 9 - pulpit). */
const PROGI_TERMINU = {
  /** <= tyle dni do konca terminu = wyroznienie kolorem --burgundy */
  PILNE_DNI: 2,
};

// ─────────────────────────────────────────────────────────────
// STAWKI (taksa notarialna, § 15b rozporzadzenia)
// ─────────────────────────────────────────────────────────────

/**
 * Decyzja nr 4 z sekcji 15 specyfikacji: stosujemy stawki MAKSYMALNE.
 * Kwoty w groszach (INTEGER) - regula domenowa nr 5, zadnych floatow.
 *
 * Obnizenie stawek jako argument sprzedazowy wobec domow maklerskich
 * = zmiana wylacznie tych trzech liczb.
 */
const STAWKI_GROSZE = {
  /** § 15b pkt 1 - prowadzenie rejestru: 1200 zl za kazdy rozpoczety rok. */
  PROWADZENIE_ROCZNIE: 120000,
  /** § 15b pkt 2 - wpis w rejestrze: 100 zl. */
  WPIS: 10000,
  /** § 15b pkt 3 - informacja z rejestru: 50 zl. */
  INFORMACJA: 5000,
};

/** Stawki maksymalne z rozporzadzenia - do porownania w UI konfiguracji. */
const STAWKI_MAKSYMALNE_GROSZE = {
  PROWADZENIE_ROCZNIE: 120000,
  WPIS: 10000,
  INFORMACJA: 5000,
};

/** Waluta domyslna rejestru. */
const WALUTA_DOMYSLNA = 'PLN';

// ─────────────────────────────────────────────────────────────
// ZAKRES PODMIOTOWY
// ─────────────────────────────────────────────────────────────

/**
 * Regula domenowa nr 11 + sekcja 16: notariusz NIE moze prowadzic rejestru
 * akcjonariuszy S.A. ani S.K.A. (art. 300(31) KSH dotyczy wylacznie P.S.A.).
 * Walidacja przy dodawaniu spolki.
 */
const FORMA_PRAWNA_WYMAGANA = 'PROSTA SPÓŁKA AKCYJNA';

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
 * art. 300(35) § 1(1) KSH (nowelizacja) - pozostali akcjonariusze nie maja
 * dostepu do numeru PESEL, daty urodzenia i adresu zamieszkania.
 * Regula domenowa nr 9. Wdrazamy od pierwszego dnia.
 */
const POLA_WRAZLIWE = [
  'pesel',
  'data_urodzenia',
  'kod_pocztowy',
  'miejscowosc',
  'ulica',
  'nr_domu',
  'nr_lokalu',
];

/** Pola kontaktowe - nie sa "danymi rejestru", nie pokazujemy ich obcym. */
const POLA_KONTAKTOWE = ['email', 'telefon', 'adres_doreczen', 'adres_edoreczen'];

/**
 * Role odbiorcy informacji z rejestru. Decyduja o zakresie maskowania.
 * art. 300(35) § 1 i § 1(1) KSH.
 */
const ROLE_ODBIORCY = {
  /** Kancelaria prowadzaca rejestr - pelny wglad z definicji. */
  KANCELARIA: 'kancelaria',
  /** Spolka, ktorej rejestr dotyczy - pelny wglad (art. 300(35) § 1). */
  SPOLKA: 'spolka',
  /** Osoba, ktorej dane dotycza - pelny wglad we wlasne dane. */
  WLASCICIEL_DANYCH: 'wlasciciel_danych',
  /** Inny akcjonariusz - dane zamaskowane (art. 300(35) § 1(1)). */
  AKCJONARIUSZ: 'akcjonariusz',
  /** Sad, prokuratura, komornik, administracyjny organ egzekucyjny - pelny wglad. */
  ORGAN: 'organ',
};

/** Role z pelnym dostepem do danych wrazliwych. */
const ROLE_PELNY_DOSTEP = [
  ROLE_ODBIORCY.KANCELARIA,
  ROLE_ODBIORCY.SPOLKA,
  ROLE_ODBIORCY.WLASCICIEL_DANYCH,
  ROLE_ODBIORCY.ORGAN,
];

/** Katalog organow z art. 300(35) § 1(1) - do wyboru na wydruku informacji. */
const ORGANY_UPRAWNIONE = [
  'sąd',
  'prokurator',
  'komornik sądowy',
  'administracyjny organ egzekucyjny',
];

// ─────────────────────────────────────────────────────────────
// FORMA ZGODY (art. 300(34) § 3 KSH - nowelizacja)
// ─────────────────────────────────────────────────────────────

/**
 * Zgoda osoby, ktorej uprawnienia maja byc wykreslone, zmienione lub
 * obciazone - zwalnia z obowiazku uprzedniego powiadomienia.
 * DO_WERYFIKACJI: brzmienie z opracowan branzowych (decyzja nr 2, sekcja 15).
 */
const FORMY_ZGODY = [
  {
    kod: 'pisemna_podpis_poswiadczony',
    nazwa: 'pisemna z podpisem notarialnie poświadczonym',
  },
  {
    kod: 'pisemna_przy_upowaznionym',
    nazwa: 'pisemna w obecności osoby upoważnionej przez podmiot prowadzący rejestr',
  },
  { kod: 'podpis_kwalifikowany', nazwa: 'elektroniczna — podpis kwalifikowany' },
  { kod: 'podpis_zaufany', nazwa: 'elektroniczna — podpis zaufany' },
  { kod: 'podpis_osobisty', nazwa: 'elektroniczna — podpis osobisty' },
];
const FORMY_ZGODY_DO_WERYFIKACJI = true;

// ─────────────────────────────────────────────────────────────
// AML
// ─────────────────────────────────────────────────────────────

/**
 * Notariusz prowadzacy rejestr jest instytucja obowiazana. Brak mozliwosci
 * zastosowania srodkow bezpieczenstwa finansowego = przeszkoda wpisu,
 * przy nieusunieciu - odmowa wpisu.
 *
 * Prawo o notariacie art. 108b: do czynnosci zwiazanych z prowadzeniem
 * rejestru NIE stosuje sie art. 81-83 i art. 85 (odmowa czynnosci notarialnej,
 * obowiazek stwierdzenia tozsamosci). Identyfikacja idzie WYLACZNIE rezimem
 * AML - nie mieszac sciezek.
 */
const AML_STATUSY = {
  BRAK: 'brak',
  WYKONANE: 'wykonane',
  NIEMOZLIWE: 'niemozliwe',
};

/** Status AML wymagany, by wpis dotyczacy osoby mogl dojsc do skutku. */
const AML_STATUS_WYMAGANY = AML_STATUSY.WYKONANE;

// ─────────────────────────────────────────────────────────────
// SLOWNIKI STANOW
// ─────────────────────────────────────────────────────────────

const STATUSY_SPOLKI = {
  AKTYWNA: 'aktywna',
  W_LIKWIDACJI: 'w_likwidacji',
  ZAWIESZONA: 'zawieszona',
  WYKRESLONA: 'wykreslona',
};

/** Statusy spolki blokujace jakikolwiek nowy wpis do rejestru. */
const STATUSY_SPOLKI_BLOKUJACE_WPIS = [STATUSY_SPOLKI.WYKRESLONA];

const STATUSY_EMISJI = {
  AKTYWNA: 'aktywna',
  W_UMARZANIU: 'w_umarzaniu',
  UMORZONA: 'umorzona',
  WYKRESLONA: 'wykreslona',
};

const STANY_SPRAWY = {
  NOWA: 'nowa',
  WERYFIKACJA: 'weryfikacja',
  WSTRZYMANA: 'wstrzymana',
  WPISANA: 'wpisana',
  ODMOWA: 'odmowa',
  ANULOWANA: 'anulowana',
};

const ZRODLA_SPRAWY = {
  PORTAL: 'portal',
  EMAIL: 'email',
  PAPIER: 'papier',
  Z_URZEDU: 'z_urzedu',
};

/** Kategorie, w ktorych moze znalezc sie kazda wyemitowana akcja. */
const KATEGORIE_AKCJI = {
  /** Wyemitowana, jeszcze nieobjeta przez zadnego akcjonariusza. */
  NIEOBJETA: 'nieobjeta',
  /** Przypisana akcjonariuszowi. */
  AKCJONARIUSZ: 'akcjonariusz',
  /** Umorzona - trwale poza obrotem, nadal w bilansie serii. */
  UMORZONA: 'umorzona',
};

// ─────────────────────────────────────────────────────────────
// PODSTAWY PRAWNE - teksty na wydruki i do uzasadnien
// ─────────────────────────────────────────────────────────────

const PODSTAWY = {
  PROWADZENIE_REJESTRU: 'art. 300(31) § 1 KSH',
  ZGODNOSC_LICZBY_AKCJI: 'art. 300(31) § 3 KSH',
  UMOWA_O_PROWADZENIE: 'art. 300(32) KSH',
  KATALOG_DANYCH: 'art. 300(33) § 1 KSH',
  TRYB_WPISU: 'art. 300(34) § 1 KSH',
  ZAJECIE_Z_URZEDU: 'art. 300(34) § 2 KSH',
  UPRZEDNIE_POWIADOMIENIE: 'art. 300(34) § 3 KSH',
  DOKUMENTY_PODSTAWA: 'art. 300(34) § 4 KSH',
  BADANIE_TRESCI_I_FORMY: 'art. 300(34) § 5 KSH',
  OGRANICZENIA_ROZPORZADZANIA: 'art. 300(34) § 6 KSH',
  ZAWIADOMIENIE_O_WPISIE: 'art. 300(34) § 7 KSH',
  JAWNOSC_REJESTRU: 'art. 300(35) § 1 KSH',
  MASKOWANIE: 'art. 300(35) § 1(1) KSH',
  NOTARIAT_REJESTR: 'art. 108a ustawy — Prawo o notariacie',
  NOTARIAT_WYLACZENIA: 'art. 108b ustawy — Prawo o notariacie',
  TAKSA: '§ 15b rozporządzenia w sprawie maksymalnych stawek taksy notarialnej',
  WYKAZ_PRZY_WYKRESLENIU: 'art. 476 § 1(1) KSH',
  ZAPYTANIE_SADU: 'art. 25da ustawy o Krajowym Rejestrze Sądowym',
};

/**
 * Data wejscia w zycie nowelizacji Dz.U. 2026 poz. 176 oraz koniec okresu
 * przejsciowego na zgloszenie podmiotu prowadzacego rejestr do KRS.
 */
const NOWELIZACJA = {
  DZIENNIK: 'Dz.U. 2026 poz. 176',
  WEJSCIE_W_ZYCIE: '2027-02-18',
  KONIEC_OKRESU_PRZEJSCIOWEGO: '2027-05-18',
  DO_WERYFIKACJI: true,
};

/** Czy na dany dzien obowiazuje juz nowelizacja. */
function nowelizacjaObowiazuje(dataIso) {
  const dzien = String(dataIso || '').slice(0, 10);
  return dzien >= NOWELIZACJA.WEJSCIE_W_ZYCIE;
}

/** Zwraca stawke w groszach dla typu oplaty. */
function stawkaGrosze(typ) {
  switch (typ) {
    case 'prowadzenie':
      return STAWKI_GROSZE.PROWADZENIE_ROCZNIE;
    case 'wpis':
      return STAWKI_GROSZE.WPIS;
    case 'informacja':
      return STAWKI_GROSZE.INFORMACJA;
    default:
      throw new Error(`Nieznany typ opłaty: ${typ}`);
  }
}

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
  TERMINY,
  PROGI_TERMINU,
  STAWKI_GROSZE,
  STAWKI_MAKSYMALNE_GROSZE,
  WALUTA_DOMYSLNA,
  FORMA_PRAWNA_WYMAGANA,
  FORMA_PRAWNA_WARIANTY,
  FORMY_PRAWNE_ZABRONIONE,
  POLA_WRAZLIWE,
  POLA_KONTAKTOWE,
  ROLE_ODBIORCY,
  ROLE_PELNY_DOSTEP,
  ORGANY_UPRAWNIONE,
  FORMY_ZGODY,
  FORMY_ZGODY_DO_WERYFIKACJI,
  AML_STATUSY,
  AML_STATUS_WYMAGANY,
  STATUSY_SPOLKI,
  STATUSY_SPOLKI_BLOKUJACE_WPIS,
  STATUSY_EMISJI,
  STANY_SPRAWY,
  ZRODLA_SPRAWY,
  KATEGORIE_AKCJI,
  PODSTAWY,
  NOWELIZACJA,
  nowelizacjaObowiazuje,
  stawkaGrosze,
  ocenFormePrawna,
};
