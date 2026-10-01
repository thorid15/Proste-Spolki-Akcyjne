'use strict';

/**
 * Testy integracyjne portalu klienta przez HTTP (sekcja 8 i 9 specyfikacji):
 * logowanie, "moje spolki/akcje", podglad rejestru z maskowaniem, zlozenie
 * zadania, upload dokumentow do wlasnej sprawy, informacja z rejestru.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-portal-http.db');
fs.rmSync(PLIK_BAZY, { force: true });
fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.KATALOG_DOKUMENTOW = path.join(__dirname, '..', 'dane', '.test-portal-dokumenty');
process.env.PORTAL_WLACZONY = 'true';

const app = require('../serwer');
const { db } = require('../server/baza');
const rejestr = require('../server/rejestr');
const hasla = require('../server/logika/hasla');
const czas = require('../server/pomocnicze/czas');

let serwer;
let baza;

function ciasteczkoZOdpowiedzi(odp) {
  const surowe = typeof odp.headers.getSetCookie === 'function' ? odp.headers.getSetCookie() : [odp.headers.get('set-cookie')];
  return surowe.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
}

function dodajOsobe(nadpisania = {}) {
  const dane = {
    typ: 'fizyczna', nazwisko: 'Kowalski', imie: 'Jan', pesel: '80010112345',
    data_urodzenia: '1980-01-01', aml_status: 'wykonane', utworzono: czas.terazIso(),
    ...nadpisania,
  };
  const wynik = db()
    .prepare(
      `INSERT INTO psa_osoby (typ, nazwisko, imie, pesel, data_urodzenia, aml_status, utworzono)
       VALUES (@typ, @nazwisko, @imie, @pesel, @data_urodzenia, @aml_status, @utworzono)`
    )
    .run(dane);
  return Number(wynik.lastInsertRowid);
}

function dodajSpolke(nadpisania = {}) {
  const dane = {
    krs: null, nazwa: 'Portal Testowa P.S.A.', forma_prawna: 'PROSTA SPÓŁKA AKCYJNA',
    status: 'aktywna', utworzono: czas.terazIso(), ...nadpisania,
  };
  const wynik = db()
    .prepare(`INSERT INTO psa_spolki (krs, nazwa, forma_prawna, status, utworzono) VALUES (@krs, @nazwa, @forma_prawna, @status, @utworzono)`)
    .run(dane);
  return Number(wynik.lastInsertRowid);
}

async function dodajKonto({ email, haslo, rola, spolkaId = null, osobaId = null }) {
  const hash = await hasla.hashuj(haslo);
  const wynik = db()
    .prepare(
      `INSERT INTO psa_konta (email, hash_hasla, rola, spolka_id, osoba_id, aktywne, utworzono)
       VALUES (?, ?, ?, ?, ?, 1, ?)`
    )
    .run(email, hash, rola, spolkaId, osobaId, czas.terazIso());
  return Number(wynik.lastInsertRowid);
}

async function zalogujPortal(email, haslo) {
  const odp = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, haslo }),
  });
  assert.equal(odp.status, 200, `logowanie portalowe ${email} nie powiodło się`);
  return ciasteczkoZOdpowiedzi(odp);
}

let spolkaId;
let kowalskiId;
let nowakId;
let ciastkoSpolka;
let ciastkoAkcjonariusz;
let ciastkoInnyAkcjonariusz;

test.before(async () => {
  serwer = app.listen(0);
  baza = `http://localhost:${serwer.address().port}`;

  spolkaId = dodajSpolke();
  kowalskiId = dodajOsobe({ nazwisko: 'Kowalski', imie: 'Jan', pesel: '80010112345' });
  nowakId = dodajOsobe({ nazwisko: 'Nowak', imie: 'Anna', pesel: '85050512345', typ: 'fizyczna' });

  const emisja = rejestr.dokonajWpisu(db(), {
    spolkaId, typ: 'emisja',
    wejscie: { seria: 'A', ilosc: 100, data_wpisu_krs: '2026-01-10' }, autor: 'Test',
  });
  rejestr.dokonajWpisu(db(), {
    spolkaId, typ: 'objecie',
    wejscie: { emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: kowalskiId, ilosc: 60 }, { osoba_id: nowakId, ilosc: 40 }] },
    autor: 'Test',
  });

  await dodajKonto({ email: 'spolka@example.pl', haslo: 'HasloSpolki123', rola: 'spolka', spolkaId });
  await dodajKonto({ email: 'kowalski@example.pl', haslo: 'HasloJana12345', rola: 'akcjonariusz', osobaId: kowalskiId });
  await dodajKonto({ email: 'nowak@example.pl', haslo: 'HasloAnny123456', rola: 'akcjonariusz', osobaId: nowakId });

  ciastkoSpolka = await zalogujPortal('spolka@example.pl', 'HasloSpolki123');
  ciastkoAkcjonariusz = await zalogujPortal('kowalski@example.pl', 'HasloJana12345');
  ciastkoInnyAkcjonariusz = await zalogujPortal('nowak@example.pl', 'HasloAnny123456');
});

test.after(() => {
  serwer.close();
  fs.rmSync(PLIK_BAZY, { force: true });
  fs.rmSync(`${PLIK_BAZY}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY}-shm`, { force: true });
  fs.rmSync(process.env.KATALOG_DOKUMENTOW, { recursive: true, force: true });
});

test('logowanie portalowe: bledne haslo -> 401, trasy portalu wymagaja sesji konta', async () => {
  const zle = await fetch(`${baza}/api/psa/portal/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'kowalski@example.pl', haslo: 'zle-haslo' }),
  });
  assert.equal(zle.status, 401);

  const bezSesji = await fetch(`${baza}/api/psa/portal/moje`);
  assert.equal(bezSesji.status, 401);
});

test('sesja portalowa jest niezalezna od sesji pracownika (inne ciasteczko)', () => {
  assert.match(ciastkoSpolka, /^psa_sesja_portal=/);
});

test('moje: konto spolki widzi swoja spolke', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/moje`, { headers: { Cookie: ciastkoSpolka } });
  assert.equal(odp.status, 200);
  const dane = await odp.json();
  assert.equal(dane.rola, 'spolka');
  assert.equal(dane.spolki.length, 1);
  assert.equal(dane.spolki[0].id, spolkaId);
});

test('moje: konto akcjonariusza widzi wlasny pakiet akcji, bez cudzych danych', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/moje`, { headers: { Cookie: ciastkoAkcjonariusz } });
  assert.equal(odp.status, 200);
  const dane = await odp.json();
  assert.equal(dane.rola, 'akcjonariusz');
  assert.equal(dane.spolki.length, 1);
  assert.equal(dane.spolki[0].razem_akcji, 60);
});

test('rejestr: akcjonariusz widzi wlasne dane w pelni, dane wspolakcjonariusza zamaskowane', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/rejestr/${spolkaId}`, { headers: { Cookie: ciastkoAkcjonariusz } });
  assert.equal(odp.status, 200);
  const dane = await odp.json();

  const jan = dane.akcjonariusze.find((a) => a.osoba_id === kowalskiId);
  const anna = dane.akcjonariusze.find((a) => a.osoba_id === nowakId);
  assert.equal(jan.osoba.zamaskowane, false);
  assert.equal(jan.osoba.pesel, '80010112345');
  assert.equal(anna.osoba.zamaskowane, true);
  assert.notEqual(anna.osoba.pesel, '85050512345');
});

test('rejestr: konto spolki widzi tresc rejestru (PESEL/adres) w calosci, ale NIE dane AML/PEP kancelarii (Z-150)', async () => {
  // Naprawa Z-150: rola "spolka" ma pelny wglad do TRESCI REJESTRU
  // (art. 300(35) § 1 KSH — PESEL, adres), ale AML/PEP/notatka to nie tresc
  // rejestru, tylko wewnetrzna dokumentacja obowiazku AML kancelarii — nie
  // wychodzi poza kancelarie NIGDY, niezaleznie od roli odbiorcy.
  const odp = await fetch(`${baza}/api/psa/portal/rejestr/${spolkaId}`, { headers: { Cookie: ciastkoSpolka } });
  const dane = await odp.json();
  const anna = dane.akcjonariusze.find((a) => a.osoba_id === nowakId);
  assert.equal(anna.osoba.pesel, '85050512345', 'tresc rejestru (PESEL) musi zostac widoczna dla spolki');
  assert.equal(anna.osoba.aml_status, undefined, 'status AML nie moze wyjsc poza kancelarie do roli spolka');
  assert.ok(
    anna.osoba.zamaskowane_pola.includes('aml_status'),
    'pole aml_status ma byc jawnie oznaczone jako pominiete dla roli spolka'
  );
});

test('rejestr: dostep do cudzej spolki jest odrzucany (404, nie wyciek istnienia)', async () => {
  const innaSpolkaId = dodajSpolke({ nazwa: 'Inna P.S.A., bez powiazania', krs: '0009998887' });
  const odp = await fetch(`${baza}/api/psa/portal/rejestr/${innaSpolkaId}`, { headers: { Cookie: ciastkoAkcjonariusz } });
  assert.equal(odp.status, 404);
});

test('zadania: zlozenie zgloszenia typu dostepnego portalowi', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/zadania`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz },
    body: JSON.stringify({ spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', opis: 'Sprzedaję część akcji sąsiadowi.' }),
  });
  assert.equal(odp.status, 201);
  const dane = await odp.json();
  assert.equal(dane.sprawa.stan, 'nowa');
  assert.equal(dane.sprawa.zrodlo, 'portal');
});

test('zadania: typ z_urzedu jest odrzucany na poziomie portalu', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/zadania`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz },
    body: JSON.stringify({ spolka_id: spolkaId, typ_zdarzenia: 'zajecie', opis: 'proba' }),
  });
  assert.equal(odp.status, 400);
});

test('zadania: konto spolki widzi zgloszenia o swojej spolce, obcy akcjonariusz — nie', async () => {
  const dlaJana = await (await fetch(`${baza}/api/psa/portal/zadania`, { headers: { Cookie: ciastkoAkcjonariusz } })).json();
  assert.equal(dlaJana.sprawy.length, 1, 'Jan widzi wlasne zgloszenie');

  // Spolka widzi KAZDE zgloszenie portalowe dotyczace jej wlasnego rejestru
  // (nie tylko zlozone przez samo konto spolki) - to zamierzone: pracownicy
  // spolki maja przegladac napływajace zadania dotyczace ich rejestru.
  const dlaSpolki = await (await fetch(`${baza}/api/psa/portal/zadania`, { headers: { Cookie: ciastkoSpolka } })).json();
  assert.equal(dlaSpolki.sprawy.length, 1, 'zgłoszenie Jana o TEJ spółce jest widoczne dla konta spółki');

  // Ale inny akcjonariusz tej samej spolki (Anna) nie widzi zgloszenia Jana -
  // to NIE jest jej sprawa.
  const dlaAnny = await (await fetch(`${baza}/api/psa/portal/zadania`, { headers: { Cookie: ciastkoInnyAkcjonariusz } })).json();
  assert.equal(dlaAnny.sprawy.length, 0, 'zgłoszenie Jana nie jest widoczne dla innego akcjonariusza');
});

/**
 * Wpisu dokonuje sie na podstawie DOKUMENTU (art. 300(34) § 4 KSH), nie opisu
 * zadajacego — wiec zgloszenie z sama umowa w zalaczniku musi przejsc.
 * Wczesniej opis byl obowiazkowy i klient musial pisac wypracowanie obok
 * dokumentu, ktory i tak rozstrzyga.
 */
