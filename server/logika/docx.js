'use strict';

/**
 * Wypełnianie wzorów `.docx` danymi z rejestru.
 *
 * Notariusz redaguje pismo w Wordzie i wgrywa gotowy plik; aplikacja podstawia
 * wartości i oddaje `.docx` do podpisu. Nic pomiędzy — bez konwersji na PDF,
 * bez przepisywania treści na HTML. Dzięki temu za wygląd pisma odpowiada ten,
 * kto je redagował, a nie arkusz stylów aplikacji.
 *
 * Składnia jest ta sama, co w silniku HTML (`szablony.js`) i w słowniku
 * `PLACEHOLDERY-PSA.md`:
 *
 *   {{klucz}}                  podstawienie wartości
 *   {{klucz_slownie}}          liczba albo data zapisana słowami
 *   {{#kolekcja}}…{{/kolekcja}} powtórzenie fragmentu dla każdej pozycji
 *   {{#warunek}}…{{/warunek}}   ten sam zapis dla sekcji 0/1
 *
 * ── Trzy tryby sekcji ────────────────────────────────────────────────────
 * Word nie ma pojęcia „blok tekstu"; to, co powtarzamy, zależy od tego, gdzie
 * autor wzoru postawił znaczniki. Wzory z katalogu `wzory/` używają wszystkich
 * trzech układów, więc renderer rozpoznaje je sam:
 *
 *   1. W JEDNYM AKAPICIE — `{{#adresat_spolka}}zarząd spółki{{/adresat_spolka}}`.
 *      Powtarzamy sam fragment tekstu, akapit zostaje.
 *   2. W JEDNYM WIERSZU TABELI — znacznik otwierający w pierwszej komórce,
 *      zamykający w ostatniej. Jednostką powtórzenia jest cały `<w:tr>`,
 *      bo inaczej wiersz tabeli by się rozjechał.
 *   3. W OSOBNYCH AKAPITACH — `{{#zalaczniki}}` sam w akapicie, treść niżej,
 *      `{{/zalaczniki}}` sam w akapicie. Powtarzamy akapity POMIĘDZY, a oba
 *      akapity ze znacznikami znikają.
 *
 * ── Rozbite placeholdery ────────────────────────────────────────────────
 * Word potrafi pociąć `{{spolka_firma}}` na kilka przebiegów (`<w:r>`), gdy
 * w środku wyrazu zmieniło się formatowanie albo zadziałał autokorektor.
 * Wtedy zwykłe wyszukanie tekstu nic nie znajduje i pole zostaje puste.
 * Przed podstawieniem scalamy takie przebiegi i mówimy, który klucz wymagał
 * naprawy — żeby dało się poprawić wzór u źródła.
 *
 * BEZ ZALEŻNOŚCI (master, sekcja 4). ZIP obsługuje `logika/zip.js` na
 * standardowym `zlib`, XML — operacje na tekście; do podstawienia wartości
 * nie potrzeba pełnego parsera, bo nie zmieniamy struktury dokumentu poza
 * kopiowaniem i usuwaniem całych elementów.
 */

const zip = require('./zip');
const { esc, slownie, ZASLONA_BRAKU } = require('./szablony');

const CZESC_DOKUMENTU = 'word/document.xml';
const LIMIT_SEKCJI = 1000;

// ─────────────────────────────────────────────────────────────
// Elementy XML
// ─────────────────────────────────────────────────────────────

/**
 * Zakresy wszystkich elementów o danej nazwie, z poprawną obsługą zagnieżdżeń
 * i wariantu samozamykającego (`<w:p/>`).
 */
function elementy(xml, tag) {
  const wynik = [];
  const stos = [];
  const wzorzec = new RegExp(`<${tag}(?=[\\s/>])|</${tag}>`, 'g');
  let dopasowanie;
  while ((dopasowanie = wzorzec.exec(xml))) {
    if (dopasowanie[0][1] === '/') {
      const start = stos.pop();
      if (start !== undefined) {
        wynik.push({ start, koniec: dopasowanie.index + dopasowanie[0].length });
      }
      continue;
    }
    const koniecTagu = xml.indexOf('>', dopasowanie.index);
    if (koniecTagu > 0 && xml[koniecTagu - 1] === '/') {
      wynik.push({ start: dopasowanie.index, koniec: koniecTagu + 1 });
    } else {
      stos.push(dopasowanie.index);
    }
  }
  return wynik;
}

