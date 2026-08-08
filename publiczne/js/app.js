/* app.js — powłoka aplikacji i router.
   Sesja SESJA-PSA-6-INTERFEJS.md, faza 1.

   Powłoka wg sekcji 2.3: szyna nawigacji 220 px (stan aktywny to pasek na
   lewej krawędzi, nie wypełnione tło), treść WYŚRODKOWANA w kontenerze
   1240 px, paleta poleceń pod Ctrl/⌘+K. Topbar z poprzedniej wersji zniknął —
   tożsamość modułu niesie szyna, a nie belka powtarzana na każdym ekranie. */

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
      { sciezka: '/konfiguracja/szablony', nazwa: 'Szablony dokumentów', faza: 4 },
      { sciezka: '/konfiguracja/uzytkownicy', nazwa: 'Użytkownicy', admin: true },
      { sciezka: '/podglad', nazwa: 'Podgląd systemu' },
    ],
  },
];

function Szyna({ sciezka, uzytkownik, przyWylogowaniu, przyPalecie }) {
  const [wylogowywanie, ustawWylogowywanie] = useState(false);
  const { dane } = useDane('/api/wspolne/kancelaria');
  const kancelaria = dane && dane.kancelaria;

  const aktywna = (poz) =>
    poz.sciezka === '/' ? sciezka === '/' : sciezka.startsWith(poz.sciezka);

  async function wyloguj() {
    ustawWylogowywanie(true);
    try {
      await API.post('/api/psa/auth/logout');
    } finally {
      przyWylogowaniu();
    }
  }

  return (
    <nav className="szyna bez-druku">
      <div className="szyna-marka">
        <div className="szyna-marka-nazwa">Rejestr akcjonariuszy</div>
        <div className="szyna-marka-podpis">
          {kancelaria ? kancelaria.nazwa : 'Kancelaria Notarialna'}
        </div>
      </div>

      <div style={{ padding: `0 var(--od-16) var(--od-24)` }}>
        <button className="btn btn-maly" style={{ width: '100%' }} onClick={przyPalecie}>
          Szukaj… <span className="klawisz">⌘K</span>
        </button>
      </div>

      {MENU.map((g) => (
        <div className="szyna-grupa" key={g.grupa}>
          <div className="szyna-grupa-tytul">{g.grupa}</div>
          {g.pozycje
            .filter((poz) => !poz.admin || uzytkownik.rola === 'admin')
            .map((poz) => (
              <button
                key={poz.sciezka}
                className={`szyna-poz ${aktywna(poz) ? 'aktywna' : ''} ${poz.faza ? 'zablokowana' : ''}`}
                disabled={Boolean(poz.faza)}
                title={poz.faza ? `Wchodzi w fazie ${poz.faza}` : undefined}
                onClick={() => !poz.faza && idz(poz.sciezka)}
              >
                <span>{poz.nazwa}</span>
                {poz.faza && <Pigulka>faza {poz.faza}</Pigulka>}
              </button>
            ))}
        </div>
      ))}

      <div className="szyna-stopka">
        <div className="male">{uzytkownik.imie}</div>
        <div className="podstawa-prawna" style={{ marginBottom: 'var(--od-8)' }}>
          {uzytkownik.rola === 'admin' ? 'administrator' : 'pracownik kancelarii'}
        </div>
        <button className="btn btn-maly" onClick={wyloguj} disabled={wylogowywanie}>
          {wylogowywanie ? 'Wylogowywanie…' : 'Wyloguj'}
        </button>
      </div>
    </nav>
  );
}

function NieZnaleziono() {
  return (
    <Karta>
      <Pusto
        tytul="Nie ma takiej strony"
        opis="Adres nie odpowiada żadnemu ekranowi modułu."
        akcja={<button className="btn btn-glowny" onClick={() => idz('/')}>Wróć na pulpit</button>}
      />
    </Karta>
  );
}

function Aplikacja() {
  const trasa = useTrasa();
  const sesja = useSesja();
  const paleta = usePaletaPolecen();

  const { segmenty, zapytanie, sciezka } = trasa;

  function ekran() {
    if (segmenty.length === 0) return <EkranPulpitu />;
    if (segmenty[0] === 'podglad') return <EkranPodgladu />;

    if (segmenty[0] === 'spolki') {
      if (segmenty.length === 1) return <EkranSpolek />;
      if (segmenty[1] === 'nowa') return <EkranNowejSpolki />;

      const id = Number(segmenty[1]);
      if (!Number.isInteger(id)) return <NieZnaleziono />;
      if (segmenty.length === 2) return <EkranKokpitu spolkaId={id} />;
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
    <div className="powloka">
      <Szyna
        sciezka={sciezka}
        uzytkownik={sesja.uzytkownik}
        przyWylogowaniu={() => sesja.odswiez()}
        przyPalecie={paleta.otworz}
      />
      <main className="tresc">{ekran()}</main>
      {paleta.otwarta && <PaletaPolecen przyZamknieciu={paleta.zamknij} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<Aplikacja />);
