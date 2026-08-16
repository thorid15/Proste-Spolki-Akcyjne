'use strict';

/**
 * Znak sprawy — `{{sprawa_numer}}` na każdym piśmie (blok B2 sesji 8).
 *
 * Format `RA/ROK/NNNN`, sekwencja per rok, wspólna dla wszystkich prowadzonych
 * spółek (jeden podmiot prowadzący rejestr, jedna numeracja — tak jak w
 * przykładzie z `wzory/_generatory/dane_testowe.py`: `RA/2026/0042`).
 *
 * Liczymy MAKSIMUM z już nadanych numerów, nie COUNT — sprawy anulowane nie
 * zwalniają swojego numeru z powrotem do puli (ten sam numer nie może się
 * pojawić na dwóch pismach, nawet jeśli jedna ze spraw nie doszła do skutku).
 */

function nastepnyNumerSprawy(baza, dataWplywu) {
  const rok = String(dataWplywu || '').slice(0, 4);
  const wiersze = baza
    .prepare("SELECT numer FROM psa_sprawy WHERE numer LIKE ?")
    .all(`RA/${rok}/%`);

  let maksimum = 0;
  for (const { numer } of wiersze) {
    const dopasowanie = /\/(\d+)$/.exec(numer || '');
    if (dopasowanie) maksimum = Math.max(maksimum, Number(dopasowanie[1]));
  }
  return `RA/${rok}/${String(maksimum + 1).padStart(4, '0')}`;
}

module.exports = { nastepnyNumerSprawy };
