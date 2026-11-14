/* app.js — powłoka aplikacji kancelarii i router (D-235).
   Menu: Pulpit · Rejestry · Osoby · Korespondencja · Opłaty. Otwarte wpisy są na Pulpicie i w rejestrze spółki,
   wnioski — na liście „Rejestry”. Ustawienia — w menu konta, tylko administrator. Bez pasa marki i bez stopki. */

const KANCELARIA_ZAPASOWA = { nazwa: 'Kancelaria Notarialna', www: '', www_psa: '' };

const MENU = [
  { sciezka: '/', nazwa: 'Pulpit', ikona: 'pulpit' },
  { sciezka: '/spolki', nazwa: 'Rejestry', ikona: 'spolki', takze: ['/sprawy', '/wnioski'] },
  { sciezka: '/osoby', nazwa: 'Osoby', ikona: 'osoby' },
  { sciezka: '/korespondencja', nazwa: 'Korespondencja', ikona: 'koperta' },
  { sciezka: '/oplaty', nazwa: 'Opłaty', ikona: 'oplaty' },
];

const TYTULY = {
  '': 'Pulpit', sprawy: 'Wpisy', spolki: 'Rejestry', osoby: 'Osoby', wnioski: 'Wnioski', korespondencja: 'Korespondencja', oplaty: 'Opłaty', ustawienia: 'Ustawienia', haslo: 'Zmień hasło',
};

/** Ekran szczegółu ma własny nagłówek — pasek u góry niesie wtedy tylko powrót do listy. */
const POWROT = { spolki: ['Rejestry', '/spolki'], sprawy: ['Rejestry', '/spolki'], wnioski: ['Rejestry', '/spolki'], osoby: ['Osoby', '/osoby'] };

const aktywna = (poz, sciezka) => (poz.sciezka === '/' ? sciezka === '/' : [poz.sciezka, ...(poz.takze || [])].some((x) => sciezka.startsWith(x)));

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
          <button type="button" onClick={() => { ustawOtwarte(false); idz('/haslo'); }}><Ikona nazwa="uzytkownicy" rozmiar={16} /> Zmień hasło</button>
          <button type="button" onClick={wyloguj}><Ikona nazwa="wyloguj" rozmiar={16} /> Wyloguj</button>
        </div>
      )}
    </div>
  );
}

/** Zmiana własnego hasła pracownika (obecne + nowe); serwer kończy wszystkie sesje konta — także tę. */
function EkranHasla() {
  const [haslo, ustawHaslo] = useState({ obecne: '', nowe: '' });
  const [zapisano, ustawZapisano] = useState(false);
  const c = useCzynnosc();
  const zapisz = (z) => {
    z.preventDefault();
    c.wykonaj(async () => {
      await API.post('/api/psa/auth/zmiana-hasla', { haslo_obecne: haslo.obecne, haslo_nowe: haslo.nowe });
      ustawHaslo({ obecne: '', nowe: '' });
      ustawZapisano(true);
    });
  };
  return (
    <Karta tytul="Zmień hasło">
      <form onSubmit={zapisz} noValidate>
        <Pole etykieta="Obecne hasło"><PoleHaslo wartosc={haslo.obecne} przyZmianie={(v) => ustawHaslo({ ...haslo, obecne: v })} autoComplete="current-password" /></Pole>
        <Pole etykieta="Nowe hasło" podpowiedz="Co najmniej 12 znaków."><PoleHaslo wartosc={haslo.nowe} przyZmianie={(v) => ustawHaslo({ ...haslo, nowe: v })} autoComplete="new-password" /></Pole>
        <Bledy blad={c.blad} />
        {zapisano ? (
          <>
            <Komunikat odmiana="rejestr" tresc="Hasło zmienione. Zaloguj się nowym hasłem." />
            <button type="button" className="btn btn-glowny" onClick={() => window.location.reload()}>Zaloguj się</button>
          </>
        ) : <button type="submit" className="btn btn-glowny" disabled={c.trwa || !haslo.obecne || !haslo.nowe}>Zapisz</button>}
      </form>
    </Karta>
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
      case 'spolki': return !drugi ? <EkranSpolek /> : segmenty[2] === 'wpis' ? <EkranNowegoWpisu spolkaId={id} /> : <EkranKokpitu spolkaId={id} />;
      case 'osoby': return drugi ? <EkranOsoby osobaId={id} /> : <EkranOsob />;
      case 'wnioski': return drugi ? <EkranWnioskuKancelarii wniosekId={id} /> : <EkranWnioskow />;
      case 'korespondencja': return <EkranKorespondencji />;
      case 'oplaty': return <EkranOplat />;
      case 'haslo': return <EkranHasla />;
      case 'ustawienia': return sesja.uzytkownik.rola === 'admin' ? <EkranUstawien uzytkownik={sesja.uzytkownik} /> : <NieZnaleziono />;
      default: return <NieZnaleziono />;
    }
  }

  if (sesja.ladowanie) return <Spinner />;
  const dokumentPrawny = ekranPrawny(segmenty);
  if (dokumentPrawny) return <StronaPrawna>{dokumentPrawny}</StronaPrawna>;
  if (!sesja.zalogowany) return <EkranLogowania przyZalogowaniu={() => sesja.odswiez()} />;

  // Hasło tymczasowe administratora: do zmiany przed pierwszą czynnością (audyt S7).
  if (sesja.uzytkownik.zmien_haslo) {
    return (
      <div className="powloka powloka-kancelaria powloka-bez-szyny">
        <div className="obszar">
          <main className="tresc tresc-waska" id="tresc" tabIndex={-1}>
            <Komunikat odmiana="uwaga" tresc="Logujesz się hasłem tymczasowym. Ustaw własne hasło, żeby przejść dalej." />
            <EkranHasla />
          </main>
        </div>
      </div>
    );
  }

  // Ekran szczegółu ma własny nagłówek (h1) — pasek u góry pokazuje wtedy tylko powrót do listy.
  const szczegol = segmenty.length >= 2;
  const powrot = szczegol ? POWROT[segmenty[0]] : null;
  return (
    <div className="powloka powloka-kancelaria">
      <a className="przeskocz-do-tresci" href="#tresc" onClick={(z) => { z.preventDefault(); document.getElementById('tresc').focus(); }}>Przejdź do treści</a>
      <Menu sciezka={sciezka} klasa="szyna" klasaPozycji="szyna-poz" />
      <div className="obszar">
        <div className="topbar bez-druku" role="region" aria-label="Tytuł ekranu">
          {szczegol
            ? (powrot ? <a className="topbar-powrot" href={`#${powrot[1]}`}><Ikona nazwa="strzalkaLewo" rozmiar={14} /> {powrot[0]}</a> : <span />)
            : <h1 className="topbar-tytul">{TYTULY[segmenty[0] || ''] || 'Rejestr akcjonariuszy'}</h1>}
          <div className="topbar-narzedzia"><Konto uzytkownik={sesja.uzytkownik} przyWylogowaniu={() => sesja.odswiez()} /></div>
        </div>
        <Menu sciezka={sciezka} klasa="topbar-nawigacja" klasaPozycji="topbar-nawigacja-poz" />
        <main className="tresc" id="tresc" tabIndex={-1}>{ekran()}</main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<Aplikacja />);
