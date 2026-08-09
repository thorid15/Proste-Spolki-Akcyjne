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
  {
    wersja: 2,
    nazwa: 'workflow spraw - psa_sprawy, psa_dokumenty, psa_wydane_dokumenty',
    sql: `
      -- ── Sprawy: workflow od zadania do wpisu (sekcja 7 specyfikacji) ────
      -- Kolumny "wznowiona_od" i "dane_wejsciowe_json" sa rozszerzeniem
      -- wobec katalogu z sekcji 5:
      --   wznowiona_od        - dzien, od ktorego liczy sie NOWY, pelny
      --                          siedmiodniowy termin po usunieciu przeszkody
      --                          (server/logika/terminy.js, patrz komentarz
      --                          tamze co do przyjetej interpretacji ustawy);
      --   dane_wejsciowe_json - roboczy zapis kroku "co sie zmienia" kreatora,
      --                          zeby pracownik mogl wrocic do sprawy bez
      --                          utraty wprowadzonych danych (sekcja 9:
      --                          "kazdy krok da sie cofnac bez utraty danych").
      CREATE TABLE IF NOT EXISTS psa_sprawy (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        spolka_id             INTEGER NOT NULL REFERENCES psa_spolki(id),
        typ_zdarzenia         TEXT NOT NULL,
        zrodlo                TEXT NOT NULL CHECK (zrodlo IN ('portal','email','papier','z_urzedu')),
        zadajacy_osoba_id     INTEGER REFERENCES psa_osoby(id),
        zadajacy_opis         TEXT,
        data_wplywu           TEXT NOT NULL,
        stan                  TEXT NOT NULL DEFAULT 'nowa'
                                CHECK (stan IN ('nowa','weryfikacja','wstrzymana','wpisana','odmowa','anulowana')),
        termin_do             TEXT,
        wstrzymana_od         TEXT,
        wznowiona_od          TEXT,
        dni_wstrzymania       INTEGER NOT NULL DEFAULT 0,
        wymaga_powiadomienia  INTEGER NOT NULL DEFAULT 0 CHECK (wymaga_powiadomienia IN (0,1)),
        zgoda_forma           TEXT,
        zgoda_data            TEXT,
        powiadomienie_wyslano TEXT,
        zdarzenie_id          INTEGER REFERENCES psa_zdarzenia(id),
        powod_odmowy          TEXT,
        autor                 TEXT NOT NULL,
        notatka                TEXT,
        dane_wejsciowe_json   TEXT,
        utworzono             TEXT NOT NULL,
        zaktualizowano        TEXT
      );

      -- ── Dokumenty zalaczone do sprawy - pliki NA DYSKU, nie w bazie ─────
      CREATE TABLE IF NOT EXISTS psa_dokumenty (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        sprawa_id      INTEGER NOT NULL REFERENCES psa_sprawy(id),
        nazwa_pliku    TEXT NOT NULL,
        sciezka        TEXT NOT NULL,
        mime           TEXT,
        rozmiar        INTEGER,
        typ_dokumentu  TEXT NOT NULL
                         CHECK (typ_dokumentu IN
                           ('umowa_zbycia','uchwala','zgoda','postanowienie','pelnomocnictwo','inny')),
        hash           TEXT,
        wgral          TEXT NOT NULL,
        utworzono      TEXT NOT NULL
      );

      -- ── Slad wysylki dokumentow wychodzacych ────────────────────────────
      -- Kolumna „tresc_html” jest rozszerzeniem wobec katalogu z sekcji 5:
      -- dokumenty generujemy jako deterministyczny HTML (bez bibliotek PDF,
      -- sekcja 13), ktory sluzy JEDNOCZESNIE jako tresc e-maila i zapis
      -- audytowy - stad trzymamy go wprost w bazie, a nie jako plik
      -- wskazywany przez „sciezka_pdf”. Kolumna „sciezka_pdf” zostaje
      -- w schemacie zgodnie ze specyfikacja, ale w tym sprincie pozostaje NULL.
      CREATE TABLE IF NOT EXISTS psa_wydane_dokumenty (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        sprawa_id          INTEGER REFERENCES psa_sprawy(id),
        spolka_id          INTEGER NOT NULL REFERENCES psa_spolki(id),
        typ                TEXT NOT NULL
                             CHECK (typ IN
                               ('zawiadomienie_wpis','zawiadomienie_odmowa','informacja_z_rejestru',
                                'wezwanie','raport','powiadomienie')),
        odbiorca_osoba_id  INTEGER REFERENCES psa_osoby(id),
        kanal              TEXT NOT NULL CHECK (kanal IN ('email','portal','papier')),
        sciezka_pdf        TEXT,
        tresc_html         TEXT,
        wyslano            TEXT,
        autor              TEXT NOT NULL,
        utworzono          TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS psa_ix_sprawy_stan
        ON psa_sprawy (stan, termin_do);
      CREATE INDEX IF NOT EXISTS psa_ix_sprawy_spolka
        ON psa_sprawy (spolka_id);
      CREATE INDEX IF NOT EXISTS psa_ix_dokumenty_sprawa
        ON psa_dokumenty (sprawa_id);
      CREATE INDEX IF NOT EXISTS psa_ix_wydane_sprawa
        ON psa_wydane_dokumenty (sprawa_id);
      CREATE INDEX IF NOT EXISTS psa_ix_wydane_spolka
        ON psa_wydane_dokumenty (spolka_id);
    `,
  },
  {
    wersja: 3,
    nazwa: 'uwierzytelnianie - psa_uzytkownicy, psa_konta',
    sql: `
      -- ── Pracownicy kancelarii (sekcja 5) ────────────────────────────────
      -- Admin = Lukasz, env ADMIN_EMAIL - konto zakladane automatycznie przy
      -- pierwszym starcie serwera (server/trasy/auth.js: zapewnijAdmina).
      CREATE TABLE IF NOT EXISTS psa_uzytkownicy (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        imie            TEXT NOT NULL,
        email           TEXT NOT NULL UNIQUE,
        hash_hasla      TEXT NOT NULL,
        rola            TEXT NOT NULL DEFAULT 'pracownik' CHECK (rola IN ('admin','pracownik')),
        aktywny         INTEGER NOT NULL DEFAULT 1 CHECK (aktywny IN (0,1)),
        ostatnie_logowanie TEXT,
        utworzono       TEXT NOT NULL
      );

      -- ── Konta portalowe: spolka albo akcjonariusz (sekcja 5, 8) ─────────
      CREATE TABLE IF NOT EXISTS psa_konta (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        email              TEXT NOT NULL UNIQUE,
        hash_hasla         TEXT NOT NULL,
        rola               TEXT NOT NULL CHECK (rola IN ('spolka','akcjonariusz')),
        spolka_id          INTEGER REFERENCES psa_spolki(id),
        osoba_id           INTEGER REFERENCES psa_osoby(id),
        aktywne            INTEGER NOT NULL DEFAULT 0 CHECK (aktywne IN (0,1)),
        token_aktywacji    TEXT,
        ostatnie_logowanie TEXT,
        utworzono          TEXT NOT NULL,
        CHECK ((rola = 'spolka') = (spolka_id IS NOT NULL)),
        CHECK (osoba_id IS NOT NULL OR rola = 'spolka')
      );

      CREATE INDEX IF NOT EXISTS psa_ix_konta_spolka
        ON psa_konta (spolka_id);
      CREATE INDEX IF NOT EXISTS psa_ix_konta_osoba
        ON psa_konta (osoba_id);
    `,
  },
  {
    wersja: 4,
    nazwa: 'rozliczenia - psa_oplaty; wykaz akcjonariuszy i zawiadomienie sadu w wydanych dokumentach',
    sql: `
      -- ── Oplaty: prowadzenie rejestru (rocznie), wpis, informacja (sekcja 5, 8) ──
      -- „okres” ma sens wylacznie dla typu 'prowadzenie' (rok jako TEXT, np.
      -- "2026") - dla 'wpis' i 'informacja' zostaje NULL. Idempotencja
      -- naliczenia rocznego (jedna oplata 'prowadzenie' na spolke+rok) jest
      -- pilnowana w server/oplaty.js (sprawdz-przed-wstaw w transakcji), nie
      -- unikalnym indeksem - status 'anulowana' musi pozwalac na ponowne
      -- naliczenie, a warunkowy UNIQUE INDEX komplikowalby to bez potrzeby.
      CREATE TABLE IF NOT EXISTS psa_oplaty (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        spolka_id        INTEGER NOT NULL REFERENCES psa_spolki(id),
        sprawa_id        INTEGER REFERENCES psa_sprawy(id),
        typ              TEXT NOT NULL CHECK (typ IN ('prowadzenie','wpis','informacja')),
        okres            TEXT,
        kwota_grosze     INTEGER NOT NULL,
        status           TEXT NOT NULL DEFAULT 'naliczona'
                           CHECK (status IN ('naliczona','zafakturowana','oplacona','anulowana')),
        data_naliczenia  TEXT NOT NULL,
        notatka          TEXT,
        autor            TEXT NOT NULL,
        utworzono        TEXT NOT NULL,
        zaktualizowano   TEXT
      );

      CREATE INDEX IF NOT EXISTS psa_ix_oplaty_spolka
        ON psa_oplaty (spolka_id, typ, okres);
      CREATE INDEX IF NOT EXISTS psa_ix_oplaty_status
        ON psa_oplaty (status);
      CREATE INDEX IF NOT EXISTS psa_ix_oplaty_sprawa
        ON psa_oplaty (sprawa_id);

      -- ── Rozszerzenie katalogu wydanych dokumentow (nowelizacja) ──────────
      -- SQLite nie pozwala zmienic CHECK-a przez ALTER TABLE - tabela nie
      -- jest append-only (to nie psa_zdarzenia), wiec przepisujemy ja z
      -- szerszym katalogiem "typ": dochodza 'wykaz_akcjonariuszy' (art. 476
      -- § 1(1) KSH - przy wykresleniu spolki i jako odpowiedz na zapytanie
      -- sadu, art. 25da ustawy o KRS) i 'zawiadomienie_sad_rozwiazanie'
      -- (art. 300(32) § 3 KSH - zawiadomienie sadu o wygasnieciu/rozwiazaniu
      -- umowy o prowadzenie rejestru).
      CREATE TABLE psa_wydane_dokumenty_v4 (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        sprawa_id          INTEGER REFERENCES psa_sprawy(id),
        spolka_id          INTEGER NOT NULL REFERENCES psa_spolki(id),
        typ                TEXT NOT NULL
                             CHECK (typ IN
                               ('zawiadomienie_wpis','zawiadomienie_odmowa','informacja_z_rejestru',
                                'wezwanie','raport','powiadomienie',
                                'wykaz_akcjonariuszy','zawiadomienie_sad_rozwiazanie')),
        odbiorca_osoba_id  INTEGER REFERENCES psa_osoby(id),
        kanal              TEXT NOT NULL CHECK (kanal IN ('email','portal','papier')),
        sciezka_pdf        TEXT,
        tresc_html         TEXT,
        wyslano            TEXT,
        autor              TEXT NOT NULL,
        utworzono          TEXT NOT NULL
      );
      INSERT INTO psa_wydane_dokumenty_v4
        SELECT id, sprawa_id, spolka_id, typ, odbiorca_osoba_id, kanal, sciezka_pdf, tresc_html, wyslano, autor, utworzono
          FROM psa_wydane_dokumenty;
      DROP TABLE psa_wydane_dokumenty;
      ALTER TABLE psa_wydane_dokumenty_v4 RENAME TO psa_wydane_dokumenty;

      CREATE INDEX IF NOT EXISTS psa_ix_wydane_sprawa
        ON psa_wydane_dokumenty (sprawa_id);
      CREATE INDEX IF NOT EXISTS psa_ix_wydane_spolka
        ON psa_wydane_dokumenty (spolka_id);
    `,
  },
  {
    wersja: 5,
    nazwa:
      'zgodnosc z ustawa - ulamkowe czesci akcji, pokrycie, data_wpisu_krs, rodzaj akcji, ' +
      'przedstawiciel wspoluprawnionych, charakter wpisu',
    sql: `
      -- ── Ulamkowe czesci akcji (regula domenowa 4a, art. 300(2) § 3 + art. 300(43) KSH) ──
      -- SQLite pozwala dopisac kolumne z CHECK-iem odwolujacym sie do innych
      -- kolumn tego samego wiersza (w tym juz istniejacych) - nie trzeba wiec
      -- przepisywac calej tabeli jak w migracji 4. Kazdy ISTNIEJACY wiersz
      -- dostaje przez DEFAULT wartosc 1/1 (akcja niepodzielona) - dokladnie
      -- to, co CLAUDE-PSA.md sekcja 14 nazywa "migracja bezbolesna": na
      -- 08.2026 zaden akcjonariat nie ma wspolwlasnosci ani ulamkow.
      ALTER TABLE psa_stan_akcji ADD COLUMN czesc_mianownik INTEGER NOT NULL DEFAULT 1
        CHECK (czesc_mianownik > 0);
      ALTER TABLE psa_stan_akcji ADD COLUMN czesc_licznik INTEGER NOT NULL DEFAULT 1
        CHECK (czesc_licznik BETWEEN 1 AND czesc_mianownik
               AND (czesc_licznik = czesc_mianownik OR nr_od = nr_do));
      -- Wspolny przedstawiciel wspolwlascicieli (art. 300(38) § 3 KSH) - brak
      -- nie blokuje wpisu, tylko jest oznaczany (regula domenowa 4b).
      ALTER TABLE psa_stan_akcji ADD COLUMN przedstawiciel_osoba_id INTEGER
        REFERENCES psa_osoby(id);
      -- Wzmianka o pokryciu (art. 300(33) § 1 pkt 9 KSH) - NULL = nieustalone
      -- (rejestr przejety bez tej informacji albo jeszcze nie odnotowana
      -- uchwala zarzadu z art. 300(9) § 2 KSH), nie "nie".
      ALTER TABLE psa_stan_akcji ADD COLUMN pokryta TEXT
        CHECK (pokryta IS NULL OR pokryta IN ('tak','nie','czesciowo'));

      -- ── Emisje: KRS, rodzaj akcji, obowiazki wobec spolki (sekcja 5) ────
      ALTER TABLE psa_emisje ADD COLUMN data_wpisu_krs TEXT;
      ALTER TABLE psa_emisje ADD COLUMN rodzaj_akcji TEXT NOT NULL DEFAULT 'zwykla'
        CHECK (rodzaj_akcji IN ('zwykla','uprzywilejowana','zalozycielska','niema'));
      ALTER TABLE psa_emisje ADD COLUMN obowiazki_wobec_spolki TEXT;

      -- Backfill: emisje zapisane PRZED wprowadzeniem blokady z art. 300(30) § 2
      -- KSH juz istnieja w rejestrze jako fakt dokonany - ich akcje zostaly
      -- objete, wiec spolka/emisja musiala juz byc wpisana do KRS. Blokada ma
      -- dzialac na NOWE objecia, nie uniewazniac wsteczne historie. Nowe
      -- emisje (po tej migracji) startuja z data_wpisu_krs = NULL, jak nakazuje
      -- regula domenowa 12.
      UPDATE psa_emisje SET data_wpisu_krs = data_emisji WHERE data_wpisu_krs IS NULL;

      -- ── Spolka: kto zawarl umowe (art. 300(32) § 1(2) KSH), dodatkowe ──
      -- informacje z umowy spolki (art. 300(33) § 2 KSH)
      ALTER TABLE psa_spolki ADD COLUMN dodatkowe_informacje_umowa_spolki TEXT;
      ALTER TABLE psa_spolki ADD COLUMN umowe_zawarl TEXT
        CHECK (umowe_zawarl IS NULL OR umowe_zawarl IN ('notariusz','zastepca','osoba_upowazniona'));
      ALTER TABLE psa_spolki ADD COLUMN umowe_zawarl_imie_nazwisko TEXT;

      -- ── Sprawa: charakter wpisu - konstytutywny/deklaratoryjny (art. 300(37) ──
      -- § 2 KSH, regula domenowa 13). Sprawy zalatwione PRZED ta migracja
      -- zostaja NULL ("nieustalone") - rozroznienie dotyczy wylacznie tresci
      -- checklisty i zawiadomienia w chwili wpisu, nie da sie go sensownie
      -- zrekonstruowac wstecz bez wgladu w kazda historyczna sprawe z osobna.
      ALTER TABLE psa_sprawy ADD COLUMN charakter_wpisu TEXT
        CHECK (charakter_wpisu IS NULL OR charakter_wpisu IN ('konstytutywny','deklaratoryjny'));
    `,
  },
  {
    wersja: 6,
    nazwa:
      'kreator rejestracji spolki - rozszerzony import KRS, ograniczenia z umowy spolki ' +
      '(zgoda spolki, pierwszenstwo, zakaz glosu zastawnika, ograniczenia dziedziczenia)',
    sql: `
      -- ── Spolka: pola z rozszerzonego importu KRS (sesja 6, faza 3) ──────
      -- Mapowanie API KRS jest OBRONNE (server/trasy/krs.js) - kazde z tych
      -- pol moze zostac puste, jesli odpowiedz API nie zawiera odpowiadajacej
      -- rubryki; wpis recznie uzupelnia brakujace pola w kreatorze.
      ALTER TABLE psa_spolki ADD COLUMN data_ostatniego_wpisu_krs TEXT;
      -- Wysokosc kapitalu akcyjnego (Dzial 1, Rubryka 8.1) w groszach - jak
      -- pozostale kwoty w rejestrze (np. psa_emisje.cena_emisyjna_grosze).
      ALTER TABLE psa_spolki ADD COLUMN kapital_akcyjny_grosze INTEGER;
      -- Adres do doreczen elektronicznych wpisany do Bazy Adresow
      -- Elektronicznych (Dzial 1, Rubryka 2.5) - format "AE:PL-#####-#####-...".
      ALTER TABLE psa_spolki ADD COLUMN adres_edorecze TEXT;
      -- Sklad organu reprezentujacego (Dzial 2, Rubryka 1, Podrubryka 1) -
      -- tablica JSON [{nazwisko, imiona, funkcja}] wylacznie informacyjna,
      -- do podgladu w kreatorze; rejestr akcjonariuszy nie prowadzi wlasnej
      -- ewidencji osob w organach spolki.
      ALTER TABLE psa_spolki ADD COLUMN sklad_organu_json TEXT;

      -- ── Ograniczenia z umowy spolki wczytywane przy przyjeciu spolki ───
      -- (WYTYCZNE-MERYTORYCZNE-PSA.md sekcja 3 i 11 - bez tego art. 300(34)
      -- § 6 KSH jest niewykonalny). Dwie z czterech kategorii NIE maja
      -- wlasnego cyklu zycia w rejestrze (nie dotycza konkretnej emisji ani
      -- akcji, tylko sa faktem o tresci umowy spolki), wiec zyja jako pola
      -- informacyjne na spolce, nie jako zdarzenie:
      --   * zakaz prawa glosu zastawnika/uzytkownika (art. 300(23) § 2 KSH) -
      --     umowa spolki moze go zakazac wprost albo uzaleznic od zgody
      --     organu spolki; bramka dla przyszlego zdarzenia
      --     prawo_glosu_zastawnika (server/logika/kreator.js).
      ALTER TABLE psa_spolki ADD COLUMN zakaz_glosu_zastawnika_umowa TEXT
        CHECK (zakaz_glosu_zastawnika_umowa IS NULL
               OR zakaz_glosu_zastawnika_umowa IN ('zakazane','wymaga_zgody_organu'));
      --   * ograniczenie podzialu akcji miedzy spadkobiercow (art. 300(41)
      --     § 3 KSH) - tresc klauzuli, NULL = umowa spolki nie ogranicza.
      ALTER TABLE psa_spolki ADD COLUMN ograniczenie_dziedziczenia_umowa TEXT;

      -- Pozostale dwie kategorie (zgoda spolki na zbycie, prawo
      -- pierwszenstwa) MAJA juz reprezentacje jako zdarzenie ograniczenie
      -- / tabela psa_ograniczenia (sprint 2) - dopisujemy tylko brakujace
      -- pola kompletnosci postanowienia o zgodzie spolki (art. 300(39) § 1,
      -- 3 KSH): bez terminu wskazania nabywcy, ceny i terminu zaplaty
      -- ograniczenie jest bezskuteczne (WYTYCZNE-MERYTORYCZNE-PSA.md sekcja
      -- 11 - "brak kompletu oznacza brak ograniczenia"), wiec
      -- server/logika/kreator.js NIE ustawia wymaga_zgody_spolki=1, dopoki
      -- wszystkie trzy nie sa podane.
      ALTER TABLE psa_ograniczenia ADD COLUMN zgoda_termin_wskazania_dni INTEGER;
      ALTER TABLE psa_ograniczenia ADD COLUMN zgoda_cena_opis TEXT;
      ALTER TABLE psa_ograniczenia ADD COLUMN zgoda_termin_zaplaty_dni INTEGER;
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
