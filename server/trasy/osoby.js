'use strict';

/**
 * Trasy `/api/psa/osoby/...` - kartoteka wspolna.
 *
 * Regula domenowa nr 10: jeden inwestor w wielu spolkach wpisywany RAZ.
 */

const express = require('express');

const { db } = require('../baza');
const przepisy = require('../logika/przepisy');
const maskowanie = require('../logika/maskowanie');
const aml = require('../logika/aml');
const czas = require('../pomocnicze/czas');
const { asy, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

const POLA_OSOBY = [
  'typ', 'nazwisko', 'imie', 'nazwa', 'plec', 'pesel', 'data_urodzenia', 'nip', 'regon',
  'numer_w_rejestrze', 'nazwa_rejestru', 'kraj', 'kod_pocztowy', 'miejscowosc', 'ulica',
  'nr_domu', 'nr_lokalu', 'adres_doreczen', 'adres_edoreczen', 'email', 'telefon',
  'zgoda_email', 'aml_status', 'aml_data', 'aml_notatka', 'uwagi',
  // Sesja 8, blok C (przeglad okresowy, beneficjent rzeczywisty, oswiadczenie PEP):
  'aml_data_przegladu', 'beneficjent_rzeczywisty_id', 'pep_oswiadczenie', 'pep_oswiadczenie_data',
];

function wyczysc(cialo) {
  const wynik = {};
  for (const pole of POLA_OSOBY) {
    if (cialo[pole] === undefined) continue;
    if (pole === 'zgoda_email') {
      wynik[pole] = cialo[pole] ? 1 : 0;
      continue;
    }
    if (pole === 'beneficjent_rzeczywisty_id') {
      wynik[pole] = cialo[pole] === '' || cialo[pole] === null ? null : Number(cialo[pole]);
      continue;
    }
    const v = cialo[pole];
    wynik[pole] = v === '' || v === null ? null : String(v).trim();
  }
  return wynik;
}

/** Suma kontrolna numeru PESEL - blad w PESEL-u akcjonariusza jest kosztowny. */
function poprawnyPesel(pesel) {
  if (!/^\d{11}$/.test(pesel)) return false;
  const wagi = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const suma = wagi.reduce((s, w, i) => s + w * Number(pesel[i]), 0);
  return (10 - (suma % 10)) % 10 === Number(pesel[10]);
}

function sprawdzOsobe(dane, { czesciowe = false } = {}) {
  const typ = dane.typ;
  if (!czesciowe || dane.typ !== undefined) {
    if (!['fizyczna', 'prawna'].includes(typ)) {
      throw bledneZadanie('Typ osoby musi być „fizyczna” albo „prawna”.');
    }
  }

  if (typ === 'fizyczna') {
    if (!czesciowe && !dane.nazwisko) throw bledneZadanie('Nazwisko jest wymagane.');
    // PESEL i data urodzenia sa DOBROWOLNE. Art. 300(33) § 1 pkt 5 KSH wymaga
    // dla osoby fizycznej wylacznie nazwiska i imienia oraz adresu - nie
    // zawiera PESEL-u ani daty urodzenia. Wczesniejsza wersja blokowala tu
    // zapis, przenoszac mechanicznie art. 328(3) KSH dotyczacy SPOLKI AKCYJNEJ
    // (PRZEPISY-PSA.md sekcja 12 pkt 2 wymienia ten blad wprost).
    // Oba pola zbieramy nadal - sluza identyfikacji na potrzeby AML i sa
    // maskowane wobec pozostalych akcjonariuszy (art. 300(35) § 1(1) KSH).
  }
  if (typ === 'prawna' && !czesciowe && !dane.nazwa) {
    throw bledneZadanie('Nazwa podmiotu jest wymagana.');
  }

  // Suma kontrolna PESEL jest MIEKKIM sygnalem (etap 2.8 poprawek), nie
  // blokada - PESEL jest juz i tak polem dobrowolnym (patrz komentarz wyzej),
  // a pomylka w jednej cyfrze nie powinna uniemozliwic zalozenia kartoteki
  // osoby. Ostrzezenie wraca w odpowiedzi (patrz `ostrzezeniaOsoby` nizej).
  if (dane.plec && !['kobieta', 'mezczyzna'].includes(dane.plec)) {
    throw bledneZadanie('Płeć musi być „kobieta” albo „mężczyzna”.');
  }
  if (dane.data_urodzenia && !czas.poprawnaData(dane.data_urodzenia)) {
    throw bledneZadanie('Data urodzenia musi mieć format RRRR-MM-DD.');
  }
  if (dane.aml_data && !czas.poprawnaData(dane.aml_data)) {
    throw bledneZadanie('Data weryfikacji AML musi mieć format RRRR-MM-DD.');
  }
  if (dane.aml_status && !Object.values(przepisy.AML_STATUSY).includes(dane.aml_status)) {
    throw bledneZadanie(`Nieznany status AML: „${dane.aml_status}”.`);
  }
  if (dane.aml_data_przegladu && !czas.poprawnaData(dane.aml_data_przegladu)) {
    throw bledneZadanie('Data przeglądu AML musi mieć format RRRR-MM-DD.');
  }
  // Oswiadczenie PEP (blok C3) - skladane przez OSOBE, nie ocena kancelarii,
  // stad katalog zamkniety tak/nie (nigdy zgadywane trzecia wartoscia).
  if (dane.pep_oswiadczenie && !['tak', 'nie'].includes(dane.pep_oswiadczenie)) {
    throw bledneZadanie('Oświadczenie PEP musi być „tak” albo „nie”.');
  }
  if (dane.pep_oswiadczenie_data && !czas.poprawnaData(dane.pep_oswiadczenie_data)) {
    throw bledneZadanie('Data oświadczenia PEP musi mieć format RRRR-MM-DD.');
  }
  if (dane.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dane.email)) {
    throw bledneZadanie('Adres e-mail jest niepoprawny.');
  }
}

