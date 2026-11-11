'use strict';

/** Historia zmian danych osób i spółek oraz zgody na e-mail (U-11, U-25) — tylko dopisywanie. */

const czas = require('../pomocnicze/czas');

const wartosc = (v) => (v === undefined || v === null ? null : String(v));

/** Dopisuje wiersz dla każdego pola, którego wartość się zmieniła. Zwraca liczbę wierszy. */
function dopiszZmiany(db, { osobaId = null, spolkaId = null, przed, po, pola, kto, plikId = null }) {
  const wstaw = db.prepare(
    `INSERT INTO psa_historia_danych (osoba_id, spolka_id, pole, stara, nowa, plik_id, kto, kiedy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const kiedy = czas.terazIso();
  let ile = 0;
  for (const pole of pola) {
    if (wartosc(przed[pole]) === wartosc(po[pole])) continue;
    wstaw.run(osobaId, spolkaId, pole, wartosc(przed[pole]), wartosc(po[pole]), plikId, kto, kiedy);
    ile += 1;
  }
  return ile;
}

function lista(db, { osobaId = null, spolkaId = null }) {
  return db
    .prepare(
      `SELECT id, pole, stara, nowa, plik_id, kto, kiedy FROM psa_historia_danych
        WHERE (osoba_id = ? AND ? IS NOT NULL) OR (spolka_id = ? AND ? IS NOT NULL)
        ORDER BY id DESC`
    )
    .all(osobaId, osobaId, spolkaId, spolkaId);
}

module.exports = { dopiszZmiany, lista };
