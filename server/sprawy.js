'use strict';

/**
 * Sprawy — każdy wpis idzie przez sprawę (R1). Ekran sprawy ma 3 kroki: 1 — treść (zmiany
 * i podstawa), 2 — sprawdzenie (stan przed i po, osoby z R2, checklista, opłata), 3 — pisma.
 *
 * „Dalej” (krok 1 → 2) tworzy powiadomienia o zamierzonym wpisie dla osób z R2 bez zgody na wpis.
 * „Zmień treść” (krok 2 → 1) usuwa niewysłane powiadomienia, a wysłane unieważnia. Stan sprawy
 * zmienia wyłącznie `zmienStan` (tabela przejść w `logika/sprawy.js`).
 */

const czas = require('./pomocnicze/czas');
const terminy = require('./logika/terminy');
const sprawyLogika = require('./logika/sprawy');
const stanLogika = require('./logika/stan');
const typy = require('./logika/typy-zdarzen');
const pisma = require('./logika/pisma');
const { BladWalidacji, naRobocza } = require('./logika/walidacje');
const rejestr = require('./rejestr');
const daneSprawy = require('./dane/sprawy');
const daneSpolki = require('./dane/spolki');
const daneOsoby = require('./dane/osoby');
const danePliki = require('./dane/pliki');
const daneRejestr = require('./dane/rejestr');

const ZADAJACY = ['spolka', 'osoba', 'organ', 'brak'];
const POLA_TRESCI = ['zadajacy', 'zadajacy_osoba_id', 'zadajacy_opis', 'operacje', 'podstawa', 'podstawa_data'];

const tekst = (v) => (v == null ? null : String(v).trim() || null);

function sprawdzDane(db, s) {
  const bledy = [];
  if (!ZADAJACY.includes(s.zadajacy)) bledy.push({ pole: 'zadajacy', komunikat: 'Wskaż żądającego: spółka, osoba albo organ.' });
  if (s.zadajacy === 'osoba' && !daneOsoby.wczytaj(db, s.zadajacy_osoba_id)) {
    bledy.push({ pole: 'zadajacy_osoba_id', komunikat: 'Wskaż osobę żądającą z kartoteki.' });
  }
  if (s.zadajacy === 'organ' && !s.zadajacy_opis) bledy.push({ pole: 'zadajacy_opis', komunikat: 'Podaj organ i sygnaturę.' });
  if (!czas.poprawnaData(s.data_wplywu) || s.data_wplywu > czas.dzisIso()) {
    bledy.push({ pole: 'data_wplywu', komunikat: 'Podaj prawidłową datę wpływu żądania.' });
  }
  if (s.podstawa_data && !czas.poprawnaData(s.podstawa_data)) bledy.push({ pole: 'podstawa_data', komunikat: 'Podaj prawidłową datę.' });
  if (!Array.isArray(s.operacje)) bledy.push({ pole: 'operacje', komunikat: 'Nieprawidłowa lista zmian.' });
  if (s.oplata != null && !['tak', 'nie'].includes(s.oplata)) bledy.push({ pole: 'oplata', komunikat: 'Wybierz: opłata albo bez opłaty.' });
  if (s.checklista != null && (typeof s.checklista !== 'object' || Array.isArray(s.checklista))) {
    bledy.push({ pole: 'checklista', komunikat: 'Nieprawidłowa checklista.' });
  }
  if (bledy.length > 0) throw new BladWalidacji(bledy);
  if (s.zadajacy !== 'osoba') s.zadajacy_osoba_id = null;
  else s.zadajacy_osoba_id = Number(s.zadajacy_osoba_id);
  if (s.zadajacy !== 'organ') s.zadajacy_opis = null;
  return s;
}

