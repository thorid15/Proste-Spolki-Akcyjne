'use strict';

/**
 * Komplet dokumentów powstający przy złożeniu wniosku o prowadzenie rejestru.
 *
 * Umowa o prowadzenie rejestru jest osobno (wzór 01, `.docx`) — to dokument
 * NEGOCJOWANY, którego wzór notariusz edytuje w Wordzie. Tutaj składają się
 * OŚWIADCZENIA o ustalonej treści, po jednym na akcjonariusza, oraz wspólne
 * żądanie pierwszego wpisu. Ich treści się nie negocjuje, więc idą w PDF —
 * patrz komentarz na górze `logika/pdf.js`.
 *
 * Wszystkie dane osobowe trafiają na papier w MIANOWNIKU, opisane etykietą
 * („PESEL: …”, „Działający jako: …”), nigdy odmienione przez przypadki.
 */

const pdf = require('./pdf');
const przepisy = require('./przepisy');
const konfiguracja = require('../konfiguracja');

const PODSTAWA_AML = 'ustawa z dnia 1 marca 2018 r. o przeciwdziałaniu praniu pieniędzy '
  + 'oraz finansowaniu terroryzmu';

/** Katalog dokumentów pakietu — `kod` jest identyfikatorem typu w bazie. */
const TYPY = {
  ZGODA_EMAIL: 'zgoda_email',
  OSWIADCZENIE_RODO: 'oswiadczenie_rodo',
  OSWIADCZENIE_AML: 'oswiadczenie_aml',
  ZADANIE_PIERWSZEGO_WPISU: 'zadanie_pierwszego_wpisu',
};

const NAZWY = {
  [TYPY.ZGODA_EMAIL]: 'Zgoda na komunikację elektroniczną',
  [TYPY.OSWIADCZENIE_RODO]: 'Oświadczenie o zapoznaniu się z informacją o przetwarzaniu danych',
  [TYPY.OSWIADCZENIE_AML]: 'Oświadczenie o beneficjencie rzeczywistym i statusie PEP',
  [TYPY.ZADANIE_PIERWSZEGO_WPISU]: 'Żądanie dokonania pierwszego wpisu wraz ze zgodą',
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

/** Adres wskazany jako ten z art. 300(33) § 1 pkt 3 KSH. */
function adresRejestrowy(a) {
  if (a.rodzaj_adresu_rejestrowego === przepisy.RODZAJE_ADRESU_REJESTROWEGO.DORECZEN) {
    return a.adres_doreczen;
  }
  if (a.rodzaj_adresu_rejestrowego === przepisy.RODZAJE_ADRESU_REJESTROWEGO.EDORECZEN) {
    return a.adres_edoreczen;
  }
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

/** Wspólna główka: kto prowadzi rejestr i dla jakiej spółki. */
function glowka(p, wniosek, dzis) {
  const k = konfiguracja.KANCELARIA;
  p.miejscowoscData(k.kancelaria_miasto || k.miejscowosc, dataPl(dzis));
  p.pola([
    ['Podmiot prowadzący rejestr', `Kancelaria Notarialna, notariusz: ${k.notariusz_mianownik || '—'}`],
    ['Adres kancelarii', [k.kancelaria_ulica, [k.kancelaria_kod, k.kancelaria_miasto].filter(Boolean).join(' ')]
      .filter(Boolean).join(', ')],
    ['Spółka', firmaSpolki(wniosek)],
  ]);
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
    `Adres (${przepisy.OPISY_RODZAJOW_ADRESU_REJESTROWEGO[a.rodzaj_adresu_rejestrowego] || 'niewskazany'})`,
    adresRejestrowy(a),
  ]);
  return pary;
}

// ─────────────────────────────────────────────────────────────
// Dokument 1 — zgoda na komunikację elektroniczną
// ─────────────────────────────────────────────────────────────

