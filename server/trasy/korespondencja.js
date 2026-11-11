'use strict';

/** Korespondencja (§ 5, U-09): lista według filtra, podgląd, „Wyślij” / „Wyślij ponownie”, „Nadano”. */

const express = require('express');
const { db } = require('../baza');
const korespondencja = require('../korespondencja');
const pisma = require('../logika/pisma');
const { asy } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

router.get(
  '/',
  asy((zad, odp) => {
    odp.json(korespondencja.lista(db(), { filtr: zad.query.filtr || 'do_wyslania' }));
  })
);

router.get(
  '/:id',
  asy((zad, odp) => {
    odp.json(korespondencja.szczegoly(db(), zad.params.id));
  })
);

/** Podgląd PDF — ten sam plik przy każdym pobraniu (pismo powstaje raz). */
router.get(
  '/:id/pdf',
  asy(async (zad, odp) => {
    const p = pisma.wczytaj(db(), zad.params.id);
    const pdf = await pisma.pdf(db(), p.id);
    odp.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${p.numer.replace(/\//g, '-')}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
    });
    odp.send(pdf);
  })
);

router.post(
  '/:id/wyslij',
  asy(async (zad, odp) => {
    await korespondencja.wyslij(db(), zad.params.id);
    odp.json(korespondencja.szczegoly(db(), zad.params.id));
  })
);

router.post(
  '/:id/nadano',
  asy((zad, odp) => {
    korespondencja.nadano(db(), zad.params.id);
    odp.json(korespondencja.szczegoly(db(), zad.params.id));
  })
);

module.exports = router;
