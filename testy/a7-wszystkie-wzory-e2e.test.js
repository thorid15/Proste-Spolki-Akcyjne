'use strict';

/**
 * Blok A7 sesji 8 — test end-to-end: KAŻDY z dziesięciu wzorów renderuje się
 * na jednym, realistycznie wypełnionym rejestrze, bez ani jednego
 * nieuzupełnionego klucza (`brakujace` puste za każdym razem).
 *
 * Odróżnia się od testów jednostkowych `kontekst-pisma.test.js` (te budują
 * kontekst RĘCZNIE, na spreparowanych obiektach) tym, że tu prowadzimy
 * PRAWDZIWE żądania HTTP przez API aplikacji — rejestrację spółki, otwarcie
 * rejestru, cały cykl sprawy (nowa → weryfikacja → wpisana, wstrzymanie,
 * odmowa) — i sprawdzamy pisma, które aplikacja WYSTAWIŁA PO DRODZE, tak jak
 * zrobiłby to notariusz. Wzory 05/06/07/09 idą automatem (blok A4) przy
 * przejściach stanu; 01/02/03/08/10 wystawia się na żądanie ze spółki
 * (blok A5); 04 wystawia się na żądanie ze sprawy (dobudowane w A7 — patrz
 * `server/logika/kontekst-pisma.js` nagłówek modułu).
 *
 * Kancelaria musi być SKONFIGUROWANA (nie pusta) — inaczej `kancelaria_*`
 * zawsze wychodzi jako brak, niezależnie od reszty testu. Zmienne środowiskowe
 * trzeba ustawić PRZED `require('../serwer')`, bo `konfiguracja.js` czyta je
 * raz, przy pierwszym wczytaniu modułu.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-a7-e2e.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-a7-e2e-dokumenty');
fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });

// Kancelaria "prawdziwa" (te same wartości, co `logika/dane-probne.js`, żeby
// nie wymyślać drugiego kompletu danych testowych) — inaczej `kancelaria_*`
// jest brakiem na KAŻDYM z dziesięciu wzorów, niezależnie od reszty testu.
process.env.KANCELARIA_NAZWA = 'Kancelaria Notarialna Łukasz Kozon';
process.env.KANCELARIA_MIASTO = 'Gdańsk';
process.env.KANCELARIA_MIASTO_MIEJSCOWNIK = 'Gdańsku';
process.env.KANCELARIA_ULICA = 'Bolesława Leśmiana nr 3/U10';
process.env.KANCELARIA_KOD = '80-280';
process.env.KANCELARIA_EMAIL = 'biuro@notariusz.gdansk.pl';
process.env.KANCELARIA_TELEFON = '+48 455 406 290';
process.env.KANCELARIA_NIP = '9571165704';
process.env.KANCELARIA_REGON = '526934899';
process.env.NOTARIUSZ_MIANOWNIK = 'Łukasz Kozon';
process.env.NOTARIUSZ_DOPELNIACZ = 'Łukasza Kozona';
process.env.NOTARIUSZ_NARZEDNIK = 'Łukaszem Kozonem';
process.env.PODPISUJACY_FUNKCJA = 'Notariusz';
process.env.PODPISUJACY_MIANOWNIK = 'Łukasz Kozon';

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');

let serwer;
let baza;
let ciastko;

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

async function zapytaj(metoda, sciezka, cialo) {
  const opcje = { method: metoda, headers: { Cookie: ciastko } };
  if (cialo !== undefined) {
    opcje.headers['Content-Type'] = 'application/json';
    opcje.body = JSON.stringify(cialo);
  }
  const odp = await fetch(baza + sciezka, opcje);
  const typ = odp.headers.get('content-type') || '';
  return [odp.status, typ.includes('json') ? await odp.json() : await odp.arrayBuffer(), odp.headers];
}

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  const hash = await hasla.hashuj('HasloTestowe123');
  db()
    .prepare(
      `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono)
       VALUES ('Notariusz', 'notariusz-a7@example.pl', ?, 'admin', 1, ?)`
    )
    .run(hash, new Date().toISOString());
  const odpLogin = await fetch(`${baza}/api/psa/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'notariusz-a7@example.pl', haslo: 'HasloTestowe123' }),
  });
  ciastko = ciasteczkoZOdpowiedzi(odpLogin);
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

/** Zbiera brakujace/bledy z jednego wyniku wystawienia — komunikat czytelny od razu w asercji. */
function bezBrakow(etykieta, wynik) {
  assert.deepEqual(wynik.brakujace || [], [], `${etykieta}: brakujące klucze — ${JSON.stringify(wynik.brakujace)}`);
  assert.deepEqual(wynik.bledy || [], [], `${etykieta}: błędy wzoru — ${JSON.stringify(wynik.bledy)}`);
}