test('zadania: zgloszenie bez opisu przechodzi — podstawa jest dokument', async () => {
  const odp = await fetch(`${baza}/api/psa/portal/zadania`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz },
    body: JSON.stringify({ spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', opis: '' }),
  });
  assert.equal(odp.status, 201);
  const { sprawa } = await odp.json();
  assert.equal(sprawa.stan, 'nowa');

  // Zadajacy musi byc opisany nawet bez wpisanego opisu — inaczej sprawa
  // trafia do kolejki bez informacji, od kogo przyszla.
  const wiersz = db().prepare('SELECT zadajacy_opis, notatka FROM psa_sprawy WHERE id = ?').get(sprawa.id);
  assert.ok(wiersz.zadajacy_opis, 'zadajacy jest opisany mimo pustego opisu');
  assert.equal(wiersz.notatka, null, 'pusty opis nie zostaje pustym napisem w notatce');
});

/**
 * Naprawa Z-351/Z-353: portal.js/zadania nalicza OPLATE razem ze sprawa -
 * podwojne zadanie bez ochrony obciazyloby klienta dwa razy za ten sam wpis.
 * Klucz idempotencyjny generuje klient i wysyla go ponownie przy ponowieniu
 * tej samej proby (dwa kliknieca, ponowienie po zerwanym polaczeniu).
 * Wlasna spolka/konto - test nie ma wplywac na liczniki spraw uzywane
 * przez sasiednie testy tego pliku.
 */
