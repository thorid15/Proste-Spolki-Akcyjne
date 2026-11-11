'use strict';

/** Informacja z rejestru (§ 4, U-24, U-27): jedna funkcja `wydajInformacje`. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

process.env.KATALOG_DOKUMENTOW = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-informacja-'));

const { bazaTestowa, dodajSpolke, dodajOsobe, wpisz, otworz } = require('./pomoc');
const informacje = require('../server/informacje');
const pisma = require('../server/logika/pisma');
const czas = require('../server/pomocnicze/czas');
const terminy = require('../server/logika/terminy');

const akcje = (numery, liczba, seria = 'A') => ({ seria, numery, liczba });
const DZIEN_MS = 24 * 60 * 60 * 1000;

/** Rejestr otwarty trzy dni temu: A (PESEL, e-mail), B (data urodzenia, adres zamieszkania), C (spółka). */
function rejestr() {
  const db = bazaTestowa();
  const s = dodajSpolke(db, { nazwa: 'Alfa prosta spółka akcyjna', nip: '5840000001' });
  const a = dodajOsobe(db, { nazwa: 'Anna A', data_urodzenia: null, pesel: '44051401359', adres: 'ul. Lipowa 1, 80-100 Gdańsk', email: 'anna@a.example', zgoda_email: 1 });
  const b = dodajOsobe(db, { nazwa: 'Bartosz B', data_urodzenia: '1975-02-01', adres: 'ul. Klonowa 2, 80-200 Gdańsk', email: 'b@b.example', zgoda_email: 1 });
  const c = dodajOsobe(db, { typ: 'prawna', nazwa: 'Gamma sp. z o.o.', data_urodzenia: null, numer_rejestru: '0000123456', adres: 'ul. Morska 3, 81-001 Gdynia' });
  const z = dodajOsobe(db, { typ: 'prawna', nazwa: 'Bank Zastawny S.A.', data_urodzenia: null, adres: 'ul. Bankowa 1, 00-001 Warszawa' });
  db.prepare('UPDATE psa_osoby SET zgoda_email = 1 WHERE id IN (?, ?)').run(a, b);
  czas.ustawPrzesuniecie(-3 * DZIEN_MS);
  try {
    otworz(db, s, {
      serie: [{ seria: 'A', numery: '1-300', liczba: 300, data_wpisu_krs: '2026-01-10' }],
      akcjonariusze: [
        { osoba_id: a, akcje: [akcje('1-100', 100)] },
        { osoba_id: b, akcje: [akcje('101-200', 100)] },
        { osoba_id: c, akcje: [akcje('201-300', 100)] },
      ],
    });
  } finally {
    czas.ustawPrzesuniecie(0);
  }
  return { db, s, a, b, c, z };
}

const wczoraj = () => terminy.dodajDni(czas.dzisIso(), -1);
const tekst = (db, id) => pisma.tekst(db, id);
const naglowki = (db, id) =>
  require('../server/logika/wzory')
    .wypelnij(require('../server/logika/wzory').wczytaj('informacja'), pisma.wczytaj(db, id).kontekst)
    .bloki.filter((b) => b.typ === 'naglowek')
    .map((b) => b.runs.map((r) => r.tekst).join(''));

test('informacja dla spółki: wyłącznie części z § 4, pełne dane, bez kwot, przepisów i godziny', () => {
  const { db, s } = rejestr();
  const { pismoId } = informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'spolka' }, dzien: czas.dzisIso(), oplata: 'nie', kto: 'Test' });
  const p = pisma.wczytaj(db, pismoId);
  assert.match(p.numer, /^INF\/\d{4}\/0001$/);
  assert.deepEqual(naglowki(db, pismoId), ['Informacja z rejestru akcjonariuszy', 'Spółka', 'Akcje', 'Akcjonariusze']);
  const t = tekst(db, pismoId);
  assert.ok(t.includes(`Spółka | Stan na | Numer informacji\nAlfa prosta spółka akcyjna KRS `), t);
  assert.ok(t.includes(`| ${pisma.dataPl(czas.dzisIso())} | ${p.numer}`), 'metryka: stan na i numer');
  for (const fragment of ['Alfa prosta spółka akcyjna', 'Data rejestracji spółki | 10.01.2026', 'A | 1–300 | 300 | zwykłe | 10.01.2026',
    'PESEL 44051401359', 'ur. 01.02.1975', 'ul. Klonowa 2, 80-200 Gdańsk', 'anna@a.example', 'nr w rejestrze 0000123456', '| tak']) {
    assert.ok(t.includes(fragment), `brak „${fragment}”`);
  }
  for (const zakazane of [/zł/, /art\./, /§/, /odbiorca/i, /cena emisyjna/i, /REGON/, /NIP/, /\d{1,2}:\d{2}/, /5840000001/]) {
    assert.ok(!zakazane.test(t), `niedozwolone: ${zakazane}`);
  }
});

