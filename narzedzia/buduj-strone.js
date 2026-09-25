'use strict';

/**
 * Generator strony publicznej (SEO) — Faza B `SESJA-PSA-STRONA.md` (zastępuje Fazę 5 z
 * `SESJA-PSA-FRONTEND.md`, patrz `frontend-audyt/raporty/faza-strona-plan-a.md`).
 *
 * Statyczny HTML, bez frameworka. JavaScript wyłącznie dla kalkulatora opłat i przyklejonego CTA
 * na telefonie — `strona/js/wzmocnienia.js`, < 3 KB, ulepszenie (strona działa bez niego).
 * Treść prostych podstron w Markdownie (`strona/tresc/*.md`); strona główna, jako gęsto
 * skomponowana z powtarzalnych bloków (karty, kroki, żywy wpis), jest budowana bezpośrednio jako
 * HTML w tym pliku — przepuszczanie jej przez ograniczony konwerter Markdown nie miałoby sensu.
 *
 * Cytaty prawne: `{{c:klucz}}` w źródle Markdown (i bezpośrednio w HTML strony głównej) zamienia
 * się w przycisk `popover`/`popovertarget` z brzmieniem z `strona/przepisy-cytaty.js` (które z
 * kolei pochodzi wyłącznie z `PRZEPISY-PSA.md`) — zero JavaScriptu (natywne HTML Popover API).
 *
 * D-063 (bez zmian): bundel jest osobny od `serwer.js`, wyjście w `strona/dist/`.
 * Użycie: `node narzedzia/buduj-strone.js`. `BASE_URL_STRONA` steruje adresami bezwzględnymi.
 */

const fs = require('node:fs');
const path = require('node:path');

const konfiguracja = require('../server/konfiguracja');
const { db } = require('../server/baza');
const ustawienia = require('../server/logika/ustawienia');
const przepisy = require('../server/logika/przepisy');
const CYTATY = require('../strona/przepisy-cytaty');

const KATALOG = path.join(__dirname, '..', 'strona');
const ZRODLA = path.join(KATALOG, 'tresc');
const WYJSCIE = path.join(KATALOG, 'dist');
const BASE_URL = konfiguracja.BASE_URL_STRONA.replace(/\/+$/, '');
const DZIS = new Date().toISOString().slice(0, 10);

/* ═════════════════════════════════════════════════════
   CYTATY PRAWNE — {{c:klucz}} → przycisk popover, zero JS
   ═════════════════════════════════════════════════════ */

/** `uzyte`, jeśli podane, zbiera klucze do wygenerowania dymków na dole strony (strona główna —
 *  bez przejścia przez `wyciagnijCytaty`/`wstawCytaty` używane dla treści z Markdownu). */
function cyt(klucz, uzyte) {
  if (!CYTATY[klucz]) throw new Error(`Nieznany klucz cytatu: ${klucz}`);
  if (uzyte) uzyte.add(klucz);
  return `<button type="button" class="przypis" popovertarget="wyj-${klucz}">${CYTATY[klucz].ref}</button>`;
}

/** Wyciąga `{{c:klucz}}` z surowego Markdownu na token — wraca po konwersji jako gotowy HTML. */
function wyciagnijCytaty(md) {
  const uzyte = new Set();
  const zamieniony = md.replace(/\{\{c:([\w-]+)\}\}/g, (_, klucz) => {
    if (!CYTATY[klucz]) throw new Error(`Nieznany klucz cytatu: ${klucz}`);
    uzyte.add(klucz);
    return `\u0000CYT:${klucz}\u0000`;
  });
  return { zamieniony, uzyte };
}

function wstawCytaty(html) {
  return html.replace(/\u0000CYT:([\w-]+)\u0000/g, (_, klucz) => cyt(klucz));
}

/** Dymki `popover` dla cytatów użytych na stronie — wstawiane raz, przed `</body>`. */
function dymkiPrzypisow(uzyte) {
  if (!uzyte.size) return '';
  return [...uzyte].map((klucz) => {
    const { ref, tekst } = CYTATY[klucz];
    return `<div id="wyj-${klucz}" popover class="dymek-przepisu"><strong>${ucieczkaHtml(ref)}</strong>${ucieczkaHtml(tekst)}</div>`;
  }).join('\n  ');
}

/* ═════════════════════════════════════════════════════
   KONWERTER MARKDOWN → HTML (podzbiór celowo ograniczony do potrzeb tych stron)
   ═════════════════════════════════════════════════════ */

