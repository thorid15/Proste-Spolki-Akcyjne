'use strict';

/** Pobranie pliku przychodzącego — tylko trasą z autoryzacją, zawsze jako załącznik (§ 7 pkt 3). */

const express = require('express');

const { db } = require('../baza');
const danePliki = require('../dane/pliki');
const dziennik = require('../logika/dziennik-dostepu');
const pliki = require('../pomocnicze/pliki');
const { asy, autor, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

router.get(
  '/:id',
  asy((zad, odp) => {
    const plik = danePliki.wczytaj(db(), zad.params.id);
    if (!plik) throw nieZnaleziono('Nie odnaleziono pliku.');
    dziennik.zapisz(db(), {
      kto: autor(zad),
      typKto: 'pracownik',
      spolkaId: plik.spolka_id,
      osobaId: plik.osoba_id,
      akcja: dziennik.AKCJE.POBRANIE_PLIKU,
      opis: `plik #${plik.id}`,
    });
    pliki.wyslij(odp, plik);
  })
);

module.exports = router;
