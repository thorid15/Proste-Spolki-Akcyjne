'use strict';

/**
 * Hasla - jedyna nowa zaleznosc bezpieczenstwa modulu (sekcja 11 i 13
 * specyfikacji): `bcrypt`. Zero wlasnej kryptografii haszujacej.
 */

const bcrypt = require('bcrypt');

const KOSZT = 12;

function hashuj(haslo) {
  return bcrypt.hash(String(haslo), KOSZT);
}

function zweryfikuj(haslo, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(String(haslo), hash);
}

/**
 * Minimalna polityka silnego hasla (naprawa B1, FAZA 2 sesji frontendowej).
 * Dlugosc bez wymogow skladu (litera+cyfra) - taki wymog nie zwieksza
 * realnej sily hasla (NIST SP 800-63B), a jedynie zniecheca do hasel
 * wygenerowanych przez menedzera hasel (np. same znaki specjalne i cyfry
 * bez litery, albo odwrotnie), ktore sa silniejsze niz cokolwiek spelniajace
 * wymog skladu. Dlugosc 12 zamiast 10 - jedyny parametr, ktory realnie
 * zwieksza entropie.
 */
function ocenSile(haslo) {
  const tekst = String(haslo || '');
  if (tekst.length < 12) {
    return { ok: false, powod: 'Hasło musi mieć co najmniej 12 znaków.' };
  }
  return { ok: true, powod: null };
}

/** Losowe hasło tymczasowe - konto administratora przy pierwszym starcie. */
function losoweHaslo() {
  const crypto = require('node:crypto');
  return crypto.randomBytes(10).toString('base64url');
}

module.exports = { hashuj, zweryfikuj, ocenSile, losoweHaslo };
