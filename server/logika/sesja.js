'use strict';

/**
 * Sesje logowania - wlasny, bezstanowy token podpisany HMAC-SHA256
 * (`node:crypto`, zero zaleznosci - zadnego JWT-a, sekcja 13/11).
 *
 * Token = base64url(JSON payload) + "." + base64url(HMAC podpisu payloadu).
 * Payload niesie tylko identyfikator i typ podmiotu + czas wygasniecia -
 * caly stan konta czytamy z bazy przy kazdym zadaniu (odswieza sie od razu
 * po dezaktywacji konta), token sluzy wylacznie do potwierdzenia tozsamosci.
 *
 * Sekret bierzemy z `SESJA_SEKRET` (sekcja 12). Brak sekretu w produkcji
 * byłby błędem operacyjnym, ale moduł ma dalej ruszyć w dev bez `.env” -
 * generujemy wtedy sekret efemeryczny (ginie przy restarcie -> wszyscy
 * wylogowani, co jest bezpiecznym zachowaniem, nie cichym dziurawieniem).
 */

const crypto = require('node:crypto');
const konfiguracja = require('../konfiguracja');

let SEKRET = konfiguracja.SESJA_SEKRET;
if (!SEKRET) {
  SEKRET = crypto.randomBytes(32).toString('hex');
  console.warn(
    '[psa] SESJA_SEKRET nie jest ustawiony — użyto sekretu tymczasowego. ' +
      'Wszystkie sesje wygasną po restarcie serwera. Ustaw SESJA_SEKRET w .env przed produkcją.'
  );
}

const TYPY = ['pracownik', 'konto'];

function b64uKoduj(bufOrStr) {
  return Buffer.from(bufOrStr).toString('base64url');
}

function b64uDekoduj(tekst) {
  return Buffer.from(String(tekst), 'base64url');
}

function podpis(tresc) {
  return crypto.createHmac('sha256', SEKRET).update(tresc).digest();
}

/**
 * @param {{typ: 'pracownik'|'konto', id: number}} podmiot
 * @param {number} ttlMs
 * @returns {string} token
 */
function wystaw(podmiot, ttlMs) {
  if (!TYPY.includes(podmiot.typ)) throw new Error(`Nieznany typ podmiotu sesji: „${podmiot.typ}”.`);
  const tresc = JSON.stringify({ typ: podmiot.typ, id: Number(podmiot.id), exp: Date.now() + ttlMs });
  const koduTresc = b64uKoduj(tresc);
  const sygnatura = b64uKoduj(podpis(koduTresc));
  return `${koduTresc}.${sygnatura}`;
}

/** @returns {{typ: string, id: number}|null} */
function odczytaj(token) {
  if (!token || typeof token !== 'string') return null;
  const kropka = token.indexOf('.');
  if (kropka === -1) return null;
  const koduTresc = token.slice(0, kropka);
  const sygnatura = token.slice(kropka + 1);

  let oczekiwana;
  try {
    oczekiwana = podpis(koduTresc);
  } catch {
    return null;
  }
  let dana;
  try {
    dana = b64uDekoduj(sygnatura);
  } catch {
    return null;
  }
  if (dana.length !== oczekiwana.length || !crypto.timingSafeEqual(dana, oczekiwana)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(b64uDekoduj(koduTresc).toString('utf8'));
  } catch {
    return null;
  }
  if (!TYPY.includes(payload.typ) || !Number.isInteger(payload.id)) return null;
  if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;

  return { typ: payload.typ, id: payload.id };
}

const TTL_PRACOWNIK_MS = 12 * 60 * 60 * 1000; // 12h
const TTL_PORTAL_MS = 8 * 60 * 60 * 1000; // 8h

module.exports = { wystaw, odczytaj, TTL_PRACOWNIK_MS, TTL_PORTAL_MS };
