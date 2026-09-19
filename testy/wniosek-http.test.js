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
const { AKCJONARIUSZ_PELNY } = require('./pomoc');

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

test('POST /api/psa/portal/wniosek/zloz: odmawia przy niepelnych danych akcjonariusza', async () => {
  const { ciastko } = await kontoWnioskodawcy('zlozenie-braki@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Wniosek z Brakami P.S.A.' }, ciastko);
  // Samo nazwisko: brak PESEL-u ALBO daty urodzenia i brak jakiegokolwiek adresu.
  const [, dodany] = await zapytaj(
    'POST', '/api/psa/portal/wniosek/akcjonariusze', { typ: 'fizyczna', nazwisko: 'Bezdanych' }, ciastko
  );

  const [stBraki, wynikBraki] = await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  assert.equal(stBraki, 400, 'kancelaria nie ma skad wziac PESEL-u — wniosek wraca do klienta');
  assert.match(wynikBraki.blad, /Dane niepełne/);
  assert.ok(
    wynikBraki.szczegoly.some((b) => /PESEL/.test(b)) && wynikBraki.szczegoly.some((b) => /adres/.test(b)),
    'odpowiedz wymienia konkretne braki'
  );
  assert.equal(
    db().prepare('SELECT status FROM psa_wnioski WHERE id = ?').get(dodany.akcjonariusz.wniosek_id).status,
    'w_przygotowaniu',
    'odmowa nie zamyka wniosku do edycji'
  );

  // Uzupelnienie tych samych pol otwiera droge do zlozenia.
  await zapytaj(
    'PUT', `/api/psa/portal/wniosek/akcjonariusze/${dodany.akcjonariusz.id}`,
    { ...AKCJONARIUSZ_PELNY, nazwisko: 'Bezdanych' }, ciastko
  );
  const [stPo] = await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  assert.equal(stPo, 200);
});

test('Z-006/P-004: POST /api/psa/portal/wniosek/zloz odmawia bez e-maila akcjonariusza, niezaleznie od zgody na e-mail w rejestrze', async () => {
  const { ciastko } = await kontoWnioskodawcy('zlozenie-bez-emaila@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Wniosek Bez Emaila P.S.A.' }, ciastko);
  const { email, ...bezEmaila } = AKCJONARIUSZ_PELNY;
  const [, dodany] = await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', bezEmaila, ciastko);

  const [status, wynik] = await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  assert.equal(status, 400);
  assert.ok(
    wynik.szczegoly.some((b) => /brak adresu e-mail/.test(b)),
    `oczekiwano braku e-maila w szczegolach, dostano: ${JSON.stringify(wynik.szczegoly)}`
  );

  await zapytaj(
    'PUT', `/api/psa/portal/wniosek/akcjonariusze/${dodany.akcjonariusz.id}`,
    { email: 'anna.bezemaila@example-test.pl' }, ciastko
  );
  const [stPo] = await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  assert.equal(stPo, 200, 'sam adres e-mail operacyjny wystarcza - zgoda na e-mail W REJESTRZE to osobna sprawa (Z-157)');
});

/**
 * Od etapu „dokumenty przygotowuje kancelaria" zlozenie wniosku NIE generuje
 * juz zadnych plikow. Komplet wystawia pracownik (`/api/psa/wnioski/...`),
 * sprawdza go i dopiero udostepnia klientowi — te trzy kroki sa tu
 * przechodzone w calosci, bo dopiero razem daja klientowi co podpisac.
 */
async function wystawIUdostepnij(wniosekId) {
  const [stWystaw, poWystawieniu] = await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/dokumenty/wystaw`, {}, ciastkoPracownik
  );
  assert.equal(stWystaw, 200);
  const [stUdostepnij, poUdostepnieniu] = await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/dokumenty/udostepnij`, {}, ciastkoPracownik
  );
  assert.equal(stUdostepnij, 200);
  return { poWystawieniu, poUdostepnieniu };
}

