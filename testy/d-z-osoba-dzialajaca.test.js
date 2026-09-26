'use strict';

/** D-Z — osoba działająca przy wpisie: zapisana przy zdarzeniu, tylko do audytu. */
process.env.TZ = 'Europe/Warsaw';

const test = require('node:test');
const assert = require('node:assert/strict');

const rejestr = require('../server/rejestr');
const widoki = require('../server/widoki');
const osobaDzialajaca = require('../server/logika/osoba-dzialajaca');
const { informacjaZRejestru } = require('../server/logika/informacja-dokument');
const dokumentyTresc = require('../server/logika/dokumenty-tresc');
const { bazaTestowa, dodajSpolke, dodajOsobe } = require('./pomoc');

function dodajDzialajaca(db, imie, nazwisko, funkcja) {
  return Number(db.prepare(
    "INSERT INTO psa_osoby_dzialajace (imie, nazwisko, funkcja, aktywny, utworzono) VALUES (?, ?, ?, 1, 'x')"
  ).run(imie, nazwisko, funkcja).lastInsertRowid);
}

test('ustalanie: wskazana → domyślna pracownika → jedyny notariusz → konfiguracja; niejednoznaczne — odmowa', () => {
  const db = bazaTestowa();
  // Pusty słownik: notariusz z danych kancelarii.
  assert.equal(osobaDzialajaca.ustal(db, {}).funkcja, 'notariusz');

  const notariusz = dodajDzialajaca(db, 'Łukasz', 'Kozon', 'notariusz');
  const zastepca = dodajDzialajaca(db, 'Anna', 'Zastępcza', 'zastepca_notarialny');
  assert.equal(osobaDzialajaca.ustal(db, {}).id, notariusz, 'jedyny aktywny notariusz');
  assert.equal(osobaDzialajaca.ustal(db, { uzytkownik: { osoba_dzialajaca_id: zastepca } }).id, zastepca);
  assert.equal(osobaDzialajaca.ustal(db, { wskazanaId: zastepca, uzytkownik: { osoba_dzialajaca_id: notariusz } }).id, zastepca);

  dodajDzialajaca(db, 'Jan', 'Drugi', 'notariusz');
  assert.throws(() => osobaDzialajaca.ustal(db, {}), /Wskaż osobę działającą/);
  db.prepare('UPDATE psa_osoby_dzialajace SET aktywny = 0 WHERE id = ?').run(zastepca);
  assert.throws(() => osobaDzialajaca.ustal(db, { wskazanaId: zastepca }), /nieaktywna/);
});

test('osoba działająca jest w treści zdarzenia (skrót), ale nie na informacji ani zawiadomieniu', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const osoba = dodajOsobe(db);
  const zastepca = osobaDzialajaca.ustal(db, {
    wskazanaId: dodajDzialajaca(db, 'Anna', 'Zastępcza', 'zastepca_notarialny'),
  });
  const emisja = rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'emisja', teraz: '2026-09-01', autor: 'Pracownik', dzialajacy: zastepca,
    wejscie: { seria: 'A', ilosc: 10, data_wpisu_krs: '2026-08-01' },
  });
  const objecie = rejestr.dokonajWpisu(db, {
    spolkaId: spolka, typ: 'objecie', teraz: '2026-09-02', autor: 'Pracownik', dzialajacy: zastepca,
    wejscie: { emisja_zdarzenie_id: emisja.zdarzenie.id, pozycje: [{ osoba_id: osoba, ilosc: 10 }] },
  });
  assert.deepEqual(JSON.parse(objecie.zdarzenie.dane_json).dzialajacy, zastepca);
  assert.equal(rejestr.zweryfikujIntegralnosc(db).ok, true);

  const stan = widoki.widokStanu(db, spolka, '2026-09-30');
  const info = informacjaZRejestru({ kancelaria: { nazwa: 'K' }, spolka: stan.spolka, data: '2026-09-30', stan });
  assert.doesNotMatch(info, /Zastępcza/);
  const zdarzenie = db.prepare('SELECT * FROM psa_zdarzenia WHERE id = ?').get(objecie.zdarzenie.id);
  const zaw = dokumentyTresc.zawiadomienieWpis({
    kancelaria: { nazwa: 'K' }, spolka: stan.spolka, zdarzenie, typZdarzenie: { nazwa: 'Objęcie' }, podsumowanie: '',
  });
  assert.match(zaw, /Data i godzina wpisu/);
  assert.doesNotMatch(zaw, /Zastępcza/);
});
