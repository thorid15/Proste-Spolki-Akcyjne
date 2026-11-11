'use strict';

/**
 * Skrzynka testowa (T1) — transport poczty, ktory NIC nie wysyla.
 *
 * Kazda wiadomosc zapisuje sie jako plik `.eml` (RFC 5322, z zalacznikami —
 * otwiera go Outlook i Thunderbird) w `dane-testowe/skrzynka/`, obok krotki
 * `.json` z naglowkami do listy. Katalog lezy poza `publiczne/` i jest
 * w `.gitignore`. Plik `.eml` buduje MailComposer, ktory jest czescia
 * `nodemailer` — bez nowej zaleznosci.
 */

const fs = require('node:fs');
const path = require('node:path');
const MailComposer = require('nodemailer/lib/mail-composer');
const konfiguracja = require('../konfiguracja');
const czas = require('../pomocnicze/czas');

const WZORZEC_ID = /^[0-9]{8}T[0-9]{9}-[0-9a-f]{6}$/;

function katalog() {
  return konfiguracja.KATALOG_SKRZYNKI;
}

function noweId() {
  const t = new Date().toISOString().replace(/[-:.Z]/g, '').replace('T', 'T');
  return `${t.slice(0, 8)}T${t.slice(9, 18)}-${Math.random().toString(16).slice(2, 8).padEnd(6, '0')}`;
}

/** Transport zgodny z `poczta.js`: `wyslij({from,to,subject,html,attachments})`. */
async function wyslij(wiadomosc) {
  fs.mkdirSync(katalog(), { recursive: true });
  const id = noweId();
  const eml = await new MailComposer({
    ...wiadomosc,
    headers: { 'X-PSA-Tryb-Testowy': 'testowa — niewysłana' },
  }).compile().build();
  fs.writeFileSync(path.join(katalog(), `${id}.eml`), eml);
  fs.writeFileSync(
    path.join(katalog(), `${id}.json`),
    JSON.stringify({
      id,
      do: wiadomosc.to,
      od: wiadomosc.from || null,
      temat: wiadomosc.subject,
      czas: czas.terazIso(),
      czas_rzeczywisty: new Date().toISOString(),
      html: wiadomosc.html || '',
      tekst: wiadomosc.text || '',
      zalaczniki: (wiadomosc.attachments || []).map((z) => z.filename),
    }, null, 2)
  );
  return { id };
}

/** Lista wiadomosci, najnowsze pierwsze. */
function lista() {
  if (!fs.existsSync(katalog())) return [];
  return fs
    .readdirSync(katalog())
    .filter((n) => n.endsWith('.json') && WZORZEC_ID.test(n.slice(0, -5)))
    .sort()
    .reverse()
    .map((n) => {
      const m = JSON.parse(fs.readFileSync(path.join(katalog(), n), 'utf8'));
      return { id: m.id, do: m.do, temat: m.temat, czas: m.czas, zalaczniki: m.zalaczniki };
    });
}

function wiadomosc(id) {
  if (!WZORZEC_ID.test(String(id))) return null;
  const plik = path.join(katalog(), `${id}.json`);
  if (!fs.existsSync(plik)) return null;
  return JSON.parse(fs.readFileSync(plik, 'utf8'));
}

function sciezkaEml(id) {
  if (!WZORZEC_ID.test(String(id))) return null;
  const plik = path.join(katalog(), `${id}.eml`);
  return fs.existsSync(plik) ? plik : null;
}

module.exports = { wyslij, lista, wiadomosc, sciezkaEml };
