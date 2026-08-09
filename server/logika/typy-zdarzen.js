'use strict';

/**
 * Katalog typow zdarzen rejestrowych (sekcja 6 specyfikacji).
 *
 * To DANE, nie kod rozproszony po routerach. Kazdy typ definiuje:
 * jak sie nazywa w jezyku zdarzenia, czy jest odplatny, czy wymaga
 * uprzedniego powiadomienia z art. 300(34) § 3 KSH, jaka checkliste
 * weryfikacji trzeba odhaczyc i jakie dokumenty generuje.
 *
 * `sprint` mowi, od ktorego sprintu typ jest dostepny w kreatorze.
 * Typy z `sprint: 2` sa juz opisane (i odtwarzane przez `stan.js`),
 * ale kreator ich nie oferuje - patrz README, sekcja "Zakres sprintu 1".
 */

const { PODSTAWY } = require('./przepisy');

/** Pozycja checklisty. `wymagana: false` = do odhaczenia tylko gdy dotyczy. */
function poz(kod, tresc, opcje = {}) {
  return {
    kod,
    tresc,
    podstawa: opcje.podstawa || null,
    wymagana: opcje.wymagana !== false,
    /**
     * Przelacznik "uzasadnione watpliwosci" (art. 300(34) § 5 KSH) - odhaczenie
     * WYMUSZA notatke i przelacza sprawe na sciezke poglebiona (sprint 2).
     */
    watpliwosci: opcje.watpliwosci === true,
  };
}

/** Checklista wspolna dla kazdego wpisu na zadanie. */
const BADANIE_DOKUMENTU = [
  poz('dokument_podstawa', 'Do żądania dołączono dokument stanowiący podstawę wpisu', {
    podstawa: PODSTAWY.DOKUMENTY_PODSTAWA,
  }),
  poz('badanie_tresci_formy', 'Zbadano treść i formę dokumentu', {
    podstawa: PODSTAWY.BADANIE_TRESCI_I_FORMY,
  }),
  poz(
    'uzasadnione_watpliwosci',
    'Zachodzą uzasadnione wątpliwości co do zgodności z prawem lub prawdziwości dokumentu',
    { podstawa: PODSTAWY.BADANIE_TRESCI_I_FORMY, wymagana: false, watpliwosci: true }
  ),
];