test('obciążenia i ograniczenia — sekcja tylko, gdy są; uprzywilejowanie w rodzaju akcji', () => {
  const { db, s, a, z } = rejestr();
  wpisz(db, s, [{ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zastaw', osoba_id: z, prawo_glosu: true, akcje: [akcje('1-20', 20)] }]);
  wpisz(db, s, [{ typ: 'adnotacja', operacja: 'dodanie', rodzaj: 'uprawnienie', tresc: 'dwa głosy na akcję', akcje: [akcje('1-10', 10)] }]);
  const { pismoId } = informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'spolka' }, dzien: czas.dzisIso(), oplata: 'nie', kto: 'Test' });
  assert.ok(naglowki(db, pismoId).includes('Obciążenia, ograniczenia, obowiązki'));
  const t = tekst(db, pismoId);
  assert.ok(t.includes('A 1–20 | zastaw | Bank Zastawny S.A. | tak'), t);
  assert.ok(t.includes('uprzywilejowane nr 1–10: dwa głosy na akcję; pozostałe zwykłe'), t);
  void a;
});

test('maskowanie: akcjonariusz widzi swoje dane, u innych — bez PESEL, daty urodzenia i adresu zamieszkania; e-mail jawny (D-182)', () => {
  const { db, s, a } = rejestr();
  const { pismoId } = informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'osoba', osobaId: a }, dzien: czas.dzisIso(), oplata: 'nie', kto: 'Test' });
  const t = tekst(db, pismoId);
  assert.ok(t.includes('PESEL 44051401359') && t.includes('ul. Lipowa 1, 80-100 Gdańsk') && t.includes('anna@a.example'));
  assert.ok(t.includes('Bartosz B'));
  for (const ukryte of ['ur. 01.02.1975', 'ul. Klonowa 2']) assert.ok(!t.includes(ukryte), `widać „${ukryte}”`);
  assert.ok(t.includes('b@b.example'), 'e-mail innego akcjonariusza (przy zgodzie) jest jawny');
  assert.ok(t.includes('Gamma sp. z o.o.') && t.includes('ul. Morska 3, 81-001 Gdynia'), 'siedziba osoby prawnej nie jest adresem zamieszkania');
  assert.ok(!/pomini|ukryt|zamaskow/i.test(t), 'bez dopisków o pominięciu');
  assert.equal(pisma.wczytaj(db, pismoId).adresat_osoba_id, a);
});

test('organ: pełne dane, zawsze bez opłaty, sygnatura i nazwa organu tylko w rekordzie pisma, list', () => {
  const { db, s } = rejestr();
  const { pismoId } = informacje.wydajInformacje(db, {
    spolkaId: s,
    odbiorca: { rodzaj: 'organ', opis: 'Komornik Sądowy przy SR w Gdańsku' },
    sygnatura: 'KM 123/26',
    dzien: czas.dzisIso(),
    oplata: 'tak',
    kto: 'Test',
  });
  const p = pisma.wczytaj(db, pismoId);
  assert.deepEqual([p.adresat, p.adresat_opis, p.sygnatura, p.kanal], ['organ', 'Komornik Sądowy przy SR w Gdańsku', 'KM 123/26', 'list']);
  const t = tekst(db, pismoId);
  assert.ok(t.includes('ur. 01.02.1975'));
  assert.ok(!t.includes('KM 123/26') && !t.includes('Komornik'));
  assert.equal(db.prepare("SELECT COUNT(*) AS ile FROM psa_oplaty WHERE typ = 'informacja'").get().ile, 0);
  assert.throws(
    () => informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'organ', opis: 'Sąd' }, dzien: czas.dzisIso(), kto: 'Test' }),
    (e) => e.name === 'BladWalidacji' && e.bledy.some((b) => b.pole === 'sygnatura')
  );
});

test('U-02: informacja wydawana przez pracownika — 50 zł albo bez opłaty, wybór obowiązkowy', () => {
  const { db, s, a } = rejestr();
  assert.throws(
    () => informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'spolka' }, dzien: czas.dzisIso(), kto: 'Test' }),
    (e) => e.name === 'BladWalidacji' && e.bledy.some((b) => b.pole === 'oplata')
  );
  const { pismoId } = informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'osoba', osobaId: a }, dzien: czas.dzisIso(), oplata: 'tak', kto: 'Test' });
  const o = db.prepare("SELECT * FROM psa_oplaty WHERE typ = 'informacja'").get();
  assert.deepEqual([o.kwota_netto_grosze, o.platnik, o.platnik_osoba_id, o.pismo_id], [5000, 'osoba', a, pismoId]);
});

