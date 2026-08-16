/* szablony.js — wzory pism z wzory/ (blok A1 sesji 8).

   Ekran wyłącznie DO PODGLĄDU: treść wzoru edytuje się w Wordzie i podmienia
   plik w wzory/ (wzory/README.md) — nie ma tu przycisku "zapisz", bo nie ma
   niczego, co ta aplikacja mogłaby nadpisać. Wersjonowanie idzie przez git;
   skrót pliku (`hash`) zostaje w każdym wydanym dokumencie, żeby dało się
   wskazać, z którego BRZMIENIA wzoru powstało pismo sprzed roku. */

function ZnacznikPoprawnosci({ szablon }) {
  if (szablon.poprawny) return <Znacznik odmiana="zielony">gotowy</Znacznik>;
  return <Znacznik odmiana="bordo">wymaga poprawy</Znacznik>;
}

function ListaKluczy({ szablon }) {
  return (
    <div className="odstep-g">
      <div className="fl">Klucze użyte w tym wzorze</div>
      <div className="row-g" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {szablon.sekcje.map((k) => (
          <Pigulka key={`s-${k}`} odmiana="mosiadz">{k} (sekcja)</Pigulka>
        ))}
        {szablon.proste.map((k) => (
          <Pigulka key={k}>{k}</Pigulka>
        ))}
      </div>
    </div>
  );
}