const TYPY = [
  {
    kod: 'emisja',
    nazwa: 'Emisja akcji',
    // Krok 1 kreatora opisujemy jezykiem zdarzenia, nie nazwami tabel.
    opis_zdarzeniem: 'Spółka wyemitowała nową serię akcji',
    podpowiedz: 'Emisja założycielska albo kolejna — na podstawie umowy spółki lub uchwały.',
    symbol: 'E',
    grupa: 'akcje',
    sprint: 1,
    odplatne: true,
    wymaga_powiadomienia: false,
    podstawa_prawna: PODSTAWY.KATALOG_DANYCH,
    tworzy: ['emisja', 'pula akcji nieobjętych'],
    checklista: [
      poz('uchwala', 'Przedłożono uchwałę walnego zgromadzenia albo akt założycielski spółki'),
      poz('seria_unikalna', 'Oznaczenie serii nie koliduje z serią już zarejestrowaną'),
      poz(
        'zgodnosc_z_uprawnieniami',
        'Emisja jest zgodna z zarejestrowanymi uprawnieniami i przywilejami akcjonariuszy',
        { wymagana: false }
      ),
      poz(
        'liczba_akcji',
        'Liczba akcji objętych wpisem odpowiada liczbie akcji wyemitowanych',
        { podstawa: PODSTAWY.ZGODNOSC_LICZBY_AKCJI }
      ),
    ],
    dokumenty: ['zawiadomienie_wpis'],
  },

  {
    kod: 'objecie',
    nazwa: 'Objęcie akcji',
    opis_zdarzeniem: 'Ktoś objął akcje z wyemitowanej serii',
    podpowiedz: 'Pierwsze przypisanie akcji do akcjonariusza — z emisji, która czeka na objęcie.',
    symbol: 'O',
    grupa: 'akcje',
    sprint: 1,
    odplatne: true,
    wymaga_powiadomienia: false,
    podstawa_prawna: PODSTAWY.KATALOG_DANYCH,
    tworzy: ['wpis akcjonariusza'],
    checklista: [
      ...BADANIE_DOKUMENTU,
      poz('umowa_objecia', 'Przedłożono umowę objęcia akcji albo oświadczenie o objęciu'),
      poz('aml', 'Wobec obejmującego zastosowano środki bezpieczeństwa finansowego (AML)'),
      poz('wklad', 'Ujawniono wniesienie wkładu albo termin jego wniesienia', { wymagana: false }),
    ],
    dokumenty: ['zawiadomienie_wpis'],
  },

  {
    kod: 'przeniesienie',
    nazwa: 'Przeniesienie akcji',
    opis_zdarzeniem: 'Ktoś sprzedał, darował lub w inny sposób przekazał akcje',
    podpowiedz: 'Sprzedaż, darowizna, dziedziczenie, wniesienie aportem — każde przejście akcji.',
    symbol: '⇄',
    grupa: 'akcje',
    sprint: 1,
    odplatne: true,
    wymaga_powiadomienia: true,
    kogo_powiadomic: 'zbywcę',
    podstawa_prawna: PODSTAWY.UPRZEDNIE_POWIADOMIENIE,
    tworzy: ['wykreślenie zbywcy', 'wpis nabywcy'],
    checklista: [
      poz(
        'dokument_podstawa',
        'Przedłożono dokument stanowiący podstawę przejścia akcji ' +
          '(umowa zbycia, postanowienie o stwierdzeniu nabycia spadku, inny)',
        { podstawa: PODSTAWY.DOKUMENTY_PODSTAWA }
      ),
      poz('badanie_tresci_formy', 'Zbadano treść i formę dokumentu', {
        podstawa: PODSTAWY.BADANIE_TRESCI_I_FORMY,
      }),
      poz(
        'uzasadnione_watpliwosci',
        'Zachodzą uzasadnione wątpliwości co do zgodności z prawem lub prawdziwości dokumentu',
        { podstawa: PODSTAWY.BADANIE_TRESCI_I_FORMY, wymagana: false, watpliwosci: true }
      ),
      poz('aml', 'Wobec nabywcy zastosowano środki bezpieczeństwa finansowego (AML)'),
      poz(
        'ograniczenia',
        'Brak ograniczeń w rozporządzaniu akcją albo uzyskano zgodę spółki / wyczerpano prawo pierwszeństwa',
        { podstawa: PODSTAWY.OGRANICZENIA_ROZPORZADZANIA }
      ),
      poz(
        'zgoda_albo_powiadomienie',
        'Zbywca wyraził zgodę albo wysłano mu powiadomienie o treści zamierzonego wpisu',
        { podstawa: PODSTAWY.UPRZEDNIE_POWIADOMIENIE }
      ),
    ],
    dokumenty: ['zawiadomienie_wpis'],
  },

  {
    kod: 'umorzenie',
    nazwa: 'Umorzenie akcji',
    opis_zdarzeniem: 'Akcje zostały umorzone',
    podpowiedz: 'Umorzenie dobrowolne lub przymusowe — akcje trwale wychodzą z obrotu.',
    symbol: '⊘',
    grupa: 'akcje',
    sprint: 1,
    odplatne: true,
    wymaga_powiadomienia: true,
    kogo_powiadomic: 'akcjonariusza, którego akcje są umarzane',
    podstawa_prawna: PODSTAWY.UPRZEDNIE_POWIADOMIENIE,
    tworzy: ['wykreślenie akcjonariusza', 'wpis akcji umorzonych'],
    checklista: [
      poz('uchwala_umorzenie', 'Przedłożono uchwałę o umorzeniu akcji'),
      poz('badanie_tresci_formy', 'Zbadano treść i formę dokumentu', {
        podstawa: PODSTAWY.BADANIE_TRESCI_I_FORMY,
      }),
      poz(
        'uzasadnione_watpliwosci',
        'Zachodzą uzasadnione wątpliwości co do zgodności z prawem lub prawdziwości dokumentu',
        { podstawa: PODSTAWY.BADANIE_TRESCI_I_FORMY, wymagana: false, watpliwosci: true }
      ),
      poz('zgoda_akcjonariusza', 'Przy umorzeniu dobrowolnym — zgoda akcjonariusza', {
        wymagana: false,
      }),
      poz(
        'zgoda_albo_powiadomienie',
        'Akcjonariusz wyraził zgodę albo wysłano mu powiadomienie o treści zamierzonego wpisu',
        { podstawa: PODSTAWY.UPRZEDNIE_POWIADOMIENIE }
      ),
      poz('brak_obciazen', 'Umarzane akcje nie są obciążone ani zajęte'),
    ],
    dokumenty: ['zawiadomienie_wpis'],
  },

  // ── Typy przewidziane, kreator od sprintu 2 ────────────────────────────

  {
    kod: 'zobowiazanie',
    nazwa: 'Zobowiązanie do przeniesienia lub obciążenia akcji',
    opis_zdarzeniem: 'Akcjonariusz zobowiązał się przenieść lub obciążyć akcje',
    symbol: '≡',
    grupa: 'akcje',
    sprint: 2,
    odplatne: true,
    wymaga_powiadomienia: true,
    podstawa_prawna: PODSTAWY.DOKUMENTY_PODSTAWA,
    checklista: [...BADANIE_DOKUMENTU],
    dokumenty: ['zawiadomienie_wpis'],
  },
  {
    kod: 'obciazenie',
    nazwa: 'Ustanowienie zastawu lub użytkowania',
    opis_zdarzeniem: 'Na akcjach ustanowiono zastaw albo użytkowanie',
    symbol: '§',
    grupa: 'obciazenia',
    sprint: 2,
    odplatne: true,
    wymaga_powiadomienia: true,
    kogo_powiadomic: 'akcjonariusza',
    podstawa_prawna: PODSTAWY.UPRZEDNIE_POWIADOMIENIE,
    checklista: [...BADANIE_DOKUMENTU],
    dokumenty: ['zawiadomienie_wpis'],
  },
  {
    kod: 'wykreslenie_obciazenia',
    nazwa: 'Wykreślenie obciążenia',
    opis_zdarzeniem: 'Zastaw albo użytkowanie wygasło',
    symbol: '§̸',
    grupa: 'obciazenia',
    sprint: 2,
    odplatne: true,
    wymaga_powiadomienia: false,
    podstawa_prawna: PODSTAWY.KATALOG_DANYCH,
    checklista: [...BADANIE_DOKUMENTU],
    dokumenty: ['zawiadomienie_wpis'],
  },
  {
    kod: 'prawo_glosu_zastawnika',
    nazwa: 'Prawo głosu zastawnika lub użytkownika',
    opis_zdarzeniem: 'Zastawnik albo użytkownik uzyskał prawo głosu z akcji',
    symbol: '✓',
    grupa: 'obciazenia',
    sprint: 2,
    odplatne: true,
    wymaga_powiadomienia: true,
    podstawa_prawna: PODSTAWY.KATALOG_DANYCH,
    checklista: [...BADANIE_DOKUMENTU],
    dokumenty: ['zawiadomienie_wpis'],
  },
  {
    kod: 'zajecie',
    nazwa: 'Zajęcie akcji przez organ egzekucyjny',
    opis_zdarzeniem: 'Komornik albo organ egzekucyjny zajął akcje',
    podpowiedz: 'Wpis z urzędu — bez żądania, bez uprzedniego powiadomienia, wolny od opłat.',
    symbol: '⚖',
    grupa: 'obciazenia',
    sprint: 2,
    // art. 300(34) § 2 KSH - z urzedu i wolne od oplat.
    odplatne: false,
    wymaga_powiadomienia: false,
    z_urzedu: true,
    podstawa_prawna: PODSTAWY.ZAJECIE_Z_URZEDU,
    checklista: [
      poz('zawiadomienie_organu', 'Wpłynęło zawiadomienie organu egzekucyjnego o zajęciu'),
      poz('identyfikacja_akcji', 'Zidentyfikowano akcje dłużnika (zakres numerów)'),
    ],
    dokumenty: [],
  },
  {
    kod: 'wykreslenie_zajecia',
    nazwa: 'Uchylenie zajęcia',
    opis_zdarzeniem: 'Zajęcie akcji zostało uchylone',
    symbol: '⚖̸',
    grupa: 'obciazenia',
    sprint: 2,
    odplatne: false,
    wymaga_powiadomienia: false,
    z_urzedu: true,
    podstawa_prawna: PODSTAWY.ZAJECIE_Z_URZEDU,
    checklista: [poz('dokument_uchylenia', 'Wpłynął dokument uchylający zajęcie')],
    dokumenty: [],
  },
  {
    kod: 'zmiana_danych_akcjonariusza',
    nazwa: 'Zmiana danych akcjonariusza',
    opis_zdarzeniem: 'Zmieniły się dane akcjonariusza',
    podpowiedz: 'Adres, e-mail, nazwisko, zgoda na komunikację elektroniczną.',
    symbol: 'a',
    grupa: 'dane',
    sprint: 2,
    odplatne: true,
    wymaga_powiadomienia: false,
    podstawa_prawna: PODSTAWY.KATALOG_DANYCH,
    checklista: [poz('podstawa_zmiany', 'Zmiana ma udokumentowaną podstawę')],
    dokumenty: ['zawiadomienie_wpis'],
  },
  {
    kod: 'zmiana_danych_spolki',
    nazwa: 'Zmiana danych spółki',
    opis_zdarzeniem: 'Zmieniły się dane spółki',
    podpowiedz: 'Firma, siedziba, adres, dane z KRS.',
    symbol: 's',
    grupa: 'dane',
    // Zapisywane juz w sprincie 1 - przez PUT /api/psa/spolki/:id.
    sprint: 1,
    kreator: false,
    odplatne: true,
    wymaga_powiadomienia: false,
    podstawa_prawna: PODSTAWY.KATALOG_DANYCH,
    checklista: [poz('podstawa_zmiany', 'Zmiana ma udokumentowaną podstawę')],
    dokumenty: [],
  },
  {
    kod: 'uprawnienie',
    nazwa: 'Uprawnienie, przywilej albo obowiązek',
    opis_zdarzeniem: 'Ustanowiono, zmieniono albo wykreślono uprawnienie akcjonariusza',
    symbol: '★',
    grupa: 'prawa',
    sprint: 2,
    odplatne: true,
    wymaga_powiadomienia: false,
    podstawa_prawna: PODSTAWY.KATALOG_DANYCH,
    checklista: [...BADANIE_DOKUMENTU],
    dokumenty: ['zawiadomienie_wpis'],
  },
  {
    kod: 'ograniczenie',
    nazwa: 'Ograniczenie w rozporządzaniu akcją',
    opis_zdarzeniem: 'Ustanowiono albo zniesiono ograniczenie w rozporządzaniu akcjami',
    symbol: '⊣',
    grupa: 'prawa',
    sprint: 2,
    odplatne: true,
    wymaga_powiadomienia: false,
    podstawa_prawna: PODSTAWY.OGRANICZENIA_ROZPORZADZANIA,
    checklista: [...BADANIE_DOKUMENTU],
    dokumenty: ['zawiadomienie_wpis'],
  },
  {
    kod: 'zdarzenie_inne',
    nazwa: 'Inne zdarzenie',
    opis_zdarzeniem: 'Wydarzyło się coś, co należy odnotować w rejestrze',
    podpowiedz: 'Walne zgromadzenie, zmiana umowy spółki, zdarzenie bez skutku dla akcjonariatu.',
    symbol: '·',
    grupa: 'inne',
    sprint: 2,
    odplatne: true,
    wymaga_powiadomienia: false,
    podstawa_prawna: PODSTAWY.KATALOG_DANYCH,
    checklista: [poz('opis_zdarzenia', 'Zdarzenie zostało opisane w sposób umożliwiający jego identyfikację')],
    dokumenty: [],
  },
  {
    kod: 'sprostowanie',
    nazwa: 'Sprostowanie wcześniejszego zdarzenia',
    opis_zdarzeniem: 'Wcześniejszy wpis wymaga korekty',
    podpowiedz:
      'Rejestr jest niezmienialny — pomyłkę prostuje się nowym zdarzeniem wskazującym zdarzenie prostowane.',
    symbol: '↺',
    grupa: 'inne',
    sprint: 2,
    odplatne: false,
    // "zaleznie od tresci" - decyzja zapada w kreatorze sprostowania.
    wymaga_powiadomienia: 'zaleznie',
    podstawa_prawna: PODSTAWY.TRYB_WPISU,
    checklista: [
      poz('uzasadnienie', 'Sprostowanie zawiera uzasadnienie i wskazuje zdarzenie prostowane'),
    ],
    dokumenty: ['zawiadomienie_wpis'],
  },

  {
    kod: 'uniewaznienie',
    nazwa: 'Unieważnienie akcji orzeczeniem sądu',
    opis_zdarzeniem: 'Sąd unieważnił akcje',
    podpowiedz:
      'Skutek niewniesienia wkładu — orzeczenie sądu, nie uchwała spółki. To co innego niż umorzenie.',
    symbol: '✕',
    grupa: 'akcje',
    sprint: 6,
    odplatne: true,
    // Podstawa jest orzeczenie sadu, ktore juz wywolalo skutek - wpis go
    // ujawnia. Uprzedzanie akcjonariusza o "zamierzonym wpisie" byloby
    // bezprzedmiotowe: nie ma tu nic do uzgodnienia ani do zgody.
    wymaga_powiadomienia: false,
    podstawa_prawna: PODSTAWY.UNIEWAZNIENIE_AKCJI,
    tworzy: ['wykreślenie akcjonariusza', 'wpis akcji unieważnionych'],
    checklista: [
      poz('orzeczenie', 'Przedłożono orzeczenie sądu unieważniające akcje', {
        podstawa: PODSTAWY.UNIEWAZNIENIE_AKCJI,
      }),
      poz('prawomocnosc', 'Orzeczenie jest prawomocne'),
      poz('badanie_tresci_formy', 'Zbadano treść i formę dokumentu', {
        podstawa: PODSTAWY.BADANIE_TRESCI_I_FORMY,
      }),
      poz(
        'uzasadnione_watpliwosci',
        'Zachodzą uzasadnione wątpliwości co do zgodności z prawem lub prawdziwości dokumentu',
        { podstawa: PODSTAWY.BADANIE_TRESCI_I_FORMY, wymagana: false, watpliwosci: true }
      ),
      poz('identyfikacja_akcji', 'Orzeczenie identyfikuje akcje objęte unieważnieniem'),
    ],
    dokumenty: ['zawiadomienie_wpis'],
  },

  // ── Typy sprintu 5 (zgodnosc z ustawa - ulamkowe czesci akcji) ─────────

  {
    kod: 'przeniesienie_ulamka',
    nazwa: 'Przeniesienie ułamkowej części akcji',
    opis_zdarzeniem: 'Ktoś zbył ułamkową część oznaczonej akcji',
    podpowiedz: 'Współwłasność akcji — zbycie części ułamkowej pojedynczej, oznaczonej akcji.',
    symbol: '½',
    grupa: 'akcje',
    sprint: 5,
    odplatne: true,
    wymaga_powiadomienia: true,
    kogo_powiadomic: 'zbywcę',
    podstawa_prawna: PODSTAWY.ULAMKOWE_CZESCI_AKCJI,
    tworzy: ['wpis wspoluprawnienia do ułamka akcji'],
    checklista: [
      poz(
        'dokument_podstawa',
        'Przedłożono dokument stanowiący podstawę przejścia ułamkowej części akcji',
        { podstawa: PODSTAWY.DOKUMENTY_PODSTAWA }
      ),
      poz('badanie_tresci_formy', 'Zbadano treść i formę dokumentu', {
        podstawa: PODSTAWY.BADANIE_TRESCI_I_FORMY,
      }),
      poz(
        'uzasadnione_watpliwosci',
        'Zachodzą uzasadnione wątpliwości co do zgodności z prawem lub prawdziwości dokumentu',
        { podstawa: PODSTAWY.BADANIE_TRESCI_I_FORMY, wymagana: false, watpliwosci: true }
      ),
      poz('aml', 'Wobec nabywcy zastosowano środki bezpieczeństwa finansowego (AML)'),
      poz(
        'pokrycie',
        'Akcja jest w całości pokryta albo uzyskano zgodę spółki na zbycie akcji nie w pełni pokrytej',
        { podstawa: PODSTAWY.NIEPELNE_POKRYCIE, wymagana: false }
      ),
      poz(
        'zgoda_albo_powiadomienie',
        'Zbywca wyraził zgodę albo wysłano mu powiadomienie o treści zamierzonego wpisu',
        { podstawa: PODSTAWY.UPRZEDNIE_POWIADOMIENIE }
      ),
    ],
    dokumenty: ['zawiadomienie_wpis'],
  },
  {
    kod: 'przedstawiciel',
    nazwa: 'Wspólny przedstawiciel współuprawnionych',
    opis_zdarzeniem: 'Współuprawnieni do akcji wskazali wspólnego przedstawiciela',
    podpowiedz: 'Współuprawnieni z akcji wykonują swoje prawa w spółce przez wspólnego przedstawiciela.',
    symbol: '⚑',
    grupa: 'akcje',
    sprint: 5,
    odplatne: true,
    wymaga_powiadomienia: false,
    podstawa_prawna: PODSTAWY.WSPOLNY_PRZEDSTAWICIEL,
    tworzy: ['wzmianka o wspólnym przedstawicielu'],
    checklista: [
      poz(
        'dokument_podstawa',
        'Przedłożono oświadczenie współuprawnionych wskazujące wspólnego przedstawiciela'
      ),
    ],
    dokumenty: ['zawiadomienie_wpis'],
  },
  {
    kod: 'pokrycie_akcji',
    nazwa: 'Wzmianka o pokryciu akcji',
    opis_zdarzeniem: 'Zarząd stwierdził wniesienie wkładu na pokrycie akcji',
    podpowiedz: 'Podstawą jest uchwała zarządu stwierdzająca wniesienie wkładu w całości albo w części.',
    symbol: '✔',
    grupa: 'akcje',
    sprint: 5,
    odplatne: true,
    wymaga_powiadomienia: false,
    podstawa_prawna: PODSTAWY.WZMIANKA_O_POKRYCIU,
    tworzy: ['wzmianka o pokryciu'],
    checklista: [
      poz('uchwala_zarzadu', 'Przedłożono uchwałę zarządu stwierdzającą wniesienie wkładu', {
        podstawa: PODSTAWY.POKRYCIE_WKLADOW,
      }),
    ],
    dokumenty: ['zawiadomienie_wpis'],
  },
];

