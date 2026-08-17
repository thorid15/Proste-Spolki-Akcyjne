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
const u = require('./ulamki');
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

/**
 * Zakresy dostepne w danej puli (suma otwartych przedzialow) - DO ZWYKLYCH
 * operacji calo-akcyjnych (objecie/przeniesienie/umorzenie/obciazenie/zajecie).
 *
 * Wyklucza wiersze ulamkowe (czesc != 1/1): wspoluprawniony do 1/3 akcji nie
 * moze rozporzadzac nia tak, jakby mial cala - do tego sluzy WYLACZNIE
 * `przeniesienie_ulamka` (regula domenowa 4a, scope-narrowing decyzja
 * architektoniczna sprintu 5 - patrz README).
 */
function pula(stan, emisjaKlucz, kategoria, osobaId) {
  return n.normalizuj(
    przedzialyPuli(stan, emisjaKlucz, kategoria, osobaId)
      .filter((p) => (p.czesc_licznik ?? 1) === (p.czesc_mianownik ?? 1))
      .map((p) => ({
        nr_od: p.nr_od,
        nr_do: p.nr_do,
      }))
  );
}

/** Suma ulamkow, jakie dana osoba posiada na WSKAZANYM (pojedynczym) numerze akcji. */
function ulamekOsobyNaNumerze(stan, emisjaKlucz, osobaId, nr) {
  const wiersze = otwarte(stan).filter(
    (p) =>
      p.emisja_klucz === emisjaKlucz &&
      p.kategoria === K.AKCJONARIUSZ &&
      Number(p.osoba_id) === Number(osobaId) &&
      p.nr_od <= nr &&
      nr <= p.nr_do
  );
  let suma = u.ZERO;
  for (const w of wiersze) {
    suma = u.suma(suma, { licznik: w.czesc_licznik ?? 1, mianownik: w.czesc_mianownik ?? 1 });
  }
  return suma;
}

