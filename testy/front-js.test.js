'use strict';

/**
 * Statyczne sprawdzenie plików z `publiczne/js/`.
 *
 * Pliki idą do przeglądarki sklejone w dwie paczki (`publiczne/dist/`,
 * `narzedzia/buduj-front.js`, D-046). Błąd składni albo literówka w nazwie
 * komponentu nie odzywa się w żadnym teście serwera — wywala render CAŁEGO
 * ekranu i użytkownik dostaje pustą stronę. Tak właśnie zniknął ekran
 * „Stawki i terminy": korzystał z komponentu `Para`, którego nikt nigdy
 * nie zdefiniował.
 *
 * Sprawdzenia:
 *   1. każdy plik daje się skompilować tym samym `esbuild`, który buduje paczki,
 *   2. każdy komponent użyty w JSX jest gdziekolwiek zdefiniowany,
 *   3. zbudowane paczki w repozytorium odpowiadają źródłom,
 *   4. każdy plik z `publiczne/js` trafia do którejś paczki.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const budowanie = require('../narzedzia/buduj-front.js');

const KATALOG_JS = path.join(__dirname, '..', 'publiczne', 'js');
const KATALOG_DIST = path.join(__dirname, '..', 'publiczne', 'dist');

const pliki = fs.readdirSync(KATALOG_JS).filter((p) => p.endsWith('.js')).sort();
const zrodla = new Map(pliki.map((p) => [p, fs.readFileSync(path.join(KATALOG_JS, p), 'utf8')]));
const esbuild = budowanie.esbuild();

test('publiczne/js: każdy plik kompiluje się esbuildem (JSX)', { skip: !esbuild && 'brak esbuild (npm install)' }, () => {
  for (const [nazwa, kod] of zrodla) {
    assert.doesNotThrow(
      () => esbuild.transformSync(kod, { loader: 'jsx', sourcefile: nazwa }),
      new RegExp('.'),
      `plik ${nazwa} nie kompiluje się`
    );
  }
});

test('publiczne/dist: zbudowane paczki odpowiadają źródłom (`npm run buduj`)', { skip: !esbuild && 'brak esbuild (npm install)' }, () => {
  for (const nazwa of Object.keys(budowanie.PACZKI)) {
    const plik = path.join(KATALOG_DIST, nazwa);
    assert.ok(fs.existsSync(plik), `brak ${nazwa} — uruchom npm run buduj`);
    assert.equal(fs.readFileSync(plik, 'utf8'), budowanie.zbuduj(esbuild, nazwa), `${nazwa} nieaktualna — uruchom npm run buduj`);
  }
});

test('publiczne/js: każdy plik należy do którejś paczki', () => {
  const w = new Set(Object.values(budowanie.PACZKI).flat());
  assert.deepEqual(pliki.filter((p) => !w.has(p)), []);
});

/* Nazwy dostępne bez definicji w `publiczne/js` — globalne obiekty przeglądarki
   i biblioteki ładowane z `/vendor` przed naszymi plikami. */
const ZNANE_GLOBALNE = new Set(['React', 'ReactDOM', 'Fragment', 'Math', 'Object', 'Number', 'String',
  'Array', 'JSON', 'Date', 'Boolean', 'Promise', 'Map', 'Set', 'Intl', 'FormData', 'Blob', 'URL']);

/** Nazwy zdefiniowane gdziekolwiek w warstwie klienta (globalny zasięg skryptów). */
function zebranieDefinicji() {
  const nazwy = new Set(ZNANE_GLOBALNE);
  for (const kod of zrodla.values()) {
    // Wcięcie jest dopuszczone: komponent bywa wybierany do zmiennej lokalnej
    // (`const KrokTresci = KROKI_TRESCI[...]`) i renderowany jako `<KrokTresci>`.
    for (const dopasowanie of kod.matchAll(/^\s*(?:function|class)\s+([A-Z]\w*)/gm)) nazwy.add(dopasowanie[1]);
    for (const dopasowanie of kod.matchAll(/^\s*(?:const|let|var)\s+([A-Z]\w*)\s*=/gm)) nazwy.add(dopasowanie[1]);
    for (const dopasowanie of kod.matchAll(/^window\.([A-Z]\w*)\s*=/gm)) nazwy.add(dopasowanie[1]);
  }
  return nazwy;
}

test('publiczne/js: każdy komponent użyty w JSX jest zdefiniowany', () => {
  const zdefiniowane = zebranieDefinicji();
  const brakujace = [];

  for (const [nazwa, kod] of zrodla) {
    // Komponent w JSX: `<Nazwa` z wielkiej litery. Znaczniki HTML zaczynają
    // się z małej, więc odpadają same; `<Nazwa.Coś>` sprowadzamy do `Nazwa`.
    for (const dopasowanie of kod.matchAll(/<([A-Z]\w*)[\s/>.]/g)) {
      const uzyty = dopasowanie[1];
      if (!zdefiniowane.has(uzyty)) brakujace.push(`${nazwa}: <${uzyty}>`);
    }
  }

  assert.deepEqual(
    [...new Set(brakujace)],
    [],
    'komponenty użyte w JSX, których nikt nie definiuje — w przeglądarce dadzą pustą stronę'
  );
});

/* Wyjątki od sprawdzenia paczek: komponent kancelarii użyty w pliku wspólnym
   w gałęzi, która w portalu nigdy się nie renderuje (wybór z kartoteki
   kancelarii zakłada nową osobę panelem kartoteki). */
const TYLKO_W_KANCELARII = new Set(['PanelOsoby']);

test('publiczne/dist: każda paczka definiuje komponenty, których używają jej pliki', () => {
  for (const [paczka, lista] of Object.entries(budowanie.PACZKI)) {
    const definicje = new Set(ZNANE_GLOBALNE);
    for (const nazwa of lista) {
      const kod = zrodla.get(nazwa) || '';
      for (const d of kod.matchAll(/^\s*(?:function|class)\s+([A-Z]\w*)/gm)) definicje.add(d[1]);
      for (const d of kod.matchAll(/^\s*(?:const|let|var)\s+([A-Z]\w*)\s*=/gm)) definicje.add(d[1]);
    }
    const brakujace = new Set();
    for (const nazwa of lista) {
      for (const d of (zrodla.get(nazwa) || '').matchAll(/<([A-Z]\w*)[\s/>.]/g)) {
        if (!definicje.has(d[1]) && !(paczka === 'portal.js' && TYLKO_W_KANCELARII.has(d[1]))) brakujace.add(`${nazwa}: <${d[1]}>`);
      }
    }
    assert.deepEqual([...brakujace], [], `paczka ${paczka}`);
  }
});
