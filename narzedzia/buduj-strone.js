'use strict';

/**
 * Generator strony publicznej (SEO) — FAZA 5 sesji frontendowej.
 *
 * Statyczny HTML, bez frameworka i bez JavaScriptu (sekcja 5.3): szablony
 * tutaj, treść w Markdownie w `strona/tresc/*.md`. Żadnej biblioteki
 * Markdown — sekcja 13/„Czego NIE robić" zabrania nowych zależności
 * (poza esbuild/axe-core/lighthouse, deweloperskimi), więc konwerter niżej
 * jest własny i celowo obsługuje tylko to, czego te strony potrzebują:
 * nagłówki #/##/###, akapity, **pogrubienie**, [odnośniki](adres), listy
 * `- pozycja` i cytaty `> `.
 *
 * D-063: ten bundel jest CAŁKOWICIE osobny od `serwer.js` (który serwuje
 * aplikację kancelarii pod `/` i nie ma miejsca na stronę publiczną bez
 * przepięcia jej adresu — poza zakresem tej fazy). Wyjście trafia do
 * `strona/dist/` i nie jest przez `serwer.js` serwowane w tej sesji.
 *
 * Użycie: `node narzedzia/buduj-strone.js`. Zmienna środowiskowa
 * `BASE_URL_STRONA` (patrz `server/konfiguracja.js`) steruje adresami
 * bezwzględnymi (canonical, Open Graph, sitemap, JSON-LD).
 */

const fs = require('node:fs');
const path = require('node:path');

const konfiguracja = require('../server/konfiguracja');
const { db } = require('../server/baza');
const ustawienia = require('../server/logika/ustawienia');
const przepisy = require('../server/logika/przepisy');

const KATALOG = path.join(__dirname, '..', 'strona');
const ZRODLA = path.join(KATALOG, 'tresc');
const WYJSCIE = path.join(KATALOG, 'dist');
const BASE_URL = konfiguracja.BASE_URL_STRONA.replace(/\/+$/, '');
const DZIS = new Date().toISOString().slice(0, 10);

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
  // Znaczniki „DO WERYFIKACJI" (sekcja 5.1) bywają wieloliniowe — wyciągamy
  // je PRZED podziałem na linie (dotall), żeby jeden blok komentarza nie
  // rozpadł się na fragmenty niedopasowane do wzorca linia-po-linii. Wracają
  // do treści jako prawdziwe komentarze HTML (niewidoczne po wyrenderowaniu,
  // czytelne w źródle), przez podstawienie znacznika.
  const komentarze = [];
  const md = mdOryginalny.replace(/<!--[\s\S]*?-->/g, (dopasowanie) => {
    komentarze.push(dopasowanie);
    return `\n\n\u0000KOMENTARZ${komentarze.length - 1}\u0000\n\n`;
  });
  const linie = md.split('\n');
  const bloki = [];
  let akapit = [];
  let lista = null;
  let cytat = [];

  function zamknijAkapit() {
    if (akapit.length) { bloki.push(`<p>${inline(akapit.join(' '))}</p>`); akapit = []; }
  }
  function zamknijListe() {
    if (lista) { bloki.push(`<ul>${lista.map((p) => `<li>${inline(p)}</li>`).join('')}</ul>`); lista = null; }
  }
  function zamknijCytat() {
    if (cytat.length) { bloki.push(`<blockquote>${cytat.map((p) => `<p>${inline(p)}</p>`).join('')}</blockquote>`); cytat = []; }
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
      cytat.push(liniaCytatu[1]);
      continue;
    }
    // Kontynuacja zawiniętej linii: tekst bez własnego znacznika tuż po
    // pozycji listy dopisuje się do NIEJ (tak zawijają się długie pozycje
    // list w treściach tych stron), a nie zaczyna nowego akapitu.
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
   NAWIGACJA I SZABLON
   ═════════════════════════════════════════════════════ */

