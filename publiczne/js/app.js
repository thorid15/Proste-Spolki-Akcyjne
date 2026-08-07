/* app.js — sidebar, router i montaż aplikacji.

   Sidebar wg sekcji 9 specyfikacji: Praca · Rozliczenia · Konfiguracja.
   Pozycje, które wchodzą w późniejszych sprintach, są widoczne, ale zablokowane
   — układ nie przeskoczy, gdy je uruchomimy. */

const MENU = [
  {
    grupa: 'Praca',
    pozycje: [
      { sciezka: '/', nazwa: 'Pulpit' },
      { sciezka: '/sprawy', nazwa: 'Kolejka spraw' },
      { sciezka: '/spolki', nazwa: 'Spółki' },
      { sciezka: '/osoby', nazwa: 'Kartoteka osób' },
    ],
  },
  {
    grupa: 'Rozliczenia',
    pozycje: [{ sciezka: '/oplaty', nazwa: 'Opłaty' }],
  },
  {
    grupa: 'Konfiguracja',
    pozycje: [
      { sciezka: '/konfiguracja/stawki', nazwa: 'Stawki i terminy' },
      { sciezka: '/konfiguracja/szablony', nazwa: 'Szablony dokumentów', sprint: 4 },
      { sciezka: '/konfiguracja/uzytkownicy', nazwa: 'Użytkownicy', admin: true },
    ],
  },
];

/**
 * Topbar 64px, sticky: wordmark modułu po lewej, pigułka użytkownika po
 * prawej (faza 1.3). Gdy ekran zgłosi tryb archiwalny (faza 2.2 — „stan na"
 * ≠ teraz), pigułka użytkownika ustępuje miejsca pigułce archiwalnej.
 */
function Topbar({ uzytkownik, przyWylogowaniu, archiwalny }) {
  const [wylogowywanie, ustawWylogowywanie] = useState(false);
  const inicjal = (uzytkownik.imie || '?').trim().charAt(0).toUpperCase();

  async function wyloguj() {
    ustawWylogowywanie(true);
    try {
      await API.post('/api/psa/auth/logout');
    } finally {
      przyWylogowaniu();
    }
  }

  return (
    <header className="app-topbar bez-druku">
      <div className="app-topbar-marka">Rejestr akcjonariuszy P.S.A.</div>
      <div className="row-g">
        {archiwalny && (
          <span className="pigulka-archiwalna">
            Widok archiwalny — {archiwalny.opis}
            <button className="btn btn-sm" onClick={archiwalny.powrot}>Wróć do dziś</button>
          </span>
        )}
        <div className="app-topbar-pigulka">
          <span className="app-topbar-inicjal">{inicjal}</span>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{uzytkownik.imie}</span>
          <button className="btn btn-sm" onClick={wyloguj} disabled={wylogowywanie}>
            Wyloguj
          </button>
        </div>
      </div>
    </header>
  );
}

function Sidebar({ sciezka, uzytkownik }) {
  const aktywna = (poz) =>
    poz.sciezka === '/' ? sciezka === '/' : sciezka.startsWith(poz.sciezka);
  const { dane } = useDane('/api/wspolne/kancelaria');
  const kancelaria = dane && dane.kancelaria;

  return (
    <nav className="sidebar bez-druku">
      <div className="sb-marka">
        <div className="sb-marka-nazwa">{kancelaria ? kancelaria.nazwa : 'Kancelaria Notarialna'}</div>
        <div className="sb-marka-podpis">Podmiot prowadzący rejestr</div>
      </div>

      {MENU.map((g) => (
        <div className="sb-grupa" key={g.grupa}>
          <div className="sb-grupa-tytul">{g.grupa}</div>
          {g.pozycje
            .filter((poz) => !poz.admin || uzytkownik.rola === 'admin')
            .map((poz) => (
              <button
                key={poz.sciezka}
                className={`sb-poz ${aktywna(poz) ? 'aktywna' : ''} ${poz.sprint ? 'zablokowana' : ''}`}
                disabled={Boolean(poz.sprint)}
                title={poz.sprint ? `Wchodzi w sprincie ${poz.sprint}` : undefined}
                onClick={() => !poz.sprint && idz(poz.sciezka)}
              >
                <span>{poz.nazwa}</span>
                {poz.sprint && <span className="znacznik znacznik-neutralny">sprint {poz.sprint}</span>}
              </button>
            ))}
        </div>
      ))}
    </nav>
  );
}

