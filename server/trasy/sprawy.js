'use strict';

/**
 * Trasy `/api/psa/sprawy/...` - workflow spraw (sekcja 7 i 8 specyfikacji).
 *
 * Maszyna stanow:
 *   nowa ──► weryfikacja ──► wpisana
 *              │  ▲
 *              ▼  │
 *          wstrzymana
 *   (kazdy stan poza wpisana/odmowa/anulowana da sie zakonczyc "anuluj")
 *
 * Sciezka `z_urzedu` (zajecie, wykreslenie_zajecia) pomija faze `nowa` -
 * organ egzekucyjny nie "zada" wpisu, tylko przekazuje kompletne
 * zawiadomienie, wiec sprawa startuje wprost w `weryfikacja`
 * (art. 300(34) § 2 KSH: bez zadania, bez uprzedniego powiadomienia).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const { db } = require('../baza');
const rejestr = require('../rejestr');
const zawiadomienia = require('../zawiadomienia');
const terminy = require('../logika/terminy');
const typyZdarzen = require('../logika/typy-zdarzen');
const przepisy = require('../logika/przepisy');
const maskowanie = require('../logika/maskowanie');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

const ZRODLA = ['portal', 'email', 'papier', 'z_urzedu'];
const TYPY_DOKUMENTU = ['umowa_zbycia', 'uchwala', 'zgoda', 'postanowienie', 'pelnomocnictwo', 'inny'];

// ─────────────────────────────────────────────────────────────
// Odczyt
// ─────────────────────────────────────────────────────────────

function wczytajSprawe(id) {
  return db().prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(id) || null;
}

/** Sprawa wzbogacona o nazwe typu i wyliczony termin - ksztalt do JSON-a. */
function widokSprawy(sprawa, dzis = czas.dzisIso()) {
  const typ = typyZdarzen.istnieje(sprawa.typ_zdarzenia) ? typyZdarzen.typ(sprawa.typ_zdarzenia) : null;
  return {
    ...sprawa,
    typ_nazwa: typ ? typ.nazwa : sprawa.typ_zdarzenia,
    typ_symbol: typ ? typ.symbol : '?',
    odplatne: typ ? typ.odplatne : null,
    termin: terminy.policzTermin(sprawa, dzis),
  };
}

function laczNotatke(istniejaca, nowa) {
  const znacznik = `[${czas.terazIso()}] ${nowa}`;
  return istniejaca ? `${istniejaca}\n${znacznik}` : znacznik;
}

// ─────────────────────────────────────────────────────────────
// Kolejka
// ─────────────────────────────────────────────────────────────

/** Kolejka spraw posortowana po pozostalym czasie (sekcja 9 - pulpit). */
router.get(
  '/',
  asy((zad, odp) => {
    const stanyDomyslne = ['nowa', 'weryfikacja', 'wstrzymana'];
    const stany = zad.query.stan ? String(zad.query.stan).split(',').filter(Boolean) : stanyDomyslne;
    const warunki = [`stan IN (${stany.map(() => '?').join(',')})`];
    const parametry = [...stany];
    if (zad.query.spolka_id) {
      warunki.push('sp.spolka_id = ?');
      parametry.push(Number(zad.query.spolka_id));
    }

    const wiersze = db()
      .prepare(
        `SELECT sp.*, s.nazwa AS spolka_nazwa, s.krs AS spolka_krs
           FROM psa_sprawy sp
           JOIN psa_spolki s ON s.id = sp.spolka_id
          WHERE ${warunki.join(' AND ')}
          ORDER BY sp.data_wplywu ASC`
      )
      .all(...parametry);

    const dzis = czas.dzisIso();
    const zTerminem = wiersze.map((s) => widokSprawy(s, dzis));

    // Wstrzymane (zegar zamrozony) na koniec - najpierw sprawy z biegnacym
    // terminem, posortowane po tym, ile dni zostalo (po terminie najpierw).
    zTerminem.sort((a, b) => {
      if ((a.stan === 'wstrzymana') !== (b.stan === 'wstrzymana')) {
        return a.stan === 'wstrzymana' ? 1 : -1;
      }
      if (a.stan === 'wstrzymana') {
        return String(a.wstrzymana_od || '').localeCompare(String(b.wstrzymana_od || ''));
      }
      return (a.termin.dni_pozostale ?? 999) - (b.termin.dni_pozostale ?? 999);
    });

    odp.json({ sprawy: zTerminem });
  })
);

