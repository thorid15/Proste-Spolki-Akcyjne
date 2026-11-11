/* portal.js — portal klienta (§ 6): zgłoszenie spółki (publiczne), aktywacja konta (link z e-maila),
   logowanie, wniosek (Nowa spółka 1/2 Dane → 2/2 Dokumenty) do jego przyjęcia; potem Start, Zgłoś
   zmianę i Konto (U-23: zakres z danych). Bez odwołań do przepisów; statusy prostymi słowami. */

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

const STANY_PORTALU = { w_toku: 'W toku', wstrzymana: 'Wymaga uzupełnienia', wpisana: 'Wpisane', odmowa: 'Odmowa', wycofana: 'Wycofane' };
const RODZAJE_OPLAT = { prowadzenie: 'Prowadzenie rejestru', wpis: 'Wpis w rejestrze', informacja: 'Informacja z rejestru' };
const PLIKI_PORTALU = '.pdf,.jpg,.jpeg,.png,.xml,.p7s,.p7m';

/** „Zapłać [kwota]” — link tpay i przejście do płatności. */
async function zaplac(oplataId) {
  const { link } = await API.post(`/api/psa/portal/oplaty/${oplataId}/zaplac`, {});
  window.location.href = link;
}

/** Informacja z rejestru: dzień (domyślnie i najpóźniej wczoraj — U-24), płatna z góry. */
function ZamowienieInformacji({ s }) {
  const inf = s.informacja;
  const [dzien, ustawDzien] = useState(inf.najpozniej);
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const dostepna = inf.dostepna_od && inf.dostepna_od <= fmt.dzisIso();
  const zamow = () => c.wykonaj(async () => {
    const { oplata_id: id } = await API.post('/api/psa/portal/informacja', { spolka_id: s.spolka.id, dzien });
    await zaplac(id);
  });
  return (
    <Karta tytul="Informacja z rejestru">
      <p className="male drugorzedny">{s.rola.pelny ? 'Pełna informacja o akcjonariuszach spółki — płaci spółka.' : 'Informacja o akcjach spółki, bez danych osobowych pozostałych akcjonariuszy.'}</p>
      {dostepna && (
        <Pole etykieta="Stan na koniec dnia" blad={pola.dzien}>
          <PoleDaty wartosc={dzien} przyZmianie={ustawDzien} min={inf.najwczesniej} max={inf.najpozniej} />
        </Pole>
      )}
      <PrzyciskGlowny
        etykieta={`Zapłać ${fmt.zlote(inf.kwota_brutto_grosze)}`}
        przyKlik={zamow}
        powod={dostepna ? null : inf.dostepna_od ? `Dostępna od ${fmt.data(inf.dostepna_od)}` : 'Dostępna po otwarciu rejestru'}
        trwa={c.trwa}
      />
      {c.blad && !pola.dzien && <Bledy blad={c.blad} />}
    </Karta>
  );
}

function PismaDoPobrania({ pisma }) {
  if (!pisma.length) return null;
  return (
    <ul className="pisma-portalu">
      {pisma.map((p) => <li key={p.id}><a href={`/api/psa/portal/pisma/${p.id}`} download>{p.nazwa}</a> <span className="male drugorzedny">{p.numer}{p.data ? ` · ${fmt.data(p.data)}` : ''}</span></li>)}
    </ul>
  );
}

