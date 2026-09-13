'use strict';

/**
 * Informacja z rejestru akcjonariuszy — art. 300(35) § 3 KSH.
 *
 * Dokument jest JEDYNYM pismem, jakie aplikacja wystawia ze stanu rejestru.
 * Ustawa nie okresla, co ma w nim byc — art. 300(35) § 3 KSH daje tylko prawo
 * zadania wydania informacji. Granice wyznaczaja dwa inne przepisy: art.
 * 300(33) § 1 pkt 1–11 mowi, co zawiera REJESTR, a art. 300(35) § 1(1)
 * zabiera z informacji dane wrazliwe pozostalych akcjonariuszy.
 *
 * Test pilnuje wlasnie tego zakresu, nie wygladu. Zakres da sie zgubic po
 * cichu — wystarczy, ze pole przestanie dochodzic z `widoki.widokStanu()`
 * i cala sekcja zniknie bez sladu.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { informacjaZRejestru, adresAkcjonariusza, emailDoRejestru } =
  require('../server/logika/informacja-dokument');

const KANCELARIA = {
  nazwa: 'Kancelaria Notarialna Testowa',
  adres: 'ul. Próbna 1',
  miejscowosc: '80-280 Gdańsk',
  email: 'biuro@example-test.pl',
};

const SPOLKA = {
  nazwa: 'PRÓBNA PROSTA SPÓŁKA AKCYJNA',
  forma_prawna: 'PROSTA SPÓŁKA AKCYJNA',
  krs: '0000123456',
  nip: '5252525252',
  regon: '123456789',
  ulica: 'Kwiatowa',
  nr_domu: '4',
  nr_lokalu: '2',
  kod_pocztowy: '80-180',
  miejscowosc: 'Gdańsk',
  sad_rejestrowy: 'Sąd Rejonowy Gdańsk-Północ',
  wydzial: 'VIII Wydział Gospodarczy',
  data_utworzenia_spolki: '2026-01-15',
  data_umowy: '2026-02-01',
  data_otwarcia_rejestru: '2026-02-10',
};

/** Stan rejestru wypelniony tak, zeby KAZDA sekcja dokumentu miala tresc. */
function stanPelny() {
  return {
    rola: 'spolka',
    spolka: SPOLKA,
    razem_akcji: 1000,
    emisje: [{
      klucz: 1,
      seria: 'A',
      tytul: 'Emisja założycielska',
      podstawa_prawna: 'umowa spółki',
      zakres: '1–1000',
      ilosc: 1000,
      data_emisji: '2026-01-20',
      rodzaj_akcji: 'uprzywilejowana',
      obowiazki_wobec_spolki: 'obowiązek powtarzających się świadczeń niepieniężnych',
    }],
    bilans: [{ emisja_klucz: 1, umorzone: 0, w_obrocie: 1000 }],
    akcjonariusze: [{
      osoba_id: 7,
      osoba: {
        oznaczenie: 'Nowak Anna',
        jawny_identyfikator: '',
        ulica: 'Polna', nr_domu: '12', nr_lokalu: '3',
        kod_pocztowy: '81-310', miejscowosc: 'Gdynia',
        email: 'anna@example-test.pl',
        zgoda_email_status: 'potwierdzona',
        zamaskowane: false,
      },
      seria: 'A',
      numery: '1–1000',
      ilosc: 1000,
      procent: 100,
      pokryta: 'tak',
      obciazenia: [{ typ: 'zastaw' }],
    }],
    uprawnienia: [{
      klucz: 1, rodzaj: 'przywilej głosowy', osoba: { oznaczenie: 'Nowak Anna' },
      seria: 'A', tytul: 'dwa głosy', tresc: 'dwa głosy na akcję',
      data_ustanowienia: '2026-01-20',
    }],
    obciazenia: [{
      klucz: 1, typ: 'zastaw', seria: 'A', numery: '1–100',
      uprawniony: { oznaczenie: 'Bank Testowy S.A.' },
      prawo_glosu: true, data_od: '2026-03-01',
    }],
    ograniczenia: [{
      klucz: 1, zakres: 'spolka', seria: null, numery: null,
      wymaga_zgody_spolki: true, prawo_pierwszenstwa: true,
      opis: 'zbycie wymaga zgody zarządu',
    }],
  };
}

function dokument(nadpisania = {}) {
  return informacjaZRejestru({
    kancelaria: KANCELARIA,
    spolka: SPOLKA,
    data: '2026-09-01',
    stan: stanPelny(),
    sporzadzono: '2026-09-01T10:00:00.000Z',
    ...nadpisania,
  });
}

// ─────────────────────────────────────────────────────────────
// Zakres ustawowy
// ─────────────────────────────────────────────────────────────

