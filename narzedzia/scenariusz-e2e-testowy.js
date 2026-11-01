'use strict';

/**
 * Scenariusz E2E w TRYBIE TESTOWYM (Faza 5, SESJA-PSA-WYTYCZNE.md; D-074).
 *
 *   node narzedzia/scenariusz-e2e.js --tryb-testowy      (albo: npm run scenariusz:testowy)
 *
 * 1. `npm run test:seed` — świeża baza testowa z danymi fikcyjnymi.
 * 2. Serwer w tym procesie (PSA_TRYB_TESTOWY=1), logowanie kontami testowymi,
 *    wiadomości ze skrzynki testowej (nic nie wychodzi na zewnątrz).
 * 3. Scenariusze (każdy kończy się kontrolami ✓/✗):
 *    A. zgłoszenie przeniesienia → zaproszenie ze skrzynki → wniosek → podpisy
 *       (podstawowy test pliku i atrapa — D-086) → przyjęcie wniosku,
 *    B. wpis zbycia bez zgody zbywcy → list do wysyłki → nadanie odblokowuje wpis,
 *    C. zgody akcjonariusza (oświadczenia w portalu, blokada portalu bez zgody),
 *    D. przeniesienie rejestru do statusu „Aktywny” (PRZEJĘCIE na początku łańcucha),
 *    E. data symulowana po 18.02.2027: informacja z rejestru w wersji dla spółki
 *       i dla akcjonariusza (maskowanie), zadania terminowe nowelizacji.
 * Kod wyjścia 1, gdy którakolwiek kontrola nie przeszła.
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const KORZEN = path.join(__dirname, '..');

let ADRES;
let wyniki = { ok: 0, zle: [] };

function sesja() {
  return { ciastka: {} };
}

async function zapytaj(s, metoda, sciezka, cialo, { formularz = false, oczekiwanyBlad = false } = {}) {
  const naglowki = { Cookie: Object.entries(s.ciastka).map(([k, v]) => `${k}=${v}`).join('; ') };
  let body;
  if (cialo instanceof FormData) {
    body = cialo;
  } else if (cialo !== undefined) {
    naglowki['Content-Type'] = formularz ? 'application/x-www-form-urlencoded' : 'application/json';
    body = formularz ? new URLSearchParams(cialo).toString() : JSON.stringify(cialo);
  }
  const odp = await fetch(`${ADRES}${sciezka}`, { method: metoda, headers: naglowki, body, redirect: 'manual' });
  for (const c of odp.headers.getSetCookie()) {
    const [para] = c.split(';');
    const [k, ...v] = para.split('=');
    s.ciastka[k.trim()] = v.join('=');
  }
  const typ = odp.headers.get('content-type') || '';
  const dane = typ.includes('json') ? await odp.json() : await odp.text();
  if (odp.status >= 400 && !oczekiwanyBlad) {
    throw new Error(`${metoda} ${sciezka} → ${odp.status}: ${typeof dane === 'string' ? dane.slice(0, 300) : JSON.stringify(dane)}`);
  }
  return oczekiwanyBlad ? { status: odp.status, dane } : dane;
}

function plik(nazwa, { pole = 'plik', pola = {}, typ = 'application/pdf' } = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(pola)) f.append(k, v);
  f.append(pole, new Blob([Buffer.from(`%PDF-1.4\n${nazwa}\n%%EOF\n`)], { type: typ }), nazwa);
  return f;
}

/** Fikcyjny PESEL z poprawną sumą kontrolną. */
function pesel(rrmmdd, seria) {
  const cyfry = `${rrmmdd}${seria}`.split('').map(Number);
  const suma = cyfry.reduce((s, c, i) => s + c * [1, 3, 7, 9, 1, 3, 7, 9, 1, 3][i], 0);
  return `${rrmmdd}${seria}${(10 - (suma % 10)) % 10}`;
}

