'use strict';

/** Wspólne rusztowanie testów: baza w pamięci, spółka, osoby i wpis przez sprawę (R1). */

const baza = require('../server/baza');
const migracje = require('../server/migracje');
const czas = require('../server/pomocnicze/czas');
const sprawy = require('../server/sprawy');
const rejestr = require('../server/rejestr');
const stan = require('../server/logika/stan');
const n = require('../server/logika/numery');
const daneSpolki = require('../server/dane/spolki');
const daneOsoby = require('../server/dane/osoby');

function bazaTestowa() {
  const db = baza.otworz(':memory:');
  migracje.uruchom(db);
  return db;
}

let krs = 1000;
function dodajSpolke(db, nadpisania = {}) {
  krs += 1;
  return daneSpolki.dodaj(db, {
    krs: String(krs).padStart(10, '0'),
    nazwa: 'Testowa P.S.A.',
    siedziba: 'Gdańsk',
    adres: 'ul. Testowa 1, 80-001 Gdańsk',
    sad_rejestrowy: 'Sąd Rejonowy Gdańsk-Północ w Gdańsku, VII Wydział Gospodarczy KRS',
    data_rejestracji: '2026-01-10',
    ...nadpisania,
  });
}

function dodajOsobe(db, nadpisania = {}) {
  return daneOsoby.dodaj(db, {
    typ: 'fizyczna',
    nazwa: 'Jan Kowalski',
    data_urodzenia: '1980-01-01',
    adres: 'ul. Długa 5, 30-002 Kraków',
    ...nadpisania,
  });
}

/** Wszystkie pozycje checklisty odhaczone — testy, które nie dotyczą checklisty. */
const CHECKLISTA_PELNA = {
  zadajacy: true,
  dokumenty: true,
  identyfikacja: true,
  ograniczenie: true,
  zgoda_spolki: true,
  zajecie: true,
  prawo_glosu: true,
};

/**
 * Sprawa doprowadzona do wpisu: „Dalej”, zgody na wpis wszystkich osób z R2, pełna checklista,
 * opłata „nie” (gdy wymagana). Zwraca id sprawy.
 */
function wpisz(db, spolkaId, operacje, { zadajacy = 'spolka', zadajacy_osoba_id: osobaId, zadajacy_opis: opis, oplata } = {}) {
  const { id } = sprawy.zaloz(
    db,
    { spolka_id: spolkaId, zadajacy, zadajacy_osoba_id: osobaId, zadajacy_opis: opis, operacje, checklista: CHECKLISTA_PELNA },
    'Test'
  );
  sprawy.dalej(db, id, 'Test');
  const p = sprawy.podglad(db, id);
  sprawy.zmien(
    db,
    id,
    {
      zgody: p.osoby.map((o) => ({ osoba_id: o.osoba_id, dopuszczalna: true, data: czas.dzisIso() })),
      oplata: oplata !== undefined ? oplata : p.oplata.wymagana ? 'nie' : null,
    },
    'Test'
  );
  sprawy.zmienStan(db, id, 'wpisana', {}, 'Test');
  return id;
}

/** Otwarcie rejestru (założenie) z podanymi seriami i akcjonariuszami. */
function otworz(db, spolkaId, tresc) {
  return wpisz(db, spolkaId, [{ typ: 'otwarcie', zrodlo: 'zalozenie', umorzone: [], atrybuty: [], ...tresc }]);
}

/** Akcjonariat w zwartej postaci: { 'osoba:seria': '1–10, 15' }, ułamki jako ' (1/2)'. */
function akcjonariat(db, spolkaId) {
  const w = stan.widok(rejestr.stanSpolki(db, spolkaId));
  const wynik = {};
  for (const p of w.akcjonariusze) {
    const k = `${p.osoba_id}:${p.seria}`;
    const opis = n.opisz(p.zakresy) + (p.czesc ? ` (${p.czesc.licznik}/${p.czesc.mianownik})` : '');
    wynik[k] = wynik[k] ? `${wynik[k]}; ${opis}` : opis;
  }
  return wynik;
}

/** Najkrótszy poprawny plik PDF — do testów wgrywania. */
const PDF_TESTOWY =
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n' +
  'trailer<</Root 1 0 R>>\n%%EOF\n';

module.exports = { bazaTestowa, dodajSpolke, dodajOsobe, wpisz, otworz, akcjonariat, CHECKLISTA_PELNA, PDF_TESTOWY };
