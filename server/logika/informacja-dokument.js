'use strict';

/**
 * Informacja z rejestru akcjonariuszy — art. 300(35) § 3 KSH.
 *
 * JEDYNY dokument, jaki aplikacja wystawia ze stanu rejestru, i jedyne
 * miejsce, w ktorym powstaje jego tresc: ten sam plik oglada kancelaria na
 * ekranie i dostaje klient w portalu.
 *
 * Dlaczego OSOBNY modul, a nie kolejna funkcja w `dokumenty-tresc.js`:
 * tamte pisma sa listami — ida e-mailem, wiec kazdy styl musi siedziec w
 * atrybucie, bo programy pocztowe nie czytaja arkuszy ani nie wczytaja
 * webfontow. Informacja z rejestru e-mailem nie idzie: otwiera sie pod
 * adresem serwera, zeby ja przeczytac, wydrukowac albo zapisac do PDF-u.
 * Wolno jej wiec miec prawdziwy arkusz, reguly `@page` i kroje pisma —
 * i dlatego ma wlasny plik, zamiast ciagnac tamte ograniczenia bez potrzeby.
 *
 * ZAKRES TRESCI wyznacza art. 300(33) § 1 pkt 1–11 KSH. Kazda sekcja niesie
 * numer punktu, ktory realizuje — to nie ozdoba: notariusz i sad sprawdzaja
 * wypis wlasnie wzgledem tego katalogu, wiec numer jest tu informacja.
 *
 * Czego NIE umieszczamy (sekcja 10 specyfikacji): pola `uwagi`, checklist
 * weryfikacji, notatek AML, skrotow lancucha. `widoki.widokStanu()` nie
 * zwraca ich dla roli innej niz kancelaria, a maskowanie z art. 300(35)
 * § 1(1) KSH jest juz w `stan` zastosowane — tu tylko ukladamy strone.
 */

const ZASLONA = '—';

