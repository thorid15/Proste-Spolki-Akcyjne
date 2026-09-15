'use strict';

/**
 * Trasy `/api/psa/portal/...` - portal klienta (sekcja 8 i 9 specyfikacji).
 *
 * Odstepstwo nr 1 z sekcji 2: to jedyna czesc modulu dostepna publicznie.
 * Tozsamosc = konto (`psa_konta`), sesja w osobnym ciasteczku
 * (`pomocnicze/autoryzacja.js`) - nigdy nie miesza sie z sesja pracownika.
 *
 * Swiadome zawezenie wobec opisu w sekcji 9 ("ten sam kreator, ale bez
 * kroku weryfikacji"): krok "co sie zmienia" (krok 3) korzysta w kancelarii
 * z wyszukiwarki calej wspolnej kartoteki `psa_osoby` (`WyborOsoby`) -
 * pokazujaca m.in. status AML innych klientow. Udostepnienie tego
 * wyszukiwania portalowi zdradzaloby dane innych klientow kancelarii, wiec
 * portal zbiera WYLACZNIE krok 1 (typ) i krok 2 (podstawa - opis, dokumenty)
 * i zaklada sprawe w stanie `nowa`; krok "co sie zmienia" i weryfikacje
 * wykonuje pracownik w kokpicie sprawy - dokladnie tak, jak dla zgloszen
 * przyjetych mailem czy papierowo.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const { db } = require('../baza');
const rejestr = require('../rejestr');
const widoki = require('../widoki');
const oplaty = require('../oplaty');
const maskowanie = require('../logika/maskowanie');
const przepisy = require('../logika/przepisy');
const akcjonariuszLogika = require('../logika/akcjonariusz');
const dokumentyWniosku = require('../logika/dokumenty-wniosku');
const pakietWniosku = require('../logika/pakiet-wniosku');
const typyZdarzen = require('../logika/typy-zdarzen');
const terminy = require('../logika/terminy');
const numery = require('../logika/numery');
const hasla = require('../logika/hasla');
const limiter = require('../logika/limiter');
const zapros = require('../logika/zaproszenia');
const dokumentyTresc = require('../logika/dokumenty-tresc');
const informacjaDokument = require('../logika/informacja-dokument');
const dziennikDostepu = require('../logika/dziennik-dostepu');
const konfiguracja = require('../konfiguracja');
const ustawienia = require('../logika/ustawienia');
const pliki = require('../pomocnicze/pliki');
const czas = require('../pomocnicze/czas');
const { asy, bledneZadanie, nieZnaleziono, nieAutoryzowany, brakUprawnien, BladZadania } = require('../pomocnicze/odpowiedzi');
const autoryzacja = require('../pomocnicze/autoryzacja');
const { pobierzZKrs } = require('./krs');

const router = express.Router();

const TYPY_DOKUMENTU = Object.values(przepisy.RODZAJE_DOKUMENTU);

function widokKonta(k) {
  if (!k) return null;
  return {
    id: k.id,
    email: k.email,
    rola: k.rola,
    spolka_id: k.spolka_id,
    osoba_id: k.osoba_id,
    ostatnie_logowanie: k.ostatnie_logowanie,
    // Etap 3B.1 - bramka przed formularzem wniosku (etap 3C), patrz POST /rodo.
    rodo_zaakceptowano: k.rodo_zaakceptowano,
  };
}

function znormalizujEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Spolki, ktore prowadzi konto roli „spolka". Zrodlem prawdy jest tabela
 * powiazan — jeden klient pod jednym adresem e-mail miewa kilka spolek,
 * a kolumna `psa_konta.spolka_id` niesie tylko te pierwsza.
 */
function spolkiKonta(konto) {
  const z = db()
    .prepare('SELECT spolka_id FROM psa_konta_spolki WHERE konto_id = ? ORDER BY spolka_id')
    .all(konto.id)
    .map((w) => w.spolka_id);
  // `psa_konta.spolka_id` zostaje w sumie zbioru: rola „spolka" wymaga tej
  // kolumny (CHECK w schemacie), wiec konto przepiete inna droga niz przez
  // przyjecie wniosku dalej dziala, nawet jesli nie ma wiersza w tabeli
  // powiazan.
  if (konto.spolka_id != null && !z.includes(Number(konto.spolka_id))) z.unshift(Number(konto.spolka_id));
  return z;
}

/** Czy konto ma dostep do rejestru/spraw wskazanej spolki. */
function maDostepDoSpolki(konto, spolkaId) {
  if (konto.rola === 'spolka') return spolkiKonta(konto).includes(Number(spolkaId));
  const wiersz = db()
    .prepare('SELECT 1 FROM psa_stan_akcji WHERE spolka_id = ? AND osoba_id = ? LIMIT 1')
    .get(Number(spolkaId), konto.osoba_id);
  return Boolean(wiersz);
}

function rolaOdbioru(konto) {
  return konto.rola === 'spolka' ? przepisy.ROLE_ODBIORCY.SPOLKA : przepisy.ROLE_ODBIORCY.AKCJONARIUSZ;
}

// ─────────────────────────────────────────────────────────────
// Logowanie
// ─────────────────────────────────────────────────────────────

router.post(
  '/login',
  asy(async (zad, odp) => {
    const email = znormalizujEmail((zad.body || {}).email);
    const haslo = String((zad.body || {}).haslo || '');
    if (!email || !haslo) throw bledneZadanie('Podaj e-mail i hasło.');

    limiter.sprawdz(zad.ip, `portal:${email}`);

    const konto = db().prepare('SELECT * FROM psa_konta WHERE lower(email) = ?').get(email);
    const pasuje = konto ? await hasla.zweryfikuj(haslo, konto.hash_hasla) : false;
    if (!konto || !konto.aktywne || !pasuje) {
      limiter.zanotujNieudana(zad.ip, `portal:${email}`);
      throw nieAutoryzowany('Nieprawidłowy e-mail lub hasło.');
    }

    limiter.wyczyscPoUdanej(zad.ip, `portal:${email}`);
    db().prepare('UPDATE psa_konta SET ostatnie_logowanie = ? WHERE id = ?').run(czas.terazIso(), konto.id);

    autoryzacja.zalogujKonto(zad, odp, konto.id);
    odp.json({ konto: widokKonta({ ...konto, ostatnie_logowanie: czas.terazIso() }) });
  })
);

router.post(
  '/logout',
  asy((zad, odp) => {
    autoryzacja.wylogujKonto(zad, odp);
    odp.json({ ok: true });
  })
);

router.get(
  '/whoami',
  asy((zad, odp) => {
    odp.json({ zalogowany: Boolean(zad.konto), konto: widokKonta(zad.konto) });
  })
);

// ─────────────────────────────────────────────────────────────
// Zgloszenie wstepne (etap 3A) - PUBLICZNE, bez zadnej sesji. Pierwszy
// kontakt nieznanego dotad klienta: wylacznie dane kontaktowe, zadnego
// PESEL ani adresu. Kancelaria decyduje, czy wyslac zaproszenie (etap 3B).
// ─────────────────────────────────────────────────────────────

