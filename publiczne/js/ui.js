/* ui.js — komponenty zastane, stopniowo zastępowane przez `ui-rejestr.js`.

   Sesja SESJA-PSA-6-INTERFEJS.md, faza 1: prymitywy (Karta, Pole, Modal,
   Sekcja, Komunikat, Pusto, Spinner) są już nadpisane nowszymi wersjami
   z `ui-rejestr.js`, ładowanego zaraz po tym pliku. Zostaje tu wyłącznie to,
   czego nowy system jeszcze nie ma: Znacznik, StatusSpolki, StatusAml,
   Wyniki, WyborOsoby. Plik zniknie, gdy fazy 2-4 przepiszą swoje ekrany. */

function Spinner() {
  return (
    <div className="ladowanie">
      <div className="spin" />
    </div>
  );
}

function Karta({ tytul, akcje, dzieci, tight, children }) {
  const tresc = children ?? dzieci;
  if (tight) {
    return (
      <div className="card tight">
        {tytul && (
          <div className="card-label">
            <span>{tytul}</span>
            {akcje && <span style={{ marginLeft: 'auto' }}>{akcje}</span>}
          </div>
        )}
        {tresc}
      </div>
    );
  }
  return (
    <div className="card">
      {(tytul || akcje) && (
        <div className="row-b" style={{ marginBottom: tytul ? 14 : 0 }}>
          {tytul && <div className="card-h" style={{ marginBottom: 0 }}>{tytul}</div>}
          {akcje && <div className="row-g">{akcje}</div>}
        </div>
      )}
      {tresc}
    </div>
  );
}

function Pole({ etykieta, podpowiedz, children, wymagane }) {
  return (
    <div className="frow">
      {etykieta && (
        <label className="fl">
          {etykieta}
          {wymagane && <span style={{ color: 'var(--burgundy)' }}> *</span>}
        </label>
      )}
      {children}
      {podpowiedz && <div className="podpowiedz">{podpowiedz}</div>}
    </div>
  );
}

function Znacznik({ odmiana = 'neutralny', children }) {
  return <span className={`znacznik znacznik-${odmiana}`}>{children}</span>;
}

const ODMIANY_STATUSU = {
  aktywna: 'zielony',
  w_likwidacji: 'oliwka',
  zawieszona: 'lupek',
  wykreslona: 'bordo',
  umorzona: 'bordo',
  w_umarzaniu: 'oliwka',
};

const NAZWY_STATUSU = {
  aktywna: 'aktywna',
  w_likwidacji: 'w likwidacji',
  zawieszona: 'zawieszona',
  wykreslona: 'wykreślona',
  umorzona: 'umorzona',
  w_umarzaniu: 'w umarzaniu',
};

function StatusSpolki({ status }) {
  return (
    <Znacznik odmiana={ODMIANY_STATUSU[status] || 'neutralny'}>
      {NAZWY_STATUSU[status] || status}
    </Znacznik>
  );
}

const NAZWY_AML = { brak: 'AML: brak', wykonane: 'AML: wykonane', niemozliwe: 'AML: niemożliwe' };
const ODMIANY_AML = { brak: 'oliwka', wykonane: 'zielony', niemozliwe: 'bordo' };

function StatusAml({ status }) {
  if (!status) return null;
  return <Znacznik odmiana={ODMIANY_AML[status] || 'neutralny'}>{NAZWY_AML[status] || status}</Znacznik>;
}