/** Najgłębszy element z listy, który obejmuje daną pozycję. */
function otaczajacy(zakresy, pozycja) {
  let najlepszy = null;
  for (const zakres of zakresy) {
    if (zakres.start <= pozycja && pozycja < zakres.koniec) {
      if (!najlepszy || zakres.start > najlepszy.start) najlepszy = zakres;
    }
  }
  return najlepszy;
}

/** Elementy nieobjęte innym elementem z tej samej listy. */
function tylkoZewnetrzne(zakresy) {
  return zakresy.filter(
    (a) => !zakresy.some((b) => b !== a && b.start <= a.start && a.koniec <= b.koniec)
  );
}

function tekstJawny(xml) {
  return xml.replace(/<[^>]+>/g, '');
}

/**
 * Usuwa znaczniki sekcji z fragmentu. Akapit, w którym znacznik był JEDYNĄ
 * treścią, znika w całości — inaczej po powieleniu wiersza tabeli zostałyby
 * w nim puste linie.
 */
function usunZnaczniki(fragment, nazwa) {
  const znaczniki = [`{{#${nazwa}}}`, `{{/${nazwa}}}`];
  let wynik = fragment;
  const akapity = tylkoZewnetrzne(elementy(wynik, 'w:p')).sort((a, b) => a.start - b.start);
  for (let i = akapity.length - 1; i >= 0; i--) {
    const { start, koniec } = akapity[i];
    if (znaczniki.includes(tekstJawny(wynik.slice(start, koniec)).trim())) {
      wynik = wynik.slice(0, start) + wynik.slice(koniec);
    }
  }
  for (const znacznik of znaczniki) wynik = wynik.split(znacznik).join('');
  return wynik;
}

// ─────────────────────────────────────────────────────────────
// Scalanie rozbitych placeholderów
// ─────────────────────────────────────────────────────────────

const WEZEL_TEKSTU = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;

function scalAkapit(fragment, ostrzezenia) {
  const wezly = [...fragment.matchAll(WEZEL_TEKSTU)];
  if (wezly.length < 2) return fragment;

  const teksty = wezly.map((w) => w[2]);
  const pelny = teksty.join('');
  if (!pelny.includes('{{')) return fragment;

  // Dla każdego znaku scalonego tekstu — z którego węzła pochodzi.
  const zrodlo = new Int32Array(pelny.length);
  let licznik = 0;
  teksty.forEach((tekst, numer) => {
    for (let i = 0; i < tekst.length; i++) zrodlo[licznik++] = numer;
  });

  const cel = Int32Array.from(zrodlo);
  let bylorozbite = false;
  for (const pole of pelny.matchAll(/\{\{[^{}]*\}\}/g)) {
    const pierwszy = zrodlo[pole.index];
    const ostatni = zrodlo[pole.index + pole[0].length - 1];
    if (pierwszy === ostatni) continue;
    bylorozbite = true;
    ostrzezenia.push(
      `Pole ${pole[0]} było rozbite na ${ostatni - pierwszy + 1} fragmenty formatowania — ` +
        'scalono je przy wypełnianiu, ale warto poprawić wzór.'
    );
    for (let i = pole.index; i < pole.index + pole[0].length; i++) cel[i] = pierwszy;
  }
  if (!bylorozbite) return fragment;

  const nowe = teksty.map(() => '');
  for (let i = 0; i < pelny.length; i++) nowe[cel[i]] += pelny[i];

  let wynik = '';
  let poprzedni = 0;
  wezly.forEach((wezel, numer) => {
    wynik += fragment.slice(poprzedni, wezel.index);
    let atrybuty = wezel[1] || '';
    const tekst = nowe[numer];
    if (/^\s|\s$/.test(tekst) && !atrybuty.includes('xml:space')) {
      atrybuty += ' xml:space="preserve"';
    }
    wynik += `<w:t${atrybuty}>${tekst}</w:t>`;
    poprzedni = wezel.index + wezel[0].length;
  });
  return wynik + fragment.slice(poprzedni);
}

