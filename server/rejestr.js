'use strict';

/**
 * Rejestr: odczyt stanu, symulacja sprawy (stan przed i po) i wpis.
 *
 * R1 — jedna droga zapisu: do `psa_zdarzenia` dopisuje wyłącznie `wpisz`, wołana przez
 * `sprawy.zmienStan(…, 'wpisana')` w jego transakcji. Kolejność: walidacje → wpisy wszystkich
 * operacji sprawy → pełne odtworzenie stanu i materializacje → opłata (wybór U-02) → pisma
 * „powiadomienie o wpisie” w stanie `do_wyslania`. Status sprawy ustawia `zmienStan`.
 */

const czas = require('./pomocnicze/czas');
const lancuch = require('./logika/lancuch');
const stanLogika = require('./logika/stan');
const walidacje = require('./logika/walidacje');
const typy = require('./logika/typy-zdarzen');
const pisma = require('./logika/pisma');
const przepisy = require('./logika/przepisy');
const daneRejestr = require('./dane/rejestr');
const daneSpolki = require('./dane/spolki');
const daneOsoby = require('./dane/osoby');
const daneOplaty = require('./dane/oplaty');
const daneSprawy = require('./dane/sprawy');

const { BladWalidacji } = walidacje;
const BLEDY_STANU = ['BladStanu', 'BladUlamka', 'BladZakresu'];

/** Stan spółki — bieżący albo na koniec dnia `dzien` (tylko wpisy dokonane do końca tego dnia). */
function stanSpolki(db, spolkaId, dzien = null) {
  const zdarzenia = dzien
    ? daneRejestr.zdarzeniaDo(db, spolkaId, czas.koniecDniaUtc(dzien))
    : daneRejestr.zdarzeniaSpolki(db, spolkaId);
  return stanLogika.odtworzStan(zdarzenia);
}

/** Operacja → zapis wpisu: typ, treść (bez typu) i wpis prostowany. Bez danych osobowych (R10). */
function trescWpisu(op) {
  const { typ, ...dane } = op;
  if (typ !== 'sprostowanie') return { typ, dane, zdarzenieProstowaneId: null };
  const { zdarzenie_id: prostowany, ...reszta } = dane;
  return { typ, dane: reszta, zdarzenieProstowaneId: prostowany };
}

/**
 * Symuluje sprawę bez zapisu: treść wpisów, stan przed i po oraz błędy (przy polach i blokady R6:
 * rejestr zamknięty, data emisji w KRS, PESEL, rozporządzenie ponad stan posiadania, bilans).
 */
function symuluj(db, sprawa, chwila = czas.terazUtc()) {
  const zdarzenia = daneRejestr.zdarzeniaSpolki(db, sprawa.spolka_id);
  const przed = stanLogika.odtworzStan(zdarzenia);
  const spolka = daneSpolki.wczytaj(db, sprawa.spolka_id);
  const zdarzenie = (id) => {
    const z = daneRejestr.zdarzenie(db, id);
    return z && z.spolka_id === spolka.id ? z : null;
  };
  const bledy = [];
  const ostatni = zdarzenia[zdarzenia.length - 1];
  if (ostatni && ostatni.data_wpisu > chwila) {
    bledy.push({ komunikat: 'Zegar systemu wskazuje chwilę wcześniejszą niż ostatni wpis spółki — wpis wstrzymany (D-R01).' });
    return { przed, po: null, operacje: null, bledy };
  }
  let operacje = null;
  try {
    operacje = walidacje.przygotuj(sprawa.operacje, { osoba: (id) => daneOsoby.wczytaj(db, id), zdarzenie, stan: przed });
  } catch (e) {
    if (e.name !== 'BladWalidacji') throw e;
    bledy.push(...e.bledy);
  }
  bledy.unshift(...walidacje.sprawdzSklad(sprawa.operacje, operacje, sprawa.zadajacy));
  if (bledy.length > 0) return { przed, po: null, operacje: null, bledy };

  for (const k of walidacje.sprawdzBlokady(operacje, { stan: przed, spolka, dzisiaj: czas.dzisIso(), zdarzenie })) {
    bledy.push({ komunikat: k });
  }
  if (bledy.length > 0) return { przed, po: null, operacje, bledy };

  const pierwszeId = daneRejestr.ostatnieId(db) + 1;
  const symulowane = operacje.map((op, i) => {
    const t = trescWpisu(op);
    return {
      id: pierwszeId + i,
      spolka_id: spolka.id,
      typ: t.typ,
      data_wpisu: chwila,
      sprawa_id: sprawa.id,
      dane: t.dane,
      zdarzenie_prostowane_id: t.zdarzenieProstowaneId,
    };
  });
  let po = null;
  try {
    po = stanLogika.odtworzStan([...zdarzenia, ...symulowane]);
    for (const k of stanLogika.sprawdzBilans(po)) bledy.push({ komunikat: k });
  } catch (e) {
    if (!BLEDY_STANU.includes(e.name)) throw e;
    bledy.push({ komunikat: e.message });
  }
  return { przed, po: bledy.length ? null : po, operacje, bledy };
}

