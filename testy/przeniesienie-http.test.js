'use strict';

/**
 * Faza 4 — przeniesienie rejestru: przebieg od zgłoszenia do „Aktywny” przez API
 * (W7.1–W7.10): zgłoszenie, weryfikacja (checklista), umowa warunkowa (pisma),
 * okres przejściowy (żądania: odmowa / przeszkoda), uzgodnienie z rozbieżnościami,
 * zatwierdzenie QES protokołu, otwarcie „PRZEJĘCIE”, opłata od skuteczności, Etap 8.
 */

const test = require('./pominiete')('Faza 4 — wniosek, zgłoszenie i przejęcie rejestru przebudowywane');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-przeniesienie.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-przeniesienie-dok');
process.env.PORTAL_WLACZONY = 'true';
process.env.KRS_API_URL = 'http://127.0.0.1:9/krs';
delete process.env.PSA_TRYB_TESTOWY;

const app = require('../serwer');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');
const czas = require('../server/pomocnicze/czas');

let serwer;
let ADRES;
let prac;

async function zapytaj(metoda, sciezka, cialo, kto = prac) {
  const odp = await fetch(`${ADRES}${sciezka}`, {
    method: metoda, headers: { 'Content-Type': 'application/json', Cookie: kto || '' },
    body: cialo === undefined ? undefined : JSON.stringify(cialo),
  });
  const typ = odp.headers.get('content-type') || '';
  return [odp.status, typ.includes('json') ? await odp.json() : Buffer.from(await odp.arrayBuffer())];
}
async function wyslijPlik(sciezka, pola, bufor, nazwa) {
  const f = new FormData();
  for (const [k, v] of Object.entries(pola)) f.append(k, v);
  f.append('plik', new Blob([bufor], { type: 'application/pdf' }), nazwa);
  const odp = await fetch(`${ADRES}${sciezka}`, { method: 'POST', headers: { Cookie: prac }, body: f });
  return [odp.status, await odp.json()];
}

