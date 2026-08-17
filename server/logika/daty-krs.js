'use strict';

/**
 * Parsowanie dat z API KRS (sekcja 1.1 poprawek — bugfixy importu).
 *
 * Zweryfikowane na żywej odpowiedzi API (KRS 0001114217, rejestr=P,
 * pobrane 17.08.2026): `naglowekA.dataRejestracjiWKRS` i
 * `naglowekA.dataOstatniegoWpisu` przychodzą jako string „DD.MM.RRRR"
 * (np. „04.07.2024"), NIE jako ISO 8601. Podanie takiego stringa wprost do
 * `PoleDaty` (który oczekuje ISO `RRRR-MM-DD`, patrz `ui-rejestr.js`) daje
 * błędy widoczne na ekranie: pole segmentowe rozjeżdża się na
 * „24..2.04.0", a echo słowne pod polem pokazuje „NaN undefined 04.07.2024"
 * (obie wartości to bezpośredni skutek pocięcia „04.07.2024" na sztywne
 * indeksy `slice(0,4)/slice(5,7)/slice(8,10)` przewidziane dla formatu ISO).
 *
 * Ta funkcja jest jedynym miejscem, w którym wolno parsować datę z API KRS —
 * używać jej wszędzie, gdzie takie dane trafiają do aplikacji.
 */
function parseKrsDate(tekst) {
  if (tekst == null || tekst === '') return null;
  const m = String(tekst).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  const [, dzien, miesiac, rok] = m;
  const d = Number(dzien);
  const mies = Number(miesiac);
  if (mies < 1 || mies > 12 || d < 1 || d > 31) return null;
  return `${rok}-${miesiac.padStart(2, '0')}-${dzien.padStart(2, '0')}`;
}

module.exports = { parseKrsDate };