test('POST /api/psa/portal/wniosek/zloz: zamyka edycje i NIE generuje dokumentow', async () => {
  const { kontoId, ciastko } = await kontoWnioskodawcy('zlozenie-pelne@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  await zapytaj('PUT', '/api/psa/portal/wniosek', {
    nazwa: 'Wniosek Pelny P.S.A.',
    reprezentant_imie_nazwisko: 'Jan Kowalski',
    reprezentant_funkcja: 'Prezes Zarządu',
  }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { ...AKCJONARIUSZ_PELNY }, ciastko);

  const [stZloz, wynikZloz] = await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  assert.equal(stZloz, 200);
  assert.equal(wynikZloz.wniosek.status, 'zlozony');
  assert.equal(wynikZloz.dokumenty.length, 0, 'klient nie dostaje dokumentow z automatu');
  assert.equal(wynikZloz.wniosek.umowa_projekt_sciezka, null);

  const wiersz = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(kontoId);
  assert.equal(wiersz.status, 'zlozony');
  assert.equal(
    db().prepare('SELECT COUNT(*) c FROM psa_wnioski_dokumenty WHERE wniosek_id = ?').get(wiersz.id).c,
    0
  );

  // Wniosek jest teraz zamkniety do edycji (status opuscil stany edytowalne).
  const [stEdycjaPoZlozeniu] = await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Zmiana' }, ciastko);
  assert.equal(stEdycjaPoZlozeniu, 400);
});

test('POST /api/psa/wnioski/:id/dokumenty/wystaw: komplet z umowa, niewidoczny dla klienta do czasu udostepnienia', async () => {
  const { kontoId, ciastko } = await kontoWnioskodawcy('wystawianie-kompletu@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Komplet P.S.A.', krs: '0000111222' }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { ...AKCJONARIUSZ_PELNY, email: 'anna@example.pl' }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  const wniosekId = db().prepare('SELECT id FROM psa_wnioski WHERE konto_id = ?').get(kontoId).id;

  const [stWystaw, poWystawieniu] = await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/dokumenty/wystaw`, {}, ciastkoPracownik
  );
  assert.equal(stWystaw, 200);
  assert.equal(poWystawieniu.dokumenty[0].typ, 'umowa_rejestru', 'umowa jest w komplecie i stoi na jego czele');
  assert.ok(
    poWystawieniu.dokumenty.every((d) => d.udostepniono === null),
    'wystawienie samo w sobie niczego klientowi nie pokazuje'
  );
  assert.ok(poWystawieniu.dokumenty.every((d) => d.edytowalny), 'kazda pozycja ma tresc do poprawienia');
  assert.ok(poWystawieniu.wniosek.umowa_projekt_sciezka, 'sciezka projektu umowy zapisana na wniosku');

  const [, przedUdostepnieniem] = await zapytaj('GET', '/api/psa/portal/wniosek/dokumenty', undefined, ciastko);
  assert.equal(przedUdostepnieniem.dokumenty.length, 0, 'portal klienta pokazuje wylacznie udostepnione');

  const umowa = poWystawieniu.dokumenty[0];
  const przedczasnie = await fetch(`${baza}/api/psa/portal/wniosek/dokumenty/${umowa.id}`, { headers: { Cookie: ciastko } });
  assert.equal(przedczasnie.status, 404, 'nieudostepnionego pliku klient nie pobierze');

  const [stUdostepnij, poUdostepnieniu] = await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/dokumenty/udostepnij`, {}, ciastkoPracownik
  );
  assert.equal(stUdostepnij, 200);
  assert.equal(poUdostepnieniu.wniosek.status, 'umowa_wygenerowana');
  assert.ok(poUdostepnieniu.dokumenty.every((d) => d.udostepniono));

  const [, poStronieKlienta] = await zapytaj('GET', '/api/psa/portal/wniosek/dokumenty', undefined, ciastko);
  assert.equal(poStronieKlienta.dokumenty.length, poUdostepnieniu.dokumenty.length);

  const plik = await fetch(`${baza}/api/psa/portal/wniosek/dokumenty/${umowa.id}`, { headers: { Cookie: ciastko } });
  assert.equal(plik.status, 200);
  const bajty = Buffer.from(await plik.arrayBuffer());
  // Dokument do podpisu wychodzi jako PDF — nie da sie go poprawic w edytorze.
  assert.equal(bajty.subarray(0, 4).toString('latin1'), '%PDF');

  const projekt = await fetch(`${baza}/api/psa/portal/wniosek/umowa-projekt`, { headers: { Cookie: ciastko } });
  assert.equal(projekt.status, 200);
  assert.ok(
    fs.existsSync(path.join(
      require('../server/konfiguracja').KATALOG_DOKUMENTOW,
      db().prepare('SELECT umowa_projekt_sciezka s FROM psa_wnioski WHERE id = ?').get(wniosekId).s
    ))
  );
});

