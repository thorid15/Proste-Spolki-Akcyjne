'use strict';

/**
 * Pulpit, integralnosc, katalogi (meta), naglowek kancelarii i stuby 501.
 */

const express = require('express');

const { db } = require('../baza');
const rejestr = require('../rejestr');
const widoki = require('../widoki');
const dokumentyTresc = require('../logika/dokumenty-tresc');
const przepisy = require('../logika/przepisy');
const typyZdarzen = require('../logika/typy-zdarzen');
const terminy = require('../logika/terminy');
const dziennikDostepu = require('../logika/dziennik-dostepu');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');
const { wymagajPracownika } = require('../pomocnicze/autoryzacja');

/** Sprint bieżąco obsługiwany przez kreator - decyduje o `typy_w_kreatorze`. */
const SPRINT_KREATORA = typyZdarzen.SPRINT_KREATORA;

const router = express.Router();

/**
 * Katalogi domenowe dla UI. Front NIE powiela slownikow ani stawek -
 * wszystko pochodzi z `logika/przepisy.js` (sekcja 16 specyfikacji).
 */
router.get(
  '/meta',
  asy((zad, odp) => {
    odp.json({
      portal_wlaczony: konfiguracja.PORTAL_WLACZONY,
      podglad_systemu: konfiguracja.PODGLAD_SYSTEMU,
      typy_zdarzen: typyZdarzen.TYPY,
      typy_w_kreatorze: typyZdarzen.dostepneWKreatorze(SPRINT_KREATORA).map((t) => t.kod),
      zrodla_sprawy: przepisy.ZRODLA_SPRAWY,
      stany_sprawy: przepisy.STANY_SPRAWY,
      stawki_grosze: przepisy.STAWKI_GROSZE,
      stawki_maksymalne_grosze: przepisy.STAWKI_MAKSYMALNE_GROSZE,
      terminy: przepisy.TERMINY,
      progi_terminu: przepisy.PROGI_TERMINU,
      cel_wewnetrzny: przepisy.CEL_WEWNETRZNY,
      statusy_spolki: przepisy.STATUSY_SPOLKI,
      statusy_emisji: przepisy.STATUSY_EMISJI,
      aml_statusy: przepisy.AML_STATUSY,
      role_odbiorcy: przepisy.ROLE_ODBIORCY,
      organy_uprawnione: przepisy.ORGANY_UPRAWNIONE,
      rodzaje_akcji: przepisy.RODZAJE_AKCJI,
      stany_pokrycia: przepisy.STANY_POKRYCIA,
      umowe_zawarl: przepisy.UMOWE_ZAWARL,
      charakter_wpisu: przepisy.CHARAKTER_WPISU,
      podstawy: przepisy.PODSTAWY,
      pola_wrazliwe: przepisy.POLA_WRAZLIWE,
      dzisiaj: czas.dzisIso(),
    });
  })
);

/** Pulpit: spolki + dyskretny znacznik integralnosci + liczniki. */
router.get(
  '/pulpit',
  wymagajPracownika,
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

    // Sprawy w toku, posortowane po pozostalym czasie (sekcja 9 - pulpit,
    // <=2 dni = wyroznienie --burgundy, po terminie = wyroznienie).
    const dzis = czas.dzisIso();
    const sprawyWiersze = db()
      .prepare(
        `SELECT sp.*, s.nazwa AS spolka_nazwa
           FROM psa_sprawy sp
           JOIN psa_spolki s ON s.id = sp.spolka_id
          WHERE sp.stan IN ('nowa','weryfikacja','wstrzymana')`
      )
      .all();
    const sprawy = sprawyWiersze
      .map((s) => ({
        id: s.id,
        spolka_id: s.spolka_id,
        spolka_nazwa: s.spolka_nazwa,
        // Typ surowy obok nazwy — pulpit dobiera po nim ikonę wiersza
        // (sesja 6, faza 1). Data wpływu jako druga informacja w wierszu.
        typ_zdarzenia: s.typ_zdarzenia,
        typ_nazwa: typyZdarzen.istnieje(s.typ_zdarzenia) ? typyZdarzen.typ(s.typ_zdarzenia).nazwa : s.typ_zdarzenia,
        data_wplywu: s.data_wplywu,
        stan: s.stan,
        termin: terminy.policzTermin(s, dzis),
      }))
      .sort((a, b) => {
        if ((a.stan === 'wstrzymana') !== (b.stan === 'wstrzymana')) return a.stan === 'wstrzymana' ? 1 : -1;
        return (a.termin.dni_pozostale ?? 999) - (b.termin.dni_pozostale ?? 999);
      });

    odp.json({
      spolki,
      liczniki: { ...liczniki, sprawy_w_toku: sprawy.length },
      integralnosc: {
        ok: integralnosc.ok,
        sprawdzono: integralnosc.sprawdzono,
        blad: integralnosc.blad,
      },
      sprawy: { dostepne: true, pozycje: sprawy },
      dzisiaj: dzis,
    });
  })
);

/**
 * Weryfikacja lancucha skrotow. Wywolywana nocnie; wynik na pulpicie
 * jako dyskretny znacznik (sekcja 11).
 */
