'use strict';

/**
 * R4 zad. 7 (K5, D-092): zgoda na e-mail i powiadomienia automatyczne to dane kartoteki osoby —
 * nie informacja w rejestrze. Jedno źródło stanu: `stanOswiadczen`, historia poza łańcuchem.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-k5.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-k5-dok');
process.env.PORTAL_WLACZONY = 'true';
delete process.env.PSA_TRYB_TESTOWY;

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');
const czas = require('../server/pomocnicze/czas');
const rejestr = require('../server/rejestr');
const widoki = require('../server/widoki');
const { informacjaZRejestru } = require('../server/logika/informacja-dokument');
const { stanOswiadczen } = require('../server/oswiadczenia');
const { wymagaListu, TEKST_ZNACZNIKA } = require('../publiczne/js/kontakt.js');

let serwer;
let ADRES;
const S = {};
const ciastko = (odp) => odp.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
async function zapytaj(metoda, sciezka, cialo, kto) {
  const odp = await fetch(`${ADRES}${sciezka}`, { method: metoda, headers: { 'Content-Type': 'application/json', Cookie: kto }, body: cialo === undefined ? undefined : JSON.stringify(cialo) });
  return [odp.status, await odp.json()];
}
const liczba = (sql, ...p) => db().prepare(sql).get(...p).n;

test.before(async () => {
  serwer = app.listen(0);
  await new Promise((r) => serwer.once('listening', r));
  ADRES = `http://127.0.0.1:${serwer.address().port}`;
  const hash = await hasla.hashuj('HasloTestowe123');
  const teraz = czas.terazIso();
  S.spolkaId = Number(db().prepare(`INSERT INTO psa_spolki (nazwa, krs, email, forma_prawna, status, data_umowy, utworzono) VALUES ('K5 P.S.A.', '0000500500', 'k5@example.pl', 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', '2026-01-02', ?)`).run(teraz).lastInsertRowid);
  S.zofia = Number(db().prepare(
    `INSERT INTO psa_osoby (typ, imie, nazwisko, data_urodzenia, kod_pocztowy, miejscowosc, ulica, nr_domu, email, zgoda_email_status, aml_status, utworzono)
     VALUES ('fizyczna', 'Zofia', 'Zielińska', '1980-01-01', '80-001', 'Gdańsk', 'Rejestrowa', '7', 'zofia@example.pl', 'potwierdzona', 'wykonane', ?)`
  ).run(teraz).lastInsertRowid);
  const emisja = rejestr.dokonajWpisu(db(), { spolkaId: S.spolkaId, typ: 'emisja', wejscie: { seria: 'A', ilosc: 100, data_wpisu_krs: '2026-01-02' }, autor: 'Test' });
  rejestr.dokonajWpisu(db(), { spolkaId: S.spolkaId, typ: 'objecie', wejscie: { emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: S.zofia, ilosc: 100 }] }, autor: 'Test' });
  db().prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, osoba_id, aktywne, utworzono) VALUES ('zofia@example.pl', ?, 'akcjonariusz', ?, 1, ?)`).run(hash, S.zofia, teraz);
  const k = await fetch(`${ADRES}/api/psa/portal/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'zofia@example.pl', haslo: 'HasloTestowe123' }) });
  S.portal = ciastko(k);
});

test.after(() => {
  serwer.close();
  for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

function wierszZofii() {
  const stan = widoki.widokStanu(db(), S.spolkaId, czas.dzisIso());
  const html = informacjaZRejestru({ kancelaria: { nazwa: 'K' }, spolka: stan.spolka, data: stan.data, stan });
  const i = html.indexOf('Zielińska');
  return html.slice(i, html.indexOf('</tr>', i));
}

test('informacja z rejestru przy zgodzie: sam adres e-mail, bez wzmianki o zgodzie', () => {
  const wiersz = wierszZofii();
  assert.match(wiersz, /zofia@example\.pl/);
  assert.doesNotMatch(wiersz, /zgod|cofn/i);
});

test('cofnięcie zgody w portalu: stan od razu bez zgody, bez zdarzeń rejestru i opłat; informacja bez adresu i bez wzmianki', async () => {
  const [zdarzenia, oplaty, sprawy] = [liczba('SELECT COUNT(*) AS n FROM psa_zdarzenia'), liczba('SELECT COUNT(*) AS n FROM psa_oplaty'), liczba('SELECT COUNT(*) AS n FROM psa_sprawy')];
  const [st, odp] = await zapytaj('POST', '/api/psa/portal/oswiadczenia', { spolka_id: S.spolkaId, rodzaj: 'zgoda_email', zlozone: false }, S.portal);
  assert.equal(st, 201, JSON.stringify(odp));
  const stan = stanOswiadczen(db(), S.zofia);
  assert.equal(stan.zgodaEmail, false);
  assert.ok(stan.zmieniono);
  assert.equal(liczba('SELECT COUNT(*) AS n FROM psa_zdarzenia'), zdarzenia, 'bez zdarzeń w rejestrze');
  assert.equal(liczba('SELECT COUNT(*) AS n FROM psa_oplaty'), oplaty, 'bez opłat');
  assert.equal(liczba('SELECT COUNT(*) AS n FROM psa_sprawy'), sprawy, 'bez sprawy wpisu');
  const wiersz = wierszZofii();
  assert.doesNotMatch(wiersz, /zofia@example\.pl/);
  assert.doesNotMatch(wiersz, /zgod|cofn/i);
});

test('historia oświadczeń w kartotece (poza łańcuchem): źródło i data', async () => {
  const [, odp] = await zapytaj('GET', `/api/psa/osoby/${S.zofia}`, undefined, await (async () => {
    const hash = await hasla.hashuj('HasloTestowe123');
    db().prepare(`INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono) VALUES ('A', 'a-k5@example.pl', ?, 'admin', 1, ?)`).run(hash, czas.terazIso());
    const l = await fetch(`${ADRES}/api/psa/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a-k5@example.pl', haslo: 'HasloTestowe123' }) });
    return ciastko(l);
  })());
  assert.equal(odp.oswiadczenia.stan.zgodaEmail, false);
  assert.ok(odp.oswiadczenia.historia.some((h) => h.rodzaj === 'zgoda_email' && h.zlozone === 0 && h.zrodlo === 'portal'));
});

test('znacznik „list”: brak zgody albo brak adresu (stan bieżący, nie historia)', () => {
  assert.equal(TEKST_ZNACZNIKA, 'Brak zgody — konieczne powiadomienie listem');
  assert.equal(wymagaListu({ email: 'a@example.pl', zgoda_email_status: 'potwierdzona' }), false);
  assert.equal(wymagaListu({ email: 'a@example.pl', zgoda_email_status: 'brak' }), true);
  assert.equal(wymagaListu({ email: null, zgoda_email_status: 'potwierdzona' }), true, 'historyczna zgoda bez adresu');
  assert.equal(wymagaListu({ email: 'a@example.pl', zgoda_email_status: 'zadeklarowana' }), true);
});
