'use strict';

/**
 * Migracje modulu PSA - IDEMPOTENTNE.
 *
 * Uruchamiane przy kazdym starcie serwera i w testach. Dotykaja wylacznie
 * obiektow `psa_*` - plik bazy jest wspolny dla modulow kancelarii.
 *
 * Zasada: kazda migracja da sie wykonac wielokrotnie bez skutkow ubocznych.
 * Zmiany schematu dopisujemy jako NOWA pozycje w `MIGRACJE`, nigdy nie
 * edytujemy juz wydanej.
 */

const MIGRACJE = [
  {
    wersja: 1,
    nazwa: 'rdzen rejestru - spolki, osoby, emisje, zdarzenia, materializacje',
    sql: `
      -- ── Spolki, dla ktorych prowadzimy rejestr ─────────────────────────
      CREATE TABLE IF NOT EXISTS psa_spolki (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        krs                     TEXT UNIQUE,
        nip                     TEXT,
        regon                   TEXT,
        nazwa                   TEXT NOT NULL,
        -- Kontrola z reguly domenowej nr 11: rejestr wylacznie dla P.S.A.
        forma_prawna            TEXT NOT NULL DEFAULT 'PROSTA SPÓŁKA AKCYJNA',
        kraj                    TEXT DEFAULT 'Polska',
        kod_pocztowy            TEXT,
        miejscowosc             TEXT,
        ulica                   TEXT,
        nr_domu                 TEXT,
        nr_lokalu               TEXT,
        sad_rejestrowy          TEXT,
        wydzial                 TEXT,
        telefon                 TEXT,
        email                   TEXT,
        www                     TEXT,
        status                  TEXT NOT NULL DEFAULT 'aktywna'
                                  CHECK (status IN ('aktywna','w_likwidacji','zawieszona','wykreslona')),
        komentarz_statusu       TEXT,
        data_utworzenia_spolki  TEXT,
        data_uchwaly_wyboru     TEXT,
        data_umowy              TEXT,
        data_otwarcia_rejestru  TEXT,
        data_zakonczenia_umowy  TEXT,
        opis                    TEXT,   -- drukowany na raporcie
        uwagi                   TEXT,   -- wewnetrzne, NIGDY na wydruku
        utworzono               TEXT NOT NULL,
        zaktualizowano          TEXT
      );

      -- ── Kartoteka wspolna: jeden inwestor w wielu spolkach wpisany raz ──
      CREATE TABLE IF NOT EXISTS psa_osoby (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        typ               TEXT NOT NULL CHECK (typ IN ('fizyczna','prawna')),
        nazwisko          TEXT,
        imie              TEXT,
        nazwa             TEXT,
        pesel             TEXT,
        data_urodzenia    TEXT,
        nip               TEXT,
        regon             TEXT,
        numer_w_rejestrze TEXT,
        nazwa_rejestru    TEXT,
        kraj              TEXT DEFAULT 'Polska',
        kod_pocztowy      TEXT,
        miejscowosc       TEXT,
        ulica             TEXT,
        nr_domu           TEXT,
        nr_lokalu         TEXT,
        adres_doreczen    TEXT,
        adres_edoreczen   TEXT,
        email             TEXT,
        telefon           TEXT,
        zgoda_email       INTEGER NOT NULL DEFAULT 0 CHECK (zgoda_email IN (0,1)),
        aml_status        TEXT NOT NULL DEFAULT 'brak'
                            CHECK (aml_status IN ('brak','wykonane','niemozliwe')),
        aml_data          TEXT,
        aml_notatka       TEXT,
        uwagi             TEXT,
        utworzono         TEXT NOT NULL,
        zaktualizowano    TEXT
      );

      -- ── ZRODLO PRAWDY: append-only lancuch zdarzen ─────────────────────
      CREATE TABLE IF NOT EXISTS psa_zdarzenia (
        id                       INTEGER PRIMARY KEY,
        spolka_id                INTEGER NOT NULL REFERENCES psa_spolki(id),
        typ                      TEXT NOT NULL,
        data_zdarzenia           TEXT NOT NULL,   -- DATE, z dokumentu
        data_wpisu               TEXT NOT NULL,   -- DATETIME co do sekundy, systemowa
        autor                    TEXT NOT NULL,
        sprawa_id                INTEGER,         -- FK od sprintu 2
        dane_json                TEXT NOT NULL,   -- kanoniczny JSON, dokladnie ten, ktory hashujemy
        zdarzenie_prostowane_id  INTEGER REFERENCES psa_zdarzenia(id),
        uzasadnienie             TEXT,
        hash_poprzedni           TEXT NOT NULL,
        hash                     TEXT NOT NULL
      );

      -- ── Emisje (materializacja zdarzen typu „emisja”) ──────────────────
      CREATE TABLE IF NOT EXISTS psa_emisje (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        spolka_id            INTEGER NOT NULL REFERENCES psa_spolki(id),
        zdarzenie_id         INTEGER NOT NULL UNIQUE REFERENCES psa_zdarzenia(id),
        tytul                TEXT,
        podstawa_prawna      TEXT,
        seria                TEXT NOT NULL,
        nr_pierwszy          INTEGER NOT NULL,
        ilosc                INTEGER NOT NULL,
        cena_emisyjna_grosze INTEGER,
        waluta               TEXT NOT NULL DEFAULT 'PLN',
        data_emisji          TEXT,
        status               TEXT NOT NULL DEFAULT 'aktywna'
                               CHECK (status IN ('aktywna','w_umarzaniu','umorzona','wykreslona')),
        opis                 TEXT,
        uwagi                TEXT
      );

      -- ── Stan akcji: przedzialy czasowe (materializacja) ────────────────
      -- Kolumna „kategoria” jest rozszerzeniem wobec sekcji 5 specyfikacji. Dzieki
      -- niej KAZDY numer akcji nalezy zawsze do dokladnie jednego otwartego
      -- przedzialu, wiec bilans z reguly nr 3 sprawdza sie jednym warunkiem
      -- (szczelne pokrycie zakresu emisji).
      CREATE TABLE IF NOT EXISTS psa_stan_akcji (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        spolka_id        INTEGER NOT NULL REFERENCES psa_spolki(id),
        emisja_id        INTEGER NOT NULL REFERENCES psa_emisje(id),
        kategoria        TEXT NOT NULL CHECK (kategoria IN ('nieobjeta','akcjonariusz','umorzona')),
        osoba_id         INTEGER REFERENCES psa_osoby(id),
        nr_od            INTEGER NOT NULL,
        nr_do            INTEGER NOT NULL,
        ilosc            INTEGER NOT NULL,
        tytul_nabycia    TEXT,
        zdarzenie_od_id  INTEGER NOT NULL REFERENCES psa_zdarzenia(id),
        data_od          TEXT NOT NULL,
        zdarzenie_do_id  INTEGER REFERENCES psa_zdarzenia(id),
        data_do          TEXT,
        CHECK (nr_do >= nr_od),
        CHECK ((kategoria = 'akcjonariusz') = (osoba_id IS NOT NULL))
      );

      -- ── Obciazenia i zajecia (materializacja) ──────────────────────────
      CREATE TABLE IF NOT EXISTS psa_obciazenia (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        spolka_id                 INTEGER NOT NULL REFERENCES psa_spolki(id),
        typ                       TEXT NOT NULL CHECK (typ IN ('zastaw','uzytkowanie','zajecie')),
        emisja_id                 INTEGER NOT NULL REFERENCES psa_emisje(id),
        nr_od                     INTEGER NOT NULL,
        nr_do                     INTEGER NOT NULL,
        osoba_id                  INTEGER REFERENCES psa_osoby(id),
        akcjonariusz_osoba_id     INTEGER REFERENCES psa_osoby(id),
        prawo_glosu               INTEGER NOT NULL DEFAULT 0 CHECK (prawo_glosu IN (0,1)),
        blokuje_rozporzadzanie    INTEGER NOT NULL DEFAULT 1 CHECK (blokuje_rozporzadzanie IN (0,1)),
        opis                      TEXT,
        zdarzenie_ustanowienia_id INTEGER NOT NULL REFERENCES psa_zdarzenia(id),
        data_od                   TEXT NOT NULL,
        zdarzenie_wykreslenia_id  INTEGER REFERENCES psa_zdarzenia(id),
        data_do                   TEXT,
        CHECK (nr_do >= nr_od)
      );

      -- ── Uprawnienia, przywileje, obowiazki (materializacja) ────────────
      CREATE TABLE IF NOT EXISTS psa_uprawnienia (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        spolka_id          INTEGER NOT NULL REFERENCES psa_spolki(id),
        rodzaj             TEXT NOT NULL CHECK (rodzaj IN ('uprawnienie','przywilej','obowiazek')),
        zakres             TEXT NOT NULL CHECK (zakres IN ('spolka','emisja','akcjonariusz')),
        emisja_id          INTEGER REFERENCES psa_emisje(id),
        osoba_id           INTEGER REFERENCES psa_osoby(id),
        tytul              TEXT,
        tresc              TEXT,
        data_ustanowienia  TEXT NOT NULL,
        zdarzenie_id       INTEGER NOT NULL REFERENCES psa_zdarzenia(id),
        status             TEXT NOT NULL DEFAULT 'aktywne' CHECK (status IN ('aktywne','wykreslone')),
        data_wykreslenia   TEXT
      );

      -- ── Ograniczenia w rozporzadzaniu akcja (materializacja) ───────────
      CREATE TABLE IF NOT EXISTS psa_ograniczenia (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        spolka_id            INTEGER NOT NULL REFERENCES psa_spolki(id),
        zakres               TEXT NOT NULL CHECK (zakres IN ('wszystkie','emisja','zakres_numerow')),
        emisja_id            INTEGER REFERENCES psa_emisje(id),
        nr_od                INTEGER,
        nr_do                INTEGER,
        wymaga_zgody_spolki  INTEGER NOT NULL DEFAULT 0 CHECK (wymaga_zgody_spolki IN (0,1)),
        prawo_pierwszenstwa  INTEGER NOT NULL DEFAULT 0 CHECK (prawo_pierwszenstwa IN (0,1)),
        opis                 TEXT,
        zdarzenie_id         INTEGER NOT NULL REFERENCES psa_zdarzenia(id),
        status               TEXT NOT NULL DEFAULT 'aktywne' CHECK (status IN ('aktywne','wykreslone')),
        data_wykreslenia     TEXT
      );

      -- ── Indeksy ────────────────────────────────────────────────────────
      CREATE INDEX IF NOT EXISTS psa_ix_zdarzenia_spolka
        ON psa_zdarzenia (spolka_id, data_zdarzenia, id);
      CREATE INDEX IF NOT EXISTS psa_ix_stan_spolka
        ON psa_stan_akcji (spolka_id, data_od, data_do);
      CREATE INDEX IF NOT EXISTS psa_ix_stan_osoba
        ON psa_stan_akcji (osoba_id, data_do);
      CREATE INDEX IF NOT EXISTS psa_ix_emisje_spolka
        ON psa_emisje (spolka_id, seria);
      CREATE INDEX IF NOT EXISTS psa_ix_obciazenia_spolka
        ON psa_obciazenia (spolka_id, data_do);
      CREATE INDEX IF NOT EXISTS psa_ix_osoby_nazwisko
        ON psa_osoby (nazwisko, imie);
      CREATE INDEX IF NOT EXISTS psa_ix_osoby_nazwa
        ON psa_osoby (nazwa);

      -- ── APPEND-ONLY: regula domenowa nr 1, egzekwowana przez baze ──────
      -- Sekcja 16: "Nie edytowac i nie kasowac rekordow w psa_zdarzenia -
      -- nigdy, w zadnym trybie". Wyzwalacze pilnuja tego takze wtedy, gdy
      -- ktos siegnie do bazy z pominieciem aplikacji.
      CREATE TRIGGER IF NOT EXISTS psa_zdarzenia_bez_update
      BEFORE UPDATE ON psa_zdarzenia
      BEGIN
        SELECT RAISE(ABORT,
          'psa_zdarzenia jest append-only — pomyłkę prostuje się zdarzeniem „sprostowanie”.');
      END;

      CREATE TRIGGER IF NOT EXISTS psa_zdarzenia_bez_delete
      BEFORE DELETE ON psa_zdarzenia
      BEGIN
        SELECT RAISE(ABORT,
          'psa_zdarzenia jest append-only — rekordów zdarzeń nie usuwa się.');
      END;
    `,
  },
];

