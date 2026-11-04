'use strict';

/**
 * Przeniesienie rejestru od innego podmiotu (wytyczne § 7; SESJA-PSA-WYTYCZNE.md
 * Faza 4). Czysta domena — bez bazy.
 *
 * W7.10 — statusy § 7.3 jako JAWNA maszyna stanów:
 *
 *   zgloszone → weryfikacja → umowa_warunkowa → oczekuje_na_przekazanie → uzgodnienie → aktywny
 *                                    │                                        │    ▲
 *                                    └→ wygasla (12 mies. bez warunku)        ▼    │
 *                                                                wstrzymane_rozbieznosci
 *
 * Każde przejście ma warunek, który blokuje TYLKO to, co na pewno niespełnione
 * (D-052): checklisty zaznacza człowiek, system pilnuje kompletności.
 */

const przepisy = require('./przepisy');

const STATUSY = {
  ZGLOSZONE: 'zgloszone',
  WERYFIKACJA: 'weryfikacja',
  UMOWA_WARUNKOWA: 'umowa_warunkowa',
  OCZEKUJE: 'oczekuje_na_przekazanie',
  UZGODNIENIE: 'uzgodnienie',
  AKTYWNY: 'aktywny',
  WSTRZYMANE: 'wstrzymane_rozbieznosci',
  WYGASLA: 'wygasla',
};

const NAZWY_STATUSOW = {
  zgloszone: 'Zgłoszone',
  weryfikacja: 'Weryfikacja',
  umowa_warunkowa: 'Umowa zawarta pod warunkiem',
  oczekuje_na_przekazanie: 'Oczekuje na przekazanie',
  uzgodnienie: 'Uzgodnienie',
  aktywny: 'Aktywny',
  wstrzymane_rozbieznosci: 'Wstrzymane — rozbieżności',
  wygasla: 'Wygasła — warunek się nie ziścił',
};

const PRZEJSCIA = {
  zgloszone: ['weryfikacja'],
  weryfikacja: ['umowa_warunkowa'],
  umowa_warunkowa: ['oczekuje_na_przekazanie', 'wygasla'],
  oczekuje_na_przekazanie: ['uzgodnienie'],
  uzgodnienie: ['aktywny', 'wstrzymane_rozbieznosci'],
  wstrzymane_rozbieznosci: ['uzgodnienie'],
  aktywny: [],
  wygasla: [],
};

const POPRZEDNICY = {
  dom_maklerski: 'dom maklerski / bank',
  notariusz: 'notariusz',
  rada_izby: 'notariusz, który zakończył działalność (rada izby notarialnej)',
};

/** Etap 3 — weryfikacja kancelarii (człowiek). `wymagaDokumentu` — blokada, gdy go brak. */
const CHECKLISTA_WERYFIKACJI = [
  { kod: 'reprezentacja', tresc: 'Reprezentacja wg KRS.' },
  { kod: 'uchwala', tresc: 'Uchwała akcjonariuszy: ważność, większość, data.', wymagaDokumentu: 'uchwala' },
  { kod: 'umowa_spolki', tresc: 'Umowa spółki: czy wskazuje dotychczasowy podmiot.', wymagaDokumentu: 'umowa_spolki' },
  { kod: 'aml', tresc: 'AML: spółka, reprezentanci, beneficjent rzeczywisty (CRBR).' },
  { kod: 'liczba_akcji', tresc: 'Wstępna zgodność liczby akcji.' },
];

