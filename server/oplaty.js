'use strict';

/**
 * Rozliczenia (sekcja 1, 5, 8 specyfikacji): prowadzenie rejestru rocznie,
 * wpis, informacja z rejestru — wg taksy z `logika/przepisy.js`.
 *
 * Podzial jak w `rejestr.js`/`zawiadomienia.js`: to jest SERWIS (dostep do
 * bazy), stawki i reguly prawne mieszkaja wylacznie w `logika/przepisy.js`.
 *
 * Integracja z modulem Kasa: zgodnie z decyzja nr 5 z sekcji 15 - osobno na
 * start, scalenie po ustabilizowaniu modulu. `psa_oplaty` jest wiec dzis
 * jedynym zrodlem prawdy o naleznosciach tego modulu.
 */

const przepisy = require('./logika/przepisy');
const czas = require('./pomocnicze/czas');

/**
 * Opłata za wpis (art. 300(31) i nast. KSH, § 15b rozporządzenia). Stawka
 * jest PŁASKA niezależnie od typu zdarzenia — `typ.odplatne` (katalog w
 * `logika/typy-zdarzen.js`) decyduje TYLKO o tym, czy naliczyć, nie o kwocie.
 * Zajęcie i wykreślenie zajęcia (`odplatne: false`) nigdy tu nie trafiają —
 * wolne od opłat z mocy art. 300(34) § 2 KSH.
 */
function naliczOplateWpisu(db, { spolkaId, sprawaId, typZdarzenia, autor }) {
  const teraz = czas.terazIso();
  const wynik = db
    .prepare(
      `INSERT INTO psa_oplaty (spolka_id, sprawa_id, typ, okres, kwota_grosze, status, data_naliczenia, notatka, autor, utworzono)
       VALUES (@spolka_id, @sprawa_id, 'wpis', NULL, @kwota_grosze, 'naliczona', @data_naliczenia, @notatka, @autor, @utworzono)`
    )
    .run({
      spolka_id: spolkaId,
      sprawa_id: sprawaId,
      kwota_grosze: przepisy.stawkaGrosze('wpis'),
      data_naliczenia: czas.dzisIso(),
      notatka: `Wpis: ${typZdarzenia}`,
      autor,
      utworzono: teraz,
    });
  return wczytaj(db, wynik.lastInsertRowid);
}

/**
 * Opłata za informację z rejestru (art. 300(35) KSH). Wywoływana zarówno
 * z portalu (klient sam pobiera informację), jak i z kancelarii (żądanie
 * papierowe/mailowe obsłużone przez pracownika).
 */
function naliczOplateInformacji(db, { spolkaId, odbiorcaOsobaId, autor, notatka }) {
  const wynik = db
    .prepare(
      `INSERT INTO psa_oplaty (spolka_id, sprawa_id, typ, okres, kwota_grosze, status, data_naliczenia, notatka, autor, utworzono)
       VALUES (@spolka_id, NULL, 'informacja', NULL, @kwota_grosze, 'naliczona', @data_naliczenia, @notatka, @autor, @utworzono)`
    )
    .run({
      spolka_id: spolkaId,
      kwota_grosze: przepisy.stawkaGrosze('informacja'),
      data_naliczenia: czas.dzisIso(),
      notatka: notatka || (odbiorcaOsobaId ? `Informacja z rejestru — odbiorca #${odbiorcaOsobaId}` : 'Informacja z rejestru'),
      autor,
      utworzono: czas.terazIso(),
    });
  return wczytaj(db, wynik.lastInsertRowid);
}

/**
 * Opłata za prowadzenie rejestru — raz na spółkę i rok (§ 15b pkt 1: "za
 * każdy rozpoczęty rok"). IDEMPOTENTNE: jeśli za wskazany `okres` istnieje
 * już opłata typu `prowadzenie` w stanie innym niż `anulowana`, nic nie
 * wstawiamy — zwracamy istniejący wiersz z `utworzono: false`, żeby
 * wsadowe naliczenie roczne dało się bezpiecznie odpalić wielokrotnie.
 */
