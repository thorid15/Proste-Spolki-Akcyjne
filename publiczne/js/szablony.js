/* szablony.js — redakcja szablonów dokumentów wychodzących (faza 4).

   Szablon jest niezmienialny: zapis zakłada KOLEJNĄ WERSJĘ, nigdy nie
   nadpisuje poprzedniej. Ekran mówi to wprost, bo to nie jest oczywiste
   dla kogoś, kto zna zwykłe edytory. */

/** Podpowiedź składni — jedyne trzy rzeczy, które trzeba wiedzieć. */
function PomocSkladni() {
  return (
    <Karta scisla tytul="Składnia">
      <dl className="pary">
        <Para etykieta={<span className="kol-dane">{'{{klucz}}'}</span>}>
          wartość pola, np. nazwa spółki
        </Para>
        <Para etykieta={<span className="kol-dane">{'{{klucz_slownie}}'}</span>}>
          ta sama wartość zapisana słowami — liczba albo data
        </Para>
        <Para etykieta={<span className="kol-dane">{'{{#lista}}…{{/lista}}'}</span>}>
          powtórzenie fragmentu dla każdej pozycji, np. wiersz tabeli
        </Para>
      </dl>
      <div className="podstawa-prawna odstep-g">
        Klucz, którego nie da się uzupełnić, drukuje się jako „—" i pojawia się na liście
        braków w podglądzie. Nic nie znika po cichu.
      </div>
    </Karta>
  );
}

function ListaKluczy({ klucze }) {
  if (!klucze) return null;
  const proste = klucze.proste || [];
  const listy = klucze.listy || [];
  if (proste.length === 0 && listy.length === 0) return null;
  return (
    <div className="odstep-g">
      <div className="fl">Klucze użyte w tym szablonie</div>
      <div className="row-g" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {listy.map((k) => (
          <Pigulka key={`l-${k}`} odmiana="mosiadz">{k} (lista)</Pigulka>
        ))}
        {proste.map((k) => (
          <Pigulka key={k}>{k}</Pigulka>
        ))}
      </div>
    </div>
  );
}