function ucieczkaHtml(tekst) {
  return String(tekst)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Znaczniki inline: **pogrubienie**, [tekst](adres) — w tej kolejności, bez zagnieżdżeń. */
function inline(tekst) {
  let wynik = ucieczkaHtml(tekst);
  wynik = wynik.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  wynik = wynik.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, adres) => {
    const zewnetrzny = /^https?:\/\//.test(adres);
    const atr = zewnetrzny ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${ucieczkaHtml(adres)}"${atr}>${t}</a>`;
  });
  return wynik;
}

/** Front-matter `klucz: wartość` między liniami `---`, treść po drugiej. */
function rozdziel(tekst) {
  const dopasowanie = tekst.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!dopasowanie) throw new Error('Brak front-matter (--- ... ---) na początku pliku.');
  const metadane = {};
  for (const linia of dopasowanie[1].split('\n')) {
    const i = linia.indexOf(':');
    if (i === -1) continue;
    metadane[linia.slice(0, i).trim()] = linia.slice(i + 1).trim();
  }
  return { metadane, tresc: dopasowanie[2] };
}

function markdownDoHtml(mdOryginalny) {
  const komentarze = [];
  const md = mdOryginalny.replace(/<!--[\s\S]*?-->/g, (dopasowanie) => {
    komentarze.push(dopasowanie);
    return `\n\n\u0000KOMENTARZ${komentarze.length - 1}\u0000\n\n`;
  });
  const linie = md.split('\n');
  const bloki = [];
  let akapit = [];
  let lista = null;
  let cytatBlok = [];

  function zamknijAkapit() {
    if (akapit.length) { bloki.push(`<p>${inline(akapit.join(' '))}</p>`); akapit = []; }
  }
  function zamknijListe() {
    if (lista) { bloki.push(`<ul>${lista.map((p) => `<li>${inline(p)}</li>`).join('')}</ul>`); lista = null; }
  }
  function zamknijCytat() {
    if (cytatBlok.length) { bloki.push(`<blockquote>${cytatBlok.map((p) => `<p>${inline(p)}</p>`).join('')}</blockquote>`); cytatBlok = []; }
  }

  for (const surowa of linie) {
    const linia = surowa.trimEnd();
    if (linia.trim() === '') { zamknijAkapit(); zamknijListe(); zamknijCytat(); continue; }
    const znacznikKomentarza = linia.trim().match(/^\u0000KOMENTARZ(\d+)\u0000$/);
    if (znacznikKomentarza) {
      zamknijAkapit(); zamknijListe(); zamknijCytat();
      bloki.push(komentarze[Number(znacznikKomentarza[1])]);
      continue;
    }
    const naglowek = linia.match(/^(#{1,3})\s+(.*)$/);
    if (naglowek) {
      zamknijAkapit(); zamknijListe(); zamknijCytat();
      const poziom = naglowek[1].length;
      bloki.push(`<h${poziom}>${inline(naglowek[2])}</h${poziom}>`);
      continue;
    }
    const pozycjaListy = linia.match(/^-\s+(.*)$/);
    if (pozycjaListy) {
      zamknijAkapit(); zamknijCytat();
      lista = lista || [];
      lista.push(pozycjaListy[1]);
      continue;
    }
    const liniaCytatu = linia.match(/^>\s?(.*)$/);
    if (liniaCytatu) {
      zamknijAkapit(); zamknijListe();
      cytatBlok.push(liniaCytatu[1]);
      continue;
    }
    if (lista && !akapit.length) {
      lista[lista.length - 1] += ` ${linia.trim()}`;
      continue;
    }
    zamknijListe(); zamknijCytat();
    akapit.push(linia.trim());
  }
  zamknijAkapit(); zamknijListe(); zamknijCytat();
  return bloki.join('\n');
}

/* ═════════════════════════════════════════════════════
   MAPA STRONY (sekcja 5 SESJA-PSA-STRONA.md)
   ═════════════════════════════════════════════════════ */

const STRONY = [
  { slug: 'index', etykieta: 'Strona główna' },
  { slug: 'jak-zaczac', etykieta: 'Jak zacząć' },
  { slug: 'sprzedaz-akcji', etykieta: 'Sprzedaż akcji' },
  { slug: 'przeniesienie-rejestru', etykieta: 'Przeniesienie rejestru' },
  { slug: 'oplaty', etykieta: 'Opłaty' },
  { slug: 'pytania', etykieta: 'Pytania' },
  { slug: 'kontakt', etykieta: 'Kontakt' },
];
const NAWIGACJA_GORNA = ['jak-zaczac', 'oplaty', 'pytania', 'kontakt'];

// Regulamin i polityka prywatności nie dublują treści z portalu (te same dokumenty,
// `publiczne/js/prawne.js`) — stopka tylko do nich linkuje (D-063, „jeden komponent, jedno miejsce”).
const ADRES_REGULAMIN = `${konfiguracja.URL_PORTALU.replace(/portal\.html$/, '')}#/regulamin`;
const ADRES_POLITYKA = `${konfiguracja.URL_PORTALU.replace(/portal\.html$/, '')}#/polityka-prywatnosci`;
const ADRES_PORTAL = konfiguracja.URL_PORTALU;
// Jedyna publiczna, niezalogowana trasa startu wniosku w portalu — `AplikacjaPortal` w portal.js
// (Etap 3A, `segmenty[0] === 'zglos-sie'` → `EkranZgloszenieWstepne`).
const ADRES_WNIOSEK = `${konfiguracja.URL_PORTALU}#/zglos-sie`;

function adresPliku(slug) {
  return slug === 'index' ? `${BASE_URL}/` : `${BASE_URL}/${slug}.html`;
}
function adresWzgledny(slug) {
  return slug === 'index' ? '/' : `/${slug}.html`;
}

function jsonLd(kancelaria) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Notary',
        name: kancelaria.nazwa,
        address: {
          '@type': 'PostalAddress',
          streetAddress: kancelaria.kancelaria_ulica || undefined,
          postalCode: kancelaria.kancelaria_kod || undefined,
          addressLocality: kancelaria.kancelaria_miasto || undefined,
          addressCountry: 'PL',
        },
        telephone: kancelaria.telefon || undefined,
        email: kancelaria.email || undefined,
        url: BASE_URL,
      },
      {
        '@type': 'Service',
        serviceType: 'Prowadzenie rejestru akcjonariuszy prostej spółki akcyjnej',
        provider: { '@type': 'Notary', name: kancelaria.nazwa },
        areaServed: 'PL',
        description: 'Prowadzenie rejestru akcjonariuszy prostej spółki akcyjnej (art. 300³¹ KSH).',
      },
    ],
  };
}

