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
const platnosci = require('../platnosci');
const tpay = require('../logika/tpay');
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
const poczta = require('../poczta');
const pliki = require('../pomocnicze/pliki');
const czas = require('../pomocnicze/czas');
const { asy, bledneZadanie, nieZnaleziono, nieAutoryzowany, brakUprawnien, BladZadania, dalejPoUploadzie } = require('../pomocnicze/odpowiedzi');
const autoryzacja = require('../pomocnicze/autoryzacja');
const { pobierzZKrs } = require('./krs');
const osobyModul = require('./osoby');
const trybTestowy = require('../tryb-testowy');
const walidacjaPodpisu = require('../logika/walidacja-podpisu');
const formyPodpisu = require('../logika/formy-podpisu');
const informacje = require('../informacje');

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

/**
 * Spolki, ktorych rozliczen dotyczy to konto. Rola „spolka" ma swoje spolki
 * z tabeli powiazan; akcjonariusz — te, w ktorych ma akcje (art. 300(35) § 1
 * KSH: rejestr jest jawny dla spolki i dla kazdego akcjonariusza).
 */
function spolkiRozliczen(konto) {
  if (konto.rola === 'spolka') return spolkiKonta(konto);
  if (konto.osoba_id == null) return [];
  return db()
    .prepare('SELECT DISTINCT spolka_id FROM psa_stan_akcji WHERE osoba_id = ?')
    .all(konto.osoba_id)
    .map((w) => w.spolka_id);
}

/**
 * Warunek SQL zawezajacy oplaty do tych, ktore wolno pokazac temu kontu.
 *
 * Akcjonariusz widzi WYLACZNIE swoje wlasne zamowienia (informacje, ktore
 * sam zamowil). Gdyby zakladka Platnosci pokazywala mu wszystkie oplaty
 * „jego" spolki, zobaczylby cala historie jej rozliczen z kancelaria —
 * ile placi za prowadzenie i ile wpisow zrobila.
 */
function warunekOplatKonta(konto, spolki) {
  const miejsca = spolki.map(() => '?').join(',');
  if (konto.rola === 'spolka') {
    return { sql: `o.spolka_id IN (${miejsca}) AND o.zamawiajacy_osoba_id IS NULL`, parametry: [...spolki] };
  }
  return { sql: 'o.zamawiajacy_osoba_id = ?', parametry: [konto.osoba_id] };
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
    // QW3 / D-083 — portal tylko dla akcjonariusza ze zgodą na komunikację
    // e-mail; po wpisaniu cofnięcia zgody dostęp wygasa.
    if (konto.rola === 'akcjonariusz' && konto.osoba_id) {
      const osoba = db().prepare('SELECT zgoda_email_status FROM psa_osoby WHERE id = ?').get(konto.osoba_id);
      if (!osoba || osoba.zgoda_email_status !== 'potwierdzona') {
        throw nieAutoryzowany(
          'Bez zgody na komunikację e-mail dostęp do portalu jest wyłączony. Korespondencja z rejestru przychodzi pocztą, '
            + 'a żądania wpisu składa się pocztą albo w kancelarii.'
        );
      }
    }
    db().prepare('UPDATE psa_konta SET ostatnie_logowanie = ? WHERE id = ?').run(czas.terazIso(), konto.id);

    autoryzacja.zalogujKonto(zad, odp, konto.id);
    trybTestowy.zapiszLogowanie(db(), {
      typKonta: 'portal', kontoId: konto.id, email: konto.email, droga: (zad.body || {}).droga_testowa,
    });
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
    odp.json({
      zalogowany: Boolean(zad.konto),
      konto: widokKonta(zad.konto),
      sesja_wygasa: zad.konto ? zad.sesjaWygasa : null,
    });
  })
);

// ─────────────────────────────────────────────────────────────
// Zgloszenie wstepne (etap 3A) - PUBLICZNE, bez zadnej sesji. Pierwszy
// kontakt nieznanego dotad klienta: wylacznie dane kontaktowe, zadnego
// PESEL ani adresu. Zaproszenie do portalu (etap 3B) wychodzi automatycznie
// i od razu - patrz komentarz przy `zapros.wyslij()` nizej.
// ─────────────────────────────────────────────────────────────

const WZORZEC_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Jedna postać odpowiedzi formularza zgłoszenia — dla nowego KRS i duplikatu (D-079). */
function odpowiedzZgloszenia({ formaPrawna, wyslano, linkTestowy }) {
  return { ok: true, forma_prawna: formaPrawna || null, zaproszenie_wyslane: Boolean(wyslano), link_testowy: linkTestowy };
}

function trescZgloszeniaPonownego({ kancelariaNazwa, krs, adresPortalu }) {
  return `
    <p>Dzień dobry,</p>
    <p>otrzymaliśmy zgłoszenie dotyczące prowadzenia rejestru akcjonariuszy spółki o numerze KRS ${krs}.
       Kancelaria je rozpatrzy i odezwie się na ten adres.</p>
    <p>Jeśli masz już konto w portalu klienta ${kancelariaNazwa}, możesz się zalogować:
       <a href="${adresPortalu}">${adresPortalu}</a>.</p>
  `;
}

/**
 * Duplikat zgłoszenia (D-079) — bez nowego konta i bez zaproszenia. Ślad dla
 * kancelarii: zgłoszenie zamknięte (`odrzucone`) z notatką wewnętrzną —
 * widoczne w kolejce „Zgłoszenia” po filtrze statusu. Na podany adres idzie
 * neutralna wiadomość, która nie mówi, czy rejestr jest prowadzony.
 */
async function zgloszenieDuplikat({ email, krs, cialo, nazwaZKrs, formaPrawna, powod }) {
  const teraz = czas.terazIso();
  db().prepare(
    `INSERT INTO psa_zgloszenia (email, krs, telefon, nazwa_spolki, opis, status, notatka_wewnetrzna,
                                 obsluzone_przez, obsluzone_kiedy, utworzono)
     VALUES (?, ?, ?, ?, ?, 'odrzucone', ?, 'automat', ?, ?)`
  ).run(
    email, krs, String(cialo.telefon || '').trim() || null,
    String(cialo.nazwa_spolki || '').trim() || nazwaZKrs, String(cialo.opis || '').trim() || null,
    `[${teraz}] Zgłoszenie ponowne — ${powod}. Formularz odpowiedział jak przy nowym zgłoszeniu (D-079); `
      + 'nie założono konta ani nie wysłano zaproszenia. W razie potrzeby skontaktuj się ze zgłaszającym.',
    teraz, teraz
  );
  const kancelaria = ustawienia.kancelaria(db());
  const proba = await poczta.wyslij({
    do: email,
    temat: `Zgłoszenie przyjęte — ${kancelaria.nazwa}`,
    html: trescZgloszeniaPonownego({ kancelariaNazwa: kancelaria.nazwa, krs, adresPortalu: konfiguracja.URL_PORTALU }),
  });
  return odpowiedzZgloszenia({
    formaPrawna, wyslano: proba.wyslano, linkTestowy: konfiguracja.TRYB_TESTOWY ? konfiguracja.URL_PORTALU : undefined,
  });
}

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
    // W7.1 — wariant „Przenoszę rejestr od innego podmiotu” (walidacja danych
    // wejściowych PRZED rozpoznaniem duplikatu — odpowiedź nie może się różnić).
    const przen = cialo.przeniesienie && typeof cialo.przeniesienie === 'object' ? cialo.przeniesienie : null;
    if (przen && !['dom_maklerski', 'notariusz', 'rada_izby'].includes(przen.poprzednik_typ)) {
      throw bledneZadanie('Wskaż, kto dotąd prowadził rejestr: dom maklerski / bank, notariusz albo notariusz, który zakończył działalność.');
    }

    // D-079 (K6): formularz NIE ujawnia, czy kancelaria prowadzi już rejestr
    // spółki ani czy zgłoszenie jest w toku — sam numer KRS nie może tego
    // zdradzić. Duplikat obsługujemy po cichu: ślad dla kancelarii (zgłoszenie
    // zamknięte z notatką), neutralna wiadomość na podany adres i odpowiedź
    // dokładnie taka jak przy nowym zgłoszeniu. Duplikat rozpoznajemy po KRS,
    // nie po adresie e-mail (jeden klient miewa kilka spółek).
    const juzProwadzona = db().prepare('SELECT id FROM psa_spolki WHERE krs = ?').get(krs);
    const wToku = db()
      .prepare(`SELECT id FROM psa_wnioski WHERE krs = ? AND status NOT IN ('przyjety','odrzucony') LIMIT 1`)
      .get(krs);
    const zgloszoneWczesniej = db()
      .prepare(`SELECT id FROM psa_zgloszenia WHERE krs = ? AND status <> 'odrzucone' LIMIT 1`)
      .get(krs);
    if (juzProwadzona || wToku || zgloszoneWczesniej) {
      return odp.status(201).json(await zgloszenieDuplikat({
        email, krs, cialo, nazwaZKrs: zKrs && zKrs.znaleziono ? zKrs.dane.nazwa : null,
        formaPrawna: zKrs && zKrs.znaleziono ? zKrs.dane.forma_prawna : null,
        powod: juzProwadzona ? 'rejestr spółki jest już prowadzony' : 'zgłoszenie albo wniosek dla tego KRS jest w toku',
      }));
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
      rodzaj: przen ? 'przeniesienie' : 'nowy',
      status: 'nowe',
      utworzono: czas.terazIso(),
    };

    const kolumny = Object.keys(dane);
    let wynikZgloszenia;
    try {
      wynikZgloszenia = db()
        .prepare(`INSERT INTO psa_zgloszenia (${kolumny.join(', ')}) VALUES (${kolumny.map((k) => `@${k}`).join(', ')})`)
        .run(dane);
    } catch (e) {
      // Ostatnia linia obrony przed wyscigiem: dwa rownoczesne zgloszenia dla
      // tego samego KRS moga oba minac SELECT wyzej, zanim ktorykolwiek INSERT
      // sie wykona - indeks unikalny (migracja 48) to wtedy lapie tutaj.
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return odp.status(201).json(await zgloszenieDuplikat({
          email, krs, cialo, nazwaZKrs, formaPrawna, powod: 'równoczesne zgłoszenie dla tego KRS',
        }));
      }
      throw e;
    }

    if (przen) {
      require('../przeniesienia').utworzZeZgloszenia(db(), {
        zgloszenieId: Number(wynikZgloszenia.lastInsertRowid), krs, nazwa: dane.nazwa_spolki,
        poprzednikTyp: przen.poprzednik_typ,
        poprzednikNazwa: String(przen.poprzednik_nazwa || '').trim() || null,
        okresWypowiedzenia: String(przen.okres_wypowiedzenia || '').trim() || null,
      });
    }

    // Zaproszenie idzie OD RAZU. Na tym etapie kancelaria niczego jeszcze nie
    // sprawdza — sprawdza dopiero wniosek — a kazdy dzien zwloki miedzy
    // zgloszeniem a dostepem do formularza to dzien, w ktorym klient czeka
    // bez powodu. Kolejka „Zgloszenia" zostaje jako slad, nie jako bramka.
    const zaproszenie = await zapros.wyslij(db(), {
      zgloszenieId: Number(wynikZgloszenia.lastInsertRowid),
      email,
      autor: 'Portal — zgłoszenie',
    });

    // D-079: odpowiedź identyczna jak przy duplikacie. Linku aktywacyjnego
    // w odpowiedzi już NIE ma — zdradzałby różnicę, a zgłaszający cudzym
    // adresem przejmowałby konto (obserwacja O1). Przy awarii poczty link
    // przekazuje kancelaria z kolejki zgłoszeń.
    odp.status(201).json(odpowiedzZgloszenia({
      formaPrawna, wyslano: zaproszenie.email_wyslany, linkTestowy: zaproszenie.link_testowy,
    }));
  })
);

