'use strict';

/**
 * Serwis rejestru: zapis zdarzen i materializacja stanu.
 *
 * Podzial odpowiedzialnosci:
 *   `logika/*`  - czysta domena, bez bazy (testowalna w izolacji),
 *   `rejestr.js`- transakcje, lancuch skrotow, materializacja,
 *   `trasy/*`   - HTTP.
 *
 * Regula domenowa nr 2: materializacje (`psa_emisje`, `psa_stan_akcji`,
 * `psa_obciazenia`, `psa_uprawnienia`, `psa_ograniczenia`) sa ODTWARZALNE
 * ze zdarzen w calosci. Kazdy zapis konczy sie pelnym przeliczeniem spolki -
 * nie ma osobnej sciezki "przyrostowej", ktora moglaby sie rozjechac
 * z odbudowa.
 */

const lancuch = require('./logika/lancuch');
const stanLogika = require('./logika/stan');
const walidacje = require('./logika/walidacje');
const kreator = require('./logika/kreator');
const typyZdarzen = require('./logika/typy-zdarzen');
const przepisy = require('./logika/przepisy');
const oplaty = require('./oplaty');
const czas = require('./pomocnicze/czas');

class BladWalidacji extends Error {
  constructor(bledy, ostrzezenia = []) {
    super(bledy.join(' '));
    this.name = 'BladWalidacji';
    this.bledy = bledy;
    this.ostrzezenia = ostrzezenia;
  }
}

// ─────────────────────────────────────────────────────────────
// Odczyt
// ─────────────────────────────────────────────────────────────

function wczytajSpolke(db, spolkaId) {
  return db.prepare('SELECT * FROM psa_spolki WHERE id = ?').get(spolkaId) || null;
}

function wczytajZdarzenia(db, spolkaId) {
  const wiersze = db
    .prepare(
      `SELECT * FROM psa_zdarzenia
       WHERE spolka_id = ?
       ORDER BY data_wpisu ASC, id ASC`
    )
    .all(spolkaId);
  return wiersze.map((z) => ({ ...z, dane: JSON.parse(z.dane_json) }));
}

function wczytajOsoby(db, idki) {
  const mapa = new Map();
  const unikalne = [...new Set((idki || []).map(Number).filter(Number.isInteger))];
  if (unikalne.length === 0) return mapa;
  const znaki = unikalne.map(() => '?').join(',');
  for (const o of db.prepare(`SELECT * FROM psa_osoby WHERE id IN (${znaki})`).all(...unikalne)) {
    mapa.set(o.id, o);
  }
  return mapa;
}

/** Wszystkie osoby wystepujace w rejestrze spolki - do widokow i wydrukow. */
function wczytajOsobySpolki(db, spolkaId) {
  const idki = db
    .prepare(
      `SELECT DISTINCT osoba_id FROM psa_stan_akcji WHERE spolka_id = ? AND osoba_id IS NOT NULL
       UNION
       SELECT DISTINCT osoba_id FROM psa_obciazenia WHERE spolka_id = ? AND osoba_id IS NOT NULL
       UNION
       SELECT DISTINCT akcjonariusz_osoba_id FROM psa_obciazenia
         WHERE spolka_id = ? AND akcjonariusz_osoba_id IS NOT NULL`
    )
    .all(spolkaId, spolkaId, spolkaId)
    .map((r) => r.osoba_id);
  return wczytajOsoby(db, idki);
}

// ─────────────────────────────────────────────────────────────
// Zapis zdarzenia (lancuch skrotow)
// ─────────────────────────────────────────────────────────────

/**
 * Dopisuje zdarzenie do lancucha. MUSI byc wywolane wewnatrz transakcji
 * IMMEDIATE - `id` wyliczamy jako MAX(id)+1, wiec rownolegly zapis musi byc
 * wykluczony. `hash` liczymy PRZED wstawieniem, bo rekordu zdarzenia nie
 * wolno pozniej aktualizowac (wyzwalacz append-only i tak by na to nie
 * pozwolil).
 *
 * D-R01: `data_wpisu` nadaje system (UTC, co do sekundy) - nie ma jej w
 * zadnym wejsciu API. `zdarzenie.chwila` to wewnetrzny parametr: zegar
 * wstrzykiwany w testach albo historyczna data rejestracji z KRN przy
 * migracji (wtedy `dane.migracja_krn` - objete skrotem - to oznacza).
 */
