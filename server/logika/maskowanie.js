'use strict';

/**
 * Maskowanie danych wrazliwych (regula domenowa nr 9, art. 300(35) § 1(1) KSH).
 *
 * Pozostali akcjonariusze NIE maja dostepu do numeru PESEL, daty urodzenia
 * ani adresu zamieszkania. Pelny dostep: kancelaria, sama osoba, spolka,
 * sady, prokuratura, komornicy i administracyjne organy egzekucyjne.
 *
 * Sprint 1 nie ma jeszcze portalu klienta, ale maskowanie wdrazamy od
 * pierwszego dnia (sekcja 3 specyfikacji) - korzysta z niego wydruk
 * "informacja z rejestru" kierowany do innego akcjonariusza.
 */

const przepisy = require('./przepisy');

const ZASLONA = '•••';

/**
 * @param {object} osoba      rekord `psa_osoby`
 * @param {string} rola       jedna z `przepisy.ROLE_ODBIORCY`
 * @param {number} [odbiorcaOsobaId] id osoby ogladajacej - wlasne dane widzi w calosci
 *
 * Naprawa Z-150: buduje odpowiedz z BIALEJ LISTY pol dozwolonych dla danej
 * roli (`przepisy.BIALE_LISTY`), nie przez usuwanie pol z pelnego obiektu.
 * Kazde pole spoza listy jest pomijane - w tym kazde NOWE pole dopisane
 * kiedykolwiek do `psa_osoby`, o ktorym ta funkcja jeszcze nie wie, jest
 * wiec z definicji NIEWIDOCZNE, a nie domyslnie wyciekajace. Rola nieznana
 * (literowka, brak w slowniku) dostaje najwezszy zakres (tozsamosc), fail
 * closed, nie fail open.
 */
function zamaskujOsobe(osoba, rola, odbiorcaOsobaId = null) {
  if (!osoba) return null;

  const wlasneDane = odbiorcaOsobaId != null && Number(odbiorcaOsobaId) === Number(osoba.id);
  if (wlasneDane || przepisy.BIALE_LISTY[rola] === null) {
    return { ...osoba, zamaskowane: false };
  }

  const bialaLista = przepisy.BIALE_LISTY[rola] || przepisy.POLA_TOZSAMOSCI;
  // Pola wrazliwe/kontaktowe pomijane przez biala liste dostaja WIDOCZNY
  // placeholder (UI pokazuje "to pole istnieje, jest ukryte"); wszystko inne
  // pomijane (AML/PEP/kancelaryjne, kazde inne, nieznane dzis pole) znika z
  // odpowiedzi w calosci - nie ma powodu sygnalizowac peer-akcjonariuszowi
  // czy spolce, ze w ogole istnieje np. notatka AML.
  const POLA_Z_PLACEHOLDEREM = [...przepisy.POLA_WRAZLIWE, ...przepisy.POLA_KONTAKTOWE];
  const wynik = {};
  const zamaskowane_pola = [];
  for (const [klucz, wartosc] of Object.entries(osoba)) {
    if (bialaLista.includes(klucz)) {
      wynik[klucz] = wartosc;
      continue;
    }
    if (wartosc == null || wartosc === '') continue;
    zamaskowane_pola.push(klucz);
    if (POLA_Z_PLACEHOLDEREM.includes(klucz)) wynik[klucz] = ZASLONA;
  }
  wynik.zamaskowane = true;
  wynik.zamaskowane_pola = zamaskowane_pola;
  return wynik;
}

/** Skrocony podpis osoby do tabel - bez danych wrazliwych z definicji. */
function oznaczenieOsoby(osoba) {
  if (!osoba) return 'nieznany';
  if (osoba.typ === 'prawna') {
    return osoba.nazwa || `podmiot #${osoba.id}`;
  }
  return [osoba.nazwisko, osoba.imie].filter(Boolean).join(' ') || `osoba #${osoba.id}`;
}

/**
 * Identyfikator podmiotu widoczny dla kazdego odbiorcy: dla osob prawnych
 * numer w rejestrze (jawny z natury), dla osob fizycznych NIC - PESEL
 * i data urodzenia sa wrazliwe.
 */
function jawnyIdentyfikator(osoba) {
  if (!osoba) return null;
  if (osoba.typ === 'prawna') {
    const numer = osoba.numer_w_rejestrze || osoba.krs || null;
    const rejestr = osoba.nazwa_rejestru || (numer ? 'KRS' : null);
    if (numer) return `${rejestr} ${numer}`;
    if (osoba.nip) return `NIP ${osoba.nip}`;
  }
  return null;
}

/**
 * Czy biala lista danej roli w ogole ujawnia POLA_WRAZLIWE (PESEL, data
 * urodzenia, adres) cudzych osob - Z-152/P-009: `zamaskowane` z
 * `zamaskujOsobe` mowi "cokolwiek zostalo ukryte" (np. samo AML/PEP dla
 * roli "spolka" tez to ustawia), a dziennik dostepu ma odpowiadac na
 * WEZSZE pytanie: czy dane WRAZLIWE wyszly niezamaskowane.
 */
function widziWrazliweDaneInnych(rola) {
  const lista = przepisy.BIALE_LISTY[rola];
  if (lista === null) return true;
  return przepisy.POLA_WRAZLIWE.some((pole) => lista.includes(pole));
}

module.exports = { ZASLONA, zamaskujOsobe, oznaczenieOsoby, jawnyIdentyfikator, widziWrazliweDaneInnych };
