'use strict';

/**
 * Trasy `/api/psa/oplaty/...` - rozliczenia (sekcja 8 specyfikacji).
 */

const express = require('express');

const { db } = require('../baza');
const oplaty = require('../oplaty');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');
const { wymagajAdmina } = require('../pomocnicze/autoryzacja');

const router = express.Router();

const TYPY = ['prowadzenie', 'wpis', 'informacja'];
const STATUSY = ['naliczona', 'zafakturowana', 'oplacona', 'anulowana'];

function widokWiersza(w) {
  return { ...w, kwota_zl: w.kwota_grosze / 100 };
}

/** Lista z filtrami + suma w groszach (do nagłówka ekranu). */
router.get(
  '/',
  asy((zad, odp) => {
    const warunki = [];
    const parametry = [];

    if (zad.query.spolka_id) {
      warunki.push('o.spolka_id = ?');
      parametry.push(Number(zad.query.spolka_id));
    }
    if (zad.query.typ) {
      warunki.push('o.typ = ?');
      parametry.push(String(zad.query.typ));
    }
    if (zad.query.status) {
      warunki.push('o.status = ?');
      parametry.push(String(zad.query.status));
    }
    if (zad.query.okres) {
      warunki.push('o.okres = ?');
      parametry.push(String(zad.query.okres));
    }

    const gdzie = warunki.length ? `WHERE ${warunki.join(' AND ')}` : '';
    const wiersze = db()
      .prepare(
        `SELECT o.*, s.nazwa AS spolka_nazwa
           FROM psa_oplaty o
           JOIN psa_spolki s ON s.id = o.spolka_id
           ${gdzie}
          ORDER BY o.data_naliczenia DESC, o.id DESC`
      )
      .all(...parametry);

    const sumaGrosze = wiersze
      .filter((w) => w.status !== 'anulowana')
      .reduce((s, w) => s + w.kwota_grosze, 0);

    odp.json({ oplaty: wiersze.map(widokWiersza), suma_grosze: sumaGrosze });
  })
);

/** CSV do eksportu zestawienia (sekcja 14 - "eksport zestawienia"). */
router.get(
  '/eksport',
  asy((zad, odp) => {
    const warunki = [];
    const parametry = [];
    if (zad.query.spolka_id) {
      warunki.push('o.spolka_id = ?');
      parametry.push(Number(zad.query.spolka_id));
    }
    if (zad.query.typ) {
      warunki.push('o.typ = ?');
      parametry.push(String(zad.query.typ));
    }
    if (zad.query.status) {
      warunki.push('o.status = ?');
      parametry.push(String(zad.query.status));
    }
    if (zad.query.okres) {
      warunki.push('o.okres = ?');
      parametry.push(String(zad.query.okres));
    }
    const gdzie = warunki.length ? `WHERE ${warunki.join(' AND ')}` : '';
    const wiersze = db()
      .prepare(
        `SELECT o.*, s.nazwa AS spolka_nazwa
           FROM psa_oplaty o
           JOIN psa_spolki s ON s.id = o.spolka_id
           ${gdzie}
          ORDER BY o.data_naliczenia DESC, o.id DESC`
      )
      .all(...parametry);

    const csv = oplaty.eksportujCsv(wiersze);
    const BOM = String.fromCharCode(0xfeff);
    odp.setHeader('Content-Type', 'text/csv; charset=utf-8');
    odp.setHeader('Content-Disposition', `attachment; filename="oplaty-${czas.dzisIso()}.csv"`);
    // BOM na poczatku - Excel PL otwiera UTF-8 CSV bez krzakow tylko z BOM.
    // `fromCharCode` zamiast literalnego znaku w zrodle - zeby plik zrodlowy
    // nie zalezal od tego, czy edytor zachowa niewidzialny U+FEFF bez zmian.
    odp.send(BOM + csv);
  })
);

/** Reczny wpis oplaty - np. informacja wydana na miejscu, korekta. */
router.post(
  '/',
  asy((zad, odp) => {
    const kto = autor(zad);
    const cialo = zad.body || {};

    const spolkaId = Number(cialo.spolka_id);
    if (!db().prepare('SELECT id FROM psa_spolki WHERE id = ?').get(spolkaId)) {
      throw bledneZadanie('Nie odnaleziono spółki.');
    }
    const typ = String(cialo.typ || '');
    if (!TYPY.includes(typ)) throw bledneZadanie(`Typ opłaty musi być jednym z: ${TYPY.join(', ')}.`);
    if (typ === 'prowadzenie' && !cialo.okres) {
      throw bledneZadanie('Opłata za prowadzenie rejestru wymaga wskazania okresu (roku).');
    }

    const wpis = oplaty.dodajOplateReczna(db(), {
      spolkaId,
      sprawaId: cialo.sprawa_id ? Number(cialo.sprawa_id) : null,
      typ,
      kwotaGrosze: cialo.kwota_grosze,
      okres: cialo.okres ? String(cialo.okres) : null,
      notatka: cialo.notatka ? String(cialo.notatka).trim() : null,
      autor: kto,
    });

    odp.status(201).json({ oplata: widokWiersza(wpis) });
  })
);

/** Zmiana statusu (naliczona → zafakturowana → oplacona; albo anulowana). */
router.patch(
  '/:id',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    if (!oplaty.wczytaj(db(), id)) throw nieZnaleziono('Nie odnaleziono opłaty.');

    const status = String((zad.body || {}).status || '');
    if (!STATUSY.includes(status)) throw bledneZadanie(`Status musi być jednym z: ${STATUSY.join(', ')}.`);

    const wpis = oplaty.zmienStatus(db(), { id, status });
    odp.json({ oplata: widokWiersza(wpis) });
  })
);

/** Naliczenie roczne wsadowe - admin, idempotentne per spolka+rok. */
router.post(
  '/naliczenie-roczne',
  wymagajAdmina,
  asy((zad, odp) => {
    const kto = autor(zad);
    const rok = (zad.body || {}).rok ? String((zad.body || {}).rok) : String(new Date(czas.dzisIso()).getFullYear());
    if (!/^\d{4}$/.test(rok)) throw bledneZadanie('Rok musi być czterocyfrową liczbą.');

    const { naliczone, pominiete } = oplaty.naliczOplateRoczneWszystkie(db(), { rok, autor: kto });
    odp.json({
      rok,
      naliczone: naliczone.map(widokWiersza),
      pominiete: pominiete.map(widokWiersza),
      komunikat: `Naliczono opłatę za prowadzenie rejestru dla ${naliczone.length} spółek (${pominiete.length} miało już naliczoną opłatę za ${rok}).`,
    });
  })
);

module.exports = router;
