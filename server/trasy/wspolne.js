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
const ustawienia = require('../logika/ustawienia');
const { db } = require('../baza');
const { asy } = require('../pomocnicze/odpowiedzi');

const POLA_PUBLICZNE = ['nazwa', 'adres', 'miejscowosc', 'email', 'telefon', 'www', 'www_psa'];

const router = express.Router();

router.get(
  '/kancelaria',
  asy((zad, odp) => {
    // Audyt N2: trasa jest publiczna — oddaje tylko to, co stoi w stopce i nagłówku (bez NIP, osób zawierających umowy itd.).
    const k = ustawienia.kancelaria(db());
    odp.json({ kancelaria: Object.fromEntries(POLA_PUBLICZNE.map((pole) => [pole, k[pole] ?? ''])) });
  })
);

module.exports = router;