// ─────────────────────────────────────────────────────────────
// Aktywacja konta (etap 3B) - PUBLICZNE, bez sesji. Konto (rola
// 'wnioskodawca', aktywne=0) i token aktywacyjny powstaja automatycznie
// w chwili zgloszenia (`POST /zgloszenia` wyzej, `zapros.wyslij()`) albo
// przy ponownej wysylce (`server/trasy/zgloszenia.js: POST /:id/zapros`) -
// klient token tu wymienia na haslo i od razu ma otwarta sesje portalowa.
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
    trybTestowy.zapiszLogowanie(db(), {
      typKonta: 'portal', kontoId: konto.id, email: konto.email, droga: 'link_aktywacyjny',
    });
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
// Zmiana hasla konta portalowego (ekran „Konto" — Faza 4 pkt 1). Wzorzec
// identyczny jak `POST /api/psa/auth/zmiana-hasla` dla pracownikow: haslo
// obecne + nowe, unieważnienie wszystkich tokenow tego konta po zmianie.
// ─────────────────────────────────────────────────────────────

router.post(
  '/zmiana-hasla',
  asy(async (zad, odp) => {
    const { haslo_obecne, haslo_nowe } = zad.body || {};
    if (!haslo_obecne || !haslo_nowe) throw bledneZadanie('Podaj obecne i nowe hasło.');

    const pasuje = await hasla.zweryfikuj(haslo_obecne, zad.konto.hash_hasla);
    if (!pasuje) throw bledneZadanie('Obecne hasło jest nieprawidłowe.');

    const ocena = hasla.ocenSile(haslo_nowe);
    if (!ocena.ok) throw bledneZadanie(ocena.powod);

    const nowyHash = await hasla.hashuj(haslo_nowe);
    db().prepare('UPDATE psa_konta SET hash_hasla = ? WHERE id = ?').run(nowyHash, zad.konto.id);
    autoryzacja.uniewaznijWszystkieTokeny('konto', zad.konto.id);
    odp.json({ ok: true });
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
  'reprezentant_rodzice', 'reprezentant_pesel', 'reprezentant_email',
  // B2/B3 (FAZA 2, migracja 53) — patrz komentarz w server/trasy/spolki.js.
  'reprezentant_dowod_rodzaj', 'reprezentant_dowod_numer',
  'reprezentant_kraj', 'reprezentant_kod_pocztowy', 'reprezentant_miejscowosc',
  'reprezentant_ulica', 'reprezentant_nr_domu', 'reprezentant_nr_lokalu',
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

/**
 * B8 (FAZA 2 sesji frontendowej): konto roli „spolka" prowadzi już
 * przynajmniej jedną spółkę, ale może mieć RÓWNOLEGLE otwarty wniosek o
 * KOLEJNĄ (patrz `POST /wniosek/nowy` i `psa_konta_spolki` — jeden klient,
 * wiele spółek, D-037). Bramka więc puszcza obie role; auto-zakładanie
 * wniosku (`wczytajLubZalozWniosek`) zostaje wyłącznie dla „wnioskodawcy" —
 * konto „spolka" dostaje pusty wniosek WYŁĄCZNIE po świadomym kliknięciu
 * „Dodaj spółkę", nigdy przy samym wejściu na zakładkę.
 */
function wymagajWnioskodawcy(zad, odp, dalej) {
  if (!['wnioskodawca', 'spolka'].includes(zad.konto.rola)) {
    return dalej(brakUprawnien('Ta operacja jest dostępna wyłącznie dla wniosków o prowadzenie rejestru.'));
  }
  dalej();
}

/**
 * Otwarty (edytowalny) wniosek konta — jedyny, bo `POST /wniosek/nowy`
 * odmawia założenia drugiego, dopóki poprzedni jest w toku (patrz niżej).
 * Bez tego filtra `WHERE konto_id = ?` bez `ORDER BY`/warunku statusu
 * trafiałby, dla konta „spolka", na jego STARY, już przyjęty wniosek
 * pierwszej spółki — przypadkowo, bo SQLite nie gwarantuje kolejności bez
 * `ORDER BY`.
 */
function wczytajOtwartyWniosekKonta(kontoId) {
  // „Otwarty" = jeszcze nie zamknięty (art. 300³² § 1 KSH: umowa ZAWARTA
  // dopiero wpisem) — nie tylko dwa pierwsze statusy. Klient wraca do TEGO
  // SAMEGO wniosku przez całą resztę ścieżki (złożony, dokumenty
  // wygenerowane, umowa podpisana), więc filtr musi obejmować wszystkie
  // stany oprócz dwóch KOŃCOWYCH — dokładnie jak w `GET /moje`.
  return db()
    .prepare(
      `SELECT * FROM psa_wnioski WHERE konto_id = ? AND status NOT IN ('przyjety', 'odrzucony')
        ORDER BY id DESC LIMIT 1`
    )
    .get(kontoId);
}

/**
 * Wczytuje otwarty wniosek konta, zakładając pusty przy pierwszym użyciu —
 * WYŁĄCZNIE dla „wnioskodawcy" (jeszcze nie ma żadnej spółki, więc pierwsze
 * dotknięcie zakładki ma sens jako początek jedynego wniosku, jaki może
 * mieć). Konto „spolka" zakłada nowy wniosek jawnie, przez `POST
 * /wniosek/nowy` — inaczej samo wejście na zakładkę „Wniosek" cicho
 * zakładałoby drugą spółkę, której nikt nie poprosił.
 */
function wczytajLubZalozWniosek(zad) {
  const otwarty = wczytajOtwartyWniosekKonta(zad.konto.id);
  if (otwarty) return otwarty;
  if (zad.konto.rola !== 'wnioskodawca') return null;

  // D-062/P2: konto powstale ze zgloszenia (D-047 — KRS tam wymagany) ma juz
  // ten numer w bazie — pierwszy wniosek konta zaczyna z nim, zamiast pytac
  // o niego drugi raz (0.4 pkt 1). Konta zalozone inna droga (zgloszenie_id
  // puste) dostaja wniosek calkiem pusty, jak dotad.
  let krs = null;
  let nazwa = null;
  if (zad.konto.zgloszenie_id) {
    const zgloszenie = db()
      .prepare('SELECT krs, nazwa_spolki FROM psa_zgloszenia WHERE id = ?')
      .get(zad.konto.zgloszenie_id);
    if (zgloszenie) {
      krs = zgloszenie.krs || null;
      nazwa = zgloszenie.nazwa_spolki || null;
    }
  }

  const wynik = db()
    .prepare('INSERT INTO psa_wnioski (konto_id, krs, nazwa, utworzono) VALUES (?, ?, ?, ?)')
    .run(zad.konto.id, krs, nazwa, czas.terazIso());
  return db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(wynik.lastInsertRowid);
}

/**
 * Lista wniosków konta z ich statusami (B8) — konto „spolka" widzi tu
 * historię (przyjęte, odrzucone) obok ewentualnego wniosku w toku; konto
 * „wnioskodawca" ma tu zawsze najwyżej jeden wiersz.
 */
router.get(
  '/wnioski',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wnioski = db()
      .prepare(
        `SELECT id, status, nazwa, krs, reprezentant_imie_nazwisko, reprezentant_funkcja,
                reprezentant_reprezentacja, reprezentant_rodzice, reprezentant_pesel,
                reprezentant_dowod_rodzaj, reprezentant_dowod_numer, reprezentant_kraj,
                reprezentant_kod_pocztowy, reprezentant_miejscowosc, reprezentant_ulica,
                reprezentant_nr_domu, reprezentant_nr_lokalu, reprezentant_email,
                utworzono, zaktualizowano
           FROM psa_wnioski WHERE konto_id = ? ORDER BY id DESC`
      )
      .all(zad.konto.id);
    odp.json({ wnioski });
  })
);

/**
 * Nowy wniosek dla konta, które już prowadzi (przynajmniej) jedną spółkę
 * (B8 — „Dodaj spółkę"). Zalogowany klient nie wraca do publicznego
 * formularza zgłoszenia: od razu dostaje pusty wniosek i kreator z
 * pobraniem danych z KRS, tak jak przy pierwszym wniosku.
 */
router.post(
  '/wniosek/nowy',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    if (zad.konto.rola !== 'spolka') {
      throw bledneZadanie('To konto ma już otwarty wniosek — kontynuuj go w zakładce „Wniosek".');
    }
    const otwarty = wczytajOtwartyWniosekKonta(zad.konto.id);
    if (otwarty) {
      throw bledneZadanie('Masz już wniosek w toku — dokończ go, zanim dodasz kolejną spółkę.');
    }
    const wynik = db()
      .prepare('INSERT INTO psa_wnioski (konto_id, utworzono) VALUES (?, ?)')
      .run(zad.konto.id, czas.terazIso());
    odp.status(201).json({ wniosek: db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(wynik.lastInsertRowid) });
  })
);

router.get(
  '/wniosek',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = wczytajLubZalozWniosek(zad);
    if (!wniosek) throw nieZnaleziono('Brak otwartego wniosku — zacznij od „Dodaj spółkę".');
    odp.json({ wniosek });
  })
);

