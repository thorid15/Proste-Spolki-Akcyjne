'use strict';

/**
 * Algebra zakresow numerow akcji.
 *
 * Regula domenowa nr 4: numery akcji przydziela APLIKACJA. Uzytkownik podaje
 * wylacznie ilosc. Algorytm: FIFO po najnizszym wolnym numerze w serii,
 * z mozliwoscia recznego nadpisania zakresu (rzadki przypadek - np.
 * przeniesienie konkretnych obciazonych akcji).
 *
 * Zakres = { nr_od, nr_do } - obustronnie DOMKNIETY, numery calkowite >= 1.
 * Zbior zakresow trzymamy zawsze w postaci znormalizowanej: posortowany
 * rosnaco, bez nakladania sie, z polaczonymi zakresami przyleglymi.
 *
 * Modul jest czysty - brak dostepu do bazy, brak efektow ubocznych.
 */

/** Blad regul domenowych - komunikat po polsku, prosto do UI. */
class BladZakresu extends Error {
  constructor(komunikat) {
    super(komunikat);
    this.name = 'BladZakresu';
  }
}

function sprawdzZakres(z) {
  if (!z || typeof z !== 'object') {
    throw new BladZakresu('Zakres numerów musi być obiektem { nr_od, nr_do }.');
  }
  const od = Number(z.nr_od);
  const doN = Number(z.nr_do);
  if (!Number.isInteger(od) || !Number.isInteger(doN)) {
    throw new BladZakresu('Numery akcji muszą być liczbami całkowitymi.');
  }
  if (od < 1) {
    throw new BladZakresu('Numer akcji nie może być mniejszy niż 1.');
  }
  if (doN < od) {
    throw new BladZakresu(
      `Zakres numerów jest odwrócony: ${od}–${doN}. Numer końcowy musi być nie mniejszy niż początkowy.`
    );
  }
  return { nr_od: od, nr_do: doN };
}

/** Sortuje, scala nakladajace sie i przylegle zakresy. Zwraca nowa tablice. */
function normalizuj(zakresy) {
  const lista = (zakresy || []).map(sprawdzZakres).sort((a, b) => a.nr_od - b.nr_od || a.nr_do - b.nr_do);
  const wynik = [];
  for (const z of lista) {
    const ostatni = wynik[wynik.length - 1];
    // Scalamy takze zakresy przylegle (nr_do + 1 === nr_od), bo 1–5 i 6–10
    // to dokladnie to samo co 1–10.
    if (ostatni && z.nr_od <= ostatni.nr_do + 1) {
      ostatni.nr_do = Math.max(ostatni.nr_do, z.nr_do);
    } else {
      wynik.push({ nr_od: z.nr_od, nr_do: z.nr_do });
    }
  }
  return wynik;
}

/** Liczba akcji w zbiorze zakresow. */
function ilosc(zakresy) {
  return (zakresy || []).reduce((suma, z) => suma + (Number(z.nr_do) - Number(z.nr_od) + 1), 0);
}

/** Suma mnogosciowa (A ∪ B). */
function suma(a, b) {
  return normalizuj([...(a || []), ...(b || [])]);
}

/** Przeciecie (A ∩ B). */
function przeciecie(a, b) {
  const x = normalizuj(a);
  const y = normalizuj(b);
  const wynik = [];
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    const od = Math.max(x[i].nr_od, y[j].nr_od);
    const doN = Math.min(x[i].nr_do, y[j].nr_do);
    if (od <= doN) wynik.push({ nr_od: od, nr_do: doN });
    if (x[i].nr_do < y[j].nr_do) i += 1;
    else j += 1;
  }
  return normalizuj(wynik);
}

/** Roznica (A \ B). */
function roznica(a, b) {
  const odjemnik = normalizuj(b);
  let wynik = normalizuj(a);
  for (const o of odjemnik) {
    const nowy = [];
    for (const z of wynik) {
      if (o.nr_do < z.nr_od || o.nr_od > z.nr_do) {
        nowy.push(z);
        continue;
      }
      if (z.nr_od < o.nr_od) nowy.push({ nr_od: z.nr_od, nr_do: o.nr_od - 1 });
      if (z.nr_do > o.nr_do) nowy.push({ nr_od: o.nr_do + 1, nr_do: z.nr_do });
    }
    wynik = nowy;
  }
  return normalizuj(wynik);
}

/** Czy `podzbior` w calosci miesci sie w `zbior`. */
function zawiera(zbior, podzbior) {
  return roznica(podzbior, zbior).length === 0;
}

/** Czy zbiory maja czesc wspolna. */
function nakladaja(a, b) {
  return przeciecie(a, b).length > 0;
}