test('informacja pokazuje caly rejestr z art. 300(33) § 1 pkt 1–11 KSH', () => {
  const html = dokument();

  // pkt 1–2: firma, siedziba, adres, sad rejestrowy i numer KRS.
  assert.match(html, /PRÓBNA PROSTA SPÓŁKA AKCYJNA/);
  assert.match(html, /Kwiatowa 4\/2, 80-180 Gdańsk/);
  assert.match(html, /Sąd Rejonowy Gdańsk-Północ, VIII Wydział Gospodarczy/);
  assert.match(html, /0000123456/);

  // pkt 3: data zarejestrowania spolki i data emisji akcji.
  assert.match(html, /15\.01\.2026/, 'data zarejestrowania spółki');
  assert.match(html, /20\.01\.2026/, 'data emisji akcji');

  // pkt 4: seria, numery, RODZAJ akcji i uprawnienia szczegolne.
  assert.match(html, /uprzywilejowana/, 'rodzaj akcji');
  assert.match(html, /1–1000/);
  assert.match(html, /Uprawnienia szczególne z akcji/);
  assert.match(html, /dwa głosy na akcję/);

  // pkt 5: akcjonariusz, jego ADRES oraz e-mail za zgoda.
  assert.match(html, /Nowak Anna/);
  assert.match(html, /Polna 12\/3, 81-310 Gdynia/, 'adres akcjonariusza');
  assert.match(html, /anna@example-test\.pl/, 'e-mail za zgodą');

  // pkt 6–8: obciazenia i prawo glosu z akcji obciazonej.
  assert.match(html, /Obciążenia i zajęcia akcji/);
  assert.match(html, /Bank Testowy S\.A\./);
  assert.match(html, /przysługuje uprawnionemu/);

  // pkt 9: wzmianka o pokryciu akcji.
  assert.match(html, /Pokrycie/);
  assert.match(html, /w całości/);

  // pkt 10: ograniczenia w rozporzadzaniu akcja.
  assert.match(html, /Ograniczenia w rozporządzaniu akcjami/);
  assert.match(html, /zbycie wymaga zgody zarządu/);

  // pkt 11: obowiazki wobec spolki zwiazane z akcja.
  assert.match(html, /Obowiązki wobec spółki/);
  assert.match(html, /powtarzających się świadczeń niepieniężnych/);

  // Kto wydal dokument — w glowce, nie w osobnej sekcji nizej.
  assert.match(html, /podmiot prowadzący rejestr akcjonariuszy/);
});

/**
 * Sekcje warunkowe znikaja, gdy rejestr nic w nich nie wykazuje: pusta
 * tabela „uprawnien" w pismie do sadu sugeruje, ze o cos nie zapytano,
 * a nie ze ich nie ma.
 */
test('sekcje warunkowe znikaja, gdy rejestr nic nie wykazuje', () => {
  const stan = stanPelny();
  stan.uprawnienia = [];
  stan.obciazenia = [];
  stan.ograniczenia = [];
  stan.emisje[0].obowiazki_wobec_spolki = null;
  const html = dokument({ stan });

  assert.doesNotMatch(html, /Uprawnienia szczególne/);
  assert.doesNotMatch(html, /Obciążenia i zajęcia/);
  assert.doesNotMatch(html, /Ograniczenia w rozporządzaniu/);
  assert.doesNotMatch(html, /Obowiązki wobec spółki/);
  // Sekcje bezwarunkowe zostaja.
  assert.match(html, /Akcjonariusze/);
  assert.match(html, /Emisje i serie akcji/);
});

/**
 * Numeracja sekcji ma pozwalac odeslac do fragmentu wypisu, wiec musi byc
 * CIAGLA takze wtedy, gdy sekcje warunkowe odpadly — inaczej jeden wypis
 * mialby sekcje I, II, III, VII.
 */
test('numeracja sekcji jest ciagla mimo znikajacych sekcji warunkowych', () => {
  const stan = stanPelny();
  stan.uprawnienia = [];
  stan.obciazenia = [];
  stan.ograniczenia = [];
  stan.emisje[0].obowiazki_wobec_spolki = null;
  const numery = [...dokument({ stan }).matchAll(/class="sekcja-numer">([IVX]+)\./g)]
    .map((m) => m[1]);
  assert.deepEqual(numery, ['I', 'II', 'III', 'IV']);
});

// ─────────────────────────────────────────────────────────────
// Maskowanie i zgody
// ─────────────────────────────────────────────────────────────

test('adres zamaskowany jest nazwany wprost, a nie przemilczany', () => {
  const stan = stanPelny();
  stan.rola = 'akcjonariusz';
  stan.akcjonariusze[0].osoba = {
    oznaczenie: 'Nowak Anna',
    zamaskowane: true,
    ulica: null, nr_domu: null, kod_pocztowy: null, miejscowosc: null,
  };
  const html = dokument({ stan });
  assert.match(html, /adres zamieszkania zasłonięty/);
  assert.match(html, /nie udostępnia się akcjonariuszowi/, 'brak danych jest nazwany, nie przemilczany');
});

