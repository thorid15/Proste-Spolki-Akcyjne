/* elementy.js — wspólne elementy ekranów kancelarii (§ 5): słowniki stanów, obsługa błędów API,
   wybór osoby z kartoteki (z dodaniem nowej w miejscu), formularz osoby, pliki, tabele stanu rejestru. */

const STANY_SPRAWY = { w_toku: 'W toku', wstrzymana: 'Wstrzymana', wpisana: 'Wpisana', odmowa: 'Odmowa', wycofana: 'Wycofana' };
const ODMIANY_STANU_SPRAWY = { w_toku: 'rejestr', wstrzymana: 'mosiadz', odmowa: 'sygnal' };
const STANY_PISMA = { do_wyslania: 'Do wysłania', wyslane: 'Wysłane', blad: 'Błąd wysyłki' };
const KANALY = { email: 'e-mail', list: 'list', portal: 'portal' };
const NAZWY_TYPOW = {
  otwarcie: 'Otwarcie rejestru', emisja: 'Emisja', przeniesienie: 'Przeniesienie', umorzenie: 'Umorzenie',
  obciazenie: 'Obciążenie', adnotacja: 'Informacja o akcjach', sprostowanie: 'Sprostowanie', zamkniecie: 'Zamknięcie rejestru',
};
const NAZWY_ATRYBUTOW = {
  zastaw: 'Zastaw', uzytkowanie: 'Użytkowanie', zajecie: 'Zajęcie', uprawnienie: 'Uprawnienie', ograniczenie: 'Ograniczenie',
  obowiazek: 'Obowiązek', niepokryte: 'Niepokryte', inna: 'Inna informacja',
};

/** Zakresy `[{ nr_od, nr_do }]` → „1–10, 15”. */
function numeryAkcji(zakresy) {
  return (zakresy || []).map((z) => (z.nr_od === z.nr_do ? String(z.nr_od) : `${z.nr_od}–${z.nr_do}`)).join(', ');
}

/** Komunikaty z błędu API: lista tekstów i mapa błędów przy polach. */
function bledyApi(blad) {
  if (!blad) return { lista: [], pola: {} };
  const pola = {};
  const lista = [];
  const szczegoly = (blad.dane && blad.dane.szczegoly) || [];
  for (const b of [...(blad.bledy || [blad.message]), ...szczegoly]) {
    if (b && typeof b === 'object') {
      if (b.pole && !pola[b.pole]) pola[b.pole] = b.komunikat;
      lista.push(b.komunikat);
    } else if (b) lista.push(String(b));
  }
  return { lista, pola };
}

function Bledy({ blad }) {
  const { lista } = bledyApi(blad);
  if (!lista.length) return null;
  return <Komunikat odmiana="blad" tytul={lista.length > 1 ? 'Popraw, zanim przejdziesz dalej' : undefined} tresc={lista.length === 1 ? lista[0] : undefined} lista={lista.length > 1 ? lista : undefined} />;
}

/** Czynność z obsługą „trwa” i błędu: `const a = useCzynnosc(); a.wykonaj(async () => …)`. */
function useCzynnosc() {
  const [trwa, ustawTrwa] = useState(false);
  const [blad, ustawBlad] = useState(null);
  async function wykonaj(fn) {
    ustawTrwa(true);
    ustawBlad(null);
    try {
      return await fn();
    } catch (e) {
      ustawBlad(e);
      return undefined;
    } finally {
      ustawTrwa(false);
    }
  }
  return { trwa, blad, wykonaj, ustawBlad };
}

/** Filtr listy — przyciski z jednym wybranym. */
function Filtr({ opcje, wartosc, przyZmianie, etykieta = 'Filtr' }) {
  return (
    <div className="rzad filtr" role="group" aria-label={etykieta}>
      {opcje.map(([klucz, nazwa]) => (
        <button key={klucz} type="button" className={`btn btn-maly ${wartosc === klucz ? 'btn-glowny' : ''}`} aria-pressed={wartosc === klucz} onClick={() => przyZmianie(klucz)}>
          {nazwa}
        </button>
      ))}
    </div>
  );
}

