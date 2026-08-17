'use strict';

/**
 * Etap 3A/3B/3B.1: zgloszenia wstepne, zaproszenia i klauzula RODO portalu.
 *   - `POST /api/psa/portal/zgloszenia` — publiczny formularz, bez sesji.
 *   - `GET/POST /api/psa/zgloszenia/...` — kolejka po stronie kancelarii.
 *   - `POST /api/psa/zgloszenia/:id/zapros` — zaklada konto "wnioskodawca".
 *   - `GET/POST /api/psa/portal/aktywacja/:token` — aktywacja konta, publiczne.
 *   - `POST /api/psa/portal/rodo` — potwierdzenie klauzuli informacyjnej.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// UWAGA KOLEJNOSCI: zaden require dotykajacy `server/baza.js` (transytywnie,
// np. przez trasy/*.js) nie moze wystapic PRZED ustawieniem WSPOLNA_BAZA
// ponizej - `baza.js` czyta zmienna srodowiskowa raz, przy pierwszym uzyciu
// polaczenia. Stad `trescZaproszenia` importowane dopiero PO tym bloku.
const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-zgloszenia-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.PORTAL_WLACZONY = 'true';

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');
const { trescZaproszenia } = require('../server/trasy/zgloszenia');

test('trescZaproszenia: opisuje wszystkie kroki wniosku, nie tylko sam link', () => {
  const html = trescZaproszenia({ link: 'https://portal.test/aktywuj/abc', kancelariaNazwa: 'Kancelaria Testowa' });
  assert.match(html, /https:\/\/portal\.test\/aktywuj\/abc/);
  assert.match(html, /Kancelaria Testowa/);
  assert.match(html, /ustawisz hasło/);
  assert.match(html, /przetwarzaniu danych osobowych/);
  assert.match(html, /dane spółki/);
  assert.match(html, /dane akcjonariuszy/);
  assert.match(html, /projekt umowy/);
  assert.match(html, /[Pp]odpisaną umowę odeślesz/);
});

let serwer;
let baza;
let ciastkoPracownik;

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

async function zapytaj(metoda, sciezka, cialo, ciastko = ciastkoPracownik) {
  const opcje = { method: metoda, headers: {} };
  if (ciastko) opcje.headers.Cookie = ciastko;
  if (cialo !== undefined) {
    opcje.headers['Content-Type'] = 'application/json';
    opcje.body = JSON.stringify(cialo);
  }
  const odp = await fetch(baza + sciezka, opcje);
  return [odp.status, await odp.json()];
}

/**
 * Wstawia zgloszenie WPROST do bazy, z pominieciem publicznego endpointu.
 * Endpoint publiczny (`POST /api/psa/portal/zgloszenia`) ma limiter (5 prob
 * na adres IP w 15 minut) - w tym pliku testowany jest osobno (pierwsze dwa
 * testy), reszta testow potrzebuje tylko "jakiegos zgloszenia w stanie nowe"
 * i nie powinna zuzywac wspolnej puli limitera.
 */
function wstawZgloszenie(email) {
  const wynik = db()
    .prepare(`INSERT INTO psa_zgloszenia (email, status, utworzono) VALUES (?, 'nowe', ?)`)
    .run(email, new Date().toISOString());
  return Number(wynik.lastInsertRowid);
}

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  const hash = await hasla.hashuj('HasloTestowe123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Notariusz', 'notariusz-zgloszenia@example.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz-zgloszenia@example.pl', haslo: 'HasloTestowe123' }),
  });
  ciastkoPracownik = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
});

