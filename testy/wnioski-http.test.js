'use strict';

/**
 * Faza 4 — nowa spółka: zgłoszenie (U-08) → aktywacja → dane → złożenie (dokumenty U-03) → podpisy
 * (test D-086, sprawdzenie przez pracownika) → przyjęcie → otwarcie; przejęcie (U-07), zwrot, odrzucenie,
 * wniosek pracownika, izolacja kont portalu.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-wnioski-http.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.PORTAL_WLACZONY = 'true';
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-wnioski-dokumenty');
fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });

const app = require('../serwer');
const poczta = require('../server/poczta');
const { db } = require('../server/baza');
const hasla = require('../server/logika/hasla');
const czas = require('../server/pomocnicze/czas');
const terminy = require('../server/logika/terminy');
const { CHECKLISTA_PELNA, PDF_TESTOWY, ustawKancelarie } = require('./pomoc');

ustawKancelarie(db());

const wyslane = [];
poczta.wyslij = async (w) => { wyslane.push(w); return { wyslano: true, idWiadomosci: 'test' }; };

let serwer;
let ADRES;
const ciastka = {};
const HASLO = 'Mocne-Haslo-2026!';
const PODPIS = '\n9 0 obj << /Type /Sig /SubFilter /ETSI.CAdES.detached /ByteRange [0 1 2 3] /Contents <00> >> endobj\n%%EOF\n';

async function zadanie(metoda, sciezka, cialo, { kto = 'admin', plik = null, pola = {} } = {}) {
  const naglowki = { Cookie: ciastka[kto] || '', Origin: ADRES };
  let body;
  if (plik) {
    body = new FormData();
    const zapytanie = new URLSearchParams(pola).toString();
    if (zapytanie) sciezka = `${sciezka}?${zapytanie}`;
    body.append('plik', new Blob([plik.tresc]), plik.nazwa);
  } else if (cialo !== undefined) {
    naglowki['Content-Type'] = 'application/json';
    body = JSON.stringify(cialo);
  }
  const odp = await fetch(`${ADRES}${sciezka}`, { method: metoda, headers: naglowki, body });
  const set = odp.headers.getSetCookie();
  if (set.length) ciastka[kto] = set.map((c) => c.split(';')[0]).join('; ');
  const typ = odp.headers.get('content-type') || '';
  return { status: odp.status, dane: typ.includes('json') ? await odp.json() : Buffer.from(await odp.arrayBuffer()) };
}

/** Zgłoszenie z formularza publicznego i aktywacja konta linkiem z e-maila. */
async function zglosIAktywuj(kto, krs, { przejecie = false } = {}) {
  const z = await zadanie('POST', '/api/psa/portal/zgloszenie', { krs, email: `${kto}@example.com`, przejecie }, { kto });
  assert.equal(z.status, 202);
  const token = wyslane.at(-1).tekst.match(/token=([0-9a-f]+)/)[1];
  const a = await zadanie('POST', '/api/psa/portal/aktywacja', { token, haslo: HASLO, regulamin: true }, { kto });
  assert.equal(a.status, 200, JSON.stringify(a.dane));
}

const DANE = (email, przejecie = false) => ({
  spolka: { nazwa: 'Gamma P.S.A.', siedziba: 'Gdańsk', adres: 'ul. Długa 1, 80-001 Gdańsk', sad_rejestrowy: 'Sąd Rejonowy Gdańsk-Północ w Gdańsku, VII Wydział Gospodarczy KRS', data_rejestracji: '2026-01-10', email: 'biuro@gamma.example' },
  reprezentant: { nazwa: 'Zofia Zarządna', pesel: '44051401359', adres: 'ul. Krótka 2, 80-002 Gdańsk', email, funkcja: 'członek zarządu', pep: false },
  akcjonariusze: [
    { klucz: 'ja', typ: 'fizyczna', nazwa: 'Zofia Zarządna', pesel: '44051401359', adres: 'ul. Krótka 2, 80-002 Gdańsk', email, to_ja: true, zgoda_email: true },
    { klucz: 'b', typ: 'prawna', nazwa: 'Beta sp. z o.o.', numer_rejestru: '0000123123', adres: 'ul. Morska 3, 81-001 Gdynia', email: 'beta@example.com' },
  ],
  platnosc: przejecie ? 'miesieczna' : 'roczna',
  uchwala: 'podpisana',
});

