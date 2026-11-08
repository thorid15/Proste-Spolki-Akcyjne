'use strict';

/** Opłaty (§ 5): filtr do zapłaty / opłacone / wszystkie, „Opłacona”, numer faktury, „Anuluj” (powód), CSV. */

const express = require('express');
const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const oplaty = require('../oplaty');
const { asy } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

router.get(
  '/',
  asy((zad, odp) => {
    odp.json(oplaty.lista(db(), { filtr: zad.query.filtr || 'do_zaplaty' }));
  })
);

router.get(
  '/csv',
  asy((zad, odp) => {
    const tresc = oplaty.csv(oplaty.lista(db(), { filtr: zad.query.filtr || 'wszystkie' }));
    odp.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="oplaty-${czas.dzisIso()}.csv"`,
      'X-Content-Type-Options': 'nosniff',
    });
    odp.send(`﻿${tresc}`);
  })
);

router.post(
  '/:id/oplacona',
  asy((zad, odp) => {
    odp.json(oplaty.oplacona(db(), zad.params.id));
  })
);

router.post(
  '/:id/anuluj',
  asy((zad, odp) => {
    odp.json(oplaty.anuluj(db(), zad.params.id, (zad.body || {}).powod));
  })
);

router.put(
  '/:id/faktura',
  asy((zad, odp) => {
    odp.json(oplaty.ustawFakture(db(), zad.params.id, (zad.body || {}).numer_faktury));
  })
);

module.exports = router;
