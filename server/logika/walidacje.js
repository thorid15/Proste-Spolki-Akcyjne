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
const u = require('./ulamki');
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
 * pozycji, bez tablicy `pozycje`), albo `dane.nr` przy zdarzeniu ROZPORZADZAJACYM
 * pojedynczym numerem (`przeniesienie_ulamka`, rozpoznawane po `zbywca_osoba_id`
 * - regula domenowa 4a). `przedstawiciel`/`pokrycie_akcji` tez niosa `dane.nr`/
 * numery, ale nie sa rozporzadzeniem akcja - obciazenia blokujace ich nie
 * dotycza, wiec CELOWO nie trafiaja tutaj.
 */
function dotknieteZakresy(dane) {
  const wynik = new Map();
  const klucz = dane.emisja_zdarzenie_id == null ? null : Number(dane.emisja_zdarzenie_id);
  if (klucz == null) return wynik;
  const zPozycji = (dane.pozycje || []).flatMap((p) => p.zakresy || []);
  const zBezposrednio = Array.isArray(dane.zakresy) ? dane.zakresy : [];
  const zNumeru =
    dane.zbywca_osoba_id != null && Number.isInteger(Number(dane.nr))
      ? [{ nr_od: Number(dane.nr), nr_do: Number(dane.nr) }]
      : [];
  const zakresy = n.normalizuj([...zPozycji, ...zBezposrednio, ...zNumeru]);
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

    // Postanowienie o zgodzie spolki jest SKUTECZNE (art. 300(39) § 1, 3 KSH)
    // wylacznie z kompletem trzech szczegolow - kreator dopuszcza zapisanie
    // niekompletnego postanowienia juz przy zakladaniu spolki (etap 2.7
    // poprawek, server/logika/kreator.js), wiec twarda blokada zapada TU,
    // przy faktycznym zbyciu, i tylko dla postanowien kompletnych. Niekompletne
    // dostaje miekkie ostrzezenie - jest bezskuteczne, ale notariusz powinien
    // sprawdzic tresc postanowienia recznie, zanim wpisze zbycie bez zgody.
    const zgodaKompletna =
      o.zgoda_termin_wskazania_dni != null &&
      o.zgoda_cena_opis != null &&
      o.zgoda_termin_zaplaty_dni != null;
    if (o.wymaga_zgody_spolki && zgodaKompletna && !dane.zgoda_spolki) {
      bledy.push(
        `Rozporządzenie akcjami wymaga zgody spółki (${przepisy.PODSTAWY.OGRANICZENIA_ROZPORZADZANIA})` +
          `${o.opis ? `: ${o.opis}` : ''}. Zgoda nie została odnotowana.`
      );
    }
    if (o.wymaga_zgody_spolki && !zgodaKompletna) {
      ostrzezenia.push(
        `Postanowienie umowy spółki o zgodzie na zbycie akcji jest niekompletne (brak terminu wskazania ` +
          `nabywcy, sposobu ustalenia ceny albo terminu zapłaty) — bez kompletu jest bezskuteczne ` +
          `(${przepisy.PODSTAWY.ZGODA_SPOLKI_NA_ZBYCIE}).` +
          `${o.tresc_postanowienia ? ` Treść z umowy spółki: „${o.tresc_postanowienia}”.` : ''} ` +
          'Sprawdź ręcznie, czy zgoda spółki nie jest mimo to wymagana, zanim wpiszesz zbycie.'
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
 * Zbycie akcji nie w pelni pokrytej wymaga zgody spolki (art. 300(40) § 1
 * KSH) - dotyczy zarowno calych akcji (`przeniesienie`), jak i ich ulamkowych
 * czesci (`przeniesienie_ulamka` - art. 300(43) KSH nakazuje stosowac
 * przepisy o rozporzadzaniu akcja odpowiednio do ulamkow). `pokryta` rowna
 * `null` (nieustalone) NIE blokuje - blokuje wylacznie WYKAZANY brak pelnego
 * pokrycia ('nie'/'czesciowo'); regula nie moze wstecznie zablokowac calego
 * historycznego rejestru sprzed wprowadzenia wzmianki o pokryciu.
 */
function sprawdzPokrycie(stanPrzed, propozycja, bledy) {
  const d = propozycja.dane || {};
  let emisjaKlucz;
  let zbywcaId;
  let zakresy;
  if (propozycja.typ === 'przeniesienie') {
    emisjaKlucz = Number(d.emisja_zdarzenie_id);
    zbywcaId = Number(d.zbywca_osoba_id);
    zakresy = n.normalizuj((d.pozycje || []).flatMap((p) => p.zakresy || []));
  } else if (propozycja.typ === 'przeniesienie_ulamka') {
    emisjaKlucz = Number(d.emisja_zdarzenie_id);
    zbywcaId = Number(d.zbywca_osoba_id);
    const nr = Number(d.nr);
    zakresy = Number.isInteger(nr) ? [{ nr_od: nr, nr_do: nr }] : [];
  } else {
    return;
  }
  if (zakresy.length === 0) return;

  const niepokryte = stanLogika
    .otwarte(stanPrzed)
    .filter(
      (p) =>
        p.emisja_klucz === emisjaKlucz &&
        p.kategoria === K.AKCJONARIUSZ &&
        Number(p.osoba_id) === zbywcaId &&
        (p.pokryta === 'nie' || p.pokryta === 'czesciowo') &&
        n.nakladaja([{ nr_od: p.nr_od, nr_do: p.nr_do }], zakresy)
    );
  if (niepokryte.length > 0 && !d.zgoda_spolki_niepelne_pokrycie) {
    const dotkniete = n.normalizuj(
      niepokryte.flatMap((p) => n.przeciecie([{ nr_od: p.nr_od, nr_do: p.nr_do }], zakresy))
    );
    bledy.push(
      `Akcje ${n.opisz(dotkniete)} nie są w pełni pokryte — zbycie wymaga zgody spółki ` +
        `(${przepisy.PODSTAWY.NIEPELNE_POKRYCIE}). Zgoda nie została odnotowana.`
    );
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
  if (propozycja.typ === 'przeniesienie_ulamka' && dane.nabywca_osoba_id != null) {
    nabywcy.add(Number(dane.nabywca_osoba_id));
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
  if (dane.nabywca_osoba_id != null) wymagane.add(Number(dane.nabywca_osoba_id));
  if (dane.osoba_id != null && dane.osoba_id !== '') wymagane.add(Number(dane.osoba_id));
  if (dane.akcjonariusz_osoba_id != null && dane.akcjonariusz_osoba_id !== '') {
    wymagane.add(Number(dane.akcjonariusz_osoba_id));
  }
  if (dane.przedstawiciel_osoba_id != null && dane.przedstawiciel_osoba_id !== '') {
    wymagane.add(Number(dane.przedstawiciel_osoba_id));
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
    // Regula domenowa 12: akcje nie istnieja przed wpisem SPOLKI ALBO EMISJI
    // do KRS (art. 300(30) § 2 KSH) - sankcja karna z art. 592 § 3 KSH wobec
    // zarzadu. Twarda blokada, nie ostrzezenie.
    if (!emisja.data_wpisu_krs) {
      bledy.push(
        `Emisja serii ${emisja.seria} nie ma wpisu do KRS — akcje z tej emisji jeszcze nie istnieją ` +
          `(${przepisy.PODSTAWY.WPIS_WARUNEK_KRS}) i nie mogą zostać objęte.`
      );
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

  /**
   * Uniewaznienie akcji orzeczeniem sadu (art. 300(51) KSH) - kontrola tych
   * samych pul co przy umorzeniu: unieważnić można wyłącznie akcje, które na
   * dzień zdarzenia rzeczywiście są w rejestrze pod wskazanym tytułem.
   */
  uniewaznienie(stanPrzed, propozycja, kontekst, bledy) {
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
            ? `Akcje ${n.opisz(brakujace)} serii ${emisja.seria} nie są nieobjęte — nie można ich unieważnić w tym trybie.`
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

  przeniesienie_ulamka(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    const emisja = stanLogika.znajdzEmisje(stanPrzed, Number(d.emisja_zdarzenie_id));
    if (!emisja) {
      bledy.push('Wskazana emisja nie istnieje w rejestrze tej spółki.');
      return;
    }
    if (!emisja.data_wpisu_krs) {
      bledy.push(
        `Emisja serii ${emisja.seria} nie ma wpisu do KRS — akcje z tej emisji jeszcze nie istnieją ` +
          `(${przepisy.PODSTAWY.WPIS_WARUNEK_KRS}).`
      );
    }
    const zbywcaId = Number(d.zbywca_osoba_id);
    const nabywcaId = Number(d.nabywca_osoba_id);
    if (zbywcaId === nabywcaId) {
      bledy.push('Zbywca i nabywca to ta sama osoba — takie przeniesienie nie zmienia rejestru.');
    }
    const nr = Number(d.nr);
    if (!Number.isInteger(nr) || nr < 1) {
      bledy.push('Wskaż numer akcji, której dotyczy przeniesienie ułamkowej części.');
      return;
    }
    let czesc;
    try {
      czesc = u.waliduj({ licznik: d.czesc_licznik, mianownik: d.czesc_mianownik });
    } catch (e) {
      bledy.push(e.message);
      return;
    }
    const zbywcaMa = stanLogika.ulamekOsobyNaNumerze(stanPrzed, emisja.klucz, zbywcaId, nr);
    if (!u.mniejszyRowny(czesc, zbywcaMa)) {
      bledy.push(
        `Zbywca posiada ${u.opisz(zbywcaMa)} akcji nr ${nr} serii ${emisja.seria} na dzień ` +
          `${propozycja.data_zdarzenia} — nie może zbyć ${u.opisz(czesc)}.`
      );
    }
  },

  przedstawiciel(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    const emisja = stanLogika.znajdzEmisje(stanPrzed, Number(d.emisja_zdarzenie_id));
    if (!emisja) {
      bledy.push('Wskazana emisja nie istnieje w rejestrze tej spółki.');
      return;
    }
    const nr = Number(d.nr);
    const wlasciciele = stanLogika
      .otwarte(stanPrzed)
      .filter((p) => p.emisja_klucz === emisja.klucz && p.kategoria === K.AKCJONARIUSZ && p.nr_od <= nr && nr <= p.nr_do);
    if (wlasciciele.length === 0) {
      bledy.push(`Akcja nr ${nr} serii ${emisja.seria} nie ma obecnie żadnego uprawnionego.`);
      return;
    }
    if (d.przedstawiciel_osoba_id != null && !wlasciciele.some((w) => Number(w.osoba_id) === Number(d.przedstawiciel_osoba_id))) {
      bledy.push('Wskazany przedstawiciel musi być jednym ze współuprawnionych z tej akcji.');
    }
  },

  pokrycie_akcji(stanPrzed, propozycja, kontekst, bledy) {
    const d = propozycja.dane || {};
    const emisja = stanLogika.znajdzEmisje(stanPrzed, Number(d.emisja_zdarzenie_id));
    if (!emisja) {
      bledy.push('Wskazana emisja nie istnieje w rejestrze tej spółki.');
      return;
    }
    if (!przepisy.STANY_POKRYCIA.includes(d.pokryta)) {
      bledy.push(`Wzmianka o pokryciu musi być jedną z wartości: ${przepisy.STANY_POKRYCIA.join(', ')}.`);
    }
    const maAkcje = stanLogika
      .otwarte(stanPrzed)
      .some((p) => p.emisja_klucz === emisja.klucz && p.kategoria === K.AKCJONARIUSZ && Number(p.osoba_id) === Number(d.osoba_id));
    if (!maAkcje) {
      bledy.push('Wskazany akcjonariusz nie posiada akcji tej emisji.');
    }
  },
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
  sprawdzPokrycie(stanPrzed, propozycja, bledy);
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
