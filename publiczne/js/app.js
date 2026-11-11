/* app.js — powłoka aplikacji kancelarii i router (§ 5).
   Menu: Pulpit · Sprawy · Spółki · Osoby · Korespondencja · Opłaty (Wnioski — Faza 4).
   Ustawienia — w menu konta, tylko administrator. */

const KANCELARIA_ZAPASOWA = { nazwa: 'Kancelaria Notarialna', www: '', www_psa: '' };

const MENU = [
  { sciezka: '/', nazwa: 'Pulpit', ikona: 'pulpit' },
  { sciezka: '/sprawy', nazwa: 'Sprawy', ikona: 'sprawy' },
  { sciezka: '/spolki', nazwa: 'Spółki', ikona: 'spolki' },
  { sciezka: '/osoby', nazwa: 'Osoby', ikona: 'osoby' },
  { sciezka: '/korespondencja', nazwa: 'Korespondencja', ikona: 'koperta' },
  { sciezka: '/oplaty', nazwa: 'Opłaty', ikona: 'oplaty' },
];

const TYTULY = {
  '': 'Pulpit', sprawy: 'Sprawy', spolki: 'Spółki', osoby: 'Osoby', korespondencja: 'Korespondencja', oplaty: 'Opłaty', ustawienia: 'Ustawienia',
};

const aktywna = (poz, sciezka) => (poz.sciezka === '/' ? sciezka === '/' : sciezka.startsWith(poz.sciezka));

function Menu({ sciezka, klasa, klasaPozycji }) {
  return (
    <nav className={`${klasa} bez-druku`} aria-label="Menu">
      {klasa === 'szyna' && (
        <div className="szyna-marka">
          <span className="szyna-znak"><Ikona nazwa="znak" rozmiar={19} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="szyna-marka-nazwa">Rejestr</div>
            <div className="szyna-marka-podpis">akcjonariuszy P.S.A.</div>
          </div>
        </div>
      )}
      {MENU.map((poz) => (
        <button
          key={poz.sciezka}
          type="button"
          className={`${klasaPozycji} ${aktywna(poz, sciezka) ? 'aktywna' : ''}`}
          aria-current={aktywna(poz, sciezka) ? 'page' : undefined}
          onClick={() => idz(poz.sciezka)}
        >
          <Ikona nazwa={poz.ikona} rozmiar={17} />
          <span className={klasa === 'szyna' ? 'szyna-poz-etykieta' : undefined}>{poz.nazwa}</span>
        </button>
      ))}
    </nav>
  );
}

function Konto({ uzytkownik, przyWylogowaniu }) {
  const [otwarte, ustawOtwarte] = useState(false);
  const inicjaly = (uzytkownik.imie || '?').trim().split(/\s+/).slice(0, 2).map((c) => c.charAt(0).toUpperCase()).join('');
  useEffect(() => {
    if (!otwarte) return undefined;
    const zamknij = () => ustawOtwarte(false);
    window.addEventListener('click', zamknij);
    return () => window.removeEventListener('click', zamknij);
  }, [otwarte]);
  async function wyloguj() {
    try { await API.post('/api/psa/auth/logout'); } finally { przyWylogowaniu(); }
  }
  return (
    <div style={{ position: 'relative' }} onClick={(z) => z.stopPropagation()}>
      <button type="button" className="uzytkownik" onClick={() => ustawOtwarte((o) => !o)} aria-expanded={otwarte}>
        <span className="sr-only">Konto </span>
        <span className="awatar">{inicjaly}</span>
        <Ikona nazwa="strzalkaDol" rozmiar={14} />
      </button>
      {otwarte && (
        <div className="uzytkownik-menu">
          <div className="uzytkownik-menu-naglowek">
            <div style={{ fontWeight: 600 }}>{uzytkownik.imie}</div>
            <div className="podstawa-prawna">{uzytkownik.rola === 'admin' ? 'administrator' : 'pracownik kancelarii'}</div>
          </div>
          {uzytkownik.rola === 'admin' && (
            <button type="button" onClick={() => { ustawOtwarte(false); idz('/ustawienia'); }}>
              <Ikona nazwa="stawki" rozmiar={16} /> Ustawienia
            </button>
          )}
          <button type="button" onClick={wyloguj}><Ikona nazwa="wyloguj" rozmiar={16} /> Wyloguj</button>
        </div>
      )}
    </div>
  );
}

