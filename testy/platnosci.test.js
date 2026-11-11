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
/** Identyfikatory transakcji, ktore kazalismy operatorowi uniewaznic. */
let anulowane = [];
/** Ostatnie cialo wyslane do /transactions — do sprawdzenia pol zadania. */
let ostatnieZadanie = null;

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
          // Operator przyjmuje tu FORMULARZ, nie JSON. Atrapa pilnuje tego
          // tak samo, inaczej test przepuscilby bledna implementacje.
          if (!String(zad.headers['content-type'] || '').includes('x-www-form-urlencoded')) {
            return odpowiedz(400, { error: 'oczekiwano application/x-www-form-urlencoded' });
          }
          const pola = new URLSearchParams(cialo);
          if (!pola.get('client_id') || !pola.get('client_secret')) {
            return odpowiedz(400, { error: 'brak client_id/client_secret' });
          }
          return odpowiedz(200, { access_token: 'token-atrapy', expires_in: 7200 });
        }
        if (/^\/transactions\/[^/]+\/cancel$/.test(zad.url) && zad.method === 'POST') {
          anulowane.push(zad.url.split('/')[2]);
          return odpowiedz(200, { result: 'success' });
        }
        if (zad.url === '/transactions' && zad.method === 'POST') {
          try { ostatnieZadanie = JSON.parse(cialo); } catch (e) { ostatnieZadanie = null; }
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
let tpay;
let spolkaId;

test.before(async () => {
  await uruchomAtrape();
  // Konfiguracja czyta `process.env` przy pierwszym `require` — dlatego
  // moduly wczytujemy DOPIERO po podniesieniu atrapy.
  ({ db } = require('../server/baza'));
  require('../server/migracje').uruchom(db());
  platnosci = require('../server/platnosci');
  tpay = require('../server/logika/tpay');
  spolkaId = require('./pomoc').dodajSpolke(db(), { nazwa: 'Platnosci Testowa P.S.A.' });
});

test.after(() => {
  if (atrapa) atrapa.close();
});

let okres = 0;
function dodajOplate({ kwotaGrosze = 5000, typ = 'informacja' } = {}) {
  okres += 1;
  const oplataId = require('../server/dane/oplaty').dodaj(db(), {
    spolka_id: spolkaId, typ, platnik: 'spolka', okres: typ === 'prowadzenie' ? `okres-${okres}` : null,
    kwota_netto_grosze: kwotaGrosze, stawka_vat_procent: 23, autor: 'test',
  });
  return db().prepare('SELECT * FROM psa_oplaty WHERE id = ?').get(oplataId);
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
  db().prepare('UPDATE psa_oplaty SET kwota_netto_grosze = ? WHERE id = ?').run(20000, oplata.id);
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

test('Z-VAT: klient placi BRUTTO, oplata w bazie zostaje netto (sekcja 2.1)', async () => {
  const oplata = dodajOplate({ kwotaGrosze: 10000 });

  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  // 100 zl netto + 23% VAT = 123 zl — to jest kwota, ktora faktycznie idzie do tpay.
  assert.equal(platnosc.kwota_grosze, 12300);

  const wynik = platnosci.przyjmijPowiadomienie(db(), powiadomienie(platnosc));
  assert.equal(wynik.zaksiegowano, true);
  // psa_oplaty.kwota_netto_grosze NIGDY nie zmienia sie na brutto - zostaje netto.
  assert.equal(db().prepare('SELECT kwota_netto_grosze FROM psa_oplaty WHERE id = ?').get(oplata.id).kwota_netto_grosze, 10000);
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
  assert.equal(db().prepare('SELECT stan FROM psa_oplaty WHERE id = ?').get(oplata.id).stan, 'do_zaplaty');
});

test('zaplacono mniej, niz nalezy — oplata zostaje otwarta', async () => {
  // Klient placi BRUTTO (sekcja 2.1): 100 zl netto + 23% VAT = 123 zl.
  const oplata = dodajOplate({ kwotaGrosze: 10000 });
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });

  const wynik = platnosci.przyjmijPowiadomienie(db(), powiadomienie(platnosc, { kwota: '50.00' }));
  assert.equal(wynik.ok, false);
  assert.match(wynik.powod, /50\.00 zł zamiast 123\.00 zł/);
  assert.equal(db().prepare('SELECT stan FROM psa_oplaty WHERE id = ?').get(oplata.id).stan, 'do_zaplaty');
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
  assert.equal(db().prepare('SELECT stan FROM psa_oplaty WHERE id = ?').get(oplata.id).stan, 'do_zaplaty');
});

