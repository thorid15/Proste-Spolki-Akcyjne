'use strict';

/** Spółki — SQL. Zmiana danych spółki to edycja z historią, nie wpis (U-25). */

const czas = require('../pomocnicze/czas');
const historia = require('./historia');

/** Pola edytowalne w „Edytuj” (KRS jest kluczem i nie zmienia się). */
const POLA_EDYCJI = ['nazwa', 'siedziba', 'adres', 'sad_rejestrowy', 'data_rejestracji', 'nip', 'email', 'umowe_zawarl', 'platnosc'];

function wczytaj(db, id) {
  return db.prepare('SELECT * FROM psa_spolki WHERE id = ?').get(Number(id)) || null;
}

function lista(db, { q = '' } = {}) {
  const wzor = `%${String(q).trim()}%`;
  return db
    .prepare(
      `SELECT id, krs, nazwa, siedziba, data_otwarcia, data_zamkniecia FROM psa_spolki
        WHERE ? = '%%' OR nazwa LIKE ? OR krs LIKE ? ORDER BY nazwa COLLATE NOCASE`
    )
    .all(wzor, wzor, wzor);
}

function dodaj(db, s) {
  const w = db
    .prepare(
      `INSERT INTO psa_spolki (krs, nazwa, siedziba, adres, sad_rejestrowy, data_rejestracji, nip, email,
         umowe_zawarl, platnosc, utworzono)
       VALUES (@krs, @nazwa, @siedziba, @adres, @sad_rejestrowy, @data_rejestracji, @nip, @email,
         @umowe_zawarl, @platnosc, @utworzono)`
    )
    .run({
      nip: null,
      email: null,
      umowe_zawarl: null,
      platnosc: 'roczna',
      ...s,
      utworzono: czas.terazIso(),
    });
  return Number(w.lastInsertRowid);
}

function zmien(db, id, po, kto) {
  return db.transaction(() => {
    const przed = wczytaj(db, id);
    const pola = POLA_EDYCJI.filter((p) => po[p] !== undefined);
    if (pola.length === 0) return 0;
    db.prepare(`UPDATE psa_spolki SET ${pola.map((p) => `${p} = @${p}`).join(', ')} WHERE id = @id`).run({
      ...Object.fromEntries(pola.map((p) => [p, po[p]])),
      id: Number(id),
    });
    return historia.dopiszZmiany(db, { spolkaId: Number(id), przed, po: { ...przed, ...po }, pola, kto });
  })();
}

/** Materializacja stanu rejestru (U-14) z wpisów `otwarcie` i `zamkniecie`. */
function ustawStanRejestru(db, id, { data_otwarcia, data_zamkniecia, powod_zamkniecia }) {
  db.prepare('UPDATE psa_spolki SET data_otwarcia = ?, data_zamkniecia = ?, powod_zamkniecia = ? WHERE id = ?').run(
    data_otwarcia,
    data_zamkniecia,
    powod_zamkniecia,
    Number(id)
  );
}

/** Spółki z otwartym kiedykolwiek rejestrem — do naliczania opłat i przypomnień. */
function zRejestrem(db) {
  return db.prepare('SELECT * FROM psa_spolki WHERE data_otwarcia IS NOT NULL ORDER BY id').all();
}

module.exports = { POLA_EDYCJI, wczytaj, lista, dodaj, zmien, ustawStanRejestru, zRejestrem };
