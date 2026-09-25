/* app.js — powłoka aplikacji i router.
   Sesja SESJA-PSA-6-INTERFEJS.md, faza 1.

   Powłoka: pływający panel aplikacji (nie rozlewa się po krawędziach okna),
   szyna nawigacji z ikonami i miękką pigułką stanu aktywnego, topbar
   niosący tytuł ekranu i narzędzia (szukaj / powiadomienia / konto),
   treść wyśrodkowana w kolumnie 1240 px, paleta poleceń pod Ctrl/⌘+K.

   Tytuł ekranu mieszka w topbarze, nie w treści — dzięki temu każdy ekran
   zaczyna się od rzeczy, a nie od powtórzonego nagłówka. */

/* Pasek marki i stopka biora dane kancelarii z `/api/wspolne/kancelaria`,
   a nie z zaszytego tekstu - po scaleniu z rdzeniem kancelarii zrodlo sie
   zmieni, a widok zostanie ten sam. */
const KANCELARIA_ZAPASOWA = {
  nazwa: 'Kancelaria Notarialna Łukasz Kozon',
  www: 'https://notariusz.gdansk.pl',
  www_psa: 'https://notariusz.gdansk.pl',
};

const MENU = [
  {
    grupa: 'Praca',
    pozycje: [
      { sciezka: '/', nazwa: 'Pulpit', ikona: 'pulpit' },
      // `licznik` = klucz z GET /api/psa/liczniki. Dostaja go wylacznie
      // KOLEJKI (coś czeka na ruch kancelarii). „Spółki" i „Kartoteka osób"
      // to katalogi — nie ma tam czego odhaczać, więc nie ma i licznika.
      { sciezka: '/sprawy', nazwa: 'Kolejka spraw', ikona: 'sprawy', licznik: 'sprawy' },
      { sciezka: '/spolki', nazwa: 'Spółki', ikona: 'spolki' },
      { sciezka: '/osoby', nazwa: 'Kartoteka osób', ikona: 'osoby' },
      { sciezka: '/zgloszenia', nazwa: 'Zgłoszenia', ikona: 'sprawy', licznik: 'zgloszenia' },
      { sciezka: '/wnioski', nazwa: 'Wnioski', ikona: 'sprawy', licznik: 'wnioski' },
      // Zawiadomienia o wpisie (art. 300(34) § 7 KSH) wychodza RECZNIE,
      // po zamknieciu calej roboty przy spolce — stad wlasna kolejka,
      // a nie automat przy kazdym wpisie.
      { sciezka: '/zawiadomienia', nazwa: 'Zawiadomienia', ikona: 'szablony', licznik: 'zawiadomienia' },
    ],
  },
  {
    grupa: 'Rozliczenia',
    pozycje: [{ sciezka: '/oplaty', nazwa: 'Opłaty', ikona: 'oplaty' }],
  },
  {
    grupa: 'Konfiguracja',
    pozycje: [
      { sciezka: '/konfiguracja/kancelaria', nazwa: 'Dane kancelarii', ikona: 'znak' },
      { sciezka: '/konfiguracja/stawki', nazwa: 'Stawki i terminy', ikona: 'stawki' },
      { sciezka: '/konfiguracja/szablony', nazwa: 'Szablony dokumentów', ikona: 'szablony', admin: true },
      { sciezka: '/konfiguracja/uzytkownicy', nazwa: 'Użytkownicy', ikona: 'uzytkownicy', admin: true },
      // Katalog komponentów systemu wizualnego — narzędzie DEWELOPERSKIE,
      // nie ekran pracy notariusza. Pokazuje się wyłącznie, gdy serwer ma
      // ustawione PODGLAD_SYSTEMU=true (domyślnie: nie ma).
      { sciezka: '/podglad', nazwa: 'Podgląd systemu', ikona: 'podglad', admin: true, deweloperski: true },
    ],
  },
];

const OPIS_LICZNIKA = {
  zgloszenia: 'zgłoszeń do oceny',
  wnioski: 'wniosków do weryfikacji',
  sprawy: 'spraw w toku',
  zawiadomienia: 'wpisów bez zawiadomienia',
};

/**
 * Nawigacja na wąskim ekranie: szyna się chowa, więc zostaje jeden rząd
 * ikon pod belką tytułową. Tylko pozycje z grupy „Praca" — konfiguracja
 * i rozliczenia to robota przy biurku, nie z telefonu.
 */
