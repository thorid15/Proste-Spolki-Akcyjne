/* ui-rejestr.js — komponenty bazowe modułu Rejestr akcjonariuszy P.S.A.
   Sesja SESJA-PSA-6-INTERFEJS.md, faza 1.

   Klasy pochodzą wyłącznie z /style/rejestr.css. Ten moduł nie używa
   design.css — patrz nagłówek rejestr.css.

   Kolejność w pliku: najpierw prymitywy (przycisk/karta/pigułka), potem POLA
   (sekcja 2.6 — „najpierw one, potem ekrany"), na końcu powłoka i paleta
   poleceń. Wszystko trafia na `window`, bo nie ma bundlera. */

/* ═════════════════════════════════════════════════════
   FORMATOWANIE UZUPEŁNIAJĄCE
   ═════════════════════════════════════════════════════ */

const MIESIACE_DOPELNIACZ = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];
const MIESIACE_MIANOWNIK = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
];

/** „2026-03-12" → „12 marca 2026". Potwierdzenie, że system zrozumiał wpis. */
function dataSlownie(iso) {
  if (!iso || String(iso).length < 10) return '';
  const [r, m, d] = String(iso).slice(0, 10).split('-');
  const nrMiesiaca = Number(m) - 1;
  if (nrMiesiaca < 0 || nrMiesiaca > 11) return '';
  return `${Number(d)} ${MIESIACE_DOPELNIACZ[nrMiesiaca]} ${r}`;
}

/** Zakres numerów akcji zawsze z PÓŁPAUZĄ, nigdy z dywizem (2.2). */
function zakresNumerow(od, doN) {
  return od === doN ? String(od) : `${od}–${doN}`;
}

function dodajDniIso(iso, dni) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dni);
  return d.toISOString().slice(0, 10);
}

window.fmt.dataSlownie = dataSlownie;
window.fmt.zakresNumerow = zakresNumerow;
window.fmt.dodajDniIso = dodajDniIso;

/* ═════════════════════════════════════════════════════
   PRYMITYWY
   ═════════════════════════════════════════════════════ */

function Spinner() {
  return <div className="ladowanie"><div className="spin" /></div>;
}

/** `scisla` (dawniej `tight`) — karta bez wewnętrznego marginesu, pod tabelę. */
function Karta({ tytul, akcje, scisla, tight, dzieci, children }) {
  const tresc = children ?? dzieci;
  if (scisla || tight) {
    return (
      <div className="karta scisla">
        {(tytul || akcje) && (
          <div className="karta-naglowek">
            {tytul && <div className="karta-tytul">{tytul}</div>}
            {akcje && <div className="rzad">{akcje}</div>}
          </div>
        )}
        {tresc}
      </div>
    );
  }
  return (
    <div className="karta">
      {(tytul || akcje) && (
        <div className="rzad-rozdzielony" style={{ marginBottom: 'var(--od-16)' }}>
          {tytul && <div className="karta-tytul">{tytul}</div>}
          {akcje && <div className="rzad">{akcje}</div>}
        </div>
      )}
      {tresc}
    </div>
  );
}

/** Pigułka. `odmiana`: neutralna (domyślna) | rejestr | mosiadz | sygnal.
    Kolor niesie znaczenie — patrz zasada nadrzędna w rejestr.css. */
function Pigulka({ odmiana, children }) {
  return <span className={`pigulka ${odmiana ? `pigulka-${odmiana}` : ''}`}>{children}</span>;
}

function Komunikat({ odmiana = 'info', tytul, tresc, lista }) {
  if (!tresc && (!lista || lista.length === 0)) return null;
  return (
    <div className={`komunikat komunikat-${odmiana}`}>
      {tytul && <div className="komunikat-tytul">{tytul}</div>}
      {tresc && <div>{tresc}</div>}
      {lista && lista.length > 0 && (
        <ul>{lista.map((p, i) => <li key={i}>{p}</li>)}</ul>
      )}
    </div>
  );
}

/** Pusty stan (2.7): zdanie mówiące CO ZROBIĆ plus przycisk. Nigdy „Brak danych". */
function Pusto({ tytul, opis, akcja }) {
  return (
    <div className="pusto">
      <div className="pusto-tytul">{tytul}</div>
      {opis && <div className="pusto-opis">{opis}</div>}
      {akcja}
    </div>
  );
}

