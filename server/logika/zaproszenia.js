'use strict';

/**
 * Zaproszenie do portalu: zalozenie (albo odnalezienie) konta i wyslanie
 * linku aktywacyjnego.
 *
 * Jedno miejsce dla dwoch drog: zgloszenie z publicznego formularza wysyla
 * zaproszenie SAMO (na tym etapie kancelaria niczego jeszcze nie sprawdza,
 * a czekanie na klikniecie pracownika tylko odsuwa klienta od formularza),
 * a pracownik moze je wyslac ponownie z kolejki zgloszen.
 *
 * Konto jest po ADRESIE E-MAIL i jest jedno — ale spolek moze prowadzic
 * kilka (`psa_konta_spolki`). Drugie zgloszenie tego samego klienta nie
 * zaklada wiec drugiego konta: odswieza token przy istniejacym, jesli konto
 * nie zostalo jeszcze aktywowane, albo od razu odsyla do logowania.
 */

const crypto = require('node:crypto');

const poczta = require('../poczta');
const konfiguracja = require('../konfiguracja');
const ustawienia = require('./ustawienia');
const czas = require('../pomocnicze/czas');

const TOKEN_WAZNOSC_MS = 7 * 24 * 60 * 60 * 1000;

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
      <li>kancelaria sprawdzi wniosek i przygotuje komplet dokumentów do podpisu —
          powiadomimy e-mailem, gdy będą gotowe.</li>
    </ol>
    <p>W razie pytań prosimy o kontakt z kancelarią.</p>
  `;
}

function trescPonowna({ kancelariaNazwa, adresPortalu }) {
  return `
    <p>Dzień dobry,</p>
    <p>W portalu klienta ${kancelariaNazwa} jest już konto na ten adres e-mail —
       nowe zgłoszenie dopisaliśmy do niego, nie zakładając drugiego konta.</p>
    <p>Zaloguj się i wypełnij wniosek dla kolejnej spółki: <a href="${adresPortalu}">${adresPortalu}</a></p>
    <p>Jeśli nie pamiętasz hasła, napisz do kancelarii — ustawimy je ponownie.</p>
  `;
}

/**
 * @returns {{konto_id:number, nowe_konto:boolean, email_wyslany:boolean,
 *            powod?:string, link_aktywacyjny?:string}}
 */
async function wyslij(db, { zgloszenieId, email, autor }) {
  const adres = String(email || '').trim().toLowerCase();
  const kancelaria = ustawienia.kancelaria(db);
  const istniejace = db.prepare('SELECT * FROM psa_konta WHERE lower(email) = ?').get(adres);

  // Konto aktywne — klient ma haslo i wlasna droge do portalu. Nowy token
  // byłby zaproszeniem do czegos, co juz ma.
  if (istniejace && istniejace.aktywne) {
    const proba = await poczta.wyslij({
      do: adres,
      temat: `Kolejna spółka w portalu — ${kancelaria.nazwa}`,
      html: trescPonowna({ kancelariaNazwa: kancelaria.nazwa, adresPortalu: konfiguracja.URL_PORTALU }),
    });
    oznaczZgloszenie(db, zgloszenieId, autor);
    return {
      konto_id: istniejace.id,
      nowe_konto: false,
      email_wyslany: proba.wyslano,
      powod: proba.powod,
    };
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenWygasa = new Date(Date.now() + TOKEN_WAZNOSC_MS).toISOString();

  let kontoId;
  if (istniejace) {
    db.prepare('UPDATE psa_konta SET token_aktywacji = ?, token_wygasa = ? WHERE id = ?')
      .run(token, tokenWygasa, istniejace.id);
    kontoId = istniejace.id;
  } else {
    const wynik = db
      .prepare(
        `INSERT INTO psa_konta (email, rola, aktywne, token_aktywacji, token_wygasa, utworzono)
         VALUES (?, 'wnioskodawca', 0, ?, ?, ?)`
      )
      .run(adres, token, tokenWygasa, czas.terazIso());
    kontoId = Number(wynik.lastInsertRowid);
  }

  const link = `${konfiguracja.URL_PORTALU}#/aktywuj/${token}`;
  const proba = await poczta.wyslij({
    do: adres,
    temat: `Zaproszenie do portalu — ${kancelaria.nazwa}`,
    html: trescZaproszenia({ link, kancelariaNazwa: kancelaria.nazwa }),
  });

  oznaczZgloszenie(db, zgloszenieId, autor);

  return {
    konto_id: kontoId,
    nowe_konto: !istniejace,
    email_wyslany: proba.wyslano,
    powod: proba.powod,
    // Gdy wysylka sie nie powiodla (brak SMTP, blad serwera poczty), konto
    // JUZ istnieje, a token siedzi w bazie — bez tego pola zaproszenie
    // przepadaloby bezpowrotnie.
    link_aktywacyjny: proba.wyslano ? undefined : link,
  };
}

function oznaczZgloszenie(db, zgloszenieId, autor) {
  if (!zgloszenieId) return;
  db.prepare(
    `UPDATE psa_zgloszenia SET status = 'zaproszono', obsluzone_przez = ?, obsluzone_kiedy = ?
      WHERE id = ? AND status = 'nowe'`
  ).run(autor || 'Portal', czas.terazIso(), zgloszenieId);
}

module.exports = { wyslij, trescZaproszenia, TOKEN_WAZNOSC_MS };
