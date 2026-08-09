'use strict';

/**
 * Trasy `/api/psa/szablony/...` - redakcja szablonów dokumentów (faza 4).
 *
 * Szablon jest NIEZMIENIALNY: nie ma tu PUT-a ani DELETE. Redakcja zakłada
 * kolejną wersję (POST /:kod/wersje), a przywrócenie wcześniejszej to zmiana
 * aktywnej wersji (POST /:kod/aktywuj), nigdy podmiana treści. Baza pilnuje
 * tego wyzwalaczami - te trasy tylko nie próbują ich obchodzić.
 *
 * Redakcja jest zastrzeżona dla administratora: treść szablonu wychodzi na
 * pismach o skutkach prawnych.
 */

const express = require('express');

const { db } = require('../baza');
const dokumenty = require('../dokumenty');
const szablonySilnik = require('../logika/szablony');
const { DANE_PROBNE } = require('../logika/szablony-wbudowane');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');
const { wymagajAdmina } = require('../pomocnicze/autoryzacja');

const router = express.Router();

/** Nagłówek kancelarii do podglądu - ten sam, co na wydaniu. */
function kancelariaZKonfiguracji() {
  return { ...konfiguracja.KANCELARIA, notariusz: konfiguracja.KANCELARIA.nazwa };
}

/** Spółka przykładowa do podglądu - jawnie fikcyjna, patrz DANE_PROBNE. */
const SPOLKA_PROBNA = {
  nazwa: 'WIATRAKI POLSKIE P.S.A.',
  krs: '0000998877',
  miejscowosc: 'Kraków',
  ulica: 'Długa',
  nr_domu: '5',
  nr_lokalu: '2',
  kod_pocztowy: '31-100',
};

/** Lista aktywnych szablonów - po jednym na kod. */
router.get(
  '/',
  wymagajAdmina,
  asy((zad, odp) => {
    const aktywne = dokumenty.wszystkieAktywne(db());
    const liczbaWersji = db()
      .prepare('SELECT kod, COUNT(*) AS ile FROM psa_szablony GROUP BY kod')
      .all();
    const wg = new Map(liczbaWersji.map((w) => [w.kod, w.ile]));

    odp.json({
      szablony: aktywne.map((s) => ({
        ...s,
        wersji: wg.get(s.kod) || 1,
        klucze: szablonySilnik.uzyteKlucze(s.tresc),
      })),
    });
  })
);

/** Wszystkie wersje jednego kodu - historia redakcji. */
router.get(
  '/:kod',
  wymagajAdmina,
  asy((zad, odp) => {
    const wersje = dokumenty.wersje(db(), zad.params.kod);
    if (wersje.length === 0) throw nieZnaleziono('Nie ma takiego szablonu.');
    odp.json({
      kod: zad.params.kod,
      wersje: wersje.map((w) => ({ ...w, klucze: szablonySilnik.uzyteKlucze(w.tresc) })),
    });
  })
);

/**
 * Podgląd na danych próbnych - PRZED wydaniem czegokolwiek.
 *
 * Przyjmuje treść z edytora (jeszcze niezapisaną), żeby dało się zobaczyć
 * skutek redakcji bez zakładania wersji. Zwraca też listę nieuzupełnionych
 * kluczy - to ona jest właściwą wartością podglądu, bo literówka w nazwie
 * pola nie widać na oko w gotowym piśmie.
 */
router.post(
  '/podglad',
  wymagajAdmina,
  asy((zad, odp) => {
    const { tresc, tytul, podstawa_prawna } = zad.body || {};
    if (!tresc) throw bledneZadanie('Podaj treść szablonu do podglądu.');

    const kancelaria = kancelariaZKonfiguracji();
    const dane = {
      ...dokumenty.daneWspolne({
        spolka: SPOLKA_PROBNA,
        kancelaria,
        dzis: czas.dzisIso(),
      }),
      ...DANE_PROBNE,
    };
    const wynik = szablonySilnik.renderuj(String(tresc), dane);

    odp.json({
      html: dokumenty.ramka({
        tytul: tytul || 'Podgląd szablonu',
        kancelaria,
        tresc: wynik.html,
        podstawaPrawna: podstawa_prawna || null,
        dataSporzadzenia: czas.dzisIso(),
      }),
      brakujace: wynik.brakujace,
      bledy: wynik.bledy,
      klucze: szablonySilnik.uzyteKlucze(String(tresc)),
      na_danych_probnych: true,
    });
  })
);

/** Nowa wersja szablonu. Poprzednia zostaje - jest podstawą wydanych pism. */
router.post(
  '/:kod/wersje',
  wymagajAdmina,
  asy((zad, odp) => {
    const { tytul, tresc, opis, podstawa_prawna } = zad.body || {};
    if (!tytul || !String(tytul).trim()) throw bledneZadanie('Podaj tytuł dokumentu.');
    if (!tresc || !String(tresc).trim()) throw bledneZadanie('Podaj treść szablonu.');

    const istnieje = dokumenty.wersje(db(), zad.params.kod);
    if (istnieje.length === 0) throw nieZnaleziono('Nie ma takiego szablonu.');

    // Blad skladni bloku psulby kazde pismo z tego szablonu - nie wpuszczamy.
    const proba = szablonySilnik.renderuj(String(tresc), {});
    if (proba.bledy.length > 0) {
      throw bledneZadanie(`Szablon ma błąd składni: ${proba.bledy.join(' ')}`);
    }

    const nowa = dokumenty.nowaWersja(db(), {
      kod: zad.params.kod,
      tytul: String(tytul).trim(),
      tresc: String(tresc),
      opis: opis ? String(opis).trim() : null,
      podstawa_prawna: podstawa_prawna ? String(podstawa_prawna).trim() : null,
      autor: autor(zad),
    });
    odp.status(201).json({ szablon: nowa });
  })
);

/** Przywrócenie wcześniejszej wersji jako aktywnej - bez zmiany jej treści. */
router.post(
  '/:kod/aktywuj',
  wymagajAdmina,
  asy((zad, odp) => {
    const wersja = Number((zad.body || {}).wersja);
    if (!Number.isInteger(wersja)) throw bledneZadanie('Podaj numer wersji do aktywacji.');
    try {
      odp.json({ szablon: dokumenty.aktywuj(db(), zad.params.kod, wersja) });
    } catch (e) {
      throw nieZnaleziono(e.message);
    }
  })
);

module.exports = router;
