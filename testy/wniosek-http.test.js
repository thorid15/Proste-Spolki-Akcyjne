'use strict';

/**
 * Etap 3C: wniosek klienta o prowadzenie rejestru - dane spolki i reprezentanta.
 *   - `GET/PUT /api/psa/portal/wniosek` — wlasny wniosek konta 'wnioskodawca'.
 *   - `GET /api/psa/portal/wniosek/z-krs/:numer` — import z KRS, jak w kreatorze.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-wniosek-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.PORTAL_WLACZONY = 'true';

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');

let serwer;
let baza;
let ciastkoPracownik;

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

async function zapytaj(metoda, sciezka, cialo, ciastko) {
  const opcje = { method: metoda, headers: {} };
  if (ciastko) opcje.headers.Cookie = ciastko;
  if (cialo !== undefined) {
    opcje.headers['Content-Type'] = 'application/json';
    opcje.body = JSON.stringify(cialo);
  }
  const odp = await fetch(baza + sciezka, opcje);
  return [odp.status, await odp.json()];
}

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  const hash = await hasla.hashuj('HasloTestowe123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Notariusz', 'notariusz-wniosek@example.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz-wniosek@example.pl', haslo: 'HasloTestowe123' }),
  });
  ciastkoPracownik = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
});

/** Zaklada aktywne konto "wnioskodawca" WPROST w bazie (pomija limiter zgloszen). */
async function kontoWnioskodawcy(email) {
  const hash = await hasla.hashuj('HasloWnioskodawcy123');
  const wynik = db()
    .prepare(
      `INSERT INTO psa_konta (email, hash_hasla, rola, aktywne, utworzono)
       VALUES (?, ?, 'wnioskodawca', 1, ?)`
    )
    .run(email, hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, haslo: 'HasloWnioskodawcy123' }),
  });
  return { kontoId: Number(wynik.lastInsertRowid), ciastko: ciasteczkoZOdpowiedzi(odpLogin) };
}

test('GET /api/psa/portal/wniosek: wymaga sesji portalowej', async () => {
  const [status] = await zapytaj('GET', '/api/psa/portal/wniosek');
  assert.equal(status, 401);
});

test('GET /api/psa/portal/wniosek: zaklada pusty wniosek przy pierwszym uzyciu, status w_przygotowaniu', async () => {
  const { ciastko } = await kontoWnioskodawcy('nowy-wnioskodawca@example.pl');

  const [status, wynik] = await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  assert.equal(status, 200);
  assert.equal(wynik.wniosek.status, 'w_przygotowaniu');
  assert.equal(wynik.wniosek.nazwa, null);
  assert.equal(wynik.wniosek.forma_prawna, 'PROSTA SPÓŁKA AKCYJNA');

  const [, wynikPonownie] = await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  assert.equal(wynikPonownie.wniosek.id, wynik.wniosek.id, 'drugie wywolanie NIE zaklada drugiego wniosku');
});

test('PUT /api/psa/portal/wniosek: zapisuje czesciowy postep, waliduje wylacznie format', async () => {
  const { ciastko } = await kontoWnioskodawcy('edytujacy-wniosek@example.pl');

  const [stZlyKrs] = await zapytaj('PUT', '/api/psa/portal/wniosek', { krs: '123' }, ciastko);
  assert.equal(stZlyKrs, 400);

  const [stZlaData] = await zapytaj('PUT', '/api/psa/portal/wniosek', { data_zawarcia_umowy_spolki: '21.06.2024' }, ciastko);
  assert.equal(stZlaData, 400);

  const [stOk, ok] = await zapytaj(
    'PUT',
    '/api/psa/portal/wniosek',
    { nazwa: 'Testowa Spółka P.S.A.', miejscowosc: 'Gdańsk' },
    ciastko
  );
  assert.equal(stOk, 200);
  assert.equal(ok.wniosek.nazwa, 'Testowa Spółka P.S.A.');
  assert.equal(ok.wniosek.miejscowosc, 'Gdańsk');
  assert.ok(ok.wniosek.zaktualizowano);

  // Drugi zapis NIE zaciera pol z pierwszego, ktorych tu nie podano.
  const [, dalej] = await zapytaj('PUT', '/api/psa/portal/wniosek', { ulica: 'Długa' }, ciastko);
  assert.equal(dalej.wniosek.nazwa, 'Testowa Spółka P.S.A.');
  assert.equal(dalej.wniosek.ulica, 'Długa');
});