function Komunikat({ odmiana = 'info', tytul, tresc, lista }) {
  if (!tresc && (!lista || lista.length === 0)) return null;
  return (
    <div className={`komunikat komunikat-${odmiana}`}>
      {tytul && <div className="komunikat-tytul">{tytul}</div>}
      {tresc && <div>{tresc}</div>}
      {lista && lista.length > 0 && (
        <ul>
          {lista.map((pozycja, i) => (
            <li key={i}>{pozycja}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Błędy blokujące i ostrzeżenia — dwie różne rzeczy, dwa różne komunikaty. */
function Wyniki({ bledy, ostrzezenia }) {
  return (
    <>
      <Komunikat
        odmiana="blad"
        tytul={
          bledy && bledy.length === 1
            ? 'Wpis nie może zostać dokonany:'
            : 'Wpis nie może zostać dokonany — przeszkody:'
        }
        lista={bledy}
      />
      <Komunikat odmiana="uwaga" tytul="Do sprawdzenia:" lista={ostrzezenia} />
    </>
  );
}

function Pusto({ tytul, opis, akcja }) {
  return (
    <div className="empty">
      <div className="empty-h">{tytul}</div>
      {opis && <div style={{ marginBottom: akcja ? 20 : 0 }}>{opis}</div>}
      {akcja}
    </div>
  );
}

function Modal({ tytul, children, stopka, przyZamknieciu, szerokosc }) {
  useEscape(() => przyZamknieciu && przyZamknieciu());
  return (
    <div
      className="overlay"
      onMouseDown={(z) => {
        if (z.target === z.currentTarget && przyZamknieciu) przyZamknieciu();
      }}
    >
      <div className="modal" style={szerokosc ? { maxWidth: szerokosc } : undefined}>
        {tytul && <div className="modal-title">{tytul}</div>}
        {children}
        {stopka && <div className="modal-foot">{stopka}</div>}
      </div>
    </div>
  );
}

/** Sekcja zwijana kokpitu. */
function Sekcja({ tytul, licznik, domyslnieOtwarta = false, akcje, children }) {
  const [otwarta, ustawOtwarta] = useState(domyslnieOtwarta);
  return (
    <div className="sekcja">
      <button className="sekcja-naglowek" onClick={() => ustawOtwarta((o) => !o)}>
        <span className="sekcja-tytul">
          <span className={`strzalka ${otwarta ? 'otwarta' : ''}`}>▶</span>
          {tytul}
          {licznik !== undefined && licznik !== null && (
            <Znacznik odmiana="neutralny">{licznik}</Znacznik>
          )}
        </span>
        {akcje && (
          <span className="row-g" onClick={(z) => z.stopPropagation()}>
            {akcje}
          </span>
        )}
      </button>
      {otwarta && <div className="sekcja-tresc bez-marginesu">{children}</div>}
    </div>
  );
}

/**
 * Wyszukiwarka osób z kartoteki (reguła domenowa nr 10 — jeden inwestor
 * wpisywany raz). Pozwala też założyć nową osobę bez opuszczania kreatora.
 */
function WyborOsoby({ wartosc, przyZmianie, placeholder = 'Szukaj w kartotece…', wyklucz = [] }) {
  const [szukaj, ustawSzukaj] = useState('');
  const [wyniki, ustawWyniki] = useState([]);
  const [otwarte, ustawOtwarte] = useState(false);
  const [wybrana, ustawWybrana] = useState(null);
  const [nowa, ustawNowa] = useState(false);

  useEffect(() => {
    if (!wartosc) {
      ustawWybrana(null);
      return;
    }
    if (wybrana && wybrana.id === wartosc) return;
    API.get(`/api/psa/osoby/${wartosc}`)
      .then((o) => ustawWybrana(o.osoba))
      .catch(() => ustawWybrana(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wartosc]);

  useEffect(() => {
    if (!otwarte) return undefined;
    const uchwyt = setTimeout(() => {
      API.get(`/api/psa/osoby?q=${encodeURIComponent(szukaj)}`)
        .then((o) => ustawWyniki(o.osoby.filter((x) => !wyklucz.includes(x.id))))
        .catch(() => ustawWyniki([]));
    }, 180);
    return () => clearTimeout(uchwyt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [szukaj, otwarte, wyklucz.join(',')]);

  if (wybrana && !otwarte) {
    return (
      <div className="row-b" style={{ gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{wybrana.oznaczenie}</div>
          <div className="podpowiedz" style={{ marginTop: 2 }}>
            {wybrana.typ === 'prawna' ? 'osoba prawna' : 'osoba fizyczna'}
            {wybrana.jawny_identyfikator ? ` · ${wybrana.jawny_identyfikator}` : ''}
            {wybrana.aml_status !== 'wykonane' ? ' · AML niepotwierdzony' : ''}
          </div>
        </div>
        <button
          className="btn btn-sm"
          onClick={() => {
            ustawOtwarte(true);
            ustawSzukaj('');
          }}
        >
          Zmień
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={szukaj}
        placeholder={placeholder}
        onFocus={() => ustawOtwarte(true)}
        onChange={(z) => {
          ustawSzukaj(z.target.value);
          ustawOtwarte(true);
        }}
      />
      {otwarte && (
        <div
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            marginTop: 6,
            maxHeight: 260,
            overflowY: 'auto',
            background: 'var(--surf)',
          }}
        >
          {wyniki.map((o) => (
            <div
              key={o.id}
              className="klikalny"
              style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-2)' }}
              onClick={() => {
                przyZmianie(o.id);
                ustawWybrana(o);
                ustawOtwarte(false);
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{o.oznaczenie}</div>
              <div className="podpowiedz" style={{ marginTop: 1 }}>
                {o.typ === 'prawna' ? 'osoba prawna' : 'osoba fizyczna'}
                {o.jawny_identyfikator ? ` · ${o.jawny_identyfikator}` : ''}
                {o.liczba_spolek ? ` · w ${o.liczba_spolek} sp.` : ''}
              </div>
            </div>
          ))}
          {wyniki.length === 0 && (
            <div style={{ padding: '14px', color: 'var(--ink-4)', fontSize: 13 }}>
              Brak osób pasujących do wyszukiwania.
            </div>
          )}
          <div style={{ padding: 10, borderTop: '1px solid var(--line-2)' }}>
            <button className="btn btn-sm" onClick={() => ustawNowa(true)}>
              + Nowa osoba w kartotece
            </button>
          </div>
        </div>
      )}
      {nowa && (
        <FormularzOsoby
          przyZamknieciu={() => ustawNowa(false)}
          przyZapisie={(o) => {
            ustawNowa(false);
            ustawWybrana(o);
            ustawOtwarte(false);
            przyZmianie(o.id);
          }}
        />
      )}
    </div>
  );
}

window.Spinner = Spinner;
window.Karta = Karta;
window.Pole = Pole;
window.Znacznik = Znacznik;
window.StatusSpolki = StatusSpolki;
window.StatusAml = StatusAml;
window.Komunikat = Komunikat;
window.Wyniki = Wyniki;
window.Pusto = Pusto;
window.Modal = Modal;
window.Sekcja = Sekcja;
window.WyborOsoby = WyborOsoby;
window.NAZWY_STATUSU = NAZWY_STATUSU;