test('nieznany status transakcji nigdy nie znaczy „oplacona”', async () => {
  const oplata = dodajOplate();
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });

  const wynik = platnosci.przyjmijPowiadomienie(db(), powiadomienie(platnosc, { status: 'COS_NOWEGO' }));
  assert.equal(wynik.zaksiegowano, false);
  assert.equal(db().prepare('SELECT stan FROM psa_oplaty WHERE id = ?').get(oplata.id).stan, 'do_zaplaty');
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
  assert.equal(po.stan, 'oplacona');
  assert.ok(po.oplacono, 'data zaplaty zapisana');
});

test('token operatora odnawia sie po odrzuceniu — jedno ponowienie, nie petla', async () => {
  tpay._zapomnijToken();
  const oplata = dodajOplate();
  const wynik = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  assert.ok(wynik.platnosc.link, 'po wygasnieciu tokenu transakcja i tak powstaje');
});

/* ─────────────────────────────────────────────────────
   Trasa ITN — kanal PUBLICZNY, bez sesji
   ───────────────────────────────────────────────────── */

test('ITN: odpowiada czystym TRUE i nie wycieka szczegolow', async () => {
  const express = require('express');
  const app = require('../serwer');
  const serwer = app.listen(0, '127.0.0.1');
  await new Promise((g) => serwer.once('listening', g));
  const baza = `http://127.0.0.1:${serwer.address().port}`;
  void express;

  const oplata = dodajOplate({ kwotaGrosze: 3300 });
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: `${baza}/api/psa/platnosci/tpay/itn`, urlPowrotu: 'https://x',
  });

  async function itn(pola) {
    const odp = await fetch(`${baza}/api/psa/platnosci/tpay/itn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(pola).toString(),
    });
    return [odp.status, await odp.text()];
  }

  // Smiec bez podpisu: potwierdzamy odbior (inaczej operator ponawia
  // w kolko), ale NIE mowimy, co bylo nie tak — to kanal publiczny.
  const [stSmieci, trescSmieci] = await itn({ id: '1', tr_id: 'X', tr_amount: '1.00', tr_crc: 'nieznany', md5sum: 'zle' });
  assert.equal(stSmieci, 200);
  assert.equal(trescSmieci, 'TRUE', 'czysty TRUE, bez HTML i JSON');

  const [stOk, trescOk] = await itn(powiadomienie(platnosc));
  assert.equal(stOk, 200);
  assert.equal(trescOk, 'TRUE');
  assert.equal(
    db().prepare('SELECT stan FROM psa_oplaty WHERE id = ?').get(oplata.id).stan,
    'oplacona',
    'poprawne powiadomienie ksieguje zaplate'
  );

  // Trasa stoi PRZED bramka sesji — inaczej operator dostawalby 401.
  assert.notEqual(stOk, 401);

  await new Promise((g) => serwer.close(g));
});

test('ITN nie przyjmuje ciala wiekszego niz kilkanascie pol', async () => {
  const app = require('../serwer');
  const serwer = app.listen(0, '127.0.0.1');
  await new Promise((g) => serwer.once('listening', g));
  const baza = `http://127.0.0.1:${serwer.address().port}`;

  const odp = await fetch(`${baza}/api/psa/platnosci/tpay/itn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `id=1&x=${'a'.repeat(64 * 1024)}`,
  });
  assert.notEqual(odp.status, 200, 'przerosniete cialo odrzucone, nie przetwarzane');

  await new Promise((g) => serwer.close(g));
});

/* ─────────────────────────────────────────────────────
   Zgodnosc z notatka wdrozeniowa (TPAY-INTEGRACJA.md)
   ───────────────────────────────────────────────────── */

test('zadanie transakcji niesie walute, opis w limicie i wlasny kanal powiadomien', async () => {
  const oplata = dodajOplate({ kwotaGrosze: 15000, typ: 'prowadzenie' });
  await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });

  assert.equal(ostatnieZadanie.currency, 'PLN');
  assert.ok(ostatnieZadanie.description.length <= 128, 'opis mieści się w limicie operatora');
  // Kasa poprzedza opis slowami „Płatność za …" — ma sie to zlozyc w zdanie.
  assert.match(ostatnieZadanie.description, /^prowadzenie rejestru akcjonariuszy/);
  assert.equal(ostatnieZadanie.hiddenDescription.startsWith('psa-'), true, 'crc wraca w powiadomieniu');
  assert.ok(ostatnieZadanie.callbacks.notification.url, 'adres powiadomien');
  assert.equal(ostatnieZadanie.payer, undefined, 'bez payer — klient podaje swoj adres sam');
});

/**
 * `tr_status` przyjmuje `TRUE`, `PAID` albo `CHARGEBACK`. Sprawdzanie samego
 * `TRUE` przepuszczalo `PAID` jako „oczekuje" — zaplacona naleznosc nigdy
 * by sie nie zaksiegowala, a pieniadze lezalyby na rachunku kancelarii.
 */
test('powiadomienie ze statusem PAID ksieguje tak samo jak TRUE', async () => {
  const oplata = dodajOplate({ kwotaGrosze: 6600 });
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  const wynik = platnosci.przyjmijPowiadomienie(db(), powiadomienie(platnosc, { status: 'PAID' }));
  assert.equal(wynik.zaksiegowano, true);
  assert.equal(db().prepare('SELECT stan FROM psa_oplaty WHERE id = ?').get(oplata.id).stan, 'oplacona');
});

/**
 * Liczy sie `tr_paid` — ile klient FAKTYCZNIE zaplacil — a nie `tr_amount`,
 * czyli kwota, na ktora transakcje wystawilismy. Przy niedoplacie te dwie
 * sie roznia i tylko pierwsza mowi prawde o pieniadzach.
 */
test('niedoplata widoczna w tr_paid nie ksieguje, mimo poprawnego tr_amount', async () => {
  // Klient placi BRUTTO (sekcja 2.1): 100 zl netto + 23% VAT = 123 zl.
  const oplata = dodajOplate({ kwotaGrosze: 10000 });
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  // tr_amount zgodne (suma kontrolna liczy sie z niego), tr_paid zanizone.
  const itn = { ...powiadomienie(platnosc), tr_paid: '30.00' };
  const wynik = platnosci.przyjmijPowiadomienie(db(), itn);
  assert.equal(wynik.ok, false);
  assert.match(wynik.powod, /30\.00 zł zamiast 123\.00 zł/);
  assert.equal(db().prepare('SELECT stan FROM psa_oplaty WHERE id = ?').get(oplata.id).stan, 'do_zaplaty');
});

test('powiadomienie o cudzej transakcji nie ksieguje naszej', async () => {
  const oplata = dodajOplate({ kwotaGrosze: 5500 });
  const { platnosc } = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });
  // Poprawny crc, ale tr_id z innej transakcji.
  const itn = powiadomienie(platnosc);
  itn.tr_id = 'TR-CUDZE';
  itn.md5sum = crypto.createHash('md5')
    .update(`${itn.id}${itn.tr_id}${itn.tr_amount}${itn.tr_crc}${SEKRET_ITN}`).digest('hex');
  const wynik = platnosci.przyjmijPowiadomienie(db(), itn);
  assert.equal(wynik.ok, false);
  assert.match(wynik.powod, /[Nn]umer transakcji/);
});

/**
 * Sam wpis w naszej bazie nie gasi linku, ktory klient ma w mailu — bez
 * wywolania `/cancel` dalo sie zaplacic nieaktualna kwote.
 */
test('zmiana kwoty uniewaznia stara transakcje TAKZE u operatora', async () => {
  anulowane = [];
  const oplata = dodajOplate({ kwotaGrosze: 8000 });
  const pierwsza = await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });

  db().prepare('UPDATE psa_oplaty SET kwota_netto_grosze = ? WHERE id = ?').run(9500, oplata.id);
  await platnosci.przygotujZaplate(db(), {
    oplataId: oplata.id, urlPowiadomienia: 'https://x/itn', urlPowrotu: 'https://x/powrot',
  });

  assert.ok(
    anulowane.includes(pierwsza.platnosc.tpay_id),
    `operator dostal polecenie uniewaznienia ${pierwsza.platnosc.tpay_id}; anulowane: ${anulowane.join(',')}`
  );
});

test('adresy operatora rozpoznawane, takze w zapisie IPv4-w-IPv6', () => {
  assert.equal(tpay.zAdresuOperatora('176.119.38.175'), true);
  assert.equal(tpay.zAdresuOperatora('::ffff:46.29.19.106'), true);
  assert.equal(tpay.zAdresuOperatora('1.2.3.4'), false);
  assert.equal(tpay.zAdresuOperatora(null), false);
});

/**
 * „alg: none" i algorytmy symetryczne to klasyczne obejscie podpisu JWS —
 * nie przyjmujemy niczego, czego sami nie wybralismy.
 */
test('podpis JWS: odrzuca zly ksztalt i podstawiony algorytm', async () => {
  const cialo = Buffer.from('id=1&tr_id=X');
  assert.equal((await tpay.sprawdzPodpisJws('', cialo)).ok, false);
  assert.equal((await tpay.sprawdzPodpisJws('tylko.dwie', cialo)).ok, false);

  const naglowekNone = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const zNone = await tpay.sprawdzPodpisJws(`${naglowekNone}..`, cialo);
  assert.equal(zNone.ok, false);
  assert.match(zNone.powod, /algorytm/i);

  const naglowekHs = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  assert.equal((await tpay.sprawdzPodpisJws(`${naglowekHs}..x`, cialo)).ok, false);

  // Payload MUSI byc odlaczony — podpis obejmuje surowe cialo zadania.
  const naglowekRs = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
  const zPayloadem = await tpay.sprawdzPodpisJws(`${naglowekRs}.cos.x`, cialo);
  assert.equal(zPayloadem.ok, false);
  assert.match(zPayloadem.powod, /odłączony/i);
});