/** „Sprostuj” — formularz wypełniony bieżącą treścią wpisu (ostatnie sprostowanie albo wpis). */
function wypelnijSprostowania(db, spolkaId, operacje) {
  for (const op of operacje) {
    if (!op || op.typ !== 'sprostowanie' || op.tryb !== 'zastap' || op.zamiast) continue;
    const cel = daneRejestr.zdarzenie(db, op.zdarzenie_id);
    if (!cel || cel.spolka_id !== Number(spolkaId)) continue;
    const ostatnie = daneRejestr
      .zdarzeniaSpolki(db, spolkaId)
      .filter((z) => z.typ === 'sprostowanie' && z.zdarzenie_prostowane_id === cel.id)
      .pop();
    const tresc = ostatnie && ostatnie.dane.tryb === 'zastap' ? ostatnie.dane.zamiast : { typ: cel.typ, ...cel.dane };
    op.zamiast = naRobocza(tresc);
  }
}

function wczytajOtwarta(db, id) {
  const sprawa = daneSprawy.wczytaj(db, id);
  if (!sprawa) throw new BladWalidacji(['Nie odnaleziono sprawy.']);
  if (!sprawyLogika.otwarta(sprawa)) throw new BladWalidacji(['Sprawa jest zakończona — nie można jej zmieniać.']);
  return sprawa;
}

/** Powiadomienia o zamierzonym wpisie dla osób z R2 bez zgody i bez ważnego powiadomienia. */
function utworzPowiadomienia(db, sprawa, sym, kto) {
  const istniejace = pisma.lista(db, { sprawaId: sprawa.id }).filter((p) => p.typ === 'powiadomienie_zamierzony' && !p.uniewaznione);
  for (const id of rejestr.doPowiadomienia(sprawa, sym).wszystkie) {
    if (rejestr.maZgode(sprawa, id) || istniejace.some((p) => p.adresat_osoba_id === id)) continue;
    pisma.utworz(db, 'powiadomienie_zamierzony', {
      spolka_id: sprawa.spolka_id,
      sprawa_id: sprawa.id,
      adresat: 'osoba',
      adresat_osoba_id: id,
      kontekst: { operacje: sym.operacje },
      autor: kto,
    });
  }
}

/** Krok 1 → 2 („Dalej”): treść zatwierdzona, powstają powiadomienia (R2). */
function dalej(db, id, kto) {
  return db.transaction(() => {
    const sprawa = wczytajOtwarta(db, id);
    if (sprawa.tresc_zatwierdzona) throw new BladWalidacji(['Treść sprawy jest już zatwierdzona.']);
    const sym = rejestr.symuluj(db, sprawa);
    if (sym.bledy.length > 0) throw new BladWalidacji(sym.bledy);
    daneSprawy.zapisz(db, id, { tresc_zatwierdzona: czas.terazIso() });
    utworzPowiadomienia(db, daneSprawy.wczytaj(db, id), sym, kto);
    return daneSprawy.wczytaj(db, id);
  }).immediate();
}

/** Krok 2 → 1 („Zmień treść”): niewysłane powiadomienia znikają, wysłane tracą ważność (R2). */
function zmienTresc(db, id) {
  return db.transaction(() => {
    const sprawa = wczytajOtwarta(db, id);
    if (!sprawa.tresc_zatwierdzona) throw new BladWalidacji(['Treść sprawy nie jest jeszcze zatwierdzona.']);
    pisma.usunNiewyslane(db, { sprawaId: id, typ: 'powiadomienie_zamierzony' });
    pisma.uniewaznijWyslane(db, { sprawaId: id, typ: 'powiadomienie_zamierzony' });
    daneSprawy.zapisz(db, id, { tresc_zatwierdzona: null });
    return daneSprawy.wczytaj(db, id);
  }).immediate();
}

