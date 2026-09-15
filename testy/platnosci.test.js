'use strict';

/**
 * Platnosci online — logika ksiegowania, bez dotykania produkcji operatora.
 *
 * Zamiast piaskownicy tpay stoi tu LOKALNY SERWER-ATRAPA. Powod jest
 * praktyczny: scenariuszy, na ktorych nam najbardziej zalezy — zaplacono
 * mniej niz nalezy, powiadomienie przyszlo dwa razy, powiadomienie
 * z piaskownicy trafilo na produkcje, sfalszowany podpis — w piaskownicy
 * nie wywolasz na zadanie.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const PLIK_BAZY = path.join(__dirname, '..', 'dane', '.test-platnosci.db');
for (const p of [PLIK_BAZY, `${PLIK_BAZY}-wal`, `${PLIK_BAZY}-shm`]) fs.rmSync(p, { force: true });
process.env.WSPOLNA_BAZA = PLIK_BAZY;
process.env.PORTAL_WLACZONY = 'true';

// Sekrety atrapy — ustawiane PRZED wczytaniem konfiguracji.
const SEKRET_ITN = 'sekret-powiadomien-do-testow';
process.env.TPAY_CLIENT_ID = 'klient-testowy';
process.env.TPAY_CLIENT_SECRET = 'sekret-testowy';
process.env.TPAY_NOTIFICATION_SECRET = SEKRET_ITN;
process.env.TPAY_TRYB_TESTOWY = 'false';

let atrapa;
let adresAtrapy;
/** Co atrapa ma zrobic przy nastepnym zalozeniu transakcji. */
let zachowanieAtrapy = { blad: null, status: 'pending' };
let licznikTransakcji = 0;

function uruchomAtrape() {
  return new Promise((gotowe) => {
    atrapa = http.createServer((zad, odp) => {
      let cialo = '';
      zad.on('data', (c) => { cialo += c; });
      zad.on('end', () => {
        const odpowiedz = (kod, dane) => {
          odp.writeHead(kod, { 'Content-Type': 'application/json' });
          odp.end(JSON.stringify(dane));
        };
        if (zad.url === '/oauth/auth') {
          return odpowiedz(200, { access_token: 'token-atrapy', expires_in: 3600 });
        }
        if (zad.url === '/transactions' && zad.method === 'POST') {
          if (zachowanieAtrapy.blad) return odpowiedz(500, { message: zachowanieAtrapy.blad });
          licznikTransakcji += 1;
          const id = `TR-${licznikTransakcji}`;
          return odpowiedz(200, {
            transactionId: id,
            transactionPaymentUrl: `https://atrapa.example/platnosc/${id}`,
            title: id,
          });
        }
        if (zad.url.startsWith('/transactions/') && zad.method === 'GET') {
          return odpowiedz(200, { status: zachowanieAtrapy.status });
        }
        return odpowiedz(404, { message: 'nieznana trasa atrapy' });
      });
    });
    atrapa.listen(0, '127.0.0.1', () => {
      adresAtrapy = `http://127.0.0.1:${atrapa.address().port}`;
      process.env.TPAY_API_URL = adresAtrapy;
      gotowe();
    });
  });
}

let db;
let platnosci;
let oplatyModul;
let tpay;
let spolkaId;

test.before(async () => {
  await uruchomAtrape();
  // Konfiguracja czyta `process.env` przy pierwszym `require` — dlatego
  // moduly wczytujemy DOPIERO po podniesieniu atrapy.
  ({ db } = require('../server/baza'));
  require('../server/migracje').uruchom(db());
  platnosci = require('../server/platnosci');
  oplatyModul = require('../server/oplaty');
  tpay = require('../server/logika/tpay');

  const wynik = db()
    .prepare(`INSERT INTO psa_spolki (nazwa, status, utworzono) VALUES (?, 'aktywna', ?)`)
    .run('Platnosci Testowa P.S.A.', new Date().toISOString());
  spolkaId = Number(wynik.lastInsertRowid);
});

test.after(() => {
  if (atrapa) atrapa.close();
});

function dodajOplate({ kwotaGrosze = 5000, typ = 'informacja', sprawaId = null } = {}) {
  const wynik = db()
    .prepare(
      `INSERT INTO psa_oplaty (spolka_id, sprawa_id, typ, kwota_grosze, status, data_naliczenia, autor, utworzono)
       VALUES (?, ?, ?, ?, 'naliczona', ?, 'test', ?)`
    )
    .run(spolkaId, sprawaId, typ, kwotaGrosze, '2026-09-16', new Date().toISOString());
  return db().prepare('SELECT * FROM psa_oplaty WHERE id = ?').get(wynik.lastInsertRowid);
}