/** Zalozenie sprawy - start licznika 7 dni (art. 300(34) § 1 KSH). */
router.post(
  '/',
  asy((zad, odp) => {
    const kto = autor(zad);
    const cialo = zad.body || {};

    const spolkaId = Number(cialo.spolka_id);
    const spolka = rejestr.wczytajSpolke(db(), spolkaId);
    if (!spolka) throw bledneZadanie('Nie odnaleziono spółki.');
    if (przepisy.STATUSY_SPOLKI_BLOKUJACE_WPIS.includes(spolka.status)) {
      throw bledneZadanie(`Spółka ma status „${spolka.status}” — nie można założyć nowej sprawy.`);
    }

    const typZdarzenia = String(cialo.typ_zdarzenia || '');
    if (!typyZdarzen.dostepneWKreatorze(2).some((t) => t.kod === typZdarzenia)) {
      throw bledneZadanie(`Typ zdarzenia „${typZdarzenia}” nie jest dostępny w kreatorze.`);
    }
    const typ = typyZdarzen.typ(typZdarzenia);

    const zrodlo = String(cialo.zrodlo || '');
    if (!ZRODLA.includes(zrodlo)) {
      throw bledneZadanie(`Źródło musi być jednym z: ${ZRODLA.join(', ')}.`);
    }
    if (typ.z_urzedu && zrodlo !== 'z_urzedu') {
      throw bledneZadanie(`Zdarzenie „${typ.nazwa}” zakłada się wyłącznie ze źródła „z_urzedu”.`);
    }
    if (!typ.z_urzedu && zrodlo === 'z_urzedu') {
      throw bledneZadanie(`Zdarzenie „${typ.nazwa}” nie jest czynnością z urzędu.`);
    }

    const zadajacyOsobaId = cialo.zadajacy_osoba_id == null || cialo.zadajacy_osoba_id === ''
      ? null
      : Number(cialo.zadajacy_osoba_id);
    if (zadajacyOsobaId != null && !db().prepare('SELECT id FROM psa_osoby WHERE id = ?').get(zadajacyOsobaId)) {
      throw bledneZadanie('Wskazany żądający nie figuruje w kartotece.');
    }

    const dataWplywu = cialo.data_wplywu || czas.terazIso();
    // Sciezka z urzedu pomija faze oczekiwania na zadajacego - startuje
    // wprost w weryfikacji (patrz komentarz na gorze pliku).
    const stanPoczatkowy = typ.z_urzedu ? 'weryfikacja' : 'nowa';

    const dane = {
      spolka_id: spolkaId,
      typ_zdarzenia: typZdarzenia,
      zrodlo,
      zadajacy_osoba_id: zadajacyOsobaId,
      zadajacy_opis: cialo.zadajacy_opis ? String(cialo.zadajacy_opis).trim() : null,
      data_wplywu: dataWplywu,
      stan: stanPoczatkowy,
      wymaga_powiadomienia: typ.wymaga_powiadomienia === true ? 1 : 0,
      autor: kto,
      notatka: cialo.notatka ? String(cialo.notatka).trim() : null,
      utworzono: czas.terazIso(),
    };
    dane.termin_do = terminy.policzTermin(
      { data_wplywu: dataWplywu.slice(0, 10), stan: stanPoczatkowy, wstrzymana_od: null, wznowiona_od: null },
      czas.dzisIso()
    ).termin_do;

    const kolumny = Object.keys(dane);
    const wynik = db()
      .prepare(
        `INSERT INTO psa_sprawy (${kolumny.join(', ')}) VALUES (${kolumny.map((k) => `@${k}`).join(', ')})`
      )
      .run(dane);

    odp.status(201).json({ sprawa: widokSprawy(wczytajSprawe(wynik.lastInsertRowid)) });
  })
);

