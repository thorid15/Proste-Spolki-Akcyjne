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
const { AKCJONARIUSZ_PELNY } = require('./pomoc');
const { KATALOG_DOKUMENTOW } = require('../server/konfiguracja');

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
async function wnioskGotowyDoWeryfikacji(
  email,
  { zAkcjonariuszem = true, dodatkowePola = {}, bezPotwierdzenPodpisow = false, bezSkanow = false } = {}
) {
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
    await zapytaj('POST', '/api/psa/portal/wniosek/akcjonariusze', { ...AKCJONARIUSZ_PELNY }, ciastko);
  }
  await zapytaj('POST', '/api/psa/portal/wniosek/zloz', undefined, ciastko);

  const zlozony = db().prepare(`SELECT * FROM psa_wnioski WHERE konto_id = (SELECT id FROM psa_konta WHERE email = ?)`).get(email);

  // Komplet do podpisu wystawia i udostepnia KANCELARIA — zlozenie wniosku
  // samo w sobie nie daje klientowi czego podpisac. Potem klient odsyla skany,
  // a kancelaria potwierdza kazdy podpis: bez tego wniosku nie da sie przyjac.
  if (zAkcjonariuszem) {
    await zapytaj('POST', `/api/psa/wnioski/${zlozony.id}/dokumenty/wystaw`, {}, ciastkoPracownik);
    const [, udostepnione] = await zapytaj(
      'POST', `/api/psa/wnioski/${zlozony.id}/dokumenty/udostepnij`, {}, ciastkoPracownik
    );

    for (const d of bezSkanow ? [] : udostepnione.dokumenty) {
      const formularz = new FormData();
      formularz.append('plik', new Blob(['%PDF-1.4\npodpisana tresc'], { type: 'application/pdf' }), `podpisany-${d.typ}.pdf`);
      await fetch(`${baza}/api/psa/portal/wniosek/dokumenty/${d.id}/podpis`, {
        method: 'POST', headers: { Cookie: ciastko }, body: formularz,
      });
      if (!bezPotwierdzenPodpisow) {
        await zapytaj(
          'POST', `/api/psa/wnioski/${zlozony.id}/dokumenty/${d.id}/podpis-potwierdz`, {}, ciastkoPracownik
        );
      }
    }
    // Wgranie skanow to jeszcze nie odeslanie — klient zalacza komplet,
    // sprawdza go i dopiero wtedy stawia wniosek w kolejce kancelarii.
    if (!bezSkanow) await zapytaj('POST', '/api/psa/portal/wniosek/odeslij', undefined, ciastko);
  }

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

  // Komplet dokumentow przechodzi z wniosku do AKT SPOLKI: wniosek sie
  // zamyka, dokumenty zalozycielskie zyja dalej.
  const [, akta] = await zapytaj(
    'GET', `/api/psa/spolki/${wynik.spolka_id}/dokumenty-zalozycielskie`, undefined, ciastkoPracownik
  );
  assert.ok(akta.dokumenty.length > 0, 'akta spolki nie sa puste');
  assert.ok(
    akta.dokumenty.some((d) => d.typ === 'umowa_rejestru' && d.rola === 'wzor'),
    'wystawiona umowa jest w aktach spolki'
  );
  // Podpisana umowa wrocila w `wnioskGotowyDoWeryfikacji`, wiec oba
  // egzemplarze maja tu byc: bez wzoru nie wiadomo, pod czym podpisano.
  assert.ok(
    akta.dokumenty.some((d) => d.typ === 'umowa_rejestru' && d.rola === 'podpisany'),
    'odeslany skan umowy jest w aktach spolki'
  );
  // Sciezki na dysku sa wewnetrzne — trasa ich nie zwraca, wiec do
  // sprawdzenia, czy kopie faktycznie powstaly, siegamy do bazy.
  const kopie = db()
    .prepare('SELECT sciezka FROM psa_spolki_dokumenty WHERE spolka_id = ?')
    .all(wynik.spolka_id)
    .map((d) => path.join(KATALOG_DOKUMENTOW, d.sciezka));
  assert.equal(kopie.length, akta.dokumenty.length);
  assert.ok(kopie.every((s) => fs.existsSync(s)), 'kazdy wiersz akt ma swoj plik na dysku');

  // Sekcja "Dokumenty" w kokpicie pyta o CALA teczke jednym zapytaniem —
  // komplet zalozycielski musi sie w niej znalezc z data i adresem pliku.
  const [stAkta, teczka] = await zapytaj(
    'GET', `/api/psa/spolki/${wynik.spolka_id}/akta`, undefined, ciastkoPracownik
  );
  assert.equal(stAkta, 200);
  const zalozycielskie = teczka.dokumenty.filter((d) => d.grupa === 'zalozycielski');
  // Teczka laczy oba egzemplarze jednego dokumentu w JEDNA pozycje z dwoma
  // odnosnikami, wiec wierszy jest tyle, ile dokumentow — nie ile plikow.
  const wystawione = akta.dokumenty.filter((d) => d.rola === 'wzor');
  assert.equal(zalozycielskie.length, wystawione.length, 'teczka zawiera caly komplet z wniosku');
  assert.ok(zalozycielskie.every((d) => d.data && d.url), 'kazda pozycja teczki ma date i adres pobrania');
  assert.ok(
    zalozycielskie.some((d) => d.url_podpisany && d.opis === 'wystawiony i podpisany'),
    'pozycja z odeslanym skanem ma odnosnik do obu egzemplarzy'
  );

  const [stPonownie] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, undefined, ciastkoPracownik);
  assert.equal(stPonownie, 400, 'wniosek przyjety jest juz zamkniety');

  const [stKorektaPoZamknieciu] = await zapytaj('PUT', `/api/psa/wnioski/${wniosekId}`, { miejscowosc: 'X' }, ciastkoPracownik);
  assert.equal(stKorektaPoZamknieciu, 400, 'zamknietego wniosku nie mozna juz korygowac');
});

