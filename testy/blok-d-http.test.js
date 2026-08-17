'use strict';

/**
 * Blok D sesji 8 — decyzje "tanie teraz, drogie po zbudowaniu portalu":
 *
 * D3 — izolacja miedzy klientami portalu, DOMYSLNIE ODMAWIAJACA. Dwa testy:
 *   (a) manifest tras portalu — jesli ktos DOPISZE trase, test sie wywraca
 *       i zmusza do swiadomej decyzji, czy nowa trasa niesie identyfikator
 *       spolki (a wiec jest juz chroniona automatycznie) czy nie;
 *   (b) kazda trasa niosaca identyfikator spolki odrzuca cudzy identyfikator.
 *
 * D4 — dziennik dostepu (WASKI zakres): informacja z rejestru, raport dla
 * sadu, eksport CSV, pobranie pliku zostawiaja slad w psa_dziennik_dostepu.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-blok-d.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-blok-d-dokumenty');
process.env.PORTAL_WLACZONY = 'true';

const app = require('../serwer');
const portalRouter = require('../server/trasy/portal');
const { db } = require('../server/baza');
const rejestr = require('../server/rejestr');
const hasla = require('../server/logika/hasla');
const czas = require('../server/pomocnicze/czas');

let serwer;
let baza;

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

async function zapytajJako(ciastko, metoda, sciezka, cialo) {
  const opcje = { method: metoda, headers: { Cookie: ciastko } };
  if (cialo !== undefined) {
    opcje.headers['Content-Type'] = 'application/json';
    opcje.body = JSON.stringify(cialo);
  }
  const odp = await fetch(baza + sciezka, opcje);
  const typ = odp.headers.get('content-type') || '';
  return [odp.status, typ.includes('json') ? await odp.json() : await odp.arrayBuffer()];
}

let ciastkoPracownik;
async function zapytaj(metoda, sciezka, cialo) {
  return zapytajJako(ciastkoPracownik, metoda, sciezka, cialo);
}

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  const hash = await hasla.hashuj('HasloTestowe123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Notariusz', 'notariusz-blokd@example.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz-blokd@example.pl', haslo: 'HasloTestowe123' }),
  });
  ciastkoPracownik = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────
// D3 — manifest tras portalu (patrz naglowek pliku)
// ─────────────────────────────────────────────────────────────

test('D3: manifest tras portalu — nowa trasa musi byc tu swiadomie dopisana', () => {
  const trasy = portalRouter.stack
    .filter((warstwa) => warstwa.route)
    .map((warstwa) => `${Object.keys(warstwa.route.methods)[0].toUpperCase()} ${warstwa.route.path}`)
    .sort();

  const oczekiwane = [
    'GET /moje',
    'GET /rejestr/:spolkaId',
    'GET /whoami',
    'GET /zadania',
    'POST /informacja',
    'POST /login',
    'POST /logout',
    // Etap 3A: publiczny formularz zgloszenia wstepnego, PRZED bramka
    // `wymagajKonta` (linia z komentarzem w portal.js) - swiadomie bez
    // identyfikatora spolki, bo w tym momencie zadna spolka jeszcze nie
    // istnieje w systemie. Nie niesie `spolka_id` ani `:spolkaId`, wiec
    // D3 (izolacja miedzy klientami) go nie dotyczy.
    'POST /zgloszenia',
    // Etap 3B: aktywacja konta zaproszonego przez kancelarie - rowniez
    // PRZED bramka `wymagajKonta` (konto jeszcze nieaktywne w tym momencie,
    // wiec sesji portalowej po prostu jeszcze nie ma). Parametr sciezki to
    // `:token`, nie `:spolkaId` - D3 go nie dotyczy z tego samego powodu.
    'GET /aktywacja/:token',
    'POST /aktywacja/:token',
    // Etap 3B.1: potwierdzenie klauzuli RODO - dziala na WLASNYM koncie
    // (zad.konto.id z sesji), zadnego cudzego identyfikatora nie przyjmuje.
    'POST /rodo',
    // Etap 3C: wniosek o prowadzenie rejestru - dziala na WLASNYM wniosku
    // (znaleziony przez konto_id z sesji), zaden z tych URL-i nie przyjmuje
    // cudzego identyfikatora spolki - spolka w tym momencie jeszcze nie
    // istnieje w systemie.
    'GET /wniosek',
    'PUT /wniosek',
    'GET /wniosek/z-krs/:numer',
    // Etap 3D: akcjonariusze proponowani we wniosku - dostep przez konto_id
    // z sesji (posrednio, jak `wczytajSpraweDlaKonta`), zaden identyfikator
    // spolki nie wystepuje - spolka jeszcze nie istnieje.
    'GET /wniosek/akcjonariusze',
    'POST /wniosek/akcjonariusze',
    'PUT /wniosek/akcjonariusze/:id',
    'DELETE /wniosek/akcjonariusze/:id',
    'POST /zadania',
    'POST /zadania/:id/dokumenty',
  ].sort();

  assert.deepEqual(
    trasy,
    oczekiwane,
    'Lista tras portalu sie zmienila. Jesli dopisales trase z `:spolkaId` w sciezce ' +
      'albo `spolka_id` w ciele — jest juz chroniona automatycznie (server/trasy/portal.js: ' +
      '`router.param(\'spolkaId\', ...)` / `wymagajDostepuDoSpolkiWCiele`). Jesli trasa dociera ' +
      'do spolki POSREDNIO (np. przez sprawa_id) - uzyj `wczytajSpraweDlaKonta`, nie golego `db()`. ' +
      'Zaktualizuj liste `oczekiwane` powyzej, zeby potwierdzic, ze to swiadoma decyzja.'
  );
});

// ─────────────────────────────────────────────────────────────
// D3 — kazda trasa z identyfikatorem spolki odrzuca cudzy
// ─────────────────────────────────────────────────────────────

async function przygotujDwieSpolki() {
  const spolkaAId = db()
    .prepare(`INSERT INTO psa_spolki (nazwa, forma_prawna, status, utworzono) VALUES (?, 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', ?)`)
    .run('Spółka A P.S.A.', czas.terazIso()).lastInsertRowid;
  const spolkaBId = db()
    .prepare(`INSERT INTO psa_spolki (nazwa, forma_prawna, status, utworzono) VALUES (?, 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', ?)`)
    .run('Spółka B P.S.A.', czas.terazIso()).lastInsertRowid;

  const osobaAId = db()
    .prepare(`INSERT INTO psa_osoby (typ, nazwisko, imie, aml_status, utworzono) VALUES ('fizyczna', 'Akcjonariusz', 'A', 'wykonane', ?)`)
    .run(czas.terazIso()).lastInsertRowid;

  const emisja = rejestr.dokonajWpisu(db(), {
    spolkaId: Number(spolkaAId), typ: 'emisja', data_zdarzenia: '2026-01-10',
    wejscie: { seria: 'A', ilosc: 100, data_wpisu_krs: '2026-01-10' }, autor: 'Test',
  });
  rejestr.dokonajWpisu(db(), {
    spolkaId: Number(spolkaAId), typ: 'objecie', data_zdarzenia: '2026-01-10',
    wejscie: { emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: Number(osobaAId), ilosc: 100 }] }, autor: 'Test',
  });

  const hashA = await hasla.hashuj('HasloTestowe123');
  const kontoAId = db()
    .prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, osoba_id, aktywne, utworzono) VALUES (?, ?, 'akcjonariusz', ?, 1, ?)`)
    .run(`akcjonariusz-a-${Date.now()}@example.pl`, hashA, Number(osobaAId), czas.terazIso()).lastInsertRowid;
  const emailA = db().prepare('SELECT email FROM psa_konta WHERE id = ?').get(kontoAId).email;

  const odpLogin = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailA, haslo: 'HasloTestowe123' }),
  });
  const ciastkoA = ciasteczkoZOdpowiedzi(odpLogin);

  return { spolkaAId: Number(spolkaAId), spolkaBId: Number(spolkaBId), ciastkoA };
}

test('D3: :spolkaId w sciezce (GET /rejestr) odrzuca cudza spolke — 404', async () => {
  const { spolkaBId, ciastkoA } = await przygotujDwieSpolki();
  const [status] = await zapytajJako(ciastkoA, 'GET', `/api/psa/portal/rejestr/${spolkaBId}`);
  assert.equal(status, 404);
});

test('D3: spolka_id w ciele (POST /zadania) odrzuca cudza spolke — 404, nie 400', async () => {
  const { spolkaBId, ciastkoA } = await przygotujDwieSpolki();
  const [status] = await zapytajJako(ciastkoA, 'POST', '/api/psa/portal/zadania', {
    spolka_id: spolkaBId, typ_zdarzenia: 'przeniesienie', opis: 'proba dostepu do cudzej spolki',
  });
  assert.equal(status, 404);
});

test('D3: spolka_id w ciele (POST /informacja) odrzuca cudza spolke — 404', async () => {
  const { spolkaBId, ciastkoA } = await przygotujDwieSpolki();
  const [status] = await zapytajJako(ciastkoA, 'POST', '/api/psa/portal/informacja', { spolka_id: spolkaBId });
  assert.equal(status, 404);
});

test('D3: wlasna spolka nadal dziala normalnie (bramka nie blokuje wlasciciela)', async () => {
  const { spolkaAId, ciastkoA } = await przygotujDwieSpolki();
  const [status] = await zapytajJako(ciastkoA, 'GET', `/api/psa/portal/rejestr/${spolkaAId}`);
  assert.equal(status, 200);
});

// ─────────────────────────────────────────────────────────────
// D4 — dziennik dostepu, zakres WASKI
// ─────────────────────────────────────────────────────────────

function ostatniWpisDziennika() {
  return db().prepare('SELECT * FROM psa_dziennik_dostepu ORDER BY id DESC LIMIT 1').get();
}

test('D4: informacja z rejestru (portal) zostawia slad w dzienniku', async () => {
  const { spolkaAId, ciastkoA } = await przygotujDwieSpolki();
  const [status] = await zapytajJako(ciastkoA, 'POST', '/api/psa/portal/informacja', { spolka_id: spolkaAId });
  assert.equal(status, 200);
  const wpis = ostatniWpisDziennika();
  assert.equal(wpis.typ_kto, 'portal');
  assert.equal(wpis.spolka_id, spolkaAId);
  assert.equal(wpis.akcja, 'informacja_z_rejestru');
});

test('D4: eksport CSV stanu spolki (kancelaria) zostawia slad w dzienniku', async () => {
  const spolkaId = db()
    .prepare(`INSERT INTO psa_spolki (nazwa, forma_prawna, status, utworzono) VALUES (?, 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', ?)`)
    .run('Eksport CSV P.S.A.', czas.terazIso()).lastInsertRowid;
  const [status] = await zapytaj('GET', `/api/psa/spolki/${Number(spolkaId)}/stan.csv`);
  assert.equal(status, 200);
  const wpis = ostatniWpisDziennika();
  assert.equal(wpis.typ_kto, 'pracownik');
  assert.equal(wpis.spolka_id, Number(spolkaId));
  assert.equal(wpis.akcja, 'eksport');
});

test('D4: raport dla sadu (wykaz akcjonariuszy) zostawia slad w dzienniku', async () => {
  const spolkaId = db()
    .prepare(`INSERT INTO psa_spolki (nazwa, forma_prawna, status, utworzono) VALUES (?, 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', ?)`)
    .run('Raport Sad P.S.A.', czas.terazIso()).lastInsertRowid;
  const [status] = await zapytaj('POST', '/api/psa/sad/zapytania', { spolka_id: Number(spolkaId) });
  // 501, jesli nowelizacja jeszcze nie obowiazuje w dniu testu - i tak nie zapisuje sladu.
  if (status === 501) return;
  assert.equal(status, 200);
  const wpis = ostatniWpisDziennika();
  assert.equal(wpis.akcja, 'raport_sad');
  assert.equal(wpis.spolka_id, Number(spolkaId));
});

test('D4: pobranie pliku wystawionego dokumentu (kancelaria) zostawia slad w dzienniku', async () => {
  const spolkaId = db()
    .prepare(`INSERT INTO psa_spolki (nazwa, forma_prawna, status, utworzono) VALUES (?, 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', ?)`)
    .run('Pobranie Pliku P.S.A.', czas.terazIso()).lastInsertRowid;
  const [, wystaw] = await zapytaj('POST', `/api/psa/spolki/${Number(spolkaId)}/dokumenty/02`);
  const [status] = await zapytaj('GET', `/api/psa/spolki/${Number(spolkaId)}/wydane/${wystaw.id}/plik`);
  assert.equal(status, 200);
  const wpis = ostatniWpisDziennika();
  assert.equal(wpis.akcja, 'pobranie_pliku');
  assert.equal(wpis.spolka_id, Number(spolkaId));
});