/** Kokpit sprawy: dane + dokumenty + wydane dokumenty + podglad zdarzenia. */
router.get(
  '/:id',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const sprawa = wczytajSprawe(id);
    if (!sprawa) throw nieZnaleziono('Nie odnaleziono sprawy.');

    const dokumenty = db()
      .prepare('SELECT id, nazwa_pliku, mime, rozmiar, typ_dokumentu, wgral, utworzono FROM psa_dokumenty WHERE sprawa_id = ? ORDER BY id')
      .all(id);
    const wydaneDokumenty = db()
      .prepare(
        `SELECT id, typ, odbiorca_osoba_id, kanal, wyslano, autor, utworzono
           FROM psa_wydane_dokumenty WHERE sprawa_id = ? ORDER BY id DESC`
      )
      .all(id);

    const zadajacy = sprawa.zadajacy_osoba_id
      ? maskowanie.zamaskujOsobe(
          db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(sprawa.zadajacy_osoba_id),
          przepisy.ROLE_ODBIORCY.KANCELARIA
        )
      : null;

    odp.json({
      sprawa: widokSprawy(sprawa),
      spolka: rejestr.wczytajSpolke(db(), sprawa.spolka_id),
      zadajacy: zadajacy ? { ...zadajacy, oznaczenie: maskowanie.oznaczenieOsoby(zadajacy) } : null,
      typ: typyZdarzen.istnieje(sprawa.typ_zdarzenia) ? typyZdarzen.typ(sprawa.typ_zdarzenia) : null,
      dokumenty,
      wydane_dokumenty: wydaneDokumenty,
    });
  })
);

/** Podglad tresci zdarzenia zwiazanej ze sprawa - krok 4 kreatora. */
router.post(
  '/:id/podglad',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const sprawa = wczytajSprawe(id);
    if (!sprawa) throw nieZnaleziono('Nie odnaleziono sprawy.');

    const { data_zdarzenia, dane } = zad.body || {};
    let podglad;
    try {
      podglad = rejestr.przygotujPodglad(db(), {
        spolkaId: sprawa.spolka_id,
        typ: sprawa.typ_zdarzenia,
        data_zdarzenia,
        wejscie: dane || {},
      });
    } catch (e) {
      if (['BladKreatora', 'BladZakresu', 'BladStanu'].includes(e.name)) {
        return odp.json({ dopuszczalne: false, bledy: [e.message], ostrzezenia: [], dane: null });
      }
      throw e;
    }

    // Zapisujemy roboczy stan kreatora - sekcja 9: "kazdy krok da sie
    // cofnac bez utraty danych".
    db()
      .prepare('UPDATE psa_sprawy SET dane_wejsciowe_json = ?, zaktualizowano = ? WHERE id = ?')
      .run(JSON.stringify({ data_zdarzenia, dane }), czas.terazIso(), id);

    odp.json({
      dopuszczalne: podglad.dopuszczalne,
      bledy: podglad.bledy,
      ostrzezenia: podglad.ostrzezenia,
      dane: podglad.dane,
      typ: typyZdarzen.typ(sprawa.typ_zdarzenia),
    });
  })
);

/**
 * DOKONANIE WPISU (transakcja: zdarzenie + materializacja + zmiana stanu
 * sprawy). Zawiadomienia generujemy i probujemy wyslac PO zapisie - blad
 * wysylki nie cofa juz dokonanego wpisu.
 */
