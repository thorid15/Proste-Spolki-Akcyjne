'use strict';

/**
 * Trasy `/api/psa/zgloszenia/...` - zglobszenia wstepne portalu (etap 3A).
 *
 * Pierwszy kontakt nieznanego dotad klienta (formularz publiczny,
 * `server/trasy/portal.js: POST /zgloszenia`) - kancelaria przeglada liste
 * i decyduje: zaprosic (etap 3B - tworzy konto portalowe + wysyla token
 * aktywacyjny) albo odrzucic. Samo zgloszenie NIE zaklada zadnego konta ani
 * spolki - to wylacznie lead do oceny.
 */

const express = require('express');

const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

router.get(
  '/',
  asy((zad, odp) => {
    const warunki = [];
    const parametry = [];
    if (zad.query.status) {
      warunki.push('status = ?');
      parametry.push(String(zad.query.status));
    }
    const gdzie = warunki.length ? `WHERE ${warunki.join(' AND ')}` : '';
    const wiersze = db()
      .prepare(`SELECT * FROM psa_zgloszenia ${gdzie} ORDER BY utworzono DESC`)
      .all(...parametry);
    odp.json({ zgloszenia: wiersze });
  })
);

router.get(
  '/:id',
  asy((zad, odp) => {
    const wiersz = db().prepare('SELECT * FROM psa_zgloszenia WHERE id = ?').get(Number(zad.params.id));
    if (!wiersz) throw nieZnaleziono('Nie odnaleziono zgłoszenia.');
    odp.json({ zgloszenie: wiersz });
  })
);

router.post(
  '/:id/odrzuc',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const wiersz = db().prepare('SELECT * FROM psa_zgloszenia WHERE id = ?').get(id);
    if (!wiersz) throw nieZnaleziono('Nie odnaleziono zgłoszenia.');
    if (wiersz.status !== 'nowe') {
      throw bledneZadanie(`Zgłoszenie ma już status „${wiersz.status}” — nie można go ponownie odrzucić.`);
    }
    const notatka = String((zad.body || {}).notatka || '').trim() || null;

    db()
      .prepare(
        `UPDATE psa_zgloszenia
            SET status = 'odrzucone', notatka_wewnetrzna = ?, obsluzone_przez = ?, obsluzone_kiedy = ?
          WHERE id = ?`
      )
      .run(notatka, autor(zad), czas.terazIso(), id);

    odp.json({ zgloszenie: db().prepare('SELECT * FROM psa_zgloszenia WHERE id = ?').get(id) });
  })
);

module.exports = router;