/** Powiadomienie z POPRAWNA suma kontrolna — tak, jak liczy je operator. */
function powiadomienie(platnosc, { kwota, status = 'TRUE', error = 'none', test_mode = '0' } = {}) {
  const trAmount = kwota != null ? kwota : (platnosc.kwota_grosze / 100).toFixed(2);
  const pola = {
    id: '123456',
    tr_id: platnosc.tpay_id || 'TR-X',
    tr_amount: trAmount,
    tr_crc: platnosc.crc,
    tr_status: status,
    tr_error: error,
    test_mode,
  };
  pola.md5sum = crypto
    .createHash('md5')
    .update(`${pola.id}${pola.tr_id}${pola.tr_amount}${pola.tr_crc}${SEKRET_ITN}`)
    .digest('hex');
  return pola;
}

test('link do zaplaty powstaje raz — dopoki kwota sie nie zmienila', async () => {
  const oplata = dodajOplate({ kwotaGrosze: 12300 });
  const pierwszy = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  assert.equal(pierwszy.nowa, true);
  assert.ok(pierwszy.platnosc.link);

  const drugi = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  assert.equal(drugi.nowa, false, 'ten sam link zamiast drugiej transakcji');
  assert.equal(drugi.platnosc.id, pierwszy.platnosc.id);

  // Kwota sie zmienila — poprzedni link prowadzilby do zaplaty kwoty,
  // ktorej nikt juz nie jest winien.
  db().prepare('UPDATE psa_oplaty SET kwota_grosze = ? WHERE id = ?').run(20000, oplata.id);
  const trzeci = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  assert.equal(trzeci.nowa, true);
  assert.notEqual(trzeci.platnosc.id, pierwszy.platnosc.id);
  assert.equal(
    db().prepare('SELECT status FROM psa_platnosci WHERE id = ?').get(pierwszy.platnosc.id).status,
    'anulowana',
    'stara proba zostaje w historii, ale juz nie obowiazuje'
  );
});

test('awaria operatora nie zostawia wiszacej proby bez linku', async () => {
  const oplata = dodajOplate();
  zachowanieAtrapy = { blad: 'operator niedostepny', status: 'pending' };
  await assert.rejects(
    () => platnosci.przygotujZaplate(db(), {
      oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
    })
  );
  zachowanieAtrapy = { blad: null, status: 'pending' };

  const proby = db().prepare('SELECT * FROM psa_platnosci WHERE oplata_id = ?').all(oplata.id);
  assert.equal(proby.length, 1);
  assert.equal(proby[0].status, 'nieudana', 'nieudana proba nie blokuje kolejnej');

  const kolejna = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  assert.ok(kolejna.platnosc.link);
});

test('sfalszowany podpis nie ksieguje niczego', async () => {
  const oplata = dodajOplate();
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });

  const podrobione = { ...powiadomienie(platnosc), md5sum: 'f'.repeat(32) };
  const wynik = platnosci.przyjmijPowiadomienie(db(), podrobione);
  assert.equal(wynik.ok, false);
  assert.match(wynik.powod, /[Ss]uma kontrolna/);
  assert.equal(db().prepare('SELECT status FROM psa_oplaty WHERE id = ?').get(oplata.id).status, 'naliczona');
});

test('zaplacono mniej, niz nalezy — oplata zostaje otwarta', async () => {
  const oplata = dodajOplate({ kwotaGrosze: 10000 });
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });

  const wynik = platnosci.przyjmijPowiadomienie(db(), powiadomienie(platnosc, { kwota: '50.00' }));
  assert.equal(wynik.ok, false);
  assert.match(wynik.powod, /50\.00 zł zamiast 100\.00 zł/);
  assert.equal(db().prepare('SELECT status FROM psa_oplaty WHERE id = ?').get(oplata.id).status, 'naliczona');
});

test('powiadomienie z piaskownicy nie ksieguje platnosci produkcyjnej', async () => {
  const oplata = dodajOplate();
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  assert.equal(platnosc.tryb_testowy, 0, 'transakcja zalozona w trybie produkcyjnym');

  const wynik = platnosci.przyjmijPowiadomienie(db(), powiadomienie(platnosc, { test_mode: '1' }));
  assert.equal(wynik.ok, false);
  assert.match(wynik.powod, /[Tt]ryb powiadomienia/);
  assert.equal(db().prepare('SELECT status FROM psa_oplaty WHERE id = ?').get(oplata.id).status, 'naliczona');
});

test('nieznany status transakcji nigdy nie znaczy „oplacona”', async () => {
  const oplata = dodajOplate();
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });

  const wynik = platnosci.przyjmijPowiadomienie(db(), powiadomienie(platnosc, { status: 'COS_NOWEGO' }));
  assert.equal(wynik.zaksiegowano, false);
  assert.equal(db().prepare('SELECT status FROM psa_oplaty WHERE id = ?').get(oplata.id).status, 'naliczona');
});

