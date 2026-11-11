'use strict';

/** Korespondencja (U-09, U-10, U-28): wszystko, co wychodzi z rejestru — jedno miejsce. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

process.env.KATALOG_DOKUMENTOW = fs.mkdtempSync(path.join(os.tmpdir(), 'psa-korespondencja-'));

const { bazaTestowa, dodajSpolke, dodajOsobe, wpisz, otworz, CHECKLISTA_PELNA } = require('./pomoc');
const korespondencja = require('../server/korespondencja');
const pisma = require('../server/logika/pisma');
const sprawy = require('../server/sprawy');
const czas = require('../server/pomocnicze/czas');

const akcje = (numery, liczba) => ({ seria: 'A', numery, liczba });

/** Spółka z e-mailem (pisma do niej — e-mail), zbywca A bez zgody (list), nabywca B ze zgodą. */
function rejestr() {
  const db = bazaTestowa();
  const s = dodajSpolke(db, { nazwa: 'Alfa prosta spółka akcyjna', email: 'zarzad@alfa.example' });
  const a = dodajOsobe(db, { nazwa: 'Anna A', adres: 'ul. Lipowa 1, 80-100 Gdańsk' });
  const b = dodajOsobe(db, { nazwa: 'Bartosz B', adres: 'ul. Klonowa 2, 80-200 Gdańsk', email: 'b@b.example' });
  db.prepare('UPDATE psa_osoby SET zgoda_email = 1 WHERE id = ?').run(b);
  otworz(db, s, { serie: [{ seria: 'A', numery: '1-100', liczba: 100, data_wpisu_krs: '2026-01-10' }], akcjonariusze: [{ osoba_id: a, akcje: [akcje('1-100', 100)] }] });
  return { db, s, a, b };
}

/** Poczta zastępcza: zapamiętuje wiadomości; `blad` — zwraca odmowę serwera. */
function poczta({ blad = null } = {}) {
  const wyslane = [];
  return {
    wyslane,
    async wyslij(w) {
      wyslane.push(w);
      if (blad) return { wyslano: false, status: 'blad', powod: blad };
      return { wyslano: true, status: 'wyslano', idWiadomosci: `<id-${wyslane.length}@smtp>`, odpowiedz: '250 2.0.0 OK queued' };
    },
  };
}

function zbycie(db, s, a, b) {
  const { id } = sprawy.zaloz(db, { spolka_id: s, zadajacy: 'osoba', zadajacy_osoba_id: b, operacje: [{ typ: 'przeniesienie', zbywca_osoba_id: a, nabywcy: [{ osoba_id: b, akcje: [akcje('1-10', 10)] }] }], checklista: CHECKLISTA_PELNA, oplata: 'nie' }, 'Test');
  sprawy.dalej(db, id, 'Test');
  return id;
}

test('filtry: do wysłania (e-mail i listy) / listy do nadania / błędy / wysłane; wiersz z adresatem, pismem, kanałem i stanem', async () => {
  const { db, s, a, b } = rejestr();
  const id = zbycie(db, s, a, b);
  const [list] = pisma.lista(db, { sprawaId: id });
  assert.deepEqual([list.typ, list.kanal], ['powiadomienie_zamierzony', 'list']);
  pisma.nadano(db, list.id);
  sprawy.zmienStan(db, id, 'wpisana', {}, 'Test');
  const doWyslania = korespondencja.lista(db, { filtr: 'do_wyslania' }).filter((w) => w.sprawa_id === id);
  assert.deepEqual(doWyslania.map((w) => [w.pismo, w.adresat_nazwa, w.kanal, w.stan]).sort(), [
    ['Powiadomienie o wpisie', 'Alfa prosta spółka akcyjna', 'email', 'do_wyslania'],
    ['Powiadomienie o wpisie', 'Bartosz B', 'email', 'do_wyslania'],
  ]);
  assert.equal(doWyslania[0].spolka, 'Alfa prosta spółka akcyjna');
  assert.deepEqual(korespondencja.lista(db, { filtr: 'listy' }), []);
  assert.deepEqual(korespondencja.lista(db, { filtr: 'wyslane' }).map((w) => [w.pismo, w.wyslano]), [['Powiadomienie o zamierzonym wpisie', czas.dzisIso()]]);
  assert.equal(korespondencja.lista(db, { filtr: 'do_wyslania' }).length, 3, 'z powiadomieniem o otwarciu rejestru');
  await korespondencja.wyslij(db, doWyslania[0].id, { poczta: poczta({ blad: '550 mailbox unavailable' }) });
  assert.deepEqual(korespondencja.lista(db, { filtr: 'bledy' }).map((w) => w.id), [doWyslania[0].id]);
});

