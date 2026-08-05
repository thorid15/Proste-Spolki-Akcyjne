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

function Sidebar({ sciezka, uzytkownik, przyWylogowaniu }) {
  const aktywna = (poz) =>
    poz.sciezka === '/' ? sciezka === '/' : sciezka.startsWith(poz.sciezka);
  const [wylogowywanie, ustawWylogowywanie] = useState(false);

  async function wyloguj() {
    ustawWylogowywanie(true);
    try {
      await API.post('/api/psa/auth/logout');
    } finally {
      przyWylogowaniu();
    }
  }

  return (
    <nav className="sidebar bez-druku">
      <div className="sb-marka">
        <div className="sb-marka-nazwa">Rejestr akcjonariuszy</div>
        <div className="sb-marka-podpis">Proste spółki akcyjne</div>
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

      <div className="sb-stopka">
        <div className="sb-uzytkownik">{uzytkownik.imie}</div>
        <div className="sb-uzytkownik-rola">
          {uzytkownik.rola === 'admin' ? 'administrator' : 'pracownik'} · {uzytkownik.email}
        </div>
        <button className="btn btn-sm" style={{ width: '100%' }} onClick={wyloguj} disabled={wylogowywanie}>
          Wyloguj się
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
        akcja={<button className="btn btn-primary" onClick={() => idz('/')}>Wróć na pulpit</button>}
      />
    </Karta>
  );
}

function Aplikacja() {
  const trasa = useTrasa();
  const sesja = useSesja();

  const { segmenty, zapytanie, sciezka } = trasa;

  function ekran() {
    if (segmenty.length === 0) return <EkranPulpitu />;

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
    <div className="apka">
      <Sidebar sciezka={sciezka} uzytkownik={sesja.uzytkownik} przyWylogowaniu={() => sesja.odswiez()} />
      <main className="tresc">{ekran()}</main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<Aplikacja />);