test('POST /api/psa/portal/zgloszenia: publiczne, bez sesji, wymaga poprawnego e-maila', async () => {
  const [stBrak] = await zapytaj('POST', '/api/psa/portal/zgloszenia', { opis: 'Chcę przenieść rejestr' }, null);
  assert.equal(stBrak, 400);

  const [stZle] = await zapytaj('POST', '/api/psa/portal/zgloszenia', { email: 'nie-email' }, null);
  assert.equal(stZle, 400);

  const [stOk, ok] = await zapytaj(
    'POST',
    '/api/psa/portal/zgloszenia',
    { email: 'Prospect@Example.pl', nazwa_spolki: 'Nowa Nadzieja P.S.A.', opis: 'Zakładamy PSA, szukamy podmiotu prowadzącego rejestr.' },
    null
  );
  assert.equal(stOk, 201);
  assert.equal(ok.ok, true);

  const [, lista] = await zapytaj('GET', '/api/psa/zgloszenia');
  const wpis = lista.zgloszenia.find((z) => z.nazwa_spolki === 'Nowa Nadzieja P.S.A.');
  assert.ok(wpis, 'zgloszenie trafilo do kolejki kancelarii');
  assert.equal(wpis.email, 'prospect@example.pl', 'e-mail znormalizowany do malych liter');
  assert.equal(wpis.status, 'nowe');
});

test('POST /api/psa/portal/zgloszenia: NIE zaklada zadnego konta portalowego ani spolki', async () => {
  const przedKonta = db().prepare('SELECT COUNT(*) AS n FROM psa_konta').get().n;
  const przedSpolki = db().prepare('SELECT COUNT(*) AS n FROM psa_spolki').get().n;

  await zapytaj('POST', '/api/psa/portal/zgloszenia', { email: 'lead-bez-konta@example.pl' }, null);

  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM psa_konta').get().n, przedKonta);
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM psa_spolki').get().n, przedSpolki);
});

test('GET /api/psa/zgloszenia: wymaga zalogowanego pracownika', async () => {
  const [status] = await zapytaj('GET', '/api/psa/zgloszenia', undefined, null);
  assert.equal(status, 401);
});

test('POST /api/psa/zgloszenia/:id/odrzuc: zmienia status, zapisuje autora, blokuje powtorne odrzucenie', async () => {
  const id = wstawZgloszenie('do-odrzucenia@example.pl');

  const [status, wynik] = await zapytaj('POST', `/api/psa/zgloszenia/${id}/odrzuc`, { notatka: 'Poza obszarem działania kancelarii.' });
  assert.equal(status, 200);
  assert.equal(wynik.zgloszenie.status, 'odrzucone');
  assert.equal(wynik.zgloszenie.obsluzone_przez, 'Notariusz');
  assert.ok(wynik.zgloszenie.obsluzone_kiedy);

  const [stPonownie] = await zapytaj('POST', `/api/psa/zgloszenia/${id}/odrzuc`, {});
  assert.equal(stPonownie, 400, 'nie mozna odrzucic zgloszenia drugi raz');
});

test('POST /api/psa/zgloszenia/:id/zapros: zaklada konto "wnioskodawca" nieaktywne z tokenem, zmienia status na zaproszono', async () => {
  const id = wstawZgloszenie('do-zaproszenia@example.pl');

  const [status, wynik] = await zapytaj('POST', `/api/psa/zgloszenia/${id}/zapros`, {});
  assert.equal(status, 200);
  assert.equal(wynik.ok, true);
  // SMTP nie jest skonfigurowane w testach - wysylka ma sie NIE UDAC, ale
  // konto i tak powstaje (poczta.js degraduje sie miekko, nigdy nie rzuca).
  assert.equal(wynik.email_wyslany, false);
  assert.ok(wynik.powod);

  const konto = db().prepare('SELECT * FROM psa_konta WHERE id = ?').get(wynik.konto_id);
  assert.equal(konto.email, 'do-zaproszenia@example.pl');
  assert.equal(konto.rola, 'wnioskodawca');
  assert.equal(konto.spolka_id, null);
  assert.equal(konto.osoba_id, null);
  assert.equal(konto.aktywne, 0);
  assert.equal(konto.hash_hasla, null);
  assert.ok(konto.token_aktywacji);
  assert.ok(konto.token_wygasa);

  const [, zgloszeniePo] = await zapytaj('GET', `/api/psa/zgloszenia/${id}`);
  assert.equal(zgloszeniePo.zgloszenie.status, 'zaproszono');

  const [stPonownie] = await zapytaj('POST', `/api/psa/zgloszenia/${id}/zapros`, {});
  assert.equal(stPonownie, 400, 'nie mozna zaprosic drugi raz po zmianie statusu');
});

