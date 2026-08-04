'use strict';

/**
 * Walidacje BLOKUJACE (sekcja 6 specyfikacji).
 *
 * Sekcja 16: "Nie ostrzegac tam, gdzie ma byc blokada". Wszystko, co trafia
 * do `bledy`, konczy zapis odmowa. `ostrzezenia` sa wylacznie informacja
 * dla weryfikujacego i nie wstrzymuja wpisu.
 *
 * Metoda: nie ufamy pojedynczym regulom - obok kontroli szczegolowych
 * (dajacych czytelny komunikat) odtwarzamy stan PO zdarzeniu i sprawdzamy
 * bilans calego rejestru. Zdarzenie przechodzi tylko wtedy, gdy obie
 * warstwy sa zgodne.
 */

const n = require('./numery');
const stanLogika = require('./stan');
const przepisy = require('./przepisy');
const typyZdarzen = require('./typy-zdarzen');

const K = przepisy.KATEGORIE_AKCJI;

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function dzisiajIso(dzisiaj) {
  return String(dzisiaj || new Date().toISOString().slice(0, 10)).slice(0, 10);
}

/**
 * Wszystkie zakresy dotkniete zdarzeniem, per emisja.
 * Zakresy niosa albo `dane.pozycje[].zakresy` (objecie/przeniesienie/umorzenie),
 * albo `dane.zakresy` wprost (obciazenie/zajecie - zdarzenie dotyczy jednej
 * pozycji, bez tablicy `pozycje`).
 */
function dotknieteZakresy(dane) {
  const wynik = new Map();
  const klucz = dane.emisja_zdarzenie_id == null ? null : Number(dane.emisja_zdarzenie_id);
  if (klucz == null) return wynik;
  const zPozycji = (dane.pozycje || []).flatMap((p) => p.zakresy || []);
  const zBezposrednio = Array.isArray(dane.zakresy) ? dane.zakresy : [];
  const zakresy = n.normalizuj([...zPozycji, ...zBezposrednio]);
  if (zakresy.length > 0) wynik.set(klucz, zakresy);
  return wynik;
}

// ─────────────────────────────────────────────────────────────
// Kontrole wspolne
// ─────────────────────────────────────────────────────────────

function sprawdzSpolke(spolka, bledy) {
  if (!spolka) {
    bledy.push('Nie odnaleziono spółki, której dotyczy zdarzenie.');
    return;
  }
  if (przepisy.STATUSY_SPOLKI_BLOKUJACE_WPIS.includes(spolka.status)) {
    bledy.push(
      `Spółka ma status „${spolka.status}” — do rejestru wykreślonej spółki nie dokonuje się wpisów.`
    );
  }
}

function sprawdzDate(propozycja, dzisiaj, bledy) {
  const data = String(propozycja.data_zdarzenia || '');
  if (!DATA_ISO.test(data)) {
    bledy.push('Data zdarzenia musi być podana w formacie RRRR-MM-DD.');
    return;
  }
  if (Number.isNaN(Date.parse(`${data}T00:00:00Z`))) {
    bledy.push(`Data zdarzenia „${data}” nie jest poprawną datą.`);
    return;
  }
  if (data > dzisiaj) {
    bledy.push(
      `Data zdarzenia (${data}) jest z przyszłości — rejestr odzwierciedla zdarzenia, które już zaszły.`
    );
  }
}

function sprawdzChronologie(stanPrzed, propozycja, bledy) {
  const data = String(propozycja.data_zdarzenia || '');
  if (!DATA_ISO.test(data)) return;
  for (const [emisjaKlucz, zakresy] of dotknieteZakresy(propozycja.dane)) {
    const ostatnia = stanLogika.ostatniaDataNaAkcjach(stanPrzed, emisjaKlucz, zakresy);
    if (ostatnia && data < ostatnia) {
      bledy.push(
        `Data zdarzenia (${data}) jest wcześniejsza niż ostatnie zdarzenie na akcjach ` +
          `${n.opisz(zakresy)} (${ostatnia}). Rejestr prowadzi się chronologicznie — ` +
          `wcześniejszy stan prostuje się zdarzeniem „sprostowanie”.`
      );
    }
  }
}

