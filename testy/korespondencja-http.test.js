'use strict';

/** Trasy Korespondencji, informacji z rejestru i opłat (kancelaria). */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-korespondencja-http.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-korespondencja-dokumenty');
fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');
const czas = require('../server/pomocnicze/czas');
const { dodajSpolke, dodajOsobe, otworz, ustawKancelarie } = require('./pomoc');

let serwer;
let ADRES;
let ciastko = '';

async function zadanie(metoda, sciezka, cialo, { zalogowany = true } = {}) {
  const naglowki = { Cookie: zalogowany ? ciastko : '', Origin: ADRES };
  if (cialo !== undefined) naglowki['Content-Type'] = 'application/json';
  const odp = await fetch(`${ADRES}${sciezka}`, { method: metoda, headers: naglowki, body: cialo === undefined ? undefined : JSON.stringify(cialo) });
  const typ = odp.headers.get('content-type') || '';
  const dane = typ.includes('json') ? await odp.json() : /pdf|csv|zip/.test(typ) ? Buffer.from(await odp.arrayBuffer()) : await odp.text();
  return { status: odp.status, naglowki: odp.headers, dane };
}

function spolkaZRejestrem(nadpisania) {
  const s = dodajSpolke(db(), nadpisania);
  const a = dodajOsobe(db(), { nazwa: 'Anna A' });
  otworz(db(), s, { serie: [{ seria: 'A', numery: '1-10', liczba: 10, data_wpisu_krs: '2026-01-10' }], akcjonariusze: [{ osoba_id: a, akcje: [{ seria: 'A', numery: '1-10', liczba: 10 }] }] });
  return s;
}

test.before(async () => {
  serwer = app.listen(0);
  ADRES = `http://localhost:${serwer.address().port}`;
  ustawKancelarie(db());
  const hash = await hasla.hashuj('HasloTestowe123');
  db().prepare('INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono) VALUES (?, ?, ?, ?, 1, ?)').run('Pracownik', 'pracownik@example.com', hash, 'pracownik', czas.terazIso());
  const odp = await fetch(`${ADRES}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pracownik@example.com', haslo: 'HasloTestowe123' }),
  });
  ciastko = odp.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
});

test.after(() => {
  serwer.close();
  for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

test('Korespondencja wymaga sesji pracownika; nieznany filtr — błąd przy polu', async () => {
  assert.equal((await zadanie('GET', '/api/psa/korespondencja', undefined, { zalogowany: false })).status, 401);
  const zly = await zadanie('GET', '/api/psa/korespondencja?filtr=wszystko');
  assert.equal(zly.status, 422);
});

test('informacja z kokpitu (list): w „listach do nadania”, podgląd PDF, „Wyślij” odmawia, „Nadano” kończy', async () => {
  const s = spolkaZRejestrem();
  const wyd = await zadanie('POST', `/api/psa/spolki/${s}/informacja`, { odbiorca: 'spolka', oplata: 'nie' });
  assert.equal(wyd.status, 201);
  assert.match(wyd.dane.numer, /^INF\//);
  const listy = await zadanie('GET', '/api/psa/korespondencja?filtr=listy');
  const w = listy.dane.find((x) => x.id === wyd.dane.pismo_id);
  assert.deepEqual([w.pismo, w.kanal, w.stan], ['Informacja z rejestru akcjonariuszy', 'list', 'do_wyslania']);
  const sz = await zadanie('GET', `/api/psa/korespondencja/${w.id}`);
  assert.equal(sz.dane.numer, wyd.dane.numer);
  const pdf = await zadanie('GET', `/api/psa/korespondencja/${w.id}/pdf`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.naglowki.get('x-content-type-options'), 'nosniff');
  assert.equal(pdf.dane.subarray(0, 5).toString(), '%PDF-');
  assert.equal((await zadanie('POST', `/api/psa/korespondencja/${w.id}/wyslij`)).status, 422);
  const nad = await zadanie('POST', `/api/psa/korespondencja/${w.id}/nadano`);
  assert.deepEqual([nad.status, nad.dane.stan, nad.dane.wyslano], [200, 'wyslane', czas.dzisIso()]);
});

test('e-mail bez skonfigurowanej poczty: „Wyślij” zapisuje błąd z przyczyną, pozycja w „błędach”', async () => {
  const s = spolkaZRejestrem({ email: 'zarzad@omega.example' });
  const wyd = await zadanie('POST', `/api/psa/spolki/${s}/informacja`, { odbiorca: 'spolka', oplata: 'tak' });
  const odp = await zadanie('POST', `/api/psa/korespondencja/${wyd.dane.pismo_id}/wyslij`);
  assert.equal(odp.status, 200);
  assert.equal(odp.dane.stan, 'blad');
  assert.match(odp.dane.odpowiedz_serwera, /nie jest skonfigurowana/);
  assert.ok((await zadanie('GET', '/api/psa/korespondencja?filtr=bledy')).dane.some((x) => x.id === wyd.dane.pismo_id));
});

test('Opłaty: lista do zapłaty, „Opłacona”, numer faktury, anulowanie z powodem, eksport CSV', async () => {
  const s = spolkaZRejestrem();
  const pierwsza = await zadanie('POST', `/api/psa/spolki/${s}/informacja`, { odbiorca: 'spolka', oplata: 'tak' });
  const druga = await zadanie('POST', `/api/psa/spolki/${s}/informacja`, { odbiorca: 'spolka', oplata: 'tak' });
  const doZaplaty = (await zadanie('GET', '/api/psa/oplaty?filtr=do_zaplaty')).dane.filter((o) => o.spolka_id === s);
  assert.deepEqual(doZaplaty.map((o) => o.pismo_id).sort(), [pierwsza.dane.pismo_id, druga.dane.pismo_id].sort());
  const [a, b] = doZaplaty;
  const opl = await zadanie('POST', `/api/psa/oplaty/${a.id}/oplacona`);
  assert.deepEqual([opl.status, opl.dane.stan], [200, 'oplacona']);
  const fv = await zadanie('PUT', `/api/psa/oplaty/${a.id}/faktura`, { numer_faktury: 'FV 1/11/2026' });
  assert.equal(fv.dane.numer_faktury, 'FV 1/11/2026');
  assert.equal((await zadanie('POST', `/api/psa/oplaty/${b.id}/anuluj`, {})).status, 422);
  assert.equal((await zadanie('POST', `/api/psa/oplaty/${b.id}/anuluj`, { powod: 'Wydana omyłkowo' })).dane.stan, 'anulowana');
  const csv = await zadanie('GET', '/api/psa/oplaty/csv?filtr=wszystkie');
  assert.equal(csv.status, 200);
  assert.match(csv.naglowki.get('content-type'), /text\/csv/);
  assert.match(csv.naglowki.get('content-disposition'), /attachment; filename="oplaty-/);
  assert.ok(csv.dane.toString().includes('FV 1/11/2026'));
});

test('eksport ZIP z kokpitu: plik do pobrania, ślad w dzienniku', async () => {
  const s = spolkaZRejestrem();
  const odp = await zadanie('GET', `/api/psa/spolki/${s}/eksport`);
  assert.equal(odp.status, 200);
  assert.equal(odp.naglowki.get('content-type'), 'application/zip');
  assert.match(odp.naglowki.get('content-disposition'), /^attachment; filename="rejestr-\d{10}-\d{4}-\d{2}-\d{2}\.zip"$/);
  assert.equal(db().prepare("SELECT COUNT(*) AS ile FROM psa_dziennik WHERE akcja = 'eksport' AND spolka_id = ?").get(s).ile, 1);
});
