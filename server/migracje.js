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
  {
    wersja: 7,
    nazwa:
      'uniewaznienie akcji orzeczeniem sadu (art. 300(51) KSH) jako odrebna kategoria ' +
      'oraz charakter zadajacego wpisu (art. 300(34) § 1 KSH)',
    sql: `
      -- ── Sprawa: w jakim charakterze zadajacy wystepuje o wpis ───────────
      -- Art. 300(34) § 1 KSH dopuszcza wpis "na zadanie spolki lub innej osoby
      -- majacej interes prawny". Dotad zapisywalismy KTO zada (zadajacy_osoba_id)
      -- i wolny opis, ale nie W JAKIM CHARAKTERZE - a to wlasnie ocena interesu
      -- prawnego, ktora nalezy do podmiotu prowadzacego rejestr i powinna
      -- zostawic slad nadajacy sie do kontroli.
      --
      -- Sprawy sprzed tej migracji zostaja NULL ("nieustalone"): charakteru
      -- zadajacego nie da sie zrekonstruowac wstecz bez wgladu w akta kazdej
      -- sprawy z osobna, a zgadywanie go zafalszowaloby zapis o tresci
      -- ocennej. Kolumna jest wiec dobrowolna na poziomie schematu -
      -- wymagalnosc egzekwuje warstwa trasy dla NOWYCH spraw.
      ALTER TABLE psa_sprawy ADD COLUMN zadajacy_rola TEXT
        CHECK (zadajacy_rola IS NULL OR zadajacy_rola IN
          ('akcjonariusz','zbywca','nabywca','zastawnik','uzytkownik',
           'uprawniony_do_zaskarzenia','spolka','inna'));

      -- ── Stan akcji: kategoria "uniewazniona" (art. 300(51) KSH) ─────────
      -- SQLite nie pozwala zmienic CHECK w miejscu, wiec przepisujemy tabele -
      -- ta sama sciezka co w migracji 4 dla psa_wydane_dokumenty.
      --
      -- psa_stan_akcji jest MATERIALIZACJA odtwarzana ze zdarzen
      -- (server/rejestr.js kasuje i buduje ja na nowo przy kazdym wpisie),
      -- wiec przepisanie jest bezpieczne: zadne dane zrodlowe tu nie mieszkaja.
      -- Kopiujemy mimo to komplet wierszy, zeby rejestry spolek bez nowych
      -- zdarzen nie zostaly z pusta materializacja do czasu kolejnego wpisu.
      CREATE TABLE psa_stan_akcji_v7 (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        spolka_id        INTEGER NOT NULL REFERENCES psa_spolki(id),
        emisja_id        INTEGER NOT NULL REFERENCES psa_emisje(id),
        kategoria        TEXT NOT NULL
          CHECK (kategoria IN ('nieobjeta','akcjonariusz','umorzona','uniewazniona')),
        osoba_id         INTEGER REFERENCES psa_osoby(id),
        nr_od            INTEGER NOT NULL,
        nr_do            INTEGER NOT NULL,
        ilosc            INTEGER NOT NULL,
        tytul_nabycia    TEXT,
        zdarzenie_od_id  INTEGER NOT NULL REFERENCES psa_zdarzenia(id),
        data_od          TEXT NOT NULL,
        zdarzenie_do_id  INTEGER REFERENCES psa_zdarzenia(id),
        data_do          TEXT,
        czesc_mianownik  INTEGER NOT NULL DEFAULT 1 CHECK (czesc_mianownik > 0),
        czesc_licznik    INTEGER NOT NULL DEFAULT 1
          CHECK (czesc_licznik BETWEEN 1 AND czesc_mianownik
                 AND (czesc_licznik = czesc_mianownik OR nr_od = nr_do)),
        przedstawiciel_osoba_id INTEGER REFERENCES psa_osoby(id),
        pokryta          TEXT CHECK (pokryta IS NULL OR pokryta IN ('tak','nie','czesciowo')),
        CHECK (nr_do >= nr_od),
        CHECK ((kategoria = 'akcjonariusz') = (osoba_id IS NOT NULL))
      );

      INSERT INTO psa_stan_akcji_v7
        (id, spolka_id, emisja_id, kategoria, osoba_id, nr_od, nr_do, ilosc,
         tytul_nabycia, zdarzenie_od_id, data_od, zdarzenie_do_id, data_do,
         czesc_mianownik, czesc_licznik, przedstawiciel_osoba_id, pokryta)
      SELECT
         id, spolka_id, emisja_id, kategoria, osoba_id, nr_od, nr_do, ilosc,
         tytul_nabycia, zdarzenie_od_id, data_od, zdarzenie_do_id, data_do,
         czesc_mianownik, czesc_licznik, przedstawiciel_osoba_id, pokryta
      FROM psa_stan_akcji;

      DROP TABLE psa_stan_akcji;
      ALTER TABLE psa_stan_akcji_v7 RENAME TO psa_stan_akcji;

      -- Indeksy gina razem z tabela - odtwarzamy je pod tymi samymi nazwami.
      CREATE INDEX IF NOT EXISTS psa_ix_stan_spolka
        ON psa_stan_akcji (spolka_id, data_od, data_do);
      CREATE INDEX IF NOT EXISTS psa_ix_stan_osoba
        ON psa_stan_akcji (osoba_id, data_do);
    `,
  },
  {
    wersja: 8,
    nazwa: 'szablony dokumentow wychodzacych - wersjonowane, bez edycji po wydaniu',
    sql: `
      -- ── Szablony dokumentow (sesja 6, faza 4) ───────────────────────────
      -- Wersjonowane i NIEZMIENIALNE. Redakcja szablonu nie nadpisuje
      -- poprzedniej tresci, tylko zaklada kolejna wersje - inaczej nie dalo by
      -- sie odtworzyc, jak brzmial dokument wydany pol roku temu. Ta sama
      -- logika co przy psa_zdarzenia, z tego samego powodu: dokument wychodzacy
      -- wywoluje skutki, wiec jego podstawa musi byc odtwarzalna.
      CREATE TABLE IF NOT EXISTS psa_szablony (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        kod              TEXT NOT NULL,
        wersja           INTEGER NOT NULL,
        tytul            TEXT NOT NULL,
        tresc            TEXT NOT NULL,
        opis             TEXT,
        podstawa_prawna  TEXT,
        -- Dokladnie jedna wersja danego kodu jest aktywna (indeks czesciowy
        -- nizej). Aktywnosc to JEDYNE pole, ktore wolno zmieniac - zmiana
        -- aktywnej wersji jest decyzja redakcyjna, nie edycja tresci.
        aktywna          INTEGER NOT NULL DEFAULT 0 CHECK (aktywna IN (0,1)),
        wbudowany        INTEGER NOT NULL DEFAULT 0 CHECK (wbudowany IN (0,1)),
        autor            TEXT NOT NULL,
        utworzono        TEXT NOT NULL,
        UNIQUE (kod, wersja)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS psa_ix_szablony_aktywny
        ON psa_szablony (kod) WHERE aktywna = 1;

      -- Zakaz edycji tresci i tytulu istniejacej wersji - odpowiednik
      -- wyzwalaczy chroniacych psa_zdarzenia. Zmiana aktywnosci przechodzi.
      CREATE TRIGGER IF NOT EXISTS psa_szablony_bez_edycji_tresci
      BEFORE UPDATE OF tresc, tytul, kod, wersja ON psa_szablony
      BEGIN
        SELECT RAISE(ABORT,
          'Szablon jest niezmienialny - zamiast edycji zaloz kolejna wersje.');
      END;

      CREATE TRIGGER IF NOT EXISTS psa_szablony_bez_delete
      BEFORE DELETE ON psa_szablony
      BEGIN
        SELECT RAISE(ABORT,
          'Szablonu nie usuwa sie - wersja moze byc podstawa wydanego dokumentu.');
      END;

      -- ── Slad, z ktorej wersji szablonu powstal wydany dokument ──────────
      -- Bez tego "brak edycji po wydaniu" jest deklaracja bez pokrycia: nie
      -- dalo by sie wskazac, ktora tresc podpisano.
      ALTER TABLE psa_wydane_dokumenty ADD COLUMN szablon_kod TEXT;
      ALTER TABLE psa_wydane_dokumenty ADD COLUMN szablon_wersja INTEGER;
    `,
  },
  {
    wersja: 9,
    nazwa: 'dane wymagane przez wzory pism (sesja 8, blok B): plec, znak sprawy, ' +
      'podstawa dokumentu, przyczyna odmowy, forma spolki i reprezentant umowy',
    sql: `
      -- ── Osoba: plec ──────────────────────────────────────────────────
      -- Wzory pism odmieniaja przez rodzaj gramatyczny ("zamieszkaly" wobec
      -- "zamieszkala", "syna" wobec "corke") - PLACEHOLDERY-PSA.md § 1.
      -- Bez tego pola kazde pismo wymagaloby recznego skreslenia niewlasciwej
      -- formy. Dobrowolne na poziomie schematu (dane sprzed migracji i osoby
      -- prawne go nie maja) - formy pochodne po prostu zostaja niewyliczone,
      -- co widac w podgladzie pisma jako brak, nie jako cichy blad.
      ALTER TABLE psa_osoby ADD COLUMN plec TEXT
        CHECK (plec IS NULL OR plec IN ('kobieta','mezczyzna'));

      -- ── Sprawa: znak sprawy ─────────────────────────────────────────────
      -- {{sprawa_numer}} wystepuje na kazdym pismie. Generowany przy zalozeniu
      -- sprawy (server/trasy/sprawy.js), format RA/ROK/NNNN. Sprawy sprzed
      -- migracji zostaja bez numeru - nie ma jak go odtworzyc wstecz bez
      -- ryzyka kolizji z numerami juz nadanymi po fakcie.
      ALTER TABLE psa_sprawy ADD COLUMN numer TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS psa_ix_sprawy_numer
        ON psa_sprawy (numer) WHERE numer IS NOT NULL;

      -- ── Sprawa: dokument bedacy podstawa zadania ─────────────────────────
      -- Dotad zapisywane wolnym tekstem w "notatka" - niespojnie miedzy
      -- sprawami i nieczytelne dla wzorow 04/05/07, ktore odwoluja sie do
      -- rodzaju i daty dokumentu jako osobnych pol (sekcja warunkowa
      -- {{#podstawa_dokument}}). Katalog rodzajow jest ten sam, co przy
      -- zalacznikach do sprawy (psa_dokumenty.typ_dokumentu) - to ten sam
      -- pojeciowo katalog, jeden zamiast dwoch niezaleznie utrzymywanych.
      ALTER TABLE psa_sprawy ADD COLUMN dokument_rodzaj TEXT
        CHECK (dokument_rodzaj IS NULL OR dokument_rodzaj IN
          ('umowa_zbycia','uchwala','zgoda','postanowienie','pelnomocnictwo','inny'));
      ALTER TABLE psa_sprawy ADD COLUMN dokument_data TEXT;

      -- ── Sprawa: przyczyna niedokonania wpisu jako katalog zamkniety ──────
      -- Art. 300(34) § 7 zd. 2 KSH: przy niedokonaniu wpisu nalezy PODAC
      -- PRZYCZYNY - dotad wolny tekst w "powod_odmowy", co pozwalalo na
      -- odmowe bez konkretnej podstawy. Kolumna "powod_odmowy" zostaje jako
      -- rozwiniecie/uzasadnienie w jezyku naturalnym (obowiazkowe przy kodzie
      -- "inna", opcjonalne przy pozostalych - kod juz jest konkretny).
      ALTER TABLE psa_sprawy ADD COLUMN powod_odmowy_kod TEXT
        CHECK (powod_odmowy_kod IS NULL OR powod_odmowy_kod IN
          ('brak_dokumentow','dokumenty_nie_potwierdzaja','watpliwosci_co_do_tresci',
           'niezgodnosc_z_rejestrem','przeszkoda_nieusunieta','brak_aml','inna'));

      -- ── Spolka: forma "w miejscowniku" siedziby ──────────────────────────
      -- "z siedziba w Warszawie" - odmiana nazw miejscowosci algorytmem jest
      -- zawodna (wyjatki, nazwy wieloczlonowe, formy historyczne), wiec pole
      -- edytowalne zamiast wyliczane. Mianownik to juz istniejace "miejscowosc".
      ALTER TABLE psa_spolki ADD COLUMN siedziba_miejscownik TEXT;

      -- ── Spolka: reprezentant podpisujacy umowe o prowadzenie rejestru ────
      -- Wzor 01 § 5. Dotyczy WYLACZNIE strony spolki (kto zawarl umowe w
      -- imieniu podmiotu prowadzacego rejestr to juz "umowe_zawarl*" z
      -- migracji 6 - inna strona tej samej umowy). Nazwisko w bierniku, bo
      -- caly ustep identyfikacyjny wzoru jest w tym przypadku - odmiana
      -- nazwiska nie da sie zautomatyzowac, notariusz wpisuje raz przy
      -- rejestracji spolki. Formy pochodne ("dzialajacego"/"dzialajaca" itd.)
      -- wylicza server/logika/formy-osobowe.js z pola "reprezentant_plec".
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_biernik TEXT;
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_plec TEXT
        CHECK (reprezentant_plec IS NULL OR reprezentant_plec IN ('kobieta','mezczyzna'));
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_rodzice TEXT;
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_dowod TEXT;
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_pesel TEXT;
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_adres TEXT;
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_funkcja_biernik TEXT;
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_reprezentacja TEXT;
    `,
  },
  {
    wersja: 10,
    nazwa: 'kontekst automatu pism (sesja 8, blok A3): organ spolki, ' +
      'sposob i termin usuniecia przeszkody',
    sql: `
      -- ── Spolka: rodzaj organu zarzadzajacego ─────────────────────────────
      -- P.S.A. moze miec albo zarzad, albo (struktura monistyczna) rade
      -- dyrektorow - K.s.h. art. 300(63) i nast. Wzory pism licza sie z tym,
      -- KTO w imieniu spolki odbiera zawiadomienie o wpisie ("Zarzad spolki"
      -- kontra "Rada Dyrektorow spolki"), a aplikacja dotad tego nie
      -- rozrozniala. Dobrowolne na poziomie schematu - bez wskazania wzory
      -- zostawiaja to pole do uzupelnienia recznie, zamiast zgadywac.
      ALTER TABLE psa_spolki ADD COLUMN organ_rodzaj TEXT
        CHECK (organ_rodzaj IS NULL OR organ_rodzaj IN ('zarzad','rada_dyrektorow'));

      -- ── Sprawa: sposob i termin usuniecia przeszkody ─────────────────────
      -- Dotad przy wstrzymaniu zapisywalismy WYLACZNIE przeszkode (wolny
      -- tekst w "notatka") - wezwanie do usuniecia (wzor 06) potrzebuje
      -- dodatkowo, CO konkretnie ma zrobic zadajacy i DO KIEDY. Ustawa nie
      -- narzuca liczby dni na usuniecie przeszkody (inaczej niz sam wpis -
      -- art. 300(34) § 1 KSH), wiec to notariusz wskazuje termin wprost,
      -- zamiast aplikacja miala go zgadywac.
      ALTER TABLE psa_sprawy ADD COLUMN sposob_usuniecia TEXT;
      ALTER TABLE psa_sprawy ADD COLUMN termin_usuniecia TEXT;
    `,
  },
  {
    wersja: 11,
    nazwa: 'automat pism na wzorach .docx (sesja 8, blok A4): sciezka pliku i skrot wzoru',
    sql: `
      -- ── Wydany dokument: gdzie lezy PLIK i z jakiego BRZMIENIA wzoru powstal ──
      -- Automat wypelnia teraz prawdziwy .docx z wzory/ (blok A1) zamiast
      -- HTML-a skladanego w locie - plik zapisujemy na dysku obok zalacznikow
      -- do sprawy (server/trasy/sprawy.js: ten sam KATALOG_DOKUMENTOW), a
      -- sciezke i skrot tresci wzoru (nie mylic z "szablon_wersja" z migracji
      -- 8 - tamto liczylo wersje w bazie, tu liczymy hash pliku z dysku)
      -- zapisujemy tutaj. "tresc_html" zostaje uzywana jak dotad - dla
      -- listow generowanych na starym mechanizmie (np. wykaz akcjonariuszy,
      -- blok A5) trzyma HTML, dla nowych trzyma czysty tekst wyciagniety
      -- z .docx (podglad bez otwierania pliku).
      ALTER TABLE psa_wydane_dokumenty ADD COLUMN sciezka_plik TEXT;
      ALTER TABLE psa_wydane_dokumenty ADD COLUMN szablon_hash TEXT;
    `,
  },
  {
    wersja: 12,
    nazwa: 'wystawianie na zadanie (sesja 8, blok A5): status VAT spolki dla wzoru umowy',
    sql: `
      -- ── Spolka: czy jest platnikiem VAT ──────────────────────────────────
      -- Wzor 01 (umowa o prowadzenie rejestru) ma warunkowe oswiadczenie
      -- o statusie VAT ({{#spolka_vat}}) - bez tego pola sekcja zawsze
      -- wychodzi pusta, nawet gdy spolka jest platnikiem. Trojstanowe:
      -- NULL = nieustalone (sekcja pusta, tak jak dzis), 0/1 = ustalone wprost.
      ALTER TABLE psa_spolki ADD COLUMN platnik_vat INTEGER
        CHECK (platnik_vat IS NULL OR platnik_vat IN (0,1));
    `,
  },
  {
    wersja: 13,
    nazwa: 'wystawianie na zadanie (sesja 8, blok A5): typy dla wzorow ' +
      'jednorazowych (umowa, RODO, uchwala, klauzula zbycia)',
    sql: `
      -- ── Rozszerzenie katalogu wydanych dokumentow ────────────────────────
      -- SQLite nie pozwala zmienic CHECK-a przez ALTER TABLE - przepisujemy
      -- tabele jak w migracji 4 i 7. "Lista akcjonariuszy do sadu" (wzor 08)
      -- NIE dostaje nowego typu - to ten sam dokument prawny (art. 476 § 1(1)
      -- KSH), co juz istniejacy 'wykaz_akcjonariuszy', tylko wystawiony na
      -- zadanie zamiast automatem po wpisie. Cztery pozostale wzory
      -- jednorazowe nie maja dzis odpowiednika w katalogu.
      CREATE TABLE psa_wydane_dokumenty_v13 (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        sprawa_id          INTEGER REFERENCES psa_sprawy(id),
        spolka_id          INTEGER NOT NULL REFERENCES psa_spolki(id),
        typ                TEXT NOT NULL
                             CHECK (typ IN
                               ('zawiadomienie_wpis','zawiadomienie_odmowa','informacja_z_rejestru',
                                'wezwanie','raport','powiadomienie',
                                'wykaz_akcjonariuszy','zawiadomienie_sad_rozwiazanie',
                                'umowa_rejestru','informacja_rodo','uchwala_wyboru','klauzula_zbycia')),
        odbiorca_osoba_id  INTEGER REFERENCES psa_osoby(id),
        kanal              TEXT NOT NULL CHECK (kanal IN ('email','portal','papier')),
        sciezka_pdf        TEXT,
        tresc_html         TEXT,
        sciezka_plik       TEXT,
        szablon_kod        TEXT,
        szablon_wersja     INTEGER,
        szablon_hash       TEXT,
        wyslano            TEXT,
        autor              TEXT NOT NULL,
        utworzono          TEXT NOT NULL
      );
      INSERT INTO psa_wydane_dokumenty_v13
        SELECT id, sprawa_id, spolka_id, typ, odbiorca_osoba_id, kanal, sciezka_pdf, tresc_html,
               sciezka_plik, szablon_kod, szablon_wersja, szablon_hash, wyslano, autor, utworzono
          FROM psa_wydane_dokumenty;
      DROP TABLE psa_wydane_dokumenty;
      ALTER TABLE psa_wydane_dokumenty_v13 RENAME TO psa_wydane_dokumenty;

      CREATE INDEX IF NOT EXISTS psa_ix_wydane_sprawa
        ON psa_wydane_dokumenty (sprawa_id);
      CREATE INDEX IF NOT EXISTS psa_ix_wydane_spolka
        ON psa_wydane_dokumenty (spolka_id);
    `,
  },
  {
    wersja: 14,
    nazwa: 'wzor 04 (zadanie dokonania wpisu): typ w katalogu wydanych dokumentow',
    sql: `
      -- ── Rozszerzenie katalogu wydanych dokumentow, jeszcze raz ──────────
      -- Wzor 04 (zadanie dokonania wpisu, art. 300(34) § 1 i § 4 KSH) zostal
      -- pominiety przy podziale prac na bloki A3/A5 (sesja 8) - nie idzie
      -- automatem (nie jest reakcja na przejscie stanu sprawy) i nie jest
      -- jednorazowym dokumentem spolki (dotyczy KONKRETNEJ sprawy, danych
      -- zadajacego z tej sprawy) - wykryte dopiero przy A7. Wystawia sie go
      -- ze sprawy, wiec "sprawa_id" jest tu ZAWSZE ustawione (w odroznieniu
      -- od pieciu wzorow z migracji 13, ktore sa zawsze "sprawa_id IS NULL").
      CREATE TABLE psa_wydane_dokumenty_v14 (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        sprawa_id          INTEGER REFERENCES psa_sprawy(id),
        spolka_id          INTEGER NOT NULL REFERENCES psa_spolki(id),
        typ                TEXT NOT NULL
                             CHECK (typ IN
                               ('zawiadomienie_wpis','zawiadomienie_odmowa','informacja_z_rejestru',
                                'wezwanie','raport','powiadomienie',
                                'wykaz_akcjonariuszy','zawiadomienie_sad_rozwiazanie',
                                'umowa_rejestru','informacja_rodo','uchwala_wyboru','klauzula_zbycia',
                                'zadanie_wpisu')),
        odbiorca_osoba_id  INTEGER REFERENCES psa_osoby(id),
        kanal              TEXT NOT NULL CHECK (kanal IN ('email','portal','papier')),
        sciezka_pdf        TEXT,
        tresc_html         TEXT,
        sciezka_plik       TEXT,
        szablon_kod        TEXT,
        szablon_wersja     INTEGER,
        szablon_hash       TEXT,
        wyslano            TEXT,
        autor              TEXT NOT NULL,
        utworzono          TEXT NOT NULL
      );
      INSERT INTO psa_wydane_dokumenty_v14
        SELECT id, sprawa_id, spolka_id, typ, odbiorca_osoba_id, kanal, sciezka_pdf, tresc_html,
               sciezka_plik, szablon_kod, szablon_wersja, szablon_hash, wyslano, autor, utworzono
          FROM psa_wydane_dokumenty;
      DROP TABLE psa_wydane_dokumenty;
      ALTER TABLE psa_wydane_dokumenty_v14 RENAME TO psa_wydane_dokumenty;

      CREATE INDEX IF NOT EXISTS psa_ix_wydane_sprawa
        ON psa_wydane_dokumenty (sprawa_id);
      CREATE INDEX IF NOT EXISTS psa_ix_wydane_spolka
        ON psa_wydane_dokumenty (spolka_id);
    `,
  },
  {
    wersja: 15,
    nazwa: 'blok C (sesja 8): przeglad AML, beneficjent rzeczywisty, oswiadczenie PEP',
    sql: `
      -- ── Osoba: cztery pola AML wykraczajace poza tresc rejestru KSH ─────
      -- Swiadoma nadwyzka wobec ustawy (SESJA-PSA-8-PROTOTYP.md § 6, blok C;
      -- uzasadnienie w server/logika/przepisy.js przy AML_STATUSY) - zadne
      -- z tych pol NIE zasila nowej blokady wpisu.
      --
      -- aml_data_przegladu: data OSTATNIEGO przegladu okresowego - odrebna
      -- od aml_data (data PIERWOTNEGO wykonania srodkow bezpieczenstwa).
      -- Termin przegladu: 12 miesiecy (decyzja D4a).
      ALTER TABLE psa_osoby ADD COLUMN aml_data_przegladu TEXT;

      -- beneficjent_rzeczywisty_id: self-referencing FK, sensowne wylacznie
      -- dla typ='prawna'. Beneficjent rzeczywisty jest z definicji OSOBA
      -- FIZYCZNA (art. 2 ust. 2 pkt 1 ustawy AML) - trasa wymusza to przy
      -- zapisie, schemat sam tego nie sprawdzi (odwolanie miedzy wierszami).
      ALTER TABLE psa_osoby ADD COLUMN beneficjent_rzeczywisty_id INTEGER
        REFERENCES psa_osoby(id);

      -- pep_oswiadczenie: OSWIADCZENIE OSOBY (art. 46 ustawy AML), nie ocena
      -- kancelarii - stad tak/nie/NULL ("nie oswiadczono"), nigdy zgadywane.
      ALTER TABLE psa_osoby ADD COLUMN pep_oswiadczenie TEXT
        CHECK (pep_oswiadczenie IS NULL OR pep_oswiadczenie IN ('tak', 'nie'));
      ALTER TABLE psa_osoby ADD COLUMN pep_oswiadczenie_data TEXT;
    `,
  },
  {
    wersja: 16,
    nazwa: 'blok D4 (sesja 8): dziennik dostepu do danych osobowych',
    sql: `
      -- ── Dziennik dostepu (blok D4) - append-only, WASKI zakres ──────────
      -- Tylko momenty realnego wgladu w dane wrazliwe albo wyniesienia ich
      -- z systemu (informacja z rejestru, raport dla sadu, eksport CSV,
      -- pobranie pliku) - NIE kazde wyswietlenie listy/kokpitu. Jedyna
      -- sensowna odpowiedz na "kto mial wglad" przy incydencie albo
      -- kontroli - szeroki zakres zasypalby ja szumem.
      --
      -- Osobna tabela od psa_zdarzenia (LANCUCH SKROTOW tresci rejestru) -
      -- ten drugi zostaje NIETKNIETY, nigdy nie sluzy do celow audytowych
      -- niezwiazanych ze stanem akcji. Ta tabela, jak psa_zdarzenia, jest
      -- append-only - aplikacja nigdy nie robi na niej UPDATE ani DELETE.
      CREATE TABLE IF NOT EXISTS psa_dziennik_dostepu (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        chwila     TEXT NOT NULL,
        kto        TEXT NOT NULL,
        typ_kto    TEXT NOT NULL CHECK (typ_kto IN ('pracownik', 'portal')),
        spolka_id  INTEGER REFERENCES psa_spolki(id),
        osoba_id   INTEGER REFERENCES psa_osoby(id),
        akcja      TEXT NOT NULL,
        opis       TEXT
      );

      CREATE INDEX IF NOT EXISTS psa_ix_dziennik_spolka
        ON psa_dziennik_dostepu (spolka_id);
      CREATE INDEX IF NOT EXISTS psa_ix_dziennik_osoba
        ON psa_dziennik_dostepu (osoba_id);
      CREATE INDEX IF NOT EXISTS psa_ix_dziennik_chwila
        ON psa_dziennik_dostepu (chwila);
    `,
  },
  {
    wersja: 17,
    nazwa: 'poprawki PSA (etap 1.6): usuniecie statusu VAT spolki',
    sql: `
      -- ── Status VAT wycofany calkowicie z modulu ──────────────────────────
      -- Dodane migracja 12 dla warunkowego oswiadczenia w umowie o
      -- prowadzenie rejestru ({{#spolka_vat}}, wzor 01). Decyzja: to nie jest
      -- element rejestru (art. 300(33) § 1 KSH), zmienia sie niezaleznie od
      -- KRS i wprowadzalo myslace trojstanowe pole w kreatorze. Usuniete z
      -- formularza, z API i z tresci wzoru 01 (sekcja ust. 4 usunieta z
      -- generatora, plik przegenerowany) - kolumna usuwana tu, zeby stan bazy
      -- byl spojny z reszta aplikacji.
      ALTER TABLE psa_spolki DROP COLUMN platnik_vat;
    `,
  },
  {
    wersja: 18,
    nazwa: 'poprawki PSA (etap 2.2/2.3): umowa jako fakt juz zaistnialy, dane reprezentanta w mianowniku',
    sql: `
      -- ── Krok 2 kreatora przestaje "otwierac" podpisywanie umowy ─────────
      -- Zamiast tego rejestruje FAKT juz zawartej umowy: sposob zawarcia
      -- i skan/plik. Data zawarcia to juz istniejace "data_umowy".
      ALTER TABLE psa_spolki ADD COLUMN umowa_sposob_zawarcia TEXT
        CHECK (umowa_sposob_zawarcia IS NULL OR umowa_sposob_zawarcia IN
          ('pisemna', 'elektroniczna_kwalifikowany'));
      ALTER TABLE psa_spolki ADD COLUMN umowa_zalacznik_sciezka TEXT;
      ALTER TABLE psa_spolki ADD COLUMN umowa_zalacznik_nazwa_pliku TEXT;
      ALTER TABLE psa_spolki ADD COLUMN umowa_zalacznik_mime TEXT;

      -- ── Dane reprezentanta: mianownik zamiast recznie wpisywanych form ──
      -- 'reprezentant_biernik' i 'reprezentant_funkcja_biernik' przechowywaly
      -- WARTOSC JUZ ODMIENIONA - uzytkownik musial sam znac biernik. Teraz
      -- wpisuje mianownik ('reprezentant_imie_nazwisko', 'reprezentant_funkcja'),
      -- a odmiane liczy server/logika/deklinacja.js w locie (kontekst-pisma.js).
      -- 'reprezentant_rodzice' NIE zmienia nazwy, ale zmienia sens: dotad
      -- dopelniacz wpisywany recznie ("Piotra i Anny"), teraz mianownik
      -- ("Piotr i Anna") - deklinowany automatycznie tak samo jak reszta.
      -- Trzy kolumny "_recznie" to pole korekty z sekcji 2.3 promptu
      -- ("deklinator ma byc pomoca, nie wyrocznia") - gdy wypelnione, maja
      -- pierwszenstwo przed wynikiem automatu.
      ALTER TABLE psa_spolki DROP COLUMN reprezentant_biernik;
      ALTER TABLE psa_spolki DROP COLUMN reprezentant_funkcja_biernik;
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_imie_nazwisko TEXT;
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_funkcja TEXT;
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_biernik_recznie TEXT;
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_funkcja_biernik_recznie TEXT;
      ALTER TABLE psa_spolki ADD COLUMN reprezentant_rodzice_recznie TEXT;
    `,
  },
  {
    wersja: 19,
    nazwa: 'poprawki PSA (etap 2.5): data zawarcia umowy spolki (akt zalozycielski)',
    sql: `
      -- ── Data zawarcia umowy spolki - RÓŻNA od daty rejestracji w KRS ────
      -- ("data_utworzenia_spolki") i od daty umowy o PROWADZENIE REJESTRU
      -- ("data_umowy"). To data aktu notarialnego zawiazania spolki (albo,
      -- przy spolce zakladanej w S24, data podpisania w systemie) -
      -- podstawa do autouzupelnienia "data emisji" serii zalozycielskiej.
      -- Import z API KRS: dzial1.umowaStatut.informacjaOZawarciuZmianieUmowyStatutu[0]
      -- (potwierdzone na zywej odpowiedzi, KRS 0001114217) - pierwszy wpis w tej
      -- tablicy to zawarcie, kolejne to pozniejsze zmiany umowy spolki.
      ALTER TABLE psa_spolki ADD COLUMN data_zawarcia_umowy_spolki TEXT;
    `,
  },
  {
    wersja: 20,
    nazwa: 'poprawki PSA (etap 2.7): tresc postanowienia umowy spolki o zgodzie na zbycie',
    sql: `
      -- Doslowny cytat klauzuli umowy spolki o zgodzie spolki na zbycie akcji
      -- (art. 300(39) § 1, 3 KSH) - obok juz istniejacych ustrukturyzowanych
      -- pol (termin wskazania nabywcy, sposob ustalenia ceny, termin
      -- zaplaty). Kreator rejestracji dopuszcza zapisanie tego postanowienia
      -- BEZ kompletu trzech szczegolow (byly dotad wymagane razem) - notariusz
      -- moze ich jeszcze nie znac przy zakladaniu spolki. Twarda blokada
      -- (postanowienie niekompletne = bezskuteczne) przenosi sie na moment
      -- FAKTYCZNEGO zbycia akcji (server/logika/walidacje.js).
      ALTER TABLE psa_ograniczenia ADD COLUMN tresc_postanowienia TEXT;
    `,
  },
  {
    wersja: 21,
    nazwa: 'etap 3A: zgloszenia wstepne portalu (lekki formularz publiczny)',
    sql: `
      -- Pierwszy kontakt nowego, nieznanego dotad klienta - WYLACZNIE dane
      -- kontaktowe (e-mail, telefon, nazwa spolki, krotki opis), bez PESEL
      -- i bez adresow. Zadnego konta portalowego ani sprawy nie zaklada -
      -- to kancelaria decyduje, czy wyslac zaproszenie (etap 3B) czy odrzucic.
      -- Celowo NIE jest tabela append-only (jak psa_zdarzenia) - to wylacznie
      -- lead przed jakakolwiek weryfikacja tozsamosci, wolno go edytowac
      -- i usuwac (np. RODO - zadanie usuniecia danych przed zawarciem umowy).
      CREATE TABLE IF NOT EXISTS psa_zgloszenia (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        email               TEXT NOT NULL,
        telefon             TEXT,
        nazwa_spolki        TEXT,
        opis                TEXT,
        status              TEXT NOT NULL DEFAULT 'nowe'
                              CHECK (status IN ('nowe','zaproszono','odrzucone')),
        notatka_wewnetrzna  TEXT,
        obsluzone_przez     TEXT,
        obsluzone_kiedy     TEXT,
        utworzono           TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS psa_ix_zgloszenia_status
        ON psa_zgloszenia (status, utworzono);
    `,
  },
  {
    wersja: 22,
    nazwa: 'etap 3B: rola wnioskodawca w psa_konta (zaproszenie przed istnieniem spolki)',
    sql: `
      -- SQLite nie pozwala zmienic CHECK-a przez ALTER TABLE - psa_konta nie
      -- jest append-only (to nie psa_zdarzenia), wiec przepisujemy ja z nowa
      -- rola 'wnioskodawca': konto zaproszone przez kancelarie (etap 3B),
      -- ktore NIE ma jeszcze ani spolka_id (spolka nie istnieje w systemie
      -- do czasu przyjecia wniosku), ani osoba_id (nie jest jeszcze
      -- akcjonariuszem zadnej spolki). Rownowaznosc dwoch CHECK-ow zamiast
      -- jednego wylicza poprawnie wszystkie trzy role:
      --   spolka        -> spolka_id wymagane,  osoba_id NULL
      --   akcjonariusz  -> spolka_id NULL,       osoba_id wymagane
      --   wnioskodawca  -> spolka_id NULL,       osoba_id NULL
      --
      -- hash_hasla staje sie NULLOWALNE - konto istnieje juz PRZED
      -- aktywacja (link mailowy), haslo ustawia dopiero klient w tym
      -- momencie (logika/hasla.js: zweryfikuj juz dzis bezpiecznie
      -- traktuje brak hasha jako "nie pasuje", zero zmian po tej stronie).
      -- token_wygasa - link aktywacyjny nie moze byc wazny bezterminowo.
      CREATE TABLE psa_konta_v22 (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        email              TEXT NOT NULL UNIQUE,
        hash_hasla         TEXT,
        rola               TEXT NOT NULL CHECK (rola IN ('spolka','akcjonariusz','wnioskodawca')),
        spolka_id          INTEGER REFERENCES psa_spolki(id),
        osoba_id           INTEGER REFERENCES psa_osoby(id),
        aktywne            INTEGER NOT NULL DEFAULT 0 CHECK (aktywne IN (0,1)),
        token_aktywacji    TEXT,
        token_wygasa       TEXT,
        ostatnie_logowanie TEXT,
        utworzono          TEXT NOT NULL,
        CHECK ((rola = 'spolka') = (spolka_id IS NOT NULL)),
        CHECK ((rola = 'akcjonariusz') = (osoba_id IS NOT NULL))
      );
      INSERT INTO psa_konta_v22
        (id, email, hash_hasla, rola, spolka_id, osoba_id, aktywne, token_aktywacji, ostatnie_logowanie, utworzono)
        SELECT id, email, hash_hasla, rola, spolka_id, osoba_id, aktywne, token_aktywacji, ostatnie_logowanie, utworzono
          FROM psa_konta;
      DROP TABLE psa_konta;
      ALTER TABLE psa_konta_v22 RENAME TO psa_konta;

      CREATE INDEX IF NOT EXISTS psa_ix_konta_spolka
        ON psa_konta (spolka_id);
      CREATE INDEX IF NOT EXISTS psa_ix_konta_osoba
        ON psa_konta (osoba_id);
      CREATE INDEX IF NOT EXISTS psa_ix_konta_token
        ON psa_konta (token_aktywacji);
    `,
  },
  {
    wersja: 23,
    nazwa: 'etap 3B.1: potwierdzenie klauzuli informacyjnej RODO przed wnioskiem',
    sql: `
      -- Znacznik czasu potwierdzenia klauzuli informacyjnej o przetwarzaniu
      -- danych osobowych - blokuje dostep do formularza wniosku (etap 3C)
      -- dopoki wnioskodawca jej nie potwierdzi. To NIE jest "zgoda" w
      -- rozumieniu art. 6 ust. 1 lit. a) RODO (podstawa przetwarzania danych
      -- rejestru to umowa/obowiazek prawny, nie zgoda - wiec zgody sie tu nie
      -- "zbiera") - to potwierdzenie ZAPOZNANIA SIE z obowiazkiem
      -- informacyjnym (art. 13 RODO). Osobna, prawdziwa zgoda (na komunikacje
      -- elektroniczna) zyje przy danych akcjonariusza, nie przy koncie.
      ALTER TABLE psa_konta ADD COLUMN rodo_zaakceptowano TEXT;
    `,
  },
  {
    wersja: 24,
    nazwa: 'etap 3C: psa_wnioski (dane spolki i reprezentanta z portalu klienta)',
    sql: `
      -- Wniosek klienta o prowadzenie rejestru - dane spolki i reprezentanta
      -- zbierane PRZED istnieniem samej spolki w systemie (psa_spolki
      -- powstaje dopiero, gdy kancelaria przyjmie wniosek - etap 3F,
      -- podobnie jak dzis przy "Otworz rejestr" w kreatorze wewnetrznym).
      -- Kolumny CELOWO lustrza podzbior psa_spolki (plus reprezentant_* z
      -- etapu 2.2/2.3) - zeby projekt umowy (etap 3E) dalo sie wygenerowac
      -- wolawac server/logika/kontekst-pisma.js: umowaOProwadzenieRejestru()
      -- na obiekcie wniosku DOKLADNIE tak samo, jak dzis na obiekcie spolki,
      -- bez przepisywania mapowania pol.
      CREATE TABLE IF NOT EXISTS psa_wnioski (
        id                          INTEGER PRIMARY KEY AUTOINCREMENT,
        konto_id                    INTEGER NOT NULL UNIQUE REFERENCES psa_konta(id),
        status                      TEXT NOT NULL DEFAULT 'w_przygotowaniu'
                                      CHECK (status IN (
                                        'w_przygotowaniu','zlozony','do_uzupelnienia',
                                        'umowa_wygenerowana','umowa_podpisana','przyjety','odrzucony'
                                      )),
        krs                         TEXT,
        nip                         TEXT,
        regon                       TEXT,
        nazwa                       TEXT,
        forma_prawna                TEXT NOT NULL DEFAULT 'PROSTA SPÓŁKA AKCYJNA',
        kraj                        TEXT DEFAULT 'Polska',
        kod_pocztowy                TEXT,
        miejscowosc                 TEXT,
        siedziba_miejscownik        TEXT,
        ulica                       TEXT,
        nr_domu                     TEXT,
        nr_lokalu                   TEXT,
        sad_rejestrowy              TEXT,
        wydzial                     TEXT,
        telefon                     TEXT,
        email                       TEXT,
        www                         TEXT,
        organ_rodzaj                TEXT,
        data_utworzenia_spolki      TEXT,
        data_ostatniego_wpisu_krs   TEXT,
        adres_edorecze              TEXT,
        kapital_akcyjny_grosze      INTEGER,
        data_zawarcia_umowy_spolki  TEXT,
        -- Reprezentant, ktory bedzie podpisywal umowe w imieniu spolki -
        -- mianownik (etap 2.3), te same klucze co psa_spolki.
        reprezentant_imie_nazwisko           TEXT,
        reprezentant_plec                    TEXT,
        reprezentant_funkcja                 TEXT,
        reprezentant_reprezentacja           TEXT,
        reprezentant_rodzice                 TEXT,
        reprezentant_dowod                   TEXT,
        reprezentant_pesel                   TEXT,
        reprezentant_adres                   TEXT,
        reprezentant_biernik_recznie         TEXT,
        reprezentant_funkcja_biernik_recznie TEXT,
        reprezentant_rodzice_recznie         TEXT,
        utworzono                   TEXT NOT NULL,
        zaktualizowano              TEXT
      );

      CREATE INDEX IF NOT EXISTS psa_ix_wnioski_status
        ON psa_wnioski (status);
    `,
  },
  {
    wersja: 25,
    nazwa: 'etap 3D: psa_wnioski_akcjonariusze (dane do kartoteki + zgoda elektroniczna)',
    sql: `
      -- Proponowani akcjonariusze zbierani przez klienta w portalu - dane do
      -- PRZYSZLEJ kartoteki wspolnej (psa_osoby), nie sama kartoteka: dopoki
      -- kancelaria nie zweryfikuje wniosku (etap 3F), te wiersze NIE tworza
      -- realnych psa_osoby (regula domenowa nr 10 - jeden inwestor wpisany
      -- raz - wpis nieprzejrzanych danych zaśmiecałby wspólną kartotekę
      -- wykorzystywaną przez WSZYSTKIE spolki kancelarii).
      -- Pola lustrza podzbior psa_osoby (bez AML/beneficjenta/PEP - to
      -- warstwa etapu 3.1, nie czesc wniosku klienta).
      CREATE TABLE IF NOT EXISTS psa_wnioski_akcjonariusze (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        wniosek_id        INTEGER NOT NULL REFERENCES psa_wnioski(id),
        kolejnosc         INTEGER NOT NULL DEFAULT 0,
        typ               TEXT NOT NULL DEFAULT 'fizyczna' CHECK (typ IN ('fizyczna','prawna')),
        nazwisko          TEXT,
        imie              TEXT,
        nazwa             TEXT,
        pesel             TEXT,
        data_urodzenia    TEXT,
        plec              TEXT,
        nip               TEXT,
        regon             TEXT,
        numer_w_rejestrze TEXT,
        nazwa_rejestru    TEXT,
        kod_pocztowy      TEXT,
        miejscowosc       TEXT,
        ulica             TEXT,
        nr_domu           TEXT,
        nr_lokalu         TEXT,
        adres_doreczen    TEXT,
        adres_edoreczen   TEXT,
        email             TEXT,
        telefon           TEXT,
        -- Swiadoma zgoda na komunikacje elektroniczna (opis promptu, etap 3
        -- "zakres danych"): adres do doreczen elektronicznych trafia do
        -- rejestru WYLACZNIE za zgoda akcjonariusza.
        zgoda_email       INTEGER NOT NULL DEFAULT 0 CHECK (zgoda_email IN (0,1)),
        utworzono         TEXT NOT NULL,
        zaktualizowano    TEXT
      );

      CREATE INDEX IF NOT EXISTS psa_ix_wnioski_akcjonariusze_wniosek
        ON psa_wnioski_akcjonariusze (wniosek_id, kolejnosc);
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
