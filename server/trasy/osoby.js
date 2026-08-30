'use strict';

/**
 * Trasy `/api/psa/osoby/...` - kartoteka wspolna.
 *
 * Regula domenowa nr 10: jeden inwestor w wielu spolkach wpisywany RAZ.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');

const { db } = require('../baza');
const przepisy = require('../logika/przepisy');
const maskowanie = require('../logika/maskowanie');
const aml = require('../logika/aml');
const dziennikDostepu = require('../logika/dziennik-dostepu');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

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
        `SELECT s.id, s.nazwa, s.krs, s.status, s.stosuje_procedure_aml,
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

// ─────────────────────────────────────────────────────────────
// Skany dokumentow AML (etap 3.1) - domyslnie WYLACZONE (patrz migracja 28
// i psa_spolki.stosuje_procedure_aml). Skan jest przypisany do osoby
// (kartoteka wspolna), ale niesie spolka_id - procedura AML jest wlaczana
// PER SPOLKA, wiec upload jest dopuszczalny wylacznie, gdy WSKAZANA spolka
// ma przelacznik wlaczony.
// ─────────────────────────────────────────────────────────────

const ROZSZERZENIA_SKANU_AML_DOZWOLONE = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
const LIMIT_ROZMIARU_SKANU_AML_BAJTY = 20 * 1024 * 1024;
const TYPY_DOKUMENTU_AML = ['dowod_osobisty', 'paszport', 'inny'];

function katalogSkanowAml(osobaId) {
  return path.join(konfiguracja.KATALOG_DOKUMENTOW, 'aml', `osoba_${osobaId}`);
}

const uploadSkanuAml = multer({
  storage: multer.diskStorage({
    destination(zad, plik, wywolaj) {
      const katalog = katalogSkanowAml(Number(zad.params.id));
      fs.mkdirSync(katalog, { recursive: true });
      wywolaj(null, katalog);
    },
    filename(zad, plik, wywolaj) {
      const bezpiecznaNazwa = path.basename(plik.originalname).replace(/[^\w.\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu, '_');
      wywolaj(null, `${crypto.randomUUID()}-${bezpiecznaNazwa}`);
    },
  }),
  limits: { fileSize: LIMIT_ROZMIARU_SKANU_AML_BAJTY, files: 1 },
  fileFilter(zad, plik, wywolaj) {
    const rozszerzenie = path.extname(plik.originalname).toLowerCase();
    if (!ROZSZERZENIA_SKANU_AML_DOZWOLONE.has(rozszerzenie)) {
      return wywolaj(new Error(`Niedozwolone rozszerzenie pliku: „${rozszerzenie}”. Dozwolone: PDF, JPG, PNG.`));
    }
    wywolaj(null, true);
  },
});

/** Wymaga, zeby WSKAZANA spolka miala wlaczona procedure AML - inaczej upload skanu jest odmawiany. */
function wymagajProceduryAml(zad, odp, dalej) {
  const spolkaId = Number((zad.body && zad.body.spolka_id) || zad.query.spolka_id);
  if (!Number.isInteger(spolkaId)) return dalej(bledneZadanie('Wskaż spółkę (spolka_id), w kontekście której zbierany jest skan.'));
  const spolka = db().prepare('SELECT id, stosuje_procedure_aml FROM psa_spolki WHERE id = ?').get(spolkaId);
  if (!spolka) return dalej(nieZnaleziono('Nie odnaleziono spółki.'));
  if (!spolka.stosuje_procedure_aml) {
    return dalej(bledneZadanie('Ta spółka nie ma włączonej procedury AML — skany dokumentów nie są zbierane.'));
  }
  zad.psaSpolkaAml = spolka;
  dalej();
}

router.get(
  '/:id/aml-skany',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const warunki = ['osoba_id = ?'];
    const parametry = [id];
    if (zad.query.spolka_id) {
      warunki.push('spolka_id = ?');
      parametry.push(Number(zad.query.spolka_id));
    }
    const skany = db()
      .prepare(
        `SELECT id, spolka_id, typ_dokumentu, nazwa_pliku, rozmiar, retencja_do, wgral, utworzono
           FROM psa_osoby_skany_aml WHERE ${warunki.join(' AND ')} ORDER BY utworzono DESC`
      )
      .all(...parametry);
    odp.json({ skany });
  })
);

