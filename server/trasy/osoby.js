'use strict';

/**
 * Kartoteka osób i karta osoby (§ 5). „Edytuj” zmienia dane w miejscu z historią (U-25) — bez
 * sprawy i wpisu. Zgoda na korespondencję e-mail (U-11): włączenie wymaga pliku podpisanej
 * zgody (wgranego do karty osoby), wyłączenie — daty.
 */

const express = require('express');

const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const osobyLogika = require('../logika/osoby');
const { BladWalidacji } = require('../logika/walidacje');
const daneOsoby = require('../dane/osoby');
const danePliki = require('../dane/pliki');
const historia = require('../dane/historia');
const daneSpolki = require('../dane/spolki');
const pisma = require('../logika/pisma');
const pliki = require('../pomocnicze/pliki');
const { asy, autor, nieZnaleziono, dalejPoUploadzie } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

function wymagajOsoby(zad) {
  const osoba = daneOsoby.wczytaj(db(), zad.params.id);
  if (!osoba) throw nieZnaleziono('Nie odnaleziono osoby.');
  return osoba;
}

function ostrzezenia(osoba, pomijajId = null) {
  return daneOsoby.takieSame(db(), osoba, pomijajId).map((o) => `W kartotece jest już osoba z tym numerem: ${o.nazwa} (#${o.id}).`);
}

router.get(
  '/',
  asy((zad, odp) => {
    odp.json(daneOsoby.lista(db(), { q: zad.query.q || '', limit: zad.query.limit }));
  })
);

router.post(
  '/',
  asy((zad, odp) => {
    const { osoba, bledy } = osobyLogika.sprawdz(zad.body || {});
    if (bledy.length > 0) throw new BladWalidacji(bledy);
    const id = daneOsoby.dodaj(db(), osoba);
    odp.status(201).json({ osoba: daneOsoby.wczytaj(db(), id), ostrzezenia: ostrzezenia(osoba, id) });
  })
);

router.get(
  '/:id',
  asy((zad, odp) => {
    const osoba = wymagajOsoby(zad);
    odp.json({
      osoba,
      ...daneOsoby.powiazania(db(), osoba.id),
      pliki: danePliki.lista(db(), { osobaId: osoba.id }),
      historia: historia.lista(db(), { osobaId: osoba.id }),
    });
  })
);

function zmienZgode(osoba, zgoda, kto) {
  if (zgoda.zgoda === true) {
    const plik = danePliki.wczytaj(db(), zgoda.plik_id);
    if (!osoba.email) throw new BladWalidacji([{ pole: 'email', komunikat: 'Podaj adres e-mail przed włączeniem zgody.' }]);
    if (!plik || plik.osoba_id !== osoba.id) {
      throw new BladWalidacji([{ pole: 'zgoda_email', komunikat: 'Dodaj plik podpisanej zgody do karty osoby i wskaż go.' }]);
    }
    return daneOsoby.ustawZgodeEmail(db(), osoba.id, { zgoda: true, plikId: plik.id }, kto);
  }
  if (zgoda.zgoda === false) {
    if (!czas.poprawnaData(zgoda.data) || zgoda.data > czas.dzisIso()) {
      throw new BladWalidacji([{ pole: 'zgoda_email', komunikat: 'Podaj datę wycofania zgody.' }]);
    }
    return daneOsoby.ustawZgodeEmail(db(), osoba.id, { zgoda: false, data: zgoda.data }, kto);
  }
  throw new BladWalidacji([{ pole: 'zgoda_email', komunikat: 'Wskaż: zgoda włączona albo wyłączona.' }]);
}

router.put(
  '/:id',
  asy((zad, odp) => {
    const osoba = wymagajOsoby(zad);
    const cialo = zad.body || {};
    const zmiany = Object.fromEntries(osobyLogika.POLA_EDYCJI.filter((p) => cialo[p] !== undefined).map((p) => [p, cialo[p]]));
    let wynikOstrzezen = [];
    db().transaction(() => {
      if (Object.keys(zmiany).length > 0) {
        const { osoba: po, bledy } = osobyLogika.sprawdz(zmiany, osoba);
        if (bledy.length > 0) throw new BladWalidacji(bledy);
        daneOsoby.zmien(db(), osoba.id, Object.fromEntries(osobyLogika.POLA_EDYCJI.map((p) => [p, po[p] ?? null])), autor(zad));
        wynikOstrzezen = ostrzezenia(po, osoba.id);
      }
      if (cialo.zgoda_email !== undefined) zmienZgode(daneOsoby.wczytaj(db(), osoba.id), cialo.zgoda_email || {}, autor(zad));
    }).immediate();
    odp.json({ osoba: daneOsoby.wczytaj(db(), osoba.id), ostrzezenia: wynikOstrzezen });
  })
);

/** „Dokument zgody do podpisu” (U-03, U-11) — pismo do akcjonariusza dla wskazanej spółki. */
router.post(
  '/:id/dokument-zgody',
  asy((zad, odp) => {
    const osoba = wymagajOsoby(zad);
    const spolka = daneSpolki.wczytaj(db(), (zad.body || {}).spolka_id);
    if (!spolka) throw new BladWalidacji([{ pole: 'spolka_id', komunikat: 'Wskaż spółkę.' }]);
    if (!osoba.email) throw new BladWalidacji([{ pole: 'email', komunikat: 'Podaj adres e-mail osoby — wpisuje się go do dokumentu zgody.' }]);
    const id = pisma.utworz(db(), 'zgoda_email', {
      spolka_id: spolka.id,
      adresat: 'osoba',
      adresat_osoba_id: osoba.id,
      kontekst: { akcjonariusz: osoba.nazwa, akcjonariusz_adres: osoba.adres, akcjonariusz_email: osoba.email },
      autor: autor(zad),
    });
    odp.status(201).json({ pismo_id: id });
  })
);

router.post(
  '/:id/pliki',
  (zad, odp, dalej) => pliki.odbierz(zad, odp, dalejPoUploadzie(dalej)),
  asy((zad, odp) => {
    const osoba = wymagajOsoby(zad);
    odp.status(201).json({ id: pliki.przyjmij(db(), zad.file, { osoba_id: osoba.id }, autor(zad)) });
  })
);

module.exports = router;
