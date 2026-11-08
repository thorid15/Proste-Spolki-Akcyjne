'use strict';

/** Wnioski — SQL retencji danych klienta (U-19). Pełny moduł wniosków powstaje w Fazie 4. */

/** Wnioski odrzucone albo bez zmian od dnia `granica` (roboczy, złożony), które mają jeszcze dane klienta. */
function doRetencji(db, granica) {
  return db
    .prepare(
      `SELECT w.id FROM psa_wnioski w
       WHERE (w.stan = 'odrzucony' OR (w.stan IN ('roboczy','zlozony') AND substr(w.zmieniono, 1, 10) < ?))
         AND (w.dane_json <> '{}' OR w.notatka IS NOT NULL OR w.dotychczasowy_podmiot IS NOT NULL
              OR EXISTS (SELECT 1 FROM psa_pliki p WHERE p.wniosek_id = w.id)
              OR EXISTS (SELECT 1 FROM psa_konta k WHERE k.wniosek_id = w.id)
              OR EXISTS (SELECT 1 FROM psa_pisma p WHERE p.wniosek_id = w.id AND p.stan <> 'wyslane'))
       ORDER BY w.id`
    )
    .all(granica)
    .map((w) => w.id);
}

/**
 * Usuwa dane klienta wniosku: treść, checklistę, notatkę, dotychczasowy podmiot, pliki, niewysłane
 * pisma i konto założone tylko dla wniosku. Zostają KRS, daty i stan. Zwraca pliki do usunięcia z dysku.
 */
function usunDaneKlienta(db, id) {
  const pliki = [
    ...db.prepare('SELECT sciezka AS plik FROM psa_pliki WHERE wniosek_id = ?').all(id),
    ...db.prepare("SELECT plik FROM psa_pisma WHERE wniosek_id = ? AND stan <> 'wyslane' AND plik IS NOT NULL").all(id),
  ].map((w) => w.plik);
  db.prepare("UPDATE psa_wnioski SET dane_json = '{}', checklista_json = '{}', notatka = NULL, dotychczasowy_podmiot = NULL WHERE id = ?").run(id);
  db.prepare('DELETE FROM psa_pliki WHERE wniosek_id = ?').run(id);
  db.prepare("DELETE FROM psa_pisma WHERE wniosek_id = ? AND stan <> 'wyslane'").run(id);
  db.prepare('DELETE FROM psa_konta WHERE wniosek_id = ? AND osoba_id IS NULL').run(id);
  db.prepare('UPDATE psa_konta SET wniosek_id = NULL WHERE wniosek_id = ?').run(id);
  return pliki;
}

module.exports = { doRetencji, usunDaneKlienta };
