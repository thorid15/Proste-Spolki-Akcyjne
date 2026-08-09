/* osoby.js — kartoteka wspólna (reguła domenowa nr 10). */

const PUSTA_OSOBA = {
  typ: 'fizyczna',
  nazwisko: '', imie: '', nazwa: '',
  pesel: '', data_urodzenia: '',
  nip: '', regon: '', numer_w_rejestrze: '', nazwa_rejestru: 'KRS',
  kraj: 'Polska', kod_pocztowy: '', miejscowosc: '', ulica: '', nr_domu: '', nr_lokalu: '',
  adres_doreczen: '', adres_edoreczen: '', email: '', telefon: '',
  zgoda_email: 0, aml_status: 'brak', aml_data: '', aml_notatka: '', uwagi: '',
};

function FormularzOsoby({ osoba, przyZamknieciu, przyZapisie }) {
  const [dane, ustawDane] = useState({ ...PUSTA_OSOBA, ...(osoba || {}) });
  const [blad, ustawBlad] = useState(null);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const edycja = Boolean(osoba && osoba.id);

  const pole = (klucz) => ({
    value: dane[klucz] ?? '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
  });

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const wynik = edycja
        ? await API.put(`/api/psa/osoby/${osoba.id}`, dane)
        : await API.post('/api/psa/osoby', dane);
      przyZapisie(wynik.osoba);
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawZapisywanie(false);
    }
  }

  return (
    <Modal
      tytul={edycja ? 'Dane osoby' : 'Nowa osoba w kartotece'}
      przyZamknieciu={przyZamknieciu}
      szerokosc={640}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button className="btn btn-primary" onClick={zapisz} disabled={zapisywanie}>
            {zapisywanie ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </>
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />

      <Pole etykieta="Rodzaj podmiotu" wymagane>
        <select {...pole('typ')}>
          <option value="fizyczna">Osoba fizyczna</option>
          <option value="prawna">Osoba prawna lub jednostka organizacyjna</option>
        </select>
      </Pole>

      {dane.typ === 'fizyczna' ? (
        <>
          <div className="siatka-2">
            <Pole etykieta="Nazwisko" wymagane><input type="text" {...pole('nazwisko')} /></Pole>
            <Pole etykieta="Imię"><input type="text" {...pole('imie')} /></Pole>
          </div>
          <div className="siatka-2">
            <Pole etykieta="PESEL"><input type="text" {...pole('pesel')} maxLength={11} /></Pole>
            <Pole etykieta="Data urodzenia">
              <PoleDaty wartosc={dane.data_urodzenia || ''} przyZmianie={(v) => ustawDane((p) => ({ ...p, data_urodzenia: v }))} />
            </Pole>
          </div>
          <Komunikat
            odmiana="info"
            tresc="Treścią rejestru są wyłącznie nazwisko, imię i adres (art. 300(33) § 1 pkt 5 KSH). PESEL i data urodzenia są dobrowolne — służą identyfikacji na potrzeby AML. Inni akcjonariusze ich nie zobaczą."
          />
        </>
      ) : (
        <>
          <Pole etykieta="Nazwa" wymagane><input type="text" {...pole('nazwa')} /></Pole>
          <div className="siatka-2">
            <Pole etykieta="Numer we właściwym rejestrze">
              <input type="text" {...pole('numer_w_rejestrze')} />
            </Pole>
            <Pole etykieta="Nazwa rejestru" podpowiedz="KRS, rejestr zagraniczny, inny — dane pomocnicze do identyfikacji podmiotu.">
              <input type="text" {...pole('nazwa_rejestru')} />
            </Pole>
          </div>
          <div className="siatka-2">
            <Pole etykieta="NIP"><input type="text" {...pole('nip')} /></Pole>
            <Pole etykieta="REGON"><input type="text" {...pole('regon')} /></Pole>
          </div>
        </>
      )}

      <div className="rozdzielacz" />

      <div className="siatka-2">
        <Pole etykieta="Kod pocztowy"><input type="text" {...pole('kod_pocztowy')} /></Pole>
        <Pole etykieta="Miejscowość"><input type="text" {...pole('miejscowosc')} /></Pole>
      </div>
      <div className="siatka-3">
        <Pole etykieta="Ulica"><input type="text" {...pole('ulica')} /></Pole>
        <Pole etykieta="Nr domu"><input type="text" {...pole('nr_domu')} /></Pole>
        <Pole etykieta="Nr lokalu"><input type="text" {...pole('nr_lokalu')} /></Pole>
      </div>
      <Pole etykieta="Adres do doręczeń" podpowiedz="Jeśli inny niż adres zamieszkania lub siedziby.">
        <input type="text" {...pole('adres_doreczen')} />
      </Pole>

      <div className="siatka-2">
        <Pole etykieta="E-mail"><input type="text" {...pole('email')} /></Pole>
        <Pole etykieta="Telefon"><input type="text" {...pole('telefon')} /></Pole>
      </div>
      <Pole etykieta="Adres do e-doręczeń"><input type="text" {...pole('adres_edoreczen')} /></Pole>

      <label className="chk" style={{ padding: '8px 0' }}>
        <input
          type="checkbox"
          checked={Boolean(Number(dane.zgoda_email))}
          onChange={(z) => ustawDane((p) => ({ ...p, zgoda_email: z.target.checked ? 1 : 0 }))}
        />
        <span className="chk-tresc">
          Zgoda na komunikację elektroniczną (art. 300(33) § 1 pkt 5 KSH)
        </span>
      </label>

      <div className="rozdzielacz" />

      <div className="siatka-2">
        <Pole
          etykieta="Środki bezpieczeństwa finansowego (AML)"
          podpowiedz="Notariusz prowadzący rejestr jest instytucją obowiązaną. Brak możliwości zastosowania środków = przeszkoda wpisu."
        >
          <select {...pole('aml_status')}>
            <option value="brak">nie wykonano</option>
            <option value="wykonane">wykonane</option>
            <option value="niemozliwe">niemożliwe do zastosowania</option>
          </select>
        </Pole>
        <Pole etykieta="Data weryfikacji AML">
          <PoleDaty wartosc={dane.aml_data || ''} przyZmianie={(v) => ustawDane((p) => ({ ...p, aml_data: v }))} />
        </Pole>
      </div>
      <Pole etykieta="Notatka AML" podpowiedz="Nigdy nie trafia na wydruki dla klienta.">
        <textarea {...pole('aml_notatka')} style={{ minHeight: 70 }} />
      </Pole>
      <Pole etykieta="Uwagi wewnętrzne" podpowiedz="Nigdy nie trafiają na wydruki.">
        <textarea {...pole('uwagi')} style={{ minHeight: 70 }} />
      </Pole>
    </Modal>
  );
}

