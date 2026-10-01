'use strict';

/**
 * Daty i czas w kanonie ISO 8601 (master: daty ISO 8601).
 *
 * `data_wpisu` musi byc czasem LOKALNYM kancelarii co do sekundy - trafia
 * na zawiadomienia o wpisie jako "data i godzina wpisu". Zapisujemy ja
 * z przesunieciem strefy, zeby byla jednoznaczna takze po zmianie czasu.
 * Strefe ustawia zmienna `TZ` (domyslnie Europe/Warsaw).
 */

function dwie(liczba) {
  return String(liczba).padStart(2, '0');
}

/** Biezaca chwila jako `2026-08-04T17:45:12+02:00`. */
function terazIso(data = new Date()) {
  const przesuniecieMin = -data.getTimezoneOffset();
  const znak = przesuniecieMin >= 0 ? '+' : '-';
  const abs = Math.abs(przesuniecieMin);
  const strefa = `${znak}${dwie(Math.floor(abs / 60))}:${dwie(abs % 60)}`;
  return (
    `${data.getFullYear()}-${dwie(data.getMonth() + 1)}-${dwie(data.getDate())}` +
    `T${dwie(data.getHours())}:${dwie(data.getMinutes())}:${dwie(data.getSeconds())}${strefa}`
  );
}

/** Dzisiejsza data lokalna jako `RRRR-MM-DD`. */
function dzisIso(data = new Date()) {
  return `${data.getFullYear()}-${dwie(data.getMonth() + 1)}-${dwie(data.getDate())}`;
}

/** Czy tekst jest poprawna data kalendarzowa w formacie `RRRR-MM-DD`. */
function poprawnaData(tekst) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tekst || ''))) return false;
  const [r, m, d] = String(tekst).split('-').map(Number);
  const data = new Date(Date.UTC(r, m - 1, d));
  return (
    data.getUTCFullYear() === r && data.getUTCMonth() === m - 1 && data.getUTCDate() === d
  );
}

/**
 * Czy tekst jest poprawna chwila `RRRR-MM-DDTGG:MM` (opcjonalnie `:SS`) -
 * „stan na" z dokladnoscia do minuty (sekcja 2.3 SESJA-PSA-5-INTERFEJS.md).
 * Sama walidacja formatu i zakresu pol - bez stref, zgodnie z `data_wpisu`
 * (czas lokalny kancelarii, `TZ` procesu).
 */
function poprawnaChwila(tekst) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(tekst || ''));
  if (!m) return false;
  if (!poprawnaData(m[1])) return false;
  const godz = Number(m[2]);
  const min = Number(m[3]);
  const sek = m[4] == null ? 0 : Number(m[4]);
  return godz >= 0 && godz <= 23 && min >= 0 && min <= 59 && sek >= 0 && sek <= 59;
}

/** Czy tekst jest data (`RRRR-MM-DD`) albo chwila (`RRRR-MM-DDTGG:MM[:SS]`). */
function poprawnaDataAlboChwila(tekst) {
  return poprawnaData(tekst) || poprawnaChwila(tekst);
}

// ─────────────────────────────────────────────────────────────
// D-R01 — chwila wpisu do rejestru (UTC)
// ─────────────────────────────────────────────────────────────
//
// `psa_zdarzenia.data_wpisu` (i pochodne `data_od`/`data_do` w projekcji
// stanu) to znacznik UTC `RRRR-MM-DDTGG:MM:SSZ`. Jeden, staly format -
// porownania tekstowe sa wtedy porownaniami chwil. Prezentacja zawsze w
// strefie kancelarii (Europe/Warsaw, wymuszona przez `konfiguracja.js`),
// stad funkcje `dzienLokalny`/`godzinaLokalna` nizej.

/** Chwila jako `RRRR-MM-DDTGG:MM:SSZ` (UTC, bez milisekund). */
function utc(data) {
  return data.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Biezaca chwila w UTC - jedyne zrodlo `data_wpisu`. */
function terazUtc(data = new Date()) {
  return utc(data);
}

/**
 * Normalizuje wskazanie chwili do UTC:
 * - `RRRR-MM-DD` → poludnie tego dnia czasu lokalnego (uzywane wylacznie
 *   przez wstrzykiwany zegar testow i przez date rejestracji z KRN, gdy
 *   KRN nie podaje godziny),
 * - `RRRR-MM-DDTGG:MM[:SS]` bez strefy → czas lokalny kancelarii,
 * - z `Z` albo przesunieciem → wprost.
 */
function chwilaUtc(tekst) {
  const t = String(tekst || '');
  if (poprawnaData(t)) {
    const [r, m, d] = t.split('-').map(Number);
    return utc(new Date(r, m - 1, d, 12, 0, 0));
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (m) {
    return utc(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
  }
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) throw new Error(`Niepoprawne wskazanie chwili: „${t}”.`);
  return utc(new Date(ms));
}

/** Koniec dnia `RRRR-MM-DD` (23:59:59 czasu lokalnego) jako UTC - „stan na dzien D”. */
function koniecDniaUtc(dzien) {
  const [r, m, d] = String(dzien).slice(0, 10).split('-').map(Number);
  return utc(new Date(r, m - 1, d, 23, 59, 59));
}

/**
 * Dzien kalendarzowy w strefie kancelarii. Dla samej daty (`RRRR-MM-DD`)
 * zwraca ja bez zmian - daty dzienne nie maja strefy.
 */
function dzienLokalny(iso) {
  if (!iso) return null;
  const t = String(iso);
  if (!t.includes('T')) return t.slice(0, 10);
  return dzisIso(new Date(t));
}

/** Godzina `GG:MM` (albo `GG:MM:SS`) w strefie kancelarii; `null` dla samej daty. */
function godzinaLokalna(iso, { sekundy = false } = {}) {
  if (!iso || !String(iso).includes('T')) return null;
  const d = new Date(String(iso));
  const g = `${dwie(d.getHours())}:${dwie(d.getMinutes())}`;
  return sekundy ? `${g}:${dwie(d.getSeconds())}` : g;
}

module.exports = {
  terazIso,
  dzisIso,
  poprawnaData,
  poprawnaChwila,
  poprawnaDataAlboChwila,
  terazUtc,
  chwilaUtc,
  koniecDniaUtc,
  dzienLokalny,
  godzinaLokalna,
};
