/* app.js — powłoka aplikacji i router.
   Sesja SESJA-PSA-6-INTERFEJS.md, faza 1.

   Powłoka: pływający panel aplikacji (nie rozlewa się po krawędziach okna),
   szyna nawigacji z ikonami i miękką pigułką stanu aktywnego, topbar
   niosący tytuł ekranu i narzędzia (szukaj / powiadomienia / konto),
   treść wyśrodkowana w kolumnie 1240 px, paleta poleceń pod Ctrl/⌘+K.

   Tytuł ekranu mieszka w topbarze, nie w treści — dzięki temu każdy ekran
   zaczyna się od rzeczy, a nie od powtórzonego nagłówka. */

const MENU = [
  {
    grupa: 'Praca',
    pozycje: [
      { sciezka: '/', nazwa: 'Pulpit', ikona: 'pulpit' },
      { sciezka: '/sprawy', nazwa: 'Kolejka spraw', ikona: 'sprawy' },
      { sciezka: '/spolki', nazwa: 'Spółki', ikona: 'spolki' },
      { sciezka: '/osoby', nazwa: 'Kartoteka osób', ikona: 'osoby' },
      { sciezka: '/zgloszenia', nazwa: 'Zgłoszenia', ikona: 'sprawy' },
      { sciezka: '/wnioski', nazwa: 'Wnioski', ikona: 'sprawy' },
    ],
  },
  {
    grupa: 'Rozliczenia',
    pozycje: [{ sciezka: '/oplaty', nazwa: 'Opłaty', ikona: 'oplaty' }],
  },
  {
    grupa: 'Konfiguracja',
    pozycje: [
      { sciezka: '/konfiguracja/stawki', nazwa: 'Stawki i terminy', ikona: 'stawki' },
      { sciezka: '/konfiguracja/szablony', nazwa: 'Szablony dokumentów', ikona: 'szablony', admin: true },
      { sciezka: '/konfiguracja/uzytkownicy', nazwa: 'Użytkownicy', ikona: 'uzytkownicy', admin: true },
      { sciezka: '/podglad', nazwa: 'Podgląd systemu', ikona: 'podglad' },
    ],
  },
];

function Szyna({ sciezka, uzytkownik }) {
  const { dane } = useDane('/api/wspolne/kancelaria');
  const kancelaria = dane && dane.kancelaria;

  const aktywna = (poz) =>
    poz.sciezka === '/' ? sciezka === '/' : sciezka.startsWith(poz.sciezka);

  return (
    <nav className="szyna bez-druku">
      <div className="szyna-marka">
        <span className="szyna-znak"><Ikona nazwa="znak" rozmiar={19} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="szyna-marka-nazwa">Rejestr</div>
          <div className="szyna-marka-podpis">akcjonariuszy P.S.A.</div>
        </div>
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
                <Ikona nazwa={poz.ikona} rozmiar={17} />
                <span className="szyna-poz-etykieta">{poz.nazwa}</span>
                {poz.faza && <Pigulka>faza {poz.faza}</Pigulka>}
              </button>
            ))}
        </div>
      ))}

      <div className="szyna-pomoc">
        <div className="szyna-pomoc-tytul">Podstawa prawna</div>
        <div className="szyna-pomoc-tresc">
          Rejestr prowadzony na podstawie art. 300³¹ § 1 KSH przez
          {kancelaria ? ` ${kancelaria.nazwa}` : ' kancelarię notarialną'}.
        </div>
      </div>
    </nav>
  );
}

