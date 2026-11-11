/* portal.js — portal klienta, Faza 4: zgłoszenie spółki (publiczne), aktywacja konta (link z e-maila),
   logowanie i wniosek: Nowa spółka 1/2 Dane → 2/2 Dokumenty. Start, zgłaszanie zmian i informacja
   z rejestru — Faza 5. Bez odwołań do przepisów; statusy prostymi słowami (§ 6). */

function usePortal() {
  const [stan, ustawStan] = useState({ ladowanie: true, zalogowany: false });
  const odswiez = useCallback(() => API.get('/api/psa/portal/ja')
    .then((d) => ustawStan({ ladowanie: false, ...d }))
    .catch(() => ustawStan({ ladowanie: false, zalogowany: false })), []);
  useEffect(() => { odswiez(); }, [odswiez]);
  return { ...stan, odswiez };
}

function EkranLogowaniaPortalu({ przyZalogowaniu }) {
  const [email, ustawEmail] = useState('');
  const [haslo, ustawHaslo] = useState('');
  const c = useCzynnosc();
  const zaloguj = (z) => { z.preventDefault(); c.wykonaj(async () => { await API.post('/api/psa/portal/login', { email, haslo }); przyZalogowaniu(); }); };
  return (
    <Karta tytul="Logowanie do portalu">
      <form onSubmit={zaloguj} noValidate>
        <Pole etykieta="E-mail"><input type="email" autoComplete="username" value={email} onChange={(e) => ustawEmail(e.target.value)} /></Pole>
        <Pole etykieta="Hasło"><input type="password" autoComplete="current-password" value={haslo} onChange={(e) => ustawHaslo(e.target.value)} /></Pole>
        <Bledy blad={c.blad} />
        <div className="rzad">
          <button type="submit" className="btn btn-glowny" disabled={c.trwa}>Zaloguj</button>
          <a href="#/zglos">Zgłoś spółkę do rejestru</a>
        </div>
      </form>
      <KontaTestowe aplikacja="portal" przyZalogowaniu={przyZalogowaniu} />
    </Karta>
  );
}

function EkranZgloszenia() {
  const [f, ustawF] = useState({ krs: '', email: '', przejecie: false });
  const [wyslano, ustawWyslano] = useState(null);
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const wyslij = (z) => { z.preventDefault(); c.wykonaj(async () => ustawWyslano((await API.post('/api/psa/portal/zgloszenie', f)).komunikat)); };
  if (wyslano) {
    return (
      <Karta tytul="Sprawdź skrzynkę e-mail">
        <p>{wyslano}</p>
        <p className="male drugorzedny">Link jest ważny 7 dni. Nie dotarł? Sprawdź folder spam.</p>
      </Karta>
    );
  }
  return (
    <Karta tytul="Zgłoś spółkę do rejestru akcjonariuszy">
      <form onSubmit={wyslij} noValidate>
        <Pole etykieta="Numer KRS spółki" blad={pola.krs}><input type="text" inputMode="numeric" maxLength={10} value={f.krs} onChange={(e) => ustawF({ ...f, krs: e.target.value })} /></Pole>
        <Pole etykieta="Twój e-mail" blad={pola.email} podpowiedz="Wyślemy na niego link do dokończenia zgłoszenia."><input type="email" value={f.email} onChange={(e) => ustawF({ ...f, email: e.target.value })} /></Pole>
        <Przelacznik wlaczony={f.przejecie} przyZmianie={(w) => ustawF({ ...f, przejecie: w })} etykieta="Przenoszę rejestr od innej firmy" opis="Rejestr spółki prowadzi dziś ktoś inny, np. dom maklerski albo inny notariusz." />
        {c.blad && !Object.keys(pola).length && <Bledy blad={c.blad} />}
        <div className="rzad">
          <button type="submit" className="btn btn-glowny" disabled={c.trwa}>Wyślij</button>
          <a href="#/">Mam już konto</a>
        </div>
      </form>
    </Karta>
  );
}

function EkranAktywacji({ token, przyAktywacji }) {
  const [haslo, ustawHaslo] = useState('');
  const [regulamin, ustawRegulamin] = useState(false);
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const zapisz = (z) => { z.preventDefault(); c.wykonaj(async () => { await API.post('/api/psa/portal/aktywacja', { token, haslo, regulamin }); przyAktywacji(); }); };
  return (
    <Karta tytul="Ustaw hasło do portalu">
      <form onSubmit={zapisz} noValidate>
        <Pole etykieta="Hasło" blad={pola.haslo} podpowiedz="Co najmniej 12 znaków."><PoleHaslo wartosc={haslo} przyZmianie={ustawHaslo} /></Pole>
        <label className="chk">
          <input type="checkbox" checked={regulamin} onChange={(e) => ustawRegulamin(e.target.checked)} />
          Akceptuję <a href="#/regulamin" target="_blank" rel="noopener">regulamin portalu</a>
        </label>
        {pola.regulamin && <p className="pole-blad">{pola.regulamin}</p>}
        {pola.token && <Komunikat odmiana="blad" tresc={pola.token} />}
        {c.blad && !Object.keys(pola).length && <Bledy blad={c.blad} />}
        <button type="submit" className="btn btn-glowny" disabled={c.trwa}>Zapisz</button>
      </form>
    </Karta>
  );
}

