'use strict';

/**
 * Przeniesienie rejestru od innego podmiotu — aplikacja kancelarii (Faza 4,
 * W7.1–W7.10). Logika: `server/przeniesienia.js`, `server/logika/przeniesienie.js`.
 */

const express = require('express');
const multer = require('multer');
const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const przeniesienia = require('../przeniesienia');
const reguly = require('../logika/przeniesienie');
const trybTestowy = require('../tryb-testowy');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });

const TYPY_DOKUMENTOW = ['umowa_spolki', 'informacja_poprzednika', 'uchwala', 'umowa_warunkowa', 'wypowiedzenie',
  'potwierdzenie_rozwiazania', 'dane_poprzednika', 'inne'];

function obsluz(fn) {
  return asy(async (zad, odp) => {
    try {
      await fn(zad, odp);
    } catch (e) {
      if (e instanceof przeniesienia.BladPrzeniesienia) throw bledneZadanie(e.message, e.szczegoly);
      throw e;
    }
  });
}

function wczytajLub404(zad) {
  const p = przeniesienia.wczytaj(db(), Number(zad.params.id));
  if (!p) throw nieZnaleziono('Nie odnaleziono przeniesienia.');
  return p;
}

router.get('/', obsluz((zad, odp) => {
  przeniesienia.zastosujWygasniecia(db());
  odp.json({
    przeniesienia: przeniesienia.lista(db()),
    statusy: reguly.NAZWY_STATUSOW,
    checklista_weryfikacji: reguly.CHECKLISTA_WERYFIKACJI,
    checklista_odbioru: reguly.CHECKLISTA_ODBIORU,
    poprzednicy: reguly.POPRZEDNICY,
  });
}));

router.get('/:id', obsluz((zad, odp) => {
  const p = wczytajLub404(zad);
  odp.json({
    przeniesienie: p,
    pisma: przeniesienia.listaPism(db(), p),
    checklista_weryfikacji: reguly.CHECKLISTA_WERYFIKACJI,
    checklista_odbioru: reguly.CHECKLISTA_ODBIORU,
    statusy: reguly.NAZWY_STATUSOW,
  });
}));

/** W7.10 — przejście statusu (z warunkami). */
router.post('/:id/przejscie', obsluz((zad, odp) => {
  wczytajLub404(zad);
  const c = zad.body || {};
  const p = przeniesienia.przejdz(db(), Number(zad.params.id), String(c.na || ''), {
    autor: autor(zad),
    dane: { data_zawarcia_umowy: c.data_zawarcia_umowy, data_skutecznosci: c.data_skutecznosci, uwagi: c.uwagi },
  });
  odp.json({ przeniesienie: p });
}));

router.put('/:id/checklista/:rodzaj', obsluz((zad, odp) => {
  wczytajLub404(zad);
  const rodzaj = zad.params.rodzaj === 'odbioru' ? 'odbioru' : 'weryfikacji';
  odp.json({ przeniesienie: przeniesienia.zapiszCheckliste(db(), Number(zad.params.id), rodzaj, (zad.body || {}).zaznaczone || {}) });
}));

router.post('/:id/dokumenty', upload.single('plik'), obsluz((zad, odp) => {
  wczytajLub404(zad);
  const typ = String((zad.body || {}).typ || '');
  const zrodlo = ['kancelaria', 'poprzednik', 'klient'].includes((zad.body || {}).zrodlo) ? zad.body.zrodlo : 'kancelaria';
  if (!TYPY_DOKUMENTOW.includes(typ)) throw bledneZadanie('Nieznany typ dokumentu.');
  if (!zad.file) throw bledneZadanie('Nie przesłano pliku.');
  odp.status(201).json({
    przeniesienie: przeniesienia.dodajDokument(db(), Number(zad.params.id), {
      typ, zrodlo, nazwa: zad.file.originalname, bufor: zad.file.buffer, autor: autor(zad),
    }),
  });
}));

router.get('/:id/dokumenty/:dokId', obsluz((zad, odp) => {
  const plik = przeniesienia.sciezkaDokumentu(db(), Number(zad.params.id), Number(zad.params.dokId));
  if (!plik) throw nieZnaleziono('Nie odnaleziono dokumentu.');
  odp.download(plik.pelna, plik.nazwa);
}));

/** W7.4 — pisma pakietu (szablony; PROJEKT — do akceptacji Łukasza). */
router.get('/:id/pisma/:kod', obsluz((zad, odp) => {
  const p = wczytajLub404(zad);
  odp.type('html').send(przeniesienia.renderujPismo(db(), p, zad.params.kod).html);
}));

/** W7.7 — protokół przejęcia do podpisu kwalifikowanego notariusza. */
router.get('/:id/protokol.pdf', obsluz(async (zad, odp) => {
  wczytajLub404(zad);
  const plik = await przeniesienia.protokol(db(), Number(zad.params.id));
  odp.set('Content-Type', 'application/pdf');
  odp.set('Content-Disposition', `attachment; filename="protokol-przejecia-${zad.params.id}.pdf"`);
  odp.send(plik);
}));

router.post('/:id/zatwierdzenie', upload.single('plik'), obsluz(async (zad, odp) => {
  wczytajLub404(zad);
  if (!zad.file) throw bledneZadanie('Nie przesłano pliku protokołu podpisanego przez notariusza.');
  odp.json({
    przeniesienie: await przeniesienia.zatwierdz(db(), Number(zad.params.id), {
      bufor: zad.file.buffer, nazwa: zad.file.originalname, atrapa: () => trybTestowy.wynikWalidatora(db()),
    }),
  });
}));

/** W7.8 — zadanie ręczne zrobione (organy egzekucyjne powiadomione, przypomnienie o KRS wysłane). */
router.post('/:id/zadanie/:kod', obsluz((zad, odp) => {
  const p = wczytajLub404(zad);
  const opisy = { organy: 'organy egzekucyjne powiadomione o zmianie podmiotu (ręcznie)', krs: 'zarządowi przypomniano o zgłoszeniu do KRS' };
  if (!opisy[zad.params.kod]) throw bledneZadanie('Nieznane zadanie.');
  db().prepare(`INSERT INTO psa_przeniesienia_historia (przeniesienie_id, z_statusu, na_status, uwagi, autor, utworzono) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(p.id, p.status, p.status, `[zadanie:${zad.params.kod}] ${opisy[zad.params.kod]}`, autor(zad), czas.terazIso());
  odp.json({ przeniesienie: przeniesienia.wczytaj(db(), p.id) });
}));

router.post('/:id/powiaz-wniosek', obsluz((zad, odp) => {
  const p = wczytajLub404(zad);
  const wniosekId = Number((zad.body || {}).wniosek_id);
  if (!db().prepare('SELECT 1 FROM psa_wnioski WHERE id = ?').get(wniosekId)) throw bledneZadanie('Nie odnaleziono wniosku.');
  przeniesienia.powiazWniosek(db(), p.id, wniosekId);
  odp.json({ przeniesienie: przeniesienia.wczytaj(db(), p.id) });
}));

module.exports = router;