test('POST /api/psa/portal/zadania: ten sam klucz_idempotencji nie zaklada drugiej sprawy ani drugiej oplaty', async () => {
  const spolkaIdempId = dodajSpolke({ nazwa: `Portal Idempotencja ${czas.terazIso()}` });
  const osobaIdempId = dodajOsobe({ nazwisko: 'Idempotentny', imie: 'Karol', pesel: '90010112360' });
  const emisjaIdemp = rejestr.dokonajWpisu(db(), {
    spolkaId: spolkaIdempId, typ: 'emisja',
    wejscie: { seria: 'A', ilosc: 10, data_wpisu_krs: '2026-01-10' }, autor: 'Test',
  });
  rejestr.dokonajWpisu(db(), {
    spolkaId: spolkaIdempId, typ: 'objecie',
    wejscie: { emisja_zdarzenie_id: emisjaIdemp.zdarzenie.id, pozycje: [{ osoba_id: osobaIdempId, ilosc: 10 }] }, autor: 'Test',
  });
  await dodajKonto({ email: 'idempotentny@example.pl', haslo: 'HasloKarola123', rola: 'akcjonariusz', osobaId: osobaIdempId });
  const ciastkoIdemp = await zalogujPortal('idempotentny@example.pl', 'HasloKarola123');

  const klucz = `test-portal-idempotencja-${Date.now()}`;
  const cialo = JSON.stringify({ spolka_id: spolkaIdempId, typ_zdarzenia: 'przeniesienie', opis: 'proba', klucz_idempotencji: klucz });

  const odp1 = await fetch(`${baza}/api/psa/portal/zadania`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ciastkoIdemp }, body: cialo,
  });
  assert.equal(odp1.status, 201);
  const pierwsza = await odp1.json();

  const odp2 = await fetch(`${baza}/api/psa/portal/zadania`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ciastkoIdemp }, body: cialo,
  });
  assert.equal(odp2.status, 200, 'ponowienie z tym samym kluczem nie zaklada drugiej sprawy');
  const druga = await odp2.json();
  assert.equal(druga.sprawa.id, pierwsza.sprawa.id);
  assert.equal(druga.oplata_id, pierwsza.oplata_id, 'ta sama, JUZ naliczona oplata - nie druga');

  const liczbaSpraw = db().prepare('SELECT COUNT(*) AS n FROM psa_sprawy WHERE klucz_idempotencji = ?').get(klucz).n;
  assert.equal(liczbaSpraw, 1);
  const liczbaOplat = db()
    .prepare(`SELECT COUNT(*) AS n FROM psa_oplaty WHERE sprawa_id = ? AND typ = 'wpis' AND status != 'anulowana'`)
    .get(pierwsza.sprawa.id).n;
  assert.equal(liczbaOplat, 1, 'dokladnie jedna oplata za wpis, nie dwie');
});