/** Etap 6 — odbiór i uzgodnienie (człowiek). */
const CHECKLISTA_ODBIORU = [
  { kod: 'kompletnosc', tresc: 'Kompletność przekazanych danych i dokumentów.', wymagaDokumentu: 'dane_poprzednika' },
  { kod: 'liczba_akcji', tresc: 'Liczba akcji zarejestrowanych = liczba wyemitowanych (art. 300(31) § 2 KSH), wg umowy spółki i KRS.' },
  { kod: 'pokrycie', tresc: 'Pokrycie akcji, ograniczenia rozporządzania, obowiązki (art. 300(33) § 1 pkt 9–11 KSH).' },
  { kod: 'obciazenia', tresc: 'Zastawy, użytkowania, zajęcia (art. 300(34) § 2 KSH), ułamkowe części akcji.' },
  { kod: 'lista_krs', tresc: 'Porównanie z ostatnią listą akcjonariuszy złożoną do KRS (art. 300(34) § 8 KSH).' },
  { kod: 'rozbieznosci', tresc: 'Rozbieżności wyjaśnione — nie poprawiamy samodzielnie; korekty wyłącznie w trybie żądania wpisu.' },
];

function dodajMiesiace(dzien, miesiace) {
  const [r, m, d] = String(dzien).slice(0, 10).split('-').map(Number);
  const cel = new Date(Date.UTC(r, m - 1 + miesiace, d));
  return cel.toISOString().slice(0, 10);
}

function dodajDni(dzien, dni) {
  const [r, m, d] = String(dzien).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(r, m - 1, d + dni)).toISOString().slice(0, 10);
}

/** Termin ostateczny warunku (klauzula § 7.4 ust. 4). */
function terminWarunku(p) {
  return p.data_zawarcia_umowy
    ? dodajMiesiace(p.data_zawarcia_umowy, przepisy.TERMINY.PRZENIESIENIE_TERMIN_WARUNKU_MIESIECY)
    : null;
}

/** Czy umowa wygasła — warunek nie ziścił się w 12 miesięcy (W7.10). */
function czyWygasla(p, dzis) {
  return p.status === STATUSY.UMOWA_WARUNKOWA && !p.data_skutecznosci && Boolean(terminWarunku(p))
    && String(dzis) >= terminWarunku(p);
}

function brakiChecklisty(definicja, zaznaczone, dokumenty) {
  const typy = new Set((dokumenty || []).map((d) => d.typ));
  const braki = [];
  for (const poz of definicja) {
    if (poz.wymagaDokumentu && !typy.has(poz.wymagaDokumentu)) {
      braki.push(`„${poz.tresc}” — brak dokumentu (${poz.wymagaDokumentu}).`);
    } else if (!(zaznaczone && zaznaczone[poz.kod])) {
      braki.push(`„${poz.tresc}” — niezaznaczone.`);
    }
  }
  return braki;
}

/** Pozycje checklisty zablokowane, bo NA PEWNO niespełnione (brak dokumentu) — D-052. */
function blokadyChecklisty(definicja, dokumenty) {
  const typy = new Set((dokumenty || []).map((d) => d.typ));
  return Object.fromEntries(definicja.filter((p) => p.wymagaDokumentu && !typy.has(p.wymagaDokumentu))
    .map((p) => [p.kod, `Najpierw dołącz dokument: ${p.wymagaDokumentu}.`]));
}

/**
 * Sprawdza przejście. Zwraca listę przeszkód (pusta = dozwolone).
 * @param {object} p        rekord psa_przeniesienia (z JSON-ami sparsowanymi)
 * @param {string} na       status docelowy
 * @param {object} kontekst { dzis, dokumenty, dane: { data_zawarcia_umowy, data_skutecznosci, uwagi } }
 */
