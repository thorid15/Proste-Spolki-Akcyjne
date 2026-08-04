'use strict';

/**
 * Pulpit, integralnosc, katalogi (meta), naglowek kancelarii i stuby 501.
 */

const express = require('express');

const { db } = require('../baza');
const rejestr = require('../rejestr');
const przepisy = require('../logika/przepisy');
const typyZdarzen = require('../logika/typy-zdarzen');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');
const { asy } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

/**
 * Katalogi domenowe dla UI. Front NIE powiela slownikow ani stawek -
 * wszystko pochodzi z `logika/przepisy.js` (sekcja 16 specyfikacji).
 */
router.get(
  '/meta',
  asy((zad, odp) => {
    odp.json({
      sprint: 1,
      portal_wlaczony: konfiguracja.PORTAL_WLACZONY,
      typy_zdarzen: typyZdarzen.TYPY,
      typy_w_kreatorze: typyZdarzen.dostepneWKreatorze(1).map((t) => t.kod),
      stawki_grosze: przepisy.STAWKI_GROSZE,
      stawki_maksymalne_grosze: przepisy.STAWKI_MAKSYMALNE_GROSZE,
      terminy: przepisy.TERMINY,
      progi_terminu: przepisy.PROGI_TERMINU,
      statusy_spolki: przepisy.STATUSY_SPOLKI,
      statusy_emisji: przepisy.STATUSY_EMISJI,
      aml_statusy: przepisy.AML_STATUSY,
      role_odbiorcy: przepisy.ROLE_ODBIORCY,
      organy_uprawnione: przepisy.ORGANY_UPRAWNIONE,
      formy_zgody: przepisy.FORMY_ZGODY,
      podstawy: przepisy.PODSTAWY,
      nowelizacja: przepisy.NOWELIZACJA,
      pola_wrazliwe: przepisy.POLA_WRAZLIWE,
      dzisiaj: czas.dzisIso(),
    });
  })
);

/** Pulpit: spolki + dyskretny znacznik integralnosci + liczniki. */
router.get(
  '/pulpit',
  asy((zad, odp) => {
    const spolki = db()
      .prepare(
        `SELECT s.id, s.nazwa, s.krs, s.status, s.data_umowy,
                (SELECT COUNT(DISTINCT sa.osoba_id) FROM psa_stan_akcji sa
                  WHERE sa.spolka_id = s.id AND sa.data_do IS NULL
                    AND sa.kategoria = 'akcjonariusz')  AS liczba_akcjonariuszy,
                (SELECT COALESCE(SUM(sa.ilosc), 0) FROM psa_stan_akcji sa
                  WHERE sa.spolka_id = s.id AND sa.data_do IS NULL
                    AND sa.kategoria = 'akcjonariusz')  AS liczba_akcji,
                (SELECT COALESCE(SUM(sa.ilosc), 0) FROM psa_stan_akcji sa
                  WHERE sa.spolka_id = s.id AND sa.data_do IS NULL
                    AND sa.kategoria = 'nieobjeta')     AS akcje_nieobjete,
                (SELECT MAX(z.data_zdarzenia) FROM psa_zdarzenia z
                  WHERE z.spolka_id = s.id)             AS ostatnie_zdarzenie
           FROM psa_spolki s
          ORDER BY ostatnie_zdarzenie DESC NULLS LAST, s.nazwa COLLATE NOCASE`
      )
      .all();

    const liczniki = db()
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM psa_spolki)                                AS spolki,
           (SELECT COUNT(*) FROM psa_spolki WHERE status = 'aktywna')       AS spolki_aktywne,
           (SELECT COUNT(*) FROM psa_osoby)                                 AS osoby,
           (SELECT COUNT(*) FROM psa_zdarzenia)                             AS zdarzenia,
           (SELECT COUNT(DISTINCT osoba_id) FROM psa_stan_akcji
             WHERE data_do IS NULL AND kategoria = 'akcjonariusz')          AS akcjonariusze`
      )
      .get();

    const integralnosc = rejestr.zweryfikujIntegralnosc(db());

    odp.json({
      spolki,
      liczniki,
      integralnosc: {
        ok: integralnosc.ok,
        sprawdzono: integralnosc.sprawdzono,
        blad: integralnosc.blad,
      },
      // Kolejka spraw wchodzi w sprincie 2 (`psa_sprawy`, terminy 7 dni).
      sprawy: { dostepne: false, od_sprintu: 2, pozycje: [] },
      dzisiaj: czas.dzisIso(),
    });
  })
);

/**
 * Weryfikacja lancucha skrotow. Wywolywana nocnie; wynik na pulpicie
 * jako dyskretny znacznik (sekcja 11).
 */
router.get(
  '/integralnosc',
  asy((zad, odp) => {
    const wynik = rejestr.zweryfikujIntegralnosc(db());
    odp.status(wynik.ok ? 200 : 409).json({
      ok: wynik.ok,
      sprawdzono: wynik.sprawdzono,
      blad: wynik.blad,
      komunikat: wynik.ok
        ? `Łańcuch nieprzerwany — zweryfikowano ${wynik.sprawdzono} zdarzeń.`
        : `Łańcuch zerwany przy zdarzeniu #${wynik.blad.id}.`,
    });
  })
);

/**
 * Funkcje uruchamiane z wejsciem nowelizacji (18.02.2027) - sekcja 8.
 * Stub swiadomy: 501 z informacja, kiedy i na jakiej podstawie ruszy.
 */
function stub(podstawa, opis) {
  return asy((zad, odp) => {
    odp.status(501).json({
      blad: 'Funkcja jeszcze nieuruchomiona.',
      opis,
      podstawa,
      uruchomienie: przepisy.NOWELIZACJA.WEJSCIE_W_ZYCIE,
      dziennik: przepisy.NOWELIZACJA.DZIENNIK,
      wymaga_weryfikacji_brzmienia: true,
    });
  });
}

router.all(
  '/sad/zapytania',
  stub(
    przepisy.PODSTAWY.ZAPYTANIE_SADU,
    'Obsługa zapytań sądu rejestrowego o wykaz akcjonariuszy.'
  )
);
router.all(
  '/sad/zawiadomienie-o-rozwiazaniu',
  stub(
    'art. 300(32) § 3 KSH',
    'Zawiadomienie sądu rejestrowego o wygaśnięciu lub rozwiązaniu umowy o prowadzenie rejestru ' +
      `(termin ${przepisy.TERMINY.ZAWIADOMIENIE_SADU_DNI} dni).`
  )
);

module.exports = router;