function NawigacjaWaska({ sciezka, liczniki }) {
  const pozycje = (MENU.find((g) => g.grupa === 'Praca') || { pozycje: [] }).pozycje;
  const aktywna = (poz) => (poz.sciezka === '/' ? sciezka === '/' : sciezka.startsWith(poz.sciezka));

  return (
    <nav className="topbar-nawigacja bez-druku" aria-label="Nawigacja główna">
      {pozycje.map((poz) => (
        <button
          key={poz.sciezka}
          className={`topbar-nawigacja-poz ${aktywna(poz) ? 'aktywna' : ''}`}
          onClick={() => idz(poz.sciezka)}
        >
          <Ikona nazwa={poz.ikona} rozmiar={17} />
          <span>{poz.nazwa}</span>
          {poz.licznik && <Licznik wartosc={liczniki[poz.licznik]} opis={OPIS_LICZNIKA[poz.licznik]} />}
        </button>
      ))}
    </nav>
  );
}

function Szyna({ sciezka, uzytkownik, podgladSystemu, liczniki }) {
  const aktywna = (poz) =>
    poz.sciezka === '/' ? sciezka === '/' : sciezka.startsWith(poz.sciezka);

  const widoczna = (poz) =>
    (!poz.admin || uzytkownik.rola === 'admin') && (!poz.deweloperski || podgladSystemu);

  return (
    <nav className="szyna bez-druku" aria-label="Menu">
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
          {g.pozycje.filter(widoczna).map((poz) => (
            <button
              key={poz.sciezka}
              className={`szyna-poz ${aktywna(poz) ? 'aktywna' : ''}`}
              aria-current={aktywna(poz) ? 'page' : undefined}
              onClick={() => idz(poz.sciezka)}
            >
              <Ikona nazwa={poz.ikona} rozmiar={17} />
              <span className="szyna-poz-etykieta">{poz.nazwa}</span>
              {poz.licznik && <Licznik wartosc={liczniki[poz.licznik]} opis={OPIS_LICZNIKA[poz.licznik]} />}
            </button>
          ))}
        </div>
      ))}

    </nav>
  );
}

/* Pasek marki — pierwsza rzecz widoczna na każdym ekranie. Rejestr prowadzi
   KANCELARIA (art. 300(31) § 1 KSH), więc jej nazwa stoi nad nazwą modułu,
   a nie obok niej. Nie drukuje się: pisma mają własny nagłówek. */

/** Adres bez protokołu i bez końcowego ukośnika — tak, jak się go czyta na wizytówce. */
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

/* `naglowekEkranu` — ekran nie ma własnego `h1` (listy, konfiguracja), więc
   jest nim tytuł w topbarze. Ekrany szczegółu i kreatory mają własny h1
   (NaglowekStrony) — wtedy topbar zostaje zwykłym tekstem: jeden h1 na widok. */
