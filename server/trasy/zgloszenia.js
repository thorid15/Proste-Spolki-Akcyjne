'use strict';

/**
 * Trasy `/api/psa/zgloszenia/...` - zglobszenia wstepne portalu (etap 3A).
 *
 * Pierwszy kontakt nieznanego dotad klienta (formularz publiczny,
 * `server/trasy/portal.js: POST /zgloszenia`) - zaproszenie do portalu
 * (etap 3B - konto + token aktywacyjny) idzie OD RAZU, automatycznie, przy
 * samym zgloszeniu (patrz `server/logika/zaproszenia.js: wyslij()`).
 * `POST /:id/zapros` ponizej sluzy do PONOWNEJ wysylki (np. gdy mail odbil
 * sie albo klient zgubil link) - nie do podjecia pierwszej decyzji.
 */

const express = require('express');

const { db } = require('../baza');
const ustawienia = require('../logika/ustawienia');
const zapros = require('../logika/zaproszenia');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

// Link aktywacyjny (etap 3B) - wazny tydzien, jak typowe zaproszenia SaaS;
// po wygasnieciu kancelaria zaprasza ponownie (nowy token nadpisuje stary).
router.get(
  '/',
  asy((zad, odp) => {
    const warunki = [];
    const parametry = [];
    if (zad.query.status) {
      warunki.push('status = ?');
      parametry.push(String(zad.query.status));
    }
    const gdzie = warunki.length ? `WHERE ${warunki.join(' AND ')}` : '';
    const wiersze = db()
      .prepare(`SELECT * FROM psa_zgloszenia ${gdzie} ORDER BY utworzono DESC`)
      .all(...parametry);
    odp.json({ zgloszenia: wiersze });
  })
);

router.get(
  '/:id',
  asy((zad, odp) => {
    const wiersz = db().prepare('SELECT * FROM psa_zgloszenia WHERE id = ?').get(Number(zad.params.id));
    if (!wiersz) throw nieZnaleziono('Nie odnaleziono zgłoszenia.');
    odp.json({ zgloszenie: wiersz });
  })
);

router.post(
  '/:id/odrzuc',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const wiersz = db().prepare('SELECT * FROM psa_zgloszenia WHERE id = ?').get(id);
    if (!wiersz) throw nieZnaleziono('Nie odnaleziono zgłoszenia.');
    if (wiersz.status !== 'nowe') {
      throw bledneZadanie(`Zgłoszenie ma już status „${wiersz.status}” — nie można go ponownie odrzucić.`);
    }
    const notatka = String((zad.body || {}).notatka || '').trim() || null;

    db()
      .prepare(
        `UPDATE psa_zgloszenia
            SET status = 'odrzucone', notatka_wewnetrzna = ?, obsluzone_przez = ?, obsluzone_kiedy = ?
          WHERE id = ?`
      )
      .run(notatka, autor(zad), czas.terazIso(), id);

    odp.json({ zgloszenie: db().prepare('SELECT * FROM psa_zgloszenia WHERE id = ?').get(id) });
  })
);

router.post(
  '/:id/zapros',
  asy(async (zad, odp) => {
    const id = Number(zad.params.id);
    const zgloszenie = db().prepare('SELECT * FROM psa_zgloszenia WHERE id = ?').get(id);
    if (!zgloszenie) throw nieZnaleziono('Nie odnaleziono zgłoszenia.');

    // Zaproszenie idzie samo przy zgloszeniu (server/logika/zaproszenia.js),
    // wiec ta trasa sluzy dzis do WYSLANIA PONOWNIE — np. gdy klientowi
    // przepadl e-mail albo token wygasl. Dlatego nie odmawia przy statusie
    // „zaproszono".
    if (zgloszenie.status === 'odrzucone') {
      throw bledneZadanie('Zgłoszenie zostało odrzucone — nie wysyłamy do niego zaproszenia.');
    }

    // Blokada po ADRESIE E-MAIL zniknela: jeden klient pod jednym adresem
    // miewa kilka spolek i drugie zgloszenie jest normalna sytuacja.
    // Duplikaty odsiewa numer KRS przy skladaniu zgloszenia.
    const wynik = await zapros.wyslij(db(), {
      zgloszenieId: id,
      email: zgloszenie.email,
      autor: autor(zad),
    });

    odp.json({
      ok: true,
      konto_id: wynik.konto_id,
      nowe_konto: wynik.nowe_konto,
      email_wyslany: wynik.email_wyslany,
      powod: wynik.powod,
      link_aktywacyjny: wynik.link_aktywacyjny,
    });
  })
);

module.exports = router;
module.exports.trescZaproszenia = zapros.trescZaproszenia;
