'use strict';

/**
 * Testy rdzenia rejestru: bilans akcji, odbudowa stanu ze zdarzen,
 * lancuch skrotow, append-only, walidacje blokujace.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { bazaTestowa, dodajSpolke, dodajOsobe, wpis } = require('./pomoc');
const rejestr = require('../server/rejestr');
const stanLogika = require('../server/logika/stan');
const n = require('../server/logika/numery');

/** Scenariusz odniesienia: emisja 100 akcji, dwoje obejmujacych, obrot, umorzenie. */
function scenariusz() {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const kowalski = dodajOsobe(db, { nazwisko: 'Kowalski', imie: 'Jan' });
  const nowak = dodajOsobe(db, { nazwisko: 'Nowak', imie: 'Anna' });
  const wisniewski = dodajOsobe(db, { nazwisko: 'Wiśniewski', imie: 'Piotr' });

  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', {
    seria: 'A',
    ilosc: 100,
    nr_pierwszy: 1,
    cena_emisyjna_grosze: 100,
    tytul: 'Emisja założycielska',
  });

  wpis(db, spolka, 'objecie', '2026-01-15', {
    emisja_zdarzenie_id: emisja.zdarzenie.id,
    pozycje: [
      { osoba_id: kowalski, ilosc: 60 },
      { osoba_id: nowak, ilosc: 40 },
    ],
  });

  return { db, spolka, kowalski, nowak, wisniewski, emisjaId: emisja.zdarzenie.id };
}

test('emisja tworzy pule akcji nieobjetych, objecie ja rozdziela', () => {
  const { db, spolka, kowalski, nowak } = scenariusz();
  const stan = stanLogika.odtworzStan(rejestr.wczytajZdarzenia(db, spolka));

  const bilans = stanLogika.bilansNaDzien(stan, '2026-01-15')[0];
  assert.equal(bilans.wyemitowane, 100);
  assert.equal(bilans.nieobjete, 0);
  assert.equal(bilans.przypisane, 100);
  assert.equal(bilans.umorzone, 0);

  const akcjonariat = stanLogika.akcjonariatNaDzien(stan, '2026-01-15');
  assert.equal(akcjonariat.razem_akcji, 100);
  const wgOsoby = new Map(akcjonariat.pozycje.map((p) => [p.osoba_id, p]));
  // Przydzial FIFO: pierwszy obejmujacy dostaje najnizsze numery.
  assert.equal(n.opisz(wgOsoby.get(kowalski).zakresy), '1–60');
  assert.equal(n.opisz(wgOsoby.get(nowak).zakresy), '61–100');
  assert.equal(stanLogika.sprawdzBilans(stan).length, 0);
});

test('przed objeciem akcje sa nieobjete, a rejestr o tym informuje', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const wynik = wpis(db, spolka, 'emisja', '2026-02-01', { seria: 'B', ilosc: 50 });

  const stan = stanLogika.odtworzStan(rejestr.wczytajZdarzenia(db, spolka));
  const bilans = stanLogika.bilansNaDzien(stan, '2026-02-01')[0];
  assert.equal(bilans.nieobjete, 50);
  assert.equal(bilans.przypisane, 0);
  assert.equal(stanLogika.sprawdzBilans(stan).length, 0, 'bilans jest szczelny mimo braku objecia');
  assert.match(
    wynik.ostrzezenia.join(' '),
    /50 akcji pozostaje nieobjętych/,
    'aplikacja pilnuje zgodnosci liczby akcji zarejestrowanych z wyemitowanymi'
  );
});