router.post(
  '/:id/wpisz',
  asy(async (zad, odp) => {
    const id = Number(zad.params.id);
    const kto = autor(zad);
    const sprawa = wczytajSprawe(id);
    if (!sprawa) throw nieZnaleziono('Nie odnaleziono sprawy.');

    const { data_zdarzenia, dane } = zad.body || {};

    const { wynik, oplata } = rejestr.dokonajWpisuSprawy(db(), {
      sprawaId: id,
      data_zdarzenia,
      wejscie: dane || {},
      autor: kto,
    });

    const spolka = rejestr.wczytajSpolke(db(), sprawa.spolka_id);
    const osoby = rejestr.wczytajOsoby(db(), sprawa.zadajacy_osoba_id ? [sprawa.zadajacy_osoba_id] : []);
    const widoki = require('../widoki');
    const podsumowanie = widoki.podsumujZdarzenie(
      { ...wynik.zdarzenie, dane: wynik.zdarzenie.dane || JSON.parse(wynik.zdarzenie.dane_json || '{}') },
      new Map([...osoby, ...rejestr.wczytajOsobySpolki(db(), sprawa.spolka_id)])
    );

    let powiadomienia = [];
    try {
      powiadomienia = await zawiadomienia.poWpisie(db(), {
        sprawa: { ...sprawa, stan: 'wpisana', zdarzenie_id: wynik.zdarzenie.id },
        zdarzenie: wynik.zdarzenie,
        spolka,
        osoby,
        podsumowanie,
        autor: kto,
      });
    } catch (e) {
      // Wpis JEST juz dokonany i prawnie skuteczny - blad wysylki nie moze
      // zamienic sie w blad 500 calej operacji. Zglaszamy go w odpowiedzi.
      powiadomienia = [{ blad: `Nie udało się przygotować zawiadomień: ${e.message}` }];
    }

    odp.status(201).json({
      sprawa: widokSprawy(wczytajSprawe(id)),
      zdarzenie: {
        id: wynik.zdarzenie.id,
        typ: wynik.zdarzenie.typ,
        data_zdarzenia: wynik.zdarzenie.data_zdarzenia,
        data_wpisu: wynik.zdarzenie.data_wpisu,
        hash_skrocony: wynik.zdarzenie.hash.slice(0, 12),
      },
      ostrzezenia: wynik.ostrzezenia,
      powiadomienia,
      oplata,
    });
  })
);

// ─────────────────────────────────────────────────────────────
// Przejscia stanow
// ─────────────────────────────────────────────────────────────

