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
    pozycje: [{ sciezka: '/oplaty', nazwa: 'Opłaty', sprint: 4 }],
  },
  {
    grupa: 'Konfiguracja',
    pozycje: [
      { sciezka: '/konfiguracja/stawki', nazwa: 'Stawki i terminy' },
      { sciezka: '/konfiguracja/szablony', nazwa: 'Szablony dokumentów', sprint: 4 },
      { sciezka: '/konfiguracja/uzytkownicy', nazwa: 'Użytkownicy', sprint: 3 },
    ],
  },
];

function Sidebar({ sciezka, uzytkownik, przyZmianieUzytkownika }) {
  const aktywna = (poz) =>
    poz.sciezka === '/' ? sciezka === '/' : sciezka.startsWith(poz.sciezka);

  return (
    <nav className="sidebar bez-druku">
      <div className="sb-marka">
        <div className="sb-marka-nazwa">Rejestr akcjonariuszy</div>
        <div className="sb-marka-podpis">Proste spółki akcyjne</div>
      </div>

      {MENU.map((g) => (
        <div className="sb-grupa" key={g.grupa}>
          <div className="sb-grupa-tytul">{g.grupa}</div>
          {g.pozycje.map((poz) => (
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
        <div className="sb-grupa-tytul" style={{ padding: '0 0 6px' }}>Prowadzi czynności</div>
        <button className="btn btn-sm" style={{ width: '100%' }} onClick={przyZmianieUzytkownika}>
          {uzytkownik || 'Ustaw osobę'}
        </button>
        <div className="podpowiedz" style={{ marginTop: 8 }}>
          Autor zapisywany przy każdym zdarzeniu. Logowanie wchodzi w sprincie 3.
        </div>
      </div>
    </nav>
  );
}

/** Ustalenie autora czynności — bez tego nie da się dokonać wpisu. */
function ModalUzytkownika({ wartosc, przyZapisie, przyZamknieciu }) {
  const [imie, ustawImie] = useState(wartosc || '');
  return (
    <Modal
      tytul="Kto prowadzi czynności?"
      przyZamknieciu={wartosc ? przyZamknieciu : undefined}
      szerokosc={470}
      stopka={
        <>
          {wartosc && <button className="btn" onClick={przyZamknieciu}>Anuluj</button>}
          <button
            className="btn btn-primary"
            disabled={!imie.trim()}
            onClick={() => przyZapisie(imie.trim())}
          >
            Zapisz
          </button>
        </>
      }
    >
      <Pole
        etykieta="Imię i nazwisko"
        wymagane
        podpowiedz={
          'Zapisujemy je przy każdym zdarzeniu rejestrowym jako autora wpisu. ' +
          'Na start wpisu może dokonać każdy pracownik kancelarii — model ról ustalimy ' +
          'po odpowiedzi izby notarialnej.'
        }
      >
        <input
          type="text"
          value={imie}
          autoFocus
          onChange={(z) => ustawImie(z.target.value)}
          onKeyDown={(z) => z.key === 'Enter' && imie.trim() && przyZapisie(imie.trim())}
        />
      </Pole>
    </Modal>
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
  const [uzytkownik, ustawUzytkownika] = useState(pobierzUzytkownika());
  const [modalUzytkownika, ustawModalUzytkownika] = useState(!pobierzUzytkownika());

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
    if (segmenty[0] === 'konfiguracja' && segmenty[1] === 'stawki') return <EkranStawek />;

    return <NieZnaleziono />;
  }

  return (
    <div className="apka">
      <Sidebar
        sciezka={sciezka}
        uzytkownik={uzytkownik}
        przyZmianieUzytkownika={() => ustawModalUzytkownika(true)}
      />
      <main className="tresc">{ekran()}</main>

      {modalUzytkownika && (
        <ModalUzytkownika
          wartosc={uzytkownik}
          przyZamknieciu={() => ustawModalUzytkownika(false)}
          przyZapisie={(imie) => {
            zapiszUzytkownika(imie);
            ustawUzytkownika(imie);
            ustawModalUzytkownika(false);
          }}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<Aplikacja />);
