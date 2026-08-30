'use strict';

/**
 * Normalizacja i walidacja numeru REGON (sekcja 1.3 poprawek).
 *
 * KRS zwraca REGON dopełniony zerami do 14 znaków (np. „52906603800000"
 * zamiast „529066038" — zweryfikowane na żywej odpowiedzi API dla
 * KRS 0001114217). Jeśli ostatnie 5 znaków to same zera, to dopełnienie —
 * obcinamy do REGON-9. Niezerowe końcowe znaki przy 14-znakowym numerze
 * oznaczają prawdziwy REGON jednostki lokalnej — zostawiamy bez zmian.
 *
 * Suma kontrolna liczona zawsze, ale wyłącznie jako OSTRZEŻENIE — dane
 * historyczne i pomyłki w KRS się zdarzają, nie blokujemy zapisu.
 */
const WAGI_REGON_9 = [8, 9, 2, 3, 4, 5, 6, 7];
const WAGI_REGON_14 = [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8];

function cyfraKontrolna(cyfry, wagi) {
  const suma = wagi.reduce((s, w, i) => s + w * Number(cyfry[i]), 0);
  const reszta = suma % 11;
  return reszta === 10 ? 0 : reszta;
}

/** @returns {boolean|null} true/false gdy da się ocenić, null przy nietypowej długości. */
function poprawnaSumaKontrolna(regon) {
  if (regon.length === 9) return cyfraKontrolna(regon, WAGI_REGON_9) === Number(regon[8]);
  if (regon.length === 14) return cyfraKontrolna(regon, WAGI_REGON_14) === Number(regon[13]);
  return null;
}

/** @returns {{ regon: string|null, ostrzezenie: string|null }} */
function normalizujRegon(surowy) {
  const cyfry = String(surowy || '').replace(/\D/g, '');
  if (!cyfry) return { regon: null, ostrzezenie: null };

  const regon = cyfry.length === 14 && cyfry.slice(9) === '00000' ? cyfry.slice(0, 9) : cyfry;

  const ok = poprawnaSumaKontrolna(regon);
  const ostrzezenie =
    ok === false ? `Suma kontrolna numeru REGON (${regon}) się nie zgadza — sprawdź przed zapisaniem.` : null;

  return { regon, ostrzezenie };
}

module.exports = { normalizujRegon };
