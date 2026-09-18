'use strict';

/**
 * Platnosci online — warstwa, ktora laczy tpay z oplatami kancelarii.
 *
 * Podzial jak w reszcie modulu: `logika/tpay.js` zna protokol i pieniadze,
 * ten plik zna BAZE i skutki zaplaty. Skutkow jest dokladnie trzy:
 *   1. oplata przechodzi w `oplacona`,
 *   2. zadanie wpisu zlozone przez portal staje sie skuteczne (art. 300(34)
 *      § 1 KSH — od tej chwili, i dopiero od tej, biegnie tydzien),
 *   3. informacja z rejestru staje sie do pobrania.
 */

const crypto = require('node:crypto');

const konfiguracja = require('./konfiguracja');
const tpay = require('./logika/tpay');
const ustawienia = require('./logika/ustawienia');
const przepisy = require('./logika/przepisy');
const terminy = require('./logika/terminy');
const czas = require('./pomocnicze/czas');

/** Statusy oplaty, ktore da sie jeszcze zaplacic. */
const DO_ZAPLATY = new Set(['naliczona', 'zafakturowana']);

/**
 * Jak dlugo wazny jest wygenerowany link. Operator NIE MA pola daty
 * wygasniecia — waznosc pilnuje sie po swojej stronie. Po tym czasie
 * proba idzie na „wygasla", a kolejne klikniecie zaklada nowa transakcje.
 */
const WAZNOSC_LINKU_MS = 14 * 24 * 60 * 60 * 1000;

function wygasl(platnosc, teraz = Date.now()) {
  return teraz - new Date(platnosc.utworzono).getTime() > WAZNOSC_LINKU_MS;
}

function wczytajOplate(db, id) {
  return db.prepare('SELECT * FROM psa_oplaty WHERE id = ?').get(id);
}

function wczytajPlatnosc(db, id) {
  return db.prepare('SELECT * FROM psa_platnosci WHERE id = ?').get(id);
}

/**
 * Najswiezsza wazna proba zaplaty tej oplaty — na TE SAMA kwote. Kwota to
 * BRUTTO (naprawa sekcji 2.1 promptu naprawczego): klient placi kwote
 * z VAT, `psa_oplaty.kwota_grosze` zostaje netto wylacznie w ksiegowosci
 * kancelarii.
 */
function aktualnaProba(db, oplata, bruttoGrosze) {
  return db
    .prepare(
      `SELECT * FROM psa_platnosci
        WHERE oplata_id = ? AND status = 'oczekuje' AND kwota_grosze = ? AND link IS NOT NULL
        ORDER BY id DESC LIMIT 1`
    )
    .get(oplata.id, bruttoGrosze);
}

/**
 * Kasa operatora poprzedza opis slowami „Płatność za …", wiec opis zaczyna
 * sie MALA litera i rzeczownikiem, ktory po tym wstepie czyta sie poprawnie.
 * Nazwy kancelarii tu nie ma — odbiorca jest pokazany osobno.
 */
const OPISY_TYPU = {
  prowadzenie: 'prowadzenie rejestru akcjonariuszy',
  wpis: 'wpis w rejestrze akcjonariuszy',
  informacja: 'informację z rejestru akcjonariuszy',
};

/** Tytul, ktory klient zobaczy na formularzu tpay i na wyciagu bankowym. */
function opisPlatnosci(db, oplata) {
  const spolka = db.prepare('SELECT nazwa FROM psa_spolki WHERE id = ?').get(oplata.spolka_id);
  const czesci = [OPISY_TYPU[oplata.typ] || 'Opłata', spolka ? spolka.nazwa : `spółka #${oplata.spolka_id}`];
  if (oplata.typ === 'prowadzenie' && oplata.okres) czesci.push(oplata.okres);
  return czesci.join(' — ').slice(0, 128);
}

/**
 * Zwraca link do zaplaty za oplate. IDEMPOTENTNE: dopoki istnieje wazna
 * proba na TE SAMA kwote, oddaje jej link zamiast zakladac nowa transakcje.
 * Zmiana kwoty uniewaznia poprzednia probe — historia prob zostaje.
 */