/** R2: osoby do powiadomienia — wyliczone z porównania stanu i dopisane przez pracownika. */
function doPowiadomienia(sprawa, sym) {
  const wyliczone = sym.po ? stanLogika.ktoTraci(sym.przed, sym.po) : [];
  const dopisane = (sprawa.dopisane || []).map(Number).filter((id) => !wyliczone.includes(id));
  return { wyliczone, dopisane, wszystkie: [...wyliczone, ...dopisane] };
}

const maZgode = (sprawa, osobaId) => (sprawa.zgody || []).some((z) => z.osoba_id === Number(osobaId));

/** Warunki wpisu ponad symulację: checklista (R5), wybór opłaty (U-02), powiadomienia (R2). */
function wymaganiaWpisu(db, sprawa, sym) {
  const bledy = [];
  const brak = stanLogika.checklista(sym.operacje, sym.przed).filter((p) => !(sprawa.checklista || {})[p.klucz]);
  if (brak.length > 0) bledy.push({ pole: 'checklista', komunikat: `Odhacz checklistę: ${brak.map((p) => p.etykieta).join('; ')}.` });

  const odplatna = sym.operacje.some((op) => typy.odplatna(op));
  if (odplatna && !['tak', 'nie'].includes(sprawa.oplata)) {
    bledy.push({ pole: 'oplata', komunikat: 'Wybierz: opłata 100 zł netto albo bez opłaty.' });
  }
  if (!odplatna && sprawa.oplata === 'tak') bledy.push({ pole: 'oplata', komunikat: 'Ta sprawa nie podlega opłacie.' });

  for (const id of doPowiadomienia(sprawa, sym).wszystkie) {
    if (maZgode(sprawa, id) || pisma.powiadomienieWyslane(db, sprawa.id, id)) continue;
    const o = daneOsoby.wczytaj(db, id);
    bledy.push({ pole: 'osoby', komunikat: `Brak wysłanego powiadomienia o zamierzonym wpisie albo zgody na wpis: ${o ? o.nazwa : `osoba #${id}`}.` });
  }
  return bledy;
}

/** Adresat pism sprawy (powiadomienie o wpisie, o odmowie, wezwanie) — żądający. */
function adresatZadajacy(sprawa) {
  if (sprawa.zadajacy === 'osoba') return { adresat: 'osoba', adresat_osoba_id: sprawa.zadajacy_osoba_id };
  if (sprawa.zadajacy === 'spolka') return { adresat: 'spolka' };
  if (sprawa.zadajacy === 'organ') return { adresat: 'organ', adresat_opis: sprawa.zadajacy_opis };
  return null;
}

/**
 * Wpis sprawy (R1). Wołana wyłącznie przez `sprawy.zmienStan` w jego transakcji — sama nie zmienia
 * stanu sprawy. Zwraca zapisane wpisy.
 */
function wpisz(db, sprawa, kto) {
  const chwila = czas.terazUtc();
  const sym = symuluj(db, sprawa, chwila);
  const bledy = [...sym.bledy];
  if (bledy.length === 0) bledy.push(...wymaganiaWpisu(db, sprawa, sym));
  if (bledy.length > 0) throw new BladWalidacji(bledy);

  const zapisane = sym.operacje.map((op) => {
    const t = trescWpisu(op);
    return daneRejestr.dopiszZdarzenie(db, {
      spolkaId: sprawa.spolka_id,
      typ: t.typ,
      chwila,
      autor: kto,
      sprawaId: sprawa.id,
      dane: t.dane,
      zdarzenieProstowaneId: t.zdarzenieProstowaneId,
      uzasadnienie: t.typ === 'sprostowanie' ? sprawa.podstawa || null : null,
    });
  });

  const po = stanSpolki(db, sprawa.spolka_id);
  const bilans = stanLogika.sprawdzBilans(po);
  if (bilans.length > 0) throw new BladWalidacji(bilans);
  daneRejestr.zapiszMaterializacje(db, sprawa.spolka_id, po);

  if (sprawa.oplata === 'tak') {
    daneOplaty.dodaj(db, {
      spolka_id: sprawa.spolka_id,
      typ: 'wpis',
      platnik: sprawa.zadajacy === 'osoba' ? 'osoba' : 'spolka',
      platnik_osoba_id: sprawa.zadajacy === 'osoba' ? sprawa.zadajacy_osoba_id : null,
      sprawa_id: sprawa.id,
      kwota_netto_grosze: przepisy.STAWKI_GROSZE.WPIS,
      stawka_vat_procent: przepisy.STAWKA_VAT_PROCENT,
      autor: kto,
    });
  }

  // Niewysłane powiadomienia o zamierzonym wpisie nie są już potrzebne.
  pisma.usunNiewyslane(db, { sprawaId: sprawa.id, typ: 'powiadomienie_zamierzony' });
  // art. 300(34) § 7 KSH: o dokonanym wpisie — żądający i spółka.
  const dane = { stanPo: po, operacje: sym.operacje, chwila };
  const wspolne = { spolka_id: sprawa.spolka_id, sprawa_id: sprawa.id, dane, autor: kto };
  pisma.utworz(db, 'powiadomienie_wpis', { ...wspolne, adresat: 'spolka' });
  const zadajacy = adresatZadajacy(sprawa);
  if (zadajacy && zadajacy.adresat !== 'spolka') pisma.utworz(db, 'powiadomienie_wpis', { ...wspolne, ...zadajacy });
  return zapisane;
}

/** Wpisy z opisem zdaniem (jak w powiadomieniu o wpisie) i podstawą ze sprawy — historia w rejestrze spółki. */
function opisaneWpisy(db, spolkaId, wpisy) {
  const zdarzenia = new Map(daneRejestr.zdarzeniaSpolki(db, spolkaId).map((z) => [Number(z.id), z]));
  return wpisy.map((w) => {
    const z = zdarzenia.get(Number(w.id));
    const op = z ? { typ: z.typ, ...z.dane, ...(z.typ === 'sprostowanie' ? { zdarzenie_id: z.zdarzenie_prostowane_id } : {}) } : null;
    const sprawa = w.sprawa_id ? daneSprawy.wczytaj(db, w.sprawa_id) : null;
    return { ...w, opis: op ? pisma.opisOperacji(db, op) : null, podstawa: sprawa ? sprawa.podstawa || null : null };
  });
}

/** U-20: kontrola integralności całego łańcucha — na żądanie. */
function zweryfikujIntegralnosc(db) {
  return lancuch.zweryfikuj(daneRejestr.wszystkieZdarzenia(db));
}

module.exports = { stanSpolki, symuluj, doPowiadomienia, maZgode, wymaganiaWpisu, adresatZadajacy, wpisz, opisaneWpisy, zweryfikujIntegralnosc };