const STRONY = [
  { slug: 'index', etykieta: 'Strona główna' },
  { slug: 'czym-jest-rejestr-akcjonariuszy', etykieta: 'Czym jest rejestr' },
  { slug: 'jak-to-dziala', etykieta: 'Jak to działa' },
  { slug: 'oplaty', etykieta: 'Opłaty' },
  { slug: 'zbycie-akcji-i-wpisy', etykieta: 'Zbycie akcji i wpisy' },
  { slug: 'zmiana-podmiotu-prowadzacego-rejestr', etykieta: 'Zmiana podmiotu prowadzącego' },
  { slug: 'nowelizacja-2027', etykieta: 'Nowelizacja 2027' },
  { slug: 'pytania', etykieta: 'Pytania' },
  { slug: 'kontakt', etykieta: 'Kontakt' },
];
// Regulamin i polityka prywatności nie dublują treści z portalu (te same
// dokumenty, `publiczne/js/prawne.js`) — strona publiczna tylko do nich
// linkuje spod stopki, zgodnie z zasadą „jeden komponent, jedno miejsce"
// zastosowaną tu do treści prawnych porządkowych (nie merytorycznych).
const ADRES_REGULAMIN = `${konfiguracja.URL_PORTALU.replace(/portal\.html$/, '')}#/regulamin`;
const ADRES_POLITYKA = `${konfiguracja.URL_PORTALU.replace(/portal\.html$/, '')}#/polityka-prywatnosci`;

function adresPliku(slug) {
  return slug === 'index' ? `${BASE_URL}/` : `${BASE_URL}/${slug}.html`;
}

