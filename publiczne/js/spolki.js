/* spolki.js — lista spółek i dodawanie spółki w trzech krokach (z pobraniem z KRS).

   `Kroki` przeniesione do `ui-rejestr.js` (sesja 6, faza 1) — wskaźnik kroków
   jest komponentem systemu, nie tego ekranu. Ekran rejestracji spółki dostaje
   nowy kształt w fazie 3. */

const PUSTA_SPOLKA = {
  krs: '', nip: '', regon: '', nazwa: '', forma_prawna: 'PROSTA SPÓŁKA AKCYJNA',
  kraj: 'Polska', kod_pocztowy: '', miejscowosc: '', ulica: '', nr_domu: '', nr_lokalu: '',
  sad_rejestrowy: '', wydzial: '', telefon: '', email: '', www: '',
  status: 'aktywna', data_utworzenia_spolki: '', data_uchwaly_wyboru: '', data_umowy: '',
  data_otwarcia_rejestru: '', opis: '', uwagi: '',
};

const KROKI_SPOLKI = ['Identyfikacja', 'Dane spółki', 'Umowa o prowadzenie rejestru'];

function EkranNowejSpolki() {
  const [krok, ustawKrok] = useState(0);
  const [dane, ustawDane] = useState(PUSTA_SPOLKA);
  const [pobieranie, ustawPobieranie] = useState(false);
  const [komunikatKrs, ustawKomunikatKrs] = useState(null);
  const [blad, ustawBlad] = useState(null);
  const [zapisywanie, ustawZapisywanie] = useState(false);

  const pole = (klucz) => ({
    value: dane[klucz] ?? '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
  });

  async function pobierzZKrs() {
    const numer = String(dane.krs || '').replace(/\D/g, '');
    ustawPobieranie(true);
    ustawKomunikatKrs(null);
    try {
      const wynik = await API.get(`/api/psa/spolki/z-krs/${numer}`);
      if (!wynik.znaleziono) {
        ustawKomunikatKrs({ odmiana: 'uwaga', tresc: wynik.komunikat });
      } else if (wynik.dopuszczalna === false) {
        ustawKomunikatKrs({ odmiana: 'blad', tresc: wynik.komunikat });
      } else {
        const pobrane = Object.fromEntries(
          Object.entries(wynik.dane).filter(([, v]) => v !== null && v !== '')
        );
        ustawDane((p) => ({ ...p, ...pobrane }));
        ustawKomunikatKrs({
          odmiana: (wynik.ostrzezenia || []).length ? 'uwaga' : 'ok',
          tresc: (wynik.ostrzezenia || []).length
            ? wynik.ostrzezenia.join(' ')
            : 'Dane pobrane z rejestru przedsiębiorców. Sprawdź je przed zapisaniem.',
        });
      }
    } catch (e) {
      ustawKomunikatKrs({ odmiana: 'uwaga', tresc: `${e.message} Uzupełnij dane ręcznie.` });
    } finally {
      ustawPobieranie(false);
    }
  }

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post('/api/psa/spolki', dane);
      idz(`/spolki/${wynik.spolka.id}`);
    } catch (e) {
      ustawBlad(e.message);
      ustawZapisywanie(false);
    }
  }

  const mozeDalej = krok === 0 ? Boolean(dane.nazwa && dane.nazwa.trim()) : true;

  return (
    <>
      <div className="okruszki">
        <button onClick={() => idz('/spolki')}>Spółki</button> → nowa spółka
      </div>
      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">Nowa spółka</div>
          <div className="podtytul-strony">
            Rejestr prowadzimy wyłącznie dla prostych spółek akcyjnych — art. 300(31) § 1 KSH.
          </div>
        </div>
      </div>

      <Kroki kroki={KROKI_SPOLKI} biezacy={krok} />
      <Komunikat odmiana="blad" tresc={blad} />

      <Karta>
        {krok === 0 && (
          <>
            <Pole
              etykieta="Numer KRS"
              podpowiedz="Dziesięć cyfr. Dane pobierzemy z otwartego API rejestru przedsiębiorców; przy niepowodzeniu uzupełnisz je ręcznie."
            >
              <div className="row-g">
                <input type="text" {...pole('krs')} maxLength={10} placeholder="0000123456" />
                <button
                  className="btn"
                  onClick={pobierzZKrs}
                  disabled={pobieranie || String(dane.krs || '').replace(/\D/g, '').length !== 10}
                >
                  {pobieranie ? 'Pobieranie…' : 'Pobierz z KRS'}
                </button>
              </div>
            </Pole>

            {komunikatKrs && <Komunikat odmiana={komunikatKrs.odmiana} tresc={komunikatKrs.tresc} />}

            <Pole etykieta="Firma (nazwa) spółki" wymagane>
              <input type="text" {...pole('nazwa')} />
            </Pole>
            <Pole
              etykieta="Forma prawna"
              podpowiedz="Notariusz nie może prowadzić rejestru akcjonariuszy S.A. ani S.K.A."
              wymagane
            >
              <input type="text" {...pole('forma_prawna')} />
            </Pole>
            <div className="siatka-2">
              <Pole etykieta="NIP"><input type="text" {...pole('nip')} /></Pole>
              <Pole etykieta="REGON"><input type="text" {...pole('regon')} /></Pole>
            </div>
          </>
        )}

        {krok === 1 && (
          <>
            <div className="siatka-2">
              <Pole etykieta="Kod pocztowy"><input type="text" {...pole('kod_pocztowy')} /></Pole>
              <Pole etykieta="Miejscowość"><input type="text" {...pole('miejscowosc')} /></Pole>
            </div>
            <div className="siatka-3">
              <Pole etykieta="Ulica"><input type="text" {...pole('ulica')} /></Pole>
              <Pole etykieta="Nr domu"><input type="text" {...pole('nr_domu')} /></Pole>
              <Pole etykieta="Nr lokalu"><input type="text" {...pole('nr_lokalu')} /></Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="Sąd rejestrowy"><input type="text" {...pole('sad_rejestrowy')} /></Pole>
              <Pole etykieta="Wydział"><input type="text" {...pole('wydzial')} /></Pole>
            </div>
            <div className="siatka-3">
              <Pole etykieta="Telefon"><input type="text" {...pole('telefon')} /></Pole>
              <Pole etykieta="E-mail"><input type="text" {...pole('email')} /></Pole>
              <Pole etykieta="Strona internetowa"><input type="text" {...pole('www')} /></Pole>
            </div>
            <Pole etykieta="Data utworzenia spółki">
              <input type="date" {...pole('data_utworzenia_spolki')} />
            </Pole>
          </>
        )}

        {krok === 2 && (
          <>
            <div className="siatka-3">
              <Pole
                etykieta="Data uchwały o wyborze"
                podpowiedz="art. 300(32) § 1 KSH"
              >
                <input type="date" {...pole('data_uchwaly_wyboru')} />
              </Pole>
              <Pole etykieta="Data umowy o prowadzenie rejestru">
                <input type="date" {...pole('data_umowy')} />
              </Pole>
              <Pole etykieta="Data otwarcia rejestru">
                <input type="date" {...pole('data_otwarcia_rejestru')} />
              </Pole>
            </div>
            <Pole etykieta="Status">
              <select {...pole('status')}>
                <option value="aktywna">aktywna</option>
                <option value="w_likwidacji">w likwidacji</option>
                <option value="zawieszona">zawieszona</option>
                <option value="wykreslona">wykreślona</option>
              </select>
            </Pole>
            <Pole etykieta="Opis" podpowiedz="Drukowany na raporcie spółki.">
              <textarea {...pole('opis')} />
            </Pole>
            <Pole etykieta="Uwagi wewnętrzne" podpowiedz="Nigdy nie trafiają na wydruk.">
              <textarea {...pole('uwagi')} />
            </Pole>

            <Komunikat
              odmiana="info"
              tresc={
                'Po zapisaniu spółki otwórz jej kokpit i zarejestruj emisję akcji — ' +
                'to pierwsze zdarzenie w rejestrze. Zgłoszenie podmiotu prowadzącego rejestr ' +
                'do KRS należy do zarządu spółki (art. 300(32) § 1(1) KSH).'
              }
            />
          </>
        )}

        <div className="kreator-stopka">
          <button
            className="btn"
            onClick={() => (krok === 0 ? idz('/spolki') : ustawKrok((k) => k - 1))}
          >
            {krok === 0 ? 'Anuluj' : 'Wstecz'}
          </button>
          <div className="kreator-stopka-prawa">
            {krok < KROKI_SPOLKI.length - 1 ? (
              <button
                className="btn btn-primary"
                disabled={!mozeDalej}
                onClick={() => ustawKrok((k) => k + 1)}
              >
                Dalej
              </button>
            ) : (
              <button className="btn btn-primary" onClick={zapisz} disabled={zapisywanie}>
                {zapisywanie ? 'Zapisywanie…' : 'Zapisz spółkę'}
              </button>
            )}
          </div>
        </div>
      </Karta>
    </>
  );
}

