'use strict';

/**
 * Testy integracyjne workflow spraw przez HTTP (sekcja 7 i 8 specyfikacji):
 * zalozenie sprawy, przejscia stanow, wpis, upload dokumentow, sprostowanie.
 *
 * Kazdy plik testowy `node --test` dostaje wlasny proces, wiec ustawienie
 * `WSPOLNA_BAZA` PRZED pierwszym `require` z `server/*` bezpiecznie izoluje
 * baze tego pliku od pozostalych testow.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-sprawy-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-sprawy-dokumenty');
fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');

let serwer;
let baza;
let ciastkoSesji = '';

/** Loguje sie jako pracownik testowy i zwraca naglowek `Cookie` do dalszych zadan. */
function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  const hash = await hasla.hashuj('HasloTestowe123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Łukasz Kozon', 'notariusz@example-test.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());

  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz@example-test.pl', haslo: 'HasloTestowe123' }),
  });
  if (odpLogin.status !== 200) throw new Error(`Logowanie testowe nie powiodło się: ${odpLogin.status}`);
  ciastkoSesji = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

const AUTOR = () => ({ Cookie: ciastkoSesji });

async function zapytaj(metoda, sciezka, cialo) {
  const opcje = { method: metoda, headers: { ...AUTOR() } };
  if (cialo !== undefined) {
    opcje.headers['Content-Type'] = 'application/json';
    opcje.body = JSON.stringify(cialo);
  }
  const odp = await fetch(baza + sciezka, opcje);
  const dane = await odp.json();
  return [odp.status, dane];
}

let licznikDanych = 0;

/** Zestaw danych: spolka + emisja 100 akcji objeta w calosci przez Kowalskiego. */
async function przygotujSpolke() {
  licznikDanych += 1;
  const sufiks = String(licznikDanych).padStart(4, '0');

  const [, spolkaOdp] = await zapytaj('POST', '/api/psa/spolki', {
    nazwa: `Testowa Sprawy P.S.A. ${sufiks}`,
    krs: `0000${sufiks}00`,
  });
  const spolkaId = spolkaOdp.spolka.id;

  const [, kowalski] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: 'Kowalski', imie: `Jan${sufiks}`,
    data_urodzenia: '1980-01-01', email: `jan.kowalski.${sufiks}@example.pl`, aml_status: 'wykonane',
  });
  const [, nowak] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: 'Nowak', imie: `Anna${sufiks}`,
    data_urodzenia: '1985-05-05', email: `anna.nowak.${sufiks}@example.pl`, aml_status: 'wykonane',
  });

  const [, emisja] = await zapytaj('POST', `/api/psa/spolki/${spolkaId}/zdarzenia`, {
    typ: 'emisja', data_zdarzenia: '2026-01-10',
    dane: { seria: 'A', ilosc: 100 },
  });
  await zapytaj('POST', `/api/psa/spolki/${spolkaId}/zdarzenia`, {
    typ: 'objecie', data_zdarzenia: '2026-01-10',
    dane: { emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: kowalski.osoba.id, ilosc: 100 }] },
  });

  return { spolkaId, kowalski: kowalski.osoba, nowak: nowak.osoba, emisjaZdarzenieId: emisja.zdarzenie.id };
}