function sprawdzObciazenia(stanPrzed, propozycja, bledy) {
  // Zajecie jest z urzedu (art. 300(34) § 2 KSH) - nie jest "rozporzadzeniem"
  // akcja, wiec nie blokuje go istniejace obciazenie. Kilku wierzycieli moze
  // legalnie zajac te same akcje po kolei.
  if (propozycja.typ === 'zajecie') return;
  const data = String(propozycja.data_zdarzenia || '');
  for (const [emisjaKlucz, zakresy] of dotknieteZakresy(propozycja.dane)) {
    const blokujace = stanLogika
      .obciazeniaNaDzien(stanPrzed, data)
      .filter((o) => o.emisja_klucz === emisjaKlucz && o.blokuje_rozporzadzanie === 1);
    for (const o of blokujace) {
      const kolizja = n.przeciecie(o.zakresy, zakresy);
      if (kolizja.length === 0) continue;
      const nazwa = o.typ === 'zajecie' ? 'zajęciem' : `obciążeniem (${o.typ})`;
      bledy.push(
        `Akcje ${n.opisz(kolizja)} są objęte ${nazwa} blokującym rozporządzanie. ` +
          `Wpis wymaga uprzedniego wykreślenia obciążenia albo wskazania innych akcji.`
      );
    }
  }
}

function sprawdzOgraniczenia(stanPrzed, propozycja, bledy, ostrzezenia) {
  if (propozycja.typ !== 'przeniesienie') return;
  const dane = propozycja.dane || {};
  const emisjaKlucz = Number(dane.emisja_zdarzenie_id);
  const zakresy = n.normalizuj((dane.pozycje || []).flatMap((p) => p.zakresy || []));

  const aktywne = stanPrzed.ograniczenia.filter((o) => o.status === 'aktywne');
  for (const o of aktywne) {
    const dotyczy =
      o.zakres === 'wszystkie' ||
      (o.zakres === 'emisja' && o.emisja_klucz === emisjaKlucz) ||
      (o.zakres === 'zakres_numerow' &&
        o.emisja_klucz === emisjaKlucz &&
        n.nakladaja(o.zakresy, zakresy));
    if (!dotyczy) continue;

    if (o.wymaga_zgody_spolki && !dane.zgoda_spolki) {
      bledy.push(
        `Rozporządzenie akcjami wymaga zgody spółki (${przepisy.PODSTAWY.OGRANICZENIA_ROZPORZADZANIA})` +
          `${o.opis ? `: ${o.opis}` : ''}. Zgoda nie została odnotowana.`
      );
    }
    if (o.prawo_pierwszenstwa && !dane.pierwszenstwo_wyczerpane) {
      bledy.push(
        `Zarejestrowane jest prawo pierwszeństwa nabycia akcji` +
          `${o.opis ? `: ${o.opis}` : ''}. Nie odnotowano jego wyczerpania.`
      );
    }
    if (!o.wymaga_zgody_spolki && !o.prawo_pierwszenstwa) {
      ostrzezenia.push(
        `Na akcjach ciąży zarejestrowane ograniczenie w rozporządzaniu${o.opis ? `: ${o.opis}` : ''}. ` +
          `Sprawdź, czy nie stoi na przeszkodzie wpisowi.`
      );
    }
  }
}

/**
 * AML (notariusz jako instytucja obowiazana).
 * `niemozliwe` = przeszkoda wpisu -> blokada.
 * `brak`       = weryfikacja niewykonana -> ostrzezenie; checklista i tak
 *                nie pozwoli dokonac wpisu bez jej odhaczenia.
 */
function sprawdzAml(propozycja, osoby, bledy, ostrzezenia) {
  const dane = propozycja.dane || {};
  const nabywcy = new Set();
  if (propozycja.typ === 'objecie') {
    for (const p of dane.pozycje || []) if (p.osoba_id != null) nabywcy.add(Number(p.osoba_id));
  }
  if (propozycja.typ === 'przeniesienie') {
    for (const p of dane.pozycje || []) nabywcy.add(Number(p.nabywca_osoba_id));
  }
  // Obciazenie (zastaw/uzytkowanie) tworzy nowy tytul prawny do akcji na
  // rzecz zastawnika/uzytkownika - traktujemy go jak nabywce dla celow AML.
  // Zajecie jest z urzedu (organ egzekucyjny) - poza rezimem AML.
  if (propozycja.typ === 'obciazenie' && dane.osoba_id != null) {
    nabywcy.add(Number(dane.osoba_id));
  }

  for (const id of nabywcy) {
    const osoba = osoby.get(id);
    if (!osoba) continue;
    const nazwa = osoba.nazwa || [osoba.nazwisko, osoba.imie].filter(Boolean).join(' ') || `#${id}`;
    if (osoba.aml_status === przepisy.AML_STATUSY.NIEMOZLIWE) {
      bledy.push(
        `Wobec nabywcy „${nazwa}” odnotowano brak możliwości zastosowania środków bezpieczeństwa ` +
          `finansowego. To przeszkoda wpisu — przy jej nieusunięciu wpisu odmawia się.`
      );
    } else if (osoba.aml_status !== przepisy.AML_STATUS_WYMAGANY) {
      ostrzezenia.push(
        `Wobec nabywcy „${nazwa}” nie odnotowano wykonania środków bezpieczeństwa finansowego (AML).`
      );
    }
  }
}

