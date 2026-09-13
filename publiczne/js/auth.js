/* auth.js — sesja pracownika kancelarii (sprint 3).

   Zastępuje sprintu-1 „ustaw imię" nagłówkiem X-User-Name: logowanie
   e-mail + hasło, sesja w httpOnly cookie. Ekran logowania blokuje całą
   aplikację, dopóki sesja nie jest znana (patrz app.js). */

function useSesja() {
  const [stan, ustawStan] = useState({ ladowanie: true, zalogowany: false, uzytkownik: null });

  const odswiez = useCallback(() => {
    return API.get('/api/psa/auth/whoami')
      .then((d) => ustawStan({ ladowanie: false, zalogowany: d.zalogowany, uzytkownik: d.uzytkownik }))
      .catch(() => ustawStan({ ladowanie: false, zalogowany: false, uzytkownik: null }));
  }, []);

  useEffect(() => {
    odswiez();
  }, [odswiez]);

  return { ...stan, odswiez };
}

const PUNKTY_KANCELARII = [
  {
    ikona: 'zdarzenie',
    tytul: 'Rejestr, którego nie da się cofnąć',
    tresc: 'Każde zdarzenie niesie skrót poprzedniego — art. 300³¹ § 4 KSH.',
  },
  {
    ikona: 'zegar',
    tytul: 'Terminy pod kontrolą',
    tresc: 'Cel wewnętrzny 3 dni przy siedmiodniowym terminie ustawowym.',
  },
  {
    ikona: 'dokument',
    tytul: 'Pisma z wzorów kancelarii',
    tresc: 'Zawiadomienia i wezwania wypełniane danymi z rejestru.',
  },
];

function EkranLogowania({ przyZalogowaniu }) {
  const { dane: daneKancelarii } = useDane('/api/wspolne/kancelaria');
  const kancelaria = daneKancelarii && daneKancelarii.kancelaria;
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
      const odpowiedz = await API.post('/api/psa/auth/login', { email: email.trim(), haslo });
      przyZalogowaniu(odpowiedz.uzytkownik);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zalogować.');
    } finally {
      ustawWysylanie(false);
    }
  }

  return (
    <div className="pion" style={{ minHeight: '100vh' }}>
      <div className="marka-pasek bez-druku">
        <div className="marka-pasek-nazwa">{(kancelaria || KANCELARIA_ZAPASOWA).nazwa}</div>
      </div>

      <div className="brama">
        <div className="brama-opis">
          <div className="brama-tytul">Rejestr akcjonariuszy P.S.A.</div>
          <div className="brama-lead">
            Aplikacja kancelarii do prowadzenia rejestrów akcjonariuszy prostych spółek akcyjnych
            na podstawie art. 300<sup>31</sup> § 1 Kodeksu spółek handlowych.
          </div>
          <div className="brama-punkty">
            {PUNKTY_KANCELARII.map((p) => (
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

        <form className="brama-karta" onSubmit={zaloguj}>
          <div className="brama-karta-tytul">Zaloguj się</div>
          <div className="brama-karta-podtytul">Konto pracownika kancelarii</div>

          <Komunikat odmiana="blad" tresc={blad} />

          <Pole etykieta="E-mail" wymagane>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(z) => ustawEmail(z.target.value)}
              autoComplete="username"
            />
          </Pole>
          <Pole etykieta="Hasło" wymagane>
            <input
              type="password"
              value={haslo}
              onChange={(z) => ustawHaslo(z.target.value)}
              autoComplete="current-password"
            />
          </Pole>

          <button
            className="btn btn-glowny btn-duzy"
            type="submit"
            disabled={wysylanie || !email.trim() || !haslo}
            style={{ width: '100%', marginTop: 'var(--od-8)' }}
          >
            {wysylanie ? 'Logowanie…' : 'Zaloguj się'}
          </button>
        </form>
      </div>

      <StopkaKancelarii kancelaria={kancelaria || KANCELARIA_ZAPASOWA} />
    </div>
  );
}

window.useSesja = useSesja;
window.EkranLogowania = EkranLogowania;
