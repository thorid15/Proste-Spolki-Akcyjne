'use strict';

/**
 * Trasy `/api/psa/zgloszenia-nieprawidlowosci/...` — B9, FAZA 2 sesji
 * frontendowej.
 *
 * Klient zgłasza z portalu, że wpis w rejestrze jest błędny albo niezgodny
 * z dokumentem (`server/trasy/portal.js: POST /zgloszenie-nieprawidlowosci`)
 * — odrębnie od żądania NOWEGO wpisu (`POST /zadania`, sprawa
 * `psa_sprawy`). Pracownik tutaj wyłącznie KWALIFIKUJE zgłoszenie:
 *   - „sprostowanie” — dokonuje go zwykłym kreatorem zdarzenia (typ
 *     „sprostowanie”), append-only, jak każdy inny wpis (art. 300³¹ § 4 KSH);
 *   - „zadanie_wpisu” — klient pomylił ścieżki, to w istocie żądanie
 *     nowego wpisu (art. 300³⁴ § 1 KSH) — kieruje go do właściwej;
 *   - „brak_nieprawidlowosci” — rejestr jest poprawny.
 * Sama kwalifikacja NIE zakłada sprawy ani wpisu — to świadoma, osobna
 * czynność pracownika w kreatorze zdarzenia (K3), tak jak przy każdym innym
 * wpisie.
 */

const express = require('express');

const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

const KWALIFIKACJE = ['sprostowanie', 'zadanie_wpisu', 'brak_nieprawidlowosci'];

router.get(
  '/',
  asy((zad, odp) => {
    const warunki = [];
    const parametry = [];
    if (zad.query.stan) {
      warunki.push('z.stan = ?');
      parametry.push(String(zad.query.stan));
    }
    if (zad.query.spolka_id) {
      warunki.push('z.spolka_id = ?');
      parametry.push(Number(zad.query.spolka_id));
    }
    const gdzie = warunki.length ? `WHERE ${warunki.join(' AND ')}` : '';
    const wiersze = db()
      .prepare(
        `SELECT z.*, s.nazwa AS spolka_nazwa, k.email AS konto_email
           FROM psa_zgloszenia_nieprawidlowosci z
           JOIN psa_spolki s ON s.id = z.spolka_id
           JOIN psa_konta k ON k.id = z.konto_id
          ${gdzie}
          ORDER BY z.utworzono DESC`
      )
      .all(...parametry);
    odp.json({ zgloszenia: wiersze });
  })
);

router.get(
  '/:id',
  asy((zad, odp) => {
    const wiersz = db()
      .prepare(
        `SELECT z.*, s.nazwa AS spolka_nazwa, k.email AS konto_email
           FROM psa_zgloszenia_nieprawidlowosci z
           JOIN psa_spolki s ON s.id = z.spolka_id
           JOIN psa_konta k ON k.id = z.konto_id
          WHERE z.id = ?`
      )
      .get(Number(zad.params.id));
    if (!wiersz) throw nieZnaleziono('Nie odnaleziono zgłoszenia.');
    odp.json({ zgloszenie: wiersz });
  })
);

router.post(
  '/:id/kwalifikuj',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const wiersz = db().prepare('SELECT * FROM psa_zgloszenia_nieprawidlowosci WHERE id = ?').get(id);
    if (!wiersz) throw nieZnaleziono('Nie odnaleziono zgłoszenia.');

    const kwalifikacja = String((zad.body || {}).kwalifikacja || '');
    if (!KWALIFIKACJE.includes(kwalifikacja)) {
      throw bledneZadanie(`Kwalifikacja musi być jedną z: ${KWALIFIKACJE.join(', ')}.`);
    }
    const notatka = String((zad.body || {}).notatka || '').trim() || null;

    db()
      .prepare(
        `UPDATE psa_zgloszenia_nieprawidlowosci
            SET stan = 'zakwalifikowane', kwalifikacja = ?, notatka_kancelarii = ?,
                autor_kwalifikacji = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(kwalifikacja, notatka, autor(zad), czas.terazIso(), id);

    odp.json({
      zgloszenie: db().prepare('SELECT * FROM psa_zgloszenia_nieprawidlowosci WHERE id = ?').get(id),
    });
  })
);

module.exports = router;
