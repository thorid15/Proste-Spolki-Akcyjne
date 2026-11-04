'use strict';

/**
 * Nowy przebieg wpisu zbycia akcji (R4 zad. 15, D-091) — czysta logika bez JSX
 * (kancelaria; test: `testy/wpis-zbycia-logika.test.js`).
 *
 * Kreator sterowany definicją typu (`definicjaWpisu`), żeby kolejne typy wpisów dało się dodać bez
 * nowego widoku. Logika wpisu i walidacje (art. 300(34), 300(40) KSH) zostają po stronie serwera —
 * tu tylko wartości domyślne, dobór numerów akcji i widoczność pól.
 *
 * Jeden wpis = jedno zdarzenie = jedna seria (serwer: `emisja_zdarzenie_id`), dlatego dobór działa
 * w ramach jednej serii; akcje innej serii zbywca wpisuje kolejną sprawą.
 */

function zakresyZbyciaNakladajaSie(a, b) {
  return (a || []).some((x) => (b || []).some((y) => x.nr_od <= y.nr_do && y.nr_od <= x.nr_do));
}

function kolejnoscEmisji(stan) {
  return new Map((stan.emisje || []).map((e, i) => [e.klucz, i]));
}

/** Zbywcy = akcjonariusze tej spółki (unikalni, łączna liczba akcji), w kolejności pierwszego wystąpienia. */
function zbywcyZRejestru(stan) {
  const mapa = new Map();
  for (const a of stan.akcjonariusze || []) {
    const z = mapa.get(a.osoba_id) || { osoba_id: a.osoba_id, osoba: a.osoba, oznaczenie: a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`, ilosc: 0 };
    z.ilosc += Number(a.ilosc) || 0;
    mapa.set(a.osoba_id, z);
  }
  return [...mapa.values()];
}

/** Zakresy → „1-10, 15” (format, który rozumie kreator i serwer). */
function zakresyNaTekst(zakresy) {
  return zakresy.map((z) => (z.nr_od === z.nr_do ? String(z.nr_od) : `${z.nr_od}-${z.nr_do}`)).join(', ');
}

/**
 * Dobór akcji zbywcy: seria wg kolejności emisji (albo wskazana), numery rosnąco; akcje obciążone
 * albo nie w pełni pokryte (także „brak informacji”) — na końcu. Wynik mówi, czy takie trafiły do doboru.
 */
function dobierzAkcje(stan, zbywcaId, ilosc, { emisjaKlucz = null } = {}) {
  const kolejnosc = kolejnoscEmisji(stan);
  const wiersze = (stan.akcjonariusze || []).filter((a) => Number(a.osoba_id) === Number(zbywcaId));
  const serie = [...new Set(wiersze.map((a) => a.emisja_klucz))].sort((x, y) => (kolejnosc.get(x) ?? 1e9) - (kolejnosc.get(y) ?? 1e9));
  const klucz = emisjaKlucz != null && serie.includes(emisjaKlucz) ? emisjaKlucz : serie[0];
  if (klucz == null) return null;

  const odcinki = [];
  for (const a of wiersze.filter((w) => w.emisja_klucz === klucz)) {
    const naKoniec = a.pokryta !== 'tak' || (a.obciazenia || []).length > 0;
    for (const z of a.zakresy || []) {
      odcinki.push({ nr_od: z.nr_od, nr_do: z.nr_do, naKoniec, obciazone: (a.obciazenia || []).length > 0, niepokryte: a.pokryta !== 'tak' });
    }
  }
  odcinki.sort((x, y) => (x.naKoniec - y.naKoniec) || (x.nr_od - y.nr_od));

  let zostalo = Math.max(0, Number(ilosc) || 0);
  const zakresy = [];
  let obciazone = false;
  let niepokryte = false;
  for (const o of odcinki) {
    if (zostalo <= 0) break;
    const ile = Math.min(zostalo, o.nr_do - o.nr_od + 1);
    zakresy.push({ nr_od: o.nr_od, nr_do: o.nr_od + ile - 1 });
    obciazone = obciazone || o.obciazone;
    niepokryte = niepokryte || o.niepokryte;
    zostalo -= ile;
  }
  const dostepne = odcinki.reduce((s, o) => s + (o.nr_do - o.nr_od + 1), 0);
  const emisja = (stan.emisje || []).find((e) => e.klucz === klucz) || {};
  return {
    emisja_klucz: klucz,
    seria: emisja.seria || (wiersze.find((w) => w.emisja_klucz === klucz) || {}).seria,
    zakresy,
    zakresyTekst: zakresyNaTekst(zakresy),
    dobrano: (Number(ilosc) || 0) - zostalo,
    dostepne,
    brakuje: zostalo,
    obciazone,
    niepokryte,
    inneSerie: serie.filter((s) => s !== klucz).map((s) => ((stan.emisje || []).find((e) => e.klucz === s) || {}).seria || String(s)),
  };
}

/** Aktywne ograniczenia rozporządzania, które dotyczą dobranych akcji (ta sama reguła co walidacja serwera). */
function ograniczeniaDlaDoboru(stan, dobor) {
  if (!dobor) return [];
  return (stan.ograniczenia || []).filter((o) => o.status === 'aktywne' && (
    o.zakres === 'wszystkie'
    || (o.zakres === 'emisja' && o.emisja_klucz === dobor.emisja_klucz)
    || (o.zakres === 'zakres_numerow' && o.emisja_klucz === dobor.emisja_klucz && zakresyZbyciaNakladajaSie(o.zakresy, dobor.zakresy))
  ));
}

const zawsze = () => true;

/**
 * Definicja wpisu — kroki i pola. `zrodlo`: reczne | kartoteka | rejestr | auto | domyslne.
 * `widoczneGdy(kontekst)` — kontekst: { stan, sprawa, dane, dobor }.
 */
const definicjaWpisu = {
  przeniesienie: {
    kroki: ['Co się zbywa', 'Podstawa', 'Sprawdzenie i wpis'],
    pola: [
      { klucz: 'zbywca_osoba_id', krok: 1, zrodlo: 'rejestr', wymagane: true, widoczneGdy: zawsze },
      { klucz: 'ilosc', krok: 1, zrodlo: 'reczne', wymagane: true, widoczneGdy: zawsze },
      { klucz: 'zakresy', krok: 1, zrodlo: 'auto', wymagane: false, widoczneGdy: zawsze, podstawa: 'numery dobiera aplikacja; ręcznie — wyjątkowo' },
      { klucz: 'nabywca_osoba_id', krok: 1, zrodlo: 'kartoteka', wymagane: true, widoczneGdy: zawsze },
      { klucz: 'dokument_data', krok: 2, zrodlo: 'reczne', wymagane: true, widoczneGdy: zawsze },
      { klucz: 'plik_umowy', krok: 2, zrodlo: 'reczne', wymagane: false, widoczneGdy: zawsze },
      { klucz: 'zadajacy_rola', krok: 2, zrodlo: 'domyslne', domyslna: 'nabywca', wymagane: true, widoczneGdy: zawsze, podstawa: 'art. 300(34) § 1 KSH' },
      { klucz: 'tytul_prawny', krok: 2, zrodlo: 'domyslne', domyslna: 'sprzedaż', wymagane: true, widoczneGdy: zawsze },
      { klucz: 'data_wplywu', krok: 2, zrodlo: 'auto', wymagane: true, widoczneGdy: () => false },
      { klucz: 'dokument_rodzaj', krok: 2, zrodlo: 'auto', domyslna: 'umowa_zbycia', wymagane: true, widoczneGdy: () => false },
      {
        klucz: 'zgoda_spolki', krok: 3, zrodlo: 'reczne', wymagane: false, podstawa: 'art. 300(34) § 6 KSH',
        widoczneGdy: ({ stan, dobor }) => ograniczeniaDlaDoboru(stan, dobor).some((o) => Boolean(Number(o.wymaga_zgody_spolki))),
      },
      {
        klucz: 'zgoda_spolki_niepelne_pokrycie', krok: 3, zrodlo: 'reczne', wymagane: false, podstawa: 'art. 300(40) § 1 KSH',
        widoczneGdy: ({ dobor }) => Boolean(dobor && dobor.niepokryte),
      },
      {
        klucz: 'pierwszenstwo_wyczerpane', krok: 3, zrodlo: 'reczne', wymagane: false,
        widoczneGdy: ({ stan, dobor }) => ograniczeniaDlaDoboru(stan, dobor).some((o) => Boolean(Number(o.prawo_pierwszenstwa))),
      },
      { klucz: 'dzialajacy_id', krok: 3, zrodlo: 'auto', wymagane: false, widoczneGdy: () => false, podstawa: 'domyślnie notariusz z ustawień' },
    ],
  },
};

/** Pole definicji widoczne w danym kontekście. */
function poleWidoczne(typ, klucz, kontekst) {
  const p = (definicjaWpisu[typ] || { pola: [] }).pola.find((x) => x.klucz === klucz);
  return Boolean(p && p.widoczneGdy(kontekst));
}

/**
 * Dane zdarzenia `przeniesienie` z formularza (przed `zbudujDaneZdarzenia`): jedna seria,
 * numery z doboru albo wpisane ręcznie, pola warunkowe tylko gdy widoczne.
 */
function daneZdarzenia(stan, formularz) {
  const dobor = dobierzAkcje(stan, formularz.zbywca_osoba_id, formularz.ilosc, { emisjaKlucz: formularz.emisja_klucz ?? null });
  const kontekst = { stan, dane: formularz, dobor };
  const zakresy = formularz.reczne_numery && String(formularz.zakresy_tekst || '').trim() ? formularz.zakresy_tekst : (dobor ? dobor.zakresyTekst : '');
  const flaga = (klucz) => (poleWidoczne('przeniesienie', klucz, kontekst) && formularz[klucz] ? 1 : 0);
  return {
    emisja_zdarzenie_id: dobor ? dobor.emisja_klucz : null,
    zbywca_osoba_id: formularz.zbywca_osoba_id,
    tytul_prawny: formularz.tytul_prawny || 'sprzedaż',
    pozycje: [{ nabywca_osoba_id: formularz.nabywca_osoba_id, ilosc: Number(formularz.ilosc), zakresy_tekst: zakresy }],
    zgoda_spolki: flaga('zgoda_spolki'),
    pierwszenstwo_wyczerpane: flaga('pierwszenstwo_wyczerpane'),
    zgoda_spolki_niepelne_pokrycie: flaga('zgoda_spolki_niepelne_pokrycie'),
  };
}

/**
 * D-104: domyślny adresat uprzedniego powiadomienia (art. 300(34) § 3 KSH) — osoba, której prawa wpis zmienia.
 * `dane` — dane kreatora wpisu; `stan` — widok spółki z `GET /api/psa/spolki/:id` (obciążenia). `null` = brak domyślnego.
 */
function odbiorcaPowiadomienia(typ, dane, stan = null) {
  const d = dane || {};
  switch (typ) {
    case 'przeniesienie':
    case 'przeniesienie_ulamka':
      return d.zbywca_osoba_id || null;
    case 'umorzenie':
      return (Array.isArray(d.pozycje) && d.pozycje[0] && d.pozycje[0].osoba_id) || null;
    case 'obciazenie':
    case 'zobowiazanie':
      return d.akcjonariusz_osoba_id || null;
    case 'prawo_glosu_zastawnika': {
      const o = ((stan && stan.obciazenia) || []).find((x) => Number(x.klucz) === Number(d.obciazenie_zdarzenie_id));
      return (o && ((o.akcjonariusz && o.akcjonariusz.id) || o.akcjonariusz_osoba_id)) || null;
    }
    default:
      return null;
  }
}

/** A-013: domyślny charakter żądającego (art. 300(34) § 1 KSH) wynika z typu wpisu; `''` — wpis z urzędu. */
const CHARAKTER_ZADAJACEGO = {
  przeniesienie: 'nabywca', przeniesienie_ulamka: 'nabywca',
  obciazenie: 'zastawnik', prawo_glosu_zastawnika: 'zastawnik',
  wykreslenie_obciazenia: 'akcjonariusz', zmiana_danych_akcjonariusza: 'akcjonariusz',
  przedstawiciel: 'akcjonariusz', zobowiazanie: 'nabywca',
  zajecie: '', wykreslenie_zajecia: '',
};
function domyslnyCharakterZadajacego(typ) {
  return Object.prototype.hasOwnProperty.call(CHARAKTER_ZADAJACEGO, typ) ? CHARAKTER_ZADAJACEGO[typ] : 'spolka';
}

/** D-100: nazwa czynności w interfejsie; w pismach i danych zostaje nazwa typu (`typy-zdarzen.js`). */
const NAZWY_CZYNNOSCI_UI = { przeniesienie: 'Zbycie akcji', przeniesienie_ulamka: 'Zbycie ułamkowej części akcji' };
function nazwaCzynnosci(kod, nazwa) {
  return NAZWY_CZYNNOSCI_UI[kod] || nazwa;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    zbywcyZRejestru, dobierzAkcje, ograniczeniaDlaDoboru, definicjaWpisu, poleWidoczne, daneZdarzenia, zakresyNaTekst,
    odbiorcaPowiadomienia, domyslnyCharakterZadajacego, nazwaCzynnosci,
  };
}
