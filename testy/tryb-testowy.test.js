'use strict';

/**
 * Tryb testowy (T1-T6, D-074) — WLACZONY, na tymczasowej bazie oznaczonej
 * jako testowa. Odmowa startu sprawdzana w osobnych procesach `node serwer.js`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const KATALOG = path.join(__dirname, '..', 'dane', '.test-tryb-testowy');
fs.rmSync(KATALOG, { recursive: true, force: true });
fs.mkdirSync(KATALOG, { recursive: true });
const PLIK_BAZY = path.join(KATALOG, 'baza-testowa.db');

process.env.PSA_TRYB_TESTOWY = '1';
process.env.PSA_BAZA_TESTOWA = PLIK_BAZY;
process.env.PSA_KATALOG_TESTOWY = KATALOG;
delete process.env.NODE_ENV;

const konfiguracja = require('../server/konfiguracja');
const baza = require('../server/baza');
const migracje = require('../server/migracje');
const tryb = require('../server/tryb-testowy');
const czas = require('../server/pomocnicze/czas');
const przepisy = require('../server/logika/przepisy');

// Baza oznaczona PRZED zaladowaniem serwera — inaczej straznik odmowi startu.
{
  const b = baza.otworz(PLIK_BAZY);
  migracje.uruchom(b);
  tryb.oznaczBaze(b, 'test automatyczny');
  b.close();
}

const app = require('../serwer');
const { db } = baza;
const hasla = require('../server/logika/hasla');
const skrzynka = require('../server/tryb-testowy/skrzynka');
const poczta = require('../server/poczta');

let serwer;
let ADRES;

test.before(async () => {
  const hash = await hasla.hashuj(tryb.HASLO_TESTOWE);
  db().prepare(
    `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
     VALUES ('Notariusz Testowy', 'notariusz@example.com', ?, 'admin', 1, ?)`
  ).run(hash, czas.terazIso());
  serwer = app.listen(0);
  await new Promise((r) => serwer.once('listening', r));
  ADRES = `http://127.0.0.1:${serwer.address().port}`;
});

test.after(() => {
  serwer.close();
  baza.zamknij();
  czas.ustawPrzesuniecie(0);
  fs.rmSync(KATALOG, { recursive: true, force: true });
});

function uruchomSerwer(env) {
  return spawnSync(process.execPath, ['serwer.js'], {
    cwd: path.join(__dirname, '..'),
    env: { PATH: process.env.PATH, TZ: 'Europe/Warsaw', PORT: '0', ...env },
    encoding: 'utf8',
    timeout: 20000,
  });
}

test('T6: przy NODE_ENV=production tryb testowy odmawia startu z czytelnym komunikatem', () => {
  const wynik = uruchomSerwer({ PSA_TRYB_TESTOWY: '1', NODE_ENV: 'production', PSA_BAZA_TESTOWA: PLIK_BAZY });
  assert.equal(wynik.status, 1);
  assert.match(wynik.stderr, /ODMOWA STARTU.*NODE_ENV=production/);
});

test('T6: na bazie nieoznaczonej jako testowa odmowa startu, a baza nie jest ruszana', () => {
  const nietestowa = path.join(KATALOG, 'robocza.db');
  const b = baza.otworz(nietestowa);
  migracje.uruchom(b);
  const przed = b.prepare('SELECT COUNT(*) AS n FROM sqlite_master').get().n;
  b.close();

  const wynik = uruchomSerwer({ PSA_TRYB_TESTOWY: '1', PSA_BAZA_TESTOWA: nietestowa });
  assert.equal(wynik.status, 1);
  assert.match(wynik.stderr, /nie jest oznaczona jako testowa/);

  const brakujaca = path.join(KATALOG, 'nie-istnieje.db');
  const wynik2 = uruchomSerwer({ PSA_TRYB_TESTOWY: '1', PSA_BAZA_TESTOWA: brakujaca });
  assert.equal(wynik2.status, 1);
  assert.equal(fs.existsSync(brakujaca), false, 'straznik nie zaklada bazy');

  const b2 = baza.otworz(nietestowa);
  assert.equal(b2.prepare('SELECT COUNT(*) AS n FROM sqlite_master').get().n, przed);
  b2.close();
});

test('T6: tryb testowy pracuje na bazie testowej, nie na WSPOLNA_BAZA', () => {
  assert.equal(konfiguracja.WSPOLNA_BAZA, PLIK_BAZY);
  assert.equal(konfiguracja.KATALOG_DOKUMENTOW, path.join(KATALOG, 'dokumenty'));
});

test('T6: ekrany aplikacji dostają pasek i stan trybu; trasy /test istnieją', async () => {
  for (const adres of ['/', '/portal.html', '/spolki/1']) {
    const html = await (await fetch(`${ADRES}${adres}`)).text();
    assert.match(html, /<script src="\/test\/konfiguracja\.js"><\/script>/, adres);
    assert.match(html, /<script src="\/test\/pasek\.js" defer><\/script>/, adres);
  }
  assert.equal((await fetch(`${ADRES}/test/skrzynka`)).status, 200);
  const konf = await (await fetch(`${ADRES}/test/konfiguracja.js`)).text();
  assert.match(konf, /notariusz@example\.com/);
});

test('T1: poczta w trybie testowym trafia do skrzynki (.eml), status „testowa — niewysłana”', async () => {
  const wynik = await poczta.wyslij({
    do: 'ktos@example.com',
    temat: 'Próba skrzynki',
    html: '<p>Treść <a href="https://example.com/x">link</a></p>',
    zalaczniki: [{ filename: 'pismo.txt', content: Buffer.from('abc') }],
  });
  assert.equal(wynik.status, 'testowa');
  assert.equal(wynik.testowa, true);
  const w = skrzynka.lista().find((x) => x.temat === 'Próba skrzynki');
  assert.ok(w, 'wiadomość na liście');
  const eml = fs.readFileSync(skrzynka.sciezkaEml(w.id), 'utf8');
  assert.match(eml, /To: ktos@example\.com/);
  assert.match(eml, /pismo\.txt/);
  const podglad = await (await fetch(`${ADRES}/test/skrzynka/${w.id}`)).text();
  assert.match(podglad, /<a href="https:\/\/example\.com\/x">link<\/a>/);
  assert.match(podglad, /testowa — niewysłana/);
  assert.equal((await fetch(`${ADRES}/test/skrzynka/..%2F..%2Fpackage`)).status, 404);
});

test('T2: logowanie z listy kont używa zwykłego endpointu i tokenu sesji; wpis w dzienniku logowań', async () => {
  const odp = await fetch(`${ADRES}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz@example.com', haslo: tryb.HASLO_TESTOWE, droga_testowa: 'lista_kont' }),
  });
  assert.equal(odp.status, 200);
  const ciastko = odp.headers.getSetCookie().find((c) => c.startsWith('psa_sesja='));
  assert.ok(ciastko, 'ta sama sesja ciasteczkowa co przy zwykłym logowaniu');
  const kto = await (await fetch(`${ADRES}/api/psa/auth/whoami`, { headers: { Cookie: ciastko.split(';')[0] } })).json();
  assert.equal(kto.zalogowany, true);
  const wpis = db().prepare("SELECT * FROM psa_dziennik WHERE akcja = 'logowanie' ORDER BY id DESC LIMIT 1").get();
  assert.equal(wpis.kto, 'notariusz@example.com');
  assert.match(wpis.opis, /droga: lista_kont; .*tryb testowy/);
  // Bez hasła — odmowa jak zawsze: lista kont nie omija uwierzytelnienia.
  const zle = await fetch(`${ADRES}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz@example.com', haslo: 'zle-haslo', droga_testowa: 'lista_kont' }),
  });
  assert.equal(zle.status, 401);
  assert.throws(() => db().prepare('DELETE FROM psa_dziennik').run(), /append-only/);
});

test('T2: „Zaloguj (tryb testowy)” po zgłoszeniu to ten sam link i token, który poszedł e-mailem', { skip: 'Faza 4 — formularz publiczny (zgłoszenie = wniosek) przebudowywany' }, async () => {
  const odp = await fetch(`${ADRES}/api/psa/portal/zgloszenia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nowy.klient@example.com', krs: '0000990003' }),
  });
  assert.equal(odp.status, 201);
  const dane = await odp.json();
  assert.equal(dane.zaproszenie_wyslane, true);
  assert.ok(dane.link_testowy, 'link w odpowiedzi trybu testowego');
  const token = dane.link_testowy.split('#/aktywuj/')[1];
  const konto = db().prepare('SELECT * FROM psa_konta WHERE email = ?').get('nowy.klient@example.com');
  assert.equal(konto.token_aktywacji, token, 'ten sam token co w bazie');
  const mail = skrzynka.lista().find((w) => w.do === 'nowy.klient@example.com');
  assert.ok(skrzynka.wiadomosc(mail.id).html.includes(token), 'ten sam token co w e-mailu');
  // Zwykły endpoint aktywacji przyjmuje token — wygasanie i reguły haseł bez zmian.
  const akt = await fetch(`${ADRES}/api/psa/portal/aktywacja/${token}`);
  assert.equal(akt.status, 200);
});

test('T3: atrapa KRS odpowiada dla numerów testowych w kształcie API', async () => {
  const { pobierzZKrs } = require('../server/trasy/krs');
  const wynik = await pobierzZKrs('0000990001');
  assert.equal(wynik.znaleziono, true);
  assert.equal(wynik.dane.forma_prawna, 'PROSTA SPÓŁKA AKCYJNA');
});

test('T4: symulowana data działa na bramkę 2027 i nie cofa się przed ostatnie zdarzenie', () => {
  assert.equal(przepisy.nowelizacjaObowiazuje(czas.dzisIso()), czas.dzisIso() >= '2027-02-18');
  tryb.ustawDate(db(), '2027-03-01');
  assert.equal(czas.dzisIso(), '2027-03-01');
  assert.equal(przepisy.nowelizacjaObowiazuje(czas.dzisIso()), true);
  assert.equal(db().prepare('SELECT przesuniecie_ms FROM psa_baza_testowa').get().przesuniecie_ms, czas.przesuniecie());

  // Zdarzenie zapisane „w przyszłości” blokuje powrót przed jego chwilę.
  const spolkaId = require('../server/dane/spolki').dodaj(db(), {
    krs: '0000990777', nazwa: 'Spółka do testu daty', siedziba: 'Gdańsk', adres: 'ul. Testowa 1', sad_rejestrowy: 'SR Gdańsk', data_rejestracji: '2027-03-01',
  });
  const { dodajOsobe, otworz, ustawKancelarie } = require('./pomoc');
  ustawKancelarie(db());
  const osoba = dodajOsobe(db());
  otworz(db(), spolkaId, {
    serie: [{ seria: 'A', numery: '1-10', liczba: 10, data_wpisu_krs: '2027-03-01' }],
    akcjonariusze: [{ osoba_id: osoba, akcje: [{ seria: 'A', numery: '1-10', liczba: 10 }] }],
  });
  const zapisane = db().prepare('SELECT data_wpisu FROM psa_zdarzenia ORDER BY id DESC LIMIT 1').get();
  assert.equal(czas.dzienLokalny(zapisane.data_wpisu), '2027-03-01', 'znacznik nowego zdarzenia z symulowanej daty');
  assert.throws(() => tryb.ustawDate(db(), null), /wcześniejszej niż ostatnie zdarzenie/);
  assert.throws(() => tryb.ustawDate(db(), '2027-02-01'), /wcześniejszej/);
  tryb.ustawDate(db(), '2027-03-02');
  assert.equal(czas.dzisIso(), '2027-03-02');
});
