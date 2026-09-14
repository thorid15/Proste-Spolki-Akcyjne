'use strict';

/**
 * Komplet dokumentów, który kancelaria wystawia klientowi do podpisu przy
 * wniosku o prowadzenie rejestru akcjonariuszy.
 *
 * Każdy dokument powstaje tutaj jako LISTA BLOKÓW (`logika/bloki-dokumentu.js`),
 * nie jako gotowy PDF. Bloki zapisują się razem z plikiem, więc notariusz może
 * treść przeczytać, poprawić w portalu pracownika i złożyć dokument na nowo —
 * czego nie da się zrobić z samym PDF-em.
 *
 * Dwa dokumenty — umowa o prowadzenie rejestru (wzór 01) i uchwała o wyborze
 * podmiotu prowadzącego rejestr (wzór 03) — mają treść redagowaną przez
 * notariusza w Wordzie. Ich wzory `.docx` wypełnia się danymi wniosku
 * i zamienia na bloki (`bloki.zDocx`). Dawniej szły przez konwersję
 * LibreOffice; gdy jej zabrakło, umowa CICHO WYPADAŁA z kompletu i klient
 * dostawał do podpisu wszystko poza dokumentem najważniejszym. Teraz komplet
 * powstaje bez żadnego programu zewnętrznego.
 *
 * Pozostałe pozycje to OŚWIADCZENIA o ustalonej treści, budowane blokami
 * wprost w tym pliku.
 *
 * Wszystkie dane osobowe trafiają na papier w MIANOWNIKU, opisane etykietą
 * („PESEL: …”), nigdy odmienione przez przypadki.
 */

const przepisy = require('./przepisy');
const konfiguracja = require('../konfiguracja');
const ustawienia = require('./ustawienia');
const { db } = require('../baza');
const wzoryDysk = require('./wzory-dysk');
const kontekstPisma = require('./kontekst-pisma');
const bloki = require('./bloki-dokumentu');

const b = bloki.blok;

const PODSTAWA_AML = 'ustawa z dnia 1 marca 2018 r. o przeciwdziałaniu praniu pieniędzy '
  + 'oraz finansowaniu terroryzmu';

/** Katalog dokumentów pakietu — `kod` jest identyfikatorem typu w bazie. */
const TYPY = {
  UMOWA_REJESTRU: 'umowa_rejestru',
  UCHWALA_WYBORU: 'uchwala_wyboru_projekt',
  ZGODA_EMAIL: 'zgoda_email',
  OSWIADCZENIE_RODO: 'oswiadczenie_rodo',
  OSWIADCZENIE_AML: 'oswiadczenie_aml',
  ZADANIE_PIERWSZEGO_WPISU: 'zadanie_pierwszego_wpisu',
};

const NAZWY = {
  [TYPY.UMOWA_REJESTRU]: 'Umowa o prowadzenie rejestru',
  [TYPY.UCHWALA_WYBORU]: 'Uchwała o wyborze podmiotu prowadzącego rejestr',
  [TYPY.ZGODA_EMAIL]: 'Zgoda na komunikację elektroniczną',
  [TYPY.OSWIADCZENIE_RODO]: 'Oświadczenie o zapoznaniu się z informacją o przetwarzaniu danych',
  [TYPY.OSWIADCZENIE_AML]: 'Oświadczenie o beneficjencie rzeczywistym i statusie PEP',
  [TYPY.ZADANIE_PIERWSZEGO_WPISU]: 'Żądanie dokonania pierwszego wpisu wraz ze zgodą',
};

/**
 * Kolejność na liście do podpisu. Wprost, a nie „jak wyszło z pętli":
 * najpierw dwa dokumenty założycielskie podpisywane raz w imieniu spółki
 * i przez ogół akcjonariuszy, potem oświadczenia indywidualne, na końcu
 * wspólne żądanie wpisu. Ta sama kolejność ma obowiązywać także wtedy,
 * gdy komplet powstaje po raz drugi (wniosek wrócił do uzupełnienia).
 */
const KOLEJNOSC = {
  [TYPY.UMOWA_REJESTRU]: 10,
  [TYPY.UCHWALA_WYBORU]: 20,
  [TYPY.ZGODA_EMAIL]: 30,
  [TYPY.OSWIADCZENIE_RODO]: 31,
  [TYPY.OSWIADCZENIE_AML]: 32,
  [TYPY.ZADANIE_PIERWSZEGO_WPISU]: 40,
};

