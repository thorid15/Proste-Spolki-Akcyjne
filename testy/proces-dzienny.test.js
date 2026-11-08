'use strict';

/** Jeden proces dzienny: opłaty za prowadzenie (U-30), przypomnienia, retencja wniosków (U-19). */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

process.env.KATALOG_DOKUMENTOW = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-proces-'));

const { bazaTestowa, dodajSpolke } = require('./pomoc');
const proces = require('../server/proces-dzienny');
const oplaty = require('../server/oplaty');

/** Spółka z otwartym rejestrem (materializacja wpisu „otwarcie” ustawiona wprost). */
function spolka(db, { otwarcie, platnosc = 'roczna', zamkniecie = null, email = null }) {
  const s = dodajSpolke(db, { email, platnosc });
  db.prepare('UPDATE psa_spolki SET data_otwarcia = ?, data_zamkniecia = ? WHERE id = ?').run(otwarcie, zamkniecie, s);
  return s;
}

const okresy = (db, s) =>
  db.prepare("SELECT okres, kwota_netto_grosze AS kwota FROM psa_oplaty WHERE spolka_id = ? AND typ = 'prowadzenie' ORDER BY okres").all(s);

test('U-30 roczna: opłata w dniu otwarcia i w każdą rocznicę; ponowne uruchomienie nic nie dubluje; zaległe nadrabia', () => {
  const db = bazaTestowa();
  const s = spolka(db, { otwarcie: '2026-01-31' });
  oplaty.naliczProwadzenie(db, { dzis: '2026-01-30' });
  assert.deepEqual(okresy(db, s), []);
  oplaty.naliczProwadzenie(db, { dzis: '2026-01-31' });
  oplaty.naliczProwadzenie(db, { dzis: '2026-01-31' });
  assert.deepEqual(okresy(db, s), [{ okres: '2026-01-31..2027-01-30', kwota: 120000 }]);
  oplaty.naliczProwadzenie(db, { dzis: '2028-02-05' });
  assert.deepEqual(okresy(db, s).map((o) => o.okres), ['2026-01-31..2027-01-30', '2027-01-31..2028-01-30', '2028-01-31..2029-01-30']);
});

test('U-30 miesięczna: rata co miesiąc w dniu otwarcia (31 → ostatni dzień miesiąca), każda osobno', () => {
  const db = bazaTestowa();
  const s = spolka(db, { otwarcie: '2026-01-31', platnosc: 'miesieczna' });
  oplaty.naliczProwadzenie(db, { dzis: '2026-04-01' });
  assert.deepEqual(okresy(db, s), [
    { okres: '2026-01-31..2026-02-27', kwota: 10000 },
    { okres: '2026-02-28..2026-03-30', kwota: 10000 },
    { okres: '2026-03-31..2026-04-29', kwota: 10000 },
  ]);
});

test('po zamknięciu rejestru nowe opłaty nie powstają', () => {
  const db = bazaTestowa();
  const s = spolka(db, { otwarcie: '2026-01-31', platnosc: 'miesieczna', zamkniecie: '2026-03-15' });
  oplaty.naliczProwadzenie(db, { dzis: '2026-06-01' });
  assert.deepEqual(okresy(db, s).map((o) => o.okres), ['2026-01-31..2026-02-27', '2026-02-28..2026-03-30']);
});

test('zmiana z rocznej na miesięczną: raty od końca opłaconego roku, bez dublowania', () => {
  const db = bazaTestowa();
  const s = spolka(db, { otwarcie: '2026-01-31' });
  oplaty.naliczProwadzenie(db, { dzis: '2026-01-31' });
  db.prepare("UPDATE psa_spolki SET platnosc = 'miesieczna' WHERE id = ?").run(s);
  oplaty.naliczProwadzenie(db, { dzis: '2027-03-01' });
  assert.deepEqual(okresy(db, s).map((o) => o.okres), ['2026-01-31..2027-01-30', '2027-01-31..2027-02-27', '2027-02-28..2027-03-30']);
});