/**
 * Naprawa Z-151/P-010: `pep_oswiadczenie` (OSWIADCZENIE OSOBY) przechodzi
 * z wniosku do kartoteki normalnie, ale `pep`/`pep_opis` (USTALENIE
 * KANCELARII) - nawet jesli ktos je wypelnil na wniosku - NIGDY. Nowa osoba
 * dostaje `pep` z DEFAULT bazy ('nieustalono'), bo to pracownik ustala je
 * PO przyjeciu, nie wniosek klienta.
 */
test('POST /api/psa/wnioski/:id/przyjmij: oswiadczenie PEP przechodzi do kartoteki, ustalenie kancelarii - nigdy', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('pep-przyjmij@example.pl');
  const [, dane] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  const akcId = dane.akcjonariusze[0].id;

  await zapytaj(
    'PUT', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${akcId}`,
    { pep_oswiadczenie: 'tak', pep_oswiadczenie_data: '2026-08-16', pep: 'tak', pep_opis: 'Wpisane omylkowo na wnioski' },
    ciastkoPracownik
  );
  await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${akcId}/zweryfikuj`, { zweryfikowano: true }, ciastkoPracownik);

  const [status] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, undefined, ciastkoPracownik);
  assert.equal(status, 200);

  const akcjonariuszPo = db().prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE id = ?').get(akcId);
  const osoba = db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(akcjonariuszPo.osoba_id);
  assert.equal(osoba.pep_oswiadczenie, 'tak', 'oswiadczenie osoby przechodzi z wniosku');
  assert.equal(osoba.pep_oswiadczenie_data, '2026-08-16');
  assert.equal(osoba.pep, 'nieustalono', 'ustalenie kancelarii NIE dziedziczy sie z wniosku');
  assert.equal(osoba.pep_opis, null);
});