function EkranOsob() {
  const [szukaj, ustawSzukaj] = useState('');
  const [zapytanie, ustawZapytanie] = useState('');
  const [formularz, ustawFormularz] = useState(null);
  const { dane, ladowanie, odswiez } = useDane(`/api/psa/osoby?q=${encodeURIComponent(zapytanie)}`);

  useEffect(() => {
    const uchwyt = setTimeout(() => ustawZapytanie(szukaj), 250);
    return () => clearTimeout(uchwyt);
  }, [szukaj]);

  const osoby = (dane && dane.osoby) || [];

  return (
    <>
      <div className="pasek-narzedzi">
        <Szukajka wartosc={szukaj} przyZmianie={ustawSzukaj} placeholder="Szukaj po nazwisku, PESEL, NIP, e-mailu…" />
        <button className="btn btn-glowny" style={{ marginLeft: 'auto' }} onClick={() => ustawFormularz({})}>
          Nowa osoba
        </button>
      </div>

      {ladowanie ? (
        <Spinner />
      ) : osoby.length === 0 ? (
        <Karta>
          <Pusto
            tytul="Kartoteka jest pusta"
            opis={
              zapytanie
                ? 'Żadna osoba nie pasuje do wyszukiwania.'
                : 'Dodaj pierwszą osobę — będzie dostępna we wszystkich prowadzonych rejestrach.'
            }
            akcja={
              !zapytanie && (
                <button className="btn btn-glowny" onClick={() => ustawFormularz({})}>
                  Nowa osoba
                </button>
              )
            }
          />
        </Karta>
      ) : (
        <Karta scisla>
          <table className="tabela">
            <thead>
              <tr>
                <th>Oznaczenie</th>
                <th>Rodzaj</th>
                <th>Identyfikator jawny</th>
                <th>AML</th>
                <th className="do-prawej">Spółki</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {osoby.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500 }}>{o.oznaczenie}</td>
                  <td className="wyciszony">
                    {o.typ === 'prawna' ? 'osoba prawna' : 'osoba fizyczna'}
                  </td>
                  <td className="kol-dane">{o.jawny_identyfikator || '—'}</td>
                  <td><StatusAml status={o.aml_status} /></td>
                  <td className="do-prawej">{o.liczba_spolek || 0}</td>
                  <td className="do-prawej">
                    <button className="btn btn-maly" onClick={() => ustawFormularz(o)}>
                      Otwórz
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Karta>
      )}

      {formularz && (
        <FormularzOsoby
          osoba={formularz.id ? formularz : null}
          przyZamknieciu={() => ustawFormularz(null)}
          przyZapisie={() => {
            ustawFormularz(null);
            odswiez();
          }}
        />
      )}
    </>
  );
}

window.FormularzOsoby = FormularzOsoby;
window.EkranOsob = EkranOsob;