test('U-24: portal — najpóźniej wczoraj (domyślnie), pracownik — także dziś z dzisiejszymi wpisami', () => {
  const { db, s, a, b } = rejestr();
  wpisz(db, s, [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: b, akcje: [akcje('1-10', 10)] }] }]);
  const portal = informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'spolka' }, zrodlo: 'portal', kto: 'konto:1' });
  assert.equal(pisma.wczytaj(db, portal.pismoId).kontekst.stan_na, pisma.dataPl(wczoraj()));
  assert.ok(tekst(db, portal.pismoId).includes('Anna A') && tekst(db, portal.pismoId).includes('| 1–100 | 100'));
  assert.throws(
    () => informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'spolka' }, zrodlo: 'portal', dzien: czas.dzisIso(), kto: 'konto:1' }),
    (e) => e.name === 'BladWalidacji' && e.bledy.some((x) => x.pole === 'dzien')
  );
  const kancelaria = informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'spolka' }, dzien: czas.dzisIso(), oplata: 'nie', kto: 'Test' });
  assert.ok(tekst(db, kancelaria.pismoId).includes('| 11–100 | 90'));
  assert.throws(
    () => informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'spolka' }, dzien: terminy.dodajDni(czas.dzisIso(), -10), oplata: 'nie', kto: 'Test' }),
    (e) => e.bledy.some((x) => x.pole === 'dzien')
  );
});

test('portal: pierwsza informacja dopiero dzień po otwarciu rejestru', () => {
  const db = bazaTestowa();
  const s = dodajSpolke(db);
  const a = dodajOsobe(db);
  otworz(db, s, { serie: [{ seria: 'A', numery: '1-10', liczba: 10, data_wpisu_krs: '2026-01-10' }], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-10', 10)] }] });
  assert.throws(
    () => informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'spolka' }, zrodlo: 'portal', kto: 'konto:1' }),
    (e) => e.bledy.some((x) => x.pole === 'dzien' && /Dostępna od/.test(x.komunikat))
  );
});

test('każde wydanie informacji trafia do dziennika', () => {
  const { db, s, a } = rejestr();
  informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'osoba', osobaId: a }, dzien: czas.dzisIso(), oplata: 'nie', kto: 'Test' });
  const w = db.prepare("SELECT * FROM psa_dziennik WHERE akcja = 'informacja_z_rejestru'").get();
  assert.deepEqual([w.kto, w.typ_kto, w.spolka_id, w.osoba_id], ['Test', 'pracownik', s, a]);
  assert.match(w.opis, /^INF\/\d{4}\/0001/);
});

test('§ 4: spółka z 10 akcjonariuszami i 3 seriami — informacja na jednej stronie', async () => {
  const db = bazaTestowa();
  const s = dodajSpolke(db);
  const osoby = Array.from({ length: 10 }, (_, i) =>
    dodajOsobe(db, { nazwa: `Katarzyna Przykładowa-Nowak ${i + 1}`, data_urodzenia: null, pesel: '44051401359', adres: 'ul. Długa 125/14, 80-001 Gdańsk', email: `k${i}@przyklad.example` })
  );
  db.prepare(`UPDATE psa_osoby SET zgoda_email = 1`).run();
  otworz(db, s, {
    serie: [['A', 400], ['B', 300], ['C', 300]].map(([seria, l]) => ({ seria, numery: `1-${l}`, liczba: l, data_wpisu_krs: '2026-01-10' })),
    akcjonariusze: osoby.map((o, i) => {
      const [seria, k] = i < 4 ? ['A', i] : i < 7 ? ['B', i - 4] : ['C', i - 7];
      return { osoba_id: o, akcje: [{ seria, numery: `${k * 100 + 1}-${k * 100 + 100}`, liczba: 100 }] };
    }),
  });
  const { pismoId } = informacje.wydajInformacje(db, { spolkaId: s, odbiorca: { rodzaj: 'spolka' }, oplata: 'nie', kto: 'Test' });
  const p = pisma.wczytaj(db, pismoId);
  const { strony } = await pisma.renderuj('informacja', p.kontekst, p.numer);
  assert.equal(strony, 1);
});