async function przygotujZaplate(db, { oplataId, urlPowiadomienia, urlPowrotu }) {
  const oplata = wczytajOplate(db, oplataId);
  if (!oplata) throw new Error('Nie odnaleziono opłaty.');
  if (oplata.status === 'oplacona') throw new Error('Ta opłata jest już opłacona.');
  if (!DO_ZAPLATY.has(oplata.status)) throw new Error(`Opłata ma status „${oplata.status}” — nie można jej opłacić.`);
  if (!tpay.skonfigurowany()) throw new Error('Płatności online nie są włączone.');

  // Klient placi BRUTTO — kwota_grosze w psa_oplaty zostaje netto (patrz
  // logika/przepisy.js: obliczBrutto). Liczona na tej jednej pozycji, nie
  // na zadnej sumie.
  const bruttoGrosze = przepisy.obliczBrutto(oplata.kwota_grosze, oplata.stawka_vat_procent);

  const istniejaca = aktualnaProba(db, oplata, bruttoGrosze);
  if (istniejaca && !wygasl(istniejaca)) return { platnosc: istniejaca, nowa: false };
  if (istniejaca) {
    db.prepare("UPDATE psa_platnosci SET status = 'wygasla', zakonczono = ? WHERE id = ?")
      .run(czas.terazIso(), istniejaca.id);
  }

  // Proby na INNA kwote sa juz nieaktualne — link prowadzilby do zaplaty
  // kwoty, ktorej nikt juz nie jest winien. Uniewazniamy je TAKZE
  // U OPERATORA: sam wpis w naszej bazie nie gasi linku, ktory klient ma
  // w mailu, wiec bez tego dalo sie zaplacic stara kwote.
  const nieaktualne = db
    .prepare("SELECT * FROM psa_platnosci WHERE oplata_id = ? AND status = 'oczekuje'")
    .all(oplata.id);
  for (const stara of nieaktualne) {
    if (!stara.tpay_id) continue;
    try {
      await tpay.anulujTransakcje(stara.tpay_id);
    } catch (e) {
      // Operator nie potrafil anulowac — zapisujemy to, ale nie wstrzymujemy
      // wystawienia nowego linku: klient ma czym zaplacic wlasciwa kwote.
      console.error(`[psa] nie udało się unieważnić transakcji ${stara.tpay_id}: ${e.message}`);
    }
  }
  db.prepare(
    `UPDATE psa_platnosci SET status = 'anulowana', zakonczono = ?
      WHERE oplata_id = ? AND status = 'oczekuje'`
  ).run(czas.terazIso(), oplata.id);

  const crc = `psa-${oplata.id}-${crypto.randomBytes(9).toString('base64url')}`;
  const wynik = db
    .prepare(
      `INSERT INTO psa_platnosci (oplata_id, dostawca, crc, kwota_grosze, status, tryb_testowy, utworzono)
       VALUES (?, 'tpay', ?, ?, 'oczekuje', ?, ?)`
    )
    .run(oplata.id, crc, bruttoGrosze, konfiguracja.TPAY.tryb_testowy ? 1 : 0, czas.terazIso());
  const platnoscId = Number(wynik.lastInsertRowid);

  try {
    const transakcja = await tpay.zalozTransakcje({
      kwotaGrosze: bruttoGrosze,
      opis: opisPlatnosci(db, oplata),
      crc,
      urlPowrotu,
      urlPowiadomienia,
      emailPowiadomien: ustawienia.kancelaria(db).email || null,
    });
    db.prepare('UPDATE psa_platnosci SET tpay_id = ?, link = ? WHERE id = ?')
      .run(transakcja.tpay_id || null, transakcja.link, platnoscId);
  } catch (e) {
    // Transakcja u operatora nie powstala — nasz wiersz nie moze zostac
    // „oczekujacy" z pustym linkiem, bo zablokowalby kolejne proby.
    db.prepare("UPDATE psa_platnosci SET status = 'nieudana', zakonczono = ? WHERE id = ?")
      .run(czas.terazIso(), platnoscId);
    throw e;
  }

  return { platnosc: wczytajPlatnosc(db, platnoscId), nowa: true };
}