test('POST /api/psa/wnioski/:id/przyjmij: przepina konto wnioskodawcy na role spolki — i tylko na JEGO spolke', async () => {
  const { wniosekId, ciastkoKlienta } = await wnioskGotowyDoWeryfikacji('przepiecie-konta@example.pl');
  const [, dane] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${dane.akcjonariusze[0].id}/zweryfikuj`,
    { zweryfikowano: true }, ciastkoPracownik
  );

  // Przed przyjeciem: konto nie ma spolki, a "Moje spolki" pokazuje wniosek.
  const [, mojePrzed] = await zapytaj('GET', '/api/psa/portal/moje', undefined, ciastkoKlienta);
  assert.equal(mojePrzed.rola, 'wnioskodawca');
  assert.deepEqual(mojePrzed.spolki, []);
  assert.equal(mojePrzed.wniosek.status, 'umowa_podpisana', 'ekran klienta mowi, na czym stoi sprawa');

  const [status, wynik] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, undefined, ciastkoPracownik);
  assert.equal(status, 200);
  assert.equal(wynik.konto_przepiete, true);

  const konto = db().prepare('SELECT * FROM psa_konta WHERE email = ?').get('przepiecie-konta@example.pl');
  assert.equal(konto.rola, 'spolka');
  assert.equal(konto.spolka_id, wynik.spolka_id);

  // Po przyjeciu konto widzi SWOJA spolke...
  const [, mojePo] = await zapytaj('GET', '/api/psa/portal/moje', undefined, ciastkoKlienta);
  assert.equal(mojePo.rola, 'spolka');
  assert.equal(mojePo.spolki.length, 1);
  assert.equal(mojePo.spolki[0].id, wynik.spolka_id);

  // ...i WYLACZNIE swoja: rejestr cudzej spolki zostaje zamkniety.
  const obca = await wnioskGotowyDoWeryfikacji('przepiecie-konta-obca@example.pl');
  const [, daneObcej] = await zapytaj('GET', `/api/psa/wnioski/${obca.wniosekId}`, undefined, ciastkoPracownik);
  await zapytaj(
    'POST', `/api/psa/wnioski/${obca.wniosekId}/akcjonariusze/${daneObcej.akcjonariusze[0].id}/zweryfikuj`,
    { zweryfikowano: true }, ciastkoPracownik
  );
  const [, wynikObcej] = await zapytaj('POST', `/api/psa/wnioski/${obca.wniosekId}/przyjmij`, undefined, ciastkoPracownik);
  // 404, nie 403 — portal celowo nie potwierdza nawet ISTNIENIA cudzej
  // spolki (`wymagajDostepuDoSpolki` w server/trasy/portal.js).
  const [stObca] = await zapytaj('GET', `/api/psa/portal/rejestr/${wynikObcej.spolka_id}`, undefined, ciastkoKlienta);
  assert.equal(stObca, 404, 'konto spolki nie siega do rejestru innej spolki');
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

// ─────────────────────────────────────────────────────────────
// Sprawdzenie dokumentow i potwierdzanie podpisow
// ─────────────────────────────────────────────────────────────

test('POST /api/psa/wnioski/:id/przyjmij: odmawia, dopoki podpisy nie sa potwierdzone', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('podpisy-niepotwierdzone@example.pl', {
    bezPotwierdzenPodpisow: true,
  });
  const [, szczegoly] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  for (const a of szczegoly.akcjonariusze) {
    await zapytaj(
      'POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${a.id}/zweryfikuj`, { zweryfikowano: 1 }, ciastkoPracownik
    );
  }

  const [status, wynik] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, {}, ciastkoPracownik);
  assert.equal(status, 400);
  assert.match(wynik.blad, /potwierdzonego podpisu/);

  // Potwierdzenie kazdej pozycji otwiera droge do przyjecia.
  for (const d of szczegoly.dokumenty) {
    const [stPotw, poPotw] = await zapytaj(
      'POST', `/api/psa/wnioski/${wniosekId}/dokumenty/${d.id}/podpis-potwierdz`, {}, ciastkoPracownik
    );
    assert.equal(stPotw, 200);
    assert.ok(poPotw.dokument.podpis_potwierdzono);
  }
  const [stPrzyjmij] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, {}, ciastkoPracownik);
  assert.equal(stPrzyjmij, 200);
});