test('dokumenty: upload do wlasnej sprawy dziala, do cudzej jest odrzucany', async () => {
  const zadanie = await (
    await fetch(`${baza}/api/psa/portal/zadania`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz },
      body: JSON.stringify({ spolka_id: spolkaId, typ_zdarzenia: 'przeniesienie', opis: 'Dokument dowodowy w załączeniu.' }),
    })
  ).json();
  const sprawaId = zadanie.sprawa.id;

  const formularz = new FormData();
  formularz.append('typ_dokumentu', 'umowa_zbycia');
  formularz.append('pliki', new Blob(['%PDF-1.4\ntresc testowa'], { type: 'application/pdf' }), 'umowa.pdf');

  const wlasny = await fetch(`${baza}/api/psa/portal/zadania/${sprawaId}/dokumenty`, {
    method: 'POST', headers: { Cookie: ciastkoAkcjonariusz }, body: formularz,
  });
  assert.equal(wlasny.status, 201);

  // Anna (inny akcjonariusz tej samej spolki, bez zwiazku z ta konkretna
  // sprawa) nie moze dolaczac dokumentow do cudzego zgloszenia.
  const formularz2 = new FormData();
  formularz2.append('typ_dokumentu', 'inny');
  formularz2.append('pliki', new Blob(['%PDF-1.4\nx'], { type: 'application/pdf' }), 'x.pdf');
  const cudzy = await fetch(`${baza}/api/psa/portal/zadania/${sprawaId}/dokumenty`, {
    method: 'POST', headers: { Cookie: ciastkoInnyAkcjonariusz }, body: formularz2,
  });
  assert.equal(cudzy.status, 404);
});

