'use strict';

/**
 * R4 zad. 7 (K5, D-092): zgoda na e-mail i powiadomienia automatyczne to dane kartoteki osoby —
 * nie informacja w rejestrze. Jedno źródło stanu: `stanOswiadczen`, historia poza łańcuchem.
 */

const test = require('./pominiete')('Faza 5 — portal klienta i płatności przebudowywane');
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
const widoki = null; // Faza 5: widoki portalu przebudowywane
const informacjaZRejestru = null; // Faza 2: informacja z rejestru — server/informacje.js (test do przepisania w Fazie 5)
const stanOswiadczen = null; // U-11: oświadczenia zastąpione zgodą w karcie osoby; portal — Faza 5
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

test('P7: złożenie → cofnięcie → ponowne złożenie (oba rodzaje) — stan aktywny, jedno aktywne oświadczenie na rodzaj', async () => {
  const { zadaPowiadomienAutomatycznych } = require('../server/listy');
  const historia = () => liczba('SELECT COUNT(*) AS n FROM psa_oswiadczenia WHERE osoba_id = ?', S.zofia);
  for (const zlozone of [true, false, true]) {
    const [st, odp] = await zapytaj('POST', '/api/psa/portal/oswiadczenia', { spolka_id: S.spolkaId, rodzaj: 'powiadomienia_automatyczne', zlozone }, S.portal);
    assert.equal(st, 201, JSON.stringify(odp));
  }
  assert.equal(stanOswiadczen(db(), S.zofia).powiadomieniaAutomatyczne, true);
  assert.equal(zadaPowiadomienAutomatycznych(db(), S.zofia, S.spolkaId), true);
  const przed = historia();
  await zapytaj('POST', '/api/psa/portal/oswiadczenia', { spolka_id: S.spolkaId, rodzaj: 'powiadomienia_automatyczne', zlozone: true }, S.portal);
  assert.equal(historia(), przed, 'to samo oświadczenie drugi raz — bez drugiego aktywnego wpisu');

  // Zgoda: Zofia cofnęła ją w poprzednim teście — ponowne złożenie w tej samej sesji, adres z kartoteki.
  const [st2, odp2] = await zapytaj('POST', '/api/psa/portal/oswiadczenia', { spolka_id: S.spolkaId, rodzaj: 'zgoda_email', zlozone: true }, S.portal);
  assert.equal(st2, 201, JSON.stringify(odp2));
  assert.equal(stanOswiadczen(db(), S.zofia).zgodaEmail, true);
  const [, ekran] = await zapytaj('GET', '/api/psa/portal/oswiadczenia', undefined, S.portal);
  assert.equal(ekran.zgoda_email.status, 'potwierdzona');
  assert.equal(ekran.stan.powiadomieniaAutomatyczne, true);
});

test('przegląd #1: portal nie zmienia adresu e-mail z rejestru — zgoda tylko na adres z kartoteki', async () => {
  const przed = db().prepare('SELECT email FROM psa_osoby WHERE id = ?').get(S.zofia).email;
  const [st, odp] = await zapytaj('POST', '/api/psa/portal/oswiadczenia', { spolka_id: S.spolkaId, rodzaj: 'zgoda_email', zlozone: true, email: 'inny-adres@example.pl' }, S.portal);
  assert.equal(st, 400, JSON.stringify(odp));
  assert.match(odp.blad, /zmian/i);
  assert.equal(db().prepare('SELECT email FROM psa_osoby WHERE id = ?').get(S.zofia).email, przed, 'adres w kartotece bez zmian');
});