/** Nowa spółka 1/2: dane (autozapis), „Dalej” składa wniosek i tworzy dokumenty do podpisu. */
function KrokDanych({ p, ustawP }) {
  const w = p.wniosek;
  const [wartosci, ustawWartosci] = useState(() => ({ dane: w.dane, dotychczasowy_podmiot: w.dotychczasowy_podmiot || '', data_przejecia: w.data_przejecia || '' }));
  const zapis = useZapisWniosku('/api/psa/portal/wniosek', wartosci, ustawP);
  const c = useCzynnosc();
  const pola = { ...bledyApi({ bledy: p.bledy }).pola, ...bledyApi(c.blad).pola };
  const dalej = () => c.wykonaj(async () => {
    if (!(await zapis.teraz())) return;
    ustawP(await API.post('/api/psa/portal/wniosek/zloz', {}));
    window.scrollTo(0, 0);
  });
  return (
    <>
      <NaglowekStrony tytul="Nowa spółka — krok 1 z 2: dane" kontekst={`KRS ${w.krs}`} akcje={<StanZapisu stan={zapis} />} />
      {w.notatka && <Komunikat odmiana="uwaga" tytul="Prosimy o uzupełnienie" tresc={w.notatka} />}
      <FormularzWniosku
        dane={wartosci.dane}
        ustawDane={(d) => ustawWartosci({ ...wartosci, dane: d })}
        pola={pola}
        kwoty={p.kwoty}
        przejecie={{ dotyczy: w.przejecie, dotychczasowy_podmiot: wartosci.dotychczasowy_podmiot, data_przejecia: wartosci.data_przejecia, ustaw: (z) => ustawWartosci({ ...wartosci, ...z }) }}
      />
      {c.blad && !Object.keys(bledyApi(c.blad).pola).length && <Bledy blad={c.blad} />}
      {c.blad && Object.keys(bledyApi(c.blad).pola).length > 0 && <Komunikat odmiana="blad" tresc="Uzupełnij pola zaznaczone na czerwono." />}
      <div className="rzad">
        <button type="button" className="btn btn-glowny" onClick={dalej} disabled={c.trwa}>Dalej</button>
      </div>
    </>
  );
}

function WierszDokumentu({ d, ustawP }) {
  const [uchwala, ustawUchwale] = useState(false);
  const c = useCzynnosc();
  const zmienUchwale = (tryb) => c.wykonaj(async () => { ustawP(await API.put('/api/psa/portal/wniosek', { uchwala: tryb })); ustawUchwale(false); });
  const przyDodaniu = () => API.get('/api/psa/portal/wniosek').then(ustawP);
  return (
    <li className="dokument-wniosku">
      <div className="rzad-rozdzielony">
        <strong>{d.nazwa}</strong>
        <Pigulka odmiana={ODMIANY_DOKUMENTU[d.stan]}>{STANY_DOKUMENTU[d.stan]}</Pigulka>
      </div>
      {d.plik && d.plik.powod && d.stan === 'odrzucony' && <p className="pole-blad">{d.plik.powod}</p>}
      <div className="rzad">
        {d.pismo_id && <a className="btn btn-maly" href={`/api/psa/portal/wniosek/dokumenty/${d.pismo_id}`} download>Pobierz</a>}
        {d.stan !== 'potwierdzony' && (
          <DodajPlik adres="/api/psa/portal/wniosek/pliki" pola={{ dokument: d.klucz }} etykieta={d.podpis ? 'Wgraj podpisany' : 'Wgraj'} przyDodaniu={przyDodaniu} />
        )}
      </div>
      {['uchwala', 'uchwala_wlasna'].includes(d.klucz) && (uchwala ? (
        <div className="rzad">
          {d.klucz === 'uchwala' && <button type="button" className="btn btn-maly" onClick={() => zmienUchwale('wlasna')}>Mam własną uchwałę</button>}
          {d.klucz === 'uchwala_wlasna' && <button type="button" className="btn btn-maly" onClick={() => zmienUchwale('podpisana')}>Podpiszemy uchwałę z portalu</button>}
          <button type="button" className="btn btn-maly" onClick={() => zmienUchwale('w_umowie')}>Wybór jest w umowie spółki</button>
          <button type="button" className="btn btn-maly btn-cichy" onClick={() => ustawUchwale(false)}>Anuluj</button>
        </div>
      ) : <button type="button" className="btn btn-maly btn-cichy" onClick={() => ustawUchwale(true)}>Inna uchwała?</button>)}
      <Bledy blad={c.blad} />
    </li>
  );
}

