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
   IKONY
   Rysowane ręcznie jako ścieżki SVG — sesja zabrania dokładania
   bibliotek ikon. Jeden zestaw, jedna siatka 24×24, jedna grubość
   kreski; kolor zawsze dziedziczony (`currentColor`), więc ikona
   przejmuje barwę kontekstu i nie trzeba jej nigdzie kolorować.
   ═════════════════════════════════════════════════════ */

const SCIEZKI_IKON = {
  pulpit: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  sprawy: 'M4 4h11l5 5v11H4zM15 4v5h5M8 13h8M8 17h5',
  spolki: 'M4 20V6l7-3v17M11 20h9V10l-9-3M7 9v.01M7 13v.01M7 17v.01M15 12v.01M15 16v.01',
  osoby: 'M8 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 8 11ZM2.5 20v-1.4A4.6 4.6 0 0 1 7.1 14h1.8a4.6 4.6 0 0 1 4.6 4.6V20M16 4.8a3.2 3.2 0 0 1 0 6.2M17.5 14.2A4.6 4.6 0 0 1 21.5 18.7V20',
  akcje: 'M3.5 8.5 12 4.5l8.5 4-8.5 4zM3.5 12.5 12 16.5l8.5-4M3.5 16.5 12 20.5l8.5-4',
  oplaty: 'M5 4h14v16l-2.3-1.6L14.4 20l-2.4-1.6L9.6 20l-2.3-1.6L5 20zM9 9h6M9 13h6',
  stawki: 'M4 7h9M17 7h3M4 12h3M11 12h9M4 17h7M15 17h5M15 5v4M9 10v4M13 15v4',
  szablony: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h4',
  uzytkownicy: 'M9 11.5a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8ZM3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20M18 8.5v5M20.5 11h-5',
  podglad: 'M4 5h7v6H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 13h7v6H4z',
  szukaj: 'M11 18.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM20.5 20.5l-4.2-4.2',
  dzwonek: 'M18 8.8a6 6 0 1 0-12 0c0 5-2 6.4-2 6.4h16s-2-1.4-2-6.4M13.7 19a2 2 0 0 1-3.4 0',
  plus: 'M12 5v14M5 12h14',
  strzalkaPrawo: 'm9 5 7 7-7 7',
  strzalkaLewo: 'm15 5-7 7 7 7',
  strzalkaDol: 'm6 9 6 6 6-6',
  kalendarz: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4',
  wyloguj: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10',
  dokument: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h4',
  zdarzenie: 'M3 12h4l2.5-7 5 14L17 12h4',
  zegar: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3.2 1.9',
  wykres: 'M3 20h18M6 16l4-4.5 3.5 3L20 7',
  sprawdz: 'm5 12.5 4.5 4.5L19 7',
  ostrzezenie: 'M12 4 2.8 20h18.4zM12 10v4M12 17.5v.01',
  archiwum: 'M3 6h18v4H3zM5 10v10h14V10M10 14h4',
  pobierz: 'M12 4v11m0 0 4-4m-4 4-4-4M4 19h16',
  wiecej: 'M6 12v.01M12 12v.01M18 12v.01',
  znak: 'M12 2.5 20.5 7v10L12 21.5 3.5 17V7zM12 8.5 16 11v5l-4 2.2L8 16v-5z',
  pusto: 'M4 7h16v13H4zM4 7l2-3h12l2 3M12 11v5M9.5 13.5h5',
  popraw: 'M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4v4.5H9',
  koperta: 'M3 6h18v12H3zM3 6.5l9 6 9-6',
  telefon: 'M5 4h4l1 4-2 1.5a10 10 0 0 0 6.5 6.5L16 14l4 1v4h-2A13 13 0 0 1 5 6z',
  pinezka: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  globus: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.4 9h17.2M3.4 15h17.2M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  oko: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  okoPrzekreslone: 'M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2M6.5 6.7C4 8.3 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2M10.6 5.1c.5-.1.9-.1 1.4-.1 6.4 0 10 7 10 7-.5.9-1.3 2.1-2.5 3.2',
  pomoc: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.2 9a2.8 2.8 0 1 1 3.8 2.6c-.8.3-1 .9-1 1.7v.3M12 16.5v.01',
};

/**
 * Ikona. `nazwa` z `SCIEZKI_IKON`, `rozmiar` w pikselach (domyślnie 18).
 * `aria-hidden`, bo ikony w tej aplikacji zawsze towarzyszą tekstowi —
 * nigdy nie są jedynym nośnikiem znaczenia.
 */
