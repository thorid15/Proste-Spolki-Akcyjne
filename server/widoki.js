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
const u = require('./logika/ulamki');
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
 * D-R01 - jedna semantyka: stan rejestru to wynik zdarzen WPISANYCH do
 * wskazanej chwili (art. 300(37) § 1 i art. 300(38) § 1 KSH). Dzien D =
 * koniec dnia D (23:59:59 czasu kancelarii), a dla dnia biezacego - chwila
 * sporzadzenia. Wpis dokonany pozniej (takze sprostowanie) nie zmienia
 * stanu na dzien wczesniejszy, wiec informacja na dzien D jest zawsze taka
 * sama, niezaleznie od tego, kiedy ja wygenerowano.
 */
function widokStanu(db, spolkaId, data, opcje = {}) {
  const rola = opcje.rola || ROLE.KANCELARIA;
  const odbiorcaOsobaId = opcje.odbiorcaOsobaId ?? null;
  const surowaData = String(data || czas.dzisIso());
  const dzisiaj = czas.dzisIso();
  const biezacy = surowaData === dzisiaj || !data;
  const chwilaStanu = biezacy
    ? czas.terazUtc()
    : czas.poprawnaData(surowaData)
      ? czas.koniecDniaUtc(surowaData)
      : czas.chwilaUtc(surowaData);
  const dzien = czas.dzienLokalny(chwilaStanu);

  const spolka = rejestr.wczytajSpolke(db, spolkaId);
  if (!spolka) return null;

  const wszystkieZdarzenia = rejestr.wczytajZdarzenia(db, spolkaId);
  const stan = stanLogika.odtworzStan(
    wszystkieZdarzenia.filter((z) => String(z.data_wpisu) <= chwilaStanu)
  );
  const dzienDoFiltrow = null; // stan juz ograniczony do wpisow sprzed chwili - bez drugiego filtra
  const osoby = rejestr.wczytajOsobySpolki(db, spolkaId);
  // D-050/B12, D-R01 - moment WPISU przy pozycji akcjonariusza
  // (`data_wpisu`, systemowa, UTC co do sekundy).
  const dataWpisuZdarzenia = new Map(wszystkieZdarzenia.map((z) => [z.id, z.data_wpisu]));

  const akcjonariat = stanLogika.akcjonariatNaDzien(stan, dzienDoFiltrow);
  const bilans = stanLogika.bilansNaDzien(stan, dzienDoFiltrow);
  const obciazenia = stanLogika.obciazeniaNaDzien(stan, dzienDoFiltrow);

  const emisjeWgKlucza = new Map(stan.emisje.map((e) => [e.klucz, e]));

  return {
    data: dzien,
    // D-R07: dla dnia biezacego informacja podaje takze godzine stanu.
    chwila_stanu: chwilaStanu,
    stan_biezacy: biezacy,
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
      // art. 300(33) § 1 pkt 3 KSH - data wpisu emisji do KRS.
      data_wpisu_krs: e.data_wpisu_krs,
      // art. 300(33) § 1 pkt 4 KSH - rodzaj akcji.
      rodzaj_akcji: e.rodzaj_akcji,
      // art. 300(33) § 1 pkt 11 KSH - obowiazki wobec spolki zwiazane z akcja.
      obowiazki_wobec_spolki: e.obowiazki_wobec_spolki,
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
      // Ulamek dokladny (Z-057) - do formatowania "X i N/D" zamiast lossy
      // decimala, gdy pozycja obejmuje ulamkowo wspoluprawniony numer.
      udzial_ulamek: p.udzial_ulamek,
      // D-R06: liczby glosow nie pokazujemy nigdzie - wyjatek to uchwala o
      // wyborze notariusza (wzor 03), ktora prosi o nie jawnie (`zGlosami`).
      ...(opcje.zGlosami ? { glosy: p.glosy } : {}),
      wymaga_przedstawiciela: p.wymaga_przedstawiciela,
      // D-R03: zakresy numerow z data wpisu kazdego z nich.
      grupy_wpisu: p.grupy_wpisu.map((g) => ({
        data_wpisu: g.dzien_wpisu,
        zakresy: g.zakresy,
        numery: n.opisz(g.zakresy),
      })),
      zakresy: p.zakresy,
      numery: n.opisz(p.zakresy),
      procent: p.procent,
      // Pozycje ulamkowe per numer akcji - raport zapisuje je wprost
      // („1/3 akcji nr 96"), bo na wydruku dla sadu skrot bylby nieczytelny.
      czesci_ulamkowe: p.czesci_ulamkowe || [],
      data_nabycia: p.data_najstarszego_nabycia,
      // D-050/B12 - moment systemowego wpisu (co do sekundy), nie data
      // prawna zdarzenia wyzej - `null`, gdy zdarzenie zrodlowe jest starsze
      // niz kolumna `data_wpisu` (patrz raport FAZY 2, sekcja B12).
      wpisano_do_rejestru: dataWpisuZdarzenia.get(p.zdarzenie_najstarszego_nabycia_id) ?? null,
      // art. 300(33) § 1 pkt 9 KSH - wzmianka o pokryciu akcji.
      pokryta: p.pokryta,
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

    // D-R06: wiersz „Łącznie” dla osoby z więcej niż jedną serią.
    akcjonariusze_lacznie: lacznieNaOsobe(akcjonariat.pozycje),

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

/**
 * Sumy na osobe przez wszystkie serie - tylko dla osob z kilkoma seriami.
 * Udzial sumujemy na ulamkach (regula domenowa 4a), procent z tych samych
 * wartosci, co w wierszach.
 */
function lacznieNaOsobe(pozycje) {
  const wynik = new Map();
  for (const p of pozycje) {
    const w = wynik.get(p.osoba_id) || {
      osoba_id: p.osoba_id,
      serie: [],
      udzial_ulamek: { licznik: 0, mianownik: 1 },
      procent: 0,
    };
    w.serie.push(p.seria);
    w.udzial_ulamek = u.suma(w.udzial_ulamek, p.udzial_ulamek || { licznik: p.ilosc, mianownik: 1 });
    w.procent += p.procent;
    wynik.set(p.osoba_id, w);
  }
  return [...wynik.values()]
    .filter((w) => w.serie.length > 1)
    .map((w) => ({ ...w, ilosc: w.udzial_ulamek.licznik / w.udzial_ulamek.mianownik }));
}

/** Historia zdarzen spolki - os czasu w kokpicie. */
function widokZdarzen(db, spolkaId, { limit = null } = {}) {
  const zdarzenia = rejestr.wczytajZdarzenia(db, spolkaId);
  const osoby = rejestr.wczytajOsobySpolki(db, spolkaId);

  // Etap 5.1: link DWUKIERUNKOWY - sprostowanie juz zna zdarzenie_prostowane_id
  // (wskazuje wstecz), ale zdarzenie prostowane samo nie wie, ze zostalo
  // sprostowane. Budujemy mape "prostowane -> prostujace" z tej samej listy
  // (bez dodatkowego zapytania), zeby oznaczyc oryginal wizualnie.
  const sprostowanePrzez = new Map();
  for (const z of zdarzenia) {
    if (z.typ === 'sprostowanie' && z.zdarzenie_prostowane_id != null) {
      sprostowanePrzez.set(Number(z.zdarzenie_prostowane_id), z.id);
    }
  }

  const lista = [...zdarzenia].sort(
    (a, b) => -stanLogika.porownajZdarzenia(a, b)
  );
  const wycinek = limit ? lista.slice(0, limit) : lista;

  return wycinek.map((z) => ({
    id: z.id,
    typ: z.typ,
    data_wpisu: z.data_wpisu,
    autor: z.autor,
    uzasadnienie: z.uzasadnienie,
    zdarzenie_prostowane_id: z.zdarzenie_prostowane_id,
    sprostowane_przez_id: sprostowanePrzez.get(Number(z.id)) ?? null,
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
