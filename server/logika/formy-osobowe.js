'use strict';

/**
 * Formy gramatyczne zależne od płci osoby — na potrzeby wzorów pism
 * (`PLACEHOLDERY-PSA.md` § 1, blok B1 sesji 8).
 *
 * Ten sam rdzeń słowny wymaga RÓŻNYCH form w różnych miejscach wzoru, bo różne
 * miejsca mają różny przypadek gramatyczny:
 *
 *   — klauzula żądającego jest w PIERWSZEJ osobie, mianownik:
 *     „Ja, niżej podpisany, zamieszkały w…”
 *   — klauzula reprezentanta spółki jest w TRZECIEJ osobie, biernik
 *     (bo cały ustęp identyfikacyjny zgadza się przypadkiem z imieniem
 *     i nazwiskiem w `reprezentant_biernik`):
 *     „…Jana Kowalskiego, syna Piotra i Anny, legitymującego się…,
 *     zamieszkałego w…, działającego jako…”
 *
 * Stąd klucze poniżej nazwane są PO MIEJSCU UŻYCIA (`zadajacy_*`,
 * `reprezentant_*`), nie po samym rdzeniu słowa — jeden rdzeń („zamieszkały”)
 * ma dwie zupełnie różne formy w dwóch miejscach wzoru.
 *
 * Wartości dobrane na podstawie przykładów w
 * `wzory/_generatory/dane_testowe.py`, gdzie notariusz już raz je zapisał
 * ręcznie dla obu płci. Gdy `plec` jest nieznana, zwracamy `null` — pole
 * zostaje na liście braków w podglądzie pisma zamiast dostać zgadniętą,
 * być może błędną formę.
 */

const PLEC = {
  KOBIETA: 'kobieta',
  MEZCZYZNA: 'mezczyzna',
};

/** Formy używane w klauzuli reprezentanta spółki (trzecia osoba, biernik). */
function formyReprezentanta(plec) {
  if (plec === PLEC.MEZCZYZNA) {
    return {
      reprezentant_syn_corka: 'syna',
      reprezentant_legitymujacy: 'legitymującego się',
      reprezentant_zamieszkaly: 'zamieszkałego',
      reprezentant_dzialajacy: 'działającego',
    };
  }
  if (plec === PLEC.KOBIETA) {
    return {
      reprezentant_syn_corka: 'córkę',
      reprezentant_legitymujacy: 'legitymującą się',
      reprezentant_zamieszkaly: 'zamieszkałą',
      reprezentant_dzialajacy: 'działającą',
    };
  }
  return null;
}

/** Formy używane w oświadczeniu żądającego wpisu (pierwsza osoba, mianownik). */
function formyZadajacego(plec) {
  if (plec === PLEC.MEZCZYZNA) {
    return { zadajacy_podpisany: 'podpisany', zadajacy_zamieszkaly: 'zamieszkały' };
  }
  if (plec === PLEC.KOBIETA) {
    return { zadajacy_podpisany: 'podpisana', zadajacy_zamieszkaly: 'zamieszkała' };
  }
  return null;
}

/** Forma w oświadczeniu osoby wyrażającej zgodę (pierwsza osoba, mianownik). */
function formyZgadzajacego(plec) {
  if (plec === PLEC.MEZCZYZNA) return { zgadzajacy_podpisany: 'podpisany' };
  if (plec === PLEC.KOBIETA) return { zgadzajacy_podpisany: 'podpisana' };
  return null;
}

/** Czasownik w klauzuli zapoznania się z treścią (pierwsza osoba, czas przeszły). */
function formaZapoznania(plec) {
  if (plec === PLEC.MEZCZYZNA) return { zapoznany: 'zapoznałem się' };
  if (plec === PLEC.KOBIETA) return { zapoznany: 'zapoznałam się' };
  return null;
}

module.exports = { PLEC, formyReprezentanta, formyZadajacego, formyZgadzajacego, formaZapoznania };