function breadcrumbJsonLd(slug, tytulOkruszka) {
  const pozycje = [{ '@type': 'ListItem', position: 1, name: 'Strona główna', item: adresPliku('index') }];
  if (slug !== 'index') {
    pozycje.push({ '@type': 'ListItem', position: 2, name: tytulOkruszka, item: adresPliku(slug) });
  }
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: pozycje };
}

/* ═════════════════════════════════════════════════════
   SZABLON WSPÓLNY — pasek górny, menu mobilne, stopka, CTA przyklejone
   ═════════════════════════════════════════════════════ */

function szablon({ slug, tytul, opis, html, kancelaria, uzyteCytaty, jestStronaGlowna }) {
  const pasekNav = NAWIGACJA_GORNA.map((s) => {
    const strona = STRONY.find((p) => p.slug === s);
    const aktywna = s === slug ? ' aria-current="page"' : '';
    return `<a href="${adresWzgledny(s)}"${aktywna}>${ucieczkaHtml(strona.etykieta)}</a>`;
  }).join('\n      ');

  const menuMobilnePanel = STRONY.map((s) => {
    const aktywna = s.slug === slug ? ' aria-current="page"' : '';
    return `<a href="${adresWzgledny(s.slug)}"${aktywna}>${ucieczkaHtml(s.etykieta)}</a>`;
  }).join('\n        ');

  const okruszki = slug === 'index'
    ? ''
    : `<nav class="okruszki tresc-szer" aria-label="Okruszki"><a href="/">Strona główna</a><span aria-hidden="true"> › </span><span>${ucieczkaHtml(tytul)}</span></nav>`;

  const ld = [jsonLd(kancelaria), breadcrumbJsonLd(slug, tytul)]
    .map((obiekt) => `<script type="application/ld+json">${JSON.stringify(obiekt)}</script>`)
    .join('\n    ');

  const dymki = dymkiPrzypisow(uzyteCytaty);

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${ucieczkaHtml(tytul)}</title>
  <meta name="description" content="${ucieczkaHtml(opis)}">
  <link rel="canonical" href="${adresPliku(slug)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${ucieczkaHtml(tytul)}">
  <meta property="og:description" content="${ucieczkaHtml(opis)}">
  <meta property="og:url" content="${adresPliku(slug)}">
  <meta property="og:locale" content="pl_PL">
  <link rel="stylesheet" href="/styl.css">
  ${ld}
</head>
<body>
  <a class="pomin" href="#tresc">Przejdź do treści</a>
  <header class="pasek" role="banner">
    <div class="pasek-wew">
      <a class="marka-nazwa" href="/">${ucieczkaHtml(kancelaria.nazwa)}</a>
      <nav class="pasek-nav" aria-label="Nawigacja główna">
        ${pasekNav}
      </nav>
      <div class="pasek-cta">
        <a class="btn btn-cichy" href="${ADRES_PORTAL}">Zaloguj się</a>
        <a class="btn btn-glowny" href="${ADRES_WNIOSEK}">Złóż wniosek</a>
      </div>
      <details class="menu-mobilne">
        <summary aria-label="Menu"></summary>
        <nav class="menu-mobilne-panel" aria-label="Nawigacja mobilna">
          ${menuMobilnePanel}
          <a href="${ADRES_PORTAL}">Zaloguj się</a>
          <a href="${ADRES_WNIOSEK}">Złóż wniosek</a>
        </nav>
      </details>
    </div>
  </header>
  <main id="tresc">
    ${okruszki}
    ${html}
  </main>
  <footer class="stopka" role="contentinfo">
    <div class="tresc-szer stopka-siatka">
      <div><strong>${ucieczkaHtml(kancelaria.nazwa)}</strong></div>
      <div><a href="${ADRES_REGULAMIN}">Regulamin portalu</a> · <a href="${ADRES_POLITYKA}">Polityka prywatności</a></div>
      <div>Stan prawny na: ${DZIS}</div>
    </div>
  </footer>
  ${jestStronaGlowna ? `<div class="cta-przyklejone"><a class="btn btn-glowny" href="${ADRES_WNIOSEK}">Złóż wniosek</a></div>` : ''}
  ${dymki}
  <script src="/wzmocnienia.js" defer></script>
</body>
</html>
`;
}

/* ═════════════════════════════════════════════════════
   STRONA GŁÓWNA — bloki komponowane bezpośrednio (sekcja 6)
   ═════════════════════════════════════════════════════ */

function stronaGlowna(uzyte) {
  const c = (klucz) => cyt(klucz, uzyte);
  return `
  <section class="hero">
    <div class="tresc-szer hero-siatka">
      <div>
        <h1>Rejestr Akcjonariuszy Prostej Spółki Akcyjnej</h1>
        <p class="hero-podtytul">Prowadzimy ten rejestr w Kancelarii Notarialnej Łukasz Kozon. Wniosek, podpisy, wpisy i informacje z rejestru załatwiasz w portalu — bez wizyty w kancelarii.</p>
        <!-- DO WERYFIKACJI: obietnica "bez wizyty w kancelarii" — decyzja STOP A 2026-09-25 (Q-S1), ocena prawna zdalnej identyfikacji AML (P-012) formalnie nadal otwarta w DECYZJE.md -->
        <div class="hero-cta">
          <a class="btn btn-glowny" href="${ADRES_WNIOSEK}">Złóż wniosek</a>
          <a class="btn btn-cichy" href="${ADRES_PORTAL}">Zaloguj się</a>
        </div>
      </div>
      <div class="wpis-karta">
        <span class="wpis-etykieta">Przykład</span>
        <div class="wpis-tytul">Wpis do rejestru akcjonariuszy · <strong>Przykładowa P.S.A.</strong></div>
        <div class="wpis-wiersz" data-animuj="1">
          <div class="wpis-etykieta-wiersza">Akcjonariusz</div>
          <div class="wpis-wartosc">Anna Przykładowa</div>
        </div>
        <div class="wpis-wiersz" data-animuj="2">
          <div class="wpis-etykieta-wiersza">Akcje</div>
          <div class="wpis-wartosc">seria A · nr 1–500 · zwykłe</div>
        </div>
        <div class="wpis-wiersz" data-animuj="3">
          <div class="wpis-etykieta-wiersza">Wpisano</div>
          <div class="wpis-wartosc">25.09.2026, 14:35:07</div>
        </div>
        <div class="wpis-wiersz" data-animuj="4">
          <div class="wpis-etykieta-wiersza">Skrót wpisu</div>
          <div class="wpis-wartosc wpis-skrot">9f3a…c21e → łączy się z poprzednim wpisem</div>
        </div>
        <div class="os-akcji">
          <div class="os-akcji-etykieta">Oś akcji — 1000 akcji w obrocie</div>
          <div class="os-akcji-pasek">
            <div class="os-akcji-odc a">1–500</div>
            <div class="os-akcji-odc b">501–1000</div>
          </div>
          <div class="os-akcji-legenda"><span>Anna Przykładowa</span><span>Jan Przykładowy</span></div>
        </div>
      </div>
    </div>
  </section>

  <section class="fakty">
    <div class="tresc-szer fakty-siatka">
      <div>
        <p class="fakt-liczba">do 7 dni</p>
        <p class="fakt-opis">termin wpisu od otrzymania żądania ${c('300-34-1')}</p>
      </div>
      <div>
        <p class="fakt-liczba">online</p>
        <p class="fakt-opis">wniosek, dokumenty i wpisy przez portal</p>
      </div>
      <div>
        <p class="fakt-liczba">${zlote(przepisy.STAWKI_MAKSYMALNE_GROSZE.PROWADZENIE_ROCZNIE)}</p>
        <p class="fakt-opis">netto rocznie za prowadzenie rejestru <span class="przypis">⚠️ DO WERYFIKACJI</span></p>
      </div>
      <div>
        <p class="fakt-liczba">zawsze</p>
        <p class="fakt-opis">informacja z rejestru na żądanie ${c('300-35-3')}</p>
      </div>
    </div>
  </section>

  <section class="sekcja">
    <div class="tresc-szer">
      <h2>Wybierz swoją sytuację</h2>
      <div class="sytuacje">
        <a class="karta-sytuacji" href="${ADRES_WNIOSEK}">
          <p class="karta-sytuacji-tytul">Spółka jest w KRS i potrzebuje rejestru</p>
          <p class="karta-sytuacji-opis">Złóż wniosek — dane spółki pobierzemy z KRS.</p>
          <span class="karta-sytuacji-strzalka">Złóż wniosek →</span>
        </a>
        <a class="karta-sytuacji" href="/przeniesienie-rejestru.html">
          <p class="karta-sytuacji-tytul">Spółka ma rejestr u innego podmiotu</p>
          <p class="karta-sytuacji-opis">Przeniesienie jest możliwe bez przerwy w prowadzeniu rejestru.</p>
          <span class="karta-sytuacji-strzalka">Jak przenieść rejestr →</span>
        </a>
        <a class="karta-sytuacji" href="/kontakt.html">
          <p class="karta-sytuacji-tytul">Spółka jest dopiero zakładana</p>
          <p class="karta-sytuacji-opis">Wybór kancelarii wymaga uchwały akcjonariuszy zawiązujących spółkę ${c('300-31-5')}.</p>
          <span class="karta-sytuacji-strzalka">Skontaktuj się z kancelarią →</span>
        </a>
        <a class="karta-sytuacji" href="/sprzedaz-akcji.html">
          <p class="karta-sytuacji-tytul">Jestem akcjonariuszem</p>
          <p class="karta-sytuacji-opis">Sprzedajesz akcje albo sprawdzasz swój wpis.</p>
          <span class="karta-sytuacji-strzalka">Zaloguj się →</span>
        </a>
      </div>
    </div>
  </section>

  <section class="sekcja">
    <div class="tresc-szer jak-siatka">
      <div>
        <h2>Jak to działa</h2>
        <div class="kroki">
          <div class="krok">
            <div class="krok-numer">1</div>
            <div>
              <p class="krok-tytul">Uchwała o wyborze kancelarii</p>
              <p class="krok-opis">Akcjonariusze wybierają kancelarię jako podmiot prowadzący rejestr ${c('300-31-5')}.</p>
              <p class="krok-kto">Robi to: spółka</p>
            </div>
          </div>
          <div class="krok">
            <div class="krok-numer">2</div>
            <div>
              <p class="krok-tytul">Wniosek w portalu</p>
              <p class="krok-opis">Dane spółki pobieramy automatycznie z KRS po numerze.</p>
              <p class="krok-kto">Robi to: spółka</p>
            </div>
          </div>
          <div class="krok">
            <div class="krok-numer">3</div>
            <div>
              <p class="krok-tytul">Podpisy</p>
              <p class="krok-opis">Umowa o prowadzenie rejestru ${c('300-32-1')}, uchwała i oświadczenia — podpis własnoręczny, kwalifikowany albo zaufany.</p>
              <p class="krok-kto">Robi to: spółka</p>
            </div>
          </div>
          <div class="krok">
            <div class="krok-numer">4</div>
            <div>
              <p class="krok-tytul">Otwarcie rejestru</p>
              <p class="krok-opis">Dostęp do rejestru pojawia się w portalu.</p>
              <p class="krok-kto">Robi to: kancelaria</p>
            </div>
          </div>
        </div>
        <p><a href="/jak-zaczac.html">Zobacz pełny przebieg →</a></p>
      </div>
      <div class="przygotuj">
        <h3>Co przygotować</h3>
        <ul>
          <li>umowa spółki,</li>
          <li>dane akcjonariuszy,</li>
          <li>adres e-mail spółki.</li>
        </ul>
        <div class="przygotuj-czas">Wypełnienie wniosku zajmuje ok. <strong>[N] minut</strong> <span class="przypis">⚠️ DO WERYFIKACJI — do pomiaru</span>.</div>
      </div>
    </div>
  </section>

  <section class="sekcja">
    <div class="tresc-szer dwie-kolumny">
      <div>
        <h2>Czym jest rejestr</h2>
        <p>Rejestr zawiera dane spółki, każdej emisji akcji i każdego akcjonariusza: kto, ile i jakich akcji posiada, od kiedy i z jakimi ograniczeniami ${c('300-33-1')}.</p>
        <p>Nabycie akcji następuje z chwilą wpisu ${c('300-37-1')}. Wobec spółki akcjonariuszem jest osoba wpisana do rejestru ${c('300-38-1')}.</p>
      </div>
      <div class="mini-os">
        <div class="os-akcji-etykieta">Przykład — 3 akcjonariuszy, 1000 akcji</div>
        <div class="os-akcji-pasek">
          <div class="os-akcji-odc a" style="flex:5">1–500</div>
          <div class="os-akcji-odc b" style="flex:3">501–800</div>
          <div class="os-akcji-odc" style="flex:2;background:var(--rejestr-cien-5);color:var(--atrament)">801–1000</div>
        </div>
      </div>
    </div>
  </section>

  <section class="sekcja">
    <div class="tresc-szer">
      <h2>Co zrobisz w portalu</h2>
      <ul class="lista-czynnosci">
        <li>Złożyć wniosek o prowadzenie rejestru</li>
        <li>Podpisać dokumenty</li>
        <li>Poprosić o nowy wpis</li>
        <li>Zgłosić błąd we wpisie</li>
        <li>Pobrać informację z rejestru</li>
        <li>Zapłacić za prowadzenie rejestru</li>
      </ul>
    </div>
  </section>

  <section class="sekcja">
    <div class="tresc-szer">
      <h2>Opłaty</h2>
      ${tabelaOplat()}
      <p style="color:var(--atrament-2);font-size:14px">Zajęcie komornicze jest wolne od opłat ${c('300-34-2')}. <a href="/oplaty.html">Pełna tabela i kalkulator →</a></p>
    </div>
  </section>

  <section class="sekcja">
    <div class="tresc-szer pytania">
      <h2>Pytania</h2>
      ${faqSzybkie(uzyte)}
      <p style="margin-top:16px"><a href="/pytania.html">Wszystkie pytania →</a></p>
    </div>
  </section>

  <section class="pas-koncowy">
    <div class="tresc-szer">
      <h2>Gotowy, żeby zacząć?</h2>
      <p>Wniosek złożysz w [N] minut. Zajmie się nim kancelaria.</p>
      <a class="btn btn-glowny" href="${ADRES_WNIOSEK}">Złóż wniosek</a>
    </div>
  </section>`;
}

function faqSzybkie(uzyte) {
  const pozycje = [
    ['Czy muszę przyjść do kancelarii?', `Nie — wniosek, dokumenty i wpisy załatwiasz przez portal. <span class="przypis">⚠️ DO WERYFIKACJI</span>`],
    ['Ile kosztuje prowadzenie rejestru?', `${zlote(przepisy.STAWKI_MAKSYMALNE_GROSZE.PROWADZENIE_ROCZNIE)} netto rocznie za prowadzenie, ${zlote(przepisy.STAWKI_MAKSYMALNE_GROSZE.WPIS)} za wpis, ${zlote(przepisy.STAWKI_MAKSYMALNE_GROSZE.INFORMACJA)} za informację z rejestru.`],
    ['Jak szybko dostanę wpis?', `Nie później niż w ciągu 7 dni od żądania ${cyt('300-34-1', uzyte)}.`],
    ['Co przy sprzedaży akcji?', `Zbycie akcji wystarczy dokonać w formie dokumentowej ${cyt('300-36-4', uzyte)}; akcjonariuszem wobec spółki jest osoba wpisana do rejestru ${cyt('300-37-1', uzyte)}.`],
  ];
  return pozycje.map(([pytanie, odp]) => `<details><summary>${pytanie}</summary><p>${odp}</p></details>`).join('\n      ');
}

/* ═════════════════════════════════════════════════════
   URUCHOMIENIE
   ═════════════════════════════════════════════════════ */

function zbuduj() {
  fs.mkdirSync(WYJSCIE, { recursive: true });
  fs.mkdirSync(path.join(WYJSCIE, 'fonty'), { recursive: true });

  for (const plik of ['inter-tight-latin.woff2', 'inter-tight-latin-ext.woff2', 'eb-garamond-latin.woff2', 'eb-garamond-latin-ext.woff2', 'ibm-plex-mono-400-latin.woff2', 'ibm-plex-mono-500-latin.woff2']) {
    fs.copyFileSync(
      path.join(__dirname, '..', 'publiczne', 'fonty', plik),
      path.join(WYJSCIE, 'fonty', plik)
    );
  }
  fs.copyFileSync(path.join(KATALOG, 'styl.css'), path.join(WYJSCIE, 'styl.css'));
  fs.copyFileSync(path.join(KATALOG, 'js', 'wzmocnienia.js'), path.join(WYJSCIE, 'wzmocnienia.js'));

  const kancelaria = ustawienia.kancelaria(db());
  const wpisySitemap = [];

  // Strona główna — komponowana bezpośrednio (bez przejścia przez konwerter Markdown).
  {
    const uzyte = new Set();
    const htmlGlowna = stronaGlowna(uzyte);
    const strona = szablon({
      slug: 'index',
      tytul: 'Rejestr akcjonariuszy prostej spółki akcyjnej — ' + kancelaria.nazwa,
      opis: 'Prowadzenie rejestru akcjonariuszy prostej spółki akcyjnej (P.S.A.) — wniosek, wpisy i informacje z rejestru w portalu. Kancelaria Notarialna Łukasz Kozon.',
      html: htmlGlowna,
      kancelaria,
      uzyteCytaty: uzyte,
      jestStronaGlowna: true,
    });
    fs.writeFileSync(path.join(WYJSCIE, 'index.html'), strona, 'utf8');
    wpisySitemap.push(adresPliku('index'));
    console.log('[buduj-strone] index.html');
  }

  // Podstrony proste — z Markdownu.
  const pliki = fs.readdirSync(ZRODLA).filter((n) => n.endsWith('.md'));
  for (const plik of pliki) {
    const slug = plik.replace(/\.md$/, '');
    const surowy = fs.readFileSync(path.join(ZRODLA, plik), 'utf8');
    const { metadane, tresc } = rozdziel(surowy);
    const { zamieniony, uzyte } = wyciagnijCytaty(tresc);
    let html = markdownDoHtml(zamieniony)
      .replaceAll('PORTAL_URL_TOKEN', ADRES_PORTAL)
      .replaceAll('WNIOSEK_URL_TOKEN', ADRES_WNIOSEK)
      .replaceAll('KANCELARIA_NAZWA_TOKEN', ucieczkaHtml(kancelaria.nazwa))
      .replaceAll('KANCELARIA_TELEFON_TOKEN', ucieczkaHtml(kancelaria.telefon || '—'))
      .replaceAll('KANCELARIA_EMAIL_TOKEN', ucieczkaHtml(kancelaria.email || '—'))
      .replaceAll(
        'KANCELARIA_ADRES_TOKEN',
        ucieczkaHtml([kancelaria.kancelaria_ulica, [kancelaria.kancelaria_kod, kancelaria.kancelaria_miasto].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—')
      );
    if (slug === 'oplaty') html = html.replace('<!-- TABELA_OPLAT -->', tabelaOplat() + kalkulatorOplat());
    if (slug === 'pytania') html = html.replace('<!-- FAQ_PELNE -->', faqPelne(uzyte));
    html = wstawCytaty(html);
    const strona = szablon({
      slug,
      tytul: metadane.title,
      opis: metadane.description,
      html,
      kancelaria,
      uzyteCytaty: uzyte,
      jestStronaGlowna: false,
    });
    const nazwaPliku = `${slug}.html`;
    fs.writeFileSync(path.join(WYJSCIE, nazwaPliku), strona, 'utf8');
    wpisySitemap.push(adresPliku(slug));
    console.log(`[buduj-strone] ${nazwaPliku}`);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${wpisySitemap.map((a) => `  <url><loc>${a}</loc><lastmod>${DZIS}</lastmod></url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(WYJSCIE, 'sitemap.xml'), sitemap, 'utf8');
  fs.writeFileSync(
    path.join(WYJSCIE, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`,
    'utf8'
  );
  console.log(`[buduj-strone] sitemap.xml, robots.txt (BASE_URL_STRONA=${BASE_URL})`);
}

/** /oplaty — tabela netto/VAT/brutto generowana z przepisy.js (5.2), nie wpisana ręcznie. */
function zlote(grosze) {
  return (Number(grosze) / 100).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 });
}

function tabelaOplat() {
  const wiersz = (etykieta, netto) => {
    const brutto = przepisy.obliczBrutto(netto, przepisy.STAWKA_VAT_PROCENT);
    return `<tr><td>${etykieta}</td><td class="prawo">${zlote(netto)}</td>` +
      `<td class="prawo">${przepisy.STAWKA_VAT_PROCENT}%</td><td class="prawo">${zlote(brutto)}</td></tr>`;
  };
  return `<div class="tabela-wrap" tabindex="0" role="region" aria-label="Tabela opłat, przewijana w poziomie"><table class="tabela-oplat">
  <caption class="pomin">Stawki maksymalne wg rozporządzenia, ⚠️ DO WERYFIKACJI</caption>
  <thead><tr><th>Czynność</th><th class="prawo">Netto</th><th class="prawo">VAT</th><th class="prawo">Brutto</th></tr></thead>
  <tbody>
    ${wiersz('Prowadzenie rejestru — za każdy rozpoczęty rok', przepisy.STAWKI_MAKSYMALNE_GROSZE.PROWADZENIE_ROCZNIE)}
    ${wiersz('Wpis w rejestrze', przepisy.STAWKI_MAKSYMALNE_GROSZE.WPIS)}
    ${wiersz('Informacja z rejestru', przepisy.STAWKI_MAKSYMALNE_GROSZE.INFORMACJA)}
  </tbody>
</table></div>`;
}

function kalkulatorOplat() {
  const s = przepisy.STAWKI_MAKSYMALNE_GROSZE;
  return `<div class="kalkulator" hidden data-prowadzenie="${s.PROWADZENIE_ROCZNIE}" data-wpis="${s.WPIS}" data-informacja="${s.INFORMACJA}" data-vat="${przepisy.STAWKA_VAT_PROCENT}">
  <h2>Policz roczny koszt</h2>
  <div class="kalkulator-pole"><label for="kalk-wpisy">Wpisów w roku</label><input type="number" id="kalk-wpisy" min="0" value="1" inputmode="numeric"></div>
  <div class="kalkulator-pole"><label for="kalk-informacje">Informacji z rejestru w roku</label><input type="number" id="kalk-informacje" min="0" value="0" inputmode="numeric"></div>
  <div class="kalkulator-wynik">Razem brutto: <strong>—</strong></div>
</div>`;
}

function faqPelne(uzyte) {
  const pozycje = [
    ['Czy muszę przyjść do kancelarii?', `Nie — wniosek, dokumenty i wpisy załatwiasz przez portal. <span class="przypis">⚠️ DO WERYFIKACJI</span>`],
    ['Ile kosztuje prowadzenie rejestru?', `${zlote(przepisy.STAWKI_MAKSYMALNE_GROSZE.PROWADZENIE_ROCZNIE)} netto rocznie za prowadzenie, ${zlote(przepisy.STAWKI_MAKSYMALNE_GROSZE.WPIS)} za wpis, ${zlote(przepisy.STAWKI_MAKSYMALNE_GROSZE.INFORMACJA)} za informację z rejestru. <span class="przypis">⚠️ DO WERYFIKACJI</span>`],
    ['Jak szybko dostanę wpis?', `Nie później niż w ciągu 7 dni od żądania. Jeżeli wpis wymaga usunięcia przeszkody — w terminie siedmiu dni od jej usunięcia. ${cyt('300-34-1', uzyte)}`],
    ['Co przy sprzedaży akcji?', `Zbycie akcji wystarczy dokonać w formie dokumentowej ${cyt('300-36-4', uzyte)}; nabywca staje się akcjonariuszem z chwilą wpisu ${cyt('300-37-1', uzyte)}.`],
    ['Czy mogę przenieść rejestr do innej kancelarii?', `Tak, pod warunkiem zawarcia nowej umowy przed rozwiązaniem obecnej ${cyt('300-32-2', uzyte)}. Więcej: <a href="/przeniesienie-rejestru.html">przeniesienie rejestru</a>.`],
    ['Kto ma dostęp do danych w rejestrze?', `Spółka i każdy akcjonariusz, za pośrednictwem kancelarii ${cyt('300-35-1-3', uzyte)}.`],
  ];
  return pozycje.map(([pytanie, odp]) => `<details><summary>${pytanie}</summary><p>${odp}</p></details>`).join('\n  ');
}

zbuduj();
