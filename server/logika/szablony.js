'use strict';

/**
 * Silnik szablonów dokumentów wychodzących (sesja 6, faza 4).
 *
 * Składnia — celowo minimalna, bo szablony redaguje notariusz, nie programista:
 *
 *   {{klucz}}              wartość, zawsze escapowana
 *   {{klucz_slownie}}      ta sama wartość zapisana słownie (liczba albo data)
 *   {{#lista}}…{{/lista}}  powtórzenie bloku dla każdej pozycji listy
 *
 * Wewnątrz bloku klucze rozwiązują się najpierw względem pozycji listy, a gdy
 * jej nie dotyczą — względem danych nadrzędnych. Dzięki temu w wierszu tabeli
 * akcjonariuszy można sięgnąć po nazwę spółki bez przekazywania jej do każdej
 * pozycji z osobna.
 *
 * BEZ ZALEŻNOŚCI (master, sekcja 4: żadnych bibliotek). Sam szablon jest HTML-em
 * pisanym przez administratora i przechodzi bez zmian; escapowane są wyłącznie
 * PODSTAWIANE WARTOŚCI - inaczej nazwisko z „&" albo „<" rozsypałoby dokument
 * albo otworzyło wstrzyknięcie znaczników.
 *
 * Klucz nieznany NIE znika po cichu: renderuje się jako „—" i trafia na listę
 * `brakujace`, którą podgląd pokazuje przed wydaniem dokumentu. W dokumencie
 * o skutkach prawnych puste miejsce jest groźniejsze niż widoczna dziura.
 */

const ZASLONA_BRAKU = '—';