test('POST /api/psa/wnioski/:id/dokumenty/:dokId/podpis-potwierdz: bez skanu odmawia', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('potwierdzenie-bez-skanu@example.pl', { bezSkanow: true });
  const [, szczegoly] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  const dokument = szczegoly.dokumenty[0];
  assert.ok(dokument, 'komplet jest wystawiony');
  assert.equal(dokument.podpis_nazwa_pliku, null, 'ale nikt niczego jeszcze nie odesłał');

  const [status, wynik] = await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}/podpis-potwierdz`, {}, ciastkoPracownik
  );
  assert.equal(status, 400);
  assert.match(wynik.blad, /nie odesłał jeszcze skanu/i);
});

test('PUT /api/psa/wnioski/:id/dokumenty/:dokId/tresc: zapis oznacza sprawdzenie, po podpisaniu odmawia', async () => {
  const { wniosekId, ciastkoKlienta } = await wnioskGotowyDoWeryfikacji('tresc-po-podpisie@example.pl', {
    bezSkanow: true,
  });
  const [, szczegoly] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  const dokument = szczegoly.dokumenty.find((d) => d.typ === 'oswiadczenie_rodo');

  const [, tresc] = await zapytaj(
    'GET', `/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}/tresc`, undefined, ciastkoPracownik
  );
  // Zapis BEZ zmiany treści też jest sprawdzeniem — ktoś dokument przeczytał.
  const [stZapis, poZapisie] = await zapytaj(
    'PUT', `/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}/tresc`,
    { bloki: tresc.dokument.bloki }, ciastkoPracownik
  );
  assert.equal(stZapis, 200);
  assert.ok(poZapisie.dokument.sprawdzono, 'zapis zostawia ślad sprawdzenia');
  assert.equal(poZapisie.dokumenty.find((d) => d.id === dokument.id).zmodyfikowano, null,
    'brak zmian w treści nie udaje poprawki');

  // Po odesłaniu podpisanego skanu treść jest zamknięta.
  const formularz = new FormData();
  formularz.append('plik', new Blob(['%PDF-1.4\nskan'], { type: 'application/pdf' }), 'skan.pdf');
  await fetch(`${baza}/api/psa/portal/wniosek/dokumenty/${dokument.id}/podpis`, {
    method: 'POST', headers: { Cookie: ciastkoKlienta }, body: formularz,
  });

  const [stPoPodpisie, wynik] = await zapytaj(
    'PUT', `/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}/tresc`,
    { bloki: tresc.dokument.bloki }, ciastkoPracownik
  );
  assert.equal(stPoPodpisie, 400);
  assert.match(wynik.blad, /podpisany/i);
});

test('Z-205: po potwierdzeniu podpisu kancelaria zapisuje skrot tresci, a klient nie moze juz podmienic ani usunac skanu', async () => {
  const { wniosekId, ciastkoKlienta } = await wnioskGotowyDoWeryfikacji('integralnosc-podpisu@example.pl', {
    bezSkanow: true,
  });
  const [, przedSkanem] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  const dokument = przedSkanem.dokumenty[0];
  assert.equal(dokument.podpis_nazwa_pliku, null);

  const oryginalny = new FormData();
  oryginalny.append('plik', new Blob(['%PDF-1.4\noryginalna tresc'], { type: 'application/pdf' }), 'oryginal.pdf');
  const odpUpload = await fetch(`${baza}/api/psa/portal/wniosek/dokumenty/${dokument.id}/podpis`, {
    method: 'POST', headers: { Cookie: ciastkoKlienta }, body: oryginalny,
  });
  assert.equal(odpUpload.status, 201);

  const [stPotw, poPotw] = await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}/podpis-potwierdz`, {}, ciastkoPracownik
  );
  assert.equal(stPotw, 200);
  assert.ok(poPotw.dokument.podpis_potwierdzono, 'kancelaria potwierdzila podpis');
  const wpisPoPotw = db().prepare('SELECT podpis_hash FROM psa_wnioski_dokumenty WHERE id = ?').get(dokument.id);
  assert.match(wpisPoPotw.podpis_hash, /^[0-9a-f]{64}$/, 'skrot SHA-256 tresci zapisany w chwili potwierdzenia');

  // Proba podmiany JUZ POTWIERDZONEGO skanu — dokladnie scenariusz z audytu.
  const podmieniony = new FormData();
  podmieniony.append('plik', new Blob(['%PDF-1.4\nINNA tresc podsunieta po potwierdzeniu'], { type: 'application/pdf' }), 'podmiana.pdf');
  const odpPodmiana = await fetch(`${baza}/api/psa/portal/wniosek/dokumenty/${dokument.id}/podpis`, {
    method: 'POST', headers: { Cookie: ciastkoKlienta }, body: podmieniony,
  });
  assert.equal(odpPodmiana.status, 400);
  const cialoPodmiany = await odpPodmiana.json();
  assert.match(cialoPodmiany.blad, /już potwierdzon/i);

  // Ani usunac, zeby wgrac na nowo.
  const odpUsun = await fetch(`${baza}/api/psa/portal/wniosek/dokumenty/${dokument.id}/podpis`, {
    method: 'DELETE', headers: { Cookie: ciastkoKlienta },
  });
  assert.equal(odpUsun.status, 400);

  // Skrot i tresc na dysku zostaly te sprzed proby podmiany.
  const wpisPoProbie = db().prepare('SELECT podpis_hash FROM psa_wnioski_dokumenty WHERE id = ?').get(dokument.id);
  assert.equal(wpisPoProbie.podpis_hash, wpisPoPotw.podpis_hash);
});

