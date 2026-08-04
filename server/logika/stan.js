'use strict';

/**
 * Odbudowa stanu akcjonariatu ze zdarzen.
 *
 * Regula domenowa nr 2: stan akcjonariatu jest POCHODNA zdarzen.
 * `psa_stan_akcji` i `psa_obciazenia` to wylacznie materializacja dla
 * szybkosci - musza dac sie odbudowac w calosci ze zdarzen.
 *
 * Model: kazdy numer akcji w serii nalezy w danej chwili do DOKLADNIE JEDNEGO
 * otwartego przedzialu, o jednej z trzech kategorii:
 *   - `nieobjeta`     - wyemitowana, jeszcze nieobjeta,
 *   - `akcjonariusz`  - przypisana konkretnej osobie,
 *   - `umorzona`      - umorzona.
 *
 * Dzieki temu regula domenowa nr 3 ("bilans akcji musi sie zgadzac zawsze")
 * jest sprawdzalna jednym warunkiem: otwarte przedzialy serii pokrywaja
 * zakres emisji szczelnie i bez nakladania.
 *
 * Modul jest CZYSTY - nie dotyka bazy. Wejscie: tablica zdarzen. Wyjscie:
 * struktura w pamieci. Materializacje do SQLite robi `server/baza-stan.js`.
 */

const n = require('./numery');
const przepisy = require('./przepisy');

const K = przepisy.KATEGORIE_AKCJI;

class BladStanu extends Error {
  constructor(komunikat) {
    super(komunikat);
    this.name = 'BladStanu';
  }
}

// ─────────────────────────────────────────────────────────────
// Porzadek stosowania zdarzen
// ─────────────────────────────────────────────────────────────

/**
 * Zdarzenia stosujemy w kolejnosci (data_zdarzenia, id). `id` rosnie z data
 * wpisu, wiec przy tej samej dacie zdarzenia decyduje kolejnosc wpisania.
 * Walidacja nie dopuszcza zdarzenia z data wczesniejsza niz ostatnie
 * zdarzenie na tych samych akcjach, wiec porzadek jest spojny.
 */
function porownajZdarzenia(a, b) {
  const da = String(a.data_zdarzenia || '');
  const db = String(b.data_zdarzenia || '');
  if (da !== db) return da < db ? -1 : 1;
  return Number(a.id) - Number(b.id);
}

