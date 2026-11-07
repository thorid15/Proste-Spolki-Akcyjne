'use strict';

/** Pisma wychodzące — SQL. Stan pisma zmienia wyłącznie `logika/pisma.js` (tabela przejść). */

const czas = require('../pomocnicze/czas');

function zWiersza(w) {
  return w ? { ...w, kontekst: JSON.parse(w.kontekst_json) } : null;
}

function wczytaj(db, id) {
  return zWiersza(db.prepare('SELECT * FROM psa_pisma WHERE id = ?').get(Number(id)));
}

function lista(db, { sprawaId = null, spolkaId = null } = {}) {
  return db
    .prepare(
      `SELECT * FROM psa_pisma WHERE (? IS NULL OR sprawa_id = ?) AND (? IS NULL OR spolka_id = ?) ORDER BY id`
    )
    .all(sprawaId, sprawaId, spolkaId, spolkaId)
    .map(zWiersza);
}

function dodaj(db, p) {
  const w = db
    .prepare(
      `INSERT INTO psa_pisma (typ, spolka_id, sprawa_id, wniosek_id, adresat, adresat_osoba_id, adresat_opis, sygnatura,
         kanal, kontekst_json, autor, utworzono)
       VALUES (@typ, @spolka_id, @sprawa_id, @wniosek_id, @adresat, @adresat_osoba_id, @adresat_opis, @sygnatura,
         @kanal, @kontekst_json, @autor, @utworzono)`
    )
    .run({
      typ: p.typ,
      spolka_id: p.spolka_id ?? null,
      sprawa_id: p.sprawa_id ?? null,
      wniosek_id: p.wniosek_id ?? null,
      adresat: p.adresat,
      adresat_osoba_id: p.adresat_osoba_id ?? null,
      adresat_opis: p.adresat_opis ?? null,
      sygnatura: p.sygnatura ?? null,
      kanal: p.kanal,
      kontekst_json: JSON.stringify(p.kontekst || {}),
      autor: p.autor,
      utworzono: czas.terazIso(),
    });
  return Number(w.lastInsertRowid);
}

function ustawStan(db, id, stan, { wyslano = null, idWiadomosci = null, odpowiedzSerwera = null } = {}) {
  db.prepare(
    `UPDATE psa_pisma SET stan = ?, wyslano = COALESCE(?, wyslano), id_wiadomosci = COALESCE(?, id_wiadomosci),
       odpowiedz_serwera = COALESCE(?, odpowiedz_serwera) WHERE id = ?`
  ).run(stan, wyslano, idWiadomosci, odpowiedzSerwera, Number(id));
}

/** Usuwa niewysłane pisma spełniające warunek (pismo przestało być potrzebne). */
function usunNiewyslane(db, { sprawaId, typ, adresatOsobaId = null }) {
  return db
    .prepare(
      `DELETE FROM psa_pisma WHERE sprawa_id = ? AND typ = ? AND stan <> 'wyslane'
         AND (? IS NULL OR adresat_osoba_id = ?)`
    )
    .run(Number(sprawaId), typ, adresatOsobaId, adresatOsobaId).changes;
}

/** Wysłane pisma danego typu w sprawie tracą ważność (R2: zmiana treści po kroku 1). */
function uniewaznijWyslane(db, { sprawaId, typ }) {
  return db
    .prepare(`UPDATE psa_pisma SET uniewaznione = ? WHERE sprawa_id = ? AND typ = ? AND stan = 'wyslane' AND uniewaznione IS NULL`)
    .run(czas.terazIso(), Number(sprawaId), typ).changes;
}

module.exports = { wczytaj, lista, dodaj, ustawStan, usunNiewyslane, uniewaznijWyslane };