test('PUT /api/psa/wnioski/:id/dokumenty/:dokId/tresc: poprawiona tresc sklada plik od nowa', async () => {
  const { kontoId, ciastko } = await kontoWnioskodawcy('edycja-tresci@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Edycja P.S.A.' }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { ...AKCJONARIUSZ_PELNY, imie: 'Piotr', nazwisko: 'Zielinski' }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  const wniosekId = db().prepare('SELECT id FROM psa_wnioski WHERE konto_id = ?').get(kontoId).id;
  const { poWystawieniu } = await wystawIUdostepnij(wniosekId);

  const rodo = poWystawieniu.dokumenty.find((d) => d.typ === 'oswiadczenie_rodo');
  const [stTresc, tresc] = await zapytaj(
    'GET', `/api/psa/wnioski/${wniosekId}/dokumenty/${rodo.id}/tresc`, undefined, ciastkoPracownik
  );
  assert.equal(stTresc, 200);
  assert.ok(tresc.dokument.bloki.length > 0, 'tresc dokumentu jest do odczytania blokami');

  const zmienione = tresc.dokument.bloki.map((b) =>
    (b.rodzaj === 'akapit' ? { ...b, tekst: 'Treść poprawiona przez notariusza.' } : b));
  const [stZapis, poZapisie] = await zapytaj(
    'PUT', `/api/psa/wnioski/${wniosekId}/dokumenty/${rodo.id}/tresc`, { bloki: zmienione }, ciastkoPracownik
  );
  assert.equal(stZapis, 200);
  assert.ok(poZapisie.dokument.zmodyfikowano, 'poprawka zostawia slad');
  assert.ok(
    poZapisie.dokument.bloki.some((b) => b.tekst === 'Treść poprawiona przez notariusza.'),
    'zapisana tresc wraca zmieniona'
  );

  // Plik podmienia sie W MIEJSCU — klient pobiera juz poprawiona wersje.
  const plik = await fetch(`${baza}/api/psa/portal/wniosek/dokumenty/${rodo.id}`, { headers: { Cookie: ciastko } });
  assert.equal(plik.status, 200);
  const bajty = Buffer.from(await plik.arrayBuffer());
  assert.equal(bajty.subarray(0, 4).toString('latin1'), '%PDF');

  const [stPusta] = await zapytaj(
    'PUT', `/api/psa/wnioski/${wniosekId}/dokumenty/${rodo.id}/tresc`, { bloki: [] }, ciastkoPracownik
  );
  assert.equal(stPusta, 400, 'pusta tresc nie przechodzi');
});