const WZORZEC_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  '/zgloszenia',
  asy(async (zad, odp) => {
    const cialo = zad.body || {};
    const email = znormalizujEmail(cialo.email);
    if (!email || !WZORZEC_EMAIL.test(email)) {
      throw bledneZadanie('Podaj prawidłowy adres e-mail.');
    }

    // Rejestr akcjonariuszy prowadzi sie dla spolki JUZ wpisanej do rejestru
    // przedsiebiorcow (art. 300(30) § 1 KSH dotyczy spolki, ktora istnieje),
    // wiec numer KRS jest tu polem obowiazkowym - odsiewa zgloszenia spolek
    // w organizacji, ktore i tak trzeba by odeslac.
    const krs = String(cialo.krs || '').replace(/\D/g, '');
    if (krs.length !== 10) {
      throw bledneZadanie('Podaj numer KRS spółki — dziesięć cyfr. Rejestr akcjonariuszy prowadzi się dla spółki wpisanej już do rejestru przedsiębiorców.');
    }

    // Miekki, ogolny limit zapytan na adres IP - formularz jest publiczny
    // i niezalogowany, wiec to jedyna dostepna ochrona przed zalewem
    // (limiter.js liczy tu KAZDA probe, nie tylko nieudane logowanie).
    //
    // Prog jest WYZSZY niz przy logowaniu i liczony na adres e-mail, a nie
    // na samo IP: pieciu klientow z jednej sieci (biuro, wspolne lacze NAT)
    // wyczerpywalo wspolna pule i szosty dostawal odmowe — na formularzu,
    // ktorego wyslanie nie jest zadna „proba logowania".
    limiter.sprawdz(zad.ip, `zgloszenie:${email}`, {
      limit: 3,
      komunikat: 'Zgłoszenie z tego adresu e-mail zostało już przyjęte. '
        + 'Jeśli to pomyłka, spróbuj ponownie za %MIN% min albo napisz do kancelarii.',
    });
    limiter.zanotujNieudana(zad.ip, `zgloszenie:${email}`);

    // Duplikat rozpoznajemy po NUMERZE KRS, nie po adresie e-mail: jeden
    // klient pod jednym adresem miewa kilka spolek i zgloszenie drugiej
    // jest normalna sytuacja, nie pomylka.
    const juzProwadzona = db().prepare('SELECT id, nazwa FROM psa_spolki WHERE krs = ?').get(krs);
    if (juzProwadzona) {
      throw bledneZadanie(
        `Rejestr dla spółki o numerze KRS ${krs} jest już prowadzony przez kancelarię. `
        + 'Zaloguj się do portalu albo napisz do nas, jeśli potrzebujesz dostępu.'
      );
    }
    const wToku = db()
      .prepare(
        `SELECT id FROM psa_wnioski WHERE krs = ? AND status NOT IN ('przyjety','odrzucony') LIMIT 1`
      )
      .get(krs);
    const zgloszoneWczesniej = db()
      .prepare(`SELECT id FROM psa_zgloszenia WHERE krs = ? AND status <> 'odrzucone' LIMIT 1`)
      .get(krs);
    if (wToku || zgloszoneWczesniej) {
      throw bledneZadanie(
        `Zgłoszenie dla spółki o numerze KRS ${krs} jest już w toku. `
        + 'Sprawdź skrzynkę — zaproszenie do portalu poszło na wskazany wcześniej adres.'
      );
    }

    // Rejestru akcjonariuszy nie prowadzi sie dla kazdej spolki — art. 300(30)
    // § 1 KSH dotyczy PROSTEJ spolki akcyjnej. Sprawdzamy to od razu, zamiast
    // odsylac klienta po tygodniu: numer albo dotyczy P.S.A., albo nie ma po
    // co isc dalej.
    // Awaria lacza albo blad API KRS nie moze zamykac drogi klientowi —
    // zgloszenie wtedy przechodzi, a forme prawna sprawdzi pracownik przy
    // weryfikacji wniosku. Odmawiamy WYLACZNIE wtedy, gdy KRS odpowiedzial
    // i powiedzial „takiej spolki nie ma" albo „to nie jest P.S.A.".
    let zKrs = null;
    try {
      zKrs = await pobierzZKrs(krs);
    } catch {
      zKrs = null;
    }
    if (zKrs && !zKrs.znaleziono && zKrs.powod === 'nie_znaleziono') {
      throw bledneZadanie(
        `W Krajowym Rejestrze Sądowym nie ma spółki o numerze ${krs}. Sprawdź numer.`
      );
    }
    if (zKrs && zKrs.znaleziono && zKrs.dopuszczalna === false) {
      throw bledneZadanie(
        `${zKrs.komunikat} Rejestr akcjonariuszy prowadzimy wyłącznie dla prostych spółek akcyjnych.`
      );
    }
    const daneKrs = zKrs && zKrs.znaleziono ? zKrs.dane : null;
    const formaPrawna = daneKrs ? daneKrs.forma_prawna : null;
    const nazwaZKrs = daneKrs ? daneKrs.nazwa : null;

    const dane = {
      email,
      krs,
      telefon: String(cialo.telefon || '').trim() || null,
      nazwa_spolki: String(cialo.nazwa_spolki || '').trim() || nazwaZKrs,
      opis: String(cialo.opis || '').trim() || null,
      status: 'nowe',
      utworzono: czas.terazIso(),
    };

    const kolumny = Object.keys(dane);
    const wynikZgloszenia = db()
      .prepare(`INSERT INTO psa_zgloszenia (${kolumny.join(', ')}) VALUES (${kolumny.map((k) => `@${k}`).join(', ')})`)
      .run(dane);

    // Zaproszenie idzie OD RAZU. Na tym etapie kancelaria niczego jeszcze nie
    // sprawdza — sprawdza dopiero wniosek — a kazdy dzien zwloki miedzy
    // zgloszeniem a dostepem do formularza to dzien, w ktorym klient czeka
    // bez powodu. Kolejka „Zgloszenia" zostaje jako slad, nie jako bramka.
    const zaproszenie = await zapros.wyslij(db(), {
      zgloszenieId: Number(wynikZgloszenia.lastInsertRowid),
      email,
      autor: 'Portal — zgłoszenie',
    });

    odp.status(201).json({
      ok: true,
      forma_prawna: formaPrawna,
      zaproszenie_wyslane: zaproszenie.email_wyslany,
      // Gdy poczta nie dziala, link wraca TYLKO przy zgloszeniu skladanym
      // z tego samego urzadzenia — inaczej klient zostaje bez drogi dalej.
      link_aktywacyjny: zaproszenie.link_aktywacyjny,
    });
  })
);

// ─────────────────────────────────────────────────────────────
// Aktywacja konta (etap 3B) - PUBLICZNE, bez sesji. Kancelaria zaklada
// konto (rola 'wnioskodawca', aktywne=0) po zaakceptowaniu zgloszenia
// (`server/trasy/zgloszenia.js: POST /:id/zapros`) i wysyla token mailem -
// klient go tu wymienia na haslo i od razu ma otwarta sesje portalowa.
// ─────────────────────────────────────────────────────────────

function znajdzKontoDoAktywacji(token) {
  const konto = db().prepare('SELECT * FROM psa_konta WHERE token_aktywacji = ?').get(String(token || ''));
  if (!konto || konto.aktywne || !konto.token_wygasa || new Date(konto.token_wygasa) < new Date()) {
    return null;
  }
  return konto;
}

router.get(
  '/aktywacja/:token',
  asy((zad, odp) => {
    const konto = znajdzKontoDoAktywacji(zad.params.token);
    if (!konto) throw nieZnaleziono('Link aktywacyjny jest nieprawidłowy albo wygasł.');
    odp.json({ email: konto.email });
  })
);

router.post(
  '/aktywacja/:token',
  asy(async (zad, odp) => {
    const konto = znajdzKontoDoAktywacji(zad.params.token);
    if (!konto) throw nieZnaleziono('Link aktywacyjny jest nieprawidłowy albo wygasł.');

    const haslo = String((zad.body || {}).haslo || '');
    const ocena = hasla.ocenSile(haslo);
    if (!ocena.ok) throw bledneZadanie(ocena.powod);

    const hash = await hasla.hashuj(haslo);
    db()
      .prepare(
        `UPDATE psa_konta
            SET hash_hasla = ?, aktywne = 1, token_aktywacji = NULL, token_wygasa = NULL,
                ostatnie_logowanie = ?
          WHERE id = ?`
      )
      .run(hash, czas.terazIso(), konto.id);

    autoryzacja.zalogujKonto(zad, odp, konto.id);
    odp.json({ konto: widokKonta({ ...konto, aktywne: 1 }) });
  })
);

// Od tego miejsca kazda trasa wymaga zalogowanego konta portalowego.
router.use(autoryzacja.wymagajKonta);

/**
 * Izolacja miedzy klientami portalu, DOMYSLNIE ODMAWIAJACA (blok D3, sesja
 * 8) - dziala na KAZDYM zadaniu niosacym identyfikator spolki, nie tylko na
 * trasach ktore dzis o nim wiedza. Dwa miejsca, w ktorych spolka wchodzi do
 * zadania, dwa mechanizmy:
 *
 * — `:spolkaId` w sciezce -> `router.param()`. Express wywoluje ten callback
 *   dla KAZDEJ trasy majacej taki parametr, obecnej i przyszlej - w
 *   odroznieniu od `router.use()` (ktory NIE widzi parametrow sciezki
 *   nalezacych do innych warstw, sprawdzone eksperymentalnie), to jedyny
 *   sposob na dopasowanie po nazwie parametru niezaleznie od trasy.
 * — `spolka_id` w ciele zadania -> zwykly `router.use()`, bo cialo JEST
 *   widoczne w kazdej warstwie (parsowane wczesniej, globalnie w serwer.js).
 *
 * Oba razem: nowa trasa przyjmujaca `spolka_id` (w ktorejkolwiek postaci)
 * dostaje ochrone automatycznie, bez wzgledu na to, czy jej autor o niej
 * pomyslal. 404, nie 403 - tak jak dotychczasowe punktowe sprawdzenia, zeby
 * nie zdradzac samego istnienia cudzej spolki.
 *
 * Odwolania POSREDNIE (np. przez sprawa_id, ktora nalezy do spolki) zadnej
 * z tych bramek nie widza - dla nich jest `wczytajSpraweDlaKonta` nizej:
 * jedyny sposob, w jaki trasa portalu w ogole dostaje sprawe do reki.
 */
router.param('spolkaId', (zad, odp, dalej, wartosc) => {
  const spolkaId = Number(wartosc);
  if (!Number.isInteger(spolkaId) || !maDostepDoSpolki(zad.konto, spolkaId)) {
    return dalej(nieZnaleziono('Nie odnaleziono spółki.'));
  }
  dalej();
});

function wymagajDostepuDoSpolkiWCiele(zad, odp, dalej) {
  const kandydat = zad.body && zad.body.spolka_id;
  if (kandydat == null) return dalej();
  const spolkaId = Number(kandydat);
  if (!Number.isInteger(spolkaId) || !maDostepDoSpolki(zad.konto, spolkaId)) {
    return dalej(nieZnaleziono('Nie odnaleziono spółki.'));
  }
  dalej();
}
router.use(wymagajDostepuDoSpolkiWCiele);

