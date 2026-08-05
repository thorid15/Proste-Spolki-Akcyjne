/* uzytkownicy.js — zarządzanie kontami pracowników kancelarii (tylko admin). */

function ModalNowyUzytkownik({ przyZamknieciu, przyZapisie }) {
  const [dane, ustawDane] = useState({ imie: '', email: '', rola: 'pracownik', haslo: '' });
  const [blad, ustawBlad] = useState(null);
  const [zapisywanie, ustawZapisywanie] = useState(false);

  const pole = (klucz) => ({
    value: dane[klucz] ?? '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
  });

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post('/api/psa/auth/uzytkownicy', dane);
      przyZapisie(wynik);
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawZapisywanie(false);
    }
  }

  return (
    <Modal
      tytul="Nowy pracownik"
      przyZamknieciu={przyZamknieciu}
      szerokosc={480}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button className="btn btn-primary" onClick={zapisz} disabled={zapisywanie || !dane.imie.trim() || !dane.email.trim()}>
            {zapisywanie ? 'Zapisywanie…' : 'Utwórz konto'}
          </button>
        </>
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />
      <Pole etykieta="Imię i nazwisko" wymagane>
        <input type="text" autoFocus {...pole('imie')} />
      </Pole>
      <Pole etykieta="E-mail" wymagane>
        <input type="email" {...pole('email')} />
      </Pole>
      <Pole etykieta="Rola" wymagane>
        <select {...pole('rola')}>
          <option value="pracownik">Pracownik</option>
          <option value="admin">Administrator</option>
        </select>
      </Pole>
      <Pole
        etykieta="Hasło początkowe"
        podpowiedz="Zostaw puste, aby wygenerować losowe hasło tymczasowe — pokażemy je raz, zaraz po utworzeniu konta."
      >
        <input type="text" {...pole('haslo')} placeholder="(wygeneruj automatycznie)" />
      </Pole>
    </Modal>
  );
}

function ModalHasloTymczasowe({ email, haslo, przyZamknieciu }) {
  return (
    <Modal tytul="Hasło tymczasowe" przyZamknieciu={przyZamknieciu} szerokosc={460}
      stopka={<button className="btn btn-primary" onClick={przyZamknieciu}>Zamknij</button>}>
      <Komunikat
        odmiana="uwaga"
        tresc={`Przekaż to hasło osobie na adres ${email} bezpiecznym kanałem — nie zostanie ponownie pokazane.`}
      />
      <div className="mono" style={{ fontSize: 18, fontWeight: 600, padding: '14px 0', textAlign: 'center' }}>
        {haslo}
      </div>
    </Modal>
  );
}

function EkranUzytkownikow() {
  const { dane, ladowanie, odswiez } = useDane('/api/psa/auth/uzytkownicy');
  const [modalNowy, ustawModalNowy] = useState(false);
  const [hasloDoPokazania, ustawHasloDoPokazania] = useState(null);
  const [blad, ustawBlad] = useState(null);

  async function przelacz(u, pole, wartosc) {
    ustawBlad(null);
    try {
      await API.patch(`/api/psa/auth/uzytkownicy/${u.id}`, { [pole]: wartosc });
      odswiez();
    } catch (e) {
      ustawBlad(e.message);
    }
  }

  async function resetujHaslo(u) {
    ustawBlad(null);
    try {
      const wynik = await API.post(`/api/psa/auth/uzytkownicy/${u.id}/reset-hasla`);
      ustawHasloDoPokazania({ email: u.email, haslo: wynik.haslo_tymczasowe });
    } catch (e) {
      ustawBlad(e.message);
    }
  }

  if (ladowanie) return <Spinner />;
  if (!dane) return null;

  return (
    <>
      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">Użytkownicy</div>
          <div className="podtytul-strony">Konta pracowników kancelarii — logowanie e-mailem i hasłem.</div>
        </div>
        <button className="btn btn-primary" onClick={() => ustawModalNowy(true)}>+ Nowy pracownik</button>
      </div>

      <Komunikat odmiana="blad" tresc={blad} />

      <Karta tight>
        <table className="tbl">
          <thead>
            <tr>
              <th>Imię i nazwisko</th>
              <th>E-mail</th>
              <th>Rola</th>
              <th>Ostatnie logowanie</th>
              <th>Stan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dane.uzytkownicy.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.imie}</td>
                <td className="przyciemnione">{u.email}</td>
                <td>
                  <select value={u.rola} onChange={(z) => przelacz(u, 'rola', z.target.value)}>
                    <option value="pracownik">Pracownik</option>
                    <option value="admin">Administrator</option>
                  </select>
                </td>
                <td className="przyciemnione">{u.ostatnie_logowanie ? fmt.dataCzas(u.ostatnie_logowanie) : '— nigdy —'}</td>
                <td>
                  <Znacznik odmiana={u.aktywny ? 'zielony' : 'neutralny'}>{u.aktywny ? 'aktywny' : 'zablokowany'}</Znacznik>
                </td>
                <td>
                  <div className="row-g">
                    <button className="btn btn-sm" onClick={() => resetujHaslo(u)}>Resetuj hasło</button>
                    <button className="btn btn-sm" onClick={() => przelacz(u, 'aktywny', !u.aktywny)}>
                      {u.aktywny ? 'Zablokuj' : 'Odblokuj'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Karta>

      {modalNowy && (
        <ModalNowyUzytkownik
          przyZamknieciu={() => ustawModalNowy(false)}
          przyZapisie={(wynik) => {
            ustawModalNowy(false);
            odswiez();
            if (wynik.haslo_tymczasowe) {
              ustawHasloDoPokazania({ email: wynik.uzytkownik.email, haslo: wynik.haslo_tymczasowe });
            }
          }}
        />
      )}

      {hasloDoPokazania && (
        <ModalHasloTymczasowe
          email={hasloDoPokazania.email}
          haslo={hasloDoPokazania.haslo}
          przyZamknieciu={() => ustawHasloDoPokazania(null)}
        />
      )}
    </>
  );
}

window.EkranUzytkownikow = EkranUzytkownikow;
