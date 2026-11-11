'use strict';

/**
 * Faza 5 — portal klienta (§ 6, § 7 pkt 2, U-23): zakres konta z danych, izolacja każdej trasy portalu
 * (tabela), Start dla trzech ról, „Zgłoś zmianę”, informacja z rejestru z płatnością (atrapa tpay + ITN),
 * odebranie dostępu (usunięcie z „Działają za spółkę”, wycofanie zgody, zbycie wszystkich akcji),
 * „Zaproś do portalu”, Konto.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-portal-http.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.PORTAL_WLACZONY = 'true';
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-portal-dokumenty');
fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
const SEKRET_ITN = 'sekret-itn-portalu';
Object.assign(process.env, { TPAY_CLIENT_ID: 'klient', TPAY_CLIENT_SECRET: 'sekret', TPAY_NOTIFICATION_SECRET: SEKRET_ITN, TPAY_TRYB_TESTOWY: 'false' });

const HASLO = 'Mocne-Haslo-2026!';
const wyslane = [];
const ciastka = {};
let ADRES;
let serwer;
let atrapa;
let db;
let czas;
const id = {};

/** Atrapa API tpay: token i zakładanie transakcji. */
function uruchomAtrape() {
  let n = 0;
  atrapa = http.createServer((zad, odp) => {
    zad.resume();
    zad.on('end', () => {
      odp.writeHead(200, { 'Content-Type': 'application/json' });
      if (zad.url === '/oauth/auth') return odp.end(JSON.stringify({ access_token: 't', expires_in: 7200 }));
      n += 1;
      return odp.end(JSON.stringify({ transactionId: `TR-${n}`, transactionPaymentUrl: `https://atrapa.example/${n}` }));
    });
  });
  return new Promise((r) => atrapa.listen(0, '127.0.0.1', () => { process.env.TPAY_API_URL = `http://127.0.0.1:${atrapa.address().port}`; r(); }));
}

