'use strict';

/**
 * Serwis dokumentów wychodzących (faza 4).
 *
 * Spina trzy rzeczy, które wcześniej były zrośnięte w `logika/dokumenty-tresc.js`:
 *   1. TREŚĆ pisma  - szablon z bazy, redagowalny przez notariusza,
 *   2. PAPIER firmowy - nagłówek i stopka, wspólne dla wszystkich pism,
 *   3. ŚLAD wydania - zapis w `psa_wydane_dokumenty` wraz z wersją szablonu.
 *
 * Rozdzielenie 1 i 2 jest celowe: notariusz redaguje tekst, nie układ, a zmiana
 * danych kancelarii nie może wymagać poprawiania każdego szablonu z osobna.
 *
 * `logika/dokumenty-tresc.js` zostaje nietknięty i nadal obsługuje pisma
 * wysyłane automatem (zawiadomienia przy wpisie). Ten moduł jest ścieżką
 * szablonową; przełączenie automatu na szablony to osobna decyzja, bo dotyka
 * działającego workflow spraw.
 */

const szablony = require('./logika/szablony');
const { SZABLONY } = require('./logika/szablony-wbudowane');
const przepisy = require('./logika/przepisy');
const czas = require('./pomocnicze/czas');

// ─────────────────────────────────────────────────────────────
// Zasiew
// ─────────────────────────────────────────────────────────────

/**
 * Dopisuje wersję 1 każdego szablonu wbudowanego, którego jeszcze nie ma.
 * NIGDY nie nadpisuje istniejących - redakcja notariusza jest nadrzędna.
 * Idempotentne: wolno wołać przy każdym starcie.
 */
function zasiej(db, autor = 'system') {
  const istnieje = db.prepare('SELECT 1 FROM psa_szablony WHERE kod = ? LIMIT 1');
  const wstaw = db.prepare(
    `INSERT INTO psa_szablony (kod, wersja, tytul, tresc, opis, podstawa_prawna, aktywna, wbudowany, autor, utworzono)
     VALUES (@kod, 1, @tytul, @tresc, @opis, @podstawa_prawna, 1, 1, @autor, @utworzono)`
  );
  const teraz = czas.terazIso();
  const dodane = [];

  const transakcja = db.transaction(() => {
    for (const s of SZABLONY) {
      if (istnieje.get(s.kod)) continue;
      wstaw.run({
        kod: s.kod,
        tytul: s.tytul,
        tresc: s.tresc.trim(),
        opis: s.opis || null,
        podstawa_prawna: s.podstawa_prawna || null,
        autor,
        utworzono: teraz,
      });
      dodane.push(s.kod);
    }
  });
  transakcja();
  return dodane;
}

// ─────────────────────────────────────────────────────────────
// Odczyt szablonów
// ─────────────────────────────────────────────────────────────

function aktywny(db, kod) {
  return db.prepare('SELECT * FROM psa_szablony WHERE kod = ? AND aktywna = 1').get(kod) || null;
}

function wersje(db, kod) {
  return db.prepare('SELECT * FROM psa_szablony WHERE kod = ? ORDER BY wersja DESC').all(kod);
}

function wszystkieAktywne(db) {
  return db.prepare('SELECT * FROM psa_szablony WHERE aktywna = 1 ORDER BY kod').all();
}

/**
 * Zakłada kolejną wersję szablonu i czyni ją aktywną. Poprzednia zostaje
 * w bazie - to ona jest podstawą dokumentów już wydanych.
 */