function zapiszZdarzenie(db, zdarzenie) {
  // D-31: ostatnia zapora - nic nie trafia do rejestru wykreslonej spolki
  // ani rejestru przekazanego innemu podmiotowi.
  const blokada = przepisy.blokadaWpisu(wczytajSpolke(db, zdarzenie.spolka_id));
  if (blokada) throw new BladWalidacji([blokada]);

  const poprzednie = db
    .prepare('SELECT id, hash FROM psa_zdarzenia ORDER BY id DESC LIMIT 1')
    .get();

  const id = poprzednie ? Number(poprzednie.id) + 1 : 1;
  const hashPoprzedni = poprzednie ? poprzednie.hash : lancuch.HASH_POCZATKOWY;

  const rekord = {
    id,
    spolka_id: Number(zdarzenie.spolka_id),
    typ: String(zdarzenie.typ),
    data_wpisu: zdarzenie.chwila ? czas.chwilaUtc(zdarzenie.chwila) : czas.terazUtc(),
    autor: lancuch.oczysc(zdarzenie.autor),
    sprawa_id: zdarzenie.sprawa_id ?? null,
    dane_json: lancuch.kanonicznyJson(zdarzenie.dane ?? {}),
    zdarzenie_prostowane_id: zdarzenie.zdarzenie_prostowane_id ?? null,
    uzasadnienie: zdarzenie.uzasadnienie ?? null,
    hash_poprzedni: hashPoprzedni,
  };
  rekord.hash = lancuch.skrot(rekord);

  db.prepare(
    `INSERT INTO psa_zdarzenia
       (id, spolka_id, typ, data_wpisu, autor, sprawa_id, dane_json,
        zdarzenie_prostowane_id, uzasadnienie, hash_poprzedni, hash)
     VALUES
       (@id, @spolka_id, @typ, @data_wpisu, @autor, @sprawa_id, @dane_json,
        @zdarzenie_prostowane_id, @uzasadnienie, @hash_poprzedni, @hash)`
  ).run(rekord);

  return rekord;
}

// ─────────────────────────────────────────────────────────────
// Materializacja
// ─────────────────────────────────────────────────────────────

/**
 * Odtwarza stan spolki ze zdarzen i przepisuje materializacje.
 * MUSI byc wywolane wewnatrz transakcji.
 *
 * @returns {{ niezgodnosci: string[] }} bledy bilansu, jesli w bazie sa juz
 *          dane niespojne (odbudowa ich nie ukrywa - raportuje).
 */