function sekcja(tytul) {
  console.log(`\n── ${tytul} ${'─'.repeat(Math.max(0, 66 - tytul.length))}`);
}

function sprawdz(warunek, opis, szczegol = '') {
  if (warunek) {
    wyniki.ok += 1;
    console.log(`  ✓ ${opis}`);
  } else {
    wyniki.zle.push(opis);
    console.log(`  ✗ ${opis}${szczegol ? ` — ${szczegol}` : ''}`);
  }
}

async function zaloguj(kto, aplikacja = 'portal') {
  const s = sesja();
  const trasa = aplikacja === 'kancelaria' ? '/api/psa/auth/login' : '/api/psa/portal/login';
  await zapytaj(s, 'POST', trasa, { email: kto, haslo: require('../server/tryb-testowy').HASLO_TESTOWE, droga_testowa: 'formularz' });
  return s;
}

async function ustawWalidator(wynik) {
  await zapytaj(sesja(), 'POST', '/test/walidator', { wynik }, { formularz: true });
}

async function ustawDate(dzien) {
  await zapytaj(sesja(), 'POST', '/test/data', { data: dzien || '' }, { formularz: true });
}

async function zaplacAtrapa(s, zamowienie) {
  if (zamowienie.oplacona) return;
  const id = String(zamowienie.link || '').split('/').pop();
  await zapytaj(sesja(), 'POST', `/test/tpay/kasa/${id}/itn`, { wynik: 'TRUE' }, { formularz: true });
}

// ─────────────────────────────────────────────────────────────

