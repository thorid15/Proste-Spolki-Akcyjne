'use strict';

/**
 * Kolejka listów (W4.3) — aplikacja kancelarii. Pisma do osób bez zgody na
 * komunikację e-mail: druk z adresem z rejestru, data i numer nadania, skan
 * potwierdzenia nadania. Patrz `server/listy.js`.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const konfiguracja = require('../konfiguracja');
const ustawienia = require('../logika/ustawienia');
const { esc } = require('../logika/szablony');
const listy = require('../listy');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

const NAZWY_PISM = {
  powiadomienie: 'Powiadomienie o treści zamierzonego wpisu',
  zawiadomienie_wpis: 'Zawiadomienie o dokonaniu wpisu',
  zawiadomienie_odmowa: 'Zawiadomienie o odmowie wpisu',
  wezwanie: 'Wezwanie do usunięcia przeszkody',
  przejecie_rodo: 'Informacja o przejęciu rejestru (art. 14 RODO) i formularz zgód',
};

router.get('/', asy((zad, odp) => {
  const status = ['do_wyslania', 'nadany'].includes(zad.query.status) ? zad.query.status : null;
  odp.json({ listy: listy.lista(db(), { status }).map((l) => ({ ...l, rodzaj_nazwa: NAZWY_PISM[l.rodzaj_pisma] || l.rodzaj_pisma })) });
}));

/** Pismo do druku: blok adresowy z rejestru + treść pisma (do koperty z okienkiem). */
router.get('/:id/pismo', asy((zad, odp) => {
  const list = listy.wczytaj(db(), Number(zad.params.id));
  if (!list) throw nieZnaleziono('Nie odnaleziono listu.');
  const pismo = db().prepare('SELECT * FROM psa_wydane_dokumenty WHERE id = ?').get(list.wydany_dokument_id);
  const k = ustawienia.kancelaria(db());
  odp.type('html').send(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${esc(NAZWY_PISM[list.rodzaj_pisma] || 'Pismo')}</title>
<style>body{font:12pt Georgia,serif;margin:20mm}.nadawca{font-size:9pt}.adres{margin:18mm 0 12mm 95mm;white-space:pre-line}
pre{white-space:pre-wrap;font:inherit}@media print{.bez-druku{display:none}}</style></head><body>
<p class="bez-druku">Wydrukuj tę stronę (Ctrl+P) — adres z rejestru akcjonariuszy (art. 300(33) § 1 pkt 5 KSH).</p>
<div class="nadawca">${esc(k.nazwa)}<br>${esc(k.adres || '')}</div>
<div class="adres">${esc(list.odbiorca_nazwa)}\n${esc(list.adres).replace(/, /g, '\n')}</div>
<pre>${esc(pismo ? pismo.tresc_html : '')}</pre>
<p style="font-size:9pt;border-top:1px solid #999;padding-top:4mm">Pouczenie: nie wyraził(a) Pan/Pani zgody na komunikację
przy wykorzystaniu poczty elektronicznej (art. 300(33) § 1 pkt 5 KSH). Korespondencja z rejestru przychodzi pocztą, a żądania
wpisu składa się pocztą albo w kancelarii — portal klienta jest dostępny wyłącznie dla osób, które wyraziły zgodę na
komunikację e-mail. Zgodę można wyrazić w każdej chwili w formie dokumentowej.</p>
</body></html>`);
}));

const upload = multer({
  storage: multer.diskStorage({
    destination(zad, plik, wywolaj) {
      const katalog = path.join(konfiguracja.KATALOG_DOKUMENTOW, 'listy');
      fs.mkdirSync(katalog, { recursive: true });
      wywolaj(null, katalog);
    },
    filename(zad, plik, wywolaj) {
      wywolaj(null, `${crypto.randomUUID()}${path.extname(plik.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(zad, plik, wywolaj) {
    const ok = ['.pdf', '.jpg', '.jpeg', '.png'].includes(path.extname(plik.originalname).toLowerCase());
    wywolaj(ok ? null : new Error('Potwierdzenie nadania: PDF, JPG albo PNG.'), ok);
  },
});

/** Nadanie listu — data i numer nadania wymagane, skan potwierdzenia nadania. */
router.post('/:id/nadanie', upload.single('potwierdzenie'), asy((zad, odp) => {
  const cialo = zad.body || {};
  const dataNadania = String(cialo.data_nadania || '').trim();
  const numerNadania = String(cialo.numer_nadania || '').trim();
  if (!czas.poprawnaData(dataNadania)) throw bledneZadanie('Podaj datę nadania (RRRR-MM-DD).');
  if (!numerNadania) throw bledneZadanie('Podaj numer nadania z potwierdzenia nadania.');
  const wynik = listy.oznaczNadanie(db(), Number(zad.params.id), {
    dataNadania,
    numerNadania,
    potwierdzenie: zad.file
      ? { sciezka: path.relative(konfiguracja.KATALOG_DOKUMENTOW, zad.file.path), nazwa: zad.file.originalname }
      : null,
    autor: autor(zad),
  });
  if (!wynik) throw nieZnaleziono('Nie odnaleziono listu.');
  odp.json({ list: wynik });
}));

router.get('/:id/potwierdzenie', asy((zad, odp) => {
  const list = listy.wczytaj(db(), Number(zad.params.id));
  if (!list || !list.potwierdzenie_sciezka) throw nieZnaleziono('Brak skanu potwierdzenia nadania.');
  const pelna = path.join(konfiguracja.KATALOG_DOKUMENTOW, list.potwierdzenie_sciezka);
  if (!pelna.startsWith(konfiguracja.KATALOG_DOKUMENTOW)) throw nieZnaleziono('Brak pliku.');
  odp.download(pelna, list.potwierdzenie_nazwa || 'potwierdzenie-nadania');
}));

module.exports = router;
