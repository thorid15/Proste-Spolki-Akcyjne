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
      `INSERT INTO psa_pisma (typ, numer, spolka_id, sprawa_id, wniosek_id, adresat, adresat_osoba_id, adresat_opis, sygnatura,
         kanal, kontekst_json, autor, utworzono)
       VALUES (@typ, @numer, @spolka_id, @sprawa_id, @wniosek_id, @adresat, @adresat_osoba_id, @adresat_opis, @sygnatura,
         @kanal, @kontekst_json, @autor, @utworzono)`
    )
    .run({
      typ: p.typ,
      numer: p.numer,
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

/** Usuwa niewysłane pisma spełniające warunek (pismo przestało być potrzebne); zwraca ich pliki PDF. */
function usunNiewyslane(db, { sprawaId, typ, adresatOsobaId = null }) {
  const warunek = `sprawa_id = ? AND typ = ? AND stan <> 'wyslane' AND (? IS NULL OR adresat_osoba_id = ?)`;
  const arg = [Number(sprawaId), typ, adresatOsobaId, adresatOsobaId];
  const pliki = db.prepare(`SELECT plik FROM psa_pisma WHERE ${warunek} AND plik IS NOT NULL`).all(...arg).map((w) => w.plik);
  db.prepare(`DELETE FROM psa_pisma WHERE ${warunek}`).run(...arg);
  return pliki;
}

/** Wysłane pisma danego typu w sprawie tracą ważność (R2: zmiana treści po kroku 1). */
function uniewaznijWyslane(db, { sprawaId, typ }) {
  return db
    .prepare(`UPDATE psa_pisma SET uniewaznione = ? WHERE sprawa_id = ? AND typ = ? AND stan = 'wyslane' AND uniewaznione IS NULL`)
    .run(czas.terazIso(), Number(sprawaId), typ).changes;
}

/** Kolejny numer pisma z danym przedrostkiem (np. „PSA/2026/”): NNNN od 0001. */
function nastepnyNumer(db, przedrostek) {
  const w = db.prepare('SELECT numer FROM psa_pisma WHERE numer LIKE ? ORDER BY numer DESC LIMIT 1').get(`${przedrostek}%`);
  const nr = w ? Number(w.numer.slice(przedrostek.length)) + 1 : 1;
  return `${przedrostek}${String(nr).padStart(4, '0')}`;
}

/**
 * Zapisuje plik PDF pisma — tylko raz (false, gdy ktoś zapisał go wcześniej). `dotychczasowy` — plik,
 * którego zabrakło na dysku (np. po wycofanej transakcji), może zostać zastąpiony.
 */
function zapiszPlik(db, id, plik, sha256, dotychczasowy = null) {
  return (
    db.prepare('UPDATE psa_pisma SET plik = ?, sha256 = ? WHERE id = ? AND plik IS ?').run(plik, sha256, Number(id), dotychczasowy).changes === 1
  );
}

const WARUNKI_KORESPONDENCJI = {
  do_wyslania: "p.stan = 'do_wyslania' AND p.kanal <> 'portal'",
  listy: "p.stan = 'do_wyslania' AND p.kanal = 'list'",
  bledy: "p.stan = 'blad'",
  wyslane: "p.stan = 'wyslane'",
};

/** Ekran „Korespondencja”: pisma według filtra, z firmą spółki. */
function korespondencja(db, filtr) {
  return db
    .prepare(
      `SELECT p.*, s.nazwa AS spolka_nazwa FROM psa_pisma p LEFT JOIN psa_spolki s ON s.id = p.spolka_id
       WHERE ${WARUNKI_KORESPONDENCJI[filtr]} ORDER BY COALESCE(p.wyslano, p.utworzono) DESC, p.id DESC`
    )
    .all()
    .map(zWiersza);
}

/** Pisma wniosku (dokumenty do podpisu i powiadomienie o odmowie). */
function wniosku(db, wniosekId) {
  return db.prepare('SELECT * FROM psa_pisma WHERE wniosek_id = ? ORDER BY id').all(Number(wniosekId)).map(zWiersza);
}

/** Dokumenty do podpisu wniosku powstają od nowa przy ponownym złożeniu — stare znikają. */
function usunDokumentyWniosku(db, wniosekId) {
  const warunek = "wniosek_id = ? AND typ IN ('umowa','uchwala','zgoda_email')";
  const pliki = db.prepare(`SELECT plik FROM psa_pisma WHERE ${warunek} AND plik IS NOT NULL`).all(Number(wniosekId)).map((w) => w.plik);
  db.prepare(`DELETE FROM psa_pisma WHERE ${warunek}`).run(Number(wniosekId));
  return pliki;
}

/** Przyjęcie wniosku: pisma wniosku trafiają do akt spółki. */
function doSpolki(db, wniosekId, spolkaId) {
  db.prepare('UPDATE psa_pisma SET spolka_id = ? WHERE wniosek_id = ?').run(spolkaId, Number(wniosekId));
}

module.exports = { wczytaj, lista, dodaj, ustawStan, nastepnyNumer, zapiszPlik, korespondencja, usunNiewyslane, uniewaznijWyslane, wniosku, usunDokumentyWniosku, doSpolki };
