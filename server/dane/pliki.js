'use strict';

/** Pliki przychodzące — jedna tabela (U-29), SQL. Przyjęcie pliku (format, rozmiar) — `logika/pliki.js`. */

const czas = require('../pomocnicze/czas');

function wczytaj(db, id) {
  return db.prepare('SELECT * FROM psa_pliki WHERE id = ?').get(Number(id)) || null;
}

function lista(db, { spolkaId = null, osobaId = null, sprawaId = null }) {
  return db
    .prepare(
      `SELECT id, spolka_id, osoba_id, sprawa_id, nazwa, typ, wgral, wgrano FROM psa_pliki
        WHERE (? IS NULL OR spolka_id = ?) AND (? IS NULL OR osoba_id = ?) AND (? IS NULL OR sprawa_id = ?)
        ORDER BY id`
    )
    .all(spolkaId, spolkaId, osobaId, osobaId, sprawaId, sprawaId);
}

function dodaj(db, p) {
  return Number(
    db
      .prepare(
        `INSERT INTO psa_pliki (spolka_id, osoba_id, sprawa_id, wniosek_id, nazwa, sciezka, typ, sha256, wgral, wgrano, dokument, stan_podpisu)
         VALUES (@spolka_id, @osoba_id, @sprawa_id, @wniosek_id, @nazwa, @sciezka, @typ, @sha256, @wgral, @wgrano, @dokument, @stan_podpisu)`
      )
      .run({
        spolka_id: p.spolka_id ?? null,
        osoba_id: p.osoba_id ?? null,
        dokument: p.dokument ?? null,
        stan_podpisu: p.stan_podpisu ?? null,
        sprawa_id: p.sprawa_id ?? null,
        wniosek_id: p.wniosek_id ?? null,
        nazwa: p.nazwa,
        sciezka: p.sciezka,
        typ: p.typ,
        sha256: p.sha256,
        wgral: p.wgral,
        wgrano: czas.terazIso(),
      }).lastInsertRowid
  );
}

/** R7: domyślna data usunięcia przeszkody — dzień ostatniego pliku sprawy wgranego od wstrzymania. */
function ostatniDzienPlikuSprawy(db, sprawaId, odDnia) {
  const w = db
    .prepare('SELECT MAX(wgrano) AS m FROM psa_pliki WHERE sprawa_id = ? AND substr(wgrano, 1, 10) >= ?')
    .get(Number(sprawaId), odDnia);
  return w && w.m ? w.m.slice(0, 10) : null;
}

/** Pliki wniosku (dokumenty z U-03) — od najnowszego. */
function wniosku(db, wniosekId) {
  return db
    .prepare('SELECT id, nazwa, typ, wgral, wgrano, dokument, stan_podpisu, powod_odrzucenia FROM psa_pliki WHERE wniosek_id = ? ORDER BY id DESC')
    .all(Number(wniosekId));
}

function ustawStanPodpisu(db, id, stan, powod = null) {
  db.prepare('UPDATE psa_pliki SET stan_podpisu = ?, powod_odrzucenia = ? WHERE id = ?').run(stan, powod, Number(id));
}

/** Przyjęcie wniosku: pliki trafiają do akt spółki, zgody — także do karty osoby. */
function doSpolki(db, wniosekId, spolkaId, osobaPliku = {}) {
  db.prepare('UPDATE psa_pliki SET spolka_id = ? WHERE wniosek_id = ?').run(spolkaId, Number(wniosekId));
  for (const [plikId, osobaId] of Object.entries(osobaPliku)) db.prepare('UPDATE psa_pliki SET osoba_id = ? WHERE id = ?').run(osobaId, Number(plikId));
}

module.exports = { wczytaj, lista, dodaj, ostatniDzienPlikuSprawy, wniosku, ustawStanPodpisu, doSpolki };