test('stan na dowolny dzien pokazuje akcjonariat wstecz', () => {
  const { db, spolka, kowalski, nowak, wisniewski, emisjaId } = scenariusz();

  wpis(db, spolka, 'przeniesienie', '2026-03-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: kowalski,
    tytul_prawny: 'sprzedaż',
    pozycje: [{ nabywca_osoba_id: wisniewski, ilosc: 25 }],
  });

  const stan = stanLogika.odtworzStan(rejestr.wczytajZdarzenia(db, spolka));

  // Dzien przed przeniesieniem - Wisniewskiego jeszcze nie ma.
  const przed = stanLogika.akcjonariatNaDzien(stan, '2026-02-28');
  assert.equal(przed.pozycje.length, 2);
  assert.equal(przed.pozycje.find((p) => p.osoba_id === kowalski).ilosc, 60);
  assert.equal(przed.pozycje.some((p) => p.osoba_id === wisniewski), false);

  // W dniu przeniesienia - juz po zmianie.
  const po = stanLogika.akcjonariatNaDzien(stan, '2026-03-01');
  assert.equal(po.pozycje.find((p) => p.osoba_id === kowalski).ilosc, 35);
  assert.equal(po.pozycje.find((p) => p.osoba_id === wisniewski).ilosc, 25);
  assert.equal(po.pozycje.find((p) => p.osoba_id === nowak).ilosc, 40);
  assert.equal(po.razem_akcji, 100);
});

test('umorzenie zmniejsza liczbe akcji w obrocie, bilans nadal sie zgadza', () => {
  const { db, spolka, nowak, emisjaId } = scenariusz();

  wpis(db, spolka, 'umorzenie', '2026-04-01', {
    emisja_zdarzenie_id: emisjaId,
    tryb: 'dobrowolne',
    pozycje: [{ osoba_id: nowak, ilosc: 10 }],
  });

  const stan = stanLogika.odtworzStan(rejestr.wczytajZdarzenia(db, spolka));
  const bilans = stanLogika.bilansNaDzien(stan, '2026-04-01')[0];
  assert.equal(bilans.wyemitowane, 100);
  assert.equal(bilans.umorzone, 10);
  assert.equal(bilans.przypisane, 90);
  assert.equal(bilans.w_obrocie, 90);
  assert.equal(stanLogika.sprawdzBilans(stan).length, 0);

  const akcjonariat = stanLogika.akcjonariatNaDzien(stan, '2026-04-01');
  assert.equal(akcjonariat.razem_akcji, 90);
  // Udzial liczony od akcji przypisanych akcjonariuszom.
  const udzialNowak = akcjonariat.pozycje.find((p) => p.osoba_id === nowak).procent;
  assert.equal(Math.round(udzialNowak), 33);
});

test('ODBUDOWA STANU ZE ZDARZEN = STAN BIEZACY (regula domenowa nr 2)', () => {
  const { db, spolka, kowalski, nowak, wisniewski, emisjaId } = scenariusz();

  wpis(db, spolka, 'przeniesienie', '2026-03-01', {
    emisja_zdarzenie_id: emisjaId,
    zbywca_osoba_id: kowalski,
    pozycje: [
      { nabywca_osoba_id: wisniewski, ilosc: 25 },
      { nabywca_osoba_id: nowak, ilosc: 5 },
    ],
  });
  wpis(db, spolka, 'umorzenie', '2026-04-01', {
    emisja_zdarzenie_id: emisjaId,
    pozycje: [{ osoba_id: nowak, ilosc: 10 }],
  });

  const kolumny =
    'emisja_id, kategoria, osoba_id, nr_od, nr_do, ilosc, zdarzenie_od_id, data_od, zdarzenie_do_id, data_do';
  const zapytanie = `SELECT ${kolumny} FROM psa_stan_akcji WHERE spolka_id = ? ORDER BY emisja_id, nr_od, data_od, data_do`;

  const przed = db.prepare(zapytanie).all(spolka);
  const emisjePrzed = db
    .prepare('SELECT id, zdarzenie_id, seria, nr_pierwszy, ilosc, status FROM psa_emisje WHERE spolka_id = ? ORDER BY id')
    .all(spolka);

  const { niezgodnosci } = rejestr.przelicz(db, spolka);
  assert.deepEqual(niezgodnosci, [], 'odbudowa nie wykrywa niezgodnosci');

  const po = db.prepare(zapytanie).all(spolka);
  const emisjePo = db
    .prepare('SELECT id, zdarzenie_id, seria, nr_pierwszy, ilosc, status FROM psa_emisje WHERE spolka_id = ? ORDER BY id')
    .all(spolka);

  assert.deepEqual(po, przed, 'pelna odbudowa daje dokladnie ten sam stan akcji');
  assert.deepEqual(emisjePo, emisjePrzed, 'identyfikatory emisji sa stabilne miedzy odbudowami');
  assert.ok(przed.length > 0);
});

