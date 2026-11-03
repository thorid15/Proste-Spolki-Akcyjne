'use strict';

/** R4 zad. 13 (D-089): pokrycie nie blokuje otwarcia; wpis pokrycia bezpłatny; stan domyślny „brak informacji”. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-d089.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-d089-dok');
delete process.env.PSA_TRYB_TESTOWY;

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');
const czas = require('../server/pomocnicze/czas');

let serwer;
let ADRES;
let prac;
const S = {};
const ciastko = (odp) => odp.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
async function zapytaj(metoda, sciezka, cialo) {
  const odp = await fetch(`${ADRES}${sciezka}`, { method: metoda, headers: { 'Content-Type': 'application/json', Cookie: prac }, body: cialo === undefined ? undefined : JSON.stringify(cialo) });
  return [odp.status, await odp.json()];
}

test.before(async () => {
  serwer = app.listen(0);
  await new Promise((r) => serwer.once('listening', r));
  ADRES = `http://127.0.0.1:${serwer.address().port}`;
  const teraz = czas.terazIso();
  db().prepare(`INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono) VALUES ('A', 'a-d089@example.pl', ?, 'admin', 1, ?)`).run(await hasla.hashuj('HasloTestowe123'), teraz);
  const l = await fetch(`${ADRES}/api/psa/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a-d089@example.pl', haslo: 'HasloTestowe123' }) });
  prac = ciastko(l);
  S.spolkaId = Number(db().prepare(`INSERT INTO psa_spolki (nazwa, krs, forma_prawna, status, data_umowy, utworzono) VALUES ('Pokrycie P.S.A.', '0000890089', 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', '2026-01-02', ?)`).run(teraz).lastInsertRowid);
  S.osoba = Number(db().prepare(
    `INSERT INTO psa_osoby (typ, imie, nazwisko, data_urodzenia, kod_pocztowy, miejscowosc, ulica, nr_domu, zgoda_email_status, aml_status, utworzono)
     VALUES ('fizyczna', 'Paweł', 'Pokrywający', '1980-01-01', '80-001', 'Gdańsk', 'Rejestrowa', '1', 'brak', 'wykonane', ?)`
  ).run(teraz).lastInsertRowid);
});
test.after(() => {
  serwer.close();
  for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

test('D-089: otwarcie rejestru bez danych o pokryciu przechodzi — stan „brak informacji”', async () => {
  const [st, odp] = await zapytaj('POST', `/api/psa/spolki/${S.spolkaId}/otworz-rejestr`, {
    checklista: { forma: true, wpis_krs: true, uchwala: true, reprezentacja: true, umowa: true, jedna_umowa: true, dane_z_umowy: true, ograniczenia: true, bilans: true, zakres_danych: true, aml: true },
    zdarzenia: [
      { typ: 'emisja', klucz_tymczasowy: 'e1', dane: { seria: 'A', nr_pierwszy: 1, ilosc: 100, data_wpisu_krs: '2026-01-02', rodzaj_akcji: 'zwykla' } },
      { typ: 'objecie', dane: { emisja_zdarzenie_id: { __odwolanie_do_partii: 'e1' }, pozycje: [{ osoba_id: S.osoba, ilosc: 100 }] } },
    ],
  });
  assert.ok(st < 300, JSON.stringify(odp));
  S.emisjaId = odp.zdarzenia.find((z) => z.typ === 'emisja').id;
  const [, html] = await fetch(`${ADRES}/api/psa/spolki/${S.spolkaId}/informacja.html`, { headers: { Cookie: prac } }).then(async (r) => [r.status, await r.text()]);
  assert.match(html, /brak informacji o pełnym pokryciu/);
});

test('D-089: wpis „pokryte w całości” (uchwała zarządu) nie tworzy opłaty', async () => {
  const oplatyPrzed = db().prepare('SELECT COUNT(*) AS n FROM psa_oplaty').get().n;
  const [, z] = await zapytaj('POST', '/api/psa/sprawy', { spolka_id: S.spolkaId, typ_zdarzenia: 'pokrycie_akcji', zrodlo: 'papier', zadajacy_osoba_id: S.osoba, zadajacy_rola: 'spolka' });
  await zapytaj('PATCH', `/api/psa/sprawy/${z.sprawa.id}`, { akcja: 'weryfikuj' });
  const [st, wpis] = await zapytaj('POST', `/api/psa/sprawy/${z.sprawa.id}/wpisz`, {
    dane: { emisja_zdarzenie_id: S.emisjaId, osoba_id: S.osoba, pokryta: 'tak', podstawa_opis: 'Uchwała zarządu z 2.11.2026 (art. 300(9) § 2 KSH)' },
  });
  assert.equal(st, 201, JSON.stringify(wpis));
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM psa_oplaty').get().n, oplatyPrzed, 'bez opłaty (D-083)');
});
