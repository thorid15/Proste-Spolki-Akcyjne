'use strict';

/**
 * Czytanie i zapisywanie archiwów ZIP — bez zależności zewnętrznych.
 *
 * Plik `.docx` to zwykły ZIP z kilkunastoma częściami XML. Do jego obsługi
 * wystarczy `zlib` z biblioteki standardowej Node (`inflateRawSync` /
 * `deflateRawSync`) plus ręcznie napisane czytanie nagłówków. Master, sekcja 4:
 * żadnych bibliotek — a ZIP jest na tyle prostym formatem, że jego obsługa
 * mieści się w jednym pliku i nie wymaga kompromisu.
 *
 * Zakres celowo ograniczony do tego, co produkuje Word:
 *   — metoda 0 (bez kompresji) i 8 (deflate),
 *   — brak ZIP64 (pliki .docx nie zbliżają się do 4 GB),
 *   — brak szyfrowania.
 * Wszystko poza tym kończy się czytelnym błędem zamiast cichego uszkodzenia
 * dokumentu.
 *
 * Przy zapisie części NIEZMIENIONE przechodzą bajt w bajt — z oryginalną
 * metodą, sumą kontrolną i rozmiarami. Rekompresujemy wyłącznie to, co
 * podmieniamy (w praktyce `word/document.xml`). Dzięki temu obrazy, czcionki
 * i reszta zawartości wzoru nie mają jak się zepsuć.
 */

const zlib = require('zlib');

const SYG_LOKALNY = 0x04034b50;
const SYG_CENTRALNY = 0x02014b50;
const SYG_EOCD = 0x06054b50;

// ─────────────────────────────────────────────────────────────
// CRC-32 (ten sam wielomian co w ZIP i PNG)
// ─────────────────────────────────────────────────────────────

const TABLICA_CRC = (() => {
  const tablica = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let wartosc = i;
    for (let bit = 0; bit < 8; bit++) {
      wartosc = wartosc & 1 ? 0xedb88320 ^ (wartosc >>> 1) : wartosc >>> 1;
    }
    tablica[i] = wartosc;
  }
  return tablica;
})();

function crc32(bufor) {
  let suma = -1;
  for (let i = 0; i < bufor.length; i++) {
    suma = TABLICA_CRC[(suma ^ bufor[i]) & 0xff] ^ (suma >>> 8);
  }
  return (suma ^ -1) >>> 0;
}

// ─────────────────────────────────────────────────────────────
// Czytanie
// ─────────────────────────────────────────────────────────────

function znajdzEocd(bufor) {
  // Komentarz archiwum ma najwyżej 65535 bajtów, więc dalej niż o tyle
  // od końca EOCD być nie może.
  const dolna = Math.max(0, bufor.length - 22 - 0xffff);
  for (let i = bufor.length - 22; i >= dolna; i--) {
    if (bufor.readUInt32LE(i) === SYG_EOCD) return i;
  }
  return -1;
}

/**
 * Rozkłada archiwum na listę wpisów.
 *
 * Rozmiary bierzemy z katalogu centralnego, nie z nagłówka lokalnego — gdy Word
 * użyje deskryptora danych (flaga bit 3), w nagłówku lokalnym stoją zera.
 *
 * @param {Buffer} bufor
 * @returns {{ nazwa: string, metoda: number, flagi: number, crc: number,
 *             czas: number, data: number, atrybuty: number,
 *             daneSkompresowane: Buffer, rozmiar: number }[]}
 */