function dane(zdarzenie) {
  if (zdarzenie.dane && typeof zdarzenie.dane === 'object') return zdarzenie.dane;
  try {
    return JSON.parse(zdarzenie.dane_json || '{}');
  } catch {
    throw new BladStanu(
      `Zdarzenie #${zdarzenie.id} ma uszkodzoną treść (dane_json nie jest poprawnym JSON-em).`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Operacje na przedzialach
// ─────────────────────────────────────────────────────────────

function pustyStan() {
  return {
    emisje: [],
    przedzialy: [], // otwarte i zamkniete razem; zamkniete maja data_do != null
    obciazenia: [],
    uprawnienia: [],
    ograniczenia: [],
    /** Zdarzenia niewplywajace na akcje - do osi czasu w kokpicie. */
    pozostale: [],
  };
}

function otwarte(stan) {
  return stan.przedzialy.filter((p) => p.data_do === null);
}

function znajdzEmisje(stan, klucz) {
  return stan.emisje.find((e) => e.klucz === klucz) || null;
}

/**
 * Ustala emisje, ktorej dotyczy zdarzenie. Preferujemy stabilny identyfikator
 * zdarzenia emisji; `seria` sluzy jako czytelny fallback i kontrola snapshotu.
 */
function emisjaZeZdarzenia(stan, d, zdarzenie) {
  const klucz = d.emisja_zdarzenie_id != null ? Number(d.emisja_zdarzenie_id) : null;
  if (klucz != null) {
    const e = znajdzEmisje(stan, klucz);
    if (!e) {
      throw new BladStanu(
        `Zdarzenie #${zdarzenie.id} wskazuje na nieistniejącą emisję (zdarzenie #${klucz}).`
      );
    }
    return e;
  }
  if (d.seria) {
    const trafienia = stan.emisje.filter((e) => e.seria === d.seria);
    if (trafienia.length === 1) return trafienia[0];
    if (trafienia.length === 0) {
      throw new BladStanu(
        `Zdarzenie #${zdarzenie.id} wskazuje na nieistniejącą serię „${d.seria}”.`
      );
    }
    throw new BladStanu(
      `Zdarzenie #${zdarzenie.id} wskazuje serię „${d.seria}”, która występuje w wielu emisjach.`
    );
  }
  throw new BladStanu(`Zdarzenie #${zdarzenie.id} nie wskazuje emisji.`);
}

/** Otwarte przedzialy danej emisji, kategorii i (opcjonalnie) osoby. */
function przedzialyPuli(stan, emisjaKlucz, kategoria, osobaId) {
  return otwarte(stan).filter(
    (p) =>
      p.emisja_klucz === emisjaKlucz &&
      p.kategoria === kategoria &&
      (kategoria === K.AKCJONARIUSZ ? Number(p.osoba_id) === Number(osobaId) : true)
  );
}

/** Zakresy dostepne w danej puli (suma otwartych przedzialow). */
function pula(stan, emisjaKlucz, kategoria, osobaId) {
  return n.normalizuj(
    przedzialyPuli(stan, emisjaKlucz, kategoria, osobaId).map((p) => ({
      nr_od: p.nr_od,
      nr_do: p.nr_do,
    }))
  );
}

function otworz(stan, { emisjaKlucz, kategoria, osobaId, zakresy, data, zdarzenieId, tytul }) {
  for (const z of n.normalizuj(zakresy)) {
    stan.przedzialy.push({
      emisja_klucz: emisjaKlucz,
      kategoria,
      osoba_id: kategoria === K.AKCJONARIUSZ ? Number(osobaId) : null,
      nr_od: z.nr_od,
      nr_do: z.nr_do,
      data_od: data,
      zdarzenie_od_id: zdarzenieId,
      data_do: null,
      zdarzenie_do_id: null,
      tytul_nabycia: tytul || null,
    });
  }
}

/**
 * Zdejmuje `zakresy` z puli (kategoria + osoba) i zamyka odpowiadajace im
 * fragmenty przedzialow. Czesci nieobjete operacja pozostaja otwarte
 * z ZACHOWANIEM pierwotnej daty nabycia - rejestr ma pokazywac, od kiedy
 * akcjonariusz posiada konkretny blok akcji.
 */
function zdejmij(stan, { emisjaKlucz, kategoria, osobaId, zakresy, data, zdarzenieId }) {
  const doZdjecia = n.normalizuj(zakresy);
  const dotkniete = przedzialyPuli(stan, emisjaKlucz, kategoria, osobaId);
  const dostepne = n.normalizuj(dotkniete.map((p) => ({ nr_od: p.nr_od, nr_do: p.nr_do })));
  const brakujace = n.roznica(doZdjecia, dostepne);
  if (brakujace.length > 0) {
    throw new BladStanu(
      `Brak pokrycia dla zakresu ${n.opisz(brakujace)} — akcje nie znajdują się w oczekiwanej puli.`
    );
  }

  const noweOtwarte = [];
  for (const p of dotkniete) {
    const czesc = n.przeciecie([{ nr_od: p.nr_od, nr_do: p.nr_do }], doZdjecia);
    if (czesc.length === 0) continue;
    const reszta = n.roznica([{ nr_od: p.nr_od, nr_do: p.nr_do }], doZdjecia);

    // Przedzial zastepujemy jego rozbiciem: fragmenty zamkniete + fragmenty,
    // ktore zostaja przy dotychczasowym posiadaczu.
    stan.przedzialy.splice(stan.przedzialy.indexOf(p), 1);
    for (const c of czesc) {
      stan.przedzialy.push({
        ...p,
        nr_od: c.nr_od,
        nr_do: c.nr_do,
        data_do: data,
        zdarzenie_do_id: zdarzenieId,
      });
    }
    for (const r of reszta) {
      noweOtwarte.push({ ...p, nr_od: r.nr_od, nr_do: r.nr_do });
    }
  }
  stan.przedzialy.push(...noweOtwarte);
}

/** Przeniesienie akcji miedzy pulami - jedyna droga zmiany kategorii/wlasciciela. */
function przenies(stan, opcje) {
  zdejmij(stan, {
    emisjaKlucz: opcje.emisjaKlucz,
    kategoria: opcje.zKategorii,
    osobaId: opcje.zOsoby,
    zakresy: opcje.zakresy,
    data: opcje.data,
    zdarzenieId: opcje.zdarzenieId,
  });
  otworz(stan, {
    emisjaKlucz: opcje.emisjaKlucz,
    kategoria: opcje.doKategorii,
    osobaId: opcje.doOsoby,
    zakresy: opcje.zakresy,
    data: opcje.data,
    zdarzenieId: opcje.zdarzenieId,
    tytul: opcje.tytul,
  });
}

/**
 * Scala przylegle otwarte przedzialy o identycznym pochodzeniu
 * (ta sama emisja, kategoria, osoba, data i zdarzenie nabycia).
 * Nie scalamy blokow nabytych w roznych momentach - data nabycia to
 * informacja rejestrowa, nie ozdoba.
 */
function scal(stan) {
  const klucz = (p) =>
    [p.emisja_klucz, p.kategoria, p.osoba_id, p.data_od, p.zdarzenie_od_id, p.tytul_nabycia].join('|');
  const otwartePrzedzialy = stan.przedzialy.filter((p) => p.data_do === null);
  const zamkniete = stan.przedzialy.filter((p) => p.data_do !== null);
  const grupy = new Map();
  for (const p of otwartePrzedzialy) {
    const k = klucz(p);
    if (!grupy.has(k)) grupy.set(k, []);
    grupy.get(k).push(p);
  }
  const wynik = [];
  for (const grupa of grupy.values()) {
    const scalone = n.normalizuj(grupa.map((p) => ({ nr_od: p.nr_od, nr_do: p.nr_do })));
    for (const z of scalone) {
      wynik.push({ ...grupa[0], nr_od: z.nr_od, nr_do: z.nr_do });
    }
  }
  stan.przedzialy = [...zamkniete, ...wynik];
}

// ─────────────────────────────────────────────────────────────
// Handlery typow zdarzen
// ─────────────────────────────────────────────────────────────

const HANDLERY = {
  emisja(stan, zdarzenie, d) {
    if (stan.emisje.some((e) => e.seria === d.seria)) {
      throw new BladStanu(
        `Seria „${d.seria}” już istnieje w tej spółce (zdarzenie #${zdarzenie.id}).`
      );
    }
    const zakres = n.zakresEmisji({ nr_pierwszy: d.nr_pierwszy, ilosc: d.ilosc });
    stan.emisje.push({
      klucz: Number(zdarzenie.id),
      zdarzenie_id: Number(zdarzenie.id),
      tytul: d.tytul || null,
      podstawa_prawna: d.podstawa_prawna || null,
      seria: d.seria,
      nr_pierwszy: Number(d.nr_pierwszy),
      ilosc: Number(d.ilosc),
      cena_emisyjna_grosze: d.cena_emisyjna_grosze == null ? null : Number(d.cena_emisyjna_grosze),
      waluta: d.waluta || przepisy.WALUTA_DOMYSLNA,
      data_emisji: d.data_emisji || zdarzenie.data_zdarzenia,
      status: przepisy.STATUSY_EMISJI.AKTYWNA,
      opis: d.opis || null,
      uwagi: d.uwagi || null,
    });
    otworz(stan, {
      emisjaKlucz: Number(zdarzenie.id),
      kategoria: K.NIEOBJETA,
      osobaId: null,
      zakresy: zakres,
      data: zdarzenie.data_zdarzenia,
      zdarzenieId: Number(zdarzenie.id),
    });
  },

  objecie(stan, zdarzenie, d) {
    const emisja = emisjaZeZdarzenia(stan, d, zdarzenie);
    for (const poz of d.pozycje || []) {
      przenies(stan, {
        emisjaKlucz: emisja.klucz,
        zKategorii: K.NIEOBJETA,
        zOsoby: null,
        doKategorii: K.AKCJONARIUSZ,
        doOsoby: Number(poz.osoba_id),
        zakresy: poz.zakresy,
        data: zdarzenie.data_zdarzenia,
        zdarzenieId: Number(zdarzenie.id),
        tytul: 'objęcie akcji',
      });
    }
  },

  przeniesienie(stan, zdarzenie, d) {
    const emisja = emisjaZeZdarzenia(stan, d, zdarzenie);
    for (const poz of d.pozycje || []) {
      przenies(stan, {
        emisjaKlucz: emisja.klucz,
        zKategorii: K.AKCJONARIUSZ,
        zOsoby: Number(d.zbywca_osoba_id),
        doKategorii: K.AKCJONARIUSZ,
        doOsoby: Number(poz.nabywca_osoba_id),
        zakresy: poz.zakresy,
        data: zdarzenie.data_zdarzenia,
        zdarzenieId: Number(zdarzenie.id),
        tytul: d.tytul_prawny || 'przeniesienie akcji',
      });
    }
  },

  umorzenie(stan, zdarzenie, d) {
    const emisja = emisjaZeZdarzenia(stan, d, zdarzenie);
    for (const poz of d.pozycje || []) {
      const zKategorii = poz.osoba_id == null ? K.NIEOBJETA : K.AKCJONARIUSZ;
      przenies(stan, {
        emisjaKlucz: emisja.klucz,
        zKategorii,
        zOsoby: poz.osoba_id == null ? null : Number(poz.osoba_id),
        doKategorii: K.UMORZONA,
        doOsoby: null,
        zakresy: poz.zakresy,
        data: zdarzenie.data_zdarzenia,
        zdarzenieId: Number(zdarzenie.id),
        tytul: 'umorzenie',
      });
    }
    const wszystkieUmorzone =
      n.ilosc(pula(stan, emisja.klucz, K.UMORZONA, null)) === emisja.ilosc;
    if (wszystkieUmorzone) emisja.status = przepisy.STATUSY_EMISJI.UMORZONA;
  },

  // Ponizsze typy nie maja jeszcze kreatora (sprint 2), ale ich odtwarzanie
  // jest potrzebne juz teraz: walidacje blokujace pytaja o obciazenia
  // i ograniczenia, a kokpit ma dla nich sekcje.

  obciazenie(stan, zdarzenie, d) {
    const emisja = emisjaZeZdarzenia(stan, d, zdarzenie);
    stan.obciazenia.push({
      klucz: Number(zdarzenie.id),
      typ: d.typ_obciazenia || 'zastaw',
      emisja_klucz: emisja.klucz,
      seria: emisja.seria,
      zakresy: n.normalizuj(d.zakresy),
      osoba_id: d.osoba_id == null ? null : Number(d.osoba_id),
      akcjonariusz_osoba_id: d.akcjonariusz_osoba_id == null ? null : Number(d.akcjonariusz_osoba_id),
      prawo_glosu: d.prawo_glosu ? 1 : 0,
      blokuje_rozporzadzanie: d.blokuje_rozporzadzanie ? 1 : 0,
      opis: d.opis || null,
      zdarzenie_ustanowienia_id: Number(zdarzenie.id),
      data_od: zdarzenie.data_zdarzenia,
      zdarzenie_wykreslenia_id: null,
      data_do: null,
    });
  },

  zajecie(stan, zdarzenie, d) {
    const emisja = emisjaZeZdarzenia(stan, d, zdarzenie);
    stan.obciazenia.push({
      klucz: Number(zdarzenie.id),
      typ: 'zajecie',
      emisja_klucz: emisja.klucz,
      seria: emisja.seria,
      zakresy: n.normalizuj(d.zakresy),
      osoba_id: d.osoba_id == null ? null : Number(d.osoba_id),
      akcjonariusz_osoba_id: d.akcjonariusz_osoba_id == null ? null : Number(d.akcjonariusz_osoba_id),
      prawo_glosu: 0,
      // Zajecie z natury blokuje rozporzadzanie akcja.
      blokuje_rozporzadzanie: 1,
      opis: d.opis || null,
      zdarzenie_ustanowienia_id: Number(zdarzenie.id),
      data_od: zdarzenie.data_zdarzenia,
      zdarzenie_wykreslenia_id: null,
      data_do: null,
    });
  },

  wykreslenie_obciazenia(stan, zdarzenie, d) {
    zamknijObciazenie(stan, zdarzenie, d);
  },

  wykreslenie_zajecia(stan, zdarzenie, d) {
    zamknijObciazenie(stan, zdarzenie, d);
  },

  /**
   * Wpis o prawie glosu zastawnika/uzytkownika (art. 300(33) § 1 pkt 7 KSH).
   * Zmienia atrybut ISTNIEJACEGO obciazenia - nie tworzy nowego rekordu.
   *
   * UPROSZCZENIE: `prawo_glosu` jest atrybutem BIEZACYM obciazenia, bez
   * wlasnej osi czasu (w odroznieniu od `data_od`/`data_do` calego
   * obciazenia). "Stan na dzien" z suwaka w kokpicie wiernie odtwarza SKLAD
   * akcjonariatu i to, KTORE akcje sa obciazone - nie odtwarza historycznej
   * wartosci samego prawa glosu sprzed jego zmiany. Uzasadnienie: to atrybut
   * pomocniczy przy obciazeniu, nie fakt liczbowy wymagajacy odtwarzania
   * wstecz jak stan posiadania akcji (regula domenowa nr 3).
   */
  prawo_glosu_zastawnika(stan, zdarzenie, d) {
    const klucz = Number(d.obciazenie_zdarzenie_id);
    const cel = stan.obciazenia.find((o) => o.klucz === klucz && o.data_do === null);
    if (!cel) {
      throw new BladStanu(
        `Zdarzenie #${zdarzenie.id} dotyczy obciążenia, którego nie ma w rejestrze (zdarzenie #${klucz}).`
      );
    }
    cel.prawo_glosu = d.prawo_glosu ? 1 : 0;
  },

  uprawnienie(stan, zdarzenie, d) {
    if (d.wykresla_zdarzenie_id != null) {
      const cel = stan.uprawnienia.find((u) => u.klucz === Number(d.wykresla_zdarzenie_id));
      if (cel) {
        cel.status = 'wykreslone';
        cel.data_wykreslenia = zdarzenie.data_zdarzenia;
      }
      return;
    }
    stan.uprawnienia.push({
      klucz: Number(zdarzenie.id),
      rodzaj: d.rodzaj || 'uprawnienie',
      zakres: d.zakres || 'spolka',
      emisja_klucz: d.emisja_zdarzenie_id == null ? null : Number(d.emisja_zdarzenie_id),
      osoba_id: d.osoba_id == null ? null : Number(d.osoba_id),
      tytul: d.tytul || null,
      tresc: d.tresc || null,
      data_ustanowienia: zdarzenie.data_zdarzenia,
      zdarzenie_id: Number(zdarzenie.id),
      status: 'aktywne',
      data_wykreslenia: null,
    });
  },

  ograniczenie(stan, zdarzenie, d) {
    if (d.wykresla_zdarzenie_id != null) {
      const cel = stan.ograniczenia.find((o) => o.klucz === Number(d.wykresla_zdarzenie_id));
      if (cel) {
        cel.status = 'wykreslone';
        cel.data_wykreslenia = zdarzenie.data_zdarzenia;
      }
      return;
    }
    stan.ograniczenia.push({
      klucz: Number(zdarzenie.id),
      zakres: d.zakres || 'wszystkie',
      emisja_klucz: d.emisja_zdarzenie_id == null ? null : Number(d.emisja_zdarzenie_id),
      zakresy: d.zakresy ? n.normalizuj(d.zakresy) : [],
      wymaga_zgody_spolki: d.wymaga_zgody_spolki ? 1 : 0,
      prawo_pierwszenstwa: d.prawo_pierwszenstwa ? 1 : 0,
      opis: d.opis || null,
      zdarzenie_id: Number(zdarzenie.id),
      status: 'aktywne',
      data_wykreslenia: null,
    });
  },
};

function zamknijObciazenie(stan, zdarzenie, d) {
  const klucz = Number(d.obciazenie_zdarzenie_id);
  const cel = stan.obciazenia.find((o) => o.klucz === klucz && o.data_do === null);
  if (!cel) {
    throw new BladStanu(
      `Zdarzenie #${zdarzenie.id} wykreśla obciążenie, którego nie ma w rejestrze (zdarzenie #${klucz}).`
    );
  }
  cel.data_do = zdarzenie.data_zdarzenia;
  cel.zdarzenie_wykreslenia_id = Number(zdarzenie.id);
}

/**
 * Typy, ktore nie zmieniaja struktur rejestru - trafiaja na os czasu.
 * `zmiana_danych_akcjonariusza` zmienia rekord `psa_osoby` (efekt uboczny
 * poza materializacja stanu akcji, patrz `rejestr.js`), ale samego stanu
 * akcji nie dotyka - stad tez trafia na os czasu bez skutku strukturalnego.
 */
const TYPY_BEZ_SKUTKU = new Set([
  'zmiana_danych_akcjonariusza',
  'zmiana_danych_spolki',
  'zobowiazanie',
  'zdarzenie_inne',
]);

// ─────────────────────────────────────────────────────────────
// Wejscie glowne
// ─────────────────────────────────────────────────────────────

/**
 * Odtwarza pelny stan rejestru z listy zdarzen jednej spolki.
 *
 * Zdarzenia `sprostowanie` z tresc±a `zamiast` PODMIENIAJA tresc zdarzenia
 * prostowanego DOKLADNIE W JEGO POZYCJI chronologicznej - nie wstawiamy ich
 * osobno pod ich wlasnym ID. Dwa powody:
 *   1. klucz struktury, ktora tworzy zdarzenie (np. HANDLERY.emisja:
 *      `klucz: Number(zdarzenie.id)`), musi zostac STABILNY - pozniejsze
 *      zdarzenia (np. `objecie`) odwoluja sie do niego przez ID PIERWOTNEGO
 *      zdarzenia, nie sprostowania;
 *   2. zdarzenia miedzy oryginalem a sprostowaniem (ktore czesto ma pozniejszy
 *      ID przy tej samej `data_zdarzenia`) musza "widziec" juz skorygowana
 *      strukture, inaczej korekta przychodzi za pozno w kolejnosci przetwarzania.
 * Sprostowanie BEZ `zamiast` jest pelnym wycofaniem zdarzenia pierwotnego
 * (nie ma czym go zastapic). Nic nie jest kasowane - wszystkie zdarzenia
 * zostaja w lancuchu, samo sprostowanie trafia na os czasu.
 */
function odtworzStan(zdarzenia) {
  const stan = pustyStan();
  const lista = [...(zdarzenia || [])].sort(porownajZdarzenia);

  const podmiany = new Map(); // ID prostowanego zdarzenia -> { typ, tresc }
  const wycofane = new Set(); // ID prostowanego zdarzenia bez tresci zastepczej
  for (const z of lista) {
    if (z.typ !== 'sprostowanie' || z.zdarzenie_prostowane_id == null) continue;
    const d = dane(z);
    if (d.zamiast && d.zamiast.typ) {
      podmiany.set(Number(z.zdarzenie_prostowane_id), { typ: d.zamiast.typ, tresc: d.zamiast });
    } else {
      wycofane.add(Number(z.zdarzenie_prostowane_id));
    }
  }

  for (const zdarzenie of lista) {
    const id = Number(zdarzenie.id);

    if (zdarzenie.typ === 'sprostowanie') {
      // Skutek (jesli jest) zostal juz zastosowany w miejscu zdarzenia
      // prostowanego, powyzej - samo sprostowanie idzie tylko na os czasu.
      stan.pozostale.push(zdarzenie);
      continue;
    }

    if (wycofane.has(id)) {
      stan.pozostale.push({ ...zdarzenie, pominiete: true, powod: 'wycofane sprostowaniem' });
      continue;
    }

    const podmiana = podmiany.get(id);
    const typ = podmiana ? podmiana.typ : zdarzenie.typ;
    const tresc = podmiana ? podmiana.tresc : dane(zdarzenie);

    if (TYPY_BEZ_SKUTKU.has(typ)) {
      stan.pozostale.push(zdarzenie);
      continue;
    }

    const handler = HANDLERY[typ];
    if (!handler) {
      throw new BladStanu(`Nieznany typ zdarzenia „${typ}” (zdarzenie #${zdarzenie.id}).`);
    }
    handler(stan, zdarzenie, tresc);
  }

  scal(stan);
  return stan;
}

/**
 * Sprawdza regule domenowa nr 3: otwarte przedzialy kazdej serii pokrywaja
 * zakres emisji szczelnie i bez nakladania. Zwraca liste bledow (pusta = OK).
 */
function sprawdzBilans(stan) {
  const bledy = [];
  for (const emisja of stan.emisje) {
    const zakresEmisji = n.zakresEmisji(emisja);
    const przedzialy = otwarte(stan).filter((p) => p.emisja_klucz === emisja.klucz);
    const jako = (kat) =>
      n.normalizuj(
        przedzialy.filter((p) => p.kategoria === kat).map((p) => ({ nr_od: p.nr_od, nr_do: p.nr_do }))
      );

    const nieobjete = jako(K.NIEOBJETA);
    const przypisane = jako(K.AKCJONARIUSZ);
    const umorzone = jako(K.UMORZONA);

    // Nakladanie sie kategorii.
    const pary = [
      ['nieobjęte', nieobjete, 'przypisane akcjonariuszom', przypisane],
      ['nieobjęte', nieobjete, 'umorzone', umorzone],
      ['przypisane akcjonariuszom', przypisane, 'umorzone', umorzone],
    ];
    for (const [nazwaA, a, nazwaB, b] of pary) {
      const wspolne = n.przeciecie(a, b);
      if (wspolne.length > 0) {
        bledy.push(
          `Seria ${emisja.seria}: akcje ${n.opisz(wspolne)} są jednocześnie ${nazwaA} i ${nazwaB}.`
        );
      }
    }

    // Nakladanie sie akcjonariuszy miedzy soba.
    const wgOsoby = new Map();
    for (const p of przedzialy.filter((p) => p.kategoria === K.AKCJONARIUSZ)) {
      if (!wgOsoby.has(p.osoba_id)) wgOsoby.set(p.osoba_id, []);
      wgOsoby.get(p.osoba_id).push({ nr_od: p.nr_od, nr_do: p.nr_do });
    }
    const osoby = [...wgOsoby.entries()];
    for (let i = 0; i < osoby.length; i += 1) {
      for (let j = i + 1; j < osoby.length; j += 1) {
        const wspolne = n.przeciecie(osoby[i][1], osoby[j][1]);
        if (wspolne.length > 0) {
          bledy.push(
            `Seria ${emisja.seria}: akcje ${n.opisz(wspolne)} są przypisane jednocześnie dwóm akcjonariuszom ` +
              `(osoby #${osoby[i][0]} i #${osoby[j][0]}).`
          );
        }
      }
    }

    // Szczelnosc pokrycia.
    const razem = n.suma(n.suma(nieobjete, przypisane), umorzone);
    const brakujace = n.roznica(zakresEmisji, razem);
    if (brakujace.length > 0) {
      bledy.push(
        `Seria ${emisja.seria}: akcje ${n.opisz(brakujace)} wypadły z rejestru — ` +
          `nie są ani nieobjęte, ani przypisane, ani umorzone.`
      );
    }
    const nadmiarowe = n.roznica(razem, zakresEmisji);
    if (nadmiarowe.length > 0) {
      bledy.push(
        `Seria ${emisja.seria}: akcje ${n.opisz(nadmiarowe)} są w rejestrze, ` +
          `mimo że wykraczają poza zakres emisji ${n.opisz(zakresEmisji)}.`
      );
    }

    // Kontrola liczbowa - art. 300(31) § 3 KSH.
    const suma = n.ilosc(nieobjete) + n.ilosc(przypisane) + n.ilosc(umorzone);
    if (suma !== emisja.ilosc) {
      bledy.push(
        `Seria ${emisja.seria}: suma akcji w rejestrze (${suma}) nie odpowiada liczbie wyemitowanych (${emisja.ilosc}).`
      );
    }
  }
  return bledy;
}

// ─────────────────────────────────────────────────────────────
// Widoki stanu
// ─────────────────────────────────────────────────────────────

/** Przedzialy obowiazujace na dzien `data` (YYYY-MM-DD). */
function przedzialyNaDzien(stan, data) {
  const d = String(data).slice(0, 10);
  return stan.przedzialy.filter((p) => p.data_od <= d && (p.data_do === null || p.data_do > d));
}

/** Obciazenia obowiazujace na dzien `data`. */
function obciazeniaNaDzien(stan, data) {
  const d = String(data).slice(0, 10);
  return stan.obciazenia.filter((o) => o.data_od <= d && (o.data_do === null || o.data_do > d));
}

/**
 * Akcjonariat na dany dzien: pozycje pogrupowane po (osoba, emisja),
 * z zakresami numerow, iloscia i znacznikami obciazen.
 *
 * `procent` liczymy od ogolnej liczby akcji PRZYPISANYCH akcjonariuszom
 * (bez nieobjetych i umorzonych) - w P.S.A. akcje nie maja wartosci
 * nominalnej, wiec udzial wyraza sie liczba akcji, nie kapitalem.
 */
function akcjonariatNaDzien(stan, data) {
  const przedzialy = przedzialyNaDzien(stan, data).filter((p) => p.kategoria === K.AKCJONARIUSZ);
  const obciazenia = obciazeniaNaDzien(stan, data);
  const emisjeWgKlucza = new Map(stan.emisje.map((e) => [e.klucz, e]));

  const grupy = new Map();
  for (const p of przedzialy) {
    const klucz = `${p.osoba_id}|${p.emisja_klucz}`;
    if (!grupy.has(klucz)) {
      grupy.set(klucz, {
        osoba_id: p.osoba_id,
        emisja_klucz: p.emisja_klucz,
        seria: emisjeWgKlucza.get(p.emisja_klucz)?.seria || null,
        zakresy: [],
        data_najstarszego_nabycia: p.data_od,
      });
    }
    const g = grupy.get(klucz);
    g.zakresy.push({ nr_od: p.nr_od, nr_do: p.nr_do });
    if (p.data_od < g.data_najstarszego_nabycia) g.data_najstarszego_nabycia = p.data_od;
  }

  const pozycje = [...grupy.values()].map((g) => {
    const zakresy = n.normalizuj(g.zakresy);
    const moje = obciazenia
      .filter((o) => o.emisja_klucz === g.emisja_klucz && n.nakladaja(o.zakresy, zakresy))
      .map((o) => ({
        typ: o.typ,
        zakresy: n.przeciecie(o.zakresy, zakresy),
        prawo_glosu: o.prawo_glosu,
        blokuje_rozporzadzanie: o.blokuje_rozporzadzanie,
        osoba_id: o.osoba_id,
        opis: o.opis,
      }));
    return {
      ...g,
      zakresy,
      ilosc: n.ilosc(zakresy),
      obciazenia: moje,
    };
  });

  const razem = pozycje.reduce((s, p) => s + p.ilosc, 0);
  for (const p of pozycje) {
    p.procent = razem === 0 ? 0 : (p.ilosc / razem) * 100;
  }

  pozycje.sort((a, b) => b.ilosc - a.ilosc || String(a.seria).localeCompare(String(b.seria), 'pl'));
  return { pozycje, razem_akcji: razem };
}

/** Podsumowanie serii na dany dzien - do kontroli z art. 300(31) § 3 KSH. */
function bilansNaDzien(stan, data) {
  const przedzialy = przedzialyNaDzien(stan, data);
  return stan.emisje.map((e) => {
    const jako = (kat) =>
      n.normalizuj(
        przedzialy
          .filter((p) => p.emisja_klucz === e.klucz && p.kategoria === kat)
          .map((p) => ({ nr_od: p.nr_od, nr_do: p.nr_do }))
      );
    const nieobjete = jako(K.NIEOBJETA);
    const przypisane = jako(K.AKCJONARIUSZ);
    const umorzone = jako(K.UMORZONA);
    return {
      emisja_klucz: e.klucz,
      seria: e.seria,
      wyemitowane: e.ilosc,
      nieobjete: n.ilosc(nieobjete),
      nieobjete_zakresy: nieobjete,
      przypisane: n.ilosc(przypisane),
      umorzone: n.ilosc(umorzone),
      umorzone_zakresy: umorzone,
      w_obrocie: e.ilosc - n.ilosc(umorzone),
    };
  });
}

/** Data ostatniego zdarzenia dotykajacego wskazanych akcji - kontrola chronologii. */
function ostatniaDataNaAkcjach(stan, emisjaKlucz, zakresy) {
  let max = null;
  const dotyka = (p) =>
    p.emisja_klucz === emisjaKlucz &&
    n.nakladaja([{ nr_od: p.nr_od, nr_do: p.nr_do }], zakresy);
  for (const p of stan.przedzialy) {
    if (!dotyka(p)) continue;
    for (const d of [p.data_od, p.data_do]) {
      if (d && (max === null || d > max)) max = d;
    }
  }
  return max;
}

module.exports = {
  BladStanu,
  odtworzStan,
  sprawdzBilans,
  przedzialyNaDzien,
  obciazeniaNaDzien,
  akcjonariatNaDzien,
  bilansNaDzien,
  ostatniaDataNaAkcjach,
  pula,
  otwarte,
  znajdzEmisje,
  porownajZdarzenia,
  KATEGORIE: K,
};
