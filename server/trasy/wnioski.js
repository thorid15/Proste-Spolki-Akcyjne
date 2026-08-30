'use strict';

/**
 * Trasy `/api/psa/wnioski/...` - weryfikacja wniosku klienta przez kancelarie
 * (etap 3F).
 *
 * Kolejka wniosków od momentu odesłania podpisanej umowy (status
 * `umowa_podpisana`) aż do przyjęcia (`przyjety`) albo odesłania do
 * uzupełnienia/odrzucenia. Widok porównuje dane od klienta z żywym
 * odpisem KRS, pozwala poprawić dowolne pole i zweryfikować każdą
 * proponowaną pozycję akcjonariusza z osobna ("akceptacja pozycja po
 * pozycji" — opis etapu 3 promptu).
 *
 * `POST /:id/przyjmij` jest jedyną operacją, która faktycznie zakłada
 * realne wpisy (`psa_spolki`, `psa_osoby`) — dlatego jest twardo
 * zablokowana, dopóki nie każda pozycja jest zweryfikowana (regula ogólna
 * nr 3: twarde blokady dopiero przy faktycznej operacji rejestrowej).
 * Samo otwarcie rejestru (emisja założycielska, seria, cena) NIE jest tu
 * automatyzowane — po przyjęciu wniosku kancelaria kończy zakładanie
 * spółki w istniejącym kreatorze wewnętrznym (`server/trasy/spolki.js`),
 * mając już założoną spółkę i akcjonariuszy w kartotece do wyboru.
 */

const express = require('express');

const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');
const { pobierzZKrs } = require('./krs');
const portal = require('./portal');
const osobyModul = require('./osoby');
const spolkiModul = require('./spolki');
const akcjonariuszLogika = require('../logika/akcjonariusz');

const router = express.Router();

const STATUSY_ZAMKNIETE = ['przyjety', 'odrzucony'];

function wczytajWniosek(id) {
  return db()
    .prepare(
      `SELECT w.*, k.email AS konto_email
         FROM psa_wnioski w JOIN psa_konta k ON k.id = w.konto_id
        WHERE w.id = ?`
    )
    .get(id);
}

function wczytajAkcjonariuszy(wniosekId) {
  return db()
    .prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE wniosek_id = ? ORDER BY kolejnosc, id')
    .all(wniosekId);
}

router.get(
  '/',
  asy((zad, odp) => {
    const warunki = [];
    const parametry = [];
    if (zad.query.status) {
      warunki.push('w.status = ?');
      parametry.push(String(zad.query.status));
    }
    const gdzie = warunki.length ? `WHERE ${warunki.join(' AND ')}` : '';
    const wiersze = db()
      .prepare(
        `SELECT w.*, k.email AS konto_email,
                (SELECT COUNT(*) FROM psa_wnioski_akcjonariusze a WHERE a.wniosek_id = w.id) AS liczba_akcjonariuszy
           FROM psa_wnioski w JOIN psa_konta k ON k.id = w.konto_id
           ${gdzie}
           ORDER BY w.zaktualizowano DESC, w.utworzono DESC`
      )
      .all(...parametry);
    odp.json({ wnioski: wiersze });
  })
);

router.get(
  '/:id',
  asy(async (zad, odp) => {
    const wniosek = wczytajWniosek(Number(zad.params.id));
    if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
    const akcjonariusze = wczytajAkcjonariuszy(wniosek.id);

    let krs = null;
    const numerKrs = String(wniosek.krs || '').replace(/\D/g, '');
    if (numerKrs.length === 10) {
      krs = await pobierzZKrs(numerKrs);
    }

    // Braki wobec art. 300(33) § 1 KSH, liczone per pozycja - kancelaria
    // widzi je przy weryfikacji, zanim odhaczy akcjonariusza jako
    // zweryfikowanego.
    const braki = {};
    for (const a of akcjonariusze) {
      const lista = akcjonariuszLogika.ostrzezenia(a);
      if (lista.length > 0) braki[a.id] = lista;
    }

    odp.json({ wniosek, akcjonariusze, krs, braki_ustawowe: braki });
  })
);