// ─────────────────────────────────────────────────────────────
// Klauzula informacyjna RODO (etap 3B.1) - potwierdzenie zapoznania sie,
// jednorazowe na konto. Bramkuje formularz wniosku (etap 3C) po stronie
// frontu; ten endpoint tylko zapisuje znacznik czasu.
// ─────────────────────────────────────────────────────────────

router.post(
  '/rodo',
  asy((zad, odp) => {
    db()
      .prepare('UPDATE psa_konta SET rodo_zaakceptowano = ? WHERE id = ?')
      .run(czas.terazIso(), zad.konto.id);
    odp.json({ konto: widokKonta({ ...zad.konto, rodo_zaakceptowano: czas.terazIso() }) });
  })
);

// ─────────────────────────────────────────────────────────────
// Wniosek o prowadzenie rejestru (etap 3C) - dane spolki i reprezentanta,
// zbierane PRZED istnieniem spolki w systemie (psa_spolki powstaje dopiero,
// gdy kancelaria przyjmie wniosek - etap 3F). Wylacznie rola 'wnioskodawca' -
// inne role maja juz prawdziwa spolke/akcje, nie wniosek do wypelnienia.
// ─────────────────────────────────────────────────────────────

const POLA_WNIOSKU = [
  'krs', 'nip', 'regon', 'nazwa', 'forma_prawna', 'kraj', 'kod_pocztowy', 'miejscowosc',
  'ulica', 'nr_domu', 'nr_lokalu', 'sad_rejestrowy', 'wydzial',
  'telefon', 'email', 'www', 'organ_rodzaj', 'data_utworzenia_spolki',
  'adres_edorecze', 'kapital_akcyjny_grosze', 'data_zawarcia_umowy_spolki',
  'reprezentant_imie_nazwisko', 'reprezentant_funkcja', 'reprezentant_reprezentacja',
  'reprezentant_rodzice', 'reprezentant_dowod', 'reprezentant_pesel', 'reprezentant_adres',
  'reprezentant_email',
];

function wyczyscWniosek(cialo) {
  const wynik = {};
  for (const pole of POLA_WNIOSKU) {
    if (cialo[pole] === undefined) continue;
    const v = cialo[pole];
    wynik[pole] = v === '' || v === null ? null : String(v).trim();
  }
  return wynik;
}

/**
 * Walidacja WNIOSKU jest celowo luzniejsza niz `spolki.js: sprawdzDaneSpolki`
 * (regula domenowa "miekkie ostrzezenia przy wprowadzaniu, twarde blokady
 * dopiero przy operacji rejestrowej") - klient zapisuje czesciowy postep
 * wielokrotnie w trakcie wypelniania, wiec sprawdzamy wylacznie FORMAT juz
 * podanych wartosci, nigdy kompletnosc. Kompletnosc sprawdza sie dopiero
 * przy zlozeniu wniosku (etap 3D/3E).
 */
function sprawdzDaneWniosku(dane) {
  if (dane.krs && !/^\d{10}$/.test(dane.krs)) {
    throw bledneZadanie('Numer KRS składa się z 10 cyfr.');
  }
  if (dane.nip && !/^\d{10}$/.test(String(dane.nip).replace(/[\s-]/g, ''))) {
    throw bledneZadanie('NIP składa się z 10 cyfr.');
  }
  for (const pole of ['data_utworzenia_spolki', 'data_zawarcia_umowy_spolki']) {
    if (dane[pole] && !czas.poprawnaData(dane[pole])) {
      throw bledneZadanie(`Pole „${pole}” musi być datą w formacie RRRR-MM-DD.`);
    }
  }
}

function wymagajWnioskodawcy(zad, odp, dalej) {
  if (zad.konto.rola !== 'wnioskodawca') {
    return dalej(brakUprawnien('Ta operacja jest dostępna wyłącznie dla wniosków o prowadzenie rejestru.'));
  }
  dalej();
}

/** Wczytuje wniosek biezacego konta, zakladajac pusty przy pierwszym uzyciu. */
function wczytajLubZalozWniosek(kontoId) {
  let wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(kontoId);
  if (!wniosek) {
    const wynik = db()
      .prepare('INSERT INTO psa_wnioski (konto_id, utworzono) VALUES (?, ?)')
      .run(kontoId, czas.terazIso());
    wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(wynik.lastInsertRowid);
  }
  return wniosek;
}

router.get(
  '/wniosek',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    odp.json({ wniosek: wczytajLubZalozWniosek(zad.konto.id) });
  })
);

router.put(
  '/wniosek',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const biezacy = wczytajLubZalozWniosek(zad.konto.id);
    if (!['w_przygotowaniu', 'do_uzupelnienia'].includes(biezacy.status)) {
      throw bledneZadanie(`Wniosek ma status „${biezacy.status}” — nie można go już edytować.`);
    }
    const dane = wyczyscWniosek(zad.body || {});
    sprawdzDaneWniosku(dane);
    if (Object.keys(dane).length > 0) {
      db()
        .prepare(
          `UPDATE psa_wnioski
              SET ${Object.keys(dane).map((k) => `${k} = @${k}`).join(', ')}, zaktualizowano = @zaktualizowano
            WHERE id = @id`
        )
        .run({ ...dane, zaktualizowano: czas.terazIso(), id: biezacy.id });
    }
    odp.json({ wniosek: db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(biezacy.id) });
  })
);

/** Pobranie danych z otwartego API KRS - lustro server/trasy/spolki.js: GET /z-krs/:numer. */
router.get(
  '/wniosek/z-krs/:numer',
  wymagajWnioskodawcy,
  asy(async (zad, odp) => {
    const numer = String(zad.params.numer || '').replace(/\D/g, '');
    if (numer.length !== 10) {
      return odp.json({
        znaleziono: false,
        komunikat: 'Numer KRS składa się z 10 cyfr. Uzupełnij dane ręcznie.',
      });
    }
    const wynik = await pobierzZKrs(numer);
    odp.json(wynik);
  })
);

// ─────────────────────────────────────────────────────────────
// Akcjonariusze proponowani we wniosku (etap 3D) - dane do PRZYSZLEJ
// kartoteki, nie sama kartoteka (patrz komentarz przy migracji 25).
// ─────────────────────────────────────────────────────────────

const POLA_AKCJONARIUSZA_WNIOSKU = [
  'typ', 'nazwisko', 'imie', 'nazwa', 'pesel', 'data_urodzenia', 'plec',
  'nip', 'regon', 'numer_w_rejestrze', 'nazwa_rejestru',
  'kod_pocztowy', 'miejscowosc', 'ulica', 'nr_domu', 'nr_lokalu',
  'adres_doreczen', 'adres_edoreczen', 'email', 'telefon', 'zgoda_email',
  // Art. 300(33) § 1 pkt 2-5 KSH - patrz logika/akcjonariusz.js.
  ...akcjonariuszLogika.POLA_USTAWOWE,
];

function wyczyscAkcjonariuszaWniosku(cialo) {
  const wynik = {};
  for (const pole of POLA_AKCJONARIUSZA_WNIOSKU) {
    if (cialo[pole] === undefined) continue;
    if (pole === 'zgoda_email' || pole === 'bez_pesel') {
      wynik[pole] = cialo[pole] ? 1 : 0;
      continue;
    }
    const v = cialo[pole];
    wynik[pole] = v === '' || v === null ? null : String(v).trim();
  }
  return akcjonariuszLogika.znormalizuj(wynik);
}

function sprawdzAkcjonariuszaWniosku(dane) {
  if (dane.typ && !['fizyczna', 'prawna'].includes(dane.typ)) {
    throw bledneZadanie('Typ musi być „fizyczna” albo „prawna”.');
  }
  if (dane.pesel && !/^\d{11}$/.test(dane.pesel)) {
    throw bledneZadanie('PESEL składa się z 11 cyfr.');
  }
  if (dane.data_urodzenia && !czas.poprawnaData(dane.data_urodzenia)) {
    throw bledneZadanie('Data urodzenia musi mieć format RRRR-MM-DD.');
  }
  if (dane.plec && !['mezczyzna', 'kobieta'].includes(dane.plec)) {
    throw bledneZadanie('Płeć musi być „mężczyzna” albo „kobieta”.');
  }
  // Sprzecznosci ustawowe blokuja zapis; niekompletnosc NIE - wniosek
  // wypelnia sie etapami i zapisuje po kazdej zmianie.
  const bledy = akcjonariuszLogika.bledy(dane);
  if (bledy.length > 0) throw bledneZadanie(bledy.join(' '));
}

/**
 * Wymaga ISTNIEJACEGO, edytowalnego wniosku - dla mutacji akcjonariuszy
 * (POST/PUT/DELETE). W odroznieniu od `wczytajLubZalozWniosek` (uzywanego
 * przez GET/PUT samego wniosku) NIE zaklada wniosku - musi juz istniec,
 * bo tylko wtedy ma sens dopisywac do niego akcjonariuszy.
 */
