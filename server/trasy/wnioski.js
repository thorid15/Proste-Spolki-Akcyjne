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

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const konfiguracja = require('../konfiguracja');
const ustawienia = require('../logika/ustawienia');
const pliki = require('../pomocnicze/pliki');
const { asy, autor, bledneZadanie, nieZnaleziono } = require('../pomocnicze/odpowiedzi');
const { pobierzZKrs } = require('./krs');
const portal = require('./portal');
const osobyModul = require('./osoby');
const spolkiModul = require('./spolki');
const akcjonariuszLogika = require('../logika/akcjonariusz');
const pakietWniosku = require('../logika/pakiet-wniosku');
const blokiDokumentu = require('../logika/bloki-dokumentu');
const poczta = require('../poczta');

const router = express.Router();

const STATUSY_ZAMKNIETE = ['przyjety', 'odrzucony'];

/**
 * Przenosi komplet dokumentow wniosku do AKT SPOLKI.
 *
 * Wniosek jest sprawa w toku - zamyka sie i przestaje byc miejscem, do
 * ktorego ktokolwiek zaglada. Dokumenty zalozycielskie zyja dalej: to na ich
 * podstawie kancelaria prowadzi rejestr i to je pokazuje, gdy ktos pyta,
 * skad wzial sie pierwszy wpis. Kopiujemy PLIKI, nie tylko wiersze - akta
 * spolki maja przetrwac skasowanie wniosku.
 *
 * Zapisujemy oba egzemplarze kazdego dokumentu: 'wzor' (to, co wystawila
 * kancelaria) i 'podpisany' (to, co odeslal klient). Bez wzoru nie da sie
 * pozniej stwierdzic, pod czym dokladnie zlozono podpis.
 */
function przeniesDokumentyDoSpolki(wniosek, spolkaId, teraz) {
  const dokumenty = db()
    .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE wniosek_id = ? ORDER BY kolejnosc, id')
    .all(wniosek.id);
  if (dokumenty.length === 0) return 0;

  const katalog = path.join(konfiguracja.KATALOG_DOKUMENTOW, `spolka_${spolkaId}`, 'zalozycielskie');
  fs.mkdirSync(katalog, { recursive: true });

  const wstaw = db().prepare(
    `INSERT INTO psa_spolki_dokumenty
       (spolka_id, wniosek_id, typ, nazwa, nazwa_pliku, sciezka, mime, rozmiar, rola, utworzono)
     VALUES (@spolka_id, @wniosek_id, @typ, @nazwa, @nazwa_pliku, @sciezka, @mime,
             @rozmiar, @rola, @utworzono)`
  );

  let ile = 0;
  for (const d of dokumenty) {
    const egzemplarze = [
      { rola: 'wzor', sciezka: d.sciezka, nazwaPliku: d.nazwa_pliku, mime: d.mime, rozmiar: d.rozmiar },
      d.podpis_sciezka
        ? {
          rola: 'podpisany',
          sciezka: d.podpis_sciezka,
          nazwaPliku: d.podpis_nazwa_pliku,
          mime: d.podpis_mime,
          rozmiar: d.podpis_rozmiar,
        }
        : null,
    ].filter(Boolean);

    for (const e of egzemplarze) {
      const zrodlo = path.join(konfiguracja.KATALOG_DOKUMENTOW, e.sciezka);
      if (!zrodlo.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(zrodlo)) continue;
      const nazwaNaDysku = `${e.rola}-${path.basename(e.sciezka)}`;
      const cel = path.join(katalog, nazwaNaDysku);
      fs.copyFileSync(zrodlo, cel);
      wstaw.run({
        spolka_id: spolkaId,
        wniosek_id: wniosek.id,
        typ: d.typ,
        nazwa: d.nazwa,
        nazwa_pliku: e.nazwaPliku || d.nazwa_pliku,
        sciezka: path.relative(konfiguracja.KATALOG_DOKUMENTOW, cel),
        mime: e.mime || 'application/pdf',
        rozmiar: e.rozmiar,
        rola: e.rola,
        utworzono: teraz,
      });
      ile += 1;
    }
  }
  return ile;
}

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

    // Komplet do podpisu wraz z informacja, co juz wrocilo podpisane -
    // kancelaria widzi CALY komplet, takze pozycje jeszcze nieudostepnione
    // klientowi (portal klienta dostaje tylko udostepnione).
    const dokumenty = pakietWniosku.lista(wniosek.id);

    odp.json({ wniosek, akcjonariusze, krs, braki_ustawowe: braki, dokumenty });
  })
);

