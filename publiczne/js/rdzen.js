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

/* Pozycja przewinięcia każdej odwiedzonej strony — „wstecz" wraca w to samo
   miejsce listy (FAZA 1 pkt 5). W sessionStorage są wyłącznie liczby i
   adresy ekranów, żadne dane osobowe. */
const KLUCZ_PRZEWINIEC = 'psa-przewiniecia';
function zapamietanePrzewiniecia() {
  try { return JSON.parse(sessionStorage.getItem(KLUCZ_PRZEWINIEC) || '{}'); } catch { return {}; }
}
function zapamietajPrzewiniecie(hash, y) {
  try {
    const p = zapamietanePrzewiniecia();
    p[hash] = y;
    sessionStorage.setItem(KLUCZ_PRZEWINIEC, JSON.stringify(p));
  } catch { /* prywatne okno — bez pamięci przewinięcia */ }
}

/** Przywraca przewinięcie, gdy treść (wczytywana z API) urośnie na tyle, żeby było dokąd. */
function przewinDo(y) {
  const koniec = Date.now() + 1500;
  (function proba() {
    if (document.documentElement.scrollHeight - window.innerHeight >= y || Date.now() > koniec) {
      window.scrollTo(0, y);
      return;
    }
    requestAnimationFrame(proba);
  }());
}

/** Po zmianie ekranu fokus trafia na jego nagłówek — czytnik ekranu ogłasza nowy widok. */
function ustawFokusNaNaglowku() {
  const h1 = document.querySelector('main h1, h1');
  if (!h1) return;
  if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
  h1.focus({ preventScroll: true });
}

const ruchOgraniczony = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Router. Jeden słuchacz `hashchange` na aplikację (powłoka kancelarii albo
 * portalu). Zmiana widoku idzie przez View Transitions API, gdy przeglądarka
 * je ma — bez niego widok zmienia się natychmiast.
 */
/* Niezapisane zmiany (FAZA 1 pkt 5): formularz rejestruje funkcję, która
   mówi, czy ma coś niezapisanego — zmiana ekranu pyta wtedy o zgodę. */
const BLOKADY_WYJSCIA = new Set();
function useBlokadaWyjscia(czyNiezapisane) {
  const ref = useRef(czyNiezapisane);
  ref.current = czyNiezapisane;
  useEffect(() => {
    const f = () => ref.current();
    BLOKADY_WYJSCIA.add(f);
    const przyZamknieciu = (z) => { if (f()) { z.preventDefault(); z.returnValue = ''; } };
    window.addEventListener('beforeunload', przyZamknieciu);
    return () => { BLOKADY_WYJSCIA.delete(f); window.removeEventListener('beforeunload', przyZamknieciu); };
  }, []);
}

function useTrasa() {
  const [trasa, ustawTrase] = useState(biezacaTrasa);
  const poprzednia = useRef(trasa.sciezka);
  useEffect(() => {
    let wstecz = false;
    let cofanie = false;
    const przyPopstate = () => { wstecz = true; };
    const przy = (z) => {
      if (cofanie) { cofanie = false; wstecz = false; return; }
      const nowa = biezacaTrasa();
      const zmianaEkranu = nowa.sciezka !== poprzednia.current;
      if (zmianaEkranu && [...BLOKADY_WYJSCIA].some((f) => f())
          && !window.confirm('Masz niezapisane zmiany. Opuścić ten ekran bez zapisania?')) {
        cofanie = true;
        wstecz = false;
        window.location.replace(z.oldURL);
        return;
      }
      if (z && z.oldURL) zapamietajPrzewiniecie(new URL(z.oldURL).hash || '#/', window.scrollY);
      poprzednia.current = nowa.sciezka;
      const cel = wstecz ? zapamietanePrzewiniecia()[window.location.hash || '#/'] : 0;
      wstecz = false;
      const zastosuj = () => ReactDOM.flushSync(() => ustawTrase(nowa));
      const poZmianie = () => {
        // Zmiana samego zapytania (filtr, zakładka w adresie) nie przewija
        // strony i nie zabiera fokusu z pola filtra.
        if (!zmianaEkranu) return;
        if (cel) przewinDo(cel); else window.scrollTo(0, 0);
        setTimeout(ustawFokusNaNaglowku, 0);
      };
      if (zmianaEkranu && document.startViewTransition && !ruchOgraniczony()) {
        const przejscie = document.startViewTransition(zastosuj);
        przejscie.updateCallbackDone.then(poZmianie, poZmianie);
      } else {
        zastosuj();
        poZmianie();
      }
    };
    window.addEventListener('popstate', przyPopstate);
    window.addEventListener('hashchange', przy);
    return () => {
      window.removeEventListener('popstate', przyPopstate);
      window.removeEventListener('hashchange', przy);
    };
  }, []);
  return trasa;
}