router.patch(
  '/:id',
  asy(async (zad, odp) => {
    const id = Number(zad.params.id);
    const kto = autor(zad);
    const sprawa = wczytajSprawe(id);
    if (!sprawa) throw nieZnaleziono('Nie odnaleziono sprawy.');
    const spolka = rejestr.wczytajSpolke(db(), sprawa.spolka_id);
    const dzis = czas.dzisIso();
    const { akcja, powod, powod_odmowy } = zad.body || {};

    if (akcja === 'weryfikuj') {
      if (sprawa.stan !== 'nowa') {
        throw bledneZadanie('Do weryfikacji można przenieść wyłącznie sprawę w stanie „nowa”.');
      }
      db().prepare('UPDATE psa_sprawy SET stan = ?, zaktualizowano = ? WHERE id = ?').run(
        'weryfikacja',
        czas.terazIso(),
        id
      );
      return odp.json({ sprawa: widokSprawy(wczytajSprawe(id)) });
    }

    if (akcja === 'wstrzymaj') {
      if (sprawa.stan !== 'weryfikacja') {
        throw bledneZadanie('Wstrzymać można wyłącznie sprawę w stanie „weryfikacja”.');
      }
      if (!powod || !String(powod).trim()) {
        throw bledneZadanie('Wstrzymanie wymaga wskazania przeszkody.');
      }
      const poprawki = terminy.wstrzymaj(sprawa, dzis);
      db()
        .prepare(
          `UPDATE psa_sprawy SET stan = @stan, wstrzymana_od = @wstrzymana_od, termin_do = NULL,
                                   notatka = @notatka, zaktualizowano = @teraz WHERE id = @id`
        )
        .run({
          ...poprawki,
          notatka: laczNotatke(sprawa.notatka, `Wstrzymano: ${powod}`),
          teraz: czas.terazIso(),
          id,
        });

      const osoby = rejestr.wczytajOsoby(db(), sprawa.zadajacy_osoba_id ? [sprawa.zadajacy_osoba_id] : []);
      let wysylka = null;
      try {
        wysylka = await zawiadomienia.wezwanie(db(), {
          sprawa: { ...sprawa, ...poprawki },
          spolka,
          osoby,
          powodWstrzymania: powod,
          autor: kto,
        });
      } catch (e) {
        wysylka = { wyslano: false, powod: e.message };
      }
      return odp.json({ sprawa: widokSprawy(wczytajSprawe(id)), wysylka });
    }

    if (akcja === 'wznow') {
      if (sprawa.stan !== 'wstrzymana') {
        throw bledneZadanie('Wznowić można wyłącznie sprawę wstrzymaną.');
      }
      const poprawki = terminy.wznow(sprawa, dzis);
      const termin = terminy.policzTermin({ ...sprawa, ...poprawki }, dzis);
      db()
        .prepare(
          `UPDATE psa_sprawy SET stan = @stan, wstrzymana_od = @wstrzymana_od, wznowiona_od = @wznowiona_od,
                                   dni_wstrzymania = @dni_wstrzymania, termin_do = @termin_do,
                                   notatka = @notatka, zaktualizowano = @teraz WHERE id = @id`
        )
        .run({
          ...poprawki,
          termin_do: termin.termin_do,
          notatka: laczNotatke(sprawa.notatka, 'Wznowiono — przeszkoda usunięta.'),
          teraz: czas.terazIso(),
          id,
        });
      return odp.json({ sprawa: widokSprawy(wczytajSprawe(id)) });
    }

    if (akcja === 'odmow') {
      if (!['weryfikacja', 'wstrzymana'].includes(sprawa.stan)) {
        throw bledneZadanie('Odmówić można wyłącznie sprawie w toku weryfikacji.');
      }
      if (!powod_odmowy || !String(powod_odmowy).trim()) {
        throw bledneZadanie('Odmowa wymaga podania przyczyny (art. 300(34) § 7 zd. 2 KSH).');
      }
      db()
        .prepare('UPDATE psa_sprawy SET stan = ?, powod_odmowy = ?, termin_do = NULL, zaktualizowano = ? WHERE id = ?')
        .run('odmowa', powod_odmowy, czas.terazIso(), id);

      const osoby = rejestr.wczytajOsoby(db(), sprawa.zadajacy_osoba_id ? [sprawa.zadajacy_osoba_id] : []);
      let wysylka = null;
      try {
        wysylka = await zawiadomienia.poOdmowie(db(), {
          sprawa: { ...sprawa, stan: 'odmowa', powod_odmowy },
          spolka,
          osoby,
          powodOdmowy: powod_odmowy,
          autor: kto,
        });
      } catch (e) {
        wysylka = { wyslano: false, powod: e.message };
      }
      return odp.json({ sprawa: widokSprawy(wczytajSprawe(id)), wysylka });
    }

    if (akcja === 'anuluj') {
      if (!['nowa', 'weryfikacja', 'wstrzymana'].includes(sprawa.stan)) {
        throw bledneZadanie('Nie można anulować sprawy w tym stanie.');
      }
      db()
        .prepare('UPDATE psa_sprawy SET stan = ?, notatka = ?, termin_do = NULL, zaktualizowano = ? WHERE id = ?')
        .run(
          'anulowana',
          laczNotatke(sprawa.notatka, powod ? `Anulowano: ${powod}` : 'Anulowano.'),
          czas.terazIso(),
          id
        );
      return odp.json({ sprawa: widokSprawy(wczytajSprawe(id)) });
    }

    throw bledneZadanie(`Nieznana akcja: „${akcja}”.`);
  })
);

/**
 * Odnotowanie zgody zamiast uprzedniego powiadomienia (art. 300(34) § 3 KSH,
 * forma zgody wg nowelizacji - patrz `przepisy.FORMY_ZGODY`, DO_WERYFIKACJI).
 */
