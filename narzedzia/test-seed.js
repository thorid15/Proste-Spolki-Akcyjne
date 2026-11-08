#!/usr/bin/env node
'use strict';

/**
 * `npm run test:seed` — baza testowa z danymi fikcyjnymi (D-074).
 *
 * Tworzy od nowa `PSA_BAZA_TESTOWA` (domyślnie `dane-testowe/kancelaria-testowa.db`), oznacza ją
 * jako testową i wypełnia przez zwykłe API aplikacji (te same walidacje co w pracy kancelarii):
 *   - Alfa Testowa P.S.A. — rejestr otwarty (2 serie, ułamek akcji), zastaw z prawem głosu,
 *     akcjonariuszka ze zgodą na korespondencję e-mail;
 *   - sprawa zbycia akcji bez zgody zbywcy na e-mail — po kroku 1, powiadomienie listem czeka
 *     na „Nadano” (scenariusz e2e Fazy 3);
 *   - Beta Testowa P.S.A. — spółka bez otwartego rejestru.
 * Spółki zakłada warstwa danych (wnioski wracają w Fazie 4). Adresy `@example.com`, PESEL
 * fikcyjne z poprawną sumą kontrolną. Plik bazy, który istnieje i NIE jest oznaczony jako
 * testowy, nie zostanie nadpisany. Kolejne fazy dopisują tu scenariusze.
 */

process.env.PSA_TRYB_TESTOWY = '1';

const fs = require('node:fs');
const path = require('node:path');
const konfiguracja = require('../server/konfiguracja');
const trybTestowy = require('../server/tryb-testowy');

function stop(komunikat) {
  console.error(`[test:seed] ${komunikat}`);
  process.exit(1);
}

if (String(konfiguracja.NODE_ENV || '').toLowerCase() === 'production') stop('Odmowa: NODE_ENV=production.');

const PLIK = konfiguracja.BAZA_TESTOWA;
if (fs.existsSync(PLIK) && !trybTestowy.bazaOznaczona(PLIK)) {
  stop(`Plik ${PLIK} istnieje i nie jest bazą testową — nie nadpisuję. Wskaż inny PSA_BAZA_TESTOWA.`);
}
for (const p of [PLIK, `${PLIK}-wal`, `${PLIK}-shm`]) fs.rmSync(p, { force: true });
fs.rmSync(konfiguracja.KATALOG_DOKUMENTOW, { recursive: true, force: true });
fs.rmSync(konfiguracja.KATALOG_SKRZYNKI, { recursive: true, force: true });
fs.mkdirSync(path.dirname(PLIK), { recursive: true });

const { db } = require('../server/baza');
const migracje = require('../server/migracje');
const hasla = require('../server/logika/hasla');
const czas = require('../server/pomocnicze/czas');
const daneSpolki = require('../server/dane/spolki');

migracje.uruchom(db());
trybTestowy.oznaczBaze(db(), 'Baza testowa — npm run test:seed, dane fikcyjne');