// ─────────────────────────────────────────────────────────────
// Pomocnicze
// ─────────────────────────────────────────────────────────────

function pusty(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function oznaczenie(a) {
  if (!a) return '—';
  if (a.typ === 'prawna') return a.nazwa || '—';
  return [a.imie, a.nazwisko].filter(Boolean).join(' ') || '—';
}

/** Identyfikator ustawowy: PESEL albo data urodzenia; dla podmiotu numer w rejestrze. */
function identyfikator(a) {
  if (a.typ === 'prawna') {
    if (a.numer_w_rejestrze) return `${a.nazwa_rejestru || 'rejestr'} ${a.numer_w_rejestrze}`;
    return null;
  }
  if (a.pesel) return `PESEL ${a.pesel}`;
  if (a.data_urodzenia) return `data urodzenia ${dataPl(a.data_urodzenia)}`;
  return null;
}

function adresPelny(a) {
  const linia = [
    [a.kod_pocztowy, a.miejscowosc].filter(Boolean).join(' '),
    [a.ulica, a.nr_domu && `nr ${a.nr_domu}`, a.nr_lokalu && `m. ${a.nr_lokalu}`]
      .filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');
  return linia || null;
}

/**
 * Rodzaj adresu, ktory wchodzi do rejestru (art. 300(33) § 1 pkt 3 KSH).
 *
 * Kolumna bywa PUSTA: formularz klienta jej nie ma, bo wyboru dokonuje
 * kancelaria przy weryfikacji. Dokument do podpisu nie moze jednak nosic
 * rubryki „Adres (niewskazany)" — podpisujacy zobaczylby wtedy zarzut
 * zamiast swoich danych. Dopoki wyboru nie ma, bierzemy pierwszy adres,
 * ktory akcjonariusz faktycznie podal, i opisujemy go zgodnie z prawda.
 */
function rodzajAdresu(a) {
  const R = przepisy.RODZAJE_ADRESU_REJESTROWEGO;
  if (!pusty(a.rodzaj_adresu_rejestrowego)) return a.rodzaj_adresu_rejestrowego;
  if (adresPelny(a)) return R.ZAMIESZKANIA;
  if (!pusty(a.adres_doreczen)) return R.DORECZEN;
  if (!pusty(a.adres_edoreczen)) return R.EDORECZEN;
  return R.ZAMIESZKANIA;
}

/** Adres wskazany jako ten z art. 300(33) § 1 pkt 3 KSH. */
function adresRejestrowy(a) {
  const rodzaj = rodzajAdresu(a);
  if (rodzaj === przepisy.RODZAJE_ADRESU_REJESTROWEGO.DORECZEN) return a.adres_doreczen;
  if (rodzaj === przepisy.RODZAJE_ADRESU_REJESTROWEGO.EDORECZEN) return a.adres_edoreczen;
  return adresPelny(a);
}

function dataPl(iso) {
  if (pusty(iso)) return null;
  const [r, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}.${m}.${r}`;
}

function firmaSpolki(w) {
  return [w.nazwa, w.krs ? `KRS ${w.krs}` : null].filter(Boolean).join(', ');
}

/**
 * Wspólna główka oświadczeń: kto prowadzi rejestr i dla jakiej spółki.
 *
 * Dwa wiersze i nic więcej. Wcześniej stał tu jeszcze adres kancelarii oraz
 * opis „Kancelaria Notarialna, notariusz: …”, przez co najważniejsza
 * informacja — czyj to rejestr i czyja spółka — tonęła w metryczce.
 * Nazwa spółki pochodzi Z WNIOSKU, nie z konfiguracji: to dane klienta,
 * a nie kancelarii.
 */
function glowka(wniosek, dzis) {
  const k = ustawienia.kancelaria(db());
  return [
    b.naglowek(k.kancelaria_miasto || k.miejscowosc, dataPl(dzis)),
    b.pola([
      ['Podmiot prowadzący rejestr', k.nazwa],
      ['Spółka', firmaSpolki(wniosek)],
    ]),
  ];
}

/** Dane akcjonariusza w postaci, w jakiej wchodzą do rejestru. */
function polaAkcjonariusza(a) {
  const pary = [];
  if (a.typ === 'prawna') {
    pary.push(['Firma (nazwa)', a.nazwa]);
    pary.push(['Numer w rejestrze', a.numer_w_rejestrze]);
    pary.push(['Nazwa rejestru', a.nazwa_rejestru]);
  } else {
    pary.push(['Nazwisko', a.nazwisko]);
    pary.push(['Imię', a.imie]);
    if (Number(a.bez_pesel) === 1) {
      pary.push(['PESEL', 'nie posiada']);
      pary.push(['Data urodzenia', dataPl(a.data_urodzenia)]);
    } else {
      pary.push(['PESEL', a.pesel]);
    }
  }
  pary.push([
    `Adres (${przepisy.OPISY_RODZAJOW_ADRESU_REJESTROWEGO[rodzajAdresu(a)]})`,
    adresRejestrowy(a),
  ]);
  return pary;
}

// ─────────────────────────────────────────────────────────────
// Dokumenty ze wzorów .docx — umowa i uchwała
// ─────────────────────────────────────────────────────────────

/**
 * Umowa o prowadzenie rejestru akcjonariuszy (wzór 01).
 *
 * Treść redaguje notariusz w Wordzie; tutaj wzór dostaje dane wniosku
 * i zamienia się na bloki. Dokument jest jedną z pozycji kompletu — tą,
 * która przenosi stan całego wniosku (patrz `server/trasy/portal.js`).
 */
function umowaRejestru({ wniosek, dzis }) {
  const dane = kontekstPisma.umowaOProwadzenieRejestru({ spolka: wniosek, dzis });
  const wynik = wzoryDysk.wypelnij('01', dane);
  return {
    typ: TYPY.UMOWA_REJESTRU,
    akcjonariuszId: null,
    bloki: bloki.zDocx(wynik.plik, { tytulDomyslny: NAZWY[TYPY.UMOWA_REJESTRU] }),
    // Wzór wypełnia się kluczami z `kontekstPisma`; te, których wniosek nie
    // niesie, zostają kreską. Kancelaria widzi ich listę przy dokumencie
    // i wie, co uzupełnić, zanim komplet pójdzie do klienta.
    brakujace: wynik.brakujace,
  };
}

/** Projekt uchwały o wyborze podmiotu prowadzącego rejestr (wzór 03). */
function uchwalaProjekt({ wniosek, akcjonariusze, dzis }) {
  const dane = kontekstPisma.uchwalaWyboruProjekt({ wniosek, akcjonariusze, dzis });
  const wynik = wzoryDysk.wypelnij('03', dane);
  return {
    typ: TYPY.UCHWALA_WYBORU,
    akcjonariuszId: null,
    bloki: bloki.zDocx(wynik.plik, { tytulDomyslny: NAZWY[TYPY.UCHWALA_WYBORU] }),
    brakujace: wynik.brakujace,
  };
}

// ─────────────────────────────────────────────────────────────
// Dokument 1 — zgoda na komunikację elektroniczną
// ─────────────────────────────────────────────────────────────

function zgodaEmail({ wniosek, akcjonariusz, dzis }) {
  return [
    ...glowka(wniosek, dzis),
    b.tytul(
      'Zgoda na komunikację przy wykorzystaniu poczty elektronicznej',
      'art. 300(33) § 1 pkt 4 Kodeksu spółek handlowych'
    ),

    b.sekcja('Akcjonariusz składający oświadczenie'),
    b.pola(polaAkcjonariusza(akcjonariusz)),

    b.sekcja('Treść oświadczenia'),
    b.akapit(
      'Wyrażam zgodę na komunikację przy wykorzystaniu poczty elektronicznej w stosunkach '
      + 'ze spółką wskazaną wyżej oraz z podmiotem prowadzącym rejestr akcjonariuszy tej spółki. '
      + 'Wskazuję poniższy adres poczty elektronicznej do wpisania do rejestru akcjonariuszy.'
    ),
    b.pola([['Adres poczty elektronicznej', akcjonariusz.email]]),
    b.akapit(
      'Przyjmuję do wiadomości, że wskazany adres stanowi treść rejestru akcjonariuszy '
      + 'i jest udostępniany na zasadach określonych w art. 300(35) Kodeksu spółek handlowych. '
      + 'Zgodę mogę w każdym czasie cofnąć, składając oświadczenie podmiotowi prowadzącemu '
      + 'rejestr; cofnięcie zgody nie wpływa na czynności dokonane przed jego złożeniem.'
    ),
    b.akapit(
      'Bez tej zgody adres poczty elektronicznej NIE zostaje wpisany do rejestru, '
      + 'a korespondencja jest doręczana na adres wskazany wyżej.'
    ),
    b.podpis('data oraz podpis akcjonariusza'),
  ];
}

// ─────────────────────────────────────────────────────────────
// Dokument 2 — oświadczenie o zapoznaniu się z informacją RODO
// ─────────────────────────────────────────────────────────────

function oswiadczenieRodo({ wniosek, akcjonariusz, dzis }) {
  return [
    ...glowka(wniosek, dzis),
    b.tytul(
      'Oświadczenie o zapoznaniu się z informacją o przetwarzaniu danych osobowych',
      'art. 13 rozporządzenia (UE) 2016/679 (RODO)'
    ),

    b.sekcja('Osoba składająca oświadczenie'),
    b.pola(polaAkcjonariusza(akcjonariusz)),

    b.sekcja('Treść oświadczenia'),
    b.akapit(
      'Oświadczam, że zapoznałam/zapoznałem się z informacją o przetwarzaniu danych osobowych '
      + 'w związku z prowadzeniem rejestru akcjonariuszy prostej spółki akcyjnej, przekazaną mi '
      + 'przez podmiot prowadzący rejestr wskazany wyżej.'
    ),
    b.akapit('Informacja obejmuje w szczególności:'),
    b.punkt('1)', 'tożsamość i dane kontaktowe administratora danych;'),
    b.punkt('2)', 'cele i podstawy prawne przetwarzania — zawarcie i wykonanie umowy '
      + 'o prowadzenie rejestru akcjonariuszy oraz obowiązki wynikające z Kodeksu spółek handlowych;'),
    b.punkt('3)', 'kategorie odbiorców danych;'),
    b.punkt('4)', 'okres przechowywania danych;'),
    b.punkt('5)', 'przysługujące mi prawa, w tym prawo dostępu do danych i ich sprostowania '
      + 'oraz prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych.'),
    b.odstep(0.5),
    b.akapit(
      'Przyjmuję do wiadomości, że podanie danych stanowiących treść rejestru akcjonariuszy '
      + 'wynika z przepisów prawa, a podanie adresu poczty elektronicznej jest dobrowolne.'
    ),
    b.podpis('data oraz podpis'),
  ];
}

// ─────────────────────────────────────────────────────────────
// Dokument 3 — oświadczenie o beneficjencie rzeczywistym i statusie PEP
// ─────────────────────────────────────────────────────────────

function oswiadczenieAml({ wniosek, akcjonariusz, dzis }) {
  // Status podany w formularzu zaznaczamy z góry — podpisujący go
  // potwierdza podpisem, zamiast wypełniać drugi raz to samo.
  const pep = akcjonariusz.pep || przepisy.STATUSY_PEP.NIE;
  return [
    ...glowka(wniosek, dzis),
    b.tytul(
      'Oświadczenie o beneficjencie rzeczywistym i statusie osoby zajmującej '
      + 'eksponowane stanowisko polityczne',
      PODSTAWA_AML
    ),

    b.sekcja('Osoba składająca oświadczenie'),
    b.pola(polaAkcjonariusza(akcjonariusz)),

    b.akapit(
      'Notariusz prowadzący rejestr akcjonariuszy jest instytucją obowiązaną w rozumieniu '
      + 'przepisów wskazanych wyżej i stosuje wobec akcjonariuszy środki bezpieczeństwa '
      + 'finansowego. Oświadczenie składa się pod rygorem odpowiedzialności karnej '
      + 'za złożenie fałszywego oświadczenia.'
    ),

    b.sekcja('I. Beneficjent rzeczywisty'),
    b.akapit(
      akcjonariusz.typ === 'prawna'
        ? 'Wskazuję osoby fizyczne będące beneficjentami rzeczywistymi podmiotu wskazanego wyżej '
          + '— sprawujące nad nim bezpośrednio lub pośrednio kontrolę albo w imieniu których '
          + 'nawiązywane są stosunki gospodarcze.'
        : 'Oświadczam, czy akcje obejmuję we własnym imieniu i na własną rzecz, czy też '
          + 'w imieniu albo na rzecz innej osoby.'
    ),
    b.opcja('Beneficjentem rzeczywistym jestem ja — osoba wskazana wyżej.'),
    b.opcja('Beneficjentem rzeczywistym jest inna osoba (proszę wypełnić poniżej).'),
    b.odstep(0.4),
    b.doWypelnienia([
      'Imię i nazwisko',
      'PESEL albo data urodzenia',
      'Obywatelstwo',
      'Państwo zamieszkania',
      'Charakter uprawnień',
    ]),

    b.sekcja('II. Eksponowane stanowisko polityczne (PEP)'),
    b.akapit(
      'Osoba zajmująca eksponowane stanowisko polityczne to osoba fizyczna zajmująca znaczące '
      + 'stanowisko publiczne lub pełniąca znaczącą funkcję publiczną, wymieniona w przepisach '
      + 'wskazanych wyżej. Dotyczy to także członków rodziny takiej osoby oraz osób znanych '
      + 'jako jej bliscy współpracownicy.'
    ),
    b.opcja(
      'Nie jestem osobą zajmującą eksponowane stanowisko polityczne, '
      + 'członkiem rodziny takiej osoby ani jej bliskim współpracownikiem.',
      pep === przepisy.STATUSY_PEP.NIE
    ),
    b.opcja('Jestem osobą zajmującą eksponowane stanowisko polityczne.',
      pep === przepisy.STATUSY_PEP.TAK),
    b.opcja('Jestem członkiem rodziny osoby zajmującej eksponowane stanowisko polityczne.',
      pep === przepisy.STATUSY_PEP.RODZINA),
    b.opcja('Jestem bliskim współpracownikiem osoby zajmującej eksponowane stanowisko polityczne.',
      pep === przepisy.STATUSY_PEP.WSPOLPRACOWNIK),
    b.odstep(0.4),
    przepisy.pepWymagaWzmozonych(pep) && !pusty(akcjonariusz.pep_opis)
      ? b.pola([['Stanowisko, funkcja albo relacja', akcjonariusz.pep_opis]])
      : b.doWypelnienia(['Stanowisko lub funkcja', 'Osoba, z którą łączy mnie relacja']),

    b.sekcja('III. Źródło pochodzenia środków'),
    b.doWypelnienia(['Źródło majątku i środków przeznaczonych na pokrycie akcji']),

    b.podpis('data oraz podpis'),
  ];
}

// ─────────────────────────────────────────────────────────────
// Dokument 4 — żądanie dokonania pierwszego wpisu wraz ze zgodą
// ─────────────────────────────────────────────────────────────

function zadaniePierwszegoWpisu({ wniosek, akcjonariusze, dzis }) {
  return [
    ...glowka(wniosek, dzis),
    b.tytul(
      'Żądanie dokonania pierwszego wpisu w rejestrze akcjonariuszy wraz ze zgodą na wpis',
      'art. 300(34) § 1 i § 3 Kodeksu spółek handlowych'
    ),

    b.akapit(
      'Niżej podpisani, jako osoby obejmujące akcje spółki wskazanej wyżej, żądają dokonania '
      + 'pierwszego wpisu w rejestrze akcjonariuszy obejmującego emisję założycielską '
      + 'i objęcie akcji, w zakresie wynikającym z umowy spółki i z danych wskazanych niżej.'
    ),
    b.akapit(
      'Jednocześnie każdy z podpisanych, jako osoba, której uprawnienia z akcji zostaną przez '
      + 'ten wpis ustanowione albo zmienione, wyraża zgodę na jego dokonanie. Wobec zgody '
      + 'wyrażonej w niniejszym dokumencie uprzednie powiadomienie, o którym mowa '
      + 'w art. 300(34) § 3 Kodeksu spółek handlowych, nie jest wymagane.'
    ),
    b.akapit(
      'Do żądania załącza się umowę spółki oraz dokumenty potwierdzające objęcie akcji. '
      + 'Obowiązek przedłożenia dokumentów uzasadniających wpis spoczywa na osobie żądającej '
      + 'wpisu (art. 300(34) § 4 Kodeksu spółek handlowych).'
    ),

    b.sekcja('Akcjonariusze objęci żądaniem'),
    ...akcjonariusze.map((a, i) =>
      b.punkt(`${i + 1})`, [oznaczenie(a), identyfikator(a), adresRejestrowy(a)]
        .filter(Boolean).join(', '))),

    b.odstep(0.5),
    b.akapit(
      'Podmiot prowadzący rejestr bada treść i formę dokumentów uzasadniających dokonanie wpisu. '
      + 'Nie ma obowiązku badania ich zgodności z prawem ani prawdziwości, w tym prawdziwości '
      + 'podpisów, chyba że poweźmie w tym względzie uzasadnione wątpliwości '
      + '(art. 300(34) § 5 Kodeksu spółek handlowych).'
    ),

    b.sekcja('Podpisy'),
    ...akcjonariusze.map((a) => b.podpis(`${oznaczenie(a)} — data i podpis`)),
  ];
}

// ─────────────────────────────────────────────────────────────
// Złożenie pakietu
// ─────────────────────────────────────────────────────────────

/** Nazwa pliku widoczna dla klienta: co to jest, dla kogo i której spółki dotyczy. */
function nazwaPliku({ typ, wniosek, akcjonariusz }) {
  const czesci = [NAZWY[typ]];
  if (akcjonariusz) czesci.push(oznaczenie(akcjonariusz));
  if (wniosek.krs) czesci.push(`KRS ${wniosek.krs}`);
  // Myślnik z odstępami czyta się lepiej niż podkreślenia, a w nazwie pliku
  // trzeba jeszcze usunąć znaki, których nie zniosą wszystkie systemy plików.
  return `${czesci.join(' — ').replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
}

/**
 * Składa cały komplet: umowę, projekt uchwały, po trzy oświadczenia na
 * akcjonariusza, plus jedno wspólne żądanie wpisu.
 *
 * Zwraca TREŚĆ (bloki), nie gotowe pliki — złożeniem PDF-a zajmuje się
 * `zloz()` przy zapisie, a potem ponownie po każdej poprawce notariusza.
 *
 * @returns {{typ: string, nazwa: string, nazwaPliku: string, kolejnosc: number,
 *   akcjonariuszId: number|null, bloki: object[], brakujace?: string[]}[]}
 */
function zlozPakiet({ wniosek, akcjonariusze, dzis }) {
  const dokumenty = [umowaRejestru({ wniosek, dzis })];

  // Uchwała jest druga — obok umowy to drugi dokument „założycielski"
  // pakietu, przed indywidualnymi oświadczeniami akcjonariuszy.
  if (akcjonariusze.length > 0) {
    dokumenty.push(uchwalaProjekt({ wniosek, akcjonariusze, dzis }));
  }

  for (const a of akcjonariusze) {
    // Zgodę na komunikację elektroniczną wystawiamy tylko tym, którym ma
    // czego dotyczyć — bez adresu e-mail dokument byłby pustą deklaracją.
    if (!pusty(a.email)) {
      dokumenty.push({
        typ: TYPY.ZGODA_EMAIL,
        akcjonariuszId: a.id,
        bloki: zgodaEmail({ wniosek, akcjonariusz: a, dzis }),
      });
    }
    dokumenty.push({
      typ: TYPY.OSWIADCZENIE_RODO,
      akcjonariuszId: a.id,
      bloki: oswiadczenieRodo({ wniosek, akcjonariusz: a, dzis }),
    });
    dokumenty.push({
      typ: TYPY.OSWIADCZENIE_AML,
      akcjonariuszId: a.id,
      bloki: oswiadczenieAml({ wniosek, akcjonariusz: a, dzis }),
    });
  }

  if (akcjonariusze.length > 0) {
    dokumenty.push({
      typ: TYPY.ZADANIE_PIERWSZEGO_WPISU,
      akcjonariuszId: null,
      bloki: zadaniePierwszegoWpisu({ wniosek, akcjonariusze, dzis }),
    });
  }

  return dokumenty.map((d) => opisz(d, { wniosek, akcjonariusze }));
}

/**
 * Dokłada do surowej pozycji pakietu to, co widzi klient: nazwę dokumentu,
 * nazwę pliku i miejsce na liście.
 */
function opisz(d, { wniosek, akcjonariusze = [] }) {
  const akcjonariusz = d.akcjonariuszId
    ? akcjonariusze.find((a) => a.id === d.akcjonariuszId)
    : null;
  return {
    ...d,
    nazwa: NAZWY[d.typ],
    nazwaPliku: nazwaPliku({ typ: d.typ, wniosek, akcjonariusz }),
    kolejnosc: KOLEJNOSC[d.typ] ?? 100,
  };
}

/**
 * Składa PDF z bloków jednego dokumentu. Jedno miejsce dla obu dróg:
 * pierwszego wystawienia kompletu i ponownego złożenia po poprawce treści
 * przez notariusza — inaczej te dwa pliki mogłyby się różnić czymś więcej
 * niż treścią.
 *
 * @param {{typ: string, bloki: object[]}} dokument
 * @returns {Promise<Buffer>}
 */
function zloz(dokument) {
  return bloki.doPdf(dokument.bloki, {
    tytul: NAZWY[dokument.typ] || 'Dokument',
    autor: ustawienia.kancelaria(db()).nazwa,
  });
}

module.exports = { TYPY, NAZWY, KOLEJNOSC, zlozPakiet, opisz, zloz, nazwaPliku, oznaczenie };
