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
 * kodzie — zbudowana z dwóch wykazów Ministerstwa Sprawiedliwości (stan na
 * luty 2025 r.): „Właściwość sądów powszechnych" (obszar każdego sądu
 * rejonowego opisany listą gmin) i „Lista Wydziałów Gospodarczych KRS"
 * (który sąd rejonowy/wydział obsługuje sprawy KRS dla obszaru którego sądu
 * okręgowego). Dopasowanie działa na poziomie GMINY (nie powiatu) — to
 * dokładnie granulacja źródła, więc nie ma potrzeby osobnej listy wyjątków
 * dla podzielonych powiatów.
 *
 * Dwa świadome ograniczenia danych (opisane też w pliku danych):
 *   - ok. 70 nazw gmin powtarza się w różnych regionach Polski (te same
 *     nazwy, różne województwa) — bez wiarygodnego źródła TERYT nie dają
 *     się rozstrzygnąć bez zgadywania, więc są pominięte (`gminy-niejednoznaczne.json`),
 *   - Warszawa i Kraków mają wewnętrzny podział właściwości KRS na poziomie
 *     DZIELNICY, nie gminy — API KRS nie zwraca dzielnicy, więc obu miast
 *     celowo nie ma w tabeli (przyległe gminy, np. Wieliczka czy Piaseczno,
 *     są rozstrzygane normalnie).
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
    zbuforowana = { wydzialy: [], gminy: [] };
  }
  return zbuforowana;
}

function znormalizuj(tekst) {
  return String(tekst || '').trim().toUpperCase();
}

/**
 * @param {{ wojewodztwo?: string, powiat?: string, gmina?: string }} siedziba
 *   Pola dokładnie jak z `dzial1.siedzibaIAdres.siedziba` odpowiedzi API KRS.
 *   `wojewodztwo`/`powiat` nie są dziś używane do dopasowania (tabela nie ma
 *   niejednoznaczności wymagających ich jako tie-breakera — patrz komentarz
 *   wyżej), przyjmowane na przyszłość, gdyby ktoś uzupełnił
 *   `gminy-niejednoznaczne.json` o rozstrzygnięcia wojewódzkie.
 * @param {object} [bazaDoTestow] Wstrzyknięcie bazy zamiast pliku (testy).
 * @returns {{ sad_rejestrowy: string, wydzial: string } | null}
 */
function ustalSadRejestrowy({ gmina } = {}, bazaDoTestow) {
  if (!gmina) return null;
  const baza = bazaDoTestow || wczytajBaze();

  const wpisGminy = (baza.gminy || []).find((g) => znormalizuj(g.gmina) === znormalizuj(gmina));
  if (!wpisGminy) return null;

  const wydzial = (baza.wydzialy || []).find((w) => w.id === wpisGminy.wydzial_id);
  if (!wydzial) return null;

  return {
    sad_rejestrowy: wydzial.sad,
    wydzial: wydzial.nazwa_pelna,
  };
}

module.exports = { ustalSadRejestrowy };