test('PUT /api/psa/portal/wniosek: odmawia edycji po zlozeniu wniosku', async () => {
  const { kontoId, ciastko } = await kontoWnioskodawcy('zlozony-wniosek@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko); // zaloz wniosek
  db().prepare(`UPDATE psa_wnioski SET status = 'zlozony' WHERE konto_id = ?`).run(kontoId);

  const [status, wynik] = await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Zmiana po złożeniu' }, ciastko);
  assert.equal(status, 400);
  assert.match(wynik.blad, /zlozony/);
});

test('GET /api/psa/portal/wniosek: inne role (spolka/akcjonariusz) nie maja dostepu', async () => {
  const osobaId = db()
    .prepare(`INSERT INTO psa_osoby (typ, nazwisko, imie, aml_status, utworzono) VALUES ('fizyczna', 'Testowy', 'Jan', 'wykonane', ?)`)
    .run(new Date().toISOString()).lastInsertRowid;
  const hash = await hasla.hashuj('HasloAkcjonariusza123');
  db()
    .prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, osoba_id, aktywne, utworzono) VALUES (?, ?, 'akcjonariusz', ?, 1, ?)`)
    .run('akcjonariusz-bez-wniosku@example.pl', hash, osobaId, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'akcjonariusz-bez-wniosku@example.pl', haslo: 'HasloAkcjonariusza123' }),
  });
  const ciastko = ciasteczkoZOdpowiedzi(odpLogin);

  const [status] = await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  assert.equal(status, 403);
});

test('GET /api/psa/portal/wniosek/z-krs/:numer: zly numer nie rzuca bledu, zwraca komunikat', async () => {
  const { ciastko } = await kontoWnioskodawcy('krs-test@example.pl');
  const [status, wynik] = await zapytaj('GET', '/api/psa/portal/wniosek/z-krs/123', undefined, ciastko);
  assert.equal(status, 200);
  assert.equal(wynik.znaleziono, false);
  assert.ok(wynik.komunikat);
});

test('POST /api/psa/portal/wniosek/akcjonariusze: bez zalozonego wniosku odmawia', async () => {
  const { ciastko } = await kontoWnioskodawcy('brak-wniosku-akcjonariusz@example.pl');
  const [status] = await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { nazwisko: 'Kowalski' }, ciastko);
  assert.equal(status, 404);
});

test('POST/PUT/DELETE /api/psa/portal/wniosek/akcjonariusze: pelny cykl zycia pozycji', async () => {
  const { ciastko } = await kontoWnioskodawcy('akcjonariusz-cykl@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko); // zaloz wniosek

  const [stZlyPesel] = await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { pesel: '123' }, ciastko);
  assert.equal(stZlyPesel, 400);

  const [stDodaj, dodany] = await zapytaj(
    'POST',
    '/api/psa/portal/wniosek/akcjonariusze',
    { typ: 'fizyczna', nazwisko: 'Kowalski', imie: 'Jan', pesel: '90071500118' },
    ciastko
  );
  assert.equal(stDodaj, 201);
  assert.equal(dodany.akcjonariusz.nazwisko, 'Kowalski');
  assert.equal(dodany.akcjonariusz.zgoda_email, 0, 'zgoda domyslnie wylaczona, nigdy zaznaczona za akcjonariusza');

  const [stDrugi, drugi] = await zapytaj(
    'POST',
    '/api/psa/portal/wniosek/akcjonariusze',
    { typ: 'fizyczna', nazwisko: 'Nowak', imie: 'Anna' },
    ciastko
  );
  assert.equal(drugi.akcjonariusz.kolejnosc, dodany.akcjonariusz.kolejnosc + 1, 'kolejnosc rosnie z kazdym dodaniem');

  const [, lista] = await zapytaj('GET', '/api/psa/portal/wniosek/akcjonariusze', undefined, ciastko);
  assert.equal(lista.akcjonariusze.length, 2);

  const [stEdytuj, edytowany] = await zapytaj(
    'PUT',
    `/api/psa/portal/wniosek/akcjonariusze/${dodany.akcjonariusz.id}`,
    { email: 'jan.kowalski@example.pl', zgoda_email: true },
    ciastko
  );
  assert.equal(stEdytuj, 200);
  assert.equal(edytowany.akcjonariusz.email, 'jan.kowalski@example.pl');
  assert.equal(edytowany.akcjonariusz.zgoda_email, 1);
  assert.equal(edytowany.akcjonariusz.nazwisko, 'Kowalski', 'edycja czesciowa nie zaciera innych pol');

  const [stUsun] = await zapytaj('DELETE', `/api/psa/portal/wniosek/akcjonariusze/${drugi.akcjonariusz.id}`, undefined, ciastko);
  assert.equal(stUsun, 200);
  const [, listaPo] = await zapytaj('GET', '/api/psa/portal/wniosek/akcjonariusze', undefined, ciastko);
  assert.equal(listaPo.akcjonariusze.length, 1);
});

test('PUT/DELETE /api/psa/portal/wniosek/akcjonariusze/:id: konto nie widzi cudzych pozycji', async () => {
  const { ciastko: ciastkoA } = await kontoWnioskodawcy('wlasciciel-akcjonariusza@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastkoA);
  const [, dodany] = await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { nazwisko: 'Prywatny' }, ciastkoA);

  const { ciastko: ciastkoB } = await kontoWnioskodawcy('intruz-akcjonariusza@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastkoB);

  const [stPut] = await zapytaj('PUT', `/api/psa/portal/wniosek/akcjonariusze/${dodany.akcjonariusz.id}`, { nazwisko: 'Podmiana' }, ciastkoB);
  assert.equal(stPut, 404);
  const [stDelete] = await zapytaj('DELETE', `/api/psa/portal/wniosek/akcjonariusze/${dodany.akcjonariusz.id}`, undefined, ciastkoB);
  assert.equal(stDelete, 404);
});

test('POST /api/psa/portal/wniosek/akcjonariusze: odmawia po zlozeniu wniosku', async () => {
  const { kontoId, ciastko } = await kontoWnioskodawcy('akcjonariusz-po-zlozeniu@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  db().prepare(`UPDATE psa_wnioski SET status = 'zlozony' WHERE konto_id = ?`).run(kontoId);

  const [status] = await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { nazwisko: 'Zapozniony' }, ciastko);
  assert.equal(status, 400);
});

// ─────────────────────────────────────────────────────────────
// Etap 3E: zlozenie wniosku, projekt umowy, odeslanie podpisanej kopii
// ─────────────────────────────────────────────────────────────

test('POST /api/psa/portal/wniosek/zloz: odmawia bez nazwy spolki albo bez akcjonariuszy', async () => {
  const { ciastko } = await kontoWnioskodawcy('zlozenie-brak-danych@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);

  const [stPusty] = await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  assert.equal(stPusty, 400, 'bez nazwy spolki i bez akcjonariuszy');

  await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Wniosek Testowy P.S.A.' }, ciastko);
  const [stBezAkcjonariuszy] = await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  assert.equal(stBezAkcjonariuszy, 400, 'nazwa jest, ale zero akcjonariuszy');
});

test('POST /api/psa/portal/wniosek/zloz: generuje projekt umowy, zmienia status, plik jest pobieralny', async () => {
  const { kontoId, ciastko } = await kontoWnioskodawcy('zlozenie-pelne@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  await zapytaj('PUT', '/api/psa/portal/wniosek', {
    nazwa: 'Wniosek Pelny P.S.A.',
    reprezentant_imie_nazwisko: 'Jan Kowalski',
    reprezentant_funkcja: 'Prezes Zarządu',
  }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { nazwisko: 'Nowak', imie: 'Anna' }, ciastko);

  const [stZloz, wynikZloz] = await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  assert.equal(stZloz, 200);
  assert.equal(wynikZloz.wniosek.status, 'umowa_wygenerowana');
  assert.ok(wynikZloz.wniosek.umowa_projekt_sciezka, 'sciezka projektu umowy zapisana na wniosku');
  assert.ok(Array.isArray(wynikZloz.ostrzezenia));

  const wiersz = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(kontoId);
  assert.equal(wiersz.status, 'umowa_wygenerowana');
  assert.ok(fs.existsSync(path.join(require('../server/konfiguracja').KATALOG_DOKUMENTOW, wiersz.umowa_projekt_sciezka)));

  // Wniosek jest teraz zamkniety do edycji (status opuscil stany edytowalne).
  const [stEdycjaPoZlozeniu] = await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Zmiana' }, ciastko);
  assert.equal(stEdycjaPoZlozeniu, 400);

  const plikOdp = await fetch(`${baza}/api/psa/portal/wniosek/umowa-projekt`, { headers: { Cookie: ciastko } });
  assert.equal(plikOdp.status, 200);
  assert.equal(
    plikOdp.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  const bajty = await plikOdp.arrayBuffer();
  assert.ok(bajty.byteLength > 0, 'wygenerowany projekt umowy nie jest pusty');
});

test('GET /api/psa/portal/wniosek/umowa-projekt: 404 przed zlozeniem wniosku', async () => {
  const { ciastko } = await kontoWnioskodawcy('projekt-przed-zlozeniem@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  const odp = await fetch(`${baza}/api/psa/portal/wniosek/umowa-projekt`, { headers: { Cookie: ciastko } });
  assert.equal(odp.status, 404);
});

test('POST /api/psa/portal/wniosek/umowa-podpisana: odmawia przed wygenerowaniem projektu, przyjmuje po', async () => {
  const { kontoId, ciastko } = await kontoWnioskodawcy('umowa-podpisana@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);

  const formularzZaWczesnie = new FormData();
  formularzZaWczesnie.append('plik', new Blob(['tresc testowa'], { type: 'application/pdf' }), 'umowa.pdf');
  const zaWczesnie = await fetch(`${baza}/api/psa/portal/wniosek/umowa-podpisana`, {
    method: 'POST', headers: { Cookie: ciastko }, body: formularzZaWczesnie,
  });
  assert.equal(zaWczesnie.status, 400, 'jeszcze nie ma czego podpisywac');

  await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Wniosek Do Podpisu P.S.A.' }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { nazwisko: 'Zielinski' }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);

  const zlaKoncowka = new FormData();
  zlaKoncowka.append('plik', new Blob(['echo'], { type: 'application/x-sh' }), 'skrypt.sh');
  const odpZlaKoncowka = await fetch(`${baza}/api/psa/portal/wniosek/umowa-podpisana`, {
    method: 'POST', headers: { Cookie: ciastko }, body: zlaKoncowka,
  });
  assert.equal(odpZlaKoncowka.status, 400, 'niedozwolone rozszerzenie pliku');

  const formularz = new FormData();
  formularz.append('plik', new Blob(['podpisana tresc'], { type: 'application/pdf' }), 'podpisana-umowa.pdf');
  const odp = await fetch(`${baza}/api/psa/portal/wniosek/umowa-podpisana`, {
    method: 'POST', headers: { Cookie: ciastko }, body: formularz,
  });
  assert.equal(odp.status, 201);
  const dane = await odp.json();
  assert.equal(dane.wniosek.status, 'umowa_podpisana');

  const wiersz = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(kontoId);
  assert.equal(wiersz.umowa_podpisana_nazwa_pliku, 'podpisana-umowa.pdf');

  const pobrana = await fetch(`${baza}/api/psa/portal/wniosek/umowa-podpisana`, { headers: { Cookie: ciastko } });
  assert.equal(pobrana.status, 200);
  assert.equal(pobrana.headers.get('content-type'), 'application/pdf');
});