/**
 * Przydzial FIFO: bierze `ile` akcji od najnizszego wolnego numeru.
 * Zwraca znormalizowany zbior zakresow.
 *
 * Rzuca BladZakresu, gdy dostepnych akcji jest za malo - to blokada,
 * nie ostrzezenie (sekcja 16 specyfikacji).
 */
function przydzielFifo(dostepne, ile) {
  const liczba = Number(ile);
  if (!Number.isInteger(liczba) || liczba < 1) {
    throw new BladZakresu('Liczba akcji musi być dodatnią liczbą całkowitą.');
  }
  const pula = normalizuj(dostepne);
  const dostepnych = ilosc(pula);
  if (dostepnych < liczba) {
    throw new BladZakresu(
      `Brak pokrycia: żądano ${liczba} akcji, dostępnych jest ${dostepnych}.`
    );
  }
  const wynik = [];
  let pozostalo = liczba;
  for (const z of pula) {
    if (pozostalo === 0) break;
    const wZakresie = z.nr_do - z.nr_od + 1;
    const biore = Math.min(wZakresie, pozostalo);
    wynik.push({ nr_od: z.nr_od, nr_do: z.nr_od + biore - 1 });
    pozostalo -= biore;
  }
  return normalizuj(wynik);
}

/**
 * Reczne nadpisanie zakresu (sciezka rzadka - np. przeniesienie konkretnych
 * akcji obciazonych zastawem). Sprawdza, ze wskazane numery sa dostepne
 * i ze ich liczba zgadza sie z deklarowana iloscia.
 */
function przydzielWskazane(dostepne, zakresy, ile) {
  const wskazane = normalizuj(zakresy);
  if (wskazane.length === 0) {
    throw new BladZakresu('Nie wskazano żadnych numerów akcji.');
  }
  const pula = normalizuj(dostepne);
  const pozaPula = roznica(wskazane, pula);
  if (pozaPula.length > 0) {
    throw new BladZakresu(
      `Wskazane numery nie są dostępne: ${opisz(pozaPula)}. Dostępne: ${opisz(pula) || 'brak'}.`
    );
  }
  if (ile !== undefined && ile !== null && Number(ile) !== ilosc(wskazane)) {
    throw new BladZakresu(
      `Wskazany zakres obejmuje ${ilosc(wskazane)} akcji, a zadeklarowano ${Number(ile)}.`
    );
  }
  return wskazane;
}

/**
 * Jednolite wejscie dla kreatora: jesli podano `zakresy` - tryb reczny,
 * w przeciwnym razie FIFO po `ilosc`.
 */
function przydziel(dostepne, { ilosc: ile, zakresy } = {}) {
  if (Array.isArray(zakresy) && zakresy.length > 0) {
    return przydzielWskazane(dostepne, zakresy, ile);
  }
  return przydzielFifo(dostepne, ile);
}

/** Pelny zakres serii z parametrow emisji. */
function zakresEmisji({ nr_pierwszy, ilosc: ile }) {
  const od = Number(nr_pierwszy);
  const liczba = Number(ile);
  if (!Number.isInteger(od) || od < 1) {
    throw new BladZakresu('Numer pierwszej akcji emisji musi być liczbą całkowitą ≥ 1.');
  }
  if (!Number.isInteger(liczba) || liczba < 1) {
    throw new BladZakresu('Liczba akcji w emisji musi być dodatnią liczbą całkowitą.');
  }
  return [{ nr_od: od, nr_do: od + liczba - 1 }];
}

/** Czytelny zapis zakresow: "1–100, 150–160, 200". */
function opisz(zakresy) {
  return normalizuj(zakresy)
    .map((z) => (z.nr_od === z.nr_do ? String(z.nr_od) : `${z.nr_od}–${z.nr_do}`))
    .join(', ');
}

/**
 * Parsuje zapis reczny: "1-100, 150–160, 200" (akceptuje myslnik i polpauze).
 * Uzywane tylko w sciezce nadpisania zakresu.
 */
function parsuj(tekst) {
  const czesci = String(tekst || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const wynik = czesci.map((czesc) => {
    const m = czesc.match(/^(\d+)\s*(?:[-–—]\s*(\d+))?$/);
    if (!m) {
      throw new BladZakresu(
        `Nie rozumiem zapisu numerów: „${czesc}”. Poprawny format: „1-100, 150-160, 200”.`
      );
    }
    const od = Number(m[1]);
    return { nr_od: od, nr_do: m[2] === undefined ? od : Number(m[2]) };
  });
  return normalizuj(wynik);
}

module.exports = {
  BladZakresu,
  normalizuj,
  ilosc,
  suma,
  przeciecie,
  roznica,
  zawiera,
  nakladaja,
  przydzielFifo,
  przydzielWskazane,
  przydziel,
  zakresEmisji,
  opisz,
  parsuj,
};