test('wszystkie dziesięć wzorów renderuje się na jednym, realistycznie wypełnionym rejestrze — bez ani jednego brakującego klucza', async () => {
  // ── 1. Spółka — komplet pól, jakich wymagają wzory (B4/B6/A3/A5) ─────
  const [stSpolka, spolkaOdp] = await zapytaj('POST', '/api/psa/spolki', {
    nazwa: 'Charlie Unicorn A7 P.S.A.',
    krs: '0001999888',
    nip: '7011325910',
    regon: '545410859',
    kod_pocztowy: '00-697',
    miejscowosc: 'Warszawa',
    ulica: 'Aleje Jerozolimskie',
    nr_domu: '51',
    siedziba_miejscownik: 'Warszawie',
    sad_rejestrowy: 'Sąd Rejonowy dla m.st. Warszawy w Warszawie',
    wydzial: 'XII Wydział Gospodarczy',
    email: 'kontakt@charlieunicorn-a7.ai',
    data_umowy: '2026-01-05',
    organ_rodzaj: 'zarzad',
    sklad_organu_json: JSON.stringify([{ imiona: 'Łukasz Adrian', nazwisko: 'Szymborski', funkcja: 'Prezes Zarządu' }]),
    reprezentant_biernik: 'Łukasza Adriana Szymborskiego',
    reprezentant_plec: 'mezczyzna',
    reprezentant_rodzice: 'Pawła i Izabelli',
    reprezentant_dowod: 'DGK 138559',
    reprezentant_pesel: '88081105939',
    reprezentant_adres: '76-015 Manowo, ulica Kasztanowa nr 17 m. 1',
    reprezentant_funkcja_biernik: 'Prezesa Zarządu',
    reprezentant_reprezentacja: 'uprawnionego do samodzielnej reprezentacji',
  });
  assert.equal(stSpolka, 201, JSON.stringify(spolkaOdp));
  const spolkaId = spolkaOdp.spolka.id;

  // ── 2. Dwie osoby z kartoteki — kowalski (zbywca/żądający), nowak (nabywca/odbiorca) ─
  const [, kowalskiOdp] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: 'Kowalski', imie: 'Jan',
    pesel: '88081105939', data_urodzenia: '1988-08-11',
    kod_pocztowy: '80-180', miejscowosc: 'Gdańsk', ulica: 'Kwiatowa', nr_domu: '4', nr_lokalu: '2',
    email: 'jan.kowalski.a7@example.pl', zgoda_email: true, aml_status: 'wykonane',
  });
  const [, nowakOdp] = await zapytaj('POST', '/api/psa/osoby', {
    typ: 'fizyczna', nazwisko: 'Nowak', imie: 'Anna', plec: 'kobieta',
    pesel: '85050512309', data_urodzenia: '1985-05-05',
    kod_pocztowy: '81-001', miejscowosc: 'Gdynia', ulica: 'Świętojańska', nr_domu: '10',
    email: 'anna.nowak.a7@example.pl', zgoda_email: true, aml_status: 'wykonane',
  });
  const kowalski = kowalskiOdp.osoba;
  const nowak = nowakOdp.osoba;

  // ── 3. Otwarcie rejestru: emisja 100 akcji serii A, w całości u Kowalskiego ─
  const [, emisjaOdp] = await zapytaj('POST', `/api/psa/spolki/${spolkaId}/zdarzenia`, {
    typ: 'emisja', data_zdarzenia: '2026-01-10',
    dane: { seria: 'A', ilosc: 100, data_wpisu_krs: '2026-01-10' },
  });
  await zapytaj('POST', `/api/psa/spolki/${spolkaId}/zdarzenia`, {
    typ: 'objecie', data_zdarzenia: '2026-01-10',
    dane: { emisja_zdarzenie_id: emisjaOdp.zdarzenie.id, pozycje: [{ osoba_id: kowalski.id, ilosc: 100 }] },
  });

  // ── 4. Pięć wzorów wystawianych NA ŻĄDANIE ze spółki (blok A5) ────────
  for (const [kod, cialo] of [
    ['01', {}],
    ['02', {}],
    [
      '03',
      {
        uchwala: {
          numer: '1', dataSlownie: '10 stycznia 2026 roku', trybGlosowania: 'jednogłośnie',
          glosyZa: 100, glosyPrzeciw: 0, glosyWstrzymujace: 0, procentGlosow: '100%',
        },
      },
    ],
    ['08', { adresat_adres: '00-013 Warszawa, ulica Czerniakowska 100A' }],
    [
      '10',
      {
        klauzula: { paragraf: '7', pokrycie: 'zostały w całości pokryte', ograniczenia: 'brak' },
        zbywca_osoba_id: kowalski.id,
        nabywca_osoba_id: nowak.id,
      },
    ],
  ]) {
    const [status, wynik] = await zapytaj('POST', `/api/psa/spolki/${spolkaId}/dokumenty/${kod}`, cialo);
    assert.equal(status, 201, `wzór ${kod}: ${JSON.stringify(wynik)}`);
    bezBrakow(`wzór ${kod} (na żądanie, spółka)`, wynik);
  }

  // ── 5. Sprawa nr 1: przeniesienie 40 akcji Kowalski → Nowak, do wpisu ──
  const [, sprawaOdp] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', zrodlo: 'papier',
    zadajacy_osoba_id: kowalski.id, zadajacy_rola: 'zbywca',
    dokument_rodzaj: 'umowa_zbycia', dokument_data: '2026-02-01',
  });
  const sprawaId = sprawaOdp.sprawa.id;

  // Załącznik do sprawy — wchodzi w sekcję `zalaczniki` wzoru 04.
  const formularz = new FormData();
  formularz.append('typ_dokumentu', 'umowa_zbycia');
  formularz.append('pliki', new Blob(['nie prawdziwa tresc, wystarcza do testu'], { type: 'application/pdf' }), 'umowa-zbycia.pdf');
  const odpUpload = await fetch(`${baza}/api/psa/sprawy/${sprawaId}/dokumenty`, {
    method: 'POST', headers: { Cookie: ciastko }, body: formularz,
  });
  assert.equal(odpUpload.status, 201);

  // Podglad zapisuje `dane_wejsciowe_json` — bez tego `wpis_opis` (04/05/06/07/09)
  // jest brakiem. Wywołujemy go PRZED wystawieniem wzoru 04, bo ono opisuje
  // TREŚĆ żądanego wpisu, którą notariusz już zna z kroku podglądu kreatora.
  await zapytaj('POST', `/api/psa/sprawy/${sprawaId}/podglad`, {
    data_zdarzenia: '2026-02-10',
    dane: { emisja_zdarzenie_id: emisjaOdp.zdarzenie.id, zbywca_osoba_id: kowalski.id, pozycje: [{ nabywca_osoba_id: nowak.id, ilosc: 40 }] },
  });

  // Wzór 04 — żądanie dokonania wpisu (blok A7, dobudowane ze sprawy).
  // Zgoda (sekcja IV) NIE dotyczy tego wpisu (Kowalski pozostaje z 60 akcjami,
  // nikomu nic się nie odbiera) — dlatego bez `zgadzajacy_osoba_id`.
  const [st04, wynik04] = await zapytaj('POST', `/api/psa/sprawy/${sprawaId}/dokumenty/04`);
  assert.equal(st04, 201, JSON.stringify(wynik04));
  bezBrakow('wzór 04 (żądanie dokonania wpisu)', wynik04);

  // ── 6. Cykl sprawy: weryfikacja → powiadomienie (05) → wstrzymanie (06) → wznowienie → wpis (07 + 08 automat) ─
  await zapytaj('PATCH', `/api/psa/sprawy/${sprawaId}`, { akcja: 'weryfikuj' });

  const [st05, powOdp] = await zapytaj('POST', `/api/psa/sprawy/${sprawaId}/powiadomienie`, { osoba_id: nowak.id });
  assert.equal(st05, 200, JSON.stringify(powOdp));
  bezBrakow('wzór 05 (powiadomienie uprzednie)', powOdp.wysylka);

  const [st06, wstrzOdp] = await zapytaj('PATCH', `/api/psa/sprawy/${sprawaId}`, {
    akcja: 'wstrzymaj', powod: 'Brak zgody spółki na zbycie akcji nie w pełni pokrytej.',
    sposob_usuniecia: 'przedłożenie zgody spółki na zbycie akcji nie w pełni pokrytej', termin_usuniecia: '2026-02-20',
  });
  assert.equal(st06, 200, JSON.stringify(wstrzOdp));
  bezBrakow('wzór 06 (wezwanie do usunięcia przeszkody)', wstrzOdp.wysylka);

  await zapytaj('PATCH', `/api/psa/sprawy/${sprawaId}`, { akcja: 'wznow' });

  const [st07, wpisOdp] = await zapytaj('POST', `/api/psa/sprawy/${sprawaId}/wpisz`, {
    data_zdarzenia: '2026-02-25',
    dane: { emisja_zdarzenie_id: emisjaOdp.zdarzenie.id, zbywca_osoba_id: kowalski.id, pozycje: [{ nabywca_osoba_id: nowak.id, ilosc: 40 }] },
  });
  assert.equal(st07, 201, JSON.stringify(wpisOdp));
  assert.equal(wpisOdp.powiadomienia.length, 3, 'dwa zawiadomienia o wpisie (wzor 07) + lista dla KRS (wzor 08 automat)');
  for (const p of wpisOdp.powiadomienia) bezBrakow('wzór 07/08 (po wpisie)', p);

  // ── 7. Sprawa nr 2: odmowa wpisu (wzór 09) ────────────────────────────
  const [, sprawa2Odp] = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', zrodlo: 'papier',
    zadajacy_osoba_id: kowalski.id, zadajacy_rola: 'zbywca',
    dokument_rodzaj: 'umowa_zbycia', dokument_data: '2026-03-01',
  });
  const sprawa2Id = sprawa2Odp.sprawa.id;
  await zapytaj('PATCH', `/api/psa/sprawy/${sprawa2Id}`, { akcja: 'weryfikuj' });
  await zapytaj('POST', `/api/psa/sprawy/${sprawa2Id}/podglad`, {
    data_zdarzenia: '2026-03-05',
    dane: { emisja_zdarzenie_id: emisjaOdp.zdarzenie.id, zbywca_osoba_id: kowalski.id, pozycje: [{ nabywca_osoba_id: nowak.id, ilosc: 1 }] },
  });
  const [st09, odmOdp] = await zapytaj('PATCH', `/api/psa/sprawy/${sprawa2Id}`, {
    akcja: 'odmow', powod_odmowy_kod: 'brak_dokumentow', powod_odmowy: 'Brak wymaganej zgody spółki na zbycie akcji.',
  });
  assert.equal(st09, 200, JSON.stringify(odmOdp));
  bezBrakow('wzór 09 (zawiadomienie o niedokonaniu wpisu)', odmOdp.wysylka);
});