/** Wystawiony wzor albo odeslany skan — `?egzemplarz=podpisany` po ten drugi. */
router.get(
  '/:id/dokumenty/:dokId',
  asy((zad, odp) => {
    const dokument = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE id = ? AND wniosek_id = ?')
      .get(Number(zad.params.dokId), Number(zad.params.id));
    if (!dokument) throw nieZnaleziono('Nie odnaleziono dokumentu.');

    const podpisany = zad.query.egzemplarz === 'podpisany';
    if (podpisany && !dokument.podpis_sciezka) throw nieZnaleziono('Klient nie odesłał jeszcze tego dokumentu.');

    const sciezka = podpisany ? dokument.podpis_sciezka : dokument.sciezka;
    const nazwaPliku = podpisany ? dokument.podpis_nazwa_pliku : dokument.nazwa_pliku;

    const pelna = path.join(konfiguracja.KATALOG_DOKUMENTOW, sciezka);
    if (!pelna.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(pelna)) {
      throw nieZnaleziono('Plik nie jest już dostępny.');
    }
    // `?podglad=1` oddaje plik do WYSWIETLENIA w ramce. Kancelaria czyta
    // dokument, zanim go udostepni — pobieranie kazdej pozycji na dysk tylko
    // po to, zeby na nia spojrzec, zamienialoby przeglad w sprzatanie katalogu.
    // Typ ustala SERWER z rozszerzenia — `mime` w bazie pochodzi z naglowka
    // przegladarki klienta, wiec plik nazwany „skan.pdf" a wyslany jako
    // text/html wracal tu do pracownika jako wykonywalna strona.
    const wRamce = zad.query.podglad === '1';
    pliki.naglowkiPliku(odp, { nazwaPliku, wRamce });
    fs.createReadStream(pelna).pipe(odp);
  })
);

// ─────────────────────────────────────────────────────────────
// Komplet dokumentow do podpisu — wystawia go KANCELARIA
//
// Dawniej komplet powstawal sam, w chwili zlozenia wniosku przez klienta:
// bledne dane dawaly bledna umowe, ktora klient od razu dostawal do podpisu.
// Teraz sa trzy osobne, swiadome kroki: wystaw → sprawdz i popraw tresc →
// udostepnij klientowi. Dopiero ostatni wpuszcza dokumenty do portalu.
// ─────────────────────────────────────────────────────────────

/** Statusy, w ktorych komplet wolno wystawic albo wystawic ponownie. */
const STATUSY_WYSTAWIENIA = ['zlozony', 'do_uzupelnienia', 'umowa_wygenerowana', 'umowa_podpisana'];