router.get(
  '/integralnosc',
  wymagajPracownika,
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
 * Funkcje z nowelizacji (Dz.U. 2026 poz. 176, wejscie 18.02.2027) - sekcja 8.
 * Bramkowane data: przed wejsciem w zycie zwracaja 501 z informacja, kiedy
 * i na jakiej podstawie ruszaja - PO tej dacie wykonuja realna prace.
 * PRZEPISY-PSA.md § 13: pozycje ⚠️ (poza wydrukiem KSH) nie moga byc podstawa
 * walidacji BLOKUJACEJ - obie trasy nizej wylacznie GENERUJA DOKUMENT z juz
 * istniejacych, potwierdzonych danych (stan rejestru, data zakonczenia
 * umowy), nie oceniaja tresci niezweryfikowanego przepisu, wiec ograniczenie
 * to ich nie dotyczy.
 */
function jeszczeNieaktywne(podstawa, opis) {
  return {
    blad: 'Funkcja jeszcze nieuruchomiona.',
    opis,
    podstawa,
    uruchomienie: przepisy.NOWELIZACJA.WEJSCIE_W_ZYCIE,
    dziennik: przepisy.NOWELIZACJA.DZIENNIK,
    wymaga_weryfikacji_brzmienia: true,
  };
}

/** art. 25da ustawy o KRS - sad pozyskuje wykaz akcjonariuszy bezposrednio od podmiotu prowadzacego rejestr. */
router.post(
  '/sad/zapytania',
  wymagajPracownika,
  asy((zad, odp) => {
    if (!przepisy.nowelizacjaObowiazuje(czas.dzisIso())) {
      return odp
        .status(501)
        .json(jeszczeNieaktywne(przepisy.PODSTAWY.ZAPYTANIE_SADU, 'Obsługa zapytań sądu rejestrowego o wykaz akcjonariuszy.'));
    }

    const kto = autor(zad);
    const spolkaId = Number((zad.body || {}).spolka_id);
    const spolka = rejestr.wczytajSpolke(db(), spolkaId);
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');

    const data = (zad.body || {}).data ? String((zad.body || {}).data) : czas.dzisIso();
    if (!czas.poprawnaData(data)) throw bledneZadanie('Parametr „data” musi mieć format RRRR-MM-DD.');

    const stan = widoki.widokStanu(db(), spolkaId, data, { rola: przepisy.ROLE_ODBIORCY.ORGAN });
    const trescHtml = dokumentyTresc.wykazAkcjonariuszy({
      kancelaria: konfiguracja.KANCELARIA,
      spolka: stan.spolka,
      data,
      stan,
      powod: `zapytanie sądu rejestrowego (${przepisy.PODSTAWY.ZAPYTANIE_SADU})${
        (zad.body || {}).opis_wniosku ? ` — ${String((zad.body || {}).opis_wniosku).trim()}` : ''
      }`,
    });

    db()
      .prepare(
        `INSERT INTO psa_wydane_dokumenty (spolka_id, typ, kanal, tresc_html, autor, utworzono)
         VALUES (?, 'wykaz_akcjonariuszy', 'papier', ?, ?, ?)`
      )
      .run(spolkaId, trescHtml, kto, czas.terazIso());

    // Wykaz calego akcjonariatu spolki dla sadu - blok D4, zakres WASKI.
    dziennikDostepu.zapisz(db(), {
      kto, typKto: 'pracownik', spolkaId, akcja: dziennikDostepu.AKCJE.RAPORT_SAD,
      opis: 'wykaz akcjonariuszy — zapytanie sądu rejestrowego',
    });

    odp.json({ tresc_html: trescHtml });
  })
);

/** art. 300(32) § 3 KSH - zawiadomienie sadu rejestrowego o wygasnieciu/rozwiazaniu umowy. */
router.post(
  '/sad/zawiadomienie-o-rozwiazaniu',
  wymagajPracownika,
  asy((zad, odp) => {
    if (!przepisy.nowelizacjaObowiazuje(czas.dzisIso())) {
      return odp.status(501).json(
        jeszczeNieaktywne(
          'art. 300(32) § 3 KSH',
          'Zawiadomienie sądu rejestrowego o wygaśnięciu lub rozwiązaniu umowy o prowadzenie rejestru ' +
            `(termin ${przepisy.TERMINY.ZAWIADOMIENIE_SADU_DNI} dni).`
        )
      );
    }

    const kto = autor(zad);
    const spolkaId = Number((zad.body || {}).spolka_id);
    const spolka = rejestr.wczytajSpolke(db(), spolkaId);
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
    if (!spolka.data_zakonczenia_umowy) {
      throw bledneZadanie('Spółka nie ma ustawionej daty zakończenia umowy o prowadzenie rejestru.');
    }

    const trescHtml = dokumentyTresc.zawiadomienieSaduORozwiazaniu({
      kancelaria: konfiguracja.KANCELARIA,
      spolka,
      dataZakonczenia: spolka.data_zakonczenia_umowy,
      tryb: (zad.body || {}).tryb || 'rozwiązaniu',
    });

    db()
      .prepare(
        `INSERT INTO psa_wydane_dokumenty (spolka_id, typ, kanal, tresc_html, autor, utworzono)
         VALUES (?, 'zawiadomienie_sad_rozwiazanie', 'papier', ?, ?, ?)`
      )
      .run(spolkaId, trescHtml, kto, czas.terazIso());

    odp.json({ tresc_html: trescHtml });
  })
);

module.exports = router;
