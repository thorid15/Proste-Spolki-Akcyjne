'use strict';

/**
 * Widoki rejestru - jedno miejsce, w ktorym stan domenowy zamienia sie
 * w strukture dla UI i wydrukow, z ZASTOSOWANYM maskowaniem.
 *
 * Regula domenowa nr 9: dane wrazliwe maskujemy w KAZDYM widoku i dokumencie
 * kierowanym do innego akcjonariusza. Maskowanie zyje tutaj, a nie w
 * komponentach - dzieki temu nie da sie go przypadkiem pominac w nowym widoku.
 */

const stanLogika = require('./logika/stan');
const maskowanie = require('./logika/maskowanie');
const przepisy = require('./logika/przepisy');
const rejestr = require('./rejestr');
const n = require('./logika/numery');
const czas = require('./pomocnicze/czas');

const ROLE = przepisy.ROLE_ODBIORCY;

/** Pola spolki, ktore NIGDY nie wychodza poza kancelarie (sekcja 10). */
function spolkaDlaRoli(spolka, rola) {
  if (rola === ROLE.KANCELARIA) return spolka;
  const { uwagi, ...reszta } = spolka;
  return reszta;
}

function osobaDlaRoli(osoba, rola, odbiorcaOsobaId) {
  const zamaskowana = maskowanie.zamaskujOsobe(osoba, rola, odbiorcaOsobaId);
  if (!zamaskowana) return null;
  return {
    ...zamaskowana,
    oznaczenie: maskowanie.oznaczenieOsoby(osoba),
    jawny_identyfikator: maskowanie.jawnyIdentyfikator(osoba),
  };
}

/**
 * Pelny widok rejestru spolki na wskazany dzien albo chwile.
 *
 * @param {string} data  `RRRR-MM-DD` (koniec dnia, zachowanie sprzed sprintu 6)
 *                       ALBO `RRRR-MM-DDTGG:MM[:SS]` (dokladnosc do minuty -
 *                       sekcja 2.3 SESJA-PSA-5-INTERFEJS.md, JEDYNA dozwolona
 *                       zmiana poza warstwa prezentacji w tamtej sesji).
 *                       Domyslnie dzisiaj (data-only).
 * @param {string} rola  `przepisy.ROLE_ODBIORCY`; domyslnie kancelaria
 *
 * Dwie odrebne semantyki, bo mieszaja dwa rozne pojecia czasu w rejestrze
 * (regula domenowa 6): format daty porownuje po `data_zdarzenia` (kiedy
 * czynnosc prawnie zaszla - pozwala np. na wpis z data historyczna wczesniej
 * niz dzisiaj). Format z godzina porownuje po `data_wpisu` (kiedy WPIS trafil
 * do rejestru) - odroznia dwa wpisy z tego samego dnia po kolejnosci
 * rzeczywistego wprowadzenia, nie po deklarowanej dacie zdarzenia.
 */