test('POST /api/psa/wnioski/:id/akcjonariusze/:akcId/do-poprawy: uwaga siada przy pozycji, wniosek wraca do klienta', async () => {
  const { wniosekId } = await wnioskGotowyDoWeryfikacji('pozycja-do-poprawy@example.pl');
  const [, szczegoly] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  const pozycja = szczegoly.akcjonariusze[0];

  const [stPusta] = await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}/do-poprawy`, { uwagi: '  ' }, ciastkoPracownik
  );
  assert.equal(stPusta, 400, 'uwaga bez treści nie mówi klientowi nic');

  const [status, wynik] = await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}/do-poprawy`,
    { uwagi: 'Numer PESEL nie zgadza się z dowodem.' }, ciastkoPracownik
  );
  assert.equal(status, 200);
  assert.equal(wynik.wniosek.status, 'do_uzupelnienia');
  assert.equal(wynik.akcjonariusz.uwagi_kancelarii, 'Numer PESEL nie zgadza się z dowodem.');
  assert.equal(wynik.akcjonariusz.zweryfikowano, 0);
  assert.match(wynik.wniosek.notatka_weryfikacji, /Numer PESEL/);

  // Zweryfikowanie pozycji zamyka uwagę — była pytaniem, a to jest odpowiedź.
  const [, poWeryfikacji] = await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}/zweryfikuj`,
    { zweryfikowano: 1 }, ciastkoPracownik
  );
  assert.equal(poWeryfikacji.akcjonariusz.uwagi_kancelarii, null);
});

test('GET /api/psa/liczniki: licznik "wnioski" obejmuje status "zlozony", nie tylko "umowa_podpisana" (B5)', async () => {
  // "zlozony" czeka na wystawienie dokumentow przez KANCELARIE (STATUSY_WYSTAWIENIA
  // w wnioski.js) - dokladnie to samo "czeka na ruch kancelarii", co komentarz nad
  // zapytaniem SQL deklaruje jako regule licznika. Mierzymy DELTE, nie wartosc
  // bezwzgledna - inne testy w tym pliku juz zostawily w bazie wnioski w stanie
  // "umowa_podpisana", wiec sama obecnosc >=1 niczego by nie dowodzila.
  const hash = await hasla.hashuj('HasloWnioskodawcy123');

  const [, przed] = await zapytaj('GET', '/api/psa/liczniki', undefined, ciastkoPracownik);
  const bazowy = przed.liczniki.wnioski;

  const kontoId = db()
    .prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, aktywne, utworzono) VALUES (?, ?, 'wnioskodawca', 1, ?)`)
    .run('licznik-zlozony@example.pl', hash, new Date().toISOString()).lastInsertRowid;
  db()
    .prepare(`INSERT INTO psa_wnioski (konto_id, status, nazwa, utworzono) VALUES (?, 'zlozony', 'Licznik Zlozony P.S.A.', ?)`)
    .run(kontoId, new Date().toISOString());

  const [status, poZlozonym] = await zapytaj('GET', '/api/psa/liczniki', undefined, ciastkoPracownik);
  assert.equal(status, 200);
  assert.equal(poZlozonym.liczniki.wnioski, bazowy + 1, 'wniosek ze statusem "zlozony" musi podbic licznik o dokladnie 1');

  // "do_uzupelnienia" czeka na KLIENTA, nie kancelarie - NIE powinien podbijac licznika.
  const kontoId2 = db()
    .prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, aktywne, utworzono) VALUES (?, ?, 'wnioskodawca', 1, ?)`)
    .run('licznik-do-uzupelnienia@example.pl', hash, new Date().toISOString()).lastInsertRowid;
  db()
    .prepare(`INSERT INTO psa_wnioski (konto_id, status, nazwa, utworzono) VALUES (?, 'do_uzupelnienia', 'Licznik Do Uzupelnienia P.S.A.', ?)`)
    .run(kontoId2, new Date().toISOString());
  const [, poDrugimWniosku] = await zapytaj('GET', '/api/psa/liczniki', undefined, ciastkoPracownik);
  assert.equal(poDrugimWniosku.liczniki.wnioski, bazowy + 1, '"do_uzupelnienia" czeka na klienta, nie podbija licznika');
});

test('B5 E2E: złożenie wniosku przez PRAWDZIWY endpoint portalu podbija licznik kancelarii', async () => {
  // W odróżnieniu od testu wyżej (status wstawiony wprost do bazy), tu
  // przechodzimy CAŁĄ ścieżkę klienta — logowanie portalowe i
  // `POST /wniosek/zloz` — żeby sprawdzić też, że sama trasa portalu
  // faktycznie ustawia status "zlozony" (nie tylko, że SQL licznika go
  // liczy, gdyby ktoś go tam wstawił). Licznik w app.js odświeża się przy
  // KAŻDEJ nawigacji i co 60 s (`useOdswiezaneDane`, FAZA 1 pkt 9) —
  // odpytanie API tu jest jego dokładnym odpowiednikiem bez czekania.
  const email = 'b5-e2e@example-test.pl';
  const haslo = 'HasloWnioskodawcyE2E1';
  const hash = await hasla.hashuj(haslo);
  const kontoId = db()
    .prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, aktywne, utworzono) VALUES (?, ?, 'wnioskodawca', 1, ?)`)
    .run(email, hash, new Date().toISOString()).lastInsertRowid;
  db()
    .prepare(`INSERT INTO psa_wnioski (konto_id, status, nazwa, kraj, utworzono) VALUES (?, 'w_przygotowaniu', 'B5 E2E P.S.A.', 'Polska', ?)`)
    .run(kontoId, new Date().toISOString());
  const wniosekId = db().prepare('SELECT id FROM psa_wnioski WHERE konto_id = ?').get(kontoId).id;
  db()
    .prepare(
      `INSERT INTO psa_wnioski_akcjonariusze (wniosek_id, kolejnosc, typ, imie, nazwisko, pesel, kod_pocztowy, miejscowosc, ulica, kraj, email, rodzaj_adresu_rejestrowego, utworzono)
       VALUES (@wniosek_id, 0, @typ, @imie, @nazwisko, @pesel, @kod_pocztowy, @miejscowosc, @ulica, 'Polska', @email, 'zamieszkania', @utworzono)`
    )
    .run({ ...AKCJONARIUSZ_PELNY, wniosek_id: wniosekId, utworzono: new Date().toISOString() });

  const odpLogin = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, haslo }),
  });
  assert.equal(odpLogin.status, 200, 'logowanie portalowe klienta z testu B5 nie powiodło się');
  const ciastkoKlienta = ciasteczkoZOdpowiedzi(odpLogin);

  const [, przed] = await zapytaj('GET', '/api/psa/liczniki', undefined, ciastkoPracownik);
  const bazowy = przed.liczniki.wnioski;

  const [statusZlozenia, wynikZlozenia] = await zapytaj('POST', '/api/psa/portal/wniosek/zloz', {}, ciastkoKlienta);
  assert.equal(statusZlozenia, 200, JSON.stringify(wynikZlozenia));
  assert.equal(wynikZlozenia.wniosek.status, 'zlozony');

  const [, po] = await zapytaj('GET', '/api/psa/liczniki', undefined, ciastkoPracownik);
  assert.equal(po.liczniki.wnioski, bazowy + 1, 'złożenie wniosku prawdziwym endpointem portalu musi podbić licznik kancelarii natychmiast');
});

