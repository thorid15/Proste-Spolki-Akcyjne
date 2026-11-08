'use strict';

/**
 * Spółki — lista i kokpit spółki (§ 5). Zmiana danych spółki to „Edytuj” z historią (U-25).
 * „Nowy wpis” i „Zamknij rejestr” zakładają sprawę (`/api/psa/sprawy`).
 */

const express = require('express');

const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const rejestr = require('../rejestr');
const informacje = require('../informacje');
const eksport = require('../eksport');
const dziennik = require('../logika/dziennik-dostepu');
const sprawy = require('../sprawy');
const stanLogika = require('../logika/stan');
const walidacje = require('../logika/walidacje');
const daneSpolki = require('../dane/spolki');
const daneOsoby = require('../dane/osoby');
const danePliki = require('../dane/pliki');
const danePisma = require('../dane/pisma');
const daneOplaty = require('../dane/oplaty');
const historia = require('../dane/historia');
const { asy, autor, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

function wymagajSpolki(zad) {
  const spolka = daneSpolki.wczytaj(db(), zad.params.id);
  if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
  return spolka;
}

router.get(
  '/',
  asy((zad, odp) => {
    odp.json(daneSpolki.lista(db(), { q: zad.query.q || '' }));
  })
);

/** Kokpit spółki na dzień (`?dzien=RRRR-MM-DD`; domyślnie stan bieżący — U-22, U-24). */
router.get(
  '/:id',
  asy((zad, odp) => {
    const spolka = wymagajSpolki(zad);
    const dzien = zad.query.dzien && czas.poprawnaData(zad.query.dzien) ? zad.query.dzien : null;
    const stan = rejestr.stanSpolki(db(), spolka.id, dzien);
    const widok = stanLogika.widok(stan);
    const idOsob = new Set([...widok.akcjonariusze.map((p) => p.osoba_id), ...widok.atrybuty.map((a) => a.osoba_id).filter(Boolean)]);
    const osoby = Object.fromEntries([...idOsob].map((id) => [id, daneOsoby.wczytaj(db(), id)]));
    odp.json({
      spolka,
      dzien,
      rejestr: widok,
      osoby,
      wpisy: stan.wpisy,
      sprawy: sprawy.lista(db(), { spolkaId: spolka.id }),
      pliki: danePliki.lista(db(), { spolkaId: spolka.id }),
      pisma: danePisma.lista(db(), { spolkaId: spolka.id }),
      oplaty: daneOplaty.lista(db(), { spolkaId: spolka.id }),
      historia: historia.lista(db(), { spolkaId: spolka.id }),
    });
  })
);

router.put(
  '/:id',
  asy((zad, odp) => {
    const spolka = wymagajSpolki(zad);
    const zmiany = {};
    for (const pole of daneSpolki.POLA_EDYCJI) {
      if ((zad.body || {})[pole] === undefined) continue;
      const v = zad.body[pole];
      zmiany[pole] = v === null || String(v).trim() === '' ? null : String(v).trim();
    }
    const bledy = walidacje.sprawdzSpolke(zmiany);
    if (bledy.length > 0) throw new walidacje.BladWalidacji(bledy);
    daneSpolki.zmien(db(), spolka.id, zmiany, autor(zad));
    odp.json(daneSpolki.wczytaj(db(), spolka.id));
  })
);


/** „Informacja z rejestru” w kokpicie (§ 4, U-24): pracownik — dowolny dzień od otwarcia, także dziś. */
router.post(
  '/:id/informacja',
  asy((zad, odp) => {
    const spolka = wymagajSpolki(zad);
    const b = zad.body || {};
    const wynik = informacje.wydajInformacje(db(), {
      spolkaId: spolka.id,
      odbiorca: { rodzaj: b.odbiorca, osobaId: b.osoba_id, opis: b.organ },
      sygnatura: b.sygnatura,
      dzien: b.dzien || null,
      oplata: b.oplata,
      kto: autor(zad),
    });
    odp.status(201).json({ pismo_id: wynik.pismoId, numer: wynik.numer });
  })
);


/** Eksport całego rejestru do ZIP (art. 90a PrNot) — z wpisem do dziennika. */
router.get(
  '/:id/eksport',
  asy(async (zad, odp) => {
    const spolka = wymagajSpolki(zad);
    const plik = await eksport.zbudujEksport(db(), spolka.id);
    dziennik.zapisz(db(), { kto: autor(zad), typKto: 'pracownik', spolkaId: spolka.id, akcja: dziennik.AKCJE.EKSPORT, opis: 'eksport ZIP' });
    odp.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="rejestr-${spolka.krs}-${czas.dzisIso()}.zip"`,
      'X-Content-Type-Options': 'nosniff',
    });
    odp.send(plik);
  })
);

module.exports = router;
