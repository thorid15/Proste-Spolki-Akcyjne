'use strict';

/** Opłaty — SQL. Stan opłaty zmienia wyłącznie `server/oplaty.js` (tabela przejść). */

const czas = require('../pomocnicze/czas');

function dodaj(db, o) {
  return Number(
    db
      .prepare(
        `INSERT INTO psa_oplaty (spolka_id, typ, platnik, platnik_osoba_id, sprawa_id, pismo_id, okres,
           kwota_netto_grosze, stawka_vat_procent, autor, utworzono)
         VALUES (@spolka_id, @typ, @platnik, @platnik_osoba_id, @sprawa_id, @pismo_id, @okres,
           @kwota_netto_grosze, @stawka_vat_procent, @autor, @utworzono)`
      )
      .run({
        platnik_osoba_id: null,
        sprawa_id: null,
        pismo_id: null,
        okres: null,
        ...o,
        utworzono: czas.terazIso(),
      }).lastInsertRowid
  );
}

const Z_NAZWAMI = `SELECT o.*, s.nazwa AS spolka_nazwa,
    CASE WHEN o.platnik = 'osoba' THEN os.nazwa ELSE s.nazwa END AS platnik_nazwa
  FROM psa_oplaty o JOIN psa_spolki s ON s.id = o.spolka_id LEFT JOIN psa_osoby os ON os.id = o.platnik_osoba_id`;

function wczytaj(db, id) {
  return db.prepare(`${Z_NAZWAMI} WHERE o.id = ?`).get(Number(id));
}

function lista(db, { spolkaId = null, sprawaId = null, stan = null } = {}) {
  return db
    .prepare(
      `${Z_NAZWAMI} WHERE (? IS NULL OR o.spolka_id = ?) AND (? IS NULL OR o.sprawa_id = ?) AND (? IS NULL OR o.stan = ?)
       ORDER BY o.utworzono DESC, o.id DESC`
    )
    .all(spolkaId, spolkaId, sprawaId, sprawaId, stan, stan);
}

function ustawStan(db, id, stan, { oplacono = null, powod_anulowania: powod = null } = {}) {
  db.prepare('UPDATE psa_oplaty SET stan = ?, oplacono = ?, powod_anulowania = ? WHERE id = ?').run(stan, oplacono, powod, Number(id));
}

function ustawFakture(db, id, numer) {
  db.prepare('UPDATE psa_oplaty SET numer_faktury = ? WHERE id = ?').run(numer, Number(id));
}

module.exports = { dodaj, wczytaj, lista, ustawStan, ustawFakture };