/** Redakcja jednego szablonu: treść, podgląd na danych próbnych, historia. */
function RedakcjaSzablonu({ szablon, przyZamknieciu, przyZapisie }) {
  const [tytul, ustawTytul] = useState(szablon.tytul);
  const [tresc, ustawTresc] = useState(szablon.tresc);
  const [podglad, ustawPodglad] = useState(null);
  const [ladowaniePodgladu, ustawLadowaniePodgladu] = useState(false);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [historia, ustawHistorie] = useState(null);

  const zmieniony = tresc !== szablon.tresc || tytul !== szablon.tytul;

  async function pokazPodglad() {
    ustawLadowaniePodgladu(true);
    ustawBlad(null);
    try {
      const w = await API.post('/api/psa/szablony/podglad', {
        tresc,
        tytul,
        podstawa_prawna: szablon.podstawa_prawna,
      });
      ustawPodglad(w);
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawLadowaniePodgladu(false);
    }
  }

  async function wczytajHistorie() {
    try {
      const w = await API.get(`/api/psa/szablony/${szablon.kod}`);
      ustawHistorie(w.wersje);
    } catch (e) {
      ustawBlad(e.message);
    }
  }

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      await API.post(`/api/psa/szablony/${szablon.kod}/wersje`, {
        tytul,
        tresc,
        opis: szablon.opis,
        podstawa_prawna: szablon.podstawa_prawna,
      });
      przyZapisie();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawZapisywanie(false);
    }
  }

  async function przywroc(wersja) {
    if (!window.confirm(`Uczynić wersję ${wersja} aktywną? Treść wersji nie zmieni się.`)) return;
    try {
      await API.post(`/api/psa/szablony/${szablon.kod}/aktywuj`, { wersja });
      przyZapisie();
    } catch (e) {
      ustawBlad(e.message);
    }
  }

  return (
    <Modal
      tytul={szablon.tytul}
      przyZamknieciu={przyZamknieciu}
      szerokosc={1100}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Zamknij</button>
          <button className="btn" onClick={pokazPodglad} disabled={ladowaniePodgladu}>
            {ladowaniePodgladu ? 'Składanie…' : 'Podgląd'}
          </button>
          <button className="btn btn-glowny" onClick={zapisz} disabled={!zmieniony || zapisywanie}>
            {zapisywanie ? 'Zapisywanie…' : `Zapisz jako wersję ${szablon.wersja + 1}`}
          </button>
        </>
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />

      <Komunikat
        odmiana="info"
        tresc={`Aktywna jest wersja ${szablon.wersja}. Zapis nie nadpisuje jej — zakłada kolejną. Poprzednie zostają, bo to one są podstawą pism już wydanych.`}
      />

      <Pole etykieta="Tytuł dokumentu" wymagane>
        <input type="text" value={tytul} onChange={(z) => ustawTytul(z.target.value)} />
      </Pole>

      {szablon.podstawa_prawna && (
        <div className="podstawa-prawna odstep-d">Podstawa: {szablon.podstawa_prawna}</div>
      )}

      <Pole
        etykieta="Treść pisma"
        podpowiedz="Samo ciało pisma — nagłówek kancelarii i stopkę dokłada system."
      >
        <textarea
          value={tresc}
          onChange={(z) => ustawTresc(z.target.value)}
          spellCheck={false}
          style={{ minHeight: 320, fontFamily: 'var(--czcionka-dane, monospace)', fontSize: 12, lineHeight: 1.6 }}
        />
      </Pole>

      <PomocSkladni />

      {podglad && (
        <>
          {podglad.bledy && podglad.bledy.length > 0 && (
            <Komunikat odmiana="blad" tytul="Błąd składni" lista={podglad.bledy} />
          )}
          {podglad.brakujace && podglad.brakujace.length > 0 && (
            <Komunikat
              odmiana="uwaga"
              tytul="Klucze bez wartości w danych próbnych"
              lista={podglad.brakujace}
            />
          )}
          <ListaKluczy klucze={podglad.klucze} />
          <Karta scisla tytul="Podgląd na danych próbnych">
            <iframe
              title="Podgląd dokumentu"
              srcDoc={podglad.html}
              style={{ width: '100%', height: 520, border: '1px solid var(--linia)', borderRadius: 8, background: '#fff' }}
            />
            <div className="podstawa-prawna odstep-g">
              Dane w podglądzie są fikcyjne — służą wyłącznie sprawdzeniu układu i kompletności pól.
            </div>
          </Karta>
        </>
      )}

      <div className="rozdzielacz" />

      {historia ? (
        <Karta scisla tytul="Historia wersji">
          <table className="tabela">
            <thead>
              <tr>
                <th>Wersja</th>
                <th>Tytuł</th>
                <th>Autor</th>
                <th>Utworzono</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {historia.map((w) => (
                <tr key={w.wersja}>
                  <td className="kol-dane">{w.wersja}</td>
                  <td>
                    {w.tytul}
                    {w.aktywna ? <Pigulka odmiana="rejestr" style={{ marginLeft: 8 }}>aktywna</Pigulka> : null}
                  </td>
                  <td className="wyciszony">{w.wbudowany ? 'wbudowany' : w.autor}</td>
                  <td className="kol-dane">{fmt.data(w.utworzono)}</td>
                  <td className="do-prawej">
                    {!w.aktywna && (
                      <button className="btn btn-maly" onClick={() => przywroc(w.wersja)}>
                        Uczyń aktywną
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Karta>
      ) : (
        <button className="btn btn-maly" onClick={wczytajHistorie}>
          Pokaż historię wersji
        </button>
      )}
    </Modal>
  );
}

function EkranSzablonow() {
  const { dane, ladowanie, blad, odswiez } = useDane('/api/psa/szablony');
  const [otwarty, ustawOtwarty] = useState(null);

  if (ladowanie) return <Spinner />;
  if (blad) return <Komunikat odmiana="blad" tytul="Nie udało się wczytać szablonów" tresc={blad.message} />;

  const szablony = (dane && dane.szablony) || [];

  return (
    <>
      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">Szablony dokumentów</div>
          <div className="podtytul-strony">
            Treść pism wychodzących z rejestru. Redakcja zakłada kolejną wersję — poprzednie
            zostają, bo to one są podstawą dokumentów już wydanych.
          </div>
        </div>
      </div>

      <Karta scisla>
        <table className="tabela">
          <thead>
            <tr>
              <th>Dokument</th>
              <th>Podstawa prawna</th>
              <th className="do-prawej">Wersja</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {szablony.map((s) => (
              <tr key={s.kod}>
                <td>
                  <div style={{ fontWeight: 500 }}>{s.tytul}</div>
                  {s.opis && <div className="podpowiedz">{s.opis}</div>}
                </td>
                <td className="wyciszony">{s.podstawa_prawna || '—'}</td>
                <td className="do-prawej kol-dane">
                  {s.wersja}
                  {s.wersji > 1 && <span className="wyciszony"> z {s.wersji}</span>}
                </td>
                <td className="do-prawej">
                  <button className="btn btn-maly" onClick={() => ustawOtwarty(s)}>
                    Otwórz
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Karta>

      {otwarty && (
        <RedakcjaSzablonu
          szablon={otwarty}
          przyZamknieciu={() => ustawOtwarty(null)}
          przyZapisie={() => {
            ustawOtwarty(null);
            odswiez();
          }}
        />
      )}
    </>
  );
}

window.EkranSzablonow = EkranSzablonow;