router.put(
  '/wniosek',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const biezacy = wczytajLubZalozWniosek(zad);
    if (!biezacy) throw nieZnaleziono('Brak otwartego wniosku — zacznij od „Dodaj spółkę".');
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
  'kraj', 'kod_pocztowy', 'miejscowosc', 'ulica', 'nr_domu', 'nr_lokalu',
  'adres_doreczen', 'adres_edoreczen', 'email', 'telefon', 'zgoda_email',
  // Art. 300(33) § 1 pkt 2-5 KSH - patrz logika/akcjonariusz.js.
  ...akcjonariuszLogika.POLA_USTAWOWE,
  // Naprawa Z-151/P-010: OSWIADCZENIE OSOBY (art. 46 ustawy AML), odrebne od
  // `pep`/`pep_opis` wyzej - te dwa pola sa USTALENIEM KANCELARII i celowo
  // NIE przechodza z wniosku do kartoteki (patrz trasy/wnioski.js: przyjmij).
  'pep_oswiadczenie', 'pep_oswiadczenie_data',
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
    // Kolumna NOT NULL z domyslna 'Polska' (migracja 52) - puste pole kraju
    // znaczy to samo, co domyslna wartosc w formularzu.
    if (pole === 'kraj' && !wynik[pole]) wynik[pole] = 'Polska';
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
  // Oswiadczenie PEP (art. 46 ustawy AML) - skladane przez OSOBE, stad
  // katalog zamkniety tak/nie (ten sam co na kartotece, patrz trasy/osoby.js).
  if (dane.pep_oswiadczenie && !['tak', 'nie'].includes(dane.pep_oswiadczenie)) {
    throw bledneZadanie('Oświadczenie PEP musi być „tak” albo „nie”.');
  }
  if (dane.pep_oswiadczenie_data && !czas.poprawnaData(dane.pep_oswiadczenie_data)) {
    throw bledneZadanie('Data oświadczenia PEP musi mieć format RRRR-MM-DD.');
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
  const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
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
    const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
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
 * Kompletnosc danych akcjonariuszy JEST tu twardo blokowana. Miekkie
 * ostrzezenia zostaja przy KAZDYM ZAPISIE (regula ogolna nr 3 - formularz
 * wypelnia sie etapami), ale zlozenie wniosku to juz faktyczna operacja:
 * kancelaria nie ma skad wziac PESEL-u ani adresu akcjonariusza, ktorego
 * nigdy nie zobaczy. Brakow nie da sie wiec "uzupelnic przy weryfikacji" -
 * wracaja do klienta, zanim wniosek w ogole zostanie zlozony.
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

    // Braki wobec art. 300(33) § 1 KSH liczymy na KOMPLETNYM wierszu, przy
    // skladaniu - nie przy kazdym zapisie. Blokuja zlozenie: brakujace dane
    // sa w posiadaniu wylacznie klienta.
    const brakiAkcjonariuszy = akcjonariusze.flatMap((a) => akcjonariuszLogika.ostrzezenia(a));
    if (brakiAkcjonariuszy.length > 0) {
      throw bledneZadanie('Dane niepełne — wymagane uzupełnienie.', brakiAkcjonariuszy);
    }

    const teraz = czas.terazIso();
    db().prepare('UPDATE psa_wnioski SET status = ?, zaktualizowano = ? WHERE id = ?').run('zlozony', teraz, wniosek.id);

    odp.json({
      wniosek: db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(wniosek.id),
      braki_akcjonariuszy: [],
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
    const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
    // Adres usługi podpisu — parametr konfiguracji (W3.2), nie stała w widoku.
    const k = ustawienia.kancelaria(db());
    const podpis = {
      mobywatel_url: konfiguracja.PODPIS.mobywatel_url,
      pz_url: konfiguracja.PODPIS.pz_url,
      // Oryginał pocztą (D-087) — adres z ustawień kancelarii.
      adres_kancelarii: [k.nazwa, k.kancelaria_ulica, [k.kancelaria_kod, k.kancelaria_miasto].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null,
    };
    if (!wniosek) return odp.json({ dokumenty: [], podpis });
    odp.json({ dokumenty: wczytajDokumentyWniosku(wniosek.id), podpis });
  })
);

router.get(
  '/wniosek/dokumenty/:id',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
    if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
    const dokument = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE id = ? AND wniosek_id = ? AND udostepniono IS NOT NULL')
      .get(Number(zad.params.id), wniosek.id);
    if (!dokument) throw nieZnaleziono('Nie odnaleziono dokumentu.');
    // B6 — ślad pierwszego otwarcia (i sygnał dla licznika w nawigacji).
    pakietWniosku.oznaczOtwarte(wniosek.id, dokument.id);
    wyslijPlikDokumentu(odp, dokument.sciezka, dokument.nazwa_pliku);
  })
);

router.get(
  '/wniosek/umowa-projekt',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
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

// D-075: skan nie jest podpisem. Obrazy przyjmujemy na serwer tylko po to,
// zeby odpowiedziec klientowi zrozumialym komunikatem (walidator je odrzuca).
const ROZSZERZENIA_PODPISU_DOZWOLONE = new Set(['.pdf', '.xml', '.xades', '.jpg', '.jpeg', '.png']);
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
        new Error(`Niedozwolone rozszerzenie pliku: „${rozszerzenie}”. Wgraj plik z podpisem elektronicznym (PDF albo XML z mObywatela, podpisu zaufanego lub osobistego).`)
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
    // Naprawa Z-254: blad multera idzie nieopakowany do posrednikaBledow, zeby
    // zadzialala tam przetlumaczona galaz `blad.name === 'MulterError'`; blad
    // z fileFilter (juz po polsku) trzeba owinac w BladZadanie, inaczej
    // trafia do ogolnego 500 zamiast 400.
    if (e) return dalejPoUploadzie(dalej)(e);
    if (zad.file && !pliki.trescPasuje(zad.file.path, pliki.typZNazwy(zad.file.originalname))) {
      fs.rmSync(zad.file.path, { force: true });
      return dalej(bledneZadanie(
        'Treść pliku nie odpowiada jego rozszerzeniu. Prześlij skan jako PDF, JPG albo PNG.'
      ));
    }
    return dalej();
  });
}

/** Multer dla pliku PODPISANEGO — walidacje tresci robi walidator podpisu (D-075). */
function przyjmijPodpisany(zad, odp, dalej) {
  uploadPodpisanego.single('plik')(zad, odp, (e) => {
    if (e) return dalejPoUploadzie(dalej)(e);
    return dalej();
  });
}

/**
 * Podstawowy test po wgraniu (W2.4, D-086): czy plik ma podpis elektroniczny
 * i czy pierwsza wersja to dokument wystawiony przez kancelarie (W3.4).
 * Odrzucony plik nie zostaje na dysku — klient dostaje komunikat zrozumialy
 * dla laika. Plik z podpisem trafia do „Do zrobienia” — reszte sprawdza
 * pracownik; checklisty nie zaznacza (D-052).
 */
async function walidujPodpisany(wniosek, dokument, plik) {
  const wynik = await walidacjaPodpisu.waliduj({
    plik: fs.readFileSync(plik.path),
    oryginal: { sha256: dokument.oryginal_sha256, dlugosc: dokument.oryginal_dlugosc },
    atrapa: () => trybTestowy.wynikWalidatora(db()),
  });
  if (wynik.wynik === walidacjaPodpisu.WYNIKI.ODRZUCONY) {
    fs.rmSync(plik.path, { force: true });
    throw bledneZadanie(wynik.komunikat, { walidacja: wynik });
  }
  return wynik;
}

function zapiszWalidacje(dokumentId, wynik) {
  db()
    .prepare(
      `UPDATE psa_wnioski_dokumenty
          SET walidacja_wynik = ?, walidacja_typ = ?, walidacja_json = ?, walidacja_kiedy = ?
        WHERE id = ?`
    )
    .run(wynik.wynik, wynik.typ || null, JSON.stringify(wynik), czas.terazIso(), dokumentId);
}

/**
 * Stany, w ktorych klient moze jeszcze odsylac podpisane skany. Po przyjeciu
 * albo odrzuceniu wniosku komplet jest zamkniety; przed wygenerowaniem
 * dokumentow nie ma czego odsylac.
 */
const STATUSY_PRZYJMUJACE_PODPISY = new Set(['umowa_wygenerowana']);

