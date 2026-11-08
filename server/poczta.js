'use strict';

/**
 * Wysylka e-mail — JEDEN punkt dla calej aplikacji (T1, SESJA-PSA-WYTYCZNE.md).
 *
 * Kazda wiadomosc (pisma z Korespondencji, zaproszenia, przypomnienia)
 * idzie przez `wyslij()`. Transport jest
 * wymienny (`POCZTA_TRANSPORT`):
 *   - `smtp` — nodemailer; docelowo Microsoft 365 (biuro@notariusz.gdansk.pl,
 *     smtp.office365.com:587 albo osobny transport Graph API dopisany przez
 *     `zarejestrujTransport`),
 *   - `skrzynka-testowa` — plik .eml w `dane-testowe/skrzynka/`, nic nie
 *     wychodzi z serwera; dostepny WYLACZNIE w trybie testowym (D-074).
 *
 * Bez transportu wysylka nie rzuca wyjatku, tylko zwraca
 * `{ wyslano: false, status: 'blad', powod }` — pismo przechodzi w stan „blad”
 * z ta przyczyna (Korespondencja). Nigdy cichy sukces.
 *
 * Wynik: `{ wyslano, status, powod, testowa? }`, gdzie `status` to
 * `wyslano` | `testowa` (skrzynka testowa — niewysłana) | `brak_adresu` | `blad`.
 */

const nodemailer = require('nodemailer');
const konfiguracja = require('./konfiguracja');

let polaczenieSmtp = null;

function smtpSkonfigurowany() {
  return Boolean(konfiguracja.SMTP.host && konfiguracja.SMTP.user);
}

const transportSmtp = {
  async wyslij(wiadomosc) {
    if (!polaczenieSmtp) {
      polaczenieSmtp = nodemailer.createTransport({
        host: konfiguracja.SMTP.host,
        port: konfiguracja.SMTP.port,
        secure: Number(konfiguracja.SMTP.port) === 465,
        auth: { user: konfiguracja.SMTP.user, pass: konfiguracja.SMTP.pass },
      });
    }
    return polaczenieSmtp.sendMail(wiadomosc);
  },
};

const TRANSPORTY = { smtp: transportSmtp };

/** Punkt podpiecia innego transportu produkcyjnego (np. Graph API Microsoft 365). */
function zarejestrujTransport(nazwa, transport) {
  if (nazwa === 'skrzynka-testowa') throw new Error('Nazwa zarezerwowana dla trybu testowego.');
  TRANSPORTY[nazwa] = transport;
}

/** `{ nazwa, transport }` albo `{ nazwa: null, powod }`. */
function wybierzTransport() {
  if (konfiguracja.TRYB_TESTOWY) {
    // Tryb testowy ZAWSZE pisze do skrzynki — nawet gdy w .env zostal SMTP.
    return { nazwa: 'skrzynka-testowa', transport: require('./tryb-testowy/skrzynka') };
  }
  const zadany = konfiguracja.POCZTA_TRANSPORT;
  if (zadany === 'skrzynka-testowa') {
    return { nazwa: null, powod: 'Skrzynka testowa działa wyłącznie w trybie testowym (PSA_TRYB_TESTOWY).' };
  }
  if (zadany && zadany !== 'smtp') {
    return TRANSPORTY[zadany]
      ? { nazwa: zadany, transport: TRANSPORTY[zadany] }
      : { nazwa: null, powod: `Nieznany transport poczty „${zadany}” (POCZTA_TRANSPORT).` };
  }
  if (!smtpSkonfigurowany()) {
    return {
      nazwa: null,
      powod: 'Wysyłka e-mail nie jest skonfigurowana (brak SMTP_HOST w .env) — dokument czeka na wysyłkę ręczną.',
    };
  }
  return { nazwa: 'smtp', transport: transportSmtp };
}

function skonfigurowane() {
  return Boolean(wybierzTransport().nazwa);
}

/**
 * @param {{ filename: string, content: Buffer }[]} [zalaczniki] - np. pismo PDF (U-10).
 */
async function wyslij({ do: adresat, temat, tekst, html, zalaczniki }) {
  if (!adresat) {
    return {
      wyslano: false,
      status: 'brak_adresu',
      powod: 'Odbiorca nie ma adresu e-mail w kartotece — wyślij pismo papierowo.',
    };
  }
  const wybor = wybierzTransport();
  if (!wybor.nazwa) return { wyslano: false, status: 'blad', powod: wybor.powod };

  const wiadomosc = {
    from: konfiguracja.SMTP.from || konfiguracja.SMTP.user || konfiguracja.KANCELARIA.email || 'rejestr@example.invalid',
    to: adresat,
    subject: temat,
    text: tekst,
    html,
    attachments: zalaczniki && zalaczniki.length ? zalaczniki : undefined,
  };
  let info;
  try {
    info = await wybor.transport.wyslij(wiadomosc);
  } catch (e) {
    return { wyslano: false, status: 'blad', powod: `Błąd wysyłki e-mail: ${e.message}` };
  }
  if (wybor.nazwa === 'skrzynka-testowa') {
    // Przeplyw idzie dalej jak po wysylce (o to chodzi w trybie testowym),
    // ale status mowi wprost, ze nic nie wyszlo z serwera.
    return { wyslano: true, testowa: true, status: 'testowa', powod: 'testowa — niewysłana (skrzynka testowa)', idWiadomosci: info && info.id };
  }
  return { wyslano: true, status: 'wyslano', powod: null, idWiadomosci: (info && info.messageId) || null, odpowiedz: (info && info.response) || null };
}

module.exports = { wyslij, skonfigurowane, zarejestrujTransport, wybierzTransport };