test('POST /api/psa/zgloszenia/:id/zapros: odmawia, gdy konto z tym e-mailem juz istnieje', async () => {
  const id1 = wstawZgloszenie('juz-ma-konto@example.pl');
  await zapytaj('POST', `/api/psa/zgloszenia/${id1}/zapros`, {});

  const id2 = wstawZgloszenie('juz-ma-konto@example.pl');
  const [status, wynik] = await zapytaj('POST', `/api/psa/zgloszenia/${id2}/zapros`, {});
  assert.equal(status, 400);
  assert.match(wynik.blad, /już istnieje/);
});

test('GET/POST /api/psa/portal/aktywacja/:token: aktywuje konto, ustawia haslo, zaklada sesje portalowa', async () => {
  const id = wstawZgloszenie('aktywacja-pelna@example.pl');
  const [, zaproszenie] = await zapytaj('POST', `/api/psa/zgloszenia/${id}/zapros`, {});
  const konto = db().prepare('SELECT * FROM psa_konta WHERE id = ?').get(zaproszenie.konto_id);
  const token = konto.token_aktywacji;

  const [stZlyToken] = await zapytaj('GET', '/api/psa/portal/aktywacja/nieistniejacy-token', undefined, null);
  assert.equal(stZlyToken, 404);

  const [stSprawdz, sprawdz] = await zapytaj('GET', `/api/psa/portal/aktywacja/${token}`, undefined, null);
  assert.equal(stSprawdz, 200);
  assert.equal(sprawdz.email, 'aktywacja-pelna@example.pl');

  const [stSlabe, slabe] = await zapytaj('POST', `/api/psa/portal/aktywacja/${token}`, { haslo: 'krotkie' }, null);
  assert.equal(stSlabe, 400);
  assert.ok(slabe.blad);

  const opcje = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
  const odpAktywacji = await fetch(`${baza}/api/psa/portal/aktywacja/${token}`, {
    ...opcje,
    body: JSON.stringify({ haslo: 'BardzoSilneHaslo123' }),
  });
  assert.equal(odpAktywacji.status, 200);
  const cialoAktywacji = await odpAktywacji.json();
  assert.equal(cialoAktywacji.konto.email, 'aktywacja-pelna@example.pl');
  const ciastkoPortal = ciasteczkoZOdpowiedzi(odpAktywacji);
  assert.match(ciastkoPortal, /psa_sesja_portal=/, 'aktywacja od razu zaklada sesje portalowa');

  const kontoPo = db().prepare('SELECT * FROM psa_konta WHERE id = ?').get(zaproszenie.konto_id);
  assert.equal(kontoPo.aktywne, 1);
  assert.equal(kontoPo.token_aktywacji, null);
  assert.ok(kontoPo.hash_hasla);

  // Token juz wykorzystany - drugie uzycie linku musi zawiesc.
  const [stPonownie] = await zapytaj('GET', `/api/psa/portal/aktywacja/${token}`, undefined, null);
  assert.equal(stPonownie, 404);

  const [, whoami] = await zapytaj('GET', '/api/psa/portal/whoami', undefined, ciastkoPortal);
  assert.equal(whoami.zalogowany, true);
  assert.equal(whoami.konto.rola, 'wnioskodawca');
  assert.equal(whoami.konto.rodo_zaakceptowano, null, 'klauzula RODO jeszcze niepotwierdzona zaraz po aktywacji');

  const [stBezSesji] = await zapytaj('POST', '/api/psa/portal/rodo', {}, null);
  assert.equal(stBezSesji, 401);

  const [stRodo, rodo] = await zapytaj('POST', '/api/psa/portal/rodo', {}, ciastkoPortal);
  assert.equal(stRodo, 200);
  assert.ok(rodo.konto.rodo_zaakceptowano);

  const [, whoamiPo] = await zapytaj('GET', '/api/psa/portal/whoami', undefined, ciastkoPortal);
  assert.ok(whoamiPo.konto.rodo_zaakceptowano, 'potwierdzenie trwale zapisane, widoczne przy nastepnym whoami');
});
