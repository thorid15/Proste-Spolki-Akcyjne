'use strict';

/** Kartoteka osób — SQL. Walidacja w `logika/osoby.js`; zmiana danych dopisuje historię (U-25). */

const czas = require('../pomocnicze/czas');
const historia = require('./historia');
const { POLA_EDYCJI } = require('../logika/osoby');

function wczytaj(db, id) {
  return db.prepare('SELECT * FROM psa_osoby WHERE id = ?').get(Number(id)) || null;
}

/** Wyszukiwanie po nazwie, PESEL-u, numerze w rejestrze albo e-mailu. */
function lista(db, { q = '', limit = 50 } = {}) {
  const wzor = `%${String(q).trim()}%`;
  return db
    .prepare(
      `SELECT * FROM psa_osoby
        WHERE ? = '%%' OR nazwa LIKE ? OR pesel LIKE ? OR numer_rejestru LIKE ? OR email LIKE ?
        ORDER BY nazwa COLLATE NOCASE LIMIT ?`
    )
    .all(wzor, wzor, wzor, wzor, wzor, Math.min(Number(limit) || 50, 200));
}

/** Osoby o tym samym PESEL-u albo numerze w rejestrze — ostrzeżenie przed powtórzeniem. */
function takieSame(db, osoba, pomijajId = null) {
  return db
    .prepare(
      `SELECT id, nazwa FROM psa_osoby
        WHERE id IS NOT ? AND ((pesel IS NOT NULL AND pesel = ?) OR (numer_rejestru IS NOT NULL AND numer_rejestru = ?))`
    )
    .all(pomijajId, osoba.pesel || null, osoba.numer_rejestru || null);
}

function dodaj(db, osoba) {
  const w = db
    .prepare(
      `INSERT INTO psa_osoby (typ, nazwa, pesel, data_urodzenia, numer_rejestru, adres, rodzaj_adresu,
         email, zgoda_email, pep, pep_opis, aml_data, uwagi, utworzono)
       VALUES (@typ, @nazwa, @pesel, @data_urodzenia, @numer_rejestru, @adres, @rodzaj_adresu,
         @email, 0, @pep, @pep_opis, @aml_data, @uwagi, @utworzono)`
    )
    .run({
      typ: osoba.typ,
      nazwa: osoba.nazwa,
      pesel: osoba.pesel || null,
      data_urodzenia: osoba.data_urodzenia || null,
      numer_rejestru: osoba.numer_rejestru || null,
      adres: osoba.adres,
      rodzaj_adresu: osoba.rodzaj_adresu || 'glowny',
      email: osoba.email || null,
      pep: osoba.pep ? 1 : 0,
      pep_opis: osoba.pep_opis || null,
      aml_data: osoba.aml_data || null,
      uwagi: osoba.uwagi || null,
      utworzono: czas.terazIso(),
    });
  return Number(w.lastInsertRowid);
}

/** Zmienia dane w miejscu i dopisuje historię zmienionych pól — jedna transakcja (U-25). */
function zmien(db, id, po, kto) {
  return db.transaction(() => {
    const przed = wczytaj(db, id);
    const pola = POLA_EDYCJI.filter((p) => po[p] !== undefined);
    if (pola.length === 0) return 0;
    db.prepare(`UPDATE psa_osoby SET ${pola.map((p) => `${p} = @${p}`).join(', ')} WHERE id = @id`).run({
      ...Object.fromEntries(pola.map((p) => [p, po[p]])),
      id: Number(id),
    });
    return historia.dopiszZmiany(db, { osobaId: Number(id), przed, po: { ...przed, ...po }, pola, kto });
  })();
}

/**
 * Zgoda na korespondencję e-mail = żądanie powiadomień (U-11). Włączenie przez pracownika wymaga
 * pliku podpisanej zgody, wyłączenie (wycofanie) — daty; obie zmiany trafiają do historii.
 */
function ustawZgodeEmail(db, id, { zgoda, plikId = null, data = null }, kto) {
  return db.transaction(() => {
    const przed = wczytaj(db, id);
    const nowa = zgoda ? 1 : 0;
    if (przed.zgoda_email === nowa) return 0;
    db.prepare('UPDATE psa_osoby SET zgoda_email = ? WHERE id = ?').run(nowa, Number(id));
    return historia.dopiszZmiany(db, {
      osobaId: Number(id),
      przed: { zgoda_email: przed.zgoda_email },
      po: { zgoda_email: nowa ? 1 : `0 (wycofana ${data})` },
      pola: ['zgoda_email'],
      kto,
      plikId,
    });
  })();
}

/** Akcje osoby w spółkach (stan bieżący) i jej sprawy — do karty osoby. */
function powiazania(db, id) {
  const akcje = db
    .prepare(
      `SELECT s.id AS spolka_id, s.nazwa, a.seria, a.nr_od, a.nr_do, a.czesc_licznik, a.czesc_mianownik
         FROM psa_stan_akcji a JOIN psa_spolki s ON s.id = a.spolka_id
        WHERE a.osoba_id = ? AND a.data_do IS NULL ORDER BY s.nazwa COLLATE NOCASE, a.seria, a.nr_od`
    )
    .all(Number(id));
  const sprawy = db
    .prepare(
      `SELECT sp.id, sp.stan, sp.spolka_id, s.nazwa AS spolka, sp.data_wplywu FROM psa_sprawy sp
         JOIN psa_spolki s ON s.id = sp.spolka_id
        WHERE sp.zadajacy_osoba_id = ? ORDER BY sp.id DESC`
    )
    .all(Number(id));
  return { akcje, sprawy };
}

module.exports = { wczytaj, lista, takieSame, dodaj, zmien, ustawZgodeEmail, powiazania };
