/* portal.js — portal klienta (sekcja 8 i 9 specyfikacji), aplikacja osobna
   od SPA kancelaryjnej: własny punkt wejścia (`/portal`), własna sesja w
   ciasteczku `psa_sesja_portal` (nigdy nie miesza się z sesją pracownika).

   Świadome zawężenie wobec sekcji 9 — patrz komentarz na górze
   `server/trasy/portal.js`: krok „co się zmienia” (wybór z pełnej wspólnej
   kartoteki) zostaje po stronie kancelarii. Portal zbiera typ zdarzenia,
   opis i dokumenty; resztę kreatora prowadzi pracownik w kokpicie sprawy. */

/* `useState`/`useEffect`/`useCallback` sa juz zdeklarowane globalnie przez
   rdzen.js (ladowany wczesniej w portal.html) - w przegladarce kazdy tag
   <script> dzieli to samo leksykalne srodowisko najwyzszego poziomu, wiec
   ponowna deklaracja `const` rzucalaby "already declared". */

/* Marka i stopka portalu biora dane z `/api/wspolne/kancelaria`; zapasowy
   komplet zostaje na wypadek, gdyby endpoint nie odpowiedzial - klient ma
   zawsze widziec, czyj to portal. */
const KANCELARIA_ZAPASOWA_PORTAL = {
  nazwa: 'Kancelaria Notarialna Łukasz Kozon',
  www: 'https://notariusz.gdansk.pl',
  www_psa: 'https://notariusz.gdansk.pl',
};

function useKancelaria() {
  const { dane } = useDane('/api/wspolne/kancelaria');
  return (dane && dane.kancelaria) || KANCELARIA_ZAPASOWA_PORTAL;
}



/**
 * Kolumna opisowa ekranów publicznych — mówi, czym jest ten portal i czego
 * po nim oczekiwać, zanim ktokolwiek wpisze hasło. Ta sama na logowaniu,
 * zgłoszeniu i aktywacji, żeby trzy wejścia do portalu wyglądały jak jedno
 * miejsce, a nie trzy różne strony.
 */