function esc(tekst) {
  return String(tekst == null ? '' : tekst).replace(/[&<>"']/g, (znak) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[znak]));
}

function dataPl(iso) {
  if (!iso) return null;
  const [r, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}.${m}.${r}`;
}

function pusty(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

/** Liczby w tekscie ciagłym: spacja nierozdzielajaca co trzy cyfry. */
function liczba(n) {
  if (n === null || n === undefined) return null;
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function procent(p) {
  if (p === null || p === undefined) return null;
  return `${Number(p).toFixed(2).replace('.', ',')} %`;
}

/* ── Slowniki ─────────────────────────────────────────────── */

const NAZWY_RODZAJU_AKCJI = {
  zwykla: 'zwykła',
  uprzywilejowana: 'uprzywilejowana',
  zalozycielska: 'założycielska',
  niema: 'niema',
};

const NAZWY_POKRYCIA = {
  tak: 'w całości',
  nie: 'niepokryte',
  czesciowo: 'częściowo',
  // `null` znaczy: zarząd nie podjął jeszcze uchwały z art. 300(9) § 2 KSH.
  // To NIE to samo, co stwierdzenie, że wkładu nie wniesiono — dlatego
  // osobne słowo, a nie „niepokryte".
  nieustalone: 'nieustalone',
};

const NAZWY_OBCIAZENIA = {
  zastaw: 'zastaw',
  uzytkowanie: 'użytkowanie',
  zajecie: 'zajęcie',
};

const OPISY_ODBIORCY = {
  kancelaria: 'podmiot prowadzący rejestr',
  spolka: 'spółka, której rejestr dotyczy',
  wlasciciel_danych: 'osoba, której dane dotyczą',
  akcjonariusz: 'akcjonariusz',
  organ: 'sąd, prokurator, komornik albo organ egzekucyjny',
};

/* ── Arkusz ───────────────────────────────────────────────────
   Kroje i barwy te same, co w aplikacji (`publiczne/style/rejestr.css`):
   dokument ma wygladac na czesc tego samego systemu, a nie na wydruk
   z innego programu. Zielen i mosiadz sa tu uzyte oszczedniej niz na
   ekranie — na papierze duza plama koloru jest kosztowna i nieczytelna
   przy druku czarno-bialym, wiec kolor niesie wylacznie linie, numery
   przepisow i znacznik obciazenia.
   ─────────────────────────────────────────────────────────── */

const ARKUSZ = `
:root {
  --atrament: #14181C;
  --atrament-2: #565E68;
  --atrament-3: #8A929C;
  --rejestr: #1F4D3D;
  --rejestr-tlo: #F1F5F2;
  --linia: #E6E8E3;
  --mosiadz: #8A6531;
  --papier: #FFFFFF;

  /* Szerokosc kolumny tekstu = szerokosc zadruku A4 przy marginesach
     16 mm. Ekran pokazuje wiec dokladnie to, co wyjdzie z drukarki. */
  --kolumna: 178mm;
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  padding: 12mm 8mm 20mm;
  background: #EDEFEC;
  color: var(--atrament);
  font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 10.5pt;
  line-height: 1.55;
  font-variant-numeric: tabular-nums;
}

.arkusz {
  max-width: var(--kolumna);
  margin: 0 auto;
  padding: 16mm 16mm 14mm;
  background: var(--papier);
  box-shadow: 0 1px 3px rgba(20, 24, 28, 0.10), 0 8px 24px -12px rgba(20, 24, 28, 0.18);
}

/* ── Nagłówek ── */
.glowka {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12mm;
  padding-bottom: 5mm;
  border-bottom: 1.5pt solid var(--rejestr);
}
.glowka-znak { height: 15mm; width: auto; display: block; }
.glowka-kancelaria {
  text-align: right;
  font-size: 8.5pt;
  line-height: 1.45;
  color: var(--atrament-2);
}
.glowka-kancelaria strong {
  display: block;
  font-family: 'EB Garamond', 'Iowan Old Style', Georgia, serif;
  font-size: 12pt;
  font-weight: 500;
  color: var(--atrament);
  margin-bottom: 0.5mm;
}

/* ── Tytuł i podstawa ── */
.tytul {
  font-family: 'EB Garamond', 'Iowan Old Style', Georgia, serif;
  font-size: 21pt;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.005em;
  margin: 8mm 0 1.5mm;
  text-wrap: balance;
}
.podstawa {
  font-size: 9pt;
  color: var(--atrament-2);
  margin: 0 0 6mm;
}

/* ── Metryka: trzy fakty, które identyfikują ten konkretny wypis ──
   Jedyne miejsce z tłem. Nie jest ozdobą: to one odróżniają dwa wypisy
   z tego samego rejestru, więc mają się rzucać w oczy przed treścią. */
.metryka {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1.2fr;
  gap: 6mm;
  padding: 4mm 5mm;
  background: var(--rejestr-tlo);
  border-left: 2pt solid var(--rejestr);
  margin-bottom: 9mm;
}
.metryka-etykieta {
  font-size: 7pt;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--rejestr);
  margin-bottom: 1mm;
}
.metryka-wartosc { font-size: 10.5pt; line-height: 1.35; }
.metryka-wartosc strong { font-weight: 600; }

/* ── Sekcje ──
   Numer punktu ustawy stoi nad tytułem sekcji, bo to on mówi, po co ta
   sekcja w dokumencie jest — wypis sprawdza się właśnie wobec katalogu
   z art. 300(33) § 1. */
.sekcja { margin-bottom: 6mm; break-inside: avoid; }
.sekcja-przepis {
  font-family: 'IBM Plex Mono', ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 7.5pt;
  letter-spacing: 0.02em;
  color: var(--rejestr);
  margin-bottom: 0.5mm;
}
.sekcja-tytul {
  font-family: 'EB Garamond', 'Iowan Old Style', Georgia, serif;
  font-size: 13.5pt;
  font-weight: 500;
  line-height: 1.2;
  margin: 0 0 3mm;
  padding-bottom: 1.5mm;
  border-bottom: 0.5pt solid var(--linia);
}
.sekcja-numer {
  color: var(--atrament-3);
  font-variant-numeric: normal;
  margin-right: 1mm;
}
.sekcja-pusto { font-size: 9.5pt; color: var(--atrament-2); margin: 0; }

/* ── Pary „etykieta — wartość" ── */
.pary { display: grid; grid-template-columns: 52mm 1fr; gap: 1.5mm 6mm; margin: 0; }
.pary dt { font-size: 9pt; color: var(--atrament-2); }
.pary dd { margin: 0; font-size: 10pt; }
.pary dd.mocno { font-weight: 600; }
.pary dd.numery { font-size: 9.5pt; }

/* ── Tabele ──
   Bez linii pionowych i bez tła w wierszach: na papierze siatka konkuruje
   z danymi. Rozdziela je włosowa linia i odstęp. */
table { width: 100%; border-collapse: collapse; }
thead th {
  font-size: 7pt;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--atrament-2);
  text-align: left;
  padding: 0 4mm 1.5mm 0;
  border-bottom: 0.75pt solid var(--atrament-3);
  white-space: nowrap;
}
tbody td {
  font-size: 9.5pt;
  padding: 2mm 4mm 2mm 0;
  border-bottom: 0.5pt solid var(--linia);
  vertical-align: top;
}
thead th:last-child, tbody td:last-child { padding-right: 0; }
.do-prawej { text-align: right; }
.numery {
  font-family: 'IBM Plex Mono', ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 8.5pt;
  letter-spacing: -0.01em;
}
tbody tr { break-inside: avoid; }

/* ── Wiersz akcjonariusza ──
   Nazwisko, identyfikator i adresy to jedna dana z art. 300(33) § 1 pkt 5,
   więc stoją w jednej komórce, jedno pod drugim — a nie w pięciu kolumnach,
   z których większość byłaby pusta. */
.akcjonariusz-nazwa { font-weight: 600; font-size: 10pt; }
.akcjonariusz-wiersz { font-size: 8.5pt; color: var(--atrament-2); line-height: 1.4; }
.akcjonariusz-wiersz .numery { font-size: 8pt; }
.znacznik {
  display: inline-block;
  font-size: 7.5pt;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--mosiadz);
  white-space: nowrap;
}