test('informacja z rejestru: odplatna — bez zaplaty nie wychodzi', async () => {
  const zamow = await fetch(`${baza}/api/psa/portal/informacja/zamow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz },
    body: JSON.stringify({ spolka_id: spolkaId }),
  });
  assert.equal(zamow.status, 200);
  const zamowienie = await zamow.json();
  assert.ok(Number.isInteger(zamowienie.oplata_id));
  assert.equal(zamowienie.oplacona, false);

  const przedZaplata = await fetch(`${baza}/api/psa/portal/informacja/${zamowienie.oplata_id}/wydaj`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz }, body: '{}',
  });
  assert.equal(przedZaplata.status, 400, 'nieoplacona informacja nie wychodzi');
  assert.equal(
    db().prepare(`SELECT COUNT(*) c FROM psa_wydane_dokumenty WHERE typ = 'informacja_z_rejestru'`).get().c,
    0,
    'dokument w ogole nie powstaje'
  );
});

test('informacja z rejestru: wydanie zapisuje slad, dokument ma wlasny adres', async () => {
  const zamow = await fetch(`${baza}/api/psa/portal/informacja/zamow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz },
    body: JSON.stringify({ spolka_id: spolkaId }),
  });
  const { oplata_id: oplataId } = await zamow.json();
  db().prepare("UPDATE psa_oplaty SET status = 'oplacona' WHERE id = ?").run(oplataId);

  const odp = await fetch(`${baza}/api/psa/portal/informacja/${oplataId}/wydaj`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ciastkoAkcjonariusz },
    body: '{}',
  });
  assert.equal(odp.status, 200);
  const dane = await odp.json();
  assert.ok(Number.isInteger(dane.dokument_id), 'wydanie zwraca identyfikator dokumentu');

  const slad = db()
    .prepare(`SELECT * FROM psa_wydane_dokumenty WHERE spolka_id = ? AND typ = 'informacja_z_rejestru'`)
    .all(spolkaId);
  assert.equal(slad.length, 1);
  assert.equal(slad[0].kanal, 'portal');
  assert.equal(slad[0].id, dane.dokument_id);

  // Dokument otwiera sie pod adresem, a nie z odpowiedzi POST — dzieki temu
  // da sie go otworzyc ponownie i wydrukowac z sensowna nazwa pliku.
  const pobrany = await fetch(`${baza}/api/psa/portal/informacja/${dane.dokument_id}`, {
    headers: { Cookie: ciastkoAkcjonariusz },
  });
  assert.equal(pobrany.status, 200);
  assert.match(pobrany.headers.get('content-type') || '', /text\/html/);
  const html = await pobrany.text();
  assert.match(html, /Informacja z rejestru akcjonariuszy/);
  assert.match(html, /Portal Testowa P\.S\.A\./);
  // Pelna tresc ustawowa, nie sama tabela akcjonariuszy (art. 300(33) § 1).
  assert.match(html, /podmiot prowadzący rejestr akcjonariuszy/, 'kto wydał — w główce');
  assert.match(html, /Emisje i serie akcji/);

  // Ponowne otwarcie jest BEZPLATNE: platna jest czynnosc wydania.
  const przedOplaty = db()
    .prepare(`SELECT COUNT(*) c FROM psa_wydane_dokumenty WHERE spolka_id = ? AND typ = 'informacja_z_rejestru'`)
    .get(spolkaId).c;
  await fetch(`${baza}/api/psa/portal/informacja/${dane.dokument_id}`, {
    headers: { Cookie: ciastkoAkcjonariusz },
  });
  assert.equal(
    db()
      .prepare(`SELECT COUNT(*) c FROM psa_wydane_dokumenty WHERE spolka_id = ? AND typ = 'informacja_z_rejestru'`)
      .get(spolkaId).c,
    przedOplaty,
    'ponowne otwarcie nie wydaje dokumentu drugi raz'
  );
});