function Ikona({ nazwa, rozmiar = 18, grubosc = 1.75 }) {
  const d = SCIEZKI_IKON[nazwa];
  if (!d) return null;
  return (
    <svg
      width={rozmiar} height={rozmiar} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={grubosc} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

/* ═════════════════════════════════════════════════════
   PRYMITYWY
   ═════════════════════════════════════════════════════ */

/**
 * Stan ładowania. Szkielet treści zamiast kręcącego się kółka (FAZA 1 pkt 5):
 * zajmuje mniej więcej tyle miejsca co lista, która się pojawi, więc układ
 * nie skacze po wczytaniu danych (CLS), a oko od razu widzi kształt ekranu.
 * Czytnik ekranu dostaje jedno zdanie zamiast pustki.
 */
function Spinner({ wierszy = 4 }) {
  return (
    <div className="szkielet" role="status" aria-live="polite">
      <span className="sr-only">Wczytywanie…</span>
      {Array.from({ length: wierszy }, (_, i) => (
        <div key={i} className="szkielet-wiersz" style={{ width: `${92 - (i % 3) * 14}%` }} aria-hidden="true" />
      ))}
    </div>
  );
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
  const o = ODMIANY_PIGULKI[odmiana] || '';
  return <span className={`pigulka ${o ? `pigulka-${o}` : ''}`}>{children}</span>;
}

/* Dawne nazwy odmian `Znacznik` (ui.js, usunięty w FAZIE 1) sprowadzone do
   czterech znaczeń rejestru — na wypadek danych, które je jeszcze niosą. */
const ODMIANY_PIGULKI = {
  rejestr: 'rejestr', mosiadz: 'mosiadz', sygnal: 'sygnal',
  zielony: 'rejestr', oliwka: 'mosiadz', bordo: 'sygnal',
};

const NAZWY_STATUSU = {
  aktywna: 'aktywna',
  w_likwidacji: 'w likwidacji',
  zawieszona: 'zawieszona',
  wykreslona: 'wykreślona',
  umorzona: 'umorzona',
  w_umarzaniu: 'w umarzaniu',
};
const ODMIANY_STATUSU = {
  aktywna: 'rejestr', w_likwidacji: 'mosiadz', w_umarzaniu: 'mosiadz', wykreslona: 'sygnal', umorzona: 'sygnal',
};

function StatusSpolki({ status }) {
  return <Pigulka odmiana={ODMIANY_STATUSU[status]}>{NAZWY_STATUSU[status] || status}</Pigulka>;
}

const NAZWY_AML = { brak: 'AML: brak', wykonane: 'AML: wykonane', niemozliwe: 'AML: niemożliwe' };
const ODMIANY_AML = { brak: 'mosiadz', wykonane: 'rejestr', niemozliwe: 'sygnal' };

function StatusAml({ status }) {
  if (!status) return null;
  return <Pigulka odmiana={ODMIANY_AML[status]}>{NAZWY_AML[status] || status}</Pigulka>;
}

/** Sygnał dezaktualizacji przeglądu AML (blok C1, sesja 8) — NIE blokada, tylko przypomnienie. */
function ZnacznikPrzegladuAml({ wymaga }) {
  if (!wymaga) return null;
  return <Pigulka odmiana="mosiadz">wymaga przeglądu</Pigulka>;
}

/**
 * Komunikat błędu bywa renderowany na GÓRZE długiego formularza, a przycisk
 * zapisu jest na jego DOLE — po nieudanym zapisie użytkownik zostaje przy
 * przycisku i nie widzi powodu odmowy (w modalu osoby komunikat lądował 446 px
 * ponad krawędzią okna). Dlatego błąd sam przewija się w pole widzenia.
 * Dotyczy wyłącznie odmiany „blad": pozostałe są tłem, nie odpowiedzią na akcję.
 */
function Komunikat({ odmiana = 'info', tytul, tresc, lista }) {
  const ref = useRef(null);
  const sygnatura = odmiana === 'blad' ? `${tytul || ''}|${tresc || ''}|${(lista || []).join('|')}` : '';

  useEffect(() => {
    if (!sygnatura || !ref.current) return;
    ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [sygnatura]);

  if (!tresc && (!lista || lista.length === 0)) return null;
  return (
    <div className={`komunikat komunikat-${odmiana}`} ref={ref}>
      {tytul && <div className="komunikat-tytul">{tytul}</div>}
      {tresc && <div>{tresc}</div>}
      {lista && lista.length > 0 && (
        <ul>{lista.map((p, i) => <li key={i}>{p}</li>)}</ul>
      )}
    </div>
  );
}

/** Pusty stan (2.7): zdanie mówiące CO ZROBIĆ plus przycisk. Nigdy „Brak danych". */
/**
 * Licznik przy pozycji nawigacji (FAZA 1 pkt 9): liczba spraw WYMAGAJĄCYCH
 * DZIAŁANIA tej strony — kancelarii albo klienta. Zero nie rysuje nic. Opis
 * trafia do czytnika ekranu, bo sama liczba przy „Wnioski" nic nie mówi.
 */
function Licznik({ wartosc, opis }) {
  if (!wartosc) return null;
  return (
    <span className="licznik" title={opis ? `${wartosc} ${opis}` : undefined}>
      <span aria-hidden="true">{wartosc}</span>
      <span className="sr-only">{opis ? `${wartosc} ${opis}` : `${wartosc} do zrobienia`}</span>
    </span>
  );
}

/** Błędy blokujące i ostrzeżenia — dwie różne rzeczy, dwa różne komunikaty. */
function Wyniki({ bledy, ostrzezenia }) {
  return (
    <>
      <Komunikat
        odmiana="blad"
        tytul={bledy && bledy.length === 1 ? 'Wpis nie może zostać dokonany:' : 'Wpis nie może zostać dokonany — przeszkody:'}
        lista={bledy}
      />
      <Komunikat odmiana="uwaga" tytul="Do sprawdzenia:" lista={ostrzezenia} />
    </>
  );
}

function Pusto({ tytul, opis, akcja, ikona = 'pusto' }) {
  return (
    <div className="pusto">
      {ikona && <div className="pusto-ikona"><Ikona nazwa={ikona} rozmiar={22} /></div>}
      <div className="pusto-tytul">{tytul}</div>
      {opis && <div className="pusto-opis">{opis}</div>}
      {akcja}
    </div>
  );
}

/**
 * Okno nad treścią. Modal wyłącznie dla krótkich potwierdzeń (FAZA 1 pkt 5);
 * formularz dłuższy niż cztery pola otwiera się jako PANEL BOCZNY (`panel`)
 * — tło zostaje widoczne, panel ma pełną wysokość i własne przewijanie, a
 * przyciski stopki są zawsze na dole ekranu.
 */
function Modal({ tytul, children, stopka, przyZamknieciu, szerokosc, panel = false }) {
  useEscape(() => przyZamknieciu && przyZamknieciu());
  const idTytulu = useId();
  const ref = useRef(null);
  // Fokus wchodzi do okna, a po zamknięciu wraca tam, skąd przyszedł.
  useEffect(() => {
    const poprzedni = document.activeElement;
    const pierwsze = ref.current && ref.current.querySelector('input:not([type=hidden]):not([disabled]), select, textarea, button');
    if (pierwsze) pierwsze.focus({ preventScroll: true });
    return () => { if (poprzedni && poprzedni.focus) poprzedni.focus({ preventScroll: true }); };
  }, []);
  return (
    <div
      className={`nakladka ${panel ? 'nakladka-panel' : ''}`}
      onMouseDown={(z) => { if (z.target === z.currentTarget && przyZamknieciu) przyZamknieciu(); }}
    >
      <div
        ref={ref}
        className={panel ? 'panel-boczny' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tytul ? idTytulu : undefined}
        style={szerokosc && !panel ? { maxWidth: szerokosc } : undefined}
      >
        {tytul && (
          <div className="modal-tytul" id={idTytulu}>
            {tytul}
            {panel && przyZamknieciu && (
              <button type="button" className="btn btn-maly btn-cichy panel-zamknij" onClick={przyZamknieciu} aria-label="Zamknij panel">✕</button>
            )}
          </div>
        )}
        <div className={panel ? 'panel-tresc' : undefined}>{children}</div>
        {stopka && <div className="modal-stopka">{stopka}</div>}
      </div>
    </div>
  );
}

/**
 * Rozwijana sekcja z własnym przyciskiem akcji w nagłówku.
 *
 * Przełącznik jest OSOBNYM przyciskiem obok akcji, a nie przyciskiem, który
 * je obejmuje: przycisk w przycisku to nieprawidłowy HTML, a odkąd każdy
 * rejestr w kokpicie ma w nagłówku swój wpis („Nowa emisja", „Zastaw lub
 * użytkowanie"), zdarzałoby się to na każdej sekcji.
 */
function Sekcja({ tytul, licznik, domyslnieOtwarta = false, akcje, children }) {
  const [otwarta, ustawOtwarta] = useState(domyslnieOtwarta);
  return (
    <div className="sekcja">
      <div className="sekcja-naglowek">
        <button
          className="sekcja-przelacznik"
          aria-expanded={otwarta}
          onClick={() => ustawOtwarta((o) => !o)}
        >
          <span className="sekcja-tytul">
            <span className={`strzalka ${otwarta ? 'otwarta' : ''}`}><Ikona nazwa="strzalkaPrawo" rozmiar={14} /></span>
            {tytul}
            {licznik !== undefined && licznik !== null && <Pigulka>{licznik}</Pigulka>}
          </span>
        </button>
        {/* Akcje pokazują się DOPIERO po rozwinięciu. Zwinięty kokpit
            wystawiał siedem przycisków wpisu naraz — „Nowa emisja",
            „Wpisz uprawnienie", „Zastaw lub użytkowanie" — czyli listę
            czynności rejestrowych zamiast spisu treści rejestru. Kto chce
            czegoś dokonać, najpierw otwiera rejestr, którego to dotyczy. */}
        {akcje && otwarta && <span className="rzad">{akcje}</span>}
      </div>
      {otwarta && <div>{children}</div>}
    </div>
  );
}

/**
 * Pasek kroków kreatora. Z `przyWyborze` kroki są KLIKALNE (zasada 0.4 pkt 8
 * — nie da się utknąć): wstecz zawsze, do przodu do najdalszego kroku już
 * osiągniętego (`osiagniety`, domyślnie bieżący).
 */
function Kroki({ kroki, biezacy, przyWyborze, osiagniety }) {
  const najdalej = Math.max(biezacy, osiagniety ?? biezacy);
  return (
    <ol className="kroki" aria-label="Kroki">
      {kroki.map((k, i) => {
        const klasa = `krok ${i === biezacy ? 'biezacy' : ''} ${i < biezacy ? 'zrobiony' : ''}`;
        const tresc = (
          <>
            <span className="krok-numer" aria-hidden="true">{i < biezacy ? '✓' : i + 1}</span>
            <span>{k}</span>
          </>
        );
        const klikalny = przyWyborze && i !== biezacy && i <= najdalej;
        return (
          <li key={k} className={klasa} aria-current={i === biezacy ? 'step' : undefined}>
            {klikalny
              ? <button type="button" className="krok-przycisk" onClick={() => przyWyborze(i)}>{tresc}</button>
              : tresc}
          </li>
        );
      })}
    </ol>
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
   KOMPONENTY UKŁADU
   ═════════════════════════════════════════════════════ */

/**
 * Kafel statystyki: etykieta, liczba, zmiana pod spodem, ikona w kwadracie.
 * Kafelek ikony ma jeden wspólny odcień dla wszystkich kafli — kolor w tej
 * aplikacji niesie znaczenie, a tutaj nie miałby żadnego (patrz nagłówek
 * rejestr.css). Kafle rozróżnia ikona i liczba, nie barwa.
 */
function Kafel({ etykieta, wartosc, delta, deltaOdmiana, ikona, przyKlik }) {
  const tresc = (
    <>
      <div style={{ minWidth: 0 }}>
        <div className="kafel-etykieta">{etykieta}</div>
        <div className="kafel-wartosc">{wartosc}</div>
        {delta && <div className={`kafel-delta ${deltaOdmiana || ''}`}>{delta}</div>}
      </div>
      {ikona && <div className="kafel-ikona"><Ikona nazwa={ikona} rozmiar={20} /></div>}
    </>
  );
  if (przyKlik) {
    return (
      <button className="kafel" onClick={przyKlik} style={{ cursor: 'pointer', font: 'inherit', textAlign: 'left' }}>
        {tresc}
      </button>
    );
  }
  return <div className="kafel">{tresc}</div>;
}

/** Wiersz listy z kafelkiem ikony — aktywne sprawy, dokumenty, powiadomienia. */
function WierszListy({ ikona, tytul, podtytul, prawo, data, przyKlik }) {
  return (
    <button className="wiersz" onClick={przyKlik} disabled={!przyKlik}>
      {ikona && <span className="wiersz-ikona"><Ikona nazwa={ikona} rozmiar={17} /></span>}
      <span className="wiersz-tresc">
        <span className="wiersz-tytul" style={{ display: 'block' }} title={typeof tytul === 'string' ? tytul : undefined}>{tytul}</span>
        {podtytul && (
          <span className="wiersz-podtytul" style={{ display: 'block' }} title={typeof podtytul === 'string' ? podtytul : undefined}>
            {podtytul}
          </span>
        )}
      </span>
      <span className="wiersz-prawo">
        {prawo}
        {data && <span className="wiersz-data">{data}</span>}
      </span>
    </button>
  );
}

/**
 * Pasek metryki: pary etykieta/wartość w pionie. Wspólny dla kokpitu spółki
 * (kancelaria), profilu osoby (K4) i ekranów „Konto"/„Pomoc" w portalu
 * (Faza 4) — przeniesiony tutaj z `kokpit.js`, bo `kokpit.js` nie wchodzi
 * do paczki portalu (`narzedzia/buduj-front.js`).
 */
function MetrykaPoz({ etykieta, wartosc, dane, podpowiedz }) {
  return (
    <div className="metryka-pion-poz">
      <div className="metryka-pion-etykieta">{etykieta}</div>
      <div className={`metryka-pion-wartosc ${dane ? 'dane' : ''}`}>{wartosc || '—'}</div>
      {podpowiedz && <div className="podstawa-prawna">{podpowiedz}</div>}
    </div>
  );
}

/** Zakładki wewnątrz ekranu szczegółu. */
function Zakladki({ zakladki, biezaca, przyZmianie }) {
  return (
    <div className="zakladki" role="tablist">
      {zakladki.map((z) => (
        <button
          key={z.kod}
          role="tab"
          aria-selected={z.kod === biezaca}
          className={`zakladka ${z.kod === biezaca ? 'aktywna' : ''}`}
          onClick={() => przyZmianie(z.kod)}
        >
          {z.nazwa}
          {z.licznik !== undefined && z.licznik !== null && <Pigulka>{z.licznik}</Pigulka>}
        </button>
      ))}
    </div>
  );
}

/** Pasek metryki: pary etykieta/wartość w jednym rzędzie, pod tytułem ekranu. */
function Metryka({ pozycje }) {
  return (
    <div className="metryka">
      {pozycje.filter(Boolean).map((p, i) => (
        <div className="metryka-poz" key={i}>
          <div className="metryka-etykieta">{p.etykieta}</div>
          <div className={`metryka-wartosc ${p.dane ? 'dane' : ''}`}>{p.wartosc || '—'}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Jedna para „etykieta — wartość" wewnątrz listy `<dl className="pary">`.
 * Komponent był używany (ekran „Stawki i terminy"), ale nigdzie nie
 * zdefiniowany — przez co cały ekran wywracał się na `ReferenceError`
 * i pokazywał pustą stronę.
 */
function Para({ etykieta, dane = false, children }) {
  return (
    <>
      <dt>{etykieta}</dt>
      <dd className={dane ? 'kol-dane' : undefined}>{children}</dd>
    </>
  );
}

/** Pole szukania z ikoną w środku — używane w paskach narzędzi list. */
function Szukajka({ wartosc, przyZmianie, placeholder = 'Szukaj…' }) {
  return (
    <div className="szukajka">
      <Ikona nazwa="szukaj" rozmiar={16} />
      <input type="search" value={wartosc} placeholder={placeholder} onChange={(z) => przyZmianie(z.target.value)} />
    </div>
  );
}

/** Lista szybkich akcji w prawej szynie. */
function SzybkieAkcje({ akcje }) {
  return (
    <div className="szybkie">
      {akcje.map((a) => (
        <button key={a.nazwa} className="szybkie-poz" onClick={a.przyKlik}>
          <Ikona nazwa={a.ikona || 'plus'} rozmiar={16} />
          <span>{a.nazwa}</span>
        </button>
      ))}
    </div>
  );
}

/** Stronicowanie tabeli: zakres po lewej, numery po prawej. */
function Stronicowanie({ strona, stron, odPozycji, doPozycji, razem, przyZmianie }) {
  if (stron <= 1) {
    return (
      <div className="stronicowanie">
        <span>{razem === 0 ? 'Brak pozycji' : `${odPozycji}–${doPozycji} z ${razem}`}</span>
      </div>
    );
  }
  // Przy wielu stronach pokazujemy okno wokół bieżącej, z wielokropkiem.
  const numery = [];
  const dodaj = (n) => { if (!numery.includes(n)) numery.push(n); };
  dodaj(1);
  for (let n = strona - 1; n <= strona + 1; n += 1) if (n > 1 && n < stron) dodaj(n);
  dodaj(stron);
  numery.sort((a, b) => a - b);

  return (
    <div className="stronicowanie">
      <span>{odPozycji}–{doPozycji} z {razem}</span>
      <div className="strony">
        <button className="strona" disabled={strona === 1} onClick={() => przyZmianie(strona - 1)} aria-label="Poprzednia strona">
          <Ikona nazwa="strzalkaLewo" rozmiar={14} />
        </button>
        {numery.map((n, i) => (
          <React.Fragment key={n}>
            {i > 0 && numery[i - 1] !== n - 1 && <span className="wyciszony">…</span>}
            <button className={`strona ${n === strona ? 'aktywna' : ''}`} onClick={() => przyZmianie(n)}>{n}</button>
          </React.Fragment>
        ))}
        <button className="strona" disabled={strona === stron} onClick={() => przyZmianie(strona + 1)} aria-label="Następna strona">
          <Ikona nazwa="strzalkaPrawo" rozmiar={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * Wykres iskrowy — czysty SVG, bez bibliotek wykresów.
 * `punkty` to tablica liczb; skala dobiera się do zakresu danych.
 */
function Iskra({ punkty, podpisy }) {
  if (!punkty || punkty.length < 2) return null;
  const SZ = 600;
  const WY = 64;
  const margines = 4;
  const maks = Math.max(...punkty);
  const min = Math.min(...punkty);
  const rozpietosc = maks - min || 1;
  const x = (i) => (i / (punkty.length - 1)) * SZ;
  const y = (v) => WY - margines - ((v - min) / rozpietosc) * (WY - margines * 2);

  const linia = punkty.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const wypelnienie = `${linia} L${SZ},${WY} L0,${WY} Z`;

  return (
    <div>
      <svg className="iskra" viewBox={`0 0 ${SZ} ${WY}`} preserveAspectRatio="none" aria-hidden="true">
        <path className="iskra-wypelnienie" d={wypelnienie} />
        <path className="iskra-linia" d={linia} vectorEffect="non-scaling-stroke" />
        <circle className="iskra-punkt" cx={x(punkty.length - 1)} cy={y(punkty[punkty.length - 1])} r="3" />
      </svg>
      {podpisy && (
        <div className="rzad-rozdzielony" style={{ marginTop: 'var(--od-4)' }}>
          {podpisy.map((p, i) => <span key={i} className="podstawa-prawna">{p}</span>)}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════
   POLA (sekcja 2.6) — projekt od nowa
   Etykieta ZAWSZE nad polem, nigdy jako placeholder.
   ═════════════════════════════════════════════════════ */

/**
 * Pole formularza — wzorzec GOV.UK Design System (FAZA 1 pkt 3):
 *   - etykieta nad polem, powiązana z nim (`for`/`id`);
 *   - oznaczamy pola OPCJONALNE, nie obowiązkowe — gwiazdki nie ma;
 *   - komunikat błędu POD polem, podpięty przez `aria-describedby`, a pole
 *     dostaje `aria-invalid` — czytnik ekranu czyta go razem z etykietą;
 *   - `przyOpuszczeniu` — walidacja po opuszczeniu pola, nie przy każdym
 *     znaku (fokus przechodzący między częściami tego samego pola, np.
 *     segmentami daty, nie liczy się jako opuszczenie).
 *
 * Identyfikator dostaje pojedyncze pole (`input`/`select`/`textarea`) albo
 * komponent pola oznaczony `przyjmujeId` (PoleDaty, PoleKwoty, …). `id` z
 * zewnątrz pozwala podsumowaniu błędów przewinąć do pola.
 */
function Pole({ etykieta, podpowiedz, blad, ostrzezenie, echo, opcjonalne, id: idZewnetrzne, przyOpuszczeniu, children }) {
  const idWlasne = useId();
  const id = idZewnetrzne || idWlasne;
  const idBledu = `${id}-blad`;
  const idOstrzezenia = `${id}-ostrzezenie`;
  const idPodpowiedzi = `${id}-podpowiedz`;
  const opis = [blad && idBledu, !blad && ostrzezenie && idOstrzezenia, podpowiedz && idPodpowiedzi]
    .filter(Boolean).join(' ') || undefined;

  const pojedyncze = React.isValidElement(children)
    && (['input', 'select', 'textarea'].includes(children.type) || (children.type && children.type.przyjmujeId));
  const dziecko = pojedyncze
    ? React.cloneElement(children, {
      id: children.props.id || id,
      'aria-describedby': opis,
      'aria-invalid': blad ? true : undefined,
    })
    : children;

  function opuszczenie(z) {
    if (!przyOpuszczeniu) return;
    if (z.relatedTarget && z.currentTarget.contains(z.relatedTarget)) return;
    przyOpuszczeniu();
  }

  return (
    <div className={`pole ${blad ? 'pole-z-bledem' : ''}`} onBlur={przyOpuszczeniu ? opuszczenie : undefined}>
      {etykieta && (
        <label className="pole-etykieta" htmlFor={pojedyncze ? (children.props.id || id) : undefined} id={`${id}-etykieta`}>
          {etykieta}
          {/* „(opcjonalnie)" przy etykiecie, a nie w podpowiedzi pod polem:
              o tym, czy pole trzeba wypełnić, decyduje się PATRZĄC na nie,
              zanim się w nie kliknie. */}
          {opcjonalne && <span className="pole-opcjonalne"> (opcjonalnie)</span>}
        </label>
      )}
      {dziecko}
      {blad && <p className="pole-blad" id={idBledu}><span className="sr-only">Błąd: </span>{blad}</p>}
      {!blad && ostrzezenie && <p className="pole-ostrzezenie" id={idOstrzezenia}>{ostrzezenie}</p>}
      {!blad && echo && <div className="pole-echo">{echo}</div>}
      {podpowiedz && <div className="pole-podpowiedz" id={idPodpowiedzi}>{podpowiedz}</div>}
    </div>
  );
}

/**
 * Podsumowanie błędów u góry formularza (wzorzec GOV.UK): pojawia się przy
 * próbie przejścia dalej albo zapisu, dostaje fokus, a każdy błąd jest
 * odnośnikiem, który przewija do pola i ustawia w nim kursor.
 *
 * `bledy`: [{ pole: 'id-pola', tresc: 'Wpisz nazwisko' }]
 */
function PodsumowanieBledow({ bledy, tytul = 'Popraw, zanim przejdziesz dalej' }) {
  const ref = useRef(null);
  const sygnatura = (bledy || []).map((b) => b.tresc).join('|');
  useEffect(() => {
    if (sygnatura && ref.current) {
      ref.current.focus({ preventScroll: true });
      ref.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [sygnatura]);
  if (!bledy || bledy.length === 0) return null;

  function przejdz(z, idPola) {
    z.preventDefault();
    const el = document.getElementById(idPola);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
  }

  return (
    <div className="podsumowanie-bledow" role="alert" tabIndex={-1} ref={ref}>
      <h2 className="podsumowanie-bledow-tytul">{tytul}</h2>
      <ul>
        {bledy.map((b) => (
          <li key={`${b.pole}-${b.tresc}`}>
            {b.pole ? <a href={`#${b.pole}`} onClick={(z) => przejdz(z, b.pole)}>{b.tresc}</a> : b.tresc}
          </li>
        ))}
      </ul>
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
function PoleDaty({ wartosc, przyZmianie, min, max, blad, skroty = false, autoFocus, wylaczone = false, id, 'aria-describedby': opis, 'aria-invalid': niepoprawne }) {
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

  /** Wklejenie w dowolnym separatorze: 12.03.2026, 12-03-2026, 12/03/2026, ISO 2026-03-12. */
  function wklej(z) {
    const tekst = (z.clipboardData || window.clipboardData).getData('text').trim();
    if (!tekst) return;
    const iso = parsujDate(tekst.slice(0, 10)) || parsujDate(tekst);
    if (!iso) return;
    z.preventDefault();
    ustawRok(iso.slice(0, 4)); ustawMiesiac(iso.slice(5, 7)); ustawDzien(iso.slice(8, 10));
    przyZmianie(iso);
  }

  // Data słownie pod polem zniknęła (zasada 0.4 pkt 7): ta sama informacja
  // dwa razy na ekranie to szum, a format dd.mm.rrrr jest jednoznaczny.
  const dzis = fmt.dzisIso();

  return (
    <>
      <div className="pole-daty">
        <div className={`data-segmenty ${blad || niepoprawne ? 'bledne' : ''} ${wylaczone ? 'wylaczone' : ''}`} onPaste={wklej} role="group">
          <input
            ref={refDzien} className="data-segment" data-szer="2" inputMode="numeric" id={id}
            aria-describedby={opis} aria-invalid={niepoprawne}
            placeholder="DD" value={dzien} autoFocus={autoFocus} disabled={wylaczone}
            onChange={(z) => zmien('d', z.target.value)}
            onKeyDown={(z) => klawisz('d', z)}
            aria-label="Dzień"
          />
          <span className="data-rozdzielacz">.</span>
          <input
            ref={refMiesiac} className="data-segment" data-szer="2" inputMode="numeric"
            placeholder="MM" value={miesiac} disabled={wylaczone} aria-invalid={niepoprawne}
            onChange={(z) => zmien('m', z.target.value)}
            onKeyDown={(z) => klawisz('m', z)}
            aria-label="Miesiąc"
          />
          <span className="data-rozdzielacz">.</span>
          <input
            ref={refRok} className="data-segment" data-szer="4" inputMode="numeric"
            placeholder="RRRR" value={rok} disabled={wylaczone} aria-invalid={niepoprawne}
            onChange={(z) => zmien('r', z.target.value)}
            onKeyDown={(z) => klawisz('r', z)}
            aria-label="Rok"
          />
        </div>

        {!wylaczone && (
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
        )}

        {skroty && !wylaczone && (
          <div className="pigulki-skrotow">
            <button className="btn btn-maly btn-cichy" onClick={() => przyZmianie(dzis)}>dziś</button>
            <button className="btn btn-maly btn-cichy" onClick={() => przyZmianie(dodajDniIso(dzis, -1))}>wczoraj</button>
          </div>
        )}
      </div>
    </>
  );
}
PoleDaty.przyjmujeId = true;

/**
 * Pole liczbowe (2.6): do prawej, w monie, separator tysięcy na bieżąco,
 * jednostka jako sufiks WEWNĄTRZ pola.
 *
 * `wartosc`/`przyZmianie` operują na liczbie (albo `null`), nie na tekście
 * z separatorami — separator jest wyłącznie sposobem wyświetlania.
 */
function PoleLiczbowe({ wartosc, przyZmianie, sufiks, blad, min, max, autoFocus, placeholder, id, 'aria-describedby': opis, 'aria-invalid': niepoprawne }) {
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
    <div className={`pole-liczbowe ${blad || niepoprawne ? 'bledne' : ''}`}>
      <input
        type="text" inputMode="numeric" value={tekst} autoFocus={autoFocus} placeholder={placeholder}
        id={id} aria-describedby={opis} aria-invalid={niepoprawne}
        onChange={(z) => zmien(z.target.value)}
      />
      {sufiks && <span className="pole-liczbowe-sufiks" aria-hidden="true">{sufiks}</span>}
    </div>
  );
}
PoleLiczbowe.przyjmujeId = true;

/**
 * Kwota w złotych; na zewnątrz GROSZE jako liczba całkowita (reguła domenowa
 * nr 5). Wpisuje się normalnie — „10", „10,5", „1 000,00", przecinek albo
 * kropka — bez dopisywania zer w trakcie pisania (to nie kasa fiskalna).
 * Po opuszczeniu pola: „10,00" z sufiksem „zł".
 *
 * Więcej niż 2 cyfry po przecinku NIE są zaokrąglane (D-045, Q6): pole
 * pokazuje komunikat pod sobą, a na zewnątrz zgłasza `null` — błędna
 * wartość nie ma jak trafić do zapisu.
 */
function PoleKwoty({ grosze, przyZmianie, blad, id, autoFocus, 'aria-describedby': opis, 'aria-invalid': niepoprawne }) {
  const [tekst, ustawTekst] = useState(() => formatujKwote(grosze, { waluta: false }));
  const [bladWlasny, ustawBladWlasny] = useState(null);
  const idWlasne = useId();
  const idBledu = `${id || idWlasne}-blad-kwoty`;
  // Wartość, którą pole samo zgłosiło — jej powrót z rodzica nie może
  // przeformatować tekstu w trakcie pisania.
  const zgloszone = useRef(grosze);

  useEffect(() => {
    if (grosze === zgloszone.current) return;
    zgloszone.current = grosze;
    ustawTekst(formatujKwote(grosze, { waluta: false }));
    ustawBladWlasny(null);
  }, [grosze]);

  function zglos(wartosc) {
    zgloszone.current = wartosc;
    przyZmianie(wartosc);
  }

  function zmien(t) {
    ustawTekst(t);
    const wynik = parsujKwote(t);
    if (wynik.blad) return; // komunikat dopiero po opuszczeniu pola
    ustawBladWlasny(null);
    zglos(wynik.grosze);
  }

  function domknij() {
    const wynik = parsujKwote(tekst);
    if (wynik.blad) {
      ustawBladWlasny(wynik.blad);
      zglos(null);
      return;
    }
    ustawBladWlasny(null);
    ustawTekst(formatujKwote(wynik.grosze, { waluta: false }));
  }

  const pokazBlad = bladWlasny && !blad;
  return (
    <>
      <div className={`pole-liczbowe ${blad || niepoprawne || bladWlasny ? 'bledne' : ''}`}>
        <input
          type="text" inputMode="decimal" value={tekst} id={id} autoFocus={autoFocus}
          aria-describedby={[opis, pokazBlad && idBledu].filter(Boolean).join(' ') || undefined}
          aria-invalid={niepoprawne || Boolean(bladWlasny) || undefined}
          onChange={(z) => zmien(z.target.value)} onBlur={domknij}
        />
        <span className="pole-liczbowe-sufiks" aria-hidden="true">zł</span>
      </div>
      {pokazBlad && <p className="pole-blad" id={idBledu}><span className="sr-only">Błąd: </span>{bladWlasny}</p>}
    </>
  );
}
PoleKwoty.przyjmujeId = true;

/**
 * Hasło z przełącznikiem widoczności (B1) — jeden komponent dla logowania,
 * aktywacji konta i zmiany hasła. Przełącznik nie chowa się za focusem:
 * osoba wpisująca hasło na telefonie musi widzieć, że nie ma literówki,
 * zanim je wyśle.
 */
function PoleHaslo({ wartosc, przyZmianie, autoComplete, id, autoFocus, blad, 'aria-describedby': opis, 'aria-invalid': niepoprawne }) {
  const [widoczne, ustawWidoczne] = useState(false);
  return (
    <div className="pole-haslo">
      <input
        type={widoczne ? 'text' : 'password'}
        id={id}
        name={id}
        value={wartosc}
        onChange={(z) => przyZmianie(z.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-describedby={opis}
        aria-invalid={niepoprawne || Boolean(blad) || undefined}
      />
      <button
        type="button"
        className="pole-haslo-przelacznik"
        onClick={() => ustawWidoczne((w) => !w)}
        aria-label={widoczne ? 'Ukryj hasło' : 'Pokaż hasło'}
        aria-pressed={widoczne}
        tabIndex={-1}
      >
        <Ikona nazwa={widoczne ? 'okoPrzekreslone' : 'oko'} rozmiar={17} />
      </button>
    </div>
  );
}
PoleHaslo.przyjmujeId = true;

/**
 * Wybór z kartoteki (2.6) — JEDEN komponent wyboru osoby w całej aplikacji
 * (dawny `WyborOsoby` z ui.js wchłonięty w FAZIE 1).
 *
 * Szuka po nazwisku, imieniu, firmie, PESEL, NIP i numerze KRS od drugiego
 * znaku; wynik pokazuje zamaskowany identyfikator i liczbę spółek, w których
 * osoba już jest (reguła domenowa nr 10 — jeden inwestor wpisywany raz).
 * „+ Nowa osoba w kartotece" jest zawsze na końcu listy: nowej osoby nie
 * zakłada się w innym ekranie.
 */
function WyborZKartoteki({
  wartosc, przyZmianie, placeholder = 'Nazwisko, firma, PESEL albo KRS…', wyklucz = [], typFiltr = null,
  id, 'aria-describedby': opis, 'aria-invalid': niepoprawne,
}) {
  const [szukaj, ustawSzukaj] = useState('');
  const [wyniki, ustawWyniki] = useState([]);
  const [otwarte, ustawOtwarte] = useState(false);
  const [podswietlony, ustawPodswietlony] = useState(0);
  const [wybrana, ustawWybrana] = useState(null);
  const [nowaOsoba, ustawNowaOsoba] = useState(false);
  const idListy = useId();

  useEffect(() => {
    if (!wartosc) { ustawWybrana(null); return; }
    if (wybrana && wybrana.id === wartosc) return;
    API.get(`/api/psa/osoby/${wartosc}`)
      .then((o) => ustawWybrana(o.osoba))
      .catch(() => ustawWybrana(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wartosc]);

  // Od drugiego znaku: przy ~500 spółkach lista po jednej literze jest
  // bezużyteczna, a nazwiska dwuliterowe („Ng", „Li") istnieją.
  const zapytanie = szukaj.trim();
  useEffect(() => {
    if (zapytanie.length < 2) { ustawWyniki([]); return undefined; }
    const uchwyt = setTimeout(() => {
      const filtr = typFiltr ? `&typ=${encodeURIComponent(typFiltr)}` : '';
      API.get(`/api/psa/osoby?q=${encodeURIComponent(zapytanie)}${filtr}`)
        .then((o) => {
          ustawWyniki(o.osoby.filter((x) => !wyklucz.includes(x.id)));
          ustawPodswietlony(0);
        })
        .catch(() => ustawWyniki([]));
    }, 180);
    return () => clearTimeout(uchwyt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zapytanie, typFiltr, wyklucz.join(',')]);

  function wybierz(osoba) {
    przyZmianie(osoba.id);
    ustawWybrana(osoba);
    ustawSzukaj('');
    ustawOtwarte(false);
  }

  const pozycji = wyniki.length + 1; // ostatnia: „+ Nowa osoba"
  function klawisz(z) {
    if (!otwarte || zapytanie.length < 2) return;
    if (z.key === 'ArrowDown') { z.preventDefault(); ustawPodswietlony((p) => Math.min(p + 1, pozycji - 1)); }
    if (z.key === 'ArrowUp') { z.preventDefault(); ustawPodswietlony((p) => Math.max(p - 1, 0)); }
    if (z.key === 'Escape') { ustawOtwarte(false); }
    if (z.key === 'Enter') {
      z.preventDefault();
      if (podswietlony < wyniki.length) wybierz(wyniki[podswietlony]);
      else { ustawOtwarte(false); ustawNowaOsoba(true); }
    }
  }

  if (wybrana) {
    return (
      <div className="kartoteka-wybrana">
        <span>
          <span className="kartoteka-wybrana-nazwa">{wybrana.oznaczenie}</span>
          <span className="kartoteka-poz-meta">
            {wybrana.typ === 'prawna' ? 'osoba prawna' : 'osoba fizyczna'}
            {wybrana.jawny_identyfikator ? ` · ${wybrana.jawny_identyfikator}` : ''}
            {wybrana.aml_status && wybrana.aml_status !== 'wykonane' ? ' · AML niepotwierdzony' : ''}
          </span>
        </span>
        <button
          type="button"
          className="btn btn-maly btn-cichy"
          id={id}
          onClick={() => { przyZmianie(null); ustawWybrana(null); }}
        >
          Zmień osobę
        </button>
      </div>
    );
  }

  const listaWidoczna = otwarte && zapytanie.length >= 2;
  return (
    <div className="kartoteka">
      <input
        type="search"
        id={id}
        value={szukaj}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={listaWidoczna}
        aria-controls={idListy}
        aria-autocomplete="list"
        aria-describedby={opis}
        aria-invalid={niepoprawne}
        autoComplete="off"
        onChange={(z) => { ustawSzukaj(z.target.value); ustawOtwarte(true); }}
        onFocus={() => ustawOtwarte(true)}
        onBlur={() => setTimeout(() => ustawOtwarte(false), 150)}
        onKeyDown={klawisz}
      />
      {listaWidoczna && (
        <div className="kartoteka-lista" id={idListy} role="listbox">
          {wyniki.length === 0 && <div className="kartoteka-pusto">Nikt w kartotece nie pasuje do „{zapytanie}”.</div>}
          {wyniki.map((o, i) => (
            <button
              type="button"
              key={o.id}
              role="option"
              aria-selected={i === podswietlony}
              className={`kartoteka-poz ${i === podswietlony ? 'podswietlona' : ''}`}
              onMouseDown={(z) => { z.preventDefault(); wybierz(o); }}
            >
              <div>{o.oznaczenie}</div>
              <div className="kartoteka-poz-meta">
                {o.typ === 'prawna' ? 'osoba prawna' : 'osoba fizyczna'}
                {o.jawny_identyfikator ? ` · ${o.jawny_identyfikator}` : ''}
                {o.liczba_spolek ? ` · w ${o.liczba_spolek} ${fmt.odmien(o.liczba_spolek, 'spółce', 'spółkach', 'spółkach')}` : ''}
              </div>
            </button>
          ))}
          <button
            type="button"
            role="option"
            aria-selected={podswietlony === wyniki.length}
            className={`kartoteka-poz kartoteka-nowa ${podswietlony === wyniki.length ? 'podswietlona' : ''}`}
            onMouseDown={(z) => { z.preventDefault(); ustawOtwarte(false); ustawNowaOsoba(true); }}
          >
            + Nowa osoba w kartotece
          </button>
        </div>
      )}

      {nowaOsoba && (
        <PanelOsoby
          osoba={podpowiedzNowejOsoby(zapytanie, typFiltr)}
          przyZamknieciu={() => ustawNowaOsoba(false)}
          przyZapisie={(osoba) => { ustawNowaOsoba(false); wybierz(osoba); }}
          przyWyborzeIstniejacej={(osoba) => { ustawNowaOsoba(false); wybierz(osoba); }}
        />
      )}
    </div>
  );
}
WyborZKartoteki.przyjmujeId = true;

/** Wpisany tekst przechodzi do nowej osoby tam, gdzie pasuje (raz wpisane — nigdy więcej). */
function podpowiedzNowejOsoby(tekst, typFiltr) {
  const t = String(tekst || '').trim();
  const osoba = typFiltr ? { typ: typFiltr } : {};
  if (/^\d{11}$/.test(t)) return { ...osoba, typ: 'fizyczna', pesel: t };
  if (/^\d{10}$/.test(t)) return { ...osoba, typ: 'prawna', numer_w_rejestrze: t, nazwa_rejestru: 'KRS' };
  if (!t || /\d/.test(t)) return osoba;
  return osoba.typ === 'prawna' ? { ...osoba, nazwa: t } : { ...osoba, nazwisko: t };
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
      lista.push({ grupa: 'Spółki', ikona: 'spolki', etykieta: s.nazwa, meta: s.krs ? `KRS ${s.krs}` : '', idz: `/spolki/${s.id}` });
    }
    for (const o of wyniki.osoby) {
      lista.push({ grupa: 'Osoby', ikona: 'osoby', etykieta: o.oznaczenie, meta: o.jawny_identyfikator || '', idz: '/osoby' });
    }
    if (pytanie.trim().length < 2) {
      lista.push({ grupa: 'Polecenia', ikona: 'sprawy', etykieta: 'Kolejka spraw', meta: '', idz: '/sprawy' });
      lista.push({ grupa: 'Polecenia', ikona: 'spolki', etykieta: 'Spółki', meta: '', idz: '/spolki' });
      lista.push({ grupa: 'Polecenia', ikona: 'osoby', etykieta: 'Kartoteka osób', meta: '', idz: '/osoby' });
      lista.push({ grupa: 'Polecenia', ikona: 'plus', etykieta: 'Nowa spółka', meta: '', idz: '/spolki/nowa' });
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
        <div className="paleta-pole-rzad">
          <Ikona nazwa="szukaj" rozmiar={20} />
          <input
            className="paleta-pole"
            autoFocus
            value={pytanie}
            placeholder="Szukaj spółki, osoby albo sprawy…"
            onChange={(z) => ustawPytanie(z.target.value)}
            onKeyDown={klawisz}
          />
        </div>
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
                  <Ikona nazwa={p.ikona || 'strzalkaPrawo'} rozmiar={16} />
                  <span className="paleta-poz-etykieta">{p.etykieta}</span>
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

window.Ikona = Ikona;
window.Kafel = Kafel;
window.WierszListy = WierszListy;
window.Zakladki = Zakladki;
window.Para = Para;
window.Metryka = Metryka;
window.Szukajka = Szukajka;
window.SzybkieAkcje = SzybkieAkcje;
/* ─────────────────────────────────────────────────────
   AUTOZAPIS FORMULARZA
   Formularz nie ma przycisku „Zapisz”: każda zmiana leci na serwer sama,
   z krótkim opóźnieniem, żeby pisanie w polu nie wywoływało zapytania na
   każdą literę. Dzięki temu nie da się zobaczyć formularza wypełnionego
   „na ekranie”, a pustego po stronie serwera — a to była przyczyna
   odbijanego składania wniosku.
   ───────────────────────────────────────────────────── */

const OPOZNIENIE_AUTOZAPISU_MS = 800;

/**
 * @param {object} wartosci      aktualny stan formularza
 * @param {Function} zapisz      (wartosci) => Promise — wywołanie API
 * @param {object} [opcje]
 * @param {boolean} [opcje.wlaczony=true]   false wyłącza zapis (formularz do wglądu)
 * @param {Function} [opcje.przyZapisie]    dostaje odpowiedź serwera
 * @returns {{stan: 'spoczynek'|'zapisywanie'|'zapisano'|'blad', blad: string|null}}
 */
function useAutozapis(wartosci, zapisz, opcje = {}) {
  const { wlaczony = true, przyZapisie } = opcje;
  const [stan, ustawStan] = useState({ stan: 'spoczynek', blad: null });

  // Pierwszy przebieg to wartości WCZYTANE z serwera, nie zmiana użytkownika —
  // zapisywanie ich z powrotem byłoby zapytaniem bez żadnego skutku.
  const pierwszy = useRef(true);
  const ostatnie = useRef(JSON.stringify(wartosci));
  // Zapisy muszą iść po kolei: gdyby wolniejsze wcześniejsze zapytanie
  // wróciło po nowszym, serwer dostałby starsze dane jako ostatnie.
  const kolejka = useRef(Promise.resolve());
  const funkcja = useRef(zapisz);
  funkcja.current = zapisz;
  const powiadom = useRef(przyZapisie);
  powiadom.current = przyZapisie;
  // Naprawa Z-017: od zmiany pola do wystartowania zapisu (debounce) i przez
  // caly czas trwania zapytania jest okno, w ktorym zamkniecie karty albo
  // odswiezenie strony traci ostatnia wartosc bez zadnego ostrzezenia -
  // dyskretny napis "Zapisywanie..." latwo przeoczyc przy szybkim dzialaniu.
  const niezapisane = useRef(false);

  const serializacja = JSON.stringify(wartosci);

  // Zamknięcie karty i zmiana ekranu w trakcie zapisu pytają o zgodę.
  useBlokadaWyjscia(() => wlaczony && niezapisane.current);

  useEffect(() => {
    if (!wlaczony) return undefined;
    if (pierwszy.current) {
      pierwszy.current = false;
      ostatnie.current = serializacja;
      return undefined;
    }
    if (serializacja === ostatnie.current) return undefined;

    niezapisane.current = true;
    const czasomierz = setTimeout(() => {
      const doZapisu = JSON.parse(serializacja);
      ostatnie.current = serializacja;
      ustawStan({ stan: 'zapisywanie', blad: null });
      kolejka.current = kolejka.current
        .then(() => funkcja.current(doZapisu))
        .then((odpowiedz) => {
          niezapisane.current = false;
          ustawStan({ stan: 'zapisano', blad: null });
          if (powiadom.current) powiadom.current(odpowiedz);
        })
        .catch((e) => {
          // Zapis się nie udał — następna zmiana ma spróbować ponownie,
          // więc kasujemy pamięć ostatnio wysłanej wersji. Ostrzeżenie
          // przed zamknięciem karty ma zostać, dopóki zapis się nie uda.
          ostatnie.current = null;
          ustawStan({
            stan: 'blad',
            blad: e instanceof BladApi ? e.message : 'Nie udało się zapisać zmian.',
          });
        });
    }, OPOZNIENIE_AUTOZAPISU_MS);

    return () => clearTimeout(czasomierz);
  }, [serializacja, wlaczony]);

  return stan;
}

/** Dyskretny wskaźnik autozapisu — jedna linijka tekstu, bez migotania. */
function StanZapisu({ stan }) {
  if (!stan || stan.stan === 'spoczynek') return null;
  if (stan.stan === 'blad') {
    return <span className="stan-zapisu stan-zapisu-blad">{stan.blad}</span>;
  }
  return (
    <span className="stan-zapisu">
      {stan.stan === 'zapisywanie' ? 'Zapisywanie…' : 'Zapisano'}
    </span>
  );
}

window.Stronicowanie = Stronicowanie;
window.Iskra = Iskra;
/* ─────────────────────────────────────────────────
   KREATOR: NAGŁÓWEK KROKU, LISTA PODMIOTÓW, NAWIGACJA

   Formularz nie tłumaczy sam siebie. Nagłówek kroku mówi, co się teraz
   wypełnia — i to jest jedyne zdanie wyjaśnienia na ekranie. Pola dalej
   niosą własne etykiety i nie potrzebują śródtytułów w rodzaju „Adres”:
   każdy wie, czym jest adres.

   Dane wielu osób zbiera się listą, nie stosem rozwiniętych formularzy —
   widać całość, a szczegóły otwiera się po jednym.
   ───────────────────────────────────────────────── */

/** Tytuł kroku kreatora i jedno zdanie o tym, po co ten krok jest. */
function KrokNaglowek({ tytul, opis }) {
  return (
    <header className="krok-naglowek">
      <h2 className="krok-naglowek-tytul">{tytul}</h2>
      {opis && <p className="krok-naglowek-opis">{opis}</p>}
    </header>
  );
}

/**
 * Wiersz listy podmiotów — jedna osoba, jeden akcjonariusz, jedna rola.
 * Klika się CAŁY wiersz, nie strzałkę na jego końcu: cel wielkości palca,
 * nie cel wielkości ikony.
 */
function WierszPodmiotu({ ikona = 'osoby', tytul, opis, znacznik, przyKliknieciu, wylaczony = false }) {
  return (
    <button type="button" className="wiersz-podmiotu" onClick={przyKliknieciu} disabled={wylaczony}>
      <span className="wiersz-podmiotu-ikona"><Ikona nazwa={ikona} rozmiar={20} /></span>
      <span className="wiersz-podmiotu-tresc">
        <span className="wiersz-podmiotu-tytul">
          {tytul}
          {znacznik && <span className="wiersz-podmiotu-znacznik">{znacznik}</span>}
        </span>
        {opis && <span className="wiersz-podmiotu-opis">{opis}</span>}
      </span>
      <span className="wiersz-podmiotu-strzalka" aria-hidden="true">
        <Ikona nazwa="strzalkaPrawo" rozmiar={18} />
      </span>
    </button>
  );
}

/** Dopisanie kolejnej pozycji do listy — szerokość wiersza, nie guzika. */
function WierszDodania({ etykieta, przyKliknieciu, wylaczony = false }) {
  return (
    <button type="button" className="wiersz-dodaj" onClick={przyKliknieciu} disabled={wylaczony}>
      <Ikona nazwa="plus" rozmiar={18} />
      {etykieta}
    </button>
  );
}

/**
 * Para przycisków zamykająca krok. Są duże, bo to jedyne rzeczy do
 * kliknięcia na dole ekranu — i bo „dalej” po długim formularzu ma być
 * zaproszeniem, a nie drobnym odnośnikiem do wypatrzenia.
 */
function NawigacjaKreatora({ wstecz, dalej }) {
  // Wyłączony przycisk zawsze mówi, DLACZEGO jest wyłączony (FAZA 1 pkt 4).
  // Braki w formularzu nie wyłączają „Dalej" — kliknięcie pokazuje
  // podsumowanie błędów; wyłączenie zostaje tylko dla blokady prawnej.
  const idPowodu = useId();
  return (
    <>
    {dalej && dalej.wylaczony && dalej.powod && (
      <p className="nawigacja-powod" id={idPowodu}>{dalej.powod}</p>
    )}
    <div className="nawigacja-kreatora">
      {wstecz
        ? (
          <button type="button" className="btn btn-nawigacja" onClick={wstecz.przy} disabled={wstecz.wylaczony}>
            {wstecz.etykieta}
          </button>
        )
        : <span />}
      {dalej
        ? (
          <button
            type="button"
            className="btn btn-glowny btn-nawigacja"
            onClick={dalej.przy}
            disabled={dalej.wylaczony}
            aria-describedby={dalej.wylaczony && dalej.powod ? idPowodu : undefined}
          >
            {dalej.etykieta}
          </button>
        )
        : <span />}
    </div>
    </>
  );
}

/**
 * Zwijana grupa pól — dla danych, których większość osób nie ma. Domyślnie
 * zamknięta, ale otwiera się sama, gdy cokolwiek w środku jest wypełnione:
 * ukryta wartość, o której nikt nie wie, jest gorsza niż dłuższy formularz.
 */
function ZwijanaSekcja({ tytul, opcjonalna = true, wypelniona = false, children }) {
  const [otwarta, ustawOtwarta] = useState(wypelniona);
  useEffect(() => { if (wypelniona) ustawOtwarta(true); }, [wypelniona]);

  return (
    <div className={`zwijana ${otwarta ? 'zwijana-otwarta' : ''}`}>
      <button
        type="button"
        className="zwijana-naglowek"
        aria-expanded={otwarta}
        onClick={() => ustawOtwarta((p) => !p)}
      >
        <span className="zwijana-tytul">
          {tytul}
          {opcjonalna && <span className="zwijana-opcjonalna"> (opcjonalnie)</span>}
        </span>
        <span className="zwijana-strzalka" aria-hidden="true">
          <Ikona nazwa="strzalkaDol" rozmiar={18} />
        </span>
      </button>
      {otwarta && <div className="zwijana-tresc">{children}</div>}
    </div>
  );
}

/**
 * Przełącznik do oświadczeń „tak/nie". Etykieta i wyjaśnienie są klikalne
 * razem z samym przełącznikiem — przy oświadczeniu o skutkach prawnych
 * trafienie w 40-pikselowy prostokąt nie może być warunkiem złożenia go.
 */
function Przelacznik({ wlaczony, przyZmianie, etykieta, opis, wylaczony = false, dzieci }) {
  return (
    <div className={`przelacznik-blok ${wlaczony ? 'przelacznik-blok-wlaczony' : ''}`}>
      <label className="przelacznik-glowna">
        <input
          type="checkbox"
          className="przelacznik-pole"
          checked={Boolean(wlaczony)}
          disabled={wylaczony}
          onChange={(z) => przyZmianie(z.target.checked)}
        />
        <span className="przelacznik-tor" aria-hidden="true"><span className="przelacznik-suwak" /></span>
        <span className="przelacznik-tekst">
          <span className="przelacznik-etykieta">{etykieta}</span>
          {opis && <span className="przelacznik-opis">{opis}</span>}
        </span>
      </label>
      {wlaczony && dzieci && <div className="przelacznik-rozwiniecie">{dzieci}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   STOPKA

   Kto prowadzi rejestr, gdzie i jak się z nim skontaktować — jeden blok,
   jeden poziom. Wcześniejsza wersja rozbijała to na dwa piętra: dane
   adresowe nad cienką linią, rok i adres strony pod nią. Strona
   internetowa stoi teraz przy pozostałych danych kancelarii, bo jest
   jednym z jej adresów, a nie osobną informacją.

   Podstawy prawnej tu nie ma — jej miejsce jest na dokumencie z rejestru,
   gdzie coś znaczy, a nie pod każdym ekranem aplikacji.
   ───────────────────────────────────────────────── */

const ZNAK_NOTARIATU = '/obrazy/notariat.png';

/* Znak jest dostarczonym rastrem 498 × 220 px, w którym najdrobniejszy napis
   („Lex est quod notamus") ma raptem kilkanaście pikseli wysokości. Dotąd
   stopka skalowała go WYSOKOŚCIĄ do 56 px — czyli do 127 px szerokości, a to
   przeskalowanie 3,92 : 1, po którym drugi i trzeci wiersz znaku zlewały się
   w plamę. Teraz szerokość jest ustalona wprost na 166 px, czyli DOKŁADNIE
   trzecią część oryginału: całkowity stosunek pomniejszenia daje ostre krawędzie
   zamiast rozmycia z uśredniania pikseli, a napis znowu da się przeczytać.
   Oryginalne wymiary idą też do atrybutów `width`/`height`, żeby miejsce na
   znak było zarezerwowane, zanim plik się wczyta. */
const ZNAK_NOTARIATU_SZEROKOSC = 498;
const ZNAK_NOTARIATU_WYSOKOSC = 220;

function skrocAdresWww(url) {
  return String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Stopka obu aplikacji.
 *
 * Trzy kolumny i pasek pod nimi. Kolumna pierwsza mówi, CZYJ to portal (znak
 * samorządu, nazwa, adres pocztowy), druga — jak się skontaktować, trzecia —
 * na jakich zasadach to działa. Pod cienką linią rok, właściciel praw i jedno
 * zdanie o tym, czym jest ta aplikacja.
 *
 * Wcześniej stopka była jednym rzędem: znak i przy nim wszystkie adresy
 * ciągiem, rozdzielone kropkami. Przy trzech pozycjach to się czytało; przy
 * pięciu — z regulaminem, polityką prywatności i notą o prawach — zamieniało
 * się w jedno długie zdanie, w którym nic nie było ważniejsze od reszty.
 *
 * Podstawy prawnej tu nie ma — jej miejsce jest na dokumencie z rejestru,
 * gdzie coś znaczy, a nie pod każdym ekranem aplikacji.
 */
/**
 * Stopka kancelarii — trzy bloki: kto prowadzi rejestr, jak się z nim
 * skontaktować, na jakiej podstawie to działa.
 *
 * `szerokosc` wyrównuje stopkę do treści NAD nią. Bez tego stopka stała
 * zawsze na 1240 px, a ekran logowania (1080 px) i wąskie widoki portalu
 * klienta (760 px) miały ją szerszą od własnej treści — wyglądało to,
 * jakby należała do innej strony.
 */
function StopkaKancelarii({ kancelaria, szerokosc }) {
  const [znakNieudany, ustawZnakNieudany] = useState(false);
  const k = kancelaria || {};
  // `adres` z ustawień niesie już miejscowość (ulica, kod miasto), a pole
  // `miejscowosc` istnieje osobno dla pism. Dopisywanie go tutaj dawało
  // „…80-280 Gdańsk, Gdańsk".
  const adres = k.adres && k.miejscowosc && k.adres.includes(k.miejscowosc)
    ? k.adres
    : [k.adres, k.miejscowosc].filter(Boolean).join(', ');
  const link = k.www_psa || k.www;
  const rok = new Date().getFullYear();
  const styl = szerokosc ? { '--stopka-szerokosc': szerokosc } : undefined;

  return (
    <footer className="stopka bez-druku" style={styl}>
      <div className="stopka-siatka">
        {/* Blok 1 — kto prowadzi rejestr. Znak notariatu jest tu
            legitymacją, nie logotypem produktu, więc stoi przy nazwie
            kancelarii, a nie nad całą stopką. */}
        <div className="stopka-kolumna stopka-kolumna-marka">
          <div className="stopka-nazwa">{k.nazwa}</div>
          {!znakNieudany && (
            <img
              className="stopka-znak"
              src={ZNAK_NOTARIATU}
              width={ZNAK_NOTARIATU_SZEROKOSC}
              height={ZNAK_NOTARIATU_WYSOKOSC}
              alt="Notariat Rzeczypospolitej Polskiej"
              onError={() => ustawZnakNieudany(true)}
            />
          )}
        </div>

        {/* Blok 2 — jak się skontaktować. Adres siedziby stoi TUTAJ, a nie
            pod nazwą: kto szuka kontaktu, szuka wszystkich czterech danych
            w jednym miejscu. */}
        <div className="stopka-kolumna">
          <div className="stopka-tytul">Kontakt</div>
          {adres && (
            <div className="stopka-poz">
              <Ikona nazwa="pinezka" rozmiar={14} />
              <span>{adres}</span>
            </div>
          )}
          {k.email && (
            <a className="stopka-poz" href={`mailto:${k.email}`}>
              <Ikona nazwa="koperta" rozmiar={14} />
              <span>{k.email}</span>
            </a>
          )}
          {k.telefon && (
            <a className="stopka-poz" href={`tel:${String(k.telefon).replace(/\s/g, '')}`}>
              <Ikona nazwa="telefon" rozmiar={14} />
              <span>{k.telefon}</span>
            </a>
          )}
          {link && (
            <a className="stopka-poz" href={link} target="_blank" rel="noopener noreferrer">
              <Ikona nazwa="globus" rozmiar={14} />
              <span>{skrocAdresWww(link)}</span>
            </a>
          )}
        </div>

        {/* Blok 3 — na jakiej podstawie to działa i czyje to dane.
            Pierwsze zdanie stało dotąd w szynie aplikacji kancelaryjnej,
            gdzie klient go nie widział, a to jego dotyczy najbardziej. */}
        <div className="stopka-kolumna">
          <div className="stopka-tytul">Rejestr akcjonariuszy</div>
          <p className="stopka-tresc">
            Rejestr prowadzi {k.nazwa || 'kancelaria notarialna'} — art. 300³¹ § 1
            Kodeksu spółek handlowych.
          </p>
          <p className="stopka-tresc">
            Administratorem danych osobowych w rejestrze jest kancelaria —
            szczegóły w <a href="#/polityka-prywatnosci">polityce prywatności</a>.
          </p>
        </div>
      </div>

      <div className="stopka-dol">
        <span>© {rok} {k.nazwa || 'Kancelaria Notarialna'}. Wszelkie prawa zastrzeżone.</span>
        <span className="stopka-dol-linki">
          <a href="#/regulamin">Regulamin portalu</a>
          <a href="#/polityka-prywatnosci">Polityka prywatności</a>
        </span>
      </div>
    </footer>
  );
}

window.StopkaKancelarii = StopkaKancelarii;
window.skrocAdresWww = skrocAdresWww;
window.KrokNaglowek = KrokNaglowek;
window.WierszPodmiotu = WierszPodmiotu;
window.WierszDodania = WierszDodania;
window.NawigacjaKreatora = NawigacjaKreatora;
window.ZwijanaSekcja = ZwijanaSekcja;
window.Przelacznik = Przelacznik;
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
window.PoleHaslo = PoleHaslo;
window.Kalendarz = Kalendarz;
window.WyborZKartoteki = WyborZKartoteki;
window.PaletaPolecen = PaletaPolecen;
window.usePaletaPolecen = usePaletaPolecen;
window.dataSlownie = dataSlownie;
window.useAutozapis = useAutozapis;
window.StanZapisu = StanZapisu;