function czytaj(bufor) {
  if (!Buffer.isBuffer(bufor) || bufor.length < 22) {
    throw new Error('To nie jest archiwum ZIP — plik jest za krótki.');
  }
  const eocd = znajdzEocd(bufor);
  if (eocd < 0) throw new Error('To nie jest archiwum ZIP — brak stopki katalogu (EOCD).');

  const liczbaWpisow = bufor.readUInt16LE(eocd + 10);
  const poczatekKatalogu = bufor.readUInt32LE(eocd + 16);
  if (liczbaWpisow === 0xffff || poczatekKatalogu === 0xffffffff) {
    throw new Error('Archiwum w formacie ZIP64 — nieobsługiwane.');
  }

  const wpisy = [];
  let pozycja = poczatekKatalogu;
  for (let n = 0; n < liczbaWpisow; n++) {
    if (pozycja + 46 > bufor.length || bufor.readUInt32LE(pozycja) !== SYG_CENTRALNY) {
      throw new Error(`Uszkodzony katalog centralny ZIP (wpis ${n + 1} z ${liczbaWpisow}).`);
    }
    const flagi = bufor.readUInt16LE(pozycja + 8);
    const metoda = bufor.readUInt16LE(pozycja + 10);
    const czas = bufor.readUInt16LE(pozycja + 12);
    const data = bufor.readUInt16LE(pozycja + 14);
    const crc = bufor.readUInt32LE(pozycja + 16);
    const rozmiarSkompresowany = bufor.readUInt32LE(pozycja + 20);
    const rozmiar = bufor.readUInt32LE(pozycja + 24);
    const dlugoscNazwy = bufor.readUInt16LE(pozycja + 28);
    const dlugoscExtra = bufor.readUInt16LE(pozycja + 30);
    const dlugoscKomentarza = bufor.readUInt16LE(pozycja + 32);
    const atrybuty = bufor.readUInt32LE(pozycja + 38);
    const przesuniecieLokalne = bufor.readUInt32LE(pozycja + 42);
    const nazwa = bufor.slice(pozycja + 46, pozycja + 46 + dlugoscNazwy).toString('utf8');

    if (flagi & 0x1) throw new Error(`Wpis „${nazwa}" jest zaszyfrowany — nieobsługiwane.`);
    if (metoda !== 0 && metoda !== 8) {
      throw new Error(`Wpis „${nazwa}" użyto metody kompresji ${metoda} — obsługujemy 0 i 8.`);
    }
    if (bufor.readUInt32LE(przesuniecieLokalne) !== SYG_LOKALNY) {
      throw new Error(`Uszkodzony nagłówek lokalny wpisu „${nazwa}".`);
    }
    const lokalneDlugoscNazwy = bufor.readUInt16LE(przesuniecieLokalne + 26);
    const lokalneDlugoscExtra = bufor.readUInt16LE(przesuniecieLokalne + 28);
    const poczatekDanych =
      przesuniecieLokalne + 30 + lokalneDlugoscNazwy + lokalneDlugoscExtra;

    wpisy.push({
      nazwa,
      metoda,
      // Bit 3 (deskryptor danych) odpada: przy zapisie rozmiary znamy z góry.
      flagi: flagi & ~0x8,
      crc,
      czas,
      data,
      atrybuty,
      rozmiar,
      daneSkompresowane: bufor.slice(poczatekDanych, poczatekDanych + rozmiarSkompresowany),
    });
    pozycja += 46 + dlugoscNazwy + dlugoscExtra + dlugoscKomentarza;
  }
  return wpisy;
}

/** Rozpakowuje zawartość jednego wpisu. */
function rozpakuj(wpis) {
  const dane =
    wpis.metoda === 8 ? zlib.inflateRawSync(wpis.daneSkompresowane) : wpis.daneSkompresowane;
  if (crc32(dane) !== wpis.crc) {
    throw new Error(`Suma kontrolna wpisu „${wpis.nazwa}" się nie zgadza — plik jest uszkodzony.`);
  }
  return dane;
}

/** Wpisy archiwum jako mapa nazwa → Buffer (wygodne przy czytaniu .docx). */
function rozpakujWszystko(bufor) {
  const czesci = new Map();
  for (const wpis of czytaj(bufor)) czesci.set(wpis.nazwa, rozpakuj(wpis));
  return czesci;
}

// ─────────────────────────────────────────────────────────────
// Zapisywanie
// ─────────────────────────────────────────────────────────────

/**
 * Buduje archiwum z listy wpisów w podanej kolejności.
 *
 * Wpis niosący `dane` (Buffer) zostaje skompresowany od nowa; wpis bez `dane`
 * przechodzi w postaci, w jakiej przyszedł z `czytaj()`.
 */