/** Wstrzykuje wniosek do `zad` PRZED multerem - potrzebny do wyznaczenia katalogu docelowego. */
function zaladujWlasnyWniosekDoUploadu(zad, odp, dalej) {
  const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
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
 * Samo wgranie NIE przenosi statusu wniosku i NIE stawia go w kolejce
 * kancelarii. Klient zalacza po kolei osiem skanow, sprawdza je i dopiero
 * wtedy odsyla komplet (`POST /wniosek/odeslij`). Dotad wgranie umowy —
 * czesto pierwszego z osmiu plikow — samo przestawialo status na
 * `umowa_podpisana`, czyli wrzucalo do kancelarii wniosek, do ktorego
 * brakowalo jeszcze siedmiu podpisow, i klient nie mial jak tego cofnac
 * inaczej niz kasujac skan.
 *
 * Umowa niesie dodatkowo kolumny `umowa_podpisana_*` — to ona jest umowa
 * o prowadzenie rejestru, bez ktorej nie ma czego przyjmowac — wiec przy
 * niej, i tylko przy niej, wypelniamy takze je.
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
            SET umowa_podpisana_sciezka = ?, umowa_podpisana_nazwa_pliku = ?,
                umowa_podpisana_mime = ?, umowa_podpisana_wgrano = ?, zaktualizowano = ?
          WHERE id = ?`
      )
      .run(sciezka, plik.originalname, plik.mimetype, teraz, teraz, wniosek.id);
  }
}

/**
 * Odeslanie KOMPLETU podpisanych dokumentow — jeden ruch klienta, ktory
 * stawia wniosek w kolejce kancelarii (`status = 'umowa_podpisana'`).
 * Dopiero tutaj, nie przy wgrywaniu kolejnych plikow.
 */
router.post(
  '/wniosek/odeslij',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
    if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
    if (wniosek.status !== 'umowa_wygenerowana') {
      throw bledneZadanie(`Wniosek ma status „${wniosek.status}” — nie ma w tym momencie czego odsyłać.`);
    }

    const dokumenty = pakietWniosku.lista(wniosek.id, { tylkoUdostepnione: true });
    if (dokumenty.length === 0) {
      throw bledneZadanie('Kancelaria nie udostępniła jeszcze dokumentów do podpisu.');
    }
    // D-075: pozycja jest gotowa, gdy ma plik z podpisem elektronicznym albo
    // klient zadeklarowal odeslanie oryginalu pocztą (W3.8).
    const bezSkanu = dokumenty.filter((d) => !d.podpis_nazwa_pliku && !d.oryginal_poczta_zadeklarowano);
    if (bezSkanu.length > 0) {
      throw bledneZadanie(
        'Komplet jest niepełny — przy każdym dokumencie wgraj plik z podpisem albo zaznacz „Wyślę oryginał pocztą”.',
        bezSkanu.map((d) => d.nazwa_pliku)
      );
    }
    const umowaPoczta = dokumenty.some((d) => d.typ === dokumentyWniosku.TYPY.UMOWA_REJESTRU && d.oryginal_poczta_zadeklarowano);
    if (!wniosek.umowa_podpisana_sciezka && !umowaPoczta) {
      throw bledneZadanie('Brakuje podpisanej umowy o prowadzenie rejestru.');
    }

    const teraz = czas.terazIso();
    db()
      .prepare("UPDATE psa_wnioski SET status = 'umowa_podpisana', zaktualizowano = ? WHERE id = ?")
      .run(teraz, wniosek.id);

    odp.json({
      wniosek: db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(wniosek.id),
      dokumenty: wczytajDokumentyWniosku(wniosek.id),
    });
  })
);

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
  const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
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
    const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
    if (!wniosek || !wniosek.dowod_sciezka) throw nieZnaleziono('Nie przesłano jeszcze dokumentu tożsamości.');
    wyslijPlikDokumentu(odp, wniosek.dowod_sciezka, wniosek.dowod_nazwa_pliku);
  })
);

/** Podpisany skan JEDNEGO dokumentu z kompletu. */
router.post(
  '/wniosek/dokumenty/:id/podpis',
  wymagajWnioskodawcy,
  zaladujWlasnyWniosekDoUploadu,
  przyjmijPodpisany,
  asy(async (zad, odp) => {
    if (!zad.file) throw bledneZadanie('Nie przesłano pliku.');
    const dokument = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE id = ? AND wniosek_id = ? AND udostepniono IS NOT NULL')
      .get(Number(zad.params.id), zad.psaWniosek.id);
    if (!dokument) {
      fs.rmSync(zad.file.path, { force: true });
      throw nieZnaleziono('Nie odnaleziono dokumentu.');
    }
    if (dokument.podpis_potwierdzono) {
      fs.rmSync(zad.file.path, { force: true });
      throw bledneZadanie(
        'Ten dokument został już potwierdzony przez kancelarię — nie można podmienić przesłanego skanu. Skontaktuj się z kancelarią.'
      );
    }

    const walidacja = await walidujPodpisany(zad.psaWniosek, dokument, zad.file);
    zapiszPodpisanySkan(zad.psaWniosek, dokument, zad.file);
    zapiszWalidacje(dokument.id, walidacja);
    odp.status(201).json({
      walidacja,
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
    const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
    if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
    const dokument = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE id = ? AND wniosek_id = ? AND udostepniono IS NOT NULL')
      .get(Number(zad.params.id), wniosek.id);
    if (!dokument || !dokument.podpis_sciezka) throw nieZnaleziono('Nie odesłano jeszcze tego dokumentu.');
    wyslijPlikDokumentu(odp, dokument.podpis_sciezka, dokument.podpis_nazwa_pliku);
  })
);

/**
 * Zdjecie zalaczonego skanu - klient zorientowal sie, ze wgral nie ten plik
 * albo nieczytelny. Mozliwe TYLKO przed odeslaniem kompletu; przy umowie
 * czysci tez kolumny `umowa_podpisana_*`.
 */
router.delete(
  '/wniosek/dokumenty/:id/podpis',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
    if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
    if (!STATUSY_PRZYJMUJACE_PODPISY.has(wniosek.status)) {
      throw bledneZadanie(`Wniosek ma status „${wniosek.status}” — nie można już zmieniać przesłanych dokumentów.`);
    }
    const dokument = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE id = ? AND wniosek_id = ? AND udostepniono IS NOT NULL')
      .get(Number(zad.params.id), wniosek.id);
    if (!dokument || !dokument.podpis_sciezka) throw nieZnaleziono('Nie odesłano jeszcze tego dokumentu.');
    if (dokument.podpis_potwierdzono) {
      throw bledneZadanie(
        'Ten dokument został już potwierdzony przez kancelarię — nie można usunąć przesłanego skanu. Skontaktuj się z kancelarią.'
      );
    }

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
              SET umowa_podpisana_sciezka = NULL, umowa_podpisana_nazwa_pliku = NULL,
                  umowa_podpisana_mime = NULL, umowa_podpisana_wgrano = NULL, zaktualizowano = ?
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
 * W3.8 — „Wyślę oryginał pocztą” zamiast pliku z podpisem elektronicznym.
 * Tylko przy dokumentach, dla ktorych oryginal jest dopuszczalna forma
 * (formy-podpisu.js); otrzymanie i rodzaj podpisu odnotowuje kancelaria.
 */
router.post(
  '/wniosek/dokumenty/:id/oryginal-poczta',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
    if (!wniosek) throw nieZnaleziono('Nie odnaleziono wniosku.');
    if (!STATUSY_PRZYJMUJACE_PODPISY.has(wniosek.status)) {
      throw bledneZadanie(`Wniosek ma status „${wniosek.status}” — nie można już zmieniać przesłanych dokumentów.`);
    }
    const dokument = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE id = ? AND wniosek_id = ? AND udostepniono IS NOT NULL')
      .get(Number(zad.params.id), wniosek.id);
    if (!dokument) throw nieZnaleziono('Nie odnaleziono dokumentu.');
    const papierowe = formyPodpisu.formyPapierowe(formyPodpisu.typDlaDokumentuWniosku(dokument.typ))
      .filter((f) => f !== formyPodpisu.FORMY.W_KANCELARII);
    if (papierowe.length === 0) throw bledneZadanie('Ten dokument trzeba podpisać elektronicznie.');
    const wysylam = (zad.body || {}).wysylam !== false;
    db().prepare('UPDATE psa_wnioski_dokumenty SET oryginal_poczta_zadeklarowano = ? WHERE id = ?')
      .run(wysylam ? czas.terazIso() : null, dokument.id);
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
  przyjmijPodpisany,
  asy(async (zad, odp) => {
    if (!zad.file) throw bledneZadanie('Nie przesłano pliku.');
    const umowa = db()
      .prepare('SELECT * FROM psa_wnioski_dokumenty WHERE wniosek_id = ? AND typ = ? AND udostepniono IS NOT NULL')
      .get(zad.psaWniosek.id, dokumentyWniosku.TYPY.UMOWA_REJESTRU);
    if (!umowa) throw nieZnaleziono('Projekt umowy nie został jeszcze wygenerowany.');
    if (umowa.podpis_potwierdzono) {
      fs.rmSync(zad.file.path, { force: true });
      throw bledneZadanie(
        'Ten dokument został już potwierdzony przez kancelarię — nie można podmienić przesłanego skanu. Skontaktuj się z kancelarią.'
      );
    }

    const walidacja = await walidujPodpisany(zad.psaWniosek, umowa, zad.file);
    zapiszPodpisanySkan(zad.psaWniosek, umowa, zad.file);
    zapiszWalidacje(umowa.id, walidacja);
    odp.status(201).json({
      walidacja,
      wniosek: db().prepare('SELECT * FROM psa_wnioski WHERE id = ?').get(zad.psaWniosek.id),
      dokumenty: wczytajDokumentyWniosku(zad.psaWniosek.id),
    });
  })
);

router.get(
  '/wniosek/umowa-podpisana',
  wymagajWnioskodawcy,
  asy((zad, odp) => {
    const wniosek = wczytajOtwartyWniosekKonta(zad.konto.id);
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
        'SELECT MAX(data_wpisu) AS data FROM psa_zdarzenia WHERE spolka_id = ?'
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
/**
 * Zakładka „Rejestr” — WYŁĄCZNIE dane spółki (D-077, W5.1). Stan akcjonariatu
 * jest tylko w płatnej informacji z rejestru (art. 300(35) § 3 KSH). Odcięcie
 * na poziomie API, nie widoku — akcjonariusze nie wychodzą z tej trasy wcale.
 */
const POLA_SPOLKI_PORTAL = [
  'id', 'nazwa', 'krs', 'nip', 'regon', 'forma_prawna', 'kraj', 'kod_pocztowy', 'miejscowosc', 'ulica',
  'nr_domu', 'nr_lokalu', 'sad_rejestrowy', 'wydzial', 'status', 'data_utworzenia_spolki',
  'data_otwarcia_rejestru', 'kapital_akcyjny_grosze',
];

router.get(
  '/rejestr/:spolkaId',
  asy((zad, odp) => {
    // Dostep do tej spolki juz sprawdzony przez `wymagajDostepuDoSpolki` wyzej.
    const spolka = rejestr.wczytajSpolke(db(), Number(zad.params.spolkaId));
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');
    odp.json({
      spolka: Object.fromEntries(POLA_SPOLKI_PORTAL.map((k) => [k, spolka[k] ?? null])),
      akcjonariat_w_informacji: true,
    });
  })
);

/**
 * Zakładka „Dokumenty" widoku spółki (Faza 4 pkt 1) — zawiadomienia
 * o wpisie/odmowie, wydane informacje z rejestru i umowa o prowadzenie
 * rejestru, wysłane kanałem „portal" (`psa_wydane_dokumenty.kanal`).
 * Dokumenty bez `odbiorca_osoba_id` sa adresowane do spółki (widzi je rola
 * „spolka"); z odbiorcą — wyłącznie ten akcjonariusz.
 */
router.get(
  '/spolka/:spolkaId/dokumenty',
  asy((zad, odp) => {
    const spolkaId = Number(zad.params.spolkaId);
    const wiersze = db()
      .prepare(
        `SELECT id, typ, sciezka_plik, wyslano, utworzono, odbiorca_osoba_id
           FROM psa_wydane_dokumenty
          WHERE spolka_id = ? AND kanal = 'portal'
            AND (odbiorca_osoba_id IS NULL OR odbiorca_osoba_id = ?)
          ORDER BY id DESC`
      )
      .all(spolkaId, zad.konto.osoba_id ?? -1);
    odp.json({
      dokumenty: wiersze.map((d) => ({
        id: d.id,
        typ: d.typ,
        data: d.wyslano || d.utworzono,
        pobierz: d.sciezka_plik ? `/api/psa/portal/spolka/${spolkaId}/dokumenty/${d.id}/plik` : null,
      })),
    });
  })
);

router.get(
  '/spolka/:spolkaId/dokumenty/:id/plik',
  asy((zad, odp) => {
    const spolkaId = Number(zad.params.spolkaId);
    const dokument = db()
      .prepare(
        `SELECT * FROM psa_wydane_dokumenty
          WHERE id = ? AND spolka_id = ? AND kanal = 'portal'
            AND (odbiorca_osoba_id IS NULL OR odbiorca_osoba_id = ?)`
      )
      .get(Number(zad.params.id), spolkaId, zad.konto.osoba_id ?? -1);
    if (!dokument || !dokument.sciezka_plik) throw nieZnaleziono('Nie odnaleziono pliku.');

    const pelnaSciezka = path.join(konfiguracja.KATALOG_DOKUMENTOW, dokument.sciezka_plik);
    if (!pelnaSciezka.startsWith(konfiguracja.KATALOG_DOKUMENTOW) || !fs.existsSync(pelnaSciezka)) {
      throw nieZnaleziono('Plik nie jest już dostępny.');
    }

    dziennikDostepu.zapisz(db(), {
      kto: `Portal — ${zad.konto.email}`, typKto: 'portal', spolkaId, osobaId: zad.konto.osoba_id,
      akcja: dziennikDostepu.AKCJE.POBRANIE_PLIKU, opis: `wydany dokument #${dokument.id} (${dokument.typ})`,
    });
    odp.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    odp.setHeader('Content-Disposition', `attachment; filename="${path.basename(pelnaSciezka).replace(/^[^-]+-/, '')}"`);
    odp.sendFile(pelnaSciezka);
  })
);