/**
 * Ksieguje zaplate: oplata na `oplacona`, a jesli wisiala przy niej sprawa
 * zgloszona przez portal — sprawa staje sie skuteczna.
 *
 * Dzien zaplaty jest dniem OTRZYMANIA ZADANIA (art. 300(34) § 1 KSH), wiec
 * przestawiamy `data_wplywu` i przeliczamy termin od nowa. Do tej chwili
 * zaden termin ustawowy nie biegl, bo zadania jeszcze nie bylo.
 */
function zaksieguj(db, { platnosc, opisPowiadomienia }) {
  const teraz = czas.terazIso();
  const dzis = czas.dzisIso();

  db.prepare("UPDATE psa_platnosci SET status = 'oplacona', zakonczono = ?, odpowiedz_json = ? WHERE id = ?")
    .run(teraz, opisPowiadomienia ?? null, platnosc.id);

  const oplata = wczytajOplate(db, platnosc.oplata_id);
  if (!oplata || oplata.status === 'oplacona') return { oplata, sprawa: null };

  db.prepare("UPDATE psa_oplaty SET status = 'oplacona', oplacona_kiedy = ?, zaktualizowano = ? WHERE id = ?")
    .run(teraz, teraz, oplata.id);

  let sprawa = null;
  if (oplata.sprawa_id) {
    sprawa = db.prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(oplata.sprawa_id);
    if (sprawa && sprawa.oczekuje_na_oplate === 1) {
      const termin = terminy.policzTermin(
        { data_wplywu: dzis, stan: 'nowa', wstrzymana_od: null, wznowiona_od: null },
        dzis
      );
      db.prepare(
        `UPDATE psa_sprawy
            SET oczekuje_na_oplate = 0, data_wplywu = ?, termin_do = ?, zaktualizowano = ?
          WHERE id = ?`
      ).run(dzis, termin.termin_do, teraz, sprawa.id);
      sprawa = db.prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(sprawa.id);
    }
  }

  return { oplata: wczytajOplate(db, oplata.id), sprawa };
}

/**
 * Przyjmuje powiadomienie ITN. Zwraca `{ ok, powod, zaksiegowano }`.
 *
 * NIGDY nie rzuca wyjatkiem na tresci powiadomienia: falszywy podpis,
 * nieznany `tr_crc`, zla kwota — to wszystko sa odpowiedzi, nie bledy
 * serwera. Trasa i tak odpowiada operatorowi czystym `TRUE`, inaczej
 * powiadomienie wraca w petli.
 */
