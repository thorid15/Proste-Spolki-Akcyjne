'use strict';

/**
 * Trasy `/api/psa/zawiadomienia/...` — zawiadomienia o wpisie (art. 300(34)
 * § 7 KSH), wystawiane RĘCZNIE, po zakończeniu pracy nad spółką.
 *
 * Dlaczego nie od razu przy wpisie: jedna czynność w rejestrze to często
 * KILKA zdarzeń (emisja, potem objęcie tych samych akcji, czasem jeszcze
 * ograniczenie). Zawiadomienie wysyłane po każdym z osobna zasypywało
 * klienta trzema pismami o jednej sprawie, z których dwa pierwsze opisywały
 * stan przejściowy — po samej emisji akcje nie mają jeszcze akcjonariusza.
 * Ustawa mówi „niezwłocznie o dokonaniu wpisu", nie „osobno o każdym
 * zdarzeniu", więc pracownik zaznacza sprawy i wysyła je razem, gdy komplet
 * wpisów jest gotowy.
 *
 * Kolejka to wszystkie sprawy w stanie „wpisana", do których nie wyszło
 * jeszcze zawiadomienie — liczone wprost z `psa_wydane_dokumenty`, bez
 * osobnej kolumny „czy wysłano”, żeby nie było dwóch źródeł prawdy.
 */

const express = require('express');

const { db } = require('../baza');
const rejestr = require('../rejestr');
const widoki = require('../widoki');
const zawiadomienia = require('../zawiadomienia');
const { asy, autor, bledneZadanie } = require('../pomocnicze/odpowiedzi');

const router = express.Router();

/** Sprawy wpisane, do których zawiadomienie o wpisie jeszcze nie wyszło. */
function doWystawienia(spolkaId) {
  const warunekSpolki = spolkaId ? 'AND sp.spolka_id = ?' : '';
  const parametry = spolkaId ? [spolkaId] : [];
  return db()
    .prepare(
      `SELECT sp.id, sp.spolka_id, sp.typ_zdarzenia, sp.zdarzenie_id, sp.data_wplywu,
              sp.zadajacy_osoba_id, sp.zaktualizowano,
              s.nazwa AS spolka_nazwa, s.email AS spolka_email
         FROM psa_sprawy sp
         JOIN psa_spolki s ON s.id = sp.spolka_id
        WHERE sp.stan = 'wpisana'
          ${warunekSpolki}
          AND NOT EXISTS (
            SELECT 1 FROM psa_wydane_dokumenty w
             WHERE w.sprawa_id = sp.id AND w.typ = 'zawiadomienie_wpis'
          )
        ORDER BY sp.spolka_id, sp.id`
    )
    .all(...parametry);
}

router.get(
  '/',
  asy((zad, odp) => {
    const spolkaId = zad.query.spolka_id ? Number(zad.query.spolka_id) : null;
    const wiersze = doWystawienia(spolkaId);

    // Grupujemy po spolce: pracownik wysyla zawiadomienie ZA CALA robote
    // przy jednej spolce, a nie sprawa po sprawie.
    const wgSpolki = new Map();
    for (const w of wiersze) {
      if (!wgSpolki.has(w.spolka_id)) {
        wgSpolki.set(w.spolka_id, {
          spolka_id: w.spolka_id,
          spolka_nazwa: w.spolka_nazwa,
          spolka_email: w.spolka_email,
          sprawy: [],
        });
      }
      wgSpolki.get(w.spolka_id).sprawy.push({
        id: w.id,
        typ_zdarzenia: w.typ_zdarzenia,
        zdarzenie_id: w.zdarzenie_id,
        data_wplywu: w.data_wplywu,
        zaktualizowano: w.zaktualizowano,
      });
    }

    odp.json({ spolki: [...wgSpolki.values()], razem: wiersze.length });
  })
);

/**
 * Wystawia i wysyła zawiadomienia dla WSKAZANYCH spraw. Każda sprawa
 * osobnym pismem (zawiadomienie odnosi się do konkretnego wpisu), ale
 * jednym kliknięciem — bo klient i tak dostaje je jedną porcją.
 */
router.post(
  '/wyslij',
  asy(async (zad, odp) => {
    const kto = autor(zad);
    const idy = Array.isArray((zad.body || {}).sprawa_ids)
      ? [...new Set((zad.body || {}).sprawa_ids.map(Number).filter(Number.isInteger))]
      : [];
    if (idy.length === 0) throw bledneZadanie('Wskaż przynajmniej jedną sprawę do zawiadomienia.');

    const dozwolone = new Set(doWystawienia(null).map((w) => w.id));
    for (const id of idy) {
      if (!dozwolone.has(id)) {
        throw bledneZadanie(
          `Sprawa #${id} nie czeka na zawiadomienie — nie jest wpisana albo zawiadomienie już wyszło.`
        );
      }
    }

    const wyniki = [];
    for (const id of idy) {
      const sprawa = db().prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(id);
      const zdarzenie = db().prepare('SELECT * FROM psa_zdarzenia WHERE id = ?').get(sprawa.zdarzenie_id);
      const spolka = rejestr.wczytajSpolke(db(), sprawa.spolka_id);
      const osoby = new Map([
        ...rejestr.wczytajOsoby(db(), sprawa.zadajacy_osoba_id ? [sprawa.zadajacy_osoba_id] : []),
        ...rejestr.wczytajOsobySpolki(db(), sprawa.spolka_id),
      ]);
      const podsumowanie = widoki.podsumujZdarzenie(
        { ...zdarzenie, dane: JSON.parse(zdarzenie.dane_json || '{}') },
        osoby
      );

      try {
        wyniki.push({
          sprawa_id: id,
          pisma: await zawiadomienia.poWpisie(db(), {
            sprawa, zdarzenie, spolka, osoby, podsumowanie, autor: kto,
          }),
        });
      } catch (e) {
        wyniki.push({ sprawa_id: id, blad: e.message });
      }
    }

    odp.json({ wyniki, pozostalo: doWystawienia(null).length });
  })
);

module.exports = router;
