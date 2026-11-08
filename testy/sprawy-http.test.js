'use strict';

/**
 * Faza 1 — trasy HTTP spraw, spółek, osób i plików (ekrany § 5): sesja pracownika, błędy przy
 * polach, karta osoby z historią i zgodą e-mail (U-11, U-25), kokpit „stan na” dzień, sprawa
 * krok po kroku, przyjęcie i pobranie pliku (§ 7 pkt 3), ustawienia tylko dla administratora.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-sprawy-http.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-sprawy-dokumenty');
fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');
const pisma = require('../server/logika/pisma');
const daneSpolki = require('../server/dane/spolki');
const czas = require('../server/pomocnicze/czas');
const { CHECKLISTA_PELNA, PDF_TESTOWY, ustawKancelarie } = require('./pomoc');

ustawKancelarie(db());

let serwer;
let ADRES;
const ciastka = {};

async function zaloguj(email) {
  const odp = await fetch(`${ADRES}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, haslo: 'HasloTestowe123' }),
  });
  assert.equal(odp.status, 200);
  ciastka[email] = odp.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

async function zadanie(metoda, sciezka, cialo, { kto = 'admin@example.com', plik = null } = {}) {
  const naglowki = { Cookie: ciastka[kto] || '', Origin: ADRES };
  let body;
  if (plik) {
    body = new FormData();
    body.append('plik', new Blob([plik.tresc]), plik.nazwa);
  } else if (cialo !== undefined) {
    naglowki['Content-Type'] = 'application/json';
    body = JSON.stringify(cialo);
  }
  const odp = await fetch(`${ADRES}${sciezka}`, { method: metoda, headers: naglowki, body });
  const typ = odp.headers.get('content-type') || '';
  return { status: odp.status, naglowki: odp.headers, dane: typ.includes('json') ? await odp.json() : await odp.text() };
}

let spolka;

test.before(async () => {
  serwer = app.listen(0);
  ADRES = `http://localhost:${serwer.address().port}`;
  const hash = await hasla.hashuj('HasloTestowe123');
  const dodaj = db().prepare('INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono) VALUES (?, ?, ?, ?, 1, ?)');
  dodaj.run('Łukasz Kozon', 'admin@example.com', hash, 'admin', czas.terazIso());
  dodaj.run('Pracownik', 'pracownik@example.com', hash, 'pracownik', czas.terazIso());
  await zaloguj('admin@example.com');
  await zaloguj('pracownik@example.com');
  spolka = daneSpolki.dodaj(db(), {
    krs: '0000555001',
    nazwa: 'Omega P.S.A.',
    siedziba: 'Gdynia',
    adres: 'ul. Portowa 1, 81-001 Gdynia',
    sad_rejestrowy: 'Sąd Rejonowy Gdańsk-Północ, VIII Wydział Gospodarczy KRS',
    data_rejestracji: '2026-01-10',
  });
});

test.after(() => {
  serwer.close();
  for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

test('trasy kancelarii wymagają sesji pracownika; ustawienia i integralność — tylko administrator', async () => {
  for (const [m, s] of [['GET', '/api/psa/sprawy'], ['GET', '/api/psa/spolki'], ['GET', '/api/psa/osoby'], ['GET', '/api/psa/pliki/1'], ['POST', '/api/psa/sprawy']]) {
    assert.equal((await zadanie(m, s, undefined, { kto: 'nikt' })).status, 401, `${m} ${s}`);
  }
  assert.equal((await zadanie('GET', '/api/psa/ustawienia', undefined, { kto: 'pracownik@example.com' })).status, 403);
  assert.equal((await zadanie('POST', '/api/psa/integralnosc', undefined, { kto: 'pracownik@example.com' })).status, 403);
  const integralnosc = await zadanie('POST', '/api/psa/integralnosc');
  assert.equal(integralnosc.dane.ok, true);
  const ustawienia = await zadanie('GET', '/api/psa/ustawienia');
  assert.ok(ustawienia.dane.kancelaria.some((p) => p.klucz === 'nazwa'));
  assert.equal(ustawienia.dane.stawki, undefined, 'U-05: bez edycji stawek');
  assert.equal((await zadanie('GET', '/api/psa/portal/start')).status, 404, 'portal odłączony do Fazy 5');
});

let anna;
let jan;

test('osoby: błędy przy polach, ostrzeżenie o powtórzonym PESEL-u, karta osoby z historią i zgodą e-mail', async () => {
  const zle = await zadanie('POST', '/api/psa/osoby', { typ: 'fizyczna', nazwa: 'Zły PESEL', pesel: '44051401358' });
  assert.equal(zle.status, 422);
  assert.deepEqual(zle.dane.bledy.map((b) => b.pole).sort(), ['adres', 'pesel']);

  anna = (await zadanie('POST', '/api/psa/osoby', { typ: 'fizyczna', nazwa: 'Anna Nowak', pesel: '44051401359', adres: 'ul. A 1, Gdynia' })).dane.osoba;
  const druga = await zadanie('POST', '/api/psa/osoby', { typ: 'fizyczna', nazwa: 'Anna N.', pesel: '44051401359', adres: 'ul. A 1' });
  assert.equal(druga.status, 201);
  assert.match(druga.dane.ostrzezenia[0], /Anna Nowak/);
  jan = (await zadanie('POST', '/api/psa/osoby', { typ: 'fizyczna', nazwa: 'Jan Bez', data_urodzenia: '1985-02-03', adres: 'ul. B 2' })).dane.osoba;

  const edycja = await zadanie('PUT', `/api/psa/osoby/${anna.id}`, { adres: 'ul. Nowa 3, Gdynia', email: 'anna@example.com', pep: true, pep_opis: 'radna' });
  assert.equal(edycja.status, 200);
  assert.equal(edycja.dane.osoba.adres, 'ul. Nowa 3, Gdynia');

  const bezPliku = await zadanie('PUT', `/api/psa/osoby/${anna.id}`, { zgoda_email: { zgoda: true } });
  assert.equal(bezPliku.status, 422);
  assert.match(bezPliku.dane.blad, /plik podpisanej zgody/);
  const plik = await zadanie('POST', `/api/psa/osoby/${anna.id}/pliki`, undefined, { plik: { tresc: PDF_TESTOWY, nazwa: 'zgoda-podpisana.pdf' } });
  assert.equal(plik.status, 201);
  assert.equal((await zadanie('PUT', `/api/psa/osoby/${anna.id}`, { zgoda_email: { zgoda: true, plik_id: plik.dane.id } })).dane.osoba.zgoda_email, 1);
  assert.equal((await zadanie('PUT', `/api/psa/osoby/${anna.id}`, { email: '' })).status, 422, 'adresu nie usuwa się przy zgodzie');
  assert.equal((await zadanie('PUT', `/api/psa/osoby/${anna.id}`, { zgoda_email: { zgoda: false } })).status, 422, 'wycofanie wymaga daty');
  await zadanie('PUT', `/api/psa/osoby/${anna.id}`, { zgoda_email: { zgoda: false, data: czas.dzisIso() } });

  const karta = await zadanie('GET', `/api/psa/osoby/${anna.id}`);
  assert.deepEqual(karta.dane.historia.map((h) => h.pole).sort(), ['adres', 'email', 'pep', 'pep_opis', 'zgoda_email', 'zgoda_email']);
  assert.equal(karta.dane.historia.find((h) => h.pole === 'zgoda_email' && h.nowa === '1').plik_id, plik.dane.id);
  assert.deepEqual(karta.dane.pliki.map((p) => p.nazwa), ['zgoda-podpisana.pdf']);
  assert.equal((await zadanie('GET', '/api/psa/osoby?q=Nowak')).dane.length, 1);
});

test('sprawa krok po kroku: otwarcie jednym kliknięciem, zbycie — Dalej, list, Nadano, wpis; kokpit „stan na” dzień', async () => {
  const otwarcie = await zadanie('POST', '/api/psa/sprawy', {
    spolka_id: spolka,
    zadajacy: 'spolka',
    wpisz: true,
    checklista: CHECKLISTA_PELNA,
    operacje: [{ typ: 'otwarcie', zrodlo: 'zalozenie', serie: [{ seria: 'A', numery: '1-100', liczba: 100, data_wpisu_krs: '2026-01-10' }], akcjonariusze: [{ osoba_id: jan.id, akcje: [{ seria: 'A', numery: '1-100', liczba: 100 }] }] }],
  });
  assert.equal(otwarcie.status, 201);
  assert.equal(otwarcie.dane.sprawa.stan, 'wpisana');

  const nowa = await zadanie('POST', '/api/psa/sprawy', { spolka_id: spolka, zadajacy: 'osoba', zadajacy_osoba_id: anna.id, klucz_idempotencji: 'zbycie-1' });
  assert.equal(nowa.status, 201);
  assert.equal(nowa.dane.krok, 1);
  assert.deepEqual(nowa.dane.bledy.map((b) => b.komunikat), ['Dodaj co najmniej jedną zmianę.']);
  const id = nowa.dane.sprawa.id;
  const ponownie = await zadanie('POST', '/api/psa/sprawy', { spolka_id: spolka, zadajacy: 'spolka', klucz_idempotencji: 'zbycie-1' });
  assert.deepEqual([ponownie.status, ponownie.dane.sprawa.id], [200, id]);

  const zapis = await zadanie('PUT', `/api/psa/sprawy/${id}`, {
    podstawa: 'Umowa sprzedaży akcji',
    operacje: [{ typ: 'przeniesienie', zbywca_osoba_id: jan.id, nabywcy: [{ osoba_id: anna.id, akcje: [{ seria: 'A', numery: '1-10', liczba: 10 }] }] }],
  });
  assert.deepEqual(zapis.dane.bledy, []);
  assert.deepEqual(zapis.dane.osoby.map((o) => o.nazwa), ['Jan Bez']);
  assert.deepEqual(zapis.dane.stan_po.akcjonariusze.map((p) => [p.osoba_id, p.liczba]), [[jan.id, 90], [anna.id, 10]].sort((a, b) => a[0] - b[0]));

  const dalej = await zadanie('POST', `/api/psa/sprawy/${id}/krok`, { krok: 2 });
  assert.equal(dalej.dane.krok, 2);
  const powiadomienie = dalej.dane.osoby[0].powiadomienie;
  assert.deepEqual([powiadomienie.kanal, powiadomienie.stan], ['list', 'do_wyslania']);
  assert.equal((await zadanie('PUT', `/api/psa/sprawy/${id}`, { podstawa: 'x' })).status, 422, 'po kroku 1 treść tylko przez „Zmień treść”');

  const zablokowany = await zadanie('POST', `/api/psa/sprawy/${id}/stan`, { stan: 'wpisana' });
  assert.equal(zablokowany.status, 422);
  assert.ok(zablokowany.dane.bledy.some((b) => b.pole === 'oplata'));

  await zadanie('PUT', `/api/psa/sprawy/${id}`, { checklista: CHECKLISTA_PELNA, oplata: 'tak' });
  pisma.nadano(db(), powiadomienie.id);
  const wpis = await zadanie('POST', `/api/psa/sprawy/${id}/stan`, { stan: 'wpisana' });
  assert.equal(wpis.status, 200);
  assert.deepEqual([wpis.dane.sprawa.stan, wpis.dane.krok], ['wpisana', 3]);
  assert.deepEqual(wpis.dane.pisma.filter((p) => p.typ === 'powiadomienie_wpis').map((p) => p.adresat), ['spolka', 'osoba']);

  const kokpit = await zadanie('GET', `/api/psa/spolki/${spolka}`);
  assert.equal(kokpit.dane.rejestr.otwarty, true);
  assert.equal(kokpit.dane.wpisy.length, 2);
  assert.equal(kokpit.dane.osoby[anna.id].nazwa, 'Anna Nowak');
  assert.equal(kokpit.dane.oplaty[0].kwota_netto_grosze, 10000);
  const wczoraj = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  assert.deepEqual((await zadanie('GET', `/api/psa/spolki/${spolka}?dzien=${wczoraj}`)).dane.rejestr.akcjonariusze, [], 'stan na wczoraj — przed otwarciem');
  assert.equal((await zadanie('GET', '/api/psa/sprawy?stan=wpisana')).dane.length, 2);
});

test('spółka: „Edytuj” z błędami przy polach i historią', async () => {
  const zle = await zadanie('PUT', `/api/psa/spolki/${spolka}`, { nazwa: '', email: 'zly', platnosc: 'tygodniowa' });
  assert.equal(zle.status, 422);
  assert.deepEqual(zle.dane.bledy.map((b) => b.pole).sort(), ['email', 'nazwa', 'platnosc']);
  const ok = await zadanie('PUT', `/api/psa/spolki/${spolka}`, { email: 'biuro@omega.example', platnosc: 'miesieczna', krs: '0000000001' });
  assert.deepEqual([ok.dane.email, ok.dane.platnosc, ok.dane.krs], ['biuro@omega.example', 'miesieczna', '0000555001']);
  assert.deepEqual((await zadanie('GET', `/api/psa/spolki/${spolka}`)).dane.historia.map((h) => h.pole).sort(), ['email', 'platnosc']);
});

test('pliki: PDF przyjęty i pobierany jako załącznik; inny format albo HTML udający PDF — „Wgraj plik PDF”', async () => {
  const sprawa = (await zadanie('GET', '/api/psa/sprawy')).dane[0];
  const ok = await zadanie('POST', `/api/psa/sprawy/${sprawa.id}/pliki`, undefined, { plik: { tresc: PDF_TESTOWY, nazwa: 'umowa sprzedaży.pdf' } });
  assert.equal(ok.status, 201);
  for (const [tresc, nazwa] of [['<html><script>alert(1)</script></html>', 'skan.pdf'], ['PK..', 'umowa.docx'], ['<svg/>', 'rys.svg']]) {
    const zle = await zadanie('POST', `/api/psa/sprawy/${sprawa.id}/pliki`, undefined, { plik: { tresc, nazwa } });
    assert.deepEqual([zle.status, zle.dane.blad], [422, 'Wgraj plik PDF.'], nazwa);
  }
  const pobranie = await zadanie('GET', `/api/psa/pliki/${ok.dane.id}`);
  assert.equal(pobranie.status, 200);
  assert.equal(pobranie.naglowki.get('x-content-type-options'), 'nosniff');
  assert.match(pobranie.naglowki.get('content-disposition'), /^attachment; filename\*=UTF-8''umowa%20sprzeda%C5%BCy\.pdf$/);
  const naDysku = db().prepare('SELECT sciezka FROM psa_pliki WHERE id = ?').get(ok.dane.id).sciezka;
  assert.match(naDysku, /^[0-9a-f-]{36}\.pdf$/, 'losowa nazwa na dysku');
  assert.equal((await zadanie('GET', '/api/psa/pliki/999')).status, 404);
  assert.equal(db().prepare("SELECT COUNT(*) AS ile FROM psa_dziennik WHERE akcja = 'pobranie_pliku'").get().ile, 1);
});
