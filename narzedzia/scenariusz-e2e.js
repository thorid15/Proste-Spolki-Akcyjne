#!/usr/bin/env node
'use strict';

/**
 * Scenariusz E2E: od zgłoszenia klienta do pierwszego zawiadomienia.
 *
 * Skrypt przechodzi CAŁĄ ścieżkę dwóch widoków — portalu klienta i aplikacji
 * kancelaryjnej — na działającym serwerze, po tych samych trasach HTTP,
 * których używa przeglądarka. Nie podmienia niczego w środku aplikacji: ma
 * dwa OSOBNE komplety ciasteczek (sesja pracownika i sesja konta klienta),
 * dokładnie tak, jak wygląda to przy dwóch oknach przeglądarki.
 *
 * Po co: żeby dało się obejrzeć cały przebieg bez ręcznego przeklikiwania
 * ośmiu ekranów — albo żeby doprowadzić bazę do wybranego momentu i dalej
 * klikać już samemu.
 *
 *   node narzedzia/scenariusz-e2e.js --haslo <hasło-admina>
 *   node narzedzia/scenariusz-e2e.js --haslo <hasło> --do wniosek
 *   node narzedzia/scenariusz-e2e.js --haslo <hasło> --adres http://localhost:3005
 *
 * Opcje:
 *   --adres     adres serwera (domyślnie http://localhost:3005)
 *   --admin     e-mail pracownika kancelarii (domyślnie ADMIN_EMAIL z .env)
 *   --haslo     hasło pracownika kancelarii (WYMAGANE)
 *   --email     adres klienta w scenariuszu (domyślnie losowy, żeby dało się
 *               uruchamiać skrypt wielokrotnie na tej samej bazie)
 *   --do        na którym kroku się zatrzymać: zgloszenie | zaproszenie |
 *               aktywacja | wniosek | umowa | przyjecie | rejestr | zawiadomienie
 *               (domyślnie: zawiadomienie — pełny przebieg)
 *
 * UWAGA: skrypt zapisuje prawdziwe dane w bazie wskazanej przez `.env`.
 * Uruchamiaj go na bazie testowej (WSPOLNA_BAZA=./dane/proba.db), nie na
 * produkcyjnej.
 */

const KROKI = [
  'zgloszenie',
  'zaproszenie',
  'aktywacja',
  'wniosek',
  'umowa',
  'przyjecie',
  'rejestr',
  'zawiadomienie',
];

function argumenty(argv) {
  const wynik = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const klucz = argv[i].slice(2);
    const wartosc = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : 'true';
    wynik[klucz] = wartosc;
  }
  return wynik;
}

const arg = argumenty(process.argv.slice(2));
const ADRES = (arg.adres || 'http://localhost:3005').replace(/\/$/, '');
const DO_KROKU = arg.do || 'zawiadomienie';
if (!KROKI.includes(DO_KROKU)) {
  console.error(`Nieznany krok „${DO_KROKU}". Dozwolone: ${KROKI.join(', ')}.`);
  process.exit(1);
}

// Konfiguracja czytana tak samo jak przez serwer — dzięki temu domyślny
// e-mail administratora nie musi być podawany z ręki.
let konfiguracja = {};
try {
  konfiguracja = require('../server/konfiguracja');
} catch (e) {
  konfiguracja = {};
}

const ADMIN_EMAIL = arg.admin || konfiguracja.ADMIN_EMAIL;
const ADMIN_HASLO = arg.haslo;
if (!ADMIN_EMAIL || !ADMIN_HASLO) {
  console.error('Podaj --haslo (i --admin, jeśli w .env nie ma ADMIN_EMAIL).');
  process.exit(1);
}

const ZNACZNIK = Date.now().toString().slice(-6);
const EMAIL_KLIENTA = arg.email || `proba.${ZNACZNIK}@example-test.pl`;
// Numer KRS jest w zgloszeniu wstepnym obowiazkowy - dziesiec cyfr,
// unikalnych dla przebiegu, zeby kolejne uruchomienia nie dowiazywaly sie
// do spolki zalozonej poprzednio.
const KRS_SPOLKI = `0000${ZNACZNIK}`.padEnd(10, '0').slice(0, 10);
const HASLO_KLIENTA = 'HasloKlienta123';

// ── Dwie niezależne sesje: pracownik i klient ────────────────────────────
function nowaSesja(nazwa) {
  return { nazwa, ciastka: new Map() };
}

function naglowekCiastek(sesja) {
  if (sesja.ciastka.size === 0) return {};
  return { Cookie: [...sesja.ciastka].map(([k, v]) => `${k}=${v}`).join('; ') };
}

