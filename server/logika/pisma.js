'use strict';

/**
 * Pisma wychodzące — jeden moduł (§ 4). Pismo powstaje wyłącznie z czynności (krok sprawy, wpis,
 * odmowa, wstrzymanie, zamówienie informacji); wysyła je pracownik po podglądzie (U-09).
 *
 * Faza 1: `utworz` zapisuje rekord pisma (bez PDF — wzory i PDF w Fazie 2), kanał wynika z R9,
 * a stan zmienia wyłącznie `zmienStan` według tabeli przejść.
 */

const czas = require('../pomocnicze/czas');
const danePisma = require('../dane/pisma');
const daneOsoby = require('../dane/osoby');
const daneSpolki = require('../dane/spolki');
const { BladWalidacji } = require('./walidacje');

const TYPY = {
  umowa: 'Umowa o prowadzenie rejestru akcjonariuszy',
  uchwala: 'Uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr',
  zgoda_email: 'Zgoda na korespondencję e-mail',
  powiadomienie_zamierzony: 'Powiadomienie o zamierzonym wpisie',
  powiadomienie_wpis: 'Powiadomienie o wpisie',
  powiadomienie_odmowa: 'Powiadomienie o odmowie',
  wezwanie: 'Wezwanie do uzupełnienia',
  informacja: 'Informacja z rejestru akcjonariuszy',
};

const PRZEJSCIA = {
  do_wyslania: ['wyslane', 'blad'],
  blad: ['wyslane', 'blad'],
  wyslane: [],
};

/**
 * R9: e-mail z PDF, gdy adresat ma zgodę na korespondencję e-mail (spółka — z umowy, czyli gdy
 * podała adres); w każdym innym przypadku list. Organ i wnioskodawca (odmowa zawarcia umowy —
 * art. 108a PrNot) — zawsze list.
 */
function kanal(db, { adresat, adresat_osoba_id: osobaId, spolka_id: spolkaId }) {
  if (adresat === 'osoba') {
    const o = daneOsoby.wczytaj(db, osobaId);
    return o && o.zgoda_email && o.email ? 'email' : 'list';
  }
  if (adresat === 'spolka') {
    const s = daneSpolki.wczytaj(db, spolkaId);
    return s && s.email ? 'email' : 'list';
  }
  return 'list';
}

function utworz(db, typ, p) {
  if (!TYPY[typ]) throw new Error(`Nieznany typ pisma „${typ}”.`);
  return danePisma.dodaj(db, { ...p, typ, kanal: p.kanal || kanal(db, p) });
}

function zmienStan(db, id, na, { wyslano = null, idWiadomosci = null, odpowiedzSerwera = null } = {}) {
  const p = danePisma.wczytaj(db, id);
  if (!p) throw new BladWalidacji(['Nie odnaleziono pisma.']);
  if (!PRZEJSCIA[p.stan].includes(na)) {
    throw new BladWalidacji([`Pismo w stanie „${p.stan}” nie może przejść do stanu „${na}”.`]);
  }
  danePisma.ustawStan(db, id, na, { wyslano: na === 'wyslane' ? wyslano || czas.terazIso() : null, idWiadomosci, odpowiedzSerwera });
  return danePisma.wczytaj(db, id);
}

/** U-28: list — „Nadano” zapisuje dzisiejszą datę. */
function nadano(db, id) {
  const p = danePisma.wczytaj(db, id);
  if (p && p.kanal !== 'list') throw new BladWalidacji(['„Nadano” dotyczy wyłącznie listów.']);
  return zmienStan(db, id, 'wyslane', { wyslano: czas.dzisIso() });
}

/** Ważne (wysłane, nieunieważnione) powiadomienie o zamierzonym wpisie do osoby w sprawie. */
function powiadomienieWyslane(db, sprawaId, osobaId) {
  return danePisma
    .lista(db, { sprawaId })
    .some(
      (p) => p.typ === 'powiadomienie_zamierzony' && p.adresat_osoba_id === Number(osobaId) && p.stan === 'wyslane' && !p.uniewaznione
    );
}

module.exports = {
  TYPY,
  PRZEJSCIA,
  kanal,
  utworz,
  zmienStan,
  nadano,
  powiadomienieWyslane,
  usunNiewyslane: danePisma.usunNiewyslane,
  uniewaznijWyslane: danePisma.uniewaznijWyslane,
  lista: danePisma.lista,
};