test('B6: pobranie dokumentu przez klienta ustawia ślad pierwszego otwarcia (otwarto_w_portalu)', async () => {
  const { wniosekId, ciastkoKlienta } = await wnioskGotowyDoWeryfikacji('b6-otwarcie@example.pl');
  const [, przed] = await zapytaj('GET', '/api/psa/portal/wniosek/dokumenty', undefined, ciastkoKlienta);
  assert.ok(przed.dokumenty.length > 0, 'komplet dokumentów jest wystawiony');
  assert.ok(
    przed.dokumenty.every((d) => !d.otwarto_w_portalu),
    'przed pierwszym pobraniem żaden dokument nie jest oznaczony jako otwarty'
  );
  const pierwszy = przed.dokumenty[0];

  const odpPobrania = await fetch(`${baza}/api/psa/portal/wniosek/dokumenty/${pierwszy.id}`, {
    headers: { Cookie: ciastkoKlienta },
  });
  assert.equal(odpPobrania.status, 200);

  const [, po] = await zapytaj('GET', '/api/psa/portal/wniosek/dokumenty', undefined, ciastkoKlienta);
  const otwarty = po.dokumenty.find((d) => d.id === pierwszy.id);
  assert.ok(otwarty.otwarto_w_portalu, 'dokument pobrany przez klienta jest oznaczony jako otwarty');
  const inny = po.dokumenty.find((d) => d.id !== pierwszy.id);
  if (inny) assert.ok(!inny.otwarto_w_portalu, 'dokumenty nieotwarte zostają nieotwarte');

  // Ślad ustawia się RAZ — kolejne pobranie tego samego pliku nie zmienia chwili.
  const chwilaPierwsza = otwarty.otwarto_w_portalu;
  await fetch(`${baza}/api/psa/portal/wniosek/dokumenty/${pierwszy.id}`, { headers: { Cookie: ciastkoKlienta } });
  const [, poDrugimPobraniu] = await zapytaj('GET', '/api/psa/portal/wniosek/dokumenty', undefined, ciastkoKlienta);
  assert.equal(
    poDrugimPobraniu.dokumenty.find((d) => d.id === pierwszy.id).otwarto_w_portalu,
    chwilaPierwsza,
    'drugie pobranie nie przesuwa chwili pierwszego otwarcia'
  );
});

