'use strict';

/**
 * Etap 3F: weryfikacja wniosku klienta przez kancelarie.
 *   - `GET /api/psa/wnioski` — kolejka, filtr po statusie.
 *   - `GET /api/psa/wnioski/:id` — szczegol + porownanie z KRS.
 *   - `PUT /api/psa/wnioski/:id` — reczna korekta danych spolki.
 *   - `POST/PUT/DELETE /api/psa/wnioski/:id/akcjonariusze[/:akcId]` — korekta pozycji.
 *   - `POST /api/psa/wnioski/:id/akcjonariusze/:akcId/zweryfikuj` — akceptacja pozycja po pozycji.
 *   - `POST /api/psa/wnioski/:id/do-uzupelnienia` / `/odrzuc` / `/przyjmij`.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-wnioski-kancelaria-http.db');
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
       VALUES ('Notariusz', 'notariusz-wnioski@example.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz-wnioski@example.pl', haslo: 'HasloTestowe123' }),
  });
  ciastkoPracownik = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
});

/** Zaklada aktywne konto "wnioskodawca" WPROST w bazie i wypelnia wniosek do stanu "umowa_podpisana". */
async function wnioskGotowyDoWeryfikacji(email, { zAkcjonariuszem = true, dodatkowePola = {} } = {}) {
  const hash = await hasla.hashuj('HasloWnioskodawcy123');
  db()
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
  const ciastko = ciasteczkoZOdpowiedzi(odpLogin);

  await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastko);
  await zapytaj('PUT', '/api/psa/portal/wniosek', {
    nazwa: `Wniosek Weryfikacja ${email}`,
    reprezentant_imie_nazwisko: 'Jan Kowalski',
    reprezentant_funkcja: 'Prezes Zarządu',
    ...dodatkowePola,
  }, ciastko);
  if (zAkcjonariuszem) {
    await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { typ: 'fizyczna', nazwisko: 'Nowak', imie: 'Anna' }, ciastko);
  }
  await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);

  const formularz = new FormData();
  formularz.append('plik', new Blob(['podpisana tresc'], { type: 'application/pdf' }), 'podpisana-umowa.pdf');
  await fetch(`${baza}/api/psa/portal/wniosek/umowa-podpisana`, { method: 'POST', headers: { Cookie: ciastko }, body: formularz });

  const wiersz = db().prepare(`SELECT * FROM psa_wnioski WHERE konto_id = (SELECT id FROM psa_konta WHERE email = ?)`).get(email);
  return { wniosekId: wiersz.id, ciastkoKlienta: ciastko };
}

test('GET /api/psa/wnioski: wymaga zalogowanego pracownika', async () => {
  const [status] = await zapytaj('GET', '/api/psa/wnioski');
  assert.equal(status, 401);
});

test('GET /api/psa/wnioski: lista + filtr statusu', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('lista-wnioskow@example.pl');

  const [status, wynik] = await zapytaj('GET', '/api/psa/wnioski?status=umowa_podpisana', undefined, ciastkoPracownik);
  assert.equal(status, 200);
  const wiersz = wynik.wnioski.find((w) => w.id === wniosekId);
  assert.ok(wiersz, 'zlozony wniosek jest na liscie z filtrem statusu');
  assert.equal(wiersz.liczba_akcjonariuszy, 1);
  assert.equal(wiersz.konto_email, 'lista-wnioskow@example.pl');

  const [, pusta] = await zapytaj('GET', '/api/psa/wnioski?status=odrzucony', undefined, ciastkoPracownik);
  assert.equal(pusta.wnioski.find((w) => w.id === wniosekId), undefined);
});

test('GET /api/psa/wnioski/:id: szczegol z akcjonariuszami, krs null bez numeru KRS', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('szczegol-wnioski@example.pl');

  const [status, wynik] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  assert.equal(status, 200);
  assert.equal(wynik.wniosek.status, 'umowa_podpisana');
  assert.equal(wynik.akcjonariusze.length, 1);
  assert.equal(wynik.krs, null, 'brak numeru KRS na wniosku - bez proby pobrania');
});

test('PUT /api/psa/wnioski/:id: kancelaria koryguje dane spolki', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('korekta-spolki@example.pl');

  const [status, wynik] = await zapytaj('PUT', `/api/psa/wnioski/${wniosekId}`, { miejscowosc: 'Kraków' }, ciastkoPracownik);
  assert.equal(status, 200);
  assert.equal(wynik.wniosek.miejscowosc, 'Kraków');
  assert.equal(wynik.wniosek.nazwa, `Wniosek Weryfikacja korekta-spolki@example.pl`, 'inne pola nie zostaly zatarte');
});

