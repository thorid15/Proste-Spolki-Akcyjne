'use strict';

/**
 * Opłaty (U-02, U-30, § 3.3): do zapłaty → opłacona albo anulowana (z powodem). Numer faktury to
 * pole, nie stan. Kwoty netto w groszach; brutto wylicza `przepisy.obliczBrutto` — nie zapisuje się.
 */

const czas = require('./pomocnicze/czas');
const przepisy = require('./logika/przepisy');
const daneOplaty = require('./dane/oplaty');
const { BladWalidacji } = require('./logika/walidacje');

const PRZEJSCIA = {
  do_zaplaty: ['oplacona', 'anulowana'],
  oplacona: [],
  anulowana: [],
};

const RODZAJ = { prowadzenie: 'Prowadzenie rejestru', wpis: 'Wpis', informacja: 'Informacja z rejestru' };
const STAN = { do_zaplaty: 'do zapłaty', oplacona: 'opłacona', anulowana: 'anulowana' };
const FILTRY = ['do_zaplaty', 'oplacone', 'wszystkie'];

function wiersz(o) {
  return {
    ...o,
    rodzaj: RODZAJ[o.typ],
    kwota_brutto_grosze: przepisy.obliczBrutto(o.kwota_netto_grosze, o.stawka_vat_procent),
  };
}

function lista(db, { filtr = 'do_zaplaty', spolkaId = null } = {}) {
  if (!FILTRY.includes(filtr)) throw new BladWalidacji([{ pole: 'filtr', komunikat: 'Nieznany filtr opłat.' }]);
  return daneOplaty.lista(db, { spolkaId, stan: { do_zaplaty: 'do_zaplaty', oplacone: 'oplacona', wszystkie: null }[filtr] }).map(wiersz);
}

function wczytaj(db, id) {
  const o = daneOplaty.wczytaj(db, id);
  if (!o) throw new BladWalidacji(['Nie odnaleziono opłaty.']);
  return o;
}

function zmienStan(db, id, na, pola = {}) {
  const o = wczytaj(db, id);
  if (!PRZEJSCIA[o.stan].includes(na)) throw new BladWalidacji([`Opłata w stanie „${o.stan}” nie może przejść do stanu „${na}”.`]);
  daneOplaty.ustawStan(db, id, na, pola);
  return wiersz(daneOplaty.wczytaj(db, id));
}

/** „Opłacona” — dzisiejsza data. */
function oplacona(db, id) {
  return zmienStan(db, id, 'oplacona', { oplacono: czas.dzisIso() });
}

function anuluj(db, id, powod) {
  const p = String(powod || '').trim();
  if (p.length < 3) throw new BladWalidacji([{ pole: 'powod', komunikat: 'Podaj powód anulowania.' }]);
  return zmienStan(db, id, 'anulowana', { powod_anulowania: p });
}

function ustawFakture(db, id, numer) {
  wczytaj(db, id);
  daneOplaty.ustawFakture(db, id, String(numer || '').trim() || null);
  return wiersz(daneOplaty.wczytaj(db, id));
}

const kwota = (grosze) => (grosze / 100).toFixed(2).replace('.', ',');
function pole(v) {
  const t = v == null ? '' : String(v);
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Eksport CSV (Excel w polskich ustawieniach: średnik, przecinek dziesiętny). */
function csv(wiersze) {
  const naglowek = ['Data', 'Spółka', 'Płatnik', 'Rodzaj', 'Okres', 'Netto', 'Brutto', 'Stan', 'Numer faktury', 'Opłacono'];
  const linie = wiersze.map((o) =>
    [czas.dzienLokalny(o.utworzono), o.spolka_nazwa, o.platnik_nazwa, o.rodzaj, o.okres, kwota(o.kwota_netto_grosze), kwota(o.kwota_brutto_grosze), STAN[o.stan], o.numer_faktury, o.oplacono]
      .map(pole)
      .join(';')
  );
  return `${[naglowek.join(';'), ...linie].join('\r\n')}\r\n`;
}

module.exports = { PRZEJSCIA, FILTRY, lista, oplacona, anuluj, ustawFakture, csv };