function wymagajWniosku(zad, odp, dalej) {
  const wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(zad.konto.id);
  if (!wniosek) return dalej(nieZnaleziono('Najpierw otwórz formularz wniosku (krok „Spółka i umowa”), żeby go założyć.'));
  if (!['w_przygotowaniu', 'do_uzupelnienia'].includes(wniosek.status)) {
    return dalej(bledneZadanie(`Wniosek ma już status „${wniosek.status}” — nie można go edytować.`));
  }
  zad.psaWniosek = wniosek;
  dalej();
}

function wczytajAkcjonariuszaWniosku(wniosekId, id) {
  const wiersz = db().prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE id = ?').get(id);
  if (!wiersz || Number(wiersz.wniosek_id) !== Number(wniosekId)) return null;
  return wiersz;
}

router.get(
  '/wniosek/akcjonariusze',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(zad.konto.id);
    if (!wniosek) return odp.json({ akcjonariusze: [] });
    const wiersze = db()
      .prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE wniosek_id = ? ORDER BY kolejnosc, id')
      .all(wniosek.id);
    odp.json({ akcjonariusze: wiersze });
  })
);

router.post(
  '/wniosek/akcjonariusze',
  wymagajWnioskodawcy,
  wymagajWniosku,
  asy((zad, odp) => {
    const dane = wyczyscAkcjonariuszaWniosku(zad.body || {});
    sprawdzAkcjonariuszaWniosku(dane);
    const maks = db()
      .prepare('SELECT COALESCE(MAX(kolejnosc), -1) AS m FROM psa_wnioski_akcjonariusze WHERE wniosek_id = ?')
      .get(zad.psaWniosek.id).m;
    const kolumny = Object.keys(dane);
    const wynik = db()
      .prepare(
        `INSERT INTO psa_wnioski_akcjonariusze (wniosek_id, kolejnosc${kolumny.length ? ', ' + kolumny.join(', ') : ''}, utworzono)
         VALUES (@wniosek_id, @kolejnosc${kolumny.length ? ', ' + kolumny.map((k) => `@${k}`).join(', ') : ''}, @utworzono)`
      )
      .run({ ...dane, wniosek_id: zad.psaWniosek.id, kolejnosc: maks + 1, utworzono: czas.terazIso() });
    odp.status(201).json({
      akcjonariusz: db().prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE id = ?').get(wynik.lastInsertRowid),
    });
  })
);

router.put(
  '/wniosek/akcjonariusze/:id',
  wymagajWnioskodawcy,
  wymagajWniosku,
  asy((zad, odp) => {
    const istniejacy = wczytajAkcjonariuszaWniosku(zad.psaWniosek.id, Number(zad.params.id));
    if (!istniejacy) throw nieZnaleziono('Nie odnaleziono pozycji akcjonariusza.');
    const dane = wyczyscAkcjonariuszaWniosku(zad.body || {});
    sprawdzAkcjonariuszaWniosku(dane);
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
  '/wniosek/akcjonariusze/:id',
  wymagajWnioskodawcy,
  wymagajWniosku,
  asy((zad, odp) => {
    const istniejacy = wczytajAkcjonariuszaWniosku(zad.psaWniosek.id, Number(zad.params.id));
    if (!istniejacy) throw nieZnaleziono('Nie odnaleziono pozycji akcjonariusza.');
    db().prepare('DELETE FROM psa_wnioski_akcjonariusze WHERE id = ?').run(istniejacy.id);
    odp.json({ ok: true });
  })
);

// ─────────────────────────────────────────────────────────────
// Zlozenie wniosku, komplet do podpisu, odeslanie podpisanych skanow
// ─────────────────────────────────────────────────────────────

function katalogWnioskuDokumenty(wniosekId) {
  return pakietWniosku.katalogWniosku(wniosekId);
}

/**
 * Zlozenie wniosku ZAMYKA EDYCJE i na tym koniec (status -> zlozony).
 *
 * Dokumentow tu juz NIE MA. Powstawaly dawniej w tej samej chwili, prosto
 * z danych, ktore klient wlasnie wpisal - wiec literowka w nazwie spolki
 * albo blad w PESEL-u szly wprost do umowy, a klient dostawal ja do podpisu,
 * zanim ktokolwiek z kancelarii na nia spojrzal. Komplet wystawia teraz
 * kancelaria po weryfikacji danych (`server/trasy/wnioski.js`), a klient
 * dostaje o tym wiadomosc.
 *
 * Kompletnosc danych NIE jest tu twardo blokowana (regula ogolna nr 3 -
 * miekkie ostrzezenia przy wprowadzaniu, twarde blokady dopiero przy
 * faktycznej operacji rejestrowej) - poza dwoma minimalnymi warunkami
 * SENSOWNOSCI zlozenia (nazwa i choc jeden akcjonariusz), ktore sa
 * organizacyjne, nie merytoryczno-prawne.
 */
router.post(
  '/wniosek/zloz',
  wymagajWnioskodawcy,
  wymagajWniosku,
  asy((zad, odp) => {
    const wniosek = zad.psaWniosek;
    if (!wniosek.nazwa) throw bledneZadanie('Uzupełnij nazwę spółki (krok „Spółka”), zanim złożysz wniosek.');
    const akcjonariusze = db()
      .prepare('SELECT * FROM psa_wnioski_akcjonariusze WHERE wniosek_id = ? ORDER BY kolejnosc, id')
      .all(wniosek.id);
    if (akcjonariusze.length === 0) {
      throw bledneZadanie('Dodaj przynajmniej jednego akcjonariusza (krok „Akcjonariusze”), zanim złożysz wniosek.');
    }

    const teraz = czas.terazIso();
    db().prepare('UPDATE psa_wnioski SET status = ?, zaktualizowano = ? WHERE id = ?').run('zlozony', teraz, wniosek.id);

    // Braki wobec art. 300(33) § 1 KSH liczymy na KOMPLETNYM wierszu, przy
    // skladaniu - nie przy kazdym zapisie. Nie blokuja zlozenia: kancelaria
    // i tak weryfikuje wniosek, a czesci danych (np. potwierdzonej zgody
    // akcjonariusza na e-mail) z natury nie da sie miec wczesniej.
    const brakiAkcjonariuszy = akcjonariusze.flatMap((a) => akcjonariuszLogika.ostrzezenia(a));

    odp.json({
      wniosek: db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(wniosek.id),
      braki_akcjonariuszy: brakiAkcjonariuszy,
      dokumenty: wczytajDokumentyWniosku(wniosek.id),
    });
  })
);

/**
 * Komplet widoczny dla KLIENTA to wylacznie pozycje udostepnione przez
 * kancelarie - dokumenty wystawione, ale jeszcze niesprawdzone, zostaja po
 * stronie kancelarii (`logika/pakiet-wniosku.js`).
 */
function wczytajDokumentyWniosku(wniosekId) {
  return pakietWniosku.lista(wniosekId, { tylkoUdostepnione: true });
}

/**
 * Odsyla plik z katalogu dokumentow. Sprawdzenie przedrostka sciezki
 * zostaje przy KAZDYM pobraniu: sciezka idzie z bazy, ale to nadal jest
 * skladanie sciezki z danych - jedno miejsce, w ktorym to pilnujemy.
 */
function wyslijPlikDokumentu(odp, sciezkaWzgledna, nazwaPliku) {
  const pelna = path.join(konfiguracja.KATALOG_DOKUMENTOW, sciezkaWzgledna);
  if (!pelna.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(pelna)) {
    throw nieZnaleziono('Plik nie jest już dostępny.');
  }
  pliki.naglowkiPliku(odp, { nazwaPliku, wRamce: false });
  fs.createReadStream(pelna).pipe(odp);
}

/** Komplet dokumentow do podpisu — od etapu 13 razem z umowa. */
router.get(
  '/wniosek/dokumenty',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(zad.konto.id);
    if (!wniosek) return odp.json({ dokumenty: [] });
    odp.json({ dokumenty: wczytajDokumentyWniosku(wniosek.id) });
  })
);

router.get(
  '/wniosek/dokumenty/:id',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(zad.konto.id);
    if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
    const dokument = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE id = ? AND wniosek_id = ? AND udostepniono IS NOT NULL')
      .get(Number(zad.params.id), wniosek.id);
    if (!dokument) throw nieZnaleziono('Nie odnaleziono dokumentu.');
    wyslijPlikDokumentu(odp, dokument.sciezka, dokument.nazwa_pliku);
  })
);