test('POST /api/psa/portal/wniosek/dokumenty/:id/podpis: skan wraca do KAZDEGO dokumentu, status dopiero przy odeslaniu', async () => {
  const { kontoId, ciastko } = await kontoWnioskodawcy('podpisy-per-dokument@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Podpisy P.S.A.' }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { ...AKCJONARIUSZ_PELNY }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  const wniosekId = db().prepare('SELECT id FROM psa_wnioski WHERE konto_id = ?').get(kontoId).id;
  const { poUdostepnieniu } = await wystawIUdostepnij(wniosekId);
  const dokumenty = poUdostepnieniu.dokumenty;

  // Umowa jest czescia kompletu i stoi na jego czele.
  const umowa = dokumenty.find((d) => d.typ === 'umowa_rejestru');
  assert.ok(umowa, 'umowa jest jedna z pozycji kompletu');
  assert.equal(dokumenty[0].typ, 'umowa_rejestru', 'umowa pierwsza na liscie');
  assert.ok(dokumenty.every((d) => !d.podpis_nazwa_pliku), 'na starcie nic nie jest podpisane');

  async function wyslijSkan(dokumentId, nazwa) {
    const formularz = new FormData();
    formularz.append('plik', new Blob(['%PDF-1.4\nskan'], { type: 'application/pdf' }), nazwa);
    const odp = await fetch(`${baza}/api/psa/portal/wniosek/dokumenty/${dokumentId}/podpis`, {
      method: 'POST', headers: { Cookie: ciastko }, body: formularz,
    });
    return [odp.status, await odp.json().catch(() => ({}))];
  }

  // Skan oswiadczenia NIE rusza statusu — umowy wciaz nie ma.
  const rodo = dokumenty.find((d) => d.typ === 'oswiadczenie_rodo');
  const [stRodo, poRodo] = await wyslijSkan(rodo.id, 'rodo.pdf');
  assert.equal(stRodo, 201);
  assert.equal(poRodo.wniosek.status, 'umowa_wygenerowana');
  assert.equal(poRodo.dokumenty.find((d) => d.id === rodo.id).podpis_nazwa_pliku, 'rodo.pdf');

  // Skan UMOWY zapisuje sciezke na wniosku, ale sam TEZ nie rusza statusu —
  // kancelaria nie dostaje wniosku, do ktorego brakuje jeszcze szesciu
  // podpisow.
  const [stUmowa, poUmowie] = await wyslijSkan(umowa.id, 'umowa.pdf');
  assert.equal(stUmowa, 201);
  assert.equal(poUmowie.wniosek.status, 'umowa_wygenerowana');
  assert.ok(poUmowie.wniosek.umowa_podpisana_sciezka, 'sciezka podpisanej umowy zapisana na wniosku');

  // Odeslanie niepelnego kompletu odpada — brakujace pozycje wracaja w odpowiedzi.
  const [stNiepelny, niepelny] = await zapytaj('POST', '/api/psa/portal/wniosek/odeslij', undefined, ciastko);
  assert.equal(stNiepelny, 400);
  assert.match(niepelny.blad, /niepełny/);
  assert.ok(Array.isArray(niepelny.szczegoly) && niepelny.szczegoly.length > 0);

  // Zdjecie skanu umowy czysci jej sciezke, nie ruszajac reszty kompletu.
  const [stUsun, poUsunieciu] = await zapytaj(
    'DELETE', `/api/psa/portal/wniosek/dokumenty/${umowa.id}/podpis`, undefined, ciastko
  );
  assert.equal(stUsun, 200);
  assert.equal(poUsunieciu.wniosek.status, 'umowa_wygenerowana');
  assert.equal(poUsunieciu.wniosek.umowa_podpisana_sciezka, null);
  assert.ok(
    poUsunieciu.dokumenty.find((d) => d.id === rodo.id).podpis_nazwa_pliku,
    'zdjecie skanu umowy nie rusza pozostalych dokumentow'
  );

  // Komplet w calosci -> odeslanie przestawia status i zamyka wymiane skanow.
  for (const d of poUsunieciu.dokumenty) {
    if (!d.podpis_nazwa_pliku) await wyslijSkan(d.id, `skan-${d.typ}.pdf`);
  }
  const [stOdeslij, poOdeslaniu] = await zapytaj('POST', '/api/psa/portal/wniosek/odeslij', undefined, ciastko);
  assert.equal(stOdeslij, 200, JSON.stringify(poOdeslaniu));
  assert.equal(poOdeslaniu.wniosek.status, 'umowa_podpisana');

  const [stPoOdeslaniu] = await wyslijSkan(rodo.id, 'rodo-poprawiony.pdf');
  assert.equal(stPoOdeslaniu, 400, 'po odeslaniu kompletu skanow sie juz nie wymienia');
  const [stPowtorka] = await zapytaj('POST', '/api/psa/portal/wniosek/odeslij', undefined, ciastko);
  assert.equal(stPowtorka, 400, 'drugi raz nie ma czego odsylac');

  // Cudzy numer dokumentu nie trafia w nic — zapytanie zawsze idzie razem
  // z wnioskiem znalezionym po konto_id z sesji.
  const obcy = await kontoWnioskodawcy('podpisy-obcy@example.pl');
  const [stObcy] = await zapytaj(
    'DELETE', `/api/psa/portal/wniosek/dokumenty/${umowa.id}/podpis`, undefined, obcy.ciastko
  );
  assert.equal(stObcy, 404, 'dokument z cudzego wniosku jest nie do ruszenia');
});

