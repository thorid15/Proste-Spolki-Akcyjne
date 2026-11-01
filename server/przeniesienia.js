'use strict';

/**
 * Przeniesienie rejestru od innego podmiotu — operacje na bazie (Faza 4).
 * Reguły i statusy: `server/logika/przeniesienie.js`.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const konfiguracja = require('./konfiguracja');
const czas = require('./pomocnicze/czas');
const przepisy = require('./logika/przepisy');
const ustawienia = require('./logika/ustawienia');
const szablony = require('./logika/szablony');
const bloki = require('./logika/bloki-dokumentu');
const reguly = require('./logika/przeniesienie');
const walidacjaPodpisu = require('./logika/walidacja-podpisu');

class BladPrzeniesienia extends Error {
  constructor(komunikat, szczegoly = null) {
    super(komunikat);
    this.name = 'BladPrzeniesienia';
    this.szczegoly = szczegoly;
  }
}

const zJson = (t) => { try { return t ? JSON.parse(t) : {}; } catch { return {}; } };

function dokumenty(db, id) {
  return db.prepare(
    'SELECT id, typ, zrodlo, nazwa_pliku, sha256, rozmiar, autor, utworzono FROM psa_przeniesienia_dokumenty WHERE przeniesienie_id = ? ORDER BY id'
  ).all(id);
}

function wczytaj(db, id, { dzis = czas.dzisIso() } = {}) {
  const p = db.prepare('SELECT * FROM psa_przeniesienia WHERE id = ?').get(id);
  if (!p) return null;
  const wynik = {
    ...p,
    checklista_weryfikacji: zJson(p.checklista_weryfikacji),
    checklista_odbioru: zJson(p.checklista_odbioru),
    zatwierdzenie_walidacja: p.zatwierdzenie_walidacja ? zJson(p.zatwierdzenie_walidacja) : null,
  };
  const dok = dokumenty(db, id);
  return {
    ...wynik,
    nazwa_statusu: reguly.NAZWY_STATUSOW[p.status],
    poprzednik_opis: reguly.POPRZEDNICY[p.poprzednik_typ],
    termin_warunku: reguly.terminWarunku(p),
    przypomnienia: reguly.przypomnienia(p, dzis),
    dozwolone_przejscia: reguly.PRZEJSCIA[p.status],
    blokady_weryfikacji: reguly.blokadyChecklisty(reguly.CHECKLISTA_WERYFIKACJI, dok),
    blokady_odbioru: reguly.blokadyChecklisty(reguly.CHECKLISTA_ODBIORU, dok),
    dokumenty: dok,
    historia: db.prepare('SELECT * FROM psa_przeniesienia_historia WHERE przeniesienie_id = ? ORDER BY id').all(id),
    // W7.9 / D-085 — opłaty za przejęcie rejestru nie pobieramy.
    oplata_za_przejecie: 'brak (D-085)',
  };
}

function lista(db, { dzis = czas.dzisIso() } = {}) {
  return db.prepare('SELECT id FROM psa_przeniesienia ORDER BY id DESC').all().map((w) => wczytaj(db, w.id, { dzis }));
}

/** Przeniesienie dla konta portalu: po zgłoszeniu konta albo po wniosku konta. */
function dlaKonta(db, konto) {
  const w = db.prepare(
    `SELECT p.id FROM psa_przeniesienia p
       LEFT JOIN psa_wnioski wn ON wn.id = p.wniosek_id
      WHERE (p.zgloszenie_id IS NOT NULL AND p.zgloszenie_id = ?) OR wn.konto_id = ?
      ORDER BY p.id DESC LIMIT 1`
  ).get(konto.zgloszenie_id || -1, konto.id);
  return w ? wczytaj(db, w.id) : null;
}