/** Wymaga wniosku w stanie, ktory jeszcze nie jest zamkniety (przyjety/odrzucony). */
function wczytajOtwartyWniosek(id) {
  const wniosek = wczytajWniosek(id);
  if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
  if (STATUSY_ZAMKNIETE.includes(wniosek.status)) {
    throw bledneZadanie(`Wniosek ma już status „${wniosek.status}” — jest zamknięty.`);
  }
  return wniosek;
}

router.put(
  '/:id',
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    const dane = portal.wyczyscWniosek(zad.body || {});
    portal.sprawdzDaneWniosku(dane);
    if (Object.keys(dane).length > 0) {
      db()
        .prepare(
          `UPDATE psa_wnioski
              SET ${Object.keys(dane).map((k) => `${k} = @${k}`).join(', ')}, zaktualizowano = @zaktualizowano
            WHERE id = @id`
        )
        .run({ ...dane, zaktualizowano: czas.terazIso(), id: wniosek.id });
    }
    odp.json({ wniosek: wczytajWniosek(wniosek.id) });
  })
);

function wczytajAkcjonariuszaWniosku(wniosekId, id) {
  const wiersz = db().prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE id = ?').get(id);
  if (!wiersz || Number(wiersz.wniosek_id) !== Number(wniosekId)) return null;
  return wiersz;
}

router.post(
  '/:id/akcjonariusze',
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    const dane = portal.wyczyscAkcjonariuszaWniosku(zad.body || {});
    portal.sprawdzAkcjonariuszaWniosku(dane);
    const maks = db()
      .prepare('SELECT COALESCE(MAX(kolejnosc), -1) AS m FROM psa_wnioski_akcjonariusze WHERE wniosek_id = ?')
      .get(wniosek.id).m;
    const kolumny = Object.keys(dane);
    const wynik = db()
      .prepare(
        `INSERT INTO psa_wnioski_akcjonariusze (wniosek_id, kolejnosc${kolumny.length ? ', ' + kolumny.join(', ') : ''}, utworzono)
         VALUES (@wniosek_id, @kolejnosc${kolumny.length ? ', ' + kolumny.map((k) => `@${k}`).join(', ') : ''}, @utworzono)`
      )
      .run({ ...dane, wniosek_id: wniosek.id, kolejnosc: maks + 1, utworzono: czas.terazIso() });
    odp.status(201).json({
      akcjonariusz: db().prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE id = ?').get(wynik.lastInsertRowid),
    });
  })
);

router.put(
  '/:id/akcjonariusze/:akcId',
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    const istniejacy = wczytajAkcjonariuszaWniosku(wniosek.id, Number(zad.params.akcId));
    if (!istniejacy) throw nieZnaleziono('Nie odnaleziono pozycji akcjonariusza.');
    const dane = portal.wyczyscAkcjonariuszaWniosku(zad.body || {});
    portal.sprawdzAkcjonariuszaWniosku(dane);
    if (Object.keys(dane).length > 0) {
      db()
        .prepare(
          `UPDATE psa_wnioski_akcjonariusze
              SET ${Object.keys(dane).map((k) => `${k} = @${k}`).join(', ')}, zaktualizowano = @zaktualizowano
            WHERE id = @id`
        )
        .run({ ...dane, zaktualizowano: czas.terazIso(), id: istniejacy.id });
    }
    odp.json({ akcjonariusz: db().prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE id = ?').get(istniejacy.id) });
  })
);

router.delete(
  '/:id/akcjonariusze/:akcId',
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    const istniejacy = wczytajAkcjonariuszaWniosku(wniosek.id, Number(zad.params.akcId));
    if (!istniejacy) throw nieZnaleziono('Nie odnaleziono pozycji akcjonariusza.');
    db().prepare('DELETE FROM psa_wnioski_akcjonariusze WHERE id = ?').run(istniejacy.id);
    odp.json({ ok: true });
  })
);

/**
 * Akceptacja POZYCJA PO POZYCJI (opis etapu 3 promptu). `osoba_id` opcjonalny
 * - kancelaria dopasowala pozycje do JUZ istniejacego wpisu w kartotece
 * wspolnej (regula domenowa nr 10); brak `osoba_id` oznacza "nowa osoba",
 * ktora powstanie dopiero przy POST .../przyjmij.
 */
