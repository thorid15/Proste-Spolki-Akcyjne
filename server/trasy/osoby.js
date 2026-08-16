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
const czas = require('../pomocnicze/czas');
const { asy, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

const POLA_OSOBY = [
  'typ', 'nazwisko', 'imie', 'nazwa', 'plec', 'pesel', 'data_urodzenia', 'nip', 'regon',
  'numer_w_rejestrze', 'nazwa_rejestru', 'kraj', 'kod_pocztowy', 'miejscowosc', 'ulica',
  'nr_domu', 'nr_lokalu', 'adres_doreczen', 'adres_edoreczen', 'email', 'telefon',
  'zgoda_email', 'aml_status', 'aml_data', 'aml_notatka', 'uwagi',
];

function wyczysc(cialo) {
  const wynik = {};
  for (const pole of POLA_OSOBY) {
    if (cialo[pole] === undefined) continue;
    if (pole === 'zgoda_email') {
      wynik[pole] = cialo[pole] ? 1 : 0;
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

  if (dane.pesel && !poprawnyPesel(dane.pesel)) {
    throw bledneZadanie('Numer PESEL jest niepoprawny (nie zgadza się suma kontrolna).');
  }
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
  if (dane.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dane.email)) {
    throw bledneZadanie('Adres e-mail jest niepoprawny.');
  }
}

function zOznaczeniem(osoba) {
  return {
    ...osoba,
    oznaczenie: maskowanie.oznaczenieOsoby(osoba),
    jawny_identyfikator: maskowanie.jawnyIdentyfikator(osoba),
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
    sprawdzOsobe({ ...biezaca, ...dane });

    db()
      .prepare(
        `UPDATE psa_osoby
            SET ${Object.keys(dane).map((k) => `${k} = @${k}`).join(', ')},
                zaktualizowano = @zaktualizowano
          WHERE id = @id`
      )
      .run({ ...dane, id, zaktualizowano: czas.terazIso() });

    odp.json({ osoba: zOznaczeniem(db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(id)) });
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
