'use strict';

/** Sprawy — SQL. Stan sprawy zmienia wyłącznie `sprawy.zmienStan` (tabela przejść — § 3.3). */

const czas = require('../pomocnicze/czas');

const JSON_POLA = { operacje_json: 'operacje', checklista_json: 'checklista', dopisane_json: 'dopisane', zgody_json: 'zgody' };

function zWiersza(w) {
  if (!w) return null;
  const s = { ...w };
  for (const [kol, pole] of Object.entries(JSON_POLA)) {
    s[pole] = JSON.parse(w[kol]);
    delete s[kol];
  }
  return s;
}

function wczytaj(db, id) {
  return zWiersza(db.prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(Number(id)));
}

function poKluczu(db, klucz) {
  return zWiersza(db.prepare('SELECT * FROM psa_sprawy WHERE klucz_idempotencji = ?').get(klucz));
}

function lista(db, { spolkaId = null, stany = null } = {}) {
  const warunki = [];
  const arg = [];
  if (spolkaId != null) {
    warunki.push('sp.spolka_id = ?');
    arg.push(Number(spolkaId));
  }
  if (Array.isArray(stany) && stany.length > 0) {
    warunki.push(`sp.stan IN (${stany.map(() => '?').join(',')})`);
    arg.push(...stany);
  }
  return db
    .prepare(
      `SELECT sp.*, s.nazwa AS spolka, o.nazwa AS zadajacy_nazwa FROM psa_sprawy sp
         JOIN psa_spolki s ON s.id = sp.spolka_id
         LEFT JOIN psa_osoby o ON o.id = sp.zadajacy_osoba_id
        ${warunki.length ? `WHERE ${warunki.join(' AND ')}` : ''}
        ORDER BY sp.id DESC`
    )
    .all(...arg)
    .map(zWiersza);
}

function dodaj(db, s) {
  const teraz = czas.terazIso();
  const w = db
    .prepare(
      `INSERT INTO psa_sprawy (spolka_id, zadajacy, zadajacy_osoba_id, zadajacy_opis, data_wplywu,
         operacje_json, podstawa, podstawa_data, klucz_idempotencji, autor, utworzono, zmieniono)
       VALUES (@spolka_id, @zadajacy, @zadajacy_osoba_id, @zadajacy_opis, @data_wplywu,
         @operacje_json, @podstawa, @podstawa_data, @klucz_idempotencji, @autor, @teraz, @teraz)`
    )
    .run({
      spolka_id: Number(s.spolka_id),
      zadajacy: s.zadajacy,
      zadajacy_osoba_id: s.zadajacy_osoba_id ?? null,
      zadajacy_opis: s.zadajacy_opis ?? null,
      data_wplywu: s.data_wplywu,
      operacje_json: JSON.stringify(s.operacje || []),
      podstawa: s.podstawa ?? null,
      podstawa_data: s.podstawa_data ?? null,
      klucz_idempotencji: s.klucz_idempotencji ?? null,
      autor: s.autor,
      teraz,
    });
  return Number(w.lastInsertRowid);
}

const KOLUMNY = {
  zadajacy: 'zadajacy',
  zadajacy_osoba_id: 'zadajacy_osoba_id',
  zadajacy_opis: 'zadajacy_opis',
  data_wplywu: 'data_wplywu',
  podstawa: 'podstawa',
  podstawa_data: 'podstawa_data',
  oplata: 'oplata',
  tresc_zatwierdzona: 'tresc_zatwierdzona',
  operacje: 'operacje_json',
  checklista: 'checklista_json',
  dopisane: 'dopisane_json',
  zgody: 'zgody_json',
};

/** Zapisuje pola sprawy (bez stanu). */
function zapisz(db, id, pola) {
  const klucze = Object.keys(pola).filter((k) => KOLUMNY[k]);
  if (klucze.length === 0) return;
  const wartosci = {};
  for (const k of klucze) wartosci[k] = KOLUMNY[k].endsWith('_json') ? JSON.stringify(pola[k]) : pola[k];
  db.prepare(
    `UPDATE psa_sprawy SET ${klucze.map((k) => `${KOLUMNY[k]} = @${k}`).join(', ')}, zmieniono = @zmieniono WHERE id = @id`
  ).run({ ...wartosci, zmieniono: czas.terazIso(), id: Number(id) });
}

/** Zmiana stanu — wołana tylko przez `sprawy.zmienStan` po sprawdzeniu tabeli przejść. */
function ustawStan(db, id, stan, pola = {}) {
  const dozwolone = ['wstrzymana_od', 'wznowiona_od', 'przyczyna_odmowy'];
  const klucze = Object.keys(pola).filter((k) => dozwolone.includes(k));
  db.prepare(
    `UPDATE psa_sprawy SET stan = @stan${klucze.map((k) => `, ${k} = @${k}`).join('')}, zmieniono = @zmieniono WHERE id = @id`
  ).run({ ...pola, stan, zmieniono: czas.terazIso(), id: Number(id) });
}

module.exports = { wczytaj, poKluczu, lista, dodaj, zapisz, ustawStan };
