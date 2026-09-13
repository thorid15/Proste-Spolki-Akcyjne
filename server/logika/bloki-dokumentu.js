'use strict';

/**
 * Treść dokumentu jako LISTA BLOKÓW — jeden model dla wszystkiego, co
 * kancelaria wystawia klientowi do podpisu.
 *
 * Po co osobny model, skoro `logika/pdf.js` i tak składa PDF
 * ─────────────────────────────────────────────────────────────
 * Dotąd treść pisma żyła w kodzie: funkcja wołała `p.akapit(...)`,
 * `p.sekcja(...)` i tak dalej, a jedynym jej śladem był gotowy PDF. Notariusz
 * nie miał jak poprawić ani jednego zdania — ani w aplikacji, ani w pliku,
 * bo PDF jest nieedytowalny z założenia. Blok jest tym samym wywołaniem,
 * tylko zapisanym jako dane: `{ rodzaj: 'akapit', tekst: '…' }`. Dzięki temu
 * treść da się zapisać w bazie, pokazać w edytorze, poprawić i złożyć na
 * nowo — a wynikiem nadal jest ten sam PDF, którego klient nie podmieni.
 *
 * Drugi powód: umowa i uchwała powstawały z wzorów `.docx` przez konwersję
 * LibreOffice. Gdy LibreOffice nie było w systemie (albo zabrakło filtrów
 * Writera), konwersja cicho się wywracała i umowa PO PROSTU ZNIKAŁA
 * z kompletu — klient dostawał do podpisu wszystko poza dokumentem
 * najważniejszym. Wzór `.docx` zostaje źródłem treści (notariusz redaguje go
 * w Wordzie), ale zamienia się go tutaj na bloki i składa własnym silnikiem,
 * bez zależności od zewnętrznego programu.
 *
 * Bloki są ŚWIADOMIE ubogie: dziesięć rodzajów, żadnego zagnieżdżania,
 * żadnego formatowania w środku tekstu. Redaguje je notariusz, nie
 * programista — a dokument o skutkach prawnych ma być czytelny, nie ładny.
 */

const pdf = require('./pdf');
const docx = require('./docx');

/** Rodzaje bloków — każdy odpowiada jednemu pomocnikowi z `logika/pdf.js`. */
const RODZAJE = {
  NAGLOWEK: 'naglowek',
  TYTUL: 'tytul',
  SEKCJA: 'sekcja',
  AKAPIT: 'akapit',
  POLA: 'pola',
  PUNKT: 'punkt',
  OPCJA: 'opcja',
  DO_WYPELNIENIA: 'doWypelnienia',
  ODSTEP: 'odstep',
  PODPIS: 'podpis',
};

const WSZYSTKIE_RODZAJE = new Set(Object.values(RODZAJE));

/** Nazwy rodzajów po polsku — edytor pokazuje je przy każdym bloku. */
const NAZWY_RODZAJOW = {
  [RODZAJE.NAGLOWEK]: 'Miejscowość i data',
  [RODZAJE.TYTUL]: 'Tytuł',
  [RODZAJE.SEKCJA]: 'Nagłówek sekcji',
  [RODZAJE.AKAPIT]: 'Akapit',
  [RODZAJE.POLA]: 'Dane (etykieta: wartość)',
  [RODZAJE.PUNKT]: 'Punkt listy',
  [RODZAJE.OPCJA]: 'Pozycja do zaznaczenia',
  [RODZAJE.DO_WYPELNIENIA]: 'Pola do wypełnienia ręcznie',
  [RODZAJE.ODSTEP]: 'Odstęp',
  [RODZAJE.PODPIS]: 'Miejsce na podpis',
};

function tekstem(v) {
  return v === undefined || v === null ? '' : String(v);
}

// ─────────────────────────────────────────────────────────────
// Skróty do budowania bloków w kodzie
// ─────────────────────────────────────────────────────────────

