/* zgloszenia.js — kolejka zgłoszeń wstępnych z publicznego formularza portalu (etap 3A).
   Wyłącznie lead do oceny: kancelaria odrzuca albo (etap 3B) zaprasza do
   właściwego wniosku o prowadzenie rejestru. */

const ZNACZNIK_STANU_ZGLOSZENIA = { nowe: 'neutralny', zaproszono: 'zielony', odrzucone: 'bordo' };

function EkranZgloszenWstepnych() {
  const [filtrStatus, ustawFiltrStatus] = useState('');
  const { dane, ladowanie, odswiez } = useDane(
    `/api/psa/zgloszenia${filtrStatus ? `?status=${filtrStatus}` : ''}`,
    [filtrStatus]
  );
  const [notatki, ustawNotatki] = useState({});
  const [przetwarzanie, ustawPrzetwarzanie] = useState(null);
  // Zaproszenie, którego nie udało się wysłać mailem — link trzeba przekazać
  // klientowi ręcznie, więc pokazujemy go do skopiowania zamiast gubić.
  const [linkDoPrzekazania, ustawLinkDoPrzekazania] = useState(null);

  async function odrzuc(id) {
    ustawPrzetwarzanie(id);
    try {
      await API.post(`/api/psa/zgloszenia/${id}/odrzuc`, { notatka: notatki[id] || '' });
      odswiez();
    } catch (e) {
      window.alert(e instanceof BladApi ? e.message : 'Nie udało się odrzucić zgłoszenia.');
    } finally {
      ustawPrzetwarzanie(null);
    }
  }

  async function zapros(id) {
    ustawPrzetwarzanie(id);
    try {
      const wynik = await API.post(`/api/psa/zgloszenia/${id}/zapros`, {});
      if (!wynik.email_wyslany) {
        ustawLinkDoPrzekazania({
          email: (zgloszenia.find((z) => z.id === id) || {}).email || '',
          link: wynik.link_aktywacyjny || null,
          powod: wynik.powod || 'brak konfiguracji SMTP',
        });
      }
      odswiez();
    } catch (e) {
      window.alert(e instanceof BladApi ? e.message : 'Nie udało się wysłać zaproszenia.');
    } finally {
      ustawPrzetwarzanie(null);
    }
  }

  const zgloszenia = (dane && dane.zgloszenia) || [];

  return (
    <>
      {linkDoPrzekazania && (
        <ModalLinkAktywacyjny
          dane={linkDoPrzekazania}
          przyZamknieciu={() => ustawLinkDoPrzekazania(null)}
        />
      )}
      <div className="pasek-narzedzi">
        <select value={filtrStatus} onChange={(z) => ustawFiltrStatus(z.target.value)}>
          <option value="">Wszystkie statusy</option>
          <option value="nowe">Nowe</option>
          <option value="zaproszono">Zaproszono</option>
          <option value="odrzucone">Odrzucone</option>
        </select>
      </div>

      {ladowanie ? (
        <Spinner />
      ) : zgloszenia.length === 0 ? (
        <Karta>
          <Pusto
            tytul="Brak zgłoszeń"
            opis="Zgłoszenia trafiają tu z publicznego formularza „Zgłoś zainteresowanie” na portalu klienta."
          />
        </Karta>
      ) : (
        <Karta scisla>
          <table className="tabela">
            <thead>
              <tr>
                <th>Zgłoszono</th>
                <th>E-mail</th>
                <th>Telefon</th>
                <th>KRS</th>
                <th>Nazwa spółki</th>
                <th>Opis</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zgloszenia.map((z) => (
                <tr key={z.id}>
                  <td className="wyciszony">{fmt.dataCzas(z.utworzono)}</td>
                  <td>{z.email}</td>
                  <td>{z.telefon || '—'}</td>
                  <td className="kol-dane">{z.krs || '—'}</td>
                  <td>{z.nazwa_spolki || '—'}</td>
                  <td style={{ maxWidth: 280 }}>{z.opis || '—'}</td>
                  <td><Znacznik odmiana={ZNACZNIK_STANU_ZGLOSZENIA[z.status] || 'neutralny'}>{z.status}</Znacznik></td>
                  <td className="do-prawej">
                    {z.status === 'nowe' && (
                      <div className="row-g" style={{ justifyContent: 'flex-end' }}>
                        <input
                          type="text"
                          placeholder="notatka (opcjonalnie)"
                          style={{ width: 160 }}
                          value={notatki[z.id] || ''}
                          onChange={(e) => ustawNotatki((p) => ({ ...p, [z.id]: e.target.value }))}
                        />
                        <button
                          className="btn btn-maly"
                          disabled={przetwarzanie === z.id}
                          onClick={() => zapros(z.id)}
                        >
                          Zaproś
                        </button>
                        <button
                          className="btn btn-maly btn-sygnal"
                          disabled={przetwarzanie === z.id}
                          onClick={() => odrzuc(z.id)}
                        >
                          Odrzuć
                        </button>
                      </div>
                    )}
                    {z.status === 'odrzucone' && z.notatka_wewnetrzna && (
                      <span className="wyciszony">{z.notatka_wewnetrzna}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Karta>
      )}
    </>
  );
}

/* Konto zostało założone, ale e-mail nie wyszedł. Link aktywacyjny jest
   jednorazowy i ma termin ważności — kancelaria przekazuje go klientowi
   innym kanałem (telefon, e-mail z własnej skrzynki). To także jedyna
   droga aktywacji konta, gdy SMTP nie jest jeszcze skonfigurowany. */
function ModalLinkAktywacyjny({ dane, przyZamknieciu }) {
  const [skopiowano, ustawSkopiowano] = useState(false);

  async function kopiuj() {
    try {
      await navigator.clipboard.writeText(dane.link);
      ustawSkopiowano(true);
    } catch (e) {
      ustawSkopiowano(false);
    }
  }

  return (
    <Modal tytul="Zaproszenie założone, e-mail nie wyszedł" przyZamknieciu={przyZamknieciu} szerokosc={560}>
      <Komunikat odmiana="uwaga" tresc={dane.powod} />
      <p className="male">
        Konto portalowe dla <strong>{dane.email}</strong> zostało założone. Przekaż klientowi poniższy
        link aktywacyjny — po jego otwarciu klient ustawi hasło i przejdzie do wniosku.
      </p>
      {dane.link ? (
        <>
          <div className="dane" style={{ wordBreak: 'break-all', padding: 'var(--od-12)', background: 'var(--papier)', borderRadius: 'var(--r-sm)' }}>
            {dane.link}
          </div>
          <div className="rzad odstep-g">
            <button className="btn btn-glowny" onClick={kopiuj}>
              {skopiowano ? 'Skopiowano' : 'Kopiuj link'}
            </button>
            <button className="btn" onClick={przyZamknieciu}>Zamknij</button>
          </div>
        </>
      ) : (
        <div className="rzad odstep-g">
          <button className="btn" onClick={przyZamknieciu}>Zamknij</button>
        </div>
      )}
    </Modal>
  );
}

window.EkranZgloszenWstepnych = EkranZgloszenWstepnych;