/** Fikcyjny PESEL z poprawną sumą kontrolną (`rrmmdd` — prawdziwa data). */
function pesel(rrmmdd, seria) {
  const cyfry = `${rrmmdd}${seria}`.split('').map(Number);
  const wagi = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const suma = cyfry.reduce((s, c, i) => s + c * wagi[i], 0);
  return `${rrmmdd}${seria}${(10 - (suma % 10)) % 10}`;
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const CHECKLISTA = { zadajacy: true, dokumenty: true, identyfikacja: true };

let ADRES;
const ciastka = {};
async function zapytaj(metoda, sciezka, cialo, { plik = null } = {}) {
  const naglowki = { Cookie: Object.entries(ciastka).map(([k, v]) => `${k}=${v}`).join('; '), Origin: ADRES };
  let body;
  if (plik) {
    body = new FormData();
    body.append('plik', new Blob([plik.tresc], { type: 'application/pdf' }), plik.nazwa);
  } else if (cialo !== undefined) {
    naglowki['Content-Type'] = 'application/json';
    body = JSON.stringify(cialo);
  }
  const odp = await fetch(`${ADRES}${sciezka}`, { method: metoda, headers: naglowki, body, redirect: 'manual' });
  for (const c of odp.headers.getSetCookie()) {
    const [k, ...v] = c.split(';')[0].split('=');
    ciastka[k.trim()] = v.join('=');
  }
  const dane = (odp.headers.get('content-type') || '').includes('json') ? await odp.json() : await odp.text();
  if (odp.status >= 400) throw new Error(`${metoda} ${sciezka} → ${odp.status}: ${JSON.stringify(dane)}`);
  return dane;
}

async function main() {
  const teraz = czas.terazIso();
  const hash = await hasla.hashuj(trybTestowy.HASLO_TESTOWE);
  const dodajPracownika = db().prepare(
    'INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono) VALUES (?, ?, ?, ?, 1, ?)'
  );
  dodajPracownika.run('Notariusz Testowy', 'notariusz@example.com', hash, 'admin', teraz);
  dodajPracownika.run('Pracownik Testowy', 'pracownik@example.com', hash, 'pracownik', teraz);

  // Dane kancelarii do pism (Ustawienia) — fikcyjne.
  const ustaw = db().prepare('INSERT OR REPLACE INTO psa_ustawienia (klucz, wartosc, zaktualizowano, autor) VALUES (?, ?, ?, ?)');
  for (const [k, v] of Object.entries({
    notariusz_mianownik: 'Notariusz Testowy',
    kancelaria_ulica: 'ul. Próbna 1',
    kancelaria_kod: '80-001',
    kancelaria_miasto: 'Gdańsk',
    kancelaria_nip: '5840000000',
    email: 'rejestr@kancelaria.example',
  })) ustaw.run(k, v, teraz, 'test:seed');

  const app = require('../serwer');
  const serwer = app.listen(0);
  await new Promise((r) => serwer.once('listening', r));
  ADRES = `http://127.0.0.1:${serwer.address().port}`;
  trybTestowy.ustawAtrapeTpay(serwer.address().port);
  await zapytaj('POST', '/api/psa/auth/login', { email: 'notariusz@example.com', haslo: trybTestowy.HASLO_TESTOWE, droga_testowa: 'formularz' });

  const alfa = daneSpolki.dodaj(db(), {
    krs: '0000990001',
    nazwa: 'Alfa Testowa P.S.A.',
    siedziba: 'Gdańsk',
    adres: 'ul. Testowa 1, 80-001 Gdańsk',
    sad_rejestrowy: 'Sąd Rejonowy Gdańsk-Północ w Gdańsku, VII Wydział Gospodarczy KRS',
    data_rejestracji: '2025-03-15',
    nip: '5840000001',
    email: 'biuro.alfa@example.com',
    umowe_zawarl: 'notariusz Łukasz Kozon',
  });
  daneSpolki.dodaj(db(), {
    krs: '0000990002',
    nazwa: 'Beta Testowa P.S.A.',
    siedziba: 'Sopot',
    adres: 'ul. Morska 2, 81-001 Sopot',
    sad_rejestrowy: 'Sąd Rejonowy Gdańsk-Północ w Gdańsku, VII Wydział Gospodarczy KRS',
    data_rejestracji: '2026-02-01',
  });

  const osoba = async (dane) => (await zapytaj('POST', '/api/psa/osoby', dane)).osoba;
  const anna = await osoba({ typ: 'fizyczna', nazwa: 'Anna Testowa', pesel: pesel('850505', '1234'), adres: 'ul. Zgodna 1, 80-002 Gdańsk', email: 'anna.zgoda@example.com' });
  const jan = await osoba({ typ: 'fizyczna', nazwa: 'Jan Bezzgody', pesel: pesel('790203', '5678'), adres: 'ul. Listowa 3, 80-003 Gdańsk' });
  const ewa = await osoba({ typ: 'fizyczna', nazwa: 'Ewa Ułamkowa', data_urodzenia: '1990-07-01', adres: 'ul. Krótka 4, 81-004 Sopot' });
  const bank = await osoba({ typ: 'prawna', nazwa: 'Bank Testowy S.A.', numer_rejestru: '0000990099', adres: 'ul. Bankowa 5, 00-001 Warszawa' });

  // Zgoda Anny na korespondencję e-mail — plik podpisanej zgody w karcie osoby (U-11).
  const plikZgody = await zapytaj('POST', `/api/psa/osoby/${anna.id}/pliki`, undefined, { plik: { tresc: PDF, nazwa: 'zgoda-email-podpisana.pdf' } });
  await zapytaj('PUT', `/api/psa/osoby/${anna.id}`, { zgoda_email: { zgoda: true, plik_id: plikZgody.id } });

  // Otwarcie rejestru Alfy — jedno kliknięcie (R1): serie A i B, ułamek akcji B 1, zastaw z prawem głosu.
  await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: alfa,
    zadajacy: 'spolka',
    podstawa: 'Umowa spółki i lista akcjonariuszy przy założeniu (dane testowe).',
    checklista: CHECKLISTA,
    wpisz: true,
    operacje: [
      {
        typ: 'otwarcie',
        zrodlo: 'zalozenie',
        serie: [
          { seria: 'A', numery: '1-1000', liczba: 1000, data_wpisu_krs: '2025-03-15' },
          { seria: 'B', numery: '1-10', liczba: 10, data_wpisu_krs: '2025-03-15' },
        ],
        akcjonariusze: [
          { osoba_id: anna.id, akcje: [{ seria: 'A', numery: '1-600', liczba: 600 }, { seria: 'B', numery: '1', liczba: 1, ulamek: '1/2' }] },
          { osoba_id: jan.id, akcje: [{ seria: 'A', numery: '601-1000', liczba: 400 }, { seria: 'B', numery: '2-10', liczba: 9 }] },
          { osoba_id: ewa.id, akcje: [{ seria: 'B', numery: '1', liczba: 1, ulamek: '1/2' }] },
        ],
        atrybuty: [
          { rodzaj: 'zastaw', akcje: [{ seria: 'A', numery: '1-100', liczba: 100 }], osoba_id: bank.id, prawo_glosu: true, tresc: 'Zastaw rejestrowy na zabezpieczenie kredytu (dane testowe).' },
        ],
      },
    ],
  });

  // Zbycie akcji przez Jana (bez zgody na e-mail) — po kroku 1 powiadomienie listem czeka na „Nadano”.
  const zbycie = await zapytaj('POST', '/api/psa/sprawy', {
    spolka_id: alfa,
    zadajacy: 'osoba',
    zadajacy_osoba_id: ewa.id,
    podstawa: 'Umowa sprzedaży akcji z 2 listopada 2026 r. (dane testowe).',
    operacje: [{ typ: 'przeniesienie', zbywca_osoba_id: jan.id, nabywcy: [{ osoba_id: ewa.id, akcje: [{ seria: 'A', numery: '601-650', liczba: 50 }] }] }],
  });
  await zapytaj('POST', `/api/psa/sprawy/${zbycie.sprawa.id}/krok`, { krok: 2 });

  // Faza 2: opłata za prowadzenie (proces dzienny), informacja z rejestru, powiadomienie o otwarciu wysłane e-mailem.
  require('../server/oplaty').naliczProwadzenie(db());
  await zapytaj('POST', `/api/psa/spolki/${alfa}/informacja`, { odbiorca: 'osoba', osoba_id: anna.id, oplata: 'tak' });
  const doSpolki = (await zapytaj('GET', '/api/psa/korespondencja?filtr=do_wyslania')).find((p) => p.spolka_id === alfa && p.typ === 'powiadomienie_wpis');
  await zapytaj('POST', `/api/psa/korespondencja/${doSpolki.id}/wyslij`);

  serwer.close();
  console.log(`\n[test:seed] Gotowe: ${PLIK}`);
  console.log(`[test:seed] Konta kancelarii (hasło ${trybTestowy.HASLO_TESTOWE}): notariusz@example.com, pracownik@example.com`);
  process.exit(0);
}

main().catch((e) => {
  console.error(`[test:seed] BŁĄD: ${e.message}`);
  process.exit(1);
});
