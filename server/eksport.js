'use strict';

/**
 * Eksport całego rejestru spółki z dokumentami w czytelnym formacie (W6.3,
 * art. 90a PrNot; DECYZJE.md D-080 — zastępuje „pakietu eksportu nie
 * budujemy” z D-068). Archiwum ZIP:
 *   README.txt                      — zawartość, data, podstawa
 *   informacja-z-rejestru.html      — pełny stan rejestru (wersja kancelarii)
 *   historia-zdarzen.csv / .json    — wszystkie wpisy z łańcuchem SHA-256
 *   dokumenty/...                   — pliki spraw, akt spółki, wniosku,
 *                                     wydane pisma, potwierdzenia nadania
 * Niczego nie usuwa i nie zmienia (W6.4).
 */

const fs = require('node:fs');
const path = require('node:path');
const konfiguracja = require('./konfiguracja');
const czas = require('./pomocnicze/czas');
const przepisy = require('./logika/przepisy');
const ustawienia = require('./logika/ustawienia');
const zip = require('./logika/zip');
const widoki = require('./widoki');
const informacjaDokument = require('./logika/informacja-dokument');

function poleCsv(v) {
  const t = v == null ? '' : String(v);
  return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function bezpiecznaNazwa(t) {
  return String(t || 'plik').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);
}

function zbudujEksport(db, spolka) {
  const wpisy = [];
  const teraz = czas.terazIso();
  const dodajPlik = (katalog, sciezkaWzgledna, nazwa, id) => {
    if (!sciezkaWzgledna) return;
    const pelna = path.join(konfiguracja.KATALOG_DOKUMENTOW, sciezkaWzgledna);
    if (!pelna.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(pelna)) return;
    wpisy.push({ nazwa: `dokumenty/${katalog}/${id}-${bezpiecznaNazwa(nazwa || path.basename(pelna))}`, dane: fs.readFileSync(pelna) });
  };

  const stan = widoki.widokStanu(db, spolka.id, czas.dzisIso(), { rola: przepisy.ROLE_ODBIORCY.KANCELARIA });
  if (stan) {
    wpisy.push({
      nazwa: 'informacja-z-rejestru.html',
      dane: informacjaDokument.informacjaZRejestru({
        kancelaria: ustawienia.kancelaria(db), spolka: stan.spolka, data: czas.dzisIso(), stan,
        odbiorca: { rola: przepisy.ROLE_ODBIORCY.KANCELARIA, opis: 'eksport rejestru (art. 90a PrNot)' }, sporzadzono: teraz,
      }),
    });
  }

  const zdarzenia = db.prepare('SELECT * FROM psa_zdarzenia WHERE spolka_id = ? ORDER BY id').all(spolka.id);
  wpisy.push({ nazwa: 'historia-zdarzen.json', dane: JSON.stringify(zdarzenia.map((z) => ({ ...z, dane: JSON.parse(z.dane_json || '{}') })), null, 2) });
  wpisy.push({
    nazwa: 'historia-zdarzen.csv',
    dane: '﻿' + [['id', 'typ', 'data_wpisu', 'autor', 'sprawa_id', 'hash_poprzedni', 'hash', 'dane'].join(';')]
      .concat(zdarzenia.map((z) => [z.id, z.typ, z.data_wpisu, z.autor, z.sprawa_id, z.hash_poprzedni, z.hash, z.dane_json].map(poleCsv).join(';')))
      .join('\n'),
  });

  for (const d of db.prepare(
    'SELECT d.* FROM psa_dokumenty d JOIN psa_sprawy s ON s.id = d.sprawa_id WHERE s.spolka_id = ?'
  ).all(spolka.id)) dodajPlik(`sprawy/sprawa-${d.sprawa_id}`, d.sciezka, d.nazwa_pliku, d.id);
  for (const d of db.prepare('SELECT * FROM psa_spolki_dokumenty WHERE spolka_id = ?').all(spolka.id)) {
    dodajPlik('akta-spolki', d.sciezka, d.nazwa_pliku || d.nazwa, d.id);
  }
  dodajPlik('akta-spolki', spolka.umowa_zalacznik_sciezka, spolka.umowa_zalacznik_nazwa_pliku, 'umowa');
  for (const w of db.prepare('SELECT id FROM psa_wnioski WHERE spolka_id = ?').all(spolka.id)) {
    for (const d of db.prepare('SELECT * FROM psa_wnioski_dokumenty WHERE wniosek_id = ?').all(w.id)) {
      dodajPlik(`wniosek-${w.id}/wystawione`, d.sciezka, d.nazwa_pliku, d.id);
      dodajPlik(`wniosek-${w.id}/podpisane`, d.podpis_sciezka, d.podpis_nazwa_pliku, d.id);
      dodajPlik(`wniosek-${w.id}/podpis-notariusza`, d.notariusz_podpis_sciezka, `${d.typ}.pdf`, d.id);
    }
  }
  for (const w of db.prepare('SELECT * FROM psa_wydane_dokumenty WHERE spolka_id = ? ORDER BY id').all(spolka.id)) {
    if (w.sciezka_plik) dodajPlik('wydane', w.sciezka_plik, null, w.id);
    else if (w.tresc_html) wpisy.push({ nazwa: `dokumenty/wydane/${w.id}-${w.typ}.html`, dane: w.tresc_html });
  }
  for (const l of db.prepare('SELECT * FROM psa_listy WHERE spolka_id = ?').all(spolka.id)) {
    dodajPlik('potwierdzenia-nadania', l.potwierdzenie_sciezka, l.potwierdzenie_nazwa, l.id);
  }

  wpisy.unshift({
    nazwa: 'README.txt',
    dane: [
      `Eksport rejestru akcjonariuszy — ${spolka.nazwa}${spolka.krs ? ` (KRS ${spolka.krs})` : ''}`,
      `Sporządzono: ${teraz} — ${ustawienia.kancelaria(db).nazwa}`,
      'Podstawa: art. 90a ustawy — Prawo o notariacie; art. 300(31) § 3–4 KSH.',
      '',
      'informacja-z-rejestru.html  — pełny stan rejestru na dzień eksportu',
      'historia-zdarzen.csv/.json  — wszystkie wpisy (append-only) z łańcuchem skrótów SHA-256',
      'dokumenty/                  — dokumenty uzasadniające wpisy, akta spółki, wniosek, wydane pisma',
      '',
      `Plików dokumentów: ${wpisy.filter((w) => w.nazwa.startsWith('dokumenty/')).length}`,
    ].join('\n'),
  });
  return zip.zapisz(wpisy);
}

module.exports = { zbudujEksport };