function NieZnaleziono() {
  return (
    <Karta>
      <Pusto
        tytul="Nie ma takiej strony"
        opis="Adres nie odpowiada żadnemu ekranowi modułu."
        akcja={<button className="btn btn-primary" onClick={() => idz('/')}>Wróć na pulpit</button>}
      />
    </Karta>
  );
}

function Aplikacja() {
  const trasa = useTrasa();
  const sesja = useSesja();
  // Tryb archiwalny (faza 2.2) - zglaszany przez ekran kokpitu, czytany przez
  // Topbar (pigulka) i main-wrap (tlo). Zyje tutaj, nie w EkranKokpitu, bo
  // pigulka jest w topbarze - poza poddrzewem, ktore kokpit renderuje.
  const [archiwalny, ustawArchiwalny] = useState(null);

  const { segmenty, zapytanie, sciezka } = trasa;

  // Kreator i formularze dostają węższą kolumnę treści (faza 3.2) — jeden
  // ekran, jedna kolumna pól, bez rozciągania na szerokość list/kokpitu.
  // Kreator OSADZONY w kroku 3–4 sprawy (EkranSprawy) ma własną, lokalną
  // szerokość (sprawy.js) — reszta tego ekranu (dokumenty, akcje) zostaje
  // szeroka, więc tu się go nie uwzględnia.
  const waski =
    (segmenty[0] === 'spolki' && segmenty[1] === 'nowa') ||
    (segmenty[0] === 'spolki' && segmenty.length >= 3 && (segmenty[2] === 'zdarzenie' || segmenty[2] === 'migracja'));

  // Zmiana trasy = koniec ewentualnego trybu archiwalnego poprzedniego ekranu.
  useEffect(() => {
    ustawArchiwalny(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sciezka]);

  function ekran() {
    if (segmenty.length === 0) return <EkranPulpitu />;

    if (segmenty[0] === 'spolki') {
      if (segmenty.length === 1) return <EkranSpolek />;
      if (segmenty[1] === 'nowa') return <EkranNowejSpolki />;

      const id = Number(segmenty[1]);
      if (!Number.isInteger(id)) return <NieZnaleziono />;
      if (segmenty.length === 2) return <EkranKokpitu spolkaId={id} ustawArchiwalny={ustawArchiwalny} />;
      if (segmenty[2] === 'zdarzenie') return <EkranNowejSprawy spolkaId={id} />;
      if (segmenty[2] === 'migracja') return <EkranMigracji spolkaId={id} />;
      if (segmenty[2] === 'wydruk') {
        const data = zapytanie.get('data') || undefined;
        if (segmenty[3] === 'raport') return <EkranRaportu spolkaId={id} dataPoczatkowa={data} />;
        if (segmenty[3] === 'informacja') return <EkranInformacji spolkaId={id} dataPoczatkowa={data} />;
      }
      return <NieZnaleziono />;
    }

    if (segmenty[0] === 'sprawy') {
      if (segmenty.length === 1) return <EkranKolejkiSpraw />;
      const id = Number(segmenty[1]);
      if (!Number.isInteger(id)) return <NieZnaleziono />;
      return <EkranSprawy sprawaId={id} />;
    }

    if (segmenty[0] === 'osoby') return <EkranOsob />;
    if (segmenty[0] === 'oplaty') return <EkranOplat />;
    if (segmenty[0] === 'konfiguracja' && segmenty[1] === 'stawki') return <EkranStawek />;
    if (segmenty[0] === 'konfiguracja' && segmenty[1] === 'uzytkownicy') {
      return sesja.uzytkownik.rola === 'admin' ? <EkranUzytkownikow /> : <NieZnaleziono />;
    }

    return <NieZnaleziono />;
  }

  if (sesja.ladowanie) return <Spinner />;
  if (!sesja.zalogowany) {
    return <EkranLogowania przyZalogowaniu={() => sesja.odswiez()} />;
  }

  return (
    <div className="apka">
      <Topbar uzytkownik={sesja.uzytkownik} przyWylogowaniu={() => sesja.odswiez()} archiwalny={archiwalny} />
      <div className={`main-wrap ${archiwalny ? 'archiwalny' : ''}`}>
        <Sidebar sciezka={sciezka} uzytkownik={sesja.uzytkownik} />
        <main className={`tresc ${waski ? 'tresc-waska' : ''}`}>{ekran()}</main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<Aplikacja />);
