'use strict';

/**
 * Faza 3 (SESJA-PSA-WYTYCZNE.md): zgody i powiadomienia (W4.1–W4.5), dostęp
 * i informacje (W5.1–W5.7), pozostałe (W6.1–W6.5).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const zlib = require('node:zlib');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-faza3.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-faza3-dok');
process.env.PORTAL_WLACZONY = 'true';
delete process.env.PSA_TRYB_TESTOWY;

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');
const czas = require('../server/pomocnicze/czas');
const rejestr = require('../server/rejestr');
const zip = require('../server/logika/zip');

let serwer;
let ADRES;
let prac;
const S = {};

function ciastko(odp) {
  return odp.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}
async function zapytaj(metoda, sciezka, cialo, kto = prac) {
  const odp = await fetch(`${ADRES}${sciezka}`, {
    method: metoda,
    headers: { 'Content-Type': 'application/json', Cookie: kto },
    body: cialo === undefined ? undefined : JSON.stringify(cialo),
  });
  const typ = odp.headers.get('content-type') || '';
  return [odp.status, typ.includes('json') ? await odp.json() : await odp.arrayBuffer()];
}

test.before(async () => {
  serwer = app.listen(0);
  await new Promise((r) => serwer.once('listening', r));
  ADRES = `http://127.0.0.1:${serwer.address().port}`;
  const hash = await hasla.hashuj('HasloTestowe123');
  const teraz = czas.terazIso();
  db().prepare(`INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono) VALUES ('Admin', 'admin-f3@example.pl', ?, 'admin', 1, ?)`).run(hash, teraz);
  const l = await fetch(`${ADRES}/api/psa/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin-f3@example.pl', haslo: 'HasloTestowe123' }) });
  prac = ciastko(l);

  S.spolkaId = Number(db().prepare(`INSERT INTO psa_spolki (nazwa, krs, email, forma_prawna, status, data_umowy, utworzono) VALUES ('Faza Trzy P.S.A.', '0000300300', 'spolka@example.pl', 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', '2026-01-02', ?)`).run(teraz).lastInsertRowid);
  const osoba = (imie, nazwisko, zgoda, email) => Number(db().prepare(
    `INSERT INTO psa_osoby (typ, imie, nazwisko, data_urodzenia, kod_pocztowy, miejscowosc, ulica, nr_domu, email, zgoda_email_status, aml_status, utworzono)
     VALUES ('fizyczna', ?, ?, '1980-01-01', '80-001', 'Gdańsk', 'Rejestrowa', '7', ?, ?, 'wykonane', ?)`
  ).run(imie, nazwisko, email, zgoda, teraz).lastInsertRowid);
  S.bezZgody = osoba('Bogdan', 'Bezzgody', 'brak', 'bogdan@example.pl');
  S.zeZgoda = osoba('Zofia', 'Zgodna', 'potwierdzona', 'zofia@example.pl');
  S.nabywca = osoba('Norbert', 'Nabywca', 'brak', null);
  const emisja = rejestr.dokonajWpisu(db(), { spolkaId: S.spolkaId, typ: 'emisja', wejscie: { seria: 'A', ilosc: 100, data_wpisu_krs: '2026-01-02' }, autor: 'Test' });
  S.emisjaId = emisja.zdarzenie.id;
  rejestr.dokonajWpisu(db(), { spolkaId: S.spolkaId, typ: 'objecie', wejscie: { emisja_zdarzenie_id: S.emisjaId, pozycje: [{ osoba_id: S.bezZgody, ilosc: 60 }, { osoba_id: S.zeZgoda, ilosc: 40 }] }, autor: 'Test' });

  db().prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, osoba_id, aktywne, utworzono) VALUES ('zofia@example.pl', ?, 'akcjonariusz', ?, 1, ?)`).run(hash, S.zeZgoda, teraz);
  const k = await fetch(`${ADRES}/api/psa/portal/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'zofia@example.pl', haslo: 'HasloTestowe123' }) });
  S.portalZofia = ciastko(k);
});

test.after(() => {
  serwer.close();
  czas.ustawPrzesuniecie(0);
  for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

async function sprawaZbycia() {
  const [, z] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: S.spolkaId, typ_zdarzenia: 'przeniesienie', zrodlo: 'papier', zadajacy_osoba_id: S.nabywca, zadajacy_rola: 'nabywca',
  });
  await zapytaj('PATCH', `/api/psa/sprawy/${z.sprawa.id}`, { akcja: 'weryfikuj' });
  return z.sprawa.id;
}

test('W4.3/W4.4: powiadomienie zbywcy bez zgody → list na adres z rejestru (nie z żądania); nadanie odblokowuje wpis', async () => {
  const sprawaId = await sprawaZbycia();
  const [st, wynik] = await zapytaj('POST', `/api/psa/sprawy/${sprawaId}/powiadomienie`, {
    osoba_id: S.bezZgody, email: 'podstawiony@example.com', adres: 'ul. Podstawiona 1, 00-000 Gdzieś',
  });
  assert.equal(st, 200);
  assert.equal(wynik.wysylka.status, 'list');
  const list = db().prepare('SELECT * FROM psa_listy WHERE id = ?').get(wynik.wysylka.list_id);
  assert.equal(list.adres, 'Rejestrowa 7, 80-001 Gdańsk', 'adres wyłącznie z rejestru');
  assert.doesNotMatch(list.adres, /Podstawiona/);
  const [, sprawaPrzed] = await zapytaj('GET', `/api/psa/sprawy/${sprawaId}`);
  assert.ok(sprawaPrzed.sprawa.blokada_wpisu, 'do nadania listu wpis zablokowany (W2.3)');

  const [stBrak] = await fetch(`${ADRES}/api/psa/listy/${list.id}/nadanie`, { method: 'POST', headers: { Cookie: prac }, body: new FormData() }).then((r) => [r.status]);
  assert.equal(stBrak, 400, 'bez daty i numeru nadania — odmowa');
  const f = new FormData();
  f.append('data_nadania', czas.dzisIso());
  f.append('numer_nadania', 'RR123456789PL');
  f.append('potwierdzenie', new Blob([Buffer.from('%PDF-1.4 potwierdzenie')], { type: 'application/pdf' }), 'potwierdzenie.pdf');
  const nad = await fetch(`${ADRES}/api/psa/listy/${list.id}/nadanie`, { method: 'POST', headers: { Cookie: prac }, body: f });
  assert.equal(nad.status, 200);
  const [, sprawaPo] = await zapytaj('GET', `/api/psa/sprawy/${sprawaId}`);
  assert.equal(sprawaPo.sprawa.blokada_wpisu, null, 'po nadaniu powiadomienie uznane za wysłane');
  const [, pismo] = await zapytaj('GET', `/api/psa/listy/${list.id}/pismo`);
  assert.match(Buffer.from(pismo).toString('utf8'), /Rejestrowa 7/);
  const [, liczniki] = await zapytaj('GET', '/api/psa/liczniki');
  assert.equal(liczniki.liczniki.listy, 0);
});

test('W4.3: osoba ze zgodą potwierdzoną — pismo e-mailem (nie do kolejki listów)', async () => {
  const sprawaId = await sprawaZbycia();
  const [, wynik] = await zapytaj('POST', `/api/psa/sprawy/${sprawaId}/powiadomienie`, { osoba_id: S.zeZgoda });
  assert.notEqual(wynik.wysylka.status, 'list');
});

test('W4.5: zawiadomienie o odmowie — do żądającego i do spółki', async () => {
  const sprawaId = await sprawaZbycia();
  const [st] = await zapytaj('PATCH', `/api/psa/sprawy/${sprawaId}`, { akcja: 'odmow', powod_odmowy_kod: 'inna', powod_odmowy: 'Brak dokumentu zbycia.' });
  assert.equal(st, 200);
  const pisma = db().prepare("SELECT * FROM psa_wydane_dokumenty WHERE sprawa_id = ? AND typ = 'zawiadomienie_odmowa'").all(sprawaId);
  assert.equal(pisma.length, 2, 'żądający + spółka');
  assert.ok(pisma.some((p) => p.odbiorca_osoba_id === null), 'egzemplarz dla spółki');
  assert.equal(db().prepare("SELECT COUNT(*) AS n FROM psa_oplaty WHERE sprawa_id = ? AND typ != 'wpis'").get(sprawaId).n, 0, 'bezpłatnie');
});

test('W5.3/W5.6: informacja dla organu — sygnatura obowiązkowa, numer, wpis do dziennika', async () => {
  const [stBez] = await zapytaj('POST', '/api/psa/informacje/organ', { spolka_id: S.spolkaId, organ: 'Komornik Sądowy' });
  assert.equal(stBez, 400);
  const [st, wynik] = await zapytaj('POST', '/api/psa/informacje/organ', { spolka_id: S.spolkaId, organ: 'Komornik Sądowy przy SR w Gdańsku', sygnatura: 'KM 12/26' });
  assert.equal(st, 201);
  assert.match(wynik.numer, /^INF\/\d{4}\/0001$/);
  const [, dziennik] = await zapytaj('GET', '/api/psa/informacje');
  const poz = dziennik.informacje.find((i) => i.id === wynik.dokument_id);
  assert.equal(poz.odbiorca, 'Komornik Sądowy przy SR w Gdańsku');
  assert.equal(poz.sygnatura, 'KM 12/26');
  assert.equal(poz.oplata_opis, 'nie pobrano');
  const [, html] = await zapytaj('GET', `/api/psa/informacje/${wynik.dokument_id}`);
  const tekst = Buffer.from(html).toString('utf8');
  assert.match(tekst, /Numer informacji: <strong>INF\//);
  assert.match(tekst, /nie pobrano/);
});

test('W5.7 / D-085: stawki stałe do zmiany przez notariusza; każda zmiana zostaje w historii wersji', async () => {
  const ustawienia = require('../server/logika/ustawienia');
  const [st] = await zapytaj('PUT', '/api/psa/ustawienia', { stawka_wpis: '8000' });
  assert.equal(st, 200);
  const spolka = db().prepare('SELECT * FROM psa_spolki WHERE id = ?').get(S.spolkaId);
  assert.equal(ustawienia.stawkaGrosze(db(), 'wpis'), 8000);
  assert.equal(ustawienia.stawkaGrosze(db(), 'wpis', { spolka }), 8000, 'bez osobnego mechanizmu gwarancji');
  const [, ekran] = await zapytaj('GET', '/api/psa/ustawienia');
  assert.ok(ekran.wersje_stawek.length >= 2, 'historia zmian stawek');
  await zapytaj('PUT', '/api/psa/ustawienia', { stawka_wpis: '' });
});

test('W4.1/W4.2 (D-092): oświadczenia osobiste — działają od razu, bez wpisu w rejestrze i bez opłaty; odwołalne', async () => {
  const [st1] = await zapytaj('POST', '/api/psa/portal/oswiadczenia', { spolka_id: S.spolkaId, rodzaj: 'powiadomienia_automatyczne', zlozone: true }, S.portalZofia);
  assert.equal(st1, 201);
  const sprawPrzed = db().prepare('SELECT COUNT(*) AS n FROM psa_sprawy').get().n;
  const [st2, cof] = await zapytaj('POST', '/api/psa/portal/oswiadczenia', { spolka_id: S.spolkaId, rodzaj: 'zgoda_email', zlozone: false }, S.portalZofia);
  assert.equal(st2, 201);
  assert.equal(cof.stan.zgodaEmail, false, 'cofnięcie działa od razu (dane kartoteki)');
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM psa_sprawy').get().n, sprawPrzed, 'bez sprawy wpisu');
  const [, stan] = await zapytaj('GET', '/api/psa/portal/oswiadczenia', undefined, S.portalZofia);
  assert.equal(stan.spolki[0].powiadomienia_automatyczne.zlozone, 1);
  assert.throws(() => db().prepare('DELETE FROM psa_oswiadczenia').run(), /append-only/);
  // Przywrócenie zgody (kolejne testy zakładają, że Zofia ma zgodę).
  const [st3] = await zapytaj('POST', '/api/psa/portal/oswiadczenia', { spolka_id: S.spolkaId, rodzaj: 'zgoda_email', zlozone: true, email: 'zofia@example.pl' }, S.portalZofia);
  assert.equal(st3, 201);
});

test('W6.2/W6.5: zadania z terminem dopiero od 18.02.2027 (symulowana data); projekt przypomnienia o KRS', async () => {
  const [, przed] = await zapytaj('GET', '/api/psa/pulpit');
  assert.deepEqual(przed.zadania_terminowe, []);
  const cel = new Date(2027, 2, 1, 12, 0, 0).getTime();
  czas.ustawPrzesuniecie(cel - Date.now());
  try {
    const [, po] = await zapytaj('GET', '/api/psa/pulpit');
    const krs = po.zadania_terminowe.find((z) => z.rodzaj === 'przypomnienie_krs' && z.spolka_id === S.spolkaId);
    assert.ok(krs, 'zadanie przypomnienia o zgłoszeniu do KRS');
    assert.equal(krs.termin, '2027-05-18');
    const [st, projekt] = await zapytaj('POST', `/api/psa/spolki/${S.spolkaId}/przypomnienie-krs`, {});
    assert.equal(st, 200);
    assert.match(projekt.tresc_html, /PROJEKT — do akceptacji Łukasza/);
    const [, poProjekcie] = await zapytaj('GET', '/api/psa/pulpit');
    assert.ok(!poProjekcie.zadania_terminowe.some((z) => z.klucz === krs.klucz), 'zadanie znika po przygotowaniu projektu');
  } finally {
    czas.ustawPrzesuniecie(0);
  }
});

test('W6.3: eksport całego rejestru (ZIP) — README, informacja, historia z łańcuchem, dokumenty; ślad w dzienniku', async () => {
  const [st, bufor] = await zapytaj('GET', `/api/psa/spolki/${S.spolkaId}/eksport.zip`);
  assert.equal(st, 200);
  const wpisy = zip.czytaj(Buffer.from(bufor));
  const nazwy = wpisy.map((w) => w.nazwa);
  for (const n of ['README.txt', 'informacja-z-rejestru.html', 'historia-zdarzen.csv', 'historia-zdarzen.json']) assert.ok(nazwy.includes(n), n);
  assert.ok(nazwy.some((n) => n.startsWith('dokumenty/potwierdzenia-nadania/')), 'potwierdzenie nadania w archiwum');
  const historia = JSON.parse(zip.rozpakuj(wpisy.find((w) => w.nazwa === 'historia-zdarzen.json')).toString('utf8'));
  assert.ok(historia.every((z) => /^[0-9a-f]{64}$/.test(z.hash)));
  assert.ok(db().prepare("SELECT 1 FROM psa_dziennik_dostepu WHERE akcja = 'eksport' AND spolka_id = ?").get(S.spolkaId));
  assert.ok(zlib);
});

test('W6.4: brak automatycznego usuwania — usuwanie plików tylko w znanych miejscach wywoływanych przez użytkownika', () => {
  const dozwolone = new Set([
    'logika/pakiet-wniosku.js', // ponowne wystawienie kompletu przed podpisem (kancelaria)
    'trasy/portal.js', // podmiana/usunięcie własnego pliku przez klienta przed odesłaniem, odrzucony upload
    'trasy/sprawy.js', // sprzątanie po nieudanym uploadzie
    'trasy/osoby.js', // odrzucony upload skanu AML (treść ≠ rozszerzenie)
    'trasy/spolki.js', // odrzucony upload załącznika umowy (treść ≠ rozszerzenie)
  ]);
  const katalog = path.join(__dirname, '..', 'server');
  const znalezione = [];
  (function przejdz(k) {
    for (const n of fs.readdirSync(k, { withFileTypes: true })) {
      const p = path.join(k, n.name);
      if (n.isDirectory()) przejdz(p);
      else if (n.name.endsWith('.js') && /\b(rmSync|unlinkSync|unlink|rmdirSync)\s*\(/.test(fs.readFileSync(p, 'utf8'))) {
        znalezione.push(path.relative(katalog, p).split(path.sep).join('/'));
      }
    }
  })(katalog);
  assert.deepEqual(znalezione.filter((f) => !dozwolone.has(f)), [], 'nowe miejsce usuwania plików wymaga świadomej decyzji (W6.4)');
  const harmonogram = fs.readFileSync(path.join(katalog, 'logika', 'harmonogram.js'), 'utf8');
  assert.doesNotMatch(harmonogram, /DELETE FROM|rmSync|unlink/, 'harmonogram niczego nie usuwa');
});

test('QW2 / D-083: przy żądaniu automatycznych powiadomień — dodatkowo kopia pisma w portalu (obok e-maila albo listu)', async () => {
  const sprawaId = await sprawaZbycia();
  db().prepare(`INSERT INTO psa_oswiadczenia (osoba_id, spolka_id, rodzaj, zlozone, utworzono) VALUES (?, ?, 'powiadomienia_automatyczne', 1, ?)`)
    .run(S.bezZgody, S.spolkaId, czas.terazIso());
  const [, wynik] = await zapytaj('POST', `/api/psa/sprawy/${sprawaId}/powiadomienie`, { osoba_id: S.bezZgody });
  assert.equal(wynik.wysylka.status, 'list', 'list nadal idzie');
  const kopia = db().prepare('SELECT * FROM psa_wydane_dokumenty WHERE id = ?').get(wynik.wysylka.kopia_portal_id);
  assert.equal(kopia.kanal, 'portal');
  assert.equal(kopia.odbiorca_osoba_id, S.bezZgody);
});

test('QW3 / D-083: akcjonariusz bez zgody na e-mail nie loguje się do portalu', async () => {
  const hash = await hasla.hashuj('HasloTestowe123');
  db().prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, osoba_id, aktywne, utworzono) VALUES ('bogdan@example.pl', ?, 'akcjonariusz', ?, 1, ?)`)
    .run(hash, S.bezZgody, czas.terazIso());
  const odp = await fetch(`${ADRES}/api/psa/portal/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'bogdan@example.pl', haslo: 'HasloTestowe123' }) });
  assert.equal(odp.status, 401);
  assert.match((await odp.json()).blad, /Bez zgody na komunikację e-mail dostęp do portalu jest wyłączony/);
});
