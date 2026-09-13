'use strict';

/**
 * Statyczne sprawdzenie plików z `publiczne/js/`.
 *
 * Aplikacja nie ma bundlera: pliki idą do przeglądarki jako
 * `<script type="text/babel">` i kompilują się dopiero tam. Błąd składni albo
 * literówka w nazwie komponentu nie odzywa się więc w żadnym teście — wywala
 * render CAŁEGO ekranu i użytkownik dostaje pustą stronę. Tak właśnie zniknął
 * ekran „Stawki i terminy": korzystał z komponentu `Para`, którego nikt nigdy
 * nie zdefiniował.
 *
 * Dwa sprawdzenia, oba na tej samej wersji Babela, którą ładuje przeglądarka:
 *   1. każdy plik daje się skompilować,
 *   2. każdy komponent użyty w JSX jest gdziekolwiek zdefiniowany.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const KATALOG_JS = path.join(__dirname, '..', 'publiczne', 'js');
const BABEL = path.join(__dirname, '..', 'publiczne', 'vendor', 'babel.min.js');

const pliki = fs.readdirSync(KATALOG_JS).filter((p) => p.endsWith('.js')).sort();
const zrodla = new Map(pliki.map((p) => [p, fs.readFileSync(path.join(KATALOG_JS, p), 'utf8')]));

function wczytajBabel() {
  const kontekst = vm.createContext({ console, process, setTimeout, clearTimeout });
  kontekst.window = kontekst;
  kontekst.self = kontekst;
  kontekst.global = kontekst;
  vm.runInContext(fs.readFileSync(BABEL, 'utf8'), kontekst, { filename: 'babel.min.js' });
  return kontekst.Babel;
}

test('publiczne/js: każdy plik kompiluje się Babelem z /vendor', () => {
  const Babel = wczytajBabel();
  assert.ok(Babel, 'Babel z /vendor wczytany');
  for (const [nazwa, kod] of zrodla) {
    assert.doesNotThrow(
      () => Babel.transform(kod, { presets: ['react'], filename: nazwa }),
      new RegExp('.'),
      `plik ${nazwa} nie kompiluje się`
    );
  }
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
