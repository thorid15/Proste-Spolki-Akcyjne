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

function skrocAdresWww(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Stopka portalu — kto prowadzi rejestr i gdzie o tym poczytać. */
function StopkaPortalu() {
  const k = useKancelaria();
  const adres = [k.adres, k.miejscowosc].filter(Boolean).join(', ');
  const kontakt = [k.telefon, k.email].filter(Boolean).join(' · ');
  const link = k.www_psa || k.www;
  return (
    <footer className="stopka bez-druku">
      <div className="stopka-kolumna">
        <div className="stopka-nazwa">{k.nazwa}</div>
        {adres && <div className="stopka-linia">{adres}</div>}
        {kontakt && <div className="stopka-linia">{kontakt}</div>}
      </div>
      <div className="stopka-kolumna">
        <div className="stopka-etykieta">Podstawa prowadzenia rejestru</div>
        <div className="stopka-linia">art. 300<sup>31</sup> § 1 Kodeksu spółek handlowych</div>
      </div>
      {link && (
        <div className="stopka-kolumna stopka-kolumna-link">
          <div className="stopka-etykieta">Proste Spółki Akcyjne</div>
          <a className="stopka-link" href={link} target="_blank" rel="noopener noreferrer">
            {skrocAdresWww(link)}
          </a>
        </div>
      )}
    </footer>
  );
}

/** Pasek marki — wspólny dla ekranów publicznych i zalogowanych. */
function PasekMarkiPortal() {
  const k = useKancelaria();
  return (
    <div className="marka-pasek bez-druku">
      <div className="marka-pasek-nazwa">{k.nazwa}</div>
    </div>
  );
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
  return (
    <div className="pion" style={{ minHeight: '100vh' }}>
      <PasekMarkiPortal />
      <div className="brama">
        {opis}
        <div className="brama-karta">{children}</div>
      </div>
      <StopkaPortalu />
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
    tresc: 'Dokument wystawiany na wskazany dzień — art. 300³⁵ KSH.',
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
        <button
          type="button"
          className="btn btn-akcent btn-duzy"
          onClick={() => idz('/zglos-sie')}
          style={{ width: '100%' }}
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
      await API.post('/api/psa/portal/zgloszenia', {
        email: email.trim(),
        krs: krsCyfry,
        nazwa_spolki: nazwaSpolki.trim() || undefined,
      });
      ustawGotowe(true);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wysłać zgłoszenia.');
    } finally {
      ustawWysylanie(false);
    }
  }

  if (gotowe) {
    return (
      <Pusto
        ikona="sprawdz"
        tytul="Dziękujemy za zgłoszenie"
        opis="Kancelaria skontaktuje się z Tobą, żeby ustalić szczegóły i przesłać zaproszenie do złożenia właściwego wniosku o prowadzenie rejestru akcjonariuszy."
        akcja={<button className="btn" onClick={() => idz('/')}>Wróć do logowania</button>}
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
      <div className="pion" style={{ gap: 14 }}>
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
/* Wnioskodawca nie ma jeszcze spółki w rejestrze — jego zakładka „Moje
   spółki" pokazuje stan wniosku (`StanWniosku`), a sam formularz dostaje
   własną pozycję, bo do przyjęcia wniosku to jego główny ekran. */
function kartyNawigacji(rola) {
  const karty = [
    { sciezka: '/', nazwa: 'Moje spółki' },
    { sciezka: '/sprawy', nazwa: 'Moje zgłoszenia' },
  ];
  if (rola === 'wnioskodawca') karty.splice(1, 0, { sciezka: '/wniosek', nazwa: 'Wniosek' });
  return karty;
}

const ETYKIETA_ROLI_KONTA = {
  spolka: 'konto spółki',
  akcjonariusz: 'konto akcjonariusza',
  // Etap 3B: zaproszone, ale wniosek jeszcze nie zlozony/przyjety.
  wnioskodawca: 'konto wnioskodawcy',
};

function PortalLayout({ sciezka, waski, konto, przyWylogowaniu, children }) {
  const [wylogowywanie, ustawWylogowywanie] = useState(false);

  async function wyloguj() {
    ustawWylogowywanie(true);
    try {
      await API.post('/api/psa/portal/logout');
    } finally {
      przyWylogowaniu();
    }
  }

  return (
    <div className="pion" style={{ minHeight: '100vh' }}>
      <PasekMarkiPortal />
      <header className="portal-topbar pasek-gorny bez-druku" style={{ padding: '14px 28px' }}>
        <div>
          <div className="tytul-strony" style={{ fontSize: 17 }}>Rejestr akcjonariuszy P.S.A.</div>
          <div className="podpowiedz">{konto.email} · {ETYKIETA_ROLI_KONTA[konto.rola] || konto.rola}</div>
        </div>
        <div className="row-g">
          {kartyNawigacji(konto.rola).map((k) => (
            <button
              key={k.sciezka}
              className={`btn btn-sm ${sciezka === k.sciezka ? 'btn-glowny' : ''}`}
              onClick={() => idz(k.sciezka)}
            >
              {k.nazwa}
            </button>
          ))}
          <button className="btn btn-sm" onClick={wyloguj} disabled={wylogowywanie}>Wyloguj się</button>
        </div>
      </header>
      <main className={`tresc ${waski ? 'tresc-waska' : ''}`}>{children}</main>
      <StopkaPortalu />
    </div>
  );
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
    tytul: 'Trwa rejestracja spółki w systemie',
    tresc: 'Wniosek został złożony. Przygotowujemy komplet dokumentów do podpisu.',
  },
  umowa_wygenerowana: {
    odmiana: 'uwaga',
    tytul: 'Czekamy na podpisane dokumenty',
    tresc: 'Komplet dokumentów jest gotowy do pobrania. Podpisz je i odeślij podpisaną umowę w formularzu wniosku.',
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
  if (!wniosek) {
    return (
      <Pusto
        tytul="Nie rozpoczęto jeszcze wniosku"
        opis="Aby spółka trafiła do rejestru, wypełnij wniosek o prowadzenie rejestru akcjonariuszy."
        akcja={<button className="btn btn-glowny" onClick={() => idz('/wniosek')}>Wypełnij wniosek</button>}
      />
    );
  }

  const stan = STANY_WNIOSKU_KLIENTA[wniosek.status] || {
    odmiana: 'info',
    tytul: 'Wniosek w toku',
    tresc: 'Sprawa jest w toku po stronie kancelarii.',
  };

  return (
    <div className="pion" style={{ gap: 16 }}>
      <Karta tytul={wniosek.nazwa || 'Wniosek o prowadzenie rejestru'}>
        {wniosek.krs && <div className="podpowiedz" style={{ marginBottom: 14 }}>KRS {wniosek.krs}</div>}
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
              <div className="pion" style={{ gap: 6, marginBottom: 14 }}>
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
            {s.krs && <div className="podpowiedz" style={{ marginBottom: 14 }}>KRS {s.krs}</div>}
            <div className="row-g">
              <button className="btn" onClick={() => idz(`/rejestr/${spolkaId}`)}>Podgląd rejestru</button>
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
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => idz('/')}>← Moje spółki</button>

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
function EkranZgloszeniePortal({ spolkaId }) {
  const { dane: meta, ladowanie: metaLadowanie } = useDane('/api/psa/meta');
  const [typ, ustawTyp] = useState('');
  const [opis, ustawOpis] = useState('');
  const [pliki, ustawPliki] = useState([]);
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [gotowe, ustawGotowe] = useState(false);

  if (metaLadowanie) return <Spinner />;
  if (!meta) return null;

  const typyDostepne = meta.typy_zdarzen.filter((t) => meta.typy_w_kreatorze.includes(t.kod) && !t.z_urzedu);

  async function zglos() {
    if (!typ || !opis.trim()) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post('/api/psa/portal/zadania', { spolka_id: spolkaId, typ_zdarzenia: typ, opis: opis.trim() });
      if (pliki.length > 0) {
        const formularz = new FormData();
        formularz.append('typ_dokumentu', 'inny');
        for (const plik of pliki) formularz.append('pliki', plik);
        await fetch(`/api/psa/portal/zadania/${wynik.sprawa.id}/dokumenty`, { method: 'POST', body: formularz });
      }
      ustawGotowe(true);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się złożyć zgłoszenia.');
    } finally {
      ustawWysylanie(false);
    }
  }

  if (gotowe) {
    return (
      <Karta>
        <Pusto
          tytul="Zgłoszenie przyjęte"
          opis="Kancelaria rozpatrzy je i skontaktuje się w razie potrzeby uzupełnienia dokumentów. Status widoczny jest w zakładce „Moje zgłoszenia”."
          akcja={<button className="btn btn-glowny" onClick={() => idz('/sprawy')}>Zobacz moje zgłoszenia</button>}
        />
      </Karta>
    );
  }

  return (
    <div className="pion" style={{ gap: 16 }}>
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => idz('/')}>← Moje spółki</button>
      <Karta tytul="Zgłoś zmianę w rejestrze">
        <Komunikat odmiana="blad" tresc={blad} />
        <Pole etykieta="Czego dotyczy zgłoszenie" wymagane>
          <select value={typ} onChange={(z) => ustawTyp(z.target.value)}>
            <option value="">— wybierz —</option>
            {typyDostepne.map((t) => (
              <option key={t.kod} value={t.kod}>{t.nazwa}</option>
            ))}
          </select>
        </Pole>
        <Pole etykieta="Opis zgłoszenia" wymagane podpowiedz="Opisz, co się wydarzyło — kancelaria przygotuje wpis na tej podstawie i skontaktuje się w razie pytań.">
          <textarea rows={4} value={opis} onChange={(z) => ustawOpis(z.target.value)} />
        </Pole>
        <Pole etykieta="Dokumenty" podpowiedz="PDF, JPG, PNG, DOC/DOCX — maks. 20 MB na plik.">
          <input type="file" multiple onChange={(z) => ustawPliki([...z.target.files])} />
        </Pole>
        <button
          className="btn btn-glowny"
          disabled={wysylanie || !typ || !opis.trim()}
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
function EkranInformacjaPortal({ spolkaId }) {
  const [data, ustawData] = useState(fmt.dzisIso());
  const [pobieranie, ustawPobieranie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function pobierz() {
    ustawPobieranie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post('/api/psa/portal/informacja', { spolka_id: spolkaId, data });
      const blob = new Blob([wynik.tresc_html], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się przygotować informacji.');
    } finally {
      ustawPobieranie(false);
    }
  }

  return (
    <div className="pion" style={{ gap: 16 }}>
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => idz('/')}>← Moje spółki</button>
      <Karta tytul="Informacja z rejestru" >
        <div className="podstawa-prawna" style={{ marginBottom: 14 }}>
          Art. 300(35) Kodeksu spółek handlowych — informacja z rejestru akcjonariuszy na wskazany dzień,
          w zakresie odpowiadającym roli konta.
        </div>
        <Komunikat odmiana="blad" tresc={blad} />
        <Pole etykieta="Stan na dzień" wymagane>
          <PoleDaty wartosc={data} przyZmianie={(v) => v && ustawData(v)} />
        </Pole>
        <button className="btn btn-glowny" onClick={pobierz} disabled={pobieranie}>
          {pobieranie ? 'Przygotowywanie…' : 'Otwórz informację'}
        </button>
      </Karta>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   APLIKACJA
   ───────────────────────────────────────────────────── */
function AplikacjaPortal() {
  const trasa = useTrasa();
  const { segmenty, sciezka } = trasa;

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

function AplikacjaPortalZSesja({ segmenty, sciezka }) {
  const sesja = usePortalSesja();

  if (sesja.ladowanie) return <Spinner />;
  if (!sesja.zalogowany) {
    return (
      <RamaPubliczna
        opis={
          <OpisPortalu
            tytul="Rejestr akcjonariuszy pod ręką"
            lead="Portal daje spółce i akcjonariuszom wgląd w rejestr prowadzony przez kancelarię oraz drogę do zgłaszania zmian — bez wizyty i bez papierowej korespondencji."
            punkty={PUNKTY_LOGOWANIA}
          />
        }
      >
        <EkranLoginPortal przyZalogowaniu={() => sesja.odswiez()} />
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
    if (segmenty[0] === 'wniosek') return <EkranWniosku />;
    if (segmenty.length === 0) return <EkranMoje />;
    if (segmenty[0] === 'sprawy') return <EkranSprawyPortal />;
    if (segmenty[0] === 'rejestr' && segmenty[1]) return <EkranRejestrPortal spolkaId={Number(segmenty[1])} />;
    if (segmenty[0] === 'zgloszenie' && segmenty[1]) return <EkranZgloszeniePortal spolkaId={Number(segmenty[1])} />;
    if (segmenty[0] === 'informacja' && segmenty[1]) return <EkranInformacjaPortal spolkaId={Number(segmenty[1])} />;
    return (
      <Karta>
        <Pusto tytul="Nie ma takiej strony" akcja={<button className="btn btn-glowny" onClick={() => idz('/')}>Wróć</button>} />
      </Karta>
    );
  }

  // Te same proporcje treści co w aplikacji kancelaryjnej (faza 3.2/3.3):
  // formularze (zgłoszenie, informacja) węższe niż listy/rejestr.
  const waski = segmenty[0] === 'zgloszenie' || segmenty[0] === 'informacja';

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