/** Tabela wersji migracji modulu - wlasna, zeby nie kolidowac z innymi modulami. */
const SQL_TABELA_WERSJI = `
  CREATE TABLE IF NOT EXISTS psa_migracje (
    wersja     INTEGER PRIMARY KEY,
    nazwa      TEXT NOT NULL,
    wykonano   TEXT NOT NULL
  );
`;

/**
 * Wykonuje wszystkie niewykonane migracje. Bezpieczna do wielokrotnego
 * uruchomienia. Zwraca liste zastosowanych wersji.
 */
function uruchom(db) {
  db.exec(SQL_TABELA_WERSJI);

  const wykonane = new Set(
    db.prepare('SELECT wersja FROM psa_migracje').all().map((r) => r.wersja)
  );
  const zastosowane = [];

  for (const migracja of MIGRACJE) {
    if (wykonane.has(migracja.wersja)) continue;
    const transakcja = db.transaction(() => {
      db.exec(migracja.sql);
      db.prepare('INSERT INTO psa_migracje (wersja, nazwa, wykonano) VALUES (?, ?, ?)').run(
        migracja.wersja,
        migracja.nazwa,
        new Date().toISOString()
      );
    });
    transakcja();
    zastosowane.push(migracja.wersja);
  }

  return zastosowane;
}

module.exports = { uruchom, MIGRACJE };
