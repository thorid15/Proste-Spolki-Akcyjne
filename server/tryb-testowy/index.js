'use strict';

/**
 * Tryb testowy (T1-T6, SESJA-PSA-WYTYCZNE.md; DECYZJE.md D-074).
 *
 * Cel: notariusz przechodzi kazdy przeplyw kancelarii i portalu bez
 * skonfigurowanej poczty — na osobnej bazie z danymi fikcyjnymi.
 *
 * Zabezpieczenia (T6):
 *   - wlacza go WYLACZNIE `PSA_TRYB_TESTOWY` w `.env`;
 *   - `NODE_ENV=production` albo baza bez oznaczenia testowego → serwer
 *     odmawia startu (`sprawdzStart`), ZANIM uruchomi migracje;
 *   - poza trybem testowym trasy `/test/*` nie sa rejestrowane (404),
 *     a atrapy (skrzynka, KRS, tpay, walidator) niedostepne;
 *   - kazde logowanie w trybie testowym trafia do `psa_dziennik`.
 *
 * Logowanie testowe NIE ma wlasnego endpointu ani tokenu: lista kont na
 * ekranie logowania wola zwykle `POST /login` znanym haslem kont testowych,
 * a „Zaloguj (tryb testowy)" otwiera zwykly link aktywacyjny. Pomijane jest
 * wylacznie doreczenie e-mailem.
 */

const fs = require('node:fs');
const Database = require('better-sqlite3');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');

/** Haslo WSZYSTKICH kont testowych (baza testowa, dane fikcyjne). */
const HASLO_TESTOWE = 'Test-Haslo-2026';

/**
 * Konta testowe zakladane przez `npm run test:seed` — ta sama lista zasila
 * ekrany logowania (jedno klikniecie = zalogowanie).
 */
const KONTA_TESTOWE = [
  { aplikacja: 'kancelaria', email: 'notariusz@example.com', opis: 'Notariusz (administrator)' },
  { aplikacja: 'kancelaria', email: 'pracownik@example.com', opis: 'Pracownik kancelarii' },
  { aplikacja: 'portal', email: 'alfa.zarzad@example.com', opis: 'Zarząd Alfy — działa za spółkę' },
  { aplikacja: 'portal', email: 'anna.zgoda@example.com', opis: 'Anna Testowa — akcjonariuszka Alfy (zgoda na e-mail)' },
  { aplikacja: 'portal', email: 'gamma.zarzad@example.com', opis: 'Wnioskodawca — dokumenty do podpisu (Gamma Zgłoszeniowa)' },
];

/** Wyniki atrapy podstawowego testu podpisu (T5, D-086). */
const WYNIKI_WALIDATORA = {
  podpisany: 'Każdy plik jako podpisany (do weryfikacji przez pracownika)',
  brak_podpisu: 'Każdy plik jako niepodpisany (np. skan) — odrzucenie',
  zmieniony: 'Każdy plik jako różny od oryginału — odrzucenie',
  plik: 'Sprawdź plik jak na produkcji (czy ma podpis elektroniczny)',
};

class BladTrybuTestowego extends Error {
  constructor(komunikat) {
    super(komunikat);
    this.name = 'BladTrybuTestowego';
  }
}

/** Czy plik bazy niesie oznaczenie testowe — odczyt bez migracji i bez zapisu. */
function bazaOznaczona(sciezka) {
  if (sciezka !== ':memory:' && !fs.existsSync(sciezka)) return false;
  const db = new Database(sciezka, { readonly: true, fileMustExist: true });
  try {
    const tabela = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'psa_baza_testowa'")
      .get();
    if (!tabela) return false;
    return Boolean(db.prepare('SELECT 1 FROM psa_baza_testowa WHERE id = 1').get());
  } finally {
    db.close();
  }
}

/**
 * Strażnik startu (T6). Wołany przez `serwer.js` przed migracjami.
 * Rzuca `BladTrybuTestowego` z czytelnym komunikatem.
 */
function sprawdzStart(k = konfiguracja) {
  if (!k.TRYB_TESTOWY) return;
  if (String(k.NODE_ENV || '').toLowerCase() === 'production') {
    throw new BladTrybuTestowego(
      'Tryb testowy jest niedozwolony przy NODE_ENV=production. Usuń PSA_TRYB_TESTOWY z .env ' +
        'albo uruchom serwer poza środowiskiem produkcyjnym.'
    );
  }
  if (!bazaOznaczona(k.WSPOLNA_BAZA)) {
    throw new BladTrybuTestowego(
      `Tryb testowy: baza ${k.WSPOLNA_BAZA} nie istnieje albo nie jest oznaczona jako testowa. ` +
        'Utwórz ją poleceniem „npm run test:seed” (dane fikcyjne) albo oznacz kopię bazy ' +
        '„npm run test:oznacz -- <ścieżka>” i wskaż ją w PSA_BAZA_TESTOWA.'
    );
  }
}

/** Wczytuje stan trybu testowego z bazy (symulowana data) — po migracjach. */
function wczytajStan(db) {
  const wiersz = db.prepare('SELECT * FROM psa_baza_testowa WHERE id = 1').get();
  czas.ustawPrzesuniecie(wiersz ? wiersz.przesuniecie_ms : 0);
  return wiersz;
}

