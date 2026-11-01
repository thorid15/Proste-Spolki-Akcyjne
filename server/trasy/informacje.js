'use strict';

/**
 * Dziennik wydanych informacji (W5.6) i wydanie informacji organowi (W5.3,
 * art. 300(35) § 4 KSH) — wyłącznie aplikacja kancelarii. Organy nie mają
 * dostępu do portalu.
 */

const express = require('express');
const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const przepisy = require('../logika/przepisy');
const ustawienia = require('../logika/ustawienia');
const rejestr = require('../rejestr');
const widoki = require('../widoki');
const informacjaDokument = require('../logika/informacja-dokument');
const dziennikDostepu = require('../logika/dziennik-dostepu');
const informacje = require('../informacje');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

router.get('/', asy((zad, odp) => {
  odp.json({ informacje: informacje.dziennik(db()) });
}));

router.get('/:id', asy((zad, odp) => {
  const w = db().prepare("SELECT * FROM psa_wydane_dokumenty WHERE id = ? AND typ = 'informacja_z_rejestru'")
    .get(Number(zad.params.id));
  if (!w) throw nieZnaleziono('Nie odnaleziono informacji.');
  odp.type('html').send(w.tresc_html || '');
}));

/** Wydanie informacji organowi: odbiorca, sygnatura sprawy, wpis do dziennika. */
router.post('/organ', asy((zad, odp) => {
  const cialo = zad.body || {};
  const spolka = rejestr.wczytajSpolke(db(), Number(cialo.spolka_id));
  if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
  const organ = String(cialo.organ || '').trim();
  const sygnatura = String(cialo.sygnatura || '').trim();
  if (!organ) throw bledneZadanie('Podaj organ, któremu wydajesz informację.');
  // art. 300(35) § 4 KSH wiąże dostęp z toczącym się postępowaniem — sygnatura obowiązkowa.
  if (!sygnatura) throw bledneZadanie(`Podaj sygnaturę sprawy organu (${przepisy.PODSTAWY.DOSTEP_ORGANOW}).`);

  const kto = autor(zad);
  const data = czas.dzisIso();
  const stan = widoki.widokStanu(db(), spolka.id, data, { rola: przepisy.ROLE_ODBIORCY.ORGAN });
  const numer = informacje.nadajNumer(db());
  const trescHtml = informacjaDokument.informacjaZRejestru({
    kancelaria: ustawienia.kancelaria(db()),
    spolka: stan.spolka,
    data,
    stan,
    odbiorca: { rola: przepisy.ROLE_ODBIORCY.ORGAN, opis: `${organ} — sygn. ${sygnatura}` },
    sporzadzono: czas.terazIso(),
    numer,
    // D-083 — od organów nie pobieramy opłat.
    wynagrodzenie: informacje.wynagrodzenie(db(), { spolka, pobrano: false, uwaga: 'informacja dla organu — bez opłaty' }),
  });
  const wynik = db().prepare(
    `INSERT INTO psa_wydane_dokumenty (spolka_id, typ, kanal, tresc_html, wyslano, autor, utworzono, numer, odbiorca_opis, sygnatura)
     VALUES (?, 'informacja_z_rejestru', 'papier', ?, NULL, ?, ?, ?, ?, ?)`
  ).run(spolka.id, trescHtml, kto, czas.terazIso(), numer, organ, sygnatura);
  dziennikDostepu.zapisz(db(), {
    kto, typKto: 'pracownik', spolkaId: spolka.id, akcja: dziennikDostepu.AKCJE.INFORMACJA_Z_REJESTRU,
    opis: `informacja ${numer} dla organu: ${organ}, sygn. ${sygnatura}`,
  });
  odp.status(201).json({ numer, dokument_id: Number(wynik.lastInsertRowid), spolka_id: spolka.id });
}));

module.exports = router;
