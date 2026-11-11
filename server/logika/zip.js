'use strict';

/**
 * Zapisywanie archiwów ZIP (eksport rejestru — art. 90a PrNot) bez zależności zewnętrznych: `zlib`
 * z biblioteki standardowej (`deflateRawSync`) i ręcznie zapisane nagłówki. Bez ZIP64 i szyfrowania.
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
// Zapisywanie
// ─────────────────────────────────────────────────────────────

/** Buduje archiwum z listy wpisów `{ nazwa, dane }` (Buffer albo tekst) w podanej kolejności. */
function zapisz(wpisy) {
  const kawalki = [];
  const katalog = [];
  let przesuniecie = 0;

  for (const wpis of wpisy) {
    const dane = Buffer.isBuffer(wpis.dane) ? wpis.dane : Buffer.from(String(wpis.dane), 'utf8');
    const crc = crc32(dane);
    const rozmiar = dane.length;
    let metoda = 8;
    let daneSkompresowane = zlib.deflateRawSync(dane, { level: 9 });
    // Deflate potrafi na krótkich, nieściśliwych danych urosnąć — wtedy zapis wprost.
    if (daneSkompresowane.length >= dane.length) {
      metoda = 0;
      daneSkompresowane = dane;
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

module.exports = { zapisz };