/** Pigułka konta w topbarze — inicjały, imię, menu z wylogowaniem. */
function Konto({ uzytkownik, przyWylogowaniu }) {
  const [otwarte, ustawOtwarte] = useState(false);
  const [wylogowywanie, ustawWylogowywanie] = useState(false);
  const inicjaly = (uzytkownik.imie || '?')
    .trim().split(/\s+/).slice(0, 2).map((c) => c.charAt(0).toUpperCase()).join('');

  useEffect(() => {
    if (!otwarte) return undefined;
    const zamknij = () => ustawOtwarte(false);
    window.addEventListener('click', zamknij);
    return () => window.removeEventListener('click', zamknij);
  }, [otwarte]);

  async function wyloguj() {
    ustawWylogowywanie(true);
    try {
      await API.post('/api/psa/auth/logout');
    } finally {
      przyWylogowaniu();
    }
  }

  return (
    <div style={{ position: 'relative' }} onClick={(z) => z.stopPropagation()}>
      <button className="uzytkownik" onClick={() => ustawOtwarte((o) => !o)} aria-expanded={otwarte}>
        <span className="awatar">{inicjaly}</span>
        <Ikona nazwa="strzalkaDol" rozmiar={14} />
      </button>
      {otwarte && (
        <div className="uzytkownik-menu">
          <div className="uzytkownik-menu-naglowek">
            <div style={{ fontSize: 'var(--st-13)', fontWeight: 600 }}>{uzytkownik.imie}</div>
            <div className="podstawa-prawna">
              {uzytkownik.rola === 'admin' ? 'administrator' : 'pracownik kancelarii'}
            </div>
          </div>
          <button onClick={wyloguj} disabled={wylogowywanie}>
            <Ikona nazwa="wyloguj" rozmiar={16} />
            {wylogowywanie ? 'Wylogowywanie…' : 'Wyloguj'}
          </button>
        </div>
      )}
    </div>
  );
}