function esc(tekst) {
  return String(tekst == null ? '' : tekst).replace(/[&<>"']/g, (znak) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[znak]));
}

// ─────────────────────────────────────────────────────────────
// Liczebniki polskie - na potrzeby {{klucz_slownie}}
// ─────────────────────────────────────────────────────────────

const JEDNOSTKI = [
  'zero', 'jeden', 'dwa', 'trzy', 'cztery',
  'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć',
];
const NASTKI = [
  'dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście',
  'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście',
];
const DZIESIATKI = [
  '', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści',
  'pięćdziesiąt', 'sześćdziesiąt', 'siedemdziesiąt', 'osiemdziesiąt', 'dziewięćdziesiąt',
];
const SETKI = [
  '', 'sto', 'dwieście', 'trzysta', 'czterysta',
  'pięćset', 'sześćset', 'siedemset', 'osiemset', 'dziewięćset',
];

/** Grupy trzycyfrowe z odmianą: [pojedyncza, mnoga „2-4", mnoga dopełniaczowa]. */
const GRUPY = [
  ['', '', ''],
  ['tysiąc', 'tysiące', 'tysięcy'],
  ['milion', 'miliony', 'milionów'],
  ['miliard', 'miliardy', 'miliardów'],
];

/** Która forma mnoga dla danej liczby - reguła polska (2-4 vs reszta). */
function formaMnoga(n) {
  if (n === 1) return 0;
  const ostatnia = n % 10;
  const dwieOstatnie = n % 100;
  if (ostatnia >= 2 && ostatnia <= 4 && !(dwieOstatnie >= 12 && dwieOstatnie <= 14)) return 1;
  return 2;
}

/** Liczba 0-999 słownie, bez nazwy grupy. */
function grupaSlownie(n) {
  const czesci = [];
  const s = Math.floor(n / 100);
  const reszta = n % 100;
  if (s > 0) czesci.push(SETKI[s]);
  if (reszta >= 10 && reszta <= 19) {
    czesci.push(NASTKI[reszta - 10]);
  } else {
    const d = Math.floor(reszta / 10);
    const j = reszta % 10;
    if (d > 0) czesci.push(DZIESIATKI[d]);
    if (j > 0) czesci.push(JEDNOSTKI[j]);
  }
  return czesci.join(' ');
}

/**
 * Liczba całkowita słownie. Ujemne z przedrostkiem „minus"; ułamkowe
 * odrzucamy - w rejestrze liczby zapisywane słownie to liczby akcji i kwoty
 * w groszach, zawsze całkowite.
 */
function liczbaSlownie(wartosc) {
  const n = Number(wartosc);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n === 0) return JEDNOSTKI[0];
  const znak = n < 0 ? 'minus ' : '';
  let reszta = Math.abs(n);

  const grupy = [];
  while (reszta > 0) {
    grupy.push(reszta % 1000);
    reszta = Math.floor(reszta / 1000);
  }
  if (grupy.length > GRUPY.length) return null;

  const czesci = [];
  for (let i = grupy.length - 1; i >= 0; i -= 1) {
    const g = grupy[i];
    if (g === 0) continue;
    // „tysiąc", nie „jeden tysiąc" - ale „jeden" zostaje w grupie jedności.
    if (!(i > 0 && g === 1)) czesci.push(grupaSlownie(g));
    if (i > 0) czesci.push(GRUPY[i][formaMnoga(g)]);
  }
  return znak + czesci.join(' ');
}

const MIESIACE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

/** Data ISO słownie: „9 sierpnia 2026 r.". */
function dataSlownie(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const [, rok, mies, dzien] = m;
  const idx = Number(mies) - 1;
  if (idx < 0 || idx > 11) return null;
  return `${Number(dzien)} ${MIESIACE[idx]} ${Number(rok)} r.`;
}

/** Wartość zapisana słownie: data albo liczba. `null`, gdy ani jedno, ani drugie. */
function slownie(wartosc) {
  if (wartosc == null || wartosc === '') return null;
  return dataSlownie(wartosc) ?? liczbaSlownie(wartosc);
}

// ─────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────

const OTWARCIE_BLOKU = /\{\{#([a-zA-Z0-9_]+)\}\}/;

/**
 * Wycina najbardziej zewnętrzny blok `{{#nazwa}}…{{/nazwa}}`, licząc
 * zagnieżdżenia tej samej nazwy. Zwraca `null`, gdy bloku nie ma.
 */
function znajdzBlok(tekst) {
  const start = OTWARCIE_BLOKU.exec(tekst);
  if (!start) return null;
  const nazwa = start[1];
  const otwarcie = `{{#${nazwa}}}`;
  const zamkniecie = `{{/${nazwa}}}`;

  let poziom = 1;
  let i = start.index + otwarcie.length;
  const poczatekWnetrza = i;

  while (i < tekst.length && poziom > 0) {
    const nastOtw = tekst.indexOf(otwarcie, i);
    const nastZam = tekst.indexOf(zamkniecie, i);
    if (nastZam === -1) return { blad: `Blok {{#${nazwa}}} nie został zamknięty.` };
    if (nastOtw !== -1 && nastOtw < nastZam) {
      poziom += 1;
      i = nastOtw + otwarcie.length;
    } else {
      poziom -= 1;
      if (poziom === 0) {
        return {
          nazwa,
          przed: tekst.slice(0, start.index),
          wnetrze: tekst.slice(poczatekWnetrza, nastZam),
          po: tekst.slice(nastZam + zamkniecie.length),
        };
      }
      i = nastZam + zamkniecie.length;
    }
  }
  return { blad: `Blok {{#${nazwa}}} nie został zamknięty.` };
}

function pobierz(klucz, zakresy) {
  for (const zakres of zakresy) {
    if (zakres && Object.prototype.hasOwnProperty.call(zakres, klucz)) return zakres[klucz];
  }
  return undefined;
}

/** Podstawia `{{klucz}}` i `{{klucz_slownie}}` w tekście bez bloków. */
function podstaw(tekst, zakresy, brakujace) {
  return tekst.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (dopasowanie, klucz) => {
    let wartosc = pobierz(klucz, zakresy);

    // „_slownie" rozwiązujemy dopiero, gdy nie ma klucza wprost o tej nazwie -
    // szablon może mieć własne, gotowe pole `kwota_slownie`.
    if (wartosc === undefined && klucz.endsWith('_slownie')) {
      const bazowy = klucz.slice(0, -'_slownie'.length);
      const bazowa = pobierz(bazowy, zakresy);
      if (bazowa !== undefined) {
        const slowa = slownie(bazowa);
        if (slowa == null) {
          brakujace.add(`${klucz} (wartość „${bazowa}” nie jest liczbą ani datą)`);
          return ZASLONA_BRAKU;
        }
        return esc(slowa);
      }
    }

    if (wartosc === undefined || wartosc === null || wartosc === '') {
      brakujace.add(klucz);
      return ZASLONA_BRAKU;
    }
    return esc(wartosc);
  });
}

function renderujFragment(tekst, zakresy, brakujace, bledy) {
  const blok = znajdzBlok(tekst);
  if (!blok) return podstaw(tekst, zakresy, brakujace);
  if (blok.blad) {
    bledy.push(blok.blad);
    return podstaw(tekst, zakresy, brakujace);
  }

  const lista = pobierz(blok.nazwa, zakresy);
  let srodek = '';
  if (Array.isArray(lista)) {
    srodek = lista
      .map((poz) =>
        renderujFragment(
          blok.wnetrze,
          [poz && typeof poz === 'object' ? poz : { wartosc: poz }, ...zakresy],
          brakujace,
          bledy
        )
      )
      .join('');
  } else if (lista === undefined) {
    brakujace.add(`${blok.nazwa} (lista)`);
  }
  // Lista pusta albo nieobecna - blok znika w całości. To zamierzone: wiersze
  // tabeli bez pozycji nie mają czego pokazać.

  return (
    renderujFragment(blok.przed, zakresy, brakujace, bledy) +
    srodek +
    renderujFragment(blok.po, zakresy, brakujace, bledy)
  );
}

/**
 * Renderuje szablon.
 *
 * @param {string} szablon  treść z `psa_szablony.tresc`
 * @param {object} dane     słownik kluczy
 * @returns {{ html: string, brakujace: string[], bledy: string[] }}
 */
function renderuj(szablon, dane = {}) {
  const brakujace = new Set();
  const bledy = [];
  const html = renderujFragment(String(szablon || ''), [dane], brakujace, bledy);
  return { html, brakujace: [...brakujace], bledy };
}

/** Klucze użyte w szablonie - do podpowiedzi w edytorze i walidacji zasiewu. */
function uzyteKlucze(szablon) {
  const tekst = String(szablon || '');
  const proste = [...tekst.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1]);
  const listy = [...tekst.matchAll(/\{\{#([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1]);
  return { proste: [...new Set(proste)], listy: [...new Set(listy)] };
}

module.exports = {
  ZASLONA_BRAKU,
  esc,
  liczbaSlownie,
  dataSlownie,
  slownie,
  renderuj,
  uzyteKlucze,
};