async function scenariuszA(k) {
  sekcja('A. Zgłoszenie przeniesienia → wniosek → podpisy (test pliku, D-086)');
  const { db } = require('../server/baza');
  const skrzynka = require('../server/tryb-testowy/skrzynka');
  const tryb = require('../server/tryb-testowy');

  const panel = await zapytaj(sesja(), 'GET', '/test');
  sprawdz(String(panel).includes('Panel trybu testowego'), 'panel /test działa w trybie testowym');

  const zaproszenie = skrzynka.lista().find((w) => w.do === 'beta.zarzad@example.com' && /Zaproszenie/.test(w.temat));
  sprawdz(Boolean(zaproszenie), 'zaproszenie Beta w skrzynce testowej (nie wysłane na zewnątrz)');
  const token = (skrzynka.wiadomosc(zaproszenie.id).html.match(/aktywuj\/([\w-]+)/) || [])[1];
  sprawdz(Boolean(token), 'link aktywacyjny odczytany z wiadomości');

  const beta = sesja();
  await zapytaj(beta, 'POST', `/api/psa/portal/aktywacja/${token}`, { haslo: tryb.HASLO_TESTOWE });
  await zapytaj(beta, 'POST', '/api/psa/portal/rodo');
  const przenPortal = await zapytaj(beta, 'GET', '/api/psa/portal/przeniesienie');
  sprawdz(przenPortal.przeniesienie && przenPortal.przeniesienie.status === 'zgloszone', 'portal: przeniesienie w statusie „Zgłoszone”');

  await zapytaj(beta, 'PUT', '/api/psa/portal/wniosek', {
    nazwa: 'Beta Przenoszona P.S.A.', forma_prawna: 'PROSTA SPÓŁKA AKCYJNA', krs: '0000990002',
    kraj: 'Polska', kod_pocztowy: '80-004', miejscowosc: 'Gdańsk', ulica: 'Przeniesienia', nr_domu: '2',
    email: 'beta.zarzad@example.com', data_zawarcia_umowy_spolki: '2025-02-01',
    reprezentant_imie_nazwisko: 'Barbara Betowska', reprezentant_funkcja: 'Prezes zarządu',
    reprezentant_reprezentacja: 'samodzielnie', reprezentant_email: 'beta.zarzad@example.com',
    reprezentant_pesel: pesel('810203', '2468'),
  });
  await zapytaj(beta, 'POST', '/api/psa/portal/wniosek/akcjonariusze', {
    typ: 'fizyczna', imie: 'Barbara', nazwisko: 'Betowska', pesel: pesel('810203', '2468'), data_urodzenia: '1981-02-03',
    plec: 'kobieta', kod_pocztowy: '80-004', miejscowosc: 'Gdańsk', ulica: 'Przeniesienia', nr_domu: '2',
    rodzaj_adresu_rejestrowego: 'zamieszkania', email: 'beta.zarzad@example.com', zgoda_email_status: 'zadeklarowana',
  });
  await zapytaj(beta, 'POST', '/api/psa/portal/wniosek/zloz', {});
  const wniosekId = db().prepare("SELECT w.id FROM psa_wnioski w JOIN psa_konta k ON k.id = w.konto_id WHERE k.email = 'beta.zarzad@example.com'").get().id;
  await zapytaj(k, 'POST', `/api/psa/wnioski/${wniosekId}/dokumenty/wystaw`, {});
  const udost = await zapytaj(k, 'POST', `/api/psa/wnioski/${wniosekId}/dokumenty/udostepnij`, {});
  sprawdz(skrzynka.lista().some((w) => w.do === 'beta.zarzad@example.com' && /Dokumenty do podpisu/.test(w.temat)),
    'e-mail „Dokumenty do podpisu” w skrzynce testowej');

  const dokumenty = udost.dokumenty || [];
  const pierwszy = dokumenty[0];
  const OCZEKIWANE = { podpisany: 'do_weryfikacji', brak_podpisu: 'odrzucony', zmieniony: 'odrzucony' };
  for (const wynik of Object.keys(OCZEKIWANE)) {
    await ustawWalidator(wynik);
    const odp = await zapytaj(beta, 'POST', `/api/psa/portal/wniosek/dokumenty/${pierwszy.id}/podpis`,
      plik(`podpisany-${wynik}.pdf`), { oczekiwanyBlad: true });
    const walidacja = odp.dane.walidacja || (odp.dane.szczegoly && odp.dane.szczegoly.walidacja) || {};
    const kod = OCZEKIWANE[wynik] === 'odrzucony' ? 400 : 201;
    sprawdz(odp.status === kod && walidacja.wynik === OCZEKIWANE[wynik],
      `atrapa „${tryb.WYNIKI_WALIDATORA[wynik]}” → ${OCZEKIWANE[wynik]}${kod === 400 ? ' (plik nie przyjęty, komunikat dla klienta)' : ''}`,
      `HTTP ${odp.status}, wynik ${walidacja.wynik}`);
  }
  // Test jak na produkcji (D-086): plik bez podpisu odrzucony; „podpisany” bez oryginału z portalu — też (inny dokument).
  await ustawWalidator('plik');
  const bezPodpisu = await zapytaj(beta, 'POST', `/api/psa/portal/wniosek/dokumenty/${pierwszy.id}/podpis`, plik('skan.pdf'), { oczekiwanyBlad: true });
  sprawdz(bezPodpisu.status === 400 && /Skanu nie przyjmujemy/.test(JSON.stringify(bezPodpisu.dane)), 'test pliku: PDF bez podpisu odrzucony');
  await ustawWalidator('podpisany');
  for (const d of dokumenty) await zapytaj(beta, 'POST', `/api/psa/portal/wniosek/dokumenty/${d.id}/podpis`, plik(`podpisany-${d.typ}.pdf`));
  await zapytaj(beta, 'POST', '/api/psa/portal/wniosek/odeslij');

  const szczegoly = await zapytaj(k, 'GET', `/api/psa/wnioski/${wniosekId}`);
  for (const a of szczegoly.akcjonariusze) {
    await zapytaj(k, 'POST', `/api/psa/wnioski/${wniosekId}/akcjonariusze/${a.id}/zweryfikuj`, { zweryfikowano: true });
  }
  for (const d of szczegoly.dokumenty) await zapytaj(k, 'POST', `/api/psa/wnioski/${wniosekId}/dokumenty/${d.id}/podpis-potwierdz`, { forma: 'qes' });
  const przyjecie = await zapytaj(k, 'POST', `/api/psa/wnioski/${wniosekId}/przyjmij`, {});
  const zdarzen = db().prepare('SELECT COUNT(*) AS n FROM psa_zdarzenia WHERE spolka_id = ?').get(przyjecie.spolka_id).n;
  sprawdz(Boolean(przyjecie.spolka_id) && zdarzen === 0, 'wniosek przyjęty — spółka założona, rejestru jeszcze nie otwarto (Etap 7)');
  return { beta, spolkaId: przyjecie.spolka_id };
}

