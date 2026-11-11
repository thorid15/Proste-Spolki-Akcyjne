'use strict';

/**
 * Wysyłka e-mail — jeden punkt dla całej aplikacji. Poza trybem testowym wyłącznie SMTP z TLS
 * (port 465 — TLS od początku, inny — STARTTLS obowiązkowy, § 7 pkt 7); w trybie testowym zawsze
 * skrzynka testowa (`dane-testowe/skrzynka/`), nic nie wychodzi z serwera. Bez konfiguracji wysyłka
 * nie rzuca wyjątku, tylko zwraca `{ wyslano: false, status: 'blad', powod }` — pismo przechodzi
 * w stan „blad” (Korespondencja). Nigdy cichy sukces.
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
        requireTLS: true,
        auth: { user: konfiguracja.SMTP.user, pass: konfiguracja.SMTP.pass },
      });
    }
    return polaczenieSmtp.sendMail(wiadomosc);
  },
};

/** `{ nazwa, transport }` albo `{ nazwa: null, powod }`. */
function wybierzTransport() {
  if (konfiguracja.TRYB_TESTOWY) return { nazwa: 'skrzynka-testowa', transport: require('./tryb-testowy/skrzynka') };
  if (!smtpSkonfigurowany()) {
    return { nazwa: null, powod: 'Wysyłka e-mail nie jest skonfigurowana (brak SMTP_HOST w .env) — wyślij pismo ręcznie.' };
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
    from: konfiguracja.SMTP.from || konfiguracja.SMTP.user,
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

module.exports = { wyslij, skonfigurowane };
