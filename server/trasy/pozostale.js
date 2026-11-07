'use strict';

/**
 * Ustawienia (tylko administrator): dane kancelarii i kontrola integralności rejestru na żądanie
 * (U-20).
 */

const express = require('express');

const { db } = require('../baza');
const rejestr = require('../rejestr');
const ustawienia = require('../logika/ustawienia');
const dziennik = require('../logika/dziennik-dostepu');
const { asy, autor, bledneZadanie } = require('../pomocnicze/odpowiedzi');
const { wymagajAdmina } = require('../pomocnicze/autoryzacja');

const router = express.Router();

router.get(
  '/ustawienia',
  wymagajAdmina,
  asy((zad, odp) => {
    odp.json(ustawienia.doEkranu(db()));
  })
);

router.put(
  '/ustawienia',
  wymagajAdmina,
  asy((zad, odp) => {
    const zmiany = zad.body || {};
    const bledy = ustawienia.bledy(zmiany);
    if (bledy.length > 0) throw bledneZadanie('Nie zapisano — popraw wskazane pola.', bledy);
    const zmienione = ustawienia.zapisz(db(), zmiany, autor(zad));
    if (zmienione.length > 0) {
      dziennik.zapisz(db(), {
        kto: autor(zad),
        typKto: 'pracownik',
        akcja: dziennik.AKCJE.ZMIANA_USTAWIEN,
        opis: `zmieniono ustawienia: ${zmienione.join(', ')}`,
      });
    }
    odp.json({ ...ustawienia.doEkranu(db()), zmienione });
  })
);

router.post(
  '/integralnosc',
  wymagajAdmina,
  asy((zad, odp) => {
    odp.json(rejestr.zweryfikujIntegralnosc(db()));
  })
);

module.exports = router;