test('portal wylaczony flaga: PORTAL_WLACZONY=false zwraca 503 dla wszystkich tras portalu', async () => {
  const PLIK_BAZY2 = path.join(__dirname, '..', 'dane', '.test-portal-wylaczony.db');
  fs.rmSync(PLIK_BAZY2, { force: true });
  const skrypt = `
    process.env.WSPOLNA_BAZA = ${JSON.stringify(PLIK_BAZY2)};
    process.env.KATALOG_DOKUMENTOW = ${JSON.stringify(path.join(__dirname, '..', 'dane', '.test-portal-wylaczony-dok'))};
    process.env.PORTAL_WLACZONY = 'false';
    const app = require(${JSON.stringify(path.join(__dirname, '..', 'serwer.js'))});
    const serwer = app.listen(0, () => {
      fetch(\`http://localhost:\${serwer.address().port}/api/psa/portal/whoami\`)
        .then((r) => { console.log(r.status); serwer.close(); process.exit(0); });
    });
  `;
  const { execFileSync } = require('node:child_process');
  const wynik = execFileSync(process.execPath, ['-e', skrypt], { encoding: 'utf8' });
  const ostatniaLinia = wynik.trim().split('\n').pop();
  assert.equal(ostatniaLinia, '503');
  fs.rmSync(PLIK_BAZY2, { force: true });
  fs.rmSync(`${PLIK_BAZY2}-wal`, { force: true });
  fs.rmSync(`${PLIK_BAZY2}-shm`, { force: true });
});

/**
 * Informacja wydana SPOLCE niesie pelne dane wszystkich akcjonariuszy (art.
 * 300(35) § 1 KSH); wydana akcjonariuszowi — te same dane w jego, wezszym
 * zakresie (§ 1(1)). Bramka „czy masz dostep do tej spolki" przepuszczala
 * akcjonariusza do dokumentu spolki, czyli do adresow pozostalych
 * akcjonariuszy, ktore w jego wlasnej informacji sa zaslonione.
 */