const WG_KODU = new Map(TYPY.map((t) => [t.kod, t]));

function typ(kod) {
  const t = WG_KODU.get(kod);
  if (!t) throw new Error(`Nieznany typ zdarzenia: ${kod}`);
  return t;
}

function istnieje(kod) {
  return WG_KODU.has(kod);
}

/**
 * Do ktorego sprintu wlacznie kreator oferuje typy zdarzen.
 *
 * JEDNO miejsce - wczesniej numer byl zapisany osobno w trzech trasach, przez
 * co typ dodany w nowym sprincie znikal z kreatora mimo poprawnej definicji.
 */
const SPRINT_KREATORA = 6;

/** Typy dostepne w kreatorze do wskazanego sprintu wlacznie. */
function dostepneWKreatorze(sprint = SPRINT_KREATORA) {
  return TYPY.filter((t) => t.sprint <= sprint && t.kreator !== false);
}

/** Czy typ wymaga uprzedniego powiadomienia z art. 300(34) § 3 KSH. */
function wymagaPowiadomienia(kod) {
  return typ(kod).wymaga_powiadomienia === true;
}

/** Czy wpis jest odplatny (art. 300(34) § 2 KSH - zajecie wolne od oplat). */
function odplatne(kod) {
  return typ(kod).odplatne === true;
}

/** Kody pozycji checklisty, ktore musza byc odhaczone przed wpisem. */
function pozycjeWymagane(kod) {
  return typ(kod)
    .checklista.filter((p) => p.wymagana && !p.watpliwosci)
    .map((p) => p.kod);
}

module.exports = {
  TYPY,
  SPRINT_KREATORA,
  typ,
  istnieje,
  dostepneWKreatorze,
  wymagaPowiadomienia,
  odplatne,
  pozycjeWymagane,
};
