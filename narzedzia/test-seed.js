#!/usr/bin/env node
'use strict';

/**
 * `npm run test:seed` — baza testowa z danymi fikcyjnymi (T3, D-074).
 *
 * Tworzy od nowa `PSA_BAZA_TESTOWA` (domyslnie `dane-testowe/kancelaria-testowa.db`),
 * oznacza ja jako testowa i wypelnia scenariuszami PRZEZ ZWYKLE API aplikacji
 * (te same walidacje co w pracy kancelarii):
 *   - spolka z aktywnym rejestrem (Alfa Testowa P.S.A., KRS z atrapy),
 *   - akcjonariusze ze zgoda na komunikacje e-mail i bez niej,
 *   - zadanie wpisu zbycia BEZ zgody zbywcy (sprawa w weryfikacji),
 *   - wydana informacja z rejestru (zaplata przez atrape tpay + ITN),
 *   - zgloszenie z publicznego formularza (zaproszenie w skrzynce testowej).
 * Adresy `@example.com`, PESEL fikcyjne z poprawna suma kontrolna.
 *
 * Plik bazy, ktory istnieje i NIE jest oznaczony jako testowy, nie zostanie
 * nadpisany. Kolejne fazy dopisuja tu scenariusze nowych funkcji.
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

if (String(konfiguracja.NODE_ENV || '').toLowerCase() === 'production') {
  stop('Odmowa: NODE_ENV=production.');
}

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

migracje.uruchom(db());
trybTestowy.oznaczBaze(db(), 'Baza testowa — npm run test:seed, dane fikcyjne');

/** Fikcyjny PESEL z poprawna suma kontrolna. */
function pesel(rrmmdd, seria) {
  const cyfry = `${rrmmdd}${seria}`.split('').map(Number);
  const wagi = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const suma = cyfry.reduce((s, c, i) => s + c * wagi[i], 0);
  return `${rrmmdd}${seria}${(10 - (suma % 10)) % 10}`;
}

