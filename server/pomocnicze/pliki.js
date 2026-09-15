'use strict';

/**
 * Bezpieczne typowanie plikow wgrywanych przez klientow.
 *
 * Powod: `multer` podaje `plik.mimetype` PRZEPISANY Z NAGLOWKA ZADANIA, czyli
 * z tego, co przyslala przegladarka klienta. Jesli ten typ zapiszemy do bazy
 * i pozniej oddamy w `Content-Type`, klient decyduje, jak jego plik zostanie
 * potraktowany po drugiej stronie. Plik nazwany „skan-umowy.pdf", wyslany
 * jako `text/html`, wracal do pracownika jako strona HTML wyswietlana
 * w ramce — ze skryptem dzialajacym w sesji kancelarii.
 *
 * Dlatego typ ustala SERWER, na podstawie rozszerzenia z bialej listy, a tresc
 * musi sie zgadzac z sygnatura pliku. Co nie jest rozpoznane, idzie jako
 * `application/octet-stream` do pobrania — nigdy do wyswietlenia.
 */

const fs = require('node:fs');
const path = require('node:path');

/** Rozszerzenie → typ, ktory wolno oddac przegladarce. */
const TYPY = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** Typy, ktore wolno pokazac W RAMCE. Reszta zawsze jako zalacznik. */
const DO_PODGLADU = new Set(['application/pdf', 'image/jpeg', 'image/png']);

/** Pierwsze bajty, po ktorych poznaje sie format. `null` = nie sprawdzamy. */
const SYGNATURY = {
  'application/pdf': [Buffer.from('%PDF-')],
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  // .docx to ZIP, .doc to strumien OLE2 — obie sygnatury dzieli wiele
  // formatow, wiec sprawdzamy tylko, ze to nie jest tekst/HTML.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  'application/msword': [Buffer.from([0xd0, 0xcf, 0x11, 0xe0])],
};

/** Typ wynikajacy z nazwy pliku — nigdy z tego, co podal klient. */
function typZNazwy(nazwaPliku) {
  return TYPY[path.extname(String(nazwaPliku || '')).toLowerCase()] || 'application/octet-stream';
}

/** Czy tresc pliku odpowiada typowi? Bez sygnatury w tabeli — przepuszczamy. */
function trescPasuje(sciezkaNaDysku, typ) {
  const wzorce = SYGNATURY[typ];
  if (!wzorce) return true;
  let uchwyt;
  try {
    uchwyt = fs.openSync(sciezkaNaDysku, 'r');
    const bufor = Buffer.alloc(8);
    const ile = fs.readSync(uchwyt, bufor, 0, 8, 0);
    return wzorce.some((w) => bufor.slice(0, Math.min(ile, w.length)).equals(w));
  } catch {
    return false;
  } finally {
    if (uchwyt !== undefined) fs.closeSync(uchwyt);
  }
}

/**
 * Ustawia naglowki odpowiedzi dla pliku z dysku.
 * `wRamce` jest PROSBA, nie rozkazem: format, ktorego nie ma na liscie
 * `DO_PODGLADU`, i tak pojdzie jako zalacznik.
 */
function naglowkiPliku(odp, { nazwaPliku, wRamce = false }) {
  const typ = typZNazwy(nazwaPliku);
  const inline = wRamce && DO_PODGLADU.has(typ);
  odp.setHeader('Content-Type', typ);
  odp.setHeader('X-Content-Type-Options', 'nosniff');
  odp.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(nazwaPliku || 'dokument')}`
  );
}

module.exports = { TYPY, DO_PODGLADU, typZNazwy, trescPasuje, naglowkiPliku };