test('akcjonariusz nie otworzy informacji wydanej SPOLCE', async () => {
  async function wydaj(ciastko) {
    const zam = await (await fetch(`${baza}/api/psa/portal/informacja/zamow`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ciastko },
      body: JSON.stringify({ spolka_id: spolkaId }),
    })).json();
    db().prepare("UPDATE psa_oplaty SET status = 'oplacona' WHERE id = ?").run(zam.oplata_id);
    return (await (await fetch(`${baza}/api/psa/portal/informacja/${zam.oplata_id}/wydaj`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ciastko }, body: '{}',
    })).json()).dokument_id;
  }

  const dokumentSpolki = await wydaj(ciastkoSpolka);
  const dokumentKowalskiego = await wydaj(ciastkoAkcjonariusz);

  const cudzy = await fetch(`${baza}/api/psa/portal/informacja/${dokumentSpolki}`, {
    headers: { Cookie: ciastkoAkcjonariusz },
  });
  assert.equal(cudzy.status, 404, 'dokument spółki jest dla akcjonariusza nieistniejący');

  // Cudzy dokument AKCJONARIUSZA tez nie — nawet w tej samej spolce.
  const cudzyAkcjonariusza = await fetch(`${baza}/api/psa/portal/informacja/${dokumentKowalskiego}`, {
    headers: { Cookie: ciastkoInnyAkcjonariusz },
  });
  assert.equal(cudzyAkcjonariusza.status, 404);

  // Wlasny otwiera sie normalnie, a spolka otwiera swoj.
  assert.equal(
    (await fetch(`${baza}/api/psa/portal/informacja/${dokumentKowalskiego}`, { headers: { Cookie: ciastkoAkcjonariusz } })).status,
    200
  );
  assert.equal(
    (await fetch(`${baza}/api/psa/portal/informacja/${dokumentSpolki}`, { headers: { Cookie: ciastkoSpolka } })).status,
    200
  );
});

/**
 * Naprawa P-012: dotad jedyna droga do skanu dokumentu tozsamosci byla
 * `POST /api/psa/osoby/:id/aml-skany`, za `wymagajPracownika` - dokument i
 * tak krazyl mailem, zanim pracownik go tam wgral. Ten test sprawdza nowy,
 * portalowy kanal: WYLACZNIE wlasny skan, ten sam rezim co kartoteka.
 */
