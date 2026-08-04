'use strict';

/**
 * Trasy `/api/wspolne/...` - rdzen kancelarii.
 *
 * Naglowek dokumentow (`rdzen_kancelaria`). W module PSA czytamy go
 * z konfiguracji; po scaleniu z rdzeniem kancelarii zrodlo sie zmieni,
 * kontrakt endpointu zostaje.
 */

const express = require('express');

const konfiguracja = require('../konfiguracja');
const { asy } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

router.get(
  '/kancelaria',
  asy((zad, odp) => {
    odp.json({ kancelaria: konfiguracja.KANCELARIA });
  })
);

module.exports = router;
