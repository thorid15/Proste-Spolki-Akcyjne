'use strict';

/** Szablony wbudowane i serwis dokumentów (sesja 6, faza 4). */

const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const migracje = require('../server/migracje');
const dokumenty = require('../server/dokumenty');
const { SZABLONY, DANE_PROBNE, AKAPIT_INTEGRALNOSCI } = require('../server/logika/szablony-wbudowane');

const KANCELARIA = {
  nazwa: 'Kancelaria Notarialna Łukasz Kozon',
  adres: 'ul. Grodzka 12',
  miejscowosc: '31-006 Kraków',
  telefon: '12 000 00 00',
  email: 'kancelaria@example.pl',
  notariusz: 'notariusz Łukasz Kozon',
};
const SPOLKA = {
  nazwa: 'WIATRAKI POLSKIE P.S.A.',
  krs: '0000998877',
  miejscowosc: 'Kraków',
  ulica: 'Długa', nr_domu: '5', nr_lokalu: '2', kod_pocztowy: '31-100',
};

function baza() {
  const db = new Database(':memory:');
  migracje.uruchom(db);
  dokumenty.zasiej(db, 'test');
  return db;
}

test('zasiew jest idempotentny i zaklada wersje 1 kazdego szablonu', () => {
  const db = baza();
  assert.equal(dokumenty.zasiej(db, 'test').length, 0, 'powtorny zasiew nic nie dodaje');
  const aktywne = dokumenty.wszystkieAktywne(db);
  assert.equal(aktywne.length, SZABLONY.length);
  for (const s of aktywne) {
    assert.equal(s.wersja, 1);
    assert.equal(s.aktywna, 1);
    assert.equal(s.wbudowany, 1);
  }
  db.close();
});

test('KAZDY szablon wbudowany renderuje sie z danych probnych bez brakow i bledow', () => {
  const db = baza();
  for (const s of SZABLONY) {
    const w = dokumenty.renderuj(db, s.kod, {
      dane: DANE_PROBNE, spolka: SPOLKA, kancelaria: KANCELARIA, dzis: '2026-03-04',
    });
    assert.deepEqual(w.bledy, [], `${s.kod}: bledy skladni`);
    assert.deepEqual(w.brakujace, [], `${s.kod}: nieuzupelnione klucze`);
    assert.match(w.html, /Kancelaria Notarialna/, `${s.kod}: brak papieru firmowego`);
    assert.match(w.html, /art\. 300\(31\) § 1/, `${s.kod}: brak stopki z podstawa prawna`);
  }
  db.close();
});

test('umowa o prowadzenie rejestru zawiera opis mechanizmu integralnosci', () => {
  const db = baza();
  const w = dokumenty.renderuj(db, 'umowa_o_prowadzenie', {
    dane: DANE_PROBNE, spolka: SPOLKA, kancelaria: KANCELARIA,
  });
  // art. 300(31) § 4 KSH - obowiazek zapewnienia integralnosci opisany wprost.
  assert.match(w.html, /wyłącznie dopisywane/);
  assert.match(w.html, /skrótem kryptograficznym/);
  assert.match(w.html, /wpis prostujący/);
  assert.ok(AKAPIT_INTEGRALNOSCI.includes('nie jest możliwa'));
  db.close();
});

test('informacja dla akcjonariusza uprzedza o ograniczeniu zakresu danych', () => {
  const db = baza();
  const w = dokumenty.renderuj(db, 'informacja_z_rejestru_akcjonariusz', {
    dane: DANE_PROBNE, spolka: SPOLKA, kancelaria: KANCELARIA,
  });
  assert.match(w.html, /PESEL, daty urodzenia ani adresu zamieszkania/);
  assert.match(w.html, /300\(35\) § 1\(1\)/);
  db.close();
});

test('nowa wersja nie rusza poprzedniej i przejmuje aktywnosc', () => {
  const db = baza();
  const przed = dokumenty.aktywny(db, 'wezwanie_przeszkoda');
  const nowa = dokumenty.nowaWersja(db, {
    kod: 'wezwanie_przeszkoda',
    tytul: 'Wezwanie (redakcja własna)',
    tresc: '<p>Nowa treść {{spolka_nazwa}}</p>',
    autor: 'notariusz',
  });

  assert.equal(nowa.wersja, 2);
  assert.equal(nowa.aktywna, 1);
  assert.equal(nowa.wbudowany, 0);

  const wszystkie = dokumenty.wersje(db, 'wezwanie_przeszkoda');
  assert.equal(wszystkie.length, 2);
  const stara = wszystkie.find((w) => w.wersja === 1);
  assert.equal(stara.tresc, przed.tresc, 'wersja 1 nietknieta');
  assert.equal(stara.aktywna, 0);

  const w = dokumenty.renderuj(db, 'wezwanie_przeszkoda', { spolka: SPOLKA, kancelaria: KANCELARIA });
  assert.match(w.html, /Nowa treść WIATRAKI/);
  assert.equal(w.szablon.wersja, 2);
  db.close();
});

test('mozna wrocic do wczesniejszej wersji bez zmiany jej tresci', () => {
  const db = baza();
  dokumenty.nowaWersja(db, {
    kod: 'zawiadomienie_odmowa', tytul: 'X', tresc: '<p>wersja druga</p>', autor: 'notariusz',
  });
  const wrocona = dokumenty.aktywuj(db, 'zawiadomienie_odmowa', 1);
  assert.equal(wrocona.wersja, 1);
  assert.equal(dokumenty.aktywny(db, 'zawiadomienie_odmowa').wersja, 1);
  assert.equal(dokumenty.wersje(db, 'zawiadomienie_odmowa').length, 2, 'wersja 2 nadal istnieje');
  db.close();
});

test('baza pilnuje niezmiennosci wydanej wersji szablonu', () => {
  const db = baza();
  const s = dokumenty.aktywny(db, 'wezwanie_przeszkoda');
  assert.throws(
    () => db.prepare('UPDATE psa_szablony SET tresc = ? WHERE id = ?').run('<p>podmiana</p>', s.id),
    /niezmienialny/
  );
  assert.throws(
    () => db.prepare('DELETE FROM psa_szablony WHERE id = ?').run(s.id),
    /nie usuwa/
  );
  db.close();
});

test('wydany dokument niesie slad wersji szablonu, z ktorej powstal', () => {
  const db = baza();
  db.prepare(
    `INSERT INTO psa_spolki (id, nazwa, forma_prawna, utworzono)
     VALUES (1, 'WIATRAKI POLSKIE P.S.A.', 'PROSTA SPÓŁKA AKCYJNA', '2026-01-01T00:00:00+01:00')`
  ).run();

  const w = dokumenty.renderuj(db, 'zawiadomienie_odmowa', {
    dane: DANE_PROBNE, spolka: SPOLKA, kancelaria: KANCELARIA,
  });
  const zapis = dokumenty.zapiszWydanie(db, {
    spolkaId: 1, typ: 'zawiadomienie_odmowa'.startsWith('zawiadomienie') ? 'zawiadomienie_odmowa' : 'raport',
    kanal: 'papier', html: w.html, szablon: w.szablon, autor: 'test',
  });

  assert.equal(zapis.szablon_kod, 'zawiadomienie_odmowa');
  assert.equal(zapis.szablon_wersja, 1);
  assert.ok(zapis.tresc_html.includes('Kancelaria Notarialna'));
  db.close();
});