test('GET /api/psa/portal/wniosek/umowa-projekt: 404 przed zlozeniem wniosku', async () => {
  const { ciastko } = await kontoWnioskodawcy('projekt-przed-zlozeniem@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  const odp = await fetch(`${baza}/api/psa/portal/wniosek/umowa-projekt`, { headers: { Cookie: ciastko } });
  assert.equal(odp.status, 404);
});

test('POST /api/psa/portal/wniosek/umowa-podpisana: odmawia przed udostepnieniem kompletu, przyjmuje po', async () => {
  const { kontoId, ciastko } = await kontoWnioskodawcy('umowa-podpisana@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);

  const formularzZaWczesnie = new FormData();
  formularzZaWczesnie.append('plik', new Blob(['%PDF-1.4\ntresc testowa'], { type: 'application/pdf' }), 'umowa.pdf');
  const zaWczesnie = await fetch(`${baza}/api/psa/portal/wniosek/umowa-podpisana`, {
    method: 'POST', headers: { Cookie: ciastko }, body: formularzZaWczesnie,
  });
  assert.equal(zaWczesnie.status, 400, 'jeszcze nie ma czego podpisywac');

  await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Wniosek Do Podpisu P.S.A.' }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { ...AKCJONARIUSZ_PELNY, imie: null, nazwisko: 'Zielinski' }, ciastko);
  await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);
  const wniosekId = db().prepare('SELECT id FROM psa_wnioski WHERE konto_id = ?').get(kontoId).id;
  await wystawIUdostepnij(wniosekId);

  const zlaKoncowka = new FormData();
  zlaKoncowka.append('plik', new Blob(['echo'], { type: 'application/x-sh' }), 'skrypt.sh');
  const odpZlaKoncowka = await fetch(`${baza}/api/psa/portal/wniosek/umowa-podpisana`, {
    method: 'POST', headers: { Cookie: ciastko }, body: zlaKoncowka,
  });
  assert.equal(odpZlaKoncowka.status, 400, 'niedozwolone rozszerzenie pliku');

  // Rozszerzenie w nazwie to obietnica klienta. Plik nazwany „.pdf", ktory
  // w srodku jest strona HTML, wracal do pracownika jako `text/html` do
  // wyswietlenia w ramce — czyli skrypt klienta dzialal w sesji kancelarii.
  const udawanyPdf = new FormData();
  udawanyPdf.append(
    'plik',
    new Blob(['<html><body><script>alert(1)</script></body></html>'], { type: 'text/html' }),
    'skan-umowy.pdf'
  );
  const odpUdawany = await fetch(`${baza}/api/psa/portal/wniosek/umowa-podpisana`, {
    method: 'POST', headers: { Cookie: ciastko }, body: udawanyPdf,
  });
  assert.equal(odpUdawany.status, 400, 'tresc HTML pod nazwa .pdf jest odrzucana');

  const formularz = new FormData();
  formularz.append('plik', new Blob(['%PDF-1.4\npodpisana tresc'], { type: 'application/pdf' }), 'podpisana-umowa.pdf');
  const odp = await fetch(`${baza}/api/psa/portal/wniosek/umowa-podpisana`, {
    method: 'POST', headers: { Cookie: ciastko }, body: formularz,
  });
  assert.equal(odp.status, 201);
  const dane = await odp.json();
  // Samo wgranie umowy nie stawia wniosku w kolejce kancelarii — robi to
  // dopiero odeslanie calego kompletu (`POST /wniosek/odeslij`).
  assert.equal(dane.wniosek.status, 'umowa_wygenerowana');

  const wiersz = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(kontoId);
  assert.equal(wiersz.umowa_podpisana_nazwa_pliku, 'podpisana-umowa.pdf');

  const pobrana = await fetch(`${baza}/api/psa/portal/wniosek/umowa-podpisana`, { headers: { Cookie: ciastko } });
  assert.equal(pobrana.status, 200);
  assert.equal(pobrana.headers.get('content-type'), 'application/pdf');
});

test('POST /api/psa/portal/wniosek/dowod: za duzy plik dostaje przetlumaczony komunikat (Z-254)', async () => {
  const { ciastko } = await kontoWnioskodawcy('za-duzy-dowod@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko); // zaloz wniosek

  const zaDuzy = new FormData();
  zaDuzy.append('plik', new Blob([Buffer.alloc(21 * 1024 * 1024)], { type: 'application/pdf' }), 'dowod.pdf');
  const odp = await fetch(`${baza}/api/psa/portal/wniosek/dowod`, {
    method: 'POST', headers: { Cookie: ciastko }, body: zaDuzy,
  });
  const wynik = await odp.json();
  assert.equal(odp.status, 400);
  assert.equal(wynik.blad, 'Plik jest za duży (limit 20 MB).', 'komunikat przetlumaczony, nie surowy "File too large"');
});

test('PUT /api/psa/portal/wniosek: niepoprawny JSON w ciele zwraca 400, nie 500 (Z-255)', async () => {
  const { ciastko } = await kontoWnioskodawcy('zly-json-wniosek@example.pl');
  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko); // zaloz wniosek

  const odp = await fetch(`${baza}/api/psa/portal/wniosek`, {
    method: 'PUT',
    headers: { Cookie: ciastko, 'Content-Type': 'application/json' },
    body: '{nazwa: "brak cudzyslowow"',
  });
  const wynik = await odp.json();
  assert.equal(odp.status, 400);
  assert.equal(wynik.blad, 'Treść żądania nie jest poprawnym JSON-em.');
});