function zmaterializuj(db, spolkaId) {
  const zdarzenia = wczytajZdarzenia(db, spolkaId);
  const stan = stanLogika.odtworzStan(zdarzenia);
  const niezgodnosci = stanLogika.sprawdzBilans(stan);

  // 1. Emisje - klucz stabilny: zdarzenie_id. Zachowujemy `psa_emisje.id`,
  //    bo odwoluja sie do niego pozostale materializacje.
  const istniejace = new Map(
    db
      .prepare('SELECT id, zdarzenie_id FROM psa_emisje WHERE spolka_id = ?')
      .all(spolkaId)
      .map((e) => [Number(e.zdarzenie_id), Number(e.id)])
  );

  // Materializacje zalezne kasujemy najpierw - wskazuja na psa_emisje.
  db.prepare('DELETE FROM psa_stan_akcji WHERE spolka_id = ?').run(spolkaId);
  db.prepare('DELETE FROM psa_obciazenia WHERE spolka_id = ?').run(spolkaId);
  db.prepare('DELETE FROM psa_uprawnienia WHERE spolka_id = ?').run(spolkaId);
  db.prepare('DELETE FROM psa_ograniczenia WHERE spolka_id = ?').run(spolkaId);

  const idEmisji = new Map(); // klucz zdarzenia -> psa_emisje.id
  const aktualne = new Set();

  for (const e of stan.emisje) {
    const wartosci = {
      spolka_id: spolkaId,
      zdarzenie_id: e.zdarzenie_id,
      tytul: e.tytul,
      podstawa_prawna: e.podstawa_prawna,
      seria: e.seria,
      nr_pierwszy: e.nr_pierwszy,
      ilosc: e.ilosc,
      cena_emisyjna_grosze: e.cena_emisyjna_grosze,
      waluta: e.waluta,
      data_emisji: e.data_emisji,
      status: e.status,
      opis: e.opis,
      uwagi: e.uwagi,
      data_wpisu_krs: e.data_wpisu_krs,
      rodzaj_akcji: e.rodzaj_akcji,
      obowiazki_wobec_spolki: e.obowiazki_wobec_spolki,
    };
    const istniejacyId = istniejace.get(Number(e.zdarzenie_id));
    if (istniejacyId) {
      db.prepare(
        `UPDATE psa_emisje SET
           tytul=@tytul, podstawa_prawna=@podstawa_prawna, seria=@seria,
           nr_pierwszy=@nr_pierwszy, ilosc=@ilosc, cena_emisyjna_grosze=@cena_emisyjna_grosze,
           waluta=@waluta, data_emisji=@data_emisji, status=@status, opis=@opis, uwagi=@uwagi,
           data_wpisu_krs=@data_wpisu_krs, rodzaj_akcji=@rodzaj_akcji,
           obowiazki_wobec_spolki=@obowiazki_wobec_spolki
         WHERE id=@id`
      ).run({ ...wartosci, id: istniejacyId });
      idEmisji.set(e.klucz, istniejacyId);
      aktualne.add(istniejacyId);
    } else {
      const wynik = db
        .prepare(
          `INSERT INTO psa_emisje
             (spolka_id, zdarzenie_id, tytul, podstawa_prawna, seria, nr_pierwszy, ilosc,
              cena_emisyjna_grosze, waluta, data_emisji, status, opis, uwagi,
              data_wpisu_krs, rodzaj_akcji, obowiazki_wobec_spolki)
           VALUES
             (@spolka_id, @zdarzenie_id, @tytul, @podstawa_prawna, @seria, @nr_pierwszy, @ilosc,
              @cena_emisyjna_grosze, @waluta, @data_emisji, @status, @opis, @uwagi,
              @data_wpisu_krs, @rodzaj_akcji, @obowiazki_wobec_spolki)`
        )
        .run(wartosci);
      idEmisji.set(e.klucz, Number(wynik.lastInsertRowid));
      aktualne.add(Number(wynik.lastInsertRowid));
    }
  }

  // Emisje, ktorych juz nie ma w lancuchu (np. po sprostowaniu) - usuwamy.
  for (const [, id] of istniejace) {
    if (!aktualne.has(id)) db.prepare('DELETE FROM psa_emisje WHERE id = ?').run(id);
  }

  // 2. Stan akcji.
  const wstawStan = db.prepare(
    `INSERT INTO psa_stan_akcji
       (spolka_id, emisja_id, kategoria, osoba_id, nr_od, nr_do, ilosc, tytul_nabycia,
        zdarzenie_od_id, data_od, zdarzenie_do_id, data_do,
        czesc_licznik, czesc_mianownik, przedstawiciel_osoba_id, pokryta)
     VALUES
       (@spolka_id, @emisja_id, @kategoria, @osoba_id, @nr_od, @nr_do, @ilosc, @tytul_nabycia,
        @zdarzenie_od_id, @data_od, @zdarzenie_do_id, @data_do,
        @czesc_licznik, @czesc_mianownik, @przedstawiciel_osoba_id, @pokryta)`
  );
  for (const p of stan.przedzialy) {
    wstawStan.run({
      spolka_id: spolkaId,
      emisja_id: idEmisji.get(p.emisja_klucz),
      kategoria: p.kategoria,
      osoba_id: p.osoba_id,
      nr_od: p.nr_od,
      nr_do: p.nr_do,
      ilosc: p.nr_do - p.nr_od + 1,
      tytul_nabycia: p.tytul_nabycia,
      zdarzenie_od_id: p.zdarzenie_od_id,
      data_od: p.data_od,
      zdarzenie_do_id: p.zdarzenie_do_id,
      data_do: p.data_do,
      czesc_licznik: p.czesc_licznik ?? 1,
      czesc_mianownik: p.czesc_mianownik ?? 1,
      przedstawiciel_osoba_id: p.przedstawiciel_osoba_id ?? null,
      pokryta: p.pokryta ?? null,
    });
  }

  // 3. Obciazenia - w bazie trzymamy je rozbite na ciagle zakresy.
  const wstawObciazenie = db.prepare(
    `INSERT INTO psa_obciazenia
       (spolka_id, typ, emisja_id, nr_od, nr_do, osoba_id, akcjonariusz_osoba_id, prawo_glosu,
        blokuje_rozporzadzanie, opis, zdarzenie_ustanowienia_id, data_od,
        zdarzenie_wykreslenia_id, data_do)
     VALUES
       (@spolka_id, @typ, @emisja_id, @nr_od, @nr_do, @osoba_id, @akcjonariusz_osoba_id, @prawo_glosu,
        @blokuje_rozporzadzanie, @opis, @zdarzenie_ustanowienia_id, @data_od,
        @zdarzenie_wykreslenia_id, @data_do)`
  );
  for (const o of stan.obciazenia) {
    for (const z of o.zakresy) {
      wstawObciazenie.run({
        spolka_id: spolkaId,
        typ: o.typ,
        emisja_id: idEmisji.get(o.emisja_klucz),
        nr_od: z.nr_od,
        nr_do: z.nr_do,
        osoba_id: o.osoba_id,
        akcjonariusz_osoba_id: o.akcjonariusz_osoba_id,
        prawo_glosu: o.prawo_glosu,
        blokuje_rozporzadzanie: o.blokuje_rozporzadzanie,
        opis: o.opis,
        zdarzenie_ustanowienia_id: o.zdarzenie_ustanowienia_id,
        data_od: o.data_od,
        zdarzenie_wykreslenia_id: o.zdarzenie_wykreslenia_id,
        data_do: o.data_do,
      });
    }
  }

  // 4. Uprawnienia i ograniczenia.
  const wstawUprawnienie = db.prepare(
    `INSERT INTO psa_uprawnienia
       (spolka_id, rodzaj, zakres, emisja_id, osoba_id, tytul, tresc, data_ustanowienia,
        zdarzenie_id, status, data_wykreslenia)
     VALUES
       (@spolka_id, @rodzaj, @zakres, @emisja_id, @osoba_id, @tytul, @tresc, @data_ustanowienia,
        @zdarzenie_id, @status, @data_wykreslenia)`
  );
  for (const u of stan.uprawnienia) {
    wstawUprawnienie.run({
      spolka_id: spolkaId,
      rodzaj: u.rodzaj,
      zakres: u.zakres,
      emisja_id: u.emisja_klucz == null ? null : idEmisji.get(u.emisja_klucz) ?? null,
      osoba_id: u.osoba_id,
      tytul: u.tytul,
      tresc: u.tresc,
      data_ustanowienia: u.data_ustanowienia,
      zdarzenie_id: u.zdarzenie_id,
      status: u.status,
      data_wykreslenia: u.data_wykreslenia,
    });
  }

  const wstawOgraniczenie = db.prepare(
    `INSERT INTO psa_ograniczenia
       (spolka_id, zakres, emisja_id, nr_od, nr_do, wymaga_zgody_spolki,
        zgoda_termin_wskazania_dni, zgoda_cena_opis, zgoda_termin_zaplaty_dni,
        tresc_postanowienia, prawo_pierwszenstwa, opis, zdarzenie_id, status, data_wykreslenia)
     VALUES
       (@spolka_id, @zakres, @emisja_id, @nr_od, @nr_do, @wymaga_zgody_spolki,
        @zgoda_termin_wskazania_dni, @zgoda_cena_opis, @zgoda_termin_zaplaty_dni,
        @tresc_postanowienia, @prawo_pierwszenstwa, @opis, @zdarzenie_id, @status, @data_wykreslenia)`
  );
  for (const o of stan.ograniczenia) {
    const zakresy = o.zakresy && o.zakresy.length > 0 ? o.zakresy : [{ nr_od: null, nr_do: null }];
    for (const z of zakresy) {
      wstawOgraniczenie.run({
        spolka_id: spolkaId,
        zakres: o.zakres,
        emisja_id: o.emisja_klucz == null ? null : idEmisji.get(o.emisja_klucz) ?? null,
        nr_od: z.nr_od,
        nr_do: z.nr_do,
        wymaga_zgody_spolki: o.wymaga_zgody_spolki,
        zgoda_termin_wskazania_dni: o.zgoda_termin_wskazania_dni ?? null,
        zgoda_cena_opis: o.zgoda_cena_opis ?? null,
        zgoda_termin_zaplaty_dni: o.zgoda_termin_zaplaty_dni ?? null,
        tresc_postanowienia: o.tresc_postanowienia ?? null,
        prawo_pierwszenstwa: o.prawo_pierwszenstwa,
        opis: o.opis,
        zdarzenie_id: o.zdarzenie_id,
        status: o.status,
        data_wykreslenia: o.data_wykreslenia,
      });
    }
  }

  return { niezgodnosci, stan };
}