router.post(
  '/:id/zgoda',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const sprawa = wczytajSprawe(id);
    if (!sprawa) throw nieZnaleziono('Nie odnaleziono sprawy.');
    const { forma, data } = zad.body || {};
    if (!forma) throw bledneZadanie('Wskaż formę zgody.');
    if (!przepisy.FORMY_ZGODY.some((f) => f.kod === forma)) {
      throw bledneZadanie(`Nieznana forma zgody: „${forma}”.`);
    }
    db()
      .prepare('UPDATE psa_sprawy SET zgoda_forma = ?, zgoda_data = ?, zaktualizowano = ? WHERE id = ?')
      .run(forma, data || czas.dzisIso(), czas.terazIso(), id);
    odp.json({ sprawa: widokSprawy(wczytajSprawe(id)) });
  })
);

/** Uprzednie powiadomienie z art. 300(34) § 3 KSH - wysylane recznie przez pracownika. */
router.post(
  '/:id/powiadomienie',
  asy(async (zad, odp) => {
    const id = Number(zad.params.id);
    const kto = autor(zad);
    const sprawa = wczytajSprawe(id);
    if (!sprawa) throw nieZnaleziono('Nie odnaleziono sprawy.');

    const osobaId = Number((zad.body || {}).osoba_id);
    const odbiorca = db().prepare('SELECT * FROM psa_osoby WHERE id = ?').get(osobaId);
    if (!odbiorca) throw bledneZadanie('Wskazana osoba nie figuruje w kartotece.');

    const spolka = rejestr.wczytajSpolke(db(), sprawa.spolka_id);
    const dane = sprawa.dane_wejsciowe_json ? JSON.parse(sprawa.dane_wejsciowe_json) : null;
    const podsumowanie = dane
      ? `Zamierzony wpis dotyczy: ${typyZdarzen.typ(sprawa.typ_zdarzenia).opis_zdarzeniem}.`
      : null;

    const wysylka = await zawiadomienia.powiadomienieUprzednie(db(), {
      sprawa,
      spolka,
      odbiorca,
      podsumowanie,
      autor: kto,
    });

    db()
      .prepare('UPDATE psa_sprawy SET powiadomienie_wyslano = ?, zaktualizowano = ? WHERE id = ?')
      .run(wysylka.wyslano ? czas.terazIso() : sprawa.powiadomienie_wyslano, czas.terazIso(), id);

    odp.json({ sprawa: widokSprawy(wczytajSprawe(id)), wysylka });
  })
);

// ─────────────────────────────────────────────────────────────
// Dokumenty (upload)
// ─────────────────────────────────────────────────────────────

const ROZSZERZENIA_DOZWOLONE = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']);
const LIMIT_ROZMIARU_BAJTY = 20 * 1024 * 1024;

function katalogSprawy(spolkaId, sprawaId) {
  return path.join(konfiguracja.KATALOG_DOKUMENTOW, `spolka_${spolkaId}`, `sprawa_${sprawaId}`);
}