function NieZnaleziono() {
  return (
    <Karta>
      <Pusto tytul="Nie ma takiej strony" opis="Adres nie odpowiada żadnemu ekranowi." akcja={<button type="button" className="btn btn-glowny" onClick={() => idz('/')}>Wróć na pulpit</button>} />
    </Karta>
  );
}

function Aplikacja() {
  const { segmenty, sciezka } = useTrasa();
  const sesja = useSesja();
  const { dane: daneKancelarii } = useDane('/api/wspolne/kancelaria');
  const kancelaria = (daneKancelarii && daneKancelarii.kancelaria) || KANCELARIA_ZAPASOWA;

  function ekran() {
    const [glowny, drugi] = segmenty;
    const id = Number(drugi);
    if (!glowny) return <EkranPulpitu />;
    if (drugi !== undefined && !Number.isInteger(id)) return <NieZnaleziono />;
    switch (glowny) {
      case 'sprawy': return drugi ? <EkranSprawy sprawaId={id} /> : <EkranSpraw />;
      case 'spolki': return drugi ? <EkranKokpitu spolkaId={id} /> : <EkranSpolek />;
      case 'osoby': return drugi ? <EkranOsoby osobaId={id} /> : <EkranOsob />;
      case 'korespondencja': return <EkranKorespondencji />;
      case 'oplaty': return <EkranOplat />;
      case 'ustawienia': return sesja.uzytkownik.rola === 'admin' ? <EkranUstawien uzytkownik={sesja.uzytkownik} /> : <NieZnaleziono />;
      default: return <NieZnaleziono />;
    }
  }

  if (sesja.ladowanie) return <Spinner />;
  const dokumentPrawny = ekranPrawny(segmenty);
  if (dokumentPrawny) return <StronaPrawna>{dokumentPrawny}</StronaPrawna>;
  if (!sesja.zalogowany) return <EkranLogowania przyZalogowaniu={() => sesja.odswiez()} />;

  // Ekrany szczegółu mają własny nagłówek (h1) — topbar zostaje wtedy zwykłym tekstem.
  const szczegol = segmenty.length >= 2;
  const Tytul = szczegol ? 'div' : 'h1';
  return (
    <div className="powloka">
      <a className="przeskocz-do-tresci" href="#tresc" onClick={(z) => { z.preventDefault(); document.getElementById('tresc').focus(); }}>Przejdź do treści</a>
      <div className="marka-pasek bez-druku" role="banner"><div className="marka-pasek-nazwa">{kancelaria.nazwa}</div></div>
      <Menu sciezka={sciezka} klasa="szyna" klasaPozycji="szyna-poz" />
      <div className="obszar">
        <div className="topbar bez-druku" role="region" aria-label="Tytuł ekranu">
          <Tytul className="topbar-tytul">{TYTULY[segmenty[0] || ''] || 'Rejestr akcjonariuszy'}</Tytul>
          <div className="topbar-narzedzia"><Konto uzytkownik={sesja.uzytkownik} przyWylogowaniu={() => sesja.odswiez()} /></div>
        </div>
        <Menu sciezka={sciezka} klasa="topbar-nawigacja" klasaPozycji="topbar-nawigacja-poz" />
        <main className="tresc" id="tresc" tabIndex={-1}>{ekran()}</main>
        <StopkaKancelarii kancelaria={kancelaria} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<Aplikacja />);