/** Przeniesienie wniosku — po wniosek_id albo po zgłoszeniu konta wnioskodawcy (wiąże je przy okazji). */
function dlaWniosku(db, wniosek) {
  let w = db.prepare('SELECT id FROM psa_przeniesienia WHERE wniosek_id = ? ORDER BY id DESC LIMIT 1').get(wniosek.id);
  if (!w) {
    w = db.prepare(
      `SELECT p.id FROM psa_przeniesienia p JOIN psa_konta k ON k.zgloszenie_id = p.zgloszenie_id
        WHERE k.id = ? AND p.wniosek_id IS NULL ORDER BY p.id DESC LIMIT 1`
    ).get(wniosek.konto_id);
    if (w) powiazWniosek(db, w.id, wniosek.id);
  }
  return w ? wczytaj(db, w.id) : null;
}

function dlaSpolki(db, spolkaId) {
  const w = db.prepare('SELECT id FROM psa_przeniesienia WHERE spolka_id = ? ORDER BY id DESC LIMIT 1').get(spolkaId);
  return w ? wczytaj(db, w.id) : null;
}

/** W7.1 — zgłoszenie „Przenoszę rejestr od innego podmiotu”. */
function utworzZeZgloszenia(db, { zgloszenieId, krs, nazwa, poprzednikTyp, poprzednikNazwa, okresWypowiedzenia }) {
  if (!reguly.POPRZEDNICY[poprzednikTyp]) throw new BladPrzeniesienia('Wskaż dotychczasowy podmiot prowadzący rejestr.');
  const teraz = czas.terazIso();
  const wynik = db.prepare(
    `INSERT INTO psa_przeniesienia (zgloszenie_id, krs, nazwa, poprzednik_typ, poprzednik_nazwa, okres_wypowiedzenia, status, utworzono, zaktualizowano)
     VALUES (?, ?, ?, ?, ?, ?, 'zgloszone', ?, ?)`
  ).run(zgloszenieId, krs, nazwa || null, poprzednikTyp, poprzednikNazwa || null, okresWypowiedzenia || null, teraz, teraz);
  const id = Number(wynik.lastInsertRowid);
  db.prepare(`INSERT INTO psa_przeniesienia_historia (przeniesienie_id, z_statusu, na_status, uwagi, autor, utworzono)
              VALUES (?, NULL, 'zgloszone', 'Zgłoszenie z formularza publicznego', 'Portal — zgłoszenie', ?)`).run(id, teraz);
  return id;
}

/** Wiąże przeniesienie z wnioskiem konta (wniosek przenosi dane spółki i reprezentanta). */
function powiazWniosek(db, przeniesienieId, wniosekId) {
  db.prepare('UPDATE psa_przeniesienia SET wniosek_id = ?, zaktualizowano = ? WHERE id = ? AND wniosek_id IS NULL')
    .run(wniosekId, czas.terazIso(), przeniesienieId);
}

/** W7.10 — przejście z warunkami i śladem w historii (append-only). */
function przejdz(db, id, na, { autor, dane = {}, dzis = czas.dzisIso() } = {}) {
  const p = wczytaj(db, id, { dzis });
  if (!p) throw new BladPrzeniesienia('Nie odnaleziono przeniesienia.');
  const przeszkody = reguly.przeszkodyPrzejscia(p, na, { dzis, dokumenty: p.dokumenty, dane });
  if (przeszkody.length) throw new BladPrzeniesienia(przeszkody[0], przeszkody);
  const teraz = czas.terazIso();
  db.transaction(() => {
    const zmiany = { status: na, zaktualizowano: teraz };
    if (na === reguly.STATUSY.UMOWA_WARUNKOWA) zmiany.data_zawarcia_umowy = dane.data_zawarcia_umowy || p.data_zawarcia_umowy;
    if (na === reguly.STATUSY.OCZEKUJE) {
      zmiany.data_skutecznosci = dane.data_skutecznosci || p.data_skutecznosci;
      // Spółka z przyjętego wniosku — od chwili skuteczności rejestr jest nasz (W7.5, W7.9).
      const spolkaId = p.spolka_id || (p.wniosek_id && (db.prepare('SELECT spolka_id FROM psa_wnioski WHERE id = ?').get(p.wniosek_id) || {}).spolka_id) || null;
      if (spolkaId) {
        zmiany.spolka_id = spolkaId;
        db.prepare('UPDATE psa_spolki SET data_skutecznosci_umowy = ? WHERE id = ?').run(zmiany.data_skutecznosci, spolkaId);
      }
    }
    if (na === reguly.STATUSY.WSTRZYMANE) zmiany.rozbieznosci = String(dane.uwagi || '').trim();
    const kolumny = Object.keys(zmiany);
    db.prepare(`UPDATE psa_przeniesienia SET ${kolumny.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...zmiany, id });
    db.prepare(`INSERT INTO psa_przeniesienia_historia (przeniesienie_id, z_statusu, na_status, uwagi, autor, utworzono) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, p.status, na, String(dane.uwagi || '').trim() || null, autor || 'system', teraz);
  })();
  return wczytaj(db, id, { dzis });
}