test('pelny cykl sprawy: nowa → weryfikacja → wpisana, z zawiadomieniem bez SMTP', async () => {
  const { spolkaId, kowalski, nowak, emisjaZdarzenieId } = await przygotujSpolke();

  const [stZal, sprawaOdp] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', zrodlo: 'papier',
    zadajacy_osoba_id: kowalski.id, zadajacy_opis: 'Zbywca akcji',
  });
  assert.equal(stZal, 201);
  assert.equal(sprawaOdp.sprawa.stan, 'nowa');
  assert.equal(sprawaOdp.sprawa.termin.dni_pozostale, 7);
  const sprawaId = sprawaOdp.sprawa.id;

  const [stWer] = await zapytaj('PATCH', `/api/psa/sprawy/${sprawaId}`, { akcja: 'weryfikuj' });
  assert.equal(stWer, 200);

  const [stPod, podgladOdp] = await zapytaj('POST', `/api/psa/sprawy/${sprawaId}/podglad`, {
    data_zdarzenia: '2026-02-01',
    dane: { emisja_zdarzenie_id: emisjaZdarzenieId, zbywca_osoba_id: kowalski.id, pozycje: [{ nabywca_osoba_id: nowak.id, ilosc: 40 }] },
  });
  assert.equal(stPod, 200);
  assert.equal(podgladOdp.dopuszczalne, true);

  const [stWpis, wpisOdp] = await zapytaj('POST', `/api/psa/sprawy/${sprawaId}/wpisz`, {
    data_zdarzenia: '2026-02-01',
    dane: { emisja_zdarzenie_id: emisjaZdarzenieId, zbywca_osoba_id: kowalski.id, pozycje: [{ nabywca_osoba_id: nowak.id, ilosc: 40 }] },
  });
  assert.equal(stWpis, 201);
  assert.equal(wpisOdp.sprawa.stan, 'wpisana');
  assert.equal(wpisOdp.sprawa.zdarzenie_id, wpisOdp.zdarzenie.id);

  // Zawiadomienia probowaly sie wyslac (SMTP nieskonfigurowany w testach),
  // ale slad w psa_wydane_dokumenty i tak powstal - do zadajacego i spolki.
  assert.equal(wpisOdp.powiadomienia.length, 2);
  assert.equal(wpisOdp.powiadomienia.every((p) => p.wyslano === false), true);
  assert.match(wpisOdp.powiadomienia[0].powod, /SMTP|e-mail/i);

  const [, sprawaSzczegol] = await zapytaj('GET', `/api/psa/sprawy/${sprawaId}`);
  assert.equal(sprawaSzczegol.wydane_dokumenty.length, 2);
  assert.equal(sprawaSzczegol.wydane_dokumenty[0].typ, 'zawiadomienie_wpis');

  const [, kokpit] = await zapytaj('GET', `/api/psa/spolki/${spolkaId}`);
  const akcjonariat = new Map(kokpit.akcjonariusze.map((a) => [a.osoba.id, a.ilosc]));
  assert.equal(akcjonariat.get(kowalski.id), 60);
  assert.equal(akcjonariat.get(nowak.id), 40);
});

test('nie mozna dokonac wpisu przed przejsciem sprawy do weryfikacji', async () => {
  const { spolkaId, kowalski } = await przygotujSpolke();
  const [, sprawaOdp] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'umorzenie', zrodlo: 'email', zadajacy_osoba_id: kowalski.id,
  });
  const [status, odp] = await zapytaj('POST', `/api/psa/sprawy/${sprawaOdp.sprawa.id}/wpisz`, {
    data_zdarzenia: '2026-02-01',
    dane: { emisja_zdarzenie_id: 1, pozycje: [{ osoba_id: kowalski.id, ilosc: 10 }] },
  });
  assert.equal(status, 422);
  assert.match(odp.bledy.join(' '), /stanu „weryfikacja”/);
});

test('wstrzymanie zamraza termin, wznowienie liczy pelne 7 dni od nowa i wysyla wezwanie', async () => {
  const { spolkaId, kowalski } = await przygotujSpolke();
  const [, sprawaOdp] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'umorzenie', zrodlo: 'papier', zadajacy_osoba_id: kowalski.id,
  });
  const sprawaId = sprawaOdp.sprawa.id;
  await zapytaj('PATCH', `/api/psa/sprawy/${sprawaId}`, { akcja: 'weryfikuj' });

  const [stWstrz, wstrzOdp] = await zapytaj('PATCH', `/api/psa/sprawy/${sprawaId}`, {
    akcja: 'wstrzymaj', powod: 'Brak uchwały o umorzeniu.',
  });
  assert.equal(stWstrz, 200);
  assert.equal(wstrzOdp.sprawa.stan, 'wstrzymana');
  assert.equal(wstrzOdp.sprawa.termin.zamrozony, true);
  assert.equal(wstrzOdp.wysylka.wyslano, false, 'brak SMTP - wezwanie zapisane, nie wyslane');

  const [, wznOdp] = await zapytaj('PATCH', `/api/psa/sprawy/${sprawaId}`, { akcja: 'wznow' });
  assert.equal(wznOdp.sprawa.stan, 'weryfikacja');
  assert.equal(wznOdp.sprawa.termin.dni_pozostale, 7, 'pełne 7 dni od dnia wznowienia');

  const [, szczegol] = await zapytaj('GET', `/api/psa/sprawy/${sprawaId}`);
  assert.equal(szczegol.wydane_dokumenty.some((d) => d.typ === 'wezwanie'), true);
});