test('POST/PUT/DELETE /api/psa/wnioski/:id/akcjonariusze: kancelaria dopisuje, koryguje i usuwa pozycje', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('akcjonariusze-kancelaria@example.pl', { zAkcjonariuszem: false });

  const [stDodaj, dodany] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze`, { typ: 'fizyczna', nazwisko: 'Dopisany' }, ciastkoPracownik);
  assert.equal(stDodaj, 201);
  assert.equal(dodany.akcjonariusz.nazwisko, 'Dopisany');

  const [stEdytuj, edytowany] = await zapytaj('PUT', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${dodany.akcjonariusz.id}`, { imie: 'Poprawione' }, ciastkoPracownik);
  assert.equal(stEdytuj, 200);
  assert.equal(edytowany.akcjonariusz.imie, 'Poprawione');
  assert.equal(edytowany.akcjonariusz.nazwisko, 'Dopisany');

  const [stUsun] = await zapytaj('DELETE', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${dodany.akcjonariusz.id}`, undefined, ciastkoPracownik);
  assert.equal(stUsun, 200);
  const [, wynikPo] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  assert.equal(wynikPo.akcjonariusze.length, 0);
});

test('POST /api/psa/wnioski/:id/akcjonariusze/:akcId/zweryfikuj: przelacza flage, opcjonalnie dowiazuje osobe', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('weryfikacja-pozycji@example.pl');
  const [, dane] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  const akcId = dane.akcjonariusze[0].id;

  const [status, wynik] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${akcId}/zweryfikuj`, { zweryfikowano: true }, ciastkoPracownik);
  assert.equal(status, 200);
  assert.equal(wynik.akcjonariusz.zweryfikowano, 1);
  assert.equal(wynik.akcjonariusz.osoba_id, null, 'bez wskazanej osoby - powstanie nowa przy przyjeciu');

  const [, cofniete] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${akcId}/zweryfikuj`, { zweryfikowano: false }, ciastkoPracownik);
  assert.equal(cofniete.akcjonariusz.zweryfikowano, 0);
});

test('POST /api/psa/wnioski/:id/przyjmij: odmawia, gdy nie kazda pozycja jest zweryfikowana', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('przyjmij-niepelne@example.pl');
  const [status, wynik] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, undefined, ciastkoPracownik);
  assert.equal(status, 400);
  assert.match(wynik.blad, /nie jest jeszcze zweryfikowan/);
});

test('POST /api/psa/wnioski/:id/przyjmij: zaklada spolke i osobe, dowiazuje wniosek, blokuje ponowne przyjecie', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('przyjmij-pelne@example.pl');
  const [, dane] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  const akcId = dane.akcjonariusze[0].id;
  await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${akcId}/zweryfikuj`, { zweryfikowano: true }, ciastkoPracownik);

  const [status, wynik] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, undefined, ciastkoPracownik);
  assert.equal(status, 200);
  assert.equal(wynik.wniosek.status, 'przyjety');
  assert.ok(wynik.spolka_id);
  assert.equal(wynik.wniosek.spolka_id, wynik.spolka_id);

  const spolka = db().prepare('SELECT * FROM psa_spolki WHERE id = ?').get(wynik.spolka_id);
  assert.equal(spolka.nazwa, 'Wniosek Weryfikacja przyjmij-pelne@example.pl');

  const akcjonariuszPo = db().prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE id = ?').get(akcId);
  assert.ok(akcjonariuszPo.osoba_id, 'nowa osoba zalozona i dowiazana do pozycji wniosku');
  const osoba = db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(akcjonariuszPo.osoba_id);
  assert.equal(osoba.nazwisko, 'Nowak');

  const [stPonownie] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, undefined, ciastkoPracownik);
  assert.equal(stPonownie, 400, 'wniosek przyjety jest juz zamkniety');

  const [stKorektaPoZamknieciu] = await zapytaj('PUT', `/api/psa/wnioski/${wniosekId}`, { miejscowosc: 'X' }, ciastkoPracownik);
  assert.equal(stKorektaPoZamknieciu, 400, 'zamknietego wniosku nie mozna juz korygowac');
});

