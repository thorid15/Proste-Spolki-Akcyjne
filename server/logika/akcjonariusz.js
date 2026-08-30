'use strict';

/**
 * Dane akcjonariusza wpisywane do rejestru — art. 300(33) § 1 pkt 2–5 KSH.
 *
 * Trzy miejsca zapisują te same dane: kartoteka kancelarii (`psa_osoby`),
 * wniosek klienta (`psa_wnioski_akcjonariusze`) i przyjęcie wniosku, które
 * przepisuje jedno w drugie. Reguły ustawowe mieszkają więc tutaj, a nie
 * w trzech trasach osobno.
 *
 * Podział na twarde i miękkie: BŁĄD blokuje zapis, OSTRZEŻENIE tylko
 * informuje. Klient wypełnia wniosek etapami i zapisuje go dziesiątki razy
 * po drodze — blokowanie kompletności przy każdym zapisie uniemożliwiłoby
 * pracę. Twarde zostaje to, co jest wewnętrznie SPRZECZNE (zadeklarowano
 * brak PESEL-u i podano PESEL), miękkie to, co jest NIEKOMPLETNE.
 */

const przepisy = require('./przepisy');

const { RODZAJE_ADRESU_REJESTROWEGO: ADRES, STATUSY_ZGODY_EMAIL: ZGODA,
  RODZAJE_WSPOLWLASNOSCI: WSPOL } = przepisy;

/** Pola wspólne dla kartoteki i wniosku — jedna lista, żeby się nie rozjechały. */
const POLA_USTAWOWE = [
  'bez_pesel', 'rodzaj_adresu_rejestrowego', 'zgoda_email_status',
  'wspolwlasnosc', 'wspolwlasciciele', 'udzial_licznik', 'udzial_mianownik',
];