function Topbar({ tytul, podtytul, uzytkownik, przyWylogowaniu, przyPalecie, liczbaSpraw, naglowekEkranu }) {
  const Tytul = naglowekEkranu ? 'h1' : 'div';
  return (
    <div className="topbar bez-druku" role="region" aria-label="Tytuł ekranu">
      <div style={{ minWidth: 0 }}>
        <Tytul className="topbar-tytul">{tytul}</Tytul>
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
    </div>
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
  if (segmenty[0] === 'spolki' && segmenty[1] === 'nowa') {
    return { tytul: 'Nowa spółka', podtytul: 'Otwarcie rejestru akcjonariuszy — dane z KRS, umowa, pierwsza emisja, weryfikacja.' };
  }
  const wg = {
    sprawy: { tytul: 'Kolejka spraw', podtytul: 'Cel wewnętrzny 3 dni, termin ustawowy 7 dni (art. 300³⁴ § 1 KSH) — sprawy posortowane po pozostałym czasie.' },
    spolki: { tytul: 'Spółki', podtytul: 'Rejestry prowadzone przez kancelarię.' },
    osoby: { tytul: 'Kartoteka osób', podtytul: 'Wspólna dla wszystkich prowadzonych rejestrów — jeden inwestor wpisywany raz.' },
    zgloszenia: { tytul: 'Zgłoszenia', podtytul: 'Pierwszy kontakt z publicznego formularza portalu — do oceny przed wysłaniem zaproszenia.' },
    wnioski: { tytul: 'Wnioski', podtytul: 'Wnioski o prowadzenie rejestru złożone przez portal klienta — porównanie z KRS i akceptacja.' },
    zawiadomienia: { tytul: 'Zawiadomienia', podtytul: 'Wpisy dokonane, o których nie zawiadomiono jeszcze żądającego i spółki (art. 300³⁴ § 7 KSH).' },
    oplaty: { tytul: 'Opłaty', podtytul: 'Naliczenia za czynności rejestrowe i prowadzenie rejestru.' },
    konfiguracja: { tytul: 'Konfiguracja', podtytul: 'Dane kancelarii, stawki, terminy, szablony dokumentów i użytkownicy modułu.' },
  };
  return wg[segmenty[0]] || { tytul: 'Rejestr akcjonariuszy', podtytul: null };
}

function Aplikacja() {
  const trasa = useTrasa();
  const sesja = useSesja();
  const paleta = usePaletaPolecen();
  const { segmenty, zapytanie, sciezka } = trasa;

  const { dane: daneKancelarii } = useDane('/api/wspolne/kancelaria');
  const kancelaria = daneKancelarii && daneKancelarii.kancelaria;
  // `/api/psa/meta` mowi, czy serwer wystawia katalog komponentow (`/podglad`).
  // Naprawa Z-001: trasa wymaga teraz sesji pracownika (`wymagajPracownika`),
  // wiec odpytujemy ja dopiero PO zalogowaniu - tak samo jak `/api/psa/liczniki`
  // ponizej. Przed zalogowaniem zwracalaby 401 i `meta` zostalby trwale `null`
  // (efekt hooka nie sledzi zmiany sesji, wiec bez tego warunku nigdy by sie
  // nie doladowal po zalogowaniu).
  const { dane: meta } = useDane(sesja.zalogowany ? '/api/psa/meta' : null);
  const podgladSystemu = Boolean(meta && meta.podglad_systemu);

  // Liczniki kolejek w szynie i na dzwonku. Odświeżane przy każdej zmianie
  // trasy, żeby po obsłużeniu zgłoszenia albo wpisu znacznik nie został
  // z nieaktualną liczbą.
  // Odświeżane także przy powrocie do karty i co 60 s (FAZA 1 pkt 9) —
  // wniosek złożony w portalu pojawia się bez klikania.
  const { dane: daneLicznikow } = useOdswiezaneDane(sesja.zalogowany ? '/api/psa/liczniki' : null, [sciezka]);
  const liczniki = (daneLicznikow && daneLicznikow.liczniki) || {};
  const liczbaSpraw = liczniki.sprawy || 0;

  function ekran() {
    if (segmenty.length === 0) return <EkranPulpitu />;
    if (segmenty[0] === 'podglad') {
      return podgladSystemu && sesja.uzytkownik.rola === 'admin' ? <EkranPodgladu /> : <NieZnaleziono />;
    }

    if (segmenty[0] === 'spolki') {
      if (segmenty.length === 1) return <EkranSpolek />;
      if (segmenty[1] === 'nowa') return <EkranNowejSpolki />;

      const id = Number(segmenty[1]);
      if (!Number.isInteger(id)) return <NieZnaleziono />;
      if (segmenty.length === 2) return <EkranKokpitu spolkaId={id} />;
      // Naprawa Z-005: dokonczenie otwarcia rejestru dla spolki juz
      // zalozonej (np. z przyjetego wniosku portalowego) - ten sam kreator
      // co nowa spolka, wystartowany od razu na kroku akcjonariatu.
      if (segmenty[2] === 'otworz') return <EkranOtwarciaRejestru spolkaId={id} />;
      if (segmenty[2] === 'zdarzenie') {
        // Przejście EMISJA → OBJĘCIE: typ i seria przychodzą z ekranu wyniku
        // wpisu emisji, żeby nie zakładać sprawy „od zera" (sprawy.js).
        return (
          <EkranNowejSprawy
            spolkaId={id}
            typPoczatkowy={zapytanie.get('typ') || undefined}
            emisjaPoczatkowa={zapytanie.get('emisja') || undefined}
            zPodstawySprawy={zapytanie.get('zpodstawy') || undefined}
          />
        );
      }
      if (segmenty[2] === 'migracja') return <EkranMigracji spolkaId={id} />;
      if (segmenty[2] === 'wydruk') {
        // Aplikacja wystawia JEDEN dokument ze stanu rejestru — informację
        // z art. 300(35) § 3 KSH (etap 12). Stary adres `/wydruk/raport`
        // prowadzi do niej samej: linki mogły trafić do czyichś zakładek,
        // a nie ma dokąd indziej ich skierować.
        const data = zapytanie.get('data') || undefined;
        return <EkranInformacji spolkaId={id} dataPoczatkowa={data} />;
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
      return <EkranSprawy sprawaId={id} emisjaPoczatkowa={zapytanie.get('emisja') || undefined} />;
    }

    if (segmenty[0] === 'osoby') {
      if (segmenty.length === 1) return <EkranOsob />;
      const id = Number(segmenty[1]);
      if (!Number.isInteger(id)) return <NieZnaleziono />;
      return <EkranProfiluOsoby osobaId={id} />;
    }
    if (segmenty[0] === 'zgloszenia') return <EkranZgloszenWstepnych />;
    if (segmenty[0] === 'zawiadomienia') return <EkranZawiadomien />;
    if (segmenty[0] === 'wnioski') {
      if (segmenty.length === 1) return <EkranWnioski />;
      const id = Number(segmenty[1]);
      if (!Number.isInteger(id)) return <NieZnaleziono />;
      return <EkranWniosekSzczegoly wniosekId={id} />;
    }
    if (segmenty[0] === 'oplaty') return <EkranOplat />;
    if (segmenty[0] === 'konfiguracja' && segmenty[1] === 'kancelaria') return <EkranDaneKancelarii />;
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

  // Regulamin i polityka prywatności — odnośniki do nich stoją w stopce,
  // którą widać także pod ekranem logowania, więc muszą działać bez sesji.
  const dokumentPrawny = ekranPrawny(segmenty);
  if (dokumentPrawny) return <StronaPrawna>{dokumentPrawny}</StronaPrawna>;

  if (!sesja.zalogowany) {
    return <EkranLogowania przyZalogowaniu={() => sesja.odswiez()} />;
  }

  // Ekrany szczegółu i kreatory niosą własny nagłówek (okruszki, nazwa spółki,
  // metryka), więc topbar zostaje przy samej nazwie modułu.
  const wlasnyNaglowek =
    (segmenty[0] === 'spolki' && segmenty.length >= 2 && segmenty[1] !== 'nowa') ||
    (segmenty[0] === 'sprawy' && segmenty.length >= 2) ||
    (segmenty[0] === 'wnioski' && segmenty.length >= 2);
  const opis = wlasnyNaglowek
    ? { tytul: 'Rejestr akcjonariuszy', podtytul: null }
    : opisTrasy(segmenty);

  return (
    <div className="powloka">
      <a className="przeskocz-do-tresci" href="#tresc" onClick={(z) => { z.preventDefault(); document.getElementById('tresc').focus(); }}>
        Przejdź do treści
      </a>
      <div className="marka-pasek bez-druku" role="banner">
        <div className="marka-pasek-nazwa">{(kancelaria || KANCELARIA_ZAPASOWA).nazwa}</div>
      </div>
      <Szyna
        sciezka={sciezka}
        uzytkownik={sesja.uzytkownik}
        podgladSystemu={podgladSystemu}
        liczniki={liczniki}
      />
      <div className="obszar">
        <Topbar
          tytul={opis.tytul}
          podtytul={opis.podtytul}
          uzytkownik={sesja.uzytkownik}
          przyWylogowaniu={() => sesja.odswiez()}
          przyPalecie={paleta.otworz}
          liczbaSpraw={liczbaSpraw}
          naglowekEkranu={!wlasnyNaglowek}
        />
        <NawigacjaWaska sciezka={sciezka} liczniki={liczniki} />
        <main className="tresc" id="tresc" tabIndex={-1}>{ekran()}</main>
        <StopkaKancelarii kancelaria={kancelaria || KANCELARIA_ZAPASOWA} />
      </div>
      {paleta.otwarta && <PaletaPolecen przyZamknieciu={paleta.zamknij} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<Aplikacja />);
