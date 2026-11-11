'use strict';

/**
 * Osoba w kartotece: walidacja danych i jeden opis osoby (fizycznej i prawnej).
 *
 * Minimum danych (§ 3.4): imię i nazwisko albo firma; PESEL albo data urodzenia (D-076) albo
 * numer w rejestrze; jeden adres z rodzajem; e-mail i zgoda na e-mail; PEP; data weryfikacji AML.
 * Nieprawidłowy PESEL (suma kontrolna albo data) blokuje zapis (U-18).
 */

const czas = require('../pomocnicze/czas');

const POLA_EDYCJI = ['typ', 'nazwa', 'pesel', 'data_urodzenia', 'numer_rejestru', 'adres', 'rodzaj_adresu', 'email', 'pep', 'pep_opis', 'aml_data', 'uwagi'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Data urodzenia zapisana w numerze PESEL (RRRR-MM-DD) albo null, gdy miesiąc jest niemożliwy. */
function dataZPesel(pesel) {
  const rr = Number(pesel.slice(0, 2));
  let mm = Number(pesel.slice(2, 4));
  const dd = Number(pesel.slice(4, 6));
  const stulecia = [[80, 1800], [0, 1900], [20, 2000], [40, 2100], [60, 2200]];
  const s = stulecia.find(([przes]) => mm > przes && mm <= przes + 12);
  if (!s) return null;
  mm -= s[0];
  const data = `${s[1] + rr}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return czas.poprawnaData(data) ? data : null;
}

/** PESEL: 11 cyfr, poprawna suma kontrolna i istniejąca data urodzenia. */
function poprawnyPesel(pesel) {
  const p = String(pesel || '');
  if (!/^\d{11}$/.test(p)) return false;
  const wagi = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const suma = wagi.reduce((s, w, i) => s + w * Number(p[i]), 0);
  return (10 - (suma % 10)) % 10 === Number(p[10]) && dataZPesel(p) !== null;
}

function tekst(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

/**
 * Normalizuje i sprawdza dane osoby. `zmiany` może być częściowe (edycja) — wtedy sprawdzany jest
 * wynik połączenia z `dotychczasowe`. Zwraca { osoba, bledy } (błędy przy polach).
 */
function sprawdz(zmiany, dotychczasowe = {}) {
  const we = {};
  for (const pole of POLA_EDYCJI) {
    if (zmiany[pole] === undefined) continue;
    we[pole] = ['pep'].includes(pole) ? (zmiany[pole] ? 1 : 0) : tekst(zmiany[pole]);
  }
  const o = { ...dotychczasowe, ...we };
  const bledy = [];
  const blad = (pole, komunikat) => bledy.push({ pole, komunikat });

  if (!['fizyczna', 'prawna'].includes(o.typ)) blad('typ', 'Wybierz: osoba fizyczna albo prawna.');
  if (!o.nazwa) blad('nazwa', o.typ === 'prawna' ? 'Podaj firmę.' : 'Podaj imię i nazwisko.');
  if (!o.adres) blad('adres', 'Podaj adres.');
  o.rodzaj_adresu = o.rodzaj_adresu || 'glowny';
  if (!['glowny', 'doreczen'].includes(o.rodzaj_adresu)) blad('rodzaj_adresu', 'Wybierz rodzaj adresu.');

  if (o.typ === 'fizyczna') {
    o.numer_rejestru = null;
    if (o.pesel) {
      if (!poprawnyPesel(o.pesel)) blad('pesel', 'Nieprawidłowy PESEL — sprawdź cyfry.');
      o.data_urodzenia = null;
    } else if (o.data_urodzenia) {
      if (!czas.poprawnaData(o.data_urodzenia) || o.data_urodzenia > czas.dzisIso()) {
        blad('data_urodzenia', 'Podaj prawidłową datę urodzenia.');
      }
    } else {
      blad('pesel', 'Podaj PESEL albo datę urodzenia.');
    }
  } else if (o.typ === 'prawna') {
    o.pesel = null;
    o.data_urodzenia = null;
  }

  if (o.email && !EMAIL.test(o.email)) blad('email', 'Nieprawidłowy adres e-mail.');
  if (!o.email && o.zgoda_email) blad('email', 'Osoba ma zgodę na korespondencję e-mail — wyłącz ją przed usunięciem adresu.');
  if (o.aml_data && !czas.poprawnaData(o.aml_data)) blad('aml_data', 'Podaj prawidłową datę.');
  o.pep = o.pep ? 1 : 0;
  if (!o.pep) o.pep_opis = null;
  return { osoba: o, bledy };
}

/** Jeden opis osoby — w aplikacji, w pismach i w widokach. */
function opis(osoba) {
  if (!osoba) return '';
  return osoba.nazwa;
}

/** Identyfikator osoby do treści (PESEL, data urodzenia albo numer w rejestrze). */
function identyfikator(osoba) {
  if (!osoba) return null;
  if (osoba.typ === 'prawna') return osoba.numer_rejestru ? `nr w rejestrze ${osoba.numer_rejestru}` : null;
  if (osoba.pesel) return `PESEL ${osoba.pesel}`;
  return osoba.data_urodzenia ? `ur. ${osoba.data_urodzenia}` : null;
}

module.exports = { POLA_EDYCJI, poprawnyPesel, sprawdz, opis, identyfikator, EMAIL };