function EkranSpolek() {
  const [szukaj, ustawSzukaj] = useState('');
  const [zapytanie, ustawZapytanie] = useState('');
  const [status, ustawStatus] = useState('wszystkie');
  const [strona, ustawStrone] = useState(1);
  const { dane, ladowanie } = useDane(`/api/psa/spolki?q=${encodeURIComponent(zapytanie)}`);

  useEffect(() => {
    const uchwyt = setTimeout(() => ustawZapytanie(szukaj), 250);
    return () => clearTimeout(uchwyt);
  }, [szukaj]);

  const spolki = (dane && dane.spolki) || [];

  // Filtrowanie i stronicowanie po stronie klienta: endpoint zwraca komplet,
  // a przy 500 rejestrach lista i tak mieści się w jednym zapytaniu.
  const widoczne = spolki.filter((s) => status === 'wszystkie' || s.status === status);
  const NA_STRONE = 12;
  const stron = Math.max(Math.ceil(widoczne.length / NA_STRONE), 1);
  const biezaca = Math.min(strona, stron);
  const wycinek = widoczne.slice((biezaca - 1) * NA_STRONE, biezaca * NA_STRONE);

  return (
    <>
      <div className="pasek-narzedzi">
        <Szukajka
          wartosc={szukaj}
          przyZmianie={(v) => { ustawSzukaj(v); ustawStrone(1); }}
          placeholder="Szukaj po nazwie, numerze KRS lub NIP…"
        />
        <select value={status} onChange={(z) => { ustawStatus(z.target.value); ustawStrone(1); }}>
          <option value="wszystkie">Status: wszystkie</option>
          <option value="aktywna">aktywna</option>
          <option value="w_likwidacji">w likwidacji</option>
          <option value="zawieszona">zawieszona</option>
          <option value="wykreslona">wykreślona</option>
        </select>
        <span className="podstawa-prawna" style={{ marginLeft: 'auto' }}>
          {widoczne.length === spolki.length
            ? `${fmt.liczba(spolki.length)} ${fmt.odmien(spolki.length, 'rejestr', 'rejestry', 'rejestrów')}`
            : `${fmt.liczba(widoczne.length)} z ${fmt.liczba(spolki.length)}`}
        </span>
        <button className="btn btn-glowny" onClick={() => idz('/spolki/nowa')}>
          <Ikona nazwa="plus" rozmiar={16} /> Dodaj spółkę
        </button>
      </div>

      {ladowanie ? (
        <Spinner />
      ) : widoczne.length === 0 ? (
        <Karta>
          <Pusto
            ikona="spolki"
            tytul={zapytanie || status !== 'wszystkie' ? 'Nic nie pasuje do filtrów' : 'Nie prowadzisz jeszcze żadnego rejestru'}
            opis={
              zapytanie || status !== 'wszystkie'
                ? 'Zmień frazę wyszukiwania albo status, żeby zobaczyć więcej.'
                : 'Dodaj spółkę, żeby otworzyć dla niej rejestr akcjonariuszy.'
            }
            akcja={
              zapytanie || status !== 'wszystkie' ? (
                <button className="btn" onClick={() => { ustawSzukaj(''); ustawStatus('wszystkie'); }}>
                  Wyczyść filtry
                </button>
              ) : (
                <button className="btn btn-glowny" onClick={() => idz('/spolki/nowa')}>
                  <Ikona nazwa="plus" rozmiar={16} /> Dodaj spółkę
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
                <th>Spółka</th>
                <th>Status</th>
                <th className="do-prawej">Serie</th>
                <th className="do-prawej">Akcjonariusze</th>
                <th className="do-prawej">Akcje</th>
                <th>Ostatnie zdarzenie</th>
                <th className="kol-strzalka" />
              </tr>
            </thead>
            <tbody>
              {wycinek.map((s) => (
                <tr key={s.id} className="klikalna" onClick={() => idz(`/spolki/${s.id}`)}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.nazwa}</div>
                    <div className="wiersz-podtytul">
                      {s.krs ? `KRS ${s.krs}` : 'bez numeru KRS'}
                      {s.miejscowosc ? ` · ${s.miejscowosc}` : ''}
                    </div>
                  </td>
                  <td><StatusSpolki status={s.status} /></td>
                  <td className="do-prawej">{fmt.liczba(s.liczba_emisji)}</td>
                  <td className="do-prawej">{fmt.liczba(s.liczba_akcjonariuszy)}</td>
                  <td className="do-prawej">{fmt.liczba(s.liczba_akcji)}</td>
                  <td className="kol-dane wyciszony">{fmt.data(s.ostatnie_zdarzenie)}</td>
                  <td className="kol-strzalka"><Ikona nazwa="strzalkaPrawo" rozmiar={15} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Stronicowanie
            strona={biezaca}
            stron={stron}
            odPozycji={(biezaca - 1) * NA_STRONE + 1}
            doPozycji={Math.min(biezaca * NA_STRONE, widoczne.length)}
            razem={widoczne.length}
            przyZmianie={ustawStrone}
          />
        </Karta>
      )}
    </>
  );
}


window.EkranSpolek = EkranSpolek;
window.EkranNowejSpolki = EkranNowejSpolki;
