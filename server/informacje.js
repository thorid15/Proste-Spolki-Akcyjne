'use strict';

/**
 * Informacja z rejestru akcjonariuszy — jedna droga wydania (§ 4, U-24, U-27).
 *
 * Treść: wyłącznie dane z art. 300³³ § 1 KSH, PESEL albo data urodzenia, numer informacji
 * i „stan na” dzień. Odbiorca i sygnatura organu zapisują się tylko w `psa_pisma`. Akcjonariusz
 * dostaje wersję bez danych pozostałych akcjonariuszy z art. 300³⁵ § 1¹ (maskowanie białą listą).
 */

const czas = require('./pomocnicze/czas');
const rejestr = require('./rejestr');
const pisma = require('./logika/pisma');
const przepisy = require('./logika/przepisy');
const maskowanie = require('./logika/maskowanie');
const stanLogika = require('./logika/stan');
const n = require('./logika/numery');
const terminy = require('./logika/terminy');
const dziennik = require('./logika/dziennik-dostepu');
const daneSpolki = require('./dane/spolki');
const daneOsoby = require('./dane/osoby');
const daneOplaty = require('./dane/oplaty');
const { BladWalidacji } = require('./logika/walidacje');

const { dataPl } = pisma;
const ROLA = { spolka: przepisy.ROLE_ODBIORCY.SPOLKA, organ: przepisy.ROLE_ODBIORCY.ORGAN, osoba: przepisy.ROLE_ODBIORCY.AKCJONARIUSZ };

const TRESC_ATRYBUTU = {
  zastaw: () => 'zastaw',
  uzytkowanie: () => 'użytkowanie',
  zajecie: (a) => `zajęcie${a.tresc ? `: ${a.tresc}` : ''}`,
  ograniczenie: (a) => `ograniczenie rozporządzania: ${a.tresc}`,
  obowiazek: (a) => `obowiązek wobec spółki: ${a.tresc}`,
  inna: (a) => a.tresc,
};

function rodzajSerii(e, atrybuty) {
  const upr = atrybuty.filter((a) => a.rodzaj === 'uprawnienie' && a.seria === e.seria);
  if (upr.length === 0) return 'zwykłe';
  const wszystkie = n.ilosc(n.normalizuj(upr.flatMap((a) => a.zakresy))) >= e.liczba - n.ilosc(e.umorzone);
  return upr.map((a) => `uprzywilejowane nr ${n.opisz(a.zakresy)}: ${a.tresc}`).join('; ') + (wszystkie ? '' : '; pozostałe zwykłe');
}

/** Pola wzoru `informacja` — stan rejestru na koniec dnia, dane osób według odbiorcy. */
function tresc(db, stan, dzien, rola, odbiorcaOsobaId) {
  const w = stanLogika.widok(stan, dzien);
  const nazwa = (id) => (daneOsoby.wczytaj(db, id) || {}).nazwa || '';
  const umorzone = w.serie.filter((e) => e.umorzone.length > 0);
  return {
    stan_na: dataPl(dzien),
    serie: w.serie.map((e) => ({
      seria: e.seria,
      numery: n.opisz(e.zakresy),
      liczba: String(e.liczba),
      rodzaj: rodzajSerii(e, w.atrybuty),
      data_emisji: dataPl(e.data_wpisu_krs),
    })),
    umorzone: umorzone.map((e, i) => ({ seria: e.seria, numery: n.opisz(e.umorzone), dalej: i < umorzone.length - 1 })),
    akcjonariusze: w.akcjonariusze.map((p) => ({
      opis: maskowanie.opisOsoby(daneOsoby.wczytaj(db, p.osoba_id), rola, odbiorcaOsobaId),
      seria: p.seria,
      numery: n.opisz(p.zakresy),
      liczba: p.czesc ? `${p.czesc.licznik}/${p.czesc.mianownik}` : String(p.liczba),
      data_wpisu: dataPl(p.data_wpisu),
      pokryte: p.pokryte ? 'tak' : 'nie',
    })),
    obciazenia: w.atrybuty
      .filter((a) => TRESC_ATRYBUTU[a.rodzaj])
      .map((a) => ({
        numery: `${a.seria} ${n.opisz(a.zakresy)}`,
        tresc: TRESC_ATRYBUTU[a.rodzaj](a),
        uprawniony: a.osoba_id ? nazwa(a.osoba_id) : '',
        prawo_glosu: a.rodzaj === 'zastaw' || a.rodzaj === 'uzytkowanie' ? (a.prawo_glosu ? 'tak' : 'nie') : '',
        data_wpisu: dataPl(a.data_wpisu),
      })),
  };
}

