'use strict';

/**
 * Arytmetyka na ułamkowych częściach akcji (art. 300(2) § 3 + art. 300(43) KSH).
 *
 * Regula domenowa nr 4a: ułamek zapisujemy jako parę INTEGER (licznik,
 * mianownik) — żadnych floatów ani typów stałoprzecinkowych, bo 1/3 nie ma
 * skończonego rozwinięcia dziesiętnego. Porównania przez mnożenie na krzyż,
 * sumowanie przez wspólny mianownik, wynik zawsze skracany (NWD = 1).
 *
 * Modul jest CZYSTY - bez dostepu do bazy, bez efektow ubocznych.
 */

class BladUlamka extends Error {
  constructor(komunikat) {
    super(komunikat);
    this.name = 'BladUlamka';
  }
}

/** Jedność (akcja niepodzielona) - wartość domyślna wszędzie, gdzie ułamek nie jest podany. */
const JEDEN = Object.freeze({ licznik: 1, mianownik: 1 });
/** Zero (brak uprawnienia) - wynik odejmowania równych ułamków. */
const ZERO = Object.freeze({ licznik: 0, mianownik: 1 });

function nwd(a, b) {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** Sprawdza, że { licznik, mianownik } są liczbami całkowitymi z mianownikiem > 0. */
function sprawdzUlamek(u) {
  if (!u || typeof u !== 'object') {
    throw new BladUlamka('Ułamek musi być obiektem { licznik, mianownik }.');
  }
  const licznik = Number(u.licznik);
  const mianownik = Number(u.mianownik);
  if (!Number.isInteger(licznik) || !Number.isInteger(mianownik)) {
    throw new BladUlamka('Licznik i mianownik ułamka muszą być liczbami całkowitymi.');
  }
  if (mianownik <= 0) {
    throw new BladUlamka('Mianownik ułamka musi być liczbą dodatnią.');
  }
  if (licznik < 0) {
    throw new BladUlamka('Licznik ułamka nie może być ujemny.');
  }
  return { licznik, mianownik };
}

/**
 * Waliduje ułamkową część akcji zgodnie z CHECK-iem schematu: mianownik > 0,
 * 1 <= licznik <= mianownik (nie wolno zapisać 0/1 jako "posiadany" ułamek -
 * brak uprawnienia to brak wiersza, nie wiersz z zerowym licznikiem).
 */
function waliduj(u) {
  const w = sprawdzUlamek(u);
  if (w.licznik < 1 || w.licznik > w.mianownik) {
    throw new BladUlamka(
      `Ułamek ${w.licznik}/${w.mianownik} jest poza zakresem — licznik musi być między 1 a mianownikiem.`
    );
  }
  return skroc(w);
}

/** Skraca ułamek do postaci nieskracalnej (NWD = 1). */
function skroc(u) {
  const w = sprawdzUlamek(u);
  if (w.licznik === 0) return { licznik: 0, mianownik: 1 };
  const g = nwd(w.licznik, w.mianownik) || 1;
  return { licznik: w.licznik / g, mianownik: w.mianownik / g };
}

/** Porównanie przez mnożenie na krzyż - bez dzielenia, bez floatów. */
function rowne(a, b) {
  const x = sprawdzUlamek(a);
  const y = sprawdzUlamek(b);
  return x.licznik * y.mianownik === y.licznik * x.mianownik;
}

function mniejszy(a, b) {
  const x = sprawdzUlamek(a);
  const y = sprawdzUlamek(b);
  return x.licznik * y.mianownik < y.licznik * x.mianownik;
}

function mniejszyRowny(a, b) {
  return mniejszy(a, b) || rowne(a, b);
}

/** Suma ułamków przez wspólny mianownik (iloczyn mianowników), wynik skrócony. */
function suma(a, b) {
  const x = sprawdzUlamek(a);
  const y = sprawdzUlamek(b);
  return skroc({
    licznik: x.licznik * y.mianownik + y.licznik * x.mianownik,
    mianownik: x.mianownik * y.mianownik,
  });
}

/**
 * Różnica a - b. Rzuca BladUlamka, gdyby wynik wyszedł ujemny — to sygnał
 * błędu wołającego (próba odjęcia więcej niż jest), nie stan modelowalny.
 */
function roznica(a, b) {
  const x = sprawdzUlamek(a);
  const y = sprawdzUlamek(b);
  const licznik = x.licznik * y.mianownik - y.licznik * x.mianownik;
  if (licznik < 0) {
    throw new BladUlamka(
      `Nie można odjąć ułamka ${y.licznik}/${y.mianownik} od ${x.licznik}/${x.mianownik} — wynik byłby ujemny.`
    );
  }
  return skroc({ licznik, mianownik: x.mianownik * y.mianownik });
}

function jestZero(u) {
  return sprawdzUlamek(u).licznik === 0;
}

function jestJeden(u) {
  return rowne(u, JEDEN);
}

/** Wartość procentowa - WYŁĄCZNIE do wyświetlania (regula domenowa 4a), nigdy do porównań. */
function naProcent(u) {
  const w = sprawdzUlamek(u);
  return w.mianownik === 0 ? 0 : (w.licznik / w.mianownik) * 100;
}

function opisz(u) {
  const w = sprawdzUlamek(u);
  return `${w.licznik}/${w.mianownik}`;
}

module.exports = {
  BladUlamka,
  JEDEN,
  ZERO,
  nwd,
  waliduj,
  skroc,
  rowne,
  mniejszy,
  mniejszyRowny,
  suma,
  roznica,
  jestZero,
  jestJeden,
  naProcent,
  opisz,
};