test('B8: konto "spolka" po przyjęciu wniosku zakłada KOLEJNY wniosek o drugą spółkę', async () => {
  const email = 'b8-druga-spolka@example.pl';
  const { wniosekId, ciastkoKlienta } = await wnioskGotowyDoWeryfikacji(email, {
    dodatkowePola: { nazwa: 'Pierwsza B8 P.S.A.', krs: '0001112201' },
  });
  const [, dane] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${dane.akcjonariusze[0].id}/zweryfikuj`,
    { zweryfikowano: true }, ciastkoPracownik
  );
  const [, przyjecie] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, undefined, ciastkoPracownik);
  assert.equal(przyjecie.wniosek.status, 'przyjety');
  assert.ok(przyjecie.konto_przepiete, 'konto wnioskodawcy przepięte na rolę spółki przy pierwszym wniosku');

  // Przed "Dodaj spółkę": konto ma jedno powiązanie (pierwsza spółka).
  const [, mojePrzed] = await zapytaj('GET', '/api/psa/portal/moje', undefined, ciastkoKlienta);
  assert.equal(mojePrzed.rola, 'spolka');
  assert.equal(mojePrzed.spolki.length, 1);
  assert.equal(mojePrzed.wniosek, null, 'bez wniosku w toku, dopoki nikt nie kliknie "Dodaj spółkę"');

  // "Dodaj spółkę" — nowy wniosek, konto zostaje w roli "spolka".
  const [statusNowy, nowy] = await zapytaj('POST', '/api/psa/portal/wniosek/nowy', {}, ciastkoKlienta);
  assert.equal(statusNowy, 201, JSON.stringify(nowy));
  assert.equal(nowy.wniosek.status, 'w_przygotowaniu');
  assert.notEqual(nowy.wniosek.id, wniosekId, 'to NOWY wiersz, nie ten sam co pierwsza spółka');

  // GET /wniosek (l. pojedyncza — "aktywny" wniosek) trafia w NOWY, nie w stary/przyjęty.
  const [, aktywny] = await zapytaj('GET', '/api/psa/portal/wniosek', undefined, ciastkoKlienta);
  assert.equal(aktywny.wniosek.id, nowy.wniosek.id);

  // GET /wnioski (l. mnoga) — obie spółki, z ich statusami.
  const [, lista] = await zapytaj('GET', '/api/psa/portal/wnioski', undefined, ciastkoKlienta);
  assert.equal(lista.wnioski.length, 2);
  const statusy = lista.wnioski.map((w) => w.status).sort();
  assert.deepEqual(statusy, ['przyjety', 'w_przygotowaniu']);
  const stary = lista.wnioski.find((w) => w.id === wniosekId);
  assert.equal(stary.reprezentant_imie_nazwisko, 'Jan Kowalski', 'dane reprezentanta z pierwszego wniosku dostępne do skopiowania');

  // Drugi "Dodaj spółkę" naraz jest odrzucany — dokończ, zanim zaczniesz kolejny.
  const [statusDrugi, drugi] = await zapytaj('POST', '/api/psa/portal/wniosek/nowy', {}, ciastkoKlienta);
  assert.equal(statusDrugi, 400, JSON.stringify(drugi));

  // Nowy wniosek jest edytowalny — PUT nie odbija się o stary, przyjęty wiersz.
  const [statusPut, poPut] = await zapytaj('PUT', '/api/psa/portal/wniosek', { nazwa: 'Druga B8 P.S.A.' }, ciastkoKlienta);
  assert.equal(statusPut, 200, JSON.stringify(poPut));
  assert.equal(poPut.wniosek.id, nowy.wniosek.id);
  assert.equal(poPut.wniosek.nazwa, 'Druga B8 P.S.A.');

  // "Moje spółki" widzi teraz wniosek w toku obok istniejącej spółki.
  const [, mojePo] = await zapytaj('GET', '/api/psa/portal/moje', undefined, ciastkoKlienta);
  assert.equal(mojePo.spolki.length, 1);
  assert.ok(mojePo.wniosek, 'wniosek o drugą spółkę widoczny jako "w toku"');
  assert.equal(mojePo.wniosek.id, nowy.wniosek.id);
});

test('B8: wnioskodawca (jeszcze bez żadnej spółki) nie może użyć "Dodaj spółkę"', async () => {
  const hash = await hasla.hashuj('HasloWnioskodawcyB8');
  db()
    .prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, aktywne, utworzono) VALUES (?, ?, 'wnioskodawca', 1, ?)`)
    .run('b8-wnioskodawca@example.pl', hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'b8-wnioskodawca@example.pl', haslo: 'HasloWnioskodawcyB8' }),
  });
  const ciastko = ciasteczkoZOdpowiedzi(odpLogin);
  const [status, wynik] = await zapytaj('POST', '/api/psa/portal/wniosek/nowy', {}, ciastko);
  assert.equal(status, 400, JSON.stringify(wynik));
});

