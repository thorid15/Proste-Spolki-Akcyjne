'use strict';

/**
 * Trasa `/api/psa/platnosci/tpay/itn` — powiadomienie od operatora.
 *
 * JEDYNE zrodlo prawdy o zaplacie. Stoi POZA bramka sesji pracownika
 * i poza sesja portalu: puka do niej serwer tpay, nie przegladarka.
 * Jej bezpieczenstwo nie opiera sie wiec na sesji, tylko na tym, czego
 * atakujacy nie moze podrobic.
 *
 * TRZY WARSTWY SPRAWDZENIA, w kolejnosci wagi:
 *   1. suma kontrolna MD5 liczona sekretem powiadomien — ODRZUCA,
 *   2. podpis JWS z naglowka `X-JWS-Signature` — ODRZUCA, gdy jest obecny
 *      i sie nie zgadza; jego brak sam w sobie nie ksieguje niczego, bo
 *      warstwa pierwsza i tak musi przejsc,
 *   3. adres nadawcy z listy operatora — WYLACZNIE sygnal do logu, nigdy
 *      odmowa: adresy sie zmieniaja i blokada na nich potrafi wyciac
 *      prawdziwe platnosci.
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
const tpay = require('../logika/tpay');

const router = express.Router();

/**
 * tpay wysyla powiadomienie jako `application/x-www-form-urlencoded`.
 * Limit rozmiaru jest ciasny celowo: to kilkanascie krotkich pol, a trasa
 * jest publiczna.
 *
 * `verify` zachowuje SUROWE cialo — podpis JWS obejmuje dokladnie te bajty,
 * ktore przyszly. Sparsowanie i ponowne zlozenie zmienia kolejnosc
 * i kodowanie, a wtedy podpis nigdy sie nie zgadza.
 */
const przyjmijFormularz = express.urlencoded({
  extended: false,
  limit: '16kb',
  verify: (zad, odp, bufor) => { zad.suroweCialo = bufor; },
});

router.post(
  '/tpay/itn',
  przyjmijFormularz,
  async (zad, odp) => {
    const zakoncz = (opis) => {
      // Metadane techniczne, bez tresci platnosci — sekcja 11 specyfikacji.
      console.log(`[psa] ITN tpay — ${opis}`);
      odp.status(200).type('text/plain').send('TRUE');
    };

    // Warstwa 3 — wylacznie sygnal. Nieznany adres NIE odrzuca powiadomienia.
    const zObcegoAdresu = !tpay.zAdresuOperatora(zad.ip);

    // Warstwa 2 — podpis JWS. Gdy naglowek przyszedl, MUSI sie zgadzac:
    // podrobiony podpis to proba oszustwa, nie usterka lacza.
    const naglowekJws = zad.get('X-JWS-Signature');
    if (naglowekJws) {
      let jws;
      try {
        jws = await tpay.sprawdzPodpisJws(naglowekJws, zad.suroweCialo || Buffer.alloc(0));
      } catch (e) {
        jws = { ok: false, powod: e.message };
      }
      if (!jws.ok) return zakoncz(`odrzucone (podpis JWS): ${jws.powod}`);
    }

    // Warstwa 1 — suma kontrolna i tresc. Bez niej nic sie nie ksieguje.
    let wynik;
    try {
      wynik = platnosci.przyjmijPowiadomienie(db(), zad.body || {});
    } catch (e) {
      // Awaria po NASZEJ stronie: nie potwierdzamy, zeby operator ponowil.
      console.error(`[psa] ITN tpay — błąd przetwarzania: ${e.name}: ${e.message}`);
      return odp.status(500).type('text/plain').send('FALSE');
    }

    const skad = zObcegoAdresu ? ' [adres spoza listy operatora]' : '';
    const bezPodpisu = naglowekJws ? '' : ' [bez podpisu JWS]';
    if (!wynik.ok) return zakoncz(`odrzucone: ${wynik.powod}${skad}${bezPodpisu}`);
    return zakoncz(
      (wynik.zaksiegowano ? 'zaksięgowano płatność' : (wynik.powod || 'przyjęte')) + skad + bezPodpisu
    );
  }
);

module.exports = router;