test('lancuch skrotow jest ciagly i wykrywa podmiane tresci', () => {
  const { db, spolka } = scenariusz();

  const wynik = rejestr.zweryfikujIntegralnosc(db);
  assert.equal(wynik.ok, true);
  assert.equal(wynik.sprawdzono, 2);

  // Symulujemy ingerencje z pominieciem aplikacji: zdejmujemy wyzwalacz
  // append-only i podmieniamy tresc zdarzenia prosto w bazie.
  db.exec('DROP TRIGGER psa_zdarzenia_bez_update');
  db.prepare("UPDATE psa_zdarzenia SET data_zdarzenia = '2020-01-01' WHERE id = 1").run();

  const poIngerencji = rejestr.zweryfikujIntegralnosc(db);
  assert.equal(poIngerencji.ok, false);
  assert.equal(poIngerencji.blad.id, 1);
  assert.equal(poIngerencji.blad.rodzaj, 'zmieniona_tresc');
});

test('lancuch skrotow wykrywa usuniecie calego rekordu', () => {
  const { db } = scenariusz();
  // Ingerencja z pominieciem aplikacji: klient `sqlite3` domyslnie NIE
  // egzekwuje kluczy obcych, wiec odtwarzamy dokladnie takie warunki.
  db.exec('DROP TRIGGER psa_zdarzenia_bez_delete');
  db.pragma('foreign_keys = OFF');
  db.prepare('DELETE FROM psa_zdarzenia WHERE id = 1').run();

  const wynik = rejestr.zweryfikujIntegralnosc(db);
  assert.equal(wynik.ok, false);
  assert.equal(wynik.blad.rodzaj, 'zerwane_ogniwo');
});

test('psa_zdarzenia jest append-only takze na poziomie bazy', () => {
  const { db } = scenariusz();
  assert.throws(
    () => db.prepare("UPDATE psa_zdarzenia SET autor = 'ktoś inny' WHERE id = 1").run(),
    /append-only/
  );
  assert.throws(() => db.prepare('DELETE FROM psa_zdarzenia WHERE id = 1').run(), /append-only/);
});

test('nie da sie przeniesc wiecej akcji, niz zbywca posiada', () => {
  const { db, spolka, kowalski, wisniewski, emisjaId } = scenariusz();
  assert.throws(
    () =>
      wpis(db, spolka, 'przeniesienie', '2026-03-01', {
        emisja_zdarzenie_id: emisjaId,
        zbywca_osoba_id: kowalski,
        pozycje: [{ nabywca_osoba_id: wisniewski, ilosc: 61 }],
      }),
    /Brak pokrycia/
  );
  // Rejestr pozostal nietkniety.
  const stan = stanLogika.odtworzStan(rejestr.wczytajZdarzenia(db, spolka));
  assert.equal(stanLogika.akcjonariatNaDzien(stan, '2026-03-01').razem_akcji, 100);
});

