'use strict';

/**
 * Trasy `/api/psa/spolki/...` - kancelaria.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');

const { db } = require('../baza');
const rejestr = require('../rejestr');
const widoki = require('../widoki');
const oplaty = require('../oplaty');
const przepisy = require('../logika/przepisy');
const u = require('../logika/ulamki');
const typyZdarzen = require('../logika/typy-zdarzen');
const wzoryDysk = require('../logika/wzory-dysk');
const docx = require('../logika/docx');
const kontekstPisma = require('../logika/kontekst-pisma');
const informacjaDokument = require('../logika/informacja-dokument');
const dziennikDostepu = require('../logika/dziennik-dostepu');
const konfiguracja = require('../konfiguracja');
const ustawienia = require('../logika/ustawienia');
const pliki = require('../pomocnicze/pliki');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono, dalejPoUploadzie } = require('../pomocnicze/odpowiedzi');
const { pobierzZKrs } = require('./krs');

const router = express.Router();

/** Pola spolki przyjmowane z formularza. */
const POLA_SPOLKI = [
  'krs', 'nip', 'regon', 'nazwa', 'forma_prawna', 'kraj', 'kod_pocztowy', 'miejscowosc',
  'ulica', 'nr_domu', 'nr_lokalu', 'sad_rejestrowy', 'wydzial', 'telefon', 'email', 'www',
  'status', 'komentarz_statusu', 'data_utworzenia_spolki', 'data_uchwaly_wyboru', 'data_umowy',
  // `data_otwarcia_rejestru` CELOWO nie jest tu (Z-019): ustawia sie WYLACZNIE
  // automatycznie, w chwili faktycznego otwarcia rejestru
  // (`POST /:id/otworz-rejestr`, ponizej) - swobodny formularz pozwalalby
  // wpisac ja przed pierwszym wpisem, co myli "otwarcie" z "planem otwarcia".
  'data_zakonczenia_umowy', 'opis', 'uwagi',
  // Etap 2.5 poprawek: data zawarcia umowy spolki (akt zalozycielski) - rozna
  // od daty rejestracji w KRS i od daty umowy o prowadzenie rejestru.
  'data_zawarcia_umowy_spolki',
  // Sprint 5 (zgodnosc z ustawa):
  'umowe_zawarl', 'umowe_zawarl_imie_nazwisko', 'dodatkowe_informacje_umowa_spolki',
  // Sesja 6, faza 3 (kreator rejestracji spolki - rozszerzony import KRS,
  // ograniczenia z umowy spolki bez wlasnego cyklu zycia w rejestrze):
  'kapital_akcyjny_grosze', 'adres_edorecze', 'sklad_organu_json',
  'zakaz_glosu_zastawnika_umowa', 'ograniczenie_dziedziczenia_umowa',
  // Reprezentant - wszystkie dane w MIANOWNIKU. Pisma nie odmieniaja ich
  // przez przypadki, tylko opisuja etykieta ("imiona rodzicow:", "dzialajacy
  // jako:"), wiec zadne pole korekty odmiany nie jest potrzebne.
  'reprezentant_imie_nazwisko', 'reprezentant_rodzice', 'reprezentant_pesel',
  'reprezentant_funkcja', 'reprezentant_reprezentacja', 'reprezentant_email',
  // B2/B3 (FAZA 2, migracja 53) — dowód i adres ustrukturyzowane. Stare
  // `reprezentant_dowod`/`reprezentant_adres` NIE są już w tej liście: nie
  // da się ich nadpisać z formularza, zostają tylko do odczytu w piśmie
  // (`server/logika/kontekst-pisma.js`), dopóki nie zastąpią ich te pola.
  'reprezentant_dowod_rodzaj', 'reprezentant_dowod_numer',
  'reprezentant_kraj', 'reprezentant_kod_pocztowy', 'reprezentant_miejscowosc',
  'reprezentant_ulica', 'reprezentant_nr_domu', 'reprezentant_nr_lokalu',
  // Etap 2.2 poprawek: umowa jako fakt juz zaistnialy (data zawarcia to juz
  // istniejace 'data_umowy'). Zalacznik NIE jest tu - ma dedykowany
  // endpoint uploadu, zeby nie przyjmowac dowolnej sciezki z ciala JSON.
  'umowa_sposob_zawarcia',
  // Sesja 8, blok A3 (kontekst automatu pism):
  'organ_rodzaj',
  // Etap 3.1: przelacznik procedury AML, wylaczony domyslnie (migracja 28).
  'stosuje_procedure_aml',
];

/** Pola, ktorych zmiana jest zdarzeniem rejestrowym (art. 300(33) § 1 KSH). */
const POLA_REJESTROWE = [
  'krs', 'nip', 'regon', 'nazwa', 'kraj', 'kod_pocztowy', 'miejscowosc', 'ulica',
  'nr_domu', 'nr_lokalu', 'sad_rejestrowy', 'wydzial',
  // art. 300(33) § 2 KSH - dodatkowe postanowienia umowy spolki o informacjach
  // ujawnianych w rejestrze SA trescia rejestru. `umowe_zawarl*` NIE sa (to
  // fakt administracyjny o zawarciu umowy o PROWADZENIE rejestru, art.
  // 300(32) § 1(2) KSH - analogicznie do `data_umowy`, ktore tez nie jest
  // POLE_REJESTROWE).
  'dodatkowe_informacje_umowa_spolki',
];

/**
 * Naprawa Z-009/P-005 — `data_umowy`/`umowe_zawarl*` NIE sa trescia rejestru
 * (patrz komentarz przy POLA_REJESTROWE), wiec ich zmiana nie idzie przez
 * `zmiana_danych_spolki` w tym samym trybie co art. 300(33) KSH. Ale gdy
 * rejestr jest juz OTWARTY (`data_otwarcia_rejestru` ustawione — Z-019,
 * naprawa Z-108), te pola opisuja fakt juz wykorzystany do otwarcia: cicha
 * podmiana bez sladu wygladalaby, jakby rejestr powstal na podstawie innej
 * umowy, niz naprawde. Po otwarciu ich zmiana wiec TEZ zostawia zdarzenie -
 * przed otwarciem to nadal zwykla korekta roboczego formularza (kreator).
 */
const POLA_UMOWY_PO_OTWARCIU = ['data_umowy', 'umowe_zawarl', 'umowe_zawarl_imie_nazwisko'];

function wyczysc(cialo) {
  const wynik = {};
  for (const pole of POLA_SPOLKI) {
    if (cialo[pole] === undefined) continue;
    if (pole === 'stosuje_procedure_aml') {
      wynik[pole] = cialo[pole] ? 1 : 0;
      continue;
    }
    const v = cialo[pole];
    wynik[pole] = v === '' || v === null ? null : String(v).trim();
  }
  return wynik;
}

// Naprawa Z-354: nazwa bez limitu dlugosci psula uklad pulpitu, listy
// spolek i kolejki spraw (test brzegowy - 300 znakow, brak dowolnego
// text-overflow/skracania w tabelach). Realne firmy spolek prawa
// handlowego rzadko przekraczaja 200 znakow.
const DLUGOSC_NAZWY_SPOLKI_MAX = 200;