const upload = multer({
  storage: multer.diskStorage({
    destination(zad, plik, wywolaj) {
      const sprawa = zad.psaSprawa;
      const katalog = katalogSprawy(sprawa.spolka_id, sprawa.id);
      fs.mkdirSync(katalog, { recursive: true });
      wywolaj(null, katalog);
    },
    filename(zad, plik, wywolaj) {
      const bezpiecznaNazwa = path.basename(plik.originalname).replace(/[^\w.\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu, '_');
      wywolaj(null, `${crypto.randomUUID()}-${bezpiecznaNazwa}`);
    },
  }),
  limits: { fileSize: LIMIT_ROZMIARU_BAJTY, files: 10 },
  fileFilter(zad, plik, wywolaj) {
    const rozszerzenie = path.extname(plik.originalname).toLowerCase();
    if (!ROZSZERZENIA_DOZWOLONE.has(rozszerzenie)) {
      return wywolaj(
        new Error(
          `Niedozwolone rozszerzenie pliku: „${rozszerzenie}”. Dozwolone: ${[...ROZSZERZENIA_DOZWOLONE].join(', ')}.`
        )
      );
    }
    wywolaj(null, true);
  },
});

/** Wstrzykuje sprawe do `zad` PRZED multerem - potrzebna do wyznaczenia katalogu docelowego. */
function zaladujSprawe(zad, odp, dalej) {
  const sprawa = wczytajSprawe(Number(zad.params.id));
  if (!sprawa) return dalej(nieZnaleziono('Nie odnaleziono sprawy.'));
  zad.psaSprawa = sprawa;
  dalej();
}

router.post(
  '/:id/dokumenty',
  zaladujSprawe,
  (zad, odp, dalej) => upload.array('pliki', 10)(zad, odp, (e) => (e ? dalej(bledneZadanie(e.message)) : dalej())),
  asy((zad, odp) => {
    const sprawa = zad.psaSprawa;
    const kto = autor(zad);
    const typDokumentu = String(zad.body.typ_dokumentu || 'inny');
    if (!TYPY_DOKUMENTU.includes(typDokumentu)) {
      throw bledneZadanie(`Nieznany typ dokumentu: „${typDokumentu}”.`);
    }
    const pliki = zad.files || [];
    if (pliki.length === 0) throw bledneZadanie('Nie przesłano żadnego pliku.');

    const wstaw = db().prepare(
      `INSERT INTO psa_dokumenty (sprawa_id, nazwa_pliku, sciezka, mime, rozmiar, typ_dokumentu, hash, wgral, utworzono)
       VALUES (@sprawa_id, @nazwa_pliku, @sciezka, @mime, @rozmiar, @typ_dokumentu, @hash, @wgral, @utworzono)`
    );
    const zapisane = pliki.map((plik) => {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(plik.path)).digest('hex');
      const wynik = wstaw.run({
        sprawa_id: sprawa.id,
        nazwa_pliku: plik.originalname,
        sciezka: path.relative(konfiguracja.KATALOG_DOKUMENTOW, plik.path),
        mime: plik.mimetype,
        rozmiar: plik.size,
        typ_dokumentu: typDokumentu,
        hash,
        wgral: kto,
        utworzono: czas.terazIso(),
      });
      return { id: Number(wynik.lastInsertRowid), nazwa_pliku: plik.originalname, rozmiar: plik.size };
    });

    odp.status(201).json({ dokumenty: zapisane });
  })
);

/** Pobranie pliku - endpoint sprawdzajacy istnienie sprawy, poza katalogiem publicznym. */
router.get(
  '/:id/dokumenty/:dokumentId',
  asy((zad, odp) => {
    const sprawa = wczytajSprawe(Number(zad.params.id));
    if (!sprawa) throw nieZnaleziono('Nie odnaleziono sprawy.');
    const dokument = db()
      .prepare('SELECT * FROM psa_dokumenty WHERE id = ? AND sprawa_id = ?')
      .get(Number(zad.params.dokumentId), sprawa.id);
    if (!dokument) throw nieZnaleziono('Nie odnaleziono dokumentu.');

    const pelnaSciezka = path.join(konfiguracja.KATALOG_DOKUMENTOW, dokument.sciezka);
    if (!pelnaSciezka.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(pelnaSciezka)) {
      throw nieZnaleziono('Plik nie jest już dostępny.');
    }
    odp.setHeader('Content-Type', dokument.mime || 'application/octet-stream');
    odp.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(dokument.nazwa_pliku)}"`);
    odp.sendFile(pelnaSciezka);
  })
);

/** Tresc wygenerowanego dokumentu (audyt / podglad do wydruku). */
router.get(
  '/:id/wydane/:wydanyId',
  asy((zad, odp) => {
    const sprawa = wczytajSprawe(Number(zad.params.id));
    if (!sprawa) throw nieZnaleziono('Nie odnaleziono sprawy.');
    const wydany = db()
      .prepare('SELECT * FROM psa_wydane_dokumenty WHERE id = ? AND sprawa_id = ?')
      .get(Number(zad.params.wydanyId), sprawa.id);
    if (!wydany) throw nieZnaleziono('Nie odnaleziono dokumentu.');
    odp.json({ wydany });
  })
);

module.exports = router;