// ─────────────────────────────────────────────────────────────
// Kreator: podglad i wpis
// ─────────────────────────────────────────────────────────────

/**
 * D-R01 - chwila, z ktora zostanie dokonany wpis (UTC). Zawsze „teraz”;
 * `teraz` to wylacznie zegar wstrzykiwany w testach (trasy HTTP go nie
 * przekazuja), `migracjaKrn.data_rejestracji` - historyczna data rejestracji
 * w rejestrze KRN przy przejeciu rejestru (jedyny wyjatek, D-R08 pkt 5).
 */
function chwilaWpisu({ teraz, migracjaKrn } = {}) {
  if (migracjaKrn) {
    const zrodlo = migracjaKrn.data_rejestracji;
    if (!czas.poprawnaDataAlboChwila(zrodlo)) {
      throw new BladWalidacji([
        'Migracja z KRN wymaga daty (i godziny) rejestracji wpisu w KRN w formacie RRRR-MM-DD albo RRRR-MM-DDTGG:MM.',
      ]);
    }
    return czas.chwilaUtc(zrodlo);
  }
  return teraz ? czas.chwilaUtc(teraz) : czas.terazUtc();
}

/**
 * D-R01: chwili wpisu nie da sie podac z zewnatrz ani antydatowac. Kazda
 * trasa zapisu przepuszcza cialo zadania przez te funkcje - pole z data
 * wpisu (albo dawna data zdarzenia) konczy sie odmowa, a nie cichym
 * zignorowaniem, zeby klient nie mial zludzenia, ze data zostala przyjeta.
 */