function zgodaEmail({ wniosek, akcjonariusz, dzis }) {
  const autor = konfiguracja.KANCELARIA.nazwa;
  return pdf.zbuduj({
    tytul: NAZWY[TYPY.ZGODA_EMAIL],
    autor,
    tresc(p) {
      glowka(p, wniosek, dzis);
      p.tytul(
        'Zgoda na komunikację przy wykorzystaniu poczty elektronicznej',
        'art. 300(33) § 1 pkt 4 Kodeksu spółek handlowych'
      );

      p.sekcja('Akcjonariusz składający oświadczenie');
      p.pola(polaAkcjonariusza(akcjonariusz));

      p.sekcja('Treść oświadczenia');
      p.akapit(
        'Wyrażam zgodę na komunikację przy wykorzystaniu poczty elektronicznej w stosunkach '
        + 'ze spółką wskazaną wyżej oraz z podmiotem prowadzącym rejestr akcjonariuszy tej spółki. '
        + 'Wskazuję poniższy adres poczty elektronicznej do wpisania do rejestru akcjonariuszy.'
      );
      p.pola([['Adres poczty elektronicznej', akcjonariusz.email]]);
      p.akapit(
        'Przyjmuję do wiadomości, że wskazany adres stanowi treść rejestru akcjonariuszy '
        + 'i jest udostępniany na zasadach określonych w art. 300(35) Kodeksu spółek handlowych. '
        + 'Zgodę mogę w każdym czasie cofnąć, składając oświadczenie podmiotowi prowadzącemu '
        + 'rejestr; cofnięcie zgody nie wpływa na czynności dokonane przed jego złożeniem.'
      );
      p.akapit(
        'Bez tej zgody adres poczty elektronicznej NIE zostaje wpisany do rejestru, '
        + 'a korespondencja jest doręczana na adres wskazany wyżej.'
      );
      p.podpis('data oraz podpis akcjonariusza');
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Dokument 2 — oświadczenie o zapoznaniu się z informacją RODO
// ─────────────────────────────────────────────────────────────

function oswiadczenieRodo({ wniosek, akcjonariusz, dzis }) {
  const k = konfiguracja.KANCELARIA;
  return pdf.zbuduj({
    tytul: NAZWY[TYPY.OSWIADCZENIE_RODO],
    autor: k.nazwa,
    tresc(p) {
      glowka(p, wniosek, dzis);
      p.tytul(
        'Oświadczenie o zapoznaniu się z informacją o przetwarzaniu danych osobowych',
        'art. 13 rozporządzenia (UE) 2016/679 (RODO)'
      );

      p.sekcja('Osoba składająca oświadczenie');
      p.pola(polaAkcjonariusza(akcjonariusz));

      p.sekcja('Treść oświadczenia');
      p.akapit(
        'Oświadczam, że zapoznałam/zapoznałem się z informacją o przetwarzaniu danych osobowych '
        + 'w związku z prowadzeniem rejestru akcjonariuszy prostej spółki akcyjnej, przekazaną mi '
        + 'przez podmiot prowadzący rejestr wskazany wyżej.'
      );
      p.akapit('Informacja obejmuje w szczególności:');
      p.punkt('1)', 'tożsamość i dane kontaktowe administratora danych;');
      p.punkt('2)', 'cele i podstawy prawne przetwarzania — zawarcie i wykonanie umowy '
        + 'o prowadzenie rejestru akcjonariuszy oraz obowiązki wynikające z Kodeksu spółek handlowych;');
      p.punkt('3)', 'kategorie odbiorców danych;');
      p.punkt('4)', 'okres przechowywania danych;');
      p.punkt('5)', 'przysługujące mi prawa, w tym prawo dostępu do danych i ich sprostowania '
        + 'oraz prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych.');
      p.odstep(0.5);
      p.akapit(
        'Przyjmuję do wiadomości, że podanie danych stanowiących treść rejestru akcjonariuszy '
        + 'wynika z przepisów prawa, a podanie adresu poczty elektronicznej jest dobrowolne.'
      );
      p.podpis('data oraz podpis');
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Dokument 3 — oświadczenie o beneficjencie rzeczywistym i statusie PEP
// ─────────────────────────────────────────────────────────────

function oswiadczenieAml({ wniosek, akcjonariusz, dzis }) {
  const k = konfiguracja.KANCELARIA;
  return pdf.zbuduj({
    tytul: NAZWY[TYPY.OSWIADCZENIE_AML],
    autor: k.nazwa,
    tresc(p) {
      glowka(p, wniosek, dzis);
      p.tytul(
        'Oświadczenie o beneficjencie rzeczywistym i statusie osoby zajmującej '
        + 'eksponowane stanowisko polityczne',
        PODSTAWA_AML
      );

      p.sekcja('Osoba składająca oświadczenie');
      p.pola(polaAkcjonariusza(akcjonariusz));

      p.akapit(
        'Notariusz prowadzący rejestr akcjonariuszy jest instytucją obowiązaną w rozumieniu '
        + 'przepisów wskazanych wyżej i stosuje wobec akcjonariuszy środki bezpieczeństwa '
        + 'finansowego. Oświadczenie składa się pod rygorem odpowiedzialności karnej '
        + 'za złożenie fałszywego oświadczenia.'
      );

      p.sekcja('I. Beneficjent rzeczywisty');
      p.akapit(
        akcjonariusz.typ === 'prawna'
          ? 'Wskazuję osoby fizyczne będące beneficjentami rzeczywistymi podmiotu wskazanego wyżej '
            + '— sprawujące nad nim bezpośrednio lub pośrednio kontrolę albo w imieniu których '
            + 'nawiązywane są stosunki gospodarcze.'
          : 'Oświadczam, czy akcje obejmuję we własnym imieniu i na własną rzecz, czy też '
            + 'w imieniu albo na rzecz innej osoby.'
      );
      p.opcja('Beneficjentem rzeczywistym jestem ja — osoba wskazana wyżej.');
      p.opcja('Beneficjentem rzeczywistym jest inna osoba (proszę wypełnić poniżej).');
      p.odstep(0.4);
      p.polaDoWypelnienia([
        'Imię i nazwisko',
        'PESEL albo data urodzenia',
        'Obywatelstwo',
        'Państwo zamieszkania',
        'Charakter uprawnień',
      ]);

      p.sekcja('II. Eksponowane stanowisko polityczne (PEP)');
      p.akapit(
        'Osoba zajmująca eksponowane stanowisko polityczne to osoba fizyczna zajmująca znaczące '
        + 'stanowisko publiczne lub pełniąca znaczącą funkcję publiczną, wymieniona w przepisach '
        + 'wskazanych wyżej. Dotyczy to także członków rodziny takiej osoby oraz osób znanych '
        + 'jako jej bliscy współpracownicy.'
      );
      p.opcja('Nie jestem osobą zajmującą eksponowane stanowisko polityczne, '
        + 'członkiem rodziny takiej osoby ani jej bliskim współpracownikiem.');
      p.opcja('Jestem osobą zajmującą eksponowane stanowisko polityczne.');
      p.opcja('Jestem członkiem rodziny osoby zajmującej eksponowane stanowisko polityczne.');
      p.opcja('Jestem bliskim współpracownikiem osoby zajmującej eksponowane stanowisko polityczne.');
      p.odstep(0.4);
      p.polaDoWypelnienia(['Stanowisko lub funkcja', 'Osoba, z którą łączy mnie relacja']);

      p.sekcja('III. Źródło pochodzenia środków');
      p.polaDoWypelnienia(['Źródło majątku i środków przeznaczonych na pokrycie akcji']);

      p.podpis('data oraz podpis');
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Dokument 4 — żądanie dokonania pierwszego wpisu wraz ze zgodą
// ─────────────────────────────────────────────────────────────

function zadaniePierwszegoWpisu({ wniosek, akcjonariusze, dzis }) {
  const k = konfiguracja.KANCELARIA;
  return pdf.zbuduj({
    tytul: NAZWY[TYPY.ZADANIE_PIERWSZEGO_WPISU],
    autor: k.nazwa,
    tresc(p) {
      glowka(p, wniosek, dzis);
      p.tytul(
        'Żądanie dokonania pierwszego wpisu w rejestrze akcjonariuszy wraz ze zgodą na wpis',
        'art. 300(34) § 1 i § 3 Kodeksu spółek handlowych'
      );

      p.akapit(
        'Niżej podpisani, jako osoby obejmujące akcje spółki wskazanej wyżej, żądają dokonania '
        + 'pierwszego wpisu w rejestrze akcjonariuszy obejmującego emisję założycielską '
        + 'i objęcie akcji, w zakresie wynikającym z umowy spółki i z danych wskazanych niżej.'
      );
      p.akapit(
        'Jednocześnie każdy z podpisanych, jako osoba, której uprawnienia z akcji zostaną przez '
        + 'ten wpis ustanowione albo zmienione, wyraża zgodę na jego dokonanie. Wobec zgody '
        + 'wyrażonej w niniejszym dokumencie uprzednie powiadomienie, o którym mowa '
        + 'w art. 300(34) § 3 Kodeksu spółek handlowych, nie jest wymagane.'
      );
      p.akapit(
        'Do żądania załącza się umowę spółki oraz dokumenty potwierdzające objęcie akcji. '
        + 'Obowiązek przedłożenia dokumentów uzasadniających wpis spoczywa na osobie żądającej '
        + 'wpisu (art. 300(34) § 4 Kodeksu spółek handlowych).'
      );

      p.sekcja('Akcjonariusze objęci żądaniem');
      akcjonariusze.forEach((a, i) => {
        p.punkt(`${i + 1})`, [oznaczenie(a), identyfikator(a), adresRejestrowy(a)]
          .filter(Boolean).join(', '));
      });

      p.odstep(0.5);
      p.akapit(
        'Podmiot prowadzący rejestr bada treść i formę dokumentów uzasadniających dokonanie wpisu. '
        + 'Nie ma obowiązku badania ich zgodności z prawem ani prawdziwości, w tym prawdziwości '
        + 'podpisów, chyba że poweźmie w tym względzie uzasadnione wątpliwości '
        + '(art. 300(34) § 5 Kodeksu spółek handlowych).'
      );

      p.sekcja('Podpisy');
      akcjonariusze.forEach((a) => p.podpis(`${oznaczenie(a)} — data i podpis`));
    },
  });
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
 * Składa cały komplet: po trzy oświadczenia na akcjonariusza plus jedno
 * wspólne żądanie wpisu.
 *
 * @returns {Promise<{typ: string, nazwa: string, nazwaPliku: string,
 *   akcjonariuszId: number|null, plik: Buffer}[]>}
 */
async function zlozPakiet({ wniosek, akcjonariusze, dzis }) {
  const dokumenty = [];

  for (const a of akcjonariusze) {
    // Zgodę na komunikację elektroniczną wystawiamy tylko tym, którym ma
    // czego dotyczyć — bez adresu e-mail dokument byłby pustą deklaracją.
    if (!pusty(a.email)) {
      dokumenty.push({
        typ: TYPY.ZGODA_EMAIL,
        akcjonariuszId: a.id,
        plik: await zgodaEmail({ wniosek, akcjonariusz: a, dzis }),
      });
    }
    dokumenty.push({
      typ: TYPY.OSWIADCZENIE_RODO,
      akcjonariuszId: a.id,
      plik: await oswiadczenieRodo({ wniosek, akcjonariusz: a, dzis }),
    });
    dokumenty.push({
      typ: TYPY.OSWIADCZENIE_AML,
      akcjonariuszId: a.id,
      plik: await oswiadczenieAml({ wniosek, akcjonariusz: a, dzis }),
    });
  }

  if (akcjonariusze.length > 0) {
    dokumenty.push({
      typ: TYPY.ZADANIE_PIERWSZEGO_WPISU,
      akcjonariuszId: null,
      plik: await zadaniePierwszegoWpisu({ wniosek, akcjonariusze, dzis }),
    });
  }

  return dokumenty.map((d) => {
    const akcjonariusz = d.akcjonariuszId
      ? akcjonariusze.find((a) => a.id === d.akcjonariuszId)
      : null;
    return {
      ...d,
      nazwa: NAZWY[d.typ],
      nazwaPliku: nazwaPliku({ typ: d.typ, wniosek, akcjonariusz }),
    };
  });
}

module.exports = { TYPY, NAZWY, zlozPakiet, nazwaPliku, oznaczenie };