test('POST /api/psa/wnioski/:id/przyjmij: dopasowuje istniejaca osobe przy zweryfikuj z osoba_id, nie duplikuje kartoteki', async () => {
  const [, istniejaca] = await zapytaj('POST', '/api/psa/osoby', { typ: 'fizyczna', nazwisko: 'Istniejacy', imie: 'Adam' }, ciastkoPracownik);

  const { wniosekId } = await wnioskGotowyDoWeryfikacji('dopasowanie-osoby@example.pl');
  const [, dane] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  const akcId = dane.akcjonariusze[0].id;
  await zapytaj(
    'POST',
    `/api/psa/wnioski/${wniosekId}/akcjonariusze/${akcId}/zweryfikuj`,
    { zweryfikowano: true, osoba_id: istniejaca.osoba.id },
    ciastkoPracownik
  );

  const liczbaOsobPrzed = db().prepare('SELECT COUNT(*) AS ile FROM psa_osoby').get().ile;
  const [status, wynik] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, undefined, ciastkoPracownik);
  assert.equal(status, 200);
  assert.equal(wynik.wniosek.status, 'przyjety');

  const liczbaOsobPo = db().prepare('SELECT COUNT(*) AS ile FROM psa_osoby').get().ile;
  assert.equal(liczbaOsobPo, liczbaOsobPrzed, 'zaden nowy wpis w kartotece - pozycja byla dowiazana do istniejacej osoby');

  const akcjonariuszPo = db().prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE id = ?').get(akcId);
  assert.equal(akcjonariuszPo.osoba_id, istniejaca.osoba.id);
});

test('POST /api/psa/wnioski/:id/przyjmij: dowiazuje do istniejacej spolki po numerze KRS zamiast duplikowac', async () => {
  const [, istniejacaSpolka] = await zapytaj('POST', '/api/psa/spolki', { nazwa: 'Spolka Z KRS Sp.', krs: '0000999888' }, ciastkoPracownik);

  const { wniosekId } = await wnioskGotowyDoWeryfikacji('dopasowanie-spolki@example.pl', {
    dodatkowePola: { krs: '0000999888' },
  });

  const [, dane] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  const akcId = dane.akcjonariusze[0].id;
  await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${akcId}/zweryfikuj`, { zweryfikowano: true }, ciastkoPracownik);

  const [status, wynik] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, undefined, ciastkoPracownik);
  assert.equal(status, 200);
  assert.equal(wynik.spolka_id, istniejacaSpolka.spolka.id, 'dowiazano do istniejacej spolki po KRS, nie zalozono nowej');
});

test('POST /api/psa/wnioski/:id/do-uzupelnienia: wymaga notatki, wraca do edycji po stronie klienta', async () => {
  const { wniosekId, ciastkoKlienta } = await wnioskGotowyDoWeryfikacji('do-uzupelnienia@example.pl');

  const [stBrakNotatki] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/do-uzupelnienia`, {}, ciastkoPracownik);
  assert.equal(stBrakNotatki, 400);

  const [status, wynik] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/do-uzupelnienia`, { notatka: 'Uzupełnij adres siedziby.' }, ciastkoPracownik);
  assert.equal(status, 200);
  assert.equal(wynik.wniosek.status, 'do_uzupelnienia');
  assert.equal(wynik.wniosek.notatka_weryfikacji, 'Uzupełnij adres siedziby.');

  // Klient znowu moze edytowac wniosek (portal.js: PUT /wniosek dopuszcza do_uzupelnienia).
  const [stEdycjaKlienta] = await zapytaj('PUT', '/api/psa/portal/wniosek', { miejscowosc: 'Poznań' }, ciastkoKlienta);
  assert.equal(stEdycjaKlienta, 200);
});

test('POST /api/psa/wnioski/:id/odrzuc: zamyka wniosek', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('odrzucenie@example.pl');

  const [status, wynik] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/odrzuc`, { notatka: 'Dane niekompletne, brak kontaktu.' }, ciastkoPracownik);
  assert.equal(status, 200);
  assert.equal(wynik.wniosek.status, 'odrzucony');

  const [stPoOdrzuceniu] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/do-uzupelnienia`, { notatka: 'x' }, ciastkoPracownik);
  assert.equal(stPoOdrzuceniu, 400, 'odrzuconego wniosku nie mozna juz przelaczac');
});