function zapamietajCiastka(sesja, odp) {
  const surowe =
    typeof odp.headers.getSetCookie === 'function'
      ? odp.headers.getSetCookie()
      : [odp.headers.get('set-cookie')].filter(Boolean);
  for (const c of surowe) {
    const [para] = c.split(';');
    const rozdzial = para.indexOf('=');
    if (rozdzial === -1) continue;
    sesja.ciastka.set(para.slice(0, rozdzial).trim(), para.slice(rozdzial + 1).trim());
  }
}

async function zapytaj(sesja, metoda, sciezka, cialo, opcje = {}) {
  const naglowki = { ...naglowekCiastek(sesja), ...(opcje.naglowki || {}) };
  const ustawienia = { method: metoda, headers: naglowki, redirect: 'manual' };
  if (cialo !== undefined && !(cialo instanceof FormData)) {
    naglowki['Content-Type'] = 'application/json';
    ustawienia.body = JSON.stringify(cialo);
  } else if (cialo instanceof FormData) {
    ustawienia.body = cialo;
  }
  const odp = await fetch(ADRES + sciezka, ustawienia);
  zapamietajCiastka(sesja, odp);

  const typ = odp.headers.get('content-type') || '';
  const dane = typ.includes('application/json') ? await odp.json() : await odp.arrayBuffer();
  if (odp.status >= 400) {
    let opis = `${odp.status}`;
    if (typ.includes('application/json')) {
      opis = dane.blad || JSON.stringify(dane);
      if (Array.isArray(dane.bledy) && dane.bledy.length) opis += ` — ${dane.bledy.join('; ')}`;
      if (Array.isArray(dane.szczegoly) && dane.szczegoly.length) opis += ` — ${dane.szczegoly.join('; ')}`;
    }
    throw new Error(`${metoda} ${sciezka} → ${odp.status}: ${opis}`);
  }
  return dane;
}

// ── Wypisywanie przebiegu ────────────────────────────────────────────────
let numerKroku = 0;
function krok(kto, tytul) {
  numerKroku += 1;
  const etykieta = kto === 'klient' ? 'KLIENT   ' : 'KANCELARIA';
  console.log(`\n${String(numerKroku).padStart(2, '0')}. [${etykieta}] ${tytul}`);
}
function info(tekst) {
  console.log(`    ${tekst}`);
}
function ekran(adres) {
  console.log(`    → obejrzyj: ${adres}`);
}
function koniec(krokNazwa) {
  return KROKI.indexOf(krokNazwa) >= KROKI.indexOf(DO_KROKU);
}

const DZIS = new Date().toISOString().slice(0, 10);

