'use strict';

/**
 * Fallback dla sądu rejestrowego, gdy API KRS go nie zwraca (sekcja 1.7
 * poprawek). Potwierdzone na żywej odpowiedzi API (KRS 0001114217,
 * rejestr=P, 17.08.2026): odpis dla rejestru przedsiębiorców NIE zawiera
 * żadnego pola z oznaczeniem sądu rejestrowego — patrz komentarz w
 * `server/trasy/krs.js`. Fallback jest więc potrzebny zawsze, nie tylko
 * wyjątkowo.
 *
 * Tabela leży w pliku danych (`server/dane/sady-rejestrowe.json`), nie w
 * kodzie — patrz README obok tego pliku po sposób jej uzupełnienia.
 * Wydziały gospodarcze KRS orzekają dla obszaru CAŁEGO OKRĘGU, więc mapujemy
 * na poziomie powiatu; kilka powiatów podzielonych między okręgi ma wpis w
 * `wyjatki_gminne` (pierwszeństwo przed dopasowaniem po samym powiecie).
 *
 * Wynik jest ZAWSZE propozycją do potwierdzenia przez pracownika — pole w
 * formularzu zostaje edytowalne niezależnie od wyniku (sekcja 1.7, punkt 3).
 */
const fs = require('node:fs');
const path = require('node:path');

const PLIK_DANYCH = path.join(__dirname, '..', 'dane', 'sady-rejestrowe.json');

let zbuforowana = null;

function wczytajBaze() {
  if (zbuforowana) return zbuforowana;
  try {
    zbuforowana = JSON.parse(fs.readFileSync(PLIK_DANYCH, 'utf8'));
  } catch {
    zbuforowana = { sady_okregowe: [], powiaty: [], wyjatki_gminne: [] };
  }
  return zbuforowana;
}

function znormalizuj(tekst) {
  return String(tekst || '').trim().toUpperCase();
}

/**
 * @param {{ wojewodztwo?: string, powiat?: string, gmina?: string }} siedziba
 *   Pola dokładnie jak z `dzial1.siedzibaIAdres.siedziba` odpowiedzi API KRS.
 * @param {object} [bazaDoTestow] Wstrzyknięcie bazy zamiast pliku (testy).
 * @returns {{ sad_okregowy: string, sad_rejestrowy: string, wydzial: string } | null}
 */
function ustalSadRejestrowy({ wojewodztwo, powiat, gmina } = {}, bazaDoTestow) {
  if (!powiat) return null;
  const baza = bazaDoTestow || wczytajBaze();

  const pasujePowiat = (p) =>
    znormalizuj(p.powiat) === znormalizuj(powiat) &&
    (!p.wojewodztwo || znormalizuj(p.wojewodztwo) === znormalizuj(wojewodztwo));

  const wyjatek = (baza.wyjatki_gminne || []).find(
    (w) => pasujePowiat(w) && znormalizuj(w.gmina) === znormalizuj(gmina)
  );
  const wpisPowiatu = wyjatek || (baza.powiaty || []).find(pasujePowiat);
  if (!wpisPowiatu) return null;

  const sadOkregowy = (baza.sady_okregowe || []).find((s) => s.id === wpisPowiatu.sad_okregowy_id);
  if (!sadOkregowy || !sadOkregowy.wydzial_krs) return null;

  return {
    sad_okregowy: sadOkregowy.nazwa,
    sad_rejestrowy: sadOkregowy.wydzial_krs.sad,
    wydzial: sadOkregowy.wydzial_krs.nazwa_pelna,
  };
}

module.exports = { ustalSadRejestrowy };
