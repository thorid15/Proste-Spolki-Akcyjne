'use strict';

/**
 * Katalog wzorów pism — pliki `.docx` z `wzory/` (blok A1 sesji 8).
 *
 * Zastępuje trzynaście szablonów HTML zasianych w sesji 6 (brudnopisy
 * wykonawcy). Źródłem prawdy o treści pisma jest teraz PLIK w repozytorium,
 * nie wiersz w bazie: notariusz edytuje wzór w Wordzie i podmienia plik —
 * `wzory/README.md` opisuje tę ścieżkę. Aplikacja go tylko CZYTA.
 *
 * Kod dokumentu to liczba z przodu nazwy pliku (`01-...docx` → `"01"`) —
 * `wzory/README.md` § „Jak wgrać wzór" ustala to jako identyfikator typu.
 * Wersjonowanie idzie przez git, nie przez bazę: przy każdym wydaniu pisma
 * zapisujemy skrót SHA-256 bieżącej treści pliku (`psa_wydane_dokumenty.
 * szablon_hash`), więc zawsze wiadomo, z którego BRZMIENIA wzoru powstało
 * pismo sprzed roku, nawet gdy plik już dawno wygląda inaczej.
 *
 * Katalog czytamy z dysku PRZY KAŻDYM WYWOŁANIU (bez cache) — to jeden mały
 * odczyt pliku na żądanie administracyjne albo na wystawienie pisma, a dzięki
 * temu podmiana pliku działa natychmiast, bez restartu serwera.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const docx = require('./docx');

const KATALOG_WZOROW = path.join(__dirname, '..', '..', 'wzory');
const WZORZEC_NAZWY = /^(\d+)-(.+?)(?:-WZOR)?\.docx$/i;

/** Ludzka nazwa z nazwy pliku: cyfry i przyrostek „-WZOR" znikają, myślniki → spacje. */
function nazwaZPliku(nazwaPliku, kod) {
  const dopasowanie = WZORZEC_NAZWY.exec(nazwaPliku);
  const rdzen = dopasowanie ? dopasowanie[2] : nazwaPliku.replace(/\.docx$/i, '');
  return rdzen.replace(/-/g, ' ').replace(/^./, (z) => z.toUpperCase()) || kod;
}

/**
 * Lista wzorów w katalogu, posortowana po kodzie. Pliki bez numeru z przodu
 * nazwy są pomijane — to nie jest wzór gotowy do wgrania, tylko coś, co
 * zostało w folderze przez pomyłkę (np. plik roboczy).
 */
function listaWzorow() {
  if (!fs.existsSync(KATALOG_WZOROW)) return [];
  return fs
    .readdirSync(KATALOG_WZOROW, { withFileTypes: true })
    .filter((w) => w.isFile() && w.name.toLowerCase().endsWith('.docx'))
    .map((w) => {
      const dopasowanie = WZORZEC_NAZWY.exec(w.name);
      if (!dopasowanie) return null;
      const kod = dopasowanie[1];
      return { kod, plik: w.name, nazwa: nazwaZPliku(w.name, kod) };
    })
    .filter(Boolean)
    .sort((a, b) => a.kod.localeCompare(b.kod, 'pl', { numeric: true }));
}

function wpis(kod) {
  const wpis = listaWzorow().find((w) => w.kod === kod);
  if (!wpis) throw new Error(`Nie ma wzoru o kodzie „${kod}" w katalogu wzory/.`);
  return wpis;
}

/** Zawartość pliku i jego skrót — do wypełniania i do zapisu w śladzie wydania. */
function wczytaj(kod) {
  const { plik, nazwa } = wpis(kod);
  const bufor = fs.readFileSync(path.join(KATALOG_WZOROW, plik));
  const hash = crypto.createHash('sha256').update(bufor).digest('hex');
  return { kod, plik, nazwa, bufor, hash };
}

/**
 * Klucze i sekcje wzoru plus stan walidacji — do ekranu administracyjnego
 * i do sprawdzenia przy A7 (test na realnym rejestrze).
 */
function analizuj(kod) {
  const { plik, nazwa, bufor, hash } = wczytaj(kod);
  const { proste, sekcje, niezamkniete, ostrzezenia } = docx.kluczeWzoru(bufor);
  return {
    kod,
    plik,
    nazwa,
    hash,
    hashKrotki: hash.slice(0, 12),
    proste,
    sekcje,
    niezamkniete,
    ostrzezenia,
    poprawny: niezamkniete.length === 0 && ostrzezenia.length === 0,
  };
}

/**
 * Wypełnia wzór danymi.
 *
 * `plik` w zwróconym obiekcie to WYNIKOWY bufor (ten sam klucz, co
 * w `logika/docx.js`, celowo) — nazwa pliku ŹRÓDŁOWEGO (do etykiet w UI,
 * nie do zapisu) to `plikZrodlowy`, żeby te dwie zupełnie różne rzeczy
 * (nazwa tekstowa kontra bajty gotowego dokumentu) nie nosiły tej samej nazwy.
 */
function wypelnij(kod, dane) {
  const { plik: plikZrodlowy, nazwa, bufor, hash } = wczytaj(kod);
  const wynik = docx.wypelnij(bufor, dane);
  return { kod, plikZrodlowy, nazwa, hash, ...wynik };
}

module.exports = { KATALOG_WZOROW, listaWzorow, wczytaj, analizuj, wypelnij };