async function main() {
  console.log('═'.repeat(72));
  console.log(`Scenariusz E2E — ${ADRES}`);
  console.log(`Klient w scenariuszu: ${EMAIL_KLIENTA} (hasło: ${HASLO_KLIENTA})`);
  console.log(`Zatrzymanie po kroku: ${DO_KROKU}`);
  console.log('═'.repeat(72));

  const kancelaria = nowaSesja('kancelaria');
  const klient = nowaSesja('klient');

  // ── 0. Logowanie pracownika ───────────────────────────────────────────
  krok('kancelaria', 'Logowanie pracownika kancelarii');
  await zapytaj(kancelaria, 'POST', '/api/psa/auth/login', { email: ADMIN_EMAIL, haslo: ADMIN_HASLO });
  info(`zalogowano jako ${ADMIN_EMAIL}`);

  const meta = await zapytaj(kancelaria, 'GET', '/api/psa/meta');
  if (!meta.portal_wlaczony) {
    throw new Error('Portal klienta jest wyłączony — ustaw PORTAL_WLACZONY=true w .env i uruchom serwer ponownie.');
  }

  // ── 1. Zgłoszenie wstępne (formularz publiczny) ───────────────────────
  krok('klient', 'Wysyła zgłoszenie z publicznego formularza „Zgłoś zainteresowanie"');
  await zapytaj(klient, 'POST', '/api/psa/portal/zgloszenia', {
    email: EMAIL_KLIENTA,
    krs: KRS_SPOLKI,
    telefon: '+48 500 100 200',
    nazwa_spolki: `Próbna ${ZNACZNIK} P.S.A.`,
    opis: 'Chcemy powierzyć kancelarii prowadzenie rejestru akcjonariuszy.',
  });
  ekran(`${ADRES}/portal.html#/zglos-sie`);
  info('zgłoszenie trafiło do kolejki „Zgłoszenia" po stronie kancelarii');
  ekran(`${ADRES}/#/zgloszenia`);
  if (koniec('zgloszenie')) return;

  // ── 2. Zaproszenie (kancelaria) ───────────────────────────────────────
  krok('kancelaria', 'Ocenia zgłoszenie i wysyła zaproszenie do portalu');
  const lista = await zapytaj(kancelaria, 'GET', '/api/psa/zgloszenia?status=nowe');
  const zgloszenie = lista.zgloszenia.find((z) => z.email === EMAIL_KLIENTA);
  if (!zgloszenie) throw new Error('Nie odnaleziono zgłoszenia w kolejce kancelarii.');
  const zaproszenie = await zapytaj(kancelaria, 'POST', `/api/psa/zgloszenia/${zgloszenie.id}/zapros`, {});

  let link = zaproszenie.link_aktywacyjny;
  if (zaproszenie.email_wyslany) {
    info('e-mail z linkiem aktywacyjnym został wysłany na adres klienta');
    throw new Error(
      'SMTP jest skonfigurowany, więc link nie wraca w odpowiedzi — otwórz link z maila ' +
        'i dokończ scenariusz ręcznie albo uruchom skrypt na konfiguracji bez SMTP.'
    );
  }
  info(`e-mail NIE wyszedł (${zaproszenie.powod})`);
  info('link aktywacyjny wraca w odpowiedzi i pokazuje się w oknie do skopiowania:');
  info(link);
  if (koniec('zaproszenie')) return;

  // ── 3. Aktywacja konta (klient) ───────────────────────────────────────
  krok('klient', 'Otwiera link z zaproszenia i ustawia hasło');
  const token = link.split('#/aktywuj/')[1];
  const sprawdzenie = await zapytaj(klient, 'GET', `/api/psa/portal/aktywacja/${token}`);
  info(`token ważny dla adresu ${sprawdzenie.email}`);
  await zapytaj(klient, 'POST', `/api/psa/portal/aktywacja/${token}`, { haslo: HASLO_KLIENTA });
  const kto = await zapytaj(klient, 'GET', '/api/psa/portal/whoami');
  info(`konto aktywne, rola: ${kto.konto.rola}`);
  ekran(`${ADRES}/portal.html#/aktywuj/${token}`);
  if (koniec('aktywacja')) return;

  // ── 4. Wniosek o prowadzenie rejestru (klient) ────────────────────────
  krok('klient', 'Potwierdza klauzulę RODO i wypełnia wniosek');
  await zapytaj(klient, 'POST', '/api/psa/portal/rodo');
  await zapytaj(klient, 'PUT', '/api/psa/portal/wniosek', {
    nazwa: `Próbna ${ZNACZNIK} Prosta Spółka Akcyjna`,
    forma_prawna: 'PROSTA SPÓŁKA AKCYJNA',
    krs: KRS_SPOLKI,
    kraj: 'Polska',
    kod_pocztowy: '80-280',
    miejscowosc: 'Gdańsk',
    ulica: 'Bolesława Leśmiana',
    nr_domu: '3',
    nr_lokalu: 'U10',
    email: EMAIL_KLIENTA,
    telefon: '+48 500 100 200',
    data_zawarcia_umowy_spolki: DZIS,
    reprezentant_imie_nazwisko: 'Anna Nowak',
    reprezentant_funkcja: 'Prezes zarządu',
    reprezentant_reprezentacja: 'samodzielnie',
    reprezentant_email: EMAIL_KLIENTA,
  });
  info('krok „Spółka i umowa" zapisany');

  const akcjonariusze = [
    {
      typ: 'fizyczna',
      imie: 'Anna',
      nazwisko: 'Nowak',
      pesel: '85010112345',
      data_urodzenia: '1985-01-01',
      plec: 'kobieta',
      kod_pocztowy: '80-280',
      miejscowosc: 'Gdańsk',
      ulica: 'Bolesława Leśmiana',
      nr_domu: '3',
      rodzaj_adresu_rejestrowego: 'zamieszkania',
      email: EMAIL_KLIENTA,
      zgoda_email_status: 'zadeklarowana',
    },
    {
      typ: 'fizyczna',
      imie: 'Piotr',
      nazwisko: 'Wiśniewski',
      pesel: '90050554321',
      data_urodzenia: '1990-05-05',
      plec: 'mezczyzna',
      kod_pocztowy: '81-310',
      miejscowosc: 'Gdynia',
      ulica: 'Świętojańska',
      nr_domu: '12',
      rodzaj_adresu_rejestrowego: 'zamieszkania',
      email: `wspolnik.${ZNACZNIK}@example-test.pl`,
      zgoda_email_status: 'zadeklarowana',
    },
  ];
  const dodani = [];
  for (const a of akcjonariusze) {
    const wynik = await zapytaj(klient, 'POST', '/api/psa/portal/wniosek/akcjonariusze', a);
    dodani.push(wynik.akcjonariusz);
  }
  info(`krok „Akcjonariusze": dodano ${dodani.length} pozycje`);
  ekran(`${ADRES}/portal.html#/`);
  if (koniec('wniosek')) return;

  // ── 5. Złożenie wniosku i podpisana umowa (klient) ────────────────────
  krok('klient', 'Składa wniosek — system generuje projekt umowy');
  const zlozenie = await zapytaj(klient, 'POST', '/api/psa/portal/wniosek/zloz', {});
  info(`status wniosku: ${zlozenie.wniosek.status}`);
  if (zlozenie.brakujace && zlozenie.brakujace.length) {
    info(`pola niewypełnione w projekcie umowy: ${zlozenie.brakujace.join(', ')}`);
  }
  const projekt = await zapytaj(klient, 'GET', '/api/psa/portal/wniosek/umowa-projekt');
  info(`pobrano projekt umowy (.docx, ${projekt.byteLength} B)`);

  krok('klient', 'Odsyła podpisany egzemplarz umowy');
  const formularz = new FormData();
  // Minimalny, poprawny plik PDF — zastępuje skan podpisanej umowy.
  const pdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF\n',
    'utf8'
  );
  formularz.append('plik', new Blob([pdf], { type: 'application/pdf' }), 'umowa-podpisana.pdf');
  const podpisana = await zapytaj(klient, 'POST', '/api/psa/portal/wniosek/umowa-podpisana', formularz);
  info(`status wniosku: ${podpisana.wniosek.status}`);
  ekran(`${ADRES}/#/wnioski`);
  if (koniec('umowa')) return;

  // ── 6. Weryfikacja i przyjęcie wniosku (kancelaria) ───────────────────
  krok('kancelaria', 'Weryfikuje pozycje akcjonariuszy i przyjmuje wniosek');
  const wnioski = await zapytaj(kancelaria, 'GET', '/api/psa/wnioski');
  const wniosek = wnioski.wnioski.find((w) => w.konto_email === EMAIL_KLIENTA);
  if (!wniosek) throw new Error('Nie odnaleziono wniosku w kolejce kancelarii.');
  ekran(`${ADRES}/#/wnioski/${wniosek.id}`);

  const szczegoly = await zapytaj(kancelaria, 'GET', `/api/psa/wnioski/${wniosek.id}`);
  for (const pozycja of szczegoly.akcjonariusze) {
    await zapytaj(kancelaria, 'POST', `/api/psa/wnioski/${wniosek.id}/akcjonariusze/${pozycja.id}/zweryfikuj`, {
      zweryfikowano: true,
    });
  }
  info(`zweryfikowano ${szczegoly.akcjonariusze.length} pozycji`);

  const przyjecie = await zapytaj(kancelaria, 'POST', `/api/psa/wnioski/${wniosek.id}/przyjmij`, {});
  const spolkaId = przyjecie.spolka_id;
  info(`wniosek przyjęty — założono spółkę #${spolkaId} i osoby w kartotece`);
  ekran(`${ADRES}/#/spolki/${spolkaId}`);
  if (koniec('przyjecie')) return;

  // ── 7. Otwarcie rejestru (kancelaria) ─────────────────────────────────
  krok('kancelaria', 'Otwiera rejestr: emisja założycielska i objęcie akcji');
  const osoby = przyjecie.akcjonariusze.map((a) => a.osoba_id);
  const otwarcie = await zapytaj(kancelaria, 'POST', `/api/psa/spolki/${spolkaId}/otworz-rejestr`, {
    zdarzenia: [
      {
        typ: 'emisja',
        klucz_tymczasowy: 'emisja-1',
        data_zdarzenia: DZIS,
        dane: {
          seria: 'A',
          nr_pierwszy: 1,
          ilosc: 1000,
          data_wpisu_krs: DZIS,
          rodzaj_akcji: 'zwykla',
          tytul: 'Emisja założycielska',
        },
      },
      {
        typ: 'objecie',
        data_zdarzenia: DZIS,
        dane: {
          emisja_zdarzenie_id: { __odwolanie_do_partii: 'emisja-1' },
          pozycje: [
            { osoba_id: osoby[0], ilosc: 600, pokryta: 'tak', cena_emisyjna_grosze: 100 },
            { osoba_id: osoby[1], ilosc: 400, pokryta: 'tak', cena_emisyjna_grosze: 100 },
          ],
        },
      },
    ],
  });
  info(`zapisano zdarzenia: ${otwarcie.zdarzenia.map((z) => `${z.typ} (${z.hash_skrocony})`).join(', ')}`);
  const emisjaId = otwarcie.zdarzenia.find((z) => z.typ === 'emisja').id;
  ekran(`${ADRES}/#/spolki/${spolkaId}`);
  if (koniec('rejestr')) return;

  // ── 8. Pierwszy wpis na żądanie i zawiadomienie (kancelaria) ──────────
  krok('kancelaria', 'Zakłada sprawę z żądania spółki i dokonuje wpisu');
  const sprawa = await zapytaj(kancelaria, 'POST', '/api/psa/sprawy', {
    spolka_id: spolkaId,
    typ_zdarzenia: 'przeniesienie',
    zrodlo: 'portal',
    zadajacy_osoba_id: osoby[0],
    zadajacy_rola: 'zbywca',
    data_wplywu: DZIS,
    dokument_rodzaj: 'umowa_zbycia',
    dokument_data: DZIS,
    notatka: 'Scenariusz próbny — zbycie 100 akcji serii A.',
  });
  info(`założono sprawę ${sprawa.sprawa.numer} (stan „${sprawa.sprawa.stan}")`);
  ekran(`${ADRES}/#/sprawy/${sprawa.sprawa.id}`);

  // Przeniesienie akcji wymaga UPRZEDNIEGO powiadomienia zbywcy
  // (art. 300(34) § 3 KSH) — wysyła je pracownik przed dokonaniem wpisu.
  const wZweryfikacji = await zapytaj(kancelaria, 'PATCH', `/api/psa/sprawy/${sprawa.sprawa.id}`, {
    akcja: 'weryfikuj',
  });
  info(`sprawa przeszła do stanu „${wZweryfikacji.sprawa.stan}"`);
  const powiadomienie = await zapytaj(kancelaria, 'POST', `/api/psa/sprawy/${sprawa.sprawa.id}/powiadomienie`, {
    osoba_id: osoby[0],
  });
  info(
    'uprzednie powiadomienie zbywcy (art. 300(34) § 3 KSH): ' +
      (powiadomienie.wysylka.wyslano ? 'wysłane e-mailem' : `NIEwysłane (${powiadomienie.wysylka.powod})`)
  );

  const wejscie = {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: osoby[0],
    tytul_prawny: 'sprzedaż',
    pozycje: [{ nabywca_osoba_id: osoby[1], ilosc: 100 }],
  };
  const podglad = await zapytaj(kancelaria, 'POST', `/api/psa/sprawy/${sprawa.sprawa.id}/podglad`, {
    data_zdarzenia: DZIS,
    dane: wejscie,
  });
  if (!podglad.dopuszczalne) {
    throw new Error(`Podgląd odrzucił wpis: ${podglad.bledy.join('; ')}`);
  }

  krok('kancelaria', 'Dokonuje wpisu — automat wystawia pierwsze zawiadomienie');
  const wpis = await zapytaj(kancelaria, 'POST', `/api/psa/sprawy/${sprawa.sprawa.id}/wpisz`, {
    data_zdarzenia: DZIS,
    dane: wejscie,
  });
  info(`wpisano zdarzenie #${wpis.zdarzenie.id} (${wpis.zdarzenie.typ}), skrót ${wpis.zdarzenie.hash_skrocony}`);
  for (const p of wpis.powiadomienia) {
    if (p.blad) {
      info(`zawiadomienie: ${p.blad}`);
      continue;
    }
    info(
      `zawiadomienie „${p.typ || 'zawiadomienie_wpis'}" dla ${p.odbiorca || 'odbiorcy'} — ` +
        (p.wyslano ? 'wysłane e-mailem' : `NIEwysłane (${p.powod || 'brak SMTP'}), czeka na wysyłkę ręczną`)
    );
  }
  ekran(`${ADRES}/#/sprawy/${sprawa.sprawa.id}`);

  console.log('\n' + '═'.repeat(72));
  console.log('Scenariusz przeszedł całą ścieżkę.');
  console.log(`Widok kancelarii: ${ADRES}/#/spolki/${spolkaId}`);
  console.log(`Widok klienta:    ${ADRES}/portal.html  (${EMAIL_KLIENTA} / ${HASLO_KLIENTA})`);
  console.log('═'.repeat(72));
}

main().catch((e) => {
  console.error(`\nBŁĄD: ${e.message}`);
  process.exit(1);
});