const POLA_DATY_ZAKAZANE = ['data_wpisu', 'chwila', 'teraz', 'data_zdarzenia'];
function odrzucRecznaDate(cialo) {
  const podane = POLA_DATY_ZAKAZANE.filter((k) => cialo && Object.prototype.hasOwnProperty.call(cialo, k));
  if (podane.length > 0) {
    throw new BladWalidacji([
      'Datę i godzinę wpisu nadaje system w chwili zatwierdzenia wpisu — nie można jej podać ani zmienić ' +
        `(pole: ${podane.join(', ')}).`,
    ]);
  }
}

/**
 * Wpis migracyjny (historyczna data z KRN) wolno dopisac wylacznie do
 * rejestru, ktory zawiera same wpisy migracyjne - po pierwszym zwyklym
 * wpisie historii nie da sie juz „dosypac” (PRZEJECIE-REJESTRU.md, krok 9).
 */
function sprawdzMigracjeKrn(db, spolkaId) {
  const zwykle = wczytajZdarzenia(db, spolkaId).filter((z) => !(z.dane && z.dane.migracja_krn));
  if (zwykle.length > 0) {
    throw new BladWalidacji([
      'Stan otwarcia z KRN można wprowadzić wyłącznie do rejestru, w którym nie dokonano jeszcze zwykłego wpisu.',
    ]);
  }
}

/**
 * Buduje tresc zdarzenia i sprawdza je wobec stanu rejestru - BEZ zapisu.
 * Zasila krok 4 kreatora (tabela przed/po, ostrzezenia, lista dokumentow).
 */
function przygotujPodglad(db, { spolkaId, typ, wejscie, teraz, migracja_krn: migracjaKrn }) {
  const spolka = wczytajSpolke(db, spolkaId);
  const chwila = chwilaWpisu({ teraz, migracjaKrn });
  if (!spolka) throw new BladWalidacji(['Nie odnaleziono spółki.']);

  const zdarzenia = wczytajZdarzenia(db, spolkaId);
  const stanPrzed = stanLogika.odtworzStan(zdarzenia);
  // Zdarzenia odwolujace sie do istniejacego obciazenia (wykreslenie_*,
  // prawo_glosu_zastawnika) niosa w wejsciu tylko `obciazenie_zdarzenie_id` -
  // strony trzeba dociagnac ze stanu, inaczej `sprawdzOsoby` nie znajdzie ich
  // w kartotece mimo ze sa poprawne (patrz kreator.dodatkoweOsobyZReferencji).
  const osoby = wczytajOsoby(db, [
    ...kreator.osobyWWejsciu(wejscie || {}),
    ...kreator.dodatkoweOsobyZReferencji(stanPrzed, typ, wejscie || {}),
  ]);

  const przygotowane = kreator.przygotuj(stanPrzed, { typ, dane: wejscie }, { osoby, spolka });
  const dane = migracjaKrn ? { ...przygotowane, migracja_krn: migracjaKrn } : przygotowane;

  const wynik = walidacje.sprawdz({
    zdarzenia,
    propozycja: { typ, chwila, dane },
    spolka,
    osoby,
  });

  return { spolka, dane, osoby, zdarzenia, chwila, ...wynik };
}

/**
 * Rdzen wpisu: zdarzenie + pelne przeliczenie materializacji + (dla
 * `zmiana_danych_akcjonariusza`) zastosowanie zmiany do `psa_osoby`.
 *
 * ZAKLADA, ze jest wywolywana wewnatrz juz otwartej transakcji - wolno ja
 * zagniezdzac (np. `dokonajWpisuSprawy` otwiera JEDNA transakcje obejmujaca
 * ten wpis oraz aktualizacje stanu sprawy).
 */