function OpisPortalu({ tytul, lead, punkty }) {
  return (
    <div className="brama-opis">
      <div className="brama-tytul">{tytul}</div>
      <div className="brama-lead">{lead}</div>
      <div className="brama-punkty">
        {punkty.map((p) => (
          <div className="brama-punkt" key={p.tytul}>
            <span className="brama-punkt-ikona"><Ikona nazwa={p.ikona} rozmiar={15} /></span>
            <span className="brama-punkt-tresc">
              <strong>{p.tytul}</strong>
              {p.tresc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rama ekranów publicznych: marka na górze, stopka na dole, dwie kolumny w środku. */
function RamaPubliczna({ opis, children }) {
  const kancelaria = useKancelaria();
  return (
    <div className="pion" style={{ minHeight: '100vh' }}>
      <div className="marka-pasek bez-druku">
        <div className="marka-pasek-nazwa">{kancelaria.nazwa}</div>
      </div>
      <div className="brama rama-publiczna-tresc">
        {opis}
        <div className="brama-karta">{children}</div>
      </div>
      {/* Ta sama szerokość, co `.brama` nad nią. */}
      <StopkaKancelarii kancelaria={kancelaria} szerokosc="1080px" />
    </div>
  );
}

const PUNKTY_LOGOWANIA = [
  {
    ikona: 'spolki',
    tytul: 'Podgląd rejestru akcjonariuszy',
    tresc: 'Stan na dowolny dzień, w zakresie odpowiadającym roli konta.',
  },
  {
    ikona: 'sprawy',
    tytul: 'Zgłaszanie zmian',
    tresc: 'Żądanie wpisu wraz z dokumentami, bez wizyty w kancelarii.',
  },
  {
    ikona: 'dokument',
    tytul: 'Informacja z rejestru',
    tresc: 'Pobierz informację z rejestru na dany dzień.',
  },
];

const PUNKTY_ZGLOSZENIA = [
  {
    ikona: 'sprawdz',
    tytul: 'Spółka wpisana do KRS',
    tresc: 'Rejestr akcjonariuszy prowadzi się dla spółki już zarejestrowanej.',
  },
  {
    ikona: 'dokument',
    tytul: 'Bez danych osobowych na tym etapie',
    tresc: 'Zbieramy tylko kontakt i numer KRS — reszta dopiero we wniosku.',
  },
  {
    ikona: 'zegar',
    tytul: 'Odpowiedź od kancelarii',
    tresc: 'Po ocenie zgłoszenia dostaniesz zaproszenie do portalu.',
  },
];

/* ─────────────────────────────────────────────────────
   SESJA PORTALOWA
   ───────────────────────────────────────────────────── */
function usePortalSesja() {
  const [stan, ustawStan] = useState({ ladowanie: true, zalogowany: false, konto: null });

  const odswiez = useCallback(() => {
    return API.get('/api/psa/portal/whoami')
      .then((d) => ustawStan({ ladowanie: false, zalogowany: d.zalogowany, konto: d.konto }))
      .catch(() => ustawStan({ ladowanie: false, zalogowany: false, konto: null }));
  }, []);

  useEffect(() => {
    odswiez();
  }, [odswiez]);

  return { ...stan, odswiez };
}

function EkranLoginPortal({ przyZalogowaniu }) {
  const [email, ustawEmail] = useState('');
  const [haslo, ustawHaslo] = useState('');
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function zaloguj(zdarzenie) {
    zdarzenie.preventDefault();
    if (!email.trim() || !haslo) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      await API.post('/api/psa/portal/login', { email: email.trim(), haslo });
      przyZalogowaniu();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zalogować.');
    } finally {
      ustawWysylanie(false);
    }
  }

  return (
    <form onSubmit={zaloguj}>
      <div className="brama-karta-tytul">Zaloguj się</div>
      <div className="brama-karta-podtytul">Portal klienta rejestru akcjonariuszy</div>

      <Komunikat odmiana="blad" tresc={blad} />

      <Pole etykieta="E-mail" wymagane>
        <input type="email" autoFocus value={email} onChange={(z) => ustawEmail(z.target.value)} autoComplete="username" />
      </Pole>
      <Pole etykieta="Hasło" wymagane>
        <input type="password" value={haslo} onChange={(z) => ustawHaslo(z.target.value)} autoComplete="current-password" />
      </Pole>

      <button
        className="btn btn-glowny btn-duzy"
        type="submit"
        disabled={wysylanie || !email.trim() || !haslo}
        style={{ width: '100%', marginTop: 'var(--od-8)' }}
      >
        {wysylanie ? 'Logowanie…' : 'Zaloguj się'}
      </button>

      <div className="brama-stopka">
        Dostęp zakłada kancelaria po weryfikacji tożsamości — nie ma tu samodzielnej rejestracji.
        {/* Droga poboczna, nie główna: czerwień jest w tym systemie zarezerwowana
            dla odmowy i rzeczy nieodwracalnych, a ten przycisk krzyczał głośniej
            niż „Zaloguj się", czyli to, po co ludzie tu przychodzą. */}
        <button
          type="button"
          className="btn btn-pelny"
          onClick={() => idz('/zglos-sie')}
        >
          Nie mam konta — zgłaszam zainteresowanie
        </button>
      </div>
    </form>
  );
}

/* Etap 3A — publiczny, niezalogowany formularz pierwszego kontaktu. Zbiera
   WYŁĄCZNIE dane kontaktowe (bez PESEL, bez adresu) — to lead do oceny przez
   kancelarię, nie wniosek. Kancelaria odpowiada zaproszeniem (etap 3B), po
   którym dopiero zaczyna się właściwy wniosek o prowadzenie rejestru. */
function EkranZgloszenieWstepne() {
  const [email, ustawEmail] = useState('');
  const [krs, ustawKrs] = useState('');
  const [nazwaSpolki, ustawNazwaSpolki] = useState('');
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [gotowe, ustawGotowe] = useState(false);

  const krsCyfry = krs.replace(/\D/g, '');
  const krsPoprawny = krsCyfry.length === 10;

  async function wyslij(zdarzenie) {
    zdarzenie.preventDefault();
    if (!email.trim() || !krsPoprawny) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post('/api/psa/portal/zgloszenia', {
        email: email.trim(),
        krs: krsCyfry,
        nazwa_spolki: nazwaSpolki.trim() || undefined,
      });
      ustawGotowe(wynik);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wysłać zgłoszenia.');
    } finally {
      ustawWysylanie(false);
    }
  }

  if (gotowe) {
    // Zaproszenie idzie od razu, wiec klient ma isc do skrzynki, a nie czekac
    // na telefon z kancelarii. Gdy poczta zawiedzie, link wraca w odpowiedzi
    // — pokazujemy go tutaj, zeby droga dalej nie urwala sie w pol kroku.
    return (
      <Pusto
        ikona="sprawdz"
        tytul="Zaproszenie wysłane"
        opis={
          gotowe.zaproszenie_wyslane === false && gotowe.link_aktywacyjny
            ? 'Nie udało się wysłać wiadomości. Skorzystaj z linku poniżej — jest ważny przez 7 dni.'
            : `Na adres ${email.trim()} poszedł link do portalu. Jest ważny przez 7 dni — ustawisz tam hasło i wypełnisz wniosek o prowadzenie rejestru.`
        }
        akcja={
          gotowe.link_aktywacyjny ? (
            <a className="btn btn-glowny" href={gotowe.link_aktywacyjny}>Otwórz portal</a>
          ) : (
            <button className="btn" onClick={() => idz('/')}>Wróć do logowania</button>
          )
        }
      />
    );
  }

  return (
    <form onSubmit={wyslij}>
      <div className="brama-karta-tytul">Zgłoś zainteresowanie</div>
      <div className="brama-karta-podtytul">
        Prowadzenie rejestru akcjonariuszy prostej spółki akcyjnej
      </div>

        <Komunikat odmiana="blad" tresc={blad} />

        <Pole etykieta="E-mail" wymagane>
          <input type="email" autoFocus value={email} onChange={(z) => ustawEmail(z.target.value)} autoComplete="email" />
        </Pole>
        <Pole
          etykieta="Numer KRS spółki"
          wymagane
          podpowiedz="Rejestr akcjonariuszy prowadzi się dla spółki wpisanej już do rejestru przedsiębiorców — spółkę w organizacji trzeba najpierw zarejestrować."
        >
          <input
            type="text"
            inputMode="numeric"
            value={krs}
            onChange={(z) => ustawKrs(z.target.value)}
            maxLength={14}
            placeholder="0000123456"
          />
        </Pole>
        {krs && !krsPoprawny && (
          <Komunikat odmiana="uwaga" tresc="Numer KRS składa się z dziesięciu cyfr." />
        )}
        <Pole etykieta="Nazwa spółki">
          <input type="text" value={nazwaSpolki} onChange={(z) => ustawNazwaSpolki(z.target.value)} />
        </Pole>

      <button
        className="btn btn-glowny btn-duzy"
        type="submit"
        disabled={wysylanie || !email.trim() || !krsPoprawny}
        style={{ width: '100%', marginTop: 'var(--od-8)' }}
      >
        {wysylanie ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
      </button>
      <div className="brama-stopka">
        <button type="button" className="btn btn-cichy" onClick={() => idz('/')}>← Wróć do logowania</button>
      </div>
    </form>
  );
}

/* Etap 3B — publiczny, niezalogowany ekran wymiany tokenu z maila
   zapraszającego na hasło. Po sukcesie backend od razu zakłada sesję
   portalową (ciasteczko), więc wystarczy wrócić na „/” — świeże
   `usePortalSesja()` samo ją odkryje. */
function EkranAktywacjaKonta({ token }) {
  const [email, ustawEmail] = useState(null);
  const [sprawdzanie, ustawSprawdzanie] = useState(true);
  const [bladTokenu, ustawBladTokenu] = useState(null);
  const [haslo, ustawHaslo] = useState('');
  const [powtorzHaslo, ustawPowtorzHaslo] = useState('');
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  useEffect(() => {
    API.get(`/api/psa/portal/aktywacja/${token}`)
      .then((d) => ustawEmail(d.email))
      .catch((e) => ustawBladTokenu(e instanceof BladApi ? e.message : 'Link aktywacyjny jest nieprawidłowy albo wygasł.'))
      .finally(() => ustawSprawdzanie(false));
  }, [token]);

  async function aktywuj(zdarzenie) {
    zdarzenie.preventDefault();
    if (haslo !== powtorzHaslo) {
      ustawBlad('Hasła nie są takie same.');
      return;
    }
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      await API.post(`/api/psa/portal/aktywacja/${token}`, { haslo });
      idz('/');
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się aktywować konta.');
    } finally {
      ustawWysylanie(false);
    }
  }

  if (sprawdzanie) return <Spinner />;

  if (bladTokenu) {
    return (
      <Pusto
        ikona="ostrzezenie"
        tytul="Link jest nieważny"
        opis={bladTokenu}
        akcja={<button className="btn" onClick={() => idz('/')}>Wróć do logowania</button>}
      />
    );
  }

  return (
    <form onSubmit={aktywuj}>
      <div className="brama-karta-tytul">Aktywacja konta</div>
      <div className="brama-karta-podtytul">{email}</div>

      <Komunikat odmiana="blad" tresc={blad} />

      <Pole etykieta="Hasło" wymagane podpowiedz="Co najmniej 10 znaków, litera i cyfra.">
        <input type="password" autoFocus value={haslo} onChange={(z) => ustawHaslo(z.target.value)} autoComplete="new-password" />
      </Pole>
      <Pole etykieta="Powtórz hasło" wymagane>
        <input type="password" value={powtorzHaslo} onChange={(z) => ustawPowtorzHaslo(z.target.value)} autoComplete="new-password" />
      </Pole>

      <button
        className="btn btn-glowny btn-duzy"
        type="submit"
        disabled={wysylanie || !haslo || !powtorzHaslo}
        style={{ width: '100%', marginTop: 'var(--od-8)' }}
      >
        {wysylanie ? 'Aktywowanie…' : 'Aktywuj konto'}
      </button>
    </form>
  );
}

/* Etap 3B.1 — informacja o przetwarzaniu danych osobowych (art. 13 RODO),
   potwierdzana JEDNORAZOWO przed wejściem do formularza wniosku (etap 3C).
   To NIE jest zgoda z art. 6 ust. 1 lit. a) RODO — podstawą przetwarzania
   danych treści rejestru jest umowa / obowiązek prawny, więc "zgody" na
   samo przetwarzanie się tu nie zbiera; potwierdza się WYŁĄCZNIE zapoznanie
   z obowiązkiem informacyjnym. Prawdziwa zgoda (komunikacja elektroniczna)
   żyje przy danych akcjonariusza — etap 3D, zgodnie z opisem promptu. */
function EkranKlauzulaRodo({ przyAkceptacji }) {
  const { dane } = useDane('/api/wspolne/kancelaria');
  const kancelaria = dane && dane.kancelaria;
  const [potwierdzono, ustawPotwierdzono] = useState(false);
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function dalej() {
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      await API.post('/api/psa/portal/rodo');
      przyAkceptacji();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać potwierdzenia.');
    } finally {
      ustawWysylanie(false);
    }
  }

  return (
    <Karta tytul="Informacja o przetwarzaniu danych osobowych">
      <div className="pion" style={{ gap: 16 }}>
        <p>
          Zanim przejdziesz do wypełnienia wniosku o prowadzenie rejestru akcjonariuszy, zapoznaj się
          z poniższą informacją.
        </p>
        <div className="pion" style={{ gap: 8 }}>
          <div>
            <strong>Administrator danych:</strong>{' '}
            {kancelaria ? kancelaria.nazwa : '—'}
            {kancelaria && kancelaria.adres ? `, ${kancelaria.adres}` : ''}
            {kancelaria && kancelaria.miejscowosc ? `, ${kancelaria.miejscowosc}` : ''}
            {kancelaria && kancelaria.email ? ` (${kancelaria.email})` : ''}.
          </div>
          <div>
            <strong>Cel przetwarzania:</strong> zawarcie i wykonanie umowy o prowadzenie rejestru
            akcjonariuszy prostej spółki akcyjnej (art. 300(31) i nast. Kodeksu spółek handlowych),
            w tym zebranie danych stanowiących treść rejestru.
          </div>
          <div>
            <strong>Podstawa prawna:</strong> art. 6 ust. 1 lit. b) RODO (niezbędność do zawarcia
            i wykonania umowy) oraz art. 6 ust. 1 lit. c) RODO (obowiązek prawny wynikający
            z Kodeksu spółek handlowych) — w zakresie, w jakim dane stanowią obligatoryjną treść rejestru.
          </div>
          <div>
            <strong>Zakres danych:</strong> dane spółki, dane reprezentanta podpisującego umowę oraz
            dane akcjonariuszy (imię, nazwisko, PESEL, data urodzenia, adres, dane kontaktowe).
          </div>
          <div>
            <strong>Okres przechowywania:</strong> przez czas prowadzenia rejestru akcjonariuszy oraz
            przez okres wynikający z obowiązków archiwizacyjnych kancelarii notarialnej.
          </div>
          <div>
            <strong>Prawa osoby, której dane dotyczą:</strong> dostęp do danych, sprostowanie oraz —
            w zakresie przewidzianym przepisami — ograniczenie przetwarzania i wniesienie skargi do
            Prezesa Urzędu Ochrony Danych Osobowych.
          </div>
        </div>

        <Komunikat odmiana="blad" tresc={blad} />

        <label className="chk">
          <input type="checkbox" checked={potwierdzono} onChange={(z) => ustawPotwierdzono(z.target.checked)} />
          <span className="chk-tresc">Przeczytałem/-am i rozumiem powyższą informację.</span>
        </label>

        <button className="btn btn-glowny" disabled={!potwierdzono || wysylanie} onClick={dalej} style={{ alignSelf: 'flex-start' }}>
          {wysylanie ? 'Zapisywanie…' : 'Przejdź dalej'}
        </button>
      </div>
    </Karta>
  );
}

/* ─────────────────────────────────────────────────────
   UKŁAD
   ───────────────────────────────────────────────────── */
/**
 * Nawigacja portalu zależy od tego, na czym stoi konto.
 *
 * `wnioskodawca` nie ma jeszcze spółki w rejestrze, więc jego głównym ekranem
 * jest FORMULARZ — stoi pierwszy: klient, który właśnie ustawił hasło, ma
 * przed sobą wniosek do wypełnienia, a nie listę spółek, których jeszcze
 * nie ma.
 *
 * `spolka` to konto po przyjęciu wniosku. Zakładka „Wniosek" znika — sprawa
 * jest zamknięta, a formularz i tak nie przyjmuje już zmian. Zostaje jedna
 * spółka, więc i nazwa jest w liczbie pojedynczej.
 *
 * `akcjonariusz` bywa uprawniony z akcji kilku spółek, więc u niego liczba
 * mnoga zostaje.
 */
/**
 * Szyna portalu klienta — ta sama nawigacja, co w portalu kancelarii.
 *
 * Dotad ekrany portalu wisialy na przyciskach w pasku gornym. Doszly
 * platnosci i pasek przestal byc lista miejsc, a zaczal byc rzedem
 * przyciskow, w ktorym nie widac, gdzie sie jest. Szyna mowi to samo
 * w pionie, ma miejsce na licznik naleznosci i nie rozjezdza sie przy
 * piatej pozycji.
 */
function kartyNawigacji(rola) {
  if (rola === 'wnioskodawca') {
    return [
      { sciezka: '/wniosek', nazwa: 'Wniosek', ikona: 'dokument' },
      { sciezka: '/', nazwa: 'Moja spółka', ikona: 'spolki' },
      { sciezka: '/sprawy', nazwa: 'Moje zgłoszenia', ikona: 'sprawy' },
      { sciezka: '/platnosci', nazwa: 'Płatności', ikona: 'oplaty', licznik: true },
    ];
  }
  return [
    { sciezka: '/', nazwa: rola === 'spolka' ? 'Moja spółka' : 'Moje spółki', ikona: 'spolki' },
    { sciezka: '/sprawy', nazwa: 'Moje zgłoszenia', ikona: 'sprawy' },
    { sciezka: '/platnosci', nazwa: 'Płatności', ikona: 'oplaty', licznik: true },
  ];
}

function SzynaPortalu({ sciezka, rola, doZaplaty }) {
  const aktywna = (poz) => (poz.sciezka === '/' ? sciezka === '/' : sciezka.startsWith(poz.sciezka));
  return (
    <nav className="szyna bez-druku">
      <div className="szyna-marka">
        <span className="szyna-znak"><Ikona nazwa="znak" rozmiar={19} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="szyna-marka-nazwa">Rejestr</div>
          <div className="szyna-marka-podpis">akcjonariuszy P.S.A.</div>
        </div>
      </div>
      <div className="szyna-grupa">
        {kartyNawigacji(rola).map((poz) => (
          <button
            key={poz.sciezka}
            className={`szyna-poz ${aktywna(poz) ? 'aktywna' : ''}`}
            onClick={() => idz(poz.sciezka)}
          >
            <Ikona nazwa={poz.ikona} rozmiar={17} />
            <span className="szyna-poz-etykieta">{poz.nazwa}</span>
            {poz.licznik && doZaplaty > 0 && (
              <span className="szyna-licznik" title="należności do zapłaty">{doZaplaty}</span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}

const ETYKIETA_ROLI_KONTA = {
  spolka: 'konto spółki',
  akcjonariusz: 'konto akcjonariusza',
  // Etap 3B: zaproszone, ale wniosek jeszcze nie zlozony/przyjety.
  wnioskodawca: 'konto wnioskodawcy',
};

function PortalLayout({ sciezka, waski, konto, przyWylogowaniu, children }) {
  const [wylogowywanie, ustawWylogowywanie] = useState(false);
  const kancelaria = useKancelaria();
  // Licznik naleznosci odswieza sie przy kazdej zmianie ekranu — po zaplacie
  // klient wraca na inna sciezke i znacznik ma zniknac od razu.
  const { dane: rozliczenia } = useDane('/api/psa/portal/oplaty', [sciezka]);
  const doZaplaty = rozliczenia ? rozliczenia.oplaty.filter((o) => o.status !== 'oplacona').length : 0;

  async function wyloguj() {
    ustawWylogowywanie(true);
    try {
      await API.post('/api/psa/portal/logout');
    } finally {
      przyWylogowaniu();
    }
  }

  // Ta sama powłoka, co w aplikacji kancelaryjnej: zaokrąglony panel odsunięty
  // od krawędzi okna, pasek marki na górze, szyna nawigacji po lewej. Oba
  // widoki są tym samym oknem tej samej kancelarii i nie ma powodu, żeby
  // jeden miał nawigację w pionie, a drugi rząd przycisków w belce.
  return (
    <div className="powloka">
      <div className="marka-pasek bez-druku">
        <div className="marka-pasek-nazwa">{kancelaria.nazwa}</div>
      </div>
      <SzynaPortalu sciezka={sciezka} rola={konto.rola} doZaplaty={doZaplaty} />
      <NawigacjaPortaluWaska sciezka={sciezka} rola={konto.rola} doZaplaty={doZaplaty} />
      <div className="obszar">
        <header className="topbar bez-druku">
          <div>
            <div className="topbar-tytul">{opisEkranuPortalu(sciezka).tytul}</div>
            <div className="topbar-podtytul">
              {konto.email} · {ETYKIETA_ROLI_KONTA[konto.rola] || konto.rola}
            </div>
          </div>
          <button className="btn btn-sm" onClick={wyloguj} disabled={wylogowywanie}>Wyloguj się</button>
        </header>
        <main className={`tresc ${waski ? 'tresc-waska' : ''}`}>{children}</main>
        {/* Wąskie widoki portalu (wniosek, zgłoszenie) mają treść na 880 px —
            stopka idzie za nimi, zamiast rozpychać się na pełne 1240 px. */}
        <StopkaKancelarii kancelaria={kancelaria} szerokosc={waski ? '880px' : undefined} />
      </div>
    </div>
  );
}

/** Nawigacja na wąskim ekranie — szyna się chowa, zostaje jeden rząd. */
function NawigacjaPortaluWaska({ sciezka, rola, doZaplaty }) {
  const aktywna = (poz) => (poz.sciezka === '/' ? sciezka === '/' : sciezka.startsWith(poz.sciezka));
  return (
    <nav className="topbar-nawigacja bez-druku">
      {kartyNawigacji(rola).map((poz) => (
        <button
          key={poz.sciezka}
          className={`topbar-nawigacja-poz ${aktywna(poz) ? 'aktywna' : ''}`}
          onClick={() => idz(poz.sciezka)}
        >
          <Ikona nazwa={poz.ikona} rozmiar={16} />
          <span>{poz.nazwa}</span>
          {poz.licznik && doZaplaty > 0 && <span className="szyna-licznik">{doZaplaty}</span>}
        </button>
      ))}
    </nav>
  );
}

/** Tytuł w belce — mówi, gdzie jesteś, zamiast powtarzać nazwę modułu. */
function opisEkranuPortalu(sciezka) {
  if (sciezka.startsWith('/wniosek')) return { tytul: 'Wniosek o prowadzenie rejestru' };
  if (sciezka.startsWith('/sprawy')) return { tytul: 'Moje zgłoszenia' };
  if (sciezka.startsWith('/platnosci')) return { tytul: 'Płatności' };
  if (sciezka.startsWith('/zgloszenie')) return { tytul: 'Zgłoszenie zmiany w rejestrze' };
  if (sciezka.startsWith('/informacja')) return { tytul: 'Informacja z rejestru' };
  if (sciezka.startsWith('/rejestr')) return { tytul: 'Rejestr akcjonariuszy' };
  return { tytul: 'Rejestr akcjonariuszy P.S.A.' };
}

/* ─────────────────────────────────────────────────────
   STAN WNIOSKU — ekran konta wnioskodawcy
   ───────────────────────────────────────────────────── */

/* Co widzi wnioskodawca w „Moich spółkach", dopóki spółki nie ma jeszcze
   w rejestrze. Każdy stan mówi to samo w trzech częściach: gdzie jest
   sprawa, po czyjej stronie jest ruch i co się stanie dalej. */
const STANY_WNIOSKU_KLIENTA = {
  w_przygotowaniu: {
    odmiana: 'info',
    tytul: 'Wniosek w przygotowaniu',
    tresc: 'Wniosek nie został jeszcze złożony. Wróć do formularza i uzupełnij dane spółki oraz listę akcjonariuszy.',
    doFormularza: true,
  },
  do_uzupelnienia: {
    odmiana: 'uwaga',
    tytul: 'Wniosek wrócił do uzupełnienia',
    tresc: 'Kancelaria odesłała wniosek z uwagami. Popraw wskazane dane i złóż go ponownie.',
    doFormularza: true,
  },
  zlozony: {
    odmiana: 'info',
    tytul: 'Wniosek przyjęty do sprawdzenia',
    tresc: 'Kancelaria sprawdza podane dane i przygotowuje komplet dokumentów do podpisu. '
      + 'Gdy będą gotowe, napiszemy e-mailem — pobierzesz je wtedy w tym portalu.',
  },
  umowa_wygenerowana: {
    odmiana: 'uwaga',
    tytul: 'Dokumenty czekają na podpis',
    tresc: 'Kancelaria przygotowała komplet dokumentów. Pobierz je w formularzu wniosku, '
      + 'zbierz podpisy i odeślij skany w tym samym miejscu.',
    doFormularza: true,
  },
  umowa_podpisana: {
    odmiana: 'info',
    tytul: 'Trwa rejestracja spółki w systemie',
    tresc: 'Dokumenty dotarły do kancelarii. Trwa weryfikacja danych i zakładanie rejestru akcjonariuszy — po jej zakończeniu otrzymasz wiadomość e-mail, a w tym miejscu pojawi się podgląd rejestru i możliwość pobrania danych.',
  },
  odrzucony: {
    odmiana: 'blad',
    tytul: 'Wniosek nie został przyjęty',
    tresc: 'Kancelaria nie przyjęła wniosku. Szczegóły otrzymasz e-mailem — w razie pytań skontaktuj się z kancelarią.',
  },
};

function StanWniosku({ wniosek }) {
  // Zanim wniosek zostanie złożony, „Moje spółki" nie mają czego pokazać —
  // jedyną sensowną treścią konta jest formularz. Przerzucamy więc na niego
  // od razu, zamiast stawiać po drodze ekran z jednym przyciskiem „Wypełnij
  // wniosek". Po złożeniu wniosku ta zakładka wraca do roli przeglądu stanu.
  const doWypelnienia = !wniosek || ['w_przygotowaniu', 'do_uzupelnienia'].includes(wniosek.status);
  useEffect(() => {
    if (doWypelnienia) idz('/wniosek');
  }, [doWypelnienia]);

  if (doWypelnienia) return <Spinner />;

  const stan = STANY_WNIOSKU_KLIENTA[wniosek.status] || {
    odmiana: 'info',
    tytul: 'Wniosek w toku',
    tresc: 'Sprawa jest w toku po stronie kancelarii.',
  };

  return (
    <div className="pion" style={{ gap: 16 }}>
      <Karta tytul={wniosek.nazwa || 'Wniosek o prowadzenie rejestru'}>
        {wniosek.krs && <div className="podpowiedz" style={{ marginBottom: 16 }}>KRS {wniosek.krs}</div>}
        <Komunikat odmiana={stan.odmiana} tytul={stan.tytul} tresc={stan.tresc} />
        {stan.doFormularza && (
          <button className="btn btn-glowny" onClick={() => idz('/wniosek')}>
            Przejdź do wniosku
          </button>
        )}
      </Karta>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   MOJE SPÓŁKI / AKCJE
   ───────────────────────────────────────────────────── */
function EkranMoje() {
  const { dane, ladowanie } = useDane('/api/psa/portal/moje');
  if (ladowanie) return <Spinner />;
  if (!dane) return null;

  // Konto wnioskodawcy: spółki jeszcze nie ma w rejestrze, więc zamiast
  // pustej listy pokazujemy, na czym stoi wniosek i co dzieje się dalej.
  if (dane.rola === 'wnioskodawca') return <StanWniosku wniosek={dane.wniosek} />;

  if (dane.spolki.length === 0) {
    return <Pusto tytul="Brak powiązanych spółek" opis="To konto nie jest jeszcze powiązane z żadną spółką w rejestrze." />;
  }

  return (
    <div className="pion" style={{ gap: 16 }}>
      {dane.spolki.map((s) => {
        const spolkaId = dane.rola === 'spolka' ? s.id : s.spolka_id;
        const nazwa = s.nazwa;
        return (
          <Karta key={spolkaId} tytul={nazwa}>
            {dane.rola === 'akcjonariusz' && (
              <div className="pion" style={{ gap: 8, marginBottom: 16 }}>
                <div className="podpowiedz">Posiadane akcje — razem {fmt.liczba(s.razem_akcji)}</div>
                {s.pozycje.map((p, i) => (
                  <div key={i} className="row-b">
                    <span>Seria {p.seria}</span>
                    <span className="mono przyciemnione">{p.numery}</span>
                    <span>{fmt.liczba(p.ilosc)}</span>
                  </div>
                ))}
              </div>
            )}
            {s.krs && <div className="podpowiedz odstep-d">KRS {s.krs}</div>}

            {/* Stan rejestru na wejściu — po te trzy liczby klient i tak
                wchodził do podglądu. Widok domowy, który pokazuje samą nazwę
                spółki, nie mówi nic o tym, po co się tu przyszło. */}
            {dane.rola === 'spolka' && (
              <div className="stan-skrot">
                <div className="stan-skrot-poz">
                  <span className="stan-skrot-liczba">{fmt.liczba(s.akcjonariuszy || 0)}</span>
                  <span className="stan-skrot-opis">
                    {s.akcjonariuszy === 1 ? 'akcjonariusz' : 'akcjonariuszy'}
                  </span>
                </div>
                <div className="stan-skrot-poz">
                  <span className="stan-skrot-liczba">{fmt.liczba(s.razem_akcji || 0)}</span>
                  <span className="stan-skrot-opis">akcji w obrocie</span>
                </div>
                <div className="stan-skrot-poz">
                  <span className="stan-skrot-liczba">
                    {s.ostatnie_zdarzenie ? fmt.data(s.ostatnie_zdarzenie) : '—'}
                  </span>
                  <span className="stan-skrot-opis">ostatnia zmiana</span>
                </div>
              </div>
            )}

            <div className="row-g">
              <button className="btn btn-glowny" onClick={() => idz(`/rejestr/${spolkaId}`)}>Zobacz rejestr</button>
              <button className="btn" onClick={() => idz(`/zgloszenie/${spolkaId}`)}>Zgłoś zmianę</button>
              <button className="btn" onClick={() => idz(`/informacja/${spolkaId}`)}>Informacja z rejestru</button>
            </div>
          </Karta>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   PODGLĄD REJESTRU (z maskowaniem — art. 300(35) KSH)
   ───────────────────────────────────────────────────── */
function EkranRejestrPortal({ spolkaId }) {
  const [dataStan, ustawDataStan] = useState(fmt.dzisIso());
  const { dane, ladowanie, blad } = useDane(`/api/psa/portal/rejestr/${spolkaId}?data=${dataStan}`, [dataStan]);

  return (
    <div className="pion" style={{ gap: 16 }}>
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => idz('/')}>← Wróć</button>

      {blad && <Komunikat odmiana="blad" tresc={blad.message} />}
      {ladowanie && <Spinner />}

      {dane && (
        <>
          <Karta tytul={dane.spolka.nazwa}>
            <div className="row-g" style={{ marginBottom: 4 }}>
              <label className="fl" style={{ margin: 0 }}>Stan na dzień</label>
              <PoleDaty wartosc={dataStan} przyZmianie={(v) => v && ustawDataStan(v)} />
            </div>
          </Karta>

          <Karta tight tytul={`Akcjonariat — razem ${fmt.liczba(dane.razem_akcji)} akcji`}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Akcjonariusz</th>
                  <th>Seria</th>
                  <th className="prawo">Ilość</th>
                  <th>Numery</th>
                  <th className="prawo">Udział</th>
                  <th>Obciążenia</th>
                </tr>
              </thead>
              <tbody>
                {dane.akcjonariusze.length === 0 && (
                  <tr><td colSpan={6} className="przyciemnione">Brak wpisanych akcjonariuszy.</td></tr>
                )}
                {dane.akcjonariusze.map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>
                      {a.osoba ? a.osoba.oznaczenie : 'nieznany'}
                      {a.osoba && a.osoba.zamaskowane && <span className="podpowiedz"> (dane częściowo zamaskowane)</span>}
                    </td>
                    <td>{a.seria}</td>
                    <td className="prawo">{fmt.liczba(a.ilosc)}</td>
                    <td className="mono">{a.numery}</td>
                    <td className="prawo">{fmt.procent(a.procent)}</td>
                    <td>{a.obciazenia.length > 0 ? <Znacznik odmiana="bordo">{a.obciazenia.length}</Znacznik> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Karta>

          {dane.emisje.length > 0 && (
            <Karta tight tytul="Emisje">
              <table className="tbl">
                <thead><tr><th>Seria</th><th className="prawo">Ilość</th><th>Numery</th><th>Status</th></tr></thead>
                <tbody>
                  {dane.emisje.map((e) => (
                    <tr key={e.klucz}>
                      <td>{e.seria}</td>
                      <td className="prawo">{fmt.liczba(e.ilosc)}</td>
                      <td className="mono">{e.zakres}</td>
                      <td>{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Karta>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   ZGŁOSZENIE ŻĄDANIA (kroki 1—2 kreatora)
   ───────────────────────────────────────────────────── */
/**
 * Czego dotyczy zgloszenie — TRZY pozycje, nie trzynascie typow zdarzen
 * z `meta.typy_zdarzen`. Klient nie kwalifikuje czynnosci prawnej: robi to
 * pracownik, czytajac dokument (art. 300(34) § 4 KSH — podstawa wpisu to
 * dokument, nie opis zadajacego). Wybor sluzy wylacznie skierowaniu sprawy
 * we wlasciwe miejsce kolejki; pracownik poprawia typ, jesli dokument mowi
 * co innego (patrz `PATCH /api/psa/sprawy/:id` z akcja `zmien-typ`).
 */
const GRUPY_ZGLOSZENIA = [
  ['przeniesienie', 'Zbycie albo nabycie akcji'],
  ['emisja', 'Emisja albo umorzenie akcji'],
  ['uprawnienie', 'Ustanowienie uprawnienia, przywileju albo obowiązku'],
];

function EkranZgloszeniePortal({ spolkaId }) {
  const [typ, ustawTyp] = useState('');
  const [opis, ustawOpis] = useState('');
  const [pliki, ustawPliki] = useState([]);
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [gotowe, ustawGotowe] = useState(null);
  const wejscie = useRef(null);

  // Wpis robi sie NA PODSTAWIE DOKUMENTU (art. 300(34) § 4 KSH), wiec plik
  // jest tu rzecza najwazniejsza. Zgloszenie bez pliku przyjmujemy, ale
  // wtedy trzeba napisac, co sie wydarzylo i skad dokument ma sie wziac.
  const mozeZlozyc = Boolean(typ) && (pliki.length > 0 || opis.trim().length > 0);

  function dodajPliki(nowe) {
    ustawPliki((p) => [...p, ...nowe].slice(0, 10));
    if (wejscie.current) wejscie.current.value = '';
  }
  function usunPlik(i) {
    ustawPliki((p) => p.filter((_, idx) => idx !== i));
  }

  async function zglos() {
    if (!mozeZlozyc) return;
    ustawWysylanie(true);
    ustawBlad(null);
    // Nowa karta na formularz płatności otwiera się TERAZ, w obsłudze
    // kliknięcia — po `await` przeglądarka blokuje ją jak wyskakujące okienko.
    const okno = window.open('', '_blank');
    try {
      const wynik = await API.post('/api/psa/portal/zadania', {
        spolka_id: spolkaId, typ_zdarzenia: typ, opis: opis.trim(),
      });
      if (pliki.length > 0) {
        const formularz = new FormData();
        // Rodzaju dokumentu klient nie oznacza — pracownik i tak otwiera plik
        // i czyta go w calosci, a zla kwalifikacja z portalu tylko myli akta.
        formularz.append('typ_dokumentu', 'inny');
        for (const plik of pliki) formularz.append('pliki', plik);
        const odp = await fetch(`/api/psa/portal/zadania/${wynik.sprawa.id}/dokumenty`, {
          method: 'POST', body: formularz,
        });
        if (!odp.ok) {
          const tresc = await odp.json().catch(() => ({}));
          throw new Error(tresc.blad || 'Zgłoszenie przyjęto, ale nie udało się przesłać pliku.');
        }
      }
      // Żądanie wpisu składane przez portal dochodzi do skutku z chwilą
      // zapłaty — dlatego prowadzimy wprost do formularza płatności,
      // zamiast zostawiać klienta z „przyjęto" i należnością gdzie indziej.
      let link = null;
      if (wynik.oplata_id) {
        try {
          const zaplata = await API.post(`/api/psa/portal/oplaty/${wynik.oplata_id}/zaplac`, {});
          link = zaplata.link;
        } catch (e) {
          // Płatności online niedostępne — zgłoszenie i tak jest zapisane,
          // a należność czeka w zakładce „Płatności".
          link = null;
        }
      }
      if (link && okno && !okno.closed) okno.location = link;
      else if (okno && !okno.closed) okno.close();
      ustawGotowe({ oplata_id: wynik.oplata_id, link });
    } catch (e) {
      if (okno && !okno.closed) okno.close();
      ustawBlad(e instanceof BladApi ? e.message : e.message || 'Nie udało się złożyć zgłoszenia.');
    } finally {
      ustawWysylanie(false);
    }
  }

  if (gotowe) {
    return (
      <Karta>
        <Pusto
          tytul={gotowe.link ? 'Zgłoszenie zapisane — czeka na opłatę' : 'Zgłoszenie zapisane'}
          opis={gotowe.oplata_id
            ? 'Wpis w rejestrze jest odpłatny. Żądanie trafia do kancelarii po opłaceniu — do tego czasu '
              + 'czeka w zakładce „Płatności”. Formularz płatności otworzyliśmy w nowej karcie.'
            : 'Kancelaria rozpatrzy zgłoszenie i skontaktuje się w razie potrzeby uzupełnienia dokumentów.'}
          akcja={
            <div className="row-g">
              {gotowe.oplata_id && (
                <button className="btn btn-glowny" onClick={() => idz('/platnosci')}>Przejdź do płatności</button>
              )}
              <button className="btn" onClick={() => idz('/sprawy')}>Moje zgłoszenia</button>
            </div>
          }
        />
      </Karta>
    );
  }

  return (
    <div className="pion" style={{ gap: 16 }}>
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => idz('/')}>← Wróć</button>
      <Karta tytul="Zgłoś zmianę w rejestrze">
        <Komunikat odmiana="blad" tresc={blad} />

        <Pole etykieta="Czego dotyczy zgłoszenie" wymagane>
          <select value={typ} onChange={(z) => ustawTyp(z.target.value)}>
            <option value="">— wybierz —</option>
            {GRUPY_ZGLOSZENIA.map(([kod, nazwa]) => (
              <option key={kod} value={kod}>{nazwa}</option>
            ))}
          </select>
        </Pole>

        {/* Dokument, nie opis, jest podstawą wpisu — dlatego stoi wyżej
            i zajmuje więcej miejsca niż pole na uwagi. */}
        <Pole
          etykieta="Dokument, na podstawie którego ma być dokonany wpis"
          podpowiedz="Skan albo zdjęcie. PDF, JPG, PNG, DOC/DOCX — maks. 20 MB na plik."
        >
          <div className="zgloszenie-plik">
            <input
              ref={wejscie}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="pole-pliku-ukryte"
              onChange={(z) => dodajPliki([...z.target.files])}
            />
            <button type="button" className="btn" onClick={() => wejscie.current && wejscie.current.click()}>
              <Ikona nazwa="pobierz" rozmiar={16} /> Wybierz plik
            </button>
          </div>
          {pliki.length > 0 && (
            <ul className="lista-plikow">
              {pliki.map((p, i) => (
                <li key={`${p.name}-${i}`}>
                  <Ikona nazwa="dokument" rozmiar={15} />
                  <span className="lista-plikow-nazwa">{p.name}</span>
                  <span className="wyciszony male">{Math.max(1, Math.round(p.size / 1024))} kB</span>
                  <button type="button" className="btn-tekstowy" onClick={() => usunPlik(i)}>usuń</button>
                </li>
              ))}
            </ul>
          )}
        </Pole>

        <Pole
          etykieta="Uwagi (opcjonalnie)"
          podpowiedz="Tylko jeśli coś wymaga wyjaśnienia. Wpis i tak powstaje na podstawie dokumentu, nie opisu."
        >
          <textarea rows={2} value={opis} onChange={(z) => ustawOpis(z.target.value)} />
        </Pole>

        {pliki.length === 0 && (
          <Komunikat
            odmiana="uwaga"
            tresc="Bez dołączonego dokumentu kancelaria nie dokona wpisu — napisz w uwagach, jak dostarczysz dokument, albo dołącz go tutaj."
          />
        )}

        <button
          className="btn btn-glowny"
          disabled={wysylanie || !mozeZlozyc}
          onClick={zglos}
          style={{ marginTop: 8 }}
        >
          {wysylanie ? 'Wysyłanie…' : 'Złóż zgłoszenie'}
        </button>
      </Karta>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   STATUS ZGŁOSZEŃ
   ───────────────────────────────────────────────────── */
const ZNACZNIK_STANU = {
  nowa: 'neutralny', weryfikacja: 'lupek', wstrzymana: 'oliwka',
  wpisana: 'zielony', odmowa: 'bordo', anulowana: 'neutralny',
};

/* Ten sam pasek starzenia co w kolejce spraw kancelarii (faza 3.1) —
   spójność wizualna dla tego samego pojęcia po obu stronach portalu. */
function kolorPaskaTerminuPortal(termin) {
  if (!termin) return 'transparent';
  if (termin.po_terminie) return 'var(--burgundy-2)';
  if (termin.pilny) return 'var(--burgundy)';
  if (termin.zamrozony) return 'var(--olive)';
  return 'transparent';
}

function EkranSprawyPortal() {
  const { dane, ladowanie } = useDane('/api/psa/portal/zadania');
  if (ladowanie) return <Spinner />;
  if (!dane) return null;

  if (dane.sprawy.length === 0) {
    return <Pusto tytul="Brak zgłoszeń" opis="Nie złożono jeszcze żadnego zgłoszenia przez portal." />;
  }

  return (
    <Karta tight tytul="Moje zgłoszenia">
      <table className="tbl">
        <thead>
          <tr>
            <th className="wiersz-kolejki-pasek-glowka" />
            <th>Spółka</th><th>Rodzaj</th><th>Zgłoszono</th><th>Stan</th><th>Termin</th>
          </tr>
        </thead>
        <tbody>
          {dane.sprawy.map((s) => (
            <tr key={s.id}>
              <td
                className="wiersz-kolejki-pasek"
                style={{ background: kolorPaskaTerminuPortal(s.termin) }}
                aria-hidden="true"
              />
              <td>{s.spolka_nazwa}</td>
              <td>{s.typ_nazwa}</td>
              <td>{fmt.dataCzas(s.data_wplywu)}</td>
              <td><Znacznik odmiana={ZNACZNIK_STANU[s.stan] || 'neutralny'}>{s.stan}</Znacznik></td>
              <td className="przyciemnione">
                {s.stan === 'wpisana' || s.stan === 'odmowa' || s.stan === 'anulowana'
                  ? '—'
                  : s.termin && s.termin.dni_pozostale != null ? `${s.termin.dni_pozostale} dni` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Karta>
  );
}

/* ─────────────────────────────────────────────────────
   INFORMACJA Z REJESTRU
   ───────────────────────────────────────────────────── */
/**
 * Informacja z rejestru (art. 300(35) KSH) — ODPŁATNA.
 *
 * Kolejność jest odwrotna niż dotąd: najpierw zamówienie i zapłata, dopiero
 * potem dokument. Informacja nie jest ustawowym obowiązkiem z terminem
 * (tym jest wpis), więc nie ma powodu wydawać jej „na kredyt”.
 */
function EkranInformacjaPortal({ spolkaId }) {
  const [data, ustawData] = useState(fmt.dzisIso());
  const [pracuje, ustawPracuje] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [gotowa, ustawGotowa] = useState(null);
  const { dane: cennik } = useDane('/api/psa/portal/cennik');

  async function zamow() {
    ustawPracuje(true);
    ustawBlad(null);
    ustawGotowa(null);
    // Karta otwiera się w obsłudze kliknięcia, nie po `await`.
    const okno = window.open('', '_blank');
    try {
      const wynik = await API.post('/api/psa/portal/informacja/zamow', { spolka_id: spolkaId });
      if (wynik.oplacona) {
        // Opłacone, a jeszcze niepobrane zamówienie czeka — wydajemy od razu.
        const dokument = await API.post(`/api/psa/portal/informacja/${wynik.oplata_id}/wydaj`, { data });
        const adres = `/api/psa/portal/informacja/${dokument.dokument_id}`;
        ustawGotowa({ rodzaj: 'dokument', adres });
        if (okno && !okno.closed) okno.location = adres;
        return;
      }
      if (wynik.link) {
        ustawGotowa({ rodzaj: 'platnosc', adres: wynik.link, oplata_id: wynik.oplata_id });
        if (okno && !okno.closed) okno.location = wynik.link;
        return;
      }
      if (okno && !okno.closed) okno.close();
      ustawGotowa({ rodzaj: 'faktura', oplata_id: wynik.oplata_id });
    } catch (e) {
      if (okno && !okno.closed) okno.close();
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zamówić informacji.');
    } finally {
      ustawPracuje(false);
    }
  }

  const stawka = cennik && cennik.stawki ? cennik.stawki.informacja : null;

  return (
    <div className="pion" style={{ gap: 16 }}>
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => idz('/')}>← Wróć</button>
      <Karta tytul="Informacja z rejestru">
        <div className="podstawa-prawna" style={{ marginBottom: 16 }}>
          Art. 300(35) Kodeksu spółek handlowych — informacja z rejestru akcjonariuszy na wskazany dzień,
          w zakresie odpowiadającym roli konta.
        </div>
        <Komunikat odmiana="blad" tresc={blad} />

        <Pole etykieta="Stan na dzień" wymagane>
          <PoleDaty wartosc={data} przyZmianie={(v) => v && ustawData(v)} />
        </Pole>

        {stawka != null && (
          <Komunikat
            odmiana="info"
            tresc={`Informacja z rejestru jest odpłatna — ${fmt.zlote(stawka)}. Dokument pobierzesz po opłaceniu.`}
          />
        )}

        <button className="btn btn-glowny" onClick={zamow} disabled={pracuje}>
          {pracuje ? 'Przygotowywanie…' : 'Zamów informację'}
        </button>

        {gotowa && gotowa.rodzaj === 'platnosc' && (
          <>
            <Komunikat
              odmiana="ok"
              tytul="Zamówienie zapisane"
              tresc="Formularz płatności otworzyliśmy w nowej karcie. Po zapłacie informacja czeka do pobrania w zakładce „Płatności”."
            />
            <div className="row-g">
              <a className="btn btn-glowny" href={gotowa.adres} target="_blank" rel="noopener">Otwórz płatność</a>
              <button className="btn" onClick={() => idz('/platnosci')}>Przejdź do płatności</button>
            </div>
          </>
        )}
        {gotowa && gotowa.rodzaj === 'dokument' && (
          <>
            <Komunikat odmiana="ok" tytul="Informacja gotowa" tresc="Otworzyliśmy ją w nowej karcie." />
            <a className="btn btn-glowny" href={gotowa.adres} target="_blank" rel="noopener">Otwórz informację</a>
          </>
        )}
        {gotowa && gotowa.rodzaj === 'faktura' && (
          <Komunikat
            odmiana="info"
            tytul="Zamówienie zapisane"
            tresc="Płatności online są chwilowo niedostępne — kancelaria rozliczy tę informację fakturą i udostępni dokument."
          />
        )}
      </Karta>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   PŁATNOŚCI
   ───────────────────────────────────────────────────── */

const OPIS_STATUSU_OPLATY = {
  naliczona: { odmiana: undefined, tekst: 'do zapłaty' },
  zafakturowana: { odmiana: 'oliwka', tekst: 'na fakturze' },
  oplacona: { odmiana: 'zielony', tekst: 'opłacona' },
};

/**
 * Należności klienta. Trzy rzeczy, które ten ekran musi powiedzieć:
 * ile jest do zapłaty, za co, i gdzie kliknąć, żeby zapłacić.
 */
function EkranPlatnosciPortal() {
  const { dane, ladowanie, blad, odswiez } = useDane('/api/psa/portal/oplaty');
  const [wysylanie, ustawWysylanie] = useState(null);
  const [bladPlatnosci, ustawBladPlatnosci] = useState(null);

  if (ladowanie) return <Spinner />;
  if (blad) return <Komunikat odmiana="blad" tresc={blad.message} />;

  const doZaplaty = dane.oplaty.filter((o) => o.status !== 'oplacona');
  const zaplacone = dane.oplaty.filter((o) => o.status === 'oplacona');

  async function zaplac(oplata) {
    ustawWysylanie(oplata.id);
    ustawBladPlatnosci(null);
    // Nowa karta otwiera się TERAZ, w obsłudze kliknięcia — po `await`
    // przeglądarka blokuje ją jak wyskakujące okienko.
    const okno = window.open('', '_blank');
    try {
      const wynik = await API.post(`/api/psa/portal/oplaty/${oplata.id}/zaplac`, {});
      if (okno && !okno.closed) okno.location = wynik.link;
    } catch (e) {
      if (okno && !okno.closed) okno.close();
      ustawBladPlatnosci(e instanceof BladApi ? e.message : 'Nie udało się rozpocząć płatności.');
    } finally {
      ustawWysylanie(null);
    }
  }

  async function pobierzInformacje(oplata) {
    ustawWysylanie(oplata.id);
    ustawBladPlatnosci(null);
    const okno = window.open('', '_blank');
    try {
      const wynik = await API.post(`/api/psa/portal/informacja/${oplata.id}/wydaj`, {});
      if (okno && !okno.closed) okno.location = `/api/psa/portal/informacja/${wynik.dokument_id}`;
      odswiez();
    } catch (e) {
      if (okno && !okno.closed) okno.close();
      ustawBladPlatnosci(e instanceof BladApi ? e.message : 'Nie udało się pobrać informacji.');
    } finally {
      ustawWysylanie(null);
    }
  }

  function wiersz(o) {
    const status = OPIS_STATUSU_OPLATY[o.status] || { tekst: o.status };
    return (
      <div key={o.id} className="pozycja-platnosci">
        <div style={{ minWidth: 0 }}>
          <div className="pozycja-platnosci-tytul">{o.opis}</div>
          <div className="pozycja-platnosci-opis">
            {o.spolka_nazwa}
            {o.okres_od && o.okres_do ? ` · ${fmt.data(o.okres_od)} – ${fmt.data(o.okres_do)}` : ''}
            {` · naliczono ${fmt.data(o.data_naliczenia)}`}
          </div>
        </div>
        <div className="pozycja-platnosci-kwota">{fmt.zlote(o.kwota_grosze)}</div>
        <Znacznik odmiana={status.odmiana}>{status.tekst}</Znacznik>
        <div className="pozycja-platnosci-akcja">
          {o.status !== 'oplacona' && dane.platnosci_wlaczone && (
            <button className="btn btn-glowny btn-maly" disabled={wysylanie === o.id} onClick={() => zaplac(o)}>
              {wysylanie === o.id ? 'Otwieram…' : 'Zapłać'}
            </button>
          )}
          {o.do_pobrania && (
            <button className="btn btn-maly" disabled={wysylanie === o.id} onClick={() => pobierzInformacje(o)}>
              Pobierz informację
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pion" style={{ gap: 16 }}>
      <Komunikat odmiana="blad" tresc={bladPlatnosci} />

      {!dane.platnosci_wlaczone && doZaplaty.length > 0 && (
        <Komunikat
          odmiana="info"
          tresc="Płatności online są chwilowo niedostępne — należności rozliczy faktura z kancelarii."
        />
      )}

      <Karta tytul="Do zapłaty">
        {doZaplaty.length === 0 ? (
          <Pusto ikona="oplaty" tytul="Nic nie czeka na zapłatę" opis="Wszystkie należności są rozliczone." />
        ) : (
          <div className="lista-platnosci">
            <div className="suma-platnosci">
              <span>Razem</span>
              <strong>{fmt.zlote(dane.do_zaplaty_grosze)}</strong>
            </div>
            {doZaplaty.map(wiersz)}
          </div>
        )}
      </Karta>

      {zaplacone.length > 0 && (
        <Karta tytul="Opłacone">
          <div className="lista-platnosci">{zaplacone.map(wiersz)}</div>
        </Karta>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   APLIKACJA
   ───────────────────────────────────────────────────── */
function AplikacjaPortal() {
  const trasa = useTrasa();
  const { segmenty, sciezka } = trasa;

  // Regulamin i polityka prywatności — odnośniki do nich stoją w stopce,
  // którą widać także pod ekranem logowania, więc muszą działać bez sesji.
  const dokumentPrawny = ekranPrawny(segmenty);
  if (dokumentPrawny) return <StronaPrawna>{dokumentPrawny}</StronaPrawna>;

  // Etap 3A/3B: jedyne trasy publiczne portalu — MUSZĄ wyprzedzić bramkę
  // sesji poniżej, inaczej niezalogowany gość zawsze wyląduje na ekranie
  // logowania (konto z aktywacji NIE MA jeszcze ważnej sesji w tym momencie).
  if (segmenty[0] === 'zglos-sie') {
    return (
      <RamaPubliczna
        opis={
          <OpisPortalu
            tytul="Powierz nam rejestr akcjonariuszy"
            lead="Rejestr akcjonariuszy prostej spółki akcyjnej prowadzi notariusz na podstawie umowy ze spółką (art. 300³¹ § 1 KSH). Zostaw kontakt — odezwiemy się z propozycją dalszych kroków."
            punkty={PUNKTY_ZGLOSZENIA}
          />
        }
      >
        <EkranZgloszenieWstepne />
      </RamaPubliczna>
    );
  }
  if (segmenty[0] === 'aktywuj' && segmenty[1]) {
    return (
      <RamaPubliczna
        opis={
          <OpisPortalu
            tytul="Ustaw hasło do portalu"
            lead="Konto zostało założone przez kancelarię. Ustaw hasło, a przejdziesz prosto do wniosku o prowadzenie rejestru akcjonariuszy."
            punkty={PUNKTY_LOGOWANIA}
          />
        }
      >
        <EkranAktywacjaKonta token={segmenty[1]} />
      </RamaPubliczna>
    );
  }

  return <AplikacjaPortalZSesja segmenty={segmenty} sciezka={sciezka} />;
}

/** Adresy, pod którymi zalogowane konto ma co zobaczyć (pusty = strona główna). */
const EKRANY_KONTA = ['', 'wniosek', 'sprawy', 'rejestr', 'zgloszenie', 'informacja'];

function AplikacjaPortalZSesja({ segmenty, sciezka }) {
  const sesja = usePortalSesja();

  if (sesja.ladowanie) return <Spinner />;
  if (!sesja.zalogowany) {
    return (
      <RamaPubliczna
        opis={
          <OpisPortalu
            tytul="Rejestr akcjonariuszy Prostej Spółki Akcyjnej pod ręką"
            lead="Portal daje spółce i akcjonariuszom wgląd w rejestr prowadzony przez kancelarię oraz drogę do zgłaszania zmian — bez wizyty i bez papierowej korespondencji."
            punkty={PUNKTY_LOGOWANIA}
          />
        }
      >
        {/* Po zalogowaniu adres zostawał taki, jaki był — a ekran logowania
            pokazuje się pod KAŻDYM adresem, więc klient, który wszedł na
            `#/logowanie` (naturalny odruch, bywa też w zakładkach), po
            poprawnym haśle dostawał „Nie ma takiej strony". Wracamy tam,
            skąd wyrzuciła nas wygasła sesja, a spod nieznanego adresu — na
            stronę główną. */}
        <EkranLoginPortal
          przyZalogowaniu={() => {
            if (!EKRANY_KONTA.includes(segmenty[0] || '')) idz('/');
            sesja.odswiez();
          }}
        />
      </RamaPubliczna>
    );
  }

  function ekran() {
    // Etap 3B: konto zaproszone (rola 'wnioskodawca'), zanim zobaczy
    // formularz wniosku (etap 3C), musi potwierdzić klauzulę RODO (3B.1).
    if (sesja.konto.rola === 'wnioskodawca' && !sesja.konto.rodo_zaakceptowano) {
      return <EkranKlauzulaRodo przyAkceptacji={() => sesja.odswiez()} />;
    }
    // Wnioskodawca dostawał tu formularz wniosku BEZ WZGLĘDU na adres, więc
    // „Moje spółki" i „Moje zgłoszenia" zmieniały adres, a ekran zostawał
    // ten sam — przyciski wyglądały na zepsute. Teraz nawigacja działa dla
    // każdej roli, a formularz ma własny adres.
    // Formularz wniosku należy WYŁĄCZNIE do konta wnioskodawcy. Po przyjęciu
    // wniosku konto przechodzi w rolę „spolka" i ekran nie ma już czego
    // pokazać — pod tym adresem zostawałby martwy kreator z zamkniętą edycją.
    if (segmenty[0] === 'wniosek') {
      return sesja.konto.rola === 'wnioskodawca' ? <EkranWniosku /> : <EkranMoje />;
    }
    if (segmenty.length === 0) return <EkranMoje />;
    if (segmenty[0] === 'sprawy') return <EkranSprawyPortal />;
    if (segmenty[0] === 'rejestr' && segmenty[1]) return <EkranRejestrPortal spolkaId={Number(segmenty[1])} />;
    if (segmenty[0] === 'zgloszenie' && segmenty[1]) return <EkranZgloszeniePortal spolkaId={Number(segmenty[1])} />;
    if (segmenty[0] === 'informacja' && segmenty[1]) return <EkranInformacjaPortal spolkaId={Number(segmenty[1])} />;
    if (segmenty[0] === 'platnosci') return <EkranPlatnosciPortal />;
    return (
      <Karta>
        <Pusto tytul="Nie ma takiej strony" akcja={<button className="btn btn-glowny" onClick={() => idz('/')}>Wróć</button>} />
      </Karta>
    );
  }

  // Te same proporcje treści co w aplikacji kancelaryjnej (faza 3.2/3.3):
  // formularze (zgłoszenie, informacja) węższe niż listy/rejestr.
  // Wąska miara tam, gdzie ekran niesie jedną kartę albo jeden formularz.
  // Podgląd rejestru i lista zgłoszeń zostają szerokie — mają tabele.
  const waski = ['zgloszenie', 'informacja', undefined].includes(segmenty[0]);

  return (
    <PortalLayout
      sciezka={sciezka === '/' ? '/' : `/${segmenty[0]}`}
      waski={waski}
      konto={sesja.konto}
      przyWylogowaniu={() => sesja.odswiez()}
    >
      {ekran()}
    </PortalLayout>
  );
}

ReactDOM.createRoot(document.getElementById('korzen')).render(<AplikacjaPortal />);