async function scenariuszB(k) {
  sekcja('B. Wpis zbycia bez zgody zbywcy → list do wysyłki');
  const skrzynka = require('../server/tryb-testowy/skrzynka');
  const { listy } = await zapytaj(k, 'GET', '/api/psa/listy?status=do_wyslania');
  const list = listy.find((l) => /Próbny/.test(l.odbiorca_nazwa));
  sprawdz(Boolean(list), 'powiadomienie zbywcy bez zgody na e-mail trafiło do „Listy do wysyłki”');
  sprawdz(!skrzynka.lista().some((w) => w.do === 'bartosz.bezzgody@example.com'), 'brak e-maila do zbywcy bez zgody');
  const pismo = await zapytaj(k, 'GET', `/api/psa/listy/${list.id}/pismo`);
  sprawdz(/Fikcyjna/.test(pismo), 'pismo do druku z adresem z rejestru');

  const przed = (await zapytaj(k, 'GET', `/api/psa/sprawy/${list.sprawa_id}`)).sprawa;
  sprawdz(Boolean(przed.blokada_wpisu), 'wpis zablokowany do nadania powiadomienia (art. 300(34) § 3 KSH)');
  await zapytaj(k, 'POST', `/api/psa/listy/${list.id}/nadanie`,
    plik('potwierdzenie-nadania.pdf', { pole: 'potwierdzenie', pola: { data_nadania: require('../server/pomocnicze/czas').dzisIso(), numer_nadania: 'RR000000001PL' } }));
  const po = (await zapytaj(k, 'GET', `/api/psa/sprawy/${list.sprawa_id}`)).sprawa;
  sprawdz(!po.blokada_wpisu && Boolean(po.powiadomienie_wyslano), 'nadanie listu odblokowuje wpis');
}

async function scenariuszC(k) {
  sekcja('C. Zgody akcjonariusza');
  const { db } = require('../server/baza');
  const anna = await zaloguj('anna.zgoda@example.com');
  const osw = await zapytaj(anna, 'GET', '/api/psa/portal/oswiadczenia');
  sprawdz(osw.zgoda_email.status === 'potwierdzona', 'Anna: zgoda na e-mail potwierdzona — dostęp do portalu');
  const spolka = osw.spolki[0];
  sprawdz(spolka && spolka.powiadomienia_automatyczne && spolka.powiadomienia_automatyczne.zlozone === 1,
    'oświadczenie o automatycznych powiadomieniach złożone osobiście w portalu');
  const cofniecie = await zapytaj(anna, 'POST', '/api/psa/portal/oswiadczenia', { spolka_id: spolka.spolka_id, rodzaj: 'zgoda_email', zlozone: false });
  const sprawa = (await zapytaj(k, 'GET', `/api/psa/sprawy/${cofniecie.sprawa_id}`)).sprawa;
  sprawdz(sprawa.typ_zdarzenia === 'zmiana_danych_akcjonariusza' && sprawa.odplatne === false,
    'cofnięcie zgody → sprawa w kancelarii, bezpłatna (D-083)');

  // Konto akcjonariusza bez zgody (dane testowe) — portal zamknięty (QW3 / D-083).
  const celina = db().prepare("SELECT id FROM psa_osoby WHERE email = 'celina.nabywca@example.com'").get();
  const hash = await require('../server/logika/hasla').hashuj(require('../server/tryb-testowy').HASLO_TESTOWE);
  db().prepare(`INSERT INTO psa_konta (email, hash_hasla, rola, osoba_id, aktywne, utworzono, rodo_zaakceptowano)
                VALUES ('celina.nabywca@example.com', ?, 'akcjonariusz', ?, 1, datetime('now'), datetime('now'))`).run(hash, celina.id);
  const odmowa = await zapytaj(sesja(), 'POST', '/api/psa/portal/login', {
    email: 'celina.nabywca@example.com', haslo: require('../server/tryb-testowy').HASLO_TESTOWE, droga_testowa: 'formularz',
  }, { oczekiwanyBlad: true });
  sprawdz(odmowa.status >= 400 && /pocztą/.test(JSON.stringify(odmowa.dane)),
    'bez zgody na e-mail logowanie do portalu zablokowane, z pouczeniem o korespondencji pocztą');
}

