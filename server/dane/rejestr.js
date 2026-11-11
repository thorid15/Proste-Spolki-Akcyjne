'use strict';

/**
 * Wpisy rejestru (`psa_zdarzenia`, tylko dopisywanie, łańcuch skrótów) i ich materializacje
 * (`psa_emisje`, `psa_stan_akcji`, `psa_atrybuty`) — SQL.
 */

const lancuch = require('../logika/lancuch');
const spolki = require('./spolki');

function zParsowanymi(wiersze) {
  return wiersze.map((z) => ({ ...z, dane: JSON.parse(z.dane_json) }));
}

function zdarzeniaSpolki(db, spolkaId) {
  return zParsowanymi(
    db.prepare('SELECT * FROM psa_zdarzenia WHERE spolka_id = ? ORDER BY data_wpisu, id').all(Number(spolkaId))
  );
}

/** Wpisy dokonane do końca chwili `granica` (UTC) — stan na dzień (U-22). */
function zdarzeniaDo(db, spolkaId, granica) {
  return zParsowanymi(
    db
      .prepare('SELECT * FROM psa_zdarzenia WHERE spolka_id = ? AND data_wpisu <= ? ORDER BY data_wpisu, id')
      .all(Number(spolkaId), granica)
  );
}

function zdarzenie(db, id) {
  const z = db.prepare('SELECT * FROM psa_zdarzenia WHERE id = ?').get(Number(id));
  return z ? { ...z, dane: JSON.parse(z.dane_json) } : null;
}

function ostatnieId(db) {
  return Number((db.prepare('SELECT MAX(id) AS m FROM psa_zdarzenia').get() || {}).m || 0);
}

function wszystkieZdarzenia(db) {
  return db.prepare('SELECT * FROM psa_zdarzenia ORDER BY id').all();
}

/**
 * Dopisuje wpis do łańcucha. Wywoływane wyłącznie przez `rejestr.wpisz`, wewnątrz transakcji
 * IMMEDIATE — `id` to MAX(id)+1, a skrót liczy się przed wstawieniem (rekordu nie wolno zmieniać).
 */
function dopiszZdarzenie(db, { spolkaId, typ, chwila, autor, sprawaId, dane, zdarzenieProstowaneId = null, uzasadnienie = null }) {
  const poprzednie = db.prepare('SELECT id, hash FROM psa_zdarzenia ORDER BY id DESC LIMIT 1').get();
  const rekord = {
    id: poprzednie ? Number(poprzednie.id) + 1 : 1,
    spolka_id: Number(spolkaId),
    typ,
    data_wpisu: chwila,
    autor: lancuch.oczysc(autor),
    sprawa_id: Number(sprawaId),
    dane_json: lancuch.kanonicznyJson(dane),
    zdarzenie_prostowane_id: zdarzenieProstowaneId,
    uzasadnienie,
    hash_poprzedni: poprzednie ? poprzednie.hash : lancuch.HASH_POCZATKOWY,
  };
  rekord.hash = lancuch.skrot(rekord);
  db.prepare(
    `INSERT INTO psa_zdarzenia (id, spolka_id, typ, data_wpisu, autor, sprawa_id, dane_json,
       zdarzenie_prostowane_id, uzasadnienie, hash_poprzedni, hash)
     VALUES (@id, @spolka_id, @typ, @data_wpisu, @autor, @sprawa_id, @dane_json,
       @zdarzenie_prostowane_id, @uzasadnienie, @hash_poprzedni, @hash)`
  ).run(rekord);
  return rekord;
}

/** Przepisuje materializacje spółki w całości z odtworzonego stanu. */
function zapiszMaterializacje(db, spolkaId, stan) {
  const id = Number(spolkaId);
  db.prepare('DELETE FROM psa_stan_akcji WHERE spolka_id = ?').run(id);
  db.prepare('DELETE FROM psa_atrybuty WHERE spolka_id = ?').run(id);
  db.prepare('DELETE FROM psa_emisje WHERE spolka_id = ?').run(id);

  const wstawEmisje = db.prepare(
    'INSERT INTO psa_emisje (spolka_id, seria, nr_od, nr_do, data_wpisu_krs) VALUES (?, ?, ?, ?, ?)'
  );
  for (const e of stan.emisje) wstawEmisje.run(id, e.seria, e.nr_od, e.nr_do, e.data_wpisu_krs);

  const wstawStan = db.prepare(
    `INSERT INTO psa_stan_akcji (spolka_id, seria, kategoria, osoba_id, nr_od, nr_do, czesc_licznik, czesc_mianownik,
       zdarzenie_od_id, data_od, zdarzenie_do_id, data_do)
     VALUES (@spolka_id, @seria, @kategoria, @osoba_id, @nr_od, @nr_do, @czesc_licznik, @czesc_mianownik,
       @zdarzenie_od_id, @data_od, @zdarzenie_do_id, @data_do)`
  );
  for (const p of stan.przedzialy) {
    wstawStan.run({
      spolka_id: id,
      seria: p.seria,
      kategoria: p.kategoria,
      osoba_id: p.osoba_id,
      nr_od: p.nr_od,
      nr_do: p.nr_do,
      czesc_licznik: p.czesc_licznik,
      czesc_mianownik: p.czesc_mianownik,
      zdarzenie_od_id: p.zdarzenie_od_id,
      data_od: p.data_od,
      zdarzenie_do_id: p.zdarzenie_do_id,
      data_do: p.data_do,
    });
  }

  const wstawAtrybut = db.prepare(
    `INSERT INTO psa_atrybuty (spolka_id, zdarzenie_id, pozycja, rodzaj, seria, nr_od, nr_do, osoba_id, tresc, prawo_glosu,
       zdarzenie_od_id, data_od, zdarzenie_do_id, data_do)
     VALUES (@spolka_id, @zdarzenie_id, @pozycja, @rodzaj, @seria, @nr_od, @nr_do, @osoba_id, @tresc, @prawo_glosu,
       @zdarzenie_od_id, @data_od, @zdarzenie_do_id, @data_do)`
  );
  for (const a of stan.atrybuty) {
    wstawAtrybut.run({
      spolka_id: id,
      zdarzenie_id: a.zdarzenie_id,
      pozycja: a.pozycja,
      rodzaj: a.rodzaj,
      seria: a.seria,
      nr_od: a.nr_od,
      nr_do: a.nr_do,
      osoba_id: a.osoba_id,
      tresc: a.tresc,
      prawo_glosu: a.prawo_glosu,
      zdarzenie_od_id: a.zdarzenie_od_id,
      data_od: a.data_od,
      zdarzenie_do_id: a.zdarzenie_do_id,
      data_do: a.data_do,
    });
  }

  spolki.ustawStanRejestru(db, id, {
    data_otwarcia: stan.data_otwarcia,
    data_zamkniecia: stan.otwarty ? null : stan.data_zamkniecia,
    powod_zamkniecia: stan.otwarty ? null : stan.powod_zamkniecia,
  });
}

module.exports = { zdarzeniaSpolki, zdarzeniaDo, zdarzenie, ostatnieId, wszystkieZdarzenia, dopiszZdarzenie, zapiszMaterializacje };