async function zadanie(metoda, sciezka, cialo, { kto, plik = null } = {}) {
  const naglowki = { Cookie: ciastka[kto] || '', Origin: ADRES };
  let body;
  if (plik) {
    body = new FormData();
    body.append('plik', new Blob([plik]), 'umowa.pdf');
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

const portalu = (metoda, sciezka, cialo, kto, opcje = {}) => zadanie(metoda, `/api/psa/portal${sciezka}`, cialo, { kto, ...opcje });
const zaloguj = async (kto) => assert.equal((await portalu('POST', '/login', { email: `${kto}@example.com`, haslo: HASLO }, kto)).status, 200, kto);

test.before(async () => {
  await uruchomAtrape();
  const app = require('../serwer');
  ({ db } = require('../server/baza'));
  czas = require('../server/pomocnicze/czas');
  const poczta = require('../server/poczta');
  poczta.wyslij = async (w) => { wyslane.push(w); return { wyslano: true, idWiadomosci: 'test' }; };
  const { ustawKancelarie, dodajSpolke, dodajOsobe, otworz } = require('./pomoc');
  const hasla = require('../server/logika/hasla');
  const daneOsoby = require('../server/dane/osoby');
  const daneKonta = require('../server/dane/konta');
  const daneOplaty = require('../server/dane/oplaty');
  const informacje = require('../server/informacje');
  const pisma = require('../server/logika/pisma');
  const sprawy = require('../server/sprawy');
  ustawKancelarie(db());

  serwer = app.listen(0);
  ADRES = `http://localhost:${serwer.address().port}`;
  const hash = await hasla.hashuj(HASLO);
  db().prepare("INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, utworzono) VALUES ('Admin', 'admin@example.com', ?, 'admin', ?)").run(hash, czas.terazIso());
  assert.equal((await zadanie('POST', '/api/psa/auth/login', { email: 'admin@example.com', haslo: HASLO }, { kto: 'admin' })).status, 200);

  id.A = dodajSpolke(db(), { nazwa: 'Alfa P.S.A.' });
  id.B = dodajSpolke(db(), { nazwa: 'Beta P.S.A.' });
  const osoba = (kto, zgoda) => {
    const o = dodajOsobe(db(), { nazwa: kto, email: `${kto}@example.com` });
    if (zgoda) daneOsoby.ustawZgodeEmail(db(), o, { zgoda: true }, 'test');
    return o;
  };
  // rafal — działa za A; anna — akcjonariuszka A ze zgodą; jan — akcjonariusz A bez zgody;
  // zofia — działa za A i ma akcje A; bogdan — działa za B; piotr — akcjonariusz B ze zgodą.
  for (const [kto, zgoda] of [['rafal', 0], ['anna', 1], ['jan', 0], ['zofia', 1], ['bogdan', 0], ['piotr', 1], ['celina', 0]]) id[kto] = osoba(kto, zgoda);
  const seria = { seria: 'A', numery: '1-100', liczba: 100, data_wpisu_krs: '2026-01-10' };
  const akcje = (numery, liczba) => [{ seria: 'A', numery, liczba }];
  otworz(db(), id.A, { serie: [seria], akcjonariusze: [{ osoba_id: id.anna, akcje: akcje('1-50', 50) }, { osoba_id: id.jan, akcje: akcje('51-80', 30) }, { osoba_id: id.zofia, akcje: akcje('81-100', 20) }] });
  otworz(db(), id.B, { serie: [seria], akcjonariusze: [{ osoba_id: id.piotr, akcje: akcje('1-100', 100) }] });
  for (const [s, o] of [[id.A, id.rafal], [id.A, id.zofia], [id.B, id.bogdan], [id.A, id.celina]]) daneKonta.dodajReprezentanta(db(), s, o);

  for (const kto of ['rafal', 'anna', 'jan', 'zofia', 'bogdan', 'piotr']) {
    const k = daneKonta.dodaj(db(), { email: `${kto}@example.com`, osoba_id: id[kto] });
    db().prepare('UPDATE psa_konta SET hash_hasla = ?, aktywne = 1 WHERE id = ?').run(hash, k);
  }
  const wnioski = require('../server/wnioski');
  id.wniosek = await wnioski.zglos(db(), { krs: '0000777123', email: 'wies@example.com' }, { poczta });
  db().prepare('UPDATE psa_konta SET hash_hasla = ?, aktywne = 1 WHERE wniosek_id = ?').run(hash, id.wniosek);

  // Pisma wysłane, opłaty i sprawy obu spółek.
  const wyslij = (w) => { pisma.zmienStan(db(), w.pismoId, 'wyslane'); return w.pismoId; };
  id.pismoA_spolka = wyslij(informacje.wydajInformacje(db(), { spolkaId: id.A, odbiorca: { rodzaj: 'spolka' }, oplata: 'nie', kto: 'test' }));
  id.pismoA_anna = wyslij(informacje.wydajInformacje(db(), { spolkaId: id.A, odbiorca: { rodzaj: 'osoba', osobaId: id.anna }, oplata: 'tak', kto: 'test' }));
  id.pismoB = wyslij(informacje.wydajInformacje(db(), { spolkaId: id.B, odbiorca: { rodzaj: 'spolka' }, oplata: 'nie', kto: 'test' }));
  id.oplataA_anna = db().prepare('SELECT id FROM psa_oplaty WHERE pismo_id = ?').get(id.pismoA_anna).id;
  const prowadzenie = (spolka) => daneOplaty.dodaj(db(), { spolka_id: spolka, typ: 'prowadzenie', platnik: 'spolka', okres: '2026-01-10..2027-01-09', kwota_netto_grosze: 120000, stawka_vat_procent: 23, autor: 'test' });
  id.oplataA_spolka = prowadzenie(id.A);
  id.oplataB = prowadzenie(id.B);
  const sprawa = (spolka, zadajacy, osobaId) => sprawy.zaloz(db(), { spolka_id: spolka, zadajacy, zadajacy_osoba_id: osobaId, podstawa: 'test', operacje: [] }, 'test').id;
  id.sprawaA_anna = sprawa(id.A, 'osoba', id.anna);
  id.sprawaA_spolka = sprawa(id.A, 'spolka');
  id.sprawaB = sprawa(id.B, 'spolka');

  // Informacja w portalu — najpóźniej za wczoraj, a rejestry otwarto dziś.
  czas.ustawPrzesuniecie(2 * 864e5);
  for (const kto of ['rafal', 'anna', 'jan', 'zofia', 'bogdan', 'piotr', 'wies']) await zaloguj(kto);
});

test.after(() => {
  czas.ustawPrzesuniecie(0);
  serwer.close();
  atrapa.close();
  for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

/** Każda trasa portalu z zasobem — dla każdego konta: dostęp albo 404 (bez ujawniania istnienia). */
const ZASOBY = {
  startA: (k) => portalu('GET', `/start?spolka=${id.A}`, undefined, k),
  startB: (k) => portalu('GET', `/start?spolka=${id.B}`, undefined, k),
  zglosA: (k) => portalu('POST', '/sprawy', { spolka_id: id.A, opis: 'Sprzedaż akcji' }, k),
  zglosB: (k) => portalu('POST', '/sprawy', { spolka_id: id.B, opis: 'Sprzedaż akcji' }, k),
  plikA_anna: (k) => portalu('POST', `/sprawy/${id.sprawaA_anna}/pliki`, undefined, k, { plik: PDF }),
  plikA_spolka: (k) => portalu('POST', `/sprawy/${id.sprawaA_spolka}/pliki`, undefined, k, { plik: PDF }),
  plikB: (k) => portalu('POST', `/sprawy/${id.sprawaB}/pliki`, undefined, k, { plik: PDF }),
  pismoA_spolka: (k) => portalu('GET', `/pisma/${id.pismoA_spolka}`, undefined, k),
  pismoA_anna: (k) => portalu('GET', `/pisma/${id.pismoA_anna}`, undefined, k),
  pismoB: (k) => portalu('GET', `/pisma/${id.pismoB}`, undefined, k),
  infoA: (k) => portalu('POST', '/informacja', { spolka_id: id.A }, k),
  infoB: (k) => portalu('POST', '/informacja', { spolka_id: id.B }, k),
  oplataA_spolka: (k) => portalu('POST', `/oplaty/${id.oplataA_spolka}/zaplac`, {}, k),
  oplataA_anna: (k) => portalu('POST', `/oplaty/${id.oplataA_anna}/zaplac`, {}, k),
  oplataB: (k) => portalu('POST', `/oplaty/${id.oplataB}/zaplac`, {}, k),
  wniosek: (k) => portalu('GET', '/wniosek', undefined, k),
  wniosekDokument: (k) => portalu('GET', '/wniosek/dokumenty/1', undefined, k),
};
const PELNY_A = ['startA', 'zglosA', 'plikA_anna', 'plikA_spolka', 'pismoA_spolka', 'infoA', 'oplataA_spolka'];
const DOSTEP = {
  rafal: PELNY_A,
  anna: ['startA', 'zglosA', 'plikA_anna', 'pismoA_anna', 'infoA', 'oplataA_anna'],
  jan: [],
  zofia: PELNY_A,
  bogdan: ['startB', 'zglosB', 'plikB', 'pismoB', 'infoB', 'oplataB'],
  wies: ['wniosek'],
};

test('§ 7 pkt 2: izolacja każdej trasy portalu — dostęp wyłącznie z zakresu konta, poza nim 404', async () => {
  for (const [kto, dozwolone] of Object.entries(DOSTEP)) {
    for (const [zasob, wywolaj] of Object.entries(ZASOBY)) {
      const { status, dane } = await wywolaj(kto);
      if (dozwolone.includes(zasob)) assert.ok(status < 300, `${kto} → ${zasob}: ${status} ${JSON.stringify(dane)}`);
      else assert.equal(status, 404, `${kto} → ${zasob}: ${status} ${JSON.stringify(dane)}`);
    }
  }
  for (const wywolaj of Object.values(ZASOBY)) assert.equal((await wywolaj('nikt')).status, 401, 'bez logowania');
});

test('U-23: Start — osoba działająca za spółkę widzi wszystko o spółce, akcjonariusz swoje; obie role — suma', async () => {
  const start = async (kto) => (await portalu('GET', `/start?spolka=${id.A}`, undefined, kto)).dane;
  const rafal = await start('rafal');
  const anna = await start('anna');
  const zofia = await start('zofia');
  assert.deepEqual(rafal.rola, { pelny: true, akcjonariusz: false });
  assert.deepEqual(anna.rola, { pelny: false, akcjonariusz: true });
  assert.deepEqual(zofia.rola, { pelny: true, akcjonariusz: true });
  assert.ok(rafal.sprawy.some((s) => s.id === id.sprawaA_anna) && rafal.sprawy.some((s) => s.id === id.sprawaA_spolka));
  assert.ok(anna.sprawy.every((s) => s.id !== id.sprawaA_spolka) && anna.sprawy.some((s) => s.id === id.sprawaA_anna));
  assert.ok(anna.oplaty.some((o) => o.id === id.oplataA_anna) && !anna.oplaty.some((o) => o.id === id.oplataA_spolka));
  assert.ok(rafal.oplaty.some((o) => o.id === id.oplataA_spolka) && !rafal.oplaty.some((o) => o.id === id.oplataA_anna));
  assert.deepEqual(anna.informacje.map((p) => p.id), [id.pismoA_anna]);
  assert.deepEqual(rafal.informacje.map((p) => p.id), [id.pismoA_spolka]);
  assert.ok(anna.oplaty.every((o) => o.kwota_brutto_grosze === 6150), 'kwota brutto na przycisku');
  assert.equal(JSON.stringify(rafal).includes('jan@example.com'), false, 'bez akcjonariatu na Starcie');
  const jan = await portalu('GET', '/start', undefined, 'jan');
  assert.equal(jan.dane.spolka, null, 'akcjonariusz bez zgody na e-mail nie ma zakresu (D-083)');
  const ja = await portalu('GET', '/ja', undefined, 'zofia');
  assert.deepEqual(ja.dane.spolki.map((s) => [s.nazwa, s.pelny, s.akcjonariusz]), [['Alfa P.S.A.', true, true]]);
});

test('„Zgłoś zmianę”: sprawa w toku (żądający spółka albo osoba), plik do sprawy, dwuklik nie zakłada drugiej, Pulpit', async () => {
  const z1 = await portalu('POST', '/sprawy', { spolka_id: id.A, opis: 'Anna sprzedała 10 akcji.', klucz: 'k1' }, 'anna');
  const z2 = await portalu('POST', '/sprawy', { spolka_id: id.A, opis: 'Anna sprzedała 10 akcji.', klucz: 'k1' }, 'anna');
  assert.equal(z1.status, 201);
  assert.equal(z2.dane.id, z1.dane.id, 'ten sam klucz — ta sama sprawa');
  const s = db().prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(z1.dane.id);
  assert.deepEqual([s.stan, s.zadajacy, s.zadajacy_osoba_id, s.podstawa], ['w_toku', 'osoba', id.anna, 'Anna sprzedała 10 akcji.']);
  const r = await portalu('POST', '/sprawy', { spolka_id: id.A, opis: 'Zmiana adresu spółki' }, 'zofia');
  assert.equal(db().prepare('SELECT zadajacy FROM psa_sprawy WHERE id = ?').get(r.dane.id).zadajacy, 'spolka');
  assert.equal((await portalu('POST', '/sprawy', { spolka_id: id.A, opis: '' }, 'anna')).status, 422);
  assert.equal((await portalu('POST', `/sprawy/${z1.dane.id}/pliki`, undefined, 'anna', { plik: PDF })).status, 201);
  assert.equal((await portalu('POST', `/sprawy/${z1.dane.id}/pliki`, undefined, 'anna', { plik: Buffer.from('<html>') })).status, 422, 'tylko PDF i formaty podpisu');
  const pulpit = (await zadanie('GET', '/api/psa/pulpit', undefined, { kto: 'admin' })).dane;
  assert.ok(JSON.stringify(pulpit).includes(`Sprawa nr ${z1.dane.id}`), 'nowe zgłoszenie z portalu na Pulpicie');
});

test('U-24: informacja — wybór dnia (najpóźniej wczoraj), zapłata przez tpay, pobranie po ITN, wersja według roli', async () => {
  const dzis = czas.dzisIso();
  const zle = await portalu('POST', '/informacja', { spolka_id: id.A, dzien: dzis }, 'anna');
  assert.equal(zle.status, 422, 'dzisiejszy stan — tylko w kancelarii');
  const z = await portalu('POST', '/informacja', { spolka_id: id.A }, 'anna');
  assert.equal((await portalu('POST', '/informacja', { spolka_id: id.A }, 'anna')).dane.oplata_id, z.dane.oplata_id, 'dwuklik — jeden dług');
  const oplata = db().prepare('SELECT * FROM psa_oplaty WHERE id = ?').get(z.dane.oplata_id);
  const pismo = db().prepare('SELECT * FROM psa_pisma WHERE id = ?').get(oplata.pismo_id);
  assert.deepEqual([oplata.platnik, oplata.platnik_osoba_id, pismo.adresat, pismo.adresat_osoba_id, pismo.kanal], ['osoba', id.anna, 'osoba', id.anna, 'portal']);
  assert.equal((await portalu('GET', `/pisma/${pismo.id}`, undefined, 'anna')).status, 404, 'przed zapłatą nie do pobrania');

  const link = await portalu('POST', `/oplaty/${oplata.id}/zaplac`, {}, 'anna');
  assert.match(link.dane.link, /^https:\/\/atrapa\.example\//);
  const p = db().prepare("SELECT * FROM psa_platnosci WHERE oplata_id = ? AND status = 'oczekuje'").get(oplata.id);
  assert.equal(p.kwota_grosze, 6150);
  const itn = { id: '1', tr_id: p.tpay_id, tr_amount: '61.50', tr_crc: p.crc, tr_status: 'TRUE', tr_error: 'none', test_mode: '0' };
  itn.md5sum = crypto.createHash('md5').update(`${itn.id}${itn.tr_id}${itn.tr_amount}${itn.tr_crc}${SEKRET_ITN}`).digest('hex');
  const odp = await fetch(`${ADRES}/api/psa/platnosci/tpay/itn`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(itn) });
  assert.equal(await odp.text(), 'TRUE');

  const start = (await portalu('GET', `/start?spolka=${id.A}`, undefined, 'anna')).dane;
  assert.ok(start.informacje.some((i) => i.id === pismo.id) && !start.oplaty.some((o) => o.id === oplata.id));
  const pdf = await portalu('GET', `/pisma/${pismo.id}`, undefined, 'anna');
  assert.equal(pdf.dane.subarray(0, 5).toString(), '%PDF-');
  assert.equal((await portalu('GET', `/pisma/${pismo.id}`, undefined, 'rafal')).status, 404, 'informacja akcjonariuszki — nie dla spółki');
  const kontoAnny = `konto:${db().prepare('SELECT id FROM psa_konta WHERE osoba_id = ?').get(id.anna).id}`;
  assert.ok(db().prepare("SELECT 1 FROM psa_dziennik WHERE akcja = 'informacja_z_rejestru' AND typ_kto = 'portal' AND kto = ?").get(kontoAnny), 'ślad w dzienniku');

  const pelna = await portalu('POST', '/informacja', { spolka_id: id.A }, 'zofia');
  const pz = db().prepare('SELECT p.adresat, o.platnik FROM psa_oplaty o JOIN psa_pisma p ON p.id = o.pismo_id WHERE o.id = ?').get(pelna.dane.oplata_id);
  assert.deepEqual(pz, { adresat: 'spolka', platnik: 'spolka' }, 'osoba w obu rolach — informacja pełna na koszt spółki');
});

test('Odebranie dostępu: usunięcie z „Działają za spółkę”, wycofanie zgody, zbycie wszystkich akcji — od razu, bez wylogowania', async () => {
  const usun = await zadanie('DELETE', `/api/psa/spolki/${id.A}/reprezentanci/${id.rafal}`, undefined, { kto: 'admin' });
  assert.equal(usun.status, 200);
  assert.equal((await portalu('GET', `/start?spolka=${id.A}`, undefined, 'rafal')).status, 404);
  const kokpit = (await zadanie('GET', `/api/psa/spolki/${id.A}`, undefined, { kto: 'admin' })).dane;
  assert.ok(kokpit.historia.some((h) => h.pole === 'dzialaja_za_spolke' && h.nowa === 'rafal — usunięto'));
  assert.ok(!kokpit.reprezentanci.some((r) => r.id === id.rafal));
  const dodaj = await zadanie('POST', `/api/psa/spolki/${id.A}/reprezentanci`, { osoba_id: id.rafal }, { kto: 'admin' });
  assert.equal(dodaj.status, 201);
  assert.equal((await portalu('GET', `/start?spolka=${id.A}`, undefined, 'rafal')).status, 200, 'przywrócony');

  assert.equal((await portalu('PUT', '/konto', { zgoda_email: false }, 'anna')).status, 200);
  assert.equal((await portalu('GET', `/start?spolka=${id.A}`, undefined, 'anna')).status, 404, 'wycofana zgoda (D-083)');
  const ja = (await portalu('GET', '/ja', undefined, 'anna')).dane;
  assert.deepEqual([ja.spolki.length, ja.akcjonariusz, ja.zgoda_email], [0, true, false], 'Konto nadal pokazuje przełącznik zgody');
  assert.equal((await portalu('PUT', '/konto', { zgoda_email: true }, 'anna')).dane.spolki.length, 1, 'zgoda złożona w portalu przywraca dostęp');

  const { wpisz } = require('./pomoc');
  wpisz(db(), id.B, [{ typ: 'przeniesienie', zbywca_osoba_id: id.piotr, nabywcy: [{ osoba_id: id.bogdan, akcje: [{ seria: 'A', numery: '1-100', liczba: 100 }] }] }]);
  assert.equal((await portalu('GET', `/start?spolka=${id.B}`, undefined, 'piotr')).status, 404, 'zbycie wszystkich akcji (D-039)');
});

test('„Zaproś do portalu”: tylko osoba działająca za spółkę albo akcjonariusz ze zgodą; link do hasła, e-mail bez danych', async () => {
  const zapros = (o) => zadanie('POST', `/api/psa/osoby/${o}/zaproszenie`, {}, { kto: 'admin' });
  assert.equal((await zapros(id.jan)).status, 422, 'akcjonariusz bez zgody');
  const r = await zapros(id.celina);
  assert.equal(r.status, 200, JSON.stringify(r.dane));
  assert.equal(r.dane.konto.aktywne, false);
  const mail = wyslane.at(-1);
  assert.equal(mail.do, 'celina@example.com');
  assert.ok(!mail.tekst.includes('celina') && !mail.tekst.includes('Alfa'), 'e-mail bez danych osobowych');
  const token = mail.tekst.match(/token=([0-9a-f]+)/)[1];
  const a = await portalu('POST', '/aktywacja', { token, haslo: HASLO, regulamin: true }, 'celina');
  assert.equal(a.status, 200);
  assert.equal((await portalu('GET', `/start?spolka=${id.A}`, undefined, 'celina')).dane.spolka.nazwa, 'Alfa P.S.A.');
  const karta = (await zadanie('GET', `/api/psa/osoby/${id.celina}`, undefined, { kto: 'admin' })).dane;
  assert.deepEqual([karta.konto.aktywne, karta.konto.spolki.length], [true, 1]);
  assert.ok(karta.historia.some((h) => h.pole === 'zaproszenie_do_portalu'));

  // Ponowne zaproszenie = nowe hasło; dotychczasowe sesje wygasają.
  await zapros(id.celina);
  const token2 = wyslane.at(-1).tekst.match(/token=([0-9a-f]+)/)[1];
  await portalu('POST', '/aktywacja', { token: token2, haslo: `${HASLO}x`, regulamin: true }, 'celina-2');
  assert.equal((await portalu('GET', '/start', undefined, 'celina')).status, 401, 'stara sesja unieważniona');

  db().prepare('UPDATE psa_osoby SET email = ? WHERE id = ?').run('wies@example.com', id.bogdan);
  assert.equal((await zapros(id.bogdan)).status, 422, 'adres zajęty przez konto innego wniosku');
});

test('Konto: zmiana hasła wymaga obecnego i wylogowuje inne urządzenia; konto wniosku po przyjęciu traci ekrany wniosku', async () => {
  await zaloguj('zofia');
  ciastka['zofia-2'] = ciastka.zofia;
  assert.equal((await portalu('PUT', '/konto', { haslo_obecne: 'zle', haslo_nowe: 'Nowe-Mocne-Haslo-2026' }, 'zofia')).status, 422);
  assert.equal((await portalu('PUT', '/konto', { haslo_obecne: HASLO, haslo_nowe: 'Nowe-Mocne-Haslo-2026' }, 'zofia')).status, 200);
  assert.equal((await portalu('GET', '/start', undefined, 'zofia')).status, 200, 'bieżąca sesja zostaje');
  assert.equal((await portalu('GET', '/start', undefined, 'zofia-2')).status, 401, 'inne urządzenie wylogowane');

  db().prepare("UPDATE psa_wnioski SET stan = 'przyjety' WHERE id = ?").run(id.wniosek);
  assert.equal((await portalu('GET', '/wniosek', undefined, 'wies')).status, 404);
  assert.equal((await portalu('GET', '/ja', undefined, 'wies')).dane.wniosek, null);
});

test('§ 6: portal ma najwyżej 20 tras — lista zmienia się świadomie', () => {
  const router = require('../server/trasy/portal');
  const trasy = router.stack.filter((w) => w.route).map((w) => `${Object.keys(w.route.methods)[0].toUpperCase()} ${w.route.path}`);
  assert.deepEqual(trasy, [
    'POST /zgloszenie', 'POST /aktywacja', 'POST /login', 'POST /logout', 'GET /ja',
    'GET /wniosek', 'PUT /wniosek', 'POST /wniosek/zloz', 'POST /wniosek/pliki', 'GET /wniosek/dokumenty/:pismo',
    'GET /start', 'POST /sprawy', 'POST /sprawy/:id/pliki', 'GET /pisma/:id', 'POST /informacja', 'POST /oplaty/:id/zaplac', 'PUT /konto',
  ]);
});
