'use strict';

/**
 * Wysylka e-mail (sekcja 13 specyfikacji - nodemailer, jedyna zaleznosc
 * do wysylki).
 *
 * `.env.przyklad` nie zawiera domyslnie danych SMTP - gdy ich brak, wysylka
 * nie rzuca wyjatku, tylko zwraca `{ wyslano: false, powod }`. Slad w
 * `psa_wydane_dokumenty` i tak powstaje (dokument jest wygenerowany i gotowy
 * do wyslania recznie / kanalem papierowym), a `wyslano` zostaje `NULL`
 * do czasu faktycznej wysylki.
 */

const nodemailer = require('nodemailer');
const konfiguracja = require('./konfiguracja');

let transport = null;

function skonfigurowane() {
  return Boolean(konfiguracja.SMTP.host && konfiguracja.SMTP.user);
}

function pobierzTransport() {
  if (!transport && skonfigurowane()) {
    transport = nodemailer.createTransport({
      host: konfiguracja.SMTP.host,
      port: konfiguracja.SMTP.port,
      secure: Number(konfiguracja.SMTP.port) === 465,
      auth: { user: konfiguracja.SMTP.user, pass: konfiguracja.SMTP.pass },
    });
  }
  return transport;
}

/**
 * @param {{ filename: string, content: Buffer }[]} [zalaczniki] - np. wypelniony
 *   wzor .docx (blok A4 sesji 8) - klient dostaje gotowy plik do podpisu,
 *   nie musi go odtwarzac z tresci maila.
 * @returns {Promise<{ wyslano: boolean, powod: string|null }>}
 */
async function wyslij({ do: adresat, temat, html, zalaczniki }) {
  if (!adresat) {
    return { wyslano: false, powod: 'Odbiorca nie ma adresu e-mail w kartotece — wyślij pismo papierowo.' };
  }
  const t = pobierzTransport();
  if (!t) {
    return {
      wyslano: false,
      powod: 'Wysyłka e-mail nie jest skonfigurowana (brak SMTP_HOST w .env) — dokument czeka na wysyłkę ręczną.',
    };
  }
  try {
    await t.sendMail({
      from: konfiguracja.SMTP.from || konfiguracja.SMTP.user,
      to: adresat,
      subject: temat,
      html,
      attachments: zalaczniki && zalaczniki.length ? zalaczniki : undefined,
    });
    return { wyslano: true, powod: null };
  } catch (e) {
    return { wyslano: false, powod: `Błąd wysyłki e-mail: ${e.message}` };
  }
}

module.exports = { wyslij, skonfigurowane };
