/* rdzen.js — klient API, formatowanie, nawigacja, wspólne haki.
   Bez bundlera: pliki ładują się po kolei jako <script type="text/babel">,
   więc to, co ma być widoczne w kolejnych plikach, przypisujemy do `window`. */

const { useState, useEffect, useCallback, useRef, useMemo, useId } = React;

/* ─────────────────────────────────────────────────────
   KLIENT API
   Od sprintu 3 tożsamość niesie sesja w httpOnly cookie
   (`pomocnicze/autoryzacja.js`), nie nagłówek `X-User-Name` — `fetch`
   dołącza ciasteczka domyślnie przy żądaniach tego samego pochodzenia,
   więc klient nie musi nic dokładać.
   ───────────────────────────────────────────────────── */
class BladApi extends Error {
  constructor(komunikat, dane, status) {
    super(komunikat);
    this.name = 'BladApi';
    this.bledy = (dane && dane.bledy) || [komunikat];
    this.ostrzezenia = (dane && dane.ostrzezenia) || [];
    this.status = status;
    this.dane = dane;
  }
}

async function zapytaj(metoda, sciezka, cialo) {
  const naglowki = {};
  if (cialo !== undefined) naglowki['Content-Type'] = 'application/json';

  const odpowiedz = await fetch(sciezka, {
    method: metoda,
    headers: naglowki,
    body: cialo === undefined ? undefined : JSON.stringify(cialo),
  });

  let dane = null;
  try {
    dane = await odpowiedz.json();
  } catch {
    dane = null;
  }

  if (!odpowiedz.ok) {
    const komunikat = (dane && dane.blad) || `Błąd ${odpowiedz.status}.`;
    throw new BladApi(komunikat, dane, odpowiedz.status);
  }
  return dane;
}

const API = {
  get: (s) => zapytaj('GET', s),
  post: (s, c) => zapytaj('POST', s, c === undefined ? {} : c),
  put: (s, c) => zapytaj('PUT', s, c),
  patch: (s, c) => zapytaj('PATCH', s, c === undefined ? {} : c),
  delete: (s) => zapytaj('DELETE', s),
};

/* ─────────────────────────────────────────────────────
   FORMATOWANIE
   Kwoty trzymamy w groszach (reguła domenowa nr 5) — złotówki powstają
   dopiero przy wyświetlaniu.
   ───────────────────────────────────────────────────── */
function zlote(grosze) {
  if (grosze === null || grosze === undefined || grosze === '') return '—';
  return (Number(grosze) / 100).toLocaleString('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
  });
}

function liczba(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('pl-PL');
}

function procent(p) {
  if (p === null || p === undefined) return '—';
  const wartosc = Number(p);
  // Pokazujemy dwa miejsca, gdy udział jest ułamkowy — przy 500 akcjonariuszach
  // zaokrąglenie do liczby całkowitej gubi różnice.
  const miejsca = Number.isInteger(wartosc) ? 0 : 2;
  return `${wartosc.toFixed(miejsca)}%`;
}

function data(iso) {
  if (!iso) return '—';
  const [r, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}.${m}.${r}`;
}

function dataCzas(iso) {
  if (!iso) return '—';
  const tekst = String(iso);
  const dzien = data(tekst);
  const godzina = tekst.slice(11, 19);
  return godzina ? `${dzien}, godz. ${godzina}` : dzien;
}

function dzisIso() {
  const t = new Date();
  const dwa = (x) => String(x).padStart(2, '0');
  return `${t.getFullYear()}-${dwa(t.getMonth() + 1)}-${dwa(t.getDate())}`;
}

/** Odmiana rzeczownika przez liczbę: 1 akcja, 2 akcje, 5 akcji. */
function odmien(n, jedna, kilka, wiele) {
  const x = Math.abs(Number(n));
  if (x === 1) return jedna;
  const reszta10 = x % 10;
  const reszta100 = x % 100;
  if (reszta10 >= 2 && reszta10 <= 4 && (reszta100 < 12 || reszta100 > 14)) return kilka;
  return wiele;
}

const AKCJE = (n) => `${liczba(n)} ${odmien(n, 'akcja', 'akcje', 'akcji')}`;

/* ─────────────────────────────────────────────────────
   NAWIGACJA (router na hashu, bez zależności)
   ───────────────────────────────────────────────────── */
function idz(sciezka) {
  window.location.hash = sciezka.startsWith('#') ? sciezka : `#${sciezka}`;
}

function biezacaTrasa() {
  const surowa = window.location.hash.replace(/^#/, '') || '/';
  const [sciezka, zapytanieTekst] = surowa.split('?');
  return {
    sciezka,
    segmenty: sciezka.split('/').filter(Boolean),
    zapytanie: new URLSearchParams(zapytanieTekst || ''),
  };
}

function useTrasa() {
  const [trasa, ustawTrase] = useState(biezacaTrasa);
  useEffect(() => {
    const przy = () => ustawTrase(biezacaTrasa());
    window.addEventListener('hashchange', przy);
    return () => window.removeEventListener('hashchange', przy);
  }, []);
  return trasa;
}

/* ─────────────────────────────────────────────────────
   HAKI
   ───────────────────────────────────────────────────── */
/**
 * Pobranie danych z API ze stanem ładowania, błędu i odświeżaniem.
 * `sciezka` fałszywa (np. `null`, dopóki zależne dane jeszcze się ładują)
 * wstrzymuje zapytanie — zostaje w stanie `ladowanie: true` bez odpytywania API.
 */
function useDane(sciezka, zaleznosci = []) {
  const [stan, ustawStan] = useState({ dane: null, ladowanie: true, blad: null });
  const [znacznik, odswiez] = useState(0);

  useEffect(() => {
    if (!sciezka) return undefined;
    let aktualne = true;
    ustawStan((p) => ({ ...p, ladowanie: true }));
    API.get(sciezka)
      .then((dane) => aktualne && ustawStan({ dane, ladowanie: false, blad: null }))
      .catch((blad) => aktualne && ustawStan({ dane: null, ladowanie: false, blad }));
    return () => {
      aktualne = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sciezka, znacznik, ...zaleznosci]);

  return { ...stan, odswiez: () => odswiez((x) => x + 1) };
}

/** Wywołanie klawisza Escape — kreator pyta, zanim się zamknie. */
function useEscape(obsluga) {
  useEffect(() => {
    const przy = (zdarzenie) => {
      if (zdarzenie.key === 'Escape') obsluga(zdarzenie);
    };
    window.addEventListener('keydown', przy);
    return () => window.removeEventListener('keydown', przy);
  }, [obsluga]);
}

window.API = API;
window.BladApi = BladApi;
window.fmt = { zlote, liczba, procent, data, dataCzas, odmien, AKCJE, dzisIso };
window.idz = idz;
window.useTrasa = useTrasa;
window.useDane = useDane;
window.useEscape = useEscape;