const b = {
  naglowek: (miejscowosc, data) => ({ rodzaj: RODZAJE.NAGLOWEK, miejscowosc: tekstem(miejscowosc), data: tekstem(data) }),
  tytul: (tekst, podtytul) => ({ rodzaj: RODZAJE.TYTUL, tekst: tekstem(tekst), podtytul: tekstem(podtytul) }),
  sekcja: (tekst) => ({ rodzaj: RODZAJE.SEKCJA, tekst: tekstem(tekst) }),
  akapit: (tekst) => ({ rodzaj: RODZAJE.AKAPIT, tekst: tekstem(tekst) }),
  /** @param {Array<[string, *]>} pary */
  pola: (pary) => ({
    rodzaj: RODZAJE.POLA,
    pary: (pary || []).map(([etykieta, wartosc]) => [tekstem(etykieta), tekstem(wartosc)]),
  }),
  punkt: (znacznik, tekst) => ({ rodzaj: RODZAJE.PUNKT, znacznik: tekstem(znacznik), tekst: tekstem(tekst) }),
  opcja: (tekst, zaznaczona = false) => ({ rodzaj: RODZAJE.OPCJA, tekst: tekstem(tekst), zaznaczona: Boolean(zaznaczona) }),
  doWypelnienia: (etykiety) => ({ rodzaj: RODZAJE.DO_WYPELNIENIA, etykiety: (etykiety || []).map(tekstem) }),
  odstep: (ile = 1) => ({ rodzaj: RODZAJE.ODSTEP, ile: Number(ile) || 1 }),
  podpis: (opis) => ({ rodzaj: RODZAJE.PODPIS, opis: tekstem(opis) }),
};

// ─────────────────────────────────────────────────────────────
// Walidacja — treść wraca z przeglądarki, więc nie ufamy jej kształtowi
// ─────────────────────────────────────────────────────────────

/**
 * Sprowadza dowolne dane do poprawnej listy bloków albo rzuca wyjątkiem.
 * Bloki nieznanego rodzaju odpadają, zamiast wywracać składanie PDF-a przy
 * każdym późniejszym wydaniu dokumentu.
 *
 * @param {*} dane
 * @returns {object[]}
 */
function znormalizuj(dane) {
  if (!Array.isArray(dane)) throw new Error('Treść dokumentu musi być listą bloków.');
  const wynik = [];
  for (const blok of dane) {
    if (!blok || typeof blok !== 'object') continue;
    const rodzaj = String(blok.rodzaj || '');
    if (!WSZYSTKIE_RODZAJE.has(rodzaj)) continue;
    switch (rodzaj) {
      case RODZAJE.NAGLOWEK:
        wynik.push(b.naglowek(blok.miejscowosc, blok.data));
        break;
      case RODZAJE.TYTUL:
        wynik.push(b.tytul(blok.tekst, blok.podtytul));
        break;
      case RODZAJE.SEKCJA:
        wynik.push(b.sekcja(blok.tekst));
        break;
      case RODZAJE.AKAPIT:
        wynik.push(b.akapit(blok.tekst));
        break;
      case RODZAJE.POLA:
        wynik.push(b.pola(
          (Array.isArray(blok.pary) ? blok.pary : [])
            .filter((para) => Array.isArray(para) && para.length > 0)
            .map((para) => [para[0], para[1]])
        ));
        break;
      case RODZAJE.PUNKT:
        wynik.push(b.punkt(blok.znacznik, blok.tekst));
        break;
      case RODZAJE.OPCJA:
        wynik.push(b.opcja(blok.tekst, blok.zaznaczona));
        break;
      case RODZAJE.DO_WYPELNIENIA:
        wynik.push(b.doWypelnienia(Array.isArray(blok.etykiety) ? blok.etykiety : []));
        break;
      case RODZAJE.ODSTEP:
        wynik.push(b.odstep(blok.ile));
        break;
      case RODZAJE.PODPIS:
        wynik.push(b.podpis(blok.opis));
        break;
      default:
        break;
    }
  }
  if (wynik.length === 0) throw new Error('Treść dokumentu jest pusta.');
  return wynik;
}

// ─────────────────────────────────────────────────────────────
// Składanie PDF
// ─────────────────────────────────────────────────────────────

/**
 * Składa bloki w gotowy PDF.
 *
 * @param {object[]} bloki
 * @param {{tytul: string, autor: string}} opcje
 * @returns {Promise<Buffer>}
 */
