'use strict';

/**
 * Wdrożenie decyzji z SESJA-PSA-ANALIZA-PRZEPLYWOW (docs/analiza/RAPORT-PRZEPLYWY.md, D-095–D-106, B-001–B-006).
 * Testy jednostkowe; przebiegi w przeglądarce — `npm run e2e` (testy/e2e/scenariusze).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const typyZdarzen = require('../server/logika/typy-zdarzen');
const kreator = require('../server/logika/kreator');

test('D-103 / B-002: sprostowanie tylko z historii zdarzeń — nie ma go w kreatorze (każdy typ kreatora ma budowniczego)', () => {
  const wKreatorze = typyZdarzen.dostepneWKreatorze().map((t) => t.kod);
  assert.ok(!wKreatorze.includes('sprostowanie'), 'sprostowanie poza kafelkami kreatora');
  const bezBudowniczego = wKreatorze.filter((kod) => {
    try { kreator.przygotuj({ emisje: [], akcje: [], obciazenia: [], ograniczenia: [], uprawnienia: [] }, { typ: kod, dane: {} }); } catch (e) {
      return /nie jest jeszcze obsługiwany/.test(e.message);
    }
    return false;
  });
  assert.deepEqual(bezBudowniczego, []);
});

const L = require('../publiczne/js/wpis-zbycia-logika.js');

test('D-104: domyślny adresat uprzedniego powiadomienia = osoba, której prawa zmienia wpis', () => {
  assert.equal(L.odbiorcaPowiadomienia('przeniesienie', { zbywca_osoba_id: 7 }), 7);
  assert.equal(L.odbiorcaPowiadomienia('przeniesienie_ulamka', { zbywca_osoba_id: 8 }), 8);
  assert.equal(L.odbiorcaPowiadomienia('umorzenie', { pozycje: [{ osoba_id: 3, ilosc: 10 }] }), 3);
  assert.equal(L.odbiorcaPowiadomienia('obciazenie', { akcjonariusz_osoba_id: 4 }), 4);
  assert.equal(L.odbiorcaPowiadomienia('zobowiazanie', { akcjonariusz_osoba_id: 5 }), 5);
  const stan = { obciazenia: [{ klucz: 11, akcjonariusz: { id: 6 } }] }; // kształt `GET /api/psa/spolki/:id`
  assert.equal(L.odbiorcaPowiadomienia('prawo_glosu_zastawnika', { obciazenie_zdarzenie_id: 11 }, stan), 6);
  assert.equal(L.odbiorcaPowiadomienia('emisja', { seria: 'B' }), null, 'typ bez powiadomienia');
  assert.equal(L.odbiorcaPowiadomienia('obciazenie', {}), null, 'brak danych — brak domyślnego');
});

test('A-013: domyślny charakter żądającego wynika z typu wpisu', () => {
  assert.equal(L.domyslnyCharakterZadajacego('przeniesienie'), 'nabywca');
  assert.equal(L.domyslnyCharakterZadajacego('obciazenie'), 'zastawnik');
  assert.equal(L.domyslnyCharakterZadajacego('wykreslenie_obciazenia'), 'akcjonariusz');
  assert.equal(L.domyslnyCharakterZadajacego('emisja'), 'spolka');
  assert.equal(L.domyslnyCharakterZadajacego('zajecie'), '', 'z urzędu — bez żądającego');
});

test('D-100: w interfejsie „Zbycie akcji” zamiast „Przeniesienie akcji” (pisma — nazwa typu bez zmian)', () => {
  assert.equal(L.nazwaCzynnosci('przeniesienie', 'Przeniesienie akcji'), 'Zbycie akcji');
  assert.equal(L.nazwaCzynnosci('przeniesienie_ulamka', 'Przeniesienie ułamkowej części akcji'), 'Zbycie ułamkowej części akcji');
  assert.equal(L.nazwaCzynnosci('emisja', 'Emisja akcji'), 'Emisja akcji');
  assert.equal(typyZdarzen.typ('przeniesienie').nazwa, 'Przeniesienie akcji', 'nazwa typu (pisma) bez zmian');
});

// ── Etap 4 ──

test('D-097: jeden kreator — kroki „Co” → „Podstawa” → „Sprawdzenie i wpis” dla każdego typu (zbycie: „Co się zbywa”)', () => {
  assert.deepEqual(L.krokiWpisu('przeniesienie'), ['Co się zbywa', 'Podstawa', 'Sprawdzenie i wpis']);
  for (const kod of typyZdarzen.dostepneWKreatorze()) {
    const kroki = L.krokiWpisu(kod);
    assert.equal(kroki.length, 3, kod);
    assert.deepEqual(kroki.slice(1), ['Podstawa', 'Sprawdzenie i wpis'], kod);
  }
});

test('A-005: rodzaj dokumentu podstawy domyślny z typu — zawsze z katalogu (art. 300(34) § 4)', () => {
  const katalog = Object.values(require('../server/logika/przepisy').RODZAJE_DOKUMENTU);
  for (const kod of typyZdarzen.dostepneWKreatorze()) assert.ok(katalog.includes(L.domyslnyRodzajDokumentu(kod, { emisje: [{}] })), kod);
  assert.equal(L.domyslnyRodzajDokumentu('przeniesienie'), 'umowa_zbycia');
  assert.equal(L.domyslnyRodzajDokumentu('emisja', { emisje: [] }), 'umowa_spolki', 'pierwsza emisja — umowa spółki');
  assert.equal(L.domyslnyRodzajDokumentu('emisja', { emisje: [{}] }), 'uchwala');
  assert.equal(L.domyslnyRodzajDokumentu('objecie', { emisje: [{}] }), 'umowa_spolki', 'objęcie pierwszej emisji');
  assert.equal(L.domyslnyRodzajDokumentu('uniewaznienie'), 'postanowienie');
});

test('D-097: żądający podstawiony z kroku „Co” zgodnie z charakterem', () => {
  assert.equal(L.osobaWCharakterze('przeniesienie', 'nabywca', { nabywca_osoba_id: 3, zbywca_osoba_id: 1 }), 3);
  assert.equal(L.osobaWCharakterze('przeniesienie', 'zbywca', { nabywca_osoba_id: 3, zbywca_osoba_id: 1 }), 1);
  assert.equal(L.osobaWCharakterze('obciazenie', 'zastawnik', { akcjonariusz_osoba_id: 1, osoba_id: 3 }), 3);
  assert.equal(L.osobaWCharakterze('obciazenie', 'akcjonariusz', { akcjonariusz_osoba_id: 1, osoba_id: 3 }), 1);
  const stan = { obciazenia: [{ klucz: 9, akcjonariusz: { id: 1 }, uprawniony: { id: 3 } }] };
  assert.equal(L.osobaWCharakterze('wykreslenie_obciazenia', 'akcjonariusz', { obciazenie_zdarzenie_id: 9 }, stan), 1);
  assert.equal(L.osobaWCharakterze('prawo_glosu_zastawnika', 'zastawnik', { obciazenie_zdarzenie_id: 9 }, stan), 3);
  assert.equal(L.osobaWCharakterze('zmiana_danych_akcjonariusza', 'akcjonariusz', { osoba_id: 2 }), 2);
  assert.equal(L.osobaWCharakterze('zobowiazanie', 'nabywca', { akcjonariusz_osoba_id: 1 }), null, 'uprawniony spoza kroku 1 — wybór ręczny');
  assert.equal(L.osobaWCharakterze('emisja', 'spolka', {}), null);
});

test('D-097: krok „Co” gotowy dopiero z minimum danych; dane startowe z wiersza kokpitu', () => {
  assert.equal(L.coGotowe('obciazenie', { emisja_zdarzenie_id: 1, akcjonariusz_osoba_id: 1 }), false);
  assert.equal(L.coGotowe('obciazenie', { emisja_zdarzenie_id: 1, akcjonariusz_osoba_id: 1, osoba_id: 3 }), true);
  assert.equal(L.coGotowe('zdarzenie_inne', { opis: '  ' }), false);
  assert.equal(L.coGotowe('uprawnienie', {}), true, 'typ bez minimum — ocenia podgląd serwera');
  assert.deepEqual(L.poczatekWpisu('przeniesienie', { osoba: '2', emisja: '1' }), { zbywca_osoba_id: 2, emisja_klucz: 1 });
  assert.deepEqual(L.poczatekWpisu('obciazenie', { osoba: '2', emisja: '1', zakres: '1–10' }), { emisja_zdarzenie_id: 1, akcjonariusz_osoba_id: 2, zakresy_tekst: '1-10' });
  assert.deepEqual(L.poczatekWpisu('umorzenie', {}), {});
});

test('D-102: krok „Co” zmiany danych gotowy dopiero z nowymi danymi z kartoteki', () => {
  assert.equal(L.coGotowe('zmiana_danych_akcjonariusza', { osoba_id: 1 }), false);
  assert.equal(L.coGotowe('zmiana_danych_akcjonariusza', { osoba_id: 1, po: { miejscowosc: 'Sopot' } }), true);
});

test('D-101: reprezentant spółki z kartoteki — umowa bierze dane osobowe z osoby, funkcję i dowód ze spółki', () => {
  const { zReprezentantem } = require('../server/rejestr');
  const kontekstPisma = require('../server/logika/kontekst-pisma');
  const osoba = { imie: 'Jan', nazwisko: 'Kowalski', pesel: '80010112345', kraj: 'Polska', kod_pocztowy: '80-001', miejscowosc: 'Gdańsk', ulica: 'Długa', nr_domu: '1', email: 'jan@example.com', aml_status: 'wykonane' };
  const db = { prepare: () => ({ get: () => osoba }) };
  const spolka = { id: 1, nazwa: 'Alfa P.S.A.', reprezentant_osoba_id: 5, reprezentant_imie_nazwisko: 'Stare Dane', reprezentant_funkcja: 'Prezes Zarządu', reprezentant_dowod_rodzaj: 'dowod_osobisty', reprezentant_dowod_numer: 'ABC123456' };
  const scalona = zReprezentantem(db, spolka);
  const k = kontekstPisma.reprezentantKlucze(scalona); // te same klucze co w umowie (wzór 01)
  assert.equal(k.reprezentant_imie_nazwisko, 'Jan Kowalski');
  assert.equal(k.reprezentant_pesel, '80010112345');
  assert.equal(k.reprezentant_funkcja, 'Prezes Zarządu');
  assert.match(k.reprezentant_adres, /Gdańsk/);
  assert.match(k.reprezentant_dowod, /ABC123456/);
  assert.equal(zReprezentantem(db, { id: 2, reprezentant_imie_nazwisko: 'Bez Osoby' }).reprezentant_imie_nazwisko, 'Bez Osoby', 'bez osoby — dawne kolumny');
});

test('D-114: data wpisu emisji — założycielska z datą rejestracji spółki, kolejne nie wcześniej (ostrzeżenia)', () => {
  const walidacje = require('../server/logika/walidacje');
  const spolka = { id: 1, data_utworzenia_spolki: '2026-01-10' };
  const emisja = (data) => ({ typ: 'emisja', chwila: '2026-11-07T10:00:00.000Z', dane: { seria: 'Z', ilosc: 10, nr_pierwszy: 1, data_wpisu_krs: data, zakresy: [{ nr_od: 1, nr_do: 10 }] } });
  const pierwsza = walidacje.sprawdz({ zdarzenia: [], propozycja: emisja('2026-02-01'), spolka });
  assert.ok(pierwsza.ostrzezenia.some((o) => o.includes('Emisja założycielska następuje z chwilą rejestracji spółki')));
  const zgodna = walidacje.sprawdz({ zdarzenia: [], propozycja: emisja('2026-01-10'), spolka });
  assert.ok(!zgodna.ostrzezenia.some((o) => o.includes('Emisja założycielska')));
});

test('D-118: wpis na rzecz osoby prawnej bez beneficjenta — ostrzeżenie, nie blokada', () => {
  const walidacje = require('../server/logika/walidacje');
  const ostrzezenia = [];
  const bledy = [];
  const osoby = new Map([[7, { id: 7, typ: 'prawna', nazwa: 'Holding', aml_status: 'wykonane' }]]);
  walidacje._sprawdzAml({ typ: 'objecie', dane: { pozycje: [{ osoba_id: 7 }] } }, osoby, bledy, ostrzezenia);
  assert.equal(bledy.length, 0);
  assert.ok(ostrzezenia.some((o) => o.includes('bez wskazanego beneficjenta')), JSON.stringify(ostrzezenia));
});