function sprawdzDaneSpolki(dane, { wymaganaNazwa = true } = {}) {
  if (wymaganaNazwa && !dane.nazwa) {
    throw bledneZadanie('Nazwa spółki jest wymagana.');
  }
  if (dane.nazwa && dane.nazwa.length > DLUGOSC_NAZWY_SPOLKI_MAX) {
    throw bledneZadanie(`Nazwa spółki jest za długa (maksymalnie ${DLUGOSC_NAZWY_SPOLKI_MAX} znaków).`);
  }
  if (dane.krs && !/^\d{10}$/.test(dane.krs)) {
    throw bledneZadanie('Numer KRS składa się z 10 cyfr.');
  }
  if (dane.nip && !/^\d{10}$/.test(String(dane.nip).replace(/[\s-]/g, ''))) {
    throw bledneZadanie('NIP składa się z 10 cyfr.');
  }
  for (const pole of [
    'data_utworzenia_spolki', 'data_uchwaly_wyboru', 'data_umowy',
    'data_zakonczenia_umowy', 'data_zawarcia_umowy_spolki',
  ]) {
    if (dane[pole] && !czas.poprawnaData(dane[pole])) {
      throw bledneZadanie(`Pole „${pole}” musi być datą w formacie RRRR-MM-DD.`);
    }
  }
  // Naprawa Z-008: spolka wybiera notariusza UCHWALA, dopiero potem z nim
  // zawiera umowe o prowadzenie rejestru - uchwala nie moze byc pozniejsza
  // niz sama umowa. Sprawdzamy tylko, gdy obie daty sa znane (formularz
  // uzupelnia je stopniowo, w kreatorze i pozniej).
  if (dane.data_uchwaly_wyboru && dane.data_umowy && dane.data_uchwaly_wyboru > dane.data_umowy) {
    throw bledneZadanie(
      `Data uchwały o wyborze notariusza (${dane.data_uchwaly_wyboru}) nie może być późniejsza ` +
        `niż data umowy o prowadzenie rejestru (${dane.data_umowy}).`
    );
  }
  if (dane.status && !Object.values(przepisy.STATUSY_SPOLKI).includes(dane.status)) {
    throw bledneZadanie(`Nieznany status spółki: „${dane.status}”.`);
  }
  if (dane.umowe_zawarl && !przepisy.UMOWE_ZAWARL.includes(dane.umowe_zawarl)) {
    throw bledneZadanie(`Pole „umowe_zawarl” musi być jedną z wartości: ${przepisy.UMOWE_ZAWARL.join(', ')}.`);
  }
  if (
    dane.umowa_sposob_zawarcia &&
    !['pisemna', 'elektroniczna_kwalifikowany'].includes(dane.umowa_sposob_zawarcia)
  ) {
    throw bledneZadanie('Sposób zawarcia umowy musi być „pisemna” albo „elektroniczna_kwalifikowany”.');
  }
  if (
    dane.zakaz_glosu_zastawnika_umowa &&
    !['zakazane', 'wymaga_zgody_organu'].includes(dane.zakaz_glosu_zastawnika_umowa)
  ) {
    throw bledneZadanie('Pole „zakaz_glosu_zastawnika_umowa” musi być: zakazane albo wymaga_zgody_organu.');
  }
  // Regula domenowa nr 11 - rejestru nie prowadzimy dla S.A. ani S.K.A.
  if (dane.forma_prawna !== undefined) {
    const ocena = przepisy.ocenFormePrawna(dane.forma_prawna);
    if (!ocena.dozwolona) throw bledneZadanie(ocena.powod);
  }
  if (dane.organ_rodzaj && !['zarzad', 'rada_dyrektorow'].includes(dane.organ_rodzaj)) {
    throw bledneZadanie('Rodzaj organu musi być „zarzad” albo „rada_dyrektorow”.');
  }
}

// ─────────────────────────────────────────────────────────────

/** Lista spolek z licznikami do pulpitu i wyszukiwarki. */
router.get(
  '/',
  asy((zad, odp) => {
    const warunki = [];
    const parametry = [];

    const szukaj = String(zad.query.q || '').trim();
    if (szukaj) {
      warunki.push('(s.nazwa LIKE ? OR s.krs LIKE ? OR s.nip LIKE ?)');
      parametry.push(`%${szukaj}%`, `%${szukaj}%`, `%${szukaj}%`);
    }
    if (zad.query.status) {
      warunki.push('s.status = ?');
      parametry.push(String(zad.query.status));
    }

    const gdzie = warunki.length ? `WHERE ${warunki.join(' AND ')}` : '';
    const wiersze = db()
      .prepare(
        `SELECT s.*,
                (SELECT COUNT(DISTINCT sa.osoba_id) FROM psa_stan_akcji sa
                  WHERE sa.spolka_id = s.id AND sa.data_do IS NULL
                    AND sa.kategoria = 'akcjonariusz')                 AS liczba_akcjonariuszy,
                (SELECT COALESCE(SUM(sa.ilosc), 0) FROM psa_stan_akcji sa
                  WHERE sa.spolka_id = s.id AND sa.data_do IS NULL
                    AND sa.kategoria = 'akcjonariusz')                 AS liczba_akcji,
                (SELECT COUNT(*) FROM psa_emisje e WHERE e.spolka_id = s.id) AS liczba_emisji,
                (SELECT MAX(z.data_wpisu) FROM psa_zdarzenia z
                  WHERE z.spolka_id = s.id)                            AS ostatnie_zdarzenie,
                (SELECT COUNT(*) FROM psa_zdarzenia z WHERE z.spolka_id = s.id) AS liczba_zdarzen
           FROM psa_spolki s
           ${gdzie}
          ORDER BY s.nazwa COLLATE NOCASE`
      )
      .all(...parametry);

    odp.json({ spolki: wiersze });
  })
);

/** Pobranie danych z otwartego API KRS. Blad -> 200 z pustym wynikiem. */
router.get(
  '/z-krs/:numer',
  asy(async (zad, odp) => {
    const numer = String(zad.params.numer || '').replace(/\D/g, '');
    if (numer.length !== 10) {
      return odp.json({
        znaleziono: false,
        komunikat: 'Numer KRS składa się z 10 cyfr. Uzupełnij dane ręcznie.',
      });
    }
    const wynik = await pobierzZKrs(numer);
    odp.json(wynik);
  })
);

/** Dodanie spolki. */
router.post(
  '/',
  asy((zad, odp) => {
    const dane = wyczysc(zad.body || {});
    if (dane.forma_prawna === undefined) dane.forma_prawna = przepisy.FORMA_PRAWNA_WYMAGANA;
    sprawdzDaneSpolki(dane);

    const teraz = czas.terazIso();
    const kolumny = Object.keys(dane);
    const wynik = db()
      .prepare(
        `INSERT INTO psa_spolki (${kolumny.join(', ')}, utworzono)
         VALUES (${kolumny.map((k) => `@${k}`).join(', ')}, @utworzono)`
      )
      .run({ ...dane, utworzono: teraz });

    odp.status(201).json({
      spolka: db().prepare('SELECT * FROM psa_spolki WHERE id = ?').get(wynik.lastInsertRowid),
    });
  })
);

// ─────────────────────────────────────────────────────────────
// Zalacznik do umowy o prowadzenie rejestru (etap 2.2 poprawek) - skan/plik
// JUZ ZAWARTEJ umowy, nie dokument tworzony w tej aplikacji. Jeden plik na
// spolke (nadpisywalny), poza katalogiem publicznym jak reszta dokumentow.
// ─────────────────────────────────────────────────────────────