function Modal({ tytul, children, stopka, przyZamknieciu, szerokosc }) {
  useEscape(() => przyZamknieciu && przyZamknieciu());
  return (
    <div
      className="nakladka"
      onMouseDown={(z) => { if (z.target === z.currentTarget && przyZamknieciu) przyZamknieciu(); }}
    >
      <div className="modal" style={szerokosc ? { maxWidth: szerokosc } : undefined}>
        {tytul && <div className="modal-tytul">{tytul}</div>}
        {children}
        {stopka && <div className="modal-stopka">{stopka}</div>}
      </div>
    </div>
  );
}

function Sekcja({ tytul, licznik, domyslnieOtwarta = false, akcje, children }) {
  const [otwarta, ustawOtwarta] = useState(domyslnieOtwarta);
  return (
    <div className="sekcja">
      <button className="sekcja-naglowek" onClick={() => ustawOtwarta((o) => !o)}>
        <span className="sekcja-tytul">
          <span className={`strzalka ${otwarta ? 'otwarta' : ''}`}>▶</span>
          {tytul}
          {licznik !== undefined && licznik !== null && <Pigulka>{licznik}</Pigulka>}
        </span>
        {akcje && <span className="rzad" onClick={(z) => z.stopPropagation()}>{akcje}</span>}
      </button>
      {otwarta && <div>{children}</div>}
    </div>
  );
}

function Kroki({ kroki, biezacy }) {
  return (
    <div className="kroki">
      {kroki.map((k, i) => (
        <div key={k} className={`krok ${i === biezacy ? 'biezacy' : ''} ${i < biezacy ? 'zrobiony' : ''}`}>
          <span className="krok-numer">{i < biezacy ? '✓' : i + 1}</span>
          <span>{k}</span>
        </div>
      ))}
    </div>
  );
}