function nowaWersja(db, { kod, tytul, tresc, opis, podstawa_prawna, autor }) {
  const poprzednia = db
    .prepare('SELECT MAX(wersja) AS maks FROM psa_szablony WHERE kod = ?')
    .get(kod);
  if (!poprzednia || poprzednia.maks == null) {
    throw new Error(`Nieznany szablon: ${kod}`);
  }
  const wersja = Number(poprzednia.maks) + 1;

  const transakcja = db.transaction(() => {
    // Indeks czesciowy dopuszcza tylko jedna aktywna wersje - najpierw gasimy.
    db.prepare('UPDATE psa_szablony SET aktywna = 0 WHERE kod = ? AND aktywna = 1').run(kod);
    db.prepare(
      `INSERT INTO psa_szablony (kod, wersja, tytul, tresc, opis, podstawa_prawna, aktywna, wbudowany, autor, utworzono)
       VALUES (@kod, @wersja, @tytul, @tresc, @opis, @podstawa_prawna, 1, 0, @autor, @utworzono)`
    ).run({
      kod,
      wersja,
      tytul,
      tresc,
      opis: opis || null,
      podstawa_prawna: podstawa_prawna || null,
      autor,
      utworzono: czas.terazIso(),
    });
  });
  transakcja();
  return db.prepare('SELECT * FROM psa_szablony WHERE kod = ? AND wersja = ?').get(kod, wersja);
}

/** Przywraca wcześniejszą wersję jako aktywną, bez zmiany jej treści. */
function aktywuj(db, kod, wersja) {
  const cel = db.prepare('SELECT * FROM psa_szablony WHERE kod = ? AND wersja = ?').get(kod, wersja);
  if (!cel) throw new Error(`Nie ma wersji ${wersja} szablonu ${kod}.`);
  const transakcja = db.transaction(() => {
    db.prepare('UPDATE psa_szablony SET aktywna = 0 WHERE kod = ? AND aktywna = 1').run(kod);
    db.prepare('UPDATE psa_szablony SET aktywna = 1 WHERE id = ?').run(cel.id);
  });
  transakcja();
  return { ...cel, aktywna: 1 };
}

// ─────────────────────────────────────────────────────────────
// Papier firmowy
// ─────────────────────────────────────────────────────────────

const STYL_STRONY = `
  font-family: Georgia, 'Times New Roman', serif; color: #1f1a14; line-height: 1.6;
  max-width: 680px; margin: 0 auto; padding: 8px;
`;

/**
 * Nagłówek kancelarii, tytuł i stopka z podstawą prawną. Ten sam układ dla
 * każdego pisma - stąd jedno miejsce zamiast trzynastu.
 */