const ROZSZERZENIA_UMOWY_DOZWOLONE = new Set(['.pdf']);
const LIMIT_ROZMIARU_UMOWY_BAJTY = 20 * 1024 * 1024;

function katalogUmowySpolki(spolkaId) {
  return path.join(konfiguracja.KATALOG_DOKUMENTOW, `spolka_${spolkaId}`, 'umowa-rejestru');
}

const uploadUmowy = multer({
  storage: multer.diskStorage({
    destination(zad, plik, wywolaj) {
      const katalog = katalogUmowySpolki(Number(zad.params.id));
      fs.mkdirSync(katalog, { recursive: true });
      wywolaj(null, katalog);
    },
    filename(zad, plik, wywolaj) {
      const bezpiecznaNazwa = path.basename(plik.originalname).replace(/[^\w.\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu, '_');
      wywolaj(null, `${crypto.randomUUID()}-${bezpiecznaNazwa}`);
    },
  }),
  limits: { fileSize: LIMIT_ROZMIARU_UMOWY_BAJTY, files: 1 },
  fileFilter(zad, plik, wywolaj) {
    const rozszerzenie = path.extname(plik.originalname).toLowerCase();
    if (!ROZSZERZENIA_UMOWY_DOZWOLONE.has(rozszerzenie)) {
      return wywolaj(new Error(`Niedozwolone rozszerzenie pliku: „${rozszerzenie}”. Dozwolony wyłącznie PDF.`));
    }
    wywolaj(null, true);
  },
});

router.post(
  '/:id/umowa-zalacznik',
  // Naprawa Z-254: blad multera idzie nieopakowany, zeby zadzialala
  // przetlumaczona galaz "MulterError"; blad z fileFilter (juz po polsku)
  // staje sie 400, a nie ogolnym 500.
  (zad, odp, dalej) => uploadUmowy.single('plik')(zad, odp, dalejPoUploadzie(dalej)),
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const spolka = db().prepare('SELECT id FROM psa_spolki WHERE id = ?').get(id);
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
    if (!zad.file) throw bledneZadanie('Nie przesłano pliku.');
    // Naprawa Z-253: rozszerzenie to obietnica klienta — sprawdzamy tresc
    // pliku po sygnaturze (audyt: HTML ze <script> nazwany „.pdf" byl
    // przyjmowany jako zalacznik umowy spolki na tej trasie).
    if (!pliki.trescPasuje(zad.file.path, pliki.typZNazwy(zad.file.originalname))) {
      fs.rmSync(zad.file.path, { force: true });
      throw bledneZadanie(`Treść pliku „${zad.file.originalname}" nie odpowiada jego rozszerzeniu. Prześlij plik PDF.`);
    }

    db()
      .prepare(
        `UPDATE psa_spolki
            SET umowa_zalacznik_sciezka = ?, umowa_zalacznik_nazwa_pliku = ?, umowa_zalacznik_mime = ?
          WHERE id = ?`
      )
      .run(
        path.relative(konfiguracja.KATALOG_DOKUMENTOW, zad.file.path),
        zad.file.originalname,
        zad.file.mimetype,
        id
      );

    odp.status(201).json({ nazwa_pliku: zad.file.originalname });
  })
);

router.get(
  '/:id/umowa-zalacznik',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const spolka = db()
      .prepare('SELECT umowa_zalacznik_sciezka, umowa_zalacznik_nazwa_pliku, umowa_zalacznik_mime FROM psa_spolki WHERE id = ?')
      .get(id);
    if (!spolka || !spolka.umowa_zalacznik_sciezka) throw nieZnaleziono('Nie odnaleziono załącznika umowy.');

    const pelnaSciezka = path.join(konfiguracja.KATALOG_DOKUMENTOW, spolka.umowa_zalacznik_sciezka);
    if (!pelnaSciezka.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(pelnaSciezka)) {
      throw nieZnaleziono('Plik nie jest już dostępny.');
    }

    dziennikDostepu.zapisz(db(), {
      kto: autor(zad), typKto: 'pracownik', spolkaId: id,
      akcja: dziennikDostepu.AKCJE.POBRANIE_PLIKU, opis: `załącznik umowy o prowadzenie rejestru: ${spolka.umowa_zalacznik_nazwa_pliku}`,
    });

    pliki.naglowkiPliku(odp, { nazwaPliku: spolka.umowa_zalacznik_nazwa_pliku, wRamce: false });
    fs.createReadStream(pelnaSciezka).pipe(odp);
  })
);

/**
 * K2 (FAZA 3 sesji frontendowej v2): akcjonariusze przyjętego wniosku, z
 * którego ta spółka powstała — kreator otwarcia rejestru (krok „Pierwsza
 * emisja") podstawia ich jako pozycje objęcia, żeby pracownik nie wybierał
 * ich drugi raz z kartoteki (0.4 pkt 1 — „raz wpisane, nigdy więcej"; te
 * same osoby zostały tam już założone/dopasowane przy `POST
 * /wnioski/:id/przyjmij`). Bez liczby akcji ani ceny (D-053) — to wpisuje
 * kancelaria z umowy spółki.
 */
router.get(
  '/:id/wniosek-akcjonariusze',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const wniosek = db()
      .prepare(`SELECT id FROM psa_wnioski WHERE spolka_id = ? AND status = 'przyjety' ORDER BY id DESC LIMIT 1`)
      .get(id);
    if (!wniosek) return odp.json({ akcjonariusze: [] });
    const maskowanie = require('../logika/maskowanie');
    const wiersze = db()
      .prepare(
        `SELECT o.* FROM psa_wnioski_akcjonariusze a
           JOIN psa_osoby o ON o.id = a.osoba_id
          WHERE a.wniosek_id = ? AND a.osoba_id IS NOT NULL`
      )
      .all(wniosek.id);
    odp.json({
      akcjonariusze: wiersze.map((o) => ({ osoba_id: o.id, oznaczenie: maskowanie.oznaczenieOsoby(o) })),
    });
  })
);

/**
 * Kokpit spolki - jeden ekran: stan na dzis + historia + liczniki.
 * `?data=` przyjmuje `RRRR-MM-DD` (koniec dnia) albo `RRRR-MM-DDTGG:MM[:SS]`
 * (dokladnosc do minuty, po `data_wpisu` - sekcja 2.3 sesji interfejsowej).
 */
router.get(
  '/:id',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    if (zad.query.data && !czas.poprawnaDataAlboChwila(zad.query.data)) {
      throw bledneZadanie('Parametr „data” musi mieć format RRRR-MM-DD albo RRRR-MM-DDTGG:MM.');
    }
    const stan = widoki.widokStanu(db(), id, zad.query.data);
    if (!stan) throw nieZnaleziono('Nie odnaleziono spółki.');

    odp.json({
      ...stan,
      zdarzenia: widoki.widokZdarzen(db(), id, { limit: 12 }),
      liczba_zdarzen: db()
        .prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia WHERE spolka_id = ?')
        .get(id).ile,
      typy_zdarzen: typyZdarzen.dostepneWKreatorze(),
    });
  })
);

