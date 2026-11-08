'use strict';

/** Pisma (§ 4): treść zamrożona w chwili czynności, numer, PDF powstaje raz (U-04, U-09). */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

process.env.KATALOG_DOKUMENTOW = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-pisma-'));

const { bazaTestowa, dodajSpolke, dodajOsobe, wpisz, otworz, CHECKLISTA_PELNA } = require('./pomoc');
const pisma = require('../server/logika/pisma');
const sprawy = require('../server/sprawy');
const czas = require('../server/pomocnicze/czas');

const ROK = czas.dzisIso().slice(0, 4);
const akcje = (numery, liczba, seria = 'A') => ({ seria, numery, liczba });

function rejestr() {
  const db = bazaTestowa();
  const s = dodajSpolke(db, { nazwa: 'Alfa prosta spółka akcyjna', email: 'zarzad@alfa.example' });
  const a = dodajOsobe(db, { nazwa: 'Anna A', adres: 'ul. Lipowa 1, 80-100 Gdańsk' });
  const b = dodajOsobe(db, { nazwa: 'Bartosz B', adres: 'ul. Klonowa 2, 80-200 Gdańsk' });
  otworz(db, s, {
    serie: [{ seria: 'A', numery: '1-200', liczba: 200, data_wpisu_krs: '2026-01-10' }],
    akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-200', 200)] }],
  });
  return { db, s, a, b };
}

const przeniesienie = (a, b) => [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: b, akcje: [akcje('1-10', 10)] }] }];
const pismaSprawy = (db, sprawaId, typ) => pisma.lista(db, { sprawaId }).filter((p) => p.typ === typ);

test('numer pisma: PSA/RRRR/NNNN kolejno; informacja z rejestru — INF/RRRR/NNNN', () => {
  const { db, s, a, b } = rejestr();
  const id = wpisz(db, s, przeniesienie(a, b), { zadajacy: 'osoba', zadajacy_osoba_id: b });
  const numery = pismaSprawy(db, id, 'powiadomienie_wpis').map((p) => p.numer);
  assert.equal(numery.length, 2);
  assert.ok(numery.every((n) => new RegExp(`^PSA/${ROK}/\\d{4}$`).test(n)), numery.join());
  assert.notEqual(numery[0], numery[1]);
});

test('powiadomienie o wpisie: zmiany i stan po wpisie; późniejsza zmiana danych nie zmienia pisma', () => {
  const { db, s, a, b } = rejestr();
  const id = wpisz(db, s, przeniesienie(a, b), { zadajacy: 'osoba', zadajacy_osoba_id: b });
  const doZadajacego = pismaSprawy(db, id, 'powiadomienie_wpis').find((p) => p.adresat === 'osoba');
  const przed = pisma.tekst(db, doZadajacego.id);
  assert.ok(przed.includes('Przeniesienie akcji z Anna A na Bartosz B: seria A nr 1–10 (10 akcji)'), przed);
  assert.ok(przed.includes('ul. Klonowa 2, 80-200 Gdańsk'));
  assert.ok(przed.includes('Bartosz B | A | 1–10 | 10'));
  assert.ok(!przed.includes('Lista akcjonariuszy'), 'lista do KRS tylko w egzemplarzu spółki');
  db.prepare("UPDATE psa_osoby SET adres = 'ul. Nowa 9, 00-001 Warszawa' WHERE id = ?").run(b);
  assert.equal(pisma.tekst(db, doZadajacego.id), przed);
  const doSpolki = pismaSprawy(db, id, 'powiadomienie_wpis').find((p) => p.adresat === 'spolka');
  const tSpolki = pisma.tekst(db, doSpolki.id);
  assert.ok(tSpolki.includes('Lista akcjonariuszy'));
  assert.ok(tSpolki.includes('Łączna liczba akcji: 200.'));
});

test('powiadomienie o zamierzonym wpisie po „Dalej”: adresat z R2, termin, stan po zamierzonym wpisie', () => {
  const { db, s, a, b } = rejestr();
  const { id } = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'osoba', zadajacy_osoba_id: b, operacje: przeniesienie(a, b), checklista: CHECKLISTA_PELNA }, 'Test');
  sprawy.dalej(db, id, 'Test');
  const [p] = pismaSprawy(db, id, 'powiadomienie_zamierzony');
  const t = pisma.tekst(db, p.id);
  assert.ok(t.includes('Anna A'));
  assert.ok(/w terminie do dnia \d{2}\.\d{2}\.\d{4}/.test(t), t);
  assert.ok(t.includes('Anna A | A | 11–200 | 190'));
});

test('wezwanie i powiadomienie o odmowie zawierają treść wpisaną przez pracownika', () => {
  const { db, s, a, b } = rejestr();
  const { id } = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'osoba', zadajacy_osoba_id: b, operacje: przeniesienie(a, b) }, 'Test');
  sprawy.zmienStan(db, id, 'wstrzymana', { tresc_wezwania: 'Proszę dołączyć umowę sprzedaży.' }, 'Test');
  assert.ok(pisma.tekst(db, pismaSprawy(db, id, 'wezwanie')[0].id).includes('Proszę dołączyć umowę sprzedaży.'));
  sprawy.zmienStan(db, id, 'odmowa', { przyczyna: 'Brak dokumentu w wymaganej formie.' }, 'Test');
  assert.ok(pisma.tekst(db, pismaSprawy(db, id, 'powiadomienie_odmowa')[0].id).includes('Brak dokumentu w wymaganej formie.'));
});

test('PDF powstaje raz: ponowne pobranie zwraca ten sam plik, SHA-256 w psa_pisma', async () => {
  const { db, s, a, b } = rejestr();
  const id = wpisz(db, s, przeniesienie(a, b));
  const [p] = pismaSprawy(db, id, 'powiadomienie_wpis');
  const pierwszy = await pisma.pdf(db, p.id);
  const drugi = await pisma.pdf(db, p.id);
  assert.equal(pierwszy.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pierwszy.equals(drugi));
  const zapisany = pisma.wczytaj(db, p.id);
  assert.equal(zapisany.sha256, require('node:crypto').createHash('sha256').update(pierwszy).digest('hex'));
});

test('brak danych kancelarii w Ustawieniach — pismo nie powstaje, komunikat wskazuje braki', () => {
  const { db, s, a, b } = rejestr();
  db.prepare("DELETE FROM psa_ustawienia WHERE klucz = 'kancelaria_ulica'").run();
  assert.throws(() => wpisz(db, s, przeniesienie(a, b)), (e) => e.name === 'BladWalidacji' && /Ustawieniach/.test(e.message) && /ulica/.test(e.message));
});
