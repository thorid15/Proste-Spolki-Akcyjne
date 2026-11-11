'use strict';

/**
 * Dziennik dostępu do danych osobowych (blok D4, sesja 8) — WĄSKI zakres:
 * tylko momenty realnego wglądu w dane wrażliwe albo wyniesienia ich
 * z systemu (informacja z rejestru, raport dla sądu, eksport, pobranie
 * pliku). Świadomie NIE każde wyświetlenie listy/kokpitu — patrz uzasadnienie
 * przy migracji v16.
 *
 * Append-only, jak `psa_zdarzenia` — ale to zupełnie osobna tabela, bez
 * wpływu na łańcuch skrótów treści rejestru.
 */

const czas = require('../pomocnicze/czas');

const AKCJE = {
  INFORMACJA_Z_REJESTRU: 'informacja_z_rejestru',
  RAPORT_SAD: 'raport_sad',
  EKSPORT: 'eksport',
  POBRANIE_PLIKU: 'pobranie_pliku',
  // Dane kancelarii i stawki trafiaja do kazdej wystawianej umowy, wiec ich
  // zmiana jest zdarzeniem wartym zapisania — tak samo jak wglad w akta.
  ZMIANA_USTAWIEN: 'zmiana_ustawien',
  // Naprawa Z-152/P-009: zwykly odczyt rejestru (bez formalnego wydania
  // "informacji z rejestru") NIE byl dotad rejestrowany w ogole - w polaczeniu
  // z Z-150 (wyciek nadmiarowych pol) oznaczalo to, ze wglad w dane wrazliwe
  // przez rola "spolka"/"organ" portalu nie zostawial ZADNEGO sladu.
  ODCZYT_REJESTRU: 'odczyt_rejestru',
};

function zapisz(db, { kto, typKto, spolkaId = null, osobaId = null, akcja, opis = null }) {
  db.prepare(
    `INSERT INTO psa_dziennik (chwila, kto, typ_kto, spolka_id, osoba_id, akcja, opis)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(czas.terazIso(), kto, typKto, spolkaId, osobaId, akcja, opis);
}

/**
 * D-122 (P-009): retencja dziennika dostępu — 5 lat od wpisu (jak dokumentacja środków AML, art. 49 ustawy AML;
 * rozliczalność RODO). Starsze wpisy usuwa proces dzienny (`server/proces-dzienny.js`).
 */
/** Czy w dzienniku jest już wpis danej czynności z danym opisem (np. wysłane przypomnienie). */
function zapisano(db, akcja, opis) {
  return Boolean(db.prepare('SELECT 1 FROM psa_dziennik WHERE akcja = ? AND opis = ? LIMIT 1').get(akcja, opis));
}

const RETENCJA_LAT = 5;
function usunPrzeterminowane(db, { teraz = new Date() } = {}) {
  const granica = new Date(teraz);
  granica.setFullYear(granica.getFullYear() - RETENCJA_LAT);
  return db.prepare('DELETE FROM psa_dziennik WHERE chwila < ?').run(granica.toISOString()).changes;
}

module.exports = { zapisz, zapisano, usunPrzeterminowane, AKCJE };
