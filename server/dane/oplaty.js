'use strict';

/** Opłaty — SQL. W Fazie 1 wyłącznie opłata za wpis po wyborze pracownika (U-02). */

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

function lista(db, { spolkaId = null, sprawaId = null } = {}) {
  return db
    .prepare('SELECT * FROM psa_oplaty WHERE (? IS NULL OR spolka_id = ?) AND (? IS NULL OR sprawa_id = ?) ORDER BY id')
    .all(spolkaId, spolkaId, sprawaId, sprawaId);
}

module.exports = { dodaj, lista };
