/* formaty.js — czyste funkcje formatowania i walidacji pól (FAZA 1 sesji
   frontendowej, pkt 2–3). Bez Reacta i bez DOM: ten sam kod działa w
   przeglądarce (nazwy globalne w paczce) i w testach `node:test`
   (`testy/formaty.test.js`, przez `module.exports` na dole pliku).

   Zasada komunikatów (wzorzec GOV.UK): komunikat mówi, CO ZROBIĆ, a nie tylko
   co jest źle — „Wpisz 11 cyfr numeru PESEL", nie „Błędny PESEL". */

/* ── Kwoty (reguła domenowa nr 5: na zewnątrz pola GROSZE jako liczba całkowita) ── */

/**
 * Tekst wpisany przez człowieka → grosze. Przyjmuje „10", „10,5", „10.50",
 * „1 000,00", „1.000,50"; spacje (także niełamliwe) są separatorem tysięcy.
 *
 * Nie zaokrągla po cichu (D-045): więcej niż 2 cyfry po przecinku to błąd
 * z komunikatem, nie zero ani „najbliższy grosz". Cena poniżej grosza
 * (Q6) do czasu decyzji Łukasza jest więc niemożliwa do zapisania — ale
 * jawnie, nie przez zaokrąglenie.
 *
 * Zwraca `{ grosze }` (null dla pustego pola) albo `{ blad }`.
 */
function parsujKwote(tekst) {
  let t = String(tekst == null ? '' : tekst).replace(/[\s  ]/g, '').replace(/zł$/i, '');
  if (t === '') return { grosze: null };
  if (t.startsWith('-')) return { blad: 'Kwota nie może być ujemna.' };
  if (!/^[\d.,]+$/.test(t)) return { blad: 'Wpisz kwotę w złotych, np. 10 albo 10,50.' };

  const ostatniPrzecinek = t.lastIndexOf(',');
  const ostatniaKropka = t.lastIndexOf('.');
  const kropek = (t.match(/\./g) || []).length;
  const przecinkow = (t.match(/,/g) || []).length;
  let calosc;
  let ulamek = '';

  if (przecinkow && kropek) {
    // Oba znaki: ostatni jest przecinkiem dziesiętnym, pozostałe — tysiącami.
    const dziesietny = ostatniPrzecinek > ostatniaKropka ? ',' : '.';
    const tysiace = dziesietny === ',' ? '.' : ',';
    const [c, u, ...reszta] = t.split(dziesietny);
    if (reszta.length) return { blad: 'Wpisz kwotę w złotych, np. 1 000,50.' };
    if (!/^\d{1,3}([.,]\d{3})*$/.test(c)) return { blad: 'Wpisz kwotę w złotych, np. 1 000,50.' };
    calosc = c.split(tysiace).join('');
    ulamek = u;
  } else if (przecinkow + kropek > 1) {
    // „1.000.000" — same separatory tysięcy.
    const znak = przecinkow ? ',' : '.';
    if (!new RegExp(`^\\d{1,3}(\\${znak}\\d{3})+$`).test(t)) return { blad: 'Wpisz kwotę w złotych, np. 1 000,50.' };
    calosc = t.split(znak).join('');
  } else if (przecinkow + kropek === 1) {
    [calosc, ulamek] = t.split(/[.,]/);
  } else {
    calosc = t;
  }

  if (calosc === '') calosc = '0';
  if (!/^\d+$/.test(calosc) || !/^\d*$/.test(ulamek)) return { blad: 'Wpisz kwotę w złotych, np. 10 albo 10,50.' };
  if (ulamek.length > 2) {
    return { blad: 'Wpisz kwotę z dokładnością do 1 grosza — najwyżej 2 cyfry po przecinku.' };
  }
  const grosze = Number(calosc) * 100 + Number((ulamek + '00').slice(0, 2));
  if (!Number.isSafeInteger(grosze)) return { blad: 'Kwota jest za duża.' };
  return { grosze };
}

