'use strict';

/**
 * Trasy `/api/psa/spolki/...` - kancelaria.
 */

const express = require('express');

const { db } = require('../baza');
const rejestr = require('../rejestr');
const widoki = require('../widoki');
const przepisy = require('../logika/przepisy');
const typyZdarzen = require('../logika/typy-zdarzen');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');
const { pobierzZKrs } = require('./krs');

const router = express.Router();

/** Pola spolki przyjmowane z formularza. */
const POLA_SPOLKI = [
  'krs', 'nip', 'regon', 'nazwa', 'forma_prawna', 'kraj', 'kod_pocztowy', 'miejscowosc',
  'ulica', 'nr_domu', 'nr_lokalu', 'sad_rejestrowy', 'wydzial', 'telefon', 'email', 'www',
  'status', 'komentarz_statusu', 'data_utworzenia_spolki', 'data_uchwaly_wyboru', 'data_umowy',
  'data_otwarcia_rejestru', 'data_zakonczenia_umowy', 'opis', 'uwagi',
  // Sprint 5 (zgodnosc z ustawa):
  'umowe_zawarl', 'umowe_zawarl_imie_nazwisko', 'dodatkowe_informacje_umowa_spolki',
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

function wyczysc(cialo) {
  const wynik = {};
  for (const pole of POLA_SPOLKI) {
    if (cialo[pole] === undefined) continue;
    const v = cialo[pole];
    wynik[pole] = v === '' || v === null ? null : String(v).trim();
  }
  return wynik;
}

function sprawdzDaneSpolki(dane, { wymaganaNazwa = true } = {}) {
  if (wymaganaNazwa && !dane.nazwa) {
    throw bledneZadanie('Nazwa spółki jest wymagana.');
  }
  if (dane.krs && !/^\d{10}$/.test(dane.krs)) {
    throw bledneZadanie('Numer KRS składa się z 10 cyfr.');
  }
  if (dane.nip && !/^\d{10}$/.test(String(dane.nip).replace(/[\s-]/g, ''))) {
    throw bledneZadanie('NIP składa się z 10 cyfr.');
  }
  for (const pole of [
    'data_utworzenia_spolki', 'data_uchwaly_wyboru', 'data_umowy',
    'data_otwarcia_rejestru', 'data_zakonczenia_umowy',
  ]) {
    if (dane[pole] && !czas.poprawnaData(dane[pole])) {
      throw bledneZadanie(`Pole „${pole}” musi być datą w formacie RRRR-MM-DD.`);
    }
  }
  if (dane.status && !Object.values(przepisy.STATUSY_SPOLKI).includes(dane.status)) {
    throw bledneZadanie(`Nieznany status spółki: „${dane.status}”.`);
  }
  if (dane.umowe_zawarl && !przepisy.UMOWE_ZAWARL.includes(dane.umowe_zawarl)) {
    throw bledneZadanie(`Pole „umowe_zawarl” musi być jedną z wartości: ${przepisy.UMOWE_ZAWARL.join(', ')}.`);
  }
  // Regula domenowa nr 11 - rejestru nie prowadzimy dla S.A. ani S.K.A.
  if (dane.forma_prawna !== undefined) {
    const ocena = przepisy.ocenFormePrawna(dane.forma_prawna);
    if (!ocena.dozwolona) throw bledneZadanie(ocena.powod);
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
                (SELECT MAX(z.data_zdarzenia) FROM psa_zdarzenia z
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

/** Kokpit spolki - jeden ekran: stan na dzis + historia + liczniki. */
router.get(
  '/:id',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const stan = widoki.widokStanu(db(), id, zad.query.data);
    if (!stan) throw nieZnaleziono('Nie odnaleziono spółki.');

    odp.json({
      ...stan,
      zdarzenia: widoki.widokZdarzen(db(), id, { limit: 12 }),
      liczba_zdarzen: db()
        .prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia WHERE spolka_id = ?')
        .get(id).ile,
      typy_zdarzen: typyZdarzen.dostepneWKreatorze(5),
    });
  })
);

/** Zmiana danych spolki - tworzy zdarzenie `zmiana_danych_spolki`. */
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

      // Zdarzenie zapisujemy tylko dla pol bedacych trescia rejestru -
      // zmiana wewnetrznych `uwagi` nie jest czynnoscia rejestrowa.
      const rejestrowe = zmienione.filter((p) => POLA_REJESTROWE.includes(p));
      if (rejestrowe.length === 0) return null;

      return rejestr.zapiszZdarzenie(db(), {
        spolka_id: id,
        typ: 'zmiana_danych_spolki',
        data_zdarzenia: czas.dzisIso(),
        autor: kto,
        dane: {
          przed: Object.fromEntries(rejestrowe.map((p) => [p, biezaca[p] ?? null])),
          po: Object.fromEntries(rejestrowe.map((p) => [p, dane[p] ?? null])),
          zmienione_pola: rejestrowe,
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

/** Stan akcjonariatu na dowolny dzien, z maskowaniem wg roli odbiorcy. */
router.get(
  '/:id/stan',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const data = zad.query.data ? String(zad.query.data) : czas.dzisIso();
    if (!czas.poprawnaData(data)) {
      throw bledneZadanie('Parametr „data” musi mieć format RRRR-MM-DD.');
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
    const { typ, data_zdarzenia, dane } = zad.body || {};
    if (!typ) throw bledneZadanie('Nie wskazano typu zdarzenia.');

    let podglad;
    try {
      podglad = rejestr.przygotujPodglad(db(), {
        spolkaId: id,
        typ,
        data_zdarzenia,
        wejscie: dane || {},
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

    const data = data_zdarzenia || czas.dzisIso();
    odp.json({
      dopuszczalne: podglad.dopuszczalne,
      bledy: podglad.bledy,
      ostrzezenia: podglad.ostrzezenia,
      dane: podglad.dane,
      typ: typyZdarzen.typ(typ),
      przed: tabelaAkcjonariatu(podglad.stanPrzed, data, podglad.osoby, db(), id),
      po: podglad.stanPo ? tabelaAkcjonariatu(podglad.stanPo, data, podglad.osoby, db(), id) : null,
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
    const { typ, data_zdarzenia, dane, uzasadnienie } = zad.body || {};
    if (!typ) throw bledneZadanie('Nie wskazano typu zdarzenia.');
    if (!czas.poprawnaData(data_zdarzenia)) {
      throw bledneZadanie('Data zdarzenia musi mieć format RRRR-MM-DD.');
    }

    const wynik = rejestr.dokonajWpisu(db(), {
      spolkaId: id,
      typ,
      data_zdarzenia,
      wejscie: dane || {},
      autor: kto,
      uzasadnienie: uzasadnienie || null,
    });

    odp.status(201).json({
      zdarzenie: {
        id: wynik.zdarzenie.id,
        typ: wynik.zdarzenie.typ,
        data_zdarzenia: wynik.zdarzenie.data_zdarzenia,
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
function tabelaAkcjonariatu(stan, data, osoby, baza, spolkaId) {
  const stanLogika = require('../logika/stan');
  const maskowanie = require('../logika/maskowanie');
  const n = require('../logika/numery');

  const wszystkieOsoby = new Map([...rejestr.wczytajOsobySpolki(baza, spolkaId), ...osoby]);
  const wynik = stanLogika.akcjonariatNaDzien(stan, data);
  return {
    razem_akcji: wynik.razem_akcji,
    bilans: stanLogika.bilansNaDzien(stan, data),
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

module.exports = router;
