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
  // Komplet dokumentow przygotowuje KANCELARIA po sprawdzeniu wniosku —
  // zaproszenie nie obiecuje juz, ze system wygeneruje projekt umowy.
  assert.match(html, /kancelaria sprawdzi wniosek/i);
  assert.match(html, /powiadomimy e-mailem/i);
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

test('POST /api/psa/portal/zgloszenia: publiczne, bez sesji, wymaga poprawnego e-maila i numeru KRS', async () => {
  const [stBrak] = await zapytaj('POST', '/api/psa/portal/zgloszenia', { opis: 'Chcę przenieść rejestr' }, null);
  assert.equal(stBrak, 400);

  // Rejestr akcjonariuszy prowadzi sie dla spolki JUZ wpisanej do rejestru
  // przedsiebiorcow - numer KRS odsiewa zgloszenia spolek w organizacji.
  const [stBezKrs, odpBezKrs] = await zapytaj(
    'POST',
    '/api/psa/portal/zgloszenia',
    { email: 'bez-krs@example.pl', krs: '12345' },
    null
  );
  assert.equal(stBezKrs, 400);
  assert.match(odpBezKrs.blad, /KRS/);

  const [stOk, ok] = await zapytaj(
    'POST',
    '/api/psa/portal/zgloszenia',
    {
      email: 'Prospect@Example.pl',
      krs: '0000123456',
      nazwa_spolki: 'Nowa Nadzieja P.S.A.',
      opis: 'Zakładamy PSA, szukamy podmiotu prowadzącego rejestr.',
    },
    null
  );
  assert.equal(stOk, 201);
  assert.equal(ok.ok, true);

  const [, lista] = await zapytaj('GET', '/api/psa/zgloszenia');
  const wpis = lista.zgloszenia.find((z) => z.nazwa_spolki === 'Nowa Nadzieja P.S.A.');
  assert.ok(wpis, 'zgloszenie trafilo do kolejki kancelarii');
  assert.equal(wpis.email, 'prospect@example.pl', 'e-mail znormalizowany do malych liter');
  assert.equal(wpis.krs, '0000123456');
  // Zaproszenie idzie od razu przy zgloszeniu, wiec status jest juz „zaproszono".
  assert.equal(wpis.status, 'zaproszono');
});

/**
 * Zaproszenie idzie OD RAZU przy zgloszeniu: na tym etapie kancelaria niczego
 * jeszcze nie sprawdza (sprawdza dopiero wniosek), wiec czekanie na klikniecie
 * pracownika tylko odsuwalo klienta od formularza. Zgloszenie zaklada zatem
 * konto — ale nadal ZADNEJ spolki, bo ta powstaje dopiero z przyjetego wniosku.
 */
test('POST /api/psa/portal/zgloszenia: zaklada konto i wysyla zaproszenie, ale zadnej spolki', async () => {
  const przedSpolki = db().prepare('SELECT COUNT(*) AS n FROM psa_spolki').get().n;

  const [status, wynik] = await zapytaj(
    'POST', '/api/psa/portal/zgloszenia', { email: 'lead-bez-konta@example.pl', krs: '0000999888' }, null
  );
  assert.equal(status, 201);
  // SMTP nie jest skonfigurowane w testach — wysylka sie nie udaje, wiec link
  // wraca w odpowiedzi, zeby zaproszenie nie przepadlo.
  assert.equal(wynik.zaproszenie_wyslane, false);
  assert.ok(wynik.link_aktywacyjny, 'link aktywacyjny wraca, gdy poczta nie dziala');

  const konto = db().prepare('SELECT * FROM psa_konta WHERE email = ?').get('lead-bez-konta@example.pl');
  assert.ok(konto, 'konto wnioskodawcy powstalo od razu');
  assert.equal(konto.rola, 'wnioskodawca');
  assert.equal(konto.aktywne, 0);
  assert.ok(konto.token_aktywacji);

  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM psa_spolki').get().n, przedSpolki);
});

/**
 * Jeden klient, jeden adres e-mail, KILKA spolek. Duplikat rozpoznajemy po
 * numerze KRS, nie po adresie — wczesniej drugie zgloszenie tej samej osoby
 * konczylo sie komunikatem „konto juz istnieje, zaproszenie jest zbedne".
 */
