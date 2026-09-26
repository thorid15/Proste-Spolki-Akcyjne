'use strict';

/**
 * Generator strony publicznej — Faza wdrożenia `SESJA-PSA-STRONA.md` (wersja 5, 26.09.2026).
 *
 * ZASADA NADRZĘDNA: `projekt-strony/nowa-strona.html` jest źródłem prawdy — projekt zatwierdzony
 * przez Łukasza. Ten skrypt zmienia WYŁĄCZNIE to, czego wymaga technika wdrożenia: wydziela CSS/JS
 * do osobnych plików, podstawia adres bazowy, dane kancelarii i kwoty opłat (jedno źródło:
 * `server/logika/przepisy.js`), i generuje dwie podstrony prawne (regulamin, polityka prywatności)
 * w tej samej ramie wizualnej. Nie zmienia tekstów, kolorów, układu ani animacji projektu.
 *
 * D-063/D-065: bundel jest osobny od `serwer.js`, wyjście w `strona/dist/`.
 * Użycie: `node narzedzia/buduj-strone.js`. `BASE_URL_STRONA` (server/konfiguracja.js) steruje
 * adresami bezwzględnymi (canonical, Open Graph, JSON-LD, sitemap).
 */

const fs = require('node:fs');
const path = require('node:path');

const konfiguracja = require('../server/konfiguracja');
const { db } = require('../server/baza');
const ustawienia = require('../server/logika/ustawienia');
const przepisy = require('../server/logika/przepisy');

const KORZEN = path.join(__dirname, '..');
const PROJEKT = path.join(KORZEN, 'projekt-strony');
const WYJSCIE = path.join(KORZEN, 'strona', 'dist');
const BASE_URL = konfiguracja.BASE_URL_STRONA.replace(/\/+$/, '');
const DZIS = new Date().toISOString().slice(0, 10);

/* ═════════════════════════════════════════════════════
   FORMATOWANIE KWOT — jedyne źródło: przepisy.STAWKI_GROSZE (sekcja 6/7 dokumentu sesji)
   ═════════════════════════════════════════════════════ */

/** Zapis polski, przecinek jako separator dziesiętny, `&nbsp;` jako separator tysięcy (jak w projekcie). */
function pl(groszeCalk) {
  const zl = (Number(groszeCalk) / 100).toFixed(2);
  let [calosc, ulamek] = zl.split('.');
  calosc = calosc.replace(/\B(?=(\d{3})+(?!\d))/g, '&nbsp;');
  return `${calosc},${ulamek}`;
}

/** Zapis dla JSON-LD (`offers`): kropka, bez separatora tysięcy. */
function plJson(groszeCalk) {
  return (Number(groszeCalk) / 100).toFixed(2);
}

