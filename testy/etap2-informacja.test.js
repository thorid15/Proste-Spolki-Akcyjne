'use strict';

/**
 * Etap 2 — treść informacji z rejestru po porównaniu z KRN:
 * D-R02 (data zarejestrowania emisji), D-R03/R06 (zakresy z datą wpisu,
 * wiersz „Łącznie”, brak głosów), D-R04/R05 (cena, opis emisji, opis spółki),
 * D-R07 (godzina sporządzenia).
 */
process.env.TZ = 'Europe/Warsaw';

const test = require('node:test');
const assert = require('node:assert/strict');

const widoki = require('../server/widoki');
const { informacjaZRejestru } = require('../server/logika/informacja-dokument');
const { bazaTestowa, dodajSpolke, dodajOsobe, wpis } = require('./pomoc');

const KANCELARIA = { nazwa: 'Kancelaria Notarialna', adres: '', miejscowosc: '', email: '' };

/** Przykład Charlie z inwentaryzacji KRN: A ma 1–889 i 990 z 12.08 oraz 890–989 z 25.09. */
function charlie() {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db, { opis: 'Spółka technologiczna.' });
  const a = dodajOsobe(db, { nazwisko: 'Alfa', imie: 'Adam' });
  const b = dodajOsobe(db, { nazwisko: 'Beta', imie: 'Barbara' });
  const emisja = wpis(db, spolka, 'emisja', '2026-08-12T09:00', {
    seria: 'A',
    ilosc: 990,
    cena_emisyjna_grosze: 150,
    waluta: 'EUR',
    opis: 'Emisja przy zawiązaniu spółki.',
    podstawa_prawna: 'Art. 300⁵ § 1 pkt 4 KSH',
    data_wpisu_krs: '2026-08-10',
    data_emisji: '2026-08-01',
  });
  const emisjaId = emisja.zdarzenie.id;
  wpis(db, spolka, 'objecie', '2026-08-12T10:00', {
    emisja_zdarzenie_id: emisjaId,
    pozycje: [{ osoba_id: a, ilosc: 990 }],
  });
  wpis(db, spolka, 'przeniesienie', '2026-09-20T10:00', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: a,
    pozycje: [{ nabywca_osoba_id: b, zakresy: [{ nr_od: 890, nr_do: 989 }] }],
  });
  wpis(db, spolka, 'przeniesienie', '2026-09-25T10:00', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: b,
    pozycje: [{ nabywca_osoba_id: a, zakresy: [{ nr_od: 890, nr_do: 989 }] }],
  });
  return { db, spolka, a, b, emisjaId };
}

function html(db, spolka, data, rola) {
  const stan = widoki.widokStanu(db, spolka, data, rola ? { rola } : {});
  return {
    stan,
    tresc: informacjaZRejestru({
      kancelaria: KANCELARIA,
      spolka: stan.spolka,
      data,
      stan,
      sporzadzono: '2026-10-07T12:34:56Z',
    }),
  };
}

const bezZnacznikow = (t) => t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('D-R03: zakresy tej samej serii z własną datą wpisu (przykład Charlie)', () => {
  const { db, spolka, a } = charlie();
  const { stan, tresc } = html(db, spolka, '2026-10-01');
  const pozycja = stan.akcjonariusze.find((p) => p.osoba_id === a);
  assert.deepEqual(
    pozycja.grupy_wpisu.map((g) => [g.numery, g.data_wpisu]),
    [['1–889, 990', '2026-08-12'], ['890–989', '2026-09-25']]
  );
  assert.match(bezZnacznikow(tresc), /1–889, 990 \(wpis 12\.08\.2026\) 890–989 \(wpis 25\.09\.2026\)/);
  assert.doesNotMatch(tresc, /Wpisano do rejestru/);
});

test('D-R06: wiersz „Łącznie” dla osoby z dwiema seriami; nigdzie nie ma głosów', () => {
  const { db, spolka, a } = charlie();
  wpis(db, spolka, 'emisja', '2026-09-26T08:00', {
    seria: 'B', nr_pierwszy: 991, ilosc: 10, data_wpisu_krs: '2026-09-25',
  });
  const emisjaB = db.prepare("SELECT zdarzenie_id FROM psa_emisje WHERE seria = 'B'").get().zdarzenie_id;
  wpis(db, spolka, 'objecie', '2026-09-26T09:00', {
    emisja_zdarzenie_id: emisjaB,
    pozycje: [{ osoba_id: a, ilosc: 10 }],
  });

  const { stan, tresc } = html(db, spolka, '2026-10-01');
  assert.deepEqual(
    stan.akcjonariusze_lacznie.map((l) => [l.osoba_id, l.serie, l.ilosc]),
    [[a, ['A', 'B'], 1000]]
  );
  const tekst = bezZnacznikow(tresc);
  assert.match(tekst, /Łącznie \(serie A, B\) 1 000 100,00 %/);
  // Wiersze tej samej osoby stoją obok siebie, „Łącznie” zamyka osobę.
  assert.ok(tekst.lastIndexOf('Łącznie (serie') > tekst.lastIndexOf('991–1000'));

  assert.equal(stan.akcjonariusze.some((p) => 'glosy' in p), false);
  assert.doesNotMatch(tresc, /głos(y|ów)\b/i);
  // Wyjątek A6: uchwała o wyborze notariusza prosi o głosy jawnie.
  const zGlosami = widoki.widokStanu(db, spolka, '2026-10-01', { zGlosami: true });
  assert.deepEqual(zGlosami.akcjonariusze.map((p) => p.glosy), [990, 10]);
});

test('D-R02/R04/R05: tabela emisji i sekcja spółki', () => {
  const { db, spolka } = charlie();
  const { tresc } = html(db, spolka, '2026-10-01');
  const tekst = bezZnacznikow(tresc);
  assert.match(tresc, /Data zarejestrowania emisji/);
  assert.match(tekst, /10\.08\.2026/, 'data wpisu emisji do KRS');
  assert.doesNotMatch(tekst, /01\.08\.2026/, 'data emisji nie trafia na informację');
  assert.match(tekst, /1,50 EUR/);
  assert.match(tekst, /Emisja przy zawiązaniu spółki\./);
  assert.match(tekst, /Opis Spółka technologiczna\./);
  assert.doesNotMatch(tekst, /300⁵/, 'bez podstawy prawnej emisji');
});

test('D-R07: stopka z godziną sporządzenia; dla dnia bieżącego stan z godziną', () => {
  const { db, spolka } = charlie();
  const { tresc } = html(db, spolka, '2026-10-01');
  assert.match(tresc, /Sporządzono 07\.10\.2026, godz\. 14:34/);
  assert.match(bezZnacznikow(tresc), /stan na 01\.10\.2026 /);

  const dzis = require('../server/pomocnicze/czas').dzisIso();
  const biezacy = html(db, spolka, dzis).tresc;
  assert.match(bezZnacznikow(biezacy), /Stan na \d{2}\.\d{2}\.\d{4}, godz\. \d{2}:\d{2}/);
});