function otworz(
  stan,
  { emisjaKlucz, kategoria, osobaId, zakresy, data, zdarzenieId, tytul, czesc, przedstawiciel, pokryta }
) {
  const cz = czesc ? u.waliduj(czesc) : u.JEDEN;
  const znormalizowane = n.normalizuj(zakresy);
  if (!u.jestJeden(cz) && (znormalizowane.length !== 1 || znormalizowane[0].nr_od !== znormalizowane[0].nr_do)) {
    throw new BladStanu(
      `Ułamek akcji ${u.opisz(cz)} musi obejmować dokładnie jeden numer akcji (regula domenowa 4a).`
    );
  }
  for (const z of znormalizowane) {
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
      czesc_licznik: cz.licznik,
      czesc_mianownik: cz.mianownik,
      przedstawiciel_osoba_id: przedstawiciel == null ? null : Number(przedstawiciel),
      pokryta: pokryta || null,
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
    pokryta: opcje.pokryta,
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
      // art. 300(30) § 2 KSH: NULL dopoki emisja nie ma wpisu do KRS - blokuje
      // `objecie` (regula domenowa 12, walidacje.js).
      data_wpisu_krs: d.data_wpisu_krs || null,
      // art. 300(33) § 1 pkt 4 KSH.
      rodzaj_akcji: d.rodzaj_akcji || 'zwykla',
      // art. 300(33) § 1 pkt 11 KSH.
      obowiazki_wobec_spolki: d.obowiazki_wobec_spolki || null,
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
        // art. 300(33) § 1 pkt 9 KSH - wzmianka o pokryciu; NULL (nieustalone)
        // dopoki nie dojdzie osobne zdarzenie `pokrycie_akcji` na podstawie
        // uchwaly zarzadu (art. 300(9) § 2 KSH).
        pokryta: poz.pokryta || null,
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

  /**
   * Uniewaznienie akcji ORZECZENIEM SADU (art. 300(51) KSH) - za niewykonanie
   * albo nienalezyte wykonanie zobowiazania do wniesienia wkladow.
   *
   * Mechanika przejscia jest ta sama co przy umorzeniu (akcje trwale
   * wychodza z obrotu, zostajac w bilansie serii), ale kategoria docelowa
   * jest ODREBNA. Nie wolno tego zlewac z umorzeniem: umorzenie jest
   * czynnoscia SPOLKI (uchwala, zmiana umowy spolki, splata - art. 300(44)
   * i 300(45)), uniewaznienie jest orzeczeniem SADU, bez splaty i bez zmiany
   * umowy spolki. Rejestr i wydruk dla sadu musza je rozroznic.
   */
  uniewaznienie(stan, zdarzenie, d) {
    const emisja = emisjaZeZdarzenia(stan, d, zdarzenie);
    for (const poz of d.pozycje || []) {
      const zKategorii = poz.osoba_id == null ? K.NIEOBJETA : K.AKCJONARIUSZ;
      przenies(stan, {
        emisjaKlucz: emisja.klucz,
        zKategorii,
        zOsoby: poz.osoba_id == null ? null : Number(poz.osoba_id),
        doKategorii: K.UNIEWAZNIONA,
        doOsoby: null,
        zakresy: poz.zakresy,
        data: zdarzenie.data_zdarzenia,
        zdarzenieId: Number(zdarzenie.id),
        tytul: 'unieważnienie orzeczeniem sądu',
      });
    }
  },

  /**
   * Przeniesienie ulamkowej czesci OZNACZONEJ akcji (art. 300(43) KSH).
   * JEDYNA droga tworzenia i przenoszenia ulamkow (regula domenowa 4a) - nie
   * przechodzi przez `przenies`/`pula`, bo te licza w calych numerach.
   *
   * Zamyka CALA dotychczasowa pozycje zbywcy na numerze `nr` (jakikolwiek by
   * nie byl jej ulamek - czesc szerszego zakresu 1/1 albo juz istniejacy
   * wiersz ulamkowy), po czym otwiera z powrotem to, co zbywcy zostaje.
   * Nabywca dostaje sume swojego dotychczasowego ulamka na tym numerze
   * (0, gdy jeszcze nic nie mial) i ulamka nabywanego.
   */
  przeniesienie_ulamka(stan, zdarzenie, d) {
    const emisja = emisjaZeZdarzenia(stan, d, zdarzenie);
    const nr = Number(d.nr);
    const zbywcaId = Number(d.zbywca_osoba_id);
    const nabywcaId = Number(d.nabywca_osoba_id);
    const czesc = u.waliduj({ licznik: d.czesc_licznik, mianownik: d.czesc_mianownik });

    const zbywcaMa = ulamekOsobyNaNumerze(stan, emisja.klucz, zbywcaId, nr);
    if (!u.mniejszyRowny(czesc, zbywcaMa)) {
      throw new BladStanu(
        `Zbywca posiada ${u.opisz(zbywcaMa)} akcji nr ${nr} serii ${emisja.seria} — ` +
          `nie może zbyć ${u.opisz(czesc)} (zdarzenie #${zdarzenie.id}).`
      );
    }
    // Pokrycie (art. 300(33) § 1 pkt 9 KSH) jest atrybutem SAMEJ AKCJI (wklad
    // juz wniesiony do spolki), nie osoby - przechodzi wraz z ulamkiem
    // niezmienione, zarowno na czesc, ktora zostaje u zbywcy, jak i na czesc
    // nabywana.
    const pokrytaObecnie =
      (otwarte(stan).find(
        (p) => p.emisja_klucz === emisja.klucz && p.kategoria === K.AKCJONARIUSZ && Number(p.osoba_id) === zbywcaId && p.nr_od <= nr && nr <= p.nr_do
      ) || {}).pokryta ?? null;

    zdejmij(stan, {
      emisjaKlucz: emisja.klucz,
      kategoria: K.AKCJONARIUSZ,
      osobaId: zbywcaId,
      zakresy: [{ nr_od: nr, nr_do: nr }],
      data: zdarzenie.data_zdarzenia,
      zdarzenieId: Number(zdarzenie.id),
    });
    const zostajeZbywcy = u.roznica(zbywcaMa, czesc);
    if (!u.jestZero(zostajeZbywcy)) {
      otworz(stan, {
        emisjaKlucz: emisja.klucz,
        kategoria: K.AKCJONARIUSZ,
        osobaId: zbywcaId,
        zakresy: [{ nr_od: nr, nr_do: nr }],
        data: zdarzenie.data_zdarzenia,
        zdarzenieId: Number(zdarzenie.id),
        tytul: 'pozostała część po przeniesieniu ułamka',
        czesc: zostajeZbywcy,
        pokryta: pokrytaObecnie,
      });
    }

    const nabywcaMialJuz = ulamekOsobyNaNumerze(stan, emisja.klucz, nabywcaId, nr);
    if (!u.jestZero(nabywcaMialJuz)) {
      zdejmij(stan, {
        emisjaKlucz: emisja.klucz,
        kategoria: K.AKCJONARIUSZ,
        osobaId: nabywcaId,
        zakresy: [{ nr_od: nr, nr_do: nr }],
        data: zdarzenie.data_zdarzenia,
        zdarzenieId: Number(zdarzenie.id),
      });
    }
    otworz(stan, {
      emisjaKlucz: emisja.klucz,
      kategoria: K.AKCJONARIUSZ,
      osobaId: nabywcaId,
      zakresy: [{ nr_od: nr, nr_do: nr }],
      data: zdarzenie.data_zdarzenia,
      zdarzenieId: Number(zdarzenie.id),
      tytul: d.tytul_prawny || 'przeniesienie ułamkowej części akcji',
      czesc: u.suma(nabywcaMialJuz, czesc),
      pokryta: pokrytaObecnie,
    });
  },

  /** Wskazanie/zmiana wspolnego przedstawiciela wspoluprawnionych (art. 300(38) § 3 KSH). */
  przedstawiciel(stan, zdarzenie, d) {
    const emisja = emisjaZeZdarzenia(stan, d, zdarzenie);
    const nr = Number(d.nr);
    const przedstawicielId = d.przedstawiciel_osoba_id == null ? null : Number(d.przedstawiciel_osoba_id);
    const wiersze = otwarte(stan).filter(
      (p) => p.emisja_klucz === emisja.klucz && p.kategoria === K.AKCJONARIUSZ && p.nr_od <= nr && nr <= p.nr_do
    );
    if (wiersze.length === 0) {
      throw new BladStanu(
        `Zdarzenie #${zdarzenie.id}: akcja nr ${nr} serii ${emisja.seria} nie ma obecnie żadnego uprawnionego.`
      );
    }
    for (const w of wiersze) w.przedstawiciel_osoba_id = przedstawicielId;
  },

  /**
   * Wzmianka o pokryciu (art. 300(33) § 1 pkt 9 KSH) - podstawa: uchwala
   * zarzadu z art. 300(9) § 2 KSH. Zaliczana rownomiernie na wszystkie akcje
   * akcjonariusza W TEJ EMISJI (art. 300(9) § 3 KSH) - stad zakres zdarzenia
   * to (emisja, osoba), nie pojedynczy numer.
   */
  pokrycie_akcji(stan, zdarzenie, d) {
    const emisja = emisjaZeZdarzenia(stan, d, zdarzenie);
    const osobaId = Number(d.osoba_id);
    const wiersze = otwarte(stan).filter(
      (p) => p.emisja_klucz === emisja.klucz && p.kategoria === K.AKCJONARIUSZ && Number(p.osoba_id) === osobaId
    );
    if (wiersze.length === 0) {
      throw new BladStanu(
        `Zdarzenie #${zdarzenie.id}: wskazany akcjonariusz nie posiada akcji emisji ${emisja.seria}.`
      );
    }
    for (const w of wiersze) w.pokryta = d.pokryta;
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
      zgoda_termin_wskazania_dni: d.zgoda_termin_wskazania_dni ?? null,
      zgoda_cena_opis: d.zgoda_cena_opis ?? null,
      zgoda_termin_zaplaty_dni: d.zgoda_termin_zaplaty_dni ?? null,
      tresc_postanowienia: d.tresc_postanowienia || null,
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
    const uniewaznione = jako(K.UNIEWAZNIONA);

    // Nakladanie sie kategorii - kazda para musi byc rozlaczna.
    const pary = [
      ['nieobjęte', nieobjete, 'przypisane akcjonariuszom', przypisane],
      ['nieobjęte', nieobjete, 'umorzone', umorzone],
      ['nieobjęte', nieobjete, 'unieważnione', uniewaznione],
      ['przypisane akcjonariuszom', przypisane, 'umorzone', umorzone],
      ['przypisane akcjonariuszom', przypisane, 'unieważnione', uniewaznione],
      ['umorzone', umorzone, 'unieważnione', uniewaznione],
    ];
    for (const [nazwaA, a, nazwaB, b] of pary) {
      const wspolne = n.przeciecie(a, b);
      if (wspolne.length > 0) {
        bledy.push(
          `Seria ${emisja.seria}: akcje ${n.opisz(wspolne)} są jednocześnie ${nazwaA} i ${nazwaB}.`
        );
      }
    }

    // Nakladanie sie akcjonariuszy miedzy soba - DOZWOLONE wylacznie jako
    // wspoluprawnienie do JEDNEGO numeru akcji, gdy ulamki wszystkich
    // wspoluprawnionych sumuja sie dokladnie do 1 (regula domenowa 3 + 4a,
    // art. 300(31) § 2 KSH). Zakres nakladania sie szerszy niz jeden numer
    // jest zawsze bledem - poprawny wiersz ulamkowy obejmuje dokladnie jeden
    // numer (CHECK w schemacie), wiec taki przypadek nie moze byc
    // wspolwlasnoscia.
    const wgOsoby = new Map();
    for (const p of przedzialy.filter((p) => p.kategoria === K.AKCJONARIUSZ)) {
      if (!wgOsoby.has(p.osoba_id)) wgOsoby.set(p.osoba_id, []);
      wgOsoby.get(p.osoba_id).push({ nr_od: p.nr_od, nr_do: p.nr_do });
    }
    const osoby = [...wgOsoby.entries()];
    const numeryDoSprawdzeniaUlamkow = new Set();
    for (let i = 0; i < osoby.length; i += 1) {
      for (let j = i + 1; j < osoby.length; j += 1) {
        const wspolne = n.przeciecie(osoby[i][1], osoby[j][1]);
        for (const w of wspolne) {
          if (w.nr_od !== w.nr_do) {
            bledy.push(
              `Seria ${emisja.seria}: akcje ${n.opisz([w])} są przypisane jednocześnie dwóm akcjonariuszom ` +
                `(osoby #${osoby[i][0]} i #${osoby[j][0]}) poza ramami dopuszczalnej współwłasności ` +
                `(obejmuje więcej niż jeden numer akcji).`
            );
          } else {
            numeryDoSprawdzeniaUlamkow.add(w.nr_od);
          }
        }
      }
    }
    for (const nr of numeryDoSprawdzeniaUlamkow) {
      const wlasciciele = przedzialy.filter(
        (p) => p.kategoria === K.AKCJONARIUSZ && p.nr_od <= nr && nr <= p.nr_do
      );
      let sumaUlamkow = u.ZERO;
      for (const w of wlasciciele) {
        sumaUlamkow = u.suma(sumaUlamkow, { licznik: w.czesc_licznik ?? 1, mianownik: w.czesc_mianownik ?? 1 });
      }
      if (!u.rowne(sumaUlamkow, u.JEDEN)) {
        bledy.push(
          `Seria ${emisja.seria}: suma ułamków współuprawnionych do akcji nr ${nr} wynosi ${u.opisz(sumaUlamkow)}, ` +
            `a powinna wynosić dokładnie 1 (art. 300(31) § 2 KSH).`
        );
      }
    }

    // Szczelnosc pokrycia.
    const razem = n.suma(n.suma(n.suma(nieobjete, przypisane), umorzone), uniewaznione);
    const brakujace = n.roznica(zakresEmisji, razem);
    if (brakujace.length > 0) {
      bledy.push(
        `Seria ${emisja.seria}: akcje ${n.opisz(brakujace)} wypadły z rejestru — ` +
          `nie są ani nieobjęte, ani przypisane, ani umorzone, ani unieważnione.`
      );
    }
    const nadmiarowe = n.roznica(razem, zakresEmisji);
    if (nadmiarowe.length > 0) {
      bledy.push(
        `Seria ${emisja.seria}: akcje ${n.opisz(nadmiarowe)} są w rejestrze, ` +
          `mimo że wykraczają poza zakres emisji ${n.opisz(zakresEmisji)}.`
      );
    }

    // Kontrola liczbowa - art. 300(31) § 2 KSH.
    const suma =
      n.ilosc(nieobjete) + n.ilosc(przypisane) + n.ilosc(umorzone) + n.ilosc(uniewaznione);
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
  // `data === null` - bez filtra po dacie: bierzemy doslownie to, co jest
  // otwarte w `stan` (uzywane przy „stan na" z dokladnoscia do minuty -
  // sekcja 2.3 SESJA-PSA-5-INTERFEJS.md - gdzie `stan` juz jest zbudowany
  // WYLACZNIE ze zdarzen wpisanych do zadanej chwili, wiec dodatkowy filtr
  // po `data_zdarzenia` bylby drugim, kolidujacym wymiarem czasu).
  if (data === null) return otwarte(stan);
  const d = String(data).slice(0, 10);
  return stan.przedzialy.filter((p) => p.data_od <= d && (p.data_do === null || p.data_do > d));
}

/** Obciazenia obowiazujace na dzien `data` (`null` = bez filtra, patrz `przedzialyNaDzien`). */
function obciazeniaNaDzien(stan, data) {
  if (data === null) return stan.obciazenia.filter((o) => o.data_do === null);
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
        // Wiersze ulamkowe (czesc != 1/1) - surowe dane per numer, zeby
        // warstwa prezentacji (sprint 6) mogla policzyc dokladny udzial bez
        // odgadywania z samych zakresow. Domenowo wystarczy, ze sa QUERYOWALNE
        // (regula domenowa 4a: "procent zaokraglany WYLACZNIE przy wyswietlaniu").
        czesci_ulamkowe: [],
        data_najstarszego_nabycia: p.data_od,
      });
    }
    const g = grupy.get(klucz);
    g.zakresy.push({ nr_od: p.nr_od, nr_do: p.nr_do });
    if ((p.czesc_licznik ?? 1) !== (p.czesc_mianownik ?? 1)) {
      g.czesci_ulamkowe.push({
        nr: p.nr_od,
        czesc_licznik: p.czesc_licznik,
        czesc_mianownik: p.czesc_mianownik,
        przedstawiciel_osoba_id: p.przedstawiciel_osoba_id ?? null,
      });
    }
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
      // UWAGA: `ilosc` liczy numery akcji DOTKNIETE (choc czesciowo) - dla
      // wiersza ulamkowego to nadal "1 numer", nie ulamek. Dokladny udzial
      // wymierny jest w `czesci_ulamkowe`. Precyzyjne przeliczenie procentu
      // na podstawie ulamkow to zadanie warstwy prezentacji (sprint 6).
      ilosc: n.ilosc(zakresy),
      wspolwlasnosc: g.czesci_ulamkowe.length > 0,
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

/** Podsumowanie serii na dany dzien - do kontroli z art. 300(31) § 2 KSH. */
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
    const uniewaznione = jako(K.UNIEWAZNIONA);
    return {
      emisja_klucz: e.klucz,
      seria: e.seria,
      wyemitowane: e.ilosc,
      nieobjete: n.ilosc(nieobjete),
      nieobjete_zakresy: nieobjete,
      przypisane: n.ilosc(przypisane),
      umorzone: n.ilosc(umorzone),
      umorzone_zakresy: umorzone,
      uniewaznione: n.ilosc(uniewaznione),
      uniewaznione_zakresy: uniewaznione,
      // Poza obrotem sa i umorzone, i uniewaznione - roznica miedzy nimi jest
      // prawna (uchwala spolki vs orzeczenie sadu), nie bilansowa.
      w_obrocie: e.ilosc - n.ilosc(umorzone) - n.ilosc(uniewaznione),
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
  ulamekOsobyNaNumerze,
  otwarte,
  znajdzEmisje,
  porownajZdarzenia,
  KATEGORIE: K,
};
