'use strict';

/**
 * Wnioski w kancelarii (§ 5): lista, „Nowa spółka” (wniosek wypełniany przez pracownika), ekran
 * wniosku — dane, dokumenty („Potwierdź podpis” / „Odrzuć plik”, podpis notariusza), checklista,
 * „Przyjmij”, „Otwórz rejestr”, „Zwróć do uzupełnienia”, „Odrzuć”.
 */

const express = require('express');

const { db } = require('../baza');
const wnioski = require('../wnioski');
const pisma = require('../logika/pisma');
const danePliki = require('../dane/pliki');
const pliki = require('../pomocnicze/pliki');
const { asy, autor, bledneZadanie, dalejPoUploadzie } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

router.get('/', asy((zad, odp) => odp.json(wnioski.lista(db(), { stany: zad.query.stan ? String(zad.query.stan).split(',') : null }))));

router.post('/', asy(async (zad, odp) => {
  const id = await wnioski.zalozPrzezPracownika(db(), zad.body || {});
  odp.status(201).json(wnioski.widok(db(), id));
}));

router.get('/:id', asy((zad, odp) => odp.json(wnioski.widok(db(), zad.params.id))));

router.put('/:id', asy((zad, odp) => {
  wnioski.zmien(db(), zad.params.id, zad.body || {}, { przez: 'kancelaria', kto: autor(zad) });
  odp.json(wnioski.widok(db(), zad.params.id));
}));

/** Stan: zlozony („Złóż” — wniosek pracownika), roboczy („Zwróć do uzupełnienia”), odrzucony, przyjety. */
router.post('/:id/stan', asy(async (zad, odp) => {
  const b = zad.body || {};
  const id = zad.params.id;
  if (b.stan === 'zlozony') wnioski.zloz(db(), id, autor(zad));
  else if (b.stan === 'roboczy') await wnioski.zwroc(db(), id, b.notatka);
  else if (b.stan === 'odrzucony') wnioski.odrzuc(db(), id, b.przyczyna, autor(zad));
  else if (b.stan === 'przyjety') wnioski.przyjmij(db(), id, b.osoby || {}, autor(zad), { potwierdzKonto: b.potwierdz_konto === true });
  else throw bledneZadanie('Nieznany stan wniosku.');
  odp.json(wnioski.widok(db(), id));
}));

/** „Otwórz rejestr” (D-233): przyjęcie wniosku i wpis otwarcia jedną czynnością. */
router.post('/:id/otworz-rejestr', asy((zad, odp) => {
  const b = zad.body || {};
  odp.status(201).json(wnioski.otworzRejestr(db(), zad.params.id, { osoby: b.osoby || {}, potwierdzKonto: b.potwierdz_konto === true }, autor(zad)));
}));

router.post('/:id/otworz', asy((zad, odp) => odp.status(201).json({ sprawa_id: wnioski.otworz(db(), zad.params.id, autor(zad)) })));

router.post(
  '/:id/pliki',
  (zad, odp, dalej) => pliki.odbierz(zad, odp, dalejPoUploadzie(dalej)),
  asy(async (zad, odp) => {
    const b = zad.query;
    await wnioski.wgraj(db(), zad.params.id, zad.file, b.dokument, { przez: 'kancelaria', kto: autor(zad), umoweZawarl: b.umowe_zawarl });
    odp.status(201).json(wnioski.widok(db(), zad.params.id));
  })
);

router.post('/:id/pliki/:plik', asy((zad, odp) => {
  wnioski.ocenPlik(db(), zad.params.id, zad.params.plik, zad.body || {});
  odp.json(wnioski.widok(db(), zad.params.id));
}));

router.get('/:id/pliki/:plik', asy((zad, odp) => {
  const f = danePliki.wniosku(db(), zad.params.id).find((x) => x.id === Number(zad.params.plik));
  if (!f) throw bledneZadanie('Nie odnaleziono pliku.');
  pliki.wyslij(odp, danePliki.wczytaj(db(), f.id));
}));

router.get('/:id/dokumenty/:pismo', asy(async (zad, odp) => {
  const p = wnioski.pismoWniosku(db(), zad.params.id, zad.params.pismo);
  const pdf = await pisma.pdf(db(), p.id);
  odp.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${p.numer.replace(/\//g, '-')}.pdf"`, 'X-Content-Type-Options': 'nosniff' });
  odp.send(pdf);
}));

module.exports = router;