/**
 * Art. 300(33) § 1 pkt 5 KSH in fine: adres poczty elektronicznej wchodzi do
 * rejestru TYLKO za zgoda akcjonariusza. Znany kancelarii adres bez zgody
 * w wypisie nie ma czego szukac.
 */
test('e-mail bez zgody nie wchodzi do dokumentu', () => {
  assert.equal(emailDoRejestru({ email: 'x@example-test.pl', zgoda_email_status: 'brak' }), null);
  assert.equal(emailDoRejestru({ email: 'x@example-test.pl', zgoda_email_status: 'zadeklarowana' }), null,
    'sama deklaracja to jeszcze nie zgoda — liczy się podpisane oświadczenie');
  assert.equal(
    emailDoRejestru({ email: 'x@example-test.pl', zgoda_email_status: 'potwierdzona' }),
    'x@example-test.pl'
  );

  const stan = stanPelny();
  stan.akcjonariusze[0].osoba.zgoda_email_status = 'zadeklarowana';
  assert.doesNotMatch(dokument({ stan }), /anna@example-test\.pl/);
});

test('adres akcjonariusza: kolejnosc z art. 300(33) § 1 pkt 5 KSH', () => {
  assert.equal(
    adresAkcjonariusza({ ulica: 'Polna', nr_domu: '12', nr_lokalu: '3', kod_pocztowy: '81-310', miejscowosc: 'Gdynia' }),
    'Polna 12/3, 81-310 Gdynia'
  );
  // Bez adresu zamieszkania wchodzi adres do doreczen, a dopiero po nim elektroniczny.
  assert.match(adresAkcjonariusza({ adres_doreczen: 'skr. poczt. 5' }), /skr\. poczt\. 5 \(adres do doręczeń\)/);
  assert.match(adresAkcjonariusza({ adres_edoreczen: 'AE:PL-11111' }), /AE:PL-11111/);
  assert.equal(adresAkcjonariusza({}), null);
});

// ─────────────────────────────────────────────────────────────
// Rzetelnosc tresci
// ─────────────────────────────────────────────────────────────

/**
 * `null` w kolumnie `pokryta` znaczy: zarzad nie podjal jeszcze uchwaly
 * z art. 300(9) § 2 KSH. To NIE jest stwierdzenie, ze wkladu nie wniesiono —
 * dokument nie ma prawa zamienic niewiedzy w zaprzeczenie.
 */
test('nieustalone pokrycie nie zamienia sie w „niepokryte”', () => {
  const stan = stanPelny();
  stan.akcjonariusze[0].pokryta = null;
  const html = dokument({ stan });
  assert.match(html, /nieustalone/);
  assert.doesNotMatch(html, /niepokryte/);
});

test('puste dane spolki nie drukuja sie jako puste wiersze', () => {
  const spolka = { ...SPOLKA, nip: null, regon: '' };
  const html = dokument({ spolka, stan: { ...stanPelny(), spolka } });
  assert.doesNotMatch(html, /<dt>NIP<\/dt>/);
  assert.doesNotMatch(html, /<dt>REGON<\/dt>/);
  assert.match(html, /<dt>Numer KRS<\/dt>/, 'wypełnione pola zostają');
});

/**
 * Dokument ma sie przeczytac i wydrukowac bez sieci. Zwykly `rel="stylesheet"`
 * do Google Fonts wstrzymuje rysowanie strony do czasu pobrania arkusza —
 * przy odcietym laczu wydruk wychodzil z pustej kartki.
 */
test('kroje z sieci nie blokuja wyswietlenia dokumentu', () => {
  const html = dokument();
  assert.match(html, /rel="preload" as="style"/);
  assert.doesNotMatch(
    html.replace(/<noscript>[\s\S]*?<\/noscript>/, ''),
    /<link rel="stylesheet"[^>]*fonts\.googleapis/,
    'poza <noscript> nie ma blokującego arkusza'
  );
  assert.match(html, /'EB Garamond', 'Iowan Old Style', Georgia, serif/, 'zapas krojów jest realny');
});

test('godlo Notariatu jest w dokumencie', () => {
  assert.match(dokument(), /<img class="glowka-znak" src="\/obrazy\/notariat\.png"/);
});

/**
 * Czego na wydruku dla klienta byc NIE MOZE (sekcja 10 specyfikacji).
 * Maskowanie robi `widoki.widokStanu()`, ale numer telefonu kancelarii
 * usunieto swiadomie z samego ukladu dokumentu.
 */
test('dokument nie niesie numeru telefonu kancelarii', () => {
  const html = informacjaZRejestru({
    kancelaria: { ...KANCELARIA, telefon: '+48 111 222 333' },
    spolka: SPOLKA,
    data: '2026-09-01',
    stan: stanPelny(),
  });
  assert.doesNotMatch(html, /111 222 333/);
});