router.get(
  '/wniosek/umowa-projekt',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(zad.konto.id);
    if (!wniosek || !wniosek.umowa_projekt_sciezka) throw nieZnaleziono('Projekt umowy nie został jeszcze wygenerowany.');

    const pelnaSciezka = path.join(konfiguracja.KATALOG_DOKUMENTOW, wniosek.umowa_projekt_sciezka);
    if (!pelnaSciezka.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(pelnaSciezka)) {
      throw nieZnaleziono('Plik nie jest już dostępny.');
    }

    const nazwaPliku = [
      'Umowa o prowadzenie rejestru',
      wniosek.krs ? `KRS ${wniosek.krs}` : null,
    ].filter(Boolean).join(' — ').replace(/[\\/:*?"<>|]/g, '-');

    odp.setHeader('Content-Type', 'application/pdf');
    odp.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(`${nazwaPliku}.pdf`)}`
    );
    fs.createReadStream(pelnaSciezka).pipe(odp);
  })
);

const ROZSZERZENIA_PODPISU_DOZWOLONE = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
const LIMIT_ROZMIARU_PODPISU_BAJTY = 20 * 1024 * 1024;

const uploadPodpisanego = multer({
  storage: multer.diskStorage({
    destination(zad, plik, wywolaj) {
      const katalog = path.join(katalogWnioskuDokumenty(zad.psaWniosek.id), 'podpisane');
      fs.mkdirSync(katalog, { recursive: true });
      wywolaj(null, katalog);
    },
    filename(zad, plik, wywolaj) {
      const bezpiecznaNazwa = path.basename(plik.originalname).replace(/[^\w.\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu, '_');
      wywolaj(null, `${crypto.randomUUID()}-${bezpiecznaNazwa}`);
    },
  }),
  limits: { fileSize: LIMIT_ROZMIARU_PODPISU_BAJTY, files: 1 },
  fileFilter(zad, plik, wywolaj) {
    const rozszerzenie = path.extname(plik.originalname).toLowerCase();
    if (!ROZSZERZENIA_PODPISU_DOZWOLONE.has(rozszerzenie)) {
      return wywolaj(
        new Error(`Niedozwolone rozszerzenie pliku: „${rozszerzenie}”. Dozwolone: PDF albo skan/zdjęcie (JPG, PNG).`)
      );
    }
    wywolaj(null, true);
  },
});

/**
 * Przyjecie skanu: multer + kontrola SYGNATURY tresci.
 *
 * Rozszerzenie w nazwie pliku jest obietnica klienta, a `plik.mimetype`
 * przepisanym naglowkiem jego przegladarki — ani jedno, ani drugie nie mowi,
 * co jest w srodku. Plik „skan.pdf" o tresci HTML wracal do pracownika jako
 * strona wyswietlana w ramce, czyli ze skryptem dzialajacym w sesji
 * kancelarii. Sprawdzenie stoi TUTAJ, a nie w trasach, zeby nowa trasa
 * przyjmujaca skan nie mogla go pominac.
 */
function przyjmijSkan(zad, odp, dalej) {
  uploadPodpisanego.single('plik')(zad, odp, (e) => {
    if (e) return dalej(bledneZadanie(e.message));
    if (zad.file && !pliki.trescPasuje(zad.file.path, pliki.typZNazwy(zad.file.originalname))) {
      fs.rmSync(zad.file.path, { force: true });
      return dalej(bledneZadanie(
        'Treść pliku nie odpowiada jego rozszerzeniu. Prześlij skan jako PDF, JPG albo PNG.'
      ));
    }
    return dalej();
  });
}

/**
 * Stany, w ktorych klient moze jeszcze odsylac podpisane skany. Po przyjeciu
 * albo odrzuceniu wniosku komplet jest zamkniety; przed wygenerowaniem
 * dokumentow nie ma czego odsylac.
 */
const STATUSY_PRZYJMUJACE_PODPISY = new Set(['umowa_wygenerowana', 'umowa_podpisana']);

/** Wstrzykuje wniosek do `zad` PRZED multerem - potrzebny do wyznaczenia katalogu docelowego. */
function zaladujWlasnyWniosekDoUploadu(zad, odp, dalej) {
  const wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(zad.konto.id);
  if (!wniosek) return dalej(nieZnaleziono('Najpierw złóż wniosek.'));
  if (!STATUSY_PRZYJMUJACE_PODPISY.has(wniosek.status)) {
    return dalej(bledneZadanie(`Wniosek ma status „${wniosek.status}” — w tym momencie nie oczekujemy podpisanych dokumentów.`));
  }
  zad.psaWniosek = wniosek;
  dalej();
}

/**
 * Zapisuje podpisany skan przy KONKRETNYM wygenerowanym dokumencie.
 *
 * Umowa jest jednym z tych dokumentow, ale niesie dodatkowo STAN calego
 * wniosku (`umowa_wygenerowana` -> `umowa_podpisana`) - to ona jest umowa
 * o prowadzenie rejestru, bez ktorej nie ma czego przyjmowac. Dlatego przy
 * niej, i tylko przy niej, aktualizujemy tez kolumny `umowa_podpisana_*`
 * i status: reszta trasy portalu i kancelarii czyta stan wlasnie stamtad.
 */
function zapiszPodpisanySkan(wniosek, dokument, plik) {
  const teraz = czas.terazIso();
  const sciezka = path.relative(konfiguracja.KATALOG_DOKUMENTOW, plik.path);

  // Poprzedni skan tego samego dokumentu przestaje byc potrzebny - zostalby
  // na dysku jako plik, do ktorego nic juz nie prowadzi.
  if (dokument.podpis_sciezka) {
    const stary = path.join(konfiguracja.KATALOG_DOKUMENTOW, dokument.podpis_sciezka);
    if (stary.startsWith(konfiguracja.KATALOG_DOKUMENTOW)) fs.rmSync(stary, { force: true });
  }

  db()
    .prepare(
      `UPDATE psa_wnioski_dokumenty
          SET podpis_sciezka = ?, podpis_nazwa_pliku = ?, podpis_mime = ?,
              podpis_rozmiar = ?, podpis_wgrano = ?
        WHERE id = ?`
    )
    .run(sciezka, plik.originalname, plik.mimetype, plik.size, teraz, dokument.id);

  if (dokument.typ === dokumentyWniosku.TYPY.UMOWA_REJESTRU) {
    db()
      .prepare(
        `UPDATE psa_wnioski
            SET status = 'umowa_podpisana', umowa_podpisana_sciezka = ?, umowa_podpisana_nazwa_pliku = ?,
                umowa_podpisana_mime = ?, umowa_podpisana_wgrano = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(sciezka, plik.originalname, plik.mimetype, teraz, teraz, wniosek.id);
  }
}

/**
 * Skan dokumentu tozsamosci REPREZENTANTA — osoby, ktora podpisze umowe.
 *
 * Wniosek sklada sie zdalnie, wiec notariusz moze nigdy nie zobaczyc tej
 * osoby na oczy. Sam obraz dokumentu nie dowodzi tozsamosci (mozna go miec
 * nie bedac wlascicielem), ale jest sladem, na czym oparto identyfikacje,
 * i materialem do sprawdzenia pisowni nazwiska oraz PESEL-u przed wpisaniem
 * ich do umowy.
 *
 * Wlasna bramka statusow: skan wgrywa sie PODCZAS wypelniania wniosku, a nie
 * dopiero przy odsylaniu podpisanych dokumentow.
 */
const STATUSY_EDYCJI_WNIOSKU = new Set(['w_przygotowaniu', 'do_uzupelnienia']);

function zaladujWniosekDoEdycji(zad, odp, dalej) {
  const wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(zad.konto.id);
  if (!wniosek) return dalej(nieZnaleziono('Najpierw rozpocznij wniosek.'));
  if (!STATUSY_EDYCJI_WNIOSKU.has(wniosek.status)) {
    return dalej(bledneZadanie(`Wniosek ma status „${wniosek.status}” — nie można już zmieniać jego danych.`));
  }
  zad.psaWniosek = wniosek;
  dalej();
}

router.post(
  '/wniosek/dowod',
  wymagajWnioskodawcy,
  zaladujWniosekDoEdycji,
  przyjmijSkan,
  asy((zad, odp) => {
    if (!zad.file) throw bledneZadanie('Nie przesłano pliku.');
    const wniosek = zad.psaWniosek;

    // Poprzedni skan przestaje byc potrzebny — zostalby na dysku jako plik,
    // do ktorego nic juz nie prowadzi, a to dane dokumentu tozsamosci.
    if (wniosek.dowod_sciezka) {
      const stary = path.join(konfiguracja.KATALOG_DOKUMENTOW, wniosek.dowod_sciezka);
      if (stary.startsWith(konfiguracja.KATALOG_DOKUMENTOW)) fs.rmSync(stary, { force: true });
    }

    const teraz = czas.terazIso();
    db()
      .prepare(
        `UPDATE psa_wnioski
            SET dowod_sciezka = ?, dowod_nazwa_pliku = ?, dowod_mime = ?,
                dowod_rozmiar = ?, dowod_wgrano = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(
        path.relative(konfiguracja.KATALOG_DOKUMENTOW, zad.file.path),
        zad.file.originalname, zad.file.mimetype, zad.file.size, teraz, teraz, wniosek.id
      );

    odp.status(201).json({ wniosek: db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(wniosek.id) });
  })
);

router.delete(
  '/wniosek/dowod',
  wymagajWnioskodawcy,
  zaladujWniosekDoEdycji,
  asy((zad, odp) => {
    const wniosek = zad.psaWniosek;
    if (wniosek.dowod_sciezka) {
      const plik = path.join(konfiguracja.KATALOG_DOKUMENTOW, wniosek.dowod_sciezka);
      if (plik.startsWith(konfiguracja.KATALOG_DOKUMENTOW)) fs.rmSync(plik, { force: true });
    }
    db()
      .prepare(
        `UPDATE psa_wnioski
            SET dowod_sciezka = NULL, dowod_nazwa_pliku = NULL, dowod_mime = NULL,
                dowod_rozmiar = NULL, dowod_wgrano = NULL, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(czas.terazIso(), wniosek.id);
    odp.json({ wniosek: db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(wniosek.id) });
  })
);

/** Wlasny skan do sprawdzenia, co poszlo. */
router.get(
  '/wniosek/dowod',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(zad.konto.id);
    if (!wniosek || !wniosek.dowod_sciezka) throw nieZnaleziono('Nie przesłano jeszcze dokumentu tożsamości.');
    wyslijPlikDokumentu(odp, wniosek.dowod_sciezka, wniosek.dowod_nazwa_pliku);
  })
);

