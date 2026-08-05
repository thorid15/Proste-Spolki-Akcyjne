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
 * Minimalna polityka silnego hasla - sekcja 11 nie precyzuje wymogow,
 * przyjmujemy rozsadne minimum: dlugosc + litera + cyfra.
 */
function ocenSile(haslo) {
  const tekst = String(haslo || '');
  if (tekst.length < 10) {
    return { ok: false, powod: 'Hasło musi mieć co najmniej 10 znaków.' };
  }
  if (!/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(tekst)) {
    return { ok: false, powod: 'Hasło musi zawierać co najmniej jedną literę.' };
  }
  if (!/[0-9]/.test(tekst)) {
    return { ok: false, powod: 'Hasło musi zawierać co najmniej jedną cyfrę.' };
  }
  return { ok: true, powod: null };
}

/** Losowe hasło tymczasowe - konto administratora przy pierwszym starcie. */
function losoweHaslo() {
  const crypto = require('node:crypto');
  return crypto.randomBytes(10).toString('base64url');
}

module.exports = { hashuj, zweryfikuj, ocenSile, losoweHaslo };
