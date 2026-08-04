'use strict';

/**
 * Przeklada wejscie z kreatora na tresc zdarzenia (`dane_json`).
 *
 * Regula domenowa nr 4: numery akcji przydziela APLIKACJA. Uzytkownik podaje
 * wylacznie ilosc. Reczne wskazanie zakresu jest sciezka wyjatkowa - sluzy
 * do przeniesienia konkretnych akcji (np. obciazonych zastawem).
 *
 * Domyslny przydzial idzie FIFO po najnizszym WOLNYM numerze, przy czym
 * "wolny" znaczy takze: nieobjety blokujacym obciazeniem. Inaczej kreator
 * proponowalby akcje, ktorych walidacja i tak nie przepusci.
 *
 * `dane_json` jest snapshotem: niesie oznaczenie serii i nazwy stron, zeby
 * zdarzenie dalo sie odczytac bez laczenia z innymi tabelami. NIE niesie
 * numeru PESEL ani adresu - dane identyfikacyjne zyja w `psa_osoby`
 * i zmieniaja sie zdarzeniem `zmiana_danych_akcjonariusza`; nie ma powodu
 * utrwalac ich w niezmienialnym lancuchu skrotow.
 */

const n = require('./numery');
const stanLogika = require('./stan');
const przepisy = require('./przepisy');

const K = przepisy.KATEGORIE_AKCJI;

class BladKreatora extends Error {
  constructor(komunikat) {
    super(komunikat);
    this.name = 'BladKreatora';
  }
}

function liczbaCalkowita(wartosc, nazwaPola, { min = 1 } = {}) {
  const v = Number(wartosc);
  if (!Number.isInteger(v) || v < min) {
    throw new BladKreatora(`Pole „${nazwaPola}” musi być liczbą całkowitą nie mniejszą niż ${min}.`);
  }
  return v;
}

function tekst(wartosc, nazwaPola, { wymagane = true, maks = 500 } = {}) {
  const v = String(wartosc == null ? '' : wartosc).trim();
  if (!v && wymagane) throw new BladKreatora(`Pole „${nazwaPola}” jest wymagane.`);
  if (v.length > maks) {
    throw new BladKreatora(`Pole „${nazwaPola}” jest za długie (maksymalnie ${maks} znaków).`);
  }
  return v || null;
}

/** Zakresy zablokowane obciazeniem na dany dzien, w obrebie jednej emisji. */
function zakresyZablokowane(stan, emisjaKlucz, data) {
  return n.normalizuj(
    stanLogika
      .obciazeniaNaDzien(stan, data)
      .filter((o) => o.emisja_klucz === emisjaKlucz && o.blokuje_rozporzadzanie === 1)
      .flatMap((o) => o.zakresy)
  );
}

/**
 * Przydziela zakresy dla jednej pozycji kreatora, zdejmujac je z lokalnej puli.
 * `pulaRef` jest modyfikowana - kolejne pozycje dostaja to, co zostalo.
 */
function przydzielPozycje(pulaRef, pozycja, opisPuli, zablokowane) {
  const ile = pozycja.ilosc == null ? null : liczbaCalkowita(pozycja.ilosc, 'liczba akcji');
  const reczne = Array.isArray(pozycja.zakresy) && pozycja.zakresy.length > 0;

  let zakresy;
  if (reczne) {
    // Sciezka wyjatkowa: uzytkownik wskazal konkretne numery.
    zakresy = n.przydzielWskazane(pulaRef.wartosc, pozycja.zakresy, ile);
  } else {
    if (ile == null) throw new BladKreatora('Nie podano liczby akcji.');
    const wolne = n.roznica(pulaRef.wartosc, zablokowane);
    if (n.ilosc(wolne) < ile) {
      const zablokowaneWPuli = n.przeciecie(pulaRef.wartosc, zablokowane);
      const szczegol =
        zablokowaneWPuli.length > 0
          ? ` Akcje ${n.opisz(zablokowaneWPuli)} są obciążone w sposób blokujący rozporządzanie — ` +
            `można je wskazać wyłącznie ręcznie, po ustaleniu podstawy.`
          : '';
      throw new BladKreatora(
        `Brak pokrycia: żądano ${ile} akcji, a ${opisPuli} obejmuje ${n.ilosc(wolne)} akcji wolnych.` +
          szczegol
      );
    }
    zakresy = n.przydzielFifo(wolne, ile);
  }

  pulaRef.wartosc = n.roznica(pulaRef.wartosc, zakresy);
  return zakresy;
}