function widokStanu(db, spolkaId, data, opcje = {}) {
  const rola = opcje.rola || ROLE.KANCELARIA;
  const odbiorcaOsobaId = opcje.odbiorcaOsobaId ?? null;
  const surowaData = String(data || czas.dzisIso());
  const zChwila = surowaData.includes('T');
  const dzien = surowaData.slice(0, 10);

  const spolka = rejestr.wczytajSpolke(db, spolkaId);
  if (!spolka) return null;

  const wszystkieZdarzenia = rejestr.wczytajZdarzenia(db, spolkaId);
  let stan;
  let dzienDoFiltrow;
  if (zChwila) {
    const chwila = new Date(surowaData).getTime();
    const doChwili = wszystkieZdarzenia.filter((z) => new Date(z.data_wpisu).getTime() <= chwila);
    stan = stanLogika.odtworzStan(doChwili);
    dzienDoFiltrow = null; // stan juz ograniczony do wpisow sprzed `chwila` - bez drugiego filtra po dacie
  } else {
    stan = stanLogika.odtworzStan(wszystkieZdarzenia);
    dzienDoFiltrow = dzien;
  }
  const osoby = rejestr.wczytajOsobySpolki(db, spolkaId);

  const akcjonariat = stanLogika.akcjonariatNaDzien(stan, dzienDoFiltrow);
  const bilans = stanLogika.bilansNaDzien(stan, dzienDoFiltrow);
  const obciazenia = stanLogika.obciazeniaNaDzien(stan, dzienDoFiltrow);

  const emisjeWgKlucza = new Map(stan.emisje.map((e) => [e.klucz, e]));

  return {
    data: dzien,
    rola,
    spolka: spolkaDlaRoli(spolka, rola),

    emisje: stan.emisje.map((e) => ({
      klucz: e.klucz,
      seria: e.seria,
      tytul: e.tytul,
      podstawa_prawna: e.podstawa_prawna,
      nr_pierwszy: e.nr_pierwszy,
      ilosc: e.ilosc,
      zakres: n.opisz(n.zakresEmisji(e)),
      cena_emisyjna_grosze: e.cena_emisyjna_grosze,
      waluta: e.waluta,
      data_emisji: e.data_emisji,
      status: e.status,
      opis: e.opis,
      ...(rola === ROLE.KANCELARIA ? { uwagi: e.uwagi } : {}),
    })),

    bilans,

    akcjonariusze: akcjonariat.pozycje.map((p) => ({
      osoba: osobaDlaRoli(osoby.get(p.osoba_id), rola, odbiorcaOsobaId),
      osoba_id: p.osoba_id,
      seria: p.seria,
      emisja_klucz: p.emisja_klucz,
      ilosc: p.ilosc,
      zakresy: p.zakresy,
      numery: n.opisz(p.zakresy),
      procent: p.procent,
      data_nabycia: p.data_najstarszego_nabycia,
      obciazenia: p.obciazenia.map((o) => ({
        typ: o.typ,
        numery: n.opisz(o.zakresy),
        prawo_glosu: o.prawo_glosu,
        blokuje_rozporzadzanie: o.blokuje_rozporzadzanie,
        uprawniony: osobaDlaRoli(osoby.get(o.osoba_id), rola, odbiorcaOsobaId),
        opis: o.opis,
      })),
    })),

    razem_akcji: akcjonariat.razem_akcji,

    obciazenia: obciazenia.map((o) => ({
      klucz: o.klucz,
      typ: o.typ,
      seria: emisjeWgKlucza.get(o.emisja_klucz)?.seria ?? null,
      numery: n.opisz(o.zakresy),
      ilosc: n.ilosc(o.zakresy),
      uprawniony: osobaDlaRoli(osoby.get(o.osoba_id), rola, odbiorcaOsobaId),
      akcjonariusz: osobaDlaRoli(osoby.get(o.akcjonariusz_osoba_id), rola, odbiorcaOsobaId),
      prawo_glosu: o.prawo_glosu,
      blokuje_rozporzadzanie: o.blokuje_rozporzadzanie,
      opis: o.opis,
      data_od: o.data_od,
    })),

    uprawnienia: stan.uprawnienia
      .filter((u) => u.status === 'aktywne')
      .map((u) => ({
        klucz: u.klucz,
        rodzaj: u.rodzaj,
        zakres: u.zakres,
        seria: u.emisja_klucz == null ? null : emisjeWgKlucza.get(u.emisja_klucz)?.seria ?? null,
        osoba: osobaDlaRoli(osoby.get(u.osoba_id), rola, odbiorcaOsobaId),
        tytul: u.tytul,
        tresc: u.tresc,
        data_ustanowienia: u.data_ustanowienia,
      })),

    ograniczenia: stan.ograniczenia
      .filter((o) => o.status === 'aktywne')
      .map((o) => ({
        klucz: o.klucz,
        zakres: o.zakres,
        seria: o.emisja_klucz == null ? null : emisjeWgKlucza.get(o.emisja_klucz)?.seria ?? null,
        numery: o.zakresy && o.zakresy.length ? n.opisz(o.zakresy) : null,
        wymaga_zgody_spolki: o.wymaga_zgody_spolki,
        prawo_pierwszenstwa: o.prawo_pierwszenstwa,
        opis: o.opis,
      })),

    niezgodnosci: stanLogika.sprawdzBilans(stan),
  };
}

/** Historia zdarzen spolki - os czasu w kokpicie. */
function widokZdarzen(db, spolkaId, { limit = null } = {}) {
  const zdarzenia = rejestr.wczytajZdarzenia(db, spolkaId);
  const osoby = rejestr.wczytajOsobySpolki(db, spolkaId);

  const lista = [...zdarzenia].sort(
    (a, b) => -stanLogika.porownajZdarzenia(a, b)
  );
  const wycinek = limit ? lista.slice(0, limit) : lista;

  return wycinek.map((z) => ({
    id: z.id,
    typ: z.typ,
    data_zdarzenia: z.data_zdarzenia,
    data_wpisu: z.data_wpisu,
    autor: z.autor,
    uzasadnienie: z.uzasadnienie,
    zdarzenie_prostowane_id: z.zdarzenie_prostowane_id,
    dane: z.dane,
    // Skrot pokazujemy w calosci tylko na zadanie - w tabeli wystarczy
    // pierwszych 12 znakow jako znacznik ciaglosci.
    hash_skrocony: String(z.hash).slice(0, 12),
    podsumowanie: podsumujZdarzenie(z, osoby),
  }));
}