/** Pobrany dokument + słownik podpisu = plik „podpisany” zgodny z oryginałem. */
async function podpisz(kto, pismoId) {
  const pdf = await zadanie('GET', `/api/psa/portal/wniosek/dokumenty/${pismoId}`, undefined, { kto });
  assert.equal(pdf.dane.subarray(0, 5).toString(), '%PDF-');
  return { tresc: Buffer.concat([pdf.dane, Buffer.from(PODPIS)]), nazwa: 'podpisany.pdf' };
}

test.before(async () => {
  serwer = app.listen(0);
  ADRES = `http://localhost:${serwer.address().port}`;
  db().prepare('INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono) VALUES (?, ?, ?, ?, 1, ?)')
    .run('Łukasz Kozon', 'admin@example.com', await hasla.hashuj('HasloTestowe123'), 'admin', czas.terazIso());
  const l = await zadanie('POST', '/api/psa/auth/login', { email: 'admin@example.com', haslo: 'HasloTestowe123' });
  assert.equal(l.status, 200);
});

test.after(() => {
  serwer.close();
  for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

let gamma;

test('zgłoszenie → aktywacja → dane → złożenie: dokumenty z U-03; izolacja kont; e-mail bez danych osobowych', async () => {
  await zglosIAktywuj('gamma', '0000777001');
  assert.ok(!/Gamma|PESEL/.test(wyslane.at(-1).tekst));
  const odpowiedz = await zadanie('POST', '/api/psa/portal/zgloszenie', { krs: '0000777001', email: 'gamma@example.com' }, { kto: 'x' });
  assert.equal(odpowiedz.status, 202, 'ta sama odpowiedź, gdy konto istnieje (D-079)');

  let w = await zadanie('GET', '/api/psa/portal/wniosek', undefined, { kto: 'gamma' });
  assert.equal(w.dane.wniosek.stan, 'roboczy');
  assert.equal(w.dane.wniosek.dane.reprezentant.email, 'gamma@example.com');
  assert.ok(w.dane.bledy.length > 0);
  assert.equal((await zadanie('POST', '/api/psa/portal/wniosek/zloz', {}, { kto: 'gamma' })).status, 422, 'niekompletny wniosek');

  w = await zadanie('PUT', '/api/psa/portal/wniosek', { dane: DANE('gamma@example.com') }, { kto: 'gamma' });
  assert.deepEqual(w.dane.bledy, []);
  w = await zadanie('POST', '/api/psa/portal/wniosek/zloz', {}, { kto: 'gamma' });
  assert.equal(w.dane.wniosek.stan, 'zlozony');
  assert.deepEqual(w.dane.dokumenty.map((d) => [d.klucz, d.stan]), [['umowa_spolki', 'brak'], ['umowa', 'do_podpisu'], ['uchwala', 'do_podpisu'], ['zgoda:b', 'do_podpisu']]);
  assert.equal((await zadanie('PUT', '/api/psa/portal/wniosek', { dane: DANE('x@example.com') }, { kto: 'gamma' })).status, 422, 'złożonego nie zmienia klient');
  gamma = w.dane.wniosek.id;

  await zglosIAktywuj('delta', '0000777002');
  const d = await zadanie('GET', '/api/psa/portal/wniosek', undefined, { kto: 'delta' });
  assert.notEqual(d.dane.wniosek.id, gamma, 'konto widzi tylko swój wniosek');
  assert.equal((await zadanie('GET', `/api/psa/wnioski/${gamma}`, undefined, { kto: 'delta' })).status, 401, 'trasy kancelarii — tylko pracownik');
  assert.equal((await zadanie('GET', '/api/psa/portal/wniosek/dokumenty/1', undefined, { kto: 'delta' })).status, 404, 'cudzy dokument (§ 7 pkt 2)');
});

test('podpisy: plik bez podpisu odrzucony od razu (D-086), podpisany — do sprawdzenia; uchwała „w umowie spółki”', async () => {
  const w0 = (await zadanie('GET', '/api/psa/portal/wniosek', undefined, { kto: 'gamma' })).dane;
  const umowa = w0.dokumenty.find((d) => d.klucz === 'umowa');
  const bez = await zadanie('POST', '/api/psa/portal/wniosek/pliki', undefined, { kto: 'gamma', plik: { tresc: PDF_TESTOWY, nazwa: 'skan.pdf' }, pola: { dokument: 'umowa' } });
  assert.equal(bez.status, 422);
  assert.match(bez.dane.bledy[0].komunikat, /nie ma podpisu elektronicznego/);
  const ok = await zadanie('POST', '/api/psa/portal/wniosek/pliki', undefined, { kto: 'gamma', plik: await podpisz('gamma', umowa.pismo_id), pola: { dokument: 'umowa' } });
  assert.equal(ok.status, 201);
  await zadanie('POST', '/api/psa/portal/wniosek/pliki', undefined, { kto: 'gamma', plik: { tresc: PDF_TESTOWY, nazwa: 'umowa-spolki.pdf' }, pola: { dokument: 'umowa_spolki' } });
  const zgoda = w0.dokumenty.find((d) => d.klucz === 'zgoda:b');
  await zadanie('POST', '/api/psa/portal/wniosek/pliki', undefined, { kto: 'gamma', plik: await podpisz('gamma', zgoda.pismo_id), pola: { dokument: 'zgoda:b' } });
  const w = (await zadanie('PUT', '/api/psa/portal/wniosek', { uchwala: 'w_umowie' }, { kto: 'gamma' })).dane;
  assert.deepEqual(w.dokumenty.map((d) => [d.klucz, d.stan]), [['umowa_spolki', 'wgrany'], ['umowa', 'do_sprawdzenia'], ['zgoda:b', 'do_sprawdzenia']]);
});

test('kancelaria: przeszkody, potwierdzenie podpisów, podpis notariusza, checklista → Przyjmij → Otwórz rejestr → wpis', async () => {
  let w = (await zadanie('GET', `/api/psa/wnioski/${gamma}`)).dane;
  assert.ok(w.przeszkody.some((p) => /Podpis spółki/.test(p)));
  assert.equal((await zadanie('POST', `/api/psa/wnioski/${gamma}/stan`, { stan: 'przyjety' })).status, 422);
  const pulpit = (await zadanie('GET', '/api/psa/pulpit')).dane;
  assert.ok(pulpit.some((p) => p.sciezka === `/wnioski/${gamma}` && /podpisy do sprawdzenia: 2/.test(p.opis)));

  for (const d of w.dokumenty.filter((x) => x.stan === 'do_sprawdzenia')) {
    assert.equal((await zadanie('POST', `/api/psa/wnioski/${gamma}/pliki/${d.plik.id}`, { stan: 'odrzucony' })).status, 422, 'odrzucenie wymaga powodu');
    await zadanie('POST', `/api/psa/wnioski/${gamma}/pliki/${d.plik.id}`, { stan: 'potwierdzony' });
  }
  const notariusz = await zadanie('POST', `/api/psa/wnioski/${gamma}/pliki`, undefined, { plik: { tresc: PDF_TESTOWY, nazwa: 'umowa-qes.pdf' }, pola: { dokument: 'umowa_notariusz', umowe_zawarl: 'Anna Przykładowa — notariusz' } });
  assert.equal(notariusz.status, 201);
  w = (await zadanie('PUT', `/api/psa/wnioski/${gamma}`, { checklista: { reprezentacja: true, uchwala: true, zgody: true } })).dane;
  assert.deepEqual(w.przeszkody, []);
  w = (await zadanie('POST', `/api/psa/wnioski/${gamma}/stan`, { stan: 'przyjety' })).dane;
  assert.equal(w.wniosek.stan, 'przyjety');

  const s = db().prepare('SELECT * FROM psa_spolki WHERE id = ?').get(w.wniosek.spolka_id);
  assert.deepEqual([s.krs, s.nazwa, s.umowe_zawarl, s.platnosc, s.email], ['0000777001', 'Gamma P.S.A.', 'Anna Przykładowa — notariusz', 'roczna', 'biuro@gamma.example']);
  const osoby = w.wniosek.dane.osoby;
  const zofia = db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(osoby.reprezentant);
  const beta = db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(osoby.b);
  assert.deepEqual([zofia.nazwa, zofia.zgoda_email, beta.zgoda_email], ['Zofia Zarządna', 1, 1], 'zgody: „to ja” z portalu, Beta — z podpisanego dokumentu');
  assert.ok(db().prepare('SELECT 1 FROM psa_reprezentanci WHERE spolka_id = ? AND osoba_id = ?').get(s.id, zofia.id));
  assert.equal(db().prepare("SELECT osoba_id FROM psa_konta WHERE email = 'gamma@example.com'").get().osoba_id, zofia.id);
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM psa_pliki WHERE wniosek_id = ? AND spolka_id = ?').get(gamma, s.id).n, 4, 'pliki w aktach spółki');
  assert.ok(db().prepare('SELECT 1 FROM psa_historia_danych WHERE osoba_id = ? AND pole = ? AND plik_id IS NOT NULL').get(beta.id, 'zgoda_email'));

  const o = await zadanie('POST', `/api/psa/wnioski/${gamma}/otworz`, {});
  assert.equal(o.status, 201);
  assert.equal((await zadanie('POST', `/api/psa/wnioski/${gamma}/otworz`, {})).dane.sprawa_id, o.dane.sprawa_id, 'idempotentnie');
  const sprawa = (await zadanie('GET', `/api/psa/sprawy/${o.dane.sprawa_id}`)).dane;
  const op = sprawa.sprawa.operacje[0];
  assert.deepEqual([op.typ, op.zrodlo, op.akcjonariusze.map((a) => a.osoba_id)], ['otwarcie', 'zalozenie', [zofia.id, beta.id]]);
  op.serie[0] = { ...op.serie[0], numery: '1-100', liczba: 100 };
  op.akcjonariusze[0].akcje = [{ seria: 'A', numery: '1-60', liczba: 60 }];
  op.akcjonariusze[1].akcje = [{ seria: 'A', numery: '61-100', liczba: 40 }];
  await zadanie('PUT', `/api/psa/sprawy/${o.dane.sprawa_id}`, { operacje: [op], checklista: CHECKLISTA_PELNA });
  await zadanie('POST', `/api/psa/sprawy/${o.dane.sprawa_id}/krok`, { krok: 2 });
  const wpis = await zadanie('POST', `/api/psa/sprawy/${o.dane.sprawa_id}/stan`, { stan: 'wpisana' });
  assert.equal(wpis.status, 200, JSON.stringify(wpis.dane));
  assert.ok(db().prepare('SELECT data_otwarcia FROM psa_spolki WHERE id = ?').get(s.id).data_otwarcia);
  assert.equal(db().prepare("SELECT COUNT(*) AS n FROM psa_oplaty WHERE spolka_id = ? AND typ = 'prowadzenie'").get(s.id).n, 1, 'pierwsza opłata za prowadzenie');
});

test('przejęcie: „Otwórz rejestr” dopiero od dnia przejęcia; zwrot do uzupełnienia — nowe dokumenty, stare podpisy nieważne', async () => {
  await zglosIAktywuj('omega', '0000777003', { przejecie: true });
  let w = (await zadanie('PUT', '/api/psa/portal/wniosek', { dane: DANE('omega@example.com', true) }, { kto: 'omega' })).dane;
  assert.ok(w.bledy.some((b) => b.pole === 'dotychczasowy_podmiot'));
  w = (await zadanie('PUT', '/api/psa/portal/wniosek', { dotychczasowy_podmiot: 'Dom Maklerski Testowy S.A.' }, { kto: 'omega' })).dane;
  w = (await zadanie('POST', '/api/psa/portal/wniosek/zloz', {}, { kto: 'omega' })).dane;
  const id = w.wniosek.id;
  const umowa = w.dokumenty.find((d) => d.klucz === 'umowa');
  await zadanie('POST', '/api/psa/portal/wniosek/pliki', undefined, { kto: 'omega', plik: await podpisz('omega', umowa.pismo_id), pola: { dokument: 'umowa' } });

  const zwrot = await zadanie('POST', `/api/psa/wnioski/${id}/stan`, { stan: 'roboczy', notatka: 'Popraw adres spółki.' });
  assert.equal(zwrot.dane.wniosek.stan, 'roboczy');
  assert.match(wyslane.at(-1).temat, /wymaga uzupełnienia/);
  assert.equal((await zadanie('GET', '/api/psa/portal/wniosek', undefined, { kto: 'omega' })).dane.wniosek.notatka, 'Popraw adres spółki.');
  w = (await zadanie('POST', '/api/psa/portal/wniosek/zloz', {}, { kto: 'omega' })).dane;
  const nowa = w.dokumenty.find((d) => d.klucz === 'umowa');
  assert.notEqual(nowa.pismo_id, umowa.pismo_id, 'nowy dokument');
  assert.equal(nowa.stan, 'odrzucony', 'podpis starej wersji nieważny');

  // Kancelaria doprowadza wniosek do przyjęcia (podpisy potwierdzone) z datą przejęcia jutro.
  await zadanie('POST', '/api/psa/portal/wniosek/pliki', undefined, { kto: 'omega', plik: await podpisz('omega', nowa.pismo_id), pola: { dokument: 'umowa' } });
  await zadanie('POST', '/api/psa/portal/wniosek/pliki', undefined, { kto: 'omega', plik: { tresc: PDF_TESTOWY, nazwa: 'umowa-spolki.pdf' }, pola: { dokument: 'umowa_spolki' } });
  for (const d of (await zadanie('GET', `/api/psa/wnioski/${id}`)).dane.dokumenty) {
    if (d.klucz === 'uchwala' || d.klucz === 'umowa') {
      if (d.klucz === 'uchwala') await zadanie('POST', `/api/psa/wnioski/${id}/pliki`, undefined, { plik: { tresc: PDF_TESTOWY, nazwa: 'uchwala-papier.pdf' }, pola: { dokument: 'uchwala' } });
    }
  }
  for (const d of (await zadanie('GET', `/api/psa/wnioski/${id}`)).dane.dokumenty.filter((x) => x.stan === 'do_sprawdzenia')) {
    await zadanie('POST', `/api/psa/wnioski/${id}/pliki/${d.plik.id}`, { stan: 'potwierdzony' });
  }
  await zadanie('POST', `/api/psa/wnioski/${id}/pliki`, undefined, { plik: { tresc: PDF_TESTOWY, nazwa: 'umowa-qes.pdf' }, pola: { dokument: 'umowa_notariusz', umowe_zawarl: 'Anna Przykładowa — notariusz' } });
  const jutro = terminy.dodajDni(czas.dzisIso(), 1);
  w = (await zadanie('PUT', `/api/psa/wnioski/${id}`, { data_przejecia: jutro, checklista: { reprezentacja: true, uchwala: true, zgody: true, przejecie_umowa: true, przejecie_rejestr: true } })).dane;
  assert.deepEqual(w.przeszkody, []);
  const przyjecie = await zadanie('POST', `/api/psa/wnioski/${id}/stan`, { stan: 'przyjety' });
  assert.equal(przyjecie.status, 422, 'osoby z tym samym PESEL/KRS — wybór istniejąca czy nowa');
  const wybory = Object.fromEntries(przyjecie.dane.bledy.map((b) => [b.pole.split('.')[1], 'nowa']));

  w = (await zadanie('POST', `/api/psa/wnioski/${id}/stan`, { stan: 'przyjety', osoby: wybory })).dane;
  assert.equal(w.wniosek.stan, 'przyjety');
  assert.match(w.otwarcie.powod, /Dostępne od/);
  assert.equal((await zadanie('POST', `/api/psa/wnioski/${id}/otworz`, {})).status, 422);
  await zadanie('PUT', `/api/psa/wnioski/${id}`, { data_przejecia: czas.dzisIso() });
  const o = await zadanie('POST', `/api/psa/wnioski/${id}/otworz`, {});
  assert.equal(o.status, 201);
  assert.equal((await zadanie('GET', `/api/psa/sprawy/${o.dane.sprawa_id}`)).dane.sprawa.operacje[0].zrodlo, 'przejecie');
});

test('odrzucenie: powiadomienie o odmowie zawarcia umowy listem; wniosek pracownika — te same dokumenty', async () => {
  const z = (await zadanie('GET', '/api/psa/portal/wniosek', undefined, { kto: 'delta' })).dane.wniosek.id;
  await zadanie('PUT', '/api/psa/portal/wniosek', { dane: DANE('delta@example.com') }, { kto: 'delta' });
  await zadanie('POST', '/api/psa/portal/wniosek/zloz', {}, { kto: 'delta' });
  assert.equal((await zadanie('POST', `/api/psa/wnioski/${z}/stan`, { stan: 'odrzucony' })).status, 422, 'przyczyna obowiązkowa');
  const w = (await zadanie('POST', `/api/psa/wnioski/${z}/stan`, { stan: 'odrzucony', przyczyna: 'Spółka nie jest prostą spółką akcyjną.' })).dane;
  assert.equal(w.wniosek.stan, 'odrzucony');
  const odmowa = w.pisma.find((p) => p.typ === 'powiadomienie_odmowa');
  assert.equal(odmowa.kanal, 'list');

  const nowy = await zadanie('POST', '/api/psa/wnioski', { krs: '0000777009' });
  assert.equal(nowy.status, 201);
  const id = nowy.dane.wniosek.id;
  assert.equal(nowy.dane.konto, null);
  await zadanie('PUT', `/api/psa/wnioski/${id}`, { dane: DANE('rep@example.com') });
  const zl = await zadanie('POST', `/api/psa/wnioski/${id}/stan`, { stan: 'zlozony' });
  assert.equal(zl.dane.wniosek.stan, 'zlozony');
  assert.ok(zl.dane.dokumenty.find((d) => d.klucz === 'umowa').pismo_id);
  const pdf = await zadanie('GET', `/api/psa/wnioski/${id}/dokumenty/${zl.dane.dokumenty.find((d) => d.klucz === 'umowa').pismo_id}`);
  assert.equal(pdf.dane.subarray(0, 5).toString(), '%PDF-');
  const skan = await zadanie('POST', `/api/psa/wnioski/${id}/pliki`, undefined, { plik: { tresc: PDF_TESTOWY, nazwa: 'skan-z-poczty.pdf' }, pola: { dokument: 'umowa' } });
  assert.equal(skan.status, 201, 'plik pracownika (oryginał z poczty) trafia do sprawdzenia');

  // Audyt W3: limit plików wniosku — kolejny plik ponad limit jest odrzucany, a na dysku nic nie przybywa.
  const pliki = require('../server/pomocnicze/pliki');
  const { liczba, megabajty } = pliki.LIMITY;
  const wBazie = () => db().prepare('SELECT COUNT(*) AS n FROM psa_pliki WHERE wniosek_id = ?').get(id).n;
  try {
    pliki.LIMITY.liczba = wBazie();
    const ponad = await zadanie('POST', `/api/psa/wnioski/${id}/pliki`, undefined, { plik: { tresc: PDF_TESTOWY, nazwa: 'kolejny.pdf' }, pola: { dokument: 'umowa' } });
    assert.equal(ponad.status, 422);
    assert.match(JSON.stringify(ponad.dane), /Limit plików został wyczerpany/);
    assert.equal(wBazie(), pliki.LIMITY.liczba);
    pliki.LIMITY.liczba = liczba;
    pliki.LIMITY.megabajty = 0;
    const zaDuzo = await zadanie('POST', `/api/psa/wnioski/${id}/pliki`, undefined, { plik: { tresc: PDF_TESTOWY, nazwa: 'ciezki.pdf' }, pola: { dokument: 'umowa' } });
    assert.equal(zaDuzo.status, 422, 'limit łącznego rozmiaru');
  } finally {
    Object.assign(pliki.LIMITY, { liczba, megabajty });
  }
});

test('„Otwórz rejestr” jedną czynnością: błąd numerów nie zostawia niczego; poprawny projekt — przyjęcie i wpis otwarcia; drugi raz nic', async () => {
  const nowy = await zadanie('POST', '/api/psa/wnioski', { krs: '0000777010' });
  const id = nowy.dane.wniosek.id;
  await zadanie('PUT', `/api/psa/wnioski/${id}`, { dane: { ...DANE('nowy@example.com'), spolka: { ...DANE('x').spolka, nazwa: 'Kappa P.S.A.' } } });
  let w = (await zadanie('POST', `/api/psa/wnioski/${id}/stan`, { stan: 'zlozony' })).dane;
  assert.deepEqual(w.projekt.akcjonariusze.map((a) => a.klucz), ['reprezentant', 'b']);
  await zadanie('POST', `/api/psa/wnioski/${id}/pliki`, undefined, { plik: { tresc: PDF_TESTOWY, nazwa: 'umowa-spolki.pdf' }, pola: { dokument: 'umowa_spolki' } });
  for (const klucz of ['umowa', 'uchwala']) await zadanie('POST', `/api/psa/wnioski/${id}/pliki`, undefined, { plik: { tresc: PDF_TESTOWY, nazwa: `${klucz}-papier.pdf` }, pola: { dokument: klucz } });
  for (const d of (await zadanie('GET', `/api/psa/wnioski/${id}`)).dane.dokumenty.filter((x) => x.stan === 'do_sprawdzenia')) {
    await zadanie('POST', `/api/psa/wnioski/${id}/pliki/${d.plik.id}`, { stan: 'potwierdzony' });
  }
  await zadanie('POST', `/api/psa/wnioski/${id}/pliki`, undefined, { plik: { tresc: PDF_TESTOWY, nazwa: 'umowa-qes.pdf' }, pola: { dokument: 'umowa_notariusz', umowe_zawarl: 'Anna Przykładowa — notariusz' } });
  const seria = [{ seria: 'A', numery: '1-100', liczba: '100', data_wpisu_krs: '2026-01-10' }];
  const projekt = (b) => ({ serie: seria, akcje: { reprezentant: [{ seria: 'A', numery: '1-60', liczba: '60' }], b: [b] }, checklista: { dokumenty: true, identyfikacja: true } });
  w = (await zadanie('PUT', `/api/psa/wnioski/${id}`, { checklista: { reprezentacja: true, uchwala: true, zgody: true }, otwarcie: { ...projekt({ seria: 'A', numery: '61-90', liczba: '30' }), checklista: {} } })).dane;
  assert.deepEqual(w.przeszkody, []);
  assert.equal(w.projekt.akcje.b[0].numery, '61-90');
  const osoby = Object.fromEntries(w.osoby.filter((o) => o.pasujace.length).map((o) => [o.klucz, 'nowa']));
  const ile = () => ({
    spolki: db().prepare("SELECT COUNT(*) AS n FROM psa_spolki WHERE krs = '0000777010'").get().n,
    osoby: db().prepare('SELECT COUNT(*) AS n FROM psa_osoby').get().n,
    sprawy: db().prepare('SELECT COUNT(*) AS n FROM psa_sprawy').get().n,
    wpisy: db().prepare('SELECT COUNT(*) AS n FROM psa_zdarzenia').get().n,
  });
  const przed = ile();

  const bezChecklisty = await zadanie('POST', `/api/psa/wnioski/${id}/otworz-rejestr`, { osoby });
  assert.equal(bezChecklisty.status, 422);
  assert.deepEqual(bezChecklisty.dane.bledy.map((b) => b.pole), ['otwarcie.checklista']);

  await zadanie('PUT', `/api/psa/wnioski/${id}`, { otwarcie: projekt({ seria: 'A', numery: '61-90', liczba: '30' }) });
  const zle = await zadanie('POST', `/api/psa/wnioski/${id}/otworz-rejestr`, { osoby });
  assert.equal(zle.status, 422, 'akcje 91–100 bez akcjonariusza');
  assert.deepEqual(ile(), przed, 'błąd cofa przyjęcie: brak spółki, osób, sprawy i wpisu');
  assert.equal((await zadanie('GET', `/api/psa/wnioski/${id}`)).dane.wniosek.stan, 'zlozony');

  await zadanie('PUT', `/api/psa/wnioski/${id}`, { otwarcie: projekt({ seria: 'A', numery: '61-100', liczba: '41' }) });
  const zlaLiczba = await zadanie('POST', `/api/psa/wnioski/${id}/otworz-rejestr`, { osoby });
  assert.equal(zlaLiczba.status, 422);
  assert.ok(zlaLiczba.dane.bledy.some((b) => b.pole === 'otwarcie.akcje.b.0.liczba'), `błąd przy polu projektu: ${JSON.stringify(zlaLiczba.dane.bledy)}`);
  assert.deepEqual(ile(), przed);

  await zadanie('PUT', `/api/psa/wnioski/${id}`, { otwarcie: projekt({ seria: 'A', numery: '61-100', liczba: '40' }) });
  const ok = await zadanie('POST', `/api/psa/wnioski/${id}/otworz-rejestr`, { osoby });
  assert.equal(ok.status, 201, JSON.stringify(ok.dane));
  const rejestr = (await zadanie('GET', `/api/psa/spolki/${ok.dane.spolka_id}`)).dane;
  assert.ok(rejestr.spolka.data_otwarcia, 'rejestr otwarty');
  assert.deepEqual(rejestr.rejestr.akcjonariusze.map((p) => p.liczba), [60, 40]);
  assert.equal(rejestr.wpisy.length, 1);
  assert.equal(rejestr.oplaty.filter((o) => o.typ === 'prowadzenie').length, 1, 'pierwsza opłata za prowadzenie');
  assert.equal((await zadanie('GET', `/api/psa/wnioski/${id}`)).dane.wniosek.stan, 'przyjety');

  const po = ile();
  const drugi = await zadanie('POST', `/api/psa/wnioski/${id}/otworz-rejestr`, { osoby });
  assert.equal(drugi.status, 422);
  assert.match(JSON.stringify(drugi.dane), /Rejestr jest otwarty/);
  assert.deepEqual(ile(), po, 'drugie kliknięcie niczego nie dopisuje');

  // Audyt S6: konto wnioskodawcy przechodzi na osobę reprezentanta. Gdy pracownik wybiera osobę z kartoteki, która
  // nie ma konta, a ma dostęp do innej spółki (tu: reprezentant Kappy), przyjęcie wymaga potwierdzenia.
  const wnioski = require('../server/wnioski');
  const reprezentantKappy = db().prepare('SELECT osoba_id FROM psa_reprezentanci WHERE spolka_id = ?').get(ok.dane.spolka_id).osoba_id;
  await zglosIAktywuj('sigma', '0000777011');
  const wniosekSigmy = db().prepare("SELECT wniosek_id FROM psa_konta WHERE email = 'sigma@example.com'").get().wniosek_id;
  assert.match(wnioski.ostrzezenieKonta(db(), wniosekSigmy, reprezentantKappy), /sigma@example\.com.*Kappa P\.S\.A\./);
  const zKontem = db().prepare('SELECT osoba_id FROM psa_konta WHERE osoba_id IS NOT NULL LIMIT 1').get().osoba_id;
  assert.equal(wnioski.ostrzezenieKonta(db(), wniosekSigmy, zKontem), null, 'osoba ma własne konto — konto wniosku nie przechodzi na nią');
  assert.equal(wnioski.ostrzezenieKonta(db(), id, reprezentantKappy), null, 'wniosek pracownika nie ma konta');
});