test.before(async () => {
  serwer = app.listen(0);
  await new Promise((r) => serwer.once('listening', r));
  ADRES = `http://127.0.0.1:${serwer.address().port}`;
  const hash = await hasla.hashuj('HasloTestowe123');
  db().prepare(`INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono) VALUES ('Admin', 'admin-p@example.pl', ?, 'admin', 1, ?)`).run(hash, czas.terazIso());
  const l = await fetch(`${ADRES}/api/psa/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin-p@example.pl', haslo: 'HasloTestowe123' }) });
  prac = l.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
});

test.after(() => {
  serwer.close();
  for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

test('przeniesienie rejestru: od zgłoszenia do „Aktywny”', async () => {
  const dzis = czas.dzisIso();
  // W7.1 — zgłoszenie z formularza publicznego, wariant przeniesienia.
  const [stZgl] = await zapytaj('POST', '/api/psa/portal/zgloszenia', {
    email: 'zarzad.beta@example.pl', krs: '0000444555', nazwa_spolki: 'Beta Przenoszona P.S.A.',
    przeniesienie: { poprzednik_typ: 'dom_maklerski', poprzednik_nazwa: 'Dom Maklerski Przykład S.A.', okres_wypowiedzenia: '3 miesiące' },
  }, null);
  assert.equal(stZgl, 201);
  const [, lista] = await zapytaj('GET', '/api/psa/przeniesienia');
  const p0 = lista.przeniesienia[0];
  assert.equal(p0.status, 'zgloszone');
  assert.equal(p0.poprzednik_typ, 'dom_maklerski');
  const id = p0.id;
  assert.equal(db().prepare('SELECT rodzaj FROM psa_zgloszenia WHERE id = ?').get(p0.zgloszenie_id).rodzaj, 'przeniesienie');

  // W7.3 — weryfikacja: pozycja „uchwała” zablokowana bez dokumentu (D-052).
  assert.equal((await zapytaj('POST', `/api/psa/przeniesienia/${id}/przejscie`, { na: 'weryfikacja' }))[0], 200);
  const [stBlok, blok] = await zapytaj('PUT', `/api/psa/przeniesienia/${id}/checklista/weryfikacji`, { zaznaczone: { uchwala: true } });
  assert.equal(stBlok, 400);
  assert.match(blok.blad, /Najpierw dołącz dokument: uchwala/);
  await wyslijPlik(`/api/psa/przeniesienia/${id}/dokumenty`, { typ: 'uchwala', zrodlo: 'klient' }, Buffer.from('%PDF uchwała'), 'uchwala.pdf');
  await wyslijPlik(`/api/psa/przeniesienia/${id}/dokumenty`, { typ: 'umowa_spolki', zrodlo: 'klient' }, Buffer.from('%PDF umowa'), 'umowa-spolki.pdf');
  await zapytaj('PUT', `/api/psa/przeniesienia/${id}/checklista/weryfikacji`, {
    zaznaczone: { reprezentacja: true, uchwala: true, umowa_spolki: true, aml: true, liczba_akcji: true },
  });
  const [stUmowa, poUmowie] = await zapytaj('POST', `/api/psa/przeniesienia/${id}/przejscie`, { na: 'umowa_warunkowa', data_zawarcia_umowy: dzis });
  assert.equal(stUmowa, 200, JSON.stringify(poUmowie));
  assert.equal(poUmowie.przeniesienie.termin_warunku.slice(0, 4), String(Number(dzis.slice(0, 4)) + 1));

  // W7.4 — klauzula § 7.4 dosłownie; pisma PROJEKT; wezwanie w wariancie poprzednika; [2027] za bramką.
  const [, klauzula] = await zapytaj('GET', `/api/psa/przeniesienia/${id}/pisma/przeniesienie_klauzula`);
  assert.match(klauzula.toString(), /Umowa zostaje zawarta pod warunkiem zawieszającym rozwiązania albo wygaśnięcia umowy o prowadzenie rejestru akcjonariuszy Spółki zawartej z Dom Maklerski Przykład S\.A\./);
  const [, wezwanie] = await zapytaj('GET', `/api/psa/przeniesienia/${id}/pisma/przeniesienie_wezwanie`);
  assert.match(wezwanie.toString(), /PROJEKT — do akceptacji Łukasza/);
  assert.match(wezwanie.toString(), /83a ust\. 4ac/);
  if (dzis < '2027-02-18') assert.equal((await zapytaj('GET', `/api/psa/przeniesienia/${id}/pisma/przeniesienie_zgloszenie_krs`))[0], 400);

  // Spółka z przyjętego wniosku (tu wprost) i akcjonariusz bez zgody na e-mail.
  const spolkaId = Number(db().prepare(`INSERT INTO psa_spolki (nazwa, krs, email, forma_prawna, status, utworzono) VALUES ('Beta Przenoszona P.S.A.', '0000444555', 'beta@example.pl', 'PROSTA SPÓŁKA AKCYJNA', 'aktywna', ?)`).run(czas.terazIso()).lastInsertRowid);
  db().prepare('UPDATE psa_przeniesienia SET spolka_id = ? WHERE id = ?').run(spolkaId, id);
  const osobaId = Number(db().prepare(`INSERT INTO psa_osoby (typ, imie, nazwisko, data_urodzenia, ulica, nr_domu, kod_pocztowy, miejscowosc, zgoda_email_status, aml_status, utworzono)
    VALUES ('fizyczna', 'Piotr', 'Przejmowany', '1975-04-04', 'Archiwalna', '3', '80-100', 'Gdańsk', 'brak', 'wykonane', ?)`).run(czas.terazIso()).lastInsertRowid);

  // W7.5 — przed skutecznością umowy żądanie nie jest przyjmowane.
  const zadanie = { spolka_id: spolkaId, typ_zdarzenia: 'zmiana_danych_akcjonariusza', zrodlo: 'papier', zadajacy_osoba_id: osobaId, zadajacy_rola: 'akcjonariusz' };
  const [stPrzed, przed] = await zapytaj('POST', '/api/psa/sprawy', zadanie);
  assert.equal(stPrzed, 400);
  assert.match(przed.blad, /Do chwili skuteczności umowy/);

  await wyslijPlik(`/api/psa/przeniesienia/${id}/dokumenty`, { typ: 'wypowiedzenie', zrodlo: 'klient' }, Buffer.from('%PDF wypowiedzenie'), 'wypowiedzenie.pdf');
  assert.equal((await zapytaj('POST', `/api/psa/przeniesienia/${id}/przejscie`, { na: 'oczekuje_na_przekazanie', data_skutecznosci: dzis }))[0], 200);
  const [stPo, po] = await zapytaj('POST', '/api/psa/sprawy', zadanie);
  assert.equal(stPo, 201, JSON.stringify(po));
  assert.equal(po.sprawa.stan, 'wstrzymana', 'brak danych od poprzednika = przeszkoda (zamrożenie terminu)');

  // W7.6 — odbiór, rozbieżność → wstrzymane, wyjaśnienie → uzgodnienie.
  await wyslijPlik(`/api/psa/przeniesienia/${id}/dokumenty`, { typ: 'dane_poprzednika', zrodlo: 'poprzednik' }, Buffer.from('%PDF rejestr poprzednika'), 'rejestr-dm.pdf');
  assert.equal((await zapytaj('POST', `/api/psa/przeniesienia/${id}/przejscie`, { na: 'uzgodnienie' }))[0], 200);
  assert.equal((await zapytaj('POST', `/api/psa/przeniesienia/${id}/przejscie`, { na: 'wstrzymane_rozbieznosci' }))[0], 400);
  assert.equal((await zapytaj('POST', `/api/psa/przeniesienia/${id}/przejscie`, { na: 'wstrzymane_rozbieznosci', uwagi: 'Seria B: 100 akcji w rejestrze, 120 w KRS.' }))[0], 200);
  assert.equal((await zapytaj('POST', `/api/psa/przeniesienia/${id}/przejscie`, { na: 'uzgodnienie', uwagi: 'Poprzednik przesłał korektę — 120 akcji.' }))[0], 200);

  // Otwarcie przed zatwierdzeniem i checklistą — odmowa.
  const otwarcie = {
    checklista: { forma: true, wpis_krs: true, uchwala: true, reprezentacja: true, umowa: true, jedna_umowa: true, dane_z_umowy: true, ograniczenia: true, bilans: true, zakres_danych: true, aml: true },
    zdarzenia: [
      { typ: 'emisja', klucz_tymczasowy: 'e1', dane: { seria: 'A', nr_pierwszy: 1, ilosc: 120, data_wpisu_krs: '2025-03-15', rodzaj_akcji: 'zwykla' } },
      { typ: 'objecie', dane: { emisja_zdarzenie_id: { __odwolanie_do_partii: 'e1' }, pozycje: [{ osoba_id: osobaId, ilosc: 120, pokryta: 'tak' }] } },
    ],
    archiwum: 'Historia wpisów Domu Maklerskiego Przykład S.A. — 12 wpisów (2025–2026).',
  };
  assert.equal((await zapytaj('POST', `/api/psa/spolki/${spolkaId}/otworz-rejestr`, otwarcie))[0], 400);

  await zapytaj('PUT', `/api/psa/przeniesienia/${id}/checklista/odbioru`, {
    zaznaczone: { kompletnosc: true, liczba_akcji: true, pokrycie: true, obciazenia: true, lista_krs: true, rozbieznosci: true },
  });
  // W7.7 — protokół (PDF z ID) podpisany przez notariusza; D-086: weryfikuje pracownik, nie odrzucenie.
  const [stProt, protokol] = await zapytaj('GET', `/api/psa/przeniesienia/${id}/protokol.pdf`);
  assert.equal(stProt, 200);
  const podpisany = Buffer.concat([protokol, Buffer.from('\n9 0 obj << /Type /Sig /SubFilter /ETSI.CAdES.detached /ByteRange [0 1 2 3] /Contents <00> >> endobj\n%%EOF\n')]);
  const [stZatw, zatw] = await wyslijPlik(`/api/psa/przeniesienia/${id}/zatwierdzenie`, {}, podpisany, 'protokol-podpisany.pdf');
  assert.equal(stZatw, 200, JSON.stringify(zatw));
  assert.equal(zatw.przeniesienie.zatwierdzenie_walidacja.wynik, 'do_weryfikacji');
  const [stZmien] = await wyslijPlik(`/api/psa/przeniesienia/${id}/zatwierdzenie`, {}, Buffer.from('%PDF-1.4 inny plik'), 'inny.pdf');
  assert.equal(stZmien, 400, 'plik bez podpisu albo nie ten protokół — odrzucony');

  const [stOtw, otw] = await zapytaj('POST', `/api/psa/spolki/${spolkaId}/otworz-rejestr`, otwarcie);
  assert.equal(stOtw, 201, JSON.stringify(otw));
  assert.equal(otw.przejecie.oplata_za_przejecie, 'brak (D-085)');
  const zdarzenia = db().prepare('SELECT * FROM psa_zdarzenia WHERE spolka_id = ? ORDER BY id').all(spolkaId);
  assert.equal(zdarzenia[0].typ, 'przejecie', 'PRZEJĘCIE otwiera łańcuch SHA-256');
  const danePrzejecia = JSON.parse(zdarzenia[0].dane_json);
  assert.equal(danePrzejecia.stan_na, dzis);
  assert.ok(danePrzejecia.dokumenty_zrodlowe.every((d) => /^[0-9a-f]{64}$/.test(d.sha256)));
  assert.equal(zdarzenia[1].hash_poprzedni, zdarzenia[0].hash);
  const archiwum = db().prepare('SELECT * FROM psa_przeniesienia_archiwum WHERE przeniesienie_id = ?').get(id);
  assert.match(archiwum.tresc, /Domu Maklerskiego/);
  assert.throws(() => db().prepare('UPDATE psa_przeniesienia_archiwum SET tresc = ?').run('zmiana'), /tylko do odczytu/);

  // W7.9 — rok prowadzenia od dnia skuteczności; bez opłaty za wpis przy imporcie.
  const oplaty = db().prepare('SELECT * FROM psa_oplaty WHERE spolka_id = ?').all(spolkaId);
  assert.ok(oplaty.some((o) => o.typ === 'prowadzenie' && o.okres_od === dzis));
  assert.ok(!oplaty.some((o) => o.typ === 'wpis' && o.sprawa_id === null), 'import nie jest wpisem');
  const [, poOtwarciu] = await zapytaj('GET', `/api/psa/przeniesienia/${id}`);
  assert.equal(poOtwarciu.przeniesienie.status, 'aktywny');
  assert.deepEqual(poOtwarciu.przeniesienie.historia.map((h) => h.na_status).slice(0, 8),
    ['zgloszone', 'weryfikacja', 'umowa_warunkowa', 'oczekuje_na_przekazanie', 'uzgodnienie', 'wstrzymane_rozbieznosci', 'uzgodnienie', 'aktywny']);

  // W7.8 — spółka (e-mail), poprzednik (potwierdzenie odbioru do druku), akcjonariusz bez zgody — list.
  const wydane = db().prepare("SELECT * FROM psa_wydane_dokumenty WHERE spolka_id = ? AND typ = 'raport'").all(spolkaId);
  assert.ok(wydane.some((w) => w.kanal === 'email' && /Potwierdzamy przejęcie/.test(w.tresc_html)));
  assert.ok(wydane.some((w) => w.kanal === 'papier' && /Potwierdzenie odbioru rejestru/.test(w.tresc_html)));
  assert.ok(db().prepare("SELECT 1 FROM psa_listy WHERE spolka_id = ? AND rodzaj_pisma = 'przejecie_rodo' AND odbiorca_osoba_id = ?").get(spolkaId, osobaId));
});