async function scenariuszD(k, { beta, spolkaId }) {
  sekcja('D. Przeniesienie rejestru → „Aktywny”');
  const czas = require('../server/pomocnicze/czas');
  const { przeniesienia } = await zapytaj(k, 'GET', '/api/psa/przeniesienia');
  const p = przeniesienia.find((x) => x.krs === '0000990002');
  sprawdz(p && p.spolka_id === spolkaId, 'przeniesienie Beta powiązane ze spółką z przyjętego wniosku');
  const dok = (typ, zrodlo) => zapytaj(k, 'POST', `/api/psa/przeniesienia/${p.id}/dokumenty`, plik(`${typ}.pdf`, { pola: { typ, zrodlo } }));
  const przejdz = (na, dane = {}) => zapytaj(k, 'POST', `/api/psa/przeniesienia/${p.id}/przejscie`, { na, ...dane });

  await przejdz('weryfikacja');
  const blok = await zapytaj(k, 'POST', `/api/psa/przeniesienia/${p.id}/przejscie`, { na: 'umowa_warunkowa', data_zawarcia_umowy: czas.dzisIso() }, { oczekiwanyBlad: true });
  sprawdz(blok.status === 400, 'umowa warunkowa zablokowana bez uchwały i umowy spółki (D-052)');
  await dok('uchwala', 'klient');
  await dok('umowa_spolki', 'klient');
  await zapytaj(k, 'PUT', `/api/psa/przeniesienia/${p.id}/checklista/weryfikacji`, {
    zaznaczone: { reprezentacja: true, uchwala: true, umowa_spolki: true, aml: true, liczba_akcji: true },
  });
  await przejdz('umowa_warunkowa', { data_zawarcia_umowy: czas.dzisIso() });
  const pisma = (await zapytaj(beta, 'GET', '/api/psa/portal/przeniesienie')).przeniesienie.pisma || [];
  sprawdz(pisma.length > 0, `portal spółki: pisma pakietu dostępne (${pisma.length})`);
  await dok('wypowiedzenie', 'klient');
  await przejdz('oczekuje_na_przekazanie', { data_skutecznosci: czas.dzisIso() });
  await dok('dane_poprzednika', 'poprzednik');
  await przejdz('uzgodnienie');
  await przejdz('wstrzymane_rozbieznosci', { uwagi: 'Liczba akcji serii A różni się od listy złożonej do KRS (dane testowe).' });
  await przejdz('uzgodnienie', { uwagi: 'Wyjaśniono — korekta w trybie żądania wpisu (dane testowe).' });
  await zapytaj(k, 'PUT', `/api/psa/przeniesienia/${p.id}/checklista/odbioru`, {
    zaznaczone: { kompletnosc: true, liczba_akcji: true, pokrycie: true, obciazenia: true, lista_krs: true, rozbieznosci: true },
  });
  const protokol = await fetch(`${ADRES}/api/psa/przeniesienia/${p.id}/protokol.pdf`, {
    headers: { Cookie: Object.entries(k.ciastka).map(([a, b]) => `${a}=${b}`).join('; ') },
  });
  const pdf = Buffer.from(await protokol.arrayBuffer());
  sprawdz(protokol.ok && pdf.subarray(0, 4).toString() === '%PDF', 'protokół przejęcia (PDF) do podpisu notariusza');
  await ustawWalidator('podpisany');
  const f = new FormData();
  f.append('plik', new Blob([pdf], { type: 'application/pdf' }), 'protokol-podpisany.pdf');
  const zatw = await zapytaj(k, 'POST', `/api/psa/przeniesienia/${p.id}/zatwierdzenie`, f);
  sprawdz(Boolean(zatw.przeniesienie.zatwierdzono), 'protokół przyjęty (atrapa: plik podpisany) — podpis sprawdza pracownik');

  const osoba = (await zapytaj(k, 'POST', '/api/psa/osoby', {
    typ: 'fizyczna', kraj: 'Polska', aml_status: 'wykonane', imie: 'Barbara', nazwisko: 'Betowska',
    data_urodzenia: '1981-02-03', plec: 'kobieta', kod_pocztowy: '80-004', miejscowosc: 'Gdańsk',
    ulica: 'Przeniesienia', nr_domu: '2', zgoda_email_status: 'brak',
  })).osoba;
  const otwarcie = await zapytaj(k, 'POST', `/api/psa/spolki/${spolkaId}/otworz-rejestr`, {
    checklista: { forma: true, wpis_krs: true, uchwala: true, reprezentacja: true, umowa: true, jedna_umowa: true, dane_z_umowy: true, ograniczenia: true, bilans: true, zakres_danych: true, aml: true },
    zdarzenia: [
      { typ: 'emisja', klucz_tymczasowy: 'e1', dane: { seria: 'A', nr_pierwszy: 1, ilosc: 1000, data_wpisu_krs: '2025-02-15', rodzaj_akcji: 'zwykla' } },
      { typ: 'objecie', dane: { emisja_zdarzenie_id: { __odwolanie_do_partii: 'e1' }, pozycje: [{ osoba_id: osoba.id, ilosc: 1000, pokryta: 'tak' }] } },
    ],
    archiwum: 'Historia wpisów poprzednika (dane testowe).',
  });
  sprawdz(otwarcie.zdarzenia[0].typ === 'przejecie', 'otwarcie: zdarzenie PRZEJĘCIE na początku łańcucha SHA-256');
  sprawdz(otwarcie.przejecie && /brak/.test(otwarcie.przejecie.oplata_za_przejecie), 'bez opłaty za przejęcie (D-085)');
  const koniec = (await zapytaj(k, 'GET', `/api/psa/przeniesienia/${p.id}`)).przeniesienie;
  sprawdz(koniec.status === 'aktywny', 'status przeniesienia: „Aktywny”');
}