test('odmowa wpisu wymaga przyczyny i wysyla zawiadomienie do zadajacego', async () => {
  const { spolkaId, kowalski } = await przygotujSpolke();
  const [, sprawaOdp] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'umorzenie', zrodlo: 'email', zadajacy_osoba_id: kowalski.id,
  });
  const sprawaId = sprawaOdp.sprawa.id;
  await zapytaj('PATCH', `/api/psa/sprawy/${sprawaId}`, { akcja: 'weryfikuj' });

  const [stBrak, brakOdp] = await zapytaj('PATCH', `/api/psa/sprawy/${sprawaId}`, { akcja: 'odmow' });
  assert.equal(stBrak, 400);
  assert.match(brakOdp.blad, /przyczyny/);

  const [stOdm, odmOdp] = await zapytaj('PATCH', `/api/psa/sprawy/${sprawaId}`, {
    akcja: 'odmow', powod_odmowy: 'Brak wymaganej uchwały o umorzeniu.',
  });
  assert.equal(stOdm, 200);
  assert.equal(odmOdp.sprawa.stan, 'odmowa');
  assert.equal(odmOdp.sprawa.powod_odmowy, 'Brak wymaganej uchwały o umorzeniu.');
  assert.equal(odmOdp.wysylka.wyslano, false);
});

test('zajecie (z urzedu) zaklada sprawe od razu w weryfikacji, bez zadajacego', async () => {
  const { spolkaId, kowalski, emisjaZdarzenieId } = await przygotujSpolke();
  const [, komornik] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'prawna', nazwa: 'Komornik Sądowy przy SR', nazwisko: null,
  });

  const [stZal, sprawaOdp] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'zajecie', zrodlo: 'z_urzedu',
  });
  assert.equal(stZal, 201);
  assert.equal(sprawaOdp.sprawa.stan, 'weryfikacja', 'z urzedu pomija fazę „nowa”');

  const [stWpis, wpisOdp] = await zapytaj('POST', `/api/psa/sprawy/${sprawaOdp.sprawa.id}/wpisz`, {
    data_zdarzenia: '2026-02-01',
    dane: {
      emisja_zdarzenie_id: emisjaZdarzenieId,
      akcjonariusz_osoba_id: kowalski.id,
      osoba_id: komornik.osoba.id,
      ilosc: 15,
    },
  });
  assert.equal(stWpis, 201);
  // Brak zadajacego -> tylko jedno zawiadomienie, do spolki.
  assert.equal(wpisOdp.powiadomienia.length, 1);
  assert.equal(wpisOdp.powiadomienia[0].odbiorca, 'spółka');
});

test('nie mozna zalozyc sprawy z_urzedu dla typu, ktory tego nie przewiduje', async () => {
  const { spolkaId, kowalski } = await przygotujSpolke();
  const [status, odp] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', zrodlo: 'z_urzedu', zadajacy_osoba_id: kowalski.id,
  });
  assert.equal(status, 400);
  assert.match(odp.blad, /czynnością z urzędu/);
});

test('AML jako bramka: niemozliwe blokuje wpis takze w workflow sprawy', async () => {
  const { spolkaId, kowalski, emisjaZdarzenieId } = await przygotujSpolke();
  const [, podejrzany] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: 'Zieliński', imie: 'Marek', data_urodzenia: '1978-03-15', aml_status: 'niemozliwe',
  });

  const [, sprawaOdp] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', zrodlo: 'papier', zadajacy_osoba_id: kowalski.id,
  });
  await zapytaj('PATCH', `/api/psa/sprawy/${sprawaOdp.sprawa.id}`, { akcja: 'weryfikuj' });

  const [status, odp] = await zapytaj('POST', `/api/psa/sprawy/${sprawaOdp.sprawa.id}/wpisz`, {
    data_zdarzenia: '2026-02-01',
    dane: {
      emisja_zdarzenie_id: emisjaZdarzenieId, zbywca_osoba_id: kowalski.id,
      pozycje: [{ nabywca_osoba_id: podejrzany.osoba.id, ilosc: 10 }],
    },
  });
  assert.equal(status, 422);
  assert.match(odp.bledy.join(' '), /środków bezpieczeństwa finansowego/);

  const [, sprawaPoNiepowodzeniu] = await zapytaj('GET', `/api/psa/sprawy/${sprawaOdp.sprawa.id}`);
  assert.equal(sprawaPoNiepowodzeniu.sprawa.stan, 'weryfikacja', 'nieudany wpis nie zmienia stanu sprawy');
});