function naliczOplateProwadzenia(db, { spolkaId, rok, autor }) {
  const istniejaca = db
    .prepare(
      `SELECT * FROM psa_oplaty
        WHERE spolka_id = ? AND typ = 'prowadzenie' AND okres = ? AND status != 'anulowana'
        LIMIT 1`
    )
    .get(spolkaId, String(rok));
  if (istniejaca) return { utworzono: false, oplata: istniejaca };

  const wynik = db
    .prepare(
      `INSERT INTO psa_oplaty (spolka_id, sprawa_id, typ, okres, kwota_grosze, status, data_naliczenia, notatka, autor, utworzono)
       VALUES (@spolka_id, NULL, 'prowadzenie', @okres, @kwota_grosze, 'naliczona', @data_naliczenia, NULL, @autor, @utworzono)`
    )
    .run({
      spolka_id: spolkaId,
      okres: String(rok),
      kwota_grosze: przepisy.stawkaGrosze('prowadzenie'),
      data_naliczenia: czas.dzisIso(),
      autor,
      utworzono: czas.terazIso(),
    });
  return { utworzono: true, oplata: wczytaj(db, wynik.lastInsertRowid) };
}

/**
 * Naliczenie roczne wsadowe — wszystkie spółki poza `wykreslona` (rejestr
 * zakończony, umowa nie obowiązuje dalej). Transakcja: albo cały rocznik
 * się nalicza, albo żaden — spójne z resztą modułu (regula domenowa
 * "wszystko w transakcji").
 */
function naliczOplateRoczneWszystkie(db, { rok, autor }) {
  const transakcja = db.transaction(() => {
    const spolki = db
      .prepare(`SELECT id FROM psa_spolki WHERE status != 'wykreslona' ORDER BY id`)
      .all();
    const naliczone = [];
    const pominiete = [];
    for (const s of spolki) {
      const { utworzono, oplata } = naliczOplateProwadzenia(db, { spolkaId: s.id, rok, autor });
      (utworzono ? naliczone : pominiete).push(oplata);
    }
    return { naliczone, pominiete };
  });
  return transakcja.immediate();
}

/** Reczny wpis oplaty — np. informacja wydana na miejscu, korekta, notatka ksiegowa. */
function dodajOplateReczna(db, { spolkaId, sprawaId, typ, kwotaGrosze, okres, notatka, autor }) {
  const kwota = kwotaGrosze != null && kwotaGrosze !== '' ? Number(kwotaGrosze) : przepisy.stawkaGrosze(typ);
  const wynik = db
    .prepare(
      `INSERT INTO psa_oplaty (spolka_id, sprawa_id, typ, okres, kwota_grosze, status, data_naliczenia, notatka, autor, utworzono)
       VALUES (@spolka_id, @sprawa_id, @typ, @okres, @kwota_grosze, 'naliczona', @data_naliczenia, @notatka, @autor, @utworzono)`
    )
    .run({
      spolka_id: spolkaId,
      sprawa_id: sprawaId ?? null,
      typ,
      okres: okres || null,
      kwota_grosze: kwota,
      data_naliczenia: czas.dzisIso(),
      notatka: notatka || null,
      autor,
      utworzono: czas.terazIso(),
    });
  return wczytaj(db, wynik.lastInsertRowid);
}

function zmienStatus(db, { id, status }) {
  db.prepare('UPDATE psa_oplaty SET status = ?, zaktualizowano = ? WHERE id = ?').run(
    status,
    czas.terazIso(),
    id
  );
  return wczytaj(db, id);
}

function wczytaj(db, id) {
  return db.prepare('SELECT * FROM psa_oplaty WHERE id = ?').get(id) || null;
}

/** CSV — bez zaleznosci, wlasny escaping (przecinek/cudzyslow/nowa linia). */
function pole(wartosc) {
  const tekst = wartosc === null || wartosc === undefined ? '' : String(wartosc);
  if (/[",\n]/.test(tekst)) return `"${tekst.replace(/"/g, '""')}"`;
  return tekst;
}

function eksportujCsv(wiersze) {
  const naglowek = ['id', 'spolka', 'typ', 'okres', 'kwota_zl', 'status', 'data_naliczenia', 'notatka', 'autor'];
  const linie = [naglowek.join(',')];
  for (const w of wiersze) {
    linie.push(
      [
        w.id,
        w.spolka_nazwa,
        w.typ,
        w.okres || '',
        (w.kwota_grosze / 100).toFixed(2),
        w.status,
        w.data_naliczenia,
        w.notatka || '',
        w.autor,
      ]
        .map(pole)
        .join(',')
    );
  }
  return linie.join('\r\n');
}

module.exports = {
  naliczOplateWpisu,
  naliczOplateInformacji,
  naliczOplateProwadzenia,
  naliczOplateRoczneWszystkie,
  dodajOplateReczna,
  zmienStatus,
  wczytaj,
  eksportujCsv,
};
