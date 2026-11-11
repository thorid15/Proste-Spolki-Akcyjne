'use strict';

/**
 * Schemat bazy modułu PSA — jedna migracja bazowa (U-01) zamiast 71 dawnych.
 *
 * Dotyka wyłącznie obiektów `psa_*` — plik bazy jest wspólny dla modułów kancelarii.
 *
 * Do końca Fazy 6 uproszczenia schemat wolno edytować w miejscu: nazwa migracji niesie skrót
 * treści SQL, więc baza założona według innej wersji schematu (także według dawnych 71 migracji)
 * zakłada się od nowa — ale tylko wtedy, gdy `psa_zdarzenia` jest pusta albo baza jest oznaczona
 * jako testowa (`psa_baza_testowa`). Inaczej migracja odmawia działania: wpisów rejestru nie
 * wolno utracić (art. 300(31) § 4 KSH). Po Fazie 6 zmiany schematu idą jako kolejne migracje.
 */

const crypto = require('node:crypto');

const SQL_SCHEMAT = `
  -- ── Spółki, dla których prowadzimy rejestr ───────────────────────────────
  CREATE TABLE psa_spolki (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    krs               TEXT NOT NULL UNIQUE,
    nazwa             TEXT NOT NULL,               -- firma (art. 300(33) § 1 pkt 1)
    siedziba          TEXT NOT NULL,
    adres             TEXT NOT NULL,
    sad_rejestrowy    TEXT NOT NULL,               -- pkt 2
    data_rejestracji  TEXT NOT NULL,               -- pkt 3
    nip               TEXT,                        -- do faktur
    email             TEXT,                        -- zgoda na e-mail wynika z umowy (U-10)
    umowe_zawarl      TEXT,                        -- art. 300(32) § 1(2)
    platnosc          TEXT NOT NULL DEFAULT 'roczna' CHECK (platnosc IN ('roczna','miesieczna')),
    -- Materializacja wpisów „otwarcie” i „zamkniecie” (stan rejestru — U-14).
    data_otwarcia     TEXT,
    data_zamkniecia   TEXT,
    powod_zamkniecia  TEXT CHECK (powod_zamkniecia IN ('przekazanie','wykreslenie_spolki','rozwiazanie_umowy')),
    utworzono         TEXT NOT NULL
  );

  -- ── Kartoteka osób (akcjonariusze, uprawnieni, osoby działające za spółkę) ─
  CREATE TABLE psa_osoby (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    typ             TEXT NOT NULL CHECK (typ IN ('fizyczna','prawna')),
    nazwa           TEXT NOT NULL,                 -- imię i nazwisko albo firma
    pesel           TEXT CHECK (pesel IS NULL OR (typ = 'fizyczna' AND length(pesel) = 11)),
    data_urodzenia  TEXT CHECK (data_urodzenia IS NULL OR typ = 'fizyczna'),
    numer_rejestru  TEXT CHECK (numer_rejestru IS NULL OR typ = 'prawna'),
    adres           TEXT NOT NULL,
    -- glowny = zamieszkania (osoba fizyczna) albo siedziby (osoba prawna)
    rodzaj_adresu   TEXT NOT NULL DEFAULT 'glowny' CHECK (rodzaj_adresu IN ('glowny','doreczen')),
    email           TEXT,
    zgoda_email     INTEGER NOT NULL DEFAULT 0 CHECK (zgoda_email IN (0,1)),
    pep             INTEGER NOT NULL DEFAULT 0 CHECK (pep IN (0,1)),
    pep_opis        TEXT,
    aml_data        TEXT,                          -- data weryfikacji (U-06)
    uwagi           TEXT,
    utworzono       TEXT NOT NULL,
    -- D-076: osoba fizyczna — PESEL albo data urodzenia.
    CHECK (typ = 'prawna' OR pesel IS NOT NULL OR data_urodzenia IS NOT NULL),
    CHECK (zgoda_email = 0 OR email IS NOT NULL)
  );
  CREATE INDEX psa_ix_osoby_pesel ON psa_osoby (pesel);

  -- ── Wniosek o prowadzenie rejestru (zgłoszenie = wniosek — U-08) ─────────
  CREATE TABLE psa_wnioski (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    stan                   TEXT NOT NULL DEFAULT 'roboczy'
                             CHECK (stan IN ('roboczy','zlozony','przyjety','odrzucony')),
    krs                    TEXT NOT NULL,
    przejecie              INTEGER NOT NULL DEFAULT 0 CHECK (przejecie IN (0,1)),
    dotychczasowy_podmiot  TEXT,
    data_przejecia         TEXT,
    dane_json              TEXT NOT NULL DEFAULT '{}',   -- dane klienta przed weryfikacją (U-19)
    krs_json               TEXT NOT NULL DEFAULT '{}',   -- odpis z KRS przy założeniu (różnice wobec danych klienta)
    umowe_zawarl           TEXT,                         -- osoba zawierająca umowę za kancelarię (art. 300(32) § 1(2))
    checklista_json        TEXT NOT NULL DEFAULT '{}',
    notatka                TEXT,
    spolka_id              INTEGER REFERENCES psa_spolki(id),
    utworzono              TEXT NOT NULL,
    zmieniono              TEXT NOT NULL
  );

  -- ── Sprawy: każdy wpis idzie przez sprawę (R1) ───────────────────────────
  CREATE TABLE psa_sprawy (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    spolka_id           INTEGER NOT NULL REFERENCES psa_spolki(id),
    stan                TEXT NOT NULL DEFAULT 'w_toku'
                          CHECK (stan IN ('w_toku','wstrzymana','wpisana','odmowa','wycofana')),
    zadajacy            TEXT NOT NULL CHECK (zadajacy IN ('spolka','osoba','organ','brak')),
    zadajacy_osoba_id   INTEGER REFERENCES psa_osoby(id),
    zadajacy_opis       TEXT,                      -- organ: nazwa i sygnatura (U-15)
    data_wplywu         TEXT NOT NULL,
    wstrzymana_od       TEXT,
    wznowiona_od        TEXT,
    operacje_json       TEXT NOT NULL DEFAULT '[]',
    podstawa            TEXT,
    podstawa_data       TEXT,
    tresc_zatwierdzona  TEXT,                      -- chwila „Dalej” (krok 1 → 2); NULL = krok 1
    checklista_json     TEXT NOT NULL DEFAULT '{}',
    dopisane_json       TEXT NOT NULL DEFAULT '[]',-- osoby dopisane do powiadomienia (R2)
    zgody_json          TEXT NOT NULL DEFAULT '[]',-- zgody na wpis (art. 300(34) § 3, D-088)
    oplata              TEXT CHECK (oplata IN ('tak','nie')),
    przyczyna_odmowy    TEXT,
    klucz_idempotencji  TEXT UNIQUE,
    autor               TEXT NOT NULL,
    utworzono           TEXT NOT NULL,
    zmieniono           TEXT NOT NULL,
    CHECK ((zadajacy = 'osoba') = (zadajacy_osoba_id IS NOT NULL)),
    CHECK (zadajacy <> 'organ' OR zadajacy_opis IS NOT NULL),
    CHECK (stan <> 'odmowa' OR przyczyna_odmowy IS NOT NULL)
  );
  CREATE INDEX psa_ix_sprawy_spolka ON psa_sprawy (spolka_id, stan);

  -- ── ŹRÓDŁO PRAWDY: zdarzenia tylko dopisywane, łańcuch skrótów ───────────
  CREATE TABLE psa_zdarzenia (
    id                       INTEGER PRIMARY KEY,
    spolka_id                INTEGER NOT NULL REFERENCES psa_spolki(id),
    typ                      TEXT NOT NULL,
    data_wpisu               TEXT NOT NULL,   -- chwila wpisu (UTC, co do sekundy) — D-R01
    autor                    TEXT NOT NULL,
    sprawa_id                INTEGER NOT NULL REFERENCES psa_sprawy(id),
    dane_json                TEXT NOT NULL,   -- kanoniczny JSON, bez danych osobowych (R10)
    zdarzenie_prostowane_id  INTEGER REFERENCES psa_zdarzenia(id),
    uzasadnienie             TEXT,
    hash_poprzedni           TEXT NOT NULL,
    hash                     TEXT NOT NULL
  );
  CREATE INDEX psa_ix_zdarzenia_spolka ON psa_zdarzenia (spolka_id, data_wpisu, id);
  CREATE TRIGGER psa_zdarzenia_bez_update BEFORE UPDATE ON psa_zdarzenia
  BEGIN
    SELECT RAISE(ABORT, 'psa_zdarzenia jest append-only — pomyłkę prostuje się wpisem „sprostowanie”.');
  END;
  CREATE TRIGGER psa_zdarzenia_bez_delete BEFORE DELETE ON psa_zdarzenia
  BEGIN
    SELECT RAISE(ABORT, 'psa_zdarzenia jest append-only — wpisów rejestru nie usuwa się.');
  END;

  -- ── Materializacje (odtwarzalne w całości ze zdarzeń) ────────────────────
  CREATE TABLE psa_emisje (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    spolka_id       INTEGER NOT NULL REFERENCES psa_spolki(id),
    seria           TEXT NOT NULL,
    nr_od           INTEGER NOT NULL,
    nr_do           INTEGER NOT NULL,
    data_wpisu_krs  TEXT NOT NULL,                 -- art. 300(30) § 2
    UNIQUE (spolka_id, seria),
    CHECK (nr_od >= 1 AND nr_do >= nr_od)
  );

  CREATE TABLE psa_stan_akcji (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    spolka_id        INTEGER NOT NULL,
    seria            TEXT NOT NULL,
    kategoria        TEXT NOT NULL CHECK (kategoria IN ('akcjonariusz','umorzona')),
    osoba_id         INTEGER REFERENCES psa_osoby(id),
    nr_od            INTEGER NOT NULL,
    nr_do            INTEGER NOT NULL,
    czesc_licznik    INTEGER NOT NULL DEFAULT 1,
    czesc_mianownik  INTEGER NOT NULL DEFAULT 1,
    zdarzenie_od_id  INTEGER NOT NULL REFERENCES psa_zdarzenia(id),
    data_od          TEXT NOT NULL,
    zdarzenie_do_id  INTEGER REFERENCES psa_zdarzenia(id),
    data_do          TEXT,
    FOREIGN KEY (spolka_id, seria) REFERENCES psa_emisje (spolka_id, seria),
    CHECK ((kategoria = 'akcjonariusz') = (osoba_id IS NOT NULL)),
    CHECK (nr_do >= nr_od),
    -- art. 300(43): ułamek zawsze przypisany do jednego numeru akcji.
    CHECK (czesc_licznik = czesc_mianownik OR nr_od = nr_do)
  );
  CREATE INDEX psa_ix_stan_spolka ON psa_stan_akcji (spolka_id, seria, nr_od);
  CREATE INDEX psa_ix_stan_osoba ON psa_stan_akcji (osoba_id);

  -- Obciążenia i adnotacje na akcjach (art. 300(33) § 1 pkt 4, 6–7, 9–11).
  CREATE TABLE psa_atrybuty (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    spolka_id        INTEGER NOT NULL,
    -- Tożsamość atrybutu: wpis, który go ustanowił, i pozycja w tym wpisie (otwarcie ma ich wiele).
    zdarzenie_id     INTEGER NOT NULL REFERENCES psa_zdarzenia(id),
    pozycja          INTEGER NOT NULL DEFAULT 0,
    rodzaj          TEXT NOT NULL CHECK (rodzaj IN ('zastaw','uzytkowanie','zajecie',
                       'uprawnienie','ograniczenie','obowiazek','niepokryte','inna')),
    seria            TEXT NOT NULL,
    nr_od            INTEGER NOT NULL,
    nr_do            INTEGER NOT NULL,
    osoba_id         INTEGER REFERENCES psa_osoby(id),                -- zastawnik, użytkownik
    tresc            TEXT,
    prawo_glosu      INTEGER NOT NULL DEFAULT 0 CHECK (prawo_glosu IN (0,1)),
    zdarzenie_od_id  INTEGER NOT NULL REFERENCES psa_zdarzenia(id),
    data_od          TEXT NOT NULL,
    zdarzenie_do_id  INTEGER REFERENCES psa_zdarzenia(id),
    data_do          TEXT,
    FOREIGN KEY (spolka_id, seria) REFERENCES psa_emisje (spolka_id, seria),
    CHECK (nr_do >= nr_od)
  );
  CREATE INDEX psa_ix_atrybuty_spolka ON psa_atrybuty (spolka_id, seria, nr_od);

  -- ── Pliki przychodzące — jedna tabela (U-29: „pliki”) ────────────────────
  CREATE TABLE psa_pliki (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    spolka_id         INTEGER REFERENCES psa_spolki(id),
    osoba_id          INTEGER REFERENCES psa_osoby(id),
    sprawa_id         INTEGER REFERENCES psa_sprawy(id),
    wniosek_id        INTEGER REFERENCES psa_wnioski(id),
    nazwa             TEXT NOT NULL,
    sciezka           TEXT NOT NULL UNIQUE,        -- losowa nazwa na dysku
    typ               TEXT NOT NULL,
    sha256            TEXT NOT NULL,
    wgral             TEXT NOT NULL,
    wgrano            TEXT NOT NULL,
    dokument          TEXT,                        -- wniosek: który dokument (U-03)
    stan_podpisu      TEXT CHECK (stan_podpisu IN ('do_podpisu','do_sprawdzenia','potwierdzony','odrzucony')),
    powod_odrzucenia  TEXT,
    CHECK (spolka_id IS NOT NULL OR osoba_id IS NOT NULL OR wniosek_id IS NOT NULL),
    CHECK (sprawa_id IS NULL OR spolka_id IS NOT NULL)
  );
  CREATE INDEX psa_ix_pliki_sprawa ON psa_pliki (sprawa_id);
  CREATE INDEX psa_ix_pliki_osoba ON psa_pliki (osoba_id);

  -- ── Pisma wychodzące — jedna tabela (U-29: „pisma”) ──────────────────────
  CREATE TABLE psa_pisma (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    typ                TEXT NOT NULL CHECK (typ IN ('umowa','uchwala','zgoda_email',
                         'powiadomienie_zamierzony','powiadomienie_wpis','powiadomienie_odmowa',
                         'wezwanie','informacja')),
    numer              TEXT UNIQUE,
    spolka_id          INTEGER REFERENCES psa_spolki(id),
    sprawa_id          INTEGER REFERENCES psa_sprawy(id),
    wniosek_id         INTEGER REFERENCES psa_wnioski(id),
    adresat            TEXT NOT NULL CHECK (adresat IN ('spolka','osoba','organ','wnioskodawca')),
    adresat_osoba_id   INTEGER REFERENCES psa_osoby(id),
    adresat_opis       TEXT,                       -- organ — tylko tu, nie w treści pisma
    sygnatura          TEXT,                       -- organ: sygnatura (art. 300(35) § 4)
    kanal              TEXT NOT NULL CHECK (kanal IN ('email','list','portal')),
    stan               TEXT NOT NULL DEFAULT 'do_wyslania' CHECK (stan IN ('do_wyslania','wyslane','blad')),
    kontekst_json      TEXT NOT NULL DEFAULT '{}',
    plik               TEXT,
    sha256             TEXT,
    uniewaznione       TEXT,                       -- R2: wysłane powiadomienie po zmianie treści
    id_wiadomosci      TEXT,
    odpowiedz_serwera  TEXT,
    wyslano            TEXT,
    autor              TEXT NOT NULL,
    utworzono          TEXT NOT NULL,
    CHECK ((adresat = 'osoba') = (adresat_osoba_id IS NOT NULL))
  );
  CREATE INDEX psa_ix_pisma_sprawa ON psa_pisma (sprawa_id);
  CREATE INDEX psa_ix_pisma_stan ON psa_pisma (stan);

  -- ── Historia zmian danych osób i spółek (U-25, U-11) — tylko dopisywanie ─
  CREATE TABLE psa_historia_danych (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    osoba_id  INTEGER REFERENCES psa_osoby(id),
    spolka_id INTEGER REFERENCES psa_spolki(id),
    pole      TEXT NOT NULL,
    stara     TEXT,
    nowa      TEXT,
    plik_id   INTEGER REFERENCES psa_pliki(id),
    kto       TEXT NOT NULL,
    kiedy     TEXT NOT NULL,
    CHECK ((osoba_id IS NULL) <> (spolka_id IS NULL))
  );
  CREATE INDEX psa_ix_historia_osoba ON psa_historia_danych (osoba_id);
  CREATE INDEX psa_ix_historia_spolka ON psa_historia_danych (spolka_id);
  CREATE TRIGGER psa_historia_danych_bez_update BEFORE UPDATE ON psa_historia_danych
  BEGIN
    SELECT RAISE(ABORT, 'psa_historia_danych jest append-only.');
  END;
  CREATE TRIGGER psa_historia_danych_bez_delete BEFORE DELETE ON psa_historia_danych
  BEGIN
    SELECT RAISE(ABORT, 'psa_historia_danych jest append-only.');
  END;

  -- ── Opłaty (U-02, U-30) i płatności tpay ─────────────────────────────────
  CREATE TABLE psa_oplaty (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    spolka_id           INTEGER NOT NULL REFERENCES psa_spolki(id),
    typ                 TEXT NOT NULL CHECK (typ IN ('prowadzenie','wpis','informacja')),
    platnik             TEXT NOT NULL CHECK (platnik IN ('spolka','osoba')),
    platnik_osoba_id    INTEGER REFERENCES psa_osoby(id),
    sprawa_id           INTEGER UNIQUE REFERENCES psa_sprawy(id),  -- najwyżej jedna na sprawę
    pismo_id            INTEGER REFERENCES psa_pisma(id),
    okres               TEXT,
    kwota_netto_grosze  INTEGER NOT NULL CHECK (kwota_netto_grosze > 0),
    stawka_vat_procent  INTEGER NOT NULL,
    stan                TEXT NOT NULL DEFAULT 'do_zaplaty' CHECK (stan IN ('do_zaplaty','oplacona','anulowana')),
    powod_anulowania    TEXT,
    numer_faktury       TEXT,
    oplacono            TEXT,
    autor               TEXT NOT NULL,
    utworzono           TEXT NOT NULL,
    CHECK ((platnik = 'osoba') = (platnik_osoba_id IS NOT NULL)),
    CHECK (stan <> 'anulowana' OR powod_anulowania IS NOT NULL)
  );
  CREATE INDEX psa_ix_oplaty_spolka ON psa_oplaty (spolka_id, stan);
  CREATE UNIQUE INDEX psa_ux_oplaty_prowadzenie ON psa_oplaty (spolka_id, okres) WHERE typ = 'prowadzenie';

  CREATE TABLE psa_platnosci (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    oplata_id      INTEGER NOT NULL REFERENCES psa_oplaty(id),
    dostawca       TEXT NOT NULL DEFAULT 'tpay',
    tpay_id        TEXT,
    crc            TEXT NOT NULL UNIQUE,
    kwota_grosze   INTEGER NOT NULL,
    link           TEXT,
    status         TEXT NOT NULL DEFAULT 'oczekuje'
                     CHECK (status IN ('oczekuje','oplacona','nieudana','anulowana','wygasla')),
    tryb_testowy   INTEGER NOT NULL DEFAULT 0,
    utworzono      TEXT NOT NULL,
    zakonczono     TEXT,
    odpowiedz_json TEXT
  );
  CREATE INDEX psa_ix_platnosci_oplata ON psa_platnosci (oplata_id);
  CREATE INDEX psa_ix_platnosci_tpay ON psa_platnosci (tpay_id);

  -- ── Portal: jedno konto na osobę (U-23) ─────────────────────────────────
  CREATE TABLE psa_konta (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    email                    TEXT NOT NULL UNIQUE,
    hash_hasla               TEXT,
    osoba_id                 INTEGER UNIQUE REFERENCES psa_osoby(id),
    wniosek_id               INTEGER REFERENCES psa_wnioski(id),  -- przed przyjęciem wniosku
    aktywne                  INTEGER NOT NULL DEFAULT 0 CHECK (aktywne IN (0,1)),
    token_aktywacji          TEXT,
    token_wygasa             TEXT,
    regulamin_zaakceptowano  TEXT,
    ostatnie_logowanie       TEXT,
    tokeny_wersja            INTEGER NOT NULL DEFAULT 0,
    utworzono                TEXT NOT NULL,
    CHECK (osoba_id IS NOT NULL OR wniosek_id IS NOT NULL)
  );
  CREATE INDEX psa_ix_konta_token ON psa_konta (token_aktywacji);

  -- Osoby działające za spółkę (U-23).
  CREATE TABLE psa_reprezentanci (
    spolka_id  INTEGER NOT NULL REFERENCES psa_spolki(id),
    osoba_id   INTEGER NOT NULL REFERENCES psa_osoby(id),
    dodano     TEXT NOT NULL,
    PRIMARY KEY (spolka_id, osoba_id)
  );

  -- ── Pracownicy kancelarii i sesje ────────────────────────────────────────
  CREATE TABLE psa_uzytkownicy (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    imie                TEXT NOT NULL,
    email               TEXT NOT NULL UNIQUE,
    hash_hasla          TEXT NOT NULL,
    rola                TEXT NOT NULL DEFAULT 'pracownik' CHECK (rola IN ('admin','pracownik')),
    aktywny             INTEGER NOT NULL DEFAULT 1 CHECK (aktywny IN (0,1)),
    ostatnie_logowanie  TEXT,
    utworzono           TEXT NOT NULL,
    tokeny_wersja       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE psa_sesje_uniewaznione (
    jti     TEXT PRIMARY KEY,
    wygasa  TEXT NOT NULL
  );
  CREATE INDEX psa_ix_sesje_uniewaznione_wygasa ON psa_sesje_uniewaznione (wygasa);

  -- ── Dziennik dostępu i logowań — tylko dopisywanie, retencja 5 lat (D-122) ─
  CREATE TABLE psa_dziennik (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    chwila     TEXT NOT NULL,
    kto        TEXT NOT NULL,
    typ_kto    TEXT NOT NULL CHECK (typ_kto IN ('pracownik','portal')),
    spolka_id  INTEGER REFERENCES psa_spolki(id),
    osoba_id   INTEGER REFERENCES psa_osoby(id),
    akcja      TEXT NOT NULL,
    opis       TEXT
  );
  CREATE INDEX psa_ix_dziennik_chwila ON psa_dziennik (chwila);
  CREATE TRIGGER psa_dziennik_bez_update BEFORE UPDATE ON psa_dziennik
  BEGIN
    SELECT RAISE(ABORT, 'psa_dziennik jest append-only — wpisów dziennika nie edytuje się.');
  END;
  CREATE TRIGGER psa_dziennik_bez_delete BEFORE DELETE ON psa_dziennik
    WHEN OLD.chwila >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 years')
  BEGIN
    SELECT RAISE(ABORT, 'psa_dziennik jest append-only — usuwa się wyłącznie wpisy starsze niż 5 lat (D-122).');
  END;

  -- ── Dane kancelarii i osób zawierających umowy — jedyne źródło ──────────
  CREATE TABLE psa_ustawienia (
    klucz           TEXT PRIMARY KEY,
    wartosc         TEXT,
    zaktualizowano  TEXT NOT NULL,
    autor           TEXT NOT NULL
  );

  -- ── Oznaczenie bazy testowej (D-074) — zachowywane przy zakładaniu od nowa ─
  CREATE TABLE IF NOT EXISTS psa_baza_testowa (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    oznaczono        TEXT NOT NULL,
    opis             TEXT NOT NULL,
    przesuniecie_ms  INTEGER NOT NULL DEFAULT 0,
    walidator_wynik  TEXT NOT NULL DEFAULT 'qes_poprawny'
  );
`;

