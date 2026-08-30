/* pesel.js — rozkład numeru PESEL, bez zależności UI (etap 2.8, wydzielone
   w etapie 3D, żeby portal.html mógł go użyć bez ładowania osoby.js). */

/**
 * Rozklada numer PESEL na date urodzenia i plec (etap 2.8 poprawek) - do
 * autouzupelnienia formularza, NIGDY do blokowania zapisu. Kodowanie wieku
 * w miesiacu: 01-12 -> 1900+, 21-32 -> 2000+, 41-52 -> 2100+, 61-72 -> 2200+,
 * 81-92 -> 1800+ (PRZEPISY-PSA.md, oznaczenie PESEL). Plec: przedostatnia
 * cyfra parzysta -> kobieta, nieparzysta -> mezczyzna. Zwraca `null`, gdy
 * numer nie ma 11 cyfr albo koduje nieistniejaca date - suma kontrolna jest
 * osobnym, MIEKKIM sygnalem (`poprawnaSumaKontrolna`), nie warunkiem
 * odrzucenia calego rozkladu.
 */
function parsujPesel(pesel) {
  if (!/^\d{11}$/.test(pesel)) return null;

  const rokSurowy = Number(pesel.slice(0, 2));
  const miesiacSurowy = Number(pesel.slice(2, 4));
  const dzien = Number(pesel.slice(4, 6));

  const WIEKI = [
    { od: 1, wiek: 1900 },
    { od: 21, wiek: 2000 },
    { od: 41, wiek: 2100 },
    { od: 61, wiek: 2200 },
    { od: 81, wiek: 1800 },
  ];
  const pasujacy = WIEKI.find((w) => miesiacSurowy >= w.od && miesiacSurowy <= w.od + 11);
  if (!pasujacy) return null;
  const miesiac = miesiacSurowy - (pasujacy.od - 1);
  const rok = pasujacy.wiek + rokSurowy;

  // Realnosc daty (np. 31 lutego) - przez rundtrip przez Date, nie recznym
  // liczeniem dni w miesiacu (upraszcza lata przestepne).
  const dataIso = `${String(rok).padStart(4, '0')}-${String(miesiac).padStart(2, '0')}-${String(dzien).padStart(2, '0')}`;
  const proba = new Date(`${dataIso}T00:00:00Z`);
  const dataPoprawna =
    !Number.isNaN(proba.getTime()) &&
    proba.getUTCFullYear() === rok &&
    proba.getUTCMonth() + 1 === miesiac &&
    proba.getUTCDate() === dzien;
  if (!dataPoprawna) return null;

  const cyfry = pesel.split('').map(Number);
  const plec = cyfry[9] % 2 === 0 ? 'kobieta' : 'mezczyzna';

  const WAGI = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const suma = WAGI.reduce((s, w, i) => s + w * cyfry[i], 0);
  const sumaKontrolna = (10 - (suma % 10)) % 10;
  const poprawnaSumaKontrolna = sumaKontrolna === cyfry[10];

  return { data_urodzenia: dataIso, plec, poprawnaSumaKontrolna };
}