/** Szczegóły jednego wzoru: klucze, walidacja, podgląd na danych próbnych. */
function SzczegolyWzoru({ kod, przyZamknieciu }) {
  const [szablon, ustawSzablon] = useState(null);
  const [podglad, ustawPodglad] = useState(null);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [ladowaniePodgladu, ustawLadowaniePodgladu] = useState(false);
  const [blad, ustawBlad] = useState(null);

  useEffect(() => {
    API.get(`/api/psa/szablony/${kod}`)
      .then((w) => ustawSzablon(w.szablon))
      .catch((e) => ustawBlad(e.message))
      .finally(() => ustawLadowanie(false));
  }, [kod]);

  async function pokazPodglad() {
    ustawLadowaniePodgladu(true);
    ustawBlad(null);
    try {
      ustawPodglad(await API.post(`/api/psa/szablony/${kod}/podglad`));
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawLadowaniePodgladu(false);
    }
  }

  return (
    <Modal
      tytul={ladowanie ? 'Wzór' : szablon.nazwa}
      przyZamknieciu={przyZamknieciu}
      szerokosc={880}
      stopka={<button className="btn" onClick={przyZamknieciu}>Zamknij</button>}
    >
      <Komunikat odmiana="blad" tresc={blad} />
      {ladowanie ? (
        <Spinner />
      ) : (
        <>
          <div className="row-g" style={{ alignItems: 'center' }}>
            <ZnacznikPoprawnosci szablon={szablon} />
            <span className="wyciszony kol-dane">{szablon.plik}</span>
          </div>
          <div className="podpowiedz odstep-d">
            Skrót treści: <span className="kol-dane">{szablon.hashKrotki}</span> — zapisuje się
            przy każdym wydanym z tego wzoru piśmie, więc zawsze wiadomo, które brzmienie pliku
            stało za konkretnym dokumentem.
          </div>

          {szablon.niezamkniete.length > 0 && (
            <Komunikat
              odmiana="blad"
              tytul="Sekcje bez znacznika zamykającego"
              lista={szablon.niezamkniete.map((n) => `{{#${n}}} — brakuje {{/${n}}}`)}
            />
          )}
          {szablon.ostrzezenia.length > 0 && (
            <Komunikat odmiana="uwaga" tytul="Pola rozbite przez Worda" lista={szablon.ostrzezenia} />
          )}

          <ListaKluczy szablon={szablon} />

          <div className="rozdzielacz" />

          <div className="row-g" style={{ flexWrap: 'wrap' }}>
            <button className="btn" onClick={pokazPodglad} disabled={ladowaniePodgladu}>
              {ladowaniePodgladu ? 'Składanie…' : 'Podgląd na danych próbnych'}
            </button>
            <a className="btn" href={`/api/psa/szablony/${kod}/podglad.docx`}>
              Pobierz jako .docx
            </a>
          </div>

          {podglad && (
            <>
              {podglad.bledy.length > 0 && (
                <Komunikat odmiana="blad" tytul="Błąd wzoru" lista={podglad.bledy} />
              )}
              {podglad.brakujace.length > 0 && (
                <Komunikat odmiana="uwaga" tytul="Klucze bez wartości w danych próbnych" lista={podglad.brakujace} />
              )}
              <Karta scisla tytul="Treść na danych próbnych">
                <pre
                  style={{
                    whiteSpace: 'pre-wrap', fontFamily: 'var(--czcionka-dane, monospace)',
                    fontSize: 12, lineHeight: 1.6, margin: 0,
                  }}
                >
                  {podglad.tekst}
                </pre>
              </Karta>
              <div className="podstawa-prawna odstep-g">
                Dane w podglądzie są fikcyjne (wzory/_generatory/dane_testowe.py) — służą wyłącznie
                sprawdzeniu, że wszystkie pola się podstawiają. Formatowanie (czcionka, tabele,
                akapity) widać dopiero w pobranym pliku .docx.
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

/** Pełny katalog kluczy — do sprawdzenia PRZED redakcją wzoru w Wordzie, nie po. */
function DostepneKlucze() {
  const { dane, ladowanie } = useDane('/api/psa/szablony/dostepne-klucze');
  const [rozwiniete, ustawRozwiniete] = useState(false);

  if (ladowanie || !dane) return null;
  return (
    <Karta scisla tytul="Wszystkie dostępne klucze">
      <button className="btn btn-maly" onClick={() => ustawRozwiniete((r) => !r)}>
        {rozwiniete ? 'Zwiń' : `Pokaż (${dane.proste.length} pól, ${dane.sekcje.length} sekcji)`}
      </button>
      {rozwiniete && (
        <div className="odstep-g">
          <div className="podpowiedz">
            Pełny słownik, niezależnie od tego, czego dziś używa który wzór — do sprawdzenia
            PRZED redakcją pisma w Wordzie.
          </div>
          <div className="row-g" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {dane.sekcje.map((k) => (
              <Pigulka key={`s-${k}`} odmiana="mosiadz">{k} (sekcja)</Pigulka>
            ))}
            {dane.proste.map((k) => (
              <Pigulka key={k}>{k}</Pigulka>
            ))}
          </div>
        </div>
      )}
    </Karta>
  );
}

function EkranSzablonow() {
  const { dane, ladowanie, blad } = useDane('/api/psa/szablony');
  const [otwarty, ustawOtwarty] = useState(null);

  if (ladowanie) return <Spinner />;
  if (blad) return <Komunikat odmiana="blad" tytul="Nie udało się wczytać wzorów" tresc={blad.message} />;

  const szablony = (dane && dane.szablony) || [];

  return (
    <>
      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">Szablony dokumentów</div>
          <div className="podtytul-strony">
            Wzory pism z katalogu <span className="kol-dane">wzory/</span> w repozytorium. Treść
            zmienia się podmieniając plik — patrz <span className="kol-dane">wzory/README.md</span>.
          </div>
        </div>
      </div>

      {szablony.length === 0 ? (
        <Karta>
          <Pusto tytul="Katalog wzory/ jest pusty" opis="Wgraj pliki .docx zgodnie z wzory/README.md." />
        </Karta>
      ) : (
        <Karta scisla>
          <table className="tabela">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Wzór</th>
                <th>Stan</th>
                <th className="do-prawej">Pól / sekcji</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {szablony.map((s) => (
                <tr key={s.kod}>
                  <td className="kol-dane">{s.kod}</td>
                  <td style={{ fontWeight: 500 }}>{s.nazwa}</td>
                  <td><ZnacznikPoprawnosci szablon={s} /></td>
                  <td className="do-prawej wyciszony">{s.proste.length} / {s.sekcje.length}</td>
                  <td className="do-prawej">
                    <button className="btn btn-maly" onClick={() => ustawOtwarty(s.kod)}>
                      Otwórz
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Karta>
      )}

      <div className="rozdzielacz" />
      <DostepneKlucze />

      {otwarty && <SzczegolyWzoru kod={otwarty} przyZamknieciu={() => ustawOtwarty(null)} />}
    </>
  );
}

window.EkranSzablonow = EkranSzablonow;
