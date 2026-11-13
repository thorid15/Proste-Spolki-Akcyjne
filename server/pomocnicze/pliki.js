'use strict';

/**
 * Pliki przychodzące — jedna funkcja przyjęcia (§ 7 pkt 3) i bezpieczne pobieranie.
 *
 * Biała lista: PDF, JPG, PNG i formaty podpisu (XAdES — XML, CAdES — P7S/P7M), sprawdzana po
 * rozszerzeniu i sygnaturze treści; limit 10 MB; losowa nazwa na dysku w katalogu poza
 * `publiczne/`. Wgrany „skan” z treścią HTML nie przejdzie jako PDF, a pobranie zawsze idzie
 * jako załącznik z `nosniff`.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

const konfiguracja = require('../konfiguracja');
const danePliki = require('../dane/pliki');
const { BladWalidacji } = require('../logika/walidacje');

const LIMIT_BAJTOW = 10 * 1024 * 1024;
/** Audyt W3: ile plików i megabajtów łącznie przyjmuje jeden wniosek albo jedna sprawa (pełny dysk zatrzymuje bazę). */
const LIMITY = { liczba: 30, megabajty: 100 };

const TYPY = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.p7s': 'application/pkcs7-signature',
  '.p7m': 'application/pkcs7-mime',
};

/** Czy początek treści odpowiada typowi. XML — znacznik `<?xml` (po ewentualnym BOM). */
function trescPasuje(bufor, typ) {
  const poczatek = (b) => bufor.subarray(0, b.length).equals(b);
  switch (typ) {
    case 'application/pdf':
      return poczatek(Buffer.from('%PDF-'));
    case 'image/jpeg':
      return poczatek(Buffer.from([0xff, 0xd8, 0xff]));
    case 'image/png':
      return poczatek(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'application/xml':
      return /^(﻿)?<\?xml/.test(bufor.subarray(0, 64).toString('utf8'));
    default:
      return bufor.length > 0 && bufor[0] === 0x30; // DER SEQUENCE (CMS)
  }
}

/**
 * Multer: wyłącznie jeden plik w polu `plik`, w pamięci (zapis na dysk robi `przyjmij`). Pól tekstowych formularz
 * wgrania nie ma (`fields: 0`) — parametry (np. którego dokumentu dotyczy plik) idą w adresie. Powód (audyt W1):
 * parser nazw pól zawiesza proces na nazwach w rodzaju `a[4294967294][0]`, także w multer 2.x; przy `fields: 0`
 * żadna nazwa pola nie jest parsowana, a takie żądanie kończy się od razu błędem 400.
 */
const odbierz = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMIT_BAJTOW, files: 1, fields: 0, parts: 1 },
}).single('plik');

/** Nazwa pliku od przeglądarki (multer czyta ją jako latin1) — bez ścieżki i znaków sterujących. */
function nazwaPliku(surowa) {
  const nazwa = Buffer.from(String(surowa || 'plik'), 'latin1').toString('utf8');
  // eslint-disable-next-line no-control-regex
  return path.basename(nazwa).replace(/[\u0000-\u001f\\/]/g, '_').slice(0, 200) || 'plik';
}

/** Audyt W3: limit liczby i łącznego rozmiaru plików wniosku albo sprawy. */
function sprawdzLimit(db, wlasciciel, nowyBajtow) {
  const dotychczasowe = wlasciciel.wniosek_id ? danePliki.wniosku(db, wlasciciel.wniosek_id)
    : wlasciciel.sprawa_id ? danePliki.lista(db, { sprawaId: wlasciciel.sprawa_id }) : null;
  if (!dotychczasowe) return;
  const bajty = dotychczasowe.reduce((suma, p) => {
    try {
      return suma + fs.statSync(path.join(konfiguracja.KATALOG_DOKUMENTOW, path.basename(p.sciezka))).size;
    } catch {
      return suma;
    }
  }, nowyBajtow);
  if (dotychczasowe.length >= LIMITY.liczba || bajty > LIMITY.megabajty * 1024 * 1024) {
    throw new BladWalidacji([{ pole: 'plik', komunikat: 'Limit plików został wyczerpany — skontaktuj się z kancelarią.' }]);
  }
}

/**
 * Przyjmuje plik i zapisuje go w `psa_pliki`. `wlasciciel` = { spolka_id, osoba_id, sprawa_id,
 * wniosek_id }; `kto` zapisuje się sam. Zwraca id pliku.
 */
function przyjmij(db, plik, wlasciciel, kto) {
  if (!plik || !plik.buffer) throw new BladWalidacji([{ pole: 'plik', komunikat: 'Wybierz plik.' }]);
  sprawdzLimit(db, wlasciciel, plik.buffer.length);
  const nazwa = nazwaPliku(plik.originalname);
  const rozszerzenie = path.extname(nazwa).toLowerCase();
  const typ = TYPY[rozszerzenie];
  if (!typ || !trescPasuje(plik.buffer, typ)) throw new BladWalidacji([{ pole: 'plik', komunikat: 'Wgraj plik PDF.' }]);
  const sciezka = `${crypto.randomUUID()}${rozszerzenie}`;
  fs.mkdirSync(konfiguracja.KATALOG_DOKUMENTOW, { recursive: true });
  fs.writeFileSync(path.join(konfiguracja.KATALOG_DOKUMENTOW, sciezka), plik.buffer, { flag: 'wx' });
  return danePliki.dodaj(db, {
    ...wlasciciel,
    nazwa,
    sciezka,
    typ,
    sha256: crypto.createHash('sha256').update(plik.buffer).digest('hex'),
    wgral: kto,
  });
}

/** Wysyła plik jako załącznik. */
function wyslij(odp, plik) {
  const pelna = path.join(konfiguracja.KATALOG_DOKUMENTOW, path.basename(plik.sciezka));
  odp.setHeader('Content-Type', plik.typ);
  odp.setHeader('X-Content-Type-Options', 'nosniff');
  odp.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(plik.nazwa)}`);
  odp.sendFile(pelna);
}

module.exports = { TYPY, LIMITY, odbierz, przyjmij, wyslij };