test('POST /api/psa/portal/zgloszenia: druga spolka tego samego klienta przechodzi, konto zostaje jedno', async () => {
  const [st1] = await zapytaj('POST', '/api/psa/portal/zgloszenia', { email: 'dwie-spolki@example.pl', krs: '0000111222' }, null);
  assert.equal(st1, 201);
  const [st2] = await zapytaj('POST', '/api/psa/portal/zgloszenia', { email: 'dwie-spolki@example.pl', krs: '0000333444' }, null);
  assert.equal(st2, 201, 'drugie zgloszenie tego samego klienta o INNA spolke przechodzi');

  const konta = db().prepare('SELECT COUNT(*) AS n FROM psa_konta WHERE email = ?').get('dwie-spolki@example.pl').n;
  assert.equal(konta, 1, 'jeden adres e-mail to jedno konto');

  const zgloszenia = db().prepare('SELECT COUNT(*) AS n FROM psa_zgloszenia WHERE email = ?').get('dwie-spolki@example.pl').n;
  assert.equal(zgloszenia, 2, 'oba zgloszenia zostaja w kolejce kancelarii');

  // Ten sam numer KRS drugi raz to juz pomylka albo duplikat.
  const [stDuplikat, duplikat] = await zapytaj(
    'POST', '/api/psa/portal/zgloszenia', { email: 'ktos-inny@example.pl', krs: '0000111222' }, null
  );
  assert.equal(stDuplikat, 400);
  assert.match(duplikat.blad, /już w toku|już prowadzony/);
});

/**
 * Z-004: pre-check w trasie robil SELECT przed INSERT - dwa rownoczesne
 * zgloszenia dla tego samego KRS mogly oba minac SELECT, zanim ktorykolwiek
 * INSERT sie wykonal (TOCTOU). Migracja 48 dodaje indeks unikalny na
 * poziomie bazy, wiec test wprost na `db()` (bez przechodzenia przez trase,
 * gdzie prawdziwy wyscig watkow jest w SQLite niepraktyczny do wywolania)
 * jest najbardziej bezposrednim sprawdzeniem mechanizmu, ktory naprawde
 * zamyka luke.
 */
test('psa_zgloszenia: indeks unikalny blokuje dwa aktywne zgloszenia z tym samym KRS (Z-004)', () => {
  db().prepare(`INSERT INTO psa_zgloszenia (email, krs, status, utworzono) VALUES (?, ?, 'nowe', ?)`)
    .run('wyscig-a@example.pl', '0000555666', new Date().toISOString());

  assert.throws(
    () => db().prepare(`INSERT INTO psa_zgloszenia (email, krs, status, utworzono) VALUES (?, ?, 'nowe', ?)`)
      .run('wyscig-b@example.pl', '0000555666', new Date().toISOString()),
    /UNIQUE/
  );

  // Po odrzuceniu KRS jest znowu wolny - kolejne zgloszenie nie koliduje.
  db().prepare(`UPDATE psa_zgloszenia SET status = 'odrzucone' WHERE email = 'wyscig-a@example.pl'`).run();
  assert.doesNotThrow(
    () => db().prepare(`INSERT INTO psa_zgloszenia (email, krs, status, utworzono) VALUES (?, ?, 'nowe', ?)`)
      .run('wyscig-c@example.pl', '0000555666', new Date().toISOString())
  );
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

  // Zaproszenie idzie samo przy zgloszeniu, wiec ta trasa sluzy dzis do
  // WYSLANIA PONOWNIE — np. gdy klientowi przepadl e-mail albo token wygasl.
  const [stPonownie] = await zapytaj('POST', `/api/psa/zgloszenia/${id}/zapros`, {});
  assert.equal(stPonownie, 200, 'zaproszenie mozna wyslac ponownie');
});

test('POST /api/psa/zgloszenia/:id/zapros: istniejace konto dostaje nowy token, nie drugie konto', async () => {
  const id1 = wstawZgloszenie('juz-ma-konto@example.pl');
  const [, pierwsze] = await zapytaj('POST', `/api/psa/zgloszenia/${id1}/zapros`, {});
  const tokenPierwszy = db().prepare('SELECT token_aktywacji AS t FROM psa_konta WHERE id = ?').get(pierwsze.konto_id).t;

  const id2 = wstawZgloszenie('juz-ma-konto@example.pl');
  const [status, wynik] = await zapytaj('POST', `/api/psa/zgloszenia/${id2}/zapros`, {});
  assert.equal(status, 200, 'jeden klient moze miec kilka spolek');
  assert.equal(wynik.konto_id, pierwsze.konto_id, 'to samo konto, nie drugie');
  assert.equal(wynik.nowe_konto, false);

  const tokenDrugi = db().prepare('SELECT token_aktywacji AS t FROM psa_konta WHERE id = ?').get(pierwsze.konto_id).t;
  assert.notEqual(tokenDrugi, tokenPierwszy, 'nieaktywne konto dostaje swiezy token');

  assert.equal(
    db().prepare('SELECT COUNT(*) AS n FROM psa_konta WHERE email = ?').get('juz-ma-konto@example.pl').n,
    1
  );
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