test('nie da sie przeniesc akcji, ktore nie zostaly objete', () => {
  const db = bazaTestowa();
  const spolka = dodajSpolke(db);
  const osoba = dodajOsobe(db);
  const nabywca = dodajOsobe(db, { nazwisko: 'Nowak', imie: 'Anna' });
  const emisja = wpis(db, spolka, 'emisja', '2026-01-10', { seria: 'A', ilosc: 100 });

  assert.throws(
    () =>
      wpis(db, spolka, 'przeniesienie', '2026-02-01', {
        emisja_zdarzenie_id: emisja.zdarzenie.id,
        zbywca_osoba_id: osoba,
        pozycje: [{ nabywca_osoba_id: nabywca, ilosc: 10 }],
      }),
    /Brak pokrycia|nie zostały objęte/
  );
});

test('data zdarzenia z przyszlosci jest odrzucana', () => {
  const { db, spolka, kowalski, wisniewski, emisjaId } = scenariusz();
  assert.throws(
    () =>
      wpis(
        db,
        spolka,
        'przeniesienie',
        '2027-01-01',
        {
          emisja_zdarzenie_id: emisjaId,
          zbywca_osoba_id: kowalski,
          pozycje: [{ nabywca_osoba_id: wisniewski, ilosc: 10 }],
        },
        { dzisiaj: '2026-06-01' }
      ),
    /z przyszłości/
  );
});

test('data wczesniejsza niz ostatnie zdarzenie na tych akcjach jest odrzucana', () => {
  const { db, spolka, kowalski, wisniewski, emisjaId } = scenariusz();
  assert.throws(
    () =>
      wpis(db, spolka, 'przeniesienie', '2026-01-11', {
        emisja_zdarzenie_id: emisjaId,
        zbywca_osoba_id: kowalski,
        pozycje: [{ nabywca_osoba_id: wisniewski, ilosc: 10 }],
      }),
    /wcześniejsza niż ostatnie zdarzenie/
  );
});

test('seria nie moze sie powtorzyc w obrebie spolki', () => {
  const { db, spolka } = scenariusz();
  assert.throws(
    () => wpis(db, spolka, 'emisja', '2026-05-01', { seria: 'A', ilosc: 10 }),
    /Seria „A” jest już zarejestrowana/
  );
});

test('do rejestru spolki wykreslonej nie dokonuje sie wpisow', () => {
  const { db, spolka } = scenariusz();
  db.prepare("UPDATE psa_spolki SET status = 'wykreslona' WHERE id = ?").run(spolka);
  assert.throws(
    () => wpis(db, spolka, 'emisja', '2026-05-01', { seria: 'C', ilosc: 10 }),
    /status „wykreslona”/
  );
});

test('brak mozliwosci zastosowania srodkow AML blokuje wpis', () => {
  const { db, spolka, kowalski, emisjaId } = scenariusz();
  const podejrzany = dodajOsobe(db, {
    nazwisko: 'Zieliński',
    imie: 'Marek',
    aml_status: 'niemozliwe',
  });
  assert.throws(
    () =>
      wpis(db, spolka, 'przeniesienie', '2026-03-01', {
        emisja_zdarzenie_id: emisjaId,
        zbywca_osoba_id: kowalski,
        pozycje: [{ nabywca_osoba_id: podejrzany, ilosc: 10 }],
      }),
    /środków bezpieczeństwa finansowego/
  );
});

test('nieudany wpis nie zostawia sladu w lancuchu zdarzen', () => {
  const { db, spolka, kowalski, wisniewski, emisjaId } = scenariusz();
  const przed = db.prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia').get().ile;

  assert.throws(() =>
    wpis(db, spolka, 'przeniesienie', '2026-03-01', {
      emisja_zdarzenie_id: emisjaId,
      zbywca_osoba_id: kowalski,
      pozycje: [{ nabywca_osoba_id: wisniewski, ilosc: 999 }],
    })
  );

  assert.equal(db.prepare('SELECT COUNT(*) AS ile FROM psa_zdarzenia').get().ile, przed);
  assert.equal(rejestr.zweryfikujIntegralnosc(db).ok, true);
});