router.put(
  '/:id',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const kto = autor(zad);
    const biezaca = rejestr.wczytajSpolke(db(), id);
    if (!biezaca) throw nieZnaleziono('Nie odnaleziono spółki.');

    const dane = wyczysc(zad.body || {});
    sprawdzDaneSpolki({ ...biezaca, ...dane }, { wymaganaNazwa: true });

    const zmienione = Object.keys(dane).filter(
      (pole) => String(biezaca[pole] ?? '') !== String(dane[pole] ?? '')
    );
    if (zmienione.length === 0) {
      return odp.json({ spolka: biezaca, zdarzenie: null, komunikat: 'Brak zmian do zapisania.' });
    }

    const transakcja = db().transaction(() => {
      db()
        .prepare(
          `UPDATE psa_spolki
              SET ${Object.keys(dane).map((k) => `${k} = @${k}`).join(', ')},
                  zaktualizowano = @zaktualizowano
            WHERE id = @id`
        )
        .run({ ...dane, id, zaktualizowano: czas.terazIso() });

      // Zdarzenie zapisujemy dla pol bedacych trescia rejestru (art. 300(33)
      // KSH), a takze - Z-009/P-005 - dla danych umowy o prowadzenie
      // rejestru, gdy rejestr jest juz otwarty (patrz POLA_UMOWY_PO_OTWARCIU
      // wyzej). Zmiana wewnetrznych `uwagi` ani korekta danych umowy PRZED
      // otwarciem nie zostawia zdarzenia - to jeszcze robocza edycja.
      const rejestrowe = zmienione.filter((p) => POLA_REJESTROWE.includes(p));
      const umowaPoOtwarciu = biezaca.data_otwarcia_rejestru
        ? zmienione.filter((p) => POLA_UMOWY_PO_OTWARCIU.includes(p))
        : [];
      const doZdarzenia = [...rejestrowe, ...umowaPoOtwarciu];
      if (doZdarzenia.length === 0) return null;

      return rejestr.zapiszZdarzenie(db(), {
        spolka_id: id,
        typ: 'zmiana_danych_spolki',
        autor: kto,
        dane: {
          przed: Object.fromEntries(doZdarzenia.map((p) => [p, biezaca[p] ?? null])),
          po: Object.fromEntries(doZdarzenia.map((p) => [p, dane[p] ?? null])),
          zmienione_pola: doZdarzenia,
          podstawa_opis: zad.body?.podstawa_opis || null,
        },
      });
    });

    const zdarzenie = transakcja.immediate();
    odp.json({
      spolka: db().prepare('SELECT * FROM psa_spolki WHERE id = ?').get(id),
      zdarzenie,
      zmienione_pola: zmienione,
    });
  })
);

/**
 * Eksport ROBOCZY akcjonariatu do CSV (faza 4).
 *
 * Świadomie CSV, nie XLSX: master zabrania nowych zależności, a złożenie
 * arkusza XLSX bez biblioteki oznacza ręczne budowanie archiwum ZIP z kilkoma
 * dokumentami XML - nieproporcjonalnie dużo kodu do utrzymania jak na eksport
 * pomocniczy. CSV z BOM otwiera się w Excelu bez ustawień.
 *
 * Pierwszy wiersz pliku niesie ZASTRZEŻENIE, że eksport nie jest informacją
 * z rejestru w rozumieniu art. 300(35) KSH. Ma być widoczne od razu po
 * otwarciu, bo arkusz wygląda jak dokument i bywa dalej przesyłany.
 */
