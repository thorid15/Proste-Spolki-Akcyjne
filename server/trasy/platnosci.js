'use strict';

/**
 * Trasa `/api/psa/platnosci/tpay/itn` — powiadomienie od operatora.
 *
 * JEDYNE zrodlo prawdy o zaplacie. Stoi POZA bramka sesji pracownika
 * i poza sesja portalu: puka do niej serwer tpay, nie przegladarka.
 * Jej bezpieczenstwo nie opiera sie wiec na sesji, tylko na sumie
 * kontrolnej liczonej sekretem, ktory znamy tylko my i operator.
 *
 * Trzy rzeczy, od ktorych nie odstepujemy:
 *   1. odpowiedz to czysty tekst `TRUE` — cokolwiek innego (HTML, JSON,
 *      biale znaki) kaze operatorowi ponawiac powiadomienie w kolko;
 *   2. na tresc powiadomienia nie odpowiadamy bledem 500 — falszywy podpis
 *      i nieznana transakcja to zdarzenia do zalogowania, nie awarie;
 *   3. zaden blad nie wycieka do odpowiedzi — to kanal publiczny.
 */

const express = require('express');

const { db } = require('../baza');
const platnosci = require('../platnosci');

const router = express.Router();

/**
 * tpay wysyla powiadomienie jako `application/x-www-form-urlencoded`.
 * Limit rozmiaru jest ciasny celowo: to kilkanascie krotkich pol, a trasa
 * jest publiczna.
 */
router.post(
  '/tpay/itn',
  express.urlencoded({ extended: false, limit: '16kb' }),
  (zad, odp) => {
    const zakoncz = (opis) => {
      // Metadane techniczne, bez tresci platnosci — sekcja 11 specyfikacji.
      console.log(`[psa] ITN tpay — ${opis}`);
      odp.status(200).type('text/plain').send('TRUE');
    };

    let wynik;
    try {
      wynik = platnosci.przyjmijPowiadomienie(db(), zad.body || {});
    } catch (e) {
      // Awaria po NASZEJ stronie: nie potwierdzamy, zeby operator ponowil.
      console.error(`[psa] ITN tpay — błąd przetwarzania: ${e.name}: ${e.message}`);
      return odp.status(500).type('text/plain').send('FALSE');
    }

    if (!wynik.ok) return zakoncz(`odrzucone: ${wynik.powod}`);
    return zakoncz(wynik.zaksiegowano ? 'zaksięgowano płatność' : (wynik.powod || 'przyjęte'));
  }
);

module.exports = router;
