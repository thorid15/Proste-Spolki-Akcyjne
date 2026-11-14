'use strict';

/**
 * Eksport całego rejestru spółki do ZIP (art. 90a PrNot; art. 300³¹ § 3–4 KSH): pełna informacja
 * z rejestru na dzień eksportu, historia wpisów z łańcuchem skrótów, pliki spółki i pisma.
 */

const fs = require('node:fs');
const path = require('node:path');
const konfiguracja = require('./konfiguracja');
const czas = require('./pomocnicze/czas');
const zip = require('./logika/zip');
const pisma = require('./logika/pisma');
const informacje = require('./informacje');
const daneSpolki = require('./dane/spolki');
const danePliki = require('./dane/pliki');
const daneRejestr = require('./dane/rejestr');
const danePisma = require('./dane/pisma');

/** Pole CSV; tekst zaczynający się od =, +, -, @ dostaje apostrof — arkusz nie uruchomi go jako formuły (audyt N3). */
function poleCsv(v) {
  let t = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

const bezpiecznaNazwa = (t) => String(t || 'plik').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);

async function zbudujEksport(db, spolkaId) {
  const spolka = daneSpolki.wczytaj(db, spolkaId);
  const wpisy = [];
  if (spolka.data_otwarcia) {
    wpisy.push({ nazwa: 'informacja-z-rejestru.pdf', dane: await informacje.pdfInformacji(db, spolka.id, czas.dzisIso()) });
  }

  const zdarzenia = daneRejestr.zdarzeniaSpolki(db, spolka.id);
  wpisy.push({ nazwa: 'historia-wpisow.json', dane: JSON.stringify(zdarzenia, null, 2) });
  const kolumny = ['id', 'typ', 'data_wpisu', 'autor', 'sprawa_id', 'hash_poprzedni', 'hash', 'dane_json'];
  wpisy.push({
    nazwa: 'historia-wpisow.csv',
    dane: `﻿${[kolumny.join(';'), ...zdarzenia.map((z) => kolumny.map((k) => poleCsv(z[k])).join(';'))].join('\n')}`,
  });

  for (const p of danePliki.lista(db, { spolkaId: spolka.id })) {
    const pelna = path.join(konfiguracja.KATALOG_DOKUMENTOW, path.basename(danePliki.wczytaj(db, p.id).sciezka));
    if (fs.existsSync(pelna)) wpisy.push({ nazwa: `dokumenty/pliki/${p.id}-${bezpiecznaNazwa(p.nazwa)}`, dane: fs.readFileSync(pelna) });
  }
  for (const p of danePisma.lista(db, { spolkaId: spolka.id })) {
    wpisy.push({ nazwa: `dokumenty/pisma/${p.numer.replace(/\//g, '-')}.pdf`, dane: await pisma.pdf(db, p.id) });
  }

  wpisy.unshift({
    nazwa: 'README.txt',
    dane: [
      `Eksport rejestru akcjonariuszy — ${spolka.nazwa} (KRS ${spolka.krs})`,
      `Sporządzono: ${czas.terazIso()}`,
      'Podstawa: art. 90a ustawy — Prawo o notariacie; art. 300(31) § 3–4 KSH.',
      '',
      'informacja-z-rejestru.pdf   — pełny stan rejestru na dzień eksportu',
      'historia-wpisow.csv/.json   — wszystkie wpisy (tylko dopisywane) z łańcuchem skrótów SHA-256',
      'dokumenty/pliki/            — pliki spółki, spraw i wniosku',
      'dokumenty/pisma/            — pisma wychodzące (PDF)',
    ].join('\n'),
  });
  return zip.zapisz(wpisy);
}

module.exports = { zbudujEksport };