/** Umowa wygasła po 12 miesiącach (klauzula ust. 4) — stosowane przy odczycie listy i z pulpitu. */
function zastosujWygasniecia(db, dzis = czas.dzisIso()) {
  const wygasle = db.prepare("SELECT * FROM psa_przeniesienia WHERE status = 'umowa_warunkowa'").all()
    .filter((p) => reguly.czyWygasla(p, dzis));
  for (const p of wygasle) {
    przejdz(db, p.id, reguly.STATUSY.WYGASLA, { autor: 'system', dane: { uwagi: 'Warunek nie ziścił się w 12 miesięcy od zawarcia umowy (klauzula ust. 4).' }, dzis });
  }
  return wygasle.length;
}

/** Checklista Etapu 3 albo 6 — zaznacza człowiek; pozycji na pewno niespełnionej nie da się zaznaczyć (D-052). */
function zapiszCheckliste(db, id, rodzaj, zaznaczone) {
  const p = wczytaj(db, id);
  if (!p) throw new BladPrzeniesienia('Nie odnaleziono przeniesienia.');
  const definicja = rodzaj === 'odbioru' ? reguly.CHECKLISTA_ODBIORU : reguly.CHECKLISTA_WERYFIKACJI;
  const blokady = rodzaj === 'odbioru' ? p.blokady_odbioru : p.blokady_weryfikacji;
  const czyste = {};
  for (const poz of definicja) {
    if (zaznaczone && zaznaczone[poz.kod]) {
      if (blokady[poz.kod]) throw new BladPrzeniesienia(`„${poz.tresc}” — ${blokady[poz.kod]}`);
      czyste[poz.kod] = true;
    }
  }
  db.prepare(`UPDATE psa_przeniesienia SET ${rodzaj === 'odbioru' ? 'checklista_odbioru' : 'checklista_weryfikacji'} = ?, zaktualizowano = ? WHERE id = ?`)
    .run(JSON.stringify(czyste), czas.terazIso(), id);
  return wczytaj(db, id);
}

function katalog(id) {
  return path.join(konfiguracja.KATALOG_DOKUMENTOW, 'przeniesienia', `przeniesienie_${id}`);
}