function przeszkodyPrzejscia(p, na, { dzis, dokumenty = [], dane = {} } = {}) {
  if (!PRZEJSCIA[p.status] || !PRZEJSCIA[p.status].includes(na)) {
    return [`Niedozwolone przejście: „${NAZWY_STATUSOW[p.status] || p.status}” → „${NAZWY_STATUSOW[na] || na}”.`];
  }
  const przeszkody = [];
  if (na === STATUSY.UMOWA_WARUNKOWA) {
    przeszkody.push(...brakiChecklisty(CHECKLISTA_WERYFIKACJI, p.checklista_weryfikacji, dokumenty));
    const data = dane.data_zawarcia_umowy || p.data_zawarcia_umowy;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) przeszkody.push('Podaj datę zawarcia umowy (podpis notariusza).');
  }
  if (na === STATUSY.OCZEKUJE) {
    const data = dane.data_skutecznosci || p.data_skutecznosci;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) {
      przeszkody.push('Wpisz datę rozwiązania albo wygaśnięcia dotychczasowej umowy — po weryfikacji dokumentu, który ją potwierdza.');
    }
    if (!dokumenty.some((d) => d.typ === 'potwierdzenie_rozwiazania' || d.typ === 'wypowiedzenie')) {
      przeszkody.push('Brak dokumentu potwierdzającego datę rozwiązania (wypowiedzenie z doręczeniem albo potwierdzenie poprzednika).');
    }
  }
  if (na === STATUSY.WYGASLA && !czyWygasla(p, dzis)) {
    przeszkody.push(`Umowa wygasa dopiero ${terminWarunku(p) || '— brak daty zawarcia'} (12 miesięcy bez ziszczenia warunku).`);
  }
  if (na === STATUSY.UZGODNIENIE && p.status === STATUSY.OCZEKUJE && !dokumenty.some((d) => d.typ === 'dane_poprzednika')) {
    przeszkody.push('Nie otrzymano danych od dotychczasowego podmiotu (dokument „dane_poprzednika”).');
  }
  if ((na === STATUSY.WSTRZYMANE || (na === STATUSY.UZGODNIENIE && p.status === STATUSY.WSTRZYMANE))
      && !String(dane.uwagi || '').trim()) {
    przeszkody.push(na === STATUSY.WSTRZYMANE ? 'Opisz rozbieżności.' : 'Opisz, jak wyjaśniono rozbieżności.');
  }
  if (na === STATUSY.AKTYWNY) {
    przeszkody.push(...brakiChecklisty(CHECKLISTA_ODBIORU, p.checklista_odbioru, dokumenty));
    // D-095: protokół przejęcia powstaje automatycznie przy otwarciu rejestru (trasy/spolki.js); zatwierdzeniem
    // notariusza jest samo otwarcie — bez osobnego „pobierz → podpisz → wgraj”.
  }
  return przeszkody;
}

/** W7.5 — przypomnienia: 14 dni bez zawiadomienia, zbliżający się termin 12 miesięcy. */
function przypomnienia(p, dzis) {
  const wynik = [];
  if (p.status !== STATUSY.UMOWA_WARUNKOWA || !p.data_zawarcia_umowy || p.data_skutecznosci) return wynik;
  const poWypowiedzeniu = dodajDni(p.data_zawarcia_umowy, przepisy.TERMINY.PRZENIESIENIE_WYPOWIEDZENIE_DNI);
  if (String(dzis) >= poWypowiedzeniu) {
    wynik.push({
      rodzaj: 'brak_zawiadomienia', termin: poWypowiedzeniu,
      tresc: 'Minęło 14 dni od zawarcia umowy, a spółka nie zawiadomiła o dacie rozwiązania dotychczasowej umowy (klauzula ust. 3).',
    });
  }
  const termin = terminWarunku(p);
  if (String(dzis) >= dodajDni(termin, -przepisy.TERMINY.PRZENIESIENIE_OSTRZEZENIE_DNI)) {
    wynik.push({
      rodzaj: 'termin_warunku', termin,
      tresc: `Zbliża się termin ostateczny warunku (${termin}) — bez rozwiązania dotychczasowej umowy nowa umowa wygaśnie (klauzula ust. 4).`,
    });
  }
  return wynik;
}

module.exports = {
  STATUSY,
  NAZWY_STATUSOW,
  PRZEJSCIA,
  POPRZEDNICY,
  CHECKLISTA_WERYFIKACJI,
  CHECKLISTA_ODBIORU,
  terminWarunku,
  czyWygasla,
  przeszkodyPrzejscia,
  blokadyChecklisty,
  przypomnienia,
  dodajMiesiace,
  dodajDni,
};
