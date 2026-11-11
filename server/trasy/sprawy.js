'use strict';

/**
 * Sprawy (ekran sprawy = kreator wpisu, § 5). Kroki: POST /:id/krok (2 — „Dalej”, 1 — „Zmień
 * treść”); stan: POST /:id/stan (wstrzymana, w_toku, odmowa, wycofana, wpisana).
 */

const express = require('express');

const { db } = require('../baza');
const sprawy = require('../sprawy');
const daneSprawy = require('../dane/sprawy');
const pliki = require('../pomocnicze/pliki');
const { asy, autor, nieZnaleziono, bledneZadanie, dalejPoUploadzie } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

function wymagajSprawy(zad) {
  const sprawa = daneSprawy.wczytaj(db(), zad.params.id);
  if (!sprawa) throw nieZnaleziono('Nie odnaleziono sprawy.');
  return sprawa;
}

router.get(
  '/',
  asy((zad, odp) => {
    const stany = zad.query.stan ? String(zad.query.stan).split(',') : null;
    odp.json(sprawy.lista(db(), { spolkaId: zad.query.spolka_id || null, stany }));
  })
);

router.post(
  '/',
  asy((zad, odp) => {
    const wynik = sprawy.zaloz(db(), zad.body || {}, autor(zad));
    odp.status(wynik.istniala ? 200 : 201).json(sprawy.podglad(db(), wynik.id));
  })
);

router.get(
  '/:id',
  asy((zad, odp) => {
    const s = wymagajSprawy(zad);
    odp.json(sprawy.podglad(db(), s.id));
  })
);

router.put(
  '/:id',
  asy((zad, odp) => {
    const s = wymagajSprawy(zad);
    sprawy.zmien(db(), s.id, zad.body || {}, autor(zad));
    odp.json(sprawy.podglad(db(), s.id));
  })
);

router.post(
  '/:id/krok',
  asy((zad, odp) => {
    const s = wymagajSprawy(zad);
    const krok = Number((zad.body || {}).krok);
    if (krok === 2) sprawy.dalej(db(), s.id, autor(zad));
    else if (krok === 1) sprawy.zmienTresc(db(), s.id);
    else throw bledneZadanie('Krok: 2 („Dalej”) albo 1 („Zmień treść”).');
    odp.json(sprawy.podglad(db(), s.id));
  })
);

router.post(
  '/:id/stan',
  asy((zad, odp) => {
    const s = wymagajSprawy(zad);
    const cialo = zad.body || {};
    sprawy.zmienStan(db(), s.id, cialo.stan, cialo, autor(zad));
    odp.json(sprawy.podglad(db(), s.id));
  })
);

router.post(
  '/:id/pliki',
  (zad, odp, dalej) => pliki.odbierz(zad, odp, dalejPoUploadzie(dalej)),
  asy((zad, odp) => {
    const s = wymagajSprawy(zad);
    const id = pliki.przyjmij(db(), zad.file, { spolka_id: s.spolka_id, sprawa_id: s.id }, autor(zad));
    odp.status(201).json({ id });
  })
);

module.exports = router;
