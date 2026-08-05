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

function EkranLogowania({ przyZalogowaniu }) {
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
    <div className="ekran-logowania">
      <form className="card" style={{ width: 380, maxWidth: '92vw' }} onSubmit={zaloguj}>
        <div className="card-h" style={{ marginBottom: 4 }}>Rejestr akcjonariuszy P.S.A.</div>
        <div className="podtytul-strony" style={{ marginBottom: 22 }}>
          Kancelaria Notarialna Łukasza Kozona
        </div>

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
          className="btn btn-primary"
          type="submit"
          disabled={wysylanie || !email.trim() || !haslo}
          style={{ width: '100%', marginTop: 8 }}
        >
          {wysylanie ? 'Logowanie…' : 'Zaloguj się'}
        </button>
      </form>
    </div>
  );
}

window.useSesja = useSesja;
window.EkranLogowania = EkranLogowania;