function _wykonajWpis(db, zlecenie) {
  if (zlecenie.migracja_krn) sprawdzMigracjeKrn(db, zlecenie.spolkaId);
  const podglad = przygotujPodglad(db, zlecenie);
  if (!podglad.dopuszczalne) {
    throw new BladWalidacji(podglad.bledy, podglad.ostrzezenia);
  }

  const zdarzenie = zapiszZdarzenie(db, {
    spolka_id: zlecenie.spolkaId,
    typ: zlecenie.typ,
    chwila: podglad.chwila,
    autor: zlecenie.autor,
    sprawa_id: zlecenie.sprawa_id ?? null,
    dane: podglad.dane,
    zdarzenie_prostowane_id: zlecenie.zdarzenie_prostowane_id ?? null,
    uzasadnienie: zlecenie.uzasadnienie ?? null,
  });

  // Zmiana danych akcjonariusza aktualizuje ZRODLO PRAWDY tych danych -
  // kartoteke `psa_osoby` - jako efekt uboczny zapisu zdarzenia. Sama
  // materializacja stanu akcji tego typu nie dotyczy (TYPY_BEZ_SKUTKU).
  if (zlecenie.typ === 'zmiana_danych_akcjonariusza' && podglad.dane.po) {
    const pola = Object.keys(podglad.dane.po);
    db.prepare(
      `UPDATE psa_osoby SET ${pola.map((k) => `${k} = @${k}`).join(', ')}, zaktualizowano = @zaktualizowano
       WHERE id = @id`
    ).run({ ...podglad.dane.po, zaktualizowano: czas.terazIso(), id: podglad.dane.osoba_id });
  }

  const { niezgodnosci } = zmaterializuj(db, zlecenie.spolkaId);
  if (niezgodnosci.length > 0) {
    // Nie powinno wystapic - walidacja sprawdza bilans przed zapisem.
    // Jesli jednak wystapi, transakcja sie cofa i rejestr zostaje spojny.
    throw new BladWalidacji(niezgodnosci.map((k) => `Bilans akcji: ${k}`));
  }

  db.prepare('UPDATE psa_spolki SET zaktualizowano = ? WHERE id = ?').run(
    czas.terazIso(),
    zlecenie.spolkaId
  );

  return {
    zdarzenie,
    ostrzezenia: podglad.ostrzezenia,
    typ: typyZdarzen.typ(zlecenie.typ),
  };
}

/**
 * Dokonuje wpisu: zdarzenie + pelne przeliczenie materializacji.
 * Cala operacja w jednej transakcji IMMEDIATE - albo rejestr zmienia sie
 * w calosci, albo wcale.
 */
function dokonajWpisu(db, zlecenie) {
  const transakcja = db.transaction(() => _wykonajWpis(db, zlecenie));
  return transakcja.immediate();
}

/**
 * Podstawia w `wartosc` odwolania do zdarzen z TEJ SAMEJ partii otwarcia
 * rejestru (patrz `otworzRejestr`). Kreator nie zna ID emisji, dopoki nie
 * zostanie zapisana - zamiast liczby wysyla znacznik
 * `{ __odwolanie_do_partii: 'emisja-A' }`, ktory tu zamieniamy na prawdziwe
 * `zdarzenie.id` przydzielone przez baze chwile wczesniej, W TEJ SAMEJ
 * transakcji. Przechodzi rekurencyjnie tablice i obiekty - odwolanie moze
 * siedziec na dowolnej glebokosci (np. `dane.emisja_zdarzenie_id`).
 */
function podstawKluczePartii(wartosc, idPartii) {
  if (wartosc == null || typeof wartosc !== 'object') return wartosc;
  if (Array.isArray(wartosc)) return wartosc.map((v) => podstawKluczePartii(v, idPartii));
  if (typeof wartosc.__odwolanie_do_partii === 'string') {
    const id = idPartii.get(wartosc.__odwolanie_do_partii);
    if (id == null) {
      throw new BladWalidacji([
        `Zdarzenie odwołuje się do „${wartosc.__odwolanie_do_partii}” z tej samej partii otwarcia ` +
          'rejestru, ale taki klucz tymczasowy nie występuje we wcześniejszych zdarzeniach.',
      ]);
    }
    return id;
  }
  const wynik = {};
  for (const [klucz, v] of Object.entries(wartosc)) wynik[klucz] = podstawKluczePartii(v, idPartii);
  return wynik;
}

/**
 * Otwiera rejestr spolki: zapisuje KOMPLET zdarzen zalozycielskich (emisja,
 * objecie, opcjonalnie ograniczenie z umowy spolki) w JEDNEJ transakcji -
 * sesja 6, faza 3. Bez tego rejestr moglby utknac w polowicznym stanie
 * (np. emisja zapisana, objecie odrzucone przez bilans) - "otwarcie
 * rejestru" ma byc niepodzielne, tak jak pojedynczy wpis w `dokonajWpisu`.
 *
 * `_wykonajWpis` jest bezpieczna do zagniezdzania w juz otwartej transakcji
 * (patrz jej wlasny komentarz) - ten sam wzorzec, ktorym `dokonajWpisuSprawy`
 * laczy jeden wpis z dodatkowymi skutkami ubocznymi w jednej transakcji.
 *
 * Kazdy element `zdarzenia` moze niesc opcjonalny `klucz_tymczasowy` (np.
 * `"emisja-A"`) - kolejne zdarzenia w TEJ SAMEJ partii odwoluja sie do jego
 * prawdziwego ID przez `{ __odwolanie_do_partii: 'emisja-A' }` gdziekolwiek
 * w `dane` (patrz `podstawKluczePartii`).
 */