const SKROT_SCHEMATU = crypto.createHash('sha256').update(SQL_SCHEMAT).digest('hex').slice(0, 12);

const MIGRACJE = [{ wersja: 1, nazwa: `schemat bazowy (U-01) ${SKROT_SCHEMATU}`, sql: SQL_SCHEMAT }];

/** Tabele, które przetrwają założenie schematu od nowa. */
const ZACHOWANE = new Set(['psa_migracje', 'psa_baza_testowa']);

const SQL_TABELA_WERSJI = `
  CREATE TABLE IF NOT EXISTS psa_migracje (
    wersja     INTEGER PRIMARY KEY,
    nazwa      TEXT NOT NULL,
    wykonano   TEXT NOT NULL
  );
`;

function tabelaIstnieje(db, nazwa) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(nazwa));
}

function bazaTestowa(db) {
  return tabelaIstnieje(db, 'psa_baza_testowa') && Boolean(db.prepare('SELECT 1 FROM psa_baza_testowa WHERE id = 1').get());
}

/**
 * Zabezpieczenie U-01: zakładanie schematu od nowa kasuje obiekty `psa_*`. Wolno to zrobić tylko
 * wtedy, gdy rejestr nie ma żadnego wpisu albo baza jest oznaczona jako testowa.
 */