/** Menu „Więcej” — czynności drugorzędne; niedostępne są ukryte (§ 5). */
function Wiecej({ akcje }) {
  const [otwarte, ustawOtwarte] = useState(false);
  const widoczne = (akcje || []).filter(Boolean);
  useEffect(() => {
    if (!otwarte) return undefined;
    const zamknij = () => ustawOtwarte(false);
    window.addEventListener('click', zamknij);
    return () => window.removeEventListener('click', zamknij);
  }, [otwarte]);
  if (!widoczne.length) return null;
  return (
    <div className="wiecej" onClick={(z) => z.stopPropagation()}>
      <button type="button" className="btn" aria-expanded={otwarte} aria-haspopup="menu" onClick={() => ustawOtwarte((o) => !o)}>
        Więcej <Ikona nazwa="strzalkaDol" rozmiar={14} />
      </button>
      {otwarte && (
        <div className="wiecej-menu" role="menu">
          {widoczne.map((a) => (
            <button key={a.etykieta} type="button" role="menuitem" className={a.niebezpieczna ? 'akcja-niszczaca' : ''} onClick={() => { ustawOtwarte(false); a.przyKlik(); }}>
              {a.etykieta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Przycisk główny zależny od stanu; gdy niedostępny — wyszarzony z powodem obok (§ 5). */
function PrzyciskGlowny({ etykieta, przyKlik, powod, trwa }) {
  return (
    <span className="przycisk-glowny">
      <button type="button" className="btn btn-glowny" onClick={przyKlik} disabled={Boolean(powod) || trwa}>{trwa ? 'Chwileczkę…' : etykieta}</button>
      {powod && <span className="przycisk-glowny-powod">{powod}</span>}
    </span>
  );
}

/* ── Pliki ─────────────────────────────────────────── */

async function wgrajPlik(adres, plik, pola = {}) {
  // Formularz niesie wyłącznie plik; parametry idą w adresie (serwer nie przyjmuje pól tekstowych — audyt W1).
  const dane = new FormData();
  dane.append('plik', plik);
  const zapytanie = new URLSearchParams(pola).toString();
  const odp = await fetch(zapytanie ? `${adres}${adres.includes('?') ? '&' : '?'}${zapytanie}` : adres, { method: 'POST', body: dane });
  let wynik = null;
  try { wynik = await odp.json(); } catch { wynik = null; }
  if (!odp.ok) throw new BladApi((wynik && wynik.blad) || `Błąd ${odp.status}.`, wynik, odp.status);
  return wynik;
}

/** Jedno pole „Dodaj plik” (także przeciągnięciem), bez wyboru rodzaju (§ 5). */
function DodajPlik({ adres, przyDodaniu, etykieta = 'Dodaj plik', pola = {} }) {
  const ref = useRef(null);
  const [nad, ustawNad] = useState(false);
  const c = useCzynnosc();
  const wyslij = (pliki) => c.wykonaj(async () => {
    for (const p of pliki) {
      const w = await wgrajPlik(adres, p, pola);
      if (przyDodaniu) przyDodaniu(w);
    }
  });
  return (
    <div
      className={`dodaj-plik ${nad ? 'dodaj-plik-nad' : ''}`}
      onDragOver={(z) => { z.preventDefault(); ustawNad(true); }}
      onDragLeave={() => ustawNad(false)}
      onDrop={(z) => { z.preventDefault(); ustawNad(false); wyslij([...z.dataTransfer.files]); }}
    >
      <input ref={ref} type="file" className="sr-only" aria-label="Wybierz plik" tabIndex={-1} accept=".pdf,.jpg,.jpeg,.png,.xades,.xml,.sig,.p7s" onChange={(z) => { wyslij([...z.target.files]); z.target.value = ''; }} />
      <button type="button" className="btn btn-maly" onClick={() => ref.current.click()} disabled={c.trwa}>
        <Ikona nazwa="plus" rozmiar={14} /> {c.trwa ? 'Wgrywanie…' : etykieta}
      </button>
      <span className="male drugorzedny">albo przeciągnij plik tutaj</span>
      <Bledy blad={c.blad} />
    </div>
  );
}

function ListaPlikow({ pliki }) {
  if (!pliki || !pliki.length) return <p className="male drugorzedny">Brak plików.</p>;
  return (
    <ul className="lista-plikow">
      {pliki.map((p) => (
        <li key={p.id}>
          <a href={`/api/psa/pliki/${p.id}`} download>{p.nazwa}</a>
          <span className="male drugorzedny"> · {fmt.data(p.wgrano)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Osoby ─────────────────────────────────────────── */

const PUSTA_OSOBA = { typ: 'fizyczna', nazwa: '', pesel: '', data_urodzenia: '', numer_rejestru: '', adres: '', rodzaj_adresu: 'glowny', email: '' };

function opisOsoby(o) {
  if (!o) return '';
  const id = o.typ === 'prawna' ? (o.numer_rejestru ? `nr w rejestrze ${o.numer_rejestru}` : null)
    : o.pesel ? `PESEL ${o.pesel}` : o.data_urodzenia ? `ur. ${fmt.data(o.data_urodzenia)}` : null;
  return [id, o.adres].filter(Boolean).join(' · ');
}

/** Pola danych osoby (nowy model kartoteki). `pelne` — także PEP, AML i uwagi (karta osoby). */
function PolaOsoby({ osoba, przyZmianie, bledy = {}, pelne = false }) {
  const z = (pole) => (w) => przyZmianie({ ...osoba, [pole]: w });
  const tekst = (pole) => ({ value: osoba[pole] || '', onChange: (e) => z(pole)(e.target.value) });
  const prawna = osoba.typ === 'prawna';
  return (
    <div className="pola-osoby">
      <Pole etykieta="Rodzaj" blad={bledy.typ}>
        <select value={osoba.typ} onChange={(e) => z('typ')(e.target.value)}>
          <option value="fizyczna">osoba fizyczna</option>
          <option value="prawna">osoba prawna</option>
        </select>
      </Pole>
      <Pole etykieta={prawna ? 'Firma' : 'Imię i nazwisko'} blad={bledy.nazwa}><input type="text" {...tekst('nazwa')} /></Pole>
      {prawna ? (
        <Pole etykieta="Numer w rejestrze (KRS)" opcjonalne blad={bledy.numer_rejestru}><input type="text" {...tekst('numer_rejestru')} /></Pole>
      ) : (
        <div className="siatka-2">
          <Pole etykieta="PESEL" blad={bledy.pesel} podpowiedz="Bez PESEL — data urodzenia.">
            <input type="text" inputMode="numeric" maxLength={11} {...tekst('pesel')} />
          </Pole>
          <Pole etykieta="Data urodzenia" opcjonalne blad={bledy.data_urodzenia}>
            <PoleDaty wartosc={osoba.data_urodzenia || ''} przyZmianie={z('data_urodzenia')} max={fmt.dzisIso()} wylaczone={Boolean(osoba.pesel)} />
          </Pole>
        </div>
      )}
      <Pole etykieta="Adres" blad={bledy.adres}><input type="text" {...tekst('adres')} /></Pole>
      <Pole etykieta="Rodzaj adresu" blad={bledy.rodzaj_adresu}>
        <select value={osoba.rodzaj_adresu || 'glowny'} onChange={(e) => z('rodzaj_adresu')(e.target.value)}>
          <option value="glowny">{prawna ? 'siedziba' : 'zamieszkania'}</option>
          <option value="doreczen">do doręczeń</option>
        </select>
      </Pole>
      <Pole etykieta="E-mail" opcjonalne blad={bledy.email}><input type="email" {...tekst('email')} /></Pole>
      {pelne && (
        <>
          <Przelacznik
            wlaczony={Boolean(osoba.pep)}
            przyZmianie={(w) => przyZmianie({ ...osoba, pep: w ? 1 : 0 })}
            etykieta="Osoba zajmująca eksponowane stanowisko polityczne (PEP)"
            dzieci={<Pole etykieta="Opis" blad={bledy.pep_opis}><input type="text" {...tekst('pep_opis')} /></Pole>}
          />
          <Pole etykieta="Data weryfikacji AML" opcjonalne blad={bledy.aml_data}>
            <PoleDaty wartosc={osoba.aml_data || ''} przyZmianie={z('aml_data')} max={fmt.dzisIso()} />
          </Pole>
          <Pole etykieta="Uwagi" opcjonalne blad={bledy.uwagi}><textarea rows={2} {...tekst('uwagi')} /></Pole>
        </>
      )}
    </div>
  );
}

/** Nowa osoba w miejscu, bez opuszczania ekranu (§ 5). */
function NowaOsoba({ przyZapisie, przyAnulowaniu, poczatkowa }) {
  const [osoba, ustawOsobe] = useState({ ...PUSTA_OSOBA, ...(poczatkowa || {}) });
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const zapisz = () => c.wykonaj(async () => {
    const w = await API.post('/api/psa/osoby', osoba);
    przyZapisie(w.osoba, w.ostrzezenia || []);
  });
  return (
    <div className="nowa-osoba">
      <PolaOsoby osoba={osoba} przyZmianie={ustawOsobe} bledy={pola} />
      {c.blad && !Object.keys(pola).length && <Bledy blad={c.blad} />}
      <div className="rzad">
        <button type="button" className="btn btn-glowny btn-maly" onClick={zapisz} disabled={c.trwa}>Zapisz osobę</button>
        <button type="button" className="btn btn-maly" onClick={przyAnulowaniu}>Anuluj</button>
      </div>
    </div>
  );
}

/** Wybór osoby z kartoteki (podpowiedzi od 2 znaków) albo dodanie nowej w miejscu. */
function WyborOsoby({ wartosc, przyZmianie, wyklucz = [], id, 'aria-describedby': opis, 'aria-invalid': niepoprawne }) {
  const [szukaj, ustawSzukaj] = useState('');
  const [wyniki, ustawWyniki] = useState([]);
  const [wybrana, ustawWybrana] = useState(null);
  const [nowa, ustawNowa] = useState(false);
  const idListy = useId();

  useEffect(() => {
    if (!wartosc) { ustawWybrana(null); return; }
    if (wybrana && wybrana.id === Number(wartosc)) return;
    API.get(`/api/psa/osoby/${wartosc}`).then((w) => ustawWybrana(w.osoba)).catch(() => ustawWybrana(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wartosc]);

  useEffect(() => {
    const q = szukaj.trim();
    if (q.length < 2) { ustawWyniki([]); return undefined; }
    const t = setTimeout(() => {
      API.get(`/api/psa/osoby?q=${encodeURIComponent(q)}&limit=8`)
        .then((lista) => ustawWyniki(lista.filter((o) => !wyklucz.includes(o.id))))
        .catch(() => ustawWyniki([]));
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [szukaj]);

  const wybierz = (o) => { ustawWybrana(o); ustawSzukaj(''); ustawWyniki([]); ustawNowa(false); przyZmianie(o.id); };

  if (wybrana) {
    return (
      <div className="wybrana-osoba">
        <span><strong>{wybrana.nazwa}</strong> <span className="male drugorzedny">{opisOsoby(wybrana)}</span></span>
        <button type="button" className="btn btn-maly btn-cichy" onClick={() => { ustawWybrana(null); przyZmianie(null); }}>Zmień</button>
      </div>
    );
  }
  if (nowa) return <NowaOsoba poczatkowa={{ nazwa: szukaj }} przyZapisie={(o) => wybierz(o)} przyAnulowaniu={() => ustawNowa(false)} />;
  return (
    <div className="wybor-osoby">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={wyniki.length > 0}
        aria-controls={idListy}
        aria-describedby={opis}
        aria-invalid={niepoprawne}
        placeholder="Nazwisko, firma, PESEL albo KRS…"
        value={szukaj}
        onChange={(e) => ustawSzukaj(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && wyniki[0]) { e.preventDefault(); wybierz(wyniki[0]); } }}
      />
      {wyniki.length > 0 && (
        <ul className="wybor-osoby-lista" role="listbox" id={idListy}>
          {wyniki.map((o) => (
            <li key={o.id} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); wybierz(o); }}>
              <strong>{o.nazwa}</strong> <span className="male drugorzedny">{opisOsoby(o)}</span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-maly btn-cichy" onClick={() => ustawNowa(true)}>+ Nowa osoba</button>
    </div>
  );
}
WyborOsoby.przyjmujeId = true;

/* ── Stan rejestru ─────────────────────────────────── */

function nazwaOsoby(osoby, id) {
  const o = osoby && osoby[id];
  return o ? o.nazwa : `osoba #${id}`;
}

function TabelaSerii({ widok }) {
  if (!widok || !widok.serie.length) return <p className="male drugorzedny">Brak akcji w rejestrze.</p>;
  return (
    <table className="tabela">
      <thead><tr><th>Seria</th><th>Numery</th><th className="liczba">Liczba</th><th>Umorzone</th><th>Wpis do KRS</th></tr></thead>
      <tbody>
        {widok.serie.map((s) => (
          <tr key={s.seria}>
            <td>{s.seria}</td>
            <td>{numeryAkcji(s.zakresy)}</td>
            <td className="liczba">{fmt.liczba(s.liczba)}</td>
            <td>{numeryAkcji(s.umorzone) || '—'}</td>
            <td>{fmt.data(s.data_wpisu_krs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaAkcjonariuszy({ widok, osoby }) {
  if (!widok || !widok.akcjonariusze.length) return <p className="male drugorzedny">Brak akcjonariuszy.</p>;
  return (
    <table className="tabela">
      <thead><tr><th>Akcjonariusz</th><th>Seria</th><th>Numery</th><th className="liczba">Liczba</th><th>Pokryte</th><th>Wpis</th></tr></thead>
      <tbody>
        {widok.akcjonariusze.map((p, i) => (
          <tr key={`${p.osoba_id}-${p.seria}-${i}`}>
            <td><a href={`#/osoby/${p.osoba_id}`}>{nazwaOsoby(osoby, p.osoba_id)}</a></td>
            <td>{p.seria}</td>
            <td>{numeryAkcji(p.zakresy)}</td>
            <td className="liczba">{p.czesc ? `${p.czesc.licznik}/${p.czesc.mianownik}` : fmt.liczba(p.liczba)}</td>
            <td>{p.pokryte ? 'tak' : 'nie'}</td>
            <td>{fmt.data(p.data_wpisu)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Obciążenia i adnotacje; `akcje(a)` — opcjonalne przyciski w wierszu („Zmień”, „Wykreśl”). */
function TabelaAtrybutow({ widok, osoby, akcje }) {
  if (!widok || !widok.atrybuty.length) return <p className="male drugorzedny">Brak obciążeń i adnotacji.</p>;
  return (
    <table className="tabela">
      <thead><tr><th>Rodzaj</th><th>Akcje</th><th>Treść</th><th>Uprawniony</th><th>Prawo głosu</th><th>Wpis</th>{akcje && <th><span className="sr-only">Czynności</span></th>}</tr></thead>
      <tbody>
        {widok.atrybuty.map((a) => (
          <tr key={`${a.zdarzenie_id}-${a.pozycja}-${a.seria}`}>
            <td>{NAZWY_ATRYBUTOW[a.rodzaj] || a.rodzaj}</td>
            <td>{a.seria} {numeryAkcji(a.zakresy)}</td>
            <td>{a.tresc || '—'}</td>
            <td>{a.osoba_id ? nazwaOsoby(osoby, a.osoba_id) : '—'}</td>
            <td>{['zastaw', 'uzytkowanie'].includes(a.rodzaj) ? (a.prawo_glosu ? 'tak' : 'nie') : '—'}</td>
            <td>{fmt.data(a.data_wpisu)}</td>
            {akcje && <td><span className="rzad">{akcje(a)}</span></td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

Object.assign(window, {
  STANY_SPRAWY, ODMIANY_STANU_SPRAWY, STANY_PISMA, KANALY, NAZWY_TYPOW, NAZWY_ATRYBUTOW, numeryAkcji, bledyApi, Bledy, useCzynnosc,
  Filtr, Wiecej, PrzyciskGlowny, wgrajPlik, DodajPlik, ListaPlikow, PUSTA_OSOBA, opisOsoby, PolaOsoby, NowaOsoba, WyborOsoby,
  TabelaSerii, TabelaAkcjonariuszy, TabelaAtrybutow, nazwaOsoby,
});