async function scenariuszE(k) {
  sekcja('E. Data symulowana 2027-02-20: informacja z rejestru, nowelizacja');
  const { db } = require('../server/baza');
  const czas = require('../server/pomocnicze/czas');
  await ustawDate('2027-02-20');
  sprawdz(czas.dzisIso() === '2027-02-20', 'data rejestru symulowana: 2027-02-20 (po wejściu nowelizacji)');

  const bartosz = db().prepare("SELECT pesel, data_urodzenia FROM psa_osoby WHERE email = 'bartosz.bezzgody@example.com'").get();
  const annaOs = db().prepare("SELECT pesel FROM psa_osoby WHERE email = 'anna.zgoda@example.com'").get();
  const spolkaId = db().prepare("SELECT id FROM psa_spolki WHERE krs = '0000990001'").get().id;

  async function informacja(s) {
    const zam = await zapytaj(s, 'POST', '/api/psa/portal/informacja/zamow', { spolka_id: spolkaId });
    await zaplacAtrapa(s, zam);
    const wyd = await zapytaj(s, 'POST', `/api/psa/portal/informacja/${zam.oplata_id}/wydaj`, {});
    return zapytaj(s, 'GET', `/api/psa/portal/informacja/${wyd.dokument_id}`);
  }
  const dlaSpolki = await informacja(await zaloguj('zarzad@example.com'));
  sprawdz(/INF\/2027\/\d{4}/.test(dlaSpolki), 'numer informacji z bieżącego (symulowanego) roku — INF/2027/NNNN');
  sprawdz(dlaSpolki.includes(bartosz.pesel) && dlaSpolki.includes('Fikcyjna'),
    'wersja dla spółki: pełne dane akcjonariuszy (PESEL, adres)');
  sprawdz(/VAT/.test(dlaSpolki), 'wynagrodzenie z VAT na informacji');

  // Anna cofnęła zgodę w scenariuszu C, ale sprawa nie jest jeszcze wpisana — dostęp trwa.
  const dlaAkcj = await informacja(await zaloguj('anna.zgoda@example.com'));
  sprawdz(!dlaAkcj.includes(bartosz.pesel) && !dlaAkcj.includes(bartosz.data_urodzenia) && !dlaAkcj.includes('Fikcyjna'),
    'wersja dla akcjonariusza: bez PESEL, daty urodzenia i adresu innych (art. 300(35) § 1(1) KSH)');
  sprawdz(dlaAkcj.includes(annaOs.pesel), 'wersja dla akcjonariusza: własne dane w całości');

  const pulpit = await zapytaj(k, 'GET', '/api/psa/pulpit');
  const zadania = pulpit.zadania_terminowe || [];
  sprawdz(zadania.length > 0, `zadania terminowe po nowelizacji na pulpicie (${zadania.length})`);
}