test('AML: akcjonariusz wgrywa WLASNY skan dokumentu, trafia do wspolnej kartoteki z pracownikiem', async () => {
  const spolkaAmlId = dodajSpolke({ nazwa: `Portal AML ${czas.terazIso()}` });
  db().prepare('UPDATE psa_spolki SET stosuje_procedure_aml = 1 WHERE id = ?').run(spolkaAmlId);
  const osobaAmlId = dodajOsobe({ nazwisko: 'Skanowy', imie: 'Piotr', pesel: '90010112345' });
  const emisjaAml = rejestr.dokonajWpisu(db(), {
    spolkaId: spolkaAmlId, typ: 'emisja',
    wejscie: { seria: 'A', ilosc: 10, data_wpisu_krs: '2026-01-10' }, autor: 'Test',
  });
  rejestr.dokonajWpisu(db(), {
    spolkaId: spolkaAmlId, typ: 'objecie',
    wejscie: { emisja_zdarzenie_id: emisjaAml.zdarzenie.id, pozycje: [{ osoba_id: osobaAmlId, ilosc: 10 }] }, autor: 'Test',
  });
  await dodajKonto({ email: 'skanowy@example.pl', haslo: 'HasloPiotra123', rola: 'akcjonariusz', osobaId: osobaAmlId });
  const ciastkoSkanowy = await zalogujPortal('skanowy@example.pl', 'HasloPiotra123');

  // Rola "spolka" nie ma wlasnej osoby - nie ma czyjego skanu wgrac.
  const odmowaRoli = await fetch(`${baza}/api/psa/portal/aml-skany`, { headers: { Cookie: ciastkoSpolka } });
  assert.equal(odmowaRoli.status, 403);

  // Zla koncowka pliku jest odrzucona (ten sam rezim co kartoteka pracownika).
  const zlaKoncowka = new FormData();
  zlaKoncowka.append('plik', new Blob(['x'], { type: 'text/plain' }), 'notatka.txt');
  const odpZlaKoncowka = await fetch(`${baza}/api/psa/portal/aml-skany/${spolkaAmlId}`, {
    method: 'POST', headers: { Cookie: ciastkoSkanowy }, body: zlaKoncowka,
  });
  assert.equal(odpZlaKoncowka.status, 400);

  // Spolka bez wlaczonej procedury AML - odmowa, tak jak w kartotece pracownika.
  const formularzBezAml = new FormData();
  formularzBezAml.append('plik', new Blob(['%PDF-1.4\nx'], { type: 'application/pdf' }), 'dowod.pdf');
  const odpBezAml = await fetch(`${baza}/api/psa/portal/aml-skany/${spolkaId}`, {
    method: 'POST', headers: { Cookie: ciastkoAkcjonariusz }, body: formularzBezAml,
  });
  assert.equal(odpBezAml.status, 400, 'spolkaId nalezy do Kowalskiego, ale nie ma wlaczonej procedury AML');

  // Spolka, w ktorej ten akcjonariusz NIE ma akcji - D3, 404.
  const formularzCudza = new FormData();
  formularzCudza.append('plik', new Blob(['%PDF-1.4\nx'], { type: 'application/pdf' }), 'dowod.pdf');
  const odpCudza = await fetch(`${baza}/api/psa/portal/aml-skany/${spolkaAmlId}`, {
    method: 'POST', headers: { Cookie: ciastkoAkcjonariusz }, body: formularzCudza,
  });
  assert.equal(odpCudza.status, 404, 'Kowalski nie ma akcji w tej spolce');

  // Wgranie wlasnego skanu, we wlasciwym kontekscie - sukces.
  const formularz = new FormData();
  formularz.append('typ_dokumentu', 'dowod_osobisty');
  formularz.append('plik', new Blob(['%PDF-1.4\ntresc skanu'], { type: 'application/pdf' }), 'dowod-piotra.pdf');
  const odpUpload = await fetch(`${baza}/api/psa/portal/aml-skany/${spolkaAmlId}`, {
    method: 'POST', headers: { Cookie: ciastkoSkanowy }, body: formularz,
  });
  assert.equal(odpUpload.status, 201);
  const dane = await odpUpload.json();
  assert.equal(dane.skan.typ_dokumentu, 'dowod_osobisty');

  const lista = await (await fetch(`${baza}/api/psa/portal/aml-skany`, { headers: { Cookie: ciastkoSkanowy } })).json();
  assert.equal(lista.skany.length, 1);
  assert.equal(lista.skany[0].id, dane.skan.id);

  // Ten sam wiersz jest widoczny po stronie kartoteki pracownika - jedna
  // wspolna lista, nie dwie osobne.
  const wiersz = db().prepare('SELECT * FROM psa_osoby_skany_aml WHERE id = ?').get(dane.skan.id);
  assert.equal(wiersz.osoba_id, osobaAmlId);
  assert.equal(wiersz.spolka_id, spolkaAmlId);
  assert.match(wiersz.wgral, /skanowy@example\.pl/);
  assert.ok(wiersz.hash, 'ten sam rezim hasha co upload pracownika');
});

test('dwuklik w „Zamow informacje" nie tworzy dwoch dlugow', async () => {
  const przed = db().prepare(`SELECT COUNT(*) c FROM psa_oplaty WHERE typ = 'informacja'`).get().c;

  async function zamow() {
    const odp = await fetch(`${baza}/api/psa/portal/informacja/zamow`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ciastkoInnyAkcjonariusz },
      body: JSON.stringify({ spolka_id: spolkaId }),
    });
    return (await odp.json()).oplata_id;
  }

  const pierwsze = await zamow();
  const drugie = await zamow();
  assert.equal(drugie, pierwsze, 'to samo nierozliczone zamówienie, nie drugie');
  assert.equal(
    db().prepare(`SELECT COUNT(*) c FROM psa_oplaty WHERE typ = 'informacja'`).get().c,
    przed + 1,
    'jedna należność na jedną chęć obejrzenia rejestru'
  );
});