/** Ostrzezenia NIE blokujace zapisu (etap 2.8 poprawek) - patrz sprawdzOsobe. */
function ostrzezeniaOsoby(dane) {
  const ostrzezenia = [];
  if (dane.pesel && !poprawnyPesel(dane.pesel)) {
    ostrzezenia.push('Suma kontrolna numeru PESEL się nie zgadza — sprawdź numer.');
  }
  return ostrzezenia;
}

/**
 * Beneficjent rzeczywisty (blok C2) - z definicji OSOBA FIZYCZNA (art. 2
 * ust. 2 pkt 1 ustawy AML), sensowny wylacznie dla podmiotu typu "prawna".
 * Odwolanie miedzy wierszami - CHECK w schemacie tego nie sprawdzi, stad
 * walidacja tutaj, z dostepem do bazy.
 */
function sprawdzBeneficjenta(id, wlascicielId, wlascicielTyp) {
  if (id == null) return;
  if (wlascicielTyp !== 'prawna') {
    throw bledneZadanie('Beneficjenta rzeczywistego wskazuje się wyłącznie dla osoby prawnej.');
  }
  if (id === wlascicielId) {
    throw bledneZadanie('Podmiot nie może być własnym beneficjentem rzeczywistym.');
  }
  const beneficjent = db().prepare('SELECT typ FROM psa_osoby WHERE id = ?').get(id);
  if (!beneficjent) throw bledneZadanie('Wskazany beneficjent rzeczywisty nie figuruje w kartotece.');
  if (beneficjent.typ !== 'fizyczna') {
    throw bledneZadanie('Beneficjent rzeczywisty musi być osobą fizyczną.');
  }
}

function zOznaczeniem(osoba) {
  return {
    ...osoba,
    oznaczenie: maskowanie.oznaczenieOsoby(osoba),
    jawny_identyfikator: maskowanie.jawnyIdentyfikator(osoba),
    // Sygnal, NIE blokada (blok C1) - patrz logika/aml.js.
    wymaga_przegladu_aml: aml.wymagaPrzegladu(osoba, czas.dzisIso()),
  };
}

// ─────────────────────────────────────────────────────────────

