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

module.exports = { terazIso, dzisIso, poprawnaData, poprawnaChwila, poprawnaDataAlboChwila };