/** Grupy tysięcy oddzielone niełamliwą spacją: 1 000 000. */
function grupujTysiace(liczbaCalkowita) {
  return String(liczbaCalkowita).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Grosze → „1 000,50 zł". Zawsze dwa miejsca po przecinku przy wyświetlaniu
 * gotowej kwoty — ale pole nie wstawia ich SAMO podczas pisania (to nie kasa
 * fiskalna), dopiero po opuszczeniu pola.
 */
function formatujKwote(grosze, { waluta = true } = {}) {
  if (grosze === null || grosze === undefined || grosze === '') return '';
  const g = Math.round(Number(grosze));
  const znak = g < 0 ? '-' : '';
  const bezwzgl = Math.abs(g);
  const tekst = `${znak}${grupujTysiace(Math.floor(bezwzgl / 100))},${String(bezwzgl % 100).padStart(2, '0')}`;
  return waluta ? `${tekst} zł` : tekst;
}

/* ── PESEL ─────────────────────────────────────────────────────────────── */

/**
 * Walidacja pola PESEL. `parsujPesel` (pesel.js) rozkłada numer na datę
 * urodzenia i płeć.
 *
 * Zła suma kontrolna to OSTRZEŻENIE, nie błąd — tak jak dotąd w kartotece:
 * w obrocie funkcjonują numery nadane z błędną sumą i nie wolno zablokować
 * wpisu osoby, która ma taki numer w dowodzie. Błędem jest dopiero numer,
 * który nie ma 11 cyfr albo koduje nieistniejącą datę.
 *
 * PESEL nie należy do katalogu z art. 300(33) § 1 KSH — służy do
 * autouzupełnienia daty urodzenia i do identyfikacji.
 */
function walidujPesel(pesel) {
  const t = String(pesel == null ? '' : pesel).replace(/\s/g, '');
  if (t === '') return { pusty: true };
  if (!/^\d+$/.test(t)) return { blad: 'Wpisz numer PESEL samymi cyframi.' };
  if (t.length !== 11) return { blad: `Wpisz 11 cyfr numeru PESEL — wpisano ${t.length}.` };
  const rozklad = parsujPeselBezpiecznie(t);
  if (!rozklad) return { blad: 'Ten numer PESEL koduje nieistniejącą datę urodzenia — sprawdź cyfry.' };
  return {
    data_urodzenia: rozklad.data_urodzenia,
    plec: rozklad.plec,
    ostrzezenie: rozklad.poprawnaSumaKontrolna
      ? null
      : 'Suma kontrolna numeru PESEL się nie zgadza — sprawdź numer z dokumentem. Jeśli jest zgodny, możesz go zostawić.',
  };
}

function parsujPeselBezpiecznie(t) {
  /* global parsujPesel */
  if (typeof parsujPesel === 'function') return parsujPesel(t);
  // eslint-disable-next-line global-require
  return require('./pesel.js').parsujPesel(t);
}

/* ── Adres ─────────────────────────────────────────────────────────────── */

const KRAJ_DOMYSLNY = 'Polska';

function czyPolska(kraj) {
  const k = String(kraj == null ? '' : kraj).trim().toLowerCase();
  return k === '' || k === 'polska' || k === 'pl' || k === 'poland';
}

/** Maska kodu pocztowego dla Polski: „80280" → „80-280". Poza Polską bez zmian. */
function maskujKodPocztowy(tekst, kraj) {
  const t = String(tekst == null ? '' : tekst);
  if (!czyPolska(kraj)) return t;
  const cyfry = t.replace(/\D/g, '').slice(0, 5);
  return cyfry.length > 2 ? `${cyfry.slice(0, 2)}-${cyfry.slice(2)}` : cyfry;
}

function walidujKodPocztowy(kod, kraj) {
  const t = String(kod == null ? '' : kod).trim();
  if (t === '' || !czyPolska(kraj)) return null;
  return /^\d{2}-\d{3}$/.test(t) ? null : 'Wpisz kod pocztowy w formacie 00-000.';
}

/**
 * Jeden formatter adresu dla widoków i pism: „Leśmiana 3/U10, 80-280 Gdańsk".
 * Kraj dopisywany tylko poza Polską. Pola: kraj, kod_pocztowy, miejscowosc,
 * ulica, nr_domu, nr_lokalu. `prefiks` pozwala użyć kolumn z przedrostkiem
 * (np. `reprezentant_`).
 */
function formatujAdres(a, { prefiks = '', wieloliniowy = false } = {}) {
  if (!a) return '';
  const w = (k) => String(a[prefiks + k] == null ? '' : a[prefiks + k]).trim();
  const numer = [w('nr_domu'), w('nr_lokalu')].filter(Boolean).join('/');
  const miejscowosc = w('miejscowosc');
  const kod = w('kod_pocztowy');
  // Bez ulicy (mała miejscowość) numer idzie po nazwie miejscowości.
  const linie = w('ulica')
    ? [[w('ulica'), numer].filter(Boolean).join(' '), [kod, miejscowosc].filter(Boolean).join(' ')]
    : [[miejscowosc, numer].filter(Boolean).join(' '), kod ? `${kod} ${miejscowosc}`.trim() : ''];
  if (!czyPolska(w('kraj'))) linie.push(w('kraj'));
  const niepuste = linie.filter(Boolean);
  return niepuste.join(wieloliniowy ? '\n' : ', ');
}

/* ── Daty ─────────────────────────────────────────────────────────────── */

/** „12.03.2026", „12-03-2026", „2026-03-12", „12032026" → ISO albo null. */
function parsujDate(tekst) {
  const czesci = String(tekst == null ? '' : tekst).trim().split(/[^\d]+/).filter(Boolean);
  let d;
  let m;
  let r;
  if (czesci.length === 3) {
    if (czesci[0].length === 4) [r, m, d] = czesci; else [d, m, r] = czesci;
  } else if (czesci.length === 1 && czesci[0].length === 8) {
    const c = czesci[0];
    if (Number(c.slice(0, 4)) > 1900) { r = c.slice(0, 4); m = c.slice(4, 6); d = c.slice(6, 8); } else { d = c.slice(0, 2); m = c.slice(2, 4); r = c.slice(4, 8); }
  } else {
    return null;
  }
  if (r.length !== 4) return null;
  const iso = `${r}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const proba = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(proba.getTime()) || proba.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parsujKwote, formatujKwote, grupujTysiace, walidujPesel, formatujAdres,
    maskujKodPocztowy, walidujKodPocztowy, czyPolska, parsujDate, KRAJ_DOMYSLNY,
  };
}