function NaglowekStrony({ tytul, kontekst, akcje }) {
  return (
    <div className="naglowek-strony">
      <div>
        <h1 className="tytul-ekranu">{tytul}</h1>
        {kontekst && <div className="naglowek-strony-kontekst">{kontekst}</div>}
      </div>
      {akcje && <div className="naglowek-strony-akcje bez-druku">{akcje}</div>}
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   POLA (sekcja 2.6) — projekt od nowa
   Etykieta ZAWSZE nad polem, nigdy jako placeholder.
   ═════════════════════════════════════════════════════ */

function Pole({ etykieta, podpowiedz, blad, echo, wymagane, children }) {
  return (
    <div className="pole">
      {etykieta && (
        <label className="pole-etykieta">
          {etykieta}
          {wymagane && <span className="pole-wymagane"> *</span>}
        </label>
      )}
      {children}
      {blad && <div className="pole-blad">{blad}</div>}
      {!blad && echo && <div className="pole-echo">{echo}</div>}
      {podpowiedz && <div className="pole-podpowiedz">{podpowiedz}</div>}
    </div>
  );
}

/* ── Kalendarz (popover) ────────────────────────────────
   Pisany ręcznie — żadnych bibliotek kalendarza (sekcja 4). */
function Kalendarz({ wartosc, przyWyborze, min, max, przyZamknieciu }) {
  const bazowa = wartosc && wartosc.length === 10 ? wartosc : fmt.dzisIso();
  const [rok, ustawRok] = useState(Number(bazowa.slice(0, 4)));
  const [miesiac, ustawMiesiac] = useState(Number(bazowa.slice(5, 7)) - 1);

  useEscape(() => przyZamknieciu && przyZamknieciu());

  const pierwszy = new Date(Date.UTC(rok, miesiac, 1));
  // Poniedziałek jako pierwszy dzień tygodnia (getUTCDay: niedziela = 0).
  const przesuniecie = (pierwszy.getUTCDay() + 6) % 7;
  const dniWMiesiacu = new Date(Date.UTC(rok, miesiac + 1, 0)).getUTCDate();
  const dzis = fmt.dzisIso();

  function iso(dzien) {
    const dwa = (x) => String(x).padStart(2, '0');
    return `${rok}-${dwa(miesiac + 1)}-${dwa(dzien)}`;
  }
  function przesun(oIle) {
    const m = miesiac + oIle;
    if (m < 0) { ustawMiesiac(11); ustawRok(rok - 1); }
    else if (m > 11) { ustawMiesiac(0); ustawRok(rok + 1); }
    else ustawMiesiac(m);
  }

  return (
    <div className="kalendarz-popover" onMouseDown={(z) => z.stopPropagation()}>
      <div className="kalendarz-pasek">
        <button className="btn btn-maly btn-cichy" onClick={() => przesun(-1)} aria-label="Poprzedni miesiąc">‹</button>
        <span className="kalendarz-miesiac">{MIESIACE_MIANOWNIK[miesiac]} {rok}</span>
        <button className="btn btn-maly btn-cichy" onClick={() => przesun(1)} aria-label="Następny miesiąc">›</button>
      </div>
      <div className="kalendarz-siatka">
        {['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'].map((d) => (
          <div key={d} className="kalendarz-dzien-tygodnia">{d}</div>
        ))}
        {Array.from({ length: przesuniecie }, (_, i) => (
          <div key={`p${i}`} className="kalendarz-dzien pusty" />
        ))}
        {Array.from({ length: dniWMiesiacu }, (_, i) => {
          const dzien = i + 1;
          const d = iso(dzien);
          const poza = (min && d < min) || (max && d > max);
          return (
            <button
              key={dzien}
              className={`kalendarz-dzien ${d === wartosc ? 'wybrany' : ''} ${d === dzis ? 'dzis' : ''}`}
              disabled={poza}
              onClick={() => { przyWyborze(d); przyZamknieciu(); }}
            >
              {dzien}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Pole daty segmentowe DD.MM.RRRR (sekcja 2.6).
 *
 * Trzy sekcje z automatycznym przejściem, wyłącznie cyfry, wklejenie
 * w dowolnym separatorze, strzałki góra/dół zmieniają wartość sekcji.
 * Kalendarz NIE otwiera się sam przy fokusie — jest za osobnym przyciskiem.
 * Pod polem data słownie jako potwierdzenie zrozumienia wpisu.
 *
 * `wartosc`/`przyZmianie` operują na ISO `RRRR-MM-DD` — segmenty są
 * wyłącznie sposobem wpisywania, nie formatem danych.
 */
function PoleDaty({ wartosc, przyZmianie, min, max, blad, skroty = false, autoFocus }) {
  const [dzien, ustawDzien] = useState('');
  const [miesiac, ustawMiesiac] = useState('');
  const [rok, ustawRok] = useState('');
  const [kalendarz, ustawKalendarz] = useState(false);
  const refDzien = useRef(null);
  const refMiesiac = useRef(null);
  const refRok = useRef(null);

  // Synchronizacja z zewnątrz (np. pigułka „dziś", kalendarz, reset formularza).
  useEffect(() => {
    if (wartosc && wartosc.length >= 10) {
      ustawRok(wartosc.slice(0, 4));
      ustawMiesiac(wartosc.slice(5, 7));
      ustawDzien(wartosc.slice(8, 10));
    } else if (!wartosc) {
      ustawRok(''); ustawMiesiac(''); ustawDzien('');
    }
  }, [wartosc]);

  function zglos(d, m, r) {
    if (d.length === 2 && m.length === 2 && r.length === 4) {
      przyZmianie(`${r}-${m}-${d}`);
    } else {
      przyZmianie('');
    }
  }

  function zmien(ktore, surowa) {
    const cyfry = surowa.replace(/\D/g, '');
    if (ktore === 'd') {
      const v = cyfry.slice(0, 2);
      ustawDzien(v);
      zglos(v, miesiac, rok);
      if (v.length === 2) refMiesiac.current && refMiesiac.current.focus();
    } else if (ktore === 'm') {
      const v = cyfry.slice(0, 2);
      ustawMiesiac(v);
      zglos(dzien, v, rok);
      if (v.length === 2) refRok.current && refRok.current.focus();
    } else {
      const v = cyfry.slice(0, 4);
      ustawRok(v);
      zglos(dzien, miesiac, v);
    }
  }

  /** Strzałki góra/dół zmieniają wartość sekcji; Backspace na pustej cofa fokus. */
  function klawisz(ktore, z) {
    const granice = { d: [1, 31], m: [1, 12], r: [1900, 2999] };
    const biezace = { d: dzien, m: miesiac, r: rok }[ktore];
    if (z.key === 'ArrowUp' || z.key === 'ArrowDown') {
      z.preventDefault();
      const [dolna, gorna] = granice[ktore];
      const krok = z.key === 'ArrowUp' ? 1 : -1;
      let nowa = (biezace === '' ? (ktore === 'r' ? Number(fmt.dzisIso().slice(0, 4)) : dolna) : Number(biezace) + krok);
      if (nowa < dolna) nowa = gorna;
      if (nowa > gorna) nowa = dolna;
      const tekst = String(nowa).padStart(ktore === 'r' ? 4 : 2, '0');
      if (ktore === 'd') { ustawDzien(tekst); zglos(tekst, miesiac, rok); }
      else if (ktore === 'm') { ustawMiesiac(tekst); zglos(dzien, tekst, rok); }
      else { ustawRok(tekst); zglos(dzien, miesiac, tekst); }
      return;
    }
    if (z.key === 'Backspace' && biezace === '') {
      if (ktore === 'm') refDzien.current && refDzien.current.focus();
      if (ktore === 'r') refMiesiac.current && refMiesiac.current.focus();
    }
  }

  /** Wklejenie w dowolnym separatorze: 12.03.2026, 12-03-2026, 12/03/2026, 2026-03-12. */
  function wklej(z) {
    const tekst = (z.clipboardData || window.clipboardData).getData('text').trim();
    if (!tekst) return;
    z.preventDefault();
    const czesci = tekst.split(/[^\d]+/).filter(Boolean);
    let d = '';
    let m = '';
    let r = '';
    if (czesci.length === 3) {
      if (czesci[0].length === 4) { [r, m, d] = czesci; } else { [d, m, r] = czesci; }
    } else if (czesci.length === 1 && czesci[0].length === 8) {
      // 12032026 albo 20260312
      const c = czesci[0];
      if (Number(c.slice(0, 4)) > 1900) { r = c.slice(0, 4); m = c.slice(4, 6); d = c.slice(6, 8); }
      else { d = c.slice(0, 2); m = c.slice(2, 4); r = c.slice(4, 8); }
    } else {
      return;
    }
    d = d.padStart(2, '0').slice(0, 2);
    m = m.padStart(2, '0').slice(0, 2);
    r = r.padStart(4, '0').slice(0, 4);
    ustawDzien(d); ustawMiesiac(m); ustawRok(r);
    zglos(d, m, r);
  }

  const slownie = dataSlownie(wartosc);
  const dzis = fmt.dzisIso();

  return (
    <>
      <div className="pole-daty">
        <div className={`data-segmenty ${blad ? 'bledne' : ''}`} onPaste={wklej}>
          <input
            ref={refDzien} className="data-segment" data-szer="2" inputMode="numeric"
            placeholder="DD" value={dzien} autoFocus={autoFocus}
            onChange={(z) => zmien('d', z.target.value)}
            onKeyDown={(z) => klawisz('d', z)}
            aria-label="Dzień"
          />
          <span className="data-rozdzielacz">.</span>
          <input
            ref={refMiesiac} className="data-segment" data-szer="2" inputMode="numeric"
            placeholder="MM" value={miesiac}
            onChange={(z) => zmien('m', z.target.value)}
            onKeyDown={(z) => klawisz('m', z)}
            aria-label="Miesiąc"
          />
          <span className="data-rozdzielacz">.</span>
          <input
            ref={refRok} className="data-segment" data-szer="4" inputMode="numeric"
            placeholder="RRRR" value={rok}
            onChange={(z) => zmien('r', z.target.value)}
            onKeyDown={(z) => klawisz('r', z)}
            aria-label="Rok"
          />
        </div>

        <div className="kalendarz-kotwica">
          <button
            className="btn btn-maly"
            onClick={() => ustawKalendarz((k) => !k)}
            aria-label="Otwórz kalendarz"
            aria-expanded={kalendarz}
          >
            ▦
          </button>
          {kalendarz && (
            <Kalendarz
              wartosc={wartosc}
              min={min}
              max={max}
              przyWyborze={przyZmianie}
              przyZamknieciu={() => ustawKalendarz(false)}
            />
          )}
        </div>

        {skroty && (
          <div className="pigulki-skrotow">
            <button className="btn btn-maly btn-cichy" onClick={() => przyZmianie(dzis)}>dziś</button>
            <button className="btn btn-maly btn-cichy" onClick={() => przyZmianie(dodajDniIso(dzis, -1))}>wczoraj</button>
          </div>
        )}
      </div>
      {slownie && !blad && <div className="pole-echo">{slownie}</div>}
    </>
  );
}

/**
 * Pole liczbowe (2.6): do prawej, w monie, separator tysięcy na bieżąco,
 * jednostka jako sufiks WEWNĄTRZ pola.
 *
 * `wartosc`/`przyZmianie` operują na liczbie (albo `null`), nie na tekście
 * z separatorami — separator jest wyłącznie sposobem wyświetlania.
 */
function PoleLiczbowe({ wartosc, przyZmianie, sufiks, blad, min, max, autoFocus, placeholder }) {
  const [tekst, ustawTekst] = useState('');

  useEffect(() => {
    if (wartosc === null || wartosc === undefined || wartosc === '') ustawTekst('');
    else ustawTekst(Number(wartosc).toLocaleString('pl-PL'));
  }, [wartosc]);

  function zmien(surowa) {
    const cyfry = surowa.replace(/\D/g, '');
    if (cyfry === '') { ustawTekst(''); przyZmianie(null); return; }
    let n = Number(cyfry);
    if (min !== undefined && n < min) n = min;
    if (max !== undefined && n > max) n = max;
    ustawTekst(n.toLocaleString('pl-PL'));
    przyZmianie(n);
  }

  return (
    <div className={`pole-liczbowe ${blad ? 'bledne' : ''}`}>
      <input
        type="text" inputMode="numeric" value={tekst} autoFocus={autoFocus} placeholder={placeholder}
        onChange={(z) => zmien(z.target.value)}
      />
      {sufiks && <span className="pole-liczbowe-sufiks">{sufiks}</span>}
    </div>
  );
}

/** Kwota w złotych; na zewnątrz GROSZE (reguła domenowa nr 5). */
function PoleKwoty({ grosze, przyZmianie, blad }) {
  const [tekst, ustawTekst] = useState('');

  useEffect(() => {
    if (grosze === null || grosze === undefined || grosze === '') ustawTekst('');
    else ustawTekst((Number(grosze) / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }, [grosze]);

  function zmien(surowa) {
    const czyste = surowa.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
    if (czyste === '') { ustawTekst(''); przyZmianie(null); return; }
    ustawTekst(surowa);
    const zl = Number(czyste);
    przyZmianie(Number.isFinite(zl) ? Math.round(zl * 100) : null);
  }

  function domknij() {
    if (grosze === null || grosze === undefined) return;
    ustawTekst((Number(grosze) / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }

  return (
    <div className={`pole-liczbowe ${blad ? 'bledne' : ''}`}>
      <input type="text" inputMode="decimal" value={tekst} onChange={(z) => zmien(z.target.value)} onBlur={domknij} />
      <span className="pole-liczbowe-sufiks">zł</span>
    </div>
  );
}

/**
 * Wybór z kartoteki (2.6). Podpowiedzi od TRZECIEGO znaku; wynik pokazuje
 * nazwisko, zamaskowany identyfikator i liczbę spółek, w których osoba już
 * występuje (reguła domenowa nr 10 — jeden inwestor wpisywany raz).
 */
function WyborZKartoteki({ wartosc, przyZmianie, placeholder = 'Zacznij pisać nazwisko…', wyklucz = [] }) {
  const [szukaj, ustawSzukaj] = useState('');
  const [wyniki, ustawWyniki] = useState([]);
  const [otwarte, ustawOtwarte] = useState(false);
  const [podswietlony, ustawPodswietlony] = useState(0);
  const [wybrana, ustawWybrana] = useState(null);

  useEffect(() => {
    if (!wartosc) { ustawWybrana(null); return; }
    if (wybrana && wybrana.id === wartosc) return;
    API.get(`/api/psa/osoby/${wartosc}`)
      .then((o) => ustawWybrana(o.osoba))
      .catch(() => ustawWybrana(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wartosc]);

  // Podpowiedzi dopiero od trzeciego znaku — przy 500 rejestrach lista po
  // jednej literze jest bezużyteczna, a odpytywanie API kosztowne.
  useEffect(() => {
    if (szukaj.trim().length < 3) { ustawWyniki([]); return undefined; }
    const uchwyt = setTimeout(() => {
      API.get(`/api/psa/osoby?q=${encodeURIComponent(szukaj.trim())}`)
        .then((o) => {
          ustawWyniki(o.osoby.filter((x) => !wyklucz.includes(x.id)));
          ustawPodswietlony(0);
        })
        .catch(() => ustawWyniki([]));
    }, 180);
    return () => clearTimeout(uchwyt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [szukaj]);

  function wybierz(osoba) {
    przyZmianie(osoba.id);
    ustawWybrana(osoba);
    ustawSzukaj('');
    ustawOtwarte(false);
  }

  function klawisz(z) {
    if (!wyniki.length) return;
    if (z.key === 'ArrowDown') { z.preventDefault(); ustawPodswietlony((p) => Math.min(p + 1, wyniki.length - 1)); }
    if (z.key === 'ArrowUp') { z.preventDefault(); ustawPodswietlony((p) => Math.max(p - 1, 0)); }
    if (z.key === 'Enter') { z.preventDefault(); wybierz(wyniki[podswietlony]); }
  }

  if (wybrana) {
    return (
      <div className="kartoteka-wybrana">
        <span>
          {wybrana.oznaczenie}
          {wybrana.jawny_identyfikator && (
            <span className="dane wyciszony"> · {wybrana.jawny_identyfikator}</span>
          )}
        </span>
        <button className="btn btn-maly btn-cichy" onClick={() => { przyZmianie(null); ustawWybrana(null); }}>
          zmień
        </button>
      </div>
    );
  }

  return (
    <div className="kartoteka">
      <input
        type="search"
        value={szukaj}
        placeholder={placeholder}
        onChange={(z) => { ustawSzukaj(z.target.value); ustawOtwarte(true); }}
        onFocus={() => ustawOtwarte(true)}
        onKeyDown={klawisz}
      />
      {otwarte && szukaj.trim().length >= 3 && (
        <div className="kartoteka-lista">
          {wyniki.length === 0 ? (
            <div className="kartoteka-poz wyciszony">Nikt nie pasuje — załóż nową osobę w kartotece.</div>
          ) : (
            wyniki.map((o, i) => (
              <button
                key={o.id}
                className={`kartoteka-poz ${i === podswietlony ? 'podswietlona' : ''}`}
                onMouseDown={(z) => { z.preventDefault(); wybierz(o); }}
              >
                <div>{o.oznaczenie}</div>
                <div className="kartoteka-poz-meta">
                  {o.jawny_identyfikator || 'bez identyfikatora'}
                  {o.liczba_spolek !== undefined && ` · w ${o.liczba_spolek} ${fmt.odmien(o.liczba_spolek, 'spółce', 'spółkach', 'spółkach')}`}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   PALETA POLECEŃ (2.3) — Ctrl/⌘+K
   ═════════════════════════════════════════════════════ */

function PaletaPolecen({ przyZamknieciu }) {
  const [pytanie, ustawPytanie] = useState('');
  const [wyniki, ustawWyniki] = useState({ spolki: [], osoby: [], sprawy: [] });
  const [podswietlony, ustawPodswietlony] = useState(0);

  useEscape(przyZamknieciu);

  useEffect(() => {
    const q = pytanie.trim();
    if (q.length < 2) { ustawWyniki({ spolki: [], osoby: [], sprawy: [] }); return undefined; }
    const uchwyt = setTimeout(() => {
      Promise.all([
        API.get(`/api/psa/spolki?q=${encodeURIComponent(q)}`).catch(() => ({ spolki: [] })),
        API.get(`/api/psa/osoby?q=${encodeURIComponent(q)}`).catch(() => ({ osoby: [] })),
      ]).then(([s, o]) => {
        ustawWyniki({
          spolki: (s.spolki || []).slice(0, 6),
          osoby: (o.osoby || []).slice(0, 5),
          sprawy: [],
        });
        ustawPodswietlony(0);
      });
    }, 140);
    return () => clearTimeout(uchwyt);
  }, [pytanie]);

  // Płaska lista pozycji — indeks podświetlenia biegnie przez wszystkie grupy.
  const pozycje = useMemo(() => {
    const lista = [];
    for (const s of wyniki.spolki) {
      lista.push({ grupa: 'Spółki', etykieta: s.nazwa, meta: s.krs ? `KRS ${s.krs}` : '', idz: `/spolki/${s.id}` });
    }
    for (const o of wyniki.osoby) {
      lista.push({ grupa: 'Osoby', etykieta: o.oznaczenie, meta: o.jawny_identyfikator || '', idz: '/osoby' });
    }
    if (pytanie.trim().length < 2) {
      lista.push({ grupa: 'Polecenia', etykieta: 'Kolejka spraw', meta: '', idz: '/sprawy' });
      lista.push({ grupa: 'Polecenia', etykieta: 'Spółki', meta: '', idz: '/spolki' });
      lista.push({ grupa: 'Polecenia', etykieta: 'Kartoteka osób', meta: '', idz: '/osoby' });
      lista.push({ grupa: 'Polecenia', etykieta: 'Nowa spółka', meta: '', idz: '/spolki/nowa' });
    }
    return lista;
  }, [wyniki, pytanie]);

  function uruchom(p) {
    idz(p.idz);
    przyZamknieciu();
  }

  function klawisz(z) {
    if (z.key === 'ArrowDown') { z.preventDefault(); ustawPodswietlony((p) => Math.min(p + 1, pozycje.length - 1)); }
    if (z.key === 'ArrowUp') { z.preventDefault(); ustawPodswietlony((p) => Math.max(p - 1, 0)); }
    if (z.key === 'Enter' && pozycje[podswietlony]) { z.preventDefault(); uruchom(pozycje[podswietlony]); }
  }

  let ostatniaGrupa = null;

  return (
    <div
      className="paleta-nakladka"
      onMouseDown={(z) => { if (z.target === z.currentTarget) przyZamknieciu(); }}
    >
      <div className="paleta">
        <input
          className="paleta-pole"
          autoFocus
          value={pytanie}
          placeholder="Szukaj spółki, osoby albo sprawy…"
          onChange={(z) => ustawPytanie(z.target.value)}
          onKeyDown={klawisz}
        />
        <div className="paleta-wyniki">
          {pozycje.length === 0 && pytanie.trim().length >= 2 && (
            <div className="paleta-poz wyciszony">Nic nie pasuje do „{pytanie.trim()}".</div>
          )}
          {pozycje.map((p, i) => {
            const naglowek = p.grupa !== ostatniaGrupa ? p.grupa : null;
            ostatniaGrupa = p.grupa;
            return (
              <React.Fragment key={`${p.grupa}-${p.etykieta}-${i}`}>
                {naglowek && <div className="paleta-grupa">{naglowek}</div>}
                <button
                  className={`paleta-poz ${i === podswietlony ? 'podswietlona' : ''}`}
                  onMouseDown={(z) => { z.preventDefault(); uruchom(p); }}
                  onMouseEnter={() => ustawPodswietlony(i)}
                >
                  <span>{p.etykieta}</span>
                  {p.meta && <span className="paleta-poz-meta">{p.meta}</span>}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="paleta-stopka">
          <span><span className="klawisz">↑</span> <span className="klawisz">↓</span> nawigacja</span>
          <span><span className="klawisz">↵</span> otwórz</span>
          <span><span className="klawisz">esc</span> zamknij</span>
        </div>
      </div>
    </div>
  );
}

/** Globalny skrót Ctrl/⌘+K. Zwraca stan i sterowanie paletą. */
function usePaletaPolecen() {
  const [otwarta, ustawOtwarta] = useState(false);
  useEffect(() => {
    const przy = (z) => {
      if ((z.metaKey || z.ctrlKey) && z.key.toLowerCase() === 'k') {
        z.preventDefault();
        ustawOtwarta((o) => !o);
      }
    };
    window.addEventListener('keydown', przy);
    return () => window.removeEventListener('keydown', przy);
  }, []);
  return { otwarta, otworz: () => ustawOtwarta(true), zamknij: () => ustawOtwarta(false) };
}

window.Spinner = Spinner;
window.Karta = Karta;
window.Pigulka = Pigulka;
window.Komunikat = Komunikat;
window.Pusto = Pusto;
window.Modal = Modal;
window.Sekcja = Sekcja;
window.Kroki = Kroki;
window.NaglowekStrony = NaglowekStrony;
window.Pole = Pole;
window.PoleDaty = PoleDaty;
window.PoleLiczbowe = PoleLiczbowe;
window.PoleKwoty = PoleKwoty;
window.Kalendarz = Kalendarz;
window.WyborZKartoteki = WyborZKartoteki;
window.PaletaPolecen = PaletaPolecen;
window.usePaletaPolecen = usePaletaPolecen;
window.dataSlownie = dataSlownie;
