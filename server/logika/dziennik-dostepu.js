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
};

function zapisz(db, { kto, typKto, spolkaId = null, osobaId = null, akcja, opis = null }) {
  db.prepare(
    `INSERT INTO psa_dziennik_dostepu (chwila, kto, typ_kto, spolka_id, osoba_id, akcja, opis)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(czas.terazIso(), kto, typKto, spolkaId, osobaId, akcja, opis);
}

module.exports = { zapisz, AKCJE };