function nazwaOsoby(osoba) {
  if (!osoba) return null;
  return osoba.typ === 'prawna'
    ? osoba.nazwa || null
    : [osoba.nazwisko, osoba.imie].filter(Boolean).join(' ') || null;
}

// ─────────────────────────────────────────────────────────────

const PRZYGOTOWANIA = {
  emisja(stan, we) {
    const seria = tekst(we.seria, 'seria', { maks: 40 });
    const ilosc = liczbaCalkowita(we.ilosc, 'liczba akcji');
    const nrPierwszy = we.nr_pierwszy == null ? 1 : liczbaCalkowita(we.nr_pierwszy, 'numer pierwszej akcji');
    const cena =
      we.cena_emisyjna_grosze == null || we.cena_emisyjna_grosze === ''
        ? null
        : liczbaCalkowita(we.cena_emisyjna_grosze, 'cena emisyjna (grosze)', { min: 0 });
    return {
      seria,
      tytul: tekst(we.tytul, 'tytuł emisji', { wymagane: false, maks: 200 }),
      podstawa_prawna: tekst(we.podstawa_prawna, 'podstawa prawna', { wymagane: false, maks: 300 }),
      nr_pierwszy: nrPierwszy,
      ilosc,
      cena_emisyjna_grosze: cena,
      waluta: tekst(we.waluta, 'waluta', { wymagane: false, maks: 3 }) || przepisy.WALUTA_DOMYSLNA,
      opis: tekst(we.opis, 'opis', { wymagane: false, maks: 2000 }),
      uwagi: tekst(we.uwagi, 'uwagi', { wymagane: false, maks: 2000 }),
    };
  },

  objecie(stan, we, kontekst) {
    const emisja = wymagajEmisji(stan, we);
    const data = kontekst.data_zdarzenia;
    const zablokowane = zakresyZablokowane(stan, emisja.klucz, data);
    const pulaRef = { wartosc: stanLogika.pula(stan, emisja.klucz, K.NIEOBJETA, null) };

    const pozycje = wymagajPozycji(we).map((p) => {
      const osobaId = liczbaCalkowita(p.osoba_id, 'akcjonariusz obejmujący akcje');
      const zakresy = przydzielPozycje(
        pulaRef,
        p,
        `pula akcji nieobjętych serii ${emisja.seria}`,
        zablokowane
      );
      return {
        osoba_id: osobaId,
        osoba_nazwa: nazwaOsoby(kontekst.osoby.get(osobaId)),
        ilosc: n.ilosc(zakresy),
        zakresy,
      };
    });

    return {
      emisja_zdarzenie_id: emisja.klucz,
      seria: emisja.seria,
      podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
      pozycje,
    };
  },

  przeniesienie(stan, we, kontekst) {
    const emisja = wymagajEmisji(stan, we);
    const data = kontekst.data_zdarzenia;
    const zbywcaId = liczbaCalkowita(we.zbywca_osoba_id, 'zbywca');
    const zablokowane = zakresyZablokowane(stan, emisja.klucz, data);
    const pulaRef = { wartosc: stanLogika.pula(stan, emisja.klucz, K.AKCJONARIUSZ, zbywcaId) };

    const pozycje = wymagajPozycji(we).map((p) => {
      const nabywcaId = liczbaCalkowita(p.nabywca_osoba_id, 'nabywca');
      const zakresy = przydzielPozycje(
        pulaRef,
        p,
        `pakiet zbywcy w serii ${emisja.seria}`,
        zablokowane
      );
      return {
        nabywca_osoba_id: nabywcaId,
        nabywca_nazwa: nazwaOsoby(kontekst.osoby.get(nabywcaId)),
        ilosc: n.ilosc(zakresy),
        zakresy,
      };
    });

    return {
      emisja_zdarzenie_id: emisja.klucz,
      seria: emisja.seria,
      zbywca_osoba_id: zbywcaId,
      zbywca_nazwa: nazwaOsoby(kontekst.osoby.get(zbywcaId)),
      tytul_prawny: tekst(we.tytul_prawny, 'tytuł prawny', { wymagane: false, maks: 100 }) || 'sprzedaż',
      podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
      zgoda_spolki: we.zgoda_spolki ? 1 : 0,
      pierwszenstwo_wyczerpane: we.pierwszenstwo_wyczerpane ? 1 : 0,
      pozycje,
    };
  },

  umorzenie(stan, we, kontekst) {
    const emisja = wymagajEmisji(stan, we);
    const data = kontekst.data_zdarzenia;
    const zablokowane = zakresyZablokowane(stan, emisja.klucz, data);

    const pozycje = wymagajPozycji(we).map((p) => {
      const zNieobjetych = p.osoba_id == null || p.osoba_id === '';
      const osobaId = zNieobjetych ? null : liczbaCalkowita(p.osoba_id, 'akcjonariusz');
      const pulaRef = {
        wartosc: zNieobjetych
          ? stanLogika.pula(stan, emisja.klucz, K.NIEOBJETA, null)
          : stanLogika.pula(stan, emisja.klucz, K.AKCJONARIUSZ, osobaId),
      };
      const zakresy = przydzielPozycje(
        pulaRef,
        p,
        zNieobjetych
          ? `pula akcji nieobjętych serii ${emisja.seria}`
          : `pakiet akcjonariusza w serii ${emisja.seria}`,
        zablokowane
      );
      return {
        osoba_id: osobaId,
        osoba_nazwa: osobaId == null ? null : nazwaOsoby(kontekst.osoby.get(osobaId)),
        ilosc: n.ilosc(zakresy),
        zakresy,
      };
    });

    return {
      emisja_zdarzenie_id: emisja.klucz,
      seria: emisja.seria,
      tryb: tekst(we.tryb, 'tryb umorzenia', { wymagane: false, maks: 60 }) || 'dobrowolne',
      podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
      pozycje,
    };
  },

  zmiana_danych_spolki(stan, we) {
    return {
      przed: we.przed || {},
      po: we.po || {},
      zmienione_pola: Array.isArray(we.zmienione_pola) ? we.zmienione_pola : [],
      podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
    };
  },
};