/** Scala rozbite pola w całym dokumencie, akapit po akapicie. */
function scalPrzebiegi(xml, ostrzezenia) {
  const akapity = tylkoZewnetrzne(elementy(xml, 'w:p')).sort((a, b) => a.start - b.start);
  let wynik = xml;
  for (let i = akapity.length - 1; i >= 0; i--) {
    const { start, koniec } = akapity[i];
    const scalony = scalAkapit(wynik.slice(start, koniec), ostrzezenia);
    wynik = wynik.slice(0, start) + scalony + wynik.slice(koniec);
  }
  return wynik;
}

// ─────────────────────────────────────────────────────────────
// Podstawianie wartości
// ─────────────────────────────────────────────────────────────

function pobierz(klucz, zakresy) {
  for (const zakres of zakresy) {
    if (zakres && Object.prototype.hasOwnProperty.call(zakres, klucz)) return zakres[klucz];
  }
  return undefined;
}

/**
 * Wartość w postaci nadającej się do wstawienia między `<w:t>` … `</w:t>`.
 * Znak nowej linii staje się złamaniem wiersza Worda — inaczej Word pokazałby
 * spację i wielolinijkowy adres zlałby się w jedną linię.
 */
function wartoscXml(wartosc) {
  return String(wartosc)
    .split(/\r?\n/)
    .map((linia) => esc(linia))
    .join('</w:t><w:br/><w:t xml:space="preserve">');
}

function podstaw(xml, zakresy, kontekst) {
  return xml.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, klucz) => {
    let wartosc = pobierz(klucz, zakresy);

    // „_slownie" rozwiązujemy dopiero wtedy, gdy nie ma klucza wprost o tej
    // nazwie — wzór może mieć własne, gotowe pole tekstowe.
    if (wartosc === undefined && klucz.endsWith('_slownie')) {
      const bazowa = pobierz(klucz.slice(0, -'_slownie'.length), zakresy);
      if (bazowa !== undefined && bazowa !== null && bazowa !== '') {
        const slowa = slownie(bazowa);
        if (slowa == null) {
          kontekst.brakujace.add(`${klucz} (wartość „${bazowa}” nie jest liczbą ani datą)`);
          return ZASLONA_BRAKU;
        }
        return wartoscXml(slowa);
      }
    }

    if (wartosc === undefined || wartosc === null || wartosc === '') {
      kontekst.brakujace.add(klucz);
      return ZASLONA_BRAKU;
    }
    return wartoscXml(wartosc);
  });
}

// ─────────────────────────────────────────────────────────────
// Sekcje
// ─────────────────────────────────────────────────────────────

/** Pozycja znacznika zamykającego, z liczeniem zagnieżdżeń tej samej nazwy. */
function znajdzZamkniecie(xml, nazwa, od) {
  const otwarcie = `{{#${nazwa}}}`;
  const zamkniecie = `{{/${nazwa}}}`;
  let poziom = 1;
  let i = od;
  while (i < xml.length) {
    const nastepneOtwarcie = xml.indexOf(otwarcie, i);
    const nastepneZamkniecie = xml.indexOf(zamkniecie, i);
    if (nastepneZamkniecie === -1) return -1;
    if (nastepneOtwarcie !== -1 && nastepneOtwarcie < nastepneZamkniecie) {
      poziom += 1;
      i = nastepneOtwarcie + otwarcie.length;
      continue;
    }
    poziom -= 1;
    if (poziom === 0) return nastepneZamkniecie;
    i = nastepneZamkniecie + zamkniecie.length;
  }
  return -1;
}