/** Nowa spółka 2/2: dokumenty — pobierz, podpisz, wgraj; stan każdego dokumentu. */
function KrokDokumentow({ p, ustawP }) {
  const [poczta, ustawPoczte] = useState(false);
  const wUmowie = p.wniosek.dane.uchwala === 'w_umowie';
  const c = useCzynnosc();
  return (
    <>
      <NaglowekStrony tytul="Nowa spółka — krok 2 z 2: dokumenty" kontekst={`${p.wniosek.dane.spolka.nazwa} · KRS ${p.wniosek.krs}`} />
      <details className="instrukcja-podpisu">
        <summary>Jak podpisać dokument?</summary>
        <ul>
          <li>mObywatel — podpis kwalifikowany: pobierz PDF, podpisz w aplikacji i wgraj podpisany plik.</li>
          <li>Profil zaufany na gov.pl — podpisz pobrany PDF i wgraj plik .xml, który dostaniesz.</li>
          <li>Podpis kwalifikowany z karty albo w chmurze — wgraj podpisany PDF.</li>
        </ul>
        <p>Nie otwieraj i nie zapisuj ponownie pobranego pliku w innych programach — wtedy podpis nie przejdzie.</p>
      </details>
      <Karta>
        <ul className="dokumenty-wniosku">
          {p.dokumenty.map((d) => <WierszDokumentu key={d.klucz} d={d} ustawP={ustawP} />)}
        </ul>
        {wUmowie && (
          <p className="male drugorzedny">
            Uchwała: wybór kancelarii wynika z umowy spółki.{' '}
            <button type="button" className="jak-odnosnik" onClick={() => c.wykonaj(async () => ustawP(await API.put('/api/psa/portal/wniosek', { uchwala: 'podpisana' })))}>Zmień</button>
          </p>
        )}
        <button type="button" className="btn btn-maly btn-cichy" onClick={() => ustawPoczte((x) => !x)}>Wyślę dokumenty pocztą</button>
        {poczta && <p>Podpisane dokumenty wyślij na adres: <strong>{p.adres_kancelarii}</strong></p>}
      </Karta>
    </>
  );
}

function EkranWniosku() {
  const { dane, blad } = useDane('/api/psa/portal/wniosek');
  const [p, ustawP] = useState(null);
  useEffect(() => { if (dane) ustawP(dane); }, [dane]);
  if (blad) return <Bledy blad={blad} />;
  if (!p) return <Spinner />;
  const s = p.wniosek.stan;
  if (s === 'roboczy') return <KrokDanych p={p} ustawP={ustawP} />;
  if (s === 'zlozony') return <KrokDokumentow p={p} ustawP={ustawP} />;
  if (s === 'przyjety') return <Karta tytul="Wniosek przyjęty"><p>Dziękujemy. Kancelaria otworzy rejestr akcjonariuszy spółki — dostęp do rejestru pojawi się w portalu.</p></Karta>;
  return <Karta tytul="Wniosek zakończony"><p>Kancelaria nie zawarła umowy — wyjaśnienie wyślemy listem.</p></Karta>;
}

function Portal() {
  const { segmenty, zapytanie } = useTrasa();
  const sesja = usePortal();
  const { dane: k } = useDane('/api/wspolne/kancelaria');
  const kancelaria = (k && k.kancelaria) || {};

  function ekran() {
    const prawny = ekranPrawny(segmenty);
    if (prawny) return prawny;
    if (segmenty[0] === 'zglos') return <EkranZgloszenia />;
    if (segmenty[0] === 'aktywacja') return <EkranAktywacji token={zapytanie.get('token')} przyAktywacji={() => { sesja.odswiez(); idz('/'); }} />;
    if (!sesja.zalogowany) return <EkranLogowaniaPortalu przyZalogowaniu={() => sesja.odswiez()} />;
    if (!sesja.wniosek) return <Karta tytul="Portal"><p>Dostęp do rejestru spółki pojawi się po otwarciu rejestru.</p></Karta>;
    return <EkranWniosku />;
  }

  if (sesja.ladowanie) return <Spinner />;
  return (
    <div className="powloka-portal">
      <div className="marka-pasek bez-druku" role="banner">
        <div className="marka-pasek-nazwa">{kancelaria.nazwa || 'Kancelaria Notarialna'} — rejestr akcjonariuszy</div>
        {sesja.zalogowany && (
          <button type="button" className="btn btn-maly btn-cichy" onClick={() => API.post('/api/psa/portal/logout').then(() => { sesja.odswiez(); idz('/'); })}>Wyloguj</button>
        )}
      </div>
      <main className="tresc tresc-waska" id="tresc" tabIndex={-1}>{ekran()}</main>
      <StopkaKancelarii kancelaria={kancelaria} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<Portal />);