/** Podpisany skan JEDNEGO dokumentu z kompletu. */
router.post(
  '/wniosek/dokumenty/:id/podpis',
  wymagajWnioskodawcy,
  zaladujWlasnyWniosekDoUploadu,
  przyjmijSkan,
  asy((zad, odp) => {
    if (!zad.file) throw bledneZadanie('Nie przesłano pliku.');
    const dokument = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE id = ? AND wniosek_id = ? AND udostepniono IS NOT NULL')
      .get(Number(zad.params.id), zad.psaWniosek.id);
    if (!dokument) {
      fs.rmSync(zad.file.path, { force: true });
      throw nieZnaleziono('Nie odnaleziono dokumentu.');
    }

    zapiszPodpisanySkan(zad.psaWniosek, dokument, zad.file);
    odp.status(201).json({
      wniosek: db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(zad.psaWniosek.id),
      dokumenty: wczytajDokumentyWniosku(zad.psaWniosek.id),
    });
  })
);

/** Pobranie WLASNEGO odeslanego skanu - do sprawdzenia, co poszlo. */
router.get(
  '/wniosek/dokumenty/:id/podpis',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(zad.konto.id);
    if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
    const dokument = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE id = ? AND wniosek_id = ? AND udostepniono IS NOT NULL')
      .get(Number(zad.params.id), wniosek.id);
    if (!dokument || !dokument.podpis_sciezka) throw nieZnaleziono('Nie odesłano jeszcze tego dokumentu.');
    wyslijPlikDokumentu(odp, dokument.podpis_sciezka, dokument.podpis_nazwa_pliku);
  })
);

/**
 * Zdjecie odeslanego skanu - klient zorientowal sie, ze wgral nie ten plik
 * albo nieczytelny. Przy umowie cofa tez status: bez podpisanej umowy
 * wniosek nie jest gotowy do przyjecia.
 */
router.delete(
  '/wniosek/dokumenty/:id/podpis',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(zad.konto.id);
    if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
    if (!STATUSY_PRZYJMUJACE_PODPISY.has(wniosek.status)) {
      throw bledneZadanie(`Wniosek ma status „${wniosek.status}” — nie można już zmieniać przesłanych dokumentów.`);
    }
    const dokument = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE id = ? AND wniosek_id = ? AND udostepniono IS NOT NULL')
      .get(Number(zad.params.id), wniosek.id);
    if (!dokument || !dokument.podpis_sciezka) throw nieZnaleziono('Nie odesłano jeszcze tego dokumentu.');

    const pelna = path.join(konfiguracja.KATALOG_DOKUMENTOW, dokument.podpis_sciezka);
    if (pelna.startsWith(konfiguracja.KATALOG_DOKUMENTOW)) fs.rmSync(pelna, { force: true });

    db()
      .prepare(
        `UPDATE psa_wnioski_dokumenty
            SET podpis_sciezka = NULL, podpis_nazwa_pliku = NULL, podpis_mime = NULL,
                podpis_rozmiar = NULL, podpis_wgrano = NULL
          WHERE id = ?`
      )
      .run(dokument.id);

    if (dokument.typ === dokumentyWniosku.TYPY.UMOWA_REJESTRU) {
      db()
        .prepare(
          `UPDATE psa_wnioski
              SET status = 'umowa_wygenerowana', umowa_podpisana_sciezka = NULL,
                  umowa_podpisana_nazwa_pliku = NULL, umowa_podpisana_mime = NULL,
                  umowa_podpisana_wgrano = NULL, zaktualizowano = ?
            WHERE id = ?`
        )
        .run(czas.terazIso(), wniosek.id);
    }

    odp.json({
      wniosek: db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(wniosek.id),
      dokumenty: wczytajDokumentyWniosku(wniosek.id),
    });
  })
);

/**
 * Stara trasa odsylania umowy. Zostaje, bo umowa jest szczegolna (przenosi
 * status wniosku) i bo prowadzi do niej gotowy formularz - ale zapisuje
 * dokladnie to samo, co trasa ogolna wyzej: jeden mechanizm, nie dwa.
 */
router.post(
  '/wniosek/umowa-podpisana',
  wymagajWnioskodawcy,
  zaladujWlasnyWniosekDoUploadu,
  przyjmijSkan,
  asy((zad, odp) => {
    if (!zad.file) throw bledneZadanie('Nie przesłano pliku.');
    const umowa = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE wniosek_id = ? AND typ = ? AND udostepniono IS NOT NULL')
      .get(zad.psaWniosek.id, dokumentyWniosku.TYPY.UMOWA_REJESTRU);
    if (!umowa) throw nieZnaleziono('Projekt umowy nie został jeszcze wygenerowany.');

    zapiszPodpisanySkan(zad.psaWniosek, umowa, zad.file);
    odp.status(201).json({
      wniosek: db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(zad.psaWniosek.id),
      dokumenty: wczytajDokumentyWniosku(zad.psaWniosek.id),
    });
  })
);

router.get(
  '/wniosek/umowa-podpisana',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = db().prepare('SELECT * FROM psa_wnioski WHERE konto_id = ?').get(zad.konto.id);
    if (!wniosek || !wniosek.umowa_podpisana_sciezka) throw nieZnaleziono('Nie odnaleziono przesłanej umowy.');

    const pelnaSciezka = path.join(konfiguracja.KATALOG_DOKUMENTOW, wniosek.umowa_podpisana_sciezka);
    if (!pelnaSciezka.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(pelnaSciezka)) {
      throw nieZnaleziono('Plik nie jest już dostępny.');
    }

    pliki.naglowkiPliku(odp, { nazwaPliku: wniosek.umowa_podpisana_nazwa_pliku, wRamce: false });
    fs.createReadStream(pelnaSciezka).pipe(odp);
  })
);

// ─────────────────────────────────────────────────────────────
// Moje spolki / akcje
// ─────────────────────────────────────────────────────────────

router.get(
  '/moje',
  asy((zad, odp) => {
    const konto = zad.konto;

    if (konto.rola === 'spolka') {
      // Trzy liczby przy kazdej spolce, po ktore klient i tak wchodzil do
      // podgladu rejestru: ilu ma akcjonariuszy, ile akcji jest w obrocie
      // i kiedy ostatnio cos sie zmienilo.
      const stanSpolki = db().prepare(
        `SELECT COUNT(DISTINCT osoba_id) AS akcjonariuszy, COALESCE(SUM(ilosc), 0) AS akcji
           FROM psa_stan_akcji
          WHERE spolka_id = ? AND data_do IS NULL AND kategoria = 'akcjonariusz'`
      );
      const ostatnieZdarzenie = db().prepare(
        'SELECT MAX(data_zdarzenia) AS data FROM psa_zdarzenia WHERE spolka_id = ?'
      );

      const spolki = spolkiKonta(konto)
        .map((id) => rejestr.wczytajSpolke(db(), id))
        .filter(Boolean)
        .map((spolka) => ({
          ...spolka,
          uwagi: undefined,
          akcjonariuszy: stanSpolki.get(spolka.id).akcjonariuszy,
          razem_akcji: stanSpolki.get(spolka.id).akcji,
          ostatnie_zdarzenie: ostatnieZdarzenie.get(spolka.id).data || null,
        }));

      // Konto moze prowadzic juz jedna spolke i miec w toku wniosek o druga.
      const wToku = db()
        .prepare(
          `SELECT id, status, nazwa, krs, zaktualizowano FROM psa_wnioski
            WHERE konto_id = ? AND status NOT IN ('przyjety','odrzucony')
            ORDER BY id DESC LIMIT 1`
        )
        .get(konto.id);

      return odp.json({ rola: 'spolka', spolki, wniosek: wToku || null });
    }

    // Wnioskodawca nie ma jeszcze ani spolki, ani akcji - jego "Moje spolki"
    // to STAN WNIOSKU. Bez tego ekran pokazywal "brak powiazanych spolek",
    // co po zlozeniu wniosku i odeslaniu podpisanej umowy jest po prostu
    // nieprawda: sprawa jest w toku, tylko po stronie kancelarii.
    if (konto.rola === 'wnioskodawca') {
      const wniosek = db()
        .prepare('SELECT id, status, nazwa, krs, zaktualizowano FROM psa_wnioski WHERE konto_id = ?')
        .get(konto.id);
      return odp.json({ rola: 'wnioskodawca', spolki: [], wniosek: wniosek || null });
    }

    const wiersze = db()
      .prepare(
        `SELECT sa.spolka_id, s.nazwa, s.krs, e.seria, sa.nr_od, sa.nr_do, sa.ilosc
           FROM psa_stan_akcji sa
           JOIN psa_spolki s ON s.id = sa.spolka_id
           JOIN psa_emisje e ON e.id = sa.emisja_id
          WHERE sa.osoba_id = ? AND sa.data_do IS NULL AND sa.kategoria = 'akcjonariusz'
          ORDER BY s.nazwa COLLATE NOCASE, e.seria, sa.nr_od`
      )
      .all(konto.osoba_id);

    const grupy = new Map();
    for (const w of wiersze) {
      if (!grupy.has(w.spolka_id)) {
        grupy.set(w.spolka_id, { spolka_id: w.spolka_id, nazwa: w.nazwa, krs: w.krs, razem_akcji: 0, pozycje: [] });
      }
      const g = grupy.get(w.spolka_id);
      g.razem_akcji += w.ilosc;
      g.pozycje.push({ seria: w.seria, ilosc: w.ilosc, numery: numery.opisz([{ nr_od: w.nr_od, nr_do: w.nr_do }]) });
    }

    odp.json({ rola: 'akcjonariusz', spolki: [...grupy.values()] });
  })
);