function wymagajEmisji(stan, we) {
  if (we.emisja_zdarzenie_id == null) {
    throw new BladKreatora('Nie wskazano emisji (serii akcji), której dotyczy zdarzenie.');
  }
  const emisja = stanLogika.znajdzEmisje(stan, Number(we.emisja_zdarzenie_id));
  if (!emisja) {
    throw new BladKreatora('Wskazana emisja nie istnieje w rejestrze tej spółki.');
  }
  return emisja;
}

function wymagajPozycji(we) {
  const pozycje = Array.isArray(we.pozycje) ? we.pozycje.filter(Boolean) : [];
  if (pozycje.length === 0) {
    throw new BladKreatora('Nie wskazano żadnej pozycji zdarzenia.');
  }
  return pozycje;
}

/**
 * Buduje tresc zdarzenia na podstawie stanu rejestru i wejscia z kreatora.
 * Rzuca BladKreatora z komunikatem po polsku - nadaje sie prosto do UI.
 */
function przygotuj(stan, { typ, data_zdarzenia, dane }, kontekst = {}) {
  const budowniczy = PRZYGOTOWANIA[typ];
  if (!budowniczy) {
    throw new BladKreatora(
      `Typ zdarzenia „${typ}” nie jest jeszcze obsługiwany przez kreator w tym sprincie.`
    );
  }
  return budowniczy(stan, dane || {}, {
    data_zdarzenia,
    osoby: kontekst.osoby instanceof Map ? kontekst.osoby : new Map(),
  });
}

/** Zbiera identyfikatory osob wystepujacych w wejsciu - do wczytania kartoteki. */
function osobyWWejsciu(dane = {}) {
  const idki = new Set();
  if (dane.zbywca_osoba_id != null) idki.add(Number(dane.zbywca_osoba_id));
  for (const p of dane.pozycje || []) {
    if (p && p.osoba_id != null && p.osoba_id !== '') idki.add(Number(p.osoba_id));
    if (p && p.nabywca_osoba_id != null) idki.add(Number(p.nabywca_osoba_id));
  }
  return [...idki].filter((x) => Number.isInteger(x));
}

module.exports = { BladKreatora, przygotuj, osobyWWejsciu, zakresyZablokowane, nazwaOsoby };