function zapisz(wpisy) {
  const kawalki = [];
  const katalog = [];
  let przesuniecie = 0;

  for (const wpis of wpisy) {
    let { metoda, crc, rozmiar, daneSkompresowane } = wpis;
    if (wpis.dane != null) {
      const dane = Buffer.isBuffer(wpis.dane) ? wpis.dane : Buffer.from(String(wpis.dane), 'utf8');
      metoda = 8;
      crc = crc32(dane);
      rozmiar = dane.length;
      daneSkompresowane = zlib.deflateRawSync(dane, { level: 9 });
      // Deflate potrafi na krótkich, nieściśliwych danych urosnąć — wtedy
      // taniej i bezpieczniej zapisać wprost.
      if (daneSkompresowane.length >= dane.length) {
        metoda = 0;
        daneSkompresowane = dane;
      }
    }

    const nazwa = Buffer.from(wpis.nazwa, 'utf8');
    const naglowek = Buffer.alloc(30);
    naglowek.writeUInt32LE(SYG_LOKALNY, 0);
    naglowek.writeUInt16LE(20, 4); // wersja wymagana do rozpakowania
    naglowek.writeUInt16LE(wpis.flagi & ~0x8, 6);
    naglowek.writeUInt16LE(metoda, 8);
    naglowek.writeUInt16LE(wpis.czas || 0, 10);
    naglowek.writeUInt16LE(wpis.data || 0x21, 12); // 0x21 = 1980-01-01
    naglowek.writeUInt32LE(crc, 14);
    naglowek.writeUInt32LE(daneSkompresowane.length, 18);
    naglowek.writeUInt32LE(rozmiar, 22);
    naglowek.writeUInt16LE(nazwa.length, 26);
    naglowek.writeUInt16LE(0, 28); // pole dodatkowe pomijamy
    kawalki.push(naglowek, nazwa, daneSkompresowane);

    const wpisKatalogu = Buffer.alloc(46);
    wpisKatalogu.writeUInt32LE(SYG_CENTRALNY, 0);
    wpisKatalogu.writeUInt16LE(20, 4); // wersja twórcy
    wpisKatalogu.writeUInt16LE(20, 6); // wersja wymagana
    wpisKatalogu.writeUInt16LE(wpis.flagi & ~0x8, 8);
    wpisKatalogu.writeUInt16LE(metoda, 10);
    wpisKatalogu.writeUInt16LE(wpis.czas || 0, 12);
    wpisKatalogu.writeUInt16LE(wpis.data || 0x21, 14);
    wpisKatalogu.writeUInt32LE(crc, 16);
    wpisKatalogu.writeUInt32LE(daneSkompresowane.length, 20);
    wpisKatalogu.writeUInt32LE(rozmiar, 24);
    wpisKatalogu.writeUInt16LE(nazwa.length, 28);
    wpisKatalogu.writeUInt16LE(0, 30); // extra
    wpisKatalogu.writeUInt16LE(0, 32); // komentarz
    wpisKatalogu.writeUInt16LE(0, 34); // numer dysku
    wpisKatalogu.writeUInt16LE(0, 36); // atrybuty wewnętrzne
    wpisKatalogu.writeUInt32LE(wpis.atrybuty || 0, 38);
    wpisKatalogu.writeUInt32LE(przesuniecie, 42);
    katalog.push(wpisKatalogu, nazwa);

    przesuniecie += naglowek.length + nazwa.length + daneSkompresowane.length;
  }

  const bajtyKatalogu = Buffer.concat(katalog);
  const stopka = Buffer.alloc(22);
  stopka.writeUInt32LE(SYG_EOCD, 0);
  stopka.writeUInt16LE(0, 4); // numer dysku
  stopka.writeUInt16LE(0, 6); // dysk z katalogiem
  stopka.writeUInt16LE(wpisy.length, 8);
  stopka.writeUInt16LE(wpisy.length, 10);
  stopka.writeUInt32LE(bajtyKatalogu.length, 12);
  stopka.writeUInt32LE(przesuniecie, 16);
  stopka.writeUInt16LE(0, 20); // komentarz archiwum

  return Buffer.concat([...kawalki, bajtyKatalogu, stopka]);
}

module.exports = { crc32, czytaj, rozpakuj, rozpakujWszystko, zapisz };