/** Stan rejestru z maskowaniem wg roli konta (art. 300(35) KSH). */
router.get(
  '/rejestr/:spolkaId',
  asy((zad, odp) => {
    // Dostep do tej spolki juz sprawdzony przez `wymagajDostepuDoSpolki` wyzej.
    const spolkaId = Number(zad.params.spolkaId);
    const data = zad.query.data ? String(zad.query.data) : czas.dzisIso();
    if (!czas.poprawnaData(data)) throw bledneZadanie('Parametr „data” musi mieć format RRRR-MM-DD.');

    const stan = widoki.widokStanu(db(), spolkaId, data, {
      rola: rolaOdbioru(zad.konto),
      odbiorcaOsobaId: zad.konto.osoba_id,
    });
    if (!stan) throw nieZnaleziono('Nie odnaleziono spółki.');
    odp.json(stan);
  })
);

// ─────────────────────────────────────────────────────────────
// Zadania (zlozenie zadania wpisu - kroki 1-2 kreatora)
// ─────────────────────────────────────────────────────────────

function widokSprawyPortal(sprawa, dzis = czas.dzisIso()) {
  const typ = typyZdarzen.istnieje(sprawa.typ_zdarzenia) ? typyZdarzen.typ(sprawa.typ_zdarzenia) : null;
  return {
    id: sprawa.id,
    spolka_id: sprawa.spolka_id,
    typ_zdarzenia: sprawa.typ_zdarzenia,
    typ_nazwa: typ ? typ.nazwa : sprawa.typ_zdarzenia,
    typ_symbol: typ ? typ.symbol : '?',
    zrodlo: sprawa.zrodlo,
    zadajacy_opis: sprawa.zadajacy_opis,
    data_wplywu: sprawa.data_wplywu,
    stan: sprawa.stan,
    powod_odmowy: sprawa.powod_odmowy,
    termin: terminy.policzTermin(sprawa, dzis),
  };
}

router.get(
  '/zadania',
  asy((zad, odp) => {
    const konto = zad.konto;
    const spolki = konto.rola === 'spolka' ? spolkiKonta(konto) : [];
    const warunek = konto.rola === 'spolka'
      ? `sp.spolka_id IN (${spolki.map(() => '?').join(',') || 'NULL'})`
      : 'sp.zadajacy_osoba_id = ?';
    const parametry = konto.rola === 'spolka' ? spolki : [konto.osoba_id];

    const wiersze = db()
      .prepare(
        `SELECT sp.*, s.nazwa AS spolka_nazwa
           FROM psa_sprawy sp
           JOIN psa_spolki s ON s.id = sp.spolka_id
          WHERE sp.zrodlo = 'portal' AND ${warunek}
          ORDER BY sp.data_wplywu DESC`
      )
      .all(...parametry);

    const dzis = czas.dzisIso();
    odp.json({ sprawy: wiersze.map((s) => ({ ...widokSprawyPortal(s, dzis), spolka_nazwa: s.spolka_nazwa })) });
  })
);

router.post(
  '/zadania',
  asy((zad, odp) => {
    const konto = zad.konto;
    const cialo = zad.body || {};

    // Dostep do tej spolki juz sprawdzony przez `wymagajDostepuDoSpolki` wyzej.
    const spolkaId = Number(cialo.spolka_id);
    const spolka = rejestr.wczytajSpolke(db(), spolkaId);
    if (!spolka) throw bledneZadanie('Nie odnaleziono spółki.');
    if (przepisy.STATUSY_SPOLKI_BLOKUJACE_WPIS.includes(spolka.status)) {
      throw bledneZadanie(`Spółka ma status „${spolka.status}” — nie można zgłosić nowej sprawy.`);
    }

    const typZdarzenia = String(cialo.typ_zdarzenia || '');
    // Celowo NIE bramkujemy sprintem 5: ulamkowe czesci akcji, wspolny
    // przedstawiciel i wzmianka o pokryciu wymagaja oceny pracownika kancelarii
    // (decyzja nr 10, sekcja 15 CLAUDE-PSA.md) - portal klienta ich nie oferuje.
    const typ = typyZdarzen
      .dostepneWKreatorze(2)
      .find((t) => t.kod === typZdarzenia && !t.z_urzedu);
    if (!typ) {
      throw bledneZadanie(`Typ zdarzenia „${typZdarzenia}” nie jest dostępny do zgłoszenia przez portal.`);
    }

    // Opis przestal byc obowiazkowy: wpisu dokonuje sie NA PODSTAWIE
    // DOKUMENTU (art. 300(34) § 4 KSH), a nie opisu zadajacego. Klient, ktory
    // dolaczyl umowe i wskazal typ zdarzenia, powiedzial juz wszystko —
    // wymuszanie wypracowania obok dokumentu tworzylo drugie zrodlo prawdy,
    // ktore pracownik i tak musial konfrontowac z plikiem.
    const opis = String(cialo.opis || '').trim();

    const dataWplywu = czas.terazIso();
    const dane = {
      spolka_id: spolkaId,
      typ_zdarzenia: typZdarzenia,
      zrodlo: 'portal',
      zadajacy_osoba_id: konto.osoba_id,
      zadajacy_opis: konto.rola === 'spolka'
        ? `${spolka.nazwa} (zgłoszenie przez portal)`
        : opis || `${konto.email} (zgłoszenie przez portal)`,
      data_wplywu: dataWplywu,
      stan: 'nowa',
      wymaga_powiadomienia: typ.wymaga_powiadomienia === true ? 1 : 0,
      autor: `Portal — ${konto.email}`,
      notatka: opis || null,
      utworzono: czas.terazIso(),
    };
    dane.termin_do = terminy.policzTermin(
      { data_wplywu: dataWplywu.slice(0, 10), stan: 'nowa', wstrzymana_od: null, wznowiona_od: null },
      czas.dzisIso()
    ).termin_do;

    const kolumny = Object.keys(dane);
    const wynik = db()
      .prepare(`INSERT INTO psa_sprawy (${kolumny.join(', ')}) VALUES (${kolumny.map((k) => `@${k}`).join(', ')})`)
      .run(dane);

    const sprawa = db().prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(wynik.lastInsertRowid);
    odp.status(201).json({ sprawa: widokSprawyPortal(sprawa) });
  })
);

// ─────────────────────────────────────────────────────────────
// Dokumenty do wlasnej sprawy (upload z portalu)
// ─────────────────────────────────────────────────────────────

const ROZSZERZENIA_DOZWOLONE = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']);
const LIMIT_ROZMIARU_BAJTY = 20 * 1024 * 1024;

function katalogSprawy(spolkaId, sprawaId) {
  return path.join(konfiguracja.KATALOG_DOKUMENTOW, `spolka_${spolkaId}`, `sprawa_${sprawaId}`);
}