/**
 * Co powtórzyć: tablica → tyle razy, ile pozycji; wartość 0/1, `true`/`false`
 * albo puste → sekcja warunkowa. Klucz nieznany NIE znika po cichu — trafia
 * na listę braków, którą podgląd pokazuje przed wydaniem pisma.
 */
function pozycjeSekcji(nazwa, zakresy, kontekst) {
  const wartosc = pobierz(nazwa, zakresy);
  if (Array.isArray(wartosc)) return wartosc;
  if (wartosc === undefined) {
    kontekst.brakujace.add(`${nazwa} (sekcja)`);
    return [];
  }
  if (wartosc === null || wartosc === false || wartosc === '' || wartosc === 0) return [];
  if (wartosc === true || wartosc === 1) return [{}];
  return [typeof wartosc === 'object' ? wartosc : { wartosc }];
}

function rozwinSekcje(xml, zakresy, kontekst) {
  let wynik = xml;
  for (let obrot = 0; ; obrot++) {
    if (obrot > LIMIT_SEKCJI) {
      kontekst.bledy.push('Wzór ma za dużo sekcji — przerwano, żeby nie zapętlić wypełniania.');
      break;
    }
    const otwarcie = /\{\{#([a-zA-Z0-9_]+)\}\}/.exec(wynik);
    if (!otwarcie) break;

    const nazwa = otwarcie[1];
    const poZnaczniku = otwarcie.index + otwarcie[0].length;
    const pozycjaZamkniecia = znajdzZamkniecie(wynik, nazwa, poZnaczniku);
    if (pozycjaZamkniecia === -1) {
      kontekst.bledy.push(`Sekcja {{#${nazwa}}} nie została zamknięta znacznikiem {{/${nazwa}}}.`);
      // Usuwamy sam znacznik, żeby reszta pisma dała się jeszcze wypełnić.
      wynik = wynik.slice(0, otwarcie.index) + wynik.slice(poZnaczniku);
      continue;
    }
    const dlugoscZamkniecia = `{{/${nazwa}}}`.length;

    const akapity = elementy(wynik, 'w:p');
    const akapitOtwarcia = otaczajacy(akapity, otwarcie.index);
    const akapitZamkniecia = otaczajacy(akapity, pozycjaZamkniecia);

    let przed;
    let jednostka;
    let po;

    if (!akapitOtwarcia || !akapitZamkniecia || akapitOtwarcia.start === akapitZamkniecia.start) {
      // Tryb 1: znaczniki w jednym akapicie — powtarzamy sam tekst pomiędzy.
      przed = wynik.slice(0, otwarcie.index);
      jednostka = wynik.slice(poZnaczniku, pozycjaZamkniecia);
      po = wynik.slice(pozycjaZamkniecia + dlugoscZamkniecia);
    } else {
      const wiersze = elementy(wynik, 'w:tr');
      const wierszOtwarcia = otaczajacy(wiersze, otwarcie.index);
      const wierszZamkniecia = otaczajacy(wiersze, pozycjaZamkniecia);
      if (wierszOtwarcia && wierszZamkniecia && wierszOtwarcia.start === wierszZamkniecia.start) {
        // Tryb 2: jeden wiersz tabeli — jednostką jest cały <w:tr>.
        przed = wynik.slice(0, wierszOtwarcia.start);
        jednostka = usunZnaczniki(wynik.slice(wierszOtwarcia.start, wierszOtwarcia.koniec), nazwa);
        po = wynik.slice(wierszOtwarcia.koniec);
      } else {
        // Tryb 3: osobne akapity — powtarzamy to, co pomiędzy, znaczniki znikają.
        for (const akapit of [akapitOtwarcia, akapitZamkniecia]) {
          const reszta = tekstJawny(wynik.slice(akapit.start, akapit.koniec))
            .replace(/\{\{[#/][a-zA-Z0-9_]+\}\}/g, '')
            .trim();
          if (reszta) {
            kontekst.ostrzezenia.push(
              `W akapicie ze znacznikiem sekcji „${nazwa}" jest też treść („${reszta.slice(0, 40)}") — ` +
                'ten akapit znika w całości. Przenieś treść do środka sekcji.'
            );
          }
        }
        przed = wynik.slice(0, akapitOtwarcia.start);
        jednostka = wynik.slice(akapitOtwarcia.koniec, akapitZamkniecia.start);
        po = wynik.slice(akapitZamkniecia.koniec);
      }
    }

    const srodek = pozycjeSekcji(nazwa, zakresy, kontekst)
      .map((pozycja) =>
        renderujFragment(
          jednostka,
          [pozycja && typeof pozycja === 'object' ? pozycja : { wartosc: pozycja }, ...zakresy],
          kontekst
        )
      )
      .join('');

    wynik = przed + srodek + po;
  }
  return wynik;
}

function renderujFragment(xml, zakresy, kontekst) {
  return podstaw(rozwinSekcje(xml, zakresy, kontekst), zakresy, kontekst);
}

// ─────────────────────────────────────────────────────────────
// Wejście publiczne
// ─────────────────────────────────────────────────────────────

function dokumentXml(bufor) {
  const wpisy = zip.czytaj(bufor);
  const wpis = wpisy.find((w) => w.nazwa === CZESC_DOKUMENTU);
  if (!wpis) {
    throw new Error(`To nie jest plik .docx — brak części „${CZESC_DOKUMENTU}".`);
  }
  return { wpisy, wpis, xml: zip.rozpakuj(wpis).toString('utf8') };
}

/**
 * Wypełnia wzór danymi.
 *
 * @param {Buffer} bufor  zawartość pliku .docx
 * @param {object} dane   słownik kluczy (patrz PLACEHOLDERY-PSA.md)
 * @returns {{ plik: Buffer, brakujace: string[], bledy: string[], ostrzezenia: string[] }}
 */
function wypelnij(bufor, dane = {}) {
  const { wpisy, wpis, xml } = dokumentXml(bufor);
  const kontekst = { brakujace: new Set(), bledy: [], ostrzezenia: [] };
  const scalony = scalPrzebiegi(xml, kontekst.ostrzezenia);
  const wypelniony = renderujFragment(scalony, [dane], kontekst);

  const nowe = wpisy.map((w) =>
    w === wpis ? { ...w, dane: Buffer.from(wypelniony, 'utf8') } : w
  );
  return {
    plik: zip.zapisz(nowe),
    brakujace: [...kontekst.brakujace],
    bledy: kontekst.bledy,
    ostrzezenia: kontekst.ostrzezenia,
  };
}

/**
 * Klucze i sekcje użyte we wzorze — do sprawdzenia przy wgrywaniu pliku
 * i do listy dostępnych pól w edytorze.
 */
function kluczeWzoru(bufor) {
  const { xml } = dokumentXml(bufor);
  const ostrzezenia = [];
  const scalony = scalPrzebiegi(xml, ostrzezenia);
  const sekcje = [...new Set([...scalony.matchAll(/\{\{#([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1]))];
  const proste = [
    ...new Set([...scalony.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1])),
  ];
  const niezamkniete = sekcje.filter(
    (nazwa) =>
      (scalony.split(`{{#${nazwa}}}`).length) !== (scalony.split(`{{/${nazwa}}}`).length)
  );
  return { proste: proste.sort(), sekcje: sekcje.sort(), niezamkniete, ostrzezenia };
}

/** Sam tekst dokumentu — do podglądu i do zapisu treści wydanego pisma. */
function tekst(bufor) {
  const { xml } = dokumentXml(bufor);
  return elementy(xml, 'w:p')
    .sort((a, b) => a.start - b.start)
    .map(({ start, koniec }) =>
      tekstJawny(
        xml
          .slice(start, koniec)
          .replace(/<w:br\s*\/?>/g, '\n')
          .replace(/<w:tab\s*\/?>/g, '\t')
      )
    )
    .map((linia) =>
      linia
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
    )
    .join('\n');
}

module.exports = { wypelnij, kluczeWzoru, tekst, scalPrzebiegi, elementy };