/** Jednozdaniowy opis zdarzenia dla osi czasu. */
function podsumujZdarzenie(z, osoby) {
  const d = z.dane || {};
  const nazwa = (id) => {
    const o = osoby.get(Number(id));
    return o ? maskowanie.oznaczenieOsoby(o) : `osoba #${id}`;
  };
  const suma = (poz) => (poz || []).reduce((s, p) => s + Number(p.ilosc || 0), 0);

  switch (z.typ) {
    case 'emisja':
      return `Emisja serii ${d.seria}: ${d.ilosc} akcji (numery ${d.nr_pierwszy}–${
        Number(d.nr_pierwszy) + Number(d.ilosc) - 1
      }).`;
    case 'objecie':
      return `Objęcie ${suma(d.pozycje)} akcji serii ${d.seria} przez ${(d.pozycje || [])
        .map((p) => `${nazwa(p.osoba_id)} (${p.ilosc})`)
        .join(', ')}.`;
    case 'przeniesienie':
      return `Przeniesienie ${suma(d.pozycje)} akcji serii ${d.seria} — ${nazwa(
        d.zbywca_osoba_id
      )} → ${(d.pozycje || []).map((p) => `${nazwa(p.nabywca_osoba_id)} (${p.ilosc})`).join(', ')}${
        d.tytul_prawny ? `; tytuł: ${d.tytul_prawny}` : ''
      }.`;
    case 'umorzenie':
      return `Umorzenie ${suma(d.pozycje)} akcji serii ${d.seria}${
        d.tryb ? ` (${d.tryb})` : ''
      }.`;
    case 'zmiana_danych_spolki':
      return `Zmiana danych spółki: ${(d.zmienione_pola || []).join(', ') || 'bez wskazania pól'}.`;
    case 'obciazenie':
      return `Ustanowienie ${d.typ_obciazenia === 'uzytkowanie' ? 'użytkowania' : 'zastawu'} na ${
        d.ilosc
      } akcjach serii ${d.seria} (numery ${n.opisz(d.zakresy)}) na rzecz ${nazwa(d.osoba_id)}.`;
    case 'wykreslenie_obciazenia':
      return `Wykreślenie ${d.typ_obciazenia === 'uzytkowanie' ? 'użytkowania' : 'zastawu'} na akcjach ${
        d.numery || n.opisz(d.zakresy)
      } serii ${d.seria}.`;
    case 'prawo_glosu_zastawnika':
      return `${d.prawo_glosu ? 'Wpis' : 'Wykreślenie'} prawa głosu ${
        d.typ_obciazenia === 'uzytkowanie' ? 'użytkownika' : 'zastawnika'
      } ${nazwa(d.osoba_id)}.`;
    case 'zajecie':
      return `Zajęcie ${d.ilosc} akcji serii ${d.seria} (numery ${n.opisz(d.zakresy)})${
        d.akcjonariusz_osoba_id != null ? ` należących do ${nazwa(d.akcjonariusz_osoba_id)}` : ''
      }.`;
    case 'wykreslenie_zajecia':
      return `Uchylenie zajęcia akcji ${d.numery || n.opisz(d.zakresy)} serii ${d.seria}.`;
    case 'uprawnienie':
      return d.wykresla_zdarzenie_id != null
        ? `Wykreślenie uprawnienia „${d.tytul || ''}” (zdarzenie #${d.wykresla_zdarzenie_id}).`
        : `Ustanowienie ${d.rodzaj === 'przywilej' ? 'przywileju' : d.rodzaj === 'obowiazek' ? 'obowiązku' : 'uprawnienia'}${
            d.tytul ? ` „${d.tytul}”` : ''
          }${d.osoba_id != null ? ` na rzecz ${nazwa(d.osoba_id)}` : d.seria ? ` dla serii ${d.seria}` : ''}.`;
    case 'ograniczenie':
      return d.wykresla_zdarzenie_id != null
        ? `Wykreślenie ograniczenia w rozporządzaniu akcjami (zdarzenie #${d.wykresla_zdarzenie_id}).`
        : `Ustanowienie ograniczenia w rozporządzaniu akcjami${d.seria ? ` serii ${d.seria}` : ''}${
            d.opis ? `: ${d.opis}` : ''
          }.`;
    case 'zmiana_danych_akcjonariusza':
      return `Zmiana danych akcjonariusza ${nazwa(d.osoba_id)}: ${
        (d.zmienione_pola || []).join(', ') || 'bez wskazania pól'
      }.`;
    case 'zobowiazanie':
      return `Oświadczenie ${nazwa(d.akcjonariusz_osoba_id)} o zobowiązaniu do ${d.rodzaj || 'przeniesienia'} akcji${
        d.seria ? ` serii ${d.seria}` : ''
      }.`;
    case 'zdarzenie_inne':
      return d.opis || 'Inne zdarzenie.';
    case 'sprostowanie':
      return `Sprostowanie zdarzenia #${z.zdarzenie_prostowane_id}${
        d.zamiast ? ` (skorygowana treść typu „${d.zamiast.typ}”)` : ''
      }.`;
    default:
      return null;
  }
}

module.exports = { widokStanu, widokZdarzen, podsumujZdarzenie, ROLE };
