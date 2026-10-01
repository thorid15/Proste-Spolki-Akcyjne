'use strict';

/**
 * D-R08 pkt 5, 6 i 8 — stan otwarcia z KRN: daty rejestracji z KRN jako daty wpisu, transze
 * z własnymi datami, numeracja serii ciągła między seriami (AN 1–25, AZ 26–100).
 */
process.env.TZ = 'Europe/Warsaw';

const test = require('node:test');
const assert = require('node:assert/strict');

const rejestr = require('../server/rejestr');
const widoki = require('../server/widoki');
const { informacjaZRejestru } = require('../server/logika/informacja-dokument');
const { bazaTestowa, dodajSpolke, dodajOsobe, wpis } = require('./pomoc');

function migracja(db, spolkaId, typ, dataKrn, wejscie) {
  return rejestr.dokonajWpisu(db, {
    spolkaId, typ, wejscie, autor: 'Migracja', migracja_krn: { data_rejestracji: dataKrn },
  });
}

test('seria AN 1–25 i AZ 26–100 przechodzi przez migrację, przeniesienie i informację', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db, { nazwa: 'Yama Group P.S.A.' });
  const a = dodajOsobe(db, { nazwisko: 'Alfa', imie: 'Adam' });
  const b = dodajOsobe(db, { nazwisko: 'Beta', imie: 'Barbara' });

  const an = migracja(db, spolka, 'emisja', '2024-07-29T10:00', { seria: 'AN', nr_pierwszy: 1, ilosc: 25, data_wpisu_krs: '2024-07-20' });
  const az = migracja(db, spolka, 'emisja', '2024-07-29T10:05', { seria: 'AZ', nr_pierwszy: 26, ilosc: 75, data_wpisu_krs: '2024-07-20' });
  migracja(db, spolka, 'objecie', '2024-07-29T11:00', {
    emisja_zdarzenie_id: an.zdarzenie.id, pozycje: [{ osoba_id: a, ilosc: 25 }],
  });
  // Dwie transze KRN tej samej serii z różnymi datami rejestracji.
  migracja(db, spolka, 'objecie', '2024-07-29T11:05', {
    emisja_zdarzenie_id: az.zdarzenie.id, pozycje: [{ osoba_id: a, zakresy: [{ nr_od: 26, nr_do: 95 }] }],
  });
  migracja(db, spolka, 'objecie', '2026-07-17T09:00', {
    emisja_zdarzenie_id: az.zdarzenie.id, pozycje: [{ osoba_id: b, zakresy: [{ nr_od: 96, nr_do: 100 }] }],
  });

  // Zwykły wpis po migracji: data systemowa (dziś).
  wpis(db, spolka, 'przeniesienie', require('../server/pomocnicze/czas').terazUtc(), {
    emisja_zdarzenie_id: az.zdarzenie.id,
    zbywca_osoba_id: a,
    pozycje: [{ nabywca_osoba_id: b, zakresy: [{ nr_od: 90, nr_do: 95 }] }],
  });

  const stan = widoki.widokStanu(db, spolka);
  const opis = stan.akcjonariusze.map((p) => [p.osoba_id, p.seria, p.grupy_wpisu.map((g) => `${g.numery}@${g.data_wpisu}`).join('; ')]);
  assert.deepEqual(opis.find((x) => x[0] === a && x[1] === 'AN'), [a, 'AN', '1–25@2024-07-29']);
  assert.deepEqual(opis.find((x) => x[0] === a && x[1] === 'AZ'), [a, 'AZ', '26–89@2024-07-29']);
  const bAz = opis.find((x) => x[0] === b && x[1] === 'AZ')[2];
  assert.match(bAz, /^96–100@2026-07-17; 90–95@\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(stan.niezgodnosci, []);

  // Na dzień 2026-07-01 (przed transzą 96–100) B nie ma akcji.
  assert.equal(widoki.widokStanu(db, spolka, '2026-07-01').akcjonariusze.some((p) => p.osoba_id === b), false);

  const html = informacjaZRejestru({ kancelaria: { nazwa: 'K' }, spolka: stan.spolka, data: stan.data, stan });
  assert.match(html, /1–25/);
  assert.match(html, /26–100/);
  assert.equal(rejestr.zweryfikujIntegralnosc(db).ok, true);
});
