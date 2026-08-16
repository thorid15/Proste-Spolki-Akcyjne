'use strict';

/**
 * Przegląd okresowy AML — sygnał dezaktualizacji, NIE blokada wpisu (blok C
 * sesji 8, patrz uzasadnienie przy `przepisy.js: TERMIN_PRZEGLADU_AML_MIESIECY`).
 *
 * Moduł jest CZYSTY — operuje wyłącznie na przekazanych danych, bez dostępu
 * do bazy i bez efektów ubocznych (ten sam styl co `logika/terminy.js`).
 */

const { TERMIN_PRZEGLADU_AML_MIESIECY, AML_STATUSY } = require('./przepisy');

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Dodaje `miesiace` miesięcy kalendarzowych do daty ISO. */
function dodajMiesiace(iso, miesiace) {
  const [r, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const data = new Date(Date.UTC(r, m - 1, d));
  data.setUTCMonth(data.getUTCMonth() + miesiace);
  return data.toISOString().slice(0, 10);
}

/**
 * Czy przegląd AML osoby jest przeterminowany na dzień `dzis`.
 *
 * Dotyczy WYŁĄCZNIE osób z `aml_status === 'wykonane'` — status `brak` albo
 * `niemozliwe` ma już własny, wyraźniejszy sygnał (kolor znacznika AML),
 * dopisywanie do niego „wymaga przeglądu” tylko zaciemniałoby obraz.
 * Punktem odniesienia jest `aml_data_przegladu`, a gdy go nie ma —
 * `aml_data` (pierwotne wykonanie liczy się jako pierwszy „przegląd”).
 * Osoba bez żadnej z tych dat nie ma punktu odniesienia — traktowana jak
 * przeterminowana, żeby brak daty nie wyglądał lepiej niż jej brak.
 */
function wymagaPrzegladu(osoba, dzis) {
  if (!osoba || osoba.aml_status !== AML_STATUSY.WYKONANE) return false;
  const punktOdniesienia = osoba.aml_data_przegladu || osoba.aml_data;
  if (!punktOdniesienia || !DATA_ISO.test(String(punktOdniesienia).slice(0, 10))) return true;
  const termin = dodajMiesiace(punktOdniesienia, TERMIN_PRZEGLADU_AML_MIESIECY);
  return String(dzis).slice(0, 10) >= termin;
}

module.exports = { dodajMiesiace, wymagaPrzegladu };