/**
 * Tabele na telefonie (FAZA 1 pkt 11): poniżej 600 px wiersz jest kartą
 * „etykieta: wartość" (rejestr.css). Etykiety bierzemy z nagłówka kolumny
 * i dopisujemy komórkom jako `data-etykieta` — dla każdej tabeli w
 * aplikacji, także tych dorysowanych później, bez zmieniania ekranów.
 */
function oznaczKomorkiTabel(korzen) {
  for (const tabela of korzen.querySelectorAll('table.tabela, table.tbl')) {
    const naglowki = [];
    for (const th of tabela.querySelectorAll('thead th')) {
      const etykieta = th.textContent.trim();
      for (let i = 0; i < (th.colSpan || 1); i += 1) naglowki.push(etykieta);
    }
    if (!naglowki.length) continue;
    for (const wiersz of tabela.querySelectorAll('tbody tr, tfoot tr')) {
      let kolumna = 0;
      for (const td of wiersz.children) {
        const etykieta = naglowki[kolumna] || '';
        if (td.getAttribute('data-etykieta') !== etykieta) td.setAttribute('data-etykieta', etykieta);
        kolumna += td.colSpan || 1;
      }
    }
  }
}
function obserwujTabele() {
  const korzen = document.getElementById('korzen');
  if (!korzen || !window.MutationObserver) return;
  let zaplanowane = false;
  new MutationObserver(() => {
    if (zaplanowane) return;
    zaplanowane = true;
    requestAnimationFrame(() => { zaplanowane = false; oznaczKomorkiTabel(korzen); });
  }).observe(korzen, { childList: true, subtree: true });
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', obserwujTabele);
  else obserwujTabele();
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

/**
 * Stan ekranu w adresie (FAZA 1 pkt 5): filtr, wyszukiwanie, zakładka,
 * strona listy. Zmiana zastępuje bieżący wpis historii (bez zaśmiecania
 * „wstecz" każdą literą), a powrót na ekran przywraca stan z adresu.
 * Wartość domyślna nie trafia do adresu.
 */
function useParametrAdresu(klucz, domyslna = '') {
  const [wartosc, ustawWartosc] = useState(() => {
    const z = biezacaTrasa().zapytanie.get(klucz);
    if (z === null) return domyslna;
    return typeof domyslna === 'number' ? Number(z) : typeof domyslna === 'boolean' ? z === '1' : z;
  });
  const ustaw = useCallback((nowa) => {
    ustawWartosc((poprzednia) => {
      const v = typeof nowa === 'function' ? nowa(poprzednia) : nowa;
      const { sciezka, zapytanie } = biezacaTrasa();
      if (v === domyslna || v === '' || v === null || v === undefined) zapytanie.delete(klucz);
      else zapytanie.set(klucz, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
      const tekst = zapytanie.toString();
      window.history.replaceState(window.history.state, '', `#${sciezka}${tekst ? `?${tekst}` : ''}`);
      return v;
    });
  }, [klucz, domyslna]);
  return [wartosc, ustaw];
}

/**
 * Dane odświeżane także bez nawigacji: przy powrocie do karty przeglądarki
 * (`visibilitychange`) i co `coIleMs` (domyślnie 60 s) — dla liczników
 * „wymaga działania" (FAZA 1 pkt 9). Karta w tle nie odpytuje serwera.
 */
function useOdswiezaneDane(sciezka, zaleznosci = [], coIleMs = 60000) {
  const wynik = useDane(sciezka, zaleznosci);
  const odswiez = useRef(wynik.odswiez);
  odswiez.current = wynik.odswiez;
  useEffect(() => {
    if (!sciezka) return undefined;
    const przyWidocznosci = () => { if (document.visibilityState === 'visible') odswiez.current(); };
    const czasomierz = setInterval(() => { if (document.visibilityState === 'visible') odswiez.current(); }, coIleMs);
    document.addEventListener('visibilitychange', przyWidocznosci);
    return () => {
      clearInterval(czasomierz);
      document.removeEventListener('visibilitychange', przyWidocznosci);
    };
  }, [sciezka, coIleMs]);
  return wynik;
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
window.useParametrAdresu = useParametrAdresu;
window.useBlokadaWyjscia = useBlokadaWyjscia;
window.useDane = useDane;
window.useOdswiezaneDane = useOdswiezaneDane;
window.useEscape = useEscape;