function Topbar({ tytul, podtytul, uzytkownik, przyWylogowaniu, przyPalecie, liczbaSpraw }) {
  return (
    <header className="topbar bez-druku">
      <div style={{ minWidth: 0 }}>
        <div className="topbar-tytul">{tytul}</div>
        {podtytul && <div className="topbar-podtytul">{podtytul}</div>}
      </div>
      <div className="topbar-narzedzia">
        <button className="ikonka-btn" onClick={przyPalecie} title="Szukaj (Ctrl+K)" aria-label="Szukaj">
          <Ikona nazwa="szukaj" rozmiar={19} />
        </button>
        <button
          className="ikonka-btn"
          onClick={() => idz('/sprawy')}
          title="Sprawy w toku"
          aria-label={`Sprawy w toku: ${liczbaSpraw || 0}`}
        >
          <Ikona nazwa="dzwonek" rozmiar={19} />
          {liczbaSpraw > 0 && <span className="ikonka-btn-znacznik">{liczbaSpraw}</span>}
        </button>
        <Konto uzytkownik={uzytkownik} przyWylogowaniu={przyWylogowaniu} />
      </div>
    </header>
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

/** Tytuł i podtytuł topbara dla bieżącej trasy. */
function opisTrasy(segmenty) {
  if (segmenty.length === 0) {
    return {
      tytul: 'Pulpit',
      podtytul: 'Rejestry akcjonariuszy prostych spółek akcyjnych prowadzone przez kancelarię.',
    };
  }
  const wg = {
    sprawy: { tytul: 'Kolejka spraw', podtytul: 'Cel wewnętrzny 3 dni, termin ustawowy 7 dni (art. 300³⁴ § 1 KSH) — sprawy posortowane po pozostałym czasie.' },
    spolki: { tytul: 'Spółki', podtytul: 'Rejestry prowadzone przez kancelarię.' },
    osoby: { tytul: 'Kartoteka osób', podtytul: 'Wspólna dla wszystkich prowadzonych rejestrów — jeden inwestor wpisywany raz.' },
    zgloszenia: { tytul: 'Zgłoszenia', podtytul: 'Pierwszy kontakt z publicznego formularza portalu — do oceny przed wysłaniem zaproszenia.' },
    wnioski: { tytul: 'Wnioski', podtytul: 'Wnioski o prowadzenie rejestru złożone przez portal klienta — porównanie z KRS i akceptacja.' },
    oplaty: { tytul: 'Opłaty', podtytul: 'Naliczenia za czynności rejestrowe i prowadzenie rejestru.' },
    podglad: { tytul: 'Podgląd systemu', podtytul: 'Katalog komponentów modułu — paleta, typografia, pola, tabele i stany.' },
    konfiguracja: { tytul: 'Konfiguracja', podtytul: 'Stawki, terminy, szablony dokumentów i użytkownicy modułu.' },
  };
  return wg[segmenty[0]] || { tytul: 'Rejestr akcjonariuszy', podtytul: null };
}

function Aplikacja() {
  const trasa = useTrasa();
  const sesja = useSesja();
  const paleta = usePaletaPolecen();
  const { segmenty, zapytanie, sciezka } = trasa;

  // Licznik na dzwonku: sprawy w toku. Odświeżany przy każdej zmianie trasy,
  // żeby po dokonaniu wpisu nie pokazywał nieaktualnej liczby.
  const { dane: sprawyDane } = useDane(sesja.zalogowany ? '/api/psa/sprawy' : null, [sciezka]);
  const liczbaSpraw = sprawyDane && sprawyDane.sprawy ? sprawyDane.sprawy.length : 0;

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
      if (segmenty.length === 1) {
        const spolkaId = zapytanie.get('spolka_id') ? Number(zapytanie.get('spolka_id')) : null;
        return <EkranKolejkiSpraw spolkaId={spolkaId} />;
      }
      const id = Number(segmenty[1]);
      if (!Number.isInteger(id)) return <NieZnaleziono />;
      return <EkranSprawy sprawaId={id} />;
    }

    if (segmenty[0] === 'osoby') return <EkranOsob />;
    if (segmenty[0] === 'zgloszenia') return <EkranZgloszenWstepnych />;
    if (segmenty[0] === 'wnioski') {
      if (segmenty.length === 1) return <EkranWnioski />;
      const id = Number(segmenty[1]);
      if (!Number.isInteger(id)) return <NieZnaleziono />;
      return <EkranWniosekSzczegoly wniosekId={id} />;
    }
    if (segmenty[0] === 'oplaty') return <EkranOplat />;
    if (segmenty[0] === 'konfiguracja' && segmenty[1] === 'stawki') return <EkranStawek />;
    if (segmenty[0] === 'konfiguracja' && segmenty[1] === 'szablony') {
      return sesja.uzytkownik.rola === 'admin' ? <EkranSzablonow /> : <NieZnaleziono />;
    }
    if (segmenty[0] === 'konfiguracja' && segmenty[1] === 'uzytkownicy') {
      return sesja.uzytkownik.rola === 'admin' ? <EkranUzytkownikow /> : <NieZnaleziono />;
    }

    return <NieZnaleziono />;
  }

  if (sesja.ladowanie) return <Spinner />;
  if (!sesja.zalogowany) {
    return <EkranLogowania przyZalogowaniu={() => sesja.odswiez()} />;
  }

  // Ekrany szczegółu i kreatory niosą własny nagłówek (okruszki, nazwa spółki,
  // metryka), więc topbar zostaje przy samej nazwie modułu.
  const wlasnyNaglowek =
    (segmenty[0] === 'spolki' && segmenty.length >= 2) ||
    (segmenty[0] === 'sprawy' && segmenty.length >= 2) ||
    (segmenty[0] === 'wnioski' && segmenty.length >= 2);
  const opis = wlasnyNaglowek
    ? { tytul: 'Rejestr akcjonariuszy', podtytul: null }
    : opisTrasy(segmenty);

  return (
    <div className="powloka">
      <Szyna sciezka={sciezka} uzytkownik={sesja.uzytkownik} />
      <div className="obszar">
        <Topbar
          tytul={opis.tytul}
          podtytul={opis.podtytul}
          uzytkownik={sesja.uzytkownik}
          przyWylogowaniu={() => sesja.odswiez()}
          przyPalecie={paleta.otworz}
          liczbaSpraw={liczbaSpraw}
        />
        <main className="tresc">{ekran()}</main>
      </div>
      {paleta.otwarta && <PaletaPolecen przyZamknieciu={paleta.zamknij} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<Aplikacja />);