function sprawdzMoznaZalozyc(db) {
  if (!tabelaIstnieje(db, 'psa_zdarzenia')) return;
  const ile = db.prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia').get().ile;
  if (ile > 0 && !bazaTestowa(db)) {
    throw new Error(
      `Schemat bazy rejestru wymaga założenia od nowa, a psa_zdarzenia zawiera ${ile} wpisów, ` +
        'a baza nie jest oznaczona jako testowa. Migracja odmawia działania — wpisów rejestru nie wolno utracić.'
    );
  }
}

function usunObiektyPsa(db) {
  const obiekty = db
    .prepare("SELECT type, name FROM sqlite_master WHERE name LIKE 'psa\\_%' ESCAPE '\\' AND sql IS NOT NULL")
    .all()
    .filter((o) => !ZACHOWANE.has(o.name));
  for (const rodzaj of ['trigger', 'view', 'table']) {
    for (const o of obiekty.filter((x) => x.type === rodzaj)) db.exec(`DROP ${rodzaj.toUpperCase()} IF EXISTS "${o.name}"`);
  }
  db.prepare('DELETE FROM psa_migracje').run();
}

/**
 * Wykonuje niewykonane migracje; bazę z innym schematem zakłada od nowa (pod zabezpieczeniem).
 * Zwraca listę zastosowanych wersji.
 */
function uruchom(db) {
  db.exec(SQL_TABELA_WERSJI);
  const zapisane = db.prepare('SELECT wersja, nazwa FROM psa_migracje').all();
  const znane = (r) => MIGRACJE.some((m) => m.wersja === r.wersja && m.nazwa === r.nazwa);
  const innySchemat = zapisane.some((r) => !znane(r)) || (zapisane.length === 0 && tabelaIstnieje(db, 'psa_spolki'));

  if (innySchemat) {
    sprawdzMoznaZalozyc(db);
    db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => usunObiektyPsa(db))();
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }

  const wykonane = new Set(db.prepare('SELECT wersja FROM psa_migracje').all().map((r) => r.wersja));
  const zastosowane = [];
  for (const migracja of MIGRACJE) {
    if (wykonane.has(migracja.wersja)) continue;
    db.transaction(() => {
      db.exec(migracja.sql);
      db.prepare('INSERT INTO psa_migracje (wersja, nazwa, wykonano) VALUES (?, ?, ?)').run(
        migracja.wersja,
        migracja.nazwa,
        new Date().toISOString()
      );
    })();
    zastosowane.push(migracja.wersja);
  }
  return zastosowane;
}

module.exports = { uruchom };
