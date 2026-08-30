'use strict';

/**
 * Trasy `/api/psa/zgloszenia/...` - zglobszenia wstepne portalu (etap 3A).
 *
 * Pierwszy kontakt nieznanego dotad klienta (formularz publiczny,
 * `server/trasy/portal.js: POST /zgloszenia`) - kancelaria przeglada liste
 * i decyduje: zaprosic (etap 3B - tworzy konto portalowe + wysyla token
 * aktywacyjny) albo odrzucic. Samo zgloszenie NIE zaklada zadnego konta ani
 * spolki - to wylacznie lead do oceny.
 */

const crypto = require('node:crypto');
const express = require('express');

const { db } = require('../baza');
const poczta = require('../poczta');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

// Link aktywacyjny (etap 3B) - wazny tydzien, jak typowe zaproszenia SaaS;
// po wygasnieciu kancelaria zaprasza ponownie (nowy token nadpisuje stary).
const TOKEN_WAZNOSC_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Tresc maila zaproszenia - wydzielona z handlera, zeby dalo sie ja
 * przetestowac bez zywego SMTP (`poczta.wyslij` i tak degraduje sie
 * miekko bez konfiguracji, ale sama tresc ma byc poprawna niezaleznie od
 * tego). Opisuje caly przebieg wniosku (etapy 3B-3E), nie tylko sam link -
 * klient ma wiedziec, co go czeka, zanim klinie.
 */
function trescZaproszenia({ link, kancelariaNazwa }) {
  return `
    <p>Dzień dobry,</p>
    <p>W odpowiedzi na zgłoszenie zainteresowania prowadzeniem rejestru akcjonariuszy
       zapraszamy do złożenia wniosku przez portal klienta ${kancelariaNazwa}.</p>
    <p><a href="${link}">${link}</a></p>
    <p>Link jest ważny przez 7 dni. Po jego otwarciu:</p>
    <ol>
      <li>ustawisz hasło do portalu i od razu zalogujesz się na konto,</li>
      <li>zapoznasz się z informacją o przetwarzaniu danych osobowych,</li>
      <li>wypełnisz dane spółki (można pobrać automatycznie z KRS po numerze),
          dane reprezentanta oraz dane akcjonariuszy,</li>
      <li>system przygotuje projekt umowy o prowadzenie rejestru na podstawie
          wpisanych danych,</li>
      <li>podpisaną umowę odeślesz przez portal — od tego momentu wniosek
          czeka na weryfikację kancelarii i otwarcie rejestru.</li>
    </ol>
    <p>W razie pytań prosimy o kontakt z kancelarią.</p>
  `;
}

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
    if (zgloszenie.status !== 'nowe') {
      throw bledneZadanie(`Zgłoszenie ma już status „${zgloszenie.status}” — nie można go ponownie zaprosić.`);
    }

    const istniejace = db().prepare('SELECT id FROM psa_konta WHERE lower(email) = ?').get(zgloszenie.email.toLowerCase());
    if (istniejace) {
      throw bledneZadanie('Konto z tym adresem e-mail już istnieje w portalu — zaproszenie jest zbędne.');
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenWygasa = new Date(Date.now() + TOKEN_WAZNOSC_MS).toISOString();

    const wynikKonta = db()
      .prepare(
        `INSERT INTO psa_konta (email, rola, aktywne, token_aktywacji, token_wygasa, utworzono)
         VALUES (?, 'wnioskodawca', 0, ?, ?, ?)`
      )
      .run(zgloszenie.email, token, tokenWygasa, czas.terazIso());

    const link = `${konfiguracja.URL_PORTALU}#/aktywuj/${token}`;
    const proba = await poczta.wyslij({
      do: zgloszenie.email,
      temat: `Zaproszenie do portalu — ${konfiguracja.KANCELARIA.nazwa}`,
      html: trescZaproszenia({ link, kancelariaNazwa: konfiguracja.KANCELARIA.nazwa }),
    });

    db()
      .prepare(
        `UPDATE psa_zgloszenia SET status = 'zaproszono', obsluzone_przez = ?, obsluzone_kiedy = ? WHERE id = ?`
      )
      .run(autor(zad), czas.terazIso(), id);

    odp.json({
      ok: true,
      konto_id: Number(wynikKonta.lastInsertRowid),
      email_wyslany: proba.wyslano,
      powod: proba.powod,
      // Gdy wysylka sie nie powiodla (brak SMTP, blad serwera poczty), konto
      // JUZ istnieje, a token siedzi w bazie - bez tego pola zaproszenie
      // przepadaloby bezpowrotnie. Link wraca WYLACZNIE w tej sytuacji
      // i wylacznie do zalogowanego pracownika kancelarii, ktory sam go
      // przed chwila wystawil; kancelaria przekazuje go wtedy klientowi
      // innym kanalem. Przy udanej wysylce link nie opuszcza serwera.
      link_aktywacyjny: proba.wyslano ? undefined : link,
    });
  })
);

module.exports = router;
module.exports.trescZaproszenia = trescZaproszenia;