const upload = multer({
  storage: multer.diskStorage({
    destination(zad, plik, wywolaj) {
      const sprawa = zad.psaSprawa;
      const katalog = katalogSprawy(sprawa.spolka_id, sprawa.id);
      fs.mkdirSync(katalog, { recursive: true });
      wywolaj(null, katalog);
    },
    filename(zad, plik, wywolaj) {
      const bezpiecznaNazwa = path.basename(plik.originalname).replace(/[^\w.\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu, '_');
      wywolaj(null, `${crypto.randomUUID()}-${bezpiecznaNazwa}`);
    },
  }),
  limits: { fileSize: LIMIT_ROZMIARU_BAJTY, files: 10 },
  fileFilter(zad, plik, wywolaj) {
    const rozszerzenie = path.extname(plik.originalname).toLowerCase();
    if (!ROZSZERZENIA_DOZWOLONE.has(rozszerzenie)) {
      return wywolaj(
        new Error(`Niedozwolone rozszerzenie pliku: „${rozszerzenie}”. Dozwolone: ${[...ROZSZERZENIA_DOZWOLONE].join(', ')}.`)
      );
    }
    wywolaj(null, true);
  },
});

/**
 * Jedyny sposob, w jaki trasa portalu dostaje sprawe do reki (blok D3,
 * punkt 2 - odwolanie POSREDNIE przez `sprawa_id`, ktorej sama trasa nie
 * zna, ale ktora nalezy do konkretnej spolki). `wymagajDostepuDoSpolki`
 * wyzej tego nie widzi - stad osobna, nazwana funkcja zamiast golego
 * `db().prepare(...).get()` w handlerze, zeby nie dalo sie o sprawdzenie
 * wlasnosci przypadkiem zapomniec.
 */
function wczytajSpraweDlaKonta(konto, sprawaId) {
  const sprawa = db().prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(sprawaId);
  if (!sprawa || sprawa.zrodlo !== 'portal') return null;
  const wlasciciel =
    konto.rola === 'spolka'
      ? Number(sprawa.spolka_id) === Number(konto.spolka_id)
      : Number(sprawa.zadajacy_osoba_id) === Number(konto.osoba_id);
  return wlasciciel ? sprawa : null;
}

/** Wstrzykuje sprawe do `zad` PRZED multerem, sprawdzajac wlasnosc. */
function zaladujWlasnaSprawe(zad, odp, dalej) {
  const sprawa = wczytajSpraweDlaKonta(zad.konto, Number(zad.params.id));
  if (!sprawa) return dalej(nieZnaleziono('Nie odnaleziono sprawy.'));
  zad.psaSprawa = sprawa;
  dalej();
}

router.post(
  '/zadania/:id/dokumenty',
  zaladujWlasnaSprawe,
  (zad, odp, dalej) => upload.array('pliki', 10)(zad, odp, (e) => (e ? dalej(bledneZadanie(e.message)) : dalej())),
  asy((zad, odp) => {
    const sprawa = zad.psaSprawa;
    const konto = zad.konto;
    const typDokumentu = String(zad.body.typ_dokumentu || 'inny');
    if (!TYPY_DOKUMENTU.includes(typDokumentu)) throw bledneZadanie(`Nieznany typ dokumentu: „${typDokumentu}”.`);
    const wgrane = zad.files || [];
    if (wgrane.length === 0) throw bledneZadanie('Nie przesłano żadnego pliku.');
    // Rozszerzenie to obietnica klienta — sprawdzamy sygnature tresci.
    for (const plik of wgrane) {
      if (pliki.trescPasuje(plik.path, pliki.typZNazwy(plik.originalname))) continue;
      for (const p of wgrane) fs.rmSync(p.path, { force: true });
      throw bledneZadanie(
        `Treść pliku „${plik.originalname}" nie odpowiada jego rozszerzeniu. Prześlij PDF, skan albo zdjęcie.`
      );
    }

    const wstaw = db().prepare(
      `INSERT INTO psa_dokumenty (sprawa_id, nazwa_pliku, sciezka, mime, rozmiar, typ_dokumentu, hash, wgral, utworzono)
       VALUES (@sprawa_id, @nazwa_pliku, @sciezka, @mime, @rozmiar, @typ_dokumentu, @hash, @wgral, @utworzono)`
    );
    const zapisane = wgrane.map((plik) => {
      const hash = crypto.createHash('sha256').update(fs.readFileSync(plik.path)).digest('hex');
      const wynik = wstaw.run({
        sprawa_id: sprawa.id,
        nazwa_pliku: plik.originalname,
        sciezka: path.relative(konfiguracja.KATALOG_DOKUMENTOW, plik.path),
        mime: plik.mimetype,
        rozmiar: plik.size,
        typ_dokumentu: typDokumentu,
        hash,
        wgral: `Portal — ${konto.email}`,
        utworzono: czas.terazIso(),
      });
      return { id: Number(wynik.lastInsertRowid), nazwa_pliku: plik.originalname, rozmiar: plik.size };
    });

    odp.status(201).json({ dokumenty: zapisane });
  })
);

// ─────────────────────────────────────────────────────────────
// Informacja z rejestru (art. 300(35) KSH)
// ─────────────────────────────────────────────────────────────

router.post(
  '/informacja',
  asy((zad, odp) => {
    // Dostep do tej spolki juz sprawdzony przez `wymagajDostepuDoSpolki` wyzej.
    const konto = zad.konto;
    const spolkaId = Number((zad.body || {}).spolka_id);

    const data = (zad.body || {}).data ? String((zad.body || {}).data) : czas.dzisIso();
    if (!czas.poprawnaData(data)) throw bledneZadanie('Parametr „data” musi mieć format RRRR-MM-DD.');

    const stan = widoki.widokStanu(db(), spolkaId, data, {
      rola: rolaOdbioru(konto),
      odbiorcaOsobaId: konto.osoba_id,
    });
    if (!stan) throw nieZnaleziono('Nie odnaleziono spółki.');

    const trescHtml = informacjaDokument.informacjaZRejestru({
      kancelaria: ustawienia.kancelaria(db()),
      spolka: stan.spolka,
      data,
      stan,
      odbiorca: { rola: rolaOdbioru(konto) },
      sporzadzono: czas.terazIso(),
    });

    const autorWpisu = `Portal — ${konto.email}`;
    const wynikZapisu = db()
      .prepare(
        `INSERT INTO psa_wydane_dokumenty (spolka_id, typ, odbiorca_osoba_id, kanal, tresc_html, wyslano, autor, utworzono)
         VALUES (?, 'informacja_z_rejestru', ?, 'portal', ?, ?, ?, ?)`
      )
      .run(spolkaId, konto.osoba_id, trescHtml, czas.terazIso(), autorWpisu, czas.terazIso());

    // Wglad w dane calego akcjonariatu spolki - blok D4, zakres WASKI.
    dziennikDostepu.zapisz(db(), {
      kto: autorWpisu,
      typKto: 'portal',
      spolkaId,
      akcja: dziennikDostepu.AKCJE.INFORMACJA_Z_REJESTRU,
      opis: `stan na ${data}`,
    });

    // Odpłatność za informację z rejestru (sekcja 1 i 8) - samoobsługowe
    // pobranie przez portal jest tak samo odpłatną czynnością jak żądanie
    // papierowe/mailowe obsłużone przez pracownika.
    const oplata = oplaty.naliczOplateInformacji(db(), {
      spolkaId,
      odbiorcaOsobaId: konto.osoba_id,
      autor: autorWpisu,
      notatka: `Informacja z rejestru — portal, ${data}`,
    });

    odp.json({ dokument_id: Number(wynikZapisu.lastInsertRowid), oplata });
  })
);

/**
 * Wydany dokument pod wlasnym adresem. Portal otwieral informacje jako
 * `blob:` sklejony z odpowiedzi POST — dokument nie mial wtedy adresu (nie
 * dalo sie go otworzyc ponownie ani wyslac linkiem), przegladarka
 * proponowala mu przypadkowa nazwe pliku, a sciezki wzgledne w srodku (godlo)
 * nie mialy sie do czego odniesc.
 *
 * GET niczego nie generuje i NIE NALICZA OPLATY: oddaje tresc zapisana przy
 * wydaniu. Ponowne otwarcie raz wydanego dokumentu jest bezplatne — platna
 * jest czynnosc wydania, nie zaglodniecie do wlasnej szuflady.
 */
router.get(
  '/informacja/:id',
  asy((zad, odp) => {
    const konto = zad.konto;
    const dokument = db()
      .prepare(
        `SELECT id, spolka_id, tresc_html FROM psa_wydane_dokumenty
          WHERE id = ? AND typ = 'informacja_z_rejestru'`
      )
      .get(Number(zad.params.id));

    // Cudzy dokument to dla portalu dokument NIEISTNIEJACY: 403 potwierdzalby,
    // ze taki numer jest zajety.
    if (!dokument || !maDostepDoSpolki(konto, dokument.spolka_id)) {
      throw nieZnaleziono('Nie odnaleziono dokumentu.');
    }

    odp.type('text/html').send(dokument.tresc_html);
  })
);

module.exports = router;
// Etap 3F: kancelaria koryguje dane wniosku (server/trasy/wnioski.js) - ta
// sama walidacja formatu, co przy zapisie klienta, zeby korekta kancelarii
// nie mogla wpisac danych w gorszym ksztalcie niz sam klient.
module.exports.POLA_WNIOSKU = POLA_WNIOSKU;
module.exports.wyczyscWniosek = wyczyscWniosek;
module.exports.sprawdzDaneWniosku = sprawdzDaneWniosku;
module.exports.POLA_AKCJONARIUSZA_WNIOSKU = POLA_AKCJONARIUSZA_WNIOSKU;
module.exports.wyczyscAkcjonariuszaWniosku = wyczyscAkcjonariuszaWniosku;
module.exports.sprawdzAkcjonariuszaWniosku = sprawdzAkcjonariuszaWniosku;