test('upload dokumentu do sprawy i pobranie go z powrotem', async () => {
  const { spolkaId, kowalski } = await przygotujSpolke();
  const [, sprawaOdp] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'umorzenie', zrodlo: 'papier', zadajacy_osoba_id: kowalski.id,
  });
  const sprawaId = sprawaOdp.sprawa.id;

  const tresc = '%PDF-1.4 to nie jest prawdziwy PDF, ale wystarczy do testu uploadu.';
  const formularz = new FormData();
  formularz.append('typ_dokumentu', 'uchwala');
  formularz.append('pliki', new Blob([tresc], { type: 'application/pdf' }), 'uchwala-umorzenie.pdf');

  const odpUpload = await fetch(`${baza}/api/psa/sprawy/${sprawaId}/dokumenty`, {
    method: 'POST',
    headers: { ...AUTOR() },
    body: formularz,
  });
  assert.equal(odpUpload.status, 201);
  const uploadOdp = await odpUpload.json();
  assert.equal(uploadOdp.dokumenty.length, 1);
  assert.equal(uploadOdp.dokumenty[0].nazwa_pliku, 'uchwala-umorzenie.pdf');

  const dokumentId = uploadOdp.dokumenty[0].id;
  const odpPlik = await fetch(`${baza}/api/psa/sprawy/${sprawaId}/dokumenty/${dokumentId}`, {
    headers: { ...AUTOR() },
  });
  assert.equal(odpPlik.status, 200);
  const pobranaTresc = await odpPlik.text();
  assert.equal(pobranaTresc, tresc);

  const [, szczegol] = await zapytaj('GET', `/api/psa/sprawy/${sprawaId}`);
  assert.equal(szczegol.dokumenty.length, 1);
  assert.equal(szczegol.dokumenty[0].typ_dokumentu, 'uchwala');
});

test('odrzuca plik o niedozwolonym rozszerzeniu', async () => {
  const { spolkaId, kowalski } = await przygotujSpolke();
  const [, sprawaOdp] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'umorzenie', zrodlo: 'papier', zadajacy_osoba_id: kowalski.id,
  });

  const formularz = new FormData();
  formularz.append('typ_dokumentu', 'inny');
  formularz.append('pliki', new Blob(['echo zla-koncowka'], { type: 'application/x-sh' }), 'skrypt.sh');

  const odp = await fetch(`${baza}/api/psa/sprawy/${sprawaOdp.sprawa.id}/dokumenty`, {
    method: 'POST',
    headers: { ...AUTOR() },
    body: formularz,
  });
  assert.equal(odp.status, 400);
  const tresc = await odp.json();
  assert.match(tresc.blad, /Niedozwolone rozszerzenie/);
});

test('sprostowanie przez dedykowany endpoint /api/psa/zdarzenia/:id/sprostuj', async () => {
  const { emisjaZdarzenieId } = await przygotujSpolke();

  const [, przedSprostowaniem] = await zapytaj('GET', `/api/psa/zdarzenia/${emisjaZdarzenieId}`);
  assert.equal(przedSprostowaniem.mozna_sprostowac, true);

  const [status, odp] = await zapytaj('POST', `/api/psa/zdarzenia/${emisjaZdarzenieId}/sprostuj`, {
    uzasadnienie: 'Błędna cena emisyjna.',
    zamiast: { typ: 'emisja', dane: { seria: 'A', ilosc: 100, cena_emisyjna_grosze: 500 } },
  });
  assert.equal(status, 201);

  const [, poSprostowaniu] = await zapytaj('GET', `/api/psa/zdarzenia/${emisjaZdarzenieId}`);
  assert.equal(poSprostowaniu.mozna_sprostowac, false);
  assert.equal(poSprostowaniu.sprostowane_przez, odp.zdarzenie.id);
});

test('sprostowanie bez uzasadnienia jest odrzucane na poziomie API', async () => {
  const { emisjaZdarzenieId } = await przygotujSpolke();
  const [status, odp] = await zapytaj('POST', `/api/psa/zdarzenia/${emisjaZdarzenieId}/sprostuj`, {
    uzasadnienie: '',
  });
  assert.equal(status, 400);
  assert.match(odp.blad, /uzasadnienia/);
});

test('integralnosc lancucha pozostaje ok po calym cyklu operacji', async () => {
  const [, odp] = await zapytaj('GET', '/api/psa/integralnosc');
  assert.equal(odp.ok, true);
});