router.post(
  '/:id/akcjonariusze/:akcId/zweryfikuj',
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    const istniejacy = wczytajAkcjonariuszaWniosku(wniosek.id, Number(zad.params.akcId));
    if (!istniejacy) throw nieZnaleziono('Nie odnaleziono pozycji akcjonariusza.');

    const zweryfikowano = (zad.body || {}).zweryfikowano ? 1 : 0;
    let osobaId = null;
    if (zweryfikowano && (zad.body || {}).osoba_id) {
      const osoba = db().prepare('SELECT id FROM psa_osoby WHERE id = ?').get(Number(zad.body.osoba_id));
      if (!osoba) throw bledneZadanie('Wskazana osoba nie istnieje w kartotece.');
      osobaId = osoba.id;
    }

    db()
      .prepare(
        `UPDATE psa_wnioski_akcjonariusze SET zweryfikowano = ?, osoba_id = ?, zaktualizowano = ? WHERE id = ?`
      )
      .run(zweryfikowano, osobaId, czas.terazIso(), istniejacy.id);

    odp.json({ akcjonariusz: db().prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE id = ?').get(istniejacy.id) });
  })
);

router.post(
  '/:id/do-uzupelnienia',
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    const notatka = String((zad.body || {}).notatka || '').trim();
    if (!notatka) throw bledneZadanie('Podaj notatkę — klient musi wiedzieć, co poprawić.');

    db()
      .prepare(
        `UPDATE psa_wnioski
            SET status = 'do_uzupelnienia', notatka_weryfikacji = ?, obsluzone_przez = ?, obsluzone_kiedy = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(notatka, autor(zad), czas.terazIso(), czas.terazIso(), wniosek.id);

    odp.json({ wniosek: wczytajWniosek(wniosek.id) });
  })
);

router.post(
  '/:id/odrzuc',
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    const notatka = String((zad.body || {}).notatka || '').trim() || null;

    db()
      .prepare(
        `UPDATE psa_wnioski
            SET status = 'odrzucony', notatka_weryfikacji = ?, obsluzone_przez = ?, obsluzone_kiedy = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(notatka, autor(zad), czas.terazIso(), czas.terazIso(), wniosek.id);

    odp.json({ wniosek: wczytajWniosek(wniosek.id) });
  })
);

/**
 * Przyjecie wniosku - JEDYNA operacja tej trasy, ktora zaklada realne wpisy.
 * Wymaga: wniosek w stanie 'umowa_podpisana' (kolejnosc statusow z promptu -
 * weryfikacja nastepuje PO odeslaniu podpisanej umowy) i KAZDA pozycja
 * akcjonariusza zweryfikowana. Spolka: dowiazuje do istniejacej po numerze
 * KRS, jesli juz jest w kartotece (nie duplikuje), inaczej zaklada nowa.
 * Akcjonariusze: dowiazuje do wskazanej osoby (zweryfikuj z osoba_id) albo
 * zaklada nowa osobe z danych pozycji.
 */