function otworzRejestr(db, spolkaId, { zdarzenia, autor, teraz }) {
  const transakcja = db.transaction(() => {
    const idPartii = new Map();
    const zapisane = [];
    for (const z of zdarzenia) {
      const wynik = _wykonajWpis(db, {
        spolkaId,
        typ: z.typ,
        wejscie: podstawKluczePartii(z.dane, idPartii),
        teraz,
        autor,
      });
      if (z.klucz_tymczasowy) idPartii.set(z.klucz_tymczasowy, wynik.zdarzenie.id);
      zapisane.push(wynik);
    }
    return zapisane;
  });
  return transakcja.immediate();
}

/**
 * Dokonuje wpisu w ramach WORKFLOW SPRAWY: sprawa musi byc w stanie
 * `weryfikacja`; po wpisie przechodzi do `wpisana` ze wskazaniem zdarzenia.
 * Typ zdarzenia jest ustalony przez sprawe (nie da sie go zmienic w locie).
 *
 * Generowanie i wysylka zawiadomien o wpisie NASTEPUJE POZA ta transakcja
 * (patrz `server/zawiadomienia.js`) - to operacja sieciowa (e-mail), ktora
 * nie moze trzymac otwartej transakcji SQLite i ktorej niepowodzenie nie
 * jest powodem do cofniecia juz dokonanego, wazneg wpisu (art. 300(34) § 7
 * KSH nakazuje powiadomienie jako obowiazek NASTEPCZY wobec wpisu).
 */
function dokonajWpisuSprawy(db, { sprawaId, wejscie, autor, teraz }) {
  const transakcja = db.transaction(() => {
    const sprawa = db.prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(sprawaId);
    if (!sprawa) throw new BladWalidacji(['Nie odnaleziono sprawy.']);
    if (sprawa.stan !== 'weryfikacja') {
      throw new BladWalidacji([
        `Wpisu można dokonać wyłącznie ze stanu „weryfikacja” (sprawa jest w stanie „${sprawa.stan}”).`,
      ]);
    }

    const wynik = _wykonajWpis(db, {
      spolkaId: sprawa.spolka_id,
      typ: sprawa.typ_zdarzenia,
      wejscie,
      autor,
      teraz,
      sprawa_id: sprawaId,
    });

    // art. 300(37) § 2 KSH - regula domenowa 13. Ustalamy raz, w chwili
    // wpisu, zeby pozniejsza zmiana katalogu tytulow deklaratoryjnych nie
    // przepisywala historii juz zalatwionych spraw.
    const daneZdarzenia = JSON.parse(wynik.zdarzenie.dane_json || '{}');
    const charakterWpisu = przepisy.charakterWpisu(sprawa.typ_zdarzenia, daneZdarzenia.tytul_prawny);

    db.prepare(
      `UPDATE psa_sprawy SET stan = 'wpisana', zdarzenie_id = @zid, charakter_wpisu = @charakter, zaktualizowano = @teraz WHERE id = @id`
    ).run({ zid: wynik.zdarzenie.id, charakter: charakterWpisu, teraz: czas.terazIso(), id: sprawaId });

    // Oplata za wpis (sekcja 1 i 8) - wylacznie dla typow odplatnych
    // (zajecie/wykreslenie zajecia sa wolne od oplat z mocy art. 300(34) § 2
    // KSH - `typ.odplatne` juz to koduje w katalogu). Sciezka bezposrednia
    // `dokonajWpisu` (migracja "stan otwarcia") celowo NIE przechodzi tedy -
    // wpisywanie historycznego stanu nie jest biezaca czynnoscia odplatna.
    //
    // Sprawa zgloszona przez portal MA JUZ naliczona oplate — powstala razem
    // z zadaniem i to jej zaplata uruchomila sprawe. Drugie naliczenie
    // kazaloby klientowi zaplacic dwa razy za ten sam wpis.
    const juzNaliczona = db
      .prepare(
        `SELECT id FROM psa_oplaty
          WHERE sprawa_id = ? AND typ = 'wpis' AND status != 'anulowana' LIMIT 1`
      )
      .get(sprawaId);

    let naliczonaOplata = null;
    if (wynik.typ.odplatne && !juzNaliczona) {
      naliczonaOplata = oplaty.naliczOplateWpisu(db, {
        spolkaId: sprawa.spolka_id,
        sprawaId,
        typZdarzenia: wynik.typ.nazwa,
        autor,
      });
    } else if (juzNaliczona) {
      naliczonaOplata = oplaty.wczytaj(db, juzNaliczona.id);
    }

    return {
      sprawa: { ...sprawa, stan: 'wpisana', zdarzenie_id: wynik.zdarzenie.id, charakter_wpisu: charakterWpisu },
      wynik,
      oplata: naliczonaOplata,
    };
  });

  return transakcja.immediate();
}