function jsonLd(kancelaria) {
  const adres = [kancelaria.kancelaria_ulica, kancelaria.kancelaria_miasto].filter(Boolean).join(', ');
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

function szablon({ slug, tytul, opis, html, kancelaria, podstawaPrawna }) {
  const nawUmowa = STRONY.map((s) => {
    const aktywna = s.slug === slug ? ' aria-current="page"' : '';
    const adres = s.slug === 'index' ? '/' : `/${s.slug}.html`;
    return `<a href="${adres}"${aktywna}>${ucieczkaHtml(s.etykieta)}</a>`;
  }).join('\n        ');

  const okruszki = slug === 'index'
    ? ''
    : `<nav class="okruszki" aria-label="Okruszki"><a href="/">Strona główna</a><span aria-hidden="true">›</span><span>${ucieczkaHtml(tytul)}</span></nav>`;

  const ld = [jsonLd(kancelaria), breadcrumbJsonLd(slug, tytul)]
    .map((obiekt) => `<script type="application/ld+json">${JSON.stringify(obiekt)}</script>`)
    .join('\n    ');

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
  <header class="marka" role="banner">
    <a class="marka-znak" href="/">${ucieczkaHtml(kancelaria.nazwa)}</a>
    <nav class="nawigacja" aria-label="Nawigacja główna">
      <a href="${konfiguracja.URL_PORTALU.replace(/portal\.html$/, 'portal.html')}">Zaloguj się do portalu</a>
    </nav>
  </header>
  <div class="uklad">
    <nav class="boczna" aria-label="Spis stron">
      ${nawUmowa}
    </nav>
    <main id="tresc">
      ${okruszki}
      ${html}
      <div class="podstawa-prawna-stopka">
        <p><strong>Podstawa prawna:</strong> ${ucieczkaHtml(podstawaPrawna || 'Kodeks spółek handlowych, Dział IA (art. 300¹–300¹²⁰).')}</p>
        <p><strong>Stan prawny na:</strong> ${DZIS}. Treść tej strony jest projektem do weryfikacji przez notariusza
        przed publikacją — patrz znaczniki <code>DO WERYFIKACJI</code> w źródle.</p>
      </div>
    </main>
  </div>
  <footer class="stopka" role="contentinfo">
    <div class="stopka-kolumna">
      <strong>${ucieczkaHtml(kancelaria.nazwa)}</strong>
      ${kancelaria.kancelaria_ulica ? `<div>${ucieczkaHtml(kancelaria.kancelaria_ulica)}</div>` : ''}
      ${kancelaria.kancelaria_miasto ? `<div>${ucieczkaHtml([kancelaria.kancelaria_kod, kancelaria.kancelaria_miasto].filter(Boolean).join(' '))}</div>` : ''}
    </div>
    <div class="stopka-kolumna">
      ${kancelaria.telefon ? `<div>${ucieczkaHtml(kancelaria.telefon)}</div>` : ''}
      ${kancelaria.email ? `<div>${ucieczkaHtml(kancelaria.email)}</div>` : ''}
    </div>
    <div class="stopka-kolumna">
      <a href="${ADRES_REGULAMIN}">Regulamin portalu</a>
      <a href="${ADRES_POLITYKA}">Polityka prywatności</a>
    </div>
  </footer>
</body>
</html>
`;
}

/* ═════════════════════════════════════════════════════
   URUCHOMIENIE
   ═════════════════════════════════════════════════════ */

function zbuduj() {
  fs.mkdirSync(WYJSCIE, { recursive: true });
  fs.mkdirSync(path.join(WYJSCIE, 'fonty'), { recursive: true });

  // Fonty — te same pliki co aplikacja (tożsamość wizualna, sekcja 5.4),
  // skopiowane, bo ten bundel jest osobnym wdrożeniem (D-063), nie może
  // liczyć na `/fonty` aplikacji pod tą samą domeną.
  for (const plik of ['inter-tight-latin.woff2', 'inter-tight-latin-ext.woff2', 'eb-garamond-latin.woff2', 'eb-garamond-latin-ext.woff2']) {
    fs.copyFileSync(
      path.join(__dirname, '..', 'publiczne', 'fonty', plik),
      path.join(WYJSCIE, 'fonty', plik)
    );
  }
  fs.copyFileSync(path.join(KATALOG, 'styl.css'), path.join(WYJSCIE, 'styl.css'));

  const kancelaria = ustawienia.kancelaria(db());

  const pliki = fs.readdirSync(ZRODLA).filter((n) => n.endsWith('.md'));
  const wpisySitemap = [];
  for (const plik of pliki) {
    const slug = plik.replace(/\.md$/, '');
    const surowy = fs.readFileSync(path.join(ZRODLA, plik), 'utf8');
    const { metadane, tresc } = rozdziel(surowy);
    let html = markdownDoHtml(tresc)
      .replaceAll('PORTAL_URL_TOKEN', konfiguracja.URL_PORTALU)
      .replaceAll('KANCELARIA_NAZWA_TOKEN', ucieczkaHtml(kancelaria.nazwa))
      .replaceAll('KANCELARIA_TELEFON_TOKEN', ucieczkaHtml(kancelaria.telefon || '—'))
      .replaceAll('KANCELARIA_EMAIL_TOKEN', ucieczkaHtml(kancelaria.email || '—'))
      .replaceAll(
        'KANCELARIA_ADRES_TOKEN',
        ucieczkaHtml([kancelaria.kancelaria_ulica, [kancelaria.kancelaria_kod, kancelaria.kancelaria_miasto].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—')
      );
    if (slug === 'oplaty') html = html.replace('<!-- TABELA_OPLAT -->', tabelaOplat());
    const strona = szablon({
      slug,
      tytul: metadane.title,
      opis: metadane.description,
      html,
      kancelaria,
      podstawaPrawna: metadane.podstawa_prawna,
    });
    const nazwaPliku = slug === 'index' ? 'index.html' : `${slug}.html`;
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

/** /oplaty — tabela netto/VAT/brutto generowana z przepisy.js (5.2), nie wpisana ręcznie w Markdown. */
function zlote(grosze) {
  // Ten sam format co `fmt.zlote` w publiczne/js/rdzen.js — jedno źródło
  // konwencji „grosze → zapis złotowy" w całej aplikacji (sekcja 0, zasada 3).
  return (Number(grosze) / 100).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 });
}

function tabelaOplat() {
  const wiersz = (etykieta, netto) => {
    const brutto = przepisy.obliczBrutto(netto, przepisy.STAWKA_VAT_PROCENT);
    return `<tr><td>${etykieta}</td><td class="prawo">${zlote(netto)}</td>` +
      `<td class="prawo">${przepisy.STAWKA_VAT_PROCENT}%</td><td class="prawo">${zlote(brutto)}</td></tr>`;
  };
  return `<table class="tabela-oplat">
  <caption>Stawki maksymalne wg rozporządzenia ⚠️ DO WERYFIKACJI</caption>
  <thead><tr><th>Czynność</th><th class="prawo">Netto</th><th class="prawo">VAT</th><th class="prawo">Brutto</th></tr></thead>
  <tbody>
    ${wiersz('Prowadzenie rejestru — za każdy rozpoczęty rok', przepisy.STAWKI_MAKSYMALNE_GROSZE.PROWADZENIE_ROCZNIE)}
    ${wiersz('Wpis w rejestrze', przepisy.STAWKI_MAKSYMALNE_GROSZE.WPIS)}
    ${wiersz('Informacja z rejestru', przepisy.STAWKI_MAKSYMALNE_GROSZE.INFORMACJA)}
  </tbody>
</table>`;
}

zbuduj();