// ─────────────────────────────────────────────────────────────
// Skan dokumentu AML — samodzielne wgranie przez akcjonariusza (P-012)
//
// Dotad jedyna droga do skanu dokumentu tozsamosci byla `POST
// /api/psa/osoby/:id/aml-skany`, za `wymagajPracownika` — dokument i tak
// krazyl mailem (najslabszym kanalem w calym procesie), zanim pracownik
// go tam wgral. Ten endpoint pozwala akcjonariuszowi wgrac WYLACZNIE
// WLASNY skan, ten sam rezim hasha/retencji/miejsca na dysku co kartoteka
// pracownika (`trasy/osoby.js`) — obie drogi skladaja sie w JEDNA liste.
// ─────────────────────────────────────────────────────────────

const uploadWlasnegoSkanuAml = multer({
  storage: multer.diskStorage({
    destination(zad, plik, wywolaj) {
      const katalog = osobyModul.katalogSkanowAml(zad.konto.osoba_id);
      fs.mkdirSync(katalog, { recursive: true });
      wywolaj(null, katalog);
    },
    filename(zad, plik, wywolaj) {
      const bezpiecznaNazwa = path.basename(plik.originalname).replace(/[^\w.\- ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gu, '_');
      wywolaj(null, `${crypto.randomUUID()}-${bezpiecznaNazwa}`);
    },
  }),
  limits: { fileSize: osobyModul.LIMIT_ROZMIARU_SKANU_AML_BAJTY, files: 1 },
  fileFilter(zad, plik, wywolaj) {
    const rozszerzenie = path.extname(plik.originalname).toLowerCase();
    if (!osobyModul.ROZSZERZENIA_SKANU_AML_DOZWOLONE.has(rozszerzenie)) {
      return wywolaj(new Error(`Niedozwolone rozszerzenie pliku: „${rozszerzenie}”. Dozwolone: PDF, JPG, PNG.`));
    }
    wywolaj(null, true);
  },
});

/** Wylacznie rola "akcjonariusz" ma wlasna osobe (i wlasny skan do wgrania). */
function wymagajAkcjonariusza(zad, odp, dalej) {
  if (zad.konto.rola !== 'akcjonariusz') {
    return dalej(brakUprawnien('Tylko akcjonariusz może wgrać własny skan dokumentu.'));
  }
  dalej();
}

router.get(
  '/aml-skany',
  wymagajAkcjonariusza,
  asy((zad, odp) => {
    const skany = db()
      .prepare(
        `SELECT id, spolka_id, typ_dokumentu, nazwa_pliku, rozmiar, retencja_do, utworzono
           FROM psa_osoby_skany_aml WHERE osoba_id = ? ORDER BY utworzono DESC`
      )
      .all(zad.konto.osoba_id);
    odp.json({ skany });
  })
);

router.post(
  '/aml-skany/:spolkaId',
  wymagajAkcjonariusza,
  // Kolejnosc jak w trasy/osoby.js: multer NAJPIERW (destynacja pliku zalezy
  // tylko od `zad.konto.osoba_id`, znanego juz z sesji), wlaczona procedura
  // AML sprawdzana PO uploadzie - a gdy sie nie powiedzie, plik jest kasowany.
  // Dostep do `:spolkaId` juz sprawdzony przez `router.param` wyzej.
  // Naprawa Z-254: blad multera idzie nieopakowany, zeby zadzialala
  // przetlumaczona galaz "MulterError"; blad z fileFilter (juz po polsku)
  // staje sie 400, a nie ogolnym 500.
  (zad, odp, dalej) => uploadWlasnegoSkanuAml.single('plik')(zad, odp, dalejPoUploadzie(dalej)),
  asy((zad, odp) => {
    const spolkaId = Number(zad.params.spolkaId);
    const spolka = db().prepare('SELECT id, stosuje_procedure_aml FROM psa_spolki WHERE id = ?').get(spolkaId);
    if (!spolka || !spolka.stosuje_procedure_aml) {
      if (zad.file) fs.rm(zad.file.path, { force: true }, () => {});
      throw bledneZadanie('Ta spółka nie ma włączonej procedury AML — skany dokumentów nie są zbierane.');
    }
    if (!zad.file) throw bledneZadanie('Nie przesłano pliku.');
    // Naprawa Z-253: kontrola SYGNATURY tresci, nie samego rozszerzenia -
    // ten sam wymog co na kazdej innej trasie uploadu.
    if (!pliki.trescPasuje(zad.file.path, pliki.typZNazwy(zad.file.originalname))) {
      fs.rmSync(zad.file.path, { force: true });
      throw bledneZadanie(`Treść pliku „${zad.file.originalname}" nie odpowiada jego rozszerzeniu. Prześlij PDF albo zdjęcie.`);
    }
    const typDokumentu = String((zad.body || {}).typ_dokumentu || 'inny');
    if (!osobyModul.TYPY_DOKUMENTU_AML.includes(typDokumentu)) {
      throw bledneZadanie(`Nieznany typ dokumentu: „${typDokumentu}”.`);
    }

    const hash = crypto.createHash('sha256').update(fs.readFileSync(zad.file.path)).digest('hex');
    const wynik = db()
      .prepare(
        `INSERT INTO psa_osoby_skany_aml
           (osoba_id, spolka_id, typ_dokumentu, nazwa_pliku, sciezka, mime, rozmiar, hash, wgral, utworzono)
         VALUES (@osoba_id, @spolka_id, @typ_dokumentu, @nazwa_pliku, @sciezka, @mime, @rozmiar, @hash, @wgral, @utworzono)`
      )
      .run({
        osoba_id: zad.konto.osoba_id,
        spolka_id: spolkaId,
        typ_dokumentu: typDokumentu,
        nazwa_pliku: zad.file.originalname,
        sciezka: path.relative(konfiguracja.KATALOG_DOKUMENTOW, zad.file.path),
        mime: zad.file.mimetype,
        rozmiar: zad.file.size,
        hash,
        wgral: `Portal — ${zad.konto.email}`,
        utworzono: czas.terazIso(),
      });

    odp.status(201).json({
      skan: db()
        .prepare('SELECT id, spolka_id, typ_dokumentu, nazwa_pliku, rozmiar, utworzono FROM psa_osoby_skany_aml WHERE id = ?')
        .get(wynik.lastInsertRowid),
    });
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
    const oplatyWgSprawy = new Map(
      db()
        .prepare(
          `SELECT sprawa_id, id, status, kwota_grosze, stawka_vat_procent FROM psa_oplaty
            WHERE sprawa_id IS NOT NULL AND typ = 'wpis' AND status != 'anulowana'`
        )
        .all()
        .map((o) => [o.sprawa_id, o])
    );
    odp.json({
      sprawy: wiersze.map((s) => {
        const oplata = oplatyWgSprawy.get(s.id) || null;
        return {
          ...widokSprawyPortal(s, dzis),
          spolka_nazwa: s.spolka_nazwa,
          oczekuje_na_oplate: s.oczekuje_na_oplate === 1,
          oplata_id: oplata ? oplata.id : null,
          oplata_status: oplata ? oplata.status : null,
          // Klient widzi BRUTTO (sekcja 2.1) - to kwota, ktora placi.
          oplata_grosze: oplata ? przepisy.obliczBrutto(oplata.kwota_grosze, oplata.stawka_vat_procent) : null,
        };
      }),
    });
  })
);

/**
 * Założenie żądania wpisu z portalu — jedna droga dla formularza „Zgłoś
 * zmianę” i dla oświadczenia o zgodzie na komunikację e-mail (W4.1):
 * te same opłaty, termin i kolejka kancelarii. `odp` może być przechwytem.
 */
function zalozZadaniePortalowe(konto, cialo, odp) {

  // Naprawa Z-351/Z-353: klucz idempotencyjny wyslany PONOWNIE (podwojne
  // klikniecie, ponowienie po zerwanym polaczeniu) oddaje JUZ zalozona
  // sprawe (i jej JUZ naliczona oplate) zamiast zakladac druga sprawe
  // i podwojnie obciazyc klienta za ten sam wpis.
  const kluczIdempotencji = cialo.klucz_idempotencji ? String(cialo.klucz_idempotencji).trim() : null;
  if (kluczIdempotencji) {
    const istniejaca = db().prepare('SELECT id FROM psa_sprawy WHERE klucz_idempotencji = ?').get(kluczIdempotencji);
    if (istniejaca) {
      const sprawaIstniejaca = db().prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(istniejaca.id);
      const oplataIstniejaca = db()
        .prepare(`SELECT id FROM psa_oplaty WHERE sprawa_id = ? AND typ = 'wpis' AND status != 'anulowana'`)
        .get(istniejaca.id);
      return odp.status(200).json({
        sprawa: widokSprawyPortal(sprawaIstniejaca),
        oplata_id: oplataIstniejaca ? oplataIstniejaca.id : null,
        juz_istniala: true,
      });
    }
  }

  // Dostep do tej spolki juz sprawdzony przez `wymagajDostepuDoSpolki` wyzej.
  const spolkaId = Number(cialo.spolka_id);
  const spolka = rejestr.wczytajSpolke(db(), spolkaId);
  if (!spolka) throw bledneZadanie('Nie odnaleziono spółki.');
  const blokada = przepisy.blokadaWpisu(spolka);
  if (blokada) throw bledneZadanie(`${blokada} Nie można zgłosić nowej sprawy.`);
  // W7.5 — spółka w trakcie przeniesienia rejestru (przed skutecznością: odmowa; potem: przeszkoda).
  const przejecieSprawy = require('../przeniesienia').stanDlaSpraw(db(), spolkaId);
  if (przejecieSprawy && przejecieSprawy.blokada) throw bledneZadanie(przejecieSprawy.blokada);

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
    klucz_idempotencji: kluczIdempotencji,
    utworzono: czas.terazIso(),
  };
  dane.termin_do = terminy.policzTermin(
    { data_wplywu: dataWplywu.slice(0, 10), stan: 'nowa', wstrzymana_od: null, wznowiona_od: null },
    czas.dzisIso()
  ).termin_do;

  // ── Zadanie zlozone przez portal jest skuteczne z chwila OPLACENIA ──
  //
  // Art. 300(34) § 1 KSH liczy tydzien od OTRZYMANIA zadania. Umowa
  // o prowadzenie rejestru stanowi, ze zadanie skladane przez portal
  // dochodzi do skutku z chwila zaplaty — do tego czasu sprawa nie jest
  // widoczna w kolejce kancelarii i ZADEN termin ustawowy nie biegnie.
  //
  // To NIE jest wstrzymywanie czynnosci ustawowej za dlugi: zadania
  // zlozonego jeszcze nie ma. Klient, ktory chce zlozyc je natychmiast,
  // ma otwarta droge papierowa i mailowa — wtedy sprawa rusza od razu,
  // a oplate rozlicza faktura (`server/trasy/sprawy.js`).
  //
  // WYJATEK: gdy platnosci online sa wylaczone, bramka nie obowiazuje.
  // Inaczej awaria operatora albo brak konfiguracji zamienialaby portal
  // w czarna dziure — zadanie zapisane, nikomu niepokazane, a klient
  // przekonany, ze zlozyl. Wtedy zadanie jest skuteczne od razu, a oplate
  // rozlicza faktura; to ta sama sciezka, co przy zadaniu papierowym.
  dane.oczekuje_na_oplate = tpay.skonfigurowany() ? 1 : 0;

  const kolumny = Object.keys(dane);
  let wynik;
  try {
    wynik = db()
      .prepare(`INSERT INTO psa_sprawy (${kolumny.join(', ')}) VALUES (${kolumny.map((k) => `@${k}`).join(', ')})`)
      .run(dane);
  } catch (e) {
    // Ostatnia linia obrony przed wyscigiem: dwa naprawde ROWNOCZESNE
    // zadania z tym samym kluczem moga oba minac SELECT wyzej, zanim
    // ktorykolwiek INSERT sie wykona - indeks unikalny to wtedy lapie tutaj.
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' && kluczIdempotencji) {
      const wygrana = db().prepare('SELECT * FROM psa_sprawy WHERE klucz_idempotencji = ?').get(kluczIdempotencji);
      if (wygrana) {
        const oplataWygranej = db()
          .prepare(`SELECT id FROM psa_oplaty WHERE sprawa_id = ? AND typ = 'wpis' AND status != 'anulowana'`)
          .get(wygrana.id);
        return odp.status(200).json({
          sprawa: widokSprawyPortal(wygrana),
          oplata_id: oplataWygranej ? oplataWygranej.id : null,
          juz_istniala: true,
        });
      }
    }
    throw e;
  }
  const sprawaId = Number(wynik.lastInsertRowid);

  // Oplata za wpis powstaje RAZEM ze sprawa i jest z nia zwiazana — to po
  // niej `server/platnosci.js` wie, ktora sprawe uruchomic po zaplacie.
  const oplata = typ.odplatne === false
    ? null
    : oplaty.naliczOplateWpisu(db(), {
      spolkaId,
      sprawaId,
      typZdarzenia: typZdarzenia,
      autor: `Portal — ${konto.email}`,
    });

  // Czynnosc wolna od oplaty (art. 300(34) § 2 KSH — wpis z urzedu) nie ma
  // na co czekac: zadanie jest skuteczne od razu.
  if (!oplata) {
    db().prepare('UPDATE psa_sprawy SET oczekuje_na_oplate = 0 WHERE id = ?').run(sprawaId);
  }

  const sprawa = db().prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(sprawaId);
  if (przejecieSprawy && przejecieSprawy.przeszkoda) {
    require('../przeniesienia').wstrzymajZPrzeszkoda(db(), sprawaId, przejecieSprawy.przeszkoda);
  }
  odp.status(201).json({
    sprawa: widokSprawyPortal(db().prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(sprawaId)),
    oplata_id: oplata ? oplata.id : null,
  });
}