function sprawdzZgody(db, zgody) {
  if (!Array.isArray(zgody)) throw new BladWalidacji([{ pole: 'zgody', komunikat: 'Nieprawidłowa lista zgód.' }]);
  return zgody.map((z, i) => {
    const bledy = [];
    if (!daneOsoby.wczytaj(db, z.osoba_id)) bledy.push({ pole: `zgody.${i}.osoba_id`, komunikat: 'Wskaż osobę.' });
    // D-088: zgoda odnotowana tylko w dopuszczalnej formie (art. 300(34) § 3 zd. 2 KSH).
    if (z.dopuszczalna !== true) bledy.push({ pole: `zgody.${i}.dopuszczalna`, komunikat: 'Potwierdź, że zgoda jest w dopuszczalnej formie.' });
    if (!czas.poprawnaData(z.data) || z.data > czas.dzisIso()) bledy.push({ pole: `zgody.${i}.data`, komunikat: 'Podaj datę zgody.' });
    if (z.plik_id != null && !danePliki.wczytaj(db, z.plik_id)) bledy.push({ pole: `zgody.${i}.plik_id`, komunikat: 'Nie odnaleziono pliku.' });
    if (bledy.length > 0) throw new BladWalidacji(bledy);
    return { osoba_id: Number(z.osoba_id), dopuszczalna: true, data: z.data, plik_id: z.plik_id == null ? null : Number(z.plik_id) };
  });
}

/**
 * Autozapis roboczy. Pola treści (żądający, zmiany, podstawa) — tylko w kroku 1; checklista,
 * opłata, osoby dopisane do powiadomienia i zgody na wpis — w każdej chwili otwartej sprawy.
 */
function zmien(db, id, we, kto) {
  return db.transaction(() => {
    const sprawa = wczytajOtwarta(db, id);
    const tresc = POLA_TRESCI.filter((k) => we[k] !== undefined);
    if (tresc.length > 0 && sprawa.tresc_zatwierdzona) {
      throw new BladWalidacji([{ pole: tresc[0], komunikat: 'Treść sprawy jest zatwierdzona — wybierz „Zmień treść”, aby ją poprawić.' }]);
    }
    const pola = {};
    for (const k of [...POLA_TRESCI, 'dziala_przez', 'data_wplywu', 'checklista', 'oplata']) {
      if (we[k] !== undefined) pola[k] = ['podstawa', 'zadajacy_opis', 'dziala_przez'].includes(k) ? tekst(we[k]) : we[k];
    }
    const s = sprawdzDane(db, { ...sprawa, ...pola });
    for (const k of ['zadajacy_osoba_id', 'zadajacy_opis']) if (pola.zadajacy !== undefined || pola[k] !== undefined) pola[k] = s[k];
    if (pola.operacje) wypelnijSprostowania(db, sprawa.spolka_id, pola.operacje);

    if (we.zgody !== undefined) {
      pola.zgody = sprawdzZgody(db, we.zgody);
      for (const z of pola.zgody) {
        if (!rejestr.maZgode(sprawa, z.osoba_id)) {
          pisma.usunNiewyslane(db, { sprawaId: id, typ: 'powiadomienie_zamierzony', adresatOsobaId: z.osoba_id });
        }
      }
    }
    if (we.dopisane !== undefined) {
      if (!Array.isArray(we.dopisane) || we.dopisane.some((o) => !daneOsoby.wczytaj(db, o))) {
        throw new BladWalidacji([{ pole: 'dopisane', komunikat: 'Wskaż osoby z kartoteki.' }]);
      }
      pola.dopisane = [...new Set(we.dopisane.map(Number))];
      for (const usunieta of (sprawa.dopisane || []).filter((o) => !pola.dopisane.includes(o))) {
        pisma.usunNiewyslane(db, { sprawaId: id, typ: 'powiadomienie_zamierzony', adresatOsobaId: usunieta });
      }
    }
    daneSprawy.zapisz(db, id, pola);
    const po = daneSprawy.wczytaj(db, id);
    // Krok 2: dopisana osoba albo cofnięta zgoda — powiadomienie powstaje od razu (R2).
    if (po.tresc_zatwierdzona && (we.dopisane !== undefined || we.zgody !== undefined)) utworzPowiadomienia(db, po, rejestr.symuluj(db, po), kto);
    return po;
  }).immediate();
}

/**
 * Jedyna funkcja zmieniająca stan sprawy (tabela przejść). Skutki: wstrzymanie — wezwanie do
 * uzupełnienia; wznowienie — data usunięcia przeszkody (domyślnie dzień ostatniego pliku — R7);
 * odmowa — przyczyna i powiadomienie o odmowie; wpis — `rejestr.wpisz` (R1). Niewysłane pisma,
 * które przestały być potrzebne, usuwają się same.
 */
