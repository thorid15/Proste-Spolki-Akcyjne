'use strict';

/**
 * Trasy `/api/psa/oplaty/...` - rozliczenia (sekcja 8 specyfikacji).
 */

const express = require('express');

const { db } = require('../baza');
const oplaty = require('../oplaty');
const platnosci = require('../platnosci');
const dziennikDostepu = require('../logika/dziennik-dostepu');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');
const { wymagajAdmina } = require('../pomocnicze/autoryzacja');

const router = express.Router();

const TYPY = ['prowadzenie', 'wpis', 'informacja'];
const STATUSY = ['naliczona', 'zafakturowana', 'oplacona', 'anulowana'];

function widokWiersza(w) {
  return { ...w, kwota_zl: w.kwota_grosze / 100 };
}

/**
 * Rozliczenia SPOLKA PO SPOLCE — tak, jak pracownik o nich mysli:
 * „co jest do zafakturowania u tej spolki", a nie „wszystkie naleznosci
 * kancelarii posortowane po dacie".
 */
router.get(
  '/wg-spolek',
  asy((zad, odp) => {
    const wiersze = db()
      .prepare(
        `SELECT o.*, s.nazwa AS spolka_nazwa, s.krs AS spolka_krs,
                s.data_otwarcia_rejestru,
                (SELECT COUNT(*) FROM psa_platnosci p
                  WHERE p.oplata_id = o.id AND p.status = 'oplacona')  AS online,
                os.nazwisko AS zamawiajacy_nazwisko, os.imie AS zamawiajacy_imie,
                os.nazwa AS zamawiajacy_nazwa
           FROM psa_oplaty o
           JOIN psa_spolki s ON s.id = o.spolka_id
           LEFT JOIN psa_osoby os ON os.id = o.zamawiajacy_osoba_id
          WHERE o.status != 'anulowana'
          ORDER BY s.nazwa COLLATE NOCASE, o.data_naliczenia DESC, o.id DESC`
      )
      .all();

    const wgSpolki = new Map();
    for (const w of wiersze) {
      if (!wgSpolki.has(w.spolka_id)) {
        wgSpolki.set(w.spolka_id, {
          spolka_id: w.spolka_id,
          spolka_nazwa: w.spolka_nazwa,
          spolka_krs: w.spolka_krs,
          data_otwarcia_rejestru: w.data_otwarcia_rejestru,
          oplaty: [],
          do_zaplaty_grosze: 0,
          bez_faktury_grosze: 0,
        });
      }
      const grupa = wgSpolki.get(w.spolka_id);
      grupa.oplaty.push({
        ...widokWiersza(w),
        oplacona_online: w.online > 0,
        zamawiajacy: w.zamawiajacy_osoba_id
          ? (w.zamawiajacy_nazwa || [w.zamawiajacy_nazwisko, w.zamawiajacy_imie].filter(Boolean).join(' '))
          : null,
      });
      if (w.status !== 'oplacona') grupa.do_zaplaty_grosze += w.kwota_grosze;
      if (!w.faktura_wystawiono) grupa.bez_faktury_grosze += w.kwota_grosze;
    }

    odp.json({
      spolki: [...wgSpolki.values()],
      // Okresy prowadzenia, ktore zaraz sie koncza — przypomnienie, ze
      // trzeba naliczyc kolejny rok i wystawic fakture.
      do_odnowienia: oplaty.okresyDoOdnowienia(db(), { dni: 45 }),
    });
  })
);

/**
 * Odhaczenie faktury. Aplikacja NIE wystawia faktur — robi to program
 * ksiegowy kancelarii. Tu zostaje slad: numer i data, zeby pracownik
 * widzial w jednym miejscu, co jeszcze nie poszlo do ksiegowosci.
 */
router.patch(
  '/:id/faktura',
  asy((zad, odp) => {
    const id = Number(zad.params.id);
    const oplata = oplaty.wczytaj(db(), id);
    if (!oplata) throw nieZnaleziono('Nie odnaleziono opłaty.');

    const cialo = zad.body || {};
    const wystawiona = cialo.wystawiona !== false;
    const numer = cialo.numer ? String(cialo.numer).trim() : null;

    db()
      .prepare(
        `UPDATE psa_oplaty
            SET faktura_wystawiono = ?, faktura_numer = ?, faktura_autor = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(
        wystawiona ? czas.terazIso() : null,
        wystawiona ? numer : null,
        wystawiona ? autor(zad) : null,
        czas.terazIso(),
        id
      );

    // Odhaczenie faktury SAMO przenosi naleznosc z „naliczona" na
    // „zafakturowana" — to jest dokladnie to, co odhaczenie znaczy, a osobne
    // klikniecie w liste statusow bylo powtarzaniem tej samej informacji.
    // Naleznosci juz oplaconej ani anulowanej nie ruszamy.
    if (oplata.status === 'naliczona' && wystawiona) {
      oplaty.zmienStatus(db(), { id, status: 'zafakturowana' });
    } else if (oplata.status === 'zafakturowana' && !wystawiona) {
      oplaty.zmienStatus(db(), { id, status: 'naliczona' });
    }

    odp.json({ oplata: widokWiersza(oplaty.wczytaj(db(), id)) });
  })
);

/**
 * Awaryjne odpytanie operatora o stan platnosci — gdy powiadomienie nie
 * doszlo. Ksieguje dokladnie tak samo jak powiadomienie, wiec skutek jest
 * identyczny; to nie jest "recznie oznacz jako oplacona".
 */
router.post(
  '/platnosci/:id/sprawdz',
  asy(async (zad, odp) => {
    let wynik;
    try {
      wynik = await platnosci.sprawdzUOperatora(db(), Number(zad.params.id));
    } catch (e) {
      throw bledneZadanie(e.message);
    }
    odp.json({ status: wynik.status, zaksiegowano: wynik.zaksiegowano });
  })
);

/** Naliczenie kolejnych okresow prowadzenia tym spolkom, ktorym rok sie konczy. */
router.post(
  '/odnowienia',
  wymagajAdmina,
  asy((zad, odp) => {
    const dni = (zad.body || {}).dni != null ? Number((zad.body || {}).dni) : 0;
    if (!Number.isInteger(dni) || dni < 0 || dni > 365) {
      throw bledneZadanie('Wyprzedzenie musi być liczbą dni od 0 do 365.');
    }
    const { naliczone, pominiete } = oplaty.naliczOdnowienia(db(), { dni, autor: autor(zad) });
    odp.json({
      naliczone: naliczone.map(widokWiersza),
      pominiete: pominiete.map(widokWiersza),
      komunikat: naliczone.length === 0
        ? 'Żadnej spółce nie kończy się właśnie okres prowadzenia rejestru.'
        : `Naliczono kolejny rok prowadzenia rejestru dla ${naliczone.length} spółek.`,
    });
  })
);

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

    // Wyniesienie zestawienia oplat z systemu - blok D4, zakres WASKI.
    dziennikDostepu.zapisz(db(), {
      kto: autor(zad), typKto: 'pracownik',
      spolkaId: zad.query.spolka_id ? Number(zad.query.spolka_id) : null,
      akcja: dziennikDostepu.AKCJE.EKSPORT, opis: 'eksport CSV — zestawienie opłat',
    });

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