function przyjmijPowiadomienie(db, pola) {
  const podpis = tpay.sprawdzPodpisItn(pola);
  if (!podpis.ok) return { ok: false, powod: podpis.powod, zaksiegowano: false };

  const platnosc = db.prepare('SELECT * FROM psa_platnosci WHERE crc = ?').get(String(pola.tr_crc));
  if (!platnosc) return { ok: false, powod: 'Powiadomienie o nieznanej transakcji.', zaksiegowano: false };

  // `tr_crc` wskazuje nasza probe, `tr_id` — transakcje u operatora. Jesli
  // sie rozjezdzaja, powiadomienie nie dotyczy tej proby.
  if (platnosc.tpay_id && String(pola.tr_id) !== String(platnosc.tpay_id)) {
    return { ok: false, powod: 'Numer transakcji nie odpowiada zapisanej próbie.', zaksiegowano: false };
  }

  // Powiadomienie z piaskownicy NIGDY nie ksieguje platnosci produkcyjnej
  // i odwrotnie — inaczej ktokolwiek, kto zna nasz adres ITN, „placi"
  // w piaskownicy za czynnosc na produkcji.
  const testowe = String(pola.test_mode || '0') === '1' ? 1 : 0;
  if (testowe !== platnosc.tryb_testowy) {
    return { ok: false, powod: 'Tryb powiadomienia nie odpowiada trybowi transakcji.', zaksiegowano: false };
  }

  const surowe = JSON.stringify(pola);

  // Idempotencja: to samo powiadomienie przychodzi wielokrotnie.
  if (platnosc.status === 'oplacona') {
    return { ok: true, powod: 'Płatność była już zaksięgowana.', zaksiegowano: false };
  }

  const status = tpay.statusZPowiadomienia(pola.tr_status, pola.tr_error);
  if (status !== 'oplacona') {
    db.prepare('UPDATE psa_platnosci SET status = ?, zakonczono = ?, odpowiedz_json = ? WHERE id = ?')
      .run(status, status === 'oczekuje' ? null : czas.terazIso(), surowe, platnosc.id);
    return { ok: true, powod: `Status transakcji: ${status}.`, zaksiegowano: false };
  }

  // Kwote porownujemy z NASZA baza. Liczy sie `tr_paid` — ile klient
  // FAKTYCZNIE zaplacil — a nie `tr_amount`, czyli kwota, na ktora transakcje
  // wystawilismy. Przy niedoplacie te dwie rozne sie i tylko pierwsza mowi
  // prawde o pieniadzach. Gdy `tr_paid` nie przyszlo, bierzemy `tr_amount`.
  const zaplacono = tpay.kwotaNaGrosze(pola.tr_paid != null && pola.tr_paid !== ''
    ? pola.tr_paid
    : pola.tr_amount);
  if (zaplacono == null || zaplacono < platnosc.kwota_grosze) {
    db.prepare('UPDATE psa_platnosci SET odpowiedz_json = ? WHERE id = ?').run(surowe, platnosc.id);
    return {
      ok: false,
      powod: `Zapłacono ${zaplacono == null ? 'nieczytelną kwotę' : `${(zaplacono / 100).toFixed(2)} zł`}`
        + ` zamiast ${(platnosc.kwota_grosze / 100).toFixed(2)} zł.`,
      zaksiegowano: false,
    };
  }

  const wynik = db.transaction(() => zaksieguj(db, { platnosc, opisPowiadomienia: surowe }))();
  return { ok: true, powod: null, zaksiegowano: true, ...wynik };
}

/**
 * Awaryjne odpytanie o stan transakcji — gdy powiadomienie nie doszlo.
 * Uzywa tej samej sciezki ksiegowania, wiec skutek jest identyczny.
 */
async function sprawdzUOperatora(db, platnoscId) {
  const platnosc = wczytajPlatnosc(db, platnoscId);
  if (!platnosc) throw new Error('Nie odnaleziono płatności.');
  if (!platnosc.tpay_id) throw new Error('Ta próba nie ma transakcji u operatora.');
  if (platnosc.status === 'oplacona') return { status: 'oplacona', zaksiegowano: false };

  const { status, surowe } = await tpay.stanTransakcji(platnosc.tpay_id);
  if (status !== 'oplacona') {
    // Stan inny niz „zaplacone" zapisujemy — inaczej nieudana albo anulowana
    // transakcja wisialaby u nas jako „oczekuje" bez konca.
    if (status !== 'oczekuje') {
      db.prepare('UPDATE psa_platnosci SET status = ?, zakonczono = ? WHERE id = ?')
        .run(status, czas.terazIso(), platnosc.id);
    }
    return { status, zaksiegowano: false, surowe };
  }
  const wynik = db.transaction(() =>
    zaksieguj(db, { platnosc, opisPowiadomienia: JSON.stringify({ zrodlo: 'odpytanie', surowe }) }))();
  return { status: 'oplacona', zaksiegowano: true, ...wynik };
}

module.exports = {
  DO_ZAPLATY,
  przygotujZaplate,
  przyjmijPowiadomienie,
  sprawdzUOperatora,
  opisPlatnosci,
  wczytajOplate,
  wczytajPlatnosc,
};
