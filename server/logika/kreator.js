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

  obciazenie(stan, we, kontekst) {
    const emisja = wymagajEmisji(stan, we);
    const data = kontekst.data_zdarzenia;
    const akcjonariuszId = liczbaCalkowita(we.akcjonariusz_osoba_id, 'akcjonariusz, którego akcje są obciążane');
    const zastawnikId = liczbaCalkowita(we.osoba_id, 'zastawnik lub użytkownik');
    const typObciazenia = tekst(we.typ_obciazenia, 'rodzaj obciążenia', { wymagane: false, maks: 20 }) || 'zastaw';
    if (!['zastaw', 'uzytkowanie'].includes(typObciazenia)) {
      throw new BladKreatora('Rodzaj obciążenia musi być „zastaw” albo „uzytkowanie”.');
    }
    const zablokowane = zakresyZablokowane(stan, emisja.klucz, data);
    const pulaRef = { wartosc: stanLogika.pula(stan, emisja.klucz, K.AKCJONARIUSZ, akcjonariuszId) };
    const zakresy = przydzielPozycje(
      pulaRef,
      we,
      `pakiet akcjonariusza w serii ${emisja.seria}`,
      zablokowane
    );
    return {
      emisja_zdarzenie_id: emisja.klucz,
      seria: emisja.seria,
      typ_obciazenia: typObciazenia,
      akcjonariusz_osoba_id: akcjonariuszId,
      akcjonariusz_nazwa: nazwaOsoby(kontekst.osoby.get(akcjonariuszId)),
      osoba_id: zastawnikId,
      osoba_nazwa: nazwaOsoby(kontekst.osoby.get(zastawnikId)),
      zakresy,
      ilosc: n.ilosc(zakresy),
      prawo_glosu: we.prawo_glosu ? 1 : 0,
      blokuje_rozporzadzanie: we.blokuje_rozporzadzanie === false ? 0 : 1,
      opis: tekst(we.opis, 'opis', { wymagane: false, maks: 500 }),
      podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
    };
  },

  wykreslenie_obciazenia(stan, we) {
    const obciazenieId = liczbaCalkowita(we.obciazenie_zdarzenie_id, 'obciążenie do wykreślenia');
    const cel = stan.obciazenia.find(
      (o) => o.klucz === obciazenieId && o.data_do === null && o.typ !== 'zajecie'
    );
    if (!cel) {
      throw new BladKreatora('Wskazane obciążenie nie istnieje w rejestrze albo zostało już wykreślone.');
    }
    return {
      obciazenie_zdarzenie_id: obciazenieId,
      typ_obciazenia: cel.typ,
      seria: cel.seria,
      akcjonariusz_osoba_id: cel.akcjonariusz_osoba_id,
      osoba_id: cel.osoba_id,
      numery: n.opisz(cel.zakresy),
      podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
    };
  },

  prawo_glosu_zastawnika(stan, we) {
    const obciazenieId = liczbaCalkowita(we.obciazenie_zdarzenie_id, 'obciążenie');
    const cel = stan.obciazenia.find(
      (o) => o.klucz === obciazenieId && o.data_do === null && o.typ !== 'zajecie'
    );
    if (!cel) {
      throw new BladKreatora('Wskazane obciążenie nie istnieje w rejestrze albo zostało już wykreślone.');
    }
    return {
      obciazenie_zdarzenie_id: obciazenieId,
      typ_obciazenia: cel.typ,
      seria: cel.seria,
      osoba_id: cel.osoba_id,
      akcjonariusz_osoba_id: cel.akcjonariusz_osoba_id,
      prawo_glosu: we.prawo_glosu ? 1 : 0,
    };
  },

  zajecie(stan, we, kontekst) {
    const emisja = wymagajEmisji(stan, we);
    const organId = we.osoba_id == null || we.osoba_id === '' ? null : liczbaCalkowita(we.osoba_id, 'organ egzekucyjny');

    let zakresy;
    let akcjonariuszId = null;
    if (we.akcjonariusz_osoba_id != null && we.akcjonariusz_osoba_id !== '') {
      akcjonariuszId = liczbaCalkowita(we.akcjonariusz_osoba_id, 'akcjonariusz, którego akcje są zajmowane');
      const pulaRef = { wartosc: stanLogika.pula(stan, emisja.klucz, K.AKCJONARIUSZ, akcjonariuszId) };
      // Zajecie jest z urzedu - obciazenia innych wierzycieli go nie blokuja.
      zakresy = przydzielPozycje(pulaRef, we, `pakiet akcjonariusza w serii ${emisja.seria}`, []);
    } else {
      if (!Array.isArray(we.zakresy) || we.zakresy.length === 0) {
        throw new BladKreatora('Bez wskazania akcjonariusza podaj wprost zajmowane numery akcji.');
      }
      zakresy = n.normalizuj(we.zakresy);
    }

    return {
      emisja_zdarzenie_id: emisja.klucz,
      seria: emisja.seria,
      akcjonariusz_osoba_id: akcjonariuszId,
      akcjonariusz_nazwa: akcjonariuszId == null ? null : nazwaOsoby(kontekst.osoby.get(akcjonariuszId)),
      osoba_id: organId,
      osoba_nazwa: organId == null ? null : nazwaOsoby(kontekst.osoby.get(organId)),
      zakresy,
      ilosc: n.ilosc(zakresy),
      opis: tekst(we.opis, 'opis', { wymagane: false, maks: 500 }),
    };
  },

  wykreslenie_zajecia(stan, we) {
    const obciazenieId = liczbaCalkowita(we.obciazenie_zdarzenie_id, 'zajęcie do uchylenia');
    const cel = stan.obciazenia.find(
      (o) => o.klucz === obciazenieId && o.data_do === null && o.typ === 'zajecie'
    );
    if (!cel) {
      throw new BladKreatora('Wskazane zajęcie nie istnieje w rejestrze albo zostało już uchylone.');
    }
    return {
      obciazenie_zdarzenie_id: obciazenieId,
      seria: cel.seria,
      akcjonariusz_osoba_id: cel.akcjonariusz_osoba_id,
      osoba_id: cel.osoba_id,
      numery: n.opisz(cel.zakresy),
      opis: tekst(we.opis, 'opis', { wymagane: false, maks: 500 }),
    };
  },

  uprawnienie(stan, we, kontekst) {
    if (we.wykresla_zdarzenie_id != null && we.wykresla_zdarzenie_id !== '') {
      const celId = liczbaCalkowita(we.wykresla_zdarzenie_id, 'wykreślane uprawnienie');
      const cel = stan.uprawnienia.find((u) => u.klucz === celId && u.status === 'aktywne');
      if (!cel) {
        throw new BladKreatora('Wskazane uprawnienie nie istnieje w rejestrze albo zostało już wykreślone.');
      }
      return {
        wykresla_zdarzenie_id: celId,
        tytul: cel.tytul,
        podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
      };
    }

    const rodzaj = tekst(we.rodzaj, 'rodzaj', { wymagane: false, maks: 20 }) || 'uprawnienie';
    if (!['uprawnienie', 'przywilej', 'obowiazek'].includes(rodzaj)) {
      throw new BladKreatora('Rodzaj musi być: uprawnienie, przywilej albo obowiązek.');
    }
    const zakres = tekst(we.zakres, 'zakres', { wymagane: false, maks: 20 }) || 'spolka';
    if (!['spolka', 'emisja', 'akcjonariusz'].includes(zakres)) {
      throw new BladKreatora('Zakres musi być: spółka, emisja albo akcjonariusz.');
    }
    let emisjaKlucz = null;
    let seria = null;
    let osobaId = null;
    if (zakres === 'emisja') {
      const emisja = wymagajEmisji(stan, we);
      emisjaKlucz = emisja.klucz;
      seria = emisja.seria;
    }
    if (zakres === 'akcjonariusz') {
      osobaId = liczbaCalkowita(we.osoba_id, 'akcjonariusz');
    }
    const tytul = tekst(we.tytul, 'tytuł', { wymagane: false, maks: 200 });
    const tresc = tekst(we.tresc, 'treść', { wymagane: false, maks: 2000 });
    if (!tytul && !tresc) {
      throw new BladKreatora('Podaj tytuł albo treść uprawnienia.');
    }
    return {
      rodzaj,
      zakres,
      emisja_zdarzenie_id: emisjaKlucz,
      seria,
      osoba_id: osobaId,
      osoba_nazwa: osobaId == null ? null : nazwaOsoby(kontekst.osoby.get(osobaId)),
      tytul,
      tresc,
      podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
    };
  },

  ograniczenie(stan, we) {
    if (we.wykresla_zdarzenie_id != null && we.wykresla_zdarzenie_id !== '') {
      const celId = liczbaCalkowita(we.wykresla_zdarzenie_id, 'wykreślane ograniczenie');
      const cel = stan.ograniczenia.find((o) => o.klucz === celId && o.status === 'aktywne');
      if (!cel) {
        throw new BladKreatora('Wskazane ograniczenie nie istnieje w rejestrze albo zostało już wykreślone.');
      }
      return {
        wykresla_zdarzenie_id: celId,
        opis: cel.opis,
        podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
      };
    }

    const zakres = tekst(we.zakres, 'zakres', { wymagane: false, maks: 20 }) || 'wszystkie';
    if (!['wszystkie', 'emisja', 'zakres_numerow'].includes(zakres)) {
      throw new BladKreatora('Zakres musi być: wszystkie, emisja albo zakres numerów.');
    }
    let emisjaKlucz = null;
    let seria = null;
    let zakresy = [];
    if (zakres === 'emisja' || zakres === 'zakres_numerow') {
      const emisja = wymagajEmisji(stan, we);
      emisjaKlucz = emisja.klucz;
      seria = emisja.seria;
    }
    if (zakres === 'zakres_numerow') {
      if (!Array.isArray(we.zakresy) || we.zakresy.length === 0) {
        throw new BladKreatora('Wskaż numery akcji objęte ograniczeniem.');
      }
      zakresy = n.normalizuj(we.zakresy);
    }
    return {
      zakres,
      emisja_zdarzenie_id: emisjaKlucz,
      seria,
      zakresy,
      wymaga_zgody_spolki: we.wymaga_zgody_spolki ? 1 : 0,
      prawo_pierwszenstwa: we.prawo_pierwszenstwa ? 1 : 0,
      opis: tekst(we.opis, 'opis', { wymagane: false, maks: 500 }),
      podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
    };
  },

  zmiana_danych_akcjonariusza(stan, we, kontekst) {
    const osobaId = liczbaCalkowita(we.osoba_id, 'akcjonariusz');
    const osoba = kontekst.osoby.get(osobaId);
    if (!osoba) {
      throw new BladKreatora('Wskazana osoba nie figuruje w kartotece.');
    }
    const dozwolone = [
      'nazwisko', 'imie', 'nazwa',
      'kod_pocztowy', 'miejscowosc', 'ulica', 'nr_domu', 'nr_lokalu',
      'adres_doreczen', 'adres_edoreczen', 'email', 'telefon', 'zgoda_email',
    ];
    const po = we.po && typeof we.po === 'object' ? we.po : {};
    const zmienione = Object.keys(po).filter(
      (k) => dozwolone.includes(k) && String(osoba[k] ?? '') !== String(po[k] ?? '')
    );
    if (zmienione.length === 0) {
      throw new BladKreatora('Nie wskazano żadnej zmiany danych.');
    }
    return {
      osoba_id: osobaId,
      osoba_nazwa: nazwaOsoby(osoba),
      przed: Object.fromEntries(zmienione.map((k) => [k, osoba[k] ?? null])),
      po: Object.fromEntries(zmienione.map((k) => [k, po[k] ?? null])),
      zmienione_pola: zmienione,
      podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
    };
  },

  zobowiazanie(stan, we, kontekst) {
    const akcjonariuszId = liczbaCalkowita(we.akcjonariusz_osoba_id, 'akcjonariusz składający oświadczenie');
    const rodzaj = tekst(we.rodzaj, 'rodzaj zobowiązania', { wymagane: false, maks: 60 }) || 'przeniesienie';
    let emisjaKlucz = null;
    let seria = null;
    let zakresy = [];
    if (we.emisja_zdarzenie_id != null && we.emisja_zdarzenie_id !== '') {
      const emisja = wymagajEmisji(stan, we);
      emisjaKlucz = emisja.klucz;
      seria = emisja.seria;
      if (Array.isArray(we.zakresy) && we.zakresy.length > 0) zakresy = n.normalizuj(we.zakresy);
    }
    return {
      akcjonariusz_osoba_id: akcjonariuszId,
      akcjonariusz_nazwa: nazwaOsoby(kontekst.osoby.get(akcjonariuszId)),
      rodzaj,
      emisja_zdarzenie_id: emisjaKlucz,
      seria,
      zakresy,
      tresc: tekst(we.tresc, 'treść oświadczenia', { wymagane: false, maks: 2000 }),
      podstawa_opis: tekst(we.podstawa_opis, 'podstawa wpisu', { wymagane: false, maks: 500 }),
    };
  },

  zdarzenie_inne(stan, we) {
    return {
      opis: tekst(we.opis, 'opis zdarzenia', { maks: 2000 }),
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
  if (dane.osoba_id != null && dane.osoba_id !== '') idki.add(Number(dane.osoba_id));
  if (dane.akcjonariusz_osoba_id != null && dane.akcjonariusz_osoba_id !== '') {
    idki.add(Number(dane.akcjonariusz_osoba_id));
  }
  for (const p of dane.pozycje || []) {
    if (p && p.osoba_id != null && p.osoba_id !== '') idki.add(Number(p.osoba_id));
    if (p && p.nabywca_osoba_id != null) idki.add(Number(p.nabywca_osoba_id));
  }
  return [...idki].filter((x) => Number.isInteger(x));
}

/**
 * Dla zdarzen odwolujacych sie do ISTNIEJACEGO obciazenia (wykreslenie_*,
 * prawo_glosu_zastawnika) wejscie z kreatora niesie tylko
 * `obciazenie_zdarzenie_id` - strony (zastawnik, akcjonariusz) trzeba
 * dociagnac ze stanu, zeby snapshot zdarzenia mial ich oznaczenia.
 */
function dodatkoweOsobyZReferencji(stan, typ, we = {}) {
  const idki = new Set();
  const typyOdwolujaceSieDoObciazenia = [
    'wykreslenie_obciazenia',
    'wykreslenie_zajecia',
    'prawo_glosu_zastawnika',
  ];
  if (typyOdwolujaceSieDoObciazenia.includes(typ) && we.obciazenie_zdarzenie_id != null) {
    const cel = stan.obciazenia.find((o) => o.klucz === Number(we.obciazenie_zdarzenie_id));
    if (cel) {
      if (cel.osoba_id != null) idki.add(cel.osoba_id);
      if (cel.akcjonariusz_osoba_id != null) idki.add(cel.akcjonariusz_osoba_id);
    }
  }
  return [...idki];
}

/**
 * Przygotowuje tresc zdarzenia „sprostowanie” (endpoint `zdarzenia/:id/sprostuj`).
 *
 * Gdy podano `zamiast`, budujemy skorygowana tresc TYM SAMYM budowniczym co
 * zdarzenie pierwotne, wzgledem stanu TUZ PRZED zdarzeniem pierwotnym
 * (chronologicznie) - nie "bez niego w ogole". Roznica ma znaczenie, gdy
 * cos juz od zdarzenia pierwotnego zalezy (np. `objecie` po `emisji`):
 * wykluczenie calego zdarzenia z listy zrywaloby referencje downstream
 * zdarzen w trakcie samego liczenia tresci; stan sprzed niego jest naturalna
 * baza do pytania "jak to zdarzenie powinno bylo wygladac", bez tego problemu.
 */
function przygotujSprostowanie({ zdarzenia, zdarzeniePierwotneId, data_zdarzenia, uzasadnienie, zamiast }, kontekst = {}) {
  const uzas = tekst(uzasadnienie, 'uzasadnienie sprostowania', { maks: 2000 });

  if (!zamiast || !zamiast.typ) {
    return { dane: { uzasadnienie: uzas } };
  }
  if (!PRZYGOTOWANIA[zamiast.typ]) {
    throw new BladKreatora(`Sprostowanie na typ „${zamiast.typ}” nie jest obsługiwane przez kreator.`);
  }

  const posortowane = [...(zdarzenia || [])].sort(stanLogika.porownajZdarzenia);
  const indeks = posortowane.findIndex((z) => Number(z.id) === Number(zdarzeniePierwotneId));
  const przedPierwotnym = indeks === -1 ? posortowane : posortowane.slice(0, indeks);
  const stanPrzedPierwotnym = stanLogika.odtworzStan(przedPierwotnym);

  const tresc = PRZYGOTOWANIA[zamiast.typ](stanPrzedPierwotnym, zamiast.dane || {}, {
    data_zdarzenia,
    osoby: kontekst.osoby instanceof Map ? kontekst.osoby : new Map(),
  });

  return { dane: { zamiast: { typ: zamiast.typ, ...tresc }, uzasadnienie: uzas } };
}

module.exports = {
  BladKreatora,
  przygotuj,
  przygotujSprostowanie,
  osobyWWejsciu,
  dodatkoweOsobyZReferencji,
  zakresyZablokowane,
  nazwaOsoby,
};
