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
const terminy = require('./logika/terminy');
const czas = require('./pomocnicze/czas');

/** Statusy oplaty, ktore da sie jeszcze zaplacic. */
const DO_ZAPLATY = new Set(['naliczona', 'zafakturowana']);

function wczytajOplate(db, id) {
  return db.prepare('SELECT * FROM psa_oplaty WHERE id = ?').get(id);
}

function wczytajPlatnosc(db, id) {
  return db.prepare('SELECT * FROM psa_platnosci WHERE id = ?').get(id);
}

/** Najswiezsza wazna proba zaplaty tej oplaty — na TE SAMA kwote. */
function aktualnaProba(db, oplata) {
  return db
    .prepare(
      `SELECT * FROM psa_platnosci
        WHERE oplata_id = ? AND status = 'oczekuje' AND kwota_grosze = ? AND link IS NOT NULL
        ORDER BY id DESC LIMIT 1`
    )
    .get(oplata.id, oplata.kwota_grosze);
}

const OPISY_TYPU = {
  prowadzenie: 'Prowadzenie rejestru akcjonariuszy',
  wpis: 'Wpis w rejestrze akcjonariuszy',
  informacja: 'Informacja z rejestru akcjonariuszy',
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

  const istniejaca = aktualnaProba(db, oplata);
  if (istniejaca) return { platnosc: istniejaca, nowa: false };

  // Proby na INNA kwote sa juz nieaktualne — link prowadzilby do zaplaty
  // kwoty, ktorej nikt juz nie jest winien.
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
    .run(oplata.id, crc, oplata.kwota_grosze, konfiguracja.TPAY.tryb_testowy ? 1 : 0, czas.terazIso());
  const platnoscId = Number(wynik.lastInsertRowid);

  try {
    const transakcja = await tpay.zalozTransakcje({
      kwotaGrosze: oplata.kwota_grosze,
      opis: opisPlatnosci(db, oplata),
      crc,
      urlPowrotu,
      urlPowiadomienia,
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

  // Kwote porownujemy z NASZA baza. Zaplacono mniej — oplata zostaje otwarta
  // i trafia do wyjasnienia; nie zamykamy jej „prawie zaplacona".
  const zaplacono = tpay.kwotaNaGrosze(pola.tr_amount);
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
  const nasz = String(status).toLowerCase() === 'correct' ? 'oplacona' : 'oczekuje';
  if (nasz !== 'oplacona') {
    return { status: nasz, zaksiegowano: false, surowe };
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
