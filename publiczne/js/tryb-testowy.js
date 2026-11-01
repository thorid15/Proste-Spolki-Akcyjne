/* ─────────────────────────────────────────────────────────────
   Tryb testowy (T2, DECYZJE.md D-074) — elementy ekranow logowania.

   `window.PSA_TRYB_TESTOWY` ustawia skrypt /test/konfiguracja.js, ktory
   serwer wstrzykuje WYLACZNIE w trybie testowym. Poza nim oba komponenty
   zwracaja `null` — ekrany wygladaja i dzialaja bez zmian.

   Logowanie z listy wola ZWYKLY endpoint logowania (ten sam token sesji,
   te same uprawnienia i izolacja spolek) — pomija jedynie wpisywanie hasla.
   ───────────────────────────────────────────────────────────── */

function stanTrybuTestowego() {
  return typeof window !== 'undefined' && window.PSA_TRYB_TESTOWY ? window.PSA_TRYB_TESTOWY : null;
}

/** Lista kont testowych pod formularzem logowania — jedno kliknięcie = zalogowanie. */
function KontaTestowe({ aplikacja, przyZalogowaniu }) {
  const stan = stanTrybuTestowego();
  const [blad, ustawBlad] = useState(null);
  const [trwa, ustawTrwa] = useState(null);
  if (!stan) return null;
  const konta = (stan.konta || []).filter((k) => k.aplikacja === aplikacja);
  const endpoint = aplikacja === 'kancelaria' ? '/api/psa/auth/login' : '/api/psa/portal/login';

  async function zaloguj(konto) {
    ustawTrwa(konto.email);
    ustawBlad(null);
    try {
      const odp = await API.post(endpoint, { email: konto.email, haslo: stan.haslo, droga_testowa: 'lista_kont' });
      przyZalogowaniu(odp.uzytkownik || odp.konto);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zalogować.');
    } finally {
      ustawTrwa(null);
    }
  }

  return (
    <div className="konta-testowe" style={{ marginTop: 'var(--od-8)', borderTop: '2px solid #b00020', paddingTop: 'var(--od-4)' }}>
      <div style={{ fontWeight: 600, color: '#b00020' }}>Tryb testowy — konta testowe</div>
      <Komunikat odmiana="blad" tresc={blad} />
      {konta.length === 0 && <div className="przyciemnione">Brak kont — uruchom „npm run test:seed”.</div>}
      {konta.map((k) => (
        <button
          key={k.email}
          type="button"
          className="btn btn-pelny"
          style={{ width: '100%', marginTop: 'var(--od-2)', textAlign: 'left' }}
          disabled={Boolean(trwa)}
          onClick={() => zaloguj(k)}
        >
          {trwa === k.email ? 'Logowanie…' : k.opis}
          <span className="przyciemnione" style={{ display: 'block', fontSize: '0.85em' }}>{k.email}</span>
        </button>
      ))}
    </div>
  );
}

/** „Zaloguj (tryb testowy)” — otwiera ten sam link, który poszedł do skrzynki testowej. */
function PrzyciskLinkuTestowego({ link }) {
  if (!stanTrybuTestowego() || !link) return null;
  return (
    <a className="btn btn-glowny" href={link} style={{ marginLeft: 'var(--od-2)' }}>
      Zaloguj (tryb testowy)
    </a>
  );
}