router.post('/zadania', asy((zad, odp) => zalozZadaniePortalowe(zad.konto, zad.body || {}, odp)));

// ─────────────────────────────────────────────────────────────
// Faza 4 — przeniesienie rejestru (W7.1–W7.5) widziane przez spółkę:
// status, przypomnienia, dokumenty startowe, wzór uchwały, pakiet pism.
// ─────────────────────────────────────────────────────────────

const uploadPrzeniesienia = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 } });
const PISMA_DLA_SPOLKI = ['przeniesienie_uchwala', 'przeniesienie_wypowiedzenie', 'przeniesienie_potwierdzenie_zawarcia',
  'przeniesienie_wezwanie', 'przeniesienie_zgloszenie_krs'];

function przeniesienieKonta(konto) {
  const modul = require('../przeniesienia');
  let p = modul.dlaKonta(db(), konto);
  if (p && !p.wniosek_id) {
    const wn = db().prepare('SELECT id FROM psa_wnioski WHERE konto_id = ? ORDER BY id DESC LIMIT 1').get(konto.id);
    if (wn) { modul.powiazWniosek(db(), p.id, wn.id); p = modul.wczytaj(db(), p.id); }
  }
  return p;
}

function pismaDlaSpolki(p) {
  const modul = require('../przeniesienia');
  const poZawarciu = !['zgloszone', 'weryfikacja'].includes(p.status);
  return modul.listaPism(db(), p).filter((x) => PISMA_DLA_SPOLKI.includes(x.kod)
    && (poZawarciu || x.kod === 'przeniesienie_uchwala'));
}

router.get('/przeniesienie', asy((zad, odp) => {
  const p = przeniesienieKonta(zad.konto);
  if (!p) return odp.json({ przeniesienie: null });
  odp.json({
    przeniesienie: {
      id: p.id, status: p.status, nazwa_statusu: p.nazwa_statusu, nazwa: p.nazwa, krs: p.krs,
      poprzednik_nazwa: p.poprzednik_nazwa, poprzednik_opis: p.poprzednik_opis,
      data_zawarcia_umowy: p.data_zawarcia_umowy, data_skutecznosci: p.data_skutecznosci, termin_warunku: p.termin_warunku,
      przypomnienia: p.przypomnienia,
      dokumenty: p.dokumenty.map((d) => ({ id: d.id, typ: d.typ, zrodlo: d.zrodlo, nazwa_pliku: d.nazwa_pliku, utworzono: d.utworzono })),
      pisma: pismaDlaSpolki(p),
    },
  });
}));

router.post('/przeniesienie/dokumenty', uploadPrzeniesienia.single('plik'), asy((zad, odp) => {
  const p = przeniesienieKonta(zad.konto);
  if (!p) throw nieZnaleziono('Nie zgłoszono przeniesienia rejestru.');
  const typ = String((zad.body || {}).typ || '');
  if (!['umowa_spolki', 'informacja_poprzednika', 'uchwala', 'wypowiedzenie', 'potwierdzenie_rozwiazania'].includes(typ)) {
    throw bledneZadanie('Nieznany rodzaj dokumentu.');
  }
  if (!zad.file) throw bledneZadanie('Nie przesłano pliku.');
  require('../przeniesienia').dodajDokument(db(), p.id, {
    typ, zrodlo: 'klient', nazwa: zad.file.originalname, bufor: zad.file.buffer, autor: `Portal — ${zad.konto.email}`,
  });
  odp.status(201).json({ ok: true });
}));

router.get('/przeniesienie/pisma/:kod', asy((zad, odp) => {
  const p = przeniesienieKonta(zad.konto);
  if (!p) throw nieZnaleziono('Nie zgłoszono przeniesienia rejestru.');
  if (!pismaDlaSpolki(p).some((x) => x.kod === zad.params.kod)) throw nieZnaleziono('Pismo nie jest jeszcze dostępne.');
  odp.type('html').send(require('../przeniesienia').renderujPismo(db(), p, zad.params.kod).html);
}));

// ─────────────────────────────────────────────────────────────
// W4.1/W4.2 — oświadczenia akcjonariusza składane OSOBIŚCIE (konto albo link
// z zaproszenia), nigdy przez zarząd w jego imieniu. Każde z datą, odwołalne
// (tabela append-only `psa_oswiadczenia`).
//   - zgoda na komunikację e-mail — dana rejestru (art. 300(33) § 1 pkt 5 KSH):
//     złożenie i cofnięcie idą przez ŻĄDANIE WPISU, nie przez ustawienia konta;
//   - żądanie automatycznego przesyłania powiadomień (art. 300(34) § 9 KSH,
//     🔵) — oświadczenie w portalu, skuteczne od razu.
// ─────────────────────────────────────────────────────────────

const WZORZEC_EMAIL_OSW = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ostatnieOswiadczenie(osobaId, spolkaId, rodzaj) {
  return db().prepare(
    `SELECT * FROM psa_oswiadczenia WHERE osoba_id = ? AND (spolka_id IS ? OR spolka_id = ?) AND rodzaj = ?
      ORDER BY id DESC LIMIT 1`
  ).get(osobaId, spolkaId, spolkaId, rodzaj) || null;
}

function wymagajAkcjonariuszaPortalu(zad) {
  if (zad.konto.rola !== 'akcjonariusz' || !zad.konto.osoba_id) {
    throw bledneZadanie('Oświadczenia składa osobiście akcjonariusz albo nabywca ze swojego konta — nie zarząd w jego imieniu.');
  }
}

router.get('/oswiadczenia', asy((zad, odp) => {
  wymagajAkcjonariuszaPortalu(zad);
  const osoba = db().prepare('SELECT id, email, zgoda_email_status FROM psa_osoby WHERE id = ?').get(zad.konto.osoba_id);
  const spolki = db().prepare(
    `SELECT DISTINCT s.id, s.nazwa FROM psa_stan_akcji sa JOIN psa_spolki s ON s.id = sa.spolka_id
      WHERE sa.osoba_id = ? AND sa.data_do IS NULL ORDER BY s.nazwa`
  ).all(zad.konto.osoba_id);
  odp.json({
    zgoda_email: { email: osoba.email, status: osoba.zgoda_email_status },
    spolki: spolki.map((s) => ({
      spolka_id: s.id,
      nazwa: s.nazwa,
      powiadomienia_automatyczne: ostatnieOswiadczenie(osoba.id, s.id, 'powiadomienia_automatyczne'),
      zgoda_email_ostatnie: ostatnieOswiadczenie(osoba.id, s.id, 'zgoda_email'),
    })),
  });
}));