test('przegląd #2: jedna reguła zgody — informacja z rejestru, stan i znacznik zgodne', async () => {
  const { emailDoRejestru } = require('../server/logika/informacja-dokument');
  const flagaBezStatusu = { email: 'x@example.pl', zgoda_email: 1, zgoda_email_status: 'zadeklarowana' };
  assert.equal(emailDoRejestru(flagaBezStatusu), null, 'sama flaga bez potwierdzonego statusu — bez adresu w informacji');
  assert.equal(wymagaListu(flagaBezStatusu), true);
  // Kancelaria zaznacza dawną flagę `zgoda_email` → status i historia (jedno źródło stanu).
  const osobaId = Number(db().prepare(
    `INSERT INTO psa_osoby (typ, imie, nazwisko, data_urodzenia, kod_pocztowy, miejscowosc, ulica, nr_domu, email, zgoda_email_status, aml_status, utworzono)
     VALUES ('fizyczna', 'Flaga', 'Testowa', '1980-01-01', '80-001', 'Gdańsk', 'Rejestrowa', '9', 'flaga@example.pl', 'brak', 'wykonane', ?)`
  ).run(czas.terazIso()).lastInsertRowid);
  const hash = await hasla.hashuj('HasloTestowe123');
  db().prepare(`INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono) VALUES ('B', 'b-k5@example.pl', ?, 'admin', 1, ?)`).run(hash, czas.terazIso());
  const l = await fetch(`${ADRES}/api/psa/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'b-k5@example.pl', haslo: 'HasloTestowe123' }) });
  const [st] = await zapytaj('PUT', `/api/psa/osoby/${osobaId}`, { zgoda_email: 1 }, ciastko(l));
  assert.equal(st, 200);
  assert.equal(db().prepare('SELECT zgoda_email_status FROM psa_osoby WHERE id = ?').get(osobaId).zgoda_email_status, 'potwierdzona');
  assert.equal(stanOswiadczen(db(), osobaId).zgodaEmail, true);
  assert.equal(liczba("SELECT COUNT(*) AS n FROM psa_oswiadczenia WHERE osoba_id = ? AND zrodlo = 'kancelaria'", osobaId), 1);
  // Drobne R4: oświadczenie nadesłane pismem — kancelaria wybiera źródło „pismo”.
  await zapytaj('PUT', `/api/psa/osoby/${osobaId}`, { zgoda_email_status: 'brak' }, ciastko(l));
  const [st2] = await zapytaj('PUT', `/api/psa/osoby/${osobaId}`, { zgoda_email_status: 'potwierdzona', zrodlo_oswiadczenia: 'pismo' }, ciastko(l));
  assert.equal(st2, 200);
  assert.equal(liczba("SELECT COUNT(*) AS n FROM psa_oswiadczenia WHERE osoba_id = ? AND zrodlo = 'pismo' AND zlozone = 1", osobaId), 1);
});

test('przegląd #9: status zgody innych osób nie trafia do akcjonariusza; spółka go dostaje (adres e-mail w informacji)', () => {
  const { zamaskujOsobe } = require('../server/logika/maskowanie');
  const przepisy = require('../server/logika/przepisy');
  const osoba = { id: 99, typ: 'fizyczna', imie: 'A', nazwisko: 'B', email: 'a@example.pl', zgoda_email: 1, zgoda_email_status: 'potwierdzona' };
  const dlaAkcjonariusza = zamaskujOsobe(osoba, przepisy.ROLE_ODBIORCY.AKCJONARIUSZ, 1);
  assert.ok(!('zgoda_email_status' in dlaAkcjonariusza) || dlaAkcjonariusza.zgoda_email_status === undefined);
  assert.ok(!('zgoda_email' in dlaAkcjonariusza) || dlaAkcjonariusza.zgoda_email === undefined);
  assert.equal(zamaskujOsobe(osoba, przepisy.ROLE_ODBIORCY.SPOLKA).zgoda_email_status, 'potwierdzona');
});

test('D-092 pkt 6: dawne sprawy o zgodę — oświadczenie stosowane w kartotece, sprawa anulowana (migracja 69)', () => {
  const { MIGRACJE } = require('../server/migracje');
  const m69 = MIGRACJE.find((m) => m.wersja === 69);
  assert.ok(m69, 'migracja 69 istnieje');
  const teraz = czas.terazIso();
  const osobaId = Number(db().prepare(
    `INSERT INTO psa_osoby (typ, imie, nazwisko, data_urodzenia, kod_pocztowy, miejscowosc, ulica, nr_domu, email, zgoda_email_status, zgoda_email, aml_status, utworzono)
     VALUES ('fizyczna', 'Dawna', 'Sprawa', '1980-01-01', '80-001', 'Gdańsk', 'Rejestrowa', '3', 'dawna@example.pl', 'potwierdzona', 1, 'wykonane', ?)`
  ).run(teraz).lastInsertRowid);
  const sprawaId = Number(db().prepare(
    `INSERT INTO psa_sprawy (spolka_id, typ_zdarzenia, stan, zrodlo, zadajacy_osoba_id, data_wplywu, autor, utworzono, zaktualizowano)
     VALUES (?, 'zmiana_danych_akcjonariusza', 'weryfikacja', 'portal', ?, ?, 'Portal', ?, ?)`
  ).run(S.spolkaId, osobaId, teraz.slice(0, 10), teraz, teraz).lastInsertRowid);
  db().prepare(`INSERT INTO psa_oswiadczenia (osoba_id, spolka_id, rodzaj, zlozone, sprawa_id, utworzono) VALUES (?, ?, 'zgoda_email', 0, ?, ?)`)
    .run(osobaId, S.spolkaId, sprawaId, teraz);
  db().exec(m69.sql);
  const osoba = db().prepare('SELECT zgoda_email_status, zgoda_email FROM psa_osoby WHERE id = ?').get(osobaId);
  assert.equal(osoba.zgoda_email_status, 'brak');
  assert.equal(osoba.zgoda_email, 0);
  const sprawa = db().prepare('SELECT stan, notatka FROM psa_sprawy WHERE id = ?').get(sprawaId);
  assert.equal(sprawa.stan, 'anulowana');
  assert.match(sprawa.notatka, /D-092/);
});

test('R4 drobne: oświadczenie z nieznaną spółką → 404 (nie 500); sprawy w kartotece z nazwą typu', async () => {
  const [st, odp] = await zapytaj('POST', '/api/psa/portal/oswiadczenia', { spolka_id: 999999, rodzaj: 'powiadomienia_automatyczne', zlozone: true }, S.portal);
  assert.equal(st, 404, JSON.stringify(odp)); // strażnik dostępu do spółki z treści żądania — nie 500
  const hash = await hasla.hashuj('HasloTestowe123');
  db().prepare(`INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono) VALUES ('C', 'c-k5@example.pl', ?, 'admin', 1, ?)`).run(hash, czas.terazIso());
  const l = await fetch(`${ADRES}/api/psa/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'c-k5@example.pl', haslo: 'HasloTestowe123' }) });
  const teraz = czas.terazIso();
  db().prepare(`INSERT INTO psa_sprawy (spolka_id, typ_zdarzenia, stan, zrodlo, zadajacy_osoba_id, data_wplywu, autor, utworzono, zaktualizowano)
    VALUES (?, 'przeniesienie', 'weryfikacja', 'papier', ?, ?, 'Test', ?, ?)`).run(S.spolkaId, S.zofia, teraz.slice(0, 10), teraz, teraz);
  const [, sprawy] = await zapytaj('GET', `/api/psa/osoby/${S.zofia}/sprawy`, undefined, ciastko(l));
  assert.ok(sprawy.sprawy.some((x) => x.typ_nazwa === 'Przeniesienie akcji'), JSON.stringify(sprawy.sprawy[0]));
});