function sprawdzOsoby(propozycja, osoby, bledy) {
  const dane = propozycja.dane || {};
  const wymagane = new Set();
  if (dane.zbywca_osoba_id != null) wymagane.add(Number(dane.zbywca_osoba_id));
  if (dane.osoba_id != null && dane.osoba_id !== '') wymagane.add(Number(dane.osoba_id));
  if (dane.akcjonariusz_osoba_id != null && dane.akcjonariusz_osoba_id !== '') {
    wymagane.add(Number(dane.akcjonariusz_osoba_id));
  }
  for (const p of dane.pozycje || []) {
    if (p.osoba_id != null) wymagane.add(Number(p.osoba_id));
    if (p.nabywca_osoba_id != null) wymagane.add(Number(p.nabywca_osoba_id));
  }
  for (const id of wymagane) {
    if (!osoby.has(id)) {
      bledy.push(`Osoba #${id} nie figuruje w kartotece — nie można jej wpisać do rejestru.`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Kontrole per typ
// ─────────────────────────────────────────────────────────────

const PER_TYP = {
  emisja(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    if (stanPrzed.emisje.some((e) => e.seria === d.seria)) {
      bledy.push(
        `Seria „${d.seria}” jest już zarejestrowana w tej spółce. Oznaczenie serii musi być niepowtarzalne.`
      );
    }
    if (!Number.isInteger(Number(d.ilosc)) || Number(d.ilosc) < 1) {
      bledy.push('Emisja musi obejmować co najmniej jedną akcję.');
    }
  },

  objecie(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    const emisja = stanLogika.znajdzEmisje(stanPrzed, Number(d.emisja_zdarzenie_id));
    if (!emisja) {
      bledy.push('Wskazana emisja nie istnieje w rejestrze tej spółki.');
      return;
    }
    const dostepne = stanLogika.pula(stanPrzed, emisja.klucz, K.NIEOBJETA, null);
    const zadane = n.normalizuj((d.pozycje || []).flatMap((p) => p.zakresy || []));
    const pozaPula = n.roznica(zadane, dostepne);
    if (pozaPula.length > 0) {
      bledy.push(
        `Akcje ${n.opisz(pozaPula)} serii ${emisja.seria} nie są dostępne do objęcia — ` +
          `zostały już objęte albo umorzone.`
      );
    }
    sprawdzRozlacznoscPozycji(d.pozycje, bledy);
  },

  przeniesienie(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    const emisja = stanLogika.znajdzEmisje(stanPrzed, Number(d.emisja_zdarzenie_id));
    if (!emisja) {
      bledy.push('Wskazana emisja nie istnieje w rejestrze tej spółki.');
      return;
    }
    const zbywcaId = Number(d.zbywca_osoba_id);
    const pakiet = stanLogika.pula(stanPrzed, emisja.klucz, K.AKCJONARIUSZ, zbywcaId);
    const zadane = n.normalizuj((d.pozycje || []).flatMap((p) => p.zakresy || []));
    const brakujace = n.roznica(zadane, pakiet);

    if (brakujace.length > 0) {
      const nieobjete = n.przeciecie(
        brakujace,
        stanLogika.pula(stanPrzed, emisja.klucz, K.NIEOBJETA, null)
      );
      const umorzone = n.przeciecie(
        brakujace,
        stanLogika.pula(stanPrzed, emisja.klucz, K.UMORZONA, null)
      );
      if (nieobjete.length > 0) {
        bledy.push(
          `Akcje ${n.opisz(nieobjete)} serii ${emisja.seria} nie zostały objęte — ` +
            `nie można ich przenieść przed wpisem objęcia.`
        );
      }
      if (umorzone.length > 0) {
        bledy.push(`Akcje ${n.opisz(umorzone)} serii ${emisja.seria} są umorzone.`);
      }
      const cudze = n.roznica(n.roznica(brakujace, nieobjete), umorzone);
      if (cudze.length > 0) {
        bledy.push(
          `Zbywca nie posiada akcji ${n.opisz(cudze)} serii ${emisja.seria} na dzień ` +
            `${propozycja.data_zdarzenia}. Posiada: ${n.opisz(pakiet) || 'brak akcji w tej serii'}.`
        );
      }
    }

    for (const p of d.pozycje || []) {
      if (Number(p.nabywca_osoba_id) === zbywcaId) {
        bledy.push('Zbywca i nabywca to ta sama osoba — takie przeniesienie nie zmienia rejestru.');
      }
    }
    sprawdzRozlacznoscPozycji(d.pozycje, bledy);
  },

  umorzenie(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    const emisja = stanLogika.znajdzEmisje(stanPrzed, Number(d.emisja_zdarzenie_id));
    if (!emisja) {
      bledy.push('Wskazana emisja nie istnieje w rejestrze tej spółki.');
      return;
    }
    for (const p of d.pozycje || []) {
      const zakresy = n.normalizuj(p.zakresy || []);
      const pula =
        p.osoba_id == null
          ? stanLogika.pula(stanPrzed, emisja.klucz, K.NIEOBJETA, null)
          : stanLogika.pula(stanPrzed, emisja.klucz, K.AKCJONARIUSZ, Number(p.osoba_id));
      const brakujace = n.roznica(zakresy, pula);
      if (brakujace.length > 0) {
        bledy.push(
          p.osoba_id == null
            ? `Akcje ${n.opisz(brakujace)} serii ${emisja.seria} nie są nieobjęte — nie można ich umorzyć w tym trybie.`
            : `Akcjonariusz nie posiada akcji ${n.opisz(brakujace)} serii ${emisja.seria} na dzień ${propozycja.data_zdarzenia}.`
        );
      }
    }
    sprawdzRozlacznoscPozycji(d.pozycje, bledy);
  },

  zmiana_danych_spolki() {},

  obciazenie(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    const emisja = stanLogika.znajdzEmisje(stanPrzed, Number(d.emisja_zdarzenie_id));
    if (!emisja) {
      bledy.push('Wskazana emisja nie istnieje w rejestrze tej spółki.');
      return;
    }
    if (Number(d.osoba_id) === Number(d.akcjonariusz_osoba_id)) {
      bledy.push('Zastawnik (użytkownik) i akcjonariusz nie mogą być tą samą osobą.');
    }
    const pakiet = stanLogika.pula(stanPrzed, emisja.klucz, K.AKCJONARIUSZ, Number(d.akcjonariusz_osoba_id));
    const zadane = n.normalizuj(d.zakresy || []);
    const brakujace = n.roznica(zadane, pakiet);
    if (brakujace.length > 0) {
      bledy.push(
        `Akcjonariusz nie posiada akcji ${n.opisz(brakujace)} serii ${emisja.seria} na dzień ${propozycja.data_zdarzenia}.`
      );
    }
  },

  wykreslenie_obciazenia(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    const cel = stanPrzed.obciazenia.find(
      (o) => o.klucz === Number(d.obciazenie_zdarzenie_id) && o.data_do === null
    );
    if (!cel) {
      bledy.push('Wskazane obciążenie nie istnieje w rejestrze albo zostało już wykreślone.');
      return;
    }
    if (cel.typ === 'zajecie') {
      bledy.push(
        'Zajęcie egzekucyjne wykreśla się zdarzeniem „uchylenie zajęcia”, nie „wykreślenie obciążenia”.'
      );
    }
  },

  prawo_glosu_zastawnika(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    const cel = stanPrzed.obciazenia.find(
      (o) => o.klucz === Number(d.obciazenie_zdarzenie_id) && o.data_do === null
    );
    if (!cel) {
      bledy.push('Wskazane obciążenie nie istnieje w rejestrze albo zostało już wykreślone.');
      return;
    }
    if (cel.typ === 'zajecie') {
      bledy.push('Prawo głosu zastawnika dotyczy zastawu lub użytkowania, nie zajęcia egzekucyjnego.');
    }
  },

  zajecie(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    const emisja = stanLogika.znajdzEmisje(stanPrzed, Number(d.emisja_zdarzenie_id));
    if (!emisja) {
      bledy.push('Wskazana emisja nie istnieje w rejestrze tej spółki.');
      return;
    }
    const zadane = n.normalizuj(d.zakresy || []);
    if (zadane.length === 0) {
      bledy.push('Nie zidentyfikowano akcji objętych zajęciem.');
      return;
    }
    if (d.akcjonariusz_osoba_id != null) {
      const pakiet = stanLogika.pula(stanPrzed, emisja.klucz, K.AKCJONARIUSZ, Number(d.akcjonariusz_osoba_id));
      const brakujace = n.roznica(zadane, pakiet);
      if (brakujace.length > 0) {
        bledy.push(
          `Wskazany akcjonariusz nie posiada akcji ${n.opisz(brakujace)} serii ${emisja.seria} ` +
            `na dzień ${propozycja.data_zdarzenia}.`
        );
      }
    } else {
      const brakujace = n.roznica(zadane, n.zakresEmisji(emisja));
      if (brakujace.length > 0) {
        bledy.push(`Numery ${n.opisz(brakujace)} wykraczają poza zakres emisji ${emisja.seria}.`);
      }
    }
  },

  wykreslenie_zajecia(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    const cel = stanPrzed.obciazenia.find(
      (o) => o.klucz === Number(d.obciazenie_zdarzenie_id) && o.data_do === null && o.typ === 'zajecie'
    );
    if (!cel) {
      bledy.push('Wskazane zajęcie nie istnieje w rejestrze albo zostało już uchylone.');
    }
  },

  uprawnienie(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    if (d.wykresla_zdarzenie_id != null) {
      const cel = stanPrzed.uprawnienia.find(
        (u) => u.klucz === Number(d.wykresla_zdarzenie_id) && u.status === 'aktywne'
      );
      if (!cel) bledy.push('Wskazane uprawnienie nie istnieje w rejestrze albo zostało już wykreślone.');
      return;
    }
    if (d.zakres === 'emisja' && !stanLogika.znajdzEmisje(stanPrzed, Number(d.emisja_zdarzenie_id))) {
      bledy.push('Wskazana emisja nie istnieje w rejestrze tej spółki.');
    }
    if (!d.tytul && !d.tresc) {
      bledy.push('Uprawnienie wymaga podania tytułu albo treści.');
    }
  },

  ograniczenie(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    if (d.wykresla_zdarzenie_id != null) {
      const cel = stanPrzed.ograniczenia.find(
        (o) => o.klucz === Number(d.wykresla_zdarzenie_id) && o.status === 'aktywne'
      );
      if (!cel) bledy.push('Wskazane ograniczenie nie istnieje w rejestrze albo zostało już wykreślone.');
      return;
    }
    if (
      (d.zakres === 'emisja' || d.zakres === 'zakres_numerow') &&
      !stanLogika.znajdzEmisje(stanPrzed, Number(d.emisja_zdarzenie_id))
    ) {
      bledy.push('Wskazana emisja nie istnieje w rejestrze tej spółki.');
    }
    if (d.zakres === 'zakres_numerow' && (!Array.isArray(d.zakresy) || d.zakresy.length === 0)) {
      bledy.push('Wskaż numery akcji objęte ograniczeniem.');
    }
  },

  zmiana_danych_akcjonariusza(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    if (!Array.isArray(d.zmienione_pola) || d.zmienione_pola.length === 0) {
      bledy.push('Nie wskazano żadnej zmiany danych.');
    }
  },

  zobowiazanie(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    if (d.emisja_zdarzenie_id != null && !stanLogika.znajdzEmisje(stanPrzed, Number(d.emisja_zdarzenie_id))) {
      bledy.push('Wskazana emisja nie istnieje w rejestrze tej spółki.');
    }
  },

  zdarzenie_inne() {},
};

/** Dwie pozycje jednego zdarzenia nie moga siegac po te same akcje. */
function sprawdzRozlacznoscPozycji(pozycje, bledy) {
  const lista = (pozycje || []).map((p) => n.normalizuj(p.zakresy || []));
  for (let i = 0; i < lista.length; i += 1) {
    for (let j = i + 1; j < lista.length; j += 1) {
      const wspolne = n.przeciecie(lista[i], lista[j]);
      if (wspolne.length > 0) {
        bledy.push(
          `Akcje ${n.opisz(wspolne)} zostały przypisane w tym zdarzeniu dwukrotnie ` +
            `(pozycja ${i + 1} i ${j + 1}).`
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Wejscie glowne
// ─────────────────────────────────────────────────────────────

/**
 * Sprawdza propozycje zdarzenia wobec stanu rejestru.
 *
 * @param {object[]} zdarzenia  dotychczasowe zdarzenia spolki
 * @param {object}   propozycja { typ, data_zdarzenia, dane }
 * @param {object}   spolka     rekord `psa_spolki`
 * @param {Map}      osoby      id -> rekord `psa_osoby`
 * @param {string}   dzisiaj    data biezaca (RRRR-MM-DD), wstrzykiwana w testach
 * @returns {{ dopuszczalne, bledy, ostrzezenia, stanPrzed, stanPo }}
 */
function sprawdz({ zdarzenia = [], propozycja, spolka, osoby = new Map(), dzisiaj } = {}) {
  const bledy = [];
  const ostrzezenia = [];
  const dzis = dzisiajIso(dzisiaj);

  if (!propozycja || !propozycja.typ) {
    return { dopuszczalne: false, bledy: ['Nie wskazano typu zdarzenia.'], ostrzezenia, stanPrzed: null, stanPo: null };
  }
  if (!typyZdarzen.istnieje(propozycja.typ)) {
    return {
      dopuszczalne: false,
      bledy: [`Typ zdarzenia „${propozycja.typ}” nie występuje w katalogu.`],
      ostrzezenia,
      stanPrzed: null,
      stanPo: null,
    };
  }

  let stanPrzed;
  try {
    stanPrzed = stanLogika.odtworzStan(zdarzenia);
  } catch (e) {
    return {
      dopuszczalne: false,
      bledy: [`Nie udało się odtworzyć stanu rejestru: ${e.message}`],
      ostrzezenia,
      stanPrzed: null,
      stanPo: null,
    };
  }

  sprawdzSpolke(spolka, bledy);
  sprawdzDate(propozycja, dzis, bledy);
  sprawdzOsoby(propozycja, osoby, bledy);

  const perTyp = PER_TYP[propozycja.typ];
  if (perTyp) {
    perTyp(stanPrzed, propozycja, { osoby }, bledy, ostrzezenia);
  }

  sprawdzChronologie(stanPrzed, propozycja, bledy);
  sprawdzObciazenia(stanPrzed, propozycja, bledy);
  sprawdzOgraniczenia(stanPrzed, propozycja, bledy, ostrzezenia);
  sprawdzAml(propozycja, osoby, bledy, ostrzezenia);

  // Warstwa druga: bilans calego rejestru po zdarzeniu. Nawet jesli kontrole
  // szczegolowe czegos nie zlapaly, niezgodny bilans zatrzymuje zapis.
  let stanPo = null;
  const nastepneId =
    zdarzenia.reduce((max, z) => Math.max(max, Number(z.id) || 0), 0) + 1;
  const proba = [
    ...zdarzenia,
    {
      id: nastepneId,
      typ: propozycja.typ,
      data_zdarzenia: propozycja.data_zdarzenia,
      dane: propozycja.dane || {},
      zdarzenie_prostowane_id: propozycja.zdarzenie_prostowane_id ?? null,
    },
  ];
  try {
    stanPo = stanLogika.odtworzStan(proba);
    for (const blad of stanLogika.sprawdzBilans(stanPo)) {
      bledy.push(`Bilans akcji: ${blad}`);
    }
  } catch (e) {
    bledy.push(e.message);
  }

  // Informacyjnie: akcje wyemitowane, a wciaz nieobjete (art. 300(31) § 3 KSH).
  if (stanPo) {
    for (const seria of stanLogika.bilansNaDzien(stanPo, dzis)) {
      if (seria.nieobjete > 0) {
        ostrzezenia.push(
          `Seria ${seria.seria}: ${seria.nieobjete} akcji pozostaje nieobjętych ` +
            `(${n.opisz(seria.nieobjete_zakresy)}). Liczba akcji zarejestrowanych ma odpowiadać ` +
            `liczbie wyemitowanych — uzupełnij wpisem objęcia.`
        );
      }
    }
  }

  return {
    dopuszczalne: bledy.length === 0,
    bledy: [...new Set(bledy)],
    ostrzezenia: [...new Set(ostrzezenia)],
    stanPrzed,
    stanPo,
  };
}

module.exports = { sprawdz, dotknieteZakresy };
