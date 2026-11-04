'use strict';

/** W7.10 — statusy § 7.3 jako maszyna stanów: każde przejście, warunki, „Wygasła” po 12 miesiącach. */

const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../server/logika/przeniesienie');

const dokumenty = (...typy) => typy.map((typ) => ({ typ }));
const wszystkie = (def) => Object.fromEntries(def.map((p) => [p.kod, true]));

test('przejścia dozwolone i niedozwolone wg § 7.3', () => {
  assert.deepEqual(r.PRZEJSCIA.zgloszone, ['weryfikacja']);
  assert.deepEqual(r.PRZEJSCIA.aktywny, []);
  assert.deepEqual(r.PRZEJSCIA.wygasla, []);
  assert.match(r.przeszkodyPrzejscia({ status: 'zgloszone' }, 'aktywny')[0], /Niedozwolone przejście/);
  assert.match(r.przeszkodyPrzejscia({ status: 'aktywny' }, 'weryfikacja')[0], /Niedozwolone/);
  assert.deepEqual(r.przeszkodyPrzejscia({ status: 'zgloszone' }, 'weryfikacja'), []);
});

test('weryfikacja → umowa warunkowa: checklista Etapu 3 (ręczna) + uchwała i umowa spółki w dokumentach + data zawarcia', () => {
  const p = { status: 'weryfikacja', checklista_weryfikacji: {} };
  const bez = r.przeszkodyPrzejscia(p, 'umowa_warunkowa', { dokumenty: [] });
  assert.ok(bez.some((x) => /brak dokumentu \(uchwala\)/.test(x)), 'brak uchwały blokuje (na pewno niespełnione)');
  assert.ok(bez.some((x) => /datę zawarcia/.test(x)));
  assert.deepEqual(r.blokadyChecklisty(r.CHECKLISTA_WERYFIKACJI, []).uchwala !== undefined, true);
  const ok = r.przeszkodyPrzejscia({ ...p, checklista_weryfikacji: wszystkie(r.CHECKLISTA_WERYFIKACJI) }, 'umowa_warunkowa',
    { dokumenty: dokumenty('uchwala', 'umowa_spolki'), dane: { data_zawarcia_umowy: '2026-11-01' } });
  assert.deepEqual(ok, []);
});

test('umowa warunkowa → oczekuje na przekazanie: data rozwiązania wpisana przez kancelarię + dokument ją potwierdzający', () => {
  const p = { status: 'umowa_warunkowa', data_zawarcia_umowy: '2026-11-01' };
  assert.equal(r.przeszkodyPrzejscia(p, 'oczekuje_na_przekazanie', { dokumenty: [] }).length, 2);
  assert.deepEqual(r.przeszkodyPrzejscia(p, 'oczekuje_na_przekazanie', { dokumenty: dokumenty('wypowiedzenie'), dane: { data_skutecznosci: '2027-01-31' } }), []);
});

test('umowa warunkowa → Wygasła: dopiero po 12 miesiącach bez ziszczenia warunku', () => {
  const p = { status: 'umowa_warunkowa', data_zawarcia_umowy: '2026-11-01' };
  assert.equal(r.terminWarunku(p), '2027-11-01');
  assert.equal(r.czyWygasla(p, '2027-10-31'), false);
  assert.match(r.przeszkodyPrzejscia(p, 'wygasla', { dzis: '2027-10-31' })[0], /wygasa dopiero 2027-11-01/);
  assert.equal(r.czyWygasla(p, '2027-11-01'), true);
  assert.deepEqual(r.przeszkodyPrzejscia(p, 'wygasla', { dzis: '2027-11-01' }), []);
  assert.equal(r.czyWygasla({ ...p, data_skutecznosci: '2027-03-01' }, '2028-01-01'), false, 'warunek ziszczony — nie wygasa');
});

test('oczekuje → uzgodnienie wymaga danych od poprzednika; uzgodnienie ⇄ wstrzymane z opisem', () => {
  assert.match(r.przeszkodyPrzejscia({ status: 'oczekuje_na_przekazanie' }, 'uzgodnienie', { dokumenty: [] })[0], /Nie otrzymano danych/);
  assert.deepEqual(r.przeszkodyPrzejscia({ status: 'oczekuje_na_przekazanie' }, 'uzgodnienie', { dokumenty: dokumenty('dane_poprzednika') }), []);
  assert.match(r.przeszkodyPrzejscia({ status: 'uzgodnienie' }, 'wstrzymane_rozbieznosci', {})[0], /Opisz rozbieżności/);
  assert.deepEqual(r.przeszkodyPrzejscia({ status: 'uzgodnienie' }, 'wstrzymane_rozbieznosci', { dane: { uwagi: 'Inna liczba akcji serii B' } }), []);
  assert.match(r.przeszkodyPrzejscia({ status: 'wstrzymane_rozbieznosci' }, 'uzgodnienie', {})[0], /jak wyjaśniono/);
  assert.deepEqual(r.przeszkodyPrzejscia({ status: 'wstrzymane_rozbieznosci' }, 'uzgodnienie', { dane: { uwagi: 'Poprzednik przesłał korektę' } }), []);
});

test('uzgodnienie → aktywny: checklista Etapu 6 wystarcza — protokół powstaje przy otwarciu (D-095)', () => {
  const p = { status: 'uzgodnienie', checklista_odbioru: wszystkie(r.CHECKLISTA_ODBIORU) };
  // D-095: bez osobnego kroku „pobierz protokół → podpisz → wgraj”; zatwierdzeniem jest otwarcie rejestru przez notariusza.
  assert.deepEqual(r.przeszkodyPrzejscia(p, 'aktywny', { dokumenty: dokumenty('dane_poprzednika') }), []);
  assert.ok(r.przeszkodyPrzejscia({ status: 'uzgodnienie', checklista_odbioru: {} }, 'aktywny', { dokumenty: dokumenty('dane_poprzednika') }).length > 0,
    'bez checklisty odbioru — przeszkody');
});

test('W7.5: przypomnienia — 14 dni bez zawiadomienia, 30 dni przed terminem 12 miesięcy', () => {
  const p = { status: 'umowa_warunkowa', data_zawarcia_umowy: '2026-11-01' };
  assert.deepEqual(r.przypomnienia(p, '2026-11-14'), []);
  assert.equal(r.przypomnienia(p, '2026-11-15')[0].rodzaj, 'brak_zawiadomienia');
  assert.ok(r.przypomnienia(p, '2027-10-02').some((x) => x.rodzaj === 'termin_warunku'));
  assert.deepEqual(r.przypomnienia({ ...p, data_skutecznosci: '2026-12-31' }, '2027-10-02'), []);
});
