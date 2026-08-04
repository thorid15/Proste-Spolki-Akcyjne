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
 */
function zamaskujOsobe(osoba, rola, odbiorcaOsobaId = null) {
  if (!osoba) return null;

  const wlasneDane = odbiorcaOsobaId != null && Number(odbiorcaOsobaId) === Number(osoba.id);
  const pelnyDostep = przepisy.ROLE_PELNY_DOSTEP.includes(rola) || wlasneDane;
  if (pelnyDostep) return { ...osoba, zamaskowane: false };

  const wynik = { ...osoba, zamaskowane: true, zamaskowane_pola: [] };
  for (const pole of [...przepisy.POLA_WRAZLIWE, ...przepisy.POLA_KONTAKTOWE]) {
    if (wynik[pole] != null && wynik[pole] !== '') {
      wynik[pole] = ZASLONA;
      wynik.zamaskowane_pola.push(pole);
    }
  }
  // Notatki i statusy AML nie sa czescia rejestru - nie wychodza poza kancelarie
  // w zadnym wariancie (sekcja 10: czego NIE umieszczac na wydrukach).
  delete wynik.aml_status;
  delete wynik.aml_data;
  delete wynik.aml_notatka;
  delete wynik.uwagi;
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

module.exports = { ZASLONA, zamaskujOsobe, oznaczenieOsoby, jawnyIdentyfikator };