// ── HTTP do wlasnej aplikacji ─────────────────────────────────────────────
let ADRES;
function sesja() {
  return { ciastka: {} };
}
async function zapytaj(s, metoda, sciezka, cialo, { formularz = false } = {}) {
  const naglowki = { Cookie: Object.entries(s.ciastka).map(([k, v]) => `${k}=${v}`).join('; ') };
  let body;
  if (cialo !== undefined) {
    if (formularz) {
      naglowki['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(cialo).toString();
    } else {
      naglowki['Content-Type'] = 'application/json';
      body = JSON.stringify(cialo);
    }
  }
  const odp = await fetch(`${ADRES}${sciezka}`, { method: metoda, headers: naglowki, body, redirect: 'manual' });
  for (const c of odp.headers.getSetCookie()) {
    const [para] = c.split(';');
    const [k, ...v] = para.split('=');
    s.ciastka[k.trim()] = v.join('=');
  }
  const typ = odp.headers.get('content-type') || '';
  const dane = typ.includes('json') ? await odp.json() : await odp.text();
  if (odp.status >= 400) {
    throw new Error(`${metoda} ${sciezka} → ${odp.status}: ${typeof dane === 'string' ? dane : JSON.stringify(dane)}`);
  }
  return dane;
}

async function main() {
  const teraz = czas.terazIso();
  const hash = await hasla.hashuj(trybTestowy.HASLO_TESTOWE);

  // ── Konta kancelarii ────────────────────────────────────────────────────
  const dodajPracownika = db().prepare(
    `INSERT INTO psa_uzytkownicy (imie, email, hash_hasla, rola, aktywny, utworzono) VALUES (?, ?, ?, ?, 1, ?)`
  );
  dodajPracownika.run('Notariusz Testowy', 'notariusz@example.com', hash, 'admin', teraz);
  dodajPracownika.run('Pracownik Testowy', 'pracownik@example.com', hash, 'pracownik', teraz);
  db().prepare(
    `INSERT INTO psa_osoby_dzialajace (imie, nazwisko, funkcja, aktywny, utworzono) VALUES (?, ?, 'notariusz', 1, ?)`
  ).run('Łukasz', 'Kozon', teraz);

  // ── Aplikacja w tym procesie ────────────────────────────────────────────
  const app = require('../serwer');
  const serwer = app.listen(0);
  await new Promise((r) => serwer.once('listening', r));
  const port = serwer.address().port;
  ADRES = `http://127.0.0.1:${port}`;
  trybTestowy.ustawAtrapeTpay(port);

  const kancelaria = sesja();
  await zapytaj(kancelaria, 'POST', '/api/psa/auth/login', {
    email: 'notariusz@example.com', haslo: trybTestowy.HASLO_TESTOWE, droga_testowa: 'formularz',
  });

  // ── Spolka z aktywnym rejestrem ─────────────────────────────────────────
  const zKrs = await zapytaj(kancelaria, 'GET', '/api/psa/spolki/z-krs/0000990001');
  const daneKrs = zKrs.dane || zKrs.spolka || {};
  const { spolka } = await zapytaj(kancelaria, 'POST', '/api/psa/spolki', {
    ...Object.fromEntries(Object.entries(daneKrs).filter(([, v]) => v !== null && typeof v !== 'object')),
    krs: '0000990001',
    nazwa: 'Alfa Testowa P.S.A.',
    email: 'biuro.alfa@example.com',
    status: 'aktywna',
    data_umowy: czas.dzisIso(),
  });
  console.log(`[test:seed] spółka #${spolka.id} ${spolka.nazwa} (KRS ${spolka.krs})`);

  const osoba = async (dane) => (await zapytaj(kancelaria, 'POST', '/api/psa/osoby', {
    typ: 'fizyczna', kraj: 'Polska', aml_status: 'wykonane', ...dane,
  })).osoba;
  const anna = await osoba({
    imie: 'Anna', nazwisko: 'Testowa', pesel: pesel('850315', '0248'), data_urodzenia: '1985-03-15', plec: 'kobieta',
    kod_pocztowy: '80-001', miejscowosc: 'Gdańsk', ulica: 'Próbna', nr_domu: '10',
    email: 'anna.zgoda@example.com', zgoda_email_status: 'potwierdzona',
  });
  const bartosz = await osoba({
    imie: 'Bartosz', nazwisko: 'Próbny', pesel: pesel('790722', '1357'), data_urodzenia: '1979-07-22', plec: 'mezczyzna',
    kod_pocztowy: '80-002', miejscowosc: 'Gdańsk', ulica: 'Fikcyjna', nr_domu: '5',
    email: 'bartosz.bezzgody@example.com', zgoda_email_status: 'brak',
  });
  const celina = await osoba({
    imie: 'Celina', nazwisko: 'Nabywczyni', pesel: pesel('920101', '2468'), data_urodzenia: '1992-01-01', plec: 'kobieta',
    kod_pocztowy: '81-001', miejscowosc: 'Gdynia', ulica: 'Przykładowa', nr_domu: '7',
    email: 'celina.nabywca@example.com', zgoda_email_status: 'brak',
  });

  const otwarcie = await zapytaj(kancelaria, 'POST', `/api/psa/spolki/${spolka.id}/otworz-rejestr`, {
    checklista: {
      forma: true, wpis_krs: true, uchwala: true, reprezentacja: true, umowa: true, jedna_umowa: true,
      dane_z_umowy: true, ograniczenia: true, bilans: true, zakres_danych: true, aml: true,
    },
    zdarzenia: [
      {
        typ: 'emisja',
        klucz_tymczasowy: 'emisja-1',
        dane: { seria: 'A', nr_pierwszy: 1, ilosc: 1000, data_wpisu_krs: '2026-01-02', rodzaj_akcji: 'zwykla', tytul: 'Emisja założycielska' },
      },
      {
        typ: 'objecie',
        dane: {
          emisja_zdarzenie_id: { __odwolanie_do_partii: 'emisja-1' },
          pozycje: [
            { osoba_id: anna.id, ilosc: 600, pokryta: 'tak', cena_emisyjna_grosze: 100 },
            { osoba_id: bartosz.id, ilosc: 400, pokryta: 'tak', cena_emisyjna_grosze: 100 },
          ],
        },
      },
    ],
  });
  console.log(`[test:seed] rejestr otwarty: ${otwarcie.zdarzenia.map((z) => z.typ).join(', ')}`);

  // ── Konta portalu ───────────────────────────────────────────────────────
  const dodajKonto = db().prepare(
    `INSERT INTO psa_konta (email, hash_hasla, rola, spolka_id, osoba_id, aktywne, utworzono, rodo_zaakceptowano)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  );
  const zarzad = dodajKonto.run('zarzad@example.com', hash, 'spolka', spolka.id, null, teraz, teraz);
  db().prepare('INSERT INTO psa_konta_spolki (konto_id, spolka_id, utworzono) VALUES (?, ?, ?)')
    .run(zarzad.lastInsertRowid, spolka.id, teraz);
  dodajKonto.run('anna.zgoda@example.com', hash, 'akcjonariusz', null, anna.id, teraz, teraz);
  dodajKonto.run('bartosz.bezzgody@example.com', hash, 'akcjonariusz', null, bartosz.id, teraz, teraz);

  // ── Zadanie wpisu zbycia bez zgody zbywcy ───────────────────────────────
  const { sprawa } = await zapytaj(kancelaria, 'POST', '/api/psa/sprawy', {
    spolka_id: spolka.id,
    typ_zdarzenia: 'przeniesienie',
    zrodlo: 'portal',
    zadajacy_osoba_id: celina.id,
    zadajacy_rola: 'nabywca',
    data_wplywu: czas.dzisIso(),
    dokument_rodzaj: 'umowa_zbycia',
    dokument_data: czas.dzisIso(),
    notatka: 'Dane testowe — żądanie nabywcy, zbywca (Bartosz Próbny) nie wyraził zgody na wpis.',
  });
  await zapytaj(kancelaria, 'PATCH', `/api/psa/sprawy/${sprawa.id}`, { akcja: 'weryfikuj' });
  console.log(`[test:seed] sprawa ${sprawa.numer}: zbycie bez zgody zbywcy (weryfikacja)`);

  // ── Wydana informacja z rejestru (atrapa tpay + ITN) ────────────────────
  const akcjonariusz = sesja();
  await zapytaj(akcjonariusz, 'POST', '/api/psa/portal/login', {
    email: 'anna.zgoda@example.com', haslo: trybTestowy.HASLO_TESTOWE, droga_testowa: 'formularz',
  });
  const zamowienie = await zapytaj(akcjonariusz, 'POST', '/api/psa/portal/informacja/zamow', { spolka_id: spolka.id });
  if (!zamowienie.oplacona) {
    const idTransakcji = String(zamowienie.link || '').split('/').pop();
    if (!idTransakcji) throw new Error(`Brak linku do atrapy kasy: ${JSON.stringify(zamowienie)}`);
    await zapytaj(sesja(), 'POST', `/test/tpay/kasa/${idTransakcji}/itn`, { wynik: 'TRUE' }, { formularz: true });
  }
  const wydana = await zapytaj(akcjonariusz, 'POST', `/api/psa/portal/informacja/${zamowienie.oplata_id}/wydaj`, {});
  console.log(`[test:seed] wydana informacja z rejestru — dokument #${wydana.dokument_id}`);

  // ── Zgloszenie z formularza publicznego (zaproszenie w skrzynce) ────────
  await zapytaj(sesja(), 'POST', '/api/psa/portal/zgloszenia', {
    email: 'gamma.zarzad@example.com', krs: '0000990003', telefon: '500000000', opis: 'Dane testowe — zgłoszenie.',
  });
  console.log('[test:seed] zgłoszenie Gamma Zgłoszeniowa P.S.A. — zaproszenie w skrzynce testowej');

  serwer.close();
  console.log(`\n[test:seed] Gotowe: ${PLIK}`);
  console.log(`[test:seed] Konta (hasło ${trybTestowy.HASLO_TESTOWE}): ${trybTestowy.KONTA_TESTOWE.map((k) => k.email).join(', ')}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(`[test:seed] BŁĄD: ${e.message}`);
  process.exit(1);
});