function dodajDokument(db, id, { typ, zrodlo, nazwa, bufor, autor }) {
  fs.mkdirSync(katalog(id), { recursive: true });
  const pelna = path.join(katalog(id), `${crypto.randomUUID()}${path.extname(String(nazwa || '')).toLowerCase() || '.bin'}`);
  fs.writeFileSync(pelna, bufor);
  db.prepare(
    `INSERT INTO psa_przeniesienia_dokumenty (przeniesienie_id, typ, zrodlo, nazwa_pliku, sciezka, sha256, rozmiar, autor, utworzono)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, typ, zrodlo, String(nazwa || 'plik'), path.relative(konfiguracja.KATALOG_DOKUMENTOW, pelna),
    crypto.createHash('sha256').update(bufor).digest('hex'), bufor.length, autor, czas.terazIso());
  return wczytaj(db, id);
}

function sciezkaDokumentu(db, id, dokumentId) {
  const d = db.prepare('SELECT * FROM psa_przeniesienia_dokumenty WHERE id = ? AND przeniesienie_id = ?').get(dokumentId, id);
  if (!d) return null;
  const pelna = path.join(konfiguracja.KATALOG_DOKUMENTOW, d.sciezka);
  return pelna.startsWith(konfiguracja.KATALOG_DOKUMENTOW) && fs.existsSync(pelna) ? { pelna, nazwa: d.nazwa_pliku } : null;
}

// ─────────────────────────────────────────────────────────────
// W7.4 — pisma z istniejącego mechanizmu szablonów (psa_szablony)
// ─────────────────────────────────────────────────────────────

const PISMA = [
  'przeniesienie_klauzula', 'przeniesienie_uchwala', 'przeniesienie_wypowiedzenie', 'przeniesienie_potwierdzenie_zawarcia',
  'przeniesienie_wezwanie', 'przeniesienie_zgloszenie_krs', 'przeniesienie_rodo_art14', 'przeniesienie_potwierdzenie_odbioru',
];
/** Pisma [2027] — za istniejącą bramką daty. */
const PISMA_2027 = new Set(['przeniesienie_zgloszenie_krs']);

function kodSzablonu(p, kod) {
  return kod === 'przeniesienie_wezwanie' ? `przeniesienie_wezwanie_${p.poprzednik_typ}` : kod;
}

function danePisma(db, p) {
  const k = ustawienia.kancelaria(db);
  const spolka = p.spolka_id ? db.prepare('SELECT * FROM psa_spolki WHERE id = ?').get(p.spolka_id) : null;
  return {
    spolka_nazwa: (spolka && spolka.nazwa) || p.nazwa || '—',
    spolka_krs: (spolka && spolka.krs) || p.krs || '—',
    poprzednik_nazwa: p.poprzednik_nazwa || reguly.POPRZEDNICY[p.poprzednik_typ],
    notariusz: k.notariusz_mianownik || 'Łukasz Kozon',
    kancelaria_nazwa: k.nazwa,
    kancelaria_adres: k.adres || '—',
    data_zawarcia: p.data_zawarcia_umowy || '……',
    data_skutecznosci: p.data_skutecznosci || '……',
  };
}

function listaPism(db, p, dzis = czas.dzisIso()) {
  return PISMA.filter((kod) => !PISMA_2027.has(kod) || przepisy.nowelizacjaObowiazuje(dzis)).map((kod) => {
    const sz = db.prepare('SELECT kod, tytul FROM psa_szablony WHERE kod = ? AND aktywna = 1').get(kodSzablonu(p, kod));
    return { kod, tytul: sz ? sz.tytul : kod, projekt: kod !== 'przeniesienie_klauzula' };
  });
}

function renderujPismo(db, p, kod, dzis = czas.dzisIso()) {
  if (!PISMA.includes(kod)) throw new BladPrzeniesienia('Nieznane pismo.');
  if (PISMA_2027.has(kod) && !przepisy.nowelizacjaObowiazuje(dzis)) {
    throw new BladPrzeniesienia(`Pismo dostępne od ${przepisy.NOWELIZACJA.WEJSCIE_W_ZYCIE} (nowelizacja ${przepisy.NOWELIZACJA.DZIENNIK}).`);
  }
  const sz = db.prepare('SELECT * FROM psa_szablony WHERE kod = ? AND aktywna = 1').get(kodSzablonu(p, kod));
  if (!sz) throw new BladPrzeniesienia('Brak aktywnego szablonu pisma.');
  const { html, brakujace } = szablony.renderuj(sz.tresc, danePisma(db, p));
  return {
    tytul: sz.tytul, brakujace,
    html: `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${szablony.esc(sz.tytul)}</title>
<style>body{font:12pt Georgia,serif;max-width:170mm;margin:15mm auto}.projekt{color:#b00020;border:2px solid #b00020;padding:4px 8px;display:inline-block}</style>
</head><body>${html}</body></html>`,
  };
}

// ─────────────────────────────────────────────────────────────
// W7.7 — protokół przejęcia (PDF z ID) i zatwierdzenie QES (ścieżka z Fazy 2)
// ─────────────────────────────────────────────────────────────

async function protokol(db, id) {
  const p = wczytaj(db, id);
  if (!p) throw new BladPrzeniesienia('Nie odnaleziono przeniesienia.');
  const identyfikator = p.protokol_id_dokumentu || `PSA-P${id}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const b = bloki.blok;
  const lista = [
    b.tytul('Protokół przejęcia rejestru akcjonariuszy', p.nazwa || ''),
    b.pola([
      ['Spółka', `${p.nazwa || '—'} (KRS ${p.krs || '—'})`],
      ['Dotychczasowy podmiot', `${p.poprzednik_nazwa || '—'} — ${p.poprzednik_opis}`],
      ['Umowa zawarta', p.data_zawarcia_umowy || '—'],
      ['Umowa skuteczna od', p.data_skutecznosci || '—'],
    ]),
    b.sekcja('Dokumenty źródłowe (SHA-256)'),
    ...p.dokumenty.map((d) => b.punkt('•', `${d.nazwa_pliku} (${d.typ}, ${d.zrodlo}) — ${d.sha256}`)),
    b.sekcja('Odbiór i uzgodnienie'),
    ...reguly.CHECKLISTA_ODBIORU.map((poz) => b.opcja(poz.tresc, Boolean(p.checklista_odbioru[poz.kod]))),
    b.akapit('Rejestr odwzorowano według danych dotychczasowego podmiotu; korekty wyłącznie w trybie żądania wpisu.'),
    b.podpis(`${ustawienia.kancelaria(db).notariusz_mianownik || 'Notariusz'} — podpis kwalifikowany`),
  ];
  const plik = await bloki.doPdf(lista, { tytul: 'Protokół przejęcia rejestru', autor: ustawienia.kancelaria(db).nazwa, identyfikator });
  fs.mkdirSync(katalog(id), { recursive: true });
  const pelna = path.join(katalog(id), `protokol-${identyfikator}.pdf`);
  fs.writeFileSync(pelna, plik);
  db.prepare(`UPDATE psa_przeniesienia SET protokol_sciezka = ?, protokol_id_dokumentu = ?, protokol_sha256 = ?, protokol_dlugosc = ?,
              zatwierdzenie_sciezka = NULL, zatwierdzenie_walidacja = NULL, zatwierdzono = NULL, zaktualizowano = ? WHERE id = ?`)
    .run(path.relative(konfiguracja.KATALOG_DOKUMENTOW, pelna), identyfikator,
      crypto.createHash('sha256').update(plik).digest('hex'), plik.length, czas.terazIso(), id);
  return plik;
}

async function zatwierdz(db, id, { bufor, nazwa, atrapa }) {
  const p = wczytaj(db, id);
  if (!p) throw new BladPrzeniesienia('Nie odnaleziono przeniesienia.');
  if (!p.protokol_sha256) throw new BladPrzeniesienia('Najpierw wygeneruj protokół przejęcia (PDF), który podpisze notariusz.');
  // D-086: test „czy plik jest podpisany” + porównanie z protokołem; resztę sprawdza pracownik.
  const wynik = await walidacjaPodpisu.waliduj({ plik: bufor, oryginal: { sha256: p.protokol_sha256, dlugosc: p.protokol_dlugosc }, atrapa });
  if (wynik.wynik === walidacjaPodpisu.WYNIKI.ODRZUCONY) throw new BladPrzeniesienia(wynik.komunikat, { walidacja: wynik });
  fs.mkdirSync(katalog(id), { recursive: true });
  const pelna = path.join(katalog(id), `protokol-podpisany-${crypto.randomUUID()}.pdf`);
  fs.writeFileSync(pelna, bufor);
  db.prepare('UPDATE psa_przeniesienia SET zatwierdzenie_sciezka = ?, zatwierdzenie_walidacja = ?, zatwierdzono = ?, zaktualizowano = ? WHERE id = ?')
    .run(path.relative(konfiguracja.KATALOG_DOKUMENTOW, pelna), JSON.stringify(wynik), czas.terazIso(), czas.terazIso(), id);
  return wczytaj(db, id);
}

/**
 * W7.5 — żądania wpisu dla spółki w trakcie przeniesienia: przed chwilą
 * skuteczności umowy notariusz nie prowadzi rejestru (klauzula ust. 5) →
 * odmowa przyjęcia; od chwili skuteczności — przyjmujemy, ale bez danych od
 * poprzednika wpis ma przeszkodę (art. 300(34) § 1 zd. 2 KSH) → wstrzymanie
 * istniejącym mechanizmem zamrożenia terminu.
 */
function stanDlaSpraw(db, spolkaId) {
  const p = spolkaId ? db.prepare(
    "SELECT * FROM psa_przeniesienia WHERE spolka_id = ? AND status NOT IN ('aktywny', 'wygasla') ORDER BY id DESC LIMIT 1"
  ).get(spolkaId) : null;
  if (!p) return null;
  if (!p.data_skutecznosci || p.data_skutecznosci > czas.dzisIso()) {
    return { blokada: 'Do chwili skuteczności umowy o prowadzenie rejestru (rozwiązania dotychczasowej umowy) notariusz nie prowadzi rejestru tej spółki — żądanie należy złożyć u dotychczasowego podmiotu.' };
  }
  return { przeszkoda: 'Brak danych od dotychczasowego podmiotu prowadzącego rejestr — przeszkoda wpisu (art. 300(34) § 1 zd. 2 KSH); termin biegnie od jej usunięcia.' };
}

function wstrzymajZPrzeszkoda(db, sprawaId, powod) {
  const terminy = require('./logika/terminy');
  const sprawa = db.prepare('SELECT * FROM psa_sprawy WHERE id = ?').get(sprawaId);
  const poprawki = terminy.wstrzymaj({ ...sprawa, stan: sprawa.stan === 'nowa' ? 'weryfikacja' : sprawa.stan }, czas.dzisIso());
  db.prepare(
    `UPDATE psa_sprawy SET stan = @stan, wstrzymana_od = @wstrzymana_od, termin_do = NULL,
            notatka = COALESCE(notatka || char(10), '') || @notatka, zaktualizowano = @teraz WHERE id = @id`
  ).run({ ...poprawki, notatka: `[${czas.terazIso()}] Wstrzymano: ${powod}`, teraz: czas.terazIso(), id: sprawaId });
}

/**
 * W7.8 — powiadomienia po otwarciu (Etap 8): spółka (potwierdzenie przejęcia
 * + stan rejestru), dotychczasowy podmiot (potwierdzenie odbioru — PROJEKT do
 * druku), akcjonariusze (informacja z art. 14 RODO + formularz zgód — e-mail
 * przy zgodzie, inaczej list). Organy egzekucyjne — zadanie ręczne na pulpicie.
 */
async function powiadomieniaPoPrzejeciu(db, id, autor) {
  const poczta = require('./poczta');
  const listy = require('./listy');
  const widoki = require('./widoki');
  const informacjaDokument = require('./logika/informacja-dokument');
  const p = wczytaj(db, id);
  const spolka = db.prepare('SELECT * FROM psa_spolki WHERE id = ?').get(p.spolka_id);
  const teraz = czas.terazIso();
  const zapisz = (typ, kanal, tresc, wyslano, odbiorca = null) => Number(db.prepare(
    `INSERT INTO psa_wydane_dokumenty (spolka_id, typ, odbiorca_osoba_id, kanal, tresc_html, wyslano, autor, utworzono)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(spolka.id, typ, odbiorca, kanal, tresc, wyslano, autor, teraz).lastInsertRowid);
  const wyniki = [];

  const stan = widoki.widokStanu(db, spolka.id, czas.dzisIso(), { rola: przepisy.ROLE_ODBIORCY.SPOLKA });
  const stanHtml = informacjaDokument.informacjaZRejestru({
    kancelaria: ustawienia.kancelaria(db), spolka: stan.spolka, data: czas.dzisIso(), stan,
    odbiorca: { rola: przepisy.ROLE_ODBIORCY.SPOLKA, opis: 'spółka — potwierdzenie przejęcia rejestru' }, sporzadzono: teraz,
  });
  const potwierdzenie = `<p>Potwierdzamy przejęcie prowadzenia rejestru akcjonariuszy ${szablony.esc(spolka.nazwa)} od ${szablony.esc(p.poprzednik_nazwa || '')}
    z dniem ${szablony.esc(p.data_skutecznosci)}. W załączeniu stan rejestru na dzień otwarcia.</p>`;
  const proba = await poczta.wyslij({
    do: spolka.email, temat: `Potwierdzenie przejęcia rejestru akcjonariuszy — ${spolka.nazwa}`, html: potwierdzenie,
    zalaczniki: [{ filename: 'stan-rejestru.html', content: Buffer.from(stanHtml) }],
  });
  wyniki.push({ odbiorca: 'spółka', id: zapisz('raport', 'email', potwierdzenie + stanHtml, proba.wyslano ? teraz : null), ...proba });

  const odbior = renderujPismo(db, p, 'przeniesienie_potwierdzenie_odbioru');
  wyniki.push({ odbiorca: 'dotychczasowy podmiot', id: zapisz('raport', 'papier', odbior.html, null), status: 'do_druku' });

  const rodo = renderujPismo(db, p, 'przeniesienie_rodo_art14');
  const osoby = [...new Set(stan.akcjonariusze.map((a) => a.osoba_id))]
    .map((oid) => db.prepare('SELECT * FROM psa_osoby WHERE id = ?').get(oid)).filter(Boolean);
  for (const osoba of osoby) {
    if (listy.kanalDlaOsoby(osoba) === 'email') {
      const pr = await poczta.wyslij({ do: osoba.email, temat: `Rejestr akcjonariuszy ${spolka.nazwa} — zmiana podmiotu`, html: rodo.html });
      wyniki.push({ odbiorca: listy.oznaczenie(osoba), id: zapisz('raport', 'email', rodo.html, pr.wyslano ? teraz : null, osoba.id), ...pr });
    } else {
      const idPisma = zapisz('raport', 'papier', rodo.html, null, osoba.id);
      const listId = listy.dodaj(db, { wydanyDokumentId: idPisma, spolkaId: spolka.id, sprawaId: null, osoba, rodzajPisma: 'przejecie_rodo' });
      wyniki.push({ odbiorca: listy.oznaczenie(osoba), id: idPisma, status: 'list', list_id: listId });
    }
  }
  return wyniki;
}

/** W7.8 / [2027] — zadania ręczne po przejęciu (organy egzekucyjne, zgłoszenie do KRS). */
function zadaniaPoPrzejeciu(db, dzis = czas.dzisIso()) {
  const zadania = [];
  const zrobione = (id, kod) => Boolean(db.prepare(
    "SELECT 1 FROM psa_przeniesienia_historia WHERE przeniesienie_id = ? AND uwagi LIKE ?"
  ).get(id, `[zadanie:${kod}]%`));
  for (const p of db.prepare("SELECT * FROM psa_przeniesienia WHERE status NOT IN ('wygasla')").all()) {
    for (const pr of reguly.przypomnienia(p, dzis)) {
      zadania.push({ klucz: `przen-${p.id}-${pr.rodzaj}`, rodzaj: pr.rodzaj, spolka_id: p.spolka_id, spolka_nazwa: p.nazwa,
        tytul: pr.tresc, termin: pr.termin, podstawa: 'klauzula § 7.4 wytycznych', sciezka: `/przeniesienia/${p.id}` });
    }
    if (p.status === 'zgloszone') {
      zadania.push({ klucz: `przen-${p.id}-nowe`, rodzaj: 'przeniesienie', spolka_nazwa: p.nazwa, tytul: 'Zgłoszenie przeniesienia rejestru — rozpocznij weryfikację',
        termin: String(p.utworzono).slice(0, 10), podstawa: 'wytyczne § 7.2', sciezka: `/przeniesienia/${p.id}` });
    }
    if (p.status === 'wstrzymane_rozbieznosci') {
      zadania.push({ klucz: `przen-${p.id}-rozb`, rodzaj: 'przeniesienie', spolka_nazwa: p.nazwa, tytul: 'Rozbieżności w przejmowanym rejestrze — wyjaśnij z poprzednikiem / spółką',
        termin: String(p.zaktualizowano || p.utworzono).slice(0, 10), podstawa: 'wytyczne § 7.2 Etap 6', sciezka: `/przeniesienia/${p.id}` });
    }
    if (p.status === 'aktywny' && p.spolka_id) {
      const zajecia = db.prepare("SELECT (SELECT COUNT(*) FROM psa_zdarzenia WHERE spolka_id = ? AND typ = 'zajecie') - (SELECT COUNT(*) FROM psa_zdarzenia WHERE spolka_id = ? AND typ = 'wykreslenie_zajecia') AS n")
        .get(p.spolka_id, p.spolka_id).n;
      if (zajecia > 0 && !zrobione(p.id, 'organy')) {
        zadania.push({ klucz: `przen-${p.id}-organy`, rodzaj: 'organy', spolka_id: p.spolka_id, spolka_nazwa: p.nazwa,
          tytul: 'Poinformuj organy egzekucyjne o zmianie podmiotu prowadzącego rejestr (ręcznie)', termin: p.data_skutecznosci,
          podstawa: 'wytyczne § 7.2 Etap 8', sciezka: `/przeniesienia/${p.id}`, kod_zadania: 'organy' });
      }
      if (przepisy.nowelizacjaObowiazuje(dzis) && !zrobione(p.id, 'krs')) {
        zadania.push({ klucz: `przen-${p.id}-krs`, rodzaj: 'krs', spolka_id: p.spolka_id, spolka_nazwa: p.nazwa,
          tytul: 'Przypomnij zarządowi o zgłoszeniu zawarcia umowy do sądu rejestrowego (PRS)', termin: p.data_skutecznosci,
          podstawa: 'art. 300(32) § 1(1) KSH', sciezka: `/przeniesienia/${p.id}`, kod_zadania: 'krs' });
      }
    }
  }
  return zadania;
}

module.exports = {
  BladPrzeniesienia,
  powiadomieniaPoPrzejeciu,
  zadaniaPoPrzejeciu,
  stanDlaSpraw,
  wstrzymajZPrzeszkoda,
  wczytaj,
  lista,
  dlaKonta,
  dlaWniosku,
  dlaSpolki,
  utworzZeZgloszenia,
  powiazWniosek,
  przejdz,
  zastosujWygasniecia,
  zapiszCheckliste,
  dodajDokument,
  sciezkaDokumentu,
  listaPism,
  renderujPismo,
  protokol,
  zatwierdz,
};