router.post('/oswiadczenia', asy((zad, odp) => {
  wymagajAkcjonariuszaPortalu(zad);
  const cialo = zad.body || {};
  const spolkaId = Number(cialo.spolka_id) || null;
  const rodzaj = String(cialo.rodzaj || '');
  const zlozone = cialo.zlozone !== false;
  if (!['zgoda_email', 'powiadomienia_automatyczne'].includes(rodzaj)) throw bledneZadanie('Nieznany rodzaj oświadczenia.');
  const konto = zad.konto;
  // D-092 (R4 K5): oświadczenie to dane kartoteki — działa od razu, bez wpisu w rejestrze i bez opłaty.
  let email = null;
  if (rodzaj === 'zgoda_email' && zlozone) {
    email = String(cialo.email || '').trim().toLowerCase()
      || (db().prepare('SELECT email FROM psa_osoby WHERE id = ?').get(konto.osoba_id) || {}).email || '';
    if (!WZORZEC_EMAIL_OSW.test(email)) throw bledneZadanie('Podaj adres e-mail, na który mamy kierować korespondencję.');
  }
  const stan = require('../oswiadczenia').zapiszOswiadczenie(db(), {
    osobaId: konto.osoba_id, rodzaj, zlozone, email, zrodlo: 'portal', autor: `Portal — ${konto.email}`, kontoId: konto.id, spolkaId,
  });
  odp.status(201).json({ ok: true, stan, utworzono: czas.terazIso() });
}));

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
      // Konto moze prowadzic WIECEJ NIZ JEDNA spolke (migracja 41).
      // Porownanie z `konto.spolka_id` bralo pod uwage tylko pierwsza z nich,
      // wiec klient z dwiema spolkami nie mogl dolaczyc dokumentu do sprawy
      // tej drugiej — dostawal „nie odnaleziono sprawy" wlasnej spolki.
      ? spolkiKonta(konto).includes(Number(sprawa.spolka_id))
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
  // Naprawa Z-254: blad multera idzie nieopakowany, zeby zadzialala
  // przetlumaczona galaz "MulterError"; blad z fileFilter (juz po polsku)
  // staje sie 400, a nie ogolnym 500.
  (zad, odp, dalej) => upload.array('pliki', 10)(zad, odp, dalejPoUploadzie(dalej)),
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
// Zgloszenie NIEPRAWIDLOWOSCI we wpisie (B9) — odrebne od `/zadania`
// wyzej: to NIE jest zadanie NOWEGO wpisu (art. 300(34) § 1 KSH), tylko
// sygnal, ze WCZESNIEJSZY wpis jest bledny albo niezgodny z dokumentem.
// Bez oplaty przy skladaniu, bez wlasnego "stanu wpisu" — pracownik
// wylacznie KWALIFIKUJE zgloszenie (sprostowanie / w istocie zadanie wpisu
// / brak nieprawidlowosci), patrz `server/trasy/zgloszenia-nieprawidlowosci.js`
// po stronie kancelarii.
// ─────────────────────────────────────────────────────────────

function widokZgloszeniaNieprawidlowosci(w) {
  return {
    id: w.id,
    spolka_id: w.spolka_id,
    spolka_nazwa: w.spolka_nazwa,
    zdarzenie_id: w.zdarzenie_id,
    czego_dotyczy: w.czego_dotyczy,
    opis: w.opis,
    stan: w.stan,
    kwalifikacja: w.kwalifikacja,
    notatka_kancelarii: w.notatka_kancelarii,
    utworzono: w.utworzono,
    zaktualizowano: w.zaktualizowano,
  };
}

const CZEGO_DOTYCZY_ZGLOSZENIA = ['blad_w_danych', 'niezgodny_z_dokumentem', 'inne'];

router.get(
  '/zgloszenia-nieprawidlowosci',
  asy((zad, odp) => {
    const wiersze = db()
      .prepare(
        `SELECT z.*, s.nazwa AS spolka_nazwa
           FROM psa_zgloszenia_nieprawidlowosci z
           JOIN psa_spolki s ON s.id = z.spolka_id
          WHERE z.konto_id = ?
          ORDER BY z.utworzono DESC`
      )
      .all(zad.konto.id);
    odp.json({ zgloszenia: wiersze.map(widokZgloszeniaNieprawidlowosci) });
  })
);

router.post(
  '/zgloszenie-nieprawidlowosci',
  asy((zad, odp) => {
    const cialo = zad.body || {};
    // Dostep do tej spolki juz sprawdzony przez `wymagajDostepuDoSpolkiWCiele` wyzej.
    const spolkaId = Number(cialo.spolka_id);
    if (!Number.isInteger(spolkaId)) throw bledneZadanie('Wskaż spółkę, której dotyczy zgłoszenie.');
    const czegoDotyczy = String(cialo.czego_dotyczy || '');
    if (!CZEGO_DOTYCZY_ZGLOSZENIA.includes(czegoDotyczy)) {
      throw bledneZadanie('Wybierz, czego dotyczy zgłoszenie.');
    }
    const opis = String(cialo.opis || '').trim();
    if (!opis) throw bledneZadanie('Opisz, na czym polega nieprawidłowość.');
    let zdarzenieId = null;
    if (cialo.zdarzenie_id != null && cialo.zdarzenie_id !== '') {
      zdarzenieId = Number(cialo.zdarzenie_id);
      const zdarzenie = db()
        .prepare('SELECT id FROM psa_zdarzenia WHERE id = ? AND spolka_id = ?')
        .get(zdarzenieId, spolkaId);
      if (!zdarzenie) throw bledneZadanie('Nie odnaleziono wpisu, którego dotyczy zgłoszenie.');
    }

    const teraz = czas.terazIso();
    const wynik = db()
      .prepare(
        `INSERT INTO psa_zgloszenia_nieprawidlowosci
           (spolka_id, konto_id, zdarzenie_id, czego_dotyczy, opis, stan, utworzono)
         VALUES (@spolka_id, @konto_id, @zdarzenie_id, @czego_dotyczy, @opis, 'nowe', @utworzono)`
      )
      .run({
        spolka_id: spolkaId, konto_id: zad.konto.id, zdarzenie_id: zdarzenieId,
        czego_dotyczy: czegoDotyczy, opis, utworzono: teraz,
      });
    const zapisane = db()
      .prepare(
        `SELECT z.*, s.nazwa AS spolka_nazwa FROM psa_zgloszenia_nieprawidlowosci z
           JOIN psa_spolki s ON s.id = z.spolka_id WHERE z.id = ?`
      )
      .get(wynik.lastInsertRowid);
    odp.status(201).json({ zgloszenie: widokZgloszeniaNieprawidlowosci(zapisane) });
  })
);

// ─────────────────────────────────────────────────────────────
// Platnosci klienta
// ─────────────────────────────────────────────────────────────

const OPISY_TYPU_OPLATY = {
  prowadzenie: 'Prowadzenie rejestru akcjonariuszy',
  wpis: 'Wpis w rejestrze akcjonariuszy',
  informacja: 'Informacja z rejestru akcjonariuszy',
};

/** Klient widzi wylacznie BRUTTO (sekcja 2.1) - to jest kwota, ktora placi. */
function widokOplatyKlienta(w) {
  return {
    id: w.id,
    spolka_id: w.spolka_id,
    spolka_nazwa: w.spolka_nazwa,
    typ: w.typ,
    opis: OPISY_TYPU_OPLATY[w.typ] || 'Opłata',
    okres: w.okres,
    okres_od: w.okres_od,
    okres_do: w.okres_do,
    kwota_grosze: przepisy.obliczBrutto(w.kwota_grosze, w.stawka_vat_procent),
    status: w.status,
    data_naliczenia: w.data_naliczenia,
    oplacona_kiedy: w.oplacona_kiedy,
    notatka: w.notatka,
    sprawa_id: w.sprawa_id,
    // Informacja oplacona, ale jeszcze niepobrana — klientowi nalezy sie
    // dokument, wiec musi to widziec.
    do_pobrania: w.typ === 'informacja' && w.status === 'oplacona' && w.wydany_dokument_id == null,
  };
}

/**
 * Stawki, ktore klient zobaczy PRZED zamowieniem czynnosci. Cena musi byc
 * znana przed kliknieciem, nie po — inaczej "Zamow" jest zgoda w ciemno.
 *
 * BRUTTO (sekcja 2.1 promptu naprawczego) — to jest kwota, ktora klient
 * faktycznie zaplaci, z VAT. Stawka bierzemy z przepisy.js NA CHWILE
 * odpowiedzi, tak jak zrobi to naliczenie w chwili zamowienia.
 */
router.get(
  '/cennik',
  asy((zad, odp) => {
    const brutto = (typ) => przepisy.obliczBrutto(ustawienia.stawkaGrosze(db(), typ), przepisy.STAWKA_VAT_PROCENT);
    odp.json({
      stawki: {
        prowadzenie: brutto('prowadzenie'),
        wpis: brutto('wpis'),
        informacja: brutto('informacja'),
      },
      platnosci_wlaczone: tpay.skonfigurowany(),
    });
  })
);

/** Wszystkie oplaty spolek tego konta — zaplacone i czekajace. */
router.get(
  '/oplaty',
  asy((zad, odp) => {
    const konto = zad.konto;
    const spolki = spolkiRozliczen(konto);
    if (spolki.length === 0) {
      return odp.json({ oplaty: [], do_zaplaty_grosze: 0, platnosci_wlaczone: tpay.skonfigurowany() });
    }
    const warunek = warunekOplatKonta(konto, spolki);

    const wiersze = db()
      .prepare(
        `SELECT o.*, s.nazwa AS spolka_nazwa
           FROM psa_oplaty o
           JOIN psa_spolki s ON s.id = o.spolka_id
          WHERE ${warunek.sql} AND o.status != 'anulowana'
          ORDER BY (o.status = 'oplacona'), o.data_naliczenia DESC, o.id DESC`
      )
      .all(...warunek.parametry);

    const doZaplaty = wiersze
      .filter((w) => w.status !== 'oplacona')
      .reduce((suma, w) => suma + przepisy.obliczBrutto(w.kwota_grosze, w.stawka_vat_procent), 0);

    odp.json({
      oplaty: wiersze.map(widokOplatyKlienta),
      do_zaplaty_grosze: doZaplaty,
      platnosci_wlaczone: tpay.skonfigurowany(),
    });
  })
);

/** Wczytuje oplate, ktora TO KONTO wolno zobaczyc i oplacic — inaczej null. */
function wczytajOplateKonta(konto, oplataId) {
  const spolki = spolkiRozliczen(konto);
  if (spolki.length === 0) return null;
  const warunek = warunekOplatKonta(konto, spolki);
  return db()
    .prepare(`SELECT o.* FROM psa_oplaty o WHERE o.id = ? AND ${warunek.sql}`)
    .get(oplataId, ...warunek.parametry) || null;
}

/**
 * Link do zaplaty. Kwote bierze Z BAZY, nigdy z zadania — inaczej klient
 * placilby tyle, ile sam wpisal.
 */