function doPdf(bloki, { tytul, autor }) {
  const lista = znormalizuj(bloki);
  return pdf.zbuduj({
    tytul,
    autor,
    tresc(p) {
      for (const blok of lista) {
        switch (blok.rodzaj) {
          case RODZAJE.NAGLOWEK: p.miejscowoscData(blok.miejscowosc, blok.data); break;
          case RODZAJE.TYTUL: p.tytul(blok.tekst, blok.podtytul || undefined); break;
          case RODZAJE.SEKCJA: p.sekcja(blok.tekst); break;
          case RODZAJE.AKAPIT: p.akapit(blok.tekst); break;
          case RODZAJE.POLA: p.pola(blok.pary); break;
          case RODZAJE.PUNKT: p.punkt(blok.znacznik, blok.tekst); break;
          case RODZAJE.OPCJA: p.opcja(blok.tekst, blok.zaznaczona); break;
          case RODZAJE.DO_WYPELNIENIA: p.polaDoWypelnienia(blok.etykiety); break;
          case RODZAJE.ODSTEP: p.odstep(blok.ile); break;
          case RODZAJE.PODPIS: p.podpis(blok.opis); break;
          default: break;
        }
      }
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Wzór .docx → bloki
// ─────────────────────────────────────────────────────────────

/* Nagłówek jednostki redakcyjnej umowy albo uchwały: „§ 1", „Rozdział II.",
   „ARTYKUŁ 3". Wzory kancelarii numerują je w TEKŚCIE akapitu (nie przez
   numerację Worda), więc rozpoznajemy je wprost po zapisie. */
const WZORZEC_JEDNOSTKI = /^(§\s*\d+|rozdział\s+[IVXLC\d]+|art\.\s*\d+)/i;

/* Punkt listy: „1)", „1.", „a)", „–" albo „-" na początku wiersza. Wzory
   kancelarii wpisują znacznik ręcznie, więc zostaje on w tekście. */
const WZORZEC_PUNKTU = /^(\d+\)|\d+\.|[a-ząćęłńóśźż]\)|[–—-])\s*/;

/* Wiersz kropek albo podkreśleń — we wzorze oznacza miejsce na podpis. */
const WZORZEC_LINII_PODPISU = /^[.…_\s]{10,}$/;

/**
 * Zamienia WYPEŁNIONY wzór `.docx` na listę bloków.
 *
 * Formatowanie Worda (kroje, wcięcia, tabele) nie przechodzi — i nie ma
 * przechodzić. Dokument do podpisu składa się tu jednym krojem i jedną
 * siatką, tak samo jak pozostałe oświadczenia kompletu; z Worda bierzemy
 * TREŚĆ, bo to ona jest redagowana przez notariusza.
 *
 * @param {Buffer} bufor wypełniony plik `.docx`
 * @param {{tytulDomyslny?: string}} [opcje]
 * @returns {object[]}
 */
function zDocx(bufor, { tytulDomyslny } = {}) {
  const linie = docx.tekst(bufor)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim());

  const bloki = [];
  let tytulUstawiony = false;
  let podtytuly = 0;

  for (const linia of linie) {
    if (!linia) continue;

    // Pierwszy niepusty wiersz wzoru jest jego tytułem; kolejne krótkie
    // wiersze bezpośrednio pod nim — podtytułem (wzory zapisują nazwę pisma
    // w dwóch, trzech wierszach).
    if (!tytulUstawiony) {
      bloki.push(b.tytul(linia, ''));
      tytulUstawiony = true;
      continue;
    }
    if (podtytuly < 2 && bloki[bloki.length - 1].rodzaj === RODZAJE.TYTUL && linia.length <= 90
        && !WZORZEC_JEDNOSTKI.test(linia) && !/[.:;]$/.test(linia)) {
      const tytul = bloki[bloki.length - 1];
      tytul.podtytul = [tytul.podtytul, linia].filter(Boolean).join(' — ');
      podtytuly += 1;
      continue;
    }

    if (WZORZEC_LINII_PODPISU.test(linia)) {
      bloki.push(b.podpis('data i podpis'));
      continue;
    }
    if (WZORZEC_JEDNOSTKI.test(linia) && linia.length <= 70) {
      bloki.push(b.sekcja(linia));
      continue;
    }
    // Krótki wiersz WERSALIKAMI to w tych wzorach śródtytuł („DEFINICJE",
    // „PRZEDMIOT UMOWY") — akapit zrobiłby z niego zdanie, którym nie jest.
    if (linia.length <= 60 && linia === linia.toLocaleUpperCase('pl') && /\p{Lu}/u.test(linia)) {
      bloki.push(b.sekcja(linia));
      continue;
    }
    const punkt = linia.match(WZORZEC_PUNKTU);
    if (punkt) {
      bloki.push(b.punkt(punkt[1], linia.slice(punkt[0].length)));
      continue;
    }
    bloki.push(b.akapit(linia));
  }

  if (bloki.length === 0) {
    bloki.push(b.tytul(tytulDomyslny || 'Dokument', ''));
  }
  return bloki;
}

module.exports = {
  RODZAJE,
  NAZWY_RODZAJOW,
  blok: b,
  znormalizuj,
  doPdf,
  zDocx,
};