function ramka({ tytul, kancelaria, tresc, podstawaPrawna, dataSporzadzenia }) {
  const e = szablony.esc;
  const wiersze = [kancelaria.adres, kancelaria.miejscowosc]
    .filter(Boolean)
    .map((w) => `<div style="font-size:12px; color:#6b6256;">${e(w)}</div>`)
    .join('');
  const kontakt = [kancelaria.telefon, kancelaria.email].filter(Boolean).join(' · ');

  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><title>${e(tytul)}</title></head>
<body style="${STYL_STRONY}">
  <div style="border-bottom:2px solid #1f1a14; padding-bottom:12px; margin-bottom:20px;">
    <div style="font-size:13px; text-transform:uppercase; letter-spacing:0.08em; color:#6b6256;">
      ${e(kancelaria.nazwa)}
    </div>
    ${wiersze}
    ${kontakt ? `<div style="font-size:12px; color:#6b6256;">${e(kontakt)}</div>` : ''}
  </div>
  <div style="text-align:right; font-size:12px; color:#6b6256; margin-bottom:16px;">
    ${e(kancelaria.miejscowosc || '')}, dnia ${e(szablony.dataSlownie(dataSporzadzenia) || dataSporzadzenia)}
  </div>
  <h1 style="font-size:21px; font-weight:500; margin:0 0 18px;">${e(tytul)}</h1>
  ${tresc}
  <div style="margin-top:32px; padding-top:14px; border-top:1px solid #e0d9ca; font-size:11px; color:#9e9487;">
    Rejestr akcjonariuszy prowadzony na podstawie art. 300(31) § 1 Kodeksu spółek handlowych.
    ${podstawaPrawna ? `<br>Podstawa niniejszego pisma: ${e(podstawaPrawna)}.` : ''}
  </div>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────

/**
 * Klucze dostępne w każdym szablonie. Trzymamy je w jednym miejscu, żeby
 * edytor mógł je podpowiedzieć, a podgląd - sprawdzić kompletność.
 */
function daneWspolne({ spolka, kancelaria, dzis }) {
  const adres = spolka
    ? [spolka.ulica, spolka.nr_domu && `${spolka.nr_domu}${spolka.nr_lokalu ? `/${spolka.nr_lokalu}` : ''}`]
        .filter(Boolean)
        .join(' ')
    : null;
  return {
    spolka_nazwa: spolka ? spolka.nazwa : null,
    spolka_krs: spolka ? spolka.krs : null,
    spolka_siedziba: spolka ? spolka.miejscowosc : null,
    spolka_adres: [adres, spolka && [spolka.kod_pocztowy, spolka.miejscowosc].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ') || null,
    kancelaria_nazwa: kancelaria.nazwa,
    kancelaria_adres: [kancelaria.adres, kancelaria.miejscowosc].filter(Boolean).join(', ') || null,
    miejscowosc_kancelarii: kancelaria.miejscowosc || null,
    notariusz: kancelaria.notariusz || kancelaria.nazwa,
    data_dzis: dzis,
  };
}

/**
 * Renderuje dokument z AKTYWNEJ wersji szablonu.
 *
 * Zwraca też `brakujace` - klucze, których szablon oczekiwał, a których nie
 * podano. Podgląd pokazuje tę listę PRZED wydaniem, bo w piśmie o skutkach
 * prawnych nieuzupełnione miejsce jest groźniejsze niż widoczna dziura.
 */
function renderuj(db, kod, { dane = {}, spolka = null, kancelaria, dzis = czas.dzisIso() }) {
  const szablon = aktywny(db, kod);
  if (!szablon) throw new Error(`Brak aktywnego szablonu o kodzie „${kod}”.`);

  const pelneDane = { ...daneWspolne({ spolka, kancelaria, dzis }), ...dane };
  const wynik = szablony.renderuj(szablon.tresc, pelneDane);

  return {
    szablon: { kod: szablon.kod, wersja: szablon.wersja, tytul: szablon.tytul },
    html: ramka({
      tytul: szablon.tytul,
      kancelaria,
      tresc: wynik.html,
      podstawaPrawna: szablon.podstawa_prawna,
      dataSporzadzenia: dzis,
    }),
    brakujace: wynik.brakujace,
    bledy: wynik.bledy,
  };
}

/** Zapis wydanego dokumentu wraz z wersją szablonu, z której powstał. */
function zapiszWydanie(db, { sprawaId = null, spolkaId, typ, odbiorcaOsobaId = null, kanal, html, szablon, autor }) {
  const wynik = db
    .prepare(
      `INSERT INTO psa_wydane_dokumenty
         (sprawa_id, spolka_id, typ, odbiorca_osoba_id, kanal, tresc_html,
          szablon_kod, szablon_wersja, autor, utworzono)
       VALUES (@sprawa_id, @spolka_id, @typ, @odbiorca_osoba_id, @kanal, @tresc_html,
               @szablon_kod, @szablon_wersja, @autor, @utworzono)`
    )
    .run({
      sprawa_id: sprawaId,
      spolka_id: spolkaId,
      typ,
      odbiorca_osoba_id: odbiorcaOsobaId,
      kanal,
      tresc_html: html,
      szablon_kod: szablon ? szablon.kod : null,
      szablon_wersja: szablon ? szablon.wersja : null,
      autor,
      utworzono: czas.terazIso(),
    });
  return db.prepare('SELECT * FROM psa_wydane_dokumenty WHERE id = ?').get(wynik.lastInsertRowid);
}

module.exports = {
  zasiej,
  aktywny,
  wersje,
  wszystkieAktywne,
  nowaWersja,
  aktywuj,
  ramka,
  daneWspolne,
  renderuj,
  zapiszWydanie,
};
