#!/usr/bin/env node
'use strict';

/**
 * Generuje `testy-audyt/endpointy-api.md` przez introspekcję REALNYCH
 * routerów Express (nie z lektury kodu) — dla każdego pliku `server/trasy/*.js`
 * eksportującego router, wypisuje jego trasy w kolejności rejestracji, razem
 * z nazwami funkcji pośredniczących (middleware) zarejestrowanych PRZED
 * daną trasą w tym samym routerze.
 *
 * Świadome ograniczenie: nie rekonstruuje pełnej narracji (np. które
 * middleware jest "bramką" a które efektem ubocznym) — to mechaniczny,
 * zawsze aktualny szkielet. Ręczna, opisowa wersja z audytu funkcjonalnego
 * (kontekst przeznaczenia per trasa) zostaje w historii git tego pliku.
 *
 * Część `npm run dokumentacja` (README, sekcja "Dokumentacja").
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Baza tymczasowa — ten skrypt NIGDY nie dotyka `dane/kancelaria.db`.
process.env.WSPOLNA_BAZA = path.join(os.tmpdir(), `psa-dokumentacja-${process.pid}.db`);
process.env.SESJA_SEKRET = 'dokumentacja-tymczasowy-sekret';
process.env.ADMIN_EMAIL = 'dokumentacja@lokalny.test';

// Mapa mountowania — musi być zgodna z `serwer.js`. Aktualizować ręcznie,
// jeśli `serwer.js` doda/zmieni punkt montowania (skrypt to tylko odzwierciedla,
// nie odczytuje `serwer.js` programowo — AST byłoby kruche na zmiany stylu).
const MOUNTY = [
  { prefiks: '/api/wspolne', plik: 'wspolne', gateMount: null },
  { prefiks: '/api/psa/auth', plik: 'auth', gateMount: null },
  { prefiks: '/api/psa/platnosci', plik: 'platnosci', gateMount: null },
  { prefiks: '/api/psa/portal', plik: 'portal', gateMount: '(warunkowe: PORTAL_WLACZONY, inaczej 503 na całej ścieżce)' },
  { prefiks: '/api/psa/spolki', plik: 'spolki', gateMount: 'wymagajPracownika' },
  { prefiks: '/api/psa/osoby', plik: 'osoby', gateMount: 'wymagajPracownika' },
  { prefiks: '/api/psa/sprawy', plik: 'sprawy', gateMount: 'wymagajPracownika' },
  { prefiks: '/api/psa/zdarzenia', plik: 'zdarzenia', gateMount: 'wymagajPracownika' },
  { prefiks: '/api/psa/oplaty', plik: 'oplaty', gateMount: 'wymagajPracownika' },
  { prefiks: '/api/psa/szablony', plik: 'szablony', gateMount: 'wymagajPracownika' },
  { prefiks: '/api/psa/zgloszenia', plik: 'zgloszenia', gateMount: 'wymagajPracownika' },
  { prefiks: '/api/psa/wnioski', plik: 'wnioski', gateMount: 'wymagajPracownika' },
  { prefiks: '/api/psa/zawiadomienia', plik: 'zawiadomienia', gateMount: 'wymagajPracownika' },
  { prefiks: '/api/psa', plik: 'pozostale', gateMount: null },
];

function nazwyWarstwy(stackWpisu) {
  // `layer.name` dla funkcji nazwanych (np. `function wymagajAdmina(...)`),
  // '<anonymous>' dla strzałek bez nazwy, 'bound dispatch' dla samej trasy.
  return stackWpisu
    .map((l) => l.name)
    .filter((n) => n && n !== 'bound dispatch');
}

function opiszRouter(nazwaPliku) {
  let modul;
  try {
    modul = require(path.join(__dirname, '..', 'server', 'trasy', nazwaPliku));
  } catch (e) {
    return { blad: `Nie udało się wczytać: ${e.message}` };
  }
  if (!modul || typeof modul.stack === 'undefined' || !Array.isArray(modul.stack)) {
    return { modulLogiki: true };
  }

  const wpisy = [];
  for (const warstwa of modul.stack) {
    if (warstwa.route) {
      const sciezka = warstwa.route.path;
      const metody = Object.keys(warstwa.route.methods)
        .filter((m) => warstwa.route.methods[m])
        .map((m) => m.toUpperCase());
      const middleware = nazwyWarstwy(warstwa.route.stack.slice(0, -1));
      wpisy.push({ typ: 'trasa', metody, sciezka, middleware });
    } else if (warstwa.name && warstwa.name !== 'query' && warstwa.name !== 'expressInit') {
      // `router.use(nazwanaFunkcja)` w połowie pliku — traktujemy jako bramkę
      // obejmującą wszystko poniżej w tym samym routerze.
      wpisy.push({ typ: 'use', nazwa: warstwa.name });
    }
  }
  return { wpisy };
}

const sekcje = [];
sekcje.push('# Endpointy API — wygenerowane automatycznie\n');
sekcje.push(
  '> Wygenerowane przez `narzedzia/dokumentacja-endpointy.js` (introspekcja żywych routerów ' +
    'Express, nie lektura kodu) — `npm run dokumentacja`. Kolejność wierszy odzwierciedla ' +
    'kolejność rejestracji w pliku źródłowym; wiersz „router.use(X)” oznacza bramkę/middleware ' +
    'obejmujące wszystkie trasy PONIŻEJ niego w tym samym pliku.\n'
);

for (const { prefiks, plik, gateMount } of MOUNTY) {
  const wynik = opiszRouter(plik);
  sekcje.push(`## \`server/trasy/${plik}.js\` → mount \`${prefiks}\`` + (gateMount ? ` (${gateMount})` : ' (bez bramki na poziomie mountu)'));
  if (wynik.blad) {
    sekcje.push(`\n⚠️ ${wynik.blad}\n`);
    continue;
  }
  if (wynik.modulLogiki) {
    sekcje.push('\n_Nie jest routerem Express — moduł logiki, brak własnych endpointów._\n');
    continue;
  }
  sekcje.push('');
  sekcje.push('| # | Metoda i ścieżka | Middleware w trasie |');
  sekcje.push('|---|---|---|');
  let licznik = 0;
  for (const wpis of wynik.wpisy) {
    if (wpis.typ === 'use') {
      sekcje.push(`| | **router.use(\`${wpis.nazwa}\`)** — od tego miejsca w dół | — |`);
      continue;
    }
    licznik += 1;
    const sciezkaPelna = (prefiks + wpis.sciezka).replace(/\/$/, '') || '/';
    sekcje.push(
      `| ${licznik} | \`${wpis.metody.join('/')} ${sciezkaPelna}\` | ${wpis.middleware.length ? wpis.middleware.join(', ') : '—'} |`
    );
  }
  sekcje.push('');
}

const cel = path.join(__dirname, '..', 'testy-audyt', 'endpointy-api.md');
fs.writeFileSync(cel, sekcje.join('\n'));
console.log(`[dokumentacja] zapisano ${cel}`);

// Sprzątnięcie tymczasowej bazy.
try {
  fs.unlinkSync(process.env.WSPOLNA_BAZA);
} catch {
  /* mogła nie powstać, jeśli żaden router jej nie dotknął */
}