function zmienStan(db, id, na, we = {}, kto) {
  return db.transaction(() => {
    const sprawa = daneSprawy.wczytaj(db, id);
    if (!sprawa) throw new BladWalidacji(['Nie odnaleziono sprawy.']);
    sprawyLogika.sprawdzPrzejscie(sprawa.stan, na);
    const pola = {};
    const adresat = rejestr.adresatZadajacy(sprawa);
    const wspolne = { spolka_id: sprawa.spolka_id, sprawa_id: sprawa.id, autor: kto };
    const usunNiepotrzebne = () => {
      for (const typ of ['powiadomienie_zamierzony', 'wezwanie']) pisma.usunNiewyslane(db, { sprawaId: id, typ });
    };

    if (na === 'wstrzymana') {
      const tresc = tekst(we.tresc_wezwania);
      if (!tresc) throw new BladWalidacji([{ pole: 'tresc_wezwania', komunikat: 'Podaj treść wezwania do uzupełnienia.' }]);
      pola.wstrzymana_od = czas.dzisIso();
      if (adresat) pisma.utworz(db, 'wezwanie', { ...wspolne, ...adresat, kontekst: { tresc } });
    } else if (na === 'w_toku') {
      const data = we.data_usuniecia_przeszkody || danePliki.ostatniDzienPlikuSprawy(db, id, sprawa.wstrzymana_od) || czas.dzisIso();
      if (!czas.poprawnaData(data) || data < sprawa.wstrzymana_od || data > czas.dzisIso()) {
        throw new BladWalidacji([{ pole: 'data_usuniecia_przeszkody', komunikat: 'Data usunięcia przeszkody musi przypadać od dnia wstrzymania do dziś.' }]);
      }
      pola.wstrzymana_od = null;
      pola.wznowiona_od = data;
    } else if (na === 'odmowa') {
      const przyczyna = tekst(we.przyczyna);
      if (!przyczyna) throw new BladWalidacji([{ pole: 'przyczyna', komunikat: 'Podaj przyczynę odmowy wpisu.' }]);
      pola.przyczyna_odmowy = przyczyna;
      usunNiepotrzebne();
      if (adresat) pisma.utworz(db, 'powiadomienie_odmowa', { ...wspolne, ...adresat, kontekst: { przyczyna } });
    } else if (na === 'wycofana') {
      usunNiepotrzebne();
    } else if (na === 'wpisana') {
      if (!sprawa.tresc_zatwierdzona) throw new BladWalidacji(['Najpierw zatwierdź treść sprawy („Dalej”).']);
      rejestr.wpisz(db, sprawa, kto);
    }
    daneSprawy.ustawStan(db, id, na, pola);
    return daneSprawy.wczytaj(db, id);
  }).immediate();
}

/**
 * Zakłada sprawę (idempotentnie po kluczu). `wpisz: true` — sprawa bez powiadomień powstaje
 * i kończy wpisem jednym kliknięciem (R1); gdy wpis jest niemożliwy, sprawa nie powstaje.
 */
function zaloz(db, we, kto) {
  return db
    .transaction(() => {
      const klucz = tekst(we.klucz_idempotencji);
      if (klucz) {
        const istniejaca = daneSprawy.poKluczu(db, klucz);
        if (istniejaca) return { id: istniejaca.id, istniala: true };
      }
      if (!daneSpolki.wczytaj(db, we.spolka_id)) throw new BladWalidacji([{ pole: 'spolka_id', komunikat: 'Wskaż spółkę.' }]);
      const s = sprawdzDane(db, {
        spolka_id: Number(we.spolka_id),
        zadajacy: we.zadajacy,
        zadajacy_osoba_id: we.zadajacy_osoba_id,
        zadajacy_opis: tekst(we.zadajacy_opis),
        dziala_przez: tekst(we.dziala_przez),
        data_wplywu: we.data_wplywu || czas.dzisIso(),
        operacje: we.operacje || [],
        podstawa: tekst(we.podstawa),
        podstawa_data: we.podstawa_data || null,
        oplata: we.oplata ?? null,
        checklista: we.checklista ?? null,
        klucz_idempotencji: klucz,
        autor: kto,
      });
      wypelnijSprostowania(db, s.spolka_id, s.operacje);
      const id = daneSprawy.dodaj(db, s);
      if (s.checklista || s.oplata) daneSprawy.zapisz(db, id, { checklista: s.checklista || {}, oplata: s.oplata });
      if (we.wpisz === true) {
        dalej(db, id, kto);
        zmienStan(db, id, 'wpisana', {}, kto);
      }
      return { id, istniala: false };
    })
    .immediate();
}