function oznaczBaze(db, opis) {
  db.prepare(
    `INSERT INTO psa_baza_testowa (id, oznaczono, opis) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET opis = excluded.opis`
  ).run(new Date().toISOString(), String(opis));
}

/** Najpozniejsza chwila zapisana w lancuchu zdarzen (UTC) albo null. */
function ostatnieZdarzenie(db) {
  const w = db.prepare('SELECT MAX(data_wpisu) AS ostatnia FROM psa_zdarzenia').get();
  return w && w.ostatnia ? w.ostatnia : null;
}

/**
 * Symulowana data (T4). `dzien` = `RRRR-MM-DD` (godzina zostaje biezaca)
 * albo `null` = powrot do daty rzeczywistej. Data wczesniejsza niz ostatnie
 * zdarzenie w rejestrze jest odrzucana — lancuch skrotow ma porzadek chwil.
 */
function ustawDate(db, dzien) {
  let przesuniecieMs = 0;
  if (dzien) {
    if (!czas.poprawnaData(dzien)) throw new BladTrybuTestowego('Podaj datę w formacie RRRR-MM-DD.');
    const [r, m, d] = dzien.split('-').map(Number);
    const teraz = new Date();
    const cel = new Date(r, m - 1, d, teraz.getHours(), teraz.getMinutes(), teraz.getSeconds());
    przesuniecieMs = cel.getTime() - teraz.getTime();
  }
  const ostatnie = ostatnieZdarzenie(db);
  const chwilaDocelowa = Date.now() + przesuniecieMs;
  if (ostatnie && chwilaDocelowa < Date.parse(ostatnie)) {
    throw new BladTrybuTestowego(
      `Nie można ustawić daty wcześniejszej niż ostatnie zdarzenie w rejestrze ` +
        `(${czas.dzienLokalny(ostatnie)} ${czas.godzinaLokalna(ostatnie, { sekundy: true })}) — ` +
        'łańcuch skrótów wymaga porządku chwil.'
    );
  }
  db.prepare('UPDATE psa_baza_testowa SET przesuniecie_ms = ? WHERE id = 1').run(przesuniecieMs);
  czas.ustawPrzesuniecie(przesuniecieMs);
  return przesuniecieMs;
}

function ustawWynikWalidatora(db, wynik) {
  if (!WYNIKI_WALIDATORA[wynik]) throw new BladTrybuTestowego('Nieznany wynik atrapy walidatora.');
  db.prepare('UPDATE psa_baza_testowa SET walidator_wynik = ? WHERE id = 1').run(wynik);
}

/** Wynik atrapy walidatora (T5) — dla adaptera walidacji z Fazy 2. */
function wynikWalidatora(db) {
  const w = db.prepare('SELECT walidator_wynik FROM psa_baza_testowa WHERE id = 1').get();
  return w && WYNIKI_WALIDATORA[w.walidator_wynik] ? w.walidator_wynik : 'podpisany';
}

/**
 * Wpis do dziennika logowan (T6) — tylko w trybie testowym. Wolany po
 * udanym logowaniu przez zwykle endpointy (`/login`, `/aktywacja/:token`).
 */
function zapiszLogowanie(db, { typKonta, kontoId, email, droga }) {
  if (!konfiguracja.TRYB_TESTOWY) return;
  const dozwolone = ['lista_kont', 'link_testowy', 'formularz', 'link_aktywacyjny'];
  db.prepare(
    `INSERT INTO psa_dziennik (chwila, kto, typ_kto, akcja, opis) VALUES (?, ?, ?, 'logowanie', ?)`
  ).run(
    czas.terazIso(),
    String(email),
    typKonta === 'pracownik' ? 'pracownik' : 'portal',
    `konto #${kontoId}; droga: ${dozwolone.includes(droga) ? droga : 'formularz'}; chwila rzeczywista ${new Date().toISOString()}; tryb testowy`
  );
}

/**
 * Atrapa tpay (T5) w samej aplikacji: gdy platnosci nie sa skonfigurowane,
 * tryb testowy kieruje klienta tpay do `/test/tpay/api` tego serwera.
 * Wolane po `listen` — adres zalezy od faktycznego portu.
 */
function ustawAtrapeTpay(port) {
  if (!konfiguracja.TRYB_TESTOWY) return false;
  const t = konfiguracja.TPAY;
  if (t.client_id && t.client_secret && !t.atrapa) return false;
  Object.assign(t, {
    atrapa: true,
    client_id: 'atrapa',
    client_secret: 'atrapa',
    notification_secret: 'atrapa-itn',
    api_url: `http://127.0.0.1:${port}/test/tpay/api`,
    tryb_testowy: true,
    url_powrotu: t.url_powrotu || `${konfiguracja.URL_PORTALU}#/platnosci`,
  });
  return true;
}

module.exports = {
  HASLO_TESTOWE,
  KONTA_TESTOWE,
  WYNIKI_WALIDATORA,
  BladTrybuTestowego,
  bazaOznaczona,
  sprawdzStart,
  wczytajStan,
  oznaczBaze,
  ostatnieZdarzenie,
  ustawDate,
  ustawWynikWalidatora,
  wynikWalidatora,
  zapiszLogowanie,
  ustawAtrapeTpay,
};