router.post(
  '/:id/aml-skany',
  // Kolejnosc: multer NAJPIERW (spolka_id jest polem formularza multipart -
  // zad.body jest puste, dopoki multer nie sparsuje strumienia; destynacja
  // pliku zalezy tylko od :id z URL, wiec walidacja procedury AML moze
  // bezpiecznie isc PO uploadzie - a gdy sie nie powiedzie, plik jest kasowany).
  (zad, odp, dalej) => uploadSkanuAml.single('plik')(zad, odp, (e) => (e ? dalej(bledneZadanie(e.message)) : dalej())),
  (zad, odp, dalej) => wymagajProceduryAml(zad, odp, (blad) => {
    if (blad && zad.file) fs.rm(zad.file.path, { force: true }, () => {});
    dalej(blad);
  }),
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    if (!db().prepare('SELECT id FROM psa_osoby WHERE id = ?').get(id)) throw nieZnaleziono('Nie odnaleziono osoby w kartotece.');
    if (!zad.file) throw bledneZadanie('Nie przesłano pliku.');
    const typDokumentu = String((zad.body || {}).typ_dokumentu || 'inny');
    if (!TYPY_DOKUMENTU_AML.includes(typDokumentu)) throw bledneZadanie(`Nieznany typ dokumentu: „${typDokumentu}”.`);
    const retencjaDo = (zad.body || {}).retencja_do || null;
    if (retencjaDo && !czas.poprawnaData(retencjaDo)) throw bledneZadanie('Data retencji musi mieć format RRRR-MM-DD.');

    const hash = crypto.createHash('sha256').update(fs.readFileSync(zad.file.path)).digest('hex');
    const wynik = db()
      .prepare(
        `INSERT INTO psa_osoby_skany_aml
           (osoba_id, spolka_id, typ_dokumentu, nazwa_pliku, sciezka, mime, rozmiar, hash, retencja_do, wgral, utworzono)
         VALUES (@osoba_id, @spolka_id, @typ_dokumentu, @nazwa_pliku, @sciezka, @mime, @rozmiar, @hash, @retencja_do, @wgral, @utworzono)`
      )
      .run({
        osoba_id: id,
        spolka_id: zad.psaSpolkaAml.id,
        typ_dokumentu: typDokumentu,
        nazwa_pliku: zad.file.originalname,
        sciezka: path.relative(konfiguracja.KATALOG_DOKUMENTOW, zad.file.path),
        mime: zad.file.mimetype,
        rozmiar: zad.file.size,
        hash,
        retencja_do: retencjaDo,
        wgral: autor(zad),
        utworzono: czas.terazIso(),
      });

    odp.status(201).json({
      skan: db().prepare('SELECT id, spolka_id, typ_dokumentu, nazwa_pliku, rozmiar, retencja_do, wgral, utworzono FROM psa_osoby_skany_aml WHERE id = ?').get(wynik.lastInsertRowid),
    });
  })
);

router.get(
  '/:id/aml-skany/:skanId/plik',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const skan = db().prepare('SELECT * FROM psa_osoby_skany_aml WHERE id = ? AND osoba_id = ?').get(Number(zad.params.skanId), id);
    if (!skan) throw nieZnaleziono('Nie odnaleziono skanu.');

    const pelnaSciezka = path.join(konfiguracja.KATALOG_DOKUMENTOW, skan.sciezka);
    if (!pelnaSciezka.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(pelnaSciezka)) {
      throw nieZnaleziono('Plik nie jest już dostępny.');
    }

    // Log dostepu do skanu - opis etapu 3.1 promptu ("log dostepu dla skanow").
    dziennikDostepu.zapisz(db(), {
      kto: autor(zad), typKto: 'pracownik', spolkaId: skan.spolka_id, osobaId: id,
      akcja: dziennikDostepu.AKCJE.POBRANIE_PLIKU, opis: `skan dokumentu AML: ${skan.nazwa_pliku}`,
    });

    odp.setHeader('Content-Type', skan.mime || 'application/octet-stream');
    odp.setHeader('Content-Disposition', `attachment; filename="${skan.nazwa_pliku}"`);
    fs.createReadStream(pelnaSciezka).pipe(odp);
  })
);

module.exports = router;
// Etap 3F: kancelaria materializuje akcjonariuszy proponowanych we wniosku
// klienta do kartoteki wspólnej - wnioski.js reużywa TĘ SAMĄ walidację
// (regula domenowa nr 10 - jeden inwestor wpisany raz - nie duplikujemy
// logiki, żeby wpis z wniosku nigdy nie ominął reguł, którym podlega
// wpis ręczny).
module.exports.POLA_OSOBY = POLA_OSOBY;
module.exports.sprawdzOsobe = sprawdzOsobe;
module.exports.ostrzezeniaOsoby = ostrzezeniaOsoby;
