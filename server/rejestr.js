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
       ORDER BY data_zdarzenia ASC, id ASC`
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
 */
function zapiszZdarzenie(db, zdarzenie) {
  const poprzednie = db
    .prepare('SELECT id, hash FROM psa_zdarzenia ORDER BY id DESC LIMIT 1')
    .get();

  const id = poprzednie ? Number(poprzednie.id) + 1 : 1;
  const hashPoprzedni = poprzednie ? poprzednie.hash : lancuch.HASH_POCZATKOWY;

  const rekord = {
    id,
    spolka_id: Number(zdarzenie.spolka_id),
    typ: String(zdarzenie.typ),
    data_zdarzenia: String(zdarzenie.data_zdarzenia),
    data_wpisu: zdarzenie.data_wpisu || czas.terazIso(),
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
       (id, spolka_id, typ, data_zdarzenia, data_wpisu, autor, sprawa_id, dane_json,
        zdarzenie_prostowane_id, uzasadnienie, hash_poprzedni, hash)
     VALUES
       (@id, @spolka_id, @typ, @data_zdarzenia, @data_wpisu, @autor, @sprawa_id, @dane_json,
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
    };
    const istniejacyId = istniejace.get(Number(e.zdarzenie_id));
    if (istniejacyId) {
      db.prepare(
        `UPDATE psa_emisje SET
           tytul=@tytul, podstawa_prawna=@podstawa_prawna, seria=@seria,
           nr_pierwszy=@nr_pierwszy, ilosc=@ilosc, cena_emisyjna_grosze=@cena_emisyjna_grosze,
           waluta=@waluta, data_emisji=@data_emisji, status=@status, opis=@opis, uwagi=@uwagi
         WHERE id=@id`
      ).run({ ...wartosci, id: istniejacyId });
      idEmisji.set(e.klucz, istniejacyId);
      aktualne.add(istniejacyId);
    } else {
      const wynik = db
        .prepare(
          `INSERT INTO psa_emisje
             (spolka_id, zdarzenie_id, tytul, podstawa_prawna, seria, nr_pierwszy, ilosc,
              cena_emisyjna_grosze, waluta, data_emisji, status, opis, uwagi)
           VALUES
             (@spolka_id, @zdarzenie_id, @tytul, @podstawa_prawna, @seria, @nr_pierwszy, @ilosc,
              @cena_emisyjna_grosze, @waluta, @data_emisji, @status, @opis, @uwagi)`
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
        zdarzenie_od_id, data_od, zdarzenie_do_id, data_do)
     VALUES
       (@spolka_id, @emisja_id, @kategoria, @osoba_id, @nr_od, @nr_do, @ilosc, @tytul_nabycia,
        @zdarzenie_od_id, @data_od, @zdarzenie_do_id, @data_do)`
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
       (spolka_id, zakres, emisja_id, nr_od, nr_do, wymaga_zgody_spolki, prawo_pierwszenstwa,
        opis, zdarzenie_id, status, data_wykreslenia)
     VALUES
       (@spolka_id, @zakres, @emisja_id, @nr_od, @nr_do, @wymaga_zgody_spolki, @prawo_pierwszenstwa,
        @opis, @zdarzenie_id, @status, @data_wykreslenia)`
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
 * Buduje tresc zdarzenia i sprawdza je wobec stanu rejestru - BEZ zapisu.
 * Zasila krok 4 kreatora (tabela przed/po, ostrzezenia, lista dokumentow).
 */
function przygotujPodglad(db, { spolkaId, typ, data_zdarzenia, wejscie, dzisiaj }) {
  const spolka = wczytajSpolke(db, spolkaId);
  if (!spolka) throw new BladWalidacji(['Nie odnaleziono spółki.']);

  const zdarzenia = wczytajZdarzenia(db, spolkaId);
  const stanPrzed = stanLogika.odtworzStan(zdarzenia);
  const osoby = wczytajOsoby(db, kreator.osobyWWejsciu(wejscie || {}));

  const dane = kreator.przygotuj(
    stanPrzed,
    { typ, data_zdarzenia, dane: wejscie },
    { osoby }
  );

  const wynik = walidacje.sprawdz({
    zdarzenia,
    propozycja: { typ, data_zdarzenia, dane },
    spolka,
    osoby,
    dzisiaj,
  });

  return { spolka, dane, osoby, zdarzenia, ...wynik };
}

/**
 * Dokonuje wpisu: zdarzenie + pelne przeliczenie materializacji.
 * Cala operacja w jednej transakcji IMMEDIATE - albo rejestr zmienia sie
 * w calosci, albo wcale.
 */
function dokonajWpisu(db, zlecenie) {
  const transakcja = db.transaction(() => {
    const podglad = przygotujPodglad(db, zlecenie);
    if (!podglad.dopuszczalne) {
      throw new BladWalidacji(podglad.bledy, podglad.ostrzezenia);
    }

    const zdarzenie = zapiszZdarzenie(db, {
      spolka_id: zlecenie.spolkaId,
      typ: zlecenie.typ,
      data_zdarzenia: zlecenie.data_zdarzenia,
      autor: zlecenie.autor,
      sprawa_id: zlecenie.sprawa_id ?? null,
      dane: podglad.dane,
      zdarzenie_prostowane_id: zlecenie.zdarzenie_prostowane_id ?? null,
      uzasadnienie: zlecenie.uzasadnienie ?? null,
    });

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
  BladWalidacji,
  wczytajSpolke,
  wczytajZdarzenia,
  wczytajOsoby,
  wczytajOsobySpolki,
  zapiszZdarzenie,
  zmaterializuj,
  przygotujPodglad,
  dokonajWpisu,
  przelicz,
  zweryfikujIntegralnosc,
};
