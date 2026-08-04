'use strict';

/**
 * Trasy `/api/psa/zdarzenia/...`.
 *
 * Sprostowanie jest jedyna droga korekty zdarzenia (regula domenowa nr 1) -
 * dlatego ma wlasny, dedykowany endpoint (sekcja 8), poza kreatorem spolki
 * i poza workflow sprawy.
 */

const express = require('express');

const { db } = require('../baza');
const rejestr = require('../rejestr');
const widoki = require('../widoki');
const typyZdarzen = require('../logika/typy-zdarzen');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

/** Podglad zdarzenia - do ekranu sprostowania (pokazuje, co sie prostuje). */
router.get(
  '/:id',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const zdarzenie = db().prepare('SELECT * FROM psa_zdarzenia WHERE id = ?').get(id);
    if (!zdarzenie) throw nieZnaleziono('Nie odnaleziono zdarzenia.');

    const osoby = rejestr.wczytajOsobySpolki(db(), zdarzenie.spolka_id);
    const dane = JSON.parse(zdarzenie.dane_json);
    const jużSprostowane = db()
      .prepare('SELECT id FROM psa_zdarzenia WHERE zdarzenie_prostowane_id = ?')
      .get(id);

    odp.json({
      zdarzenie: {
        ...zdarzenie,
        dane,
        hash_skrocony: zdarzenie.hash.slice(0, 12),
        podsumowanie: widoki.podsumujZdarzenie({ ...zdarzenie, dane }, osoby),
      },
      typ: typyZdarzen.istnieje(zdarzenie.typ) ? typyZdarzen.typ(zdarzenie.typ) : null,
      mozna_sprostowac: zdarzenie.typ !== 'sprostowanie' && !jużSprostowane,
      sprostowane_przez: jużSprostowane ? jużSprostowane.id : null,
    });
  })
);

/**
 * Sprostowanie. `zamiast` jest opcjonalne - bez niego zdarzenie zostaje jako
 * czysta adnotacja (uzasadnienie bez zmiany tresci prostowanego zdarzenia).
 */
router.post(
  '/:id/sprostuj',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const kto = autor(zad);
    const { uzasadnienie, zamiast, data_zdarzenia } = zad.body || {};
    if (!uzasadnienie || !String(uzasadnienie).trim()) {
      throw bledneZadanie('Sprostowanie wymaga uzasadnienia.');
    }

    const wynik = rejestr.dokonajSprostowania(db(), {
      zdarzeniePierwotneId: id,
      uzasadnienie,
      zamiast: zamiast || null,
      autor: kto,
      data_zdarzenia,
    });

    odp.status(201).json({
      zdarzenie: {
        id: wynik.zdarzenie.id,
        typ: wynik.zdarzenie.typ,
        data_zdarzenia: wynik.zdarzenie.data_zdarzenia,
        data_wpisu: wynik.zdarzenie.data_wpisu,
        hash_skrocony: wynik.zdarzenie.hash.slice(0, 12),
      },
      ostrzezenia: wynik.ostrzezenia,
    });
  })
);

module.exports = router;