router.get(
  '/:id/stan.csv',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const data = zad.query.data ? String(zad.query.data) : czas.dzisIso();
    if (!czas.poprawnaDataAlboChwila(data)) {
      throw bledneZadanie('Parametr „data” musi mieć format RRRR-MM-DD albo RRRR-MM-DDTGG:MM.');
    }

    const stan = widoki.widokStanu(db(), id, data, {
      rola: przepisy.ROLE_ODBIORCY.KANCELARIA,
      odbiorcaOsobaId: null,
    });
    if (!stan) throw nieZnaleziono('Nie odnaleziono spółki.');

    // Wyniesienie danych calego akcjonariatu z systemu - blok D4, zakres WASKI.
    dziennikDostepu.zapisz(db(), {
      kto: autor(zad), typKto: 'pracownik', spolkaId: id,
      akcja: dziennikDostepu.AKCJE.EKSPORT, opis: `eksport CSV — stan na ${data}`,
    });

    const pole = (w) => {
      const t = String(w == null ? '' : w);
      return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };

    const linie = [
      [
        'UWAGA: eksport roboczy. Nie stanowi informacji z rejestru akcjonariuszy ' +
          'w rozumieniu art. 300(35) Kodeksu spolek handlowych.',
      ].map(pole).join(','),
      [`Spolka: ${stan.spolka.nazwa}`, `KRS: ${stan.spolka.krs || ''}`, `Stan na: ${data}`]
        .map(pole).join(','),
      '',
      ['lp', 'akcjonariusz', 'identyfikator', 'seria', 'liczba_akcji', 'numery', 'udzial_procent', 'obciazenia', 'czesci_ulamkowe']
        .join(','),
    ];

    stan.akcjonariusze.forEach((a, i) => {
      linie.push(
        [
          i + 1,
          a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`,
          (a.osoba && a.osoba.jawny_identyfikator) || '',
          a.seria,
          // Naprawa Z-057: pozycja z ulamkowo wspoluprawnionym numerem
          // pokazuje dokladny ulamek ("2 i 1/3"), nie lossy decimal.
          u.opiszLiczbeAkcji(a.ilosc, a.udzial_ulamek),
          a.numery,
          // Naprawa Z-051: zaokraglenie do 2 miejsc, tak jak w informacji
          // z rejestru (`logika/informacja-dokument.js: procent()`).
          a.procent == null ? '' : Number(a.procent).toFixed(2),
          a.obciazenia
            .map((o) => `${o.typ === 'zajecie' ? 'zajecie' : o.typ} ${o.numery}`)
            .join('; '),
          (a.czesci_ulamkowe || [])
            .map((fr) => `${fr.czesc_licznik}/${fr.czesc_mianownik} akcji nr ${fr.nr}`)
            .join('; '),
        ].map(pole).join(',')
      );
    });

    linie.push('');
    linie.push([`Razem akcji: ${stan.razem_akcji}`].map(pole).join(','));

    const BOM = '﻿';
    odp.setHeader('Content-Type', 'text/csv; charset=utf-8');
    odp.setHeader(
      'Content-Disposition',
      `attachment; filename="rejestr-roboczy-${id}-${String(data).slice(0, 10)}.csv"`
    );
    odp.send(BOM + linie.join('\n'));
  })
);

/**
 * Stan akcjonariatu na dowolny dzien albo chwile, z maskowaniem wg roli
 * odbiorcy. `?data=` — patrz komentarz przy `GET /:id`.
 */
router.get(
  '/:id/stan',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const data = zad.query.data ? String(zad.query.data) : czas.dzisIso();
    if (!czas.poprawnaDataAlboChwila(data)) {
      throw bledneZadanie('Parametr „data” musi mieć format RRRR-MM-DD albo RRRR-MM-DDTGG:MM.');
    }

    const rola = String(zad.query.rola || przepisy.ROLE_ODBIORCY.KANCELARIA);
    if (!Object.values(przepisy.ROLE_ODBIORCY).includes(rola)) {
      throw bledneZadanie(`Nieznana rola odbiorcy: „${rola}”.`);
    }
    const odbiorca = zad.query.odbiorca ? Number(zad.query.odbiorca) : null;

    const stan = widoki.widokStanu(db(), id, data, { rola, odbiorcaOsobaId: odbiorca });
    if (!stan) throw nieZnaleziono('Nie odnaleziono spółki.');
    odp.json(stan);
  })
);

/**
 * Informacja z rejestru akcjonariuszy (art. 300(35) KSH) jako gotowy
 * dokument HTML — TEN SAM, ktory dostaje klient w portalu.
 *
 * Ekran kancelarii mial wlasny render tego pisma w Reakcie
 * (`publiczne/js/wydruk.js`), a klient dostawal wersje generowana na
 * serwerze: dwa kody, jeden dokument ustawowy, wiec kazda poprawka tresci
 * musiala trafic w oba albo notariusz podpisywal co innego, niz widzial
 * klient. Zostaje jeden generator; ekran tylko pokazuje jego wynik.
 *
 * Nic nie zapisuje i nic nie nalicza — to podglad wewnetrzny na tych samych
 * danych, co `GET /:id/stan`. Odplatne wydanie dokumentu klientowi idzie
 * przez portal (`POST /api/psa/portal/informacja`).
 */
router.get(
  '/:id/informacja.html',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const data = zad.query.data ? String(zad.query.data) : czas.dzisIso();
    if (!czas.poprawnaDataAlboChwila(data)) {
      throw bledneZadanie('Parametr „data” musi mieć format RRRR-MM-DD albo RRRR-MM-DDTGG:MM.');
    }

    const rola = String(zad.query.rola || przepisy.ROLE_ODBIORCY.KANCELARIA);
    if (!Object.values(przepisy.ROLE_ODBIORCY).includes(rola)) {
      throw bledneZadanie(`Nieznana rola odbiorcy: „${rola}”.`);
    }
    const odbiorcaId = zad.query.odbiorca ? Number(zad.query.odbiorca) : null;

    const stan = widoki.widokStanu(db(), id, data, { rola, odbiorcaOsobaId: odbiorcaId });
    if (!stan) throw nieZnaleziono('Nie odnaleziono spółki.');

    // Przy roli „akcjonariusz” i „organ” dokument nazywa KONKRETNEGO
    // odbiorce: „akcjonariusz” bez nazwiska nie mowi, komu wydano pismo,
    // a przy organie liczy sie, czy pyta sad, czy komornik.
    const wybrany = odbiorcaId
      ? stan.akcjonariusze.find((a) => String(a.osoba_id) === String(odbiorcaId))
      : null;
    const opis = rola === przepisy.ROLE_ODBIORCY.AKCJONARIUSZ && wybrany && wybrany.osoba
      ? wybrany.osoba.oznaczenie
      : (rola === przepisy.ROLE_ODBIORCY.ORGAN && zad.query.organ ? String(zad.query.organ) : null);

    odp.type('text/html').send(informacjaDokument.informacjaZRejestru({
      kancelaria: ustawienia.kancelaria(db()),
      spolka: stan.spolka,
      data,
      stan,
      odbiorca: { rola, opis },
      sporzadzono: czas.terazIso(),
    }));
  })
);

/** Pelna historia zdarzen. */
router.get(
  '/:id/zdarzenia',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    if (!rejestr.wczytajSpolke(db(), id)) throw nieZnaleziono('Nie odnaleziono spółki.');
    odp.json({ zdarzenia: widoki.widokZdarzen(db(), id) });
  })
);

/** Podglad zdarzenia - krok 4 kreatora. Nic nie zapisuje. */
router.post(
  '/:id/zdarzenia/podglad',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    rejestr.odrzucRecznaDate(zad.body);
    const { typ, dane, migracja_krn: migracjaKrn } = zad.body || {};
    if (!typ) throw bledneZadanie('Nie wskazano typu zdarzenia.');

    let podglad;
    try {
      podglad = rejestr.przygotujPodglad(db(), {
        spolkaId: id,
        typ,
        wejscie: dane || {},
        migracja_krn: migracjaKrn || null,
      });
    } catch (e) {
      // Blad kreatora (np. brak pokrycia) tez jest wynikiem podgladu -
      // uzytkownik ma go zobaczyc w kroku 4, a nie dostac 500.
      if (['BladKreatora', 'BladZakresu', 'BladStanu'].includes(e.name)) {
        return odp.json({
          dopuszczalne: false,
          bledy: [e.message],
          ostrzezenia: [],
          dane: null,
          przed: null,
          po: null,
        });
      }
      throw e;
    }

    odp.json({
      dopuszczalne: podglad.dopuszczalne,
      bledy: podglad.bledy,
      ostrzezenia: podglad.ostrzezenia,
      dane: podglad.dane,
      typ: typyZdarzen.typ(typ),
      przed: tabelaAkcjonariatu(podglad.stanPrzed, podglad.osoby, db(), id),
      po: podglad.stanPo ? tabelaAkcjonariatu(podglad.stanPo, podglad.osoby, db(), id) : null,
    });
  })
);

/**
 * DOKONANIE WPISU. Sprint 1 nie ma jeszcze workflow spraw - w sprincie 2
 * ta sciezka zostanie opakowana przez `POST /api/psa/sprawy/:id/wpisz`
 * (transakcja: zdarzenie + materializacja + dokumenty + oplata).
 */
router.post(
  '/:id/zdarzenia',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const kto = autor(zad);
    rejestr.odrzucRecznaDate(zad.body);
    const { typ, dane, uzasadnienie, migracja_krn: migracjaKrn } = zad.body || {};
    if (!typ) throw bledneZadanie('Nie wskazano typu zdarzenia.');

    const wynik = rejestr.dokonajWpisu(db(), {
      spolkaId: id,
      typ,
      migracja_krn: migracjaKrn || null,
      wejscie: dane || {},
      autor: kto,
      uzasadnienie: uzasadnienie || null,
    });

    odp.status(201).json({
      zdarzenie: {
        id: wynik.zdarzenie.id,
        typ: wynik.zdarzenie.typ,
        data_wpisu: wynik.zdarzenie.data_wpisu,
        autor: wynik.zdarzenie.autor,
        hash_skrocony: wynik.zdarzenie.hash.slice(0, 12),
      },
      ostrzezenia: wynik.ostrzezenia,
      dokumenty_do_wygenerowania: wynik.typ.dokumenty || [],
      odplatne: wynik.typ.odplatne,
    });
  })
);

/**
 * Kody checklisty otwarcia rejestru - MUSZA byc zgodne z `CHECKLISTA_OTWARCIA`
 * w `publiczne/js/spolki.js` (tresc jest wylacznie po stronie UI, tu liczy
 * sie tylko zestaw kodow). Naprawa Z-200/Z-201/Z-204: checklista gasila
 * wylacznie przycisk w przegladarce - zadanie wyslane wprost na API omijalo
 * ja calkowicie. Pozycja „aml" jest tu traktowana tak samo jak pozostale
 * dziewiec: wymagane jest SWIADOME odhaczenie, zgodnie z P-013 to NIE jest
 * blokada na podstawie wyniku AML (ktorego system i tak nie ocenia), tylko
 * wymog, zeby pracownik nie pominal tego kroku, otwierajac rejestr wprost
 * przez API z pominieciem kreatora.
 */
const KODY_CHECKLISTY_OTWARCIA = [
  'forma', 'wpis_krs', 'uchwala', 'umowa', 'jedna_umowa',
  'dane_z_umowy', 'ograniczenia', 'bilans', 'zakres_danych', 'aml',
];

function sprawdzChecklisteOtwarcia(checklista) {
  const brakujace = KODY_CHECKLISTY_OTWARCIA.filter((kod) => !(checklista && checklista[kod]));
  if (brakujace.length > 0) {
    throw bledneZadanie(
      `Checklista otwarcia rejestru nie jest kompletna (brakuje: ${brakujace.join(', ')}).`
    );
  }
}

/**
 * OTWARCIE REJESTRU (sesja 6, faza 3, krok 4 kreatora rejestracji spolki).
 * Zapisuje KOMPLET zdarzen zalozycielskich (emisja, objecie, opcjonalnie
 * ograniczenie z umowy spolki) w jednej transakcji - patrz
 * `rejestr.otworzRejestr`. Spolka musi juz istniec (krok 1-2 zapisuja ja
 * przez `POST /`) - ta trasa dotyczy WYLACZNIE poczatkowego stanu akcji,
 * nie danych samej spolki.
 *
 * Naprawa Z-108/P-007: to jest TA sama „chwila otwarcia rejestru" dla obu
 * sciezek onboardingu (kreator wewnetrzny i przyjecie wniosku z portalu) -
 * spolka zalozona przez portal tez konczy zakladanie akcji TUTAJ (patrz
 * naglowek `trasy/wnioski.js`), wiec to jedyne miejsce, w ktorym rejestr
 * FAKTYCZNIE zaczyna istniec (ma jakiekolwiek akcje). Oplata za pierwszy
 * rok prowadzenia i za pierwszy wpis naliczana jest wiec WYLACZNIE tu,
 * jednym zadaniem, identycznie dla kazdej spolki — bez wzgledu na to, ktora
 * sciezka ja tu doprowadzila.
 */
router.post(
  '/:id/otworz-rejestr',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const spolka = rejestr.wczytajSpolke(db(), id);
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
    const kto = autor(zad);
    sprawdzChecklisteOtwarcia(zad.body && zad.body.checklista);
    const zdarzenia = Array.isArray(zad.body && zad.body.zdarzenia) ? zad.body.zdarzenia : [];
    if (zdarzenia.length === 0) {
      throw bledneZadanie('Otwarcie rejestru wymaga co najmniej jednego zdarzenia (emisji).');
    }
    for (const z of zdarzenia) {
      if (!z || !z.typ) throw bledneZadanie('Każde zdarzenie otwarcia rejestru musi mieć typ.');
      rejestr.odrzucRecznaDate(z);
    }

    const dzis = czas.dzisIso();
    const wyniki = rejestr.otworzRejestr(db(), id, {
      zdarzenia,
      autor: kto,
    });

    // Rok prowadzenia biegnie od dnia, w ktorym rejestr faktycznie rusza
    // (§ 15b pkt 1 rozporzadzenia: "za kazdy rozpoczety rok") - tym dniem
    // jest DZIS, chyba ze pole bylo juz wczesniej recznie wypelnione.
    const dataOtwarcia = spolka.data_otwarcia_rejestru || dzis;
    if (!spolka.data_otwarcia_rejestru) {
      db().prepare('UPDATE psa_spolki SET data_otwarcia_rejestru = ? WHERE id = ?').run(dzis, id);
    }
    const { prowadzenie, wpis } = oplaty.naliczOtwarcieRejestru(db(), {
      spolkaId: id,
      dataOtwarcia,
      autor: kto,
    });

    odp.status(201).json({
      zdarzenia: wyniki.map((w) => ({
        id: w.zdarzenie.id,
        typ: w.zdarzenie.typ,
        data_wpisu: w.zdarzenie.data_wpisu,
        hash_skrocony: w.zdarzenie.hash.slice(0, 12),
      })),
      oplata_prowadzenia: prowadzenie.utworzono ? prowadzenie.oplata : null,
      oplata_wpisu: wpis.utworzono ? wpis.oplata : null,
    });
  })
);

/** Odbudowa materializacji ze zdarzen (regula domenowa nr 2). */
router.post(
  '/:id/przelicz',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    if (!rejestr.wczytajSpolke(db(), id)) throw nieZnaleziono('Nie odnaleziono spółki.');
    const { niezgodnosci } = rejestr.przelicz(db(), id);
    odp.json({
      ok: niezgodnosci.length === 0,
      niezgodnosci,
      komunikat:
        niezgodnosci.length === 0
          ? 'Stan odbudowany ze zdarzeń. Bilans akcji zgadza się w każdej serii.'
          : 'Odbudowa wykryła niezgodności bilansu — rejestr wymaga sprostowania.',
    });
  })
);

/** Tabela akcjonariatu do porownania przed/po w kreatorze. */
function tabelaAkcjonariatu(stan, osoby, baza, spolkaId) {
  const stanLogika = require('../logika/stan');
  const maskowanie = require('../logika/maskowanie');
  const n = require('../logika/numery');

  const wszystkieOsoby = new Map([...rejestr.wczytajOsobySpolki(baza, spolkaId), ...osoby]);
  const wynik = stanLogika.akcjonariatNaDzien(stan, null);
  return {
    razem_akcji: wynik.razem_akcji,
    bilans: stanLogika.bilansNaDzien(stan, null),
    pozycje: wynik.pozycje.map((p) => ({
      osoba_id: p.osoba_id,
      oznaczenie: maskowanie.oznaczenieOsoby(wszystkieOsoby.get(p.osoba_id)),
      seria: p.seria,
      ilosc: p.ilosc,
      numery: n.opisz(p.zakresy),
      procent: p.procent,
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// Dokumenty wystawiane na żądanie (blok A5 sesji 8)
//
// Pięć wzorów jednorazowych/na żądanie — nie idą automatem, tylko na
// przycisk z kokpitu spółki. "08" dzieli typ z automatowym
// 'wykaz_akcjonariuszy' (zawiadomienia.js) - to ten sam dokument prawny
// (art. 476 § 1(1) KSH), tylko wystawiony na żądanie zamiast po wpisie.
// ─────────────────────────────────────────────────────────────

const WZORY_NA_ZADANIE = {
  '01': { nazwa: 'Umowa o prowadzenie rejestru', typ: 'umowa_rejestru' },
  '02': { nazwa: 'Załącznik: informacja RODO', typ: 'informacja_rodo' },
  '03': { nazwa: 'Uchwała o wyborze notariusza', typ: 'uchwala_wyboru' },
  '08': { nazwa: 'Lista akcjonariuszy do sądu', typ: 'wykaz_akcjonariuszy' },
  '10': { nazwa: 'Klauzula do umowy zbycia akcji', typ: 'klauzula_zbycia' },
};

function stanAkcjonariatuNaDzis(spolkaId, dzis, { zGlosami = false } = {}) {
  const widok = widoki.widokStanu(db(), spolkaId, dzis, { rola: przepisy.ROLE_ODBIORCY.KANCELARIA, zGlosami });
  return widok || { akcjonariusze: [], razem_akcji: 0 };
}

/** Buduje kontekst danych dla jednego z pięciu wzorów wystawianych na żądanie. */
function budujKontekstNaZadanie(kod, spolka, cialo) {
  const dzis = czas.dzisIso();
  switch (kod) {
    case '01':
      return kontekstPisma.umowaOProwadzenieRejestru({ spolka, dzis });
    case '02':
      return kontekstPisma.informacjaRodo({ spolka });
    case '03': {
      // D-R06/A6: liczba glosow - wylacznie na uchwale o wyborze notariusza.
      const stan = stanAkcjonariatuNaDzis(spolka.id, dzis, { zGlosami: true });
      return kontekstPisma.uchwalaWyboru({ spolka, akcjonariusze: stan.akcjonariusze, uchwala: cialo.uchwala || {}, dzis });
    }
    case '08': {
      const stan = stanAkcjonariatuNaDzis(spolka.id, dzis);
      const czlonkowie = spolka.sklad_organu_json ? JSON.parse(spolka.sklad_organu_json) : [];
      return kontekstPisma.listaAkcjonariuszyDoSadu({
        spolka,
        akcjonariusze: stan.akcjonariusze,
        razemAkcji: stan.razem_akcji,
        czlonkowieOrganu: czlonkowie,
        adresatNazwa: cialo.adresat_nazwa || null,
        adresatAdres: cialo.adresat_adres || null,
        dzis,
      });
    }
    case '10': {
      const zbywca = cialo.zbywca_osoba_id
        ? db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(Number(cialo.zbywca_osoba_id))
        : null;
      const nabywca = cialo.nabywca_osoba_id
        ? db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(Number(cialo.nabywca_osoba_id))
        : null;
      return kontekstPisma.klauzulaZbycia({ spolka, klauzula: cialo.klauzula || {}, zbywca, nabywca });
    }
    default:
      throw bledneZadanie(`Nieznany wzór: „${kod}".`);
  }
}

/** Lista pięciu wzorów dostępnych do wystawienia na żądanie. */
router.get(
  '/:id/dokumenty/wystaw',
  asy((zad, odp) => {
    const spolka = rejestr.wczytajSpolke(db(), Number(zad.params.id));
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
    odp.json({
      wzory: Object.entries(WZORY_NA_ZADANIE).map(([kod, w]) => ({ kod, nazwa: w.nazwa })),
    });
  })
);

/** Podgląd na REALNYCH danych spółki — przed wystawieniem, bez zapisu. */
router.post(
  '/:id/dokumenty/:kod/podglad',
  asy((zad, odp) => {
    const spolka = rejestr.wczytajSpolke(db(), Number(zad.params.id));
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
    if (!WZORY_NA_ZADANIE[zad.params.kod]) throw nieZnaleziono(`Nie ma wzoru o kodzie „${zad.params.kod}".`);

    const dane = budujKontekstNaZadanie(zad.params.kod, spolka, zad.body || {});
    const wynik = wzoryDysk.wypelnij(zad.params.kod, dane);
    odp.json({
      tekst: docx.tekst(wynik.plik),
      brakujace: wynik.brakujace,
      bledy: wynik.bledy,
      ostrzezenia: wynik.ostrzezenia,
    });
  })
);

/** Wystawia dokument: renderuje, zapisuje plik na dysku i ślad w psa_wydane_dokumenty. */
router.post(
  '/:id/dokumenty/:kod',
  asy((zad, odp) => {
    const spolka = rejestr.wczytajSpolke(db(), Number(zad.params.id));
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
    const opisWzoru = WZORY_NA_ZADANIE[zad.params.kod];
    if (!opisWzoru) throw nieZnaleziono(`Nie ma wzoru o kodzie „${zad.params.kod}".`);
    const kto = autor(zad);

    const dane = budujKontekstNaZadanie(zad.params.kod, spolka, zad.body || {});
    const wynik = wzoryDysk.wypelnij(zad.params.kod, dane);

    const katalog = path.join(konfiguracja.KATALOG_DOKUMENTOW, `spolka_${spolka.id}`, 'wydane');
    fs.mkdirSync(katalog, { recursive: true });
    const nazwaPliku = `${wynik.nazwa.replace(/\s+/g, '-')}.docx`;
    const nazwaZapisu = `${crypto.randomUUID()}-${nazwaPliku}`;
    fs.writeFileSync(path.join(katalog, nazwaZapisu), wynik.plik);
    const sciezkaWzgledna = path.relative(konfiguracja.KATALOG_DOKUMENTOW, path.join(katalog, nazwaZapisu));

    const wpis = db()
      .prepare(
        `INSERT INTO psa_wydane_dokumenty
           (sprawa_id, spolka_id, typ, odbiorca_osoba_id, kanal, tresc_html,
            sciezka_plik, szablon_kod, szablon_hash, wyslano, autor, utworzono)
         VALUES (NULL, @spolka_id, @typ, NULL, 'papier', @tresc_html,
                 @sciezka_plik, @szablon_kod, @szablon_hash, NULL, @autor, @utworzono)`
      )
      .run({
        spolka_id: spolka.id,
        typ: opisWzoru.typ,
        tresc_html: docx.tekst(wynik.plik),
        sciezka_plik: sciezkaWzgledna,
        szablon_kod: zad.params.kod,
        szablon_hash: wynik.hash,
        autor: kto,
        utworzono: czas.terazIso(),
      });

    odp.status(201).json({
      id: Number(wpis.lastInsertRowid),
      brakujace: wynik.brakujace,
      bledy: wynik.bledy,
    });
  })
);

/**
 * Dokumenty założycielskie spółki — komplet przeniesiony z wniosku przy jego
 * przyjęciu (`server/trasy/wnioski.js`). Dla każdego dokumentu dwa
 * egzemplarze: wystawiony wzór i odesłany przez klienta podpisany skan.
 */
router.get(
  '/:id/dokumenty-zalozycielskie',
  asy((zad, odp) => {
    const spolka = rejestr.wczytajSpolke(db(), Number(zad.params.id));
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
    const dokumenty = db()
      .prepare(
        `SELECT id, wniosek_id, typ, nazwa, nazwa_pliku, rozmiar, rola, utworzono
           FROM psa_spolki_dokumenty WHERE spolka_id = ? ORDER BY id`
      )
      .all(spolka.id);
    odp.json({ dokumenty });
  })
);

router.get(
  '/:id/dokumenty-zalozycielskie/:dokId',
  asy((zad, odp) => {
    const spolka = rejestr.wczytajSpolke(db(), Number(zad.params.id));
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
    const dokument = db()
      .prepare('SELECT * FROM psa_spolki_dokumenty WHERE id = ? AND spolka_id = ?')
      .get(Number(zad.params.dokId), spolka.id);
    if (!dokument) throw nieZnaleziono('Nie odnaleziono dokumentu.');

    const pelna = path.join(konfiguracja.KATALOG_DOKUMENTOW, dokument.sciezka);
    if (!pelna.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(pelna)) {
      throw nieZnaleziono('Plik nie jest już dostępny.');
    }

    dziennikDostepu.zapisz(db(), {
      kto: autor(zad), typKto: 'pracownik', spolkaId: spolka.id,
      akcja: dziennikDostepu.AKCJE.POBRANIE_PLIKU,
      opis: `dokument założycielski #${dokument.id} (${dokument.typ}, ${dokument.rola})`,
    });

    pliki.naglowkiPliku(odp, { nazwaPliku: dokument.nazwa_pliku, wRamce: false });
    fs.createReadStream(pelna).pipe(odp);
  })
);

/**
 * AKTA SPOLKI — wszystkie dokumenty tej spolki w jednym miejscu, po dacie.
 *
 * Dotad kazdy komplet mieszkal gdzie indziej: zalozycielski przy spolce,
 * skan umowy sprzedazy przy sprawie, zawiadomienie w wydanych. Zeby zobaczyc
 * „co mamy na te spolke", trzeba bylo obejsc trzy ekrany. Sekcja „Dokumenty"
 * w kokpicie pyta tu raz i dostaje cala teczke — kazda pozycja z data,
 * zrodlem i adresem do pobrania.
 */
router.get(
  '/:id/akta',
  asy((zad, odp) => {
    const spolka = rejestr.wczytajSpolke(db(), Number(zad.params.id));
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');

    // Kazdy dokument zalozycielski ma DWA egzemplarze w osobnych wierszach
    // (wzor i podpisany skan), wstawiane parami jeden po drugim. W teczce ma
    // byc jedna pozycja z dwoma odnosnikami, nie dwie prawie identyczne
    // linijki — inaczej komplet osmiu dokumentow rozlewa sie na szesnascie.
    const wiersze = db()
      .prepare(
        `SELECT id, wniosek_id, typ, nazwa, nazwa_pliku, rozmiar, rola, utworzono
           FROM psa_spolki_dokumenty WHERE spolka_id = ? ORDER BY id`
      )
      .all(spolka.id);

    const zalozycielskie = [];
    for (const d of wiersze) {
      const adres = `/api/psa/spolki/${spolka.id}/dokumenty-zalozycielskie/${d.id}`;
      const poprzedni = zalozycielskie[zalozycielskie.length - 1];
      if (d.rola === 'podpisany' && poprzedni && poprzedni.typ === d.typ && poprzedni.nazwa === d.nazwa
          && !poprzedni.url_podpisany) {
        poprzedni.url_podpisany = adres;
        poprzedni.nazwa_pliku_podpisany = d.nazwa_pliku;
        poprzedni.opis = 'wystawiony i podpisany';
        continue;
      }
      zalozycielskie.push({
        grupa: 'zalozycielski',
        id: d.id,
        typ: d.typ,
        nazwa: d.nazwa,
        nazwa_pliku: d.nazwa_pliku,
        rozmiar: d.rozmiar,
        opis: d.rola === 'podpisany' ? 'egzemplarz podpisany' : 'egzemplarz wystawiony',
        data: d.utworzono,
        url: adres,
        url_podpisany: null,
      });
    }

    // Zalaczniki spraw — tu trafia skan umowy sprzedazy akcji, ktory klient
    // dosyla RAZEM z zadaniem wpisu. Numer sprawy zostaje przy pozycji, bo
    // to on tlumaczy, po co ten plik w aktach jest.
    const zeSpraw = db()
      .prepare(
        `SELECT d.id, d.nazwa_pliku, d.rozmiar, d.typ_dokumentu, d.utworzono,
                s.id AS sprawa_id, s.typ_zdarzenia
           FROM psa_dokumenty d JOIN psa_sprawy s ON s.id = d.sprawa_id
          WHERE s.spolka_id = ? ORDER BY d.id`
      )
      .all(spolka.id)
      .map((d) => ({
        grupa: 'sprawa',
        id: d.id,
        sprawa_id: d.sprawa_id,
        nazwa: d.nazwa_pliku,
        nazwa_pliku: d.nazwa_pliku,
        rozmiar: d.rozmiar,
        opis: `${d.typ_dokumentu.replace(/_/g, ' ')} — sprawa #${d.sprawa_id}`,
        data: d.utworzono,
        url: `/api/psa/sprawy/${d.sprawa_id}/dokumenty/${d.id}`,
      }));

    const wydane = db()
      .prepare(
        `SELECT id, sprawa_id, typ, kanal, sciezka_plik, wyslano, utworzono
           FROM psa_wydane_dokumenty WHERE spolka_id = ? ORDER BY id`
      )
      .all(spolka.id)
      .map((d) => ({
        grupa: 'wydany',
        id: d.id,
        sprawa_id: d.sprawa_id,
        nazwa: d.typ.replace(/_/g, ' '),
        nazwa_pliku: null,
        rozmiar: null,
        opis: `wydany ${d.kanal === 'email' ? 'e-mailem' : d.kanal === 'portal' ? 'przez portal' : 'na papierze'}`,
        data: d.wyslano || d.utworzono,
        // Wystawione bez pliku (sam HTML) nie maja czego pobrac — front
        // pokazuje je wtedy jako slad, bez odnosnika.
        url: d.sciezka_plik
          ? d.sprawa_id
            ? `/api/psa/sprawy/${d.sprawa_id}/wydane/${d.id}/plik`
            : `/api/psa/spolki/${spolka.id}/wydane/${d.id}/plik`
          : null,
      }));

    odp.json({ dokumenty: [...zalozycielskie, ...zeSpraw, ...wydane] });
  })
);

/** Historia dokumentów wystawionych na żądanie (bez powiązania ze sprawą). */
router.get(
  '/:id/wydane',
  asy((zad, odp) => {
    const spolka = rejestr.wczytajSpolke(db(), Number(zad.params.id));
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
    const wydane = db()
      .prepare(
        `SELECT id, typ, szablon_kod, autor, utworzono FROM psa_wydane_dokumenty
          WHERE spolka_id = ? AND sprawa_id IS NULL ORDER BY id DESC`
      )
      .all(spolka.id);
    odp.json({ wydane });
  })
);

/** Pobranie pliku wystawionego na żądanie. */
router.get(
  '/:id/wydane/:wydanyId/plik',
  asy((zad, odp) => {
    const spolka = rejestr.wczytajSpolke(db(), Number(zad.params.id));
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
    const wydany = db()
      .prepare('SELECT * FROM psa_wydane_dokumenty WHERE id = ? AND spolka_id = ?')
      .get(Number(zad.params.wydanyId), spolka.id);
    if (!wydany || !wydany.sciezka_plik) throw nieZnaleziono('Nie odnaleziono pliku.');

    const pelnaSciezka = path.join(konfiguracja.KATALOG_DOKUMENTOW, wydany.sciezka_plik);
    if (!pelnaSciezka.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(pelnaSciezka)) {
      throw nieZnaleziono('Plik nie jest już dostępny.');
    }

    // Pobranie wystawionego dokumentu - blok D4, zakres WASKI.
    dziennikDostepu.zapisz(db(), {
      kto: autor(zad), typKto: 'pracownik', spolkaId: spolka.id, osobaId: wydany.odbiorca_osoba_id,
      akcja: dziennikDostepu.AKCJE.POBRANIE_PLIKU, opis: `wydany dokument #${wydany.id} (${wydany.typ})`,
    });

    odp.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    odp.setHeader('Content-Disposition', `attachment; filename="${path.basename(pelnaSciezka).replace(/^[^-]+-/, '')}"`);
    odp.sendFile(pelnaSciezka);
  })
);

module.exports = router;
// Etap 3F: kancelaria zaklada realna spolke z zaakceptowanego wniosku klienta
// - wnioski.js reuzywa TA SAMA walidacje, zeby wpis z wniosku nigdy nie
// ominal regul, ktorym podlega wpis reczny.
module.exports.POLA_SPOLKI = POLA_SPOLKI;
module.exports.sprawdzDaneSpolki = sprawdzDaneSpolki;
