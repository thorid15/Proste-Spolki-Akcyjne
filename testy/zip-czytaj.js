'use strict';

/** Czytnik ZIP do testów eksportu rejestru (aplikacja tylko zapisuje archiwa — `server/logika/zip.js`). */

const zlib = require('node:zlib');

const SYG_LOKALNY = 0x04034b50;
const SYG_CENTRALNY = 0x02014b50;
const SYG_EOCD = 0x06054b50;


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
  if (zlib.crc32(dane) !== wpis.crc) {
    throw new Error(`Suma kontrolna wpisu „${wpis.nazwa}" się nie zgadza — plik jest uszkodzony.`);
  }
  return dane;
}

/** Wpisy archiwum jako mapa nazwa → Buffer. */
function rozpakujWszystko(bufor) {
  const czesci = new Map();
  for (const wpis of czytaj(bufor)) czesci.set(wpis.nazwa, rozpakuj(wpis));
  return czesci;
}

module.exports = { rozpakujWszystko };