router.post(
  '/:id/dokumenty/wystaw',
  asy(async (zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    if (!STATUSY_WYSTAWIENIA.includes(wniosek.status)) {
      throw bledneZadanie(
        `Wniosek ma status „${wniosek.status}” — komplet dokumentów wystawia się po jego złożeniu.`
      );
    }
    if (!wniosek.nazwa) throw bledneZadanie('Uzupełnij nazwę spółki, zanim wystawisz dokumenty.');
    const akcjonariusze = wczytajAkcjonariuszy(wniosek.id);
    if (akcjonariusze.length === 0) throw bledneZadanie('Wniosek nie ma żadnego akcjonariusza.');

    const { dokumenty } = await pakietWniosku.wystaw(wniosek, akcjonariusze);

    // Nowy komplet to nowa tresc — poprzednie skany dotyczyly czegos innego
    // i znikly razem z poprzednimi plikami, wiec wniosek wraca do stanu
    // sprzed udostepnienia. Klient zobaczy dokumenty dopiero po „Udostepnij".
    db()
      .prepare(
        `UPDATE psa_wnioski
            SET status = 'zlozony', umowa_podpisana_sciezka = NULL, umowa_podpisana_nazwa_pliku = NULL,
                umowa_podpisana_mime = NULL, umowa_podpisana_wgrano = NULL,
                obsluzone_przez = ?, obsluzone_kiedy = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(autor(zad), czas.terazIso(), czas.terazIso(), wniosek.id);

    odp.json({ wniosek: wczytajWniosek(wniosek.id), dokumenty });
  })
);

/** Tresc dokumentu do edytora — bloki, nie gotowy plik. */
router.get(
  '/:id/dokumenty/:dokId/tresc',
  asy((zad, odp) => {
    const wniosek = wczytajWniosek(Number(zad.params.id));
    if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
    const tresc = pakietWniosku.tresc(wniosek.id, Number(zad.params.dokId));
    if (!tresc) throw nieZnaleziono('Nie odnaleziono dokumentu.');
    odp.json({ dokument: tresc, rodzaje: blokiDokumentu.NAZWY_RODZAJOW });
  })
);

/**
 * Zapis poprawionej tresci. PDF sklada sie od nowa i podmienia plik
 * w miejscu — poprawiona wersja obowiazuje wszedzie: w portalu klienta,
 * w podgladzie kancelarii i w aktach spolki po przyjeciu wniosku.
 */
router.put(
  '/:id/dokumenty/:dokId/tresc',
  asy(async (zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    let zapisany;
    try {
      zapisany = await pakietWniosku.zapiszTresc(
        wniosek.id,
        Number(zad.params.dokId),
        (zad.body || {}).bloki,
        autor(zad)
      );
    } catch (e) {
      throw bledneZadanie(e.message);
    }
    if (!zapisany) throw nieZnaleziono('Nie odnaleziono dokumentu.');
    odp.json({ dokument: zapisany, dokumenty: pakietWniosku.lista(wniosek.id) });
  })
);

/**
 * Potwierdzenie, ze odeslany skan jest kompletny i prawidlowo podpisany.
 * `{ potwierdzono: false }` cofa potwierdzenie.
 */
router.post(
  '/:id/dokumenty/:dokId/podpis-potwierdz',
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    const potwierdzono = (zad.body || {}).potwierdzono !== false;
    const wynik = pakietWniosku.potwierdzPodpis(
      wniosek.id, Number(zad.params.dokId), potwierdzono, autor(zad)
    );
    if (wynik === null) throw nieZnaleziono('Nie odnaleziono dokumentu.');
    if (wynik === false) throw bledneZadanie('Klient nie odesłał jeszcze skanu tego dokumentu.');
    odp.json({ dokument: wynik, dokumenty: pakietWniosku.lista(wniosek.id) });
  })
);

/**
 * Udostepnienie kompletu klientowi: pozycje pojawiaja sie w portalu, wniosek
 * przechodzi w `umowa_wygenerowana`, a klient dostaje wiadomosc, ze dokumenty
 * czekaja na pobranie. Brak SMTP nie przewraca operacji — kancelaria widzi
 * powod i moze powiadomic klienta innym kanalem.
 */
router.post(
  '/:id/dokumenty/udostepnij',
  asy(async (zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    const dokumenty = pakietWniosku.lista(wniosek.id);
    if (dokumenty.length === 0) {
      throw bledneZadanie('Nie ma czego udostępnić — najpierw wystaw komplet dokumentów.');
    }

    const poUdostepnieniu = pakietWniosku.udostepnij(wniosek.id);
    const teraz = czas.terazIso();
    db()
      .prepare(
        `UPDATE psa_wnioski
            SET status = 'umowa_wygenerowana', obsluzone_przez = ?, obsluzone_kiedy = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(autor(zad), teraz, teraz, wniosek.id);

    const proba = await poczta.wyslij({
      do: wniosek.reprezentant_email || wniosek.konto_email,
      temat: `Dokumenty do podpisu — ${ustawienia.kancelaria(db()).nazwa}`,
      html: trescPowiadomieniaODokumentach({
        nazwaSpolki: wniosek.nazwa,
        ile: poUdostepnieniu.length,
        link: konfiguracja.URL_PORTALU,
        kancelariaNazwa: ustawienia.kancelaria(db()).nazwa,
      }),
    });

    odp.json({
      wniosek: wczytajWniosek(wniosek.id),
      dokumenty: poUdostepnieniu,
      email_wyslany: proba.wyslano,
      powod: proba.powod,
    });
  })
);

/**
 * Pobranie danych spolki z KRS WPROST DO WNIOSKU. Klient ma ten przycisk
 * w portalu od poczatku; kancelaria musiala dotad przepisywac dane recznie,
 * choc to ona odpowiada za ich zgodnosc z rejestrem przedsiebiorcow.
 *
 * Nadpisujemy wylacznie pola, ktore KRS faktycznie zwrocil — reszta zostaje
 * taka, jak podal klient.
 */
router.post(
  '/:id/z-krs',
  asy(async (zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    const numer = String((zad.body || {}).krs || wniosek.krs || '').replace(/\D/g, '');
    if (numer.length !== 10) {
      throw bledneZadanie('Numer KRS składa się z dziesięciu cyfr — uzupełnij go w danych spółki.');
    }
    const wynik = await pobierzZKrs(numer);
    if (!wynik.znaleziono) {
      return odp.json({ znaleziono: false, komunikat: wynik.komunikat, wniosek: wczytajWniosek(wniosek.id) });
    }

    const { sklad_organu: _sklad, ...reszta } = wynik.dane;
    const dane = portal.wyczyscWniosek(
      Object.fromEntries(Object.entries(reszta).filter(([, v]) => v !== null && v !== ''))
    );
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

    odp.json({
      znaleziono: true,
      ostrzezenia: wynik.ostrzezenia || [],
      pobrane: Object.keys(dane),
      wniosek: wczytajWniosek(wniosek.id),
    });
  })
);

/** Wiadomosc do klienta: komplet czeka w portalu. */
function trescPowiadomieniaODokumentach({ nazwaSpolki, ile, link, kancelariaNazwa }) {
  return `
    <p>Dzień dobry,</p>
    <p>
      dokumenty do podpisu w sprawie prowadzenia rejestru akcjonariuszy
      ${nazwaSpolki ? `spółki <strong>${nazwaSpolki}</strong>` : 'Państwa spółki'}
      są gotowe. Komplet liczy ${ile} ${ile === 1 ? 'dokument' : 'dokumentów'}.
    </p>
    <p>
      Pobierz je w portalu klienta, zbierz podpisy i odeślij skany w tym samym miejscu:
      <a href="${link}">${link}</a>
    </p>
    <p>${kancelariaNazwa}</p>
  `;
}

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
        `UPDATE psa_wnioski_akcjonariusze
            SET zweryfikowano = ?, osoba_id = ?, uwagi_kancelarii = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      // Zweryfikowanie pozycji zamyka uwage: to ona byla pytaniem, a to jest
      // odpowiedz. Cofniecie weryfikacji uwagi nie przywraca - gdyby byla
      // dalej aktualna, kancelaria odesle pozycje do poprawy jeszcze raz.
      .run(zweryfikowano, osobaId, zweryfikowano ? null : istniejacy.uwagi_kancelarii, czas.terazIso(), istniejacy.id);

    odp.json({ akcjonariusz: db().prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE id = ?').get(istniejacy.id) });
  })
);

/**
 * Odeslanie JEDNEJ pozycji akcjonariusza do poprawy.
 *
 * Notatka na caly wniosek nie wystarcza: przy pieciu akcjonariuszach zdanie
 * „popraw numer PESEL" nie mowi, przy kim. Uwaga siada wiec przy pozycji,
 * a wniosek wraca do edycji po stronie klienta - bo bez tego nie mialby jak
 * jej poprawic.
 */
router.post(
  '/:id/akcjonariusze/:akcId/do-poprawy',
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosek(Number(zad.params.id));
    const istniejacy = wczytajAkcjonariuszaWniosku(wniosek.id, Number(zad.params.akcId));
    if (!istniejacy) throw nieZnaleziono('Nie odnaleziono pozycji akcjonariusza.');

    const uwagi = String((zad.body || {}).uwagi || '').trim();
    if (!uwagi) throw bledneZadanie('Podaj, co klient ma poprawić przy tej pozycji.');

    const teraz = czas.terazIso();
    db()
      .prepare(
        `UPDATE psa_wnioski_akcjonariusze
            SET uwagi_kancelarii = ?, zweryfikowano = 0, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(uwagi, teraz, istniejacy.id);

    // Notatka na wniosku zbiera wszystkie otwarte uwagi — klient widzi ja nad
    // formularzem i wie, ile pozycji czeka na poprawke.
    const otwarte = db()
      .prepare(
        `SELECT nazwisko, imie, nazwa, typ, uwagi_kancelarii
           FROM psa_wnioski_akcjonariusze
          WHERE wniosek_id = ? AND uwagi_kancelarii IS NOT NULL
          ORDER BY kolejnosc, id`
      )
      .all(wniosek.id);
    const podsumowanie = otwarte
      .map((a) => {
        const kto = a.typ === 'prawna'
          ? (a.nazwa || 'podmiot bez nazwy')
          : [a.imie, a.nazwisko].filter(Boolean).join(' ') || 'osoba bez nazwiska';
        return `${kto}: ${a.uwagi_kancelarii}`;
      })
      .join('\n');

    db()
      .prepare(
        `UPDATE psa_wnioski
            SET status = 'do_uzupelnienia', notatka_weryfikacji = ?,
                obsluzone_przez = ?, obsluzone_kiedy = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(podsumowanie, autor(zad), teraz, teraz, wniosek.id);

    odp.json({
      wniosek: wczytajWniosek(wniosek.id),
      akcjonariusz: db().prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE id = ?').get(istniejacy.id),
    });
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

    // Podpis pod dokumentem musi byc SPRAWDZONY, nie tylko odeslany: sam fakt
    // wgrania pliku nie mowi, czy skan jest czytelny i czy podpisali go
    // wszyscy, ktorzy mieli. Przyjecie wniosku otwiera rejestr, wiec to
    // ostatni moment, w ktorym da sie to zauwazyc.
    const bezPotwierdzenia = pakietWniosku.bezPotwierdzonegoPodpisu(wniosek.id);
    if (bezPotwierdzenia.length > 0) {
      const brakSkanu = bezPotwierdzenia.filter((d) => !d.ma_skan).length;
      throw bledneZadanie(
        `${bezPotwierdzenia.length} dokumentów nie ma potwierdzonego podpisu`
        + (brakSkanu > 0 ? ` (w tym ${brakSkanu} bez odesłanego skanu)` : '')
        + '. Sprawdź je w zakładce „Dokumenty” i oznacz podpisy jako prawidłowe.'
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

    const przeniesione = przeniesDokumentyDoSpolki(wniosek, spolkaId, teraz);

    odp.json({
      wniosek: wczytajWniosek(wniosek.id),
      akcjonariusze: wczytajAkcjonariuszy(wniosek.id),
      spolka_id: spolkaId,
      konto_przepiete: przepiete,
      dokumenty_przeniesione: przeniesione,
    });
  })
);

module.exports = router;