/* ── Podsumowanie akcjonariatu ── */
.suma {
  display: flex;
  justify-content: space-between;
  gap: 6mm;
  margin-top: 2.5mm;
  font-size: 9pt;
  color: var(--atrament-2);
}
.suma strong { color: var(--atrament); font-weight: 600; }

/* ── Klauzule i podpis ── */
/* Klauzula ustawowa, miejsce na podpis i identyfikacja arkusza to JEDEN
   blok nierozdzielny. Podpis oderwany od klauzuli, którą uwierzytelnia,
   jest wadą dokumentu, a nie kwestią estetyki — więc albo mieszczą się
   razem, albo razem przechodzą na następną stronę. */
.zakonczenie { break-inside: avoid; }
.klauzula {
  margin: 7mm 0 0;
  padding-top: 3.5mm;
  border-top: 0.75pt solid var(--atrament-3);
  font-size: 9.5pt;
}
.klauzula-drobne { font-size: 8.5pt; color: var(--atrament-2); margin: 2mm 0 0; }

.podpis {
  margin-top: 12mm;
  display: flex;
  justify-content: flex-end;
}
.podpis-linia {
  width: 64mm;
  padding-top: 1.5mm;
  border-top: 0.5pt solid var(--atrament);
  text-align: center;
  font-size: 8pt;
  color: var(--atrament-2);
}

.stopka-arkusza {
  margin-top: 8mm;
  padding-top: 3mm;
  border-top: 0.5pt solid var(--linia);
  font-size: 7.5pt;
  color: var(--atrament-3);
  display: flex;
  justify-content: space-between;
  gap: 6mm;
}

/* ── Druk ──────────────────────────────────────────────────── */
@page { size: A4; margin: 16mm; }