function ucieczkaHtml(tekst) {
  return String(tekst)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═════════════════════════════════════════════════════
   TREŚĆ STRON PRAWNYCH — z `publiczne/js/prawne.js` (jedyne źródło tych tekstów, D-065),
   przeniesiona na statyczny HTML w ramie wizualnej projektu (sekcja 1 dokumentu sesji).
   ═════════════════════════════════════════════════════ */

function sekcjaPolitykaPrywatnosci(k, adresJednaLinia) {
  const email = k.email
    ? `<a href="mailto:${ucieczkaHtml(k.email)}">${ucieczkaHtml(k.email)}</a>`
    : 'poczty elektronicznej kancelarii';
  return [
    ['1. Administrator danych', `
      <p>Administratorem danych osobowych jest ${ucieczkaHtml(k.nazwa || 'kancelaria notarialna prowadząca rejestr')}${adresJednaLinia ? `, ${ucieczkaHtml(adresJednaLinia)}` : ''}${k.kancelaria_nip ? `, NIP ${ucieczkaHtml(k.kancelaria_nip)}` : ''}.</p>
      <p>W sprawach dotyczących danych osobowych można pisać na adres ${email}.</p>`],
    ['2. Po co przetwarzamy dane', `
      <ul>
        <li><strong>Prowadzenie rejestru akcjonariuszy</strong> — zawarcie i wykonanie umowy o prowadzenie rejestru oraz dokonywanie w nim wpisów (art. 300<sup>30</sup> i następne Kodeksu spółek handlowych).</li>
        <li><strong>Obsługa wniosku o prowadzenie rejestru</strong> — zebranie danych spółki, osoby reprezentującej ją przy zawarciu umowy oraz akcjonariuszy, przygotowanie dokumentów do podpisu i przyjęcie podpisanych skanów.</li>
        <li><strong>Obowiązki instytucji obowiązanej</strong> — stosowanie środków bezpieczeństwa finansowego wynikających z ustawy o przeciwdziałaniu praniu pieniędzy oraz finansowaniu terroryzmu.</li>
        <li><strong>Prowadzenie konta w portalu</strong> — uwierzytelnienie, obsługa zgłoszeń i wydawanie informacji z rejestru.</li>
      </ul>`],
    ['3. Podstawy prawne', `
      <ul>
        <li>art. 6 ust. 1 lit. b) RODO — niezbędność do zawarcia i wykonania umowy;</li>
        <li>art. 6 ust. 1 lit. c) RODO — obowiązek prawny ciążący na administratorze, w tym obowiązki wynikające z Kodeksu spółek handlowych, Prawa o notariacie oraz przepisów o przeciwdziałaniu praniu pieniędzy;</li>
        <li>art. 6 ust. 1 lit. a) RODO — zgoda, wyłącznie tam, gdzie jej udzielono: zgoda akcjonariusza na komunikację przy wykorzystaniu poczty elektronicznej (art. 300<sup>33</sup> § 1 pkt 4 Kodeksu spółek handlowych). Zgodę można cofnąć w każdej chwili; cofnięcie nie wpływa na czynności dokonane wcześniej.</li>
      </ul>`],
    ['4. Zakres danych', `
      <p>Dane spółki i jej reprezentanta, dane akcjonariuszy w zakresie stanowiącym treść rejestru (nazwisko i imię albo firma, numer PESEL albo data urodzenia, numer w rejestrze i nazwa rejestru, adres, a przy wyrażonej zgodzie także adres poczty elektronicznej), dane o akcjach i obciążeniach na nich ustanowionych, a także dane kontaktowe konta w portalu oraz zapisy o dostępie do rejestru.</p>`],
    ['5. Odbiorcy danych', `
      <p>Dane udostępniamy wyłącznie tam, gdzie nakazuje to prawo albo gdzie jest to niezbędne do prowadzenia rejestru: spółce i akcjonariuszom w zakresie wynikającym z art. 300<sup>35</sup> Kodeksu spółek handlowych, sądom i organom uprawnionym na podstawie przepisów, a także dostawcom usług technicznych działającym na nasze zlecenie i na podstawie umowy powierzenia. Dane nie są przekazywane poza Europejski Obszar Gospodarczy.</p>`],
    ['6. Okres przechowywania', `
      <p>Przez czas prowadzenia rejestru akcjonariuszy, a po jego zakończeniu — przez okres wynikający z przepisów o przechowywaniu dokumentów notarialnych oraz z przedawnienia roszczeń. Dane zgłoszeń, które nie doprowadziły do zawarcia umowy, usuwamy po zakończeniu korespondencji w sprawie.</p>`],
    ['7. Prawa osoby, której dane dotyczą', `
      <ul>
        <li>dostęp do danych i otrzymanie ich kopii;</li>
        <li>sprostowanie danych nieprawidłowych i uzupełnienie niekompletnych;</li>
        <li>ograniczenie przetwarzania oraz sprzeciw — w zakresie przewidzianym przepisami;</li>
        <li>usunięcie danych — z zastrzeżeniem, że dane stanowiące treść rejestru akcjonariuszy przechowujemy na podstawie obowiązku prawnego i nie podlegają one usunięciu na żądanie;</li>
        <li>wniesienie skargi do Prezesa Urzędu Ochrony Danych Osobowych.</li>
      </ul>`],
    ['8. Pliki cookies', `
      <!-- DO WERYFIKACJI: nowa sekcja (SESJA-PSA-STRONA.md wersja 5, pkt 11) — treść prawna do akceptacji Łukasza. -->
      <p>Strona publiczna (ta, którą teraz czytasz) nie zapisuje żadnych plików cookies ani innych danych w przeglądarce — nie ma na niej analityki, reklam ani zewnętrznych zasobów.</p>
      <p>Portal klienta, po zalogowaniu, używa jednego pliku cookie:</p>
      <ul>
        <li><strong>Nazwa:</strong> <code>psa_sesja_portal</code></li>
        <li><strong>Cel:</strong> utrzymanie zalogowania (identyfikacja sesji) — niezbędny do działania usługi, nie służy do profilowania.</li>
        <li><strong>Czas przechowywania:</strong> 8 godzin od zalogowania albo do wylogowania.</li>
      </ul>
      <p>Ciasteczko nie jest udostępniane podmiotom trzecim i nie łączy się z żadnym narzędziem analitycznym ani reklamowym.</p>`],
    ['9. Czy podanie danych jest obowiązkowe', `
      <p>Podanie danych stanowiących treść rejestru wynika z przepisów prawa — bez nich nie da się dokonać wpisu. Podanie adresu poczty elektronicznej akcjonariusza jest dobrowolne i wchodzi do rejestru dopiero po złożeniu przez niego podpisanego oświadczenia.</p>`],
  ];
}

function sekcjaRegulamin(k, adresJednaLinia) {
  const email = k.email
    ? `<a href="mailto:${ucieczkaHtml(k.email)}">${ucieczkaHtml(k.email)}</a>`
    : 'poczty elektronicznej';
  return [
    ['§ 1. Kto prowadzi portal', `
      <p>Portal prowadzi ${ucieczkaHtml(k.nazwa || 'kancelaria notarialna')}${adresJednaLinia ? `, ${ucieczkaHtml(adresJednaLinia)}` : ''}${k.email ? `, kontakt: ${email}` : ''}.</p>`],
    ['§ 2. Do czego służy portal', `
      <ul>
        <li>złożenie wniosku o prowadzenie rejestru akcjonariuszy prostej spółki akcyjnej;</li>
        <li>pobranie dokumentów do podpisu i odesłanie ich podpisanych skanów;</li>
        <li>podgląd rejestru w zakresie odpowiadającym roli konta;</li>
        <li>zgłaszanie żądań wpisu wraz z dokumentami;</li>
        <li>pobranie informacji z rejestru na wskazany dzień.</li>
      </ul>`],
    ['§ 3. Konto', `
      <p>Konta zakłada kancelaria po weryfikacji tożsamości — w portalu nie ma samodzielnej rejestracji. Hasło ustawia się z linku aktywacyjnego przesłanego pocztą elektroniczną. Hasła nie wolno udostępniać osobom trzecim; o jego ujawnieniu należy niezwłocznie powiadomić kancelarię.</p>`],
    ['§ 4. Wniosek i dokumenty', `
      <p>Za prawdziwość i kompletność danych wpisanych we wniosku odpowiada osoba, która go składa. Złożenie wniosku nie jest równoznaczne z zawarciem umowy o prowadzenie rejestru. Kancelaria sprawdza dane, przygotowuje komplet dokumentów i udostępnia go do podpisu; może też odesłać wniosek do uzupełnienia albo odmówić jego przyjęcia.</p>
      <p>Dokumenty podpisuje się własnoręcznie, kwalifikowanym podpisem elektronicznym, podpisem zaufanym albo osobistym. Skany muszą być czytelne, a podpis widoczny w całości.</p>`],
    ['§ 5. Wpisy w rejestrze', `
      <p>Wpis następuje na żądanie spółki albo osoby mającej interes prawny, po przedłożeniu dokumentów uzasadniających wpis. Podmiot prowadzący rejestr bada treść i formę tych dokumentów; nie ma obowiązku badania ich zgodności z prawem ani prawdziwości podpisów, chyba że poweźmie w tym względzie uzasadnione wątpliwości (art. 300<sup>34</sup> § 5 Kodeksu spółek handlowych). Wpisu dokonuje się niezwłocznie, nie później niż w terminie tygodnia od otrzymania żądania.</p>`],
    ['§ 6. Opłaty', `
      <p>Wynagrodzenie kancelarii i sposób rozliczeń określa umowa o prowadzenie rejestru — aktualne stawki są podane na stronie głównej w sekcji „Opłaty".</p>`],
    ['§ 7. Dostępność usługi', `
      <p>Kancelaria dokłada starań, żeby portal działał bez przerw, ale nie gwarantuje nieprzerwanej dostępności — możliwe są przerwy techniczne. Niedostępność portalu nie wpływa na terminy ustawowe: żądanie wpisu można zawsze złożyć bezpośrednio w kancelarii.</p>`],
    ['§ 8. Reklamacje', `
      <p>Uwagi dotyczące działania portalu można zgłaszać ${k.email ? `na adres ${email}` : 'pocztą elektroniczną'}. Odpowiadamy w terminie 14 dni.</p>`],
    ['§ 9. Zmiany regulaminu', `
      <p>O zmianie regulaminu informujemy pocztą elektroniczną oraz w portalu, z wyprzedzeniem co najmniej 14 dni. Zmiany nie naruszają praw nabytych na podstawie zawartych już umów.</p>`],
  ];
}

function dokumentPrawnyHtml({ tytul, wstep, sekcje }) {
  const body = sekcje.map(([tyt, tresc]) => `
      <section class="ustep">
        <h2>${ucieczkaHtml(tyt)}</h2>
        ${tresc.trim()}
      </section>`).join('\n');
  return `
  <section class="sekcja sekcja--biala dokument">
    <div class="wrap dokument__in">
      <div class="glowa">
        <h1>${ucieczkaHtml(tytul)}</h1>
        <p>${wstep}</p>
      </div>
      ${body}
      <p class="dokument__wroc"><a href="index.html">← Wróć do strony głównej</a></p>
    </div>
  </section>`;
}

/* CSS uzupełniający wyłącznie dla stron dokumentów prawnych — projekt (sekcja 1 dokumentu sesji)
   obejmował tylko stronę główną; te reguły są techniką wdrożenia (podział na pliki, pkt 2), nie
   nowym projektem: używają wyłącznie tokenów i krojów już zdefiniowanych w projekcie. */
const CSS_DOKUMENT = `
.dokument__in{max-width:44rem}
.dokument .glowa{margin-bottom:40px}
.dokument h1{font-size:clamp(2rem,3.6vw,2.75rem)}
.ustep{padding-block:28px;border-top:1px solid var(--linia)}
.ustep:first-of-type{border-top:none}
.ustep h2{font:600 1.1875rem/1.3 var(--f-ui);letter-spacing:0;margin-bottom:12px}
.ustep p{color:var(--atrament-2);margin-top:10px}
.ustep p:first-child{margin-top:0}
.ustep ul{margin:10px 0 0;padding-left:20px;color:var(--atrament-2);display:grid;gap:8px}
.ustep code{font-family:var(--f-dane);font-size:.9em;background:var(--papier-2);padding:.15em .4em;border-radius:4px}
.dokument__wroc{margin-top:40px}
.dokument__wroc a{color:var(--rejestr-2);font-weight:600;text-decoration:none;text-underline-offset:3px}
.dokument__wroc a:hover{text-decoration:underline}
`;

/* ═════════════════════════════════════════════════════
   BUDOWANIE
   ═════════════════════════════════════════════════════ */

function zbuduj() {
  fs.mkdirSync(WYJSCIE, { recursive: true });
  fs.mkdirSync(path.join(WYJSCIE, 'fonty'), { recursive: true });
  fs.mkdirSync(path.join(WYJSCIE, 'obrazy'), { recursive: true });

  const kancelaria = ustawienia.kancelaria(db());
  const adresJednaLinia = [kancelaria.kancelaria_ulica, [kancelaria.kancelaria_kod, kancelaria.kancelaria_miasto].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');

  let html = fs.readFileSync(path.join(PROJEKT, 'nowa-strona.html'), 'utf8');

  // ── 1. Wydzielenie CSS do strona.css (pkt 2) ──────────────────────────
  const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!cssMatch) throw new Error('Nie znaleziono <style> w projekcie.');
  const css = cssMatch[1] + '\n' + CSS_DOKUMENT;
  html = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="strona.css">');

  // ── 2. Wydzielenie dwóch skryptów bez atrybutów (pomija JSON-LD, ma `type=`) — pkt 2 ──
  const skrypty = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (skrypty.length !== 2) throw new Error(`Oczekiwano 2 zwykłych <script> w projekcie, znaleziono ${skrypty.length}.`);
  const [wczesnySkrypt, glownySkrypt] = skrypty;
  html = html.replace(wczesnySkrypt[0], '<script src="wczesnie.js"></script>');
  html = html.replace(glownySkrypt[0], '<script src="strona.js" defer></script>');

  // ── 3. {{BASE_URL}} (pkt 9, D-049) ────────────────────────────────────
  html = html.replaceAll('{{BASE_URL}}', BASE_URL);

  // ── 4. Kwoty — jedyne źródło server/logika/przepisy.js (pkt 6) ───────
  const s = przepisy.STAWKI_GROSZE;
  const prowB = przepisy.obliczBrutto(s.PROWADZENIE_ROCZNIE);
  const wpisB = przepisy.obliczBrutto(s.WPIS);
  const infoB = przepisy.obliczBrutto(s.INFORMACJA);
  html = html
    .replaceAll('1476.00', plJson(prowB)).replaceAll('123.00', plJson(wpisB)).replaceAll('61.50', plJson(infoB))
    .replaceAll('1&nbsp;476,00', pl(prowB)).replaceAll('123,00', pl(wpisB)).replaceAll('61,50', pl(infoB))
    .replaceAll('1&nbsp;200,00', pl(s.PROWADZENIE_ROCZNIE)).replaceAll('100,00', pl(s.WPIS)).replaceAll('50,00', pl(s.INFORMACJA));

  // ── 5. Dane kancelarii — jedyne źródło /api/wspolne/kancelaria (pkt 8) ─
  html = html
    .replaceAll('Kancelaria Notarialna Łukasz Kozon', ucieczkaHtml(kancelaria.nazwa))
    .replaceAll('biuro@notariusz.gdansk.pl', ucieczkaHtml(kancelaria.email))
    .replace('"streetAddress":"ul. Bolesława Leśmiana 3/U10"', `"streetAddress":"${ucieczkaHtml(kancelaria.kancelaria_ulica)}"`)
    .replace('"postalCode":"80-280"', `"postalCode":"${ucieczkaHtml(kancelaria.kancelaria_kod)}"`)
    .replace('"addressLocality":"Gdańsk"', `"addressLocality":"${ucieczkaHtml(kancelaria.kancelaria_miasto)}"`)
    .replace('ul. Bolesława Leśmiana 3/U10<br>80-280 Gdańsk<br>', `${ucieczkaHtml(kancelaria.kancelaria_ulica)}<br>${ucieczkaHtml([kancelaria.kancelaria_kod, kancelaria.kancelaria_miasto].filter(Boolean).join(' '))}<br>`);

  // ── 6. Obraz stopki — /obrazy/notariat.png (pkt 4) ────────────────────
  html = html.replace('src="notariat.png"', 'src="obrazy/notariat.png"');

  // ── 7. Nagłówek/stopka do ponownego użycia na stronach prawnych (pkt 1) ─
  const naglowek = html.match(/<header class="nav"[\s\S]*?<\/header>/)[0];
  const stopka = html.match(/<footer class="stopka">[\s\S]*?<\/footer>/)[0];
  // Na podstronach logo i odnośniki sekcji wracają do strony głównej — jedyna zmiana
  // techniczna konieczna przy podziale jednej strony na kilka plików (pkt 1/2).
  const naglowekPodstrony = naglowek
    .replace('href="#tresc"', 'href="index.html"')
    .replaceAll('href="#oplaty"', 'href="index.html#oplaty"')
    .replaceAll('href="#portal"', 'href="index.html#portal"')
    .replaceAll('href="#informacja"', 'href="index.html#informacja"')
    .replaceAll('href="#pytania"', 'href="index.html#pytania"');

  const glowaHtml = html.match(/<main id="tresc">[\s\S]*?<\/main>/)[0];
  const skryptTagi = '<script src="wczesnie.js"></script>';

  // ── 8. strona główna = projekt (pkt 1) ────────────────────────────────
  fs.writeFileSync(path.join(WYJSCIE, 'index.html'), html, 'utf8');
  console.log('[buduj-strone] index.html');

  // ── 9. Regulamin i polityka prywatności — nagłówek/stopka/typografia z projektu (pkt 1) ─
  const strony = [
    {
      slug: 'regulamin',
      tytul: `Regulamin portalu — ${kancelaria.nazwa}`,
      opis: 'Zasady korzystania z portalu rejestru akcjonariuszy prostej spółki akcyjnej.',
      html: dokumentPrawnyHtml({
        tytul: 'Regulamin portalu',
        wstep: 'Regulamin opisuje zasady korzystania z portalu rejestru akcjonariuszy prowadzonego przez kancelarię. Portal jest narzędziem do obsługi rejestru — nie zastępuje umowy o prowadzenie rejestru ani czynności notarialnych.',
        sekcje: sekcjaRegulamin(kancelaria, adresJednaLinia),
      }),
    },
    {
      slug: 'polityka-prywatnosci',
      tytul: `Polityka prywatności — ${kancelaria.nazwa}`,
      opis: 'Jak przetwarzamy dane osobowe w rejestrze akcjonariuszy i w portalu klienta oraz jakich plików cookies używamy.',
      html: dokumentPrawnyHtml({
        tytul: 'Polityka prywatności',
        wstep: 'Dokument opisuje, kto i po co przetwarza dane osobowe w portalu rejestru akcjonariuszy prostych spółek akcyjnych oraz jakie prawa przysługują osobom, których te dane dotyczą. Wypełnia obowiązek informacyjny z art. 13 i 14 rozporządzenia (UE) 2016/679 (RODO).',
        sekcje: sekcjaPolitykaPrywatnosci(kancelaria, adresJednaLinia),
      }),
    },
  ];

  for (const strona of strony) {
    const adres = `${BASE_URL}/${strona.slug}.html`;
    const dokument = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${ucieczkaHtml(strona.tytul)}</title>
<meta name="description" content="${ucieczkaHtml(strona.opis)}">
<meta name="theme-color" content="#1F4D3D">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${adres}">
<link rel="preload" href="fonty/eb-garamond-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonty/inter-tight-latin.woff2" as="font" type="font/woff2" crossorigin>
${skryptTagi}
<link rel="stylesheet" href="strona.css">
</head>
<body>
<a class="przeskok" href="#tresc">Przejdź do treści</a>
${naglowekPodstrony}
<main id="tresc">
${strona.html}
</main>
${stopka}
<script src="strona.js" defer></script>
</body>
</html>
`;
    fs.writeFileSync(path.join(WYJSCIE, `${strona.slug}.html`), dokument, 'utf8');
    console.log(`[buduj-strone] ${strona.slug}.html`);
  }

  // ── 10. Pliki CSS/JS ───────────────────────────────────────────────────
  fs.writeFileSync(path.join(WYJSCIE, 'strona.css'), css, 'utf8');
  fs.writeFileSync(path.join(WYJSCIE, 'wczesnie.js'), wczesnySkrypt[1], 'utf8');
  fs.writeFileSync(path.join(WYJSCIE, 'strona.js'), glownySkrypt[1], 'utf8');

  // ── 11. Fonty — dokładnie te, których szuka CSS (pkt 3) ────────────────
  const uzyteFonty = new Set([...css.matchAll(/url\("fonty\/([^"]+)"\)/g)].map((m) => m[1]));
  for (const plik of uzyteFonty) {
    fs.copyFileSync(path.join(KORZEN, 'publiczne', 'fonty', plik), path.join(WYJSCIE, 'fonty', plik));
  }
  console.log(`[buduj-strone] fonty: ${[...uzyteFonty].join(', ')}`);

  // ── 12. Obrazy — notariat.png (pkt 4) i og-rejestr.png, jeśli już wygenerowany (pkt 9) ─
  fs.copyFileSync(path.join(PROJEKT, 'notariat.png'), path.join(WYJSCIE, 'obrazy', 'notariat.png'));
  const ogZrodlo = path.join(PROJEKT, 'og-rejestr.png');
  if (fs.existsSync(ogZrodlo)) {
    fs.copyFileSync(ogZrodlo, path.join(WYJSCIE, 'obrazy', 'og-rejestr.png'));
    console.log('[buduj-strone] obrazy/og-rejestr.png');
  } else {
    console.log('[buduj-strone] UWAGA: brak projekt-strony/og-rejestr.png — og:image będzie 404 do czasu wygenerowania.');
  }

  // ── 13. sitemap.xml, robots.txt (pkt 9) ────────────────────────────────
  const adresyMapy = ['', 'regulamin.html', 'polityka-prywatnosci.html'].map((s) => `${BASE_URL}/${s}`);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${adresyMapy.map((a) => `  <url><loc>${a}</loc><lastmod>${DZIS}</lastmod></url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(WYJSCIE, 'sitemap.xml'), sitemap, 'utf8');
  fs.writeFileSync(path.join(WYJSCIE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`, 'utf8');
  console.log(`[buduj-strone] sitemap.xml, robots.txt (BASE_URL_STRONA=${BASE_URL})`);
}

zbuduj();
