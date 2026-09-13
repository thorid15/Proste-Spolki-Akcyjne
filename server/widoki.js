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
      zakresy: p.zakresy,
      numery: n.opisz(p.zakresy),
      procent: p.procent,
      // Pozycje ulamkowe per numer akcji - raport zapisuje je wprost
      // („1/3 akcji nr 96"), bo na wydruku dla sadu skrot bylby nieczytelny.
      czesci_ulamkowe: p.czesci_ulamkowe || [],
      data_nabycia: p.data_najstarszego_nabycia,
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
 * Pełna historia przedziałów własnościowych spółki — dane dla osi akcji
 * (element sygnaturowy kokpitu, sesja SESJA-PSA-6-INTERFEJS.md, faza 2.4).
 *
 * W odróżnieniu od `widokStanu` (przekrój na jeden dzień/chwilę), ten widok
 * zwraca WSZYSTKIE przedziały i obciążenia — otwarte i zamknięte — z ich
 * datami `data_od`/`data_do` (`null` = wciąż otwarty), żeby wykres mógł
 * narysować pełną oś czasu jako poziome pasma. To czysto prezentacyjna
 * projekcja `stan.przedzialy`/`stan.obciazenia`, które `stanLogika` i tak
 * już liczy do wewnętrznego użytku (`przedzialyNaDzien` itd.) — zero nowej
 * logiki domenowej, zero zmian w `stan.js`.
 */
function widokOsiAkcji(db, spolkaId, opcje = {}) {
  const rola = opcje.rola || ROLE.KANCELARIA;
  const odbiorcaOsobaId = opcje.odbiorcaOsobaId ?? null;

  const spolka = rejestr.wczytajSpolke(db, spolkaId);
  if (!spolka) return null;

  const zdarzeniaSurowe = rejestr.wczytajZdarzenia(db, spolkaId);
  const stan = stanLogika.odtworzStan(zdarzeniaSurowe);
  const osoby = rejestr.wczytajOsobySpolki(db, spolkaId);

  const osobaSkrocona = (id) => (id == null ? null : osobaDlaRoli(osoby.get(Number(id)), rola, odbiorcaOsobaId));

  return {
    spolka: spolkaDlaRoli(spolka, rola),

    emisje: stan.emisje.map((e) => ({
      klucz: e.klucz,
      seria: e.seria,
      nr_pierwszy: e.nr_pierwszy,
      ilosc: e.ilosc,
      status: e.status,
    })),

    // Pasmo = jeden ciągły przedział numerów u jednego posiadacza (albo
    // nieobjęty/umorzony) między dwoma zdarzeniami. Ten sam akcjonariusz po
    // częściowym zbyciu to DWA pasma (zamknięte stare + otwarte nowe) —
    // stan.js rozbija je już przy zdejmowaniu z puli, tu tylko przepisujemy.
    pasma: stan.przedzialy.map((p) => ({
      emisja_klucz: p.emisja_klucz,
      kategoria: p.kategoria,
      osoba_id: p.osoba_id,
      osoba: osobaSkrocona(p.osoba_id),
      nr_od: p.nr_od,
      nr_do: p.nr_do,
      data_od: p.data_od,
      data_do: p.data_do,
      zdarzenie_od_id: p.zdarzenie_od_id,
      zdarzenie_do_id: p.zdarzenie_do_id,
      czesc_licznik: p.czesc_licznik,
      czesc_mianownik: p.czesc_mianownik,
      przedstawiciel_osoba_id: p.przedstawiciel_osoba_id,
      przedstawiciel: osobaSkrocona(p.przedstawiciel_osoba_id),
    })),

    obciazenia: stan.obciazenia.map((o) => ({
      klucz: o.klucz,
      typ: o.typ,
      emisja_klucz: o.emisja_klucz,
      zakresy: o.zakresy,
      osoba_id: o.osoba_id,
      uprawniony: osobaSkrocona(o.osoba_id),
      akcjonariusz_osoba_id: o.akcjonariusz_osoba_id,
      prawo_glosu: Boolean(o.prawo_glosu),
      blokuje_rozporzadzanie: Boolean(o.blokuje_rozporzadzanie),
      data_od: o.data_od,
      data_do: o.data_do,
      // Te same id, co przy pasmach — pozwalają wykresowi zmapować
      // obciążenie na tę samą oś ordynalną zdarzeń (zamiast po dacie,
      // która przy kilku wpisach tego samego dnia byłaby niejednoznaczna).
      zdarzenie_od_id: o.zdarzenie_ustanowienia_id,
      zdarzenie_do_id: o.zdarzenie_wykreslenia_id,
    })),

    // Rosnąco (najstarsze pierwsze) — to kolejność, w jakiej porusza się
    // playhead (2.5: tyle położeń, ile zdarzeń, zatrzaskiwanie na dacie).
    zdarzenia: [...zdarzeniaSurowe].sort(stanLogika.porownajZdarzenia).map((z) => ({
      id: z.id,
      typ: z.typ,
      data_zdarzenia: z.data_zdarzenia,
      data_wpisu: z.data_wpisu,
      podsumowanie: podsumujZdarzenie(z, osoby),
    })),
  };
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
    data_zdarzenia: z.data_zdarzenia,
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

module.exports = { widokStanu, widokZdarzen, widokOsiAkcji, podsumujZdarzenie, ROLE };