@media print {
  body { padding: 0; background: #FFF; }
  .arkusz {
    max-width: none;
    padding: 0;
    box-shadow: none;
  }
  /* Tło metryki i barwa przepisów muszą wyjść na papier — bez tego
     jedyne dwa miejsca, w których kolor coś znaczy, drukują się na biało. */
  html, body, .metryka { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sekcja { break-inside: auto; }
  .sekcja-tytul { break-after: avoid; }
}

/* Dokument ma jeden wygląd — papierowy — więc nie przełącza się na ciemny
   motyw. Kolory są wypisane wprost, żeby nie zależał od tła osadzającej go
   strony (ekran kancelarii pokazuje go w ramce). */
`;

/* ── Elementy ─────────────────────────────────────────────── */

const RZYMSKIE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Sekcje sa NUMEROWANE, zeby dalo sie odeslac do fragmentu wypisu („patrz
 * sekcja IV"), tak jak odsyla sie do paragrafu aktu notarialnego. Numeracja
 * biegnie po sekcjach RZECZYWISCIE wydrukowanych: sekcje warunkowe (np.
 * obciazenia) odpadaja, gdy rejestr nic w nich nie wykazuje, wiec numer
 * przyznaje sie dopiero przy skladaniu dokumentu, a nie z gory.
 */
function ponumeruj(sekcje) {
  let i = 0;
  return sekcje.filter(Boolean).map((s) => {
    i += 1;
    return s.replace('{{NR}}', RZYMSKIE[i - 1] || String(i));
  }).join('');
}

function sekcja({ przepis, tytul, wnetrze, pusto }) {
  if (!wnetrze && !pusto) return '';
  return `
  <section class="sekcja">
    ${przepis ? `<div class="sekcja-przepis">${esc(przepis)}</div>` : ''}
    <h2 class="sekcja-tytul"><span class="sekcja-numer">{{NR}}.</span> ${esc(tytul)}</h2>
    ${wnetrze || `<p class="sekcja-pusto">${esc(pusto)}</p>`}
  </section>`;
}

/**
 * Pary „etykieta — wartosc". Pozycje bez wartosci WYPADAJA: puste „NIP —"
 * w pismie do sadu czyta sie jak brak danych w rejestrze, a nie jak dane,
 * ktorych spolka nie ma.
 *
 * Wartosc podaje sie SUROWA — escapowanie i klase (`mocno`, `numery`) dokłada
 * ta funkcja. Wczesniej wołający opakowywał ją sam w `<span>`, przez co test
 * na pustke sprawdzał opakowanie, nie zawartość, i puste wiersze przechodziły.
 */
function pary(lista) {
  const wiersze = lista
    .filter(([, wartosc]) => !pusty(wartosc))
    .map(([etykieta, wartosc, klasa]) =>
      `<dt>${esc(etykieta)}</dt><dd${klasa ? ` class="${klasa}"` : ''}>${esc(wartosc)}</dd>`)
    .join('');
  return wiersze ? `<dl class="pary">${wiersze}</dl>` : '';
}

function tabela(kolumny, wiersze) {
  if (!wiersze.length) return '';
  // W naglowku zostaje samo wyrownanie: `numery` to krój dla DANYCH,
  // a nazwa kolumny danymi nie jest.
  const glowa = kolumny
    .map(([nazwa, klasa]) => {
      const klasaNaglowka = klasa === 'do-prawej' ? ' class="do-prawej"' : '';
      return `<th${klasaNaglowka}>${esc(nazwa)}</th>`;
    })
    .join('');
  const cialo = wiersze
    .map((w) => `<tr>${w
      .map((komorka, i) => {
        const klasa = kolumny[i][1];
        return `<td${klasa ? ` class="${klasa}"` : ''}>${komorka}</td>`;
      })
      .join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${glowa}</tr></thead><tbody>${cialo}</tbody></table>`;
}

/** Adres akcjonariusza wg art. 300(33) § 1 pkt 5 KSH: zamieszkania albo
 *  siedziby, a gdy go nie ma — inny adres do doreczen albo elektroniczny.
 *  Wobec innego akcjonariusza adres jest zamaskowany i wraca jako zaslona;
 *  wtedy mowimy o tym wprost, zamiast milczec. */
function adresAkcjonariusza(osoba) {
  if (!osoba) return null;
  const ulica = [osoba.ulica, osoba.nr_domu && String(osoba.nr_domu)]
    .filter((v) => !pusty(v)).join(' ');
  const lokal = pusty(osoba.nr_lokalu) ? '' : `/${osoba.nr_lokalu}`;
  const miejsce = [osoba.kod_pocztowy, osoba.miejscowosc].filter((v) => !pusty(v)).join(' ');
  const podstawowy = [ulica ? ulica + lokal : null, miejsce].filter(Boolean).join(', ');
  if (podstawowy) return podstawowy;
  if (!pusty(osoba.adres_doreczen)) return `${osoba.adres_doreczen} (adres do doręczeń)`;
  if (!pusty(osoba.adres_edoreczen)) return `${osoba.adres_edoreczen} (adres do doręczeń elektronicznych)`;
  return null;
}

/**
 * Adres poczty elektronicznej wchodzi do rejestru TYLKO wtedy, gdy
 * akcjonariusz wyrazil zgode na komunikacje elektroniczna — art. 300(33)
 * § 1 pkt 5 KSH in fine. Bez potwierdzonej zgody adres w spisie nie ma
 * czego szukac, nawet jesli kancelaria go zna.
 */
function emailDoRejestru(osoba) {
  if (!osoba || pusty(osoba.email)) return null;
  if (osoba.zgoda_email_status !== 'potwierdzona' && !Number(osoba.zgoda_email)) return null;
  return osoba.email;
}

/* ── Dokument ─────────────────────────────────────────────── */

/**
 * @param {object} kancelaria  `konfiguracja.KANCELARIA`
 * @param {object} spolka      `stan.spolka`
 * @param {string} data        dzien, na ktory sporzadzono wypis
 * @param {object} stan        wynik `widoki.widokStanu()` — z maskowaniem
 * @param {object} [odbiorca]  `{ rola, opis }` — kto dostaje wypis
 * @param {string} [sporzadzono] znacznik czasu sporzadzenia (ISO)
 */
function informacjaZRejestru({ kancelaria, spolka, data, stan, odbiorca, sporzadzono }) {
  const opisOdbiorcy = (odbiorca && !pusty(odbiorca.opis) && odbiorca.opis)
    || OPISY_ODBIORCY[(odbiorca && odbiorca.rola) || stan.rola]
    || OPISY_ODBIORCY.spolka;

  const zamaskowane = stan.akcjonariusze.some((a) => a.osoba && a.osoba.zamaskowane);

  const adresSpolki = [
    pusty(spolka.ulica)
      ? null
      : `${spolka.ulica} ${spolka.nr_domu || ''}${pusty(spolka.nr_lokalu) ? '' : `/${spolka.nr_lokalu}`}`.trim(),
    [spolka.kod_pocztowy, spolka.miejscowosc].filter((v) => !pusty(v)).join(' '),
  ].filter(Boolean).join(', ');

  // ── art. 300(33) § 1 pkt 5 i 9: akcjonariusze ──
  const wierszeAkcjonariuszy = stan.akcjonariusze.map((a) => {
    const osoba = a.osoba;
    const adres = adresAkcjonariusza(osoba);
    const email = emailDoRejestru(osoba);
    const obciazona = a.obciazenia && a.obciazenia.length > 0;

    const opisy = [];
    if (osoba && !pusty(osoba.jawny_identyfikator)) opisy.push(esc(osoba.jawny_identyfikator));
    if (!pusty(adres)) opisy.push(esc(adres));
    else if (osoba && osoba.zamaskowane) opisy.push('adres zamieszkania zasłonięty');
    if (email) opisy.push(`${esc(email)} — zgoda na komunikację elektroniczną`);
    if (a.wspolwlasnosc) opisy.push('akcje we współwłasności ułamkowej');

    return [
      `<div class="akcjonariusz-nazwa">${esc(osoba ? osoba.oznaczenie : 'nieznany')}`
        + `${obciazona ? ' <span class="znacznik">obciążone</span>' : ''}</div>`
        + opisy.map((o) => `<div class="akcjonariusz-wiersz">${o}</div>`).join(''),
      esc(a.seria || ZASLONA),
      `<span class="numery">${esc(a.numery)}</span>`,
      liczba(a.ilosc),
      procent(a.procent),
      esc(NAZWY_POKRYCIA[a.pokryta] || NAZWY_POKRYCIA.nieustalone),
    ];
  });

  // ── art. 300(33) § 1 pkt 3–4: emisje ──
  const bilansWgKlucza = new Map((stan.bilans || []).map((b) => [b.emisja_klucz, b]));
  const wierszeEmisji = (stan.emisje || []).map((e) => {
    const b = bilansWgKlucza.get(e.klucz) || {};
    return [
      `<strong>${esc(e.seria)}</strong>`
        + (pusty(e.tytul) ? '' : `<div class="akcjonariusz-wiersz">${esc(e.tytul)}</div>`),
      esc(NAZWY_RODZAJU_AKCJI[e.rodzaj_akcji] || e.rodzaj_akcji || 'zwykła'),
      `<span class="numery">${esc(e.zakres)}</span>`,
      liczba(e.ilosc),
      liczba(b.umorzone || 0),
      b.w_obrocie == null ? ZASLONA : liczba(b.w_obrocie),
      dataPl(e.data_emisji) || ZASLONA,
    ];
  });

  const uprawnienia = stan.uprawnienia || [];
  const obciazenia = stan.obciazenia || [];
  const ograniczenia = stan.ograniczenia || [];
  // art. 300(33) § 1 pkt 11 — obowiazki wobec spolki zapisane przy emisji.
  const obowiazki = (stan.emisje || []).filter((e) => !pusty(e.obowiazki_wobec_spolki));

  const sekcje = ponumeruj([
    sekcja({
      przepis: 'art. 300³³ § 1 pkt 1–3 KSH',
      tytul: 'Spółka',
      wnetrze: pary([
        ['Firma', spolka.nazwa, 'mocno'],
        ['Forma prawna', spolka.forma_prawna],
        ['Siedziba i adres', adresSpolki],
        ['Sąd rejestrowy', [spolka.sad_rejestrowy, spolka.wydzial].filter((v) => !pusty(v)).join(', ')],
        ['Numer KRS', spolka.krs, 'numery'],
        ['NIP', spolka.nip, 'numery'],
        ['REGON', spolka.regon, 'numery'],
        ['Data zarejestrowania spółki', dataPl(spolka.data_utworzenia_spolki)],
    ]),
      }),

    sekcja({
      przepis: 'art. 300³¹ § 1 KSH',
      tytul: 'Podmiot prowadzący rejestr',
      wnetrze: pary([
        ['Podmiot', kancelaria.nazwa, 'mocno'],
        ['Data uchwały o wyborze', dataPl(spolka.data_uchwaly_wyboru)],
        ['Data umowy o prowadzenie rejestru', dataPl(spolka.data_umowy)],
        ['Data otwarcia rejestru', dataPl(spolka.data_otwarcia_rejestru)],
    ]),
      }),

    sekcja({
      przepis: 'art. 300³³ § 1 pkt 3–4 KSH',
      tytul: 'Emisje i serie akcji',
      wnetrze: tabela(
        [['Seria'], ['Rodzaj akcji'], ['Numery', 'numery'], ['Wyemitowane', 'do-prawej'],
         ['Umorzone', 'do-prawej'], ['W obrocie', 'do-prawej'], ['Data emisji']],
        wierszeEmisji
    ),
      pusto: 'Rejestr nie wykazuje emisji akcji.',
      }),

    sekcja({
      przepis: 'art. 300³³ § 1 pkt 5 i 9 KSH',
      tytul: 'Akcjonariusze',
      wnetrze: wierszeAkcjonariuszy.length
        ? tabela(
          [['Akcjonariusz'], ['Seria'], ['Numery', 'numery'], ['Akcje', 'do-prawej'],
           ['Udział', 'do-prawej'], ['Pokrycie']],
          wierszeAkcjonariuszy
        ) + `
        <div class="suma">
          <span>Akcje przypisane akcjonariuszom: <strong>${esc(liczba(stan.razem_akcji))}</strong></span>
          <span>Pozycji w rejestrze: <strong>${esc(wierszeAkcjonariuszy.length)}</strong></span>
        </div>`
        : '',
      pusto: 'Rejestr nie wykazuje akcjonariuszy.',
      }),

    uprawnienia.length === 0 ? '' : sekcja({
      przepis: 'art. 300³³ § 1 pkt 4 KSH',
      tytul: 'Uprawnienia szczególne z akcji',
      wnetrze: tabela(
        [['Rodzaj'], ['Dotyczy'], ['Tytuł'], ['Treść'], ['Od dnia']],
        uprawnienia.map((u) => [
          esc(u.rodzaj),
          esc(u.osoba ? u.osoba.oznaczenie : u.seria || 'cała spółka'),
          esc(u.tytul || ZASLONA),
          esc(u.tresc || ZASLONA),
          dataPl(u.data_ustanowienia) || ZASLONA,
        ])
    ),
      }),

    obciazenia.length === 0 ? '' : sekcja({
      przepis: 'art. 300³³ § 1 pkt 6–8 KSH',
      tytul: 'Obciążenia i zajęcia akcji',
      wnetrze: tabela(
        [['Rodzaj'], ['Seria'], ['Numery', 'numery'], ['Uprawniony'], ['Prawo głosu'], ['Od dnia']],
        obciazenia.map((o) => [
          esc(NAZWY_OBCIAZENIA[o.typ] || o.typ),
          esc(o.seria || ZASLONA),
          `<span class="numery">${esc(o.numery)}</span>`,
          esc(o.uprawniony ? o.uprawniony.oznaczenie : ZASLONA),
          o.prawo_glosu ? 'przysługuje uprawnionemu' : 'przy akcjonariuszu',
          dataPl(o.data_od) || ZASLONA,
        ])
    ),
      }),

    ograniczenia.length === 0 ? '' : sekcja({
      przepis: 'art. 300³³ § 1 pkt 10 KSH',
      tytul: 'Ograniczenia w rozporządzaniu akcjami',
      wnetrze: tabela(
        [['Zakres'], ['Seria'], ['Numery', 'numery'], ['Zgoda spółki'], ['Prawo pierwszeństwa'], ['Opis']],
        ograniczenia.map((o) => [
          esc(o.zakres === 'spolka' ? 'cała spółka' : o.zakres),
          esc(o.seria || ZASLONA),
          `<span class="numery">${esc(o.numery || ZASLONA)}</span>`,
          o.wymaga_zgody_spolki ? 'wymagana' : 'niewymagana',
          o.prawo_pierwszenstwa ? 'zastrzeżone' : 'niezastrzeżone',
          esc(o.opis || ZASLONA),
        ])
    ),
      }),

    obowiazki.length === 0 ? '' : sekcja({
      przepis: 'art. 300³³ § 1 pkt 11 KSH',
      tytul: 'Obowiązki wobec spółki związane z akcjami',
      wnetrze: tabela(
        [['Seria'], ['Treść obowiązku']],
        obowiazki.map((e) => [esc(e.seria), esc(e.obowiazki_wobec_spolki)])
    ),
      }),
  ]);

  const tresc = `
  ${sekcje}

  <div class="zakonczenie">
  <div class="klauzula">
    <p style="margin: 0;">
      Dokument stanowi informację z rejestru akcjonariuszy w rozumieniu
      art. 300³⁵ § 3 Kodeksu spółek handlowych i przedstawia stan rejestru
      na dzień ${esc(dataPl(data))}.
    </p>
    ${zamaskowane ? `
    <p class="klauzula-drobne">
      Numeru PESEL, daty urodzenia ani adresu zamieszkania pozostałych akcjonariuszy
      nie udostępnia się akcjonariuszowi — art. 300³⁵ § 1¹ Kodeksu spółek handlowych.
      Dane własne odbiorcy przedstawiono w całości.
    </p>` : ''}
  </div>

  <div class="podpis">
    <div class="podpis-linia">podpis i pieczęć notariusza</div>
  </div>
  </div>`;

  const sporzadzonoOpis = sporzadzono
    ? `Sporządzono ${esc(String(sporzadzono).slice(0, 10).split('-').reverse().join('.'))}`
    : null;

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>Informacja z rejestru akcjonariuszy — ${esc(spolka.nazwa)} — ${esc(dataPl(data))}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Bez tego iOS zamienia „art. 300³⁵ § 1" na numer telefonu: sygnatury
     przepisów robiły się niebieskimi odnośnikami. -->
<meta name="format-detection" content="telephone=no,date=no,address=no">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- Kroje wczytujemy NIEBLOKUJACO. Zwykly arkusz stylow wstrzymuje
     rysowanie strony do czasu pobrania — przy wolnym albo odcietym laczu
     dokument stoi wtedy pusty, a wydruk wychodzi z pustej kartki. Dokument
     ma sie przeczytac i wydrukowac bez sieci; kroje z Google Fonts sa
     ulepszeniem, nie warunkiem. Stad preload i podmiana rel po wczytaniu,
     a dla przegladarek bez skryptow zwykly link w noscript. -->
<link rel="preload" as="style"
      href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600&family=Inter+Tight:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
      onload="this.onload=null;this.rel='stylesheet'">
<noscript>
  <link rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600&family=Inter+Tight:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
</noscript>
<style>${ARKUSZ}</style>
</head>
<body>
<article class="arkusz">
  <header class="glowka">
    <img class="glowka-znak" src="/obrazy/notariat.png" alt="Notariat Rzeczypospolitej Polskiej">
    <div class="glowka-kancelaria">
      <strong>${esc(kancelaria.nazwa)}</strong>
      ${pusty(kancelaria.adres) ? '' : `${esc(kancelaria.adres)}<br>`}
      ${pusty(kancelaria.miejscowosc) ? '' : `${esc(kancelaria.miejscowosc)}<br>`}
      ${pusty(kancelaria.email) ? '' : esc(kancelaria.email)}
    </div>
  </header>

  <h1 class="tytul">Informacja z rejestru akcjonariuszy</h1>
  <p class="podstawa">
    Wydana na podstawie art. 300³⁵ § 3 Kodeksu spółek handlowych. Rejestr prowadzony
    na podstawie art. 300³¹ § 1 tej ustawy.
  </p>

  <div class="metryka">
    <div>
      <div class="metryka-etykieta">Spółka</div>
      <div class="metryka-wartosc"><strong>${esc(spolka.nazwa)}</strong>${
        pusty(spolka.krs) ? '' : `<br>KRS ${esc(spolka.krs)}`
      }</div>
    </div>
    <div>
      <div class="metryka-etykieta">Stan na dzień</div>
      <div class="metryka-wartosc"><strong>${esc(dataPl(data))}</strong></div>
    </div>
    <div>
      <div class="metryka-etykieta">Odbiorca informacji</div>
      <div class="metryka-wartosc">${esc(opisOdbiorcy)}</div>
    </div>
  </div>

  ${tresc}

  <footer class="stopka-arkusza">
    <span>${esc(spolka.nazwa)} — stan na ${esc(dataPl(data))}</span>
    ${sporzadzonoOpis ? `<span>${sporzadzonoOpis}</span>` : ''}
  </footer>
</article>
</body>
</html>`;
}

module.exports = { informacjaZRejestru, adresAkcjonariusza, emailDoRejestru };
