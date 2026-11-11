'use strict';

/**
 * Faza 1 — R2 (art. 300³⁴ § 3 KSH): kogo powiadomić przed wpisem (`ktoTraci`) dla każdego typu
 * i cykl powiadomień: powstają po kroku 1, kanał według zgody (R9), wpis czeka na wysłanie albo
 * zgodę, zmiana treści usuwa niewysłane i unieważnia wysłane, powiadomienie o wpisie (§ 7).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const rejestr = require('../server/rejestr');
const sprawy = require('../server/sprawy');
const stan = require('../server/logika/stan');
const pisma = require('../server/logika/pisma');
const daneRejestr = require('../server/dane/rejestr');
const daneOsoby = require('../server/dane/osoby');
const daneSpolki = require('../server/dane/spolki');
const czas = require('../server/pomocnicze/czas');
const { bazaTestowa, dodajSpolke, dodajOsobe, wpisz, otworz, CHECKLISTA_PELNA } = require('./pomoc');

const akcje = (numery, liczba, seria = 'A', ulamek) => ({ seria, numery, liczba, ...(ulamek ? { ulamek } : {}) });

/** A: A 1–100, B: A 101–200, zastaw Z na A 1–10 bez prawa głosu, uprawnienie na B 101–110. */
function rejestrZAtrybutami() {
  const db = bazaTestowa();
  const s = dodajSpolke(db);
  const [a, b, c, z] = ['Anna', 'Bartosz', 'Cezary', 'Zastawnik'].map((nazwa) => dodajOsobe(db, { nazwa }));
  otworz(db, s, {
    serie: [{ seria: 'A', numery: '1-200', liczba: 200, data_wpisu_krs: '2026-01-10' }],
    akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-100', 100)] }, { osoba_id: b, akcje: [akcje('101-200', 100)] }],
    atrybuty: [
      { rodzaj: 'zastaw', osoba_id: z, prawo_glosu: false, akcje: [akcje('1-10', 10)] },
      { rodzaj: 'uprawnienie', tresc: 'dywidenda uprzywilejowana', akcje: [akcje('101-110', 10)] },
      { rodzaj: 'ograniczenie', tresc: 'zgoda zarządu', akcje: [akcje('150-160', 11)] },
    ],
  });
  return { db, s, a, b, c, z };
}

const ref = (pozycja) => ({ zdarzenie_id: 1, pozycja });

function ktoTraci(ctx, operacje, zadajacy = 'spolka', opis) {
  const { id } = sprawy.zaloz(ctx.db, { spolka_id: ctx.s, zadajacy, zadajacy_opis: opis, operacje }, 'Test');
  const sprawa = sprawy.podglad(ctx.db, id);
  assert.deepEqual(sprawa.bledy, [], JSON.stringify(sprawa.bledy));
  return sprawa.osoby.map((o) => o.osoba_id).sort((x, y) => x - y);
}