test('przypomnienie o kolejnym roku: e-mail do spółki 30 dni przed rocznicą, raz; bez e-maila albo przy racie miesięcznej — nic', async () => {
  const db = bazaTestowa();
  const s = spolka(db, { otwarcie: '2026-01-31', email: 'zarzad@alfa.example' });
  spolka(db, { otwarcie: '2026-01-31' });
  spolka(db, { otwarcie: '2026-01-31', platnosc: 'miesieczna', email: 'm@m.example' });
  const wyslane = [];
  const poczta = { wyslij: async (w) => (wyslane.push(w), { wyslano: true }) };
  assert.equal(await proces.wyslijPrzypomnienia(db, { dzis: '2026-12-15', poczta }), 0);
  assert.equal(await proces.wyslijPrzypomnienia(db, { dzis: '2027-01-05', poczta }), 1);
  assert.equal(await proces.wyslijPrzypomnienia(db, { dzis: '2027-01-06', poczta }), 0);
  assert.equal(wyslane.length, 1);
  assert.equal(wyslane[0].do, 'zarzad@alfa.example');
  assert.ok(wyslane[0].tekst.includes('31.01.2027') && wyslane[0].tekst.includes('1 476,00 zł'), wyslane[0].tekst);
  void s;
});

function wniosek(db, { stan, zmieniono }) {
  const id = Number(
    db
      .prepare(
        `INSERT INTO psa_wnioski (stan, krs, przejecie, dotychczasowy_podmiot, dane_json, checklista_json, notatka, utworzono, zmieniono)
         VALUES (?, '0000777001', 1, 'Rejestr Sp. z o.o.', ?, '{"a":true}', 'notatka', ?, ?)`
      )
      .run(stan, JSON.stringify({ reprezentant: { nazwa: 'Jan Klient', pesel: '44051401359' } }), zmieniono, zmieniono).lastInsertRowid
  );
  const plik = `wniosek-${id}.pdf`;
  fs.writeFileSync(path.join(process.env.KATALOG_DOKUMENTOW, plik), '%PDF-1.4');
  db.prepare("INSERT INTO psa_pliki (wniosek_id, nazwa, sciezka, typ, sha256, wgral, wgrano) VALUES (?, 'umowa.pdf', ?, 'application/pdf', 'x', 'klient', ?)").run(id, plik, zmieniono);
  db.prepare("INSERT INTO psa_konta (email, wniosek_id, utworzono) VALUES (?, ?, ?)").run(`klient${id}@example.com`, id, zmieniono);
  return { id, plik };
}

test('U-19: odrzucony albo porzucony (90 dni bez zmian) wniosek traci dane klienta — zostają KRS, daty i stan', () => {
  const db = bazaTestowa();
  const odrzucony = wniosek(db, { stan: 'odrzucony', zmieniono: '2026-11-01T10:00:00+01:00' });
  const porzucony = wniosek(db, { stan: 'roboczy', zmieniono: '2026-08-09T10:00:00+02:00' });
  const swiezy = wniosek(db, { stan: 'zlozony', zmieniono: '2026-08-11T10:00:00+02:00' });
  const przyjety = wniosek(db, { stan: 'przyjety', zmieniono: '2026-01-01T10:00:00+01:00' });
  assert.equal(proces.retencjaWnioskow(db, { dzis: '2026-11-08' }), 2);
  for (const w of [odrzucony, porzucony]) {
    const r = db.prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(w.id);
    assert.deepEqual([r.dane_json, r.checklista_json, r.notatka, r.dotychczasowy_podmiot, r.krs], ['{}', '{}', null, null, '0000777001']);
    assert.equal(db.prepare('SELECT COUNT(*) AS ile FROM psa_pliki WHERE wniosek_id = ?').get(w.id).ile, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS ile FROM psa_konta WHERE wniosek_id = ?').get(w.id).ile, 0);
    assert.ok(!fs.existsSync(path.join(process.env.KATALOG_DOKUMENTOW, w.plik)));
  }
  for (const w of [swiezy, przyjety]) assert.notEqual(db.prepare('SELECT dane_json FROM psa_wnioski WHERE id = ?').get(w.id).dane_json, '{}');
  assert.equal(proces.retencjaWnioskow(db, { dzis: '2026-11-08' }), 0);
});

test('procesDzienny: opłaty, przypomnienia, retencja wniosków i dziennika w jednym przebiegu', async () => {
  const db = bazaTestowa();
  spolka(db, { otwarcie: '2026-01-31' });
  const wynik = await proces.procesDzienny(db, { dzis: '2026-02-01', poczta: { wyslij: async () => ({ wyslano: true }) } });
  assert.deepEqual(wynik, { oplaty: 1, przypomnienia: 0, wnioski: 0 });
});