test('to samo powiadomienie dwa razy ksieguje raz', async () => {
  const oplata = dodajOplate({ kwotaGrosze: 7700 });
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  const itn = powiadomienie(platnosc);

  const pierwsze = platnosci.przyjmijPowiadomienie(db(), itn);
  assert.equal(pierwsze.zaksiegowano, true);
  const drugie = platnosci.przyjmijPowiadomienie(db(), itn);
  assert.equal(drugie.ok, true);
  assert.equal(drugie.zaksiegowano, false, 'idempotencja po stanie proby');

  const po = db().prepare('SELECT * FROM psa_oplaty WHERE id = ?').get(oplata.id);
  assert.equal(po.status, 'oplacona');
  assert.ok(po.oplacona_kiedy, 'data zaplaty zapisana');
});

test('zaplata uruchamia zadanie wpisu zlozone przez portal', async () => {
  const teraz = new Date().toISOString();
  const sprawa = db()
    .prepare(
      `INSERT INTO psa_sprawy (spolka_id, typ_zdarzenia, zrodlo, data_wplywu, stan, autor, utworzono,
                               oczekuje_na_oplate, termin_do)
       VALUES (?, 'przeniesienie', 'portal', '2026-01-01', 'nowa', 'test', ?, 1, '2026-01-08')`
    )
    .run(spolkaId, teraz);
  const sprawaId = Number(sprawa.lastInsertRowid);
  const oplata = dodajOplate({ typ: 'wpis', sprawaId, kwotaGrosze: 20000 });

  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  const wynik = platnosci.przyjmijPowiadomienie(db(), powiadomienie(platnosc));
  assert.equal(wynik.zaksiegowano, true);

  const po = db().prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(sprawaId);
  assert.equal(po.oczekuje_na_oplate, 0, 'sprawa wchodzi do kolejki kancelarii');
  // Art. 300(34) § 1 KSH: tydzien liczy sie od OTRZYMANIA zadania, a zadanie
  // zlozone przez portal dochodzi do skutku z chwila zaplaty.
  const dzis = new Date().toISOString().slice(0, 10);
  assert.equal(po.data_wplywu, dzis, 'dzien zaplaty jest dniem wplywu zadania');
  assert.notEqual(po.termin_do, '2026-01-08', 'termin przeliczony od nowa');
});

test('awaryjne odpytanie ksieguje tak samo jak powiadomienie', async () => {
  const oplata = dodajOplate({ kwotaGrosze: 4200 });
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });

  zachowanieAtrapy = { blad: null, status: 'pending' };
  const czeka = await platnosci.sprawdzUOperatora(db(), platnosc.id);
  assert.equal(czeka.zaksiegowano, false);

  zachowanieAtrapy = { blad: null, status: 'correct' };
  const zaplacone = await platnosci.sprawdzUOperatora(db(), platnosc.id);
  assert.equal(zaplacone.zaksiegowano, true);
  assert.equal(db().prepare('SELECT status FROM psa_oplaty WHERE id = ?').get(oplata.id).status, 'oplacona');
  zachowanieAtrapy = { blad: null, status: 'pending' };
});

test('okres prowadzenia biegnie od otwarcia rejestru, nie od Nowego Roku', () => {
  assert.deepEqual(oplatyModul.okresProwadzenia('2026-11-20', 1), {
    od: '2026-11-20', do: '2027-11-19', etykieta: '2026/2027',
  });
  assert.deepEqual(oplatyModul.okresProwadzenia('2026-11-20', 2), {
    od: '2027-11-20', do: '2028-11-19', etykieta: '2027/2028',
  });

  const pierwszy = oplatyModul.naliczPierwszyRok(db(), {
    spolkaId, dataOtwarcia: '2026-11-20', autor: 'test',
  });
  assert.equal(pierwszy.utworzono, true);
  assert.equal(pierwszy.oplata.okres_od, '2026-11-20');
  assert.equal(pierwszy.oplata.okres_do, '2027-11-19');

  // Idempotentne: drugi raz za ten sam okres nic nie wstawia.
  assert.equal(
    oplatyModul.naliczPierwszyRok(db(), { spolkaId, dataOtwarcia: '2026-11-20', autor: 'test' }).utworzono,
    false
  );

  // Przypomnienie: okres konczy sie 2027-11-19, wiec 30 dni wczesniej juz widac.
  const doOdnowienia = oplatyModul.okresyDoOdnowienia(db(), { dni: 30, dzis: '2027-11-01' });
  const nasza = doOdnowienia.find((w) => w.spolka_id === spolkaId);
  assert.ok(nasza, 'spolka jest na liscie do odnowienia');
  assert.equal(nasza.nastepny.od, '2027-11-20');
  assert.equal(
    oplatyModul.okresyDoOdnowienia(db(), { dni: 30, dzis: '2027-01-01' })
      .some((w) => w.spolka_id === spolkaId),
    false,
    'rok wczesniej nie ma jeszcze czego przypominac'
  );
});

test('token operatora odnawia sie po odrzuceniu — jedno ponowienie, nie petla', async () => {
  tpay._zapomnijToken();
  const oplata = dodajOplate();
  const wynik = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  assert.ok(wynik.platnosc.link, 'po wygasnieciu tokenu transakcja i tak powstaje');
});
