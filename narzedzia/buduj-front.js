#!/usr/bin/env node
'use strict';

/**
 * Budowanie warstwy klienta (D-046).
 *
 * Do FAZY 1 sesji frontendowej JSX kompilował się w przeglądarce
 * (`vendor/babel.min.js`, 2,98 MB — ok. 2/3 transferu strony logowania i
 * 1,6 s czystego CPU przy każdym wejściu). Teraz kompiluje go `esbuild` przy
 * budowaniu, a przeglądarka dostaje dwa gotowe pliki:
 *
 *   publiczne/dist/kancelaria.js — aplikacja kancelarii (index.html)
 *   publiczne/dist/portal.js     — portal klienta (portal.html)
 *
 * Pliki źródłowe zostają zwykłymi skryptami o wspólnym zasięgu globalnym —
 * sklejamy je w kolejności z list niżej, tak jak wcześniej ładowały je po
 * kolei znaczniki `<script>`. Nazwy najwyższego poziomu nie są skracane
 * (tryb `transform` bez `format`), więc `window.X` i odwołania między
 * plikami działają bez zmian.
 *
 * Wynik jest w repozytorium: serwer produkcyjny nie potrzebuje `esbuild`
 * (zależność deweloperska). Test `testy/front-js.test.js` pilnuje, żeby
 * zbudowane pliki odpowiadały źródłom.
 *
 *   node narzedzia/buduj-front.js            — buduje
 *   node narzedzia/buduj-front.js --sprawdz  — tylko porównuje (kod 1 = nieaktualne)
 *   node narzedzia/buduj-front.js --obserwuj — przebudowuje po każdej zmianie
 *   node narzedzia/buduj-front.js --dev      — jak --obserwuj, plus serwer z `node --watch`
 *                                              (`npm run dev`; bez `&` w skrypcie npm — działa też na Windows)
 */

const fs = require('node:fs');
const path = require('node:path');

const KATALOG = path.join(__dirname, '..', 'publiczne');
const ZRODLA = path.join(KATALOG, 'js');
const WYJSCIE = path.join(KATALOG, 'dist');

/** Kolejność ma znaczenie: późniejszy plik korzysta z nazw wcześniejszych. */
const PACZKI = {
  'kancelaria.js': [
    'rdzen.js', 'formaty.js', 'ui-rejestr.js', 'kraje.js', 'pola.js', 'prawne.js', 'pesel.js', 'formularz-osoby.js',
    'podglad.js', 'pulpit.js', 'osoby.js', 'zgloszenia.js', 'wnioski.js', 'zawiadomienia.js', 'spolki.js',
    'dokumenty-na-zadanie.js', 'kokpit.js', 'kreator.js', 'sprawy.js', 'wydruk.js', 'konfiguracja.js',
    'szablony.js', 'auth.js', 'uzytkownicy.js', 'oplaty.js', 'migracja.js', 'app.js',
  ],
  'portal.js': [
    'rdzen.js', 'formaty.js', 'ui-rejestr.js', 'kraje.js', 'pola.js', 'prawne.js', 'pesel.js', 'formularz-osoby.js',
    'wniosek.js', 'portal.js',
  ],
};

function esbuild() {
  try {
    return require('esbuild');
  } catch {
    return null;
  }
}

/** Kod paczki z istniejących plików (brakujący plik z listy = błąd budowania). */
function sklej(pliki) {
  return pliki
    .map((nazwa) => `/* ── ${nazwa} ── */\n${fs.readFileSync(path.join(ZRODLA, nazwa), 'utf8')}`)
    .join('\n;\n');
}

function zbuduj(eb, nazwa) {
  const wynik = eb.transformSync(sklej(PACZKI[nazwa]), {
    loader: 'jsx',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    minify: !process.env.BEZ_MINIFIKACJI,
    target: 'es2020',
    charset: 'utf8',
    legalComments: 'none',
    sourcefile: nazwa,
  });
  return wynik.code;
}

function main() {
  const tryb = process.argv[2] || '';
  const eb = esbuild();
  if (!eb) {
    const sa = Object.keys(PACZKI).every((n) => fs.existsSync(path.join(WYJSCIE, n)));
    if (sa && tryb !== '--sprawdz') {
      console.log('[buduj-front] brak esbuild (zależność deweloperska) — zostają zbudowane pliki z repozytorium.');
      return;
    }
    console.error('[buduj-front] brak esbuild — uruchom `npm install` (z zależnościami deweloperskimi).');
    process.exit(1);
  }

  if (tryb === '--sprawdz') {
    const nieaktualne = Object.keys(PACZKI).filter((n) => {
      const plik = path.join(WYJSCIE, n);
      return !fs.existsSync(plik) || fs.readFileSync(plik, 'utf8') !== zbuduj(eb, n);
    });
    if (nieaktualne.length) {
      console.error(`[buduj-front] nieaktualne: ${nieaktualne.join(', ')} — uruchom \`npm run buduj\`.`);
      process.exit(1);
    }
    console.log('[buduj-front] zbudowane pliki aktualne.');
    return;
  }

  const buduj = () => {
    fs.mkdirSync(WYJSCIE, { recursive: true });
    for (const nazwa of Object.keys(PACZKI)) {
      const kod = zbuduj(eb, nazwa);
      fs.writeFileSync(path.join(WYJSCIE, nazwa), kod);
      console.log(`[buduj-front] ${nazwa}: ${(Buffer.byteLength(kod) / 1024).toFixed(0)} KB`);
    }
  };

  buduj();
  if (tryb === '--dev') {
    // eslint-disable-next-line global-require
    const serwer = require('node:child_process').spawn(process.execPath, ['--watch', path.join(__dirname, '..', 'serwer.js')], { stdio: 'inherit' });
    serwer.on('exit', (kod) => process.exit(kod ?? 0));
  }
  if (tryb === '--obserwuj' || tryb === '--dev') {
    let uchwyt = null;
    fs.watch(ZRODLA, () => {
      clearTimeout(uchwyt);
      uchwyt = setTimeout(() => {
        try { buduj(); } catch (e) { console.error(`[buduj-front] ${e.message}`); }
      }, 100);
    });
    console.log('[buduj-front] obserwuję publiczne/js…');
  }
}

if (require.main === module) main();

module.exports = { PACZKI, zbuduj, esbuild };