test('B9: zgłoszenie nieprawidłowości — odrębne od żądania wpisu, kancelaria kwalifikuje', async () => {
  const email = 'b9-zgloszenie@example.pl';
  const { wniosekId, ciastkoKlienta } = await wnioskGotowyDoWeryfikacji(email);
  const [, dane] = await zapytaj('GET', `/api/psa/wnioski/${wniosekId}`, undefined, ciastkoPracownik);
  await zapytaj(
    'POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${dane.akcjonariusze[0].id}/zweryfikuj`,
    { zweryfikowano: true }, ciastkoPracownik
  );
  const [, przyjecie] = await zapytaj('POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, undefined, ciastkoPracownik);
  const spolkaId = przyjecie.spolka_id;

  // Cudza spółka jest odrzucana (D3) — konto klienta nie zgłasza dla obcej spółki.
  const [statusObca] = await zapytaj(
    'POST', '/api/psa/portal/zgloszenie-nieprawidlowosci',
    { spolka_id: 999999, czego_dotyczy: 'inne', opis: 'test' }, ciastkoKlienta
  );
  assert.equal(statusObca, 404);

  const [statusZgloszenia, zgloszenie] = await zapytaj(
    'POST', '/api/psa/portal/zgloszenie-nieprawidlowosci',
    { spolka_id: spolkaId, czego_dotyczy: 'blad_w_danych', opis: 'Literówka w nazwisku akcjonariusza.' }, ciastkoKlienta
  );
  assert.equal(statusZgloszenia, 201, JSON.stringify(zgloszenie));
  assert.equal(zgloszenie.zgloszenie.stan, 'nowe');

  // Klient widzi je w swojej liście, ze stanem "czeka na kancelarię".
  const [, mojeZgloszenia] = await zapytaj('GET', '/api/psa/portal/zgloszenia-nieprawidlowosci', undefined, ciastkoKlienta);
  assert.equal(mojeZgloszenia.zgloszenia.length, 1);
  assert.equal(mojeZgloszenia.zgloszenia[0].stan, 'nowe');

  // Kancelaria widzi je w kolejce i kwalifikuje jako sprostowanie.
  const [, kolejka] = await zapytaj('GET', '/api/psa/zgloszenia-nieprawidlowosci', undefined, ciastkoPracownik);
  const wKolejce = kolejka.zgloszenia.find((z) => z.id === zgloszenie.zgloszenie.id);
  assert.ok(wKolejce);
  assert.equal(wKolejce.konto_email, email);

  const [statusKwalifikacji, poKwalifikacji] = await zapytaj(
    'POST', `/api/psa/zgloszenia-nieprawidlowosci/${zgloszenie.zgloszenie.id}/kwalifikuj`,
    { kwalifikacja: 'sprostowanie', notatka: 'Poprawię nazwisko sprostowaniem.' }, ciastkoPracownik
  );
  assert.equal(statusKwalifikacji, 200);
  assert.equal(poKwalifikacji.zgloszenie.stan, 'zakwalifikowane');
  assert.equal(poKwalifikacji.zgloszenie.kwalifikacja, 'sprostowanie');

  // Klient widzi wynik.
  const [, mojePoKwalifikacji] = await zapytaj('GET', '/api/psa/portal/zgloszenia-nieprawidlowosci', undefined, ciastkoKlienta);
  assert.equal(mojePoKwalifikacji.zgloszenia[0].kwalifikacja, 'sprostowanie');

  // Zgłoszenie NIE zakłada sprawy/wpisu — pozostaje osobne od psa_sprawy.
  const sprawy = db().prepare('SELECT COUNT(*) AS n FROM psa_sprawy WHERE spolka_id = ?').get(spolkaId);
  assert.equal(sprawy.n, 0, 'kwalifikacja jako sprostowanie NIE zakłada automatycznie sprawy — robi to pracownik w kreatorze');
});