/** Ekran sprawy: treść, termin, stan przed i po, osoby z R2, checklista, opłata, pisma, pliki. */
function podglad(db, id) {
  const sprawa = daneSprawy.wczytaj(db, id);
  if (!sprawa) return null;
  const spolka = daneSpolki.wczytaj(db, sprawa.spolka_id);
  const wynik = {
    sprawa,
    spolka: { id: spolka.id, nazwa: spolka.nazwa, krs: spolka.krs },
    zadajacy_osoba: sprawa.zadajacy_osoba_id ? daneOsoby.wczytaj(db, sprawa.zadajacy_osoba_id) : null,
    krok: sprawyLogika.krok(sprawa),
    termin: sprawyLogika.otwarta(sprawa) ? terminy.policzTermin(sprawa, czas.dzisIso()) : null,
    pisma: pisma.lista(db, { sprawaId: sprawa.id }),
    pliki: danePliki.lista(db, { sprawaId: sprawa.id }),
  };
  if (!sprawyLogika.otwarta(sprawa)) return wynik;

  const sym = rejestr.symuluj(db, sprawa);
  const osoby = rejestr.doPowiadomienia(sprawa, sym);
  wynik.bledy = sym.bledy;
  wynik.stan_przed = stanLogika.widok(sym.przed);
  wynik.stan_po = sym.po ? stanLogika.widok(sym.po) : null;
  wynik.osoby = osoby.wszystkie.map((oid) => ({
    osoba_id: oid,
    nazwa: (daneOsoby.wczytaj(db, oid) || {}).nazwa,
    dopisana: osoby.dopisane.includes(oid),
    zgoda: (sprawa.zgody || []).find((z) => z.osoba_id === oid) || null,
    powiadomienie: wynik.pisma.filter((p) => p.typ === 'powiadomienie_zamierzony' && p.adresat_osoba_id === oid && !p.uniewaznione).pop() || null,
  }));
  wynik.checklista = sym.operacje
    ? stanLogika.checklista(sym.operacje, sym.przed).map((p) => ({ ...p, zaznaczona: Boolean((sprawa.checklista || {})[p.klucz]) }))
    : [];
  wynik.oplata = { wymagana: Boolean(sym.operacje && sym.operacje.some((op) => typy.odplatna(op))), wybor: sprawa.oplata };
  wynik.przeszkody_wpisu =
    wynik.krok === 2 ? (sym.bledy.length > 0 ? sym.bledy : rejestr.wymaganiaWpisu(db, sprawa, sym)) : null;
  return wynik;
}

function lista(db, filtr) {
  const dzis = czas.dzisIso();
  return daneSprawy.lista(db, filtr).map((s) => ({
    id: s.id,
    spolka_id: s.spolka_id,
    spolka: s.spolka,
    stan: s.stan,
    zadajacy: s.zadajacy,
    zadajacy_nazwa: s.zadajacy_nazwa || s.zadajacy_opis,
    data_wplywu: s.data_wplywu,
    krok: sprawyLogika.krok(s),
    termin: sprawyLogika.otwarta(s) ? terminy.policzTermin(s, dzis) : null,
  }));
}

module.exports = { zaloz, zmien, dalej, zmienTresc, zmienStan, podglad, lista };