/** Wyszukiwarka kartoteki. */
router.get(
  '/',
  asy((zad, odp) => {
    const szukaj = String(zad.query.q || '').trim();
    const warunki = [];
    const parametry = [];

    if (szukaj) {
      warunki.push(
        '(nazwisko LIKE ? OR imie LIKE ? OR nazwa LIKE ? OR pesel LIKE ? OR nip LIKE ? OR email LIKE ?)'
      );
      const wzorzec = `%${szukaj}%`;
      parametry.push(wzorzec, wzorzec, wzorzec, wzorzec, wzorzec, wzorzec);
    }
    if (zad.query.typ) {
      warunki.push('typ = ?');
      parametry.push(String(zad.query.typ));
    }
    if (zad.query.aml_status) {
      warunki.push('aml_status = ?');
      parametry.push(String(zad.query.aml_status));
    }

    const gdzie = warunki.length ? `WHERE ${warunki.join(' AND ')}` : '';
    const osoby = db()
      .prepare(
        `SELECT o.*,
                (SELECT COUNT(DISTINCT sa.spolka_id) FROM psa_stan_akcji sa
                  WHERE sa.osoba_id = o.id AND sa.data_do IS NULL) AS liczba_spolek
           FROM psa_osoby o
           ${gdzie}
          ORDER BY COALESCE(o.nazwisko, o.nazwa) COLLATE NOCASE, o.imie COLLATE NOCASE
          LIMIT 200`
      )
      .all(...parametry);

    odp.json({ osoby: osoby.map(zOznaczeniem) });
  })
);

router.post(
  '/',
  asy((zad, odp) => {
    const dane = wyczysc(zad.body || {});
    sprawdzOsobe(dane);
    sprawdzBeneficjenta(dane.beneficjent_rzeczywisty_id, null, dane.typ);

    const teraz = czas.terazIso();
    const kolumny = Object.keys(dane);
    const wynik = db()
      .prepare(
        `INSERT INTO psa_osoby (${kolumny.join(', ')}, utworzono)
         VALUES (${kolumny.map((k) => `@${k}`).join(', ')}, @utworzono)`
      )
      .run({ ...dane, utworzono: teraz });

    odp.status(201).json({
      osoba: zOznaczeniem(
        db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(wynik.lastInsertRowid)
      ),
      ostrzezenia: ostrzezeniaOsoby(dane),
    });
  })
);

router.get(
  '/:id',
  asy((zad, odp) => {
    const osoba = db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(Number(zad.params.id));
    if (!osoba) throw nieZnaleziono('Nie odnaleziono osoby w kartotece.');
    odp.json({ osoba: zOznaczeniem(osoba) });
  })
);

router.put(
  '/:id',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const biezaca = db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(id);
    if (!biezaca) throw nieZnaleziono('Nie odnaleziono osoby w kartotece.');

    const dane = wyczysc(zad.body || {});
    if (Object.keys(dane).length === 0) throw bledneZadanie('Brak danych do zapisania.');
    const scalone = { ...biezaca, ...dane };
    sprawdzOsobe(scalone);
    if ('beneficjent_rzeczywisty_id' in dane) {
      sprawdzBeneficjenta(dane.beneficjent_rzeczywisty_id, id, scalone.typ);
    }

    db()
      .prepare(
        `UPDATE psa_osoby
            SET ${Object.keys(dane).map((k) => `${k} = @${k}`).join(', ')},
                zaktualizowano = @zaktualizowano
          WHERE id = @id`
      )
      .run({ ...dane, id, zaktualizowano: czas.terazIso() });

    odp.json({
      osoba: zOznaczeniem(db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(id)),
      ostrzezenia: ostrzezeniaOsoby(scalone),
    });
  })
);

/** W ktorych spolkach osoba ma akcje - podglad z kartoteki. */
router.get(
  '/:id/spolki',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    if (!db().prepare('SELECT id FROM psa_osoby WHERE id = ?').get(id)) {
      throw nieZnaleziono('Nie odnaleziono osoby w kartotece.');
    }
    const wiersze = db()
      .prepare(
        `SELECT s.id, s.nazwa, s.krs, s.status,
                SUM(sa.ilosc) AS ilosc_akcji,
                COUNT(DISTINCT sa.emisja_id) AS liczba_serii,
                MIN(sa.data_od) AS akcjonariusz_od
           FROM psa_stan_akcji sa
           JOIN psa_spolki s ON s.id = sa.spolka_id
          WHERE sa.osoba_id = ? AND sa.data_do IS NULL AND sa.kategoria = 'akcjonariusz'
          GROUP BY s.id
          ORDER BY s.nazwa COLLATE NOCASE`
      )
      .all(id);
    odp.json({ spolki: wiersze });
  })
);

module.exports = router;