/**
 * Wydaje informację z rejestru. `odbiorca`: { rodzaj: 'spolka' | 'osoba' | 'organ', osobaId, opis }.
 * U-24: w portalu stan na koniec wybranego dnia — domyślnie i najpóźniej wczoraj, najwcześniej dzień
 * otwarcia; pracownik — dowolny dzień od otwarcia, także dziś. U-02: pracownik wybiera 50 zł albo bez
 * opłaty (organ — zawsze bez); w portalu informacja jest płatna z góry.
 */
function wydajInformacje(db, { spolkaId, odbiorca = {}, dzien = null, sygnatura = null, oplata = null, zrodlo = 'kancelaria', kto }) {
  return db.transaction(() => {
    const spolka = daneSpolki.wczytaj(db, spolkaId);
    if (!spolka) throw new BladWalidacji(['Nie odnaleziono spółki.']);
    const portal = zrodlo === 'portal';
    const bledy = [];
    const dzis = czas.dzisIso();
    const otwarcie = czas.dzienLokalny(spolka.data_otwarcia);
    const najpozniej = portal ? terminy.dodajDni(dzis, -1) : dzis;
    const d = dzien || najpozniej;
    if (!otwarcie) bledy.push({ pole: 'dzien', komunikat: 'Rejestr spółki nie jest otwarty.' });
    else if (najpozniej < otwarcie) bledy.push({ pole: 'dzien', komunikat: `Dostępna od ${dataPl(terminy.dodajDni(otwarcie, 1))}.` });
    else if (!czas.poprawnaData(d) || d < otwarcie || d > najpozniej) {
      bledy.push({ pole: 'dzien', komunikat: `Wybierz dzień od ${dataPl(otwarcie)} do ${portal ? dataPl(najpozniej) : 'dziś'}.` });
    }

    const rodzaj = odbiorca.rodzaj;
    if (!ROLA[rodzaj]) bledy.push({ pole: 'odbiorca', komunikat: 'Wybierz odbiorcę: spółka, akcjonariusz albo organ.' });
    if (rodzaj === 'osoba' && !daneOsoby.wczytaj(db, odbiorca.osobaId)) bledy.push({ pole: 'odbiorca', komunikat: 'Wybierz osobę z kartoteki.' });
    if (rodzaj === 'organ') {
      if (!String(odbiorca.opis || '').trim()) bledy.push({ pole: 'odbiorca', komunikat: 'Podaj nazwę organu.' });
      if (!String(sygnatura || '').trim()) bledy.push({ pole: 'sygnatura', komunikat: 'Podaj sygnaturę postępowania.' });
    }
    if (!portal && rodzaj !== 'organ' && !['tak', 'nie'].includes(oplata)) {
      bledy.push({ pole: 'oplata', komunikat: 'Wybierz: opłata 50 zł netto albo bez opłaty.' });
    }
    if (bledy.length > 0) throw new BladWalidacji(bledy);

    const osobaId = rodzaj === 'osoba' ? Number(odbiorca.osobaId) : null;
    const stan = rejestr.stanSpolki(db, spolkaId, d);
    const adresat =
      rodzaj === 'osoba'
        ? { adresat: 'osoba', adresat_osoba_id: osobaId }
        : rodzaj === 'organ'
          ? { adresat: 'organ', adresat_opis: String(odbiorca.opis).trim() }
          : { adresat: 'spolka' };
    const pismoId = pisma.utworz(db, 'informacja', {
      spolka_id: spolkaId,
      ...adresat,
      sygnatura: rodzaj === 'organ' ? String(sygnatura).trim() : null,
      kanal: portal ? 'portal' : undefined,
      kontekst: tresc(db, stan, d, ROLA[rodzaj], osobaId),
      autor: kto,
    });
    if (portal || (rodzaj !== 'organ' && oplata === 'tak')) {
      daneOplaty.dodaj(db, {
        spolka_id: spolkaId,
        typ: 'informacja',
        platnik: osobaId ? 'osoba' : 'spolka',
        platnik_osoba_id: osobaId,
        pismo_id: pismoId,
        kwota_netto_grosze: przepisy.STAWKI_GROSZE.INFORMACJA,
        stawka_vat_procent: przepisy.STAWKA_VAT_PROCENT,
        autor: kto,
      });
    }
    const { numer } = pisma.wczytaj(db, pismoId);
    dziennik.zapisz(db, {
      kto,
      typKto: portal ? 'portal' : 'pracownik',
      spolkaId,
      osobaId,
      akcja: dziennik.AKCJE.INFORMACJA_Z_REJESTRU,
      opis: `${numer}, stan na ${dataPl(d)}`,
    });
    return { pismoId, numer };
  })();
}

module.exports = { wydajInformacje };