/**
 * Sprostowanie wczesniejszego zdarzenia (regula domenowa nr 1 - jedyna droga
 * korekty). `zamiast` (opcjonalne) niesie skorygowana tresc - patrz
 * `kreator.przygotujSprostowanie`.
 */
function dokonajSprostowania(db, { zdarzeniePierwotneId, uzasadnienie, zamiast, autor, teraz }) {
  const transakcja = db.transaction(() => {
    const pierwotne = db.prepare('SELECT * FROM psa_zdarzenia WHERE id = ?').get(zdarzeniePierwotneId);
    if (!pierwotne) throw new BladWalidacji(['Nie odnaleziono zdarzenia do sprostowania.']);
    if (pierwotne.typ === 'sprostowanie') {
      throw new BladWalidacji(['Nie prostuje się zdarzenia będącego sprostowaniem — wskaż zdarzenie źródłowe.']);
    }
    const jużSprostowane = db
      .prepare('SELECT id FROM psa_zdarzenia WHERE zdarzenie_prostowane_id = ?')
      .get(zdarzeniePierwotneId);
    if (jużSprostowane) {
      throw new BladWalidacji([`To zdarzenie zostało już sprostowane zdarzeniem #${jużSprostowane.id}.`]);
    }
    if (!uzasadnienie || !String(uzasadnienie).trim()) {
      throw new BladWalidacji(['Sprostowanie wymaga uzasadnienia wskazującego, na czym polegała pomyłka.']);
    }

    const spolkaId = pierwotne.spolka_id;
    const spolka = wczytajSpolke(db, spolkaId);
    const zdarzenia = wczytajZdarzenia(db, spolkaId);
    const chwila = chwilaWpisu({ teraz });

    const osoby = wczytajOsoby(
      db,
      zamiast ? kreator.osobyWWejsciu(zamiast.dane || {}) : []
    );

    const { dane } = kreator.przygotujSprostowanie(
      { zdarzenia, zdarzeniePierwotneId, uzasadnienie, zamiast },
      { osoby }
    );

    const propozycja = {
      typ: 'sprostowanie',
      chwila,
      dane,
      zdarzenie_prostowane_id: zdarzeniePierwotneId,
    };
    const wynikWalidacji = walidacje.sprawdz({ zdarzenia, propozycja, spolka, osoby });
    if (!wynikWalidacji.dopuszczalne) {
      throw new BladWalidacji(wynikWalidacji.bledy, wynikWalidacji.ostrzezenia);
    }

    const zdarzenie = zapiszZdarzenie(db, {
      spolka_id: spolkaId,
      typ: 'sprostowanie',
      chwila,
      autor,
      dane,
      zdarzenie_prostowane_id: zdarzeniePierwotneId,
      uzasadnienie,
    });

    const { niezgodnosci } = zmaterializuj(db, spolkaId);
    if (niezgodnosci.length > 0) {
      throw new BladWalidacji(niezgodnosci.map((k) => `Bilans akcji: ${k}`));
    }
    db.prepare('UPDATE psa_spolki SET zaktualizowano = ? WHERE id = ?').run(czas.terazIso(), spolkaId);

    return { zdarzenie, ostrzezenia: wynikWalidacji.ostrzezenia };
  });

  return transakcja.immediate();
}

/** Pelna odbudowa materializacji ze zdarzen (endpoint `/przelicz`). */
function przelicz(db, spolkaId) {
  const transakcja = db.transaction(() => zmaterializuj(db, spolkaId));
  const { niezgodnosci } = transakcja.immediate();
  return { niezgodnosci };
}

/** Weryfikacja calego lancucha skrotow (endpoint `/integralnosc`). */
function zweryfikujIntegralnosc(db) {
  const zdarzenia = db.prepare('SELECT * FROM psa_zdarzenia ORDER BY id ASC').all();
  return lancuch.zweryfikuj(zdarzenia);
}

module.exports = {
  odrzucRecznaDate,
  BladWalidacji,
  wczytajSpolke,
  wczytajZdarzenia,
  wczytajOsoby,
  wczytajOsobySpolki,
  zapiszZdarzenie,
  zmaterializuj,
  przygotujPodglad,
  dokonajWpisu,
  otworzRejestr,
  dokonajWpisuSprawy,
  dokonajSprostowania,
  przelicz,
  zweryfikujIntegralnosc,
};
