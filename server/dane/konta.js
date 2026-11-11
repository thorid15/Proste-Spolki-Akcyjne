'use strict';

/** Konta portalu i osoby działające za spółkę (U-23) — SQL. */

const czas = require('../pomocnicze/czas');

function wczytaj(db, id) {
  return db.prepare('SELECT * FROM psa_konta WHERE id = ?').get(Number(id)) || null;
}

function poEmailu(db, email) {
  return db.prepare('SELECT * FROM psa_konta WHERE lower(email) = ?').get(String(email || '').trim().toLowerCase()) || null;
}

function poOsobie(db, osobaId) {
  return db.prepare('SELECT * FROM psa_konta WHERE osoba_id = ?').get(Number(osobaId)) || null;
}

function dodaj(db, { email, osoba_id = null, wniosek_id = null }) {
  return Number(
    db.prepare('INSERT INTO psa_konta (email, osoba_id, wniosek_id, utworzono) VALUES (?, ?, ?, ?)').run(email, osoba_id, wniosek_id, czas.terazIso()).lastInsertRowid
  );
}

function zmienEmail(db, id, email) {
  db.prepare('UPDATE psa_konta SET email = ? WHERE id = ?').run(email, Number(id));
}

function zmienHaslo(db, id, hash) {
  db.prepare('UPDATE psa_konta SET hash_hasla = ?, tokeny_wersja = tokeny_wersja + 1 WHERE id = ?').run(hash, Number(id));
}

/** Spółki, za które osoba działa. */
function spolkiReprezentanta(db, osobaId) {
  return db.prepare('SELECT spolka_id FROM psa_reprezentanci WHERE osoba_id = ? ORDER BY spolka_id').all(Number(osobaId)).map((w) => w.spolka_id);
}

/** Spółki, w których osoba ma dziś akcje (stan bieżący). */
function spolkiAkcjonariusza(db, osobaId) {
  return db
    .prepare("SELECT DISTINCT spolka_id FROM psa_stan_akcji WHERE osoba_id = ? AND kategoria = 'akcjonariusz' AND data_do IS NULL ORDER BY spolka_id")
    .all(Number(osobaId))
    .map((w) => w.spolka_id);
}

/** Osoby działające za spółkę — z adresem e-mail i stanem konta w portalu. */
function reprezentanci(db, spolkaId) {
  return db
    .prepare(
      `SELECT o.id, o.nazwa, o.email, r.dodano, k.aktywne AS konto_aktywne
         FROM psa_reprezentanci r JOIN psa_osoby o ON o.id = r.osoba_id LEFT JOIN psa_konta k ON k.osoba_id = o.id
        WHERE r.spolka_id = ? ORDER BY o.nazwa COLLATE NOCASE`
    )
    .all(Number(spolkaId));
}

function dodajReprezentanta(db, spolkaId, osobaId) {
  return db.prepare('INSERT OR IGNORE INTO psa_reprezentanci (spolka_id, osoba_id, dodano) VALUES (?, ?, ?)').run(Number(spolkaId), Number(osobaId), czas.terazIso()).changes === 1;
}

function usunReprezentanta(db, spolkaId, osobaId) {
  return db.prepare('DELETE FROM psa_reprezentanci WHERE spolka_id = ? AND osoba_id = ?').run(Number(spolkaId), Number(osobaId)).changes === 1;
}

module.exports = { wczytaj, poEmailu, poOsobie, dodaj, zmienEmail, zmienHaslo, spolkiReprezentanta, spolkiAkcjonariusza, reprezentanci, dodajReprezentanta, usunReprezentanta };