router.post(
  '/oplaty/:id/zaplac',
  asy(async (zad, odp) => {
    const oplata = wczytajOplateKonta(zad.konto, Number(zad.params.id));
    if (!oplata) throw nieZnaleziono('Nie odnaleziono opłaty.');

    let wynik;
    try {
      wynik = await platnosci.przygotujZaplate(db(), {
        oplataId: oplata.id,
        urlPowiadomienia: adresPowiadomienia(),
        urlPowrotu: konfiguracja.TPAY.url_powrotu || `${konfiguracja.URL_PORTALU}#/spolka/${oplata.spolka_id}?zakladka=oplaty&zwrot=1`,
      });
    } catch (e) {
      throw bledneZadanie(e.message);
    }

    odp.json({ link: wynik.platnosc.link, platnosc_id: wynik.platnosc.id, nowa: wynik.nowa });
  })
);

/**
 * Adres, pod ktory operator wysle powiadomienie. Bierzemy go z KONFIGURACJI,
 * a nie z naglowka Host zadania: naglowek pochodzi od klienta, wiec dalby
 * sie podmienic na cudzy serwer, ktory przejalby powiadomienia o platnosciach.
 */
function adresPowiadomienia() {
  const podstawa = String(konfiguracja.URL_PORTALU || '').split('/portal')[0].replace(/\/$/, '');
  return `${podstawa}/api/psa/platnosci/tpay/itn`;
}

// ─────────────────────────────────────────────────────────────
// Informacja z rejestru (art. 300(35) KSH) — ODPLATNA, po zaplacie
// ─────────────────────────────────────────────────────────────

/**
 * Zamowienie informacji: nalicza oplate i oddaje link do zaplaty.
 *
 * Dokument NIE powstaje w tym momencie. Informacja jest odplatna (§ 15b
 * rozporzadzenia), a rejestr nie ma powodu wydawac jej "na kredyt" — inaczej
 * niz wpis, ktory jest ustawowym obowiazkiem z terminem. Nieoplacona
 * informacja po prostu nie istnieje; nikomu to nie szkodzi.
 */
router.post(
  '/informacja/zamow',
  asy(async (zad, odp) => {
    // Dostep do tej spolki juz sprawdzony przez `wymagajDostepuDoSpolki` wyzej.
    const konto = zad.konto;
    const spolkaId = Number((zad.body || {}).spolka_id);
    const spolka = rejestr.wczytajSpolke(db(), spolkaId);
    if (!spolka) throw nieZnaleziono('Nie odnaleziono spółki.');

    // Nierozliczone zamowienie tej samej osoby na te sama spolke ZOSTAJE —
    // nie zakladamy drugiego. Bez tego dwuklik w „Zamow informacje" tworzyl
    // dwa dlugi po 50 zl za jedna chec obejrzenia rejestru, a klient nie
    // mial jak tego cofnac.
    const zamawiajacy = konto.rola === 'spolka' ? null : konto.osoba_id;
    const wToku = db()
      .prepare(
        `SELECT * FROM psa_oplaty
          WHERE spolka_id = ? AND typ = 'informacja' AND status != 'anulowana'
            AND wydany_dokument_id IS NULL
            AND zamawiajacy_osoba_id IS ?
          ORDER BY (status = 'oplacona') DESC, id LIMIT 1`
      )
      .get(spolkaId, zamawiajacy);

    if (wToku && wToku.status === 'oplacona') {
      return odp.json({ oplata_id: wToku.id, oplacona: true, link: null });
    }
    if (wToku) {
      // Zamowienie juz jest, tylko jeszcze nieoplacone — oddajemy link do NIEGO.
      if (!tpay.skonfigurowany()) {
        return odp.json({ oplata_id: wToku.id, oplacona: false, link: null, platnosci_wlaczone: false });
      }
      try {
        const wznowiona = await platnosci.przygotujZaplate(db(), {
          oplataId: wToku.id,
          urlPowiadomienia: adresPowiadomienia(),
          urlPowrotu: konfiguracja.TPAY.url_powrotu || `${konfiguracja.URL_PORTALU}#/spolka/${spolkaId}?zakladka=oplaty&zwrot=1`,
        });
        return odp.json({ oplata_id: wToku.id, oplacona: false, link: wznowiona.platnosc.link, platnosci_wlaczone: true });
      } catch (e) {
        return odp.json({ oplata_id: wToku.id, oplacona: false, link: null, blad_platnosci: e.message });
      }
    }

    const oplata = oplaty.naliczOplateInformacji(db(), {
      spolkaId,
      odbiorcaOsobaId: konto.osoba_id,
      // Akcjonariusz placi za SWOJA informacje; spolka za swoja.
      zamawiajacyOsobaId: konto.rola === 'spolka' ? null : konto.osoba_id,
      autor: `Portal — ${konto.email}`,
      notatka: 'Informacja z rejestru — zamówiona w portalu',
    });

    if (!tpay.skonfigurowany()) {
      // Platnosci online wylaczone — oplata zostaje naliczona i rozliczy sie
      // ja faktura. Awaria operatora nie moze zablokowac dostepu do rejestru.
      return odp.json({ oplata_id: oplata.id, oplacona: false, link: null, platnosci_wlaczone: false });
    }

    let wynik;
    try {
      wynik = await platnosci.przygotujZaplate(db(), {
        oplataId: oplata.id,
        urlPowiadomienia: adresPowiadomienia(),
        urlPowrotu: konfiguracja.TPAY.url_powrotu || `${konfiguracja.URL_PORTALU}#/spolka/${spolkaId}?zakladka=oplaty&zwrot=1`,
      });
    } catch (e) {
      return odp.json({ oplata_id: oplata.id, oplacona: false, link: null, blad_platnosci: e.message });
    }
    odp.json({ oplata_id: oplata.id, oplacona: false, link: wynik.platnosc.link, platnosci_wlaczone: true });
  })
);

/**
 * Pobranie OPLACONEJ informacji. Dopiero tutaj powstaje dokument — i tylko
 * raz z jednej oplaty (`wydany_dokument_id`).
 */
router.post(
  '/informacja/:oplataId/wydaj',
  asy((zad, odp) => {
    const konto = zad.konto;
    const oplata = wczytajOplateKonta(konto, Number(zad.params.oplataId));
    if (!oplata || oplata.typ !== 'informacja') throw nieZnaleziono('Nie odnaleziono zamówienia.');
    if (oplata.status !== 'oplacona') {
      throw bledneZadanie('Informacja z rejestru jest odpłatna — opłać zamówienie, żeby ją pobrać.');
    }
    if (oplata.wydany_dokument_id != null) {
      return odp.json({ dokument_id: oplata.wydany_dokument_id, ponownie: true });
    }

    const spolkaId = oplata.spolka_id;
    const data = (zad.body || {}).data ? String((zad.body || {}).data) : czas.dzisIso();
    if (!czas.poprawnaData(data)) throw bledneZadanie('Parametr „data” musi mieć format RRRR-MM-DD.');

    const stan = widoki.widokStanu(db(), spolkaId, data, {
      rola: rolaOdbioru(konto),
      odbiorcaOsobaId: konto.osoba_id,
    });
    if (!stan) throw nieZnaleziono('Nie odnaleziono spółki.');

    const numerInformacji = informacje.nadajNumer(db());
    const trescHtml = informacjaDokument.informacjaZRejestru({
      kancelaria: ustawienia.kancelaria(db()),
      spolka: stan.spolka,
      data,
      stan,
      odbiorca: { rola: rolaOdbioru(konto) },
      sporzadzono: czas.terazIso(),
      numer: numerInformacji,
      wynagrodzenie: informacje.wynagrodzenie(db(), {
        spolka: stan.spolka, nettoGrosze: oplata.kwota_grosze, vatProcent: oplata.stawka_vat_procent,
      }),
    });

    const autorWpisu = `Portal — ${konto.email}`;
    // `odbiorca_osoba_id` NULL oznacza dokument wydany SPOLCE (pelne dane
    // wszystkich akcjonariuszy); wypelnione — dokument wydany konkretnej
    // osobie, w jej zakresie. Po tym polu, a nie po samym dostepie do
    // spolki, rozstrzyga sie potem, komu wolno go otworzyc.
    const wynikZapisu = db()
      .prepare(
        `INSERT INTO psa_wydane_dokumenty (spolka_id, typ, odbiorca_osoba_id, kanal, tresc_html, wyslano, autor, utworzono, numer)
         VALUES (?, 'informacja_z_rejestru', ?, 'portal', ?, ?, ?, ?, ?)`
      )
      .run(
        spolkaId,
        konto.rola === 'spolka' ? null : konto.osoba_id,
        trescHtml, czas.terazIso(), autorWpisu, czas.terazIso(), numerInformacji
      );
    const dokumentId = Number(wynikZapisu.lastInsertRowid);

    db().prepare('UPDATE psa_oplaty SET wydany_dokument_id = ?, zaktualizowano = ? WHERE id = ?')
      .run(dokumentId, czas.terazIso(), oplata.id);

    // Wglad w dane calego akcjonariatu spolki - blok D4, zakres WASKI.
    dziennikDostepu.zapisz(db(), {
      kto: autorWpisu,
      typKto: 'portal',
      spolkaId,
      akcja: dziennikDostepu.AKCJE.INFORMACJA_Z_REJESTRU,
      opis: `stan na ${data}`,
    });

    odp.json({ dokument_id: dokumentId, ponownie: false });
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
        `SELECT id, spolka_id, odbiorca_osoba_id, tresc_html FROM psa_wydane_dokumenty
          WHERE id = ? AND typ = 'informacja_z_rejestru'`
      )
      .get(Number(zad.params.id));

    // Sam dostep do spolki NIE WYSTARCZA. Informacja wydana SPOLCE niesie
    // pelne dane wszystkich akcjonariuszy (art. 300(35) § 1 KSH), a wydana
    // akcjonariuszowi — te same dane w jego, wezszym zakresie (§ 1(1)).
    // Bramka „czy masz dostep do tej spolki" przepuszczala akcjonariusza do
    // dokumentu spolki, czyli do adresow pozostalych akcjonariuszy, ktore
    // w jego wlasnej informacji sa zaslonione. Dokument otwiera wiec TEN,
    // KOMU GO WYDANO.
    const wydanySpolce = dokument && dokument.odbiorca_osoba_id == null;
    const dlaMnie = dokument && konto.osoba_id != null
      && Number(dokument.odbiorca_osoba_id) === Number(konto.osoba_id);
    const wolno = Boolean(dokument)
      && maDostepDoSpolki(konto, dokument.spolka_id)
      && (konto.rola === 'spolka' ? true : dlaMnie)
      && (konto.rola === 'spolka' || !wydanySpolce);

    // Cudzy dokument to dla portalu dokument NIEISTNIEJACY: 403 potwierdzalby,
    // ze taki numer jest zajety.
    if (!wolno) throw nieZnaleziono('Nie odnaleziono dokumentu.');

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