async function uruchom() {
  process.env.PSA_TRYB_TESTOWY = '1';
  console.log('═'.repeat(72));
  console.log('Scenariusz E2E — tryb testowy (dane fikcyjne, skrzynka testowa, atrapy)');
  console.log('═'.repeat(72));
  execFileSync(process.execPath, [path.join(KORZEN, 'narzedzia', 'test-seed.js')], { stdio: ['ignore', 'ignore', 'inherit'], cwd: KORZEN });
  console.log('test:seed — baza testowa przygotowana');

  const tryb = require('../server/tryb-testowy');
  const app = require('../serwer');
  const serwer = app.listen(0);
  await new Promise((r) => serwer.once('listening', r));
  ADRES = `http://127.0.0.1:${serwer.address().port}`;
  tryb.ustawAtrapeTpay(serwer.address().port);

  try {
    const k = await zaloguj('notariusz@example.com', 'kancelaria');
    const a = await scenariuszA(k);
    await scenariuszB(k);
    await scenariuszC(k);
    await scenariuszD(k, a);
    await scenariuszE(k);
  } catch (e) {
    wyniki.zle.push(`przerwano: ${e.message}`);
    console.log(`\n  ✗ PRZERWANO: ${e.message}`);
  } finally {
    serwer.close();
  }
  console.log(`\n${'═'.repeat(72)}\nKontrole: ${wyniki.ok} ✓, ${wyniki.zle.length} ✗`);
  console.log(`Baza testowa zostaje do obejrzenia: PSA_TRYB_TESTOWY=1 npm start → http://localhost:3005/test (data symulowana 2027-02-20).`);
  console.log('═'.repeat(72));
  process.exit(wyniki.zle.length ? 1 : 0);
}

module.exports = { uruchom };