router.post(
  '/:id/przyjmij',
  asy((zad, odp) => {
    const wniosek = wczytajWniosek(Number(zad.params.id));
    if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
    if (wniosek.status !== 'umowa_podpisana') {
      throw bledneZadanie(`Wniosek ma status „${wniosek.status}” — do przyjęcia wymagany jest status „umowa_podpisana”.`);
    }
    const akcjonariusze = wczytajAkcjonariuszy(wniosek.id);
    if (akcjonariusze.length === 0) throw bledneZadanie('Wniosek nie ma żadnego akcjonariusza.');
    const niezweryfikowani = akcjonariusze.filter((a) => !a.zweryfikowano);
    if (niezweryfikowani.length > 0) {
      throw bledneZadanie(
        `${niezweryfikowani.length} z ${akcjonariusze.length} pozycji akcjonariuszy nie jest jeszcze zweryfikowanych.`
      );
    }

    const teraz = czas.terazIso();

    let spolkaId = wniosek.spolka_id;
    if (!spolkaId) {
      const krsCzysty = String(wniosek.krs || '').replace(/\D/g, '') || null;
      const dopasowana = krsCzysty ? db().prepare('SELECT id FROM psa_spolki WHERE krs = ?').get(krsCzysty) : null;
      if (dopasowana) {
        spolkaId = dopasowana.id;
      } else {
        const daneSpolki = {};
        for (const pole of spolkiModul.POLA_SPOLKI) {
          // "status" wystepuje w OBU tabelach, ale ze zupelnie innym katalogiem
          // wartosci (status WNIOSKU vs status SPOLKI, np. 'aktywna') -
          // wspolna nazwa kolumny jest przypadkowa, nie do przenoszenia.
          if (pole === 'status') continue;
          if (wniosek[pole] !== undefined && wniosek[pole] !== null) daneSpolki[pole] = wniosek[pole];
        }
        spolkiModul.sprawdzDaneSpolki(daneSpolki);
        const kolumny = Object.keys(daneSpolki);
        const wynikSpolki = db()
          .prepare(
            `INSERT INTO psa_spolki (${kolumny.join(', ')}, utworzono)
             VALUES (${kolumny.map((k) => `@${k}`).join(', ')}, @utworzono)`
          )
          .run({ ...daneSpolki, utworzono: teraz });
        spolkaId = Number(wynikSpolki.lastInsertRowid);
      }
    }

    for (const a of akcjonariusze) {
      if (a.osoba_id) continue;
      const daneOsoby = {};
      for (const pole of osobyModul.POLA_OSOBY) {
        if (a[pole] !== undefined && a[pole] !== null) daneOsoby[pole] = a[pole];
      }
      osobyModul.sprawdzOsobe(daneOsoby);
      const kolumnyOsoby = Object.keys(daneOsoby);
      const wynikOsoby = db()
        .prepare(
          `INSERT INTO psa_osoby (${kolumnyOsoby.join(', ')}, utworzono)
           VALUES (${kolumnyOsoby.map((k) => `@${k}`).join(', ')}, @utworzono)`
        )
        .run({ ...daneOsoby, utworzono: teraz });
      db()
        .prepare('UPDATE psa_wnioski_akcjonariusze SET osoba_id = ? WHERE id = ?')
        .run(Number(wynikOsoby.lastInsertRowid), a.id);
    }

    db()
      .prepare(
        `UPDATE psa_wnioski
            SET status = 'przyjety', spolka_id = ?, obsluzone_przez = ?, obsluzone_kiedy = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(spolkaId, autor(zad), teraz, teraz, wniosek.id);

    // Konto, ktore zlozylo wniosek, przestaje byc "wnioskodawca": osoba
    // podpisala umowe o prowadzenie rejestru W IMIENIU SPOLKI, wiec od
    // przyjecia wniosku widzi rejestr TEJ spolki - i wylacznie tej
    // (`maDostepDoSpolki` w trasach portalu porownuje spolka_id konta
    // z identyfikatorem w adresie). Bez tego kroku konto zostawalo w roli,
    // ktora po przyjeciu wniosku nie ma juz zadnego ekranu: formularz
    // wniosku jest zamkniety, a "Moje spolki" szuka akcji po osoba_id,
    // ktorego wnioskodawca nie ma.
    //
    // Przepinamy WYLACZNIE role "wnioskodawca". Konto akcjonariusza albo
    // konto juz przypisane do innej spolki zostaje nietkniete - zmiana
    // roli jest nadaniem dostepu do cudzych danych, wiec dzieje sie tylko
    // tam, gdzie wynika wprost ze zlozonego wniosku.
    const kontoWnioskodawcy = wniosek.konto_id
      ? db().prepare('SELECT id, rola FROM psa_konta WHERE id = ?').get(wniosek.konto_id)
      : null;
    const przepiete = Boolean(kontoWnioskodawcy && kontoWnioskodawcy.rola === 'wnioskodawca');
    if (przepiete) {
      db()
        .prepare(`UPDATE psa_konta SET rola = 'spolka', spolka_id = ? WHERE id = ?`)
        .run(spolkaId, kontoWnioskodawcy.id);
    }

    odp.json({
      wniosek: wczytajWniosek(wniosek.id),
      akcjonariusze: wczytajAkcjonariuszy(wniosek.id),
      spolka_id: spolkaId,
      konto_przepiete: przepiete,
    });
  })
);

module.exports = router;
