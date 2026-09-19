'use strict';

/**
 * Naprawa Z-357: przypomnienia o kończącym się roku prowadzenia rejestru
 * (`server/logika/przypomnienia.js`) działały WYŁĄCZNIE po ręcznym kliknięciu
 * w zakładce „Opłaty” — jeśli nikt jej nie otworzył w oknie 30 dni przed
 * końcem okresu, przypomnienie nigdy nie szło, mimo że UI sugerował istnienie
 * automatycznego procesu. `wyslijPrzypomnienia` jest już idempotentna (ślad
 * w `psa_oplaty`/`psa_wydane_dokumenty`), więc wolno ją wołać cyklicznie bez
 * ryzyka duplikatów — brakowało wyłącznie WYWOŁANIA.
 *
 * Bez nowej zależności: prawdziwy harmonogram cron wymagałby pakietu spoza
 * tego, co konieczne do usunięcia podatności (reguła sesji). `setInterval`
 * z natychmiastowym pierwszym uruchomieniem (nadrabia zaległość po restarcie
 * procesu) wystarcza dla jednego procesu serwera jednej kancelarii.
 */
function uruchomHarmonogramPrzypomnien(db, { wyslij, interwalMs = 24 * 60 * 60 * 1000, dni = 30 } = {}) {
  const uruchom = () => {
    Promise.resolve(wyslij(db, { dni, autor: 'automat' })).catch((e) => {
      console.error(`[psa] harmonogram przypomnień o odnowieniu: ${e.message}`);
    });
  };
  uruchom();
  const uchwyt = setInterval(uruchom, interwalMs);
  // Nie blokuje zamkniecia procesu, gdyby to byl jedyny oczekujacy timer.
  uchwyt.unref?.();
  return uchwyt;
}

module.exports = { uruchomHarmonogramPrzypomnien };
