'use strict';

/**
 * Opłaty (U-02, U-30, § 3.3): do zapłaty → opłacona albo anulowana (z powodem). Numer faktury to
 * pole, nie stan. Kwoty netto w groszach; brutto wylicza `przepisy.obliczBrutto` — nie zapisuje się.
 */

const czas = require('./pomocnicze/czas');
const przepisy = require('./logika/przepisy');
const terminy = require('./logika/terminy');
const daneOplaty = require('./dane/oplaty');
const daneSpolki = require('./dane/spolki');
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
/** Pole CSV; tekst zaczynający się od =, +, -, @ dostaje apostrof — Excel nie uruchomi go jako formuły. */
function pole(v) {
  const s = v == null ? '' : String(v);
  const t = typeof v === 'string' && /^[=+\-@]/.test(s) ? `'${s}` : s;
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

/** Początek k-tego okresu od dnia otwarcia: co `miesiecy` miesięcy, ten sam dzień (31 → ostatni dzień miesiąca). */
function poczatekOkresu(otwarcie, k, miesiecy) {
  const [rok, mies, dzien] = otwarcie.split('-').map(Number);
  const t = mies - 1 + k * miesiecy;
  const r = rok + Math.floor(t / 12);
  const m = (t % 12) + 1;
  const ostatni = new Date(Date.UTC(r, m, 0)).getUTCDate();
  return `${r}-${String(m).padStart(2, '0')}-${String(Math.min(dzien, ostatni)).padStart(2, '0')}`;
}

/**
 * U-30: opłaty za prowadzenie rejestru — rocznie (w rocznicę otwarcia) albo co miesiąc (w dniu
 * otwarcia); każda rata osobno, okres „RRRR-MM-DD..RRRR-MM-DD”. Nadrabia dni bez uruchomienia,
 * zaczyna od końca ostatniego naliczonego okresu (zmiana sposobu płatności niczego nie dubluje),
 * po zamknięciu rejestru nie nalicza. Zwraca liczbę nowych opłat.
 */
function naliczProwadzenie(db, { dzis = czas.dzisIso(), autor = 'proces dzienny' } = {}) {
  return db.transaction(() => {
    let nowe = 0;
    for (const s of daneSpolki.zRejestrem(db)) {
      const otwarcie = czas.dzienLokalny(s.data_otwarcia);
      const zamkniecie = s.data_zamkniecia ? czas.dzienLokalny(s.data_zamkniecia) : null;
      const ostatni = daneOplaty.ostatniOkresProwadzenia(db, s.id);
      const od = ostatni ? terminy.dodajDni(ostatni.split('..')[1], 1) : otwarcie;
      const miesiecy = s.platnosc === 'miesieczna' ? 1 : 12;
      for (let k = 0; ; k += 1) {
        const start = poczatekOkresu(otwarcie, k, miesiecy);
        if (start > dzis || (zamkniecie && start >= zamkniecie)) break;
        if (start < od) continue;
        daneOplaty.dodaj(db, {
          spolka_id: s.id,
          typ: 'prowadzenie',
          platnik: 'spolka',
          okres: `${start}..${terminy.dodajDni(poczatekOkresu(otwarcie, k + 1, miesiecy), -1)}`,
          kwota_netto_grosze: miesiecy === 1 ? przepisy.STAWKI_GROSZE.PROWADZENIE_MIESIECZNIE : przepisy.STAWKI_GROSZE.PROWADZENIE_ROCZNIE,
          stawka_vat_procent: przepisy.STAWKA_VAT_PROCENT,
          autor,
        });
        nowe += 1;
      }
    }
    return nowe;
  })();
}

module.exports = { PRZEJSCIA, FILTRY, lista, oplacona, anuluj, ustawFakture, csv, kwota, poczatekOkresu, naliczProwadzenie };