/** Start: firma i KRS, „Do zrobienia” (zapłać, uzupełnij), sprawy z pismami, wydane informacje. */
function EkranStartu({ spolki }) {
  const { zapytanie } = useTrasa();
  const wybrana = zapytanie.get('spolka');
  const platnosc = zapytanie.get('platnosc');
  const { dane: s, blad, odswiez } = useDane(`/api/psa/portal/start${wybrana ? `?spolka=${wybrana}` : ''}`);
  const [informacja, ustawInformacje] = useState(false);
  const [proby, ustawProby] = useState(0);
  const c = useCzynnosc();
  const czeka = Boolean(platnosc && s && s.oplaty && s.oplaty.some((o) => String(o.id) === platnosc));
  useEffect(() => {
    if (!czeka || proby >= 10) return undefined;
    const t = setTimeout(() => { ustawProby((x) => x + 1); odswiez(); }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [czeka, proby]);
  if (blad) return <Bledy blad={blad} />;
  if (!s) return <Spinner />;
  if (!s.spolka) {
    return (
      <Karta tytul="Brak dostępu do spółki">
        <p>To konto nie ma teraz dostępu do żadnej spółki. Jeśli to pomyłka, napisz do kancelarii.</p>
        <p className="male drugorzedny">Akcjonariusz widzi spółkę, gdy ma akcje i zgodę na korespondencję e-mail (Konto).</p>
      </Karta>
    );
  }
  const sp = s.spolka;
  const doUzupelnienia = s.sprawy.filter((x) => x.stan === 'wstrzymana');
  return (
    <>
      {spolki.length > 1 && (
        <Pole etykieta="Spółka">
          <select value={sp.id} onChange={(e) => idz(`/?spolka=${e.target.value}`)}>
            {spolki.map((x) => <option key={x.id} value={x.id}>{x.nazwa}</option>)}
          </select>
        </Pole>
      )}
      <NaglowekStrony
        tytul={sp.nazwa}
        kontekst={`KRS ${sp.krs}`}
        akcje={(
          <span className="rzad">
            <button type="button" className="btn" onClick={() => ustawInformacje((x) => !x)}>Zamów informację z rejestru</button>
            <PrzyciskGlowny etykieta="Zgłoś zmianę" przyKlik={() => idz(`/zmiana?spolka=${sp.id}`)} powod={sp.otwarty ? null : sp.zamkniety ? 'Rejestr zamknięty' : 'Rejestr nie jest jeszcze otwarty'} />
          </span>
        )}
      />
      {platnosc && (czeka
        ? <Komunikat odmiana="info" tresc="Dziękujemy. Czekamy na potwierdzenie płatności — strona odświeży się sama." />
        : <Komunikat odmiana="rejestr" tresc="Płatność przyjęta." />)}
      {informacja && <ZamowienieInformacji s={s} />}
      {(s.oplaty.length > 0 || doUzupelnienia.length > 0) && (
        <Karta tytul="Do zrobienia">
          {s.oplaty.map((o) => (
            <div key={o.id} className="rzad-rozdzielony wiersz-portalu">
              <span>{RODZAJE_OPLAT[o.rodzaj]}{o.okres ? ` · ${o.okres.split('..').map(fmt.data).join('–')}` : ''}</span>
              <button type="button" className="btn btn-glowny btn-maly" disabled={c.trwa} onClick={() => c.wykonaj(() => zaplac(o.id))}>Zapłać {fmt.zlote(o.kwota_brutto_grosze)}</button>
            </div>
          ))}
          {doUzupelnienia.map((x) => (
            <div key={x.id} className="rzad-rozdzielony wiersz-portalu">
              <span>Sprawa nr {x.id} — dołącz brakujące dokumenty</span>
              <DodajPlik adres={`/api/psa/portal/sprawy/${x.id}/pliki`} przyDodaniu={odswiez} etykieta="Dodaj pliki" />
            </div>
          ))}
          <Bledy blad={c.blad} />
        </Karta>
      )}
      <Karta tytul="Sprawy">
        {!s.sprawy.length ? <p className="male drugorzedny">Brak spraw.</p> : s.sprawy.map((x) => (
          <div key={x.id} className="wiersz-portalu">
            <div className="rzad-rozdzielony">
              <strong>Sprawa nr {x.id} · {fmt.data(x.data_wplywu)}</strong>
              <Pigulka odmiana={ODMIANY_STANU_SPRAWY[x.stan]}>{STANY_PORTALU[x.stan]}</Pigulka>
            </div>
            {x.opis && <p className="male">{x.opis}</p>}
            <PismaDoPobrania pisma={x.pisma} />
          </div>
        ))}
      </Karta>
      {s.informacje.length > 0 && (
        <Karta tytul="Informacje z rejestru">
          <PismaDoPobrania pisma={s.informacje.map((p) => ({ ...p, nazwa: `Stan na ${p.stan_na}` }))} />
        </Karta>
      )}
    </>
  );
}

/** „Zgłoś zmianę”: opis i pliki — bez wyboru rodzaju zmiany. */
function EkranZmiany() {
  const { zapytanie } = useTrasa();
  const spolka = Number(zapytanie.get('spolka'));
  const [opis, ustawOpis] = useState('');
  const [pliki, ustawPliki] = useState([]);
  const [klucz] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [wynik, ustawWynik] = useState(null);
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const wyslij = (z) => {
    z.preventDefault();
    c.wykonaj(async () => {
      const { id } = await API.post('/api/psa/portal/sprawy', { spolka_id: spolka, opis, klucz });
      for (const plik of pliki) await wgrajPlik(`/api/psa/portal/sprawy/${id}/pliki`, plik);
      ustawWynik(id);
    });
  };
  if (wynik) {
    return (
      <Karta tytul="Zgłoszenie wysłane">
        <p>Przyjęliśmy zgłoszenie — sprawa nr {wynik}. Jej stan i pisma zobaczysz na Starcie.</p>
        <a className="btn" href={`#/?spolka=${spolka}`}>Start</a>
      </Karta>
    );
  }
  return (
    <Karta tytul="Zgłoś zmianę">
      <form onSubmit={wyslij} noValidate>
        <Pole etykieta="Co się zmieniło?" blad={pola.opis} podpowiedz="Np. sprzedaż akcji, ustanowienie zastawu, zmiana adresu. Dołącz dokument, np. umowę sprzedaży akcji.">
          <textarea rows={5} maxLength={2000} value={opis} onChange={(e) => ustawOpis(e.target.value)} />
        </Pole>
        <Pole etykieta="Pliki" opcjonalne podpowiedz="PDF, zdjęcie albo plik podpisu, do 10 MB każdy.">
          <input type="file" multiple accept={PLIKI_PORTALU} onChange={(e) => ustawPliki([...e.target.files])} />
        </Pole>
        {c.blad && !pola.opis && <Bledy blad={c.blad} />}
        <div className="rzad">
          <button type="submit" className="btn btn-glowny" disabled={c.trwa}>Wyślij</button>
          <a href={`#/?spolka=${spolka}`}>Anuluj</a>
        </div>
      </form>
    </Karta>
  );
}

/** Konto: e-mail, hasło, zgoda na korespondencję e-mail (akcjonariusz), regulamin i polityka prywatności. */
function EkranKonta({ sesja }) {
  const [haslo, ustawHaslo] = useState({ obecne: '', nowe: '' });
  const [zgoda, ustawZgode] = useState(sesja.zgoda_email);
  const [zapisano, ustawZapisano] = useState(false);
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const zapisz = (z) => {
    z.preventDefault();
    c.wykonaj(async () => {
      await API.put('/api/psa/portal/konto', { haslo_obecne: haslo.obecne, haslo_nowe: haslo.nowe || undefined, zgoda_email: sesja.akcjonariusz ? zgoda : undefined });
      ustawHaslo({ obecne: '', nowe: '' });
      ustawZapisano(true);
      sesja.odswiez();
    });
  };
  return (
    <Karta tytul="Konto">
      <form onSubmit={zapisz} noValidate>
        <ListaDanych pary={[['E-mail', sesja.email]]} />
        <Pole etykieta="Obecne hasło" blad={pola.haslo_obecne} opcjonalne><PoleHaslo wartosc={haslo.obecne} przyZmianie={(v) => ustawHaslo({ ...haslo, obecne: v })} autoComplete="current-password" /></Pole>
        <Pole etykieta="Nowe hasło" blad={pola.haslo_nowe} opcjonalne podpowiedz="Co najmniej 12 znaków. Zmiana wyloguje inne urządzenia."><PoleHaslo wartosc={haslo.nowe} przyZmianie={(v) => ustawHaslo({ ...haslo, nowe: v })} autoComplete="new-password" /></Pole>
        {sesja.akcjonariusz && (
          <Przelacznik
            wlaczony={zgoda}
            przyZmianie={ustawZgode}
            etykieta="Zgoda na korespondencję e-mail"
            opis="Pisma z rejestru dostaniesz e-mailem i zobaczysz w portalu. Bez zgody wysyłamy je listem, a portal nie pokazuje spółek, w których jesteś tylko akcjonariuszem."
          />
        )}
        {zapisano && !c.blad && <Komunikat odmiana="rejestr" tresc="Zapisano." />}
        {c.blad && !pola.haslo_obecne && !pola.haslo_nowe && <Bledy blad={c.blad} />}
        <div className="rzad">
          <button type="submit" className="btn btn-glowny" disabled={c.trwa}>Zapisz</button>
          <a href="#/regulamin">Regulamin</a>
          <a href="#/polityka-prywatnosci">Polityka prywatności</a>
        </div>
      </form>
    </Karta>
  );
}

function Portal() {
  const { segmenty, zapytanie } = useTrasa();
  const sesja = usePortal();
  const { dane: k } = useDane('/api/wspolne/kancelaria');
  const kancelaria = (k && k.kancelaria) || {};
  const poWniosku = sesja.zalogowany && !sesja.wniosek;

  function ekran() {
    const prawny = ekranPrawny(segmenty);
    if (prawny) return prawny;
    if (segmenty[0] === 'zglos') return <EkranZgloszenia />;
    if (segmenty[0] === 'aktywacja') return <EkranAktywacji token={zapytanie.get('token')} przyAktywacji={() => { sesja.odswiez(); idz('/'); }} />;
    if (!sesja.zalogowany) return <EkranLogowaniaPortalu przyZalogowaniu={() => sesja.odswiez()} />;
    if (sesja.wniosek) return <EkranWniosku />;
    if (segmenty[0] === 'konto') return <EkranKonta sesja={sesja} />;
    if (segmenty[0] === 'zmiana') return <EkranZmiany />;
    return <EkranStartu spolki={sesja.spolki} />;
  }

  if (sesja.ladowanie) return <Spinner />;
  return (
    <div className="powloka-portal">
      <div className="marka-pasek bez-druku" role="banner">
        <div className="marka-pasek-nazwa">{kancelaria.nazwa || 'Kancelaria Notarialna'} — rejestr akcjonariuszy</div>
      </div>
      {sesja.zalogowany && (
        <nav className="menu-portalu bez-druku" aria-label="Menu portalu">
          {poWniosku && <a href="#/" aria-current={segmenty[0] !== 'konto' ? 'page' : undefined}>Start</a>}
          {poWniosku && <a href="#/konto" aria-current={segmenty[0] === 'konto' ? 'page' : undefined}>Konto</a>}
          <button type="button" className="btn btn-maly btn-cichy" onClick={() => API.post('/api/psa/portal/logout').then(() => { sesja.odswiez(); idz('/'); })}>Wyloguj</button>
        </nav>
      )}
      <main className="tresc tresc-waska" id="tresc" tabIndex={-1}>{ekran()}</main>
      <StopkaKancelarii kancelaria={kancelaria} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<Portal />);