function pusty(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

/**
 * Normalizuje pola ustawowe przyjęte z formularza.
 * `zgoda_email` (0/1) wyliczamy ze statusu — status jest źródłem prawdy,
 * flaga skrótem czytanym przez wzory pism i maskowanie.
 */
function znormalizuj(dane) {
  const wynik = { ...dane };

  if ('bez_pesel' in wynik) wynik.bez_pesel = wynik.bez_pesel ? 1 : 0;

  for (const pole of ['udzial_licznik', 'udzial_mianownik']) {
    if (!(pole in wynik)) continue;
    wynik[pole] = pusty(wynik[pole]) ? null : Number(wynik[pole]);
  }

  if ('zgoda_email_status' in wynik) {
    const status = pusty(wynik.zgoda_email_status) ? ZGODA.BRAK : String(wynik.zgoda_email_status);
    wynik.zgoda_email_status = status;
    wynik.zgoda_email = status === ZGODA.POTWIERDZONA ? 1 : 0;
  }

  if ('wspolwlasnosc' in wynik && pusty(wynik.wspolwlasnosc)) {
    wynik.wspolwlasnosc = WSPOL.BRAK;
  }
  if ('rodzaj_adresu_rejestrowego' in wynik && pusty(wynik.rodzaj_adresu_rejestrowego)) {
    wynik.rodzaj_adresu_rejestrowego = null;
  }

  return wynik;
}

/**
 * Sprzeczności blokujące zapis. Zwraca listę komunikatów; pusta = w porządku.
 * `dane` to CZĘŚCIOWY zestaw pól (formularz zapisuje się przyrostowo), więc
 * sprawdzamy wyłącznie to, co faktycznie przyszło.
 */
function bledy(dane) {
  const lista = [];

  if (dane.rodzaj_adresu_rejestrowego != null
      && !Object.values(ADRES).includes(dane.rodzaj_adresu_rejestrowego)) {
    lista.push(`Nieznany rodzaj adresu rejestrowego: „${dane.rodzaj_adresu_rejestrowego}”.`);
  }
  if (dane.zgoda_email_status != null && !Object.values(ZGODA).includes(dane.zgoda_email_status)) {
    lista.push(`Nieznany status zgody na komunikację elektroniczną: „${dane.zgoda_email_status}”.`);
  }
  if (dane.wspolwlasnosc != null && !Object.values(WSPOL).includes(dane.wspolwlasnosc)) {
    lista.push(`Nieznany rodzaj współwłasności: „${dane.wspolwlasnosc}”.`);
  }

  // Deklaracja „nie ma PESEL-u” i podany PESEL wykluczają się nawzajem.
  if (dane.bez_pesel === 1 && !pusty(dane.pesel)) {
    lista.push('Zaznaczono brak numeru PESEL, a numer został podany — usuń jedno albo drugie.');
  }

  // Ułamek bez mianownika (albo z zerem) nie jest ułamkiem.
  if (!pusty(dane.udzial_mianownik) && Number(dane.udzial_mianownik) <= 0) {
    lista.push('Mianownik udziału we współwłasności musi być liczbą dodatnią.');
  }
  if (!pusty(dane.udzial_licznik) && Number(dane.udzial_licznik) <= 0) {
    lista.push('Licznik udziału we współwłasności musi być liczbą dodatnią.');
  }
  if (!pusty(dane.udzial_licznik) && !pusty(dane.udzial_mianownik)
      && Number(dane.udzial_licznik) > Number(dane.udzial_mianownik)) {
    lista.push('Udział we współwłasności nie może być większy od całości.');
  }

  return lista;
}

/**
 * Braki wobec art. 300(33) § 1 KSH — sprawdzane na KOMPLETNYM rekordzie
 * (przy składaniu wniosku i przy jego przyjęciu), nie przy każdym zapisie.
 */
function ostrzezenia(a) {
  const lista = [];
  const oznaczenie = a.typ === 'prawna'
    ? (a.nazwa || 'podmiot bez nazwy')
    : ([a.imie, a.nazwisko].filter(Boolean).join(' ') || 'osoba bez nazwiska');

  if (a.typ === 'prawna') {
    // pkt 2 in fine — firma oraz numer w rejestrze i nazwa tego rejestru.
    if (pusty(a.nazwa)) lista.push(`${oznaczenie}: brak firmy (nazwy) podmiotu.`);
    if (pusty(a.numer_w_rejestrze) !== pusty(a.nazwa_rejestru)) {
      lista.push(`${oznaczenie}: numer w rejestrze i nazwę rejestru podaje się razem.`);
    }
  } else {
    if (pusty(a.nazwisko)) lista.push(`${oznaczenie}: brak nazwiska.`);
    // pkt 2 — PESEL ALBO data urodzenia. Brak obu to brak wpisu ustawowego.
    if (pusty(a.pesel) && pusty(a.data_urodzenia)) {
      lista.push(`${oznaczenie}: podaj PESEL albo — gdy akcjonariusz go nie ma — datę urodzenia.`);
    }
    if (a.bez_pesel === 1 && pusty(a.data_urodzenia)) {
      lista.push(`${oznaczenie}: przy braku numeru PESEL data urodzenia jest obowiązkowa.`);
    }
  }

  // pkt 3 — jeden ze wskazanych adresów trafia do treści rejestru. Klient
  // (wniosek) wpisuje tyle adresów, ile akcjonariusz posiada, bez wyboru —
  // KTÓRY z nich jest tym z ustawy, wskazuje kancelaria przy weryfikacji.
  // Brakiem jest więc wyłącznie brak jakiegokolwiek adresu; niezgodność
  // wskazanego rodzaju z wypełnionym polem to osobny, bardziej konkretny
  // sygnał dla kancelarii (np. domyślne "zamieszkania" zostało puste, bo
  // klient podał tylko adres do e-Doręczeń).
  const adresy = {
    [ADRES.ZAMIESZKANIA]: [a.kod_pocztowy, a.miejscowosc, a.ulica].some((v) => !pusty(v)),
    [ADRES.DORECZEN]: !pusty(a.adres_doreczen),
    [ADRES.EDORECZEN]: !pusty(a.adres_edoreczen),
  };
  if (!Object.values(adresy).some(Boolean)) {
    lista.push(`${oznaczenie}: brak jakiegokolwiek adresu.`);
  } else if (!pusty(a.rodzaj_adresu_rejestrowego) && !adresy[a.rodzaj_adresu_rejestrowego]) {
    lista.push(
      `${oznaczenie}: jako adres do rejestru wskazano „${przepisy.OPISY_RODZAJOW_ADRESU_REJESTROWEGO[a.rodzaj_adresu_rejestrowego]}”, `
      + 'ale to pole jest puste — sprawdź, który adres ma zostać wpisany.'
    );
  }

  // pkt 4 — zgoda bez adresu e-mail nie ma czego dotyczyć.
  if (a.zgoda_email_status && a.zgoda_email_status !== ZGODA.BRAK && pusty(a.email)) {
    lista.push(`${oznaczenie}: zaznaczono zgodę na komunikację elektroniczną, ale nie podano adresu e-mail.`);
  }

  // pkt 5 — przy współwłasności pozostali współwłaściciele, przy ułamkowej udział.
  if (a.wspolwlasnosc && a.wspolwlasnosc !== WSPOL.BRAK) {
    if (pusty(a.wspolwlasciciele)) {
      lista.push(`${oznaczenie}: przy współwłasności akcji wpisz pozostałych współwłaścicieli.`);
    }
    if (a.wspolwlasnosc === WSPOL.ULAMKOWA
        && (pusty(a.udzial_licznik) || pusty(a.udzial_mianownik))) {
      lista.push(`${oznaczenie}: przy współwłasności w częściach ułamkowych podaj wielkość udziału.`);
    }
  }

  return lista;
}

module.exports = { POLA_USTAWOWE, znormalizuj, bledy, ostrzezenia };