test('wysyłka e-mail: PDF w załączniku, krótka treść bez danych osobowych, identyfikator wiadomości i odpowiedź serwera', async () => {
  const { db, s, a, b } = rejestr();
  const id = zbycie(db, s, a, b);
  pisma.nadano(db, pisma.lista(db, { sprawaId: id })[0].id);
  sprawy.zmienStan(db, id, 'wpisana', {}, 'Test');
  const doB = pisma.lista(db, { sprawaId: id }).find((p) => p.typ === 'powiadomienie_wpis' && p.adresat === 'osoba');
  const p = poczta();
  const wynik = await korespondencja.wyslij(db, doB.id, { poczta: p });
  assert.deepEqual([wynik.stan, wynik.id_wiadomosci, wynik.odpowiedz_serwera], ['wyslane', '<id-1@smtp>', '250 2.0.0 OK queued']);
  const [w] = p.wyslane;
  assert.equal(w.do, 'b@b.example');
  assert.equal(w.zalaczniki.length, 1);
  assert.equal(w.zalaczniki[0].filename, `${doB.numer.replace(/\//g, '-')}.pdf`);
  assert.equal(w.zalaczniki[0].content.subarray(0, 5).toString(), '%PDF-');
  const tresc = `${w.temat}\n${w.tekst}`;
  assert.ok(tresc.includes(doB.numer) && tresc.includes('Powiadomienie o wpisie'));
  for (const osobowe of ['Bartosz B', 'Anna A', 'Klonowa', 'Lipowa']) assert.ok(!tresc.includes(osobowe), `dane osobowe w e-mailu: ${osobowe}`);
  await assert.rejects(korespondencja.wyslij(db, doB.id, { poczta: p }), /stanie „wyslane”/);
});

test('błąd wysyłki → stan „blad” z odpowiedzią serwera; ponowna wysyłka → „wyslane”', async () => {
  const { db, s, a, b } = rejestr();
  const id = zbycie(db, s, a, b);
  pisma.nadano(db, pisma.lista(db, { sprawaId: id })[0].id);
  sprawy.zmienStan(db, id, 'wpisana', {}, 'Test');
  const doSpolki = pisma.lista(db, { sprawaId: id }).find((p) => p.adresat === 'spolka');
  const zle = await korespondencja.wyslij(db, doSpolki.id, { poczta: poczta({ blad: '550 mailbox unavailable' }) });
  assert.deepEqual([zle.stan, zle.odpowiedz_serwera], ['blad', '550 mailbox unavailable']);
  const dobrze = await korespondencja.wyslij(db, doSpolki.id, { poczta: poczta() });
  assert.equal(dobrze.stan, 'wyslane');
});

test('list: „Wyślij” odmawia (list nadaje się „Nadano”), „Nadano” zapisuje dzisiejszą datę; e-maila nie „nadaje się”', async () => {
  const { db, s, a, b } = rejestr();
  const id = zbycie(db, s, a, b);
  const [list] = pisma.lista(db, { sprawaId: id });
  await assert.rejects(korespondencja.wyslij(db, list.id, { poczta: poczta() }), /Nadano/);
  const po = korespondencja.nadano(db, list.id);
  assert.deepEqual([po.stan, po.wyslano], ['wyslane', czas.dzisIso()]);
  sprawy.zmienStan(db, id, 'wpisana', {}, 'Test');
  const email = pisma.lista(db, { sprawaId: id }).find((p) => p.kanal === 'email');
  assert.throws(() => korespondencja.nadano(db, email.id), /wyłącznie listów/);
});

test('szczegóły pozycji: adresat, kanał, treść e-maila; pismo niepotrzebne usuwa się razem z plikiem PDF', async () => {
  const { db, s, a, b } = rejestr();
  const id = zbycie(db, s, a, b);
  const [list] = pisma.lista(db, { sprawaId: id });
  const sz = korespondencja.szczegoly(db, list.id);
  assert.deepEqual([sz.adresat_nazwa, sz.adresat_adres, sz.kanal, sz.email], ['Anna A', 'ul. Lipowa 1, 80-100 Gdańsk', 'list', null]);
  assert.ok(sz.temat.includes(list.numer));
  await pisma.pdf(db, list.id);
  const plik = path.join(process.env.KATALOG_DOKUMENTOW, pisma.wczytaj(db, list.id).plik);
  assert.ok(fs.existsSync(plik));
  sprawy.zmienStan(db, id, 'wycofana', {}, 'Test');
  assert.equal(pisma.lista(db, { sprawaId: id }).length, 0);
  assert.ok(!fs.existsSync(plik), 'plik usuniętego pisma został na dysku');
});