const PRZYPADKI = [
  {
    nazwa: 'emisja — nikt nie traci',
    operacje: ({ c }) => [{ typ: 'emisja', seria: 'B', numery: '1-5', liczba: 5, data_wpisu_krs: '2026-03-01', pokryte: true, obejmujacy: [{ osoba_id: c, numery: '1-5', liczba: 5 }] }],
    oczekiwane: () => [],
  },
  {
    nazwa: 'przeniesienie całych akcji — zbywca',
    operacje: ({ a, c }) => [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: c, akcje: [akcje('50-60', 11)] }] }],
    oczekiwane: ({ a }) => [a],
  },
  {
    nazwa: 'przeniesienie ułamka — zbywca traci część akcji',
    operacje: ({ b, c }) => [{ typ: 'przeniesienie', zbywca_osoba_id: b, nabywcy: [{ osoba_id: c, akcje: [akcje('200', 1, 'A', '1/2')] }] }],
    oczekiwane: ({ b }) => [b],
  },
  {
    nazwa: 'umorzenie akcji obciążonych zastawem — akcjonariusz i zastawnik',
    operacje: () => [{ typ: 'umorzenie', podstawa: 'uchwala', akcje: [akcje('1-5', 5)] }],
    oczekiwane: ({ a, z }) => [a, z],
  },
  {
    nazwa: 'ustanowienie zastawu — akcjonariusz, którego akcje są obciążane',
    operacje: ({ b, c }) => [{ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zastaw', osoba_id: c, akcje: [akcje('190-195', 6)] }],
    oczekiwane: ({ b }) => [b],
  },
  {
    nazwa: 'przyznanie prawa głosu zastawnikowi — akcjonariusz (art. 300³⁴ § 3: uprawnienia zmieniane)',
    operacje: () => [{ typ: 'obciazenie', operacja: 'zmiana_prawa_glosu', atrybut: ref(0), prawo_glosu: true, akcje: [akcje('1-10', 10)] }],
    oczekiwane: ({ a }) => [a],
  },
  {
    nazwa: 'wykreślenie zastawu — zastawnik',
    operacje: () => [{ typ: 'obciazenie', operacja: 'wykreslenie', atrybut: ref(0), akcje: [akcje('1-10', 10)] }],
    oczekiwane: ({ z }) => [z],
  },
  {
    nazwa: 'zajęcie — z urzędu, bez powiadomień',
    operacje: () => [{ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zajecie', akcje: [akcje('1-10', 10)] }],
    zadajacy: ['organ', 'Komornik — Km 1/26'],
    oczekiwane: () => [],
  },
  {
    nazwa: 'wykreślenie adnotacji „uprawnienie” — akcjonariusz',
    operacje: () => [{ typ: 'adnotacja', operacja: 'wykreslenie', atrybut: ref(1), akcje: [akcje('101-110', 10)] }],
    oczekiwane: ({ b }) => [b],
  },
  {
    nazwa: 'wykreślenie ograniczenia — nikt nie traci',
    operacje: () => [{ typ: 'adnotacja', operacja: 'wykreslenie', atrybut: ref(2), akcje: [akcje('150-160', 11)] }],
    oczekiwane: () => [],
  },
  {
    nazwa: 'dodanie adnotacji — nikt nie traci',
    operacje: () => [{ typ: 'adnotacja', operacja: 'dodanie', rodzaj: 'obowiazek', tresc: 'świadczenie', akcje: [akcje('1-200', 200)] }],
    oczekiwane: () => [],
  },
  {
    nazwa: 'zamknięcie rejestru — nikt nie traci',
    operacje: () => [{ typ: 'zamkniecie', powod: 'przekazanie' }],
    oczekiwane: () => [],
  },
];

for (const p of PRZYPADKI) {
  test(`ktoTraci: ${p.nazwa}`, () => {
    const ctx = rejestrZAtrybutami();
    const [zadajacy, opis] = p.zadajacy || ['spolka'];
    assert.deepEqual(ktoTraci(ctx, p.operacje(ctx), zadajacy, opis), p.oczekiwane(ctx));
  });
}

test('ktoTraci: otwarcie nikogo nie powiadamia; sprostowanie — kto traci po zastąpieniu albo wycofaniu', () => {
  const pusty = stan.odtworzStan([]);
  assert.deepEqual(stan.ktoTraci(pusty, pusty), []);

  const ctx = rejestrZAtrybutami();
  wpisz(ctx.db, ctx.s, [{ typ: 'przeniesienie', zbywca_osoba_id: ctx.a, nabywcy: [{ osoba_id: ctx.c, akcje: [akcje('50-60', 11)] }] }]);
  const cel = daneRejestr.zdarzeniaSpolki(ctx.db, ctx.s).pop().id;
  assert.deepEqual(ktoTraci(ctx, [{ typ: 'sprostowanie', zdarzenie_id: cel, tryb: 'wycofaj' }], 'brak'), [ctx.c], 'wycofanie — nabywca traci');
  assert.deepEqual(
    ktoTraci(ctx, [{ typ: 'sprostowanie', zdarzenie_id: cel, tryb: 'zastap', zamiast: { typ: 'przeniesienie', zbywca_osoba_id: ctx.a, nabywcy: [{ osoba_id: ctx.c, akcje: [akcje('50-55', 6)] }] } }], 'brak'),
    [ctx.c],
    'mniej akcji niż we wpisie — nabywca traci'
  );
});

// ─────────────────────────────────────────────────────────────
// Cykl powiadomień
// ─────────────────────────────────────────────────────────────

function zbycie(ctx, zbywca, numery = '11-20') {
  return sprawy.zaloz(
    ctx.db,
    { spolka_id: ctx.s, zadajacy: 'osoba', zadajacy_osoba_id: ctx.c, checklista: CHECKLISTA_PELNA, oplata: 'nie', operacje: [{ typ: 'przeniesienie', zbywca_osoba_id: zbywca, nabywcy: [{ osoba_id: ctx.c, akcje: [akcje(numery, 10)] }] }] },
    'Test'
  ).id;
}
const zamierzone = (db, id) => pisma.lista(db, { sprawaId: id }).filter((p) => p.typ === 'powiadomienie_zamierzony');

test('R2/R9: powiadomienia powstają po kroku 1, kanał według zgody na e-mail; wpis czeka na wysłanie albo zgodę', () => {
  const ctx = rejestrZAtrybutami();
  daneOsoby.zmien(ctx.db, ctx.a, { email: 'anna@example.com' }, 'Test');
  daneOsoby.ustawZgodeEmail(ctx.db, ctx.a, { zgoda: true, plikId: null }, 'Test');
  const id = zbycie(ctx, ctx.a);
  assert.equal(zamierzone(ctx.db, id).length, 0, 'przed „Dalej” nie ma powiadomień');
  sprawy.dalej(ctx.db, id, 'Test');
  const [p] = zamierzone(ctx.db, id);
  assert.deepEqual([p.adresat_osoba_id, p.kanal, p.stan], [ctx.a, 'email', 'do_wyslania']);
  assert.throws(() => sprawy.zmienStan(ctx.db, id, 'wpisana', {}, 'Test'), /Brak wysłanego powiadomienia o zamierzonym wpisie albo zgody na wpis: Anna/);
  assert.throws(() => pisma.nadano(ctx.db, p.id), /wyłącznie listów/);
  pisma.zmienStan(ctx.db, p.id, 'blad', { odpowiedzSerwera: '550' });
  assert.throws(() => sprawy.zmienStan(ctx.db, id, 'wpisana', {}, 'Test'), /Brak wysłanego powiadomienia/);
  pisma.zmienStan(ctx.db, p.id, 'wyslane', { idWiadomosci: '<1@x>' });
  assert.equal(sprawy.zmienStan(ctx.db, id, 'wpisana', {}, 'Test').stan, 'wpisana');
});

test('R2: list — wpis po „Nadano”; zgoda na wpis usuwa niewysłane powiadomienie', () => {
  const ctx = rejestrZAtrybutami();
  const id = zbycie(ctx, ctx.a);
  sprawy.dalej(ctx.db, id, 'Test');
  const [p] = zamierzone(ctx.db, id);
  assert.equal(p.kanal, 'list');
  assert.equal(pisma.nadano(ctx.db, p.id).wyslano, czas.dzisIso());
  assert.equal(sprawy.zmienStan(ctx.db, id, 'wpisana', {}, 'Test').stan, 'wpisana');

  const id2 = zbycie(ctx, ctx.a, '21-30');
  sprawy.dalej(ctx.db, id2, 'Test');
  assert.equal(zamierzone(ctx.db, id2).length, 1);
  assert.throws(() => sprawy.zmien(ctx.db, id2, { zgody: [{ osoba_id: ctx.a, dopuszczalna: false, data: czas.dzisIso() }] }, 'Test'), /dopuszczalnej formie/);
  sprawy.zmien(ctx.db, id2, { zgody: [{ osoba_id: ctx.a, dopuszczalna: true, data: czas.dzisIso() }] }, 'Test');
  assert.equal(zamierzone(ctx.db, id2).length, 0, 'zgoda — niewysłane powiadomienie usunięte');
  sprawy.zmien(ctx.db, id2, { zgody: [] }, 'Test');
  assert.equal(zamierzone(ctx.db, id2).length, 1, 'cofnięta zgoda — powiadomienie powstaje od razu');
  sprawy.zmien(ctx.db, id2, { zgody: [{ osoba_id: ctx.a, dopuszczalna: true, data: czas.dzisIso() }] }, 'Test');
  assert.equal(sprawy.zmienStan(ctx.db, id2, 'wpisana', {}, 'Test').stan, 'wpisana');
});

test('R2: zmiana treści po kroku 1 — niewysłane znikają, wysłane tracą ważność, wpis wymaga nowych', () => {
  const ctx = rejestrZAtrybutami();
  const id = zbycie(ctx, ctx.a);
  sprawy.dalej(ctx.db, id, 'Test');
  pisma.nadano(ctx.db, zamierzone(ctx.db, id)[0].id);
  assert.throws(() => sprawy.zmien(ctx.db, id, { podstawa: 'inna' }, 'Test'), /Zmień treść/);
  sprawy.zmienTresc(ctx.db, id);
  assert.ok(zamierzone(ctx.db, id)[0].uniewaznione, 'wysłane unieważnione');
  sprawy.zmien(ctx.db, id, { podstawa: 'Umowa z poprawką' }, 'Test');
  sprawy.dalej(ctx.db, id, 'Test');
  const lista = zamierzone(ctx.db, id);
  assert.deepEqual(lista.map((p) => [p.stan, Boolean(p.uniewaznione)]), [['wyslane', true], ['do_wyslania', false]]);
  assert.throws(() => sprawy.zmienStan(ctx.db, id, 'wpisana', {}, 'Test'), /Brak wysłanego powiadomienia/);
  sprawy.zmienTresc(ctx.db, id);
  assert.equal(zamierzone(ctx.db, id).length, 1, 'niewysłane nowe powiadomienie usunięte');
});

test('R2: pracownik dopisuje osobę — powstaje jej powiadomienie; wyliczonej nie usunie', () => {
  const ctx = rejestrZAtrybutami();
  const id = zbycie(ctx, ctx.a);
  sprawy.dalej(ctx.db, id, 'Test');
  sprawy.zmien(ctx.db, id, { dopisane: [ctx.b] }, 'Test');
  assert.deepEqual(zamierzone(ctx.db, id).map((p) => p.adresat_osoba_id).sort(), [ctx.a, ctx.b].sort());
  const osoby = sprawy.podglad(ctx.db, id).osoby;
  assert.deepEqual(osoby.map((o) => [o.osoba_id, o.dopisana]), [[ctx.a, false], [ctx.b, true]]);
  sprawy.zmien(ctx.db, id, { dopisane: [] }, 'Test');
  assert.deepEqual(zamierzone(ctx.db, id).map((p) => p.adresat_osoba_id), [ctx.a], 'usunięta dopisana — jej niewysłane pismo znika, wyliczona zostaje');
});

test('§ 7: powiadomienie o wpisie — spółka (e-mail z umowy) i żądający; wpis jednym kliknięciem bez powiadomień', () => {
  const ctx = rejestrZAtrybutami();
  daneSpolki.zmien(ctx.db, ctx.s, { email: 'biuro@spolka.example' }, 'Test');
  const id = zbycie(ctx, ctx.a);
  sprawy.dalej(ctx.db, id, 'Test');
  pisma.nadano(ctx.db, zamierzone(ctx.db, id)[0].id);
  sprawy.zmienStan(ctx.db, id, 'wpisana', {}, 'Test');
  const oWpisie = pisma.lista(ctx.db, { sprawaId: id }).filter((p) => p.typ === 'powiadomienie_wpis');
  assert.deepEqual(oWpisie.map((p) => [p.adresat, p.adresat_osoba_id, p.kanal, p.stan]), [['spolka', null, 'email', 'do_wyslania'], ['osoba', ctx.c, 'list', 'do_wyslania']]);
  assert.equal(oWpisie[0].kontekst.wpis_data, pisma.dataPl(czas.dzisIso()));

  assert.throws(
    () => sprawy.zaloz(ctx.db, { spolka_id: ctx.s, zadajacy: 'spolka', wpisz: true, checklista: CHECKLISTA_PELNA, oplata: 'nie', operacje: [{ typ: 'przeniesienie', zbywca_osoba_id: ctx.a, nabywcy: [{ osoba_id: ctx.c, akcje: [akcje('30', 1)] }] }] }, 'Test'),
    /Brak wysłanego powiadomienia/
  );
  assert.equal(sprawy.lista(ctx.db, { spolkaId: ctx.s }).length, 2, 'nieudany wpis jednym kliknięciem — sprawa nie powstaje');
  const r = sprawy.zaloz(ctx.db, { spolka_id: ctx.s, zadajacy: 'spolka', wpisz: true, checklista: CHECKLISTA_PELNA, operacje: [{ typ: 'adnotacja', operacja: 'dodanie', rodzaj: 'inna', tresc: 'wspólny przedstawiciel: Anna', akcje: [akcje('150', 1)] }] }, 'Test');
  assert.equal(sprawy.podglad(ctx.db, r.id).sprawa.stan, 'wpisana');
});

test('R2: powiadomienia dla otwartego rejestru liczą się z porównania stanu — rejestr bez wpisów nikogo nie powiadamia', () => {
  const db = bazaTestowa();
  const s = dodajSpolke(db);
  const a = dodajOsobe(db);
  const { id } = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'spolka', operacje: [{ typ: 'otwarcie', zrodlo: 'przejecie', serie: [{ seria: 'A', numery: '1-10', liczba: 10, data_wpisu_krs: '2026-01-10' }], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-10', 10)] }] }] }, 'Test');
  assert.deepEqual(sprawy.podglad(db, id).osoby, []);
  assert.equal(rejestr.stanSpolki(db, s).otwarty, false);
});
