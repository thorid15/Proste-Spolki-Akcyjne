'use strict';

/** Wnioski o prowadzenie rejestru — SQL (wniosek = zgłoszenie, U-08) i retencja danych klienta (U-19). */

const czas = require('../pomocnicze/czas');

const zWiersza = (w) => w && { ...w, przejecie: Boolean(w.przejecie), dane: JSON.parse(w.dane_json), krs_dane: JSON.parse(w.krs_json), checklista: JSON.parse(w.checklista_json) };

function wczytaj(db, id) {
  return zWiersza(db.prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(Number(id)));
}

function lista(db, { stany = null } = {}) {
  const warunek = stany ? `WHERE stan IN (${stany.map(() => '?').join(',')})` : '';
  return db
    .prepare(`SELECT id, stan, krs, przejecie, data_przejecia, spolka_id, dane_json, utworzono, zmieniono FROM psa_wnioski ${warunek} ORDER BY id DESC`)
    .all(...(stany || []))
    .map((w) => ({ ...w, przejecie: Boolean(w.przejecie), firma: (JSON.parse(w.dane_json).spolka || {}).nazwa || null, dane_json: undefined }));
}

function dodaj(db, { krs, przejecie = false, dane = {}, krsDane = {} }) {
  const teraz = czas.terazIso();
  return Number(
    db
      .prepare('INSERT INTO psa_wnioski (krs, przejecie, dane_json, krs_json, utworzono, zmieniono) VALUES (?, ?, ?, ?, ?, ?)')
      .run(krs, przejecie ? 1 : 0, JSON.stringify(dane), JSON.stringify(krsDane), teraz, teraz).lastInsertRowid
  );
}

const KOLUMNY = { dane: 'dane_json', checklista: 'checklista_json' };

/** Zapis pól wniosku; `dane` i `checklista` jako obiekty. Każdy zapis odnawia `zmieniono` (U-19). */
function zapisz(db, id, pola) {
  const wpisy = Object.entries(pola).map(([k, v]) => (KOLUMNY[k] ? [KOLUMNY[k], JSON.stringify(v)] : [k, typeof v === 'boolean' ? Number(v) : v]));
  wpisy.push(['zmieniono', czas.terazIso()]);
  db.prepare(`UPDATE psa_wnioski SET ${wpisy.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...wpisy.map(([, v]) => v), Number(id));
}

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

module.exports = { wczytaj, lista, dodaj, zapisz, doRetencji, usunDaneKlienta };
